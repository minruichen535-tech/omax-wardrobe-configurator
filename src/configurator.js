import { getBomCalculator, getCuttingRules } from "./series/index.js";

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

export function applyLayout(config, layout) {
  const walls = {
    ...config.walls,
    back: { ...config.walls.back, enabled: true },
    left: { ...config.walls.left, enabled: layout === "L-left" || layout === "U" },
    right: { ...config.walls.right, enabled: layout === "L-right" || layout === "U" }
  };
  return prunePlacements({ ...config, layout, walls });
}

export function syncWallLengthsWithRoom(config, roomPatch) {
  const room = clampRoom({ ...config.room, ...roomPatch });
  const walls = {
    ...config.walls,
    back: { ...config.walls.back, length: room.width },
    left: { ...config.walls.left, length: room.depth },
    right: { ...config.walls.right, length: room.depth }
  };
  return prunePlacements({ ...config, room, walls });
}

export function calculateDesign(config, data) {
  const seriesId = data?.series?.seriesId || DEFAULT_SERIES_ID;
  const cuttingRules = getCuttingRules(seriesId) || defaultCuttingRules;
  const bomCalculator = getBomCalculator(seriesId) || getBomCalculator(DEFAULT_SERIES_ID);
  const room = clampRoom({
    ...config.room,
    height: getFixedRoomHeight(data?.settings, config.room?.height, cuttingRules)
  }, cuttingRules);
  const postHeight = getPostHeight(config, data?.settings);
  const productBySku = Object.fromEntries(data.products.map((product) => [product.sku, product]));
  const productsByType = data.products.reduce((map, product) => {
    if (!map[product.type]) map[product.type] = [];
    map[product.type].push(product);
    return map;
  }, {});
  const productByType = Object.fromEntries(Object.entries(productsByType).map(([type, products]) => [type, products[0]]));
  const activeWalls = getActiveWalls({ ...config, room }, cuttingRules);
  const rawPlacements = bomCalculator.createAutoPlacements({
    rawPlacements: config.placements,
    activeWalls,
    postHeight,
    productByType
  });
  const placements = normalizePlacements(rawPlacements, activeWalls, room.height)
    .map((placement) => addPlacementDimensions(placement, activeWalls, cuttingRules));
  const errors = [];
  const warnings = [];

  activeWalls.forEach((wall) => {
    if (wall.bayWidth > cuttingRules.maxPostSpanMm) {
      errors.push(`${labelWall(wall.id)}单跨宽度不能超过 ${cuttingRules.maxPostSpanMm}mm，请增加跨数。`);
    }
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
    productByType,
    rules: data.rules,
    config,
    bomMap,
    addBom
  });

  placements.forEach((placement) => {
    const component = productByType[placement.componentType];
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
      .filter((rule) => ruleMatchesLed(rule, placement))
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
    bom,
    total: bom.reduce((sum, item) => sum + item.lineTotal, 0),
    errors,
    warnings: [...new Set(warnings)]
  };
}

export function getActiveWalls(config, cuttingRules = defaultCuttingRules) {
  const hasBackWall = Boolean(config.walls?.back?.enabled);
  return Object.entries(config.walls)
    .filter(([, wall]) => wall.enabled)
    .map(([id, wall]) => {
      const isSideWall = id === "left" || id === "right";
      const sourceLength = Math.max(
        1,
        Number(isSideWall ? config.room?.depth : config.room?.width) || Number(wall.length || 0)
      );
      const startOffset = hasBackWall && isSideWall
        ? cuttingRules.sideWallLengthAdjustmentMm
        : 0;
      const length = Math.max(1, sourceLength - startOffset);
      const recommendedBayCount = recommendBayCount(length, cuttingRules);
      const bayCount = Math.max(recommendedBayCount, Number(wall.bayCount || recommendedBayCount));
      const factoryInnerBayWidth = Math.max(1, getFactoryInnerBayWidth(length, bayCount, cuttingRules));
      const lockedWidths = getLockedBayWidths(config.placements, id, bayCount, cuttingRules);
      const lockedTotal = lockedWidths.reduce((sum, width) => sum + width, 0);
      const unlockedCount = lockedWidths.filter((width) => !width).length;
      const fallbackWidth = length / bayCount;
      const unlockedWidth = unlockedCount ? Math.max(1, (length - lockedTotal) / unlockedCount) : fallbackWidth;
      const bayWidths = lockedWidths.map((width) => width || unlockedWidth);
      const posts = Array.from({ length: bayCount + 1 }, (_, index) => ({
        index,
        x: bayWidths.slice(0, index).reduce((sum, width) => sum + width, 0)
      }));
      const bays = Array.from({ length: bayCount }, (_, bayIndex) => {
        const measuredPostCenterDistance = Math.abs(posts[bayIndex + 1].x - posts[bayIndex].x);
        return {
          bayIndex,
          leftPostIndex: bayIndex,
          rightPostIndex: bayIndex + 1,
          centerX: (posts[bayIndex].x + posts[bayIndex + 1].x) / 2,
          width: measuredPostCenterDistance,
          rawBayWidth: measuredPostCenterDistance,
          postCenterDistance: measuredPostCenterDistance,
          postProfileWidth: cuttingRules.postProfileWidthMm,
          usableBayWidth: factoryInnerBayWidth,
          innerBayWidth: factoryInnerBayWidth,
          usableComponentWidth: factoryInnerBayWidth
        };
      });
      return {
        id,
        sourceLength,
        startOffset,
        length,
        bayCount,
        bayWidth: unlockedWidth,
        rawBayWidth: unlockedWidth,
        postCenterDistance: unlockedWidth,
        postProfileWidth: cuttingRules.postProfileWidthMm,
        usableBayWidth: factoryInnerBayWidth,
        innerBayWidth: factoryInnerBayWidth,
        postCount: bayCount + 1,
        posts,
        bays
      };
    });
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

function ruleMatchesLed(rule, placement) {
  return true;
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
  const moduleWidth = cuttingRules.fixedModuleTypes.includes(placement.componentType)
    ? normalizeFixedModuleWidthForRules(
      placement.moduleWidth || placement.standardWidth || bay.postCenterDistance,
      cuttingRules.fixedModuleWidths
    )
    : null;
  const visualScaleWidth = cuttingRules.getVisualScaleWidth(
    placement.componentType,
    bay.innerBayWidth,
    componentCutLength,
    moduleWidth
  );
  return {
    ...placement,
    moduleWidth,
    standardWidth: moduleWidth,
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
