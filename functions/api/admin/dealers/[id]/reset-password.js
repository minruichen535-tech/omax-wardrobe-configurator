import { resetDealerPassword } from "../../../../_lib/dealers.js";
import { requireDb } from "../../../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../../../_lib/http.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const dealer = await resetDealerPassword(requireDb(context.env), context.params.id, body.password);
    return dealer ? json({ dealer }) : json({ error: "dealer_not_found" }, { status: 404 });
  } catch (error) {
    return json({ error: error.message || "reset_password_failed" }, { status: 400 });
  }
}

export function onRequestGet() {
  return methodNotAllowed();
}
