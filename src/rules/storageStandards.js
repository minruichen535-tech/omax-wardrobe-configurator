import { getClosetRules } from "./demandRules.js?v=component-upgrade-rules-20260627-01";

export function getStorageStandard(storageType) {
  const row = getClosetRules().storageByType.get(storageType);
  if (!row) return null;
  return {
    minHeight: toNumber(row.minHeight),
    idealHeight: toNumber(row.idealHeight),
    recommendedHeight: toNumber(row.recommendedHeight)
  };
}

export function getRecommendedInstallationHeight(storageType, roomHeight = Infinity) {
  const standard = getStorageStandard(storageType);
  if (!standard) return null;
  return Math.max(standard.minHeight, Math.min(standard.recommendedHeight, Number(roomHeight) || Infinity));
}

export function getZoneInstallationHeight(zoneType, roomHeight = Infinity) {
  const zone = getClosetRules().functionZoneByType.get(zoneType);
  return zone ? getRecommendedInstallationHeight(zone.storageType, roomHeight) : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
