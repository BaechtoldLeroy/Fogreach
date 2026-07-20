# Data Model: Hub-Evolution

Keine Persistenz; „Modelle" sind In-Memory-Objektformen (Classic Script). Zustand wird aus bestehenden Story-Daten abgeleitet.

## HubPhase (`js/hubPhase.js`)
Aufzählung `'council' | 'doubleAgent' | 'broken' | 'epilogue'`. Abgeleitet via `derivePhase(actIndex, flags)` — Regel siehe [hub-phase-contract](contracts/hub-phase-contract.md).
- **Invariante:** rein aus `actIndex`+`flags`; keine Seiteneffekte; Default `council`; Eingabe nicht mutiert.

## HubPhaseStyle (`HubPhase.PHASE_STYLE[phase]`)
Darstellungs-Parameter je Phase. Felder (Kontrakt):
- `tint` (0xRRGGBB), `desaturate` (0..1), `fog` (0..1), `posters` ∈ {fresh|faded|torn|gone}, `assetKey` (string|null = Austauschpunkt), `rathausHostile` (bool).
- **Invariante:** genau ein Eintrag pro Phase; alle Felder gesetzt.

## npcFlavorByPhase (`HubPhase.npcFlavorByPhase[phase][npcId]`)
Optionale Flavor-Override-Zeilen. ASCII-NPC-IDs. Fehlt ein Eintrag → bestehende Flavor-Zeilen bleiben.

## HubPhaseView-Handle (`js/hubPhaseView.js`)
Rückgabe von `apply(scene, phase, refs)`: `{ destroy() }`. Kapselt die erzeugten Overlays.
- **Invariante:** idempotent (erneuter apply/destroy räumt vorher auf); alle GameObjects `scrollFactor(0)`; kein Layout-Umbau.

## StoryState (bestehend, gelesen)
- Akt-Index `storySystem.getCurrentActIndex()` (0–4); Flags `questSystem.getFlags()` (u. a. `story_ending`, `truth_told`). Nur gelesen.

## Verhaltens-Anbindung (Integration, keine Datei-Modelle)
- Aldric-Quest-Sperre: `HubPhase.aldricBlocksQuests(phase)` erweitert die bestehende `aldricRefuses`-Bedingung in HubSceneV2.
- Epilog-Bürger: bestehender `buerger`-NPC (hubLayout) via Flavor-Override.
