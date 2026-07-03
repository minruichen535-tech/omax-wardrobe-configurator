#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLAN_TYPES = ["basic", "value", "premium"];
const RAIL_TYPES = new Set(["singleRail", "doubleRail"]);
const SHOE_STORAGE_TYPES = new Set(["shoeShelf", "shoesShelf"]);
const LOWER_FUNCTIONAL_TYPES = new Set([
  "trouserRack",
  "jewelryBox",
  "drawer",
  "drawerCabinet",
  "storageCabinet"
]);
const TALL_BLOCKING_TYPES = new Set(["cabinet", "drawerCabinet", "storageCabinet"]);
const MAX_FAILURE_DETAILS = 20;

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

if (process.env.JAPANESE_AI_PLANNER_REGRESSION_CHILD !== "1") {
  const loaderPath = writeRegressionLoader();
  const args = [
    "--no-warnings",
    "--loader",
    loaderPath,
    fileURLToPath(import.meta.url),
    ...process.argv.slice(2)
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      JAPANESE_AI_PLANNER_REGRESSION_CHILD: "1"
    },
    stdio: "inherit"
  });
  process.exit(result.status ?? 1);
}

const { generateRecommendedPlans } = await import(
  `${pathToFileURL(path.join(repoRoot, "src/ai-planner/planRules.js")).href}?regression=${Date.now()}`
);

const output = console.log.bind(console);
const options = parseArgs(process.argv.slice(2));
if (!options.verbose) {
  console.log = () => {};
  console.warn = () => {};
}
const scenarios = buildScenarios(options.maxScenarios);
const failures = [];
let passed = 0;

for (const scenario of scenarios) {
  const result = runScenario(scenario);
  if (result.failures.length) {
    failures.push(...result.failures);
  } else {
    passed += 1;
  }
}

printReport({
  totalScenarios: scenarios.length,
  passed,
  failed: scenarios.length - passed,
  failures: failures.slice(0, MAX_FAILURE_DETAILS)
});

process.exit(failures.length ? 1 : 0);

function writeRegressionLoader() {
  const shimDir = path.join(os.tmpdir(), "japanese-ai-planner-regression");
  mkdirSync(shimDir, { recursive: true });
  const demandRulesShimPath = path.join(shimDir, "demandRulesShim.mjs");
  const xlsxShimPath = path.join(shimDir, "xlsxShim.mjs");
  const loaderPath = path.join(shimDir, "loader.mjs");

  writeFileSync(demandRulesShimPath, buildDemandRulesShimSource(), "utf8");
  writeFileSync(xlsxShimPath, "export default {}; export const utils = {}; export function read() { return {}; }\n", "utf8");
  writeFileSync(loaderPath, `
const demandRulesShimUrl = ${JSON.stringify(pathToFileURL(demandRulesShimPath).href)};
const xlsxShimUrl = ${JSON.stringify(pathToFileURL(xlsxShimPath).href)};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "xlsx") {
    return { url: xlsxShimUrl, shortCircuit: true };
  }
  if (specifier.includes("rules/demandRules.js")) {
    return { url: demandRulesShimUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`, "utf8");
  return loaderPath;
}

function buildDemandRulesShimSource() {
  return `
const PLAN_TIER = {
  basic: { planName: "基础实用款", coverage: 0.75 },
  value: { planName: "高性价比款", coverage: 0.9 },
  premium: { planName: "高配理想款", coverage: 1 }
};

export function buildPlanRuleOutput(needs = {}, peopleCount = "2人", planType = "basic") {
  const zones = Object.entries(needs)
    .filter(([, value]) => Number(value || 0) > 0)
    .map(([label, value]) => ({
      label,
      itemType: label,
      zoneType: getZoneUiKeyForDemand(label),
      componentType: label === "鞋子" ? "woodShelf" : "singleRail",
      requiredUnits: Math.max(1, Number(value || 0)),
      planType
    }));
  return {
    planType,
    zones,
    reservedZones: zones,
    componentQuantities: {},
    lighting: false,
    minBudgetForLighting: 0,
    capacity: zones.map((zone) => ({
      label: zone.label,
      estimate: Math.max(1, Number(zone.requiredUnits || 1))
    })),
    coverage: PLAN_TIER[planType]?.coverage || 1
  };
}

export function calculateDemandZoneLengths() {
  return {};
}

export function calculateDemandZoneProfile(weights = {}) {
  return Object.fromEntries(Object.entries(weights || {}).filter(([, value]) => Number(value || 0) > 0));
}

export function estimateDemandItems(weights = {}, people = "2人") {
  const peopleCount = Number(String(people).match(/\\d+/)?.[0]) || 1;
  return Object.entries(weights || {})
    .filter(([, value]) => Number(value || 0) > 0)
    .map(([label, value]) => ({
      label,
      estimate: Math.max(1, Math.round(Number(value || 0) * peopleCount * 10))
    }));
}

export function getCaseMatchingRuleLoadStatus() {
  return { loaded: false, source: "regression-shim", error: null };
}

export function getCaseMatchingRules() {
  return null;
}

export function getClosetRules() {
  return {
    demandByLabel: new Map(),
    functionZoneByType: new Map(),
    tierByKey: new Map(),
    componentMapping: [],
    tierRows: [],
    pricingByKey: new Map()
  };
}

export function getPlanPriceFromRules(budgetRange = "", planType = "basic") {
  const range = parseBudgetRange(budgetRange);
  const price = planType === "basic"
    ? Math.max(range.min + 600, range.max - 500)
    : planType === "value"
      ? range.max + 400
      : range.max + 950;
  return {
    min: range.min,
    max: range.max,
    minPrice: range.min,
    maxPrice: range.max,
    price: Math.round(price / 100) * 100
  };
}

export function getPlanTier(planType = "basic") {
  return PLAN_TIER[planType] || PLAN_TIER.basic;
}

export function getZoneUiKeyForDemand(label = "") {
  if (label === "鞋子") return "shoeZone";
  if (label === "裤子") return "trouserZone";
  if (label === "首饰") return "jewelryZone";
  if (label === "长衣") return "longHangZone";
  if (label === "短衣") return "shortHangZone";
  if (["被褥", "行李箱", "包包", "综合收纳"].includes(label)) return "storageZone";
  return "storageZone";
}

function parseBudgetRange(label) {
  const values = String(label || "").match(/[\\d,]+/g)?.map((value) => Number(value.replace(/,/g, ""))) || [];
  if (String(label || "").includes("以下")) return { min: 0, max: values[0] || 3000 };
  if (String(label || "").includes("以上")) {
    const min = values[0] || 4000;
    return { min, max: Math.round(min * 1.25), openEnded: true };
  }
  return { min: values[0] || 0, max: values[1] || values[0] || 4000 };
}
`;
}

function parseArgs(args) {
  const maxArg = args.find((arg) => arg.startsWith("--max-scenarios="));
  const maxScenarios = maxArg ? Number(maxArg.split("=")[1]) : 0;
  return {
    maxScenarios: Number.isFinite(maxScenarios) && maxScenarios > 0 ? maxScenarios : 0,
    verbose: args.includes("--verbose")
  };
}

function buildScenarios(maxScenarios = 0) {
  const widths = [2400, 3000, 3600, 4200];
  const depths = [600, 2000];
  const budgets = [
    { key: "under3000", label: "3,000以下" },
    { key: "3000to4000", label: "3,000 - 4,000" },
    { key: "above4000", label: "4,000以上" }
  ];
  const levels = [
    { key: "0", value: 0 },
    { key: "medium", value: 2 },
    { key: "max", value: 3 }
  ];
  const scenarios = [];

  for (const roomWidth of widths) {
    for (const roomDepth of depths) {
      for (const budget of budgets) {
        for (const shoes of levels) {
          for (const hanging of levels) {
            for (const trousers of levels) {
              for (const jewelry of levels) {
                for (const storage of levels) {
                  scenarios.push({
                    roomWidth,
                    roomDepth,
                    budgetKey: budget.key,
                    budgetRange: budget.label,
                    shoes: shoes.key,
                    hanging: hanging.key,
                    trousers: trousers.key,
                    jewelry: jewelry.key,
                    storage: storage.key,
                    needs: {
                      "鞋子": shoes.value,
                      "短衣": hanging.value,
                      "长衣": hanging.value,
                      "裤子": trousers.value,
                      "首饰": jewelry.value,
                      "被褥": storage.value,
                      "行李箱": storage.value,
                      "包包": storage.value,
                      "综合收纳": storage.value
                    }
                  });
                  if (maxScenarios && scenarios.length >= maxScenarios) return scenarios;
                }
              }
            }
          }
        }
      }
    }
  }

  return scenarios;
}

function runScenario(scenario) {
  const answers = buildAnswers(scenario);
  let plans = [];
  try {
    plans = generateRecommendedPlans(answers);
  } catch (error) {
    return {
      failures: [failure(scenario, "all", "", "generationError", null, { error: error.message })]
    };
  }

  const summaries = new Map(plans.map((plan) => [plan.planType, summarizePlan(plan)]));
  const failures = [];

  for (const planType of PLAN_TYPES) {
    const summary = summaries.get(planType);
    if (!summary) {
      failures.push(failure(scenario, planType, "", "missingPlan", null, {}));
      continue;
    }
    failures.push(...validateRailHeights(scenario, summary));
    failures.push(...validateRailCoverage(scenario, summary));
    if (planType === "premium") {
      failures.push(...validatePremiumShelfRules(scenario, summary));
    }
  }

  failures.push(...validateTierProgression(scenario, summaries));
  return { failures };
}

function buildAnswers(scenario) {
  return {
    selectedProductSystem: {
      id: "japanese-closet",
      seriesId: "japanese-closet",
      name: "日式立柱衣帽间"
    },
    dimensions: {
      layoutType: "I型",
      width: scenario.roomWidth,
      depth: scenario.roomDepth,
      height: 2700
    },
    roomWidth: scenario.roomWidth,
    roomDepth: scenario.roomDepth,
    roomHeight: 2700,
    layoutType: "I型",
    people: "2人",
    peopleCount: "2人",
    budget: scenario.budgetRange,
    budgetRange: scenario.budgetRange,
    needs: scenario.needs,
    demands: scenario.needs,
    demandsWeights: scenario.needs,
    needWeights: scenario.needs,
    spaceUse: "卧室收纳"
  };
}

function summarizePlan(plan) {
  const placements = (plan.configPreset?.explicitPlacements || [])
    .filter((placement) => placement && placement.componentType)
    .map((placement, index) => ({
      ...placement,
      regressionPlacementId: placement.id || placement.placementId || `${plan.planType}:${index}`
    }));
  const byBay = groupBy(placements, (placement) => Number(placement.bayIndex ?? 0));
  const baySummaries = [...byBay.entries()].map(([bayIndex, items]) => summarizeBay(bayIndex, items));
  return {
    planType: plan.planType,
    candidatePlanId: plan.candidatePlanId,
    price: plan.candidateDebug?.finalPlanPrice || plan.planPrice || 0,
    upgradeList: plan.candidateDebug?.[`${plan.planType}UpgradeList`] || [],
    placements,
    counts: countBy(placements, (placement) => placement.componentType),
    baySummaries
  };
}

function summarizeBay(bayIndex, placements) {
  const sorted = [...placements].sort((left, right) => (
    String(left.componentType).localeCompare(String(right.componentType))
    || Number(left.heightFromFloor || 0) - Number(right.heightFromFloor || 0)
  ));
  return {
    bayIndex,
    role: firstValue(sorted, "role"),
    templateRole: firstValue(sorted, "templateRole"),
    zoneType: firstValue(sorted, "zoneType"),
    components: sorted.map(componentLabel),
    shoeShelfCount: sorted.filter(isShoeShelf).length,
    functionalShelfCount: sorted.filter(isFunctionalShelf).length,
    railCount: sorted.filter(isRail).length,
    lowerFunctionalCount: sorted.filter(isLowerFunctionalComponent).length,
    placements: sorted
  };
}

function validateRailHeights(scenario, summary) {
  return summary.placements
    .filter(isRail)
    .filter((rail) => !isAllowedRailHeight(rail.heightFromFloor))
    .map((rail) => failure(
      scenario,
      summary.planType,
      summary.candidatePlanId,
      "invalidRailHeight",
      rail.bayIndex,
      {
        heightFromFloor: rail.heightFromFloor,
        relevantComponents: getBayComponents(summary, rail.bayIndex)
      }
    ));
}

function validateRailCoverage(scenario, summary) {
  const railIds = new Map();
  const duplicates = [];
  const uncovered = [];

  summary.placements.filter(isRail).forEach((rail) => {
    const railId = getRailSourceId(rail);
    const visualCategory = getRailVisualCategory(rail, summary);
    if (!visualCategory) uncovered.push(rail);
    railIds.set(railId, (railIds.get(railId) || 0) + 1);
  });

  railIds.forEach((count, railId) => {
    if (count > 1) duplicates.push({ railId, count });
  });

  return [
    ...uncovered.map((rail) => failure(
      scenario,
      summary.planType,
      summary.candidatePlanId,
      "uncoveredRail",
      rail.bayIndex,
      {
        heightFromFloor: rail.heightFromFloor,
        componentType: rail.componentType,
        relevantComponents: getBayComponents(summary, rail.bayIndex)
      }
    )),
    ...duplicates.map((duplicate) => failure(
      scenario,
      summary.planType,
      summary.candidatePlanId,
      "duplicateClothingVisualSource",
      null,
      duplicate
    ))
  ];
}

function validateTierProgression(scenario, summaries) {
  const failures = [];
  const basic = summaries.get("basic");
  const value = summaries.get("value");
  const premium = summaries.get("premium");

  if (basic && value) {
    if (completenessScore(value) + 0.01 < completenessScore(basic)) {
      failures.push(failure(scenario, "value", value.candidatePlanId, "valueLessCompleteThanBasic", null, {
        basicScore: completenessScore(basic),
        valueScore: completenessScore(value)
      }));
    }
    failures.push(...validateUpperRailPreservation(scenario, basic, value));
  }

  if (value && premium) {
    if (completenessScore(premium) + 0.01 < completenessScore(value)) {
      failures.push(failure(scenario, "premium", premium.candidatePlanId, "premiumLessCompleteThanValue", null, {
        valueScore: completenessScore(value),
        premiumScore: completenessScore(premium)
      }));
    }
    if (isHighDemand(scenario.shoes) && shoeShelfCount(premium) < shoeShelfCount(value) && !hasEquivalentShoeStorage(premium)) {
      failures.push(failure(scenario, "premium", premium.candidatePlanId, "premiumShoeShelfCountLowerThanValue", null, {
        valueShoeShelves: shoeShelfCount(value),
        premiumShoeShelves: shoeShelfCount(premium)
      }));
    }
    if (
      functionalShelfCount(premium) < functionalShelfCount(value)
      && lowerFunctionalCount(premium) <= lowerFunctionalCount(value)
    ) {
      failures.push(failure(scenario, "premium", premium.candidatePlanId, "premiumFunctionalShelfCountLowerThanValue", null, {
        valueFunctionalShelves: functionalShelfCount(value),
        premiumFunctionalShelves: functionalShelfCount(premium),
        valueLowerFunctionalComponents: lowerFunctionalCount(value),
        premiumLowerFunctionalComponents: lowerFunctionalCount(premium)
      }));
    }
    failures.push(...validateUpperRailPreservation(scenario, value, premium));
    failures.push(...validateFunctionalShelfPreservation(scenario, value, premium));
  }

  return failures;
}

function validateUpperRailPreservation(scenario, lowerTier, higherTier) {
  const failures = [];
  lowerTier.baySummaries.forEach((lowerBay) => {
    if (!hasHighRail(lowerBay.placements)) return;
    const higherBay = getBay(higherTier, lowerBay.bayIndex);
    if (higherBay && hasHighRail(higherBay.placements)) return;
    if (higherBay && hasPhysicalBlockerForHighRail(higherBay.placements)) return;
    if (higherBay && isValidHighDemandShoeShelfReplacement(scenario, lowerBay, higherBay)) return;
    if (higherBay && isValidNoShoeShelfStorageConversion(scenario, lowerBay, higherBay)) return;
    failures.push(failure(
      scenario,
      higherTier.planType,
      higherTier.candidatePlanId,
      "upperRail2000NotPreserved",
      lowerBay.bayIndex,
      {
        previousTier: lowerTier.planType,
        previousComponents: lowerBay.components,
        currentComponents: higherBay?.components || []
      }
    ));
  });
  return failures;
}

function isValidHighDemandShoeShelfReplacement(scenario, lowerBay, higherBay) {
  if (!isShoeOrLongHangOrShoeBay(lowerBay) && !isShoeOrLongHangOrShoeBay(higherBay)) return false;
  if (!hasHighShoeOrBagStorageDemand(scenario)) return false;
  return shoeBagShelfCapacity(higherBay.placements) > shoeBagShelfCapacity(lowerBay.placements);
}

function isValidNoShoeShelfStorageConversion(scenario, lowerBay, higherBay) {
  if (scenario.shoes !== "0") return false;
  if (!isShoeOrLongHangOrShoeBay(lowerBay) && !isShoeOrLongHangOrShoeBay(higherBay)) return false;
  if (hasHangingRole(higherBay)) return false;
  return shoeBagShelfCapacity(higherBay.placements) > shoeBagShelfCapacity(lowerBay.placements);
}

function validateFunctionalShelfPreservation(scenario, lowerTier, higherTier) {
  const failures = [];
  lowerTier.baySummaries.forEach((lowerBay) => {
    if (!hasLowerRail(lowerBay.placements) || !hasHighRail(lowerBay.placements)) return;
    const lowerFunctionalShelves = lowerBay.placements.filter(isLowerZoneFunctionalShelf);
    if (!lowerFunctionalShelves.length) return;

    const higherBay = getBay(higherTier, lowerBay.bayIndex);
    if (!higherBay || !hasHighRail(higherBay.placements)) return;
    if (!higherBay.placements.some(isLowerFunctionalComponent)) return;

    lowerFunctionalShelves.forEach((shelf) => {
      const preserved = higherBay.placements.some((placement) => (
        placement.componentType === "woodShelf"
        && Math.abs(Number(placement.heightFromFloor || 0) - Number(shelf.heightFromFloor || 0)) <= 80
      ));
      if (!preserved) {
        failures.push(failure(
          scenario,
          higherTier.planType,
          higherTier.candidatePlanId,
          "functionalShelfAboveLowerZoneNotPreserved",
          lowerBay.bayIndex,
          {
            previousTier: lowerTier.planType,
            shelfHeight: shelf.heightFromFloor,
            previousComponents: lowerBay.components,
            currentComponents: higherBay.components
          }
        ));
      }
    });
  });
  return failures;
}

function validatePremiumShelfRules(scenario, summary) {
  const failures = [];
  summary.baySummaries.forEach((bay) => {
    const premiumShelves = bay.placements.filter(isPremiumFunctionalShelf);
    if (!premiumShelves.length) return;

    const hasOnlyHighRail = hasHighRail(bay.placements)
      && !hasLowerRail(bay.placements)
      && !bay.placements.some(isLowerFunctionalComponent);
    if (hasOnlyHighRail) {
      failures.push(failure(
        scenario,
        summary.planType,
        summary.candidatePlanId,
        "premiumFunctionalShelfIn2000OnlyBay",
        bay.bayIndex,
        { relevantComponents: bay.components }
      ));
    }

    if (isPureShoeShelfBay(bay)) {
      failures.push(failure(
        scenario,
        summary.planType,
        summary.candidatePlanId,
        "premiumFunctionalShelfInPureShoeShelfZone",
        bay.bayIndex,
        { relevantComponents: bay.components }
      ));
    }

    const lowerFunctionalZones = countLowerFunctionalZones(bay.placements);
    if (premiumShelves.length > Math.max(1, lowerFunctionalZones)) {
      failures.push(failure(
        scenario,
        summary.planType,
        summary.candidatePlanId,
        "tooManyPremiumFunctionalShelves",
        bay.bayIndex,
        {
          premiumFunctionalShelfCount: premiumShelves.length,
          lowerFunctionalZones,
          relevantComponents: bay.components
        }
      ));
    }
  });
  return failures;
}

function printReport(report) {
  output("Japanese AI Planner regression");
  output(`total scenarios tested: ${report.totalScenarios}`);
  output(`passed count: ${report.passed}`);
  output(`failed count: ${report.failed}`);
  output(`first ${MAX_FAILURE_DETAILS} failures:`);
  if (!report.failures.length) {
    output("  none");
    return;
  }
  report.failures.forEach((item, index) => {
    output(`${index + 1}. ${item.reason}`);
    output(`   input: ${formatScenario(item.scenario)}`);
    output(`   planType: ${item.planType}`);
    output(`   candidatePlanId: ${item.candidatePlanId || "n/a"}`);
    output(`   bayIndex: ${item.bayIndex ?? "n/a"}`);
    output(`   relevant components: ${formatDetails(item.details)}`);
  });
}

function failure(scenario, planType, candidatePlanId, reason, bayIndex, details = {}) {
  return {
    scenario: compactScenario(scenario),
    planType,
    candidatePlanId,
    reason,
    bayIndex,
    details
  };
}

function compactScenario(scenario) {
  return {
    width: scenario.roomWidth,
    depth: scenario.roomDepth,
    budget: scenario.budgetKey,
    shoes: scenario.shoes,
    hanging: scenario.hanging,
    trousers: scenario.trousers,
    jewelry: scenario.jewelry,
    storage: scenario.storage
  };
}

function formatScenario(scenario) {
  return Object.entries(scenario).map(([key, value]) => `${key}=${value}`).join(", ");
}

function formatDetails(details = {}) {
  if (Array.isArray(details.relevantComponents)) return details.relevantComponents.join(", ");
  return JSON.stringify(details);
}

function groupBy(items, getKey) {
  const result = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  });
  return result;
}

function countBy(items, getKey) {
  return items.reduce((result, item) => {
    const key = getKey(item);
    if (key != null && key !== "") result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function firstValue(items, key) {
  return items.find((item) => item[key])?.[key] || "";
}

function getBay(summary, bayIndex) {
  return summary.baySummaries.find((bay) => Number(bay.bayIndex) === Number(bayIndex));
}

function getBayComponents(summary, bayIndex) {
  return getBay(summary, bayIndex)?.components || [];
}

function componentLabel(placement) {
  return `${placement.componentType}@${Number(placement.heightFromFloor || 0)}`
    + `:${placement.templateRole || placement.role || placement.zoneType || "unknown"}`;
}

function isRail(placement) {
  return RAIL_TYPES.has(placement.componentType);
}

function isAllowedRailHeight(height) {
  const value = Number(height || 0);
  return (value >= 850 && value <= 1250) || (value >= 1850 && value <= 2150);
}

function getRailSourceId(rail) {
  return rail.sourcePlacementId || rail.id || rail.placementId || rail.regressionPlacementId;
}

function getRailVisualCategory(rail, summary) {
  const height = Number(rail.heightFromFloor || 0);
  if (!isAllowedRailHeight(height)) return "";
  if (height >= 1850) {
    const bay = getBay(summary, rail.bayIndex);
    return bay?.placements.some(hasShortHangRole) ? "shortHang" : "longHang";
  }
  return "shortHang";
}

function hasShortHangRole(placement) {
  return [placement.templateRole, placement.role, placement.zoneType]
    .some((value) => String(value || "").includes("shortHang"));
}

function isShoeShelf(placement) {
  if (SHOE_STORAGE_TYPES.has(placement.componentType)) return true;
  return placement.componentType === "woodShelf"
    && [placement.templateRole, placement.role, placement.zoneType]
      .some((value) => ["shoeShelfZone", "shoeZone"].includes(value));
}

function isFunctionalShelf(placement) {
  return placement.componentType === "woodShelf" && !isShoeShelf(placement);
}

function isLowerZoneFunctionalShelf(placement) {
  const height = Number(placement.heightFromFloor || 0);
  return isFunctionalShelf(placement) && height >= 1050 && height <= 1450;
}

function isLowerFunctionalComponent(placement) {
  return LOWER_FUNCTIONAL_TYPES.has(placement.componentType);
}

function isPremiumFunctionalShelf(placement) {
  return placement.componentType === "woodShelf"
    && Boolean(
      placement.isPremiumHangingShelfUpgrade
      || placement.isPremiumFunctionalShelf
      || placement.premiumFunctionalShelf
      || placement.premiumShelfStrategy
      || placement.associatedLowerFeature
    );
}

function isPureShoeShelfBay(bay) {
  const roleValues = getBayRoleValues(bay);
  const hasShoeRole = [...roleValues].some((value) => ["shoeShelfZone", "shoeZone"].includes(value));
  const hasHangingRole = [...roleValues].some((value) => /shortHang|longHang|trouser/.test(String(value)));
  return hasShoeRole && !hasHangingRole;
}

function isShoeOrLongHangOrShoeBay(bay) {
  const roleValues = getBayRoleValues(bay);
  return [...roleValues].some((value) => (
    ["shoeShelfZone", "shoeZone", "longHangOrShoeZone"].includes(value)
  ));
}

function hasHangingRole(bay) {
  return [...getBayRoleValues(bay)].some((value) => /shortHang|longHang|trouser/.test(String(value || "")));
}

function getBayRoleValues(bay) {
  return new Set((bay?.placements || []).flatMap((placement) => [
    placement.sourceRole,
    placement.templateZone,
    placement.templateRole,
    placement.role,
    placement.zoneType
  ].filter(Boolean)));
}

function hasHighRail(placements) {
  return placements.some((placement) => isRail(placement) && Number(placement.heightFromFloor || 0) >= 1850);
}

function hasLowerRail(placements) {
  return placements.some((placement) => isRail(placement) && Number(placement.heightFromFloor || 0) >= 850
    && Number(placement.heightFromFloor || 0) <= 1250);
}

function hasPhysicalBlockerForHighRail(placements) {
  return placements.some((placement) => (
    TALL_BLOCKING_TYPES.has(placement.componentType)
    && Number(placement.heightFromFloor || 0) >= 1200
  ));
}

function countLowerFunctionalZones(placements) {
  const lowerRailZone = hasLowerRail(placements) ? 1 : 0;
  const componentZones = placements.filter(isLowerFunctionalComponent).length;
  return lowerRailZone + componentZones;
}

function shoeShelfCount(summary) {
  return summary.baySummaries.reduce((sum, bay) => sum + bay.shoeShelfCount, 0);
}

function functionalShelfCount(summary) {
  return summary.baySummaries.reduce((sum, bay) => sum + bay.functionalShelfCount, 0);
}

function lowerFunctionalCount(summary) {
  return summary.baySummaries.reduce((sum, bay) => sum + bay.lowerFunctionalCount, 0);
}

function hasEquivalentShoeStorage(summary) {
  return summary.placements.some((placement) => SHOE_STORAGE_TYPES.has(placement.componentType));
}

function isHighDemand(level) {
  return level === "medium" || level === "max";
}

function hasHighShoeOrBagStorageDemand(scenario) {
  return scenario.shoes === "max" || scenario.storage === "max";
}

function shoeBagShelfCapacity(placements) {
  return placements.filter((placement) => {
    if (SHOE_STORAGE_TYPES.has(placement.componentType)) return true;
    if (placement.componentType !== "woodShelf") return false;
    return [placement.sourceRole, placement.templateZone, placement.templateRole, placement.role, placement.zoneType]
      .some((value) => /shoe|bag|luggage|storage/i.test(String(value || "")));
  }).length;
}

function completenessScore(summary) {
  return summary.placements.reduce((score, placement) => {
    if (isRail(placement)) return score + (placement.componentType === "doubleRail" ? 1.2 : 1);
    if (isShoeShelf(placement)) return score + 0.7;
    if (isFunctionalShelf(placement)) return score + 0.8;
    if (isLowerFunctionalComponent(placement)) return score + 1.5;
    if (placement.componentType === "cabinet") return score + 1.2;
    return score + 0.5;
  }, 0);
}
