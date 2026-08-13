# Implementation Plan: Mobile Kontext-Primärbutton (065)

**Branch**: `main` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)
**Mission**: software-dev · **Scope**: Mobile-only (Touch), Desktop unverändert.

## Summary
Die zwei mobilen Zellen `attack` und `interact` zu **einer** kontextsensitiven Primärzelle
zusammenlegen. Ein pro-Frame-Poll ermittelt `hasPeacefulTarget` (NPC/Tür/Loot in Reichweite,
NICHT Gegner/zerstörbare Props) und schaltet Glyph/Label um (⚔️ „Angr" ↔ ✋ „Aktion"); der
Tap-Handler dispatcht kontextabhängig Angriff bzw. Interaktion über die **bestehenden** Pfade.

## Technical Context
- **Sprache/Umgebung**: Classic-Script JS, Phaser 3.70 (window-Globals, IIFE). Kein Build.
- **Betroffene Dateien**: `js/mobileControls.js` (`ABILITY_LAYOUT`, `_interact`,
  `__MOBILE_INTERACT_ACTIVE__`), `js/mobileAbilityButtons.js` (Dekoration/Glyph/Label +
  `_pollEnabledState`). Optional ein kleiner Helfer (window-Global) für `hasPeacefulTarget`.
- **Bestätigte Signal-Quellen** (nur konsumiert, nicht geändert — C-003):
  - Hub: `HubSceneV2._activeInteractable` (gesetzt in `_refreshInteractionPrompt`, ~Z.1072/1110).
  - Dungeon Tür: `DoorSystem` — nächste Tür < `INTERACT_DIST` (=100); Proxy `scene._doorPrompt.visible`
    (updateDoors zeigt/versteckt den [E]-Prompt entsprechend). Sauberer: kleiner DoorSystem-Getter.
  - Dungeon NPC/Event (z. B. Elara) + Loot: über bestehende Reichweiten; im Dungeon ggf. kein
    `_activeInteractable` — in Phase 0 (research) geklärt, Aggregation im Helfer.
  - Mobile-Interakt-Auslösung existiert: `mobileControls._interact()` setzt
    `__MOBILE_INTERACT_ACTIVE__` (180 ms) + dispatcht `demonfall:mobile-interact`; main.js
    (~Z.1930) triggert daraus `DoorSystem.tryInteractDoor`, Hub öffnet Dialog für `_activeInteractable`.
- **Ausgeschlossen von „peaceful"**: Gegner; zerstörbare Props (`destructible`-Flag:
  barrel/crate/statue/pillar/altar/…) → bleiben Angriff (FR-006).
- **Perf**: Kontext-Check leichtgewichtig, läuft im bestehenden `_pollEnabledState` mit (NFR-002).
- **Erhalten**: Cooldown-/Sekunden-Anzeige des Angriffs am Primärbutton (b19/b22/b59),
  Icon-Padding/Label-Fixes (b59).

## Constitution Check
Kein durchsetzbares Constitution-File (Governance `unresolved`, nicht blockierend). **Gate
übersprungen**. Projektkonventionen eingehalten: Umlaute, `?v=`-Cache-Buster + `GAME_VERSION`
bumpen, 600 Tests grün, keine `STORY_VERSION`-Änderung.

## Project Structure
### Documentation (this feature)
```
kitty-specs/065-mobile-context-primary-button/
├── plan.md · research.md · data-model.md · quickstart.md
└── contracts/  (has-peaceful-target.contract.md, primary-button.contract.md)
```
### Source Code (repository root)
```
js/mobileControls.js        # ABILITY_LAYOUT: attack+interact -> eine Primärzelle; Dispatch-Weiche
js/mobileAbilityButtons.js  # Kontext-Poll: Glyph/Label-Swap; Tap-Dispatch nach Kontext
# optional: window-Helfer hasPeacefulTarget(scene) (in einer der beiden Dateien)
```
**Structure Decision**: Mobile-only; genau 2 Dateien (+ optional 1 Helfer). Kein Worktree-
Konflikt mit anderen Features. Desktop-Pfade (Tastatur) unangetastet (C-001).

## Complexity Tracking
Keine Constitution-Verletzungen — entfällt.
