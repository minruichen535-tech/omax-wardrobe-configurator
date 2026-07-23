import {
  DIRECT_DRAG_INTENT_THRESHOLD_PX,
  getBayDragLabel,
  isDirectPlacementDragEnabled,
  isDirectPlacementDraggable,
  resolveDirectDragHeight,
  validateDirectPlacementPatch
} from "./PlacementSnapResolver.js?v=direct-placement-drag-20260722-01";
import {
  clearBayTargetHighlight,
  setBayTargetHighlight
} from "./PlacementBayResolver.js?v=direct-placement-drag-20260722-01";

const HEIGHT_PIXELS_TO_MM = 5;

export class DirectPlacementDragController {
  constructor({
    domElement,
    controls,
    getState,
    pickPlacement,
    pickBayTarget,
    onSelectPlacement,
    onUpdatePlacement,
    onCleanupHelpers
  }) {
    this.domElement = domElement;
    this.controls = controls;
    this.getState = getState;
    this.pickPlacement = pickPlacement;
    this.pickBayTarget = pickBayTarget;
    this.onSelectPlacement = onSelectPlacement;
    this.onUpdatePlacement = onUpdatePlacement;
    this.onCleanupHelpers = onCleanupHelpers;
    this.drag = null;
    this.label = null;
    this.highlightedBay = null;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.domElement.addEventListener("pointercancel", this.handlePointerCancel);
    this.domElement.addEventListener("lostpointercapture", this.handlePointerCancel);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
    this.domElement.removeEventListener("lostpointercapture", this.handlePointerCancel);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.cleanupDrag(false);
  }

  handlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const state = this.getState?.() || {};
    if (!isDirectPlacementDragEnabled(state.series) || state.readOnly) return;
    const hit = this.pickPlacement?.(event);
    const placementId = hit?.userData?.placementId;
    const placement = (state.design?.placements || []).find((item) => item.id === placementId);
    if (!isDirectPlacementDraggable(placement, state.series)) return;

    event.preventDefault();
    event.stopPropagation();
    this.domElement.setPointerCapture?.(event.pointerId);
    if (this.controls) this.controls.enabled = false;
    this.onSelectPlacement?.(placement.id);
    this.drag = {
      pointerId: event.pointerId,
      placementId: placement.id,
      original: {
        wallId: placement.wallId,
        bayIndex: placement.bayIndex,
        heightFromFloor: Number(placement.heightFromFloor || 0)
      },
      startX: event.clientX,
      startY: event.clientY,
      mode: "",
      lastHeight: Number(placement.heightFromFloor || 0),
      targetBay: null,
      valid: true,
      reason: ""
    };
    this.updateLabel(event, `高度：${this.drag.lastHeight}mm`);
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    if (!this.drag.mode) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DIRECT_DRAG_INTENT_THRESHOLD_PX) {
        this.updateLabel(event, `高度：${this.drag.lastHeight}mm`);
        return;
      }
      this.drag.mode = Math.abs(dy) >= Math.abs(dx) ? "height" : "bay";
    }

    if (this.drag.mode === "height") {
      this.updateHeightDrag(event, dy);
      return;
    }
    this.updateBayDrag(event);
  }

  handlePointerUp(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    if (this.drag.mode === "bay" && this.drag.targetBay?.valid) {
      this.onUpdatePlacement?.(this.drag.placementId, {
        wallId: this.drag.targetBay.wallId,
        bayIndex: this.drag.targetBay.bayIndex
      });
    } else if (this.drag.mode === "bay" && this.drag.targetBay && !this.drag.targetBay.valid) {
      this.restoreOriginalPlacement();
    }
    this.cleanupDrag(true, event.pointerId);
  }

  handlePointerCancel(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.restoreOriginalPlacement();
    this.cleanupDrag(true, event.pointerId);
  }

  handleKeyDown(event) {
    if (event.key !== "Escape") return;
    if (this.drag) {
      this.restoreOriginalPlacement();
      this.cleanupDrag(true, this.drag.pointerId);
      return;
    }
    this.onCleanupHelpers?.();
  }

  updateHeightDrag(event, dy) {
    const state = this.getState?.() || {};
    const placement = (state.design?.placements || []).find((item) => item.id === this.drag.placementId);
    if (!placement) return;
    const rawHeight = this.drag.original.heightFromFloor - dy * HEIGHT_PIXELS_TO_MM;
    const result = resolveDirectDragHeight({ placement, rawHeight, design: state.design });
    if (!result.valid) {
      this.drag.valid = false;
      this.drag.reason = result.reason || "invalidHeight";
      this.updateLabel(event, "不可放置", true);
      return;
    }
    this.drag.valid = true;
    this.drag.reason = "";
    if (Number(result.heightFromFloor) !== this.drag.lastHeight) {
      this.drag.lastHeight = Number(result.heightFromFloor);
      this.onUpdatePlacement?.(this.drag.placementId, { heightFromFloor: this.drag.lastHeight });
    }
    this.updateLabel(event, `高度：${this.drag.lastHeight}mm`);
  }

  updateBayDrag(event) {
    const state = this.getState?.() || {};
    const placement = (state.design?.placements || []).find((item) => item.id === this.drag.placementId);
    if (!placement) return;
    const bayTarget = this.pickBayTarget?.(event);
    if (bayTarget !== this.highlightedBay) {
      clearBayTargetHighlight(this.highlightedBay);
      this.highlightedBay = bayTarget || null;
    }
    if (!bayTarget?.userData) {
      this.drag.targetBay = null;
      this.updateLabel(event, "不可放置", true);
      return;
    }
    const wallId = bayTarget.userData.wallId;
    const bayIndex = Number(bayTarget.userData.bayIndex);
    const validation = validateDirectPlacementPatch({
      placement,
      design: state.design,
      targetWallId: wallId,
      targetBayIndex: bayIndex
    });
    this.drag.targetBay = { wallId, bayIndex, valid: validation.valid, reason: validation.reason || "" };
    setBayTargetHighlight(bayTarget, validation.valid ? "valid" : "invalid");
    this.updateLabel(event, validation.valid ? getBayDragLabel(wallId, bayIndex) : "不可放置", !validation.valid);
  }

  restoreOriginalPlacement() {
    if (!this.drag) return;
    this.onUpdatePlacement?.(this.drag.placementId, { ...this.drag.original });
  }

  updateLabel(event, text, invalid = false) {
    if (!this.label) {
      this.label = document.createElement("div");
      this.label.className = "direct-placement-drag-label";
      this.domElement.parentElement?.appendChild(this.label);
    }
    const rect = this.domElement.parentElement?.getBoundingClientRect() || this.domElement.getBoundingClientRect();
    this.label.textContent = text;
    this.label.classList.toggle("invalid", invalid);
    this.label.style.left = `${event.clientX - rect.left + 14}px`;
    this.label.style.top = `${event.clientY - rect.top - 34}px`;
  }

  cleanupDrag(releasePointer = true, pointerId = null) {
    clearBayTargetHighlight(this.highlightedBay);
    this.highlightedBay = null;
    if (this.label?.parentElement) this.label.parentElement.removeChild(this.label);
    this.label = null;
    this.onCleanupHelpers?.();
    if (this.controls) this.controls.enabled = true;
    if (releasePointer && pointerId != null) {
      try {
        this.domElement.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }
    this.drag = null;
  }
}
