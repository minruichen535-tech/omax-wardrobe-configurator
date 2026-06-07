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
  componentTypes,
  createInitialConfig,
  formatCurrency,
  getComponentIcon,
  getComponentName,
  getDefaultHeight,
  fixedModuleTypes,
  fixedModuleWidths,
  labelWall,
  normalizeFixedModuleWidth,
  recommendBayCount,
  syncWallLengthsWithRoom
} from "./configurator.js?v=l-shape-effective-length-20260603-02";
import {
  clearWorkbookOverride,
  exportProductsWorkbook,
  exportRulesWorkbook,
  loadWorkbookData,
  parseProductFile,
  parseRulesFile,
  saveWorkbookOverride
} from "./dataSource.js?v=shelf-depth-settings-20260602-01";
import { applyTheme, swatchColors } from "./config/theme.js?v=color-system-20260602-01";
import { productSeries, resolveRoute, resolveSeriesAsset } from "./config/productSeries.js";
import { WardrobeScene } from "./scene.js?v=side-post-depth-inset-20260603-01";

const h = React.createElement;
const frameColorOptions = ["Silver Grey", "Black"];
const woodColor = "Wood Brown";
const defaultProductColor = "Default Material";
applyTheme();

function App() {
  const routeInfo = useMemo(() => resolveRoute(), []);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeInfo.series) {
      setError(`未登记的产品系列：${routeInfo.seriesId}`);
      return;
    }
    loadWorkbookData(routeInfo.series).then(setData).catch((err) => setError(err.message));
  }, [routeInfo.series, routeInfo.seriesId]);

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
    : h(ClientApp, { data });
}

function ClientApp({ data }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem("omax-auth") === "true"
  );
  const [config, setConfig] = useState(createInitialConfig);
  const [quoteNote, setQuoteNote] = useState("");
  const [brandInfo, setBrandInfo] = useState(null);
  const [isExportingQuote, setIsExportingQuote] = useState(false);
  const design = useMemo(() => calculateDesign(config, data), [config, data]);
  const selectedPlacement = design.placements.find((placement) => placement.id === config.selectedPlacementId);
  const shelfDepthOptions = data.settings?.shelfDepthOptions || [300, 450, 500];
  const postHeightOptions = data.settings?.postHeightOptions || [2000, 2400];
  const hideRoomHeightInput = data.settings?.hideRoomHeightInput === true;

  useEffect(() => {
    const fixedPostWallOffset = Number(data.settings?.fixedPostWallOffset) || 250;
    const defaultShelfDepth = Number(data.settings?.defaultShelfDepth) || 450;
    setConfig((current) => ({
      ...current,
      wallOffset: fixedPostWallOffset,
      shelfDepth: current.shelfDepth || defaultShelfDepth
    }));
  }, [data.settings?.fixedPostWallOffset, data.settings?.defaultShelfDepth]);

  useEffect(() => {
    const roomHeightFixed = Number(data.settings?.roomHeightFixed) || 2700;
    const defaultPostHeight = Number(data.settings?.defaultPostHeight) || 2400;
    setConfig((current) => ({
      ...syncWallLengthsWithRoom(current, { height: roomHeightFixed }),
      postHeight: current.postHeight || defaultPostHeight
    }));
  }, [data.settings?.roomHeightFixed, data.settings?.defaultPostHeight]);

  useEffect(() => {
    loadBrandInfo("/brand/brand.json")
      .then(setBrandInfo)
      .catch(() => setBrandInfo(null));
  }, []);

  const updateConfig = (patch) => setConfig((current) => ({ ...current, ...patch }));
  const setRoom = (key, value) => {
    const nextValue = parseIntegerInput(value);
    if (nextValue == null) return;
    setConfig((current) => syncWallLengthsWithRoom(current, { [key]: clampValue(nextValue, 1, 99999) }));
  };
  const setLayout = (layout) => setConfig((current) => applyLayout(current, layout));
  const exportQuote = async () => {
    setIsExportingQuote(true);
    try {
      await exportQuotationExcel({
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
      [wallId]: { ...current.walls[wallId], bayCount: Number(bayCount) }
    }
  }));

  const addPlacement = (wallId, bayIndex, componentType) => {
    const product = design.productByType[componentType];
    const color = pickColor(componentType, config);
    const wall = design.activeWalls.find((item) => item.id === wallId);
    const currentBayWidth = wall?.bays?.[bayIndex]?.postCenterDistance || wall?.bayWidth || 0;
    const moduleWidth = fixedModuleTypes.includes(componentType) ? normalizeFixedModuleWidth(currentBayWidth) : null;
    const placement = {
      id: `p${Date.now()}`,
      wallId,
      bayIndex: Number(bayIndex),
      componentType,
      ...(moduleWidth ? { moduleWidth, standardWidth: moduleWidth } : {}),
      heightFromFloor: getDefaultHeight(componentType, design.room.height),
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
      onLogin: () => {
        localStorage.setItem("omax-auth", "true");
        setIsAuthenticated(true);
      }
    });
  }

  const logout = () => {
    localStorage.removeItem("omax-auth");
    setIsAuthenticated(false);
  };

  return h("main", { className: "app-shell" },
    h("section", { className: "workspace upgraded-workspace" },
      h("aside", { className: "control-rail", "aria-label": "配置选项" },
        h(Header, { active: "configurator", series: data.series }),
        h(StepBlock, { icon: Home, title: "房间尺寸设置" },
          h(NumberField, { label: "房间宽度", value: config.room.width, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("width", value) }),
          h(NumberField, { label: "房间深度", value: config.room.depth, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("depth", value) }),
          !hideRoomHeightInput && h(NumberField, { label: "房间高度", value: config.room.height, suffix: "mm", min: 1, max: 99999, step: 1, onChange: (value) => setRoom("height", value) }),
          postHeightOptions.length > 0 && h(Segmented, {
            label: "立柱高度",
            value: String(config.postHeight || data.settings?.defaultPostHeight || postHeightOptions[0]),
            options: postHeightOptions.map((height) => ({ value: String(height), label: `${height}mm` })),
            onChange: (postHeight) => updateConfig({ postHeight: Number(postHeight) })
          }),
          shelfDepthOptions.length > 0 && h(Segmented, {
            label: "层板深度",
            value: String(config.shelfDepth || data.settings?.defaultShelfDepth || shelfDepthOptions[0]),
            options: shelfDepthOptions.map((depth) => ({ value: String(depth), label: `${depth}mm` })),
            onChange: (shelfDepth) => updateConfig({ shelfDepth: Number(shelfDepth) })
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
          })
        ),
        h(StepBlock, { icon: Ruler, title: "跨数选择" },
          design.activeWalls.map((wall) => h("div", { className: "wall-control", key: wall.id },
            h("div", null,
              h("strong", null, labelWall(wall.id)),
              h("span", null, `${Math.round(wall.length)}mm / 单跨 ${Math.round(wall.bayWidth)}mm`)
            ),
            h("input", {
              type: "number",
              min: recommendBayCount(wall.length),
              value: config.walls[wall.id].bayCount,
              onChange: (event) => setWallBayCount(wall.id, event.target.value)
            })
          )),
          design.errors.map((message) => h("p", { className: "error-text", key: message }, message))
        ),
        h(StepBlock, { icon: Shirt, title: "组件库" },
          h(SwatchGroup, { label: "立柱颜色", value: config.frameColor, options: frameColorOptions, onChange: (frameColor) => updateConfig({ frameColor }) }),
          h("div", { className: "component-library" },
            componentTypes.filter((type) => !design.productByType[type]?.autoGenerated).map((type) => {
              const product = design.productByType[type];
              const icon = getComponentIcon(product, type);
              return h("div", {
                className: "component-tile",
                key: type,
                "data-component-type": type,
                draggable: true,
                onDragStart: (event) => event.dataTransfer.setData("text/plain", type)
              },
                h(ComponentIcon, { series: data.series, icon, name: getLibraryComponentName(type, design.productByType) }),
                h("span", null, getLibraryComponentName(type, design.productByType))
              );
            })
          )
        ),
        selectedPlacement && h(PlacementEditor, { placement: selectedPlacement, design, updatePlacement })
      ),
      h("section", { className: "viewer-pane" },
        h("div", { className: "viewer-topline" },
          h("div", null,
            h("p", { className: "eyebrow" }, "OMEIX HARDWARE"),
            h("h1", null, data.series.name)
          ),
          h("div", { className: "viewer-actions" },
            h("div", { className: "metrics" },
              h(Metric, { icon: Layers3, label: "墙面", value: `${design.activeWalls.length} 面` }),
              h(Metric, { icon: ClipboardList, label: "销售 SKU", value: `${design.bom.length} 项` }),
              h(Metric, { icon: WalletCards, label: "预估价", value: formatCurrency(design.total) })
            ),
            h("button", { className: "logout-button", type: "button", onClick: logout }, "退出登录")
          )
        ),
        h("div", { className: "scene-frame enhanced-scene" },
          brandInfo && h(BrandSceneCard, { brandInfo }),
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
          h("h2", null, "配置与销售清单"),
          h("button", {
            className: "quote-export-button",
            type: "button",
            disabled: isExportingQuote,
            onClick: exportQuote
          }, h(Download, { size: 15 }), isExportingQuote ? "导出中..." : "导出Excel")
        ),
        design.warnings.map((message) => h("p", { className: "warning-text", key: message }, message)),
        h("div", { className: "placement-list quote-placement-list" },
          design.placements.length === 0 && h("p", { className: "empty-placement" }, "从左侧拖入组合件后，这里会显示配置明细。"),
          design.placements.map((placement) => h("div", {
            className: `placement-row ${placement.id === config.selectedPlacementId ? "selected" : ""}`,
            key: placement.id,
            onClick: () => updateConfig({ selectedPlacementId: placement.id })
          },
            h("span", null, `${labelWall(placement.wallId)} / 第 ${placement.bayIndex + 1} 跨 / ${getComponentName(placement.componentType, design.productByType)} / 离地 ${placement.heightFromFloor}mm`),
            placement.autoGenerated && h("small", { className: "cut-length" }, "自动生成"),
            placement.cutLength && h("small", { className: "cut-length" }, `剪尺${placement.cutLength}mm`),
            fixedModuleTypes.includes(placement.componentType) && h("small", { className: "cut-length" }, `${getComponentName(placement.componentType, design.productByType)} ${placement.moduleWidth || placement.standardWidth}mm`),
            h("strong", null, `x${placement.quantity}`),
            !placement.autoGenerated && h("button", { type: "button", title: "删除", onClick: (event) => { event.stopPropagation(); removePlacement(placement.id); } }, h(Trash2, { size: 15 }))
          ))
        ),
        h(GroupedBomTable, { series: data.series, bom: design.bom }),
        h("div", { className: "total-row" }, h("span", null, "预计合计"), h("strong", null, formatCurrency(design.total))),
        h("label", { className: "field quote-note-field" },
          h("span", null, "备注信息"),
          h("textarea", {
            value: quoteNote,
            rows: 4,
            placeholder: "请输入报价备注",
            onChange: (event) => setQuoteNote(event.target.value)
          })
        ),
        h("p", { className: "quote-note" }, "以上价格为系统预估价格，最终报价需根据实际尺寸、颜色、包装方式、运输方式及订单数量确认。"),
        h("button", { className: "inquiry-button", type: "button" }, "提交询价")
      )
    )
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (username === "admin" && password === "Omax2026!") {
      setError("");
      onLogin();
      return;
    }
    setError("账号或密码错误");
  };

  return h("main", { className: "login-screen" },
    h("form", { className: "login-panel", onSubmit: submit },
      h("div", { className: "login-brand-mark", "aria-hidden": "true" }, "OM"),
      h("h1", null, "OMAX Wardrobe Configurator"),
      h("p", null, "Internal Access"),
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

function BayCanvas({ series, design, selectedId, setSelected, addPlacement }) {
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
              const icon = getComponentIcon(product, placement.componentType);
              return h("button", {
                type: "button",
                className: `bay-chip ${placement.id === selectedId ? "active" : ""}`,
                key: placement.id,
                onClick: () => setSelected(placement.id)
              },
                h(ComponentIcon, { series, icon, name: getComponentName(placement.componentType, design.productByType) }),
                h("span", null, `${getComponentName(placement.componentType, design.productByType)} ${placement.heightFromFloor}mm`)
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

function PlacementEditor({ placement, design, updatePlacement }) {
  const name = getComponentName(placement.componentType, design.productByType);
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
    fixedModuleTypes.includes(placement.componentType) && h("label", { className: "range-field" },
      h("span", null, "标准尺寸"),
      h("select", {
        value: placement.moduleWidth || placement.standardWidth || fixedModuleWidths[0],
        onChange: (event) => {
          const moduleWidth = Number(event.target.value);
          updatePlacement(placement.id, { moduleWidth, standardWidth: moduleWidth });
        }
      },
        fixedModuleWidths.map((width) => h("option", { key: width, value: width }, `${width}mm`))
      )
    )
  );
}

function BomTable({ series, bom }) {
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
      h("span", { className: "bom-spec" }, getBomDisplaySpec(item)),
      h("span", null, getBomDisplayQuantity(item)),
      h("span", null, item.unit),
      h("span", null, formatCurrency(getBomDisplayUnitPrice(item))),
      h("span", null, formatCurrency(item.lineTotal))
    ))
  );
}

const defaultOpenBomGroups = new Set(["立柱系统", "木顶板系统", "木层板系统", "挂衣系统", "柜体系统"]);

function GroupedBomTable({ series, bom }) {
  const groups = useMemo(() => groupBomItems(bom), [bom]);
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

  return h("div", { className: "bom-table grouped-bom-table" },
    h("div", { className: "bom-head" },
      h("span", null, "名称"),
      h("span", null, "规格"),
      h("span", null, "数量"),
      h("span", null, "单位"),
      h("span", null, "单价"),
      h("span", null, "小计")
    ),
    groups.map((group) => {
      const isOpen = openGroups[group.name] ?? defaultOpenBomGroups.has(group.name);
      return h("section", { className: "bom-group", key: group.name },
        h("button", { className: "bom-group-title", type: "button", onClick: () => toggleGroup(group.name), "aria-expanded": isOpen },
          h("span", null, isOpen ? "v" : ">", " ", group.name),
          h("em", null, `${group.items.length} 项`),
          h("strong", null, formatCurrency(group.subtotal))
        ),
        isOpen && group.items.map((item) => h("div", { className: "bom-row", key: `${group.name}-${item.sku}-${item.color}-${item.note}` },
          h("span", { className: "bom-name" },
            h(ProductThumb, { series, image: item.image, name: item.nameCn }),
            h("span", null, h("strong", null, item.sku), h("em", null, item.nameCn), item.note && h("small", null, item.note))
          ),
          h("span", { className: "bom-spec" }, getBomDisplaySpec(item)),
          h("span", null, getBomDisplayQuantity(item)),
          h("span", null, item.unit),
          h("span", null, formatCurrency(getBomDisplayUnitPrice(item))),
          h("span", null, formatCurrency(item.lineTotal))
        ))
      );
    })
  );
}

function groupBomItems(bom) {
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
    group.subtotal += item.lineTotal || 0;
  });
  return Array.from(map.values())
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => normalizeSortOrder(a.sortOrder) - normalizeSortOrder(b.sortOrder) || String(a.sku).localeCompare(String(b.sku)))
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

function getBomDisplaySpec(item) {
  if (["JP-RAIL", "JP-RAIL-DOUBLE", "JP-SINGLE-RAIL", "JP-DOUBLE-RAIL"].includes(item.sku)) return "1m";
  if (item.sku === "JP-CORNER-BRACKET") return "—";
  return item.sizeRule || "—";
}

function getBomDisplayQuantity(item) {
  return item.sku === "JP-RAIL-DOUBLE" ? item.quantity * 2 : item.quantity;
}

function getBomDisplayUnitPrice(item) {
  return item.sku === "JP-RAIL-DOUBLE" ? item.unitPrice / 2 : item.unitPrice;
}

async function exportQuotationExcel({ bom, design, config, series }) {
  const exportedAt = new Date();
  const exportBom = buildQuotationExportItems(bom, design, config);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OMAX Wardrobe Configurator";
  workbook.created = exportedAt;
  const imageReport = await createStandardQuotationSheet(
    workbook,
    exportBom,
    design,
    config,
    series,
    exportedAt
  );
  createBomDetailSheet(workbook, exportBom, design);
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

function buildQuotationExportItems(bom, design, config) {
  const exportItems = bom.map((item) => ({ ...item }));
  const existingWoodSkus = new Set(exportItems
    .filter((item) => item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF")
    .map((item) => item.sku));
  const woodTypes = [
    { componentType: "woodTop", sku: "JP-WOOD-TOP", bomGroup: "木顶板系统" },
    { componentType: "woodShelf", sku: "JP-WOOD-SHELF", bomGroup: "木层板系统" }
  ];

  woodTypes.forEach(({ componentType, sku, bomGroup }) => {
    if (existingWoodSkus.has(sku)) return;
    const product = design.productByType?.[componentType];
    const quantitiesByCutLength = new Map();
    design.placements
      .filter((placement) => placement.componentType === componentType)
      .forEach((placement) => {
        const cutLength = Number(placement.componentCutLength);
        if (!Number.isFinite(cutLength) || cutLength <= 0) {
          throw new Error(`${sku} is missing componentCutLength.`);
        }
        quantitiesByCutLength.set(
          cutLength,
          (quantitiesByCutLength.get(cutLength) || 0) + Number(placement.quantity || 1)
        );
      });
    quantitiesByCutLength.forEach((quantity, componentCutLength) => {
      exportItems.push({
        ...product,
        sku,
        nameCn: product?.nameCn || (componentType === "woodTop" ? "木顶板" : "木层板"),
        componentCutLength,
        quantity,
        unit: product?.unit || "块",
        unitPrice: Number(product?.unitPrice || 0),
        lineTotal: quantity * Number(product?.unitPrice || 0),
        color: config.panelColor || "Wood Brown",
        note: "工厂剪尺",
        bomGroup
      });
    });
  });
  return exportItems;
}

async function createStandardQuotationSheet(workbook, bom, design, config, series, exportedAt) {
  const factoryCutSkus = new Set([
    "JP-WOOD-TOP",
    "JP-WOOD-SHELF",
    "JP-CABINET"
  ]);
  const normalBomItems = bom.filter((item) => !factoryCutSkus.has(item.sku));
  const factoryCutItems = bom.filter((item) => factoryCutSkus.has(item.sku));
  const sheet = workbook.addWorksheet("正式报价单", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  sheet.columns = [
    { width: 7 }, { width: 12 }, { width: 24 }, { width: 22 }, { width: 18 },
    { width: 14 }, { width: 9 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 28 }
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = "日式衣帽间（经销商价）";
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
  let itemIndex = 0;
  groupBomItems(normalBomItems).forEach((group) => {
    const groupRow = sheet.addRow([group.name]);
    sheet.mergeCells(groupRow.number, 1, groupRow.number, 12);
    styleQuotationRow(groupRow, "group");

    group.items.forEach((item) => {
      itemIndex += 1;
      const quotationDimensions = getQuotationDimensions(item, config);
      const row = sheet.addRow([
        itemIndex,
        "",
        item.sku,
        item.nameCn,
        quotationDimensions.spec,
        getExcelDisplayColor(item, config),
        getQuotationDisplayUnit(item),
        getQuotationDisplayQuantity(item),
        getQuotationDisplayUnitPrice(item),
        item.lineTotal,
        quotationDimensions.cutLength,
        item.note || ""
      ]);
      row.height = 45;
      styleQuotationRow(row, "detail");
      row.getCell(1).alignment = excelCenteredAlignment();
      row.getCell(7).alignment = excelCenteredAlignment();
      row.getCell(8).alignment = excelCenteredAlignment();
      row.getCell(9).alignment = excelRightAlignment();
      row.getCell(10).alignment = excelRightAlignment();
      row.getCell(11).alignment = excelCenteredAlignment();
      itemImageRows.push({ item, rowNumber: row.number });
    });
  });

  const totalRow = sheet.addRow([
    "", "", "", "", "", "", "", "", "合计金额",
    bom.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0), "", ""
  ]);
  totalRow.height = 24;
  styleQuotationRow(totalRow, "total");
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
    const quotationDimensions = getQuotationDimensions(item, config);
    const row = sheet.addRow([
      index + 1,
      "",
      item.sku,
      item.nameCn,
      quotationDimensions.spec,
      getExcelDisplayColor(item, config),
      getQuotationDisplayUnit(item),
      getQuotationDisplayQuantity(item),
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
    "2.以上报价不含税，不含运费，不含银行汇款手续费",
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

const quotationPieceMeasuredSkus = new Set([
  "JP-SHELF-BRACKET",
  "JP-STORAGE-BRACKET"
]);

function getQuotationDisplayUnit(item) {
  return quotationPieceMeasuredSkus.has(item.sku) ? "支" : item.unit;
}

function getQuotationDisplayQuantity(item) {
  return quotationPieceMeasuredSkus.has(item.sku)
    ? item.quantity * 2
    : getBomDisplayQuantity(item);
}

function getQuotationDisplayUnitPrice(item) {
  return quotationPieceMeasuredSkus.has(item.sku)
    ? item.unitPrice / 2
    : getBomDisplayUnitPrice(item);
}

function createBomDetailSheet(workbook, bom, design) {
  const headers = ["SKU", "名称", "规格", "数量", "单位", "单价", "小计", "备注"];
  const rows = bom.map((item) => [
    item.sku,
    item.nameCn,
    getExcelDisplaySpec(item, design),
    getBomDisplayQuantity(item),
    item.unit,
    getBomDisplayUnitPrice(item),
    item.lineTotal,
    item.note || ""
  ]);
  const sheet = workbook.addWorksheet("BOM明细");
  sheet.addRows([
    headers,
    ...rows,
    [],
    ["总计", "", "", "", "", "", bom.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0), ""]
  ]);
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

function getQuotationDimensions(item, config) {
  const cuttableSkus = new Set([
    "JP-WOOD-TOP",
    "JP-WOOD-SHELF",
    "JP-CABINET",
    "JP-RAIL",
    "JP-RAIL-DOUBLE"
  ]);
  const depth = Number(config.shelfDepth || config.depth);
  let spec = item.sizeRule || "—";

  if (item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF") {
    spec = Number.isFinite(depth) && depth > 0 ? `${depth}mm` : "—";
  } else if (item.sku === "JP-CABINET") {
    spec = Number.isFinite(depth) && depth > 0 ? `${depth}mm` : item.sizeRule || "—";
  } else if (item.sku === "JP-RAIL" || item.sku === "JP-RAIL-DOUBLE") {
    spec = "—";
  } else if (item.sku === "JP-HORIZONTAL-RAIL") {
    spec = item.sizeRule || "—";
  } else if (item.sku === "JP-CORNER-BRACKET") {
    spec = "—";
  }

  if (!cuttableSkus.has(item.sku)) return { spec, cutLength: "" };
  const rawCutLength = [item.componentCutLength, item.cutLength]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0);
  return {
    spec,
    cutLength: rawCutLength ? `${rawCutLength}mm` : ""
  };
}

function getExcelDisplaySpec(item, design) {
  if (item.sku === "JP-HORIZONTAL-RAIL") return item.sizeRule || "—";
  if (item.sku === "JP-RAIL" || item.sku === "JP-RAIL-DOUBLE") {
    const directLength = [item.componentCutLength, item.cutLength, item.visualScaleWidth]
      .map(Number)
      .find((value) => Number.isFinite(value) && value > 0);
    if (directLength) return `${directLength}mm`;

    const componentType = item.sku === "JP-RAIL" ? "singleRail" : "doubleRail";
    const cutLengths = [...new Set(design.placements
      .filter((placement) => placement.componentType === componentType)
      .map((placement) => Number(
        placement.componentCutLength
        || placement.cutLength
        || placement.visualScaleWidth
      ))
      .filter((value) => Number.isFinite(value) && value > 0))];
    if (cutLengths.length) return cutLengths.map((value) => `${value}mm`).join(" / ");
    return item.sizeRule || "—";
  }
  if (item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF") {
    if (Number.isFinite(Number(item.componentCutLength))) {
      return `${Number(item.componentCutLength)}mm`;
    }
    const componentType = item.sku === "JP-WOOD-TOP" ? "woodTop" : "woodShelf";
    const cutLengths = [...new Set(design.placements
      .filter((placement) => placement.componentType === componentType)
      .map((placement) => Number(placement.componentCutLength))
      .filter((value) => Number.isFinite(value) && value > 0))];
    if (cutLengths.length) return cutLengths.map((value) => `${value}mm`).join(" / ");
  }
  return getBomDisplaySpec(item);
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 999999;
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
    const products = await parseProductFile(file);
    persist({ ...data, products, source: "localStorage" });
  };

  const uploadRules = async (file) => {
    const rules = await parseRulesFile(file);
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

function Header({ active, series }) {
  return h("header", { className: "brand-block" },
    h("div", { className: "brand-mark" }, "OM"),
    h("div", null,
      h("h2", null, "奥美斯五金"),
      h("p", null, series.name),
      h("nav", { className: "tiny-nav" },
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

function BrandSceneCard({ brandInfo }) {
  return h("aside", { className: "scene-brand-card", "aria-label": "品牌信息" },
    h("img", { src: "/brand/logo.png", alt: brandInfo.brandNameEn || brandInfo.brandNameCn || "Brand" }),
    h("div", null,
      brandInfo.brandNameCn && h("strong", null, brandInfo.brandNameCn),
      brandInfo.brandNameEn && h("span", null, brandInfo.brandNameEn),
      brandInfo.seriesName && h("em", null, brandInfo.seriesName),
      brandInfo.phone && h("small", null, brandInfo.phone)
    )
  );
}

function loadBrandInfo(url) {
  if (typeof fetch === "function") {
    return fetch(url, { cache: "no-store" }).then((response) => response.ok ? response.json() : null);
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", `${url}?v=${Date.now()}`);
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(request.responseText));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = reject;
    request.send();
  });
}

function getLibraryComponentName(type, productByType) {
  if (type === "woodTop") return "木顶板（不含板材）";
  if (type === "woodShelf") return "木层板（不含板材）";
  if (type === "cabinet") return "柜子（不售卖）";
  return getComponentName(type, productByType);
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
