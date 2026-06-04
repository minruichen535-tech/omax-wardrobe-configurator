# 奥美斯金属衣帽间在线配置器

这是一个静态前端原型，已拆分为客户配置端和员工管理端，并从 Excel 数据源读取产品与规则。

## 运行

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

访问：

```text
http://127.0.0.1:4173/configurator/
http://127.0.0.1:4173/admin/
```

根路径 `http://127.0.0.1:4173/` 也会进入配置端。

## 数据源

- 产品与规则读取自 `data/products.xlsx`。
- `Products` Sheet 存产品字段：`sku`、`nameCn`、`type`、`unitPrice`、`sellable`、`image`、`glbAssetPath` 等。
- `Rules` Sheet 存自动补件规则：`configType`、`requiredSku`、`quantity`、`note`。
- 产品图片放在 `images/products/`，Excel 的 `image` 字段只保存路径。
- Admin 修改会先保存到浏览器 `localStorage`，客户端刷新后会读取最新本地数据；点击“恢复默认”会重新读取 Excel。

## 已实现

- 房间尺寸：宽、深、高，单位 mm。
- 墙面布局：I 型后墙、L 型左/右、U 型预留。
- 跨数设置：手动调整跨数，单跨宽度超过 1000mm 时提示错误。
- 组合件库：木层板、玻璃层板、挂衣杆、柜子、抽屉柜、首饰盒。
- 拖拽配置：从左侧组合件库拖到中间指定墙面与跨位。
- 高度控制：选中组合件后用滑块调整离地高度，单位 mm。
- 自动 BOM：按 Rules Sheet 生成销售配件清单，只显示 `sellable=true` 的产品。
- 图片清单：有图片路径则显示缩略图，没有图片则显示占位图。
- 员工端：搜索产品、改名称/价格/sellable/图片/材质/颜色/尺寸、上传/导出 Excel、修改规则表。

## 说明

当前 3D 使用 Three.js 轻量几何体表达结构，`glbAssetPath` 已保留，后续可替换为从 SketchUp 导出的真实 GLB 模型。
