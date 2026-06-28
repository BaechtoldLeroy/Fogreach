# Implementation Plan: Skill-Baum-Progression (pure D2)

**Branch**: planning on `main` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)
**Input**: `kitty-specs/060-skill-tree-progression/spec.md` · Tracker #58 · Epic #59

## Summary

Ersetzt den passiven Ability-Auto-Unlock durch ein **pure-D2-Skill-Baum-System**:
Level-Up → 1 Skill-Punkt → in EINEN Baum investieren (Knoten = Abilities mit
Rängen, Voraussetzungen, Synergien). 4 aktive Slots bleiben. Respec jederzeit im
Hub gegen skalierendes Gold (Gold-Sink #51, dazu Schwarzmarkt-Aufwertung).
Knowledge Tree bleibt als separate passive Achse unangetastet.

Kern-Strategie: eine **pure, unit-testbare** Skill-Tree-Logik (analog
`knowledgeTree.js`), an die dünne, defensive Hooks andocken (Level-Up,
Combat-Effekt-Skalierung, Equip, UI). So bleibt die Mechanik testbar und der
Game-Loop unberührt.

## Technical Context

**Language/Version**: Vanilla JS (ES2017+), Phaser 3.70, klassische `<script>`-Tags, kein Bundler
**Primary Dependencies**: Phaser 3, bestehende Module `abilitySystem.js`, `knowledgeTree.js`, `lootSystem.js`, `player.js`, `main.js`, `ShopScene.js`
**Storage**: `localStorage` — `demonfall_abilities_v1` (erweitern) + Haupt-Save (`storage.js`)
**Testing**: `node tools/runTests.js` (node:test) für pure Module; `node tools/testGame.js --dungeon|--loadout` (Playwright-Smoke); gezielte Playwright-Repros unter `tools/` (löschen nach Verifikation)
**Target Platform**: Browser (Desktop + Mobile/Touch), GitHub Pages (`main` deployt live)
**Project Type**: single (Spiel-Frontend, `js/`)
**Performance Goals**: 60 fps; Skill-Tree-Logik nur bei Level-Up/Invest/Equip, nicht per Frame
**Constraints**: pure D2 (keine Karten), 1 Baum, 4 Slots fix, Respec=Gold, Knowledge Tree unangetastet, keine neue Währung, Save-Kompatibilität
**Scale/Scope**: ~9 aktive Abilities → Skill-Baum-Knoten + Synergien; 1 neuer Hub-Screen; 5 Work Packages

## Constitution Check

- **DE Quelle + EN i18n** für alle neuen Strings (UI, Tooltips). ✓ eingeplant (WP04/WP05).
- **Testbarkeit zuerst** (NFR-01): Foundation als pures Modul + Tests. ✓ WP01.
- **Kein Loop-Bruch** (NFR-02): defensive Hooks. ✓
- **Mobile** (NFR-03): slot-index-Layout + Touch-UI. ✓ WP03/WP04.
- **Save-Kompatibilität** (NFR-04): Migration + Tests. ✓ WP05.

Keine Verfassungs-Verletzungen → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)
```
kitty-specs/060-skill-tree-progression/
├── spec.md          # WAS (fertig)
├── plan.md          # Dieses Dokument (HOW + WP-Schnitt)
├── tasks.md         # via spec-kitty.tasks
└── tasks/
    ├── WP01-foundation-points-tree-model.md
    ├── WP02-rank-synergy-combat-effects.md
    ├── WP03-equip-slots-and-unlock-switch.md
    ├── WP04-hub-skill-tree-ui-respec.md
    └── WP05-economy-pacing-migration.md
```

### Source Code (repository root)
```
js/
├── skillTree.js          # NEU: pures, testbares Kernmodul (Punkte/Ränge/Prereqs/Synergien/Respec-Logik)
├── abilitySystem.js      # Auto-Unlock ablösen; Equip-Gating (>=1 Rang); tryActivate bleibt
├── player.js / main.js   # Level-Up -> +1 Skill-Punkt; Rang-/Synergie-Werte im Ability-Combat lesen; Level-Kurve steiler
├── scenes/
│   ├── SkillTreeScene.js # NEU: Hub-Skill-Baum-UI (ansehen/investieren/equippen/respec)
│   └── ShopScene.js      # Schwarzmarkt aufwerten (Gold-Sink #51)
├── storage.js / persistence.js  # skillPoints + ranks + slots speichern/laden + Migration
└── lootSystem.js         # getGold/spendGold für Respec-Kosten (bestehend)

tests/
├── skillTree.test.js     # NEU: Punkte/Ränge/Prereqs/Synergien/Respec/Migration
└── ...                   # ggf. Anpassungen bestehender ability/loadout-Tests
```

**Structure Decision**: Neues pures Modul `js/skillTree.js` (Vorbild
`knowledgeTree.js`) als Single-Source-of-Truth + dünne Hooks in den bestehenden
Phaser-Modulen. Hält die Logik unit-testbar (NFR-01) und den Game-Loop sauber.

## Phasen-Überblick (Work Packages)

| Phase | WP | Inhalt | FR | Abhängt von |
|---|---|---|---|---|
| 1 Foundation | **WP01** | `skillTree.js`: Datenmodell (1 Baum), `skillPoints`, Ränge, `investPoint` (Prereqs/Min-Level/Cap), `getSynergyValue`, `respec`-Logik (ohne Gold), Persistenz-Form + Tests. Level-Up → +1 Punkt. | FR-01, FR-02, FR-03, FR-11(Kern), NFR-01 | — |
| 2 Effekte | **WP02** | Abilities skalieren mit Rang (Schaden/Cooldown/Effekt) + Synergien; zentrale Lesestelle im Ability-Combat (`player.js`). | FR-04 | WP01 |
| 3 Equip/Erwerb | **WP03** | 4-Slot-Equip nur für Skills mit ≥1 Rang (Desktop + Mobile); `UNLOCK_RULES`-Auto-Learn ablösen → Knoten „verfügbar" statt auto-gelernt. | FR-05, FR-07 | WP01 |
| 4 UI | **WP04** | `SkillTreeScene`: Baum/Ränge/Prereqs/Synergien anzeigen, Punkte setzen, Slots equippen, **Respec-Button + Gold-Kosten**; i18n DE+EN; Mobile/scrollFactor. | FR-06, FR-08 | WP01–03 |
| 5 Economy/Pacing | **WP05** | Respec-**Gold**-Kosten skalierend (finalisieren) + **Maras Schwarzmarkt aufwerten** (#51) + **Level-Kurve steiler** (#41) + **Save-Migration** (Pre-060) + Save-Kompat-Tests. | FR-06, FR-09, FR-10, FR-11 | WP01, WP04 |

Reihenfolge / Merges: WP01 zuerst (Fundament). WP02 + WP03 hängen parallel an
WP01 (können nacheinander oder gestaffelt gemerged werden). WP04 braucht WP01–03.
WP05 zuletzt (Balancing/Migration/Economy), braucht WP01 + WP04.

## Offene Detail-Entscheidungen (in WP-Research/tasks zu fixieren)
- **Knoten-Topologie + Synergie-Paare** (welche Abilities, welche Voraussetzungen, welche Synergien) — Balance-Arbeit in WP01-Research/WP02.
- **maxRank pro Knoten** + Rang-Effekt-Kurven (gegen One-Skill-Dominanz, #45).
- **Respec-Gold-Formel** (z.B. `Basis * investierte_Punkte` oder `f(Level)`), tunebar.
- **Level-Kurven-Formel** (steiler als `2*level`), tunebar (#41).
- **Migrationsregel** Pre-060: gelernte Abilities → Rang 1 + „verbuchte" Punkte vs. voller Reset mit Gratis-Respec.

## Complexity Tracking

*Keine Constitution-Verletzungen — Tabelle leer.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |
