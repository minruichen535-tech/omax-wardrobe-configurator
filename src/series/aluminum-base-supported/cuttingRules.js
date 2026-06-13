export const aluminumBaseSupportedCuttingRules = createRules();

export function createAluminumBaseSupportedCuttingRules(data = {}) {
  return createRules(data);
}

function createRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  const projectConfig = data.projectConfig || {};
  const productBySku = Object.fromEntries(products.map((product) => [product.sku, product]));
  const productByType = new Map();
  products.forEach((product) => {
    if (!productByType.has(product.type)) productByType.set(product.type, product);
  });

  const formulaBySku = new Map();
  (data.cuttingRules || []).forEach((rule) => {
    if (!formulaBySku.has(rule.sku)) formulaBySku.set(rule.sku, []);
    formulaBySku.get(rule.sku).push(rule);
  });

  const componentProducts = products.filter((product) => (
    product.type !== "post"
    && !isBomOnlyType(product.type)
    && product.type !== "backPanel"
    && Boolean(product.modelPath || product.image)
  ));
  const fixedModuleProducts = componentProducts.filter((product) => (
    product.resizeMode === "fixed" && product.widthOptions?.length
  ));
  const fixedModuleTypes = unique(fixedModuleProducts.map((product) => product.type));
  const fixedModuleWidths = unique(fixedModuleProducts
    .flatMap((product) => product.widthOptions || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0))
    .sort((a, b) => a - b);
  const postWidth = positiveNumber(projectConfig.POST_WIDTH, 31.8);
  const fixedDepth = products
    .map((product) => Number(product.depthRule))
    .find((value) => Number.isFinite(value) && value > 0) || 500;

  return {
    maxPostSpanMm: 1200,
    minBayWidthMm: 600,
    maxBayWidthMm: 1200,
    minHeightMm: 1800,
    maxHeightMm: 3500,
    sideWallLengthAdjustmentMm: fixedDepth + 10,
    sideWallLengthAdjustmentLayouts: ["L-left", "L-right", "U"],
    centerSideWallAfterStartOffset: true,
    sideWallLayoutStartsAtBackCorner: true,
    supportsULayoutModes: true,
    preservesExistingUWallGeometry: true,
    uLayoutModeControl: "icons",
    supportsIndependentBayWidths: true,
    postProfileWidthMm: postWidth,
    componentTypes: unique(componentProducts.map((product) => product.type)),
    fixedModuleTypes,
    fixedModuleWidths: fixedModuleWidths.length ? fixedModuleWidths : [600],
    defaultHeightByType: Object.fromEntries(componentProducts.map((product) => [
      product.type,
      defaultHeight(product.type)
    ])),
    componentFallbackNames: Object.fromEntries(componentProducts.map((product) => [product.type, product.nameCn])),
    defaultIconsByType: Object.fromEntries(componentProducts.map((product) => [product.type, product.image || ""])),

    getInnerBayWidth(totalLength, bayCount) {
      const rule = (data.layoutRules || []).find((item) => item.ruleKey === "bayInnerWidth");
      const bayWidth = Number(totalLength) / Math.max(1, Number(bayCount));
      return Math.max(0, evaluateFormula(rule?.formula || "bayWidth-POST_WIDTH", {
        bayWidth,
        bayModuleWidth: bayWidth,
        POST_WIDTH: postWidth
      }));
    },

    getCutLength(componentType, usableBayWidth) {
      const product = productByType.get(componentType);
      if (!product?.cuttable) return null;
      const rules = formulaBySku.get(product.sku) || [];
      const rule = rules.find((item) => !item.condition) || rules[0];
      if (!rule) return null;
      const value = evaluateFormula(rule.formula, {
        bayWidth: Number(usableBayWidth) + postWidth,
        bayInnerWidth: Number(usableBayWidth),
        POST_WIDTH: postWidth
      });
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
    },

    getVisualScaleWidth(componentType, innerBayWidth, componentCutLength, moduleWidth) {
      if (fixedModuleTypes.includes(componentType)) {
        return moduleWidth || normalizeFixedModuleWidth(innerBayWidth, this.fixedModuleWidths);
      }
      return Number.isFinite(componentCutLength) && componentCutLength > 0
        ? componentCutLength
        : innerBayWidth;
    }
  };
}

function isBomOnlyType(type) {
  return /(accessory|led|transformer)$/i.test(String(type || ""));
}

function defaultHeight(type) {
  if (/rail/i.test(type)) return 1600;
  if (/cabinet/i.test(type)) return 300;
  if (/storage|jewelry|trouser/i.test(type)) return 900;
  return 1200;
}

function evaluateFormula(formula, variables) {
  const source = String(formula || "").replace(/\s+/g, "");
  if (!source || /[^A-Za-z0-9_+\-*/().]/.test(source)) return NaN;
  const substituted = source.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => {
    const value = Number(variables[name]);
    return Number.isFinite(value) ? `(${value})` : "NaN";
  });
  if (substituted.includes("NaN")) return NaN;
  try {
    return Function(`"use strict"; return (${substituted});`)();
  } catch {
    return NaN;
  }
}

function normalizeFixedModuleWidth(width, options) {
  const value = Number(width);
  if (!Number.isFinite(value) || value <= 0) return options[0];
  return options.find((option) => option >= value) || options[options.length - 1];
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
