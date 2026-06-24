# Tasks: Run-Amulett-Slot + Inventar-UI-Redesign

**Feature**: 059-run-amulet-slot
**Generated**: 2026-06-24
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Amulett-Slot + Datenmodell + Item-type `amulet` | 6 (T001–T006) | ~250 | none | — |
| WP02 | Run-Lifecycle: run-scoped State + Reset + Save-Guard | 5 (T007–T011) | ~180 | WP01 | — |
| WP03 | Effekt-Pool (A1–A6) + Combat-/Stat-Hooks | 8 (T012–T019) | ~450 | WP01, WP02 | — |
| WP04 | Spawn-Gating ab Tiefe 10 + fliegender Händler | 6 (T020–T025) | ~320 | WP01, WP02 | mit WP03 |
| WP05 | Inventar-UI-Redesign + Tooltip + Mobile + i18n-Abschluss | 6 (T026–T031) | ~350 | WP01, WP03 | — |

**Total**: 31 Subtasks über 5 WPs.

**MVP-/Ship-Reihenfolge**: WP01 → WP02 → (WP03 ∥ WP04) → WP05. WP01+WP02 liefern
einen funktionsfähigen, run-scoped Slot (anlegbar, resettet sauber) — schon allein
testbar. WP03 (Effekte) und WP04 (Spawn/Händler) hängen beide nur an WP01+WP02 und
können parallel laufen; zur Konfliktvermeidung in `lootSystem.js` (AMULET_DEFS wird
von beiden gelesen) WP03 zuerst mergen empfohlen. WP05 (UI) braucht WP01 (Slot) und
WP03 (Effekt-Texte für Tooltip).

**Constitution-Gate**: `test-first` (DIRECTIVE TEST_FIRST) — Reset (SC-02/SC-06),
Spawn-Gating (SC-03), getBonus/Effekt-Anwendung (SC-05) als Unit-Tests VOR der
Implementierung in `tests/runAmulet.test.js`. Persistenz-Guard (FR-12) ist
Pflicht-Subtask in WP02.

---

## Phase 1 — Foundation

### WP01: Amulett-Slot + Datenmodell + Item-type `amulet`

**Goal**: Den 5. Slot `amulet` und ein eigenes Amulett-Datenmodell anlegen, ohne
Effekte/Spawn — Slot ist anlegbar/ablegbar, Amulett-Items existieren als Typ.
**Depends on**: none. **Requirements**: FR-01, FR-02, FR-08.

**Independent test**: `node tools/runTests.js` grün; neues `tests/runAmulet.test.js`
(Slot existiert, Amulett anlegen/tauschen, AMULET_DEFS gültig).

**Subtasks**:
- [ ] **T001** `equipment` (`js/main.js:825`) um `amulet: null` erweitern; `window.runAmulet = null` neben `window.equipment` anlegen.
- [ ] **T002** `equipKeys` (`js/inventory.js:619`) um `'amulet'` erweitern; Equip-Swap-Pfad (`js/inventory.js:1220`) für 5. Slot prüfen/anpassen (Slot-Kapazität 1, Tausch FR-08).
- [ ] **T003** Item-`type: 'amulet'` + `AMULET_DEFS` (Object.freeze-Array) in `js/lootSystem.js` neben `ITEM_BASES` (`:255`) anlegen — id/name/iconKey/effect-Stub/tier-Bias. **Nicht** in `ITEM_BASES`, **nicht** im `rollItem`-Weighted-Pool.
- [ ] **T004** `rollAmulet(depth, rng)` in `js/lootSystem.js` (eigener Pfad, getrennt von `rollItem` `:514`); exportieren über `LootSystem`-API (`:956` Umfeld).
- [ ] **T005** Amulett-Item-Visual/Icon-Key in `js/loot.js` (TIER_COLORS-Umfeld) + Fallback-Icon registrieren.
- [ ] **T006** `tests/runAmulet.test.js` aufsetzen: Slot existiert, `equipment.amulet` an-/ablegbar, Tausch hält genau 1 aktiv, `AMULET_DEFS` wohlgeformt. Baseline-Tests weiterhin grün.

---

## Phase 2 — Run-Lifecycle

### WP02: Run-scoped State + Reset + Save-Guard

**Goal**: Amulett ist garantiert run-spezifisch — Reset bei Hub-Rückkehr/Tod, kein
Persist ins Save. **Depends on**: WP01. **Requirements**: FR-03, FR-12, NFR-03.

**Independent test**: Unit-Test: nach simuliertem `leaveDungeonForHub` (reason
`portal` UND `death`) ist `equipment.amulet === null` + `window.runAmulet` geleert;
Save-Roundtrip enthält kein Amulett (test-first).

**Subtasks**:
- [ ] **T007** [test-first] `tests/runAmulet.test.js`: Reset-Tests (portal + death) + Save-Guard-Test schreiben (rot), VOR Implementierung.
- [ ] **T008** Reset-Hook in `leaveDungeonForHub` (`js/main.js:1689`) — analog `brunnenBuffs`/`printingBuffs` (`:1725`/`:1736`): `equipment.amulet = null; window.runAmulet = null;` gefolgt von `recalcDerived(0,0)`. Greift für **alle** Reasons (D1c).
- [ ] **T009** Save-Guard (FR-12): im Save-Pfad (`js/storage.js` / `gameState.js:48`, das `window.equipment` serialisiert) sicherstellen, dass `amulet` NICHT persistiert wird — beim Speichern auslassen ODER beim Laden defensiv `equipment.amulet = null`. `js/persistence.js` KEYS unverändert (kein neuer Key).
- [ ] **T010** Defensiver Load: Alt-Save ohne `amulet`-Feld lädt fehlerfrei; falls ein Alt-Save versehentlich ein Amulett trägt → genullt (SC-06).
- [ ] **T011** Reset-/Save-Guard-Tests grün; `node tools/runTests.js` grün.

---

## Phase 3 — Effekte

### WP03: Effekt-Pool (A1–A6) + Combat-/Stat-Hooks

**Goal**: 6 Amulette mit run-definierenden Effekten; Stat-Anteile über
`recalcDerived`, Nicht-Stat-Effekte über Combat-Hooks. **Depends on**: WP01, WP02.
**Requirements**: FR-05, FR-06, NFR-01, NFR-02.

**Independent test**: Unit-Test pro Effekt-Archetyp (Extra-Proj zählt 2 Treffer,
Chain trifft 2. Gegner, Cleave AoE, Lifesteal heilt, Stat-Amulett ändert Derived);
Combat-Hooks lesen `window.runAmulet.effect`. 60fps unverändert.

**Subtasks**:
- [ ] **T012** [test-first] Effekt-Tests in `tests/runAmulet.test.js`: getBonus/Stat-Anwendung (A6/A8-Stil) + Nicht-Stat-Hook-Dispatch (rot zuerst).
- [ ] **T013** A6/A8 (reine/teilweise Stats): Amulett-Stat-Anteil in `recalcDerived` (`js/inventory.js:842`, `Object.values(equipment)`-Loop `:852`) verrechnen — move/speed/damage/maxHp. Sicherstellen, dass `equipment.amulet` automatisch mitgezählt wird.
- [ ] **T014** A1 Extra-Projektil/Doppelschlag — Hook in Player-Attack (`js/player.js`, Bow `_fireBowArrow` `:2040` + Melee-Pfad); zweiter versetzter Treffer bei `runAmulet.effect==='twin'`.
- [ ] **T015** A2 Chain — Hit-Resolve-Hook: Treffer springt auf bis zu 2 nahe Gegner (Enemy-Pool-Nachbarsuche, abnehmender Schaden).
- [ ] **T016** A3 Cleave — Melee-Hit-Region auf Kegel/AoE erweitern bei `cleave`.
- [ ] **T017** A4 Lebensraub — Damage-Dealt-Hook + `setPlayerHealth`; deutlich über Affix-Lifesteal.
- [ ] **T018** A5 Aura — throttled Per-Tick-DoT um den Spieler im Update-Loop (NFR-01: kein per-Frame O(n²)).
- [ ] **T019** Effekt-Dispatch zentral: Helfer `applyAmuletEffectHook(kind, ctx)` liest `window.runAmulet`; alle Hooks no-op wenn kein Amulett. Tests grün; Perf-Check (NFR-01).

---

## Phase 4 — Spawn & Händler

### WP04: Spawn-Gating ab Tiefe 10 + fliegender Händler

**Goal**: Amulett erscheint garantiert ab Tiefe 10 früh im Run; fliegender Händler
bietet run-fixe Auswahl. **Depends on**: WP01, WP02 (parallel zu WP03).
**Requirements**: FR-04, FR-07, FR-13, SC-03, SC-04.

**Independent test**: Unit-Test: `DUNGEON_DEPTH < 10` → kein Amulett-Spawn + kein
Händler-Amulett; `>= 10` (inklusiv) → garantiert 1 Spawn-Inject in frühem Raum;
Händler-State run-fix (gleicher runId → gleiche Auswahl).

**Subtasks**:
- [ ] **T020** [test-first] Spawn-Gating-Test (`< 10` keiner, `>= 10` genau 1, Grenze 10 inklusiv) + Händler-run-fix-Test (rot zuerst).
- [ ] **T021** Spawn-Inject in `initDungeonRun` (`js/roomManager.js:141`): bei `window.DUNGEON_DEPTH >= 10` `rollAmulet(depth)` in einen der **ersten** Räume als Pickup einspeisen (eigenes Drop-Visual). Bestehende Spawn-Order nicht brechen.
- [ ] **T022** Fliegender-Händler-Encounter: run-spezifischer NPC/Auslage (eigener Spawn im Run, nicht Hub). Anbindung an EventSystem/Encounter-Muster (vgl. Dungeon-NPC-Encounter-Pattern aus Memory).
- [ ] **T023** `getOrCreateAmuletShopState(runId)` in `js/lootSystem.js` nach Vorbild `getOrCreateShopState` (`:854`): 2–3 `rollAmulet`-Optionen run-fix per `runId`; Tiefen-Bias (D5).
- [ ] **T024** Kauf-Flow: Gold abziehen (`spendGold`), Amulett ins Inventar; unter Tiefe 10 keine Amulett-Auslage (FR-13).
- [ ] **T025** Spawn-/Händler-Tests grün; i18n DE/EN für Händler-Dialog + Tiefe-10-Hinweis.

---

## Phase 5 — UI-Redesign & Abschluss

### WP05: Inventar-UI-Redesign + Tooltip + Mobile + i18n

**Goal**: 5-Slot-Inventar-Layout, run-spezifischer Slot visuell abgesetzt, Effekt-
Tooltip, Mobile-tauglich, i18n vollständig. **Depends on**: WP01, WP03.
**Requirements**: FR-09, FR-10, FR-11, FR-13, SC-07, SC-08.

**Independent test**: Inventar zeigt 5 Equipment-Slots; Amulett-Slot trägt Run-Badge
+ eigene Optik; Tooltip rendert Effekt-Beschreibung; Touch-Tap trifft den Slot;
keine hartkodierten Strings; alle Tests grün; 60fps/Mobile ≥45.

**Subtasks**:
- [ ] **T026** Equipment-Spalte auf 5 Slots umbauen (`invUI.equip`, `js/inventory.js:660`): Abstände/Größen/Layout, Amulett-Slot mit eigener Slot-Optik (run-Farbton/Rahmen).
- [ ] **T027** Run-Badge „Nur dieser Run" am Amulett-Slot + Gesperrt-Zustand (Tiefe < 10, ausgegraut + Hinweis, FR-13).
- [ ] **T028** `formatItemTooltip` (`js/inventory.js:515`) um Amulett-Effekt-Block + Run-Hinweis erweitern; Tooltip-Clipping (vgl. `:576`) für 5. Slot prüfen.
- [ ] **T029** Mobile-Bedienbarkeit: Touch-Hit-Area des 5. Slots (scrollFactor-/Hit-Area-Falle, vgl. Memory `project_phaser_scrollfactor_dialogs`); auf Touch testen.
- [ ] **T030** i18n-Vollständigkeit DE/EN: Amulett-Namen, Effekt-Texte (A1–A6), Slot-Label, Badge, Händler, Tiefe-10-Hinweis; grep auf hartkodierte Strings (FR-11).
- [ ] **T031** Abschluss-Verifikation: alle SC erfüllt; `node tools/runTests.js` grün; Smoke `node tools/testGame.js`; NFR-01 (60fps/Mobile ≥45) + NFR-02 (Balance-Playtest) prüfen; Feature-Accept vorbereiten.
