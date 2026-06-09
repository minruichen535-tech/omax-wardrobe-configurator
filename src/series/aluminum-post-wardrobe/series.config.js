const typeAliases = {
  shelf: "woodShelf",
  rail: "singleRail"
};

export const aluminumPostWardrobeSeriesConfig = {
  seriesId: "aluminum-post-wardrobe",
  name: "铝立柱衣帽间",
  enabled: true,
  productsPath: "products/Aluminum-Post-Wardrobe/excel/products.xlsx",
  rulesPath: "products/Aluminum-Post-Wardrobe/excel/rules.xlsx",
  brandPath: "brand/brand.json",
  logoPath: "brand/logo.png",
  clientBrandPath: "brand/client/brand.json",
  clientLogoPath: "brand/client-logo.png",
  assetRoot: "products/Aluminum-Post-Wardrobe",
  imagePath: "products/Aluminum-Post-Wardrobe/images",
  modelPath: "products/Aluminum-Post-Wardrobe/models/glb",
  suSourcePath: "",
  normalizeProduct(product) {
    const componentType = typeAliases[product.type] || product.type;
    const rawModelPath = String(product.modelPath || "").trim();
    const modelPath = rawModelPath && !/\.(glb|gltf)$/i.test(rawModelPath)
      ? `${rawModelPath}.glb`
      : rawModelPath;
    const hasGlbPath = /\.(glb|gltf)$/i.test(modelPath);
    return {
      ...product,
      type: componentType,
      modelPath: hasGlbPath ? modelPath : "",
      glbAssetPath: hasGlbPath ? modelPath : ""
    };
  }
};
