import { hashPassword, requireDb } from "../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../_lib/http.js";

export async function onRequestPost(context) {
  const token = context.request.headers.get("x-bootstrap-token") || "";
  if (!context.env.ADMIN_BOOTSTRAP_TOKEN || token !== context.env.ADMIN_BOOTSTRAP_TOKEN) {
    return json({ error: "bootstrap_token_required" }, { status: 403 });
  }
  const db = requireDb(context.env);
  const existingAdmin = await db.prepare("SELECT id FROM accounts WHERE role = 'admin' LIMIT 1").first();
  if (existingAdmin) return json({ error: "admin_exists" }, { status: 409 });

  const body = await readJson(context.request);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || password.length < 10) {
    return json({ error: "invalid_admin_credentials" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO accounts (id, username, passwordHash, role, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 'admin', 'active', ?, ?)
  `).bind(id, username, await hashPassword(password), now, now).run();
  return json({ id, username, role: "admin", status: "active" });
}

export function onRequestGet() {
  return methodNotAllowed();
}
