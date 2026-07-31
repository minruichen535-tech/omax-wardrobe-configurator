import test from "node:test";
import assert from "node:assert/strict";
import { calculateJapaneseClientRetailPrice } from "../src/series/japanese-closet/clientPricing.js";

const products = [
  {
    sku: "JP-WOOD-TOP",
    type: "woodTop",
    nameCn: "木顶板",
    unit: "块",
    japaneseClientPrice: 190
  },
  {
    sku: "JP-MIRROR",
    type: "mirror",
    nameCn: "镜子",
    unit: "面",
    japaneseClientPrice: 150
  },
  {
    sku: "JP-CLOTH-BOARD",
    type: "clothBoard",
    nameCn: "烫衣板",
    unit: "块",
    japaneseClientPrice: 500
  },
  {
    sku: "JP-RAIL",
    type: "singleRail",
    nameCn: "挂衣杆（单）",
    unit: "条",
    japaneseClientPrice: 60
  }
];

const productBySku = Object.fromEntries(products.map((product) => [product.sku, product]));
const productByType = Object.fromEntries(products.map((product) => [product.type, product]));

function activeWall(id, bayCount) {
  return {
    id,
    bayCount,
    bays: Array.from({ length: bayCount }, (_, index) => ({ bayIndex: index }))
  };
}

function placement(id, wallId, bayIndex, componentType, productSku) {
  return {
    id,
    wallId,
    bayIndex,
    componentType,
    productSku,
    quantity: 1
  };
}

function woodTopPlacements(walls) {
  return walls.flatMap((wall) => wall.bays.map((bay) =>
    placement(`top-${wall.id}-${bay.bayIndex}`, wall.id, bay.bayIndex, "woodTop", "JP-WOOD-TOP")
  ));
}

function calculateLayout(walls, accessories) {
  const placements = [...woodTopPlacements(walls), ...accessories];
  const pricing = calculateJapaneseClientRetailPrice({
    design: {
      activeWalls: walls,
      placements,
      productBySku,
      productByType
    },
    config: {},
    products
  });
  return { placements, pricing };
}

test("I型：后墙基础结构和后墙配件共同计入客户报价", () => {
  const walls = [activeWall("back", 2)];
  const result = calculateLayout(walls, [
    placement("mirror-back", "back", 0, "mirror", "JP-MIRROR")
  ]);

  assert.equal(result.placements.length, 3);
  assert.equal(result.pricing.activeBayCount, 2);
  assert.deepEqual(
    result.pricing.lines.slice(1).map((line) => [line.productSku, line.quantity, line.lineTotal]),
    [["JP-MIRROR", 1, 150]]
  );
  assert.equal(result.pricing.total, 1470);
});

test("L型：后墙与左侧墙的全部合法 placement 共同计入客户报价", () => {
  const walls = [activeWall("back", 2), activeWall("left", 1)];
  const result = calculateLayout(walls, [
    placement("mirror-back", "back", 0, "mirror", "JP-MIRROR"),
    placement("cloth-left", "left", 0, "clothBoard", "JP-CLOTH-BOARD")
  ]);

  assert.equal(result.placements.length, 5);
  assert.equal(result.pricing.activeBayCount, 3);
  assert.deepEqual(
    result.pricing.lines.slice(1).map((line) => [line.productSku, line.quantity, line.lineTotal]),
    [
      ["JP-MIRROR", 1, 150],
      ["JP-CLOTH-BOARD", 1, 500]
    ]
  );
  assert.equal(result.pricing.total, 2630);
});

test("U型：后墙、左墙和右墙的全部合法 placement 共同计入客户报价", () => {
  const walls = [
    activeWall("back", 2),
    activeWall("left", 1),
    activeWall("right", 1)
  ];
  const result = calculateLayout(walls, [
    placement("mirror-back", "back", 0, "mirror", "JP-MIRROR"),
    placement("cloth-left", "left", 0, "clothBoard", "JP-CLOTH-BOARD"),
    placement("rail-right", "right", 0, "singleRail", "JP-RAIL")
  ]);

  assert.equal(result.placements.length, 7);
  assert.equal(result.pricing.activeBayCount, 4);
  assert.deepEqual(
    result.pricing.lines.slice(1).map((line) => [line.productSku, line.quantity, line.lineTotal]),
    [
      ["JP-MIRROR", 1, 150],
      ["JP-CLOTH-BOARD", 1, 500],
      ["JP-RAIL", 1, 60]
    ]
  );
  assert.equal(result.pricing.total, 3350);
});
