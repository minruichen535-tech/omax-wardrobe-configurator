const HANGING_RAIL_COMPONENTS = new Set(["singleRail", "doubleRail"]);
const CABINET_COMPONENTS = new Set(["cabinet", "drawer", "storageCabinet", "drawerCabinet"]);
const OCCUPIED_SURFACE_COMPONENTS = new Set([
  "woodShelf",
  "cabinet",
  "drawer",
  "drawerCabinet",
  "storageCabinet",
  "jewelryBox",
  "trouserRack"
]);
const COMPONENT_HEIGHTS = {
  woodShelf: 40,
  cabinet: 600,
  drawer: 600,
  drawerCabinet: 600,
  storageCabinet: 600,
  jewelryBox: 180,
  trouserRack: 180
};
const MIN_CLEAR_HANGING_HEIGHT = 700;
const MAX_LOW_RAIL_CLEAR_HEIGHT = 1200;
const MIN_HIGH_RAIL_CLEAR_HEIGHT = 1300;
const MIN_PRESERVED_HIGH_RAIL_CLEAR_HEIGHT = 1200;
const MAX_HIGH_RAIL_CLEAR_HEIGHT = 2100;
const LOW_RAIL_MIN_HEIGHT = 900;
const LOW_RAIL_MAX_HEIGHT = 1200;
const HIGH_RAIL_MIN_HEIGHT = 1800;
const HIGH_RAIL_MAX_HEIGHT = 2100;

export function applyLayoutConstraints(placements = [], options = {}) {
  const sourcePlacements = Array.isArray(placements) ? placements : [];
  const appliedConstraints = [];
  const skippedConstraints = [];
  if (!sourcePlacements.length) {
    return { placements: sourcePlacements, appliedConstraints, skippedConstraints };
  }

  const groupedByBay = groupPlacementsByBay(sourcePlacements);
  const normalizedPlacements = [];

  groupedByBay.forEach((items, bayKey) => {
    normalizedPlacements.push(
      ...normalizeBayLayoutConstraints(items, bayKey, options, appliedConstraints, skippedConstraints)
    );
  });

  return {
    placements: normalizedPlacements,
    appliedConstraints,
    skippedConstraints
  };
}

function normalizeBayLayoutConstraints(items, bayKey, options, appliedConstraints, skippedConstraints) {
  const bayContext = getBayDebugContext(items, bayKey);
  const rails = getHangingRails(items);
  const nonRails = items.filter((item) => !HANGING_RAIL_COMPONENTS.has(item.componentType));
  const woodShelves = items.filter((item) => item.componentType === "woodShelf");
  const woodShelfCount = woodShelves.length;
  const hasCabinetLikeComponent = items.some((item) => CABINET_COMPONENTS.has(item.componentType));

  if (hasCabinetLikeComponent) {
    return [
      ...nonRails,
      ...applyCabinetRailConstraint(rails, bayContext, appliedConstraints, skippedConstraints)
    ];
  }

  if (woodShelfCount >= 6) {
    const protectedRails = isLongHangBay(items) ? protectLongHangRails(rails) : [];
    applyDenseShelfNoRailConstraint(rails, protectedRails, bayContext, woodShelfCount, appliedConstraints);
    return [...nonRails, ...protectedRails];
  }

  if (woodShelfCount === 5) {
    return [
      ...nonRails,
      ...applyFiveShelfSingleRailConstraint(items, rails, bayContext, appliedConstraints)
    ];
  }

  if (woodShelfCount >= 1 && woodShelfCount <= 4) {
    return [
      ...nonRails,
      ...applyLightShelfTwoRailConstraint(items, rails, bayContext, appliedConstraints)
    ];
  }

  skippedConstraints.push({
    id: "LC-001",
    ...bayContext,
    reason: "noWoodShelf",
    woodShelfCount
  });
  return items;
}

function applyLightShelfTwoRailConstraint(items, rails, bayContext, appliedConstraints) {
  const normalizedRails = normalizeRailCount(rails, items, 2);
  const removedRails = getRemovedRailDebug(rails, normalizedRails, items, "LC-001A");
  appliedConstraints.push({
    id: "LC-001A",
    ...bayContext,
    woodShelfCount: countComponents(items, "woodShelf"),
    maxRailCount: 2,
    finalRailHeights: normalizedRails.map((rail) => Number(rail.heightFromFloor || 0)),
    finalRailDebug: getKeptRailDebug(normalizedRails, items),
    removedCount: Math.max(0, rails.length - normalizedRails.length),
    removedRails,
    addedCount: 0
  });
  return normalizedRails;
}

function applyFiveShelfSingleRailConstraint(items, rails, bayContext, appliedConstraints) {
  const normalizedRails = normalizeRailCount(rails, items, 1);
  const removedRails = getRemovedRailDebug(rails, normalizedRails, items, "LC-001B");
  appliedConstraints.push({
    id: "LC-001B",
    ...bayContext,
    woodShelfCount: 5,
    maxRailCount: 1,
    finalRailHeights: normalizedRails.map((rail) => Number(rail.heightFromFloor || 0)),
    finalRailDebug: getKeptRailDebug(normalizedRails, items),
    removedCount: Math.max(0, rails.length - normalizedRails.length),
    removedRails,
    addedCount: 0
  });
  return normalizedRails;
}

function applyDenseShelfNoRailConstraint(rails, protectedRails, bayContext, woodShelfCount, appliedConstraints) {
  appliedConstraints.push({
    id: "LC-001C",
    ...bayContext,
    woodShelfCount,
    targetRailCount: protectedRails.length ? 1 : 0,
    protectedReason: protectedRails.length ? "longHangZoneHighRail" : "",
    finalRailHeights: protectedRails.map((rail) => Number(rail.heightFromFloor || 0)),
    finalRailDebug: getKeptRailDebug(protectedRails, []),
    removedCount: Math.max(0, rails.length - protectedRails.length),
    removedRails: getRemovedRailDebug(rails, protectedRails, [], "LC-001C")
  });
}

function applyCabinetRailConstraint(rails, bayContext, appliedConstraints, skippedConstraints) {
  const sortedRails = sortRailsByHeightDesc(rails);
  if (!sortedRails.length) {
    skippedConstraints.push({ id: "LC-002", ...bayContext, reason: "noHangingRail" });
    return [];
  }

  const keptRail = sortedRails[0];
  const removedRails = sortedRails.slice(1).map((rail) => ({
    railHeight: Number(rail.heightFromFloor || 0),
    nearestLowerSurface: null,
    clearHeight: null,
    railClass: getRailClass(Number(rail.heightFromFloor || 0)),
    removalReason: "cabinetKeepsOnlyHighestRail"
  }));
  appliedConstraints.push({
    id: "LC-002",
    ...bayContext,
    keptHeightFromFloor: Number(keptRail.heightFromFloor || 0),
    finalRailDebug: getKeptRailDebug([keptRail], []),
    removedCount: Math.max(0, sortedRails.length - 1),
    removedRails
  });
  return [keptRail];
}

function normalizeRailCount(rails, items, maxRailCount) {
  const normalizedRails = [];
  const sortedRails = sortRailsByHeightDesc(rails);
  sortedRails.forEach((rail) => {
    if (normalizedRails.length >= maxRailCount) return;
    if (!isRailClearanceValid(items, rail)) return;
    normalizedRails.push(rail);
  });

  return sortRailsByHeightDesc(normalizedRails);
}

function isRailClearanceValid(items, rail) {
  return getRailClearanceDebug(items, Number(rail?.heightFromFloor || 0), rail).isValid;
}

function getRailClearanceDebug(items, railHeight, rail = null) {
  if (!Number.isFinite(railHeight) || railHeight <= 0) {
    return {
      railHeight,
      nearestLowerSurface: null,
      clearHeight: null,
      railClass: "invalidRail",
      isValid: false,
      removalReason: "invalidRailHeight"
    };
  }
  const lowerSurface = getNearestLowerOccupiedSurface(items, railHeight);
  const clearHeight = railHeight - lowerSurface.height;
  const railClass = getRailClass(railHeight);
  const isLowRail = railClass === "lowRail";
  const isHighRail = railClass === "highRail";
  const isShortHangUpperRail = isHighRail && isShortHangUpperRailUse(items, railHeight, lowerSurface);
  const isPreservedHighRail = isPreservedLongHangOrShoeZoneHighRail(rail);
  const preservedHighRailUse = getPreservedHighRailUse(clearHeight, lowerSurface.componentType);
  const interpretedRailUse = isShortHangUpperRail
    ? "shortHangUpper"
    : isPreservedHighRail && isHighRail
    ? preservedHighRailUse
    : isHighRail ? "longHang" : isLowRail ? "lowRail" : "";
  const minimumHighRailClearHeight = interpretedRailUse === "shortHangUpper"
    ? MIN_CLEAR_HANGING_HEIGHT
    : isPreservedHighRail
      ? MIN_PRESERVED_HIGH_RAIL_CLEAR_HEIGHT
      : MIN_HIGH_RAIL_CLEAR_HEIGHT;
  const clearanceValid = isLowRail
    ? clearHeight >= MIN_CLEAR_HANGING_HEIGHT && clearHeight <= MAX_LOW_RAIL_CLEAR_HEIGHT
    : isHighRail && (
      interpretedRailUse === "shortHangUpper"
        ? clearHeight >= MIN_CLEAR_HANGING_HEIGHT && clearHeight <= MAX_LOW_RAIL_CLEAR_HEIGHT
        : clearHeight >= minimumHighRailClearHeight && clearHeight <= MAX_HIGH_RAIL_CLEAR_HEIGHT
          && (!isPreservedHighRail || interpretedRailUse !== "")
    );
  return {
    railHeight,
    source: rail?.source || "",
    nearestLowerSurface: lowerSurface.height,
    nearestLowerSurfaceType: lowerSurface.componentType,
    clearHeight,
    railClass,
    minimumHighRailClearHeight,
    interpretedRailUse,
    clearanceValid,
    isValid: clearanceValid,
    removalReason: clearanceValid ? "" : "clearHangingHeightOutOfRange"
  };
}

function getRailClass(railHeight) {
  if (railHeight >= LOW_RAIL_MIN_HEIGHT && railHeight <= LOW_RAIL_MAX_HEIGHT) return "lowRail";
  if (railHeight >= HIGH_RAIL_MIN_HEIGHT && railHeight <= HIGH_RAIL_MAX_HEIGHT) return "highRail";
  return "unsupportedRailHeight";
}

function isShortHangUpperRailUse(items, railHeight, lowerSurface) {
  if (!getBayTemplateRoles(items).includes("shortHangZone")) return false;
  if (lowerSurface.componentType !== "woodShelf") return false;
  const hasLowerShortHangRail = items.some((item) => (
    HANGING_RAIL_COMPONENTS.has(item.componentType)
    && Number(item.heightFromFloor || 0) >= LOW_RAIL_MIN_HEIGHT
    && Number(item.heightFromFloor || 0) <= LOW_RAIL_MAX_HEIGHT
    && Number(item.heightFromFloor || 0) < railHeight
  ));
  const hasFunctionalShelfBelow = items.some((item) => (
    item.componentType === "woodShelf"
    && Number(item.heightFromFloor || 0) < railHeight
  ));
  return hasLowerShortHangRail || hasFunctionalShelfBelow;
}

function getRemovedRailDebug(rails, keptRails, items, removalContext) {
  const kept = new Set(keptRails);
  return rails
    .filter((rail) => !kept.has(rail))
    .map((rail) => {
      const railHeight = Number(rail.heightFromFloor || 0);
      const debug = getRailClearanceDebug(items, railHeight, rail);
      return {
        railHeight,
        source: debug.source,
        nearestLowerSurface: debug.nearestLowerSurface,
        nearestLowerSurfaceType: debug.nearestLowerSurfaceType,
        clearHeight: debug.clearHeight,
        railClass: debug.railClass,
        minimumHighRailClearHeight: debug.minimumHighRailClearHeight,
        interpretedRailUse: debug.interpretedRailUse,
        clearanceValid: debug.clearanceValid,
        removalReason: debug.removalReason || `${removalContext}:maxRailCount`
      };
    });
}

function getKeptRailDebug(rails, items) {
  return rails.map((rail) => {
    const railHeight = Number(rail.heightFromFloor || 0);
    const debug = getRailClearanceDebug(items, railHeight, rail);
    return {
      railHeight,
      source: debug.source,
      nearestLowerSurface: debug.nearestLowerSurface,
      nearestLowerSurfaceType: debug.nearestLowerSurfaceType,
      clearHeight: debug.clearHeight,
      interpretedRailUse: debug.interpretedRailUse,
      clearanceValid: debug.clearanceValid
    };
  });
}

function isPreservedLongHangOrShoeZoneHighRail(rail) {
  return rail?.source === "longHangOrShoeZonePreservedHighRail";
}

function getPreservedHighRailUse(clearHeight, nearestLowerSurfaceType) {
  if (clearHeight >= MIN_PRESERVED_HIGH_RAIL_CLEAR_HEIGHT) return "longHang";
  if (clearHeight >= MIN_CLEAR_HANGING_HEIGHT
    && clearHeight < MIN_PRESERVED_HIGH_RAIL_CLEAR_HEIGHT
    && nearestLowerSurfaceType === "woodShelf") {
    return "shortHangUpper";
  }
  return "";
}

function protectLongHangRails(rails) {
  return sortRailsByHeightDesc(rails)
    .filter((rail) => getRailClass(Number(rail.heightFromFloor || 0)) === "highRail")
    .slice(0, 1);
}

function isLongHangBay(items) {
  return getBayTemplateRoles(items).includes("longHangZone");
}

function getNearestLowerOccupiedSurface(items, railHeight) {
  return getOccupiedSurfaces(items)
    .filter((surface) => surface.height < railHeight)
    .sort((left, right) => right.height - left.height)[0] || {
    height: 0,
    componentType: "floor"
  };
}

function getOccupiedSurfaces(items) {
  return [
    { height: 0, componentType: "floor" },
    ...items
      .filter((item) => OCCUPIED_SURFACE_COMPONENTS.has(item.componentType))
      .map(getOccupiedSurfaceHeight)
      .filter((surface) => Number.isFinite(surface.height))
      .sort((left, right) => right.height - left.height)
  ];
}

function getOccupiedSurfaceHeight(item) {
  const baseHeight = Number(item.heightFromFloor || 0);
  if (!Number.isFinite(baseHeight)) {
    return {
      height: 0,
      componentType: item.componentType || ""
    };
  }
  return {
    height: baseHeight + Number(COMPONENT_HEIGHTS[item.componentType] || 0),
    componentType: item.componentType || ""
  };
}

function getHangingRails(items) {
  return items.filter((item) => HANGING_RAIL_COMPONENTS.has(item.componentType));
}

function sortRailsByHeightDesc(rails) {
  return [...rails].sort((left, right) => Number(right.heightFromFloor || 0) - Number(left.heightFromFloor || 0));
}

function groupPlacementsByBay(placements = []) {
  return placements.reduce((groups, placement) => {
    const key = getBayKey(placement);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(placement);
    return groups;
  }, new Map());
}

function getBayKey(placement) {
  return `${placement.wallId || "back"}:${Number(placement.bayIndex) || 0}`;
}

function getBayDebugContext(items, bayKey) {
  const firstPlacement = items.find(Boolean) || {};
  return {
    bayKey,
    bayIndex: Number(firstPlacement.bayIndex) || 0,
    templateRole: getBayTemplateRoles(items).join("|"),
    zoneTypes: unique(items.map((item) => item.zoneType).filter(Boolean)),
    bayPurposeSource: "templateRole"
  };
}

function getBayTemplateRoles(items) {
  return unique(items.map((item) => item.templateRole).filter(Boolean));
}

function unique(values) {
  return [...new Set(values)];
}

function countComponents(items, componentType) {
  return items.filter((item) => item.componentType === componentType).length;
}
