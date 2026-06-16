const questions = [
  {
    key: "spaceUse",
    title: "这个空间主要用于什么？",
    note: "先从空间的日常角色开始。",
    options: ["衣帽间", "主卧衣柜", "玄关收纳", "客厅展示", "书房收纳"]
  },
  {
    key: "people",
    title: "有多少人使用？",
    note: "人数会影响分区方式和每个人的使用尺度。",
    options: ["1人", "2人", "3人", "4人以上"]
  },
  {
    key: "storage",
    title: "您最希望收纳什么？",
    note: "选择最重要的一项，我们会为它保留更从容的位置。",
    options: ["衣物", "鞋包", "收藏展示", "综合收纳"]
  },
  {
    key: "dimensions",
    title: "空间尺寸是多少？",
    note: "大致尺寸即可，设计顾问会在下一阶段为您复核。",
    type: "dimensions"
  },
  {
    key: "budget",
    title: "希望控制在什么范围？",
    note: "我们会同时保留预算、体验和理想状态三种可能。",
    options: ["3,000以下", "3,000 - 5,000", "5,000 - 8,000", "8,000 - 12,000", "12,000 - 18,000", "18,000+"]
  }
];

const state = {
  step: 0,
  answers: {}
};

const shell = document.querySelector(".planner-shell");
const title = document.querySelector(".question-title");
const note = document.querySelector(".question-note");
const answerContent = document.querySelector(".answer-content");
const currentProgress = document.querySelector(".progress-current");
const progressLine = document.querySelector(".planner-progress i");
const backButton = document.querySelector(".back-button");

function renderQuestion(direction = "forward") {
  const question = questions[state.step];
  shell.dataset.direction = direction;
  shell.classList.remove("is-changing", "is-results");
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
  state.answers[key] = option;
  answerContent.querySelectorAll(".answer-option").forEach((item) => {
    item.dataset.selected = item === button ? "true" : "false";
  });
  window.setTimeout(nextStep, 360);
}

function nextStep() {
  if (state.step < questions.length - 1) {
    state.step += 1;
    renderQuestion("forward");
    return;
  }
  renderResults();
}

function renderResults() {
  shell.classList.remove("is-changing");
  shell.classList.add("is-results");
  currentProgress.textContent = "5";
  progressLine.style.transform = "scaleX(1)";
  backButton.disabled = false;
  title.textContent = "为您准备了三种空间方向";
  note.textContent = "不是标准答案，而是从预算到理想生活的三种设计选择。";

  const dimensions = state.answers.dimensions || { width: 3600, depth: 2800 };
  const areaFactor = Math.max(0.85, Math.min(1.35, (dimensions.width * dimensions.depth) / 10080000));
  const basePrices = [4800, 6800, 9800].map((price) => Math.round((price * areaFactor) / 100) * 100);
  const plans = [
    { code: "A", name: "预算优先", price: basePrices[0], satisfaction: "82%", summary: "保留核心挂放与层板收纳，以清晰分区控制整体投入。" },
    { code: "B", name: "推荐方案", price: basePrices[1], satisfaction: "94%", summary: "兼顾日常容量、动线和展示感，是多数家庭更从容的选择。", recommended: true },
    { code: "C", name: "理想方案", price: basePrices[2], satisfaction: "98%", summary: "增加精细分类与氛围体验，让收纳成为空间设计的一部分。" }
  ];

  answerContent.innerHTML = `
    <div class="result-intro">
      <span>${state.answers.spaceUse || "定制空间"}</span>
      <span>${dimensions.width} × ${dimensions.depth} mm</span>
      <span>${state.answers.storage || "综合收纳"}</span>
    </div>
    <div class="result-plans">
      ${plans.map((plan) => `
        <article class="result-plan${plan.recommended ? " is-recommended" : ""}">
          <header><span>方案 ${plan.code}</span>${plan.recommended ? "<em>推荐</em>" : ""}</header>
          <h2>${plan.name}</h2>
          <p class="result-price"><small>预计价格</small><strong>¥${plan.price.toLocaleString("zh-CN")}</strong></p>
          <p class="result-satisfaction"><small>满足度</small><strong>${plan.satisfaction}</strong></p>
          <p class="result-series"><small>推荐产品系列</small><strong>Wall Mounted</strong></p>
          <p class="result-summary">${plan.summary}</p>
          <a href="/configurator/wall-mounted-v2">进入配置器 <i>→</i></a>
        </article>
      `).join("")}
    </div>
  `;
}

backButton.addEventListener("click", () => {
  if (shell.classList.contains("is-results")) {
    renderQuestion("back");
    return;
  }
  if (state.step === 0) return;
  state.step -= 1;
  renderQuestion("back");
});

renderQuestion();
