# Research: Knowledge Tree (MVP)

**Feature**: 047-knowledge-tree-mvp
**Generated**: 2026-05-13
**Phase**: 0 (Outline & Research)

This document resolves every `NEEDS CLARIFICATION` from the Technical Context and records the decisions made during planning interrogation.

---

## R-01: Entry point — Mara dialog vs. dedicated hub entrance (resolves FR-09)

- **Decision**: Mara's dialog — and specifically, **replace** the existing "Skills lernen" (K) entry. The K-key and the `Skills lernen` button on Mara's dialog now invoke `_showKnowledgeTreeUI()` instead of `_showSkillTreeUI()`.
- **Rationale**: Avoids adding a new hub interactable (no asset, no hub-layout change). Mara is already the meta-progression NPC. The user explicitly chose this in planning interrogation (Q1 = "A — replace existing skill dialog").
- **Consequence for old skill tree**: The active-ability **learning** UI is removed from MVP. Already-learned active skills continue to function in dungeons (the runtime in `skillSystem.js` is unchanged). Ability acquisition returns in Phase 2 (per spec C-04).
- **Alternatives considered**:
  - Dedicated hub interactable (rejected: extra asset cost, hub layout already crowded).
  - Auto-open on hub entry when fragments are unspent (rejected: invasive UX).
  - Side-by-side with old skill tree (rejected: clutters Mara dialog with two trees the user doesn't want to maintain in MVP).

## R-02: UI architecture — Modal Container vs. dedicated Phaser scene (resolves C-06)

- **Decision**: Modal Container inside `HubSceneV2`. Same shape as the current `_showSkillTreeUI` at `js/scenes/HubSceneV2.js:1829`: overlay `Rectangle` + centered `Container` at depth 2000-2001, header bar, scrollable card grid, footer with "Respec" + "Schließen" buttons.
- **Rationale**: We're replacing the existing modal at 1:1 location. Reusing the pattern keeps the diff small, avoids a scene-transition flash, and stays consistent with what the player already knows from `_showSkillTreeUI`. The Druckerei pattern (dedicated `PrintingHouseScene`) was right for that feature because Druckerei has multiple tabs/columns and benefits from a full-screen view; the Knowledge Tree's 10 nodes fit comfortably in a 920×460 modal.
- **Alternatives considered**:
  - Dedicated `KnowledgeTreeScene` (rejected: extra scene-lifecycle plumbing, no gain for 10 cards).
  - DOM overlay (rejected: violates C-06).

## R-03: Stat-contributor pattern — how to plug into `recalcDerived()` (resolves R-01 of spec)

- **Decision**: Add a new `window.knowledgeTreeBuffs` map with the same shape as `window.eventBuffs` / `window.brunnenBuffs` / `window.printingBuffs`, plus extended fields for stats not yet buffed by any other system. Insert a new section `3.9` in `js/inventory.js` `recalcDerived()` **after** the printing-house layer (3.8).
- **Buff shape** (`window.knowledgeTreeBuffs`):
  ```js
  {
    damageMult: 1.0,        // multiplier on weaponDamage  (existing convention)
    armorAdd: 0,            // flat add to playerArmor     (existing convention)
    speedMult: 1.0,         // multiplier on playerSpeed   (existing convention)
    maxHpAdd: 0,            // flat add to playerMaxHealth (NEW field — existing endless uses different name)
    critAdd: 0,             // flat add to playerCritChance (NEW field)
    xpMult: 1.0,            // multiplier on XP gained     (NEW field)
    goldMult: 1.0,          // multiplier on gold drops    (NEW field)
    pickupAddRange: 0,      // px add to item pickup radius (NEW field)
    magicFindMult: 1.0,     // multiplier on rare/legendary drop chance (NEW field)
    cdrAll: 0               // fraction subtracted from all ability cooldowns (NEW field)
  }
  ```
- **Rationale**: Mirrors the pattern established by existing run-scoped buffs (`brunnenBuffs`, `printingBuffs`). `recalcDerived()` already iterates through these layers — adding one more is one block of code, no new pipeline. `damageMult` / `armorAdd` / `speedMult` line up exactly with existing field names so the recalc loop is symmetric. New fields are added one-by-one at the call site (e.g. XP multiplier is applied where `addXP` is called).
- **Per-stat integration points**:
  | Buff field | Read at | Notes |
  |---|---|---|
  | `damageMult` | `inventory.js:999`-ish (new §3.9 block) | mirror printingBuffs handling |
  | `armorAdd` | same block | mirror brunnenBuffs handling |
  | `speedMult` | same block | mirror printingBuffs/brunnenBuffs |
  | `maxHpAdd` | added to `newMaxHealth` in §1-2 of recalc (before clamp) | similar to endless `playerMaxHealth` |
  | `critAdd` | `js/main.js:806`-ish where `playerCritChance` is set | `playerCritChance = baseStats.crit + (knowledgeTreeBuffs.critAdd \|\| 0)` |
  | `xpMult` | `addXP()` in `main.js` — multiply incoming `amount` | one-line wrap |
  | `goldMult` | gold-drop event in `lootSystem.js` (gold roll) | one-line wrap on drop count or value |
  | `pickupAddRange` | wherever `PICKUP_RADIUS` is read for overlap checks | additive |
  | `magicFindMult` | tier-roll in `lootSystem.js` (rarity weight) | scales the rare/legendary weights |
  | `cdrAll` | `player.js:888` `getLootAbilityCooldownReduction` (extend the formula) | adds to the existing `cd_all_abilities` figure |
- **Alternatives considered**:
  - Mutate `eventBuffs` directly (rejected: leaks across runs; eventBuffs already serves a different lifecycle).
  - Subscriber/observer pattern (rejected: overkill — the existing pattern is "read map, multiply once per recalc").

## R-04: Catalog content — 10 nodes (resolves FR-06, FR-07)

- **Decision**: 10 nodes (max allowed by FR-06). Confirmed by user during planning interrogation (8 baseline + 2 user-requested: Magic Find + CDR).

| nodeId | DE Label | EN Label | maxRank | Per-rank effect | Buff field |
|---|---|---|---|---|---|
| `node_damage` | Kraft des Wissens | Strength of Knowledge | 5 | +5 % weapon damage | `damageMult` (mult: 1 + rank*0.05) |
| `node_armor` | Gehärtete Haut | Hardened Skin | 5 | +5 % armor (clamped 85%) | `armorAdd` (rank * 0.05) |
| `node_speed` | Schnelle Schritte | Fleet Footed | 5 | +3 % move speed | `speedMult` (1 + rank*0.03) |
| `node_max_hp` | Robuster Körper | Robust Body | 5 | +10 max HP | `maxHpAdd` (rank * 10) |
| `node_crit` | Geübtes Auge | Trained Eye | 5 | +2 % crit chance | `critAdd` (rank * 0.02) |
| `node_xp` | Gelehrter Geist | Scholar's Mind | 3 | +5 % XP gain | `xpMult` (1 + rank*0.05) |
| `node_gold` | Glückspilz | Lucky | 3 | +5 % gold drop | `goldMult` (1 + rank*0.05) |
| `node_pickup` | Magnetische Anziehung | Magnetic Pull | 3 | +20 px pickup radius | `pickupAddRange` (rank * 20) |
| `node_magic_find` | Magisches Gespür | Magic Sense | 3 | +5 % magic find | `magicFindMult` (1 + rank*0.05) |
| `node_cdr` | Geübte Hände | Practiced Hands | 5 | -3 % cooldown (all abilities) | `cdrAll` (rank * 0.03) |

- Total max-rank fragment cost = 5+5+5+5+5+3+3+3+3+5 = **42 fragments** for full investment.
- **Rationale**: Mix of 5-rank "core" stats (damage, armor, speed, HP, crit, CDR) and 3-rank "flavor" stats (XP, gold, pickup, magic find). Per-rank values are intentionally modest — full crit is +10%, full damage is +25%. Enough to feel without unbalancing equipment progression.

## R-05: Persistence — key, schema, migration (resolves FR-02, FR-11, NFR-02)

- **Decision**:
  - **Key**: `demonfall.knowledgeTree.v1` (separate from any save/setting/edict/faction key — satisfies C-02).
  - **Schema**: `{ version: 1, fragments: int, ranks: { [nodeId]: int } }`.
  - **Load policy**: On load, validate `version === 1` (warn + drop to defaults otherwise); validate each `rank` against current catalog's `maxRank` (clamp + refund the excess); drop unknown nodeIds (warn + refund their fragments).
  - **Save policy**: Write synchronously on every `addFragments` / `invest` / `respec` call (small payload, no debounce needed).
- **Rationale**: Mirrors the pattern in `printingHouse.js` and `tutorialSystem.js`. Forward-compat is cheap with explicit version field. Refund-on-load handles the "we re-tuned the catalog" case gracefully.
- **Alternatives considered**:
  - Co-locate in main save (rejected: ties knowledge progression to save corruption; C-02 forbids it).
  - Debounced save (rejected: invest is rare and atomic; no performance need).

## R-06: Respec UX & cost (resolves alternate scenario in spec §3)

- **Decision**: Free respec, button inside the Knowledge Tree modal (next to "Schließen"). Confirmation dialog before execution.
- **Rationale**: User explicitly accepted "0 cost" in planning interrogation. Free respec matches the MVP-tuning-feedback loop — the player can experiment freely. Cost tuning is post-MVP.
- **Alternatives considered**:
  - Iron-chunk cost (rejected: ties Knowledge Tree to crafting economy, MVP wants minimum coupling).
  - Gold cost (rejected: gold is already drained by Mara's shop; double-charging gold for progression feels stingy at MVP).
  - Separate Mara dialog option for respec (rejected: more clicks, less discoverable).

## R-07: Lore-fragment increment — where to call `addFragments(1)`

- **Decision**: Inside the existing overlap-pickup callback in `js/eventSystem.js` at line 1132 (right after `activeLore.picked = true;`, before `showLoreDialog`).
- **Rationale**: Single integration point. The existing snippet flow (`showLoreDialog` + XP bonus) is preserved per C-08. We only **add** one line.
- **Code sketch**:
  ```js
  activeLore.picked = true;
  if (window.KnowledgeTree && typeof window.KnowledgeTree.addFragments === 'function') {
    window.KnowledgeTree.addFragments(1);
  }
  // ... existing XP + dialog code unchanged
  ```

## R-08: Localization (resolves FR-10)

- **Decision**: Register a new locale namespace `knowledge.*` via `window.i18n.register('de', ...)` and `window.i18n.register('en', ...)`. Keys live alongside the registration block at the top of `knowledgeTree.js` (mirrors `printingHouse.js` and `tutorialSystem.js`).
- **Keys to register**:
  - `knowledge.title`, `knowledge.fragments`, `knowledge.btn.respec`, `knowledge.btn.close`, `knowledge.respec.confirm`, `knowledge.maxRank`, `knowledge.noFragments`
  - One pair (`label` + `desc`) per node — 10 nodes × 2 keys × 2 langs = 40 strings.

## R-09: Test seam (`_configureForTest`) (resolves C-07)

- **Decision**: Expose `KnowledgeTree._configureForTest({ storage, now, recalcDerived, eventBus })` to swap dependencies. Defaults bind to `localStorage`, `Date.now`, `window.recalcDerived`, and a simple subscriber list.
- **Rationale**: Mirrors the pattern from `tutorialSystem.js` and `printingHouse.js` (auto-memory note + spec C-07). Lets Node-side tests run without the browser globals.

## R-10: Subscriber model (resolves NFR-04)

- **Decision**: `onChange(cb)` returns an `unsubscribe()` function. Internally a `Set`; iteration is `try { cb(...) } catch (e) { console.warn(...) }` per subscriber so a throwing subscriber does not prevent others from firing.
- **Rationale**: Identical to existing pattern in `factionSystem.js` and `printingHouse.js`.

---

## Open Items

None. All `NEEDS CLARIFICATION` resolved, all planning questions answered, alignment confirmed.

## Cross-references

- Spec: `kitty-specs/047-knowledge-tree-mvp/spec.md`
- Constitution: `.kittify/constitution/constitution.md` — Stack, Testing, Coding Guidelines, Knowledge-tree pillar (§Permanent Progression line 173)
- Pattern source files:
  - `js/printingHouse.js` — IIFE-on-window + persistence + `_configureForTest`
  - `js/tutorialSystem.js` — i18n register pattern
  - `js/factionSystem.js` — subscriber model
  - `js/scenes/HubSceneV2.js:1829` (`_showSkillTreeUI`) — modal UI pattern being replaced
  - `js/inventory.js:967-1000` (`recalcDerived` buff layers) — extension point for §3.9
  - `js/eventSystem.js:1130-1143` (lore-fragment overlap callback) — integration point for `addFragments(1)`
  - `js/player.js:878` (`getLootAbilityCooldownReduction`) — extension point for `cdrAll`
  - `js/main.js:470,806` (`playerCritChance`) — read site for `critAdd`
