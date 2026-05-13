---
work_package_id: WP03
title: Stat-Pipeline Integration
dependencies:
- WP01
requirement_refs:
- FR-04
- FR-08
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 047-knowledge-tree-mvp-WP01
base_commit: 9fc3d73ed18db7cf9a133aa33cb62d3134e65ae1
created_at: '2026-05-13T19:55:04.484165+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
phase: Phase 2 — Parallelizable Work
assignee: ''
agent: ''
shell_pid: "13156"
history:
- timestamp: '2026-05-13T19:28:10Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/inventory.js
- js/main.js
- js/player.js
- js/lootSystem.js
- js/eventSystem.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP03 — Stat-Pipeline Integration

## Objective

Wire `window.knowledgeTreeBuffs` into every stat-read site so investing into a node produces a measurable in-game effect. Also wire the lore-fragment overlap callback to call `KnowledgeTree.addFragments(1)`.

After this WP, every node in the catalog actually does something when invested. Without this WP, the player can invest fragments but observes no in-game changes.

## Context

- **Spec**: `kitty-specs/047-knowledge-tree-mvp/spec.md` (FR-04 invest triggers recalc; FR-08 lore-fragment emits addFragments)
- **Plan**: `kitty-specs/047-knowledge-tree-mvp/plan.md` § "Technical Context" (per-stat integration points)
- **Research**: `kitty-specs/047-knowledge-tree-mvp/research.md` § R-03 (buff-contributor pattern table)
- **Data model**: `kitty-specs/047-knowledge-tree-mvp/data-model.md` § "Effect application"
- **Existing pattern**: `js/inventory.js:967-1000` shows the layered-buff pattern (eventBuffs → brunnenBuffs → printingBuffs). The new §3.9 layer follows the same shape.

## Branch strategy

Planning on `main`. Implement in worktree created by `spec-kitty implement WP03 --base WP01`. The `--base WP01` ensures `js/knowledgeTree.js` exists in the worktree so `window.knowledgeTreeBuffs` is defined at runtime. Merge to `main`.

## Auto-memory: classic-script scope falle

**CRITICAL**: Per the project memory `classic_script_scope`, several stat variables in `main.js` (`weaponDamage`, `playerArmor`, `playerSpeed`, `playerCritChance`) are `let`-bindings — **script-scoped**, not window-scoped. They are visible to other classic scripts under the same name but NOT as `window.weaponDamage`. Do NOT write `window.weaponDamage = ...` to apply Knowledge Tree buffs — that creates a separate property that no consumer reads. The correct pattern is to mutate the script-local binding inside `recalcDerived()` exactly the way `eventBuffs` / `brunnenBuffs` / `printingBuffs` already do.

---

## Subtask T012: `js/inventory.js` §3.9 — KnowledgeTree buff layer in `recalcDerived`

**Purpose**: Add a new layer after §3.8 (printingBuffs) in `recalcDerived` that applies `damageMult` / `armorAdd` / `speedMult` from `window.knowledgeTreeBuffs`, and adds `maxHpAdd` into `newMaxHealth` **before** the existing max-HP clamp.

**Steps**:

1. Read `js/inventory.js` around line 994-1000 (the §3.8 printingBuffs block) — it sets the pattern.

2. After the §3.8 block, insert §3.9:
   ```js
     // 3.9) Knowledge-Tree permanent buffs (Issue #26). Permanent across runs.
     // Same shape as the run-scoped layers but persists. damageMult / armorAdd /
     // speedMult / maxHpAdd are applied here. critAdd / xpMult / goldMult /
     // pickupAddRange / magicFindMult / cdrAll are applied at their respective
     // read sites (main.js, lootSystem.js, player.js — see WP03 T013-T015).
     const kb = window.knowledgeTreeBuffs;
     if (kb) {
       weaponDamage = Math.max(1, Math.round(weaponDamage * (kb.damageMult || 1)));
       playerArmor = Phaser.Math.Clamp(
         playerArmor + (kb.armorAdd || 0),
         0,
         0.85
       );
       playerSpeed = Math.max(60, Math.round(playerSpeed * (kb.speedMult || 1)));
     }
   ```

3. The `maxHpAdd` integration is slightly earlier. Locate the section in `recalcDerived` that computes `newMaxHealth` (sections §1-2 — search for `newMaxHealth = ` or `setPlayerMaxHealth`). Add an additive contribution BEFORE the max-HP is committed:
   ```js
     // Knowledge-Tree max-HP contribution (permanent, additive)
     if (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.maxHpAdd > 0) {
       newMaxHealth += window.knowledgeTreeBuffs.maxHpAdd;
     }
   ```
   Find the right insertion point by searching for `newMaxHealth` — it's set, then potentially modified by `endlessBuffs.playerMaxHealth`, then committed via `setPlayerMaxHealth(playerMaxHealth + bonus, ...)`. Place the knowledge-tree maxHpAdd right alongside the endless one (same lifecycle: permanent or run-scoped bonus added to max HP before commit).

4. Run the game and verify in DevTools:
   ```js
   window.knowledgeTreeBuffs.damageMult = 1.5;
   window.knowledgeTreeBuffs.maxHpAdd = 50;
   recalcDerived(0, 0);
   // HUD damage value increases; max HP shows +50.
   window.knowledgeTreeBuffs.damageMult = 1.0;
   window.knowledgeTreeBuffs.maxHpAdd = 0;
   recalcDerived(0, 0);
   // Back to baseline.
   ```

**Files**:
- `js/inventory.js` (modified — ~20 LOC added)

**Validation**:
- `damageMult` boost reflects in HUD weapon-damage value (via `weaponStatsText.setText`).
- `armorAdd` boost reflects in HUD armor % (and respects the 0.85 cap).
- `speedMult` boost reflects in player walk speed (and respects the 60 floor).
- `maxHpAdd` boost increases the player's max HP correctly.
- Recalc performance: profile in DevTools (Performance tab) — `recalcDerived` call duration increase ≤ 0.5 ms (NFR-01).

**Risks**:
- Stack interaction: this layer is the **last** stat layer. Multipliers compound multiplicatively (1.5 damageMult on top of 1.2 from another layer = 1.8 total). This is intentional; the spec accepts multiplicative stacking.
- Don't forget the Phaser.Math.Clamp for armor — without it, 5 ranks (+25% armor) combined with existing 65% armor would push past the 85% ceiling.

---

## Subtask T013: `js/main.js` — critAdd in playerCritChance + xpMult wrap on addXP

**Purpose**: Apply `critAdd` to `playerCritChance` initialization and multiply XP gains by `xpMult`.

**Steps**:

1. **critAdd**: Read `js/main.js` around line 806 where `playerCritChance = baseStats.crit;` lives.

   Change to:
   ```js
   playerCritChance = baseStats.crit + ((window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.critAdd) || 0);
   ```

   Verify that the line at ~470 (`let playerCritChance = 0;`) is the script-scoped declaration; we mutate the same binding at 806.

   **Important**: `playerCritChance` is read in many places (HUD at line 1129, attack roll in `player.js`). The knowledge-tree contribution is folded into the variable itself at the moment of recalc, so all downstream consumers automatically see the boosted value.

2. **xpMult**: Locate `addXP` (search `js/main.js` for `function addXP` or `addXP =`). It receives an `amount` parameter.

   At the top of the function, multiply the amount:
   ```js
   function addXP(amount, /* other args */) {
     if (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.xpMult > 1) {
       amount = Math.round(amount * window.knowledgeTreeBuffs.xpMult);
     }
     // ... existing function body
   }
   ```

   The `> 1` guard is purely a micro-optimization to avoid `* 1` rounding. If `xpMult === 1` (no investments), skip the math.

3. Test in DevTools:
   ```js
   window.knowledgeTreeBuffs.critAdd = 0.10;
   recalcDerived(0, 0);
   // HUD shows crit ~10% higher.
   window.knowledgeTreeBuffs.xpMult = 1.50;
   addXP(100);  // observe playerXP increases by 150
   ```

**Files**:
- `js/main.js` (~10 LOC modified)

**Validation**:
- HUD crit % shows the increase.
- A known XP-yield enemy gives `xpMult * baseXP` after investments.

**Risks**:
- `addXP` may have multiple call sites — wrap once inside the function, not at every call site.
- Critical chance is a fraction in `[0, 1]` — investing 5 ranks adds 0.10 (= 10%). The HUD displays as `(playerCritChance * 100).toFixed(1)` so 0.10 → "10.0".
- Negative critAdd cannot happen via the API; don't add a clamp.

---

## Subtask T014: `js/player.js` — cdrAll in getLootAbilityCooldownReduction

**Purpose**: Extend the existing per-ability cooldown reduction logic to include `knowledgeTreeBuffs.cdrAll` (applies to all abilities).

**Steps**:

1. Read `js/player.js` around line 876-895 — the `getLootAbilityCooldownReduction` function and its consumer near line 888 (where `cd_all_abilities` is read).

2. Modify the function to add the knowledge-tree contribution:
   ```js
   function getLootAbilityCooldownReduction(abilityKey) {
     // existing per-ability + cd_all_abilities computation ...
     let total = /* existing result */;
     // Knowledge-Tree contribution: cdrAll applies to all abilities equally
     if (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.cdrAll > 0) {
       total += window.knowledgeTreeBuffs.cdrAll;
     }
     return total;
   }
   ```

3. The downstream consumer at line 890 (`const lootCdMul = Math.max(0, 1 - getLootAbilityCooldownReduction(key));`) already floors at 0, which means 100% CDR floors cooldown to whatever the `Math.max(0, ...)` permits. Verify the next line (line 891-ish) also floors the resulting cooldown at 100ms — this is the safety net the existing code already has.

4. Test:
   ```js
   window.knowledgeTreeBuffs.cdrAll = 0.15; // 15% CDR
   // Cast an ability, note the cooldown — should be 15% shorter than baseline.
   ```

**Files**:
- `js/player.js` (~5 LOC modified)

**Validation**:
- Investing `node_cdr` to rank 5 (=15% CDR) makes ability cooldowns 15% shorter.
- Cooldown floor at 100ms still respected.

**Risks**:
- `cdrAll` is purely additive on top of the existing per-ability and global affix reductions. Stack interaction: 30% from affix + 15% from KT = 45% total. Acceptable; player progression rewards stacking.
- Negative `cdrAll` cannot happen; no clamp needed.

---

## Subtask T015: `js/lootSystem.js` — goldMult + magicFindMult + pickupAddRange

**Purpose**: Wire three loot-side stats.

**Steps**:

1. **goldMult** — locate the gold-drop logic in `lootSystem.js`. Search for where `gold` is added to the player (likely in a drop handler). Wrap the drop value:
   ```js
   const goldMul = (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.goldMult) || 1;
   goldAmount = Math.round(goldAmount * goldMul);
   ```

2. **magicFindMult** — locate the tier roll. Search for `rare`, `legendary`, or tier-weight arrays. The convention in ARPGs is to scale the weights of the higher tiers; the simplest implementation multiplies the rare/legendary weights by `magicFindMult` before sampling:
   ```js
   const mfMul = (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.magicFindMult) || 1;
   if (mfMul !== 1) {
     // Scale the higher-tier weights (do not scale common — that would be a nerf)
     // Specific column names depend on the existing structure — see weights[tier]
     weights.rare      *= mfMul;
     weights.legendary *= mfMul;
   }
   ```
   **Important**: do not invert (mfMul = 1.5 means 50% MORE chance for rare+legendary, NOT 50% less common). Verify by sampling 100 drops before and after — the proportion of rare+legendary should rise.

3. **pickupAddRange** — locate the item-pickup overlap radius (search for `PICKUP_RADIUS` or similar). Add the contribution:
   ```js
   const baseRange = PICKUP_RADIUS;
   const ktRange = (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.pickupAddRange) || 0;
   const effectiveRange = baseRange + ktRange;
   ```
   Apply `effectiveRange` to the physics overlap or distance check.

4. Test:
   ```js
   window.knowledgeTreeBuffs.goldMult = 2.0;
   // Kill an enemy that drops 10 gold — observe 20 gold added.
   window.knowledgeTreeBuffs.pickupAddRange = 50;
   // Drop an item — player auto-picks at ~50px greater distance.
   window.knowledgeTreeBuffs.magicFindMult = 5.0;
   // Open chests — rare+legendary drops noticeably more often.
   ```

**Files**:
- `js/lootSystem.js` (~20 LOC modified)

**Validation**:
- `goldMult = 2.0` doubles the gold per drop.
- `magicFindMult = 5.0` substantially raises rare+legendary frequency (sample 100 drops to confirm trend).
- `pickupAddRange` extends auto-pickup distance.

**Risks**:
- **Tier-weight inversion risk**: if implemented wrong (scaling common weight up, or scaling magic weight down), magic find produces NO rare items. Sample before merging.
- **Affix vs base loot value**: gold from chests vs from enemy drops may be different code paths. Find both and apply consistently — or document explicitly that MVP only affects one (e.g. enemy drops, not chest gold).
- **Pickup range may also affect physics-body sizes** — verify the change doesn't break collision with walls.

---

## Subtask T016: `js/eventSystem.js` — addFragments(1) on lore pickup

**Purpose**: When the player picks up a lore-fragment scroll in the dungeon, increment `KnowledgeTree.fragments` by 1. Keep the existing snippet text + XP bonus.

**Steps**:

1. Open `js/eventSystem.js`. Locate `spawnLoreFragment` (line 1041) and its overlap-pickup callback at lines 1130-1143.

2. The current code:
   ```js
   scene.physics.add.overlap(player, scroll, function() {
     if (activeLore && !activeLore.picked) {
       activeLore.picked = true;
       var xpBonus = 15 + (window.DUNGEON_DEPTH || 1) * 5;
       if (typeof addXP === 'function') {
         addXP.call(scene, xpBonus);
       } else if (typeof playerXP !== 'undefined') {
         playerXP += xpBonus;
         window.playerXP = playerXP;
       }
       showLoreDialog(scene, chosen, xpBonus);
       cleanupLore();
     }
   });
   ```

3. Add the KnowledgeTree increment after `activeLore.picked = true;`, before the XP bonus:
   ```js
   scene.physics.add.overlap(player, scroll, function() {
     if (activeLore && !activeLore.picked) {
       activeLore.picked = true;
       // Issue #26 — increment Knowledge Tree fragment counter on pickup.
       // Existing flavor text + XP path is preserved (spec C-08).
       if (window.KnowledgeTree && typeof window.KnowledgeTree.addFragments === 'function') {
         window.KnowledgeTree.addFragments(1);
       }
       var xpBonus = 15 + (window.DUNGEON_DEPTH || 1) * 5;
       // ... rest unchanged
     }
   });
   ```

4. The feature-detect (`if (window.KnowledgeTree && typeof ...)`) is the only safe pattern in classic-script land — if the module fails to load, the lore fragment still works (snippet + XP).

**Files**:
- `js/eventSystem.js` (~5 LOC added)

**Validation**:
- Start a fresh run. `KnowledgeTree.getFragments()` is 0.
- Enter the dungeon, wait for a lore fragment event, walk over the scroll.
- `KnowledgeTree.getFragments()` is now 1.
- Repeat — count increments by 1 per scroll.
- The original snippet dialog + XP bonus still appears (regression check).

**Risks**:
- Don't call `addFragments(1)` more than once per pickup — the `activeLore.picked = true` flag is the dedup guard; place the call inside that block.
- If the player picks up two scrolls in the same frame (very rare, but theoretically possible if two spawn back-to-back from race conditions), each pickup calls `addFragments(1)` independently — that's correct (FR-01 says +1 per pickup event, idempotent per scroll).

---

## Definition of Done (WP03)

All of:
- [ ] `js/inventory.js` has §3.9 buff layer applied after §3.8 (printingBuffs)
- [ ] `js/inventory.js` adds `maxHpAdd` into `newMaxHealth` before the existing max-HP clamp
- [ ] `js/main.js` applies `critAdd` to `playerCritChance` initialization
- [ ] `js/main.js` `addXP` multiplies incoming amount by `xpMult`
- [ ] `js/player.js` `getLootAbilityCooldownReduction` includes `cdrAll`
- [ ] `js/lootSystem.js` applies `goldMult`, `magicFindMult`, `pickupAddRange` correctly
- [ ] `js/eventSystem.js` lore-fragment pickup calls `KnowledgeTree.addFragments(1)`
- [ ] DevTools manual test for each buff field shows the expected in-game effect
- [ ] `recalcDerived` profile shows ≤ +0.5 ms cost (NFR-01)
- [ ] No console errors during a full dungeon run + pickup + investment cycle

## Risks (rolled up)

- **Classic-script scope falle**: never assign `window.weaponDamage = ...` etc. — let `recalcDerived` mutate the script-local binding.
- **Multiplicative vs additive compounding**: armor is additive (5%+5% = 10%), damage is multiplicative (1.05 × 1.05 = 1.1025 with two other layers contributing). Match what the existing buff layers do — armor: add; damage/speed: mult; pickup: add; XP/gold/magic-find: mult; CDR: add.
- **Magic Find tier-weight direction**: prove by sampling that rare+legendary frequency INCREASES, not decreases.
- **`addXP` call sites**: wrap once inside the function, not at each call site. Search call sites to confirm none of them already multiply XP separately.

## Reviewer guidance

Before approving:
1. Open the game. In DevTools, manually set each buff field to a known value, call `recalcDerived(0, 0)`, and verify the corresponding HUD / behavior shifts.
2. Profile a single `recalcDerived` call before and after this WP's changes — confirm ≤ 0.5 ms increase.
3. Sample 50 lore-fragment pickups (or fake them via `KnowledgeTree.addFragments(1)` repeated) and confirm `getFragments()` tracks count exactly.
4. Sample 100 loot drops with `magicFindMult = 3.0` and confirm rare+legendary frequency rises (qualitative check — exact distribution doesn't matter for MVP).
5. Read each of the 5 modified files end-to-end to confirm no unrelated changes leaked in.

## Next WP

WP03 is parallel-safe with WP02 and WP04. After merge, the integration is live. WP04 builds the UI to invest visually.

## Implementation command

```bash
spec-kitty implement WP03 --base WP01
```
