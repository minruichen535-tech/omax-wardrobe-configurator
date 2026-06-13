const typeAliases = {
  shelf: "woodShelf",
  rail: "singleRail",
  "trouserRack/jewelryBox": "mixedStorage"
};

export const aluminumBaseSupportedSeriesConfig = {
  seriesId: "aluminum-base-supported",
  name: "铝合金底座支撑衣帽间",
  enabled: true,
  productsPath: "products/Aluminum-Base-Supported/Aluminum-Base-Supported.xlsx",
  rulesPath: "products/Aluminum-Base-Supported/Aluminum-Base-Supported.xlsx",
  brandPath: "brand/brand.json",
  logoPath: "brand/logo.png",
  clientBrandPath: "brand/client/brand.json",
  clientLogoPath: "brand/client-logo.png",
  assetRoot: "products/Aluminum-Base-Supported",
  imagePath: "products/Aluminum-Base-Supported/images",
  modelPath: "products/Aluminum-Base-Supported/models",
  suSourcePath: "",
  supportsLibraryClick: true,
  supportsPlacementBayControls: true,
  supportsLed: true,
  usesProductPostHeight: true,
  hideShelfDepthControl: true,
  fixedShelfDepth: 500,
  fixedFrameColor: "Black",
  fixedConfigColor: "black",

  resolvePostHeight({ productByType }) {
    const height = Number(productByType.post?.heightRule);
    return Number.isFinite(height) && height > 0 ? height : null;
  },

  resolveShelfDepth() {
    return 500;
  },

  normalizeProduct(product) {
    const type = typeAliases[product.type] || product.type;
    const width = Number(product.widthRule);
    const modelPath = String(product.modelPath || "").trim();
    const hasModel = /\.(glb|gltf)$/i.test(modelPath);
    return {
      ...product,
      type,
      widthOptions: Number.isFinite(width) && width > 0 ? [width] : product.widthOptions,
      modelPath: hasModel ? modelPath : "",
      glbAssetPath: hasModel ? modelPath : ""
    };
  },

  normalizeRule(rule) {
    return {
      ...rule,
      parentSku: String(rule.parentSku || "").trim(),
      childSku: String(rule.childSku || "").trim(),
      condition: String(rule.condition || "").trim() || "always"
    };
  }
};
