import {
  dealerProfileSnapshot,
  getDealerPermissions,
  getDealerProfile,
  getSessionAccount,
  requireDb
} from "../../_lib/auth.js";
import { json, methodNotAllowed, readJson } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const account = await getDealerAccount(context);
  if (account instanceof Response) return account;
  const db = requireDb(context.env);
  const profile = await getDealerProfile(db, account.id);
  return json({
    dealerId: account.id,
    profile: {
      ...dealerProfileSnapshot(profile),
      logoDataUrl: profile?.logoUrl || ""
    },
    permissions: await getDealerPermissions(db, account.id)
  });
}

export async function onRequestPut(context) {
  const account = await getDealerAccount(context);
  if (account instanceof Response) return account;
  const body = await readJson(context.request);
  const profile = body.profile || body;
  const now = new Date().toISOString();
  await requireDb(context.env).prepare(`
    INSERT INTO dealer_profiles (
      dealerId, companyName, brandName, logoUrl, logoReference, contactName,
      phone, wechat, email, address, subtitle, updatedAt
    ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dealerId) DO UPDATE SET
      companyName = excluded.companyName,
      brandName = excluded.brandName,
      contactName = excluded.contactName,
      phone = excluded.phone,
      wechat = excluded.wechat,
      email = excluded.email,
      address = excluded.address,
      subtitle = excluded.subtitle,
      updatedAt = excluded.updatedAt
  `).bind(
    account.id,
    String(profile.companyName || "").trim(),
    String(profile.brandName || "").trim(),
    String(profile.logoDataUrl || profile.logoUrl || "").trim(),
    String(profile.contactName || "").trim(),
    String(profile.phone || "").trim(),
    String(profile.wechat || "").trim(),
    String(profile.email || "").trim(),
    String(profile.address || "").trim(),
    String(profile.subtitle || "").trim(),
    now
  ).run();
  const updatedProfile = await getDealerProfile(requireDb(context.env), account.id);
  return json({ profile: { ...dealerProfileSnapshot(updatedProfile), logoDataUrl: updatedProfile?.logoUrl || "" } });
}

export function onRequestPost() {
  return methodNotAllowed();
}

async function getDealerAccount(context) {
  const account = await getSessionAccount(context.env, context.request);
  if (!account || account.blockedReason || account.role !== "dealer") {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  return account;
}
