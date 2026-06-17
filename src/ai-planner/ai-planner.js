import {
  buildPlanRecommendation,
  getQuestionFlow,
  getRatioLabels,
  getZonePresentation
} from "./planRules.js?v=cache-20260617-01";

const state = {
  step: 0,
  answers: {},
  recommendation: null,
  selectedPlan: null
};

const shell = document.querySelector(".planner-shell");
const title = document.querySelector(".question-title");
const note = document.querySelector(".question-note");
const answerContent = document.querySelector(".answer-content");
const currentProgress = document.querySelector(".progress-current");
const progressLine = document.querySelector(".planner-progress i");
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
let analysisLoadingTimers = [];
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

function getCurrentQuestions() {
  return getQuestionFlow(state.answers.spaceUse);
}

function clearAnalysisLoadingTimers() {
  analysisLoadingTimers.forEach((timer) => window.clearTimeout(timer));
  analysisLoadingTimers = [];
}

function renderQuestion(direction = "forward") {
  clearAnalysisLoadingTimers();
  const questions = getCurrentQuestions();
  const question = questions[state.step];
  shell.dataset.direction = direction;
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-results", "is-lead", "is-submitted");
  void shell.offsetWidth;
  shell.classList.add("is-changing");

  title.textContent = question.title;
  note.textContent = question.note;
  currentProgress.textContent = String(state.step + 1);
  progressLine.style.transform = `scaleX(${(state.step + 1) / questions.length})`;
  backButton.disabled = state.step === 0;
  answerContent.replaceChildren();

  if (question.type === "dimensions") {
    renderDimensions(question);
  } else if (question.type === "multi") {
    renderMultiOptions(question);
  } else {
    renderOptions(question);
  }
}

function renderOptions(question) {
  const list = document.createElement("div");
  const usesPeopleIcons = question.key === "people";
  list.className = `answer-options${usesPeopleIcons ? " people-options" : ""}`;

  question.options.forEach((option, index) => {
    const iconPath = usesPeopleIcons ? getOptionIconPath(option) : "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `answer-option${iconPath ? " people-option has-option-icon" : ""}`;
    button.style.setProperty("--option-index", index);
    button.dataset.selected = state.answers[question.key] === option ? "true" : "false";
    button.innerHTML = iconPath
      ? `<img class="option-icon people-icon" src="${iconPath}" alt="" loading="lazy" /><strong>${option}</strong>`
      : `<span>${String(index + 1).padStart(2, "0")}</span><strong>${option}</strong><i>→</i>`;
    button.addEventListener("click", () => selectOption(question.key, option, button));
    list.appendChild(button);
  });

  answerContent.appendChild(list);
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
  const selectedLayout = values.layoutType || "I型";
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
    <fieldset class="layout-selector">
      <legend>空间布局</legend>
      <p>请选择空间的基本布局形式</p>
      <div class="layout-options">
        ${layoutOptions.map((layout) => `
          <label class="layout-option">
            <input type="radio" name="layoutType" value="${layout.value}" ${selectedLayout === layout.value ? "checked" : ""} />
            <span class="layout-sketch">${layout.sketch}</span>
            <strong>${layout.title}</strong>
            <em>${layout.subtitle}</em>
          </label>
        `).join("")}
      </div>
    </fieldset>
    <button class="dimension-next" type="submit">尺寸确认 <i>→</i></button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const width = Number(data.get("width"));
    const depth = Number(data.get("depth"));
    const height = Number(data.get("height")) || 2700;
    const layoutType = data.get("layoutType") || "I型";
    if (!width || !depth || !height) return;
    state.answers[question.key] = { width, depth, height, layoutType };
    nextStep();
  });
  answerContent.appendChild(form);
}

function selectOption(key, option, button) {
  if (key === "spaceUse" && state.answers.spaceUse !== option) {
    state.answers = { spaceUse: option };
    state.recommendation = null;
    state.selectedPlan = null;
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
  state.recommendation = buildPlanRecommendation(state.answers);
  shell.classList.remove("is-changing", "is-analysis", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis-loading", "is-changing");
  currentProgress.textContent = "AI";
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
    renderAnalysis({ fadeIn: true });
  }, 5000));
}

function renderAnalysis({ fadeIn = false } = {}) {
  clearAnalysisLoadingTimers();
  state.recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  const {
    dimensions,
    demandRatios,
    demands,
    zoneCards,
    demandPersona
  } = state.recommendation;
  const labels = getRatioLabels(state.answers.spaceUse);
  shell.classList.remove("is-changing", "is-analysis-loading", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis");
  currentProgress.textContent = "AI";
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
      ${renderReportSection("AI需求画像", renderDemandPersona(demandPersona))}
      ${zoneCards.length ? renderReportSection("收纳物品估算", renderZoneCards(zoneCards)) : ""}
      ${Object.keys(demandRatios).length ? renderReportSection("功能区比例", renderStackedRatioBar(demandRatios, labels)) : ""}
      <div class="analysis-actions">
        <button class="analysis-back" type="button">← 返回上一题</button>
        <button class="dimension-next analysis-next" type="button">查看方案 <i>→</i></button>
      </div>
    </div>
  `;
  answerContent.querySelector(".analysis-back").addEventListener("click", () => {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
  });
  answerContent.querySelector(".analysis-next").addEventListener("click", renderResults);
}

function renderResults() {
  clearAnalysisLoadingTimers();
  const recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-lead", "is-submitted");
  shell.classList.add("is-results");
  currentProgress.textContent = "方案";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "为您准备了三种空间方向";
  note.textContent = "不是标准答案，而是从预算到理想生活的三种设计选择。";

  answerContent.innerHTML = `
    <div class="result-intro">
      <span>${state.answers.spaceUse || "定制空间"}</span>
      <span>${recommendation.dimensions.layoutType || "I型"} / ${recommendation.dimensions.width} × ${recommendation.dimensions.depth} × ${recommendation.dimensions.height || 2700} mm</span>
      <span>${recommendation.demands.length ? recommendation.demands.join("、") : "综合收纳"}</span>
    </div>
    <div class="result-plans">
      ${recommendation.plans.map((plan) => renderPlanCard(plan, recommendation)).join("")}
    </div>
  `;

  answerContent.querySelectorAll("[data-select-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      const plan = recommendation.plans.find((item) => item.code === button.dataset.selectPlan);
      renderLeadForm(plan);
    });
  });
}

function renderPlanCard(plan, recommendation) {
  return `
    <article class="result-plan${plan.recommended ? " is-recommended" : ""}">
      <header><span>方案 ${plan.code}</span>${plan.recommended ? "<em>推荐</em>" : ""}</header>
      <h2>${plan.name}</h2>
      <p class="result-price"><small>预计价格</small><strong>¥${plan.price.toLocaleString("zh-CN")}</strong></p>
      <p class="result-satisfaction"><small>满足度</small><strong>${plan.satisfaction}</strong></p>
      <p class="result-series"><small>推荐系统</small><strong>${recommendation.system}</strong></p>
      <p class="result-summary">${plan.position}<br>${plan.summary}</p>
      <div class="mini-ratios">${renderRatioRows(recommendation.demandRatios, true, getRatioLabels(state.answers.spaceUse))}</div>
      <button type="button" data-select-plan="${plan.code}">选择此方案 <i>→</i></button>
    </article>
  `;
}

function renderLeadForm(plan) {
  clearAnalysisLoadingTimers();
  state.selectedPlan = plan;
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-results", "is-submitted");
  shell.classList.add("is-lead");
  currentProgress.textContent = "确认";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "已为您生成初步方案";
  note.textContent = "留下联系方式后，璞舍顾问会根据您的空间尺寸和收纳需求，为您进一步确认尺寸、预算和落地细节。";
  answerContent.innerHTML = `
    <form class="lead-form">
      <p class="lead-selected">已选择：方案 ${plan.code} / ${plan.name} / ¥${plan.price.toLocaleString("zh-CN")}</p>
      <label><span>姓名</span><input name="name" required autocomplete="name" /></label>
      <label><span>手机号</span><input name="phone" required inputmode="tel" autocomplete="tel" /></label>
      <label><span>微信号（选填）</span><input name="wechat" /></label>
      <label><span>所在城市（选填）</span><input name="city" autocomplete="address-level2" /></label>
      <button class="dimension-next" type="submit">提交方案需求</button>
    </form>
  `;
  answerContent.querySelector(".lead-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      selectedPlan: plan,
      answers: state.answers,
      contact: {
        name: form.get("name"),
        phone: form.get("phone"),
        wechat: form.get("wechat"),
        city: form.get("city")
      }
    };
    console.log("[ai-planner] lead", payload);
    renderSubmitted();
  });
}

function renderSubmitted() {
  clearAnalysisLoadingTimers();
  shell.classList.remove("is-changing", "is-analysis-loading", "is-analysis", "is-results", "is-lead");
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
    renderResults();
    return;
  }
  if (shell.classList.contains("is-results")) {
    renderAnalysis();
    return;
  }
  if (shell.classList.contains("is-analysis")) {
    state.step = getCurrentQuestions().length - 1;
    renderQuestion("back");
    return;
  }
  if (state.step === 0) return;
  state.step -= 1;
  renderQuestion("back");
});

renderQuestion();
