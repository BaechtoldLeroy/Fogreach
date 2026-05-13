---
work_package_id: WP04
title: HubSceneV2 Modal UI
dependencies:
- WP01
requirement_refs:
- FR-04
- FR-05
- FR-09
- FR-10
- FR-12
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning on main; implement on top of WP01 via `spec-kitty implement WP04 --base WP01`; merge back to main.
subtasks:
- T017
- T018
- T019
- T020
- T021
- T022
- T023
phase: Phase 2 — Parallelizable Work
assignee: ''
agent: ''
shell_pid: ''
history:
- timestamp: '2026-05-13T19:28:10Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/HubSceneV2.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP04 — HubSceneV2 Modal UI

## Objective

Replace the existing `_showSkillTreeUI` modal in `js/scenes/HubSceneV2.js` with a new `_showKnowledgeTreeUI` modal that renders the 10 nodes, fragment count, invest buttons, respec confirmation, and close. The K-key and Mara dialog button both invoke the new modal instead of the old skill tree.

After this WP, the player walks to Mara, presses `K` (or clicks the dialog button), and sees the Knowledge Tree. Without this WP, the tree is reachable only from DevTools.

## Context

- **Spec**: `kitty-specs/047-knowledge-tree-mvp/spec.md` § FR-04, FR-05, FR-09, FR-12, SC-04, SC-06, NFR-03
- **Plan**: `kitty-specs/047-knowledge-tree-mvp/plan.md` § "Source Code"
- **Research**: `kitty-specs/047-knowledge-tree-mvp/research.md` § R-01 (entry: Mara, REPLACES skill dialog), R-02 (UI: modal Container)
- **Pattern source**: `js/scenes/HubSceneV2.js:1829` `_showSkillTreeUI` is the **direct predecessor** — same modal shape (overlay rectangle + container + header + body + footer). Use it as a template; replace its body.
- **Existing references to update**:
  - `js/scenes/HubSceneV2.js:1078-1099` — Mara dialog "Skills lernen (K)" button setup
  - `js/scenes/HubSceneV2.js:1190-1196` — K-key handler
  - `js/scenes/HubSceneV2.js:1829` — `_showSkillTreeUI` method body
  - `js/scenes/HubSceneV2.js:2090, 2142` — other call sites to `_showSkillTreeUI` (verify what context they're in; likely tutorial hint flow)

- **Out-of-scope file**: `js/scenes/HubScene.js` (the legacy hub) still references `_showSkillTreeUI` at lines 1043/1096/1130/1391. **Do NOT modify HubScene.js in this WP** — that scene appears unused by current build path. Verify by grep + brief read; leave it alone if so, document in a comment if not.

## Branch strategy

Planning on `main`. Implement in worktree created by `spec-kitty implement WP04 --base WP01`. The `--base WP01` ensures `js/knowledgeTree.js` exists in the worktree so the UI can call `window.KnowledgeTree.*`. Merge back to `main`.

## Auto-memory: 60 fps + clean close

Per NFR-03 the modal must run at 60 fps. The 10 cards are static Phaser objects (no per-frame logic), so this is automatic — but verify by leaving the modal open for 10 seconds and watching the FPS counter (DevTools Performance tab or a print of `scene.game.loop.actualFps`).

Per FR-12 there must be no input-lock leaks. The `this._dialogOpen` flag in HubSceneV2 is the existing gate that prevents stacked dialogs; the new modal must set + clear it in lockstep.

---

## Subtask T017: Replace `_showSkillTreeUI` body with `_showKnowledgeTreeUI` shell

**Purpose**: Lay down the modal shell (overlay, container, header, body, footer) — identical pattern to the existing skill-tree modal — without the per-card content yet.

**Steps**:

1. Open `js/scenes/HubSceneV2.js` around line 1829.

2. Rename the method `_showSkillTreeUI` → `_showKnowledgeTreeUI`. **Keep the old name as a thin alias for one commit** so call sites are updated incrementally; remove the alias at end of WP04:
   ```js
   _showSkillTreeUI() { return this._showKnowledgeTreeUI(); }  // legacy alias, remove at end of WP04
   _showKnowledgeTreeUI() {
     // new body
   }
   ```

3. Replace the body. Start with the shell (overlay, panel bg, header, footer placeholder):
   ```js
   _showKnowledgeTreeUI() {
     if (!window.KnowledgeTree) {
       // Module not loaded — fail gracefully, do not crash the hub.
       console.warn('[HubSceneV2] KnowledgeTree module not available');
       return;
     }

     this._dialogOpen = true;
     if (this._dialogContainer) {
       this._dialogContainer.destroy(true);
       this._dialogContainer = null;
     }

     const cam = this.cameras.main;
     const cw = cam.width;
     const ch = cam.height;

     const overlay = this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
       .setDepth(2000)
       .setScrollFactor(0);

     const panelW = Math.min(920, cw - 10);
     const panelH = Math.min(460, ch - 10);
     const container = this.add.container(cw / 2, ch / 2).setDepth(2001).setScrollFactor(0);
     this._dialogContainer = container;
     container.add(overlay);  // pin overlay to container lifecycle

     // Panel bg
     const bg = this.add.graphics();
     bg.fillStyle(0x0c0c14, 0.97);
     bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
     bg.lineStyle(2, 0xd4a543, 0.7);
     bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
     container.add(bg);

     // Header bar
     const headerH = 32;
     const headerBg = this.add.graphics();
     headerBg.fillStyle(0x1a1a28, 0.9);
     headerBg.fillRect(-panelW / 2 + 2, -panelH / 2 + 2, panelW - 4, headerH);
     container.add(headerBg);

     const titleText = this.add.text(
       -panelW / 2 + 14, -panelH / 2 + 8,
       _HUB_T('knowledge.title'),
       { fontFamily: 'serif', fontSize: 18, color: '#ffd166', fontStyle: 'bold', resolution: 2 }
     );
     container.add(titleText);

     // Fragment counter (top-right of header)
     const state0 = window.KnowledgeTree.getState();
     const fragText = this.add.text(
       panelW / 2 - 14, -panelH / 2 + 8,
       _HUB_T('knowledge.fragments', { count: state0.fragments }),
       { fontFamily: 'serif', fontSize: 16, color: '#dde0e6', resolution: 2 }
     ).setOrigin(1, 0);
     container.add(fragText);
     this._ktFragText = fragText; // T019 will refresh on state change

     // Body container — holds the 10 cards
     this._ktCardLayer = this.add.container(0, 0);
     container.add(this._ktCardLayer);

     // Footer container — Respec + Close (filled in T020/T022)
     this._ktFooterLayer = this.add.container(0, 0);
     container.add(this._ktFooterLayer);

     // Defer card rendering and footer to T018/T020
     this._ktRenderCards(); // implemented in T018
     this._ktRenderFooter(); // implemented in T020 (and T022 for close)
     // Subscriber wired in T019
   }
   ```

4. Save and reload the game. Open Mara → press K — modal frame, header, title, fragment count should appear; cards + footer are placeholders.

**Files**:
- `js/scenes/HubSceneV2.js` (~70 LOC modified)

**Validation**:
- Modal opens on K-press at Mara; header shows "Wissensbaum" (DE) / "Knowledge Tree" (EN); fragment count shows current value.
- No console errors.

**Risks**:
- The `_HUB_T` helper is the existing i18n shorthand in HubSceneV2 — verify it returns the parametrized string for `knowledge.fragments`. If not, fall back to `window.i18n.t('knowledge.fragments', { count: 0 })`.
- Keep the visual chrome consistent with the predecessor — the user picked Mara modal pattern for familiarity.

---

## Subtask T018: Render the 10 node-cards (2×5 grid)

**Purpose**: For each catalog entry, draw a card with label, description (incl. per-rank effect), current rank, and an Invest `+` button. Cards arranged in 2 columns × 5 rows inside the body area.

**Steps**:

1. Add a method `_ktRenderCards()` to `HubSceneV2`:
   ```js
   _ktRenderCards() {
     // Clear existing
     if (!this._ktCardLayer) return;
     this._ktCardLayer.removeAll(true);

     const catalog = window.KnowledgeTree.getCatalog();
     const state = window.KnowledgeTree.getState();
     const fragments = state.fragments;

     const panelW = 920;
     const panelH = 460;
     const headerH = 32;
     const footerH = 64;
     const bodyW = panelW - 32;
     const bodyH = panelH - headerH - footerH - 24;
     const bodyTop = -panelH / 2 + headerH + 12;

     const cols = 2;
     const rows = Math.ceil(catalog.length / cols);
     const cardGap = 10;
     const cardW = (bodyW - cardGap * (cols - 1)) / cols;
     const cardH = (bodyH - cardGap * (rows - 1)) / rows;

     for (let i = 0; i < catalog.length; i++) {
       const node = catalog[i];
       const col = i % cols;
       const row = Math.floor(i / cols);
       const cardX = -bodyW / 2 + col * (cardW + cardGap) + cardW / 2;
       const cardY = bodyTop + row * (cardH + cardGap) + cardH / 2;

       const cardContainer = this.add.container(cardX, cardY);
       this._ktCardLayer.add(cardContainer);

       // Card bg
       const cardBg = this.add.graphics();
       cardBg.fillStyle(0x1a1a28, 0.95);
       cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
       cardBg.lineStyle(1, 0x3a3a4a, 0.8);
       cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
       cardContainer.add(cardBg);

       // Label
       const label = this.add.text(
         -cardW / 2 + 10, -cardH / 2 + 6,
         _HUB_T(node.labelKey),
         { fontFamily: 'serif', fontSize: 15, color: '#ffd166', fontStyle: 'bold', resolution: 2 }
       );
       cardContainer.add(label);

       // Description (uses i18n key — i18n returns plain text per rank effect)
       const desc = this.add.text(
         -cardW / 2 + 10, -cardH / 2 + 26,
         _HUB_T(node.descKey),
         { fontFamily: 'serif', fontSize: 12, color: '#dde0e6', resolution: 2, wordWrap: { width: cardW - 20 } }
       );
       cardContainer.add(desc);

       // Rank text
       const rank = state.ranks[node.id] || 0;
       const rankText = this.add.text(
         -cardW / 2 + 10, cardH / 2 - 28,
         _HUB_T('knowledge.rank', { rank: rank, max: node.maxRank }),
         { fontFamily: 'serif', fontSize: 12, color: '#a0a4ad', resolution: 2 }
       );
       cardContainer.add(rankText);

       // Invest button
       const canInvest = (fragments >= 1) && (rank < node.maxRank);
       const btnColor = canInvest ? '#4caf50' : '#444';
       const btnBg = canInvest ? '#1f3a1f' : '#2a2a2a';
       const investBtn = this.add.text(
         cardW / 2 - 10, cardH / 2 - 28,
         '+',
         { fontFamily: 'monospace', fontSize: 18, fontStyle: 'bold', color: btnColor, backgroundColor: btnBg, padding: { x: 8, y: 2 } }
       ).setOrigin(1, 0);
       investBtn.setInteractive({ useHandCursor: canInvest });
       cardContainer.add(investBtn);

       // T019 wires the click handler
       investBtn.on('pointerdown', (pointer, x, y, event) => {
         if (event && event.stopPropagation) event.stopPropagation();
         if (canInvest) {
           window.KnowledgeTree.invest(node.id);
           // _ktRenderCards re-runs from the onChange callback (T019)
         }
       });
     }
   }
   ```

2. Verify by opening the modal: 10 cards in a 2-column grid, each shows label, description, rank "0/5" (or 0/3), and a "+" button.

**Files**:
- `js/scenes/HubSceneV2.js` (~80 LOC added)

**Validation**:
- All 10 cards visible; layout is 2×5 (5 rows).
- Click `+` on a card with 0 fragments → no state change, button stays disabled-styled.
- Click `+` after `KnowledgeTree.addFragments(3)` in DevTools → fragment count drops, rank increments — but only after WP04 T019 wires the re-render.

**Risks**:
- Text overflow: long descriptions wrap via `wordWrap`. Verify on the longest German string ("Maximaler Rang erreicht" etc.) — adjust card height if needed.
- The disabled-state styling MUST visually distinguish from enabled — grey vs green text background.

---

## Subtask T019: Wire invest clicks + `onChange` subscription for live updates

**Purpose**: After every state change, refresh the fragment counter text and re-render all cards (rank labels + button enabled-state).

**Steps**:

1. Inside `_showKnowledgeTreeUI`, after `_ktRenderCards()` is called once, subscribe to state changes:
   ```js
   // Live updates: re-render on state change
   const self = this;
   this._ktUnsub = window.KnowledgeTree.onChange(function (state) {
     if (self._ktFragText && !self._ktFragText.destroyed) {
       self._ktFragText.setText(_HUB_T('knowledge.fragments', { count: state.fragments }));
     }
     self._ktRenderCards();
   });
   ```

2. The invest click handler in T018 already calls `window.KnowledgeTree.invest(node.id)`. That triggers `_notifySubscribers` inside the module, which calls back the lambda above, which re-renders.

3. Verify the cycle:
   - Open modal at 3 fragments.
   - Click `+` on `node_damage`.
   - Fragment count text updates from "Fragmente: 3" → "Fragmente: 2".
   - The damage card's rank text updates from "Rang 0/5" → "Rang 1/5".
   - The HUD damage value changes (via the WP03 stat-pipeline integration).

**Files**:
- `js/scenes/HubSceneV2.js` (~15 LOC added)

**Validation**:
- Click `+` → text refreshes within one frame.
- Click `+` 5 times on `node_damage` (maxRank 5) → 6th click has the button greyed out.
- The unsubscribe function `this._ktUnsub` is stored on the scene for T022 to call on close.

**Risks**:
- Re-render is O(10 cards) per click — well within frame budget. No worry.
- The `_ktFragText.destroyed` check is defensive against a click landing after the modal closes; harmless to include.
- Don't subscribe twice. The unsub from a previous open must fire before re-opening (T022 handles this).

---

## Subtask T020: Footer — Respec button + confirmation dialog

**Purpose**: Add the Respec button in the footer. Clicking it opens a yes/no confirmation. On confirm, `KnowledgeTree.respec()`.

**Steps**:

1. Add `_ktRenderFooter()`:
   ```js
   _ktRenderFooter() {
     if (!this._ktFooterLayer) return;
     this._ktFooterLayer.removeAll(true);

     const panelW = 920;
     const panelH = 460;
     const footerY = panelH / 2 - 28;

     // Respec button (left)
     const respecBtn = this.add.text(
       -panelW / 2 + 14, footerY,
       _HUB_T('knowledge.btn.respec'),
       { fontFamily: 'serif', fontSize: 14, color: '#fff', backgroundColor: '#7a3a3a', padding: { x: 10, y: 5 } }
     );
     respecBtn.setInteractive({ useHandCursor: true });
     this._ktFooterLayer.add(respecBtn);

     respecBtn.on('pointerdown', (pointer, x, y, event) => {
       if (event && event.stopPropagation) event.stopPropagation();
       this._ktShowRespecConfirm();
     });

     // Close button (right) — implemented further in T022
     const closeBtn = this.add.text(
       panelW / 2 - 14, footerY,
       _HUB_T('knowledge.btn.close'),
       { fontFamily: 'serif', fontSize: 14, color: '#fff', backgroundColor: '#3a3a4a', padding: { x: 10, y: 5 } }
     ).setOrigin(1, 0);
     closeBtn.setInteractive({ useHandCursor: true });
     this._ktFooterLayer.add(closeBtn);

     closeBtn.on('pointerdown', (pointer, x, y, event) => {
       if (event && event.stopPropagation) event.stopPropagation();
       this._ktCloseModal();
     });
   }

   _ktShowRespecConfirm() {
     // Reuse the existing confirmation dialog pattern from HubSceneV2.
     // The simplest version is a sub-modal with two text buttons.
     const cam = this.cameras.main;
     const dlg = this.add.container(cam.width / 2, cam.height / 2).setDepth(2010);
     this._ktConfirmDlg = dlg;

     const bg = this.add.graphics();
     bg.fillStyle(0x000000, 0.7);
     bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
     dlg.add(bg);

     const panel = this.add.graphics();
     panel.fillStyle(0x1a1a28, 0.98);
     panel.fillRoundedRect(-200, -80, 400, 160, 10);
     panel.lineStyle(2, 0xd4a543, 0.7);
     panel.strokeRoundedRect(-200, -80, 400, 160, 10);
     dlg.add(panel);

     const msg = this.add.text(0, -30, _HUB_T('knowledge.respec.confirm'), {
       fontFamily: 'serif', fontSize: 15, color: '#fff', resolution: 2, align: 'center', wordWrap: { width: 380 }
     }).setOrigin(0.5);
     dlg.add(msg);

     const yes = this.add.text(-60, 30, _HUB_T('hub.skills.respec_yes') || 'Ja', {
       fontFamily: 'serif', fontSize: 14, color: '#fff', backgroundColor: '#7a3a3a', padding: { x: 14, y: 5 }
     }).setOrigin(0.5).setInteractive({ useHandCursor: true });
     yes.on('pointerdown', () => {
       window.KnowledgeTree.respec();
       this._ktCloseConfirm();
     });
     dlg.add(yes);

     const no = this.add.text(60, 30, _HUB_T('hub.skills.respec_no') || 'Nein', {
       fontFamily: 'serif', fontSize: 14, color: '#fff', backgroundColor: '#3a3a4a', padding: { x: 14, y: 5 }
     }).setOrigin(0.5).setInteractive({ useHandCursor: true });
     no.on('pointerdown', () => this._ktCloseConfirm());
     dlg.add(no);
   }

   _ktCloseConfirm() {
     if (this._ktConfirmDlg) {
       this._ktConfirmDlg.destroy(true);
       this._ktConfirmDlg = null;
     }
   }
   ```

2. Note: re-use `hub.skills.respec_yes`/`hub.skills.respec_no` i18n keys if they exist; otherwise register `knowledge.respec.yes` / `knowledge.respec.no` in WP01 T001 — coordinate with that task before implementing.

**Files**:
- `js/scenes/HubSceneV2.js` (~75 LOC added)

**Validation**:
- Click Respec → confirmation appears.
- Click Yes → all ranks reset to 0, fragments refund correctly (verified via onChange callback re-rendering the cards).
- Click No → confirmation closes, no state change.
- Confirmation dialog is at depth 2010 (above modal 2001) — visible on top.

**Risks**:
- Stacked input — the confirmation dialog needs to absorb clicks. The bg `Graphics` covering the whole camera does this implicitly because nothing inside it has been made `setInteractive` for the background. Verify that clicking the bg outside the panel does NOT close the confirmation (it should require an explicit Yes/No).

---

## Subtask T021: Re-route K-key + Mara dialog button (re-key `hub.skills.learn` → `hub.knowledge.learn`)

**Purpose**: Update the existing K-key handler and the Mara dialog button to invoke `_showKnowledgeTreeUI` instead of `_showSkillTreeUI`. Update the button label.

**Steps**:

1. Locate the Mara dialog button setup around line 1078-1099. The relevant block:
   ```js
   if (isMaraFlavor) {
     const maraBtnY = bodyText.y + bodyHeight + 16;
     const skillsBtn = this.add.text(0, maraBtnY, _HUB_T('hub.skills.learn'), { ... })
       .setOrigin(0.5).setInteractive({ useHandCursor: true });
     skillsBtn.on('pointerdown', (pointer, x, y, event) => {
       // ...
       if (typeof this._showSkillTreeUI === 'function') {
         this._showSkillTreeUI();
       }
     });
     // ...
   }
   ```

2. Change the i18n key from `hub.skills.learn` to `hub.knowledge.learn`. Register the new key in `i18n` — but since the existing key still has the (K) hint, the simplest path is:
   - **Option A**: Rename the i18n key globally. Add `hub.knowledge.learn` strings ("Wissen lernen (K)" / "Knowledge Tree (K)") in the existing HubSceneV2 i18n block (top of the file around lines 30-77). Delete the old key.
   - **Option B**: Reuse the old `hub.skills.learn` key but change its German+English values to "Wissen lernen (K)" / "Knowledge Tree (K)". Simpler — fewer touchpoints — but less semantically clean.

   **Decision**: Use Option A (rename) for clarity. Document in the commit message that `hub.skills.learn` was renamed because the button now opens a different tree.

3. Replace the click handler:
   ```js
   skillsBtn.on('pointerdown', (pointer, x, y, event) => {
     // ... existing event-bubble handling
     if (typeof this._showKnowledgeTreeUI === 'function') {
       this._showKnowledgeTreeUI();
     }
   });
   ```

4. Locate the K-key handler around line 1190-1196:
   ```js
   const skillHandler = () => {
     // ...
     if (typeof this._showSkillTreeUI === 'function') {
       this._showSkillTreeUI();
     }
   };
   this.input.keyboard.on('keydown-K', skillHandler);
   ```

   Change to call `_showKnowledgeTreeUI`. Keep the variable name `skillHandler` if rename feels invasive — or rename to `knowledgeHandler`. Doesn't matter functionally.

5. There are additional call sites at lines 2090, 2142. Check the surrounding context — likely tutorial hint flow or auto-open trigger. Update each to call `_showKnowledgeTreeUI`.

6. Remove the legacy alias `_showSkillTreeUI` from T017 once all call sites within HubSceneV2.js are updated.

**Files**:
- `js/scenes/HubSceneV2.js` (~10 LOC modified, key renames)

**Validation**:
- Mara dialog shows "Wissen lernen (K)" (DE) / "Knowledge Tree (K)" (EN).
- Click on the button → Knowledge Tree modal opens.
- Press K with Mara dialog open → modal opens.
- Press K with Mara dialog closed → does NOT open modal (the keyhandler is registered only inside the Mara-flavor dialog branch — verify).
- The old `_showSkillTreeUI` no longer appears in `HubSceneV2.js`.

**Risks**:
- The K-key handler may be cleaned up when the dialog closes (`keyClosers.push(...)` at line 1196). Make sure the rename preserves the cleanup path.
- If `js/scenes/HubScene.js` (legacy) is somehow still wired into the build, its call sites would break — but per the WP intro, this WP does not touch HubScene.js. The legacy scene's `_showSkillTreeUI` remains independent.

---

## Subtask T022: Cleanup on close — ESC + Close button, unsubscribe, no input-lock leaks

**Purpose**: Both ESC and the Close button must destroy the modal cleanly, unsubscribe the `onChange` listener, and clear `this._dialogOpen` so a second open works.

**Steps**:

1. Add the close method:
   ```js
   _ktCloseModal() {
     if (this._ktUnsub) {
       try { this._ktUnsub(); } catch (e) { /* swallow */ }
       this._ktUnsub = null;
     }
     if (this._ktConfirmDlg) {
       this._ktConfirmDlg.destroy(true);
       this._ktConfirmDlg = null;
     }
     if (this._dialogContainer) {
       this._dialogContainer.destroy(true);
       this._dialogContainer = null;
     }
     this._ktFragText = null;
     this._ktCardLayer = null;
     this._ktFooterLayer = null;
     this._dialogOpen = false;
   }
   ```

2. Wire ESC. In `_showKnowledgeTreeUI`, after creating the container, register the ESC handler:
   ```js
   const escHandler = () => this._ktCloseModal();
   this.input.keyboard.on('keydown-ESC', escHandler);
   // Ensure cleanup of the handler when modal closes:
   const origClose = this._ktCloseModal.bind(this);
   this._ktCloseModal = () => {
     this.input.keyboard.off('keydown-ESC', escHandler);
     origClose();
   };
   ```

   **Simpler alternative** — keep the close method clean and store the handler reference on the scene:
   ```js
   this._ktEscHandler = () => this._ktCloseModal();
   this.input.keyboard.on('keydown-ESC', this._ktEscHandler);
   ```
   Then inside `_ktCloseModal`:
   ```js
   if (this._ktEscHandler) {
     this.input.keyboard.off('keydown-ESC', this._ktEscHandler);
     this._ktEscHandler = null;
   }
   ```

   Use the simpler version. The handler-rebind trick is too clever.

3. The Close button click handler from T020 already calls `_ktCloseModal()`. Verify it's wired.

4. Test the full lifecycle:
   - Open modal → see cards.
   - Press ESC → modal closes cleanly.
   - Open modal again → cards re-render correctly (no duplicate subscribers, no leaked text nodes).
   - Open modal → click Close → same result as ESC.
   - Open modal → click Respec → Yes → cards re-render → click Close → closes cleanly.

**Files**:
- `js/scenes/HubSceneV2.js` (~30 LOC added)

**Validation**:
- After closing, `window.KnowledgeTree.addFragments(1)` in DevTools does NOT crash (no orphan subscriber).
- Opening + closing the modal 10 times leaves the scene in a normal state (memory inspector shows no growing leak; `this._dialogContainer` is null between opens).
- No input lock — player can still move with WASD after closing.

**Risks**:
- Forgetting to clear `_dialogOpen` causes the dialog system to think a dialog is still open. Verify by attempting to interact with another NPC immediately after closing.
- Multiple ESC handlers if the modal is somehow opened twice — the unsub-and-rebind pattern above prevents this.

---

## Subtask T023: Manual playtest — full earn → invest → respec cycle

**Purpose**: Verify the entire feature works end-to-end with zero console errors (SC-06).

**Steps**:

1. Start the game fresh: clear localStorage key `demonfall.knowledgeTree.v1` (or use a fresh browser profile). Open DevTools console.

2. Enter the dungeon. Play until a lore-fragment event spawns (the floating scroll icon). Walk over it.
   - Verify: snippet dialog appears, XP gain, AND `KnowledgeTree.getFragments()` is now 1.

3. Repeat 2 more times. `KnowledgeTree.getFragments()` should be 3.

4. Return to hub. Walk to Mara. Press K (or click the dialog button).
   - Modal opens. Title: "Wissensbaum" / "Knowledge Tree". Fragments: "3".

5. Click `+` on "Kraft des Wissens" (node_damage).
   - Fragment counter drops to 2. Rank text shows "Rang 1/5". HUD weapon-damage value visibly increases by 5%.

6. Click `+` two more times on node_damage. Rank: 3/5. Fragments: 0.

7. Click `+` again on any node → button is disabled-styled. No state change.

8. Click "Zurücksetzen" / "Respec". Confirmation appears.

9. Click "Nein" / "No". Modal returns to normal. State unchanged.

10. Click "Zurücksetzen" again, then "Ja" / "Yes". Fragment count jumps to 3. All ranks back to 0. HUD weapon-damage reverts to baseline.

11. Press ESC. Modal closes cleanly. No console errors.

12. Re-open with K. State persisted. Fragments still 3.

13. Reload the browser. Walk back to Mara. Open modal. Fragments still 3, ranks still 0 (after the respec). Persistence works (SC-01).

14. Switch language between DE and EN mid-modal — labels and descriptions update within one frame (SC-04).

15. Confirm: zero `console.error` and zero `console.warn` related to KnowledgeTree across the whole test session.

**Files**:
- (no code changes; this is the gate before declaring WP04 done)

**Validation**:
- All 15 steps pass.
- If any step fails, fix in the appropriate prior subtask before declaring WP04 done.

---

## Definition of Done (WP04)

All of:
- [ ] `_showSkillTreeUI` body replaced with `_showKnowledgeTreeUI`
- [ ] Modal opens via K-key and via Mara dialog button (re-keyed to `hub.knowledge.learn`)
- [ ] All 10 nodes render in a 2×5 grid with labels, descriptions, ranks, and `+` buttons
- [ ] Invest buttons respect `fragments >= 1 && rank < maxRank` (disabled-styled otherwise)
- [ ] Subscribing to `KnowledgeTree.onChange` refreshes UI live
- [ ] Respec button + confirmation dialog work end-to-end
- [ ] ESC + Close button both clean up correctly (no subscriber leaks, no input locks)
- [ ] Manual playtest T023 passes all 15 steps with zero console errors
- [ ] `js/scenes/HubScene.js` (legacy) was NOT modified
- [ ] DE + EN both render correctly; language toggle works mid-modal

## Risks (rolled up)

- **Subscriber leaks**: forgetting `this._ktUnsub()` on close → next open registers a second subscriber → invest fires re-render twice. Verify by opening + closing 3 times and checking `state` snapshot in onChange callback.
- **K-key handler leak**: registering twice means a single K press fires twice. The existing `keyClosers` cleanup in HubSceneV2 handles this — verify the new handler is added to that list, or use the unsub-on-close pattern.
- **Tutorial integration**: if any tutorial step previously detected "skill tree opened" via `_showSkillTreeUI`, that hook now needs to detect `_showKnowledgeTreeUI`. Grep `tutorialSystem.js` and `tutorialState.js` for `_showSkillTreeUI` references — they may be telling the tutorial when the player interacted with the tree. If found, leave the old hook alone or migrate to the new method (low-risk; tutorial covers earlier steps mostly).
- **Layout overflow** with long German strings: test specifically with the German locale (the longer language).

## Reviewer guidance

Before approving:
1. Walk through the 15-step T023 manual playtest yourself.
2. Open + close the modal 10 times. Check for memory leaks (DevTools Memory tab — heap should be flat).
3. Verify the legacy `_showSkillTreeUI` method is gone (no aliases left).
4. Grep the project for `_showSkillTreeUI` references — only `HubScene.js` (legacy) should still mention it.
5. Confirm `_dialogOpen` is true while modal open, false after close.
6. Performance: open modal, observe `scene.game.loop.actualFps` for 5 seconds — should stay at 60.

## Next WP

WP04 is the last WP. After it merges + manual playtest passes, the feature is complete and shippable.

## Implementation command

```bash
spec-kitty implement WP04 --base WP01
```
