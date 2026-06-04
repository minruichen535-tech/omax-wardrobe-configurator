export const products = [
  {
    productId: "1",
    name: "3立",
    type: "post",
    sizeRule: "高度2m-3m",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 180,
    skpComponentName: "组件#13",
    glbAssetPath: "assets/glb/post.glb"
  },
  {
    productId: "2",
    name: "3层",
    type: "shelf",
    sizeRule: "宽度50cm",
    colorOptions: ["胡桃木", "浅橡木", "白"],
    material: "木",
    unitPrice: 180,
    skpComponentName: "组件#7",
    glbAssetPath: "assets/glb/wood-shelf.glb"
  },
  {
    productId: "3",
    name: "3玻",
    type: "glassShelf",
    sizeRule: "宽度50cm",
    colorOptions: ["透明灰"],
    material: "玻璃",
    unitPrice: 200,
    skpComponentName: "组件#8",
    glbAssetPath: "assets/glb/glass-shelf.glb"
  },
  {
    productId: "4",
    name: "3挂",
    type: "rail",
    sizeRule: "宽5cm",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 50,
    skpComponentName: "组件#14",
    glbAssetPath: "assets/glb/hanging-rail.glb"
  },
  {
    productId: "5",
    name: "3柜",
    type: "cabinet",
    sizeRule: "高度50cm 深度50cm",
    colorOptions: ["胡桃木", "浅橡木", "白"],
    material: "木",
    unitPrice: 300,
    skpComponentName: "组件#9",
    glbAssetPath: "assets/glb/cabinet.glb"
  },
  {
    productId: "6",
    name: "3抽",
    type: "drawer",
    sizeRule: "高度50cm 深度50cm",
    colorOptions: ["透明灰", "茶色"],
    material: "玻璃",
    unitPrice: 250,
    skpComponentName: "组件#15",
    glbAssetPath: "assets/glb/drawer.glb"
  },
  {
    productId: "CN-SHELF",
    name: "层板托配件",
    type: "shelfConnector",
    sizeRule: "每块层板2个",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 12,
    skpComponentName: "待补充",
    glbAssetPath: "assets/glb/shelf-connector.glb"
  },
  {
    productId: "CN-GLASS",
    name: "玻璃层板托配件",
    type: "glassShelfConnector",
    sizeRule: "每块玻璃层板2个",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 12,
    skpComponentName: "待补充",
    glbAssetPath: "assets/glb/glass-shelf-connector.glb"
  },
  {
    productId: "CN-RAIL",
    name: "挂衣杆托配件",
    type: "railConnector",
    sizeRule: "每根挂衣杆2个",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 12,
    skpComponentName: "待补充",
    glbAssetPath: "assets/glb/rail-connector.glb"
  },
  {
    productId: "CN-CABINET",
    name: "柜子托配件",
    type: "cabinetConnector",
    sizeRule: "每个柜子2个",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 12,
    skpComponentName: "待补充",
    glbAssetPath: "assets/glb/cabinet-connector.glb"
  },
  {
    productId: "CN-DRAWER",
    name: "抽屉托配件",
    type: "drawerConnector",
    sizeRule: "每个抽屉2个",
    colorOptions: ["黑", "白"],
    material: "铁",
    unitPrice: 12,
    skpComponentName: "待补充",
    glbAssetPath: "assets/glb/drawer-connector.glb"
  }
];

export const productByType = Object.fromEntries(products.map((product) => [product.type, product]));
