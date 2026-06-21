import React from "react";
import { createRoot } from "react-dom/client";
import { calculateDesign, createConfigFromPlannerPreset, createInitialConfig } from "../configurator.js?v=cache-20260621-02";
import { loadWorkbookData } from "../dataSource.js?v=ai-planner-preview-20260617-06";
import { getSeries } from "../config/productSeries.js?v=ai-planner-preview-20260617-06";
import { WardrobeScene } from "../scene.js?v=cache-20260621-02";

const h = React.createElement;
const dataCache = new Map();

export async function mountReadOnlyWardrobePreview(container, { plan, selectedProductSystem, mode = "modal" }) {
  if (!container) return () => {};
  const seriesId = plan?.configPreset?.productSystemId || selectedProductSystem?.id;
  const series = getSeries(seriesId);
  if (!series) {
    throw new Error(`Unknown product series: ${seriesId || "empty"}`);
  }

  container.replaceChildren();
  container.classList.add("is-loading");
  container.dataset.previewMode = mode;
  container.textContent = mode === "thumbnail" ? "生成预览中..." : "正在生成真实预览...";

  const data = await getPreviewData(series);
  const preset = {
    source: "ai-planner-preview",
    configPreset: {
      ...(plan?.configPreset || {}),
      productSystemId: series.seriesId
    }
  };
  const config = createConfigFromPlannerPreset(preset, createInitialConfig(), data);
  const design = calculateDesign(config, data);

  console.log("[ai-planner] readonly-preview", {
    mode,
    seriesId: series.seriesId,
    planType: plan?.planType,
    configPreset: preset.configPreset,
    room: config.room,
    layout: config.layout,
    placements: config.placements.map((placement) => ({
      id: placement.id,
      componentType: placement.componentType,
      wallId: placement.wallId,
      bayIndex: placement.bayIndex,
      heightFromFloor: placement.heightFromFloor,
      distanceFromWall: placement.distanceFromWall,
      wallMountedOffsetPosition: placement.wallMountedOffsetPosition,
      shelfDependency: placement.shelfDependency || null,
      linkedRailDependencyId: placement.linkedRailDependencyId || null
    })),
    bomCount: design.bom.length,
    total: design.total
  });

  container.classList.remove("is-loading");
  container.replaceChildren();
  const root = createRoot(container);
  root.render(h(WardrobeScene, {
    config: {
      ...config,
      selectedPlacementId: ""
    },
    design,
    series: data.series,
    selectedId: "",
    readOnly: true,
    previewMode: "ai-planner"
  }));

  return () => {
    root.unmount();
  };
}

function getPreviewData(series) {
  if (!dataCache.has(series.seriesId)) {
    dataCache.set(series.seriesId, loadWorkbookData(series));
  }
  return dataCache.get(series.seriesId);
}
