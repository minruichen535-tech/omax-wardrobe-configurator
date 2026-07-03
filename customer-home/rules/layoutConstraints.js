/**

* Layout Constraints
* This file defines hard structural layout rules.
* Source of Truth:
* LayoutConstraints only validates, protects, and removes invalid placements.
* It must NOT freely generate new hanging rails based only on shelf count.
* Execution timing:
* Run after candidate placements are generated/upgraded,
* and before Visual Asset planning.
    ⸻
* Definitions
    ⸻
* Hanging Rail:
* ￼	singleRail
* ￼	doubleRail
* Wood Shelf:
* ￼	woodShelf
* Cabinet-like Component:
* ￼	cabinet
* ￼	drawer
* ￼	drawerCabinet
* ￼	storageCabinet
* Occupied Surface:
* The top surface of a real product below a hanging rail.
* Includes:
* ￼	woodShelf
* ￼	cabinet
* ￼	drawer
* ￼	drawerCabinet
* ￼	storageCabinet
* ￼	jewelryBox
* ￼	trouserRack
* Nearest Lower Occupied Surface:
* The closest occupied surface directly below a rail.
* Ignore all occupied surfaces above the rail.
* Clear Hanging Height:
* railHeight - nearestLowerOccupiedSurface
* Valid Clear Hanging Height:
* 700mm – 1200mm
* Minimum Rail-to-Rail Center Distance:
* 650mm
    ⸻
* LC-000 Core Zone Protection
    ⸻
* Layout Constraints must not change the functional purpose of a bay.
* longHangZone:
* ￼	Must keep one high hanging rail if one exists.
* ￼	Do not convert to double short hang.
* ￼	Do not remove its only high rail because of shelf-count rules.
* shortHangZone:
* ￼	May keep up to two valid rails.
* ￼	Do not force long-hang behavior.
* shoeShelfZone / shoeZone / storageZone / storageAccessoryZone
* luggageZone / topStorageZone / displayShelfZone / beddingZone:
* ￼	Do not auto-add hanging rails.
* ￼	Only remove rails when they violate hard constraints.
------------------------------------------------------------
LC-000A Bay Functional Source of Truth
------------------------------------------------------------

The functional purpose of a bay MUST be determined
by templateRole.

Do NOT infer bay purpose from:

- woodShelf count
- componentType
- zoneType
- visual appearance

Reason:

zoneType describes the function of an individual component.

templateRole describes the intended function of the bay.

Examples:

A storageAccessoryZone bay may contain:

singleRail
zoneType = shortHangZone

This does NOT make the bay a shortHang bay.

Likewise,

a trouserZone bay may contain rails whose
zoneType is shortHangZone.

The bay is still a trouserZone.

Therefore:

All LayoutConstraints decisions
must use templateRole
as the bay functional Source of Truth.
LC-000

Visual Consistency

Within the same wall,

the hanging rail heights should remain aligned.

Preferred standard heights:

1050
2000

Do not generate intermediate rail heights
such as 1500–1800.

If a standard height cannot be placed,
omit the rail rather than introducing
a visually inconsistent height.
If a bay contains any hanging function
(shortHangZone / longHangZone),

it must retain at least one valid
high hanging rail (2000mm),

unless:

1. Cabinet blocks it.
2. Dense shelves physically block it.
3. Clear hanging height is below 700mm.

Do not remove the last valid high rail
only because of optimization.
    ⸻
    
* LC-001 Shelf Count Limits
    ⸻
* Shelf count limits are maximum limits, not generation rules.
* If a bay has 1–4 woodShelf:
* ￼	Maximum allowed rails: 2
* ￼	Do not automatically add rails if none exist.
* If a bay has exactly 5 woodShelf:
* ￼	Maximum allowed rails: 1
* ￼	Do not automatically add rails if none exist.
* If a bay has 6 or more woodShelf:
* ￼	Remove all hanging rails,
* ￼	except protected longHangZone main rail.
    ⸻
* LC-002 Cabinet Rail Rule
    ⸻
* If a bay contains cabinet-like components:
* ￼	Keep only the highest hanging rail.
* ￼	Remove all lower/additional rails.
* Reason:
* A cabinet occupies the lower storage area.
* The upper area may only contain one hanging zone.
    ⸻
* LC-003 Clear Hanging Height Validation
    ⸻
* For every existing hanging rail:
* ￼	Find the nearest occupied surface directly below the rail.
* ￼	Ignore occupied surfaces above the rail.
* ￼	Calculate clear hanging height.
* If clear hanging height is outside 700mm–1200mm:
* ￼	Remove the rail,
* ￼	unless it is the protected main rail of a longHangZone.
    ⸻
* LC-004 Rail Spacing Rule
    ⸻
* If a bay has two hanging rails:
* ￼	Their center distance must be at least 650mm.
* If the rails are too close:
* ￼	Keep the more useful rail pair if possible.
* ￼	Otherwise keep only the better rail.
* Priority for keeping rails:
* 1.	Protected longHangZone rail
* 2.	Existing template rail
* 3.	Higher rail
* 4.	Synthetic/generated rail
    ⸻
* Debug Output
    ⸻
* For each bay, output:
* ￼	bayIndex
* ￼	zoneType / templateZone / templateRole
* ￼	woodShelfCount
* ￼	railCountBefore
* ￼	railHeightsBefore
* ￼	railCountAfter
* ￼	railHeightsAfter
* ￼	appliedConstraints
* ￼	skippedConstraints
* ￼	protectedReason
* ￼	removedPlacementIds
    ⸻
* Validation
    ⸻
* Required checks:
* 1.	longHangZone keeps one high rail.
* 2.	shortHangZone can keep two valid rails.
* 3.	shelf-only bay does not auto-add rails.
* 4.	luggageZone does not auto-add rails.
* 5.	shoeShelfZone does not auto-add rails.
* 6.	6+ shelf bay removes rails unless protected longHangZone.
* 7.	cabinet bay keeps only the highest rail.
* 8.	clear hanging height uses nearest lower occupied surface.
* 9.	no two rails are closer than 650mm.
        */