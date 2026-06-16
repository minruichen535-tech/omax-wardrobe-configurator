import {
  buildPlanRecommendation,
  getQuestionFlow,
  getRatioLabels,
  getZonePresentation
} from "./planRules.js?v=ai-planner-weighted-analysis-20260616-01";

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

function getCurrentQuestions() {
  return getQuestionFlow(state.answers.spaceUse);
}

function renderQuestion(direction = "forward") {
  const questions = getCurrentQuestions();
  const question = questions[state.step];
  shell.dataset.direction = direction;
  shell.classList.remove("is-changing", "is-analysis", "is-results", "is-lead", "is-submitted");
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
  list.className = "answer-options";

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    button.style.setProperty("--option-index", index);
    button.dataset.selected = state.answers[question.key] === option ? "true" : "false";
    button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${option}</strong><i>→</i>`;
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    const weight = weights[option] || (selected.has(option) ? 1 : 0);
    const color = getDemandColor(option);
    button.style.setProperty("--option-index", index);
    button.style.setProperty("--demand-color", color);
    button.dataset.selected = weight > 0 ? "true" : "false";
    button.dataset.weight = String(weight);
    button.innerHTML = `
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${option}</strong>
      <em class="weight-blocks" aria-hidden="true">${Array.from({ length: weight }, () => "<b></b>").join("")}</em>
      <i>${weight > 0 ? "+" : ""}</i>
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
      button.querySelector("i").textContent = nextWeight > 0 ? "+" : "";
      button.querySelector(".weight-blocks").innerHTML = Array.from({ length: nextWeight }, () => "<b></b>").join("");
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
    <button class="dimension-next" type="submit">尺寸确认 <i>→</i></button>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const width = Number(data.get("width"));
    const depth = Number(data.get("depth"));
    if (!width || !depth) return;
    state.answers[question.key] = { width, depth };
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
  renderAnalysis();
}

function renderAnalysis() {
  state.recommendation = buildPlanRecommendation(state.answers);
  const {
    dimensions,
    demandRatios,
    demands,
    itemCounts,
    analysisText
  } = state.recommendation;
  const labels = getRatioLabels(state.answers.spaceUse);
  shell.classList.remove("is-changing", "is-results", "is-lead", "is-submitted");
  shell.classList.add("is-analysis");
  currentProgress.textContent = "AI";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "正在分析您的收纳需求";
  note.textContent = "我们会根据空间尺寸、使用人数、收纳物品和预算，为您生成更适合的配置方向。";

  answerContent.innerHTML = `
    <div class="analysis-card">
      ${renderReportSection("基础信息", `
        <div class="analysis-grid">
          <p><small>空间类型 / 尺寸</small><strong>${state.answers.spaceUse || "定制空间"} / ${dimensions.width} × ${dimensions.depth}mm</strong></p>
          <p><small>使用人数</small><strong>${state.answers.people || state.answers.style || "待确认"}</strong></p>
          <p><small>预算区间</small><strong>${state.answers.budget || "待确认"}</strong></p>
          <p><small>主要需求</small><strong>${demands.length ? demands.join("、") : "综合收纳"}</strong></p>
        </div>
      `)}
      ${itemCounts.length ? renderReportSection("主要物品估算", renderInfoCards(itemCounts)) : ""}
      ${Object.keys(demandRatios).length ? renderReportSection("推荐功能区比例", renderStackedRatioBar(demandRatios, labels)) : ""}
      <p class="analysis-insight">${analysisText || buildInsight(demandRatios, demands, labels)}</p>
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
  const recommendation = state.recommendation || buildPlanRecommendation(state.answers);
  shell.classList.remove("is-changing", "is-analysis", "is-lead", "is-submitted");
  shell.classList.add("is-results");
  currentProgress.textContent = "方案";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "为您准备了三种空间方向";
  note.textContent = "不是标准答案，而是从预算到理想生活的三种设计选择。";

  answerContent.innerHTML = `
    <div class="result-intro">
      <span>${state.answers.spaceUse || "定制空间"}</span>
      <span>${recommendation.dimensions.width} × ${recommendation.dimensions.depth} mm</span>
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
  state.selectedPlan = plan;
  shell.classList.remove("is-changing", "is-analysis", "is-results", "is-submitted");
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
  shell.classList.remove("is-changing", "is-analysis", "is-results", "is-lead");
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

function renderInfoCards(items) {
  return `
    <div class="analysis-card-grid">
      ${items.map((item) => `
        <p><small>${item.name}</small><strong>${item.value || item.text}</strong></p>
      `).join("")}
    </div>
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
      <div class="stacked-ratio-legend">
        ${entries.map((entry) => `
          <p style="--zone-color:${entry.presentation.color}">
            <i></i>
            <span><strong>${entry.label} ${entry.value}%</strong><em>${entry.presentation.description}</em></span>
          </p>
        `).join("")}
      </div>
    </div>
  `;
}

function buildInsight(ratios, demands, labels = {}) {
  const top = Object.entries(ratios).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([key]) => labels[key] || key).join("与");
  const demandText = demands.length ? demands.join("、") : "综合收纳";
  return `系统判断：您的主要需求集中在${demandText}，建议优先强化${top}，并预留后续调整空间。`;
}

backButton.addEventListener("click", () => {
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
