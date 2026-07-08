# Specification: Room Objective Variety (Raum-Modi)

**Feature**: 061-room-objective-variety
**Created**: 2026-07-08
**Mission**: software-dev
**Tracker**: #61 (Design-Review) · verwandt: #12 (mehr Gegnertypen), #28 (Multiple Endings), #27 (Seasonal Modifiers)
**Branch contract**: planning on `main`, merges into `main`

## 0. Gelockte Design-Entscheidungen (verbindlich)

Aus der #61-Review + User-Entscheiden:

1. **Fehlschlag = Malus, KEIN harter Fail.** Wird ein Spezial-Ziel verfehlt (z. B. der zu verteidigende Altar zerstört, Survival-Ziel nicht gehalten), bleibt der Raum **passierbar** — aber es gibt **keinen Bonus-Chest**. Kein Game-Over, kein Rückwurf. (Konsistent mit dem fairen Roguelite-Tod: kein Loot-/Tiefen-Verlust.)
2. **Häufigkeit ~1–2 Spezialräume pro Run** (7–12 Räume), mit Tiefe **leicht steigend**. **Erster Raum immer `clear`** (sicherer Einstieg). **Boss-Räume = `clear`.** **Espionage-Räume behalten ihren eigenen Modus** (unangetastet).
3. **Erfolg → garantierter Bonus-Chest** je Spezialraum. Fehlschlag → kein Bonus-Chest (= der Malus aus #1).
4. **Steckbare „Room-Mode"-Schicht.** Der Default `clear` = **heutiges Verhalten, verlustfrei refaktoriert**. Neue Modi kommen additiv dazu.
5. **Modi in DIESEM Feature:** `clear` (bestehend), `survival`, `defend`, `hunt`. `escape` = **Stretch/optional** (WP06). Espionage bleibt ein **separates** System und wird nur als Architektur-Präzedenz genutzt, nicht umgebaut.

## 1. Overview

Der Kern-Gameplay-Loop ist heute **eine einzige Sache, 7–12× wiederholt**: Raum betreten → **eine** Gegner-Welle spawnt einmalig → alles töten → Treppe schaltet frei → nächster Raum. Es gibt **keine Raum-Ziel-Varianz** (nie „überlebe X Sekunden", „verteidige den Punkt", „töte das markierte Ziel"). Das ist laut Design-Review (#61) die größte Schwäche des Loops.

Dieses Feature führt eine **steckbare Room-Mode-Schicht** ein: Jeder Raum bekommt einen **Modus**, der Spawn-Verhalten, Sieg-/Abschluss-Bedingung, Treppen-Freischaltung und HUD kapselt. Das bestehende „Welle clearen" wird verlustfrei als `ClearMode` in dieses Interface refaktoriert (Default, kein Verhaltens-Unterschied). Darauf setzen **drei neue Modi** auf:

- **Survival** — überlebe X Sekunden gegen nachrückende Gegner; Treppe öffnet bei Timer-Ende.
- **Defend** — schütze ein zerstörbares Objekt (Altar/Relikt); Gegner steuern es an.
- **Hunt** — töte ein markiertes Ziel (Elite) im Gewühl; Kill schließt den Raum ab.

Die Modi werden pro Run **gewichtet zugewiesen** (~1–2/Run, tiefen-skaliert), wobei erster Raum, Boss-Räume und Espionage-Räume ausgenommen sind. Erfolgreicher Abschluss eines Spezialraums gibt einen **Bonus-Chest**; Verfehlen des Ziels ist ein reiner **Malus** (kein Bonus-Chest), kein Fail.

Die Engine kann raum-spezifisches Verhalten nachweislich (das Espionage-System überspringt bereits `startNextWave`) — dieses Feature **verallgemeinert** dieses Muster zu einer sauberen, testbaren Schicht.

## 2. Ziele / Non-Goals

**Ziele**
- Der Kern-Loop wird abwechslungsreich: nicht jeder Raum ist „Welle clearen".
- Eine **saubere, unit-testbare** Objektiv-Abstraktion (`RoomMode`), auf die künftige Modi billig aufsetzen.
- Verlustfreie Refaktorierung des Bestehenden (Default `clear` = identisches Verhalten).
- Spezialräume fühlen sich lohnend an (Bonus-Chest), nicht lästig (kein harter Fail).

**Non-Goals (dieses Feature)**
- Kein Umbau des Espionage-Systems (bleibt separat; nur Präzedenz).
- Keine neuen Gegnertypen (→ #12) und keine neuen Gegner-Mechaniken (separat).
- Keine Story-/Quest-Kopplung der Modi (Modi sind rein mechanische Raum-Varianz).
- Kein neues Belohnungs-/Loot-System (nutzt den bestehenden Chest-Reward-Pfad).
- `escape`-Modus nur als optionaler Stretch (WP06), nicht Pflicht.

## 3. Aktueller Stand (Code-Kontext)

- **`js/roomManager.js`**: `initDungeonRun()` stellt `window.dungeonRun.templateOrder[]` zusammen (Basis 7 + ⌊(depth−1)/5⌋, cap 12; Story-/Prozedural-/Espionage-Räume gemischt). `enterRoom(scene, roomId)` baut den Raum + startet die Welle. `markRoomCleared()` schaltet Treppe frei und vergibt bei Prozedural-Räumen einen Reward-Chest.
- **`js/wave.js`**: `startNextWave()` spawnt die Welle **einmalig** (Gegnerzahl = begehbare Fläche / 85000, min 4 max 28). `checkWaveEnd()` schaltet die Treppe frei, wenn alle tot **und** spawned ≥ total (2 s Halten).
- **Präzedenz**: `_espionageRoom` (roomManager) überspringt `startNextWave` und läuft ein eigenes Regime → Muster für modus-spezifisches Verhalten.
- **Kopplung**: Treppen-Freischaltung ist heute **hart** an Wave-Clear gebunden — muss für die Modi entkoppelt werden.
- **Reward-Chest**: bestehende Prozedural-Raum-Chest-Logik in `roomManager.js` (Basis für den Bonus-Chest).

## 4. Funktionale Anforderungen

- **FR-01 — RoomMode-Interface + Registry** (`js/roomModes.js`, IIFE → `window.RoomMode`): Jeder Modus implementiert `start(scene, ctx)`, `update(dt)`, `isComplete()`, optional `onFail()`, `getHud()`, `objectiveFailed()`. Registry mappt `modeId → factory`. Rein, unit-testbar (Vorbild `knowledgeTree.js`/`espionageSystem.js`).
- **FR-02 — ClearMode (Refaktor)**: Das heutige „Welle clearen + Treppe frei" wird 1:1 als `clear`-Modus über das Interface abgebildet. **Kein Verhaltens-Unterschied**, alle Bestandstests grün.
- **FR-03 — Entkopplung Treppe**: `enterRoom`/`checkWaveEnd` schalten die Treppe über `mode.isComplete()` frei, nicht mehr direkt über Wave-Clear.
- **FR-04 — SurvivalMode**: „Überlebe {seconds}s". Zeitgesteuerte, nachrückende Spawns; Treppe frei bei Timer-Ende; Timer-HUD.
- **FR-05 — DefendMode**: Zerstörbares Objekt mit HP; Gegner steuern es an; HUD zeigt Objekt-HP. Erfolg = Welle geclleart bei lebendem Objekt; Objekt zerstört = `objectiveFailed` (Raum trotzdem offen).
- **FR-06 — HuntMode**: Markiertes Ziel (Elite) unter Trash; Kill des Ziels = Abschluss (Trash egal); Ziel-Marker + HUD.
- **FR-07 — Modus-Zuweisung pro Run**: gewichtete Zuweisung in `initDungeonRun()`; ~1–2 Spezialräume/Run (tiefen-skaliert); **erster Raum = `clear`**, **Boss = `clear`**, **Espionage unangetastet**. Verteilung tunebar über Config.
- **FR-08 — Bonus-Chest**: Erfolgreicher Spezialraum-Abschluss (`!objectiveFailed`) → garantierter Bonus-Chest (besser als Normal-Raum). Verfehlt → kein Bonus-Chest.
- **FR-09 — Modus-Feedback**: Intro-Banner beim Betreten („Verteidige den Altar!"), einheitliches Modus-HUD (Ziel/Timer/Objekt-HP/Ziel-Marker), Erfolgs-/Malus-Anzeige. DE/EN-i18n.
- **FR-10 — Debug-Force-Hook**: URL-Param (z. B. `?mode=survival`) erzwingt einen Modus im ersten Dungeon-Raum zum Testen (Vorbild `?spy=1`). Im Normalbetrieb inaktiv.
- **FR-11 — (optional/Stretch) EscapeMode**: Ausgang unter Dauer-Druck/Zeit erreichen.

## 5. Nicht-funktionale Anforderungen

- **NFR-01 — Verlustfreiheit**: Mit ausschließlich `clear`-Räumen ist das Spiel **verhaltensidentisch** zu heute (alle Bestandstests grün).
- **NFR-02 — Testbarkeit**: `roomModes.js` + Auswahl-Logik sind **unit-testbar ohne Phaser** (reine Funktionen/Registry; Vorbild `espionageSystem.test.js`).
- **NFR-03 — Isolation**: Ein Modus darf den Game-Loop nie brechen (defensive try/catch an den Hooks, wie `EspionageSystem.update`).
- **NFR-04 — Performance**: `update(dt)` der Modi ist billig (keine Pro-Frame-Allokationen in Heißpfaden).
- **NFR-05 — Save-Kompatibilität**: additive Änderung; keine Save-Migration nötig (Modi sind run-scoped, nicht persistiert).

## 6. Work Packages (Überblick)

| WP | Titel | Abhängig von | Aufwand |
|----|-------|--------------|---------|
| **WP01** | RoomMode-Framework + ClearMode-Refaktor (verlustfrei) | — | M |
| **WP02** | SurvivalMode + Timed-Spawner + Debug-Force-Hook | WP01 | M |
| **WP03** | DefendMode (zerstörbares Objekt + Gegner-Targeting) | WP01 | M–L |
| **WP04** | HuntMode (markiertes Ziel) | WP01 | S–M |
| **WP05** | Run-Integration & gewichtete Modus-Auswahl + Bonus-Chest | WP01, WP02 | M |
| **WP06** | (optional) EscapeMode | WP01 | M |
| **WP07** | Politur: Intro-Banner, HUD, i18n, Belohnungs-/Balance-Tuning | WP02–WP05 | M |

**Reihenfolge (empfohlen):** WP01 → WP02 → WP05 (früh spielbar mit 1 Modus) → WP03 → WP04 → WP07 → (WP06). WP02–WP04 nach WP01 teils parallelisierbar (eigene Worktrees).

## 7. Akzeptanz / Testing

- **Bestand**: Alle vorhandenen Tests bleiben grün (NFR-01). `node tools/runTests.js`.
- **Unit**: `tests/roomModes.test.js` — Interface/Registry, ClearMode = altes Verhalten, Survival-Timer-Logik, Defend-Fail-Flag, Hunt-Abschluss, Auswahl-Verteilung (~1–2/Run, erster Raum `clear`, Boss/Espionage ausgenommen), Bonus-Chest nur bei `!objectiveFailed`.
- **Browser-Smoke** (Playwright, Muster wie `?spy=1`): pro Modus via `?mode=<id>` erzwingen → Raum lädt, Ziel/HUD korrekt, Abschluss schaltet Treppe frei, Bonus-Chest bei Erfolg, 0 Errors.
- **Akzeptanz-Kriterium Feature**: In einem echten Run tauchen ~1–2 Spezialräume auf (tiefen-skaliert), sie sind abschließbar, Erfolg gibt Bonus-Chest, Verfehlen ist folgenlos passierbar; Boss/Espionage/erster Raum unverändert.

## 8. Risiken & Offene Punkte

- **R1 — Gegner-Targeting eines Nicht-Spieler-Ziels (Defend)**: Die Gegner-KI zielt heute auf den Spieler. DefendMode braucht Gegner, die ein **Objekt** ansteuern → kleine AI-Erweiterung in `enemy.js`/`ai/steering.js`. In WP03 zu klären (Research-Punkt). Fallback: Objekt zieht Gegner via einfacher „move-to-point"-Override an.
- **R2 — Timed-Spawner (Survival)**: `wave.js` spawnt heute einmalig; Survival braucht nachrückende Spawns, ohne die Wave-Clear-Logik zu verwirren → sauber über den Modus kapseln, nicht in `checkWaveEnd` einhängen.
- **R3 — HUD-Konsistenz**: mehrere Modi brauchen unterschiedliche HUD-Elemente (Timer/Objekt-HP/Ziel-Marker) → ein einheitliches, modus-getriebenes HUD (WP07), damit es nicht auseinanderfranst.
- **R4 — Balance**: Häufigkeit + Bonus-Chest-Stärke + Survival-Dauer/Defend-Objekt-HP nach Playtest justieren (WP07).
