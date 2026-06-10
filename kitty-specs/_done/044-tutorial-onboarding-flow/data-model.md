# Data Model: Tutorial Onboarding Flow

**Feature**: 044-tutorial-onboarding-flow
**Date**: 2026-05-02
**Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

## Persisted state

**Storage**: `localStorage` under key `demonfall_tutorial_v1`.
**Owner**: `tutorialSystem` (no other module reads or writes this key).
**Lifecycle**: Created on first New Game without an existing save; deleted by the Settings "Tutorial neu starten" action; updated on every step transition.

```json
{
  "version": 1,
  "active": true,
  "currentStepId": "movement",
  "skipped": false,
  "completedSteps": ["init"]
}
```

| Field            | Type                  | Required | Notes |
|------------------|-----------------------|----------|-------|
| `version`        | integer               | yes      | Schema version. `1` for this feature. Bump on breaking changes. |
| `active`         | boolean               | yes      | True while the tutorial is currently progressing. False after completion or skip. |
| `currentStepId`  | string \| null        | yes      | Stable id of the current step (e.g., `"movement"`, `"forge.dialog"`). Null when `active === false`. |
| `skipped`        | boolean               | yes      | True if the player explicitly opted out (Settings toggle) or auto-skip detected an existing save. |
| `completedSteps` | string[]              | yes      | Ordered list of completed step ids. Used to support replay diagnostics; not required for normal advancement. |

### Migration policy

- `tutorialSystem.init()` reads the stored blob.
- If `version` is missing or `version > 1`, treat the persisted state as invalid → start fresh.
- If `version === 1`, accept and use as-is.

## In-memory step descriptor

Step definitions live as a static array inside `tutorialSystem.js`. They are not persisted. Each entry has the shape:

```js
{
  id:            string,         // stable, kebab-or-dot-cased
  scene:         string,         // scene key where this step is active ("HubSceneV2", "GameScene", null = any)
  hintKey:       string,         // i18n key for the banner text
  targetRef:     null | {        // optional highlight target
                   type: "entrance" | "npc",
                   name: string  // matches HUB_HITBOXES name
                 },
  completion: {
    event:       string,         // event name from the report() vocabulary
    matcher?:    (payload) => bool   // optional payload predicate
  } | { auto: true },            // step 11 only
  autoDismissMs?: number         // step 11: 5000
}
```

### The 12 steps

| # | id                       | scene        | hintKey                        | targetRef                          | completion event              |
|---|--------------------------|--------------|--------------------------------|------------------------------------|-------------------------------|
| 1 | `init`                   | StartScene   | (no banner — silent)            | none                               | scene transition to hub       |
| 2 | `movement`               | HubSceneV2   | `tutorial.step.movement`        | none                               | `player.moved`                |
| 3 | `forge.approach`         | HubSceneV2   | `tutorial.step.forge_approach`  | `{type:"entrance", name:"Werkstatt"}` | `hub.entrance.approached` (matcher: name === "Werkstatt") |
| 4 | `forge.dialog`           | HubSceneV2   | `tutorial.step.forge_dialog`    | `{type:"npc", name:"Branka"}`      | `dialog.closed` (matcher: npc === "Branka") |
| 5 | `keller.approach`        | HubSceneV2   | `tutorial.step.keller_approach` | `{type:"entrance", name:"Rathauskeller"}` | `hub.entrance.approached` (matcher: name === "Rathauskeller") |
| 6 | `keller.enter`           | HubSceneV2   | `tutorial.step.keller_enter`    | `{type:"entrance", name:"Rathauskeller"}` | `hub.entrance.entered` (matcher: name === "Rathauskeller") |
| 7 | `combat.basics`          | GameScene    | `tutorial.step.combat_basics`   | none                               | `combat.hit` (matcher: byPlayer === true) |
| 8 | `combat.ability`         | GameScene    | `tutorial.step.combat_ability`  | none                               | `combat.ability.used`         |
| 9 | `loot.pickup`            | GameScene    | `tutorial.step.loot_pickup`     | none                               | `loot.picked`                 |
| 10 | `loot.equip`            | GameScene    | `tutorial.step.loot_equip`      | none                               | `inventory.equipped`          |
| 11 | `save.notice`           | HubSceneV2   | `tutorial.step.save_notice`     | none                               | auto-dismiss (5000 ms)        |
| 12 | `druckerei.visit`       | HubSceneV2   | `tutorial.step.druckerei_visit` | `{type:"entrance", name:"Druckerei"}` (and switches to `{type:"npc", name:"Setzer Thom"}` after entrance.entered) | `dialog.closed` (matcher: npc === "Setzer Thom") |

After step 12 closes, `active = false`, `currentStepId = null`, banner and highlight clear.

## Event vocabulary (the `report()` contract)

| Event                       | Emitted by         | Payload                              | Used in step(s) |
|-----------------------------|--------------------|--------------------------------------|-----------------|
| `player.moved`              | HubSceneV2 update  | `{ dx, dy }`                         | 2               |
| `hub.entrance.approached`   | HubSceneV2         | `{ name }`                           | 3, 5, 12        |
| `hub.entrance.entered`      | HubSceneV2 (E-key) | `{ name }`                           | 6, 12           |
| `dialog.opened`             | HubSceneV2         | `{ npc }`                            | (informational) |
| `dialog.closed`             | HubSceneV2         | `{ npc }`                            | 4, 12           |
| `combat.hit`                | GameScene/enemy.js | `{ byPlayer: true, enemyId }`        | 7               |
| `combat.kill`               | GameScene/enemy.js | `{ enemyType }`                      | (informational) |
| `combat.ability.used`       | abilitySystem.js   | `{ slot }`                           | 8               |
| `loot.dropped`              | lootSystem.js      | `{ itemId }`                         | (informational) |
| `loot.picked`               | lootSystem.js      | `{ itemId }`                         | 9               |
| `inventory.opened`          | (UI handler)       | `{}`                                 | (informational) |
| `inventory.equipped`        | inventory module   | `{ slot }`                           | 10              |
| `hub.returned`              | HubSceneV2.create  | `{}`                                 | (informational; resets context for step 11) |

All events outside the active step's `completion.event` are silently dropped. No event ever throws.

## i18n keys

All registered by `tutorialSystem.js` at IIFE load time, both `de` (primary) and `en` (initial 1:1 translation):

```
tutorial.step.movement
tutorial.step.forge_approach
tutorial.step.forge_dialog
tutorial.step.keller_approach
tutorial.step.keller_enter
tutorial.step.combat_basics
tutorial.step.combat_ability
tutorial.step.loot_pickup
tutorial.step.loot_equip
tutorial.step.save_notice
tutorial.step.druckerei_visit
tutorial.druckerei.stub          # Setzer Thom's "under construction" line(s)
tutorial.skip.confirm            # window.confirm() text for Settings skip
tutorial.settings.skip_label     # Settings toggle label
tutorial.settings.replay_label   # Settings replay button label
tutorial.settings.replay_confirm # window.confirm() before replay
```

Total: ~16 keys × 2 languages = ~32 lines of i18n registration. (Spec estimate of "~25 strings" assumed only step text; the practical count is slightly higher when settings strings are included.)
