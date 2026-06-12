export const carbonSteelPostWardrobeV2DisplayRules = {
  defaultOpenBomGroups: new Set([
    "立柱系统",
    "层板系统",
    "挂衣系统",
    "柜体系统",
    "配件系统"
  ]),
  factoryCutSkus: new Set([
    "TLZ-WOOD-SHELF",
    "TLZ-004-1",
    "TLZ-CABINET",
    "TLZ-SHOES-SHELF"
  ]),

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
      cutLength: Number.isFinite(cutLength) && cutLength > 0 ? `${cutLength}mm` : ""
    };
  },
  getExcelDisplaySpec(item) { return item.sizeRule || "—"; },
  buildQuotationExportItems(bom) { return bom.map((item) => ({ ...item })); },
  getLibraryComponentName(type, productByType, fallbackName) {
    return fallbackName(type, productByType);
  }
};
