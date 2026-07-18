import { getDealerOrderDetail, updateDealerOrderWorkflow } from "../../../_lib/dealerOrders.js";
import { requireDb } from "../../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../../_lib/http.js";

export async function onRequestGet(context) {
  const detail = await getDealerOrderDetail(requireDb(context.env), context.params.id);
  return detail ? json(detail) : json({ error: "dealer_order_not_found" }, { status: 404 });
}

export async function onRequestPatch(context) {
  try {
    const detail = await updateDealerOrderWorkflow(requireDb(context.env), context.params.id, await readJson(context.request));
    return detail ? json(detail) : json({ error: "dealer_order_not_found" }, { status: 404 });
  } catch (error) {
    return json({ error: error.message || "dealer_order_update_failed" }, { status: error.status || 400 });
  }
}

export function onRequestPost() {
  return methodNotAllowed();
}
