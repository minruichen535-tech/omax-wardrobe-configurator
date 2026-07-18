# Japanese AI Planner Component Capability Matrix

## Purpose

This document defines what each Japanese closet component can do in the AI Planner.

It works together with:

- `docs/ai-planner/japanese-functional-zone-policy.md`

The Functional Zone Policy defines the bay profile and vertical functional zone rules. This matrix defines component capabilities inside those zones.

## Component Matrix

| Component ID | Display name | Supported Functional Zones | Allowed Bay Profiles | Can replace | Can coexist with | Preferred plan tier | Placement constraints | Pricing behavior | Visual behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `woodShelf` | 木层板 | `lowShoeStorage`, `middleDisplayStorage`, `highBulkStorage` when used as top storage | Long Hang + Shoe Bay, Short Hang + Shoe Bay, Short Hang + Lower Storage Bay, Double Short Hang + Middle Storage Bay, Storage Bay, Bag Storage + General Storage, Short Hang + Jewelry + Storage Bay | Middle storage slot; may add storage without replacing hanging when clearance is valid | Hanging rail if placed above or below safely; cabinet/drawer when separated by valid clearance | Basic / Recommended | Low shelf is for shoes; middle shelf is for bags/folded/storage; high shelf is top storage. Must not enter active long-hang volume. | Customer-facing planner price should follow AI Planner sales pricing rules. Internal BOM pricing remains separate. | Structural shelf model; may host shoe/bag/storage visual assets depending on zone. | Height is selected by functional zone realization, not by component alone. |
| `woodTop` | 顶板 | `highBulkStorage` | All bay profiles when top storage is needed | None | High rail only when it does not block hanging clearance | All tiers | Top storage only. Cannot be replaced by drawer, trouser rack, or jewelry box. | Usually included or priced by planner top shelf/top board policy. | Structural top board/shelf; may support bedding/luggage/seasonal visuals. | Represents high bulk storage, not middle shelf storage. |
| `singleRail` | 单挂衣杆 | `lowerShortHang`, `highRailHang`, `upperShortHang`, `longHang` | Long Hang + Shoe Bay, Short Hang + Shoe Bay, Short Hang + Lower Storage Bay, Double Short Hang + Middle Storage Bay, Short Hang + Trouser Bay, Short Hang + Jewelry + Storage Bay | Middle rail may be replaced by cabinet, drawer, middle shelf, or jewelry box when bay profile allows. High rail should normally be preserved. | Low shoe shelves, cabinet, drawer, trouser rack, jewelry box, or middle shelf when classified as upper short hanging and clearance is valid | Basic | High rail classification depends on free space below: long hanging if enough clearance, upper short hanging if lower features occupy the bay. | Customer-facing planner rail price. Internal BOM pricing remains separate. | Hanging rail model; can generate hanging clothes visual assets when visual items are enabled. | Do not classify bay purpose from rail `zoneType`; use Bay Profile / `templateRole`. |
| `doubleRail` | 双挂衣杆 | `lowerShortHang`, `upperShortHang` | Short Hang + Shoe Bay, Short Hang + Lower Storage Bay, Double Short Hang + Middle Storage Bay, Short Hang + Trouser Bay, Short Hang + Jewelry + Storage Bay | Can replace singleRail where short-hang capacity upgrade is desired | Shelves, cabinet, drawer, trouser rack, jewelry box when clearance is valid | Basic / Recommended | Used for short-hang capacity. Should not be used to create invalid long-hang assumptions. | Customer-facing double rail price or rail upgrade price. Internal BOM pricing remains separate. | Rail model; can generate short-hang clothes visual assets. | Mainly capacity upgrade, not a storage shelf. |
| `cabinet` | 柜体 | `cabinetLowStorage` | Short Hang + Lower Storage Bay, Storage Bay, Bag Storage + General Storage, Short Hang + Jewelry + Storage Bay | Preferably replaces middle rail; may replace lower functional storage when bay profile allows | High rail, upper short hanging, middle shelf above when clearance is valid | Recommended / Premium | Low storage zone. Should not replace high hanging or top shelf. Should not occupy active long-hang volume unless bay is intentionally converted. | Customer-facing cabinet sales price. Internal BOM pricing remains separate. | Cabinet model; may visually support items above only if there is a valid surface/zone. | Good candidate for preserving high rail while upgrading lower/middle storage. |
| `trouserRack` | 裤架 | `trouserRackLow` | Short Hang + Trouser Bay, Short Hang + Lower Storage Bay when demand requires trousers | Lower rail or lower/middle hanging area when compatible | High rail; upper short hanging; safe shelves above if valid | Recommended / Premium | Can be middle or low. Lower than drawer is acceptable. Do not apply drawer ergonomic rules. Avoid low shoe shelf stack conflicts. | Customer-facing trouser rack price. Internal BOM pricing remains separate. | Trouser rack product model; may generate trouser visual asset. | Placement Strategy decides bay selection; Functional Zone Policy decides zone compatibility. |
| `jewelryBox` | 首饰盒 | `jewelryReachable` | Short Hang + Jewelry + Storage Bay, Storage Bay, Bag Storage + General Storage | Middle shelf/storage slot; can sit above low cabinet when reachable | High rail; cabinet below; shelf zones when separated safely | Premium | Reachable middle position. Not floor storage. Must not be behind hanging clothes or inside active long-hang volume. | Customer-facing jewelry/accessory price. Internal BOM pricing remains separate. | Jewelry box product model. | Should be treated as reachable storage, not low storage. |
| `drawerSingle` | 单抽 | `drawerErgonomicStorage` | Short Hang + Lower Storage Bay, Storage Bay, Bag Storage + General Storage, Short Hang + Jewelry + Storage Bay | Middle shelf or storage slot | High rail when drawer is below active upper short-hang volume and not behind clothes | Recommended / Premium | Preferred center height 1000-1150 mm. Acceptable 900-1200 mm. Cannot be inside active long-hang volume. Must not be behind hanging clothes. Uses `productSku` for exact SKU. | Customer-facing drawer single package or insert price by SKU. Internal BOM pricing remains separate. | DrawerSingle model selected by `productSku`. | Should not replace low shoe shelves unless explicitly required and ergonomic rules pass. |
| `drawerDouble` | 双抽 | `drawerErgonomicStorage` | Short Hang + Lower Storage Bay, Storage Bay, Bag Storage + General Storage, Short Hang + Jewelry + Storage Bay | Middle shelf or storage slot | High rail when drawer is below active upper short-hang volume and not behind clothes | Premium | Preferred center height 1000-1150 mm. Acceptable 900-1200 mm. Cannot be inside active long-hang volume. Must not be behind hanging clothes. Uses `productSku: JP-drawerDouble`, plus `topDrawerSku` and `bottomDrawerSku`. | Customer-facing drawer double package price. Insert SKU identity must be preserved for pricing and BOM. | Whole drawerDouble visual model selected by `topDrawerSku` / `bottomDrawerSku` priority. | Do not overlay insert models. Render one whole drawerDouble model at a time. |

## DrawerSingle SKU Capabilities

| SKU | Display name | Visual model | Pricing category | Preferred tier | Demand triggers |
| --- | --- | --- | --- | --- | --- |
| `JP-drawer-wire-basket` | 收纳网篮 | Dedicated drawer single basket model if available; otherwise SKU-specific drawer visual from product data | Wire basket insert / storage basket category | Recommended / Premium | General storage, folded clothes, baskets, breathable storage |
| `JP-drawer-wire-basket-short` | 收纳网篮浅 | Dedicated shallow basket model if available; otherwise SKU-specific drawer visual from product data | Shallow wire basket / shallow storage basket category | Recommended / Premium | Shallow storage, accessories, smaller folded items |
| `JP-drawer-leather-storage` | 皮革收纳篮 | Dedicated leather storage drawer model if available; otherwise SKU-specific drawer visual from product data | Leather storage insert category | Premium | Premium storage, accessories, refined organization |
| `JP-drawer-multi-storage` | 多功能收纳 | SKU-specific drawer visual from product data; may share visible model with leather storage if product visuals are intentionally shared | Multi-storage insert category | Premium | Mixed accessories, daily small items, general organization |
| `JP-drawer-underwear-a` | 内衣收纳 A | SKU-specific drawer visual from product data; may share visible model with leather storage if product visuals are intentionally shared | Underwear insert category | Premium | Underwear, socks, intimate apparel organization |
| `JP-drawer-underwear-b` | 内衣收纳 B | SKU-specific drawer visual from product data; may share visible model with leather storage if product visuals are intentionally shared | Underwear insert category | Premium | Underwear, socks, intimate apparel organization |
| `JP-drawer-jewelry` | 首饰收纳 | SKU-specific drawer visual from product data; may share visible model with leather storage if product visuals are intentionally shared | Jewelry insert category | Premium | Jewelry, watches, accessories |

## DrawerDouble SKU Capability

| SKU | Display name | Visual model | Pricing category | Preferred tier | Demand triggers |
| --- | --- | --- | --- | --- | --- |
| `JP-drawerDouble` | 双抽 | Whole drawerDouble model selected by `topDrawerSku` / `bottomDrawerSku`. Default model is `JP-drawerDouble.glb`. Wire basket, shallow basket, and leather group use their corresponding whole replacement GLB. | DrawerDouble package category plus insert SKU pricing rules | Premium | Premium organization, combined accessory storage, high-value drawer upgrade |

DrawerDouble must preserve:

- `componentType: drawerDouble`
- `productSku: JP-drawerDouble`
- `topDrawerSku`
- `bottomDrawerSku`

The visual model selection must not change SKU identity, pricing identity, BOM identity, or exported SKU values.

## Relationship To Functional Zone Policy

This matrix answers: which components can satisfy a functional zone?

The Functional Zone Policy answers:

1. Which Bay Profile is selected?
2. Which Functional Zones exist inside that bay?
3. Which components should be considered for each zone?
4. Which physical placement height realizes the selected zone?

Future components should declare supported Functional Zones and capability metadata instead of requiring planner-specific branching.
