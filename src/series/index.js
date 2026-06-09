import { japaneseClosetSeriesConfig } from "./japanese-closet/series.config.js";
import { japaneseClosetBomCalculator } from "./japanese-closet/bomCalculator.js";
import { japaneseClosetCuttingRules } from "./japanese-closet/cuttingRules.js";
import { japaneseClosetModelTransforms } from "./japanese-closet/modelTransforms.js";
import { japaneseClosetDisplayRules } from "./japanese-closet/displayRules.js";
import { baseSupportClosetSeriesConfig } from "./base-support-closet/series.config.js";
import { aluminumPostWardrobeSeriesConfig } from "./aluminum-post-wardrobe/series.config.js";
import { aluminumPostWardrobeBomCalculator } from "./aluminum-post-wardrobe/bomCalculator.js";
import {
  aluminumPostWardrobeCuttingRules,
  createAluminumPostWardrobeCuttingRules
} from "./aluminum-post-wardrobe/cuttingRules.js";
import { aluminumPostWardrobeModelTransforms } from "./aluminum-post-wardrobe/modelTransforms.js";
import { aluminumPostWardrobeDisplayRules } from "./aluminum-post-wardrobe/displayRules.js";

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
