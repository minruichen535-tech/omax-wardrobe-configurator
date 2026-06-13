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

const fixedDepthTransform = {
  ...standardTransform,
  resizeMode: "stretchWidthFixedDepth",
  depthAnchor: "back",
  depthAnchorBaseDepth: 0.5
};

export const aluminumBaseSupportedModelTransforms = {
  componentWallClearanceMm: 18,
  woodShelfBoardExtensionMm: 16,
  components: {
    post: { ...standardTransform, scaleAxis: "y", resizeMode: "stretchHeightOnly" },
    backPanel: { ...standardTransform, resizeMode: "stretchXYZ", depthAnchor: "back", depthAnchorBaseDepth: 0.5 },
    woodShelf: { ...fixedDepthTransform },
    glassShelf: { ...fixedDepthTransform },
    singleRail: { ...fixedDepthTransform },
    cabinet: { ...fixedDepthTransform },
    jewelryBox: { ...fixedDepthTransform },
    mixedStorage: { ...fixedDepthTransform },
    trouserRack: { ...fixedDepthTransform }
  },
  post: {
    targetDepth: 0.08,
    backEndVisualInsetMm: 0,
    rotateRightWallByPi: false
  },
  rail: {
    lateralVisualOffset: 0,
    backDepthOffset: 0,
    leftDepthOffset: 0,
    rightDepthOffset: 0
  },
  fixedModule: {
    componentTypes: ["jewelryBox", "mixedStorage", "trouserRack"],
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
  targetSize(componentType, bayWidth) {
    if (componentType === "backPanel") return { x: bayWidth, y: 3, z: 0.018 };
    if (componentType === "woodShelf" || componentType === "glassShelf") {
      return { x: bayWidth, y: 0.08, z: 0.5 };
    }
    if (componentType === "singleRail") return { x: bayWidth, y: 0.08, z: 0.5 };
    if (componentType === "cabinet") return { x: bayWidth, y: 0.5, z: 0.5 };
    if (/jewelry|Storage|trouser/.test(componentType)) return { x: bayWidth, y: 0.22, z: 0.5 };
    return { x: bayWidth, y: 0.3, z: 0.5 };
  },
  colorMode(componentType) {
    if (componentType === "post" || componentType === "singleRail") return "frame";
    if (componentType === "woodShelf" || componentType === "cabinet" || componentType === "backPanel") return "wood";
    return "original";
  }
};
