import { japaneseClosetSeriesConfig } from "./japanese-closet/series.config.js?v=cache-20260621-02";
import { japaneseClosetBomCalculator } from "./japanese-closet/bomCalculator.js?v=cache-20260621-02";
import { japaneseClosetCuttingRules } from "./japanese-closet/cuttingRules.js?v=japanese-post-accessories-20260730-01";
import { japaneseClosetModelTransforms } from "./japanese-closet/modelTransforms.js?v=japanese-post-side-mount-20260730-02";
import { japaneseClosetDisplayRules } from "./japanese-closet/displayRules.js?v=cache-20260621-02";
import { baseSupportClosetSeriesConfig } from "./base-support-closet/series.config.js?v=cache-20260621-02";
import { aluminumPostWardrobeSeriesConfig } from "./aluminum-post-wardrobe/series.config.js?v=cache-20260621-02";
import { aluminumPostWardrobeBomCalculator } from "./aluminum-post-wardrobe/bomCalculator.js?v=cache-20260621-02";
import {
  aluminumPostWardrobeCuttingRules,
  createAluminumPostWardrobeCuttingRules
} from "./aluminum-post-wardrobe/cuttingRules.js?v=cache-20260621-02";
import { aluminumPostWardrobeModelTransforms } from "./aluminum-post-wardrobe/modelTransforms.js?v=cache-20260621-02";
import { aluminumPostWardrobeDisplayRules } from "./aluminum-post-wardrobe/displayRules.js?v=cache-20260621-02";
import { carbonSteelPostWardrobeV2SeriesConfig } from "./carbon-steel-post-wardrobe-v2/series.config.js?v=cache-20260621-02";
import { carbonSteelPostWardrobeV2BomCalculator } from "./carbon-steel-post-wardrobe-v2/bomCalculator.js?v=cache-20260621-02";
import {
  carbonSteelPostWardrobeV2CuttingRules,
  createCarbonSteelPostWardrobeV2CuttingRules
} from "./carbon-steel-post-wardrobe-v2/cuttingRules.js?v=cache-20260621-02";
import { carbonSteelPostWardrobeV2ModelTransforms } from "./carbon-steel-post-wardrobe-v2/modelTransforms.js?v=cache-20260621-02";
import { carbonSteelPostWardrobeV2DisplayRules } from "./carbon-steel-post-wardrobe-v2/displayRules.js?v=cache-20260621-02";
import { aluminumBaseSupportedSeriesConfig } from "./aluminum-base-supported/series.config.js?v=cache-20260621-02";
import { aluminumBaseSupportedBomCalculator } from "./aluminum-base-supported/bomCalculator.js?v=cache-20260621-02";
import {
  aluminumBaseSupportedCuttingRules,
  createAluminumBaseSupportedCuttingRules
} from "./aluminum-base-supported/cuttingRules.js?v=cache-20260621-02";
import { aluminumBaseSupportedModelTransforms } from "./aluminum-base-supported/modelTransforms.js?v=cache-20260621-02";
import {
  aluminumBaseSupportedDisplayRules,
  createAluminumBaseSupportedDisplayRules
} from "./aluminum-base-supported/displayRules.js?v=cache-20260621-02";
import { wallMountedV2SeriesConfig } from "./wall-mounted-v2/series.config.js?v=cache-20260621-02";
import { wallMountedV2BomCalculator } from "./wall-mounted-v2/bomCalculator.js?v=cache-20260621-02";
import {
  wallMountedV2CuttingRules,
  createWallMountedV2CuttingRules
} from "./wall-mounted-v2/cuttingRules.js?v=cache-20260621-02";
import { wallMountedV2ModelTransforms } from "./wall-mounted-v2/modelTransforms.js?v=cache-20260621-02";
import {
  wallMountedV2DisplayRules,
  createWallMountedV2DisplayRules
} from "./wall-mounted-v2/displayRules.js?v=cache-20260621-02";

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
