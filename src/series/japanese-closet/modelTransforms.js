export const japaneseClosetModelTransforms = {
  components: {
    post: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "centerInBay", alignMode: "bboxCenter" },
    woodTop: { rotation: [0, Math.PI, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: -0.04, resizeMode: "stretchToBay", offsetX: 0, depthAnchor: "back", depthAnchorBaseDepth: 0.45 },
    woodShelf: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0.015, offsetZ: 0, depthAnchor: "back", depthAnchorBaseDepth: 0.45 },
    railSingle: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0.08, heightOffset: 0, resizeMode: "stretchToBay" },
    railDouble: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0.08, heightOffset: 0, resizeMode: "stretchToBay" },
    singleRail: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0 },
    doubleRail: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0 },
    cabinet: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0.015 },
    jewelryBox: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "centerInBay", offsetX: 0.015 },
    trouserRack: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchWidthAndDepth", offsetX: 0 }
  },
  post: {
    targetDepth: 0.1,
    backEndVisualInsetMm: 25,
    rotateRightWallByPi: true
  },
  rail: {
    lateralVisualOffset: 0.008,
    backDepthOffset: -0.05,
    leftDepthOffset: -0.05,
    rightDepthOffset: 0.05
  },
  fixedModule: {
    componentTypes: ["trouserRack", "jewelryBox"],
    lateralVisualOffset: 0.015
  },
  woodTop: {
    enabled: true,
    edgeAdjustment: 0.019,
    cornerBackClearance: 0.015,
    cornerOpenExtension: 0.02,
    sideOpenExtension: 0.02,
    visibleMeshName: "Geom3D",
    visibleExtension: 0.006
  },
  targetSize(componentType, bayWidth, shelfDepth) {
    const defaultDepth = 0.5;
    if (componentType === "woodTop" || componentType === "woodShelf") {
      return { x: bayWidth, y: 0.08, z: shelfDepth };
    }
    if (componentType === "singleRail" || componentType === "doubleRail") {
      return { x: bayWidth, y: 0.16, z: 0.18 };
    }
    if (componentType === "cabinet") {
      return { x: bayWidth, y: 0.5, z: defaultDepth * 0.92 };
    }
    if (componentType === "jewelryBox" || componentType === "trouserRack") {
      return { x: bayWidth, y: 0.22, z: defaultDepth * 0.86 };
    }
    return { x: bayWidth, y: 0.3, z: defaultDepth };
  },
  colorMode(componentType) {
    if (componentType === "singleRail" || componentType === "doubleRail") return "frame";
    if (componentType === "woodTop" || componentType === "woodShelf" || componentType === "cabinet") return "wood";
    return "original";
  }
};
