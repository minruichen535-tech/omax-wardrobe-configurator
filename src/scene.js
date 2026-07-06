import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getFactoryInnerBayWidth, meters } from "./configurator.js?v=cache-20260621-02";
import { resolveSeriesAsset } from "./config/productSeries.js?v=cache-20260621-02";
import { theme } from "./config/theme.js?v=cache-20260621-02";
import { getCuttingRules, getModelTransforms } from "./series/index.js?v=drawer-material-sync-20260702-01";
import {
  getWallMountedRailOffsetPosition
} from "./config/plannerPresetMap.js?v=wall-mounted-placement-rules-20260621-03";

const h = React.createElement;
const loader = new GLTFLoader();
const modelCache = new Map();
const visualAssetModelCache = new Map();
const plannerVisualAssetVersions = {
  default: "position-assets-20260625-01"
};
const HANGING_VISUAL_RAIL_CENTER_TOLERANCE = 0.02;
const clientDrawerDoublePreviewProduct = {
  sku: "CLIENT-DRAWER-DOUBLE-PREVIEW",
  nameCn: "Drawer (Double)",
  modelPath: "products/japanese-closet/models/glb/JP-drawerDouble.glb",
  glbAssetPath: "products/japanese-closet/models/glb/JP-drawerDouble.glb"
};
const drawerDoubleInsertModelPathsBySku = new Map([
  ["JP-drawer-leather-storage", "products/japanese-closet/models/glb/JP-drawer-double-insert-drawer-leather-storage.glb"],
  ["JP-drawer-wire-basket", "products/japanese-closet/models/glb/JP-drawer-double-insert-drawer-wire-basket.glb"],
  ["JP-drawer-wire-basket-short", "products/japanese-closet/models/glb/JP-drawer-double-insert-drawer-wire-basket-short.glb"]
]);
const wireBasketDrawerSkus = new Set([
  "JP-drawer-wire-basket",
  "JP-drawer-wire-basket-short"
]);
const aluminumBaseSupportedUpdatedModelVersions = new Map([
  ["models/TD-007-3-600.glb", "aluminum-base-supported-td-007-3-20260612-01"],
  ["models/TD-007-3-700.glb", "aluminum-base-supported-td-007-3-20260612-01"],
  ["models/TD-007-3-800.glb", "aluminum-base-supported-td-007-3-20260612-01"],
  ["models/TD-007-3-900.glb", "aluminum-base-supported-td-007-3-20260612-01"],
  ["models/TD-007-4-600.glb", "aluminum-base-supported-td-007-4-20260612-01"],
  ["models/TD-007-4-700.glb", "aluminum-base-supported-td-007-4-20260612-01"],
  ["models/TD-007-4-800.glb", "aluminum-base-supported-td-007-4-20260612-01"],
  ["models/TD-007-4-900.glb", "aluminum-base-supported-td-007-4-20260612-01"]
]);

function readComponentDragPayload(dataTransfer) {
  try {
    const payload = JSON.parse(dataTransfer.getData("application/json") || "{}");
    if (payload?.componentType) {
      return {
        componentType: payload.componentType,
        productSku: payload.productSku || dataTransfer.getData("application/x-product-sku") || ""
      };
    }
  } catch (error) {
    // Fall through to the legacy text/plain payload.
  }
  return {
    componentType: dataTransfer.getData("text/plain"),
    productSku: dataTransfer.getData("application/x-product-sku")
  };
}
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const sceneTransformVersion = "scene-transform-map-20260531-01";
const sceneRuntimeVersion = "woodtop-alignment-verified-20260605-01";
const aluminumPostModelPaths = {
  "round:ceiling-mounted": "LZ-001-1.glb",
  "round:wall-mounted": "LZ-001-2.glb",
  "square:ceiling-mounted": "LZ-007-1.glb",
  "square:wall-mounted": "LZ-007-2.glb"
};

console.log("[scene.js]", sceneTransformVersion);

export function WardrobeScene({ config, design, series, debug = false, selectedId = "", onDropComponent, onSelectPlacement, readOnly = false, previewMode = "", renderInfo = null }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const renderIdRef = useRef(0);
  const callbacksRef = useRef({ onDropComponent, onSelectPlacement });

  useEffect(() => {
    callbacksRef.current = { onDropComponent, onSelectPlacement };
  }, [onDropComponent, onSelectPlacement]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const isAiPlannerPreview = previewMode === "ai-planner";
    scene.background = new THREE.Color(isAiPlannerPreview ? 0xeeeae2 : theme.colors.subtle);

    const camera = new THREE.PerspectiveCamera(isAiPlannerPreview ? 38 : 45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    if (previewMode === "ai-planner") {
      camera.position.set(3.4, 2.6, 3.8);
    } else {
      camera.position.set(4.8, 3.5, 5.2);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    if (isAiPlannerPreview) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, previewMode === "ai-planner" ? 1.45 : 1.25, 0);
    if (isAiPlannerPreview) {
      controls.minDistance = 1.2;
      controls.maxDistance = 12;
    }

    scene.add(new THREE.HemisphereLight(isAiPlannerPreview ? 0xfffbf3 : 0xffffff, 0xb7aa9d, isAiPlannerPreview ? 2.2 : 2.8));
    const keyLight = new THREE.DirectionalLight(isAiPlannerPreview ? 0xfff4df : 0xffffff, isAiPlannerPreview ? 2.8 : 2.2);
    keyLight.position.set(3, 6, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    if (isAiPlannerPreview) {
      const fillLight = new THREE.DirectionalLight(0xdce5ef, 1.25);
      fillLight.position.set(-4, 3.5, 2);
      scene.add(fillLight);
    }

    sceneRef.current = { scene, camera, renderer, controls };

    const setPointerFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickSceneObject = (event, predicate) => {
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const root = scene.getObjectByName("design-root");
      if (!root) return null;
      const hits = raycaster.intersectObjects(root.children, true);
      return hits.map((hit) => findUserDataOwner(hit.object, predicate)).find(Boolean) || null;
    };

    const handleDragOver = (event) => {
      event.preventDefault();
    };

    const handleDrop = (event) => {
      event.preventDefault();
      const { componentType, productSku } = readComponentDragPayload(event.dataTransfer);
      if (!componentType) return;
      const bay = pickSceneObject(event, (userData) => userData.isBayDropTarget) || pickNearestBayTarget(event, scene, camera, renderer.domElement);
      if (bay?.userData) {
        callbacksRef.current.onDropComponent?.(
          bay.userData.wallId,
          bay.userData.bayIndex,
          componentType,
          productSku ? { productSku } : {}
        );
      }
    };

    const handleClick = (event) => {
      const placement = pickSceneObject(event, (userData) => userData.placementId);
      if (placement?.userData?.placementId) {
        callbacksRef.current.onSelectPlacement?.(placement.userData.placementId);
      }
    };

    if (!readOnly) {
      renderer.domElement.addEventListener("dragover", handleDragOver);
      renderer.domElement.addEventListener("drop", handleDrop);
      renderer.domElement.addEventListener("click", handleClick);
    }

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    let animationFrame;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      if (!readOnly) {
        renderer.domElement.removeEventListener("dragover", handleDragOver);
        renderer.domElement.removeEventListener("drop", handleDrop);
        renderer.domElement.removeEventListener("click", handleClick);
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [readOnly, previewMode]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    rebuildScene(sceneRef.current.scene, config, design, series, debug, selectedId, renderIdRef, previewMode, () => {
      const current = sceneRef.current;
      if (current && previewMode === "ai-planner") {
        fitAiPlannerCamera(current.camera, current.controls, current.scene.getObjectByName("design-root"));
      }
      current?.renderer.render(current.scene, current.camera);
    }, renderInfo);
  }, [config, design, series, debug, selectedId, previewMode, renderInfo]);

  return h("div", { className: "three-mount", ref: mountRef, "aria-label": "3D preview" });
}

function findUserDataOwner(object, predicate) {
  let current = object;
  while (current) {
    if (predicate(current.userData || {})) return current;
    current = current.parent;
  }
  return null;
}

function pickNearestBayTarget(event, scene, camera, domElement) {
  const root = scene.getObjectByName("design-root");
  if (!root) return null;
  const rect = domElement.getBoundingClientRect();
  const point = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
  let nearest = null;
  let nearestDistance = Infinity;
  root.traverse((object) => {
    if (!object.userData?.isBayDropTarget || !object.userData.worldCenter) return;
    const screen = object.userData.worldCenter.clone().project(camera);
    const screenPoint = new THREE.Vector2(
      ((screen.x + 1) / 2) * rect.width,
      ((-screen.y + 1) / 2) * rect.height
    );
    const distance = screenPoint.distanceTo(point);
    if (distance < nearestDistance) {
      nearest = object;
      nearestDistance = distance;
    }
  });
  return nearest;
}

async function rebuildScene(scene, config, design, series, debug, selectedId, renderIdRef, previewMode, requestRender, renderInfo = null) {
  const old = scene.getObjectByName("design-root");
  if (old) scene.remove(old);

  const root = new THREE.Group();
  root.name = "design-root";
  scene.add(root);

  const report = {
    requested: new Set(),
    success: new Set(),
    failed: new Set(),
    missingPlacements: [],
    bayPlacements: [],
    componentDimensions: [],
    modelBounds: [],
    transformDiagnostics: [],
    runtimeDebug: [],
    wallGenerationOrder: [],
    woodTopDiagnostics: [],
    postCoordinates: [],
    skippedPostCoordinates: [],
    bayCoordinates: [],
    carbonCornerDiagnostics: [],
    aluminumBaseSideCornerDiagnostics: [],
    ledGlowStripCount: 0,
    ledGlowDiagnostics: [],
    aluminumBaseLedStripCounts: {
      post: 0,
      woodShelf: 0,
      glassShelf: 0
    },
    aluminumBaseLedDiagnostics: [],
    wallMountedLedStripCount: 0,
    wallMountedLedDiagnostics: [],
    visualAssets: [],
      visualAssetDiagnostics: {
      longHangZoneCount: 0,
      cloth1InstanceCount: 0,
      countsByType: {},
      countsByCategory: {},
      beddingFinalBbox: [],
      luggageFinalBbox: [],
      trouserVisualFinalBbox: [],
      loadedAssets: [],
      failedAssets: [],
      skippedVisualAssets: [],
      unresolvedOverlaps: [],
      frontViewOverlapCount: 0,
      visualOverlap3DCount: 0,
      visualOverlap2DCount: 0,
      trouserRackAutoRaised: false,
      trouserRackOriginalHeight: null,
      trouserRackFinalHeight: null,
      trouserRackRaiseDelta: null,
      trouserRackRaiseReason: "",
      luggageLargeConflictWithTrouser: false,
      luggageChangedLargeToSmall: false,
      luggageMovedToTopBecauseTrouserConflict: false,
      luggageMovedToOtherFloorBay: false,
      luggageBlockedByTrouser: false,
      removedEmptyTrouserRack: false,
      keptRealTrouserRack: false,
      removedEmptySupplementalRails: [],
      keptRealEmptyRails: [],
      emptyRailReason: ""
    },
    visualAssetEligibility: config.visualAssetDebug || null,
    activeRenderInfo: renderInfo || null,
    roomWallDiagnostics: null,
    geometryPlaceholders: ["room-floor", "room-walls"]
  };
  publishModelReport(report, "loading");

  const roomWidth = meters(design.room.width);
  const roomDepth = meters(design.room.depth);
  const roomHeight = meters(design.room.height);
  const postHeight = meters(design.postHeight || design.room.height);
  const seriesId = series?.seriesId || "japanese-closet";
  const cuttingRules = design.cuttingRules || getCuttingRules(seriesId) || getCuttingRules("japanese-closet");
  const modelTransforms = getModelTransforms(seriesId) || getModelTransforms("japanese-closet");
  const usesAsymmetricUSideWalls = config.layout === "U" && config.uAsymmetricSideWalls === true;
  const leftWallDepth = usesAsymmetricUSideWalls
    ? meters(Number(config.leftWallLength) || design.room.depth)
    : roomDepth;
  const rightWallDepth = usesAsymmetricUSideWalls
    ? meters(Number(config.rightWallLength) || design.room.depth)
    : roomDepth;
  report.roomWallDiagnostics = addRoom(
    root,
    roomWidth,
    roomDepth,
    roomHeight,
    seriesId,
    leftWallDepth,
    rightWallDepth,
    previewMode
  );
  for (const wall of design.activeWalls) {
    report.wallGenerationOrder.push(wall.id);
    await addWallRun(
      root,
      wall,
      roomWidth,
      roomDepth,
      roomHeight,
      postHeight,
      config,
      design,
      series,
      report,
      debug,
      selectedId,
      cuttingRules,
      modelTransforms,
      previewMode
    );
  }
  if (!scene.getObjectByName("design-root") || root.parent !== scene) return;
  publishModelReport(report, "ready");
  requestRender?.();
}

function publishModelReport(report, status) {
  const wallMountedRailShelfContacts = report.componentDimensions
    .filter((component) => component.componentType === "singleRail"
      && (component.linkedShelfId || component.shelfDependency?.dependencyId))
    .map((rail) => {
      const shelf = report.componentDimensions.find((component) => (
        component.placementId === rail.linkedShelfId
        || component.linkedRailDependencyId === rail.shelfDependency?.dependencyId
      ));
      if (!shelf) return {
        railId: rail.placementId,
        shelfId: rail.linkedShelfId || rail.shelfDependency?.dependencyId,
        missingShelf: true
      };
      return {
        railId: rail.placementId,
        shelfId: shelf.placementId,
        railTopY: rail.finalBoundingBox?.max?.y,
        shelfBottomY: shelf.finalBoundingBox?.min?.y,
        gap: Number(shelf.finalBoundingBox?.min?.y || 0) - Number(rail.finalBoundingBox?.max?.y || 0)
      };
    });
  const payload = {
    status,
    requested: Array.from(report.requested),
    success: Array.from(report.success),
    failed: Array.from(report.failed),
    successCount: report.success.size,
    failedCount: report.failed.size,
    missingPlacements: report.missingPlacements,
    bayPlacements: report.bayPlacements,
    componentDimensions: report.componentDimensions,
    modelBounds: report.modelBounds,
    transformDiagnostics: report.transformDiagnostics,
    runtimeDebug: report.runtimeDebug,
    wallGenerationOrder: report.wallGenerationOrder,
    woodTopDiagnostics: report.woodTopDiagnostics,
    sceneJsImportUrl: import.meta.url,
    sceneTransformVersion,
    sceneRuntimeVersion,
    postCoordinates: report.postCoordinates,
    skippedPostCoordinates: report.skippedPostCoordinates,
    bayCoordinates: report.bayCoordinates,
    carbonCornerDiagnostics: report.carbonCornerDiagnostics,
    aluminumBaseSideCornerDiagnostics: report.aluminumBaseSideCornerDiagnostics,
    ledGlowStripCount: report.ledGlowStripCount,
    ledGlowDiagnostics: report.ledGlowDiagnostics,
    aluminumBaseLedStripCounts: report.aluminumBaseLedStripCounts,
    aluminumBaseLedDiagnostics: report.aluminumBaseLedDiagnostics,
    wallMountedLedStripCount: report.wallMountedLedStripCount,
    wallMountedLedDiagnostics: report.wallMountedLedDiagnostics,
    visualAssets: report.visualAssets,
    visualAssetDiagnostics: report.visualAssetDiagnostics,
    visualAssetEligibility: report.visualAssetEligibility,
    activeRender: report.activeRenderInfo || null,
    wallMountedRailShelfContacts,
    roomWallDiagnostics: report.roomWallDiagnostics,
    geometryPlaceholders: report.geometryPlaceholders
  };
  if (isStaleAiPlannerRender(payload)) return;
  window.__modelLoadReport = payload;
  publishAiPlannerActiveRender(payload);
  publishAiPlannerVisualDebug(payload);
  document.documentElement.setAttribute("data-model-report", JSON.stringify(payload));
}

function isStaleAiPlannerRender(payload = {}) {
  if (typeof window === "undefined") return false;
  const renderId = payload.activeRender?.renderId || "";
  if (!renderId) return false;
  const activeRenderId = window.__AI_PLANNER_ACTIVE_RENDER__?.renderId || "";
  return Boolean(activeRenderId && activeRenderId !== renderId);
}

function addRoom(root, width, depth, height, seriesId, leftWallDepth = depth, rightWallDepth = depth, previewMode = "") {
  const isAiPlannerPreview = previewMode === "ai-planner";
  const floorMat = new THREE.MeshStandardMaterial({
    color: isAiPlannerPreview ? 0xd8d0c3 : theme.colors.border,
    roughness: isAiPlannerPreview ? 0.96 : 0.85,
    transparent: isAiPlannerPreview,
    opacity: isAiPlannerPreview ? 0.58 : 1
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: isAiPlannerPreview ? 0xf6f4ef : theme.colors.background,
    roughness: 0.9,
    transparent: true,
    opacity: isAiPlannerPreview ? 0.32 : 0.82
  });
  const wallThickness = seriesId === "carbon-steel-post-wardrobe-v2" ? 0.06 : 0.04;
  const floorDepth = Math.max(depth, leftWallDepth, rightWallDepth);
  const floorCenterZ = (floorDepth - depth) / 2;

  const floor = box(width, wallThickness, floorDepth, floorMat);
  floor.name = "Preview Room Floor";
  floor.position.set(0, -wallThickness / 2, floorCenterZ);
  floor.receiveShadow = true;
  root.add(floor);

  const backWall = box(width, height, wallThickness, wallMat);
  backWall.name = "Preview Room Back Wall";
  const backWallCenterZ = seriesId === "aluminum-post-wardrobe"
    ? -depth / 2 - wallThickness / 2
    : seriesId === "carbon-steel-post-wardrobe-v2"
      ? -depth / 2 - wallThickness / 2
    : -depth / 2;
  backWall.position.set(0, height / 2, backWallCenterZ);
  root.add(backWall);

  const leftWall = box(wallThickness, height, leftWallDepth, wallMat);
  leftWall.name = "Preview Room Left Wall";
  leftWall.position.set(
    -width / 2 - wallThickness / 2,
    height / 2,
    (leftWallDepth - depth) / 2
  );
  root.add(leftWall);

  const rightWall = box(wallThickness, height, rightWallDepth, wallMat);
  rightWall.name = "Preview Room Right Wall";
  rightWall.position.set(
    width / 2 + wallThickness / 2,
    height / 2,
    (rightWallDepth - depth) / 2
  );
  root.add(rightWall);
  root.updateMatrixWorld(true);
  const backWallBox = new THREE.Box3().setFromObject(backWall);
  const leftWallBox = new THREE.Box3().setFromObject(leftWall);
  const rightWallBox = new THREE.Box3().setFromObject(rightWall);

  const gridSize = Math.max(width, floorDepth);
  if (!isAiPlannerPreview) {
    const grid = new THREE.GridHelper(gridSize, 12, theme.colors.walnut, theme.colors.divider);
    grid.position.set(0, 0.03, floorCenterZ);
    root.add(grid);
  }

  return {
    floor: {
      widthMm: Math.round(width * 1000),
      depthMm: Math.round(floorDepth * 1000),
      centerZMm: Math.round(floorCenterZ * 1000)
    },
    grid: {
      sizeMm: Math.round(gridSize * 1000),
      centerZMm: Math.round(floorCenterZ * 1000)
    },
    back: {
      lengthMm: Math.round(width * 1000),
      axis: "worldX",
      innerSurfaceZMm: toMm(backWallBox.max.z)
    },
    left: {
      lengthMm: Math.round(leftWallDepth * 1000),
      axis: "worldZ",
      centerZMm: Math.round(leftWall.position.z * 1000),
      innerSurfaceXMm: toMm(leftWallBox.max.x)
    },
    right: {
      lengthMm: Math.round(rightWallDepth * 1000),
      axis: "worldZ",
      centerZMm: Math.round(rightWall.position.z * 1000),
      innerSurfaceXMm: toMm(rightWallBox.min.x)
    }
  };
}

function fitAiPlannerCamera(camera, controls, root) {
  const bounds = getAiPlannerPresentationBounds(root);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.35));
  const verticalDistance = size.y / (2 * Math.tan(verticalFov / 2));
  const horizontalDistance = size.x / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(verticalDistance, horizontalDistance, size.z * 1.4, 1.8) / 0.86;
  const yaw = THREE.MathUtils.degToRad(38);
  const target = new THREE.Vector3(center.x, Math.min(1.4, Math.max(1.05, center.y)), center.z);

  camera.position.set(
    target.x + Math.sin(yaw) * distance,
    Math.min(1.65, Math.max(1.45, target.y + 0.24)),
    target.z + Math.cos(yaw) * distance
  );
  camera.near = Math.max(0.05, distance / 100);
  camera.far = Math.max(30, distance * 8);
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.minDistance = Math.max(1.1, distance * 0.42);
  controls.maxDistance = distance * 2.2;
  controls.update();
}

function getAiPlannerPresentationBounds(root) {
  const bounds = new THREE.Box3();
  if (!root) return bounds;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry || object.userData?.isBayDropTarget) return;
    if (/^Preview Room /.test(object.name || "")) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every((material) => !material || material.visible === false || material.opacity === 0 || material.colorWrite === false)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

async function addWallRun(
  root,
  wall,
  roomWidth,
  roomDepth,
  roomHeight,
  postHeight,
  config,
  design,
  series,
  report,
  debug,
  selectedId,
  cuttingRules,
  modelTransforms,
  previewMode
) {
  const group = new THREE.Group();
  group.name = `wall-run-${wall.id}`;
  const isWallMountedV2 = series?.seriesId === "wall-mounted-v2";
  const length = meters(wall.length);
  const shelfDepth = meters(Number(config.shelfDepth) || 450);
  const dropTargetDepth = 0.5;
  const wallOffset = meters(Number(config.wallOffset) || 250);
  const wallCenterOffset = meters(Number(wall.centerOffset) || 0);
  const wallThickness = series?.seriesId === "carbon-steel-post-wardrobe-v2" ? 0.06 : 0.04;
  const backWallInnerSurfaceShift = series?.seriesId === "aluminum-base-supported"
    && wall.id === "back"
    ? wallThickness / 2
    : 0;

  if (wall.id === "back") {
    group.position.set(
      wallCenterOffset,
      0,
      -roomDepth / 2 + wallOffset + backWallInnerSurfaceShift
    );
  }
  if (wall.id === "left") {
    group.rotation.set(0, Math.PI / 2, 0);
    group.position.set(-roomWidth / 2 + wallOffset, 0, wallCenterOffset);
  }
  if (wall.id === "right") {
    group.rotation.set(0, -Math.PI / 2, 0);
    group.position.set(roomWidth / 2 - wallOffset, 0, wallCenterOffset);
  }
  report.runtimeDebug.push({
    wallId: wall.id,
    sceneRuntimeVersion,
    sceneJsImportUrl: import.meta.url,
    sidePostInset: null,
    sidePostInsetMeters: null,
    wallOffset: toMm(wallOffset),
    wallOffsetMeters: wallOffset,
    wallCenterOffset: toMm(wallCenterOffset),
    reverseBayOrder: wall.reverseBayOrder === true,
    groupRotationY: group.rotation.y,
    backCornerBayIndex: wall.backCornerBayIndex,
    backCornerPostIndex: wall.backCornerPostIndex,
    openEndBayIndex: wall.openEndBayIndex,
    leftGroupX: wall.id === "left" ? toMm(group.position.x) : null,
    rightGroupX: wall.id === "right" ? toMm(group.position.x) : null,
    groupPosition: {
      x: toMm(group.position.x),
      y: toMm(group.position.y),
      z: toMm(group.position.z)
    }
  });
  root.add(group);
  group.updateMatrixWorld(true);

  const startX = -length / 2;
  const wallAxis = getWallAxis(wall.id);
  const reverseBayOrder = wall.reverseBayOrder === true;
  const postPositions = (wall.posts?.length ? wall.posts : Array.from({ length: wall.bayCount + 1 }, (_, index) => ({
    index,
    x: (wall.length / wall.bayCount) * index
  }))).map((post) => ({
    index: post.index,
    x: reverseBayOrder
      ? startX + length - meters(post.x)
      : startX + meters(post.x)
  }));
  const factoryInnerBayWidth = meters(getFactoryInnerBayWidth(wall.length, wall.bayCount, cuttingRules));
  const postProduct = design.productByType.post;
  const aluminumBaseMiddlePostProduct = design.productBySku["TD-001-1"] || postProduct;
  const aluminumBaseSidePostProduct = design.productBySku["TD-001-2"] || aluminumBaseMiddlePostProduct;
  const resolvedPostModelPath = series?.resolvePostModelPath?.({
    connectionMode: config.connectionMode,
    postHeight: design.postHeight
  });
  const selectedPostProduct = resolvedPostModelPath
    ? {
      ...postProduct,
      modelPath: resolvedPostModelPath,
      glbAssetPath: resolvedPostModelPath
    }
    : series?.seriesId === "aluminum-post-wardrobe"
      ? {
      ...postProduct,
      modelPath: getAluminumPostModelPath(config),
      glbAssetPath: getAluminumPostModelPath(config)
      }
      : postProduct;
  const postTargetSize = {
    x: meters(cuttingRules.postProfileWidthMm),
    y: postHeight,
    z: modelTransforms.post.targetDepth
  };
  const isBackWall = wall.id === "back";
  const postEndVisualInset = meters(modelTransforms.post.backEndVisualInsetMm);
  const postLocalBoundsByIndex = new Map();
  const aluminumBaseAdjustedPostIndexes = new Set();
  for (const postPosition of postPositions) {
    const isWallRunEndPost = postPosition.index === 0
      || postPosition.index === postPositions.length - 1;
    const wallPostProduct = series?.resolveWallPostProduct?.({
      isWallRunEndPost,
      wallId: wall.id,
      postIndex: postPosition.index,
      productBySku: design.productBySku,
      productByType: design.productByType,
      defaultPostProduct: selectedPostProduct
    }) || (
      series?.seriesId === "aluminum-base-supported"
        ? isWallRunEndPost
          ? aluminumBaseSidePostProduct
          : aluminumBaseMiddlePostProduct
        : selectedPostProduct
    );
    const post = await createModelOrMissing(
      wallPostProduct,
      series,
      report,
      postTargetSize,
      "绔嬫煴",
      getComponentTransform("post", modelTransforms),
      "post",
      modelTransforms
    );
    if (
      !isWallMountedV2
      && wall.id === "right"
      && modelTransforms.post.rotateRightWallByPi
    ) {
      post.rotation.y += Math.PI;
    }
    applyPostColor(post, config.frameColor);
    const visualPostX = getVisualPostX(postPosition, postPositions.length, isBackWall, postEndVisualInset);
    const fittedPostOffset = post.position.clone();
    post.position.set(
      visualPostX + (
        series?.seriesId === "carbon-steel-post-wardrobe-v2"
        || series?.seriesId === "aluminum-base-supported"
          ? fittedPostOffset.x
          : 0
      ),
      series?.seriesId === "carbon-steel-post-wardrobe-v2" ? fittedPostOffset.y : 0,
      series?.seriesId === "carbon-steel-post-wardrobe-v2" ? fittedPostOffset.z : 0
    );
    const wallMountedBackCornerPostIndex = isWallMountedV2
      && config.layout === "U"
      && config.uLayoutMode !== "side-first"
      && (wall.id === "left" || wall.id === "right")
      ? getSideBackCornerPostIndex(wall)
      : null;
    post.userData = {
      ...post.userData,
      wallId: wall.id,
      postIndex: postPosition.index,
      isBackCornerPost: postPosition.index === wallMountedBackCornerPostIndex
    };
    post.userData.productSku = wallPostProduct?.sku || "";
    group.add(post);
    if (series?.seriesId === "aluminum-base-supported") {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const backPanelTransform = getComponentTransform("backPanel", modelTransforms);
      const backPanelBackPlane = (Number(backPanelTransform.depthOffset) || 0)
        - (Number(backPanelTransform.depthAnchorBaseDepth) || 0.45) / 2;
      const postLocalBox = getObjectBoxRelativeTo(post, group);
      if (!postLocalBox.isEmpty()) {
        post.position.z += backPanelBackPlane - postLocalBox.min.z;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const isCarbonSeries = series?.seriesId === "carbon-steel-post-wardrobe-v2";
    const carbonPostWallClearance = meters(210);
    if (isCarbonSeries) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postWorldBox = getCarbonPostWallReferenceBox(post);
      let deltaWorldX = 0;
      let deltaWorldZ = 0;
      if (wall.id === "left") {
        deltaWorldX = (-roomWidth / 2 + carbonPostWallClearance) - postWorldBox.min.x;
      } else if (wall.id === "right") {
        deltaWorldX = (roomWidth / 2 - carbonPostWallClearance) - postWorldBox.max.x;
      } else if (wall.id === "back") {
        deltaWorldZ = (-roomDepth / 2 + carbonPostWallClearance) - postWorldBox.min.z;
      }
      if (Math.abs(deltaWorldX) > 1e-12 || Math.abs(deltaWorldZ) > 1e-12) {
        const worldOrigin = post.getWorldPosition(new THREE.Vector3());
        const localOrigin = group.worldToLocal(worldOrigin.clone());
        const localShifted = group.worldToLocal(
          worldOrigin.clone().add(new THREE.Vector3(deltaWorldX, 0, deltaWorldZ))
        );
        post.position.add(localShifted.sub(localOrigin));
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const isCarbonBackEndPost = series?.seriesId === "carbon-steel-post-wardrobe-v2"
      && wall.id === "back"
      && (postPosition === postPositions[0] || postPosition === postPositions[postPositions.length - 1])
      && !(config.layout === "U" && config.uLayoutMode === "side-first");
    if (isCarbonBackEndPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postWorldBox = new THREE.Box3().setFromObject(post);
      const backWallEndClearance = meters(10);
      const roomLeftBoundary = -roomWidth / 2 + backWallEndClearance;
      const roomRightBoundary = roomWidth / 2 - backWallEndClearance;
      const boundaryDeltaX = postPosition === postPositions[0]
        ? roomLeftBoundary - postWorldBox.min.x
        : roomRightBoundary - postWorldBox.max.x;
      if (Math.abs(boundaryDeltaX) > 1e-12) {
        const worldOrigin = post.getWorldPosition(new THREE.Vector3());
        const localOrigin = group.worldToLocal(worldOrigin.clone());
        const localShifted = group.worldToLocal(
          worldOrigin.clone().add(new THREE.Vector3(boundaryDeltaX, 0, 0))
        );
        post.position.add(localShifted.sub(localOrigin));
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const shouldRecenterAluminumLSidePost = series?.seriesId === "aluminum-post-wardrobe"
      && (config.layout === "L-left" || config.layout === "L-right")
      && (wall.id === "left" || wall.id === "right");
    if (shouldRecenterAluminumLSidePost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postLocalBox = getObjectBoxRelativeTo(post, group);
      if (!postLocalBox.isEmpty()) {
        const postLocalCenterX = (postLocalBox.min.x + postLocalBox.max.x) / 2;
        post.position.x += postPosition.x - postLocalCenterX;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const shouldAlignAluminumWallMountedPost = series?.seriesId === "aluminum-post-wardrobe"
      && config.connectionMode === "wall-mounted";
    if (shouldAlignAluminumWallMountedPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postLocalBox = getObjectBoxRelativeTo(post, group);
      if (!postLocalBox.isEmpty()) {
        post.position.z += -wallOffset - postLocalBox.min.z;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const usesFixedCornerUWallPlan = cuttingRules.preservesExistingUWallGeometry === true;
    const shouldClampSideFirstBackCornerPost = usesFixedCornerUWallPlan
      && config.layout === "U"
      && config.uLayoutMode === "side-first"
      && (wall.id === "left" || wall.id === "right")
      && postPosition.index === 0;
    if (shouldClampSideFirstBackCornerPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postWorldBox = new THREE.Box3().setFromObject(post);
      const backWallBoundaryZ = -roomDepth / 2;
      const overflowWorldZ = backWallBoundaryZ - postWorldBox.min.z;
      if (overflowWorldZ > 0) {
        const worldOrigin = post.getWorldPosition(new THREE.Vector3());
        const localOrigin = group.worldToLocal(worldOrigin.clone());
        const localShifted = group.worldToLocal(
          worldOrigin.clone().add(new THREE.Vector3(0, 0, overflowWorldZ))
        );
        post.position.x += localShifted.x - localOrigin.x;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const aluminumBaseLogicalBackCornerPostIndex = wall.backCornerBayIndex === 0
      ? 0
      : wall.backCornerBayIndex === wall.bayCount - 1
        ? wall.bayCount
        : null;
    const aluminumBaseBackCornerPostIndex = aluminumBaseLogicalBackCornerPostIndex === null
      ? null
      : reverseBayOrder
        ? wall.bayCount - aluminumBaseLogicalBackCornerPostIndex
        : aluminumBaseLogicalBackCornerPostIndex;
    const shouldAlignAluminumBaseSideCornerPost = series?.seriesId === "aluminum-base-supported"
      && (wall.id === "left" || wall.id === "right")
      && postPosition.index === aluminumBaseBackCornerPostIndex
      && (
        config.layout === "L-left"
        || config.layout === "L-right"
        || (config.layout === "U" && config.uLayoutMode !== "side-first")
      );
    if (shouldAlignAluminumBaseSideCornerPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const beforeWorldPosition = post.getWorldPosition(new THREE.Vector3());
      const beforeWorldBox = new THREE.Box3().setFromObject(post);
      const backWallInnerSurfaceZ = -roomDepth / 2 + wallThickness / 2;
      const targetWorldMinZ = backWallInnerSurfaceZ + meters(61);
      const deltaWorldZ = targetWorldMinZ - beforeWorldBox.min.z;
      if (Math.abs(deltaWorldZ) > 1e-12) {
        const localOrigin = group.worldToLocal(beforeWorldPosition.clone());
        const localShifted = group.worldToLocal(
          beforeWorldPosition.clone().add(new THREE.Vector3(0, 0, deltaWorldZ))
        );
        post.position.add(localShifted.sub(localOrigin));
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
      const wallGap = meters(8);
      const beforeWallGapBox = new THREE.Box3().setFromObject(post);
      const targetWallSideX = wall.id === "left"
        ? -roomWidth / 2 + wallGap
        : roomWidth / 2 - wallGap;
      const deltaWorldX = wall.id === "left"
        ? targetWallSideX - beforeWallGapBox.min.x
        : targetWallSideX - beforeWallGapBox.max.x;
      if (Math.abs(deltaWorldX) > 1e-12) {
        translateObjectByWorldDelta(post, group, deltaWorldX);
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
      const afterLocalBox = getObjectBoxRelativeTo(post, group);
      if (!afterLocalBox.isEmpty()) {
        postPosition.x = (afterLocalBox.min.x + afterLocalBox.max.x) / 2;
      }
      aluminumBaseAdjustedPostIndexes.add(postPosition.index);
      const afterWorldPosition = post.getWorldPosition(new THREE.Vector3());
      const afterWorldBox = new THREE.Box3().setFromObject(post);
      report.aluminumBaseSideCornerDiagnostics.push({
        layout: config.layout,
        uLayoutMode: config.layout === "U" ? config.uLayoutMode || "back-first" : null,
        wallId: wall.id,
        postIndex: postPosition.index,
        beforeWorldPosition: serializeVectorMm(beforeWorldPosition),
        beforeWorldBBox: serializeBox(beforeWorldBox),
        backWallInnerSurfaceZ: toMm(backWallInnerSurfaceZ),
        targetWorldMinZ: toMm(targetWorldMinZ),
        deltaWorldZ: toMm(deltaWorldZ),
        sideWallInnerSurfaceX: toMm(wall.id === "left" ? -roomWidth / 2 : roomWidth / 2),
        targetWallSideX: toMm(targetWallSideX),
        deltaWorldX: toMm(deltaWorldX),
        afterWorldPosition: serializeVectorMm(afterWorldPosition),
        afterWorldBBox: serializeBox(afterWorldBox),
        actualClearance: toMm(afterWorldBox.min.z - backWallInnerSurfaceZ),
        actualSideWallClearance: toMm(wall.id === "left"
          ? afterWorldBox.min.x + roomWidth / 2
          : roomWidth / 2 - afterWorldBox.max.x)
      });
    }
    const shouldRecenterAluminumBackPost = series?.seriesId === "aluminum-post-wardrobe"
      && (config.layout === "L-left" || config.layout === "L-right" || config.layout === "U")
      && wall.id === "back";
    if (shouldRecenterAluminumBackPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postWorldBox = new THREE.Box3().setFromObject(post);
      const postWorldCenter = postWorldBox.getCenter(new THREE.Vector3());
      const targetWorld = localToWorld(group, postPosition.x, 0, 0);
      const deltaWorldX = targetWorld.x - postWorldCenter.x;
      if (Math.abs(deltaWorldX) > 1e-6) {
        const worldOrigin = post.getWorldPosition(new THREE.Vector3());
        const localOrigin = group.worldToLocal(worldOrigin.clone());
        const localShifted = group.worldToLocal(
          worldOrigin.clone().add(new THREE.Vector3(deltaWorldX, 0, 0))
        );
        post.position.x += localShifted.x - localOrigin.x;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    const isAluminumIBackEndPost = series?.seriesId === "aluminum-post-wardrobe"
      && config.layout === "I"
      && wall.id === "back"
      && (postPosition === postPositions[0] || postPosition === postPositions[postPositions.length - 1]);
    if (isAluminumIBackEndPost) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postWorldBox = new THREE.Box3().setFromObject(post);
      const postWorldCenter = postWorldBox.getCenter(new THREE.Vector3());
      const postHalfWidth = postWorldBox.getSize(new THREE.Vector3()).x / 2;
      const minCenterX = -roomWidth / 2 + postHalfWidth;
      const maxCenterX = roomWidth / 2 - postHalfWidth;
      const clampedCenterX = THREE.MathUtils.clamp(postWorldCenter.x, minCenterX, maxCenterX);
      const deltaWorldX = clampedCenterX - postWorldCenter.x;
      if (Math.abs(deltaWorldX) > 1e-6) {
        const worldOrigin = post.getWorldPosition(new THREE.Vector3());
        const localOrigin = group.worldToLocal(worldOrigin.clone());
        const localShifted = group.worldToLocal(
          worldOrigin.clone().add(new THREE.Vector3(deltaWorldX, 0, 0))
        );
        post.position.x += localShifted.x - localOrigin.x;
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
    }
    let wallMountedPostAlignment = null;
    if (modelTransforms.post.alignBackFaceToWall === true) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const beforeWorldBox = new THREE.Box3().setFromObject(post);
      let wallInnerSurface = null;
      let postBackFace = null;
      let deltaWorldX = 0;
      let deltaWorldZ = 0;
      if (wall.id === "back") {
        wallInnerSurface = meters(report.roomWallDiagnostics?.back?.innerSurfaceZMm);
        postBackFace = beforeWorldBox.min.z;
        deltaWorldZ = wallInnerSurface - postBackFace;
      } else if (wall.id === "left") {
        wallInnerSurface = meters(report.roomWallDiagnostics?.left?.innerSurfaceXMm);
        postBackFace = beforeWorldBox.min.x;
        deltaWorldX = wallInnerSurface - postBackFace;
      } else if (wall.id === "right") {
        wallInnerSurface = meters(report.roomWallDiagnostics?.right?.innerSurfaceXMm);
        postBackFace = beforeWorldBox.max.x;
        deltaWorldX = wallInnerSurface - postBackFace;
      }
      if (
        Number.isFinite(wallInnerSurface)
        && (Math.abs(deltaWorldX) > 1e-12 || Math.abs(deltaWorldZ) > 1e-12)
      ) {
        translateObjectByWorldDelta(post, group, deltaWorldX, 0, deltaWorldZ);
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
      const afterWorldBox = new THREE.Box3().setFromObject(post);
      wallMountedPostAlignment = {
        wallInnerSurface: toMm(wallInnerSurface),
        backFace: toMm(wall.id === "back"
          ? afterWorldBox.min.z
          : wall.id === "left"
            ? afterWorldBox.min.x
            : afterWorldBox.max.x),
        frontFace: toMm(wall.id === "back"
          ? afterWorldBox.max.z
          : wall.id === "left"
            ? afterWorldBox.max.x
            : afterWorldBox.min.x),
        deltaWorldX: toMm(deltaWorldX),
        deltaWorldZ: toMm(deltaWorldZ)
      };
    }
    if (modelTransforms.post.alignBackFaceToWall === true) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const beforeRunBox = new THREE.Box3().setFromObject(post);
      const targetWorld = localToWorld(group, postPosition.x, 0, 0);
      const minRunPosition = Math.min(...postPositions.map((item) => item.x));
      const maxRunPosition = Math.max(...postPositions.map((item) => item.x));
      const isRunStartPost = Math.abs(postPosition.x - minRunPosition) < 1e-9;
      const isRunEndPost = Math.abs(postPosition.x - maxRunPosition) < 1e-9;
      const usesWallMountedSideFirstBackRun = isWallMountedV2
        && config.layout === "U"
        && config.uLayoutMode === "side-first"
        && wall.id === "back";
      let runDeltaWorldX = 0;
      let runDeltaWorldZ = 0;
      if (wall.id === "back") {
        runDeltaWorldX = usesWallMountedSideFirstBackRun
          ? targetWorld.x - beforeRunBox.getCenter(new THREE.Vector3()).x
          : isRunStartPost
            ? -roomWidth / 2 - beforeRunBox.min.x
            : isRunEndPost
              ? roomWidth / 2 - beforeRunBox.max.x
              : targetWorld.x - beforeRunBox.getCenter(new THREE.Vector3()).x;
      } else if (wall.id === "left" || wall.id === "right") {
        const runEndA = localToWorld(group, -length / 2, 0, 0).z;
        const runEndB = localToWorld(group, length / 2, 0, 0).z;
        const runMinZ = Math.min(runEndA, runEndB);
        const runMaxZ = Math.max(runEndA, runEndB);
        const targetIsRunMin = Math.abs(targetWorld.z - runMinZ) < 1e-9;
        const targetIsRunMax = Math.abs(targetWorld.z - runMaxZ) < 1e-9;
        runDeltaWorldZ = targetIsRunMin
          ? runMinZ - beforeRunBox.min.z
          : targetIsRunMax
            ? runMaxZ - beforeRunBox.max.z
            : targetWorld.z - beforeRunBox.getCenter(new THREE.Vector3()).z;
      }
      if (Math.abs(runDeltaWorldX) > 1e-12 || Math.abs(runDeltaWorldZ) > 1e-12) {
        translateObjectByWorldDelta(post, group, runDeltaWorldX, 0, runDeltaWorldZ);
        group.updateMatrixWorld(true);
        post.updateMatrixWorld(true);
      }
      const afterRunBox = new THREE.Box3().setFromObject(post);
      wallMountedPostAlignment = {
        ...wallMountedPostAlignment,
        beforeRunBBox: serializeBox(beforeRunBox),
        runDeltaWorldX: toMm(runDeltaWorldX),
        runDeltaWorldZ: toMm(runDeltaWorldZ),
        afterRunBBox: serializeBox(afterRunBox)
      };
    }
    if (
      series?.seriesId === "aluminum-post-wardrobe"
      || series?.seriesId === "carbon-steel-post-wardrobe-v2"
      || series?.seriesId === "aluminum-base-supported"
    ) {
      group.updateMatrixWorld(true);
      post.updateMatrixWorld(true);
      const postLocalBox = getObjectBoxRelativeTo(post, group);
      if (!postLocalBox.isEmpty()) {
        postLocalBoundsByIndex.set(postPosition.index, {
          minX: postLocalBox.min.x,
          maxX: postLocalBox.max.x,
          centerX: (postLocalBox.min.x + postLocalBox.max.x) / 2
        });
      }
    }
    if (series?.seriesId === "aluminum-post-wardrobe") {
      const ledDiagnostic = addAluminumPostLedGlow(post, config.led === true, {
        connectionMode: config.connectionMode,
        postStyle: config.postStyle
      });
      report.ledGlowStripCount += 2;
      report.ledGlowDiagnostics.push({
        wallId: wall.id,
        postIndex: postPosition.index,
        ...ledDiagnostic
      });
    }
    if (series?.seriesId === "aluminum-base-supported") {
      const ledDiagnostic = addAluminumBasePostLedStrip(
        post,
        group,
        config.led === true,
        wall.id,
        postPosition.index
      );
      if (ledDiagnostic) {
        report.aluminumBaseLedStripCounts.post += 1;
        report.aluminumBaseLedDiagnostics.push(ledDiagnostic);
      }
    }
    const world = localToWorld(group, postPosition.x, 0, 0);
    const visualWorld = post.getWorldPosition(new THREE.Vector3());
    const finalPostWorldBox = new THREE.Box3().setFromObject(post);
    report.postCoordinates.push({
      wallId: wall.id,
      productSku: wallPostProduct?.sku || "",
      modelPath: wallPostProduct?.modelPath || "",
      postStyle: config.postStyle || "round",
      connectionMode: config.connectionMode || "wall-mounted",
      axis: wallAxis,
      postIndex: postPosition.index,
      isBackCornerPost: post.userData.isBackCornerPost === true,
      localX: toMm(postPosition.x),
      visualLocalX: toMm(visualPostX),
      worldX: toMm(world.x),
      worldY: toMm(world.y),
      worldZ: toMm(world.z),
      visualWorldX: toMm(visualWorld.x),
      visualWorldY: toMm(visualWorld.y),
      visualWorldZ: toMm(visualWorld.z),
      finalBBoxMinX: toMm(finalPostWorldBox.min.x),
      finalBBoxMaxX: toMm(finalPostWorldBox.max.x),
      finalBBoxMinZ: toMm(finalPostWorldBox.min.z),
      finalBBoxMaxZ: toMm(finalPostWorldBox.max.z),
      finalBBoxSize: serializeVectorMm(finalPostWorldBox.getSize(new THREE.Vector3())),
      wallAlignment: wallMountedPostAlignment
    });
    if (debug) {
      group.add(createTextSprite(`P${postPosition.index}`, theme.colors.text, postPosition.x, postHeight + 0.12, 0));
    }
  }

  postPositions.slice(0, -1).forEach((_, bayIndex) => {
    const usesAdjustedAluminumBaseBay = aluminumBaseAdjustedPostIndexes.has(bayIndex)
      || aluminumBaseAdjustedPostIndexes.has(bayIndex + 1);
    const renderedInnerBayWidth = usesAdjustedAluminumBaseBay
      ? Math.max(
        0.05,
        Math.abs(postPositions[bayIndex + 1].x - postPositions[bayIndex].x)
          - meters(cuttingRules.postProfileWidthMm)
      )
      : meters(wall.bays?.[bayIndex]?.innerBayWidth) || factoryInnerBayWidth;
    const bay = getBayGeometry(
      postPositions,
      bayIndex,
      renderedInnerBayWidth,
      cuttingRules.postProfileWidthMm
    );
    if (!bay) return;
    const world = localToWorld(group, bay.centerX, 0, 0);
      report.bayCoordinates.push({
      wallId: wall.id,
      axis: wallAxis,
      bayIndex,
      leftPostIndex: bayIndex,
      rightPostIndex: bayIndex + 1,
      leftPostLocalX: toMm(bay.leftX),
      rightPostLocalX: toMm(bay.rightX),
      bayCenterLocalX: toMm(bay.centerX),
      rawBayWidth: toMm(bay.rawBayWidth),
      postCenterDistance: toMm(bay.postCenterDistance),
      postProfileWidth: toMm(bay.postProfileWidth),
      innerBayWidth: toMm(bay.innerBayWidth),
      usableComponentWidth: toMm(bay.innerBayWidth),
      worldX: toMm(world.x),
      worldY: toMm(world.y),
      worldZ: toMm(world.z)
    });
    const dropTarget = createBayDropTarget(bay.width, roomHeight, dropTargetDepth);
    dropTarget.position.set(bay.centerX, roomHeight / 2, 0);
    dropTarget.userData = {
      isBayDropTarget: true,
      wallId: wall.id,
      bayIndex,
      worldCenter: world.clone()
    };
    group.add(dropTarget);
    if (debug) {
      group.add(createBayCenterMarker(bay.centerX, 0.08, 0));
      group.add(createTextSprite(`B${bayIndex}`, theme.colors.danger, bay.centerX, 0.28, 0));
    }
  });

  const wallPlacements = design.placements.filter((placement) => placement.wallId === wall.id);
  const aluminumBaseWoodShelfSupportRegistry = new Set();
  const addWallPlacement = async (placement) => {
      const usesAdjustedAluminumBaseBay = aluminumBaseAdjustedPostIndexes.has(placement.bayIndex)
        || aluminumBaseAdjustedPostIndexes.has(placement.bayIndex + 1);
      const renderedInnerBayWidth = usesAdjustedAluminumBaseBay
        ? Math.max(
          0.05,
          Math.abs(postPositions[placement.bayIndex + 1].x - postPositions[placement.bayIndex].x)
            - meters(cuttingRules.postProfileWidthMm)
        )
        : meters(wall.bays?.[placement.bayIndex]?.innerBayWidth) || factoryInnerBayWidth;
      const bay = getBayGeometry(
        postPositions,
        placement.bayIndex,
        renderedInnerBayWidth,
        cuttingRules.postProfileWidthMm
      );
      if (!bay) {
        report.failed.add(`${wall.id}:${placement.bayIndex}`);
        report.missingPlacements.push({
          name: placement.componentType,
          reason: `Invalid bayIndex ${placement.bayIndex} for ${wall.id}`
        });
        return;
      }
      const aluminumComponentPostEdges = series?.seriesId === "aluminum-post-wardrobe"
        && usesAluminumPostInnerEdgeAlignment(placement.componentType)
        ? getAluminumPostInnerEdges(postLocalBoundsByIndex, placement.bayIndex)
        : null;
      const carbonComponentPostEdges = series?.seriesId === "carbon-steel-post-wardrobe-v2"
        ? getAluminumPostInnerEdges(postLocalBoundsByIndex, placement.bayIndex)
        : null;
      const aluminumBaseBackPanelPostEdges = series?.seriesId === "aluminum-base-supported"
        && placement.componentType === "backPanel"
        ? getAluminumPostInnerEdges(postLocalBoundsByIndex, placement.bayIndex)
        : null;
      const aluminumBaseWallWideShelfEdges = series?.seriesId === "aluminum-base-supported"
        && placement.componentType === "woodShelf"
        && (placement.wallWideSource || placement.wallWideDerived)
        ? getWallWideShelfEdges(
          postLocalBoundsByIndex,
          placement.bayIndex,
          wall.bayCount
        )
        : null;
      const placementPostEdges = aluminumBaseWallWideShelfEdges
        || aluminumBaseBackPanelPostEdges
        || carbonComponentPostEdges;
      let componentCenterX = placementPostEdges
        ? (placementPostEdges.leftPostInnerEdge + placementPostEdges.rightPostInnerEdge) / 2
        : bay.centerX;
      let componentWidth = aluminumBaseWallWideShelfEdges || aluminumBaseBackPanelPostEdges
        ? placementPostEdges.rightPostInnerEdge - placementPostEdges.leftPostInnerEdge
        : usesAdjustedAluminumBaseBay
          ? bay.innerBayWidth
          : meters(placement.visualScaleWidth || bay.innerBayWidth);
      if (
        series?.seriesId === "wall-mounted-v2"
      ) {
        componentCenterX = bay.centerX;
        componentWidth = Math.max(0.05, bay.rawBayWidth - meters(12));
      }
      let renderedPlacement = placement;
      let linkedShelfSourceBounds = null;
      if (
        series?.seriesId === "aluminum-base-supported"
        && placement.linkedWallWideShelf
      ) {
        const sourceModel = group.children.find((child) => (
          child.userData?.placementId === placement.sourcePlacementId
        ));
        const sourceLocalBox = sourceModel
          ? getObjectBoxRelativeTo(sourceModel, group)
          : null;
        if (sourceLocalBox && !sourceLocalBox.isEmpty()) {
          const linkedShelfHeight = sourceLocalBox.max.y;
          renderedPlacement = {
            ...placement,
            heightFromFloor: toMm(linkedShelfHeight)
          };
          linkedShelfSourceBounds = {
            sourcePlacementId: placement.sourcePlacementId,
            sourceLocalBox: serializeBox(sourceLocalBox),
            linkedShelfHeight: toMm(linkedShelfHeight),
            clearance: 0
          };
        }
      }
      report.bayPlacements.push({
        placementId: renderedPlacement.id,
        wallId: wall.id,
        axis: wallAxis,
        bayIndex: Number(renderedPlacement.bayIndex),
        leftPostX: toMm(bay.leftX),
        rightPostX: toMm(bay.rightX),
        postCenterDistance: toMm(bay.postCenterDistance),
        postProfileWidth: toMm(bay.postProfileWidth),
        bayCenterX: toMm(bay.centerX),
        rawBayWidth: toMm(bay.rawBayWidth),
        innerBayWidth: toMm(bay.innerBayWidth),
        componentCutLength: placement.componentCutLength,
        visualScaleWidth: placement.visualScaleWidth,
        aluminumComponentPostEdges: serializeAluminumPostInnerEdges(aluminumComponentPostEdges),
        aluminumBaseBackPanelPostEdges: serializeAluminumPostInnerEdges(aluminumBaseBackPanelPostEdges),
        aluminumBaseWallWideShelfEdges: serializeAluminumPostInnerEdges(aluminumBaseWallWideShelfEdges),
        carbonComponentPostEdges: serializeAluminumPostInnerEdges(carbonComponentPostEdges),
        componentCenterX: toMm(componentCenterX),
        componentWidth: toMm(componentWidth),
        linkedShelfSourceBounds
      });
      await addPlacement(
        group,
        renderedPlacement,
        componentCenterX,
        componentWidth,
        shelfDepth,
        config,
        design,
        series,
        report,
        debug,
        selectedId,
        wall,
        modelTransforms,
        cuttingRules,
        aluminumComponentPostEdges,
        carbonComponentPostEdges,
        aluminumBaseWoodShelfSupportRegistry
      );
  };
  if (series?.seriesId === "aluminum-base-supported") {
    const orderedPlacements = [
      ...wallPlacements.filter((placement) => !placement.linkedWallWideShelf),
      ...wallPlacements.filter((placement) => placement.linkedWallWideShelf)
    ];
    for (const placement of orderedPlacements) {
      await addWallPlacement(placement);
    }
  } else {
    await Promise.all(wallPlacements.map(addWallPlacement));
  }

  if (isVisualAssetPreviewMode(previewMode) && Array.isArray(config.visualAssets) && config.visualAssets.length) {
    await addPlannerVisualAssetsForWall(
      group,
      wall,
      postPositions,
      factoryInnerBayWidth,
      cuttingRules,
      config,
      report
    );
  }

  group.updateMatrixWorld(true);
}

function isVisualAssetPreviewMode(previewMode = "") {
  return previewMode === "ai-planner"
    || previewMode === "employee-visual-items"
    || previewMode === "client-visual-items";
}

async function addPlannerVisualAssetsForWall(
  group,
  wall,
  postPositions,
  factoryInnerBayWidth,
  cuttingRules,
  config,
  report
) {
  const allowedVisualAssets = (config.visualAssets || []).filter((asset) => {
    return asset?.assetPath
      && asset.wallId === wall.id
      && asset.visualAssetType;
  }).sort(comparePlannerVisualAssetPriority);
  if (!allowedVisualAssets.length) return;

  const allLongHangAssets = (config.visualAssets || []).filter((asset) => asset.zoneType === "longHangZone");
  report.visualAssetDiagnostics.longHangZoneCount = allLongHangAssets.length;
  const realCollisionBoxes = collectPlannerVisualRealCollisionBoxes(group);
  const placedVisualCollisionBoxes = [];

  for (const asset of allowedVisualAssets) {
    const bay = getBayGeometry(
      postPositions,
      asset.bayIndex,
      factoryInnerBayWidth,
      cuttingRules.postProfileWidthMm
    );
    if (!bay) continue;

    const sourceResolution = findPlannerVisualAssetSource(group, asset);
    const sourcePlacement = sourceResolution.object;
    if (asset.targetKind !== "floor" && !sourcePlacement) {
      const skipped = {
        visualAssetType: asset.visualAssetType,
        visualCategory: asset.visualCategory || "",
        wallId: asset.wallId,
        bayIndex: Number(asset.bayIndex),
        targetKind: asset.targetKind || "",
        sourcePlacementId: asset.sourcePlacementId || "",
        sourceComponentType: asset.sourceComponentType || "",
        ruleSource: asset.ruleSource || "",
        originalVisualAssetType: asset.originalVisualAssetType || "",
        replacementVisualAssetType: asset.replacementVisualAssetType || "",
        replacementReason: asset.replacementReason || "",
        skipReason: "attachmentSourceNotFound"
      };
      report.visualAssetDiagnostics.skippedVisualAssets.push(skipped);
      console.warn(`[ai-planner visual skipped] ${skipped.visualAssetType} bay=${skipped.bayIndex} reason=${skipped.skipReason}`, skipped);
      continue;
    }
    const visualObject = await createPlannerVisualAssetModel(asset.assetPath, asset.visualAssetType);
    if (!visualObject) {
      const failed = {
        visualAssetType: asset.visualAssetType,
        visualCategory: asset.visualCategory || "",
        wallId: asset.wallId,
        bayIndex: Number(asset.bayIndex),
        targetKind: asset.targetKind || "",
        sourcePlacementId: asset.sourcePlacementId || "",
        sourceComponentType: asset.sourceComponentType || "",
        ruleSource: asset.ruleSource || "",
        originalVisualAssetType: asset.originalVisualAssetType || "",
        replacementVisualAssetType: asset.replacementVisualAssetType || "",
        replacementReason: asset.replacementReason || "",
        skipReason: "modelLoadFailed"
      };
      report.visualAssetDiagnostics.failedAssets.push(failed);
      report.visualAssetDiagnostics.skippedVisualAssets.push(failed);
      console.warn(`[ai-planner visual skipped] ${failed.visualAssetType} bay=${failed.bayIndex} reason=${failed.skipReason}`, failed);
      continue;
    }
    report.visualAssetDiagnostics.loadedAssets.push({
      visualAssetType: asset.visualAssetType,
      visualCategory: asset.visualCategory || "",
      wallId: asset.wallId,
      bayIndex: Number(asset.bayIndex),
      targetKind: asset.targetKind || "",
      sourcePlacementId: asset.sourcePlacementId || "",
      sourceComponentType: asset.sourceComponentType || "",
      originalVisualAssetType: asset.originalVisualAssetType || "",
      replacementVisualAssetType: asset.replacementVisualAssetType || "",
      replacementReason: asset.replacementReason || "",
      ruleSource: asset.ruleSource || ""
    });

    const positionResult = positionPlannerVisualAsset({
      visualObject,
      asset,
      bay,
      group,
      sourcePlacement,
      roomHeightMm: config.room?.height,
      report
    });
    if (!positionResult.placed) {
      const skipped = {
        visualAssetType: asset.visualAssetType,
        visualCategory: asset.visualCategory || "",
        wallId: asset.wallId,
        bayIndex: Number(asset.bayIndex),
        targetKind: asset.targetKind || "",
        ruleSource: asset.ruleSource || "",
        sourcePlacementId: asset.sourcePlacementId || "",
        sourceComponentType: asset.sourceComponentType || "",
        originalVisualAssetType: asset.originalVisualAssetType || "",
        replacementVisualAssetType: asset.replacementVisualAssetType || "",
        replacementReason: asset.replacementReason || "",
        skipReason: positionResult.skipReason,
        ...(positionResult.diagnostics || {})
      };
      report.visualAssetDiagnostics.skippedVisualAssets.push(skipped);
      console.warn(`[ai-planner visual skipped] ${skipped.visualAssetType} bay=${skipped.bayIndex} reason=${skipped.skipReason}`, skipped);
      continue;
    }
    let activeAsset = asset;
    let activeVisualObject = visualObject;
    activeVisualObject.updateMatrixWorld(true);
    let preAddFinalBox = new THREE.Box3().setFromObject(activeVisualObject);
    let overlapIssue = getPlannerVisualOverlapIssue({
      asset: activeAsset,
      finalBox: preAddFinalBox,
      sourcePlacementId: activeAsset.sourcePlacementId || "",
      realCollisionBoxes,
      placedVisualCollisionBoxes
    });
    if (isTrouserLuggageOverlap(activeAsset, overlapIssue)) {
      report.visualAssetDiagnostics.luggageLargeConflictWithTrouser = true;
      report.visualAssetDiagnostics.luggageBlockedByTrouser = true;
    }
    if (overlapIssue) {
      const replacementResult = await tryReplaceLongHangCollisionVisual({
        asset: activeAsset,
        bay,
        group,
        sourcePlacement,
        roomHeightMm: config.room?.height,
        report,
        overlapIssue,
        realCollisionBoxes,
        placedVisualCollisionBoxes
      });
      if (replacementResult.replaced) {
        activeAsset = replacementResult.asset;
        activeVisualObject = replacementResult.visualObject;
        preAddFinalBox = replacementResult.finalBox;
        overlapIssue = null;
      } else if (replacementResult.asset) {
        activeAsset = replacementResult.asset;
      }
    }
    if (overlapIssue) {
      const replacementResult = await tryReplaceShortHangWoodShelfCollisionVisual({
        asset: activeAsset,
        bay,
        group,
        sourcePlacement,
        roomHeightMm: config.room?.height,
        report,
        overlapIssue,
        realCollisionBoxes,
        placedVisualCollisionBoxes
      });
      if (replacementResult.replaced) {
        activeAsset = replacementResult.asset;
        activeVisualObject = replacementResult.visualObject;
        preAddFinalBox = replacementResult.finalBox;
        overlapIssue = null;
      } else if (replacementResult.asset) {
        activeAsset = replacementResult.asset;
      }
    }
    if (overlapIssue) {
      const skipped = {
        visualAssetType: activeAsset.visualAssetType,
        visualCategory: activeAsset.visualCategory || "",
        wallId: activeAsset.wallId,
        bayIndex: Number(activeAsset.bayIndex),
        targetKind: activeAsset.targetKind || "",
        ruleSource: activeAsset.ruleSource || "",
        sourcePlacementId: activeAsset.sourcePlacementId || "",
        sourceComponentType: activeAsset.sourceComponentType || "",
        originalVisualAssetType: activeAsset.originalVisualAssetType || "",
        replacementVisualAssetType: activeAsset.replacementVisualAssetType || "",
        replacementReason: activeAsset.replacementReason || "",
        originalVisualAsset: activeAsset.originalVisualAsset || "",
        replacementAttempted: activeAsset.replacementAttempted === true,
        replacementAsset: activeAsset.replacementAsset || "",
        replacementCollisionPassed: activeAsset.replacementCollisionPassed === true,
        replacementCollisionReason: activeAsset.replacementCollisionReason || "",
        skipReason: overlapIssue.skipReason,
        overlapWith: overlapIssue.overlapWith,
        overlapType: overlapIssue.overlapType,
        overlapVolume: overlapIssue.overlapVolume,
        overlapMode: overlapIssue.overlapMode,
        overlapX: overlapIssue.overlapX,
        overlapY: overlapIssue.overlapY,
        sameBay: overlapIssue.sameBay,
        isGeneratedByDemand: isPlannerGeneratedVisualSource(activeAsset),
        isSupplemental: isSupplementalPlannerVisualSource(activeAsset),
        isAutoAdjustable: isAutoAdjustableTrouserVisual(activeAsset),
        trouserRackAutoRaised: false,
        luggageMovedToTop: false,
        luggageBlockedByClothes: overlapIssue.skipReason === "luggageBlockedByClothes",
        luggageBlockedByShoe: overlapIssue.skipReason === "luggageBlockedByShoe",
        luggageBlockedByTrouser: overlapIssue.skipReason === "luggageBlockedByTrouser"
      };
      if (overlapIssue.skipReason === "luggageBlockedByTrouser") {
        report.visualAssetDiagnostics.luggageLargeConflictWithTrouser = true;
        report.visualAssetDiagnostics.luggageBlockedByTrouser = true;
      }
      report.visualAssetDiagnostics.skippedVisualAssets.push(skipped);
      if (overlapIssue.overlapMode === "frontView2d" || overlapIssue.overlapMode === "floorOccupancy") {
        report.visualAssetDiagnostics.frontViewOverlapCount += 1;
        report.visualAssetDiagnostics.visualOverlap2DCount += 1;
      }
      if (overlapIssue.overlapMode === "3d") {
        report.visualAssetDiagnostics.visualOverlap3DCount += 1;
      }
      console.warn(`[ai-planner visual skipped] ${skipped.visualAssetType} bay=${skipped.bayIndex} reason=${skipped.skipReason}`, skipped);
      continue;
    }
    group.add(activeVisualObject);
    group.updateMatrixWorld(true);
    activeVisualObject.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(activeVisualObject);
    const finalPosition = activeVisualObject.getWorldPosition(new THREE.Vector3());
    const finalScale = activeVisualObject.scale.clone();
    const diagnostic = {
      visualAssetType: activeAsset.visualAssetType,
      zoneType: activeAsset.zoneType,
      attachedZoneId: activeAsset.attachedZoneId,
      wallId: activeAsset.wallId,
      bayIndex: Number(activeAsset.bayIndex),
      targetKind: activeAsset.targetKind || "",
      visualCategory: activeAsset.visualCategory || "",
      instanceIndex: Number(activeAsset.instanceIndex) || 0,
      sourcePlacementId: activeAsset.sourcePlacementId,
      sourceComponentType: activeAsset.sourceComponentType || "",
      originalVisualAssetType: activeAsset.originalVisualAssetType || "",
      replacementVisualAssetType: activeAsset.replacementVisualAssetType || "",
      replacementReason: activeAsset.replacementReason || "",
      originalVisualAsset: activeAsset.originalVisualAsset || "",
      replacementAttempted: activeAsset.replacementAttempted === true,
      replacementAsset: activeAsset.replacementAsset || "",
      replacementCollisionPassed: activeAsset.replacementCollisionPassed === true,
      replacementCollisionReason: activeAsset.replacementCollisionReason || "",
      sourceResolvedBy: sourceResolution.resolvedBy,
      fallbackTopUsed: activeAsset.fallbackTopUsed === true,
      luggageLargeConflictWithTrouser: activeAsset.luggageLargeConflictWithTrouser === true,
      luggageChangedLargeToSmall: activeAsset.luggageChangedLargeToSmall === true,
      luggageMovedToTopBecauseTrouserConflict: activeAsset.luggageMovedToTopBecauseTrouserConflict === true,
      luggageMovedToOtherFloorBay: activeAsset.luggageMovedToOtherFloorBay === true,
      rawBBoxSize: activeVisualObject.userData.rawBBoxSize,
      shoeAssetId: activeAsset.visualCategory === "shoe" ? activeAsset.id : "",
      targetSurfaceType: activeAsset.visualCategory === "shoe"
        ? activeAsset.targetKind === "shelf" ? sourcePlacement?.userData?.componentType || "woodShelf"
          : "floor"
        : "",
      targetBayIndex: activeAsset.visualCategory === "shoe" ? Number(activeAsset.bayIndex) : null,
      surfaceY: activeVisualObject.userData.shoeSurfaceY ?? null,
      rawBboxMinY: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.rawBboxMinY : null,
      finalBboxMinY: activeAsset.visualCategory === "shoe" ? toMm(finalBox.min.y) : null,
      targetY: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.targetY ?? null : null,
      surfaceTop: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.surfaceTop ?? null : null,
      fullSurfaceTop: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.fullSurfaceTop ?? null : null,
      visualSurfaceTop: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.visualSurfaceTop ?? null : null,
      shoeShelfVisualDrop: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.shoeShelfVisualDrop ?? null : null,
      shoeSurfaceDelta: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.shoeFloatingError ?? null : null,
      shoeSurfaceDeltaToVisualTop: activeAsset.visualCategory === "shoe" ? activeVisualObject.userData.shoeSurfaceDeltaToVisualTop ?? null : null,
      finalBboxMinYMinusSurfaceY: activeVisualObject.userData.shoeFloatingError ?? null,
      shoeFloatingError: activeAsset.visualCategory === "shoe"
        ? Math.abs(Number(activeVisualObject.userData.shoeFloatingError) || 0) > 12
        : false,
      item: activeAsset.visualCategory || "",
      targetComponent: activeAsset.sourceComponentType || activeAsset.targetKind || "",
      targetPosition: activeVisualObject.userData.targetPosition || null,
      railCenterX: activeVisualObject.userData.railCentering?.railCenterX ?? null,
      railCenterZ: activeVisualObject.userData.railCentering?.railCenterZ ?? null,
      visualBBoxCenterXBefore: activeVisualObject.userData.railCentering?.visualBBoxCenterXBefore ?? null,
      visualBBoxCenterXAfter: activeVisualObject.userData.railCentering?.visualBBoxCenterXAfter ?? null,
      visualRailCenterDeltaX: activeVisualObject.userData.railCentering?.visualRailCenterDeltaX ?? null,
      visualBBoxCenterZBefore: activeVisualObject.userData.railCentering?.visualBBoxCenterZBefore ?? null,
      visualBBoxCenterZAfter: activeVisualObject.userData.railCentering?.visualBBoxCenterZAfter ?? null,
      visualRailCenterDeltaZ: activeVisualObject.userData.railCentering?.visualRailCenterDeltaZ ?? null,
      railSpanX: activeVisualObject.userData.hangingRailValidation?.railSpanX ?? null,
      visualBBoxSizeX: activeVisualObject.userData.hangingRailValidation?.finalBboxSizeX ?? null,
      trouserVisualScaling: activeVisualObject.userData.trouserVisualScaling || null,
      ruleSource: activeAsset.ruleSource || "",
      skipReason: "",
      finalPosition: serializeVectorMm(finalPosition),
      finalScale: serializeVector(finalScale),
      finalBoundingBox: serializeBox(finalBox)
    };
    report.visualAssets.push(diagnostic);
    report.visualAssetDiagnostics.countsByType[activeAsset.visualAssetType] =
      (report.visualAssetDiagnostics.countsByType[activeAsset.visualAssetType] || 0) + 1;
    const category = activeAsset.visualCategory || activeAsset.zoneType || "unknown";
    report.visualAssetDiagnostics.countsByCategory[category] =
      (report.visualAssetDiagnostics.countsByCategory[category] || 0) + 1;
    if (activeAsset.visualCategory === "longHang") {
      report.visualAssetDiagnostics.cloth1InstanceCount += 1;
    }
    if (activeAsset.visualCategory === "bedding") {
      report.visualAssetDiagnostics.beddingFinalBbox.push(diagnostic.finalBoundingBox);
    }
    if (activeAsset.visualCategory === "luggage") {
      report.visualAssetDiagnostics.luggageFinalBbox.push(diagnostic.finalBoundingBox);
      if (activeAsset.luggageLargeConflictWithTrouser) {
        report.visualAssetDiagnostics.luggageLargeConflictWithTrouser = true;
      }
      if (activeAsset.luggageChangedLargeToSmall) {
        report.visualAssetDiagnostics.luggageChangedLargeToSmall = true;
      }
      if (activeAsset.luggageMovedToTopBecauseTrouserConflict) {
        report.visualAssetDiagnostics.luggageMovedToTopBecauseTrouserConflict = true;
      }
      if (activeAsset.luggageMovedToOtherFloorBay) {
        report.visualAssetDiagnostics.luggageMovedToOtherFloorBay = true;
      }
    }
    if (activeAsset.visualCategory === "trouser") {
      report.visualAssetDiagnostics.trouserVisualFinalBbox.push(diagnostic.finalBoundingBox);
    }
    placedVisualCollisionBoxes.push({
      box: finalBox.clone(),
      visualCategory: activeAsset.visualCategory || "",
      visualAssetType: activeAsset.visualAssetType,
      targetKind: activeAsset.targetKind || "",
      wallId: activeAsset.wallId,
      bayIndex: Number(activeAsset.bayIndex),
      id: activeAsset.id || activeAsset.sourcePlacementId || `${activeAsset.visualAssetType}:${activeAsset.wallId}:${activeAsset.bayIndex}:${activeAsset.instanceIndex || 0}`
    });
    console.log(`[ai-planner visual generated] ${diagnostic.visualAssetType} bay=${diagnostic.bayIndex} target=${diagnostic.targetComponent || diagnostic.targetKind}`, diagnostic);
  }

  reconcilePlannerVisualAssetDebug(report);

  console.log("[ai-planner] visual-assets-summary", {
    longHangZoneCount: report.visualAssetDiagnostics.longHangZoneCount,
    cloth1InstanceCount: report.visualAssetDiagnostics.cloth1InstanceCount,
    countsByType: report.visualAssetDiagnostics.countsByType,
    countsByCategory: report.visualAssetDiagnostics.countsByCategory,
    beddingFinalBbox: report.visualAssetDiagnostics.beddingFinalBbox,
    luggageFinalBbox: report.visualAssetDiagnostics.luggageFinalBbox,
    trouserVisualFinalBbox: report.visualAssetDiagnostics.trouserVisualFinalBbox
  });
  if (isPlannerSceneDebugEnabled()) {
    console.group("[ai-planner] Golden Visual Assets Runtime");
    console.table(report.visualAssets);
    console.table(report.visualAssetDiagnostics.skippedVisualAssets);
    console.groupEnd();
  }
}

function comparePlannerVisualAssetPriority(a, b) {
  return getPlannerVisualAssetPriority(a) - getPlannerVisualAssetPriority(b);
}

function getPlannerVisualAssetPriority(asset) {
  const category = asset.visualCategory || "";
  if (category === "shortHang" || category === "longHang") return 10;
  if (category === "luggage") return 20;
  if (category === "shoe") return 30;
  if (category === "bagShelf") return 40;
  if (category === "bedding") return 50;
  if (category === "trouser") return 60;
  return 90;
}

const LONG_HANG_REPLACEMENT_BLOCKING_TYPES = new Set([
  "woodShelf",
  "shoeShelf",
  "cabinet",
  "drawer",
  "jewelryBox",
  "storageBox"
]);

async function tryReplaceLongHangCollisionVisual({
  asset,
  bay,
  group,
  sourcePlacement,
  roomHeightMm,
  report,
  overlapIssue,
  realCollisionBoxes,
  placedVisualCollisionBoxes
}) {
  if (!shouldRetryLongHangCollisionReplacement(asset, overlapIssue)) {
    return { replaced: false, asset: null };
  }
  const replacementAsset = {
    ...asset,
    id: String(asset.id || "").replace("longHang-4", "longHang-5"),
    assetPath: getLongHang5ReplacementAssetPath(asset.assetPath),
    visualAssetType: "longHang-5",
    originalVisualAssetType: asset.originalVisualAssetType || asset.visualAssetType,
    replacementVisualAssetType: "longHang-5",
    replacementReason: `longHang4CollisionWith${capitalizeDebugToken(overlapIssue.overlapType)}`,
    originalVisualAsset: asset.visualAssetType,
    replacementAttempted: true,
    replacementAsset: "longHang-5",
    replacementCollisionPassed: false,
    replacementCollisionReason: ""
  };
  const replacementObject = await createPlannerVisualAssetModel(
    replacementAsset.assetPath,
    replacementAsset.visualAssetType
  );
  if (!replacementObject) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: "modelLoadFailed"
      }
    };
  }
  report.visualAssetDiagnostics.loadedAssets.push({
    visualAssetType: replacementAsset.visualAssetType,
    visualCategory: replacementAsset.visualCategory || "",
    wallId: replacementAsset.wallId,
    bayIndex: Number(replacementAsset.bayIndex),
    targetKind: replacementAsset.targetKind || "",
    sourcePlacementId: replacementAsset.sourcePlacementId || "",
    sourceComponentType: replacementAsset.sourceComponentType || "",
    originalVisualAssetType: replacementAsset.originalVisualAssetType || "",
    replacementVisualAssetType: replacementAsset.replacementVisualAssetType || "",
    replacementReason: replacementAsset.replacementReason || "",
    originalVisualAsset: replacementAsset.originalVisualAsset || "",
    replacementAttempted: true,
    replacementAsset: replacementAsset.replacementAsset || "",
    replacementCollisionPassed: false,
    replacementCollisionReason: "",
    ruleSource: replacementAsset.ruleSource || ""
  });

  const positionResult = positionPlannerVisualAsset({
    visualObject: replacementObject,
    asset: replacementAsset,
    bay,
    group,
    sourcePlacement,
    roomHeightMm,
    report
  });
  if (!positionResult.placed) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: positionResult.skipReason || "positionFailed"
      }
    };
  }
  replacementObject.updateMatrixWorld(true);
  const replacementFinalBox = new THREE.Box3().setFromObject(replacementObject);
  const replacementOverlapIssue = getPlannerVisualOverlapIssue({
    asset: replacementAsset,
    finalBox: replacementFinalBox,
    sourcePlacementId: replacementAsset.sourcePlacementId || "",
    realCollisionBoxes,
    placedVisualCollisionBoxes
  });
  if (replacementOverlapIssue) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: replacementOverlapIssue.skipReason || "visualOverlap",
        replacementOverlapWith: replacementOverlapIssue.overlapWith,
        replacementOverlapType: replacementOverlapIssue.overlapType,
        replacementOverlapVolume: replacementOverlapIssue.overlapVolume
      }
    };
  }
  return {
    replaced: true,
    asset: {
      ...replacementAsset,
      replacementCollisionPassed: true,
      replacementCollisionReason: "none"
    },
    visualObject: replacementObject,
    finalBox: replacementFinalBox
  };
}

function shouldRetryLongHangCollisionReplacement(asset, overlapIssue) {
  return asset?.visualCategory === "longHang"
    && asset.visualAssetType === "longHang-4"
    && overlapIssue?.skipReason === "clothesBlockedByRealComponent"
    && LONG_HANG_REPLACEMENT_BLOCKING_TYPES.has(overlapIssue.overlapType);
}

function getLongHang5ReplacementAssetPath(assetPath = "") {
  const basePath = assetPath
    ? String(assetPath).replace(/longHang-4\.glb(?:\?[^#]*)?/, "longHang-5.glb")
    : "/customer-home/position/longHang-5.glb";
  return `${basePath}${basePath.includes("?") ? "&" : "?"}v=20260627-origin-fix`;
}

async function tryReplaceShortHangWoodShelfCollisionVisual({
  asset,
  bay,
  group,
  sourcePlacement,
  roomHeightMm,
  report,
  overlapIssue,
  realCollisionBoxes,
  placedVisualCollisionBoxes
}) {
  if (!shouldRetryShortHangWoodShelfReplacement(asset, overlapIssue)) {
    return { replaced: false, asset: null };
  }
  const replacementAsset = {
    ...asset,
    id: String(asset.id || "").replace("shortHang-5", "shortHang-7"),
    assetPath: getShortHang7ReplacementAssetPath(asset.assetPath),
    visualAssetType: "shortHang-7",
    originalVisualAssetType: asset.originalVisualAssetType || asset.visualAssetType,
    replacementVisualAssetType: "shortHang-7",
    replacementReason: "shortHang5CollisionWithWoodShelf",
    originalVisualAsset: asset.visualAssetType,
    replacementAttempted: true,
    replacementAsset: "shortHang-7",
    replacementCollisionPassed: false,
    replacementCollisionReason: ""
  };
  const replacementObject = await createPlannerVisualAssetModel(
    replacementAsset.assetPath,
    replacementAsset.visualAssetType
  );
  if (!replacementObject) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: "modelLoadFailed"
      }
    };
  }
  report.visualAssetDiagnostics.loadedAssets.push({
    visualAssetType: replacementAsset.visualAssetType,
    visualCategory: replacementAsset.visualCategory || "",
    wallId: replacementAsset.wallId,
    bayIndex: Number(replacementAsset.bayIndex),
    targetKind: replacementAsset.targetKind || "",
    sourcePlacementId: replacementAsset.sourcePlacementId || "",
    sourceComponentType: replacementAsset.sourceComponentType || "",
    originalVisualAssetType: replacementAsset.originalVisualAssetType || "",
    replacementVisualAssetType: replacementAsset.replacementVisualAssetType || "",
    replacementReason: replacementAsset.replacementReason || "",
    originalVisualAsset: replacementAsset.originalVisualAsset || "",
    replacementAttempted: true,
    replacementAsset: replacementAsset.replacementAsset || "",
    replacementCollisionPassed: false,
    replacementCollisionReason: "",
    ruleSource: replacementAsset.ruleSource || ""
  });

  const positionResult = positionPlannerVisualAsset({
    visualObject: replacementObject,
    asset: replacementAsset,
    bay,
    group,
    sourcePlacement,
    roomHeightMm,
    report
  });
  if (!positionResult.placed) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: positionResult.skipReason || "positionFailed"
      }
    };
  }
  replacementObject.updateMatrixWorld(true);
  const replacementFinalBox = new THREE.Box3().setFromObject(replacementObject);
  const replacementOverlapIssue = getPlannerVisualOverlapIssue({
    asset: replacementAsset,
    finalBox: replacementFinalBox,
    sourcePlacementId: replacementAsset.sourcePlacementId || "",
    realCollisionBoxes,
    placedVisualCollisionBoxes
  });
  if (replacementOverlapIssue) {
    return {
      replaced: false,
      asset: {
        ...replacementAsset,
        replacementCollisionReason: replacementOverlapIssue.skipReason || "visualOverlap",
        replacementOverlapWith: replacementOverlapIssue.overlapWith,
        replacementOverlapType: replacementOverlapIssue.overlapType,
        replacementOverlapVolume: replacementOverlapIssue.overlapVolume
      }
    };
  }
  return {
    replaced: true,
    asset: {
      ...replacementAsset,
      replacementCollisionPassed: true,
      replacementCollisionReason: "none"
    },
    visualObject: replacementObject,
    finalBox: replacementFinalBox
  };
}

function shouldRetryShortHangWoodShelfReplacement(asset, overlapIssue) {
  return asset?.visualCategory === "shortHang"
    && asset.visualAssetType === "shortHang-5"
    && overlapIssue?.skipReason === "clothesBlockedByRealComponent"
    && overlapIssue.overlapType === "woodShelf";
}

function getShortHang7ReplacementAssetPath(assetPath = "") {
  return assetPath
    ? String(assetPath).replace(/shortHang-5\.glb(?:\?[^#]*)?/, "shortHang-7.glb")
    : "/customer-home/position/shortHang-7.glb";
}

function capitalizeDebugToken(value = "") {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "RealComponent";
}

function collectPlannerVisualRealCollisionBoxes(group) {
  const blockingTypes = new Set(["woodShelf", "glassShelf", "cabinet", "trouserRack", "jewelryBox", "basket", "drawer"]);
  const boxes = [];
  group.traverse((object) => {
    const componentType = object.userData?.componentType || "";
    if (!blockingTypes.has(componentType)) return;
    const box = getObjectBoxRelativeTo(object, group);
    if (!box || box.isEmpty()) return;
    boxes.push({
      box,
      componentType,
      id: object.userData?.placementId || object.name || componentType,
      wallId: object.userData?.wallId || "",
      bayIndex: Number(object.userData?.bayIndex)
    });
  });
  return boxes;
}

function getPlannerVisualOverlapIssue({
  asset,
  finalBox,
  sourcePlacementId,
  realCollisionBoxes,
  placedVisualCollisionBoxes
}) {
  const realOverlap = realCollisionBoxes
    .filter((item) => !isPlannerVisualSupportSurface(asset, item, sourcePlacementId))
    .map((item) => ({
      overlapWith: item.id,
      overlapType: item.componentType,
      overlapVolume: getBoxOverlapVolume(finalBox, item.box),
      ...getFrontViewOverlap2D(finalBox, item.box),
      sameBay: isSamePlannerBay(asset, item)
    }))
    .find((item) => shouldTreatPlannerVisualOverlapAsConflict(asset, item, true));
  if (realOverlap) {
    return {
      ...realOverlap,
      overlapMode: realOverlap.overlapVolume > 0 ? "3d" : "frontView2d",
      skipReason: getRealOverlapSkipReason(asset, realOverlap.overlapType)
    };
  }
  const visualOverlap = placedVisualCollisionBoxes
    .map((item) => ({
      overlapWith: item.id,
      overlapType: item.visualCategory || item.visualAssetType,
      overlapVolume: getBoxOverlapVolume(finalBox, item.box),
      ...getFrontViewOverlap2D(finalBox, item.box),
      sameBay: isSamePlannerBay(asset, item),
      targetKind: item.targetKind || ""
    }))
    .find((item) => shouldTreatPlannerVisualOverlapAsConflict(asset, item, false));
  if (!visualOverlap) return null;
  return {
    ...visualOverlap,
    overlapMode: getVisualOverlapMode(asset, visualOverlap),
    skipReason: getVisualOverlapSkipReason(asset, visualOverlap.overlapType)
  };
}

function getFrontViewOverlap2D(boxA, boxB) {
  const overlapXMeters = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
  const overlapYMeters = Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y);
  return {
    overlapX: Math.max(0, toMm(overlapXMeters)),
    overlapY: Math.max(0, toMm(overlapYMeters)),
    frontViewOverlap: toMm(overlapXMeters) > 20 && toMm(overlapYMeters) > 20
  };
}

function shouldTreatPlannerVisualOverlapAsConflict(asset, overlap, isRealComponent) {
  if (overlap.overlapVolume > 0) return true;
  if (!overlap.frontViewOverlap) return false;
  if (isRealComponent) return true;
  if (asset.visualCategory === "shoe" && asset.targetKind === "floor"
    && ["luggage", "shortHang", "longHang", "trouser"].includes(overlap.overlapType)) {
    return true;
  }
  if (["shortHang", "longHang", "trouser"].includes(asset.visualCategory)
    && ["shoe", "luggage", "bagShelf", "bedding"].includes(overlap.overlapType)) {
    return true;
  }
  if (asset.visualCategory === "luggage"
    && ["shoe", "shortHang", "longHang", "trouser"].includes(overlap.overlapType)) {
    return true;
  }
  return true;
}

function isSamePlannerBay(asset, item) {
  if (!item.wallId && !Number.isFinite(item.bayIndex)) return false;
  return String(asset.wallId || "") === String(item.wallId || "")
    && Number(asset.bayIndex) === Number(item.bayIndex);
}

function getVisualOverlapMode(asset, overlap) {
  if (asset.visualCategory === "shoe" && asset.targetKind === "floor"
    && ["luggage", "shortHang", "longHang", "trouser"].includes(overlap.overlapType)
    && overlap.sameBay) {
    return "floorOccupancy";
  }
  return overlap.overlapVolume > 0 ? "3d" : "frontView2d";
}

function isTrouserLuggageOverlap(asset, overlapIssue) {
  return asset.visualCategory === "trouser"
    && overlapIssue
    && overlapIssue.overlapType === "luggage";
}

function tryAutoRaiseTrouserVisualForLuggage({
  visualObject,
  sourcePlacement,
  asset,
  overlapIssue,
  placedVisualCollisionBoxes,
  realCollisionBoxes,
  sourcePlacementId,
  report
}) {
  return { raised: false, finalBox: null };
}

function hasBlockingFrontViewOverlapAfterTrouserRaise({
  asset,
  finalBox,
  sourcePlacementId,
  realCollisionBoxes,
  placedVisualCollisionBoxes,
  ignoredVisualId
}) {
  const realConflict = realCollisionBoxes
    .filter((item) => !isPlannerVisualSupportSurface(asset, item, sourcePlacementId))
    .some((item) => getFrontViewOverlap2D(finalBox, item.box).frontViewOverlap);
  if (realConflict) return true;
  return placedVisualCollisionBoxes
    .filter((item) => item.id !== ignoredVisualId)
    .some((item) => getFrontViewOverlap2D(finalBox, item.box).frontViewOverlap);
}

function isPlannerGeneratedVisualSource(asset) {
  return /^planner:|^auto:|demand/i.test(String(asset.sourcePlacementId || asset.id || ""));
}

function isSupplementalPlannerVisualSource(asset) {
  return /supplement|auto/i.test(String(asset.sourcePlacementId || asset.id || ""));
}

function isAutoAdjustableTrouserVisual(asset) {
  return false;
}

function isPlannerVisualSupportSurface(asset, item, sourcePlacementId) {
  if (item.id === sourcePlacementId) return true;
  if (!["shelf", "top"].includes(asset.targetKind)) return false;
  return Boolean(asset.sourceComponentType)
    && asset.sourceComponentType === item.componentType;
}

function getRealOverlapSkipReason(asset, overlapType) {
  if (asset.visualCategory === "luggage" && overlapType === "trouserRack") {
    return "luggageBlockedByTrouser";
  }
  if (["shortHang", "longHang", "trouser"].includes(asset.visualCategory)) {
    return "clothesBlockedByRealComponent";
  }
  if (asset.visualCategory === "shoe" && asset.targetKind === "floor") {
    return ["cabinet", "drawer", "basket"].includes(overlapType)
      ? "floorShoeBlockedByRealComponent"
      : "visualOverlap";
  }
  return "visualOverlap";
}

function getVisualOverlapSkipReason(asset, overlapType) {
  if (asset.visualCategory === "shoe" && asset.targetKind === "floor" && overlapType === "luggage") {
    return "floorShoeBlockedByLuggage";
  }
  if (asset.visualCategory === "shoe" && asset.targetKind === "floor"
    && ["shortHang", "longHang", "trouser"].includes(overlapType)) {
    return "floorShoeBlockedByClothes";
  }
  if (asset.visualCategory === "luggage" && ["shortHang", "longHang"].includes(overlapType)) {
    return "luggageBlockedByClothes";
  }
  if (asset.visualCategory === "luggage" && overlapType === "shoe") {
    return "luggageBlockedByShoe";
  }
  return "visualOverlap";
}

function getBoxOverlapVolume(boxA, boxB) {
  const minX = Math.max(boxA.min.x, boxB.min.x);
  const minY = Math.max(boxA.min.y, boxB.min.y);
  const minZ = Math.max(boxA.min.z, boxB.min.z);
  const maxX = Math.min(boxA.max.x, boxB.max.x);
  const maxY = Math.min(boxA.max.y, boxB.max.y);
  const maxZ = Math.min(boxA.max.z, boxB.max.z);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const depth = Math.max(0, maxZ - minZ);
  return toMm(width) * toMm(height) * toMm(depth);
}

function reconcilePlannerVisualAssetDebug(report) {
  const debug = report.visualAssetEligibility;
  if (!debug) return;
  const actualAssets = report.visualAssets || [];
  const skippedAssets = report.visualAssetDiagnostics.skippedVisualAssets || [];
  const byCategory = (category) => actualAssets.filter((asset) => asset.visualCategory === category);
  const skippedByCategory = (category) => skippedAssets.filter((asset) => asset.visualCategory === category);
  const skippedReasons = (category, previousReason, required, placed) => {
    const runtimeReasons = skippedByCategory(category).map((asset) => asset.skipReason).filter(Boolean);
    if (runtimeReasons.length || placed >= required) return runtimeReasons;
    if (Array.isArray(previousReason)) return previousReason.filter(Boolean);
    return previousReason ? [previousReason] : ["insufficientValidTargets"];
  };
  const shortHang = byCategory("shortHang");
  const shoes = byCategory("shoe");
  const bags = byCategory("bagShelf");
  const bedding = byCategory("bedding");
  const luggage = byCategory("luggage");
  const trousers = byCategory("trouser");
  debug.shortHangVisualPlaced = shortHang.length;
  debug.placedShortHangSets = shortHang.length;
  debug.shoePlacedOnShelfCount = shoes.filter((asset) => asset.targetKind === "shelf").length;
  debug.shoePlacedOnFloorCount = shoes.filter((asset) => asset.targetKind === "floor").length;
  debug.shoeFinalBbox = shoes.map((asset) => asset.finalBoundingBox);
  debug.shoeSkippedReason = skippedReasons("shoe", debug.shoeSkippedReason,
    Number(debug.shoesDemand || 0) > 0 ? Number(debug.goldenAssetTable?.find((row) => row.assetType === "shoe")?.required || 0) : 0,
    shoes.length);
  debug.bagVisualPlaced = bags.length;
  debug.bagTargetBayIndexes = bags.map((asset) => asset.bayIndex);
  debug.bagSurfaceType = bags.map((asset) => asset.sourceComponentType === "cabinet"
    ? "cabinetTop"
    : "woodShelf");
  debug.bagSkippedReason = skippedReasons("bagShelf", debug.bagSkippedReason,
    Number(debug.bagRequired || 0), bags.length);
  debug.beddingPlacedCount = bedding.length;
  debug.beddingTargetTopBayIndexes = bedding.map((asset) => asset.bayIndex);
  debug.beddingFinalBbox = bedding.map((asset) => asset.finalBoundingBox);
  debug.beddingSkippedReason = skippedReasons("bedding", debug.beddingSkippedReason,
    Number(debug.beddingRequired || 0), bedding.length);
  debug.luggagePlacedOnFloor = luggage.filter((asset) => asset.targetKind === "floor").length;
  debug.luggagePlacedOnTop = luggage.filter((asset) => asset.targetKind === "top").length;
  debug.luggageScale = luggage.map((asset) => asset.finalScale);
  debug.luggageSkippedReason = skippedReasons("luggage", debug.luggageSkippedReason,
    Number(debug.luggageRequired || 0), luggage.length);
  debug.trouserVisualAssetCount = trousers.length;
  debug.trouserVisualPlaced = trousers.length;
  debug.trouserSkippedReason = skippedReasons("trouser", debug.trouserSkippedReason,
    Number(debug.trouserRackCount || 0), trousers.length);

  (debug.goldenAssetTable || []).forEach((row) => {
    const category = row.assetType === "trouserPants" ? "trouser"
      : row.assetType === "bagShelf" ? "bagShelf"
        : row.assetType;
    const placed = byCategory(category).length;
    row.placed = placed;
    row.skipped = Math.max(0, Number(row.required || 0) - placed);
    row.skipReason = row.skipped
      ? skippedByCategory(category).map((asset) => asset.skipReason).filter(Boolean).join(", ")
        || row.skipReason || "insufficientValidTargets"
      : "";
  });
  (debug.goldenBayTable || []).forEach((row) => {
    const bayAssets = actualAssets.filter((asset) => asset.wallId === row.wallId
      && Number(asset.bayIndex) === Number(row.bayIndex));
    row.visualAssets = bayAssets.map((asset) => asset.visualAssetType).join(", ");
    row.visualAssetsPlaced = row.visualAssets;
    const baySkips = skippedAssets.filter((asset) => asset.wallId === row.wallId
      && Number(asset.bayIndex) === Number(row.bayIndex));
    row.validationErrors = [row.validationErrors, ...baySkips.map((asset) => asset.skipReason)]
      .filter(Boolean).join(", ");
    row.invalidReason = row.validationErrors;
  });
}

function findPlannerVisualAssetSource(group, asset) {
  const placementMatch = findPlacementObject(group, asset.sourcePlacementId);
  if (placementMatch) return { object: placementMatch, resolvedBy: "placementId" };
  const componentType = asset.sourceComponentType
    || (asset.targetKind === "top" ? "woodTop" : "");
  if (!componentType) return { object: null, resolvedBy: "" };
  const candidates = [];
  group.traverse((object) => {
    if (!object.userData?.isPlacementModel) return;
    if (object.userData.componentType !== componentType) return;
    candidates.push(object);
  });
  const sameBay = candidates.find((object) => (
    Number(object.userData.bayIndex) === Number(asset.bayIndex)
  ));
  if (sameBay) return { object: sameBay, resolvedBy: "sameBayComponentType" };
  const nearest = candidates.sort((left, right) => (
    Math.abs(Number(left.userData.bayIndex) - Number(asset.bayIndex))
    - Math.abs(Number(right.userData.bayIndex) - Number(asset.bayIndex))
  ))[0] || null;
  return {
    object: nearest,
    resolvedBy: nearest ? "nearestComponentType" : ""
  };
}

function findPlacementObject(group, placementId) {
  if (!placementId) return null;
  let match = null;
  group.traverse((object) => {
    if (!match && object.userData?.placementId === placementId) match = object;
  });
  return match;
}

function isPlannerSceneDebugEnabled() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function normalizeGeneratedVisualDebugRecord(record = {}) {
  return {
    assetType: record.visualAssetType || "",
    visualCategory: record.visualCategory || "",
    item: record.item || record.visualCategory || "",
    targetKind: record.targetKind || "",
    targetComponent: record.targetComponent || record.sourceComponentType || "",
    targetBayIndex: Number.isFinite(Number(record.targetBayIndex))
      ? Number(record.targetBayIndex)
      : Number(record.bayIndex),
    sourcePlacementId: record.sourcePlacementId || "",
    sourceComponentType: record.sourceComponentType || "",
    position: record.finalPosition || record.targetPosition || null,
    bbox: record.finalBoundingBox || null,
    ruleSource: record.ruleSource || "",
    trouserVisualScaling: record.trouserVisualScaling || null,
    skipReason: formatTrouserVisualScalingDebug(record.trouserVisualScaling)
  };
}

function formatTrouserVisualScalingDebug(scaling) {
  if (!scaling?.applied) return "";
  return [
    `raw=${Math.round(Number(scaling.rawBBoxWidth) || 0)}`,
    `target=${Math.round(Number(scaling.targetWidth) || 0)}`,
    `scaleX=${Number(scaling.scaleX || 0).toFixed(3)}`,
    `final=${Math.round(Number(scaling.finalBBoxWidth) || 0)}`
  ].join(" ");
}

function normalizeSkippedVisualDebugRecord(record = {}) {
  return {
    assetType: record.visualAssetType || record.assetType || "",
    visualCategory: record.visualCategory || "",
    item: record.item || record.visualCategory || "",
    targetKind: record.targetKind || "",
    targetBayIndex: Number.isFinite(Number(record.targetBayIndex))
      ? Number(record.targetBayIndex)
      : Number(record.bayIndex),
    sourcePlacementId: record.sourcePlacementId || "",
    sourceComponentType: record.sourceComponentType || "",
    skipReason: record.skipReason || "",
    detail: record
  };
}

function normalizeLoadedVisualDebugRecord(record = {}) {
  return {
    assetType: record.visualAssetType || record.assetType || "",
    visualCategory: record.visualCategory || "",
    item: record.item || record.visualCategory || "",
    targetKind: record.targetKind || "",
    targetBayIndex: Number.isFinite(Number(record.targetBayIndex))
      ? Number(record.targetBayIndex)
      : Number(record.bayIndex),
    sourcePlacementId: record.sourcePlacementId || "",
    sourceComponentType: record.sourceComponentType || "",
    ruleSource: record.ruleSource || ""
  };
}

function getAiPlannerVisualDebugPayload(report = {}) {
  const diagnostics = report.visualAssetDiagnostics || {};
  const generated = (report.visualAssets || []).map(normalizeGeneratedVisualDebugRecord);
  const skipped = (diagnostics.skippedVisualAssets || []).map(normalizeSkippedVisualDebugRecord);
  const loadedAssets = (diagnostics.loadedAssets || []).map(normalizeLoadedVisualDebugRecord);
  const failedAssets = (diagnostics.failedAssets || []).map(normalizeSkippedVisualDebugRecord);
  return {
    activeRender: getAiPlannerActiveRenderPayload(report),
    generated,
    skipped,
    loadedAssets,
    failedAssets,
    summary: {
      generatedCount: generated.length,
      skippedCount: skipped.length,
      loadedCount: loadedAssets.length,
      failedCount: failedAssets.length
    }
  };
}

function getAiPlannerActiveRenderPayload(report = {}) {
  const info = report.activeRender || {};
  const diagnostics = report.visualAssetDiagnostics || {};
  return {
    renderId: info.renderId || "",
    planType: info.planType || "",
    planTitle: info.planTitle || "",
    planId: info.planId || "",
    candidatePlanId: info.candidatePlanId || "",
    visualDebugKey: info.visualDebugKey || "",
    sceneJsImportUrl: report.sceneJsImportUrl || "",
    generatedCount: Array.isArray(report.visualAssets) ? report.visualAssets.length : 0,
    skippedCount: Array.isArray(diagnostics.skippedVisualAssets) ? diagnostics.skippedVisualAssets.length : 0,
    timestamp: info.timestamp || new Date().toISOString()
  };
}

function publishAiPlannerActiveRender(modelReport = {}) {
  if (typeof window === "undefined") return;
  const payload = getAiPlannerActiveRenderPayload(modelReport);
  if (!payload.renderId && !payload.planType) return;
  window.__AI_PLANNER_ACTIVE_RENDER__ = payload;
  updateAiPlannerRenderStamp(payload);
}

function updateAiPlannerRenderStamp(activeRender = {}) {
  if (typeof document === "undefined" || !activeRender.renderId) return;
  const stamp = document.querySelector(`[data-ai-render-stamp][data-render-id="${activeRender.renderId}"]`);
  if (!stamp) return;
  stamp.textContent = [
    `renderId: ${activeRender.renderId}`,
    `planType: ${activeRender.planType || "-"}`,
    `planTitle: ${activeRender.planTitle || "-"}`,
    `planId: ${activeRender.planId || "-"}`,
    `candidatePlanId: ${activeRender.candidatePlanId || "-"}`,
    `visualDebug: ${activeRender.visualDebugKey || "-"}`,
    `sceneJsImportUrl: ${activeRender.sceneJsImportUrl || "-"}`,
    `visualGeneratedCount: ${Number(activeRender.generatedCount) || 0}`,
    `visualSkippedCount: ${Number(activeRender.skippedCount) || 0}`
  ].join("\n");
}

function publishAiPlannerVisualDebug(modelReport = {}) {
  if (typeof window === "undefined") return;
  const payload = getAiPlannerVisualDebugPayload(modelReport);
  window.__AI_PLANNER_VISUAL_DEBUG__ = payload;
  if (isPlannerSceneDebugEnabled()) {
    renderAiPlannerVisualDebugTable(payload);
  }
}

function renderAiPlannerVisualDebugTable(payload) {
  if (typeof document === "undefined") return;
  const host = document.querySelector(".candidate-debug-panel") || document.querySelector(".ai-plan-panel");
  if (!host) return;
  let section = document.querySelector("[data-visual-asset-debug-table]");
  if (!section) {
    section = document.createElement("section");
    section.setAttribute("data-visual-asset-debug-table", "true");
    section.className = "candidate-debug-panel";
    host.appendChild(section);
  }
  const rows = [
    ...(payload.generated || []).map((record) => ({ status: "generated", ...record, skipReason: "" })),
    ...(payload.skipped || []).map((record) => ({ status: "skipped", ...record }))
  ];
  const activeRender = payload.activeRender || {};
  section.innerHTML = `
    <h2>Visual Asset Debug</h2>
    <dl>
      <div><dt>activeRenderId</dt><dd>${escapeDebugText(activeRender.renderId || "")}</dd></div>
      <div><dt>activePlanType</dt><dd>${escapeDebugText(activeRender.planType || "")}</dd></div>
      <div><dt>activePlanTitle</dt><dd>${escapeDebugText(activeRender.planTitle || "")}</dd></div>
      <div><dt>activeCandidatePlanId</dt><dd>${escapeDebugText(activeRender.candidatePlanId || "")}</dd></div>
      <div><dt>generatedCount</dt><dd>${payload.summary.generatedCount}</dd></div>
      <div><dt>skippedCount</dt><dd>${payload.summary.skippedCount}</dd></div>
      <div><dt>loadedCount</dt><dd>${payload.summary.loadedCount}</dd></div>
      <div><dt>failedCount</dt><dd>${payload.summary.failedCount}</dd></div>
    </dl>
    <div class="candidate-heatmap-table">
      <div class="candidate-heatmap-row candidate-heatmap-head">
        <span>status</span><span>assetType</span><span>item</span><span>targetKind</span>
        <span>bayIndex</span><span>sourceComponentType</span><span>skipReason</span>
      </div>
      ${rows.map((row) => `
        <div class="candidate-heatmap-row">
          <span>${escapeDebugText(row.status)}</span>
          <span>${escapeDebugText(row.assetType)}</span>
          <span>${escapeDebugText(row.item)}</span>
          <span>${escapeDebugText(row.targetKind)}</span>
          <span>${escapeDebugText(row.targetBayIndex ?? "")}</span>
          <span>${escapeDebugText(row.sourceComponentType || "")}</span>
          <span>${escapeDebugText(row.skipReason || "")}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function escapeDebugText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function createPlannerVisualAssetModel(assetPath, visualAssetType) {
  try {
    const source = await loadVisualAssetModel(assetPath, visualAssetType);
    const clone = source.clone(true);
    cleanupLoadedModel(clone);
    clone.name = `Planner Visual Asset ${visualAssetType}`;
    clone.userData = {
      ...clone.userData,
      isPlannerVisualAsset: true,
      visualAssetType
    };
    clone.traverse((child) => {
      child.frustumCulled = false;
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  } catch (error) {
    console.warn("[ai-planner] visual-asset-load-failed", {
      visualAssetType,
      assetPath,
      reason: error.message
    });
    return null;
  }
}

function loadVisualAssetModel(assetPath, visualAssetType = "") {
  const version = plannerVisualAssetVersions[visualAssetType] || plannerVisualAssetVersions.default;
  const url = /[?&]v=/.test(assetPath)
    ? assetPath
    : `${assetPath}${assetPath.includes("?") ? "&" : "?"}v=${version}`;
  if (!visualAssetModelCache.has(url)) {
    visualAssetModelCache.set(url, withTimeout(new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }), 12000, url));
  }
  return visualAssetModelCache.get(url);
}

function positionPlannerVisualAsset({
  visualObject,
  asset,
  bay,
  group,
  sourcePlacement,
  roomHeightMm,
  report
}) {
  visualObject.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(visualObject);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const sourceLocalBox = sourcePlacement ? getObjectBoxRelativeTo(sourcePlacement, group) : null;
  const sourceCenter = sourceLocalBox && !sourceLocalBox.isEmpty()
    ? sourceLocalBox.getCenter(new THREE.Vector3())
    : null;
  const shelfSurface = getPlannerVisualShelfSurface({
    asset,
    sourcePlacement,
    group
  });
  if (asset.targetKind === "shelf" && !shelfSurface.applied) {
    return {
      placed: false,
      skipReason: "shelfSurfaceNotFound",
      diagnostics: {
        assetType: asset.visualAssetType || "",
        sourcePlacementId: asset.sourcePlacementId || "",
        shelfPlacementHeight: Number.isFinite(Number(asset.heightFromFloor)) ? Number(asset.heightFromFloor) : null
      }
    };
  }
  if (asset.targetKind === "top" && sourceLocalBox && !sourceLocalBox.isEmpty()) {
    const availableHeight = meters(Number(roomHeightMm) || 0) - sourceLocalBox.max.y - 0.01;
    if (availableHeight <= 0) {
      return { placed: false, skipReason: getTopClearanceSkipReason(asset) };
    }
    if (availableHeight > 0 && rawSize.y > availableHeight) {
      return { placed: false, skipReason: getTopClearanceSkipReason(asset) };
    }
  }

  visualObject.scale.setScalar(1);
  visualObject.updateMatrixWorld(true);
  const target = getPlannerVisualAssetTarget({
    asset,
    bay,
    sourceLocalBox,
    sourceCenter,
    shelfSurfaceLocalBox: shelfSurface.localBox,
    shelfSurfaceY: shelfSurface.surfaceY
  });
  if (asset.visualCategory === "shoe" || String(asset.visualAssetType || "").includes("shoePair")) {
    target.y -= rawBox.min.y;
  }
  visualObject.position.set(target.x, target.y, target.z);
  if (target.rotation) {
    visualObject.rotation.set(target.rotation.x || 0, target.rotation.y || 0, target.rotation.z || 0);
  }
  visualObject.updateMatrixWorld(true);
  let finalBox = new THREE.Box3().setFromObject(visualObject);
  const trouserVisualScaling = scaleTrouserVisualAssetToSourceWidth({
    visualObject,
    asset,
    rawSize,
    sourceLocalBox,
    sourcePlacement
  });
  if (trouserVisualScaling.applied) {
    visualObject.updateMatrixWorld(true);
    finalBox = new THREE.Box3().setFromObject(visualObject);
  }
  const railCentering = centerHangingVisualOnRail({
    visualObject,
    asset,
    finalBox,
    sourceLocalBox
  });
  if (railCentering.applied) {
    visualObject.updateMatrixWorld(true);
    finalBox = new THREE.Box3().setFromObject(visualObject);
  }
  const shelfSurfaceAlignment = alignPlannerVisualToShelfSurface({
    visualObject,
    asset,
    target,
    shelfSurface,
    finalBox
  });
  if (shelfSurfaceAlignment.applied) {
    finalBox = shelfSurfaceAlignment.finalBox;
  }
  const { finalBox: _shelfSurfaceAlignmentBox, ...shelfSurfaceAlignmentDebug } = shelfSurfaceAlignment;
  const shoeSurfaceY = asset.visualCategory === "shoe"
    ? target.surfaceTop ?? target.y
    : null;
  const shoeFloatingError = asset.visualCategory === "shoe" && shoeSurfaceY !== null
    ? finalBox.min.y - shoeSurfaceY
    : null;
  const shoeSurfaceBox = asset.visualCategory === "shoe"
    ? getShoeSurfaceBox({ asset, bay, sourceLocalBox: shelfSurface.localBox || sourceLocalBox })
    : null;
  const shoeSurfaceValidation = shoeSurfaceBox
    ? validateBoxInsideSurface(finalBox, shoeSurfaceBox)
    : null;
  const shortHangRailValidation = asset.visualCategory === "shortHang" && sourceLocalBox
    ? validateShortHangAgainstRail(finalBox, sourceLocalBox)
    : null;
  const hangingRailValidation = ["shortHang", "longHang"].includes(asset.visualCategory) && sourceLocalBox
    ? validateShortHangAgainstRail(finalBox, sourceLocalBox)
    : null;
  if (asset.visualCategory === "shoe" && shoeSurfaceValidation
    && (!shoeSurfaceValidation.insideSurfaceX || !shoeSurfaceValidation.insideSurfaceZ)) {
    return {
      placed: false,
      skipReason: "noValidShoeSurface",
      diagnostics: {
        shoeAssetId: asset.id,
        targetSurfaceType: getShoeTargetSurfaceType(asset, sourcePlacement),
        targetBayIndex: Number(asset.bayIndex),
        surfaceBBox: serializeBox(shoeSurfaceBox),
        finalBBox: serializeBox(finalBox),
        ...shoeSurfaceValidation,
        shoeSkippedReason: "noValidShoeSurface"
      }
    };
  }
  if (asset.visualCategory === "shortHang" && shortHangRailValidation
    && !shortHangRailValidation.insideRailSpanX) {
    return {
      placed: false,
      skipReason: "assetTooWideForRail",
      diagnostics: {
        assetId: asset.id,
        rawBboxSizeX: toMm(rawSize.x),
        ...shortHangRailValidation,
        finalScale: serializeVector(visualObject.scale)
      }
    };
  }

  visualObject.userData = {
    ...visualObject.userData,
    attachedZoneId: asset.attachedZoneId,
    wallId: asset.wallId,
    bayIndex: Number(asset.bayIndex),
    targetKind: asset.targetKind || "",
    visualCategory: asset.visualCategory || "",
    instanceIndex: Number(asset.instanceIndex) || 0,
    sourcePlacementId: asset.sourcePlacementId,
    targetPosition: serializeVectorMm(new THREE.Vector3(target.x, target.y, target.z)),
    targetY: asset.visualCategory === "shoe" ? toMm(target.y) : null,
    surfaceTop: shoeSurfaceY === null ? null : toMm(shoeSurfaceY),
    fullSurfaceTop: asset.visualCategory === "shoe" ? toMm(target.fullSurfaceTop ?? target.surfaceTop ?? target.y) : null,
    visualSurfaceTop: asset.visualCategory === "shoe" ? toMm(target.visualSurfaceTop ?? target.surfaceTop ?? target.y) : null,
    shoeShelfVisualDrop: asset.visualCategory === "shoe" ? toMm(target.shoeShelfVisualDrop || 0) : null,
    rawBBoxSize: serializeVectorMm(rawSize),
    rawBboxMinY: toMm(rawBox.min.y),
    shoeSurfaceY: shoeSurfaceY === null ? null : toMm(shoeSurfaceY),
    shoeFloatingError: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    shoeSurfaceDelta: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    shoeSurfaceDeltaToVisualTop: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    shoeSurfaceBBox: shoeSurfaceBox ? serializeBox(shoeSurfaceBox) : null,
    shoeSurfaceValidation,
    shortHangRailValidation,
    hangingRailValidation,
    railCentering,
    trouserVisualScaling,
    shelfSurfaceAlignment: shelfSurfaceAlignmentDebug
  };
  report.runtimeDebug.push({
    type: "plannerVisualAsset",
    visualAssetType: asset.visualAssetType,
    attachedZoneId: asset.attachedZoneId,
    wallId: asset.wallId,
    bayIndex: Number(asset.bayIndex),
    targetKind: asset.targetKind || "",
    visualCategory: asset.visualCategory || "",
    instanceIndex: Number(asset.instanceIndex) || 0,
    railReference: sourceLocalBox && !sourceLocalBox.isEmpty() ? serializeBox(sourceLocalBox) : null,
    target: serializeVectorMm(new THREE.Vector3(target.x, target.y, target.z)),
    targetY: asset.visualCategory === "shoe" ? toMm(target.y) : null,
    surfaceTop: shoeSurfaceY === null ? null : toMm(shoeSurfaceY),
    fullSurfaceTop: asset.visualCategory === "shoe" ? toMm(target.fullSurfaceTop ?? target.surfaceTop ?? target.y) : null,
    visualSurfaceTop: asset.visualCategory === "shoe" ? toMm(target.visualSurfaceTop ?? target.surfaceTop ?? target.y) : null,
    shoeShelfVisualDrop: asset.visualCategory === "shoe" ? toMm(target.shoeShelfVisualDrop || 0) : null,
    rawBBoxSize: serializeVectorMm(rawSize),
    finalBBoxSize: serializeVectorMm(finalBox.getSize(new THREE.Vector3())),
    scale: serializeVector(visualObject.scale),
    shoeAssetId: asset.visualCategory === "shoe" ? asset.id : "",
    targetSurfaceType: asset.visualCategory === "shoe" ? getShoeTargetSurfaceType(asset, sourcePlacement) : "",
    targetBayIndex: asset.visualCategory === "shoe" ? Number(asset.bayIndex) : null,
    surfaceBBox: shoeSurfaceBox ? serializeBox(shoeSurfaceBox) : null,
    finalBBox: asset.visualCategory === "shoe" ? serializeBox(finalBox) : null,
    insideSurfaceX: shoeSurfaceValidation?.insideSurfaceX ?? null,
    insideSurfaceZ: shoeSurfaceValidation?.insideSurfaceZ ?? null,
    intersectsPost: shoeSurfaceValidation?.intersectsPost ?? null,
    centerOffsetFromSurfaceCenterX: shoeSurfaceValidation?.centerOffsetFromSurfaceCenterX ?? null,
    centerOffsetFromSurfaceCenterZ: shoeSurfaceValidation?.centerOffsetFromSurfaceCenterZ ?? null,
    assetId: asset.visualCategory === "shortHang" ? asset.id : "",
    rawBboxSizeX: asset.visualCategory === "shortHang" ? toMm(rawSize.x) : null,
    railSpanX: hangingRailValidation?.railSpanX ?? null,
    finalBboxSizeX: hangingRailValidation?.finalBboxSizeX ?? null,
    insideRailSpanX: hangingRailValidation?.insideRailSpanX ?? null,
    finalBboxMaxYMinusRailY: hangingRailValidation?.finalBboxMaxYMinusRailY ?? null,
    centerZDelta: hangingRailValidation?.centerZDelta ?? null,
    railCenterX: railCentering.railCenterX,
    railCenterZ: railCentering.railCenterZ,
    visualBBoxCenterXBefore: railCentering.visualBBoxCenterXBefore,
    visualBBoxCenterXAfter: railCentering.visualBBoxCenterXAfter,
    visualRailCenterDeltaX: railCentering.visualRailCenterDeltaX,
    visualBBoxCenterZBefore: railCentering.visualBBoxCenterZBefore,
    visualBBoxCenterZAfter: railCentering.visualBBoxCenterZAfter,
    visualRailCenterDeltaZ: railCentering.visualRailCenterDeltaZ,
    visualBBoxSizeX: hangingRailValidation?.finalBboxSizeX ?? null,
    trouserVisualScaling,
    shelfSurfaceAlignment: shelfSurfaceAlignmentDebug,
    surfaceY: shoeSurfaceY === null ? null : toMm(shoeSurfaceY),
    rawBboxMinY: asset.visualCategory === "shoe" ? toMm(rawBox.min.y) : null,
    finalBboxMinY: asset.visualCategory === "shoe" ? toMm(finalBox.min.y) : null,
    shoeSurfaceDelta: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    shoeSurfaceDeltaToVisualTop: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    finalBboxMinYMinusSurfaceY: shoeFloatingError === null ? null : toMm(shoeFloatingError),
    shoeFloatingError: shoeFloatingError === null ? null : Math.abs(toMm(shoeFloatingError)) > 12
  });
  return { placed: true, skipReason: "" };
}

function getPlannerVisualShelfSurface({
  asset,
  sourcePlacement,
  group
}) {
  const empty = {
    applied: false,
    localBox: null,
    worldBox: null,
    surfaceY: null,
    wholeShelfMaxY: null,
    selectedBoardMeshName: "",
    boardSurfaceY: null,
    boardMeshFound: false,
    shelfObjectName: "",
    shelfMeshCount: 0
  };
  if (asset.targetKind !== "shelf" || !sourcePlacement) return empty;
  const componentType = sourcePlacement.userData?.componentType || asset.sourceComponentType || "";
  if (!["woodShelf", "displayShelf", "glassShelf", "shoeShelf"].includes(componentType)) return empty;

  group.updateMatrixWorld(true);
  sourcePlacement.updateMatrixWorld(true);
  const wholeWorldBox = new THREE.Box3().setFromObject(sourcePlacement);
  const wholeLocalBox = getObjectBoxRelativeTo(sourcePlacement, group);
  if (wholeWorldBox.isEmpty() || wholeLocalBox.isEmpty()) return empty;

  const boardMeshes = findPlannerShelfBoardMeshes(sourcePlacement, group, wholeLocalBox);
  const shelfObjects = boardMeshes.length ? boardMeshes : [sourcePlacement];
  const worldBox = new THREE.Box3();
  shelfObjects.forEach((shelfObject) => {
    const shelfObjectBox = new THREE.Box3().setFromObject(shelfObject);
    if (!shelfObjectBox.isEmpty()) worldBox.union(shelfObjectBox);
  });
  const localBox = getObjectsBoxRelativeTo(shelfObjects, group);
  if (worldBox.isEmpty() || localBox.isEmpty()) {
    return {
      ...empty,
      applied: true,
      localBox: wholeLocalBox,
      worldBox: wholeWorldBox,
      surfaceY: wholeWorldBox.max.y,
      wholeShelfMaxY: wholeWorldBox.max.y,
      shelfObjectName: sourcePlacement.name || sourcePlacement.type || "",
      shelfMeshCount: 1
    };
  }

  return {
    applied: true,
    localBox,
    worldBox,
    surfaceY: worldBox.max.y,
    wholeShelfMaxY: wholeWorldBox.max.y,
    selectedBoardMeshName: boardMeshes.map((object) => object.name || object.type || "").filter(Boolean).join(", "),
    boardSurfaceY: boardMeshes.length ? worldBox.max.y : null,
    boardMeshFound: boardMeshes.length > 0,
    shelfObjectName: shelfObjects.map((object) => object.name || object.type || "").filter(Boolean).join(", "),
    shelfMeshCount: shelfObjects.length
  };
}

function findPlannerShelfBoardMeshes(shelfObject, group, wholeLocalBox) {
  const exactBoardMeshes = [];
  shelfObject.traverse((child) => {
    if (!child.isMesh) return;
    if (child.name === "Geom3D_组件#15") exactBoardMeshes.push(child);
  });
  if (exactBoardMeshes.length) return exactBoardMeshes;

  const wholeSize = wholeLocalBox.getSize(new THREE.Vector3());
  const candidates = [];
  shelfObject.traverse((child) => {
    if (!child.isMesh || isMetalShelfMesh(child)) return;
    const box = getObjectBoxRelativeTo(child, group);
    if (!box || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const widthRatio = wholeSize.x ? size.x / wholeSize.x : 0;
    const depthRatio = wholeSize.z ? size.z / wholeSize.z : 0;
    if (widthRatio < 0.82 || depthRatio < 0.82) return;
    if (toMm(size.y) > 45) return;
    candidates.push({
      mesh: child,
      widthRatio,
      depthRatio,
      thickness: size.y,
      area: size.x * size.z
    });
  });
  candidates.sort((a, b) => (
    b.area - a.area
    || a.thickness - b.thickness
    || b.widthRatio - a.widthRatio
    || b.depthRatio - a.depthRatio
  ));
  return candidates.slice(0, 1).map((candidate) => candidate.mesh);
}

function isMetalShelfMesh(mesh) {
  return getMaterialNames(mesh).some((name) => /metal|iron|steel|aluminum|m07|bracket|support|connector|灰色支撑件/i.test(name));
}

const SHELF_TOP_VISUAL_COMPENSATION_MM = -22;

function alignPlannerVisualToShelfSurface({
  visualObject,
  asset,
  target,
  shelfSurface,
  finalBox
}) {
  const empty = {
    applied: false,
    assetType: asset.visualAssetType || "",
    sourcePlacementId: asset.sourcePlacementId || "",
    shelfPlacementHeight: Number.isFinite(Number(asset.heightFromFloor)) ? Number(asset.heightFromFloor) : null,
    shelfBoxMaxY: shelfSurface?.worldBox && !shelfSurface.worldBox.isEmpty() ? toMm(shelfSurface.worldBox.max.y) : null,
    selectedBoardMeshName: shelfSurface?.selectedBoardMeshName || "",
    boardSurfaceY: Number.isFinite(shelfSurface?.boardSurfaceY) ? toMm(shelfSurface.boardSurfaceY) : null,
    wholeShelfMaxY: Number.isFinite(shelfSurface?.wholeShelfMaxY) ? toMm(shelfSurface.wholeShelfMaxY) : null,
    delta: Number.isFinite(shelfSurface?.wholeShelfMaxY) && Number.isFinite(shelfSurface?.surfaceY)
      ? toMm(shelfSurface.wholeShelfMaxY - shelfSurface.surfaceY)
      : null,
    visualBoxMinY: finalBox && !finalBox.isEmpty() ? toMm(finalBox.min.y) : null,
    visualCompensationY: SHELF_TOP_VISUAL_COMPENSATION_MM,
    appliedYAdjustment: 0,
    finalObjectY: toMm(visualObject.position.y),
    finalVisualY: toMm(visualObject.position.y),
    shelfObjectName: shelfSurface?.shelfObjectName || "",
    shelfMeshCount: shelfSurface?.shelfMeshCount || 0
  };
  if (asset.targetKind !== "shelf" || !shelfSurface?.localBox || shelfSurface.localBox.isEmpty()
    || !finalBox || finalBox.isEmpty()) {
    return empty;
  }

  const shelfSurfaceY = shelfSurface.surfaceY;
  const compensatedSurfaceY = shelfSurfaceY + meters(SHELF_TOP_VISUAL_COMPENSATION_MM);
  const appliedYAdjustment = compensatedSurfaceY - finalBox.min.y;
  visualObject.position.y += appliedYAdjustment;
  visualObject.updateMatrixWorld(true);
  const adjustedBox = new THREE.Box3().setFromObject(visualObject);
  target.y = visualObject.position.y;
  target.surfaceTop = compensatedSurfaceY;
  target.fullSurfaceTop = shelfSurfaceY;
  target.visualSurfaceTop = compensatedSurfaceY;
  target.shoeShelfVisualDrop = meters(SHELF_TOP_VISUAL_COMPENSATION_MM);

  const diagnostic = {
    ...empty,
    applied: true,
    shelfBoxMaxY: toMm(shelfSurface.worldBox.max.y),
    selectedBoardMeshName: shelfSurface.selectedBoardMeshName || "",
    boardSurfaceY: Number.isFinite(shelfSurface.boardSurfaceY) ? toMm(shelfSurface.boardSurfaceY) : null,
    wholeShelfMaxY: Number.isFinite(shelfSurface.wholeShelfMaxY) ? toMm(shelfSurface.wholeShelfMaxY) : null,
    delta: Number.isFinite(shelfSurface.wholeShelfMaxY) ? toMm(shelfSurface.wholeShelfMaxY - shelfSurfaceY) : null,
    shelfSurfaceY: toMm(shelfSurfaceY),
    visualCompensationY: SHELF_TOP_VISUAL_COMPENSATION_MM,
    visualBoxMinY: toMm(finalBox.min.y),
    appliedYAdjustment: toMm(appliedYAdjustment),
    finalObjectY: toMm(visualObject.position.y),
    finalVisualY: toMm(visualObject.position.y),
    finalVisualBoxMinY: toMm(adjustedBox.min.y)
  };
  console.log("[ai-planner shelf visual surface]", {
    assetType: diagnostic.assetType,
    sourcePlacementId: diagnostic.sourcePlacementId,
    shelfPlacementHeight: diagnostic.shelfPlacementHeight,
    "shelfBox.max.y": diagnostic.shelfBoxMaxY,
    selectedBoardMeshName: diagnostic.selectedBoardMeshName,
    boardSurfaceY: diagnostic.boardSurfaceY,
    visualCompensationY: diagnostic.visualCompensationY,
    wholeShelfMaxY: diagnostic.wholeShelfMaxY,
    delta: diagnostic.delta,
    "visualBox.min.y": diagnostic.visualBoxMinY,
    appliedYAdjustment: diagnostic.appliedYAdjustment,
    finalObjectY: diagnostic.finalObjectY,
    finalVisualY: diagnostic.finalVisualY
  });
  return {
    ...diagnostic,
    finalBox: adjustedBox
  };
}

function getPlannerVisualAssetTarget({
  asset,
  bay,
  sourceLocalBox,
  sourceCenter,
  shelfSurfaceLocalBox = null,
  shelfSurfaceY = null
}) {
  const targetKind = asset.targetKind || "rail";
  if (targetKind === "shelf") {
    const surfaceCenter = shelfSurfaceLocalBox && !shelfSurfaceLocalBox.isEmpty()
      ? shelfSurfaceLocalBox.getCenter(new THREE.Vector3())
      : null;
    const surfaceTop = shelfSurfaceLocalBox && !shelfSurfaceLocalBox.isEmpty()
      ? shelfSurfaceY
      : 0;
    return {
      x: surfaceCenter ? surfaceCenter.x : bay.centerX,
      y: surfaceTop,
      z: surfaceCenter ? surfaceCenter.z : 0,
      surfaceTop,
      fullSurfaceTop: surfaceTop,
      visualSurfaceTop: surfaceTop,
      shoeShelfVisualDrop: 0
    };
  }
  const fallbackHeight = meters(Number(asset.heightFromFloor || asset.railHeightFromFloor) || 0);
  if (targetKind === "floor") {
    const isShoeAsset = asset.visualCategory === "shoe" || String(asset.visualAssetType || "").includes("shoePair");
    return {
      x: bay.centerX,
      y: isShoeAsset ? 0 : 0.005,
      z: 0,
      surfaceTop: 0
    };
  }
  if (targetKind === "top") {
    const topCenter = sourceLocalBox && !sourceLocalBox.isEmpty()
      ? sourceLocalBox.getCenter(new THREE.Vector3())
      : null;
    return {
      x: topCenter ? topCenter.x : bay.centerX,
      y: (sourceLocalBox && !sourceLocalBox.isEmpty() ? sourceLocalBox.max.y : fallbackHeight) + 0.005,
      z: topCenter ? topCenter.z : 0
    };
  }
  if (sourceLocalBox && !sourceLocalBox.isEmpty()) {
    const railCenter = sourceLocalBox.getCenter(new THREE.Vector3());
    return {
      x: railCenter.x,
      y: railCenter.y,
      z: railCenter.z
    };
  }
  return {
    x: bay.centerX,
    y: meters(Number(asset.railHeightFromFloor) || 1850),
    z: sourceCenter ? sourceCenter.z : 0
  };
}

function getShoeTargetSurfaceType(asset, sourcePlacement) {
  if (asset.targetKind === "shelf") return sourcePlacement?.userData?.componentType || "woodShelf";
  return "floor";
}

function getShoeSurfaceBox({ asset, bay, sourceLocalBox }) {
  if (asset.targetKind === "shelf" && sourceLocalBox && !sourceLocalBox.isEmpty()) {
    return sourceLocalBox.clone();
  }
  if (asset.targetKind !== "floor") return null;
  const halfWidth = Math.max(0.1, Number(bay.innerBayWidth || bay.width || 0.8) * 0.5);
  const halfDepth = 0.28;
  return new THREE.Box3(
    new THREE.Vector3(bay.centerX - halfWidth, 0, -halfDepth),
    new THREE.Vector3(bay.centerX + halfWidth, 0.02, halfDepth)
  );
}

function scaleTrouserVisualAssetToSourceWidth({
  visualObject,
  asset,
  rawSize,
  sourceLocalBox,
  sourcePlacement
}) {
  const empty = {
    applied: false,
    assetType: asset.visualAssetType || "",
    sourcePlacementId: asset.sourcePlacementId || "",
    rawBBoxWidth: toMm(rawSize?.x || 0),
    targetWidth: null,
    scaleX: visualObject.scale.x,
    finalBBoxWidth: null
  };
  if (!isTrouserPlannerVisualAsset(asset)) return empty;
  const targetWidth = getTrouserVisualTargetWidth(sourcePlacement, sourceLocalBox);
  if (!Number.isFinite(targetWidth) || targetWidth <= 0 || !rawSize?.x) return {
    ...empty,
    targetWidth: Number.isFinite(targetWidth) ? toMm(targetWidth) : null
  };
  visualObject.scale.x *= targetWidth / rawSize.x;
  visualObject.updateMatrixWorld(true);
  let finalBox = new THREE.Box3().setFromObject(visualObject);
  if (sourceLocalBox && !sourceLocalBox.isEmpty()) {
    const sourceCenter = sourceLocalBox.getCenter(new THREE.Vector3());
    const visualCenter = finalBox.getCenter(new THREE.Vector3());
    visualObject.position.x += sourceCenter.x - visualCenter.x;
    visualObject.updateMatrixWorld(true);
    finalBox = new THREE.Box3().setFromObject(visualObject);
  }
  return {
    ...empty,
    applied: true,
    targetWidth: toMm(targetWidth),
    scaleX: visualObject.scale.x,
    finalBBoxWidth: toMm(finalBox.getSize(new THREE.Vector3()).x)
  };
}

function isTrouserPlannerVisualAsset(asset = {}) {
  return asset.visualCategory === "trouser" || asset.visualAssetType === "trouser-5";
}

function getTrouserVisualTargetWidth(sourcePlacement, sourceLocalBox) {
  const explicitWidth = Number(
    sourcePlacement?.userData?.requestedVisualWidth
    ?? sourcePlacement?.userData?.visualScaleWidth
    ?? sourcePlacement?.userData?.innerBayWidth
  );
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) return meters(explicitWidth);
  const bayWidth = Number(sourcePlacement?.userData?.bayWidth);
  if (Number.isFinite(bayWidth) && bayWidth > 0) return bayWidth;
  const actualWidth = Number(sourcePlacement?.userData?.actualWidth);
  if (Number.isFinite(actualWidth) && actualWidth > 0) return actualWidth;
  if (sourceLocalBox && !sourceLocalBox.isEmpty()) {
    return sourceLocalBox.getSize(new THREE.Vector3()).x;
  }
  return null;
}

function centerHangingVisualOnRail({ visualObject, asset, finalBox, sourceLocalBox }) {
  const empty = {
    applied: false,
    railCenterX: null,
    railCenterZ: null,
    visualBBoxCenterXBefore: null,
    visualBBoxCenterXAfter: null,
    visualRailCenterDeltaX: null,
    visualBBoxCenterZBefore: null,
    visualBBoxCenterZAfter: null,
    visualRailCenterDeltaZ: null
  };
  if (!["shortHang", "longHang"].includes(asset.visualCategory)
    || !sourceLocalBox
    || sourceLocalBox.isEmpty()) {
    return empty;
  }
  const railCenter = sourceLocalBox.getCenter(new THREE.Vector3());
  const visualCenterBefore = finalBox.getCenter(new THREE.Vector3());
  const deltaX = railCenter.x - visualCenterBefore.x;
  const deltaZ = railCenter.z - visualCenterBefore.z;
  if (Math.abs(deltaX) > HANGING_VISUAL_RAIL_CENTER_TOLERANCE) {
    visualObject.position.x += deltaX;
  }
  if (Math.abs(deltaZ) > HANGING_VISUAL_RAIL_CENTER_TOLERANCE) {
    visualObject.position.z += deltaZ;
  }
  visualObject.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(visualObject);
  const visualCenterAfter = centeredBox.getCenter(new THREE.Vector3());
  return {
    applied: Math.abs(deltaX) > HANGING_VISUAL_RAIL_CENTER_TOLERANCE
      || Math.abs(deltaZ) > HANGING_VISUAL_RAIL_CENTER_TOLERANCE,
    railCenterX: toMm(railCenter.x),
    railCenterZ: toMm(railCenter.z),
    visualBBoxCenterXBefore: toMm(visualCenterBefore.x),
    visualBBoxCenterXAfter: toMm(visualCenterAfter.x),
    visualRailCenterDeltaX: toMm(visualCenterAfter.x - railCenter.x),
    visualBBoxCenterZBefore: toMm(visualCenterBefore.z),
    visualBBoxCenterZAfter: toMm(visualCenterAfter.z),
    visualRailCenterDeltaZ: toMm(visualCenterAfter.z - railCenter.z)
  };
}

function validateBoxInsideSurface(box, surfaceBox) {
  const tolerance = 0.002;
  const boxCenter = box.getCenter(new THREE.Vector3());
  const surfaceCenter = surfaceBox.getCenter(new THREE.Vector3());
  const insideSurfaceX = box.min.x >= surfaceBox.min.x - tolerance
    && box.max.x <= surfaceBox.max.x + tolerance;
  const insideSurfaceZ = box.min.z >= surfaceBox.min.z - tolerance
    && box.max.z <= surfaceBox.max.z + tolerance;
  return {
    insideSurfaceX,
    insideSurfaceZ,
    intersectsPost: false,
    centerOffsetFromSurfaceCenterX: toMm(boxCenter.x - surfaceCenter.x),
    centerOffsetFromSurfaceCenterZ: toMm(boxCenter.z - surfaceCenter.z)
  };
}

function validateShortHangAgainstRail(box, railBox) {
  const tolerance = 0.002;
  const boxCenter = box.getCenter(new THREE.Vector3());
  const railCenter = railBox.getCenter(new THREE.Vector3());
  const railSpanX = Math.max(0, railBox.max.x - railBox.min.x);
  const finalBboxSizeX = Math.max(0, box.max.x - box.min.x);
  return {
    railSpanX: toMm(railSpanX),
    finalBboxSizeX: toMm(finalBboxSizeX),
    insideRailSpanX: box.min.x >= railBox.min.x - tolerance && box.max.x <= railBox.max.x + tolerance,
    finalBboxMaxYMinusRailY: toMm(box.max.y - railBox.max.y),
    centerZDelta: toMm(boxCenter.z - railCenter.z)
  };
}

function getTopClearanceSkipReason(asset) {
  if (asset.visualCategory === "luggage") return "noTopClearanceForLuggage";
  if (asset.visualCategory === "bedding") return "noTopClearanceForBedding";
  return "noTopClearanceForVisualAsset";
}

function getVisualPostX(postPosition, postCount, shouldInsetEnds, inset) {
  if (!shouldInsetEnds) return postPosition.x;
  if (postPosition.index === 0) return postPosition.x + inset;
  if (postPosition.index === postCount - 1) return postPosition.x - inset;
  return postPosition.x;
}

function getWallAxis(wallId) {
  if (wallId === "back") return "X";
  if (wallId === "left" || wallId === "right") return "Z";
  return "X";
}

function localToWorld(group, x, y, z) {
  group.updateMatrixWorld(true);
  return group.localToWorld(new THREE.Vector3(x, y, z));
}

function toMm(value) {
  return Math.round(value * 1000);
}

function createBayCenterMarker(x, y, z) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 20),
    new THREE.MeshBasicMaterial({ color: theme.colors.danger })
  );
  marker.name = "Debug Bay Center";
  marker.position.set(x, y, z);
  return marker;
}

function createBayDropTarget(width, height, depth) {
  const target = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({
      color: theme.colors.primary,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    })
  );
  target.name = "Bay Drop Target";
  target.renderOrder = -10;
  return target;
}

function createTextSprite(text, color, x, y, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fillRect(42, 28, 172, 72);
  context.strokeStyle = color;
  context.lineWidth = 8;
  context.strokeRect(42, 28, 172, 72);
  context.fillStyle = color;
  context.font = "bold 52px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, 66);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = `Debug ${text}`;
  sprite.position.set(x, y, z);
  sprite.scale.set(0.34, 0.17, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function getBayGeometry(postPositions, bayIndex, factoryInnerBayWidth, postProfileWidthMm) {
  const index = Number(bayIndex);
  const leftPost = postPositions[index];
  const rightPost = postPositions[index + 1];
  if (!leftPost || !rightPost) return null;
  const rawBayWidth = Math.abs(rightPost.x - leftPost.x);
  const postProfileWidth = meters(postProfileWidthMm);
  const innerBayWidth = Math.max(0.05, factoryInnerBayWidth);
  return {
    leftX: leftPost.x,
    rightX: rightPost.x,
    centerX: (leftPost.x + rightPost.x) / 2,
    width: rawBayWidth,
    rawBayWidth,
    postCenterDistance: rawBayWidth,
    postProfileWidth,
    innerBayWidth,
    usableComponentWidth: innerBayWidth
  };
}

function getAluminumPostInnerEdges(postLocalBoundsByIndex, bayIndex) {
  const index = Number(bayIndex);
  const firstPost = postLocalBoundsByIndex.get(index);
  const secondPost = postLocalBoundsByIndex.get(index + 1);
  if (!firstPost || !secondPost) return null;

  const leftPost = firstPost.centerX <= secondPost.centerX ? firstPost : secondPost;
  const rightPost = leftPost === firstPost ? secondPost : firstPost;
  const leftPostIndex = leftPost === firstPost ? index : index + 1;
  const rightPostIndex = leftPost === firstPost ? index + 1 : index;
  const leftPostInnerEdge = leftPost.maxX;
  const rightPostInnerEdge = rightPost.minX;
  if (rightPostInnerEdge <= leftPostInnerEdge) return null;

  return {
    leftPostIndex,
    rightPostIndex,
    leftPostCenterX: leftPost.centerX,
    rightPostCenterX: rightPost.centerX,
    leftPostMinX: leftPost.minX,
    leftPostMaxX: leftPost.maxX,
    rightPostMinX: rightPost.minX,
    rightPostMaxX: rightPost.maxX,
    leftPostInnerEdge,
    rightPostInnerEdge
  };
}

function getWallWideShelfEdges(postLocalBoundsByIndex, bayIndex, bayCount) {
  const index = Number(bayIndex);
  const firstPost = postLocalBoundsByIndex.get(index);
  const secondPost = postLocalBoundsByIndex.get(index + 1);
  if (!firstPost || !secondPost) return null;

  const boundaryForPost = (post, postIndex, neighbor) => {
    if (postIndex > 0 && postIndex < Number(bayCount)) return post.centerX;
    return neighbor.centerX >= post.centerX ? post.maxX : post.minX;
  };
  const firstBoundary = boundaryForPost(firstPost, index, secondPost);
  const secondBoundary = boundaryForPost(secondPost, index + 1, firstPost);
  const leftPost = firstBoundary <= secondBoundary ? firstPost : secondPost;
  const rightPost = leftPost === firstPost ? secondPost : firstPost;

  return {
    leftPostIndex: leftPost === firstPost ? index : index + 1,
    rightPostIndex: leftPost === firstPost ? index + 1 : index,
    leftPostCenterX: leftPost.centerX,
    rightPostCenterX: rightPost.centerX,
    leftPostMinX: leftPost.minX,
    leftPostMaxX: leftPost.maxX,
    rightPostMinX: rightPost.minX,
    rightPostMaxX: rightPost.maxX,
    leftPostInnerEdge: Math.min(firstBoundary, secondBoundary),
    rightPostInnerEdge: Math.max(firstBoundary, secondBoundary)
  };
}

function serializeAluminumPostInnerEdges(edges) {
  if (!edges) return null;
  return {
    leftPostIndex: edges.leftPostIndex,
    rightPostIndex: edges.rightPostIndex,
    leftPostCenterX: toMm(edges.leftPostCenterX),
    rightPostCenterX: toMm(edges.rightPostCenterX),
    leftPostMinX: toMm(edges.leftPostMinX),
    leftPostMaxX: toMm(edges.leftPostMaxX),
    rightPostMinX: toMm(edges.rightPostMinX),
    rightPostMaxX: toMm(edges.rightPostMaxX),
    leftPostInnerEdge: toMm(edges.leftPostInnerEdge),
    rightPostInnerEdge: toMm(edges.rightPostInnerEdge)
  };
}

async function addPlacement(
  group,
  placement,
  x,
  bayWidth,
  depth,
  config,
  design,
  series,
  report,
  debug,
  selectedId,
  wall,
  modelTransforms,
  cuttingRules,
  aluminumComponentPostEdges = null,
  carbonComponentPostEdges = null,
  aluminumBaseWoodShelfSupportRegistry = null
) {
  const y = meters(placement.heightFromFloor);
  const product = resolvePlacementSceneProduct(placement, design);
  const name = product?.nameCn || placement.componentType;
  const transform = getComponentTransform(placement.componentType, modelTransforms, report);
  const requestedVisualWidth = getCarbonRequestedVisualWidth({
    seriesId: series?.seriesId,
    componentType: placement.componentType,
    wallId: wall?.id,
    bayWidth
  });
  const carbonVisualCompensation = getCarbonVisualCompensation({
    seriesId: series?.seriesId,
    componentType: placement.componentType,
    wallId: wall?.id
  });
  const carbonPostInnerWidth = carbonComponentPostEdges
    ? carbonComponentPostEdges.rightPostInnerEdge - carbonComponentPostEdges.leftPostInnerEdge
    : null;
  const usesCarbonPostInnerWidthCompensation =
    series?.seriesId === "carbon-steel-post-wardrobe-v2"
    && ["back", "left", "right"].includes(wall?.id)
    && usesCarbonVisualWidthCompensation(placement.componentType)
    && Number.isFinite(carbonPostInnerWidth);
  const visualWidth = usesCarbonPostInnerWidthCompensation
    ? carbonPostInnerWidth + carbonVisualCompensation
    : series?.seriesId === "carbon-steel-post-wardrobe-v2"
      && usesCarbonVisualWidthCompensation(placement.componentType)
      && Number.isFinite(carbonPostInnerWidth)
      ? Math.min(requestedVisualWidth, carbonPostInnerWidth)
      : requestedVisualWidth;
  const targetSize = modelTransforms.targetSize(placement.componentType, visualWidth, depth, product);
  let model = await createModelOrMissing(
    product,
    series,
    report,
    targetSize,
    name,
    transform,
    placement.componentType,
    modelTransforms
  );
  applyPlacementColor(model, placement.componentType, config.frameColor, modelTransforms, series?.seriesId);
  if (isWireBasketDrawerSku(placement.productSku)) {
    applyWireBasketWhiteMaterial(model);
  }
  const wallMountedSupportColorAdjustment = series?.seriesId === "wall-mounted-v2"
    && ["woodShelf", "shoeShelf"].includes(placement.componentType)
    ? applyWallMountedShelfSupportColor(model, config.frameColor)
    : null;
  if (series?.seriesId === "aluminum-post-wardrobe") {
    applyAluminumMetalMaterialColor(model, config.frameColor);
  }
  const targetZ = transform.depthOffset;
  const targetY = y + transform.heightOffset;
  if (model.name === "Missing Model") {
    model.position.set(x, targetY, targetZ);
  } else {
    alignModelBoundingBox(model, x, targetY, targetZ, transform.anchor, transform.alignMode);
    applyDepthAnchor(model, transform);
    const placementOffsetX = placement.componentType === "trouserRack" || placement.componentType === "pantsRack" ? 0 : transform.offsetX || 0;
    model.position.x += placementOffsetX;
    model.position.z += transform.offsetZ || 0;
  }
  if (placement.componentType === "singleRail" || placement.componentType === "doubleRail") {
    const railLateralVisualOffset = modelTransforms.rail.lateralVisualOffset;
    if (wall?.id === "back") {
      model.position.z += modelTransforms.rail.backDepthOffset;
      model.position.x += railLateralVisualOffset;
    }
    if (wall?.id === "left") {
      model.position.z += modelTransforms.rail.leftDepthOffset;
      model.position.x += railLateralVisualOffset;
    }
    if (wall?.id === "right") {
      model.position.z += modelTransforms.rail.rightDepthOffset;
      model.position.x -= railLateralVisualOffset;
    }
  }
  if (modelTransforms.fixedModule.componentTypes.includes(placement.componentType)) {
    const fixedModuleLateralVisualOffset = modelTransforms.fixedModule.lateralVisualOffset;
    if (wall?.id === "back" || wall?.id === "left") {
      model.position.x += fixedModuleLateralVisualOffset;
    }
    if (wall?.id === "right") {
      model.position.x -= fixedModuleLateralVisualOffset;
    }
  }
  if (placement.componentType === "drawerDouble") {
    applyDrawerDoubleTopPanelWoodMaterial(model);
  }
  model = await createDrawerDoubleCompositeModel({
    baseModel: model,
    placement,
    series,
    report,
    targetSize,
    transform,
    modelTransforms
  });
  group.add(model);
  group.updateMatrixWorld(true);
  const hasWallMountedDistance = series?.seriesId === "wall-mounted-v2"
    && Number.isFinite(Number(placement.distanceFromWall));
  const wallMountedOffsetPosition = hasWallMountedDistance
    ? getWallMountedRailOffsetPosition({
      id: wall?.id,
      axis: wall?.id === "back" ? "X" : "Z"
    }, Number(placement.distanceFromWall))
    : null;
  const wallMountedWorldAnchor = wallMountedOffsetPosition
    ? group.localToWorld(new THREE.Vector3(x, y, 0))
    : null;
  model.updateMatrixWorld(true);
  let wallMountedComponentDepthAdjustment = null;
  if (
    series?.seriesId === "wall-mounted-v2"
    && placement.componentType !== "backPanel"
    && model.name !== "Missing Model"
  ) {
    const bayPostIndexes = new Set([
      Number(placement.bayIndex),
      Number(placement.bayIndex) + 1
    ]);
    const bayPosts = report.postCoordinates.filter((postCoordinate) => (
      postCoordinate.wallId === wall?.id
      && bayPostIndexes.has(Number(postCoordinate.postIndex))
    ));
    if (bayPosts.length === 2) {
      const beforeWorldBox = new THREE.Box3().setFromObject(model);
      let postFrontFace = null;
      let componentBackFaceBefore = null;
      let deltaWorldX = 0;
      let deltaWorldZ = 0;
      if (wall.id === "back") {
        postFrontFace = Math.max(...bayPosts.map((post) => meters(post.finalBBoxMaxZ)));
        componentBackFaceBefore = beforeWorldBox.min.z;
        deltaWorldZ = postFrontFace - componentBackFaceBefore;
      } else if (wall.id === "left") {
        postFrontFace = Math.max(...bayPosts.map((post) => meters(post.finalBBoxMaxX)));
        componentBackFaceBefore = beforeWorldBox.min.x;
        deltaWorldX = postFrontFace - componentBackFaceBefore;
      } else if (wall.id === "right") {
        postFrontFace = Math.min(...bayPosts.map((post) => meters(post.finalBBoxMinX)));
        componentBackFaceBefore = beforeWorldBox.max.x;
        deltaWorldX = postFrontFace - componentBackFaceBefore;
      }
      if (
        Number.isFinite(postFrontFace)
        && (Math.abs(deltaWorldX) > 1e-12 || Math.abs(deltaWorldZ) > 1e-12)
      ) {
        translateObjectByWorldDelta(model, group, deltaWorldX, 0, deltaWorldZ);
        group.updateMatrixWorld(true);
        model.updateMatrixWorld(true);
      }
      const afterWorldBox = new THREE.Box3().setFromObject(model);
      const componentBackFaceAfter = wall.id === "back"
        ? afterWorldBox.min.z
        : wall.id === "left"
          ? afterWorldBox.min.x
          : afterWorldBox.max.x;
      wallMountedComponentDepthAdjustment = {
        wallId: wall.id,
        postIndexes: Array.from(bayPostIndexes),
        postFrontFace: toMm(postFrontFace),
        componentBackFaceBefore: toMm(componentBackFaceBefore),
        componentBackFaceAfter: toMm(componentBackFaceAfter),
        gapBefore: toMm(wall.id === "right"
          ? postFrontFace - componentBackFaceBefore
          : componentBackFaceBefore - postFrontFace),
        gapAfter: toMm(wall.id === "right"
          ? postFrontFace - componentBackFaceAfter
          : componentBackFaceAfter - postFrontFace),
        deltaWorldX: toMm(deltaWorldX),
        deltaWorldZ: toMm(deltaWorldZ)
      };
    }
  }
  let wallMountedSideBackPanelAdjustment = null;
  if (
    series?.seriesId === "wall-mounted-v2"
    && placement.componentType === "backPanel"
    && (wall?.id === "left" || wall?.id === "right")
  ) {
    const beforeWorldBox = new THREE.Box3().setFromObject(model);
    const roomWidth = meters(Number(design.room?.width) || 0);
    const postDepth = Number(modelTransforms.post?.targetDepth) || 0.025;
    const overlap = meters(Number(modelTransforms.backPanel?.sideWallPostOverlapMm) || 0);
    const targetWallSideX = wall.id === "left"
      ? -roomWidth / 2 + postDepth - overlap
      : roomWidth / 2 - postDepth + overlap;
    const deltaWorldX = wall.id === "left"
      ? targetWallSideX - beforeWorldBox.min.x
      : targetWallSideX - beforeWorldBox.max.x;
    if (Math.abs(deltaWorldX) > 1e-12) {
      translateObjectByWorldDelta(model, group, deltaWorldX);
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
    }
    const afterWorldBox = new THREE.Box3().setFromObject(model);
    wallMountedSideBackPanelAdjustment = {
      wallId: wall.id,
      overlap: toMm(overlap),
      targetWallSideX: toMm(targetWallSideX),
      deltaWorldX: toMm(deltaWorldX),
      beforeWorldBBox: serializeBox(beforeWorldBox),
      afterWorldBBox: serializeBox(afterWorldBox)
    };
  }
  let wallMountedBackPanelDepthAdjustment = null;
  if (
    series?.seriesId === "wall-mounted-v2"
    && placement.componentType === "backPanel"
    && wall?.id === "back"
  ) {
    const beforeWorldBox = new THREE.Box3().setFromObject(model);
    const backPostFrontZ = Math.max(
      ...report.postCoordinates
        .filter((postCoordinate) => postCoordinate.wallId === "back")
        .map((postCoordinate) => meters(postCoordinate.finalBBoxMaxZ))
    );
    const deltaWorldZ = backPostFrontZ - beforeWorldBox.min.z;
    if (Number.isFinite(deltaWorldZ) && Math.abs(deltaWorldZ) > 1e-12) {
      translateObjectByWorldDelta(model, group, 0, 0, deltaWorldZ);
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
    }
    const afterWorldBox = new THREE.Box3().setFromObject(model);
    wallMountedBackPanelDepthAdjustment = {
      backPostFrontZ: toMm(backPostFrontZ),
      panelBackFaceBeforeZ: toMm(beforeWorldBox.min.z),
      panelBackFaceAfterZ: toMm(afterWorldBox.min.z),
      deltaWorldZ: toMm(deltaWorldZ),
      gap: toMm(afterWorldBox.min.z - backPostFrontZ)
    };
  }
  const aluminumBaseWoodShelfBoardAdjustment = series?.seriesId === "aluminum-base-supported"
    && product?.sku === "TD-WOOD-SHELF"
    ? expandAluminumBaseWoodShelfBoard(
      model,
      group,
      Number(modelTransforms.woodShelfBoardExtensionMm) || 0
    )
    : null;
  const aluminumPostInnerEdgeAdjustment = series?.seriesId === "aluminum-post-wardrobe"
    && usesAluminumPostInnerEdgeAlignment(placement.componentType)
    ? fitAluminumComponentToPostEdges(model, group, aluminumComponentPostEdges)
    : null;
  if (
    series?.seriesId === "carbon-steel-post-wardrobe-v2"
    && usesCarbonVisualWidthCompensation(placement.componentType)
    && ["back", "left", "right"].includes(wall?.id)
  ) {
    alignCarbonComponentToWall(
      model,
      group,
      wall,
      meters(Number(design.room?.width) || 0),
      meters(Number(design.room?.depth) || 0),
      placement.componentType
    );
  }
  const aluminumBaseWallAdjustment = series?.seriesId === "aluminum-base-supported"
    && usesAluminumBaseComponentWallAlignment(placement.componentType)
    ? alignAluminumBaseComponentToWall(
      model,
      group,
      wall,
      meters(Number(design.room?.width) || 0),
      meters(Number(design.room?.depth) || 0),
      placement.componentType === "backPanel"
        ? 20
        : Number(modelTransforms.componentWallClearanceMm) || 0
    )
    : null;
  const wallMountedDistanceAdjustment = series?.seriesId === "wall-mounted-v2"
    && Number.isFinite(Number(placement.distanceFromWall))
    ? alignWallMountedPlacementDistanceFromWall(
      model,
      group,
      wall,
      design.room,
      Number(placement.distanceFromWall)
    )
    : null;
  const wallMountedLinkedShelfVerticalAdjustment = series?.seriesId === "wall-mounted-v2"
    && (placement.linkedWallMountedShelf || placement.isLinkedRailShelf)
    ? alignWallMountedLinkedShelfToRail(model, group, placement)
    : null;
  const aluminumBaseWoodShelfSupportAdjustment =
    series?.seriesId === "aluminum-base-supported"
    && placement.componentType === "woodShelf"
    && aluminumBaseWoodShelfSupportRegistry
      ? dedupeAluminumBaseWoodShelfSupports(
        model,
        group,
        placement,
        aluminumBaseWoodShelfSupportRegistry
      )
      : null;
  const wallMountedLedDiagnostic = series?.seriesId === "wall-mounted-v2"
    && ["woodShelf", "shoeShelf", "glassShelf"].includes(placement.componentType)
    ? addWallMountedShelfLedStrips(
      model,
      group,
      config.led === true,
      placement.componentType,
      wall?.id,
      placement.id
    )
    : null;
  if (wallMountedLedDiagnostic) {
    report.wallMountedLedStripCount += wallMountedLedDiagnostic.stripCount;
    report.wallMountedLedDiagnostics.push(wallMountedLedDiagnostic);
  }
  const aluminumBaseShelfLedDiagnostic = series?.seriesId === "aluminum-base-supported"
    && (
      product?.sku === "TD-WOOD-SHELF"
      || product?.sku === "TD-006-2"
    )
    ? addAluminumBaseShelfLedStrip(
      model,
      group,
      config.led === true,
      product.sku === "TD-WOOD-SHELF" ? "woodShelf" : "glassShelf",
      wall?.id,
      placement.id
    )
    : null;
  if (aluminumBaseShelfLedDiagnostic) {
    report.aluminumBaseLedStripCounts[aluminumBaseShelfLedDiagnostic.componentKind] +=
      aluminumBaseShelfLedDiagnostic.stripCount;
    report.aluminumBaseLedDiagnostics.push(aluminumBaseShelfLedDiagnostic);
  }
  const actualWidth = getObjectWidth(model);
  model.userData = {
    ...model.userData,
    isPlacementModel: true,
    placementId: placement.id,
    componentType: placement.componentType,
    wallId: placement.wallId,
    bayIndex: placement.bayIndex,
    bayCenterX: x,
    bayWidth,
    actualWidth,
    requestedVisualWidth: toMm(requestedVisualWidth),
    visualScaleWidth: placement.visualScaleWidth,
    innerBayWidth: placement.innerBayWidth,
    componentCutLength: placement.componentCutLength,
    widthSource: placement.widthSource || "",
    resizeMode: transform.resizeMode,
    scaleAxis: transform.scaleAxis,
    alignMode: transform.alignMode,
    offsetX: transform.offsetX || 0,
    offsetZ: transform.offsetZ || 0,
    anchor: transform.anchor,
    distanceFromWall: placement.distanceFromWall,
    linkedShelfId: placement.linkedShelfId || null,
    linkedRailId: placement.linkedRailId || null,
    linkedRailDependencyId: placement.linkedRailDependencyId || null,
    shelfDependency: placement.shelfDependency || null,
    wallMountedOffsetPosition,
    wallMountedWorldAnchor: wallMountedWorldAnchor ? {
      x: toMm(wallMountedWorldAnchor.x),
      y: toMm(wallMountedWorldAnchor.y),
      z: toMm(wallMountedWorldAnchor.z)
    } : null
  };
  if (
    series?.seriesId === "wall-mounted-v2"
    && placement.componentType === "backPanel"
    && config.layout === "U"
    && config.uLayoutMode !== "side-first"
    && (wall?.id === "left" || wall?.id === "right")
  ) {
    model.userData.isBackCornerBackPanel =
      Number(placement.bayIndex) === getSideBackCornerBayIndex(wall);
  }
  const finalBoundingBox = new THREE.Box3().setFromObject(model);
  const wallMountedActualDistanceFromWall = series?.seriesId === "wall-mounted-v2"
    ? getWallMountedActualDistanceFromWall(finalBoundingBox, wall, design.room)
    : null;
  report.componentDimensions.push({
    placementId: placement.id,
    componentType: placement.componentType,
    productSku: product?.sku || placement.productSku || "",
    isBackCornerBackPanel: model.userData.isBackCornerBackPanel === true,
    modelPath: product?.glbAssetPath || product?.modelPath || "",
    heightFromFloor: placement.heightFromFloor,
    postCenterDistance: placement.postCenterDistance,
    postProfileWidth: placement.postProfileWidth,
    innerBayWidth: placement.innerBayWidth,
    componentCutLength: placement.componentCutLength,
    visualScaleWidth: placement.visualScaleWidth,
    requestedVisualWidth: toMm(requestedVisualWidth),
    actualPostInnerWidth: Number.isFinite(carbonPostInnerWidth)
      ? toMm(carbonPostInnerWidth)
      : null,
    clampedVisualWidth: toMm(visualWidth),
    usesSideWallPostInnerWidth: usesCarbonPostInnerWidthCompensation,
    aluminumPostInnerEdgeAdjustment,
    aluminumBaseWoodShelfBoardAdjustment,
    aluminumBaseWoodShelfSupportAdjustment,
    aluminumBaseWallAdjustment,
    wallMountedSupportColorAdjustment,
    wallMountedLedDiagnostic,
    wallMountedComponentDepthAdjustment,
    wallMountedSideBackPanelAdjustment,
    wallMountedBackPanelDepthAdjustment,
    wallMountedDistanceAdjustment,
    wallMountedLinkedShelfVerticalAdjustment,
    wallMountedActualDistanceFromWall,
    distanceFromWall: placement.distanceFromWall,
    wallMountedOffsetPosition,
    wallMountedWorldAnchor: model.userData.wallMountedWorldAnchor,
    shelfDependency: placement.shelfDependency || null,
    linkedShelfId: placement.linkedShelfId || null,
    linkedRailId: placement.linkedRailId || null,
    linkedRailDependencyId: placement.linkedRailDependencyId || null,
    originalBoundingBoxWidth: model.userData.originalBoundingBoxWidth,
    finalBoundingBoxWidth: toMm(actualWidth),
    actualDisplayWidth: toMm(actualWidth),
    finalRotation: {
      x: model.rotation.x,
      y: model.rotation.y,
      z: model.rotation.z
    },
    finalScale: {
      x: model.scale.x,
      y: model.scale.y,
      z: model.scale.z
    },
    finalPosition: {
      x: toMm(model.position.x),
      y: toMm(model.position.y),
      z: toMm(model.position.z)
    },
    finalBoundingBox: serializeBox(finalBoundingBox),
    finalBoundingBoxCenter: serializeBox(finalBoundingBox)?.center,
    offsetX: transform.offsetX || 0,
    offsetZ: transform.offsetZ || 0,
    bayCenter: toMm(x)
  });
  if (debug && placement.id === selectedId) {
    addSelectionOutline(model);
  }
  if (placement.componentType === "woodTop" && modelTransforms.woodTop.enabled) {
    group.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    const bayCenterWorld = localToWorld(group, x, 0, 0);
    let worldBox = new THREE.Box3().setFromObject(model);
    let edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    const isSideCornerWoodTop = placement.autoGenerated
      && (wall?.id === "left" || wall?.id === "right")
      && Number(placement.bayIndex) === getSideBackCornerBayIndex(wall);
    const isSideOpenWoodTop = placement.autoGenerated
      && (wall?.id === "left" || wall?.id === "right")
      && Number(placement.bayIndex) === getSideOpenEndBayIndex(wall);
    const skipSideCornerWoodTopAdjustment = cuttingRules.preservesExistingUWallGeometry === true
      && config.layout === "U"
      && config.uLayoutMode === "side-first"
      && isSideCornerWoodTop;
    if (!isSideCornerWoodTop && placement.autoGenerated && (edgeDiagnostic.suggestedLocalDirection === "-localX" || edgeDiagnostic.suggestedLocalDirection === "+localX")) {
      model.position.x += edgeDiagnostic.suggestedLocalDirection === "-localX"
        ? -modelTransforms.woodTop.edgeAdjustment
        : modelTransforms.woodTop.edgeAdjustment;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    }
    if (isSideCornerWoodTop && !skipSideCornerWoodTopAdjustment) {
      const roomDepth = meters(Number(design.room?.depth) || 0);
      const wallOffset = meters(Number(config.wallOffset) || 250);
      const targetWorldZ = -roomDepth / 2 + wallOffset + depth / 2 + modelTransforms.woodTop.cornerBackClearance;
      const targetOuterEdgeWorldZ = worldBox.max.z + modelTransforms.woodTop.cornerOpenExtension;
      const currentSpan = worldBox.max.z - worldBox.min.z;
      const targetSpan = targetOuterEdgeWorldZ - targetWorldZ;
      model.scale.x *= targetSpan / currentSpan;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      const outerEdgeDeltaWorldZ = targetOuterEdgeWorldZ - worldBox.max.z;
      model.position.x += wall.id === "left" ? -outerEdgeDeltaWorldZ : outerEdgeDeltaWorldZ;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    }
    if (isSideOpenWoodTop) {
      const fixedInnerEdgeWorldZ = worldBox.min.z;
      const targetOpenEdgeWorldZ = worldBox.max.z + modelTransforms.woodTop.sideOpenExtension;
      const currentSpan = worldBox.max.z - worldBox.min.z;
      const targetSpan = targetOpenEdgeWorldZ - fixedInnerEdgeWorldZ;
      model.scale.x *= targetSpan / currentSpan;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      const innerEdgeDeltaWorldZ = fixedInnerEdgeWorldZ - worldBox.min.z;
      model.position.x += wall.id === "left" ? -innerEdgeDeltaWorldZ : innerEdgeDeltaWorldZ;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      const visibleInnerMesh = model.getObjectByName(modelTransforms.woodTop.visibleMeshName);
      if (visibleInnerMesh?.isMesh && visibleInnerMesh.parent) {
        const visibleBox = new THREE.Box3().setFromObject(visibleInnerMesh);
        const fixedVisibleInnerEdgeWorldZ = visibleBox.min.z;
        const visibleSpan = visibleBox.max.z - visibleBox.min.z;
        visibleInnerMesh.scale.x *= (visibleSpan + modelTransforms.woodTop.visibleExtension) / visibleSpan;
        group.updateMatrixWorld(true);
        model.updateMatrixWorld(true);
        const scaledVisibleBox = new THREE.Box3().setFromObject(visibleInnerMesh);
        const visibleInnerEdgeDeltaWorldZ = fixedVisibleInnerEdgeWorldZ - scaledVisibleBox.min.z;
        const meshWorldOrigin = visibleInnerMesh.getWorldPosition(new THREE.Vector3());
        const localOrigin = visibleInnerMesh.parent.worldToLocal(meshWorldOrigin.clone());
        const localShifted = visibleInnerMesh.parent.worldToLocal(
          meshWorldOrigin.clone().add(new THREE.Vector3(0, 0, visibleInnerEdgeDeltaWorldZ))
        );
        visibleInnerMesh.position.add(localShifted.sub(localOrigin));
        group.updateMatrixWorld(true);
        model.updateMatrixWorld(true);
        worldBox = new THREE.Box3().setFromObject(model);
      }
      edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    }
    const worldCenter = worldBox.getCenter(new THREE.Vector3());
    report.woodTopDiagnostics.push({
      placementId: placement.id,
      wallId: placement.wallId,
      bayIndex: placement.bayIndex,
      autoGenerated: Boolean(placement.autoGenerated),
      wallBayCount: wall?.bayCount ?? null,
      isFirstBay: Number(placement.bayIndex) === 0,
      isLastBay: wall ? Number(placement.bayIndex) === wall.bayCount - 1 : false,
      wallStartOffset: wall?.startOffset ?? 0,
      wallLength: wall?.length ?? null,
      wallSourceLength: wall?.sourceLength ?? wall?.length ?? null,
      ...edgeDiagnostic,
      wallGroupRotationY: group.rotation.y,
      bayCenterLocalX: toMm(x),
      bayCenterWorld: {
        x: toMm(bayCenterWorld.x),
        z: toMm(bayCenterWorld.z)
      },
      finalBBoxWorld: {
        minX: toMm(worldBox.min.x),
        maxX: toMm(worldBox.max.x),
        minZ: toMm(worldBox.min.z),
        maxZ: toMm(worldBox.max.z)
      },
      finalBBoxWorldCenter: {
        x: toMm(worldCenter.x),
        z: toMm(worldCenter.z)
      },
      deltaX: toMm(worldCenter.x - bayCenterWorld.x),
      deltaZ: toMm(worldCenter.z - bayCenterWorld.z),
      transform: {
        rotation: transform.rotation,
        depthOffset: transform.depthOffset,
        heightOffset: transform.heightOffset,
        offsetX: transform.offsetX || 0,
        offsetZ: transform.offsetZ || 0,
        depthAnchor: transform.depthAnchor || ""
      }
    });
  }
  if (debug) {
    group.add(createBayCenterMarker(x, y, model.position.z));
  }
}

function getWoodTopEdgeDiagnostic(placement, wall, worldBox, room) {
  const bayIndex = Number(placement.bayIndex);
  const wallBayCount = Number(wall?.bayCount || 0);
  const isFirstBay = bayIndex === 0;
  const isLastBay = wallBayCount > 0 && bayIndex === wallBayCount - 1;
  const roomWidth = Number(room?.width || 0);
  const roomDepth = Number(room?.depth || 0);
  const startOffset = Number(wall?.startOffset || 0);
  const wallLength = Number(wall?.length || 0);
  let expectedEdgeRole = "middle";
  let expectedBoundaryWorld = null;
  let actualEdgeWorld = null;
  let edgeAxis = "";
  let suggestedLocalDirection = "none";

  if (wall?.id === "back" && (isFirstBay || isLastBay)) {
    expectedEdgeRole = "back-edge-no-adjustment";
    expectedBoundaryWorld = null;
    actualEdgeWorld = null;
    edgeAxis = null;
    suggestedLocalDirection = "none";
  } else if (
    (wall?.id === "left" || wall?.id === "right")
    && bayIndex === getSideBackCornerBayIndex(wall)
  ) {
    expectedEdgeRole = "side-corner-dynamic";
    expectedBoundaryWorld = null;
    actualEdgeWorld = null;
    edgeAxis = null;
    suggestedLocalDirection = "none";
  } else if (
    (wall?.id === "left" || wall?.id === "right")
    && bayIndex === getSideOpenEndBayIndex(wall)
  ) {
    expectedEdgeRole = "side-open-edge-no-adjustment";
    expectedBoundaryWorld = null;
    actualEdgeWorld = null;
    edgeAxis = null;
    suggestedLocalDirection = "none";
  } else if (wall?.id === "left" && (isFirstBay || isLastBay)) {
    expectedEdgeRole = "left-first-or-last-edge";
    edgeAxis = "worldZ";
    if (isFirstBay) {
      expectedBoundaryWorld = roomDepth / 2;
      actualEdgeWorld = toMm(worldBox.max.z);
      suggestedLocalDirection = actualEdgeWorld === expectedBoundaryWorld ? "none" : actualEdgeWorld < expectedBoundaryWorld ? "-localX" : "+localX";
    } else {
      expectedBoundaryWorld = -roomDepth / 2 + startOffset;
      actualEdgeWorld = toMm(worldBox.min.z);
      suggestedLocalDirection = actualEdgeWorld === expectedBoundaryWorld ? "none" : actualEdgeWorld > expectedBoundaryWorld ? "+localX" : "-localX";
    }
  } else if (wall?.id === "right" && (isFirstBay || isLastBay)) {
    expectedEdgeRole = "right-first-or-last-edge";
    edgeAxis = "worldZ";
    if (isFirstBay) {
      expectedBoundaryWorld = -roomDepth / 2 + startOffset;
      actualEdgeWorld = toMm(worldBox.min.z);
      suggestedLocalDirection = actualEdgeWorld === expectedBoundaryWorld ? "none" : actualEdgeWorld > expectedBoundaryWorld ? "-localX" : "+localX";
    } else {
      expectedBoundaryWorld = roomDepth / 2;
      actualEdgeWorld = toMm(worldBox.max.z);
      suggestedLocalDirection = actualEdgeWorld === expectedBoundaryWorld ? "none" : actualEdgeWorld < expectedBoundaryWorld ? "+localX" : "-localX";
    }
  }

  return {
    expectedEdgeRole,
    expectedBoundaryWorld,
    actualEdgeWorld,
    edgeGapMm: expectedBoundaryWorld == null || actualEdgeWorld == null ? null : actualEdgeWorld - expectedBoundaryWorld,
    edgeAxis,
    suggestedLocalDirection
  };
}

function getSideBackCornerBayIndex(wall) {
  if (Number.isInteger(wall?.backCornerBayIndex)) return wall.backCornerBayIndex;
  return wall?.id === "left" ? Number(wall?.bayCount || 1) - 1 : 0;
}

function getSideBackCornerPostIndex(wall) {
  if (Number.isInteger(wall?.backCornerPostIndex)) return wall.backCornerPostIndex;
  return getSideBackCornerBayIndex(wall) === 0
    ? 0
    : Number(wall?.postCount || Number(wall?.bayCount || 0) + 1) - 1;
}

function getSideOpenEndBayIndex(wall) {
  if (Number.isInteger(wall?.openEndBayIndex)) return wall.openEndBayIndex;
  return wall?.id === "left" ? 0 : Number(wall?.bayCount || 1) - 1;
}

function alignModelBoundingBox(model, targetCenterX, targetBottomY, targetCenterZ, anchor = "bottomCenter", alignMode = "bboxCenter") {
  const box3 = new THREE.Box3().setFromObject(model);
  if (box3.isEmpty()) return;
  const center = box3.getCenter(new THREE.Vector3());
  if (alignMode === "originToBayCenter") {
    model.position.x = targetCenterX;
    model.position.z = targetCenterZ;
  } else {
    model.position.x += targetCenterX - center.x;
    model.position.z += targetCenterZ - center.z;
  }
  if (anchor === "center") {
    model.position.y += targetBottomY - center.y;
  } else {
    model.position.y += targetBottomY - box3.min.y;
  }
}

function applyDepthAnchor(model, transform) {
  if (transform.depthAnchor !== "back") return;
  const box3 = new THREE.Box3().setFromObject(model);
  if (box3.isEmpty()) return;
  const baseDepth = Number(transform.depthAnchorBaseDepth) || 0.45;
  const targetBackZ = (Number(transform.depthOffset) || 0) - baseDepth / 2;
  model.position.z += targetBackZ - box3.min.z;
}

function getCarbonPostWallReferenceBox(post) {
  const wholeBox = new THREE.Box3().setFromObject(post);
  if (wholeBox.isEmpty()) return wholeBox;
  const shaftMeshes = findCarbonPostShaftMeshes(post);
  if (!shaftMeshes.length) return wholeBox;
  const shaftBox = getObjectsBoxRelativeToWorld(shaftMeshes);
  return shaftBox.isEmpty() ? wholeBox : shaftBox;
}

function findCarbonPostShaftMeshes(post) {
  const candidates = [];
  post.traverse((child) => {
    if (!child.isMesh) return;
    const box3 = new THREE.Box3().setFromObject(child);
    if (box3.isEmpty()) return;
    const size = box3.getSize(new THREE.Vector3());
    candidates.push({
      mesh: child,
      height: size.y,
      depth: size.z,
      width: size.x
    });
  });
  if (!candidates.length) return [];

  const maxHeight = Math.max(...candidates.map((candidate) => candidate.height));
  return candidates
    .filter((candidate) => candidate.height >= maxHeight - 1e-6)
    .sort((a, b) => a.depth - b.depth || b.width - a.width)
    .map((candidate) => candidate.mesh);
}

function alignCarbonComponentToWall(model, group, wall, roomWidth, roomDepth, componentType) {
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(model);
  if (worldBox.isEmpty()) return;

  const wallClearance = meters(getCarbonComponentWallClearanceMm(wall?.id, componentType));
  let deltaWorldX = 0;
  let deltaWorldZ = 0;

  if (wall?.id === "left") {
    const targetWallSideX = -roomWidth / 2 + wallClearance;
    deltaWorldX = targetWallSideX - worldBox.min.x;
  } else if (wall?.id === "right") {
    const targetWallSideX = roomWidth / 2 - wallClearance;
    deltaWorldX = targetWallSideX - worldBox.max.x;
  } else if (wall?.id === "back") {
    const targetWallSideZ = -roomDepth / 2 + wallClearance;
    deltaWorldZ = targetWallSideZ - worldBox.min.z;
  }

  if (Math.abs(deltaWorldX) <= 1e-12 && Math.abs(deltaWorldZ) <= 1e-12) return;
  translateObjectByWorldDelta(model, group, deltaWorldX, 0, deltaWorldZ);
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
}

function alignAluminumBaseComponentToWall(
  model,
  group,
  wall,
  roomWidth,
  roomDepth,
  clearanceMm
) {
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const beforeBox = new THREE.Box3().setFromObject(model);
  if (beforeBox.isEmpty()) return null;

  const wallThickness = 0.04;
  const clearance = meters(clearanceMm);
  let wallInnerSurface = null;
  let wallSideBefore = null;
  let targetWallSide = null;
  let deltaWorldX = 0;
  let deltaWorldZ = 0;

  if (wall?.id === "back") {
    wallInnerSurface = -roomDepth / 2 + wallThickness / 2;
    wallSideBefore = beforeBox.min.z;
    targetWallSide = wallInnerSurface + clearance;
    deltaWorldZ = targetWallSide - wallSideBefore;
  } else if (wall?.id === "left") {
    wallInnerSurface = -roomWidth / 2;
    wallSideBefore = beforeBox.min.x;
    targetWallSide = wallInnerSurface + clearance;
    deltaWorldX = targetWallSide - wallSideBefore;
  } else if (wall?.id === "right") {
    wallInnerSurface = roomWidth / 2;
    wallSideBefore = beforeBox.max.x;
    targetWallSide = wallInnerSurface - clearance;
    deltaWorldX = targetWallSide - wallSideBefore;
  } else {
    return null;
  }

  translateObjectByWorldDelta(model, group, deltaWorldX, 0, deltaWorldZ);
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const afterBox = new THREE.Box3().setFromObject(model);
  const wallSideAfter = wall.id === "back"
    ? afterBox.min.z
    : wall.id === "left"
      ? afterBox.min.x
      : afterBox.max.x;

  return {
    wallId: wall.id,
    wallInnerSurface: toMm(wallInnerSurface),
    wallSideBefore: toMm(wallSideBefore),
    wallSideAfter: toMm(wallSideAfter),
    targetWallSide: toMm(targetWallSide),
    clearance: toMm(Math.abs(wallSideAfter - wallInnerSurface)),
    deltaWorldX: toMm(deltaWorldX),
    deltaWorldZ: toMm(deltaWorldZ)
  };
}

function usesAluminumBaseComponentWallAlignment(componentType) {
  return [
    "backPanel",
    "woodShelf",
    "glassShelf",
    "singleRail",
    "doubleRail",
    "cabinet",
    "jewelryBox",
    "mixedStorage",
    "trouserRack",
    "pantsRack"
  ].includes(componentType);
}

function expandAluminumBaseWoodShelfBoard(model, group, extensionPerSideMm) {
  const extensionPerSide = meters(extensionPerSideMm);
  if (extensionPerSide <= 0) return null;

  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const boardMeshes = [];
  const metalMeshes = [];
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const materialNames = getMaterialNames(child);
    const hasBoardMaterial = materialNames.some((name) => (
      /(plywood|playwood|wood)/i.test(name) || name === "[Color M02]"
    ));
    const hasMetalMaterial = materialNames.some((name) => (
      /^Metal_06_1K$/i.test(name) || name === "[Color M07]"
    ));
    if (hasBoardMaterial && !hasMetalMaterial) boardMeshes.push(child);
    if (hasMetalMaterial) metalMeshes.push(child);
  });
  if (!boardMeshes.length) {
    return {
      matchedBoardMeshCount: 0,
      matchedMetalMeshCount: metalMeshes.length,
      extensionPerSide: extensionPerSideMm
    };
  }

  const componentBeforeBox = getObjectBoxRelativeTo(model, group);
  const boardBeforeBox = getObjectsBoxRelativeTo(boardMeshes, group);
  const metalBeforeBox = getObjectsBoxRelativeTo(metalMeshes, group);
  if (componentBeforeBox.isEmpty() || boardBeforeBox.isEmpty()) return null;

  const componentCenterX = componentBeforeBox.getCenter(new THREE.Vector3()).x;
  const boardBeforeCenterX = boardBeforeBox.getCenter(new THREE.Vector3()).x;
  const boardBeforeWidth = boardBeforeBox.getSize(new THREE.Vector3()).x;
  if (!boardBeforeWidth) return null;
  const targetBoardWidth = boardBeforeWidth + extensionPerSide * 2;
  const widthScale = targetBoardWidth / boardBeforeWidth;
  const inverseGroupMatrix = new THREE.Matrix4().copy(group.matrixWorld).invert();

  boardMeshes.forEach((mesh) => {
    const geometry = mesh.geometry.clone();
    const position = geometry.attributes.position;
    if (!position) return;
    const meshToGroup = new THREE.Matrix4().multiplyMatrices(inverseGroupMatrix, mesh.matrixWorld);
    const groupToMesh = new THREE.Matrix4().copy(meshToGroup).invert();
    const point = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(meshToGroup);
      point.x = componentCenterX + (point.x - boardBeforeCenterX) * widthScale;
      point.applyMatrix4(groupToMesh);
      position.setXYZ(index, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (geometry.attributes.normal) geometry.computeVertexNormals();
    mesh.geometry = geometry;
  });

  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const componentAfterBox = getObjectBoxRelativeTo(model, group);
  const boardAfterBox = getObjectsBoxRelativeTo(boardMeshes, group);
  const metalAfterBox = getObjectsBoxRelativeTo(metalMeshes, group);
  const boardAfterCenterX = boardAfterBox.getCenter(new THREE.Vector3()).x;
  const boardAfterWidth = boardAfterBox.getSize(new THREE.Vector3()).x;

  return {
    matchedBoardMeshCount: boardMeshes.length,
    matchedMetalMeshCount: metalMeshes.length,
    boardMaterialNames: [...new Set(boardMeshes.flatMap(getMaterialNames))],
    metalMaterialNames: [...new Set(metalMeshes.flatMap(getMaterialNames))],
    extensionPerSide: extensionPerSideMm,
    componentCenterX: toMm(componentCenterX),
    boardCenterBeforeX: toMm(boardBeforeCenterX),
    boardCenterAfterX: toMm(boardAfterCenterX),
    boardWidthBefore: toMm(boardBeforeWidth),
    boardWidthAfter: toMm(boardAfterWidth),
    boardLeftExtension: toMm(boardBeforeBox.min.x - boardAfterBox.min.x),
    boardRightExtension: toMm(boardAfterBox.max.x - boardBeforeBox.max.x),
    componentBeforeBox: serializeBox(componentBeforeBox),
    componentAfterBox: serializeBox(componentAfterBox),
    metalBeforeBox: serializeBox(metalBeforeBox),
    metalAfterBox: serializeBox(metalAfterBox)
  };
}

function getCarbonComponentWallClearanceMm(wallId, componentType) {
  if (wallId === "back") {
    return componentType === "singleRail" || componentType === "doubleRail" ? 208 : 10;
  }
  if (wallId === "left" || wallId === "right") {
    return componentType === "singleRail" || componentType === "doubleRail" ? 208 : 10;
  }
  return 10;
}

function getCarbonRequestedVisualWidth({ seriesId, componentType, wallId, bayWidth }) {
  if (seriesId !== "carbon-steel-post-wardrobe-v2" || !usesCarbonVisualWidthCompensation(componentType)) {
    return bayWidth;
  }
  const extraWidthMm = ["back", "left", "right"].includes(wallId) ? 25 : 5;
  return bayWidth + meters(extraWidthMm);
}

function getCarbonVisualCompensation({ seriesId, componentType, wallId }) {
  if (seriesId !== "carbon-steel-post-wardrobe-v2") return 0;
  if (!["back", "left", "right"].includes(wallId)) return 0;
  if (!usesCarbonVisualWidthCompensation(componentType)) return 0;
  return meters(25);
}

function usesAluminumPostInnerEdgeAlignment(componentType) {
  return [
    "woodShelf",
    "glassShelf",
    "singleRail",
    "cabinet",
    "jewelryBox"
  ].includes(componentType);
}

function fitAluminumComponentToPostEdges(model, group, postEdges) {
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const boardMeshes = findAluminumShelfBoardMeshes(model);
  if (!postEdges) return null;

  const targetLeftEdge = postEdges.leftPostInnerEdge;
  const targetRightEdge = postEdges.rightPostInnerEdge;
  const targetWidth = targetRightEdge - targetLeftEdge;
  const targetCenterX = (targetLeftEdge + targetRightEdge) / 2;
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) return null;
  const beforeComponentBox = getObjectBoxRelativeTo(model, group);
  if (beforeComponentBox.isEmpty()) return null;
  const beforeComponentWidth = beforeComponentBox.getSize(new THREE.Vector3()).x;
  if (!beforeComponentWidth) return null;
  const beforeBoardBox = getObjectsBoxRelativeTo(boardMeshes, group);

  model.scale.x *= targetWidth / beforeComponentWidth;
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);

  const scaledComponentBox = getObjectBoxRelativeTo(model, group);
  const leftDelta = targetLeftEdge - scaledComponentBox.min.x;
  const rightDelta = targetRightEdge - scaledComponentBox.max.x;
  const correctionX = (leftDelta + rightDelta) / 2;
  translateObjectByGroupLocalDelta(model, group, correctionX, 0, 0);

  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const finalComponentBox = getObjectBoxRelativeTo(model, group);
  const finalBoardBox = getObjectsBoxRelativeTo(boardMeshes, group);
  return {
    adjustmentMode: "whole-component",
    boardMeshCount: boardMeshes.length,
    leftPostIndex: postEdges.leftPostIndex,
    rightPostIndex: postEdges.rightPostIndex,
    leftPostCenterX: toMm(postEdges.leftPostCenterX),
    rightPostCenterX: toMm(postEdges.rightPostCenterX),
    leftPostLocalBBox: {
      minX: toMm(postEdges.leftPostMinX),
      maxX: toMm(postEdges.leftPostMaxX)
    },
    rightPostLocalBBox: {
      minX: toMm(postEdges.rightPostMinX),
      maxX: toMm(postEdges.rightPostMaxX)
    },
    leftPostInnerEdge: toMm(targetLeftEdge),
    rightPostInnerEdge: toMm(targetRightEdge),
    targetLeftEdge: toMm(targetLeftEdge),
    targetRightEdge: toMm(targetRightEdge),
    targetWidth: toMm(targetWidth),
    targetCenterX: toMm(targetCenterX),
    componentBeforeMinX: toMm(beforeComponentBox.min.x),
    componentBeforeMaxX: toMm(beforeComponentBox.max.x),
    componentBeforeWidth: toMm(beforeComponentWidth),
    componentScaledMinX: toMm(scaledComponentBox.min.x),
    componentScaledMaxX: toMm(scaledComponentBox.max.x),
    appliedCorrectionX: toMm(correctionX),
    finalComponentMinX: toMm(finalComponentBox.min.x),
    finalComponentMaxX: toMm(finalComponentBox.max.x),
    finalComponentWidth: toMm(finalComponentBox.getSize(new THREE.Vector3()).x),
    componentLeftDelta: toMm(targetLeftEdge - finalComponentBox.min.x),
    componentRightDelta: toMm(targetRightEdge - finalComponentBox.max.x),
    boardBeforeMinX: beforeBoardBox.isEmpty() ? null : toMm(beforeBoardBox.min.x),
    boardBeforeMaxX: beforeBoardBox.isEmpty() ? null : toMm(beforeBoardBox.max.x),
    finalBoardMinX: finalBoardBox.isEmpty() ? null : toMm(finalBoardBox.min.x),
    finalBoardMaxX: finalBoardBox.isEmpty() ? null : toMm(finalBoardBox.max.x),
    boardInsideComponent: finalBoardBox.isEmpty()
      || (finalBoardBox.min.x >= finalComponentBox.min.x - 1e-6
        && finalBoardBox.max.x <= finalComponentBox.max.x + 1e-6)
  };
}


function findAluminumShelfBoardMeshes(model) {
  const candidates = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    const materialNames = getMaterialNames(child).join(" ");
    if (!/(plywood|wood|glass|translucent)/i.test(materialNames)) return;
    const box3 = new THREE.Box3().setFromObject(child);
    if (box3.isEmpty()) return;
    candidates.push({ mesh: child, width: box3.getSize(new THREE.Vector3()).x });
  });
  candidates.sort((a, b) => b.width - a.width);
  return candidates.map((candidate) => candidate.mesh);
}

function getMaterialNames(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials
    .map((material) => material?.name || "")
    .filter(Boolean);
}

function getObjectWidth(model) {
  const box3 = new THREE.Box3().setFromObject(model);
  if (box3.isEmpty()) return 0;
  return box3.getSize(new THREE.Vector3()).x;
}

function addSelectionOutline(model) {
  const outline = new THREE.BoxHelper(model, new THREE.Color(theme.colors.primary));
  outline.name = "Selection Outline";
  outline.userData = { placementId: model.userData.placementId };
  model.add(outline);
}

function getComponentTransform(componentType, modelTransforms, report = null) {
  const transform = modelTransforms.components[componentType];
  if (!transform) {
    console.warn("transform not matched:", componentType);
    report?.transformDiagnostics?.push({
      componentType,
      matchedTransformKey: null,
      warning: "transform not matched"
    });
  }
  return transform || {
    rotation: [0, 0, 0],
    scaleAxis: "x",
    anchor: "bottomCenter",
    depthOffset: 0,
    heightOffset: 0,
    resizeMode: "centerInBay",
    alignMode: "bboxCenter"
  };
}

function getAluminumPostModelPath(config) {
  const postStyle = config.postStyle === "square" ? "square" : "round";
  const connectionMode = config.connectionMode === "ceiling-mounted"
    ? "ceiling-mounted"
    : "wall-mounted";
  return aluminumPostModelPaths[`${postStyle}:${connectionMode}`];
}

function getDrawerDoubleInsertRequests(placement) {
  if (placement.componentType !== "drawerDouble") return [];
  return [
    { layer: "top", sku: placement.topDrawerSku },
    { layer: "bottom", sku: placement.bottomDrawerSku }
  ].map((request) => ({
    ...request,
    modelPath: drawerDoubleInsertModelPathsBySku.get(request.sku)
  })).filter((request) => request.modelPath);
}

async function createDrawerDoubleCompositeModel({
  baseModel,
  placement,
  series,
  report,
  targetSize,
  transform,
  modelTransforms
}) {
  const insertRequests = getDrawerDoubleInsertRequests(placement);
  if (!insertRequests.length || baseModel.name === "Missing Model") return baseModel;
  const defaultTrayLayers = getDrawerDoubleDefaultTrayLayers(baseModel);

  const composite = new THREE.Group();
  composite.name = baseModel.name || "Drawer Double";
  composite.userData = {
    ...baseModel.userData,
    drawerDoubleBaseModel: true,
    drawerDoubleInsertModelPaths: insertRequests.map((request) => request.modelPath)
  };
  composite.add(baseModel);

  for (const request of insertRequests) {
    const targetLayer = defaultTrayLayers[request.layer];
    if (!targetLayer) continue;
    targetLayer.mesh.parent?.remove(targetLayer.mesh);
    const insertModel = await createModelOrMissing(
      {
        sku: `drawerDoubleInsert:${request.sku}`,
        nameCn: "Drawer Double Insert",
        modelPath: request.modelPath,
        glbAssetPath: request.modelPath
      },
      series,
      report,
      targetSize,
      "Drawer Double Insert",
      transform,
      placement.componentType,
      modelTransforms
    );
    pruneDrawerDoubleInsertModel(insertModel, request.modelPath);
    if (isWireBasketDrawerSku(request.sku)) {
      applyWireBasketWhiteMaterial(insertModel);
    }
    alignDrawerDoubleInsertToTray(insertModel, targetLayer.box);
    insertModel.userData = {
      ...insertModel.userData,
      isDrawerDoubleInsert: true,
      drawerDoubleInsertLayer: request.layer,
      drawerDoubleInsertSku: request.sku,
      drawerDoubleInsertModelPath: request.modelPath
    };
    composite.add(insertModel);
  }
  return composite;
}

function getDrawerDoubleDefaultTrayLayers(baseModel) {
  baseModel.updateMatrixWorld(true);
  const trayMeshes = [];
  baseModel.traverse((child) => {
    if (!child.isMesh) return;
    const materialNames = getMaterialNames(child);
    if (!materialNames.some((name) => name === "[Color M05]")) return;
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 0.45 || size.x > 0.8 || size.z < 0.35 || size.z > 0.55) return;
    trayMeshes.push({
      mesh: child,
      box,
      center: box.getCenter(new THREE.Vector3()),
      size
    });
  });
  trayMeshes.sort((a, b) => a.center.y - b.center.y);
  return {
    bottom: trayMeshes[0] || null,
    top: trayMeshes[trayMeshes.length - 1] || null
  };
}

function pruneDrawerDoubleInsertModel(insertModel, insertModelPath) {
  insertModel.updateMatrixWorld(true);
  const removable = [];
  insertModel.traverse((child) => {
    if (!child.isMesh) return;
    if (!isDrawerDoubleInsertMesh(child, insertModelPath)) {
      removable.push(child);
    }
  });
  removable.forEach((child) => child.parent?.remove(child));
}

function isDrawerDoubleInsertMesh(mesh, insertModelPath) {
  const path = getObjectNamePath(mesh).join("/");
  const materialNames = getMaterialNames(mesh);
  if (/wire-basket/i.test(insertModelPath)) {
    return /组件#/.test(path)
      || materialNames.some((name) => /Translucent Glass Safety/i.test(name));
  }
  if (/leather-storage/i.test(insertModelPath)) {
    const box = new THREE.Box3().setFromObject(mesh);
    return !box.isEmpty() && box.min.y < -0.001;
  }
  return false;
}

function getObjectNamePath(object) {
  const names = [];
  let current = object;
  while (current) {
    names.unshift(current.name || "");
    current = current.parent;
  }
  return names.filter(Boolean);
}

function alignDrawerDoubleInsertToTray(insertModel, trayBox) {
  insertModel.updateMatrixWorld(true);
  const insertBox = new THREE.Box3().setFromObject(insertModel);
  if (insertBox.isEmpty() || trayBox.isEmpty()) return;
  const insertCenter = insertBox.getCenter(new THREE.Vector3());
  const trayCenter = trayBox.getCenter(new THREE.Vector3());
  insertModel.position.x += trayCenter.x - insertCenter.x;
  insertModel.position.y += trayCenter.y - insertCenter.y;
  insertModel.position.z += trayCenter.z - insertCenter.z;
  insertModel.updateMatrixWorld(true);
}

function resolvePlacementSceneProduct(placement, design) {
  if (
    placement.componentType === "drawerDouble"
    && (placement.topDrawerSku || placement.bottomDrawerSku)
  ) {
    return clientDrawerDoublePreviewProduct;
  }
  if (placement.componentType === "drawerSingle") {
    return design.productBySku[placement.productSku];
  }
  return design.productBySku[placement.productSku] || design.productByType[placement.componentType];
}

async function createModelOrMissing(product, series, report, targetSize, label, transform, componentType = "", modelTransforms) {
  const modelPath = product?.glbAssetPath || product?.modelPath || "";
  if (!modelPath) {
    report.failed.add(label);
    report.missingPlacements.push({ name: label, reason: "modelPath is empty" });
    return createMissingModelLabel(label);
  }

  report.requested.add(modelPath);
  try {
    const source = await loadModel(modelPath, series);
    report.success.add(modelPath);
    const clone = source.clone(true);
    cleanupLoadedModel(clone);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
    applyComponentRotation(clone, transform);
    const rawBox = new THREE.Box3().setFromObject(clone);
    clone.userData.originalBoundingBoxWidth = serializeBox(rawBox)?.size?.x || 0;
    const effectiveTransform = componentType === "post"
      ? series?.seriesId === "aluminum-post-wardrobe"
        ? { ...transform, resizeMode: "stretchHeightOnly", scaleAxis: "y" }
        : series?.seriesId === "aluminum-base-supported"
          ? { ...transform, resizeMode: "stretchHeightOnly", scaleAxis: "y" }
        : series?.seriesId === "carbon-steel-post-wardrobe-v2"
          ? transform
          : { ...transform, resizeMode: "stretchXYZ", scaleAxis: "y" }
      : series?.seriesId === "aluminum-post-wardrobe" && componentType === "singleRail"
        ? { ...transform, resizeMode: "stretchWidthOnly", scaleAxis: "x" }
        : transform;
    fitObjectToBox(clone, targetSize, effectiveTransform);
    const fittedBox = new THREE.Box3().setFromObject(clone);
    const transformDiagnostic = {
      componentType,
      matchedTransformKey: modelTransforms.components[componentType] ? componentType : null,
      rotation: transform.rotation,
      scaleAxis: transform.scaleAxis,
      resizeMode: transform.resizeMode,
      beforeBoundingBox: serializeBox(rawBox),
      afterBoundingBox: serializeBox(fittedBox)
    };
    console.log("[componentTransform]", transformDiagnostic);
    report.transformDiagnostics.push(transformDiagnostic);
    report.modelBounds.push({
      componentType,
      modelPath,
      raw: serializeBox(rawBox),
      fitted: serializeBox(fittedBox),
      transform: {
        rotation: transform.rotation,
        scaleAxis: transform.scaleAxis,
        anchor: transform.anchor,
        depthOffset: transform.depthOffset,
        heightOffset: transform.heightOffset,
        resizeMode: transform.resizeMode
      }
    });
    return clone;
  } catch (error) {
    report.failed.add(modelPath);
    report.missingPlacements.push({ name: label, modelPath, reason: error.message });
    return createMissingModelLabel("Missing Model");
  }
}

export function loadModel(modelPath, series) {
  const resolvedUrl = resolveSeriesAsset(series, modelPath);
  const aluminumBaseSupportedModelVersion = series?.seriesId === "aluminum-base-supported"
    ? aluminumBaseSupportedUpdatedModelVersions.get(modelPath)
    : null;
  const url = aluminumBaseSupportedModelVersion
    ? `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}v=${aluminumBaseSupportedModelVersion}`
    : resolvedUrl;
  if (!modelCache.has(url)) {
    modelCache.set(url, withTimeout(new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }), 12000, url));
  }
  return modelCache.get(url);
}

function withTimeout(promise, timeoutMs, url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Model load timeout: ${url}`)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function cleanupLoadedModel(object) {
  const removable = [];
  object.traverse((child) => {
    if (child.isCamera || child.isLight || /Active View/i.test(child.name || "")) {
      removable.push(child);
    }
  });
  removable.forEach((child) => child.parent?.remove(child));
}

function applyPostColor(object, frameColor) {
  applyModelColor(object, getFrameColor(frameColor), { metalness: 0.45, roughness: 0.32 });
}

function isWallMountedShelfSupportMaterial(material) {
  return /(?:metal|bracket|support|gray|M07)/i.test(material?.name || "");
}

function applyWallMountedShelfSupportColor(model, frameColor) {
  const frameColorValue = getFrameColor(frameColor);
  const meshNames = [];
  const materialNames = new Set();
  model.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    let matched = false;
    const nextMaterials = materials.map((material) => {
      if (!isWallMountedShelfSupportMaterial(material)) return material;
      matched = true;
      materialNames.add(material.name || "");
      const next = material.clone();
      if (next.color) next.color.set(frameColorValue);
      if ("metalness" in next) next.metalness = 0.45;
      if ("roughness" in next) next.roughness = 0.32;
      return next;
    });
    if (matched) meshNames.push(child.name || "");
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
  return {
    frameColor,
    color: `#${new THREE.Color(frameColorValue).getHexString().toUpperCase()}`,
    meshNames,
    materialNames: Array.from(materialNames)
  };
}

function createWallMountedLedMaterial(isLedEnabled) {
  return new THREE.MeshStandardMaterial({
    color: isLedEnabled ? 0xffffff : 0xcfcfc8,
    emissive: isLedEnabled ? 0xf4faff : 0x000000,
    emissiveIntensity: isLedEnabled ? 8 : 0,
    roughness: isLedEnabled ? 0.25 : 0.75,
    metalness: 0,
    transparent: !isLedEnabled,
    opacity: isLedEnabled ? 1 : 0.75,
    toneMapped: !isLedEnabled
  });
}

function getPrincipalAxis(points) {
  const center = points.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector3()
  ).multiplyScalar(1 / points.length);
  const covariance = new THREE.Matrix3().set(
    0, 0, 0,
    0, 0, 0,
    0, 0, 0
  );
  const elements = covariance.elements;
  points.forEach((point) => {
    const offset = point.clone().sub(center);
    elements[0] += offset.x * offset.x;
    elements[1] += offset.x * offset.y;
    elements[2] += offset.x * offset.z;
    elements[3] += offset.y * offset.x;
    elements[4] += offset.y * offset.y;
    elements[5] += offset.y * offset.z;
    elements[6] += offset.z * offset.x;
    elements[7] += offset.z * offset.y;
    elements[8] += offset.z * offset.z;
  });
  let axis = new THREE.Vector3(0, 0, 1);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    axis.applyMatrix3(covariance).normalize();
  }
  if (axis.z < 0) axis.negate();
  const projections = points.map((point) => point.dot(axis));
  const minProjection = Math.min(...projections);
  const maxProjection = Math.max(...projections);
  const centerProjection = center.dot(axis);
  center.addScaledVector(axis, (minProjection + maxProjection) / 2 - centerProjection);
  return {
    axis,
    center,
    length: maxProjection - minProjection
  };
}

function getWallMountedSupports(model, group) {
  const points = [];
  const inverseReferenceMatrix = new THREE.Matrix4().copy(group.matrixWorld).invert();
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (!materials.some(isWallMountedShelfSupportMaterial)) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      const point = new THREE.Vector3()
        .fromBufferAttribute(position, index)
        .applyMatrix4(child.matrixWorld)
        .applyMatrix4(inverseReferenceMatrix);
      points.push(point);
    }
  });
  if (!points.length) return [];

  const fullBox = new THREE.Box3().setFromPoints(points);
  const fullSize = fullBox.getSize(new THREE.Vector3());
  const sideBandWidth = Math.max(0.02, fullSize.x * 0.18);
  const leftLimit = fullBox.min.x + sideBandWidth;
  const rightLimit = fullBox.max.x - sideBandWidth;
  const leftPoints = points.filter((point) => point.x <= leftLimit);
  const rightPoints = points.filter((point) => point.x >= rightLimit);

  return [leftPoints, rightPoints]
    .filter((sidePoints) => sidePoints.length)
    .map((sidePoints) => ({
      box: new THREE.Box3().setFromPoints(sidePoints),
      ...getPrincipalAxis(sidePoints)
    }));
}

function getBoxProjectionRange(box, axis) {
  const center = box.getCenter(new THREE.Vector3());
  const halfSize = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const centerProjection = center.dot(axis);
  const radius = Math.abs(axis.x) * halfSize.x
    + Math.abs(axis.y) * halfSize.y
    + Math.abs(axis.z) * halfSize.z;
  return {
    min: centerProjection - radius,
    max: centerProjection + radius
  };
}

function addWallMountedShelfLedStrips(
  model,
  group,
  isLedEnabled,
  componentType,
  wallId,
  placementId
) {
  if (model.name === "Missing Model") return null;
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const componentBox = getObjectBoxRelativeTo(model, group);
  if (componentBox.isEmpty()) return null;

  const supports = getWallMountedSupports(model, group);
  if (!supports.length) return null;
  const stripThickness = 0.006;
  const strips = [];

  supports.forEach((support, index) => {
    const stripLength = Math.max(0.01, support.length);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(stripThickness, stripThickness, stripLength),
      createWallMountedLedMaterial(isLedEnabled)
    );
    strip.name = componentType === "glassShelf"
      ? "WALL_MOUNTED_LED_STRIP_GLASS"
      : componentType === "shoeShelf"
        ? "WALL_MOUNTED_LED_STRIP_SHOE"
        : "WALL_MOUNTED_LED_STRIP_WOOD";
    strip.position.copy(support.center);
    strip.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      support.axis
    );
    if (componentType === "glassShelf") {
      group.add(strip);
      group.updateMatrixWorld(true);
      strip.updateMatrixWorld(true);
      const supportFrontNormalWorld = new THREE.Vector3(index === 0 ? -1 : 1, 0, 0)
        .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
      const supportWorldBox = support.box.clone().applyMatrix4(group.matrixWorld);
      const stripWorldBox = new THREE.Box3().setFromObject(strip);
      const supportProjection = getBoxProjectionRange(supportWorldBox, supportFrontNormalWorld);
      const stripProjection = getBoxProjectionRange(stripWorldBox, supportFrontNormalWorld);
      const worldOffset = supportProjection.max - stripProjection.min;
      translateObjectByWorldDelta(
        strip,
        group,
        supportFrontNormalWorld.x * worldOffset,
        supportFrontNormalWorld.y * worldOffset,
        supportFrontNormalWorld.z * worldOffset
      );
      strip.updateMatrixWorld(true);
    }
    strip.userData = {
      programmaticLed: true,
      ledType: strip.name,
      wallId,
      placementId,
      supportSide: index === 0 ? "left" : "right"
    };
    if (strip.parent !== group) group.add(strip);
    strips.push(strip);
  });

  group.updateMatrixWorld(true);
  strips.forEach((strip) => strip.updateMatrixWorld(true));
  return {
    componentType,
    wallId,
    placementId,
    ledEnabled: isLedEnabled,
    stripCount: strips.length,
    color: isLedEnabled ? "#FFFFFF" : "#CFCFC8",
    emissive: isLedEnabled ? "#F4FAFF" : "#000000",
    emissiveIntensity: isLedEnabled ? 8 : 0,
    roughness: isLedEnabled ? 0.25 : 0.75,
    opacity: isLedEnabled ? 1 : 0.75,
    lightType: "none",
    componentBBox: serializeBox(componentBox),
    supports: supports.map((support) => ({
      bbox: serializeBox(support.box),
      center: serializeVectorMm(support.center),
      axis: serializeVector(support.axis),
      length: toMm(support.length)
    })),
    strips: strips.map((strip, index) => {
      const stripBox = getObjectBoxRelativeTo(strip, group);
      const supportBox = supports[index].box;
      const supportFront = index === 0 ? supportBox.min.x : supportBox.max.x;
      const stripBack = index === 0 ? stripBox.max.x : stripBox.min.x;
      const supportFrontNormalWorld = new THREE.Vector3(index === 0 ? -1 : 1, 0, 0)
        .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
      const supportWorldBox = supportBox.clone().applyMatrix4(group.matrixWorld);
      const stripWorldBox = new THREE.Box3().setFromObject(strip);
      const supportWorldProjection = getBoxProjectionRange(supportWorldBox, supportFrontNormalWorld);
      const stripWorldProjection = getBoxProjectionRange(stripWorldBox, supportFrontNormalWorld);
      return {
        name: strip.name,
        localBBox: serializeBox(stripBox),
        worldBBox: serializeBox(stripWorldBox),
        localPosition: serializeVectorMm(strip.position),
        localRotationDegrees: serializeEulerDegrees(strip.rotation),
        worldPosition: serializeVectorMm(strip.getWorldPosition(new THREE.Vector3())),
        worldRotationDegrees: serializeEulerDegrees(
          new THREE.Euler().setFromQuaternion(strip.getWorldQuaternion(new THREE.Quaternion()))
        ),
        supportFrontNormalWorld: serializeVector(supportFrontNormalWorld),
        supportFront: toMm(supportFront),
        stripBack: toMm(stripBack),
        supportGap: toMm(index === 0
          ? supportFront - stripBack
          : stripBack - supportFront),
        worldSupportFront: toMm(supportWorldProjection.max),
        worldStripBack: toMm(stripWorldProjection.min),
        worldSupportGap: toMm(stripWorldProjection.min - supportWorldProjection.max),
        supportSide: strip.userData.supportSide
      };
    })
  };
}

function addAluminumPostLedGlow(post, isLedEnabled, { connectionMode, postStyle } = {}) {
  post.updateMatrixWorld(true);
  const localBox = getObjectBoxRelativeTo(post, post);
  const ledPositionBox = getAluminumPostLedPositionBox(localBox, connectionMode, postStyle);
  const localSize = ledPositionBox.getSize(new THREE.Vector3());
  const localCenter = ledPositionBox.getCenter(new THREE.Vector3());
  const scaleX = Math.max(Math.abs(post.scale.x), Number.EPSILON);
  const scaleY = Math.max(Math.abs(post.scale.y), Number.EPSILON);
  const scaleZ = Math.max(Math.abs(post.scale.z), Number.EPSILON);
  const ledStripWidth = 0.008;
  const ledVerticalInset = 0.125 / scaleY;
  const stripWidth = ledStripWidth / scaleX;
  const stripDepth = Math.min(0.002 / scaleZ, localSize.z);
  const stripHeight = Math.max(0.001, localSize.y - ledVerticalInset * 2);
  const ledCenterZ = localCenter.z;
  const geometry = new THREE.BoxGeometry(stripWidth, stripHeight, stripDepth);
  const material = new THREE.MeshStandardMaterial({
    color: isLedEnabled ? 0xffd58a : 0xf4f1e8,
    emissive: isLedEnabled ? 0xffc45c : 0x000000,
    emissiveIntensity: isLedEnabled ? 26 : 0,
    roughness: isLedEnabled ? 0.05 : 0.28,
    metalness: 0,
    transparent: !isLedEnabled,
    opacity: isLedEnabled ? 1 : 0.72,
    toneMapped: false
  });
  const glowWidth = Math.min(0.024 / scaleX, localSize.x);
  const glowDepth = Math.min(0.001 / scaleZ, localSize.z);
  const glowGeometry = new THREE.BoxGeometry(glowWidth, stripHeight, glowDepth);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb84a,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const stripCentersX = [
    ledPositionBox.min.x + stripWidth / 2,
    ledPositionBox.max.x - stripWidth / 2
  ];
  const strips = stripCentersX.map((centerX) => {
    const strip = new THREE.Mesh(geometry, material);
    strip.name = "aluminum-post-led-glow";
    strip.position.set(
      centerX,
      localCenter.y,
      ledCenterZ
    );
    post.add(strip);
    return strip;
  });
  if (isLedEnabled) {
    stripCentersX.forEach((centerX) => {
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.name = "aluminum-post-led-linear-glow";
      glow.position.set(centerX, localCenter.y, ledCenterZ);
      glow.renderOrder = 2;
      post.add(glow);
    });
  }

  post.updateMatrixWorld(true);
  const ledBoxes = strips.map((strip) => new THREE.Box3().setFromObject(strip));
  const ledWorldCenters = strips.map((strip) => strip.getWorldPosition(new THREE.Vector3()));
  const ledSize = ledBoxes[0].getSize(new THREE.Vector3());
  const postWorldBox = new THREE.Box3().setFromObject(post);
  console.log("[aluminum-led] post bbox", postWorldBox.min, postWorldBox.max);

  return {
    postBBoxLocalRaw: serializeRawBox(localBox),
    shaftBBoxLocalRaw: serializeRawBox(ledPositionBox),
    postBBoxWorld: serializeBox(postWorldBox),
    postBBoxSizeMm: serializeVectorMm(postWorldBox.getSize(new THREE.Vector3())),
    ledBBoxSizeMm: serializeVectorMm(ledSize),
    ledVisibleHeightMm: toMm(stripHeight * scaleY),
    ledVerticalInsetMm: toMm(ledVerticalInset * scaleY),
    leftLedCenterLocalX: stripCentersX[0],
    rightLedCenterLocalX: stripCentersX[1],
    ledCenterLocalZ: ledCenterZ,
    ledWorldCentersMm: ledWorldCenters.map(serializeVectorMm),
    ledEnabled: isLedEnabled,
    emissiveIntensity: isLedEnabled ? 26 : 0,
    glowWidthMm: toMm(glowWidth * scaleX),
    glowOpacity: isLedEnabled ? 0.82 : 0,
    lightType: "none",
    lightIntensity: 0,
    parent: "post",
    formula: connectionMode === "wall-mounted"
      ? "wall-mounted shaft bbox; local left=minX+ledWidth/2; local right=maxX-ledWidth/2; local z=(shaftMinZ+shaftMaxZ)/2"
      : "full post bbox; local left=minX+ledWidth/2; local right=maxX-ledWidth/2; local z=(minZ+maxZ)/2"
  };
}

function createAluminumBaseLedMaterial(isLedEnabled) {
  return new THREE.MeshStandardMaterial({
    color: isLedEnabled ? 0xffffff : 0xcfcfc8,
    emissive: isLedEnabled ? 0xf5fbff : 0x000000,
    emissiveIntensity: isLedEnabled ? 8 : 0,
    roughness: isLedEnabled ? 0.25 : 0.75,
    metalness: 0,
    transparent: !isLedEnabled,
    opacity: isLedEnabled ? 1 : 0.75,
    toneMapped: !isLedEnabled
  });
}

function addAluminumBasePostLedStrip(post, group, isLedEnabled, wallId, postIndex) {
  group.updateMatrixWorld(true);
  post.updateMatrixWorld(true);
  const postBox = getObjectBoxRelativeTo(post, group);
  if (postBox.isEmpty()) return null;

  const size = postBox.getSize(new THREE.Vector3());
  const center = postBox.getCenter(new THREE.Vector3());
  const stripWidth = isLedEnabled ? 0.014 : 0.012;
  const stripDepth = 0.003;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(stripWidth, size.y, stripDepth),
    createAluminumBaseLedMaterial(isLedEnabled)
  );
  strip.name = "LED_STRIP_POST";
  strip.position.set(center.x, center.y, postBox.max.z + stripDepth / 2);
  strip.userData = {
    programmaticLed: true,
    ledType: "LED_STRIP_POST",
    wallId,
    postIndex
  };
  group.add(strip);
  group.updateMatrixWorld(true);
  strip.updateMatrixWorld(true);
  const stripLocalBBox = serializeBox(getObjectBoxRelativeTo(strip, group));
  const stripWorldBBox = serializeBox(new THREE.Box3().setFromObject(strip));
  console.log("[aluminum-base-led] post strip world bbox", JSON.stringify(stripWorldBBox));

  return {
    ledType: "LED_STRIP_POST",
    componentKind: "post",
    wallId,
    postIndex,
    ledEnabled: isLedEnabled,
    color: isLedEnabled ? "#FFFFFF" : "#CFCFC8",
    emissive: isLedEnabled ? "#F5FBFF" : "#000000",
    emissiveIntensity: isLedEnabled ? 8 : 0,
    roughness: isLedEnabled ? 0.25 : 0.75,
    opacity: isLedEnabled ? 1 : 0.75,
    localBBox: stripLocalBBox,
    worldBBox: stripWorldBBox
  };
}

function findAluminumBaseShelfSupportMeshes(model, group) {
  const candidates = [];
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const materialNames = getMaterialNames(child);
    if (!materialNames.some((name) => /(metal(?:_06)?|\[Color M07\]|灰色支撑件)/i.test(name))) return;
    const localBox = getObjectBoxRelativeTo(child, group);
    if (localBox.isEmpty()) return;
    const size = localBox.getSize(new THREE.Vector3());
    candidates.push({
      mesh: child,
      materialNames,
      localBox,
      worldBox: new THREE.Box3().setFromObject(child),
      size
    });
  });

  return candidates
    .filter((candidate) => candidate.size.z > candidate.size.x)
    .sort((a, b) => a.localBox.getCenter(new THREE.Vector3()).x
      - b.localBox.getCenter(new THREE.Vector3()).x);
}

function dedupeAluminumBaseWoodShelfSupports(model, group, placement, registry) {
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const supports = findAluminumBaseShelfSupportMeshes(model, group);
  const componentBox = getObjectBoxRelativeTo(model, group);
  if (componentBox.isEmpty()) return null;
  const componentCenterX = componentBox.getCenter(new THREE.Vector3()).x;
  const kept = [];
  const removed = [];

  supports.forEach((support) => {
    const supportCenterX = support.localBox.getCenter(new THREE.Vector3()).x;
    const side = supportCenterX < componentCenterX ? "left" : "right";
    const postIndex = Number(placement.bayIndex) + (side === "right" ? 1 : 0);
    const key = `${placement.wallId}:${postIndex}:${Math.round(Number(placement.heightFromFloor) || 0)}`;
    const diagnostic = {
      key,
      side,
      postIndex,
      meshName: support.mesh.name || "",
      materialNames: support.materialNames,
      materialColors: (Array.isArray(support.mesh.material)
        ? support.mesh.material
        : [support.mesh.material])
        .map((material) => material?.color ? `#${material.color.getHexString()}` : null),
      worldBBox: serializeBox(support.worldBox)
    };
    if (registry.has(key)) {
      support.mesh.parent?.remove(support.mesh);
      removed.push(diagnostic);
    } else {
      registry.add(key);
      kept.push(diagnostic);
    }
  });

  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  return {
    keptCount: kept.length,
    removedCount: removed.length,
    kept,
    removed
  };
}

function addAluminumBaseShelfLedStrip(
  model,
  group,
  isLedEnabled,
  componentKind,
  wallId,
  placementId
) {
  if (model.name === "Missing Model") return null;
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const componentBox = getObjectBoxRelativeTo(model, group);
  if (componentBox.isEmpty()) return null;

  const supportMeshes = findAluminumBaseShelfSupportMeshes(model, group);
  if (!supportMeshes.length) return null;

  const componentCenterX = componentBox.getCenter(new THREE.Vector3()).x;
  const stripPlacementWidth = 0.004;
  const stripWidth = isLedEnabled ? 0.006 : stripPlacementWidth;
  const stripHeight = 0.008;
  const ledType = componentKind === "woodShelf"
    ? "LED_STRIP_SHELF"
    : "LED_STRIP_GLASS";
  const strips = supportMeshes.map((support, supportIndex) => {
    const supportCenter = support.localBox.getCenter(new THREE.Vector3());
    const supportSize = support.localBox.getSize(new THREE.Vector3());
    const side = supportCenter.x < componentCenterX ? "left" : "right";
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(stripWidth, stripHeight, supportSize.z),
      createAluminumBaseLedMaterial(isLedEnabled)
    );
    strip.name = ledType;
    strip.position.set(
      side === "left"
        ? support.localBox.min.x - stripPlacementWidth / 2
        : support.localBox.max.x + stripPlacementWidth / 2,
      supportCenter.y,
      supportCenter.z
    );
    strip.userData = {
      programmaticLed: true,
      ledType,
      wallId,
      placementId,
      supportIndex,
      supportSide: side
    };
    group.add(strip);
    return { strip, support, supportIndex, side };
  });
  group.updateMatrixWorld(true);
  strips.forEach(({ strip }) => strip.updateMatrixWorld(true));

  const supportDiagnostics = strips.map(({ strip, support, supportIndex, side }) => {
    const supportWorldBBox = serializeBox(support.worldBox);
    const stripLocalBBox = serializeBox(getObjectBoxRelativeTo(strip, group));
    const stripWorldBBox = serializeBox(new THREE.Box3().setFromObject(strip));
    console.log(
      `[aluminum-base-led] ${componentKind} support ${supportIndex} bboxes`,
      JSON.stringify({ supportWorldBBox, stripWorldBBox })
    );
    return {
      supportIndex,
      side,
      meshName: support.mesh.name || "",
      materialNames: support.materialNames,
      supportLocalBBox: serializeBox(support.localBox),
      supportWorldBBox,
      stripLocalBBox,
      stripWorldBBox
    };
  });

  return {
    ledType,
    componentKind,
    wallId,
    placementId,
    ledEnabled: isLedEnabled,
    color: isLedEnabled ? "#FFFFFF" : "#CFCFC8",
    emissive: isLedEnabled ? "#F5FBFF" : "#000000",
    emissiveIntensity: isLedEnabled ? 8 : 0,
    roughness: isLedEnabled ? 0.25 : 0.75,
    opacity: isLedEnabled ? 1 : 0.75,
    stripCount: strips.length,
    sourceComponentBBox: serializeBox(componentBox),
    supportIdentification: "material name Metal/Metal_06/[Color M07]/灰色支撑件 and bbox depth(z) > width(x)",
    supports: supportDiagnostics
  };
}

function getAluminumPostLedPositionBox(localBox, connectionMode, postStyle) {
  const positionBox = localBox.clone();
  if (connectionMode !== "wall-mounted") return positionBox;

  const shaftDepth = postStyle === "square" ? 0.04565 : 0.06;
  positionBox.min.z = Math.max(positionBox.min.z, positionBox.max.z - shaftDepth);
  return positionBox;
}

function serializeRawBox(box3) {
  if (box3.isEmpty()) return null;
  const size = box3.getSize(new THREE.Vector3());
  const center = box3.getCenter(new THREE.Vector3());
  const vec = (value) => ({ x: value.x, y: value.y, z: value.z });
  return {
    min: vec(box3.min),
    max: vec(box3.max),
    center: vec(center),
    size: vec(size)
  };
}

function getObjectBoxRelativeTo(object, relativeTo) {
  const box = new THREE.Box3();
  const inverseRelativeMatrix = new THREE.Matrix4().copy(relativeTo.matrixWorld).invert();
  const relativeMatrix = new THREE.Matrix4();
  const corner = new THREE.Vector3();

  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    const geometryBox = child.geometry.boundingBox;
    if (!geometryBox) return;
    relativeMatrix.multiplyMatrices(inverseRelativeMatrix, child.matrixWorld);
    for (const x of [geometryBox.min.x, geometryBox.max.x]) {
      for (const y of [geometryBox.min.y, geometryBox.max.y]) {
        for (const z of [geometryBox.min.z, geometryBox.max.z]) {
          corner.set(x, y, z).applyMatrix4(relativeMatrix);
          box.expandByPoint(corner);
        }
      }
    }
  });

  return box;
}

function getObjectsBoxRelativeTo(objects, relativeTo) {
  const box = new THREE.Box3();
  objects.forEach((object) => {
    const objectBox = getObjectBoxRelativeTo(object, relativeTo);
    if (!objectBox.isEmpty()) box.union(objectBox);
  });
  return box;
}

function getObjectsBoxRelativeToWorld(objects) {
  const box = new THREE.Box3();
  objects.forEach((object) => {
    const objectBox = new THREE.Box3().setFromObject(object);
    if (!objectBox.isEmpty()) box.union(objectBox);
  });
  return box;
}

function translateObjectByGroupLocalDelta(object, group, deltaX, deltaY = 0, deltaZ = 0) {
  const parent = object.parent || group;
  group.updateMatrixWorld(true);
  parent.updateMatrixWorld(true);
  const groupOriginWorld = group.localToWorld(new THREE.Vector3(0, 0, 0));
  const groupShiftWorld = group.localToWorld(new THREE.Vector3(deltaX, deltaY, deltaZ));
  const parentOrigin = parent.worldToLocal(groupOriginWorld.clone());
  const parentShift = parent.worldToLocal(groupShiftWorld.clone());
  object.position.add(parentShift.sub(parentOrigin));
}

function translateObjectByWorldDelta(object, relativeTo, deltaX, deltaY = 0, deltaZ = 0) {
  const parent = object.parent || relativeTo;
  parent.updateMatrixWorld(true);
  object.updateMatrixWorld(true);
  const worldOrigin = object.getWorldPosition(new THREE.Vector3());
  const localOrigin = parent.worldToLocal(worldOrigin.clone());
  const localShifted = parent.worldToLocal(
    worldOrigin.clone().add(new THREE.Vector3(deltaX, deltaY, deltaZ))
  );
  object.position.add(localShifted.sub(localOrigin));
}

function alignWallMountedLinkedShelfToRail(shelfModel, group, placement) {
  const railModel = group.children.find((child) => {
    if (placement.linkedRailId && child.userData?.placementId === placement.linkedRailId) return true;
    return placement.linkedRailDependencyId
      && child.userData?.shelfDependency?.dependencyId === placement.linkedRailDependencyId;
  });
  if (!railModel) return { missingRail: true };
  group.updateMatrixWorld(true);
  railModel.updateMatrixWorld(true);
  shelfModel.updateMatrixWorld(true);
  const railBox = new THREE.Box3().setFromObject(railModel);
  const shelfBoxBefore = new THREE.Box3().setFromObject(shelfModel);
  const deltaY = railBox.max.y - shelfBoxBefore.min.y;
  if (Number.isFinite(deltaY) && Math.abs(deltaY) > 1e-12) {
    translateObjectByWorldDelta(shelfModel, group, 0, deltaY, 0);
    group.updateMatrixWorld(true);
    shelfModel.updateMatrixWorld(true);
  }
  const shelfBoxAfter = new THREE.Box3().setFromObject(shelfModel);
  return {
    railId: railModel.userData?.placementId || null,
    railTopY: toMm(railBox.max.y),
    shelfBottomYBefore: toMm(shelfBoxBefore.min.y),
    shelfBottomYAfter: toMm(shelfBoxAfter.min.y),
    deltaY: toMm(deltaY),
    finalGap: toMm(shelfBoxAfter.min.y - railBox.max.y)
  };
}

function alignWallMountedPlacementDistanceFromWall(model, group, wall, room, targetDistanceMm) {
  group.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const beforeBox = new THREE.Box3().setFromObject(model);
  const beforeDistance = getWallMountedActualDistanceFromWall(beforeBox, wall, room);
  if (!Number.isFinite(beforeDistance)) return null;
  const deltaMm = Number(targetDistanceMm) - beforeDistance;
  const delta = meters(deltaMm);
  let deltaWorldX = 0;
  let deltaWorldZ = 0;
  if (wall.id === "back") deltaWorldZ = delta;
  if (wall.id === "left") deltaWorldX = delta;
  if (wall.id === "right") deltaWorldX = -delta;
  if (Math.abs(deltaWorldX) > 1e-12 || Math.abs(deltaWorldZ) > 1e-12) {
    translateObjectByWorldDelta(model, group, deltaWorldX, 0, deltaWorldZ);
    group.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
  }
  const afterBox = new THREE.Box3().setFromObject(model);
  return {
    wallId: wall.id,
    targetDistanceFromWall: Number(targetDistanceMm),
    distanceBefore: beforeDistance,
    distanceAfter: getWallMountedActualDistanceFromWall(afterBox, wall, room),
    deltaWorldX: toMm(deltaWorldX),
    deltaWorldZ: toMm(deltaWorldZ)
  };
}

function getWallMountedActualDistanceFromWall(worldBox, wall, room = {}) {
  if (!worldBox || worldBox.isEmpty() || !wall?.id) return null;
  const roomWidth = meters(Number(room.width) || 0);
  const roomDepth = meters(Number(room.depth) || 0);
  if (wall.id === "back") return toMm(worldBox.min.z - (-roomDepth / 2));
  if (wall.id === "left") return toMm(worldBox.min.x - (-roomWidth / 2));
  if (wall.id === "right") return toMm(roomWidth / 2 - worldBox.max.x);
  return null;
}

function serializeVectorMm(vector) {
  return {
    x: toMm(vector.x),
    y: toMm(vector.y),
    z: toMm(vector.z)
  };
}

function serializeVector(vector) {
  return {
    x: Number(vector.x.toFixed(6)),
    y: Number(vector.y.toFixed(6)),
    z: Number(vector.z.toFixed(6))
  };
}

function serializeEulerDegrees(euler) {
  return {
    x: Number(THREE.MathUtils.radToDeg(euler.x).toFixed(3)),
    y: Number(THREE.MathUtils.radToDeg(euler.y).toFixed(3)),
    z: Number(THREE.MathUtils.radToDeg(euler.z).toFixed(3))
  };
}

function applyPlacementColor(object, componentType, frameColor, modelTransforms, seriesId = "") {
  const colorMode = modelTransforms.colorMode(componentType);
  if (colorMode === "frame") {
    const materialPatch = seriesId === "carbon-steel-post-wardrobe-v2"
      ? { metalness: 0.45, roughness: 0.32 }
      : { metalness: 0.55, roughness: 0.28 };
    applyModelColor(object, getFrameColor(frameColor), materialPatch);
    return;
  }
  if (colorMode === "wood") {
    const materialFilter = seriesId === "carbon-steel-post-wardrobe-v2"
      ? (material) => /^P(?:ly|lay)wood_01_1k$/i.test(material.name || "")
      : seriesId === "aluminum-post-wardrobe"
      ? (material) => !/^Metal_06_1k$/i.test(material.name || "")
      : seriesId === "aluminum-base-supported" && componentType === "woodShelf"
        ? (material) => !/(?:metal(?:_06)?|\[Color M07\]|灰色支撑件)/i.test(material.name || "")
      : null;
    applyModelColor(object, theme.colors.woodBrown, { metalness: 0, roughness: 0.58 }, materialFilter);
    if (seriesId === "carbon-steel-post-wardrobe-v2") {
      applyModelColor(
        object,
        getFrameColor(frameColor),
        { metalness: 0.45, roughness: 0.32 },
        (material) => /^Metal_06_1K$/i.test(material.name || "")
      );
    }
    if (seriesId === "aluminum-base-supported" && componentType === "woodShelf") {
      applyModelColor(
        object,
        getFrameColor(frameColor),
        { metalness: 0.55, roughness: 0.28 },
        (material) => /(?:metal(?:_06)?|\[Color M07\]|灰色支撑件)/i.test(material.name || "")
      );
    }
  }
}

function isWireBasketDrawerSku(sku) {
  return wireBasketDrawerSkus.has(String(sku || "").trim());
}

function applyWireBasketWhiteMaterial(object) {
  applyModelColor(
    object,
    theme.colors.white,
    { metalness: 0.25, roughness: 0.42 },
    (material) => isWireBasketMaterial(material)
  );
}

function isWireBasketMaterial(material) {
  return /(?:metal|aluminum|\[Color M07\]|Translucent Glass Safety)/i.test(material?.name || "");
}

function applyDrawerDoubleTopPanelWoodMaterial(model) {
  const topPanel = findDrawerDoubleTopPanelMesh(model);
  if (!topPanel) return;
  applyMeshMaterialColor(topPanel, theme.colors.woodBrown, { metalness: 0, roughness: 0.58 });
}

function findDrawerDoubleTopPanelMesh(model) {
  model.updateMatrixWorld(true);
  const candidates = [];
  model.traverse((child) => {
    if (!child.isMesh || child.userData?.isDrawerDoubleInsert) return;
    const box = new THREE.Box3().setFromObject(child);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 0.55 || size.z < 0.35 || size.y > 0.04) return;
    candidates.push({
      mesh: child,
      centerY: box.getCenter(new THREE.Vector3()).y,
      area: size.x * size.z
    });
  });
  candidates.sort((a, b) => b.centerY - a.centerY || b.area - a.area);
  return candidates[0]?.mesh || null;
}

function usesCarbonVisualWidthCompensation(componentType) {
  return [
    "woodShelf",
    "shoesShelf",
    "singleRail",
    "cabinet",
    "jewelryBox"
  ].includes(componentType);
}

function applyAluminumMetalMaterialColor(object, frameColor) {
  const frameColorValue = getFrameColor(frameColor);
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = materials.map((material) => {
      if (!/^Metal_06_1k$/i.test(material.name || "")) return material;
      const next = material.clone();
      if (next.color) next.color.set(frameColorValue);
      return next;
    });
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
}

function getFrameColor(frameColor) {
  return frameColor === "Black" ? theme.colors.black : theme.colors.silverGrey;
}

function applyModelColor(object, color, materialPatch = {}, materialFilter = null) {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = materials.map((material) => {
      if (materialFilter && !materialFilter(material)) return material;
      const next = material.clone();
      if (next.color) next.color.set(color);
      if ("metalness" in next && materialPatch.metalness !== undefined) next.metalness = materialPatch.metalness;
      if ("roughness" in next && materialPatch.roughness !== undefined) next.roughness = materialPatch.roughness;
      return next;
    });
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
}

function applyMeshMaterialColor(mesh, color, materialPatch = {}) {
  if (!mesh?.isMesh || !mesh.material) return;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const nextMaterials = materials.map((material) => {
    const next = material.clone();
    if (next.color) next.color.set(color);
    if ("metalness" in next && materialPatch.metalness !== undefined) next.metalness = materialPatch.metalness;
    if ("roughness" in next && materialPatch.roughness !== undefined) next.roughness = materialPatch.roughness;
    return next;
  });
  mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
}

function applyComponentRotation(object, transform) {
  const [x, y, z] = transform.rotation || [0, 0, 0];
  object.rotation.set(x, y, z);
  object.updateMatrixWorld(true);
}

function serializeBox(box3) {
  if (box3.isEmpty()) return null;
  const size = box3.getSize(new THREE.Vector3());
  const center = box3.getCenter(new THREE.Vector3());
  const vec = (value) => ({
    x: toMm(value.x),
    y: toMm(value.y),
    z: toMm(value.z)
  });
  return {
    min: vec(box3.min),
    max: vec(box3.max),
    center: vec(center),
    size: vec(size)
  };
}

function fitObjectToBox(object, targetSize, transform) {
  const box3 = new THREE.Box3().setFromObject(object);
  const size = box3.getSize(new THREE.Vector3());
  if (!size.x || !size.y || !size.z) return;
  const resizeMode = transform.resizeMode || "centerInBay";
  const scaleAxis = transform.scaleAxis || "x";

  if (resizeMode === "stretchXYZ") {
    object.scale.set(
      object.scale.x * (targetSize.x / size.x),
      object.scale.y * (targetSize.y / size.y),
      object.scale.z * (targetSize.z / size.z)
    );
  } else if (resizeMode === "stretchHeightOnly") {
    object.scale.y *= targetSize.y / size.y;
  } else if (resizeMode === "stretchWidthAndDepth") {
    const depthScale = targetSize.z / size.z;
    object.scale.set(
      object.scale.x * (targetSize.x / size.x),
      object.scale.y * depthScale,
      object.scale.z * depthScale
    );
  } else if (resizeMode === "stretchWidthOnly") {
    const scaleByAxis = {
      x: object.scale.x,
      y: object.scale.y,
      z: object.scale.z
    };
    scaleByAxis[scaleAxis] *= targetSize.x / size[scaleAxis];
    object.scale.set(scaleByAxis.x, scaleByAxis.y, scaleByAxis.z);
  } else if (resizeMode === "stretchWidthFixedDepth") {
    object.scale.set(
      object.scale.x * (targetSize.x / size.x),
      object.scale.y,
      object.scale.z * (targetSize.z / size.z)
    );
  } else if (resizeMode === "stretchToBay") {
    const scaleByAxis = {
      x: object.scale.x,
      y: object.scale.y,
      z: object.scale.z
    };
    scaleByAxis[scaleAxis] *= targetSize.x / size[scaleAxis];
    const crossAxes = ["x", "y", "z"].filter((axis) => axis !== scaleAxis);
    const crossSectionScale = Math.min(targetSize.y / size[crossAxes[0]], targetSize.z / size[crossAxes[1]]);
    scaleByAxis[crossAxes[0]] *= crossSectionScale;
    scaleByAxis[crossAxes[1]] *= crossSectionScale;
    object.scale.set(scaleByAxis.x, scaleByAxis.y, scaleByAxis.z);
  } else {
    const scale = Math.min(targetSize.x / size.x, targetSize.y / size.y, targetSize.z / size.z);
    object.scale.multiplyScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());
  const bottom = scaledBox.min.y;
  if (transform.alignMode === "originToBayCenter") {
    object.position.y -= bottom;
  } else {
    object.position.sub(new THREE.Vector3(center.x, bottom, center.z));
  }
}

function createMissingModelLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  context.fillStyle = theme.colors.dangerBg;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = theme.colors.danger;
  context.lineWidth = 12;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = theme.colors.dangerText;
  context.font = "bold 48px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.2), material);
  mesh.name = "Missing Model";
  return mesh;
}

function box(width, height, depth, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}
