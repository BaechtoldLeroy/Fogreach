# 058 — Abschluss-Verifikation (WP05)

## T018 — Quest-Trigger-Audit (C-04, SC-05)
Berührte Quests bleiben completable unter run-konstanter Tiefe:

| Quest | Objektiv | Trigger neu | Completable? |
|-------|----------|-------------|--------------|
| `elara_ritual` | `reach_wave` 20 | `onWaveCompleted(currentWave)` mit currentWave = run-konstante Tiefe | ✅ Run auf Tiefe ≥ 20 |
| `mara_assault` | `reach_wave` 30 | dito | ✅ Run auf Tiefe ≥ 30 |
| `final_truth` | `reach_wave` 40 | dito | ✅ Run auf Tiefe ≥ 40 |
| `thom_pamphlets` | `dungeon_run` ×3 | `onDungeonCompleted()` (+1/Run) statt per Welle | ✅ 3 abgeschlossene Runs |

Unit-Tests: `tests/questSystem.test.js` (#41 WP04 ×2) + `tests/runBasedDepth.test.js`.

## T019 — Save-Kompat (FR-09, C-03, SC-06)
- `MAX_DEPTH` (`demonfall_maxDepth`) ist ein eigener localStorage-Key, von
  `storage.js` save/load NICHT berührt. Alt-Save mit hohem maxDepth → respektiert.
- Einziger Writer: `Persistence.bumpMaxDepth` (1×/abgeschlossenem Run). Kein
  Reset/Wipe durch das Feature.
- Boot-Init (`main.js` ~1149) setzt nur `DUNGEON_DEPTH` auf 1 wenn ungültig —
  rührt maxDepth nicht an.
- Tests: „high MAX_DEPTH respektiert/wächst, death/portal senken nie".

## T020 — Endless-Regression (FR-08, C-05, SC-07)
Endless-Zweig in `roomManager.onStairOverlap` setzt eigenes
`SELECTED_WAVE_OVERRIDE = newDepth` (+1) und `return`t VOR dem regulären
run-konstanten Code. `endlessMode.js` treibt seine Tiefe selbst. Regulärer Run
run-konstant, Endless steigt weiter — unberührt durch WP02–WP04.

## T021 — NFR (NFR-01/02)
- **NFR-02**: maxDepth wird nur noch 1×/Run geschrieben (per-Raum-`setItem` in
  `markRoomCleared` entfernt, WP02). Grep bestätigt: einziger Writer
  `bumpMaxDepth`.
- **NFR-01 (60fps/Mobile ≥45)**: das Feature ENTFERNT pro-Raum-Arbeit (kein
  per-Raum-setItem mehr), fügt nur O(1)-Hooks bei Run-Start/-Abschluss hinzu.
  Keine per-Frame-Last → keine Perf-Regression ggü. 053.

## T022 — Playtest (NFR-03, SC-08) — OFFEN (User)
Erwartung: Tiefe wächst nur +1 pro abgeschlossenem Run statt pro Raum →
flachere Kurve, nach ~2 Quests NICHT mehr bei Tiefe ~15. Vom User zu
verifizieren; danach Feature-Accept.

**Hinweis fürs Playtesten:** Wave-gegatete Ability-Unlocks
(`AbilitySystem.onWaveCompleted` schwellenbasiert) gaten nun an der
run-konstanten Tiefe statt am Innerhalb-Run-Klettern — Unlocks kommen also
langsamer (an die Run-Progression gekoppelt). Intendiert; bei Bedarf
Schwellen nachtunen.
