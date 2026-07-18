const DRAWER_COMPONENTS = new Set(["drawerSingle", "drawerDouble"]);
const HANGING_RAIL_COMPONENTS = new Set(["singleRail", "doubleRail"]);
const DRAWER_ALLOWED_TEMPLATE_ROLES = new Set([
  "storageAccessoryZone",
  "jewelryZone",
  "shortHangZone",
  "shelfZone"
]);

const DRAWER_HEIGHTS = {
  drawerSingle: 180,
  drawerDouble: 360
};

const DRAWER_ERGONOMIC_ZONE = {
  functionalZone: "drawerErgonomicStorage",
  preferredCenterMin: 1000,
  preferredCenterMax: 1150,
  acceptableCenterMin: 900,
  acceptableCenterMax: 1200,
  preferredCenters: [1050, 1000, 1100, 1150],
  acceptableCenters: [950, 900, 1200]
};

export function selectJapaneseDrawerFunctionalZone({
  componentType,
  bayPlacements = [],
  templateRole = ""
} = {}) {
  if (!DRAWER_COMPONENTS.has(componentType)) {
    return drawerZoneRejected("unsupportedComponent");
  }
  if (!canPlaceJapaneseDrawerInBay({ bayPlacements, templateRole })) {
    return drawerZoneRejected("bayNotEligible");
  }
  const componentHeight = getJapaneseDrawerComponentHeight(componentType);
  const centerCandidates = [
    ...DRAWER_ERGONOMIC_ZONE.preferredCenters,
    ...DRAWER_ERGONOMIC_ZONE.acceptableCenters
  ];
  for (const centerHeight of centerCandidates) {
    const heightFromFloor = getJapaneseDrawerPlacementHeight(componentType, centerHeight);
    const replacementPlacements = getJapaneseDrawerReplacementPlacements({
      bayPlacements,
      heightFromFloor,
      componentHeight
    });
    if (hasBlockingJapaneseDrawerPlacement({
      bayPlacements,
      heightFromFloor,
      componentHeight,
      replacementPlacements
    })) {
      continue;
    }
    return {
      accepted: true,
      functionalZone: DRAWER_ERGONOMIC_ZONE.functionalZone,
      centerHeight,
      heightFromFloor,
      componentHeight,
      replacementPlacements,
      reason: centerHeight >= DRAWER_ERGONOMIC_ZONE.preferredCenterMin
        && centerHeight <= DRAWER_ERGONOMIC_ZONE.preferredCenterMax
        ? "preferredErgonomicCenter"
        : "acceptableErgonomicCenter"
    };
  }
  return drawerZoneRejected("noErgonomicSlot");
}

export function canPlaceJapaneseDrawerInBay({ bayPlacements = [], templateRole = "" } = {}) {
  if (!DRAWER_ALLOWED_TEMPLATE_ROLES.has(templateRole)) return false;
  if (bayPlacements.some((item) => DRAWER_COMPONENTS.has(item.componentType))) return false;
  if (bayPlacements.some((item) => ["cabinet", "trouserRack", "jewelryBox"].includes(item.componentType))) return false;
  if (bayPlacements.some((item) => isLowShoeStoragePlacement(item))) return false;
  if (isJapaneseActiveLongHangBay(bayPlacements, templateRole)) return false;
  return true;
}

export function getJapaneseDrawerPlacementHeight(componentType, centerHeight = 1050) {
  const componentHeight = getJapaneseDrawerComponentHeight(componentType);
  return Math.round(Number(centerHeight) - componentHeight / 2);
}

export function isJapaneseActiveLongHangBay(bayPlacements = [], templateRole = "") {
  if (templateRole !== "longHangZone") return false;
  const highRail = bayPlacements
    .filter((item) => HANGING_RAIL_COMPONENTS.has(item.componentType))
    .map((item) => Number(item.heightFromFloor || 0))
    .filter((height) => height >= 1900)
    .sort((left, right) => right - left)[0];
  if (!highRail) return false;
  const lowerOccupiedSurface = bayPlacements
    .filter((item) => Number(item.heightFromFloor || 0) !== highRail)
    .filter((item) => Number(item.heightFromFloor || 0) < highRail)
    .map((item) => getPlacementTop(item))
    .filter((height) => Number.isFinite(height))
    .sort((left, right) => right - left)[0];
  const freeSpaceBelow = highRail - Number(lowerOccupiedSurface || 0);
  return freeSpaceBelow > 1200;
}

function getJapaneseDrawerReplacementPlacements({ bayPlacements = [], heightFromFloor = 0, componentHeight = 0 } = {}) {
  const drawerInterval = [heightFromFloor, heightFromFloor + componentHeight];
  return bayPlacements.filter((item) => {
    if (HANGING_RAIL_COMPONENTS.has(item.componentType)) {
      const railHeight = Number(item.heightFromFloor || 0);
      return railHeight >= 900 && railHeight <= 1200 && intervalsOverlap(drawerInterval, getPlacementInterval(item));
    }
    if (item.componentType === "woodShelf" && !isLowShoeStoragePlacement(item)) {
      return isMiddleStorageShelf(item) && intervalsOverlap(drawerInterval, getPlacementInterval(item));
    }
    return false;
  });
}

function hasBlockingJapaneseDrawerPlacement({
  bayPlacements = [],
  heightFromFloor = 0,
  componentHeight = 0,
  replacementPlacements = []
} = {}) {
  const replacementSet = new Set(replacementPlacements);
  const drawerInterval = [heightFromFloor, heightFromFloor + componentHeight];
  return bayPlacements.some((item) => {
    if (replacementSet.has(item)) return false;
    if (isLowShoeStoragePlacement(item)) return true;
    return intervalsOverlap(drawerInterval, getPlacementInterval(item));
  });
}

function isLowShoeStoragePlacement(placement = {}) {
  return placement.componentType === "woodShelf"
    && (placement.zoneType === "shoeZone" || placement.templateRole === "shoeShelfZone")
    && Number(placement.heightFromFloor || 0) < 1000;
}

function isMiddleStorageShelf(placement = {}) {
  const height = Number(placement.heightFromFloor || 0);
  return placement.componentType === "woodShelf"
    && height >= 900
    && height <= 1500;
}

function getPlacementTop(placement = {}) {
  return Number(placement.heightFromFloor || 0) + getPlacementHeight(placement);
}

function getPlacementInterval(placement = {}) {
  const height = getPlacementHeight(placement);
  if (HANGING_RAIL_COMPONENTS.has(placement.componentType)) {
    return [
      Number(placement.heightFromFloor || 0) - height / 2,
      Number(placement.heightFromFloor || 0) + height / 2
    ];
  }
  return [
    Number(placement.heightFromFloor || 0),
    Number(placement.heightFromFloor || 0) + height
  ];
}

function getPlacementHeight(placement = {}) {
  return {
    singleRail: 50,
    doubleRail: 80,
    woodShelf: 40,
    drawerSingle: DRAWER_HEIGHTS.drawerSingle,
    drawerDouble: DRAWER_HEIGHTS.drawerDouble,
    cabinet: 600,
    trouserRack: 180,
    jewelryBox: 180
  }[placement.componentType] || 100;
}

function getJapaneseDrawerComponentHeight(componentType) {
  return DRAWER_HEIGHTS[componentType] || DRAWER_HEIGHTS.drawerSingle;
}

function intervalsOverlap(a, b) {
  return a[0] < b[1] + 20 && a[1] > b[0] - 20;
}

function drawerZoneRejected(reason) {
  return {
    accepted: false,
    functionalZone: DRAWER_ERGONOMIC_ZONE.functionalZone,
    reason
  };
}
