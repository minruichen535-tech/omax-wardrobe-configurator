import {
  PLANNER_COMPONENT_MAP,
  WALL_MOUNTED_PLACEMENT_RULES,
  createWallMountedRailWithShelfPlacement
} from "./config/plannerPresetMap.js?v=wall-mounted-placement-rules-20260621-03";
import { getBomCalculator, getCuttingRules } from "./series/index.js?v=japanese-drawer-merchandising-20260703-01";

const DEFAULT_SERIES_ID = "japanese-closet";
const defaultCuttingRules = getCuttingRules(DEFAULT_SERIES_ID);
const MAX_HEIGHT_MM = defaultCuttingRules.maxHeightMm;
const MM_PER_METER = 1000;
export const POST_PROFILE_WIDTH_MM = defaultCuttingRules.postProfileWidthMm;

export const componentTypes = defaultCuttingRules.componentTypes;
export const fixedModuleTypes = defaultCuttingRules.fixedModuleTypes;
export const fixedModuleWidths = defaultCuttingRules.fixedModuleWidths;
export const defaultHeightByType = defaultCuttingRules.defaultHeightByType;
export const componentFallbackNames = defaultCuttingRules.componentFallbackNames;
export const defaultIconsByType = defaultCuttingRules.defaultIconsByType;

export function createInitialConfig() {
  const room = { width: 3600, depth: 2800, height: 2700 };
  return {
    room,
    postHeight: 2400,
    shelfDepth: 450,
    wallOffset: "",
    layout: "I",
    uLayoutMode: "bottom-first",
    uAsymmetricSideWalls: false,
    leftWallLength: room.depth,
    rightWallLength: room.depth,
    frameColor: "Silver Grey",
    panelColor: "Wood Brown",
    glassColor: "透明灰",
    walls: {
      back: { enabled: true, length: room.width, bayCount: recommendBayCount(room.width) },
      left: { enabled: false, length: room.depth, bayCount: recommendBayCount(room.depth) },
      right: { enabled: false, length: room.depth, bayCount: recommendBayCount(room.depth) }
    },
    placements: [],
    selectedPlacementId: ""
  };
}

export function createConfigFromPlannerPreset(preset, baseConfig = createInitialConfig(), data = {}) {
  const configPreset = preset?.configPreset || {};
  const seriesId = data?.series?.seriesId || configPreset.productSystemId || DEFAULT_SERIES_ID;
  const cuttingRules = getCuttingRules(seriesId, data) || defaultCuttingRules;
  const productByType = Array.isArray(data.products)
    ? data.products.reduce((map, product) => {
      if (!map[product.type]) map[product.type] = product;
      return map;
    }, {})
    : {};
  const componentTypes = new Set(cuttingRules.componentTypes || []);
  const room = {
    width: Number(configPreset.roomWidth) || baseConfig.room?.width || 3600,
    depth: Number(configPreset.roomDepth) || baseConfig.room?.depth || 2800,
    height: Number(configPreset.roomHeight) || baseConfig.room?.height || 2700
  };
  const layout = mapPlannerLayout(configPreset.layoutType);
  const walls = createPlannerWalls(baseConfig, room, layout, cuttingRules, configPreset);
  const configWithRoom = syncWallLengthsWithRoom({
    ...baseConfig,
    room,
    layout,
    leftWallLength: room.depth,
    rightWallLength: room.depth,
    walls,
    placements: [],
    selectedPlacementId: "",
    ...(seriesId === "wall-mounted-v2" ? { wallOffset: 250 } : {}),
    ...(typeof configPreset.lighting === "boolean" ? { led: configPreset.lighting } : {})
  }, room);
  const placements = createPlannerPlacements({
    configPreset,
    seriesId,
    cuttingRules,
    productByType,
    componentTypes,
    walls: configWithRoom.walls
  });
  return {
    ...configWithRoom,
    placements,
    selectedPlacementId: placements[0]?.id || ""
  };
}

export function applyLayout(config, layout) {
  const walls = {
    ...config.walls,
    back: { ...config.walls.back, enabled: true },
    left: { ...config.walls.left, enabled: layout === "L-left" || layout === "U" },
    right: { ...config.walls.right, enabled: layout === "L-right" || layout === "U" }
  };
  return prunePlacements({ ...config, layout, walls });
}

function mapPlannerLayout(layoutType) {
  if (layoutType === "U型") return "U";
  if (layoutType === "L型") return "L-left";
  return "I";
}

function createPlannerWalls(baseConfig, room, layout, cuttingRules, configPreset = {}) {
  const japaneseWallLayout = configPreset.productSystemId === "japanese-closet"
    ? configPreset.japaneseWallLayout || null
    : null;
  const requestedBayCount = Number(configPreset.bayCount);
  const backBayCount = Number(japaneseWallLayout?.back?.bayCount) > 0
    ? Number(japaneseWallLayout.back.bayCount)
    : Number.isInteger(requestedBayCount) && requestedBayCount > 0
    ? requestedBayCount
    : recommendBayCount(room.width, cuttingRules);
  const sideBayCount = recommendBayCount(room.depth, cuttingRules);
  const leftBayCount = Number(japaneseWallLayout?.left?.bayCount) > 0
    ? Number(japaneseWallLayout.left.bayCount)
    : sideBayCount;
  const rightBayCount = Number(japaneseWallLayout?.right?.bayCount) > 0
    ? Number(japaneseWallLayout.right.bayCount)
    : sideBayCount;
  return {
    back: {
      ...(baseConfig.walls?.back || {}),
      enabled: true,
      length: room.width,
      bayCount: backBayCount,
      bayWidths: normalizePlannerWallBayWidths(japaneseWallLayout?.back?.bayWidths, backBayCount)
    },
    left: {
      ...(baseConfig.walls?.left || {}),
      enabled: layout === "L-left" || layout === "U",
      length: room.depth,
      bayCount: leftBayCount,
      bayWidths: normalizePlannerWallBayWidths(japaneseWallLayout?.left?.bayWidths, leftBayCount)
    },
    right: {
      ...(baseConfig.walls?.right || {}),
      enabled: layout === "U",
      length: room.depth,
      bayCount: rightBayCount,
      bayWidths: normalizePlannerWallBayWidths(japaneseWallLayout?.right?.bayWidths, rightBayCount)
    }
  };
}

function normalizePlannerWallBayWidths(widths, bayCount) {
  if (!Array.isArray(widths) || widths.length !== Number(bayCount)) return [];
  const normalized = widths.map(Number);
  return normalized.every((width) => Number.isFinite(width) && width > 0)
    ? normalized
    : [];
}

function createPlannerPlacements({ configPreset, seriesId, cuttingRules, productByType, componentTypes, walls }) {
  const map = PLANNER_COMPONENT_MAP[seriesId] || {};
  const wallId = "back";
  const bayCount = Math.max(1, Number(walls?.back?.bayCount || 1));
  const placements = [];
  const bayStates = createPlannerBayStates(walls, cuttingRules);
  const zoneRequirements = Array.isArray(configPreset.zoneRequirements) ? configPreset.zoneRequirements : [];
  const context = {
    seriesId,
    map,
    wallId,
    bayCount,
    placements,
    componentTypes,
    productByType,
    cuttingRules,
    planType: configPreset.planType || "basic",
    roomHeight: Number(configPreset.roomHeight) || 2700,
    maxExclusiveBays: Math.max(1, bayStates.length - 1),
    bayStates,
    zoneRequirements,
    wallMountedRailDependencies: Array.isArray(configPreset.wallMountedRailDependencies)
      ? configPreset.wallMountedRailDependencies
      : [],
    componentCounts: {},
    experienceComponentCount: 0
  };
  if (seriesId === "japanese-closet"
    && Array.isArray(configPreset.explicitPlacements)
    && configPreset.explicitPlacements.length) {
    return createJapaneseExplicitPlannerPlacements(
      configPreset.explicitPlacements,
      walls,
      componentTypes,
      productByType
    );
  }
  if (zoneRequirements.length) {
    [...zoneRequirements]
      .sort((a, b) => getPlannerRequirementPriority(context, a) - getPlannerRequirementPriority(context, b))
      .forEach((requirement) => {
      const candidates = [
        ...(requirement.zoneType === "shoeZone" ? ["shoeShelf", "shoesShelf"] : []),
        requirement.preferredComponent,
        ...(Array.isArray(requirement.allowedComponents) ? requirement.allowedComponents : [])
      ].filter((type, index, list) => type && type !== "NONE" && list.indexOf(type) === index);
      if (requirement.preferredComponent === "NONE" || requirement.zoneType === "luggageZone") {
        reservePlannerBay(context, requirement.zoneType);
        return;
      }
      const componentType = candidates.find((type) => isPlannerComponentAllowed(context, type)
        && componentTypes.has(type) && productByType[type]);
      if (!componentType) {
        if (candidates.length) {
          console.warn("[ai-planner preset] no supported component for zone", {
            zoneType: requirement.zoneType,
            candidates,
            seriesId
          });
        }
        return;
      }
      addZonePlannerPlacements(context, requirement, componentType);
    });
    addPremiumUpgradeCabinets(context);
    return placements;
  }
  const demandRatios = configPreset.demandRatios || {};
  const shelfCount = Number.isFinite(Number(configPreset.shelves))
    ? Number(configPreset.shelves)
    : getPlannerShelfCount(configPreset.shelfLevel, bayCount, demandRatios);
  const hangingRodCount = getPlannerHangingRodCount(configPreset, demandRatios);

  addPlannerPlacementGroup(context, "shelf", shelfCount, [1800, 1200, 600]);
  addPlannerPlacementGroup(context, "hangingRod", hangingRodCount, [1600]);
  addPlannerPlacementGroup(context, "cabinet", Number(configPreset.cabinets || 0), [300]);
  addPlannerPlacementGroup(context, "drawer", Number(configPreset.drawers || 0), [300]);
  addPlannerPlacementGroup(context, "glassShelf", Number(configPreset.glassShelves || 0), [1400, 1700]);
  addPlannerPlacementGroup(context, "jewelryBox", configPreset.jewelryBox ? 1 : 0, [900]);
  addPlannerPlacementGroup(context, "trouserRack", configPreset.trouserRack ? 1 : 0, [800]);

  return placements;
}

function createJapaneseExplicitPlannerPlacements(explicitPlacements, walls, componentTypes, productByType) {
  return explicitPlacements.flatMap((placement, index) => {
    const componentType = placement?.componentType;
    const wallId = placement?.wallId || "back";
    const wall = walls?.[wallId];
    const bayIndex = Number(placement?.bayIndex);
    const heightFromFloor = Number(placement?.heightFromFloor);
    const isJapanesePlannerDrawerPlacement = isCanonicalJapanesePlannerDrawerPlacement(placement);
    const componentAllowed = componentTypes.has(componentType) || isJapanesePlannerDrawerPlacement;
    const hasPlacementProduct = isJapanesePlannerDrawerPlacement
      || Boolean(productByType[componentType])
      || (componentType === "drawerDouble" && (placement?.topDrawerSku || placement?.bottomDrawerSku));
    if (!componentType
      || !componentAllowed
      || !hasPlacementProduct
      || !wall?.enabled
      || !Number.isInteger(bayIndex)
      || bayIndex < 0
      || bayIndex >= Number(wall.bayCount || 0)
      || !Number.isFinite(heightFromFloor)) {
      console.warn("[ai-planner preset] invalid japanese explicit placement", placement);
      return [];
    }
    return [{
      id: `planner:explicit:${wallId}:${bayIndex}:${componentType}:${index}`,
      wallId,
      bayIndex,
      componentType,
      ...(isJapaneseAiFixedModulePlacement(placement)
        ? {
          preferredWidth: Number(placement.preferredWidth),
          allowedWidths: normalizeAiPlannerAllowedWidths(placement.allowedWidths),
          moduleWidth: Number(placement.preferredWidth),
          standardWidth: Number(placement.preferredWidth)
        }
        : {}),
      heightFromFloor,
      quantity: 1,
      zoneType: placement.zoneType || "",
      ...(placement.productSku ? { productSku: placement.productSku } : {}),
      ...(placement.topDrawerSku ? { topDrawerSku: placement.topDrawerSku } : {}),
      ...(placement.bottomDrawerSku ? { bottomDrawerSku: placement.bottomDrawerSku } : {}),
      source: placement.source || "candidate"
    }];
  });
}

function isCanonicalJapanesePlannerDrawerPlacement(placement) {
  const componentType = placement?.componentType;
  if (componentType === "drawerSingle") return Boolean(placement.productSku);
  if (componentType === "drawerDouble") {
    return Boolean(placement.productSku && (placement.topDrawerSku || placement.bottomDrawerSku));
  }
  return false;
}

function addPremiumUpgradeCabinets(context) {
  if (context.planType !== "premium" || !context.componentTypes.has("cabinet") || !context.productByType.cabinet) return;
  const targetCount = 2;
  const requirement = {
    zoneType: "storageZone",
    heightFromFloor: 0
  };
  for (let index = Number(context.componentCounts.cabinet || 0); index < targetCount; index += 1) {
    if (!placePlannerComponent(context, requirement, "cabinet", `premium:${index}`)) break;
  }
}

function createPlannerBayStates(walls, cuttingRules) {
  return ["back", "left", "right"].flatMap((wallId) => {
    const wall = walls?.[wallId];
    if (!wall?.enabled) return [];
    const bayCount = Math.max(1, Number(wall.bayCount || 1));
    const fallbackWidth = Number(wall.length || 0) / bayCount;
    return Array.from({ length: bayCount }, (_, bayIndex) => {
      const requestedWidth = Number(wall.bayWidths?.[bayIndex]);
      const rawWidth = Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : fallbackWidth;
      return {
        wallId,
        bayIndex,
        width: Math.max(1, rawWidth - Number(cuttingRules.postProfileWidthMm || 0)),
        exclusiveZone: "",
        reservedBottom: 0,
        placementCount: 0,
        nonShelfFunctionalCount: 0,
        zoneTypes: new Set(),
        intervals: []
      };
    });
  });
}

function addZonePlannerPlacements(context, requirement, componentType) {
  const count = Math.max(0, Math.min(20, Math.round(Number(requirement.quantity) || 0)));
  if (!count) return;
  if (context.planType === "value" && isExperiencePlannerComponent(componentType)
    && context.experienceComponentCount >= 1) return;
  if (requirement.zoneType === "longHangZone") {
    const groupCount = getLongHangZoneCount(context, requirement, count);
    addExclusiveHangZones(context, requirement, componentType, groupCount, [1600]);
    if (context.seriesId !== "wall-mounted-v2") addLongHangTopShelves(context);
    return;
  }
  if (requirement.zoneType === "shortHangZone") {
    const heights = Array.isArray(requirement.railHeights) && requirement.railHeights.length
      ? requirement.railHeights
      : [1050, 2000];
    addExclusiveHangZones(context, requirement, componentType, 1, heights);
    if (context.seriesId !== "wall-mounted-v2") addShortHangTopShelf(context);
    return;
  }
  if (requirement.zoneType === "shoeZone") {
    addShoeZonePlacements(context, requirement, componentType, count);
    return;
  }
  for (let index = 0; index < count; index += 1) {
    let placed = placePlannerComponent(context, requirement, componentType, index);
    if (!placed && context.planType === "premium" && isRequiredPremiumComponent(requirement.zoneType)) {
      placed = placeRequiredPremiumComponent(context, requirement, componentType, index);
    }
    if (!placed && context.planType !== "premium") break;
  }
}

function getPlannerRequirementPriority(context, requirement) {
  if (context.planType === "value" && ["jewelryZone", "trouserZone"].includes(requirement.zoneType)) {
    return 2.4 - (Number(requirement.demandWeight || 0) * 0.01)
      + (requirement.zoneType === "jewelryZone" ? 0.001 : 0);
  }
  if (context.planType === "premium") {
    if (requirement.zoneType === "jewelryZone") return 2.4;
    if (requirement.zoneType === "trouserZone") return 2.5;
  }
  return Number(requirement.priorityIndex ?? 99);
}

function isRequiredPremiumComponent(zoneType) {
  return zoneType === "jewelryZone" || zoneType === "trouserZone";
}

function placeRequiredPremiumComponent(context, requirement, componentType, index) {
  const candidateBays = getPlannerCandidateBays(context, componentType, requirement.zoneType);
  for (const bay of candidateBays) {
    const removable = context.placements
      .filter((placement) => placement.wallId === bay.wallId
        && placement.bayIndex === bay.bayIndex
        && isPlannerShelf(placement.componentType)
        && !["longHangZone", "shortHangZone", "shoeZone"].includes(getPlannerPlacementZone(placement)))
      .sort((a, b) => b.heightFromFloor - a.heightFromFloor);
    for (const shelf of removable) {
      removePlannerPlacement(context, bay, shelf);
      if (placePlannerComponent(context, requirement, componentType, index)) return true;
    }
  }
  return false;
}

function getPlannerPlacementZone(placement) {
  return String(placement.id || "").split(":")[1] || "";
}

function removePlannerPlacement(context, bay, placement) {
  const placementIndex = context.placements.findIndex((candidate) => candidate.id === placement.id);
  if (placementIndex >= 0) context.placements.splice(placementIndex, 1);
  const intervalIndex = bay.intervals.findIndex((interval) => interval.placementId === placement.id);
  if (intervalIndex >= 0) bay.intervals.splice(intervalIndex, 1);
  bay.placementCount = Math.max(0, bay.placementCount - 1);
  context.componentCounts[placement.componentType] = Math.max(
    0,
    Number(context.componentCounts[placement.componentType] || 0) - 1
  );
}

function getLongHangZoneCount(context, requirement, requestedCount) {
  const demandQuantity = Number(requirement.demandQuantity || 0);
  const demandLimit = demandQuantity <= 15
    ? 1
    : demandQuantity <= 35
      ? 2
      : Math.max(2, Math.ceil(demandQuantity / 20));
  const hasShortHang = context.zoneRequirements.some((zone) => zone.zoneType === "shortHangZone");
  const hasShoe = context.zoneRequirements.some((zone) => zone.zoneType === "shoeZone");
  const hasOtherStorage = context.zoneRequirements.some((zone) => !["longHangZone", "shortHangZone", "shoeZone", "luggageZone"].includes(zone.zoneType));
  const reservedStandardBays = (hasShortHang ? 1 : 0) + (hasShoe ? 1 : 0) + (hasOtherStorage ? 1 : 0);
  const standardBayCount = context.bayStates.filter((bay) => bay.width >= 700).length;
  const availableForLongHang = Math.max(1, standardBayCount - reservedStandardBays);
  return Math.max(1, Math.min(requestedCount, demandLimit, availableForLongHang));
}

function addExclusiveHangZones(context, requirement, componentType, count, heights) {
  if (context.seriesId === "wall-mounted-v2") {
    addWallMountedExclusiveHangZones(context, requirement, componentType, count, heights);
    return;
  }
  for (let index = 0; index < count; index += 1) {
    const bay = findPlannerBay(context, true);
    if (!bay) break;
    bay.exclusiveZone = requirement.zoneType;
    const railHeights = requirement.zoneType === "shortHangZone" && componentType === "singleRail"
      ? heights.slice(0, 2)
      : [heights[0]];
    railHeights.forEach((height, railIndex) => {
      addPlannerPlacement(context, componentType, requirement.zoneType, bay, Number(height), `${index}:${railIndex}`);
    });
  }
}

function addWallMountedExclusiveHangZones(context, requirement, componentType, count, heights) {
  const dependencies = context.wallMountedRailDependencies
    .filter((dependency) => dependency.railZoneType === requirement.zoneType);
  const groups = [...new Map(dependencies.map((dependency) => [
    `${dependency.wallId}:${dependency.bayIndex}`,
    dependencies.filter((item) => item.wallId === dependency.wallId
      && item.bayIndex === dependency.bayIndex)
  ])).values()].slice(0, count);

  groups.forEach((group, groupIndex) => {
    const first = group[0];
    const bay = context.bayStates.find((candidate) => candidate.wallId === first.wallId
      && candidate.bayIndex === first.bayIndex
      && !candidate.exclusiveZone
      && candidate.reservedBottom === 0);
    if (!bay) return;
    const existingPlacementIds = new Set(context.placements.map((placement) => placement.id));
    bay.exclusiveZone = requirement.zoneType;
    const railDependencies = requirement.zoneType === "shortHangZone"
      ? group.slice(0, 2)
      : group.slice(0, 1);
    const allPlaced = railDependencies.every((dependency, railIndex) => addWallMountedRailWithShelf(
      context,
      requirement.zoneType,
      componentType,
      bay,
      dependency,
      `${groupIndex}:${railIndex}`
    ));
    if (!allPlaced) {
      context.placements
        .filter((placement) => !existingPlacementIds.has(placement.id))
        .forEach((placement) => removePlannerPlacement(context, bay, placement));
      bay.exclusiveZone = "";
      bay.zoneTypes.delete(requirement.zoneType);
    }
  });

  if (!groups.length && count > 0) {
    console.warn("[ai-planner preset] wall-mounted rail rejected: missing shelf dependency", {
      rejectReason: "wallMountedRailMissingShelf",
      zoneType: requirement.zoneType
    });
  }
}

function addWallMountedRailWithShelf(context, zoneType, componentType, bay, dependency, index) {
  const created = createWallMountedRailWithShelfPlacement({
    rail: {
      wallId: bay.wallId,
      bayIndex: bay.bayIndex,
      componentType,
      heightFromFloor: Number(dependency.railHeightFromFloor)
    },
    shelfType: dependency.componentType,
    dependencyId: dependency.dependencyId
  });
  const rail = addPlannerPlacement(
    context,
    componentType,
    zoneType,
    bay,
    Number(created.railPlacement.heightFromFloor),
    index,
    {
      distanceFromWall: created.railPlacement.distanceFromWall,
      wallMountedOffsetPosition: created.railPlacement.wallMountedOffsetPosition,
      shelfDependency: { ...dependency, ...created.railPlacement.shelfDependency }
    }
  );
  if (!rail) return false;
  const shelfType = dependency.componentType;
  if (!["woodShelf", "glassShelf"].includes(shelfType)
    || !context.componentTypes.has(shelfType)
    || !context.productByType[shelfType]) {
    removePlannerPlacement(context, bay, rail);
    return false;
  }
  const shelf = addPlannerPlacement(
    context,
    shelfType,
    zoneType,
    bay,
    Number(created.linkedShelfPlacement.heightFromFloor),
    `${index}:linked-shelf`,
    {
      allowHighShelf: true,
      allowExactHeight: true,
      linkedRailDependencyId: dependency.dependencyId,
      linkedRailHeight: dependency.railHeightFromFloor,
      isLinkedRailShelf: true
    }
  );
  if (shelf) return true;
  removePlannerPlacement(context, bay, rail);
  return false;
}

function addLongHangTopShelves(context) {
  const shelfType = ["woodShelf"].find((type) => context.componentTypes.has(type) && context.productByType[type]);
  if (!shelfType) return;
  const hasBedding = context.zoneRequirements.some((zone) => zone.zoneType === "beddingZone");
  if (!hasBedding && context.planType !== "premium") return;
  const longBays = context.bayStates.filter((bay) => bay.exclusiveZone === "longHangZone");
  const shelfCount = context.planType === "premium" ? longBays.length : Math.min(1, longBays.length);
  longBays.slice(0, shelfCount).forEach((bay, index) => {
    addPlannerPlacement(context, shelfType, "longHangZone", bay, 2050, `top:${index}`);
  });
}

function addShortHangTopShelf(context) {
  const shelfType = context.componentTypes.has("woodShelf") && context.productByType.woodShelf
    ? "woodShelf"
    : "";
  if (!shelfType) return;
  const shortBay = context.bayStates.find((bay) => bay.exclusiveZone === "shortHangZone");
  if (!shortBay) return;
  addPlannerPlacement(context, shelfType, "shortHangZone", shortBay, 2050, "top");
}

function addShoeZonePlacements(context, requirement, componentType, count) {
  if (isLowShoeDemand(requirement, count)) {
    const longBays = context.bayStates.filter((bay) => bay.exclusiveZone === "longHangZone");
    const mixedCount = Math.min(count, longBays.length);
    let placed = 0;
    longBays.slice(0, mixedCount).forEach((bay, index) => {
      if (addPlannerPlacement(context, componentType, requirement.zoneType, bay, 250, `mixed:${index}`)) placed += 1;
    });
    if (placed > 0) return;
  }
  let remaining = count;
  let groupIndex = 0;
  while (remaining > 0) {
    const bay = findPlannerBay(context, true, { edgeFirst: true });
    if (!bay) break;
    bay.exclusiveZone = "shoeZone";
    [250, 500, 750].slice(0, Math.min(3, remaining)).forEach((height, shelfIndex) => {
      if (addPlannerPlacement(context, componentType, requirement.zoneType, bay, height, `${groupIndex}:${shelfIndex}`)) {
        remaining -= 1;
      }
    });
    groupIndex += 1;
  }
}

function isLowShoeDemand(requirement) {
  return Number(requirement.demandQuantity || 0) <= 25;
}

function placePlannerComponent(context, requirement, componentType, index) {
  const candidateBays = getPlannerCandidateBays(context, componentType, requirement.zoneType);
  if (!candidateBays.length) return false;
  const heights = getZoneCandidateHeights(requirement.zoneType, componentType, requirement.heightFromFloor);
  for (const bay of candidateBays) {
    if (isFixedPlannerModule(context, componentType) && bay.width < 700 && context.planType !== "premium") continue;
    for (const height of heights) {
      if (addPlannerPlacement(context, componentType, requirement.zoneType, bay, height, index)) return true;
    }
  }
  return false;
}

function reservePlannerBay(context, zoneType) {
  const bay = context.bayStates
    .filter((candidate) => !candidate.exclusiveZone && candidate.reservedBottom === 0 && candidate.placementCount === 0)
    .sort((a, b) => a.width - b.width || (a.wallId === "back" ? 1 : -1))[0] || null;
  if (!bay) return;
  bay.reservedBottom = zoneType === "luggageZone" ? 800 : 600;
  bay.intervals.push({ bottom: 0, top: bay.reservedBottom, zoneType, componentType: "NONE" });
}

function findPlannerBay(context, requireEmpty, options = {}) {
  const candidates = context.bayStates.filter((bay) => !bay.exclusiveZone && bay.reservedBottom === 0);
  if (requireEmpty) {
    const exclusiveCount = context.bayStates.filter((bay) => bay.exclusiveZone).length;
    if (exclusiveCount >= context.maxExclusiveBays) return null;
    const empty = candidates.filter((bay) => bay.placementCount === 0);
    if (options.edgeFirst) {
      return empty.sort((a, b) => plannerEdgeScore(a, context) - plannerEdgeScore(b, context))[0] || null;
    }
    return empty[0] || null;
  }
  return candidates.sort((a, b) => a.placementCount - b.placementCount || a.bayIndex - b.bayIndex)[0] || null;
}

function getPlannerCandidateBays(context, componentType, zoneType) {
  const fixedModule = isFixedPlannerModule(context, componentType);
  const spreadSameZone = context.planType === "premium";
  const candidates = context.bayStates
    .filter((bay) => !bay.exclusiveZone
      || (bay.exclusiveZone === "shoeZone" && isExperiencePlannerComponent(componentType)))
    .sort((a, b) => {
      if (componentType === "cabinet") {
        const aNarrow = a.width < 700 ? 0 : 1;
        const bNarrow = b.width < 700 ? 0 : 1;
        if (aNarrow !== bNarrow) return aNarrow - bNarrow;
      }
      if (fixedModule) {
        const aPreferred = a.width >= 700 && a.width <= 900 ? 0 : 1;
        const bPreferred = b.width >= 700 && b.width <= 900 ? 0 : 1;
        if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      }
      const aSameZone = a.zoneTypes.has(zoneType) ? (spreadSameZone ? 1 : 0) : (spreadSameZone ? 0 : 1);
      const bSameZone = b.zoneTypes.has(zoneType) ? (spreadSameZone ? 1 : 0) : (spreadSameZone ? 0 : 1);
      if (aSameZone !== bSameZone) return aSameZone - bSameZone;
      if (!a.zoneTypes.has(zoneType) && !b.zoneTypes.has(zoneType) && a.zoneTypes.size !== b.zoneTypes.size) {
        return a.zoneTypes.size - b.zoneTypes.size;
      }
      return a.placementCount - b.placementCount || b.width - a.width;
    });
  return candidates;
}

function isPlannerShelf(componentType) {
  return ["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"].includes(componentType);
}

function plannerEdgeScore(bay, context) {
  const wallBays = context.bayStates.filter((candidate) => candidate.wallId === bay.wallId);
  const maxIndex = Math.max(0, ...wallBays.map((candidate) => candidate.bayIndex));
  const edgeDistance = Math.min(bay.bayIndex, maxIndex - bay.bayIndex);
  return (bay.wallId === "back" ? 0 : 10) + edgeDistance;
}

function isPlannerComponentAllowed(context, componentType) {
  if (context.planType !== "basic") return true;
  const allowed = new Set(["singleRail", "doubleRail", "woodShelf", "cabinet", "shoeShelf", "shoesShelf"]);
  if (!allowed.has(componentType)) return false;
  if (componentType === "cabinet" && Number(context.componentCounts.cabinet || 0) >= 1) return false;
  return true;
}

function addPlannerPlacement(context, componentType, zoneType, bay, heightFromFloor, index, options = {}) {
  if (!isPlannerComponentAllowed(context, componentType)) return false;
  if (isNonShelfFunctionalComponent(componentType) && bay.nonShelfFunctionalCount >= 2) return false;
  const requestedHeight = options.allowExactHeight
    ? Number(heightFromFloor)
    : snapPlannerHeight(heightFromFloor);
  const snappedHeight = options.allowHighShelf
    ? requestedHeight
    : clampPlannerShelfHeight(componentType, requestedHeight);
  const interval = getPlannerPlacementInterval(context, componentType, snappedHeight);
  if (!interval
    || !hasPlannerRailShelfClearance(bay, componentType, interval, options)
    || hasPlannerCollision(bay, interval)) return false;
  const moduleWidth = isFixedPlannerModule(context, componentType)
    ? getPlannerModuleWidth(bay.width, context.cuttingRules)
    : null;
  if (isFixedPlannerModule(context, componentType) && !moduleWidth) return false;
  const plannerPlacement = {
    id: `planner:${zoneType}:${bay.wallId}:${bay.bayIndex}:${index}`,
    wallId: bay.wallId,
    bayIndex: bay.bayIndex,
    componentType,
    ...(moduleWidth ? { moduleWidth, standardWidth: moduleWidth } : {}),
    heightFromFloor: snappedHeight,
    quantity: 1,
    ...Object.fromEntries(Object.entries(options).filter(([key]) => (
      key !== "allowHighShelf" && key !== "allowExactHeight"
    )))
  };
  context.placements.push(plannerPlacement);
  const placementId = `planner:${zoneType}:${bay.wallId}:${bay.bayIndex}:${index}`;
  bay.intervals.push({ ...interval, placementId, heightFromFloor: snappedHeight, zoneType, componentType });
  bay.zoneTypes.add(zoneType);
  bay.placementCount += 1;
  if (isNonShelfFunctionalComponent(componentType)) bay.nonShelfFunctionalCount += 1;
  if (isExperiencePlannerComponent(componentType)) context.experienceComponentCount += 1;
  context.componentCounts[componentType] = Number(context.componentCounts[componentType] || 0) + 1;
  return plannerPlacement;
}

function isExperiencePlannerComponent(componentType) {
  return [
    "jewelryBox",
    "trouserRack",
    "mixedStorage",
    "jewelryBoxThreeDrawer",
    "trouserRackThreeDrawer"
  ].includes(componentType);
}

function hasPlannerRailShelfClearance(bay, componentType, interval, options = {}) {
  if (!isPlannerShelf(componentType)) return true;
  const clearanceAboveRail = options.isLinkedRailShelf
    ? WALL_MOUNTED_PLACEMENT_RULES.railTopOffsetMm
    : 240;
  return bay.intervals
    .filter((current) => ["singleRail", "doubleRail"].includes(current.componentType))
    .every((rail) => interval.bottom <= rail.heightFromFloor
      || interval.bottom >= rail.heightFromFloor + clearanceAboveRail);
}

function getZoneCandidateHeights(zoneType, componentType, requestedHeight) {
  if (componentType === "cabinet") return [0, 100, 200, 300];
  if (["jewelryBox", "jewelryBoxThreeDrawer"].includes(componentType)) return [900, 850, 950, 1100, 1200, 1300];
  if (["trouserRack", "trouserRackThreeDrawer"].includes(componentType)) return [750, 900, 1050];
  if (componentType === "mixedStorage") return [300, 900, 1200];
  const heightsByZone = {
    bagZone: [1300, 1400, 1500, 1100],
    beddingZone: [2050, 1950, 2100],
    displayZone: [1400, 1300, 1500],
    bookZone: [500, 800, 1100, 1400, 1700, 2000, 2100],
    trouserZone: [800, 900]
  };
  return heightsByZone[zoneType] || [Number(requestedHeight) || 1200];
}

function snapPlannerHeight(value) {
  const height = Math.max(0, Number(value) || 0);
  const anchors = [0, 250, 750, 900, 1050, 1300, 1400, 1500, 1650, 2000, 2050, 2100];
  const nearest = anchors.reduce((best, anchor) => (
    Math.abs(anchor - height) < Math.abs(best - height) ? anchor : best
  ), anchors[0]);
  return Math.abs(nearest - height) <= 120 ? nearest : height;
}

function clampPlannerShelfHeight(componentType, height) {
  return ["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"].includes(componentType)
    ? Math.min(2100, height)
    : height;
}

function isNonShelfFunctionalComponent(componentType) {
  return [
    "cabinet",
    "jewelryBox",
    "trouserRack",
    "mixedStorage",
    "jewelryBoxThreeDrawer",
    "trouserRackThreeDrawer"
  ].includes(componentType);
}

function getPlannerPlacementInterval(context, componentType, heightFromFloor) {
  const height = Number(heightFromFloor);
  if (!Number.isFinite(height) || height < 0) return null;
  const productHeight = Number(context.productByType[componentType]?.height);
  const fallbackHeights = {
    singleRail: 50,
    doubleRail: 80,
    woodShelf: 40,
    glassShelf: 40,
    shoeShelf: 40,
    shoesShelf: 40,
    cabinet: 600,
    jewelryBox: 180,
    jewelryBoxThreeDrawer: 420,
    trouserRack: 180,
    trouserRackThreeDrawer: 420,
    mixedStorage: 500
  };
  const componentHeight = Math.max(20, Number.isFinite(productHeight) && productHeight > 0
    ? productHeight
    : Number(fallbackHeights[componentType] || 100));
  const rail = componentType === "singleRail" || componentType === "doubleRail";
  const bottom = rail ? height - componentHeight / 2 : height;
  const top = rail ? height + componentHeight / 2 : height + componentHeight;
  if (componentType === "cabinet" && height > 300) return null;
  if (bottom < 0 || top > context.roomHeight) return null;
  return { bottom, top };
}

function hasPlannerCollision(bay, interval) {
  const clearance = 20;
  return bay.intervals.some((current) => interval.bottom < current.top + clearance
    && interval.top > current.bottom - clearance);
}

function isFixedPlannerModule(context, componentType) {
  return context.cuttingRules.fixedModuleTypes.includes(componentType);
}

function getPlannerModuleWidth(bayWidth, cuttingRules) {
  const options = [...cuttingRules.fixedModuleWidths].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const fitting = options.filter((width) => width <= bayWidth);
  return fitting[fitting.length - 1] || null;
}

function getPlannerShelfCount(shelfLevel, bayCount, demandRatios) {
  const base = shelfLevel === "high"
    ? bayCount
    : shelfLevel === "medium"
      ? Math.ceil(bayCount * 0.75)
      : Math.max(1, Math.ceil(bayCount / 2));
  return demandRatios?.shoe || demandRatios?.bag || demandRatios?.display || demandRatios?.bedding || demandRatios?.luggage
    ? Math.max(base, Math.ceil(bayCount * 0.75))
    : base;
}

function getPlannerHangingRodCount(configPreset, demandRatios) {
  const requested = Number(configPreset.hangingRods || 0);
  if (requested > 0) return requested;
  return demandRatios?.hanging ? 1 : 0;
}

function addPlannerPlacementGroup(context, key, count, heights) {
  if (context.seriesId === "wall-mounted-v2" && key === "hangingRod") {
    if (!context.wallMountedRailDependencies.length) {
      if (Number(count) > 0) {
        console.warn("[ai-planner preset] wall-mounted rail rejected: missing shelf dependency", {
          rejectReason: "wallMountedRailMissingShelf"
        });
      }
      return;
    }
    ["longHangZone", "shortHangZone"].forEach((zoneType) => {
      const zoneDependencies = context.wallMountedRailDependencies
        .filter((dependency) => dependency.railZoneType === zoneType);
      if (!zoneDependencies.length) return;
      const groupCount = new Set(zoneDependencies.map((dependency) => (
        `${dependency.wallId}:${dependency.bayIndex}`
      ))).size;
      addWallMountedExclusiveHangZones(context, { zoneType }, "singleRail", groupCount, heights);
    });
    return;
  }
  const componentType = context.map[key];
  if (!componentType || !context.componentTypes.has(componentType) || !context.productByType[componentType]) {
    if (count > 0) {
      console.warn("[ai-planner preset] missing component mapping", {
        key,
        componentType,
        seriesComponentTypes: Array.from(context.componentTypes)
      });
    }
    return;
  }
  const safeCount = Math.max(0, Math.min(20, Math.round(Number(count) || 0)));
  for (let index = 0; index < safeCount; index += 1) {
    const bayIndex = index % context.bayCount;
    const currentBayWidth = 0;
    const moduleWidth = context.cuttingRules.fixedModuleTypes.includes(componentType)
      ? normalizeFixedModuleWidth(currentBayWidth, context.cuttingRules)
      : null;
    context.placements.push({
      id: `planner:${key}:${index}`,
      wallId: context.wallId,
      bayIndex,
      componentType,
      ...(moduleWidth ? { moduleWidth, standardWidth: moduleWidth } : {}),
      heightFromFloor: heights[index % heights.length],
      quantity: 1
    });
  }
}

export function syncWallLengthsWithRoom(config, roomPatch) {
  const room = clampRoom({ ...config.room, ...roomPatch });
  const usesAsymmetricUSideWalls = config.layout === "U"
    && config.uAsymmetricSideWalls === true;
  const leftWallLength = usesAsymmetricUSideWalls
    ? getPositiveLength(config.leftWallLength, config.room?.depth)
    : room.depth;
  const rightWallLength = usesAsymmetricUSideWalls
    ? getPositiveLength(config.rightWallLength, config.room?.depth)
    : room.depth;
  const walls = {
    ...config.walls,
    back: { ...config.walls.back, length: room.width },
    left: { ...config.walls.left, length: leftWallLength },
    right: { ...config.walls.right, length: rightWallLength }
  };
  return prunePlacements({
    ...config,
    room,
    leftWallLength: usesAsymmetricUSideWalls ? leftWallLength : room.depth,
    rightWallLength: usesAsymmetricUSideWalls ? rightWallLength : room.depth,
    walls
  });
}

export function calculateDesign(config, data) {
  const seriesId = data?.series?.seriesId || DEFAULT_SERIES_ID;
  const isAluminumPostWardrobe = seriesId === "aluminum-post-wardrobe";
  const cuttingRules = getCuttingRules(seriesId, data) || defaultCuttingRules;
  const bomCalculator = getBomCalculator(seriesId) || getBomCalculator(DEFAULT_SERIES_ID);
  const productBySku = Object.fromEntries(data.products.map((product) => [product.sku, product]));
  const productsByType = data.products.reduce((map, product) => {
    if (!map[product.type]) map[product.type] = [];
    map[product.type].push(product);
    return map;
  }, {});
  const productByType = Object.fromEntries(Object.entries(productsByType).map(([type, products]) => [type, products[0]]));
  const resolvedPostHeight = data.series.resolvePostHeight?.({
    config,
    settings: data.settings,
    products: data.products,
    productByType
  });
  const requestedPostHeight = Number(resolvedPostHeight) > 0
    ? Number(resolvedPostHeight)
    : getPostHeight(config, data?.settings);
  const room = clampRoom({
    ...config.room,
    height: isAluminumPostWardrobe
      ? 3300
      : Math.max(
        requestedPostHeight,
        getFixedRoomHeight(data?.settings, config.room?.height, cuttingRules)
      )
  }, cuttingRules);
  const postHeight = isAluminumPostWardrobe
    ? 3000
    : requestedPostHeight;
  const activeWalls = getActiveWalls({ ...config, room }, cuttingRules);
  const rawPlacements = bomCalculator.createAutoPlacements({
    rawPlacements: config.placements,
    activeWalls,
    postHeight,
    productByType,
    productBySku,
    productsByType,
    rules: data.rules,
    settings: data.settings,
    config
  });
  const placements = normalizePlacements(rawPlacements, activeWalls, room.height)
    .map((placement) => addPlacementDimensions(placement, activeWalls, cuttingRules))
    .map((placement) => {
      const isClientDrawerDoublePlacement = placement.componentType === "drawerDouble"
        && (placement.topDrawerSku || placement.bottomDrawerSku);
      const explicitProduct = placement.productSku ? productBySku[placement.productSku] : null;
      const preferredProduct = resolveAiPlannerPreferredProduct({
        placement,
        productsByType,
        seriesId
      });
      const product = isClientDrawerDoublePlacement ? null : explicitProduct || preferredProduct || bomCalculator.resolvePlacementProduct?.({
        placement,
        productsByType,
        productByType,
        config
      }) || productByType[placement.componentType];
      const resolvedPlacement = product ? { ...placement, productSku: product.sku } : placement;
      if (isJapaneseAiFixedModulePlacement(resolvedPlacement)) {
        console.log("[ai-planner fixed-module-width]", {
          componentType: resolvedPlacement.componentType,
          bayInnerWidth: resolvedPlacement.innerBayWidth,
          preferredWidth: resolvedPlacement.preferredWidth,
          allowedWidths: resolvedPlacement.allowedWidths,
          selectedWidth: resolvedPlacement.moduleWidth,
          selectedSku: product?.sku || null,
          reason: resolvedPlacement.widthSelectionReason
        });
      }
      return resolvedPlacement;
    });
  const errors = [];
  const warnings = [];

  activeWalls.forEach((wall) => {
    errors.push(...wall.validationErrors);
  });

  placements.forEach((placement) => {
    if (placement.componentType === "cabinet" && placement.heightFromFloor > room.height * 0.66) {
      warnings.push("柜子建议放置在底部或中部区域。");
    }
  });

  const bomMap = new Map();
  bomCalculator.addSystemBom({
    activeWalls,
    postHeight,
    productBySku,
    cuttingRules,
    productByType,
    rules: data.rules,
    settings: data.settings,
    config,
    bomMap,
    addBom
  });

  placements.forEach((placement) => {
    if (
      placement.componentType === "drawerDouble"
      && (placement.topDrawerSku || placement.bottomDrawerSku)
    ) {
      const drawerDoubleProduct = productBySku[placement.productSku] || productByType.drawerDouble;
      if (drawerDoubleProduct?.sellable) {
        addBom(
          bomMap,
          drawerDoubleProduct,
          placement.quantity,
          bomCalculator.chooseColor(drawerDoubleProduct, config)
        );
      }
      [placement.topDrawerSku, placement.bottomDrawerSku].filter(Boolean).forEach((drawerSku) => {
        const drawerInsert = productBySku[drawerSku];
        if (!drawerInsert?.sellable) return;
        addBom(
          bomMap,
          drawerInsert,
          placement.quantity,
          bomCalculator.chooseColor(drawerInsert, config)
        );
      });
      return;
    }
    const component = productBySku[placement.productSku] || productByType[placement.componentType];
    if (typeof bomCalculator.addPlacementBom === "function") {
      bomCalculator.addPlacementBom({
        placement,
        component,
        activeWalls,
        productBySku,
        rules: data.rules,
        settings: data.settings,
        config,
        bomMap,
        addBom
      });
      return;
    }
    if (component?.sellable) {
      addBom(
        bomMap,
        component,
        placement.quantity,
        bomCalculator.chooseColor(component, config)
      );
    }

    data.rules
      .filter((rule) => ruleMatchesParent(rule, component, placement.componentType))
      .filter((rule) => bomCalculator.ruleMatches?.(rule, data.settings, config, placement) !== false)
      .forEach((rule) => {
        const required = productBySku[rule.childSku || rule.requiredSku];
        if (!required?.sellable) return;
        const bomItem = bomCalculator.getPlacementRuleItem({
          required,
          rule,
          placement,
          config
        });
        addBom(
          bomMap,
          bomItem.product,
          bomItem.quantity,
          bomItem.color,
          bomItem.note
        );
      });
  });

  bomCalculator.expandNestedRules({
    bomMap,
    rules: data.rules,
    productBySku,
    cuttingRules,
    config,
    addBom
  });

  const bom = Array.from(bomMap.values()).map((item) => ({
    ...item,
    lineTotal: item.quantity * item.unitPrice
  }));

  return {
    room,
    postHeight,
    activeWalls,
    placements,
    productsByType,
    productByType,
    productBySku,
    cuttingRules,
    bom,
    total: bom.reduce((sum, item) => sum + item.lineTotal, 0),
    errors,
    warnings: [...new Set(warnings)]
  };
}

export function getActiveWalls(config, cuttingRules = defaultCuttingRules) {
  const hasBackWall = Boolean(config.walls?.back?.enabled);
  const sideWallAdjustmentLayouts = cuttingRules.sideWallLengthAdjustmentLayouts;
  const appliesSideWallAdjustment = !Array.isArray(sideWallAdjustmentLayouts)
    || sideWallAdjustmentLayouts.includes(config.layout);
  const standardWallPlans = Object.entries(config.walls)
    .filter(([, wall]) => wall.enabled)
    .map(([id]) => {
      const isSideWall = id === "left" || id === "right";
      const sourceLength = isSideWall
        ? getUSideWallSourceLength(config, id)
        : getPositiveLength(config.room?.width, config.walls[id]?.length);
      const startOffset = hasBackWall && isSideWall && appliesSideWallAdjustment
        ? cuttingRules.sideWallLengthAdjustmentMm
          + Math.max(0, Number(cuttingRules.backWallInnerSurfaceInsetMm) || 0)
        : 0;
      const sourceCenterOffset = isSideWall
        ? (sourceLength - getPositiveLength(config.room?.depth, sourceLength)) / 2
        : 0;
      return {
        id,
        sourceLength,
        sourceCenterOffset,
        startOffset,
        endOffset: 0,
        centerOffset: sourceCenterOffset + (
          isSideWall && cuttingRules.centerSideWallAfterStartOffset
            ? startOffset / 2
            : 0
        ),
        reverseBayOrder: isSideWall
          && startOffset > 0
          && cuttingRules.sideWallLayoutStartsAtBackCorner
          && id === "left",
        backCornerAtStart: isSideWall
          && startOffset > 0
          && cuttingRules.sideWallLayoutStartsAtBackCorner
          ? id === "right"
          : null,
        length: Math.max(1, sourceLength - startOffset)
      };
    });
  let wallPlans = standardWallPlans;

  if (config.layout === "U" && cuttingRules.supportsULayoutModes) {
    const uWallCornerOffset = config.uLayoutMode === "side-first"
      && Number.isFinite(Number(cuttingRules.uSideFirstBackWallCornerOffsetMm))
      ? Number(cuttingRules.uSideFirstBackWallCornerOffsetMm)
      : config.uLayoutMode !== "side-first"
        && Number.isFinite(Number(cuttingRules.uBackFirstSideWallCornerOffsetMm))
        ? Number(cuttingRules.uBackFirstSideWallCornerOffsetMm)
        : cuttingRules.sideWallLengthAdjustmentMm;
    wallPlans = cuttingRules.preservesExistingUWallGeometry
      ? getJapaneseUWallPlans(
        standardWallPlans,
        config.uLayoutMode,
        uWallCornerOffset
      )
      : generateULayout({
        mode: config.uLayoutMode,
        room: config.room,
        leftWallLength: getUSideWallSourceLength(config, "left"),
        rightWallLength: getUSideWallSourceLength(config, "right"),
        cornerOffset: config.cornerOffset
      });
  } else if (
    (config.layout === "L-left" || config.layout === "L-right")
    && cuttingRules.reuseBackFirstSideWallPlansForLLayouts === true
  ) {
    const backFirstSideWallCornerOffset = Number.isFinite(
      Number(cuttingRules.uBackFirstSideWallCornerOffsetMm)
    )
      ? Number(cuttingRules.uBackFirstSideWallCornerOffsetMm)
      : cuttingRules.sideWallLengthAdjustmentMm;
    wallPlans = getJapaneseUWallPlans(
      standardWallPlans,
      "back-first",
      backFirstSideWallCornerOffset
    );
  }

  return wallPlans.map((plan, generationIndex) => {
      const { id } = plan;
      const wall = config.walls[id];
      const sourceLength = plan.sourceLength;
      const startOffset = plan.startOffset;
      const endOffset = plan.endOffset || 0;
      const centerOffset = Number(plan.centerOffset) || 0;
      const length = plan.length;
      const recommendedBayCount = recommendBayCount(length, cuttingRules);
      const requestedBayCount = Math.max(1, Number(wall.bayCount || recommendedBayCount));
      const bayCount = cuttingRules.supportsIndependentBayWidths
        ? requestedBayCount
        : Math.max(recommendedBayCount, requestedBayCount);
      const factoryInnerBayWidth = Math.max(1, getFactoryInnerBayWidth(length, bayCount, cuttingRules));
      const fallbackWidth = length / bayCount;
      const requestedBayWidths = Array.isArray(wall.bayWidths)
        ? wall.bayWidths.slice(0, bayCount).map(Number)
        : [];
      const hasCustomBayWidths = requestedBayWidths.length === bayCount
        && requestedBayWidths.every((width) => Number.isFinite(width) && width > 0);
      const validationErrors = validateBayWidths({
        wallId: id,
        bayWidths: hasCustomBayWidths
          ? requestedBayWidths
          : Array.from({ length: bayCount }, () => fallbackWidth),
        totalLength: length,
        minBayWidth: cuttingRules.minBayWidthMm,
        maxBayWidth: cuttingRules.maxBayWidthMm ?? cuttingRules.maxPostSpanMm
      });
      if (sourceLength <= startOffset) {
        validationErrors.unshift(
          `${labelWall(id)}长度必须大于转角避让距离 ${startOffset}mm。`
        );
      }
      const canUseCustomBayWidths = hasCustomBayWidths && validationErrors.length === 0;
      let bayWidths;
      if (canUseCustomBayWidths) {
        bayWidths = requestedBayWidths;
      } else {
        const lockedWidths = getLockedBayWidths(config.placements, id, bayCount, cuttingRules);
        const lockedTotal = lockedWidths.reduce((sum, width) => sum + width, 0);
        const unlockedCount = lockedWidths.filter((width) => !width).length;
        const unlockedWidth = unlockedCount ? Math.max(1, (length - lockedTotal) / unlockedCount) : fallbackWidth;
        bayWidths = lockedWidths.map((width) => width || unlockedWidth);
      }
      const shouldInsetPostCenters = (
        cuttingRules.insetSideWallPostCentersByHalfProfile === true
        && (id === "left" || id === "right")
        && startOffset > 0
      ) || shouldInsetBackWallPostCenters(config.layout, id, cuttingRules);
      const sideBoundaryInsetLayouts = cuttingRules.sideWallPostBoundaryInsetLayouts;
      const usesSideBoundaryInset = (id === "left" || id === "right")
        && startOffset > 0
        && Array.isArray(sideBoundaryInsetLayouts)
        && sideBoundaryInsetLayouts.includes(config.layout);
      const postCenterInset = usesSideBoundaryInset
        ? Math.max(0, Number(cuttingRules.sideWallPostBoundaryInsetMm) || 0)
        : shouldInsetPostCenters
          ? cuttingRules.postProfileWidthMm / 2
          : 0;
      const backCornerPostInset = (id === "left" || id === "right")
        && startOffset > 0
        && typeof cuttingRules.getSideWallBackCornerPostInsetMm === "function"
        ? Math.max(0, Number(cuttingRules.getSideWallBackCornerPostInsetMm(config)) || 0)
        : 0;
      const sideFirstBackWallBoundaryCenterInset = config.layout === "U"
        && config.uLayoutMode === "side-first"
        && id === "back"
        && Number.isFinite(Number(cuttingRules.uSideFirstBackWallBoundaryClearanceMm))
        ? Math.max(0, Number(cuttingRules.uSideFirstBackWallBoundaryClearanceMm))
          + cuttingRules.postProfileWidthMm / 2
        : 0;
      const startPostCenterInset = sideFirstBackWallBoundaryCenterInset || (
        postCenterInset + (plan.backCornerAtStart === true
          ? backCornerPostInset
          : 0)
      );
      const endPostCenterInset = sideFirstBackWallBoundaryCenterInset || (
        postCenterInset + (plan.backCornerAtStart === false
          ? backCornerPostInset
          : 0)
      );
      const postCenterSpan = Math.max(1, length - startPostCenterInset - endPostCenterInset);
      const plannedBayWidthTotal = bayWidths.reduce((sum, width) => sum + width, 0);
      const postCenterBayWidths = (
        shouldInsetPostCenters
        || usesSideBoundaryInset
        || backCornerPostInset > 0
        || sideFirstBackWallBoundaryCenterInset > 0
      ) && plannedBayWidthTotal > 0
        ? bayWidths.map((width) => width * postCenterSpan / plannedBayWidthTotal)
        : bayWidths;
      const averageBayWidth = postCenterBayWidths.reduce((sum, width) => sum + width, 0) / bayCount;
      const usesVariableBayWidths = postCenterBayWidths.some((width) => Math.abs(width - averageBayWidth) > 0.01);
      const posts = Array.from({ length: bayCount + 1 }, (_, index) => ({
        index,
        x: startPostCenterInset
          + postCenterBayWidths.slice(0, index).reduce((sum, width) => sum + width, 0)
      }));
      const bays = Array.from({ length: bayCount }, (_, bayIndex) => {
        const measuredPostCenterDistance = Math.abs(posts[bayIndex + 1].x - posts[bayIndex].x);
        const innerBayWidth = shouldInsetPostCenters
          || usesVariableBayWidths
          || canUseCustomBayWidths
          || backCornerPostInset > 0
          || sideFirstBackWallBoundaryCenterInset > 0
          ? Math.max(1, measuredPostCenterDistance - cuttingRules.postProfileWidthMm)
          : factoryInnerBayWidth;
        return {
          bayIndex,
          leftPostIndex: bayIndex,
          rightPostIndex: bayIndex + 1,
          centerX: (posts[bayIndex].x + posts[bayIndex + 1].x) / 2,
          width: measuredPostCenterDistance,
          rawBayWidth: measuredPostCenterDistance,
          postCenterDistance: measuredPostCenterDistance,
          postProfileWidth: cuttingRules.postProfileWidthMm,
          usableBayWidth: innerBayWidth,
          innerBayWidth,
          usableComponentWidth: innerBayWidth
        };
      });
      return {
        id,
        generationIndex,
        generationMode: config.layout === "U" && cuttingRules.supportsULayoutModes
          ? cuttingRules.preservesExistingUWallGeometry
            ? normalizeJapaneseULayoutMode(config.uLayoutMode)
            : config.uLayoutMode || "bottom-first"
          : "standard",
        sourceLength,
        startOffset,
        endOffset,
        centerOffset,
        reverseBayOrder: plan.reverseBayOrder === true,
        backCornerBayIndex: plan.backCornerAtStart === true
          ? 0
          : plan.backCornerAtStart === false
            ? bayCount - 1
            : null,
        backCornerPostIndex: plan.backCornerAtStart === true
          ? 0
          : plan.backCornerAtStart === false
            ? bayCount
            : null,
        openEndBayIndex: plan.backCornerAtStart === true
          ? bayCount - 1
          : plan.backCornerAtStart === false
            ? 0
            : null,
        length,
        totalLength: length,
        bayCount,
        bayWidths: postCenterBayWidths,
        requestedBayWidths,
        postCenterInset,
        backCornerPostInset,
        startPostCenterInset,
        endPostCenterInset,
        postCenterSpan,
        usesCustomBayWidths: canUseCustomBayWidths,
        validationErrors,
        bayWidth: averageBayWidth,
        rawBayWidth: averageBayWidth,
        postCenterDistance: averageBayWidth,
        postProfileWidth: cuttingRules.postProfileWidthMm,
        usableBayWidth: bays[0]?.innerBayWidth || factoryInnerBayWidth,
        innerBayWidth: bays[0]?.innerBayWidth || factoryInnerBayWidth,
        postCount: bayCount + 1,
        posts,
        bays
      };
    });
}

function getJapaneseUWallPlans(wallPlans, mode = "back-first", fixedOffset = 0) {
  const normalizedMode = normalizeJapaneseULayoutMode(mode);
  const planById = Object.fromEntries(wallPlans.map((plan) => [plan.id, plan]));
  const offset = Math.max(0, Number(fixedOffset) || 0);

  if (normalizedMode === "side-first") {
    const left = planById.left;
    const back = planById.back;
    const right = planById.right;
    const backEndOffset = Math.min(offset, Math.max(0, (back.sourceLength - 1) / 2));

    return [
      {
        ...left,
        startOffset: 0,
        endOffset: 0,
        centerOffset: left.sourceCenterOffset || 0,
        reverseBayOrder: true,
        backCornerAtStart: true,
        length: left.sourceLength
      },
      {
        ...right,
        startOffset: 0,
        endOffset: 0,
        centerOffset: right.sourceCenterOffset || 0,
        reverseBayOrder: false,
        backCornerAtStart: true,
        length: right.sourceLength
      },
      {
        ...back,
        startOffset: backEndOffset,
        endOffset: backEndOffset,
        centerOffset: 0,
        length: Math.max(1, back.sourceLength - backEndOffset * 2)
      }
    ];
  }

  const orderIndex = new Map(["back", "left", "right"].map((wallId, index) => [wallId, index]));
  return wallPlans.map((plan) => {
    const isSideWall = plan.id === "left" || plan.id === "right";
    const startOffset = isSideWall ? offset : plan.startOffset;
    return {
      ...plan,
      startOffset,
      centerOffset: plan.id === "back"
        ? 0
        : (plan.sourceCenterOffset || 0) + startOffset / 2,
      reverseBayOrder: false,
      backCornerAtStart: plan.id === "right"
        ? true
        : plan.id === "left"
          ? false
          : null,
      length: isSideWall
        ? Math.max(1, plan.sourceLength - startOffset)
        : plan.length
    };
  }).sort((a, b) => (
    (orderIndex.get(a.id) ?? order.length) - (orderIndex.get(b.id) ?? order.length)
  ));
}

function normalizeJapaneseULayoutMode(mode) {
  return mode === "side-first" ? "side-first" : "back-first";
}

function shouldInsetBackWallPostCenters(layout, wallId, cuttingRules) {
  if (wallId !== "back") return false;
  const layouts = cuttingRules.insetBackWallPostCentersByHalfProfileLayouts;
  if (!Array.isArray(layouts)) return false;
  return layouts.includes(layout);
}

export function generateULayout({
  mode = "bottom-first",
  room,
  leftWallLength,
  rightWallLength,
  cornerOffset = 300
}) {
  const roomWidth = Math.max(1, Number(room?.width) || 1);
  const roomDepth = Math.max(1, Number(room?.depth) || 1);
  const leftDepth = getPositiveLength(leftWallLength, roomDepth);
  const rightDepth = getPositiveLength(rightWallLength, roomDepth);
  const leftCenterOffset = (leftDepth - roomDepth) / 2;
  const rightCenterOffset = (rightDepth - roomDepth) / 2;
  const requestedOffset = Math.max(0, Number(cornerOffset) || 0);
  const backSafeOffset = Math.min(
    requestedOffset,
    Math.max(0, leftDepth - 1),
    Math.max(0, rightDepth - 1),
    Math.max(0, roomWidth / 2 - 1)
  );
  const leftSafeOffset = Math.min(requestedOffset, Math.max(0, leftDepth - 1));
  const rightSafeOffset = Math.min(requestedOffset, Math.max(0, rightDepth - 1));

  if (mode === "side-first") {
    return [
      {
        id: "left",
        sourceLength: leftDepth,
        sourceCenterOffset: leftCenterOffset,
        centerOffset: leftCenterOffset,
        startOffset: 0,
        endOffset: 0,
        length: leftDepth
      },
      {
        id: "back",
        sourceLength: roomWidth,
        startOffset: backSafeOffset,
        endOffset: backSafeOffset,
        length: Math.max(1, roomWidth - backSafeOffset * 2)
      },
      {
        id: "right",
        sourceLength: rightDepth,
        sourceCenterOffset: rightCenterOffset,
        centerOffset: rightCenterOffset,
        startOffset: 0,
        endOffset: 0,
        length: rightDepth
      }
    ];
  }

  return [
    { id: "back", sourceLength: roomWidth, startOffset: 0, endOffset: 0, length: roomWidth },
    {
      id: "left",
      sourceLength: leftDepth,
      sourceCenterOffset: leftCenterOffset,
      startOffset: leftSafeOffset,
      endOffset: 0,
      centerOffset: leftCenterOffset + leftSafeOffset / 2,
      length: Math.max(1, leftDepth - leftSafeOffset)
    },
    {
      id: "right",
      sourceLength: rightDepth,
      sourceCenterOffset: rightCenterOffset,
      startOffset: rightSafeOffset,
      endOffset: 0,
      centerOffset: rightCenterOffset + rightSafeOffset / 2,
      length: Math.max(1, rightDepth - rightSafeOffset)
    }
  ];
}

function getUSideWallSourceLength(config, wallId) {
  const roomDepth = getPositiveLength(config.room?.depth, config.walls?.[wallId]?.length);
  if (config.layout !== "U" || config.uAsymmetricSideWalls !== true) return roomDepth;
  const configuredLength = wallId === "left"
    ? config.leftWallLength
    : config.rightWallLength;
  return getPositiveLength(configuredLength, roomDepth);
}

function getPositiveLength(value, fallback = 1) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const fallbackValue = Number(fallback);
  return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
}

function validateBayWidths({
  wallId,
  bayWidths,
  totalLength,
  minBayWidth,
  maxBayWidth
}) {
  const errors = [];
  const total = bayWidths.reduce((sum, width) => sum + Number(width || 0), 0);
  if (total > totalLength + 0.01) {
    errors.push(`${labelWall(wallId)}当前跨距总和超过该墙面长度，请调整跨距或减少跨数。`);
  }
  bayWidths.forEach((width, index) => {
    if (Number.isFinite(minBayWidth) && width < minBayWidth) {
      errors.push(`${labelWall(wallId)}第 ${index + 1} 跨不能小于 ${minBayWidth}mm。`);
    }
    if (Number.isFinite(maxBayWidth) && width > maxBayWidth) {
      errors.push(`${labelWall(wallId)}第 ${index + 1} 跨不能大于 ${maxBayWidth}mm。`);
    }
  });
  return errors;
}

export function getFactoryInnerBayWidth(totalLength, bayCount, cuttingRules = defaultCuttingRules) {
  return cuttingRules.getInnerBayWidth(totalLength, bayCount);
}

function getLockedBayWidths(placements, wallId, bayCount, cuttingRules = defaultCuttingRules) {
  const widths = Array.from({ length: bayCount }, () => 0);
  placements
    .filter((placement) => placement.wallId === wallId && cuttingRules.fixedModuleTypes.includes(placement.componentType))
    .forEach((placement) => {
      const bayIndex = clampNumber(placement.bayIndex, 0, bayCount - 1);
      widths[bayIndex] = normalizeFixedModuleWidthForRules(
        placement.moduleWidth || placement.standardWidth || widths[bayIndex],
        cuttingRules.fixedModuleWidths
      );
    });
  return widths;
}

export function recommendBayCount(length, cuttingRules = defaultCuttingRules) {
  return Math.max(1, Math.ceil(Number(length || 0) / cuttingRules.maxPostSpanMm));
}

export function labelWall(wallId) {
  return { back: "后墙", left: "左墙", right: "右墙" }[wallId] || wallId;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}

export function meters(mm) {
  return mm / MM_PER_METER;
}

export function getComponentName(type, productByType = {}, cuttingRules = defaultCuttingRules) {
  return productByType[type]?.nameCn || cuttingRules.componentFallbackNames[type] || type;
}

export function getDefaultHeight(componentType, roomHeight = MAX_HEIGHT_MM, cuttingRules = defaultCuttingRules) {
  return Math.min(cuttingRules.defaultHeightByType[componentType] || 1000, roomHeight);
}

export function getComponentIcon(product, componentType, cuttingRules = defaultCuttingRules) {
  return product?.icon || cuttingRules.defaultIconsByType[componentType] || "";
}

function ruleMatchesParent(rule, component, componentType) {
  const parentSku = String(rule?.parentSku || "").trim();
  const parentType = String(rule?.parentType || "").trim();
  return (
    (parentSku && parentSku === component?.sku) ||
    (parentType && parentType === componentType)
  );
}

function clampRoom(room, cuttingRules = defaultCuttingRules) {
  return {
    width: clampNumber(room.width, 500, 10000),
    depth: clampNumber(room.depth, 300, 5000),
    height: clampNumber(room.height, cuttingRules.minHeightMm, cuttingRules.maxHeightMm)
  };
}

function getFixedRoomHeight(settings, fallbackHeight, cuttingRules = defaultCuttingRules) {
  const fixedHeight = Number(settings?.roomHeightFixed);
  return Number.isFinite(fixedHeight) && fixedHeight > 0
    ? fixedHeight
    : clampNumber(fallbackHeight, cuttingRules.minHeightMm, cuttingRules.maxHeightMm);
}

function getPostHeight(config, settings) {
  const options = Array.isArray(settings?.postHeightOptions) && settings.postHeightOptions.length
    ? settings.postHeightOptions.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : [2000, 2400];
  const fallback = Number(settings?.defaultPostHeight) || 2400;
  const requested = Number(config.postHeight) || fallback;
  if (options.includes(requested)) return requested;
  if (options.includes(fallback)) return fallback;
  return options[0] || fallback;
}

function normalizePlacements(rawPlacements, activeWalls, roomHeight) {
  const wallById = Object.fromEntries(activeWalls.map((wall) => [wall.id, wall]));
  return rawPlacements
    .filter((placement) => wallById[placement.wallId])
    .map((placement) => {
      const wall = wallById[placement.wallId];
      const componentType = placement.componentType || placement.type;
      return {
        ...placement,
        componentType,
        bayIndex: clampNumber(placement.bayIndex, 0, wall.bayCount - 1),
        heightFromFloor: clampNumber(placement.heightFromFloor, 0, roomHeight),
        quantity: clampNumber(placement.quantity, 1, 20)
      };
    });
}

function addPlacementDimensions(placement, activeWalls, cuttingRules = defaultCuttingRules) {
  const wall = activeWalls.find((item) => item.id === placement.wallId);
  const bay = wall?.bays?.[placement.bayIndex];
  if (!wall || !bay) return placement;
  const componentCutLength = cuttingRules.getCutLength(placement.componentType, bay.innerBayWidth);
  const preferredWidthSelection = isJapaneseAiFixedModulePlacement(placement)
    ? selectAiPlannerLargestFittingWidth(placement, bay.innerBayWidth)
    : null;
  const moduleWidth = cuttingRules.fixedModuleTypes.includes(placement.componentType)
    ? preferredWidthSelection
      ? preferredWidthSelection.selectedWidth
      : normalizeFixedModuleWidthForRules(
      placement.moduleWidth || placement.standardWidth || bay.postCenterDistance,
      cuttingRules.fixedModuleWidths
    )
    : null;
  const visualScaleWidth = preferredWidthSelection
    ? bay.innerBayWidth
    : cuttingRules.getVisualScaleWidth(
      placement.componentType,
      bay.innerBayWidth,
      componentCutLength,
      moduleWidth
    );
  return {
    ...placement,
    moduleWidth,
    standardWidth: moduleWidth,
    ...(preferredWidthSelection
      ? { widthSelectionReason: preferredWidthSelection.reason }
      : {}),
    postLeftX: wall.posts[placement.bayIndex]?.x,
    postRightX: wall.posts[placement.bayIndex + 1]?.x,
    postProfileWidth: wall.postProfileWidth,
    bayCenter: bay.centerX,
    rawBayWidth: bay.rawBayWidth,
    postCenterDistance: bay.postCenterDistance,
    innerBayWidth: bay.innerBayWidth,
    componentCutLength,
    visualScaleWidth,
    usableComponentWidth: bay.usableComponentWidth,
    cutLength: componentCutLength
  };
}

function isJapaneseAiFixedModulePlacement(placement) {
  return ["trouserRack", "jewelryBox"].includes(placement?.componentType)
    && Number(placement.preferredWidth) > 0;
}

function normalizeAiPlannerAllowedWidths(widths) {
  const normalized = (Array.isArray(widths) ? widths : [900, 800, 700, 600, 500])
    .map(Number)
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((left, right) => right - left);
  return [...new Set(normalized)];
}

function selectAiPlannerLargestFittingWidth(placement, bayInnerWidth) {
  const allowedWidths = normalizeAiPlannerAllowedWidths(placement.allowedWidths);
  const preferredWidth = Number(placement.preferredWidth);
  const selectedWidth = allowedWidths.find((width) => (
    width <= preferredWidth && width <= Number(bayInnerWidth)
  )) || null;
  return {
    selectedWidth,
    reason: selectedWidth === preferredWidth ? "preferredWidthFit" : "fallbackToLargestFit"
  };
}

function resolveAiPlannerPreferredProduct({ placement, productsByType, seriesId }) {
  if (seriesId !== "japanese-closet" || !isJapaneseAiFixedModulePlacement(placement)) return null;
  const selectedWidth = Number(placement.moduleWidth || placement.standardWidth);
  if (!selectedWidth) return null;
  return (productsByType[placement.componentType] || []).find((product) => (
    Number(product.width || product.moduleWidth || product.standardWidth) === selectedWidth
  )) || null;
}

export function normalizeFixedModuleWidth(width, cuttingRules = defaultCuttingRules) {
  return normalizeFixedModuleWidthForRules(width, cuttingRules.fixedModuleWidths);
}

function normalizeFixedModuleWidthForRules(width, widthOptions) {
  const value = Number(width);
  if (!Number.isFinite(value) || value <= 0) return widthOptions[0];
  return widthOptions.find((option) => option >= value) || widthOptions[widthOptions.length - 1];
}

function prunePlacements(config) {
  const activeWallIds = new Set(Object.entries(config.walls).filter(([, wall]) => wall.enabled).map(([id]) => id));
  return {
    ...config,
    placements: config.placements.filter((placement) => activeWallIds.has(placement.wallId))
  };
}

function addBom(map, product, quantity, color, note = "") {
  if (!quantity) return;
  const key = `${product.sku}|${color}|${note}`;
  const existing = map.get(key);
  if (existing) {
    existing.quantity += quantity;
    return;
  }
  map.set(key, { ...product, quantity, color, note });
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
