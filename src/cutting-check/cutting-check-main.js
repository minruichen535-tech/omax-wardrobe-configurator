import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import {
  calculateOrder,
  formatRuleNumber,
  parsePastedPurchaseRows,
  reconcilePurchaseRows
} from "./cuttingRules.js";
import {
  deleteOrderSnapshot,
  listSavedOrders,
  loadOrderDraft,
  saveOrderDraft,
  saveOrderSnapshot
} from "./orderStorage.js";

const h = React.createElement;
const RULES_URL = "/src/cutting-check/rules/wall-mounted-cutting-rules.json";

function createId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyGroup(name = "A") {
  return {
    id: createId("group"),
    name,
    wallWidth: "",
    wallDepth: "500",
    wallHeight: "2000",
    bayCount: "1",
    equalSplit: true,
    postColor: "黑色",
    boardColor: "",
    boardType: "普通木层板",
    rodPerBay: "2",
    extraBoardCount: "0",
    boardThickness: "18",
    useManualBoardWidth: false,
    manualBoardWidth: ""
  };
}

function createHumanRow() {
  return {
    id: createId("human"),
    name: "",
    spec: "",
    color: "",
    quantity: "",
    cutLength: ""
  };
}

function createEmptyOrder() {
  return {
    id: createId("order"),
    customerName: "",
    orderNumber: "",
    style: "铝合金立柱靠墙式衣帽间 / 一字型",
    originalCustomerText: "",
    orderDate: todayText(),
    notes: "",
    groups: [createEmptyGroup("A")],
    humanRows: [createHumanRow()]
  };
}

function createWangExample() {
  return {
    id: createId("order"),
    customerName: "王先生",
    orderNumber: "DEMO-WANG",
    style: "铝合金立柱靠墙式衣帽间 / 一字型",
    originalCustomerText: "A组2900×500×2000，3跨，黑色，木胡桃色；B组1400×450×2000，2跨，黑色；C组1600×500×2000，2跨，银色。",
    orderDate: todayText(),
    notes: "内置验收示例；三组均使用人工覆盖板宽。",
    groups: [
      {
        ...createEmptyGroup("A"),
        wallWidth: "2900",
        wallDepth: "500",
        wallHeight: "2000",
        bayCount: "3",
        postColor: "黑色",
        boardColor: "木胡桃色",
        boardType: "普通木层板",
        rodPerBay: "2",
        extraBoardCount: "2",
        boardThickness: "18",
        useManualBoardWidth: true,
        manualBoardWidth: "928"
      },
      {
        ...createEmptyGroup("B"),
        wallWidth: "1400",
        wallDepth: "450",
        wallHeight: "2000",
        bayCount: "2",
        postColor: "黑色",
        boardColor: "木胡桃色",
        boardType: "普通木层板",
        rodPerBay: "2",
        extraBoardCount: "0",
        boardThickness: "18",
        useManualBoardWidth: true,
        manualBoardWidth: "657"
      },
      {
        ...createEmptyGroup("C"),
        wallWidth: "1600",
        wallDepth: "500",
        wallHeight: "2000",
        bayCount: "2",
        postColor: "银色",
        boardColor: "初晴色",
        boardType: "普通木层板",
        rodPerBay: "2",
        extraBoardCount: "0",
        boardThickness: "18",
        useManualBoardWidth: true,
        manualBoardWidth: "757"
      }
    ],
    humanRows: [createHumanRow()]
  };
}

function CuttingCheckApp() {
  const [ruleConfig, setRuleConfig] = useState(null);
  const [ruleError, setRuleError] = useState("");
  const [order, setOrder] = useState(() => loadOrderDraft() || createEmptyOrder());
  const [savedOrders, setSavedOrders] = useState(() => listSavedOrders());
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteErrors, setPasteErrors] = useState([]);

  useEffect(() => {
    fetch(RULES_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setRuleConfig)
      .catch((error) => setRuleError(`规则文件载入失败：${error.message}`));
  }, []);

  useEffect(() => {
    saveOrderDraft(order);
  }, [order]);

  const calculation = useMemo(
    () => ruleConfig ? calculateOrder(order.groups, ruleConfig) : { groupResults: [], purchaseRows: [], hasErrors: false },
    [order.groups, ruleConfig]
  );
  const comparisonRows = useMemo(
    () => reconcilePurchaseRows(calculation.purchaseRows, order.humanRows),
    [calculation.purchaseRows, order.humanRows]
  );
  const pendingCount = calculation.purchaseRows.filter((row) => row.ruleStatus === "pending").length;
  const comparisonIssueCount = comparisonRows.filter((row) => row.status !== "正确" && row.status !== "规则待确认").length;

  const updateOrderField = (key, value) => {
    setOrder((current) => ({ ...current, [key]: value }));
    setSaveMessage("");
  };

  const updateGroup = (groupId, key, value) => {
    setOrder((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === groupId ? { ...group, [key]: value } : group)
    }));
    setSaveMessage("");
  };

  const addGroup = () => {
    const nextName = String.fromCharCode(65 + Math.min(order.groups.length, 25));
    setOrder((current) => ({ ...current, groups: [...current.groups, createEmptyGroup(nextName)] }));
  };

  const copyGroup = (groupId) => {
    setOrder((current) => {
      const source = current.groups.find((group) => group.id === groupId);
      if (!source) return current;
      const copy = { ...structuredClone(source), id: createId("group"), name: `${source.name || "组"}副本` };
      return { ...current, groups: [...current.groups, copy] };
    });
  };

  const deleteGroup = (groupId) => {
    setOrder((current) => ({ ...current, groups: current.groups.filter((group) => group.id !== groupId) }));
  };

  const updateHumanRow = (rowId, key, value) => {
    setOrder((current) => ({
      ...current,
      humanRows: current.humanRows.map((row) => row.id === rowId ? { ...row, [key]: value } : row)
    }));
  };

  const addHumanRow = () => {
    setOrder((current) => ({ ...current, humanRows: [...current.humanRows, createHumanRow()] }));
  };

  const deleteHumanRow = (rowId) => {
    setOrder((current) => ({
      ...current,
      humanRows: current.humanRows.filter((row) => row.id !== rowId)
    }));
  };

  const parsePaste = () => {
    const parsed = parsePastedPurchaseRows(pasteText);
    setPasteErrors(parsed.errors);
    if (parsed.rows.length) {
      setOrder((current) => ({ ...current, humanRows: parsed.rows }));
    }
  };

  const saveCurrentOrder = () => {
    const next = saveOrderSnapshot(order);
    setSavedOrders(next);
    setSelectedSavedId(order.id);
    setSaveMessage("订单已保存到当前设备。");
  };

  const loadSelectedOrder = () => {
    const selected = savedOrders.find((item) => item.id === selectedSavedId);
    if (!selected) return;
    setOrder(structuredClone(selected));
    setSaveMessage("已载入本地订单。");
  };

  const removeSelectedOrder = () => {
    if (!selectedSavedId) return;
    const selected = savedOrders.find((item) => item.id === selectedSavedId);
    if (!window.confirm(`确认删除本地订单“${selected?.orderNumber || selected?.customerName || "未命名"}”？`)) return;
    const next = deleteOrderSnapshot(selectedSavedId);
    setSavedOrders(next);
    setSelectedSavedId("");
    setSaveMessage("本地订单已删除。");
  };

  if (ruleError) {
    return h("main", { className: "cutting-app" },
      h("div", { className: "notice error" }, ruleError)
    );
  }
  if (!ruleConfig) {
    return h("div", { className: "app-loading" }, "正在载入剪尺规则…");
  }

  return h("main", { className: "cutting-app" },
    h(AppHeader, {
      onNew: () => {
        setOrder(createEmptyOrder());
        setSelectedSavedId("");
        setSaveMessage("已新建空白订单。");
      },
      onExample: () => {
        setOrder(createWangExample());
        setSelectedSavedId("");
        setSaveMessage("已载入王先生验收示例。");
      },
      onSave: saveCurrentOrder
    }),
    h("section", { className: "summary-strip", "aria-label": "订单摘要" },
      h(SummaryCard, { label: "衣柜组", value: order.groups.length }),
      h(SummaryCard, { label: "合并采购行", value: calculation.purchaseRows.length }),
      h(SummaryCard, { label: "待确认规则行", value: pendingCount }),
      h(SummaryCard, { label: "采购核对异常", value: comparisonIssueCount })
    ),
    h(SavedOrdersBar, {
      savedOrders,
      selectedSavedId,
      setSelectedSavedId,
      onLoad: loadSelectedOrder,
      onDelete: removeSelectedOrder,
      saveMessage
    }),
    h(OrderInfoSection, { order, updateOrderField }),
    h(GroupsSection, {
      groups: order.groups,
      updateGroup,
      addGroup,
      copyGroup,
      deleteGroup
    }),
    h(GroupResultsSection, { groupResults: calculation.groupResults }),
    h(PurchaseListSection, {
      rows: calculation.purchaseRows,
      order,
      groupResults: calculation.groupResults
    }),
    h(HumanPurchaseSection, {
      rows: order.humanRows,
      updateHumanRow,
      addHumanRow,
      deleteHumanRow,
      pasteText,
      setPasteText,
      pasteErrors,
      parsePaste
    }),
    h(ComparisonSection, { rows: comparisonRows }),
    h(RuleNotesSection, { ruleConfig }),
    h("p", { className: "footer-note" }, "数据仅保存在当前浏览器；尺寸单位为 mm，长度计价单位为米。系统不会自动改写输入值。")
  );
}

function AppHeader({ onNew, onExample, onSave }) {
  return h("header", { className: "app-header" },
    h("div", { className: "brand-row" },
      h("div", { className: "brand-mark" }, "OM"),
      h("div", null,
        h("h1", null, "衣帽间剪尺核对系统"),
        h("p", null, "铝合金立柱靠墙式 · 一字型 · 第一版")
      )
    ),
    h("div", { className: "header-actions" },
      h("a", { className: "button secondary", href: "/admin/" }, "返回管理端"),
      h("button", { type: "button", className: "secondary", onClick: onNew }, "新建空白"),
      h("button", { type: "button", className: "secondary", onClick: onExample }, "载入王先生示例"),
      h("button", { type: "button", onClick: onSave }, "保存当前订单")
    )
  );
}

function SummaryCard({ label, value }) {
  return h("div", { className: "summary-card" },
    h("span", null, label),
    h("strong", null, value)
  );
}

function SavedOrdersBar({ savedOrders, selectedSavedId, setSelectedSavedId, onLoad, onDelete, saveMessage }) {
  return h(React.Fragment, null,
    h("div", { className: "save-bar" },
      h("select", {
        className: "saved-select",
        value: selectedSavedId,
        onChange: (event) => setSelectedSavedId(event.target.value),
        "aria-label": "本地保存订单"
      },
        h("option", { value: "" }, savedOrders.length ? "选择本地保存订单" : "当前设备暂无已保存订单"),
        savedOrders.map((order) => h("option", { value: order.id, key: order.id },
          `${order.orderNumber || "无订单号"} · ${order.customerName || "未填写客户"} · ${order.savedAt ? new Date(order.savedAt).toLocaleString("zh-CN") : ""}`
        ))
      ),
      h("div", { className: "inline-actions" },
        h("button", { type: "button", className: "secondary", disabled: !selectedSavedId, onClick: onLoad }, "载入"),
        h("button", { type: "button", className: "danger", disabled: !selectedSavedId, onClick: onDelete }, "删除本地订单")
      )
    ),
    saveMessage && h("p", { className: "save-message" }, saveMessage)
  );
}

function OrderInfoSection({ order, updateOrderField }) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "一、订单信息",
      description: "订单内容会自动保存为当前设备草稿；点击“保存当前订单”可建立可再次载入的快照。"
    }),
    h("div", { className: "form-grid" },
      h(Field, { label: "客户姓名", value: order.customerName, onChange: (value) => updateOrderField("customerName", value) }),
      h(Field, { label: "订单号", value: order.orderNumber, onChange: (value) => updateOrderField("orderNumber", value) }),
      h(Field, { label: "款式", value: order.style, onChange: (value) => updateOrderField("style", value) }),
      h(Field, { label: "下单日期", type: "date", value: order.orderDate, onChange: (value) => updateOrderField("orderDate", value) }),
      h(Field, {
        label: "原始客户信息文本",
        kind: "textarea",
        className: "wide",
        value: order.originalCustomerText,
        onChange: (value) => updateOrderField("originalCustomerText", value)
      }),
      h(Field, {
        label: "备注",
        kind: "textarea",
        className: "wide",
        value: order.notes,
        onChange: (value) => updateOrderField("notes", value)
      })
    )
  );
}

function GroupsSection({ groups, updateGroup, addGroup, copyGroup, deleteGroup }) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "二、衣柜组管理",
      description: "所有数值保留员工原始输入；修改宽度、跨数或人工板宽后立即重算。",
      actions: h("button", { type: "button", onClick: addGroup }, "新增衣柜组")
    }),
    groups.length
      ? h("div", { className: "group-list" }, groups.map((group) =>
        h(GroupEditor, {
          key: group.id,
          group,
          updateGroup,
          copyGroup,
          deleteGroup,
          canDelete: groups.length > 1
        })
      ))
      : h("div", { className: "empty-state" },
        h("p", null, "当前订单没有衣柜组，合并采购清单为空。"),
        h("button", { type: "button", onClick: addGroup }, "新增第一组")
      )
  );
}

function GroupEditor({ group, updateGroup, copyGroup, deleteGroup, canDelete }) {
  const change = (key) => (value) => updateGroup(group.id, key, value);
  return h("article", { className: "group-card" },
    h("div", { className: "group-card-header" },
      h("h3", null, `${group.name || "未命名"}组`),
      h("div", { className: "group-actions" },
        h("button", { type: "button", className: "secondary small", onClick: () => copyGroup(group.id) }, "复制"),
        h("button", {
          type: "button",
          className: "danger small",
          disabled: !canDelete,
          onClick: () => deleteGroup(group.id)
        }, "删除")
      )
    ),
    h("div", { className: "form-grid" },
      h(Field, { label: "组别名称", value: group.name, onChange: change("name") }),
      h(Field, { label: "空间宽度 mm", type: "number", min: "1", value: group.wallWidth, onChange: change("wallWidth") }),
      h(SelectField, { label: "空间深度 mm", value: group.wallDepth, options: ["300", "450", "500"], onChange: change("wallDepth") }),
      h(Field, { label: "空间高度 mm", type: "number", min: "1", value: group.wallHeight, onChange: change("wallHeight") }),
      h(Field, { label: "跨数", type: "number", min: "1", step: "1", value: group.bayCount, onChange: change("bayCount") }),
      h("label", { className: "field" },
        h("span", null, "是否均分"),
        h("div", { className: "fixed-value" }, "是（第一版固定）")
      ),
      h(SelectField, { label: "立柱颜色", value: group.postColor, options: ["黑色", "银色"], onChange: change("postColor") }),
      h(Field, { label: "板材颜色", value: group.boardColor, onChange: change("boardColor") }),
      h(SelectField, {
        label: "板件类型",
        value: group.boardType,
        options: ["普通木层板", "贵木层板", "玻璃层板"],
        onChange: change("boardType")
      }),
      h(Field, { label: "每跨衣杆数量", type: "number", min: "0", step: "1", value: group.rodPerBay, onChange: change("rodPerBay") }),
      h(Field, { label: "额外中层板数量", type: "number", min: "0", step: "1", value: group.extraBoardCount, onChange: change("extraBoardCount") }),
      h(Field, { label: "木板厚度 mm", type: "number", min: "1", value: group.boardThickness, onChange: change("boardThickness") }),
      h("label", { className: "checkbox-field" },
        h("input", {
          type: "checkbox",
          checked: Boolean(group.useManualBoardWidth),
          onChange: (event) => change("useManualBoardWidth")(event.target.checked)
        }),
        h("span", null, "使用人工覆盖板宽")
      ),
      h(Field, {
        label: "人工板宽 mm",
        type: "number",
        min: "1",
        value: group.manualBoardWidth,
        disabled: !group.useManualBoardWidth,
        onChange: change("manualBoardWidth")
      })
    )
  );
}

function GroupResultsSection({ groupResults }) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "三、计算结果",
      description: "每一项均展示公式和代入值；黄色项目表示规则尚未确认。"
    }),
    groupResults.length
      ? h("div", { className: "result-list" }, groupResults.map((result) =>
        h(GroupResultCard, { key: result.groupId, result })
      ))
      : h("div", { className: "empty-state" }, "暂无衣柜组。")
  );
}

function GroupResultCard({ result }) {
  if (!result.ok) {
    return h("article", { className: "result-card" },
      h("div", { className: "result-card-header" }, h("h3", null, `${result.groupName}组`)),
      h("div", { className: "notice error" }, result.errors.join("；")),
      result.warnings.map((warning) => h("div", { className: "notice warning", key: warning }, warning))
    );
  }
  return h("article", { className: "result-card" },
    h("div", { className: "result-card-header" },
      h("h3", null, `${result.groupName}组`),
      h(StatusBadge, { status: result.metrics.boardWidth.status, manualLabel: true })
    ),
    h("div", { className: "metric-grid" },
      h(Metric, { label: "立柱数量", value: `${formatRuleNumber(result.metrics.postCount)}支` }),
      h(Metric, { label: "导轨剪尺", value: `${formatRuleNumber(result.metrics.guideLength)}mm × 1` }),
      h(Metric, { label: "采用板宽", value: `${formatRuleNumber(result.metrics.boardWidth.value)}mm` }),
      h(Metric, { label: "衣杆剪尺", value: `${formatRuleNumber(result.metrics.rodLength)}mm × ${formatRuleNumber(result.metrics.rodCount)}` })
    ),
    h("div", { className: "notice warning" },
      `理论每跨内宽：${result.metrics.bayInnerWidth.substitution}。该 Excel 旧规则存在1.3–2mm差异，状态为待确认。`,
      result.metrics.boardWidth.status === "manual"
        ? ` 当前计算明确采用人工板宽 ${formatRuleNumber(result.metrics.boardWidth.value)}mm。`
        : " 当前未人工覆盖，因此板件与衣杆也不能标记为已确认。"
    ),
    result.warnings.map((warning) => h("div", { className: "notice warning", key: warning }, warning)),
    h("div", { className: "table-wrap", style: { marginTop: "14px" } },
      h("table", null,
        h("thead", null, h("tr", null,
          h("th", null, "项目"),
          h("th", null, "规格"),
          h("th", null, "颜色"),
          h("th", { className: "numeric" }, "数量"),
          h("th", { className: "numeric" }, "剪尺"),
          h("th", null, "公式与代入"),
          h("th", null, "状态")
        )),
        h("tbody", null, result.items.map((item) => h("tr", { key: item.itemId },
          h("td", null, item.usage),
          h("td", null, item.spec),
          h("td", null, item.color),
          h("td", { className: "numeric" }, `${formatRuleNumber(item.quantity)}${item.unit}`),
          h("td", { className: "numeric" }, item.cutLengthMm === null ? "—" : `${formatRuleNumber(item.cutLengthMm)}mm`),
          h("td", { className: "formula" },
            h("code", null, item.formula),
            item.substitution
          ),
          h("td", null, h(StatusBadge, { status: item.ruleStatus }))
        )))
      )
    )
  );
}

function PurchaseListSection({ rows, order, groupResults }) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "四、订单合并采购清单",
      description: "编码、名称、规格、颜色、剪尺完全相同才会合并；导轨和衣杆余料不跨条合并。",
      actions: h("div", { className: "export-actions" },
        h("button", { type: "button", className: "secondary", onClick: () => exportPurchaseCsv(rows, order) }, "导出CSV"),
        h("button", { type: "button", onClick: () => exportPurchaseExcel(rows, order, groupResults) }, "导出Excel")
      )
    }),
    rows.length
      ? h("div", { className: "table-wrap" },
        h("table", null,
          h("thead", null, h("tr", null,
            h("th", null, "配件编码"),
            h("th", null, "名称"),
            h("th", null, "规格"),
            h("th", null, "颜色"),
            h("th", { className: "numeric" }, "理论数量"),
            h("th", { className: "numeric" }, "实际剪尺"),
            h("th", { className: "numeric" }, "实际总长度"),
            h("th", { className: "numeric" }, "采购计价数量"),
            h("th", null, "规则状态"),
            h("th", null, "来源组别")
          )),
          h("tbody", null, rows.map((row) => h("tr", { key: purchaseRowKey(row) },
            h("td", null, row.code),
            h("td", null, row.name),
            h("td", null, row.spec),
            h("td", null, row.color),
            h("td", { className: "numeric" }, `${formatRuleNumber(row.theoreticalQuantity)}${row.unit}`),
            h("td", { className: "numeric" }, row.cutLengthMm === null ? "—" : `${formatRuleNumber(row.cutLengthMm)}mm`),
            h("td", { className: "numeric" }, row.cutLengthMm === null ? "—" : `${formatRuleNumber(row.totalLengthMm / 1000)}m`),
            h("td", { className: "numeric" }, `${formatRuleNumber(row.purchaseQuantity)}${row.pricingUnit || row.unit}`),
            h("td", null, h(StatusBadge, { status: row.ruleStatus })),
            h("td", null, h("div", { className: "source-tags" },
              row.sourceGroups.map((group) => h("span", { className: "source-tag", key: group }, group)),
              row.usages.map((usage) => h("span", { className: "source-tag", key: usage }, usage))
            ))
          )))
        )
      )
      : h("div", { className: "empty-state" }, "请先填写至少一个有效衣柜组。")
  );
}

function HumanPurchaseSection({
  rows,
  updateHumanRow,
  addHumanRow,
  deleteHumanRow,
  pasteText,
  setPasteText,
  pasteErrors,
  parsePaste
}) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "五、人工采购单核对",
      description: "可逐行录入，也可从 Excel 复制五列后解析。解析仅在点击按钮后替换当前人工行。"
    }),
    h("div", { className: "paste-layout" },
      h("label", { className: "field" },
        h("span", null, "粘贴人工采购数据"),
        h("textarea", {
          value: pasteText,
          onChange: (event) => setPasteText(event.target.value),
          placeholder: "名称\\t规格\\t颜色\\t数量\\t剪尺\\n普通木层板\\t450×18mm\\t木胡桃色\\t2\\t657"
        }),
        h("div", { className: "inline-actions" },
          h("button", { type: "button", className: "secondary", onClick: parsePaste }, "解析并替换人工采购行"),
          h("button", { type: "button", onClick: addHumanRow }, "新增空白行")
        )
      ),
      h("div", { className: "paste-help" },
        h("strong", null, "粘贴列顺序"),
        h("br"),
        "名称、规格、颜色、数量、剪尺",
        h("br"),
        "支持制表符或英文逗号分隔。板材规格请包含深度，例如 450×18mm；这样系统才能明确识别深度差异。"
      )
    ),
    pasteErrors.map((error) => h("div", { className: "notice error", key: error }, error)),
    h("div", { className: "table-wrap" },
      h("table", { className: "editable-table" },
        h("thead", null, h("tr", null,
          h("th", null, "名称"),
          h("th", null, "规格"),
          h("th", null, "颜色"),
          h("th", null, "数量"),
          h("th", null, "剪尺 mm"),
          h("th", null, "操作")
        )),
        h("tbody", null, rows.map((row) => h("tr", { key: row.id },
          h(EditableCell, { className: "name-input", value: row.name, onChange: (value) => updateHumanRow(row.id, "name", value) }),
          h(EditableCell, { value: row.spec, onChange: (value) => updateHumanRow(row.id, "spec", value) }),
          h(EditableCell, { value: row.color, onChange: (value) => updateHumanRow(row.id, "color", value) }),
          h(EditableCell, { type: "number", value: row.quantity, onChange: (value) => updateHumanRow(row.id, "quantity", value) }),
          h(EditableCell, { type: "number", value: row.cutLength, onChange: (value) => updateHumanRow(row.id, "cutLength", value) }),
          h("td", null, h("button", {
            type: "button",
            className: "danger small",
            onClick: () => deleteHumanRow(row.id)
          }, "删除"))
        )))
      )
    )
  );
}

function ComparisonSection({ rows }) {
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "六、核对结果",
      description: "待确认规则即使数值吻合也不会显示为“正确”；深度差异会优先给出明显警告。"
    }),
    rows.length
      ? h("div", { className: "table-wrap" },
        h("table", null,
          h("thead", null, h("tr", null,
            h("th", null, "系统项目"),
            h("th", null, "人工项目"),
            h("th", null, "系统规格/剪尺"),
            h("th", null, "人工规格/剪尺"),
            h("th", null, "状态"),
            h("th", null, "说明")
          )),
          h("tbody", null, rows.map((row) => h("tr", { key: row.id },
            h("td", null, row.expected ? `${row.expected.name} · ${formatRuleNumber(row.expected.theoreticalQuantity)}${row.expected.unit}` : "—"),
            h("td", null, row.human ? `${row.human.name || "未填写"} · ${row.human.quantity || "未填写"}` : "—"),
            h("td", null, row.expected ? `${row.expected.spec}${row.expected.cutLengthMm === null ? "" : ` / ${formatRuleNumber(row.expected.cutLengthMm)}mm`}` : "—"),
            h("td", null, row.human ? `${row.human.spec || "未填写"}${row.human.cutLength ? ` / ${row.human.cutLength}mm` : ""}` : "—"),
            h("td", null, h(ReconciliationBadge, { status: row.status })),
            h("td", { className: "comparison-message" }, row.message)
          )))
        )
      )
      : h("div", { className: "empty-state" }, "请填写人工采购数据后查看逐项核对结果。")
  );
}

function RuleNotesSection({ ruleConfig }) {
  const pendingRules = ruleConfig.rules.filter((rule) => rule.status === "pending");
  return h("section", { className: "panel" },
    h(SectionHeading, {
      title: "规则状态说明",
      description: `当前规则集：${ruleConfig.name} / ${ruleConfig.ruleSetId}`
    }),
    h("div", { className: "notice success" }, "已确认：立柱数量、2000mm立柱规格、导轨剪尺、顶板托、顶板数量、中层板数量与托件、衣杆剪尺。"),
    pendingRules.map((rule) => h("div", { className: "notice warning", key: rule.id },
      h("strong", null, `${rule.name}：`),
      `${rule.formula}。${rule.note}`
    ))
  );
}

function SectionHeading({ title, description, actions }) {
  return h("div", { className: "section-heading" },
    h("div", null,
      h("h2", null, title),
      description && h("p", null, description)
    ),
    actions
  );
}

function Field({ label, kind = "input", className = "", value, onChange, ...props }) {
  const common = {
    value: value ?? "",
    onChange: (event) => onChange(event.target.value),
    ...props
  };
  return h("label", { className: `field ${className}`.trim() },
    h("span", null, label),
    kind === "textarea" ? h("textarea", common) : h("input", common)
  );
}

function SelectField({ label, value, options, onChange }) {
  return h("label", { className: "field" },
    h("span", null, label),
    h("select", { value, onChange: (event) => onChange(event.target.value) },
      options.map((option) => h("option", { value: option, key: option }, option))
    )
  );
}

function EditableCell({ value, onChange, type = "text", className = "" }) {
  return h("td", null,
    h("input", {
      className,
      type,
      value: value ?? "",
      onChange: (event) => onChange(event.target.value)
    })
  );
}

function Metric({ label, value }) {
  return h("div", { className: "metric" },
    h("span", null, label),
    h("strong", null, value)
  );
}

function StatusBadge({ status, manualLabel = false }) {
  const label = status === "pending"
    ? "规则待确认"
    : status === "manual" && manualLabel
      ? "人工覆盖"
      : "已确认";
  const className = status === "pending" ? "pending" : "confirmed";
  return h("span", { className: `status ${className}` }, label);
}

function ReconciliationBadge({ status }) {
  const className = status === "正确" ? "correct" : status === "规则待确认" ? "pending" : "error";
  return h("span", { className: `status ${className}` }, status);
}

function purchaseRowKey(row) {
  return [row.code, row.name, row.spec, row.color, row.cutLengthMm ?? ""].join("|");
}

function exportPurchaseCsv(rows, order) {
  const data = rows.map((row) => ({
    配件编码: row.code,
    名称: row.name,
    规格: row.spec,
    颜色: row.color,
    理论数量: row.theoreticalQuantity,
    数量单位: row.unit,
    实际剪尺mm: row.cutLengthMm ?? "",
    实际总长度m: row.cutLengthMm === null ? "" : row.totalLengthMm / 1000,
    采购计价数量: row.purchaseQuantity,
    采购计价单位: row.pricingUnit || row.unit,
    规则状态: row.ruleStatus === "pending" ? "待确认" : "已确认",
    来源组别: row.sourceGroups.join("、")
  }));
  const headers = Object.keys(data[0] || { 提示: "" });
  const csv = [headers, ...data.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  downloadBlob(`剪尺采购清单-${safeFileName(order.orderNumber || order.customerName || "未命名")}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function exportPurchaseExcel(rows, order, groupResults) {
  const workbook = XLSX.utils.book_new();
  const purchaseData = rows.map((row) => ({
    配件编码: row.code,
    名称: row.name,
    规格: row.spec,
    颜色: row.color,
    理论数量: row.theoreticalQuantity,
    数量单位: row.unit,
    实际剪尺mm: row.cutLengthMm ?? "",
    实际总长度m: row.cutLengthMm === null ? "" : row.totalLengthMm / 1000,
    采购计价数量: row.purchaseQuantity,
    采购计价单位: row.pricingUnit || row.unit,
    规则状态: row.ruleStatus === "pending" ? "待确认" : "已确认",
    来源组别: row.sourceGroups.join("、"),
    公式代入: row.formulas.join("\n")
  }));
  const groupData = groupResults.flatMap((result) => result.ok
    ? result.items.map((item) => ({
      组别: result.groupName,
      项目: item.usage,
      规格: item.spec,
      颜色: item.color,
      数量: item.quantity,
      单位: item.unit,
      剪尺mm: item.cutLengthMm ?? "",
      规则状态: item.ruleStatus === "pending" ? "待确认" : "已确认",
      公式: item.formula,
      代入: item.substitution
    }))
    : [{ 组别: result.groupName, 项目: "输入错误", 代入: result.errors.join("；") }]
  );
  const orderData = [{
    客户姓名: order.customerName,
    订单号: order.orderNumber,
    款式: order.style,
    下单日期: order.orderDate,
    原始客户信息: order.originalCustomerText,
    备注: order.notes
  }];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orderData), "订单信息");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchaseData), "合并采购清单");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groupData), "分组计算明细");
  XLSX.writeFile(workbook, `剪尺核对-${safeFileName(order.orderNumber || order.customerName || "未命名")}.xlsx`);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function safeFileName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-");
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

createRoot(document.getElementById("root")).render(h(CuttingCheckApp));
