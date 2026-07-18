const HANGING_RAIL_COMPONENTS = new Set(["singleRail", "doubleRail"]);

const PROTECTED_REASONS = {
  longHangZone: "lastRemainingLongHangBay",
  shortHangZone: "lastRemainingShortHangBay",
  shoeShelfZone: "lastRemainingShoeStorageBay"
};

const PROFILE_RANKS = {
  shortHangCabinet: 0,
  shortHangShelf: 1,
  storageBay: 2,
  bagStorageBay: 3,
  otherReplaceable: 4,
  protected: 99
};

export function rankJapaneseUpgradeBays({
  bays = [],
  skeleton = [],
  placements = [],
  componentType = "",
  fallbackBayCount = 0,
  allowProtectedFallback = false
} = {}) {
  const normalizedSkeleton = normalizeSkeleton(skeleton, fallbackBayCount);
  const bayByIndex = new Map(normalizedSkeleton.map((entry) => [Number(entry.bayIndex), entry]));
  const protectedBayReasons = getProtectedJapaneseBayReasons(normalizedSkeleton, placements);
  const rows = bays.map((bay, originalIndex) => {
    const bayIndex = getBayIndex(bay);
    const entry = typeof bay === "object" && bay !== null
      ? { ...bayByIndex.get(bayIndex), ...bay }
      : bayByIndex.get(bayIndex) || { bayIndex };
    const bayPlacements = placements.filter((item) => (
      Number(item.bayIndex) === bayIndex
      && item.componentType
      && (!entry.wallId || !item.wallId || item.wallId === entry.wallId)
    ));
    const protectedReason = protectedBayReasons.get(bayIndex) || "";
    const profile = classifyJapaneseBayProfile(entry, bayPlacements, componentType);
    return {
      bay,
      bayIndex,
      originalIndex,
      profile,
      protectedReason,
      protected: Boolean(protectedReason),
      rank: protectedReason ? PROFILE_RANKS.protected : PROFILE_RANKS[profile] ?? PROFILE_RANKS.otherReplaceable
    };
  });
  const unprotected = rows.filter((row) => !row.protected);
  const candidates = unprotected.length || !allowProtectedFallback
    ? unprotected
    : rows;
  return candidates
    .sort((left, right) => (
      left.rank - right.rank
      || left.originalIndex - right.originalIndex
    ))
    .map((row) => row.bay);
}

export function classifyJapaneseBays({ skeleton = [], placements = [], fallbackBayCount = 0 } = {}) {
  const normalizedSkeleton = normalizeSkeleton(skeleton, fallbackBayCount);
  const protectedBayReasons = getProtectedJapaneseBayReasons(normalizedSkeleton, placements);
  return normalizedSkeleton.map((entry) => {
    const bayPlacements = placements.filter((item) => (
      Number(item.bayIndex) === Number(entry.bayIndex)
      && item.componentType
      && (!entry.wallId || !item.wallId || item.wallId === entry.wallId)
    ));
    const protectedReason = protectedBayReasons.get(Number(entry.bayIndex)) || "";
    const profile = classifyJapaneseBayProfile(entry, bayPlacements);
    return {
      bayIndex: Number(entry.bayIndex),
      wallId: entry.wallId || "back",
      role: entry.role || "",
      sourceRole: entry.sourceRole || "",
      profile,
      protected: Boolean(protectedReason),
      protectedReason
    };
  });
}

function normalizeSkeleton(skeleton = [], fallbackBayCount = 0) {
  if (Array.isArray(skeleton) && skeleton.length) {
    return skeleton.map((entry, index) => ({
      bayIndex: Number(entry.bayIndex ?? index),
      wallId: entry.wallId || "back",
      role: entry.role || entry.templateRole || entry.templateZone || "",
      sourceRole: entry.sourceRole || ""
    }));
  }
  return Array.from({ length: Math.max(0, Number(fallbackBayCount) || 0) }, (_, bayIndex) => ({
    bayIndex,
    wallId: "back",
    role: "",
    sourceRole: ""
  }));
}

function getProtectedJapaneseBayReasons(skeleton = [], placements = []) {
  const protectedReasons = new Map();
  ["longHangZone", "shortHangZone", "shoeShelfZone"].forEach((role) => {
    const bays = skeleton.filter((entry) => baySupportsProtectedRole(entry, placements, role));
    if (bays.length === 1) {
      protectedReasons.set(Number(bays[0].bayIndex), PROTECTED_REASONS[role]);
    }
  });
  return protectedReasons;
}

function baySupportsProtectedRole(entry, placements, role) {
  const bayIndex = Number(entry.bayIndex);
  const entryRole = entry.role || "";
  if (role === "shoeShelfZone") {
    return entryRole === "shoeShelfZone"
      || placements.some((item) => (
        Number(item.bayIndex) === bayIndex
        && item.componentType === "woodShelf"
        && (item.zoneType === "shoeZone" || item.templateRole === "shoeShelfZone")
      ));
  }
  return entryRole === role;
}

function classifyJapaneseBayProfile(entry = {}, bayPlacements = [], componentType = "") {
  const role = entry.role || "";
  const hasCabinet = hasComponent(bayPlacements, "cabinet");
  const hasShelf = bayPlacements.some((item) => item.componentType === "woodShelf" && item.zoneType !== "shoeZone");
  const hasBagStorage = role === "shelfZone" || bayPlacements.some((item) => (
    item.componentType === "woodShelf"
    && Number(item.heightFromFloor || 0) >= 900
    && Number(item.heightFromFloor || 0) <= 1600
  ));
  const hasHighRail = bayPlacements.some((item) => (
    HANGING_RAIL_COMPONENTS.has(item.componentType)
    && Number(item.heightFromFloor || 0) >= 1900
  ));
  if (role === "shortHangZone" && (hasCabinet || componentType === "cabinet") && hasHighRail) return "shortHangCabinet";
  if (role === "shortHangZone" && (hasShelf || componentType === "woodShelf") && hasHighRail) return "shortHangShelf";
  if (["storageAccessoryZone", "jewelryZone"].includes(role)) return "storageBay";
  if (hasBagStorage) return "bagStorageBay";
  return "otherReplaceable";
}

function hasComponent(placements, componentType) {
  return placements.some((item) => item.componentType === componentType);
}

function getBayIndex(bay) {
  return Number(typeof bay === "object" && bay !== null
    ? bay.bayIndex ?? bay.wallBayIndex ?? 0
    : bay) || 0;
}
