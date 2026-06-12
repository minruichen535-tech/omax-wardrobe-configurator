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

export function getDisplayRules(seriesId) {
  return seriesRegistry.get(seriesId)?.displayRules || null;
}

export function getEnabledSeriesConfigs() {
  return Array.from(seriesRegistry.values())
    .map((entry) => entry.config)
    .filter((config) => config.enabled !== false);
}
