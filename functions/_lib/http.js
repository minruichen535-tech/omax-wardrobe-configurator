export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function html(message, status = 403, init = {}) {
  return new Response(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>经销商账号受限</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f5f0;color:#2f3432;font-family:Inter,"Microsoft YaHei",sans-serif}
      main{width:min(520px,calc(100% - 32px));padding:32px;background:#fff;border:1px solid #e5e1d8;border-radius:12px;text-align:center;box-shadow:0 12px 30px rgba(47,52,50,.08)}
      h1{margin:0 0 12px;font-size:24px}p{margin:0 0 20px;color:#6b706d;line-height:1.7}a{color:#8a6545;font-weight:700}
    </style>
  </head>
  <body><main><h1>无法访问经销商入口</h1><p>${escapeHtml(message)}</p><a href="/dealer/login/">返回登录</a></main></body>
</html>`, {
    ...init,
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(init.headers || {}) }
  });
}

export function methodNotAllowed() {
  return json({ error: "method_not_allowed" }, { status: 405 });
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

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
