import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateOrder,
  calculateWardrobeGroup,
  mergePurchaseItems,
  reconcilePurchaseRows
} from "../src/cutting-check/cuttingRules.js";

const ruleConfig = JSON.parse(await readFile(
  new URL("../src/cutting-check/rules/wall-mounted-cutting-rules.json", import.meta.url),
  "utf8"
));

function group(overrides = {}) {
  return {
    id: "group-a",
    name: "A",
    wallWidth: "2900",
    wallDepth: "500",
    wallHeight: "2000",
    bayCount: "3",
    equalSplit: true,
    postColor: "黑色",
    boardColor: "木胡桃色",
    boardType: "普通木层板",
    rodPerBay: "2",
    extraBoardCount: "2",
    boardThickness: "18",
    useManualBoardWidth: true,
    manualBoardWidth: "928",
    ...overrides
  };
}

function wangGroups() {
  return [
    group(),
    group({
      id: "group-b",
      name: "B",
      wallWidth: "1400",
      wallDepth: "450",
      bayCount: "2",
      extraBoardCount: "0",
      manualBoardWidth: "657"
    }),
    group({
      id: "group-c",
      name: "C",
      wallWidth: "1600",
      wallDepth: "500",
      bayCount: "2",
      postColor: "银色",
      boardColor: "初晴色",
      extraBoardCount: "0",
      manualBoardWidth: "757"
    })
  ];
}

function findRow(rows, predicate, message) {
  const row = rows.find(predicate);
  assert.ok(row, message);
  return row;
}

test("数量规则：立柱、顶板托、中层板和衣杆数量正确", () => {
  const result = calculateWardrobeGroup(group(), ruleConfig);
  assert.equal(result.ok, true);
  assert.equal(result.metrics.postCount, 4);
  assert.equal(result.metrics.rodCount, 6);
  assert.equal(findRow(result.items, (item) => item.usage === "顶板托").quantity, 3);
  assert.equal(findRow(result.items, (item) => item.usage === "顶板").quantity, 3);
  assert.equal(findRow(result.items, (item) => item.usage === "中层板").quantity, 2);
  assert.equal(findRow(result.items, (item) => item.usage === "中层板托").quantity, 2);
});

test("导轨剪尺：空间宽度减55，且逐条采购米数向上取整", () => {
  const result = calculateWardrobeGroup(group(), ruleConfig);
  const guide = findRow(result.items, (item) => item.name === "U型水平导轨");
  assert.equal(guide.cutLengthMm, 2845);
  assert.equal(guide.quantity, 1);
  assert.equal(guide.purchaseQuantity, 3);
  assert.equal(guide.ruleStatus, "confirmed");
});

test("衣杆剪尺：人工板宽减10，不使用写死的示例剪尺", () => {
  const result = calculateWardrobeGroup(group({ manualBoardWidth: "1000" }), ruleConfig);
  const rod = findRow(result.items, (item) => item.name === "挂衣杆");
  assert.equal(rod.cutLengthMm, 990);
  assert.equal(rod.quantity, 6);
  assert.equal(rod.purchaseQuantity, 6);
  assert.equal(rod.ruleStatus, "pending");
});

test("合并逻辑：相同编码、规格、颜色和剪尺合并，不同剪尺不合并", () => {
  const a = calculateWardrobeGroup(group(), ruleConfig);
  const aCopy = calculateWardrobeGroup(group({ id: "group-a2", name: "A2", extraBoardCount: "0" }), ruleConfig);
  const differentCut = calculateWardrobeGroup(group({
    id: "group-d",
    name: "D",
    manualBoardWidth: "900",
    extraBoardCount: "0"
  }), ruleConfig);
  const rows = mergePurchaseItems([...a.items, ...aCopy.items, ...differentCut.items]);
  const board928 = findRow(rows, (row) => row.name === "普通木层板" && row.cutLengthMm === 928);
  const board900 = findRow(rows, (row) => row.name === "普通木层板" && row.cutLengthMm === 900);
  assert.equal(board928.theoreticalQuantity, 8);
  assert.deepEqual(board928.sourceGroups, ["A", "A2"]);
  assert.equal(board900.theoreticalQuantity, 3);
});

test("王先生示例：全部关键结果与验收值完全一致", () => {
  const { purchaseRows } = calculateOrder(wangGroups(), ruleConfig);

  assert.equal(findRow(purchaseRows, (row) => row.name === "立柱" && row.color === "黑色").theoreticalQuantity, 7);
  assert.equal(findRow(purchaseRows, (row) => row.name === "立柱" && row.color === "银色").theoreticalQuantity, 3);

  assert.equal(findRow(purchaseRows, (row) => row.name === "U型水平导轨" && row.color === "黑色" && row.cutLengthMm === 2845).theoreticalQuantity, 1);
  assert.equal(findRow(purchaseRows, (row) => row.name === "U型水平导轨" && row.color === "黑色" && row.cutLengthMm === 1345).theoreticalQuantity, 1);
  assert.equal(findRow(purchaseRows, (row) => row.name === "U型水平导轨" && row.color === "银色" && row.cutLengthMm === 1545).theoreticalQuantity, 1);

  assert.equal(findRow(purchaseRows, (row) => row.name === "顶板托" && row.color === "黑色" && row.spec === "500mm").theoreticalQuantity, 3);
  assert.equal(findRow(purchaseRows, (row) => row.name === "顶板托" && row.color === "黑色" && row.spec === "450mm").theoreticalQuantity, 2);
  assert.equal(findRow(purchaseRows, (row) => row.name === "顶板托" && row.color === "银色").theoreticalQuantity, 2);
  assert.equal(findRow(purchaseRows, (row) => row.name === "中层板托" && row.color === "黑色").theoreticalQuantity, 2);

  assert.equal(findRow(purchaseRows, (row) => row.name === "挂衣杆" && row.color === "黑色" && row.cutLengthMm === 918).theoreticalQuantity, 6);
  assert.equal(findRow(purchaseRows, (row) => row.name === "挂衣杆" && row.color === "黑色" && row.cutLengthMm === 647).theoreticalQuantity, 4);
  assert.equal(findRow(purchaseRows, (row) => row.name === "挂衣杆" && row.color === "银色" && row.cutLengthMm === 747).theoreticalQuantity, 4);

  assert.equal(findRow(purchaseRows, (row) => row.name === "普通木层板" && row.color === "木胡桃色" && row.spec === "500×18mm" && row.cutLengthMm === 928).theoreticalQuantity, 5);
  assert.equal(findRow(purchaseRows, (row) => row.name === "普通木层板" && row.color === "木胡桃色" && row.spec === "450×18mm" && row.cutLengthMm === 657).theoreticalQuantity, 2);
  assert.equal(findRow(purchaseRows, (row) => row.name === "普通木层板" && row.color === "初晴色" && row.spec === "500×18mm" && row.cutLengthMm === 757).theoreticalQuantity, 2);

  const totalGuidePurchaseMeters = purchaseRows
    .filter((row) => row.name === "U型水平导轨")
    .reduce((total, row) => total + row.purchaseQuantity, 0);
  assert.equal(totalGuidePurchaseMeters, 7);
});

test("采购核对：数量、剪尺、颜色和规则待确认状态分别识别", () => {
  const { purchaseRows } = calculateOrder([group()], ruleConfig);
  const guide = findRow(purchaseRows, (row) => row.name === "U型水平导轨");
  const rod = findRow(purchaseRows, (row) => row.name === "挂衣杆");

  const quantityMismatch = reconcilePurchaseRows([guide], [{
    id: "human-1",
    name: guide.name,
    spec: guide.spec,
    color: guide.color,
    quantity: "2",
    cutLength: String(guide.cutLengthMm)
  }]);
  assert.equal(quantityMismatch[0].status, "数量不一致");

  const cutMismatch = reconcilePurchaseRows([guide], [{
    id: "human-2",
    name: guide.name,
    spec: guide.spec,
    color: guide.color,
    quantity: "1",
    cutLength: "2800"
  }]);
  assert.equal(cutMismatch[0].status, "剪尺不一致");

  const colorMismatch = reconcilePurchaseRows([guide], [{
    id: "human-3",
    name: guide.name,
    spec: guide.spec,
    color: "银色",
    quantity: "1",
    cutLength: String(guide.cutLengthMm)
  }]);
  assert.equal(colorMismatch[0].status, "颜色不一致");

  const pending = reconcilePurchaseRows([rod], [{
    id: "human-4",
    name: rod.name,
    spec: rod.spec,
    color: rod.color,
    quantity: String(rod.theoreticalQuantity),
    cutLength: String(rod.cutLengthMm)
  }]);
  assert.equal(pending[0].status, "规则待确认");
});

test("采购核对：B组450mm板材被人工写成500mm时明显提示深度不一致", () => {
  const { purchaseRows } = calculateOrder([wangGroups()[1]], ruleConfig);
  const board = findRow(purchaseRows, (row) => row.name === "普通木层板");
  const results = reconcilePurchaseRows([board], [{
    id: "human-depth",
    name: "普通木层板",
    spec: "500×18mm",
    color: "木胡桃色",
    quantity: "2",
    cutLength: "657"
  }]);
  assert.equal(results[0].status, "深度规格不一致");
  assert.match(results[0].message, /系统深度450mm，人工填写500mm/);
});

test("采购核对：系统理论项目缺失和人工多填均有独立状态", () => {
  const { purchaseRows } = calculateOrder([group()], ruleConfig);
  const guide = findRow(purchaseRows, (row) => row.name === "U型水平导轨");
  const results = reconcilePurchaseRows([guide], [{
    id: "human-extra",
    name: "不存在的配件",
    spec: "未知",
    color: "黑色",
    quantity: "1",
    cutLength: ""
  }]);
  assert.equal(results[0].status, "人工多填");
  assert.equal(results[1].status, "系统缺少");
});
