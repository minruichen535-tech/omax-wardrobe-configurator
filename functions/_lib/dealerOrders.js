export const orderStatuses = new Set([
  "submitted",
  "reviewing",
  "confirmed",
  "picking",
  "production",
  "packed",
  "completed",
  "cancelled"
]);

export async function getDealerOrderDetail(db, orderId) {
  const row = await db.prepare(`
    SELECT dealer_orders.*, accounts.username,
      dealer_profiles.companyName, dealer_profiles.brandName, dealer_profiles.contactName,
      dealer_profiles.phone, dealer_profiles.wechat, dealer_profiles.email, dealer_profiles.address
    FROM dealer_orders
    JOIN accounts ON accounts.id = dealer_orders.dealerId
    LEFT JOIN dealer_profiles ON dealer_profiles.dealerId = dealer_orders.dealerId
    WHERE dealer_orders.id = ?
    LIMIT 1
  `).bind(orderId).first();
  return row ? formatDealerOrderDetail(row) : null;
}

export async function updateDealerOrderWorkflow(db, orderId, body = {}) {
  const current = await getDealerOrderDetail(db, orderId);
  if (!current) return null;
  const nextStatus = body.status == null ? current.order.status : String(body.status || "");
  if (!orderStatuses.has(nextStatus)) {
    const error = new Error("invalid_order_status");
    error.status = 400;
    throw error;
  }
  const nextPicking = body.picking == null ? current.picking : normalizePickingState(body.picking);
  const nextAdminNotes = body.adminNotes == null ? current.adminNotes : String(body.adminNotes || "");
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE dealer_orders
    SET status = ?, adminNotes = ?, pickingJson = ?, updatedAt = ?
    WHERE id = ?
  `).bind(nextStatus, nextAdminNotes, JSON.stringify(nextPicking), now, orderId).run();
  return await getDealerOrderDetail(db, orderId);
}

function formatDealerOrderDetail(row) {
  const rawPayload = parseJson(row.payload, {});
  const dealerProfileSnapshot = parseJson(row.dealerProfileSnapshot, {});
  const picking = normalizePickingState(parseJson(row.pickingJson, {}));
  const bom = asArray(rawPayload.bom);
  const placements = asArray(rawPayload.placements);
  const walls = rawPayload.walls || {};
  const room = rawPayload.room || rawPayload.roomConfig || {};
  const designConfig = {
    room,
    layout: rawPayload.layout || "",
    walls,
    placements,
    frameColor: rawPayload.frameColor || rawPayload.color || "",
    woodColor: rawPayload.woodColor || "",
    led: rawPayload.led,
    postHeight: rawPayload.postHeight,
    shelfDepth: rawPayload.shelfDepth,
    connectionMode: rawPayload.connectionMode,
    postStyle: rawPayload.postStyle
  };
  return {
    order: {
      id: row.id,
      dealerId: row.dealerId,
      status: row.status,
      seriesId: row.seriesId || rawPayload.seriesId || "",
      planId: row.planId || rawPayload.planId || "",
      planName: row.planName || rawPayload.planName || "",
      projectName: rawPayload.projectName || row.planName || "",
      customerReference: row.customerReference || rawPayload.customerReference || "",
      customerName: rawPayload.customerName || rawPayload.customerReference || "",
      customerPhone: rawPayload.customerPhone || "",
      customerAddress: rawPayload.customerAddress || "",
      notes: rawPayload.notes || rawPayload.dealerNotes || "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    },
    dealerProfile: {
      companyName: row.companyName || dealerProfileSnapshot.companyName || "",
      brandName: row.brandName || dealerProfileSnapshot.brandName || "",
      contactName: row.contactName || dealerProfileSnapshot.contactName || "",
      phone: row.phone || dealerProfileSnapshot.phone || "",
      wechat: row.wechat || dealerProfileSnapshot.wechat || "",
      email: row.email || dealerProfileSnapshot.email || "",
      address: row.address || dealerProfileSnapshot.address || ""
    },
    roomConfig: room,
    designConfig,
    placements,
    wallPlans: walls,
    bom,
    cuttingList: asArray(rawPayload.cuttingList),
    displayRules: rawPayload.displayRules || null,
    pricingSnapshot: rawPayload.pricingSnapshot || null,
    previewSnapshot: rawPayload.previewSnapshot || null,
    dealerProfileSnapshot,
    picking,
    adminNotes: row.adminNotes || "",
    rawPayload
  };
}

export function normalizePickingState(value = {}) {
  const rows = value.rows && typeof value.rows === "object" ? value.rows : {};
  return {
    rows: Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, {
      pickedAt: String(row?.pickedAt || ""),
      verifiedAt: String(row?.verifiedAt || ""),
      packedAt: String(row?.packedAt || ""),
      updatedBy: String(row?.updatedBy || "")
    }]))
  };
}

function parseJson(value, fallback) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "null") : value;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
