---
work_package_id: WP04
title: Doku, Doku-Generator & Deploy
dependencies:
- WP01
- WP02
requirement_refs:
- FR-019
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1b81e3f6351abf0f124c10f60206789d9193ada5
created_at: '2026-07-17T19:35:10.584916+00:00'
subtasks: [T016, T017, T018]
shell_pid: "32008"
agent: "claude"
history:
- 2026-07-17T17:13:33Z: Erstellt (spec-kitty.tasks).
authoritative_surface: tools/genQuestDoc.js
execution_mode: code_change
lane: planned
owned_files: [tools/genQuestDoc.js, docs/QUESTS.md, index.html]
---

# WP04 — Doku, Doku-Generator & Deploy

## Objective

Den Quest-Doku-Generator an die v4-Aktnamen anpassen, `docs/QUESTS.md` neu erzeugen und die Auslieferung vorbereiten (Cache-Buster). Danach zeigt die Doku für Akt 1–4 je einen Trigger — der sichtbare Beleg, dass #44 geschlossen ist.

## Branch Strategy

- Planungs-/Basis-Branch: `main`. Merge-Ziel: `main`.
- Abhängig von WP01 und WP02. Start: `spec-kitty implement WP04 --base WP01` (bzw. auf die integrierte Basis von WP01+WP02).

## Kontext & Quellen

- Generator: `tools/genQuestDoc.js` — liest die echten `QUEST_DEFINITIONS` (`global.window = {}; require('js/questSystem.js')`), enthält u. a. ein `ACTS`-Array mit den Aktnamen und leitet die Akt-Register-Tabelle aus `advanceAct` ab.
- Ausführung im Projekt: `node tools/genQuestDoc.js` schreibt `docs/QUESTS.md`.
- Deploy-Ritual: `?v=`-Cache-Buster pro geänderter JS-Datei in `index.html`; Pages-Deploy laggt 1–4 min.

## Projekt-Konventionen

- ASCII in Code; Umlaute im generierten Fließtext ok.
- Cache-Buster: bestehende `?v=NNN` hochzählen; neue Datei bräuchte einen `<script>`-Tag (hier keine neue JS-Datei).

---

## Subtasks

### T016 — Generator an v4-Aktnamen anpassen
**Schritte:**
1. Im `ACTS`-Array von `tools/genQuestDoc.js` die Aktnamen auf v4 setzen (Der Dienst, Treuer Diener, Das Doppelspiel, Die Enttarnung, Der Verrat und die Presse). Das Array darf nur noch die fünf gültigen Akte abbilden.
2. Prüfen, dass die aus `advanceAct` abgeleitete Register-Tabelle mit den neuen vier Triggern zurechtkommt (die „Lücken"-Ableitung sollte für Akt 1–4 jetzt keine Lücke mehr melden).
3. NPC-Namens-Map im Generator prüfen (klerus_priester/stadtwache müssen weiterhin auflösen).
**Validierung:** `node tools/genQuestDoc.js` läuft fehlerfrei durch.

### T017 — docs/QUESTS.md regenerieren
**Schritte:**
1. Generator laufen lassen; `docs/QUESTS.md` committen.
2. Sichtprüfung: die Akt-Register-Tabelle zeigt für Akt 1–4 je eine Trigger-Quest; „Bekannte Lücken" nennt Akt 1–4 NICHT mehr (idealerweise gar keine Lücke mehr, da 5/6 entfallen).
**Validierung:** Register lückenlos für 1–4; 34 Quests im Dokument.

### T018 — Cache-Buster bumpen + Boot-Check
**Schritte:**
1. In `index.html` die `?v=`-Version für jede geänderte JS-Datei hochzählen: `js/questSystem.js`, `js/storySystem.js` (WP01/WP02) sowie `js/loot.js`, `js/espionageSystem.js` (WP05).
2. Prüfen, dass keine geänderte JS-Datei den Bump vergisst.
3. **Boot-Check (NFR-004):** Spiel lokal starten, Konsole prüfen — fehlerfreier Boot, kein Fehler beim Laden alter Stände oder beim Durchlaufen der Akt-Leiter.
**Validierung:** `index.html` referenziert die neuen Versionen; Boot-Konsole fehlerfrei.

---

## Definition of Done

- `tools/genQuestDoc.js` erzeugt `docs/QUESTS.md` ohne Fehler mit v4-Aktnamen.
- `docs/QUESTS.md` zeigt ein lückenloses Akt-Register für 1–4.
- Cache-Buster in `index.html` für `questSystem.js` und `storySystem.js` gebumpt.

## Risiken & Reviewer-Hinweise

- **Generator-Absturz** bei geänderter Struktur: der Generator `require`t `questSystem.js` in einer Node-Umgebung — wenn WP01 versehentlich Browser-only-Globals im Modul-Top-Level nutzt, bricht der Generator. Reviewer prüft, dass `genQuestDoc` durchläuft.
- Cache-Buster ist leicht zu vergessen — Reviewer gleicht die in WP01/WP02 geänderten Dateien mit den Bumps ab.
- Dieses WP ändert KEINE Spiel-Logik; es macht die WP01/WP02-Ergebnisse sichtbar/deploybar.

## Activity Log

- 2026-07-17T19:35:11Z – claude – shell_pid=32008 – lane=doing – Started implementation via workflow command
