const typeAliases = {
  shelf: "woodShelf",
  rail: "singleRail"
};

export const carbonSteelPostWardrobeV2SeriesConfig = {
  seriesId: "carbon-steel-post-wardrobe-v2",
  name: "碳钢立柱衣帽间",
  enabled: true,
  productsPath: "products/Carbon-Steel-Post-Wardrobe/Carbon-Steel-Post-Wardrobe.xlsx",
  rulesPath: "products/Carbon-Steel-Post-Wardrobe/Carbon-Steel-Post-Wardrobe.xlsx",
  brandPath: "brand/brand.json",
  logoPath: "brand/logo.png",
  clientBrandPath: "brand/client/brand.json",
  clientLogoPath: "brand/client-logo.png",
  assetRoot: "products/Carbon-Steel-Post-Wardrobe",
  imagePath: "products/Carbon-Steel-Post-Wardrobe/images",
  modelPath: "products/Carbon-Steel-Post-Wardrobe/models",
  suSourcePath: "",
  supportsLibraryClick: true,
  supportsPlacementBayControls: true,
  hideShelfDepthControl: true,
  fixedFrameColor: "Black",
  fixedConfigColor: "black",

  resolvePostModelPath({ connectionMode, postHeight }) {
    const family = String(connectionMode || "").trim().toLowerCase() === "wall"
      ? "TLZ-001-5"
      : "TLZ-001-1";
    const height = Number(postHeight) <= 1950 ? 1950 : 2950;
    return `${family}-${height}.glb`;
  },

  normalizeProduct(product) {
    const isShoesShelf = product.sku === "TLZ-SHOES-SHELF";
    const type = isShoesShelf ? "shoesShelf" : typeAliases[product.type] || product.type;
    const modelPath = String(product.modelPath || (isShoesShelf ? "TLZ-SHOES-SHELF.glb" : "")).trim();
    const hasModel = /\.(glb|gltf)$/i.test(modelPath);
    return {
      ...product,
      type,
      sellable: true,
      modelPath: hasModel ? modelPath : "",
      glbAssetPath: hasModel ? modelPath : ""
    };
  },

  normalizeRule(rule) {
    const parentSku = String(rule.parentSku || "").trim();
    return {
      ...rule,
      parentSku,
      parentType: parentSku.startsWith("type:")
        ? parentSku.slice("type:".length).trim()
        : "",
      childSku: String(rule.childSku || "").trim(),
      condition: String(rule.condition || "").trim() || "always"
    };
  },

  normalizeSettings(settings) {
    return {
      ...settings,
      roomHeightFixed: 3200,
      postHeightOptions: [1950, 2950],
      defaultPostHeight: 2950,
      shelfDepthOptions: [415],
      defaultShelfDepth: 415,
      fixedPostWallOffset: Number(settings.defaultWallOffset) || 415,
      hideRoomHeightInput: true
    };
  }
};
