export const japaneseClosetCuttingRules = {
  maxPostSpanMm: 1000,
  minHeightMm: 1800,
  maxHeightMm: 3500,
  sideWallLengthAdjustmentMm: 510,
  supportsULayoutModes: true,
  preservesExistingUWallGeometry: true,
  reuseBackFirstSideWallPlansForLLayouts: true,
  uLayoutModeControl: "icons",
  postProfileWidthMm: 25,
  componentTypes: [
    "woodTop",
    "woodShelf",
    "singleRail",
    "doubleRail",
    "cabinet",
    "jewelryBox",
    "trouserRack"
  ],
  fixedModuleTypes: ["jewelryBox", "trouserRack"],
  fixedModuleWidths: [500, 600, 700, 800, 900],
  defaultHeightByType: {
    woodTop: 2400,
    woodShelf: 1200,
    singleRail: 1600,
    doubleRail: 1500,
    cabinet: 300,
    jewelryBox: 900,
    trouserRack: 900,
    drawerSingle: 900,
    drawerDouble: 900
  },
  componentFallbackNames: {
    woodTop: "木顶板",
    woodShelf: "木层板",
    singleRail: "挂衣杆",
    doubleRail: "挂衣杆",
    cabinet: "柜子",
    jewelryBox: "首饰盒",
    trouserRack: "裤架",
    drawerSingle: "抽屉",
    drawerDouble: "双抽屉"
  },
  defaultIconsByType: {
    woodTop: "images/icons/wood-top.svg",
    woodShelf: "images/icons/wood-shelf.svg",
    singleRail: "images/icons/single-rail.svg",
    doubleRail: "images/icons/double-rail.svg",
    cabinet: "images/icons/cabinet-single.svg",
    jewelryBox: "images/icons/jewelry-box.svg",
    trouserRack: "images/icons/trouser-rack.svg",
    drawerSingle: "images/icons/cabinet-single.svg",
    drawerDouble: "images/icons/cabinet-single.svg"
  },
  getInnerBayWidth(totalLength, bayCount) {
    const length = Number(totalLength);
    const count = Number(bayCount);
    if (!Number.isFinite(length) || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(0, (length - (count + 1) * this.postProfileWidthMm) / count);
  },
  getCutLength(componentType, usableBayWidth) {
    if (componentType === "woodTop" || componentType === "woodShelf") {
      return Math.floor(usableBayWidth - 5);
    }
    if (componentType === "singleRail" || componentType === "doubleRail") {
      return Math.floor(usableBayWidth - 15);
    }
    if (componentType === "cabinet") return Math.round(usableBayWidth);
    if (componentType === "drawerSingle" || componentType === "drawerDouble") return Math.round(usableBayWidth);
    return null;
  },
  getVisualScaleWidth(componentType, innerBayWidth, componentCutLength, moduleWidth) {
    const extraRailVisualWidth = 5;
    if (componentType === "trouserRack" || componentType === "pantsRack") return innerBayWidth;
    if (this.fixedModuleTypes.includes(componentType)) {
      return moduleWidth || normalizeFixedModuleWidth(innerBayWidth, this.fixedModuleWidths);
    }
    if (componentType === "woodTop" || componentType === "woodShelf") {
      return Math.round(innerBayWidth - 5);
    }
    if (componentType === "singleRail" || componentType === "doubleRail") {
      return innerBayWidth + extraRailVisualWidth;
    }
    if (componentType === "cabinet") return innerBayWidth;
    if (componentType === "drawerSingle" || componentType === "drawerDouble") return innerBayWidth;
    return innerBayWidth;
  }
};

function normalizeFixedModuleWidth(width, options) {
  const value = Number(width);
  if (!Number.isFinite(value) || value <= 0) return options[0];
  return options.find((option) => option >= value) || options[options.length - 1];
}
