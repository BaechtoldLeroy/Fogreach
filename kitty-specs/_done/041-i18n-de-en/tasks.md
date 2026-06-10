# Tasks: 041 — i18n Deutsch/Englisch

**Feature**: `041-i18n-de-en`
**Branch / Base / Merge Target**: `main` / `main` / `main`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/i18n-api.md](./contracts/i18n-api.md)

## Overview

8 Work Packages, ~44 Subtasks insgesamt. WP01 ist Foundation (alle anderen abhängig). WP02–WP08 sind unabhängig voneinander parallelisierbar. Jeder Modul-WP besitzt sein eigenes Source-File und registriert seine DE/EN-Strings direkt im Modulkopf via `window.i18n.register(lang, dict)` — so bleibt Ownership konfliktfrei und Strings stehen co-located zum Verbraucher.

## Branch Strategy

- Planning/Base: `main`
- Final merge target: `main`
- Stacking: WP02–WP08 stacken auf WP01 (`spec-kitty implement WPxx --base WP01`).

## Work Packages

---

### WP01 — i18n Foundation (Bootstrap, Persistence, API)

**Goal**: Lege das i18n-Fundament: `window.i18n` API, Persistence-Erweiterung in `persistence.js`, Bootstrap-Reihenfolge in `index.html`. Keine UI-Strings-Migration, nur Plumbing.

**Priority**: P0 (Foundation — alles andere blockiert).

**Independent test**: `window.i18n.t('test.key')` liefert in Browser-Konsole `'[MISSING:test.key]'`; `i18n.setLanguage('en')` schaltet aktive Sprache; `persistence.getLanguage()` liefert `'de'` als Default und persistiert nach Setter-Call.

**Subtasks**:

- [ ] T001 — Datei `js/i18n.js` anlegen mit `register/t/setLanguage/getLanguage/onChange` API gemäß `contracts/i18n-api.md`
- [ ] T002 — `js/persistence.js` erweitern: `getLanguage()` (Default `'de'`), `setLanguage(lang)` schreibt in `demonfall_settings_v1.language`
- [ ] T003 — `index.html` Script-Reihenfolge: persistence → i18n → inline `i18n.setLanguage(persistence.getLanguage())` VOR allen anderen Modulen
- [ ] T004 — Validation in `setLanguage`: nur `'de'`/`'en'`, sonst Console-Warning + Fallback auf `'de'`
- [ ] T005 — Fallback-Kaskade in `t()`: aktive Sprache → `'de'` → `[MISSING:key]` + Console-Warning
- [ ] T006 — Manuelle Browser-Verifikation: leerer localStorage → `i18n.getLanguage() === 'de'`; nach `i18n.setLanguage('en')` + `persistence.setLanguage('en')` + Reload → `'en'`

**Owned files**: `js/i18n.js`, `js/persistence.js`, `index.html`

**Estimated prompt size**: ~350 lines

**Dependencies**: keine

---

### WP02 — Settings Scene + Sprach-Picker

**Goal**: Migriere `SettingsScene.js` komplett (~13 Strings) und füge Sprach-Picker hinzu. Trigger Hot-Switch + Persistence beim Wechsel.

**Priority**: P1.

**Independent test**: Settings öffnen, Sprache auf Englisch wechseln → gesamtes Settings-Menü sofort englisch; Reload → bleibt englisch.

**Subtasks**:

- [ ] T007 — Am Modulkopf: `i18n.register('de', {...})` + `i18n.register('en', {...})` für alle Settings-Strings (Title, Sektions-Labels AUDIO/STEUERUNG/MOBILE/ANZEIGE/DEBUG, Toggle-Labels, Action-Buttons)
- [ ] T008 — Alle hardcoded Strings im Scene-Body auf `i18n.t('settings.xxx')` umstellen
- [ ] T009 — Neue `_languageRow()`-Methode (analog `_pickerRow()`) mit Optionen `[Deutsch, English]`
- [ ] T010 — Wechsel-Callback: `i18n.setLanguage(newLang)` → `persistence.setLanguage(newLang)` → Scene-Restart oder Re-Render aller Settings-Elemente
- [ ] T011 — `i18n.onChange()`-Subscriber registrieren, der bei externem Sprachwechsel die Scene re-rendert (idempotent)

**Owned files**: `js/scenes/SettingsScene.js`

**Estimated prompt size**: ~400 lines

**Dependencies**: WP01

---

### WP03 — Start Scene + Loading Screen

**Goal**: Migriere `startScene.js` (~5 Strings: Loading-Texte, Title, Buttons).

**Priority**: P2.

**Independent test**: Spiel mit Sprache `en` starten → Start-Screen + Loading-Texte englisch.

**Subtasks**:

- [ ] T012 — Modulkopf: `i18n.register('de'/'en', {...})` für alle Start-Scene-Strings
- [ ] T013 — Hardcoded Strings auf `i18n.t('start.xxx')` umstellen
- [ ] T014 — Loading-Progress-Texte (z.B. `'Lade Assets...'`) auf Keys
- [ ] T015 — Manueller Test: beide Sprachen, Strings korrekt; keine `[MISSING:...]`-Warnings

**Owned files**: `js/scenes/startScene.js`

**Estimated prompt size**: ~250 lines

**Dependencies**: WP01

---

### WP04 — HUD + Death Screen + Potion (main.js)

**Goal**: Migriere alle UI-Strings in `main.js` (~27 Strings: HUD-Labels, Death-Screen, Potion-Status). Registriere `onChange`-Subscriber für HUD-Re-Render.

**Priority**: P1.

**Independent test**: Im Run Sprache wechseln → HUD-Labels (Health/XP/Level/Potion) + Death-Screen-Text aktualisieren sich beim nächsten HUD-Tick.

**Subtasks**:

- [ ] T016 — Modulkopf: `i18n.register('de'/'en', {...})` für alle HUD/Death/Potion-Strings
- [ ] T017 — HUD-Render-Funktion (`updateHUD`) auf `i18n.t()` umstellen — Strings zur Render-Zeit auflösen
- [ ] T018 — Death-Screen `'DU BIST GESTORBEN'` + Restart-Button auf Keys
- [ ] T019 — Potion-Status (`'Leer'`, `'Bereit'`, etc.) auf Keys
- [ ] T020 — `i18n.onChange()`-Subscriber registriert, der `updateHUD()` triggert
- [ ] T021 — Stats-Display-Strings (`'Damage:'`, `'Speed:'`, etc.) auf Keys
- [ ] T022 — Manueller Test: Hot-Switch im Run, alle Stellen prüfen

**Owned files**: `js/main.js`

**Estimated prompt size**: ~450 lines

**Dependencies**: WP01

---

### WP05 — Loadout Overlay

**Goal**: Migriere `loadoutOverlay.js` (~13 Strings: UI-Hints, Slot-Labels, Confirm-Buttons).

**Priority**: P2.

**Independent test**: Loadout-Overlay (`L`-Taste) im englischen Mode öffnen → komplett englisch.

**Subtasks**:

- [ ] T023 — Modulkopf: `i18n.register('de'/'en', {...})` für Loadout-UI-Strings
- [ ] T024 — Hardcoded Strings auf `i18n.t('loadout.xxx')`
- [ ] T025 — `i18n.onChange()`-Subscriber für Re-Render falls Overlay offen
- [ ] T026 — Manueller Test: Sprache wechseln während Overlay offen → re-rendert

**Owned files**: `js/loadoutOverlay.js`

**Estimated prompt size**: ~280 lines

**Dependencies**: WP01

---

### WP06 — Loot + Item-Namen

**Goal**: Migriere `loot.js` und `lootSystem.js` (~10 Strings: Quest-Item-Namen, Loot-Toasts).

**Priority**: P2.

**Independent test**: Quest-Item aufheben im englischen Mode → Item-Name + Toast englisch.

**Subtasks**:

- [ ] T027 — `loot.js`: Modulkopf-Register für Quest-Item-Namen + Loot-Strings
- [ ] T028 — `lootSystem.js`: Modulkopf-Register für Loot-System-Texte (Gold-Toasts, Drop-Hinweise)
- [ ] T029 — Item-Name-Konstanten auf `i18n.t('loot.item.xxx')` umstellen
- [ ] T030 — Toast-Texte auf Keys
- [ ] T031 — Manueller Test: Quest-Item + Loot-Drops in beiden Sprachen

**Owned files**: `js/loot.js`, `js/lootSystem.js`

**Estimated prompt size**: ~320 lines

**Dependencies**: WP01

---

### WP07 — Event System

**Goal**: Migriere `eventSystem.js` (~14 Strings: Event-Toasts, Dialog-Titel, Choice-Labels). Inkl. Schrein, Glücksspiel, Truhen-Events.

**Priority**: P2.

**Independent test**: Random-Event triggern im englischen Mode → Toast + Dialog + Choices englisch.

**Subtasks**:

- [ ] T032 — Modulkopf: `i18n.register('de'/'en', {...})` für alle Event-Strings (mindestens 14, evtl. mehr durch versteckte)
- [ ] T033 — Event-Definitionen (`EVENT_TYPES`): `name` von Literal auf Key-Reference umstellen
- [ ] T034 — Event-Handler: Toast-Texte (`showEventToast`-Calls) auf `i18n.t()`
- [ ] T035 — `showEventChoiceDialog`-Aufrufe: Dialog-Titel und Choice-Labels auf `i18n.t()`
- [ ] T036 — In-Event-Texte (Erfolg/Fehlschlag-Toasts wie `'Kraft des Schreins: +25% Schaden!'`) auf Keys
- [ ] T037 — Manueller Test: Schrein, Glücksspiel, Verfluchte Truhe — alle Texte korrekt in beiden Sprachen

**Owned files**: `js/eventSystem.js`

**Estimated prompt size**: ~430 lines

**Dependencies**: WP01

---

### WP08 — Quest System

**Goal**: Migriere `questSystem.js` (~95 Strings — größtes Modul). Quest-Definitionen, NPC-Dialoge, Tracker-Texte.

**Priority**: P1 (hochsichtbar).

**Independent test**: Im englischen Mode komplette Quest annehmen → abschließen → alle Dialoge + Tracker englisch.

**Subtasks**:

- [ ] T038 — Modulkopf: `i18n.register('de'/'en', {...})` für Quest-System-Texte (Tracker-Labels, generische Dialoge)
- [ ] T039 — Quest-Definitions-Objekt (`QUEST_DEFINITIONS`): jeder Quest bekommt `titleKey`, `descriptionKey` statt hardcoded Strings
- [ ] T040 — Dialog-Felder (`dialogueOffer`, `dialogueProgress`, `dialogueComplete`) jeweils auf Keys umstellen — pro Quest ~3-5 Keys
- [ ] T041 — Quest-Render-Site: alle `quest.title`/`quest.description`-Reads auf `i18n.t(quest.titleKey)` umstellen (oder Helper `getQuestTitle(quest)`)
- [ ] T042 — Quest-Tracker-UI auf Key-Lookup umstellen
- [ ] T043 — `i18n.onChange()`-Subscriber für Quest-Tracker-Re-Render falls UI lebt
- [ ] T044 — Manueller Test: Saeuberung-Quest komplett durchspielen in beiden Sprachen

**Owned files**: `js/questSystem.js`

**Estimated prompt size**: ~500 lines

**Dependencies**: WP01

---

## Dependencies Graph

```
WP01 (Foundation)
  ├── WP02 (Settings + Picker)
  ├── WP03 (Start Scene)
  ├── WP04 (HUD/main.js)
  ├── WP05 (Loadout Overlay)
  ├── WP06 (Loot)
  ├── WP07 (Events)
  └── WP08 (Quests)
```

WP02–WP08 sind unabhängig parallelisierbar nach WP01.

## MVP Scope

WP01 + WP02 ergeben einen funktionsfähigen MVP: i18n-Plumbing + Settings-Picker funktionieren, Settings-Menü ist zweisprachig. Weitere Module bleiben deutsch, Spiel ist trotzdem nutzbar.

## Acceptance (Cross-WP)

Vollständige Akzeptanz nach allen 8 WPs gemäß [quickstart.md](./quickstart.md): alle 12 Smoke-Test-Schritte + Edge Cases bestehen, keine `[MISSING:...]`-Warnings in Console.

## Requirement Coverage (Hint)

- FR-001 (i18n-Modul) → WP01
- FR-002 (alle UI-Texte via Keys) → WP02–WP08
- FR-003 (Sprach-Picker im Settings-Menü) → WP02
- FR-004 (localStorage-Persistenz + Reload) → WP01
- FR-005 (Default Deutsch) → WP01
- FR-006 (Hot-Switch) → WP01 (API), WP02–WP08 (Render-Time-Lookup + Subscriber)
