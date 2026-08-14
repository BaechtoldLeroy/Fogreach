---
work_package_id: WP01
title: Mobile Kontext-Primärbutton umsetzen
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
planning_base_branch: main
merge_target_branch: main
branch_strategy: 'Plan/Basis: main. Merge-Ziel: main. Keine Deps -> base=main. `spec-kitty implement WP01`.'
subtasks: [T001, T002, T003, T004, T005, T006]
history:
- '2026-08-13: erstellt (/spec-kitty.tasks)'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files: [js/mobileControls.js, js/mobileAbilityButtons.js, js/doorSystem.js]
---

# WP01 — Mobile Kontext-Primärbutton umsetzen

## Ziel
Die mobilen Zellen `attack` und `interact` zu **einer** kontextsensitiven Primärzelle
zusammenlegen. Ein Poll ermittelt pro Frame `hasPeacefulTarget` und schaltet Glyph/Label um
(✋„Aktion" ↔ ⚔️„Angr"); der Tap dispatcht kontextabhängig über die **bestehenden** Pfade.
**Mobile-only** — Desktop-Steuerung/Verhalten bleibt unverändert (C-001).

## Kontext (lies zuerst)
- Spec: `spec.md`; Plan: `plan.md`; Entscheidungen: `research.md` (R1–R5); Formate:
  `contracts/has-peaceful-target.contract.md`, `contracts/primary-button.contract.md`; Abnahme:
  `quickstart.md`.
- **Verifizierte Anker im Code**:
  - `js/mobileControls.js`: `ABILITY_LAYOUT` (~Z.37) mit `{key:'attack',col:0,row:0}` und
    `{key:'interact',col:3,row:1}`; `_interact()` (~Z.257) setzt `window.__MOBILE_INTERACT_ACTIVE__`
    (180 ms) + dispatcht `demonfall:mobile-interact`.
  - `js/mobileAbilityButtons.js`: `_pollEnabledState(decorations, scene)` (~Z.204) läuft pro
    Frame; DECORATION-Map (~Z.55) mit glyph/labelKey je key; Attack-Cooldown-Overlay wird dort
    aus `window.__abilityCooldownMs__.attack` getrieben (~Z.283).
  - `js/doorSystem.js`: `INTERACT_DIST=100` (~Z.250); `updateDoors` (~Z.325) berechnet
    `nearestDoor` (< INTERACT_DIST) und toggelt `_doorPrompt`.
  - `js/scenes/HubSceneV2.js`: `_activeInteractable` (gesetzt in `_refreshInteractionPrompt`).
- **Konventionen**: Classic Script (window-Globals, IIFE), Umlaute, `?v=`-Cache-Buster der
  geänderten Dateien + `GAME_VERSION` (js/version.js) bumpen, `node tools/runTests.js` (600)
  grün, KEIN `STORY_VERSION`-Bump.

## Subtasks

### T001 — `DoorSystem.isDoorInRange(scene, player)` (leichter Getter)
**Zweck**: Ein sauberes „Tür in Reichweite"-Signal für den Dungeon, ohne die Reichweiten-Logik
zu ändern (C-003).
**Schritte**:
1. In `js/doorSystem.js` eine Funktion ergänzen, die dieselbe Prüfung wie `updateDoors` macht:
   iteriere `scene._doors`, berechne Distanz Spieler↔Tür, return `true` sobald eine Tür
   `< INTERACT_DIST` ist. Defensiv: kein `scene`/`player`/`_doors` → `false`.
2. Als Methode exportieren (z. B. `window.DoorSystem.isDoorInRange = isDoorInRange`).
**Validierung**: gibt in Türnähe `true`, sonst `false`; keine Nebenwirkung; ändert `updateDoors` nicht.

### T002 — `hasPeacefulTarget(scene)`-Helfer (window-Global)
**Zweck**: Ein Aggregat-Signal, das der Poll und der Dispatch teilen. Reine Query.
**Schritte** (Kontrakt: `contracts/has-peaceful-target.contract.md`):
1. `window.hasPeacefulTarget = function(scene){ … }` (z. B. in `mobileControls.js` oder
   `mobileAbilityButtons.js`).
2. **Hub** (HubSceneV2): `return !!scene._activeInteractable;`
3. **Dungeon** (GameScene): `true`, wenn `window.DoorSystem?.isDoorInRange(scene, player)` ODER
   ein Dungeon-NPC/Event in Reichweite ODER aufhebbares Loot in Reichweite. `player` = window.player.
4. **Immer `false`** bei nur Gegnern / nur `getData('destructible')`-Props.
5. `typeof`-Guards für fehlende Systeme; im Zweifel `false` (Angriff bleibt möglich).
**Hinweis**: Dungeon-NPC/Loot-Reichweite defensiv anbinden (vorhandene Prüfungen wiederverwenden,
nicht neu erfinden); wenn eine Quelle nicht sauber abfragbar ist, dokumentiere sie und lasse sie
vorerst weg (Tür ist das Hauptsignal im Dungeon).
**Validierung**: liefert im Hub bei NPC-Nähe `true`; im Dungeon bei Türnähe `true`; neben Gegner/
Fass `false`.

### T003 — `ABILITY_LAYOUT`: Primärzelle statt attack+interact
**Zweck**: Eine Zelle statt zwei (FR-001/008).
**Schritte** (`js/mobileControls.js`):
1. In `ABILITY_LAYOUT` `attack` und `interact` durch **eine** Zelle ersetzen, z. B.
   `{ key:'primary', col:0, row:0, color:0xff0000, abilityId:null }`.
2. Die frei werdende Position (col3,row1) **leer** lassen (keinen neuen Button; MVP).
3. Trefferfläche/Radius ≥ bisherige attack-Zelle (NFR-003).
4. Sicherstellen, dass `_interact()` und der Angriffs-Trigger weiter existieren (werden in T005
   vom Primärbutton genutzt).
**Validierung**: nur noch eine Primärzelle sichtbar; Layout ohne Loch-Artefakte; Skills/Trank/
Rolle unverändert.

### T004 — Kontext-Poll: Glyph/Label-Swap
**Zweck**: Der Primärbutton zeigt den aktuellen Kontext (FR-004/005).
**Schritte** (`js/mobileAbilityButtons.js`, in `_pollEnabledState` oder analog):
1. Für die `primary`-Dekoration pro Frame `window.hasPeacefulTarget(scene)` auswerten.
2. peaceful → Glyph ✋ + Label „Aktion"; sonst → Glyph ⚔️ + Label „Angr". Nur bei Änderung
   `setText`/Glyph tauschen (kein Flackern).
3. Reaktiv ≤100 ms (Poll läuft ohnehin je Frame → erfüllt, NFR-001).
**Validierung**: Glyph/Label wechseln beim Betreten/Verlassen der Reichweite ohne manuellen Refresh.

### T005 — Tap-Dispatch-Weiche
**Zweck**: Ein Tap löst kontextrichtig genau EINE Handlung aus (FR-002/003).
**Schritte**:
1. Im Tap-Handler des Primärbuttons: wenn `window.hasPeacefulTarget(scene)` → `_interact()`
   (bestehender Pfad: `__MOBILE_INTERACT_ACTIVE__` + `demonfall:mobile-interact`); sonst den
   bestehenden mobilen Angriffs-Pfad auslösen (wie bisher die attack-Zelle).
2. Genau EIN Pfad pro Tap (nie beides). Entscheidung nach dem zum Tap-Zeitpunkt gültigen Kontext.
**Validierung**: Tür/NPC/Loot → Interaktion; sonst Angriff; kein Doppel-Effekt; neben Fass → Angriff.

### T006 — Erhalt (Cooldown/Padding) + Verifikation + Release
**Zweck**: Keine Regression, sauberes Deploy (FR-007).
**Schritte**:
1. Angriffs-Cooldown-Overlay (Sekunden, gameNow, b59) am Primärbutton NUR im Angriffs-Kontext
   zeigen; Icon-Padding (b59) erhalten.
2. `node tools/runTests.js` → 600 grün.
3. `?v=`-Cache-Buster in `index.html` für geänderte Dateien (mobileControls/mobileAbilityButtons/
   doorSystem) bumpen; `GAME_VERSION` (js/version.js) + dessen `?v=` bumpen. KEIN `STORY_VERSION`.
4. `quickstart.md` durchgehen (Gerät/Emulator): Kampf/Tür/Loot/NPC/Prop/Übergang/Cooldown/Desktop.
**Validierung**: Tests grün; Versionen gebumpt; Desktop-Regressionscheck ok.

## Definition of Done
- Eine Primärzelle ersetzt attack+interact; kontextrichtiger Dispatch (peaceful→Aktion, sonst
  Angriff), zerstörbare Props/Gegner → Angriff; Glyph/Label reaktiv; Cooldown/Padding erhalten.
- Nur `js/mobileControls.js`, `js/mobileAbilityButtons.js`, `js/doorSystem.js` (+ index.html/version.js
  Bumps) geändert. Desktop unverändert. 600 Tests grün. Versionen gebumpt.

## Reviewer-Guidance
Feuert ein Tap je Kontext genau EINEN Pfad? Bleibt der Angriff neben Fass/Kiste/Altar erhalten?
Ist der Cooldown (b59-gameNow) intakt? Wurde Desktop nicht angefasst? `hasPeacefulTarget` reine
Query mit Guards?

## Branch Strategy
Plan/Basis-Branch: `main`. Merge-Ziel: `main`. Keine Dependencies → `spec-kitty implement WP01`.
