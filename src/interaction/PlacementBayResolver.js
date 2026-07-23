import * as THREE from "three";

export function pickNearestBayTarget(event, root, camera, domElement) {
  if (!root || !camera || !domElement) return null;
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

export function setBayTargetHighlight(target, state) {
  if (!target?.material) return;
  target.material.colorWrite = true;
  target.material.opacity = state === "invalid" ? 0.16 : 0.11;
  target.material.depthWrite = false;
  target.material.needsUpdate = true;
}

export function clearBayTargetHighlight(target) {
  if (!target?.material) return;
  target.material.opacity = 0;
  target.material.colorWrite = false;
  target.material.needsUpdate = true;
}
