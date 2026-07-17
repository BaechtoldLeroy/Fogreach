---
work_package_id: WP02
title: Story-Akte & Reset-Kopplung
dependencies: []
requirement_refs:
- FR-016
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: f2bf276064d1e3a9b717bfac5bcb4f9e26fffb9f
created_at: '2026-07-17T18:35:42.220389+00:00'
subtasks: [T008, T009, T010]
shell_pid: "29564"
agent: "claude"
history:
- 2026-07-17T17:13:33Z: Erstellt (spec-kitty.tasks).
authoritative_surface: js/storySystem.js
execution_mode: code_change
lane: planned
owned_files: [js/storySystem.js]
---

# WP02 — Story-Akte & Reset-Kopplung

## Objective

`js/storySystem.js` auf die v4-Akt-Namen setzen und den Reset-auf-Akt-0-Pfad bereitstellen, den WP01 beim `storyVersion`-Reset aufruft. Alte Referenzen auf die entfernten Akt-Indizes 5/6 bereinigen.

## Branch Strategy

- Planungs-/Basis-Branch: `main`. Merge-Ziel: `main`.
- Start: `spec-kitty implement WP02` (keine Abhängigkeiten; parallel zu WP01 möglich, da andere Datei).
- Integrationsgrenze zu WP01: die bestehende `advanceToAct`-API (WP01 ruft `advanceToAct(0)`).

## Kontext & Quellen

- **Datenmodell:** `kitty-specs/062-story-v4-quest-backbone/data-model.md` (Abschnitt 2, STORY_ACTS-Namen).
- **Story-Bibel:** `.../research/Fogreach_Story_v4.md` (Abschnitt 8, Akt-Struktur).
- Aktueller Stand: `STORY_ACTS` in `storySystem.js` trägt sieben Alt-Akte (auftrag/treuer_diener/erste_risse/wahrheit/bruch/rebellion/offenbarung) und ein totes `_computeActIndex`.

## Projekt-Konventionen

- Classic-Script, kein Modul-System. `storySystem.js` setzt `window.storySystem`.
- Fließtext-Namen mit Umlauten; interne ids ASCII.

---

## Subtasks

### T008 — STORY_ACTS v4-Namen
**Zweck:** Die Akt-Namen (Index 0–4) auf v4 setzen.
**Schritte:**
1. `STORY_ACTS` auf fünf Einträge (Index 0–4) mit den v4-Namen bringen:
   - `0` Der Dienst · `1` Treuer Diener · `2` Das Doppelspiel · `3` Die Enttarnung · `4` Der Verrat und die Presse.
2. `id`-Felder ASCII halten (z. B. `der_dienst`, `treuer_diener`, `das_doppelspiel`, `die_enttarnung`, `der_verrat`).
3. Alte `triggerWave`/`triggerQuests`-Felder, die zum toten `_computeActIndex` gehören, entfernen oder als bewusst ungenutzt markieren (siehe T010).
**Validierung:** `getCurrentActIndex`/Akt-Name-Lookups liefern für 0–4 die v4-Namen; kein Index 5/6 mehr referenziert.

### T009 — Reset-Pfad auf Akt 0
**Zweck:** WP01 muss den Story-Akt beim Altstand-Reset auf 0 bringen können.
**Schritte:**
1. Sicherstellen, dass `advanceToAct` monoton ist (bestehend) — für den Reset wird ein **expliziter** Weg auf 0 gebraucht. Entweder `advanceToAct(0)` erlaubt das Zurücksetzen auf 0 (Sonderfall), ODER einen kleinen Helfer `resetToAct0()` (bzw. `resetForNewStory()`) ergänzen und in `window.storySystem` exportieren.
2. Der Reset setzt den Akt-Index auf 0 und benachrichtigt etwaige Listener (HUD).
3. Defensiv dokumentieren, dass WP01 diesen Pfad beim `storyVersion`-Reset aufruft.
**Validierung:** Aufruf des Reset-Pfads bringt den Akt-Index nachweisbar auf 0.

### T010 — Alt-Index-Bereinigung
**Zweck:** Keine Referenz auf entfernte Akte.
**Schritte:**
1. `_computeActIndex` (totes Depth-basiertes Aufstiegs-Rechenwerk) entfernen oder inert lassen und dokumentieren, dass der Aufstieg rein quest-getrieben ist.
2. Nach Referenzen auf `rebellion`/`offenbarung`/Index 5/6 suchen und entfernen.
**Validierung:** `node --check js/storySystem.js` fehlerfrei; keine Referenz auf die Alt-Akte 5/6.

---

## Definition of Done

- `STORY_ACTS` trägt die fünf v4-Namen (0–4).
- Ein Reset-Pfad auf Akt 0 ist vorhanden und exportiert.
- Keine Referenzen auf entfernte Akte 5/6.
- `js/storySystem.js` lädt fehlerfrei.

## Risiken & Reviewer-Hinweise

- **Monotonie vs. Reset:** `advanceToAct` ist monoton (gleich/niedriger = no-op). Der Reset auf 0 MUSS trotzdem wirken — Reviewer prüft, dass der Reset-Pfad tatsächlich auf 0 setzt und nicht vom Monotonie-Guard verschluckt wird.
- Integrationsgrenze zu WP01 ist die exportierte Reset-Funktion — Signatur stabil halten.

## Activity Log

- 2026-07-17T18:35:43Z – claude – shell_pid=29564 – lane=doing – Started implementation via workflow command
- 2026-07-17T18:38:40Z – claude – shell_pid=29564 – lane=for_review – STORY_ACTS v4 (5 Akte), resetToAct0 exportiert, tote Helfer weg. Probe gruen.
- 2026-07-17T19:15:19Z – claude – shell_pid=29564 – lane=approved – Per Daten-Probe verifiziert (Selbst-Review).
