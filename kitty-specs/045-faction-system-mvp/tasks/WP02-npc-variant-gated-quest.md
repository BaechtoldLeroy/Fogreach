---
work_package_id: WP02
title: NPC variant + gated quest (showcase)
dependencies: [WP01]
requirement_refs:
- C-03
- C-04
- FR-09
- FR-10
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1e8cf39e7c9f08d63257a51a3bb23af73e5b48c8
created_at: '2026-05-02T14:53:17.506816+00:00'
subtasks: [T004, T005, T006, T007]
shell_pid: "30484"
history:
- timestamp: '2026-05-02T14:50:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/questSystem.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/HubSceneV2.js
- js/scenes/hub/hubLayout.js
- js/questSystem.js
---

# WP02 — NPC variant + gated quest (showcase)

## Branch strategy
- Planning base: `main` · merge target: `main`.
- Implement-time base: stack on top of WP01 (`spec-kitty implement WP02 --base WP01`).

## Objective
Wire the two showcase consumers from spec FR-09 + FR-10:
1. **Aldric** (Council Wachhauptmann) presents tier-aware greetings via `FactionSystem.getTier('council')`.
2. **Resistance fetch quest** is filtered into the offer list only when `FactionSystem.getStanding('resistance') >= 25`.

## Context (read first)
- [spec.md](../spec.md) — FR-09, FR-10.
- [data-model.md](../data-model.md) — i18n key surface (Aldric greet variants + quest title/desc are already registered by WP01).
- `js/scenes/hub/hubLayout.js` — Aldric NPC entry (`HUB_HITBOXES.npcs`).
- `js/scenes/HubSceneV2.js` — `_showNpcDialogue` is the dialog entry point; it picks `pages` based on `questMode`. Aldric's flavor branch is where the variant goes.
- `js/questSystem.js` — `getAvailableQuests(npcId)` is the offer filter.

## Subtasks

### T004 — Register Aldric variant lines in `hubLayout.js`
- The i18n keys (`faction.aldric.greet.{hostile,neutral,friendly,allied}`) are already registered by WP01. This subtask confirms the Aldric NPC entry has the metadata the dialog code needs:
  - Add a `factionId: 'council'` field to the Aldric entry (or an equivalent stable marker).
  - Add a `greetingKeyPrefix: 'faction.aldric.greet'` field so the dialog code can build keys per tier.
- If the file structure does not allow per-NPC metadata cleanly, fall back to keying the variant logic directly off `npc.name === 'Aldric'`.

### T005 — Tier-aware greeting in `HubSceneV2._showNpcDialogue`
- Locate the `flavor` branch (where `pages = []` and `pages.push({ text: npcData.lines?.[0] || ... })` runs).
- For Aldric, replace the flavor line with:
  ```js
  if (npcData.factionId && window.FactionSystem) {
    var tier = window.FactionSystem.getTier(npcData.factionId);
    var key = (npcData.greetingKeyPrefix || ('faction.' + npcData.id + '.greet')) + '.' + tier;
    var line = window.i18n ? window.i18n.t(key) : key;
    pages.push({ text: line });
  } else {
    // existing path
  }
  ```
- Falls back gracefully if `FactionSystem` is missing (Edict A-style fail-safe pattern from #46).

### T006 — Add `gate(player)` predicate to questSystem + showcase Resistance fetch quest
- In `js/questSystem.js`, find `getAvailableQuests(npcId)`. Filter logic should be:
  ```js
  return DEFINITIONS.filter(function (q) {
    if (q.npcId !== npcId) return false;
    if (typeof q.gate === 'function' && !q.gate()) return false;
    // ...existing accept/completed checks...
    return true;
  });
  ```
- Add the showcase quest definition. Suggested shape (copy fields from existing fetch quests):
  ```js
  {
    id: 'resistance_fetch_01',
    npcId: 'elara',  // pick the right Resistance NPC; if no Resistance NPC exists, attach to Independent NPC and document
    titleKey: 'faction.quest.resistance_fetch.title',
    descKey:  'faction.quest.resistance_fetch.desc',
    gate: function () {
      return window.FactionSystem
        && window.FactionSystem.getStanding('resistance') >= 25;
    },
    objectives: [/* existing fetch-quest objective shape */],
    rewards:    [/* small reward; 1 lore fragment + 50 gold */]
  }
  ```
- If no Resistance-coded NPC exists in `HUB_HITBOXES`, document the choice (e.g. attach to a flavor NPC like Harren) in the commit message.

### T007 — Manual verification + commit
- In DevTools:
  - `FactionSystem.adjustStanding('council', -30)` → walk to Aldric → greeting reads hostile.
  - `FactionSystem.adjustStanding('council', 60)` → walk to Aldric → greeting reads friendly/allied.
  - `FactionSystem.adjustStanding('resistance', 25)` → walk to the chosen Resistance NPC → quest offer appears.
  - `FactionSystem.adjustStanding('resistance', -50)` (back to 0) → re-open NPC → offer is gone.
- Commit:
  ```
  feat(WP02): Aldric tier-aware greeting + Resistance-gated quest

  Aldric (HUB_HITBOXES.npcs) gains factionId='council' metadata; his
  flavor greeting in HubSceneV2._showNpcDialogue switches between
  hostile/neutral/friendly/allied per FactionSystem.getTier.

  questSystem.getAvailableQuests filter now respects an optional
  gate() predicate per quest definition. The showcase resistance_fetch_01
  quest gates on Resistance standing >= 25.

  Refs #25
  ```

## Definition of Done
- [ ] Aldric greeting changes visibly when standing crosses tier boundaries.
- [ ] Resistance fetch quest appears/disappears at the standing threshold.
- [ ] No console errors in either flow.
- [ ] All existing tests still pass (no regression).

## Implementation command
```bash
spec-kitty implement WP02 --feature 045-faction-system-mvp --base WP01
```
