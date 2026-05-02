---
work_package_id: WP04
title: GameScene combat/loot/ability/inventory wiring
dependencies: [WP01, WP02]
requirement_refs:
- C-04
- FR-04
- FR-06
- FR-12
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 8e9ed6a48b208c800979b5fa64f5f4ba0e6682a5
created_at: '2026-05-02T12:27:55.239411+00:00'
subtasks: [T011, T012, T013, T014, T015]
shell_pid: "2916"
agent: "claude"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/scenes/GameScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/GameScene.js
- js/abilitySystem.js
- js/lootSystem.js
- js/enemy.js
- js/inventory.js
- js/inventoryUI.js
- js/equipment.js
---

# WP04 — GameScene combat/loot/ability/inventory wiring

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- **Implement-time base**: stack on top of WP02 (`spec-kitty implement WP04 --base WP02`).
- **Parallel-safe with WP03 and WP05** — no shared owned files.

## Objective

Drive the dungeon-side tutorial steps (7–10) by emitting events from the existing combat, ability, loot, and inventory paths. Mount `TutorialOverlay` in `GameScene` so the banner and highlight render while in the dungeon.

## Context (read first)

- [spec.md](../spec.md) — FR-04, FR-06, FR-12, C-04 (do **not** modify Wave 1 spawn config).
- [data-model.md](../data-model.md) — event vocabulary, steps 7–10.
- [research.md](../research.md) D-08 (combat-hit detection point: single funnel).
- `js/scenes/GameScene.js` — main dungeon scene; entry/shutdown lifecycle.
- `js/enemy.js` — damage application path.
- `js/abilitySystem.js` — ability execution funnel.
- `js/lootSystem.js` — loot drop + pickup funnels.
- The inventory module — name unknown without a quick grep; could be `js/inventory.js`, `js/inventoryUI.js`, or coupled inside `js/main.js`. The first thing this WP does is locate it.

## Event-to-source mapping (cheat sheet)

| Event                  | Source module                  | Notes                                                    |
|------------------------|--------------------------------|----------------------------------------------------------|
| `combat.hit`           | enemy.js (damage entry)        | Emit once per damage application **by player**.          |
| `combat.kill`          | enemy.js (death handler)       | Emit when enemy HP ≤ 0 due to player damage.             |
| `combat.ability.used`  | abilitySystem.js               | Emit at the top of the ability-execution funnel.         |
| `loot.dropped`         | lootSystem.js                  | Emit when a loot pile spawns.                            |
| `loot.picked`          | lootSystem.js                  | Emit on the pickup funnel.                               |
| `inventory.opened`     | inventory module (UI handler)  | Emit on inventory toggle-open.                           |
| `inventory.equipped`   | inventory module (equip funnel)| Emit on the equip-to-slot path.                          |

In every case: `window.TutorialSystem?.report(event, payload)`.

---

## Subtask T011 — Combat hit + kill events

**Purpose**: Trigger steps 7 (`combat.hit`).

**Steps**:

1. Open `js/enemy.js`. Find the function that applies damage to an enemy (likely `takeDamage(amount, source)` or similar).

2. At the **bottom** of the function (after damage is applied, but **before** the death check), emit:
   ```js
   if (source === 'player' || source?.byPlayer) {
     window.TutorialSystem?.report('combat.hit', { byPlayer: true, enemyId: this.id });
   }
   ```
   Adapt the `source` shape to whatever the existing function uses.

3. In the same function, after the enemy-died branch:
   ```js
   if (hp <= 0) {
     // existing death handling...
     window.TutorialSystem?.report('combat.kill', { enemyType: this.type });
   }
   ```

4. If `js/enemy.js` does not own the damage funnel (e.g., damage is applied in `GameScene.update()`), put the emission there instead. The rule: emit at the single funnel where player damage is recognized.

5. Re-run unit tests: `npm test`. The `eliteEnemies.test.js` and other existing enemy tests must still pass — no behavior change beyond the new emission.

**Files**:
- `js/enemy.js` — modified (~10 lines added).
- `js/scenes/GameScene.js` — modified only if the damage funnel lives there.

**Validation**:
- [ ] Existing tests pass.
- [ ] Manual: enter dungeon at step 7, swing at a Brute → step advances to 8.

---

## Subtask T012 — Ability event [P]

**Purpose**: Trigger step 8.

**Steps**:

1. Open `js/abilitySystem.js`. Find the function that *executes* an ability (likely a top-level `triggerAbility(slot)` or `executeAbility(ability)` funnel — every ability variant should pass through it).

2. At the top of the funnel, after the input validation (i.e., after suppression checks, before any side-effects):
   ```js
   window.TutorialSystem?.report('combat.ability.used', { slot: slotIndex });
   ```

3. Confirm only one emission per ability use (no duplicate from per-frame loops).

**Files**:
- `js/abilitySystem.js` — modified (~3 lines added).

**Validation**:
- [ ] `tests/abilitySystem.test.js` still passes.
- [ ] Manual: at step 8, press Q (or whichever slot 1 is bound to via `inputScheme`) → step advances to 9.

---

## Subtask T013 — Loot events [P]

**Purpose**: Trigger step 9.

**Steps**:

1. Open `js/lootSystem.js`. Locate the loot-drop funnel (called when an enemy or chest produces an item).
2. Inside the drop funnel, after the visual loot pile is added to the scene:
   ```js
   window.TutorialSystem?.report('loot.dropped', { itemId: item.id });
   ```

3. Locate the loot-pickup funnel (player overlap or click pickup).
4. Inside the pickup funnel, after the item is moved to inventory state:
   ```js
   window.TutorialSystem?.report('loot.picked', { itemId: item.id });
   ```

5. Confirm `tests/lootSystem.test.js` still passes.

**Files**:
- `js/lootSystem.js` — modified (~6 lines added).

**Validation**:
- [ ] `tests/lootSystem.test.js` passes.
- [ ] Manual: kill an enemy that drops loot at step 9 → walk over / click loot → step advances to 10.

---

## Subtask T014 — Inventory events

**Purpose**: Trigger step 10.

**Steps**:

1. **Find the inventory module** by grepping for `inventory` and `equip` across `js/`. Likely candidates:
   - `js/inventory.js` (state)
   - `js/inventoryUI.js` (UI handlers)
   - Or coupled inside `js/main.js` / a scene file
   - Or methods on the player object in `js/player.js`

2. Locate the `inventory.opened` source: the function that toggles the inventory UI to its visible state.
3. Add: `window.TutorialSystem?.report('inventory.opened', {});`

4. Locate the `inventory.equipped` source: the funnel that moves an item from the inventory grid to an equipment slot. (This is the right-click handler in the spec's wording.)
5. Add: `window.TutorialSystem?.report('inventory.equipped', { slot: equipmentSlotName });`

6. **If the inventory module is not in any of `owned_files`** above: add it to `owned_files` in this WP's frontmatter and re-run `spec-kitty agent feature finalize-tasks --validate-only --json` to confirm no overlap with WP03/WP05.

**Files**:
- Whichever inventory module is found (typically 2–3 lines in 1–2 files).

**Validation**:
- [ ] Manual: at step 10, open inventory then equip a dropped item → step advances to 11 (the save-notice toast in the hub on next return).

---

## Subtask T015 — GameScene overlay mount

**Purpose**: Make the banner + highlight visible while in the dungeon.

**Steps**:

1. In `js/scenes/GameScene.js`'s `create()`, after the scene's own UI is set up:
   ```js
   if (window.TutorialOverlay && window.TutorialSystem?.isActive()) {
     this._tutorialOverlay = window.TutorialOverlay.create(this);
     this._tutorialOverlay.mount();
   }
   this._tutorialUnsub = window.TutorialSystem?.onChange((step) => {
     if (step && !this._tutorialOverlay) {
       this._tutorialOverlay = window.TutorialOverlay.create(this);
       this._tutorialOverlay.mount();
     } else if (!step && this._tutorialOverlay) {
       this._tutorialOverlay.unmount();
       this._tutorialOverlay = null;
     }
   });
   ```

2. In `GameScene` shutdown:
   ```js
   if (this._tutorialOverlay) { this._tutorialOverlay.unmount(); this._tutorialOverlay = null; }
   if (this._tutorialUnsub) { this._tutorialUnsub(); this._tutorialUnsub = null; }
   ```

3. Verify the highlight is **not** drawn for combat steps (7–10) — those steps have `targetRef: null` per data-model. The overlay's existing logic should already skip the highlight when `targetRef` is null.

**Files**:
- `js/scenes/GameScene.js` — modified (~15 lines added).

**Validation**:
- [ ] Banner visible during dungeon at steps 7–10.
- [ ] No highlight outline visible during dungeon (targetRef is null for combat steps).
- [ ] Returning to hub cleanly tears down the dungeon overlay.

---

## Definition of Done

- [ ] T011–T015 marked complete.
- [ ] All four dungeon-side steps (7–10) advance through normal play.
- [ ] No regressions in existing unit tests.
- [ ] Wave 1 spawn config is **untouched** (Constraint C-04).
- [ ] Inventory module location and changes are documented in commit message for reviewer clarity.

## Risks & mitigations

- **Inventory module location unknown** — first action in T014 is a targeted grep; if there is no clear funnel, document the chosen emission site in the commit and ask the reviewer to confirm.
- **Multiple damage funnels** — if `enemy.js` is bypassed by some damage variants (e.g., DOT effects), pick the broadest funnel (player-projectile-hit handler) and emit once there.
- **Per-frame spam** — emission must be event-driven, not per-frame. If the loot pickup funnel fires per overlap frame, dedupe with a per-pile flag.

## Reviewer guidance

- Verify each emission is at a single funnel (no duplicate emissions).
- Verify `enemy.js` damage path still respects the existing source-attribution (no false-positive `combat.hit` for environmental damage).
- Manually walk from hub through dungeon at steps 7→10 with the tutorial active.

## Implementation command

```bash
spec-kitty implement WP04 --feature 044-tutorial-onboarding-flow --base WP02
```

## Activity Log

- 2026-05-02T12:27:55Z – claude – shell_pid=2916 – lane=doing – Started implementation via workflow command
