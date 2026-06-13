export const aluminumBaseSupportedDisplayRules = createAluminumBaseSupportedDisplayRules();

export function createAluminumBaseSupportedDisplayRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    defaultOpenBomGroups: new Set(products.map((product) => product.bomGroup).filter(Boolean)),
    factoryCutSkus: new Set(products.filter((product) => product.cuttable).map((product) => product.sku)),
    getBomDisplaySpec(item) {
      const cutLength = Number(item.componentCutLength || item.cutLength);
      return Number.isFinite(cutLength) && cutLength > 0 ? `${cutLength}mm` : item.sizeRule || "—";
    },
    getBomDisplayQuantity(item) { return item.quantity; },
    getBomDisplayUnitPrice(item) { return item.unitPrice; },
    getWebDisplayUnit(item) { return item.unit; },
    getWebDisplayQuantity(item) { return item.quantity; },
    getWebDisplayUnitPrice(item) { return item.unitPrice; },
    getWebDisplayLineTotal(item) { return item.quantity * item.unitPrice; },
    getQuotationDisplayUnit(item) { return item.unit; },
    getQuotationDisplayQuantity(item) { return item.quantity; },
    getQuotationDisplayUnitPrice(item) { return item.unitPrice; },
    getQuotationDisplayLineTotal(item) { return item.quantity * item.unitPrice; },
    getQuotationDimensions(item) {
      const cutLength = Number(item.componentCutLength || item.cutLength);
      return {
        spec: item.sizeRule || "—",
        cutLength: item.cuttable && Number.isFinite(cutLength) && cutLength > 0
          ? `${cutLength}mm`
          : ""
      };
    },
    getExcelDisplaySpec(item) {
      return this.getBomDisplaySpec(item);
    },
    buildQuotationExportItems(bom) {
      return bom.map((item) => ({ ...item }));
    },
    getLibraryComponentName(type, productByType, fallbackName) {
      return fallbackName(type, productByType);
    }
  };
}
