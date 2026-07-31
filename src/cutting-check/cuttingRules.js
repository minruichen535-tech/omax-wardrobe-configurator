const STATUS_PRIORITY = {
  confirmed: 0,
  manual: 0,
  pending: 1
};

/**
 * 将规则数组转换为按 id 索引的对象，便于计算函数读取。
 * @param {object} ruleConfig 规则 JSON
 * @returns {Record<string, object>}
 */
export function createRuleIndex(ruleConfig) {
  return Object.fromEntries((ruleConfig?.rules || []).map((rule) => [rule.id, rule]));
}

/**
 * 读取并校验用户输入的有限数字，不会修改、截断或自动纠正原始值。
 * @param {unknown} value 用户输入
 * @param {string} fieldName 字段中文名
 * @param {{integer?: boolean, min?: number, allowZero?: boolean}} options 校验条件
 * @returns {{value: number|null, error: string}}
 */
export function parseUserNumber(value, fieldName, options = {}) {
  if (value === "" || value === null || value === undefined) {
    return { value: null, error: `${fieldName}不能为空` };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${fieldName}必须是有效数字` };
  }
  if (options.integer && !Number.isInteger(parsed)) {
    return { value: null, error: `${fieldName}必须是整数` };
  }
  const minimum = options.min ?? (options.allowZero ? 0 : Number.EPSILON);
  if (parsed < minimum) {
    return { value: null, error: `${fieldName}不能小于${minimum}` };
  }
  return { value: parsed, error: "" };
}

/**
 * 校验一组衣柜输入并返回计算所需数字；原始输入保持不变。
 * @param {object} group 衣柜组输入
 * @param {object} ruleConfig 规则 JSON
 * @returns {{values: object, errors: string[], warnings: string[]}}
 */
export function validateWardrobeGroup(group, ruleConfig) {
  const supported = ruleConfig?.supportedValues || {};
  const fields = {
    wallWidth: parseUserNumber(group.wallWidth, "空间宽度", { min: 1 }),
    wallDepth: parseUserNumber(group.wallDepth, "空间深度", { min: 1 }),
    wallHeight: parseUserNumber(group.wallHeight, "空间高度", { min: 1 }),
    bayCount: parseUserNumber(group.bayCount, "跨数", { integer: true, min: 1 }),
    rodPerBay: parseUserNumber(group.rodPerBay, "每跨衣杆数量", { integer: true, min: 0, allowZero: true }),
    extraBoardCount: parseUserNumber(group.extraBoardCount, "额外中层板数量", { integer: true, min: 0, allowZero: true }),
    boardThickness: parseUserNumber(group.boardThickness, "木板厚度", { min: 1 })
  };
  if (group.useManualBoardWidth) {
    fields.manualBoardWidth = parseUserNumber(group.manualBoardWidth, "人工板宽", { min: 1 });
  }

  const errors = Object.values(fields).map((field) => field.error).filter(Boolean);
  const warnings = [];
  const depth = fields.wallDepth.value;
  if (depth !== null && !(supported.depthsMm || []).includes(depth)) {
    errors.push(`空间深度 ${depth}mm 不在第一版支持范围（${(supported.depthsMm || []).join("/")}mm）`);
  }
  if (!(supported.postColors || []).includes(group.postColor)) {
    errors.push("立柱颜色仅支持黑色或银色");
  }
  if (!(supported.boardTypes || []).includes(group.boardType)) {
    errors.push("板件类型不受第一版支持");
  }
  if (group.equalSplit !== true) {
    errors.push("第一版仅支持每跨均分");
  }

  return {
    values: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])),
    errors,
    warnings
  };
}

/**
 * 计算当前规则下的理论每跨内宽。
 * @param {number} wallWidth 空间宽度 mm
 * @param {number} bayCount 跨数
 * @param {object} ruleConfig 规则 JSON
 * @returns {{value: number, formula: string, substitution: string, status: string}}
 */
export function calculateBayInnerWidth(wallWidth, bayCount, ruleConfig) {
  const rule = createRuleIndex(ruleConfig).bay_inner_width;
  const postWidth = Number(rule.constantA);
  const value = (wallWidth - (bayCount + 1) * postWidth) / bayCount;
  return {
    value,
    formula: rule.formula,
    substitution: `(${wallWidth} - (${bayCount} + 1) × ${postWidth}) ÷ ${bayCount} = ${formatRuleNumber(value)}mm`,
    status: rule.status
  };
}

/**
 * 根据人工覆盖或旧 Excel 板件类型规则得到实际采用板宽。
 * @param {object} group 原始组输入
 * @param {object} values 已校验数字
 * @param {object} bayInnerWidth 理论内宽结果
 * @param {object} ruleConfig 规则 JSON
 * @returns {{value: number, formula: string, substitution: string, status: string, source: string}}
 */
export function resolveBoardWidth(group, values, bayInnerWidth, ruleConfig) {
  if (group.useManualBoardWidth) {
    return {
      value: values.manualBoardWidth,
      formula: "boardWidth = manualBoardWidth",
      substitution: `人工板宽 = ${formatRuleNumber(values.manualBoardWidth)}mm`,
      status: "manual",
      source: "人工覆盖"
    };
  }
  const rule = createRuleIndex(ruleConfig).board_type_deduction;
  const deduction = Number(rule.deductionByBoardType[group.boardType]);
  const value = bayInnerWidth.value - deduction;
  return {
    value,
    formula: rule.formula,
    substitution: `${formatRuleNumber(bayInnerWidth.value)} - ${deduction} = ${formatRuleNumber(value)}mm`,
    status: rule.status,
    source: rule.source
  };
}

/**
 * 计算单组一字型靠墙式衣帽间的全部理论项目。
 * @param {object} group 衣柜组输入
 * @param {object} ruleConfig 规则 JSON
 * @returns {{ok: boolean, groupId: string, groupName: string, errors: string[], warnings: string[], metrics?: object, items?: object[]}}
 */
export function calculateWardrobeGroup(group, ruleConfig) {
  const validation = validateWardrobeGroup(group, ruleConfig);
  if (validation.errors.length) {
    return {
      ok: false,
      groupId: group.id,
      groupName: group.name || "未命名组",
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  const rules = createRuleIndex(ruleConfig);
  const values = validation.values;
  const bayInnerWidth = calculateBayInnerWidth(values.wallWidth, values.bayCount, ruleConfig);
  const boardWidth = resolveBoardWidth(group, values, bayInnerWidth, ruleConfig);
  const postCount = values.bayCount + 1;
  const guideLength = values.wallWidth - Number(rules.horizontal_guide.constantA);
  const rodLength = boardWidth.value - Number(rules.rod_cut.constantA);
  const rodCount = values.bayCount * values.rodPerBay;
  const postSpec = rules.post_spec.heightSpecMap[String(values.wallHeight)];
  const postSpecStatus = postSpec ? rules.post_spec.status : "pending";
  const warnings = [...validation.warnings];
  if (!postSpec) {
    warnings.push(`${values.wallHeight}mm 高度尚无已确认立柱规格`);
  }
  if (guideLength <= 0) {
    return {
      ok: false,
      groupId: group.id,
      groupName: group.name || "未命名组",
      errors: ["空间宽度不足以计算水平导轨剪尺"],
      warnings
    };
  }
  if (boardWidth.value <= 0 || rodLength <= 0) {
    return {
      ok: false,
      groupId: group.id,
      groupName: group.name || "未命名组",
      errors: ["当前输入得到的板宽或衣杆剪尺小于等于0，请检查尺寸"],
      warnings
    };
  }

  const common = {
    groupId: group.id,
    sourceGroup: group.name || "未命名组"
  };
  const boardCode = `${rules.top_board.code}-${boardTypeCode(group.boardType)}`;
  const boardSpec = `${formatRuleNumber(values.wallDepth)}×${formatRuleNumber(values.boardThickness)}mm`;
  const items = [
    createPurchaseItem({
      ...common,
      itemId: `${group.id}-post`,
      category: "立柱",
      code: rules.post_count.code,
      name: rules.post_count.name,
      spec: postSpec || `${formatRuleNumber(values.wallHeight)}mm规格待确认`,
      color: group.postColor,
      quantity: postCount,
      unit: rules.post_count.unit,
      cutLengthMm: null,
      depthMm: null,
      pricingMode: "piece",
      ruleStatus: combineRuleStatus(rules.post_count.status, postSpecStatus),
      formula: "postCount = bayCount + 1",
      substitution: `${values.bayCount} + 1 = ${postCount}支`,
      usage: "立柱"
    }),
    createPurchaseItem({
      ...common,
      itemId: `${group.id}-guide`,
      category: "型材",
      code: rules.horizontal_guide.code,
      name: rules.horizontal_guide.name,
      spec: "U型",
      color: group.postColor,
      quantity: Number(rules.horizontal_guide.quantity),
      unit: rules.horizontal_guide.unit,
      cutLengthMm: guideLength,
      depthMm: null,
      pricingMode: rules.horizontal_guide.pricingMode,
      pricingUnit: rules.horizontal_guide.pricingUnit,
      ruleStatus: rules.horizontal_guide.status,
      formula: "cutLength = wallWidth - 55",
      substitution: `${values.wallWidth} - ${rules.horizontal_guide.constantA} = ${formatRuleNumber(guideLength)}mm；数量1条`,
      usage: "水平导轨"
    }),
    createPurchaseItem({
      ...common,
      itemId: `${group.id}-top-support`,
      category: "配件",
      code: rules.top_support.code,
      name: rules.top_support.name,
      spec: `${formatRuleNumber(values.wallDepth)}mm`,
      color: group.postColor,
      quantity: values.bayCount,
      unit: rules.top_support.unit,
      cutLengthMm: null,
      depthMm: values.wallDepth,
      pricingMode: rules.top_support.pricingMode,
      ruleStatus: rules.top_support.status,
      formula: "quantity = bayCount",
      substitution: `${values.bayCount}跨 = ${values.bayCount}对；规格${values.wallDepth}mm；${group.postColor}`,
      usage: "顶板托"
    }),
    createPurchaseItem({
      ...common,
      itemId: `${group.id}-top-board`,
      category: "板材",
      code: boardCode,
      name: group.boardType,
      spec: boardSpec,
      color: group.boardColor || "未填写",
      quantity: values.bayCount,
      unit: rules.top_board.unit,
      cutLengthMm: boardWidth.value,
      depthMm: values.wallDepth,
      thicknessMm: values.boardThickness,
      pricingMode: rules.top_board.pricingMode,
      ruleStatus: combineRuleStatus(rules.top_board.status, boardWidth.status),
      formula: "quantity = bayCount；板宽采用当前boardWidth",
      substitution: `${values.bayCount}跨 = ${values.bayCount}块；${formatRuleNumber(boardWidth.value)}×${values.wallDepth}×${values.boardThickness}mm`,
      usage: "顶板"
    }),
    createPurchaseItem({
      ...common,
      itemId: `${group.id}-rod`,
      category: "型材",
      code: rules.rod_cut.code,
      name: rules.rod_cut.name,
      spec: "标准挂衣杆",
      color: group.postColor,
      quantity: rodCount,
      unit: rules.rod_cut.unit,
      cutLengthMm: rodLength,
      depthMm: null,
      pricingMode: rules.rod_pricing.pricingMode,
      pricingUnit: rules.rod_pricing.pricingUnit,
      minimumMetersPerPiece: Number(rules.rod_pricing.minimumMetersPerPiece),
      ruleStatus: combineRuleStatus(rules.rod_cut.status, boardWidth.status, rules.rod_pricing.status),
      formula: "quantity = bayCount × rodPerBay；cutLength = boardWidth - 10",
      substitution: `${values.bayCount} × ${values.rodPerBay} = ${rodCount}条；${formatRuleNumber(boardWidth.value)} - ${rules.rod_cut.constantA} = ${formatRuleNumber(rodLength)}mm`,
      usage: "挂衣杆"
    })
  ];

  if (values.extraBoardCount > 0) {
    items.push(
      createPurchaseItem({
        ...common,
        itemId: `${group.id}-middle-board`,
        category: "板材",
        code: boardCode,
        name: group.boardType,
        spec: boardSpec,
        color: group.boardColor || "未填写",
        quantity: values.extraBoardCount,
        unit: rules.middle_board.unit,
        cutLengthMm: boardWidth.value,
        depthMm: values.wallDepth,
        thicknessMm: values.boardThickness,
        pricingMode: rules.middle_board.pricingMode,
        ruleStatus: combineRuleStatus(rules.middle_board.status, boardWidth.status),
        formula: "quantity = extraBoardCount；板宽采用当前boardWidth",
        substitution: `${values.extraBoardCount}块；${formatRuleNumber(boardWidth.value)}×${values.wallDepth}×${values.boardThickness}mm`,
        usage: "中层板"
      }),
      createPurchaseItem({
        ...common,
        itemId: `${group.id}-middle-support`,
        category: "配件",
        code: rules.middle_support.code,
        name: rules.middle_support.name,
        spec: `${formatRuleNumber(values.wallDepth)}mm`,
        color: group.postColor,
        quantity: values.extraBoardCount,
        unit: rules.middle_support.unit,
        cutLengthMm: null,
        depthMm: values.wallDepth,
        pricingMode: rules.middle_support.pricingMode,
        ruleStatus: rules.middle_support.status,
        formula: "quantity = extraBoardCount",
        substitution: `${values.extraBoardCount}块额外中层板 = ${values.extraBoardCount}对；规格${values.wallDepth}mm；${group.postColor}`,
        usage: "中层板托"
      })
    );
  }

  return {
    ok: true,
    groupId: group.id,
    groupName: group.name || "未命名组",
    errors: [],
    warnings,
    metrics: {
      postCount,
      guideLength,
      rodLength,
      rodCount,
      bayInnerWidth,
      boardWidth
    },
    items
  };
}

/**
 * 计算一张订单内所有组，并生成合并采购清单。
 * @param {object[]} groups 衣柜组数组
 * @param {object} ruleConfig 规则 JSON
 * @returns {{groupResults: object[], purchaseRows: object[], hasErrors: boolean}}
 */
export function calculateOrder(groups, ruleConfig) {
  const groupResults = (groups || []).map((group) => calculateWardrobeGroup(group, ruleConfig));
  const validItems = groupResults.filter((result) => result.ok).flatMap((result) => result.items);
  return {
    groupResults,
    purchaseRows: mergePurchaseItems(validItems),
    hasErrors: groupResults.some((result) => !result.ok)
  };
}

/**
 * 按编码、名称、规格、颜色、剪尺和单位合并采购项目。
 * @param {object[]} items 单组采购项目
 * @returns {object[]}
 */
export function mergePurchaseItems(items) {
  const merged = new Map();
  for (const item of items || []) {
    const key = [
      item.code,
      item.name,
      item.spec,
      item.color,
      item.cutLengthMm === null ? "" : canonicalNumber(item.cutLengthMm),
      item.unit
    ].join("|");
    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        theoreticalQuantity: 0,
        totalLengthMm: 0,
        purchaseQuantity: 0,
        sourceGroups: [],
        usages: [],
        formulas: []
      });
    }
    const row = merged.get(key);
    row.theoreticalQuantity += item.quantity;
    row.totalLengthMm += item.cutLengthMm === null ? 0 : item.cutLengthMm * item.quantity;
    row.purchaseQuantity += calculatePurchaseQuantity(item);
    row.ruleStatus = combineRuleStatus(row.ruleStatus, item.ruleStatus);
    if (!row.sourceGroups.includes(item.sourceGroup)) row.sourceGroups.push(item.sourceGroup);
    if (!row.usages.includes(item.usage)) row.usages.push(item.usage);
    row.formulas.push(`${item.sourceGroup}：${item.substitution}`);
  }
  return Array.from(merged.values()).sort(comparePurchaseRows);
}

/**
 * 按规则计算单项采购计价数量；导轨和衣杆均逐条取整，不合并余料。
 * @param {object} item 采购项目
 * @returns {number}
 */
export function calculatePurchaseQuantity(item) {
  if (item.pricingMode === "ceil_each_meter") {
    return Math.ceil(item.cutLengthMm / 1000) * item.quantity;
  }
  if (item.pricingMode === "ceil_each_meter_minimum") {
    const minimum = item.minimumMetersPerPiece ?? 1;
    return Math.max(minimum, Math.ceil(item.cutLengthMm / 1000)) * item.quantity;
  }
  return item.quantity;
}

/**
 * 解析员工粘贴的制表符或逗号分隔采购数据。
 * 列顺序固定为：名称、规格、颜色、数量、剪尺。
 * @param {string} text 粘贴文本
 * @returns {{rows: object[], errors: string[]}}
 */
export function parsePastedPurchaseRows(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = [];
  const errors = [];
  lines.forEach((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());
    if (index === 0 && cells.some((cell) => /名称|规格|颜色|数量|剪尺/.test(cell))) return;
    if (cells.length < 4) {
      errors.push(`第${index + 1}行至少需要名称、规格、颜色、数量`);
      return;
    }
    rows.push({
      id: `paste-${Date.now()}-${index}`,
      name: cells[0] || "",
      spec: cells[1] || "",
      color: cells[2] || "",
      quantity: cells[3] || "",
      cutLength: cells[4] || ""
    });
  });
  return { rows, errors };
}

/**
 * 将人工采购数据与系统理论清单逐行匹配并给出明确状态。
 * @param {object[]} expectedRows 系统合并采购清单
 * @param {object[]} humanRows 人工采购行
 * @returns {object[]}
 */
export function reconcilePurchaseRows(expectedRows, humanRows) {
  const meaningfulHumanRows = (humanRows || []).filter(hasHumanRowContent);
  if (!meaningfulHumanRows.length) return [];
  const remainingExpected = new Set((expectedRows || []).map((_, index) => index));
  const results = [];

  meaningfulHumanRows.forEach((human, humanIndex) => {
    const candidateIndexes = Array.from(remainingExpected).filter((index) =>
      normalizeText(expectedRows[index].name) === normalizeText(human.name)
    );
    if (!candidateIndexes.length) {
      results.push(createReconciliationResult(null, human, humanIndex, "人工多填", "系统理论清单中没有同名项目"));
      return;
    }

    const bestIndex = candidateIndexes
      .map((index) => ({ index, score: purchaseMatchScore(expectedRows[index], human) }))
      .sort((a, b) => b.score - a.score)[0].index;
    remainingExpected.delete(bestIndex);
    const expected = expectedRows[bestIndex];
    const comparison = compareMatchedPurchaseRow(expected, human);
    results.push(createReconciliationResult(expected, human, humanIndex, comparison.status, comparison.message));
  });

  Array.from(remainingExpected).forEach((expectedIndex) => {
    const expected = expectedRows[expectedIndex];
    results.push(createReconciliationResult(expected, null, null, "系统缺少", "人工采购单中缺少该系统理论项目"));
  });
  return results;
}

/**
 * 比较一条已匹配的人工采购行，深度差异优先于其他差异提示。
 * @param {object} expected 系统理论行
 * @param {object} human 人工采购行
 * @returns {{status: string, message: string}}
 */
export function compareMatchedPurchaseRow(expected, human) {
  const humanDepth = parseDepthFromSpec(human.spec);
  if (expected.depthMm !== null && expected.depthMm !== undefined && humanDepth !== null && humanDepth !== expected.depthMm) {
    return {
      status: "深度规格不一致",
      message: `系统深度${formatRuleNumber(expected.depthMm)}mm，人工填写${formatRuleNumber(humanDepth)}mm`
    };
  }
  if (normalizeText(expected.color) !== normalizeText(human.color)) {
    return { status: "颜色不一致", message: `系统${expected.color}，人工${human.color || "未填写"}` };
  }
  const expectedCut = expected.cutLengthMm;
  const humanCut = parseOptionalNumber(human.cutLength);
  if (expectedCut !== null && (humanCut === null || !numbersEqual(expectedCut, humanCut))) {
    return {
      status: "剪尺不一致",
      message: `系统${formatRuleNumber(expectedCut)}mm，人工${humanCut === null ? "未填写" : `${formatRuleNumber(humanCut)}mm`}`
    };
  }
  if (normalizeText(expected.spec) !== normalizeText(human.spec)) {
    return { status: "深度规格不一致", message: `系统规格${expected.spec}，人工${human.spec || "未填写"}` };
  }
  const humanQuantity = parseOptionalNumber(human.quantity);
  if (humanQuantity === null || !numbersEqual(expected.theoreticalQuantity, humanQuantity)) {
    return {
      status: "数量不一致",
      message: `系统${formatRuleNumber(expected.theoreticalQuantity)}${expected.unit}，人工${humanQuantity === null ? "未填写" : formatRuleNumber(humanQuantity)}`
    };
  }
  if (expected.ruleStatus === "pending") {
    return { status: "规则待确认", message: "数值匹配，但系统计算规则仍待确认，不能标记为正确" };
  }
  return { status: "正确", message: "名称、规格、颜色、数量和剪尺均一致" };
}

/**
 * 从采购规格文本中识别第一版支持的深度值。
 * @param {unknown} spec 规格文本
 * @returns {number|null}
 */
export function parseDepthFromSpec(spec) {
  const matches = String(spec || "").match(/\d+(?:\.\d+)?/g) || [];
  const numbers = matches.map(Number);
  return numbers.find((value) => [300, 450, 500].includes(value)) ?? null;
}

/**
 * 统一前端和导出中的数字展示，不改变参与计算的原始数值。
 * @param {number|null|undefined} value 数字
 * @returns {string}
 */
export function formatRuleNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6, useGrouping: false }).format(Number(value));
}

function createPurchaseItem(item) {
  return {
    ...item,
    totalLengthMm: item.cutLengthMm === null ? 0 : item.cutLengthMm * item.quantity,
    purchaseQuantity: calculatePurchaseQuantity(item)
  };
}

function combineRuleStatus(...statuses) {
  return statuses.reduce((worst, status) =>
    (STATUS_PRIORITY[status] ?? 1) > (STATUS_PRIORITY[worst] ?? 0) ? status : worst
  , "confirmed");
}

function boardTypeCode(boardType) {
  return {
    "普通木层板": "WOOD",
    "贵木层板": "PREMIUM-WOOD",
    "玻璃层板": "GLASS"
  }[boardType] || "UNKNOWN";
}

function canonicalNumber(value) {
  return Number(value).toPrecision(15).replace(/\.?0+$/, "");
}

function comparePurchaseRows(a, b) {
  return [a.category, a.code, a.color, a.cutLengthMm ?? -1].join("|")
    .localeCompare([b.category, b.code, b.color, b.cutLengthMm ?? -1].join("|"), "zh-CN", { numeric: true });
}

function hasHumanRowContent(row) {
  return [row?.name, row?.spec, row?.color, row?.quantity, row?.cutLength].some((value) => String(value ?? "").trim());
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numbersEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) < 1e-6;
}

function purchaseMatchScore(expected, human) {
  let score = 0;
  if (normalizeText(expected.spec) === normalizeText(human.spec)) score += 4;
  if (normalizeText(expected.color) === normalizeText(human.color)) score += 3;
  const humanCut = parseOptionalNumber(human.cutLength);
  if ((expected.cutLengthMm === null && humanCut === null) || (humanCut !== null && numbersEqual(expected.cutLengthMm, humanCut))) score += 5;
  const humanQuantity = parseOptionalNumber(human.quantity);
  if (humanQuantity !== null && numbersEqual(expected.theoreticalQuantity, humanQuantity)) score += 1;
  return score;
}

function createReconciliationResult(expected, human, humanIndex, status, message) {
  return {
    id: `${expected?.code || "extra"}-${human?.id || humanIndex || "missing"}-${status}`,
    expected,
    human,
    status,
    message
  };
}
