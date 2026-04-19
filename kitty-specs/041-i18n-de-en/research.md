# Phase 0 — Research: 041 i18n DE/EN

## R-001 — i18n-Library vs. Custom

**Decision**: Custom Vanilla-JS-Modul (`js/i18n.js`).

**Rationale**:
- Projekt nutzt keine NPM-Build-Pipeline; Scripts werden klassisch via `<script>`-Tag eingebunden.
- Anforderung ist trivial: zwei Sprachen, ~177 Strings, kein Plural, keine ICU-Komplexität, kaum Interpolation.
- Eine Library wie i18next würde unnötiges Gewicht und Bootstrap-Komplexität bringen.
- Map-Lookup mit Fallback-Kaskade ist ~20 Zeilen Code.

**Alternatives considered**:
- *i18next (CDN-Bundle)*: zusätzlicher HTTP-Request, Komplexität für triviale Need-Set überdimensioniert.
- *Inline-Ternary `lang === 'de' ? 'X' : 'Y'`*: explodiert über 177 Stellen, kein zentrales Verzeichnis.

---

## R-002 — String-Storage-Format

**Decision**: Zwei separate JS-Dateien (`strings.de.js`, `strings.en.js`), die ein Dictionary in eine zentrale Registry registrieren via `window.i18n.register('de', {...})`.

**Rationale**:
- Diff-freundlich: Sprach-Änderung in EN berührt nicht DE-Datei.
- Keine `fetch()`-Logik nötig (würde Bootstrap-Race auslösen, da Phaser sofort nach DOM-Load startet).
- Klassische Script-Tags garantieren synchronen Load vor Phaser-Boot.

**Alternatives considered**:
- *Ein zentrales Objekt `{ de: {...}, en: {...} }` in `i18n.js`*: explodiert Datei-Größe und macht parallele Edits konfliktanfällig.
- *JSON-Files via fetch*: erfordert async Bootstrap, problematisch mit Phaser-Init.

---

## R-003 — Persistenz-Schicht

**Decision**: Sprache als `language` in bestehendem `demonfall_settings_v1`-Objekt speichern. Wrapper-Methoden in `persistence.js`: `getLanguage()`, `setLanguage(lang)`.

**Rationale**:
- `persistence.js` hat bereits `KEYS.SETTINGS` Registry und Lade/Speicher-Logik.
- Konsistent mit `audio`, `mute`, `difficulty` etc. die im selben Objekt liegen.
- Keine neue localStorage-Key-Konstante nötig.

**Alternatives considered**:
- *Eigener Key `demonfall_lang_v1`*: redundant, fragmentiert Settings.

---

## R-004 — Hot-Switch ohne Reload

**Decision**: Subscriber-Pattern via `i18n.onChange(callback)`. Lebende Szenen (Settings, HUD, Loadout-Overlay) registrieren Re-Render-Callbacks. In-Game-Render-Pfade (Event-Dialog, Quest-Tracker, HUD-Updates) lesen Strings _zur Render-Zeit_ via `t()`.

**Rationale**:
- Phaser-Text-Objekte unterstützen `setText()` → kein Re-Mount nötig.
- Strings, die NUR beim Modul-Load gesetzt würden (z.B. statische Konstanten), müssen auf Lazy-Lookup umgestellt werden — daher Migrationsregel: `t()` immer beim Render aufrufen.
- Quest-Definitions-Objekte speichern Keys, nicht aufgelöste Strings → automatisch sprachneutral.

**Alternatives considered**:
- *Reload-only-Switch*: einfacher, verletzt aber FR-006 (Hot-Switch).
- *Globaler Phaser-Scene-Restart*: zerstört In-Game-Zustand, untragbar während Run.

---

## R-005 — Default-Sprache & Migration-Verhalten

**Decision**: Default `'de'`. Bestehende User ohne `language`-Setting sehen unverändertes Verhalten.

**Rationale**:
- FR-005 verlangt es explizit.
- Zero-Risk-Migration: kein User wird automatisch auf eine andere Sprache umgeschaltet.

---

## R-006 — Bootstrap-Reihenfolge in `index.html`

**Decision**: Script-Reihenfolge:
1. `js/persistence.js`
2. `js/i18n.js` (definiert API)
3. `js/i18n/strings.de.js` (registriert DE)
4. `js/i18n/strings.en.js` (registriert EN)
5. Inline-Snippet: `window.i18n.setLanguage(window.persistence.getLanguage() || 'de')`
6. Phaser + alle anderen Module

**Rationale**:
- Garantiert, dass `t()` beim ersten Verbraucher-Aufruf bereits funktional ist.
- Persistierte Sprache ist gesetzt _bevor_ irgendeine Szene Render-Calls macht.

**Alternatives considered**:
- *Async/defer*: bricht garantierte Reihenfolge bei klassischen Scripts.

---

## R-007 — Fehlende Übersetzungen (Fallback)

**Decision**: Fallback-Kaskade `requested → 'de' → '[MISSING:key]'`. Console-Warning bei Miss.

**Rationale**:
- DE ist Source-of-Truth → garantiert immer ein lesbarer String.
- `[MISSING:key]` macht Übersetzungslücken in EN sofort sichtbar im Playtest.
