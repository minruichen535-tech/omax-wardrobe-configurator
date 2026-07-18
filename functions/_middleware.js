import {
  blockedMessage,
  createClearSessionCookie,
  dealerAuthErrorCode,
  destroySession,
  getAccountBlockedReason,
  getDealerPermissions,
  getSessionAccount,
  normalizeSeriesId
} from "./_lib/auth.js";
import { html } from "./_lib/http.js";

const publicDealerPaths = new Set([
  "/dealer/login/",
  "/dealer/login/index.html"
]);
const publicAdminPaths = new Set([
  "/admin/login/",
  "/admin/login/index.html"
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = normalizePath(url.pathname);

  if (pathname.startsWith("/dealer/") && !publicDealerPaths.has(pathname)) {
    const account = await getSessionAccount(context.env, context.request);
    const blockedReason = account?.blockedReason || getAccountBlockedReason(account);
    if (!account || blockedReason) {
      if (account && blockedReason) await destroySession(context.env.DB, context.request);
      return html(blockedMessage(blockedReason), blockedReason ? 403 : 401, {
        headers: { "set-cookie": createClearSessionCookie() }
      });
    }
    if (account.role !== "dealer") return html("当前账号无权访问经销商入口。", 403);

    const seriesId = getDealerSeriesFromPath(pathname);
    if (seriesId) {
      const permissions = await getDealerPermissions(context.env.DB, account.id);
      if (!permissions.allowedSeries.includes(seriesId)) {
        return html("当前经销商账号无权访问该产品系列，请联系奥美斯。", 403);
      }
    }
  }

  if ((pathname.startsWith("/admin/dealers/") || pathname.startsWith("/admin/dealer-order/") || pathname.startsWith("/admin/dealer-orders/")) && !publicAdminPaths.has(pathname)) {
    const account = await getSessionAccount(context.env, context.request);
    if (!account || account.blockedReason || account.role !== "admin") {
      return Response.redirect(new URL("/admin/login/", url), 302);
    }
  }

  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/bootstrap/")) {
    const account = await getSessionAccount(context.env, context.request);
    if (!account || account.blockedReason || account.role !== "admin") {
      return new Response(JSON.stringify({ error: "admin_required" }), {
        status: 401,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
  }

  if (pathname.startsWith("/api/dealer/")) {
    const account = await getSessionAccount(context.env, context.request);
    const blockedReason = account?.blockedReason || getAccountBlockedReason(account);
    if (!account || blockedReason || account.role !== "dealer") {
      if (account && blockedReason) await destroySession(context.env.DB, context.request);
      return new Response(JSON.stringify({
        error: dealerAuthErrorCode(blockedReason),
        message: blockedMessage(blockedReason)
      }), {
        status: account && blockedReason ? 403 : 401,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "set-cookie": createClearSessionCookie()
        }
      });
    }
  }

  return context.next();
}

function normalizePath(pathname) {
  if (pathname.endsWith("/")) return pathname;
  const lastSegment = pathname.split("/").pop() || "";
  if (lastSegment.includes(".")) return pathname;
  return `${pathname}/`;
}

function getDealerSeriesFromPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "dealer" || !segments[1]) return "";
  if (segments[1] === "profile" || segments[1] === "login") return "";
  return normalizeSeriesId(segments[1]);
}
