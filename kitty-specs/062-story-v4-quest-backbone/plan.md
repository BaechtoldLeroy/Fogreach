# Implementation Plan: Story v4 — Quest-Rückgrat

**Branch**: `main` | **Date**: 2026-07-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `kitty-specs/062-story-v4-quest-backbone/spec.md`
**Branch-Vertrag**: Start `main` · Planungs-/Basis-Branch `main` · Merge-Ziel `main` (`branch_matches_target: true`).

## Summary

Migration des Quest-Systems auf die v4-Doppelagenten-Struktur — reine Daten- und Fortschrittslogik. Kern: das kanonische Akt-Trigger-Register (vier `advanceAct`-Trigger + terminale `story_ending`-Quest), verschobene Trigger, `requiredAct`/`prerequisites`-Neuverteilung, Umbenennungen, sechs neue Quests inkl. Texte, Doppel-Tonspur an drei Rats-Quests, ein versionierter Story-Reset für Altstände und die Neugenerierung von `docs/QUESTS.md`. Schließt #44.

**Technischer Ansatz (zwei tragende Entscheidungen):**
1. **Flags:** KEIN neues `questFlags.js`. Der bestehende Flag-Speicher in `js/questSystem.js` (`setFlag`/`hasFlag`, mitpersistiert über `getQuestSaveData`/`loadQuestSaveData`, slot-aware) wird weiterverwendet und minimal ergänzt (`getFlags()`/`listFlags()` fürs spätere Finale). Vermeidet einen zweiten, driftenden Speicher.
2. **Altstand-Reset:** Der Quest-Save-Blob bekommt eine `storyVersion`. Beim Laden wird der Story-/Quest-/Flag-Teil verworfen und auf Akt 0 initialisiert, wenn `storyVersion` fehlt oder unter der v4-Version liegt. Charakter-State (Level/Inventar/Gold/Skillbaum) liegt außerhalb dieses Blobs und bleibt unberührt.

## Technical Context

**Language/Version**: JavaScript, ES5-kompatibel (Classic-Script/IIFE, KEIN Modul-System), Phaser 3.70
**Primary Dependencies**: bestehende Spiel-Systeme — `js/questSystem.js`, `js/storySystem.js`, `js/storage.js`, `js/saveSlots.js`, `js/player.js`
**Storage**: `localStorage` ausschließlich über `window.SlotStorage` (Slot-Namespacing); Quest-State + Story-Flags leben im Haupt-Save-Blob (`demonfall_save_v1` → `quests`)
**Testing**: `node:test` via `node tools/runTests.js`; Muster `tests/questSystem.test.js` (lädt Module ohne DOM über `tests/loadGameModule.js`)
**Target Platform**: Browser (GitHub Pages, Desktop + Mobile)
**Project Type**: single project, flache `js/`-Struktur
**Performance Goals**: n/a (Datenschicht, kein Hot-Path)
**Constraints**: kein ES-`import`/`export`; Code-Strings ASCII (ae/oe/ue), Fließtext Umlaute; quest-getriebener Akt-Aufstieg; `?v=`-Cache-Buster pro geänderter Datei
**Scale/Scope**: 34 Quest-Definitionen, ~8 Backbone-Story-Flags, 1 Doku-Generator, ~4 berührte JS-Dateien + Tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Governance läuft im **compact/unresolved**-Modus: die Constitution referenziert Tools (`node`, `npm`, `phaser`), die nicht in der Runtime-Tool-Registry registriert sind. Das ist eine reine Registry-Warnung, **kein inhaltliches Gate** und kein Blocker für dieses Datenschicht-Feature.
- Die realen Projekt-Konventionen werden eingehalten und sind als Constraints in der Spec verankert: Classic-Script-Architektur (C-001), ASCII-Code-Strings (C-002), SlotStorage-Zugriff (C-003), quest-getriebener Aufstieg (C-004), Cache-Buster (NFR-005).
- **Ergebnis:** Keine offenen Verstöße. Kein Eintrag in Complexity Tracking nötig.

## Project Structure

### Documentation (this feature)

```
kitty-specs/062-story-v4-quest-backbone/
├── plan.md              # Diese Datei
├── spec.md              # Spezifikation
├── research.md          # Phase 0 (diese Ausführung)
├── data-model.md        # Phase 1 (diese Ausführung)
├── quickstart.md        # Phase 1 (diese Ausführung)
├── contracts/           # Phase 1 (diese Ausführung) — Quest-Daten-Kontrakt
├── research/            # Quelldokumente (Story-Bibel v4, Migration v4, Dialog v1)
└── tasks/               # Phase 2 (/spec-kitty.tasks — NICHT hier erzeugt)
```

### Source Code (repository root)

```
js/
├── questSystem.js        # QUEST_DEFINITIONS (34), advanceAct-Register, Flag-Speicher (erweitert)
├── storySystem.js        # STORY_ACTS-Namen (Der Dienst / Treuer Diener / Das Doppelspiel / Die Enttarnung / Der Verrat und die Presse)
├── storage.js            # applySaveToState → versionierter Story-Reset beim Laden
├── player.js             # Boss-Mapping (kettenmeister/zeremonienmeister/schattenrat) — Ziel-IDs gegenpruefen
└── saveSlots.js          # SLOT_KEYS unveraendert (Story-Flags reisen im Haupt-Save mit)

tools/
└── genQuestDoc.js        # docs/QUESTS.md neu generieren

tests/
├── questSystem.test.js   # bestehende Quest-Tests anpassen + neue Akt-Trigger/Reset-Tests
└── loadGameModule.js     # Test-Loader (unveraendert)

docs/
└── QUESTS.md             # regeneriert

index.html                # ?v=-Cache-Buster fuer geaenderte JS-Dateien bumpen
```

**Structure Decision**: Single project, flache `js/`-Struktur (Spiel-Konvention). Das Feature ändert vor allem `js/questSystem.js` (Datenschicht) plus kleine Hooks in `storage.js` und ggf. `storySystem.js`; keine neuen Verzeichnisse, kein neues Modul (`questFlags.js` bewusst verworfen, siehe Summary).

## Phase 0 — Research

Siehe [research.md](research.md). Aufgelöste Unbekannte:
- Flag-Speicher: bestehenden `questSystem`-Store weiterverwenden statt `questFlags.js` (Entscheidung + Begründung).
- Altstand-Erkennung/Reset: `storyVersion` im Quest-Save-Blob, version-gated Reset in `loadQuestSaveData`.
- Reward-Feldnamen: Migration `reputation`/`knowledgeFragments` auf bestehende `factionStanding`/`fragments` abbilden.
- Dialog-Varianten: welche flag-abhängigen Textformen das bestehende Dialogsystem trägt (Funktion vs. String).
- „Genau vier Trigger"-Invariante: als Test verankern (fängt künftige Drift, wie sie zu #44 führte).

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md): Quest-Definition-Schema (v4-Felder), das Akt-Register als Datentabelle, die Backbone-Flag-Liste mit Herkunft, das `storyVersion`-Feld und die Reset-Regel.
- [contracts/quest-data-contract.md](contracts/quest-data-contract.md): die verbindliche Zuordnung aller 34 Quests (id, npcId, requiredAct, prerequisites, advanceAct, objective, gesetzte Flags) — abgeleitet aus Migration B/C, als prüfbarer Kontrakt für die Umsetzung und die Tests.
- [quickstart.md](quickstart.md): wie man das Rückgrat verifiziert (Test-Suite, Durchlauf der Akt-Leiter, Altstand-Reset, `docs/QUESTS.md`-Diff).
- Agent-Kontext: keine neue Technologie (bestehender JS/Phaser-Stack) — kein Update nötig.

**Re-Check Constitution nach Design:** unverändert konform (kein neues Modul, keine ES-Module, SlotStorage beibehalten).

## Complexity Tracking

*Keine Constitution-Verstöße — Tabelle leer.*

## Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Reihenfolge-/ID-Fehler zwischen Migration-Doc und realer `questSystem.js` (VERIFY-Hinweise) | Quest-Daten-Kontrakt (contracts/) als Single Source; Feldnamen einmal gegen Code abgleichen; Tests pro Trigger. |
| Doppelter Flag-Speicher (Drift wie beim Slot-Bug) | Bewusst KEIN `questFlags.js`; bestehenden Store nutzen. |
| Altstand-Reset trifft zu viel/zu wenig | `storyVersion`-Gate isoliert den Story-Blob; Charakter-State liegt außerhalb; Test mit Alt-Save-Fixture. |
| Rich-Dialog-Erwartung aus dem Dialog-Skript sprengt den Backbone-Scope | Scope-Grenze in Spec (Out of Scope) + Assumption: nur Texte, keine Auswahl-UI/Inszenierung. |
| `docs/QUESTS.md` driftet | Generator neu laufen lassen; im Akzeptanztest den lückenlosen Akt-Trigger prüfen. |
