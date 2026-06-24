# Specification: Run-basierte Tiefen-Progression

**Feature**: 058-run-based-depth-progression
**Created**: 2026-06-24
**Mission**: software-dev
**Tracker**: #41 (Run-based depth progression)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Die Dungeon-**Tiefe** (`window.DUNGEON_DEPTH`) steigt heute **pro Raum**: bei
jedem Raumwechsel wird sie hochgezählt (`roomManager.js`, u.a. Z. 932/962/
1011/1143). Weil ein Run 7–12 Räume hat (`computeRunRoomCount`, Z. 98–101)
und Quests den Spieler „bis Tiefe 20/30/40" schicken (`questSystem.js`
Z. 428/539/577), klettert die Tiefe pro Sitzung dramatisch. Folge: nach
~2 Quests ist der Spieler Level ~15, alle Gegnertypen sind freigeschaltet,
Loot ist überstark — die Lernkurve kollabiert.

**Kern-Mechanik dieses Features:** Die Tiefe steigt **+1 pro erfolgreichem
Run** statt pro Raum. Ein kompletter Run läuft auf **fester Tiefe** ab
(innerhalb eines Runs ändert sich `DUNGEON_DEPTH` nicht mehr); ein
erfolgreich abgeschlossener Run erhöht die für den nächsten Run verfügbare
Tiefe (`demonfall_maxDepth` / `demonfall_lastDepth`) um **genau +1**.

Damit wird Tiefe wieder das Tempo-Ventil, das sie sein soll: linear, vom
Spieler nachvollziehbar, an „einen Run durchstehen" gekoppelt statt an
„viele Räume betreten".

**Abgrenzung:** Dieses Feature ändert **die Tiefe-pro-Run-Mechanik**. Die
weiteren Pacing-Hebel (Level-Kurve, Loot-iLevel-Dämpfung, Gegner-Roster-
Tempo) sind **sekundär / Out-of-scope** und unten klar als Folge-Hebel
markiert (überlappen mit #40).

## 2. Stakeholders & Actors

- **Spieler** — erlebt nach diesem Feature eine flachere, lineare Tiefen-
  Kurve: ein Run = eine Tiefe; Fortschritt nur durch das Durchstehen ganzer
  Runs.
- **Room-Manager** (`js/roomManager.js`) — Owner der Per-Raum-Tiefen-
  Inkrementierung (`enterRoom`, `onStairOverlap`, `markRoomCleared`).
  Hier wird das Increment entfernt und auf Run-Abschluss verlagert.
- **Persistence** (`js/persistence.js`) — KEYS `MAX_DEPTH`/`LAST_DEPTH`;
  Tracking der tiefsten/zuletzt gewählten Tiefe.
- **Hub „Der Hinabstieg"** (`js/scenes/HubSceneV2.js`,
  `_openWaveSelectDialog`) — Tiefen-Wahl-Dialog; muss zu „eine Tiefe pro
  Run" passen.
- **Quest-System** (`js/questSystem.js`) — `reach_wave`-Objektive (Tiefe
  20/30/40) und `dungeon_run`/`dungeon_complete` hängen an der alten
  Per-Raum-Wellen-Logik und müssen abgestimmt werden, sonst werden Quests
  uncompletable.

## 3. User Scenarios

### Primary A: Ein Run, eine feste Tiefe
1. Spieler startet bei „Der Hinabstieg" einen Run (z.B. auf Tiefe 6).
2. Er durchläuft alle 7–12 Räume des Runs. **`DUNGEON_DEPTH` bleibt während
   des gesamten Runs konstant 6** — Gegnerstärke, Loot-iLevel und
   Schwierigkeit skalieren run-konstant (Intra-Run-Varianz weiterhin über
   `roomDifficultyMult`, Z. 952–958, erlaubt — das ist Raum-Position, nicht
   Tiefe).
3. Spieler erreicht den letzten Raum / kehrt zum Hub zurück → der Run gilt
   als abgeschlossen.

### Primary B: Erfolgreicher Run → Tiefe +1
1. Run auf Tiefe 6 erfolgreich abgeschlossen (Definition s. Design-
   Entscheidung D1).
2. `maxDepth`/`lastDepth` werden um **genau +1** auf 7 erhöht — **einmalig
   pro Run**, nicht pro Raum.
3. Beim nächsten Hinabstieg ist Tiefe 7 die neue Grenze.

### Primary C: Abgebrochener / gescheiterter Run → keine Tiefe
1. Spieler stirbt oder verlässt den Run vor dem Abschluss-Kriterium.
2. Die Tiefe steigt **nicht**. `maxDepth` bleibt unverändert; der nächste
   Run startet höchstens auf der bisher erreichten Grenze.

### Edge: „Der Hinabstieg" weiterhin flacher wählbar
- Der Spieler darf weiterhin **flacher** starten (Vertraute Gänge / Gewohnter
  Abstieg). Tiefer als die erreichte Grenze geht nicht. Egal welche Tiefe
  gewählt wird: sie gilt **run-konstant** (kein Per-Raum-Klettern mehr).

## 4. Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | **Run-konstante Tiefe**: Innerhalb eines Runs ändert sich `window.DUNGEON_DEPTH` nicht. Das Per-Raum-Increment beim Raumwechsel (`roomManager.js` `onStairOverlap` Z. 1040–1047 via `NEXT_DUNGEON_DEPTH`/`SELECTED_WAVE_OVERRIDE`, und `markRoomCleared` Z. 1142–1144) wird entfernt/neutralisiert, sodass jeder Raum auf der Start-Tiefe des Runs läuft. | Draft |
| FR-02 | **+1 nur bei Run-Abschluss**: Genau bei Abschluss eines **erfolgreichen** Runs (Definition D1) wird die Tiefen-Grenze (`MAX_DEPTH`) um **genau +1** erhöht — einmalig pro Run, idempotent (kein Doppel-Increment bei mehrfachem `leaveDungeonForHub`-Aufruf). | Draft |
| FR-03 | **Kein Increment bei Abbruch/Tod**: Wird der Run abgebrochen (Portal vor Abschluss) oder endet mit Tod (`leaveDungeonForHub` reason `death`/`portal` ohne Abschluss), bleibt `MAX_DEPTH` unverändert. | Draft |
| FR-04 | **`lastDepth`-Konsistenz**: Die im Hinabstieg gewählte Start-Tiefe wird weiterhin als `LAST_DEPTH` persistiert (bestehend, `HubSceneV2.js` Z. 1890) und bestimmt die nächste Default-/Start-Tiefe, ohne dass sie während des Runs verändert wird. | Draft |
| FR-05 | **„Der Hinabstieg" run-konstant**: Der Tiefen-Wahl-Dialog (`_openWaveSelectDialog`, `HubSceneV2.js` Z. 1819 ff.) bleibt funktional (Optionen aus `maxDepth` abgeleitet), aber die gewählte Tiefe gilt run-konstant. Die gewählte Tiefe darf die erreichte Grenze (`maxDepth`) **nicht überschreiten** (Tiefer-als-Grenze ausgeschlossen). | Draft |
| FR-06 | **Quest-Tiefenvorgaben abstimmen**: Die `reach_wave`-Objektive „bis Tiefe 20/30/40" (`questSystem.js` Z. 428/539/577) müssen unter run-konstanter Tiefe completable bleiben — sie zählen jetzt **die run-konstante Tiefe** (Run auf/über Zieltiefe), nicht mehr ein Per-Raum-Hochklettern. Trigger gegen `onWaveCompleted`/`updateQuestProgress` auditieren (C-04). | Draft |
| FR-07 | **`dungeon_run`/`dungeon_complete` korrigieren**: Das Objektiv `thom_pamphlets` (`questSystem.js` Z. 500, Logik Z. 1085–1088) zählt heute **jede Welle** als Run-Abschluss („each wave completion past wave 1 counts as a run"). Es muss **genau einen** Increment **pro abgeschlossenem Run** zählen (Kopplung an denselben Run-Abschluss-Hook wie FR-02). | Draft |
| FR-08 | **Endless-Mode-Kohärenz**: Der Endless-Pfad (`roomManager.js` Z. 1009–1031, `endlessMode.js`) erhöht die Tiefe bewusst pro extra-Raum (Endless = endloser Abstieg). Run-konstante Tiefe gilt nur für den **regulären** Run; Endless behält seine eigene Tiefen-Eskalation (dokumentieren, nicht brechen). | Draft |
| FR-09 | **Save-Kompatibilität**: Bestehende Saves laden ohne Crash; ein Save mit altem (hohem) `maxDepth` wird respektiert (kein Reset/Wipe). Defensive Defaults (`DUNGEON_DEPTH`-Init in `main.js` Z. 1144–1148 bleibt funktional). | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-01 | Performance unverändert: 60fps Desktop, Mobile-Procroom ≥45 (053 nicht regredieren). | gemessen/Smoke |
| NFR-02 | Keine zusätzlichen Save-Schreibvorgänge pro Frame/Raum (Increment einmalig bei Abschluss, kein per-Raum-`localStorage.setItem`-Spam). | Code-Review |
| NFR-03 | Spürbar flachere Tiefen-/Level-Kurve im Frühspiel (nach 2 Quests nicht mehr Tiefe ~15). | Playtest |

## 6. Constraints

| ID | Constraint |
|----|------------|
| C-01 | Additiv/chirurgisch — bestehende Tiefen-/Depth-Infrastruktur (`DUNGEON_DEPTH`, `MAX_DEPTH`, `LAST_DEPTH`, Hinabstieg-Dialog) wiederverwenden; kein paralleles Depth-Runtime. |
| C-02 | Keine neuen Dependencies; Vanilla-JS + Phaser-built-ins; klassische `<script>`-Tags, kein Build. |
| C-03 | Bestehende Saves bleiben spielbar (additive/defensive Loads, kein Wipe von `MAX_DEPTH`). |
| C-04 | **Quest-Trigger-Audit** vor Ship: jede betroffene Quest gegen `updateQuestProgress(type, target)` / `onWaveCompleted` prüfen — broken Trigger = uncompletable Quest (bekannte Projekt-Falle). |
| C-05 | Endless-Mode-Tiefen-Eskalation NICHT brechen (eigener Pfad, FR-08). |

## 7. Success Criteria

| ID | Criterion |
|----|-----------|
| SC-01 | In einem regulären Run bleibt `window.DUNGEON_DEPTH` von Raum 1 bis zum letzten Raum **konstant** (Unit-Test + Smoke). |
| SC-02 | Ein erfolgreich abgeschlossener Run erhöht `MAX_DEPTH` um **genau 1** (Unit-Test). |
| SC-03 | Ein abgebrochener/gescheiterter Run erhöht `MAX_DEPTH` **nicht** (Unit-Test). |
| SC-04 | „Der Hinabstieg" startet Runs run-konstant; gewählte Tiefe ≤ `maxDepth`; flacher-starten weiterhin möglich. |
| SC-05 | Alle betroffenen Quests (`reach_wave` 20/30/40, `thom_pamphlets`) bleiben completable (Trigger-Audit grün). |
| SC-06 | Bestehende Saves laden fehlerfrei; kein `MAX_DEPTH`-Reset. |
| SC-07 | Endless-Mode behält seine Tiefen-Eskalation (kein Regression-Bruch). |
| SC-08 | `node tools/runTests.js` grün; Smoke `node tools/testGame.js` ohne neue Fehler. |

## 8. Offene Design-Entscheidungen

> **GELOCKT 2026-06-24 (User):** D1 = (a) „Letzten Raum erreicht"
> (`reason === 'dungeon_complete'`). D2 = (a) Strikt +1, flacher-wählen bleibt.
> Beide = empfohlener Default. Implementierung folgt diesen Entscheidungen.

### D1 — Was zählt als „erfolgreicher Run"?
**Optionen:**
- (a) **Letzten Raum erreicht** (regulärer Run-Abschluss → `onStairOverlap`
  Z. 1008 `nextIndex >= totalRooms` → `leaveDungeonForHub(reason:
  'dungeon_complete')`).
- (b) Boss/Final-Room besiegt (strenger).
- (c) Lebend zum Hub zurück (auch via Portal mitten im Run).

**Empfehlung: (a) „Letzten Raum erreicht" = `reason === 'dungeon_complete'`.**
Begründung: Es existiert bereits ein sauberer, eindeutiger Hook
(`leaveDungeonForHub` mit `reason: 'dungeon_complete'`, gesetzt in
`roomManager.js` Z. 1035). Tod (`reason: 'death'`) und freiwilliges
Portal-Verlassen (`reason: 'portal'`) zählen NICHT als Abschluss → kein
Tiefen-Gewinn. Das belohnt „den Run durchstehen" ohne einen separaten Boss-
Encounter zu erfordern.

### D2 — Strikt +1 oder weiterhin tiefer/flacher wählbar?
**Optionen:**
- (a) **Strikt +1**: maxDepth steigt nur durch Abschluss; der Spieler darf
  **flacher** starten (Hinabstieg-Optionen bleiben), aber niemals tiefer als
  `maxDepth`.
- (b) Wahl bleibt vollständig (auch tiefer „An die Grenze" = aktuelles
  Verhalten), aber run-konstant.

**Empfehlung: (a) Strikt +1, flacher-wählen bleibt.**
Begründung: Die Tiefe darf nur durch Können (Run-Abschluss) wachsen — das
ist der Kern des Pacing-Fixes. Flacher starten (Vertraute Gänge / Gewohnter
Abstieg) bleibt als Komfort/Grind-Option erhalten; „An die Grenze" = exakt
`maxDepth`. Damit bleibt der bestehende `_openWaveSelectDialog` weitgehend
unverändert (er leitet seine Optionen schon aus `maxDepth` ab) — es entfällt
lediglich das Per-Raum-Klettern.

## 9. Edge Cases

- **Mehrfacher `leaveDungeonForHub`-Aufruf** (z.B. death + cleanup): Increment
  muss idempotent sein (Run-Abschluss-Flag, kein Doppel-+1).
- **Save mit altem hohem `maxDepth`**: respektieren (nicht zurücksetzen); das
  Feature ändert nur das **Wachstum**, nicht die bereits erreichte Grenze.
- **Endless-Mode**: eigener Tiefen-Pfad — run-konstante Regel greift hier
  nicht (FR-08).
- **`reach_wave`-Quests** (Tiefe 20/30/40): unter run-konstanter Tiefe kann
  ein Run die Zieltiefe nicht mehr „durch Raum-Klettern" erreichen — die
  Tiefe ist run-konstant. Das Objektiv muss die **run-konstante Tiefe**
  zählen (Run auf ≥ Zieltiefe). Audit-Pflicht (C-04, FR-06).
- **`DUNGEON_DEPTH` undefined beim Boot**: Defensive Init in `main.js`
  (Z. 1144–1148) bleibt; Run-Start setzt Tiefe aus `lastDepth`/`maxDepth`.

## 10. Key Entities

| Entity | Description |
|--------|-------------|
| `window.DUNGEON_DEPTH` | Aktuelle Run-Tiefe — wird **run-konstant** (nicht mehr pro Raum erhöht). |
| `window.NEXT_DUNGEON_DEPTH` / `SELECTED_WAVE_OVERRIDE` | Heutige Vehikel der Per-Raum-Erhöhung — beim regulären Run-Übergang neutralisieren (FR-01). Bleiben für Run-Start (Hub) + Endless erhalten. |
| `js/roomManager.js` | `enterRoom`/`onStairOverlap`/`markRoomCleared` — Owner des Inkrements; Run-Abschluss-Hook. |
| `js/persistence.js` (`KEYS.MAX_DEPTH`/`LAST_DEPTH`) | Tiefen-Tracking; +1 bei Abschluss. |
| `js/scenes/HubSceneV2.js` (`_openWaveSelectDialog`) | Hinabstieg-Dialog; run-konstante Start-Tiefe. |
| `js/main.js` (`leaveDungeonForHub`) | Run-Abschluss-Hook (reason-basiert, D1). |
| `js/questSystem.js` | `reach_wave` (20/30/40) + `dungeon_run`/`dungeon_complete` abstimmen (FR-06/07). |

## 11. Assumptions

- `leaveDungeonForHub(reason)` ist der einzige saubere Run-Abschluss-Punkt;
  `reason: 'dungeon_complete'` markiert eindeutig den erfolgreichen Abschluss
  (in Research bestätigen).
- Das Entfernen des Per-Raum-Inkrements bricht keine Loot-/Gegner-Skalierung,
  weil diese `window.DUNGEON_DEPTH` lesen — run-konstant ist gewollt (Loot/
  Gegner skalieren run-konstant; Intra-Run-Varianz über `roomDifficultyMult`).
- `storySystem.onWaveCompleted` triggert keine Akt-Sprünge mehr aus Tiefe
  (depth-based act advancement ist bereits entfernt, `storySystem.js`
  Z. 602) — daher entstehen durch run-konstante Tiefe keine Story-Regression.

## 12. Out of Scope (Sekundäre Pacing-Hebel / Folge)

Diese Hebel adressieren dasselbe „zu schnell"-Problem, sind aber **nicht
Teil dieses Features** (eigene Folge-WP oder #40):

- **Steilere Level-Kurve** (`neededXP = 2*level` o.ä. in `main.js`/
  `player.js`) — separater Hebel, hier nur erwähnt.
- **Loot-iLevel dämpfen** (Loot wächst weniger steil mit der Tiefe).
- **Gegner-Roster langsamer freischalten** (überlappt #40).
- **Neue Boss-/Final-Room-Mechanik** als Abschluss-Kriterium (D1 nutzt den
  bestehenden „letzten Raum erreicht"-Hook; ein dedizierter Boss-Run ist
  Folge-Arbeit).
- **Endless-Mode-Rebalance** (Endless behält seine eigene Eskalation, FR-08).

## 13. Dependencies

- Feature „Der Hinabstieg" (Hinabstieg-Dialog + `MAX_DEPTH`/`LAST_DEPTH`)
  bereits im Code ✓.
- 053 (Mobile-Perf) ✓ — NFR-01 nicht regredieren.

## 14. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | **`reach_wave`-Quests werden uncompletable** (Tiefe klettert nicht mehr im Run). | FR-06: Objektiv auf run-konstante Tiefe umstellen; Trigger-Audit (C-04) Pflicht-Subtask. |
| R-02 | **Doppel-Increment** bei mehrfachem Hub-Return. | Idempotenter Abschluss-Flag (FR-02). |
| R-03 | **Endless-Mode bricht**, weil Per-Raum-Increment global entfernt wird. | FR-08: Endless-Pfad behält eigene Eskalation; Change nur am regulären Übergang. |
| R-04 | **Save-Migration** setzt `maxDepth` zurück. | C-03: kein Wipe; bestehendes `maxDepth` respektieren; Test mit Alt-Save. |
| R-05 | **Loot/Gegner zu flach**, weil Tiefe run-konstant → weniger Intra-Run-Steigerung. | `roomDifficultyMult` (Raum-Position) bleibt für Intra-Run-Varianz; bei Bedarf Tuning in Folge-WP. |

## 15. References

- Issue #41 — Run-based depth progression
- `js/roomManager.js` — `enterRoom` (Z. 919–934), `onStairOverlap` (Z. 1001–1051), `markRoomCleared` (Z. 1142–1151), `initDungeonRun` (Z. 141–174)
- `js/persistence.js` — `KEYS.MAX_DEPTH`/`LAST_DEPTH` (Z. 27–30)
- `js/scenes/HubSceneV2.js` — `_enterLocation`/`startDungeon` (Z. 1737–1791), `_openWaveSelectDialog` (Z. 1819–1896)
- `js/main.js` — `leaveDungeonForHub` (Z. 1689 ff.), `DUNGEON_DEPTH`-Init (Z. 1144–1148)
- `js/questSystem.js` — `reach_wave` (Z. 428/539/577), `dungeon_run`/`dungeon_complete` (Z. 500, 1085–1088), `onWaveCompleted` (Z. 1071–1095)
- `js/wave.js` — `checkWaveEnd`/`onWaveCompleted`-Fan-out (Z. 118–147)
- `js/endlessMode.js` — Endless-Tiefen-Reset (Z. 240–242)
