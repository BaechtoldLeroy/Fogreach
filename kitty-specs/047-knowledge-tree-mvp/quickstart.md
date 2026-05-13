# Quickstart: Knowledge Tree (MVP)

**Feature**: 047-knowledge-tree-mvp
**Generated**: 2026-05-13
**Phase**: 1
**Audience**: implementing engineer (or future Claude session) picking this up after `/spec-kitty.tasks`.

This is the "open it up, find the right files, see it work" guide. Read top-to-bottom; takes ~10 min.

---

## 1. Run the game locally

```powershell
npx serve -l 5173 .
# Then open http://localhost:5173
```

To verify the spawn loop works for Knowledge Tree, walk into the dungeon, kill a few enemies, wait for a lore-fragment event to fire (the floating scroll icon), pick it up. Currently this only shows a snippet + XP. After implementation, it will also increment the fragment counter.

## 2. Where the new module plugs in

```
┌─────────────────────────────────────────────────┐
│  js/knowledgeTree.js  (NEW — single IIFE module)│
│  - catalog (10 nodes)                           │
│  - getFragments / addFragments / invest / respec│
│  - subscriber list                              │
│  - localStorage I/O                             │
│  - mutates window.knowledgeTreeBuffs            │
└──────────────┬──────────────────────────────────┘
               │
   reads ↑     │      ↑ reads
               │      │
   ┌───────────┼──────┼─────────────┐
   │           │      │             │
   ▼           ▼      ▼             ▼
inventory.js  main.js  player.js   lootSystem.js
(§3.9 buffs) (crit+xp) (cdrAll)   (gold+magicFind+pickup)

   ┌─────────────────────────────────┐
   │  eventSystem.js                 │
   │  (overlap callback ~ line 1132) │
   │  → KnowledgeTree.addFragments(1)│
   └─────────────────────────────────┘

   ┌─────────────────────────────────┐
   │  HubSceneV2.js                  │
   │  _showSkillTreeUI is REPLACED   │
   │  by _showKnowledgeTreeUI        │
   │  K-key + Mara button entry      │
   └─────────────────────────────────┘
```

## 3. Five-step happy-path

After implementation, a full earn → invest → respec → re-invest cycle is:

1. Start a fresh run (clear localStorage `demonfall.knowledgeTree.v1` if necessary). Open DevTools and run `KnowledgeTree.getFragments()` → expect `0`.
2. Enter dungeon, wait for a lore-fragment to spawn, walk over it. The toast appears, the snippet dialog appears, XP is granted. Now run `KnowledgeTree.getFragments()` → expect `1`.
3. Return to hub. Walk to Mara. Click on the dialog button that **was** "Skills lernen" — it now opens the Knowledge Tree modal. Verify the title "Wissensbaum" (DE) / "Knowledge Tree" (EN), the fragment count "1", and 10 node cards.
4. Click `+` on `node_damage` ("Kraft des Wissens"). Verify: fragment count drops to `0`, rank shows `1/5`, and the HUD's damage value increased by 5 %.
5. Click "Respec". Confirm. Verify: fragment count is back to `1`, all ranks are `0`, HUD damage is back to baseline.

## 4. Where to start implementing (when /spec-kitty.tasks creates the WPs)

Recommended order (likely to mirror the eventual WP split, but the plan does not generate tasks — `/spec-kitty.tasks` does):

1. **knowledgeTree.js module** — catalog, state, persistence, API. Unit tests in `tests/knowledgeTree.test.js` for add/invest/respec/cap/wallet/persistence (SC-05). Verify via `npm test`.
2. **inventory.js §3.9 buff layer** — extend `recalcDerived()` to read `window.knowledgeTreeBuffs`. Verify by hand-setting `window.knowledgeTreeBuffs.damageMult = 1.5; recalcDerived(0,0)` in DevTools and watching weaponDamage change.
3. **main.js critAdd + xpMult** — apply critAdd to `playerCritChance` initialization, wrap `addXP` with `xpMult`.
4. **player.js cdrAll** — extend `getLootAbilityCooldownReduction` to add `knowledgeTreeBuffs.cdrAll` to the total.
5. **lootSystem.js goldMult + magicFindMult + pickupAddRange** — multiply gold drop value, scale rare/legendary roll weights, add to pickup overlap radius.
6. **eventSystem.js fragment increment** — one-line addition at the overlap callback.
7. **HubSceneV2.js modal** — replace `_showSkillTreeUI` body. Same K-key and Mara button trigger paths.
8. **i18n strings** — DE + EN, 47 keys (1 title + 6 chrome + 10×2 label/desc × 2 langs).
9. **index.html** — add `<script src="js/knowledgeTree.js"></script>` in the right place.

## 5. How to manually verify each stat hook works

| Buff | Manual verification |
|---|---|
| `damageMult` | Equip a weapon, note damage. Invest into `node_damage`, check HUD/dummy. |
| `armorAdd` | Get hit by a known-damage enemy. Invest `node_armor`. Take less damage. |
| `speedMult` | Walk a known distance, time it. Invest `node_speed`. Walk again. |
| `maxHpAdd` | Note max HP. Invest `node_max_hp`. Max HP increases by 10 per rank. |
| `critAdd` | Spam attacks, count crits in HUD/dev log. Invest. Crits become more frequent. |
| `xpMult` | Kill a known-XP enemy. Invest `node_xp`. Same enemy gives 5% more XP. |
| `goldMult` | Open a gold-drop chest. Note gold amount. Invest `node_gold`. Same drop gives 5% more. |
| `pickupAddRange` | Drop item far away. Note pickup radius. Invest `node_pickup`. Item auto-picks earlier. |
| `magicFindMult` | (Hard to verify in one run — check `lootSystem` debug log for adjusted tier weights.) |
| `cdrAll` | Use an ability, note cooldown. Invest `node_cdr`. Cooldown is shorter. |

## 6. Common pitfalls (predictions based on prior features)

- **Script-scope falle** (memory: `classic_script_scope`): `weaponDamage` is a script-scoped `let` in `main.js` — visible to other classic scripts by direct name but NOT as `window.weaponDamage`. Don't write `window.weaponDamage = ...` to apply the buff; let `recalcDerived` mutate the script-local binding the existing way.
- **Stat read site for crit**: `playerCritChance` is set at `main.js:806` from `baseStats.crit`. The Knowledge Tree's `critAdd` should be applied right after this assignment, and re-applied each time `recalcDerived` runs (so it survives equipment changes).
- **`recalcDerived` recursion**: invest → calls recalcDerived → which mutates stats → which fires subscribers. Make sure the module does not subscribe to its own changes.
- **Persistence races**: only the module writes to its key. Don't have UI code touch `localStorage[knowledgeTree.v1]` directly.
- **Mara dialog rendering** (`HubSceneV2.js:1010` `isMaraFlavor`): the existing button position and label key (`hub.skills.learn`) drive the entry button. Decision required during WP: keep the same label key ("Skills lernen") or relabel to "Wissen" / "Knowledge". Recommended: re-key to `hub.knowledge.learn` to keep the i18n strings honest.

## 7. Running tests

```powershell
node tools/runTests.js
# or via npm:
npm test
```

After implementation, this should still pass (baseline was 188 tests at end of last session). New file `tests/knowledgeTree.test.js` should add coverage for SC-05.

## 8. Where to NOT touch

- `js/skillSystem.js` — runtime of already-learned active skills. Stays intact. Player keeps abilities they earned before this feature ships.
- `window.SKILL_TREES` — the active-skill catalog. Remains in code; just no longer reachable from Mara in MVP. Phase 2 will re-route or re-introduce.
- Brunnen, Druckerei, Faction modules — independent contributors; do not modify their buff layers, just add a new layer next to them.
