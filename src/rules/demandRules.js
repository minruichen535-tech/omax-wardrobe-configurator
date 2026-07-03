import * as XLSX from "xlsx";
import { DEFAULT_BAY_WIDTH, DEFAULT_ZONE_PRIORITY, PLAN_LEVELS } from "./commonRules.js?v=closet-rules-preview-20260621-11";

const RULES_URL = "/data/closet-rules.xlsx";
const CASE_MATCHING_RULES_URL = "/customer-home/case/CaseMatchingRules.xlsx";
let rulesPromise = null;
let rulesData = null;
let caseMatchingRulesPromise = null;
let caseMatchingRulesData = null;
let caseMatchingRuleLoadStatus = {
  attempted: false,
  loaded: false,
  error: null,
  fallbackToLegacy: true
};

export function loadClosetRules(url = RULES_URL) {
  if (!rulesPromise) {
    rulesPromise = fetch(`${url}?v=20260621-05`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${url}`);
        return response.arrayBuffer();
      })
      .then(parseRulesWorkbook)
      .then((data) => {
        rulesData = data;
        return data;
      });
  }
  return rulesPromise;
}

export function getClosetRules() {
  if (!rulesData) throw new Error("Closet rules have not been loaded.");
  return rulesData;
}

export function loadCaseMatchingRules(url = CASE_MATCHING_RULES_URL) {
  if (!caseMatchingRulesPromise) {
    caseMatchingRuleLoadStatus = {
      attempted: true,
      loaded: false,
      error: null,
      fallbackToLegacy: true
    };
    caseMatchingRulesPromise = fetch(`${url}?v=component-upgrade-rules-20260627-01`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${url}`);
        return response.arrayBuffer();
      })
      .then(parseCaseMatchingRulesWorkbook)
      .then((data) => {
        caseMatchingRulesData = data;
        caseMatchingRuleLoadStatus = {
          attempted: true,
          loaded: data.enabled === true,
          error: null,
          fallbackToLegacy: data.enabled !== true
        };
        return data;
      })
      .catch((error) => {
        console.warn("[ai-planner] optional CaseMatchingRules load failed", error);
        caseMatchingRulesData = createCaseMatchingRulesFallback(error);
        caseMatchingRuleLoadStatus = {
          attempted: true,
          loaded: false,
          error: error?.message || String(error),
          fallbackToLegacy: true
        };
        return caseMatchingRulesData;
      });
  }
  return caseMatchingRulesPromise;
}

export function getCaseMatchingRules() {
  return caseMatchingRulesData;
}

export function getCaseMatchingRuleLoadStatus() {
  return { ...caseMatchingRuleLoadStatus };
}

export function resolveDemandRule(label) {
  return getClosetRules().demandByLabel.get(String(label || "").trim()) || null;
}

export function getZoneUiKeyForDemand(label) {
  const demand = resolveDemandRule(label);
  const zone = demand ? getClosetRules().functionZoneByType.get(demand.zoneType) : null;
  return zone?.uiKey || "";
}

export function estimateDemandItems(demandWeights = {}, peopleCount = "1人") {
  const people = parsePeopleCount(peopleCount);
  return Object.entries(demandWeights)
    .map(([label, weight]) => {
      const rule = resolveDemandRule(label);
      const normalizedWeight = clampWeight(weight);
      if (!rule || normalizedWeight <= 0) return null;
      const factor = number(rule[`weightFactor${normalizedWeight}`], 1);
      const quantity = roundQuantity(number(rule.baseQuantityPerPerson, 0) * people * factor);
      return {
        label,
        itemType: rule.itemType,
        zoneType: rule.zoneType,
        priority: number(rule.priority, 0),
        quantity,
        unit: rule.unit || "件",
        estimate: `约 ${formatQuantity(quantity)}${rule.unit || "件"}`,
        weight: normalizedWeight
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.weight - a.weight) || (b.priority - a.priority));
}

export function calculateDemandZoneLengths(demandWeights = {}, peopleCount = "1人", planType = "") {
  const data = getClosetRules();
  const demandItems = estimateDemandItems(demandWeights, peopleCount);
  return demandItems.map((item) => {
    const zone = data.functionZoneByType.get(item.zoneType);
    const tier = planType ? data.tierByKey.get(`${planType}:${item.zoneType}`) : null;
    if (tier && (!parseBooleanDefaultTrue(tier.enabled) || item.weight < number(tier.minDemandWeight, 1))) return null;
    const componentType = tier?.preferredComponent || zone?.preferredComponent || "NONE";
    const allowedComponents = data.componentMapping
      .filter((mapping) => mapping.zoneType === item.zoneType)
      .map((mapping) => mapping.allowedComponent);
    const capacityRule = findCapacityRule(data, componentType, item.itemType);
    const capacity = Math.max(0.0001, number(capacityRule?.capacity, 1));
    const quantityFactor = tier ? number(tier.quantityFactor, PLAN_LEVELS[planType] || 1) : 1;
    const uncappedUnits = Math.max(1, Math.ceil((item.quantity * quantityFactor) / capacity));
    const maxQuantity = tier ? number(tier.maxQuantity, uncappedUnits) : uncappedUnits;
    const requiredUnits = Math.max(1, Math.min(uncappedUnits, maxQuantity));
    const zoneLengthMm = number(capacityRule?.zoneLengthMm, DEFAULT_BAY_WIDTH);
    return {
      ...item,
      zoneType: zone?.zoneType || item.zoneType,
      uiKey: zone?.uiKey || item.zoneType,
      storageType: zone?.storageType || componentType,
      componentType,
      allowedComponents,
      capacity,
      quantityFactor,
      requiredUnits,
      requiredLength: requiredUnits * zoneLengthMm,
      lighting: parseBoolean(tier?.lighting),
      minBudgetForLighting: number(tier?.minBudgetForLighting, 0),
      clearHeight: number(zone?.clearHeight, 0),
      idealClearHeight: number(zone?.idealClearHeight, 0),
      exclusiveBay: parseBoolean(zone?.exclusiveBay),
      railHeights: String(zone?.railHeights || "").split("|").map(Number).filter(Number.isFinite),
      priorityIndex: getZonePriority(item.zoneType)
    };
  }).filter(Boolean).sort((a, b) => a.priorityIndex - b.priorityIndex || b.weight - a.weight);
}

export function calculateDemandZoneProfile(demandWeights = {}, peopleCount = "1人") {
  const zones = calculateDemandZoneLengths(demandWeights, peopleCount);
  const scores = new Map();
  zones.forEach((zone) => scores.set(zone.uiKey, (scores.get(zone.uiKey) || 0) + zone.requiredLength));
  const total = Array.from(scores.values()).reduce((sum, value) => sum + value, 0);
  if (!total) return {};
  const profile = Object.fromEntries(Array.from(scores, ([key, value]) => [key, Math.round((value / total) * 100)]));
  const firstKey = Object.keys(profile)[0];
  profile[firstKey] += 100 - Object.values(profile).reduce((sum, value) => sum + value, 0);
  return profile;
}

export function buildPlanRuleOutput(demandWeights = {}, peopleCount = "1人", planType = "basic") {
  const zones = calculateDemandZoneLengths(demandWeights, peopleCount, planType);
  const componentQuantities = {};
  const reservedZones = [];
  zones.forEach((zone) => {
    if (zone.componentType === "NONE") {
      reservedZones.push({ zoneType: zone.zoneType, length: zone.requiredLength });
      return;
    }
    componentQuantities[zone.componentType] = (componentQuantities[zone.componentType] || 0) + zone.requiredUnits;
  });
  return {
    planType,
    coverage: PLAN_LEVELS[planType] || 1,
    zones,
    componentQuantities,
    reservedZones,
    lighting: zones.some((zone) => zone.lighting),
    minBudgetForLighting: Math.max(0, ...zones.filter((zone) => zone.lighting).map((zone) => zone.minBudgetForLighting)),
    capacity: zones.map((zone) => ({
      label: zone.label,
      itemType: zone.itemType,
      quantity: roundQuantity(zone.capacity * zone.requiredUnits),
      unit: zone.unit,
      estimate: `约 ${formatQuantity(roundQuantity(zone.capacity * zone.requiredUnits))}${zone.unit}`
    }))
  };
}

export function getPlanTier(planType) {
  const rows = getClosetRules().tierRows.filter((row) => row.planType === planType);
  return {
    planType,
    planName: rows[0]?.planName || planType,
    coverage: PLAN_LEVELS[planType] || 1
  };
}

export function getPlanPriceFromRules(budgetRange, planType) {
  const row = getClosetRules().pricingByKey.get(`${budgetRange}:${planType}`);
  if (!row) return { min: 0, max: 0, price: 0 };
  const min = number(row.minPrice, 0);
  const max = number(row.maxPrice, min);
  return { min, max, price: Math.round(((min + max) / 2) / 100) * 100 };
}

function parseRulesWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const demandPriorities = rows(workbook, "Demand Priorities");
  const capacityRules = rows(workbook, "Capacity Rules");
  const functionZones = rows(workbook, "Function Zones");
  const componentMapping = rows(workbook, "Component Mapping");
  const tierRows = rows(workbook, "Plan Tier Preferences");
  const storageStandards = rows(workbook, "Storage Standards");
  const pricingRows = rows(workbook, "Plan Pricing");
  const demandByLabel = new Map();
  demandPriorities.forEach((rule) => {
    [rule.displayName, ...(String(rule.aliases || "").split("|").filter(Boolean))]
      .forEach((label) => demandByLabel.set(String(label).trim(), rule));
  });
  return {
    demandPriorities,
    demandByLabel,
    capacityRules,
    functionZones,
    functionZoneByType: new Map(functionZones.map((row) => [row.zoneType, row])),
    componentMapping,
    tierRows,
    tierByKey: new Map(tierRows.map((row) => [`${row.planType}:${row.zoneType}`, row])),
    storageStandards,
    storageByType: new Map(storageStandards.map((row) => [row.storageType, row])),
    pricingRows,
    pricingByKey: new Map(pricingRows.map((row) => [`${row.budgetRange}:${row.planType}`, row]))
  };
}

function parseCaseMatchingRulesWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const caseProfiles = optionalRows(workbook, "CaseProfile").map(normalizeCaseProfileRow)
    .filter((row) => row.caseId);
  const caseTags = optionalRows(workbook, "CaseTags").map(normalizeCaseTagRow)
    .filter((row) => row.caseId);
  const componentUpgradeRules = optionalRows(workbook, "ComponentUpgradeRules")
    .map(normalizeComponentUpgradeRuleRow)
    .filter((row) => row.upgradeAction);
  const componentCapability = optionalRows(workbook, "ComponentCapability");
  const readme = optionalRows(workbook, "README");
  return {
    enabled: caseProfiles.length > 0,
    source: "CaseMatchingRules.xlsx",
    loadedSheets: workbook.SheetNames.filter((sheetName) => [
      "README",
      "CaseProfile",
      "CaseTags",
      "ComponentUpgradeRules",
      "ComponentCapability"
    ].includes(sheetName)),
    caseProfiles,
    caseProfileById: new Map(caseProfiles.map((row) => [row.caseId, row])),
    caseTags,
    caseTagsById: new Map(caseTags.map((row) => [row.caseId, row])),
    componentUpgradeRules,
    componentCapability,
    readme
  };
}

function createCaseMatchingRulesFallback(error) {
  return {
    enabled: false,
    source: "CaseMatchingRules.xlsx",
    loadedSheets: [],
    caseProfiles: [],
    caseProfileById: new Map(),
    caseTags: [],
    caseTagsById: new Map(),
    componentUpgradeRules: [],
    componentCapability: [],
    readme: [],
    error: error?.message || String(error || "")
  };
}

function normalizeCaseProfileRow(row) {
  return {
    ...row,
    caseId: stringValue(row.CaseID || row.caseId),
    persona: stringValue(row.PersonaName || row.persona),
    primaryType: stringValue(row.PrimaryType || row.primaryType),
    bayLayout: stringValue(row.BayLayout || row.bayLayout),
    bayCount: number(row.BayCount, 0),
    priorityTag: stringValue(row.PriorityTag || row.priorityTag),
    defaultTier: stringValue(row.DefaultTier || row.defaultTier),
    notes: stringValue(row.Notes || row.notes),
    scores: {
      shortClothes: number(row.ShortScore, 0),
      longClothes: number(row.LongScore, 0),
      shoes: number(row.ShoesScore, 0),
      bags: number(row.BagsScore, 0),
      bedding: number(row.BeddingScore, 0),
      luggage: number(row.LuggageScore, 0),
      jewelry: number(row.JewelryScore, 0),
      trouser: number(row.TrouserScore, 0)
    }
  };
}

function normalizeCaseTagRow(row) {
  return {
    ...row,
    caseId: stringValue(row.CaseID || row.caseId),
    tags: splitRuleList(row.Tags),
    avoidWhen: splitRuleList(row.AvoidWhen),
    priorityNote: stringValue(row.PriorityNote || row.priorityNote)
  };
}

function normalizeComponentUpgradeRuleRow(row) {
  return {
    ...row,
    upgradeAction: stringValue(row.UpgradeAction || row.upgradeAction),
    fromZone: stringValue(row.FromZone || row.fromZone),
    addComponent: stringValue(row["ToZone / AddComponent"] || row.ToZone || row.AddComponent || row.addComponent),
    condition: stringValue(row.Condition || row.condition),
    priority: number(row.Priority, 999),
    note: stringValue(row.Note || row.Notes || row.note),
    upgradeType: stringValue(row.UpgradeType || row.upgradeType),
    upgradeTarget: stringValue(row.UpgradeTarget || row.upgradeTarget),
    protectCoreRequirement: parseBoolean(row.ProtectCoreRequirement),
    maxCoreReplacement: number(row.MaxCoreReplacement, 0),
    maxReplaceRatio: number(row.MaxReplaceRatio, 0)
  };
}

function findCapacityRule(data, componentType, itemType) {
  return data.capacityRules.find((rule) => rule.componentType === componentType && rule.itemType === itemType)
    || data.capacityRules.find((rule) => rule.itemType === itemType)
    || null;
}

function rows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing rules sheet: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function optionalRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parsePeopleCount(value) {
  if (String(value).includes("4")) return 4;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clampWeight(value) {
  return Math.max(0, Math.min(3, Math.round(number(value, 0))));
}

function roundQuantity(value) {
  return Math.max(1, Math.round(value));
}

function formatQuantity(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function splitRuleList(value) {
  return stringValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseBoolean(value) {
  return value === true || ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseBooleanDefaultTrue(value) {
  if (value === "" || value == null) return true;
  return parseBoolean(value);
}

function getZonePriority(zoneType) {
  const index = DEFAULT_ZONE_PRIORITY.indexOf(zoneType);
  return index < 0 ? DEFAULT_ZONE_PRIORITY.length : index;
}
