---
work_package_id: WP03
title: Dialog-Content-Pass (storyDialog)
dependencies: []
requirement_refs:
- FR-004
- FR-005
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: d74285cb71b78800d07b31e71ab4160d7c8d74a3
created_at: '2026-07-17T22:26:53.325756+00:00'
subtasks: [T011, T012, T013, T014, T015]
authoritative_surface: js/storyDialog.js
execution_mode: code_change
lane: planned
owned_files: [js/storyDialog.js]
shell_pid: "8608"
agent: "claude"
---

# WP03 — Dialog-Content-Pass (`storyDialog`)

## Objective
Eine reine **Daten**-Datei `js/storyDialog.js`, die alle `[Spieler: …]`-Auswahlen des Dialog-Skripts v1 über **Akt 0–4** in den Datenformen des [dialog-ui-contract](../contracts/dialog-ui-contract.md) abbildet. Kontrakt-getrieben, deshalb ohne Build-Dependency (parallel zu WP02 baubar). WP05 hängt diese Daten in die Dialoge ein.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP03`.

## Kontext & Quellen
- **Skript (verbindliche Textquelle):** [research/Fogreach_Dialog_Skript_v1.md](../../062-story-v4-quest-backbone/research/Fogreach_Dialog_Skript_v1.md). Legende: `[Spieler: …]` → wählbare Option; `{flag}` → zu setzender Flag; flag-abhängige Zeilen → Varianten.
- **Datenformen:** [contracts/dialog-ui-contract.md](../contracts/dialog-ui-contract.md) (DialogChoice: `label`, `response?`, `setFlags?`, `showIf?`).
- **Flag-Abgleich:** [contracts/finale-contract.md](../contracts/finale-contract.md) — die dort gelisteten Flags MÜSSEN von genau einer Content-Stelle gesetzt werden.

## Projekt-Konventionen
- Classic Script IIFE, `window.storyDialog = { ... }`. Reine Daten (keine Phaser-/DOM-Nutzung), damit `node --check` und ein Struktur-Test genügen.
- ASCII in Flags/IDs; Umlaute in gesprochenen/Anzeige-Texten ok.
- `showIf` als kleine reine Funktion `function(flags){ return ... }`.

## Struktur (Vorschlag)
```
window.storyDialog = {
  byQuest: {
    magistrat_verification: {
      prompt: 'ALDRIC: ...',
      choices: [
        { label: 'Siegel setzen', setFlags: ['verification_sealed'], response: 'ALDRIC: Der Magistrat dankt Dir.' },
        { label: 'Verweigern', setFlags: ['verification_refused'], response: 'ALDRIC: Ein Handwerker mit Gewissen. Ich merke mir das.' }
      ]
    },
    council_seizure: { choices: [
      { label: 'Abgeben', setFlags: ['petitions_surrendered'] },
      { label: 'Heimlich behalten', setFlags: ['petitions_kept'] }
    ]},
    ...
  }
}
```

---

## Subtasks

### T011 — Akt 0/1
**Schritte:** Auswahlen aus dem Skript für Akt 0 (Hub-Einstieg Branka, `resistance_fetch_01`, `aldric_cleanup`, `aldric_patrol`, `harren_daughter_investigation`) und Akt 1 (`magistrat_verification` → `verification_sealed`/`verification_refused`, `faction_campaign`, die Fraktions-Sticheleien, Bürger-Szene `truth_told`).
**Validierung:** `node --check`; `magistrat_verification` hat beide Siegel-Optionen mit den korrekten Flags.

### T012 — Akt 2
**Schritte:** `council_seizure` (`petitions_surrendered`/`petitions_kept`), `council_surveillance`, `klerus_district_purge`, `mara_contact`, `branka_doubt`/`branka_transcripts` (setzt `branka_ally` an der thematisch passenden Vertrauensstelle), `espionage_convoy`.
**Validierung:** `branka_ally` wird an genau einer Stelle gesetzt; `petitions_*` exklusiv.

### T013 — Akt 3
**Schritte:** `verseuchte_kammer`, `garde_night_escort`, `espionage_archive`, `espionage_informant`, `thom_truth` (setzt `thom_ally`), `elara_ritual`/`elara_blade`, `who_you_were`. (`three_hands_seen` und `collusion_reveal_seen` NICHT hier — die setzen die Szenen in WP04.)
**Validierung:** `thom_ally` an genau einer Stelle; keine Dopplung mit Szenen-Flags.

### T014 — Akt 4
**Schritte:** `branka_weapons`, `thom_pamphlets`, `mara_assault` (optional), `the_reckoning` (`press_decision` — die Entscheidungs-Auswahl; die eigentliche Ausgangs-Berechnung macht WP01/WP05, hier nur die Dialog-Optionen).
**Validierung:** `the_reckoning` bietet die im Skript §13.4 vorgesehenen Spieler-Optionen.

### T015 — Flag-Abgleich gegen finale-contract
**Schritte:**
1. Tabellenabgleich: jeder in [finale-contract](../contracts/finale-contract.md) gelesene Flag (`verification_refused`, `petitions_kept`, `petitions_surrendered`, `branka_ally`, `thom_ally`, optional `convoy_blown`) hat **genau einen** Setzer in `storyDialog`.
2. `mole_evidence`/`self_remembered`/`elara_trust` kommen aus 062-Quests (nicht hier setzen) — nur verifizieren, dass Content sie nicht doppelt setzt.
3. Kurzer Struktur-Selbstcheck (Kommentar/Notiz): jede Choice hat ein `label`.
**Validierung:** `node -e "global.window={};require('./js/storyDialog.js'); /* iterate byQuest, assert every choice has label, collect setFlags */"` läuft ohne Fehler und listet die gesetzten Flags.

---

## Definition of Done
- `js/storyDialog.js` bildet die Skript-Auswahlen über alle Akte ab; alle finale-relevanten Flags haben genau einen Setzer.
- `node --check js/storyDialog.js` ok; `node tools/runTests.js` bleibt grün.

## Risiken & Reviewer-Hinweise
- **Flag-Dopplung/-Lücke:** Reviewer gleicht die gesetzten Flags mit der finale-contract-Tabelle ab (genau ein Setzer je Flag).
- Reine Daten — keine Phaser-/questSystem-Aufrufe in dieser Datei (die macht WP05 beim Einhängen).
- WP03 editiert keine fremden owned_files.

## Activity Log
- (leer bis implement)
- 2026-07-17T22:26:54Z – claude – shell_pid=8608 – lane=doing – Started implementation via workflow command
- 2026-07-17T22:30:00Z – claude – shell_pid=8608 – lane=for_review – 38 Auswahlen ueber alle Akte, finale-Flags verdrahtet (branka_ally/thom_ally an who_you_were/thom_truth).
- 2026-07-17T22:30:04Z – claude – shell_pid=8608 – lane=approved – Selbst-Review: Struktur-Check gruen.
- 2026-07-17T22:30:08Z – claude – shell_pid=8608 – lane=done – Moved to done
