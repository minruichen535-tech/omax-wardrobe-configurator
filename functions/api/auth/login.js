import { createSession, requireDb, verifyPassword } from "../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../_lib/http.js";

export async function onRequestPost(context) {
  // TODO: add per-account/IP rate limiting with Cloudflare WAF, KV, or Durable Object counters.
  const db = requireDb(context.env);
  const body = await readJson(context.request);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) {
    return json({ error: "missing_credentials" }, { status: 400 });
  }

  const account = await db.prepare("SELECT * FROM accounts WHERE username = ? LIMIT 1")
    .bind(username)
    .first();
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return json({ error: "invalid_credentials" }, { status: 401 });
  }
  const now = new Date().toISOString();
  if (account.status === "disabled") return json({ error: "disabled", message: "该经销商账号已停用，请联系奥美斯。" }, { status: 403 });
  if (account.status === "archived") return json({ error: "archived", message: "该经销商账号已注销，请联系奥美斯。" }, { status: 403 });
  if (account.expiresAt && account.expiresAt <= now) return json({ error: "expired", message: "该经销商账号授权已到期，请联系奥美斯。" }, { status: 403 });

  const cookie = await createSession(db, account, context.request);
  return json({
    account: {
      id: account.id,
      username: account.username,
      role: account.role,
      status: account.status,
      expiresAt: account.expiresAt || ""
    }
  }, { headers: { "set-cookie": cookie } });
}

export function onRequestGet() {
  return methodNotAllowed();
}
