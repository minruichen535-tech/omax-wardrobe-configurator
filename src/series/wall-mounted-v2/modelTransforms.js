const standardTransform = {
  rotation: [0, 0, 0],
  scaleAxis: "x",
  anchor: "bottomCenter",
  depthOffset: 0,
  heightOffset: 0,
  resizeMode: "stretchToBay",
  alignMode: "bboxCenter",
  offsetX: 0,
  offsetZ: 0
};

export const wallMountedV2ModelTransforms = {
  components: {
    post: { ...standardTransform, scaleAxis: "y", resizeMode: "stretchHeightOnly" },
    backPanel: { ...standardTransform, resizeMode: "stretchXYZ", depthAnchor: "back" },
    woodShelf: { ...standardTransform, depthAnchor: "back" },
    shoeShelf: {
      ...standardTransform,
      resizeMode: "stretchWidthOnly",
      scaleAxis: "x",
      depthAnchor: "back"
    },
    glassShelf: { ...standardTransform, depthAnchor: "back" },
    singleRail: { ...standardTransform, depthAnchor: "back" },
    cabinet: { ...standardTransform, depthAnchor: "back" },
    jewelryBox: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back" },
    trouserRack: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back" },
    jewelryBoxThreeDrawer: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back" },
    trouserRackThreeDrawer: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back" }
  },
  post: {
    targetDepth: 0.025,
    backEndVisualInsetMm: 0,
    alignBackFaceToWall: true
  },
  backPanel: {
    sideWallPostOverlapMm: 2
  },
  rail: {
    lateralVisualOffset: 0,
    backDepthOffset: 0,
    leftDepthOffset: 0,
    rightDepthOffset: 0
  },
  fixedModule: {
    componentTypes: [
      "jewelryBox",
      "trouserRack",
      "jewelryBoxThreeDrawer",
      "trouserRackThreeDrawer"
    ],
    lateralVisualOffset: 0
  },
  woodTop: {
    enabled: false,
    edgeAdjustment: 0,
    cornerBackClearance: 0,
    cornerOpenExtension: 0,
    sideOpenExtension: 0,
    visibleMeshName: "",
    visibleExtension: 0
  },
  targetSize(componentType, bayWidth, selectedDepth, product) {
    const productDepth = Number(product?.depthRule);
    const depth = Number.isFinite(productDepth) && productDepth > 0
      ? productDepth / 1000
      : selectedDepth || 0.45;
    if (componentType === "backPanel") return { x: bayWidth, y: 2.7, z: depth };
    if (componentType === "woodShelf" || componentType === "shoeShelf" || componentType === "glassShelf") {
      return { x: bayWidth, y: 0.08, z: depth };
    }
    if (componentType === "singleRail") return { x: bayWidth, y: 0.08, z: 0.08 };
    if (componentType === "cabinet") return { x: bayWidth, y: 0.5, z: depth };
    if ([
      "jewelryBox",
      "trouserRack",
      "jewelryBoxThreeDrawer",
      "trouserRackThreeDrawer"
    ].includes(componentType)) {
      return { x: bayWidth, y: 0.22, z: depth };
    }
    return { x: bayWidth, y: 0.3, z: depth };
  },
  colorMode(componentType) {
    if (componentType === "post" || componentType === "singleRail") return "frame";
    if (["woodShelf", "shoeShelf", "cabinet", "backPanel"].includes(componentType)) return "wood";
    return "original";
  }
};
