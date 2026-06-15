export const wallMountedV2DisplayRules = createWallMountedV2DisplayRules();

export function createWallMountedV2DisplayRules(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    defaultOpenBomGroups: new Set(products.map((product) => product.bomGroup).filter(Boolean)),
    factoryCutSkus: new Set(products
      .filter((product) => product.cuttable && !product.sellable)
      .map((product) => product.sku)),
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
    buildQuotationExportItems(bom, design, config) {
      const items = bom.map((item) => ({ ...item }));
      const existing = new Set(items.map((item) => `${item.sku}:${item.componentCutLength || ""}`));
      design.placements.forEach((placement) => {
        const product = design.productBySku[placement.productSku];
        if (!product?.cuttable || product.sellable) return;
        const cutLength = Number(placement.componentCutLength);
        const key = `${product.sku}:${cutLength}`;
        const current = items.find((item) => `${item.sku}:${item.componentCutLength || ""}` === key);
        if (current) {
          current.quantity += Number(placement.quantity || 1);
          current.lineTotal = current.quantity * Number(current.unitPrice || 0);
          return;
        }
        if (existing.has(key)) return;
        existing.add(key);
        items.push({
          ...product,
          componentCutLength: Number.isFinite(cutLength) ? cutLength : null,
          quantity: Number(placement.quantity || 1),
          unitPrice: Number(product.unitPrice || 0),
          lineTotal: Number(placement.quantity || 1) * Number(product.unitPrice || 0),
          color: config.panelColor || "Wood Brown",
          note: "工厂剪尺"
        });
      });
      return items;
    },
    getLibraryComponentName(type, productByType, fallbackName) {
      if (type === "jewelryBox") return "首饰盒";
      if (type === "jewelryBoxThreeDrawer") return "首饰盒三抽";
      if (type === "trouserRack") return "裤架 / 组合收纳";
      if (type === "trouserRackThreeDrawer") return "组合收纳三抽";
      return fallbackName(type, productByType);
    }
  };
}
