---
work_package_id: WP02
title: View - Phasen-Darstellung
dependencies: [WP01]
requirement_refs:
- FR-003
- FR-005
- FR-010
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: bc9377dc9d50ec83871a960c89c3407f9e0e1e64
created_at: '2026-07-20T16:26:27.523810+00:00'
subtasks: [T005, T006, T007, T008]
authoritative_surface: js/hubPhaseView.js
execution_mode: code_change
lane: planned
owned_files: [js/hubPhaseView.js]
shell_pid: "37908"
agent: "claude"
---

# WP02 — View: Phasen-Darstellung (`hubPhaseView.js`)

## Objective
Ein Rendering-Modul `js/hubPhaseView.js`, das eine Phase auf die bestehende Hub-Szene anwendet (Tint/Entsättigung, Nebel-Overlay, Anschlagtafeln-Zustand, feindliches Rathaus) — code-gezeichnet, mit Asset-Austauschpunkt. Kapselt das gesamte Rendering hinter `apply(scene, phase, refs)`, gemäß [hub-phase-view-contract](../contracts/hub-phase-view-contract.md). Baut gegen den Phasen-Kontrakt (WP01), parallel zu dessen Implementierung.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP02 --base WP01`.

## Kontext & Quellen
- **Verbindliche Kontrakte:** [hub-phase-view-contract](../contracts/hub-phase-view-contract.md) (API + Verhalten je Phase) und [hub-phase-contract](../contracts/hub-phase-contract.md) (PHASE_STYLE-Felder, die die View liest).
- **Wirt (nur lesen, NICHT editieren — gehört WP03):** `js/scenes/HubSceneV2.js` — Hub-Hintergrund `const bg = this.add.image(0,0,'hubscene_bg')` (~Z.166); Dialog-Depth 1500 (Overlays darunter).
- scrollFactor-Falle: [[project_phaser_scrollfactor_dialogs]]. Szenenübergreifende Zeit: `Date.now()`.

## Projekt-Konventionen
- Classic Script IIFE, `window.HubPhaseView = { apply }`. ASCII in IDs; Umlaute im Text.
- Alle erzeugten GameObjects `scrollFactor(0)` (rekursiv bei Containern).

---

## Subtasks

### T005 — Skeleton + apply-Struktur + Idempotenz
**Schritte:**
1. `js/hubPhaseView.js`: IIFE, `window.HubPhaseView = { apply }`.
2. `apply(scene, phase, refs)`: defensiv (fehlt `window.HubPhase`/`refs`/`refs.bg` → return no-op-Handle). Style lesen: `var s = window.HubPhase.PHASE_STYLE[phase] || window.HubPhase.PHASE_STYLE.council;`.
3. Container/Objekte für diese Anwendung sammeln; Rückgabe `{ destroy }` räumt sie ab. Idempotenz: vor Neu-Anwendung die vorherigen Overlays der View entfernen (die Integration hält das Handle und ruft destroy, ODER apply räumt intern via `scene`-scoped Marker auf).
**Validierung:** `node --check`; `apply` ohne HubPhase wirft nicht.

### T006 — Tint/Entsättigung + Nebel-Overlay
**Schritte:**
1. `refs.bg.setTint(s.tint)` (bei council `refs.bg.clearTint()`), zusätzlich eine getönte, halbtransparente Rechteck-Overlay proportional zu `s.desaturate` (kühl/grau) als einfache Entsättigungs-Näherung.
2. Nebel-Overlay: bildschirmfüllendes Graphics/Rect mit Alpha `s.fog` (heller im Epilog, kühl in doubleAgent/broken), Depth `refs.overlayDepth` (unter 1500).
3. Rekursiv `scrollFactor(0)`.
**Validierung:** Boot-Check (WP03): sichtbarer Tint/Nebel je Phase; council neutral.

### T007 — Anschlagtafeln + feindliches Rathaus
**Schritte:**
1. `s.posters` (faded/torn/gone): ein abdunkelndes/zerrissenes Overlay bzw. Ausblenden im Bereich der Tafeln (code-gezeichnet — die Tafeln sind Teil des Hintergrundbilds; Position als Konstante/Heuristik im Modul, kein Layout-Umbau). council: nichts.
2. `s.rathausHostile` (true in broken): Markierung über `refs.rathausRect` (roter Tint/Umrandung/Icon), `scrollFactor(0)`.
**Validierung:** broken zeigt feindliches Rathaus + zerrissene Tafeln; council unverändert.

### T008 — Asset-Austauschpunkt + Guards
**Schritte:**
1. Wenn `s.assetKey` gesetzt UND `scene.textures.exists(s.assetKey)` → diese Textur als Phasen-Overlay/Hintergrund verwenden (Bild statt/über den code-gezeichneten Effekten), sonst die code-gezeichnete Darstellung (Pflicht-Fallback, C-006).
2. In beiden Fällen fehlerfrei; kein Layout-Umbau; keine Veränderung von NPCs/Eingängen (das macht WP03).
**Validierung:** ohne hinterlegtes Asset rendert der Fallback; mit (Test-)Textur würde sie genutzt — beide booten fehlerfrei.

---

## Definition of Done
- `js/hubPhaseView.js` erfüllt den [hub-phase-view-contract](../contracts/hub-phase-view-contract.md); idempotent; rekursives scrollFactor.
- `node --check` ok; `node tools/runTests.js` bleibt grün (die View ist DOM-gebunden → Boot-Check in WP03).

## Risiken & Reviewer-Hinweise
- **scrollFactor-Falle:** rekursiv, nicht nur auf dem Container.
- **Idempotenz:** kein Aufstapeln von Overlays bei erneutem apply (Reviewer prüft Teardown).
- **Kein Layout-Umbau:** die View verschiebt nichts, ändert keine Geometrie.
- WP02 editiert NICHT `HubSceneV2.js`/`hubLayout.js` (fremde owned_files).

## Activity Log
- (leer bis implement)
- 2026-07-20T16:26:28Z – claude – shell_pid=37908 – lane=doing – Started implementation via workflow command
- 2026-07-20T16:28:06Z – claude – shell_pid=37908 – lane=for_review – apply idempotent + defensiv, Tint/Nebel/Tafeln/rathausHostile, Asset-Austauschpunkt mit Fallback, rekursives scrollFactor.
- 2026-07-20T16:28:10Z – claude – shell_pid=37908 – lane=approved – Selbst-Review.
- 2026-07-20T16:28:13Z – claude – shell_pid=37908 – lane=done – Moved to done
