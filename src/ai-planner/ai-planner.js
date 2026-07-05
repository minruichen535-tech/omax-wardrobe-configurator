import {
  buildPlanRecommendation,
  generateRecommendedPlans,
  getCandidatePlanDebugStats,
  getJapaneseClosetBudgetAvailability,
  getQuestionFlow,
  getRatioLabels,
  getZonePresentation
} from "./planRules.js?v=japanese-drawer-merchandising-20260703-01";
import {
  loadCaseMatchingRules,
  loadClosetRules
} from "../rules/demandRules.js?v=component-upgrade-rules-20260627-01";

const state = {
  step: 0,
  answers: {},
  recommendation: null,
  selectedProductSystem: null,
  selectedPlan: null,
  currentPlans: [],
  showPlannerVisualAssets: true
};

const shell = document.querySelector(".planner-shell");
const title = document.querySelector(".question-title");
const note = document.querySelector(".question-note");
const answerContent = document.querySelector(".answer-content");
const currentProgress = document.querySelector(".progress-current");
const progressLine = document.querySelector(".planner-progress i");
const totalProgress = document.querySelector(".planner-progress span:last-child");
const backButton = document.querySelector(".back-button");
const iconRoot = "/customer-home/icons/";
const iconVersion = "20260617";
const analysisLoadingStages = [
  "正在识别空间类型",
  "正在分析收纳需求",
  "正在匹配预算区间",
  "正在生成配置方向",
  "已完成需求分析"
];
const layoutOptions = [
  { value: "I型", title: "I型", subtitle: "单面布局", sketch: "│" },
  { value: "L型", title: "L型", subtitle: "转角布局", sketch: "└" },
  { value: "U型", title: "U型", subtitle: "三面布局", sketch: "└─┘" }
];
const recommendedPlanTypes = ["basic", "value", "premium"];
const planDisplayNames = {
  basic: "基础实用款",
  value: "高性价比款",
  premium: "高配理想款"
};
const planDemandCoverage = {
  basic: "满足约 75%",
  value: "满足约 90%",
  premium: "满足约 100%"
};
const planFeatureSummaries = {
  basic: "满足基础收纳需求",
  value: "收纳效率与预算平衡",
  premium: "兼顾未来扩展与功能体验"
};
const recommendedPlanFallbacks = {
  basic: { planName: "基础实用款", planCapacityCoverage: "基础方案候选暂未生成" },
  value: { planName: "高性价比款", planCapacityCoverage: "性价比方案候选暂未生成" },
  premium: { planName: "高配理想款", planCapacityCoverage: "高配方案候选暂未生成" }
};
const upgradeCatalog = [
  { key: "trouserRack", name: "裤架", price: 660, solves: "解决裤装收纳问题", keywords: ["裤"] },
  { key: "jewelryBox", name: "首饰盒", price: 700, solves: "解决首饰分类问题", keywords: ["首饰"] },
  { key: "cabinet", name: "柜体", price: 800, solves: "提升封闭收纳与杂物整理能力", keywords: ["被褥", "行李箱", "综合收纳", "文件", "电子设备"] },
  { key: "lighting", name: "灯光", price: null, solves: "提升展示与夜间取放体验", keywords: ["展示", "收藏", "包包", "摆件"] },
  { key: "glassShelf", name: "玻璃层板", price: null, solves: "增强包包与展示区通透感", keywords: ["包包", "展示", "收藏"] },
  { key: "meshBasket", name: "网篮", price: null, solves: "改善小件与换季物品分类", keywords: ["被褥", "行李箱", "综合收纳"] }
];
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
let analysisLoadingTimers = [];
let activePlanPreviewCleanup = null;
let activeResultPreviewCleanup = null;
let planCardPreviewCleanups = [];
const optionIconMap = {
  "1人": "one-people.png",
  "2人": "two-people.png",
  "3人": "three-people.png",
  "4人以上": "four people.png",
  "长衣": "long-cloth.png",
  "短衣": "short-cloth.png",
  "裤子": "trousers.png",
  "鞋子": "shoes.png",
  "包包": "bags.png",
  "首饰": "jewelry.png",
  "被褥": "bedding.png",
  "行李箱": "luggage.png",
  "展示收藏": "display.png",
  "鞋子收纳": "shoes.png",
  "外套挂放": "coat.png",
  "包包放置": "bags.png",
  "雨伞收纳": "umbrella.png",
  "钥匙杂物": "keys.png",
  "展示摆件": "decor.png",
  "摆件": "decor.png",
  "收藏品": "collectibles.png",
  "书籍": "book.png",
  "酒具": "    barware.png",
  "茶具": "tea-set.png",
  "包包展示": "bags.png",
  "综合展示": "display.png",
  "文件": "general-storage.png",
  "电子设备": "electronics.png",
  "综合收纳": "general-storage.png"
};

const productSystems = [
  {
    id: "japanese-closet",
    name: "铝日式立柱衣柜",
    image: "Japaness-Closet.png",
    description: "极简日式风格，开放展示与收纳结合，适合卧室与衣帽间空间。",
    features: ["开放挂衣", "木层板", "抽屉组合", "灯光系统可选"]
  },
  {
    id: "aluminum-post-wardrobe",
    name: "铝立柱衣柜",
    image: "Aluminum-Post-Wardrob.png",
    description: "自由组合能力强，兼顾展示与收纳。",
    features: ["开放挂衣", "玻璃层板", "柜体组合", "灯光系统"]
  },
  {
    id: "carbon-steel-post-wardrobe-v2",
    name: "碳钢立柱衣柜",
    image: "Carbon-Steel-Post-Wardrobe.png",
    description: "高性价比方案，结构简洁耐用。",
    features: ["开放挂衣", "层板收纳", "鞋区组合", "灵活扩展"]
  },
  {
    id: "aluminum-base-supported",
    name: "铝托底式衣柜",
    image: "Aluminum-Base-Supported.png",
    description: "更强承重能力，适合多功能收纳空间。",
    features: ["展示收纳", "抽屉组合", "柜体扩展", "综合收纳"]
  },
  {
    id: "wall-mounted-v2",
    name: "铝壁挂式衣柜",
    image: "Wall Mounted .png.png",
    description: "悬浮视觉效果，高端定制感更强。",
    features: ["悬挂收纳", "柜体组合", "灯光系统", "极简视觉"]
  }
];

function getCurrentQuestions() {
  return getQuestionFlow(state.answers.spaceUse);
}

function clearAnalysisLoadingTimers() {
  analysisLoadingTimers.forEach((timer) => window.clearTimeout(timer));
  analysisLoadingTimers = [];
}

function clearPlanCardPreviews() {
  planCardPreviewCleanups.forEach((cleanup) => cleanup?.());
  planCardPreviewCleanups = [];
  activeResultPreviewCleanup?.();
  activeResultPreviewCleanup = null;
}

function renderQuestion(direction = "forward") {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  const questions = getCurrentQuestions();
  const question = questions[state.step];
  shell.dataset.direction = direction;
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  void shell.offsetWidth;
  shell.classList.add("is-changing");

  title.textContent = question.title;
  note.textContent = question.note;
  currentProgress.textContent = String(state.step + 2);
  totalProgress.textContent = String(questions.length + 1);
  progressLine.style.transform = `scaleX(${(state.step + 2) / (questions.length + 1)})`;
  backButton.disabled = false;
  answerContent.replaceChildren();

  if (question.type === "layout") {
    renderLayoutOptions(question);
  } else if (question.type === "dimensions") {
    renderDimensions(question);
  } else if (question.type === "multi") {
    renderMultiOptions(question);
  } else {
    renderOptions(question);
  }
}

function renderLayoutOptions(question) {
  const selectedLayout = state.answers.layoutType || state.answers.dimensions?.layoutType || "I型";
  const list = document.createElement("div");
  list.className = "layout-options planner-layout-options";
  layoutOptions.forEach((layout, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layout-option";
    button.style.setProperty("--option-index", index);
    button.dataset.selected = selectedLayout === layout.value ? "true" : "false";
    button.innerHTML = `
      <span class="layout-sketch">${layout.sketch}</span>
      <strong>${layout.title}</strong>
      <em>${layout.subtitle}</em>
    `;
    button.addEventListener("click", () => selectOption(question.key, layout.value, button));
    list.appendChild(button);
  });
  answerContent.appendChild(list);
}

function renderOptions(question) {
  const list = document.createElement("div");
  const usesPeopleIcons = question.key === "people";
  const budgetAvailability = question.key === "budget"
    ? getJapaneseClosetBudgetAvailability(state.answers)
    : null;
  const options = budgetAvailability
    ? budgetAvailability.dynamicBudgetRanges.map((range) => range.label)
    : question.options;
  if (budgetAvailability && state.answers.budget
    && (!options.includes(state.answers.budget)
      || budgetAvailability.disabledBudgetRanges.includes(state.answers.budget))) {
    delete state.answers.budget;
    state.recommendation = null;
    note.textContent = "空间尺寸已变化，请重新选择适合当前空间的预算区间。";
  }
  list.className = `answer-options${usesPeopleIcons ? " people-options" : ""}`;

  options.forEach((option, index) => {
    const iconPath = usesPeopleIcons ? getOptionIconPath(option) : "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `answer-option${iconPath ? " people-option has-option-icon" : ""}`;
    button.style.setProperty("--option-index", index);
    button.dataset.selected = state.answers[question.key] === option ? "true" : "false";
    const disabledReason = budgetAvailability?.disabledReason?.[option] || "";
    if (disabledReason) {
      button.disabled = true;
      button.title = "当前空间不适合该预算区间";
      button.dataset.disabledReason = "当前空间暂不适合该预算";
    }
    button.innerHTML = iconPath
      ? `<img class="option-icon people-icon" src="${iconPath}" alt="" loading="lazy" /><strong>${option}</strong>`
      : `<span>${String(index + 1).padStart(2, "0")}</span><strong>${option}</strong><i>→</i>${
        disabledReason ? `<small class="budget-disabled-note">当前空间暂不适合该预算</small>` : ""
      }`;
    button.addEventListener("click", () => selectOption(question.key, option, button));
    list.appendChild(button);
  });

  answerContent.appendChild(list);
  if (budgetAvailability && isCandidateDebugEnabled()) {
    const debug = document.createElement("pre");
    debug.className = "candidate-debug-panel";
    debug.textContent = [
      `bayCount = ${budgetAvailability.bayCount}`,
      `minPossiblePrice = ${budgetAvailability.minPossiblePrice}`,
      `normalPossiblePrice = ${budgetAvailability.normalPossiblePrice}`,
      `maxPossiblePrice = ${budgetAvailability.maxPossiblePrice}`,
      `dynamicBudgetRanges = ${budgetAvailability.dynamicBudgetRanges.map((range) => range.label).join(", ")}`,
      `disabledBudgetRanges = ${budgetAvailability.disabledBudgetRanges.join(", ") || "none"}`,
      `selectedBudgetRange = ${budgetAvailability.selectedBudgetRange || "none"}`,
      `basicTargetPrice = ${budgetAvailability.basicTargetPrice ?? "none"}`,
      `valueTargetPrice = ${budgetAvailability.valueTargetPrice ?? "none"}`,
      `premiumTargetPrice = ${budgetAvailability.premiumTargetPrice ?? "none"}`,
      `disabledReason = ${JSON.stringify(budgetAvailability.disabledReason)}`
    ].join("\n");
    answerContent.appendChild(debug);
  }
}

function renderMultiOptions(question) {
  const weightKey = `${question.key}Weights`;
  const existingAnswer = state.answers[question.key] || {};
  const weights = Array.isArray(existingAnswer)
    ? Object.fromEntries(existingAnswer.map((option) => [option, 1]))
    : { ...existingAnswer };
  Object.assign(weights, state.answers[weightKey] || {});
  const directionKey = `${question.key}WeightDirections`;
  const directions = { ...(state.answers[directionKey] || {}) };
  const selected = new Set(Object.entries(weights).filter(([, weight]) => Number(weight) > 0).map(([option]) => option));
  updateDemandQuantityProfile(question.key, weights);
  const wrapper = document.createElement("div");
  wrapper.className = "multi-select-panel";
  const list = document.createElement("div");
  list.className = "answer-options multi-options";

  question.options.forEach((option, index) => {
    const iconPath = getOptionIconPath(option);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `answer-option${iconPath ? " has-option-icon" : ""}`;
    const weight = weights[option] || (selected.has(option) ? 1 : 0);
    const color = getDemandColor(option);
    button.style.setProperty("--option-index", index);
    button.style.setProperty("--demand-color", color);
    button.dataset.selected = weight > 0 ? "true" : "false";
    button.dataset.weight = String(weight);
    button.innerHTML = `
      <span>${String(index + 1).padStart(2, "0")}</span>
      ${iconPath ? `<img class="option-icon demand-icon" src="${iconPath}" alt="" loading="lazy" />` : ""}
      <strong>${option}</strong>
      <em class="weight-blocks" aria-hidden="true">${renderWeightBlocks(weight)}</em>
      ${renderDemandLevelLabels(option, weight)}
    `;
    button.addEventListener("click", () => {
      const currentWeight = Number(weights[option]) || 0;
      const currentDirection = directions[option] === "down" ? -1 : 1;
      let nextWeight = currentWeight + currentDirection;
      let nextDirection = currentDirection;
      if (nextWeight >= 3) {
        nextWeight = 3;
        nextDirection = -1;
      } else if (nextWeight <= 0) {
        nextWeight = 0;
        nextDirection = 1;
      }
      if (!nextWeight) {
        selected.delete(option);
        delete weights[option];
        delete directions[option];
      } else {
        selected.add(option);
        weights[option] = nextWeight;
        directions[option] = nextDirection === -1 ? "down" : "up";
      }
      state.answers[question.key] = { ...weights };
      state.answers[weightKey] = { ...weights };
      state.answers[directionKey] = { ...directions };
      updateDemandQuantityProfile(question.key, weights);
      button.dataset.selected = nextWeight > 0 ? "true" : "false";
      button.dataset.weight = String(nextWeight);
      button.querySelector(".weight-blocks").innerHTML = renderWeightBlocks(nextWeight);
      const levelLabels = button.querySelector(".demand-level-labels");
      if (levelLabels) levelLabels.outerHTML = renderDemandLevelLabels(option, nextWeight);
    });
    list.appendChild(button);
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "dimension-next multi-next";
  next.innerHTML = "继续分析 <i>→</i>";
  next.addEventListener("click", () => {
    console.log("[ai-planner] multi-requirement-submit", {
      selectedCount: selected.size,
      weights: { ...weights }
    });
    if (!selected.size) return;
    state.answers[question.key] = { ...weights };
    state.answers[weightKey] = { ...weights };
    state.answers[directionKey] = { ...directions };
    updateDemandQuantityProfile(question.key, weights);
    nextStep();
  });

  wrapper.append(list, next);
  answerContent.appendChild(wrapper);
}

function renderWeightBlocks(weight) {
  const activeCount = Math.max(0, Math.min(3, Number(weight) || 0));
  return Array.from({ length: 3 }, (_, index) => (
    `<b data-active="${index < activeCount ? "true" : "false"}"></b>`
  )).join("");
}

function renderDemandLevelLabels(option, activeWeight = 0) {
  const levels = demandCapacityLevels[option];
  if (!levels) return "";
  return `
    <small class="demand-level-labels">
      ${levels.map((level, index) => `
        <span data-active="${Number(activeWeight) === index + 1 ? "true" : "false"}">${formatDemandLevelLabel(level, state.answers.people || "1人")}</span>
      `).join("")}
    </small>
  `;
}

function updateDemandQuantityProfile(questionKey, weights = {}) {
  if (questionKey !== "demands") return;
  const profile = {};
  Object.entries(weights).forEach(([name, weight]) => {
    const entry = getDemandQuantityEntry(name, Number(weight) || 0, state.answers.people || "1人");
    if (entry) profile[name] = entry;
  });
  state.answers.demandQuantityProfile = profile;
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
    estimate,
    levelLabel: formatDemandLevelLabel(level, peopleLabel)
  };
}

function formatDemandLevelLabel(level, peopleLabel) {
  if (!Number.isFinite(Number(level?.value))) return level?.label || level?.level || "";
  const peopleCount = parsePeopleCount(peopleLabel);
  const quantity = Number(level.value) * (level.perPerson ? peopleCount : 1);
  const prefix = level.value === 1 && !level.perPerson ? "" : "约";
  return `${level.level}（${prefix}${quantity}${level.unit || "件"}${level.plus ? "+" : ""}）`;
}

function parsePeopleCount(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function getOptionIconPath(option) {
  const fileName = optionIconMap[option];
  if (!fileName) return "";
  return getIconAssetPath(fileName);
}

function getIconAssetPath(fileName) {
  if (!fileName) return "";
  return `${iconRoot}${encodeURI(fileName)}?v=${iconVersion}`;
}

function getDemandColor(option) {
  if (["长衣", "短衣", "外套挂放"].includes(option)) return "#b96052";
  if (["裤子"].includes(option)) return "#e98645";
  if (["鞋子", "包包", "鞋子收纳", "包包放置", "包包展示"].includes(option)) return "#8a95c8";
  if (["首饰"].includes(option)) return "#c5a15b";
  if (["被褥", "行李箱"].includes(option)) return "#a99b8a";
  if (["展示收藏", "展示摆件", "摆件", "收藏品", "综合展示"].includes(option)) return "#2f6d61";
  return "#e9a9c9";
}

function renderDimensions(question) {
  const values = state.answers[question.key] || {};
  const form = document.createElement("form");
  form.className = "dimension-form";
  form.innerHTML = `
    <label>
      <span>WIDTH / 宽度</span>
      <div><input name="width" type="number" min="600" max="20000" inputmode="numeric" placeholder="3600" value="${values.width || ""}" /><em>mm</em></div>
    </label>
    <label>
      <span>DEPTH / 深度</span>
      <div><input name="depth" type="number" min="600" max="20000" inputmode="numeric" placeholder="2800" value="${values.depth || ""}" /><em>mm</em></div>
    </label>
    <label>
      <span>HEIGHT / 高度</span>
      <div><input name="height" type="number" min="1800" max="5000" inputmode="numeric" placeholder="2700" value="${values.height || 2700}" /><em>mm</em></div>
    </label>
    <button class="dimension-next" type="submit">尺寸确认 <i>→</i></button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const width = Number(data.get("width"));
    const depth = Number(data.get("depth"));
    const height = Number(data.get("height")) || 2700;
    const layoutType = state.answers.layoutType || values.layoutType || "I型";
    if (!width || !depth || !height) return;
    state.answers[question.key] = { width, depth, height, layoutType };
    nextStep();
  });
  answerContent.appendChild(form);
}

function selectOption(key, option, button) {
  if (key === "layoutType") {
    state.answers.layoutType = option;
    state.answers.dimensions = {
      ...(state.answers.dimensions || {}),
      layoutType: option
    };
  } else {
    state.answers[key] = option;
  }
  answerContent.querySelectorAll(".answer-option").forEach((item) => {
    item.dataset.selected = item === button ? "true" : "false";
  });
  window.setTimeout(nextStep, 360);
}

function nextStep() {
  const questions = getCurrentQuestions();
  if (state.step < questions.length - 1) {
    state.step += 1;
    renderQuestion("forward");
    return;
  }
  renderAnalysisLoading();
}

function renderAnalysisLoading() {
  console.log("[ai-planner] render-analysis-loading", {
    step: state.step,
    answers: state.answers
  });
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.recommendation = buildPlanRecommendation(state.answers);
  shell.classList.remove("is-changing", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis-loading", "is-changing");
  currentProgress.textContent = "分析";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "需求分析";
  note.textContent = "我们会根据空间尺寸、使用人数、收纳物品和预算，为您生成更适合的配置方向。";

  answerContent.innerHTML = `
    <div class="analysis-loading-card ai-analysis-loading">
      <div class="ai-analysis-orb" aria-hidden="true"><i></i></div>
      <div class="ai-analysis-status">
        <small>PURENEST AI ANALYSIS</small>
        <p class="analysis-loading-text">${analysisLoadingStages[0]}</p>
        <div class="ai-analysis-progress" aria-hidden="true"><i style="width:0%"></i></div>
      </div>
      <div class="ai-analysis-summary-card">
        <span class="ai-analysis-card-kicker">已分析你的收纳需求</span>
        <div class="ai-analysis-summary-rows">
          ${renderAnalysisLoadingSummaryRows().map((row, index) => `
            <p class="ai-analysis-summary-row" style="--row-index:${index}">
              <small>${row.label}</small>
              <strong>${row.value}</strong>
            </p>
          `).join("")}
        </div>
      </div>
      <button class="dimension-next analysis-loading-next" type="button" disabled>查看三套方案 <i>→</i></button>
    </div>
  `;

  const loadingText = answerContent.querySelector(".analysis-loading-text");
  const progressBar = answerContent.querySelector(".ai-analysis-progress i");
  const summaryRows = Array.from(answerContent.querySelectorAll(".ai-analysis-summary-row"));
  const nextButton = answerContent.querySelector(".analysis-loading-next");
  const stageDelayMs = 760;
  analysisLoadingStages.forEach((stageText, index) => {
    analysisLoadingTimers.push(window.setTimeout(() => {
      loadingText.classList.add("is-switching");
      analysisLoadingTimers.push(window.setTimeout(() => {
        loadingText.textContent = stageText;
        loadingText.classList.remove("is-switching");
      }, 220));
      if (progressBar) {
        progressBar.style.width = `${Math.round(((index + 1) / analysisLoadingStages.length) * 100)}%`;
      }
      if (summaryRows[index]) {
        summaryRows[index].classList.add("is-visible");
      }
    }, index * stageDelayMs));
  });
  analysisLoadingTimers.push(window.setTimeout(() => {
    clearAnalysisLoadingTimers();
    renderAnalysis({ fadeIn: true });
  }, analysisLoadingStages.length * stageDelayMs + 260));
}

function renderAnalysisLoadingSummaryRows() {
  const recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  const dimensions = recommendation?.dimensions || state.answers.dimensions || {};
  const demands = Array.isArray(recommendation?.demands) ? recommendation.demands : [];
  const demandPersona = recommendation?.demandPersona || {};
  const selectedSystem = state.selectedProductSystem || state.answers.selectedProductSystem || {};
  return [
    {
      label: "空间尺寸",
      value: `${dimensions.layoutType || "I型"} / ${dimensions.width || "-"} × ${dimensions.depth || "-"} × ${dimensions.height || 2700}mm`
    },
    {
      label: "使用人数",
      value: state.answers.people || state.answers.style || "待确认"
    },
    {
      label: "主要收纳需求",
      value: demands.length ? demands.join(" / ") : "综合收纳"
    },
    {
      label: "预算区间",
      value: state.answers.budget || "待确认"
    },
    {
      label: "推荐方向",
      value: demandPersona?.focus
        ? `${selectedSystem.name || "当前系列"} · ${demandPersona.focus}`
        : `${selectedSystem.name || "当前系列"} · 均衡收纳`
    }
  ].map((row) => ({
    label: escapeDebugValue(row.label),
    value: escapeDebugValue(row.value)
  }));
}

function renderAnalysis({ fadeIn = false } = {}) {
  console.log("[ai-planner] render-analysis-start", {
    fadeIn,
    step: state.step
  });
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  const {
    dimensions,
    demandRatios,
    demands,
    zoneCards,
    demandPersona
  } = state.recommendation;
  const labels = getRatioLabels(state.answers.spaceUse);
  shell.classList.remove("is-changing", "is-analysis-loading", "is-product-system", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis");
  currentProgress.textContent = "分析";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "需求分析";
  note.textContent = "我们会根据空间尺寸、使用人数、收纳物品和预算，为您生成更适合的配置方向。";

  answerContent.innerHTML = `
    <div class="analysis-card${fadeIn ? " is-fade-in" : ""}">
      ${renderCompletedAnalysisHeader()}
      ${renderReportSection("基础信息", `
        <div class="analysis-grid">
          <p><small>空间类型 / 尺寸</small><strong>${state.answers.spaceUse || "定制空间"} / ${dimensions.layoutType || "I型"} / ${dimensions.width} × ${dimensions.depth} × ${dimensions.height || 2700}mm</strong></p>
          <p><small>房间数量</small><strong>1 间</strong></p>
          <p><small>使用人数</small><strong class="analysis-icon-value">${renderInlineIconText(state.answers.people || state.answers.style || "待确认")}</strong></p>
          <p><small>预算区间</small><strong>${state.answers.budget || "待确认"}</strong></p>
          <p><small>产品系列</small><strong>${(state.selectedProductSystem || state.answers.selectedProductSystem)?.name || "待确认"}</strong></p>
          <p><small>主要需求</small><strong>${demands.length ? renderDemandChips(demands) : "综合收纳"}</strong></p>
        </div>
      `)}
      ${renderReportSection("需求分析", renderDemandFocusList(demands))}
      ${renderReportSection("空间建议", Object.keys(demandRatios).length ? renderStackedRatioBar(demandRatios, labels) : "<p>根据当前空间保持挂衣、层板和功能区均衡分配。</p>")}
      ${renderReportSection("推荐布局逻辑", renderLayoutLogicList(demands, demandPersona))}
      ${zoneCards.length ? renderReportSection("收纳物品估算", renderZoneCards(zoneCards)) : ""}
      <div class="analysis-actions">
        <button class="analysis-back" type="button">← 返回上一题</button>
        <button class="dimension-next analysis-next" type="button">查看三套方案 <i>→</i></button>
      </div>
    </div>
  `;
  answerContent.querySelector(".analysis-back").addEventListener("click", () => {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
  });
  answerContent.querySelector(".analysis-next").addEventListener("click", renderAiRecommendedPlans);
}

function renderCompletedAnalysisHeader() {
  return `
    <div class="ai-analysis-header-block">
      <div class="ai-analysis-orb" aria-hidden="true"><i></i></div>
      <div class="ai-analysis-status">
        <small>PURENEST AI ANALYSIS</small>
        <p class="analysis-loading-text">已完成需求分析</p>
        <div class="ai-analysis-progress" aria-hidden="true"><i style="width:100%"></i></div>
      </div>
    </div>
  `;
}

function renderProductSystemSelection() {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  const selectedId = state.selectedProductSystem?.id || state.answers.selectedProductSystem?.id || "";
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-product-system");
  currentProgress.textContent = "1";
  totalProgress.textContent = String(getCurrentQuestions().length + 1);
  progressLine.style.transform = `scaleX(${1 / (getCurrentQuestions().length + 1)})`;
  backButton.disabled = true;
  title.textContent = "选择适合您的产品系统";
  note.textContent = "根据您的收纳需求，选择最符合空间风格与使用习惯的系统方案。";

  answerContent.innerHTML = `
    <div class="product-system-panel">
      <div class="product-system-grid">
        ${productSystems.map((system) => renderProductSystemCard(system, selectedId)).join("")}
      </div>
      <div class="product-system-actions">
        <button class="dimension-next product-system-next" type="button" ${selectedId ? "" : "disabled"}>下一步 <i>→</i></button>
      </div>
    </div>
  `;

  const nextButton = answerContent.querySelector(".product-system-next");
  answerContent.querySelectorAll("[data-product-system]").forEach((card) => {
    card.addEventListener("click", () => {
      const selected = productSystems.find((system) => system.id === card.dataset.productSystem);
      if (!selected) return;
      state.selectedProductSystem = selected;
      state.answers.selectedProductSystem = selected;
      state.answers.spaceUse ||= "衣帽间";
      answerContent.querySelectorAll("[data-product-system]").forEach((item) => {
        item.dataset.selected = item === card ? "true" : "false";
      });
      nextButton.disabled = false;
    });
  });
  nextButton.addEventListener("click", () => {
    if (!state.selectedProductSystem && !state.answers.selectedProductSystem) return;
    state.answers.spaceUse ||= "衣帽间";
    state.step = 0;
    renderQuestion("forward");
  });
}

function renderProductSystemCard(system, selectedId) {
  return `
    <article class="product-system-card" data-product-system="${system.id}" data-selected="${selectedId === system.id ? "true" : "false"}">
      <div class="product-system-image">
        <img src="${getIconAssetPath(system.image)}" alt="${system.name}" loading="lazy" />
      </div>
      <div class="product-system-copy">
        <div class="product-system-title">
          <h2>${system.name}</h2>
          <span class="product-system-selected">✓ 已选择</span>
        </div>
        <p>${system.description}</p>
        <ul>${system.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
      </div>
    </article>
  `;
}

function renderAiRecommendedPlans() {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  const recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  const dimensions = recommendation.dimensions || {};
  const selectedProductSystem = state.selectedProductSystem || state.answers.selectedProductSystem || null;
  const needs = state.answers.needs || state.answers.entryNeeds || state.answers.displayNeeds || state.answers.studyNeeds || state.answers.demands || {};
  const needWeights = state.answers.demandsWeights || (state.answers.demands && typeof state.answers.demands === "object" ? state.answers.demands : {});
  const planInput = {
    ...state.answers,
    selectedProductSystem
  };
  const generatedPlans = generateRecommendedPlans(planInput);
  const recommendedPlans = ensureRecommendedPlanTiers(generatedPlans);
  state.currentPlans = recommendedPlans;
  const candidateDebugStats = getCandidatePlanDebugStats();
  const payload = {
    selectedProductSystem,
    spaceType: state.answers.spaceUse || "",
    layoutType: dimensions.layoutType || "I型",
    roomWidth: dimensions.width,
    roomDepth: dimensions.depth,
    roomHeight: dimensions.height || 2700,
    peopleCount: state.answers.people || state.answers.style || "",
    budgetRange: state.answers.budget || "",
    needs,
    needWeights
  };
  console.log("[ai-planner] recommended-plan-input", payload);
  console.log("[ai-planner] generated-plans", summarizeRecommendedPlans(generatedPlans));
  console.log("[ai-planner] rendered-plans", summarizeRecommendedPlans(recommendedPlans));
  console.log("[ai-planner] recommended-plan-presets", {
    basic: recommendedPlans.find((plan) => plan.planType === "basic")?.configPreset,
    value: recommendedPlans.find((plan) => plan.planType === "value")?.configPreset,
    premium: recommendedPlans.find((plan) => plan.planType === "premium")?.configPreset
  });

  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-ai-plans");
  shell.classList.toggle("is-ai-plan-debug", isDevelopmentEnvironment());
  currentProgress.textContent = "方案";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "三套方案";
  note.textContent = "先在三套完整方案中选择方向，再进行个性化微调。";

  answerContent.innerHTML = `
    <div class="ai-plan-panel">
      ${isDevelopmentEnvironment() ? renderAiPlanDebugBadge(generatedPlans, recommendedPlans) : ""}
      <div class="ai-plan-context">
        <span>${selectedProductSystem?.name || "未选择产品系统"}</span>
        <span>${dimensions.width || "-"} × ${dimensions.depth || "-"} × ${dimensions.height || 2700} mm</span>
        <span>${payload.peopleCount || "使用人数待确认"}</span>
        <span>${payload.budgetRange || "预算待确认"}</span>
      </div>
      ${renderSingleModelPlanResult(recommendedPlans)}
      ${isCandidateDebugEnabled() ? renderCandidateDebugPanel(
        candidateDebugStats,
        recommendedPlans,
        payload.budgetRange
      ) : ""}
    </div>
  `;

  updateAiPlanDebugBadge(generatedPlans, recommendedPlans);

  answerContent.querySelectorAll("[data-ai-plan-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = recommendedPlans.find((plan) => plan.planType === button.dataset.aiPlanOption);
      if (!selected) return;
      state.selectedPlan = selected;
      updateSingleModelPlanResult(selected, recommendedPlans, selectedProductSystem);
    });
  });
  answerContent.querySelector("[data-toggle-planner-visual-assets]")?.addEventListener("change", (event) => {
    state.showPlannerVisualAssets = event.target.checked;
    const selectedType = answerContent.querySelector("[data-selected-plan-detail]")?.dataset.selectedPlanDetail || "basic";
    const selected = recommendedPlans.find((plan) => plan.planType === selectedType) || recommendedPlans[0];
    updateSingleModelPlanResult(selected, recommendedPlans, selectedProductSystem);
  });
  answerContent.querySelector(".ai-plan-panel")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-view-full-analysis]")) {
      renderAnalysis({ fadeIn: true });
      return;
    }
    if (event.target.closest("[data-submit-selected-plan]")) {
      const selectedType = answerContent.querySelector("[data-selected-plan-detail]")?.dataset.selectedPlanDetail || "basic";
      const selected = recommendedPlans.find((plan) => plan.planType === selectedType) || recommendedPlans[0];
      if (!selected || selected.isFallback) return;
      state.selectedPlan = selected;
      renderLeadForm(selected);
      return;
    }
    if (event.target.closest("[data-result-back]")) {
      state.step = getCurrentQuestions().length - 1;
      renderQuestion("back");
    }
  });
  updateSingleModelPlanResult(
    recommendedPlans.find((plan) => plan.planType === "basic") || recommendedPlans[0],
    recommendedPlans,
    selectedProductSystem
  );
}

function renderSingleModelPlanResult(plans) {
  return `
    <div class="ai-plan-result-layout">
      <section class="ai-plan-result-preview" aria-label="方案模型预览">
        <div class="ai-plan-preview-toolbar">
          <label class="ai-plan-visual-toggle">
            <input type="checkbox" data-toggle-planner-visual-assets ${state.showPlannerVisualAssets ? "checked" : ""} />
            <span>显示物品</span>
          </label>
        </div>
        <div class="result-plan-preview-root" data-result-plan-preview data-preview-state="loading">
          <div class="plan-preview-shell" aria-hidden="true">
            <span></span>
            <i></i>
            <b></b>
          </div>
        </div>
      </section>
      <aside class="ai-plan-result-sidebar">
        <div class="ai-plan-switcher" role="tablist" aria-label="方案选择">
          ${plans.map(renderPlanSwitchButton).join("")}
        </div>
        <section class="ai-plan-selected-detail" data-selected-plan-detail="basic"></section>
      </aside>
    </div>
  `;
}

function renderPlanSwitchButton(plan) {
  const displayName = getPlanDisplayName(plan);
  const weakTag = plan.planType === "value" ? "<small>客户选择较多</small>" : "";
  return `
    <button
      class="ai-plan-switch"
      type="button"
      data-ai-plan-option="${plan.planType}"
      data-selected="${plan.planType === "basic" ? "true" : "false"}"
      ${plan.isFallback ? "disabled" : ""}
    >
      <strong>${displayName}</strong>
      ${weakTag}
    </button>
  `;
}

function updateSingleModelPlanResult(plan, plans, selectedProductSystem) {
  if (!plan) return;
  answerContent.querySelectorAll("[data-ai-plan-option]").forEach((button) => {
    button.dataset.selected = button.dataset.aiPlanOption === plan.planType ? "true" : "false";
  });
  const detail = answerContent.querySelector("[data-selected-plan-detail]");
  if (detail) {
    detail.dataset.selectedPlanDetail = plan.planType;
    detail.innerHTML = renderSelectedPlanDetail(plan, plans);
  }
  loadResultPlanPreview(answerContent.querySelector("[data-result-plan-preview]"), plan, selectedProductSystem);
}

function renderSelectedPlanDetail(plan, plans) {
  const hasPrice = Number.isFinite(Number(plan.planPrice)) && Number(plan.planPrice) > 0;
  return `
    <div class="selected-plan-heading">
      <small>当前方案</small>
      <h2>${getPlanDisplayName(plan)}</h2>
    </div>
    <div class="selected-plan-price">
      <span>当前价格</span>
      <strong>${hasPrice ? formatPlanPrice(plan.planPrice) : "价格待确认"}</strong>
    </div>
    <div class="selected-plan-fit">
      <span>满足度</span>
      <strong>${getPlanDemandCoverage(plan.planType)}</strong>
      <p>${getPlanFeatureSummary(plan.planType)}</p>
    </div>
    <div class="selected-plan-diff">
      <span>新增功能说明</span>
      ${renderPlanDifferenceList(plan, plans)}
    </div>
    <div class="selected-plan-actions">
      <button class="analysis-back" type="button" data-view-full-analysis>查看完整分析</button>
      <button class="dimension-next" type="button" data-submit-selected-plan ${plan.isFallback ? "disabled" : ""}>提交方案 <i>→</i></button>
      <button class="result-back-link" type="button" data-result-back>← 返回重新调整需求</button>
    </div>
  `;
}

function renderPlanDifferenceList(plan, plans) {
  if (plan.planType === "basic") {
    return `
      <p>满足当前核心收纳需求。</p>
      <ul><li>✓ 保留基础功能配置</li></ul>
    `;
  }
  const previousType = plan.planType === "premium" ? "value" : "basic";
  const previousPlan = plans.find((item) => item.planType === previousType);
  const diffItems = getPlanComponentDiffItems(previousPlan, plan);
  const prefix = plan.planType === "premium" ? "相比高性价比款新增：" : "相比基础实用款新增：";
  return `
    <p>${prefix}</p>
    <ul>
      ${diffItems.length
        ? diffItems.map((item) => `<li>✓ ${item}</li>`).join("")
        : "<li>✓ 当前真实组件差异较小，主要优化空间分配与容量覆盖</li>"}
    </ul>
  `;
}

function getPlanComponentDiffItems(basePlan, nextPlan) {
  const baseCounts = getPlanComponentCounts(basePlan);
  const nextCounts = getPlanComponentCounts(nextPlan);
  const labels = [];
  Array.from(new Set([...Object.keys(baseCounts), ...Object.keys(nextCounts)])).forEach((componentType) => {
    const delta = (nextCounts[componentType] || 0) - (baseCounts[componentType] || 0);
    if (delta <= 0) return;
    labels.push(getComponentUpgradeLabel(componentType, delta));
  });
  return labels.filter(Boolean);
}

function getPlanComponentCounts(plan) {
  const placements = Array.isArray(plan?.configPreset?.placements) && plan.configPreset.placements.length
    ? plan.configPreset.placements
    : (Array.isArray(plan?.configPreset?.explicitPlacements) ? plan.configPreset.explicitPlacements : []);
  return placements.reduce((counts, placement) => {
    const type = placement?.componentType;
    if (!type) return counts;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

function getComponentUpgradeLabel(componentType, delta = 1) {
  const countText = delta > 1 ? ` ×${delta}` : "";
  const labels = {
    cabinet: `抽屉/柜体收纳${countText}`,
    trouserRack: `裤架收纳${countText}`,
    jewelryBox: `首饰收纳${countText}`,
    woodShelf: `更多叠放区${countText}`,
    glassShelf: `展示层板${countText}`,
    singleRail: `更多挂衣区${countText}`,
    doubleRail: `双层挂衣区${countText}`,
    lighting: `灯光体验${countText}`,
    meshBasket: `网篮分类${countText}`
  };
  return labels[componentType] || `${componentType}${countText}`;
}

function renderAiPlanCard(plan) {
  const hasPrice = Number.isFinite(Number(plan.planPrice)) && Number(plan.planPrice) > 0;
  const displayName = getPlanDisplayName(plan);
  const weakTag = plan.planType === "value" ? "<span class=\"ai-plan-soft-tag\">客户选择较多</span>" : "";
  return `
    <article class="ai-plan-card" data-plan-type="${plan.planType}" data-plan-fallback="${plan.isFallback ? "true" : "false"}">
      <span class="ai-plan-type">${plan.planType}</span>
      <button class="planPreview" type="button" data-preview-plan="${plan.planType}" aria-label="查看${displayName}3D预览">
        <div class="plan-card-preview-root" data-card-preview-plan="${plan.planType}" data-preview-error="none">
          ${plan.planPreview ? `<img src="${plan.planPreview}" alt="${displayName}" loading="lazy" />` : `<span aria-hidden="true"></span>`}
        </div>
        <em class="ai-plan-budget">${hasPrice ? formatPlanPrice(plan.planPrice) : "价格待确认"}<span>${plan.planCapacityCoverage}</span></em>
        <strong>点击查看3D预览</strong>
        <small>可旋转查看</small>
      </button>
      <h2>${displayName}${weakTag}</h2>
      <div class="ai-plan-fit">
        <strong>${getPlanDemandCoverage(plan.planType)}</strong>
        <span>${getPlanFeatureSummary(plan.planType)}</span>
      </div>
      <div class="ai-plan-capacity">
        <small>预计可收纳</small>
        <ul>
          ${plan.planCapacity.length
            ? plan.planCapacity.map((item) => `<li>${item.label}${item.estimate}</li>`).join("")
            : "<li>方案数据待补充</li>"}
        </ul>
      </div>
      <button class="ai-plan-select" type="button" data-ai-plan="${plan.planType}" ${plan.isFallback ? "disabled" : ""}>${plan.isFallback ? "方案待补充" : "选择此方案"} <i>→</i></button>
    </article>
  `;
}

function isDevelopmentEnvironment() {
  const hostname = window.location.hostname;
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    || new URLSearchParams(window.location.search).get("debug") === "1";
}

function renderAiPlanDebugBadge(generatedPlans, renderedPlans) {
  return `
    <aside class="ai-plan-debug-badge" aria-label="plan render debug">
      <span>plans.length = ${Array.isArray(generatedPlans) ? generatedPlans.length : 0}</span>
      <span data-ai-plan-card-count>plan DOM count = 0</span>
      <span>planTypes = ${renderedPlans.map((plan) => plan.planType).join("/")}</span>
    </aside>
  `;
}

function updateAiPlanDebugBadge(generatedPlans, renderedPlans) {
  const cardCount = answerContent.querySelectorAll(".ai-plan-card, .ai-plan-switch").length;
  const cardCountLabel = answerContent.querySelector("[data-ai-plan-card-count]");
  if (cardCountLabel) cardCountLabel.textContent = `plan DOM count = ${cardCount}`;
  console.log("[ai-planner] plan-card-dom", {
    plansLength: Array.isArray(generatedPlans) ? generatedPlans.length : 0,
    cardCount,
    planTypes: renderedPlans.map((plan) => plan.planType)
  });
}

function summarizeRecommendedPlans(plans) {
  return (Array.isArray(plans) ? plans : []).filter(Boolean).map((plan) => ({
    planType: plan.planType,
    planName: plan.planName,
    planPrice: plan.planPrice,
    placementCount: plan.configPreset?.placements?.length ?? plan.candidateDebug?.placementCount
  }));
}

function isCandidateDebugEnabled() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function renderCandidateDebugPanel(stats, plans, budgetRange) {
  const rejectReasons = Object.entries(stats.rejectReasons || {})
    .sort((a, b) => b[1] - a[1]);
  return `
    <section class="candidate-debug-panel">
      <header>
        <div>
          <small>DEVELOPMENT ONLY</small>
          <h2>Candidate Plan Engine Debug</h2>
        </div>
        <dl>
          <div><dt>totalCandidates</dt><dd>${stats.totalCandidates ?? stats.generatedCount ?? 0}</dd></div>
          <div><dt>validCandidates</dt><dd>${stats.validCandidates ?? stats.validCount ?? 0}</dd></div>
          <div><dt>rankedCandidates</dt><dd>${stats.validCount ?? 0}</dd></div>
          <div><dt>budgetRange</dt><dd>${escapeDebugValue(budgetRange || "none")}</dd></div>
          <div><dt>bayCount</dt><dd>${stats.budgetAvailability?.bayCount ?? "-"}</dd></div>
          <div><dt>minPossiblePrice</dt><dd>${stats.budgetAvailability?.minPossiblePrice ?? "-"}</dd></div>
          <div><dt>normalPossiblePrice</dt><dd>${stats.budgetAvailability?.normalPossiblePrice ?? "-"}</dd></div>
          <div><dt>maxPossiblePrice</dt><dd>${stats.budgetAvailability?.maxPossiblePrice ?? "-"}</dd></div>
          <div><dt>dynamicBudgetRanges</dt><dd>${escapeDebugValue(
            stats.budgetAvailability?.dynamicBudgetRanges?.map((range) => range.label).join(", ") || "none"
          )}</dd></div>
          <div><dt>disabledBudgetRanges</dt><dd>${escapeDebugValue(
            stats.budgetAvailability?.disabledBudgetRanges?.join(", ") || "none"
          )}</dd></div>
          <div><dt>disabledReason</dt><dd>${escapeDebugValue(
            JSON.stringify(stats.budgetAvailability?.disabledReason || {})
          )}</dd></div>
          <div><dt>selectedBudgetRange</dt><dd>${escapeDebugValue(
            stats.budgetAvailability?.selectedBudgetRange || "none"
          )}</dd></div>
          <div><dt>basicTargetPrice</dt><dd>${stats.budgetAvailability?.basicTargetPrice ?? "-"}</dd></div>
          <div><dt>valueTargetPrice</dt><dd>${stats.budgetAvailability?.valueTargetPrice ?? "-"}</dd></div>
          <div><dt>premiumTargetPrice</dt><dd>${stats.budgetAvailability?.premiumTargetPrice ?? "-"}</dd></div>
          <div><dt>priceWasTargetAdjusted</dt><dd>false</dd></div>
          <div><dt>missingPlanType</dt><dd>${escapeDebugValue(stats.missingPlanType || "none")}</dd></div>
          <div><dt>missingReason</dt><dd>${escapeDebugValue(stats.missingReason || "none")}</dd></div>
          <div><dt>candidateRejectTopReasons</dt><dd>${escapeDebugValue(
            (stats.candidateRejectTopReasons || [])
              .map((item) => `${item.planType}:${item.reason}:${item.count}`)
              .join(", ") || "none"
          )}</dd></div>
          <div><dt>basicValueSimilarity</dt><dd>${escapeDebugValue(JSON.stringify(stats.basicValueSimilarity || {}))}</dd></div>
          <div><dt>valuePremiumSimilarity</dt><dd>${escapeDebugValue(JSON.stringify(stats.valuePremiumSimilarity || {}))}</dd></div>
          <div><dt>duplicatePlanDetected</dt><dd>${stats.duplicatePlanDetected ? "true" : "false"}</dd></div>
          <div><dt>reselectionReason</dt><dd>${escapeDebugValue(stats.reselectionReason || "none")}</dd></div>
          <div><dt>caseMatchingRuleLoad</dt><dd>${escapeDebugValue(formatCaseMatchingRuleLoadDebug(stats.caseMatchingRuleLoad))}</dd></div>
          <div><dt>caseMatching</dt><dd>${escapeDebugValue(formatCaseMatchingDebug(stats.caseMatching))}</dd></div>
          <div><dt>candidateQa</dt><dd>${escapeDebugValue(formatCandidateQaDebug(stats.candidateQa))}</dd></div>
        </dl>
      </header>
      <div class="candidate-debug-plans">
        ${plans.map(renderSelectedPlanDebug).join("")}
      </div>
      <div class="candidate-debug-rejections">
        <h3>rejectReason frequency</h3>
        ${rejectReasons.length
          ? `<dl>${rejectReasons.map(([reason, count]) => `
              <div><dt>${escapeDebugValue(reason)}</dt><dd>${count}</dd></div>
            `).join("")}</dl>`
          : "<p>No rejected candidates.</p>"}
      </div>
      ${renderCandidateHeatmap(stats.heatmap || {})}
    </section>
  `;
}

function renderCandidateHeatmap(heatmap) {
  return `
    <div class="candidate-heatmap">
      <h3>Candidate Heatmap</h3>
      ${["basic", "value", "premium"].map((planType) => `
        <section>
          <h4>${planType} Top 10</h4>
          <div class="candidate-heatmap-table">
            <div class="candidate-heatmap-row candidate-heatmap-head">
              <span>planId</span><span>total</span><span>storage</span><span>layout</span>
              <span>visual</span><span>budget</span><span>upgrade</span><span>price</span>
              <span>capacity</span><span>bays</span><span>zones</span><span>components</span><span>placements</span>
            </div>
            ${(heatmap[planType] || []).map(renderCandidateHeatmapRow).join("")
              || `<p class="candidate-heatmap-empty">No valid ${planType} candidates.</p>`}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderCandidateHeatmapRow(candidate) {
  const scores = candidate.scores || {};
  return `
    <div class="candidate-heatmap-row">
      <span>${escapeDebugValue(candidate.planId || "-")}</span>
      <span>${scores.totalScore ?? "-"}</span>
      <span>${scores.storageScore ?? "-"}</span>
      <span>${scores.layoutScore ?? "-"}</span>
      <span>${scores.visualScore ?? "-"}</span>
      <span>${scores.budgetScore ?? "-"}</span>
      <span>${scores.upgradeScore ?? "-"}</span>
      <span>${candidate.estimatedPrice ?? "-"}</span>
      <span>${formatDebugObject(candidate.estimatedCapacity)}</span>
      <span>${candidate.bayCount ?? "-"}</span>
      <span>${formatDebugObject(candidate.zoneDistribution)}</span>
      <span>${formatDebugObject(candidate.componentCount)}</span>
      <span>${candidate.placementCount ?? "-"}</span>
    </div>
  `;
}

function renderSelectedPlanDebug(plan) {
  const debug = plan.candidateDebug || {};
  const scores = plan.candidateScores || {};
  return `
    <article>
      <h3>${escapeDebugValue(plan.planType)} <span>${escapeDebugValue(plan.candidatePlanId || "-")}</span></h3>
      <dl class="candidate-debug-scores">
        ${["totalScore", "storageScore", "layoutScore", "visualScore", "budgetScore", "upgradeScore"]
          .map((key) => `<div><dt>${key}</dt><dd>${scores[key] ?? "-"}</dd></div>`).join("")}
      </dl>
      <dl class="candidate-debug-details">
        <div><dt>bayCount</dt><dd>${debug.bayCount ?? "-"}</dd></div>
        <div><dt>zoneDistribution</dt><dd>${formatDebugObject(debug.zoneDistribution)}</dd></div>
        <div><dt>componentCount</dt><dd>${formatDebugObject(debug.componentCount)}</dd></div>
        <div><dt>placementCount</dt><dd>${debug.placementCount ?? "-"}</dd></div>
        <div><dt>shelfGaps</dt><dd>${formatShelfGapDiagnostics(debug.shelfGaps)}</dd></div>
        <div><dt>estimatedPrice</dt><dd>${debug.estimatedPrice ?? plan.planPrice ?? "-"}</dd></div>
        <div><dt>estimatedCapacity</dt><dd>${formatDebugObject(debug.estimatedCapacity)}</dd></div>
        <div><dt>caseMatchingRuleLoad</dt><dd>${escapeDebugValue(formatCaseMatchingRuleLoadDebug(debug.caseMatchingRuleLoad))}</dd></div>
        <div><dt>caseMatching</dt><dd>${escapeDebugValue(formatCaseMatchingDebug(debug.caseMatching))}</dd></div>
        <div><dt>candidateQa</dt><dd>${escapeDebugValue(formatCandidateQaDebug(debug.candidateQa))}</dd></div>
        <div><dt>rejectedReason</dt><dd>${escapeDebugValue(debug.rejectedReason || "none")}</dd></div>
      </dl>
    </article>
  `;
}

function formatDebugObject(value) {
  if (value == null) return "-";
  if (Array.isArray(value)) {
    return escapeDebugValue(value.map((item) => (
      typeof item === "object" ? `${item.label || item.itemType || "item"}:${item.estimate || item.quantity || ""}` : item
    )).join(", "));
  }
  if (typeof value === "object") {
    return escapeDebugValue(Object.entries(value).map(([key, count]) => `${key}:${count}`).join(", ") || "-");
  }
  return escapeDebugValue(value);
}

function formatShelfGapDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || !diagnostics.length) return "none";
  return escapeDebugValue(diagnostics.map((item) => (
    `${item.bayKey}:${item.shelfClass}:${item.lowerHeight}-${item.upperHeight}:gap=${item.clearGap}:min=${item.minGap}`
  )).join(", "));
}

function formatCandidateQaDebug(candidateQa) {
  if (!candidateQa) return "none";
  const issueSummary = (candidateQa.issues || [])
    .map((issue) => [
      issue.ruleId,
      issue.reason,
      issue.failedPair,
      issue.category
    ].filter(Boolean).join(":"))
    .join(", ");
  return JSON.stringify({
    passed: candidateQa.passed,
    selectionMode: candidateQa.selectionMode,
    attemptedTierSets: candidateQa.attemptedTierSets,
    selectedAttemptIndex: candidateQa.selectedAttemptIndex,
    failedAttemptCount: candidateQa.failedAttemptCount,
    capacitySource: candidateQa.capacitySource,
    capacityByPlan: candidateQa.capacityByPlan || {},
    capacityDiff: candidateQa.capacityDiff || [],
    missingWidthFallbackCount: candidateQa.missingWidthFallbackCount || 0,
    capacityContributions: candidateQa.capacityContributions || [],
    issueCount: candidateQa.issues?.length || 0,
    issues: issueSummary || "none",
    originalSelectedCandidateIds: candidateQa.originalSelectedCandidateIds || {},
    finalSelectedCandidateIds: candidateQa.finalSelectedCandidateIds || {},
    summary: candidateQa.summary || {}
  });
}

function formatCaseMatchingDebug(caseMatching) {
  if (!caseMatching) return "none";
  return JSON.stringify({
    enabled: caseMatching.enabled === true,
    selectedCaseId: caseMatching.selectedCaseId || null,
    selectedPersona: caseMatching.selectedPersona || "",
    score: caseMatching.score || 0,
    userRequirementVector: caseMatching.userRequirementVector || {},
    topCandidates: (caseMatching.topCandidates || []).slice(0, 5)
  });
}

function formatCaseMatchingRuleLoadDebug(ruleLoad) {
  if (!ruleLoad) return "none";
  return JSON.stringify({
    attempted: ruleLoad.attempted === true,
    loaded: ruleLoad.loaded === true,
    error: ruleLoad.error || null,
    fallbackToLegacy: ruleLoad.fallbackToLegacy === true
  });
}

function escapeDebugValue(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeRecommendedPlan(plan = {}, index = 0) {
  const planType = plan.planType || recommendedPlanTypes[index] || "basic";
  return {
    ...plan,
    planType,
    planName: planDisplayNames[planType] || plan.planName || plan.name || planType,
    planPrice: Number(plan.planPrice ?? plan.price ?? 0),
    planPreview: plan.planPreview || null,
    planCapacityCoverage: plan.planCapacityCoverage || plan.coverage || "",
    planCapacity: Array.isArray(plan.planCapacity) ? plan.planCapacity : [],
    configPreset: plan.configPreset || {}
  };
}

function ensureRecommendedPlanTiers(plans) {
  const normalizedPlans = (Array.isArray(plans) ? plans : [])
    .filter(Boolean)
    .map(normalizeRecommendedPlan);
  const plansByType = new Map(normalizedPlans.map((plan) => [plan.planType, plan]));
  return recommendedPlanTypes.map((planType, index) => (
    plansByType.get(planType) || normalizeRecommendedPlan(createFallbackRecommendedPlan(planType), index)
  ));
}

function createFallbackRecommendedPlan(planType) {
  const fallback = recommendedPlanFallbacks[planType];
  return {
    planType,
    planName: fallback.planName,
    planPrice: null,
    planPreview: null,
    planCapacityCoverage: fallback.planCapacityCoverage,
    planCapacity: [],
    configPreset: {},
    isFallback: true
  };
}

async function loadPlanCardPreviews(plans, selectedProductSystem) {
  planCardPreviewCleanups.forEach((cleanup) => cleanup?.());
  planCardPreviewCleanups = [];
  const roots = Array.from(answerContent.querySelectorAll("[data-card-preview-plan]"));
  if (!roots.length) return;
  try {
    const { mountReadOnlyWardrobePreview } = await import("./ReadOnlyWardrobePreview.js?v=japanese-drawer-merchandising-20260703-01");
    await Promise.all(roots.map(async (root) => {
      const plan = plans.find((item) => item.planType === root.dataset.cardPreviewPlan);
      if (!plan || plan.isFallback) {
        setPlanCardPreviewFallback(root, "missing-plan", "该档方案候选暂未生成");
        return;
      }
      try {
        const cleanup = await mountReadOnlyWardrobePreview(root, {
          plan,
          selectedProductSystem,
          mode: "thumbnail",
          showPlannerVisualAssets: state.showPlannerVisualAssets
        });
        if (!root.isConnected) {
          cleanup?.();
          return;
        }
        root.dataset.previewState = "ready";
        root.dataset.previewError = "none";
        planCardPreviewCleanups.push(cleanup);
      } catch (error) {
        console.warn("[ai-planner] card preview fallback", plan.planType, error);
        setPlanCardPreviewFallback(root, "mount-failed", "3D 预览暂时无法加载");
      }
    }));
  } catch (error) {
    console.warn("[ai-planner] card preview fallback", error);
    roots.forEach((root) => setPlanCardPreviewFallback(root, "module-failed", "3D 预览暂时无法加载"));
  }
}

function setPlanCardPreviewFallback(root, errorType, message) {
  if (!root?.isConnected) return;
  root.dataset.previewState = "fallback";
  root.dataset.previewError = errorType;
  root.innerHTML = `
    <span aria-hidden="true"></span>
    <p class="plan-card-preview-error">${message}</p>
  `;
}

async function loadResultPlanPreview(container, plan, selectedProductSystem) {
  activeResultPreviewCleanup?.();
  activeResultPreviewCleanup = null;
  if (!container) return;
  clearAiPlannerPreviewRuntimeState();
  const renderInfo = createAiPlannerRenderInfo(plan);
  if (!plan || plan.isFallback) {
    setResultPlanPreviewFallback(container, "missing-plan", "该档方案候选暂未生成");
    return;
  }
  container.dataset.previewState = "loading";
  container.dataset.previewError = "none";
  container.dataset.activeRenderId = renderInfo.renderId;
  container.innerHTML = `
    <div class="plan-preview-shell" aria-hidden="true">
      <span></span>
      <i></i>
      <b></b>
    </div>
  `;
  renderAiPlannerPreviewStamp(container, renderInfo);
  publishAiPlannerActiveRender(renderInfo, { generatedCount: 0, skippedCount: 0, sceneJsImportUrl: "" });
  try {
    const { mountReadOnlyWardrobePreview } = await import("./ReadOnlyWardrobePreview.js?v=japanese-drawer-merchandising-20260703-01");
    const cleanup = await mountReadOnlyWardrobePreview(container, {
      plan,
      selectedProductSystem,
      renderInfo,
      showPlannerVisualAssets: state.showPlannerVisualAssets
    });
    if (!container.isConnected) {
      cleanup?.();
      return;
    }
    activeResultPreviewCleanup = cleanup;
    container.dataset.previewState = "ready";
    container.dataset.previewError = "none";
  } catch (error) {
    console.warn("[ai-planner] result preview fallback", plan.planType, error);
    setResultPlanPreviewFallback(container, "mount-failed", "3D 预览暂时无法加载");
  }
}

function createAiPlannerRenderInfo(plan = {}) {
  const renderId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const visualDebugKey = new URLSearchParams(window.location.search).get("visualDebug") || "";
  return {
    renderId,
    planType: plan?.planType || "",
    planTitle: getPlanDisplayName(plan),
    planId: plan?.planId || plan?.id || plan?.code || "",
    candidatePlanId: plan?.candidatePlanId || plan?.planId || plan?.id || plan?.code || "",
    visualDebugKey,
    timestamp: new Date().toISOString()
  };
}

function clearAiPlannerPreviewRuntimeState() {
  if (typeof window !== "undefined") {
    window.__AI_PLANNER_VISUAL_DEBUG__ = null;
    window.__AI_PLANNER_ACTIVE_RENDER__ = null;
  }
  document.documentElement.removeAttribute("data-model-report");
}

function publishAiPlannerActiveRender(renderInfo, counts = {}) {
  if (typeof window === "undefined" || !renderInfo) return;
  window.__AI_PLANNER_ACTIVE_RENDER__ = {
    renderId: renderInfo.renderId,
    planType: renderInfo.planType,
    planTitle: renderInfo.planTitle,
    planId: renderInfo.planId,
    candidatePlanId: renderInfo.candidatePlanId,
    visualDebugKey: renderInfo.visualDebugKey,
    sceneJsImportUrl: counts.sceneJsImportUrl || "",
    generatedCount: Number(counts.generatedCount) || 0,
    skippedCount: Number(counts.skippedCount) || 0,
    timestamp: renderInfo.timestamp
  };
}

function renderAiPlannerPreviewStamp(container, renderInfo, counts = {}) {
  if (!container || !renderInfo) return;
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
  stamp.textContent = formatAiPlannerRenderStamp(renderInfo, counts);
  container.style.position = container.style.position || "relative";
  container.appendChild(stamp);
}

function formatAiPlannerRenderStamp(renderInfo, counts = {}) {
  return [
    `renderId: ${renderInfo.renderId}`,
    `planType: ${renderInfo.planType || "-"}`,
    `planTitle: ${renderInfo.planTitle || "-"}`,
    `planId: ${renderInfo.planId || "-"}`,
    `candidatePlanId: ${renderInfo.candidatePlanId || "-"}`,
    `visualDebug: ${renderInfo.visualDebugKey || "-"}`,
    `sceneJsImportUrl: ${counts.sceneJsImportUrl || "-"}`,
    `visualGeneratedCount: ${Number(counts.generatedCount) || 0}`,
    `visualSkippedCount: ${Number(counts.skippedCount) || 0}`
  ].join("\n");
}

function setResultPlanPreviewFallback(container, errorType, message) {
  if (!container?.isConnected) return;
  container.dataset.previewState = "fallback";
  container.dataset.previewError = errorType;
  container.innerHTML = `
    <div class="plan-preview-shell" aria-hidden="true">
      <span></span>
      <i></i>
      <b></b>
    </div>
    <p class="readonly-preview-error">${message}</p>
  `;
}

function openPlanPreviewModal(plan, selectedProductSystem) {
  closePlanPreviewModal();
  const modal = document.createElement("div");
  modal.className = "plan-preview-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="plan-preview-backdrop" data-close-preview></div>
    <section class="plan-preview-dialog">
      <header>
        <div>
          <h2>方案预览</h2>
          <p>当前方案仅供空间配置参考，最终以顾问复核为准。</p>
        </div>
        <button type="button" class="plan-preview-close" data-close-preview>关闭</button>
      </header>
      <div class="plan-preview-stage">
        <div class="readonly-preview-root" data-readonly-preview-root>
          <div class="plan-preview-shell" aria-hidden="true">
            <span></span>
            <i></i>
            <b></b>
          </div>
        </div>
        <div class="plan-preview-caption">
          <strong>${selectedProductSystem?.name || "产品系统"}</strong>
          <span>${getPlanDisplayName(plan)} / ${formatPlanPrice(plan.planPrice)}</span>
          <small>只读预览 · 可旋转查看 · 可缩放</small>
        </div>
      </div>
      <footer>
        <button type="button" class="analysis-back" data-close-preview>关闭</button>
        <button type="button" class="dimension-next" data-select-preview-plan>选择此方案 <i>→</i></button>
      </footer>
    </section>
  `;
  modal.querySelectorAll("[data-close-preview]").forEach((button) => {
    button.addEventListener("click", closePlanPreviewModal);
  });
  modal.querySelector("[data-select-preview-plan]").addEventListener("click", () => {
    closePlanPreviewModal();
    state.selectedPlan = plan;
    renderPersonalizedUpgrades(plan);
  });
  document.body.appendChild(modal);
  document.body.classList.add("has-plan-preview-modal");
  loadReadOnlyPlanPreview(modal.querySelector("[data-readonly-preview-root]"), plan, selectedProductSystem);
}

function closePlanPreviewModal() {
  activePlanPreviewCleanup?.();
  activePlanPreviewCleanup = null;
  document.querySelector(".plan-preview-modal")?.remove();
  document.body.classList.remove("has-plan-preview-modal");
}

async function loadReadOnlyPlanPreview(container, plan, selectedProductSystem) {
  if (!container) return;
  try {
    const { mountReadOnlyWardrobePreview } = await import("./ReadOnlyWardrobePreview.js?v=japanese-drawer-merchandising-20260703-01");
    const cleanup = await mountReadOnlyWardrobePreview(container, {
      plan,
      selectedProductSystem,
      showPlannerVisualAssets: state.showPlannerVisualAssets
    });
    if (!container.isConnected) {
      cleanup?.();
      return;
    }
    activePlanPreviewCleanup = cleanup;
    container.dataset.previewState = "ready";
  } catch (error) {
    console.warn("[ai-planner] readonly preview fallback", error);
    container.dataset.previewState = "fallback";
    container.innerHTML = `
      <div class="plan-preview-shell" aria-hidden="true">
        <span></span>
        <i></i>
        <b></b>
      </div>
      <p class="readonly-preview-error">真实预览暂时无法加载，已保留方案预览入口。</p>
    `;
  }
}

function formatPlanPrice(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function getPlanDisplayName(plan = {}) {
  return planDisplayNames[plan.planType] || plan.planName || plan.name || "方案";
}

function getPlanDemandCoverage(planType) {
  return planDemandCoverage[planType] || "满足约 85%";
}

function getPlanFeatureSummary(planType) {
  return planFeatureSummaries[planType] || "根据当前需求配置";
}

function renderPersonalizedUpgrades(plan) {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.selectedPlan = plan;
  const selectedProductSystem = state.selectedProductSystem || state.answers.selectedProductSystem || null;
  const upgrades = getRelevantUpgradeItems(state.answers, selectedProductSystem);
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-lead");
  currentProgress.textContent = "升级";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "个性化升级";
  note.textContent = "基于已选方案，只展示与您需求相关的微调项。";
  answerContent.innerHTML = `
    <div class="personal-upgrade-panel">
      <section class="personal-upgrade-summary">
        <small>已选择</small>
        <h2>${getPlanDisplayName(plan)}</h2>
        <p>${plan.planPrice ? formatPlanPrice(plan.planPrice) : "价格待确认"} · ${getPlanDemandCoverage(plan.planType)} · ${getPlanFeatureSummary(plan.planType)}</p>
        <button class="analysis-back" type="button" data-back-to-plans>返回三套方案</button>
      </section>
      <aside class="personal-upgrade-list">
        <h3>可选升级</h3>
        ${upgrades.length ? upgrades.map(renderUpgradeItem).join("") : "<p class=\"personal-upgrade-empty\">当前需求暂无额外相关升级项，可直接进入最终方案。</p>"}
      </aside>
      <div class="personal-upgrade-actions">
        <button class="dimension-next" type="button" data-finalize-plan>进入最终方案 <i>→</i></button>
      </div>
    </div>
  `;
  answerContent.querySelector("[data-back-to-plans]")?.addEventListener("click", renderAiRecommendedPlans);
  answerContent.querySelector("[data-finalize-plan]")?.addEventListener("click", () => renderLeadForm(plan));
}

function renderUpgradeItem(item) {
  const priceText = Number.isFinite(Number(item.price)) ? `+${Number(item.price).toLocaleString("zh-CN")}` : "按方案确认";
  return `
    <article class="personal-upgrade-item">
      <div>
        <strong>${item.name}</strong>
        <span>${priceText}</span>
      </div>
      <p>${item.solves}</p>
    </article>
  `;
}

function getRelevantUpgradeItems(answers = {}, selectedProductSystem = null) {
  const demandText = getDemandText(answers);
  const supported = getSupportedUpgradeKeys(selectedProductSystem);
  return upgradeCatalog.filter((item) => (
    supported.has(item.key)
    && item.keywords.some((keyword) => demandText.includes(keyword))
  ));
}

function getDemandText(answers = {}) {
  const values = [
    answers.needs,
    answers.entryNeeds,
    answers.displayNeeds,
    answers.studyNeeds,
    answers.demands,
    answers.demandsWeights
  ];
  return values.map((value) => {
    if (Array.isArray(value)) return value.join(" ");
    if (value && typeof value === "object") return Object.keys(value).filter((key) => Number(value[key]) > 0).join(" ");
    return String(value || "");
  }).join(" ");
}

function getSupportedUpgradeKeys(selectedProductSystem) {
  const id = selectedProductSystem?.id || "";
  const common = new Set(["trouserRack", "jewelryBox", "cabinet", "lighting", "glassShelf", "meshBasket"]);
  if (id === "japanese-closet") {
    return new Set(["trouserRack", "jewelryBox", "cabinet", "lighting"]);
  }
  if (id === "carbon-steel-post-wardrobe-v2") {
    return new Set(["trouserRack", "cabinet", "meshBasket"]);
  }
  if (id === "wall-mounted-v2") {
    return new Set(["cabinet", "lighting", "glassShelf"]);
  }
  return common;
}

function renderLeadForm(plan) {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.selectedPlan = plan;
  const selectedPlanName = getPlanDisplayName(plan);
  const selectedPlanCode = plan.code ? `方案 ${plan.code} / ` : "";
  const selectedPlanPrice = plan.planPrice ? formatPlanPrice(plan.planPrice) : (plan.price ? `¥${plan.price.toLocaleString("zh-CN")}` : "");
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-submitted");
  shell.classList.add("is-lead");
  currentProgress.textContent = "确认";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "最终方案确认";
  note.textContent = "留下联系方式后，璞舍顾问会根据您的空间尺寸和收纳需求，为您进一步确认尺寸、预算和落地细节。";
  answerContent.innerHTML = `
    <form class="lead-form">
      <p class="lead-selected">已选择：${selectedPlanCode}${selectedPlanName}${selectedPlanPrice ? ` / ${selectedPlanPrice}` : ""}</p>
      <label><span>姓名</span><input name="name" required autocomplete="name" /></label>
      <label><span>手机号</span><input name="phone" required inputmode="tel" autocomplete="tel" /></label>
      <label><span>微信号（选填）</span><input name="wechat" /></label>
      <label><span>所在城市（选填）</span><input name="city" autocomplete="address-level2" /></label>
      <label class="lead-form-note"><span>备注（选填）</span><textarea name="note" rows="4"></textarea></label>
      <button class="dimension-next" type="submit">提交方案需求</button>
    </form>
  `;
  answerContent.querySelector(".lead-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      selectedPlan: plan,
      answers: state.answers,
      selectedProductSystem: state.selectedProductSystem || state.answers.selectedProductSystem || null,
      contact: {
        name: form.get("name"),
        phone: form.get("phone"),
        wechat: form.get("wechat"),
        city: form.get("city"),
        note: form.get("note")
      }
    };
    console.log("[ai-planner] lead", payload);
    renderSubmitted();
  });
}

function renderSubmitted() {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-lead");
  shell.classList.add("is-submitted");
  currentProgress.textContent = "完成";
  title.textContent = "已收到您的方案需求";
  note.textContent = "璞舍顾问将尽快与您联系，为您确认空间尺寸、配置细节与最终报价。";
  answerContent.innerHTML = `
    <div class="submitted-card">
      <strong>已收到您的方案需求</strong>
      <p>璞舍顾问将尽快与您联系，<br>为您确认空间尺寸、配置细节与最终报价。</p>
    </div>
  `;
}

function renderRatioRows(ratios, compact = false) {
  return renderRatioRowsWithLabels(ratios, compact, getRatioLabels(state.answers.spaceUse));
}

function renderReportSection(titleText, content) {
  return `
    <section class="analysis-section">
      <h2>${titleText}</h2>
      ${content}
    </section>
  `;
}

function renderDemandFocusList(demands = []) {
  const demandNames = demands.length ? demands : Object.keys(state.answers.demands || {}).filter((key) => Number(state.answers.demands[key]) > 0);
  const items = demandNames.length ? demandNames : ["综合收纳"];
  return `
    <ul class="analysis-check-list">
      ${items.map((item) => `<li>✓ ${item}</li>`).join("")}
    </ul>
  `;
}

function renderLayoutLogicList(demands = [], persona = {}) {
  const demandText = `${demands.join(" ")} ${persona?.focus || ""} ${persona?.secondary || ""}`;
  const logicItems = [];
  if (demandText.includes("长衣")) logicItems.push("优先保留独立长衣区");
  if (demandText.includes("鞋")) logicItems.push("优先集中鞋履层板区");
  if (demandText.includes("裤") || demandText.includes("首饰")) logicItems.push("优先增加功能配件区");
  if (demandText.includes("行李箱") || demandText.includes("被褥")) logicItems.push("保留大件与换季收纳空间");
  if (demandText.includes("展示") || demandText.includes("包")) logicItems.push("增强展示与开放取放区域");
  const items = logicItems.length ? logicItems : ["先保证基础挂衣和层板收纳，再按预算增加功能模块"];
  return `
    <ul class="analysis-check-list">
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function renderRatioRowsWithLabels(ratios, compact = false, labels = {}) {
  if (!compact) return renderStackedRatioBar(ratios, labels);
  return Object.entries(ratios).map(([key, value]) => {
    const presentation = getZonePresentation(key);
    return `
    <div class="ratio-row${compact ? " compact" : ""}" style="--zone-color:${presentation.color}">
      <span>${labels[key] || key}</span>
      <i><b style="width:${value}%"></b></i>
      <strong>${value}%</strong>
      ${compact ? "" : `<em>${presentation.description}</em>`}
    </div>
  `;
  }).join("");
}

function renderStackedRatioBar(ratios, labels = {}) {
  const entries = Object.entries(ratios).map(([key, value]) => ({
    key,
    value,
    label: labels[key] || key,
    presentation: getZonePresentation(key)
  }));
  return `
    <div class="stacked-ratio-report">
      <div class="stacked-ratio-bar" aria-label="推荐功能区比例">
        ${entries.map((entry) => `
          <span
            class="stacked-ratio-segment${entry.value < 16 ? " is-narrow" : ""}"
            style="--zone-color:${entry.presentation.color}; flex-basis:${entry.value}%"
          >
            <b>${entry.label}</b>
            <strong>${entry.value}%</strong>
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDemandPersona(persona) {
  const items = [
    ["收纳重心", persona?.focus || "综合收纳", getReportIconPaths(persona?.focus)],
    ["次要需求", persona?.secondary || "需求相对集中", getReportIconPaths(persona?.secondary)],
    ["推荐布局", persona?.layout || "开放收纳 + 局部封闭", []],
    ["使用特征", persona?.usageTrait || "偏重日常取用", getReportIconPaths(persona?.usageTrait)]
  ];
  return `
    <div class="persona-report">
      <div class="persona-grid">
        ${items.map(([label, value, iconPaths]) => `
          <p><small>${label}</small><strong>${renderPersonaValue(value, iconPaths)}</strong></p>
        `).join("")}
      </div>
      <p class="persona-summary">${persona?.summary || ""}</p>
    </div>
  `;
}

function renderZoneCards(cards = []) {
  if (!cards.length) return "";
  return `
    <div class="zone-card-grid">
      ${cards.map((card) => `
        <article class="zone-card" style="--zone-color:${card.color}">
          <small><i></i>${card.zoneName} ${card.percent}%</small>
          <strong>${card.items.map((item) => renderZoneItem(item)).join("")}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDemandChips(demands = []) {
  return `
    <span class="demand-chip-list">
      ${demands.map((demand) => `
        <span class="demand-chip">${renderInlineIconText(demand)}</span>
      `).join("")}
    </span>
  `;
}

function renderInlineIconText(text) {
  const iconPath = getReportIconPath(text);
  return `${iconPath ? `<img class="report-icon" src="${iconPath}" alt="" loading="lazy" />` : ""}<span>${text}</span>`;
}

function renderPersonaValue(value, iconPaths = []) {
  const validIcons = iconPaths.filter(Boolean);
  return `
    <span class="persona-value">
      ${validIcons.length ? `<span class="persona-icons">${validIcons.map((iconPath) => `<img class="report-icon" src="${iconPath}" alt="" loading="lazy" />`).join("")}</span>` : ""}
      <span>${value}</span>
    </span>
  `;
}

function renderZoneItem(item) {
  return `
    <span class="zone-item">
      ${renderInlineIconText(`${item.label} ${item.estimate}`)}
    </span>
  `;
}

function getReportIconPaths(text = "") {
  const parts = String(text).split(/[、/，\s]+/).filter(Boolean);
  const icons = parts.map(getReportIconPath).filter(Boolean);
  return [...new Set(icons)];
}

function getReportIconPath(text = "") {
  const value = String(text);
  if (["1人", "2人", "3人", "4人以上"].includes(value)) return getOptionIconPath(value);
  if (value.includes("收藏品")) return getOptionIconPath("收藏品");
  if (value.includes("酒具")) return getOptionIconPath("酒具");
  if (value.includes("茶具")) return getOptionIconPath("茶具");
  if (value.includes("书籍") || value.includes("书架")) return getOptionIconPath("书籍");
  if (value.includes("文件")) return getOptionIconPath("文件");
  if (value.includes("电子设备")) return getOptionIconPath("电子设备");
  if (value.includes("钥匙") || value.includes("随手")) return getOptionIconPath("钥匙杂物");
  if (value.includes("雨伞")) return getOptionIconPath("雨伞收纳");
  if (value.includes("外套")) return getOptionIconPath("外套挂放");
  if (value.includes("短衣")) return getOptionIconPath("短衣");
  if (value.includes("长衣") || value.includes("挂衣") || value.includes("衣物")) return getOptionIconPath("长衣");
  if (value.includes("裤")) return getOptionIconPath("裤子");
  if (value.includes("鞋")) return getOptionIconPath("鞋子");
  if (value.includes("包")) return getOptionIconPath("包包");
  if (value.includes("首饰") || value.includes("抽屉")) return getOptionIconPath("首饰");
  if (value.includes("被褥") || value.includes("换季")) return getOptionIconPath("被褥");
  if (value.includes("行李箱") || value.includes("大件")) return getOptionIconPath("行李箱");
  if (value.includes("摆件")) return getOptionIconPath("摆件");
  if (value.includes("综合收纳")) return getOptionIconPath("综合收纳");
  if (value.includes("展示") || value.includes("收藏") || value.includes("陈列")) {
    return getOptionIconPath("展示收藏");
  }
  return "";
}

backButton.addEventListener("click", () => {
  if (shell.classList.contains("is-analysis-loading")) {
    clearAnalysisLoadingTimers();
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
    return;
  }
  if (shell.classList.contains("is-submitted") || shell.classList.contains("is-lead")) {
    renderAiRecommendedPlans();
    return;
  }
  if (shell.classList.contains("is-ai-plans")) {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
    return;
  }
  if (shell.classList.contains("is-product-system")) {
    return;
  }
  if (shell.classList.contains("is-analysis")) {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
    return;
  }
  if (state.step === 0) {
    renderProductSystemSelection();
    return;
  }
  state.step -= 1;
  renderQuestion("back");
});

loadClosetRules()
  .then(() => {
    renderProductSystemSelection();
    loadCaseMatchingRules().catch((error) => {
      console.warn("[ai-planner] optional case matching rules unavailable", error);
    });
  })
  .catch((error) => {
    console.error("[ai-planner] closet rules load failed", error);
    title.textContent = "规则数据暂时无法加载";
    note.textContent = "请刷新页面后重试。";
    answerContent.replaceChildren();
  });
