import {
  dealerProfileSnapshot,
  getDealerPermissions,
  getDealerProfile,
  getSessionAccount,
  normalizeSeriesId,
  requireDb
} from "../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../_lib/http.js";

export async function onRequestPost(context) {
  const account = await getSessionAccount(context.env, context.request);
  if (!account || account.blockedReason || account.role !== "dealer") {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const db = requireDb(context.env);
  const body = await readJson(context.request);
  const seriesId = normalizeSeriesId(String(body.seriesId || ""));
  const permissions = await getDealerPermissions(db, account.id);
  if (!permissions.canSubmitOrder) return json({ error: "submit_disabled" }, { status: 403 });
  if (!permissions.allowedSeries.includes(seriesId)) return json({ error: "series_not_allowed" }, { status: 403 });

  const profile = dealerProfileSnapshot(await getDealerProfile(db, account.id));
  const now = new Date().toISOString();
  const order = {
    ...body,
    dealerId: account.id,
    dealerProfile: profile,
    status: "submitted",
    createdAt: body.createdAt || now,
    updatedAt: now
  };
  const id = body.id || `dealer-order-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await db.prepare(`
    INSERT INTO dealer_orders (
      id, dealerId, status, planId, planName, seriesId, customerReference,
      dealerProfileSnapshot, payload, createdAt, updatedAt
    ) VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    account.id,
    String(body.planId || ""),
    String(body.planName || ""),
    seriesId,
    String(body.customerReference || ""),
    JSON.stringify(profile),
    JSON.stringify(order),
    now,
    now
  ).run();
  return json({ order: { id, dealerId: account.id, status: "submitted", dealerProfile: profile } }, { status: 201 });
}

export function onRequestGet() {
  return methodNotAllowed();
}
