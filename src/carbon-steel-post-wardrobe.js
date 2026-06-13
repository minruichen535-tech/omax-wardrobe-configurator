import * as XLSX from "xlsx";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const workbookPath = "/products/Carbon-Steel-Post-Wardrobe/Carbon-Steel-Post-Wardrobe.xlsx";

const productFieldAliases = {
  sku: ["sku", "SKU", "productId"],
  nameCn: ["nameCn", "NameCn", "name", "名称"],
  nameEn: ["nameEn", "NameEn"],
  type: ["type", "Type"],
  heightRule: ["heightRule", "HeightRule"],
  widthRule: ["widthRule", "WidthRule"],
  widthOptions: ["widthOptions", "WidthOptions"],
  depthRule: ["depthRule", "DepthRule"],
  color: ["color", "Color", "colorOptions"],
  material: ["material", "Material"],
  unitPrice: ["unitPrice", "UnitPrice", "price"],
  unit: ["unit", "Unit"],
  modelPath: ["modelPath", "ModelPath", "glbPath", "GLBPath", "glbAssetPath", "model"],
  visible: ["visible", "Visible"],
  sellable: ["sellable", "Sellable"],
  imagePath: ["imagePath", "ImagePath", "image", "thumbnail", "Thumbnail"],
  bomGroup: ["bomGroup", "BomGroup", "BOMGroup"],
  pickMode: ["pickMode", "PickMode", "pick_mode"],
  resizeMode: ["resizeMode", "ResizeMode"],
  cuttable: ["cuttable", "Cuttable"],
  sortOrder: ["sortOrder", "SortOrder"],
  materialTexture: ["materialTexture", "MaterialTexture"]
};

const ruleFieldAliases = {
  parentSku: ["parentSku", "ParentSku", "parentSKU", "ParentSKU"],
  childSku: ["childSku", "ChildSku", "childSKU", "ChildSKU"],
  quantity: ["quantity", "Quantity", "qty", "Qty"],
  condition: ["condition", "Condition"],
  note: ["note", "Note"]
};

const requiredProductFields = new Set(["sku"]);
const requiredRuleFields = new Set(["parentSku", "childSku", "quantity", "condition"]);
const DEFAULT_POST_WIDTH = 20;
const DEFAULT_ACCESSORY_EXTRA_CUT = 4;
const CORNER_OFFSET = 510;
const BOM_ONLY_TYPES = new Set([
  "part",
  "kit",
  "accessory",
  "screw",
  "fastener",
  "hardware",
  "postaccessory",
  "postaccessoryset",
  "shelfaccessory",
  "railaccessory",
  "cabinetaccessory"
]);
const assetRoot = "/products/Carbon-Steel-Post-Wardrobe";
const modelLoader = new GLTFLoader();
const modelCache = new Map();
let pendingPointerDragSku = "";

const state = {
  productsBySku: {},
  rules: [],
  settings: {},
  warnings: [],
  placements: [],
  selectedPlacementId: "",
  productSearch: "",
  productTypeFilter: "",
  quoteBom: [],
  pickBom: [],
  totalPrice: 0,
  modelValidation: {
    checked: 0,
    missing: []
  },
  bomDebug: {
    selectedSkus: [],
    matchedRules: [],
    expandedChildren: [],
    finalQuoteBom: [],
    pickMatchedRules: [],
    kitExpansions: [],
    finalPickBom: []
  },
  parameters: {
    roomWidth: 3600,
    roomDepth: 2800,
    bayCount: 4,
    sideBayCount: 3,
    layout: "I",
    uLayoutMode: "back-first",
    POST_WIDTH: DEFAULT_POST_WIDTH,
    ACCESSORY_EXTRA_CUT: DEFAULT_ACCESSORY_EXTRA_CUT
  },
  design: {
    walls: [],
    bays: []
  },
  formulaResults: {
    bayWidth: 0,
    bayWidthMinus4: 0
  }
};

window.carbonSteelPostWardrobeData = state;

bindParameterInputs();
bindLayoutControls();
bindBomActions();
const sceneController = createSceneController(document.querySelector("#three-viewer"));
loadWorkbook();

async function loadWorkbook() {
  document.querySelector("#source-path").textContent = workbookPath;

  try {
    const response = await fetch(`${workbookPath}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`无法读取 Excel：HTTP ${response.status}`);
    }

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const productsRows = readNamedSheet(workbook, "Products");
    const rulesRows = readNamedSheet(workbook, "Rules");
    const settingsRows = readNamedSheet(workbook, "Settings");

    validateFields("Products", productsRows, productFieldAliases, requiredProductFields);
    validateFields("Rules", rulesRows, ruleFieldAliases, requiredRuleFields);

    state.productsBySku = buildProductsBySku(productsRows);
    state.settings = buildSettings(settingsRows);
    applySettings();
    state.rules = rulesRows
      .map((row, index) => normalizeRule(row, index + 2))
      .filter((rule) => rule.parentSku || rule.childSku);
    validateRuleReferences(state.rules, state.productsBySku);
    validateWidthRules(state.productsBySku);

    updateCalculations();
    render();
    await validateModelPaths();
    await sceneController.sync();
    const missingCount = state.modelValidation.missing.length;
    setStatus(
      missingCount
        ? `读取完成，缺失模型 ${missingCount} 个`
        : `读取完成：${Object.keys(state.productsBySku).length} 个产品，模型完整`,
      missingCount ? "error" : "success"
    );
  } catch (error) {
    addWarning(error.message);
    render();
    setStatus("Excel 读取失败", "error");
    console.error("[carbon-steel-post-wardrobe]", error);
  }
}

function readNamedSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    addWarning(`缺少名为 "${sheetName}" 的 sheet；未使用第一个 sheet 作为 fallback。`);
    return [];
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function validateFields(sheetName, rows, aliases, requiredFields) {
  if (!rows.length) {
    addWarning(`${sheetName} sheet 没有可读取的数据行。`);
    return;
  }

  const headers = new Set(Object.keys(rows[0]).map(normalizeHeader));
  for (const field of requiredFields) {
    const found = aliases[field].some((alias) => headers.has(normalizeHeader(alias)));
    if (!found) {
      addWarning(`${sheetName} sheet 缺少必需字段 "${field}"，兼容名称：${aliases[field].join(", ")}。`);
    }
  }
}

function buildProductsBySku(rows) {
  const productsBySku = {};

  rows.forEach((row, index) => {
    const product = normalizeRow(row, productFieldAliases, "Products", index + 2);
    if (!product.sku) {
      addWarning(`Products 第 ${index + 2} 行缺少 sku，已跳过。`);
      return;
    }
    if (productsBySku[product.sku]) {
      addWarning(`Duplicate SKU found: ${product.sku}`);
    }
    product.sku = product.sku.trim();
    product.type = product.type.trim();
    product.pickMode = String(product.pickMode).trim();
    product.modelPath = normalizeAssetPath(product.modelPath, "models");
    product.imagePath = normalizeAssetPath(product.imagePath, "images");
    productsBySku[product.sku] = product;
  });

  return productsBySku;
}

function buildSettings(rows) {
  return Object.fromEntries(rows
    .map((row) => [
      String(row.key ?? row.Key ?? "").trim(),
      normalizeValue(row.value ?? row.Value ?? "")
    ])
    .filter(([key]) => key));
}

function applySettings() {
  const postWidth = getNumericSetting(["POST_WIDTH"], DEFAULT_POST_WIDTH);
  const accessoryExtraCut = getNumericSetting(
    ["ACCESSORY-EXTRA-CUT", "ACCESSORY_EXTRA_CUT"],
    DEFAULT_ACCESSORY_EXTRA_CUT
  );
  state.parameters.POST_WIDTH = postWidth;
  state.parameters.ACCESSORY_EXTRA_CUT = accessoryExtraCut;
  document.querySelector("#post-width").value = String(postWidth);
  document.querySelector("#accessory-extra-cut").value = String(accessoryExtraCut);
}

function getNumericSetting(keys, fallback) {
  const entry = Object.entries(state.settings).find(([key]) =>
    keys.some((candidate) => normalizeHeader(key) === normalizeHeader(candidate))
  );
  const value = Number(entry?.[1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeRow(row, aliases) {
  const normalized = {};
  const sourceKeys = new Map(Object.keys(row).map((key) => [normalizeHeader(key), key]));

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const sourceKey = fieldAliases
      .map((alias) => sourceKeys.get(normalizeHeader(alias)))
      .find(Boolean);
    normalized[field] = sourceKey ? normalizeValue(row[sourceKey]) : "";
  }

  return normalized;
}

function normalizeRule(row, rowNumber) {
  const rule = normalizeRow(row, ruleFieldAliases);
  rule.parentSku = String(rule.parentSku).trim();
  rule.childSku = String(rule.childSku).trim();
  rule.condition = String(rule.condition).trim() || "always";

  const quantity = String(rule.quantity ?? "").trim();
  if (!quantity) {
    addWarning(`Rules 第 ${rowNumber} 行 quantity 为空。`);
    rule.quantity = "";
  } else if (isNumericString(quantity)) {
    rule.quantity = Number(quantity);
  } else {
    rule.quantity = quantity;
  }

  return rule;
}

function validateRuleReferences(rules, productsBySku) {
  const productTypes = new Set(
    Object.values(productsBySku)
      .map((product) => product.type)
      .filter(Boolean)
  );

  rules.forEach((rule) => {
    if (rule.childSku && !productsBySku[rule.childSku]) {
      addWarning(`Rule childSku not found in Products: ${rule.childSku}`);
    }

    if (!rule.parentSku) return;
    if (rule.parentSku.startsWith("type:")) {
      const parentType = rule.parentSku.slice("type:".length).trim();
      if (!productTypes.has(parentType)) {
        addWarning(`Rule parentSku type not found in Products: ${rule.parentSku}`);
      }
      return;
    }

    if (!productsBySku[rule.parentSku]) {
      addWarning(`Rule parentSku not found in Products: ${rule.parentSku}`);
    }
  });
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/[\s_-]/g, "").toLowerCase();
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : value ?? "";
}

function isNumericString(value) {
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value);
}

function normalizeAssetPath(value, directory) {
  const path = String(value ?? "").trim().replace(/\\/g, "/");
  if (!path || path.startsWith(`${directory}/`) || path.includes("/")) return path;
  return `${directory}/${path}`;
}

function bindParameterInputs() {
  document.querySelector("#room-width").addEventListener("input", handleParameterInput);
  document.querySelector("#room-depth").addEventListener("input", handleParameterInput);
  document.querySelector("#bay-count").addEventListener("input", handleParameterInput);
  document.querySelector("#side-bay-count").addEventListener("input", handleParameterInput);
}

function handleParameterInput() {
  state.parameters.roomWidth = numberFromInput("#room-width");
  state.parameters.roomDepth = numberFromInput("#room-depth");
  state.parameters.bayCount = numberFromInput("#bay-count");
  state.parameters.sideBayCount = numberFromInput("#side-bay-count");
  updateCalculations();
  renderParameterResults();
  renderTable(
    "#products-table",
    Object.values(state.productsBySku),
    [...Object.keys(productFieldAliases), "calculatedWidth"]
  );
  recalculateQuoteBom();
  renderBomSections();
  sceneController.sync();
}

function bindLayoutControls() {
  document.querySelector("#layout-control").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-layout]");
    if (!button) return;
    state.parameters.layout = button.dataset.layout;
    renderLayoutControls();
    updateCalculations();
    syncConfiguration();
  });
  document.querySelector("#u-layout-control").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-u-layout-mode]");
    if (!button) return;
    state.parameters.uLayoutMode = button.dataset.uLayoutMode;
    renderLayoutControls();
    updateCalculations();
    syncConfiguration();
  });
}

function renderLayoutControls() {
  document.querySelectorAll("[data-layout]").forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === state.parameters.layout);
  });
  document.querySelectorAll("[data-u-layout-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.uLayoutMode === state.parameters.uLayoutMode);
  });
  const isU = state.parameters.layout === "U";
  document.querySelector("#u-layout-control").hidden = !isU;
  document.querySelector("#side-bay-field").hidden = state.parameters.layout === "I";
}

function numberFromInput(selector) {
  const value = Number(document.querySelector(selector).value);
  return Number.isFinite(value) ? value : 0;
}

function updateCalculations() {
  const { roomWidth, bayCount, POST_WIDTH, ACCESSORY_EXTRA_CUT } = state.parameters;
  const bayWidth = bayCount > 0
    ? (roomWidth - (bayCount * POST_WIDTH * 2)) / bayCount
    : NaN;
  const bayWidthMinus4 = Number.isFinite(bayWidth)
    ? bayWidth - ACCESSORY_EXTRA_CUT
    : NaN;

  state.formulaResults = { bayWidth, bayWidthMinus4 };
  state.design = buildCarbonDesign();
  Object.values(state.productsBySku).forEach((product) => {
    product.calculatedWidth = calculateProductWidth(product.widthRule, state.formulaResults);
  });
  state.placements.forEach((placement) => {
    const bay = findBay(placement.wallId, placement.bayIndex) || getDefaultBay();
    if (!bay) return;
    placement.wallId = bay.wallId;
    placement.bayIndex = bay.bayIndex;
    placement.heightFromFloor = clampPlacementHeight(placement.heightFromFloor);
  });
}

function buildCarbonDesign() {
  const {
    roomWidth,
    roomDepth,
    bayCount,
    sideBayCount,
    layout,
    uLayoutMode,
    POST_WIDTH,
    ACCESSORY_EXTRA_CUT
  } = state.parameters;
  const plans = [];
  const addPlan = (id, length, count, startOffset = 0, endOffset = 0) => {
    const safeLength = Math.max(1, length - startOffset - endOffset);
    plans.push({ id, length: safeLength, sourceLength: length, bayCount: Math.max(1, count), startOffset, endOffset });
  };

  if (layout === "U" && uLayoutMode === "side-first") {
    addPlan("left", roomDepth, sideBayCount);
    addPlan("right", roomDepth, sideBayCount);
    addPlan("back", roomWidth, bayCount, CORNER_OFFSET, CORNER_OFFSET);
  } else {
    addPlan("back", roomWidth, bayCount);
    if (layout === "L-left" || layout === "U") addPlan("left", roomDepth, sideBayCount, CORNER_OFFSET, 0);
    if (layout === "L-right" || layout === "U") addPlan("right", roomDepth, sideBayCount, CORNER_OFFSET, 0);
  }

  const walls = plans.map((plan) => {
    const groupWidth = plan.length / plan.bayCount;
    const bayWidth = groupWidth - POST_WIDTH * 2;
    const accessoryWidth = bayWidth - ACCESSORY_EXTRA_CUT;
    const bays = Array.from({ length: plan.bayCount }, (_, bayIndex) => {
      const groupStart = bayIndex * groupWidth;
      return {
        wallId: plan.id,
        bayIndex,
        leftPost: groupStart + POST_WIDTH / 2,
        rightPost: groupStart + groupWidth - POST_WIDTH / 2,
        centerX: groupStart + groupWidth / 2,
        groupWidth,
        bayWidth,
        accessoryWidth
      };
    });
    return { ...plan, groupWidth, bayWidth, accessoryWidth, bays };
  });
  return { walls, bays: walls.flatMap((wall) => wall.bays) };
}

function findBay(wallId, bayIndex) {
  return state.design.bays.find((bay) =>
    bay.wallId === wallId && bay.bayIndex === Number(bayIndex)
  );
}

function getDefaultBay() {
  return state.design.walls[0]?.bays[0] || null;
}

function getPlacementWidth(product, bay) {
  if (!bay) return numericWidth(product?.calculatedWidth);
  if (!isStretchable(product)) return numericWidth(product?.calculatedWidth);
  const width = String(product.widthRule || "").trim() === "bayWidth"
    ? bay.bayWidth
    : bay.accessoryWidth;
  return Number(width.toFixed(3));
}

function getDefaultPlacementHeight(product) {
  if (product?.type === "rail") return 1600;
  if (product?.type === "shelf") return 1200;
  if (product?.type === "cabinet") return 300;
  return 0;
}

function clampPlacementHeight(value) {
  const height = Number(value);
  const maxHeight = getBasePostHeightMeters() * 1000;
  return Math.max(0, Math.min(Number.isFinite(height) ? height : 0, maxHeight));
}

function calculateProductWidth(widthRule, formulaResults) {
  const rule = String(widthRule ?? "").trim();
  if (!rule || rule === "none") return "-";
  if (rule === "bayWidth") return formatMeasurement(formulaResults.bayWidth);
  if (rule === "bayWidthMinus4") return formatMeasurement(formulaResults.bayWidthMinus4);
  if (rule.startsWith("fixed:")) {
    const fixedWidth = rule.slice("fixed:".length).trim();
    return isNumericString(fixedWidth) ? Number(fixedWidth) : "-";
  }
  return "-";
}

function validateWidthRules(productsBySku) {
  Object.values(productsBySku).forEach((product) => {
    const rule = String(product.widthRule ?? "").trim();
    if (!rule || rule === "none" || rule === "bayWidth" || rule === "bayWidthMinus4") return;
    if (rule.startsWith("fixed:") && isNumericString(rule.slice("fixed:".length).trim())) return;
    if (rule === "spanPostsInner:first-last") {
      addWarning(`widthRule not implemented: ${rule} on SKU ${product.sku}`);
      return;
    }
    addWarning(`Unknown widthRule: ${rule} on SKU ${product.sku}`);
  });
}

function bindBomActions() {
  document.querySelector("#product-picker").addEventListener("click", handleProductPickerClick);
  document.querySelector("#product-picker").addEventListener("dragstart", handleProductDragStart);
  document.querySelector("#product-picker").addEventListener("pointerdown", handleProductPointerDown);
  document.addEventListener("pointerup", handleProductPointerUp);
  document.querySelector("#selected-items").addEventListener("click", handleSelectedItemsClick);
  document.querySelector("#selected-items").addEventListener("input", handleSelectedItemInput);
  document.querySelector("#clear-selected").addEventListener("click", () => {
    state.placements = [];
    state.selectedPlacementId = "";
    syncConfiguration();
  });
}

function handleProductPointerDown(event) {
  if (event.target.closest("button")) return;
  pendingPointerDragSku = event.target.closest("[data-sku]")?.dataset.sku || "";
}

function handleProductPointerUp(event) {
  if (!pendingPointerDragSku) return;
  const sku = pendingPointerDragSku;
  pendingPointerDragSku = "";
  if (!document.elementFromPoint(event.clientX, event.clientY)?.closest("#three-viewer")) return;
  sceneController.addAtClientPoint(sku, event.clientX, event.clientY);
}

function handleProductDragStart(event) {
  const card = event.target.closest("[data-sku]");
  if (!card?.dataset.sku) return;
  event.dataTransfer.setData("text/plain", card.dataset.sku);
  event.dataTransfer.effectAllowed = "copy";
}

function handleSelectedItemInput(event) {
  const heightInput = event.target.closest("input[data-placement-height][data-placement-id]");
  if (heightInput) {
    updatePlacement(heightInput.dataset.placementId, {
      heightFromFloor: clampPlacementHeight(heightInput.value)
    });
  }
}

function addPlacement(sku, bay = null) {
  const product = state.productsBySku[sku];
  if (!isConfigurableProduct(product)) return;
  const targetBay = bay || getDefaultBay();
  if (!targetBay) return;
  const placement = {
    id: `placement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productSku: sku,
    wallId: targetBay.wallId,
    bayIndex: targetBay.bayIndex,
    heightFromFloor: getDefaultPlacementHeight(product),
    quantity: 1,
    customWidth: null
  };
  state.placements.push(placement);
  state.selectedPlacementId = placement.id;
  syncConfiguration();
}

function findPlacement(placementId) {
  return state.placements.find((placement) => placement.id === placementId);
}

function getSelectedPlacement() {
  return findPlacement(state.selectedPlacementId);
}

function getSelectedQuantities() {
  const quantities = new Map();
  state.placements.forEach((placement) => {
    quantities.set(
      placement.productSku,
      (quantities.get(placement.productSku) || 0) + placement.quantity
    );
  });
  return quantities;
}

function selectPlacement(placementId) {
  if (!findPlacement(placementId)) return;
  state.selectedPlacementId = placementId;
  renderSelectedItems();
  sceneController.sync();
}

function updatePlacement(placementId, patch) {
  const placement = findPlacement(placementId);
  if (!placement) return;
  Object.assign(placement, patch);
  placement.heightFromFloor = clampPlacementHeight(placement.heightFromFloor);
  syncConfiguration();
}

function removePlacement(placementId) {
  state.placements = state.placements.filter((placement) => placement.id !== placementId);
  if (state.selectedPlacementId === placementId) {
    state.selectedPlacementId = "";
  }
  syncConfiguration();
}

function movePlacementToAdjacentBay(placementId, delta) {
  const placement = findPlacement(placementId);
  if (!placement) return;
  const bays = state.design.bays;
  const currentIndex = bays.findIndex((bay) =>
    bay.wallId === placement.wallId && bay.bayIndex === placement.bayIndex
  );
  const nextBay = bays[Math.max(0, Math.min(bays.length - 1, currentIndex + delta))];
  if (!nextBay) return;
  updatePlacement(placementId, {
    wallId: nextBay.wallId,
    bayIndex: nextBay.bayIndex
  });
}

function syncConfiguration() {
  renderParameterResults();
  recalculateQuoteBom();
  renderBomSections();
  sceneController.sync();
}

function handleProductPickerClick(event) {
  const card = event.target.closest("[data-sku]");
  if (!card) return;
  addPlacement(card.dataset.sku);
}

function handleSelectedItemsClick(event) {
  const button = event.target.closest("button[data-action][data-placement-id]");
  if (!button) return;
  const { action, placementId } = button.dataset;
  if (action === "select") selectPlacement(placementId);
  if (action === "previous-bay") movePlacementToAdjacentBay(placementId, -1);
  if (action === "next-bay") movePlacementToAdjacentBay(placementId, 1);
  if (action === "remove") removePlacement(placementId);
}

function recalculateQuoteBom() {
  const quantitiesBySku = new Map();
  const debug = {
    selectedSkus: Array.from(getSelectedQuantities().entries()).map(([sku, quantity]) => ({ sku, quantity })),
    matchedRules: [],
    expandedChildren: [],
    finalQuoteBom: [],
    pickMatchedRules: [],
    kitExpansions: [],
    finalPickBom: []
  };
  const formulaContext = buildFormulaContext();
  const conditionContext = buildConditionContext(formulaContext);

  getSelectedQuantities().forEach((quantity, sku) => {
    expandBomItem({
      sku,
      quantity,
      quantitiesBySku,
      debug,
      formulaContext,
      conditionContext,
      path: []
    });
  });

  state.quoteBom = Array.from(quantitiesBySku.entries()).map(([sku, quantity]) => {
    const product = state.productsBySku[sku];
    const unitPrice = parseUnitPrice(product);
    return {
      sku,
      nameCn: product?.nameCn || "",
      type: product?.type || "",
      quantity: normalizeQuantityResult(quantity),
      unitPrice,
      subtotal: normalizeQuantityResult(quantity * unitPrice),
      bomGroup: product?.bomGroup || "",
      calculatedWidth: getBomDisplayWidth(sku, product)
    };
  });
  state.totalPrice = state.quoteBom.reduce((sum, item) => sum + item.subtotal, 0);
  debug.finalQuoteBom = state.quoteBom.map((item) => ({
    sku: item.sku,
    quantity: item.quantity,
    subtotal: item.subtotal
  }));
  calculatePickBom(debug, formulaContext, conditionContext);
  state.bomDebug = debug;
}

function calculatePickBom(debug, formulaContext, conditionContext) {
  const quantitiesBySku = new Map();

  getSelectedQuantities().forEach((quantity, sku) => {
    expandPickItem({
      sku,
      quantity,
      quantitiesBySku,
      debug,
      formulaContext,
      conditionContext,
      path: []
    });
  });

  state.pickBom = Array.from(quantitiesBySku.entries()).map(([sku, quantity]) => {
    const product = state.productsBySku[sku];
    return {
      sku,
      nameCn: product?.nameCn || "",
      type: product?.type || "",
      quantity: normalizeQuantityResult(quantity),
      unit: product?.unit || "",
      bomGroup: product?.bomGroup || "",
      calculatedWidth: getBomDisplayWidth(sku, product)
    };
  });
  debug.finalPickBom = state.pickBom.map((item) => ({
    sku: item.sku,
    quantity: item.quantity
  }));
}

function expandPickItem({
  sku,
  quantity,
  quantitiesBySku,
  debug,
  formulaContext,
  conditionContext,
  path
}) {
  if (!Number.isFinite(quantity) || quantity === 0) return;
  const product = state.productsBySku[sku];
  if (!product) {
    addWarning(`Rule childSku not found in Products: ${sku}`);
    return;
  }

  if (path.includes(sku)) {
    addWarning(`Recursive Pick BOM cycle detected: ${[...path, sku].join(" -> ")}`);
    return;
  }

  const shouldExplode = product.type === "kit" || product.pickMode === "explode";
  if (!shouldExplode) {
    quantitiesBySku.set(sku, (quantitiesBySku.get(sku) || 0) + quantity);
  }

  const matchedRules = [];
  state.rules.forEach((rule, ruleIndex) => {
    if (!ruleMatchesProduct(rule, product)) return;
    if (!evaluateCondition(rule.condition, conditionContext, ruleIndex)) return;

    const ruleQuantity = evaluateQuantity(rule.quantity, formulaContext, ruleIndex);
    if (!Number.isFinite(ruleQuantity)) return;
    matchedRules.push({ rule, ruleIndex, ruleQuantity });
  });

  if (shouldExplode && matchedRules.length === 0) {
    addWarning(`Kit SKU has no pick children: ${sku}`);
    return;
  }

  const nextPath = [...path, sku];
  matchedRules.forEach(({ rule, ruleIndex, ruleQuantity }) => {
    if (!isSingleChildSku(rule.childSku)) {
      addWarning(`Pick BOM childSku must contain one SKU on Rules row ${ruleIndex + 2}: ${rule.childSku}`);
      return;
    }
    const childQuantity = quantity * ruleQuantity;
    debug.pickMatchedRules.push({
      ruleIndex: ruleIndex + 2,
      parentSku: rule.parentSku,
      matchedSku: sku,
      childSku: rule.childSku,
      quantity: rule.quantity,
      condition: rule.condition
    });
    if (shouldExplode) {
      debug.kitExpansions.push({
        kitSku: sku,
        childSku: rule.childSku,
        parentQuantity: normalizeQuantityResult(quantity),
        ruleQuantity,
        childQuantity: normalizeQuantityResult(childQuantity)
      });
    }

    if (!state.productsBySku[rule.childSku]) {
      addWarning(`Rule childSku not found in Products: ${rule.childSku}`);
      return;
    }

    expandPickItem({
      sku: rule.childSku,
      quantity: childQuantity,
      quantitiesBySku,
      debug,
      formulaContext,
      conditionContext,
      path: nextPath
    });
  });
}

function expandBomItem({
  sku,
  quantity,
  quantitiesBySku,
  debug,
  formulaContext,
  conditionContext,
  path
}) {
  if (!Number.isFinite(quantity) || quantity === 0) return;
  const product = state.productsBySku[sku];
  if (!product) {
    addWarning(`Rule childSku not found in Products: ${sku}`);
    return;
  }

  quantitiesBySku.set(sku, (quantitiesBySku.get(sku) || 0) + quantity);

  if (path.includes(sku)) {
    addWarning(`Recursive BOM cycle detected: ${[...path, sku].join(" -> ")}`);
    return;
  }

  const nextPath = [...path, sku];
  state.rules.forEach((rule, ruleIndex) => {
    if (!ruleMatchesProduct(rule, product)) return;
    if (!evaluateCondition(rule.condition, conditionContext, ruleIndex)) return;

    const ruleQuantity = evaluateQuantity(rule.quantity, formulaContext, ruleIndex);
    if (!Number.isFinite(ruleQuantity)) return;
    const childQuantity = quantity * ruleQuantity;
    debug.matchedRules.push({
      ruleIndex: ruleIndex + 2,
      parentSku: rule.parentSku,
      matchedSku: sku,
      childSku: rule.childSku,
      quantity: rule.quantity,
      condition: rule.condition
    });
    debug.expandedChildren.push({
      parentSku: sku,
      childSku: rule.childSku,
      quantity: normalizeQuantityResult(childQuantity)
    });

    if (!state.productsBySku[rule.childSku]) {
      addWarning(`Rule childSku not found in Products: ${rule.childSku}`);
      return;
    }

    expandBomItem({
      sku: rule.childSku,
      quantity: childQuantity,
      quantitiesBySku,
      debug,
      formulaContext,
      conditionContext,
      path: nextPath
    });
  });
}

function ruleMatchesProduct(rule, product) {
  if (rule.parentSku.startsWith("type:")) {
    return product.type === rule.parentSku.slice("type:".length).trim();
  }
  return product.sku === rule.parentSku;
}

function buildFormulaContext() {
  const configuredTotalPosts = Number(
    state.settings.totalPosts ?? state.settings.TOTAL_POSTS
  );
  const totalPosts = Number.isFinite(configuredTotalPosts) && configuredTotalPosts > 0
    ? configuredTotalPosts
    : state.design.bays.length * 2;
  return {
    bayCount: state.parameters.bayCount,
    totalPosts,
    spanPostCount: totalPosts
  };
}

function buildConditionContext(formulaContext) {
  return {
    ...state.settings,
    ...state.parameters,
    ...state.formulaResults,
    ...formulaContext,
    connectionMode: state.settings.defaultConnectionMode || state.settings.connectionMode || ""
  };
}

function evaluateCondition(condition, context, ruleIndex) {
  const expression = String(condition ?? "").trim();
  if (!expression || expression === "always") return true;

  const match = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);
  if (!match) {
    addWarning(`Unsupported condition on Rules row ${ruleIndex + 2}: ${expression}`);
    return false;
  }

  const [, key, operator, rawExpected] = match;
  const actual = context[key];
  const expected = stripQuotes(rawExpected.trim());
  if (actual === undefined) {
    addWarning(`Condition variable not found on Rules row ${ruleIndex + 2}: ${key}`);
    return false;
  }

  const numericComparison = isNumericString(String(actual)) && isNumericString(expected);
  const left = numericComparison ? Number(actual) : String(actual);
  const right = numericComparison ? Number(expected) : expected;

  if (operator === "=" || operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  return false;
}

function evaluateQuantity(quantity, context, ruleIndex) {
  if (typeof quantity === "number") return quantity;
  const expression = String(quantity ?? "").trim();
  if (!expression) {
    addWarning(`Rules row ${ruleIndex + 2} quantity is empty.`);
    return NaN;
  }
  if (isNumericString(expression)) return Number(expression);

  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|[+-]?(?:\d+\.?\d*|\.\d+)|[+-]/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== expression.replace(/\s/g, "")) {
    addWarning(`Unsupported quantity formula on Rules row ${ruleIndex + 2}: ${expression}`);
    return NaN;
  }

  let result = 0;
  let operator = "+";
  for (const token of tokens) {
    if (token === "+" || token === "-") {
      operator = token;
      continue;
    }
    const value = isNumericString(token) ? Number(token) : Number(context[token]);
    if (!Number.isFinite(value)) {
      addWarning(`Quantity variable not found on Rules row ${ruleIndex + 2}: ${token}`);
      return NaN;
    }
    result = operator === "+" ? result + value : result - value;
  }
  return result;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isSingleChildSku(childSku) {
  return !/[+,]/.test(String(childSku ?? ""));
}

function parseUnitPrice(product) {
  const value = String(product?.unitPrice ?? "").trim();
  if (!isNumericString(value)) {
    addWarning(`Invalid unitPrice on SKU ${product?.sku || ""}: ${value || "(empty)"}`);
    return 0;
  }
  return Number(value);
}

function normalizeQuantityResult(value) {
  return Number(value.toFixed(6));
}

function addWarning(message) {
  if (state.warnings.includes(message)) return;
  state.warnings.push(message);
  console.warn(`[carbon-steel-post-wardrobe] ${message}`);
  if (document.querySelector("#warnings")) renderWarnings();
}

function render() {
  const products = Object.values(state.productsBySku);
  document.querySelector("#products-count").textContent = String(products.length);
  document.querySelector("#sku-count").textContent = String(Object.keys(state.productsBySku).length);
  document.querySelector("#rules-count").textContent = String(state.rules.length);

  renderWarnings();
  renderLayoutControls();
  renderParameterResults();
  recalculateQuoteBom();
  renderBomSections();
  renderSettings();
  renderTable("#products-table", products, [...Object.keys(productFieldAliases), "calculatedWidth"]);
  renderTable("#rules-table", state.rules, Object.keys(ruleFieldAliases));
  sceneController.sync();
}

function renderBomSections() {
  renderProductPicker();
  renderSelectedItems();
  renderQuoteBom();
  renderPickBom();
  document.querySelector("#placement-count").textContent = `${state.placements.length} 件`;
  document.querySelector("#total-price").textContent =
    `totalPrice = ${formatMoney(state.totalPrice)}`;
  document.querySelector("#bom-debug").textContent = JSON.stringify(state.bomDebug, null, 2);
  document.querySelector("#viewer-empty").hidden = state.placements.length > 0;
  renderWarnings();
}

function renderProductPicker() {
  const container = document.querySelector("#product-picker");
  const cards = getLibraryComponents()
    .map((product) => {
    const card = document.createElement("article");
    card.className = "component-card";
    card.draggable = true;
    card.role = "button";
    card.tabIndex = 0;
    card.title = `点击或拖入场景添加${product.nameCn || "组件"}`;
    card.dataset.sku = product.sku;
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      addPlacement(product.sku);
    });
    const media = createProductMedia(product);
    const name = document.createElement("strong");
    name.className = "component-name";
    name.textContent = product.nameCn || product.sku;
    card.append(media, name);
    return card;
  });
  if (!cards.length) {
    container.innerHTML = '<p class="empty-state">没有匹配的产品。</p>';
    return;
  }
  container.replaceChildren(...cards);
}

function getLibraryComponents() {
  return getConfigurableProducts().filter((product) => {
    const type = String(product.type || "").trim().toLowerCase();
    const searchable = `${product.sku} ${product.nameCn} ${product.nameEn} ${type}`.toLowerCase();
    if (type === "post") return false;
    if (BOM_ONLY_TYPES.has(type)) return false;
    if (/(post|立柱|螺丝|紧固件|五金|调节脚|连接件|托臂|衣通座|led|transformer|变压器)/i.test(searchable)) return false;
    return true;
  });
}

function getConfigurableProducts() {
  return Object.values(state.productsBySku)
    .filter(isConfigurableProduct)
    .sort((left, right) =>
      (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0)
      || left.sku.localeCompare(right.sku)
    );
}

function isConfigurableProduct(product) {
  if (!product?.modelPath) return false;
  if (parseBoolean(product.visible, true) === false) return false;
  return !BOM_ONLY_TYPES.has(String(product.type || "").trim().toLowerCase());
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

function createProductMedia(product) {
  const media = document.createElement("div");
  media.className = "component-image";
  if (!product.imagePath) {
    media.append(createImageFallback());
    addWarning(`Product image not found: ${product.sku}`);
    return media;
  }
  const image = document.createElement("img");
  image.src = resolveAssetUrl(product.imagePath);
  image.alt = product.nameCn || product.sku;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    addWarning(`Product image failed to load: ${product.sku}`);
    media.replaceChildren(createImageFallback());
  }, { once: true });
  media.append(image);
  return media;
}

function createImageFallback() {
  const fallback = document.createElement("span");
  fallback.className = "product-image-fallback";
  fallback.textContent = "NO IMAGE";
  return fallback;
}

function renderSelectedItems() {
  const container = document.querySelector("#selected-items");
  container.classList.add("placement-panel");
  if (!state.placements.length) {
    container.innerHTML = '<p class="empty-state">尚未添加产品。</p>';
    return;
  }
  const selectedPlacement = getSelectedPlacement();
  const editor = selectedPlacement ? createPlacementEditor(selectedPlacement) : null;
  const list = document.createElement("div");
  list.className = "placement-list";
  list.append(...state.placements.map((placement) => createPlacementRow(placement)));
  container.replaceChildren(...[editor, list].filter(Boolean));
}

function createPlacementEditor(placement) {
  const product = state.productsBySku[placement.productSku];
  const editor = document.createElement("article");
  editor.className = "placement-editor";

  const heading = document.createElement("div");
  heading.className = "placement-editor-heading";
  const name = document.createElement("strong");
  name.textContent = product?.nameCn || placement.productSku;
  const location = document.createElement("span");
  location.textContent = `${labelWall(placement.wallId)} 第 ${placement.bayIndex + 1} 跨`;
  heading.append(name, location);

  const heightControl = document.createElement("label");
  heightControl.className = "placement-range";
  const heightInput = document.createElement("input");
  heightInput.type = "range";
  heightInput.min = "0";
  heightInput.max = String(getBasePostHeightMeters() * 1000);
  heightInput.step = "10";
  heightInput.value = String(placement.heightFromFloor);
  heightInput.dataset.placementHeight = "true";
  heightInput.dataset.placementId = placement.id;
  const heightValue = document.createElement("strong");
  heightValue.textContent = `离地 ${placement.heightFromFloor} mm`;
  heightControl.append(heightInput, heightValue);

  const actions = document.createElement("div");
  actions.className = "placement-editor-actions";
  actions.append(
    createButton("上一跨", { action: "previous-bay", placementId: placement.id }),
    createButton("下一跨", { action: "next-bay", placementId: placement.id }),
    createButton("删除", { action: "remove", placementId: placement.id })
  );

  editor.append(heading, heightControl);
  editor.append(actions);
  return editor;
}

function createPlacementRow(placement) {
  const product = state.productsBySku[placement.productSku];
  const row = document.createElement("button");
  row.type = "button";
  row.className = `placement-row${placement.id === state.selectedPlacementId ? " selected" : ""}`;
  row.dataset.action = "select";
  row.dataset.placementId = placement.id;
  const name = document.createElement("strong");
  name.textContent = product?.nameCn || placement.productSku;
  const location = document.createElement("span");
  location.textContent =
    `${labelWall(placement.wallId)} / 第 ${placement.bayIndex + 1} 跨 / 离地 ${placement.heightFromFloor}mm`;
  row.append(name, location);
  return row;
}

function getPlacementDisplayWidth(placement) {
  const product = state.productsBySku[placement.productSku];
  const bay = findBay(placement.wallId, placement.bayIndex);
  return placement.customWidth ?? getPlacementWidth(product, bay);
}

function getBomDisplayWidth(sku, product) {
  const widths = state.placements
    .filter((placement) => placement.productSku === sku)
    .map((placement) => numericWidth(getPlacementDisplayWidth(placement)))
    .filter((value) => Number.isFinite(value));
  if (!widths.length) return product?.calculatedWidth ?? "-";
  return [...new Set(widths)].join(", ");
}

function numericWidth(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isStretchable(product) {
  return ["stretchToBay", "stretchX", "scaleX"].includes(String(product?.resizeMode || "").trim());
}

function formatVector(vector) {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function renderQuoteBom() {
  renderTable("#quote-bom", state.quoteBom, [
    "sku",
    "nameCn",
    "type",
    "quantity",
    "unitPrice",
    "subtotal",
    "bomGroup",
    "calculatedWidth"
  ]);
}

function renderSettings() {
  const rows = Object.entries(state.settings).map(([key, value]) => ({ key, value }));
  renderTable("#settings-table", rows, ["key", "value"]);
}

function renderPickBom() {
  renderTable("#pick-bom", state.pickBom, [
    "sku",
    "nameCn",
    "type",
    "quantity",
    "unit",
    "bomGroup",
    "calculatedWidth"
  ]);
}

function renderActionTable(selector, rows, columns, createAction) {
  const container = document.querySelector(selector);
  if (!rows.length) {
    container.innerHTML = '<p class="empty-state">没有可显示的数据。</p>';
    return;
  }

  const table = document.createElement("table");
  const headRow = document.createElement("tr");
  const body = document.createElement("tbody");
  columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.textContent = column;
    headRow.append(cell);
  });
  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      if (column === "action" || column === "actions") cell.append(createAction(row));
      else cell.textContent = formatCell(row[column]);
      tableRow.append(cell);
    });
    body.append(tableRow);
  });
  const head = document.createElement("thead");
  head.append(headRow);
  table.append(head, body);
  container.replaceChildren(table);
}

function createButton(label, data) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.entries(data).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  return button;
}

function renderParameterResults() {
  const { roomWidth, bayCount, POST_WIDTH, ACCESSORY_EXTRA_CUT } = state.parameters;
  const { bayWidth, bayWidthMinus4 } = state.formulaResults;
  document.querySelector("#result-room-width").textContent = formatMeasurement(roomWidth);
  document.querySelector("#result-bay-count").textContent = formatMeasurement(bayCount);
  document.querySelector("#result-post-width").textContent = String(POST_WIDTH);
  document.querySelector("#result-accessory-extra-cut").textContent = String(ACCESSORY_EXTRA_CUT);
  document.querySelector("#result-bay-width").textContent = formatMeasurement(bayWidth);
  document.querySelector("#result-bay-width-minus4").textContent = formatMeasurement(bayWidthMinus4);
  document.querySelector("#wall-count").textContent = `${state.design.walls.length} 面`;
  document.querySelector("#formula-bay-width").textContent = `bayWidth = ${formatMeasurement(bayWidth)} mm`;
  document.querySelector("#formula-bay-width-minus4").textContent =
    `accessoryWidth = ${formatMeasurement(bayWidthMinus4)} mm`;
}

function renderWarnings() {
  const panel = document.querySelector("#warnings-panel");
  const list = document.querySelector("#warnings");
  panel.hidden = state.warnings.length === 0;
  list.replaceChildren(...state.warnings.map((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    return item;
  }));
}

function renderTable(selector, rows, columns) {
  const container = document.querySelector(selector);
  if (!rows.length) {
    container.innerHTML = '<p class="empty-state">没有可显示的数据。</p>';
    return;
  }

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const body = document.createElement("tbody");

  columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.textContent = column;
    headRow.append(cell);
  });

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = formatCell(row[column]);
      tableRow.append(cell);
    });
    body.append(tableRow);
  });

  head.append(headRow);
  table.append(head, body);
  container.replaceChildren(table);
}

function formatCell(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === true) return "true";
  if (value === false) return "false";
  return String(value ?? "");
}

function formatMeasurement(value) {
  if (!Number.isFinite(value)) return "-";
  return String(Number(value.toFixed(3)));
}

function formatMoney(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : "0";
}

function resolveAssetUrl(path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("products/")) return `/${normalized}`;
  return `${assetRoot}/${normalized}`;
}

async function validateModelPaths() {
  const products = Object.values(state.productsBySku).filter((product) => product.modelPath);
  const results = await Promise.all(products.map(async (product) => {
    const response = await fetch(resolveAssetUrl(product.modelPath), {
      method: "HEAD",
      cache: "no-store"
    });
    return response.ok ? null : product.sku;
  }));
  state.modelValidation = {
    checked: products.length,
    missing: results.filter(Boolean)
  };
  state.modelValidation.missing.forEach((sku) => addWarning(`Product model failed to load: ${sku}`));
}

function createSceneController(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4efe7);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(5.2, 3.4, 5.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(1.8, 1.1, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9b8b7a, 2.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const roomRoot = new THREE.Group();
  roomRoot.name = "room-structure-root";
  scene.add(roomRoot);

  const basePostRoot = new THREE.Group();
  basePostRoot.name = "base-posts-root";
  scene.add(basePostRoot);

  const bayDropRoot = new THREE.Group();
  bayDropRoot.name = "bay-drop-targets-root";
  scene.add(bayDropRoot);

  const itemRoot = new THREE.Group();
  itemRoot.name = "selected-items-root";
  scene.add(itemRoot);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let highlight = null;
  let syncVersion = 0;

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findItemOwner(object) {
    let current = object;
    while (current) {
      if (current.userData?.itemId) return current;
      current = current.parent;
    }
    return null;
  }

  function handleClick(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(itemRoot.children, true)[0];
    const owner = hit ? findItemOwner(hit.object) : null;
    if (owner?.userData.itemId) selectPlacement(owner.userData.itemId);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event) {
    event.preventDefault();
    const sku = event.dataTransfer.getData("text/plain");
    if (!isConfigurableProduct(state.productsBySku[sku])) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(bayDropRoot.children, true)[0];
    const target = hit?.object || pickNearestBayTarget(event.clientX, event.clientY);
    const bay = target
      ? findBay(target.userData.wallId, target.userData.bayIndex)
      : getDefaultBay();
    addPlacement(sku, bay);
  }

  renderer.domElement.addEventListener("click", handleClick);
  renderer.domElement.addEventListener("dragover", handleDragOver);
  renderer.domElement.addEventListener("drop", handleDrop);

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.min(Math.max(container.clientHeight, 480), 900);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let animationFrame = 0;
  let lastRenderTime = 0;
  function animate(time) {
    if (time - lastRenderTime >= 33) {
      controls.update();
      renderer.render(scene, camera);
      lastRenderTime = time;
    }
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  async function sync() {
    const version = ++syncVersion;
    if (highlight) {
      itemRoot.remove(highlight);
      highlight = null;
    }
    clearObjectChildren(itemRoot);
    clearObjectChildren(basePostRoot);
    clearObjectChildren(bayDropRoot);
    rebuildRoomStructure(roomRoot);
    createBayDropTargets(bayDropRoot);

    const [basePosts, objects] = await Promise.all([
      createBasePosts(),
      Promise.all(state.placements.map((placement) => createSceneItem(placement)))
    ]);
    if (version !== syncVersion) {
      basePosts.forEach(disposeObject);
      objects.filter(Boolean).forEach(disposeObject);
      return;
    }
    basePosts.forEach((object) => basePostRoot.add(object));
    objects.filter(Boolean).forEach((object) => itemRoot.add(object));
    const active = itemRoot.children.find((object) =>
      object.userData.itemId === state.selectedPlacementId
    );
    if (active) {
      highlight = new THREE.BoxHelper(active, 0xd97706);
      highlight.userData.isHighlight = true;
      itemRoot.add(highlight);
      const activeCenter = new THREE.Box3().setFromObject(active).getCenter(new THREE.Vector3());
      controls.target.copy(activeCenter);
    } else {
      controls.target.set(0, 1.1, 0);
    }
    updateRuntimeDiagnostics(basePostRoot, itemRoot, bayDropRoot);
  }

  function pickNearestBayTarget(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const screenPoint = new THREE.Vector2(clientX - rect.left, clientY - rect.top);
    let nearest = null;
    let nearestDistance = Infinity;
    bayDropRoot.children.forEach((target) => {
      const worldCenter = target.getWorldPosition(new THREE.Vector3()).project(camera);
      const projected = new THREE.Vector2(
        ((worldCenter.x + 1) / 2) * rect.width,
        ((-worldCenter.y + 1) / 2) * rect.height
      );
      const distance = projected.distanceTo(screenPoint);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  return {
    sync,
    addAtClientPoint(sku, clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(bayDropRoot.children, true)[0];
      const target = hit?.object || pickNearestBayTarget(clientX, clientY);
      addPlacement(
        sku,
        target ? findBay(target.userData.wallId, target.userData.bayIndex) : getDefaultBay()
      );
    },
    dispose() {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.dispose();
    }
  };
}

function rebuildRoomStructure(roomRoot) {
  clearObjectChildren(roomRoot);
  const roomWidth = state.parameters.roomWidth / 1000;
  const roomDepth = state.parameters.roomDepth / 1000;
  const roomHeight = getBasePostHeightMeters();

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(roomWidth, 0.04, roomDepth),
    new THREE.MeshStandardMaterial({ color: 0xf8f5ee, roughness: 1 })
  );
  floor.name = "room-floor";
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  roomRoot.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdfcf8,
    roughness: 0.95,
    transparent: true,
    opacity: 0.86
  });
  [
    ["back-wall", new THREE.BoxGeometry(roomWidth, roomHeight + 0.35, 0.04), [0, (roomHeight + 0.35) / 2, -roomDepth / 2]],
    ["left-wall", new THREE.BoxGeometry(0.04, roomHeight + 0.35, roomDepth), [-roomWidth / 2, (roomHeight + 0.35) / 2, 0]],
    ["right-wall", new THREE.BoxGeometry(0.04, roomHeight + 0.35, roomDepth), [roomWidth / 2, (roomHeight + 0.35) / 2, 0]]
  ].forEach(([name, geometry, position]) => {
    const wall = new THREE.Mesh(geometry, wallMaterial.clone());
    wall.name = name;
    wall.position.set(...position);
    wall.receiveShadow = true;
    roomRoot.add(wall);
  });

  const grid = new THREE.GridHelper(Math.max(roomWidth, roomDepth), 12, 0x8d745f, 0xd6c9bb);
  grid.name = "room-grid";
  grid.position.y = 0.002;
  roomRoot.add(grid);
}

async function createBasePosts() {
  const product = getBasePostProduct();
  if (!product?.modelPath) return [];
  const postPlacements = state.design.bays.flatMap((bay) => [
    { bay, localX: bay.leftPost, side: "left" },
    { bay, localX: bay.rightPost, side: "right" }
  ]);
  const objects = await Promise.all(postPlacements.map(async ({ bay, localX, side }, index) => {
    try {
      const model = await loadModelClone(product.modelPath);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        applyBlackMaterial(child);
      });
      fitSceneObject(model, product, { customWidth: null, calculatedWidth: null });
      fitBasePostWidth(model);

      const anchor = new THREE.Group();
      anchor.name = `base-post-${index + 1}`;
      anchor.userData.basePost = true;
      anchor.userData.sku = product.sku;
      anchor.userData.wallId = bay.wallId;
      anchor.userData.bayIndex = bay.bayIndex;
      anchor.userData.side = side;
      anchor.userData.localXmm = localX;
      const transform = getWallTransform(bay.wallId);
      const point = transform.localToWorld(localX / 1000, 0);
      anchor.position.copy(point);
      anchor.rotation.y = transform.rotationY;
      anchor.add(model);
      return anchor;
    } catch (error) {
      addWarning(`Product model failed to load: ${product.sku}`);
      return null;
    }
  }));
  return objects.filter(Boolean);
}

function fitBasePostWidth(model) {
  let box = new THREE.Box3().setFromObject(model);
  const currentWidth = box.getSize(new THREE.Vector3()).x;
  const targetWidth = state.parameters.POST_WIDTH / 1000;
  if (!(currentWidth > 0 && targetWidth > 0)) return;
  model.scale.x *= targetWidth / currentWidth;
  box = new THREE.Box3().setFromObject(model);
  model.position.x -= box.getCenter(new THREE.Vector3()).x;
}

function getBasePostProduct() {
  const configuredSku = String(
    state.settings.defaultPostSku || state.settings.DEFAULT_POST_SKU || ""
  ).trim();
  if (configuredSku) return state.productsBySku[configuredSku];
  return Object.values(state.productsBySku)
    .filter((product) => product.type === "post" && product.modelPath)
    .sort((left, right) => (Number(right.sortOrder) || 0) - (Number(left.sortOrder) || 0))[0];
}

function getBasePostHeightMeters() {
  const fixedHeight = String(getBasePostProduct()?.heightRule || "")
    .match(/^fixed:(\d+(?:\.\d+)?)$/i);
  return fixedHeight ? Number(fixedHeight[1]) / 1000 : 2.95;
}

function createBayDropTargets(root) {
  const height = getBasePostHeightMeters();
  state.design.bays.forEach((bay) => {
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(bay.groupWidth / 1000, height, 0.5),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false
      })
    );
    const transform = getWallTransform(bay.wallId);
    target.position.copy(transform.localToWorld(bay.centerX / 1000, height / 2));
    target.rotation.y = transform.rotationY;
    target.userData.isBayDropTarget = true;
    target.userData.wallId = bay.wallId;
    target.userData.bayIndex = bay.bayIndex;
    root.add(target);
  });
}

function getWallTransform(wallId) {
  const wall = state.design.walls.find((item) => item.id === wallId);
  const roomWidth = state.parameters.roomWidth / 1000;
  const roomDepth = state.parameters.roomDepth / 1000;
  const wallOffset = Math.max(Number(state.settings.defaultWallOffset) || 415, 0) / 1000;
  const startOffset = (wall?.startOffset || 0) / 1000;

  if (wallId === "left") {
    return {
      rotationY: -Math.PI / 2,
      localToWorld(localX, y = 0) {
        return new THREE.Vector3(
          -roomWidth / 2 + wallOffset,
          y,
          -roomDepth / 2 + startOffset + localX
        );
      }
    };
  }
  if (wallId === "right") {
    return {
      rotationY: -Math.PI / 2,
      localToWorld(localX, y = 0) {
        return new THREE.Vector3(
          roomWidth / 2 - wallOffset,
          y,
          -roomDepth / 2 + startOffset + localX
        );
      }
    };
  }
  return {
    rotationY: 0,
    localToWorld(localX, y = 0) {
      return new THREE.Vector3(
        -roomWidth / 2 + startOffset + localX,
        y,
        -roomDepth / 2 + wallOffset
      );
    }
  };
}

function getBayWorldPoint(bay, y = 0) {
  if (!bay) return new THREE.Vector3(0, y, 0);
  return getWallTransform(bay.wallId).localToWorld(bay.centerX / 1000, y);
}

function labelWall(wallId) {
  return { back: "后墙", left: "左墙", right: "右墙" }[wallId] || wallId;
}

function applyBlackMaterial(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.filter(Boolean).forEach((material) => {
    material.color?.setHex(0x111111);
    if ("metalness" in material) material.metalness = Math.max(material.metalness || 0, 0.35);
    material.needsUpdate = true;
  });
}

async function createSceneItem(placement) {
  const product = state.productsBySku[placement.productSku];
  if (!isConfigurableProduct(product)) return null;
  let object;
  try {
    object = await loadModelClone(product.modelPath);
  } catch (error) {
    addWarning(`Product model failed to load: ${placement.productSku}`);
    return null;
  }

  object.name = placement.id;
  object.userData.itemId = placement.id;
  object.userData.sku = placement.productSku;
  object.userData.wallId = placement.wallId;
  object.userData.bayIndex = placement.bayIndex;
  object.traverse((child) => {
    child.userData.itemId = placement.id;
    child.userData.sku = placement.productSku;
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (product.type === "post") applyBlackMaterial(child);
    }
  });

  fitSceneObject(object, product, {
    customWidth: placement.customWidth,
    calculatedWidth: getPlacementDisplayWidth(placement)
  });
  const bay = findBay(placement.wallId, placement.bayIndex);
  if (!bay) return null;
  const transform = getWallTransform(placement.wallId);
  const point = getBayWorldPoint(bay, placement.heightFromFloor / 1000);
  object.position.add(point);
  object.rotation.y = transform.rotationY;
  return object;
}

function loadModelClone(modelPath) {
  const url = resolveAssetUrl(modelPath);
  if (!modelCache.has(url)) {
    modelCache.set(url, new Promise((resolve, reject) => {
      modelLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return modelCache.get(url).then((source) => {
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) child.material = child.material.map((material) => material.clone());
      else if (child.material) child.material = child.material.clone();
    });
    return clone;
  });
}

function fitSceneObject(object, product, item) {
  let box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
  const unitScale = maxDimension > 20 ? 0.001 : 1;
  object.scale.setScalar(unitScale);
  box = new THREE.Box3().setFromObject(object);

  const desiredWidth = item.customWidth ?? numericWidth(item.calculatedWidth);
  if (desiredWidth && box.getSize(new THREE.Vector3()).x > 0) {
    const currentWidth = box.getSize(new THREE.Vector3()).x;
    object.scale.x *= (desiredWidth / 1000) / currentWidth;
  } else if (product?.type === "post") {
    const currentHeight = box.getSize(new THREE.Vector3()).y;
    const fixedHeight = String(product.heightRule || "").match(/^fixed:(\d+(?:\.\d+)?)$/i);
    const targetHeight = fixedHeight ? Number(fixedHeight[1]) / 1000 : currentHeight;
    if (currentHeight > 0) object.scale.multiplyScalar(targetHeight / currentHeight);
  } else if (maxDimension <= 20) {
    object.scale.multiplyScalar(0.8 / Math.max(box.getSize(new THREE.Vector3()).length(), 0.001));
  }

  box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
}

function clearObjectChildren(root) {
  while (root.children.length) {
    const child = root.children.pop();
    disposeObject(child);
  }
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function updateRuntimeDiagnostics(basePostRoot, itemRoot, bayDropRoot) {
  const basePosts = basePostRoot?.children.map((object) => {
    const box = new THREE.Box3().setFromObject(object);
    return {
      name: object.name,
      sku: object.userData.sku,
      wallId: object.userData.wallId,
      bayIndex: object.userData.bayIndex,
      side: object.userData.side,
      localXmm: object.userData.localXmm,
      worldPosition: object.getWorldPosition(new THREE.Vector3()).toArray(),
      rotation: object.rotation.toArray().slice(0, 3),
      bboxMin: box.min.toArray(),
      bboxMax: box.max.toArray()
    };
  }) || [];
  const basePostMeshes = [];
  basePostRoot?.children[0]?.traverse((child) => {
    if (!child.isMesh) return;
    const box = new THREE.Box3().setFromObject(child);
    basePostMeshes.push({
      name: child.name,
      bboxMin: box.min.toArray(),
      bboxMax: box.max.toArray(),
      size: box.getSize(new THREE.Vector3()).toArray()
    });
  });
  const diagnostics = {
    parameters: { ...state.parameters },
    formulaResults: { ...state.formulaResults },
    configurableSkus: getConfigurableProducts().map((product) => product.sku),
    modelValidation: state.modelValidation,
    walls: state.design.walls,
    bayDropTargetCount: bayDropRoot?.children.length || 0,
    basePosts,
    basePostMeshes,
    selectedSceneItems: itemRoot?.children
      .filter((object) => !object.userData.isHighlight)
      .map((object) => {
        const box = new THREE.Box3().setFromObject(object);
        return {
          sku: object.userData.sku,
          itemId: object.userData.itemId,
          wallId: object.userData.wallId,
          bayIndex: object.userData.bayIndex,
          worldPosition: object.getWorldPosition(new THREE.Vector3()).toArray(),
          bboxCenter: box.getCenter(new THREE.Vector3()).toArray(),
          bboxSize: box.getSize(new THREE.Vector3()).toArray()
        };
      }) || []
  };
  document.querySelector("#three-viewer").dataset.runtimeDiagnostics = JSON.stringify(diagnostics);
}

function setStatus(message, variant) {
  const status = document.querySelector("#status");
  status.textContent = message;
  status.dataset.variant = variant;
}
