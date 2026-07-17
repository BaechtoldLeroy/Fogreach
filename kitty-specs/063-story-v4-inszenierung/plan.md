# Implementation Plan: Story v4 — Inszenierung

**Branch**: `main` (Planungs-/Basis-Branch = Merge-Ziel = `main`, matches=true) | **Date**: 2026-07-17 | **Spec**: [spec.md](spec.md)
**Input**: [spec.md](spec.md) · Quellen: [research/](../062-story-v4-quest-backbone/research/) (Story v4 §10/§13, Dialog-Skript v1, Migration v4)

## Summary

Präsentationsschicht auf dem v4-Quest-Rückgrat (062): (1) eine wiederverwendbare Spieler-Auswahl-Komponente, die das bestehende `_showDialoguePages`-Modell in HubSceneV2 erweitert und Story-Flags setzt; darüber der volle Dialog-Pass aller `[Spieler: …]`-Auswahlen über Akt 0–4; (2) drei Schlüsselszenen (geheime Sitzung mit Zuhören-Leiste, Elaras erster Riss, Elara-Lager) mit echten `observe`-Triggern statt der 062-Platzhalter; (3) das Vier-Regler-Finale als reine `computeFinaleState(flags)`-Logik plus die `the_reckoning`-Inszenierung (Vatermord, Druck, Ausgangs-Präsentation).

**Parallelitäts-Strategie:** Zwei Kontrakte entkoppeln die Stränge — der **Dialog-UI-Kontrakt** (Auswahlkomponente) und der **Finale-Kontrakt** (`computeFinaleState`). Die reine Finale-Logik hat keine Abhängigkeit und startet sofort. Die Auswahlkomponente ist Fundament; sobald ihr Kontrakt steht, laufen Szenen, Finale-Inszenierung und der Dialog-Content-Pass (pro Akt aufteilbar) parallel dagegen.

## Technical Context

**Language/Version**: JavaScript ES2015+ als **Classic Scripts** (kein Modulsystem), Phaser 3.70 im Browser; Node 20+ nur für Tests/Tools.
**Primary Dependencies**: Phaser 3.70 (CDN), bestehendes `window.questSystem` (Flags via `getFlags`/`completionFlags`), `window.storySystem`, HubSceneV2 (`_showDialoguePages`), `window.SlotStorage`.
**Storage**: Story-Flags über `questSystem` (persistiert pro Slot via SlotStorage). Keine neue Persistenz-Struktur.
**Testing**: `node tools/runTests.js` (node:test); Module ohne DOM via `tests/loadGameModule.js`. Browser-Boot-Check nach [[browser-verification-phaser]]-Rezept.
**Target Platform**: GitHub Pages (statisch), Desktop + Mobile-Touch.
**Project Type**: single (Browser-Game, `js/` + `js/scenes/`).
**Performance Goals**: 60 fps im Hub-Dialog; kein wahrnehmbarer Ruckler beim Öffnen/Auswählen (NFR-006).
**Constraints**: Classic-Script (`window`-Globals, IIFE); ASCII in IDs/Flags, Umlaute im Fließtext; rekursive `scrollFactor`-Propagation für Overlays; `Date.now()` für szenenübergreifende Timestamps; additiv (kein STORY_VERSION-Bump).
**Scale/Scope**: 34 Quests, ~32 KB Dialog-Skript über 5 Akte; 1 neues Logikmodul (`questFinale.js`), 1 neue UI-Komponente, 3 Szenen.

## Constitution Check

*GATE:* Constitution-Governance meldet nur die bekannte Tool-Registry-Warnung (node/npm/phaser nicht registriert) — nicht blockierend, keine inhaltlichen Gates verletzt. Kanon (5 Akte, Nebel = Erinnerungslöschung, Ex-Archivschmied) ist mit dem Feature konsistent. **Pass.**

## Project Structure

### Documentation (this feature)
```
kitty-specs/063-story-v4-inszenierung/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dialog-ui-contract.md      # Auswahlkomponente-API (Parallelitäts-Enabler)
│   └── finale-contract.md         # computeFinaleState(flags) -> FinaleState
└── tasks.md                        # (spec-kitty.tasks)
```

### Source Code (repository root)
```
js/
├── dialogChoice.js        # NEU: wiederverwendbare Auswahl-Komponente (Classic Script, window.DialogChoice)
├── questFinale.js         # NEU: window.QuestFinale.computeFinaleState(flags) — reine Logik
├── storyScenes.js         # NEU: die drei Schlüsselszenen-Inszenierungen (Zuhören-Leiste, Riss, Lager) + Finale-Beats
├── storyDialog.js         # NEU: Datenbank der [Spieler: …]-Auswahlen aus dem Skript, pro Akt
├── scenes/HubSceneV2.js   # ERWEITERT: Auswahlkomponente in _showDialoguePages einhängen; Szenen-Aufrufe
├── questSystem.js         # ERWEITERT (minimal): collusion_reveal_seen/three_hands_seen von dialogue->observe
└── ...
tests/
├── questFinale.test.js    # NEU: computeFinaleState pro Regler + Default
└── dialogChoice.test.js   # NEU: Flag-Setzen/flag-abhängige Varianten (headless, soweit DOM-frei testbar)
index.html                  # ERWEITERT: <script>-Tags + Cache-Buster
```

**Structure Decision**: Single-Project. Neue Logik in eigenständige Classic-Script-Dateien (`window.*`), damit `computeFinaleState` und die Datenbanken DOM-frei testbar/ladbar sind; die UI-Anbindung erfolgt in HubSceneV2. Die Dateiaufteilung ist bewusst so gewählt, dass Work Packages **nicht-überlappende** owned_files bekommen (Logik ≠ UI-Komponente ≠ Content ≠ Szenen).

## Work-Package-Parallelität (Vorschlag für /spec-kitty.tasks)

| WP | owned_files (nicht überlappend) | Abhängigkeit | Parallel? |
|---|---|---|---|
| **Finale-Logik** | `js/questFinale.js`, `tests/questFinale.test.js` | keine | sofort, voll parallel |
| **Dialog-UI-Komponente** | `js/dialogChoice.js`, `tests/dialogChoice.test.js` | keine (liefert Kontrakt) | Fundament, früh |
| **Dialog-Content-Pass** | `js/storyDialog.js` | Dialog-UI-Kontrakt | parallel gegen Kontrakt; ggf. pro Akt splittbar |
| **Schlüsselszenen** | `js/storyScenes.js` (+ observe-Flip in questSystem.js) | Dialog-UI-Kontrakt | parallel gegen Kontrakt |
| **Integration/Finale-Inszenierung + Deploy** | `js/scenes/HubSceneV2.js`, `index.html` | alle | Integrations-WP zuletzt |

Genaue WP-Schnitte, owned_files-Konflikte (z. B. wer editiert `questSystem.js`) und die Deploy-/Doku-Zuständigkeit legt `/spec-kitty.tasks` fest. Der observe-Flip in `questSystem.js` (2 Zeilen) sollte genau EINEM WP gehören (Vorschlag: Schlüsselszenen-WP), um owned_files-Konflikte zu vermeiden.

## Complexity Tracking

*Keine Constitution-Verletzungen.* Einzige bewusste Zusatzkomplexität: mehrere neue Dateien statt einer, begründet durch die geforderte **Parallelität** (nicht-überlappende owned_files) und DOM-freie Testbarkeit der reinen Logik.
