import { getDealerAccount, updateDealerAccount } from "../../../_lib/dealers.js";
import { requireDb } from "../../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../../_lib/http.js";

export async function onRequestGet(context) {
  const dealer = await getDealerAccount(requireDb(context.env), context.params.id);
  return dealer ? json({ dealer }) : json({ error: "dealer_not_found" }, { status: 404 });
}

export async function onRequestPatch(context) {
  try {
    const dealer = await updateDealerAccount(requireDb(context.env), context.params.id, await readJson(context.request));
    return dealer ? json({ dealer }) : json({ error: "dealer_not_found" }, { status: 404 });
  } catch (error) {
    return json({
      error: error.message || "update_dealer_failed",
      fieldErrors: error.fieldErrors || {}
    }, { status: 400 });
  }
}

export function onRequestPost() {
  return methodNotAllowed();
}
