Manufacturing dimensions must never directly determine storage capacity. Storage capacity is determined by the functional bay width defined in Storage Rules. Manufacturing cut length exists only for production and should not influence planning-level capacity unless explicitly specified by a business rule.
Chapter 1 - System Principles

1. Purpose

The AI Planner automatically generates wardrobe solutions that are:

* Physically buildable
* Commercially manufacturable
* Logically organized
* Visually understandable

The planner must always prioritize real manufacturable solutions over visual presentation.

⸻

2. System Architecture

The planner is composed of independent layers.

Each layer has a single responsibility and must not interfere with the responsibilities of other layers.

Candidate Layer

Responsible for:

* User demand analysis
* Space planning
* Component selection
* Placement generation
* BOM generation
* Price calculation

The Candidate Layer represents the real product that will be manufactured.

⸻

Visual Layer

Responsible for generating decorative assets only.

Examples include:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Decorative objects

Visual assets are presentation only.

Visual assets are never real products.

⸻

Rendering Layer

Responsible for:

* Loading GLB models
* Positioning objects
* Rendering the scene
* Debug information

The Rendering Layer must never make business decisions.

⸻

3. Source of Truth

The Candidate Plan is the single source of truth.

The Candidate Plan determines:

* Layout
* Components
* Dimensions
* Product quantities
* BOM
* Price

Everything else must be derived from the Candidate Plan.

⸻

4. Separation of Responsibilities

Business logic, visual logic, and rendering logic must remain completely independent.

Business logic determines what exists.

Visual logic determines how it is presented.

Rendering logic determines how it is displayed.

No layer may modify another layer’s responsibility.

⸻

5. Visual Asset Principles

Visual Assets exist only to improve presentation and readability.

Visual Assets:

* may be generated
* may be skipped
* may be replaced
* may be hidden

Visual Assets must never affect:

* Candidate Plan
* Product selection
* Placement
* BOM
* Price
* Manufacturing result

⸻

6. Collision Principles

If a Visual Asset conflicts with another Visual Asset or a real component:

Priority:

1. Try another valid position.
2. Try another valid visual asset.
3. Skip the visual asset.

Never modify the real layout in order to accommodate decorative assets.

⸻

7. Reality First

Whenever visual presentation conflicts with physical reality:

Always preserve the real solution.

Never modify the real structure for visual appearance.

It is acceptable to remove decoration.

It is never acceptable to generate an impossible real design.

⸻

8. Rule Hierarchy

All future planner rules must follow this priority:

1. System Principles
2. Candidate Rules
3. Storage Rules
4. Layout Rules
5. Tier Rules
6. Visual Rules
7. Collision Rules
8. QA Rules
9. Rendering Rules

Lower-level rules must never violate higher-level rules.

⸻

9. Design Philosophy

The AI Planner is a manufacturing-oriented planning system, not a rendering tool.

Its primary objective is to generate real, manufacturable wardrobe solutions.

Visual presentation exists only to help users understand the generated solution and must never compromise the correctness of the real design.
Chapter 2 - System Architecture

2.1 Overall Workflow

The AI Planner follows a fixed workflow.

Every generated solution must pass through the following stages in order:

User Input
    ↓
Questionnaire
    ↓
Demand Analysis
    ↓
Storage Rules
    ↓
Candidate Plan Generation
    ↓
Tier Strategy
    ↓
Visual Asset Generation
    ↓
Collision Resolution
    ↓
Quality Assurance (QA)
    ↓
Scene Rendering
    ↓
Debug Report

No stage may skip or modify the responsibility of another stage.

⸻

2.2 User Input Layer

Responsibility

Collect all user requirements.

Examples include:

* Product system
* Room dimensions
* Layout type
* Budget
* Number of users
* Storage requirements
* User preferences

Forbidden

This layer must never:

* Generate layouts
* Select products
* Generate prices
* Generate visual assets

⸻

2.3 Storage Rule Layer

Responsibility

Determine which storage categories can be placed on which product components.

Examples:

* Short clothes
* Long clothes
* Shoes
* Bags
* Bedding
* Luggage
* Trousers

Storage Rules define capability only.

They do not determine the final design.

Forbidden

Storage Rules must never:

* Decide visual quantity
* Decide layout
* Generate placements
* Generate prices

⸻

2.4 Candidate Plan Layer

Responsibility

Generate the real wardrobe solution.

Including:

* Component selection
* Placement generation
* Bay allocation
* Cabinet allocation
* Shelf allocation
* Rail allocation
* BOM generation
* Price calculation

Candidate Plan represents the real product.

Everything that will be manufactured must originate from this layer.

Forbidden

Candidate Plan must never:

* Generate clothes
* Generate shoes
* Generate bags
* Generate bedding
* Generate luggage
* Generate decorative assets

⸻

2.5 Tier Strategy Layer

Responsibility

Generate different product levels.

Examples:

* Basic
* Value
* Premium

Tier Strategy determines differences in the real solution.

Examples include:

* Number of cabinets
* Number of shelves
* Number of drawers
* Number of accessories
* Overall storage capability

Forbidden

Tier Strategy must never modify visual assets.

⸻

2.6 Visual Planner Layer

Responsibility

Generate decorative assets based on the Candidate Plan.

Examples:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Decorative objects

Visual Assets exist only for presentation.

They are never real products.

Forbidden

Visual Planner must never:

* Modify Candidate Plan
* Modify BOM
* Modify Price
* Modify Product Selection
* Modify Real Placement

⸻

2.7 Collision Resolution Layer

Responsibility

Resolve conflicts between visual assets.

Priority:

1. Try another valid position.
2. Try another valid visual asset.
3. Skip the visual asset.

Forbidden

Collision Resolution must never:

* Move real components
* Modify real placements
* Modify Candidate Plan

Only visual assets may be skipped.

⸻

2.8 Quality Assurance Layer

Responsibility

Validate the generated visual presentation.

Typical checks include:

* Empty hanging rails
* Empty trouser racks
* Floating shoes
* Visual overlap
* Invalid luggage placement
* Clothes intersecting shelves
* Missing visual assets
* Tier differentiation

If validation fails:

Return to the Visual Planner and regenerate visual assets.

Never modify the Candidate Plan.

⸻

2.9 Rendering Layer

Responsibility

Display the generated solution.

Including:

* GLB loading
* Object positioning
* Lighting
* Camera
* Rendering
* Scene update

Rendering is responsible only for presentation.

Forbidden

Rendering must never make business decisions.

Rendering must never generate layouts.

Rendering must never modify visual rules.

⸻

2.10 Debug Layer

Responsibility

Expose runtime information for diagnostics.

Examples:

* Render ID
* Plan Type
* Candidate Plan ID
* Generated Visual Count
* Skipped Visual Count
* Skip Reasons
* Collision Report
* Runtime Status

Debug information exists only for development.

It must never affect planning logic or rendering results.

⸻

2.11 Data Flow

The system follows a one-way data flow.

User Input
    ↓
Storage Rules
    ↓
Candidate Plan
    ↓
Tier Strategy
    ↓
Visual Planner
    ↓
Collision Resolution
    ↓
Quality Assurance
    ↓
Scene Rendering

Each layer receives data from the previous layer.

No layer may modify the output of an earlier layer.

All information flows forward.

Backward modification is not allowed.
Chapter 3 - Storage Rules
### Storage Capacity vs Manufacturing Dimensions

Storage capacity is determined by the functional storage rules.

Manufacturing dimensions are determined by cutting rules.

Manufacturing dimensions shall never directly determine storage capacity unless explicitly defined by a business rule.

Examples:

- Bay Width determines storage capacity.
- Component Cut Length determines production dimensions.
- Visual Scale Width determines rendering only.

These three concepts must remain independent.
Planning Rules

≠

Manufacturing Rules

≠

Rendering Rules

3.1 Purpose

Storage Rules define the storage capability of the AI Planner.

Storage Rules determine:

* Which item categories exist.
* Which components support each item category.
* The minimum clearance requirements for each item.
* The default visual generation rules for each item.
* The placement priority when multiple valid locations exist.

Storage Rules do not generate Candidate Plans.

Storage Rules do not generate BOM.

Storage Rules do not calculate prices.

Storage Rules do not determine final placements.

Storage Rules only provide business rules that are consumed by later modules.

The single source of truth for Storage Rules is:

StorageRules.xlsx

Whenever possible, business rules should be modified in StorageRules.xlsx instead of JavaScript.

⸻

3.2 Storage Rule Modules

Storage Rules consist of the following modules.

ItemCategory

Defines all supported storage categories.

Examples:

* Short Clothes
* Long Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Trousers
* Jewelry

ItemCategory only defines what item categories exist.

It never defines:

* Placement
* Quantity
* Rendering
* Visual Assets

⸻

PlacementRule

Defines which real components can store each item category.

Examples:

Short Clothes

* Single Rail
* Double Rail

Shoes

* Wood Shelf
* Floor

Bags

* Wood Shelf
* Cabinet

PlacementRule only defines valid storage locations.

It never determines:

* Which location is selected.
* How many visual assets are generated.
* Which tier uses the location.

The final decision belongs to Candidate Plan and Visual Planner.

⸻

ComponentCapability

Defines which item categories each component supports.

Example:

Wood Shelf

supports:

* Shoes
* Bags
* Bedding

Single Rail

supports:

* Short Clothes
* Long Clothes

PlacementRule describes:

Item → Component

ComponentCapability describes:

Component → Item

Both rule sets must always remain consistent.

⸻

ConflictRule

Defines invalid storage combinations.

Examples:

* Long Clothes cannot be placed in areas without sufficient height.
* Large Luggage cannot be placed on undersized shelves.
* Shoes cannot overlap another visual asset.
* Bags cannot overlap another visual asset.

ConflictRule only determines whether a placement is valid.

It never resolves conflicts.

Conflict resolution belongs to Collision Rules.

⸻

ClearanceRule

Defines the minimum required storage space.

Examples:

* Minimum hanging height for Long Clothes.
* Minimum shelf height for Shoes.
* Minimum shelf height for Bags.
* Minimum clearance for Luggage.

ClearanceRule only determines whether a location is valid.

It never determines which location should be selected.

⸻

VisualRule

Defines the default visual generation rule for each item category.

Examples:

Short Clothes

ceil(count / 20)

Shoes

ceil(count / 2)

Bags

ceil(count / 5)

VisualRule only determines the theoretical number of Visual Assets.

The final visual count may still be limited by:

* Tier Rules
* Collision Rules
* QA Rules

⸻

PlacementPriority

Defines the preferred placement order when multiple valid locations exist.

PlacementPriority only applies after all locations have passed:

* PlacementRule
* ComponentCapability
* ClearanceRule
* ConflictRule

The planner should always try higher priority locations first.

If a location cannot be used, the planner should automatically try the next valid location.

Examples:

Shoes

Priority 1

* Shoe Shelf

Priority 2

* Floor Under Wood Shelf

Priority 3

* Other Floor Area

⸻

Bags

Priority 1

* Bag Shelf

Priority 2

* Wood Shelf

Priority 3

* Cabinet

⸻

Bedding

Priority 1

* Top Wood Shelf

Priority 2

* High Open Shelf

⸻

Small Luggage

Priority 1

* Top Wood Shelf

Priority 2

* High Open Shelf

Priority 3

* Floor Under Wood Shelf

Priority 4

* Other Floor Area

⸻

Large Luggage

Priority 1

* Floor Under Wood Shelf

Priority 2

* Other Floor Area

⸻

Trousers

Priority 1

* Trouser Rack

If the trouser visual overlaps with another visual asset, the planner should:

1. Try to adjust the visual height if allowed.
2. Try another valid visual asset.
3. Skip the visual asset.

The real Candidate Plan must never be modified.

⸻

3.3 Responsibility Boundary

Storage Rules may determine:

* Supported item categories.
* Supported components.
* Minimum clearance.
* Default visual generation rules.
* Placement priority.

Storage Rules must never determine:

* Candidate Plan.
* Placement generation.
* BOM.
* Price.
* Tier Strategy.
* Final Visual Position.
* Three.js Rendering.

⸻

3.4 Relationship with Other Modules

Storage Rules are executed before Candidate Plan generation.

Workflow:

User Input
    ↓
Storage Rules
    ↓
Candidate Plan
    ↓
Tier Strategy
    ↓
Visual Planner
    ↓
Collision Rules
    ↓
QA
    ↓
Scene Rendering

Storage Rules only provide business rules.

They must never modify the output of later modules.

⸻

3.5 Modification Principles

Whenever a new storage category is introduced:

Modify:

* StorageRules.xlsx

before modifying JavaScript.

Whenever a new component capability is introduced:

Modify:

* PlacementRule
* ComponentCapability

before modifying JavaScript.

JavaScript should only be extended when the rule cannot be represented by data.

Hard-coded storage rules should always be reviewed to determine whether they can be migrated into StorageRules.xlsx.

⸻

3.6 Core Principles

Storage Rules are the central business rule database of the AI Planner.

All storage capability should be defined in StorageRules.xlsx.

JavaScript is responsible for executing rules.

JavaScript is not responsible for creating business rules.

Whenever a rule can be expressed as data, it should be stored in StorageRules.xlsx instead of being hard-coded into JavaScript.
Chapter 4 - Candidate Plan Generation

4.1 Purpose

Candidate Plan represents the real wardrobe solution generated by the AI Planner.

A Candidate Plan must always be:

* Manufacturable
* Buildable
* Quotable
* Installable

Candidate Plan is the single source of truth for all real products.

Every downstream module, including:

* Tier Strategy
* Visual Planner
* Collision Rules
* QA
* Scene Rendering

must only consume Candidate Plan.

No downstream module is allowed to modify Candidate Plan.

⸻

4.2 Candidate Plan Structure

A complete Candidate Plan shall contain:

* Layout
* Bays
* Functional Zones
* Components
* Placements
* Storage Capacity
* BOM
* Price

Candidate Plan contains only real products.

Candidate Plan must never contain decorative assets.

Examples of decorative assets include:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Decorations

These belong to the Visual Planner.

⸻

4.3 Candidate Generation Workflow

Candidate Plan shall always be generated in the following order.

User Input
↓
Demand Analysis
↓
Storage Rules
↓
Functional Zone Planning
↓
Bay Planning
↓
Component Allocation
↓
Placement Generation
↓
Candidate Validation
↓
Candidate Plan

Every stage depends on the previous stage.

No stage may be skipped.

No stage may directly modify the output of an earlier stage.

⸻

4.4 Planning Priority

Candidate generation shall always follow the priorities below.

Priority 1 — Manufacturability

The solution must always be manufacturable.

The planner must never generate structures that cannot be produced, assembled or quoted.

⸻

Priority 2 — User Requirements

The planner must satisfy the user’s storage requirements whenever possible.

Examples include:

* Short Clothes
* Long Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Jewelry
* Trousers

Meeting user requirements is always more important than visual appearance.

⸻

Priority 3 — Storage Capacity

After satisfying user requirements, the planner should maximize storage efficiency.

Examples include:

* Storage volume
* Functional completeness
* Space utilization

⸻

Priority 4 — Budget

The generated solution should remain within the target budget whenever possible.

The planner may adjust component combinations.

The planner must not sacrifice core functionality solely to reduce cost.

⸻

Priority 5 — Space Efficiency

The planner should minimize wasted space.

Examples include:

* Empty bays
* Fragmented storage
* Unusable gaps

⸻

Priority 6 — Visual Balance

Visual balance should only be considered after all previous priorities have been satisfied.

Examples include:

* Left-right balance
* Vertical balance
* Symmetry
* Overall aesthetics

Visual appearance must never override a correct real solution.

⸻

4.5 Functional Zones

Candidate Plan shall first divide the wardrobe into functional zones.

Typical zones include:

* Short Hang
* Long Hang
* Shelf
* Drawer
* Jewelry
* Trouser
* Luggage
* Display

Functional Zones define usage only.

They do not define decorative assets.

⸻

4.6 Planning Strategy

Planning Strategy defines how the planner should organize the wardrobe before assigning components.

Typical planning principles include:

* Long hanging areas should remain continuous whenever possible.
* Short hanging areas should remain grouped together.
* Drawers should be placed within comfortable operating height.
* Frequently used storage should be located within easy reach.
* Low-frequency storage should preferentially use upper space.
* Large storage objects should preferentially use large continuous spaces.
* Small storage objects should preferentially use fragmented spaces.
* Functional zones should remain visually coherent.
* The planner should avoid unnecessary fragmentation.

Planning Strategy defines preferred organization.

It does not replace Storage Rules.

⸻

4.7 Component Allocation

After Functional Zones are determined, Candidate Plan shall allocate real components.

Examples:

Short Hang

* Single Rail
* Double Rail

Long Hang

* Single Rail

Shoes

* Wood Shelf

Trousers

* Trouser Rack

All component selections must satisfy:

* PlacementRule
* ComponentCapability
* ClearanceRule
* ConflictRule

Invalid component combinations must never be generated.

⸻

4.8 Bay Planning

The planner shall distribute Functional Zones across available bays.

Bay allocation should consider:

* User requirements
* Storage capacity
* Component compatibility
* Space utilization
* Future visual presentation
* Structural balance

The planner should avoid:

* Extremely narrow bays
* Unusable bays
* Excessive fragmented spaces
* Poor functional distribution

⸻

4.9 Candidate Validation

Every Candidate Plan must pass validation before entering the next stage.

Validation includes:

* User requirements satisfied
* Valid placements
* Clearance requirements satisfied
* Budget satisfied
* Manufacturable structure
* BOM generation successful
* Price generation successful

If validation fails:

Candidate Plan must be regenerated.

No downstream module shall execute.

⸻

4.10 Relationship with Tier Strategy

Basic, Value and Premium must each generate an independent Candidate Plan.

Tier differences must come from real product differences.

Examples include:

* Cabinet quantity
* Shelf quantity
* Drawer quantity
* Trouser Rack quantity
* Storage capacity
* Functional completeness
* Accessory configuration

Visual Assets must never be used to fake tier differences.

⸻

4.11 Relationship with Visual Planner

Visual Planner may only consume Candidate Plan.

Visual Planner may generate:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage

Visual Planner must never:

* Add components
* Remove components
* Modify placements
* Modify BOM
* Modify prices
* Modify Candidate Plan

Visual Assets exist only for presentation.

⸻

4.12 Core Principles

Candidate Plan is the only real wardrobe solution.

All real product information originates from Candidate Plan.

Candidate Plan determines:

* Product Structure
* Functional Zones
* Components
* Placements
* Storage Capacity
* BOM
* Price

Downstream modules may improve presentation.

They must never modify the real solution.

Whenever presentation conflicts with reality:

Reality always wins.
Chapter 5 - Budget Driven Upgrade Strategy

5.1 Purpose

Budget Driven Upgrade Strategy defines how the AI Planner upgrades a wardrobe solution based on the available budget.

The planner should never generate three completely independent solutions.

Instead, all solutions should evolve from a common base solution.

The planner shall always generate:

* Basic
* Value
* Premium

by progressively upgrading the same Candidate Plan.

⸻

5.2 Base Candidate

Every wardrobe solution shall begin with a Base Candidate.

The Base Candidate represents the lowest-cost manufacturable solution that satisfies the user’s essential storage requirements.

The Base Candidate must:

* Be manufacturable.
* Be quotable.
* Be installable.
* Satisfy minimum storage requirements.

The Base Candidate should minimize component cost while maintaining functional completeness.

For example, in the Japanese Closet System:

Mandatory components include:

* Posts
* Wood Top
* Structural Parts

The default storage component should be:

* Single Rail

because it is the lowest-cost storage component.

⸻

5.3 Upgrade Workflow

The planner shall always follow the workflow below.

Generate Base Candidate
↓
Calculate Remaining Budget
↓
Find Best Upgrade
↓
Apply Upgrade
↓
Update Budget
↓
Repeat
↓
Budget Exhausted
↓
Final Candidate

Each upgrade shall improve the existing Candidate Plan.

The planner must never discard the current solution and regenerate a completely different layout.

⸻

5.4 Upgrade Unit

Every upgrade shall replace or enhance existing real components.

Typical upgrades include:

Single Rail

↓

Wood Shelf

↓

Drawer

↓

Jewelry Drawer

Another example:

Empty Space

↓

Shelf

↓

Cabinet

Each upgrade must improve at least one of:

* Storage Capacity
* User Experience
* Accessibility
* Functional Completeness

Decorative improvements alone are not considered valid upgrades.

⸻

5.5 Upgrade Priority

When multiple upgrades are available, the planner shall prioritize upgrades using the following order.

Priority 1

Increase storage capacity.

Priority 2

Improve frequently used storage.

Priority 3

Improve accessibility.

Priority 4

Improve organization.

Priority 5

Improve presentation quality.

Visual appearance shall always have the lowest priority.

⸻

5.6 Budget Consumption

Every upgrade has a cost.

The planner shall continuously track the remaining budget.

Before applying an upgrade, the planner must verify:

* Upgrade Cost
* Remaining Budget

If the remaining budget is insufficient:

The upgrade shall not be applied.

The planner shall evaluate the next available upgrade.

⸻

5.7 Tier Definition

Basic

Represents the Base Candidate with only the highest-value upgrades that fit within the minimum budget.

Basic focuses on:

* Essential functionality
* Lowest manufacturable cost
* Core storage requirements

⸻

Value

Value builds upon Basic.

Additional upgrades should maximize:

* Storage efficiency
* Daily usability
* Cost performance

Value should represent the best balance between functionality and price.

⸻

Premium

Premium builds upon Value.

Additional upgrades should maximize:

* Functional completeness
* Storage capacity
* Convenience
* Display quality

Premium should represent the ideal solution within the available budget.

Premium shall never add components without practical value.

⸻

5.8 Upgrade Constraints

An upgrade must never:

* Change room dimensions.
* Modify wall geometry.
* Change user requirements.
* Replace the product system.
* Reduce existing functionality.

Every upgrade shall preserve the integrity of the Candidate Plan.

⸻

5.9 Relationship with Visual Planner

Budget Driven Upgrade Strategy only upgrades real components.

Visual Planner shall never influence upgrade decisions.

The following items must not be considered upgrades:

* More clothes
* More shoes
* More bags
* More luggage
* More decorations

Visual Assets exist only for presentation.

They must never be used to simulate higher product tiers.

⸻

5.10 Upgrade Principles

The planner should always spend the available budget where it creates the greatest practical value.

Each upgrade should provide measurable improvements in one or more of the following areas:

* Storage Capacity
* Accessibility
* Functional Completeness
* User Experience

Budget should never be spent solely to increase component quantity.

Every upgrade must improve the real wardrobe.

⸻

5.11 Core Principles

Basic, Value and Premium are not three independent designs.

They are three upgrade stages of the same Candidate Plan.

The planner should always begin with the lowest-cost manufacturable solution.

The planner should then continuously upgrade the solution until the available budget has been fully utilized.

Real product upgrades define solution quality.

Visual Assets do not.
Chapter 6 - Visual Asset Planning

6.1 Purpose

Visual Asset Planning is responsible for generating presentation assets based on the Candidate Plan.

The purpose of Visual Assets is to help users understand how the wardrobe will actually be used, improve visual communication, and create a realistic living experience.

Visual Assets are not real products.

Visual Assets do not participate in:

* Product Structure
* BOM
* Price
* Candidate Plan
* Manufacturing

Visual Assets exist only for presentation.

⸻

6.2 Visual Asset Categories

Visual Assets are divided into two categories.

Requirement Visuals

Requirement Visuals represent the user’s actual storage requirements.

Examples include:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Trousers
* Jewelry

Requirement Visuals communicate that the planner understands the user’s needs.

They are not decorative objects.

⸻

Decoration Visuals

Decoration Visuals improve presentation quality only.

Examples include:

* Plants
* Decorative Boxes
* Books
* Sculptures
* Accessories
* Decorative Objects

Decoration Visuals do not represent user requirements.

They may be reduced or removed without affecting the solution.

⸻

6.3 Visual Generation Workflow

Visual Assets shall always be generated using the following workflow.

Candidate Plan
↓
Storage Rules
↓
Visual Rules
↓
Placement Priority
↓
Visual Placement
↓
Collision Resolution
↓
Visual QA
↓
Scene Rendering

Visual Assets must always be generated from the Candidate Plan.

Visual Assets shall never generate or modify real products.

⸻

6.4 Requirement Representation

Requirement Visuals represent storage requirements rather than actual item quantities.

The objective is not to display every item owned by the user.

The objective is to demonstrate that the planner has correctly understood the user’s storage needs.

Examples:

* A user owning thirty pairs of shoes does not require thirty shoe models.
* A user owning ten bags does not require ten bag models.
* A user owning multiple luggage items does not require every suitcase to be displayed.

Instead:

* Every shoe storage area should contain at least one shoe visual.
* Every bag storage area should contain at least one bag visual.
* Every long hanging area should contain long clothes.
* Every short hanging area should contain short clothes.
* Every luggage storage area should contain luggage whenever possible.

Requirement Visuals should disappear only when no valid placement exists.

⸻

6.5 Visual Placement

Visual Assets must always attach to real products.

Examples:

Clothes

* Single Rail
* Double Rail

Shoes

* Wood Shelf
* Shoe Shelf
* Floor

Bags

* Shelf
* Cabinet

Bedding

* Top Shelf

Luggage

* Top Shelf
* Floor

Visual Assets shall never exist without a valid supporting product.

⸻

6.6 Visual Density

Visual Density controls the amount of presentation, not the existence of storage categories.

Basic

* Lower density.
* Fewer clothing models.
* Simpler presentation.

Value

* Medium density.
* More complete presentation.

Premium

* Highest density.
* Richest presentation.
* Closest to a real living environment.

Requirement Visual categories shall remain consistent across all tiers whenever space allows.

Only the density of presentation should vary.

⸻

6.7 Visual Priority

Requirement Visuals always have higher priority than Decoration Visuals.

Priority Order:

1. Clothes
2. Shoes
3. Bags
4. Bedding
5. Luggage
6. Jewelry
7. Decoration Visuals

When available space becomes limited, lower-priority visuals should be reduced first.

Requirement Visuals should only be removed as a last resort.

⸻

6.8 Visual Collision Strategy

Visual Assets shall never overlap with:

* Real Products
* Walls
* Other Visual Assets

When collisions occur, Candidate Plan must remain unchanged.

Only Visual Assets may be adjusted.

⸻

6.9 Visual Auto Adjustment

When a Visual Asset cannot be placed successfully, the planner shall attempt the following actions in order.

Step 1

Adjust the visual position.

Step 2

Try another valid placement.

Step 3

Replace the visual with a smaller version.

Example:

Large Luggage

↓

Small Luggage

Step 4

Reduce presentation density.

Example:

Three clothing models

↓

Two clothing models

↓

One clothing model

Step 5

Skip the visual.

Skipping a Requirement Visual is only allowed when no valid placement remains.

Candidate Plan must never be modified.

⸻

6.10 Visual QA

After all Visual Assets have been generated, the planner shall validate:

* Floating objects
* Geometry intersections
* Visual overlap
* Outside product boundaries
* Outside room boundaries
* Invalid support surfaces
* Missing Requirement Visuals
* Presentation consistency

Visual QA may adjust or remove Visual Assets.

Visual QA must never modify the Candidate Plan.

⸻

6.11 Relationship with Candidate Plan

Candidate Plan defines the real wardrobe.

Visual Planner defines how the wardrobe is presented.

Candidate Plan determines:

* Components
* Placements
* Storage Capacity
* BOM
* Price

Visual Planner determines:

* Visual Assets
* Visual Positions
* Visual Density
* Presentation Quality

Visual Planner must never modify the Candidate Plan.

⸻

6.12 Core Principles

Visual Assets exist to explain the real solution.

Reality always takes priority over presentation.

Whenever presentation conflicts with the real wardrobe:

* Adjust the Visual.
* Replace the Visual.
* Reduce the Visual density.
* Skip the Visual if necessary.

Never modify the Candidate Plan.

Requirement Visuals should always be represented whenever valid placement exists.

Decoration Visuals are optional.

Visual Assets improve understanding.

They never define the real wardrobe.
Chapter 7 - Placement Strategy

7.1 Purpose

Placement Strategy defines where each Visual Asset should be placed within the Candidate Plan.

Visual Planner determines what should be displayed.

Placement Strategy determines where each Visual Asset should be displayed.

Placement Strategy does not:

* Generate Candidate Plans
* Modify Product Structure
* Modify Placements
* Modify BOM
* Modify Price
* Control Visual Density

Its sole responsibility is to find the most appropriate placement for every Visual Asset.

⸻

7.2 Placement Principles

Every Visual Asset must be attached to a real product.

Visual Assets shall never exist without a valid supporting object.

Examples:

Clothes

* Single Rail
* Double Rail

Shoes

* Wood Shelf
* Shoe Shelf
* Floor

Bags

* Shelf
* Cabinet

Bedding

* Top Shelf

Luggage

* Top Shelf
* Floor

Every Visual Asset must have exactly one valid support surface.

⸻

7.3 Placement Workflow

Placement shall always follow the workflow below.

Visual Asset
↓
Find All Valid Support Surfaces
↓
Calculate Placement Score
↓
Sort Candidate Surfaces
↓
Select Best Surface
↓
Placement Validation
↓
Placement Success
↓
Fallback Strategy (if necessary)

Placement shall always be deterministic.

Random placement is not allowed.

⸻

7.4 Storage Semantics

Storage surfaces are not only physical supports.

They also carry semantic meaning.

Different storage heights, widths and depths naturally imply different intended storage purposes.

The planner should always prefer the surface whose spatial characteristics best match the Visual Asset being placed.

Typical examples:

Available Clear Height	Preferred Storage
180–280 mm	Shoes
280–450 mm	Bags
450–700 mm	Folded Clothes / Bedding
Above 700 mm	Luggage

Storage semantics should influence placement scoring.

They should not directly override Placement Rules.

⸻

7.5 Placement Priority

When multiple valid support surfaces exist, Placement Strategy shall always evaluate them according to predefined priorities.

Typical examples:

Shoes

1. Wood Shelf
2. Shoe Shelf
3. Floor Under Shelf
4. Other Floor
5. Skip

Bags

1. Cabinet
2. Shelf
3. Display Shelf
4. Skip

Luggage

1. Top Shelf
2. Large Floor Area
3. Small Floor Area
4. Smaller Luggage Model
5. Skip

Clothes

1. Assigned Rail
2. Compatible Rail
3. Skip

Placement priorities shall always be deterministic.

⸻

7.6 Placement Scoring

When more than one valid support surface is available, the planner shall calculate a placement score for each candidate.

Typical scoring factors include:

* Support Compatibility
* Storage Semantics
* Available Height
* Available Width
* Available Depth
* Remaining Free Space
* Accessibility
* Visual Balance
* Existing Occupancy
* Collision Risk

The support surface with the highest score shall be selected.

Random selection is not allowed.

⸻

7.7 Placement Validation

Before placing a Visual Asset, the planner shall verify:

* Support surface exists.
* Surface dimensions are sufficient.
* Clearance requirements are satisfied.
* The asset remains inside the support surface.
* The asset does not penetrate walls.
* The asset does not intersect real products.

If validation fails, another valid placement shall be attempted.

⸻

7.8 Placement Fallback Strategy

If the preferred placement fails, the planner shall attempt the following actions in order:

Step 1

Try another valid support surface.

Step 2

Try another placement position on the same surface.

Step 3

Replace the asset with a smaller compatible model.

Example:

Large Luggage

↓

Small Luggage

Step 4

Reduce visual density.

Example:

Three clothing models

↓

Two clothing models

↓

One clothing model

Step 5

Skip the Visual Asset.

Skipping Requirement Visuals is only allowed when no valid placement remains.

⸻

7.9 Placement Constraints

Placement Strategy must never:

* Modify Candidate Plan.
* Add real products.
* Remove real products.
* Change product placement.
* Modify BOM.
* Modify Price.

Placement Strategy may only modify Visual Assets.

⸻

7.10 Placement Examples

Examples:

Shoes

Prefer Wood Shelves.

If no suitable shelf exists:

Try the floor area beneath shelves.

If still unavailable:

Try other floor areas.

Otherwise:

Skip.

⸻

Large Luggage

Prefer Top Shelves.

If insufficient height exists:

Replace with Small Luggage.

If still impossible:

Try floor storage.

Otherwise:

Skip.

⸻

Short Clothes

Always prefer their assigned Short Hang rail.

Only use another compatible rail if no valid assigned rail exists.

⸻

7.11 Core Principles

Placement Strategy exists to find the best placement, not simply any valid placement.

Every placement should be:

* Logical
* Stable
* Explainable
* Consistent with user expectations

Storage semantics should always be considered together with Placement Rules.

Whenever multiple placements are valid, the planner shall select the placement that best matches both the intended storage purpose and the physical characteristics of the support surface.

Placement Strategy shall always preserve the integrity of the Candidate Plan.

Visual Assets may adapt.

Real products must never change.
Chapter 8 - Collision & Resolution Strategy

8.1 Purpose

Collision & Resolution Strategy defines how the AI Planner detects and resolves conflicts during Visual Asset placement.

The objective is not only to detect collisions, but also to preserve the integrity of the Candidate Plan while maximizing Requirement Visual representation.

Collision & Resolution Strategy shall never modify the real wardrobe.

It may only modify Visual Assets.

⸻

8.2 Collision Types

The planner shall detect the following collision types.

Visual vs Product

Examples:

* Clothes intersecting shelves
* Shoes penetrating shelves
* Bags extending outside cabinets
* Luggage intersecting walls

⸻

Visual vs Visual

Examples:

* Shoe overlapping shoe
* Bag overlapping bag
* Luggage overlapping shoes
* Clothes overlapping clothes

⸻

Visual vs Space

Examples:

* Outside room boundaries
* Outside support surfaces
* Outside wall limits
* Outside placement boundaries

⸻

8.3 Resolution Principles

Whenever a collision occurs, the planner shall always follow these principles.

Reality always takes priority.

Candidate Plan shall never change.

Visual Assets may be adjusted.

Requirement Visuals should be preserved whenever possible.

Decoration Visuals may be sacrificed first.

⸻

8.4 Resolution Workflow

Every collision shall follow the workflow below.

Detect Collision
↓
Adjust Position
↓
Try Alternative Placement
↓
Replace With Smaller Asset
↓
Reduce Visual Density
↓
Skip Decoration Visual
↓
Skip Requirement Visual
↓
Finish

Intermediate steps shall not be skipped.

The planner should always attempt to resolve a conflict before removing a Visual Asset.

⸻

8.5 Automatic Position Adjustment

The planner shall first attempt to resolve collisions by adjusting the current placement.

Examples include:

* Move left or right
* Move forward or backward
* Center within the support surface
* Adjust hanging height where allowed
* Align with the support surface

Position adjustment shall never exceed the boundaries of the supporting product.

⸻

8.6 Automatic Relocation

If the current support surface cannot satisfy placement requirements, the planner shall attempt another valid support surface.

Examples:

Shoes

Wood Shelf

↓

Floor Under Shelf

↓

Other Floor

↓

Skip

Bags

Cabinet

↓

Shelf

↓

Display Shelf

↓

Skip

Luggage

Top Shelf

↓

Floor

↓

Skip

The planner shall always follow Placement Priority.

⸻

8.7 Automatic Asset Replacement

If the available space is insufficient, the planner should replace the current asset with a smaller compatible asset whenever possible.

Examples:

Large Luggage

↓

Small Luggage

Wide Clothes Model

↓

Narrow Clothes Model

Large Shoe Model

↓

Small Shoe Model

Replacement should preserve Requirement Visual representation whenever possible.

⸻

8.8 Automatic Density Reduction

If replacement is still insufficient, the planner shall reduce presentation density.

Examples:

Three clothing models

↓

Two clothing models

↓

One clothing model

Multiple shoe models

↓

Single shoe model

Multiple bag models

↓

Single bag model

Density reduction affects presentation only.

It must never reduce the real storage capacity.

⸻

8.9 Automatic Skip

A Visual Asset may only be skipped after every valid resolution attempt has failed.

Requirement Visuals shall only be skipped when no valid placement exists.

Decoration Visuals may be skipped earlier according to priority.

The planner shall never skip Requirement Visuals as the first solution.

⸻

8.10 Requirement Visual Protection

Requirement Visuals represent user requirements.

Whenever possible, every storage category requested by the user should remain visually represented.

Examples:

If the user requires:

* Short Clothes
* Long Clothes
* Shoes
* Bags
* Bedding
* Luggage

The planner should preserve at least one valid visual representation for each category.

Reducing density is preferred over removing an entire category.

⸻

8.11 Resolution Priority

The planner shall always resolve conflicts using the following priority.

Priority 1

Adjust Position

Priority 2

Try Alternative Placement

Priority 3

Replace With Smaller Asset

Priority 4

Reduce Visual Density

Priority 5

Skip Decoration Visual

Priority 6

Skip Requirement Visual

Requirement Visuals shall always have the highest protection priority.

⸻

8.12 Resolution Constraints

Collision & Resolution Strategy must never:

* Modify Candidate Plan
* Add real products
* Remove real products
* Modify Placements
* Modify BOM
* Modify Price

Only Visual Assets may be modified.

⸻

8.13 Core Principles

Collision & Resolution Strategy exists to preserve both realism and usability.

The planner should always attempt to solve conflicts rather than remove content.

The planner shall follow these principles:

* Preserve Candidate Plan.
* Preserve Requirement Visuals.
* Prefer replacement over removal.
* Prefer density reduction over skipping.
* Skip only when no valid solution exists.

Visual Assets are allowed to adapt.

The real wardrobe must never change.
# Chapter 9 - Quality Assurance & Acceptance Criteria

## 9.1 Purpose

Quality Assurance is the final validation stage of the AI Planner.

Its purpose is to ensure that every generated solution is complete, manufacturable, understandable, and ready for delivery.

Quality Assurance does not generate Candidate Plans.

Quality Assurance does not modify budgets.

Quality Assurance performs validation, automatic correction where allowed, and final acceptance.

Only solutions that pass Quality Assurance may be delivered to users.

---

## 9.2 QA Workflow

Every generated solution shall pass through the following workflow.

```text
Candidate Plan

↓

Budget Upgrade

↓

Visual Asset Planning

↓

Placement Strategy

↓

Collision & Resolution

↓

Quality Assurance

↓

Acceptance

↓

Deliver
```

If any validation fails, the planner shall attempt automatic correction.

If correction is unsuccessful, the solution shall not be delivered.

---

## 9.3 Structural Validation

The planner shall verify that the real wardrobe is valid.

Validation includes:

- Product structure
- Component legality
- Placement legality
- Manufacturing feasibility
- Installation feasibility
- Budget consistency
- Storage Rule compliance

The real wardrobe must always remain manufacturable.

---

## 9.4 Storage Validation

The planner shall verify that user storage requirements have been satisfied.

Examples include:

- Short Clothes
- Long Clothes
- Shoes
- Bags
- Bedding
- Luggage
- Trousers
- Jewelry

Every requested storage category shall have a corresponding storage area whenever possible.

Storage requirements shall never disappear without a valid reason.

---

## 9.5 Requirement Visual Validation

The planner shall verify that Requirement Visuals correctly represent the user's storage requirements.

Examples include:

- Long hanging areas should contain long clothes.
- Short hanging areas should contain short clothes.
- Shoe storage should contain shoes.
- Bag storage should contain bags.
- Bedding storage should contain bedding.
- Luggage storage should contain luggage whenever valid placement exists.

Requirement Visuals should only be missing when no valid placement is available.

---

## 9.6 Placement Validation

The planner shall verify that every Visual Asset is correctly placed.

Validation includes:

- Valid support surface
- Inside support boundaries
- Correct alignment
- Proper contact with support surface
- No floating objects
- No penetration into products
- No penetration into walls

Every Visual Asset shall appear naturally supported.

---

## 9.7 Collision Validation

The planner shall verify that no unacceptable collisions remain.

Validation includes:

- Visual vs Product
- Visual vs Visual
- Visual vs Wall
- Visual vs Room Boundary

Only acceptable visual adjustments may remain.

Real products shall never be modified to resolve collisions.

---

## 9.8 Tier Validation

The planner shall verify that different solution tiers remain meaningfully different.

Validation includes:

Basic

- Lowest practical cost
- Essential functionality

Value

- Better storage efficiency
- Improved usability

Premium

- Highest functional completeness
- Best presentation quality

The planner shall ensure:

- Basic ≠ Value
- Value ≠ Premium
- Premium shall never provide less functionality than Value.
- Higher budgets shall produce meaningful real upgrades.

Visual density alone shall not define solution tiers.

---

## 9.9 Presentation Validation

The planner shall verify overall presentation quality.

Validation includes:

- No empty hanging rails
- No empty trouser racks
- No floating shoes
- No floating bags
- No unsupported luggage
- No obvious visual overlap
- No unrealistic presentation

Presentation should appear natural, logical and easy to understand.

---

## 9.10 Acceptance Criteria

A solution may only be delivered when all of the following requirements are satisfied.

- Candidate Plan is valid.
- Product structure is manufacturable.
- Storage requirements are satisfied.
- Requirement Visuals are properly represented.
- Placement validation passes.
- Collision validation passes.
- Tier differentiation is valid.
- Presentation quality is acceptable.

Failure of any mandatory requirement shall prevent delivery.

---

## 9.11 Acceptance Gates

Quality Assurance shall evaluate solutions using multiple acceptance gates.

Gate 1

Structure Validation

Gate 2

Storage Validation

Gate 3

Requirement Visual Validation

Gate 4

Placement Validation

Gate 5

Collision Validation

Gate 6

Tier Validation

Gate 7

Presentation Validation

A solution shall only pass Quality Assurance after every gate has been successfully completed.

---

## 9.12 Core Principles

Quality Assurance is the final quality control stage of the AI Planner.

The objective of the planner is not simply to generate a solution.

The objective is to generate a solution that is ready to be delivered.

Whenever quality conflicts arise, the planner shall always preserve the following priorities:

1. Candidate Plan
2. Product Integrity
3. User Requirements
4. Requirement Visuals
5. Correct Placement
6. Collision Resolution
7. Presentation Quality

Every delivered solution should be:

- Manufacturable
- Functional
- Understandable
- Visually consistent
- Ready for quotation
- Ready for presentation
Appendix A - Data Dictionary

Purpose

The Data Dictionary defines the meaning of all core business concepts used throughout the AI Planner.

Every module, rule, algorithm and developer shall use these definitions consistently.

Different names shall never be used for the same business concept.

⸻

Candidate Plan

The real wardrobe solution generated by the AI Planner.

A Candidate Plan contains only real products.

It defines:

* Product Components
* Placements
* Storage Capacity
* BOM
* Price

A Candidate Plan never contains Visual Assets.

⸻

Product Component

A real manufacturable product.

Examples include:

* Post
* Wood Shelf
* Wood Top
* Cabinet
* Single Rail
* Double Rail
* Trouser Rack

Product Components determine the real wardrobe.

⸻

Placement

A specific instance of a Product Component within a Candidate Plan.

Every Placement has:

* Position
* Rotation
* Size
* Product Type

Placements represent real products.

⸻

Bay

The horizontal space between two adjacent structural posts.

A Bay is the smallest planning unit of the wardrobe.

Most storage decisions are evaluated at the Bay level.

⸻

Zone

A functional storage area inside a Bay.

Examples include:

* Short Hang Zone
* Long Hang Zone
* Shoe Zone
* Bag Zone
* Bedding Zone
* Luggage Zone

A Zone represents intended storage usage rather than physical products.

⸻

Storage Category

A category of user storage requirements.

Examples include:

* Short Clothes
* Long Clothes
* Shoes
* Bags
* Bedding
* Luggage
* Jewelry
* Trousers

Storage Categories originate from user requirements.

⸻

Support Surface

A real surface capable of supporting a Visual Asset.

Examples include:

* Shelf Top
* Cabinet Shelf
* Floor
* Hanging Rail

Visual Assets shall always attach to a Support Surface.

⸻

Visual Asset

A presentation object generated by the planner.

Examples include:

* Clothes
* Shoes
* Bags
* Bedding
* Luggage

Visual Assets are not real products.

They exist only for presentation.

⸻

Requirement Visual

A Visual Asset representing a user storage requirement.

Requirement Visuals communicate that the planner has understood the user’s needs.

They should remain whenever valid placement exists.

⸻

Decoration Visual

A Visual Asset used only for presentation quality.

Decoration Visuals are optional.

They may be reduced or removed without affecting the solution.

⸻

Placement Score

The evaluation score used to select the best support surface.

Placement Score may include:

* Compatibility
* Storage Semantics
* Available Space
* Accessibility
* Visual Balance
* Collision Risk

The planner shall always choose the highest-scoring valid placement.

⸻

Collision

Any invalid intersection between:

* Visual and Product
* Visual and Visual
* Visual and Space

Collisions shall be resolved without modifying the Candidate Plan.

⸻

Quality Assurance

The final validation stage before delivery.

Only solutions passing Quality Assurance may be delivered to users.
Appendix B - Naming Convention

Purpose

Naming Convention ensures that the entire AI Planner uses a consistent vocabulary.

Consistent naming improves readability, maintainability and collaboration.

⸻

File Naming

Rule documents:

* StorageRules.xlsx
* PlacementRules.xlsx
* UpgradeRules.xlsx
* ResolutionRules.xlsx
* ValidationRules.xlsx

Markdown documents:

* SYSTEM_PRINCIPLES.md
* STORAGE_RULES.md
* CANDIDATE_GENERATION.md
* VISUAL_ASSET_PLANNING.md

⸻

Function Naming

Functions should clearly describe their responsibility.

Preferred prefixes:

* build
* calculate
* generate
* validate
* resolve
* score
* select
* collect
* detect
* find

Examples:

* buildCandidatePlan()
* calculatePlacementScore()
* generateVisualAssets()
* validateCandidate()
* resolveCollision()
* scoreSupportSurface()

Avoid ambiguous names such as:

* process()
* handle()
* updateData()
* temp()
* doSomething()

⸻

Variable Naming

Business variables should always use meaningful names.

Examples:

* candidatePlan
* placement
* supportSurface
* visualAsset
* storageCategory
* requirement
* collision
* validationResult

Avoid:

* data
* item
* object
* temp
* value1
* test

⸻

Class Naming

Classes should represent business concepts.

Examples:

* CandidatePlan
* PlacementEngine
* VisualPlanner
* CollisionEngine
* QualityAssurance

⸻

Boolean Naming

Boolean variables should always answer a question.

Examples:

* isValid
* hasCollision
* canPlace
* shouldSkip
* requiresUpgrade

⸻

Constant Naming

Constants shall use uppercase.

Examples:

* MAX_VISUAL_DENSITY
* MIN_CLEAR_HEIGHT
* DEFAULT_BAY_WIDTH

⸻

General Principles

Business concepts shall always use the same name throughout the project.

One concept should have one name.

One name should represent one concept.
Appendix C - Rule Priority

Purpose

Rule Priority defines the execution order of every business rule.

Higher-level rules always override lower-level rules.

No lower-level module may violate a higher-level rule.

⸻

Rule Hierarchy

Level 1

System Principles

↓

Level 2

Storage Rules

↓

Level 3

Candidate Generation

↓

Level 4

Budget Driven Upgrade

↓

Level 5

Visual Asset Planning

↓

Level 6

Placement Strategy

↓

Level 7

Collision & Resolution

↓

Level 8

Quality Assurance

⸻

Priority Principles

Whenever two rules conflict:

The higher-level rule shall always prevail.

Examples:

Storage Rules override Placement Strategy.

Candidate Plan overrides Visual Assets.

Requirement Visuals override Decoration Visuals.

Reality overrides Presentation.

Quality Assurance overrides delivery.

⸻

Appendix D - Development Principles

Purpose

Development Principles define the long-term engineering philosophy of the AI Planner.

Every implementation should follow these principles.

⸻

Principle 1

Data Before Code

Business rules should be stored in structured data whenever possible.

Prefer Excel or configuration files over hard-coded JavaScript.

⸻

Principle 2

Rules Before Algorithms

Algorithms execute business rules.

Algorithms should not create business rules.

⸻

Principle 3

Reality Before Presentation

Real products always have higher priority than Visual Assets.

Presentation shall never modify the real wardrobe.

⸻

Principle 4

Requirement Before Decoration

Requirement Visuals represent user needs.

Decoration Visuals improve presentation only.

Requirement Visuals always have higher priority.

⸻

Principle 5

Placement Before Collision

The planner should first choose the best placement.

Collision Resolution should only solve remaining conflicts.

⸻

Principle 6

Resolve Before Skip

The planner should always attempt:

Adjust

↓

Relocate

↓

Replace

↓

Reduce Density

↓

Skip

Skipping shall always be the last option.

⸻

Principle 7

Quality Before Delivery

Every solution shall pass Quality Assurance before delivery.

Solutions failing QA shall never be presented to users.

⸻

Principle 8

Deterministic Behavior

The planner should always produce explainable and repeatable results.

Random decisions are not allowed.

⸻

Principle 9

Single Responsibility

Each module should have one clear responsibility.

Storage Rules determine storage capability.

Candidate Generation builds real products.

Upgrade Strategy improves real products.

Visual Planning generates presentation assets.

Placement Strategy selects support surfaces.

Collision & Resolution resolves conflicts.

Quality Assurance validates the final solution.

Modules should not perform responsibilities belonging to other modules.

⸻

Principle 10

Long-Term Maintainability

The AI Planner should be driven by rules rather than hard-coded logic.

Whenever possible, new business behavior should be added by extending rules instead of modifying algorithms.

The objective is to make the planner easier to maintain, easier to expand and easier to understand over time.