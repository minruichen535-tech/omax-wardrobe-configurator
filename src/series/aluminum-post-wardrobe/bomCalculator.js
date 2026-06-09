export const aluminumPostWardrobeBomCalculator = {
  addSystemBom({
    activeWalls,
    productByType,
    rules,
    settings,
    config,
    bomMap,
    addBom,
    productBySku
  }) {
    const postProduct = productByType.post;
    const postQuantity = activeWalls.reduce((sum, wall) => sum + wall.postCount, 0);
    if (postProduct?.sellable) {
      addBom(bomMap, postProduct, postQuantity, this.chooseColor(postProduct, config));
    }

    rules
      .filter((rule) => rule.parentSku === postProduct?.sku)
      .filter((rule) => this.ruleMatches(rule, settings, config))
      .forEach((rule) => {
        const required = productBySku[rule.childSku || rule.requiredSku];
        if (!required?.sellable) return;
        addBom(
          bomMap,
          required,
          rule.quantity * postQuantity,
          this.chooseColor(required, config),
          rule.note
        );
      });
  },

  getPlacementRuleItem({ required, rule, placement, config }) {
    return {
      product: required,
      quantity: rule.quantity * placement.quantity,
      color: this.chooseColor(required, config),
      note: rule.note
    };
  },

  resolvePlacementProduct({ placement, productsByType, productByType }) {
    const candidates = productsByType[placement.componentType] || [];
    const requestedWidth = Number(placement.moduleWidth || placement.standardWidth);
    if (requestedWidth > 0) {
      const exact = candidates.find((product) => product.widthOptions?.includes(requestedWidth));
      if (exact) return exact;
    }
    return productByType[placement.componentType];
  },

  ruleMatches(rule, settings, config) {
    return ruleConditionMatches(rule, settings, config);
  },

  expandNestedRules() {},

  createAutoPlacements({ rawPlacements }) {
    return Array.isArray(rawPlacements) ? rawPlacements : [];
  },

  chooseColor(product, config) {
    const options = product.colorOptions || [];
    if (options.includes("inheritPostColor")) return config.frameColor || "Black";
    if (options.includes("woodBrown")) return config.panelColor || "Wood Brown";
    if (options.includes("black")) return "Black";
    return options[0] || config.frameColor || "Default Material";
  }
};

function ruleConditionMatches(rule, settings, config) {
  const condition = String(rule.condition || "").trim();
  if (!condition) return true;
  const [key, expectedValue] = condition.split("=").map((value) => value.trim());
  if (!key || expectedValue === undefined) return true;
  const expected = normalizeValue(expectedValue);
  const actual = normalizeValue(
    config[key]
    ?? settings?.[`default${capitalize(key)}`]
    ?? settings?.[key]
  );
  return actual === expected;
}

function normalizeValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "celling" ? "ceiling" : normalized;
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
