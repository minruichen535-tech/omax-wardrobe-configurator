import { PLAN_LEVELS } from "../rules/commonRules.js?v=closet-rules-preview-20260621-11";
import {
  buildPlanRuleOutput,
  calculateDemandZoneLengths,
  calculateDemandZoneProfile,
  estimateDemandItems,
  getCaseMatchingRuleLoadStatus,
  getCaseMatchingRules,
  getClosetRules,
  getPlanPriceFromRules,
  getPlanTier,
  getZoneUiKeyForDemand
} from "../rules/demandRules.js?v=component-upgrade-rules-20260627-01";
import { getZoneInstallationHeight } from "../rules/storageStandards.js?v=case-matching-optional-20260627-01";
import { applyLayoutConstraints } from "../rules/layoutConstraints.js?v=longhang-shoe-preserved-20260630-01";
import {
  generateCandidatePlans,
  getLastCandidateEngineStats,
  getShelfGapDiagnostics,
  matchJapaneseCasesByRules,
  selectRecommendedCandidates
} from "./candidatePlanEngine.js?v=trouser-shelf-preserve-20260630-01";

const budgetOptions = ["3,000以下", "3,000 - 6,000", "6,000 - 9,000", "9,000 - 12,000", "12,000 - 18,000", "18,000以上"];

const budgetRanges = {
  "3,000以下": { min: 0, max: 3000 },
  "3,000 - 6,000": { min: 3000, max: 6000 },
  "6,000 - 9,000": { min: 6000, max: 9000 },
  "9,000 - 12,000": { min: 9000, max: 12000 },
  "12,000 - 18,000": { min: 12000, max: 18000 },
  "18,000以上": { min: 18000, max: 22000 }
};

const demandCapacityLevels = {
  "长衣": [
    { level: "少量", value: 10, unit: "件", perPerson: true },
    { level: "中等", value: 20, unit: "件", perPerson: true },
    { level: "较多", value: 30, unit: "件", perPerson: true, plus: true }
  ],
  "短衣": [
    { level: "少量", value: 20, unit: "件", perPerson: true },
    { level: "中等", value: 40, unit: "件", perPerson: true },
    { level: "较多", value: 60, unit: "件", perPerson: true, plus: true }
  ],
  "裤子": [
    { level: "少量", value: 10, unit: "条", perPerson: true },
    { level: "中等", value: 20, unit: "条", perPerson: true },
    { level: "较多", value: 35, unit: "条", perPerson: true, plus: true }
  ],
  "鞋子": [
    { level: "少量", value: 8, unit: "双", perPerson: true },
    { level: "中等", value: 15, unit: "双", perPerson: true },
    { level: "较多", value: 25, unit: "双", perPerson: true, plus: true }
  ],
  "包包": [
    { level: "少量", value: 3, unit: "个", perPerson: true },
    { level: "中等", value: 6, unit: "个", perPerson: true },
    { level: "较多", value: 10, unit: "个", perPerson: true, plus: true }
  ],
  "首饰": [
    { level: "少量" },
    { level: "中等" },
    { level: "较多" }
  ],
  "被褥": [
    { level: "少量", value: 1, unit: "套", perPerson: true },
    { level: "中等", value: 2, unit: "套", perPerson: true },
    { level: "较多", value: 3, unit: "套", perPerson: true, plus: true }
  ],
  "行李箱": [
    { level: "少量", value: 1, unit: "个" },
    { level: "中等", value: 2, unit: "个" },
    { level: "较多", value: 3, unit: "个", plus: true }
  ],
  "展示收藏": [
    { level: "少量" },
    { level: "中等" },
    { level: "较多" }
  ]
};

export const zoneColors = {
  hanging: "#b96052",
  shoeBag: "#8a95c8",
  shelf: "#e9a9c9",
  drawer: "#e98645",
  display: "#2f6d61",
  bulky: "#a99b8a",
  jewelry: "#c5a15b"
};

const zonePresentation = {
  hanging: { color: zoneColors.hanging, description: "短衣与长衣为主，建议作为核心区域。" },
  trouser: { color: zoneColors.drawer, description: "适合裤架或半高挂放，提升日常取放效率。" },
  shoe: { color: zoneColors.shoeBag, description: "适合鞋层板分区，区分常穿与换季鞋。" },
  bag: { color: zoneColors.shoeBag, description: "适合开放层板与局部抽屉组合。" },
  jewelry: { color: zoneColors.jewelry, description: "适合浅抽屉、首饰盒或细分格收纳。" },
  bedding: { color: zoneColors.bulky, description: "适合高位或低频大件储物区。" },
  luggage: { color: zoneColors.bulky, description: "适合底部预留大件空间。" },
  display: { color: zoneColors.display, description: "适合开放展示、玻璃层板或灯光层板。" },
  handy: { color: zoneColors.drawer, description: "适合钥匙、雨伞和随手小物。" },
  bulky: { color: zoneColors.bulky, description: "适合行李箱、换季物品等低频大件。" },
  glassShelf: { color: zoneColors.shelf, description: "适合通透展示和灯光层次。" },
  closedStorage: { color: zoneColors.bulky, description: "用于隐藏杂物，让展示面更干净。" },
  lighting: { color: zoneColors.display, description: "用于强化陈列氛围和空间精致度。" },
  books: { color: zoneColors.shelf, description: "用于承载主要书籍容量。" },
  files: { color: zoneColors.drawer, description: "适合文件抽屉或封闭柜分类存放。" },
  cabinet: { color: zoneColors.bulky, description: "用于综合收纳和视觉整洁。" }
};

const layoutQuestion = {
  key: "layoutType",
  title: "空间采用哪种布局？",
  note: "布局形式会影响可用墙面、跨数和预算范围。",
  type: "layout"
};

const dimensionsQuestion = {
  key: "dimensions",
  title: "空间尺寸是多少？",
  note: "请输入空间尺寸，系统会据此计算跨数和可实现预算。",
  type: "dimensions"
};

const wardrobeFlow = [
  layoutQuestion,
  dimensionsQuestion,
  budgetQuestion(),
  {
    key: "people",
    title: "有多少人使用？",
    note: "人数会影响分区方式和每个人的使用尺度。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "demands",
    title: "以下哪些物品较多？",
    note: "可多选，系统会据此调整挂衣、鞋包、抽屉和展示比例。",
    type: "multi",
    options: ["长衣", "短衣", "裤子", "鞋子", "包包", "首饰", "被褥", "行李箱", "展示收藏"]
  }
];

const entryFlow = [
  layoutQuestion,
  dimensionsQuestion,
  budgetQuestion(),
  {
    key: "people",
    title: "日常使用人数是多少？",
    note: "使用人数会影响鞋层板数量和常用区容量。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "demands",
    title: "这个玄关主要满足什么需求？",
    note: "可多选，我们会平衡鞋区、挂放和随手收纳。",
    type: "multi",
    options: ["鞋子收纳", "外套挂放", "包包放置", "雨伞收纳", "钥匙杂物", "行李箱", "展示摆件"]
  }
];

const displayFlow = [
  layoutQuestion,
  dimensionsQuestion,
  budgetQuestion(),
  {
    key: "people",
    title: "有多少人使用？",
    note: "人数会影响展示与收纳的分区方式。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "demands",
    title: "主要展示什么内容？",
    note: "可多选，系统会据此判断开放展示、玻璃层板和灯光比例。",
    type: "multi",
    options: ["摆件", "收藏品", "书籍", "酒具", "茶具", "包包展示", "综合展示"]
  }
];

const studyFlow = [
  layoutQuestion,
  dimensionsQuestion,
  budgetQuestion(),
  {
    key: "people",
    title: "有多少人使用？",
    note: "人数会影响书籍、文件和设备的容量规划。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "demands",
    title: "主要收纳什么内容？",
    note: "可多选，系统会据此分配书籍、文件、设备和展示比例。",
    type: "multi",
    options: ["书籍", "文件", "电子设备", "收藏品", "摆件", "综合收纳"]
  }
];

function budgetQuestion() {
  return {
    key: "budget",
    title: "希望控制在什么范围？",
    note: "我们会根据空间尺寸过滤无法实现的预算区间。",
    options: budgetOptions
  };
}

export function getQuestionFlow(spaceType = "") {
  if (spaceType === "玄关收纳") return entryFlow;
  if (spaceType === "客厅展示") return displayFlow;
  if (spaceType === "书房收纳") return studyFlow;
  return wardrobeFlow;
}

export function getDemandOptions(spaceType = "") {
  return getQuestionFlow(spaceType).find((question) => question.key === "demands")?.options || [];
}

export function parseBudgetRange(label = "") {
  if (budgetRanges[label]) return budgetRanges[label];
  const values = String(label || "").match(/[\d,]+/g)
    ?.map((value) => Number(value.replace(/,/g, ""))) || [];
  if (String(label || "").includes("以下")) return { min: 0, max: values[0] || 3000 };
  if (String(label || "").includes("以上")) {
    const min = values[0] || 18000;
    return { min, max: Math.round(min * 1.25), openEnded: true };
  }
  if (values.length >= 2) return { min: values[0], max: values[1] };
  return budgetRanges["9,000 - 12,000"];
}

export function getDynamicJapaneseBudgetRanges({ bayCount }) {
  const minPossiblePrice = roundToHundred(bayCount * 700);
  const normalPossiblePrice = roundToHundred(bayCount * 900);
  const maxPossiblePrice = roundToHundred(bayCount * 2200);
  const lowStart = Math.max(3000, roundDownToHundred(minPossiblePrice * 0.85));
  const lowEnd = Math.max(lowStart + 100, roundUpToHundred(normalPossiblePrice * 1.05));
  const midEnd = Math.max(lowEnd + 100, roundUpToHundred(normalPossiblePrice * 1.45));
  const highEnd = Math.max(midEnd + 100, roundUpToHundred(maxPossiblePrice * 0.85));
  const premiumEnd = Math.max(highEnd + 100, roundUpToHundred(maxPossiblePrice * 1.15));
  const ranges = lowStart > 3000
    ? [
      { min: 0, max: lowStart, label: `${formatBudgetAmount(lowStart)}以下` },
      { min: lowStart, max: lowEnd, label: formatBudgetRange(lowStart, lowEnd) },
      { min: lowEnd, max: midEnd, label: formatBudgetRange(lowEnd, midEnd) },
      { min: midEnd, max: premiumEnd, label: formatBudgetRange(midEnd, premiumEnd) },
      { min: premiumEnd, max: Infinity, openEnded: true, label: `${formatBudgetAmount(premiumEnd)}以上` }
    ]
    : [
      { min: 0, max: lowStart, label: `${formatBudgetAmount(lowStart)}以下` },
      { min: lowStart, max: midEnd, label: formatBudgetRange(lowStart, midEnd) },
      { min: midEnd, max: highEnd, label: formatBudgetRange(midEnd, highEnd) },
      { min: highEnd, max: premiumEnd, label: formatBudgetRange(highEnd, premiumEnd) },
      { min: premiumEnd, max: Infinity, openEnded: true, label: `${formatBudgetAmount(premiumEnd)}以上` }
    ];
  return ranges;
}

export function getJapaneseClosetBudgetAvailability(answers = {}) {
  const seriesId = answers.selectedProductSystem?.seriesId
    || answers.selectedProductSystem?.id
    || "";
  if (seriesId !== "japanese-closet") return null;
  const dimensions = answers.dimensions || {};
  const width = Number(dimensions.width) || 3600;
  const depth = Number(dimensions.depth) || 2800;
  const layoutType = dimensions.layoutType || "I型";
  const runLength = layoutType === "U型"
    ? width + depth * 2
    : layoutType === "L型"
      ? width + depth
      : width;
  const bayCount = Math.max(1, Math.round(runLength / 900));
  const minPossiblePrice = roundToHundred(bayCount * 700);
  const normalPossiblePrice = roundToHundred(bayCount * 900);
  const maxPossiblePrice = roundToHundred(bayCount * 2200);
  const dynamicBudgetRanges = getDynamicJapaneseBudgetRanges({ bayCount });
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
  const selectedRange = dynamicBudgetRanges.find((range) => range.label === answers.budget) || null;
  const targetPrices = getJapaneseBudgetTargetPrices(selectedRange, maxPossiblePrice);

  return {
    bayCount,
    minPossiblePrice,
    normalPossiblePrice,
    maxPossiblePrice,
    dynamicBudgetRanges,
    disabledBudgetRanges,
    disabledReason,
    selectedBudgetRange: selectedRange?.label || "",
    ...targetPrices
  };
}

function getJapaneseBudgetTargetPrices(range, maxPossiblePrice) {
  if (!range) {
    return { basicTargetPrice: null, valueTargetPrice: null, premiumTargetPrice: null };
  }
  const upper = range.openEnded
    ? Math.max(range.min, maxPossiblePrice)
    : range.max;
  const width = Math.max(0, upper - range.min);
  return {
    basicTargetPrice: roundToHundred(range.min + width * 0.30),
    valueTargetPrice: roundToHundred(range.min + width * 0.55),
    premiumTargetPrice: roundToHundred(range.min + width * 0.85)
  };
}

function roundDownToHundred(value) {
  return Math.floor(Number(value || 0) / 100) * 100;
}

function roundUpToHundred(value) {
  return Math.ceil(Number(value || 0) / 100) * 100;
}

function roundToHundred(value) {
  return Math.round(Number(value || 0) / 100) * 100;
}

function formatBudgetAmount(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatBudgetRange(min, max) {
  return `${formatBudgetAmount(min)} - ${formatBudgetAmount(max)}`;
}

export function calculateDemandProfile(answers) {
  return calculateRelevantZones(answers);
}

export function calculateRelevantZones(answers) {
  return calculateDemandZoneProfile(getDemandWeights(answers), answers.people || "1人");
}

function getSelectedDemands(answers) {
  if (Array.isArray(answers.demands)) return answers.demands;
  const weights = getDemandWeights(answers);
  if (weights && typeof weights === "object") {
    return Object.entries(weights)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([key]) => key);
  }
  return [];
}

function getDemandWeights(answers) {
  if (answers.demands && !Array.isArray(answers.demands) && typeof answers.demands === "object") {
    return answers.demands;
  }
  return answers.demandsWeights || answers.needWeights || {};
}

function getWeightedDemands(answers) {
  const weights = getDemandWeights(answers);
  return getSelectedDemands(answers)
    .map((name) => ({ name, weight: Number(weights[name]) || 1 }))
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, "zh-CN"));
}

function getPrimaryZoneKey(answers) {
  return Object.entries(calculateRelevantZones(answers))
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function add(selected, keys, value) {
  return keys.reduce((sum, key) => sum + (selected.has(key) ? value : 0), 0);
}

function hasAny(selected, keys) {
  return keys.some((key) => selected.has(key));
}

function zone(enabled, key, value) {
  return enabled ? [key, value] : null;
}

function normalizeRelevant(entries) {
  const values = Object.fromEntries(entries.filter(Boolean));
  if (!Object.keys(values).length) return {};
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Math.round((value / total) * 100)])
  );
  const firstKey = Object.keys(normalized)[0];
  normalized[firstKey] += 100 - Object.values(normalized).reduce((sum, value) => sum + value, 0);
  return normalized;
}

export function estimateItemCounts(answers) {
  const demandQuantityProfile = getDemandQuantityProfile(answers);
  if (Object.keys(demandQuantityProfile).length) {
    return Object.values(demandQuantityProfile)
      .map((item) => ({ name: item.label, value: item.estimate }));
  }
  return estimateDemandItems(getDemandWeights(answers), answers.people || "1人")
    .map((item) => ({ name: item.label, value: item.estimate }));
}

export function getWeightedItemEstimate(itemName, users = "2人", weight = 1) {
  return estimateDemandItems({ [itemName]: weight }, users)[0]?.estimate || "";
}

function formatRange(range) {
  if (range.openEnded) return `${range.min}${range.unit}以上`;
  return `${range.min}-${range.max}${range.unit}`;
}

function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

function getDemandQuantityProfile(answers = {}) {
  const peopleCount = parsePeopleCount(answers.people || "1人");
  if (answers.demandQuantityProfile && typeof answers.demandQuantityProfile === "object") {
    const profileValues = Object.values(answers.demandQuantityProfile);
    const matchesCurrentPeople = profileValues.every((item) => Number(item?.peopleCount || peopleCount) === peopleCount);
    if (matchesCurrentPeople) return answers.demandQuantityProfile;
  }
  const weights = getDemandWeights(answers);
  return Object.fromEntries(
    Object.entries(weights)
      .map(([name, weight]) => [name, getDemandQuantityEntry(name, Number(weight) || 0, answers.people || "1人")])
      .filter(([, entry]) => entry)
  );
}

function getDemandQuantityEntry(name, weight, peopleLabel) {
  const levels = demandCapacityLevels[name];
  const normalizedWeight = Math.max(0, Math.min(3, Number(weight) || 0));
  const level = levels?.[normalizedWeight - 1];
  if (!level || normalizedWeight <= 0) return null;
  const peopleCount = parsePeopleCount(peopleLabel);
  const quantity = Number.isFinite(Number(level.value))
    ? Number(level.value) * (level.perPerson ? peopleCount : 1)
    : null;
  const estimate = quantity == null
    ? level.level
    : `约${quantity}${level.unit || "件"}${level.plus ? "+" : ""}`;
  return {
    label: name,
    level: level.level,
    weight: normalizedWeight,
    quantity,
    unit: level.unit || "",
    perPerson: Boolean(level.perPerson),
    peopleCount,
    estimate
  };
}

function parsePeopleCount(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function getDemandItemEstimate(itemName, answers, weight = 1) {
  const demandQuantity = getDemandQuantityProfile(answers)[itemName];
  if (demandQuantity?.estimate) return demandQuantity.estimate;
  const unifiedEstimate = getWeightedItemEstimate(itemName, answers.people || "1人", weight);
  if (unifiedEstimate) return unifiedEstimate;
  const normalizedWeight = Math.max(1, Math.min(3, Number(weight) || 1));
  const fallbackRanges = {
    "首饰": [
      { min: 1, max: 2, unit: "组" },
      { min: 2, max: 3, unit: "组" },
      { min: 3, max: 5, unit: "组" }
    ],
    "被褥": [
      { min: 2, max: 3, unit: "床" },
      { min: 3, max: 4, unit: "床" },
      { min: 4, max: 6, unit: "床" }
    ],
    "行李箱": [
      { min: 3, max: 5, unit: "个" },
      { min: 4, max: 6, unit: "个" },
      { min: 5, max: 8, unit: "个" }
    ],
    "展示收藏": [
      { min: 8, max: 12, unit: "件" },
      { min: 12, max: 18, unit: "件" },
      { min: 18, max: 30, unit: "件" }
    ],
    "鞋子收纳": [
      { min: 12, max: 20, unit: "双" },
      { min: 20, max: 32, unit: "双" },
      { min: 32, max: 48, unit: "双" }
    ],
    "外套挂放": [
      { min: 4, max: 6, unit: "件" },
      { min: 6, max: 10, unit: "件" },
      { min: 10, max: 16, unit: "件" }
    ],
    "包包放置": [
      { min: 3, max: 5, unit: "个" },
      { min: 5, max: 8, unit: "个" },
      { min: 8, max: 12, unit: "个" }
    ],
    "雨伞收纳": [
      { min: 2, max: 4, unit: "把" },
      { min: 4, max: 6, unit: "把" },
      { min: 6, max: 10, unit: "把" }
    ],
    "钥匙杂物": [
      { min: 1, max: 2, unit: "组" },
      { min: 2, max: 3, unit: "组" },
      { min: 3, max: 4, unit: "组" }
    ],
    "展示摆件": [
      { min: 4, max: 8, unit: "件" },
      { min: 8, max: 14, unit: "件" },
      { min: 14, max: 22, unit: "件" }
    ],
    "摆件": [
      { min: 6, max: 10, unit: "件" },
      { min: 10, max: 18, unit: "件" },
      { min: 18, max: 28, unit: "件" }
    ],
    "收藏品": [
      { min: 8, max: 12, unit: "件" },
      { min: 12, max: 20, unit: "件" },
      { min: 20, max: 36, unit: "件" }
    ],
    "书籍": [
      { min: 80, max: 120, unit: "本" },
      { min: 120, max: 200, unit: "本" },
      { min: 200, max: 320, unit: "本" }
    ],
    "酒具": [
      { min: 8, max: 12, unit: "件" },
      { min: 12, max: 20, unit: "件" },
      { min: 20, max: 32, unit: "件" }
    ],
    "茶具": [
      { min: 6, max: 10, unit: "件" },
      { min: 10, max: 16, unit: "件" },
      { min: 16, max: 24, unit: "件" }
    ],
    "包包展示": [
      { min: 3, max: 5, unit: "个" },
      { min: 5, max: 8, unit: "个" },
      { min: 8, max: 12, unit: "个" }
    ],
    "综合展示": [
      { min: 4, max: 6, unit: "组" },
      { min: 6, max: 9, unit: "组" },
      { min: 9, max: 12, unit: "组" }
    ],
    "文件": [
      { min: 4, max: 8, unit: "组" },
      { min: 8, max: 12, unit: "组" },
      { min: 12, max: 18, unit: "组" }
    ],
    "电子设备": [
      { min: 2, max: 4, unit: "件" },
      { min: 4, max: 6, unit: "件" },
      { min: 6, max: 10, unit: "件" }
    ],
    "综合收纳": [
      { min: 4, max: 6, unit: "组" },
      { min: 6, max: 10, unit: "组" },
      { min: 10, max: 16, unit: "组" }
    ]
  };
  const range = fallbackRanges[itemName]?.[normalizedWeight - 1];
  return range ? formatRange(range) : "已选择";
}

export function buildZoneCards(answers, ratios = calculateRelevantZones(answers)) {
  const labels = getRatioLabels(answers.spaceUse);
  const weights = getDemandWeights(answers);
  const demandQuantityProfile = getDemandQuantityProfile(answers);
  const cardsByZone = new Map();
  Object.entries(ratios).forEach(([zoneKey, percent]) => {
    const presentation = getZonePresentation(zoneKey);
    cardsByZone.set(zoneKey, {
      zoneName: labels[zoneKey] || zoneKey,
      percent,
      colorKey: zoneKey,
      color: presentation.color,
      items: []
    });
  });

  getSelectedDemands(answers).forEach((itemName) => {
    const zoneKey = getZoneUiKeyForDemand(itemName);
    if (!zoneKey) return;
    cardsByZone.get(zoneKey).items.push({
      label: itemName,
      estimate: demandQuantityProfile[itemName]?.estimate
        || estimateDemandItems({ [itemName]: Number(weights[itemName]) || 1 }, answers.people || "1人")[0]?.estimate
        || ""
    });
  });

  return Array.from(cardsByZone.values()).filter((card) => card.items.length);
}

export function buildDemandPersona(answers) {
  const weightedDemands = getWeightedDemands(answers);
  const primaryDemand = weightedDemands[0]?.name || "";
  const secondaryDemands = weightedDemands.slice(1, 3).map((item) => item.name);
  const primaryZone = getPrimaryZoneKey(answers);
  const traits = getUsageTraits(answers, weightedDemands, primaryZone);

  return {
    focus: formatDemandFocus(primaryDemand, primaryZone),
    secondary: secondaryDemands.length
      ? secondaryDemands.map(formatDemandFocus).join(" / ")
      : "需求相对集中",
    layout: getRecommendedLayout(answers, primaryZone, weightedDemands),
    usageTrait: traits.join("，"),
    summary: generatePersonaSummary(answers, weightedDemands, traits)
  };
}

function formatDemandFocus(name, zoneKey = "") {
  const focusMap = {
    "长衣": "长衣收纳",
    "短衣": "短衣收纳",
    "裤子": "裤装收纳",
    "鞋子": "鞋履收纳",
    "鞋子收纳": "鞋履收纳",
    "包包": "包包收纳",
    "包包放置": "包包收纳",
    "包包展示": "包包展示",
    "首饰": "首饰收纳",
    "被褥": "换季被褥",
    "行李箱": "行李箱存放",
    "展示收藏": "展示收藏",
    "展示摆件": "展示陈列",
    "摆件": "摆件陈列",
    "收藏品": "收藏展示",
    "综合展示": "综合展示",
    "外套挂放": "外套挂放",
    "雨伞收纳": "雨伞收纳",
    "钥匙杂物": "随手小物",
    "书籍": "书籍收纳",
    "文件": "文件管理",
    "电子设备": "设备收纳",
    "综合收纳": "综合收纳"
  };
  const zoneFallback = {
    hanging: "衣物分类",
    trouser: "裤装收纳",
    shoe: "鞋履收纳",
    bag: "包包收纳",
    jewelry: "首饰收纳",
    bedding: "换季被褥",
    luggage: "行李箱存放",
    display: "展示收藏",
    handy: "随手物品",
    glassShelf: "展示层板",
    closedStorage: "封闭收纳",
    lighting: "灯光氛围",
    books: "书籍收纳",
    files: "文件管理",
    cabinet: "柜体收纳"
  };
  return focusMap[name] || zoneFallback[zoneKey] || "综合收纳";
}

function getRecommendedLayout(answers, primaryZone, weightedDemands) {
  const selected = new Set(weightedDemands.map((item) => item.name));
  const layoutType = answers.dimensions?.layoutType || "I型";
  if (layoutType === "L型") {
    if (answers.spaceUse === "玄关收纳") return "转角鞋柜 + 随手物品区";
    if (answers.spaceUse === "客厅展示") return "转角展示层板 + 柜体收纳";
    if (answers.spaceUse === "书房收纳") return "转角书架 + 文件柜";
    return "转角挂衣 + 转角层板";
  }
  if (layoutType === "U型") {
    return "环绕式收纳 + 家庭共享";
  }
  if (answers.spaceUse === "玄关收纳") {
    if (selected.has("鞋子收纳")) return "开放鞋架 + 挂衣区";
    if (selected.has("钥匙杂物")) return "鞋柜 + 杂物区";
    return "展示架 + 换鞋区";
  }
  if (answers.spaceUse === "客厅展示") {
    return primaryZone === "closedStorage"
      ? "展示层板 + 封闭收纳"
      : "开放展示 + 局部柜体";
  }
  if (answers.spaceUse === "书房收纳") {
    if (selected.has("文件")) return "书架层板 + 文件抽屉";
    if (primaryZone === "display") return "展示层板 + 封闭柜";
    return "开放书架 + 柜体收纳";
  }
  if (primaryZone === "display") return "展示区 + 收纳区";
  if (selected.has("首饰") || primaryZone === "jewelry") return "开放挂衣 + 抽屉组合";
  return "开放挂衣 + 层板展示";
}

function getUsageTraits(answers, weightedDemands, primaryZone) {
  const selected = new Set(weightedDemands.map((item) => item.name));
  const dimensions = answers.dimensions || {};
  const traits = [];
  if (["3人", "4人以上"].includes(answers.people) || dimensions.layoutType === "U型") traits.push("家庭共享收纳");
  if (
    primaryZone === "display"
    || weightedDemands.some((item) => ["展示收藏", "展示摆件", "摆件", "收藏品", "综合展示", "包包展示"].includes(item.name) && item.weight >= 2)
  ) {
    traits.push("偏重展示与陈列");
  }
  if (selected.has("被褥") || selected.has("行李箱")) traits.push("偏重换季储物");
  if (["长衣", "短衣", "裤子", "外套挂放"].some((name) => selected.has(name))) {
    traits.push("偏重衣物分类管理");
  }
  if (Number(dimensions.height) > 2700) traits.push("适合增加顶部储物");
  if (!traits.length && answers.spaceUse === "玄关收纳") traits.push("偏重日常快速取用");
  if (!traits.length && answers.spaceUse === "书房收纳") traits.push("偏重分类整理与安静使用");
  if (!traits.length) traits.push("偏重视觉展示与日常取用");
  return traits.slice(0, 2);
}

function generatePersonaSummary(answers, weightedDemands, traits) {
  const primary = weightedDemands[0]?.name || "综合收纳";
  const secondary = weightedDemands.slice(1, 3).map((item) => item.name);
  const peopleText = ["3人", "4人以上"].includes(answers.people)
    ? "多人共用"
    : answers.people
      ? `${answers.people}使用`
      : "当前空间";
  const secondaryText = secondary.length
    ? `${secondary.join("与")}作为辅助需求`
    : "其他收纳需求相对克制";
  const traitText = traits.join("，");
  const dimensionNote = getDimensionPlanningNote(answers.dimensions);
  return `${peopleText}下，您的收纳习惯更偏向${formatDemandFocus(primary)}，${secondaryText}。整体空间适合采用${getRecommendedLayout(answers, getPrimaryZoneKey(answers), weightedDemands)}的规划方式，形成${traitText}的使用体验。${dimensionNote}`;
}

export function getHeightRecommendations(answers) {
  const roomHeight = answers.dimensions?.height || 2700;
  return calculateDemandZoneLengths(getDemandWeights(answers), answers.people || "1人")
    .map((zone) => {
      const recommendedHeight = getZoneInstallationHeight(zone.zoneType, roomHeight);
      return recommendedHeight == null
        ? null
        : item(zone.label, `推荐安装高度 ${recommendedHeight}mm。`);
    })
    .filter(Boolean);
}

export function getFunctionZoneRecommendations(answers) {
  const labels = getRatioLabels(answers.spaceUse);
  return Object.keys(calculateRelevantZones(answers)).map((key) => ({
    name: labels[key] || key,
    text: getZoneText(answers.spaceUse, key)
  }));
}

export function getZonePresentation(key) {
  return zonePresentation[key] || {
    color: zoneColors.shelf,
    description: "根据当前需求分配的重点功能区。"
  };
}

export function generateAnalysisText(answers) {
  const weightedDemands = getWeightedDemands(answers);
  const demandText = weightedDemands.length ? weightedDemands.map((item) => item.name).join("、") : "综合收纳";
  const topDemand = weightedDemands[0]?.name;
  const secondDemand = weightedDemands[1]?.name;
  const topLevel = weightedDemands[0] ? getWeightLabel(weightedDemands[0].weight) : "";
  const priorityText = topDemand
    ? `${topDemand}需求${topLevel}${secondDemand ? `，其次是${secondDemand}` : ""}`
    : "综合收纳需求较均衡";
  if (answers.spaceUse === "玄关收纳") {
    return `${priorityText}。玄关需求集中在${demandText}。`;
  }
  if (answers.spaceUse === "客厅展示") {
    return `${priorityText}。展示需求集中在${demandText}。`;
  }
  if (answers.spaceUse === "书房收纳") {
    return `${priorityText}。书房需求集中在${demandText}。`;
  }
  return `${priorityText}。主要需求集中在${demandText}。`;
}

function item(name, text) {
  return { name, text };
}

function getZoneText(spaceType, key) {
  const zoneTexts = {
    hanging: "承担主要挂放需求，优先安排在顺手高度。",
    trouser: "适合配置裤架或半高挂放区。",
    shoe: "按常用与换季分层，提高取放效率。",
    bag: "适合开放层板或局部抽屉组合。",
    jewelry: "适合配置抽屉、首饰盒或浅格收纳。",
    bedding: "适合放在高位或低频大件区。",
    luggage: "适合预留底部大件空间。",
    display: "适合开放展示格、玻璃层板或灯光层板。",
    handy: "用于钥匙、雨伞、随手物品和小件临时放置。",
    bulky: "用于行李箱、换季物品等低频大件。",
    glassShelf: "用于提升展示通透感和灯光层次。",
    closedStorage: "用于隐藏杂物，让展示面更干净。",
    lighting: "用于强化陈列氛围和空间精致度。",
    books: "用于承载主要书籍容量。",
    files: "适合抽屉或封闭柜分类存放。",
    cabinet: "用于综合收纳和视觉整洁。"
  };
  return zoneTexts[key] || `${spaceType || "空间"}的重点功能区。`;
}

export function generatePlans(answers) {
  return buildPlanRecommendation(answers).plans;
}

export function getPlanPriceRange(budgetRange = "", planType = "basic") {
  const price = getPlannerPriceRule(budgetRange, planType);
  return [price.min, price.max];
}

export function getPlanPrice(budgetRange = "", planType = "basic") {
  return getPlannerPriceRule(budgetRange, planType).price;
}

function getPlannerPriceRule(budgetRange, planType) {
  const rulePrice = getPlanPriceFromRules(budgetRange, planType);
  if (Number(rulePrice.price || 0) > 0) return rulePrice;
  const range = parseBudgetRange(budgetRange);
  const target = planType === "basic"
    ? Math.max(range.min + 600, range.max - 500)
    : planType === "value"
      ? range.max + 400
      : range.max + 950;
  const price = Math.round(target / 100) * 100;
  return { min: price, max: price, price };
}

export function generateRecommendedPlans(answers = {}) {
  const weightedDemands = getWeightedDemands(answers);
  const isJapaneseCloset = (answers.selectedProductSystem?.seriesId || answers.selectedProductSystem?.id) === "japanese-closet";
  const closetRules = getClosetRules();
  const caseMatchingRules = getCaseMatchingRules();
  const caseMatchingRuleLoad = getCaseMatchingRuleLoadStatus();
  const rulesData = {
    ...closetRules,
    caseMatchingRules,
    caseMatchingRuleLoad
  };
  const matchedJapaneseCases = isJapaneseCloset ? matchJapaneseCasesByRules(answers, caseMatchingRules) : [];
  const primaryCase = matchedJapaneseCases[0] || null;
  const planningAnswers = isJapaneseCloset
    ? {
      ...answers,
      matchedJapaneseCases,
      primaryJapaneseCase: primaryCase,
      componentUpgradeRules: caseMatchingRules?.componentUpgradeRules || []
    }
    : answers;
  const candidates = generateCandidatePlans(planningAnswers, rulesData);
  const selectedCandidates = selectRecommendedCandidates(candidates, planningAnswers);
  selectedCandidates.forEach(applyLayoutConstraintsToCandidate);
  const candidateEngineStats = getLastCandidateEngineStats();
  const bayPlansByTier = Object.fromEntries(selectedCandidates.map((candidate) => [
    candidate.planType,
    candidate.bayPlan || []
  ]));
  return selectedCandidates.map((candidate) => {
    const tier = getPlanTier(candidate.planType);
    const pricedComponentCountByType = countDebugValues(
      candidate.placements.filter((placement) => placement.componentType),
      "componentType"
    );
    const previewComponentCountByType = countDebugValues(
      (candidate.configPreset?.explicitPlacements || []).filter((placement) => placement.componentType),
      "componentType"
    );
    const pricePreviewMismatch = JSON.stringify(pricedComponentCountByType)
      !== JSON.stringify(previewComponentCountByType);
    return {
      planType: candidate.planType,
      planName: tier.planName,
      planPrice: candidate.estimatedPrice,
      planPreview: null,
      planCapacityCoverage: `可满足约 ${Math.round(tier.coverage * 100)}%${candidate.planType === "premium" ? "+" : ""} 收纳需求`,
      planCapacity: buildPlanCapacityFromDemandProfile(answers, candidate.estimatedCapacity),
      planFeatures: candidate.zones,
      planReason: `${weightedDemands.slice(0, 3).map((item) => item.name).join("、") || "综合收纳"}按候选方案评分生成。`,
      configPreset: candidate.configPreset,
      candidatePlanId: candidate.planId,
      candidateScores: candidate.scores,
      candidateDebug: {
        primaryCaseId: primaryCase?.caseId || null,
        layoutTemplate: primaryCase?.layoutTemplate || [],
        caseLayoutTemplate: candidate.caseLayoutTemplate || primaryCase?.layoutTemplate || [],
        resolvedSkeleton: candidate.resolvedSkeleton || candidate.skeleton || [],
        forbiddenPatternViolations: candidate.forbiddenPatternViolations || [],
        tierUpgradeRulesApplied: candidate.tierUpgradeRulesApplied || {},
        bayRoleComponents: candidate.bayRoleComponents || [],
        bayPlanBasic: bayPlansByTier.basic || [],
        bayPlanValue: bayPlansByTier.value || [],
        bayPlanPremium: bayPlansByTier.premium || [],
        templateViolationCount: candidate.templateViolationCount || 0,
        primaryCaseScore: primaryCase?.score ?? null,
        secondaryCaseIds: matchedJapaneseCases.slice(1).map((caseData) => caseData.caseId),
        caseMatchWeight: candidate.scores?.caseMatchWeight || 0,
        caseDistributionTarget: candidate.scores?.caseDistributionTarget || {},
        candidateDistribution: candidate.scores?.candidateDistribution || {},
        distributionDelta: candidate.scores?.distributionDelta || {},
        premiumHardRequirements: candidate.premiumHardRequirements || null,
        premiumRequirementStatus: candidate.premiumRequirementStatus || null,
        componentUpgrade: candidate.componentUpgrade || null,
        layoutConstraints: candidate.layoutConstraints || {
          appliedConstraints: [],
          skippedConstraints: []
        },
        caseLibraryAppliedAs: candidate.caseLibraryAppliedAs || "layoutReferenceOnly",
        hardRuleOverrideCase: candidate.hardRuleOverrideCase || false,
        skeleton: candidate.skeleton || [],
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
        matchedJapaneseCases: matchedJapaneseCases.map(({ caseId, score, modelPath, matchedReason }) => ({
          caseId, score, modelPath, matchedReason
        })),
        caseMatchingRuleLoad: candidateEngineStats.caseMatchingRuleLoad || caseMatchingRuleLoad,
        caseMatching: candidateEngineStats.caseMatching || primaryCase?.caseMatching || null,
        caseMatchBonus: candidate.scores?.caseMatchBonus || 0,
        bayCount: candidate.parameters?.bayCount || candidate.configPreset?.bayCount || 0,
        zoneDistribution: countDebugValues(candidate.placements, "zoneType"),
        componentCount: countDebugValues(
          candidate.placements.filter((placement) => placement.componentType),
          "componentType"
        ),
        pricedComponentCountByType,
        previewComponentCountByType,
        pricePreviewMismatch,
        placementCount: candidate.placements.length,
        shelfGaps: getShelfGapDiagnostics(candidate.placements),
        estimatedPrice: candidate.manualComponentPrice == null
          ? candidate.estimatedPrice
          : `manualComponentPrice=${candidate.manualComponentPrice}, servicePriceFactor=${candidate.servicePriceFactor}, finalPlanPrice=${candidate.finalPlanPrice}, basicPrice=${candidate.basicPrice}, valuePrice=${candidate.valuePrice}, premiumPrice=${candidate.premiumPrice}, priceOrderValid=${candidate.priceOrderValid}, premiumCouldNotExceedValue=${candidate.premiumCouldNotExceedValue}, priceOrderFixReason=${candidate.priceOrderFixReason}, primaryCaseId=${primaryCase?.caseId || "none"}, caseLayoutTemplate=${JSON.stringify(candidate.caseLayoutTemplate || primaryCase?.layoutTemplate || [])}, resolvedSkeleton=${JSON.stringify(candidate.resolvedSkeleton || candidate.skeleton || [])}, forbiddenPatternViolations=${JSON.stringify(candidate.forbiddenPatternViolations || [])}, tierUpgradeRulesApplied=${JSON.stringify(candidate.tierUpgradeRulesApplied || {})}, bayRoleComponents=${JSON.stringify(candidate.bayRoleComponents || [])}, componentUpgrade=${JSON.stringify(candidate.componentUpgrade || {})}, bayCount=${candidate.parameters?.bayCount || candidate.configPreset?.bayCount || 0}, baseBayPrice=${candidate.baseBayPrice}, basePlanPrice=${candidate.basePlanPrice}, basicUpgradeList=${JSON.stringify(candidate.basicUpgradeList || [])}, valueUpgradeList=${JSON.stringify(candidate.valueUpgradeList || [])}, premiumUpgradeList=${JSON.stringify(candidate.premiumUpgradeList || [])}, basicPriceBreakdown=${JSON.stringify(candidate.basicPriceBreakdown || {})}, valuePriceBreakdown=${JSON.stringify(candidate.valuePriceBreakdown || {})}, premiumPriceBreakdown=${JSON.stringify(candidate.premiumPriceBreakdown || {})}, caseUsedForLayoutOnly=${candidate.caseUsedForLayoutOnly}, skeleton=${JSON.stringify(candidate.skeleton || [])}, basicComponents=${JSON.stringify(candidate.basicComponents || {})}, valueComponents=${JSON.stringify(candidate.valueComponents || {})}, premiumComponents=${JSON.stringify(candidate.premiumComponents || {})}, basicVsValueDifferent=${candidate.basicVsValueDifferent}, valueVsPremiumDifferent=${candidate.valueVsPremiumDifferent}, visibleUpgradeCountBasicToValue=${candidate.visibleUpgradeCountBasicToValue}, visibleUpgradeCountValueToPremium=${candidate.visibleUpgradeCountValueToPremium}, fallbackUsed=${candidate.fallbackUsed}, fallbackReason=${candidate.fallbackReason}, layoutTemplate=${JSON.stringify(primaryCase?.layoutTemplate || [])}, bayPlanBasic=${JSON.stringify(bayPlansByTier.basic || [])}, bayPlanValue=${JSON.stringify(bayPlansByTier.value || [])}, bayPlanPremium=${JSON.stringify(bayPlansByTier.premium || [])}, templateViolationCount=${candidate.templateViolationCount || 0}, primaryCaseScore=${primaryCase?.score ?? "none"}, secondaryCaseIds=${matchedJapaneseCases.slice(1).map((caseData) => caseData.caseId).join("|")}, caseMatchWeight=${candidate.scores?.caseMatchWeight || 0}, caseDistributionTarget=${JSON.stringify(candidate.scores?.caseDistributionTarget || {})}, candidateDistribution=${JSON.stringify(candidate.scores?.candidateDistribution || {})}, distributionDelta=${JSON.stringify(candidate.scores?.distributionDelta || {})}, premiumHardRequirements=${JSON.stringify(candidate.premiumHardRequirements || {})}, premiumRequirementStatus=${JSON.stringify(candidate.premiumRequirementStatus || {})}, caseLibraryAppliedAs=${candidate.caseLibraryAppliedAs || "strictCaseLayoutRules"}, hardRuleOverrideCase=${candidate.hardRuleOverrideCase || false}, caseMatchBonus=${candidate.scores?.caseMatchBonus || 0}, budgetMin=${candidate.budgetMin}, budgetMax=${candidate.budgetMax}, basicTarget=${candidate.basicTarget}, valueTarget=${candidate.valueTarget}, premiumTarget=${candidate.premiumTarget}, targetPrice=${candidate.targetPrice}, actualPrice=${candidate.actualPrice}, priceDelta=${candidate.priceDelta}, premiumAboveBudget=${candidate.premiumAboveBudget}, premiumCouldNotExceedBudget=${candidate.premiumCouldNotExceedBudget}, priceWasTargetAdjusted=${candidate.priceWasTargetAdjusted}, pricedComponentCountByType=${JSON.stringify(pricedComponentCountByType)}, previewComponentCountByType=${JSON.stringify(previewComponentCountByType)}, pricePreviewMismatch=${pricePreviewMismatch}, selectedBecause=${candidate.selectedBecause}`,
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
        budgetMin: candidate.budgetMin,
        budgetMax: candidate.budgetMax,
        basicTarget: candidate.basicTarget,
        valueTarget: candidate.valueTarget,
        premiumTarget: candidate.premiumTarget,
        premiumAboveBudget: candidate.premiumAboveBudget,
        premiumCouldNotExceedBudget: candidate.premiumCouldNotExceedBudget,
        priceWasTargetAdjusted: candidate.priceWasTargetAdjusted,
        selectedBecause: candidate.selectedBecause,
        estimatedCapacity: candidate.estimatedCapacity,
        candidateQa: candidate.candidateQa || null,
        rejectedReason: candidate.rejectReason || null
      }
    };
  });
}

export function getCandidatePlanDebugStats() {
  return getLastCandidateEngineStats();
}

function applyLayoutConstraintsToCandidate(candidate) {
  if (!candidate || !Array.isArray(candidate.placements)) return;
  const result = applyLayoutConstraints(candidate.placements, {
    roomHeight: candidate.configPreset?.roomHeight || candidate.parameters?.roomHeight
  });
  const constrainedPlacements = result.placements;
  candidate.layoutConstraints = {
    appliedConstraints: result.appliedConstraints || [],
    skippedConstraints: result.skippedConstraints || []
  };
  if (!Array.isArray(constrainedPlacements)) return;

  candidate.placements = constrainedPlacements;
  candidate.configPreset = {
    ...(candidate.configPreset || {}),
    explicitPlacements: constrainedPlacements.map((placement) => ({ ...placement })),
    componentQuantities: countDebugValues(
      constrainedPlacements.filter((placement) => placement.componentType),
      "componentType"
    )
  };
}

function countDebugValues(items, key) {
  return items.reduce((result, item) => {
    const value = item?.[key];
    if (value) result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function buildRecommendedPlanFeatures(planType, answers, weightedDemands) {
  const selected = new Set(weightedDemands.map((item) => item.name));
  const topDemands = weightedDemands.slice(0, planType === "basic" ? 1 : planType === "value" ? 2 : 5).map((item) => item.name);
  const features = [];

  if (["衣帽间", "主卧衣柜"].includes(answers.spaceUse)) {
    if (hasAny(selected, ["长衣", "短衣"]) || !weightedDemands.length) features.push("挂衣杆分区");
    features.push(planType === "basic" ? "基础层板" : "加密层板");
  } else if (answers.spaceUse === "玄关收纳") {
    features.push("鞋层板分区");
    if (planType !== "basic") features.push("随手抽屉");
  } else if (answers.spaceUse === "客厅展示") {
    features.push(planType === "basic" ? "开放展示层板" : "展示模块组合");
  } else if (answers.spaceUse === "书房收纳") {
    features.push("书架层板");
    if (planType !== "basic") features.push("文件抽屉");
  }

  topDemands.forEach((demand) => {
    demandFeatures(demand, planType).forEach((feature) => pushUnique(features, feature));
  });

  if (planType === "value") {
    pushUnique(features, "抽屉或柜体组合");
    if (supportsLighting(answers.selectedProductSystem) && shouldAddLighting(selected)) pushUnique(features, "局部灯光");
  }
  if (planType === "premium") {
    if (supportsGlassShelf(answers.selectedProductSystem)) pushUnique(features, "玻璃层板");
    if (supportsLighting(answers.selectedProductSystem)) pushUnique(features, "灯光系统");
    if (selected.has("首饰")) pushUnique(features, "首饰盒");
    if (selected.has("裤子")) pushUnique(features, "裤架");
    pushUnique(features, "柜体组合");
    pushUnique(features, "抽屉加强");
  }

  return features.slice(0, 4);
}

function demandFeatures(demand, planType) {
  const premium = planType === "premium";
  const value = planType === "value";
  const map = {
    "长衣": [premium || value ? "长衣挂放加强" : "长衣挂放区"],
    "短衣": [premium || value ? "短衣挂放加强" : "短衣挂放区"],
    "裤子": [premium || value ? "裤架" : "裤装挂放区"],
    "鞋子": [premium || value ? "鞋区加强" : "鞋层板"],
    "鞋子收纳": [premium || value ? "鞋区加强" : "鞋层板"],
    "包包": [premium ? "包包展示区" : "包包层板"],
    "包包放置": [premium ? "包包展示区" : "包包层板"],
    "包包展示": [premium ? "包包展示区" : "包包层板"],
    "首饰": [premium ? "首饰盒" : value ? "首饰抽屉" : "浅抽屉预留"],
    "被褥": [premium || value ? "大件储物加强" : "被褥储物区"],
    "行李箱": [premium || value ? "大件储物加强" : "行李箱储物位"],
    "展示收藏": [premium ? "玻璃层板展示" : "开放展示层板"],
    "展示摆件": [premium ? "灯光展示区" : "开放展示层板"],
    "摆件": [premium ? "灯光展示区" : "开放展示层板"],
    "收藏品": [premium ? "玻璃层板展示" : "开放展示层板"],
    "综合展示": [premium ? "展示 + 柜体组合" : "开放展示层板"],
    "酒具": [premium ? "玻璃层板 + 灯光" : "开放展示层板"],
    "茶具": [premium ? "玻璃层板 + 灯光" : "开放展示层板"],
    "书籍": [premium || value ? "加密书架层板" : "书架层板"],
    "文件": [premium || value ? "文件抽屉" : "封闭文件区"],
    "电子设备": [premium || value ? "设备开放格 + 走线" : "设备开放格"],
    "综合收纳": [premium || value ? "柜体组合" : "基础柜体"]
  };
  return map[demand] || [`${demand}分区`];
}

function getPlanCapacityCoverage(planType) {
  if (planType === "basic") return "可满足约 70% 核心收纳需求";
  if (planType === "value") return "可满足约 85% 日常收纳需求";
  return "可满足约 95%+ 完整收纳需求";
}

function buildPlanCapacity(planType, answers, weightedDemands) {
  const demandCapacity = buildPlanCapacityFromDemandProfile(answers);
  if (demandCapacity.length) return demandCapacity;
  const capacityFactor = planType === "basic" ? 0.72 : planType === "value" ? 0.9 : 1.12;
  const selected = weightedDemands.length
    ? weightedDemands.slice(0, planType === "basic" ? 2 : planType === "value" ? 3 : 5)
    : [{ name: fallbackCapacityItem(answers), weight: 1 }];
  return selected.map(({ name, weight }) => ({
    label: name,
    estimate: getPlanCapacityEstimate(name, answers, weight, capacityFactor)
  })).filter((item) => item.estimate);
}

function buildPlanCapacityFromDemandProfile(answers, fallbackCapacity = []) {
  const demandQuantityProfile = getDemandQuantityProfile(answers);
  const weightedNames = getWeightedDemands(answers).map((item) => item.name);
  const names = weightedNames.length ? weightedNames : Object.keys(demandQuantityProfile);
  const items = names
    .map((name) => demandQuantityProfile[name])
    .filter(Boolean)
    .map((item) => ({
      label: item.label,
      estimate: item.estimate
    }));
  return items.length ? items : fallbackCapacity;
}

function fallbackCapacityItem(answers) {
  if (answers.spaceUse === "玄关收纳") return "鞋子收纳";
  if (answers.spaceUse === "客厅展示") return "综合展示";
  if (answers.spaceUse === "书房收纳") return "书籍";
  return "短衣";
}

function getPlanCapacityEstimate(itemName, answers, weight, capacityFactor) {
  const demandEstimate = getDemandItemEstimate(itemName, answers, Number(weight) || 1);
  const parsed = parseEstimateRange(demandEstimate);
  if (!parsed) return demandEstimate;
  const min = Math.max(1, roundCapacity(parsed.min * capacityFactor, parsed.unit));
  const max = Math.max(min, roundCapacity(parsed.max * capacityFactor, parsed.unit));
  return `约 ${min}-${max}${parsed.unit}`;
}

function parseEstimateRange(value) {
  const match = String(value || "").match(/(\d+)(?:-(\d+))?([^0-9\s]+)?/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2] || match[1]);
  const unit = match[3] || "";
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max, unit };
}

function roundCapacity(value, unit) {
  const step = unit === "本" ? 10 : unit === "件" || unit === "双" || unit === "条" ? 5 : 1;
  return Math.max(step, Math.round(value / step) * step);
}

function buildRecommendedPlanReason(planType, answers, weightedDemands) {
  const top = weightedDemands[0]?.name || "综合收纳";
  if (planType === "basic") return `优先围绕${top}配置，减少展示和灯光类投入，控制整体价格。`;
  if (planType === "value") return `在${top}基础上补足次要需求，增加抽屉、层板或局部展示，适合多数家庭。`;
  return `尽量覆盖已选择需求，强化柜体、抽屉、灯光和展示模块，形成更完整的定制效果。`;
}

function buildConfigPreset(planType, answers, demandRatios, selectedProductSystem, planOutput) {
  const quantities = planOutput.componentQuantities;
  const hangingRods = Number(quantities.singleRail || 0) + Number(quantities.doubleRail || 0);
  const shelves = Number(quantities.woodShelf || 0);
  const glassShelves = Number(quantities.glassShelf || 0);
  const cabinets = Number(quantities.cabinet || 0);
  const jewelryBoxes = Number(quantities.jewelryBox || 0);
  const trouserRacks = Number(quantities.trouserRack || 0);
  const roomHeight = answers.dimensions?.height || 2700;
  const lighting = planType === "basic"
    ? false
    : supportsLighting(selectedProductSystem)
      && (planType === "premium" || (planOutput.lighting && getBudgetUpperBound(answers.budget) >= planOutput.minBudgetForLighting))
      ? true
      : false;
  return {
    productSystemId: selectedProductSystem?.id || "",
    spaceType: answers.spaceUse || "",
    layoutType: answers.dimensions?.layoutType || "I型",
    planType,
    roomWidth: answers.dimensions?.width || 3600,
    roomDepth: answers.dimensions?.depth || 2800,
    roomHeight,
    demandRatios,
    demandQuantityProfile: getDemandQuantityProfile(answers),
    componentQuantities: quantities,
    reservedZones: planOutput.reservedZones,
    zoneRequirements: planOutput.zones.map((zone) => ({
      zoneType: zone.zoneType,
      itemType: zone.itemType,
      demandQuantity: zone.quantity,
      demandWeight: zone.weight,
      preferredComponent: zone.componentType,
      allowedComponents: zone.allowedComponents,
      quantity: zone.requiredUnits,
      heightFromFloor: zone.railHeights?.[0] || getZoneInstallationHeight(zone.zoneType, roomHeight),
      clearHeight: zone.clearHeight,
      idealClearHeight: zone.idealClearHeight,
      exclusiveBay: zone.exclusiveBay,
      railHeights: zone.railHeights,
      priorityIndex: zone.priorityIndex
    })),
    installationHeights: {
      shelf: getZoneInstallationHeight("bagZone", roomHeight),
      hangingRod: getZoneInstallationHeight("shortHangZone", roomHeight),
      cabinet: getZoneInstallationHeight("generalStorageZone", roomHeight),
      glassShelf: getZoneInstallationHeight("displayZone", roomHeight),
      jewelryBox: getZoneInstallationHeight("jewelryZone", roomHeight),
      trouserRack: getZoneInstallationHeight("trouserZone", roomHeight),
      mixedStorage: getZoneInstallationHeight("jewelryZone", roomHeight)
    },
    shelfLevel: planType === "basic" ? "basic" : planType === "value" ? "medium" : "high",
    shelves,
    hangingRods,
    drawers: 0,
    cabinets,
    glassShelves,
    lighting,
    jewelryBox: jewelryBoxes > 0,
    jewelryBoxCount: jewelryBoxes,
    trouserRack: trouserRacks > 0,
    trouserRackCount: trouserRacks
  };
}

function hasDisplayDemand(selected) {
  return hasAny(selected, ["展示收藏", "展示摆件", "摆件", "收藏品", "综合展示", "酒具", "茶具", "包包展示"]);
}

function shouldAddLighting(selected) {
  return hasDisplayDemand(selected) || hasAny(selected, ["收藏品", "酒具", "茶具"]);
}

function supportsLighting(productSystem) {
  return ["aluminum-base-supported", "wall-mounted-v2"].includes(productSystem?.id || "");
}

function getBudgetUpperBound(budgetRange) {
  if (budgetRange === "3,000以下") return 3000;
  if (String(budgetRange || "").includes("以上")) return Infinity;
  const values = String(budgetRange || "").match(/[\d,]+/g)?.map((value) => Number(value.replace(/,/g, ""))) || [];
  return values[values.length - 1] || 0;
}

function supportsGlassShelf(productSystem) {
  return !["japanese-closet", "carbon-steel-post-wardrobe-v2"].includes(productSystem?.id || "");
}

function pushUnique(list, itemName) {
  if (itemName && !list.includes(itemName)) list.push(itemName);
}

export function recommendSystem({ spaceUse = "", budget = "", demands = [] }) {
  if (budget === "3,000以下") return "碳钢立柱衣柜";
  if (budget === "3,000 - 6,000") return "铝日式立柱衣柜";
  if (spaceUse === "客厅展示") return demands.includes("收藏品") ? "铝立柱衣柜" : "铝托底式衣柜";
  if (spaceUse === "书房收纳") return "铝立柱衣柜";
  if (spaceUse === "玄关收纳") return "铝托底式衣柜";
  return "铝壁挂式衣柜";
}

export function buildPlanRecommendation(answers) {
  const dimensions = { width: 3600, depth: 2800, height: 2700, layoutType: "I型", ...(answers.dimensions || {}) };
  const demands = getSelectedDemands(answers);
  const budget = answers.budget || "9,000 - 12,000";
  const budgetRange = parseBudgetRange(budget);
  const areaFactor = Math.max(0.82, Math.min(1.42, (dimensions.width * dimensions.depth) / 10080000));
  const demandProfile = calculateDemandProfile(answers);
  const itemCounts = estimateItemCounts(answers);
  const zoneCards = buildZoneCards(answers, demandProfile);
  const demandPersona = buildDemandPersona(answers);
  const heightRecommendations = getHeightRecommendations(answers);
  const functionZones = getFunctionZoneRecommendations(answers);
  const analysisText = generateAnalysisText(answers);
  const system = recommendSystem({ spaceUse: answers.spaceUse, budget, demands });
  const budgetMax = budgetRange.max;
  const budgetMin = budgetRange.min;
  const baseInsideBudget = budgetMax > 0 ? Math.max(budgetMin + 600, budgetMax - 500) : 2800;
  const summaries = createSummaries(answers);
  const prices = [
    Math.round((baseInsideBudget * areaFactor) / 100) * 100,
    Math.round(((budgetMax + 400) * areaFactor) / 100) * 100,
    Math.round(((budgetMax + 950) * areaFactor) / 100) * 100
  ];
  return {
    dimensions,
    budget,
    demands,
    demandProfile,
    demandRatios: demandProfile,
    itemCounts,
    zoneCards,
    demandPersona,
    heightRecommendations,
    functionZones,
    analysisText,
    system,
    plans: [
      { code: "A", name: "预算优先", price: prices[0], satisfaction: "70%", position: "价格控制在预算区间内，配置偏基础。", summary: summaries.basic },
      { code: "B", name: "推荐方案", price: prices[1], satisfaction: "85%", position: "价格略高于预算上限约 300-500，配置更均衡。", summary: summaries.balanced, recommended: true },
      { code: "C", name: "理想方案", price: prices[2], satisfaction: "96%", position: "价格高于预算上限约 800-1000，配置更完整。", summary: summaries.complete }
    ]
  };
}

function createSummaries(answers) {
  const spaceType = answers.spaceUse;
  const weightedDemands = getWeightedDemands(answers);
  const demands = weightedDemands.map((item) => item.name);
  const demandText = demands.slice(0, 4).join("、") || "综合需求";
  const priorityText = buildPrioritySummary(weightedDemands, spaceType);
  const dimensionText = getDimensionSummaryText(answers.dimensions);
  if (spaceType === "玄关收纳") {
    return {
      basic: `${priorityText}，以高频玄关收纳为主，控制基础配置。${dimensionText}`,
      balanced: `${priorityText}，增加随手抽屉、包包区和雨伞位置，让玄关更顺手。${dimensionText}`,
      complete: `围绕${demandText}强化鞋层板、挂衣区、随手抽屉、包包区与展示区。${dimensionText}`
    };
  }
  if (spaceType === "客厅展示") {
    return {
      basic: `${priorityText}，保留开放层板和局部柜体收纳，控制整体投入。${dimensionText}`,
      balanced: `${priorityText}，结合玻璃层板、灯光和开放展示，让展示更有层次。${dimensionText}`,
      complete: `围绕${demandText}配置玻璃层板、灯光、开放层板、柜体收纳和展示摆件区。${dimensionText}`
    };
  }
  if (spaceType === "书房收纳") {
    return {
      basic: `${priorityText}，以书架层板和基础封闭柜为主，保证文件与书籍容量。${dimensionText}`,
      balanced: `${priorityText}，增加文件抽屉和展示层板，兼顾办公与阅读。${dimensionText}`,
      complete: `围绕${demandText}配置书架层板、文件抽屉、封闭柜和展示层板。${dimensionText}`
    };
  }
  return {
    basic: `${priorityText}，保留核心挂衣区、层板区和基础鞋包收纳。${dimensionText}`,
    balanced: `${priorityText}，平衡挂衣区、层板区、抽屉、鞋包与首饰盒，适合日常使用。${dimensionText}`,
    complete: `围绕${demandText}强化挂衣区、层板区、抽屉、鞋包和首饰盒。${dimensionText}`
  };
}

function getDimensionPlanningNote(dimensions = {}) {
  const notes = [];
  if (dimensions.layoutType === "L型") notes.push("转角区域建议优先用于连续层板或转角挂衣。");
  if (dimensions.layoutType === "U型") notes.push("U型空间适合形成环绕式分区与家庭共享动线。");
  if (Number(dimensions.height) > 2700) notes.push("层高较充足，可增加顶部储物区。");
  if (Number(dimensions.height) > 0 && Number(dimensions.height) < 2400) notes.push("层高偏低，建议减少高位储物比例。");
  return notes.length ? notes.join("") : "";
}

function getDimensionSummaryText(dimensions = {}) {
  const notes = [];
  if (dimensions.layoutType === "L型") notes.push("布局上优先考虑转角挂衣与转角层板。");
  if (dimensions.layoutType === "U型") notes.push("布局上优先考虑环绕式收纳与家庭共享分区。");
  if (Number(dimensions.height) > 2700) notes.push("高度条件支持增加顶部储物区。");
  if (Number(dimensions.height) > 0 && Number(dimensions.height) < 2400) notes.push("高度偏低，减少高位储物推荐。");
  return notes.length ? notes.join("") : "";
}

function buildPrioritySummary(weightedDemands, spaceType = "") {
  const top = weightedDemands[0];
  const second = weightedDemands[1];
  if (!top) return `${spaceType || "空间"}以综合收纳为主`;
  const topAction = `针对${top.name}${getWeightLabel(top.weight)}，${getDemandAction(top.name)}`;
  if (!second) return `优先${topAction}`;
  return `优先${topAction}，并辅助配置${getDemandAction(second.name)}`;
}

function getWeightLabel(weight = 1) {
  if (weight >= 3) return "非常集中";
  if (weight === 2) return "明显偏多";
  return "较多";
}

function getDemandAction(name) {
  const actions = {
    "短衣": "增加短衣挂放区",
    "长衣": "增加长衣挂放区",
    "裤子": "强化裤架区",
    "鞋子": "增加鞋层板",
    "包包": "强化包包层板",
    "首饰": "配置抽屉或首饰盒",
    "被褥": "预留被褥大件区",
    "行李箱": "预留行李箱大件位",
    "展示收藏": "强化展示层板",
    "鞋子收纳": "增加鞋层板",
    "外套挂放": "增加短挂区",
    "包包放置": "设置包包随手区",
    "雨伞收纳": "预留雨伞竖放区",
    "钥匙杂物": "设置随手抽屉",
    "展示摆件": "强化展示格",
    "摆件": "强化开放展示层板",
    "收藏品": "强化收藏展示区",
    "书籍": "增加书架层板",
    "酒具": "配置玻璃层板与灯光",
    "茶具": "配置开放层板与灯光",
    "包包展示": "强化包包展示区",
    "综合展示": "平衡开放展示与柜体",
    "文件": "增加文件抽屉",
    "电子设备": "预留设备与走线空间",
    "综合收纳": "平衡层板、抽屉和柜体"
  };
  return actions[name] || `${name}功能区`;
}

export function getRatioLabels(spaceType = "") {
  if (spaceType === "玄关收纳") {
    return { shoe: "鞋区", hanging: "挂放区", handy: "随手物品区", display: "展示区", bulky: "大件储物区" };
  }
  if (spaceType === "客厅展示") {
    return { display: "展示区", glassShelf: "玻璃层板", closedStorage: "封闭收纳", lighting: "灯光氛围" };
  }
  if (spaceType === "书房收纳") {
    return { books: "书籍区", files: "文件区", display: "展示区", cabinet: "柜体收纳" };
  }
  return { hanging: "挂衣区", trouser: "裤架区", shoe: "鞋区", bag: "包包区", jewelry: "首饰区", bedding: "被褥区", luggage: "行李箱区", display: "展示区" };
}
