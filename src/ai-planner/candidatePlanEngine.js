import { PLAN_LEVELS } from "../rules/commonRules.js?v=closet-rules-preview-20260621-11";
import {
  buildPlanRuleOutput,
  getPlanPriceFromRules
} from "../rules/demandRules.js?v=closet-rules-preview-20260621-11";
import {
  PLANNER_COMPONENT_MAP,
  WALL_MOUNTED_PLACEMENT_RULES,
  createWallMountedRailWithShelfPlacement,
  resolveWallMountedShelfType
} from "../config/plannerPresetMap.js?v=wall-mounted-placement-rules-20260621-03";

const PLAN_TYPES = ["basic", "value", "premium"];
const PLAN_NAMES = {
  basic: "基础实用款",
  value: "高性价比款",
  premium: "高配理想款"
};
const SHELF_TYPES = new Set(["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"]);
const CAPACITY_SHELF_TYPES = new Set(["woodShelf", "glassShelf"]);
const SHOE_SHELF_MIN_GAP = 180;
const DENSE_SHELF_MIN_GAP = 300;
const EXPERIENCE_TYPES = new Set(["jewelryBox", "trouserRack", "glassShelf", "mixedStorage"]);
const UPGRADE_COMPONENTS = new Set(["cabinet", "trouserRack", "jewelryBox", "glassShelf", "mixedStorage"]);
const FUNCTIONAL_UPGRADE_ZONES = new Set(["trouserZone", "jewelryZone", "displayZone", "storageZone"]);
const SIDE_WALL_RESTRICTED_TYPES = new Set(["cabinet", "jewelryBox", "glassShelf", "mixedStorage"]);
const LUGGAGE_CONFLICT_TYPES = new Set([
  "cabinet", "jewelryBox", "trouserRack", "glassShelf", "shoeShelf", "shoesShelf"
]);
const COMPONENT_HEIGHTS = {
  singleRail: 50,
  doubleRail: 80,
  woodShelf: 40,
  glassShelf: 40,
  shoeShelf: 40,
  shoesShelf: 40,
  cabinet: 600,
  jewelryBox: 180,
  trouserRack: 180,
  mixedStorage: 500
};

let lastStats = {
  generatedCount: 0,
  filteredCount: 0,
  validCount: 0,
  totalCandidates: 0,
  validCandidates: 0,
  rejectReasons: {},
  rejectReasonsByPlanType: {},
  missingPlanType: null,
  missingReason: null,
  candidateRejectTopReasons: [],
  basicValueSimilarity: null,
  valuePremiumSimilarity: null,
  duplicatePlanDetected: false,
  reselectionReason: null,
  heatmap: {}
};

export function generateCandidatePlans(answers = {}, rulesData = {}) {
  const normalized = normalizeAnswers(answers);
  const supportedTypes = getSupportedTypes(getSelectedSeriesId(normalized));
  const candidates = [];
  PLAN_TYPES.forEach((planType) => {
    const planOutput = buildPlanRuleOutput(normalized.needs, normalized.peopleCount, planType);
    enumerateTierCandidates(normalized, rulesData, supportedTypes, planType, planOutput)
      .forEach((candidate) => candidates.push(candidate));
  });

  const filtered = candidates.filter((candidate) => filterCandidatePlan(candidate, {
    answers: normalized,
    supportedTypes,
    rulesData
  }));
  filtered.forEach((candidate) => {
    candidate.scores = scoreCandidatePlan(candidate, normalized);
  });
  const heatmap = Object.fromEntries(PLAN_TYPES.map((planType) => [
    planType,
    filtered
      .filter((candidate) => candidate.planType === planType)
      .sort((a, b) => b.scores.totalScore - a.scores.totalScore)
      .slice(0, 10)
  ]));
  const valid = PLAN_TYPES.flatMap((planType) => heatmap[planType]);
  const rejectReasons = countBy(
    candidates.filter((candidate) => candidate.rejectReason),
    (candidate) => candidate.rejectReason
  );
  const rejectReasonsByPlanType = Object.fromEntries(PLAN_TYPES.map((planType) => [
    planType,
    countBy(
      candidates.filter((candidate) => candidate.planType === planType && candidate.rejectReason),
      (candidate) => candidate.rejectReason
    )
  ]));

  lastStats = {
    generatedCount: candidates.length,
    filteredCount: candidates.length - filtered.length,
    validCount: valid.length,
    totalCandidates: candidates.length,
    validCandidates: filtered.length,
    rejectReasons,
    rejectReasonsByPlanType,
    missingPlanType: null,
    missingReason: null,
    candidateRejectTopReasons: [],
    basicValueSimilarity: null,
    valuePremiumSimilarity: null,
    duplicatePlanDetected: false,
    reselectionReason: null,
    heatmap: Object.fromEntries(PLAN_TYPES.map((planType) => [
      planType,
      heatmap[planType].map(toCandidateDebugSummary)
    ]))
  };
  console.log("[candidate-plan-engine]", lastStats);
  return valid;
}

export function filterCandidatePlan(candidate, { answers, supportedTypes }) {
  const placements = candidate.placements || [];
  candidate.rejectReason = "";
  if (getSelectedSeriesId(answers) === "wall-mounted-v2"
    && !validateWallMountedRailDependencies(placements)) {
    return rejectCandidate(candidate, "wallMountedRailMissingShelf");
  }
  if (placements.some((placement) => placement.componentType === "LUGGAGE_ZONE")) {
    return rejectCandidate(candidate, "fakeComponent");
  }
  if (placements.some((placement) => placement.componentType
    && !supportedTypes.has(placement.componentType))) {
    return rejectCandidate(candidate, "unsupportedComponent");
  }
  if (candidate.planType === "basic" && placements.some((placement) => [
    "jewelryBox", "glassShelf", "mixedStorage", "led"
  ].includes(placement.componentType))) {
    return rejectCandidate(candidate, "basicForbiddenUpgrade");
  }
  if (candidate.planType === "premium" && answers.needs.首饰 > 0
    && (supportedTypes.has("jewelryBox") || supportedTypes.has("mixedStorage"))
    && !placements.some((placement) => ["jewelryBox", "mixedStorage"].includes(placement.componentType))) {
    return rejectCandidate(candidate, "premiumMissingJewelryBox");
  }
  if (candidate.planType === "premium" && answers.needs.裤子 > 0
    && (supportedTypes.has("trouserRack") || supportedTypes.has("mixedStorage"))
    && !placements.some((placement) => ["trouserRack", "mixedStorage"].includes(placement.componentType))) {
    return rejectCandidate(candidate, "premiumMissingTrouserRack");
  }
  if (candidate.planType === "value"
    && (answers.needs.首饰 > 0 || answers.needs.裤子 > 0)
    && !placements.some((placement) => ["jewelryBox", "trouserRack", "mixedStorage"]
      .includes(placement.componentType))) {
    return rejectCandidate(candidate, "valueMissingExperienceComponent");
  }
  if (answers.needs.展示收藏 <= 0
    && placements.some((placement) => placement.zoneType === "displayZone"
      || (placement.componentType === "glassShelf" && !placement.isLinkedRailShelf))) {
    return rejectCandidate(candidate, "displayWithoutDemand");
  }
  if (!validateSideWallSpace(placements, answers.roomDepth)) {
    return rejectCandidate(candidate, "sideWallSpaceInsufficient");
  }
  if (!validateLuggageExclusivity(placements)) {
    return rejectCandidate(candidate, "luggageZoneConflict");
  }
  if (placements.some((placement) => placement.componentType === "cabinet"
    && placement.heightFromFloor > 300)) {
    return rejectCandidate(candidate, "cabinetHeightInvalid");
  }
  if (!validateLongHangClearance(placements)) {
    return rejectCandidate(candidate, "longHangClearanceFailed");
  }
  if (!validateShortHangHeights(placements)) {
    return rejectCandidate(candidate, "shortHangHeightInvalid");
  }
  if (!validateShoeGaps(placements)) {
    return rejectCandidate(candidate, "shoeShelfGapTooSmall");
  }
  const shelfUsabilityRejectReason = getShelfUsabilityRejectReason(placements);
  if (shelfUsabilityRejectReason) {
    return rejectCandidate(candidate, shelfUsabilityRejectReason);
  }
  if (hasPlacementOverlap(placements)) {
    return rejectCandidate(candidate, "componentOverlap");
  }
  if (!validateBudget(candidate, answers.budgetRange)) {
    return rejectCandidate(candidate, "budgetExceeded");
  }
  return true;
}

export function scoreCandidatePlan(candidate, answers) {
  const usableCapacityPlacements = getUsableCapacityPlacements(candidate.placements || []);
  const coverage = calculateCandidateCoverage(candidate, answers, usableCapacityPlacements);
  const storageScore = coverage * 30;
  const layoutScore = scoreLayout(candidate, answers) * 30;
  const visualScore = scoreVisual(candidate) * 20;
  const budgetScore = scoreBudget(candidate) * 10;
  const upgradeScore = scoreUpgrade(candidate, answers);
  return {
    totalScore: roundScore(storageScore + layoutScore + visualScore + budgetScore + upgradeScore),
    storageScore: roundScore(storageScore),
    layoutScore: roundScore(layoutScore),
    visualScore: roundScore(visualScore),
    budgetScore: roundScore(budgetScore),
    upgradeScore: roundScore(upgradeScore)
  };
}

export function selectRecommendedCandidates(candidates = [], answers = {}) {
  const normalizedAnswers = normalizeAnswers(answers);
  const supportedTypes = getSupportedTypes(getSelectedSeriesId(normalizedAnswers));
  const reasons = [];
  const basicCandidates = getTierCandidates(candidates, "basic");
  const valueCandidates = getTierCandidates(candidates, "value");
  const premiumCandidates = getTierCandidates(candidates, "premium");
  const basic = basicCandidates[0]
    || cloneCandidateForTier([...candidates].sort((a, b) => a.estimatedPrice - b.estimatedPrice)[0], "basic");

  let value = selectMostDifferentCandidate(valueCandidates, basic, "value");
  if (!value) {
    value = createValueFallbackCandidate(basic, normalizedAnswers, supportedTypes);
    reasons.push("valueDerivedFromBasic");
  } else if (value !== valueCandidates[0]) {
    reasons.push("valueReselectedForDifference");
  }

  let premium = selectMostDifferentCandidate(premiumCandidates, value, "premium");
  if (!premium) {
    premium = createPremiumFallbackCandidate(value, normalizedAnswers, supportedTypes);
    reasons.push("premiumDerivedFromValue");
  } else if (premium !== premiumCandidates[0]) {
    reasons.push("premiumReselectedForDifference");
  }

  const selected = [basic, value, premium];
  const missingPlanTypes = PLAN_TYPES.filter((planType, index) => !selected[index]);
  updateMissingPlanStats(missingPlanTypes, selected);
  updatePlanSimilarityStats(selected, reasons);
  return selected.filter(Boolean);
}

export function getLastCandidateEngineStats() {
  return {
    ...lastStats,
    rejectReasons: { ...lastStats.rejectReasons },
    rejectReasonsByPlanType: Object.fromEntries(Object.entries(lastStats.rejectReasonsByPlanType || {})
      .map(([planType, reasons]) => [planType, { ...reasons }])),
    candidateRejectTopReasons: [...(lastStats.candidateRejectTopReasons || [])],
    heatmap: Object.fromEntries(Object.entries(lastStats.heatmap || {})
      .map(([planType, candidates]) => [planType, candidates.map((candidate) => ({ ...candidate }))]))
  };
}

function rejectCandidate(candidate, reason) {
  candidate.rejectReason = reason;
  return false;
}

function cloneCandidateForTier(candidate, planType) {
  if (!candidate) return null;
  return {
    ...candidate,
    planId: `${planType}:fallback:${candidate.planId}`,
    planType,
    planName: PLAN_NAMES[planType],
    fallbackSourcePlanType: candidate.planType,
    placements: (candidate.placements || []).map((item) => ({ ...item })),
    parameters: { ...(candidate.parameters || {}) },
    configPreset: {
      ...(candidate.configPreset || {}),
      planType,
      zoneRequirements: (candidate.configPreset?.zoneRequirements || []).map((item) => ({
        ...item,
        allowedComponents: [...(item.allowedComponents || [])]
      })),
      componentQuantities: { ...(candidate.configPreset?.componentQuantities || {}) }
    },
    scores: {
      ...candidate.scores,
      upgradeScore: Math.min(6, Math.max(2.5, Number(candidate.scores?.upgradeScore || 0))),
      totalScore: roundScore(
        Number(candidate.scores?.totalScore || 0)
        - Number(candidate.scores?.upgradeScore || 0)
        + Math.min(6, Math.max(2.5, Number(candidate.scores?.upgradeScore || 0)))
      )
    }
  };
}

function getTierCandidates(candidates, planType) {
  const tierCandidates = candidates.filter((candidate) => candidate.planType === planType);
  return [...tierCandidates].sort((a, b) => {
    if (planType === "basic") {
      return a.estimatedPrice - b.estimatedPrice
        || b.scores.totalScore - a.scores.totalScore;
    }
    return b.scores.totalScore - a.scores.totalScore;
  });
}

function selectMostDifferentCandidate(tierCandidates, baseCandidate, targetPlanType) {
  if (!baseCandidate) return tierCandidates[0] || null;
  return tierCandidates
    .filter((candidate) => isTierUpgradeQualified(baseCandidate, candidate, targetPlanType))
    .sort((a, b) => getPlanDifferenceScore(baseCandidate, b)
      - getPlanDifferenceScore(baseCandidate, a)
      || b.scores.totalScore - a.scores.totalScore)[0] || null;
}

function isTierUpgradeQualified(baseCandidate, candidate, targetPlanType) {
  if (!candidate || getPlacementSignature(candidate) === getPlacementSignature(baseCandidate)) return false;
  const priceRatio = targetPlanType === "value" ? 1.08 : 1.10;
  if (Number(candidate.estimatedPrice || 0) < Number(baseCandidate.estimatedPrice || 0) * priceRatio) return false;
  const placementDelta = getPlacementCount(candidate) - getPlacementCount(baseCandidate);
  const coverageDelta = getCapacityCoverage(candidate) - getCapacityCoverage(baseCandidate);
  const upgradeDelta = getUpgradeComponentCount(candidate) - getUpgradeComponentCount(baseCandidate);
  if (targetPlanType === "value") {
    const functionalZoneDelta = getFunctionalZoneCount(candidate) - getFunctionalZoneCount(baseCandidate);
    return placementDelta >= 2 || coverageDelta >= 0.10 || upgradeDelta >= 1 || functionalZoneDelta >= 1;
  }
  const occupiedBayDelta = getOccupiedBayCount(candidate) - getOccupiedBayCount(baseCandidate);
  return placementDelta >= 2 || coverageDelta >= 0.08 || upgradeDelta >= 1 || occupiedBayDelta >= 1;
}

function getPlanDifferenceScore(baseCandidate, candidate) {
  return Math.max(0, getPlacementCount(candidate) - getPlacementCount(baseCandidate)) * 2
    + Math.max(0, getUpgradeComponentCount(candidate) - getUpgradeComponentCount(baseCandidate)) * 6
    + Math.max(0, getFunctionalZoneCount(candidate) - getFunctionalZoneCount(baseCandidate)) * 5
    + Math.max(0, getOccupiedBayCount(candidate) - getOccupiedBayCount(baseCandidate)) * 4
    + Math.max(0, getCapacityCoverage(candidate) - getCapacityCoverage(baseCandidate)) * 20
    + Math.max(0, Number(candidate.estimatedPrice || 0) / Math.max(1, Number(baseCandidate.estimatedPrice || 0)) - 1) * 10;
}

function createValueFallbackCandidate(candidate, answers, supportedTypes) {
  if (!candidate) return null;
  const value = cloneCandidateForTier(candidate, "value");
  value.planId = `value:derived:${candidate.planId}`;
  value.configPreset.shelfLevel = "medium";
  let added = 0;
  if (supportedTypes.has("cabinet")) {
    added += tryAddTierUpgrade(value, "storageZone", "cabinet", [0], true);
  }
  if (!added && answers.needs.裤子 > 0 && supportedTypes.has("trouserRack")) {
    added += tryAddTierUpgrade(value, "trouserZone", "trouserRack", [750], true);
  }
  if (!added && answers.needs.首饰 > 0 && supportedTypes.has("jewelryBox")) {
    added += tryAddTierUpgrade(value, "jewelryZone", "jewelryBox", [1100, 1300], true);
  }
  for (let index = added; index < 2; index += 1) {
    added += tryAddTierUpgrade(value, "storageZone", "woodShelf", [300, 700, 1200, 1600, 2050], true);
  }
  refreshWallMountedCandidateDependencies(value, answers, "value", supportedTypes);
  finalizeDerivedCandidate(value, candidate, answers, "value", 1.08, added);
  return value;
}

function createPremiumFallbackCandidate(candidate, answers, supportedTypes) {
  if (!candidate) return null;
  const premium = cloneCandidateForTier(candidate, "premium");
  premium.planId = `premium:derived:${candidate.planId}`;
  premium.configPreset.shelfLevel = "high";
  let addedUpgradeCount = 0;
  if (answers.needs.首饰 > 0 && supportedTypes.has("jewelryBox")) {
    addedUpgradeCount += tryAddTierUpgrade(premium, "jewelryZone", "jewelryBox", [1100, 1300], true);
  }
  if (answers.needs.裤子 > 0 && supportedTypes.has("trouserRack")) {
    addedUpgradeCount += tryAddTierUpgrade(premium, "trouserZone", "trouserRack", [750], true);
  }
  if (supportedTypes.has("cabinet")) {
    addedUpgradeCount += tryAddTierUpgrade(premium, "storageZone", "cabinet", [0], true);
  }
  if (hasPremiumDisplayDemand(answers.needs) && supportedTypes.has("glassShelf")) {
    addedUpgradeCount += tryAddTierUpgrade(premium, "displayZone", "glassShelf", [1200, 1400], true);
  }
  if (supportsPlannerLighting(answers.selectedProductSystem?.id)) {
    premium.parameters.lighting = true;
    premium.configPreset.lighting = true;
    addedUpgradeCount += candidate.configPreset?.lighting ? 0 : 1;
  }
  if (!addedUpgradeCount) {
    addedUpgradeCount += tryAddTierUpgrade(premium, "storageZone", "woodShelf", [300, 700, 1200, 1600, 2050], true);
  }
  refreshWallMountedCandidateDependencies(premium, answers, "premium", supportedTypes);
  finalizeDerivedCandidate(premium, candidate, answers, "premium", 1.10, addedUpgradeCount);
  return premium;
}

function tryAddTierUpgrade(candidate, zoneType, componentType, heights, allowExisting = false) {
  if (!allowExisting && candidate.placements.some((item) => item.componentType === componentType)) return 0;
  const bayCount = Math.max(1, Number(candidate.parameters?.bayCount || candidate.configPreset?.bayCount || 1));
  for (let bayIndex = bayCount - 1; bayIndex >= 0; bayIndex -= 1) {
    for (const heightFromFloor of heights) {
      const upgrade = placement(zoneType, componentType, bayIndex, heightFromFloor);
      if (candidate.placements.some((item) => item.wallId === upgrade.wallId
        && item.bayIndex === upgrade.bayIndex
        && intervalsOverlap(intervalFor(item), intervalFor(upgrade)))) continue;
      if (candidate.placements.some((item) => item.wallId === upgrade.wallId
        && item.bayIndex === upgrade.bayIndex
        && item.zoneType === "luggageZone")) continue;
      candidate.placements.push(upgrade);
      if (getShelfUsabilityRejectReason(candidate.placements)) {
        candidate.placements.pop();
        continue;
      }
      candidate.configPreset.componentQuantities[componentType] =
        Number(candidate.configPreset.componentQuantities[componentType] || 0) + 1;
      incrementZoneRequirement(candidate.configPreset.zoneRequirements, zoneType, componentType);
      candidate.parameters[componentType] = Number(candidate.parameters[componentType] || 0) + 1;
      return 1;
    }
  }
  return 0;
}

function finalizeDerivedCandidate(candidate, sourceCandidate, answers, planType, priceRatio, addedUpgradeCount) {
  candidate.zones = unique(candidate.placements.map((item) => item.zoneType));
  candidate.coverageTarget = PLAN_LEVELS[planType];
  candidate.estimatedCapacity = buildPlanRuleOutput(answers.needs, answers.peopleCount, planType).capacity;
  const priceTarget = Number(getPlanPriceFromRules(answers.budgetRange, planType).price || 0);
  const minimumTierPrice = roundPriceUp(Number(sourceCandidate.estimatedPrice || 0) * priceRatio);
  const upgradePrice = Number(sourceCandidate.estimatedPrice || 0) + Math.max(1, addedUpgradeCount) * 80;
  const priceCap = planType === "premium"
    ? getPremiumBudgetCap(answers.budgetRange)
    : getValueBudgetCap(answers.budgetRange);
  candidate.estimatedPrice = Math.min(Math.max(priceTarget, minimumTierPrice, upgradePrice), priceCap);
  candidate.configPreset.candidatePlanId = candidate.planId;
  candidate.scores = scoreCandidatePlan(candidate, answers);
}

function refreshWallMountedCandidateDependencies(candidate, answers, planType, supportedTypes) {
  if (getSelectedSeriesId(answers) !== "wall-mounted-v2") return;
  candidate.placements = candidate.placements.filter((placement) => !placement.isLinkedRailShelf);
  candidate.placements.forEach((placement) => {
    if (placement.componentType !== "singleRail") return;
    delete placement.shelfDependency;
    delete placement.distanceFromWall;
    delete placement.wallMountedOffsetPosition;
  });
  attachWallMountedShelfDependencies(candidate.placements, answers, planType, supportedTypes);
  candidate.configPreset.wallMountedRailDependencies = candidate.placements
    .filter((placement) => placement.componentType === "singleRail" && placement.shelfDependency)
    .map((placement) => ({
      ...placement.shelfDependency,
      railZoneType: placement.zoneType,
      railHeightFromFloor: placement.heightFromFloor,
      wallMountedOffsetPosition: placement.wallMountedOffsetPosition
    }));
}

function getValueBudgetCap(budgetRange) {
  const range = parseBudgetRange(budgetRange);
  return Math.max(range.max * 1.25, range.min);
}

function roundPriceUp(value) {
  return Math.ceil(Number(value || 0) / 100) * 100;
}

function supportsPlannerLighting(seriesId) {
  return ["aluminum-base-supported", "wall-mounted-v2"].includes(seriesId || "");
}

function updatePlanSimilarityStats(selected, reasons) {
  const [basic, value, premium] = selected;
  const basicValueSimilarity = getPlanSimilarity(basic, value);
  const valuePremiumSimilarity = getPlanSimilarity(value, premium);
  const duplicatePlanDetected = Boolean(
    basicValueSimilarity.samePlacementSignature || valuePremiumSimilarity.samePlacementSignature
  );
  lastStats.basicValueSimilarity = basicValueSimilarity;
  lastStats.valuePremiumSimilarity = valuePremiumSimilarity;
  lastStats.duplicatePlanDetected = duplicatePlanDetected;
  lastStats.reselectionReason = reasons.join("; ") || "none";
}

function getPlanSimilarity(first, second) {
  if (!first || !second) return { score: 0, samePlacementSignature: false };
  const comparisons = {
    samePlacementSignature: getPlacementSignature(first) === getPlacementSignature(second),
    sameComponentCount: stableObjectSignature(getComponentCount(first)) === stableObjectSignature(getComponentCount(second)),
    sameZoneDistribution: stableObjectSignature(getZoneDistribution(first)) === stableObjectSignature(getZoneDistribution(second)),
    sameEstimatedPrice: Number(first.estimatedPrice || 0) === Number(second.estimatedPrice || 0),
    sameCapacityCoverage: getCapacityCoverage(first) === getCapacityCoverage(second),
    sameUpgradeComponents: stableObjectSignature(getUpgradeComponentCounts(first))
      === stableObjectSignature(getUpgradeComponentCounts(second))
  };
  const score = Object.values(comparisons).filter(Boolean).length / Object.keys(comparisons).length;
  return { score: roundScore(score), ...comparisons };
}

function getPlacementSignature(candidate) {
  return (candidate?.placements || []).map((item) => [
    item.wallId || "back",
    item.bayIndex,
    item.zoneType,
    item.componentType,
    item.heightFromFloor
  ].join(":" )).sort().join("|");
}

function getComponentCount(candidate) {
  return countBy((candidate?.placements || []).filter((item) => item.componentType), (item) => item.componentType);
}

function getZoneDistribution(candidate) {
  return countBy(candidate?.placements || [], (item) => item.zoneType);
}

function getUpgradeComponentCounts(candidate) {
  return countBy(
    (candidate?.placements || []).filter((item) => UPGRADE_COMPONENTS.has(item.componentType)),
    (item) => item.componentType
  );
}

function getPlacementCount(candidate) {
  return (candidate?.placements || []).length;
}

function getUpgradeComponentCount(candidate) {
  return (candidate?.placements || []).filter((item) => UPGRADE_COMPONENTS.has(item.componentType)).length
    + (candidate?.configPreset?.lighting ? 1 : 0);
}

function getFunctionalZoneCount(candidate) {
  return new Set((candidate?.placements || [])
    .filter((item) => FUNCTIONAL_UPGRADE_ZONES.has(item.zoneType))
    .map((item) => item.zoneType)).size;
}

function getOccupiedBayCount(candidate) {
  return new Set((candidate?.placements || [])
    .filter((item) => item.componentType)
    .map((item) => `${item.wallId || "back"}:${item.bayIndex}`)).size;
}

function getCapacityCoverage(candidate) {
  return Number(candidate?.coverageTarget || PLAN_LEVELS[candidate?.planType] || 0);
}

function stableObjectSignature(value) {
  return Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}:${count}`).join("|");
}

function incrementZoneRequirement(requirements, zoneType, componentType) {
  const existing = requirements.find((item) => item.zoneType === zoneType);
  if (existing) {
    existing.preferredComponent = componentType;
    existing.allowedComponents = unique([...(existing.allowedComponents || []), componentType]);
    existing.quantity = Number(existing.quantity || 0) + 1;
    return;
  }
  requirements.push({
    zoneType,
    preferredComponent: componentType,
    allowedComponents: [componentType],
    quantity: 1,
    priorityIndex: 50
  });
}

function hasPremiumDisplayDemand(needs) {
  return ["展示收藏", "包包", "包包放置", "包包展示"]
    .some((key) => Number(needs[key] || 0) > 0);
}

function updateMissingPlanStats(missingPlanTypes, selected) {
  if (!missingPlanTypes.length) {
    lastStats.missingPlanType = null;
    lastStats.missingReason = null;
    lastStats.candidateRejectTopReasons = [];
    return;
  }
  lastStats.missingPlanType = missingPlanTypes.join("/");
  lastStats.missingReason = missingPlanTypes.map((planType) => {
    const reasons = lastStats.rejectReasonsByPlanType?.[planType] || {};
    return Object.keys(reasons).length ? `${planType}:allCandidatesRejected` : `${planType}:noCandidatesGenerated`;
  }).join("; ");
  lastStats.candidateRejectTopReasons = missingPlanTypes.flatMap((planType) => (
    Object.entries(lastStats.rejectReasonsByPlanType?.[planType] || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ planType, reason, count }))
  ));
  lastStats.selectedPlanTypes = selected.filter(Boolean).map((candidate) => candidate.planType);
}

function enumerateTierCandidates(answers, rulesData, supportedTypes, planType, planOutput) {
  const roomWidth = answers.roomWidth;
  const bayOptions = unique([
    clamp(Math.round(roomWidth / 900), 3, 7),
    clamp(Math.round(roomWidth / 800), 3, 7)
  ]);
  const tierOptions = getTierOptions(planType, answers, supportedTypes);
  const candidates = [];
  const limit = planType === "basic" ? 64 : planType === "value" ? 67 : 67;
  const optionSets = [
    bayOptions,
    [20, 30, 40],
    [30, 40, 50],
    [10, 20, 30],
    tierOptions.shoeGroups,
    tierOptions.trouserRack,
    tierOptions.jewelryBox,
    tierOptions.cabinet,
    tierOptions.glassShelf,
    tierOptions.lighting
  ];

  for (let sequence = 0; sequence < limit; sequence += 1) {
    const [
      bayCount,
      longHangRatio,
      shortHangRatio,
      shelfRatio,
      shoeGroups,
      trouserRack,
      jewelryBox,
      cabinet,
      glassShelf,
      lighting
    ] = optionSets.map((options, index) => options[
      Math.floor(sequence / Math.max(1, optionSets
        .slice(0, index)
        .reduce((product, values) => product * values.length, 1))) % options.length
    ]);
    candidates.push(createCandidate({
      answers,
      rulesData,
      supportedTypes,
      planType,
      planOutput,
      bayCount,
      longHangRatio,
      shortHangRatio,
      shelfRatio,
      shoeGroups,
      trouserRack,
      jewelryBox,
      cabinet,
      glassShelf,
      lighting,
      sequence
    }));
  }
  return candidates;
}

function getTierOptions(planType, answers, supportedTypes) {
  const hasShoes = answers.needs.鞋子 > 0;
  const hasTrousers = answers.needs.裤子 > 0 && supportedTypes.has("trouserRack");
  const hasJewelry = answers.needs.首饰 > 0 && supportedTypes.has("jewelryBox");
  if (planType === "basic") {
    return {
      shoeGroups: hasShoes ? [1] : [0],
      trouserRack: [0],
      jewelryBox: [0],
      cabinet: supportedTypes.has("cabinet") ? [0, 1] : [0],
      glassShelf: [0],
      lighting: [false]
    };
  }
  if (planType === "value") {
    return {
      shoeGroups: hasShoes ? [1, 2] : [0],
      trouserRack: hasTrousers ? [1, 0] : [0],
      jewelryBox: hasJewelry ? [1, 0] : [0],
      cabinet: supportedTypes.has("cabinet") ? [1, 2] : [0],
      glassShelf: answers.needs.展示收藏 > 0 && supportedTypes.has("glassShelf") ? [0, 1] : [0],
      lighting: [false, true]
    };
  }
  return {
    shoeGroups: hasShoes ? [1, 2] : [0],
    trouserRack: hasTrousers ? [1, 2] : [0],
    jewelryBox: hasJewelry ? [1, 2] : [0],
    cabinet: supportedTypes.has("cabinet") ? [2, 3] : [0],
    glassShelf: answers.needs.展示收藏 > 0 && supportedTypes.has("glassShelf") ? [1, 2] : [0],
    lighting: [true]
  };
}

function createCandidate(options) {
  const {
    answers, planType, planOutput, bayCount, longHangRatio, shortHangRatio,
    shelfRatio, shoeGroups, trouserRack, jewelryBox, cabinet, glassShelf,
    lighting, sequence
  } = options;
  const hasLong = answers.needs.长衣 > 0;
  const hasShort = answers.needs.短衣 > 0;
  const longGroups = hasLong ? clamp(Math.round((bayCount * longHangRatio) / 100), 1, 3) : 0;
  const shortGroups = hasShort ? Math.max(1, Math.round((bayCount * shortHangRatio) / 100 / 2)) : 0;
  const shelfCount = Math.max(1, Math.round((bayCount * shelfRatio) / 100) + (planType === "premium" ? 2 : 0));
  const parameters = {
    bayCount, longHangRatio, shortHangRatio, shelfRatio, shoeGroups,
    trouserRack, jewelryBox, cabinet, glassShelf, lighting, longGroups,
    shortGroups, shelfCount
  };
  const placements = buildAbstractPlacements(answers, parameters, planType, options.supportedTypes);
  const configPreset = buildCandidateConfigPreset(answers, planType, planOutput, parameters, placements);
  const estimatedPrice = estimateCandidatePrice(answers.budgetRange, planType, parameters, options.rulesData);
  return {
    planId: `${planType}:${bayCount}:${sequence}`,
    planType,
    planName: PLAN_NAMES[planType],
    zones: unique(placements.map((placement) => placement.zoneType)),
    placements,
    estimatedCapacity: planOutput.capacity,
    estimatedPrice,
    scores: null,
    configPreset,
    parameters,
    coverageTarget: PLAN_LEVELS[planType]
  };
}

function buildAbstractPlacements(answers, parameters, planType, supportedTypes) {
  const placements = [];
  let bayCursor = 0;
  let hangIndex = 0;
  const wallMounted = getSelectedSeriesId(answers) === "wall-mounted-v2";
  for (let index = 0; index < parameters.longGroups; index += 1) {
    const slot = wallMounted
      ? getWallMountedHangSlot(answers.layoutType, hangIndex, bayCursor)
      : { wallId: "back", bayIndex: bayCursor };
    placements.push(placement("longHangZone", "singleRail", slot.bayIndex, 1650, slot.wallId));
    if (!wallMounted) placements.push(placement("longHangZone", "woodShelf", bayCursor, 2050));
    hangIndex += 1;
    if (slot.wallId === "back") bayCursor += 1;
  }
  for (let index = 0; index < parameters.shortGroups; index += 1) {
    const slot = wallMounted
      ? getWallMountedHangSlot(answers.layoutType, hangIndex, bayCursor)
      : { wallId: "back", bayIndex: bayCursor };
    placements.push(placement("shortHangZone", "singleRail", slot.bayIndex, 1050, slot.wallId));
    placements.push(placement("shortHangZone", "singleRail", slot.bayIndex, 2000, slot.wallId));
    hangIndex += 1;
    if (slot.wallId === "back") bayCursor += 1;
  }
  for (let group = 0; group < parameters.shoeGroups; group += 1) {
    const bay = Math.min(parameters.bayCount - 1, bayCursor + group);
    [250, 500, 750].forEach((height) => placements.push(placement("shoeZone", "woodShelf", bay, height)));
  }
  const storageBays = getStorageBays(parameters.bayCount, bayCursor + parameters.shoeGroups, answers.layoutType);
  const luggageSlot = answers.needs.行李箱 > 0 ? storageBays[storageBays.length - 1] : null;
  const componentBays = luggageSlot
    ? storageBays.filter((slot) => slot !== luggageSlot)
    : storageBays;
  const restrictedComponentBays = answers.roomDepth < 650
    ? componentBays.filter((slot) => slot.wallId === "back")
    : componentBays;
  distributePlacements(placements, "trouserZone", "trouserRack", parameters.trouserRack, componentBays, [750]);
  distributePlacements(
    placements,
    "jewelryZone",
    "jewelryBox",
    parameters.jewelryBox,
    [...getRestrictedPlacementBays(restrictedComponentBays, componentBays, parameters.jewelryBox)].reverse(),
    [1100, 1300]
  );
  distributePlacements(
    placements,
    "storageZone",
    "cabinet",
    parameters.cabinet,
    getRestrictedPlacementBays(restrictedComponentBays, componentBays, parameters.cabinet),
    [0]
  );
  distributePlacements(placements, "storageZone", "woodShelf", parameters.shelfCount, componentBays, [300, 700, 2050]);
  distributePlacements(
    placements,
    "displayZone",
    "glassShelf",
    parameters.glassShelf,
    [...getRestrictedPlacementBays(restrictedComponentBays, componentBays, parameters.glassShelf)].reverse(),
    [1200, 1400]
  );
  if (answers.needs.行李箱 > 0) {
    placements.push({
      zoneType: "luggageZone",
      componentType: "",
      wallId: luggageSlot.wallId,
      bayIndex: luggageSlot.bayIndex,
      heightFromFloor: 0,
      reservedHeight: 800
    });
  }
  if (wallMounted) {
    attachWallMountedShelfDependencies(placements, answers, planType, supportedTypes);
  }
  return placements;
}

function getWallMountedHangSlot(layoutType, hangIndex, backBayIndex) {
  const walls = layoutType === "U型"
    ? ["back", "left", "right"]
    : layoutType === "L型" ? ["back", "left"] : ["back"];
  const wallId = walls[hangIndex % walls.length];
  return {
    wallId,
    bayIndex: wallId === "back" ? backBayIndex : Math.floor(hangIndex / walls.length)
  };
}

function attachWallMountedShelfDependencies(placements, answers, planType, supportedTypes) {
  const shelfType = resolveWallMountedShelfType({ planType, needs: answers.needs, supportedTypes });
  if (!shelfType) return;
  placements.filter((item) => item.componentType === "singleRail").forEach((rail, index) => {
    const dependencyId = `wall-mounted:${rail.wallId}:${rail.bayIndex}:${rail.zoneType}:${rail.heightFromFloor}:${index}`;
    const created = createWallMountedRailWithShelfPlacement({
      rail,
      shelf: { zoneType: rail.zoneType },
      shelfType,
      dependencyId
    });
    Object.assign(rail, created.railPlacement);
    const linkedShelf = {
      ...created.linkedShelfPlacement,
      linkedRailDependencyId: dependencyId,
      linkedRailHeight: rail.heightFromFloor,
      isLinkedRailShelf: true
    };
    placements.push(linkedShelf);
  });
}

function validateWallMountedRailDependencies(placements) {
  const rails = placements.filter((item) => item.componentType === "singleRail");
  return rails.every((rail) => {
    const dependency = rail.shelfDependency;
    if (!dependency
      || Number(rail.distanceFromWall) !== WALL_MOUNTED_PLACEMENT_RULES.railDistanceFromWallMm) return false;
    return placements.some((item) => item.isLinkedRailShelf
      && item.linkedRailDependencyId === dependency.dependencyId
      && ["woodShelf", "glassShelf"].includes(item.componentType)
      && item.wallId === rail.wallId
      && item.bayIndex === rail.bayIndex
      && Number(item.heightFromFloor) > Number(rail.heightFromFloor));
  });
}

function getRestrictedPlacementBays(preferredBays, fallbackBays, count) {
  return count <= preferredBays.length ? preferredBays : fallbackBays;
}

function buildCandidateConfigPreset(answers, planType, planOutput, parameters, placements) {
  const requirements = planOutput.zones.map((zone) => ({
    zoneType: zone.zoneType,
    itemType: zone.itemType,
    demandQuantity: zone.quantity,
    demandWeight: zone.weight,
    preferredComponent: zone.componentType,
    allowedComponents: zone.allowedComponents,
    quantity: zone.requiredUnits,
    heightFromFloor: zone.railHeights?.[0] || 0,
    clearHeight: zone.clearHeight,
    idealClearHeight: zone.idealClearHeight,
    exclusiveBay: zone.exclusiveBay,
    railHeights: zone.railHeights,
    priorityIndex: zone.priorityIndex
  }));
  overrideRequirement(requirements, "longHangZone", "singleRail", parameters.longGroups);
  overrideRequirement(requirements, "shortHangZone", "singleRail", parameters.shortGroups);
  overrideRequirement(requirements, "shoeZone", "woodShelf", parameters.shoeGroups * 3);
  overrideRequirement(requirements, "trouserZone", "trouserRack", parameters.trouserRack);
  overrideRequirement(requirements, "jewelryZone", "jewelryBox", parameters.jewelryBox);
  overrideRequirement(requirements, "displayZone", parameters.glassShelf ? "glassShelf" : "woodShelf", parameters.glassShelf);
  overrideRequirement(requirements, "storageZone", "cabinet", parameters.cabinet);
  const preset = {
    productSystemId: getSelectedSeriesId(answers),
    spaceType: answers.spaceType,
    layoutType: answers.layoutType,
    planType,
    roomWidth: answers.roomWidth,
    roomDepth: answers.roomDepth,
    roomHeight: answers.roomHeight,
    budgetRange: answers.budgetRange,
    bayCount: parameters.bayCount,
    zoneRequirements: requirements.filter((requirement) => Number(requirement.quantity || 0) > 0
      || requirement.preferredComponent === "NONE"),
    componentQuantities: countComponents(requirements),
    lighting: planType === "basic" ? false : parameters.lighting,
    shelfLevel: planType === "basic" ? "basic" : planType === "value" ? "medium" : "high",
    candidatePlanId: `${planType}:${parameters.bayCount}`
  };
  if (getSelectedSeriesId(answers) === "wall-mounted-v2") {
    preset.wallMountedRailDependencies = placements
      .filter((item) => item.componentType === "singleRail" && item.shelfDependency)
      .map((item) => ({
        ...item.shelfDependency,
        railZoneType: item.zoneType,
        railHeightFromFloor: item.heightFromFloor,
        wallMountedOffsetPosition: item.wallMountedOffsetPosition
      }));
  }
  return preset;
}

function overrideRequirement(requirements, zoneType, componentType, quantity) {
  const existing = requirements.find((requirement) => requirement.zoneType === zoneType);
  if (existing) {
    existing.preferredComponent = componentType;
    existing.quantity = quantity;
    return;
  }
  if (quantity <= 0) return;
  requirements.push({
    zoneType,
    preferredComponent: componentType,
    allowedComponents: [componentType],
    quantity,
    priorityIndex: 50
  });
}

function estimateCandidatePrice(budgetRange, planType, parameters, rulesData) {
  const pricing = rulesData.pricingByKey?.get(`${budgetRange}:${planType}`)
    || getPlanPriceFromRules(budgetRange, planType);
  const min = number(pricing.minPrice ?? pricing.min, 0);
  const max = number(pricing.maxPrice ?? pricing.max, min);
  const base = (min + max) / 2;
  const upgradeUnits = parameters.cabinet + parameters.glassShelf
    + parameters.jewelryBox + parameters.trouserRack + (parameters.lighting ? 1 : 0);
  const estimated = Math.round((base + upgradeUnits * 80) / 100) * 100;
  return planType === "premium" ? Math.min(estimated, getPremiumBudgetCap(budgetRange)) : estimated;
}

function validateBudget(candidate, budgetRange) {
  const range = parseBudgetRange(budgetRange);
  if (candidate.planType === "basic") return candidate.estimatedPrice <= Math.max(range.max, range.min * 1.6);
  if (candidate.planType === "value") return candidate.estimatedPrice <= Math.max(range.max * 1.25, range.min);
  return candidate.estimatedPrice <= getPremiumBudgetCap(budgetRange);
}

function getPremiumBudgetCap(budgetRange) {
  const normalized = String(budgetRange || "").replace(/[\s,]/g, "");
  const fixedCaps = {
    "3000以下": 6000,
    "3000-5000": 10000,
    "5000-8000": 15000,
    "8000-12000": 22000
  };
  if (fixedCaps[normalized]) return fixedCaps[normalized];
  const range = parseBudgetRange(budgetRange);
  return Math.round((range.max * 1.8) / 100) * 100;
}

function calculateCandidateCoverage(candidate, answers, capacityPlacements = candidate.placements || []) {
  const requiredZones = [];
  if (answers.needs.长衣 > 0) requiredZones.push("longHangZone");
  if (answers.needs.短衣 > 0) requiredZones.push("shortHangZone");
  if (answers.needs.鞋子 > 0) requiredZones.push("shoeZone");
  if (answers.needs.裤子 > 0) requiredZones.push("trouserZone");
  if (answers.needs.首饰 > 0) requiredZones.push("jewelryZone");
  if (answers.needs.展示收藏 > 0) requiredZones.push("displayZone");
  if (!requiredZones.length) return candidate.coverageTarget;
  const usableZones = new Set(capacityPlacements.map((placement) => placement.zoneType));
  const met = requiredZones.filter((zoneType) => usableZones.has(zoneType)).length;
  return clamp((met / requiredZones.length) * candidate.coverageTarget + 0.15, 0, 1);
}

function scoreLayout(candidate, answers) {
  let score = 0.5;
  if (answers.needs.长衣 <= 0 || candidate.zones.includes("longHangZone")) score += 0.15;
  if (answers.needs.短衣 <= 0 || candidate.zones.includes("shortHangZone")) score += 0.15;
  if (answers.needs.鞋子 <= 0 || candidate.zones.includes("shoeZone")) score += 0.1;
  const bayCounts = countBy(candidate.placements.filter((placement) => placement.componentType), (placement) => placement.bayIndex);
  const maxShare = Math.max(0, ...Object.values(bayCounts)) / Math.max(1, candidate.placements.length);
  if (maxShare <= 0.6) score += 0.1;
  return clamp(score, 0, 1);
}

function scoreVisual(candidate) {
  const shelfHeights = candidate.placements.filter((placement) => SHELF_TYPES.has(placement.componentType))
    .map((placement) => placement.heightFromFloor);
  const aligned = shelfHeights.length <= 1
    ? 1
    : 1 - Math.min(1, unique(shelfHeights).length / shelfHeights.length);
  const cabinetsAtBottom = candidate.placements
    .filter((placement) => placement.componentType === "cabinet")
    .every((placement) => placement.heightFromFloor <= 300);
  return clamp(0.55 + aligned * 0.3 + (cabinetsAtBottom ? 0.15 : 0), 0, 1);
}

function scoreBudget(candidate) {
  const price = candidate.estimatedPrice;
  const target = getPlanPriceFromRules(candidate.configPreset.budgetRange || "", candidate.planType).price || price;
  return clamp(1 - Math.abs(price - target) / Math.max(1, target), 0, 1);
}

function scoreUpgrade(candidate, answers) {
  const experienceCount = candidate.placements.filter((placement) => (
    EXPERIENCE_TYPES.has(placement.componentType)
  )).length + (candidate.parameters.lighting ? 1 : 0);
  const relevantZones = [
    answers.needs.裤子 > 0 ? "trouserZone" : "",
    answers.needs.首饰 > 0 ? "jewelryZone" : "",
    answers.needs.展示收藏 > 0 ? "displayZone" : ""
  ].filter(Boolean);
  const completeZones = relevantZones.filter((zoneType) => candidate.zones.includes(zoneType)).length;
  const completeness = relevantZones.length ? completeZones / relevantZones.length : 1;
  if (candidate.planType === "basic") {
    return roundScore(Math.min(2, 0.5 + completeness * 0.5));
  }
  if (candidate.planType === "value") {
    return roundScore(Math.min(6, 2.5 + experienceCount * 1.2 + completeness * 1.5));
  }
  return roundScore(Math.min(10, 6.5 + experienceCount * 0.8 + completeness * 1.5));
}

function validateSideWallSpace(placements, roomDepth) {
  const effectiveDepth = Number(roomDepth) || 0;
  if (effectiveDepth >= 650) return true;
  return placements.every((placement) => !["left", "right"].includes(placement.wallId)
    || !SIDE_WALL_RESTRICTED_TYPES.has(placement.componentType));
}

function validateLuggageExclusivity(placements) {
  const luggageSlots = new Set(placements
    .filter((placement) => placement.zoneType === "luggageZone")
    .map((placement) => `${placement.wallId}:${placement.bayIndex}`));
  return placements.every((placement) => !luggageSlots.has(`${placement.wallId}:${placement.bayIndex}`)
    || placement.zoneType === "luggageZone"
    || !LUGGAGE_CONFLICT_TYPES.has(placement.componentType));
}

function toCandidateDebugSummary(candidate) {
  return {
    planId: candidate.planId,
    planType: candidate.planType,
    scores: { ...candidate.scores },
    estimatedPrice: candidate.estimatedPrice,
    estimatedCapacity: candidate.estimatedCapacity,
    bayCount: candidate.parameters?.bayCount || 0,
    zoneDistribution: countBy(candidate.placements, (placement) => placement.zoneType),
    componentCount: countBy(
      candidate.placements.filter((placement) => placement.componentType),
      (placement) => placement.componentType
    ),
    placementCount: candidate.placements.length
  };
}

function validateLongHangClearance(placements) {
  const groups = groupPlacements(placements);
  return Object.values(groups).every((items) => items
    .filter((item) => item.zoneType === "longHangZone" && item.componentType === "singleRail")
    .every((rail) => items
      .filter((item) => item.heightFromFloor < rail.heightFromFloor && item.componentType)
      .every((item) => rail.heightFromFloor - intervalFor(item)[1] >= 1350)));
}

function validateShortHangHeights(placements) {
  const shortRails = placements.filter((placement) => placement.zoneType === "shortHangZone"
    && placement.componentType === "singleRail");
  return shortRails.every((rail) => (rail.heightFromFloor >= 900 && rail.heightFromFloor <= 1100)
    || (rail.heightFromFloor >= 1900 && rail.heightFromFloor <= 2050));
}

function validateShoeGaps(placements) {
  const groups = groupPlacements(placements.filter((placement) => placement.zoneType === "shoeZone"
    && SHELF_TYPES.has(placement.componentType)));
  return Object.values(groups).every((items) => {
    const heights = items.map((item) => item.heightFromFloor).sort((a, b) => a - b);
    return heights.slice(1).every((height, index) => height - heights[index] - 40 >= SHOE_SHELF_MIN_GAP);
  });
}

function getShelfUsabilityRejectReason(placements) {
  const groups = groupPlacements(placements.filter(isOrdinaryCapacityShelf));
  for (const shelves of Object.values(groups)) {
    const sorted = [...shelves].sort((a, b) => a.heightFromFloor - b.heightFromFloor);
    const gaps = sorted.slice(1).map((shelf, index) => ({
      lower: sorted[index],
      upper: shelf,
      clearGap: getShelfClearGap(sorted[index], shelf)
    }));
    if (gaps.some(({ lower, upper, clearGap }) => (
      clearGap < Math.max(getShelfMinimumGap(lower), getShelfMinimumGap(upper))
    ))) {
      return "shelfGapTooSmall";
    }
    if (sorted.length >= 3 && gaps.some(({ clearGap }) => clearGap < DENSE_SHELF_MIN_GAP)) {
      return "denseShelfStackUnusable";
    }
  }
  return "";
}

function getUsableCapacityPlacements(placements) {
  const usableShelves = new Set();
  const groups = groupPlacements(placements.filter((placement) => SHELF_TYPES.has(placement.componentType)));
  Object.values(groups).forEach((shelves) => {
    const sorted = [...shelves].sort((a, b) => a.heightFromFloor - b.heightFromFloor);
    sorted.forEach((shelf, index) => {
      const previous = sorted[index - 1];
      const next = sorted[index + 1];
      const minimumGap = shelf.zoneType === "shoeZone" ? SHOE_SHELF_MIN_GAP : getShelfMinimumGap(shelf);
      const previousUsable = !previous || getShelfClearGap(previous, shelf) >= Math.max(
        minimumGap,
        previous.zoneType === "shoeZone" ? SHOE_SHELF_MIN_GAP : getShelfMinimumGap(previous)
      );
      const nextUsable = !next || getShelfClearGap(shelf, next) >= Math.max(
        minimumGap,
        next.zoneType === "shoeZone" ? SHOE_SHELF_MIN_GAP : getShelfMinimumGap(next)
      );
      if (previousUsable && nextUsable) usableShelves.add(shelf);
    });
  });
  return placements.filter((placement) => !SHELF_TYPES.has(placement.componentType)
    || usableShelves.has(placement));
}

function isOrdinaryCapacityShelf(placement) {
  return CAPACITY_SHELF_TYPES.has(placement.componentType) && placement.zoneType !== "shoeZone";
}

function getShelfMinimumGap(placement) {
  const itemType = String(placement.itemType || "").toLowerCase();
  if (placement.zoneType === "beddingZone" || itemType.includes("bedding") || itemType.includes("被褥")) return 400;
  if (placement.zoneType === "bagZone" || itemType.includes("bag") || itemType.includes("包")) return 300;
  if (placement.zoneType === "displayZone" || itemType.includes("display") || itemType.includes("展示")) return 300;
  return 280;
}

function getShelfClearGap(lowerShelf, upperShelf) {
  return Number(upperShelf.heightFromFloor || 0)
    - (Number(lowerShelf.heightFromFloor || 0) + Number(COMPONENT_HEIGHTS[lowerShelf.componentType] || 40));
}

export function getShelfGapDiagnostics(placements = []) {
  const diagnostics = [];
  const shelfPlacements = placements.filter((placement) => CAPACITY_SHELF_TYPES.has(placement.componentType));
  const groups = groupPlacements(shelfPlacements);
  Object.entries(groups).forEach(([bayKey, shelves]) => {
    const zoneGroups = {
      shoe: shelves.filter((shelf) => shelf.zoneType === "shoeZone"),
      ordinary: shelves.filter((shelf) => shelf.zoneType !== "shoeZone")
    };
    Object.entries(zoneGroups).forEach(([shelfClass, classShelves]) => {
      const sorted = [...classShelves].sort((a, b) => a.heightFromFloor - b.heightFromFloor);
      sorted.slice(1).forEach((shelf, index) => {
        diagnostics.push({
          bayKey,
          shelfClass,
          lowerZoneType: sorted[index].zoneType,
          upperZoneType: shelf.zoneType,
          lowerHeight: sorted[index].heightFromFloor,
          upperHeight: shelf.heightFromFloor,
          clearGap: getShelfClearGap(sorted[index], shelf),
          minGap: shelfClass === "shoe"
            ? SHOE_SHELF_MIN_GAP
            : Math.max(getShelfMinimumGap(sorted[index]), getShelfMinimumGap(shelf))
        });
      });
    });
  });
  return diagnostics;
}

function hasPlacementOverlap(placements) {
  const groups = groupPlacements(placements.filter((placement) => placement.componentType));
  return Object.values(groups).some((items) => items.some((item, index) => items.slice(index + 1)
    .some((other) => intervalsOverlap(intervalFor(item), intervalFor(other)))));
}

function intervalFor(placement) {
  const height = COMPONENT_HEIGHTS[placement.componentType] || 100;
  const rail = placement.componentType === "singleRail" || placement.componentType === "doubleRail";
  return rail
    ? [placement.heightFromFloor - height / 2, placement.heightFromFloor + height / 2]
    : [placement.heightFromFloor, placement.heightFromFloor + height];
}

function intervalsOverlap(a, b) {
  return a[0] < b[1] + 20 && a[1] > b[0] - 20;
}

function normalizeAnswers(answers) {
  const dimensions = answers.dimensions || {};
  return {
    roomWidth: number(dimensions.width ?? answers.roomWidth, 3600),
    roomDepth: number(dimensions.depth ?? answers.roomDepth, 2800),
    roomHeight: number(dimensions.height ?? answers.roomHeight, 2700),
    layoutType: dimensions.layoutType || answers.layoutType || "I型",
    peopleCount: answers.people || answers.peopleCount || "1人",
    budgetRange: answers.budget || answers.budgetRange || "8,000 - 12,000",
    spaceType: answers.spaceUse || answers.spaceType || "",
    needs: normalizeNeeds(answers),
    selectedProductSystem: answers.selectedProductSystem || null
  };
}

function getSelectedSeriesId(answers = {}) {
  return answers.selectedProductSystem?.seriesId
    || answers.selectedProductSystem?.id
    || "";
}

function normalizeNeeds(answers) {
  const source = answers.demands && !Array.isArray(answers.demands)
    ? answers.demands
    : answers.demandsWeights || answers.needWeights || answers.needs || {};
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, number(value, 0)]));
}

function getSupportedTypes(seriesId) {
  const map = PLANNER_COMPONENT_MAP[seriesId] || {};
  return new Set(["singleRail", "doubleRail", "woodShelf", ...Object.values(map)].filter(Boolean));
}

function distributePlacements(target, zoneType, componentType, count, bays, heights) {
  if (!bays.length) return;
  for (let index = 0; index < count; index += 1) {
    const slot = bays[index % bays.length];
    target.push(placement(
      zoneType,
      componentType,
      slot.bayIndex,
      heights[Math.floor(index / bays.length) % heights.length]
      ,
      slot.wallId
    ));
  }
}

function getStorageBays(bayCount, start, layoutType) {
  const bays = Array.from({ length: Math.max(1, bayCount - start) }, (_, index) => ({
    wallId: "back",
    bayIndex: start + index
  })).filter((slot) => slot.bayIndex < bayCount);
  if (layoutType === "L型" || layoutType === "U型") bays.push({ wallId: "left", bayIndex: 0 });
  if (layoutType === "U型") bays.push({ wallId: "right", bayIndex: 0 });
  return bays.length ? bays : [{ wallId: "back", bayIndex: Math.max(0, bayCount - 1) }];
}

function placement(zoneType, componentType, bayIndex, heightFromFloor, wallId = "back") {
  return { zoneType, componentType, wallId, bayIndex, heightFromFloor };
}

function countComponents(requirements) {
  const result = {};
  requirements.forEach((requirement) => {
    if (!requirement.preferredComponent || requirement.preferredComponent === "NONE") return;
    result[requirement.preferredComponent] = (result[requirement.preferredComponent] || 0)
      + Number(requirement.quantity || 0);
  });
  return result;
}

function groupPlacements(placements) {
  return placements.reduce((groups, placement) => {
    const key = `${placement.wallId}:${placement.bayIndex}`;
    (groups[key] ||= []).push(placement);
    return groups;
  }, {});
}

function countBy(items, getKey) {
  return items.reduce((result, item) => {
    const key = getKey(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function parseBudgetRange(label) {
  if (label === "3,000以下") return { min: 0, max: 3000 };
  if (label === "18,000+") return { min: 18000, max: 22000 };
  const values = String(label || "").match(/[\d,]+/g)?.map((value) => Number(value.replace(/,/g, ""))) || [];
  return { min: values[0] || 0, max: values[1] || values[0] || 12000 };
}

function unique(values) {
  return [...new Set(values)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}
