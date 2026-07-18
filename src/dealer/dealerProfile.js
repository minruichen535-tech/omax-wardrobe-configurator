export const dealerProfileStorageKey = "omaxDealerProfileV1";
const dealerProfileChangeEvent = "omaxDealerProfileChange";

const textFields = [
  "companyName",
  "brandName",
  "contactName",
  "phone",
  "wechat",
  "email",
  "address",
  "subtitle"
];

function normalizeDealerProfile(profile = {}) {
  const normalized = {};
  textFields.forEach((field) => {
    normalized[field] = String(profile[field] || "").trim();
  });
  normalized.logoDataUrl = String(profile.logoDataUrl || profile.logoUrl || "");
  normalized.updatedAt = profile.updatedAt || "";
  return normalized;
}

export function getDealerProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(dealerProfileStorageKey) || "{}");
    return normalizeDealerProfile(parsed);
  } catch (error) {
    console.warn("[dealer profile] invalid payload", error);
    return normalizeDealerProfile();
  }
}

export function hasDealerProfile(profile = getDealerProfile()) {
  return Boolean(
    profile.companyName
    && profile.brandName
    && profile.contactName
    && profile.phone
  );
}

export function saveDealerProfile(profile) {
  const normalized = normalizeDealerProfile({
    ...profile,
    updatedAt: new Date().toISOString()
  });
  localStorage.setItem(dealerProfileStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(dealerProfileChangeEvent, { detail: normalized }));
  return normalized;
}

export function clearDealerProfile() {
  localStorage.removeItem(dealerProfileStorageKey);
  const emptyProfile = normalizeDealerProfile();
  window.dispatchEvent(new CustomEvent(dealerProfileChangeEvent, { detail: emptyProfile }));
  return emptyProfile;
}

export function subscribeDealerProfileChange(callback) {
  const handleStorage = (event) => {
    if (event.key === dealerProfileStorageKey) callback(getDealerProfile());
  };
  const handleProfileChange = (event) => {
    callback(normalizeDealerProfile(event.detail));
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(dealerProfileChangeEvent, handleProfileChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(dealerProfileChangeEvent, handleProfileChange);
  };
}

export function getDealerDisplayName(profile = getDealerProfile()) {
  return profile.brandName || profile.companyName || "";
}

export function getDealerInitials(profile = getDealerProfile()) {
  const displayName = getDealerDisplayName(profile);
  if (!displayName) return "商";
  const latin = displayName.match(/[A-Za-z0-9]/g);
  if (latin?.length) return latin.slice(0, 2).join("").toUpperCase();
  return Array.from(displayName).slice(0, 2).join("");
}

export function getDealerProfileSnapshot(profile = getDealerProfile()) {
  const normalized = normalizeDealerProfile(profile);
  return {
    companyName: normalized.companyName,
    brandName: normalized.brandName,
    contactName: normalized.contactName,
    phone: normalized.phone,
    wechat: normalized.wechat,
    email: normalized.email,
    address: normalized.address,
    subtitle: normalized.subtitle,
    updatedAt: normalized.updatedAt
  };
}

export async function loadDealerProfile() {
  const response = await fetch("/api/dealer/profile", {
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) {
    const error = new Error("dealer_profile_unavailable");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return {
    profile: normalizeDealerProfile(payload.profile),
    permissions: payload.permissions || null,
    dealerId: payload.dealerId || ""
  };
}

export async function saveDealerProfileToServer(profile) {
  const response = await fetch("/api/dealer/profile", {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profile: {
        ...getDealerProfileSnapshot(profile),
        logoDataUrl: String(profile.logoDataUrl || "")
      }
    })
  });
  if (!response.ok) {
    const error = new Error("dealer_profile_save_failed");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const normalized = normalizeDealerProfile(payload.profile);
  localStorage.setItem(dealerProfileStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(dealerProfileChangeEvent, { detail: normalized }));
  return normalized;
}
