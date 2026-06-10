---
work_package_id: WP01
title: Polish-Pass Implementation
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-08
- FR-09
- FR-10
- FR-11
- NFR-01
- NFR-02
- NFR-03
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 5290942ccc83e1300983e19e915fa7d1925d2d04
created_at: '2026-05-14T18:38:00Z'
shell_pid: "0"
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 — Polish
assignee: ''
agent: claude
history:
- timestamp: '2026-05-14T18:38:00Z'
  lane: planned
  agent: system
  action: Retroactive WP documentation for feature 051 (commit 4bdf4d2)
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files:
- js/tutorialSystem.js
- js/eventSystem.js
- js/scenes/SettingsScene.js
- js/scenes/HubSceneV2.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — Polish-Pass Implementation

## Objective

Ship the four in-scope polish items from feature 051 (intro splash, outro splash, skip-tutorial toggle, three Akt-1 lore fragments). Implementation happened direct-on-main as commit `4bdf4d2` before this WP file was authored — this is a retroactive bookkeeping record so spec-kitty acceptance + merge cleanup work.

Hub visual + audio atmosphere from spec §1 item 3 is DEFERRED — needs new art/audio assets, separate issue.

## Subtasks

- [x] **T001** Skip-tutorial toggle in `SettingsScene.js`: gameplay.skipTutorial setting + Tutorial-section toggle row + applySettings exposing `window.__SKIP_TUTORIAL__`.
- [x] **T002** Tutorial-skip wiring in `tutorialSystem.maybeAutoSkip` — OR's hasSave with the new flag.
- [x] **T003** Three Akt-1 lore fragments in `eventSystem.js` text pool with DE + EN.
- [x] **T004** Splash modal helpers + triggers in `HubSceneV2`: intro on first hub entry, outro after Q6 completion, both single-shot via localStorage, mobile-safe via `_ktPropagateScrollFactor`.
- [x] **T005** Smoke check — 251 tests green; splashes fire correctly.

## Independent test

After commit `4bdf4d2`:
- `node tools/runTests.js` green (verified).
- Clear localStorage, start new game → intro splash appears before tutorial.
- Settings → toggle "Tutorial überspringen" ON, start new game → tutorial skipped (after splash).
- Complete Q1-Q6 chain (via DevTools or playthrough) → outro splash on next hub entry.
- Lore-fragment event drop in dungeon → one of 9 (6 original + 3 new) random texts displays.

## Implementation command

(Retroactive — already shipped on main as commit `4bdf4d2`.)
