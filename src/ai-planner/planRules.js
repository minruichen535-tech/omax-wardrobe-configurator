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
    "长衣": { min: 25, max: 35, unit: "件" },
    "裤子": { min: 35, max: 45, unit: "条" },
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
  const counts = wardrobeItemBaseRangeByUsers[answers.people] || wardrobeItemBaseRangeByUsers["2人"];
  return Object.keys(counts)
    .filter((name) => selected.has(name))
    .map((name) => ({
      name,
      value: getWeightedItemEstimate(name, answers.people, Number(weights[name]) || 1)
    }));
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
  const zones = Object.entries(calculateRelevantZones(answers))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => getRatioLabels(answers.spaceUse)[key] || key);
  const demandText = weightedDemands.length ? weightedDemands.map((item) => item.name).join("、") : "综合收纳";
  const topDemand = weightedDemands[0]?.name;
  const secondDemand = weightedDemands[1]?.name;
  const topLevel = weightedDemands[0] ? getWeightLabel(weightedDemands[0].weight) : "";
  const priorityText = topDemand
    ? `${topDemand}需求${topLevel}${secondDemand ? `，其次是${secondDemand}` : ""}`
    : "综合收纳需求较均衡";
  if (answers.spaceUse === "玄关收纳") {
    return `系统判断：${priorityText}。玄关需求集中在${demandText}，建议优先保证${zones.join("、")}，让进出门高频动作更顺手。`;
  }
  if (answers.spaceUse === "客厅展示") {
    return `系统判断：${priorityText}。展示需求集中在${demandText}，建议用${zones.join("、")}形成层次，并控制封闭收纳比例。`;
  }
  if (answers.spaceUse === "书房收纳") {
    return `系统判断：${priorityText}。书房需求集中在${demandText}，建议优先规划${zones.join("、")}，兼顾取用效率和视觉整洁。`;
  }
  return `系统判断：${priorityText}。您的主要需求集中在${demandText}，建议优先保证${zones.join("、")}，并预留部分层板区用于换季衣物。`;
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
  const dimensions = answers.dimensions || { width: 3600, depth: 2800 };
  const demands = getSelectedDemands(answers);
  const budget = answers.budget || "8,000 - 12,000";
  const budgetRange = parseBudgetRange(budget);
  const areaFactor = Math.max(0.82, Math.min(1.42, (dimensions.width * dimensions.depth) / 10080000));
  const demandProfile = calculateDemandProfile(answers);
  const itemCounts = estimateItemCounts(answers);
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
  if (spaceType === "玄关收纳") {
    return {
      basic: `${priorityText}，以高频玄关收纳为主，控制基础配置。`,
      balanced: `${priorityText}，增加随手抽屉、包包区和雨伞位置，让玄关更顺手。`,
      complete: `围绕${demandText}强化鞋层板、挂衣区、随手抽屉、包包区与展示区。`
    };
  }
  if (spaceType === "客厅展示") {
    return {
      basic: `${priorityText}，保留开放层板和局部柜体收纳，控制整体投入。`,
      balanced: `${priorityText}，结合玻璃层板、灯光和开放展示，让展示更有层次。`,
      complete: `围绕${demandText}配置玻璃层板、灯光、开放层板、柜体收纳和展示摆件区。`
    };
  }
  if (spaceType === "书房收纳") {
    return {
      basic: `${priorityText}，以书架层板和基础封闭柜为主，保证文件与书籍容量。`,
      balanced: `${priorityText}，增加文件抽屉和展示层板，兼顾办公与阅读。`,
      complete: `围绕${demandText}配置书架层板、文件抽屉、封闭柜和展示层板。`
    };
  }
  return {
    basic: `${priorityText}，保留核心挂衣区、层板区和基础鞋包收纳。`,
    balanced: `${priorityText}，平衡挂衣区、层板区、抽屉、鞋包与首饰盒，适合日常使用。`,
    complete: `围绕${demandText}强化挂衣区、层板区、抽屉、鞋包和首饰盒。`
  };
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
