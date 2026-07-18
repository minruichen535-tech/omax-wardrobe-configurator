const dealerAuthMessages = {
  dealer_disabled: "该经销商账号已停用，请联系奥美斯。",
  dealer_archived: "该经销商账号已注销，请联系奥美斯。",
  dealer_expired: "该经销商账号授权已到期，请联系奥美斯。",
  dealer_required: "请先登录经销商账号。"
};

export function installDealerSessionGuard({ intervalMs = 60000 } = {}) {
  if (!isProtectedDealerPage()) return () => {};
  let blocked = false;
  let checking = false;

  const checkSession = async () => {
    if (blocked || checking) return;
    checking = true;
    try {
      const response = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.authenticated && payload.account?.role === "dealer" && payload.account?.status === "active") return;
      blockDealerPage(payload.message || dealerAuthMessages[payload.error] || dealerAuthMessages.dealer_required);
      blocked = true;
    } catch {
      // Network failures should not block local interaction; protected APIs remain authoritative.
    } finally {
      checking = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") checkSession();
  };
  const timer = window.setInterval(checkSession, intervalMs);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  checkSession();
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

function isProtectedDealerPage(pathname = window.location.pathname) {
  return pathname.startsWith("/dealer/") && !pathname.startsWith("/dealer/login/");
}

function blockDealerPage(message) {
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;margin:0;background:#f7f5f0;color:#2f3432;font-family:Inter,'Microsoft YaHei',sans-serif;">
      <section style="width:min(520px,calc(100% - 32px));padding:32px;background:#fff;border:1px solid #e5e1d8;border-radius:12px;text-align:center;box-shadow:0 12px 30px rgba(47,52,50,.08);">
        <h1 style="margin:0 0 12px;font-size:24px;">无法访问经销商入口</h1>
        <p style="margin:0 0 20px;color:#6b706d;line-height:1.7;">${escapeHtml(message)}</p>
        <a style="color:#8a6545;font-weight:700;" href="/dealer/login/">返回登录</a>
      </section>
    </main>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}
