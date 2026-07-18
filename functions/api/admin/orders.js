import { requireDb } from "../../_lib/auth.js";
import { json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const rows = await db.prepare(`
    SELECT dealer_orders.*, accounts.username,
      dealer_profiles.companyName, dealer_profiles.brandName
    FROM dealer_orders
    JOIN accounts ON accounts.id = dealer_orders.dealerId
    LEFT JOIN dealer_profiles ON dealer_profiles.dealerId = dealer_orders.dealerId
    ORDER BY dealer_orders.createdAt DESC
    LIMIT 200
  `).all();
  return json({
    orders: (rows.results || []).map((row) => ({
      id: row.id,
      dealerId: row.dealerId,
      dealerUsername: row.username,
      dealerName: row.brandName || row.companyName || row.username,
      status: row.status,
      planId: row.planId,
      planName: row.planName,
      seriesId: row.seriesId,
      customerReference: row.customerReference,
      dealerProfile: parseJson(row.dealerProfileSnapshot),
      payload: parseJson(row.payload),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  });
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
