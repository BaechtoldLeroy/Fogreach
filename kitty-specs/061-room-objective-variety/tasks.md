# Tasks: Room Objective Variety (Raum-Modi)

**Feature**: 061-room-objective-variety
**Generated**: 2026-07-08
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Tracker**: #61

Jedes Work Package besitzt **disjunkte Dateien** (eigener Worktree) und ist eigenständig implementierbar; Detail-Prompt unter `tasks/WPxx-*.md`. Jeder Modus lebt in einer **eigenen Datei** und registriert sich selbst über `window.RoomMode.register(...)` (Muster: `espionageSystem.js` ↔ `espionageVisuals.js`).

## At-a-glance

| WP | Title | Owned files | Depends on | Parallel-safe |
|----|-------|-------------|------------|---------------|
| WP01 | Framework + Integration + ClearMode + Auswahl + Bonus-Chest | roomModes.js, roomManager.js, wave.js, main.js, index.html, tests/roomModes.test.js | none | — |
| WP02 | SurvivalMode + Timed-Spawner | roomModeSurvival.js (+test) | WP01 | mit WP03/04/05/06 |
| WP03 | DefendMode + Gegner-Targeting | roomModeDefend.js (+test), enemy.js, research.md | WP01 | mit WP02/04/05/06 |
| WP04 | HuntMode | roomModeHunt.js (+test), eliteEnemies.js | WP01 | mit WP02/03/05/06 |
| WP05 | Room-Mode-Visuals (Banner/HUD/Marker/i18n) | roomModeVisuals.js (+test) | WP01 | mit WP02/03/04/06 |
| WP06 | (optional) EscapeMode | roomModeEscape.js (+test) | WP01 | mit WP02–WP05 |

**Ship-Reihenfolge**: WP01 → WP02 → WP05 (früh spielbar + sichtbar) → WP03 → WP04 → (WP06). WP02–WP06 hängen alle nur an WP01 und sind untereinander parallel (disjunkte Dateien).

**Warum die Integration in WP01 liegt:** Auswahl (`selectForRoom`), Treppen-Entkopplung, `mode.update`-Hook, `?mode=`-Force und die Bonus-Chest-Belohnung berühren die geteilten Dateien (`roomManager`/`wave`/`main`/`index.html`). Sie in EINEM WP zu bündeln hält die Modus-WPs auf **je eine neue, konfliktfreie Datei** reduziert.

**Constitution-Gate** (verlustfrei + test-first): WP01 zieht das Bestehende hinter das Interface, OHNE Verhaltensänderung (alle Bestandstests grün). Kernlogik (Registry, `selectForRoom`, Timer/Fail) als Unit-Tests.

---

## Phase 1 — Foundation
### WP01: Framework + Integration + ClearMode + Auswahl + Bonus-Chest
Registry/Interface (`roomModes.js`), ClearMode (verlustfrei), Treppe via `mode.isComplete()`, `mode.update`-Hook (`main.js`), gewichtete `selectForRoom` (~1–2/Run; erster/Boss=`clear`; Espionage aus), Bonus-Chest (`!objectiveFailed`), `?mode=`-Force, Script-Tags. **Depends on**: none. **Requirements**: FR-01/02/03/07/08/10, NFR-01/02/03.

## Phase 2 — Modi (parallel nach WP01)
### WP02: SurvivalMode — FR-04, NFR-04
### WP03: DefendMode (+ R1 Gegner-Targeting) — FR-05
### WP04: HuntMode — FR-06

## Phase 3 — Feedback
### WP05: Room-Mode-Visuals (Banner/HUD/Marker/i18n) — FR-09, R3

## Phase 4 — Optional
### WP06: EscapeMode — FR-11
