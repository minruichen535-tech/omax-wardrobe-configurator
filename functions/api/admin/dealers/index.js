import { createDealerAccount, listDealerAccounts } from "../../../_lib/dealers.js";
import { requireDb } from "../../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../../_lib/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const url = new URL(context.request.url);
  return json({
    dealers: await listDealerAccounts(db, {
      query: url.searchParams.get("q") || "",
      status: url.searchParams.get("status") || ""
    })
  });
}

export async function onRequestPost(context) {
  try {
    const dealer = await createDealerAccount(requireDb(context.env), await readJson(context.request));
    return json({ dealer }, { status: 201 });
  } catch (error) {
    return json({
      error: error.message || "create_dealer_failed",
      fieldErrors: error.fieldErrors || {}
    }, { status: 400 });
  }
}

export function onRequestPut() {
  return methodNotAllowed();
}
