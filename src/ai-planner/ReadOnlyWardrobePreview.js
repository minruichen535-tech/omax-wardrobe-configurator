import React from "react";
import { createRoot } from "react-dom/client";
import { calculateDesign, createConfigFromPlannerPreset, createInitialConfig } from "../configurator.js?v=japanese-drawer-merchandising-20260703-01";
import { loadWorkbookData } from "../dataSource.js?v=ai-planner-preview-20260617-06";
import { getSeries } from "../config/productSeries.js?v=ai-planner-preview-20260617-06";
import { WardrobeScene } from "../scene.js?v=drawer-double-whole-model-20260707-01";
import {
  componentSupportsItem,
  getClearanceValue,
  getConflictRulesForItem,
  getPlacementRulesForItem,
  getStorageRulesDebug,
  getVisualRuleForItem,
  getVisualRequiredCount,
  hasConflictRule,
  loadStorageRules
} from "../rules/storageRules.js?v=storage-rules-20260625-01";

const h = React.createElement;
const dataCache = new Map();
const VISUAL_ASSET_VERSION = "position-assets-20260625-01";
const LONG_HANG_5_ASSET_VERSION = "20260627-origin-fix";
const LONG_HANG_RAIL_MIN_HEIGHT = 1450;
const SHOE_VISUAL_CAPACITY_PER_SET = 15;
const BAG_VISUAL_CAPACITY_PER_SET = 5;
const CLOTH1_BLOCKING_COMPONENTS = new Set([
  "woodShelf",
  "cabinet",
  "trouserRack",
  "jewelryBox",
  "shoeShelf",
  "shoesShelf",
  "drawer",
  "basket",
  "storageBox",
  "displayShelf",
  "glassShelf"
]);
const RAIL_COMPONENTS = new Set(["singleRail", "doubleRail"]);
const POSITION_ASSET_BASE = "/customer-home/position";
const SHORT_HANG_ASSETS = ["shortHang-5", "shortHang-7", "shortHang-10"];
const LIMITED_CLEARANCE_LONG_HANG_ASSET = "longHang-5";
const SHOE_ASSETS = ["shoePair-2", "shoePair-3"];
const BAG_ASSETS = ["bag-1", "bag-2"];
const LUGGAGE_ASSETS = ["luggage-large", "luggage-small"];
const VISUAL_ASSET_RULES = Object.freeze({
  shortHang: { target: "singleRail", maxPerRail: 1 },
  longHang: { target: "validLongHangRail", maxPerRail: 1 },
  shoe: { targetPriority: ["shoeShelf", "floorClearance"], capacityPerAsset: SHOE_VISUAL_CAPACITY_PER_SET },
  bagShelf: { targetPriority: ["highWoodShelf", "cabinetTop", "storageAccessoryOpenShelf"], capacityPerAsset: BAG_VISUAL_CAPACITY_PER_SET },
  bedding: { target: "woodTop", fallback: "nearestWoodTop" },
  luggage: { targetPriority: ["floorClearance", "woodTop"] },
  trouserPants: { target: "trouserRack", maxPerRack: 1 }
});
const VISUAL_TIER_LIMITS = Object.freeze({
  basic: { shortHang: 1, longHang: 1, shoe: 1, bagShelf: 1, luggage: 1, bedding: 1 },
  value: { shortHang: 2, longHang: 1, shoe: 2, bagShelf: 1, luggage: 1, bedding: 2 },
  premium: { shortHangRatio: 0.65, longHang: Infinity, shoe: 3, bagShelf: 2, luggage: 2, bedding: 3 }
});

export async function mountReadOnlyWardrobePreview(container, {
  plan,
  selectedProductSystem,
  mode = "modal",
  renderInfo = null,
  showPlannerVisualAssets = true
}) {
  if (!container) return () => {};
  const seriesId = plan?.configPreset?.productSystemId || selectedProductSystem?.id;
  const series = getSeries(seriesId);
  if (!series) {
    throw new Error(`Unknown product series: ${seriesId || "empty"}`);
  }

  container.replaceChildren();
  container.classList.add("is-loading");
  container.dataset.previewMode = mode;
  container.textContent = mode === "thumbnail" ? "生成预览中..." : "正在生成真实预览...";

  const data = await getPreviewData(series);
  await loadStorageRules();
  const preset = {
    source: "ai-planner-preview",
    configPreset: {
      ...(plan?.configPreset || {}),
      productSystemId: series.seriesId
    }
  };
  const config = createConfigFromPlannerPreset(preset, createInitialConfig(), data);
  const design = calculateDesign(config, data);
  const plannerVisualAssets = buildPlannerVisualAssets(config, preset.configPreset, plan, design);
  config.visualAssets = filterPlannerVisualAssetsForToggle(
    plannerVisualAssets.visualAssets,
    showPlannerVisualAssets
  );
  config.visualAssetDebug = plannerVisualAssets.debug;

  console.log("[ai-planner] readonly-preview", {
    mode,
    seriesId: series.seriesId,
    planType: plan?.planType,
    configPreset: preset.configPreset,
    room: config.room,
    layout: config.layout,
    placements: config.placements.map((placement) => ({
      id: placement.id,
      componentType: placement.componentType,
      wallId: placement.wallId,
      bayIndex: placement.bayIndex,
      heightFromFloor: placement.heightFromFloor,
      distanceFromWall: placement.distanceFromWall,
      wallMountedOffsetPosition: placement.wallMountedOffsetPosition,
      shelfDependency: placement.shelfDependency || null,
      linkedRailDependencyId: placement.linkedRailDependencyId || null
    })),
    showPlannerVisualAssets,
    visualAssets: config.visualAssets,
    visualAssetDebug: config.visualAssetDebug,
    bomCount: design.bom.length,
    total: design.total
  });

  container.classList.remove("is-loading");
  container.replaceChildren();
  const root = createRoot(container);
  root.render(h(WardrobeScene, {
    config: {
      ...config,
      selectedPlacementId: ""
    },
    design,
    series: data.series,
    selectedId: "",
    readOnly: true,
    previewMode: "ai-planner",
    renderInfo
  }));
  renderReadOnlyPreviewStamp(container, renderInfo);

  return () => {
    root.unmount();
  };
}

function filterPlannerVisualAssetsForToggle(visualAssets = [], showPlannerVisualAssets = true) {
  if (showPlannerVisualAssets) return visualAssets;
  return [];
}

function renderReadOnlyPreviewStamp(container, renderInfo) {
  if (!container || !renderInfo?.renderId) return;
  const old = container.querySelector("[data-ai-render-stamp]");
  old?.remove();
  const stamp = document.createElement("div");
  stamp.setAttribute("data-ai-render-stamp", "true");
  stamp.dataset.renderId = renderInfo.renderId;
  stamp.style.cssText = [
    "position:absolute",
    "top:10px",
    "left:10px",
    "z-index:20",
    "max-width:360px",
    "padding:8px 10px",
    "border-radius:8px",
    "background:rgba(255,255,255,0.86)",
    "color:#333",
    "font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    "box-shadow:0 4px 16px rgba(0,0,0,0.08)",
    "pointer-events:none",
    "white-space:pre-wrap"
  ].join(";");
  stamp.textContent = [
    `renderId: ${renderInfo.renderId}`,
    `planType: ${renderInfo.planType || "-"}`,
    `planTitle: ${renderInfo.planTitle || "-"}`,
    `planId: ${renderInfo.planId || "-"}`,
    `candidatePlanId: ${renderInfo.candidatePlanId || "-"}`,
    `visualDebug: ${renderInfo.visualDebugKey || "-"}`,
    "sceneJsImportUrl: -",
    "visualGeneratedCount: 0",
    "visualSkippedCount: 0"
  ].join("\n");
  container.style.position = container.style.position || "relative";
  container.appendChild(stamp);
  setTimeout(() => {
    if (container.isConnected && !container.querySelector(`[data-ai-render-stamp][data-render-id="${renderInfo.renderId}"]`)) {
      container.appendChild(stamp);
    }
    updateReadOnlyPreviewStampFromReport(stamp, renderInfo);
  }, 0);
  setTimeout(() => updateReadOnlyPreviewStampFromReport(stamp, renderInfo), 500);
  setTimeout(() => updateReadOnlyPreviewStampFromReport(stamp, renderInfo), 1500);
}

function updateReadOnlyPreviewStampFromReport(stamp, renderInfo) {
  if (!stamp?.isConnected || !renderInfo?.renderId) return;
  let report = null;
  try {
    report = JSON.parse(document.documentElement.getAttribute("data-model-report") || "null");
  } catch (error) {
    return;
  }
  if (report?.activeRender?.renderId !== renderInfo.renderId) return;
  stamp.textContent = [
    `renderId: ${renderInfo.renderId}`,
    `planType: ${renderInfo.planType || "-"}`,
    `planTitle: ${renderInfo.planTitle || "-"}`,
    `planId: ${renderInfo.planId || "-"}`,
    `candidatePlanId: ${renderInfo.candidatePlanId || "-"}`,
    `visualDebug: ${renderInfo.visualDebugKey || "-"}`,
    `sceneJsImportUrl: ${report.sceneJsImportUrl || "-"}`,
    `visualGeneratedCount: ${Array.isArray(report.visualAssets) ? report.visualAssets.length : 0}`,
    `visualSkippedCount: ${Array.isArray(report.visualAssetDiagnostics?.skippedVisualAssets) ? report.visualAssetDiagnostics.skippedVisualAssets.length : 0}`
  ].join("\n");
}

function getPreviewData(series) {
  if (!dataCache.has(series.seriesId)) {
    dataCache.set(series.seriesId, loadWorkbookData(series));
  }
  return dataCache.get(series.seriesId);
}

export function buildPlannerVisualAssets(config, configPreset = {}, plan = {}, design = null) {
  const storageRulesDebug = getStorageRulesDebug();
  const planType = normalizeVisualPlanType(plan?.planType || configPreset.planType);
  const explicitZoneLookup = buildExplicitPlacementZoneLookup(configPreset.explicitPlacements);
  const sourcePlacements = Array.isArray(design?.placements) && design.placements.length
    ? design.placements
    : config.placements || [];
  const placements = sourcePlacements.map((placement) => ({
    ...placement,
    zoneType: placement.zoneType || getExplicitPlacementZone(explicitZoneLookup, placement)
  }));
  const bayDiagnostics = buildLongHangBayDiagnostics(placements);
  const demandCounts = getVisualDemandCounts(configPreset, plan);
  const visualSlotPriority = buildVisualSlotPriorityDiagnostics(placements, bayDiagnostics);
  const shortHangSlots = getShortHangSlots(placements, bayDiagnostics);
  const longHangSlots = bayDiagnostics.filter((bay) => bay.isEligibleForCloth1);
  const shoeShelfSlots = getShoeShelfSlots(placements);
  const floorSlots = getFloorVisualSlots(placements, bayDiagnostics);
  const topSlots = getTopVisualSlots(placements, design);
  const bagSlots = getBagVisualSlots(placements);
  const trouserRackSlots = getTrouserRackSlots(placements);
  const shortHangCoreSlots = getCoreShortHangSlots(shortHangSlots, placements);
  const shortHangMaxVisualRailsByTier = getTierVisualLimit("shortHang", shortHangSlots.length, planType);
  const longHangMaxVisualRailsByTier = getTierVisualLimit("longHang", longHangSlots.length, planType);
  const shortHangAssets = buildShortHangVisualAssets(demandCounts.shortClothesCount, shortHangSlots, planType);
  const longHangAssets = buildLongHangVisualAssets(demandCounts.longClothesCount, longHangSlots, planType);
  const fallbackHangingResult = buildFallbackHangingVisualAssets({
    placements,
    bayDiagnostics,
    shortHangAssets,
    longHangAssets,
    demandCounts,
    planType
  });
  const fallbackHangingAssets = ensureVisibleRailHangingVisualAssets({
    placements,
    bayDiagnostics,
    existingAssets: [
      ...shortHangAssets,
      ...longHangAssets,
      ...fallbackHangingResult.visualAssets
    ],
    demandCounts,
    planType
  });
  const shoeAssets = buildShoeVisualAssets(demandCounts.shoesCount, shoeShelfSlots, floorSlots, planType);
  const usedFloorSlots = new Set(shoeAssets.filter((asset) => asset.targetKind === "floor").map(getVisualAssetSlotKey));
  const hangingVisualFloorSlots = new Set([...shortHangAssets, ...longHangAssets, ...fallbackHangingAssets].map((asset) => (
    `${asset.wallId}:${Number(asset.bayIndex) || 0}:floor`
  )));
  const bagAssets = buildBagVisualAssets(demandCounts.bagsCount, bagSlots, planType);
  const usedTopSlots = new Set(bagAssets.filter((asset) => asset.targetKind === "top").map(getVisualAssetSlotKey));
  const unoccupiedTopSlots = topSlots.filter((slot) => !usedTopSlots.has(getSlotKey(slot)));
  const luggageAssets = buildLuggageVisualAssets(
    demandCounts.luggageCount,
    floorSlots.filter((slot) => (
      !usedFloorSlots.has(getSlotKey(slot))
      && !hangingVisualFloorSlots.has(getSlotKey(slot))
    )),
    unoccupiedTopSlots,
    floorSlots,
    topSlots,
    trouserRackSlots,
    planType
  );
  const luggageTopSlots = new Set(luggageAssets
    .filter((asset) => asset.targetKind === "top")
    .map(getVisualAssetSlotKey));
  const beddingAssets = buildBeddingVisualAssets(
    demandCounts.beddingCount,
    unoccupiedTopSlots.filter((slot) => !luggageTopSlots.has(getSlotKey(slot))),
    planType
  );
  const trouserAssets = [];
  const visualAssets = [
    ...shortHangAssets,
    ...longHangAssets,
    ...fallbackHangingAssets,
    ...shoeAssets,
    ...bagAssets,
    ...luggageAssets,
    ...beddingAssets,
    ...trouserAssets
  ];
  const assetValidationTable = buildAssetValidationTable({
    demandCounts,
    shortHangAssets,
    shortHangSlots,
    longHangAssets,
    longHangSlots,
    fallbackHangingAssets,
    shoeAssets,
    bagAssets,
    bagSlots,
    beddingAssets,
    topSlots,
    luggageAssets,
    trouserAssets,
    trouserRackSlots,
    planType
  });
  const bayValidationTable = buildBayValidationTable(placements, visualAssets);
  const storageRulesTable = buildStorageRulesDebugTable({
    demandCounts,
    shoeAssets,
    shoeShelfSlots,
    floorSlots,
    bagAssets,
    bagSlots,
    beddingAssets,
    topSlots,
    luggageAssets,
    trouserAssets,
    trouserRackSlots,
    shortHangAssets,
    shortHangSlots,
    longHangAssets,
    longHangSlots,
    fallbackHangingAssets,
    planType
  });
  const uncoveredHangingRails = getUncoveredHangingRails(
    shortHangSlots,
    [...shortHangAssets, ...fallbackHangingAssets.filter((asset) => asset.visualCategory === "shortHang")],
    longHangSlots,
    [...longHangAssets, ...fallbackHangingAssets.filter((asset) => asset.visualCategory === "longHang")],
    planType
  );
  const debug = {
    rules: VISUAL_ASSET_RULES,
    planType,
    slotCount: {
      shortHang: shortHangSlots.length,
      coreShortHang: shortHangCoreSlots.length,
      longHang: longHangSlots.length
    },
    maxVisualRailsByTier: {
      shortHang: shortHangMaxVisualRailsByTier,
      longHang: longHangMaxVisualRailsByTier
    },
    generatedCountByTier: {
      planType,
      shortHang: shortHangAssets.length,
      longHang: longHangAssets.length,
      fallbackHanging: fallbackHangingAssets.length
    },
    visualSlotPriority,
    hangingRailCoverage: fallbackHangingResult.hangingRailCoverage,
    tierVisualStrategy: getTierVisualStrategy(planType),
    storageRules: storageRulesDebug,
    storageRulesLoaded: storageRulesDebug.storageRulesLoaded,
    loadedSheets: storageRulesDebug.loadedSheets,
    ruleCountBySheet: storageRulesDebug.ruleCountBySheet,
    parseWarnings: storageRulesDebug.parseWarnings,
    storageRulesDebugTable: storageRulesTable,
    ...demandCounts,
    requiredShortHangSets: getHangingVisualRequiredCount(shortHangSlots, demandCounts.shortClothesCount, planType, "shortHang"),
    placedShortHangSets: shortHangAssets.length,
    explicitLongHangZoneCount: bayDiagnostics.filter((bay) => bay.explicitRole === "longHangZone").length,
    inferredLongHangZoneCount: bayDiagnostics.filter((bay) => bay.isInferredLongHangZone).length,
    validLongHangZoneCount: bayDiagnostics.filter((bay) => bay.isEligibleForCloth1).length,
    cloth1EligibleBayIndexes: bayDiagnostics
      .filter((bay) => bay.isEligibleForCloth1)
      .map((bay) => bay.bayIndex),
    excludedDoubleHangBayIndexes: bayDiagnostics
      .filter((bay) => bay.excludedReason === "doubleHangZone")
      .map((bay) => bay.bayIndex),
    excludedBlockedBayIndexes: bayDiagnostics
      .filter((bay) => bay.excludedReason === "blockedClearance")
      .map((bay) => bay.bayIndex),
    shortHangSlotCount: shortHangSlots.length,
    shortHangRailCount: shortHangSlots.length,
    coreRailCount: shortHangCoreSlots.length + longHangSlots.length,
    coveredRailCount: shortHangAssets.length + longHangAssets.length + fallbackHangingAssets.length,
    shortHangVisualAssetCount: shortHangAssets.length + fallbackHangingAssets.filter((asset) => asset.visualCategory === "shortHang").length,
    shortHangGeneratedCount: shortHangAssets.length + fallbackHangingAssets.filter((asset) => asset.visualCategory === "shortHang").length,
    shortHangVisualRequired: getHangingVisualRequiredCount(shortHangSlots, demandCounts.shortClothesCount, planType, "shortHang"),
    shortHangVisualPlaced: shortHangAssets.length,
    longHangRailCount: longHangSlots.length,
    longHangSlotCount: longHangSlots.length,
    longHangGeneratedCount: longHangAssets.length,
    longHangVisualPlaced: longHangAssets.length,
    fallbackHangingGeneratedCount: fallbackHangingAssets.length,
    fallbackHangingAssets: fallbackHangingAssets.map((asset) => ({
      visualAssetType: asset.visualAssetType,
      visualCategory: asset.visualCategory,
      wallId: asset.wallId,
      bayIndex: asset.bayIndex,
      sourcePlacementId: asset.sourcePlacementId,
      sourceComponentType: asset.sourceComponentType,
      zoneType: asset.zoneType,
      placementReason: asset.placementReason,
      fallbackReason: asset.fallbackReason
    })),
    clothingVisualClamped: (
      (Number(demandCounts.shortClothesCount) || 0) > shortHangAssets.length
      || (Number(demandCounts.longClothesCount) || 0) > longHangAssets.length
    ),
    emptyShortHangRails: shortHangSlots
      .filter((slot) => !shortHangAssets.some((asset) => asset.sourcePlacementId === slot.sourcePlacementId))
      .map((slot) => `${slot.wallId}:${slot.bayIndex}@${slot.railHeight}`),
    uncoveredRails: uncoveredHangingRails.map((item) => ({
      id: item.id,
      bayIndex: item.bayIndex,
      railHeight: item.railHeight,
      visualCategory: item.visualCategory,
      reason: item.reason
    })),
    uncoveredReason: uncoveredHangingRails.reduce((acc, item) => {
      acc[item.id] = item.reason;
      return acc;
    }, {}),
    uncoveredRailIds: uncoveredHangingRails.map((item) => item.id),
    uncoveredRailReasons: uncoveredHangingRails
      .reduce((acc, item) => {
        acc[item.id] = item.reason;
        return acc;
      }, {}),
    shortHangDistribution: shortHangAssets.map((asset) => `${asset.wallId}:${asset.bayIndex}@${asset.railHeightFromFloor}`),
    longHangZoneCount: longHangSlots.length,
    longHangVisualAssetCount: longHangAssets.length,
    shoesDemand: demandCounts.shoesCount,
    shoeVisualAssetCount: shoeAssets.length,
    shoePlacedOnShelfCount: shoeAssets.filter((asset) => asset.targetKind === "shelf").length,
    shoePlacedOnFloorCount: shoeAssets.filter((asset) => asset.targetKind === "floor").length,
    floorShoeBayIndexes: shoeAssets.filter((asset) => asset.targetKind === "floor").map((asset) => asset.bayIndex),
    shoePlacementReason: shoeAssets.map((asset) => asset.placementReason),
    bagsDemand: demandCounts.bagsCount,
    bagVisualRequired: assetValidationTable.find((item) => item.assetType === "bagShelf")?.required || 0,
    bagRequired: assetValidationTable.find((item) => item.assetType === "bagShelf")?.required || 0,
    bagVisualPlaced: bagAssets.length,
    bagTargetBayIndexes: bagAssets.map((asset) => asset.bayIndex),
    bagSurfaceType: bagAssets.map((asset) => asset.placementReason),
    bagSkippedReason: demandCounts.bagsCount > 0 && !bagAssets.length ? "noValidBagSurface" : "",
    luggageDemand: demandCounts.luggageCount,
    luggageFloorSlotCount: floorSlots.length,
    luggageTopSlotCount: topSlots.length,
    luggagePlacementRule: getPlacementRulesForItem("luggage").map((rule) => `${rule.priority}:${rule.targetComponent}`).join(", "),
    luggageVisualRule: getVisualRuleLabel("luggage"),
    luggageGeneratedCount: luggageAssets.length,
    luggageSkippedCount: Math.max(0, getVisualRequiredCount("luggage", demandCounts.luggageCount, 1) - luggageAssets.length),
    luggagePlacedOnFloor: luggageAssets.filter((asset) => asset.targetKind === "floor").length,
    luggagePlacedOnTop: luggageAssets.filter((asset) => asset.targetKind === "top").length,
    luggagePlacementReason: luggageAssets.map((asset) => asset.placementReason),
    luggageVisualAssetCount: luggageAssets.length,
    luggageRequired: demandCounts.luggageCount,
    luggageSkippedReason: luggageAssets.length < demandCounts.luggageCount ? "noValidLuggageSurface" : "",
    beddingCount: demandCounts.beddingCount,
    beddingPlacedCount: beddingAssets.length,
    beddingTargetTopBayIndexes: beddingAssets.map((asset) => asset.bayIndex),
    woodTopCandidateCount: topSlots.length,
    noTopShelfForBedding: demandCounts.beddingCount > 0 && !topSlots.length,
    beddingVisualAssetCount: beddingAssets.length,
    beddingRequired: demandCounts.beddingCount,
    beddingSkipped: Math.max(0, demandCounts.beddingCount - beddingAssets.length),
    beddingSkippedReason: beddingAssets.length < demandCounts.beddingCount ? "skippedDueToNoTopSpace" : "",
    trouserRackCount: trouserRackSlots.length,
    trouserVisualAssetCount: trouserAssets.length,
    goldenBayTable: bayValidationTable,
    goldenAssetTable: assetValidationTable,
    ruleCheckTable: buildRuleCheckTable({
      placements,
      visualAssets,
      shortHangAssets,
      shortHangSlots,
      longHangAssets,
      longHangSlots,
      bagAssets,
      beddingAssets,
      luggageAssets,
      trouserAssets,
      trouserRackSlots,
      assetValidationTable
    }),
    bays: bayDiagnostics,
    visualAssets
  };
  if (isPlannerDebugEnabled()) {
    console.group("[ai-planner] Golden Visual Assets Debug");
    console.table(bayValidationTable);
    console.table(assetValidationTable);
    console.table(storageRulesTable);
    console.table(debug.ruleCheckTable);
    console.groupEnd();
  }
  console.log("[ai-planner] visual-assets-debug", debug);
  return { visualAssets, debug };
}

function normalizeVisualPlanType(planType) {
  if (planType === "premium") return "premium";
  if (planType === "value") return "value";
  return "basic";
}

function getMaxVisualRailsByTier(slotCount = 0, planType = "basic") {
  return getTierVisualLimit("shortHang", slotCount, planType);
}

function getTierVisualLimit(category, availableCount = 0, planType = "basic") {
  const count = Math.max(0, Number(availableCount) || 0);
  if (!count) return 0;
  const normalizedPlanType = normalizeVisualPlanType(planType);
  const limits = VISUAL_TIER_LIMITS[normalizedPlanType] || VISUAL_TIER_LIMITS.basic;
  if (category === "shortHang" && normalizedPlanType === "premium") {
    return Math.min(count, Math.max(1, Math.min(count - 1, Math.ceil(count * limits.shortHangRatio))));
  }
  const limit = limits[category];
  if (limit === Infinity) return count;
  return Math.min(count, Math.max(0, Number(limit) || 0));
}

function getTierLimitedHangingSlots(slots = [], planType = "basic", options = {}) {
  const orderedSlots = options.distributeAcrossBays === false
    ? [...slots]
    : distributeShortHangSlotsAcrossBays(slots);
  const limit = getTierVisualLimit(options.category || "shortHang", orderedSlots.length, planType);
  return orderedSlots.slice(0, limit);
}

function getCoreShortHangSlots(slots = [], placements = []) {
  const slotsByBay = new Map();
  slots.forEach((slot) => {
    const key = `${slot.wallId}:${slot.bayIndex}`;
    if (!slotsByBay.has(key)) slotsByBay.set(key, []);
    slotsByBay.get(key).push(slot);
  });
  const visualFunctionalComponents = new Set(["cabinet", "trouserRack", "jewelryBox", "woodShelf", "glassShelf", "shoeShelf", "shoesShelf"]);
  const coreSlots = [];
  slotsByBay.forEach((baySlots, key) => {
    const [wallId, bayIndexText] = key.split(":");
    const bayPlacements = placements.filter((placement) => (
      (placement.wallId || "back") === wallId
      && Number(placement.bayIndex) === Number(bayIndexText)
    ));
    const hasOtherCoreFunction = bayPlacements.some((placement) => visualFunctionalComponents.has(placement.componentType));
    if (baySlots.length === 1 || !hasOtherCoreFunction) {
      coreSlots.push(...baySlots);
    } else {
      coreSlots.push(baySlots[0]);
    }
  });
  return coreSlots;
}

function getTierVisualStrategy(planType = "basic") {
  const normalizedPlanType = normalizeVisualPlanType(planType);
  if (normalizedPlanType === "premium") {
    return "premiumHighFillWithoutForcingAllShortRails";
  }
  if (normalizedPlanType === "value") {
    return "valueMediumFill";
  }
  return "basicCoreVisualOnly";
}

function buildShortHangVisualAssets(shortClothesCount, slots, planType = "basic") {
  const shouldShow = Math.max(0, Number(shortClothesCount) || 0) > 0;
  const distributedSlots = shouldShow ? getShortHangVisualSlots(slots, planType) : [];
  return distributedSlots.map((slot, index) => {
    const assetName = getShortHangAssetNameForSlot(planType, slot, index);
    return createVisualAsset({
      visualCategory: "shortHang",
      visualAssetType: assetName,
      zoneType: "shortHangZone",
      targetKind: "rail",
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/${assetName}.glb?v=${VISUAL_ASSET_VERSION}`
    });
  });
}

function getShortHangVisualSlots(slots = [], planType = "basic") {
  const tierLimitedSlots = getTierLimitedHangingSlots(slots, planType, { category: "shortHang" });
  const selectedIds = new Set(tierLimitedSlots.map((slot) => slot.sourcePlacementId).filter(Boolean));
  const result = [...tierLimitedSlots];
  const selectedBayKeys = new Set(tierLimitedSlots.map((slot) => `${slot.wallId}:${slot.bayIndex}`));
  slots.forEach((slot) => {
    const slotId = slot.sourcePlacementId || "";
    if (!slotId || selectedIds.has(slotId)) return;
    if (!selectedBayKeys.has(`${slot.wallId}:${slot.bayIndex}`)) return;
    if (!isUpperShortHangRailSlot(slot)) return;
    if (!hasLowerShortHangRailSlot(slots, slot)) return;
    result.push(slot);
    selectedIds.add(slotId);
  });
  return result;
}

function getShortHangAssetNameForTier(planType = "basic", index = 0) {
  const normalizedPlanType = normalizeVisualPlanType(planType);
  if (normalizedPlanType === "premium") return "shortHang-10";
  if (normalizedPlanType === "value") return "shortHang-7";
  return SHORT_HANG_ASSETS[index % Math.min(1, SHORT_HANG_ASSETS.length)] || "shortHang-5";
}

function getShortHangAssetNameForSlot(planType = "basic", slot = {}, index = 0) {
  const normalizedPlanType = normalizeVisualPlanType(planType);
  if (isUpperShortHangRailSlot(slot) && (normalizedPlanType === "value" || normalizedPlanType === "premium")) {
    return "shortHang-7";
  }
  return getShortHangAssetNameForTier(planType, index);
}

function isUpperShortHangRailSlot(slot = {}) {
  return Number(slot.railHeight || slot.heightFromFloor || 0) >= 1800
    && (slot.zoneType === "shortHangZone" || slot.templateRole === "shortHangZone");
}

function hasLowerShortHangRailSlot(slots = [], upperSlot = {}) {
  return slots.some((slot) => (
    slot.wallId === upperSlot.wallId
    && Number(slot.bayIndex) === Number(upperSlot.bayIndex)
    && Number(slot.railHeight || slot.heightFromFloor || 0) >= 900
    && Number(slot.railHeight || slot.heightFromFloor || 0) <= 1200
  ));
}

function distributeShortHangSlotsAcrossBays(slots = []) {
  const byBay = new Map();
  slots.forEach((slot) => {
    const key = `${slot.wallId}:${slot.bayIndex}`;
    if (!byBay.has(key)) byBay.set(key, []);
    byBay.get(key).push(slot);
  });
  const bays = Array.from(byBay.values());
  const distributed = [];
  const maxRailCount = Math.max(0, ...bays.map((items) => items.length));
  for (let railIndex = 0; railIndex < maxRailCount; railIndex += 1) {
    bays.forEach((items) => {
      if (items[railIndex]) distributed.push(items[railIndex]);
    });
  }
  return distributed;
}

function getHangingVisualRequiredCount(slots = [], demandCount = 0, planType = "basic", category = "shortHang") {
  if (Math.max(0, Number(demandCount) || 0) <= 0) return 0;
  return getTierVisualLimit(category, slots.length, planType);
}

function getHangingSlotId(slot, category) {
  return slot.sourcePlacementId
    || slot.sourceRailId
    || `${category}:${slot.wallId}:${slot.bayIndex}:${slot.railHeight || slot.heightFromFloor || 0}`;
}

function getUncoveredHangingRails(shortHangSlots = [], shortHangAssets = [], longHangSlots = [], longHangAssets = [], planType = "basic") {
  const coveredShortIds = new Set(shortHangAssets.map((asset) => asset.sourcePlacementId).filter(Boolean));
  const coveredLongIds = new Set(longHangAssets.map((asset) => asset.sourcePlacementId).filter(Boolean));
  const normalizedPlanType = normalizeVisualPlanType(planType);
  return [
    ...shortHangSlots
      .filter((slot) => !coveredShortIds.has(getHangingSlotId(slot, "shortHang")))
      .map((slot) => ({
        id: getHangingSlotId(slot, "shortHang"),
        bayIndex: slot.bayIndex,
        railHeight: slot.railHeight || slot.heightFromFloor || 0,
        visualCategory: "shortHang",
        reason: normalizedPlanType === "premium" ? "shortHangVisualNotGenerated" : `${normalizedPlanType}TierVisualLimit`
      })),
    ...longHangSlots
      .filter((slot) => !coveredLongIds.has(getHangingSlotId(slot, "longHang")))
      .map((slot) => ({
        id: getHangingSlotId(slot, "longHang"),
        bayIndex: slot.bayIndex,
        railHeight: slot.railHeight || slot.heightFromFloor || 0,
        visualCategory: "longHang",
        reason: slot.excludedReason || (normalizedPlanType === "premium" ? "longHangVisualNotGenerated" : `${normalizedPlanType}TierVisualLimit`)
      }))
  ];
}

function buildFallbackHangingVisualAssets({
  placements = [],
  bayDiagnostics = [],
  shortHangAssets = [],
  longHangAssets = [],
  demandCounts = {},
  planType = "basic"
} = {}) {
  const allRails = getAllHangingRailSlots(placements, bayDiagnostics);
  const coveredRailIds = new Set([...shortHangAssets, ...longHangAssets]
    .map((asset) => asset.sourcePlacementId)
    .filter(Boolean));
  const visualAssets = [];
  const skippedFallbacks = [];

  allRails.forEach((rail) => {
    const railId = rail.sourcePlacementId || "";
    if (!railId) {
      skippedFallbacks.push({
        railId,
        wallId: rail.wallId,
        bayIndex: rail.bayIndex,
        componentType: rail.sourceComponentType,
        reason: "missingSourcePlacementId"
      });
      return;
    }
    if (coveredRailIds.has(railId)) return;

    const fallback = createFallbackHangingVisualAsset({
      rail,
      demandCounts,
      planType,
      index: coveredRailIds.size + visualAssets.length
    });
    if (!fallback) {
      skippedFallbacks.push({
        railId,
        wallId: rail.wallId,
        bayIndex: rail.bayIndex,
        componentType: rail.sourceComponentType,
        reason: "noFallbackVisualForRail"
      });
      return;
    }
    visualAssets.push(fallback);
    coveredRailIds.add(railId);
  });

  const coveredRails = allRails.filter((rail) => coveredRailIds.has(rail.sourcePlacementId));
  const uncoveredRails = allRails.filter((rail) => !coveredRailIds.has(rail.sourcePlacementId));
  const uncoveredReasons = Object.fromEntries([
    ...uncoveredRails.map((rail) => [
      rail.sourcePlacementId || `${rail.wallId}:${rail.bayIndex}:${rail.sourceComponentType}`,
      "fallbackNotGenerated"
    ]),
    ...skippedFallbacks.map((item) => [
      item.railId || `${item.wallId}:${item.bayIndex}:${item.componentType}`,
      item.reason
    ])
  ]);

  return {
    visualAssets,
    hangingRailCoverage: {
      totalRails: allRails.length,
      coveredRails: coveredRails.length,
      uncoveredRails: uncoveredRails.map((rail) => ({
        railId: rail.sourcePlacementId,
        wallId: rail.wallId,
        bayIndex: rail.bayIndex,
        componentType: rail.sourceComponentType,
        zoneType: rail.zoneType,
        templateZone: rail.templateZone,
        templateRole: rail.templateRole,
        railRole: rail.railRole,
        railHeight: rail.railHeight
      })),
      fallbackGenerated: visualAssets.map((asset) => ({
        visualAssetType: asset.visualAssetType,
        visualCategory: asset.visualCategory,
        originalVisualAssetType: asset.originalVisualAssetType || "",
        replacementVisualAssetType: asset.replacementVisualAssetType || "",
        replacementReason: asset.replacementReason || "",
        sourcePlacementId: asset.sourcePlacementId,
        sourceComponentType: asset.sourceComponentType,
        wallId: asset.wallId,
        bayIndex: asset.bayIndex,
        zoneType: asset.zoneType,
        fallbackReason: asset.fallbackReason
      })),
      skippedFallbacks,
      uncoveredReasons
    }
  };
}

function ensureVisibleRailHangingVisualAssets({
  placements = [],
  bayDiagnostics = [],
  existingAssets = [],
  demandCounts = {},
  planType = "basic"
} = {}) {
  const coveredRailIds = new Set(existingAssets
    .map((asset) => asset.sourcePlacementId)
    .filter(Boolean));
  const assets = [...existingAssets.filter((asset) => asset.isFallbackHangingVisual === true)];
  const visibleRails = getAllHangingRailSlots(placements, bayDiagnostics)
    .filter((rail) => ["singleRail", "doubleRail"].includes(rail.sourceComponentType));

  visibleRails.forEach((rail) => {
    const railId = rail.sourcePlacementId || "";
    if (!railId || coveredRailIds.has(railId)) return;
    const fallback = createFallbackHangingVisualAsset({
      rail,
      demandCounts,
      planType,
      index: coveredRailIds.size + assets.length
    });
    if (!fallback) return;
    assets.push(fallback);
    coveredRailIds.add(railId);
  });

  return assets;
}

function getAllHangingRailSlots(placements = [], bayDiagnostics = []) {
  const bayDiagnosticsByKey = new Map(bayDiagnostics.map((bay) => [
    `${bay.wallId}:${bay.bayIndex}`,
    bay
  ]));
  return placements
    .filter((placement) => ["singleRail", "doubleRail", "trouserRack"].includes(placement.componentType))
    .sort((a, b) => String(a.wallId || "back").localeCompare(String(b.wallId || "back"))
      || Number(a.bayIndex) - Number(b.bayIndex)
      || Number(a.heightFromFloor) - Number(b.heightFromFloor))
    .map((rail) => {
      const wallId = rail.wallId || "back";
      const bayIndex = Number(rail.bayIndex) || 0;
      const bayDiagnostic = bayDiagnosticsByKey.get(`${wallId}:${bayIndex}`) || null;
      return {
        wallId,
        bayIndex,
        sourcePlacementId: rail.id || "",
        sourceComponentType: rail.componentType,
        railHeight: Number(rail.heightFromFloor) || 0,
        heightFromFloor: Number(rail.heightFromFloor) || 0,
        zoneType: rail.zoneType || "",
        templateZone: rail.templateZone || "",
        templateRole: rail.templateRole || "",
        blockingComponentsInClearance: bayDiagnostic?.blockingComponentsInClearance || [],
        excludedReason: bayDiagnostic?.excludedReason || "",
        isEligibleForCloth1: bayDiagnostic?.isEligibleForCloth1 === true,
        railRole: getHangingRailRole(rail, bayDiagnostic)
      };
    });
}

function getHangingRailRole(rail, bayDiagnostic) {
  if (rail.componentType === "trouserRack") return "trouserRack";
  if (rail.zoneType === "longHangZone") {
    return "longHang";
  }
  if (rail.zoneType === "shortHangZone"
    || rail.componentType === "doubleRail"
    || Number(rail.heightFromFloor) < LONG_HANG_RAIL_MIN_HEIGHT) {
    return "shortHang";
  }
  if (bayDiagnostic?.sourceRailId === rail.id
    || (rail.componentType === "singleRail" && Number(rail.heightFromFloor) >= LONG_HANG_RAIL_MIN_HEIGHT)) {
    return "longHang";
  }
  return "generic";
}

function createFallbackHangingVisualAsset({ rail, demandCounts, planType, index }) {
  if (rail.railRole === "trouserRack") {
    return createVisualAsset({
      visualCategory: "trouser",
      visualAssetType: "trouser-5",
      zoneType: "trouserZone",
      targetKind: "rail",
      slot: {
        ...rail,
        fallbackReason: "emptyTrouserRackFallback",
        isFallbackHangingVisual: true
      },
      index,
      assetPath: `${POSITION_ASSET_BASE}/trouser-5.glb?v=${VISUAL_ASSET_VERSION}`,
      placementReason: "fallbackEmptyTrouserRack"
    });
  }

  if (rail.railRole === "longHang" && Number(demandCounts.longClothesCount || 0) > 0) {
    const variant = getFallbackLongHangVariant(rail);
    return createVisualAsset({
      visualCategory: "longHang",
      visualAssetType: variant.visualAssetType,
      zoneType: "longHangZone",
      targetKind: "rail",
      slot: {
        ...rail,
        fallbackReason: "emptyLongHangRailWithLongClothesDemand",
        isFallbackHangingVisual: true,
        originalVisualAssetType: variant.originalVisualAssetType,
        replacementVisualAssetType: variant.replacementVisualAssetType,
        replacementReason: variant.replacementReason
      },
      index,
      assetPath: `${POSITION_ASSET_BASE}/${variant.visualAssetType}.glb?v=${getLongHangAssetVersion(variant.visualAssetType)}`,
      placementReason: "fallbackEmptyLongHangRail"
    });
  }

  const assetName = getShortHangAssetNameForSlot(planType, rail, index);
  return createVisualAsset({
    visualCategory: "shortHang",
    visualAssetType: assetName,
    zoneType: rail.railRole === "longHang" ? "genericHangingZone" : "shortHangZone",
    targetKind: "rail",
    slot: {
      ...rail,
      fallbackReason: rail.railRole === "longHang"
        ? "emptyLongHangRailWithoutLongClothesDemand"
        : "emptyHangingRailFallback",
      isFallbackHangingVisual: true
    },
    index,
    assetPath: `${POSITION_ASSET_BASE}/${assetName}.glb?v=${VISUAL_ASSET_VERSION}`,
    placementReason: "fallbackEmptyHangingRail"
  });
}

function buildLongHangVisualAssets(longClothesCount, slots, planType = "basic") {
  const shouldShow = Math.max(0, Number(longClothesCount) || 0) > 0;
  if (!slots.length || !shouldShow) return [];
  return getTierLimitedHangingSlots(slots, planType, { category: "longHang" }).map((slot, index) => {
    return createVisualAsset({
      visualCategory: "longHang",
      visualAssetType: "longHang-4",
      zoneType: "longHangZone",
      targetKind: "rail",
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/longHang-4.glb?v=${VISUAL_ASSET_VERSION}`
    });
  });
}

function buildTrouserVisualAssets(slots) {
  return slots.map((slot, index) => createVisualAsset({
    visualCategory: "trouser",
    visualAssetType: "trouser-5",
    zoneType: "trouserZone",
    targetKind: "rail",
    slot,
    index,
    assetPath: `${POSITION_ASSET_BASE}/trouser-5.glb?v=${VISUAL_ASSET_VERSION}`,
    placementReason: "trouserRack"
  }));
}

function buildShoeVisualAssets(shoesCount, shelfSlots, floorSlots, planType = "basic") {
  const requiredSets = Math.min(
    getVisualRequiredCount("shoes", shoesCount, SHOE_VISUAL_CAPACITY_PER_SET),
    getTierVisualLimit("shoe", shelfSlots.length + floorSlots.length, planType)
  );
  if (requiredSets <= 0) return [];
  const assets = [];
  const targetRules = getPlacementRulesForItem("shoes");
  const shelfFirst = targetRules.findIndex((rule) => rule.targetComponent === "woodShelf");
  const floorFirst = targetRules.findIndex((rule) => rule.targetComponent === "floor");
  const orderedShelfSlots = shelfFirst >= 0 && (floorFirst < 0 || shelfFirst < floorFirst) ? shelfSlots : [];
  const orderedFloorSlots = floorFirst >= 0 ? floorSlots : [];
  for (let index = 0; index < requiredSets; index += 1) {
    const assetName = SHOE_ASSETS[index % SHOE_ASSETS.length];
    const shelfSlot = orderedShelfSlots[index];
    const floorSlot = orderedFloorSlots[index - orderedShelfSlots.length];
    const slot = shelfSlot || floorSlot;
    if (!slot) break;
    assets.push(createVisualAsset({
      visualCategory: "shoe",
      visualAssetType: assetName,
      zoneType: shelfSlot ? "shoeZone" : "floorShoeZone",
      targetKind: shelfSlot ? "shelf" : "floor",
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/${assetName}.glb?v=${VISUAL_ASSET_VERSION}`,
      placementReason: shelfSlot ? "shoeShelfZone" : floorSlot.placementReason
    }));
  }
  return assets;
}

function buildBagVisualAssets(bagsCount, slots, planType = "basic") {
  const requiredSets = Math.min(
    getVisualRequiredCount("bags", bagsCount, BAG_VISUAL_CAPACITY_PER_SET),
    getTierVisualLimit("bagShelf", slots.length, planType)
  );
  return slots.slice(0, requiredSets).map((slot, index) => {
    const assetName = BAG_ASSETS[index % BAG_ASSETS.length];
    return createVisualAsset({
      visualCategory: "bagShelf",
      visualAssetType: assetName,
      zoneType: "bagZone",
      targetKind: slot.targetKind,
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/${assetName}.glb?v=${VISUAL_ASSET_VERSION}`,
      placementReason: slot.placementReason
    });
  });
}

function buildLuggageVisualAssets(luggageCount, floorSlots, topSlots, fallbackFloorSlots = [], fallbackTopSlots = [], trouserRackSlots = [], planType = "basic") {
  const count = Math.min(
    getVisualRequiredCount("luggage", luggageCount, 1),
    getTierVisualLimit("luggage", floorSlots.length + topSlots.length + fallbackFloorSlots.length + fallbackTopSlots.length, planType)
  );
  const targetRules = getPlacementRulesForItem("luggage");
  const floorAllowed = targetRules.some((rule) => rule.targetComponent === "floor");
  const topAllowed = targetRules.some((rule) => rule.targetComponent === "woodTop");
  const trouserFloorKeys = new Set(trouserRackSlots.map(getSlotKey));
  const primaryFloorCandidates = floorSlots.filter((slot) => !trouserFloorKeys.has(getSlotKey(slot)));
  const fallbackFloorCandidates = fallbackFloorSlots.filter((slot) => !trouserFloorKeys.has(getSlotKey(slot)));
  const floorCandidates = primaryFloorCandidates.length ? primaryFloorCandidates : fallbackFloorCandidates;
  const topCandidates = topSlots.length ? topSlots : fallbackTopSlots;
  const avoidedTrouserFloor = trouserFloorKeys.size > 0 && (floorSlots.length !== primaryFloorCandidates.length
    || fallbackFloorSlots.length !== fallbackFloorCandidates.length);
  let floorIndex = 0;
  let topIndex = 0;
  return Array.from({ length: count }, (_, index) => {
    const preferTop = normalizeVisualPlanType(planType) === "premium";
    const topSlot = topAllowed ? topCandidates[topIndex] || null : null;
    const floorSlot = floorAllowed ? floorCandidates[floorIndex] || null : null;
    const sourceSlot = preferTop ? topSlot || floorSlot : floorSlot || topSlot;
    const useFloor = Boolean(floorSlot);
    const assetName = useFloor ? LUGGAGE_ASSETS[index % LUGGAGE_ASSETS.length] : "luggage-small";
    const useSourceFloor = sourceSlot === floorSlot;
    const slot = sourceSlot ? {
      ...sourceSlot,
      luggageLargeConflictWithTrouser: avoidedTrouserFloor,
      luggageMovedToTopBecauseTrouserConflict: avoidedTrouserFloor && !useSourceFloor,
      luggageChangedLargeToSmall: avoidedTrouserFloor && !useSourceFloor,
      luggageMovedToOtherFloorBay: avoidedTrouserFloor && useSourceFloor
    } : null;
    if (!slot) return null;
    if (useSourceFloor) floorIndex += 1;
    else topIndex += 1;
    return createVisualAsset({
      visualCategory: "luggage",
      visualAssetType: useSourceFloor ? assetName : "luggage-small",
      zoneType: useSourceFloor ? "luggageZone" : "topLuggageZone",
      targetKind: useSourceFloor ? "floor" : "top",
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/${useSourceFloor ? assetName : "luggage-small"}.glb?v=${VISUAL_ASSET_VERSION}`,
      placementReason: useSourceFloor ? "bottomClearance" : "woodTopAbove"
    });
  }).filter(Boolean);
}

function buildBeddingVisualAssets(beddingCount, topSlots, planType = "basic") {
  const count = Math.min(
    getVisualRequiredCount("bedding", beddingCount, 1),
    getTierVisualLimit("bedding", topSlots.length, planType)
  );
  if (!topSlots.length || count <= 0) return [];
  return topSlots.slice(0, count).map((slot, index) => {
    return createVisualAsset({
      visualCategory: "bedding",
      visualAssetType: "bedding",
      zoneType: "beddingZone",
      targetKind: "top",
      slot,
      index,
      assetPath: `${POSITION_ASSET_BASE}/bedding.glb?v=${VISUAL_ASSET_VERSION}`,
      placementReason: "woodTopAbove"
    });
  });
}

function createVisualAsset({ visualCategory, visualAssetType, zoneType, targetKind, slot, index, assetPath, placementReason = "" }) {
  const sourcePlacementId = slot.sourcePlacementId || slot.sourceRailId || "";
  const sourceComponentType = slot.sourceComponentType
    || (slot.sourceRailId ? "singleRail" : "");
  const attachedZoneId = `${slot.wallId}:${slot.bayIndex}:${zoneType}:${targetKind}:${sourcePlacementId || "bay"}`;
  return {
    id: `visual:${visualCategory}:${visualAssetType}:${slot.wallId}:${slot.bayIndex}:${index}`,
    visualCategory,
    visualAssetType,
    zoneType,
    targetKind,
    attachedZoneId,
    sourcePlacementId,
    sourceComponentType,
    wallId: slot.wallId,
    bayIndex: slot.bayIndex,
    railHeightFromFloor: slot.railHeight,
    heightFromFloor: slot.heightFromFloor,
    instanceIndex: index,
    visualSlotIndex: Number(slot.visualSlotIndex) || 0,
    visualSlotCount: Number(slot.visualSlotCount) || 1,
    assetPath,
    placementReason,
    ruleSource: "StorageRules.xlsx",
    fallbackReason: slot.fallbackReason || "",
    isFallbackHangingVisual: slot.isFallbackHangingVisual === true,
    fallbackTopUsed: slot.fallbackTopUsed === true,
    luggageLargeConflictWithTrouser: slot.luggageLargeConflictWithTrouser === true,
    luggageMovedToTopBecauseTrouserConflict: slot.luggageMovedToTopBecauseTrouserConflict === true,
    luggageChangedLargeToSmall: slot.luggageChangedLargeToSmall === true,
    luggageMovedToOtherFloorBay: slot.luggageMovedToOtherFloorBay === true,
    originalVisualAssetType: slot.originalVisualAssetType || "",
    replacementVisualAssetType: slot.replacementVisualAssetType || "",
    replacementReason: slot.replacementReason || ""
  };
}

function getFallbackLongHangVariant(rail) {
  const replacementReason = getLongHangReplacementReason(rail);
  if (!replacementReason) {
    return {
      visualAssetType: "longHang-4",
      originalVisualAssetType: "",
      replacementVisualAssetType: "",
      replacementReason: ""
    };
  }
  return {
    visualAssetType: LIMITED_CLEARANCE_LONG_HANG_ASSET,
    originalVisualAssetType: "longHang-4",
    replacementVisualAssetType: LIMITED_CLEARANCE_LONG_HANG_ASSET,
    replacementReason
  };
}

function getLongHangAssetVersion(assetName) {
  return assetName === LIMITED_CLEARANCE_LONG_HANG_ASSET
    ? LONG_HANG_5_ASSET_VERSION
    : VISUAL_ASSET_VERSION;
}

function getLongHangReplacementReason(rail) {
  const blockingTypes = (rail.blockingComponentsInClearance || [])
    .map((item) => item.componentType)
    .filter(Boolean);
  if (blockingTypes.some((type) => ["woodShelf", "shoeShelf", "shoesShelf", "displayShelf", "glassShelf"].includes(type))) {
    return "longHang4WouldOverlapShelf";
  }
  if (blockingTypes.some((type) => ["cabinet", "drawer", "jewelryBox", "basket", "storageBox"].includes(type))) {
    return "longHang4WouldOverlapCabinet";
  }
  const zone = rail.templateZone || rail.templateRole || rail.zoneType || "";
  if (["storageAccessoryZone", "shoeShelfZone", "storageZone", "shoeZone"].includes(zone)) {
    return "limitedClearanceUseLongHang5";
  }
  if (rail.excludedReason === "blockedClearance") {
    return "limitedClearanceUseLongHang5";
  }
  return "";
}

function buildLongHangBayDiagnostics(placements) {
  const bayMap = new Map();
  placements.forEach((placement) => {
    const key = getBayKey(placement);
    if (!bayMap.has(key)) {
      bayMap.set(key, {
        wallId: placement.wallId || "back",
        bayIndex: Number(placement.bayIndex) || 0,
        placements: []
      });
    }
    bayMap.get(key).placements.push(placement);
  });
  return Array.from(bayMap.values())
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId)) || a.bayIndex - b.bayIndex)
    .map((bay) => isLongHangZoneByClearance(bay, placements));
}

function getShortHangSlots(placements, bayDiagnostics = []) {
  const bayDiagnosticsByKey = buildBayDiagnosticsLookup(bayDiagnostics);
  const targetComponents = getPlacementRulesForItem("shortClothes")
    .map((rule) => rule.targetComponent)
    .filter(Boolean);
  return placements
    .filter((placement) => targetComponents.includes(placement.componentType)
      || componentSupportsItem(placement.componentType, "shortClothes"))
    .filter((placement) => {
      const height = Number(placement.heightFromFloor) || 0;
      return placement.zoneType === "shortHangZone" || height < LONG_HANG_RAIL_MIN_HEIGHT;
    })
    .filter((placement) => !getVisualSlotPriorityDecision(placement, bayDiagnosticsByKey).excludedFromShortHang)
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId))
      || Number(a.bayIndex) - Number(b.bayIndex)
      || Number(a.heightFromFloor) - Number(b.heightFromFloor))
    .map((rail) => ({
      wallId: rail.wallId || "back",
      bayIndex: Number(rail.bayIndex) || 0,
      sourcePlacementId: rail.id || "",
      sourceComponentType: rail.componentType,
      railHeight: Number(rail.heightFromFloor) || 0,
      heightFromFloor: Number(rail.heightFromFloor) || 0,
      zoneType: rail.zoneType || "",
      templateZone: rail.templateZone || "",
      templateRole: rail.templateRole || "",
      isSupplementalRail: false
    }));
}

function buildVisualSlotPriorityDiagnostics(placements = [], bayDiagnostics = []) {
  const bayDiagnosticsByKey = buildBayDiagnosticsLookup(bayDiagnostics);
  return placements
    .filter((placement) => ["singleRail", "doubleRail"].includes(placement.componentType))
    .sort((a, b) => String(a.wallId || "back").localeCompare(String(b.wallId || "back"))
      || Number(a.bayIndex) - Number(b.bayIndex)
      || Number(a.heightFromFloor) - Number(b.heightFromFloor))
    .map((placement) => {
      const decision = getVisualSlotPriorityDecision(placement, bayDiagnosticsByKey);
      return {
        railId: placement.id || "",
        bayIndex: Number(placement.bayIndex) || 0,
        heightFromFloor: Number(placement.heightFromFloor) || 0,
        excludedFromShortHang: decision.excludedFromShortHang,
        exclusionReason: decision.exclusionReason,
        reservedForLongHang: decision.reservedForLongHang
      };
    });
}

function buildBayDiagnosticsLookup(bayDiagnostics = []) {
  return new Map(bayDiagnostics.map((bay) => [
    `${bay.wallId}:${bay.bayIndex}`,
    bay
  ]));
}

function getVisualSlotPriorityDecision(placement, bayDiagnosticsByKey) {
  const wallId = placement.wallId || "back";
  const bayIndex = Number(placement.bayIndex) || 0;
  const height = Number(placement.heightFromFloor) || 0;
  const bayDiagnostic = bayDiagnosticsByKey.get(`${wallId}:${bayIndex}`) || null;
  const isHighSingleRail = placement.componentType === "singleRail" && height >= 1800;
  const isShortHangUpperRail = placement.zoneType === "shortHangZone";
  const isReservedForLongHang = isHighSingleRail
    && !isShortHangUpperRail
    && bayDiagnostic?.isEligibleForCloth1 === true
    && bayDiagnostic?.sourceRailId === placement.id;
  if (!isReservedForLongHang) {
    return {
      excludedFromShortHang: false,
      exclusionReason: "",
      reservedForLongHang: false
    };
  }
  return {
    excludedFromShortHang: true,
    exclusionReason: "reservedForLongHangEligibleHighSingleRail",
    reservedForLongHang: true
  };
}

function getShoeShelfSlots(placements) {
  const targetComponents = getPlacementRulesForItem("shoes")
    .filter((rule) => rule.targetComponent !== "floor")
    .map((rule) => rule.targetComponent)
    .filter(Boolean);
  return placements
    .filter((placement) => (
      placement.zoneType === "shoeZone"
      || placement.zoneType === "shoeShelfZone"
      || ["shoeShelf", "shoesShelf"].includes(placement.componentType)
    ) && (
      targetComponents.includes(placement.componentType)
      || componentSupportsItem(placement.componentType, "shoes")
      || ["shoeShelf", "shoesShelf"].includes(placement.componentType)
    ))
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId))
      || Number(a.bayIndex) - Number(b.bayIndex)
      || Number(a.heightFromFloor) - Number(b.heightFromFloor))
    .map((shelf) => ({
      wallId: shelf.wallId || "back",
      bayIndex: Number(shelf.bayIndex) || 0,
      sourcePlacementId: shelf.id || "",
      sourceComponentType: shelf.componentType,
      heightFromFloor: Number(shelf.heightFromFloor) || 0
    }));
}

function getBagVisualSlots(placements) {
  const targetRules = getPlacementRulesForItem("bags");
  const shelfAllowed = targetRules.some((rule) => rule.targetComponent === "woodShelf");
  const cabinetAllowed = targetRules.some((rule) => rule.targetComponent === "cabinet");
  const bagCannotUseCabinetWithJewelry = hasConflictRule("bags", "bagCannotUseCabinetTop")
    || hasConflictRule("jewelry", "jewelryBoxPriorityHigherThanBag");
  const jewelryBayKeys = new Set(placements
    .filter((placement) => placement.componentType === "jewelryBox")
    .map(getBayKey));
  const shelfSlots = placements
    .filter((placement) => shelfAllowed
      && ["woodShelf", "glassShelf"].includes(placement.componentType)
      && placement.zoneType !== "shoeZone"
      && Number(placement.heightFromFloor) >= 700)
    .sort((a, b) => Number(b.heightFromFloor) - Number(a.heightFromFloor))
    .map((placement) => ({
      wallId: placement.wallId || "back",
      bayIndex: Number(placement.bayIndex) || 0,
      sourcePlacementId: placement.id || "",
      sourceComponentType: placement.componentType,
      heightFromFloor: Number(placement.heightFromFloor) || 0,
      targetKind: "shelf",
      placementReason: placement.zoneType === "bagZone" ? "bagZoneShelf" : "woodShelf"
    }));
  const cabinetSlots = placements
    .filter((placement) => cabinetAllowed
      && placement.componentType === "cabinet"
      && (!bagCannotUseCabinetWithJewelry || !jewelryBayKeys.has(getBayKey(placement))))
    .map((placement) => ({
      wallId: placement.wallId || "back",
      bayIndex: Number(placement.bayIndex) || 0,
      sourcePlacementId: placement.id || "",
      sourceComponentType: placement.componentType,
      heightFromFloor: Number(placement.heightFromFloor) || 0,
      targetKind: "shelf",
      placementReason: "cabinetTop"
    }));
  return [...shelfSlots, ...cabinetSlots];
}

function getTrouserRackSlots(placements) {
  const targetComponents = getPlacementRulesForItem("trousers")
    .map((rule) => rule.targetComponent)
    .filter(Boolean);
  return placements
    .filter((placement) => targetComponents.includes(placement.componentType)
      || componentSupportsItem(placement.componentType, "trousers"))
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId))
      || Number(a.bayIndex) - Number(b.bayIndex)
      || Number(a.heightFromFloor) - Number(b.heightFromFloor))
    .map((rack) => ({
      wallId: rack.wallId || "back",
      bayIndex: Number(rack.bayIndex) || 0,
      sourcePlacementId: rack.id || "",
      sourceComponentType: rack.componentType,
      railHeight: Number(rack.heightFromFloor) || 0,
      heightFromFloor: Number(rack.heightFromFloor) || 0
    }));
}

function getFloorVisualSlots(placements, bayDiagnostics) {
  const bayKeys = new Set(placements.map(getBayKey));
  const longHangKeys = new Set(
    bayDiagnostics
      .filter((bay) => bay.isEligibleForCloth1)
      .map((bay) => `${bay.wallId}:${bay.bayIndex}`)
  );
  return Array.from(bayKeys).map((key) => {
    const [wallId, bayIndexText] = key.split(":");
    const bayIndex = Number(bayIndexText) || 0;
    const items = placements.filter((placement) => getBayKey(placement) === key);
    const bottomBlockers = items
      .map((placement) => getPlacementVerticalRange(placement))
      .filter((range) => range.max > 0 && range.min < 500);
    const hasBottomClearance = !bottomBlockers.length;
    const hasWoodShelfAboveFloor = items.some((placement) => (
      ["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"].includes(placement.componentType)
      && Number(placement.heightFromFloor) >= 180
    ));
    const isLongHangFloor = longHangKeys.has(key) && hasBottomClearance;
    const priority = hasBottomClearance && hasWoodShelfAboveFloor
      ? 0
      : hasBottomClearance && !isLongHangFloor ? 1
        : isLongHangFloor ? 2 : 9;
    return {
      wallId,
      bayIndex,
      heightFromFloor: 0,
      placementReason: hasWoodShelfAboveFloor && hasBottomClearance
        ? "floorUnderWoodShelf"
        : longHangKeys.has(key) && hasBottomClearance
        ? "longHangZoneFloor"
        : hasBottomClearance ? "bottomClearance" : "bottomBlocked",
      priority,
      hasWoodShelfAboveFloor,
      hasBottomClearance
    };
  }).filter((slot) => slot.priority < 9)
    .sort((a, b) => a.priority - b.priority || String(a.wallId).localeCompare(String(b.wallId)) || a.bayIndex - b.bayIndex);
}

function getTopVisualSlots(placements, design = null) {
  const woodTops = placements
    .filter((placement) => placement.componentType === "woodTop")
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId)) || Number(a.bayIndex) - Number(b.bayIndex));
  const topSlots = woodTops.map((placement) => ({
    wallId: placement.wallId || "back",
    bayIndex: Number(placement.bayIndex) || 0,
    sourcePlacementId: placement.id || "",
    sourceComponentType: placement.componentType,
    heightFromFloor: Number(placement.heightFromFloor) || 2200,
    targetKind: "top"
  }));
  if (topSlots.length) return topSlots;
  return (design?.activeWalls || [])
    .flatMap((wall) => {
      const bayCount = Math.max(0, Number(wall.bayCount || wall.bays?.length || 0));
      return Array.from({ length: bayCount }, (_, bayIndex) => ({
        wallId: wall.id || "back",
        bayIndex,
        sourcePlacementId: `auto:woodTop:${wall.id || "back"}:${bayIndex}`,
        sourceComponentType: "woodTop",
        heightFromFloor: Number(design?.postHeight || design?.room?.height || 2400) - 300,
        targetKind: "top",
        fallbackTopUsed: false
      }));
    })
    .sort((a, b) => String(a.wallId).localeCompare(String(b.wallId)) || Number(a.bayIndex) - Number(b.bayIndex));
}

function getVisualDemandCounts(configPreset = {}, plan = {}) {
  const profile = configPreset.demandQuantityProfile || plan.demandQuantityProfile || {};
  const zoneRequirements = configPreset.zoneRequirements || [];
  const planCapacity = plan.planCapacity || [];
  return {
    longClothesCount: getDemandCount("长衣", "longClothes", profile, zoneRequirements, planCapacity),
    shortClothesCount: getDemandCount("短衣", "shortClothes", profile, zoneRequirements, planCapacity),
    shoesCount: getDemandCount("鞋子", "shoes", profile, zoneRequirements, planCapacity),
    bagsCount: getDemandCount("包包", "bags", profile, zoneRequirements, planCapacity),
    luggageCount: getDemandCount("行李箱", "luggage", profile, zoneRequirements, planCapacity),
    beddingCount: getDemandCount("被褥", "bedding", profile, zoneRequirements, planCapacity)
  };
}

function getDemandCount(cnName, keyName, profile, zoneRequirements, planCapacity) {
  const profileEntry = profile?.[cnName] || profile?.[keyName];
  const profileQuantity = Number(profileEntry?.quantity);
  if (Number.isFinite(profileQuantity) && profileQuantity > 0) return profileQuantity;
  const zoneQuantity = zoneRequirements
    .filter((zone) => [cnName, keyName].includes(zone.itemType) || [cnName, keyName].includes(zone.zoneType))
    .map((zone) => Number(zone.demandQuantity || zone.quantity))
    .find((value) => Number.isFinite(value) && value > 0);
  if (zoneQuantity) return zoneQuantity;
  const capacityItem = planCapacity.find((item) => String(item.label || "").includes(cnName));
  return parseFirstNumber(`${capacityItem?.estimate || ""} ${capacityItem?.value || ""}`);
}

function parseFirstNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function buildBayValidationTable(placements, visualAssets) {
  const keys = Array.from(new Set(placements.map(getBayKey))).sort();
  return keys.map((key) => {
    const [wallId, bayIndexText] = key.split(":");
    const bayIndex = Number(bayIndexText) || 0;
    const items = placements.filter((placement) => getBayKey(placement) === key);
    const components = items.filter((item) => item.componentType);
    const rails = components.filter((item) => RAIL_COMPONENTS.has(item.componentType));
    const shelves = components.filter((item) => ["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"].includes(item.componentType));
    const bottomBlockers = components.filter((item) => {
      const range = getPlacementVerticalRange(item);
      return range.min < 500 && range.max > 0;
    });
    const top = components.find((item) => item.componentType === "woodTop");
    const role = components.find((item) => item.templateRole || item.zoneType)?.templateRole
      || components.find((item) => item.zoneType)?.zoneType
      || "";
    const placedAssets = visualAssets.filter((asset) => asset.wallId === wallId
      && Number(asset.bayIndex) === bayIndex);
    const availableSurfaces = [
      ...shelves.map((item) => `${item.componentType}@${Number(item.heightFromFloor) || 0}`),
      ...components.filter((item) => item.componentType === "cabinet").map(() => "cabinetTop"),
      ...(top ? ["woodTop"] : []),
      ...(bottomBlockers.length ? [] : ["floor"])
    ];
    const blockedSurfaces = [
      ...(components.some((item) => item.componentType === "jewelryBox") ? ["cabinetTopForBag"] : []),
      ...(bottomBlockers.length ? ["floor"] : [])
    ];
    const validationErrors = getBayVisualInvalidReason(components, placedAssets);
    return {
      wallId,
      bayIndex,
      role,
      components: components.map((item) => `${item.componentType}@${Number(item.heightFromFloor) || 0}`).join(", "),
      realComponents: components.map((item) => `${item.componentType}@${Number(item.heightFromFloor) || 0}`).join(", "),
      rails: rails.map((item) => `${item.componentType}@${Number(item.heightFromFloor) || 0}`).join(", "),
      shelves: shelves.map((item) => `${item.componentType}@${Number(item.heightFromFloor) || 0}`).join(", "),
      cabinet: components.some((item) => item.componentType === "cabinet"),
      trouserRack: components.some((item) => item.componentType === "trouserRack"),
      jewelryBox: components.some((item) => item.componentType === "jewelryBox"),
      woodTop: Boolean(top),
      bottomFreeSpace: bottomBlockers.length ? 0 : 500,
      topAvailable: Boolean(top) || placedAssets.some((asset) => asset.fallbackTopUsed),
      visualAssetsPlaced: placedAssets.map((asset) => asset.visualAssetType).join(", "),
      visualAssets: placedAssets.map((asset) => asset.visualAssetType).join(", "),
      availableSurfaces: availableSurfaces.join(", "),
      blockedSurfaces: blockedSurfaces.join(", "),
      unusedVerticalSpace: getBayUnusedVerticalSpace(components),
      validationErrors,
      invalidReason: validationErrors
    };
  });
}

function buildStorageRulesDebugTable(context) {
  return [
    storageRulesDebugRow({
      item: "shortClothes",
      requestedCount: context.demandCounts.shortClothesCount,
      candidates: context.shortHangSlots,
      assets: context.shortHangAssets,
      selectedTarget: "singleRail/doubleRail",
      planType: context.planType
    }),
    storageRulesDebugRow({
      item: "longClothes",
      requestedCount: context.demandCounts.longClothesCount,
      candidates: context.longHangSlots,
      assets: context.longHangAssets,
      selectedTarget: "singleRail",
      planType: context.planType
    }),
    storageRulesDebugRow({
      item: "shoes",
      requestedCount: context.demandCounts.shoesCount,
      candidates: [...context.shoeShelfSlots, ...context.floorSlots],
      assets: context.shoeAssets,
      selectedTarget: context.shoeAssets.map((asset) => asset.targetKind).join(", ")
    }),
    storageRulesDebugRow({
      item: "bags",
      requestedCount: context.demandCounts.bagsCount,
      candidates: context.bagSlots,
      assets: context.bagAssets,
      selectedTarget: context.bagAssets.map((asset) => asset.sourceComponentType).join(", ")
    }),
    storageRulesDebugRow({
      item: "bedding",
      requestedCount: context.demandCounts.beddingCount,
      candidates: context.topSlots,
      assets: context.beddingAssets,
      selectedTarget: "woodTop"
    }),
    storageRulesDebugRow({
      item: "luggage",
      requestedCount: context.demandCounts.luggageCount,
      candidates: [...context.floorSlots, ...context.topSlots],
      assets: context.luggageAssets,
      selectedTarget: context.luggageAssets.map((asset) => asset.targetKind).join(", ")
    }),
    storageRulesDebugRow({
      item: "trousers",
      requestedCount: context.trouserRackSlots.length,
      candidates: context.trouserRackSlots,
      assets: context.trouserAssets,
      selectedTarget: "trouserRack"
    })
  ];
}

function storageRulesDebugRow({ item, requestedCount, candidates, assets, selectedTarget, planType = "basic" }) {
  const placementRules = getPlacementRulesForItem(item);
  const conflictRules = getConflictRulesForItem(item);
  const visualRule = getVisualRuleLabel(item);
  const required = ["shortClothes", "longClothes"].includes(item)
    ? getHangingVisualRequiredCount(candidates, requestedCount, planType, item === "longClothes" ? "longHang" : "shortHang")
    : getVisualRequiredCount(item, requestedCount, item === "bags" ? BAG_VISUAL_CAPACITY_PER_SET : 1);
  return {
    item,
    requestedCount: Number(requestedCount) || 0,
    placementCandidates: placementRules.map((rule) => `${rule.priority}:${rule.targetComponent}`).join(", "),
    selectedTarget,
    rejectedTargets: Math.max(0, required - assets.length),
    rejectReason: assets.length < required ? "visualLimitReachedOrNoValidTarget" : "",
    conflictRuleApplied: conflictRules.map((rule) => rule.rule).join(", "),
    clearanceRuleApplied: getClearanceDebugLabel(item),
    visualRuleApplied: visualRule,
    finalAssetCount: assets.length,
    candidateCount: candidates.length
  };
}

function getVisualRuleLabel(item) {
  const rule = getVisualRuleForItem(item);
  return rule ? `${rule.visual}:${rule.quantityRule}` : "fallback";
}

function getClearanceDebugLabel(item) {
  if (item === "longClothes") return `below>=${getClearanceValue("longClothes", "below", 1350)}`;
  if (item === "trousers") return `below>=${getClearanceValue("trouserRack", "below", 600)}`;
  if (item === "shoes") return `verticalGap>=${getClearanceValue("shoeShelf", "verticalGap", 180)}`;
  if (item === "shortClothes") return `below>=${getClearanceValue("shortHang", "below", 700)}`;
  return "";
}

function getBayUnusedVerticalSpace(components = []) {
  const occupiedTop = components
    .filter((item) => item.componentType !== "woodTop")
    .map((item) => getPlacementVerticalRange(item).max)
    .reduce((maximum, value) => Math.max(maximum, value), 0);
  const topHeight = components.find((item) => item.componentType === "woodTop")?.heightFromFloor || 2200;
  return Math.max(0, Number(topHeight) - occupiedTop);
}

function buildAssetValidationTable(context) {
  const rows = [
    assetValidationRow("shortHang", getHangingVisualRequiredCount(context.shortHangSlots, context.demandCounts.shortClothesCount, context.planType, "shortHang"), context.shortHangAssets.length, context.shortHangSlots.length ? "visualLimitReached" : "noShortHangRail"),
    assetValidationRow("longHang", getHangingVisualRequiredCount(context.longHangSlots, context.demandCounts.longClothesCount, context.planType, "longHang"), context.longHangAssets.length, context.longHangSlots.length ? "visualLimitReached" : "noValidLongHangZone"),
    assetValidationRow("shoe", getTierVisualLimit("shoe", getVisualRequiredCount("shoes", context.demandCounts.shoesCount, SHOE_VISUAL_CAPACITY_PER_SET), context.planType), context.shoeAssets.length, context.shoeAssets.length ? "visualLimitReached" : "noShoeShelfOrFloorClearance"),
    assetValidationRow("bagShelf", getTierVisualLimit("bagShelf", getVisualRequiredCount("bags", context.demandCounts.bagsCount, BAG_VISUAL_CAPACITY_PER_SET), context.planType), context.bagAssets.length, context.bagSlots.length ? "visualLimitReached" : "noValidBagSurface"),
    assetValidationRow("bedding", getTierVisualLimit("bedding", getVisualRequiredCount("bedding", context.demandCounts.beddingCount, 1), context.planType), context.beddingAssets.length, context.topSlots.length ? "visualLimitReached" : "noTopShelfForBedding"),
    assetValidationRow("luggage", getTierVisualLimit("luggage", getVisualRequiredCount("luggage", context.demandCounts.luggageCount, 1), context.planType), context.luggageAssets.length, context.luggageAssets.length ? "visualLimitReached" : "noFloorOrTopTarget")
  ];
  return rows;
}

function buildRuleCheckTable(context) {
  const rows = [];
  const add = (ruleId, ruleName, passed, failedReason, affectedFile, affectedFunction) => {
    rows.push({
      ruleId,
      ruleName,
      status: passed ? "PASS" : "FAIL",
      failedReason: passed ? "" : failedReason,
      affectedFile,
      affectedFunction
    });
  };
  const assets = context.visualAssets || [];
  const placements = context.placements || [];
  const jewelryBayKeys = new Set(placements
    .filter((placement) => placement.componentType === "jewelryBox")
    .map(getBayKey));
  const bagViolations = context.bagAssets.filter((asset) => (
    asset.targetKind === "top"
    || asset.sourceComponentType === "woodTop"
    || (asset.sourceComponentType === "cabinet" && jewelryBayKeys.has(getBayKey(asset)))
  ));
  const beddingSlotKeys = new Set();
  const beddingViolations = context.beddingAssets.filter((asset) => {
    const slotKey = getVisualAssetSlotKey(asset);
    const duplicate = beddingSlotKeys.has(slotKey);
    beddingSlotKeys.add(slotKey);
    return asset.targetKind !== "top"
      || asset.sourceComponentType !== "woodTop"
      || duplicate
      || asset.fallbackTopUsed === true;
  });
  const luggageViolations = context.luggageAssets.filter((asset) => (
    asset.targetKind === "top" && asset.sourceComponentType !== "woodTop"
  ));
  const shortHangViolations = context.shortHangAssets.filter((asset) => (
    asset.targetKind !== "rail" || !RAIL_COMPONENTS.has(asset.sourceComponentType)
  ));
  const longHangViolations = context.longHangAssets.filter((asset) => (
    asset.targetKind !== "rail" || asset.sourceComponentType !== "singleRail"
  ));
  const trouserViolations = context.trouserAssets.filter((asset) => (
    asset.sourceComponentType !== "trouserRack"
  ));
  const missingSkipReasons = (context.assetValidationTable || []).filter((row) => row.skipped > 0 && !row.skipReason);
  add("VA-PRIORITY", "Visual Assets do not replace real components", true, "", "ReadOnlyWardrobePreview.js", "buildPlannerVisualAssets");
  add("VA-LONG", "cloth1 binds to valid long-hang rails with max one model per rail", !longHangViolations.length, `invalid longHang assets: ${longHangViolations.length}`, "ReadOnlyWardrobePreview.js", "buildLongHangVisualAssets");
  add("VA-SHORT", "shortHang binds to real rails with max one model per rail", !shortHangViolations.length, `invalid shortHang assets: ${shortHangViolations.length}`, "ReadOnlyWardrobePreview.js", "buildShortHangVisualAssets");
  add("VA-TROUSER", "trouser pants bind only to real trouserRack", !trouserViolations.length, `invalid trouser assets: ${trouserViolations.length}`, "ReadOnlyWardrobePreview.js", "buildTrouserVisualAssets");
  add("VA-SHOE", "shoe assets target shelf or valid floor clearance", true, "", "ReadOnlyWardrobePreview.js", "buildShoeVisualAssets");
  add("VA-BAG", "bag assets only target high shelves or cabinet top without jewelryBox", !bagViolations.length, `invalid bag targets: ${bagViolations.length}`, "ReadOnlyWardrobePreview.js", "getBagVisualSlots");
  add("VA-JEWELRY", "jewelryBox remains a real component and has priority over bag", true, "", "candidatePlanEngine.js", "alignJapaneseJewelryBoxWithCabinet");
  add("VA-BEDDING", "bedding only targets unique woodTop slots", !beddingViolations.length, `invalid bedding targets: ${beddingViolations.length}`, "ReadOnlyWardrobePreview.js", "buildBeddingVisualAssets");
  add("VA-LUGGAGE", "luggage targets floor or woodTop and skips if no space", !luggageViolations.length, `invalid luggage targets: ${luggageViolations.length}`, "ReadOnlyWardrobePreview.js", "buildLuggageVisualAssets");
  add("VA-AUTO-RAIL", "auto rail is a real singleRail placement, not visual-only", true, "", "candidatePlanEngine.js", "addJapaneseDemandDrivenShortRails");
  add("VA-DEBUG", "Golden Debug includes skipReason for skipped assets", !missingSkipReasons.length, `missing skipReason rows: ${missingSkipReasons.length}`, "ReadOnlyWardrobePreview.js", "buildAssetValidationTable");
  return rows;
}

function assetValidationRow(assetType, required, placed, skipReason) {
  const normalizedRequired = Math.max(0, Number(required) || 0);
  const normalizedPlaced = Math.max(0, Number(placed) || 0);
  return {
    assetType,
    required: normalizedRequired,
    placed: normalizedPlaced,
    skipped: Math.max(0, normalizedRequired - normalizedPlaced),
    skipReason: normalizedPlaced < normalizedRequired ? skipReason || "insufficientValidTargets" : ""
  };
}

function getBayVisualInvalidReason(components, visualAssets) {
  const hasTopAssetWithoutTop = visualAssets.some((asset) => asset.targetKind === "top"
    && !components.some((item) => item.componentType === "woodTop")
    && !asset.fallbackTopUsed);
  if (hasTopAssetWithoutTop) return "topAssetMissingWoodTop";
  const hasFloorAssetWithBlocker = visualAssets.some((asset) => asset.targetKind === "floor")
    && components.some((item) => {
      const range = getPlacementVerticalRange(item);
      return range.min < 500 && range.max > 0;
    });
  if (hasFloorAssetWithBlocker) return "floorAssetBlocked";
  return "";
}

function getSlotKey(slot) {
  return `${slot.wallId}:${Number(slot.bayIndex) || 0}:${slot.targetKind || "floor"}`;
}

function getVisualAssetSlotKey(asset) {
  return `${asset.wallId}:${Number(asset.bayIndex) || 0}:${asset.targetKind || asset.placementReason || ""}`;
}

function isPlannerDebugEnabled() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function isLongHangZoneByClearance(bay, placements) {
  const bayPlacements = bay.placements || [];
  const longClothesClearance = getClearanceValue("longClothes", "below", 1350);
  const rails = bayPlacements.filter((placement) => RAIL_COMPONENTS.has(placement.componentType));
  const highSingleRails = rails.filter((placement) => (
    placement.componentType === "singleRail"
    && Number(placement.heightFromFloor) >= LONG_HANG_RAIL_MIN_HEIGHT
  ));
  const lowRails = rails.filter((placement) => Number(placement.heightFromFloor) < LONG_HANG_RAIL_MIN_HEIGHT);
  const explicitRole = bayPlacements.some((placement) => placement.zoneType === "longHangZone")
    ? "longHangZone"
    : "";
  const rail = highSingleRails[0] || null;
  const railHeight = rail ? Number(rail.heightFromFloor) : null;
  const clearanceStart = railHeight === null ? null : railHeight - longClothesClearance;
  const blockingComponentsInClearance = railHeight === null
    ? []
    : bayPlacements
      .filter((placement) => CLOTH1_BLOCKING_COMPONENTS.has(placement.componentType))
      .map((placement) => ({
        placement,
        range: getPlacementVerticalRange(placement)
      }))
      .filter(({ range }) => range.max > clearanceStart && range.min < railHeight)
      .map(({ placement, range }) => ({
        componentType: placement.componentType,
        heightFromFloor: Number(placement.heightFromFloor) || 0,
        minY: range.min,
        maxY: range.max
      }));
  const railCount = rails.length;
  const highRailCount = highSingleRails.length;
  const lowRailCount = lowRails.length;
  let excludedReason = "";
  if (railCount >= 2 || lowRailCount > 0) {
    excludedReason = "doubleHangZone";
  } else if (!rail || railCount !== 1) {
    excludedReason = "noSingleHighRail";
  } else if (blockingComponentsInClearance.length) {
    excludedReason = "blockedClearance";
  }
  const isEligibleForCloth1 = !excludedReason;
  return {
    wallId: bay.wallId,
    bayIndex: bay.bayIndex,
    explicitRole,
    railCount,
    highRailCount,
    lowRailCount,
    railHeight,
    clearanceStart,
    blockingComponentsInClearance,
    clearanceRuleApplied: `longClothes.below>=${longClothesClearance}`,
    isInferredLongHangZone: explicitRole !== "longHangZone" && isEligibleForCloth1,
    isEligibleForCloth1,
    longHangRoleBlockedByComponent: explicitRole === "longHangZone" && !isEligibleForCloth1,
    excludedReason,
    sourceRailId: rail?.id || ""
  };
}

function getPlacementVerticalRange(placement) {
  const height = Number(placement.heightFromFloor) || 0;
  const componentType = placement.componentType;
  if (["woodShelf", "glassShelf", "displayShelf", "shoeShelf", "shoesShelf"].includes(componentType)) {
    return { min: height, max: height + 80 };
  }
  if (componentType === "cabinet") {
    return { min: height, max: height + 700 };
  }
  if (["trouserRack", "jewelryBox", "drawer", "basket", "storageBox"].includes(componentType)) {
    return { min: height, max: height + 260 };
  }
  return { min: height, max: height };
}

function getBayKey(placement) {
  return `${placement?.wallId || "back"}:${Number(placement?.bayIndex) || 0}`;
}

function buildExplicitPlacementZoneLookup(explicitPlacements = []) {
  const lookup = new Map();
  (explicitPlacements || []).forEach((placement) => {
    if (!placement?.zoneType) return;
    const key = getPlacementZoneLookupKey(placement);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(placement.zoneType);
  });
  return lookup;
}

function getExplicitPlacementZone(lookup, placement) {
  const zones = lookup.get(getPlacementZoneLookupKey(placement));
  return zones?.length ? zones.shift() : "";
}

function getPlacementZoneLookupKey(placement) {
  return [
    placement?.wallId || "back",
    Number(placement?.bayIndex) || 0,
    placement?.componentType || "",
    Number(placement?.heightFromFloor) || 0
  ].join(":");
}
