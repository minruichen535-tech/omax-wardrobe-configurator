import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { calculateDesign, createInitialConfig, labelWall } from "../configurator.js?v=cache-20260621-02";
import { loadWorkbookData } from "../dataSource.js?v=cache-20260621-02";
import { getSeries } from "../config/productSeries.js?v=wall-mounted-client-route-20260703-01";
import { WardrobeScene } from "../scene.js?v=global-side-wall-soften-20260718-01";
import { getCuttingRules, getDisplayRules } from "../series/index.js?v=drawer-material-sync-20260702-01";

const h = React.createElement;
const statusOptions = [
  ["submitted", "已提交"],
  ["reviewing", "审核中"],
  ["confirmed", "已确认"],
  ["picking", "配货中"],
  ["production", "生产中"],
  ["packed", "已包装"],
  ["completed", "已完成"],
  ["cancelled", "已取消"]
];
const statusLabelByValue = Object.fromEntries(statusOptions);

function DealerOrderDetailPage() {
  const orderId = getOrderIdFromUrl();
  const [detail, setDetail] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [picking, setPicking] = useState({ rows: {} });
  const [showVisualItems, setShowVisualItems] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError("缺少订单 ID。");
      return;
    }
    loadOrder(orderId)
      .then((payload) => {
        setDetail(payload);
        setStatus(payload.order.status || "submitted");
        setAdminNotes(payload.adminNotes || "");
        setPicking(payload.picking || { rows: {} });
        const series = getSeries(payload.order.seriesId);
        if (!series) throw new Error("unknown_series");
        return loadWorkbookData(series).then((workbookData) => setData(workbookData));
      })
      .catch((loadError) => {
        console.error("[dealer order detail] load failed", loadError);
        setError(loadError.message === "unknown_series" ? "未知产品系列，无法打开订单。" : "订单详情加载失败。");
      });
  }, [orderId]);

  const config = useMemo(() => detail ? buildConfigFromOrder(detail.designConfig) : null, [detail]);
  const design = useMemo(() => (config && data ? calculateDesign(config, data) : null), [config, data]);
  const displayRules = useMemo(() => (data ? getDisplayRules(data.series.seriesId) : null), [data]);
  const cuttingRules = useMemo(() => (data ? getCuttingRules(data.series.seriesId) : null), [data]);
  const bomRows = detail?.bom?.length ? detail.bom : design?.bom || [];
  const cuttingRows = detail?.cuttingList?.length ? detail.cuttingList : [];
  const placementRows = detail?.placements || [];
  const progress = getPickingProgress(bomRows, picking);

  const persistWorkflow = async (patch) => {
    const nextPayload = {
      status,
      adminNotes,
      picking,
      ...patch
    };
    const response = await fetch(`/api/admin/dealer-orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextPayload)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "保存订单状态失败。");
      return null;
    }
    setDetail(payload);
    setStatus(payload.order.status || "submitted");
    setAdminNotes(payload.adminNotes || "");
    setPicking(payload.picking || { rows: {} });
    setError("");
    setMessage("订单已更新。");
    return payload;
  };

  const updatePickingRow = async (itemKey, field, checked) => {
    const now = checked ? new Date().toISOString() : "";
    const nextPicking = {
      rows: {
        ...(picking.rows || {}),
        [itemKey]: {
          ...(picking.rows?.[itemKey] || {}),
          [field]: now
        }
      }
    };
    setPicking(nextPicking);
    await persistWorkflow({ picking: nextPicking });
  };

  if (error && !detail) {
    return h("main", { className: "product-catalog dealer-order-page" },
      h("section", { className: "dealer-login-card" },
        h("h1", null, "订单详情"),
        h("p", { className: "dealer-profile-error" }, error),
        h("a", { className: "dealer-profile-button", href: "/admin/dealers/" }, "返回订单列表")
      )
    );
  }
  if (!detail) {
    return h("main", { className: "loading-state" }, h("h1", null, "正在加载订单详情..."));
  }

  return h("main", { className: "product-catalog dealer-order-page" },
    h("header", { className: "product-catalog-header dealer-profile-header" },
      h("div", { className: "product-catalog-mark" }, "OM"),
      h("div", null,
        h("h1", null, "经销商订单详情"),
        h("p", null, detail.order.id)
      ),
      h("div", { className: "dealer-admin-header-actions" },
        h("a", { className: "dealer-profile-home-link secondary", href: "/admin/dealers/" }, "返回订单列表"),
        h("button", { className: "dealer-profile-button secondary", type: "button", onClick: () => window.alert("重新编辑方案功能待接入：已保留完整订单 payload，下一阶段接入安全 restore token。") }, "重新编辑方案"),
        h("button", { className: "dealer-profile-button", type: "button", onClick: () => exportProductionPackage(detail, bomRows, cuttingRows) }, "导出生产包")
      )
    ),
    h("section", { className: "dealer-order-grid" },
      h(OrderCard, { title: "订单信息" },
        h(InfoGrid, { rows: [
          ["订单 ID", detail.order.id],
          ["状态", statusLabelByValue[detail.order.status] || detail.order.status],
          ["提交时间", detail.order.createdAt],
          ["更新时间", detail.order.updatedAt],
          ["经销商", detail.dealerProfile.brandName || detail.dealerProfile.companyName],
          ["方案/项目", detail.order.projectName || detail.order.planName],
          ["系列", detail.order.seriesId]
        ] }),
        h("div", { className: "dealer-order-status-row" },
          h("select", { value: status, onChange: (event) => setStatus(event.target.value) },
            statusOptions.map(([value, label]) => h("option", { key: value, value }, label))
          ),
          h("button", { type: "button", onClick: () => persistWorkflow({ status }) }, "更新状态")
        ),
        message && h("p", { className: "dealer-profile-message" }, message),
        error && h("p", { className: "dealer-profile-error" }, error)
      ),
      h(OrderCard, { title: "经销商与客户信息" },
        h(InfoGrid, { rows: [
          ["经销商公司", detail.dealerProfile.companyName],
          ["经销商品牌", detail.dealerProfile.brandName],
          ["经销商联系人", detail.dealerProfile.contactName],
          ["经销商电话", detail.dealerProfile.phone],
          ["经销商微信", detail.dealerProfile.wechat],
          ["经销商邮箱", detail.dealerProfile.email],
          ["经销商地址", detail.dealerProfile.address],
          ["客户/项目参考", detail.order.customerReference],
          ["客户姓名", detail.order.customerName],
          ["客户电话", detail.order.customerPhone],
          ["客户地址", detail.order.customerAddress],
          ["订单备注", detail.order.notes]
        ] })
      )
    ),
    h(OrderCard, { title: "3D 模型核对", wide: true },
      config && design && data
        ? h("div", null,
          h("label", { className: "dealer-order-toggle" },
            h("input", { type: "checkbox", checked: showVisualItems, onChange: (event) => setShowVisualItems(event.target.checked) }),
            "显示物品"
          ),
          h("div", { className: "dealer-order-scene" },
            h(WardrobeScene, {
              key: `dealer-order-${detail.order.id}-${showVisualItems}`,
              config: showVisualItems ? config : { ...config, visualAssets: [] },
              design,
              series: data.series,
              readOnly: true,
              previewMode: "admin-order"
            })
          )
        )
        : h("p", { className: "quote-note" }, "该历史订单缺少完整模型数据。")
    ),
    h("section", { className: "dealer-order-grid" },
      h(OrderCard, { title: "配置摘要" }, h(ConfigSummary, { config: detail.designConfig })),
      h(OrderCard, { title: "拣货进度" },
        h("div", { className: "dealer-order-progress" },
          h("span", null, `已拣货 ${progress.picked} / ${progress.total}`),
          h("span", null, `已复核 ${progress.verified} / ${progress.total}`),
          h("span", null, `已包装 ${progress.packed} / ${progress.total}`)
        ),
        h("label", { className: "dealer-profile-field dealer-order-notes" },
          h("span", null, "人工复核备注"),
          h("textarea", { value: adminNotes, rows: 5, onChange: (event) => setAdminNotes(event.target.value) })
        ),
        h("button", { type: "button", className: "dealer-profile-button", onClick: () => persistWorkflow({ adminNotes }) }, "保存备注")
      )
    ),
    h(OrderCard, { title: "Placement 明细", wide: true }, h(PlacementTable, { rows: placementRows, design, cuttingRules })),
    h(OrderCard, { title: "内部 BOM / 拣货", wide: true }, h(BomPickingTable, { rows: bomRows, picking, onChange: updatePickingRow, seriesId: detail.order.seriesId })),
    h(OrderCard, { title: "Cutting List", wide: true }, h(CuttingTable, { rows: cuttingRows })),
    h(OrderCard, { title: "原始订单数据", wide: true },
      h("details", null,
        h("summary", null, "原始订单数据"),
        h("button", { type: "button", className: "dealer-profile-button secondary", onClick: () => navigator.clipboard?.writeText(JSON.stringify(detail.rawPayload, null, 2)) }, "复制 JSON"),
        h("pre", { className: "dealer-order-json" }, JSON.stringify(detail.rawPayload, null, 2))
      )
    )
  );
}

function OrderCard({ title, wide = false, children }) {
  return h("section", { className: `dealer-order-card${wide ? " wide" : ""}` }, h("h2", null, title), children);
}

function InfoGrid({ rows }) {
  return h("dl", { className: "dealer-order-info-grid" }, rows.map(([label, value]) => [
    h("dt", { key: `${label}-dt` }, label),
    h("dd", { key: `${label}-dd` }, value || "—")
  ]).flat());
}

function ConfigSummary({ config }) {
  const walls = config?.walls || {};
  return h(InfoGrid, { rows: [
    ["房间宽度", formatMm(config?.room?.width)],
    ["房间深度", formatMm(config?.room?.depth)],
    ["房间高度", formatMm(config?.room?.height)],
    ["布局", config?.layout],
    ["墙面", Object.keys(walls).join(", ")],
    ["跨数", Object.entries(walls).map(([wallId, wall]) => `${labelWall(wallId)} ${wall?.bayCount || "—"}跨`).join(" / ")],
    ["跨宽", Object.entries(walls).map(([wallId, wall]) => `${labelWall(wallId)} ${(wall?.bayWidths || []).join(" / ") || "自动"}`).join("；")],
    ["立柱高度", formatMm(config?.postHeight)],
    ["层板深度", formatMm(config?.shelfDepth)],
    ["颜色", [config?.frameColor, config?.woodColor].filter(Boolean).join(" / ")],
    ["LED", config?.led === true ? "是" : config?.led === false ? "否" : "—"]
  ] });
}

function PlacementTable({ rows, design, cuttingRules }) {
  return h("div", { className: "table-wrap" }, h("table", { className: "dealer-order-table" },
    h("thead", null, h("tr", null, ["墙", "跨", "组件", "内部 SKU", "规格", "离地", "数量", "备注", "上层内件", "下层内件"].map((label) => h("th", { key: label }, label)))),
    h("tbody", null, rows.map((placement, index) => {
      const product = placement.productSku ? design?.productBySku?.[placement.productSku] : design?.productByType?.[placement.componentType];
      return h("tr", { key: placement.id || index },
        h("td", null, labelWall(placement.wallId || "")),
        h("td", null, Number(placement.bayIndex) + 1 || "—"),
        h("td", null, product?.nameCn || placement.componentType),
        h("td", null, placement.productSku || product?.sku || "—"),
        h("td", null, placement.cutLength ? `${placement.cutLength}mm` : placement.moduleWidth || placement.standardWidth || "—"),
        h("td", null, formatMm(placement.heightFromFloor)),
        h("td", null, placement.quantity || 1),
        h("td", null, placement.note || placement.source || ""),
        h("td", null, placement.topDrawerSku || "—"),
        h("td", null, placement.bottomDrawerSku || "—")
      );
    }))
  ));
}

function BomPickingTable({ rows, picking, onChange, seriesId }) {
  const grouped = groupRows(rows, (row) => row.bomGroup || "未分组");
  return h("div", { className: "dealer-order-bom-groups" }, Object.entries(grouped).map(([group, items]) => (
    h("details", { key: group, open: true, className: "dealer-order-bom-group" },
      h("summary", null, group),
      h("div", { className: "table-wrap" }, h("table", { className: "dealer-order-table" },
	        h("thead", null, h("tr", null, ["拣货", "复核", "包装", "图片", "内部 SKU", "产品名称", "规格", "数量", "单位", "墙/跨", "备注"].map((label) => h("th", { key: label }, label)))),
	        h("tbody", null, items.map((item, index) => {
	          const key = getBomItemKey(item, index);
	          const state = picking.rows?.[key] || {};
	          const wallBayText = item.wallId || item.wall || item.bayIndex != null
	            ? `${item.wallId || item.wall || ""} ${item.bayIndex != null ? Number(item.bayIndex) + 1 : ""}`.trim()
	            : "—";
	          return h("tr", { key },
	            h("td", null, h("input", { type: "checkbox", checked: Boolean(state.pickedAt), onChange: (event) => onChange(key, "pickedAt", event.target.checked) })),
	            h("td", null, h("input", { type: "checkbox", checked: Boolean(state.verifiedAt), onChange: (event) => onChange(key, "verifiedAt", event.target.checked) })),
	            h("td", null, h("input", { type: "checkbox", checked: Boolean(state.packedAt), onChange: (event) => onChange(key, "packedAt", event.target.checked) })),
            h("td", null, item.image ? h("img", { className: "dealer-order-product-image", src: resolveOrderImage(seriesId, item.image), alt: item.nameCn || item.sku }) : "—"),
            h("td", null, item.sku || "—"),
	            h("td", null, item.nameCn || item.nameEn || "—"),
	            h("td", null, item.spec || item.specification || "—"),
	            h("td", null, item.displayQuantity || item.quantity || "—"),
	            h("td", null, item.unit || "—"),
	            h("td", null, wallBayText),
	            h("td", null, item.note || "")
	          );
	        }))
      ))
    )
  )));
}

function CuttingTable({ rows }) {
  if (!rows.length) return h("p", { className: "quote-note" }, "订单未保存 cutting list snapshot。");
  return h("div", { className: "table-wrap" }, h("table", { className: "dealer-order-table" },
    h("thead", null, h("tr", null, ["组件", "SKU", "墙", "跨", "原始跨宽", "切割宽度", "深度", "高度/长度", "数量", "单位", "备注"].map((label) => h("th", { key: label }, label)))),
    h("tbody", null, rows.map((row, index) => h("tr", { key: index },
      h("td", null, row.component || row.componentType || "—"),
      h("td", null, row.sku || "—"),
      h("td", null, row.wallId || row.wall || "—"),
      h("td", null, row.bayIndex == null ? "—" : Number(row.bayIndex) + 1),
      h("td", null, formatMm(row.originalBayWidth || row.bayWidth)),
      h("td", null, formatMm(row.cuttingWidth || row.cutLength)),
      h("td", null, formatMm(row.depth)),
      h("td", null, formatMm(row.height || row.length)),
      h("td", null, row.quantity || 1),
      h("td", null, row.unit || "件"),
      h("td", null, row.note || row.cuttingNote || "")
    )))
  ));
}

async function loadOrder(orderId) {
  const response = await fetch(`/api/admin/dealer-orders/${encodeURIComponent(orderId)}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "load_failed");
  return payload;
}

function buildConfigFromOrder(designConfig = {}) {
  const initial = createInitialConfig();
  return {
    ...initial,
    ...designConfig,
    room: { ...initial.room, ...(designConfig.room || {}) },
    layout: designConfig.layout || initial.layout,
    walls: designConfig.walls || initial.walls,
    placements: Array.isArray(designConfig.placements) ? designConfig.placements : []
  };
}

function getPickingProgress(rows, picking) {
  const total = rows.length;
  return rows.reduce((progress, item, index) => {
    const state = picking.rows?.[getBomItemKey(item, index)] || {};
    return {
      total,
      picked: progress.picked + (state.pickedAt ? 1 : 0),
      verified: progress.verified + (state.verifiedAt ? 1 : 0),
      packed: progress.packed + (state.packedAt ? 1 : 0)
    };
  }, { total, picked: 0, verified: 0, packed: 0 });
}

function getBomItemKey(item, index) {
  return `${item.sku || "sku"}:${item.spec || item.specification || ""}:${item.note || ""}:${index}`;
}

function groupRows(rows, getGroup) {
  return rows.reduce((groups, row) => {
    const group = getGroup(row);
    groups[group] = groups[group] || [];
    groups[group].push(row);
    return groups;
  }, {});
}

function exportProductionPackage(detail, bomRows, cuttingRows) {
  downloadText(`${detail.order.id}-design.json`, JSON.stringify(detail, null, 2), "application/json");
  downloadText(`${detail.order.id}-bom.csv`, toCsv(bomRows), "text/csv;charset=utf-8");
  downloadText(`${detail.order.id}-cutting-list.csv`, toCsv(cuttingRows), "text/csv;charset=utf-8");
  window.print();
}

function resolveOrderImage(seriesId, image) {
  if (!image || /^(data:|https?:\/\/|\/)/i.test(image)) return image || "";
  if (image.startsWith("products/")) return `/${image}`;
  return `/products/${seriesId}/images/${image.replace(/^images\//, "")}`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const keys = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  return [keys, ...rows.map((row) => keys.map((key) => row?.[key] ?? ""))]
    .map((values) => values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getOrderIdFromUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("id")) return url.searchParams.get("id");
  const match = url.pathname.match(/\/admin\/dealer-orders\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function formatMm(value) {
  return value == null || value === "" ? "—" : `${Math.round(Number(value))}mm`;
}

createRoot(document.getElementById("root")).render(h(DealerOrderDetailPage));
