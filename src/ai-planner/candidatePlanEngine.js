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
import {
  findSimilarJapaneseCases,
  getJapaneseCaseDistributionTarget
} from "./japaneseCaseLibrary.js?v=japanese-case-library-20260622-02";

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
const JAPANESE_CLOSET_AI_PRICES = {
  basicHangGroup: 780,
  storageGroup: 1800,
  woodTop: 240,
  singleRail: 60,
  doubleRail: 110,
  woodShelf: 160,
  cabinet: 800,
  jewelryBoxWithShelf: 700,
  trouserRackWithShelf: 660
};
const JAPANESE_CLOSET_SERVICE_PRICE_FACTORS = {
  basic: 1.35,
  value: 1.32,
  premium: 1.30
};
const JAPANESE_VISIBLE_UPGRADE_COMPONENTS = new Set([
  "cabinet", "trouserRack", "jewelryBox", "glassShelf"
]);
const JAPANESE_FUNCTIONAL_COMPONENTS = new Set([
  "singleRail", "doubleRail", "woodShelf", "cabinet", "jewelryBox", "trouserRack"
]);
const JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS = Object.freeze([900, 800, 700, 600, 500]);
const JAPANESE_CASE_MATCH_WEIGHT = 0.20;
const JAPANESE_CASE_SCORE_MAX = 25;
const JAPANESE_CASE_TOLERANCE = Object.freeze({ basic: 0.30, value: 0.20, premium: 0.15 });

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
  budgetAvailability: null,
  matchedJapaneseCases: [],
  primaryCaseId: null,
  primaryCaseScore: null,
  secondaryCaseIds: [],
  caseMatchWeight: 0,
  caseDistributionTarget: {},
  heatmap: {}
};

export function generateCandidatePlans(answers = {}, rulesData = {}) {
  const normalized = normalizeAnswers(answers);
  normalized.matchedJapaneseCases = getSelectedSeriesId(normalized) === "japanese-closet"
    ? (answers.matchedJapaneseCases || findSimilarJapaneseCases(answers))
    : [];
  normalized.primaryJapaneseCase = normalized.matchedJapaneseCases[0] || null;
  normalized.japaneseHardRequirements = getJapaneseHardRequirements(normalized);
  if (normalized.primaryJapaneseCase) applyPrimaryJapaneseCaseNeeds(normalized);
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
    budgetAvailability: getCandidateBudgetAvailability(normalized),
    matchedJapaneseCases: normalized.matchedJapaneseCases.map(toJapaneseCaseDebugSummary),
    primaryCaseId: normalized.primaryJapaneseCase?.caseId || null,
    primaryCaseScore: normalized.primaryJapaneseCase?.score ?? null,
    secondaryCaseIds: normalized.matchedJapaneseCases.slice(1).map((caseData) => caseData.caseId),
    caseMatchWeight: normalized.primaryJapaneseCase ? JAPANESE_CASE_MATCH_WEIGHT : 0,
    caseDistributionTarget: normalized.primaryJapaneseCase
      ? getJapaneseCaseDistributionTarget(normalized.primaryJapaneseCase)
      : {},
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
  const hardRequirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  candidate.rejectReason = "";
  if (getSelectedSeriesId(answers) === "wall-mounted-v2"
    && !validateWallMountedRailDependencies(placements)) {
    return rejectCandidate(candidate, "wallMountedRailMissingShelf");
  }
  if (getSelectedSeriesId(answers) === "japanese-closet"
    && !validateJapaneseBayCoverage(candidate)) {
    return rejectCandidate(candidate, "japaneseEmptyBay");
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
  if (candidate.planType === "premium" && hardRequirements.requiresJewelryBox
    && (supportedTypes.has("jewelryBox") || supportedTypes.has("mixedStorage"))
    && !placements.some((placement) => ["jewelryBox", "mixedStorage"].includes(placement.componentType))) {
    return rejectCandidate(candidate, "premiumMissingJewelryBox");
  }
  if (candidate.planType === "premium" && hardRequirements.requiresTrouserRack
    && (supportedTypes.has("trouserRack") || supportedTypes.has("mixedStorage"))
    && !placements.some((placement) => ["trouserRack", "mixedStorage"].includes(placement.componentType))) {
    return rejectCandidate(candidate, "premiumMissingTrouserRack");
  }
  if (candidate.planType === "value"
    && (hardRequirements.valuePrefersJewelryBox || hardRequirements.valuePrefersTrouserRack)
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
  const caseDistribution = getJapaneseCaseDistributionMetrics(candidate, answers.primaryJapaneseCase);
  const caseTolerance = JAPANESE_CASE_TOLERANCE[candidate.planType] || 0.20;
  const casePenaltyFactor = caseDistribution.maxDelta > caseTolerance
    ? caseTolerance / caseDistribution.maxDelta
    : 1;
  const layoutScore = scoreLayout(candidate, answers) * 30
    * (getSelectedSeriesId(answers) === "japanese-closet" ? casePenaltyFactor : 1);
  const visualScore = scoreVisual(candidate) * 20;
  const budgetScore = scoreBudget(candidate) * 10;
  const upgradeScore = scoreUpgrade(candidate, answers);
  const caseMatchBonus = getSelectedSeriesId(answers) === "japanese-closet"
    ? scoreJapaneseCaseMatch(answers.primaryJapaneseCase, caseDistribution, casePenaltyFactor)
    : 0;
  return {
    totalScore: roundScore(storageScore + layoutScore + visualScore + budgetScore + upgradeScore + caseMatchBonus),
    storageScore: roundScore(storageScore),
    layoutScore: roundScore(layoutScore),
    visualScore: roundScore(visualScore),
    budgetScore: roundScore(budgetScore),
    upgradeScore: roundScore(upgradeScore),
    caseMatchBonus: roundScore(caseMatchBonus),
    caseMatchWeight: getSelectedSeriesId(answers) === "japanese-closet" ? JAPANESE_CASE_MATCH_WEIGHT : 0,
    candidateDistribution: caseDistribution.candidateDistribution,
    caseDistributionTarget: caseDistribution.targetDistribution,
    distributionDelta: caseDistribution.distributionDelta,
    distributionMaxDelta: roundScore(caseDistribution.maxDelta),
    caseTolerance
  };
}

function scoreJapaneseCaseMatch(primaryCase, distribution, penaltyFactor) {
  if (!primaryCase) return 0;
  const similarity = Math.max(0, 1 - distribution.meanDelta);
  return JAPANESE_CASE_SCORE_MAX * similarity * penaltyFactor;
}

function getJapaneseCaseDistributionMetrics(candidate, primaryCase) {
  if (!primaryCase) {
    return { candidateDistribution: {}, targetDistribution: {}, distributionDelta: {}, maxDelta: 0, meanDelta: 0 };
  }
  const targetDistribution = getJapaneseCaseDistributionTarget(primaryCase);
  const zoneCounts = countBy(candidate.placements || [], (placement) => placement.zoneType);
  const keys = Object.keys(targetDistribution);
  const candidateTotal = keys.reduce((sum, key) => sum + Number(zoneCounts[key] || 0), 0) || 1;
  const candidateDistribution = Object.fromEntries(keys.map((key) => [
    key,
    roundScore(Number(zoneCounts[key] || 0) / candidateTotal)
  ]));
  const distributionDelta = Object.fromEntries(keys.map((key) => [
    key,
    roundScore(Math.abs(candidateDistribution[key] - targetDistribution[key]))
  ]));
  const deltas = Object.values(distributionDelta);
  return {
    candidateDistribution,
    targetDistribution,
    distributionDelta,
    maxDelta: Math.max(0, ...deltas),
    meanDelta: deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length)
  };
}

export function selectRecommendedCandidates(candidates = [], answers = {}) {
  const normalizedAnswers = normalizeAnswers(answers);
  normalizedAnswers.japaneseHardRequirements = getJapaneseHardRequirements(normalizedAnswers);
  if (normalizedAnswers.primaryJapaneseCase) applyPrimaryJapaneseCaseNeeds(normalizedAnswers);
  const seriesId = getSelectedSeriesId(normalizedAnswers);
  const supportedTypes = getSupportedTypes(seriesId);
  if (seriesId === "japanese-closet") {
    return selectJapaneseClosetCandidates(candidates, normalizedAnswers, supportedTypes);
  }
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

function selectJapaneseClosetCandidates(candidates, answers, supportedTypes) {
  const reasons = [];
  const targets = getJapaneseClosetTargetPrices(answers);
  const basicCandidates = getTierCandidates(candidates, "basic");
  const valueCandidates = getTierCandidates(candidates, "value");
  const premiumCandidates = getTierCandidates(candidates, "premium");

  const basic = selectJapaneseCandidateByTarget(
    basicCandidates,
    null,
    "basic",
    targets.basic,
    { min: targets.basicMin, max: targets.basicMax }
  )
    || cloneCandidateForTier([...candidates].sort((a, b) => (
      Math.abs(Number(a.estimatedPrice || 0) - targets.basic)
      - Math.abs(Number(b.estimatedPrice || 0) - targets.basic)
    ))[0], "basic");
  applyJapaneseCaseLayoutTemplate(basic, answers, "basic");
  annotateJapaneseSelection(basic, targets.basic, "closestToBudgetLowerAnchor", targets);

  let value = selectJapaneseCandidateByTarget(
    valueCandidates,
    basic,
    "value",
    targets.value,
    { min: targets.budgetMin, max: targets.budgetMax }
  );
  if (!value) {
    value = createJapaneseTargetFallbackCandidate(
      basic,
      answers,
      supportedTypes,
      "value",
      targets.value,
      { min: targets.budgetMin, max: targets.budgetMax }
    );
    reasons.push("valueDerivedTowardTargetPrice");
  } else {
    reasons.push("valueSelectedInsideBudgetWithDifference");
  }
  applyJapaneseCaseLayoutTemplate(value, answers, "value");
  value = enforceJapaneseHardRequirements(value, basic, answers, supportedTypes, "value");
  annotateJapaneseSelection(value, targets.value, "insideBudgetWithUpgrade", targets);

  let premium = selectJapaneseCandidateByTarget(
    premiumCandidates,
    value,
    "premium",
    targets.premium,
    { min: targets.budgetMax, max: targets.premiumMax, strictMin: true }
  );
  if (!premium) {
    premium = createJapaneseTargetFallbackCandidate(
      value,
      answers,
      supportedTypes,
      "premium",
      targets.premium,
      { min: targets.budgetMax, max: targets.premiumMax, strictMin: true }
    );
    premium ||= [...premiumCandidates].sort((a, b) => (
      Number(b.finalPlanPrice ?? b.estimatedPrice ?? 0)
      - Number(a.finalPlanPrice ?? a.estimatedPrice ?? 0)
    ))[0] || null;
    reasons.push("premiumDerivedAboveBudget");
  } else {
    reasons.push("premiumSelectedAboveBudgetWithDifference");
  }
  premium = ensureJapanesePremiumAnchorPrice(premium, value, answers, supportedTypes, targets);
  applyJapaneseCaseLayoutTemplate(premium, answers, "premium");
  premium = enforceJapaneseHardRequirements(premium, value, answers, supportedTypes, "premium");
  annotateJapaneseSelection(
    premium,
    targets.premium,
    premium?.premiumCouldNotExceedBudget
      ? "highestRealCandidateCouldNotExceedBudget"
      : "aboveBudgetIdealAnchor",
    targets
  );

  const selected = [basic, value, premium];
  const missingPlanTypes = PLAN_TYPES.filter((planType, index) => !selected[index]);
  updateMissingPlanStats(missingPlanTypes, selected);
  updatePlanSimilarityStats(selected, reasons);
  return selected.filter(Boolean);
}

function applyJapaneseCaseLayoutTemplate(candidate, answers, planType) {
  if (!candidate || !answers.primaryJapaneseCase) return;
  candidate.placements = buildJapaneseCaseTemplatePlacements(
    answers,
    candidate.parameters || { bayCount: candidate.configPreset?.bayCount || 1 },
    planType
  );
  candidate.layoutTemplate = answers.primaryJapaneseCase.layoutTemplate || [];
  candidate.bayPlan = buildJapaneseBayPlan(
    candidate.placements,
    candidate.parameters?.bayCount || candidate.configPreset?.bayCount
  );
  candidate.templateViolationCount = countJapaneseTemplateViolations(
    candidate.placements,
    candidate.parameters?.bayCount || candidate.configPreset?.bayCount
  );
  finalizeDerivedCandidate(candidate, candidate, answers, planType, 1, 0);
}

function enforceJapaneseHardRequirements(candidate, sourceCandidate, answers, supportedTypes, planType) {
  if (!candidate) return null;
  const requirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  let changed = false;
  if (planType === "value") {
    const hasPriorityUpgrade = candidate.placements.some((item) => (
      (requirements.valuePrefersTrouserRack && item.componentType === "trouserRack")
      || (requirements.valuePrefersJewelryBox && item.componentType === "jewelryBox")
    ));
    if (!hasPriorityUpgrade) {
      const priorityComponents = [
        ...(requirements.valuePrefersTrouserRack ? ["trouserRack"] : []),
        ...(requirements.valuePrefersJewelryBox ? ["jewelryBox"] : [])
      ];
      changed = priorityComponents.some((componentType) => addRequiredJapaneseComponent(
        candidate,
        componentType,
        answers,
        requirements
      ));
    }
  }
  if (planType === "premium") {
    const requiredComponents = [
      ...(requirements.requiresTrouserRack && supportedTypes.has("trouserRack") ? ["trouserRack"] : []),
      ...(requirements.requiresJewelryBox && supportedTypes.has("jewelryBox") ? ["jewelryBox"] : []),
      ...(requirements.requiresCabinet && supportedTypes.has("cabinet") ? ["cabinet"] : [])
    ];
    requiredComponents.forEach((componentType) => {
      if (candidate.placements.some((item) => item.componentType === componentType)) return;
      changed = addRequiredJapaneseComponent(candidate, componentType, answers, requirements) || changed;
    });
  }
  if (changed) finalizeDerivedCandidate(candidate, sourceCandidate || candidate, answers, planType, 1, 1);

  const status = getJapaneseRequirementStatus(candidate, answers, requirements);
  candidate.premiumHardRequirements = {
    requiresTrouserRack: requirements.requiresTrouserRack,
    requiresJewelryBox: requirements.requiresJewelryBox,
    requiresCabinet: requirements.requiresCabinet
  };
  candidate.premiumRequirementStatus = status;
  candidate.caseLibraryAppliedAs = "layoutReferenceOnly";
  candidate.hardRuleOverrideCase = changed;
  candidate.bayPlan = buildJapaneseBayPlan(
    candidate.placements,
    candidate.parameters?.bayCount || candidate.configPreset?.bayCount
  );
  candidate.templateViolationCount = countJapaneseTemplateViolations(
    candidate.placements,
    candidate.parameters?.bayCount || candidate.configPreset?.bayCount
  );

  if (planType === "premium" && !status.allSatisfied) {
    candidate.rejectReason = "premiumHardRequirementMissing";
    return null;
  }
  if (planType === "value"
    && (requirements.valuePrefersTrouserRack || requirements.valuePrefersJewelryBox)
    && !status.valuePrioritySatisfied) {
    candidate.rejectReason = "valueHardUpgradeMissing";
    return null;
  }
  return candidate;
}

function addRequiredJapaneseComponent(candidate, componentType, answers, requirements) {
  const templateZone = componentType === "cabinet" ? "storageZone" : "accessoryZone";
  const bayCount = Math.max(1, Number(candidate.parameters?.bayCount || candidate.configPreset?.bayCount || 1));
  const preferredBays = unique(candidate.placements
    .filter((item) => item.templateZone === templateZone
      || (templateZone === "accessoryZone" && item.templateZone === "storageZone"))
    .map((item) => item.bayIndex));
  const candidateBays = [...preferredBays, ...Array.from({ length: bayCount }, (_, bayIndex) => bayIndex)]
    .filter((bayIndex, index, list) => list.indexOf(bayIndex) === index);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const added = candidateBays.some((bayIndex) => addJapaneseTemplateComponent(
      candidate.placements,
      componentType,
      templateZone,
      bayIndex,
      0,
      answers,
      bayCount
    ));
    if (added) {
      candidate.parameters[componentType] = Number(candidate.parameters[componentType] || 0) + 1;
      return true;
    }
    const removableIndex = findJapaneseHardRuleRemovalIndex(candidate, requirements);
    if (removableIndex < 0) return false;
    candidate.placements.splice(removableIndex, 1);
  }
  return false;
}

function findJapaneseHardRuleRemovalIndex(candidate, requirements) {
  const ordinaryShelfIndex = candidate.placements.findIndex((item) => (
    item.componentType === "woodShelf"
    && !["shoeZone", "longHangZone", "shortHangZone"].includes(item.zoneType)
  ));
  if (ordinaryShelfIndex >= 0) return ordinaryShelfIndex;
  const cabinetCount = candidate.placements.filter((item) => item.componentType === "cabinet").length;
  if (!requirements.requiresCabinet || cabinetCount > 1) {
    return candidate.placements.findIndex((item) => item.componentType === "cabinet");
  }
  return -1;
}

function getJapaneseRequirementStatus(candidate, answers, requirements) {
  const placements = candidate?.placements || [];
  const has = (componentType) => placements.some((item) => item.componentType === componentType);
  const hasZone = (zoneType) => placements.some((item) => item.zoneType === zoneType);
  const status = {
    longHangZone: hasZone("longHangZone"),
    shortHangZone: hasZone("shortHangZone"),
    shoeZone: !requirements.requiresShoeZone || hasZone("shoeZone"),
    trouserRack: !requirements.requiresTrouserRack || has("trouserRack"),
    jewelryBox: !requirements.requiresJewelryBox || has("jewelryBox"),
    cabinet: !requirements.requiresCabinet || has("cabinet")
  };
  status.valuePrioritySatisfied = (!requirements.valuePrefersTrouserRack && !requirements.valuePrefersJewelryBox)
    || (requirements.valuePrefersTrouserRack && has("trouserRack"))
    || (requirements.valuePrefersJewelryBox && has("jewelryBox"));
  status.allSatisfied = Object.entries(status)
    .filter(([key]) => !["valuePrioritySatisfied", "allSatisfied"].includes(key))
    .every(([, value]) => value);
  return status;
}

function getJapaneseHardRequirements(answers) {
  const needs = answers.needs || {};
  const pantsEstimate = Number(needs.裤子 || 0) * 20;
  const jewelryEstimate = Number(needs.首饰 || 0) * 20;
  return {
    pantsEstimate,
    jewelryEstimate,
    requiresTrouserRack: Number(needs.裤子 || 0) > 0,
    requiresJewelryBox: Number(needs.首饰 || 0) > 0,
    requiresCabinet: ["包包", "被褥", "综合收纳"].some((key) => Number(needs[key] || 0) > 0),
    requiresShoeZone: Number(needs.鞋子 || 0) > 0,
    requiresLuggageZone: Number(needs.行李箱 || 0) > 0,
    valuePrefersTrouserRack: pantsEstimate >= 15,
    valuePrefersJewelryBox: jewelryEstimate >= 10
  };
}

function ensureJapanesePremiumAnchorPrice(candidate, sourceCandidate, answers, supportedTypes, targets) {
  if (!candidate) return null;
  const bayMinimumPrice = Math.max(0, Number(candidate.parameters?.bayCount || 0)) * 900;
  const requiredPrice = Math.max(bayMinimumPrice, Number(targets.budgetMax || 0) + 1);
  if (Number(candidate.finalPlanPrice || candidate.estimatedPrice || 0) >= requiredPrice) {
    candidate.premiumMinimumPrice = bayMinimumPrice;
    candidate.premiumMinimumMet = true;
    candidate.premiumAboveBudget = Number(candidate.finalPlanPrice || candidate.estimatedPrice || 0)
      > targets.budgetMax;
    candidate.premiumCouldNotExceedBudget = !candidate.premiumAboveBudget;
    return candidate;
  }

  const premium = cloneCandidateForTier(candidate, "premium");
  const upgradePath = [
    ...(answers.needs.首饰 > 0 && supportedTypes.has("jewelryBox") ? ["jewelryBox"] : []),
    ...(answers.needs.裤子 > 0 && supportedTypes.has("trouserRack") ? ["trouserRack"] : []),
    ...(supportedTypes.has("cabinet") ? ["cabinet", "cabinet", "cabinet"] : []),
    ...Array(12).fill("woodShelf")
  ];
  let addedUpgradeCount = 0;
  for (const componentType of upgradePath) {
    const added = componentType === "jewelryBox"
      ? tryAddTierUpgrade(premium, "jewelryZone", componentType, [1100, 1300], true)
      : componentType === "trouserRack"
        ? tryAddTierUpgrade(premium, "trouserZone", componentType, [750], true)
        : componentType === "cabinet"
          ? tryAddTierUpgrade(premium, "storageZone", componentType, [0], true)
          : tryAddTierUpgrade(
            premium,
            "storageZone",
            componentType,
            [300, 700, 1200, 1600, 2050],
            true
          );
    addedUpgradeCount += added;
    if (!added) continue;
    finalizeDerivedCandidate(
      premium,
      sourceCandidate || candidate,
      answers,
      "premium",
      1,
      addedUpgradeCount
    );
    if (Number(premium.finalPlanPrice || premium.estimatedPrice || 0) >= requiredPrice) break;
  }
  premium.premiumMinimumPrice = bayMinimumPrice;
  premium.premiumMinimumMet = Number(premium.finalPlanPrice || premium.estimatedPrice || 0)
    >= bayMinimumPrice;
  premium.premiumAboveBudget = Number(premium.finalPlanPrice || premium.estimatedPrice || 0)
    > targets.budgetMax;
  premium.premiumCouldNotExceedBudget = !premium.premiumAboveBudget;
  return premium;
}

function selectJapaneseCandidateByTarget(
  candidates,
  baseCandidate,
  planType,
  targetPrice,
  priceBand = null
) {
  const qualified = baseCandidate
    ? candidates.filter((candidate) => getJapaneseUpgradeConditionCount(
      baseCandidate,
      candidate,
      planType
    ) >= 2)
    : candidates;
  const highValueUpgrades = baseCandidate
    ? qualified.filter((candidate) => (
      countJapaneseVisibleUpgrades(candidate) > countJapaneseVisibleUpgrades(baseCandidate)
    ))
    : [];
  const differentiatedPool = highValueUpgrades.length ? highValueUpgrades : qualified;
  const inBand = priceBand
    ? differentiatedPool.filter((candidate) => {
      const price = Number(candidate.finalPlanPrice ?? candidate.estimatedPrice ?? 0);
      const aboveMin = priceBand.strictMin ? price > priceBand.min : price >= priceBand.min;
      return aboveMin && price <= priceBand.max;
    })
    : differentiatedPool;
  const selectionPool = priceBand ? inBand : differentiatedPool;
  return [...selectionPool].sort((a, b) => {
    const caseMatchDelta = Number(b.scores?.caseMatchBonus || 0)
      - Number(a.scores?.caseMatchBonus || 0);
    const aDelta = Math.abs(Number(a.finalPlanPrice ?? a.estimatedPrice ?? 0) - targetPrice);
    const bDelta = Math.abs(Number(b.finalPlanPrice ?? b.estimatedPrice ?? 0) - targetPrice);
    const aWithinTarget = aDelta <= targetPrice * 0.10 ? 0 : 1;
    const bWithinTarget = bDelta <= targetPrice * 0.10 ? 0 : 1;
    return caseMatchDelta
      || aWithinTarget - bWithinTarget
      || aDelta - bDelta
      || (baseCandidate
        ? getPlanDifferenceScore(baseCandidate, b) - getPlanDifferenceScore(baseCandidate, a)
        : Number(b.scores?.totalScore || 0) - Number(a.scores?.totalScore || 0));
  })[0] || null;
}

function getJapaneseUpgradeConditionCount(baseCandidate, candidate, planType) {
  if (!baseCandidate || !candidate
    || getPlacementSignature(candidate) === getPlacementSignature(baseCandidate)) return 0;
  const priceRatio = Number(candidate.estimatedPrice || 0) / Math.max(1, Number(baseCandidate.estimatedPrice || 0));
  const placementDelta = getPlacementCount(candidate) - getPlacementCount(baseCandidate);
  const visibleUpgradeDelta = countJapaneseVisibleUpgrades(candidate)
    - countJapaneseVisibleUpgrades(baseCandidate);
  const zoneDelta = getAllFunctionalZoneCount(candidate) - getAllFunctionalZoneCount(baseCandidate);
  if (planType === "value") {
    const shelfOrRailDelta = countShelfAndRailPlacements(candidate)
      - countShelfAndRailPlacements(baseCandidate);
    return [
      visibleUpgradeDelta >= 1,
      shelfOrRailDelta >= 2,
      zoneDelta >= 1,
      priceRatio >= 1.15,
      placementDelta >= 2
    ].filter(Boolean).length;
  }
  const capacityDelta = getCapacityLabelCount(candidate) - getCapacityLabelCount(baseCandidate);
  return [
    visibleUpgradeDelta >= 1,
    placementDelta >= 2,
    priceRatio >= 1.20,
    capacityDelta >= 1,
    zoneDelta >= 1
  ].filter(Boolean).length;
}

function createJapaneseTargetFallbackCandidate(
  baseCandidate,
  answers,
  supportedTypes,
  planType,
  targetPrice,
  priceBand = null
) {
  if (!baseCandidate) return null;
  const demandUpgrades = [
    ...(answers.needs.首饰 > 0 && supportedTypes.has("jewelryBox") ? ["jewelryBox"] : []),
    ...(answers.needs.裤子 > 0 && supportedTypes.has("trouserRack") ? ["trouserRack"] : [])
  ];
  const shelfPath = Array(8).fill("woodShelf");
  const cabinetPath = supportedTypes.has("cabinet")
    ? ["cabinet", ...Array(6).fill("woodShelf"), "cabinet"]
    : shelfPath;
  const upgradePath = [
    ...demandUpgrades,
    ...(supportedTypes.has("cabinet") ? ["cabinet", "cabinet"] : []),
    ...Array(6).fill("woodShelf")
  ];
  const strategies = planType === "value"
    ? [upgradePath, cabinetPath, shelfPath]
    : [upgradePath, cabinetPath, shelfPath];
  const variants = [];

  strategies.forEach((strategy, strategyIndex) => {
    const candidate = cloneCandidateForTier(baseCandidate, planType);
    candidate.planId = `${planType}:target-derived:${strategyIndex}:${baseCandidate.planId}`;
    candidate.configPreset.shelfLevel = planType === "value" ? "medium" : "high";
    strategy.forEach((componentType, stepIndex) => {
      if (!tryAddJapaneseUpgrade(candidate, componentType)) return;
      finalizeDerivedCandidate(candidate, baseCandidate, answers, planType, 1, stepIndex + 1);
      if (getJapaneseUpgradeConditionCount(baseCandidate, candidate, planType) < 2) return;
      const snapshot = cloneCandidateForTier(candidate, planType);
      snapshot.planId = `${candidate.planId}:${stepIndex}`;
      variants.push(snapshot);
    });
  });

  const selected = selectJapaneseCandidateByTarget(
    variants,
    baseCandidate,
    planType,
    targetPrice,
    priceBand
  );
  if (selected) return selected;
  if (planType === "premium") {
    return [...variants].sort((a, b) => (
      Number(b.finalPlanPrice ?? b.estimatedPrice ?? 0)
      - Number(a.finalPlanPrice ?? a.estimatedPrice ?? 0)
    ))[0] || null;
  }
  return selectJapaneseCandidateByTarget(variants, baseCandidate, planType, targetPrice);

  function tryAddJapaneseUpgrade(candidate, componentType) {
    if (componentType === "jewelryBox") {
      return tryAddTierUpgrade(candidate, "jewelryZone", componentType, [1100, 1300], true);
    }
    if (componentType === "trouserRack") {
      return tryAddTierUpgrade(candidate, "trouserZone", componentType, [750], true);
    }
    if (componentType === "cabinet") {
      return tryAddTierUpgrade(candidate, "storageZone", componentType, [0], true);
    }
    return tryAddTierUpgrade(candidate, "storageZone", "woodShelf", [
      300, 700, 1200, 1600, 2050
    ], true);
  }
}

function getJapaneseClosetTargetPrices(answers) {
  const availability = getCandidateBudgetAvailability(answers);
  const parsedRange = parseBudgetRange(answers.budgetRange);
  const selectedRange = availability?.dynamicBudgetRanges?.find((range) => (
    range.label === answers.budgetRange
  ));
  const budgetMin = Number(selectedRange?.min ?? parsedRange.min ?? 0);
  const budgetMax = Number(selectedRange?.openEnded
    ? availability?.maxPossiblePrice
    : selectedRange?.max ?? parsedRange.max ?? 0);
  const rangeWidth = Math.max(0, budgetMax - budgetMin);
  return {
    budgetMin,
    budgetMax,
    basicMin: roundPriceToHundred(budgetMin * 0.85),
    basicMax: roundPriceToHundred(budgetMin * 1.05),
    basic: roundPriceToHundred(budgetMin > 0 ? budgetMin * 0.95 : budgetMax * 0.85),
    value: roundPriceToHundred(budgetMin + rangeWidth * 0.55),
    premium: roundPriceToHundred(budgetMax * 1.30),
    premiumMin: roundPriceToHundred(budgetMax * 1.15),
    premiumMax: roundPriceToHundred(budgetMax * 1.45)
  };
}

function annotateJapaneseSelection(candidate, targetPrice, selectedBecause, targets) {
  if (!candidate) return;
  candidate.targetPrice = targetPrice;
  candidate.actualPrice = Number(candidate.finalPlanPrice ?? candidate.estimatedPrice ?? 0);
  candidate.priceDelta = candidate.actualPrice - targetPrice;
  candidate.priceWasTargetAdjusted = false;
  candidate.selectedBecause = selectedBecause;
  candidate.budgetMin = targets.budgetMin;
  candidate.budgetMax = targets.budgetMax;
  candidate.basicTarget = targets.basic;
  candidate.valueTarget = targets.value;
  candidate.premiumTarget = targets.premium;
  if (candidate.planType === "premium") {
    candidate.premiumAboveBudget = candidate.actualPrice > targets.budgetMax;
    candidate.premiumCouldNotExceedBudget = !candidate.premiumAboveBudget;
  }
}

function countJapaneseVisibleUpgrades(candidate) {
  return (candidate?.placements || [])
    .filter((placement) => JAPANESE_VISIBLE_UPGRADE_COMPONENTS.has(placement.componentType)).length;
}

function countShelfAndRailPlacements(candidate) {
  return (candidate?.placements || []).filter((placement) => (
    placement.componentType === "woodShelf" || placement.componentType === "singleRail"
  )).length;
}

function getAllFunctionalZoneCount(candidate) {
  return new Set((candidate?.placements || [])
    .filter((placement) => placement.componentType)
    .map((placement) => placement.zoneType)).size;
}

function getCapacityLabelCount(candidate) {
  return new Set((candidate?.estimatedCapacity || []).map((item) => item.label || item.itemType)).size;
}

export function getLastCandidateEngineStats() {
  return {
    ...lastStats,
    rejectReasons: { ...lastStats.rejectReasons },
    rejectReasonsByPlanType: Object.fromEntries(Object.entries(lastStats.rejectReasonsByPlanType || {})
      .map(([planType, reasons]) => [planType, { ...reasons }])),
    candidateRejectTopReasons: [...(lastStats.candidateRejectTopReasons || [])],
    matchedJapaneseCases: [...(lastStats.matchedJapaneseCases || [])],
    heatmap: Object.fromEntries(Object.entries(lastStats.heatmap || {})
      .map(([planType, candidates]) => [planType, candidates.map((candidate) => ({ ...candidate }))]))
  };
}

function toJapaneseCaseDebugSummary(caseData) {
  return {
    caseId: caseData.caseId,
    score: caseData.score,
    modelPath: caseData.modelPath,
    matchedReason: caseData.matchedReason
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
        allowedComponents: [...(item.allowedComponents || [])],
        components: (item.components || []).map((component) => ({ ...component }))
      })),
      componentQuantities: { ...(candidate.configPreset?.componentQuantities || {}) },
      explicitPlacements: (candidate.configPreset?.explicitPlacements || []).map((item) => ({ ...item }))
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
      if (candidate.configPreset?.productSystemId === "japanese-closet"
        && ["trouserRack", "jewelryBox"].includes(componentType)) {
        upgrade.preferredWidth = getPreferredJapaneseFixedModuleWidth(
          candidate.configPreset.roomWidth,
          bayCount
        );
        upgrade.allowedWidths = [...JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS];
      }
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
  if (getSelectedSeriesId(answers) === "japanese-closet") {
    const priceBreakdown = calculateJapaneseClosetPrice(
      candidate.placements,
      candidate.parameters?.bayCount || candidate.configPreset?.bayCount,
      planType
    );
    Object.assign(candidate, priceBreakdown);
    candidate.estimatedPrice = priceBreakdown.finalPlanPrice;
    candidate.configPreset.candidatePlanId = candidate.planId;
    syncJapaneseCandidatePreset(candidate);
    candidate.scores = scoreCandidatePlan(candidate, answers);
    return;
  }
  const priceTarget = getCandidatePriceTarget(answers.budgetRange, planType);
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
    existing.allowedComponents = unique([...(existing.allowedComponents || []), componentType]);
    existing.quantity = Number(existing.quantity || 0) + 1;
    const components = Array.isArray(existing.components) ? existing.components : [];
    const componentIntent = components.find((item) => item.componentType === componentType);
    if (componentIntent) {
      componentIntent.quantity = Number(componentIntent.quantity || 0) + 1;
    } else {
      components.push({ componentType, quantity: 1 });
    }
    existing.components = components;
    return;
  }
  requirements.push({
    zoneType,
    preferredComponent: componentType,
    allowedComponents: [componentType],
    components: [{ componentType, quantity: 1 }],
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
  if (getSelectedSeriesId(answers) === "japanese-closet" && answers.primaryJapaneseCase) {
    applyPrimaryJapaneseCaseParameters(parameters, answers.primaryJapaneseCase, planType);
  }
  const placements = getSelectedSeriesId(answers) === "japanese-closet" && answers.primaryJapaneseCase
    ? buildJapaneseCaseTemplatePlacements(answers, parameters, planType)
    : buildAbstractPlacements(answers, parameters, planType, options.supportedTypes);
  if (getSelectedSeriesId(answers) === "japanese-closet" && !answers.primaryJapaneseCase) {
    applyJapaneseCandidatePlacementRules(placements, answers, parameters, planType);
  }
  const configPreset = buildCandidateConfigPreset(answers, planType, planOutput, parameters, placements);
  const japanesePriceBreakdown = getSelectedSeriesId(answers) === "japanese-closet"
    ? calculateJapaneseClosetPrice(placements, parameters.bayCount, planType)
    : null;
  const estimatedPrice = japanesePriceBreakdown
    ? japanesePriceBreakdown.finalPlanPrice
    : estimateCandidatePrice(answers.budgetRange, planType, parameters, options.rulesData);
  return {
    planId: `${planType}:${bayCount}:${sequence}`,
    planType,
    planName: PLAN_NAMES[planType],
    zones: unique(placements.map((placement) => placement.zoneType)),
    placements,
    estimatedCapacity: planOutput.capacity,
    estimatedPrice,
    ...(japanesePriceBreakdown || {}),
    scores: null,
    configPreset,
    parameters,
    ...(answers.primaryJapaneseCase
      ? {
        layoutTemplate: answers.primaryJapaneseCase.layoutTemplate || [],
        bayPlan: buildJapaneseBayPlan(placements, parameters.bayCount),
        templateViolationCount: countJapaneseTemplateViolations(placements, parameters.bayCount)
      }
      : {}),
    coverageTarget: PLAN_LEVELS[planType]
  };
}

function buildJapaneseCaseTemplatePlacements(answers, parameters, planType) {
  const bayCount = Math.max(1, Number(parameters.bayCount) || 1);
  const hardRequirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  const template = [...(answers.primaryJapaneseCase?.layoutTemplate || [])].map((entry) => ({
    zone: entry.zone,
    components: [...(entry.components || [])]
  }));
  if (!template.some((entry) => entry.zone === "accessoryZone")
    && (hardRequirements.requiresTrouserRack || hardRequirements.requiresJewelryBox)) {
    template.push({ zone: "accessoryZone", components: [] });
  }
  if (!template.some((entry) => entry.zone === "storageZone") && hardRequirements.requiresCabinet) {
    template.push({ zone: "storageZone", components: ["cabinet"] });
  }

  const assignments = template.map((entry, index) => ({
    entry,
    bayIndex: getJapaneseTemplateBayIndex(entry, index, template.length, bayCount)
  }));
  const placements = [];
  let valueAccessoryAdded = false;
  const assignmentPriority = {
    shortHangZone: 0,
    longHangZone: 1,
    luggageZone: 2,
    accessoryZone: 3,
    storageZone: 4,
    shoeZone: 5,
    shelfZone: 6
  };
  [...assignments].sort((left, right) => (
    Number(assignmentPriority[left.entry.zone] ?? 99) - Number(assignmentPriority[right.entry.zone] ?? 99)
  )).forEach(({ entry, bayIndex }) => {
    if (entry.zone === "shoeZone" && bayCount <= 3 && !hardRequirements.requiresShoeZone) return;
    if (entry.zone === "luggageZone" && bayCount <= 3 && !hardRequirements.requiresLuggageZone) return;
    let components = [...entry.components];
    if (entry.zone === "accessoryZone") {
      components = unique([
        ...(hardRequirements.requiresTrouserRack ? ["trouserRack"] : []),
        ...(hardRequirements.requiresJewelryBox ? ["jewelryBox"] : []),
        ...components
      ]);
    }
    components.forEach((componentType, componentIndex) => {
      if (planType === "basic" && ["cabinet", "trouserRack", "jewelryBox"].includes(componentType)) return;
      if (planType === "value" && ["trouserRack", "jewelryBox"].includes(componentType)) {
        const preferred = (componentType === "trouserRack" && hardRequirements.valuePrefersTrouserRack)
          || (componentType === "jewelryBox" && hardRequirements.valuePrefersJewelryBox);
        if (valueAccessoryAdded || (!preferred
          && (hardRequirements.valuePrefersTrouserRack || hardRequirements.valuePrefersJewelryBox))) return;
        valueAccessoryAdded = true;
      }
      const targetBay = ["trouserRack", "jewelryBox"].includes(componentType)
        ? findJapaneseAccessoryTemplateBay(placements, assignments, bayIndex, bayCount)
        : bayIndex;
      if (targetBay == null) return;
      addJapaneseTemplateComponent(placements, componentType, entry.zone, targetBay, componentIndex, answers, bayCount);
    });
    if (entry.zone === "luggageZone") {
      placements.push({
        zoneType: "luggageZone",
        componentType: "",
        wallId: "back",
        bayIndex,
        heightFromFloor: 0,
        reservedHeight: 800,
        templateZone: entry.zone
      });
    }
  });

  const coreEntries = template.filter((entry) => ["shortHangZone", "longHangZone", "storageZone"].includes(entry.zone));
  for (let bayIndex = 0; bayIndex < bayCount; bayIndex += 1) {
    if (placements.some((item) => item.bayIndex === bayIndex && item.componentType)) continue;
    const fallback = coreEntries[bayIndex % Math.max(1, coreEntries.length)]
      || { zone: "longHangZone", components: ["singleRail"] };
    fallback.components.slice(0, 2).forEach((componentType, index) => {
      if (["cabinet", "trouserRack", "jewelryBox"].includes(componentType)) return;
      addJapaneseTemplateComponent(placements, componentType, fallback.zone, bayIndex, index, answers, bayCount);
    });
  }
  return placements;
}

function getJapaneseTemplateBayIndex(entry, index, templateLength, bayCount) {
  if (entry.zone === "shortHangZone") return 0;
  if (entry.zone === "longHangZone") return Math.min(1, bayCount - 1);
  if (entry.zone === "luggageZone") return Math.min(1, bayCount - 1);
  if (["storageZone", "accessoryZone"].includes(entry.zone)) return bayCount - 1;
  if (entry.zone === "shoeZone") return bayCount >= 4 ? Math.min(2, bayCount - 1) : bayCount - 1;
  return templateLength <= 1 ? 0 : Math.round(index * (bayCount - 1) / (templateLength - 1));
}

function findJapaneseAccessoryTemplateBay(placements, assignments, preferredBay, bayCount) {
  const orderedBays = Array.from({ length: bayCount }, (_, bayIndex) => bayIndex)
    .sort((left, right) => Math.abs(left - preferredBay) - Math.abs(right - preferredBay));
  const preferredRoleBays = new Set(assignments
    .filter(({ entry }) => ["accessoryZone", "storageZone"].includes(entry.zone))
    .map(({ bayIndex }) => bayIndex));
  const nonHangBays = new Set(assignments
    .filter(({ entry }) => !["longHangZone", "shortHangZone"].includes(entry.zone))
    .map(({ bayIndex }) => bayIndex));
  return orderedBays.find((bayIndex) => preferredRoleBays.has(bayIndex)
    && !placements.some((item) => item.bayIndex === bayIndex
      && ["trouserRack", "jewelryBox"].includes(item.componentType)))
    ?? orderedBays.find((bayIndex) => nonHangBays.has(bayIndex)
    && !placements.some((item) => item.bayIndex === bayIndex
      && ["trouserRack", "jewelryBox"].includes(item.componentType)))
    ?? null;
}

function addJapaneseTemplateComponent(placements, componentType, templateZone, bayIndex, componentIndex, answers, bayCount) {
  const bayPlacements = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
  const counts = countBy(bayPlacements, (item) => item.componentType);
  if (componentType === "cabinet" && Number(counts.cabinet || 0) >= 1) return false;
  if (["trouserRack", "jewelryBox"].includes(componentType)
    && bayPlacements.some((item) => ["trouserRack", "jewelryBox"].includes(item.componentType))) return false;
  if (componentType === "woodShelf" && Number(counts.woodShelf || 0) >= 3) return false;
  if (["singleRail", "doubleRail"].includes(componentType)
    && bayPlacements.filter((item) => ["singleRail", "doubleRail"].includes(item.componentType)).length >= 2) return false;

  const zoneType = componentType === "trouserRack"
    ? "trouserZone"
    : componentType === "jewelryBox" ? "jewelryZone"
      : templateZone === "accessoryZone" || templateZone === "shelfZone" ? "storageZone" : templateZone;
  const heights = getJapaneseTemplateHeights(componentType, zoneType);
  const heightFromFloor = heights[Math.min(componentIndex, heights.length - 1)];
  const candidate = placement(zoneType, componentType, bayIndex, heightFromFloor);
  candidate.templateZone = templateZone;
  if (["trouserRack", "jewelryBox"].includes(componentType)) {
    candidate.preferredWidth = getPreferredJapaneseFixedModuleWidth(answers.roomWidth, bayCount);
    candidate.allowedWidths = [...JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS];
  }
  if (bayPlacements.some((item) => intervalsOverlap(intervalFor(item), intervalFor(candidate)))) return false;
  placements.push(candidate);
  return true;
}

function getJapaneseTemplateHeights(componentType, zoneType) {
  if (componentType === "cabinet") return [0];
  if (componentType === "trouserRack") return [750];
  if (componentType === "jewelryBox") return [1100, 1300];
  if (componentType === "woodShelf") return zoneType === "shoeZone" ? [250, 500, 750] : [700, 1200, 2050];
  if (zoneType === "shortHangZone") return [1050, 2000];
  return [1650];
}

function buildJapaneseBayPlan(placements, bayCount) {
  return Array.from({ length: Math.max(1, Number(bayCount) || 1) }, (_, bayIndex) => ({
    bayIndex,
    templateZones: unique(placements.filter((item) => item.bayIndex === bayIndex)
      .map((item) => item.templateZone).filter(Boolean)),
    components: placements.filter((item) => item.bayIndex === bayIndex && item.componentType)
      .map((item) => ({ zone: item.zoneType, componentType: item.componentType, heightFromFloor: item.heightFromFloor }))
  }));
}

function countJapaneseTemplateViolations(placements, bayCount) {
  return Array.from({ length: Math.max(1, Number(bayCount) || 1) }, (_, bayIndex) => (
    placements.filter((item) => item.bayIndex === bayIndex && item.componentType)
  )).reduce((total, items) => {
    const counts = countBy(items, (item) => item.componentType);
    const accessoryCount = items.filter((item) => ["trouserRack", "jewelryBox"].includes(item.componentType)).length;
    const railCount = items.filter((item) => ["singleRail", "doubleRail"].includes(item.componentType)).length;
    return total
      + Math.max(0, Number(counts.cabinet || 0) - 1)
      + Math.max(0, accessoryCount - 1)
      + Math.max(0, Number(counts.woodShelf || 0) - 3)
      + Math.max(0, railCount - 2);
  }, 0);
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
  const preferredFixedModuleWidth = getPreferredJapaneseFixedModuleWidth(answers.roomWidth, parameters.bayCount);
  placements.filter((item) => ["trouserRack", "jewelryBox"].includes(item.componentType)).forEach((item) => {
    item.preferredWidth = preferredFixedModuleWidth;
    item.allowedWidths = [...JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS];
  });
  distributePlacements(
    placements,
    "jewelryZone",
    "jewelryBox",
    parameters.jewelryBox,
    [...getRestrictedPlacementBays(restrictedComponentBays, componentBays, parameters.jewelryBox)].reverse(),
    [1100, 1300]
  );
  placements.filter((item) => item.componentType === "jewelryBox").forEach((item) => {
    item.preferredWidth = preferredFixedModuleWidth;
    item.allowedWidths = [...JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS];
  });
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

function applyJapaneseCandidatePlacementRules(placements, answers, parameters, planType) {
  const bayCount = Math.max(1, Number(parameters.bayCount) || 1);
  const luggageMarkers = placements.filter((item) => item.zoneType === "luggageZone"
    && !item.componentType);

  if (planType === "basic") {
    const coreHangPlacements = placements.filter((item) => ["longHangZone", "shortHangZone"].includes(item.zoneType)
      && ["singleRail", "woodShelf"].includes(item.componentType));
    const shoeShelves = answers.needs.鞋子 > 0
      ? placements.filter((item) => item.zoneType === "shoeZone"
        && item.componentType === "woodShelf").slice(0, 3)
      : [];
    placements.splice(0, placements.length, ...luggageMarkers, ...coreHangPlacements, ...shoeShelves);
  }

  for (let bayIndex = 0; bayIndex < bayCount; bayIndex += 1) {
    const bayPlacements = placements.filter((item) => item.wallId === "back"
      && item.bayIndex === bayIndex);
    if (bayPlacements.some((item) => JAPANESE_FUNCTIONAL_COMPONENTS.has(item.componentType))) continue;
    const isLuggageBay = bayPlacements.some((item) => item.zoneType === "luggageZone");
    placements.push(placement(
      isLuggageBay ? "luggageZone" : "longHangZone",
      "singleRail",
      bayIndex,
      1650
    ));
  }

  luggageMarkers.forEach((marker) => {
    const hasUpperRail = placements.some((item) => item.wallId === marker.wallId
      && item.bayIndex === marker.bayIndex
      && item.componentType === "singleRail");
    if (!hasUpperRail) {
      placements.push(placement("luggageZone", "singleRail", marker.bayIndex, 1650, marker.wallId));
    }
  });
}

function applyPrimaryJapaneseCaseParameters(parameters, primaryCase, planType) {
  const profile = primaryCase.demandProfile || {};
  const bayCount = Math.max(1, Number(parameters.bayCount) || 1);
  const shoeGroups = Number(profile.shoes) > 0 ? 1 : 0;
  const availableHangBays = Math.max(1, bayCount - shoeGroups - (Number(profile.luggage) > 0 ? 1 : 0));
  const longDemand = Number(profile.longClothes) || 0;
  const shortDemand = Number(profile.shortClothes) || 0;
  const hangDemand = longDemand + shortDemand || 1;
  parameters.longGroups = longDemand > 0
    ? Math.max(1, Math.min(3, Math.round(availableHangBays * longDemand / hangDemand)))
    : 0;
  parameters.shortGroups = shortDemand > 0
    ? Math.max(1, Math.min(3, availableHangBays - parameters.longGroups || 1))
    : 0;
  parameters.shoeGroups = shoeGroups;
  parameters.trouserRack = planType === "basic" || Number(profile.trousers ?? profile.pants) <= 0
    ? 0
    : planType === "value" ? 1 : 2;
  parameters.jewelryBox = planType === "basic" || Number(profile.jewelry) <= 0
    ? 0
    : planType === "value" ? 1 : 2;
  parameters.cabinet = planType === "basic"
    ? 0
    : Math.max(1, Math.min(planType === "value" ? 2 : 4, Math.ceil(
      ((Number(profile.bags) || 0) + (Number(profile.bedding) || 0)) / 2
    )));
  parameters.shelfCount = Math.max(1, Math.round(
    ((Number(profile.bags) || 0) + (Number(profile.bedding) || 0))
    * (planType === "basic" ? 0.5 : planType === "value" ? 1 : 1.5)
  ));
}

function applyPrimaryJapaneseCaseNeeds(answers) {
  const profile = answers.primaryJapaneseCase?.demandProfile || {};
  const mappings = {
    长衣: "longClothes",
    短衣: "shortClothes",
    鞋子: "shoes",
    包包: "bags",
    首饰: "jewelry",
    裤子: "trousers",
    行李箱: "luggage",
    被褥: "bedding"
  };
  Object.entries(mappings).forEach(([answerKey, profileKey]) => {
    answers.needs[answerKey] = Math.max(
      Number(answers.needs[answerKey] || 0),
      Number(profile[profileKey] ?? (profileKey === "trousers" ? profile.pants : 0)) || 0
    );
  });
}

function validateJapaneseBayCoverage(candidate) {
  const placements = candidate.placements || [];
  const bayCount = Math.max(1, Number(candidate.parameters?.bayCount
    || candidate.configPreset?.bayCount) || 1);
  const backBaysCovered = Array.from({ length: bayCount }, (_, bayIndex) => (
    placements.some((item) => item.wallId === "back"
      && item.bayIndex === bayIndex
      && JAPANESE_FUNCTIONAL_COMPONENTS.has(item.componentType))
  )).every(Boolean);
  if (!backBaysCovered) return false;

  return placements.filter((item) => item.zoneType === "luggageZone" && !item.componentType)
    .every((marker) => placements.some((item) => item.wallId === marker.wallId
      && item.bayIndex === marker.bayIndex
      && item.componentType === "singleRail"));
}

function getPreferredJapaneseFixedModuleWidth(roomWidth, bayCount) {
  const bayWidth = Math.max(0, Number(roomWidth) || 0) / Math.max(1, Number(bayCount) || 1);
  return JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS.find((width) => bayWidth >= width)
    || JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS[JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS.length - 1];
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
    ...(getSelectedSeriesId(answers) === "japanese-closet"
      ? { explicitPlacements: buildCandidateExplicitPlacements(placements) }
      : {}),
    lighting: planType === "basic" ? false : parameters.lighting,
    shelfLevel: planType === "basic" ? "basic" : planType === "value" ? "medium" : "high",
    candidatePlanId: `${planType}:${parameters.bayCount}`,
    ...(getSelectedSeriesId(answers) === "japanese-closet" && answers.primaryJapaneseCase
      ? { primaryCaseId: answers.primaryJapaneseCase.caseId }
      : {})
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

function syncJapaneseCandidatePreset(candidate) {
  const explicitPlacements = buildCandidateExplicitPlacements(candidate.placements);
  candidate.configPreset.explicitPlacements = explicitPlacements;
  candidate.configPreset.componentQuantities = countBy(explicitPlacements, (item) => item.componentType);
}

function buildCandidateExplicitPlacements(placements = []) {
  const explicitTypes = new Set([
    "singleRail",
    "doubleRail",
    "woodShelf",
    "cabinet",
    "jewelryBox",
    "trouserRack",
    "glassShelf"
  ]);
  return placements
    .filter((item) => explicitTypes.has(item.componentType))
    .map((item) => ({
      componentType: item.componentType,
      wallId: item.wallId || "back",
      bayIndex: Number(item.bayIndex) || 0,
      heightFromFloor: Number(item.heightFromFloor) || 0,
      zoneType: item.zoneType || "",
      ...(["trouserRack", "jewelryBox"].includes(item.componentType) && item.preferredWidth
        ? {
          preferredWidth: item.preferredWidth,
          allowedWidths: [...(item.allowedWidths || JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS)]
        }
        : {}),
      source: "candidate"
    }));
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
  const base = max > 0 ? (min + max) / 2 : getCandidatePriceTarget(budgetRange, planType);
  const upgradeUnits = parameters.cabinet + parameters.glassShelf
    + parameters.jewelryBox + parameters.trouserRack + (parameters.lighting ? 1 : 0);
  const estimated = Math.round((base + upgradeUnits * 80) / 100) * 100;
  return planType === "premium" ? Math.min(estimated, getPremiumBudgetCap(budgetRange)) : estimated;
}

function calculateJapaneseClosetPrice(placements = [], bayCount = 0, planType = "basic") {
  const placementsByBay = groupPlacements(placements.filter((item) => item.componentType));
  for (let bayIndex = 0; bayIndex < Math.max(0, Number(bayCount) || 0); bayIndex += 1) {
    placementsByBay[`back:${bayIndex}`] ||= [];
  }

  const manualComponentPrice = Object.values(placementsByBay).reduce((total, bayPlacements) => {
    const counts = countBy(bayPlacements, (item) => item.componentType);
    const ordinaryWoodShelves = bayPlacements.filter((item) => (
      item.componentType === "woodShelf" && item.zoneType !== "shoeZone"
    )).length;
    const hasCabinet = Number(counts.cabinet || 0) > 0;
    const railUnits = Number(counts.singleRail || 0) + Number(counts.doubleRail || 0) * 2;
    const isStorageGroup = hasCabinet && railUnits === 0 && ordinaryWoodShelves >= 2;
    const isHangGroup = !isStorageGroup && railUnits > 0;

    let bayPrice = isStorageGroup
      ? JAPANESE_CLOSET_AI_PRICES.storageGroup
      : isHangGroup
        ? JAPANESE_CLOSET_AI_PRICES.basicHangGroup
        : JAPANESE_CLOSET_AI_PRICES.woodTop;

    const includedSingleRails = isHangGroup ? Math.min(2, Number(counts.singleRail || 0)) : 0;
    const includedCabinets = isStorageGroup ? Math.min(1, Number(counts.cabinet || 0)) : 0;
    const includedWoodShelves = isStorageGroup ? Math.min(2, ordinaryWoodShelves) : 0;

    bayPrice += Math.max(0, Number(counts.singleRail || 0) - includedSingleRails)
      * JAPANESE_CLOSET_AI_PRICES.singleRail;
    bayPrice += Number(counts.doubleRail || 0) * JAPANESE_CLOSET_AI_PRICES.doubleRail;
    bayPrice += Math.max(0, ordinaryWoodShelves - includedWoodShelves)
      * JAPANESE_CLOSET_AI_PRICES.woodShelf;
    bayPrice += bayPlacements.filter((item) => (
      item.componentType === "woodShelf" && item.zoneType === "shoeZone"
    )).length * JAPANESE_CLOSET_AI_PRICES.woodShelf;
    bayPrice += Math.max(0, Number(counts.cabinet || 0) - includedCabinets)
      * JAPANESE_CLOSET_AI_PRICES.cabinet;
    bayPrice += Number(counts.jewelryBox || 0) * JAPANESE_CLOSET_AI_PRICES.jewelryBoxWithShelf;
    bayPrice += Number(counts.trouserRack || 0) * JAPANESE_CLOSET_AI_PRICES.trouserRackWithShelf;
    return total + bayPrice;
  }, 0);
  const servicePriceFactor = JAPANESE_CLOSET_SERVICE_PRICE_FACTORS[planType]
    || JAPANESE_CLOSET_SERVICE_PRICE_FACTORS.basic;
  const finalPlanPrice = Math.round((manualComponentPrice * servicePriceFactor) / 100) * 100;
  return {
    manualComponentPrice,
    servicePriceFactor,
    finalPlanPrice,
    priceWasTargetAdjusted: false
  };
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
    "3000-6000": 12000,
    "6000-9000": 18000,
    "9000-12000": 22000,
    "12000-18000": 32400,
    "18000以上": 39600
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
  if (candidate.configPreset?.productSystemId === "japanese-closet") {
    const availability = getCandidateBudgetAvailability({
      roomWidth: Number(candidate.configPreset.roomWidth) || 3600,
      roomDepth: Number(candidate.configPreset.roomDepth) || 2800,
      layoutType: candidate.configPreset.layoutType || "I型",
      budgetRange: candidate.configPreset.budgetRange || "",
      selectedProductSystem: { seriesId: "japanese-closet" }
    });
    const target = candidate.planType === "basic"
      ? availability?.basicTargetPrice
      : candidate.planType === "value"
        ? availability?.valueTargetPrice
        : availability?.premiumTargetPrice;
    return clamp(1 - Math.abs(price - target) / Math.max(1, target), 0, 1);
  }
  const target = getCandidatePriceTarget(candidate.configPreset.budgetRange || "", candidate.planType);
  return clamp(1 - Math.abs(price - target) / Math.max(1, target), 0, 1);
}

function getCandidatePriceTarget(budgetRange, planType) {
  const rulePrice = Number(getPlanPriceFromRules(budgetRange, planType).price || 0);
  if (rulePrice > 0) return rulePrice;
  const range = parseBudgetRange(budgetRange);
  const target = planType === "basic"
    ? Math.max(range.min + 600, range.max - 500)
    : planType === "value"
      ? range.max + 400
      : range.max + 950;
  return Math.round(target / 100) * 100;
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
    caseMatchBonus: candidate.scores?.caseMatchBonus || 0,
    primaryCaseId: candidate.configPreset?.primaryCaseId || null,
    caseMatchWeight: candidate.scores?.caseMatchWeight || 0,
    caseDistributionTarget: candidate.scores?.caseDistributionTarget || {},
    candidateDistribution: candidate.scores?.candidateDistribution || {},
    distributionDelta: candidate.scores?.distributionDelta || {},
    premiumHardRequirements: candidate.premiumHardRequirements || null,
    premiumRequirementStatus: candidate.premiumRequirementStatus || null,
    caseLibraryAppliedAs: candidate.caseLibraryAppliedAs || "layoutReferenceOnly",
    hardRuleOverrideCase: candidate.hardRuleOverrideCase || false,
    layoutTemplate: candidate.layoutTemplate || [],
    bayPlan: candidate.bayPlan || [],
    templateViolationCount: candidate.templateViolationCount || 0,
    estimatedPrice: candidate.estimatedPrice,
    manualComponentPrice: candidate.manualComponentPrice,
    servicePriceFactor: candidate.servicePriceFactor,
    finalPlanPrice: candidate.finalPlanPrice,
    targetPrice: candidate.targetPrice,
    actualPrice: candidate.actualPrice,
    priceDelta: candidate.priceDelta,
    priceWasTargetAdjusted: candidate.priceWasTargetAdjusted,
    budgetMin: candidate.budgetMin,
    budgetMax: candidate.budgetMax,
    basicTarget: candidate.basicTarget,
    valueTarget: candidate.valueTarget,
    premiumTarget: candidate.premiumTarget,
    premiumAboveBudget: candidate.premiumAboveBudget,
    premiumCouldNotExceedBudget: candidate.premiumCouldNotExceedBudget,
    selectedBecause: candidate.selectedBecause,
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
    budgetRange: answers.budget || answers.budgetRange || "9,000 - 12,000",
    spaceType: answers.spaceUse || answers.spaceType || "",
    needs: normalizeNeeds(answers),
    selectedProductSystem: answers.selectedProductSystem || null,
    matchedJapaneseCases: answers.matchedJapaneseCases || [],
    primaryJapaneseCase: answers.primaryJapaneseCase || answers.matchedJapaneseCases?.[0] || null
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
  const values = String(label || "").match(/[\d,]+/g)?.map((value) => Number(value.replace(/,/g, ""))) || [];
  if (String(label || "").includes("以下")) return { min: 0, max: values[0] || 3000 };
  if (String(label || "").includes("以上")) {
    const min = values[0] || 18000;
    return { min, max: Math.round(min * 1.25), openEnded: true };
  }
  return { min: values[0] || 0, max: values[1] || values[0] || 12000 };
}

function getCandidateBudgetAvailability(answers) {
  if (getSelectedSeriesId(answers) !== "japanese-closet") return null;
  const runLength = answers.layoutType === "U型"
    ? answers.roomWidth + answers.roomDepth * 2
    : answers.layoutType === "L型"
      ? answers.roomWidth + answers.roomDepth
      : answers.roomWidth;
  const bayCount = Math.max(1, Math.round(runLength / 900));
  const minPossiblePrice = roundPriceToHundred(bayCount * 700);
  const normalPossiblePrice = roundPriceToHundred(bayCount * 900);
  const maxPossiblePrice = roundPriceToHundred(bayCount * 2200);
  const dynamicBudgetRanges = getCandidateDynamicBudgetRanges(
    bayCount,
    minPossiblePrice,
    normalPossiblePrice,
    maxPossiblePrice
  );
  const disabledBudgetRanges = [];
  const disabledReason = {};
  dynamicBudgetRanges.forEach((range) => {
    const budgetRange = range.label;
    if (range.max < minPossiblePrice * 0.85) {
      disabledBudgetRanges.push(budgetRange);
      disabledReason[budgetRange] = "当前空间基础配置也难以做到该预算。";
    } else if (range.min > maxPossiblePrice * 1.15) {
      disabledBudgetRanges.push(budgetRange);
      disabledReason[budgetRange] = "当前空间无法合理达到该预算。";
    }
  });
  const selectedRange = dynamicBudgetRanges.find((range) => range.label === answers.budgetRange) || null;
  const upper = selectedRange?.openEnded
    ? Math.max(selectedRange.min, maxPossiblePrice)
    : selectedRange?.max;
  const width = selectedRange ? Math.max(0, upper - selectedRange.min) : 0;
  const selectedMin = Number(selectedRange?.min || 0);
  const selectedMax = Number(upper || 0);
  return {
    bayCount,
    minPossiblePrice,
    normalPossiblePrice,
    maxPossiblePrice,
    dynamicBudgetRanges,
    disabledBudgetRanges,
    disabledReason,
    selectedBudgetRange: selectedRange?.label || "",
    basicTargetPrice: selectedRange
      ? roundPriceToHundred(selectedMin > 0 ? selectedMin * 0.95 : selectedMax * 0.85)
      : null,
    valueTargetPrice: selectedRange
      ? roundPriceToHundred(selectedMin + width * 0.55)
      : null,
    premiumTargetPrice: selectedRange
      ? roundPriceToHundred(selectedMax * 1.30)
      : null
  };
}

function getCandidateDynamicBudgetRanges(bayCount, minPossiblePrice, normalPossiblePrice, maxPossiblePrice) {
  const lowStart = Math.max(3000, Math.floor((minPossiblePrice * 0.85) / 100) * 100);
  const lowEnd = Math.max(lowStart + 100, Math.ceil((normalPossiblePrice * 1.05) / 100) * 100);
  const midEnd = Math.max(lowEnd + 100, Math.ceil((normalPossiblePrice * 1.45) / 100) * 100);
  const highEnd = Math.max(midEnd + 100, Math.ceil((maxPossiblePrice * 0.85) / 100) * 100);
  const premiumEnd = Math.max(highEnd + 100, Math.ceil((maxPossiblePrice * 1.15) / 100) * 100);
  const amount = (value) => Number(value || 0).toLocaleString("zh-CN");
  const range = (min, max) => `${amount(min)} - ${amount(max)}`;
  return lowStart > 3000
    ? [
      { min: 0, max: lowStart, label: `${amount(lowStart)}以下` },
      { min: lowStart, max: lowEnd, label: range(lowStart, lowEnd) },
      { min: lowEnd, max: midEnd, label: range(lowEnd, midEnd) },
      { min: midEnd, max: premiumEnd, label: range(midEnd, premiumEnd) },
      { min: premiumEnd, max: Infinity, openEnded: true, label: `${amount(premiumEnd)}以上` }
    ]
    : [
      { min: 0, max: lowStart, label: `${amount(lowStart)}以下` },
      { min: lowStart, max: midEnd, label: range(lowStart, midEnd) },
      { min: midEnd, max: highEnd, label: range(midEnd, highEnd) },
      { min: highEnd, max: premiumEnd, label: range(highEnd, premiumEnd) },
      { min: premiumEnd, max: Infinity, openEnded: true, label: `${amount(premiumEnd)}以上` }
    ];
}

function roundPriceToHundred(value) {
  return Math.round(Number(value || 0) / 100) * 100;
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
