---
work_package_id: WP06
title: End-to-end validation (smoke + manual)
dependencies: [WP01, WP02, WP03, WP04, WP05]
requirement_refs:
- NFR-01
- NFR-02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: d5fbd93cfa45efcc9415e0318418bc84ba354fb5
created_at: '2026-05-02T14:11:04.295077+00:00'
subtasks: [T019, T020, T021]
shell_pid: "20824"
agent: "claude"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: tools/testGame.js
execution_mode: code_change
lane: planned
owned_files:
- tools/testGame.js
- kitty-specs/044-tutorial-onboarding-flow/quickstart.md
---

# WP06 — End-to-end validation (smoke + manual)

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- **Implement-time base**: stack on top of the most recently merged WP — practically `WP05` if WPs are merged in numerical order. If the order differs, use `--base <last-merged-WP>`.

## Objective

The final validation gate. Extend the Playwright smoke test to walk the hub portion of the tutorial (steps 1–6); perform a manual full-loop run-through; verify all edge-case paths (auto-skip, replay, mid-tutorial skip, language switch). Record observations in `quickstart.md`'s validation appendix so future contributors have a reference.

## Context (read first)

- [spec.md](../spec.md) — Definition of Done section, all Success Criteria SC-01..SC-06.
- [quickstart.md](../quickstart.md) — existing developer onboarding doc; this WP appends a validation log.
- `tools/testGame.js` — current Playwright smoke. Read it end-to-end to see how it picks loadout, advances waves, etc.
- `tools/runTests.js` — the unit test driver (do not modify; just confirm it still passes).

## Acceptance gate

This WP is what gives the green light to merge the feature. If any sub-validation fails, file a follow-up issue or fix in the relevant WP, do not relax the criteria here.

---

## Subtask T019 — Extend smoke to walk hub portion

**Purpose**: Catch regressions in the tutorial event wiring across future changes.

**Steps**:

1. Open `tools/testGame.js`. Identify the existing flow (loadout pick, wave start, etc.).

2. Add a new test mode `--tutorial` (or equivalent flag matching the existing convention). When enabled:
   - Wipe `localStorage` keys `demonfall_save_v1` and `demonfall_tutorial_v1` before reload.
   - Start a New Game.
   - Assert: `await page.evaluate(() => window.TutorialSystem.isActive())` returns `true`.
   - Assert: current step id is `'movement'`.
   - Move the player one tile (synthesize WASD keypresses via Playwright `keyboard.press('KeyW')` followed by `keyboard.up('KeyW')`).
   - Wait for step to advance. Poll `getCurrentStep().id` for up to 2s.
   - Assert: id is now `'forge.approach'`.
   - Walk to Werkstatt entrance (synthesize movement; allow ~3 s of held key press + release).
   - Assert: id is now `'forge.dialog'`.
   - Press E. Wait for dialog. Press ESC (or whatever closes the dialog).
   - Assert: id is now `'keller.approach'`.
   - Stop here (full dungeon walkthrough is too brittle for a smoke; manual covers steps 7–12).
   - Throughout: collect `console.error` output and assert it stays empty.

3. Add a `package.json` script entry:
   ```json
   "test:smoke:tutorial": "node tools/testGame.js --tutorial"
   ```
   *(Add to the existing scripts; do not modify existing entries.)*

   **Note**: editing `package.json` is technically outside this WP's `owned_files`. Add it to `owned_files` in the frontmatter before committing if the project requires it; or, if you prefer to keep this WP scoped to `tools/testGame.js` only, document the new flag in the commit and do the package.json edit as a follow-up. **Decision for this prompt: yes, edit `package.json`** — declare it in `owned_files` here (see frontmatter; if absent, add it before committing).

4. Run: `npm run test:smoke:tutorial`. Expect exit 0.

5. Run: `npm run test:smoke` (the original) — expect exit 0 still.

**Files**:
- `tools/testGame.js` — modified (~80 lines added for the new flag's path).
- `package.json` — modified (1 line added for the script).

**Validation**:
- [ ] New smoke flag passes deterministically across 3 consecutive runs.
- [ ] Original smoke still passes.
- [ ] No console errors recorded by the smoke harness.

---

## Subtask T020 — Manual full happy-path run-through

**Purpose**: SC-01, SC-05, SC-06.

**Steps**:

1. Wipe all `demonfall_*` localStorage keys.
2. `npx serve .`; open the game in a browser.
3. Click New Game.
4. Walk every step from 1 through 12 deliberately. Time it (target: 10–15 minutes for a deliberate first-time pass).
5. After step 12 (Setzer Thom dialog closes), confirm the overlay disappears and `TutorialSystem.isActive()` returns `false` in DevTools.
6. Throughout the run, record:
   - Each step transition timestamp (use the DevTools console with a one-line `TutorialSystem.onChange(s => console.log(performance.now(), s?.id))`).
   - Any console error or warning.
   - Any visual issues (overlap, z-order, color contrast, banner truncation).
7. Switch the game language from German to English at some point during the run; confirm the banner updates within one frame and the next step's hint also displays in English.

8. Append a **Validation Log** section to `kitty-specs/044-tutorial-onboarding-flow/quickstart.md`:

   ```markdown
   ## Validation log

   **Run date**: <YYYY-MM-DD>
   **Operator**: <name>
   **Browser**: <Chrome/FF/Edge + version>

   ### Happy path (steps 1–12)
   - Total elapsed: <mm:ss>
   - Step transitions: <attach console-log dump or summarize>
   - Console errors: <none / list>
   - Visual issues: <none / list>

   ### Auto-skip
   - With save present: <pass/fail + notes>

   ### Replay
   - Settings → Replay restored step 2: <pass/fail>
   - Save remained intact: <pass/fail>

   ### Mid-tutorial skip
   - Settings → Skip toggle deactivated overlay within one frame: <pass/fail>

   ### Language switch
   - DE→EN mid-tutorial updated banner live: <pass/fail>
   ```

**Files**:
- `kitty-specs/044-tutorial-onboarding-flow/quickstart.md` — appended (~30 lines).

**Validation**:
- [ ] Total elapsed within 10–15 minute target.
- [ ] No console errors.
- [ ] Validation log committed.

---

## Subtask T021 — Edge-case manual verification

**Purpose**: SC-02, SC-03, SC-04.

**Steps**:

1. **Auto-skip with existing save**:
   - Pre-seed `demonfall_save_v1` with any non-empty value; clear `demonfall_tutorial_v1`.
   - Reload, click New Game (or Continue).
   - Confirm: zero tutorial banner frames (record screen briefly to be sure).
   - Confirm: `TutorialSystem.isActive() === false`.

2. **Replay**:
   - From the auto-skipped state, open Settings → Replay → confirm.
   - Close Settings. The banner appears at step 2.
   - Inventory and save still intact.

3. **Mid-tutorial skip**:
   - During step 2 (movement banner), open Settings → Skip toggle → confirm.
   - Close Settings. Banner gone, no highlight.
   - `TutorialSystem.isActive() === false`.

4. **Cancel on confirm**:
   - Repeat step 3 but click Cancel on the confirm prompt.
   - Tutorial remains active; banner still visible.

5. **Language switch mid-tutorial**:
   - Already covered in T020; also explicitly here: switch DE→EN→DE at three different steps, confirm no flicker / no missing keys.

6. **Persistence across reload**:
   - At step 5, refresh the browser.
   - Reload restores at step 5 (or whatever step was current). Banner reappears with correct text and target.

7. **Result**: append findings to the Validation log section started in T020 (under "### Auto-skip", "### Replay", "### Mid-tutorial skip", "### Language switch").

**Files**:
- `kitty-specs/044-tutorial-onboarding-flow/quickstart.md` — appended further (~10 lines).

**Validation**:
- [ ] All five edge-case scenarios pass.
- [ ] Validation log entries reflect actual observations (not aspirational).

---

## Definition of Done

- [ ] T019–T021 marked complete.
- [ ] `npm run test:smoke:tutorial` passes in CI / locally.
- [ ] Manual happy-path log shows green across all SC-01..SC-06.
- [ ] All edge cases verified.
- [ ] Validation log committed in `quickstart.md`.
- [ ] Issue #29 closed (or moved to Done) once this WP merges.

## Risks & mitigations

- **Smoke flakiness on slow machines** — keep timeouts generous (2 s polls, 30 s overall budget per step).
- **Manual run skipped** — gate on the validation log being non-empty; reviewer enforces.
- **Edge case discovered during validation** — file as new issue and link it; do not silently relax DoD.

## Reviewer guidance

- Open `quickstart.md` and confirm the Validation log block exists with non-placeholder values.
- Run the new smoke locally at least once to confirm it passes.
- Spot-check at least one edge case manually before approving merge.

## Implementation command

```bash
spec-kitty implement WP06 --feature 044-tutorial-onboarding-flow --base WP05
```

## Activity Log

- 2026-05-02T14:11:04Z – claude – shell_pid=20824 – lane=doing – Started implementation via workflow command
