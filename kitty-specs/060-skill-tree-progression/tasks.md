# Tasks: Skill-Baum-Progression (pure D2)

**Feature**: 060-skill-tree-progression
**Generated**: 2026-06-28
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Tracker**: #58 · **Epic**: #59

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Foundation: `skillTree.js` (Punkte/Ränge/Prereqs/Synergie-Daten/Respec-Logik) + Level-Up-Hook + Tests | 7 (T001–T007) | ~320 | none | — |
| WP02 | Rang-/Synergie-Effekte im Combat | 5 (T008–T012) | ~220 | WP01 | mit WP03 |
| WP03 | 4-Slot-Equip (nur ≥1 Rang) + Auto-Unlock ablösen | 4 (T013–T016) | ~180 | WP01 | mit WP02 |
| WP04 | Hub-Skill-Baum-UI (`SkillTreeScene`) + Respec-Button | 5 (T017–T021) | ~420 | WP01–03 | — |
| WP05 | Economy (Respec-Gold + Schwarzmarkt #51) + Pacing (#41) + Persistenz/Migration | 6 (T022–T027) | ~300 | WP01, WP04 | — |

**Total**: 27 Subtasks über 5 WPs.

**Ship-Reihenfolge**: WP01 → (WP02 ∥ WP03) → WP04 → WP05. WP01 liefert das pure,
getestete Kernmodul + Level-Up-Punkt. WP02 (Effekte) und WP03 (Equip/Erwerb)
hängen beide nur an WP01 und können parallel laufen. WP04 (UI) braucht WP01–03.
WP05 (Economy/Pacing/Migration) zuletzt.

**Constitution-Gate** (`test-first`): Kernlogik (Punkte/Ränge/Prereqs/Synergien/
Respec, SC-01/02/03/05) als Unit-Tests in `tests/skillTree.test.js` VOR der
Implementierung. Save-Migration (FR-11/SC-07) Pflicht-Subtask in WP05.

---

## Phase 1 — Foundation
### WP01: `skillTree.js` + Punkte + Level-Up-Hook + Tests
**Goal**: Pures, testbares Kernmodul (Vorbild `knowledgeTree.js`): Datenmodell (1 Baum), Skill-Punkte, Ränge, Invest mit Voraussetzungen/Cap, Synergie-Werte, Respec-Logik (ohne Gold). Level-Up gibt +1 Punkt.
**Depends on**: none. **Requirements**: FR-01, FR-02, FR-03, FR-11 (Kern), NFR-01.

## Phase 2 — Effekte / Erwerb
### WP02: Rang-/Synergie-Effekte im Combat
**Goal**: Abilities skalieren mit Rang; Synergien wirken; zentrale Lesestelle im Ability-Combat.
**Depends on**: WP01. **Requirements**: FR-04, SC-03.

### WP03: 4-Slot-Equip + Auto-Unlock ablösen
**Goal**: Nur Skills mit ≥1 Rang equippbar (Desktop+Mobile); `UNLOCK_RULES`-Auto-Learn entfällt → Knoten „verfügbar".
**Depends on**: WP01. **Requirements**: FR-05, FR-07, SC-04.

## Phase 3 — UI
### WP04: Hub-Skill-Baum-UI + Respec
**Goal**: `SkillTreeScene` (ansehen/investieren/equippen/respec), i18n, Mobile.
**Depends on**: WP01–03. **Requirements**: FR-06, FR-08.

## Phase 4 — Economy / Pacing / Migration
### WP05: Respec-Gold + Schwarzmarkt + Pacing + Persistenz/Migration
**Goal**: Skalierende Respec-Gold-Kosten, Maras Schwarzmarkt aufwerten (#51), Level-Kurve steiler (#41), Save-Persistenz + Pre-060-Migration + Save-Kompat-Tests.
**Depends on**: WP01, WP04. **Requirements**: FR-06, FR-09, FR-10, FR-11.
