import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  calculateDesign,
  createConfigFromPlannerPreset,
  createInitialConfig,
  formatCurrency,
  getComponentIcon,
  getComponentName,
  getDefaultHeight,
  labelWall,
  normalizeFixedModuleWidth
} from "../configurator.js?v=planner-inline-edit-full-20260706-01";
import { loadWorkbookData } from "../dataSource.js?v=ai-planner-preview-20260617-06";
import { getSeries, resolveSeriesAsset } from "../config/productSeries.js?v=ai-planner-preview-20260617-06";
import { WardrobeScene } from "../scene.js?v=global-side-wall-soften-20260718-01";
import { buildPlannerVisualAssets } from "./ReadOnlyWardrobePreview.js?v=global-side-wall-soften-20260718-01";
import { loadStorageRules } from "../rules/storageRules.js?v=storage-rules-20260625-01";
import { getCuttingRules } from "../series/index.js?v=japanese-drawer-merchandising-20260703-01";
import { calculatePlannerCustomerPrice } from "./customerPricing.js?v=ai-planner-customer-pricing-20260706-01";

const h = React.createElement;
const dataCache = new Map();
const inlineEditorStorageKey = "purenestAiPlannerInlineEdits";
const visualOnlyComponentTypes = new Set([
  "clothes",
  "shortHang",
  "longHang",
  "shoe",
  "shoes",
  "bag",
  "luggage",
  "bedding",
  "decor",
  "decorativeProp"
]);

export async function mountPlannerInlineEditor(container, {
  plan,
  selectedProductSystem,
  onBack,
  onSave,
  onComplete
}) {
  if (!container) return () => {};
  const seriesId = plan?.configPreset?.productSystemId || selectedProductSystem?.id || "japanese-closet";
  const series = getSeries(seriesId);
  if (!series) throw new Error(`Unknown product series: ${seriesId}`);
  const data = await getEditorData(series);
  const root = createRoot(container);
  root.render(h(PlannerInlineEditor, {
    plan,
    data,
    onBack,
    onSave,
    onComplete
  }));
  return () => root.unmount();
}

function PlannerInlineEditor({ plan, data, onBack, onSave, onComplete }) {
  const initialConfig = useMemo(() => createEditorConfig(plan, data), [plan, data]);
  const [config, setConfig] = useState(initialConfig);
  const [savedAt, setSavedAt] = useState("");
  const [showVisualItems, setShowVisualItems] = useState(false);
  const [visualRulesReady, setVisualRulesReady] = useState(false);
  const design = useMemo(() => calculateDesign(config, data), [config, data]);
  const priceTotal = useMemo(
    () => calculatePlannerCustomerPrice(config),
    [config]
  );
  const selectedPlacement = config.placements.find((placement) => placement.id === config.selectedPlacementId)
    || config.placements[0]
    || null;
  const cuttingRules = getCuttingRules(data.series.seriesId, data);
  const drawerSingleProducts = useMemo(() => getDrawerSingleProducts(data), [data]);
  const libraryEntries = useMemo(() => getInlineLibraryEntries({ data, design, cuttingRules }), [data, design, cuttingRules]);
  const visualAssets = useMemo(() => {
    if (!showVisualItems || !visualRulesReady) return { visualAssets: [], debug: null };
    return buildPlannerVisualAssets(
      config,
      buildInlineVisualConfigPreset(design),
      { planType: plan?.planType || "premium" },
      design
    );
  }, [config, design, plan?.planType, showVisualItems]);
  const sceneConfig = useMemo(() => ({
    ...config,
    visualAssets: showVisualItems ? visualAssets.visualAssets : [],
    visualAssetDebug: showVisualItems ? visualAssets.debug : null
  }), [config, showVisualItems, visualAssets]);
  const sceneRenderKey = useMemo(() => getInlineSceneRenderKey(config), [config]);
  const selectedDesignPlacement = selectedPlacement
    ? design.placements.find((placement) => placement.id === selectedPlacement.id) || selectedPlacement
    : null;

  useEffect(() => {
    let cancelled = false;
    loadStorageRules()
      .then(() => {
        if (!cancelled) setVisualRulesReady(true);
      })
      .catch((error) => {
        console.warn("[ai-planner inline editor] visual rules unavailable", error);
        if (!cancelled) setVisualRulesReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addPlacement = (wallId, bayIndex, componentType, options = {}) => {
    const placement = createInlinePlacement({
      componentType,
      wallId,
      bayIndex,
      options,
      config,
      design,
      cuttingRules,
      drawerSingleProducts
    });
    setConfig((current) => ({
      ...current,
      selectedPlacementId: placement.id,
      placements: [...current.placements, placement]
    }));
  };
  const updatePlacement = (id, patch) => {
    setConfig((current) => ({
      ...current,
      placements: current.placements.map((placement) => placement.id === id
        ? { ...placement, ...patch }
        : placement)
    }));
  };
  const removePlacement = (id) => {
    setConfig((current) => ({
      ...current,
      selectedPlacementId: current.selectedPlacementId === id ? "" : current.selectedPlacementId,
      placements: current.placements.filter((placement) => placement.id !== id)
    }));
  };
  const saveCurrentPlan = () => {
    const editedPlan = buildEditedPlan(plan, config, priceTotal);
    writeInlineEditedPlan(editedPlan);
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    onSave?.(editedPlan);
    return editedPlan;
  };

  return h("section", { className: "planner-inline-editor" },
    h("header", { className: "planner-inline-editor-header" },
      h("div", null,
        h("small", null, "INLINE EDIT"),
        h("h2", null, `${getPlanName(plan)} · 继续调整`),
        h("p", null, "仅编辑真实产品组件；衣物、鞋包和装饰物不会转换为可编辑组件。")
      ),
      h("div", { className: "planner-inline-price" },
        h("span", null, "当前价格"),
        h("strong", null, formatCurrency(priceTotal))
      ),
      h("div", { className: "planner-inline-editor-actions" },
        h("button", { type: "button", className: "analysis-back", onClick: onBack }, "返回方案"),
        h("button", { type: "button", className: "analysis-back", onClick: () => setConfig(createEditorConfig(plan, data, { useSaved: false })) }, "重置为AI方案"),
        h("button", { type: "button", className: "analysis-back", onClick: saveCurrentPlan }, "保存方案"),
        h("button", {
          type: "button",
          className: "dimension-next",
          onClick: () => onComplete?.(saveCurrentPlan())
        }, "完成调整")
      )
    ),
    h("div", { className: "planner-inline-editor-body" },
      h("aside", { className: "planner-inline-add-panel" },
        h("div", { className: "planner-inline-toggle-row" },
          h("strong", null, "添加组件"),
          h("label", null,
            h("input", {
              type: "checkbox",
              checked: showVisualItems,
              onChange: (event) => setShowVisualItems(event.target.checked)
            }),
            h("span", null, "显示物品")
          )
        ),
        h("div", { className: "planner-inline-library" },
          libraryEntries.map((entry) => h(InlineLibraryTile, {
            key: entry.key,
            entry,
            design,
            series: data.series,
            cuttingRules,
            onAdd: () => {
              const wall = design.activeWalls[0];
              if (!wall) return;
              addPlacement(wall.id, 0, entry.componentType, entry.productSku ? { productSku: entry.productSku } : {});
            }
          }))
        )
      ),
      h("div", { className: "planner-inline-editor-scene" },
        h(WardrobeScene, {
          key: sceneRenderKey,
          config: sceneConfig,
          design,
          series: data.series,
          selectedId: config.selectedPlacementId,
          onDropComponent: addPlacement,
          onSelectPlacement: (id) => setConfig((current) => ({ ...current, selectedPlacementId: id })),
          previewMode: "planner-inline-edit"
        })
      ),
      h("aside", { className: "planner-inline-editor-controls" },
        h("strong", null, "选中组件"),
        selectedDesignPlacement
          ? h(InlinePlacementControls, {
            placement: selectedDesignPlacement,
            design,
            cuttingRules,
            libraryEntries,
            drawerSingleProducts,
            onUpdate: (patch) => updatePlacement(selectedPlacement.id, patch),
            onReplace: (entry) => updatePlacement(selectedPlacement.id, createReplacementPatch({
              placement: selectedPlacement,
              entry,
              design,
              cuttingRules,
              drawerSingleProducts
            })),
            onDelete: () => removePlacement(selectedPlacement.id)
          })
          : h("p", null, "当前方案没有可编辑组件"),
        savedAt ? h("small", { className: "planner-inline-save-status" }, `已保存 ${savedAt}`) : null
      )
    )
  );
}

function InlineLibraryTile({ entry, design, series, cuttingRules, onAdd }) {
  const product = entry.product;
  const icon = entry.productSku || entry.componentType === "drawerDouble"
    ? product?.image || getComponentIcon(product, entry.componentType, cuttingRules)
    : getComponentIcon(product, entry.componentType, cuttingRules);
  const label = getLibraryEntryLabel(entry, design, cuttingRules);
  return h("button", {
    type: "button",
    className: "planner-inline-library-tile",
    draggable: true,
    onClick: onAdd,
    onDragStart: (event) => {
      event.dataTransfer.setData("text/plain", entry.componentType);
      event.dataTransfer.setData("application/json", JSON.stringify({
        componentType: entry.componentType,
        productSku: entry.productSku || ""
      }));
      if (entry.productSku) event.dataTransfer.setData("application/x-product-sku", entry.productSku);
    }
  },
    icon ? h("img", { src: resolveSeriesAsset(series, icon), alt: "" }) : h("i", null),
    h("span", null, label)
  );
}

function InlinePlacementControls({
  placement,
  design,
  cuttingRules,
  libraryEntries,
  drawerSingleProducts,
  onUpdate,
  onReplace,
  onDelete
}) {
  const wall = design.activeWalls.find((item) => item.id === placement.wallId);
  const maxBayIndex = Math.max(0, Number(wall?.bayCount || 1) - 1);
  const minHeight = 0;
  const maxHeight = Number(design.room.height) || 2700;
  const heightValue = Number(placement.heightFromFloor) || 0;
  const replaceValue = getLibraryEntryKeyForPlacement(placement, libraryEntries);
  const shelfOptions = getShelfTypeEntries(libraryEntries);
  return h("div", { className: "planner-inline-placement-controls" },
    h("span", null, `${getPlacementLabel(placement, cuttingRules)} / 第 ${Number(placement.bayIndex) + 1} 跨`),
    h("label", null,
      h("small", null, "替换组件"),
      h("select", {
        value: replaceValue,
        onChange: (event) => {
          const entry = libraryEntries.find((item) => item.key === event.target.value);
          if (entry) onReplace(entry);
        }
      },
        libraryEntries.map((entry) => h("option", {
          key: entry.key,
          value: entry.key
        }, getLibraryEntryLabel(entry, design, cuttingRules)))
      )
    ),
    isShelfPlacement(placement) && h("label", null,
      h("small", null, "层板类型"),
      h("select", {
        value: placement.componentType,
        onChange: (event) => {
          const entry = shelfOptions.find((item) => item.componentType === event.target.value);
          if (entry) onReplace(entry);
        }
      },
        shelfOptions.map((entry) => h("option", {
          key: entry.key,
          value: entry.componentType
        }, getLibraryEntryLabel(entry, design, cuttingRules)))
      )
    ),
    placement.componentType === "drawerSingle" && h("label", null,
      h("small", null, "抽屉内件"),
      h("select", {
        value: placement.productSku || drawerSingleProducts[0]?.sku || "",
        onChange: (event) => onUpdate({ productSku: event.target.value })
      },
        drawerSingleProducts.map((drawer) => h("option", {
          key: drawer.sku,
          value: drawer.sku
        }, getDrawerInsertLabel(drawer)))
      )
    ),
    placement.componentType === "drawerDouble" && h("label", null,
      h("small", null, "上层抽屉内件"),
      h("select", {
        value: placement.topDrawerSku || drawerSingleProducts[0]?.sku || "",
        onChange: (event) => onUpdate({
          productSku: "JP-drawerDouble",
          topDrawerSku: event.target.value
        })
      },
        drawerSingleProducts.map((drawer) => h("option", {
          key: drawer.sku,
          value: drawer.sku
        }, getDrawerInsertLabel(drawer)))
      )
    ),
    placement.componentType === "drawerDouble" && h("label", null,
      h("small", null, "下层抽屉内件"),
      h("select", {
        value: placement.bottomDrawerSku || drawerSingleProducts[1]?.sku || drawerSingleProducts[0]?.sku || "",
        onChange: (event) => onUpdate({
          productSku: "JP-drawerDouble",
          bottomDrawerSku: event.target.value
        })
      },
        drawerSingleProducts.map((drawer) => h("option", {
          key: drawer.sku,
          value: drawer.sku
        }, getDrawerInsertLabel(drawer)))
      )
    ),
    h("label", null,
      h("small", null, "高度"),
      h("input", {
        type: "range",
        min: minHeight,
        max: maxHeight,
        step: 10,
        value: heightValue,
        onChange: (event) => onUpdate({ heightFromFloor: clampEditorNumber(event.target.value, minHeight, maxHeight) })
      }),
      h("input", {
        type: "number",
        min: minHeight,
        max: maxHeight,
        step: 10,
        value: heightValue,
        onChange: (event) => onUpdate({ heightFromFloor: clampEditorNumber(event.target.value, minHeight, maxHeight) })
      })
    ),
    h("div", { className: "planner-inline-placement-actions" },
      h("button", {
        type: "button",
        disabled: Number(placement.bayIndex) <= 0,
        onClick: () => onUpdate({ bayIndex: Number(placement.bayIndex) - 1 })
      }, "上一跨"),
      h("button", {
        type: "button",
        disabled: Number(placement.bayIndex) >= maxBayIndex,
        onClick: () => onUpdate({ bayIndex: Number(placement.bayIndex) + 1 })
      }, "下一跨"),
      h("button", { type: "button", onClick: onDelete }, "删除")
    )
  );
}

function getInlineLibraryEntries({ data, design, cuttingRules }) {
  const baseEntries = (cuttingRules.componentTypes || [])
    .filter((type) => !design.productByType[type]?.autoGenerated)
    .map((type) => ({
      key: type,
      componentType: type,
      product: design.productByType[type]
    }));
  const drawerSingles = getDrawerSingleProducts(data).map((product) => ({
    key: `sku:${product.sku}`,
    componentType: "drawerSingle",
    productSku: product.sku,
    product
  }));
  const drawerDoubleProduct = (data.products || []).find((product) => product.type === "drawerDouble");
  const drawerDouble = drawerSingles.length
    ? [{
      key: "drawerDouble:client",
      componentType: "drawerDouble",
      product: drawerDoubleProduct || drawerSingles[0].product
    }]
    : [];
  return [...baseEntries, ...drawerSingles, ...drawerDouble].filter((entry, index, list) => (
    list.findIndex((item) => item.key === entry.key) === index
  ));
}

function getDrawerSingleProducts(data) {
  return (data.products || [])
    .filter((product) => product.type === "drawerSingle")
    .sort((a, b) => {
      const sortDelta = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
      return sortDelta || String(a.sku || "").localeCompare(String(b.sku || ""));
    });
}

function createInlinePlacement({
  componentType,
  wallId,
  bayIndex,
  options = {},
  config,
  design,
  cuttingRules,
  drawerSingleProducts
}) {
  const wall = design.activeWalls.find((item) => item.id === wallId);
  const currentBayWidth = wall?.bays?.[bayIndex]?.postCenterDistance || wall?.bayWidth || 0;
  const moduleWidth = cuttingRules.fixedModuleTypes.includes(componentType)
    ? normalizeFixedModuleWidth(currentBayWidth, cuttingRules)
    : null;
  const defaultTopDrawerSku = drawerSingleProducts[0]?.sku || "";
  const defaultBottomDrawerSku = drawerSingleProducts[1]?.sku || defaultTopDrawerSku;
  return {
    id: `planner-inline:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    wallId,
    bayIndex: Number(bayIndex) || 0,
    componentType,
    ...(moduleWidth ? { moduleWidth, standardWidth: moduleWidth } : {}),
    heightFromFloor: getDefaultHeight(componentType, design.room.height, cuttingRules),
    color: pickInlineColor(componentType, config),
    ...(options.productSku ? { productSku: options.productSku } : {}),
    ...(componentType === "drawerSingle" && !options.productSku && defaultTopDrawerSku
      ? { productSku: defaultTopDrawerSku }
      : {}),
    ...(componentType === "drawerDouble" ? {
      productSku: "JP-drawerDouble",
      topDrawerSku: options.topDrawerSku || defaultTopDrawerSku,
      bottomDrawerSku: options.bottomDrawerSku || defaultBottomDrawerSku
    } : {}),
    quantity: 1
  };
}

function createReplacementPatch({ placement, entry, design, cuttingRules, drawerSingleProducts }) {
  const componentType = entry.componentType;
  const wall = design.activeWalls.find((item) => item.id === placement.wallId);
  const currentBayWidth = wall?.bays?.[placement.bayIndex]?.postCenterDistance || wall?.bayWidth || 0;
  const moduleWidth = cuttingRules.fixedModuleTypes.includes(componentType)
    ? normalizeFixedModuleWidth(currentBayWidth, cuttingRules)
    : null;
  const defaultTopDrawerSku = drawerSingleProducts[0]?.sku || "";
  const defaultBottomDrawerSku = drawerSingleProducts[1]?.sku || defaultTopDrawerSku;
  const patch = {
    componentType,
    heightFromFloor: Math.min(Number(placement.heightFromFloor) || 0, Number(design.room.height) || 2700),
    productSku: undefined,
    topDrawerSku: undefined,
    bottomDrawerSku: undefined,
    moduleWidth: undefined,
    standardWidth: undefined
  };
  if (moduleWidth) {
    patch.moduleWidth = moduleWidth;
    patch.standardWidth = moduleWidth;
  }
  if (entry.productSku) patch.productSku = entry.productSku;
  if (componentType === "drawerSingle" && !patch.productSku) patch.productSku = defaultTopDrawerSku;
  if (componentType === "drawerDouble") {
    patch.productSku = "JP-drawerDouble";
    patch.topDrawerSku = placement.componentType === "drawerDouble"
      ? placement.topDrawerSku || defaultTopDrawerSku
      : defaultTopDrawerSku;
    patch.bottomDrawerSku = placement.componentType === "drawerDouble"
      ? placement.bottomDrawerSku || defaultBottomDrawerSku
      : defaultBottomDrawerSku;
  }
  return patch;
}

function getLibraryEntryLabel(entry, design, cuttingRules) {
  if (entry.componentType === "drawerSingle") {
    return entry.productSku ? `单抽 - ${getDrawerInsertLabel(entry.product)}` : "单抽";
  }
  if (entry.componentType === "drawerDouble") return "双抽";
  return getComponentName(entry.componentType, design.productByType, cuttingRules);
}

function getDrawerInsertLabel(drawer = {}) {
  return drawer.nameCn || drawer.nameEn || drawer.sku || "抽屉内件";
}

function getLibraryEntryKeyForPlacement(placement, libraryEntries) {
  if (placement.componentType === "drawerSingle" && placement.productSku) {
    return libraryEntries.some((entry) => entry.key === `sku:${placement.productSku}`)
      ? `sku:${placement.productSku}`
      : "drawerSingle";
  }
  if (placement.componentType === "drawerDouble") return "drawerDouble:client";
  return libraryEntries.some((entry) => entry.key === placement.componentType)
    ? placement.componentType
    : libraryEntries[0]?.key || "";
}

function getShelfTypeEntries(libraryEntries) {
  const shelfTypes = new Set(["woodShelf", "glassShelf", "displayShelf", "shoeShelf", "shoesShelf"]);
  return libraryEntries.filter((entry) => shelfTypes.has(entry.componentType));
}

function isShelfPlacement(placement) {
  return ["woodShelf", "glassShelf", "displayShelf", "shoeShelf", "shoesShelf"].includes(placement.componentType);
}

function buildInlineVisualConfigPreset(design) {
  const placements = Array.isArray(design?.placements) ? design.placements : [];
  const rails = placements.filter((placement) => ["singleRail", "doubleRail"].includes(placement.componentType));
  const shortRailCount = rails.filter((placement) => (
    placement.zoneType === "shortHangZone" || Number(placement.heightFromFloor) < 1450
  )).length;
  const longRailCount = Math.max(0, rails.length - shortRailCount);
  const shoeShelfCount = placements.filter((placement) => (
    placement.zoneType === "shoeZone" || ["shoeShelf", "shoesShelf"].includes(placement.componentType)
  )).length;
  const bagSurfaceCount = placements.filter((placement) => (
    ["woodShelf", "glassShelf", "displayShelf", "cabinet"].includes(placement.componentType)
    && placement.zoneType !== "shoeZone"
  )).length;
  return {
    planType: "premium",
    demandQuantityProfile: {
      短衣: { quantity: shortRailCount * 20 },
      长衣: { quantity: longRailCount * 20 },
      鞋子: { quantity: shoeShelfCount * 15 },
      包包: { quantity: bagSurfaceCount * 5 },
      行李箱: { quantity: 1 },
      被褥: { quantity: 0 }
    }
  };
}

function pickInlineColor(componentType, config) {
  if (["woodShelf", "cabinet", "drawerSingle", "drawerDouble"].includes(componentType)) return config.panelColor || "Wood Brown";
  return config.frameColor || "Default Material";
}

function createEditorConfig(plan, data, { useSaved = true } = {}) {
  const savedPlan = useSaved ? readInlineEditedPlan(plan) : null;
  const preset = {
    source: "ai-planner-inline-editor",
    configPreset: {
      ...(savedPlan?.configPreset || plan?.configPreset || {}),
      productSystemId: data.series.seriesId
    }
  };
  const config = createConfigFromPlannerPreset(preset, createInitialConfig(), data);
  return {
    ...config,
    placements: (config.placements || []).filter(isRealEditablePlacement),
    selectedPlacementId: config.placements.find(isRealEditablePlacement)?.id || ""
  };
}

function buildEditedPlan(plan, config, priceTotal) {
  const explicitPlacements = (config.placements || [])
    .filter(isRealEditablePlacement)
    .map(toPlannerExplicitPlacement);
  return {
    ...plan,
    planPrice: Number(priceTotal) || plan?.planPrice || null,
    inlineEdited: true,
    inlineEditedAt: new Date().toISOString(),
    configPreset: {
      ...(plan?.configPreset || {}),
      roomWidth: Number(config.room?.width) || plan?.configPreset?.roomWidth,
      roomDepth: Number(config.room?.depth) || plan?.configPreset?.roomDepth,
      roomHeight: Number(config.room?.height) || plan?.configPreset?.roomHeight,
      layoutType: reversePlannerLayout(config.layout),
      explicitPlacements,
      placements: explicitPlacements
    }
  };
}

function toPlannerExplicitPlacement(placement) {
  return {
    wallId: placement.wallId || "back",
    bayIndex: Number(placement.bayIndex) || 0,
    componentType: placement.componentType,
    heightFromFloor: Number(placement.heightFromFloor) || 0,
    quantity: Number(placement.quantity) || 1,
    zoneType: placement.zoneType || "",
    ...(placement.productSku || placement.componentType === "drawerDouble"
      ? { productSku: placement.productSku || "JP-drawerDouble" }
      : {}),
    ...(placement.topDrawerSku ? { topDrawerSku: placement.topDrawerSku } : {}),
    ...(placement.bottomDrawerSku ? { bottomDrawerSku: placement.bottomDrawerSku } : {}),
    ...(placement.source ? { source: placement.source } : {})
  };
}

function isRealEditablePlacement(placement) {
  const componentType = placement?.componentType || "";
  return Boolean(componentType) && !visualOnlyComponentTypes.has(componentType);
}

function writeInlineEditedPlan(plan) {
  try {
    const stored = JSON.parse(localStorage.getItem(inlineEditorStorageKey) || "{}");
    stored[getInlinePlanKey(plan)] = {
      planType: plan.planType,
      candidatePlanId: plan.candidatePlanId || plan.planId || "",
      configPreset: plan.configPreset,
      savedAt: plan.inlineEditedAt
    };
    localStorage.setItem(inlineEditorStorageKey, JSON.stringify(stored));
  } catch (error) {
    console.warn("[ai-planner inline editor] save failed", error);
  }
}

function readInlineEditedPlan(plan) {
  try {
    const stored = JSON.parse(localStorage.getItem(inlineEditorStorageKey) || "{}");
    return stored[getInlinePlanKey(plan)] || null;
  } catch (error) {
    console.warn("[ai-planner inline editor] saved plan read failed", error);
    return null;
  }
}

function getInlinePlanKey(plan = {}) {
  return plan.candidatePlanId || plan.planId || plan.id || plan.planType || "plan";
}

function getEditorData(series) {
  if (!dataCache.has(series.seriesId)) {
    dataCache.set(series.seriesId, loadWorkbookData(series));
  }
  return dataCache.get(series.seriesId);
}

function getPlanName(plan = {}) {
  const names = {
    basic: "基础实用款",
    value: "高性价比款",
    premium: "高配理想款"
  };
  return names[plan.planType] || plan.planName || plan.name || "方案";
}

function getPlacementLabel(placement, cuttingRules) {
  if (placement.componentType === "drawerSingle") return "单抽";
  if (placement.componentType === "drawerDouble") return "双抽";
  return cuttingRules.componentFallbackNames?.[placement.componentType] || placement.componentType;
}

function getInlineSceneRenderKey(config = {}) {
  const drawerDoubleKeys = (config.placements || [])
    .filter((placement) => placement.componentType === "drawerDouble")
    .map((placement) => [
      placement.id,
      placement.productSku || "JP-drawerDouble",
      placement.topDrawerSku || "",
      placement.bottomDrawerSku || ""
    ].join(":"));
  return drawerDoubleKeys.length ? `drawerDouble:${drawerDoubleKeys.join("|")}` : "drawerDouble:none";
}

function reversePlannerLayout(layout) {
  if (layout === "U") return "U型";
  if (layout === "L-left" || layout === "L-right") return "L型";
  return "I型";
}

function clampEditorNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
