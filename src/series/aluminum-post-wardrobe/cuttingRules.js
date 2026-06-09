const defaultProjectConfig = {
  POST_WIDTH: 30,
  SLIDER_OFFSET: 18,
  LBRACKET_OFFSET: 28
};

const defaultLayoutFormula = "(roomWidth-((bayCount+1)*POST_WIDTH))/bayCount";

export const aluminumPostWardrobeCuttingRules = createRules();

export function createAluminumPostWardrobeCuttingRules(data = {}) {
  return createRules(data);
}

function createRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  const projectConfig = { ...defaultProjectConfig, ...(data.projectConfig || {}) };
  const productBySku = Object.fromEntries(products.map((product) => [product.sku, product]));
  const cuttingFormulaByType = new Map();

  (data.cuttingRules || []).forEach((rule) => {
    const product = productBySku[rule.sku || rule.key];
    const componentType = product?.type || rule.componentType || rule.key;
    if (componentType && rule.formula) cuttingFormulaByType.set(componentType, rule.formula);
  });

  const layoutFormula = (data.layoutRules || [])
    .find((rule) => (rule.ruleKey || rule.key) === "bayWidth")?.formula
    || defaultLayoutFormula;
  const componentProducts = products.filter((product) => (
    product.type !== "post"
    && (product.modelPath || product.cuttable)
    && !/Accessory$/.test(product.type)
  ));
  const componentTypes = unique(componentProducts.map((product) => product.type));
  const fixedModuleTypes = unique(componentProducts
    .filter((product) => product.widthRule === "fixedOptions" || product.resizeMode === "fixed")
    .map((product) => product.type));
  const fixedModuleWidths = unique(componentProducts
    .flatMap((product) => product.widthOptions || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0))
    .sort((a, b) => a - b);

  const rules = {
    maxPostSpanMm: 1200,
    minBayWidthMm: 600,
    maxBayWidthMm: 1200,
    minHeightMm: 1800,
    maxHeightMm: 3500,
    sideWallLengthAdjustmentMm: 0,
    supportsULayoutModes: true,
    supportsIndependentBayWidths: true,
    cornerOffsetOptions: [300, 400, 500],
    postProfileWidthMm: positiveNumber(projectConfig.POST_WIDTH, 30),
    componentTypes: componentTypes.length
      ? componentTypes
      : ["woodShelf", "glassShelf", "singleRail", "cabinet", "jewelryBox"],
    fixedModuleTypes,
    fixedModuleWidths: fixedModuleWidths.length ? fixedModuleWidths : [600, 700, 800, 900],
    defaultHeightByType: {
      woodShelf: 1200,
      glassShelf: 1200,
      singleRail: 1600,
      cabinet: 300,
      jewelryBox: 900
    },
    componentFallbackNames: Object.fromEntries(componentProducts.map((product) => [product.type, product.nameCn])),
    defaultIconsByType: Object.fromEntries(componentProducts.map((product) => [product.type, product.image || product.icon || ""])),
    projectConfig,
    layoutFormula,
    cuttingFormulaByType,

    getInnerBayWidth(totalLength, bayCount) {
      return Math.max(0, evaluateFormula(this.layoutFormula, {
        ...this.projectConfig,
        roomWidth: Number(totalLength),
        totalLength: Number(totalLength),
        bayCount: Number(bayCount)
      }));
    },

    getCutLength(componentType, usableBayWidth) {
      const formula = this.cuttingFormulaByType.get(componentType);
      if (!formula) return null;
      const value = evaluateFormula(formula, {
        ...this.projectConfig,
        bayWidth: Number(usableBayWidth),
        innerBayWidth: Number(usableBayWidth)
      });
      return Number.isFinite(value) ? Math.floor(Math.max(0, value)) : null;
    },

    getVisualScaleWidth(componentType, innerBayWidth, componentCutLength, moduleWidth) {
      if (this.fixedModuleTypes.includes(componentType)) {
        return moduleWidth || normalizeFixedModuleWidth(innerBayWidth, this.fixedModuleWidths);
      }
      return Number.isFinite(componentCutLength) && componentCutLength > 0
        ? componentCutLength
        : innerBayWidth;
    }
  };

  return rules;
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
