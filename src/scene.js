import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { POST_PROFILE_WIDTH_MM, meters } from "./configurator.js";
import { resolveSeriesAsset } from "./config/productSeries.js";
import { theme } from "./config/theme.js?v=color-system-20260602-01";

const h = React.createElement;
const loader = new GLTFLoader();
const modelCache = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const sceneTransformVersion = "scene-transform-map-20260531-01";
const sceneRuntimeVersion = "woodtop-alignment-verified-20260605-01";

const componentTransformMap = {
  woodTop: { rotation: [0, Math.PI, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: -0.04, resizeMode: "stretchToBay", offsetX: 0, depthAnchor: "back", depthAnchorBaseDepth: 0.45 },
  woodShelf: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0.015, offsetZ: 0, depthAnchor: "back", depthAnchorBaseDepth: 0.45 },
  railSingle: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0.08, heightOffset: 0, resizeMode: "stretchToBay" },
  railDouble: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0.08, heightOffset: 0, resizeMode: "stretchToBay" },
  singleRail: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0 },
  doubleRail: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0 },
  cabinet: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchToBay", offsetX: 0.015 },
  jewelryBox: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "centerInBay", offsetX: 0.015 },
  trouserRack: { rotation: [0, 0, 0], scaleAxis: "x", anchor: "bottomCenter", depthOffset: 0, heightOffset: 0, resizeMode: "stretchWidthAndDepth", offsetX: 0 }
};

console.log("[scene.js]", sceneTransformVersion);

export function WardrobeScene({ config, design, series, debug = false, selectedId = "", onDropComponent, onSelectPlacement }) {
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
    scene.background = new THREE.Color(theme.colors.subtle);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(4.8, 3.5, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.25, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb7aa9d, 2.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 6, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

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
      const componentType = event.dataTransfer.getData("text/plain");
      if (!componentType) return;
      const bay = pickSceneObject(event, (userData) => userData.isBayDropTarget) || pickNearestBayTarget(event, scene, camera, renderer.domElement);
      if (bay?.userData) {
        callbacksRef.current.onDropComponent?.(bay.userData.wallId, bay.userData.bayIndex, componentType);
      }
    };

    const handleClick = (event) => {
      const placement = pickSceneObject(event, (userData) => userData.placementId);
      if (placement?.userData?.placementId) {
        callbacksRef.current.onSelectPlacement?.(placement.userData.placementId);
      }
    };

    renderer.domElement.addEventListener("dragover", handleDragOver);
    renderer.domElement.addEventListener("drop", handleDrop);
    renderer.domElement.addEventListener("click", handleClick);

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
      renderer.domElement.removeEventListener("dragover", handleDragOver);
      renderer.domElement.removeEventListener("drop", handleDrop);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;
    rebuildScene(sceneRef.current.scene, config, design, series, debug, selectedId, renderIdRef, () => {
      sceneRef.current?.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
    });
  }, [config, design, series, debug, selectedId]);

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

async function rebuildScene(scene, config, design, series, debug, selectedId, renderIdRef, requestRender) {
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
    woodTopDiagnostics: [],
    postCoordinates: [],
    bayCoordinates: [],
    geometryPlaceholders: ["room-floor", "room-walls"]
  };
  publishModelReport(report, "loading");

  const roomWidth = meters(design.room.width);
  const roomDepth = meters(design.room.depth);
  const roomHeight = meters(design.room.height);
  const postHeight = meters(design.postHeight || design.room.height);
  addRoom(root, roomWidth, roomDepth, roomHeight);
  await Promise.all(design.activeWalls.map((wall) => addWallRun(root, wall, roomWidth, roomDepth, roomHeight, postHeight, config, design, series, report, debug, selectedId)));
  if (!scene.getObjectByName("design-root") || root.parent !== scene) return;
  publishModelReport(report, "ready");
  requestRender?.();
}

function publishModelReport(report, status) {
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
    woodTopDiagnostics: report.woodTopDiagnostics,
    sceneJsImportUrl: import.meta.url,
    sceneTransformVersion,
    sceneRuntimeVersion,
    postCoordinates: report.postCoordinates,
    bayCoordinates: report.bayCoordinates,
    geometryPlaceholders: report.geometryPlaceholders
  };
  window.__modelLoadReport = payload;
  document.documentElement.setAttribute("data-model-report", JSON.stringify(payload));
}

function addRoom(root, width, depth, height) {
  const floorMat = new THREE.MeshStandardMaterial({ color: theme.colors.border, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.colors.background, roughness: 0.9, transparent: true, opacity: 0.82 });
  const wallThickness = 0.04;

  const floor = box(width, wallThickness, depth, floorMat);
  floor.position.set(0, -wallThickness / 2, 0);
  floor.receiveShadow = true;
  root.add(floor);

  const backWall = box(width, height, wallThickness, wallMat);
  backWall.position.set(0, height / 2, -depth / 2);
  root.add(backWall);

  const leftWall = box(wallThickness, height, depth, wallMat);
  leftWall.position.set(-width / 2 - wallThickness / 2, height / 2, 0);
  root.add(leftWall);

  const rightWall = box(wallThickness, height, depth, wallMat);
  rightWall.position.set(width / 2 + wallThickness / 2, height / 2, 0);
  root.add(rightWall);

  const grid = new THREE.GridHelper(Math.max(width, depth), 12, theme.colors.walnut, theme.colors.divider);
  grid.position.y = 0.03;
  root.add(grid);
}

async function addWallRun(root, wall, roomWidth, roomDepth, roomHeight, postHeight, config, design, series, report, debug, selectedId) {
  const group = new THREE.Group();
  const length = meters(wall.length);
  const shelfDepth = meters(Number(config.shelfDepth) || 450);
  const dropTargetDepth = 0.5;
  const wallOffset = meters(Number(config.wallOffset) || 250);
  const sideCenterZ = meters(Number(wall.startOffset) || 0) / 2;

  if (wall.id === "back") group.position.set(0, 0, -roomDepth / 2 + wallOffset);
  if (wall.id === "left") {
    group.rotation.y = Math.PI / 2;
    group.position.set(-roomWidth / 2 + wallOffset, 0, sideCenterZ);
  }
  if (wall.id === "right") {
    group.rotation.y = -Math.PI / 2;
    group.position.set(roomWidth / 2 - wallOffset, 0, sideCenterZ);
  }
  report.runtimeDebug.push({
    wallId: wall.id,
    sceneRuntimeVersion,
    sceneJsImportUrl: import.meta.url,
    sidePostInset: null,
    sidePostInsetMeters: null,
    wallOffset: toMm(wallOffset),
    wallOffsetMeters: wallOffset,
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
  const postPositions = (wall.posts?.length ? wall.posts : Array.from({ length: wall.bayCount + 1 }, (_, index) => ({
    index,
    x: (wall.length / wall.bayCount) * index
  }))).map((post) => ({
    index: post.index,
    x: startX + meters(post.x)
  }));
  const postProduct = design.productByType.post;
  const postTargetSize = { x: meters(POST_PROFILE_WIDTH_MM), y: postHeight, z: 0.1 };
  const isBackWall = wall.id === "back";
  const postEndVisualInset = meters(25);
  for (const postPosition of postPositions) {
    const post = await createModelOrMissing(postProduct, series, report, postTargetSize, "绔嬫煴", getComponentTransform("post"), "post");
    if (wall.id === "right") {
      post.rotation.y += Math.PI;
    }
    applyPostColor(post, config.frameColor);
    const visualPostX = getVisualPostX(postPosition, postPositions.length, isBackWall, postEndVisualInset);
    post.position.set(visualPostX, 0, 0);
    post.userData = { ...post.userData, wallId: wall.id, postIndex: postPosition.index };
    group.add(post);
    const world = localToWorld(group, postPosition.x, 0, 0);
    const visualWorld = localToWorld(group, visualPostX, 0, 0);
    report.postCoordinates.push({
      wallId: wall.id,
      axis: wallAxis,
      postIndex: postPosition.index,
      localX: toMm(postPosition.x),
      visualLocalX: toMm(visualPostX),
      worldX: toMm(world.x),
      worldY: toMm(world.y),
      worldZ: toMm(world.z),
      visualWorldX: toMm(visualWorld.x),
      visualWorldY: toMm(visualWorld.y),
      visualWorldZ: toMm(visualWorld.z)
    });
    if (debug) {
      group.add(createTextSprite(`P${postPosition.index}`, theme.colors.text, postPosition.x, postHeight + 0.12, 0));
    }
  }

  postPositions.slice(0, -1).forEach((_, bayIndex) => {
    const bay = getBayGeometry(postPositions, bayIndex);
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

  await Promise.all(design.placements
    .filter((placement) => placement.wallId === wall.id)
    .map(async (placement) => {
      const bay = getBayGeometry(postPositions, placement.bayIndex);
      if (!bay) {
        report.failed.add(`${wall.id}:${placement.bayIndex}`);
        report.missingPlacements.push({
          name: placement.componentType,
          reason: `Invalid bayIndex ${placement.bayIndex} for ${wall.id}`
        });
        return;
      }
      report.bayPlacements.push({
        placementId: placement.id,
        wallId: wall.id,
        axis: wallAxis,
        bayIndex: Number(placement.bayIndex),
        leftPostX: toMm(bay.leftX),
        rightPostX: toMm(bay.rightX),
        postCenterDistance: toMm(bay.postCenterDistance),
        postProfileWidth: toMm(bay.postProfileWidth),
        bayCenterX: toMm(bay.centerX),
        rawBayWidth: toMm(bay.rawBayWidth),
        innerBayWidth: toMm(bay.innerBayWidth),
        componentCutLength: placement.componentCutLength,
        visualScaleWidth: placement.visualScaleWidth
      });
      await addPlacement(group, placement, bay.centerX, meters(placement.visualScaleWidth || bay.innerBayWidth), shelfDepth, config, design, series, report, debug, selectedId, wall);
    }));

  group.updateMatrixWorld(true);
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

function getBayGeometry(postPositions, bayIndex) {
  const index = Number(bayIndex);
  const leftPost = postPositions[index];
  const rightPost = postPositions[index + 1];
  if (!leftPost || !rightPost) return null;
  const rawBayWidth = Math.abs(rightPost.x - leftPost.x);
  const postProfileWidth = meters(POST_PROFILE_WIDTH_MM);
  const innerBayWidth = Math.max(0.05, rawBayWidth - postProfileWidth);
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

async function addPlacement(group, placement, x, bayWidth, depth, config, design, series, report, debug, selectedId, wall = null) {
  const y = meters(placement.heightFromFloor);
  const product = design.productByType[placement.componentType];
  const name = product?.nameCn || placement.componentType;
  const transform = getComponentTransform(placement.componentType, report);
  const model = await createModelOrMissing(product, series, report, getTargetSize(placement.componentType, bayWidth, depth), name, transform, placement.componentType);
  applyPlacementColor(model, placement.componentType, config.frameColor);
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
    const railLateralVisualOffset = 0.008;
    if (wall?.id === "back") {
      model.position.z -= 0.05;
      model.position.x += railLateralVisualOffset;
    }
    if (wall?.id === "left") {
      model.position.z -= 0.05;
      model.position.x += railLateralVisualOffset;
    }
    if (wall?.id === "right") {
      model.position.z += 0.05;
      model.position.x -= railLateralVisualOffset;
    }
  }
  if (placement.componentType === "trouserRack" || placement.componentType === "jewelryBox") {
    const fixedModuleLateralVisualOffset = 0.015;
    if (wall?.id === "back" || wall?.id === "left") {
      model.position.x += fixedModuleLateralVisualOffset;
    }
    if (wall?.id === "right") {
      model.position.x -= fixedModuleLateralVisualOffset;
    }
  }
  const actualWidth = getObjectWidth(model);
  model.userData = {
    ...model.userData,
    isPlacementModel: true,
    placementId: placement.id,
    wallId: placement.wallId,
    bayIndex: placement.bayIndex,
    bayCenterX: x,
    bayWidth,
    actualWidth,
    resizeMode: transform.resizeMode,
    scaleAxis: transform.scaleAxis,
    alignMode: transform.alignMode,
    offsetX: transform.offsetX || 0,
    offsetZ: transform.offsetZ || 0,
    anchor: transform.anchor
  };
  report.componentDimensions.push({
    placementId: placement.id,
    componentType: placement.componentType,
    postCenterDistance: placement.postCenterDistance,
    postProfileWidth: placement.postProfileWidth,
    innerBayWidth: placement.innerBayWidth,
    componentCutLength: placement.componentCutLength,
    visualScaleWidth: placement.visualScaleWidth,
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
    finalBoundingBoxCenter: serializeBox(new THREE.Box3().setFromObject(model))?.center,
    offsetX: transform.offsetX || 0,
    offsetZ: transform.offsetZ || 0,
    bayCenter: toMm(x)
  });
  if (debug && placement.id === selectedId) {
    addSelectionOutline(model);
  }
  group.add(model);
  if (placement.componentType === "woodTop") {
    group.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    const bayCenterWorld = localToWorld(group, x, 0, 0);
    let worldBox = new THREE.Box3().setFromObject(model);
    let edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    const isSideCornerWoodTop = placement.autoGenerated
      && (wall?.id === "left" || wall?.id === "right")
      && (
        (wall.id === "left" && Number(placement.bayIndex) === wall.bayCount - 1)
        || (wall.id === "right" && Number(placement.bayIndex) === 0)
      );
    const isSideOpenWoodTop = placement.autoGenerated
      && (
        (wall?.id === "left" && Number(placement.bayIndex) === 0)
        || (wall?.id === "right" && Number(placement.bayIndex) === wall.bayCount - 1)
      );
    if (!isSideCornerWoodTop && placement.autoGenerated && (edgeDiagnostic.suggestedLocalDirection === "-localX" || edgeDiagnostic.suggestedLocalDirection === "+localX")) {
      model.position.x += edgeDiagnostic.suggestedLocalDirection === "-localX" ? -0.019 : 0.019;
      group.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      worldBox = new THREE.Box3().setFromObject(model);
      edgeDiagnostic = getWoodTopEdgeDiagnostic(placement, wall, worldBox, design.room);
    }
    if (isSideCornerWoodTop) {
      const roomDepth = meters(Number(design.room?.depth) || 0);
      const wallOffset = meters(Number(config.wallOffset) || 250);
      const targetWorldZ = -roomDepth / 2 + wallOffset + depth / 2 + 0.015;
      const targetOuterEdgeWorldZ = worldBox.max.z + 0.02;
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
      const targetOpenEdgeWorldZ = worldBox.max.z + 0.02;
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
      const visibleInnerMesh = model.getObjectByName("Geom3D");
      if (visibleInnerMesh?.isMesh && visibleInnerMesh.parent) {
        const visibleBox = new THREE.Box3().setFromObject(visibleInnerMesh);
        const fixedVisibleInnerEdgeWorldZ = visibleBox.min.z;
        const visibleSpan = visibleBox.max.z - visibleBox.min.z;
        visibleInnerMesh.scale.x *= (visibleSpan + 0.006) / visibleSpan;
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
  } else if ((wall?.id === "left" && isFirstBay) || (wall?.id === "right" && isLastBay)) {
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

function getComponentTransform(componentType, report = null) {
  const transform = componentTransformMap[componentType];
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

function getTargetSize(componentType, bayWidth, shelfDepth) {
  const defaultDepth = 0.5;
  if (componentType === "woodTop" || componentType === "woodShelf") return { x: bayWidth, y: 0.08, z: shelfDepth };
  if (componentType === "singleRail" || componentType === "doubleRail") return { x: bayWidth, y: 0.16, z: 0.18 };
  if (componentType === "cabinet") return { x: bayWidth, y: 0.5, z: defaultDepth * 0.92 };
  if (componentType === "jewelryBox") return { x: bayWidth, y: 0.22, z: defaultDepth * 0.86 };
  if (componentType === "trouserRack") return { x: bayWidth, y: 0.22, z: defaultDepth * 0.86 };
  return { x: bayWidth, y: 0.3, z: defaultDepth };
}

async function createModelOrMissing(product, series, report, targetSize, label, transform = getComponentTransform(""), componentType = "") {
  const modelPath = product?.modelPath || product?.glbAssetPath || "";
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
      ? { ...transform, resizeMode: "stretchXYZ", scaleAxis: "y" }
      : transform;
    fitObjectToBox(clone, targetSize, effectiveTransform);
    const fittedBox = new THREE.Box3().setFromObject(clone);
    const transformDiagnostic = {
      componentType,
      matchedTransformKey: componentTransformMap[componentType] ? componentType : null,
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
  const url = resolveSeriesAsset(series, modelPath);
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

function applyPlacementColor(object, componentType, frameColor) {
  if (componentType === "singleRail" || componentType === "doubleRail") {
    applyModelColor(object, getFrameColor(frameColor), { metalness: 0.55, roughness: 0.28 });
    return;
  }
  if (componentType === "woodTop" || componentType === "woodShelf" || componentType === "cabinet") {
    applyModelColor(object, theme.colors.woodBrown, { metalness: 0, roughness: 0.58 });
  }
}

function getFrameColor(frameColor) {
  return frameColor === "Black" ? theme.colors.black : theme.colors.silverGrey;
}

function applyModelColor(object, color, materialPatch = {}) {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = materials.map((material) => {
      const next = material.clone();
      if (next.color) next.color.set(color);
      if ("metalness" in next && materialPatch.metalness !== undefined) next.metalness = materialPatch.metalness;
      if ("roughness" in next && materialPatch.roughness !== undefined) next.roughness = materialPatch.roughness;
      return next;
    });
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
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

function fitObjectToBox(object, targetSize, transform = getComponentTransform("")) {
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
  } else if (resizeMode === "stretchWidthAndDepth") {
    const depthScale = targetSize.z / size.z;
    object.scale.set(
      object.scale.x * (targetSize.x / size.x),
      object.scale.y * depthScale,
      object.scale.z * depthScale
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
