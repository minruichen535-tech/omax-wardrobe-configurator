const MAX_POST_SPAN_MM = 1000;
const MIN_HEIGHT_MM = 1800;
const MAX_HEIGHT_MM = 3500;
const MM_PER_METER = 1000;
export const POST_PROFILE_WIDTH_MM = 33;

export const componentTypes = [
  "woodTop",
  "woodShelf",
  "singleRail",
  "doubleRail",
  "cabinet",
  "jewelryBox",
  "trouserRack"
];

export const fixedModuleTypes = ["jewelryBox", "trouserRack"];
export const fixedModuleWidths = [500, 600, 700, 800, 900];
const pairMeasuredBracketSkus = new Set([
  "JP-TOP-BRACKET",
  "JP-SHELF-BRACKET",
  "JP-CABINET-BRACKET"
]);

export const defaultHeightByType = {
  woodTop: 2400,
  woodShelf: 1200,
  singleRail: 1600,
  doubleRail: 1500,
  cabinet: 300,
  jewelryBox: 900,
  trouserRack: 900
};

export const componentFallbackNames = {
  woodTop: "木顶板",
  woodShelf: "木层板",
  singleRail: "挂衣杆",
  doubleRail: "挂衣杆",
  cabinet: "柜子",
  jewelryBox: "首饰盒",
  trouserRack: "裤架"
};

export const defaultIconsByType = {
  woodTop: "images/icons/wood-top.svg",
  woodShelf: "images/icons/wood-shelf.svg",
  singleRail: "images/icons/single-rail.svg",
  doubleRail: "images/icons/double-rail.svg",
  cabinet: "images/icons/cabinet-single.svg",
  jewelryBox: "images/icons/jewelry-box.svg",
  trouserRack: "images/icons/trouser-rack.svg"
};

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
  const room = clampRoom({
    ...config.room,
    height: getFixedRoomHeight(data?.settings, config.room?.height)
  });
  const postHeight = getPostHeight(config, data?.settings);
  const productBySku = Object.fromEntries(data.products.map((product) => [product.sku, product]));
  const productsByType = data.products.reduce((map, product) => {
    if (!map[product.type]) map[product.type] = [];
    map[product.type].push(product);
    return map;
  }, {});
  const productByType = Object.fromEntries(Object.entries(productsByType).map(([type, products]) => [type, products[0]]));
  const activeWalls = getActiveWalls({ ...config, room });
  const rawPlacements = withAutoWoodTopPlacements(config.placements, activeWalls, postHeight, productByType.woodTop);
  const placements = normalizePlacements(rawPlacements, activeWalls, room.height)
    .map((placement) => addPlacementDimensions(placement, activeWalls));
  const errors = [];
  const warnings = [];

  activeWalls.forEach((wall) => {
    if (wall.bayWidth > MAX_POST_SPAN_MM) {
      errors.push(`${labelWall(wall.id)}单跨宽度不能超过 1000mm，请增加跨数。`);
    }
  });

  placements.forEach((placement) => {
    if (placement.componentType === "cabinet" && placement.heightFromFloor > room.height * 0.66) {
      warnings.push("柜子建议放置在底部或中部区域。");
    }
  });

  const bomMap = new Map();
  const cornerBracket = productBySku["JP-CORNER-BRACKET"];
  const cornerBracketQuantity = room.width <= 3000 ? 2 : 4;
  if (cornerBracket?.sellable) {
    const cornerBracketBomProduct = withSelectedDepthSizeRule(cornerBracket, config.shelfDepth);
    addBom(bomMap, cornerBracketBomProduct, cornerBracketQuantity, chooseColor(cornerBracket, config));
  }
  const postProduct = productByType.post;
  const postQuantity = activeWalls.reduce((sum, wall) => sum + wall.postCount, 0);
  if (postProduct?.sellable) {
    const postBomProduct = {
      ...postProduct,
      sizeRule: `${postHeight}mm`
    };
    addBom(bomMap, postBomProduct, postQuantity, chooseColor(postProduct, config));
  }

  data.rules
    .filter((rule) => ruleMatchesParent(rule, postProduct, "post"))
    .forEach((rule) => {
      const required = productBySku[rule.childSku || rule.requiredSku];
      if (!required?.sellable) return;
      addBom(bomMap, required, rule.quantity * postQuantity, chooseColor(required, config), rule.note);
    });

  placements.forEach((placement) => {
    const component = productByType[placement.componentType];
    if (component?.sellable) {
      addBom(bomMap, component, placement.quantity, chooseColor(component, config));
    }

    data.rules
      .filter((rule) => ruleMatchesParent(rule, component, placement.componentType))
      .filter((rule) => ruleMatchesLed(rule, placement))
      .forEach((rule) => {
        const required = productBySku[rule.childSku || rule.requiredSku];
        if (!required?.sellable) return;
        const rawQuantity = rule.quantity * placement.quantity;
        const bomQuantity = pairMeasuredBracketSkus.has(required.sku)
          ? rawQuantity / 2
          : rawQuantity;
        const groupedBomProduct = required.sku === "JP-SHELF-BRACKET" && rule.note === "柜体用"
          ? { ...required, bomGroup: "柜体系统" }
          : required;
        const unitAdjustedProduct = pairMeasuredBracketSkus.has(required.sku)
          ? { ...groupedBomProduct, unit: "对" }
          : groupedBomProduct;
        const bomProduct = withSelectedDepthSizeRule(unitAdjustedProduct, config.shelfDepth);
        addBom(bomMap, bomProduct, bomQuantity, chooseColor(required, config), rule.note);
      });
  });

  const nestedFastenerParentSkus = new Set([
    "JP-TOP-BRACKET",
    "JP-MIDDLE-BRACKET",
    "JP-CABINET-BRACKET",
    "JP-HORIZONTAL-RAIL",
    "JP-CORNER-BRACKET"
  ]);
  Array.from(bomMap.values())
    .filter((item) => nestedFastenerParentSkus.has(item.sku))
    .forEach((parentItem) => {
      data.rules
        .filter((rule) => rule.parentSku === parentItem.sku)
        .forEach((rule) => {
          const required = productBySku[rule.childSku || rule.requiredSku];
          if (!required?.sellable) return;
          addBom(
            bomMap,
            required,
            rule.quantity * parentItem.quantity,
            chooseColor(required, config),
            rule.note
          );
        });
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

export function getActiveWalls(config) {
  const hasBackWall = Boolean(config.walls?.back?.enabled);
  const shelfDepth = Math.max(0, Number(config.shelfDepth || 0));
  const wallOffset = Math.max(0, Number(config.wallOffset) || 250);
  const cornerSafetyGap = 30;
  const cornerAvoidanceDepth = wallOffset + shelfDepth / 2 + cornerSafetyGap;
  return Object.entries(config.walls)
    .filter(([, wall]) => wall.enabled)
    .map(([id, wall]) => {
      const sourceLength = Math.max(1, Number(wall.length || 0));
      const isSideWall = id === "left" || id === "right";
      const startOffset = hasBackWall && isSideWall ? cornerAvoidanceDepth : 0;
      const length = Math.max(1, sourceLength - startOffset);
      const bayCount = Math.max(recommendBayCount(length), Number(wall.bayCount || recommendBayCount(length)));
      const lockedWidths = getLockedBayWidths(config.placements, id, bayCount);
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
        const measuredInnerBayWidth = Math.max(1, measuredPostCenterDistance - POST_PROFILE_WIDTH_MM);
        return {
          bayIndex,
          leftPostIndex: bayIndex,
          rightPostIndex: bayIndex + 1,
          centerX: (posts[bayIndex].x + posts[bayIndex + 1].x) / 2,
          width: measuredPostCenterDistance,
          rawBayWidth: measuredPostCenterDistance,
          postCenterDistance: measuredPostCenterDistance,
          postProfileWidth: POST_PROFILE_WIDTH_MM,
          usableBayWidth: measuredInnerBayWidth,
          innerBayWidth: measuredInnerBayWidth,
          usableComponentWidth: measuredInnerBayWidth
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
        postProfileWidth: POST_PROFILE_WIDTH_MM,
        usableBayWidth: Math.max(1, unlockedWidth - POST_PROFILE_WIDTH_MM),
        innerBayWidth: Math.max(1, unlockedWidth - POST_PROFILE_WIDTH_MM),
        postCount: bayCount + 1,
        posts,
        bays
      };
    });
}

function getLockedBayWidths(placements, wallId, bayCount) {
  const widths = Array.from({ length: bayCount }, () => 0);
  placements
    .filter((placement) => placement.wallId === wallId && fixedModuleTypes.includes(placement.componentType))
    .forEach((placement) => {
      const bayIndex = clampNumber(placement.bayIndex, 0, bayCount - 1);
      widths[bayIndex] = normalizeFixedModuleWidth(placement.moduleWidth || placement.standardWidth || widths[bayIndex]);
    });
  return widths;
}

export function recommendBayCount(length) {
  return Math.max(1, Math.ceil(Number(length || 0) / MAX_POST_SPAN_MM));
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

export function getComponentName(type, productByType = {}) {
  return productByType[type]?.nameCn || componentFallbackNames[type] || type;
}

export function getDefaultHeight(componentType, roomHeight = MAX_HEIGHT_MM) {
  return Math.min(defaultHeightByType[componentType] || 1000, roomHeight);
}

export function getComponentIcon(product, componentType) {
  return product?.icon || defaultIconsByType[componentType] || "";
}

function ruleMatchesLed(rule, placement) {
  return true;
}

function ruleMatchesParent(rule, product, fallbackType) {
  const parentSku = rule.parentSku || "";
  if (parentSku && product?.sku) return parentSku === product.sku;
  return rule.configType === fallbackType;
}

function clampRoom(room) {
  return {
    width: clampNumber(room.width, 500, 10000),
    depth: clampNumber(room.depth, 300, 5000),
    height: clampNumber(room.height, MIN_HEIGHT_MM, MAX_HEIGHT_MM)
  };
}

function getFixedRoomHeight(settings, fallbackHeight) {
  const fixedHeight = Number(settings?.roomHeightFixed);
  return Number.isFinite(fixedHeight) && fixedHeight > 0 ? fixedHeight : fallbackHeight;
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

function withAutoWoodTopPlacements(rawPlacements, activeWalls, postHeight, woodTopProduct) {
  const placements = Array.isArray(rawPlacements) ? rawPlacements : [];
  if (!woodTopProduct?.autoGenerated) return placements;
  const existingWoodTopKeys = new Set(placements
    .filter((placement) => (placement.componentType || placement.type) === "woodTop")
    .map((placement) => `${placement.wallId}:${Number(placement.bayIndex)}`));
  const autoPlacements = activeWalls.flatMap((wall) => wall.bays.map((bay) => {
    const key = `${wall.id}:${bay.bayIndex}`;
    if (existingWoodTopKeys.has(key)) return null;
    return {
      id: `auto:woodTop:${wall.id}:${bay.bayIndex}`,
      wallId: wall.id,
      bayIndex: bay.bayIndex,
      componentType: "woodTop",
      heightFromFloor: postHeight,
      quantity: 1,
      autoGenerated: true,
      heightLocked: true
    };
  }).filter(Boolean));
  return [...placements, ...autoPlacements];
}

function addPlacementDimensions(placement, activeWalls) {
  const wall = activeWalls.find((item) => item.id === placement.wallId);
  const bay = wall?.bays?.[placement.bayIndex];
  if (!wall || !bay) return placement;
  const componentCutLength = getCutLength(placement.componentType, bay.innerBayWidth);
  const moduleWidth = fixedModuleTypes.includes(placement.componentType)
    ? normalizeFixedModuleWidth(placement.moduleWidth || placement.standardWidth || bay.postCenterDistance)
    : null;
  const visualScaleWidth = getVisualScaleWidth(placement.componentType, bay.innerBayWidth, componentCutLength, moduleWidth);
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

function getCutLength(componentType, usableBayWidth) {
  if (componentType === "woodTop" || componentType === "woodShelf") return Math.round(usableBayWidth - 5);
  if (componentType === "singleRail" || componentType === "doubleRail") return Math.round(usableBayWidth - 15);
  if (componentType === "cabinet") return Math.round(usableBayWidth);
  return null;
}

function getVisualScaleWidth(componentType, innerBayWidth, componentCutLength) {
  const moduleWidth = arguments[3];
  const extraRailVisualWidth = 5;
  if (componentType === "trouserRack" || componentType === "pantsRack") return innerBayWidth;
  if (fixedModuleTypes.includes(componentType)) return moduleWidth || normalizeFixedModuleWidth(innerBayWidth);
  if (componentType === "woodTop" || componentType === "woodShelf") return componentCutLength;
  if (componentType === "singleRail" || componentType === "doubleRail") return innerBayWidth + extraRailVisualWidth;
  if (componentType === "cabinet") return innerBayWidth;
  return innerBayWidth;
}

export function normalizeFixedModuleWidth(width) {
  const value = Number(width);
  if (!Number.isFinite(value) || value <= 0) return fixedModuleWidths[0];
  return fixedModuleWidths.find((option) => option >= value) || fixedModuleWidths[fixedModuleWidths.length - 1];
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

function withSelectedDepthSizeRule(product, shelfDepth) {
  const depthSizedAccessorySkus = new Set([
    "JP-TOP-BRACKET",
    "JP-SHELF-BRACKET",
    "JP-HORIZONTAL-RAIL",
    "JP-CORNER-BRACKET"
  ]);
  if (!depthSizedAccessorySkus.has(product.sku)) return product;
  return { ...product, sizeRule: `${Number(shelfDepth)}mm` };
}

function chooseColor(product, config) {
  if (product.type === "post" || product.type === "singleRail" || product.type === "doubleRail" || product.material === "碳钢" || product.category?.includes("配件")) return config.frameColor;
  if (product.type === "woodTop" || product.type === "woodShelf" || product.type === "cabinet") return "Wood Brown";
  return product.colorOptions?.[0] || "Default Material";
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
