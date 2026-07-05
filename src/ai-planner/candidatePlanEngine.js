import { PLAN_LEVELS } from "../rules/commonRules.js?v=closet-rules-preview-20260621-11";
import {
  buildPlanRuleOutput,
  getClosetRules,
  getPlanPriceFromRules
} from "../rules/demandRules.js?v=component-upgrade-rules-20260627-01";
import {
  isFixedWidthAccessory,
  selectPreferredAccessoryBay
} from "../rules/placementStrategy.js?v=fixed-accessory-placement-20260627-01";
import { getClearanceValue } from "../rules/storageRules.js?v=storage-rules-20260625-01";
import { getCuttingRules } from "../series/index.js?v=japanese-drawer-merchandising-20260703-01";
import {
  PLANNER_COMPONENT_MAP,
  WALL_MOUNTED_PLACEMENT_RULES,
  createWallMountedRailWithShelfPlacement,
  resolveWallMountedShelfType
} from "../config/plannerPresetMap.js?v=wall-mounted-placement-rules-20260621-03";
import {
  JAPANESE_CASE_LAYOUT_RULES,
  findSimilarJapaneseCases,
  getJapaneseCaseDistributionTarget,
  japaneseCaseLibrary
} from "./japaneseCaseLibrary.js?v=case-matching-layout-20260627-01";
import { JAPANESE_UPGRADE_POLICY } from "./japaneseUpgradePolicy.js?v=japanese-upgrade-policy-20260630-01";

const PLAN_TYPES = ["basic", "value", "premium"];
const PLAN_NAMES = {
  basic: "基础实用款",
  value: "高性价比款",
  premium: "高配理想款"
};
const SHELF_TYPES = new Set(["woodShelf", "glassShelf", "shoeShelf", "shoesShelf"]);
const CAPACITY_SHELF_TYPES = new Set(["woodShelf", "glassShelf"]);
const SHOE_SHELF_MIN_GAP = getClearanceValue("shoeShelf", "verticalGap", 180);
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
  drawerSingle: 180,
  drawerDouble: 360,
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
  trouserRackWithShelf: 660,
  drawerSingle: 720,
  drawerDouble: 1380
};
const JAPANESE_VISIBLE_UPGRADE_COMPONENTS = new Set([
  "cabinet", "trouserRack", "jewelryBox", "drawerSingle", "drawerDouble", "glassShelf"
]);
const JAPANESE_FUNCTIONAL_COMPONENTS = new Set([
  "singleRail", "doubleRail", "woodShelf", "cabinet", "jewelryBox", "trouserRack", "drawerSingle", "drawerDouble"
]);
const JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS = Object.freeze([900, 800, 700, 600, 500]);
const JAPANESE_BACK_WALL_PREFERRED_BAY_WIDTHS = Object.freeze([900, 850, 800, 750, 700, 600]);
const JAPANESE_DRAWER_DOUBLE_SKU = "JP-drawerDouble";
const JAPANESE_SINGLE_DRAWER_SKUS = Object.freeze([
  "JP-drawer-leather-storage",
  "JP-drawer-multi-storage",
  "JP-drawer-underwear-a",
  "JP-drawer-jewelry",
  "JP-drawer-underwear-b",
  "JP-drawer-wire-basket",
  "JP-drawer-wire-basket-short"
]);
const JAPANESE_VALUE_DRAWER_SKU_PRIORITY = Object.freeze([
  "JP-drawer-wire-basket",
  "JP-drawer-jewelry",
  "JP-drawer-multi-storage",
  "JP-drawer-underwear-a",
  "JP-drawer-leather-storage",
  "JP-drawer-underwear-b",
  "JP-drawer-wire-basket-short"
]);
const JAPANESE_PREMIUM_DRAWER_SKU_PRIORITY = Object.freeze([
  "JP-drawer-leather-storage",
  "JP-drawer-jewelry",
  "JP-drawer-multi-storage",
  "JP-drawer-underwear-a",
  "JP-drawer-underwear-b",
  "JP-drawer-wire-basket",
  "JP-drawer-wire-basket-short"
]);
const JAPANESE_TROUSER_RACK_MIN_CLEARANCE_BELOW = getClearanceValue("trouserRack", "below", 600);
const JAPANESE_LONG_HANG_MIN_CLEARANCE_BELOW = getClearanceValue("longClothes", "below", 1350);
const JAPANESE_SHORT_HANG_MIN_CLEARANCE_BELOW = getClearanceValue("shortHang", "below", 700);
const JAPANESE_JEWELRY_BOX_GAP_ABOVE_CABINET = 20;
const JAPANESE_CABINET_MODEL_HEIGHT = 500;
const JAPANESE_TROUSER_RACK_HEIGHTS = Object.freeze([950, 1050, 900, 1100]);
const JAPANESE_SHORT_HANG_CAPACITY_PER_RAIL = 20;
const JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT = JAPANESE_UPGRADE_POLICY.preserve.upperRail2000.height;
const JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT = JAPANESE_UPGRADE_POLICY.preserve.upperRail2000.minHeight;
const JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT = JAPANESE_UPGRADE_POLICY.preserve.upperRail2000.maxHeight;
const JAPANESE_PRESERVED_FUNCTIONAL_SHELF_MIN_HEIGHT = JAPANESE_UPGRADE_POLICY.preserve.functionalShelf.minHeight;
const JAPANESE_PRESERVED_FUNCTIONAL_SHELF_MAX_HEIGHT = JAPANESE_UPGRADE_POLICY.preserve.functionalShelf.maxHeight;
const JAPANESE_SHOE_CAPACITY_PRESERVE_REMOVAL_MIN_HEIGHT =
  JAPANESE_UPGRADE_POLICY.preserve.shoeCapacity.highRailShelfRemovalMinHeight;
const JAPANESE_ONE_FUNCTIONAL_SHELF_PER_LOWER_FUNCTIONAL_ZONE =
  JAPANESE_UPGRADE_POLICY.premiumFunctionalShelf.oneFunctionalShelfPerLowerFunctionalZone;
const JAPANESE_STANDARD_SUPPLEMENTAL_RAIL_HEIGHTS = Object.freeze([1050, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT]);
const JAPANESE_PREMIUM_SHELF_TOP_MARGIN = JAPANESE_UPGRADE_POLICY.premiumFunctionalShelf.topMargin;
const JAPANESE_PREMIUM_SHELF_RAIL_GAP = JAPANESE_UPGRADE_POLICY.premiumFunctionalShelf.railGap;
const JAPANESE_SUPPLEMENTAL_RAIL_ALLOWED_ROLES = new Set([
  "shoeShelfZone", "shelfZone", "storageAccessoryZone"
]);
const JAPANESE_SUPPLEMENTAL_RAIL_SUPPORT_COMPONENTS = new Set([
  "woodShelf", "cabinet", "jewelryBox", "trouserRack"
]);
const JAPANESE_TROUSER_RACK_BLOCKING_COMPONENTS = new Set([
  "cabinet", "woodShelf", "glassShelf", "shoeShelf", "shoesShelf",
  "drawer", "basket", "storageBox", "jewelryBox", "mixedStorage"
]);
const JAPANESE_LOWER_FUNCTIONAL_STORAGE_SUPPORTS = new Set(
  JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.storageSupports
);
const JAPANESE_LOWER_FUNCTIONAL_ZONE_COMPONENTS = new Set(
  JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.components
);
const JAPANESE_CASE_MATCH_WEIGHT = 0.20;
const JAPANESE_CASE_SCORE_MAX = 25;
const CASE_MATCHING_DISTANCE_PENALTY_WEIGHT = 1.25;
const CASE_MATCHING_PROFILE_AFFINITY_WEIGHT = 3.5;
const JAPANESE_CASE_TOLERANCE = Object.freeze({ basic: 0.30, value: 0.20, premium: 0.15 });
const CANDIDATE_QA_SELECTION_WINDOW = 10;
const PLACEMENT_CAPACITY_ZONE_ITEM_TYPES = Object.freeze({
  shortHangZone: "shortClothes",
  longHangZone: "longClothes",
  shoeZone: "shoes",
  bagZone: "bags",
  beddingZone: "bedding",
  luggageZone: "luggage",
  trouserZone: "trousers",
  jewelryZone: "jewelry",
  displayZone: "display",
  bookZone: "books"
});
const PLACEMENT_CAPACITY_COMPONENT_ALIASES = Object.freeze({
  shoeShelf: "woodShelf",
  shoesShelf: "woodShelf"
});
const JAPANESE_PLACEMENT_DIMENSION_FIELDS = Object.freeze([
  "postProfileWidth",
  "rawBayWidth",
  "postCenterDistance",
  "innerBayWidth",
  "usableComponentWidth",
  "componentCutLength",
  "cutLength",
  "visualScaleWidth",
  "widthSource"
]);

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
  caseMatching: {
    enabled: false,
    selectedCaseId: null,
    selectedPersona: "",
    score: 0,
    topCandidates: [],
    userRequirementVector: {}
  },
  caseMatchingRuleLoad: {
    attempted: false,
    loaded: false,
    error: null,
    fallbackToLegacy: true
  },
  componentUpgrade: {},
  caseLayoutTemplate: [],
  resolvedSkeleton: [],
  forbiddenPatternViolations: {},
  tierUpgradeRulesApplied: {},
  bayRoleComponents: {},
  candidateQa: {
    passed: true,
    issues: [],
    summary: {},
    selectionMode: "diagnosticOnly",
    attemptedTierSets: 0,
    selectedAttemptIndex: 0,
    failedAttemptCount: 0,
    capacitySource: "estimatedFallback",
    capacityByPlan: {},
    capacityDiff: [],
    capacityContributions: [],
    missingWidthFallbackCount: 0
  },
  heatmap: {}
};

export function generateCandidatePlans(answers = {}, rulesData = {}) {
  const normalized = normalizeAnswers(answers);
  const isJapaneseCloset = getSelectedSeriesId(normalized) === "japanese-closet";
  normalized.matchedJapaneseCases = isJapaneseCloset
    ? (answers.matchedJapaneseCases || matchJapaneseCasesByRules(answers, rulesData.caseMatchingRules))
    : [];
  normalized.primaryJapaneseCase = normalized.matchedJapaneseCases[0] || null;
  normalized.caseMatching = normalized.primaryJapaneseCase?.caseMatching || null;
  normalized.componentUpgradeRules = rulesData.caseMatchingRules?.componentUpgradeRules || [];
  normalized.japaneseHardRequirements = getJapaneseHardRequirements(normalized);
  const supportedTypes = getSupportedTypes(getSelectedSeriesId(normalized));
  const candidates = [];
  PLAN_TYPES.forEach((planType) => {
    const planOutput = buildPlanRuleOutput(normalized.needs, normalized.peopleCount, planType);
    enumerateTierCandidates(normalized, rulesData, supportedTypes, planType, planOutput)
      .forEach((candidate) => candidates.push(candidate));
  });

  let filtered = candidates.filter((candidate) => filterCandidatePlan(candidate, {
    answers: normalized,
    supportedTypes,
    rulesData
  }));
  const usesJapaneseBudgetFallback = isJapaneseCloset && !filtered.length;
  if (usesJapaneseBudgetFallback) {
    filtered = candidates
      .filter((candidate) => candidate.rejectReason === "budgetExceeded")
      .map(cloneJapaneseBudgetFallbackCandidate);
  }
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
    caseMatching: normalized.caseMatching || buildDisabledCaseMatchingDebug(normalized),
    caseMatchingRuleLoad: rulesData.caseMatchingRuleLoad || buildDefaultCaseMatchingRuleLoad(rulesData.caseMatchingRules),
    componentUpgrade: {},
    japaneseBudgetFallbackUsed: usesJapaneseBudgetFallback && filtered.length > 0,
    heatmap: Object.fromEntries(PLAN_TYPES.map((planType) => [
      planType,
      heatmap[planType].map(toCandidateDebugSummary)
    ]))
  };
  console.log("[candidate-plan-engine]", lastStats);
  return valid;
}

function cloneJapaneseBudgetFallbackCandidate(candidate) {
  return {
    ...candidate,
    rejectReason: null,
    japaneseBudgetFallbackSource: true,
    placements: (candidate.placements || []).map((placement) => ({ ...placement })),
    parameters: { ...(candidate.parameters || {}) },
    configPreset: {
      ...(candidate.configPreset || {}),
      componentQuantities: { ...(candidate.configPreset?.componentQuantities || {}) },
      explicitPlacements: (candidate.configPreset?.explicitPlacements || []).map((placement) => ({ ...placement }))
    }
  };
}

export function matchJapaneseCasesByRules(answers = {}, caseMatchingRules = null, limit = 10) {
  const profiles = caseMatchingRules?.caseProfiles || [];
  if (!profiles.length) {
    return findSimilarJapaneseCases(answers, limit);
  }
  const userRequirementVector = buildCaseMatchingRequirementVector(answers);
  const answeredRequirementKeys = getAnsweredCaseMatchingRequirementKeys(answers);
  const tagsById = caseMatchingRules?.caseTagsById || new Map();
  const profileById = new Map(profiles.map((profile) => [profile.caseId, profile]));
  const scoredCases = japaneseCaseLibrary
    .map((caseData) => {
      const profile = profileById.get(caseData.caseId);
      if (!profile) return null;
      const tagRow = tagsById.get(caseData.caseId) || {};
      const scoreBreakdown = buildCaseMatchingScoreBreakdown(
        userRequirementVector,
        profile.scores || {},
        answeredRequirementKeys,
        profile,
        tagRow
      );
      const score = scoreBreakdown.finalScore;
      return {
        ...caseData,
        score: roundScore(score),
        matchedReason: profile.persona || profile.primaryType || "CaseMatchingRules.xlsx",
        persona: profile.persona || "",
        primaryType: profile.primaryType || "",
        priorityTag: profile.priorityTag || "",
        tags: tagRow.tags || [],
        avoidWhen: tagRow.avoidWhen || [],
        caseMatching: {
          enabled: true,
          selectedCaseId: "",
          selectedPersona: "",
          score: 0,
          topCandidates: [],
          userRequirementVector,
          scoreBreakdown
        }
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score
      || Number(right.layoutTemplate?.length || 0) - Number(left.layoutTemplate?.length || 0)
      || left.caseId.localeCompare(right.caseId));
  const topCandidates = scoredCases.slice(0, Math.max(1, Number(limit) || 10)).map((caseData) => ({
    caseId: caseData.caseId,
    persona: caseData.persona,
    score: caseData.score,
    scoreBreakdown: cloneCaseMatchingScoreBreakdown(caseData.caseMatching?.scoreBreakdown),
    tags: [...(caseData.tags || [])]
  }));
  const selected = scoredCases[0] || null;
  const debug = {
    enabled: true,
    selectedCaseId: selected?.caseId || null,
    selectedPersona: selected?.persona || "",
    score: selected?.score || 0,
    topCandidates,
    userRequirementVector,
    scoreBreakdown: cloneCaseMatchingScoreBreakdown(selected?.caseMatching?.scoreBreakdown)
  };
  return scoredCases.slice(0, Math.max(1, Number(limit) || 10)).map((caseData) => ({
    ...caseData,
    caseMatching: {
      ...debug,
      scoreBreakdown: cloneCaseMatchingScoreBreakdown(caseData.caseMatching?.scoreBreakdown)
    }
  }));
}

function buildCaseMatchingRequirementVector(answers = {}) {
  const source = answers.needs
    || (answers.demands && !Array.isArray(answers.demands) ? answers.demands : null)
    || answers.demandsWeights
    || answers.needWeights
    || {};
  return {
    shortClothes: demandScore(source, answers, "shortClothes", "短衣"),
    longClothes: demandScore(source, answers, "longClothes", "长衣"),
    shoes: demandScore(source, answers, "shoes", "鞋子"),
    bags: demandScore(source, answers, "bags", "包包"),
    bedding: demandScore(source, answers, "bedding", "被褥"),
    luggage: demandScore(source, answers, "luggage", "行李箱"),
    jewelry: demandScore(source, answers, "jewelry", "首饰"),
    trouser: demandScore(source, answers, "trousers", "裤子")
  };
}

function buildCaseMatchingScoreBreakdown(
  userRequirementVector,
  caseProfileScores,
  answeredRequirementKeys = null,
  profile = {},
  tagRow = {}
) {
  const answeredKeys = answeredRequirementKeys instanceof Set
    ? answeredRequirementKeys
    : new Set(Object.keys(userRequirementVector || {}));
  const perItemContribution = {};
  const perItemPenalty = {};
  Object.entries(userRequirementVector || {}).forEach(([key, userScore]) => {
    const normalizedUserScore = Number(userScore) || 0;
    const caseScore = Number(caseProfileScores[key]) || 0;
    perItemContribution[key] = roundScore(normalizedUserScore * caseScore);
    perItemPenalty[key] = answeredKeys.has(key)
      ? roundScore(Math.abs(normalizedUserScore - caseScore) * CASE_MATCHING_DISTANCE_PENALTY_WEIGHT)
      : 0;
  });
  const baseScore = roundScore(Object.values(perItemContribution)
    .reduce((sum, value) => sum + Number(value || 0), 0));
  const distancePenalty = roundScore(Object.values(perItemPenalty)
    .reduce((sum, value) => sum + Number(value || 0), 0));
  const profileAffinityAdjustment = getCaseMatchingProfileAffinityAdjustment(
    userRequirementVector,
    caseProfileScores,
    profile,
    tagRow
  );
  return {
    baseScore,
    distancePenalty,
    profileAffinityAdjustment,
    finalScore: roundScore(baseScore - distancePenalty + profileAffinityAdjustment),
    perItemContribution,
    perItemPenalty
  };
}

function getCaseMatchingProfileAffinityAdjustment(
  userRequirementVector = {},
  caseProfileScores = {},
  profile = {},
  tagRow = {}
) {
  const shortScore = Number(userRequirementVector.shortClothes) || 0;
  const longScore = Number(userRequirementVector.longClothes) || 0;
  if (shortScore < 4 || shortScore - longScore < 2) return 0;
  const profileText = [
    profile.primaryType,
    profile.persona,
    profile.priorityTag,
    ...(tagRow.tags || []),
    ...(tagRow.avoidWhen || [])
  ].join(" ").toLowerCase();
  const caseShortScore = Number(caseProfileScores.shortClothes) || 0;
  const caseLongScore = Number(caseProfileScores.longClothes) || 0;
  const isShortHeavyProfile = profileText.includes("shortclothesheavy")
    || profileText.includes("middleshort")
    || profileText.includes("short-heavy")
    || profileText.includes("短衣");
  if (!isShortHeavyProfile || caseShortScore < 4 || caseShortScore < caseLongScore) return 0;
  return roundScore(CASE_MATCHING_PROFILE_AFFINITY_WEIGHT);
}

function getAnsweredCaseMatchingRequirementKeys(answers = {}) {
  const source = answers.needs
    || (answers.demands && !Array.isArray(answers.demands) ? answers.demands : null)
    || answers.demandsWeights
    || answers.needWeights
    || {};
  const hasAnswer = (englishKey, chineseKey) => (
    Object.prototype.hasOwnProperty.call(source, englishKey)
    || Object.prototype.hasOwnProperty.call(source, chineseKey)
    || Object.prototype.hasOwnProperty.call(answers, englishKey)
    || Object.prototype.hasOwnProperty.call(answers, chineseKey)
    || Object.prototype.hasOwnProperty.call(answers.demandQuantityProfile || {}, chineseKey)
  );
  return new Set([
    ["shortClothes", "短衣"],
    ["longClothes", "长衣"],
    ["shoes", "鞋子"],
    ["bags", "包包"],
    ["bedding", "被褥"],
    ["luggage", "行李箱"],
    ["jewelry", "首饰"],
    ["trouser", "裤子", "trousers"]
  ].filter(([key, chineseKey, aliasKey]) => (
    hasAnswer(key, chineseKey) || (aliasKey && hasAnswer(aliasKey, chineseKey))
  )).map(([key]) => key));
}

function cloneCaseMatchingScoreBreakdown(scoreBreakdown = {}) {
  return {
    ...scoreBreakdown,
    perItemContribution: { ...(scoreBreakdown.perItemContribution || {}) },
    perItemPenalty: { ...(scoreBreakdown.perItemPenalty || {}) }
  };
}

function cloneComponentUpgradeDebug(debug = null) {
  if (!debug) return null;
  return {
    ...debug,
    appliedActions: (debug.appliedActions || []).map((item) => ({ ...item })),
    skippedActions: (debug.skippedActions || []).map((item) => ({ ...item })),
    protectedCoreZones: [...(debug.protectedCoreZones || [])]
  };
}

function demandScore(source, answers, englishKey, chineseKey) {
  const value = source[englishKey] ?? source[chineseKey] ?? answers[englishKey] ?? answers[chineseKey] ?? 0;
  return Math.max(0, Math.min(5, Number(value) || 0));
}

function buildDisabledCaseMatchingDebug(answers = {}) {
  return {
    enabled: false,
    selectedCaseId: null,
    selectedPersona: "",
    score: 0,
    topCandidates: [],
    userRequirementVector: buildCaseMatchingRequirementVector(answers)
  };
}

function buildDefaultCaseMatchingRuleLoad(caseMatchingRules = null) {
  return {
    attempted: Boolean(caseMatchingRules),
    loaded: caseMatchingRules?.enabled === true,
    error: caseMatchingRules?.error || null,
    fallbackToLegacy: caseMatchingRules?.enabled !== true
  };
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
  if (getSelectedSeriesId(answers) === "japanese-closet") {
    candidate.japanesePlacementValidationDebug = getJapanesePlacementValidationDiagnostics(placements);
    const invalidAccessoryPlacement = candidate.japanesePlacementValidationDebug
      .find((item) => !item.isValidPlacement);
    if (invalidAccessoryPlacement) {
      return rejectCandidate(candidate, invalidAccessoryPlacement.invalidReason);
    }
    candidate.forbiddenPatternViolations = getJapaneseCaseForbiddenPatternViolations(candidate);
    if (candidate.forbiddenPatternViolations.length) {
      return rejectCandidate(candidate, candidate.forbiddenPatternViolations[0].id);
    }
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
  candidate.shoeShelfGapWarning = !validateShoeGaps(placements);
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
  const visualScore = 0;
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

  const selected = getOrderedTierSet([basic, value, premium]);
  attachCandidateQaResult(selected);
  const missingPlanTypes = PLAN_TYPES.filter((planType, index) => !selected[index]);
  updateMissingPlanStats(missingPlanTypes, selected);
  updatePlanSimilarityStats(selected, reasons);
  return selected.filter(Boolean);
}

function selectJapaneseClosetCandidates(candidates, answers, supportedTypes) {
  const targets = getJapaneseClosetTargetPrices(answers);
  const availability = getCandidateBudgetAvailability(answers);
  const bayCount = Math.max(1, Number(availability?.bayCount || 1));
  const sourceSelection = selectJapaneseSkeletonSource(candidates, bayCount);
  if (!sourceSelection.candidate) return [];
  const skeleton = buildJapaneseLayoutSkeleton(answers, bayCount);
  const selectedResult = buildJapaneseSkeletonTierSet(
    sourceSelection.candidate,
    answers,
    skeleton,
    supportedTypes,
    targets
  );
  const selected = selectedResult.selected;
  attachCandidateQaResult(selected);
  const basic = selected[0];
  const value = selected[1];
  const premium = selected[2];
  const valueResult = selectedResult.valueResult;
  const premiumResult = selectedResult.premiumResult;
  attachJapanesePriceOrderDebug(selected);
  attachJapaneseTierDifferenceDebug(selected, skeleton, {
    fallbackUsed: sourceSelection.fallbackUsed || valueResult.fallbackUsed || premiumResult.fallbackUsed,
    fallbackReason: [
      sourceSelection.fallbackReason,
      valueResult.fallbackReason,
      premiumResult.fallbackReason
    ].filter(Boolean).join("; ") || "none"
  });
  Object.assign(lastStats, {
    budgetAvailability: {
      ...(lastStats.budgetAvailability || {}),
      basicTargetPrice: targets.basic,
      valueTargetPrice: targets.value,
      premiumTargetPrice: targets.premium
    },
    budgetMin: targets.budgetMin,
    budgetMax: targets.budgetMax,
    budgetMid: targets.budgetMid,
    basicMin: targets.basicMin,
    basicMax: targets.basicMax,
    basicTarget: targets.basic,
    basicBelowBudgetFallback: basic?.basicBelowBudgetFallback || false,
    priceWasTargetAdjusted: false,
    primaryCaseId: answers.primaryJapaneseCase?.caseId || null,
    caseLayoutTemplate: answers.primaryJapaneseCase?.layoutTemplate || [],
    resolvedSkeleton: skeleton,
    forbiddenPatternViolations: Object.fromEntries(selected.map((candidate) => [
      candidate.planType,
      candidate.forbiddenPatternViolations || []
    ])),
    tierUpgradeRulesApplied: Object.fromEntries(selected.map((candidate) => [
      candidate.planType,
      candidate.tierUpgradeRulesApplied || {}
    ])),
    bayRoleComponents: Object.fromEntries(selected.map((candidate) => [
      candidate.planType,
      candidate.bayRoleComponents || []
    ])),
    componentUpgrade: Object.fromEntries(selected.map((candidate) => [
      candidate.planType,
      candidate.componentUpgrade || null
    ])),
    skeleton,
    basicComponents: basic.componentCountByType,
    valueComponents: value.componentCountByType,
    premiumComponents: premium.componentCountByType,
    baseBayPrice: basic.baseBayPrice,
    basePlanPrice: basic.basePlanPrice,
    basicUpgradeList: basic.basicUpgradeList,
    valueUpgradeList: value.valueUpgradeList,
    premiumUpgradeList: premium.premiumUpgradeList,
    basicPriceBreakdown: basic.priceBreakdown,
    valuePriceBreakdown: value.priceBreakdown,
    premiumPriceBreakdown: premium.priceBreakdown,
    caseUsedForLayoutOnly: false,
    basicVsValueDifferent: basic.basicVsValueDifferent,
    valueVsPremiumDifferent: premium.valueVsPremiumDifferent,
    visibleUpgradeCountBasicToValue: value.visibleUpgradeCountBasicToValue,
    visibleUpgradeCountValueToPremium: premium.visibleUpgradeCountValueToPremium,
    priceOrderValid: premium.priceOrderValid,
    fallbackUsed: premium.fallbackUsed,
    fallbackReason: premium.fallbackReason
  });
  const missingPlanTypes = PLAN_TYPES.filter((planType, index) => !selected[index]);
  updateMissingPlanStats(missingPlanTypes, selected);
  updatePlanSimilarityStats(selected, [premium.fallbackReason]
    .filter((reason) => reason && reason !== "none"));
  return selected.filter(Boolean);
}

function buildJapaneseSkeletonTierSet(sourceCandidate, answers, skeleton, supportedTypes, targets) {
  const basic = buildJapaneseSkeletonTierCandidate(
    sourceCandidate,
    answers,
    skeleton,
    "basic",
    targets
  );
  const valueResult = buildJapaneseUpgradedTierCandidate(
    basic,
    answers,
    skeleton,
    "value",
    supportedTypes,
    targets
  );
  const value = valueResult.candidate;
  const premiumResult = buildJapaneseUpgradedTierCandidate(
    value,
    answers,
    skeleton,
    "premium",
    supportedTypes,
    targets
  );
  const premium = premiumResult.candidate;

  basic.basicBelowBudgetFallback = getCandidateRealPrice(basic) < targets.budgetMin;
  annotateJapaneseSelection(basic, targets.basic, "caseSkeletonBasic", targets);
  annotateJapaneseSelection(value, targets.value, "caseSkeletonValueUpgrade", targets);
  annotateJapaneseSelection(premium, targets.premium, "caseSkeletonPremiumUpgrade", targets);

  return {
    selected: [basic, value, premium],
    valueResult,
    premiumResult
  };
}

function selectJapaneseSkeletonSource(candidates, bayCount) {
  const exactBasic = getJapaneseExactBasicSources(candidates, bayCount);
  const exactAnyTier = getJapaneseExactAnyTierSources(candidates, bayCount);
  const pool = exactBasic.length ? exactBasic : exactAnyTier.length ? exactAnyTier : candidates;
  const candidate = sortJapaneseSkeletonSources(pool)[0] || null;
  return {
    candidate,
    fallbackUsed: !exactBasic.length,
    fallbackReason: exactBasic.length ? "" : exactAnyTier.length
      ? "noBasicSourceAtSkeletonBayCount"
      : "noSourceAtSkeletonBayCount"
  };
}

function selectJapaneseSkeletonSourceCandidates(candidates, bayCount) {
  const exactBasic = getJapaneseExactBasicSources(candidates, bayCount);
  const exactAnyTier = getJapaneseExactAnyTierSources(candidates, bayCount);
  const pool = exactBasic.length ? exactBasic : exactAnyTier.length ? exactAnyTier : candidates;
  return sortJapaneseSkeletonSources(pool).slice(0, CANDIDATE_QA_SELECTION_WINDOW);
}

function getJapaneseExactBasicSources(candidates, bayCount) {
  return candidates.filter((candidate) => candidate.planType === "basic"
    && Number(candidate.parameters?.bayCount || candidate.configPreset?.bayCount) === bayCount);
}

function getJapaneseExactAnyTierSources(candidates, bayCount) {
  return candidates.filter((candidate) => (
    Number(candidate.parameters?.bayCount || candidate.configPreset?.bayCount) === bayCount
  ));
}

function sortJapaneseSkeletonSources(candidates) {
  return [...candidates].sort((left, right) => (
    Number(right.scores?.caseMatchBonus || 0) - Number(left.scores?.caseMatchBonus || 0)
    || Number(right.scores?.layoutScore || 0) - Number(left.scores?.layoutScore || 0)
    || Number(right.scores?.totalScore || 0) - Number(left.scores?.totalScore || 0)
  ));
}

function buildJapaneseLayoutSkeleton(answers, bayCount) {
  const caseTemplate = answers.primaryJapaneseCase?.layoutTemplate || [];
  const templateRoles = caseTemplate.length === bayCount
    ? caseTemplate.map((entry) => entry.role || entry.zone)
    : getJapaneseRuleTemplateRoles(bayCount);
  const wallSlots = getJapaneseBackFirstWallSlots(answers, bayCount);
  return templateRoles.map((sourceRole, bayIndex) => ({
    bayIndex,
    wallId: wallSlots[bayIndex]?.wallId || "back",
    wallBayIndex: Number(wallSlots[bayIndex]?.bayIndex) || 0,
    sourceRole,
    role: resolveJapaneseConditionalRole(sourceRole, answers.needs || {}),
    zone: resolveJapaneseConditionalRole(sourceRole, answers.needs || {})
  }));
}

function getJapaneseBackFirstWallSlots(answers = {}, totalBayCount = 1) {
  const layout = getJapaneseOptimizedWallLayout(answers, totalBayCount);
  return [
    ...Array.from({ length: layout.back.bayCount }, (_, bayIndex) => ({ wallId: "back", bayIndex })),
    ...Array.from({ length: layout.left.bayCount }, (_, bayIndex) => ({ wallId: "left", bayIndex })),
    ...Array.from({ length: layout.right.bayCount }, (_, bayIndex) => ({ wallId: "right", bayIndex }))
  ].slice(0, Math.max(1, Number(totalBayCount) || 1));
}

function getJapaneseOptimizedWallLayout(answers = {}, totalBayCount = 1) {
  const roomWidth = Math.max(1, Number(answers.roomWidth || answers.dimensions?.width) || 3600);
  const roomDepth = Math.max(1, Number(answers.roomDepth || answers.dimensions?.depth) || 2800);
  const layoutType = answers.layoutType || answers.dimensions?.layoutType || "I型";
  const bayTotal = Math.max(1, Math.round(Number(totalBayCount) || 1));
  if (layoutType !== "L型" && layoutType !== "U型") {
    return {
      mode: "singleWall",
      back: createJapaneseWallLayoutSegment(roomWidth, bayTotal),
      left: createJapaneseWallLayoutSegment(roomDepth, 0),
      right: createJapaneseWallLayoutSegment(roomDepth, 0)
    };
  }

  const sideWallCount = layoutType === "U型" ? 2 : 1;
  const backBayCount = getJapanesePreferredBackWallBayCount(roomWidth, bayTotal);
  const remainingBayCount = Math.max(0, bayTotal - backBayCount);
  const leftBayCount = layoutType === "U型"
    ? Math.ceil(remainingBayCount / 2)
    : remainingBayCount;
  const rightBayCount = layoutType === "U型"
    ? Math.floor(remainingBayCount / 2)
    : 0;
  const minimumSideCount = remainingBayCount > 0 ? 1 : 0;

  return {
    mode: "backFirst",
    back: createJapaneseWallLayoutSegment(roomWidth, backBayCount),
    left: createJapaneseWallLayoutSegment(roomDepth, Math.max(minimumSideCount, leftBayCount)),
    right: createJapaneseWallLayoutSegment(roomDepth, sideWallCount === 2 ? Math.max(minimumSideCount, rightBayCount) : 0)
  };
}

function getJapanesePreferredBackWallBayCount(roomWidth, totalBayCount) {
  const width = Math.max(1, Number(roomWidth) || 1);
  const maxCount = Math.max(1, Math.min(Number(totalBayCount) || 1, Math.ceil(width / 600)));
  const candidates = Array.from({ length: maxCount }, (_, index) => index + 1)
    .map((bayCount) => ({
      bayCount,
      bayWidth: width / bayCount,
      score: getJapaneseBackWallBayWidthScore(width / bayCount, bayCount)
    }))
    .filter((candidate) => candidate.bayWidth <= 1000);
  return (candidates.length ? candidates : [{ bayCount: 1 }])
    .sort((left, right) => (
      left.score.band - right.score.band
      || right.bayCount - left.bayCount
      || left.score.preference - right.score.preference
    ))[0].bayCount;
}

function getJapaneseBackWallBayWidthScore(bayWidth, bayCount) {
  const width = Number(bayWidth) || 0;
  const inPreferredRange = width >= 750 && width <= 900;
  const band = inPreferredRange
    ? 0
    : width >= 700 && width < 750
      ? 1
      : width >= 600 && width < 700
        ? 2
        : width > 900
          ? 3
          : 4;
  const preference = Math.min(
    ...JAPANESE_BACK_WALL_PREFERRED_BAY_WIDTHS.map((preferred, index) => (
      Math.abs(width - preferred) + index * 0.01
    ))
  );
  return { band, preference, bayCount };
}

function createJapaneseWallLayoutSegment(length, bayCount) {
  const normalizedBayCount = Math.max(0, Math.round(Number(bayCount) || 0));
  const wallLength = Math.max(1, Number(length) || 1);
  return {
    bayCount: normalizedBayCount,
    bayWidths: normalizedBayCount > 0
      ? Array.from({ length: normalizedBayCount }, () => wallLength / normalizedBayCount)
      : []
  };
}

function getJapaneseRuleTemplateRoles(bayCount) {
  const exact = JAPANESE_CASE_LAYOUT_RULES.bayTemplates[bayCount];
  if (exact) return [...exact];
  const base = [...JAPANESE_CASE_LAYOUT_RULES.bayTemplates[6]];
  while (base.length < bayCount) base.splice(base.length - 1, 0, "shortHangZone");
  return base.slice(0, bayCount);
}

function resolveJapaneseConditionalRole(role, needs) {
  if (role === "longHangOrShoeZone") {
    return Number(needs.鞋子 || 0) > 0 ? "shoeShelfZone" : "longHangZone";
  }
  if (role === "trouserOrShortHangZone") {
    return Number(needs.裤子 || 0) >= 2 ? "trouserZone" : "shortHangZone";
  }
  return role;
}

function buildJapaneseSkeletonTierCandidate(source, answers, skeleton, planType, targets) {
  const candidate = cloneCandidateForTier(source, planType);
  candidate.planId = `${planType}:case-skeleton:${answers.primaryJapaneseCase?.caseId || "auto"}`;
  candidate.parameters.bayCount = skeleton.length;
  candidate.configPreset.bayCount = skeleton.length;
  candidate.placements = [];
  skeleton.forEach((entry) => initializeJapaneseSkeletonBay(
    candidate.placements,
    entry,
    answers,
    planType
  ));
  candidate.skeleton = skeleton.map((item) => ({ ...item }));
  candidate.layoutTemplate = answers.primaryJapaneseCase?.layoutTemplate || [];
  candidate.caseLayoutTemplate = candidate.layoutTemplate;
  candidate.basicUpgradeList = [];
  applyJapaneseBasicLowCostUpgrades(candidate, answers, skeleton, targets);
  finalizeJapaneseSkeletonCandidate(candidate, answers, planType);
  return candidate;
}

function initializeJapaneseSkeletonBay(placements, entry, answers, planType) {
  const { bayIndex, role, sourceRole } = entry;
  const wallId = entry.wallId || "back";
  const wallBayIndex = Number(entry.wallBayIndex) || 0;
  const add = (zoneType, componentType, heightFromFloor, extra = {}) => {
    placements.push({
      ...placement(zoneType, componentType, bayIndex, heightFromFloor, wallId),
      wallBayIndex,
      templateRole: role,
      templateZone: role,
      ...extra
    });
  };
  if (role === "shortHangZone") {
    add("shortHangZone", "singleRail", 1050, { isBaseRail: true });
    add("shortHangZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, { isBaseRail: true });
    return;
  }
  if (role === "longHangZone") {
    add("longHangZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, { isBaseRail: true });
    return;
  }
  if (role === "shoeShelfZone") {
    if (planType === "basic" && isLowBudgetJapaneseBasic(answers)) {
      add("shortHangZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, {
        isBaseRail: true,
        shoeDemandFloorStorage: true,
        floorStorageReason: "lowBudgetUsesFloorStorage"
      });
      return;
    }
    const range = JAPANESE_CASE_LAYOUT_RULES.tierUpgradeRules[planType]?.shoeShelfRange || [1, 3];
    const shelfCount = Number(answers.needs?.鞋子 || 0) > 0 ? Math.max(1, range[1]) : 1;
    getJapaneseShelfHeights(role).slice(0, shelfCount)
      .forEach((height) => add("shoeZone", "woodShelf", height));
    if (sourceRole === "longHangOrShoeZone") {
      add("shortHangZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, {
        isBaseRail: true,
        source: "longHangOrShoeZonePreservedHighRail",
        sourceRole
      });
    }
    return;
  }
  if (role === "shelfZone") {
    if (planType === "basic") {
      add("storageZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, { isBaseRail: true });
    } else {
      getJapaneseShelfHeights(role).slice(0, planType === "premium" ? 5 : 3)
        .forEach((height) => add("storageZone", "woodShelf", height));
    }
    return;
  }
  if (role === "trouserZone") {
    add("shortHangZone", "singleRail", 1050, { isBaseRail: true });
    add("shortHangZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, { isBaseRail: true });
    return;
  }
  if (role === "luggageZone") {
    placements.push({
      zoneType: "luggageZone",
      componentType: "",
      wallId,
      bayIndex,
      wallBayIndex,
      heightFromFloor: 0,
      reservedHeight: 800,
      templateRole: role,
      templateZone: role
    });
    add("luggageZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, { isBaseRail: true });
    return;
  }
  add(role === "jewelryZone" ? "jewelryZone" : "storageZone", "singleRail", JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, {
    isBaseRail: true
  });
}

function buildJapaneseUpgradedTierCandidate(
  baseCandidate,
  answers,
  skeleton,
  planType,
  supportedTypes,
  targets
) {
  const candidate = cloneCandidateForTier(baseCandidate, planType);
  if (planType === "premium") {
    removeJapanesePremiumShoeShelfFunctionalShelves(candidate, skeleton, answers);
  }
  candidate.planId = `${planType}:case-skeleton:${answers.primaryJapaneseCase?.caseId || "auto"}`;
  candidate.skeleton = skeleton.map((item) => ({ ...item }));
  const usedBays = new Set();
  const needs = answers.needs || {};
  const upgradeList = [];
  let fallbackUsed = false;
  let fallbackReason = "";
  if (planType === "value") {
    applyJapaneseValueUpgrades(
      candidate,
      answers,
      skeleton,
      supportedTypes,
      targets,
      usedBays,
      upgradeList
    );
  } else {
    applyJapanesePremiumUpgrades(
      candidate,
    answers,
    skeleton,
    supportedTypes,
    targets,
    usedBays,
    upgradeList
  );
  }
  if (countJapaneseUpgradePoints(upgradeList) < 2) {
    fallbackUsed = true;
    fallbackReason = `${planType}RequiredAdditionalVisibleUpgradeSearch`;
    addJapaneseShelfUpgrade(candidate, skeleton, upgradeList, 2, "", {
      budgetMax: targets.budgetMax,
      skipShoeShelfZone: isMediumJapaneseShoeDemand(answers)
    });
    replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList);
  }
  finalizeJapaneseSkeletonCandidate(candidate, answers, planType);
  if (planType === "value" && preserveJapaneseMediumShoeUpperRails(candidate, answers, skeleton)) {
    finalizeJapaneseSkeletonCandidate(candidate, answers, planType);
  }
  if (planType === "premium" && getCandidateRealPrice(candidate) <= getCandidateRealPrice(baseCandidate)) {
    fallbackUsed = true;
    fallbackReason ||= "premiumNeededRealPriceUpgrade";
    addJapaneseShelfUpgrade(candidate, skeleton, upgradeList, 2, "", { budgetMax: targets.budgetMax });
    finalizeJapaneseSkeletonCandidate(candidate, answers, planType);
  }
  candidate[`${planType}UpgradeList`] = upgradeList;
  const requirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  candidate.premiumHardRequirements = {
    requiresTrouserRack: requirements.requiresTrouserRack,
    requiresJewelryBox: requirements.requiresJewelryBox,
    requiresCabinet: requirements.requiresCabinet
  };
  candidate.premiumRequirementStatus = getJapaneseRequirementStatus(candidate, answers, requirements);
  candidate.caseLibraryAppliedAs = "layoutReferenceOnly";
  candidate.caseUsedForLayoutOnly = true;
  candidate.hardRuleOverrideCase = false;
  return { candidate, fallbackUsed, fallbackReason };
}

function applyJapaneseBasicLowCostUpgrades(candidate, answers, skeleton, targets) {
  const upgradeList = candidate.basicUpgradeList;
  const hasShoeDemand = Number(answers.needs?.鞋子 || 0) > 0;
  if (hasShoeDemand && isLowBudgetJapaneseBasic(answers, targets)) {
    const debug = candidate.componentUpgrade || createComponentUpgradeDebug(candidate, answers, skeleton, targets);
    candidate.componentUpgrade = debug;
    debug.skippedActions.push({
      action: "EnsureShoeShelfCount",
      upgradeType: "Add",
      addComponent: "WoodShelf",
      reason: "lowBudgetUsesFloorStorage"
    });
  } else if (hasShoeDemand) {
    ensureJapaneseShoeShelfCount(candidate, skeleton, upgradeList, 3, targets);
  }
  applyJapaneseComponentUpgradeRules(candidate, answers, skeleton, targets, upgradeList, {
    mode: "budgetTopUp",
    planType: "basic"
  });
  const targetPrice = Math.max(
    skeleton.length * JAPANESE_CLOSET_AI_PRICES.basicHangGroup,
    Number(targets.budgetMin || 0)
  );
  let guard = 0;
  while (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) < targetPrice - 50 && guard < 12) {
    const upgraded = replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList);
    if (!upgraded) break;
    guard += 1;
  }
}

function isLowBudgetJapaneseBasic(answers = {}, targets = {}) {
  const label = String(answers.budgetRange || answers.budget || "");
  const budgetMax = Number(targets.budgetMax || 0);
  return label.includes("3,000以下") || (budgetMax > 0 && budgetMax <= 3000);
}

function addJapaneseDrawerMerchandisingUpgrades(
  candidate,
  answers,
  skeleton,
  usedBays,
  upgradeList,
  targets = {},
  planType = "value"
) {
  const sequence = planType === "premium"
    ? [
      { componentType: "drawerDouble", skus: [JAPANESE_PREMIUM_DRAWER_SKU_PRIORITY[0], JAPANESE_PREMIUM_DRAWER_SKU_PRIORITY[1]] },
      ...JAPANESE_PREMIUM_DRAWER_SKU_PRIORITY.map((sku) => ({ componentType: "drawerSingle", sku }))
    ]
    : JAPANESE_VALUE_DRAWER_SKU_PRIORITY.map((sku) => ({ componentType: "drawerSingle", sku }));
  const targetCount = planType === "premium" ? 2 : 1;
  let added = 0;
  for (const request of sequence) {
    if (added >= targetCount) break;
    const price = getJapaneseDrawerMerchandisingPrice(request);
    if (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) + price > Number(targets.budgetMax || Infinity)) continue;
    if (addJapaneseDrawerMerchandisingPlacement(candidate, answers, skeleton, usedBays, request)) {
      upgradeList.push({
        ...japaneseUpgradeDebug(request.componentType, price),
        productSku: request.componentType === "drawerDouble" ? JAPANESE_DRAWER_DOUBLE_SKU : request.sku,
        ...(request.componentType === "drawerDouble"
          ? {
            topDrawerSku: request.skus[0],
            bottomDrawerSku: request.skus[1]
          }
          : {})
      });
      added += 1;
    }
  }
  return added;
}

function getJapaneseDrawerMerchandisingPrice(request) {
  return request.componentType === "drawerDouble"
    ? JAPANESE_CLOSET_AI_PRICES.drawerDouble
    : JAPANESE_CLOSET_AI_PRICES.drawerSingle;
}

function addJapaneseDrawerMerchandisingPlacement(candidate, answers, skeleton, usedBays, request) {
  const candidates = skeleton
    .filter((entry) => isJapaneseDrawerMerchandisingRole(entry.role))
    .sort((left, right) => (
      Number(usedBays.has(left.bayIndex)) - Number(usedBays.has(right.bayIndex))
      || getJapaneseDrawerMerchandisingRoleRank(left.role) - getJapaneseDrawerMerchandisingRoleRank(right.role)
      || left.bayIndex - right.bayIndex
    ));
  for (const entry of candidates) {
    const bayIndex = Number(entry.bayIndex);
    if (usedBays.has(bayIndex)) continue;
    const bayPlacements = candidate.placements.filter((item) => Number(item.bayIndex) === bayIndex && item.componentType);
    if (!isJapaneseDrawerBayStructurallyEligible(request.componentType, bayPlacements, entry.role)) continue;
    const drawerPlacement = createJapaneseDrawerMerchandisingPlacement(entry, request, answers, skeleton.length);
    if (bayPlacements.some((item) => intervalsOverlap(intervalFor(item), intervalFor(drawerPlacement)))) continue;
    if (getJapanesePlacementValidationDiagnostics([...bayPlacements, drawerPlacement])
      .some((item) => !item.isValidPlacement)) continue;
    candidate.placements = candidate.placements.filter((item) => !(
      Number(item.bayIndex) === bayIndex
      && ["singleRail", "doubleRail"].includes(item.componentType)
      && Number(item.heightFromFloor || 0) >= 900
      && Number(item.heightFromFloor || 0) <= 1200
    ));
    candidate.placements.push(drawerPlacement);
    usedBays.add(bayIndex);
    return true;
  }
  return false;
}

function isJapaneseDrawerMerchandisingRole(role = "") {
  return [
    "storageAccessoryZone",
    "jewelryZone",
    "trouserZone",
    "shortHangZone"
  ].includes(role);
}

function getJapaneseDrawerMerchandisingRoleRank(role = "") {
  return {
    storageAccessoryZone: 0,
    jewelryZone: 1,
    trouserZone: 2,
    shortHangZone: 3
  }[role] ?? 9;
}

function isJapaneseDrawerBayStructurallyEligible(componentType, bayPlacements = [], role = "") {
  if (!isJapaneseDrawerMerchandisingRole(role)) return false;
  if (bayPlacements.some((item) => ["drawerSingle", "drawerDouble", "cabinet", "trouserRack", "jewelryBox"].includes(item.componentType))) {
    return false;
  }
  if (role === "shortHangZone") {
    return bayPlacements.some((item) => (
      ["singleRail", "doubleRail"].includes(item.componentType)
      && Number(item.heightFromFloor || 0) >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
      && Number(item.heightFromFloor || 0) <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
    ));
  }
  return componentType === "drawerSingle" || componentType === "drawerDouble";
}

function createJapaneseDrawerMerchandisingPlacement(entry, request, answers = {}, totalBayCount = 1) {
  const componentType = request.componentType;
  const drawerPlacement = placement(
    "storageZone",
    componentType,
    Number(entry.bayIndex) || 0,
    0,
    entry.wallId || "back"
  );
  drawerPlacement.wallBayIndex = Number(entry.wallBayIndex) || 0;
  drawerPlacement.templateRole = entry.role;
  drawerPlacement.templateZone = entry.role;
  drawerPlacement.sourceRole = entry.sourceRole;
  drawerPlacement.source = "japaneseDrawerMerchandising";
  drawerPlacement.productSku = componentType === "drawerDouble" ? JAPANESE_DRAWER_DOUBLE_SKU : request.sku;
  if (componentType === "drawerDouble") {
    drawerPlacement.topDrawerSku = request.skus[0];
    drawerPlacement.bottomDrawerSku = request.skus[1];
  }
  const cuttingRules = getCuttingRules("japanese-closet");
  const wallLayout = getJapaneseOptimizedWallLayout(answers, totalBayCount);
  const wallSegment = wallLayout[drawerPlacement.wallId] || wallLayout.back;
  const bayWidth = Number(wallSegment?.bayWidths?.[drawerPlacement.wallBayIndex]) || 0;
  drawerPlacement.preferredWidth = bayWidth || getPreferredJapaneseFixedModuleWidth(answers.roomWidth, totalBayCount);
  drawerPlacement.allowedWidths = [drawerPlacement.preferredWidth].filter((width) => Number(width) > 0);
  if (cuttingRules) {
    const componentCutLength = cuttingRules.getCutLength?.(componentType, drawerPlacement.preferredWidth);
    const visualScaleWidth = cuttingRules.getVisualScaleWidth?.(
      componentType,
      drawerPlacement.preferredWidth,
      componentCutLength,
      drawerPlacement.preferredWidth
    );
    if (Number.isFinite(Number(componentCutLength))) {
      drawerPlacement.componentCutLength = Number(componentCutLength);
      drawerPlacement.cutLength = Number(componentCutLength);
    }
    if (Number.isFinite(Number(visualScaleWidth))) {
      drawerPlacement.visualScaleWidth = Number(visualScaleWidth);
    }
  }
  return drawerPlacement;
}

function applyJapaneseValueUpgrades(
  candidate,
  answers,
  skeleton,
  supportedTypes,
  targets,
  usedBays,
  upgradeList
) {
  applyJapaneseComponentUpgradeRules(candidate, answers, skeleton, targets, upgradeList, {
    mode: "tierUpgrade",
    planType: "value",
    supportedTypes,
    usedBays
  });
  addJapaneseDrawerMerchandisingUpgrades(candidate, answers, skeleton, usedBays, upgradeList, targets, "value");
  const requirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  if (shouldAddStorageCabinetByDemand(answers)
    && supportedTypes.has("cabinet")
    && addJapaneseSkeletonUpgrade(candidate, "cabinet", skeleton, answers, usedBays)) {
    upgradeList.push(japaneseUpgradeDebug("cabinet", 800));
  }
  const optionalDemandUpgrades = [
    ...(requirements.valuePrefersTrouserRack ? ["trouserRack"] : []),
    ...(requirements.valuePrefersJewelryBox ? ["jewelryBox"] : [])
  ];
  for (const componentType of optionalDemandUpgrades) {
    const price = componentType === "trouserRack" ? 660 : 700;
    if (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) + price > targets.budgetMax) continue;
    if (!supportedTypes.has(componentType)) continue;
    if (addJapaneseSkeletonUpgrade(candidate, componentType, skeleton, answers, usedBays)) {
      upgradeList.push(japaneseUpgradeDebug(componentType, price));
      break;
    }
  }
  if (Number(answers.needs?.鞋子 || 0) > 0) {
    const remainingBudget = Math.max(0, targets.budgetMax
      - getJapaneseUnroundedPlanPrice(candidate, skeleton.length));
    const currentShoeShelves = candidate.placements.filter((item) => (
      item.componentType === "woodShelf" && item.templateRole === "shoeShelfZone"
    )).length;
    const affordableTarget = Math.min(5, currentShoeShelves + Math.floor(remainingBudget / 160));
    const shoeShelfTarget = isMediumJapaneseShoeDemand(answers)
      ? Math.max(3, currentShoeShelves)
      : Math.max(3, affordableTarget);
    ensureJapaneseShoeShelfCount(candidate, skeleton, upgradeList, shoeShelfTarget, targets);
  }
  ensureJapaneseDedicatedShelfCount(candidate, skeleton, upgradeList, 3);
  if (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) < Number(targets.value || 0) - 50) {
    replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList);
  }
  while (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) < Number(targets.value || 0) - 80) {
    if (!replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList)) break;
  }
}

function applyJapanesePremiumUpgrades(
  candidate,
  answers,
  skeleton,
  supportedTypes,
  targets,
  usedBays,
  upgradeList
) {
  applyJapaneseComponentUpgradeRules(candidate, answers, skeleton, targets, upgradeList, {
    mode: "tierUpgrade",
    planType: "premium",
    supportedTypes,
    usedBays
  });
  addJapaneseDrawerMerchandisingUpgrades(candidate, answers, skeleton, usedBays, upgradeList, targets, "premium");
  const requirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  const requiredComponents = [
    ...(requirements.requiresTrouserRack ? ["trouserRack"] : []),
    ...(requirements.requiresJewelryBox ? ["jewelryBox"] : [])
  ];
  requiredComponents.forEach((componentType) => {
    if (candidate.placements.some((item) => item.componentType === componentType)) return;
    if (!supportedTypes.has(componentType)) return;
    if (addJapaneseSkeletonUpgrade(candidate, componentType, skeleton, answers, usedBays, true)) {
      upgradeList.push(japaneseUpgradeDebug(
        componentType,
        componentType === "trouserRack" ? 660 : 700
      ));
    }
  });
  if (shouldAddStorageCabinetByDemand(answers)
    && supportedTypes.has("cabinet")
    && !candidate.placements.some((item) => item.componentType === "cabinet")
    && addJapaneseSkeletonUpgrade(candidate, "cabinet", skeleton, answers, usedBays, true)) {
    upgradeList.push(japaneseUpgradeDebug("cabinet", 800));
  }
  if (Number(answers.needs?.鞋子 || 0) > 0) {
    ensureJapaneseShoeShelfCount(candidate, skeleton, upgradeList, 7, targets);
  }
  ensureJapaneseDedicatedShelfCount(candidate, skeleton, upgradeList, 5);
  if (countJapaneseUpgradePoints(upgradeList) < 2
    && shouldAddStorageCabinetByDemand(answers)
    && supportedTypes.has("cabinet")
    && addJapaneseSkeletonUpgrade(candidate, "cabinet", skeleton, answers, usedBays, true)) {
    upgradeList.push(japaneseUpgradeDebug("cabinet", 800));
  }
  if (countJapaneseUpgradePoints(upgradeList) < 2) {
    addJapaneseShelfUpgrade(candidate, skeleton, upgradeList, 2);
  }
  if (countJapaneseUpgradePoints(upgradeList) < 2) {
    replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList);
  }
}

function applyJapaneseComponentUpgradeRules(
  candidate,
  answers,
  skeleton,
  targets = {},
  upgradeList = [],
  options = {}
) {
  const rules = getExecutableComponentUpgradeRules(answers);
  const debug = candidate.componentUpgrade || createComponentUpgradeDebug(candidate, answers, skeleton, targets);
  candidate.componentUpgrade = debug;
  if (!rules.length) {
    debug.enabled = false;
    debug.reason = "noComponentUpgradeRules";
    debug.budgetAfter = getJapaneseUnroundedPlanPrice(candidate, skeleton.length);
    return debug;
  }
  debug.enabled = true;
  const budgetMin = Number(targets.budgetMin || 0);
  const budgetMax = Number(targets.budgetMax || Infinity);
  for (const rule of rules) {
    const currentPrice = getJapaneseUnroundedPlanPrice(candidate, skeleton.length);
    if (budgetMin > 0 && currentPrice >= budgetMin && currentPrice <= budgetMax) {
      debug.reason = "alreadyInBudgetRange";
      break;
    }
    if (isCoreReplacementRule(rule) && isCoreHangingProtected(answers, debug)) {
      debug.skippedActions.push(componentUpgradeSkip(rule, "protectedCoreRequirement"));
      continue;
    }
    if (!isComponentUpgradeRuleAllowed(rule, answers, debug, options)) {
      debug.skippedActions.push(componentUpgradeSkip(rule, "noSpace"));
      continue;
    }
    if (isAddShelfAboveRailRule(rule)) {
      const result = addJapaneseShelfAboveRailUpgrade(candidate, answers, skeleton, upgradeList, rule, targets);
      if (result.added > 0) {
        debug.appliedActions.push({
          action: getComponentUpgradeRuleValue(rule, "upgradeAction"),
          upgradeType: getComponentUpgradeRuleValue(rule, "upgradeType"),
          addComponent: getComponentUpgradeRuleValue(rule, "addComponent"),
          count: result.added,
          reason: options.mode === "budgetTopUp" ? "budgetTopUpAddAbove" : "tierAddAbove"
        });
      } else {
        debug.skippedActions.push(componentUpgradeSkip(rule, result.reason || "noSpace"));
      }
      continue;
    }
    debug.skippedActions.push(componentUpgradeSkip(rule, "unsupportedInV1"));
  }
  debug.budgetAfter = getJapaneseUnroundedPlanPrice(candidate, skeleton.length);
  if (!debug.reason) {
    debug.reason = debug.appliedActions.length ? "rulesApplied" : "noRuleApplied";
  }
  return debug;
}

function getExecutableComponentUpgradeRules(answers = {}) {
  return [...(answers.componentUpgradeRules || [])]
    .filter((rule) => getComponentUpgradeRuleValue(rule, "upgradeAction"))
    .sort((left, right) => Number(getComponentUpgradeRuleValue(left, "priority") || 999)
      - Number(getComponentUpgradeRuleValue(right, "priority") || 999)
      || String(getComponentUpgradeRuleValue(left, "upgradeAction"))
        .localeCompare(String(getComponentUpgradeRuleValue(right, "upgradeAction"))));
}

function createComponentUpgradeDebug(candidate, answers, skeleton, targets) {
  return {
    enabled: false,
    appliedActions: [],
    skippedActions: [],
    budgetBefore: getJapaneseUnroundedPlanPrice(candidate, skeleton.length),
    budgetAfter: getJapaneseUnroundedPlanPrice(candidate, skeleton.length),
    protectedCoreZones: getProtectedCoreZones(answers),
    reason: "",
    budgetMin: Number(targets.budgetMin || 0),
    budgetMax: Number(targets.budgetMax || 0)
  };
}

function isAddShelfAboveRailRule(rule = {}) {
  return normalizeRuleText(getComponentUpgradeRuleValue(rule, "upgradeType")) === "addabove"
    && normalizeRuleText(getComponentUpgradeRuleValue(rule, "addComponent")).includes("woodshelf")
    && normalizeRuleText(getComponentUpgradeRuleValue(rule, "addComponent")).includes("aboverail");
}

function isCoreReplacementRule(rule = {}) {
  const type = normalizeRuleText(getComponentUpgradeRuleValue(rule, "upgradeType"));
  const target = normalizeRuleText(
    getComponentUpgradeRuleValue(rule, "upgradeTarget") || getComponentUpgradeRuleValue(rule, "fromZone")
  );
  return type.includes("replace") && target.includes("hangingzone");
}

function isComponentUpgradeRuleAllowed(rule = {}, answers = {}, debug = {}, options = {}) {
  const type = normalizeRuleText(getComponentUpgradeRuleValue(rule, "upgradeType"));
  const component = normalizeRuleText(getComponentUpgradeRuleValue(rule, "addComponent"));
  if (type.includes("replace")) {
    return !isCoreHangingProtected(answers, debug)
      && Number(getComponentUpgradeRuleValue(rule, "maxCoreReplacement")
        || getComponentUpgradeRuleValue(rule, "maxReplaceRatio") || 0) > 0;
  }
  if (component.includes("cabinet")) return shouldAddStorageCabinetByDemand(answers);
  if (component.includes("jewelry")) return Number(answers.needs?.首饰 || 0) > 0;
  if (component.includes("trouser")) return Number(answers.needs?.裤子 || 0) > 0;
  if (isAddShelfAboveRailRule(rule)) return true;
  return options.mode !== "budgetTopUp";
}

function shouldAddStorageCabinetByDemand(answers = {}) {
  const needs = answers.needs || {};
  return Number(needs.包包 || 0) > 0
    || Number(needs.被褥 || 0) > 0
    || Number(needs.行李箱 || 0) > 0;
}

function isCoreHangingProtected(answers = {}, debug = {}) {
  return (debug.protectedCoreZones || getProtectedCoreZones(answers)).length > 0;
}

function getProtectedCoreZones(answers = {}) {
  const needs = answers.needs || {};
  const caseData = answers.primaryJapaneseCase || {};
  const text = [
    caseData.persona,
    caseData.primaryType,
    caseData.priorityTag,
    ...(caseData.tags || [])
  ].join(" ").toLowerCase();
  const shortHeavy = Number(needs.短衣 || 0) >= 2
    || text.includes("short")
    || text.includes("hanging")
    || text.includes("挂衣")
    || text.includes("短衣");
  const longHeavy = Number(needs.长衣 || 0) >= 2
    || text.includes("hanging")
    || text.includes("long")
    || text.includes("挂衣");
  return [
    ...(shortHeavy ? ["shortHangZone"] : []),
    ...(longHeavy ? ["longHangZone"] : [])
  ];
}

function addJapaneseShelfAboveRailUpgrade(candidate, answers, skeleton, upgradeList, rule, targets = {}) {
  const roomHeight = Math.max(
    2200,
    Number(answers.roomHeight || answers.dimensions?.height || candidate.configPreset?.roomHeight || candidate.parameters?.roomHeight || 0)
  );
  const budgetMin = Number(targets.budgetMin || 0);
  const budgetMax = Number(targets.budgetMax || Infinity);
  let added = 0;
  if (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) >= budgetMin) {
    return { added: 0, reason: "noSpace" };
  }
  const hangingBays = [...skeleton]
    .filter((entry) => ["shortHangZone", "longHangZone", "trouserZone", "storageAccessoryZone"].includes(entry.role))
    .sort((left, right) => left.bayIndex - right.bayIndex);
  for (const { bayIndex, role } of hangingBays) {
    const currentPrice = getJapaneseUnroundedPlanPrice(candidate, skeleton.length);
    if (budgetMin > 0 && currentPrice >= budgetMin && currentPrice <= budgetMax) break;
    if (currentPrice + JAPANESE_CLOSET_AI_PRICES.woodShelf > budgetMax) {
      return { added, reason: added ? "" : "budgetExceeded" };
    }
    const bayPlacements = candidate.placements.filter((item) => (
      Number(item.bayIndex) === Number(bayIndex)
      && (item.wallId || "back") === "back"
      && item.componentType
    ));
    if (JAPANESE_ONE_FUNCTIONAL_SHELF_PER_LOWER_FUNCTIONAL_ZONE
      && bayPlacements.some((item) => item.componentType === "woodShelf" && item.isPremiumHangingShelfUpgrade)) continue;
    const rails = bayPlacements
      .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
      .sort((left, right) => Number(right.heightFromFloor || 0) - Number(left.heightFromFloor || 0));
    if (!rails.length) continue;
    if (!isJapanesePremiumFunctionalShelfBayEligible(bayPlacements, role)) continue;
    const shelfCandidate = getJapanesePremiumHangingShelfCandidates(bayPlacements, role, roomHeight)
      .find((candidate) => !bayPlacements.some((item) => (
        intervalsOverlap(intervalFor(item), [
          candidate.heightFromFloor,
          candidate.heightFromFloor + COMPONENT_HEIGHTS.woodShelf
        ])
      )));
    if (!shelfCandidate) continue;
    const shelf = placement("storageZone", "woodShelf", bayIndex, shelfCandidate.heightFromFloor);
    shelf.templateRole = role;
    shelf.templateZone = role;
    shelf.source = shelfCandidate.source;
    shelf.upgradeAction = getComponentUpgradeRuleValue(rule, "upgradeAction");
    shelf.upgradeType = getComponentUpgradeRuleValue(rule, "upgradeType");
    shelf.isAboveRailUpgrade = shelfCandidate.kind === "upper";
    shelf.isPremiumHangingShelfUpgrade = true;
    shelf.premiumShelfStrategy = shelfCandidate.kind;
    shelf.associatedLowerFeature = shelfCandidate.associatedLowerFeature;
    shelf.lowerFunctionalZoneType = shelfCandidate.lowerFunctionalZoneType;
    shelf.lowerFunctionalZoneComponentType = shelfCandidate.lowerFunctionalZoneComponentType;
    candidate.placements.push(shelf);
    upgradeList.push(japaneseUpgradeDebug("woodShelf", JAPANESE_CLOSET_AI_PRICES.woodShelf, bayIndex));
    console.log("[candidate-plan-engine] premium functional shelf", {
      bayIndex,
      templateRole: role,
      railHeights: rails.map((rail) => Number(rail.heightFromFloor || 0)),
      lowerFunctionalZoneType: shelf.lowerFunctionalZoneType,
      shelfHeight: shelf.heightFromFloor,
      associatedLowerFeature: shelf.associatedLowerFeature,
      associatedWith2000Rail: false
    });
    added += 1;
  }
  return { added, reason: added ? "" : "noSpace" };
}

function getJapanesePremiumHangingShelfCandidates(bayPlacements = [], role = "", roomHeight = 2700) {
  return getJapaneseLowerFunctionalShelfCandidates(bayPlacements, role, roomHeight);
}

function getJapaneseLowerFunctionalShelfCandidates(bayPlacements = [], role = "", roomHeight = 2700) {
  const rails = bayPlacements
    .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
    .sort((left, right) => Number(left.heightFromFloor || 0) - Number(right.heightFromFloor || 0));
  const railHeights = rails.map((rail) => Number(rail.heightFromFloor || 0));
  const highRailHeight = railHeights.find((height) => (
    height >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
    && height <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
  ));
  if (!highRailHeight) return [];
  const lowerFunctionalZones = getJapaneseLowerFunctionalZones(bayPlacements);
  return lowerFunctionalZones
    .map((candidate) => ({
      ...candidate,
      shelfTop: candidate.heightFromFloor + COMPONENT_HEIGHTS.woodShelf,
      highRailHeight
    }))
    .filter((candidate) => (
      candidate.heightFromFloor > 0
      && candidate.heightFromFloor + COMPONENT_HEIGHTS.woodShelf <= roomHeight - JAPANESE_PREMIUM_SHELF_TOP_MARGIN
      && candidate.heightFromFloor + COMPONENT_HEIGHTS.woodShelf < highRailHeight
    ));
}

function getJapaneseLowerFunctionalZones(bayPlacements = []) {
  const railZones = bayPlacements
    .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
    .map((item) => ({
      placement: item,
      height: Number(item.heightFromFloor || 0)
    }))
    .filter(({ height }) => (
      height >= JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.minHeight
      && height <= JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.maxHeight
    ))
    .map(({ placement, height }) => {
      const supportTop = height + (COMPONENT_HEIGHTS[placement.componentType] || COMPONENT_HEIGHTS.singleRail) / 2;
      return {
        heightFromFloor: supportTop + JAPANESE_PREMIUM_SHELF_RAIL_GAP,
        supportTop,
        associatedLowerFeature: "lowerFunctionalZone",
        lowerFunctionalZoneType: JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.zoneType,
        lowerFunctionalZoneComponentType: placement.componentType,
        kind: "lower",
        source: "ComponentUpgradeRules:lowerFunctionalZoneStorage"
      };
    });
  const accessoryZones = bayPlacements
    .filter((item) => JAPANESE_LOWER_FUNCTIONAL_ZONE_COMPONENTS.has(item.componentType))
    .map((item) => {
      const supportTop = getJapaneseLowerFunctionalZoneSupportTop(item);
      return {
        heightFromFloor: supportTop + DENSE_SHELF_MIN_GAP,
        supportTop,
        associatedLowerFeature: "lowerFunctionalZone",
        lowerFunctionalZoneType: item.componentType,
        lowerFunctionalZoneComponentType: item.componentType,
        kind: "lower",
        source: "ComponentUpgradeRules:lowerFunctionalZoneStorage"
      };
    });
  return [...railZones, ...accessoryZones]
    .sort((left, right) => Number(left.supportTop || 0) - Number(right.supportTop || 0));
}

function getJapaneseLowerFunctionalZoneSupportTop(placement = {}) {
  const explicitHeight = Number(
    placement.actualHeight
    ?? placement.componentHeight
    ?? placement.height
    ?? placement.modelHeight
  );
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return Number(placement.heightFromFloor || 0) + explicitHeight;
  }
  if (JAPANESE_LOWER_FUNCTIONAL_STORAGE_SUPPORTS.has(placement.componentType)
    && !COMPONENT_HEIGHTS[placement.componentType]) {
    return Number(placement.heightFromFloor || 0) + JAPANESE_CABINET_MODEL_HEIGHT;
  }
  return intervalFor(placement)[1];
}

function getJapaneseUpperHangingShelfCandidates(bayPlacements = [], roomHeight = 2700) {
  const topRail = bayPlacements
    .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
    .sort((left, right) => Number(right.heightFromFloor || 0) - Number(left.heightFromFloor || 0))[0];
  if (!topRail) return [];
  const railHeight = Number(topRail.heightFromFloor || 0);
  const heightFromFloor = railHeight + JAPANESE_PREMIUM_SHELF_RAIL_GAP;
  if (heightFromFloor + COMPONENT_HEIGHTS.woodShelf > roomHeight - JAPANESE_PREMIUM_SHELF_TOP_MARGIN) {
    return [];
  }
  return [{
    heightFromFloor,
    kind: "upper",
    source: "ComponentUpgradeRules:upperRailStorage"
  }];
}

function getJapanesePremiumShelfRailClearance(role) {
  return role === "longHangZone"
    ? JAPANESE_LONG_HANG_MIN_CLEARANCE_BELOW
    : JAPANESE_SHORT_HANG_MIN_CLEARANCE_BELOW;
}

function componentUpgradeSkip(rule = {}, reason) {
  return {
    action: getComponentUpgradeRuleValue(rule, "upgradeAction") || "",
    upgradeType: getComponentUpgradeRuleValue(rule, "upgradeType") || "",
    addComponent: getComponentUpgradeRuleValue(rule, "addComponent") || "",
    priority: getComponentUpgradeRuleValue(rule, "priority"),
    protectCoreRequirement: getComponentUpgradeRuleValue(rule, "protectCoreRequirement"),
    maxCoreReplacement: getComponentUpgradeRuleValue(rule, "maxCoreReplacement"),
    maxReplaceRatio: getComponentUpgradeRuleValue(rule, "maxReplaceRatio"),
    reason
  };
}

function getComponentUpgradeRuleValue(rule = {}, field) {
  const aliases = {
    upgradeAction: ["upgradeAction", "UpgradeAction"],
    fromZone: ["fromZone", "FromZone"],
    addComponent: ["addComponent", "ToZone / AddComponent", "ToZone", "AddComponent"],
    condition: ["condition", "Condition"],
    priority: ["priority", "Priority"],
    note: ["note", "Note", "Notes"],
    upgradeType: ["upgradeType", "UpgradeType"],
    upgradeTarget: ["upgradeTarget", "UpgradeTarget"],
    protectCoreRequirement: ["protectCoreRequirement", "ProtectCoreRequirement"],
    maxCoreReplacement: ["maxCoreReplacement", "MaxCoreReplacement"],
    maxReplaceRatio: ["maxReplaceRatio", "MaxReplaceRatio"]
  };
  return (aliases[field] || [field]).map((key) => rule[key])
    .find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeRuleText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function addJapaneseShelfUpgrade(candidate, skeleton, upgradeList, quantity = 1, preferredZone = "", options = {}) {
  const allowedRoles = new Set(["shoeShelfZone", "shelfZone"]);
  const orderedBays = [...skeleton]
    .filter((entry) => allowedRoles.has(entry.role))
    .filter((entry) => !(options.skipShoeShelfZone && entry.role === "shoeShelfZone"))
    .sort((left, right) => (
      Number(left.role !== preferredZone) - Number(right.role !== preferredZone)
      || right.bayIndex - left.bayIndex
    ));
  let addedCount = 0;
  for (let attempt = 0; attempt < quantity; attempt += 1) {
    let added = false;
    for (const { bayIndex, role } of orderedBays) {
      const existingShelves = candidate.placements.filter((item) => (
        item.bayIndex === bayIndex && item.componentType === "woodShelf"
      ));
      const limit = role === "shoeShelfZone"
        ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shoeZone.maxWoodShelves
        : JAPANESE_CASE_LAYOUT_RULES.componentLimits.shelfZone.maxWoodShelves;
      if (existingShelves.length >= limit) continue;
      const heightFromFloor = getJapaneseShelfHeights(role)
        .find((height) => (
          !existingShelves.some((item) => Math.abs(item.heightFromFloor - height) < 100)
          && isJapaneseShelfUpgradeHeightAllowedForRails(
            candidate.placements,
            bayIndex,
            role,
            height,
            { planType: candidate.planType }
          )
        ));
      if (heightFromFloor == null) continue;
      const budgetMax = Number(options.budgetMax || Infinity);
      if (getJapaneseUnroundedPlanPrice(candidate, skeleton.length) + JAPANESE_CLOSET_AI_PRICES.woodShelf > budgetMax) {
        continue;
      }
      const shelf = placement(role === "shoeShelfZone" ? "shoeZone" : "storageZone", "woodShelf", bayIndex, heightFromFloor);
      shelf.templateRole = role;
      shelf.templateZone = role;
      if (candidate.placements.some((item) => item.bayIndex === bayIndex
        && intervalsOverlap(intervalFor(item), intervalFor(shelf)))) continue;
      candidate.placements.push(shelf);
      upgradeList.push(japaneseUpgradeDebug("woodShelf", 160, bayIndex));
      added = true;
      addedCount += 1;
      break;
    }
    if (!added) break;
  }
  return addedCount;
}

function isJapaneseShelfUpgradeHeightAllowedForRails(
  placements = [],
  bayIndex,
  role = "",
  heightFromFloor = 0,
  options = {}
) {
  if (options.planType !== "premium") return true;
  const bayPlacements = placements.filter((item) => Number(item.bayIndex) === Number(bayIndex));
  if (!isJapanesePremiumFunctionalShelfBayEligible(bayPlacements, role)) return false;
  const bayRails = bayPlacements
    .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
    .map((item) => Number(item.heightFromFloor || 0))
    .filter((height) => height > 0);
  const highRail = bayRails.find((height) => (
    height >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
    && height <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
  ));
  if (!highRail || heightFromFloor + COMPONENT_HEIGHTS.woodShelf >= highRail) return false;
  const lowerFunctionalZone = getJapaneseLowerFunctionalZones(bayPlacements)[0];
  if (!lowerFunctionalZone) return false;
  return heightFromFloor >= lowerFunctionalZone.heightFromFloor;
}

function isJapanesePremiumFunctionalShelfBayEligible(bayPlacements = [], role = "") {
  if (!["shortHangZone", "longHangZone", "trouserZone", "storageAccessoryZone"].includes(role)) {
    return false;
  }
  const railHeights = bayPlacements
    .filter((item) => ["singleRail", "doubleRail"].includes(item.componentType))
    .map((item) => Number(item.heightFromFloor || 0))
    .filter((height) => height > 0);
  const hasHighRail = railHeights.some((height) => (
    height >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
    && height <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
  ));
  if (!hasHighRail) return false;
  return getJapaneseLowerFunctionalZones(bayPlacements).length > 0;
}

function removeJapanesePremiumShoeShelfFunctionalShelves(candidate, skeleton = [], answers = {}) {
  if (Number(answers.needs?.鞋子 || 0) > 0) return;
  const shoeBayIndexes = new Set(skeleton
    .filter((entry) => entry.role === "shoeShelfZone")
    .map((entry) => Number(entry.bayIndex)));
  candidate.placements = candidate.placements.filter((item) => {
    if (!shoeBayIndexes.has(Number(item.bayIndex)) || item.componentType !== "woodShelf") return true;
    const bayPlacements = candidate.placements.filter((placement) => (
      Number(placement.bayIndex) === Number(item.bayIndex)
    ));
    const hasPreservedHighRail = bayPlacements.some((placement) => (
      ["singleRail", "doubleRail"].includes(placement.componentType)
      && Number(placement.heightFromFloor || 0) >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
      && Number(placement.heightFromFloor || 0) <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
    ));
    return !hasPreservedHighRail
      || Number(item.heightFromFloor || 0) < JAPANESE_SHOE_CAPACITY_PRESERVE_REMOVAL_MIN_HEIGHT;
  });
}

function ensureJapaneseShoeShelfCount(candidate, skeleton, upgradeList, targetCount, targets = {}) {
  const shoeBays = skeleton.filter((entry) => entry.role === "shoeShelfZone");
  if (!shoeBays.length) return 0;
  const currentCount = candidate.placements.filter((item) => (
    item.componentType === "woodShelf" && item.templateRole === "shoeShelfZone"
  )).length;
  return addJapaneseShelfUpgrade(
    candidate,
    skeleton,
    upgradeList,
    Math.max(0, targetCount - currentCount),
    "shoeShelfZone",
    { budgetMax: targets.budgetMax }
  );
}

function isMediumJapaneseShoeDemand(answers = {}) {
  return Number(answers.needs?.鞋子 || 0) === 2;
}

function preserveJapaneseMediumShoeUpperRails(candidate, answers, skeleton = []) {
  if (!isMediumJapaneseShoeDemand(answers)) return false;
  let added = false;
  skeleton
    .filter((entry) => entry.role === "shoeShelfZone")
    .forEach((entry) => {
      const bayIndex = Number(entry.bayIndex);
      const bayPlacements = candidate.placements.filter((item) => Number(item.bayIndex) === bayIndex);
      const upperRailPlacement = bayPlacements.find((item) => (
        ["singleRail", "doubleRail"].includes(item.componentType)
        && Number(item.heightFromFloor || 0) >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
        && Number(item.heightFromFloor || 0) <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
      ));
      if (upperRailPlacement) {
        upperRailPlacement.heightFromFloor = JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT + 30;
        added = true;
        return;
      }
      const upperRail = placement("shortHangZone", "singleRail", bayIndex, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT + 30);
      upperRail.templateRole = entry.role;
      upperRail.templateZone = entry.role;
      upperRail.sourceRole = entry.sourceRole;
      upperRail.isBaseRail = true;
      candidate.placements.push(upperRail);
      added = true;
    });
  return added;
}

function ensureJapaneseDedicatedShelfCount(candidate, skeleton, upgradeList, targetCount) {
  const shelfBays = skeleton.filter((entry) => entry.role === "shelfZone");
  if (!shelfBays.length) return 0;
  const shelfBayIndexes = new Set(shelfBays.map((entry) => entry.bayIndex));
  candidate.placements = candidate.placements.filter((item) => !(
    shelfBayIndexes.has(item.bayIndex)
    && ["singleRail", "doubleRail"].includes(item.componentType)
  ));
  const currentCount = candidate.placements.filter((item) => (
    item.componentType === "woodShelf" && shelfBayIndexes.has(item.bayIndex)
  )).length;
  return addJapaneseShelfUpgrade(
    candidate,
    skeleton,
    upgradeList,
    Math.max(0, targetCount - currentCount),
    "shelfZone"
  );
}

function getJapaneseShelfHeights(role) {
  return role === "shoeShelfZone"
    ? [250, 470, 690, 910, 1130, 1350, 1570]
    : [300, 700, 1100, 1500, 1900];
}

function replaceJapaneseBaseRailWithDouble(candidate, skeleton, upgradeList) {
  const replacementTargets = skeleton
    .map((entry) => ({
      bayIndex: entry.bayIndex,
      role: entry.role,
      intendedTargetHeight: getJapaneseDoubleRailIntendedTargetHeight(entry.role),
      targetReason: getJapaneseDoubleRailTargetReason(entry.role)
    }))
    .filter((entry) => entry.intendedTargetHeight != null)
    .sort((left, right) => left.bayIndex - right.bayIndex);
  const target = replacementTargets.find((entry) => candidate.placements.some((item) => (
    item.componentType === "singleRail"
    && item.isBaseRail
    && Number(item.bayIndex) === Number(entry.bayIndex)
    && Math.abs(Number(item.heightFromFloor || 0) - entry.intendedTargetHeight) < 1
  )));
  if (!target) return false;
  const replacement = candidate.placements.find((item) => (
    item.componentType === "singleRail"
    && item.isBaseRail
    && Number(item.bayIndex) === Number(target.bayIndex)
    && Math.abs(Number(item.heightFromFloor || 0) - target.intendedTargetHeight) < 1
  ));
  if (!replacement) return false;
  const actualTargetHeight = Number(replacement.heightFromFloor || 0);
  replacement.componentType = "doubleRail";
  replacement.isBaseRail = false;
  replacement.isBaseRailReplacement = true;
  replacement.intendedTargetHeight = target.intendedTargetHeight;
  replacement.actualTargetHeight = actualTargetHeight;
  replacement.targetReason = target.targetReason;
  replacement.wasTargetRedirected = actualTargetHeight !== target.intendedTargetHeight;
  upgradeList.push({
    ...japaneseUpgradeDebug("doubleRailReplacement", 50, replacement.bayIndex),
    intendedTargetHeight: target.intendedTargetHeight,
    actualTargetHeight,
    targetReason: target.targetReason,
    wasTargetRedirected: replacement.wasTargetRedirected
  });
  console.log("[candidate-plan-engine] doubleRail upgrade target", {
    bayIndex: replacement.bayIndex,
    intendedTargetHeight: target.intendedTargetHeight,
    actualTargetHeight,
    targetReason: target.targetReason,
    wasTargetRedirected: replacement.wasTargetRedirected
  });
  return true;
}

function getJapaneseDoubleRailIntendedTargetHeight(role = "") {
  if (["shortHangZone", "trouserZone"].includes(role)) return 1050;
  if (role === "longHangZone") return JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT;
  return null;
}

function getJapaneseDoubleRailTargetReason(role = "") {
  if (role === "shortHangZone") return JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.zoneType;
  if (role === "trouserZone") return "trouserZoneLowerRail";
  if (role === "longHangZone") return "longHangHighRail";
  return "";
}

function countJapaneseUpgradePoints(upgradeList = []) {
  const shelfCount = upgradeList.filter((item) => item.componentType === "woodShelf").length;
  return upgradeList.filter((item) => [
    "cabinet", "trouserRack", "jewelryBox", "drawerSingle", "drawerDouble", "doubleRailReplacement"
  ].includes(item.componentType)).length + Math.floor(shelfCount / 2);
}

function japaneseUpgradeDebug(componentType, price, bayIndex = null) {
  return { componentType, price, ...(bayIndex == null ? {} : { bayIndex }) };
}

function getJapaneseUnroundedPlanPrice(candidate, bayCount) {
  return calculateJapaneseClosetPrice(candidate.placements, bayCount, candidate.planType).manualComponentPrice;
}

function addJapaneseSkeletonUpgrade(
  candidate,
  componentType,
  skeleton,
  answers,
  usedBays,
  allowUsedBay = false
) {
  const preferredRoles = componentType === "cabinet"
    ? new Set(["storageAccessoryZone", "jewelryZone"])
    : componentType === "trouserRack"
      ? new Set(["trouserZone", "shortHangZone", "storageAccessoryZone", "jewelryZone"])
      : new Set(["storageAccessoryZone", "jewelryZone", "trouserZone", "shortHangZone"]);
  const functionalBays = skeleton.filter((item) => ![
    "longHangZone", "shoeShelfZone", "luggageZone", "shelfZone"
  ].includes(item.role));
  const isFixedAccessory = isFixedWidthAccessory(componentType);
  if (isFixedAccessory) {
    applyJapanesePlacementDimensions(candidate, answers);
  }
  const existingOrder = [...functionalBays].sort((left, right) => (
    Number(!preferredRoles.has(left.role)) - Number(!preferredRoles.has(right.role))
    || Number(usedBays.has(left.bayIndex)) - Number(usedBays.has(right.bayIndex))
    || left.bayIndex - right.bayIndex
  ));
  const beforeOrder = isFixedAccessory
    ? withJapaneseAccessoryBayWidths(existingOrder, answers.roomWidth, skeleton.length, candidate.placements)
    : existingOrder;
  const ordered = isFixedAccessory
    ? selectJapanesePreferredAccessoryBays(
      beforeOrder,
      componentType,
      answers.roomWidth,
      skeleton.length,
      candidate.placements,
      "addJapaneseSkeletonUpgrade"
    )
    : existingOrder;
  const afterOrder = isFixedAccessory
    ? withJapaneseAccessoryBayWidths(ordered, answers.roomWidth, skeleton.length, candidate.placements)
    : ordered;
  const skippedBays = [];
  for (const bay of ordered) {
    const bayIndex = getJapaneseAccessoryCandidateBayIndex(bay);
    const role = bay.role;
    if (!allowUsedBay && usedBays.has(bayIndex)) {
      skippedBays.push({
        bayIndex,
        role,
        reason: "occupied"
      });
      continue;
    }
    const preservedFunctionalShelves = componentType === "trouserRack"
      ? getJapaneseTrouserRackPreservedFunctionalShelves(candidate.placements, bayIndex)
      : [];
    const removedLowRails = componentType === "trouserRack"
      ? removeJapaneseLowRailsForTrouser(candidate.placements, bayIndex)
      : [];
    const componentIndex = 0;
    let added = addJapaneseTemplateComponent(
      candidate.placements,
      componentType,
      role,
      bayIndex,
      componentIndex,
      answers,
      skeleton.length,
      isFixedAccessory ? { preferredWidth: getJapaneseAccessoryModuleWidthForBay(bay) } : {}
    );
    if (!added && componentType !== "trouserRack") {
      const removableShelf = candidate.placements.findIndex((item) => (
        item.bayIndex === bayIndex
        && item.componentType === "woodShelf"
        && item.zoneType !== "shoeZone"
      ));
      if (removableShelf >= 0) {
        candidate.placements.splice(removableShelf, 1);
        added = addJapaneseTemplateComponent(
          candidate.placements,
          componentType,
          role,
          bayIndex,
          componentIndex,
          answers,
          skeleton.length,
          isFixedAccessory ? { preferredWidth: getJapaneseAccessoryModuleWidthForBay(bay) } : {}
        );
      }
    }
    if (!added) {
      candidate.placements.push(...removedLowRails);
      skippedBays.push({
        bayIndex,
        role,
        reason: "noEligiblePlacement"
      });
      continue;
    }
    if (componentType === "trouserRack") {
      restoreJapaneseTrouserRackFunctionalShelves(candidate.placements, preservedFunctionalShelves);
    }
    usedBays.add(bayIndex);
    if (isFixedAccessory) {
      logJapaneseSkeletonUpgradePlacementStrategyDebug({
        candidate,
        componentType,
        beforeOrder,
        afterOrder,
        selectedBayIndex: bayIndex,
        skippedBays,
        reason: "selectedByPlacementStrategy"
      });
    }
    return true;
  }
  if (isFixedAccessory) {
    logJapaneseSkeletonUpgradePlacementStrategyDebug({
      candidate,
      componentType,
      beforeOrder,
      afterOrder,
      selectedBayIndex: null,
      skippedBays,
      reason: "noCandidate"
    });
  }
  if (componentType === "trouserRack") {
    candidate.trouserRackPlacementBlocked = true;
  }
  return false;
}

function getJapaneseTrouserRackPreservedFunctionalShelves(placements, bayIndex) {
  return placements.filter((item) => (
    Number(item.bayIndex) === Number(bayIndex)
    && item.componentType === "woodShelf"
    && item.zoneType !== "shoeZone"
    && Number(item.heightFromFloor || 0) >= 1150
    && Number(item.heightFromFloor || 0) <= 1250
  )).map((item) => ({ ...item }));
}

function restoreJapaneseTrouserRackFunctionalShelves(placements, preservedShelves = []) {
  preservedShelves.forEach((shelf) => {
    const exists = placements.some((item) => (
      Number(item.bayIndex) === Number(shelf.bayIndex)
      && item.componentType === "woodShelf"
      && item.zoneType === shelf.zoneType
      && Math.abs(Number(item.heightFromFloor || 0) - Number(shelf.heightFromFloor || 0)) < 1
    ));
    if (!exists) placements.push({ ...shelf });
  });
}

function removeJapaneseLowRailsForTrouser(placements, bayIndex) {
  const removed = placements.filter((item) => (
    Number(item.bayIndex) === Number(bayIndex)
    && ["singleRail", "doubleRail"].includes(item.componentType)
    && Number(item.heightFromFloor) < 1450
  ));
  removed.forEach((item) => removePlacement(placements, item));
  return removed;
}

function finalizeJapaneseSkeletonCandidate(candidate, answers, planType) {
  candidate.autoSupplementalRailDebug = addJapaneseDemandDrivenShortRails(candidate, answers);
  repairJapaneseCaseLayout(candidate);
  applyJapanesePlacementDimensions(candidate, answers);
  finalizeDerivedCandidate(candidate, candidate, answers, planType, 1, 0);
  candidate.bayPlan = buildJapaneseBayPlan(candidate.placements, candidate.parameters?.bayCount);
  candidate.templateViolationCount = countJapaneseTemplateViolations(
    candidate.placements,
    candidate.parameters?.bayCount
  );
  candidate.componentCountByType = countBy(
    candidate.placements.filter((item) => item.componentType),
    (item) => item.componentType
  );
  candidate.caseLayoutTemplate = answers.primaryJapaneseCase?.layoutTemplate || [];
  candidate.resolvedSkeleton = (candidate.skeleton || []).map((item) => ({ ...item }));
  candidate.forbiddenPatternViolations = getJapaneseCaseForbiddenPatternViolations(candidate);
  candidate.japanesePlacementValidationDebug = getJapanesePlacementValidationDiagnostics(candidate.placements);
  candidate.tierUpgradeRulesApplied = {
    ...(JAPANESE_CASE_LAYOUT_RULES.tierUpgradeRules[planType] || {})
  };
  candidate.bayRoleComponents = buildJapaneseBayRoleComponents(candidate);
}

function applyJapanesePlacementDimensions(candidate, answers = {}) {
  if (candidate?.configPreset?.productSystemId !== "japanese-closet"
    && getSelectedSeriesId(answers) !== "japanese-closet") return;
  const cuttingRules = getCuttingRules("japanese-closet");
  if (!cuttingRules) return;
  const wallMetrics = getJapaneseCandidateWallMetrics(candidate, answers, cuttingRules);
  (candidate.placements || []).forEach((placement) => {
    if (!placement?.componentType) return;
    const wallId = placement.wallId || "back";
    const metrics = wallMetrics[wallId] || wallMetrics.back;
    if (!metrics) return;
    const moduleWidth = getJapanesePlacementModuleWidth(placement, metrics.innerBayWidth, cuttingRules);
    const componentCutLength = cuttingRules.getCutLength?.(
      placement.componentType,
      metrics.innerBayWidth
    );
    const visualScaleWidth = isFixedWidthAccessory(placement.componentType)
      ? metrics.innerBayWidth
      : cuttingRules.getVisualScaleWidth?.(
        placement.componentType,
        metrics.innerBayWidth,
        componentCutLength,
        moduleWidth
      );
    Object.assign(placement, {
      postProfileWidth: metrics.postProfileWidth,
      rawBayWidth: metrics.rawBayWidth,
      postCenterDistance: metrics.postCenterDistance,
      innerBayWidth: metrics.innerBayWidth,
      usableComponentWidth: metrics.innerBayWidth,
      ...(Number.isFinite(Number(componentCutLength))
        ? {
          componentCutLength: Number(componentCutLength),
          cutLength: Number(componentCutLength)
        }
        : {}),
      ...(Number.isFinite(Number(visualScaleWidth))
        ? { visualScaleWidth: Number(visualScaleWidth) }
        : {}),
      widthSource: "japaneseCuttingRules"
    });
  });
}

function getJapaneseCandidateWallMetrics(candidate, answers, cuttingRules) {
  const roomWidth = Number(candidate?.configPreset?.roomWidth ?? answers.roomWidth) || 0;
  const roomDepth = Number(candidate?.configPreset?.roomDepth ?? answers.roomDepth) || 0;
  const wallLayout = candidate?.configPreset?.japaneseWallLayout
    || getJapaneseOptimizedWallLayout(answers, candidate?.parameters?.bayCount || candidate?.configPreset?.bayCount || 1);
  const backBayCount = Math.max(1, Number(wallLayout.back?.bayCount
    || candidate?.parameters?.bayCount || candidate?.configPreset?.bayCount) || 1);
  const sideBayCount = Math.max(1, Number(wallLayout.left?.bayCount)
    || Math.ceil(roomDepth / Math.max(1, cuttingRules.maxPostSpanMm || roomDepth || 1)));
  const createMetrics = (length, bayCount) => {
    const postProfileWidth = Number(cuttingRules.postProfileWidthMm) || 0;
    const rawBayWidth = Number(length) / Math.max(1, Number(bayCount) || 1);
    const innerBayWidth = Number(cuttingRules.getInnerBayWidth?.(length, bayCount)) || 0;
    return {
      postProfileWidth,
      rawBayWidth,
      postCenterDistance: rawBayWidth,
      innerBayWidth
    };
  };
  return {
    back: createMetrics(roomWidth, backBayCount),
    left: createMetrics(roomDepth, sideBayCount),
    right: createMetrics(roomDepth, sideBayCount)
  };
}

function getJapanesePlacementModuleWidth(placement, innerBayWidth, cuttingRules) {
  if (isFixedWidthAccessory(placement.componentType)) return null;
  const explicit = Number(placement.moduleWidth ?? placement.preferredWidth ?? placement.standardWidth);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (!cuttingRules.fixedModuleTypes?.includes(placement.componentType)) return null;
  return (cuttingRules.fixedModuleWidths || [])
    .find((width) => Number(width) >= Number(innerBayWidth))
    || (cuttingRules.fixedModuleWidths || [])[0]
    || null;
}

function repairJapaneseCaseLayout(candidate) {
  const placements = candidate.placements || [];
  alignJapaneseJewelryBoxWithCabinet(placements);
  const roleByBay = new Map((candidate.skeleton || []).map((entry) => [entry.bayIndex, entry.role]));
  roleByBay.forEach((role, bayIndex) => {
    let items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
    items.filter((item) => item.componentType === "cabinet")
      .forEach((item) => { item.heightFromFloor = 0; });
    normalizeJapaneseAccessoryPlacementsInBay(placements, bayIndex);
    if (role === "longHangZone") {
      items.filter((item) => !["singleRail", "doubleRail"].includes(item.componentType)
        && !item.isAboveRailUpgrade)
        .forEach((item) => removePlacement(placements, item));
    }
    if (role === "shoeShelfZone") {
      items.filter((item) => ["cabinet", "trouserRack", "jewelryBox"].includes(item.componentType))
        .forEach((item) => removePlacement(placements, item));
    }
    items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
    trimJapaneseComponents(items, placements, ["cabinet"], 1);
    trimJapaneseComponents(items, placements, ["trouserRack", "jewelryBox"], 1);
    const railLimit = getJapaneseRailLimit(role, items);
    trimJapaneseComponents(items, placements, ["singleRail", "doubleRail"], railLimit);
    const shelfLimit = role === "shoeShelfZone"
      ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shoeZone.maxWoodShelves
      : role === "shelfZone"
        ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shelfZone.maxWoodShelves
        : JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxWoodShelves;
    trimJapaneseComponents(items, placements, ["woodShelf"], shelfLimit);
    items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
    const railCount = items.filter((item) => ["singleRail", "doubleRail"].includes(item.componentType)).length;
    const ordinaryShelves = items.filter((item) => item.componentType === "woodShelf"
      && role !== "shoeShelfZone");
    if (railCount && ordinaryShelves.length >= 3) {
      ordinaryShelves.slice(2).forEach((item) => removePlacement(placements, item));
    }
    items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
    if (role !== "shoeShelfZone"
      && items.length > JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxFunctionalComponents) {
      items.filter((item) => item.componentType === "woodShelf")
        .slice(0, items.length - JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxFunctionalComponents)
        .forEach((item) => removePlacement(placements, item));
    }
    if (!placements.some((item) => item.bayIndex === bayIndex && item.componentType)) {
      const fallback = role === "shoeShelfZone"
        ? placement("shoeZone", "woodShelf", bayIndex, 250)
        : role === "shelfZone"
          ? placement("storageZone", "woodShelf", bayIndex, 700)
          : placement(
            role === "longHangZone" ? "longHangZone" : "shortHangZone",
            "singleRail",
            bayIndex,
            JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT
          );
      fallback.templateRole = role;
      fallback.templateZone = role;
      placements.push(fallback);
    }
  });
}

function alignJapaneseJewelryBoxWithCabinet(placements = []) {
  const jewelryBox = placements.find((item) => item.componentType === "jewelryBox");
  const cabinet = placements.find((item) => item.componentType === "cabinet");
  if (!jewelryBox || !cabinet) return;
  const cabinetBayHasTrouserRack = placements.some((item) => (
    item.componentType === "trouserRack"
    && (item.wallId || "back") === (cabinet.wallId || "back")
    && Number(item.bayIndex) === Number(cabinet.bayIndex)
  ));
  if (cabinetBayHasTrouserRack) return;
  jewelryBox.wallId = cabinet.wallId || "back";
  jewelryBox.bayIndex = Number(cabinet.bayIndex) || 0;
  jewelryBox.heightFromFloor = getJapaneseCabinetTopForJewelry(cabinet)
    + JAPANESE_JEWELRY_BOX_GAP_ABOVE_CABINET;
  jewelryBox.templateRole = cabinet.templateRole || "storageAccessoryZone";
  jewelryBox.templateZone = cabinet.templateZone || "storageAccessoryZone";
  jewelryBox.allowCabinetContact = true;
}

function addJapaneseDemandDrivenShortRails(candidate, answers) {
  const placements = candidate.placements || [];
  const shortClothesDemand = getJapaneseShortClothesDemand(answers);
  const currentShortRails = placements.filter(isJapaneseShortHangRail);
  const requiredShortHangCapacity = shortClothesDemand;
  const currentShortHangCapacity = currentShortRails.length * JAPANESE_SHORT_HANG_CAPACITY_PER_RAIL;
  const requiredAdditionalRails = Math.max(
    0,
    Math.ceil((requiredShortHangCapacity - currentShortHangCapacity)
      / JAPANESE_SHORT_HANG_CAPACITY_PER_RAIL)
  );
  const debug = {
    unusedVerticalSpace: [],
    supplementalRailCandidateBays: [],
    shouldAddSupplementalRail: requiredAdditionalRails > 0,
    currentShortHangCapacity,
    requiredShortHangCapacity,
    addedRailCount: 0,
    addedRealRailCount: 0,
    addedRailType: "singleRail",
    addedRailHeight: [],
    addedRailBayIndex: [],
    verticalEfficiencyBefore: calculateJapaneseShortHangEfficiency(
      currentShortHangCapacity,
      requiredShortHangCapacity
    ),
    verticalEfficiencyAfter: calculateJapaneseShortHangEfficiency(
      currentShortHangCapacity,
      requiredShortHangCapacity
    ),
    blockedReasons: [],
    addedRailDebug: [],
    supplementalRailSkippedReason: []
  };
  if (!requiredAdditionalRails) return debug;

  const skeleton = candidate.skeleton || [];
  for (const entry of skeleton) {
    if (debug.addedRailCount >= requiredAdditionalRails) break;
    const role = entry.role;
    const bayIndex = Number(entry.bayIndex) || 0;
    if (!JAPANESE_SUPPLEMENTAL_RAIL_ALLOWED_ROLES.has(role)) continue;
    debug.supplementalRailCandidateBays.push({ bayIndex, role });
    const bayPlacements = placements.filter((item) => (
      Number(item.bayIndex) === bayIndex
      && (item.wallId || "back") === "back"
      && item.componentType
    ));
    const rails = bayPlacements.filter((item) => ["singleRail", "doubleRail"].includes(item.componentType));
    if (rails.length >= 2 || rails.some((item) => item.componentType === "doubleRail")) {
      debug.blockedReasons.push({ bayIndex, reason: "doubleHangZone" });
      continue;
    }
    const supportItems = bayPlacements.filter((item) => (
      JAPANESE_SUPPLEMENTAL_RAIL_SUPPORT_COMPONENTS.has(item.componentType)
    ));
    if (!supportItems.length) {
      debug.blockedReasons.push({ bayIndex, reason: "missingFunctionalComponent" });
      continue;
    }
    const supportTop = Math.max(...supportItems.map((item) => intervalFor(item)[1]));
    const upperLimit = rails.length
      ? Math.min(...rails.map((item) => intervalFor(item)[0]))
      : JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT;
    const unusedVerticalSpace = upperLimit - supportTop;
    debug.unusedVerticalSpace.push({ bayIndex, role, supportTop, upperLimit, unusedVerticalSpace });
    if (unusedVerticalSpace < JAPANESE_SHORT_HANG_MIN_CLEARANCE_BELOW) {
      debug.blockedReasons.push({ bayIndex, reason: "insufficientVerticalSpace", unusedVerticalSpace });
      continue;
    }
    const blockingComponentTop = supportTop;
    const heightCandidates = getJapaneseSupplementalRailHeightCandidates(role)
      .filter((height) => JAPANESE_STANDARD_SUPPLEMENTAL_RAIL_HEIGHTS.includes(height));
    const heightFromFloor = heightCandidates.find((height) => (
      height > blockingComponentTop + JAPANESE_TROUSER_RACK_MIN_CLEARANCE_BELOW
      && (JAPANESE_STANDARD_SUPPLEMENTAL_RAIL_HEIGHTS.includes(height)
        ? height <= upperLimit
        : height < upperLimit - 120)
    ));
    if (!heightFromFloor) {
      debug.blockedReasons.push({
        bayIndex,
        reason: "noValidRailHeight",
        blockingComponentTop,
        upperLimit,
        heightCandidates
      });
      continue;
    }
    if (![1050, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT].includes(heightFromFloor)) {
      debug.blockedReasons.push({
        bayIndex,
        reason: "nonStandardRailHeightBlocked",
        heightFromFloor,
        heightCandidates
      });
      continue;
    }
    const supplementalRail = placement("shortHangZone", "singleRail", bayIndex, heightFromFloor);
    supplementalRail.templateRole = role;
    supplementalRail.templateZone = role;
    supplementalRail.isAutoSupplementalShortRail = true;
    supplementalRail.source = "shortClothesDemand";
    const withRail = [...placements, supplementalRail];
    if (bayPlacements.some((item) => intervalsOverlap(intervalFor(item), intervalFor(supplementalRail)))) {
      debug.blockedReasons.push({ bayIndex, reason: "componentCollision", heightFromFloor, blockingComponentTop });
      continue;
    }
    if (getJapanesePlacementValidationDiagnostics(withRail).some((item) => !item.isValidPlacement)) {
      debug.blockedReasons.push({ bayIndex, reason: "accessoryClearanceBlocked", heightFromFloor, blockingComponentTop });
      continue;
    }
    placements.push(supplementalRail);
    debug.addedRailCount += 1;
    debug.addedRealRailCount += 1;
    debug.addedRailHeight.push(heightFromFloor);
    debug.addedRailBayIndex.push(bayIndex);
    debug.addedRailDebug.push({
      bayIndex,
      blockingComponentTop,
      heightFromFloor,
      availableVerticalSpace: unusedVerticalSpace
    });
  }
  debug.verticalEfficiencyAfter = calculateJapaneseShortHangEfficiency(
    currentShortHangCapacity + debug.addedRailCount * JAPANESE_SHORT_HANG_CAPACITY_PER_RAIL,
    requiredShortHangCapacity
  );
  debug.supplementalRailSkippedReason = debug.blockedReasons.map((item) => item.reason);
  return debug;
}

function getJapaneseSupplementalRailHeightCandidates(role) {
  if (role === "longHangZone") return [JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT];
  if (role === "shortHangZone") return [1050, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT];
  return [JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, 1050];
}

function getJapaneseShortClothesDemand(answers = {}) {
  const quantity = Number(answers.demandQuantityProfile?.短衣?.quantity);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;
  const weight = Number(answers.needs?.短衣) || 0;
  const peopleCount = Number(String(answers.peopleCount || "1").match(/\d+/)?.[0]) || 1;
  return weight * JAPANESE_SHORT_HANG_CAPACITY_PER_RAIL * peopleCount;
}

function isJapaneseShortHangRail(item) {
  if (!["singleRail", "doubleRail"].includes(item.componentType)) return false;
  if (item.zoneType === "longHangZone" || item.templateRole === "longHangZone") return false;
  return Number(item.heightFromFloor) < 1450 || item.zoneType === "shortHangZone";
}

function calculateJapaneseShortHangEfficiency(capacity, demand) {
  if (!demand) return 1;
  return Math.min(1, Math.max(0, Number(capacity) || 0) / demand);
}

function getJapaneseRailLimit(role, items = []) {
  if (role === "longHangZone") return 1;
  if (role === "shoeShelfZone") {
    return items.some((item) => item.isAutoSupplementalShortRail) ? 2 : 1;
  }
  return 2;
}

function trimJapaneseComponents(items, placements, componentTypes, limit) {
  items.filter((item) => componentTypes.includes(item.componentType)).slice(limit)
    .forEach((item) => removePlacement(placements, item));
}

function removePlacement(placements, placementToRemove) {
  const index = placements.indexOf(placementToRemove);
  if (index >= 0) placements.splice(index, 1);
}

function getJapaneseCaseForbiddenPatternViolations(candidate) {
  const placements = candidate?.placements || [];
  const bayCount = Math.max(1, Number(candidate?.parameters?.bayCount
    || candidate?.configPreset?.bayCount || 1));
  const skeletonRoles = new Map((candidate?.skeleton || candidate?.resolvedSkeleton || [])
    .map((entry) => [entry.bayIndex, entry.role || entry.zone]));
  const violations = [];
  for (let bayIndex = 0; bayIndex < bayCount; bayIndex += 1) {
    const items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
    const role = skeletonRoles.get(bayIndex) || inferJapaneseBayRole(items);
    const rails = items.filter((item) => ["singleRail", "doubleRail"].includes(item.componentType));
    const shelves = items.filter((item) => item.componentType === "woodShelf");
    const cabinets = items.filter((item) => item.componentType === "cabinet");
    const accessories = items.filter((item) => ["trouserRack", "jewelryBox"].includes(item.componentType));
    const addViolation = (id, details = {}) => violations.push({ id, bayIndex, role, ...details });
    if (!items.length) addViolation("emptyFunctionalBay");
    if (role !== "shoeShelfZone" && rails.length && shelves.length >= 3) {
      addViolation("ordinaryDenseShelfUnderRail", { railCount: rails.length, shelfCount: shelves.length });
    }
    if (role === "longHangZone") {
      const blockers = items.filter((item) => !["singleRail", "doubleRail"].includes(item.componentType)
        && !item.isAboveRailUpgrade);
      if (rails.length !== 1 || blockers.length
        || Number(rails[0]?.heightFromFloor || 0) < JAPANESE_CASE_LAYOUT_RULES.componentLimits.longHangZone.minClearHeight) {
        addViolation("longHangClearanceBlocked");
      }
    }
    if (cabinets.some((item) => Number(item.heightFromFloor || 0) > 300)) addViolation("floatingCabinet");
    if (cabinets.length > 1) addViolation("multipleCabinetsInBay", { count: cabinets.length });
    if (accessories.length > 1) addViolation("multipleAccessoryModulesInBay", { count: accessories.length });
    if (accessories.length && role === "shoeShelfZone" && shelves.length >= 3) {
      addViolation("accessoryMixedWithDenseShoes");
    }
    getJapanesePlacementValidationDiagnostics(items).filter((item) => !item.isValidPlacement)
      .forEach((item) => addViolation(item.invalidReason, {
        componentType: item.componentType,
        heightFromFloor: item.heightFromFloor,
        clearanceBelow: item.clearanceBelow,
        blockingComponentsBelow: item.blockingComponentsBelow
      }));
    const railLimit = getJapaneseRailLimit(role, items);
    if (rails.length > railLimit) addViolation("tooManyRailsInNormalBay", { count: rails.length });
    const shelfLimit = role === "shoeShelfZone"
      ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shoeZone.maxWoodShelves
      : role === "shelfZone"
        ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shelfZone.maxWoodShelves
        : JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxWoodShelves;
    if (shelves.length > shelfLimit) addViolation("tooManyShelvesInBay", { count: shelves.length });
    if (role !== "shoeShelfZone"
      && items.length > JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxFunctionalComponents) {
      addViolation("tooManyFunctionalComponents", { count: items.length });
    }
    if (role === "luggageZone" && !rails.length) addViolation("luggageZoneMissingUpperRail");
  }
  placements.filter((item) => item.isLinkedRailShelf && item.countsAsStorageCapacity !== false)
    .forEach((item) => violations.push({
      id: "linkedShelfDoubleCountedAsCapacity",
      bayIndex: item.bayIndex,
      role: item.templateRole || item.templateZone || ""
    }));
  return violations;
}

function inferJapaneseBayRole(items) {
  const explicitRole = items.find((item) => item.templateRole || item.templateZone);
  if (explicitRole) return normalizeJapaneseTemplateRole(explicitRole.templateRole || explicitRole.templateZone);
  if (items.some((item) => item.zoneType === "shoeZone")) return "shoeShelfZone";
  if (items.some((item) => item.zoneType === "longHangZone")) return "longHangZone";
  if (items.some((item) => item.zoneType === "shortHangZone")) return "shortHangZone";
  if (items.some((item) => item.zoneType === "luggageZone")) return "luggageZone";
  return "storageAccessoryZone";
}

function buildJapaneseBayRoleComponents(candidate) {
  return (candidate.skeleton || []).map((entry) => ({
    bayIndex: entry.bayIndex,
    role: entry.role,
    components: (candidate.placements || [])
      .filter((item) => item.bayIndex === entry.bayIndex && item.componentType)
      .map((item) => ({
        componentType: item.componentType,
        zoneType: item.zoneType,
        heightFromFloor: item.heightFromFloor
      }))
  }));
}

function attachJapaneseTierDifferenceDebug(selected, skeleton, fallback) {
  const [basic, value, premium] = selected;
  const basicSignature = stableObjectSignature(basic.componentCountByType);
  const valueSignature = stableObjectSignature(value.componentCountByType);
  const premiumSignature = stableObjectSignature(premium.componentCountByType);
  const basicVsValueDifferent = basicSignature !== valueSignature;
  const valueVsPremiumDifferent = valueSignature !== premiumSignature;
  const basicToValue = countJapaneseUpgradePoints(value.valueUpgradeList);
  const valueToPremium = countJapaneseUpgradePoints(premium.premiumUpgradeList);
  selected.forEach((candidate) => {
    candidate.skeleton = skeleton.map((item) => ({ ...item }));
    candidate.baseBayPrice = basic.baseBayPrice;
    candidate.basePlanPrice = basic.basePlanPrice;
    candidate.basicUpgradeList = [...(basic.basicUpgradeList || [])];
    candidate.valueUpgradeList = [...(value.valueUpgradeList || [])];
    candidate.premiumUpgradeList = [...(premium.premiumUpgradeList || [])];
    candidate.basicPriceBreakdown = { ...(basic.priceBreakdown || {}) };
    candidate.valuePriceBreakdown = { ...(value.priceBreakdown || {}) };
    candidate.premiumPriceBreakdown = { ...(premium.priceBreakdown || {}) };
    candidate.caseUsedForLayoutOnly = false;
    candidate.caseLibraryAppliedAs = "strictCaseLayoutRules";
    candidate.caseLayoutTemplate = candidate.layoutTemplate || [];
    candidate.resolvedSkeleton = skeleton.map((item) => ({ ...item }));
    candidate.forbiddenPatternViolations = getJapaneseCaseForbiddenPatternViolations(candidate);
    candidate.tierUpgradeRulesApplied = {
      ...(JAPANESE_CASE_LAYOUT_RULES.tierUpgradeRules[candidate.planType] || {})
    };
    candidate.bayRoleComponents = buildJapaneseBayRoleComponents(candidate);
    candidate.basicComponents = { ...basic.componentCountByType };
    candidate.valueComponents = { ...value.componentCountByType };
    candidate.premiumComponents = { ...premium.componentCountByType };
    candidate.basicVsValueDifferent = basicVsValueDifferent;
    candidate.valueVsPremiumDifferent = valueVsPremiumDifferent;
    candidate.visibleUpgradeCountBasicToValue = basicToValue;
    candidate.visibleUpgradeCountValueToPremium = valueToPremium;
    candidate.fallbackUsed = Boolean(fallback.fallbackUsed);
    candidate.fallbackReason = fallback.fallbackReason;
  });
}

function reselectJapanesePremiumAboveValue(candidate, premiumCandidates, valueCandidate) {
  if (!candidate || !valueCandidate) return candidate;
  const valuePrice = getCandidateRealPrice(valueCandidate);
  if (getCandidateRealPrice(candidate) > valuePrice) return candidate;
  const higherCandidate = [...premiumCandidates]
    .filter((option) => getCandidateRealPrice(option) > valuePrice)
    .sort((left, right) => (
      Number(right.scores?.caseMatchBonus || 0) - Number(left.scores?.caseMatchBonus || 0)
      || getCandidateRealPrice(left) - getCandidateRealPrice(right)
    ))[0] || null;
  if (higherCandidate) {
    higherCandidate.priceOrderFixReason = "reselectedHigherRealPremiumCandidate";
    return higherCandidate;
  }
  const highestCandidate = [candidate, ...premiumCandidates]
    .sort((left, right) => getCandidateRealPrice(right) - getCandidateRealPrice(left))[0] || candidate;
  highestCandidate.premiumCouldNotExceedValue = true;
  highestCandidate.priceOrderFixReason = "noHigherRealPremiumCandidateBeforeDerivation";
  return highestCandidate;
}

function attachJapanesePriceOrderDebug(selected) {
  const [basic, value, premium] = selected;
  const basicPrice = getCandidateRealPrice(basic);
  const valuePrice = getCandidateRealPrice(value);
  const premiumPrice = getCandidateRealPrice(premium);
  const priceOrderValid = basicPrice < valuePrice && valuePrice < premiumPrice;
  selected.filter(Boolean).forEach((candidate) => {
    candidate.basicPrice = basicPrice;
    candidate.valuePrice = valuePrice;
    candidate.premiumPrice = premiumPrice;
    candidate.priceOrderValid = priceOrderValid;
    candidate.premiumCouldNotExceedValue = Boolean(premium?.premiumCouldNotExceedValue);
    candidate.priceOrderFixReason = premium?.priceOrderFixReason || (priceOrderValid
      ? "alreadyStrictlyIncreasing"
      : "priceOrderStillInvalid");
  });
}

function getCandidateRealPrice(candidate) {
  return Number(candidate?.finalPlanPrice ?? candidate?.estimatedPrice ?? 0);
}

function selectJapaneseBasicByBudget(candidates, targets) {
  const pricedCandidates = candidates.map((candidate) => ({
    candidate,
    price: getJapaneseCandidatePriceForTier(candidate, "basic")
  }));
  const inBand = pricedCandidates
    .filter(({ price }) => price >= targets.basicMin && price <= targets.basicMax)
    .sort((left, right) => (
      Math.abs(left.price - targets.basic) - Math.abs(right.price - targets.basic)
      || Number(right.candidate.scores?.caseMatchBonus || 0)
        - Number(left.candidate.scores?.caseMatchBonus || 0)
    ));
  if (inBand.length) {
    return { candidate: inBand[0].candidate, reason: "basicInsideBudgetMidBand" };
  }
  const atOrAboveBudget = pricedCandidates
    .filter(({ price }) => price >= targets.budgetMin)
    .sort((left, right) => left.price - right.price
      || Number(right.candidate.scores?.caseMatchBonus || 0)
        - Number(left.candidate.scores?.caseMatchBonus || 0));
  if (atOrAboveBudget.length) {
    return {
      candidate: atOrAboveBudget[0].candidate,
      reason: "basicLowestRealCandidateAtOrAboveBudgetMin"
    };
  }
  const belowBudget = pricedCandidates.sort((left, right) => (
    Math.abs(left.price - targets.basic) - Math.abs(right.price - targets.basic)
    || right.price - left.price
  ));
  return { candidate: belowBudget[0]?.candidate || null, reason: "basicBelowBudgetFallback" };
}

function prepareJapaneseBasicCandidate(candidate, answers) {
  return prepareJapaneseTierCandidate(candidate, answers, "basic");
}

function prepareJapaneseTierCandidate(candidate, answers, planType) {
  const prepared = cloneCandidateForTier(candidate, planType);
  if (prepared) finalizeDerivedCandidate(prepared, prepared, answers, planType, 1, 0);
  return prepared;
}

function getJapaneseCandidatePriceForTier(candidate) {
  if (candidate?.manualComponentPrice == null) return getCandidateRealPrice(candidate);
  return Math.round(Number(candidate.manualComponentPrice || 0) / 100) * 100;
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
  const orderedCandidateBays = isFixedWidthAccessory(componentType)
    ? selectJapanesePreferredAccessoryBays(
      candidateBays,
      componentType,
      answers.roomWidth,
      bayCount,
      candidate.placements,
      "addRequiredJapaneseComponent"
    )
    : candidateBays;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const added = orderedCandidateBays.some((bay) => addJapaneseTemplateComponent(
      candidate.placements,
      componentType,
      templateZone,
      getJapaneseAccessoryCandidateBayIndex(bay),
      0,
      answers,
      bayCount,
      isFixedWidthAccessory(componentType) ? { preferredWidth: getJapaneseAccessoryModuleWidthForBay(bay) } : {}
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
  const valuePrice = getCandidateRealPrice(sourceCandidate);
  const requiredPrice = Math.max(bayMinimumPrice, Number(targets.budgetMax || 0) + 1, valuePrice + 1);
  if (Number(candidate.finalPlanPrice || candidate.estimatedPrice || 0) >= requiredPrice) {
    candidate.premiumMinimumPrice = bayMinimumPrice;
    candidate.premiumMinimumMet = true;
    candidate.premiumAboveBudget = Number(candidate.finalPlanPrice || candidate.estimatedPrice || 0)
      > targets.budgetMax;
    candidate.premiumCouldNotExceedBudget = !candidate.premiumAboveBudget;
    candidate.premiumCouldNotExceedValue = false;
    candidate.priceOrderFixReason ||= "selectedRealPremiumAboveValue";
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
        ? tryAddTierUpgrade(premium, "trouserZone", componentType, [...JAPANESE_TROUSER_RACK_HEIGHTS], true)
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
  premium.premiumCouldNotExceedValue = getCandidateRealPrice(premium) <= valuePrice;
  premium.priceOrderFixReason = premium.premiumCouldNotExceedValue
    ? "highestRealPremiumCouldNotExceedValue"
    : "derivedWithRealComponentsAboveValue";
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
    return aWithinTarget - bWithinTarget
      || aDelta - bDelta
      || caseMatchDelta
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
      return tryAddTierUpgrade(candidate, "trouserZone", componentType, [...JAPANESE_TROUSER_RACK_HEIGHTS], true);
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
  const budgetMid = (budgetMin + budgetMax) / 2;
  const basicMin = Math.max(budgetMin, budgetMid * 0.8);
  const basicMax = budgetMid;
  const premiumMin = budgetMax * 1.05;
  const premiumMax = budgetMax * 1.20;
  return {
    budgetMin,
    budgetMax,
    budgetMid,
    basicMin,
    basicMax,
    basic: (basicMin + basicMax) / 2,
    value: budgetMid,
    premium: (premiumMin + premiumMax) / 2,
    premiumMin,
    premiumMax
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
  candidate.budgetMid = targets.budgetMid;
  candidate.basicMin = targets.basicMin;
  candidate.basicMax = targets.basicMax;
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

export function validateCandidateTierSet(candidatePlans = []) {
  const byType = new Map((candidatePlans || [])
    .filter(Boolean)
    .map((candidate) => [candidate.planType, candidate]));
  const ordered = PLAN_TYPES.map((planType) => byType.get(planType) || null);
  const issues = [];
  const snapshots = Object.fromEntries(ordered
    .filter(Boolean)
    .map((candidate) => [candidate.planType, getCandidateQaSnapshot(candidate)]));
  const addIssue = (issue) => {
    issues.push({
      severity: "error",
      recommendedAction: "rejectInvalidTierSet",
      ...issue
    });
  };

  const missingPlans = PLAN_TYPES.filter((planType) => !byType.has(planType));
  missingPlans.forEach((planType) => addIssue({
    ruleId: "QA000",
    reason: "candidateTierMissing",
    planType
  }));

  compareTierPair(snapshots.basic, snapshots.value, "basicToValue", addIssue);
  compareTierPair(snapshots.value, snapshots.premium, "valueToPremium", addIssue);

  const summary = {
    planTypes: PLAN_TYPES.filter((planType) => Boolean(snapshots[planType])),
    prices: Object.fromEntries(Object.entries(snapshots).map(([planType, snapshot]) => [planType, snapshot.price])),
    componentCounts: Object.fromEntries(Object.entries(snapshots)
      .map(([planType, snapshot]) => [planType, snapshot.componentCounts])),
    componentTotals: Object.fromEntries(Object.entries(snapshots)
      .map(([planType, snapshot]) => [planType, snapshot.componentTotal])),
    capacities: Object.fromEntries(Object.entries(snapshots).map(([planType, snapshot]) => [planType, snapshot.capacity])),
    capacitySources: Object.fromEntries(Object.entries(snapshots)
      .map(([planType, snapshot]) => [planType, snapshot.capacitySource])),
    issueCount: issues.length
  };
  const capacityByPlan = Object.fromEntries(Object.entries(snapshots)
    .map(([planType, snapshot]) => [planType, snapshot.capacity]));
  const capacitySource = Object.values(snapshots).every((snapshot) => snapshot.capacitySource === "placementDerived")
    ? "placementDerived"
    : "estimatedFallback";
  const capacityDiff = Object.values(snapshots).flatMap((snapshot) => snapshot.capacityDiff);
  const capacityContributions = Object.values(snapshots)
    .flatMap((snapshot) => snapshot.capacityContributions);
  const missingWidthFallbackCount = capacityContributions
    .filter((item) => item.fallbackReason === "missingWidthFallback").length;

  return {
    passed: issues.length === 0,
    issues,
    summary,
    capacitySource,
    capacityByPlan,
    capacityDiff,
    capacityContributions,
    missingWidthFallbackCount
  };
}

function selectQaApprovedTierSet(initialSelected = []) {
  const initial = getOrderedTierSet(initialSelected);
  const candidateQa = {
    ...validateCandidateTierSet(initial),
    selectionMode: "diagnosticOnly",
    attemptedTierSets: 1,
    selectedAttemptIndex: 0,
    failedAttemptCount: 0,
    originalSelectedCandidateIds: getTierSetCandidateIds(initial),
    finalSelectedCandidateIds: getTierSetCandidateIds(initial)
  };
  attachCandidateQaResult(initial, candidateQa);
  return {
    selected: initial,
    candidateQa,
    attempts: [{ selected: initial, qa: candidateQa }]
  };
}

function getOrderedTierSet(selected = []) {
  const byType = new Map((selected || [])
    .filter(Boolean)
    .map((candidate) => [candidate.planType, candidate]));
  return PLAN_TYPES.map((planType, index) => byType.get(planType) || selected[index] || null);
}

function getQaCandidateWindow(candidates = [], initialCandidate = null) {
  const window = [];
  if (initialCandidate) window.push(initialCandidate);
  candidates.filter(Boolean).forEach((candidate) => {
    if (window.some((item) => getCandidateQaSelectionKey(item) === getCandidateQaSelectionKey(candidate))) return;
    window.push(candidate);
  });
  return window.slice(0, CANDIDATE_QA_SELECTION_WINDOW);
}

function getTierSetCandidateIds(selected = []) {
  return Object.fromEntries(PLAN_TYPES.map((planType, index) => [
    planType,
    getCandidateQaId(selected[index])
  ]));
}

function getCandidateQaId(candidate) {
  if (!candidate) return null;
  return candidate.planId
    || candidate.configPreset?.candidatePlanId
    || `${candidate.planType}:${getCandidateRealPrice(candidate)}:${getPlacementSignature(candidate)}`;
}

function getCandidateQaSelectionKey(candidate) {
  if (!candidate) return null;
  return `${getCandidateQaId(candidate)}:${getCandidateRealPrice(candidate)}:${getPlacementSignature(candidate)}`;
}

function attachCandidateQaResult(selected = [], candidateQa = null) {
  const ordered = getOrderedTierSet(selected);
  const resolvedCandidateQa = {
    ...(candidateQa || validateCandidateTierSet(ordered)),
    selectionMode: candidateQa?.selectionMode || "diagnosticOnly",
    attemptedTierSets: candidateQa?.attemptedTierSets ?? 1,
    selectedAttemptIndex: candidateQa?.selectedAttemptIndex ?? 0,
    failedAttemptCount: candidateQa?.failedAttemptCount ?? 0,
    originalSelectedCandidateIds: candidateQa?.originalSelectedCandidateIds || getTierSetCandidateIds(ordered),
    finalSelectedCandidateIds: candidateQa?.finalSelectedCandidateIds || getTierSetCandidateIds(ordered)
  };
  selected.filter(Boolean).forEach((candidate) => {
    candidate.candidateQa = resolvedCandidateQa;
    candidate.candidateQaPassed = resolvedCandidateQa.passed;
    candidate.candidateQaIssues = resolvedCandidateQa.issues;
  });
  lastStats.candidateQa = resolvedCandidateQa;
  return resolvedCandidateQa;
}

function compareTierPair(lower, higher, failedPair, addIssue) {
  if (!lower || !higher) return;
  if (higher.price < lower.price) {
    addIssue({
      ruleId: "QA001",
      reason: "priceMonotonicityFailed",
      planType: higher.planType,
      failedPair,
      valuesCompared: {
        [lower.planType]: lower.price,
        [higher.planType]: higher.price
      }
    });
  }

  const categories = unique([...Object.keys(lower.capacity), ...Object.keys(higher.capacity)]);
  const capacityGains = [];
  categories.forEach((category) => {
    const lowerValue = Number(lower.capacity[category] || 0);
    const higherValue = Number(higher.capacity[category] || 0);
    if (higherValue > lowerValue) capacityGains.push(category);
    if (higherValue < lowerValue) {
      const valuesCompared = {
        category,
        [lower.planType]: lowerValue,
        [higher.planType]: higherValue,
        failedPair
      };
      addIssue({
        ruleId: "QA002",
        reason: "storageCapacityMonotonicityFailed",
        planType: higher.planType,
        category,
        failedPair,
        valuesCompared
      });
      addIssue({
        ruleId: "QA004",
        reason: "higherTierRegressionFailed",
        planType: higher.planType,
        category,
        failedPair,
        valuesCompared
      });
    }
  });

  const componentIncreases = getComponentIncreases(lower.componentCounts, higher.componentCounts);
  if (!componentIncreases.length && !capacityGains.length) {
    addIssue({
      ruleId: "QA003",
      reason: "tierRealComponentDifferenceFailed",
      planType: higher.planType,
      failedPair,
      valuesCompared: {
        componentCounts: {
          [lower.planType]: lower.componentCounts,
          [higher.planType]: higher.componentCounts
        },
        capacity: {
          [lower.planType]: lower.capacity,
          [higher.planType]: higher.capacity
        }
      }
    });
  }

  if (higher.price < lower.price && higher.componentTotal <= lower.componentTotal) {
    addIssue({
      ruleId: "QA004",
      reason: "higherTierRegressionFailed",
      planType: higher.planType,
      failedPair,
      valuesCompared: {
        price: {
          [lower.planType]: lower.price,
          [higher.planType]: higher.price
        },
        componentTotal: {
          [lower.planType]: lower.componentTotal,
          [higher.planType]: higher.componentTotal
        }
      }
    });
  }

  if (higher.componentTotal < lower.componentTotal && !capacityGains.length) {
    addIssue({
      ruleId: "QA004",
      reason: "higherTierRegressionFailed",
      planType: higher.planType,
      failedPair,
      valuesCompared: {
        componentTotal: {
          [lower.planType]: lower.componentTotal,
          [higher.planType]: higher.componentTotal
        },
        capacityGains
      }
    });
  }
}

function getCandidateQaSnapshot(candidate) {
  const componentCounts = getComponentCount(candidate);
  const capacityInfo = getCandidateQaCapacityInfo(candidate);
  return {
    planType: candidate.planType,
    candidatePlanId: candidate.planId || candidate.configPreset?.candidatePlanId || "",
    price: getCandidateRealPrice(candidate),
    componentCounts,
    componentTotal: Object.values(componentCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    capacity: capacityInfo.capacity,
    capacitySource: capacityInfo.capacitySource,
    estimatedCapacity: capacityInfo.estimatedCapacity,
    placementDerivedCapacity: capacityInfo.placementDerivedCapacity,
    capacityDiff: capacityInfo.capacityDiff,
    capacityContributions: capacityInfo.capacityContributions
  };
}

function getCandidateCapacityMap(candidate) {
  return getCandidateQaCapacityInfo(candidate).capacity;
}

function getCandidateQaCapacityInfo(candidate) {
  const capacityContributions = calculatePlacementCapacityContributions(candidate);
  const placementDerivedCapacity = summarizePlacementCapacityContributions(capacityContributions);
  const estimatedCapacity = getEstimatedCandidateCapacityMap(candidate);
  const hasPlacementDerivedCapacity = Object.keys(placementDerivedCapacity).length > 0;
  const capacity = hasPlacementDerivedCapacity ? placementDerivedCapacity : estimatedCapacity;
  return {
    capacity,
    capacitySource: hasPlacementDerivedCapacity ? "placementDerived" : "estimatedFallback",
    estimatedCapacity,
    placementDerivedCapacity,
    capacityDiff: getCandidateCapacityDiff(
      candidate?.planType || "",
      estimatedCapacity,
      placementDerivedCapacity
    ),
    capacityContributions
  };
}

function getEstimatedCandidateCapacityMap(candidate) {
  const capacity = {};
  (candidate?.estimatedCapacity || []).forEach((item) => {
    const category = normalizeCapacityCategory(item);
    if (!category) return;
    capacity[category] = getCapacityNumericValue(item);
  });
  return capacity;
}

export function calculatePlacementDerivedCapacity(candidatePlan) {
  return summarizePlacementCapacityContributions(
    calculatePlacementCapacityContributions(candidatePlan)
  );
}

function calculatePlacementCapacityContributions(candidatePlan) {
  const planType = candidatePlan?.planType || "";
  const contributions = [];
  const rules = getPlacementCapacityRules();
  (candidatePlan?.placements || [])
    .filter((placement) => isRealCapacityPlacement(placement))
    .forEach((placement, index) => {
      const capacityEntry = getPlacementCapacityEntry(placement, rules, planType, index);
      if (!capacityEntry) return;
      contributions.push(capacityEntry);
    });
  return contributions;
}

function summarizePlacementCapacityContributions(contributions = []) {
  const capacity = {};
  contributions.forEach((capacityEntry) => {
    capacity[capacityEntry.itemType] = roundCapacityValue(
      Number(capacity[capacityEntry.itemType] || 0) + capacityEntry.contribution
    );
  });
  return capacity;
}

function getPlacementCapacityRules() {
  try {
    return getClosetRules().capacityRules || [];
  } catch {
    return [];
  }
}

function isRealCapacityPlacement(placement) {
  if (!placement) return false;
  if (placement.zoneType === "luggageZone") return !placement.componentType || placement.componentType === "NONE";
  return Boolean(placement.componentType);
}

function getPlacementCapacityEntry(placement, rules, planType = "", index = 0) {
  const itemType = getPlacementCapacityItemType(placement);
  if (!itemType) return null;
  const componentType = normalizePlacementCapacityComponent(placement.componentType || "NONE");
  const rule = findPlacementCapacityRule(rules, componentType, itemType);
  if (!rule) return null;
  const baseCapacity = Number(rule.capacity);
  if (!Number.isFinite(baseCapacity) || baseCapacity <= 0) return null;
  const scaleInfo = getPlacementCapacityScale(placement, rule);
  const contribution = roundCapacityValue(baseCapacity * scaleInfo.scale);
  return {
    planType,
    placementId: getPlacementCapacityDebugId(placement, planType, index),
    componentType: placement.componentType || "NONE",
    bayIndex: Number(placement.bayIndex) || 0,
    componentCutLength: numberOrNull(placement.componentCutLength),
    innerBayWidth: numberOrNull(placement.innerBayWidth),
    visualScaleWidth: numberOrNull(placement.visualScaleWidth),
    widthSource: scaleInfo.widthSource,
    ruleCapacity: baseCapacity,
    ruleZoneLengthMm: numberOrNull(rule.zoneLengthMm),
    scale: roundCapacityValue(scaleInfo.scale),
    contribution,
    fallbackReason: scaleInfo.fallbackReason,
    itemType,
    quantity: contribution
  };
}

function getPlacementCapacityItemType(placement) {
  return PLACEMENT_CAPACITY_ZONE_ITEM_TYPES[placement.zoneType]
    || PLACEMENT_CAPACITY_ZONE_ITEM_TYPES[placement.templateZone]
    || PLACEMENT_CAPACITY_ZONE_ITEM_TYPES[placement.templateRole]
    || "";
}

function normalizePlacementCapacityComponent(componentType) {
  const normalized = String(componentType || "NONE").trim() || "NONE";
  return PLACEMENT_CAPACITY_COMPONENT_ALIASES[normalized] || normalized;
}

function findPlacementCapacityRule(rules, componentType, itemType) {
  return rules.find((rule) => rule.componentType === componentType && rule.itemType === itemType)
    || rules.find((rule) => rule.componentType === componentType && !rule.itemType)
    || null;
}

function getPlacementCapacityScale(placement, rule) {
  const widthInfo = getPlacementCapacityWidth(placement);
  const zoneLength = Number(rule.zoneLengthMm);
  if (Number.isFinite(widthInfo.width) && widthInfo.width > 0
    && Number.isFinite(zoneLength) && zoneLength > 0) {
    return {
      scale: widthInfo.width / zoneLength,
      widthSource: widthInfo.widthSource,
      fallbackReason: ""
    };
  }
  if (!Number.isFinite(zoneLength) || zoneLength <= 0) {
    return {
      scale: 1,
      widthSource: widthInfo.widthSource,
      fallbackReason: "unitCapacityRule"
    };
  }
  const quantity = Number(placement.quantity ?? placement.count);
  if (Number.isFinite(quantity) && quantity > 0) {
    return {
      scale: quantity,
      widthSource: "quantity",
      fallbackReason: "quantityFallback"
    };
  }
  return {
    scale: 1,
    widthSource: "none",
    fallbackReason: "missingWidthFallback"
  };
}

function getPlacementCapacityWidth(placement) {
  const fields = [
    "componentCutLength",
    "cutLength",
    "innerBayWidth",
    "usableComponentWidth",
    "visualScaleWidth",
    "widthMm",
    "width",
    "lengthMm",
    "length"
  ];
  for (const field of fields) {
    const width = Number(placement?.[field]);
    if (Number.isFinite(width) && width > 0) {
      return { width, widthSource: field };
    }
  }
  return { width: null, widthSource: "none" };
}

function getPlacementCapacityDebugId(placement, planType, index) {
  return placement.id
    || placement.placementId
    || `${planType || "plan"}:${placement.wallId || "back"}:${Number(placement.bayIndex) || 0}:${placement.componentType || "NONE"}:${Number(placement.heightFromFloor) || 0}:${index}`;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundCapacityValue(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getCandidateCapacityDiff(planType, estimatedCapacity = {}, placementDerivedCapacity = {}) {
  return unique([...Object.keys(estimatedCapacity), ...Object.keys(placementDerivedCapacity)])
    .map((category) => {
      const estimated = Number(estimatedCapacity[category] || 0);
      const placementDerived = Number(placementDerivedCapacity[category] || 0);
      return {
        planType,
        category,
        estimated,
        placementDerived,
        delta: roundCapacityValue(placementDerived - estimated)
      };
    });
}

function normalizeCapacityCategory(item) {
  return String(item?.itemType || item?.category || item?.key || item?.label || "").trim();
}

function getCapacityNumericValue(item) {
  const direct = Number(item?.quantity ?? item?.value ?? item?.count ?? item?.capacity);
  if (Number.isFinite(direct)) return direct;
  const text = [item?.estimate, item?.label, item?.displayValue].filter(Boolean).join(" ");
  const parsed = String(text).match(/[\d.]+/);
  return parsed ? Number(parsed[0]) : 0;
}

function getComponentIncreases(lowerCounts = {}, higherCounts = {}) {
  return unique([...Object.keys(lowerCounts), ...Object.keys(higherCounts)])
    .filter((componentType) => Number(higherCounts[componentType] || 0) > Number(lowerCounts[componentType] || 0));
}

export function getLastCandidateEngineStats() {
  return {
    ...lastStats,
    rejectReasons: { ...lastStats.rejectReasons },
    rejectReasonsByPlanType: Object.fromEntries(Object.entries(lastStats.rejectReasonsByPlanType || {})
      .map(([planType, reasons]) => [planType, { ...reasons }])),
    candidateRejectTopReasons: [...(lastStats.candidateRejectTopReasons || [])],
    matchedJapaneseCases: [...(lastStats.matchedJapaneseCases || [])],
    caseMatching: {
      ...(lastStats.caseMatching || {}),
      userRequirementVector: { ...(lastStats.caseMatching?.userRequirementVector || {}) },
      topCandidates: (lastStats.caseMatching?.topCandidates || []).map((candidate) => ({
        ...candidate,
        scoreBreakdown: cloneCaseMatchingScoreBreakdown(candidate.scoreBreakdown),
        tags: [...(candidate.tags || [])]
      }))
    },
    caseMatchingRuleLoad: { ...(lastStats.caseMatchingRuleLoad || {}) },
    componentUpgrade: Object.fromEntries(Object.entries(lastStats.componentUpgrade || {})
      .map(([planType, debug]) => [planType, cloneComponentUpgradeDebug(debug)])),
    candidateQa: {
      ...(lastStats.candidateQa || { passed: true, issues: [], summary: {} }),
      issues: [...(lastStats.candidateQa?.issues || [])],
      summary: { ...(lastStats.candidateQa?.summary || {}) },
      capacityByPlan: { ...(lastStats.candidateQa?.capacityByPlan || {}) },
      capacityDiff: [...(lastStats.candidateQa?.capacityDiff || [])],
      capacityContributions: [...(lastStats.candidateQa?.capacityContributions || [])],
      missingWidthFallbackCount: lastStats.candidateQa?.missingWidthFallbackCount || 0
    },
    heatmap: Object.fromEntries(Object.entries(lastStats.heatmap || {})
      .map(([planType, candidates]) => [planType, candidates.map((candidate) => ({ ...candidate }))]))
  };
}

function toJapaneseCaseDebugSummary(caseData) {
  return {
    caseId: caseData.caseId,
    score: caseData.score,
    modelPath: caseData.modelPath,
    matchedReason: caseData.matchedReason,
    layoutTemplate: caseData.layoutTemplate || [],
    specialTemplate: Boolean(caseData.specialTemplate),
    premiumSpecialTemplate: Boolean(caseData.premiumSpecialTemplate)
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
    added += tryAddTierUpgrade(value, "trouserZone", "trouserRack", [...JAPANESE_TROUSER_RACK_HEIGHTS], true);
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
    addedUpgradeCount += tryAddTierUpgrade(premium, "trouserZone", "trouserRack", [...JAPANESE_TROUSER_RACK_HEIGHTS], true);
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
  const existingOrder = Array.from({ length: bayCount }, (_, index) => bayCount - index - 1);
  const orderedBays = isFixedWidthAccessory(componentType)
    ? selectJapanesePreferredAccessoryBays(
      existingOrder,
      componentType,
      candidate.configPreset?.roomWidth,
      bayCount,
      candidate.placements,
      "tryAddTierUpgrade"
    )
    : existingOrder;
  for (const bay of orderedBays) {
    const bayIndex = getJapaneseAccessoryCandidateBayIndex(bay);
    const removedLowRails = componentType === "trouserRack"
      && candidate.configPreset?.productSystemId === "japanese-closet"
      ? removeJapaneseLowRailsForTrouser(candidate.placements, bayIndex)
      : [];
    const bayPlacements = candidate.placements.filter((item) => (
      item.wallId === "back" && Number(item.bayIndex) === bayIndex && item.componentType
    ));
    const heightCandidates = getJapaneseAccessoryHeightCandidates(componentType, heights, bayPlacements);
    for (const heightFromFloor of heightCandidates) {
      const upgrade = placement(zoneType, componentType, bayIndex, heightFromFloor);
      if (isFixedWidthAccessory(componentType)) {
        const preferredWidth = getJapaneseAccessoryModuleWidthForBay(bay);
        if (preferredWidth) {
          upgrade.preferredWidth = preferredWidth;
          upgrade.allowedWidths = [preferredWidth];
        }
      }
      if (candidate.placements.some((item) => item.wallId === upgrade.wallId
        && item.bayIndex === upgrade.bayIndex
        && intervalsOverlap(intervalFor(item), intervalFor(upgrade)))) continue;
      if (candidate.placements.some((item) => item.wallId === upgrade.wallId
        && item.bayIndex === upgrade.bayIndex
        && item.zoneType === "luggageZone")) continue;
      candidate.placements.push(upgrade);
      if (candidate.configPreset?.productSystemId === "japanese-closet"
        && getJapanesePlacementValidationDiagnostics(candidate.placements)
          .some((item) => !item.isValidPlacement)) {
        candidate.placements.pop();
        continue;
      }
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
    candidate.placements.push(...removedLowRails);
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
  if (getSelectedSeriesId(answers) === "japanese-closet") {
    applyJapanesePlacementDimensions({ placements, parameters }, answers);
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
    placementStrategyDebug: [...(placements.placementStrategyDebug || [])],
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
  const skeleton = buildJapaneseLayoutSkeleton(answers, bayCount);
  const placements = [];
  skeleton.forEach((entry) => initializeJapaneseSkeletonBay(placements, entry, answers, planType));
  const candidate = { placements, skeleton, parameters: { bayCount }, configPreset: { bayCount } };
  const usedBays = new Set();
  const requirements = answers.japaneseHardRequirements || getJapaneseHardRequirements(answers);
  if (planType !== "basic") {
    addJapaneseSkeletonUpgrade(candidate, "cabinet", skeleton, answers, usedBays, true);
    const accessories = planType === "value"
      ? [
        ...(requirements.valuePrefersTrouserRack ? ["trouserRack"] : []),
        ...(requirements.valuePrefersJewelryBox ? ["jewelryBox"] : [])
      ].slice(0, 1)
      : [
        ...(requirements.requiresTrouserRack ? ["trouserRack"] : []),
        ...(requirements.requiresJewelryBox ? ["jewelryBox"] : [])
      ];
    accessories.forEach((componentType) => {
      addJapaneseSkeletonUpgrade(candidate, componentType, skeleton, answers, usedBays, true);
    });
  }
  repairJapaneseCaseLayout(candidate);
  placements.placementStrategyDebug = [...(candidate.placementStrategyDebug || [])];
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

function addJapaneseTemplateComponent(
  placements,
  componentType,
  templateZone,
  bayIndex,
  componentIndex,
  answers,
  bayCount,
  placementOptions = {}
) {
  const bayPlacements = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
  const counts = countBy(bayPlacements, (item) => item.componentType);
  const role = normalizeJapaneseTemplateRole(templateZone);
  const accessoryCount = bayPlacements.filter((item) => ["trouserRack", "jewelryBox"]
    .includes(item.componentType)).length;
  const railCount = bayPlacements.filter((item) => ["singleRail", "doubleRail"]
    .includes(item.componentType)).length;
  const shelfLimit = role === "shoeShelfZone"
    ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shoeZone.maxWoodShelves
    : role === "shelfZone"
      ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shelfZone.maxWoodShelves
      : JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxWoodShelves;
  const railLimit = role === "shoeShelfZone"
    ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.shoeZone.maxRails
    : role === "longHangZone"
      ? JAPANESE_CASE_LAYOUT_RULES.componentLimits.longHangZone.maxRails
      : JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxRails;
  if (componentType === "cabinet" && Number(counts.cabinet || 0) >= 1) return false;
  if (["trouserRack", "jewelryBox"].includes(componentType)
    && (accessoryCount >= 1 || role === "shoeShelfZone" || role === "longHangZone")) return false;
  if (componentType === "woodShelf" && Number(counts.woodShelf || 0) >= shelfLimit) return false;
  if (["singleRail", "doubleRail"].includes(componentType)
    && railCount >= railLimit) return false;
  if (role === "longHangZone" && !["singleRail", "doubleRail"].includes(componentType)) return false;
  if (role !== "shoeShelfZone" && railCount > 0
    && componentType === "woodShelf" && Number(counts.woodShelf || 0) >= 2) return false;
  if (role !== "shoeShelfZone"
    && bayPlacements.length >= JAPANESE_CASE_LAYOUT_RULES.componentLimits.normalBay.maxFunctionalComponents) {
    if (!isAllowedJapaneseTrouserRackFunctionalShelfUpgrade(componentType, bayPlacements)) return false;
  }

  const zoneType = componentType === "trouserRack"
    ? "trouserZone"
    : componentType === "jewelryBox" ? "jewelryZone"
      : role === "shoeShelfZone" ? "shoeZone"
        : role === "shortHangZone" ? "shortHangZone"
          : role === "longHangZone" ? "longHangZone"
            : role === "luggageZone" ? "luggageZone" : "storageZone";
  const heights = getJapaneseAccessoryHeightCandidates(
    componentType,
    getJapaneseTemplateHeights(componentType, zoneType),
    bayPlacements
  );
  for (const heightFromFloor of rotateHeightCandidates(heights, componentIndex)) {
    const candidate = placement(zoneType, componentType, bayIndex, heightFromFloor);
    candidate.templateRole = role;
    candidate.templateZone = role;
    const fixedAccessoryPreferredWidth = isFixedWidthAccessory(componentType)
      ? Number(placementOptions.preferredWidth)
        || getPreferredJapaneseFixedModuleWidth(answers?.roomWidth, bayCount)
      : null;
    if (fixedAccessoryPreferredWidth > 0) {
      candidate.preferredWidth = fixedAccessoryPreferredWidth;
      candidate.allowedWidths = [fixedAccessoryPreferredWidth];
    }
    if (bayPlacements.some((item) => intervalsOverlap(intervalFor(item), intervalFor(candidate)))) continue;
    if (getJapanesePlacementValidationDiagnostics([...bayPlacements, candidate])
      .some((item) => !item.isValidPlacement)) continue;
    placements.push(candidate);
    return true;
  }
  return false;
}

function isAllowedJapaneseTrouserRackFunctionalShelfUpgrade(componentType, bayPlacements = []) {
  if (componentType !== "trouserRack") return false;
  const hasHighRail = bayPlacements.some((item) => (
    ["singleRail", "doubleRail"].includes(item.componentType)
    && Number(item.heightFromFloor || 0) >= JAPANESE_PRESERVED_HIGH_RAIL_MIN_HEIGHT
    && Number(item.heightFromFloor || 0) <= JAPANESE_PRESERVED_HIGH_RAIL_MAX_HEIGHT
  ));
  const hasPreservedLowerFunctionalShelf = bayPlacements.some((item) => (
    item.componentType === JAPANESE_UPGRADE_POLICY.preserve.functionalShelf.componentType
    && !JAPANESE_UPGRADE_POLICY.preserve.functionalShelf.excludedZoneTypes.includes(item.zoneType)
    && Number(item.heightFromFloor || 0) >= JAPANESE_PRESERVED_FUNCTIONAL_SHELF_MIN_HEIGHT
    && Number(item.heightFromFloor || 0) <= JAPANESE_PRESERVED_FUNCTIONAL_SHELF_MAX_HEIGHT
  ));
  const hasLowerRail = bayPlacements.some((item) => (
    ["singleRail", "doubleRail"].includes(item.componentType)
    && Number(item.heightFromFloor || 0) >= JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.minHeight
    && Number(item.heightFromFloor || 0) <= JAPANESE_UPGRADE_POLICY.lowerFunctionalZone.lowerRail.maxHeight
  ));
  return hasHighRail && hasPreservedLowerFunctionalShelf && !hasLowerRail;
}

function normalizeJapaneseTemplateRole(value) {
  const aliases = {
    shoeZone: "shoeShelfZone",
    storageZone: "storageAccessoryZone",
    accessoryZone: "storageAccessoryZone"
  };
  return aliases[value] || value || "storageAccessoryZone";
}

function getJapaneseTemplateHeights(componentType, zoneType) {
  if (componentType === "cabinet") return [0];
  if (componentType === "trouserRack") return [...JAPANESE_TROUSER_RACK_HEIGHTS];
  if (componentType === "jewelryBox") return [1100, 1300];
  if (componentType === "woodShelf") return zoneType === "shoeZone" ? [250, 500, 750] : [700, 1200, 2050];
  if (zoneType === "shortHangZone") return [1050, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT];
  return [1650];
}

function getJapaneseAccessoryHeightCandidates(componentType, heights, bayPlacements = []) {
  if (componentType !== "jewelryBox") return heights;
  const cabinet = bayPlacements.find((item) => item.componentType === "cabinet");
  if (!cabinet) return heights;
  const cabinetTop = getJapaneseCabinetTopForJewelry(cabinet);
  return [
    cabinetTop + JAPANESE_JEWELRY_BOX_GAP_ABOVE_CABINET,
    ...heights
  ].filter((height, index, list) => list.indexOf(height) === index);
}

function rotateHeightCandidates(heights = [], preferredIndex = 0) {
  if (!heights.length) return [];
  const index = Math.max(0, Math.min(heights.length - 1, Number(preferredIndex) || 0));
  return [
    ...heights.slice(index),
    ...heights.slice(0, index)
  ];
}

function normalizeJapaneseAccessoryPlacementsInBay(placements, bayIndex) {
  const items = placements.filter((item) => item.bayIndex === bayIndex && item.componentType);
  const cabinet = items.find((item) => item.componentType === "cabinet");
  const jewelryBox = items.find((item) => item.componentType === "jewelryBox");
  if (!cabinet || !jewelryBox) return;
  jewelryBox.heightFromFloor = getJapaneseCabinetTopForJewelry(cabinet)
    + JAPANESE_JEWELRY_BOX_GAP_ABOVE_CABINET;
  jewelryBox.allowCabinetContact = true;
}

function getJapaneseCabinetTopForJewelry(cabinet) {
  return (Number(cabinet?.heightFromFloor) || 0) + JAPANESE_CABINET_MODEL_HEIGHT;
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
  return getJapaneseCaseForbiddenPatternViolations({
    placements,
    parameters: { bayCount }
  }).length;
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
    placements.push(placement("shortHangZone", "singleRail", slot.bayIndex, JAPANESE_PRESERVED_UPPER_RAIL_HEIGHT, slot.wallId));
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
  distributePlacements(placements, "trouserZone", "trouserRack", parameters.trouserRack, componentBays, [...JAPANESE_TROUSER_RACK_HEIGHTS]);
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

function selectJapanesePreferredAccessoryBays(
  candidateBays,
  componentType,
  roomWidth,
  bayCount,
  placements = [],
  generatedBy = ""
) {
  const enrichedBays = withJapaneseAccessoryBayWidths(candidateBays, roomWidth, bayCount, placements);
  const ordered = selectPreferredAccessoryBay(enrichedBays, componentType);
  logJapanesePlacementStrategySelection(componentType, enrichedBays, ordered[0], generatedBy);
  return ordered;
}

function withJapaneseAccessoryBayWidths(candidateBays, roomWidth, bayCount, placements = []) {
  const fallbackWidth = getPreferredJapaneseFixedModuleWidth(roomWidth, bayCount);
  return candidateBays.map((bay) => {
    const normalizedBay = bay && typeof bay === "object"
      ? { ...bay }
      : { bayIndex: Number(bay) || 0 };
    const widthInfo = getJapaneseAccessoryBayWidthInfo(normalizedBay, placements, fallbackWidth);
    return {
      ...normalizedBay,
      accessoryBayWidth: widthInfo.bayWidth,
      accessoryBayWidthSource: widthInfo.widthSource
    };
  });
}

function getJapaneseAccessoryCandidateBayIndex(bay) {
  return Number(bay && typeof bay === "object" ? bay.bayIndex : bay) || 0;
}

function getJapaneseAccessoryBayWidthInfo(bay, placements = [], fallbackWidth = null) {
  const directFields = ["width", "innerBayWidth", "usableComponentWidth", "rawBayWidth", "postCenterDistance"];
  for (const field of directFields) {
    const width = getPositiveNumber(bay?.[field]);
    if (width != null) return { bayWidth: width, widthSource: `bay.${field}` };
  }

  const placement = findJapaneseAccessoryBayPlacement(placements, bay);
  const placementFields = ["innerBayWidth", "usableComponentWidth"];
  for (const field of placementFields) {
    const width = getPositiveNumber(placement?.[field]);
    if (width != null) return { bayWidth: width, widthSource: `placement.${field}` };
  }

  return {
    bayWidth: getPositiveNumber(fallbackWidth),
    widthSource: "fallback.roomWidthPerBay"
  };
}

function findJapaneseAccessoryBayPlacement(placements = [], bay) {
  const bayIndex = getJapaneseAccessoryCandidateBayIndex(bay);
  const wallId = bay && typeof bay === "object" ? bay.wallId || "back" : "back";
  return (placements || []).find((placement) => (
    (placement.wallId || "back") === wallId
    && Number(placement.bayIndex) === bayIndex
    && (
      getPositiveNumber(placement.innerBayWidth) != null
      || getPositiveNumber(placement.usableComponentWidth) != null
    )
  ));
}

function logJapanesePlacementStrategySelection(componentType, inputBays, selectedBay, generatedBy) {
  if (!isFixedWidthAccessory(componentType)) return;
  const placementStrategyInput = inputBays.map((bay) => ({
    bayIndex: getJapaneseAccessoryCandidateBayIndex(bay),
    role: bay.role || bay.templateRole || bay.templateZone || "",
    widthSource: bay.accessoryBayWidthSource || "none",
    bayWidth: getPositiveNumber(bay.accessoryBayWidth),
    fixedWidthRank: getJapaneseFixedWidthRankLabel(bay.accessoryBayWidth)
  }));
  const selectedBayInfo = selectedBay ? {
    bayIndex: getJapaneseAccessoryCandidateBayIndex(selectedBay),
    bayWidth: getPositiveNumber(selectedBay.accessoryBayWidth),
    widthSource: selectedBay.accessoryBayWidthSource || "none",
    reason: "fixedWidthAccessoryWidthPriority"
  } : null;
  const debugEntry = {
    componentType,
    generatedBy,
    placementStrategyInput,
    selectedBay: selectedBayInfo
  };
  console.log("[ai-planner] placement-strategy", debugEntry);
  const debugTarget = getPlannerPlacementStrategyDebugTarget();
  if (debugTarget) {
    debugTarget.__aiPlannerPlacementStrategyDebug ||= [];
    debugTarget.__aiPlannerPlacementStrategyDebug.push(debugEntry);
  }
}

function logJapaneseSkeletonUpgradePlacementStrategyDebug({
  candidate,
  componentType,
  beforeOrder,
  afterOrder,
  selectedBayIndex,
  skippedBays = [],
  reason = ""
}) {
  if (!isFixedWidthAccessory(componentType)) return;
  const numericSelectedBayIndex = getPositiveNumber(selectedBayIndex) != null
    ? Number(selectedBayIndex)
    : null;
  const selectedBay = numericSelectedBayIndex == null
    ? null
    : afterOrder.find((bay) => (
      getJapaneseAccessoryCandidateBayIndex(bay) === numericSelectedBayIndex
    ));
  const debugEntry = {
    functionName: "addJapaneseSkeletonUpgrade",
    componentType,
    beforeOrder: beforeOrder.map(toJapaneseSkeletonUpgradeBayDebug),
    afterOrder: afterOrder.map(toJapaneseSkeletonUpgradeBayDebug),
    selectedBayIndex: numericSelectedBayIndex,
    selectedBayWidth: getPositiveNumber(selectedBay?.accessoryBayWidth),
    widthSource: selectedBay?.accessoryBayWidthSource || null,
    reason,
    skippedBays
  };
  if (candidate && typeof candidate === "object") {
    candidate.placementStrategyDebug ||= [];
    candidate.placementStrategyDebug.push(debugEntry);
  }
  console.log("[ai-planner] addJapaneseSkeletonUpgrade placement-strategy", debugEntry);
  const debugTarget = getPlannerPlacementStrategyDebugTarget();
  if (debugTarget) {
    debugTarget.__aiPlannerPlacementStrategyDebug ||= [];
    debugTarget.__aiPlannerPlacementStrategyDebug.push(debugEntry);
  }
}

function getPlannerPlacementStrategyDebugTarget() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined") return globalThis;
  return null;
}

function toJapaneseSkeletonUpgradeBayDebug(bay) {
  return {
    bayIndex: getJapaneseAccessoryCandidateBayIndex(bay),
    role: bay.role || bay.templateRole || bay.templateZone || "",
    widthSource: bay.accessoryBayWidthSource || "none",
    bayWidth: getPositiveNumber(bay.accessoryBayWidth),
    fixedWidthRank: getJapaneseFixedWidthRankLabel(bay.accessoryBayWidth)
  };
}

function getJapaneseFixedWidthRankLabel(width) {
  const numericWidth = getPositiveNumber(width);
  if (numericWidth == null) return "other";
  return JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS.find((allowedWidth) => numericWidth >= allowedWidth) || "other";
}

function getJapaneseAccessoryModuleWidthForBay(bay) {
  const width = getPositiveNumber(
    bay?.accessoryBayWidth
    ?? bay?.preferredWidth
    ?? bay?.moduleWidth
    ?? bay?.standardWidth
    ?? bay?.innerBayWidth
    ?? bay?.usableComponentWidth
    ?? bay?.rawBayWidth
    ?? bay?.postCenterDistance
    ?? bay?.width
  );
  if (width == null) return null;
  return JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS.find((allowedWidth) => width >= allowedWidth)
    || JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS[JAPANESE_FIXED_MODULE_ALLOWED_WIDTHS.length - 1];
}

function getPositiveNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
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
  if (getSelectedSeriesId(answers) === "japanese-closet") {
    preset.japaneseWallLayout = getJapaneseOptimizedWallLayout(answers, parameters.bayCount);
  }
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
  candidate.configPreset.japaneseWallLayout = getJapaneseOptimizedWallLayout(
    candidate.configPreset,
    candidate.parameters?.bayCount || candidate.configPreset?.bayCount || explicitPlacements.length || 1
  );
}

function buildCandidateExplicitPlacements(placements = []) {
  const explicitTypes = new Set([
    "singleRail",
    "doubleRail",
    "woodShelf",
    "cabinet",
    "jewelryBox",
    "trouserRack",
    "drawerSingle",
    "drawerDouble",
    "glassShelf"
  ]);
  return placements
    .filter((item) => explicitTypes.has(item.componentType))
    .map((item) => ({
      componentType: item.componentType,
      wallId: item.wallId || "back",
      bayIndex: Number.isInteger(Number(item.wallBayIndex))
        ? Number(item.wallBayIndex)
        : Number(item.bayIndex) || 0,
      logicalBayIndex: Number(item.bayIndex) || 0,
      heightFromFloor: Number(item.heightFromFloor) || 0,
      zoneType: item.zoneType || "",
      ...(item.isAutoSupplementalShortRail
        ? { isAutoSupplementalShortRail: true }
        : {}),
      ...(item.productSku ? { productSku: item.productSku } : {}),
      ...(item.topDrawerSku ? { topDrawerSku: item.topDrawerSku } : {}),
      ...(item.bottomDrawerSku ? { bottomDrawerSku: item.bottomDrawerSku } : {}),
      ...getJapanesePlacementDimensionFields(item),
      source: "candidate"
    }));
}

function getJapanesePlacementDimensionFields(placement) {
  return JAPANESE_PLACEMENT_DIMENSION_FIELDS.reduce((result, field) => {
    const value = placement?.[field];
    if (typeof value === "string" && value) {
      result[field] = value;
      return result;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) result[field] = numeric;
    return result;
  }, {});
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
  const normalizedBayCount = Math.max(0, Number(bayCount) || 0);
  const counts = countBy(placements.filter((item) => item.componentType), (item) => item.componentType);
  const baseBayPrice = JAPANESE_CLOSET_AI_PRICES.basicHangGroup;
  const basePlanPrice = normalizedBayCount * baseBayPrice;
  const woodShelfPrice = Number(counts.woodShelf || 0) * JAPANESE_CLOSET_AI_PRICES.woodShelf;
  const cabinetPrice = Number(counts.cabinet || 0) * JAPANESE_CLOSET_AI_PRICES.cabinet;
  const trouserRackPrice = Number(counts.trouserRack || 0)
    * JAPANESE_CLOSET_AI_PRICES.trouserRackWithShelf;
  const jewelryBoxPrice = Number(counts.jewelryBox || 0)
    * JAPANESE_CLOSET_AI_PRICES.jewelryBoxWithShelf;
  const drawerSinglePrice = Number(counts.drawerSingle || 0)
    * JAPANESE_CLOSET_AI_PRICES.drawerSingle;
  const drawerDoublePrice = Number(counts.drawerDouble || 0)
    * JAPANESE_CLOSET_AI_PRICES.drawerDouble;
  const doubleRailUpgradePrice = Number(counts.doubleRail || 0)
    * (JAPANESE_CLOSET_AI_PRICES.doubleRail - JAPANESE_CLOSET_AI_PRICES.singleRail);
  const includedRailSlots = normalizedBayCount * 2;
  const usedRailSlots = Number(counts.singleRail || 0) + Number(counts.doubleRail || 0);
  const supplementalRailCount = placements.filter((item) => item.isAutoSupplementalShortRail).length;
  const additionalSingleRailCount = Math.max(
    supplementalRailCount,
    usedRailSlots - includedRailSlots
  );
  const additionalSingleRailPrice = Math.max(0, additionalSingleRailCount)
    * JAPANESE_CLOSET_AI_PRICES.singleRail;
  const manualComponentPrice = basePlanPrice
    + woodShelfPrice
    + cabinetPrice
    + trouserRackPrice
    + jewelryBoxPrice
    + drawerSinglePrice
    + drawerDoublePrice
    + doubleRailUpgradePrice
    + additionalSingleRailPrice;
  const servicePriceFactor = 1;
  const finalPlanPrice = Math.round(manualComponentPrice / 100) * 100;
  const priceBreakdown = {
    baseBayPrice,
    bayCount: normalizedBayCount,
    basePlanPrice,
    woodShelfPrice,
    cabinetPrice,
    trouserRackPrice,
    jewelryBoxPrice,
    drawerSinglePrice,
    drawerDoublePrice,
    doubleRailUpgradePrice,
    supplementalRailCount,
    additionalSingleRailCount,
    additionalSingleRailPrice,
    manualComponentPrice,
    finalPlanPrice
  };
  return {
    baseBayPrice,
    basePlanPrice,
    manualComponentPrice,
    servicePriceFactor,
    finalPlanPrice,
    priceBreakdown,
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
    componentUpgrade: {
      ...cloneComponentUpgradeDebug(candidate.componentUpgrade),
      placementStrategyDebug: candidate.placementStrategyDebug || []
    },
    placementStrategyDebug: candidate.placementStrategyDebug || [],
    caseLibraryAppliedAs: candidate.caseLibraryAppliedAs || "layoutReferenceOnly",
    hardRuleOverrideCase: candidate.hardRuleOverrideCase || false,
    skeleton: candidate.skeleton || [],
    caseLayoutTemplate: candidate.caseLayoutTemplate || candidate.layoutTemplate || [],
    resolvedSkeleton: candidate.resolvedSkeleton || candidate.skeleton || [],
    forbiddenPatternViolations: candidate.forbiddenPatternViolations || [],
    tierUpgradeRulesApplied: candidate.tierUpgradeRulesApplied || {},
    bayRoleComponents: candidate.bayRoleComponents || [],
    baseBayPrice: candidate.baseBayPrice,
    basePlanPrice: candidate.basePlanPrice,
    basicUpgradeList: candidate.basicUpgradeList || [],
    valueUpgradeList: candidate.valueUpgradeList || [],
    premiumUpgradeList: candidate.premiumUpgradeList || [],
    basicPriceBreakdown: candidate.basicPriceBreakdown || {},
    valuePriceBreakdown: candidate.valuePriceBreakdown || {},
    premiumPriceBreakdown: candidate.premiumPriceBreakdown || {},
    caseUsedForLayoutOnly: candidate.caseUsedForLayoutOnly,
    basicComponents: candidate.basicComponents || {},
    valueComponents: candidate.valueComponents || {},
    premiumComponents: candidate.premiumComponents || {},
    basicVsValueDifferent: candidate.basicVsValueDifferent,
    valueVsPremiumDifferent: candidate.valueVsPremiumDifferent,
    visibleUpgradeCountBasicToValue: candidate.visibleUpgradeCountBasicToValue,
    visibleUpgradeCountValueToPremium: candidate.visibleUpgradeCountValueToPremium,
    fallbackUsed: candidate.fallbackUsed,
    fallbackReason: candidate.fallbackReason,
    layoutTemplate: candidate.layoutTemplate || [],
    bayPlan: candidate.bayPlan || [],
    templateViolationCount: candidate.templateViolationCount || 0,
    estimatedPrice: candidate.estimatedPrice,
    manualComponentPrice: candidate.manualComponentPrice,
    servicePriceFactor: candidate.servicePriceFactor,
    finalPlanPrice: candidate.finalPlanPrice,
    basicPrice: candidate.basicPrice,
    valuePrice: candidate.valuePrice,
    premiumPrice: candidate.premiumPrice,
    priceOrderValid: candidate.priceOrderValid,
    premiumCouldNotExceedValue: candidate.premiumCouldNotExceedValue,
    priceOrderFixReason: candidate.priceOrderFixReason,
    targetPrice: candidate.targetPrice,
    actualPrice: candidate.actualPrice,
    priceDelta: candidate.priceDelta,
    priceWasTargetAdjusted: candidate.priceWasTargetAdjusted,
    budgetMin: candidate.budgetMin,
    budgetMax: candidate.budgetMax,
    budgetMid: candidate.budgetMid,
    basicMin: candidate.basicMin,
    basicMax: candidate.basicMax,
    basicTarget: candidate.basicTarget,
    basicBelowBudgetFallback: candidate.basicBelowBudgetFallback,
    valueTarget: candidate.valueTarget,
    premiumTarget: candidate.premiumTarget,
    premiumAboveBudget: candidate.premiumAboveBudget,
    premiumCouldNotExceedBudget: candidate.premiumCouldNotExceedBudget,
    selectedBecause: candidate.selectedBecause,
    japanesePlacementValidationDebug: candidate.japanesePlacementValidationDebug || [],
    autoSupplementalRailDebug: candidate.autoSupplementalRailDebug || null,
    trouserRackPlacementBlocked: candidate.trouserRackPlacementBlocked === true,
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
      .every((item) => rail.heightFromFloor - intervalFor(item)[1] >= JAPANESE_LONG_HANG_MIN_CLEARANCE_BELOW)));
}

function validateShortHangHeights(placements) {
  const shortRails = placements.filter((placement) => placement.zoneType === "shortHangZone"
    && placement.componentType === "singleRail");
  return shortRails.every((rail) => (rail.heightFromFloor >= 900 && rail.heightFromFloor <= 1100)
    || (rail.heightFromFloor >= 1900 && rail.heightFromFloor <= 2050));
}

function getJapanesePlacementValidationDiagnostics(placements = []) {
  return placements
    .filter((placement) => ["trouserRack", "jewelryBox"].includes(placement.componentType))
    .map((placement) => validateJapaneseAccessoryPlacement(placement, placements));
}

function validateJapaneseAccessoryPlacement(placement, placements = []) {
  if (placement.componentType === "trouserRack") return validateTrouserRackClearance(placement, placements);
  if (placement.componentType === "jewelryBox") return validateJewelryBoxAboveCabinet(placement, placements);
  return {
    bayIndex: placement.bayIndex,
    componentType: placement.componentType,
    heightFromFloor: Number(placement.heightFromFloor) || 0,
    clearanceBelow: null,
    blockingComponentsBelow: [],
    isValidPlacement: true,
    invalidReason: ""
  };
}

function validateTrouserRackClearance(trouserRack, placements = []) {
  const rackHeight = Number(trouserRack.heightFromFloor) || 0;
  const clearanceStart = rackHeight - JAPANESE_TROUSER_RACK_MIN_CLEARANCE_BELOW;
  const sameBayPlacements = placements.filter((item) => item !== trouserRack
    && item.componentType
    && item.wallId === trouserRack.wallId
    && Number(item.bayIndex) === Number(trouserRack.bayIndex));
  const blockingComponentsBelow = sameBayPlacements
    .filter((item) => JAPANESE_TROUSER_RACK_BLOCKING_COMPONENTS.has(item.componentType))
    .map((item) => ({
      placement: item,
      range: intervalFor(item)
    }))
    .filter(({ range }) => range[1] > clearanceStart && range[0] < rackHeight)
    .map(({ placement: item, range }) => ({
      componentType: item.componentType,
      heightFromFloor: Number(item.heightFromFloor) || 0,
      minY: range[0],
      maxY: range[1]
    }));
  return {
    bayIndex: trouserRack.bayIndex,
    componentType: trouserRack.componentType,
    heightFromFloor: rackHeight,
    clearanceBelow: JAPANESE_TROUSER_RACK_MIN_CLEARANCE_BELOW,
    blockingComponentsBelow,
    isValidPlacement: blockingComponentsBelow.length === 0,
    invalidReason: blockingComponentsBelow.length ? "trouserRackClearanceBlocked" : ""
  };
}

function validateJewelryBoxAboveCabinet(jewelryBox, placements = []) {
  const sameBayPlacements = placements.filter((item) => item !== jewelryBox
    && item.componentType
    && item.wallId === jewelryBox.wallId
    && Number(item.bayIndex) === Number(jewelryBox.bayIndex));
  const cabinet = sameBayPlacements.find((item) => item.componentType === "cabinet");
  const jewelryHeight = Number(jewelryBox.heightFromFloor) || 0;
  if (!cabinet) {
    return {
      bayIndex: jewelryBox.bayIndex,
      componentType: jewelryBox.componentType,
      heightFromFloor: jewelryHeight,
      clearanceBelow: null,
      blockingComponentsBelow: [],
      isValidPlacement: true,
      invalidReason: ""
    };
  }
  const cabinetTop = getJapaneseCabinetTopForJewelry(cabinet);
  const gapAboveCabinet = jewelryHeight - cabinetTop;
  const isValidPlacement = gapAboveCabinet >= 0 && gapAboveCabinet <= JAPANESE_JEWELRY_BOX_GAP_ABOVE_CABINET;
  return {
    bayIndex: jewelryBox.bayIndex,
    componentType: jewelryBox.componentType,
    heightFromFloor: jewelryHeight,
    clearanceBelow: gapAboveCabinet,
    blockingComponentsBelow: [{
      componentType: "cabinet",
      heightFromFloor: Number(cabinet.heightFromFloor) || 0,
      minY: intervalFor(cabinet)[0],
      maxY: cabinetTop
    }],
    isValidPlacement,
    invalidReason: isValidPlacement ? "" : "jewelryBoxCabinetGapInvalid"
  };
}

function validateShoeGaps(placements) {
  const groups = groupPlacements(placements.filter((placement) => placement.zoneType === "shoeZone"
    && SHELF_TYPES.has(placement.componentType)));
  return Object.values(groups).every((items) => {
    const heights = items.map((item) => item.heightFromFloor).sort((a, b) => a - b);
    return heights.slice(1).every((height, index) => height - heights[index] >= SHOE_SHELF_MIN_GAP);
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
    .some((other) => !isAllowedJapaneseCabinetJewelryContact(item, other)
      && intervalsOverlap(intervalFor(item), intervalFor(other)))));
}

function isAllowedJapaneseCabinetJewelryContact(left, right) {
  const pair = new Set([left.componentType, right.componentType]);
  const jewelryBox = left.componentType === "jewelryBox" ? left : right;
  return pair.has("cabinet") && pair.has("jewelryBox") && jewelryBox.allowCabinetContact === true;
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
    demandQuantityProfile: answers.demandQuantityProfile || {},
    selectedProductSystem: answers.selectedProductSystem || null,
    matchedJapaneseCases: answers.matchedJapaneseCases || [],
    primaryJapaneseCase: answers.primaryJapaneseCase || answers.matchedJapaneseCases?.[0] || null,
    componentUpgradeRules: answers.componentUpgradeRules || []
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
