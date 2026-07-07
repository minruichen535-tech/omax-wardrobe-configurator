const CUSTOMER_PRICE_RULES = Object.freeze({
  baseFramePerBay: 650,
  includedTopShelfPerBay: 190,
  woodShelf: 160,
  storageBasket120: 500,
  storageBasket180: 550,
  singleRail: 40,
  doubleRail: 80,
  cabinet: 800,
  fullLengthMirror: 150,
  trouserRack: 500,
  drawerBracket: 0
});

const DRAWER_INSERT_PRICES = Object.freeze({
  "JP-drawer-wire-basket": 550,
  "JP-drawer-multi-storage": 650,
  "JP-drawer-jewelry": 880,
  "JP-drawer-underwear-a": 850,
  "JP-drawer-underwear-b": 880,
  "JP-drawer-leather-storage": 750,
  "JP-drawer-wire-basket-short": 500
});

const VISUAL_ONLY_TYPES = new Set([
  "clothes",
  "shortHang",
  "longHang",
  "shoe",
  "shoes",
  "bag",
  "luggage",
  "bedding",
  "decor",
  "decorativeProp"
]);

const SHELF_TYPES = new Set([
  "woodShelf",
  "displayShelf",
  "glassShelf",
  "shoeShelf",
  "shoesShelf"
]);

const CABINET_TYPES = new Set([
  "cabinet",
  "drawerCabinet",
  "storageCabinet"
]);

const STORAGE_BASKET_TYPES = new Set([
  "storageBasket",
  "drawerBasket",
  "basket",
  "meshBasket",
  "wireBasket",
  "leatherBasket"
]);

export function calculatePlannerCustomerPrice(source = {}) {
  const placements = getPlannerPricingPlacements(source);
  const bayCount = getPlannerCustomerBayCount(source);
  const basePrice = bayCount * (
    CUSTOMER_PRICE_RULES.baseFramePerBay
    + CUSTOMER_PRICE_RULES.includedTopShelfPerBay
  );
  const placementsPrice = placements.reduce((sum, placement) => (
    sum + pricePlacementForCustomer(placement, { placements, source })
  ), 0);
  return Math.round(basePrice + placementsPrice);
}

export function pricePlacementForCustomer(placement = {}, context = {}) {
  const componentType = placement.componentType || placement.type || "";
  if (!componentType || VISUAL_ONLY_TYPES.has(componentType)) return 0;
  if (componentType === "woodTop" || componentType === "topShelf") {
    return CUSTOMER_PRICE_RULES.includedTopShelfPerBay;
  }
  if (SHELF_TYPES.has(componentType)) return CUSTOMER_PRICE_RULES.woodShelf;
  if (componentType === "singleRail") return CUSTOMER_PRICE_RULES.singleRail;
  if (componentType === "doubleRail") return CUSTOMER_PRICE_RULES.doubleRail;
  if (CABINET_TYPES.has(componentType)) return CUSTOMER_PRICE_RULES.cabinet;
  if (componentType === "fullLengthMirror" || componentType === "mirror") {
    return CUSTOMER_PRICE_RULES.fullLengthMirror;
  }
  if (componentType === "trouserRack") return CUSTOMER_PRICE_RULES.trouserRack;
  if (componentType === "drawerSingle" || componentType === "drawer") {
    return CUSTOMER_PRICE_RULES.woodShelf
      + getDrawerInsertCustomerPrice(placement.productSku)
      + CUSTOMER_PRICE_RULES.drawerBracket * 2;
  }
  if (componentType === "drawerDouble") {
    return CUSTOMER_PRICE_RULES.woodShelf
      + getDrawerInsertCustomerPrice(placement.topDrawerSku)
      + getDrawerInsertCustomerPrice(placement.bottomDrawerSku)
      + CUSTOMER_PRICE_RULES.drawerBracket;
  }
  if (componentType === "jewelryBox") {
    return getDrawerInsertCustomerPrice("JP-drawer-jewelry");
  }
  if (STORAGE_BASKET_TYPES.has(componentType)) {
    return getStorageBasketCustomerPrice(placement, context);
  }
  return 0;
}

export function getDrawerInsertCustomerPrice(sku) {
  return DRAWER_INSERT_PRICES[sku] || 0;
}

function getStorageBasketCustomerPrice(placement = {}) {
  const sku = String(placement.productSku || placement.sku || "");
  if (sku === "JP-drawer-leather-storage") return DRAWER_INSERT_PRICES[sku];
  if (sku === "JP-drawer-wire-basket-short") return DRAWER_INSERT_PRICES[sku];
  const depth = Number(placement.depth || placement.productDepth || placement.basketDepth);
  if (Number.isFinite(depth) && depth > 0 && depth <= 120) {
    return CUSTOMER_PRICE_RULES.storageBasket120;
  }
  return CUSTOMER_PRICE_RULES.storageBasket180;
}

function getPlannerPricingPlacements(source = {}) {
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.placements)) return source.placements;
  if (Array.isArray(source.explicitPlacements)) return source.explicitPlacements;
  if (Array.isArray(source.configPreset?.explicitPlacements)) {
    return source.configPreset.explicitPlacements;
  }
  if (Array.isArray(source.configPreset?.placements)) {
    return source.configPreset.placements;
  }
  return [];
}

function getPlannerCustomerBayCount(source = {}) {
  const configPreset = source.configPreset || source;
  const japaneseLayout = configPreset.japaneseWallLayout || source.japaneseWallLayout || null;
  if (japaneseLayout) {
    const layoutBayCount = ["back", "left", "right"].reduce((sum, wallId) => {
      const wall = japaneseLayout[wallId];
      return sum + (wall ? Math.max(0, Number(wall.bayCount) || 0) : 0);
    }, 0);
    if (layoutBayCount > 0) return layoutBayCount;
  }
  const wallBayCount = source.walls
    ? Object.values(source.walls).reduce((sum, wall) => {
      if (!wall?.enabled) return sum;
      return sum + Math.max(0, Number(wall.bayCount) || 0);
    }, 0)
    : 0;
  if (wallBayCount > 0) return wallBayCount;
  const bayCount = Number(configPreset.bayCount || source.bayCount);
  return Number.isFinite(bayCount) && bayCount > 0 ? bayCount : 0;
}
