export const wallMountedV2CuttingRules = createRules();

export function createWallMountedV2CuttingRules(data = {}) {
  return createRules(data);
}

function createRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  const productByType = new Map();
  products.forEach((product) => {
    if (!productByType.has(product.type)) productByType.set(product.type, product);
  });
  const formulaBySku = new Map(
    (data.cuttingRules || []).map((rule) => [String(rule.sku || rule.key || "").trim(), rule.formula])
  );
  const middlePost = products.find((product) => product.sku === "BG-001");
  const postProfileWidthMm = positiveNumber(middlePost?.widthRule, 70);
  const componentProducts = products.filter((product) => (
    !["post", "backPanel"].includes(product.type)
    && !isBomOnlyType(product.type)
    && Boolean(product.modelPath)
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

  return {
    maxPostSpanMm: 1000,
    minBayWidthMm: 500,
    maxBayWidthMm: 1200,
    minHeightMm: 1800,
    maxHeightMm: 3500,
    sideWallLengthAdjustmentMm: 510,
    sideWallLengthAdjustmentLayouts: ["L-left", "L-right", "U"],
    uSideFirstBackWallCornerOffsetMm: 0,
    uSideFirstBackWallBoundaryClearanceMm: 45,
    uBackFirstSideWallCornerOffsetMm: 50,
    centerSideWallAfterStartOffset: true,
    sideWallLayoutStartsAtBackCorner: true,
    supportsULayoutModes: true,
    preservesExistingUWallGeometry: true,
    uLayoutModeControl: "icons",
    supportsIndependentBayWidths: true,
    postProfileWidthMm,
    componentTypes: unique(componentProducts.map((product) => product.type)),
    fixedModuleTypes,
    fixedModuleWidths: fixedModuleWidths.length ? fixedModuleWidths : [600, 700, 800, 900],
    defaultHeightByType: Object.fromEntries(componentProducts.map((product) => [
      product.type,
      defaultHeight(product.type)
    ])),
    componentFallbackNames: Object.fromEntries(
      componentProducts.map((product) => [product.type, product.nameCn])
    ),
    defaultIconsByType: Object.fromEntries(
      componentProducts.map((product) => [product.type, product.image || ""])
    ),

    getInnerBayWidth(totalLength, bayCount) {
      const length = Number(totalLength);
      const count = Math.max(1, Number(bayCount));
      return Math.max(0, (length - (count + 1) * postProfileWidthMm) / count);
    },

    getCutLength(componentType, usableBayWidth) {
      const product = productByType.get(componentType);
      if (!product?.cuttable) return null;
      const formula = formulaBySku.get(product.sku)
        || (["woodShelf", "shoeShelf", "cabinet", "backPanel"].includes(componentType)
          ? "bayWidth-8"
          : "bayWidth");
      return evaluateFormula(formula, { bayWidth: Number(usableBayWidth) });
    },

    getVisualScaleWidth(componentType, innerBayWidth, componentCutLength, moduleWidth) {
      if (fixedModuleTypes.includes(componentType)) {
        return moduleWidth || normalizeFixedModuleWidth(innerBayWidth, fixedModuleWidths);
      }
      return Number.isFinite(componentCutLength) && componentCutLength > 0
        ? componentCutLength
        : innerBayWidth;
    }
  };
}

function isBomOnlyType(type) {
  return /(accessory|screw|transformer|led)$/i.test(String(type || ""));
}

function defaultHeight(type) {
  if (/rail/i.test(type)) return 1600;
  if (/cabinet|shoeShelf/i.test(type)) return 300;
  if (/jewelry|trouser/i.test(type)) return 900;
  return 1200;
}

function evaluateFormula(formula, variables) {
  const source = String(formula || "").replace(/\s+/g, "");
  if (!source || /[^A-Za-z0-9_+\-*/().]/.test(source)) return null;
  const substituted = source.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => {
    const value = Number(variables[name]);
    return Number.isFinite(value) ? `(${value})` : "NaN";
  });
  if (substituted.includes("NaN")) return null;
  try {
    const value = Function(`"use strict"; return (${substituted});`)();
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  } catch {
    return null;
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
