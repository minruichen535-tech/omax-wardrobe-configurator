import {
  buildPlanRecommendation,
  generateRecommendedPlans,
  getCandidatePlanDebugStats,
  getJapaneseClosetBudgetAvailability,
  getQuestionFlow,
  getRatioLabels,
  getZonePresentation
} from "./planRules.js?v=planner-flow-order-20260622-06";
import { loadClosetRules } from "../rules/demandRules.js?v=closet-rules-preview-20260621-11";

const state = {
  step: 0,
  answers: {},
  recommendation: null,
  selectedProductSystem: null,
  selectedPlan: null
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
const analysisLoadingMessages = [
  { delay: 0, text: "正在识别空间类型..." },
  { delay: 2000, text: "正在计算收纳需求..." },
  { delay: 4000, text: "正在生成专属方案..." }
];
const layoutOptions = [
  { value: "I型", title: "I型", subtitle: "单面布局", sketch: "│" },
  { value: "L型", title: "L型", subtitle: "转角布局", sketch: "└" },
  { value: "U型", title: "U型", subtitle: "三面布局", sketch: "└─┘" }
];
const recommendedPlanTypes = ["basic", "value", "premium"];
const recommendedPlanFallbacks = {
  basic: { planName: "基础实用款", planCapacityCoverage: "基础方案候选暂未生成" },
  value: { planName: "高性价比款", planCapacityCoverage: "性价比方案候选暂未生成" },
  premium: { planName: "高配理想款", planCapacityCoverage: "高配方案候选暂未生成" }
};
let analysisLoadingTimers = [];
let activePlanPreviewCleanup = null;
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
      button.style.opacity = "0.35";
      button.style.cursor = "not-allowed";
    }
    button.innerHTML = iconPath
      ? `<img class="option-icon people-icon" src="${iconPath}" alt="" loading="lazy" /><strong>${option}</strong>`
      : `<span>${String(index + 1).padStart(2, "0")}</span><strong>${option}</strong><i>→</i>${
        disabledReason ? `<small>${disabledReason}</small>` : ""
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
      button.dataset.selected = nextWeight > 0 ? "true" : "false";
      button.dataset.weight = String(nextWeight);
      button.querySelector(".weight-blocks").innerHTML = renderWeightBlocks(nextWeight);
    });
    list.appendChild(button);
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "dimension-next multi-next";
  next.innerHTML = "继续分析 <i>→</i>";
  next.addEventListener("click", () => {
    if (!selected.size) return;
    state.answers[question.key] = { ...weights };
    state.answers[weightKey] = { ...weights };
    state.answers[directionKey] = { ...directions };
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
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.recommendation = buildPlanRecommendation(state.answers);
  shell.classList.remove("is-changing", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis-loading", "is-changing");
  currentProgress.textContent = "分析";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "正在分析您的收纳需求";
  note.textContent = "我们会根据空间尺寸、使用人数、收纳物品和预算，为您生成更适合的配置方向。";

  answerContent.innerHTML = `
    <div class="analysis-loading-card">
      <span class="analysis-loading-spinner" aria-hidden="true"></span>
      <p class="analysis-loading-text">${analysisLoadingMessages[0].text}</p>
    </div>
  `;

  const loadingText = answerContent.querySelector(".analysis-loading-text");
  analysisLoadingMessages.slice(1).forEach((message) => {
    analysisLoadingTimers.push(window.setTimeout(() => {
      loadingText.classList.add("is-switching");
      analysisLoadingTimers.push(window.setTimeout(() => {
        loadingText.textContent = message.text;
        loadingText.classList.remove("is-switching");
      }, 220));
    }, message.delay));
  });
  analysisLoadingTimers.push(window.setTimeout(() => {
    clearAnalysisLoadingTimers();
    renderAiRecommendedPlans();
  }, 5000));
}

function renderAnalysis({ fadeIn = false } = {}) {
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
  title.textContent = "正在分析您的收纳需求";
  note.textContent = "我们会根据空间尺寸、使用人数、收纳物品和预算，为您生成更适合的配置方向。";

  answerContent.innerHTML = `
    <div class="analysis-card${fadeIn ? " is-fade-in" : ""}">
      ${renderReportSection("基础信息", `
        <div class="analysis-grid">
          <p><small>空间类型 / 尺寸</small><strong>${state.answers.spaceUse || "定制空间"} / ${dimensions.layoutType || "I型"} / ${dimensions.width} × ${dimensions.depth} × ${dimensions.height || 2700}mm</strong></p>
          <p><small>使用人数</small><strong class="analysis-icon-value">${renderInlineIconText(state.answers.people || state.answers.style || "待确认")}</strong></p>
          <p><small>预算区间</small><strong>${state.answers.budget || "待确认"}</strong></p>
          <p><small>主要需求</small><strong>${demands.length ? renderDemandChips(demands) : "综合收纳"}</strong></p>
        </div>
      `)}
      ${renderReportSection("需求画像", renderDemandPersona(demandPersona))}
      ${zoneCards.length ? renderReportSection("收纳物品估算", renderZoneCards(zoneCards)) : ""}
      ${Object.keys(demandRatios).length ? renderReportSection("功能区比例", renderStackedRatioBar(demandRatios, labels)) : ""}
      <div class="analysis-actions">
        <button class="analysis-back" type="button">← 返回上一题</button>
        <button class="dimension-next analysis-next" type="button">生成推荐方案 <i>→</i></button>
      </div>
    </div>
  `;
  answerContent.querySelector(".analysis-back").addEventListener("click", () => {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
  });
  answerContent.querySelector(".analysis-next").addEventListener("click", renderAiRecommendedPlans);
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
  title.textContent = "推荐方案";
  note.textContent = "基于您选择的产品系统与空间需求，先为您整理三种方案方向。";

  answerContent.innerHTML = `
    <div class="ai-plan-panel">
      ${isDevelopmentEnvironment() ? renderAiPlanDebugBadge(generatedPlans, recommendedPlans) : ""}
      <div class="ai-plan-context">
        <span>${selectedProductSystem?.name || "未选择产品系统"}</span>
        <span>${dimensions.width || "-"} × ${dimensions.depth || "-"} × ${dimensions.height || 2700} mm</span>
        <span>${payload.peopleCount || "使用人数待确认"}</span>
        <span>${payload.budgetRange || "预算待确认"}</span>
      </div>
      <div class="ai-plan-grid">
        ${recommendedPlans.map(renderAiPlanCard).join("")}
      </div>
      ${isCandidateDebugEnabled() ? renderCandidateDebugPanel(
        candidateDebugStats,
        recommendedPlans,
        payload.budgetRange
      ) : ""}
    </div>
  `;

  updateAiPlanDebugBadge(generatedPlans, recommendedPlans);

  answerContent.querySelectorAll("[data-ai-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = recommendedPlans.find((plan) => plan.planType === button.dataset.aiPlan);
      if (!selected) return;
      state.selectedPlan = selected;
      renderLeadForm(selected);
    });
  });
  answerContent.querySelectorAll("[data-preview-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = recommendedPlans.find((plan) => plan.planType === button.dataset.previewPlan);
      if (!selected) return;
      openPlanPreviewModal(selected, selectedProductSystem);
    });
  });
  loadPlanCardPreviews(recommendedPlans, selectedProductSystem);
}

function renderAiPlanCard(plan) {
  const hasPrice = Number.isFinite(Number(plan.planPrice)) && Number(plan.planPrice) > 0;
  return `
    <article class="ai-plan-card" data-plan-type="${plan.planType}" data-plan-fallback="${plan.isFallback ? "true" : "false"}">
      <span class="ai-plan-type">${plan.planType}</span>
      <button class="planPreview" type="button" data-preview-plan="${plan.planType}" aria-label="查看${plan.planName}3D预览">
        <div class="plan-card-preview-root" data-card-preview-plan="${plan.planType}" data-preview-error="none">
          ${plan.planPreview ? `<img src="${plan.planPreview}" alt="${plan.planName}" loading="lazy" />` : `<span aria-hidden="true"></span>`}
        </div>
        <em class="ai-plan-budget">${hasPrice ? formatPlanPrice(plan.planPrice) : "价格待确认"}<span>${plan.planCapacityCoverage}</span></em>
        <strong>点击查看3D预览</strong>
        <small>可旋转查看</small>
      </button>
      <h2>${plan.planName}</h2>
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
    <aside class="ai-plan-debug-badge" aria-label="AI plan render debug">
      <span>plans.length = ${Array.isArray(generatedPlans) ? generatedPlans.length : 0}</span>
      <span data-ai-plan-card-count>card DOM count = 0</span>
      <span>planTypes = ${renderedPlans.map((plan) => plan.planType).join("/")}</span>
    </aside>
  `;
}

function updateAiPlanDebugBadge(generatedPlans, renderedPlans) {
  const cardCount = answerContent.querySelectorAll(".ai-plan-card").length;
  const cardCountLabel = answerContent.querySelector("[data-ai-plan-card-count]");
  if (cardCountLabel) cardCountLabel.textContent = `card DOM count = ${cardCount}`;
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
    planName: plan.planName || plan.name || planType,
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
    const { mountReadOnlyWardrobePreview } = await import("./ReadOnlyWardrobePreview.js?v=wall-mounted-placement-rules-20260621-05");
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
          mode: "thumbnail"
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
          <span>${plan.planName} / ${formatPlanPrice(plan.planPrice)}</span>
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
    renderLeadForm(plan);
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
    const { mountReadOnlyWardrobePreview } = await import("./ReadOnlyWardrobePreview.js?v=wall-mounted-placement-rules-20260621-05");
    const cleanup = await mountReadOnlyWardrobePreview(container, { plan, selectedProductSystem });
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

function renderLeadForm(plan) {
  clearAnalysisLoadingTimers();
  clearPlanCardPreviews();
  state.selectedPlan = plan;
  const selectedPlanName = plan.planName || plan.name || "推荐方案";
  const selectedPlanCode = plan.code ? `方案 ${plan.code} / ` : "";
  const selectedPlanPrice = plan.planPrice ? formatPlanPrice(plan.planPrice) : (plan.price ? `¥${plan.price.toLocaleString("zh-CN")}` : "");
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-product-system", "is-ai-plans", "is-results", "is-submitted");
  shell.classList.add("is-lead");
  currentProgress.textContent = "确认";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "已为您生成初步方案";
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
  .then(() => renderProductSystemSelection())
  .catch((error) => {
    console.error("[ai-planner] closet rules load failed", error);
    title.textContent = "规则数据暂时无法加载";
    note.textContent = "请刷新页面后重试。";
    answerContent.replaceChildren();
  });
