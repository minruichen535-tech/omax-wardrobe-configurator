const FIXED_ACCESSORY_COMPONENTS = new Set([
  "trouserRack",
  "jewelryBox",
  "drawer",
  "drawerCabinet",
  "leatherBasket",
  "storageBasket"
]);

const FIXED_ACCESSORY_WIDTH_PRIORITY = Object.freeze([900, 800, 700, 600, 500]);

export function selectPreferredAccessoryBay(candidateBays = [], componentType) {
  if (!FIXED_ACCESSORY_COMPONENTS.has(componentType)) return candidateBays;
  return candidateBays
    .map((bay, order) => ({ bay, order }))
    .sort((left, right) => (
      getAccessoryBayWidthRank(left.bay) - getAccessoryBayWidthRank(right.bay)
      || left.order - right.order
    ))
    .map(({ bay }) => bay);
}

export function isFixedWidthAccessory(componentType) {
  return FIXED_ACCESSORY_COMPONENTS.has(componentType);
}

function getAccessoryBayWidthRank(bay) {
  const width = normalizeAccessoryBayWidth(getAccessoryBayWidth(bay));
  const index = FIXED_ACCESSORY_WIDTH_PRIORITY.indexOf(width);
  return index >= 0 ? index : FIXED_ACCESSORY_WIDTH_PRIORITY.length;
}

function normalizeAccessoryBayWidth(value) {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) return null;
  return FIXED_ACCESSORY_WIDTH_PRIORITY.find((allowedWidth) => width >= allowedWidth) || null;
}

function getAccessoryBayWidth(bay) {
  if (!bay || typeof bay !== "object") return null;
  return Number(
    bay.accessoryBayWidth
    ?? bay.innerBayWidth
    ?? bay.usableComponentWidth
    ?? bay.widthMm
    ?? bay.bayWidth
    ?? bay.rawBayWidth
    ?? bay.width
  ) || null;
}
