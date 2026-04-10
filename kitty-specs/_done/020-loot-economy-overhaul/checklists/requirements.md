# Specification Quality Checklist: Loot & Economy Overhaul

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — *constraints section names Phaser/JS but only as immutable platform context, not as implementation choices*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — *most sections; the Key Entities section is necessarily semi-technical because the data shape IS the contract*
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Requirement types are separated (Functional / Non-Functional / Constraints)
- [x] IDs are unique across FR-###, NFR-###, and C-### entries
- [x] All requirement rows include a non-empty Status value (`proposed`)
- [x] Non-functional requirements include measurable thresholds
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified — *via Out of Scope + Assumptions sections*
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — *the User Scenarios cross-reference specific FR groups*
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The spec is ready for `/spec-kitty.plan`.
- Affix pool size, gold drop ranges, elite spawn rates, and reroll cost formulas are all documented at a level concrete enough for a planner agent to break into work packages without re-asking the user.
- Migration strategy is **strict** — old `rarity`/`rarityValue`/`enhanceLevel` fields are stripped, items become Common (0 affixes). The constraint is documented in C-001 + FR-026.
- Mara as vendor is decided (Option C from discovery) — no new NPC or hub building required.
- Health potion mechanics are fully specified (HoT 60% over 3s, F-key, 2s global CD, 4 tiers).
- Enchanted enemies are fully specified including the affix pool examples and the Champion vs Unique distinction.
- Ability-modifier affixes (per-ability damage / per-ability cooldown / global modifiers) are documented in FR-029..FR-033 with explicit statKey naming, the AggregatedBonuses cache contract, and the HUD visualization requirement. These add a build-defining layer to the loot loop.

## Final stats

- **33 Functional Requirements** (FR-001 through FR-033)
- **6 Non-Functional Requirements** with measurable thresholds
- **5 Constraints**
- **7 acceptance scenarios** including the build-defining drop scenario
- **0 NEEDS CLARIFICATION markers**
