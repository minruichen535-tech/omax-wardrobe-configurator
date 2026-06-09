const factoryCutSkus = new Set([
  "LZ-WOOD-SHELF",
  "LZ-003",
  "LZ-005-2",
  "LZ-CABINET"
]);

export const aluminumPostWardrobeDisplayRules = {
  defaultOpenBomGroups: new Set([
    "立柱系统",
    "层板系统",
    "挂衣系统",
    "柜体系统"
  ]),
  factoryCutSkus,

  getBomDisplaySpec(item) {
    return item.sizeRule || "—";
  },

  getBomDisplayQuantity(item) {
    return item.quantity;
  },

  getBomDisplayUnitPrice(item) {
    return item.unitPrice;
  },

  getWebDisplayUnit(item) {
    return item.unit;
  },

  getWebDisplayQuantity(item) {
    return item.quantity;
  },

  getWebDisplayUnitPrice(item) {
    return item.unitPrice;
  },

  getWebDisplayLineTotal(item) {
    return item.quantity * item.unitPrice;
  },

  getQuotationDisplayUnit(item) {
    return item.unit;
  },

  getQuotationDisplayQuantity(item) {
    return item.quantity;
  },

  getQuotationDisplayUnitPrice(item) {
    return item.unitPrice;
  },

  getQuotationDisplayLineTotal(item) {
    return item.quantity * item.unitPrice;
  },

  getQuotationDimensions(item) {
    const cutLength = [item.componentCutLength, item.cutLength]
      .map(Number)
      .find((value) => Number.isFinite(value) && value > 0);
    return {
      spec: item.sizeRule || "—",
      cutLength: factoryCutSkus.has(item.sku) && cutLength ? `${cutLength}mm` : ""
    };
  },

  getExcelDisplaySpec(item) {
    return item.sizeRule || "—";
  },

  buildQuotationExportItems(bom) {
    return bom.map((item) => ({ ...item }));
  },

  getLibraryComponentName(type, productByType, fallbackName) {
    return fallbackName(type, productByType);
  }
};
