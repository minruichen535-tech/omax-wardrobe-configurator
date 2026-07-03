# AI Planner Visual Rules v1.0

## Rule Priority

Priority 1：真实产品组件

包括：

- cabinet
- woodShelf
- woodTop
- singleRail
- doubleRail
- trouserRack
- jewelryBox
- shoeShelf

Priority 2：Visual Assets

包括：

- cloth1
- shortHang
- shoeShelf-a/b
- bagShelf-a/b
- bedding
- luggageZone-a/b
- trouserZone-pants-a

原则：

1. Visual Assets 不允许影响真实产品组件。
2. Visual Assets 不允许删除、替换、移动真实产品组件。
3. 如果 Visual Asset 与真实产品组件冲突，删除 Visual Asset，保留真实产品组件。
4. jewelryBox 是真实产品组件，不是 visual asset。
5. trouserRack 是真实产品组件，不是 visual asset。
6. 自动补挂杆如果触发，必须生成真实 singleRail placement，不是 visual-only slot。

## 总原则

Visual Assets 仅用于 AI Planner 结果页展示。

Visual Assets：

- 不参与 BOM
- 不参与报价
- 不参与容量计算
- 不参与方案评分
- 不参与需求分析
- 不参与预算逻辑

Visual Assets 仅作为效果展示层存在。

## 长衣区（Long Hang）

模型：

- cloth1.glb

定义：

- cloth1.glb 内含 4 件长衣

容量规则：

- 1 个 cloth1 = 4 件长衣

摆放规则：

- 必须挂在长衣区挂衣杆上
- 衣架挂钩顶部对齐挂衣杆
- 禁止模型中心对齐挂衣杆
- 禁止 bbox.min.y 对齐挂衣杆

数量规则：

- 需求 1~4 件：1 组
- 需求 5~8 件：2 组
- 需求 9~12 件：3 组

分布规则：

- 优先同跨均匀分布
- 超出单跨容量时分配到下一长衣区

禁止：

- 禁止缩放模型改变衣服数量
- 禁止穿模
- 禁止漂浮

## 短衣区（Short Hang）

模型：

- shortHang-a.glb
- shortHang-b.glb
- shortHang-c.glb
- shortHang-d.glb

定义：

- 每组模型约 5 件短衣

容量规则：

- 1 组 = 5 件短衣

摆放规则：

- 挂钩顶部对齐挂衣杆
- 模型自然下垂

数量规则：

- 根据 shortClothesCount 自动计算

分布规则：

- 同一挂杆均匀排列
- 不允许出现空挂杆

## 裤架（Trouser Rack）

模型：

- trouserZone-pants-a.glb

定义：

- 1 模型 = 5 条裤子

摆放规则：

- 必须绑定真实裤架
- 不允许悬空
- 不允许脱离裤架

高度规则：

- 裤架下方保留 ≥600mm 净空

## 鞋子（Shoes）

模型：

- shoeShelf-a.glb
- shoeShelf-b.glb

优先级：

1. 鞋层板
2. 长衣区地面
3. 普通地面

规则：

- 第一个方案优先摆地面
- 后两个方案鞋层板不足时允许地面摆放

地面摆放：

- 靠墙
- 靠立柱
- 不穿模
- 在立柱的中间位置

禁止：

- 禁止穿入层板
- 禁止悬空

## 包包（Bags）

模型：

- bagShelf-a.glb
- bagShelf-b.glb

优先级：

1. 高位层板
2. 柜体顶部

禁止：

- 禁止放顶板（woodTop）
- 禁止放地面

柜体规则：

若柜体顶部存在 jewelryBox：

- bag 不允许放柜体顶部
- 自动改放层板

## 首饰盒（Jewelry Box）

真实组件，不是 Visual Asset。

优先级：

- 高于 Bag

规则：

- 紧贴柜体顶部
- 允许 0~20mm 间隙

禁止：

- 不允许被 bag 替代
- 不允许因为 bag 而删除

## 被褥（Bedding）

模型：

- bedding.glb

定义：

- 1 个 bedding = 1 套被褥

摆放规则：

- 仅允许放顶板（woodTop）
- 从左向右排列

间距：

- 100mm

禁止：

- 禁止重叠
- 禁止堆叠
- 禁止穿出顶板

空间不足：

- 跳过
- 输出 debug 信息

## 行李箱（Luggage）

模型：

- luggageZone-a.glb
- luggageZone-b.glb

规则：

地面版本：

- luggageZone-a

顶板版本：

- luggageZone-b

优先级：

1. 地面
2. 顶板

缩放规则：

- 保持模型原始比例
- 不允许为了塞入空间强制缩小

空间不足：

- 跳过

禁止：

- 禁止穿模
- 禁止漂浮

## 自动补挂杆（Auto Rail）

真实组件，不是 Visual Asset。

触发条件：

同时满足：

- 已存在顶板
- 下方存在柜体/裤架/首饰盒
- 顶板到底部组件之间净空 600~1400mm

则允许新增第二根挂衣杆。

新增挂杆：

- singleRail

用途：

- 自动转为短衣区

禁止：

- 长衣区禁止补挂杆
- 净空大于 1400mm 禁止补挂杆
- 净空小于 600mm 禁止补挂杆

## Debug 输出

所有 Visual Assets 必须支持 Debug。

输出：

- bayIndex
- assetType
- targetComponent
- position
- bbox
- scale
- skipReason

当资产未生成时：

- 必须输出 skipReason。

禁止静默失败。
