const sessionCookieName = "omax_session";
const sessionMaxAgeSeconds = 60 * 60 * 12;
const passwordIterations = 100000;

const encoder = new TextEncoder();

export { sessionCookieName };

export function getDb(env) {
  return env.DB || env.OMAX_DB || null;
}

export function requireDb(env) {
  const db = getDb(env);
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}

export function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).reduce((found, part) => {
    if (found) return found;
    const [key, ...valueParts] = part.split("=");
    return key === name ? decodeURIComponent(valueParts.join("=")) : "";
  }, "");
}

export function createClearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function hashPassword(password, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: passwordIterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2_sha256$${passwordIterations}$${salt}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, passwordHash) {
  const [scheme, iterations, salt, digest] = String(passwordHash || "").split("$");
  if (scheme !== "pbkdf2_sha256" || !salt || !digest) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: Number(iterations), hash: "SHA-256" },
    key,
    256
  );
  return timingSafeEqual(toBase64Url(new Uint8Array(bits)), digest);
}

export async function createSession(db, account, request) {
  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds * 1000).toISOString();
  await db.prepare(`
    INSERT INTO sessions (id, accountId, tokenHash, createdAt, expiresAt, userAgent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    account.id,
    tokenHash,
    now.toISOString(),
    expiresAt,
    request.headers.get("user-agent") || ""
  ).run();
  await db.prepare("UPDATE accounts SET lastLoginAt = ?, updatedAt = ? WHERE id = ?")
    .bind(now.toISOString(), now.toISOString(), account.id)
    .run();
  const secureFlag = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secureFlag}`;
}

export async function destroySession(db, request) {
  const token = getCookie(request, sessionCookieName);
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE tokenHash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export async function revokeAccountSessions(db, accountId, reason) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT OR REPLACE INTO revoked_sessions (tokenHash, accountId, reason, createdAt, expiresAt)
      SELECT tokenHash, accountId, ?, ?, expiresAt
      FROM sessions
      WHERE accountId = ?
    `).bind(reason, now, accountId),
    db.prepare("DELETE FROM sessions WHERE accountId = ?").bind(accountId)
  ]);
}

export async function getSessionAccount(env, request) {
  const db = getDb(env);
  if (!db) return null;
  const token = getCookie(request, sessionCookieName);
  if (!token) return null;
  const now = new Date().toISOString();
  const tokenHash = await sha256Hex(token);
  const row = await db.prepare(`
    SELECT accounts.*, sessions.id AS sessionId, sessions.expiresAt AS sessionExpiresAt
    FROM sessions
    JOIN accounts ON accounts.id = sessions.accountId
    WHERE sessions.tokenHash = ? AND sessions.expiresAt > ?
    LIMIT 1
  `).bind(tokenHash, now).first();
  if (!row) {
    const revoked = await db.prepare(`
      SELECT revoked_sessions.*, accounts.username, accounts.role, accounts.status, accounts.expiresAt AS accountExpiresAt
      FROM revoked_sessions
      LEFT JOIN accounts ON accounts.id = revoked_sessions.accountId
      WHERE revoked_sessions.tokenHash = ? AND revoked_sessions.expiresAt > ?
      LIMIT 1
    `).bind(tokenHash, now).first();
    if (!revoked) return null;
    return {
      id: revoked.accountId,
      username: revoked.username || "",
      role: revoked.role || "dealer",
      status: revoked.reason,
      expiresAt: revoked.accountExpiresAt || "",
      blockedReason: revoked.reason,
      revokedSession: true
    };
  }
  if (!isAccountActive(row, now)) return { ...row, blockedReason: getAccountBlockedReason(row, now) };
  return row;
}

export function isAccountActive(account, now = new Date().toISOString()) {
  return account?.status === "active" && (!account.expiresAt || account.expiresAt > now);
}

export function getAccountBlockedReason(account, now = new Date().toISOString()) {
  if (!account) return "unauthenticated";
  if (account.status === "disabled") return "disabled";
  if (account.status === "archived") return "archived";
  if (account.expiresAt && account.expiresAt <= now) return "expired";
  return "";
}

export function blockedMessage(reason) {
  if (reason === "disabled") return "该经销商账号已停用，请联系奥美斯。";
  if (reason === "archived") return "该经销商账号已注销，请联系奥美斯。";
  if (reason === "expired") return "该经销商账号授权已到期，请联系奥美斯。";
  return "请先登录经销商账号。";
}

export function dealerAuthErrorCode(reason) {
  if (reason === "disabled") return "dealer_disabled";
  if (reason === "archived") return "dealer_archived";
  if (reason === "expired") return "dealer_expired";
  return "dealer_required";
}

export async function getDealerProfile(db, dealerId) {
  return await db.prepare("SELECT * FROM dealer_profiles WHERE dealerId = ? LIMIT 1")
    .bind(dealerId)
    .first();
}

export async function getDealerPermissions(db, dealerId) {
  const row = await db.prepare("SELECT * FROM dealer_permissions WHERE dealerId = ? LIMIT 1")
    .bind(dealerId)
    .first();
  return normalizePermissions(row);
}

export function normalizePermissions(row = {}) {
  return {
    allowedSeries: parseJsonArray(row?.allowedSeries, ["japanese-closet", "aluminum-post-wardrobe", "carbon-steel-post-wardrobe-v2", "aluminum-base-supported", "wall-mounted-v2"]),
    canUseAiPlanner: Boolean(row?.canUseAiPlanner),
    canExport: row?.canExport == null ? true : Boolean(row.canExport),
    canSubmitOrder: row?.canSubmitOrder == null ? true : Boolean(row.canSubmitOrder)
  };
}

export function parseJsonArray(value, fallback = []) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export function dealerProfileSnapshot(profile = {}) {
  return {
    companyName: profile.companyName || "",
    brandName: profile.brandName || "",
    contactName: profile.contactName || "",
    phone: profile.phone || "",
    wechat: profile.wechat || "",
    email: profile.email || "",
    address: profile.address || "",
    subtitle: profile.subtitle || ""
  };
}

export function normalizeSeriesId(seriesId) {
  return seriesId === "wall-mounted" ? "wall-mounted-v2" : seriesId;
}

async function sha256Hex(value) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}
