import { createClearSessionCookie, destroySession, requireDb } from "../../_lib/auth.js";
import { json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequestPost(context) {
  await destroySession(requireDb(context.env), context.request);
  return json({ ok: true }, { headers: { "set-cookie": createClearSessionCookie() } });
}

export function onRequestGet() {
  return methodNotAllowed();
}
