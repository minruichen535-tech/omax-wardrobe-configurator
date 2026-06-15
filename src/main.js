import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ExcelJS from "https://esm.sh/exceljs@4.4.0?bundle";
import {
  ClipboardList,
  Download,
  Home,
  Image as ImageIcon,
  Layers3,
  MapPinned,
  PackageSearch,
  RefreshCcw,
  Ruler,
  Search,
  Shirt,
  Trash2,
  Upload,
  WalletCards
} from "lucide-react";
import {
  applyLayout,
  calculateDesign,
  createInitialConfig,
  formatCurrency,
  getComponentIcon,
  getComponentName,
  getDefaultHeight,
  labelWall,
  normalizeFixedModuleWidth,
  recommendBayCount,
  syncWallLengthsWithRoom
} from "./configurator.js?v=wall-mounted-side-first-back-clearance-20260615-01";
import {
  clearWorkbookOverride,
  exportProductsWorkbook,
  exportRulesWorkbook,
  loadWorkbookData,
  parseProductFile,
  parseRulesFile,
  saveWorkbookOverride
} from "./dataSource.js?v=wall-mounted-v2-20260613-01";
import { applyTheme, swatchColors } from "./config/theme.js?v=color-system-20260602-01";
import { productSeries, resolveRoute, resolveSeriesAsset } from "./config/productSeries.js?v=wall-mounted-storage-library-types-20260615-01";
import { dashboardProducts } from "./dashboard/config/dashboardProducts.js?v=dashboard-products-20260615-01";
import { WardrobeScene } from "./scene.js?v=wall-mounted-glass-led-direction-20260615-01";
import { getCuttingRules, getDisplayRules } from "./series/index.js?v=wall-mounted-system-layout-rules-20260615-03";

const h = React.createElement;
const frameColorOptions = ["Silver Grey", "Black"];
const woodColor = "Wood Brown";
const defaultProductColor = "Default Material";
const employeeBrandFallback = {
  brandNameCn: "奥美斯五金",
  brandNameEn: "OMAX Hardware",
  seriesName: "日式衣帽间",
  phone: "+86 18818717590"
};
applyTheme();

function parseBooleanSetting(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeAluminumConnectionMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "wall" || normalized === "wall-mounted") return "wall-mounted";
  if (normalized === "ceiling" || normalized === "celling" || normalized === "ceiling-mounted") {
    return "ceiling-mounted";
  }
  return "wall-mounted";
}

function App() {
  const isProductsRoute = location.pathname === "/" || /^\/products\/?$/.test(location.pathname);
  const routeInfo = useMemo(() => resolveRoute(), []);
  const isClientMode = location.pathname.startsWith("/client");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isProductsRoute) return;
    if (!routeInfo.series) {
      setError(`未登记的产品系列：${routeInfo.seriesId}`);
      return;
    }
    loadWorkbookData(routeInfo.series).then(setData).catch((err) => setError(err.message));
  }, [isProductsRoute, routeInfo.series, routeInfo.seriesId]);

  if (isProductsRoute) {
    return h(ProductCatalog);
  }

  if (error) {
    return h("main", { className: "loading-state" },
      h("h1", null, "数据读取失败"),
      h("p", null, error)
    );
  }

  if (!data) {
    return h("main", { className: "loading-state" },
      h("h1", null, "正在读取产品数据"),
      h("p", null, routeInfo.series ? `/${routeInfo.series.productPath}` : "")
    );
  }

  return routeInfo.route === "admin"
    ? h(AdminApp, { data, setData })
    : h(ClientApp, { data, isClientMode });
}

function ProductCatalog() {
  const products = dashboardProducts.filter((product) => productSeries[product.id]?.enabled === true);

  return h("main", { className: "product-catalog" },
    h("header", { className: "product-catalog-header" },
      h("div", { className: "product-catalog-mark" }, "OM"),
      h("div", null,
        h("h1", null, "OMAX Wardrobe Configurator"),
        h("p", null, "请选择产品系列")
      )
    ),
    h("section", { className: "product-card-grid", "aria-label": "产品系列" },
      products.map((product) =>
        h("a", { className: "product-card", href: product.href, key: product.id },
          h("div", { className: "product-card-content" },
            h("h2", null, product.title),
            h("h3", null, product.subtitle),
            h("p", null, product.description)
          ),
          h("img", { className: "product-card-image", src: product.image, alt: product.title })
        )
      )
    )
  );
}

function ClientApp({ data, isClientMode = false }) {
  const authStorageKey = isClientMode ? "omax-client-auth" : "omax-auth";
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(authStorageKey) === "true"
  );
  const [config, setConfig] = useState(createInitialConfig);
  const [quoteNote, setQuoteNote] = useState("");
  const [brandInfo, setBrandInfo] = useState(null);
  const [isExportingQuote, setIsExportingQuote] = useState(false);
  const cuttingRules = useMemo(
    () => getCuttingRules(data.series.seriesId, data) || getCuttingRules("japanese-closet"),
    [data]
  );
  const displayRules = useMemo(
    () => getDisplayRules(data.series.seriesId, data) || getDisplayRules("japanese-closet"),
    [data]
  );
  const design = useMemo(() => calculateDesign(config, data), [config, data]);
  const webQuotationTotal = useMemo(
    () => design.bom.reduce((sum, item) => sum + displayRules.getWebDisplayLineTotal(item), 0),
    [design.bom, displayRules]
  );
  const selectedPlacement = design.placements.find((placement) => placement.id === config.selectedPlacementId);
  const shelfDepthOptions = data.settings?.shelfDepthOptions || [300, 450, 500];
  const postHeightOptions = data.settings?.postHeightOptions || [2000, 2400];
  const connectionModeOptions = data.settings?.connectionModeOptions || [];
  const isAluminumPostWardrobe = data.series.seriesId === "aluminum-post-wardrobe";
  const supportsLed = data.series.supportsLed === true || isAluminumPostWardrobe;
  const usesProductPostHeight = data.series.usesProductPostHeight === true;
  const resolvedShelfDepth = data.series.resolveShelfDepth?.({
    products: data.products,
    settings: data.settings
  });
  const fixedFrameColor = data.series.fixedFrameColor || "";
  const fixedShelfDepth = Number(data.series.fixedShelfDepth);
  const supportsLibraryClick = data.series.supportsLibraryClick === true || isAluminumPostWardrobe;
  const hideShelfDepthControl = data.series.hideShelfDepthControl === true;
  const sceneBrandInfo = isAluminumPostWardrobe
    ? isClientMode
      ? null
      : brandInfo || employeeBrandFallback
    : brandInfo;
  const supportsULayoutModes = cuttingRules.supportsULayoutModes === true;
  const usesIconULayoutControl = cuttingRules.uLayoutModeControl === "icons";
  const supportsIndependentBayWidths = cuttingRules.supportsIndependentBayWidths === true;
  const japaneseULayoutMode = config.uLayoutMode === "side-first" ? "side-first" : "back-first";
  const cornerOffsetOptions = cuttingRules.cornerOffsetOptions || [300, 400, 500];
  const hideRoomHeightInput = data.settings?.hideRoomHeightInput === true;

  useEffect(() => {
    const fixedPostWallOffset = Number(data.settings?.fixedPostWallOffset)
      || Number(data.settings?.defaultWallOffset)
      || 250;
    const defaultShelfDepth = Number(data.settings?.defaultShelfDepth) || 450;
    setConfig((current) => ({
      ...current,
      wallOffset: isAluminumPostWardrobe ? 250 : fixedPostWallOffset,
      shelfDepth: Number.isFinite(fixedShelfDepth) && fixedShelfDepth > 0
        ? fixedShelfDepth
        : isAluminumPostWardrobe
        ? 500
        : Number(resolvedShelfDepth) || current.shelfDepth || defaultShelfDepth,
      connectionMode: isAluminumPostWardrobe
        ? normalizeAluminumConnectionMode(
          current.connectionMode
          || data.settings?.defaultConnectionMode
          || connectionModeOptions[0]
        )
        : current.connectionMode
          || data.settings?.defaultConnectionMode
          || connectionModeOptions[0]
          || "wall",
      ...(isAluminumPostWardrobe ? {
        frameColor: "Black",
        postStyle: current.postStyle || "round",
      } : {}),
      ...(supportsLed ? {
        led: typeof current.led === "boolean"
          ? current.led
          : parseBooleanSetting(data.settings?.defaultLed, false)
      } : {}),
      ...(fixedFrameColor ? {
        frameColor: fixedFrameColor,
        color: data.series.fixedConfigColor || fixedFrameColor.toLowerCase()
      } : {})
    }));
  }, [
    isAluminumPostWardrobe,
    supportsLed,
    resolvedShelfDepth,
    data.settings?.fixedPostWallOffset,
    data.settings?.defaultWallOffset,
    data.settings?.defaultShelfDepth,
    data.settings?.defaultConnectionMode,
    data.settings?.defaultLed,
    connectionModeOptions.join("|"),
    fixedFrameColor,
    fixedShelfDepth,
    data.series.fixedConfigColor
  ]);

  useEffect(() => {
    const roomHeightFixed = isAluminumPostWardrobe
      ? 3300
      : Number(data.settings?.roomHeightFixed) || 2700;
    const defaultPostHeight = isAluminumPostWardrobe
      ? 3000
      : Number(data.settings?.defaultPostHeight) || 2400;
    setConfig((current) => ({
      ...syncWallLengthsWithRoom(current, { height: roomHeightFixed }),
      postHeight: isAluminumPostWardrobe
        ? defaultPostHeight
        : current.postHeight || defaultPostHeight
    }));
  }, [isAluminumPostWardrobe, data.settings?.roomHeightFixed, data.settings?.defaultPostHeight]);

  useEffect(() => {
    const brandPaths = isClientMode
      ? [data.series.clientBrandPath]
      : [data.series.brandPath];
    loadBrandInfo(brandPaths)
      .then(setBrandInfo)
      .catch(() => setBrandInfo(null));
  }, [data.series.brandPath, data.series.clientBrandPath, isClientMode]);

  const updateConfig = (patch) => setConfig((current) => ({ ...current, ...patch }));
  const setRoom = (key, value) => {
    const nextValue = parseIntegerInput(value);
    if (nextValue == null) return;
    setConfig((current) => syncWallLengthsWithRoom(current, { [key]: clampValue(nextValue, 1, 99999) }));
  };
  const setLayout = (layout) => setConfig((current) => applyLayout(current, layout));
  const setUAsymmetricSideWalls = (enabled) => setConfig((current) => {
    const leftWallLength = Number(current.leftWallLength) > 0
      ? Number(current.leftWallLength)
      : current.room.depth;
    const rightWallLength = Number(current.rightWallLength) > 0
      ? Number(current.rightWallLength)
      : current.room.depth;
    return {
      ...current,
      uAsymmetricSideWalls: enabled,
      leftWallLength,
      rightWallLength,
      walls: {
        ...current.walls,
        left: {
          ...current.walls.left,
          length: enabled ? leftWallLength : current.room.depth
        },
        right: {
          ...current.walls.right,
          length: enabled ? rightWallLength : current.room.depth
        }
      }
    };
  });
  const setUSideWallLength = (wallId, value) => {
    const nextValue = parseIntegerInput(value);
    if (nextValue == null) return;
    const length = clampValue(nextValue, 1, 99999);
    const field = wallId === "left" ? "leftWallLength" : "rightWallLength";
    setConfig((current) => ({
      ...current,
      [field]: length,
      walls: {
        ...current.walls,
        [wallId]: {
          ...current.walls[wallId],
          length,
          bayCount: recommendBayCount(length, cuttingRules),
          bayWidths: []
        }
      }
    }));
  };
  const exportQuote = async () => {
    setIsExportingQuote(true);
    try {
      const exportHandler = isClientMode
        ? exportClientProductListExcel
        : exportQuotationExcel;
      await exportHandler({
        bom: design.bom,
        design,
        config,
        series: data.series
      });
    } catch (error) {
      console.error("Quotation export failed.", error);
      window.alert("报价单导出失败，请稍后重试。");
    } finally {
      setIsExportingQuote(false);
    }
  };
  const setWallBayCount = (wallId, bayCount) => setConfig((current) => ({
    ...current,
    walls: {
      ...current.walls,
      [wallId]: {
        ...current.walls[wallId],
        bayCount: Number(bayCount),
        bayWidths: []
      }
    }
  }));
  const setWallBayWidth = (wallId, bayIndex, value) => {
    const width = parseIntegerInput(value);
    if (width == null) return;
    const designWall = design.activeWalls.find((wall) => wall.id === wallId);
    setConfig((current) => {
      const currentWall = current.walls[wallId];
      const existingWidths = Array.isArray(currentWall.bayWidths)
        && currentWall.bayWidths.length === currentWall.bayCount
        ? [...currentWall.bayWidths]
        : designWall?.bays.map((bay) => Math.round(bay.width)) || [];
      existingWidths[bayIndex] = width;
      return {
        ...current,
        walls: {
          ...current.walls,
          [wallId]: { ...currentWall, bayWidths: existingWidths }
        }
      };
    });
  };

  const addPlacement = (wallId, bayIndex, componentType) => {
    const product = design.productByType[componentType];
    const color = pickColor(componentType, config);
    const wall = design.activeWalls.find((item) => item.id === wallId);
    const currentBayWidth = wall?.bays?.[bayIndex]?.postCenterDistance || wall?.bayWidth || 0;
    const moduleWidth = cuttingRules.fixedModuleTypes.includes(componentType)
      ? normalizeFixedModuleWidth(currentBayWidth, cuttingRules)
      : null;
    const placement = {
      id: `p${Date.now()}`,
      wallId,
      bayIndex: Number(bayIndex),
      componentType,
      ...(moduleWidth ? { moduleWidth, standardWidth: moduleWidth } : {}),
      heightFromFloor: getDefaultHeight(componentType, design.room.height, cuttingRules),
      color,
      quantity: 1
    };
    setConfig((current) => ({
      ...current,
      selectedPlacementId: placement.id,
      placements: [...current.placements, placement]
    }));
  };

  const updatePlacement = (id, patch) => setConfig((current) => ({
    ...current,
    placements: current.placements.map((placement) => placement.id === id ? { ...placement, ...patch } : placement)
  }));

  const removePlacement = (id) => setConfig((current) => ({
    ...current,
    selectedPlacementId: current.selectedPlacementId === id ? "" : current.selectedPlacementId,
    placements: current.placements.filter((placement) => placement.id !== id)
  }));

  if (!isAuthenticated) {
    return h(LoginScreen, {
      title: isClientMode ? "Client Access" : "OMAX Wardrobe Configurator",
      subtitle: isClientMode ? "Product Configuration List" : "Internal Access",
      logoSrc: isClientMode ? resolveRootAssetPath(data.series.clientLogoPath) : "",
      expectedPassword: isClientMode ? "PURENEST2026！" : "Omax2026!",
      onLogin: () => {
        localStorage.setItem(authStorageKey, "true");
        setIsAuthenticated(true);
      }
    });
  }

  const logout = () => {
    localStorage.removeItem(authStorageKey);
    setIsAuthenticated(false);
  };

  return h("main", { className: `app-shell${isClientMode ? " client-mode" : ""}` },
    h("section", { className: "workspace upgraded-workspace" },
      h("aside", { className: "control-rail", "aria-label": "配置选项" },
        h(Header, { active: "configurator", series: data.series, isClientMode, brandInfo }),
        h(StepBlock, { icon: Home, title: "房间尺寸设置" },
          h(NumberField, { label: "房间宽度", value: config.room.width, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("width", value) }),
          h(NumberField, { label: "房间深度", value: config.room.depth, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("depth", value) }),
          !isAluminumPostWardrobe && !hideRoomHeightInput && h(NumberField, { label: "房间高度", value: config.room.height, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("height", value) }),
          isAluminumPostWardrobe || usesProductPostHeight
            ? h("p", { className: "fixed-height-note" }, `立柱标准高度 ${design.postHeight}mm`)
            : postHeightOptions.length > 0 && h(Segmented, {
            label: "立柱高度",
            value: String(config.postHeight || data.settings?.defaultPostHeight || postHeightOptions[0]),
            options: postHeightOptions.map((height) => ({ value: String(height), label: `${height}mm` })),
            onChange: (postHeight) => updateConfig({ postHeight: Number(postHeight) })
            }),
          !isAluminumPostWardrobe && !hideShelfDepthControl && shelfDepthOptions.length > 0 && h(Segmented, {
            label: "层板深度",
            value: String(config.shelfDepth || data.settings?.defaultShelfDepth || shelfDepthOptions[0]),
            options: shelfDepthOptions.map((depth) => ({ value: String(depth), label: `${depth}mm` })),
            onChange: (shelfDepth) => updateConfig({ shelfDepth: Number(shelfDepth) })
          }),
          (isAluminumPostWardrobe || connectionModeOptions.length > 0) && h(Segmented, {
            label: "连接方式",
            value: isAluminumPostWardrobe
              ? normalizeAluminumConnectionMode(config.connectionMode)
              : config.connectionMode || data.settings?.defaultConnectionMode || connectionModeOptions[0],
            options: isAluminumPostWardrobe
              ? [
                { value: "wall-mounted", label: "墙装" },
                { value: "ceiling-mounted", label: "顶装" }
              ]
              : connectionModeOptions.map((mode) => ({
                value: mode,
                label: mode === "ceiling" ? "顶装" : "墙装"
              })),
            onChange: (connectionMode) => updateConfig({ connectionMode })
          }),
          isAluminumPostWardrobe && h(Segmented, {
            label: "立柱样式",
            value: config.postStyle || "round",
            options: [
              { value: "round", label: "圆立柱" },
              { value: "square", label: "方立柱" }
            ],
            onChange: (postStyle) => updateConfig({ postStyle })
          }),
          supportsLed && h(Segmented, {
            label: "Lighting",
            value: config.led === true ? "true" : "false",
            options: [
              { value: "false", label: "No LED" },
              { value: "true", label: "LED System" }
            ],
            onChange: (led) => updateConfig({ led: led === "true" })
          })
        ),
        h(StepBlock, { icon: MapPinned, title: "位置选择" },
          h(Segmented, {
            label: "布局",
            value: config.layout,
            options: [
              { value: "I", label: "I 型后墙" },
              { value: "L-left", label: "L 型左墙" },
              { value: "L-right", label: "L 型右墙" },
              { value: "U", label: "U 型" }
            ],
            onChange: setLayout
          }),
          config.layout === "U" && h("div", { className: "u-asymmetric-options" },
            h("label", { className: "check-field" },
              h("input", {
                type: "checkbox",
                checked: config.uAsymmetricSideWalls === true,
                onChange: (event) => setUAsymmetricSideWalls(event.target.checked)
              }),
              "左右墙独立尺寸"
            ),
            config.uAsymmetricSideWalls === true && h("div", { className: "u-side-length-fields" },
              h(NumberField, {
                label: "左墙长度",
                value: config.leftWallLength,
                suffix: "mm",
                min: 1,
                max: 99999,
                step: 1,
                onChange: (value) => setUSideWallLength("left", value)
              }),
              h(NumberField, {
                label: "右墙长度",
                value: config.rightWallLength,
                suffix: "mm",
                min: 1,
                max: 99999,
                step: 1,
                onChange: (value) => setUSideWallLength("right", value)
              })
            )
          ),
          supportsULayoutModes && config.layout === "U" && h("div", { className: "u-layout-options" },
            usesIconULayoutControl
              ? h(ULayoutModeSelector, {
                value: japaneseULayoutMode,
                onChange: (uLayoutMode) => updateConfig({ uLayoutMode })
              })
              : h(Segmented, {
                label: "U型排布方式",
                value: config.uLayoutMode || "bottom-first",
                options: [
                  { value: "bottom-first", label: "底墙优先" },
                  { value: "side-first", label: "侧墙优先" }
                ],
                onChange: (uLayoutMode) => updateConfig({ uLayoutMode })
              }),
            !usesIconULayoutControl && h("p", { className: "u-layout-description" },
              config.uLayoutMode === "side-first"
                ? "左墙 → 底墙 → 右墙，适合左右两侧作为主收纳区。"
                : "底墙 → 左墙 → 右墙，适合底墙作为主收纳或展示面。"
            ),
            !cuttingRules.preservesExistingUWallGeometry && h(Segmented, {
              label: "转角预留",
              value: String(config.cornerOffset || cornerOffsetOptions[0]),
              options: cornerOffsetOptions.map((offset) => ({
                value: String(offset),
                label: `${offset}mm`
              })),
              onChange: (cornerOffset) => updateConfig({ cornerOffset: Number(cornerOffset) })
            })
          )
        ),
        h(StepBlock, { icon: Ruler, title: "跨数选择" },
          design.activeWalls.map((wall) => h("div", { className: "wall-bay-config", key: wall.id },
            h("div", { className: "wall-control" },
              h("div", null,
                h("strong", null, config.layout === "U" && wall.id === "back" ? "底墙" : labelWall(wall.id)),
                h("span", null, `${Math.round(getWallDisplayLength(data.series, wall, design.room, config))}mm / 单跨 ${Math.round(wall.bayWidth)}mm`)
              ),
              h("input", {
                type: "number",
                min: 1,
                value: config.walls[wall.id].bayCount,
                onChange: (event) => setWallBayCount(wall.id, event.target.value)
              })
            ),
            supportsIndependentBayWidths && config.layout === "U" && h("div", { className: "bay-width-editor" },
              wall.bays.map((bay) => h("label", { key: bay.bayIndex },
                h("span", null, `第${bay.bayIndex + 1}跨`),
                h("input", {
                  type: "number",
                  min: cuttingRules.minBayWidthMm,
                  max: cuttingRules.maxBayWidthMm,
                  step: 1,
                  value: config.walls[wall.id].bayWidths?.[bay.bayIndex] ?? Math.round(bay.width),
                  onChange: (event) => setWallBayWidth(wall.id, bay.bayIndex, event.target.value)
                })
              ))
            )
          )),
          design.errors.map((message) => h("p", { className: "error-text", key: message }, message))
        ),
        h(StepBlock, { icon: Shirt, title: "组件库" },
          h(SwatchGroup, {
            label: "立柱颜色",
            value: fixedFrameColor || (isAluminumPostWardrobe ? "Black" : config.frameColor),
            options: fixedFrameColor || isAluminumPostWardrobe ? ["Black"] : frameColorOptions,
            onChange: (frameColor) => updateConfig({
              frameColor: fixedFrameColor || (isAluminumPostWardrobe ? "Black" : frameColor),
              ...(fixedFrameColor ? { color: data.series.fixedConfigColor || "black" } : {})
            })
          }),
          h("div", { className: "component-library" },
            cuttingRules.componentTypes.filter((type) => !design.productByType[type]?.autoGenerated).map((type) => {
              const product = design.productByType[type];
              const icon = getComponentIcon(product, type, cuttingRules);
              return h("div", {
                className: "component-tile",
                key: type,
                "data-component-type": type,
                draggable: true,
                role: supportsLibraryClick ? "button" : undefined,
                tabIndex: supportsLibraryClick ? 0 : undefined,
                title: supportsLibraryClick ? "点击或拖入场景添加" : undefined,
                onClick: supportsLibraryClick
                  ? () => {
                    const wall = design.activeWalls[0];
                    if (wall) addPlacement(wall.id, 0, type);
                  }
                  : undefined,
                onKeyDown: supportsLibraryClick
                  ? (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    const wall = design.activeWalls[0];
                    if (wall) addPlacement(wall.id, 0, type);
                  }
                  : undefined,
                onDragStart: (event) => event.dataTransfer.setData("text/plain", type)
              },
                h(ComponentIcon, {
                  series: data.series,
                  icon,
                  name: displayRules.getLibraryComponentName(
                    type,
                    design.productByType,
                    (componentType, productByType) => getComponentName(componentType, productByType, cuttingRules)
                  )
                }),
                h("span", null, displayRules.getLibraryComponentName(
                  type,
                  design.productByType,
                  (componentType, productByType) => getComponentName(componentType, productByType, cuttingRules)
                ))
              );
            })
          )
        ),
        selectedPlacement && h(PlacementEditor, {
          placement: selectedPlacement,
          design,
          updatePlacement,
          removePlacement,
          cuttingRules,
          series: data.series
        })
      ),
      h("section", { className: "viewer-pane" },
        h("div", { className: "viewer-topline" },
          h("div", null,
            h("p", { className: "eyebrow" }, isClientMode
              ? brandInfo?.brandNameEn || brandInfo?.brandNameCn || ""
              : "OMEIX HARDWARE"),
            h("h1", null, isClientMode
              ? brandInfo?.brandNameCn || brandInfo?.seriesName || ""
              : data.series.name)
          ),
          h("div", { className: "viewer-actions" },
            h("div", { className: "metrics" },
              h(Metric, { icon: Layers3, label: "墙面", value: `${design.activeWalls.length} 面` }),
              h(Metric, { icon: ClipboardList, label: isClientMode ? "产品 SKU" : "销售 SKU", value: `${design.bom.length} 项` }),
              !isClientMode && h(Metric, { icon: WalletCards, label: "预估价", value: formatCurrency(webQuotationTotal) })
            ),
            h("button", { className: "logout-button", type: "button", onClick: logout }, "退出登录")
          )
        ),
        h("div", { className: "scene-frame enhanced-scene" },
          sceneBrandInfo && h(BrandSceneCard, {
            brandInfo: sceneBrandInfo,
            isClientMode,
            series: data.series
          }),
          h(WardrobeScene, {
            key: `scene-side-post-depth-inset-20260603-01-${config.layout}`,
            config,
            design,
            series: data.series,
            selectedId: config.selectedPlacementId,
            onDropComponent: addPlacement,
            onSelectPlacement: (id) => updateConfig({ selectedPlacementId: id })
          }),
          null
        )
      ),
      h("aside", { className: "quote-pane" },
        h("div", { className: "quote-heading" },
          h(ClipboardList, { size: 20 }),
          h("h2", null, isClientMode ? "产品清单" : "配置与销售清单"),
          h("button", {
            className: "quote-export-button",
            type: "button",
            disabled: isExportingQuote,
            onClick: exportQuote
          }, h(Download, { size: 15 }), isExportingQuote ? "导出中..." : (isClientMode ? "导出产品清单" : "导出Excel"))
        ),
        design.warnings.map((message) => h("p", { className: "warning-text", key: message }, message)),
        h("div", { className: "placement-list quote-placement-list" },
          design.placements.length === 0 && h("p", { className: "empty-placement" }, "从左侧拖入组合件后，这里会显示配置明细。"),
          design.placements.map((placement) => h("div", {
            className: `placement-row ${placement.id === config.selectedPlacementId ? "selected" : ""}`,
            key: placement.id,
            onClick: () => updateConfig({ selectedPlacementId: placement.id })
          },
            h("span", null, `${labelWall(placement.wallId)} / 第 ${placement.bayIndex + 1} 跨 / ${getComponentName(placement.componentType, design.productByType, cuttingRules)} / 离地 ${placement.heightFromFloor}mm`),
            placement.autoGenerated && h("small", { className: "cut-length" }, "自动生成"),
            placement.cutLength && h("small", { className: "cut-length" }, `剪尺${placement.cutLength}mm`),
            cuttingRules.fixedModuleTypes.includes(placement.componentType) && h("small", { className: "cut-length" }, `${getComponentName(placement.componentType, design.productByType, cuttingRules)} ${placement.moduleWidth || placement.standardWidth}mm`),
            h("strong", null, `x${placement.quantity}`),
            !placement.autoGenerated && h("button", { type: "button", title: "删除", onClick: (event) => { event.stopPropagation(); removePlacement(placement.id); } }, h(Trash2, { size: 15 }))
          ))
        ),
        h(GroupedBomTable, { series: data.series, bom: design.bom, displayRules, hidePrices: isClientMode }),
        !isClientMode && h("div", { className: "total-row" }, h("span", null, "预计合计"), h("strong", null, formatCurrency(webQuotationTotal))),
        h("label", { className: "field quote-note-field" },
          h("span", null, "备注信息"),
          h("textarea", {
            value: quoteNote,
            rows: 4,
            placeholder: "请输入报价备注",
            onChange: (event) => setQuoteNote(event.target.value)
          })
        ),
        h("p", { className: "quote-note" }, isClientMode
          ? "产品尺寸与数量以最终确认方案为准。"
          : "以上价格为系统预估价格，最终报价需根据实际尺寸、颜色、包装方式、运输方式及订单数量确认。"),
        h("button", { className: "inquiry-button", type: "button" }, "提交询价")
      )
    )
  );
}

function LoginScreen({
  onLogin,
  title = "OMAX Wardrobe Configurator",
  subtitle = "Internal Access",
  logoSrc = "",
  expectedPassword = "Omax2026!"
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (username === "admin" && password === expectedPassword) {
      setError("");
      onLogin();
      return;
    }
    setError("账号或密码错误");
  };

  return h("main", { className: "login-screen" },
    h("form", { className: "login-panel", onSubmit: submit },
      logoSrc
        ? h("img", { className: "login-brand-logo", src: logoSrc, alt: "" })
        : h("div", { className: "login-brand-mark", "aria-hidden": "true" }, "OM"),
      h("h1", null, title),
      h("p", null, subtitle),
      h("label", { className: "login-field" },
        h("span", null, "Username"),
        h("input", {
          type: "text",
          value: username,
          autoComplete: "username",
          autoFocus: true,
          onChange: (event) => setUsername(event.target.value)
        })
      ),
      h("label", { className: "login-field" },
        h("span", null, "Password"),
        h("input", {
          type: "password",
          value: password,
          autoComplete: "current-password",
          onChange: (event) => setPassword(event.target.value)
        })
      ),
      error && h("p", { className: "login-error", role: "alert" }, error),
      h("button", { className: "login-button", type: "submit" }, "Login"),
      h("small", null, "Temporary frontend access control")
    )
  );
}

function BayCanvas({ series, design, selectedId, setSelected, addPlacement, cuttingRules }) {
  return h("div", { className: "bay-canvas" },
    design.activeWalls.map((wall) => h("div", { className: "wall-strip", key: wall.id },
      h("div", { className: "wall-strip-title" },
        h("strong", null, labelWall(wall.id)),
        h("span", null, `${wall.bayCount} 跨 / ${wall.postCount} 根立柱`)
      ),
      h("div", { className: "bay-grid", style: { gridTemplateColumns: `repeat(${wall.bayCount}, minmax(96px, 1fr))` } },
        Array.from({ length: wall.bayCount }, (_, bayIndex) => h("div", {
          className: "bay-cell",
          key: bayIndex,
          "data-wall-id": wall.id,
          "data-bay-index": String(bayIndex),
          onDragOver: (event) => event.preventDefault(),
          onDrop: (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData("text/plain");
            if (type) addPlacement(wall.id, bayIndex, type);
          }
        },
          h("span", { className: "bay-label" }, `第 ${bayIndex + 1} 跨`),
          design.placements
            .filter((placement) => placement.wallId === wall.id && placement.bayIndex === bayIndex)
            .map((placement) => {
              const product = design.productByType[placement.componentType];
              const icon = getComponentIcon(product, placement.componentType, cuttingRules);
              return h("button", {
                type: "button",
                className: `bay-chip ${placement.id === selectedId ? "active" : ""}`,
                key: placement.id,
                onClick: () => setSelected(placement.id)
              },
                h(ComponentIcon, { series, icon, name: getComponentName(placement.componentType, design.productByType, cuttingRules) }),
                h("span", null, `${getComponentName(placement.componentType, design.productByType, cuttingRules)} ${placement.heightFromFloor}mm`)
              );
            })
        ))
      )
    ))
  );
}

function DebugCoordinatePanel({ design }) {
  const rows = design.activeWalls.flatMap((wall) => {
    const axis = wall.id === "back" ? "X" : "Z";
    const posts = wall.posts.map((post) => ({
      type: `P${post.index}`,
      wallId: wall.id,
      axis,
      coord: Math.round(post.x),
      width: ""
    }));
    const bays = wall.bays.map((bay) => ({
      type: `B${bay.bayIndex}`,
      wallId: wall.id,
      axis,
      coord: Math.round(bay.centerX),
      width: `${Math.round(bay.width)}mm`
    }));
    return [...posts, ...bays];
  });

  return h("div", { className: "debug-panel" },
    h("div", { className: "debug-panel-title" },
      h("strong", null, "Debug coordinates"),
      h("span", null, "Back wall uses X axis; left/right walls are rotated and use Z axis visually.")
    ),
    h("div", { className: "debug-table" },
      h("div", { className: "debug-row debug-head" },
        h("span", null, "Item"),
        h("span", null, "Wall"),
        h("span", null, "Axis"),
        h("span", null, "Coord"),
        h("span", null, "Width")
      ),
      rows.map((row) => h("div", { className: "debug-row", key: `${row.wallId}-${row.type}` },
        h("span", null, row.type),
        h("span", null, labelWall(row.wallId)),
        h("span", null, row.axis),
        h("span", null, `${row.coord}mm`),
        h("span", null, row.width)
      ))
    )
  );
}

function PlacementEditor({ placement, design, updatePlacement, removePlacement, cuttingRules, series }) {
  const name = getComponentName(placement.componentType, design.productByType, cuttingRules);
  const product = design.productByType[placement.componentType];
  const heightLocked = placement.heightLocked || product?.heightLocked;
  return h("div", { className: "height-editor" },
    h("div", null,
      h("strong", null, name),
      h("span", null, `${labelWall(placement.wallId)} 第 ${placement.bayIndex + 1} 跨`)
    ),
    heightLocked
      ? h("strong", null, "高度随立柱高度自动生成")
      : h("label", { className: "range-field" },
      h("input", {
        type: "range",
        min: 0,
        max: design.room.height,
        step: 10,
        value: placement.heightFromFloor,
        onChange: (event) => updatePlacement(placement.id, { heightFromFloor: Number(event.target.value) })
      }),
      h("strong", null, `离地 ${placement.heightFromFloor} mm`)
    ),
    cuttingRules.fixedModuleTypes.includes(placement.componentType) && h("label", { className: "range-field" },
      h("span", null, "标准尺寸"),
      h("select", {
        value: placement.moduleWidth || placement.standardWidth || cuttingRules.fixedModuleWidths[0],
        onChange: (event) => {
          const moduleWidth = Number(event.target.value);
          updatePlacement(placement.id, { moduleWidth, standardWidth: moduleWidth });
        }
      },
        cuttingRules.fixedModuleWidths.map((width) => h("option", { key: width, value: width }, `${width}mm`))
      )
    ),
    series?.supportsPlacementBayControls === true && h("div", { className: "placement-editor-actions" },
      h("button", {
        type: "button",
        disabled: placement.bayIndex <= 0,
        onClick: () => updatePlacement(placement.id, { bayIndex: placement.bayIndex - 1 })
      }, "上一跨"),
      h("button", {
        type: "button",
        disabled: placement.bayIndex >= (design.activeWalls.find((wall) => wall.id === placement.wallId)?.bayCount || 1) - 1,
        onClick: () => updatePlacement(placement.id, { bayIndex: placement.bayIndex + 1 })
      }, "下一跨"),
      h("button", { type: "button", onClick: () => removePlacement(placement.id) }, "删除")
    )
  );
}

function BomTable({ series, bom }) {
  const displayRules = getDisplayRules(series.seriesId) || getDisplayRules("japanese-closet");
  return h("div", { className: "bom-table" },
    h("div", { className: "bom-head" },
      h("span", null, "名称"),
      h("span", null, "规格"),
      h("span", null, "数量"),
      h("span", null, "单位"),
      h("span", null, "单价"),
      h("span", null, "小计")
    ),
    bom.map((item) => h("div", { className: "bom-row", key: `${item.sku}-${item.color}-${item.note}` },
      h("span", { className: "bom-name" },
        h(ProductThumb, { series, image: item.image, name: item.nameCn }),
        h("span", null, h("strong", null, item.sku), h("em", null, item.nameCn), item.note && h("small", null, item.note))
      ),
      h("span", { className: "bom-spec" }, displayRules.getBomDisplaySpec(item)),
      h("span", null, displayRules.getWebDisplayQuantity(item)),
      h("span", null, displayRules.getWebDisplayUnit(item)),
      h("span", null, formatCurrency(displayRules.getWebDisplayUnitPrice(item))),
      h("span", null, formatCurrency(displayRules.getWebDisplayLineTotal(item)))
    ))
  );
}

function GroupedBomTable({ series, bom, displayRules, hidePrices = false }) {
  const defaultOpenBomGroups = displayRules.defaultOpenBomGroups;
  const groups = useMemo(() => groupBomItems(bom, displayRules), [bom, displayRules]);
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    groups.forEach((group) => {
      initial[group.name] = defaultOpenBomGroups.has(group.name);
    });
    return initial;
  });
  const toggleGroup = (name) => setOpenGroups((current) => ({
    ...current,
    [name]: !(current[name] ?? defaultOpenBomGroups.has(name))
  }));

  return h("div", { className: `bom-table grouped-bom-table${hidePrices ? " client-bom-table" : ""}` },
    h("div", { className: "bom-head" },
      h("span", null, "名称"),
      h("span", null, "规格"),
      h("span", null, "数量"),
      h("span", null, "单位"),
      !hidePrices && h("span", null, "单价"),
      !hidePrices && h("span", null, "小计")
    ),
    groups.map((group) => {
      const isOpen = openGroups[group.name] ?? defaultOpenBomGroups.has(group.name);
      return h("section", { className: "bom-group", key: group.name },
        h("button", { className: "bom-group-title", type: "button", onClick: () => toggleGroup(group.name), "aria-expanded": isOpen },
          h("span", null, isOpen ? "v" : ">", " ", group.name),
          h("em", null, `${group.items.length} 项`),
          !hidePrices && h("strong", null, formatCurrency(group.subtotal))
        ),
        isOpen && group.items.map((item) => h("div", { className: "bom-row", key: `${group.name}-${item.sku}-${item.color}-${item.note}` },
          h("span", { className: "bom-name" },
            h(ProductThumb, { series, image: item.image, name: item.nameCn }),
            h("span", null, h("strong", null, item.sku), h("em", null, item.nameCn), item.note && h("small", null, item.note))
          ),
          h("span", { className: "bom-spec" }, displayRules.getBomDisplaySpec(item)),
          h("span", null, displayRules.getWebDisplayQuantity(item)),
          h("span", null, displayRules.getWebDisplayUnit(item)),
          !hidePrices && h("span", null, formatCurrency(displayRules.getWebDisplayUnitPrice(item))),
          !hidePrices && h("span", null, formatCurrency(displayRules.getWebDisplayLineTotal(item)))
        ))
      );
    })
  );
}

function groupBomItems(bom, displayRules) {
  const map = new Map();
  bom.forEach((item) => {
    const name = item.bomGroup || "未分组";
    if (!map.has(name)) {
      map.set(name, {
        name,
        sortOrder: normalizeSortOrder(item.sortOrder),
        items: [],
        subtotal: 0
      });
    }
    const group = map.get(name);
    group.sortOrder = Math.min(group.sortOrder, normalizeSortOrder(item.sortOrder));
    group.items.push(item);
    group.subtotal += displayRules.getWebDisplayLineTotal(item);
  });
  return Array.from(map.values())
    .map((group) => ({
      ...group,
      items: group.items.slice().sort(compareBomItems)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

async function exportQuotationExcel({ bom, design, config, series }) {
  const exportedAt = new Date();
  const displayRules = getDisplayRules(series.seriesId) || getDisplayRules("japanese-closet");
  const exportBom = displayRules.buildQuotationExportItems(bom, design, config);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMAX Wardrobe Configurator";
  workbook.created = exportedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = "auto";
  const imageReport = await createStandardQuotationSheet(
    workbook,
    exportBom,
    design,
    config,
    series,
    exportedAt,
    displayRules
  );
  createBomDetailSheet(workbook, exportBom, design, displayRules);
  createProjectInfoSheet(workbook, design, config, series, exportedAt);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `OMAX-Quotation-${formatExportFileTimestamp(exportedAt)}.xlsx`);
  console.info("Quotation Excel export complete.", {
    sheetNames: workbook.worksheets.map((sheet) => sheet.name),
    insertedImages: imageReport.inserted,
    failedImages: imageReport.failed,
    emptyImageSkus: imageReport.empty
  });
}

async function exportClientProductListExcel({ bom, design, config, series }) {
  const exportedAt = new Date();
  const displayRules = getDisplayRules(series.seriesId) || getDisplayRules("japanese-closet");
  const exportBom = displayRules.buildQuotationExportItems(bom, design, config);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMAX Wardrobe Configurator";
  workbook.created = exportedAt;

  const imageReport = await createClientProductListSheet(
    workbook,
    exportBom,
    design,
    config,
    series,
    exportedAt,
    displayRules
  );
  createClientBomSheet(workbook, exportBom, design, config, displayRules);
  createProjectInfoSheet(workbook, design, config, series, exportedAt);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelBuffer(buffer, `OMAX-Product-List-${formatExportFileTimestamp(exportedAt)}.xlsx`);
  console.info("Client product list export complete.", {
    sheetNames: workbook.worksheets.map((sheet) => sheet.name),
    insertedImages: imageReport.inserted,
    failedImages: imageReport.failed,
    emptyImageSkus: imageReport.empty
  });
}

async function createClientProductListSheet(workbook, bom, design, config, series, exportedAt, displayRules) {
  const sheet = workbook.addWorksheet("产品清单", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  sheet.columns = [
    { width: 7 }, { width: 12 }, { width: 24 }, { width: 22 }, { width: 18 },
    { width: 14 }, { width: 9 }, { width: 10 }, { width: 14 }, { width: 28 }
  ];

  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = `${series?.name || "衣帽间"}产品清单`;
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = `系列：${series?.name || ""}`;
  sheet.mergeCells("F2:J2");
  sheet.getCell("F2").value = `日期：${formatExportDate(exportedAt)}`;

  const headerRow = sheet.getRow(4);
  headerRow.values = ["序号", "图片", "型号/SKU", "品名", "规格尺寸", "颜色", "单位", "数量", "剪尺", "备注"];
  headerRow.height = 24;
  styleQuotationRow(sheet.getRow(1), "title", 10);
  styleQuotationRow(sheet.getRow(2), "information", 10);
  styleQuotationRow(headerRow, "header", 10);

  const itemImageRows = [];
  let itemIndex = 0;
  groupBomItems(bom, displayRules).forEach((group) => {
    const groupRow = sheet.addRow([group.name]);
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 10);
    styleQuotationRow(groupRow, "group", 10);

    group.items.forEach((item) => {
      itemIndex += 1;
      const dimensions = displayRules.getQuotationDimensions(item, config);
      const row = sheet.addRow([
        itemIndex,
        "",
        item.sku,
        item.nameCn,
        dimensions.spec,
        getExcelDisplayColor(item, config),
        displayRules.getQuotationDisplayUnit(item),
        displayRules.getQuotationDisplayQuantity(item),
        dimensions.cutLength,
        item.note || ""
      ]);
      row.height = 45;
      styleQuotationRow(row, "detail", 10);
      [1, 7, 8, 9].forEach((column) => {
        row.getCell(column).alignment = excelCenteredAlignment();
      });
      itemImageRows.push({ item, rowNumber: row.number });
    });
  });

  sheet.addRow([]);
  const declarationRow = sheet.addRow(["本清单不含价格，产品尺寸与数量以最终确认方案为准。"]);
  sheet.mergeCells(declarationRow.number, 1, declarationRow.number, 10);
  styleQuotationRow(declarationRow, "declaration", 10);
  sheet.getRow(1).height = 32;
  sheet.views = [{ state: "frozen", ySplit: 4 }];

  return insertQuotationImages(workbook, sheet, itemImageRows, series);
}

function createClientBomSheet(workbook, bom, design, config, displayRules) {
  const sheet = workbook.addWorksheet("BOM清单");
  sheet.addRow(["BOM分组", "SKU", "名称", "规格", "数量", "单位", "剪尺", "备注"]);
  groupBomItems(bom, displayRules).forEach((group) => {
    group.items.forEach((item) => {
      const dimensions = displayRules.getQuotationDimensions(item, config);
      sheet.addRow([
        group.name,
        item.sku,
        item.nameCn,
        dimensions.spec || displayRules.getExcelDisplaySpec(item, design),
        displayRules.getQuotationDisplayQuantity(item),
        displayRules.getQuotationDisplayUnit(item),
        dimensions.cutLength,
        item.note || ""
      ]);
    });
  });
  sheet.columns = [
    { width: 18 }, { width: 24 }, { width: 22 }, { width: 18 },
    { width: 10 }, { width: 10 }, { width: 14 }, { width: 24 }
  ];
  styleQuotationRow(sheet.getRow(1), "header", 8);
  return sheet;
}

async function createStandardQuotationSheet(workbook, bom, design, config, series, exportedAt, displayRules) {
  const normalBomItems = bom.filter((item) => !displayRules.factoryCutSkus.has(item.sku));
  const factoryCutItems = bom.filter((item) => displayRules.factoryCutSkus.has(item.sku));
  const sheet = workbook.addWorksheet("正式报价单", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  sheet.columns = [
    { width: 7 }, { width: 12 }, { width: 24 }, { width: 22 }, { width: 18 },
    { width: 14 }, { width: 9 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 28 }
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = `${series?.name || "衣帽间"}（经销商价）`;
  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = "供方：佛山市奥美斯五金制品有限公司";
  sheet.mergeCells("G2:L2");
  sheet.getCell("G2").value = "客户：";
  sheet.mergeCells("A3:F3");
  sheet.getCell("A3").value = "地址：佛山市南海区里水镇";
  sheet.mergeCells("G3:L3");
  sheet.getCell("G3").value = "地址：";
  sheet.mergeCells("A4:F4");
  sheet.getCell("A4").value = "电话：0086-13430288289";
  sheet.mergeCells("G4:L4");
  sheet.getCell("G4").value = "手机号码：";
  sheet.mergeCells("G5:L5");
  sheet.getCell("G5").value = `日期：${formatExportDate(exportedAt)}`;

  const headerRow = sheet.getRow(7);
  headerRow.values = ["序号", "图片", "型号/SKU", "品名", "规格尺寸", "颜色", "单位", "数量", "销售价", "总额", "剪尺", "备注"];
  headerRow.height = 24;

  const itemImageRows = [];
  const quotationDetailRows = [];
  let itemIndex = 0;
  groupBomItems(normalBomItems, displayRules).forEach((group) => {
    const groupRow = sheet.addRow([group.name]);
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 12);
    styleQuotationRow(groupRow, "group");

    group.items.forEach((item) => {
      itemIndex += 1;
      const quotationDimensions = displayRules.getQuotationDimensions(item, config);
      const row = sheet.addRow([
        itemIndex,
        "",
        item.sku,
        item.nameCn,
        quotationDimensions.spec,
        getExcelDisplayColor(item, config),
        displayRules.getQuotationDisplayUnit(item),
        displayRules.getQuotationDisplayQuantity(item),
        displayRules.getQuotationDisplayUnitPrice(item),
        null,
        quotationDimensions.cutLength,
        item.note || ""
      ]);
      row.getCell(10).value = {
        formula: `H${row.number}*I${row.number}`,
        result: displayRules.getQuotationDisplayLineTotal(item)
      };
      row.height = 45;
      styleQuotationRow(row, "detail");
      row.getCell(1).alignment = excelCenteredAlignment();
      row.getCell(7).alignment = excelCenteredAlignment();
      row.getCell(8).alignment = excelCenteredAlignment();
      row.getCell(9).alignment = excelRightAlignment();
      row.getCell(10).alignment = excelRightAlignment();
      row.getCell(11).alignment = excelCenteredAlignment();
      quotationDetailRows.push(row.number);
      itemImageRows.push({ item, rowNumber: row.number });
    });
  });

  const firstQuotationDetailRow = quotationDetailRows[0];
  const lastQuotationDetailRow = quotationDetailRows[quotationDetailRows.length - 1];
  const quotationTotal = normalBomItems.reduce(
    (sum, item) => sum + displayRules.getQuotationDisplayLineTotal(item),
    0
  );
  const totalRow = sheet.addRow([
    "", "", "", "", "", "", "", "", "合计金额",
    null, "", ""
  ]);
  totalRow.getCell(10).value = {
    formula: firstQuotationDetailRow
      ? `SUM(J${firstQuotationDetailRow}:J${lastQuotationDetailRow})`
      : "0",
    result: quotationTotal
  };
  totalRow.height = 24;
  styleQuotationRow(totalRow, "total");

  const shippingRow = sheet.addRow([
    "", "", "", "", "", "", "", "", "运费",
    null, "", ""
  ]);
  shippingRow.height = 24;
  styleQuotationRow(shippingRow, "detail");
  styleQuotationFeeRow(shippingRow);

  const packagingRow = sheet.addRow([
    "", "", "", "", "", "", "", "", "包装费",
    null, "", ""
  ]);
  packagingRow.height = 24;
  styleQuotationRow(packagingRow, "detail");
  styleQuotationFeeRow(packagingRow);

  const finalTotalRow = sheet.addRow([
    "", "", "", "", "", "", "", "", "最终总价",
    null, "", ""
  ]);
  finalTotalRow.getCell(10).value = {
    formula: `J${totalRow.number}+N(J${shippingRow.number})+N(J${packagingRow.number})`,
    result: quotationTotal
  };
  finalTotalRow.height = 24;
  styleQuotationRow(finalTotalRow, "total");
  sheet.addRow([]);

  const factoryTitleRow = sheet.addRow(["工厂剪尺"]);
  sheet.mergeCells(factoryTitleRow.number, 1, factoryTitleRow.number, 12);
  factoryTitleRow.height = 24;
  styleQuotationRow(factoryTitleRow, "group");

  const factoryHeaderRow = sheet.addRow([
    "序号", "图片", "型号/SKU", "品名", "规格尺寸",
    "颜色", "单位", "数量", "剪尺", "备注"
  ]);
  factoryHeaderRow.height = 24;
  styleQuotationRow(factoryHeaderRow, "header", 10);

  factoryCutItems.forEach((item, index) => {
    const quotationDimensions = displayRules.getQuotationDimensions(item, config);
    const row = sheet.addRow([
      index + 1,
      "",
      item.sku,
      item.nameCn,
      quotationDimensions.spec,
      getExcelDisplayColor(item, config),
      displayRules.getQuotationDisplayUnit(item),
      displayRules.getQuotationDisplayQuantity(item),
      quotationDimensions.cutLength,
      item.note || ""
    ]);
    row.height = 45;
    styleQuotationRow(row, "detail", 10);
    row.getCell(1).alignment = excelCenteredAlignment();
    row.getCell(7).alignment = excelCenteredAlignment();
    row.getCell(8).alignment = excelCenteredAlignment();
    row.getCell(9).alignment = excelCenteredAlignment();
    itemImageRows.push({ item, rowNumber: row.number });
  });
  sheet.addRow([]);

  [
    "1.收到货后如有差错。请3天内来电告知。逾期恕概不受理。",
    "2.以上报价不含税，不含银行汇款手续费；运费及包装费以报价单填写金额为准。",
    "3.付款方式：出货前付清。",
    "4.铝框层板10–15天交货"
  ].forEach((declaration) => {
    const row = sheet.addRow([declaration]);
    sheet.mergeCells(row.number, 1, row.number, 12);
    row.height = 22;
    styleQuotationRow(row, "declaration");
  });

  sheet.getRow(1).height = 32;
  [2, 3, 4, 5].forEach((rowNumber) => {
    sheet.getRow(rowNumber).height = 23;
    styleQuotationRow(sheet.getRow(rowNumber), "information");
  });
  styleQuotationRow(sheet.getRow(1), "title");
  styleQuotationRow(headerRow, "header");
  sheet.views = [{ state: "frozen", ySplit: 7 }];

  return insertQuotationImages(workbook, sheet, itemImageRows, series);
}

async function insertQuotationImages(workbook, sheet, itemRows, series) {
  const report = { inserted: 0, failed: [], empty: [] };
  const imageCache = new Map();
  for (const { item, rowNumber } of itemRows) {
    if (!item.image) {
      report.empty.push(item.sku);
      continue;
    }
    const url = resolveSeriesAsset(series, item.image);
    try {
      let cached = imageCache.get(url);
      if (!cached) {
        const response = await fetch(url, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
          throw new Error(`HTTP ${response.status}, content-type ${contentType || "missing"}`);
        }
        const extension = contentType.toLowerCase().includes("jpeg") ? "jpeg" : "png";
        cached = { buffer: new Uint8Array(await response.arrayBuffer()), extension };
        imageCache.set(url, cached);
      }
      const imageId = workbook.addImage(cached);
      sheet.addImage(imageId, {
        tl: { col: 1.12, row: rowNumber - 0.92 },
        ext: { width: 60, height: 45 }
      });
      report.inserted += 1;
    } catch (error) {
      report.failed.push({ sku: item.sku, url, error: String(error?.message || error) });
    }
  }
  if (report.failed.length) console.warn("Quotation product images failed to load.", report.failed);
  return report;
}

function styleQuotationRow(row, role, maxColumn = 12) {
  const border = excelThinBorder();
  row.eachCell({ includeEmpty: true }, (cell, column) => {
    if (column > maxColumn) return;
    cell.border = border;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  if (role === "title" || role === "header" || role === "total") {
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      if (column > maxColumn) return;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6F3F1F" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: role === "title" ? 16 : 11 };
      cell.alignment = excelCenteredAlignment();
    });
  } else if (role === "group") {
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      if (column > maxColumn) return;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEADCCF" } };
      cell.font = { bold: true, color: { argb: "FF4A2A17" } };
    });
  }
}

function styleQuotationFeeRow(row) {
  row.getCell(9).font = { bold: true, color: { argb: "FF4A2A17" } };
  row.getCell(9).alignment = excelCenteredAlignment();
  row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  row.getCell(10).numberFormat = "¥#,##0.00";
  row.getCell(10).alignment = excelRightAlignment();
}

function excelThinBorder() {
  const side = { style: "thin", color: { argb: "FF8C6A52" } };
  return { top: side, bottom: side, left: side, right: side };
}

function excelCenteredAlignment() {
  return { horizontal: "center", vertical: "middle", wrapText: true };
}

function excelRightAlignment() {
  return { horizontal: "right", vertical: "middle", wrapText: true };
}

function createBomDetailSheet(workbook, bom, design, displayRules) {
  const headers = ["SKU", "名称", "规格", "数量", "单位", "单价", "小计", "备注"];
  const sheet = workbook.addWorksheet("BOM明细");
  sheet.addRow(headers);
  const detailRows = bom.map((item) => {
    const row = sheet.addRow([
      item.sku,
      item.nameCn,
      displayRules.getExcelDisplaySpec(item, design),
      displayRules.getBomDisplayQuantity(item),
      item.unit,
      displayRules.getBomDisplayUnitPrice(item),
      null,
      item.note || ""
    ]);
    row.getCell(7).value = {
      formula: `D${row.number}*F${row.number}`,
      result: Number(item.lineTotal || 0)
    };
    return row.number;
  });
  sheet.addRow([]);
  const totalRow = sheet.addRow(["总计", "", "", "", "", "", null, ""]);
  totalRow.getCell(7).value = {
    formula: detailRows.length
      ? `SUM(G${detailRows[0]}:G${detailRows[detailRows.length - 1]})`
      : "0",
    result: bom.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
  };
  sheet.columns = [
    { width: 24 }, { width: 22 }, { width: 18 }, { width: 10 },
    { width: 10 }, { width: 12 }, { width: 14 }, { width: 20 }
  ];
  return sheet;
}

function createProjectInfoSheet(workbook, design, config, series, exportedAt) {
  const sheet = workbook.addWorksheet("项目信息");
  sheet.addRows([
    ["字段", "内容"],
    ["系列", series?.name || series?.seriesId || ""],
    ["房间宽度", `${design.room.width}mm`],
    ["房间深度", `${design.room.depth}mm`],
    ["立柱高度", `${design.postHeight}mm`],
    ["颜色", config.frameColor || ""],
    ["导出时间", formatExportDateTime(exportedAt)]
  ]);
  sheet.columns = [{ width: 16 }, { width: 28 }];
  return sheet;
}

function downloadExcelBuffer(buffer, filename) {
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getExcelDisplayColor(item, config) {
  const colorMap = {
    "Silver Grey": "银灰色",
    "Wood Brown": "木纹色",
    "Default Material": "标准件",
    Black: "黑色",
    White: "白色",
    "Champagne Grey": "香槟灰",
    "Warm Grey": "暖灰色"
  };
  const color = item.color || config.frameColor || "";
  return colorMap[color] || item.colorNameCn || color;
}

function getWallDisplayLength(series, wall, room, config) {
  if (
    config?.layout === "U"
    && config.uAsymmetricSideWalls === true
  ) {
    return wall.sourceLength;
  }
  if (
    series?.seriesId === "carbon-steel-post-wardrobe-v2"
    && (wall.id === "left" || wall.id === "right")
  ) {
    return Math.max(0, Number(room?.depth || 0) - 435);
  }
  return wall.length;
}

function formatExportFileTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("");
}

function formatExportDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatExportDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeSortOrder(value) {
  if (value === "" || value == null || String(value).trim() === "") {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function compareBomItems(left, right) {
  return normalizeSortOrder(left.sortOrder) - normalizeSortOrder(right.sortOrder)
    || String(left.bomGroup || "").localeCompare(String(right.bomGroup || ""), "zh-CN")
    || String(left.sku || "").localeCompare(String(right.sku || ""));
}

function AdminApp({ data, setData }) {
  const [query, setQuery] = useState("");
  const filtered = data.products.filter((product) => `${product.sku}${product.nameCn}${product.type}`.toLowerCase().includes(query.toLowerCase()));

  const persist = (next) => {
    setData(next);
    saveWorkbookOverride(data.series.seriesId, next);
  };

  const updateProduct = (sku, patch) => {
    persist({
      ...data,
      products: data.products.map((product) => product.sku === sku ? { ...product, ...patch } : product)
    });
  };

  const updateRule = (index, patch) => {
    persist({
      ...data,
      rules: data.rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule)
    });
  };

  const uploadProducts = async (file) => {
    const products = await parseProductFile(file, data.series);
    persist({ ...data, products, source: "localStorage" });
  };

  const uploadRules = async (file) => {
    const rules = await parseRulesFile(file, data.series);
    persist({ ...data, rules, source: "localStorage" });
  };

  return h("main", { className: "admin-shell" },
    h("aside", { className: "control-rail admin-nav" },
      h(Header, { active: "admin", series: data.series }),
      h("div", { className: "admin-actions" },
        h("label", { className: "upload-button" }, h(Upload, { size: 16 }), "上传 products.xlsx", h("input", { type: "file", accept: ".xlsx,.xls", onChange: (event) => event.target.files[0] && uploadProducts(event.target.files[0]) })),
        h("label", { className: "upload-button" }, h(Upload, { size: 16 }), "上传 rules.xlsx", h("input", { type: "file", accept: ".xlsx,.xls", onChange: (event) => event.target.files[0] && uploadRules(event.target.files[0]) })),
        h("button", { type: "button", onClick: () => exportProductsWorkbook(data) }, h(Download, { size: 16 }), "导出产品"),
        h("button", { type: "button", onClick: () => exportRulesWorkbook(data) }, h(Download, { size: 16 }), "导出规则"),
        h("button", { type: "button", onClick: () => { clearWorkbookOverride(data.series.seriesId); location.reload(); } }, h(RefreshCcw, { size: 16 }), "恢复默认")
      ),
      h("p", { className: "quote-note" }, `当前系列：${data.series.name}`),
      h("p", { className: "quote-note" }, `当前数据源：${data.source === "localStorage" ? "员工本地修改" : `/${data.series.productPath} + /${data.series.rulesPath}`}`)
    ),
    h("section", { className: "admin-content" },
      h("div", { className: "admin-header" },
        h("div", null, h("p", { className: "eyebrow" }, "ADMIN"), h("h1", null, "产品与规则维护")),
        h("label", { className: "search-box" }, h(Search, { size: 16 }), h("input", { value: query, placeholder: "搜索 SKU / 名称 / 类型", onChange: (event) => setQuery(event.target.value) }))
      ),
      h("section", { className: "admin-panel" },
        h("h2", null, "产品列表"),
        h("div", { className: "admin-product-grid" },
          filtered.map((product) => h("div", { className: "admin-product-row", key: product.sku },
            h("div", { className: "admin-thumb-cell" },
              h(ProductThumb, { series: data.series, image: product.image, name: product.nameCn }),
              h("label", null, "换图", h("input", { type: "file", accept: "image/*", onChange: (event) => event.target.files[0] && uploadProductImage(event.target.files[0], (image) => updateProduct(product.sku, { image })) }))
            ),
            h("input", { value: product.sku, readOnly: true }),
            h("input", { value: product.nameCn, onChange: (event) => updateProduct(product.sku, { nameCn: event.target.value }) }),
            h("input", { value: product.type, onChange: (event) => updateProduct(product.sku, { type: event.target.value }) }),
            h("input", { type: "number", value: product.unitPrice, onChange: (event) => updateProduct(product.sku, { unitPrice: Number(event.target.value) }) }),
            h("label", { className: "check-field" }, h("input", { type: "checkbox", checked: product.sellable, onChange: (event) => updateProduct(product.sku, { sellable: event.target.checked }) }), "销售"),
            h("input", { value: product.image, placeholder: "图片路径", onChange: (event) => updateProduct(product.sku, { image: event.target.value }) }),
            h("input", { value: product.icon, placeholder: "图标路径", onChange: (event) => updateProduct(product.sku, { icon: event.target.value }) }),
            h("input", { value: product.modelPath, placeholder: "GLB路径", onChange: (event) => updateProduct(product.sku, { modelPath: event.target.value, glbAssetPath: event.target.value }) }),
            h("input", { value: product.material, placeholder: "材质", onChange: (event) => updateProduct(product.sku, { material: event.target.value }) }),
            h("input", { value: Array.isArray(product.colorOptions) ? product.colorOptions.join("|") : product.colorOptions, placeholder: "颜色", onChange: (event) => updateProduct(product.sku, { colorOptions: event.target.value.split("|").map((item) => item.trim()).filter(Boolean) }) }),
            h("input", { value: product.sizeRule, placeholder: "尺寸规则", onChange: (event) => updateProduct(product.sku, { sizeRule: event.target.value }) })
          ))
        )
      ),
      h("section", { className: "admin-panel" },
        h("h2", null, "规则表"),
        h("div", { className: "rule-table" },
          data.rules.map((rule, index) => h("div", { className: "rule-row", key: `${rule.configType}-${rule.requiredSku}-${index}` },
            h("input", { value: rule.configType, onChange: (event) => updateRule(index, { configType: event.target.value }) }),
            h("input", { value: rule.requiredSku, onChange: (event) => updateRule(index, { requiredSku: event.target.value }) }),
            h("input", { type: "number", value: rule.quantity, onChange: (event) => updateRule(index, { quantity: Number(event.target.value) }) }),
            h("input", { value: rule.note, onChange: (event) => updateRule(index, { note: event.target.value }) })
          ))
        )
      )
    )
  );
}

function Header({ active, series, isClientMode = false, brandInfo = null }) {
  const brandName = isClientMode
    ? brandInfo?.brandNameCn || brandInfo?.brandNameEn || "Wardrobe Configurator"
    : "奥美斯五金";
  const seriesName = isClientMode
    ? brandInfo?.seriesName || series.name
    : series.name;
  return h("header", { className: "brand-block" },
    isClientMode
      ? h("img", { className: "client-header-logo", src: resolveRootAssetPath(series.clientLogoPath), alt: "Client logo" })
      : h("div", { className: "brand-mark" }, "OM"),
    h("div", null,
      h("h2", null, brandName),
      h("p", null, seriesName),
      !isClientMode && h("nav", { className: "tiny-nav" },
        h("a", { href: `/configurator/${series.seriesId}`, className: active === "configurator" ? "active" : "" }, "配置端"),
        h("a", { href: `/admin/${series.seriesId}`, className: active === "admin" ? "active" : "" }, "管理端")
      )
    )
  );
}

function StepBlock({ icon: Icon, title, children }) {
  return h("section", { className: "step-block" },
    h("div", { className: "step-title" }, h(Icon, { size: 18 }), h("h3", null, title)),
    h("div", { className: "step-content" }, children)
  );
}

function NumberField({ label, value, suffix, min, max, step, onChange }) {
  const [draftValue, setDraftValue] = useState(String(value ?? ""));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraftValue(String(value ?? ""));
  }, [isFocused, value]);

  const commitValue = (rawValue) => {
    if (!/^\d*$/.test(rawValue)) return;
    setDraftValue(rawValue);
    if (rawValue !== "") onChange(Number.parseInt(rawValue, 10));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseIntegerInput(draftValue);
    if (parsed == null) {
      setDraftValue(String(value ?? ""));
      return;
    }
    const clamped = clampValue(parsed, 1, 99999);
    setDraftValue(String(clamped));
    onChange(clamped);
  };

  return h("label", { className: "field" },
    h("span", null, label),
    h("div", { className: "input-shell" },
      h(Ruler, { size: 16 }),
      h("input", {
        type: "number",
        value: draftValue,
        min,
        max,
        step,
        onFocus: () => setIsFocused(true),
        onChange: (event) => commitValue(event.target.value),
        onBlur: handleBlur
      }),
      h("em", null, suffix)
    )
  );
}

function parseIntegerInput(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function Segmented({ label, value, options, onChange }) {
  return h("div", { className: "choice-group" },
    h("span", null, label),
    h("div", { className: "segments" },
      options.map((option) => h("button", { key: option.value, className: value === option.value ? "active" : "", type: "button", onClick: () => onChange(option.value) }, option.label))
    )
  );
}

function ULayoutModeSelector({ value, onChange }) {
  const options = [
    {
      value: "back-first",
      label: "后墙优先"
    },
    {
      value: "side-first",
      label: "侧墙优先"
    }
  ];

  return h("div", { className: "choice-group" },
    h("span", null, "U型排布方式"),
    h("div", { className: "u-layout-mode-buttons" },
      options.map((option) => h("button", {
        key: option.value,
        type: "button",
        className: value === option.value ? "active" : "",
        "aria-pressed": value === option.value,
        onClick: () => onChange(option.value)
      },
        h("span", {
          className: `u-layout-diagram ${option.value}`,
          "aria-hidden": "true"
        },
          h("i", { className: "back" }),
          h("i", { className: "left" }),
          h("i", { className: "right" })
        ),
        h("strong", null, option.label)
      ))
    )
  );
}

function SwatchGroup({ label, value, options, onChange }) {
  return h("div", { className: "choice-group" },
    h("span", null, label),
    h("div", { className: "swatches" },
      options.map((option) => h("button", { key: option, type: "button", className: value === option ? "active" : "", title: option, "aria-label": option, onClick: () => onChange(option) },
        h("i", { className: "swatch", style: { background: swatchColors[option] || "var(--primary)" } })
      ))
    )
  );
}

function Metric({ icon: Icon, label, value }) {
  return h("div", { className: "metric" }, h(Icon, { size: 18 }), h("span", null, label), h("strong", null, value));
}

function ProductThumb({ series, image, name }) {
  const src = image ? resolveSeriesAsset(series, image) : "";
  return image
    ? h("img", { className: "product-thumb", src, alt: name })
    : h("div", { className: "product-thumb placeholder" }, h(ImageIcon, { size: 17 }));
}

function BrandSceneCard({ brandInfo, isClientMode = false, series }) {
  return h("aside", { className: "scene-brand-card", "aria-label": "品牌信息" },
    h("img", {
      src: isClientMode
        ? resolveRootAssetPath(series?.clientLogoPath)
        : resolveRootAssetPath(series?.logoPath || "brand/logo.png"),
      alt: isClientMode ? "Client logo" : (brandInfo.brandNameEn || brandInfo.brandNameCn || "Brand")
    }),
    h("div", null,
      brandInfo.brandNameCn && h("strong", null, brandInfo.brandNameCn),
      brandInfo.brandNameEn && h("span", null, brandInfo.brandNameEn),
      brandInfo.seriesName && h("em", null, brandInfo.seriesName),
      brandInfo.phone && h("small", null, brandInfo.phone)
    )
  );
}

function resolveRootAssetPath(path) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

async function loadBrandInfo(urls) {
  const candidates = Array.isArray(urls) ? urls : [urls];
  if (typeof fetch === "function") {
    for (const url of candidates) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("json")) continue;
      try {
        return parseBrandInfoJson(await response.text());
      } catch {
        continue;
      }
    }
    return null;
  }

  const [url] = candidates;
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", `${url}?v=${Date.now()}`);
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        resolve(null);
        return;
      }
      try {
        resolve(parseBrandInfoJson(request.responseText));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = reject;
    request.send();
  });
}

function parseBrandInfoJson(source) {
  return JSON.parse(String(source).replace(/,\s*([}\]])/g, "$1"));
}

function ComponentIcon({ series, icon, name }) {
  return icon
    ? h("img", { className: "component-icon", src: resolveSeriesAsset(series, icon), alt: name })
    : h("span", { className: "component-icon placeholder" }, h(PackageSearch, { size: 17 }));
}

function uploadProductImage(file, onReady) {
  const reader = new FileReader();
  reader.onload = () => onReady(reader.result);
  reader.readAsDataURL(file);
}

function pickColor(componentType, config) {
  if (componentType === "singleRail" || componentType === "doubleRail") return config.frameColor;
  if (componentType === "woodTop" || componentType === "woodShelf" || componentType === "cabinet") return woodColor;
  return defaultProductColor;
}

createRoot(document.getElementById("root")).render(h(App));
