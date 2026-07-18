# Japanese AI Planner Functional Zone Policy

## Purpose

The Functional Zone Policy is a placement policy layer for the Japanese AI Planner.

It does not replace the existing Upgrade Policy. The Upgrade Policy decides what value or component should be added based on demand, plan tier, budget, and product strategy. The Functional Zone Policy decides where that component can be placed safely, ergonomically, and without breaking the intended function of the bay.

The planner should not treat each bay as a single-function bay. A bay may contain multiple vertical functional zones. Height is only the physical realization of a functional zone, not the primary planning concept.

The AI decision order must always be:

1. Decide Bay Profile.
2. Decide Functional Zones inside that bay.
3. Decide Components for each Functional Zone.
4. Realize the final placement heights.

Never reverse this order.

Bay Profile decides functional composition. Bay width allocation remains handled by existing room-size and uniform bay layout logic. The Functional Zone Policy must not define minimum bay widths or bay-width allocation rules.

## Japanese Bay Profiles

These profiles are not single-function bays. Each profile is a composition of vertical functional zones.

### Long Hang + Shoe Bay

- Upper: Long hanging.
- Lower: Shoe storage.
- Typical zones: `longHang`, `lowShoeStorage`.

### Short Hang + Shoe Bay

- Upper: Short hanging.
- Lower: Shoe storage.
- Typical zones: `upperShortHang` or `lowerShortHang`, `lowShoeStorage`.

### Short Hang + Lower Storage Bay

- Upper: Short hanging.
- Floor/low area: General storage.
- Typical zones: `upperShortHang` or `lowerShortHang`, `lowerFunctionalStorage`.

### Double Short Hang + Middle Storage Bay

- Upper short hanging.
- Middle storage for bags or folded clothes.
- Lower short hanging.
- Typical zones: `upperShortHang`, `middleDisplayStorage`, `lowerShortHang`.

### Storage Bay

- Middle storage.
- High bulk storage.
- Typical zones: `middleDisplayStorage`, `highBulkStorage`, optionally `lowerFunctionalStorage`.

### Bag Storage + General Storage

- Middle bag or folded storage.
- Lower general storage.
- High bulk storage if needed.
- Typical zones: `middleDisplayStorage`, `lowerFunctionalStorage`, `highBulkStorage`.

### Short Hang + Trouser Bay

- Upper short hanging.
- Trouser rack can be middle or low position.
- Typical zones: `upperShortHang`, `trouserRackLow`.

### Short Hang + Jewelry + Storage Bay

- Upper short hanging.
- Reachable jewelry zone.
- Storage zone.
- Typical zones: `upperShortHang`, `jewelryReachable`, `lowerFunctionalStorage` or `middleDisplayStorage`.

## Functional Zones

### lowShoeStorage

- Purpose: Low shoe storage and shoe display near the floor.
- Supported components: `woodShelf`, `shoeShelf`, `shoesShelf`.
- Preferred height range: 250-910 mm.
- Acceptable height range: 200-1000 mm.
- Replacement relationships: May be added in shoe-focused bays. Should not be replaced by drawers unless the user explicitly requests drawers and drawer ergonomic rules pass.
- Incompatible zones: `drawerErgonomicStorage`, `jewelryReachable`, `cabinetLowStorage`, active long-hang volume, low cabinet footprint that already occupies the same bay volume.
- Typical visual assets: Shoes.

### lowerFunctionalStorage

- Purpose: Daily-use storage below or around hanging zones for bags, folded clothes, or boxes.
- Supported components: `woodShelf`, `displayShelf`, `glassShelf`, `storageShelf`.
- Preferred height range: 900-1350 mm.
- Acceptable height range: 750-1500 mm.
- Replacement relationships: Can be added above a middle hanging rail when clearance remains valid. Can provide a replacement target for drawers or jewelry storage when compatible.
- Incompatible zones: Active long-hang volume, dense shoe shelf stack, cabinet volume already occupying the same interval.
- Typical visual assets: Bags, folded clothes, storage boxes.

### drawerErgonomicStorage

- Purpose: Reachable drawer storage for daily accessories and clothing inserts.
- Supported components: `drawerSingle`, `drawerDouble`.
- Preferred height range: 1000-1150 mm center height.
- Acceptable height range: 900-1200 mm center height.
- Replacement relationships: Can replace a middle shelf or storage slot. Must not replace low shoe shelves unless explicitly allowed. Must not replace preserved high hanging function.
- Incompatible zones: Active long-hang volume, behind hanging clothes, trouser rack low zone, dense low shoe shelf zone.
- Typical visual assets: None. Drawer inserts are real product visuals, not lifestyle assets.

### middleDisplayStorage

- Purpose: Display or medium-height storage for bags, decor, folded clothes, or open storage.
- Supported components: `woodShelf`, `glassShelf`, `displayShelf`, storage shelf.
- Preferred height range: 1050-1500 mm.
- Acceptable height range: 900-1650 mm.
- Replacement relationships: Can be added above a middle hanging rail. Can be replaced by a drawer if drawer ergonomic rules pass.
- Incompatible zones: Active long-hang volume, cabinet volume, drawer ergonomic zone already occupying the same interval.
- Typical visual assets: Bags, decorations, folded clothes, storage boxes.

### lowerShortHang

- Purpose: Middle hanging at about 1050 mm for short hanging only. Also acts as the lower rail in double-hang or mixed-use bays.
- Supported components: `singleRail`, `doubleRail`.
- Preferred height range: 1000-1100 mm.
- Acceptable height range: 950-1150 mm.
- Replacement relationships: Can be replaced by cabinet or drawer only when an upper rail remains functional and the bay purpose allows storage conversion.
- Incompatible zones: Drawer ergonomic storage occupying the same clearance volume, cabinet at the same vertical interval, trouser rack low zone when it needs the lower area.
- Typical visual assets: Short hanging clothes.

### highRailHang

- Purpose: Standard high rail position used for long hanging or upper short hanging.
- Supported components: `singleRail`, `doubleRail`.
- Preferred height range: 1950-2050 mm.
- Acceptable height range: 1900-2100 mm.
- Replacement relationships: Should usually be preserved when it is the only high hanging function in a hanging-capable bay.
- Incompatible zones: High bulk shelf directly conflicting with rail clearance, dense shelves that remove all usable hanging space.
- Typical visual assets: Long hanging clothes or upper short hanging clothes depending on free space below.
- Classification rule: If free space below is greater than 1200 mm, treat the rail as `longHang`. If free space below is less than 1200 mm, treat it as `upperShortHang`.

### upperShortHang

- Purpose: High rail used as upper short hanging when lower bay volume contains shelves, drawers, cabinet, or another rail.
- Supported components: `singleRail`, `doubleRail`.
- Preferred height range: 1950-2050 mm.
- Acceptable height range: 1900-2100 mm, with enough short-hang clearance below.
- Replacement relationships: Can coexist above cabinet, drawer, shelf, or lower rail if clearance is valid.
- Incompatible zones: High shelf occupying the same rail clearance, full-height long-hang use in the same volume.
- Typical visual assets: Short hanging clothes.

### longHang

- Purpose: Full-height hanging for dresses, coats, or long garments.
- Supported components: `singleRail`, `doubleRail`.
- Preferred height range: 1950-2050 mm.
- Acceptable height range: 1900-2100 mm, with long-hang clearance below.
- Replacement relationships: Can convert to `upperShortHang` when valid lower storage exists below. Should not be destroyed by drawers or shelves unless the bay is intentionally converted.
- Incompatible zones: Drawer ergonomic storage, low/middle shelves, cabinet, trouser rack, or dense storage inside the required long-hang volume.
- Typical visual assets: Long hanging clothes.

### highBulkStorage

- Purpose: Upper storage for large, seasonal, bedding, or luggage items.
- Supported components: `woodTop`, `woodShelf`, high storage shelf.
- Preferred height range: 2050 mm and above.
- Acceptable height range: 1900 mm and above when it does not block high rail function.
- Replacement relationships: Always resolves to top storage. Can become the top shelf or top board. Should be secondary to lower functional storage when premium value can be created below.
- Incompatible zones: `drawerErgonomicStorage`, `trouserRackLow`, `jewelryReachable`, high rail clearance, lighting or visual zones that require open space.
- Typical visual assets: Bedding, luggage, large storage boxes.

### trouserRackLow

- Purpose: Low or middle-height trouser rack storage.
- Supported components: `trouserRack`.
- Preferred height range: 700-950 mm.
- Acceptable height range: 650-1100 mm.
- Replacement relationships: Can replace lower rail or lower hanging area. Should not be constrained by drawer ergonomic rules.
- Incompatible zones: Low shoe shelf stack, cabinet low storage occupying the same space, drawer ergonomic storage in the same bay interval.
- Typical visual assets: Trouser visuals.

### jewelryReachable

- Purpose: Reachable jewelry or accessory storage.
- Supported components: `jewelryBox`.
- Preferred height range: 1000-1300 mm.
- Acceptable height range: 900-1400 mm.
- Replacement relationships: Can be placed above a low cabinet when reachable. Can replace middle display/storage slot when compatible.
- Incompatible zones: Low floor storage, active hanging volume, behind hanging clothes.
- Typical visual assets: None. Jewelry box is a real product visual.

### cabinetLowStorage

- Purpose: Low closed storage cabinet.
- Supported components: `cabinet`, `storageCabinet`.
- Preferred height range: 0-300 mm base height.
- Acceptable height range: 0-400 mm base height.
- Replacement relationships: Should preferably replace the middle hanging rail. Can replace a lower short-hang function while preserving high rail when feasible. Must not replace high hanging or top shelf.
- Incompatible zones: High hanging, top shelf, low shoe shelf stack in the same volume, trouser rack low zone, drawer ergonomic storage in the same interval.
- Typical visual assets: Bags or storage boxes above cabinet if an upper shelf/display surface exists.

## Component-to-Zone Mapping

- `drawerSingle`, `drawerDouble`: `drawerErgonomicStorage`.
- `trouserRack`: `trouserRackLow`.
- `jewelryBox`: `jewelryReachable`.
- `cabinet`: `cabinetLowStorage`.
- `woodShelf`: `lowShoeStorage`, `middleDisplayStorage`, `highBulkStorage`, or `lowerFunctionalStorage`.
- `glassShelf`, `displayShelf`: `middleDisplayStorage`.
- `woodTop`: `highBulkStorage`.
- `singleRail`, `doubleRail`: `lowerShortHang`, `highRailHang`, `upperShortHang`, or `longHang`.

## Replacement Rules

- A middle shelf can be added above the middle hanging rail when it does not reduce required hanging usability.
- Middle hanging rail may become cabinet, middle shelf, drawer, or jewelry box when the bay profile allows it.
- A cabinet can replace the middle rail when the bay still satisfies the required high hanging function or the bay is intentionally converted to storage.
- `drawerSingle` and `drawerDouble` can replace a middle shelf or storage slot, but should not be inserted into active hanging volume.
- A drawer must not be placed behind hanging clothes.
- Middle shelf may become drawer or jewelry.
- A high rail decides `longHang` vs `upperShortHang` based on free space below:
  - If the space below the high rail is greater than 1200 mm, classify as `longHang`.
  - If the space below the high rail is less than 1200 mm and contains a middle rail, cabinet, drawer, or shelf with valid clearance, classify as `upperShortHang`.
- Low shoe shelf storage should not be replaced by a drawer unless explicitly allowed by demand and ergonomic rules pass.
- High shelf always becomes top storage and never becomes drawer.
- Premium accessories should upgrade suitable functional zones instead of being forced into any available bay.
- Trouser rack belongs to `trouserRackLow` and must not inherit drawer ergonomic constraints.
- Jewelry box belongs to `jewelryReachable` and must not be treated as low floor storage.

## Shelf Rules

Shelf has three functional levels:

- Low Shelf: shoes.
- Middle Shelf: bags, folded clothes, storage boxes, and display storage.
- High Shelf: bedding, luggage, seasonal storage.

The High Shelf is effectively the Top Shelf.

## Upgrade Policy Relationship

Functional Zone Policy decides where components belong.

Upgrade Policy decides what components should be upgraded.

Basic should prefer hanging rails.

Recommended upgrade priority:

1. Wood shelves.
2. Cabinet.
3. DrawerSingle.
4. Trouser Rack.
5. Jewelry Box.
6. DrawerDouble.

Premium must preserve all Recommended upgrades, then continue upgrading.

Premium upgrade priority:

1. DrawerDouble.
2. Trouser Rack.
3. Jewelry Box.

For example, if Recommended already contains Cabinet, Premium must keep Cabinet. Premium should enhance the solution instead of replacing previous upgrades.

## Coexist Rules

Allowed combinations:

- Middle Hanging Rail + Upper Shelf.
- Drawer + High Hanging Rail.
- Trouser Rack + High Hanging Rail.
- Cabinet + High Hanging Rail.

## Suggested API Shape

```js
getFunctionalZoneCandidates({
  bay,
  templateRole,
  sourceRole,
  placements,
  demand,
  planType
});

selectFunctionalZoneForComponent({
  componentType,
  candidateZones,
  demand,
  planType,
  budgetContext
});

realizeFunctionalZonePlacement({
  functionalZone,
  componentType,
  bayPlacements,
  roomHeight,
  componentContext
});

canReplaceFunctionalZone({
  replacementComponentType,
  existingZone,
  targetZone,
  bayPlacements,
  demand
});

classifyHighRailUse({
  railPlacement,
  bayPlacements,
  roomHeight
});
```

These APIs should describe the functional-zone decision first. Exact placement height should be returned only by `realizeFunctionalZonePlacement()` after zone compatibility and replacement checks have passed.

## Initial Implementation Plan

1. Create a policy module, likely `src/rules/japaneseFunctionalZonePolicy.js`.
2. Keep it pure and side-effect free.
3. Integrate first with drawer merchandising only:
   - `addJapaneseDrawerMerchandisingPlacement()`
   - `createJapaneseDrawerMerchandisingPlacement()`
4. Use the policy to choose `drawerErgonomicStorage` before selecting a concrete drawer height.
5. Reject drawer placement inside active long-hang volume or behind hanging clothes.
6. Later extend validation for:
   - `jewelryBox` through `jewelryReachable`
   - `cabinet` through `cabinetLowStorage`
   - `trouserRack` through `trouserRackLow`
7. Only after those integrations are stable, consider replacing scattered hardcoded height arrays with functional-zone realization calls.

## Future Rule

Every future component should only declare its supported functional zones.

The planner should automatically determine:

1. Bay.
2. Functional Zones.
3. Components.
4. Physical heights.

New components should not require rewriting the planning algorithm.

## Non-goals

This policy must not replace or rewrite:

- Upgrade Policy.
- Layout Constraints.
- Scene rendering.
- Pricing.
- BOM.
- Case skeletons.
- Case matching.
- Product data.
- Visual asset selection.

The policy should cooperate with those systems by adding a placement decision layer between upgrade selection and concrete component placement.
