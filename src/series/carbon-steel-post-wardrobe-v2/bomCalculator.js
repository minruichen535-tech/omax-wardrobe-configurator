export const carbonSteelPostWardrobeV2BomCalculator = {
  addSystemBom({
    activeWalls,
    postHeight,
    productBySku,
    productByType,
    rules,
    settings,
    config,
    bomMap,
    addBom
  }) {
    const postProduct = resolvePostProduct({ postHeight, productBySku, productByType, config, settings });
    if (!postProduct) return;

    const postQuantity = activeWalls.reduce((sum, wall) => (
      sum + Number(wall.postCount || wall.posts?.length || (Number(wall.bayCount || 0) + 1) || 0)
    ), 0);
    const configWithActualPostCount = { ...config, actualPostCount: postQuantity };
    addBom(bomMap, postProduct, postQuantity, this.chooseColor(postProduct, config));
    expandChildren({
      parentProduct: postProduct,
      parentQuantity: postQuantity,
      rules,
      productBySku,
      settings,
      config: configWithActualPostCount,
      bomMap,
      addBom,
      chooseColor: this.chooseColor.bind(this),
      path: []
    });
  },

  getPlacementRuleItem({ required, rule, placement, config }) {
    return {
      product: { ...required, carbonExpandChildren: true },
      quantity: evaluateQuantity(rule.quantity, buildContext({}, config, placement)) * placement.quantity,
      color: this.chooseColor(required, config),
      note: rule.note
    };
  },

  ruleMatches(rule, settings, config, placement) {
    return conditionMatches(rule.condition, buildContext(settings, config, placement));
  },

  expandNestedRules({ bomMap, rules, productBySku, config, addBom }) {
    Array.from(bomMap.values())
      .filter((item) => item.carbonExpandChildren)
      .forEach((item) => {
        expandChildren({
          parentProduct: item,
          parentQuantity: item.quantity,
          rules,
          productBySku,
          settings: {},
          config,
          bomMap,
          addBom,
          chooseColor: this.chooseColor.bind(this),
          path: []
        });
      });
  },

  createAutoPlacements({ rawPlacements }) {
    return Array.isArray(rawPlacements) ? rawPlacements : [];
  },

  chooseColor(product) {
    const options = product.colorOptions || [];
    if (options.includes("woodBrown")) return "Wood Brown";
    return "Black";
  }
};

function resolvePostProduct({ postHeight, productBySku, productByType, config, settings }) {
  const connectionMode = normalizeValue(config.connectionMode || settings.defaultConnectionMode);
  const height = Number(postHeight) <= 1950 ? 1950 : 2950;
  const family = connectionMode === "wall" ? "TLZ-001-5" : "TLZ-001-1";
  const targetSku = `${family}-${height}`;
  if (productBySku[targetSku]) return productBySku[targetSku];
  return createDerivedPostProduct({ targetSku, family, height, productBySku }) || productByType.post;
}

function createDerivedPostProduct({ targetSku, family, height, productBySku }) {
  const family2950 = productBySku[`${family}-2950`];
  const family1950 = productBySku[`${family}-1950`];
  const siblingFamily = family === "TLZ-001-5" ? "TLZ-001-1" : "TLZ-001-5";
  const siblingSameHeight = productBySku[`${siblingFamily}-${height}`];
  const baseProduct = family2950 || family1950 || siblingSameHeight;
  if (!baseProduct) return null;

  return {
    ...baseProduct,
    ...(siblingSameHeight ? {
      unitPrice: siblingSameHeight.unitPrice,
      width: siblingSameHeight.width,
      depth: siblingSameHeight.depth
    } : {}),
    sku: targetSku,
    height,
    sizeRule: `fixed:${height}`,
    modelPath: `${targetSku}.glb`,
    glbAssetPath: `${targetSku}.glb`
  };
}

function expandChildren({
  parentProduct,
  parentQuantity,
  rules,
  productBySku,
  settings,
  config,
  bomMap,
  addBom,
  chooseColor,
  path
}) {
  if (!parentProduct || path.includes(parentProduct.sku)) return;
  const nextPath = [...path, parentProduct.sku];
  const context = buildContext(settings, config);

  rules
    .filter((rule) => ruleMatchesProduct(rule, parentProduct))
    .filter((rule) => conditionMatches(rule.condition, context))
    .forEach((rule) => {
      const child = productBySku[rule.childSku || rule.requiredSku];
      if (!child) return;
      const quantity = parentQuantity * evaluateQuantity(rule.quantity, context);
      if (!Number.isFinite(quantity) || quantity === 0) return;
      addBom(bomMap, child, quantity, chooseColor(child, config), rule.note);
      expandChildren({
        parentProduct: child,
        parentQuantity: quantity,
        rules,
        productBySku,
        settings,
        config,
        bomMap,
        addBom,
        chooseColor,
        path: nextPath
      });
    });
}

function ruleMatchesProduct(rule, product) {
  const parentSku = String(rule.parentSku || "").trim();
  if (parentSku.startsWith("type:")) {
    return product.type === parentSku.slice("type:".length).trim();
  }
  return parentSku === product.sku || (rule.parentType && rule.parentType === product.type);
}

function conditionMatches(condition, context) {
  const expression = String(condition || "").trim();
  if (!expression || expression === "always") return true;
  const match = expression.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);
  if (!match) return false;
  const [, key, operator, rawExpected] = match;
  const actual = context[key];
  if (actual === undefined) return false;
  const expected = stripQuotes(rawExpected.trim());
  const numeric = isNumeric(actual) && isNumeric(expected);
  const left = numeric ? Number(actual) : normalizeValue(actual);
  const right = numeric ? Number(expected) : normalizeValue(expected);
  if (operator === "=" || operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  return false;
}

function evaluateQuantity(quantity, context) {
  if (typeof quantity === "number") return quantity;
  const expression = String(quantity || "").trim();
  if (isNumeric(expression)) return Number(expression);
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+-]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) return NaN;
  let result = 0;
  let operator = "+";
  tokens.forEach((token) => {
    if (token === "+" || token === "-") {
      operator = token;
      return;
    }
    const value = isNumeric(token) ? Number(token) : Number(context[token]);
    result = operator === "+" ? result + value : result - value;
  });
  return result;
}

function buildContext(settings, config, placement = {}) {
  const bayCount = Object.values(config.walls || {})
    .filter((wall) => wall.enabled)
    .reduce((sum, wall) => sum + Number(wall.bayCount || 0), 0);
  const configuredActualPostCount = Number(config.actualPostCount);
  const totalPosts = Number.isFinite(configuredActualPostCount) && configuredActualPostCount > 0
    ? configuredActualPostCount
    : bayCount * 2;
  return {
    ...settings,
    ...config,
    ...placement,
    bayCount,
    totalPosts,
    spanPostCount: totalPosts,
    connectionMode: config.connectionMode || settings.defaultConnectionMode || ""
  };
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function stripQuotes(value) {
  return /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}

function isNumeric(value) {
  return value !== "" && Number.isFinite(Number(value));
}
