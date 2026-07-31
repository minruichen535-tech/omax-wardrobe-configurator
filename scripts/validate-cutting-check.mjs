import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "cutting-check/index.html",
  "src/cutting-check/cutting-check-main.js",
  "src/cutting-check/cuttingRules.js",
  "src/cutting-check/orderStorage.js",
  "src/cutting-check/cutting-check.css",
  "src/cutting-check/rules/wall-mounted-cutting-rules.json"
];

for (const file of requiredFiles) {
  await access(resolve(root, file), constants.R_OK);
}

const rules = JSON.parse(await readFile(
  resolve(root, "src/cutting-check/rules/wall-mounted-cutting-rules.json"),
  "utf8"
));
if (!rules.schemaVersion || !Array.isArray(rules.excelImportColumns) || !Array.isArray(rules.rules)) {
  throw new Error("规则 JSON 缺少 schemaVersion、excelImportColumns 或 rules");
}
const requiredRuleIds = [
  "post_count",
  "post_spec",
  "horizontal_guide",
  "top_support",
  "top_board",
  "middle_board",
  "middle_support",
  "rod_cut",
  "bay_inner_width",
  "board_type_deduction",
  "rod_pricing"
];
const existingRuleIds = new Set(rules.rules.map((rule) => rule.id));
for (const id of requiredRuleIds) {
  if (!existingRuleIds.has(id)) throw new Error(`规则 JSON 缺少 ${id}`);
}

const sourceDirectory = resolve(root, "src/cutting-check");
const sourceFiles = (await readdir(sourceDirectory))
  .filter((file) => file.endsWith(".js"))
  .map((file) => resolve(sourceDirectory, file));
for (const file of sourceFiles) {
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error(checked.stderr || `语法检查失败：${file}`);
  }
}

const html = await readFile(resolve(root, "cutting-check/index.html"), "utf8");
if (!html.includes("/src/cutting-check/cutting-check-main.js") || !html.includes("/src/cutting-check/cutting-check.css")) {
  throw new Error("页面入口缺少脚本或样式引用");
}

console.log(`静态构建检查通过：${requiredFiles.length} 个必要文件，${sourceFiles.length} 个 JavaScript 模块，${rules.rules.length} 条规则。`);
