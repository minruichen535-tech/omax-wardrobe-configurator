import { getSeriesConfig } from "../series/index.js?v=u-asymmetric-side-walls-20260613-01";

const japaneseClosetConfig = getSeriesConfig("japanese-closet");
const aluminumPostWardrobeConfig = getSeriesConfig("aluminum-post-wardrobe");
const carbonSteelPostWardrobeV2Config = getSeriesConfig("carbon-steel-post-wardrobe-v2");
const aluminumBaseSupportedConfig = getSeriesConfig("aluminum-base-supported");

export const productSeries = {
  "open-closet": {
    seriesId: "open-closet",
    name: "开放式衣帽间",
    productPath: "products/open-closet/excel/products.xlsx",
    rulesPath: "products/open-closet/excel/rules.xlsx",
    assetRoot: "products/open-closet",
    imageRoot: "products/open-closet/images",
    modelRoot: "products/open-closet/models/glb",
    suSourcePath: "products/open-closet/su"
  },
  "new-system": {
    seriesId: "new-system",
    name: "新系统衣帽间",
    productPath: "products/new-system/excel/products.xlsx",
    rulesPath: "products/new-system/excel/rules.xlsx",
    assetRoot: "products/new-system",
    imageRoot: "products/new-system/images",
    modelRoot: "products/new-system/models/glb",
    suSourcePath: "products/new-system/su"
  },
  "wall-mounted": {
    seriesId: "wall-mounted",
    name: "壁挂式衣帽间",
    productPath: "products/wall-mounted/excel/products.xlsx",
    rulesPath: "products/wall-mounted/excel/rules.xlsx",
    assetRoot: "products/wall-mounted",
    imageRoot: "products/wall-mounted/images",
    modelRoot: "products/wall-mounted/models/glb",
    suSourcePath: "products/wall-mounted/su"
  },
  "japanese-closet": {
    ...japaneseClosetConfig,
    productPath: japaneseClosetConfig.productsPath,
    imageRoot: japaneseClosetConfig.imagePath,
    modelRoot: japaneseClosetConfig.modelPath
  },
  "aluminum-post-wardrobe": {
    ...aluminumPostWardrobeConfig,
    productPath: aluminumPostWardrobeConfig.productsPath,
    imageRoot: aluminumPostWardrobeConfig.imagePath,
    modelRoot: aluminumPostWardrobeConfig.modelPath
  },
  "carbon-steel-post-wardrobe-v2": {
    ...carbonSteelPostWardrobeV2Config,
    productPath: carbonSteelPostWardrobeV2Config.productsPath,
    imageRoot: carbonSteelPostWardrobeV2Config.imagePath,
    modelRoot: carbonSteelPostWardrobeV2Config.modelPath
  },
  "aluminum-base-supported": {
    ...aluminumBaseSupportedConfig,
    productPath: aluminumBaseSupportedConfig.productsPath,
    imageRoot: aluminumBaseSupportedConfig.imagePath,
    modelRoot: aluminumBaseSupportedConfig.modelPath
  }
};

export const defaultSeriesId = "open-closet";

export function getSeries(seriesId = defaultSeriesId) {
  return productSeries[seriesId] || null;
}

export function resolveRoute(pathname = window.location.pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const route = segments[0] === "admin" ? "admin" : "configurator";
  const seriesId = segments[1] || defaultSeriesId;
  return { route, seriesId, series: getSeries(seriesId) };
}

export function resolveSeriesAsset(series, assetPath) {
  if (!assetPath) return "";
  if (/^(data:|https?:\/\/|\/)/i.test(assetPath)) return assetPath;
  const normalized = assetPath.replace(/^\.?\//, "");
  if (normalized.startsWith("products/")) return `/${normalized}`;
  if (/^[^/\\]+\.(glb|gltf)$/i.test(normalized) && series.modelRoot) {
    return `/${series.modelRoot}/${normalized}`;
  }
  return `/${series.assetRoot}/${normalized}`;
}
