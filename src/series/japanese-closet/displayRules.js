const railSkus = new Set([
  "JP-RAIL",
  "JP-RAIL-DOUBLE",
  "JP-SINGLE-RAIL",
  "JP-DOUBLE-RAIL"
]);

const webFullPricePieceMeasuredBracketSkus = new Set([
  "JP-TOP-BRACKET",
  "JP-SHELF-BRACKET"
]);

const quotationPieceMeasuredSkus = new Set([
  "JP-SHELF-BRACKET",
  "JP-STORAGE-BRACKET"
]);

const quotationTopBracketSku = "JP-TOP-BRACKET";

export const japaneseClosetDisplayRules = {
  defaultOpenBomGroups: new Set([
    "立柱系统",
    "木顶板系统",
    "木层板系统",
    "挂衣系统",
    "柜体系统"
  ]),

  factoryCutSkus: new Set([
    "JP-WOOD-TOP",
    "JP-WOOD-SHELF",
    "JP-CABINET"
  ]),

  getBomDisplaySpec(item) {
    if (railSkus.has(item.sku)) return "1m";
    if (item.sku === "JP-CORNER-BRACKET") return "—";
    return item.sizeRule || "—";
  },

  getBomDisplayQuantity(item) {
    return item.sku === "JP-RAIL-DOUBLE" ? item.quantity * 2 : item.quantity;
  },

  getBomDisplayUnitPrice(item) {
    return item.sku === "JP-RAIL-DOUBLE" ? item.unitPrice / 2 : item.unitPrice;
  },

  getWebDisplayUnit(item) {
    return webFullPricePieceMeasuredBracketSkus.has(item.sku) ? "支" : item.unit;
  },

  getWebDisplayQuantity(item) {
    return webFullPricePieceMeasuredBracketSkus.has(item.sku)
      ? item.quantity * 2
      : this.getBomDisplayQuantity(item);
  },

  getWebDisplayUnitPrice(item) {
    return this.getBomDisplayUnitPrice(item);
  },

  getWebDisplayLineTotal(item) {
    return this.getWebDisplayQuantity(item) * this.getWebDisplayUnitPrice(item);
  },

  getQuotationDisplayUnit(item) {
    return quotationPieceMeasuredSkus.has(item.sku) || item.sku === quotationTopBracketSku
      ? "支"
      : item.unit;
  },

  getQuotationDisplayQuantity(item) {
    return quotationPieceMeasuredSkus.has(item.sku) || item.sku === quotationTopBracketSku
      ? item.quantity * 2
      : this.getBomDisplayQuantity(item);
  },

  getQuotationDisplayUnitPrice(item) {
    return item.sku === "JP-STORAGE-BRACKET"
      ? item.unitPrice / 2
      : this.getBomDisplayUnitPrice(item);
  },

  getQuotationDisplayLineTotal(item) {
    return this.getQuotationDisplayQuantity(item) * this.getQuotationDisplayUnitPrice(item);
  },

  getQuotationDimensions(item, config) {
    const cuttableSkus = new Set([
      "JP-WOOD-TOP",
      "JP-WOOD-SHELF",
      "JP-CABINET",
      "JP-RAIL",
      "JP-RAIL-DOUBLE"
    ]);
    const depth = Number(config.shelfDepth || config.depth);
    let spec = item.sizeRule || "—";

    if (item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF") {
      spec = Number.isFinite(depth) && depth > 0 ? `${depth}mm` : "—";
    } else if (item.sku === "JP-CABINET") {
      spec = Number.isFinite(depth) && depth > 0 ? `${depth}mm` : item.sizeRule || "—";
    } else if (item.sku === "JP-RAIL" || item.sku === "JP-RAIL-DOUBLE") {
      spec = "—";
    } else if (item.sku === "JP-HORIZONTAL-RAIL") {
      spec = item.sizeRule || "—";
    } else if (item.sku === "JP-CORNER-BRACKET") {
      spec = "—";
    }

    if (!cuttableSkus.has(item.sku)) return { spec, cutLength: "" };
    const rawCutLength = [item.componentCutLength, item.cutLength]
      .map(Number)
      .find((value) => Number.isFinite(value) && value > 0);
    return {
      spec,
      cutLength: rawCutLength ? `${rawCutLength}mm` : ""
    };
  },

  getExcelDisplaySpec(item, design) {
    if (item.sku === "JP-HORIZONTAL-RAIL") return item.sizeRule || "—";
    if (item.sku === "JP-RAIL" || item.sku === "JP-RAIL-DOUBLE") {
      const directLength = [item.componentCutLength, item.cutLength, item.visualScaleWidth]
        .map(Number)
        .find((value) => Number.isFinite(value) && value > 0);
      if (directLength) return `${directLength}mm`;

      const componentType = item.sku === "JP-RAIL" ? "singleRail" : "doubleRail";
      const cutLengths = uniquePlacementLengths(design, componentType, [
        "componentCutLength",
        "cutLength",
        "visualScaleWidth"
      ]);
      if (cutLengths.length) return cutLengths.map((value) => `${value}mm`).join(" / ");
      return item.sizeRule || "—";
    }
    if (item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF") {
      if (Number.isFinite(Number(item.componentCutLength))) {
        return `${Number(item.componentCutLength)}mm`;
      }
      const componentType = item.sku === "JP-WOOD-TOP" ? "woodTop" : "woodShelf";
      const cutLengths = uniquePlacementLengths(design, componentType, ["componentCutLength"]);
      if (cutLengths.length) return cutLengths.map((value) => `${value}mm`).join(" / ");
    }
    return this.getBomDisplaySpec(item);
  },

  buildQuotationExportItems(bom, design, config) {
    const exportItems = bom.map((item) => ({ ...item }));
    const existingWoodSkus = new Set(exportItems
      .filter((item) => item.sku === "JP-WOOD-TOP" || item.sku === "JP-WOOD-SHELF")
      .map((item) => item.sku));
    const woodTypes = [
      { componentType: "woodTop", sku: "JP-WOOD-TOP", bomGroup: "木顶板系统" },
      { componentType: "woodShelf", sku: "JP-WOOD-SHELF", bomGroup: "木层板系统" }
    ];

    woodTypes.forEach(({ componentType, sku, bomGroup }) => {
      if (existingWoodSkus.has(sku)) return;
      const product = design.productByType?.[componentType];
      const quantitiesByCutLength = new Map();
      design.placements
        .filter((placement) => placement.componentType === componentType)
        .forEach((placement) => {
          const cutLength = Number(placement.componentCutLength);
          if (!Number.isFinite(cutLength) || cutLength <= 0) {
            throw new Error(`${sku} is missing componentCutLength.`);
          }
          quantitiesByCutLength.set(
            cutLength,
            (quantitiesByCutLength.get(cutLength) || 0) + Number(placement.quantity || 1)
          );
        });
      quantitiesByCutLength.forEach((quantity, componentCutLength) => {
        exportItems.push({
          ...product,
          sku,
          nameCn: product?.nameCn || (componentType === "woodTop" ? "木顶板" : "木层板"),
          componentCutLength,
          quantity,
          unit: product?.unit || "块",
          unitPrice: Number(product?.unitPrice || 0),
          lineTotal: quantity * Number(product?.unitPrice || 0),
          color: config.panelColor || "Wood Brown",
          note: "工厂剪尺",
          bomGroup
        });
      });
    });
    return exportItems;
  },

  getLibraryComponentName(type, productByType, fallbackName) {
    if (type === "woodTop") return "木顶板（不含板材）";
    if (type === "woodShelf") return "木层板（不含板材）";
    if (type === "cabinet") return "柜子（不售卖）";
    return fallbackName(type, productByType);
  }
};

function uniquePlacementLengths(design, componentType, fields) {
  return [...new Set(design.placements
    .filter((placement) => placement.componentType === componentType)
    .map((placement) => Number(fields
      .map((field) => placement[field])
      .find((value) => Number.isFinite(Number(value)) && Number(value) > 0)))
    .filter((value) => Number.isFinite(value) && value > 0))];
}
