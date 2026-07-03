“The Rulebook is the single source of truth. If the implementation conflicts with the Rulebook, the Rulebook shall prevail.”
AI Wardrobe Planner

Overview

AI Wardrobe Planner is an AI-driven wardrobe planning system that automatically generates manufacturable wardrobe solutions based on user requirements, room dimensions and budget.

The planner is designed to produce solutions that are:

* Manufacturable
* Quotable
* Installable
* Budget-aware
* Storage-oriented
* Visually understandable

The planner is not a rendering tool.

Rendering is only the final presentation of the planning result.

The primary objective is to generate correct wardrobe solutions.

⸻

Project Objectives

The long-term goal of this project is to build an AI Planner capable of automatically:

* Understanding user storage requirements
* Generating real wardrobe layouts
* Optimizing solutions within budget
* Producing realistic presentation visuals
* Explaining design decisions
* Delivering production-ready solutions

The planner should think like an experienced wardrobe designer rather than simply placing components.

⸻

Project Structure

README.md
        ↓
VISION.md
        ↓
PLANNER_RULEBOOK/
        ↓
Rule Excel Files
        ↓
Source Code

⸻

Rulebook

All business logic is defined inside the Rulebook.

The Rulebook is the single source of truth for every planning decision.

PLANNER_RULEBOOK/
01_System_Principles.md
02_System_Architecture.md
03_Storage_Rules.md
04_Candidate_Generation.md
05_Budget_Upgrade.md
06_Visual_Asset_Planning.md
07_Placement_Strategy.md
08_Collision_Resolution.md
09_Quality_Assurance.md
Appendix_A_Data_Dictionary.md
Appendix_B_Naming_Convention.md
Appendix_C_Rule_Priority.md
Appendix_D_Development_Principles.md

The Rulebook defines:

* Business Rules
* Planning Logic
* Upgrade Strategy
* Placement Strategy
* Collision Resolution
* Quality Assurance

Business rules should never be hard-coded when they can be represented by data.

⸻

Rule Data

Business rules should be stored in structured data whenever possible.

Current rule files include:

* StorageRules.xlsx
* PlacementRules.xlsx
* UpgradeRules.xlsx
* ResolutionRules.xlsx
* ValidationRules.xlsx

The planner should always read these rule definitions before introducing new business logic.

⸻

Source Code Responsibilities

The source code is responsible for executing rules.

It should not invent business rules.

Typical responsibilities include:

* Reading rule data
* Building Candidate Plans
* Calculating placement scores
* Generating Visual Assets
* Detecting collisions
* Running Quality Assurance
* Rendering the final result

Whenever possible, business behavior should be configurable rather than hard-coded.

⸻

Development Workflow

All development should follow the workflow below.

Read README
↓
Read VISION
↓
Read Rulebook
↓
Read Rule Data
↓
Understand Existing Logic
↓
Implement Changes
↓
Run Validation
↓
Deliver

Developers and AI coding assistants should always understand the existing architecture before modifying the project.

⸻

General Principles

Every contribution should follow these principles.

* Reality before Presentation.
* Rules before Algorithms.
* Data before Code.
* Requirement before Decoration.
* Resolve before Skip.
* Quality before Delivery.

The planner should always generate solutions that are:

* Manufacturable
* Functional
* Explainable
* Consistent
* Ready for quotation
* Ready for presentation

⸻

For AI Coding Assistants

Before making any modification:

1. Read VISION.md.
2. Read the Rulebook.
3. Follow the existing architecture.
4. Preserve business rules.
5. Avoid introducing hard-coded business behavior.
6. Keep modules independent and maintainable.
7. Validate changes before completion.

The goal is not only to make the code work.

The goal is to preserve the long-term architecture of the AI Planner.