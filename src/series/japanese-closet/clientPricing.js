const JAPANESE_CLIENT_BASE_GROUP_PRICE = 660;
const japaneseClientWallIds = new Set(["back", "left", "right"]);

const structuralComponentTypes = new Set([
  "woodTop",
  "post",
  "postCap",
  "postAccessorySet",
  "adjustFoot",
  "topBracket",
  "horizontalRail",
  "cornerBracket",
  "shelfBracket",
  "railHanger",
  "railHangerDouble",
  "cabinetBracket",
  "storageBracket",
  "screw",
  "fastener",
  "cap"
]);

const structuralSkus = new Set([
  "JP-WOOD-TOP",
  "JP-POST",
  "JP-POST-2000",
  "JP-POST-2400",
  "JP-POST-CAP-FOOT-SET",
  "JP-TOP-BRACKET",
  "JP-HORIZONTAL-RAIL",
  "JP-CORNER-BRACKET",
  "JP-SHELF-BRACKET",
  "JP-RAIL-HANGER",
  "JP-RAIL-HANGER-DOUBLE",
  "JP-CABINET-BRACKET",
  "JP-STORAGE-BRACKET",
  "JP-SCREW-4X16",
  "JP-SCREW-4X20",
  "JP-EXPANSION-8X65",
  "JP-CAP"
]);

const drawerTypes = new Set(["drawerSingle", "drawerDouble"]);

export function calculateJapaneseClientRetailPrice({ design, config, products }) {
  const activeBayCount = getJapaneseClientBaseGroupCount(design);
  const productBySku = design?.productBySku || Object.fromEntries(
    (Array.isArray(products) ? products : []).map((product) => [product.sku, product])
  );
  const placements = getJapaneseClientPricingPlacements(design);
  const lines = [{
    key: "base-structure",
    placementId: "",
    componentType: "baseGroup",
    productSku: "",
    name: "基础结构",
    quantity: activeBayCount,
    unit: "组",
    clientPrice: JAPANESE_CLIENT_BASE_GROUP_PRICE,
    unitPrice: JAPANESE_CLIENT_BASE_GROUP_PRICE,
    lineTotal: activeBayCount * JAPANESE_CLIENT_BASE_GROUP_PRICE,
    includedItems: [
      "木顶板",
      "顶板托臂",
      "水平导轨",
      "立柱系统",
      "顶盖/底脚",
      "固定角马",
      "水平导轨/基础结构",
      "紧固件"
    ],
    includedSkus: [
      "JP-WOOD-TOP",
      "JP-TOP-BRACKET",
      "JP-HORIZONTAL-RAIL",
      "JP-POST / JP-POST-2000 / JP-POST-2400",
      "JP-POST-CAP-FOOT-SET",
      "JP-CORNER-BRACKET",
      "JP-SCREW-4X16",
      "JP-SCREW-4X20",
      "JP-EXPANSION-8X65",
      "JP-CAP"
    ]
  }];
  const warnings = [];
  placements.forEach((placement) => {
    const componentType = placement.componentType;
    const product = productBySku[placement.productSku]
      || design?.productByType?.[componentType]
      || null;
    const quantity = Number(placement.quantity || 1);

    if (componentType === "singleRail") {
      addComponentLine(lines, placement, product, getRetailPrice(product), quantity, product?.nameCn || "挂衣杆（单）");
      return;
    }
    if (componentType === "doubleRail") {
      addComponentLine(lines, placement, product, getRetailPrice(product), quantity, product?.nameCn || "挂衣杆（双）");
      return;
    }
    if (componentType === "woodShelf") {
      const isReplacement = isBaseRailReplacement(placement);
      const price = getRetailPrice(product);
      addComponentLine(
        lines,
        placement,
        product,
        isReplacement ? price - getRetailPrice(productBySku[placement.replacedRailSku] || productBySku["JP-RAIL"]) : price,
        quantity,
        "木层板"
      );
      return;
    }
    if (drawerTypes.has(componentType)) {
      const drawerLine = createDrawerLine(placement, productBySku, quantity);
      if (drawerLine) lines.push(drawerLine);
      return;
    }
    if (structuralComponentTypes.has(componentType) || structuralSkus.has(product?.sku)) return;

    const price = getRetailPrice(product);
    if (!Number.isFinite(price) || price <= 0) {
      warnings.push(`未找到日式 client 零售价：${product?.sku || componentType}`);
      return;
    }
    addComponentLine(lines, placement, product, price, quantity, product?.nameCn || componentType);
  });

  const mergedLines = [
    lines[0],
    ...mergeJapaneseClientAccessoryLines(lines.slice(1))
  ];
  return {
    total: mergedLines.reduce((total, line) => total + line.lineTotal, 0),
    lines: mergedLines,
    warnings: [...new Set(warnings)],
    activeBayCount,
    config
  };
}

function mergeJapaneseClientAccessoryLines(lines) {
  const merged = [];
  const byKey = new Map();
  lines.forEach((line) => {
    const imageKey = line.image || line.imageSku || line.productSku || line.componentType || "";
    const key = [
      line.productSku || "",
      line.name || "",
      line.unit || "",
      line.clientPrice ?? "",
      imageKey
    ].join("\u001f");
    const existing = byKey.get(key);
    if (!existing) {
      const copy = { ...line };
      byKey.set(key, copy);
      merged.push(copy);
      return;
    }
    existing.quantity += Number(line.quantity || 0);
    existing.lineTotal = existing.quantity * Number(existing.clientPrice || 0);
    existing.unitPrice = existing.clientPrice;
  });
  return merged;
}

function getJapaneseClientBaseGroupCount(design) {
  const activeWalls = Array.isArray(design?.activeWalls) ? design.activeWalls : [];
  return activeWalls
    .filter((wall) => japaneseClientWallIds.has(wall?.id))
    .reduce(
      (total, wall) => total + (Array.isArray(wall?.bays) ? wall.bays.length : Number(wall?.bayCount || 0)),
      0
    );
}

// Japanese Client 报价只读取最终设计中属于后墙、左墙或右墙的合法 placement。
function getJapaneseClientPricingPlacements(design) {
  const placements = Array.isArray(design?.placements) ? design.placements : [];
  return placements.filter((placement) => (
    japaneseClientWallIds.has(placement?.wallId || placement?.wall)
  ));
}

function createDrawerLine(placement, productBySku, quantity) {
  const isDouble = placement.componentType === "drawerDouble";
  const product = productBySku[placement.productSku] || productBySku["JP-drawerDouble"];
  const packagePrice = getRetailPrice(product);
  const insertSku = isDouble ? "" : placement.productSku;
  return {
    key: `${placement.id}:drawer-package`,
    placementId: placement.id,
    componentType: placement.componentType,
    productSku: placement.productSku || "",
    name: isDouble ? "双抽" : product?.nameCn || "抽屉",
    imageSku: insertSku,
    quantity,
    unit: product?.unit || "个",
    clientPrice: packagePrice,
    unitPrice: packagePrice,
    lineTotal: packagePrice * quantity,
    includedItems: [],
    includedSkus: product?.sku ? [product.sku] : []
  };
}

function addComponentLine(lines, placement, product, unitPrice, quantity, name) {
  lines.push({
    key: placement.id,
    placementId: placement.id,
    componentType: placement.componentType,
    productSku: placement.productSku || product?.sku || "",
    name,
    quantity,
    unit: product?.unit || "个",
    clientPrice: unitPrice,
    unitPrice,
    lineTotal: unitPrice * quantity,
    includedItems: [],
    includedSkus: product?.sku ? [product.sku] : []
  });
}

function getRetailPrice(product) {
  const workbookPrice = Number(product?.japaneseClientPrice);
  return Number.isFinite(workbookPrice) && workbookPrice >= 0 ? workbookPrice : 0;
}

function isBaseRailReplacement(placement) {
  return placement?.replacesBaseRail === true
    || placement?.isBaseRailReplacement === true
    || placement?.replacedComponentType === "singleRail"
    || placement?.replacementOf === "singleRail";
}
