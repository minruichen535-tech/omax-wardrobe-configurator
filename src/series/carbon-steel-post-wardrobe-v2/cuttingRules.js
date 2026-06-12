const defaultSettings = {
  POST_WIDTH: 20,
  "ACCESSORY-EXTRA-CUT": 4
};

export const carbonSteelPostWardrobeV2CuttingRules = createRules();

export function createCarbonSteelPostWardrobeV2CuttingRules(data = {}) {
  return createRules(data);
}

function createRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  const settings = { ...defaultSettings, ...(data.settings || {}) };
  const postWidth = positiveNumber(settings.POST_WIDTH, defaultSettings.POST_WIDTH);
  const accessoryExtraCut = positiveNumber(
    settings["ACCESSORY-EXTRA-CUT"] ?? settings.ACCESSORY_EXTRA_CUT,
    defaultSettings["ACCESSORY-EXTRA-CUT"]
  );
  const productByType = new Map();

  products.forEach((product) => {
    if (!productByType.has(product.type) && product.modelPath) {
      productByType.set(product.type, product);
    }
  });

  const componentProducts = products.filter((product) => (
    product.type !== "post"
    && Boolean(product.modelPath)
    && !isBomOnlyType(product.type)
  ));
  const componentTypes = unique(componentProducts.map((product) => product.type));

  return {
    maxPostSpanMm: 900,
    minBayWidthMm: 400,
    maxBayWidthMm: 1200,
    minHeightMm: 1800,
    maxHeightMm: 3500,
    sideWallLengthAdjustmentMm: 625,
    uSideFirstBackWallCornerOffsetMm: 535,
    backWallInnerSurfaceInsetMm: 20,
    sideWallLengthAdjustmentLayouts: ["L-left", "L-right", "U"],
    centerSideWallAfterStartOffset: true,
    sideWallLayoutStartsAtBackCorner: true,
    sideWallPostBoundaryInsetMm: 0,
    sideWallPostBoundaryInsetLayouts: [],
    getSideWallBackCornerPostInsetMm(config) {
      return String(config?.connectionMode || "").trim().toLowerCase() === "wall"
        ? 23.5
        : 35;
    },
    supportsULayoutModes: true,
    preservesExistingUWallGeometry: true,
    uLayoutModeControl: "icons",
    supportsIndependentBayWidths: false,
    insetBackWallPostCentersByHalfProfileLayouts: [],
    postProfileWidthMm: postWidth,
    componentTypes,
    fixedModuleTypes: [],
    fixedModuleWidths: [900],
    defaultHeightByType: {
      woodShelf: 1200,
      shoesShelf: 300,
      singleRail: 1600,
      cabinet: 300
    },
    componentFallbackNames: Object.fromEntries(
      componentProducts.map((product) => [product.type, product.nameCn])
    ),
    defaultIconsByType: Object.fromEntries(
      componentProducts.map((product) => [product.type, product.image || product.icon || ""])
    ),
    postWidth,
    accessoryExtraCut,

    getInnerBayWidth(totalLength, bayCount) {
      const groupWidth = Number(totalLength) / Math.max(1, Number(bayCount));
      return Math.max(0, groupWidth - (this.postWidth * 2));
    },

    getCutLength(componentType, bayWidth) {
      const widthRule = String(productByType.get(componentType)?.widthRule || "").trim();
      if (!widthRule || widthRule === "none") return null;
      if (widthRule === "bayWidth") return Math.max(0, Number(bayWidth));
      if (widthRule === "bayWidthMinus4") {
        return Math.max(0, Number(bayWidth) - this.accessoryExtraCut);
      }
      const fixed = widthRule.match(/^fixed\s*:\s*(-?\d+(?:\.\d+)?)$/i);
      return fixed ? Math.max(0, Number(fixed[1])) : null;
    },

    getVisualScaleWidth(componentType, innerBayWidth, componentCutLength) {
      return Number.isFinite(componentCutLength) && componentCutLength > 0
        ? componentCutLength
        : innerBayWidth;
    }
  };
}

function isBomOnlyType(type) {
  return /(^|)(accessory|part|kit|screw|fastener|hardware|postAccessory)/i.test(String(type || ""));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
