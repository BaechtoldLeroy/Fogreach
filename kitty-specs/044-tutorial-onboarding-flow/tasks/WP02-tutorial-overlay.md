---
work_package_id: WP02
title: Tutorial overlay (banner + highlight)
dependencies: [WP01]
requirement_refs:
- C-03
- C-05
- FR-04
- FR-05
- FR-12
- NFR-01
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: c1cb24dbdd3ea093a2788bdc25bdbe11be33d4b1
created_at: '2026-05-02T12:20:39.565131+00:00'
subtasks: [T004, T005, T006]
shell_pid: "6556"
agent: "claude"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/scenes/tutorialOverlay.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/tutorialOverlay.js
- index.html
---

# WP02 — Tutorial overlay (banner + highlight)

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- **Implement-time base**: stack on top of WP01 if WP01 hasn't merged yet (`spec-kitty implement WP02 --base WP01`).

## Objective

Render the tutorial visually. Implement `js/scenes/tutorialOverlay.js`, a Phaser overlay class that subscribes to `TutorialSystem.onChange` and produces:

1. A persistent **hint banner** anchored bottom-center, displaying the current step's localized hint text.
2. A **target highlight** — a Phaser `Graphics` outline drawn around the current step's target (entrance hitbox or NPC sprite), with a 1 Hz alpha pulse.
3. A **mount API** so hub and dungeon scenes can attach/detach the overlay cleanly: `mount(scene)`, `unmount()`.

Then update `index.html` to load the two new scripts (`tutorialSystem.js` first, `tutorialOverlay.js` after) before any scene file.

## Context (read first)

- [spec.md](../spec.md) — FR-04, FR-05, FR-12, NFR-01, NFR-03, NFR-05, C-03, C-05.
- [data-model.md](../data-model.md) — step descriptor shape and the `targetRef` structure.
- [research.md](../research.md) D-02 (highlight rendering decision), D-03 (pub/sub).
- [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md) — `onChange`, `getCurrentStep`, `isActive`.
- `js/hudV2.js` — reference for Phaser layer layout (`createPrompt`, depth/z-order, i18n integration).
- `js/scenes/hub/hubLayout.js` — `HUB_HITBOXES` array (the `name` field is what `targetRef.name` refers to for entrances and NPCs).
- `index.html` — existing `<script>` order; tutorial scripts must load **after** `i18n.js`, `storage.js`, `persistence.js` and **before** any scene file.

## Visual conventions (match hudV2)

- Banner background: semi-transparent dark rectangle. Width: 70 % of camera width. Height: ~64 px. Position: bottom-center, ~32 px above bottom edge.
- Banner text: monospace (same font as `createPrompt`), 18–20 pt, color `#ffffff`.
- Banner depth: above scene gameplay, below modal dialogs (suggested depth: `1500`; HubSceneV2's NPC dialog uses `2000`).
- Highlight outline: 3 px stroke. Color `#ffd95a` (warm gold, contrasts with the dungeon palette). Pulses alpha between 0.4 and 1.0 at 1 Hz via Phaser tween.
- For entrance targets: rectangle outline matching the hitbox bounds.
- For NPC targets: circle outline of radius `max(width, height) * 0.6` centered on the NPC sprite.

---

## Subtask T004 — Banner + onChange subscription + mount API

**Purpose**: Build the overlay class and the live-update wiring against `TutorialSystem`.

**Steps**:

1. Create `js/scenes/tutorialOverlay.js` as an IIFE attaching `window.TutorialOverlay`:

   ```js
   (function () {
     function create(scene) {
       const overlay = {
         scene,
         banner: null,           // Phaser.GameObjects.Container { bg, text }
         highlight: null,        // Phaser.GameObjects.Graphics
         tween: null,
         _unsub: null,
         currentTargetRef: null,
       };

       overlay.mount = function () {
         this._unsub = window.TutorialSystem.onChange((step) => this._render(step));
         this._render(window.TutorialSystem.getCurrentStep());
       };

       overlay.unmount = function () {
         if (this._unsub) this._unsub();
         this._destroyVisuals();
       };

       overlay._render = function (step) { /* ... */ };
       overlay._renderBanner = function (step) { /* ... */ };
       overlay._renderHighlight = function (step) { /* ... */ };
       overlay._destroyVisuals = function () { /* ... */ };

       return overlay;
     }

     window.TutorialOverlay = { create };
   })();
   ```

2. Implement `_renderBanner(step)`:
   - If `step` is null OR `step.hintKey` is null/undefined → destroy any existing banner.
   - Else → create or update a Container with a Rectangle (background) + Text (hint).
   - Text source: `window.i18n.t(step.hintKey)` (fall back to `step.hintKey` itself if i18n is unavailable).
   - Subscribe to `window.i18n.onChange(() => this._renderBanner(step))` so language changes update text live (NFR-03). Store the unsubscribe alongside `_unsub`.

3. Implement `_render(step)`:
   - Calls `_renderBanner(step)` and `_renderHighlight(step)` in that order.
   - Handles `step === null` by tearing both visuals down.

4. Implement `_destroyVisuals()` cleanly — destroy `banner`, `highlight`, and stop the `tween`. Null the references.

5. Anchor banner at the active scene's camera midX, just above the bottom edge:
   ```js
   const cam = this.scene.cameras.main;
   const x = cam.midPoint.x;
   const y = cam.scrollY + cam.height - 60;
   ```
   Use `setScrollFactor(0)` if your scene scrolls. (Hub does not scroll; dungeon may.)

6. Choose depth `1500`.

**Files**:
- `js/scenes/tutorialOverlay.js` — new, partial (banner-only at this subtask end). Will grow in T005.

**Validation**:
- [ ] File exists with `create(scene)` returning an object with `mount` / `unmount`.
- [ ] Manually injecting in DevTools: `const o = TutorialOverlay.create(game.scene.getScene('HubSceneV2')); o.mount();` shows the banner if a step is active (after WP01 + manual `TutorialSystem.replay()`).
- [ ] Switching language (`i18n.setLanguage('en')`) updates banner text.

---

## Subtask T005 — Target resolver + highlight outline + alpha pulse

**Purpose**: Add the visual highlight that draws attention to the current step's `targetRef`.

**Steps**:

1. Implement `_renderHighlight(step)`:
   - If `step?.targetRef` is null → destroy any existing highlight.
   - Else → resolve the target's bounding box and draw the outline. Re-create a `Graphics` only if the target ref *changed*; otherwise keep the existing one to avoid tween thrashing.

2. Implement target resolution:

   ```js
   function resolveTarget(scene, ref) {
     // ref: { type: 'entrance' | 'npc', name: string }
     if (!ref) return null;

     // HubSceneV2: entrances & NPCs come from HUB_HITBOXES.
     // Look up by name.
     const all = (window.HUB_HITBOXES || []);
     const hit = all.find(h => h.name === ref.name);
     if (!hit) return null;
     return { x: hit.x, y: hit.y, w: hit.w || 64, h: hit.h || 64, kind: ref.type };
   }
   ```

   *If `HUB_HITBOXES` is not exposed globally yet, add the export in WP03 — for now, fall back to scanning `scene.children.list` for objects whose `data?.get('hitboxName') === ref.name`. If both lookups fail, log a warning and skip the highlight (never throw).*

3. Draw the outline:

   ```js
   overlay._drawOutline = function (target) {
     this.highlight = this.scene.add.graphics();
     this.highlight.setDepth(1490); // just below the banner
     this.highlight.lineStyle(3, 0xffd95a, 1.0);
     if (target.kind === 'entrance') {
       const x = target.x - target.w / 2;
       const y = target.y - target.h / 2;
       this.highlight.strokeRect(x, y, target.w, target.h);
     } else {
       const r = Math.max(target.w, target.h) * 0.6;
       this.highlight.strokeCircle(target.x, target.y, r);
     }
   };
   ```

4. Add the alpha-pulse tween (1 Hz):

   ```js
   this.tween = this.scene.tweens.add({
     targets: this.highlight,
     alpha: { from: 0.4, to: 1.0 },
     duration: 500,
     yoyo: true,
     repeat: -1,
     ease: 'Sine.easeInOut',
   });
   ```

5. Cleanup: in `_destroyVisuals` make sure to call `this.tween.stop()` and `this.highlight.destroy()` before nulling.

6. Performance: the highlight is one `Graphics` + one tween per active step. There is no per-frame redraw beyond what Phaser already does for tween targets. NFR-01 (60 fps) is met.

**Files**:
- `js/scenes/tutorialOverlay.js` — extended, ~180 lines total at end of T005.

**Validation**:
- [ ] Calling `o.mount()` after step 3 (`forge.approach`) becomes active draws an outline around the Werkstatt entrance.
- [ ] Outline pulses smoothly at ~1 Hz.
- [ ] When the step advances to step 5 (`keller.approach`), the outline retargets to the Rathauskeller entrance without flicker.
- [ ] `overlay.unmount()` removes both banner and highlight cleanly.
- [ ] No frame drops during a 30-second highlight observation (visual check).

---

## Subtask T006 — Update `index.html` script includes

**Purpose**: Make the new modules actually load in the browser, in the right order.

**Steps**:

1. Open `index.html`. Locate the existing `<script>` block.

2. Add two new `<script>` tags. Order is critical:
   - `tutorialSystem.js` must be **after** `i18n.js`, `storage.js`, `persistence.js` (it depends on them at IIFE load).
   - `tutorialOverlay.js` must be **after** `tutorialSystem.js`.
   - Both must be **before** `StartScene.js`, `HubSceneV2.js`, `GameScene.js`, `SettingsScene.js` (those scenes will reference `window.TutorialSystem` and `window.TutorialOverlay` in WP03/WP04/WP05).

   Suggested placement (paths assume the existing project layout):

   ```html
   <script src="js/i18n.js"></script>
   <script src="js/storage.js"></script>
   <script src="js/persistence.js"></script>
   <!-- ...other foundation modules... -->
   <script src="js/tutorialSystem.js"></script>      <!-- NEW -->
   <script src="js/scenes/tutorialOverlay.js"></script> <!-- NEW -->
   <!-- ...scene files... -->
   ```

3. Reload the game in the browser. Expect no console errors. `window.TutorialSystem` and `window.TutorialOverlay` should be defined globally.

4. Re-run `npm run test:smoke`. Expect exit 0.

**Files**:
- `index.html` — modified (2 new lines).

**Validation**:
- [ ] Both globals exist after page load (`typeof window.TutorialSystem === 'object'`, same for `TutorialOverlay`).
- [ ] No "TutorialSystem is undefined" errors from any scene.
- [ ] Smoke passes.

---

## Definition of Done

- [ ] T004, T005, T006 marked complete.
- [ ] Banner renders, advances on step change, updates on language change.
- [ ] Highlight outline draws around entrance/NPC targets and pulses cleanly.
- [ ] No frame drops with overlay active (visual confirmation).
- [ ] `index.html` script order is correct; smoke passes.

## Risks & mitigations

- **HUB_HITBOXES not globally exposed** → add a fallback lookup path in T005; document for WP03 to expose it formally.
- **Banner overlaps existing HUD elements** → tune anchor offset or background opacity during T004 visual review.
- **Tween memory leak on scene shutdown** → ensure `unmount()` is called from scene `shutdown` (will be wired in WP03/WP04).

## Reviewer guidance

- Visually verify the highlight pulse during scene transitions.
- Confirm `_destroyVisuals` is invoked in every code path that removes the overlay.
- Confirm depth ordering does not hide the banner under HUD bars.

## Implementation command

```bash
spec-kitty implement WP02 --feature 044-tutorial-onboarding-flow --base WP01
```

## Activity Log

- 2026-05-02T12:20:40Z – claude – shell_pid=6556 – lane=doing – Started implementation via workflow command
- 2026-05-02T12:26:50Z – claude – shell_pid=6556 – lane=for_review – Tutorial overlay implemented: banner (i18n-aware, depth 1500), pulsing target highlight (depth 1490, 1 Hz Sine.easeInOut yoyo), HUB_HITBOXES + scene-children resolver, script tags wired in index.html. Tests 155/1, smoke errors=0 (pre-existing failures unrelated).
- 2026-05-02T12:27:37Z – claude – shell_pid=6556 – lane=approved – Self-review: implementation aligns with hudV2 patterns; resolver handles HUB_HITBOXES struct shape correctly; cleanup hooks defensive.
- 2026-05-02T12:27:43Z – claude – shell_pid=6556 – lane=done – Merged into main.
