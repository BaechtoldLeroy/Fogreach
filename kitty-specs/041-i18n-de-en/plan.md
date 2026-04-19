# Implementation Plan: 041 — i18n Deutsch/Englisch

**Branch**: `main` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/041-i18n-de-en/spec.md`

## Branch Strategy

- Current branch at workflow start: `main`
- Planning/base branch for this feature: `main`
- Completed changes must merge into `main`

## Summary

Einführung eines schlanken i18n-Systems für DE/EN. Komplett-Migration aller ~177 hardcoded deutschen UI-Strings (Settings, HUD, Quests, Events, Loot, Loadout, Start-Screen) auf zentrale Lookup-Keys. Sprachauswahl im Settings-Menü, Persistenz via `persistence.js` (`demonfall_settings_v1.language`), Hot-Switch ohne Spielneustart durch Re-Render der lebenden Szenen.

## Technical Context

**Language/Version**: JavaScript ES6+ (klassische `<script>`-Tags, kein Build)
**Primary Dependencies**: Phaser 3, bestehender `persistence.js`-Wrapper
**Storage**: `localStorage` (`demonfall_settings_v1.language`, default `'de'`)
**Testing**: Manuell (Konstitution: kein formales Test-Suite, Playtest-driven)
**Target Platform**: Browser (Edge desktop primary), mobile sekundär
**Project Type**: Single-Project Browser Game
**Performance Goals**: 60fps Desktop, Scene-Transition <1s — Lookup darf nicht spürbar bremsen
**Constraints**: Kein Build-Tool, kein NPM-i18n-Paket, keine Server-Abhängigkeit
**Scale/Scope**: ~177 Strings, 7 Module, 2 Sprachen

## Constitution Check

| Gate | Status | Note |
|------|--------|------|
| Manual playtest passes, no console errors | wird per Playtest verifiziert | Sprachwechsel beidseitig + Persistenz nach Reload |
| Combat/AI no regression | low risk | i18n berührt nur Strings, keine Game-Logic |
| 60fps desktop, transitions <1s | low risk | Map-Lookup ist O(1), kein Render-Hit |
| Static deployment, no server | erfüllt | reines client-side JS |
| TEST_FIRST | abgeschwächt | per Konstitution PoC-Modus, manuelle Verifikation reicht |

**Verdict**: Gate clean — keine Verletzungen.

## Project Structure

### Documentation (this feature)

```
kitty-specs/041-i18n-de-en/
├── plan.md              # this file
├── spec.md              # feature spec
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/
    └── i18n-api.md      # i18n module public API
```

### Source Code (repository root)

```
js/
├── i18n.js              # NEU — Lookup-Tabelle DE/EN, window.i18n API
├── i18n/
│   ├── strings.de.js    # NEU — alle deutschen Strings
│   └── strings.en.js    # NEU — alle englischen Strings
├── persistence.js       # ÄNDERT — language-Setter/Getter, default 'de'
├── main.js              # ÄNDERT — HUD-Strings auf t() umstellen, applyLanguage()-Hook
├── questSystem.js       # ÄNDERT — Quest-Definitionen auf Keys umstellen
├── eventSystem.js       # ÄNDERT — Event-Texte auf Keys
├── loot.js              # ÄNDERT — Quest-Item-Namen auf Keys
├── loadoutOverlay.js    # ÄNDERT — UI-Hints auf Keys
├── scenes/
│   ├── SettingsScene.js # ÄNDERT — Sprach-Picker-Row + alle Labels auf Keys
│   └── startScene.js    # ÄNDERT — Loading-Screen Texte auf Keys
index.html               # ÄNDERT — Script-Tags für i18n.js + strings.*.js (vor allen verbrauchenden Modulen)
```

**Structure Decision**: Single-Project. `js/i18n.js` ist das öffentliche Interface (`window.i18n`). Strings werden in zwei separate Dateien (`strings.de.js`, `strings.en.js`) ausgelagert, die in eine globale Registry registrieren — so bleiben Diffs übersichtlich, kein Multi-Megabyte-Modul.

## Migration Strategy (Komplett)

1. **Infrastruktur** (Phase A)
   - `i18n.js` mit `register(lang, dict)`, `t(key, params?)`, `setLanguage(lang)`, `getLanguage()`, `onChange(cb)`
   - `strings.de.js` + `strings.en.js` (initial leere Registries, werden inkrementell befüllt)
   - `persistence.js` erweitert um `getLanguage()` / `setLanguage()`
   - Bootstrap in `index.html`: i18n laden, Sprache aus Settings holen, vor Phaser-Start setzen

2. **Settings-Picker** (Phase B)
   - `SettingsScene.js`: neue `_languageRow()` (analog zu `_pickerRow()` für Difficulty)
   - Wechsel triggert `i18n.setLanguage()` + `persistence.setLanguage()` + Re-Render

3. **String-Migration nach Modul** (Phase C — eine Untergruppe pro Work Package)
   - Jedes Modul: hardcoded String → Key-Aufruf `i18n.t('module.key')`
   - Beide Dictionaries gleichzeitig befüllen
   - Reihenfolge: Settings → Start-Screen → HUD → Loadout → Loot → Events → Quests

4. **Hot-Switch-Verifikation** (Phase D)
   - `i18n.onChange()`-Subscriber in lebenden Szenen (Settings, HUD, Loadout-Overlay)
   - Beim Sprachwechsel: alle Subscriber re-rendern
   - In-Game-Texte (Event-Dialoge, Quest-Tracker): beim nächsten Render automatisch neue Sprache (sofern sie `t()` zur Render-Zeit aufrufen, nicht beim Modul-Load)

## Key Design Decisions

- **Keine Parameter-Interpolation** initial nötig — falls einzelne Strings dynamische Werte brauchen, simples `{0}`/`{name}`-Replace im `t()`. Spec verlangt das nicht; nur einbauen wenn unvermeidbar.
- **Fallback**: fehlt Key in EN → DE-Wert; fehlt auch in DE → `[MISSING:key]` im Dev-Build (Console-Warning).
- **Quest-/Event-Definitionen** behalten ihre Struktur, statt String-Literalen stehen Keys; Render-Site übersetzt mit `t()`.
- **Render-Zeitpunkt**: Strings werden beim Anzeigen aufgelöst, NICHT bei Modul-Load — sonst kein Hot-Switch möglich.
- **Defaultsprache**: `'de'` (Bestand) — neue User sehen unverändertes Spiel.

## Phase 0 — Research

Siehe [research.md](./research.md). Kernpunkte:
- Vanilla-JS-Map-Lookup ist ausreichend (kein i18next nötig).
- Bestehender `persistence.js`-Wrapper bietet bereits Settings-Storage.
- `SettingsScene._pickerRow()` existiert als Vorbild für Sprach-Auswahl.
- Hot-Switch via Subscriber-Pattern, da Phaser-Texte über `setText()` aktualisierbar.

## Phase 1 — Design Artefakte

- [data-model.md](./data-model.md) — String-Key-Schema, Settings-Schema-Änderung
- [contracts/i18n-api.md](./contracts/i18n-api.md) — öffentliche API `window.i18n`
- [quickstart.md](./quickstart.md) — manuelle Playtest-Sequenz für Akzeptanz

## Constitution Re-Check (Post-Design)

Keine neuen Verletzungen. Manuelle Playtest-Sequenz in `quickstart.md` deckt alle Akzeptanzkriterien ab.

## Branch Strategy (Bestätigung)

- Current branch: `main`
- Planning/base branch: `main`
- Merge target: `main`

## Complexity Tracking

Keine Verletzungen.
