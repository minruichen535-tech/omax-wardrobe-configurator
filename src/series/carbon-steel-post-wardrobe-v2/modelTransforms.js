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

export const carbonSteelPostWardrobeV2ModelTransforms = {
  components: {
    post: { ...standardTransform, scaleAxis: "y", resizeMode: "stretchHeightOnly" },
    woodShelf: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back", depthAnchorBaseDepth: 0.415 },
    shoesShelf: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back", depthAnchorBaseDepth: 0.415 },
    singleRail: { ...standardTransform, resizeMode: "stretchWidthOnly" },
    cabinet: { ...standardTransform, resizeMode: "stretchWidthOnly", depthAnchor: "back", depthAnchorBaseDepth: 0.5 }
  },
  post: {
    targetDepth: 0.02,
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
    componentTypes: [],
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

  targetSize(componentType, bayWidth, shelfDepth) {
    if (componentType === "woodShelf") return { x: bayWidth, y: 0.066, z: 0.415 };
    if (componentType === "shoesShelf") return { x: bayWidth, y: 0.15849, z: 0.415 };
    if (componentType === "singleRail") return { x: bayWidth, y: 0.04, z: 0.04 };
    if (componentType === "cabinet") return { x: bayWidth, y: 0.531839, z: 0.5 };
    return { x: bayWidth, y: 0.3, z: shelfDepth };
  },

  colorMode(componentType) {
    if (componentType === "woodShelf" || componentType === "shoesShelf" || componentType === "cabinet") return "wood";
    if (componentType === "singleRail" || componentType === "post") return "frame";
    return "original";
  }
};
