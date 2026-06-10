---
work_package_id: WP03
title: Q6 Climax Scene + Q2/Q4 Side-Dialogue Hooks
dependencies:
- WP02
requirement_refs:
- FR-07
- FR-08
- FR-12
- NFR-02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 89876f67edb3e951c6480e61e388ad17ea632494
created_at: '2026-05-14T17:47:34.591440+00:00'
subtasks:
- T015
- T016
- T017
- T018
- T019
phase: Phase 3 — UI / Polish
assignee: ''
agent: claude
shell_pid: "32348"
history:
- timestamp: '2026-05-14T17:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks-packages
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/HubSceneV2.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP03 — Q6 Climax Scene + Q2/Q4 Side-Dialogue Hooks

## Objective

Replace WP02's Q6 placeholder dialogue with the full 4-page collusion-reveal climax scene. Wire the Q2/Q4 side-dialogue triggers so Branka reacts when the player visits the Forge for the Magistrat (Q2), and Thom reacts when the player publishes the Garde edict (Q4). These are the political-thesis payoffs of the chain — the side-dialogues seed the first cracks, and Q6's reveal delivers the punch.

After this WP, the full Act-1 demo loop hits its narrative climax.

## Context

- **Spec**: `kitty-specs/050-act-1-quest-chain/spec.md` (FR-07, FR-08, FR-12b, NFR-02)
- **Plan**: `kitty-specs/050-act-1-quest-chain/plan.md`
- **Research**: `kitty-specs/050-act-1-quest-chain/research.md` §R-06, R-08
- **Existing patterns**: `_showDialoguePages` (`js/scenes/HubSceneV2.js`), `_ktPropagateScrollFactor` (same file), `questSystem.onQuestUpdate` subscription bus.
- **Project memory**: [[project_phaser_scrollfactor_dialogs]] — mobile-tappability gotcha for any new modal.

## Subtasks

### T015 — Implement `_showCollusionReveal()` in HubSceneV2

Add a new method to the HubSceneV2 class. Structure as a 4-page invocation of `_showDialoguePages` (the existing modal flow):

**Page 1** — Harren narration:
> "Komm mit. Ich muss dir etwas zeigen, das ich seit Jahren ahne — aber niemals beweisen konnte. Du hast für alle drei gearbeitet. Jetzt siehst du sie zusammen."

Auto-advance via Space/Enter (existing pattern).

**Page 2** — Reveal scene:
> "Hinter den verschlossenen Türen der Rathauskeller-Halle treffen sie sich. Magistrat. Klerus. Garde. Drei Stimmen, die in der Stadt nie öffentlich übereinstimmen — und hier, im Schatten der Wandkerzen, sprechen sie wie ein einziger Mund. Pakte werden bestätigt. Namen werden gestrichen. Eine davon: die Tochter des Bürgermeisters."

Optional visual: layered sprite stand-ins (aldric + klerus_priester + stadtwache) at low alpha as silhouettes. If sprite layering produces a visual mess, fall back to pure text — document the choice.

**Page 3** — Binary flavor choice (NO content branching):

Choices:
- "[ Umdrehen — vergessen, was ich gesehen habe ]"
- "[ Erinnern — was auch immer das kostet ]"

Both proceed to Page 4. Record the choice via `window.storySystem.recordChoice('act1_finale', value)` if that API exists (audit during T015 — if missing, just skip the recording; the Acts-2-5 epic can use it later).

**Page 4** — Wrap-up:
> "Du gehst hinaus in den Nebel. Was du gehört hast, lässt sich nicht ungehört machen. Der Kettenrat ist nicht drei Stimmen — er ist eine, die drei Masken trägt. Und du? Du hast bereits für jede Maske gearbeitet."
>
> "Akt 2 beginnt jenseits dieses Hubs."

The Q6 quest completion handler (already wired in WP02) fires after Page 4 closes:
- `KnowledgeTree.addFragments(1)` — granted via the WP02 reward dispatcher
- `storySystem.advanceToAct(2)` — granted via the WP02 hook
- Run-summary modal subsequently shows on hub return (already shipped from earlier work)

**Hook**: replace the Q6 placeholder offered in WP02's `dialogueOffer` with a custom UI path. Pattern: in HubSceneV2's quest-offer handler, detect `quest.id === 'council_collusion_reveal'` and invoke `this._showCollusionReveal()` instead of the default `_showDialoguePages` flow. After page 4, programmatically call `questSystem.completeQuest('council_collusion_reveal')`.

### T016 — Apply `_ktPropagateScrollFactor` on Q6 modal

After populating the Q6 modal container, call:

```js
this._ktPropagateScrollFactor(container, 0, 0);
```

This is the mobile-safe pattern from [[project_phaser_scrollfactor_dialogs]] — without it, mobile players cannot tap the choice buttons or the close button. NON-NEGOTIABLE per project memory.

Verify by toggling DevTools to mobile-viewport sim:
1. Load to Q6.
2. Tap each choice button — both should fire.
3. Tap "Continue" / dismiss — should close.

### T017 — Subscribe to onQuestUpdate for side-dialogue arming

In `HubSceneV2.create()` (around the existing `_questUpdateHandler` setup):

```js
this._pendingSideDialogue = null;
const sideDialogueArmer = (event) => {
  if (event.type !== 'quest_activated') return;
  if (event.questId === 'magistrat_verification') {
    this._pendingSideDialogue = { npcId: 'branka', dialogueKey: 'sidedialog.branka.q2_eyebrow' };
  } else if (event.questId === 'garde_patrol_expansion') {
    this._pendingSideDialogue = { npcId: 'thom', dialogueKey: 'sidedialog.thom.q4_eyebrow' };
  }
};
window.questSystem.onQuestUpdate(sideDialogueArmer);
this._sideDialogueUnsub = () => window.questSystem.offQuestUpdate(sideDialogueArmer);
```

Clean up in the shutdown handler:
```js
if (this._sideDialogueUnsub) { this._sideDialogueUnsub(); this._sideDialogueUnsub = null; }
```

### T018 — Trigger side-dialogue on NPC approach

In the NPC interaction handler in HubSceneV2 (where Branka/Thom dialogue currently fires):

```js
// At the top of the NPC dialogue trigger:
if (this._pendingSideDialogue?.npcId === npcId) {
  const key = this._pendingSideDialogue.dialogueKey;
  this._pendingSideDialogue = null;
  this._showDialoguePages(
    npcData,
    npcData.name,
    [{ text: T(key), choices: null }],
    'flavor',
    null,
    0
  );
  return; // skip the normal NPC dialogue this time
}
```

The side-dialogue i18n keys (`sidedialog.branka.q2_eyebrow`, `sidedialog.thom.q4_eyebrow`) are registered in WP02's T012 (which owns `js/i18n.js`). This WP only consumes them — verify both keys resolve in DE + EN before declaring T018 done.

### T019 — Manual end-to-end playtest

Run `quickstart.md` end-to-end, measuring:
- **Wall-clock time** from tutorial-end to Q6-completion (target: 1.5–2.5 h).
- **Side-dialogue triggers**: Branka fires during Q2's Forge visit; Thom fires during Q4's edict publication.
- **Q6 reveal**: 4 pages render, choice buttons work, both choice paths exit the modal cleanly.
- **Console hygiene**: zero errors, zero `[FactionSystem] unknown faction id` warnings (excluding the expected pre-save warnings), zero `[questSystem] unknown quest id` warnings on legitimate quest events.
- **Faction-standing snapshot at Q6 completion**: magistrat=1, klerus=1, garde=1, widerstand=1, independent=1, council composite=1.

Capture findings in the WP03 merge commit:
- If wall-clock < 1h30m: bump Q3/Q5 dungeon depth (per plan §R-09) in a follow-up.
- If wall-clock > 2h30m: identify the longest quest, trim its dialogue (#34 polish territory).
- If a quest collapses to "click-click-done": flag for #34 tuning.

## Owned files

- `js/scenes/HubSceneV2.js` — `_showCollusionReveal()` helper, side-dialogue subscription + trigger, shutdown cleanup

(`js/i18n.js` side-dialogue keys are owned by WP02 T012 to avoid file-overlap with WP02. WP03 only consumes them via `i18n.t()`.)

## Risks

- **Q6 visual layering** (T015): rendering three sprite "silhouettes" may not look right without proper asset work. Default to text-only with the option to layer sprites if it looks OK. Document the decision in the commit.
- **scrollFactor falle** (T016): forgetting `_ktPropagateScrollFactor` makes the modal unusable on mobile. Project memory documented this — NON-NEGOTIABLE.
- **Side-dialogue timing** (T017/T018): firing immediately on quest-activation vs on NPC approach. The spec says approach — verify the trigger is on the actual interaction-zone overlap, not on `accept` event.
- **One-shot semantics** (T018): clear `_pendingSideDialogue` after firing so subsequent Branka/Thom approaches show normal NPC dialogue, not the side-dialogue again.
- **`storySystem.recordChoice` API uncertainty** (T015 Page 3): if no such API exists, the binary choice is purely a UX moment. Acts-2-5 epic can add the recording later. Don't block on it.

## Independent test

After merge:
1. `node tools/runTests.js` — baseline (no new tests in this WP, but existing must still pass).
2. Fresh-save playthrough per `quickstart.md` Steps 1–11. All checks pass.
3. Mobile-viewport sim test for Q6 modal — all buttons tappable.
4. Re-run with `i18n.setLanguage('en')` — Q6 + side-dialogues read correctly.

## Implementation command

```bash
spec-kitty implement WP03 --feature 050-act-1-quest-chain --base WP02
```
