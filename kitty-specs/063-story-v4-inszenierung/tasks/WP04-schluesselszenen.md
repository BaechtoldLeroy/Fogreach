---
work_package_id: WP04
title: Schluesselszenen + observe-Trigger
dependencies: [WP02]
requirement_refs:
- FR-006
- FR-007
- FR-008
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 51754a1e82760bfd4a421df5f2d1ff21aad7ad9f
created_at: '2026-07-17T22:30:28.907321+00:00'
subtasks: [T016, T017, T018, T019, T020]
authoritative_surface: js/storyScenes.js
execution_mode: code_change
lane: planned
owned_files: [js/storyScenes.js, js/questSystem.js, tests/questSystem.test.js]
shell_pid: "27732"
agent: "claude"
---

# WP04 — Schlüsselszenen + observe-Trigger

## Objective
Die drei Schlüsselszenen als gespielte Beats in `js/storyScenes.js` (über die `DialogChoice`-Komponente aus WP02) und der **observe-Flip** in `js/questSystem.js`, der die beiden 062-Platzhalter durch echte Trigger ersetzt. Dieser WP besitzt `js/questSystem.js` (und den zugehörigen Test) **allein**.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP04 --base WP02` (nutzt DialogChoice).

## Kontext & Quellen
- **Szenen-Design:** [research/Fogreach_Story_v4.md](../../062-story-v4-quest-backbone/research/Fogreach_Story_v4.md) §13.1 (geheime Sitzung), §13.2 (Elara-Lager), §13.3 (Elaras erster Riss). Volltexte im [Dialog-Skript](../../062-story-v4-quest-backbone/research/Fogreach_Dialog_Skript_v1.md).
- **Komponente:** [contracts/dialog-ui-contract.md](../contracts/dialog-ui-contract.md) — `window.DialogChoice.present(scene, config)`.
- **questSystem (owned):** die Objectives `collusion_reveal_seen`/`three_hands_seen` sind in 062 als `dialogue`-Platzhalter angelegt; der bestehende observe-Trigger ist `updateQuestProgress('observe', target)`. Der 062-Trigger-Audit-Test steht in `tests/questSystem.test.js` (`062 T019 …`), inkl. „szenengebundene Reveals bleiben dialogue" — dieser Test wird hier umgestellt.
- **Muster Dungeon-NPC-/Szenen-Beats:** [[project_dungeon_npc_encounter]]; scrollFactor-Falle [[project_phaser_scrollfactor_dialogs]]; szenenübergreifende Zeit `Date.now()`.

## Projekt-Konventionen
- Classic Script IIFE, `window.storyScenes = { ... }`. ASCII in Flags/IDs.
- Szenen rendern über `DialogChoice.present` + einfache Tweens/Kamera (`scene.cameras.main.shake`, `scene.tweens`). Alle GameObjects `scrollFactor(0)`.

---

## Subtasks

### T016 — `storyScenes.js` + Geheime Sitzung (Zuhören-Leiste)
**Schritte:**
1. `js/storyScenes.js`: IIFE, `window.storyScenes = { playCollusionSession, playElaraFirstCrack, playElaraCamp }`.
2. `playCollusionSession(scene, onDone)`: zeigt die §13.1-Zeilen (drei legen die Farben ab, ein Blatt, drei Siegel) und eine **„Zuhören"-Fortschrittsleiste** (Tween über ~einige Sekunden; Balken-Grafik, `scrollFactor(0)`). Bei Abschluss: `window.questSystem.updateQuestProgress('observe', 'collusion_reveal_seen', 1)` feuern, dann Harrens Doppelspiel-Weiche (Skript-Zeilen) und `onDone()`.
3. Abbruch (Szene verlassen) darf den Trigger NICHT feuern (nur bei voller Leiste).
**Validierung:** Boot-Check (WP05): Leiste läuft, Quest wird erst danach abschließbar.

### T017 — observe-Flip in questSystem + Public-Setter + Audit-Test
**Schritte:**
1. In `js/questSystem.js` die Objectives von `collusion_reveal_seen` (Quest `council_collusion_reveal`) und `three_hands_seen` (Quest `elara_second_truth`) von `type:'dialogue'` auf `type:'observe'` umstellen (Ziel-target bleibt gleich). **Nur diese zwei** Objectives ändern — keine weitere Quest-Datenänderung, kein STORY_VERSION-Bump.
2. Public-Setter ergänzen: `setFlag(name)` (setzt `questFlags[name]=true`, ASCII-guard) und über `window.questSystem` exportieren — die DialogChoice-Komponente (WP02) nutzt ihn zur Laufzeit.
3. `tests/questSystem.test.js`: den 062-Audit anpassen — `observe`-Set um `collusion_reveal_seen`, `three_hands_seen` erweitern; den Test „szenengebundene Reveals bleiben dialogue" auf „… sind jetzt observe-verdrahtet" umstellen. Neuer kleiner Test für `setFlag`/`getFlags`.
**Validierung:** `node --check js/questSystem.js`; `node tools/runTests.js` grün; der Trigger-Audit bleibt scharf (kein uncompletable Objective).

### T018 — Elaras erster Riss
**Schritte:** `playElaraFirstCrack(scene, onDone)` inszeniert §13.3 (Bote, Elara faltet das Blatt weg, „Das kommt nicht in die Presse" / „Frag Dich, wem es nützt"). Bei Abschluss `updateQuestProgress('observe','three_hands_seen',1)` + `onDone()`. Optional eine `DialogChoice` („Es ist wahr." etc.).
**Validierung:** Szene feuert den observe-Trigger genau einmal am Ende.

### T019 — Elara-Lager (atmosphärisch)
**Schritte:** `playElaraCamp(scene, onDone)` inszeniert §13.2 (Elara legt das alte Werkzeug/Zeichen hin, „Das lag in Deiner alten Werkstatt …", „Ich habe Angst …"). **Kein** Objective-Trigger, kein Pflicht-Flag. Optionale `DialogChoice` mit Antwortzeilen. `onDone()` am Ende.
**Validierung:** Szene läuft ohne Quest-Seiteneffekt.

### T020 — Aufrufbare Einstiegspunkte
**Schritte:** Sicherstellen, dass alle drei `play*`-Funktionen eine einheitliche Signatur `(scene, onDone)` haben und robust sind, wenn `window.DialogChoice`/`window.questSystem` fehlen (defensiv, damit ein Teil-Build nicht crasht). WP05 ruft sie aus dem Hub.
**Validierung:** `node --check js/storyScenes.js`; Signaturen konsistent.

---

## Definition of Done
- Drei Szenen spielbar; geheime Sitzung + Elaras Riss feuern ihre `observe`-Trigger nur bei Abschluss.
- observe-Flip + `setFlag` in questSystem; `tests/questSystem.test.js` angepasst und grün; `node tools/runTests.js` grün.
- Kein STORY_VERSION-Bump; nur die zwei Platzhalter-Objectives geändert.

## Risiken & Reviewer-Hinweise
- **Owned-file-Disziplin:** WP04 ist der EINZIGE WP, der `js/questSystem.js` + `tests/questSystem.test.js` editiert.
- **Trigger nur bei Abschluss:** Reviewer prüft, dass Szenen-Abbruch keinen Progress leakt.
- **Audit bleibt grün:** die 062-Invariante (jedes Objective auslösbar) muss nach dem Flip weiter halten.

## Activity Log
- (leer bis implement)
- 2026-07-17T22:30:30Z – claude – shell_pid=27732 – lane=doing – Started implementation via workflow command
- 2026-07-17T22:33:00Z – claude – shell_pid=27732 – lane=for_review – 3 Szenen (Zuhoeren-Leiste feuert observe), Flip dialogue->observe, setFlag-Default true, Audit angepasst, Suite 533/0.
- 2026-07-17T22:33:05Z – claude – shell_pid=27732 – lane=approved – Selbst-Review.
- 2026-07-17T22:33:09Z – claude – shell_pid=27732 – lane=done – Moved to done
