# Data Model: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Date**: 2026-05-14

Two data domains change: **quest definitions** (the QUEST_DEFINITIONS catalog in `js/questSystem.js`) and **faction standings** (the FACTION_IDS + state shape in `js/factionSystem.js`). Plus 2 new entries in the hub NPC roster.

## Domain 1: Quest Definitions

### New quest schema field

| Field | Type | Required | Description | Notes |
|---|---|---|---|---|
| `rewards.factionStanding` | object | no | Map of `factionId → delta` applied via `factionSystem.adjustStanding()` after the existing reward grant | NEW — see R-03. Backward-compatible (existing quests don't set it). |

All other quest fields stay as documented in the existing 18-quest catalog.

### The 6 new Act-1 quest definitions

#### Q1 — `harren_daughter_investigation`
```yaml
id: harren_daughter_investigation
title: Die verschwundene Tochter (DE) / The Vanished Daughter (EN)
description: Find the journal fragment in the catacombs.
npcId: harren
type: fetch
chain: 1
objectives:
  - type: fetch, target: 'journal_fragment', current: 0, required: 1
rewards:
  xp: 50
  factionStanding: { independent: 1 }
  fragments: 1  # via KnowledgeTree.addFragments — new mechanic? OR via rewards.druckblaetter pattern?
prerequisites: []
requiredAct: 1
dialogueOffer: (multi-paragraph, see plan §Q1)
dialogueProgress: ...
dialogueComplete: ...
```

#### Q2 — `magistrat_verification`
```yaml
id: magistrat_verification
title: Magistrats-Verifikation
npcId: aldric
type: craft
chain: 2
objectives:
  - type: craft, target: 'council_sealed_document', current: 0, required: 1
rewards:
  xp: 75
  factionStanding: { magistrat: 1 }
prerequisites: [harren_daughter_investigation]
requiredAct: 1
```

#### Q3 — `klerus_purification`
```yaml
id: klerus_purification
title: Reinigung der unteren Kammern
npcId: klerus_priester
type: kill
chain: 2
objectives:
  - type: kill, target: 'elite_enemy', current: 0, required: 3
rewards:
  xp: 90
  factionStanding: { klerus: 1 }
prerequisites: [harren_daughter_investigation]
requiredAct: 1
```

#### Q4 — `garde_patrol_expansion`
```yaml
id: garde_patrol_expansion
title: Patrouillen-Erweiterung
npcId: stadtwache
type: edict
chain: 2
objectives:
  - type: edict, target: 'patrol_expansion', current: 0, required: 1
rewards:
  xp: 75
  factionStanding: { garde: 1 }
prerequisites: [harren_daughter_investigation]
requiredAct: 1
```

#### Q5 — `widerstand_proof`
```yaml
id: widerstand_proof
title: Beweise aus der Ritualkammer
npcId: elara
type: fetch
chain: 2
objectives:
  - type: explore, target: 'room', current: 0, required: 3
  - type: fetch, target: 'council_document', current: 0, required: 1
rewards:
  xp: 100
  factionStanding: { widerstand: 1 }
  fragments: 1
prerequisites: [harren_daughter_investigation]
requiredAct: 1
```

#### Q6 — `council_collusion_reveal`
```yaml
id: council_collusion_reveal
title: Die geheime Sitzung
npcId: harren
type: dialogue
chain: 3
objectives:
  - type: dialogue, target: 'collusion_reveal_seen', current: 0, required: 1
rewards:
  xp: 150
  fragments: 1
  unlocks: [act2_open]
prerequisites: [magistrat_verification, klerus_purification, garde_patrol_expansion, widerstand_proof]
requiredAct: 1
```

### Legacy quest cleanup table

| Quest ID | Akt | Action | Rationale |
|---|---|---|---|
| `aldric_cleanup` | 0 | KEEP | Tutorial warmup — first Aldric interaction, generic kill-10 |
| `aldric_patrol` | 0 | KEEP | Tutorial warmup — first explore-3 |
| `resistance_fetch_01` | 0 | KEEP + rename internal `'resistance'` → `'widerstand'` standing-read | Faction-gated showcase, still relevant |
| `aldric_intruders` | 1 | **DELETE** | Generic kill-20, conflicts with new Q2. Ratsschwert reward dropped. |
| `harren_daughter` | 1 | **DELETE** | Conflicts with new Q1's `harren_daughter_investigation` (better narrative + Elara alive) |
| `branka_armor` | 1 | **DELETE** | Generic fetch, blocks no other content (only `branka_doubt` referenced it as prereq) |
| `branka_doubt` | 2 | PATCH `prerequisites: ['branka_armor'] → []` | Was gated on the deleted Akt-1 quest |
| `harren_rescue` | 5 | PATCH `prerequisites: ['harren_daughter'] → ['harren_daughter_investigation']` | Rewire to new Q1 |
| All 11 other Akt-2–5 skeletons | 2–6 | UNTOUCHED | Locked behind requiredAct, not 050's concern |

## Domain 2: Faction System

### New schema

`FACTION_IDS` grows from 3 to 5:
```js
var FACTION_IDS = ['magistrat', 'klerus', 'garde', 'widerstand', 'independent'];
```

State shape in `_freshState()`:
```js
standings: { magistrat: 0, klerus: 0, garde: 0, widerstand: 0, independent: 0 }
```

### New API: `getCouncilComposite()`

Returns the maximum of the three Council-faction standings. Used by callers that need a "loyal to the Council apparatus in general" signal without enumerating all three.

```js
function getCouncilComposite() {
  return Math.max(getStanding('magistrat'), getStanding('klerus'), getStanding('garde'));
}
```

### Migration touchpoints

These call sites currently read `getStanding('council')` or `getStanding('resistance')` and need updates:

| File:Line | Current call | Replacement | Why |
|---|---|---|---|
| `js/questSystem.js:181-182` | `getStanding('resistance') >= 25` | `getStanding('widerstand') >= 25` | Rename |
| `js/printingHouse.js:338` | `getStanding('resistance')` | `getStanding('widerstand')` | Rename |
| `js/printingHouse.js:367` | `getStanding('resistance')` | `getStanding('widerstand')` | Rename |
| `js/scenes/HubSceneV2.js` (greeting variants — grep) | `getStanding('council')` if present | `getCouncilComposite()` | Composite — any Council faction triggers Aldric greeting tier |

**Audit step before coding**: grep all of `js/` for `'council'` and `'resistance'` string literals in faction context, build a complete replacement table.

### i18n key changes

Existing keys (faction-aldric prefix) keep their semantics — Aldric is now explicitly the Magistrat face:
- `faction.aldric.greet.hostile/neutral/friendly/allied` → KEEP (Aldric IS Magistrat — these are Magistrat-tier greetings)

New i18n keys (DE + EN, register at module init):
- `faction.magistrat.label`, `faction.klerus.label`, `faction.garde.label`, `faction.widerstand.label`, `faction.independent.label` — for Faction-modal display
- `faction.klerus.greet.*`, `faction.garde.greet.*`, `faction.elara.greet.*` — 4 tiers each (hostile/neutral/friendly/allied), parallel to Aldric's existing set
- Quest-related strings (auto-registered from QUEST_DEFINITIONS via the existing i18n bootstrap at `questSystem.js:357`)
- `sidedialog.branka.q2_eyebrow`, `sidedialog.thom.q4_eyebrow` — Q2/Q4 side-dialogue lines

### Save migration (intentionally absent)

Per user direction: no save migration. Saves with the old `council`/`resistance` keys load as-is; the new state has only the new 5 keys populated at 0. Existing standings are NOT carried over. The factionSystem's existing `_warnUnknownOnce` swallows the legacy key warnings. Acceptable narrative dissonance — players starting Act 1 fresh anyway.

## Domain 3: Hub NPCs

### New entries in `hubLayout.js` `npcs` array

```js
{
  id: 'klerus_priester',
  name: 'Hochpriester der Ordnung',
  x: 480, y: 360,
  texture: 'priester',  // existing sprite from RitualChamber template (audit at Phase 1)
  scale: 0.36,
  lines: [
    'Die Ordnung des Kettenrats ist heilig. Wer sie befragt, befragt das Licht selbst.',
    'Ketzerei beginnt mit der falschen Frage. Halte deine Lippen rein.',
    'Wenn die Tochter geflohen ist, war es nicht aus eigenem Willen. Eine dunkle Hand führt sie.'
  ]
},
{
  id: 'stadtwache',
  name: 'Wachtmeister der Garde',
  x: 580, y: 380,
  texture: 'stadtwache',  // existing sprite from Catacombs template (audit at Phase 1)
  scale: 0.34,
  lines: [
    'Die Patrouillen wachsen jeden Monat. So muss es sein — die Stadt ist unruhig.',
    'Loyalität ist die einzige Münze, die zwischen den Strassen Bestand hat. Frag nicht warum.',
    'Wenn der Magistrat ruft, antwortet die Garde. Wenn der Klerus segnet, marschiert die Garde. So funktioniert es.'
  ]
}
```

**Sprite audit risk**: If `priester` or `stadtwache` aren't actually loaded as hub-scale images, fallback per plan §R-05 (off-screen voices via dialogue without hub-visible NPC) or temporary placeholder sprite.

### Existing Widerstand NPCs (untouched)

`branka` + `thom` entries in `hubLayout.js:93-115` stay exactly as-is. Their dialogue lines already anti-Council, no rewrites needed.

## Validation Rules

These invariants must hold after the implementation:

1. **Quest catalog completeness**: every quest ID referenced in any `prerequisites` array exists in `QUEST_DEFINITIONS`. Verified by `tests/questSystem.test.js` extension.
2. **Faction-standing consistency**: `getStanding(factionId)` returns 0 for any factionId in FACTION_IDS at fresh init; returns the stored delta after `adjustStanding()`. Existing tests cover this; extend to all 5 IDs.
3. **Composite consistency**: `getCouncilComposite()` = max(magistrat, klerus, garde) regardless of widerstand/independent values. NEW test.
4. **No orphan quest offers**: every quest with `requiredAct: 1` and `prerequisites: []` (or all-fulfilled) has an `npcId` matching a hub NPC that exists in `hubLayout.npcs`. Audit step in Phase 1 implementation.
5. **i18n coverage**: every `dialogueOffer` / `dialogueProgress` / `dialogueComplete` in the 6 new quests has both DE + EN i18n keys registered. Verified by running with `i18n.setLanguage('en')` and grepping console for missing-key warnings.

## Cross-Cutting: Storage & Persistence

- Quest state: existing `getQuestSaveData / loadQuestSaveData` flow. Unknown quest IDs silently dropped. NO schema bump.
- Faction state: schema-versioned at `SCHEMA_VERSION = 1`. NO bump per user direction (saves with old keys load with empty standings).
- Knowledge Tree: existing `KnowledgeTree.addFragments(n)` is the canonical entry point. Q1/Q5/Q6 grant fragments.
- localStorage keys unchanged: `demonfall_quests_v1`, `demonfall_factions_v1`, `demonfall.knowledgeTree.v1`.
