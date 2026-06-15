import { japaneseClosetSeriesConfig } from "./japanese-closet/series.config.js";
import { japaneseClosetBomCalculator } from "./japanese-closet/bomCalculator.js";
import { japaneseClosetCuttingRules } from "./japanese-closet/cuttingRules.js";
import { japaneseClosetModelTransforms } from "./japanese-closet/modelTransforms.js";
import { japaneseClosetDisplayRules } from "./japanese-closet/displayRules.js";
import { baseSupportClosetSeriesConfig } from "./base-support-closet/series.config.js";
import { aluminumPostWardrobeSeriesConfig } from "./aluminum-post-wardrobe/series.config.js";
import { aluminumPostWardrobeBomCalculator } from "./aluminum-post-wardrobe/bomCalculator.js?v=led-quantity-20260611-02";
import {
  aluminumPostWardrobeCuttingRules,
  createAluminumPostWardrobeCuttingRules
} from "./aluminum-post-wardrobe/cuttingRules.js?v=l-side-inset-20260611-01";
import { aluminumPostWardrobeModelTransforms } from "./aluminum-post-wardrobe/modelTransforms.js?v=rail-width-only-20260610-01";
import { aluminumPostWardrobeDisplayRules } from "./aluminum-post-wardrobe/displayRules.js";
import { carbonSteelPostWardrobeV2SeriesConfig } from "./carbon-steel-post-wardrobe-v2/series.config.js?v=carbon-v2-visual-position-20260611-02";
import { carbonSteelPostWardrobeV2BomCalculator } from "./carbon-steel-post-wardrobe-v2/bomCalculator.js?v=carbon-v2-visual-position-20260611-02";
import {
  carbonSteelPostWardrobeV2CuttingRules,
  createCarbonSteelPostWardrobeV2CuttingRules
} from "./carbon-steel-post-wardrobe-v2/cuttingRules.js?v=carbon-v2-visual-position-20260611-02";
import { carbonSteelPostWardrobeV2ModelTransforms } from "./carbon-steel-post-wardrobe-v2/modelTransforms.js";
import { carbonSteelPostWardrobeV2DisplayRules } from "./carbon-steel-post-wardrobe-v2/displayRules.js";
import { aluminumBaseSupportedSeriesConfig } from "./aluminum-base-supported/series.config.js?v=hide-shelf-depth-ui-20260612-01";
import { aluminumBaseSupportedBomCalculator } from "./aluminum-base-supported/bomCalculator.js?v=side-middle-posts-20260612-01";
import {
  aluminumBaseSupportedCuttingRules,
  createAluminumBaseSupportedCuttingRules
} from "./aluminum-base-supported/cuttingRules.js";
import { aluminumBaseSupportedModelTransforms } from "./aluminum-base-supported/modelTransforms.js?v=wood-shelf-board-extension-20260613-01";
import {
  aluminumBaseSupportedDisplayRules,
  createAluminumBaseSupportedDisplayRules
} from "./aluminum-base-supported/displayRules.js";
import { wallMountedV2SeriesConfig } from "./wall-mounted-v2/series.config.js?v=storage-library-types-20260615-01";
import { wallMountedV2BomCalculator } from "./wall-mounted-v2/bomCalculator.js?v=system-layout-rules-20260615-03";
import {
  wallMountedV2CuttingRules,
  createWallMountedV2CuttingRules
} from "./wall-mounted-v2/cuttingRules.js?v=side-first-back-clearance-20260615-01";
import { wallMountedV2ModelTransforms } from "./wall-mounted-v2/modelTransforms.js?v=component-width-20260615-01";
import {
  wallMountedV2DisplayRules,
  createWallMountedV2DisplayRules
} from "./wall-mounted-v2/displayRules.js?v=storage-library-types-20260615-01";

const seriesRegistry = new Map([
  [
    japaneseClosetSeriesConfig.seriesId,
    {
      config: japaneseClosetSeriesConfig,
      bomCalculator: japaneseClosetBomCalculator,
      cuttingRules: japaneseClosetCuttingRules,
      modelTransforms: japaneseClosetModelTransforms,
      displayRules: japaneseClosetDisplayRules
    }
  ],
  [
    aluminumPostWardrobeSeriesConfig.seriesId,
    {
      config: aluminumPostWardrobeSeriesConfig,
      bomCalculator: aluminumPostWardrobeBomCalculator,
      cuttingRules: aluminumPostWardrobeCuttingRules,
      createCuttingRules: createAluminumPostWardrobeCuttingRules,
      modelTransforms: aluminumPostWardrobeModelTransforms,
      displayRules: aluminumPostWardrobeDisplayRules
    }
  ],
  [
    carbonSteelPostWardrobeV2SeriesConfig.seriesId,
    {
      config: carbonSteelPostWardrobeV2SeriesConfig,
      bomCalculator: carbonSteelPostWardrobeV2BomCalculator,
      cuttingRules: carbonSteelPostWardrobeV2CuttingRules,
      createCuttingRules: createCarbonSteelPostWardrobeV2CuttingRules,
      modelTransforms: carbonSteelPostWardrobeV2ModelTransforms,
      displayRules: carbonSteelPostWardrobeV2DisplayRules
    }
  ],
  [
    baseSupportClosetSeriesConfig.seriesId,
    {
      config: baseSupportClosetSeriesConfig,
      bomCalculator: null,
      cuttingRules: null,
      modelTransforms: null,
      displayRules: null
    }
  ],
  [
    aluminumBaseSupportedSeriesConfig.seriesId,
    {
      config: aluminumBaseSupportedSeriesConfig,
      bomCalculator: aluminumBaseSupportedBomCalculator,
      cuttingRules: aluminumBaseSupportedCuttingRules,
      createCuttingRules: createAluminumBaseSupportedCuttingRules,
      modelTransforms: aluminumBaseSupportedModelTransforms,
      displayRules: aluminumBaseSupportedDisplayRules,
      createDisplayRules: createAluminumBaseSupportedDisplayRules
    }
  ],
  [
    wallMountedV2SeriesConfig.seriesId,
    {
      config: wallMountedV2SeriesConfig,
      bomCalculator: wallMountedV2BomCalculator,
      cuttingRules: wallMountedV2CuttingRules,
      createCuttingRules: createWallMountedV2CuttingRules,
      modelTransforms: wallMountedV2ModelTransforms,
      displayRules: wallMountedV2DisplayRules,
      createDisplayRules: createWallMountedV2DisplayRules
    }
  ]
]);

export function getSeriesConfig(seriesId) {
  return seriesRegistry.get(seriesId)?.config || null;
}

export function getBomCalculator(seriesId) {
  return seriesRegistry.get(seriesId)?.bomCalculator || null;
}

export function getCuttingRules(seriesId, data = null) {
  const entry = seriesRegistry.get(seriesId);
  if (!entry) return null;
  return data && entry.createCuttingRules
    ? entry.createCuttingRules(data)
    : entry.cuttingRules || null;
}

export function getModelTransforms(seriesId) {
  return seriesRegistry.get(seriesId)?.modelTransforms || null;
}

export function getDisplayRules(seriesId, data = null) {
  const entry = seriesRegistry.get(seriesId);
  if (!entry) return null;
  return data && entry.createDisplayRules
    ? entry.createDisplayRules(data)
    : entry.displayRules || null;
}

export function getEnabledSeriesConfigs() {
  return Array.from(seriesRegistry.values())
    .map((entry) => entry.config)
    .filter((config) => config.enabled !== false);
}
