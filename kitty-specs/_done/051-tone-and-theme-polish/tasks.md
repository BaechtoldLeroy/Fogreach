# Tasks: Tone and Theme Polish

**Feature**: 051-tone-and-theme-polish
**Generated**: 2026-05-14
**Phase**: 2 (Tasks) — retroactive documentation
**Planning base**: `main` → **Merge target**: `main`

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Polish-Pass Implementation | 5 (T001–T005) | ~310 | none | — |

Single WP — the work was small enough to ship as one direct-on-main commit. WP file at `tasks/WP01-polish-pass.md` documents the same scope retroactively.

## Phase 1 — Polish

### WP01: Polish-Pass Implementation

**Goal**: Ship the four in-scope polish items from spec §1 (intro splash, outro splash, skip-tutorial toggle, three Akt-1 lore fragments). The fifth item (hub visual/audio atmosphere) is deferred — requires new asset work.

**Included subtasks**:

- [x] **T001** Skip-tutorial toggle in `js/scenes/SettingsScene.js`: new `gameplay.skipTutorial` default + toggle row in the Tutorial section; `applySettings` exposes `window.__SKIP_TUTORIAL__`. DE + EN labels.
- [x] **T002** Tutorial-skip wiring in `js/tutorialSystem.js`: `maybeAutoSkip()` OR's `hasSave` with the new `window.__SKIP_TUTORIAL__` flag so returning donors with no save can still skip.
- [x] **T003** Three Akt-1 lore-fragment texts in `js/eventSystem.js` (DE + EN): `fragment_lost_history` / `fragment_council_pact` / `fragment_personal_amnesia`. Added to the existing `loreKeys` pool at the bottom of `spawnLoreFragment`.
- [x] **T004** `_showIntroSplash()`, `_showOutroSplash()`, `_showSplashModal()` helpers in `js/scenes/HubSceneV2.js` — splash modal with title + body + close button, ESC/Enter/Space/click dismiss. Trigger scheduled in `create()` via `time.delayedCall`. Single-shot via localStorage flags (`demonfall_seen_intro_splash`, `demonfall_seen_outro_splash`). Mobile-safe via `_ktPropagateScrollFactor`.
- [x] **T005** End-to-end smoke check — `node tools/runTests.js` stays green (251 tests); manual playthrough verifies the splashes fire at the right moments.

**Owned files**: `js/tutorialSystem.js`, `js/eventSystem.js`, `js/scenes/SettingsScene.js`, `js/scenes/HubSceneV2.js`.

**Risks**:
- Dialogue-tone refinement on existing Q2-Q5 dialogues was DEFERRED — the structural delivery (4 NPCs, 4 framings, Q6 reveal) already carries the political payload from 050/WP02.
- Hub visual + audio atmosphere DEFERRED — needs new asset work, separate issue.

**Requirement refs**: FR-01 through FR-11 (except FR-07/FR-08 dialogue tone — partial / deferred).

## Definition of done (feature-level)

- [x] WP01 merged into `main` (commit `4bdf4d2`).
- [x] `node tools/runTests.js` green (251 tests).
- [x] All splash + toggle + lore-fragment paths reachable.
- [x] DE + EN strings registered.
- [x] No console errors on hub entry / tutorial flow / Q6 completion.

## Out of scope (deferred to a separate issue)

- Hub visual atmosphere (censored posters, faded flags, candles) — new art assets required.
- Hub audio (bells, council march) — new audio assets required.
- Word-level tone refinement on Q2-Q5 dialogues — editorial polish pass; not blocking the donor demo.

## Branch strategy

Direct-on-main commit (`4bdf4d2`). No WP-worktree split — content-polish work, small enough scope.
