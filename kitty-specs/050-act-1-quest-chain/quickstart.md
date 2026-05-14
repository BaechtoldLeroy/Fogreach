# Quickstart: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Date**: 2026-05-14

End-to-end smoke check after the chain lands. Mirrors the player journey end-to-end.

## Prereqs

- Local checkout on `main` with the feature merged.
- Node 18+ for `tools/runTests.js`.
- Local server: `npx serve .` then open the printed URL.
- Fresh save recommended (delete `localStorage['demonfall_save']` in DevTools) — pre-existing saves will work but may have inconsistent faction standings.

## 1. Unit tests pass

```bash
node tools/runTests.js
```

Expect: baseline 235+ tests grow by ~15 (factionSystem 5-standing coverage + questSystem chain + prerequisites graph). All green. Failures here = a broken refactor or quest-definition issue.

## 2. Hub NPCs visible

1. Start a new game from the title screen.
2. Complete the tutorial (044 — already shipped).
3. Land in the hub. Confirm via DevTools:
   ```js
   console.log(window.currentScene.children.list.filter(c => c.getData?.('npcId')).map(c => c.getData('npcId')));
   ```
   Expect at least: `['aldric', 'elara', 'mara', 'harren', 'branka', 'thom', 'klerus_priester', 'stadtwache']` (order may vary).
4. Visually verify Klerus + Garde NPC sprites render (no "missing texture" pink boxes). If pink boxes appear, the sprite audit fallback applies — log this and proceed.

## 3. Quest 1 offered

1. Walk to Harren. Press E to interact.
2. Expect: dialogue offers "Die verschwundene Tochter" with reward preview "+50 XP, +1 Independent, +1 Lore-Fragment".
3. Confirm Aldric / Klerus / Garde / Elara all say "Nichts zu besprechen" (or equivalent — Q2/Q3/Q4/Q5 not yet available).

## 4. Q1 completion path

1. Accept Q1. Enter the dungeon via the Rathaus entrance.
2. Reach the first room with a fetch-able object (`journal_fragment`). Pick it up.
3. Return to the hub. Talk to Harren.
4. Expect: `dialogueComplete` text + reward grant. Faction modal (open via standard hotkey) shows `Independent: 1`. KnowledgeTree shows +1 fragment.

## 5. Q2–Q5 all available in parallel

1. After Q1 complete, talk to Aldric → Q2 offered.
2. WITHOUT accepting Q2, talk to Klerus → Q3 offered.
3. WITHOUT accepting Q3, talk to Garde → Q4 offered.
4. WITHOUT accepting Q4, talk to Elara → Q5 offered.
5. Confirm: all 4 quest-offer dialogues are independently reachable. Confirm by running:
   ```js
   ['aldric', 'klerus_priester', 'stadtwache', 'elara'].forEach(id =>
     console.log(id, window.questSystem.getAvailableQuests(id).map(q => q.id))
   );
   ```
   Expect each to return its respective Q2–Q5 id.

## 6. Accept all four, complete in any order

1. Accept Q2 (Magistrat). Visit the Archive Forge. Approach Branka — expect a side-dialogue line trigger (Branka raises an eyebrow). Complete the craft. Return to Aldric. Standing toast: "Magistrat +1".
2. Accept Q3 (Klerus). Run the catacomb. Kill 3 elites. Return to Klerus. Standing toast: "Klerus +1".
3. Accept Q4 (Garde). Approach Thom at Printing House — side-dialogue triggers. Publish the patrol edict. Return to Garde. Standing toast: "Garde +1".
4. Accept Q5 (Widerstand). Run the dungeon, extract the document. Return to Elara. Standing toast: "Widerstand +1".

5. After all 4 complete, talk to Harren again. Expect Quest 6 (`council_collusion_reveal`) now offered — Harren says "Komm mit. Du musst etwas sehen."

## 7. Q6 climax + Act 2 hook

1. Accept Q6. Walk through the 4 dialogue pages — reveal scene, binary flavor choice, wrap-up.
2. Expect:
   - "Akt 2 beginnt" toast on hub return.
   - KnowledgeTree shows +1 fragment (act2 hook).
   - storySystem advances to Act 2 (`window.storySystem.getCurrentAct()` returns 2).

## 8. Faction-standing snapshot

After full Act-1 playthrough:
```js
const fs = window.FactionSystem;
['magistrat', 'klerus', 'garde', 'widerstand', 'independent'].forEach(f =>
  console.log(f, fs.getStanding(f))
);
console.log('council composite:', fs.getCouncilComposite());
```
Expect: all 5 at 1; council composite = 1.

## 9. Pacing measurement

Note start time at tutorial-complete moment, note end time at Q6 wrap-up toast. Target: **1h45min – 2h15min** wall-clock for a competent ARPG player reading dialogue at a normal pace.

If < 1h30min: investigate which quest collapsed to "click-click-done". Apply post-playtest tuning per plan §R-09 (bump Q3/Q5 depth).
If > 2h30min: investigate which dialogue is too long. Trim per #34 polish.

## 10. Console hygiene

Across the full playthrough, console must show:
- ZERO errors.
- ZERO `[FactionSystem] unknown faction id` warnings (existing save-key warnings excluded).
- ZERO `[questSystem] unknown quest id` warnings on quest-update events.
- ZERO `[RoomTemplates] Missing texture` warnings.

## 11. Save persistence

1. Mid-Q3 (with Q2 complete, Q3 active, Q4/Q5 not yet accepted), refresh the browser.
2. Re-load — confirm:
   - Q2 is in completed list (no longer offered by Aldric).
   - Q3 is active (Klerus shows progress page).
   - Q4 / Q5 are offered by Garde / Elara.
   - Magistrat standing is still 1.

## Done criteria

- [ ] `node tools/runTests.js` green, +15 tests.
- [ ] All 6 new quests reachable + completable in one playthrough.
- [ ] Q6 reveal lands with `act2_hook` fragment + Act-2 advancement.
- [ ] Faction standings: magistrat=1, klerus=1, garde=1, widerstand=1, independent=1.
- [ ] Branka + Thom side-dialogue triggers fire for Q2 + Q4 respectively.
- [ ] Console clean, no missing textures, no unknown-id warnings.
- [ ] Playtest wall-clock within 1.5–2.5h range.
