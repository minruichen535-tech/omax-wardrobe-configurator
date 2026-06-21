export const PLANNER_COMPONENT_MAP = {
  "japanese-closet": {
    shelf: "woodShelf",
    hangingRod: "singleRail",
    cabinet: "cabinet",
    drawer: "cabinet",
    jewelryBox: "jewelryBox",
    trouserRack: "trouserRack"
  },
  "aluminum-post-wardrobe": {
    shelf: "woodShelf",
    hangingRod: "singleRail",
    cabinet: "cabinet",
    drawer: "cabinet",
    glassShelf: "glassShelf",
    jewelryBox: "jewelryBox"
  },
  "carbon-steel-post-wardrobe-v2": {
    shelf: "woodShelf",
    hangingRod: "singleRail",
    cabinet: "cabinet",
    drawer: "cabinet"
  },
  "aluminum-base-supported": {
    shelf: "woodShelf",
    hangingRod: "singleRail",
    cabinet: "cabinet",
    drawer: "cabinet",
    glassShelf: "glassShelf",
    jewelryBox: "jewelryBox",
    trouserRack: "trouserRack"
  },
  "wall-mounted-v2": {
    shelf: "woodShelf",
    hangingRod: "singleRail",
    cabinet: "cabinet",
    drawer: "cabinet",
    glassShelf: "glassShelf",
    jewelryBox: "jewelryBox",
    trouserRack: "trouserRack"
  }
};

export const WALL_MOUNTED_PLACEMENT_RULES = Object.freeze({
  railDistanceFromWallMm: 80,
  railTopOffsetMm: 80,
  contactToleranceMm: 5,
  railMinVerticalClearanceMm: 450,
  manualRailHeightCandidates: Object.freeze([1600, 1050, 2000, 900])
});

export function getWallMountedRailOffsetPosition(
  wall = {},
  distanceFromWall = WALL_MOUNTED_PLACEMENT_RULES.railDistanceFromWallMm
) {
  const wallId = wall.id || wall.wallId || wall.orientation || "back";
  const distance = Number.isFinite(Number(distanceFromWall))
    ? Number(distanceFromWall)
    : WALL_MOUNTED_PLACEMENT_RULES.railDistanceFromWallMm;

  if (wallId === "left") {
    return { x: distance, z: 0, axis: wall.axis || "Z", orientation: "left" };
  }

  if (wallId === "right") {
    return { x: -distance, z: 0, axis: wall.axis || "Z", orientation: "right" };
  }

  return { x: 0, z: distance, axis: wall.axis || "X", orientation: "back" };
}

export const getWallMountedOffsetPosition = getWallMountedRailOffsetPosition;

export function getWallMountedLinkedShelfHeight(railHeightFromFloor) {
  return Number(railHeightFromFloor || 0) + WALL_MOUNTED_PLACEMENT_RULES.railTopOffsetMm;
}

export function resolveWallMountedShelfType({
  wallMountedShelfType = "",
  planType = "basic",
  needs = {},
  supportedTypes
} = {}) {
  const supports = (type) => {
    if (!supportedTypes) return true;
    if (typeof supportedTypes.has === "function") return supportedTypes.has(type);
    return Array.isArray(supportedTypes) && supportedTypes.includes(type);
  };
  if (["woodShelf", "glassShelf"].includes(wallMountedShelfType)
    && supports(wallMountedShelfType)) {
    return wallMountedShelfType;
  }
  if (planType === "premium" && supports("glassShelf")) return "glassShelf";
  const displayDemand = ["展示收藏", "包包", "包包放置", "包包展示"]
    .reduce((total, key) => total + Number(needs[key] || 0), 0);
  if (planType === "value" && displayDemand >= 2 && supports("glassShelf")) return "glassShelf";
  if (supports("woodShelf")) return "woodShelf";
  return supports("glassShelf") ? "glassShelf" : "";
}

export function createWallMountedRailWithShelfPlacement({
  rail,
  shelf = {},
  shelfType = "woodShelf",
  dependencyId = ""
} = {}) {
  const railPlacement = { ...rail };
  const resolvedDependencyId = dependencyId
    || `wall-mounted:${railPlacement.wallId}:${railPlacement.bayIndex}:${railPlacement.heightFromFloor}`;
  const linkedShelfHeight = getWallMountedLinkedShelfHeight(railPlacement.heightFromFloor);
  const railOffset = getWallMountedRailOffsetPosition({
    id: railPlacement.wallId,
    axis: railPlacement.wallId === "back" ? "X" : "Z"
  });
  Object.assign(railPlacement, {
    distanceFromWall: WALL_MOUNTED_PLACEMENT_RULES.railDistanceFromWallMm,
    wallMountedOffsetPosition: railOffset,
    shelfDependency: {
      dependencyId: resolvedDependencyId,
      componentType: shelfType,
      wallId: railPlacement.wallId,
      bayIndex: railPlacement.bayIndex,
      heightFromFloor: linkedShelfHeight
    }
  });
  const linkedShelfPlacement = {
    ...shelf,
    wallId: railPlacement.wallId,
    bayIndex: railPlacement.bayIndex,
    componentType: shelfType,
    heightFromFloor: linkedShelfHeight
  };
  return { railPlacement, linkedShelfPlacement, dependencyId: resolvedDependencyId };
}
