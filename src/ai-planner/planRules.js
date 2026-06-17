const budgetOptions = ["3,000以下", "3,000 - 5,000", "5,000 - 8,000", "8,000 - 12,000", "12,000 - 18,000", "18,000+"];

const budgetRanges = {
  "3,000以下": { min: 0, max: 3000 },
  "3,000 - 5,000": { min: 3000, max: 5000 },
  "5,000 - 8,000": { min: 5000, max: 8000 },
  "8,000 - 12,000": { min: 8000, max: 12000 },
  "12,000 - 18,000": { min: 12000, max: 18000 },
  "18,000+": { min: 18000, max: 22000 }
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

const wardrobeItemBaseRangeByUsers = {
  "1人": {
    "短衣": { min: 35, max: 45, unit: "件" },
    "长衣": { min: 8, max: 12, unit: "件" },
    "裤子": { min: 10, max: 15, unit: "条" },
    "鞋子": { min: 15, max: 25, unit: "双" },
    "包包": { min: 3, max: 6, unit: "个" }
  },
  "2人": {
    "短衣": { min: 70, max: 90, unit: "件" },
    "长衣": { min: 15, max: 25, unit: "件" },
    "裤子": { min: 20, max: 30, unit: "条" },
    "鞋子": { min: 30, max: 45, unit: "双" },
    "包包": { min: 6, max: 12, unit: "个" }
  },
  "3人": {
    "短衣": { min: 100, max: 130, unit: "件" },
    "长衣": { min: 30, max: 45, unit: "件" },
    "裤子": { min: 40, max: 55, unit: "条" },
    "鞋子": { min: 45, max: 60, unit: "双" },
    "包包": { min: 10, max: 18, unit: "个" }
  },
  "4人以上": {
    "短衣": { min: 130, unit: "件", openEnded: true },
    "长衣": { min: 35, unit: "件", openEnded: true },
    "裤子": { min: 45, unit: "条", openEnded: true },
    "鞋子": { min: 60, unit: "双", openEnded: true },
    "包包": { min: 18, unit: "个", openEnded: true }
  }
};

const itemZoneScoreMap = {
  "长衣": [["hanging", 26]],
  "短衣": [["hanging", 24]],
  "裤子": [["trouser", 18]],
  "鞋子": [["shoe", 18]],
  "包包": [["bag", 16]],
  "首饰": [["jewelry", 14]],
  "被褥": [["bedding", 16]],
  "行李箱": [["luggage", 16]],
  "展示收藏": [["display", 18]],
  "鞋子收纳": [["shoe", 24]],
  "外套挂放": [["hanging", 20]],
  "包包放置": [["handy", 12], ["display", 8]],
  "雨伞收纳": [["handy", 12]],
  "钥匙杂物": [["handy", 14]],
  "展示摆件": [["display", 16]],
  "摆件": [["display", 18], ["lighting", 8]],
  "收藏品": [["display", 20], ["glassShelf", 12], ["lighting", 8]],
  "书籍": [["closedStorage", 16], ["books", 22]],
  "酒具": [["glassShelf", 18], ["lighting", 10]],
  "茶具": [["glassShelf", 18], ["lighting", 10]],
  "包包展示": [["display", 16], ["lighting", 8]],
  "综合展示": [["display", 14], ["closedStorage", 10]],
  "文件": [["files", 20]],
  "电子设备": [["files", 12], ["cabinet", 12]],
  "综合收纳": [["cabinet", 18]]
};

const firstQuestion = {
  key: "spaceUse",
  title: "这个空间主要用于什么？",
  note: "先从空间的日常角色开始。",
  options: ["衣帽间", "主卧衣柜", "玄关收纳", "客厅展示", "书房收纳"]
};

const wardrobeFlow = [
  firstQuestion,
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
  },
  {
    key: "dimensions",
    title: "空间尺寸是多少？",
    note: "大致尺寸即可，设计顾问会在下一阶段为您复核。",
    type: "dimensions"
  },
  budgetQuestion()
];

const entryFlow = [
  firstQuestion,
  {
    key: "demands",
    title: "这个玄关主要满足什么需求？",
    note: "可多选，我们会平衡鞋区、挂放和随手收纳。",
    type: "multi",
    options: ["鞋子收纳", "外套挂放", "包包放置", "雨伞收纳", "钥匙杂物", "行李箱", "展示摆件"]
  },
  {
    key: "people",
    title: "日常使用人数是多少？",
    note: "使用人数会影响鞋层板数量和常用区容量。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "dimensions",
    title: "玄关空间尺寸是多少？",
    note: "宽度和深度会决定柜体层次与通行动线。",
    type: "dimensions"
  },
  budgetQuestion()
];

const displayFlow = [
  firstQuestion,
  {
    key: "demands",
    title: "主要展示什么内容？",
    note: "可多选，系统会据此判断开放展示、玻璃层板和灯光比例。",
    type: "multi",
    options: ["摆件", "收藏品", "书籍", "酒具", "茶具", "包包展示", "综合展示"]
  },
  {
    key: "style",
    title: "你希望整体更偏向哪种感觉？",
    note: "风格会影响开放比例、材质层次和灯光氛围。",
    options: ["极简", "现代", "轻奢", "日式", "温润自然"]
  },
  {
    key: "dimensions",
    title: "展示墙尺寸是多少？",
    note: "宽度和深度会决定展示尺度与柜体收纳占比。",
    type: "dimensions"
  },
  budgetQuestion()
];

const studyFlow = [
  firstQuestion,
  {
    key: "demands",
    title: "主要收纳什么内容？",
    note: "可多选，系统会据此分配书籍、文件、设备和展示比例。",
    type: "multi",
    options: ["书籍", "文件", "电子设备", "收藏品", "摆件", "综合收纳"]
  },
  {
    key: "style",
    title: "你希望书房更偏向哪种使用方式？",
    note: "使用方式会影响开放层板、文件抽屉和封闭柜比例。",
    options: ["办公为主", "阅读为主", "展示为主", "收纳为主", "综合使用"]
  },
  {
    key: "dimensions",
    title: "书房收纳墙尺寸是多少？",
    note: "宽度和深度会决定书架层板与柜体容量。",
    type: "dimensions"
  },
  budgetQuestion()
];

function budgetQuestion() {
  return {
    key: "budget",
    title: "希望控制在什么范围？",
    note: "我们会同时保留预算、体验和理想状态三种可能。",
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
  return budgetRanges[label] || budgetRanges["8,000 - 12,000"];
}

export function calculateDemandProfile(answers) {
  return calculateRelevantZones(answers);
}

export function calculateRelevantZones(answers) {
  const weights = getDemandWeights(answers);
  const scores = {};
  Object.entries(weights).forEach(([itemName, weight]) => {
    const numericWeight = Number(weight) || 0;
    if (numericWeight <= 0) return;
    (itemZoneScoreMap[itemName] || []).forEach(([zoneKey, score]) => {
      scores[zoneKey] = (scores[zoneKey] || 0) + score * numericWeight;
    });
  });
  return normalizeRelevant(Object.entries(scores));
}

function getSelectedDemands(answers) {
  if (Array.isArray(answers.demands)) return answers.demands;
  if (answers.demands && typeof answers.demands === "object") {
    return Object.entries(answers.demands)
      .filter(([, weight]) => Number(weight) > 0)
      .map(([key]) => key);
  }
  return [];
}

function getDemandWeights(answers) {
  if (answers.demands && !Array.isArray(answers.demands) && typeof answers.demands === "object") {
    return answers.demands;
  }
  return answers.demandsWeights || {};
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
  const selected = new Set(getSelectedDemands(answers));
  const weights = getDemandWeights(answers);
  if (!["衣帽间", "主卧衣柜"].includes(answers.spaceUse)) return [];
  return getSelectedDemands(answers)
    .filter((name) => selected.has(name))
    .map((name) => ({
      name,
      value: getDemandItemEstimate(name, answers, Number(weights[name]) || 1)
    }))
    .filter((item) => item.value);
}

export function getWeightedItemEstimate(itemName, users = "2人", weight = 1) {
  const baseRange = wardrobeItemBaseRangeByUsers[users]?.[itemName] || wardrobeItemBaseRangeByUsers["2人"]?.[itemName];
  if (!baseRange) return "";
  const normalizedWeight = Math.max(1, Math.min(3, Number(weight) || 1));
  if (normalizedWeight === 1) return formatRange(baseRange);
  const minFactor = normalizedWeight === 2 ? 1.15 : 1.35;
  const maxFactor = normalizedWeight === 2 ? 1.25 : 1.5;
  if (baseRange.openEnded) {
    return `${roundToFive(baseRange.min * minFactor)}${baseRange.unit}以上`;
  }
  return `${roundToFive(baseRange.min * minFactor)}-${roundToFive(baseRange.max * maxFactor)}${baseRange.unit}`;
}

function formatRange(range) {
  if (range.openEnded) return `${range.min}${range.unit}以上`;
  return `${range.min}-${range.max}${range.unit}`;
}

function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

function getDemandItemEstimate(itemName, answers, weight = 1) {
  const wardrobeEstimate = getWeightedItemEstimate(itemName, answers.people, weight);
  if (wardrobeEstimate) return wardrobeEstimate;
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
    const zoneKey = (itemZoneScoreMap[itemName] || [])
      .map(([key]) => key)
      .find((key) => cardsByZone.has(key));
    if (!zoneKey) return;
    cardsByZone.get(zoneKey).items.push({
      label: itemName,
      estimate: getDemandItemEstimate(itemName, answers, Number(weights[itemName]) || 1)
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
  const selected = new Set(getSelectedDemands(answers));
  const spaceType = answers.spaceUse;
  if (spaceType === "玄关收纳") {
    return [
      selected.has("鞋子收纳") && item("鞋层板", "层间距 160-220mm，可按常穿鞋 / 换季鞋分区。"),
      selected.has("外套挂放") && item("短挂区", "建议净高 900-1100mm。"),
      selected.has("包包放置") && item("包包区", "建议开放层板或抽屉组合，高度 300-450mm。"),
      selected.has("雨伞收纳") && item("雨伞区", "建议预留窄高区或底部竖放区。"),
      selected.has("钥匙杂物") && item("随手物品区", "建议设置小抽屉或随手置物层。"),
      selected.has("行李箱") && item("行李箱区", "建议底部大件区，高度 600-800mm。"),
      selected.has("展示摆件") && item("展示区", "建议开放展示格或灯光层板。")
    ].filter(Boolean);
  }
  if (spaceType === "客厅展示") {
    return [
      hasAny(selected, ["摆件", "收藏品"]) && item("开放展示层板", "摆件 / 收藏品建议层间距 300-450mm。"),
      selected.has("书籍") && item("书籍层板", "建议层板净高 280-350mm。"),
      hasAny(selected, ["酒具", "茶具"]) && item("酒具 / 茶具区", "建议玻璃层板或开放层板，搭配灯光。"),
      selected.has("包包展示") && item("包包展示区", "建议层板净高 300-450mm。"),
      selected.has("综合展示") && item("综合展示区", "建议开放层板 + 局部柜体收纳组合。")
    ].filter(Boolean);
  }
  if (spaceType === "书房收纳") {
    return [
      selected.has("书籍") && item("书籍区", "建议层板净高 280-350mm。"),
      selected.has("文件") && item("文件区", "建议抽屉或封闭柜，净高 320-380mm。"),
      selected.has("电子设备") && item("电子设备区", "建议预留开放层板及走线空间。"),
      hasAny(selected, ["收藏品", "摆件"]) && item("展示区", "建议展示层板或玻璃层板。"),
      selected.has("综合收纳") && item("综合收纳区", "建议层板 + 抽屉 + 封闭柜组合。")
    ].filter(Boolean);
  }
  return [
    selected.has("短衣") && item("短衣区", "建议净高 900-1100mm。"),
    selected.has("长衣") && item("长衣区", "建议净高 1300-1500mm。"),
    selected.has("裤子") && item("裤架区", "建议净高 650-800mm。"),
    selected.has("鞋子") && item("鞋层板", "建议层间距 160-220mm。"),
    selected.has("包包") && item("包包区", "建议净高 300-450mm。"),
    selected.has("被褥") && item("被褥区", "建议净高 400-600mm。"),
    selected.has("行李箱") && item("行李箱区", "建议净高 600-800mm。"),
    selected.has("首饰") && item("首饰区", "建议搭配抽屉或首饰盒，高度 900-1100mm。")
  ].filter(Boolean);
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

export function recommendSystem({ spaceUse = "", budget = "", demands = [] }) {
  if (budget === "3,000以下") return "碳钢立柱衣柜";
  if (budget === "3,000 - 5,000") return "铝日式立柱衣柜";
  if (spaceUse === "客厅展示") return demands.includes("收藏品") ? "铝立柱衣柜" : "铝托底式衣柜";
  if (spaceUse === "书房收纳") return "铝立柱衣柜";
  if (spaceUse === "玄关收纳") return "铝托底式衣柜";
  return "铝壁挂式衣柜";
}

export function buildPlanRecommendation(answers) {
  const dimensions = { width: 3600, depth: 2800, height: 2700, layoutType: "I型", ...(answers.dimensions || {}) };
  const demands = getSelectedDemands(answers);
  const budget = answers.budget || "8,000 - 12,000";
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
