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

export const aluminumPostWardrobeModelTransforms = {
  components: {
    post: { ...standardTransform, resizeMode: "centerInBay" },
    woodShelf: { ...standardTransform, depthAnchor: "back", depthAnchorBaseDepth: 0.5 },
    glassShelf: { ...standardTransform, depthAnchor: "back", depthAnchorBaseDepth: 0.5 },
    singleRail: { ...standardTransform, resizeMode: "stretchWidthOnly", depthOffset: -0.03 },
    cabinet: { ...standardTransform, depthAnchor: "back", depthAnchorBaseDepth: 0.5 },
    jewelryBox: { ...standardTransform, resizeMode: "centerInBay", depthAnchor: "back", depthAnchorBaseDepth: 0.5 }
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
    componentTypes: ["jewelryBox"],
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
    if (componentType === "woodShelf" || componentType === "glassShelf") {
      return { x: bayWidth, y: 0.08, z: shelfDepth };
    }
    if (componentType === "singleRail") {
      return { x: bayWidth, y: 0.12, z: 0.12 };
    }
    if (componentType === "cabinet") {
      return { x: bayWidth, y: 0.5, z: shelfDepth };
    }
    if (componentType === "jewelryBox") {
      return { x: bayWidth, y: 0.2, z: shelfDepth };
    }
    return { x: bayWidth, y: 0.3, z: shelfDepth };
  },
  colorMode(componentType) {
    if (componentType === "singleRail") return "frame";
    if (componentType === "woodShelf" || componentType === "cabinet") return "wood";
    return "original";
  }
};
