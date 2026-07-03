const STORAGE_RULE_SOURCE = "/customer-home/rules/StorageRules.xlsx";

const RAW_STORAGE_RULE_SHEETS = Object.freeze({
  ItemCategory: [
    { item: "shortClothes", 中文: "短衣", unit: "件", visualAsset: "shortHang" },
    { item: "longClothes", 中文: "长衣", unit: "件", visualAsset: "longHang" },
    { item: "shoes", 中文: "鞋子", unit: "双", visualAsset: "shoePair" },
    { item: "bags", 中文: "包包", unit: "个", visualAsset: "bag" },
    { item: "bedding", 中文: "被褥", unit: "套", visualAsset: "bedding" },
    { item: "luggage", 中文: "行李箱", unit: "个", visualAsset: "luggage" },
    { item: "trousers", 中文: "裤子", unit: "条", visualAsset: "trouser" }
  ],
  PlacementRule: [
    { item: "shortClothes", priority: 1, targetComponent: "singleRail", result: "", targetPosition: "railCenter", condition: "shortHangClearanceOK", conditionValue: "", allowMultiple: "" },
    { item: "shortClothes", priority: 2, targetComponent: "doubleRail", result: "", targetPosition: "upperLowerRail", condition: "doubleHangClearanceOK", conditionValue: "", allowMultiple: "" },
    { item: "longClothes", priority: 1, targetComponent: "singleRail", result: "", targetPosition: "railCenter", condition: "clearanceBelow", conditionValue: 1350, allowMultiple: "" },
    { item: "trousers", priority: 1, targetComponent: "trouserRack", result: "", targetPosition: "rackCenter", condition: "clearanceBelow", conditionValue: 600, allowMultiple: "" },
    { item: "shoes", priority: 1, targetComponent: "woodShelf", result: "", targetPosition: "shelfTopCenter", condition: "shelfGap", conditionValue: 180, allowMultiple: "" },
    { item: "shoes", priority: 2, targetComponent: "floor", result: "", targetPosition: "bayFloorCenter", condition: "floorAvailable", conditionValue: "", allowMultiple: "" },
    { item: "bags", priority: 1, targetComponent: "woodShelf", result: "", targetPosition: "shelfTopCenter", condition: "highShelf", conditionValue: 1, allowMultiple: "" },
    { item: "bags", priority: 2, targetComponent: "cabinet", result: "", targetPosition: "cabinetTopCenter", condition: "noJewelryBoxOnCabinet", conditionValue: 1, allowMultiple: "" },
    { item: "bedding", priority: 1, targetComponent: "woodTop", result: "", targetPosition: "topCenter", condition: "topSpaceAvailable", conditionValue: 1, allowMultiple: "" },
    { item: "luggage", priority: 1, targetComponent: "floor", result: "", targetPosition: "bayFloorCenter", condition: "floorAvailable", conditionValue: 1, allowMultiple: "" },
    { item: "luggage", priority: 2, targetComponent: "woodTop", result: "", targetPosition: "topCenter", condition: "topSpaceAvailable", conditionValue: 1, allowMultiple: "" },
    { item: "jewelry", priority: 1, targetComponent: "jewelryBox", result: "", targetPosition: "cabinetTop", condition: "cabinetExists", conditionValue: "", allowMultiple: "" },
    { item: "trousers", priority: 1, targetComponent: "trouserRack", result: "", targetPosition: "rackCenter", condition: "clearanceBelow", conditionValue: 600, allowMultiple: "" },
    { item: "longClothes", priority: 1, targetComponent: "singleRail", result: "", targetPosition: "railCenter", condition: "clearanceBelow", conditionValue: 1350, allowMultiple: "" }
  ],
  ConflictRule: [
    { item: "bags", conflictWith: "jewelryBox", rule: "bagCannotUseCabinetTop", allowMultiple: "" },
    { item: "shoes", conflictWith: "cabinet", rule: "cannotOverlap", allowMultiple: "" },
    { item: "bedding", conflictWith: "luggage", rule: "canShareTopIfSpaceEnough", allowMultiple: "" },
    { item: "longClothes", conflictWith: "shelf", rule: "shelfCannotEnterClearance", allowMultiple: 1 },
    { item: "trousers", conflictWith: "cabinet", rule: "cabinetCannotEnter600Clearance", allowMultiple: 1 },
    { item: "bags", conflictWith: "woodTop", rule: "bagCannotUseWoodTop", allowMultiple: 1 },
    { item: "bedding", conflictWith: "cabinetTop", rule: "beddingOnlyOnWoodTop", allowMultiple: "" },
    { item: "shoes", conflictWith: "woodTop", rule: "shoesCannotUseWoodTop", allowMultiple: "" },
    { item: "jewelry", conflictWith: "bags", rule: "jewelryBoxPriorityHigherThanBag", allowMultiple: 0 },
    { item: "trousers", conflictWith: "jewelryBox", rule: "avoidSameBay", allowMultiple: "" },
    { item: "trousers", conflictWith: "woodShelf", rule: "cannotEnter600Clearance", allowMultiple: "" }
  ],
  ClearanceRule: [
    { component: "longClothes", clearanceType: "below", minValue: 1350, note: "长衣下方净空" },
    { component: "trouserRack", clearanceType: "below", minValue: 600, note: "裤架下方净空" },
    { component: "shoeShelf", clearanceType: "verticalGap", minValue: 250, note: "鞋层板间距" },
    { component: "shortHang", clearanceType: "below", minValue: 700, note: "短衣基础下垂空间" }
  ],
  VisualRule: [
    { item: "shortClothes", visual: "shortHang", quantityRule: "ceil(count/20)" },
    { item: "longClothes", visual: "longHang", quantityRule: "ceil(count/4)" },
    { item: "shoes", visual: "shoePair", quantityRule: "ceil(count/2)" },
    { item: "luggage", visual: "luggage", quantityRule: "count" },
    { item: "bedding", visual: "bedding", quantityRule: "count" }
  ],
  ComponentCapability: [
    { component: "singleRail", supports: "shortClothes,longClothes" },
    { component: "doubleRail", supports: "shortClothes" },
    { component: "trouserRack", supports: "trousers" },
    { component: "woodShelf", supports: "shoes,bags" },
    { component: "cabinet", supports: "jewelry,bags" },
    { component: "woodTop", supports: "bedding,luggage" }
  ]
});

const REQUIRED_SHEETS = Object.freeze([
  "ItemCategory",
  "PlacementRule",
  "ConflictRule",
  "ClearanceRule",
  "VisualRule"
]);

let storageRulesCache = null;
let storageRulesPromise = null;

export function loadStorageRules(url = STORAGE_RULE_SOURCE) {
  if (!storageRulesPromise) {
    const version = getStorageRulesVersion();
    storageRulesPromise = fetch(`${url}?v=${encodeURIComponent(version)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${url}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(parseStorageRulesWorkbook)
      .then((sheets) => {
        storageRulesCache = normalizeStorageRules(sheets, []);
        return storageRulesCache;
      })
      .catch((error) => {
        storageRulesCache = normalizeStorageRules(RAW_STORAGE_RULE_SHEETS, [
          `xlsx parse fallback: ${error.message}`
        ]);
        console.warn("[ai-planner] storage-rules-fallback", {
          source: url,
          reason: error.message
        });
        return storageRulesCache;
      });
  }
  return storageRulesPromise;
}

export function getStorageRules() {
  if (!storageRulesCache) storageRulesCache = normalizeStorageRules(RAW_STORAGE_RULE_SHEETS);
  return storageRulesCache;
}

export function getStorageRulesDebug() {
  const rules = getStorageRules();
  return {
    storageRulesLoaded: rules.loaded,
    storageRulesSource: rules.source,
    loadedSheets: rules.loadedSheets,
    ruleCountBySheet: rules.ruleCountBySheet,
    parseWarnings: rules.parseWarnings
  };
}

export function getPlacementRulesForItem(item) {
  const normalizedItem = normalizeKey(item);
  return getStorageRules().placementRules
    .filter((rule) => normalizeKey(rule.item) === normalizedItem)
    .sort((a, b) => number(a.priority, 999) - number(b.priority, 999));
}

export function getConflictRulesForItem(item) {
  const normalizedItem = normalizeKey(item);
  return getStorageRules().conflictRules
    .filter((rule) => normalizeKey(rule.item) === normalizedItem);
}

export function getClearanceValue(component, clearanceType, fallbackValue = 0) {
  const normalizedComponent = normalizeKey(component);
  const normalizedType = normalizeKey(clearanceType);
  const rule = getStorageRules().clearanceRules.find((item) => (
    normalizeKey(item.component) === normalizedComponent
    && normalizeKey(item.clearanceType) === normalizedType
  ));
  return number(rule?.minValue, fallbackValue);
}

export function getVisualRuleForItem(item) {
  const normalizedItem = normalizeKey(item);
  return getStorageRules().visualRules.find((rule) => normalizeKey(rule.item) === normalizedItem) || null;
}

export function getVisualRequiredCount(item, requestedCount, fallbackCapacity = 1) {
  const count = Math.max(0, Number(requestedCount) || 0);
  const visualRule = getVisualRuleForItem(item);
  if (!visualRule) return Math.ceil(count / Math.max(1, fallbackCapacity));
  const rule = String(visualRule.quantityRule || "").trim();
  const divisorMatch = rule.match(/^ceil\(count\/(\d+(?:\.\d+)?)\)$/i);
  if (divisorMatch) return Math.ceil(count / Math.max(1, Number(divisorMatch[1]) || fallbackCapacity));
  if (/^count$/i.test(rule)) return Math.ceil(count);
  return Math.ceil(count / Math.max(1, fallbackCapacity));
}

export function componentSupportsItem(component, item) {
  const normalizedComponent = normalizeKey(component);
  const normalizedItem = normalizeKey(item);
  const rule = getStorageRules().componentCapabilities.find((entry) => normalizeKey(entry.component) === normalizedComponent);
  if (!rule) return false;
  return String(rule.supports || "")
    .split(",")
    .map((value) => normalizeKey(value))
    .includes(normalizedItem);
}

export function hasConflictRule(item, ruleName) {
  const normalizedRule = normalizeKey(ruleName);
  return getConflictRulesForItem(item).some((rule) => normalizeKey(rule.rule) === normalizedRule);
}

async function parseStorageRulesWorkbook(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = {};
  workbook.SheetNames.forEach((sheetName) => {
    const normalizedSheetName = sheetName.trim();
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false
    });
    sheets[normalizedSheetName] = rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [trimValue(key), trimValue(value)])
    ));
  });
  return sheets;
}

function normalizeStorageRules(rawSheets, initialWarnings = []) {
  const parseWarnings = [...initialWarnings];
  REQUIRED_SHEETS.forEach((sheetName) => {
    if (!Array.isArray(rawSheets[sheetName])) parseWarnings.push(`missing sheet: ${sheetName}`);
  });
  if (!Array.isArray(rawSheets.ComponentCapability)) {
    parseWarnings.push("optional sheet missing: ComponentCapability");
  }
  if (!rawSheets.VisualRule?.some((rule) => normalizeKey(rule.item) === "bags")) {
    parseWarnings.push("VisualRule missing item: bags; fallback capacity is used");
  }

  const loadedSheets = Object.keys(rawSheets).filter((sheetName) => Array.isArray(rawSheets[sheetName]));
  const ruleCountBySheet = Object.fromEntries(loadedSheets.map((sheetName) => [
    sheetName,
    rawSheets[sheetName].filter((row) => Object.values(row).some((value) => String(value ?? "").trim())).length
  ]));

  return {
    loaded: REQUIRED_SHEETS.every((sheetName) => Array.isArray(rawSheets[sheetName])),
    source: STORAGE_RULE_SOURCE,
    loadedSheets,
    ruleCountBySheet,
    parseWarnings,
    itemCategories: normalizeRows(rawSheets.ItemCategory || []),
    placementRules: normalizeRows(rawSheets.PlacementRule || []),
    conflictRules: normalizeRows(rawSheets.ConflictRule || []),
    clearanceRules: normalizeRows(rawSheets.ClearanceRule || []),
    visualRules: normalizeRows(rawSheets.VisualRule || []),
    componentCapabilities: normalizeRows(rawSheets.ComponentCapability || [])
  };
}

function getStorageRulesVersion() {
  if (typeof window === "undefined") return "20260625-01";
  return new URLSearchParams(window.location.search).get("storageRules") || "20260625-01";
}

function normalizeRows(rows) {
  return rows
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [trimValue(key), trimValue(value)])))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
}

function trimValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
