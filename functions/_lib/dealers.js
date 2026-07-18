import { hashPassword, normalizePermissions, revokeAccountSessions } from "./auth.js";

export const allSeries = [
  "japanese-closet",
  "aluminum-post-wardrobe",
  "carbon-steel-post-wardrobe-v2",
  "aluminum-base-supported",
  "wall-mounted-v2"
];

export function sanitizeDealerInput(body = {}) {
  const profile = body.profile || body;
  const permissions = body.permissions || {};
  const companyName = String(profile.companyName || "").trim();
  const brandName = String(profile.brandName || "").trim() || companyName;
  return {
    username: String(body.username || "").trim().toLowerCase(),
    password: String(body.password || ""),
    status: normalizeStatus(body.status || "active"),
    expiresAt: String(body.expiresAt || "").trim() || null,
    profile: {
      companyName,
      brandName,
      logoUrl: String(profile.logoUrl || "").trim(),
      logoReference: String(profile.logoReference || "").trim(),
      contactName: String(profile.contactName || "").trim(),
      phone: String(profile.phone || "").trim(),
      wechat: String(profile.wechat || "").trim(),
      email: String(profile.email || "").trim(),
      address: String(profile.address || "").trim(),
      subtitle: String(profile.subtitle || "").trim()
    },
    permissions: {
      allowedSeries: normalizeAllowedSeries(permissions.allowedSeries || body.allowedSeries),
      canUseAiPlanner: Boolean(permissions.canUseAiPlanner),
      canExport: permissions.canExport == null ? true : Boolean(permissions.canExport),
      canSubmitOrder: permissions.canSubmitOrder == null ? true : Boolean(permissions.canSubmitOrder)
    }
  };
}

export function validateDealerInput(input, { isCreate = false } = {}) {
  const fieldErrors = {};
  if (!input.username) fieldErrors.username = "请填写登录账号/邮箱。";
  if (isCreate && input.password.length < 8) fieldErrors.password = "初始密码至少 8 位。";
  if (!input.profile.companyName) fieldErrors.companyName = "请填写公司名称。";
  if (!input.profile.wechat) fieldErrors.wechat = "请填写微信。";
  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors
  };
}

export async function createDealerAccount(db, body) {
  const input = sanitizeDealerInput(body);
  const validation = validateDealerInput(input, { isCreate: true });
  if (!validation.valid) throw createValidationError(validation.fieldErrors);
  const now = new Date().toISOString();
  const dealerId = crypto.randomUUID();
  await db.batch([
    db.prepare(`
      INSERT INTO accounts (id, username, passwordHash, role, status, createdAt, updatedAt, expiresAt)
      VALUES (?, ?, ?, 'dealer', ?, ?, ?, ?)
    `).bind(dealerId, input.username, await hashPassword(input.password), input.status, now, now, input.expiresAt),
    profileStatement(db, dealerId, input.profile, now),
    permissionsStatement(db, dealerId, input.permissions, now)
  ]);
  return await getDealerAccount(db, dealerId);
}

export async function updateDealerAccount(db, dealerId, body) {
  const input = sanitizeDealerInput(body);
  const validation = validateDealerInput(input, { isCreate: false });
  if (!validation.valid) throw createValidationError(validation.fieldErrors);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE accounts SET username = COALESCE(NULLIF(?, ''), username), status = ?, expiresAt = ?, updatedAt = ? WHERE id = ? AND role = 'dealer'")
      .bind(input.username, input.status, input.expiresAt, now, dealerId),
    profileStatement(db, dealerId, input.profile, now),
    permissionsStatement(db, dealerId, input.permissions, now)
  ]);
  if (input.status !== "active") {
    await revokeAccountSessions(db, dealerId, input.status);
  }
  return await getDealerAccount(db, dealerId);
}

export async function resetDealerPassword(db, dealerId, password) {
  if (String(password || "").length < 8) throw new Error("invalid_password");
  await db.prepare("UPDATE accounts SET passwordHash = ? WHERE id = ? AND role = 'dealer'")
    .bind(await hashPassword(password), dealerId)
    .run();
  await db.prepare("DELETE FROM sessions WHERE accountId = ?").bind(dealerId).run();
  return await getDealerAccount(db, dealerId);
}

export async function listDealerAccounts(db, { query = "", status = "" } = {}) {
  const rows = await db.prepare(`
    SELECT accounts.*, dealer_profiles.companyName, dealer_profiles.brandName,
      dealer_profiles.logoUrl, dealer_profiles.logoReference, dealer_profiles.contactName,
      dealer_profiles.phone, dealer_profiles.wechat, dealer_profiles.email,
      dealer_profiles.address, dealer_profiles.subtitle, dealer_permissions.allowedSeries,
      dealer_permissions.canUseAiPlanner, dealer_permissions.canExport, dealer_permissions.canSubmitOrder
    FROM accounts
    LEFT JOIN dealer_profiles ON dealer_profiles.dealerId = accounts.id
    LEFT JOIN dealer_permissions ON dealer_permissions.dealerId = accounts.id
    WHERE accounts.role = 'dealer'
    ORDER BY accounts.createdAt DESC
  `).all();
  return (rows.results || [])
    .filter((row) => !status || row.status === status)
    .filter((row) => {
      if (!query) return true;
      const haystack = `${row.username} ${row.companyName} ${row.brandName} ${row.contactName}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .map(formatDealerRow);
}

export async function getDealerAccount(db, dealerId) {
  const row = await db.prepare(`
    SELECT accounts.*, dealer_profiles.companyName, dealer_profiles.brandName,
      dealer_profiles.logoUrl, dealer_profiles.logoReference, dealer_profiles.contactName,
      dealer_profiles.phone, dealer_profiles.wechat, dealer_profiles.email,
      dealer_profiles.address, dealer_profiles.subtitle, dealer_permissions.allowedSeries,
      dealer_permissions.canUseAiPlanner, dealer_permissions.canExport, dealer_permissions.canSubmitOrder
    FROM accounts
    LEFT JOIN dealer_profiles ON dealer_profiles.dealerId = accounts.id
    LEFT JOIN dealer_permissions ON dealer_permissions.dealerId = accounts.id
    WHERE accounts.id = ? AND accounts.role = 'dealer'
    LIMIT 1
  `).bind(dealerId).first();
  return row ? formatDealerRow(row) : null;
}

function formatDealerRow(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
    expiresAt: row.expiresAt || "",
    profile: {
      companyName: row.companyName || "",
      brandName: row.brandName || "",
      logoUrl: row.logoUrl || "",
      logoReference: row.logoReference || "",
      contactName: row.contactName || "",
      phone: row.phone || "",
      wechat: row.wechat || "",
      email: row.email || "",
      address: row.address || "",
      subtitle: row.subtitle || ""
    },
    permissions: normalizePermissions(row)
  };
}

function profileStatement(db, dealerId, profile, now) {
  return db.prepare(`
    INSERT INTO dealer_profiles (
      dealerId, companyName, brandName, logoUrl, logoReference, contactName,
      phone, wechat, email, address, subtitle, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dealerId) DO UPDATE SET
      companyName = excluded.companyName,
      brandName = excluded.brandName,
      logoUrl = excluded.logoUrl,
      logoReference = excluded.logoReference,
      contactName = excluded.contactName,
      phone = excluded.phone,
      wechat = excluded.wechat,
      email = excluded.email,
      address = excluded.address,
      subtitle = excluded.subtitle,
      updatedAt = excluded.updatedAt
  `).bind(
    dealerId,
    profile.companyName,
    profile.brandName,
    profile.logoUrl,
    profile.logoReference,
    profile.contactName,
    profile.phone,
    profile.wechat,
    profile.email,
    profile.address,
    profile.subtitle,
    now
  );
}

function permissionsStatement(db, dealerId, permissions, now) {
  return db.prepare(`
    INSERT INTO dealer_permissions (dealerId, allowedSeries, canUseAiPlanner, canExport, canSubmitOrder, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(dealerId) DO UPDATE SET
      allowedSeries = excluded.allowedSeries,
      canUseAiPlanner = excluded.canUseAiPlanner,
      canExport = excluded.canExport,
      canSubmitOrder = excluded.canSubmitOrder,
      updatedAt = excluded.updatedAt
  `).bind(
    dealerId,
    JSON.stringify(permissions.allowedSeries),
    permissions.canUseAiPlanner ? 1 : 0,
    permissions.canExport ? 1 : 0,
    permissions.canSubmitOrder ? 1 : 0,
    now
  );
}

function normalizeStatus(value) {
  return ["active", "disabled", "archived"].includes(value) ? value : "active";
}

function normalizeAllowedSeries(value) {
  const selected = Array.isArray(value) ? value.map(String) : allSeries;
  const normalized = selected.filter((seriesId) => allSeries.includes(seriesId));
  return normalized.length ? normalized : allSeries;
}

function createValidationError(fieldErrors) {
  const error = new Error("validation_failed");
  error.fieldErrors = fieldErrors;
  return error;
}
