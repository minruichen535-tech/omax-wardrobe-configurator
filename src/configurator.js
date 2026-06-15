import { getBomCalculator, getCuttingRules } from "./series/index.js?v=wall-mounted-storage-library-types-20260615-01";

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
      const product = bomCalculator.resolvePlacementProduct?.({
        placement,
        productsByType,
        productByType,
        config
      }) || productByType[placement.componentType];
      return product ? { ...placement, productSku: product.sku } : placement;
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
