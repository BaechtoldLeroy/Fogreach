# Feature-Spezifikation: Debug-Gate

**Feature**: 069-debug-gate
**Mission**: software-dev
**Status**: Draft (Vorschlag — nicht mit dem Projektinhaber abgestimmt)
**Quelle**: GitHub-Issue #88 — „Release: Debug-Oberflächen hinter ein Gate legen (Settings-Cheats, Fehler-Overlay, URL-Flags)"
**Branch-Kontrakt**: Planning/Base-Branch `main`; fertige Änderungen mergen nach `main`.

> **Hinweis zum Zustandekommen**: Die im `/spec-kitty.specify`-Ablauf vorgesehene
> Befragung des Projektinhabers konnte nicht stattfinden. Alle Festlegungen sind
> aus Issue #88 und aus dem Quelltext abgeleitet. Jede nicht durch Issue oder Code
> belegte Festlegung steht im Abschnitt **Annahmen**; echte Lücken stehen unter
> **Offene Fragen**. Vor `/spec-kitty.plan` sollten Annahmen und offene Fragen
> bestätigt werden.

---

## Motivation

Der ausgelieferte Live-Build enthält Entwickler-Oberflächen, die normale Spieler
sehen und auslösen können: eine DEBUG-Sektion mitten im Einstellungsmenü (inkl.
Material-Cheat), ein dauerhaft aktives Fehler-Overlay mit rohen JS-Stacktraces und
eine Reihe von URL-Flags, die Spielstand-relevante Aktionen auslösen. Das ist der
sichtbarste „Prototyp-Geruch" am sonst sauberen Projekt.

Die Werkzeuge selbst sind nachweislich nützlich (die Nebel-Performance-Analyse lief
komplett über `?perf=1`, die Bot-Kampagne über `?dungeon=N` / `?autostart=1`). Ziel
ist deshalb **nicht Entfernen, sondern Verstecken hinter einem bewussten Schalter**.

**Zentrale Einschränkung**: Die Auslieferung erfolgt über GitHub Pages direkt aus
`main`. Es gibt **keinen Build-Schritt**, der Entwicklercode entfernen könnte, und
kein Bundling/Minifying. Alle Skripte sind klassische `<script>`-Dateien mit
window-Globalen. Ein Gate kann daher **ausschliesslich zur Laufzeit** wirken — es
ist eine Sichtbarkeits- und Bequemlichkeitsschranke, **keine Sicherheitsgrenze**
(siehe C-005).

---

## Bestandsaufnahme: alle gefundenen Debug-Zugänge

Systematisch erhoben über `window.location.search`/`URLSearchParams`, `window.__`-Globale,
Tastenbindungen, Overlays und Konsolenausgaben. Zeilennummern zum Stand des Branches
`spec/issue-88` (GAME_VERSION `2026-09-01 · b109`).

### A. URL-Flags (alle im ausgelieferten Build wirksam)

| # | Flag | Fundstelle | Wirkung | Spielstand-relevant |
|---|------|-----------|---------|---------------------|
| A-01 | `?dungeon=N` | `js/scenes/startScene.js:314-324`, Konsum in `js/scenes/HubSceneV2.js:466-468` | Direkteinstieg in Dungeon-Tiefe N über `window.__DEBUG_AUTO_DESCEND__` | **Ja** — ruft `clearSave()` (`startScene.js:317`) |
| A-02 | `?autostart=1` | `js/scenes/startScene.js:334-343` | Menü überspringen, frisches Spiel | **Ja** — ruft `clearSave()` (`startScene.js:335`) |
| A-03 | `?perf=1` | `js/perfProbe.js:27-28` (Gate), Overlay `js/perfProbe.js:54-120` | FPS-/Draw-Call-Overlay, DUMP-Button (Report in die Zwischenablage), Live-Toggles | Nein |
| A-04 | `?nofog=1`, `?nomask=1`, `?nospot=1`, `?noexpl=1` | `js/perfProbe.js:43-46` | Nebel-/Masken-/Spot-/Explored-Subsysteme abschalten | Nein (nur zusammen mit A-03) |
| A-05 | `?explRes=`, `?fogInterval=`, `?rays=` | `js/perfProbe.js:39, 48-50` | Numerische Live-Tuner für den Nebel | Nein (nur zusammen mit A-03) |
| A-06 | `?spy=1` | `js/roomManager.js:2505-2510`, genutzt `js/roomManager.js:430` und `:2530` | Erzwingt Spionage-Raum als ersten Dungeon-Raum **und umgeht das Quest-Gating** | Indirekt (Quest-Zustand) |
| A-07 | `?roomsize=1` | `js/roomManager.js:376-388` | Loggt jede gerollte Raumgrösse + Bucket-Verteilung in die Konsole | Nein |
| A-08 | `?mode=<id>` | `js/roomModes.js:65-74` | Erzwingt einen Raum-Modus im ersten Dungeon-Raum | Nein |
| A-09 | `?hubdebug=1` | `js/scenes/HubSceneV2.js:109-112`, genutzt `:619`, `:662`, `:825`; Kommentar `js/scenes/hub/hubLayout.js:107` | Collider-Overlay über allen Hub-Hitboxen | Nein |

### B. Einstellungen mit Cheat-Wirkung

| # | Zugang | Fundstelle | Wirkung |
|---|--------|-----------|---------|
| B-01 | DEBUG-Sektion im Einstellungsmenü, bedingungslos gerendert | `js/scenes/SettingsScene.js:304` (Label), Texte `:15`, `:33-36`, `:51`, `:69-72` | Sichtbar im normalen Spiel; erreichbar per Taste `O` (`js/main.js:1141`) und über das HUD-Menü (`js/hudV2.js:536-538`) — also auch auf Mobile |
| B-02 | Umschalter „Auto-Start" | `js/scenes/SettingsScene.js:305`; gelesen `js/scenes/startScene.js:329-333` | Persistiert `debug.autostart`; **löscht bei jedem Start den Spielstand** (`clearSave()`, `startScene.js:335`) |
| B-03 | Umschalter „Kein Nebel" | `js/scenes/SettingsScene.js:306`, setzt `window.__DEBUG_NO_FOW__` in `:144` | **Toter Schalter** — `__DEBUG_NO_FOW__` hat im gesamten `js/`-Baum keinen Leser (einziger Treffer ist die Zuweisung selbst) |
| B-04 | Schaltfläche „+100 Eisenbrocken" | `js/scenes/SettingsScene.js:307-312` | Ruft `window.changeMaterialCount('MAT', 100)` — reiner Material-Cheat, spielstandsrelevant |

### C. Fehler-Overlays und Diagnoseanzeigen

| # | Zugang | Fundstelle | Wirkung |
|---|--------|-----------|---------|
| C-01 | Mobile-Fehler-Overlay | `index.html:11-55` (Inline-Skript, läuft als erstes) | Fängt `error` + `unhandledrejection`, zeigt **rohe Stacktraces auf rotem Grund** über dem Spiel; exportiert `window.__showError` (`index.html:53`) |
| C-02 | Zweiter globaler Fehler-Logger | `js/main.js:151-165` (`window.__GLOBAL_ERROR_LOGGER__`) | Schreibt `[GlobalError]` inkl. vollständigem Stack in die Konsole |
| C-03 | Performance-Overlay (`PerformanceMonitor`) | `js/performanceMonitor.js` gesamt; Overlay-Aufbau `:379-404`, Umschaltung `:462-478`, Text `:449` („Press P to toggle this overlay") | FPS, Speicher, Texturspeicher, Timings; **englischer Text**, verletzt die Projektsprache |
| C-04 | Perf-Probe-Overlay + DUMP + Live-Toggles | `js/perfProbe.js:54-120` | Nur mit A-03 aktiv; kopiert einen JSON-Report in die Zwischenablage |
| C-05 | Spieler-Collider-Zeichnung | `js/player.js:11` (`DEBUG_PLAYER_COLLIDER = false`), `:653-668`; Export `js/player.js:860-861` | Konstante ist `false`; `window.DEBUG_PLAYER_COLLIDER` ist gesetzt, wird aber vom Modul nicht gelesen → derzeit inert, `window.updatePlayerColliderDebug` bleibt aufrufbar |
| C-06 | `TestTerrainScene` | `js/scenes/TestTerrainScene.js` gesamt; **in der Live-Szenenliste** `js/main.js:114`; geladen in `index.html:177` | Terrain-Vergleichs-Spielwiese; startbar über `window.gotoTestTerrainScene()` (`js/main.js:141-145`) |

### D. Tastenkürzel und Menüeinträge

| # | Zugang | Fundstelle | Wirkung |
|---|--------|-----------|---------|
| D-01 | Taste `P` | `js/main.js:1145-1152` | Schaltet das Performance-Overlay (C-03) um — **im Issue nicht erwähnt** |
| D-02 | Menüpunkt „FPS Overlay" im HUD-Menü | `js/hudV2.js:539-546` | Gleiches Overlay, per Maus/Touch erreichbar — **der einzige Debug-Zugang, den ein Mobile-Spieler ohne URL-Flag erreicht**; Label ist unübersetztes Englisch |
| D-03 | Taste `F11` (Vollbild) | `js/main.js:1079-1086` | Kein Debug-Zugang — nur zur Vollständigkeit gelistet, **wird nicht gegated** |

Die übrigen Tasten (`I`, `ESC`, `M`, `K`, `T`, `O`, `J`, `F`, Bewegung/Fähigkeiten in
`js/inputScheme.js:60-77`) sind reguläre Spielfunktionen und schalten nichts frei.

### E. `window.__`-Globale, von aussen (DevTools/Konsole) setzbar

| # | Global | Fundstelle | Einordnung |
|---|--------|-----------|-----------|
| E-01 | `__DEBUG_AUTO_DESCEND__` | `js/scenes/startScene.js:316`, `js/scenes/HubSceneV2.js:466-468` | Debug |
| E-02 | `__DEBUG_NO_FOW__` | `js/scenes/SettingsScene.js:144` | Debug, ohne Leser (siehe B-03) |
| E-03 | `__DEBUG_LOG_LINES__`, `window.debugLog`, `window.ensureDebugPanel`, `window.debugSummarizeInventory`, `window.debugSummarizeEquipment` | `js/main.js:357-390` | Debug-Protokoll-Infrastruktur; `ensureDebugPanel` gibt derzeit `null` zurück |
| E-04 | `__DEV_ROOM_PROFILING__` — **Voreinstellung `true`** | gesetzt `js/main.js:132-134`, gelesen `js/roomTemplates.js:193` | Debug; erzeugt **im Live-Build** Profiling-Konsolenausgaben |
| E-05 | `__DEV_SKIP_FLOOR_TILES__` | `js/main.js:135-137`, `js/roomTemplates.js:194` | Debug (Rendering überspringen) |
| E-06 | `__DEV_SKIP_WALL_OBSTACLES__` | `js/main.js:138-140`, `js/roomTemplates.js:195` | Debug (Kollision überspringen → Wände verschwinden) |
| E-07 | `__DEV_AUTO_TEST_TERRAIN__` + `window.gotoTestTerrainScene()` | `js/main.js:141-148` | Debug-Szeneneinstieg (siehe C-06) |
| E-08 | `__PERF` | `js/perfProbe.js:42-51`, `:102-108` | Debug; existiert nur mit A-03 |
| E-09 | `__perfDump()` | `js/perfProbe.js:17, 80, 402, 450` | Debug-Report |
| E-10 | `__ROOM_SIZE_TALLY__` | `js/roomManager.js:377-380` | Debug-Zähler (nur mit A-07) |
| E-11 | `__FORCE_ESPIONAGE__` | `js/roomManager.js:2508` | Debug — zweiter Weg zu A-06, **ohne URL-Flag** |
| E-12 | `__ENEMY_COUNT_DEBUG__` | `js/wave.js:19-21` | Debug-Konsolenausgabe |
| E-13 | `__TUTORIAL_DEBUG__` | `js/tutorialSystem.js:612, 624` | Debug-Konsolenausgabe |
| E-14 | `window.DEBUG_FORCE_EVENT` (ohne `__`-Präfix!) | `js/eventSystem.js:1612-1616` | Debug — erzwingt ein bestimmtes Ereignis in einem bestimmten Raum |
| E-15 | `__showError` | `index.html:53` | Debug-Anzeige (siehe C-01) |
| E-16 | `__GLOBAL_ERROR_LOGGER__` | `js/main.js:151, 165` | Debug-Merker |
| E-17 | `window.game` | `js/main.js:127` | Vollzugriff auf Phaser-Szenengraph aus der Konsole; **von `tools/testGame.js:53-70` benötigt** — zu entscheiden |
| E-18 | `window.gameScene`, `window.gameNow` | `js/main.js:1217`, `:884` | Interne Referenzen; zu entscheiden |
| E-19 | `__GAME_PAUSE` | `js/main.js:857-873`, `:1708`; `js/roomModes.js` | Pausen-Uhr; **vom kopflosen System benutzt** (`tools/headless/index.js:727, 845-862`) — Mechanik, nicht Debug; **nicht gaten** |
| E-20 | `__ENEMY_CHASE_OVERRIDE__` | `js/enemy.js:1119-1120` | Spielmechanik (Defend-Modus), aber von aussen setzbar → zu entscheiden |
| E-21 | `__ESP_GUARD_H` | `js/espionageVisuals.js:243`, `js/player.js:535` | Optischer Tuning-Wert → zu entscheiden |
| E-22 | `__LAST_SAVE_SNAPSHOT__`, `__LAST_SELECTED_DIFFICULTY__` | `js/storage.js:119-121`, `:270`; gelesen in `js/scenes/HubSceneV2.js:1660-1789` | Legt den **kompletten Spielstand** als Objekt offen → zu entscheiden |
| E-23 | `__climaxEnemy`, `__isFinalDungeonRoom`, `__runItemsDropped`, `__stairConsumedEAt`, `__worldAtlasFrames`, `__amuletChaining`, `__WALKABLE_AREA_PX__` | `js/enemy.js:2502`, `js/eventSystem.js:1604`, `js/loot.js:315-371`, `js/main.js:897`, `js/graphics.js:2601-2611`, `js/player.js:805-825`, `js/storage.js:44` | Interner Zustand, von Tests gelesen → zu entscheiden |
| E-24 | `__abilityCooldownMs__`, `__rollCooldownRemainingMs__`, `__rollCooldownDurationMs__`, `__MOBILE_*`, `__SAFE_AREA__`, `__REDUCED_EFFECTS__`, `__MOVEMENT_WEIGHT__`, `__SKIP_TUTORIAL__`, `__ENDLESS_MODE__` | `js/main.js:1829-1830`, `js/mobileAbilityButtons.js`, `js/mobileSafeArea.js`, `js/scenes/SettingsScene.js:144-160`, `js/endlessMode.js:6` | **Kein Debug** — reguläre Laufzeit-Kopplung zwischen Modulen; **nicht gaten** |

### F. Konsolenausgaben, die interne Zustände verraten

| # | Befund | Fundstelle |
|---|--------|-----------|
| F-01 | 66 `console.log` und insgesamt ~250 `console.*`-Aufrufe im ausgelieferten `js/` (ohne `js/vendor/`) | ganzer `js/`-Baum |
| F-02 | Grösste Verursacher: `js/scenes/HubScene.js` (15), `js/questSystem.js` (12), `js/performanceMonitor.js` (11), `js/roomManager.js` (4) | s. Dateien |
| F-03 | Raumvorlagen-Profiling läuft **bedingungslos**, weil `__DEV_ROOM_PROFILING__` per Voreinstellung `true` ist | `js/main.js:132-134` + `js/roomTemplates.js:193` |
| F-04 | `[GlobalError]`-Ausgabe mit vollständigem Stack | `js/main.js:151-165` |
| F-05 | `[roomsize]`-, `[enemyCount]`-, `[TutorialSystem.report]`-Ausgaben | `js/roomManager.js:381-387`, `js/wave.js:20`, `js/tutorialSystem.js:630` |

### G. Ausgeliefertes Altmaterial (im Repo, damit potenziell über Pages erreichbar)

| # | Befund | Fundstelle |
|---|--------|-----------|
| G-01 | **`deploy/demonfall/game/` ist eine vollständige, versionierte Alt-Kopie des Spiels** (316 verfolgte Dateien inkl. eigener `index.html`). Sie enthält `window.__DEV_FORCE_CHEAT__` und vergibt **bei jedem frischen Spiel eine Cheat-Waffe** (`grantCheatTestWeapon()` im `else if (!appliedSave)`-Zweig). Diese Globale existiert im aktuellen `js/` nicht mehr. | `deploy/demonfall/game/js/main.js:460`, `:1106-1111`; Einstieg `deploy/demonfall/game/index.html` |
| G-02 | `deploy/demonfall.zip` liegt ebenfalls im Repo | `deploy/demonfall.zip` |
| G-03 | `js/leaderboard.js` liegt im Repo, wird nicht geladen | `index.html:63-70`, `:178` |
| G-04 | `js/scenes/HubScene.js` (alter Hub) wird weiterhin geladen und ist der grösste Konsolen-Verursacher | `index.html:166` |

---

## Was das kopflose Testsystem und der Spieltest-Bot brauchen

Ein Gate, das diese Zugänge zusperrt, macht die gesamte automatisierte Prüfung
unbrauchbar. Konkret abhängig:

| Verbraucher | Benötigter Zugang | Fundstelle |
|---|---|---|
| Kopfloses System, Dungeon-Direktstart (`launchDungeon`) | `?dungeon=N` | `tools/headless/index.js:1898-1912` |
| `tests/headlessHub.test.js` | `?autostart=1` | `tests/headlessHub.test.js:18` |
| `tests/headlessNormalStart.test.js` | `?autostart=1` | `tests/headlessNormalStart.test.js:24` |
| `tests/roomModes.test.js` | `?mode=paustest` — setzt **nur** `window.location = { search: … }`, **ohne `hostname`** | `tests/roomModes.test.js:135` |
| Playwright-Rauchtest / Spieltest-Bot | `http://127.0.0.1:3456/?autostart=1` — **`127.0.0.1`, nicht `localhost`** | `tools/testGame.js:14` |
| Playwright-Rauchtest | `window.game` (Szenen-Introspektion) | `tools/testGame.js:53-70` |
| Kopfloses System, Pausen-Uhr | `window.__GAME_PAUSE` | `tools/headless/index.js:727, 845-862` |
| npm-Skripte | `test`, `test:smoke`, `test:headless`, `test:headless:play`, `test:headless:soak`, `test:all` | `package.json:5-13` |

**Der entscheidende Hebel**: Die DOM-Attrappe des kopflosen Systems setzt bereits
`hostname: 'localhost'` und `protocol: 'http:'` (`tools/headless/domStub.js:256-263`)
und lässt `search` konfigurieren. Ein Gate, das bei `localhost` automatisch aufgeht,
ist im kopflosen System **ohne jede Testanpassung** aktiv.

Zwei Fallen dabei:
1. `tools/testGame.js` benutzt `127.0.0.1` — eine Freigabeliste, die nur den Namen
   `localhost` kennt, sperrt den Playwright-Bot aus.
2. `tests/roomModes.test.js:135` ersetzt `window.location` durch ein Objekt **ohne**
   `hostname`. Ein Gate, das ausschliesslich über den Hostnamen entscheidet, würde
   diesen Test brechen; ein Gate, das zusätzlich `?debug=1` oder eine explizit
   setzbare Globale akzeptiert, nicht.

---

## Zielbild

Ein **einziges, zentral definiertes Laufzeit-Gate**. Jede Debug-Oberfläche fragt
dieses Gate ab, statt eigene Bedingungen zu prüfen. Ohne aktives Gate sieht und
erreicht ein Spieler keinen der oben gelisteten Zugänge; mit aktivem Gate
funktioniert alles wie bisher.

---

## User Scenarios & Testing

**Akteure**
- **Spieler** — öffnet die Pages-URL ohne Parameter, will spielen.
- **Entwickler** — öffnet das Spiel bewusst mit Debug-Absicht (lokal oder live).
- **Automatisiertes System** — kopfloses Testsystem, Spieltest-Bot, Playwright-Rauchtest.

### Primäre Abläufe

1. **Spieler, normaler Start**: Öffnet die Pages-URL. Das Einstellungsmenü hat keine
   DEBUG-Sektion. Taste `P` und der Menüpunkt „FPS Overlay" bewirken nichts bzw.
   existieren nicht. Ein angehängtes `?dungeon=3` oder `?autostart=1` ändert nichts —
   insbesondere wird der Spielstand **nicht** gelöscht.
2. **Spieler, Absturz**: Ein unbehandelter Fehler tritt auf. Der Spieler sieht eine
   kurze, deutschsprachige Meldung ohne Stacktrace, Dateinamen oder Zeilennummern.
   Das Spiel bleibt bedienbar, soweit möglich.
3. **Entwickler, Debug-Sitzung**: Öffnet die URL mit `?debug=1`. DEBUG-Sektion,
   `P`-Overlay, Fehler-Overlay mit vollem Stacktrace und alle Flags aus Abschnitt A
   verhalten sich exakt wie vor dieser Änderung. Kombinationen wie
   `?debug=1&perf=1&nofog=1` funktionieren.
4. **Entwickler, lokal**: Ruft `http://localhost:…` bzw. `http://127.0.0.1:…` ohne
   `?debug=1` auf. Das Gate ist automatisch aktiv.
5. **Automatisiertes System**: `node tools/runTests.js`, `node tools/headless.js` und
   `node tools/testGame.js --loadout` laufen **ohne Anpassung der bestehenden
   Testaufrufe** durch, weil die Attrappen-Hostnamen bzw. `127.0.0.1` das Gate öffnen.

### Akzeptanzszenarien

- **Given** ein Spieler auf der Pages-URL ohne Parameter, **When** er das
  Einstellungsmenü öffnet, **Then** ist keine DEBUG-Sektion sichtbar und kein
  Cheat auslösbar.
- **Given** dieselbe Sitzung, **When** ein unbehandelter Fehler auftritt,
  **Then** erscheint eine einzeilige deutsche Meldung ohne Stacktrace,
  Dateinamen, Zeilen- oder Spaltennummern.
- **Given** dieselbe Sitzung mit einem vorhandenen Spielstand, **When** die URL
  `?autostart=1` oder `?dungeon=5` enthält, **Then** bleibt der Spielstand
  unverändert und das Spiel startet regulär im Menü/Hub.
- **Given** `?debug=1`, **When** der Entwickler `P` drückt, **Then** erscheint das
  Performance-Overlay wie bisher.
- **Given** `?debug=1&perf=1`, **When** die Seite lädt, **Then** erscheint das
  Perf-Probe-Overlay inkl. DUMP-Schaltfläche und den Live-Umschaltern.
- **Given** ein Aufruf über `http://localhost:3456/` **oder** `http://127.0.0.1:3456/`
  ohne `?debug=1`, **When** die Seite lädt, **Then** ist das Gate aktiv.
- **Given** der unveränderte Bestand an Tests, **When** `node tools/runTests.js`
  läuft, **Then** ist er grün.
- **Given** `node tools/headless.js`, **When** `launchDungeon` `?dungeon=N` nutzt,
  **Then** wird `GameScene` wie bisher erreicht.
- **Given** ein Spieler ohne Gate, **When** er in den Hub kommt, **Then** enthält
  die Browser-Konsole keine Profiling-, Raumgrössen- oder Gegnerzahl-Ausgaben.

### Edge Cases

- **`?debug=1` bleibt beim Neuladen nicht erhalten**, weil eine Szene die URL
  ersetzt oder `location.reload()` läuft (Slot-Wechsel, `js/saveSlots.js`) → das Gate
  muss nach einem Reload weiterhin greifen (siehe FR-004 / Offene Frage OQ-2).
- **Gate wird spät gesetzt**: `index.html:11-55` läuft als allererstes Skript, vor
  jedem Spielmodul. Das Gate muss dort bereits bekannt sein, sonst zeigt das
  Fehler-Overlay Boot-Fehler ungefiltert an.
- **Fehler im Gate selbst**: Wirft die Gate-Auswertung, darf das Spiel nicht
  crashen; sicherer Rückfall ist „Gate aus" (Spielersicht).
- **Persistierter Alt-Zustand**: In vorhandenen Spielständen kann `debug.autostart`
  bereits `true` sein. Ohne Gate darf dieser gespeicherte Wert **nicht** wirken,
  sonst löscht das Spiel bei jedem Start still den Spielstand (B-02).
- **Toter Schalter**: „Kein Nebel" (B-03) hat keinen Leser — er darf nicht als
  „funktioniert wie bisher" abgenommen werden.
- **Mobile ohne Tastatur**: `P` ist dort nicht erreichbar; der Menüpunkt „FPS Overlay"
  (D-02) ist der einzige Zugang und muss mitgegated werden.
- **Zweiter Weg zum selben Ziel**: `?spy=1` (A-06) und `__FORCE_ESPIONAGE__` (E-11)
  sind zwei Türen in denselben Raum — beide müssen dasselbe Gate abfragen.
- **Alt-Kopie im Repo**: `deploy/demonfall/game/` (G-01) ist ein zweiter,
  ungegateter Einstiegspunkt mit aktivem Cheat.

---

## Requirements

### Funktionale Anforderungen (FR)

| ID | Anforderung | Status |
|----|-------------|--------|
| FR-001 | Es existiert **genau ein** zentrales Laufzeit-Gate, das jede Debug-Oberfläche abfragt; kein Modul prüft die Aktivierungsbedingung selbst. | Proposed |
| FR-002 | Das Gate ist aktiv, wenn die URL `?debug=1` enthält. | Proposed |
| FR-003 | Das Gate ist ausserdem aktiv, wenn das Spiel lokal läuft. Die Erkennung deckt mindestens `localhost`, `127.0.0.1`, `::1` und `*.localhost` ab. | Proposed |
| FR-004 | Das Gate ist innerhalb derselben Browser-Sitzung stabil: einmal aktiviert, bleibt es über Szenenwechsel und `location.reload()` (Slot-Wechsel) aktiv. | Proposed |
| FR-005 | Ist das Gate inaktiv, wird die DEBUG-Sektion im Einstellungsmenü (B-01…B-04) **gar nicht erst erzeugt** — nicht nur unsichtbar geschaltet. | Proposed |
| FR-006 | Ist das Gate inaktiv, bleiben **alle** URL-Flags aus Abschnitt A wirkungslos: `dungeon`, `autostart`, `perf`, `nofog`, `nomask`, `nospot`, `noexpl`, `explRes`, `fogInterval`, `rays`, `spy`, `roomsize`, `mode`, `hubdebug`. | Proposed |
| FR-007 | Ist das Gate inaktiv, löst kein Debug-Zugang eine spielstandsverändernde Aktion aus — insbesondere kein `clearSave()` über `?autostart=1`/`?dungeon=N` und kein persistierter `debug.autostart` aus einem Altspielstand. | Proposed |
| FR-008 | Ist das Gate inaktiv, zeigt das Fehler-Overlay (C-01) keinen Stacktrace, keinen Dateinamen und keine Zeilen-/Spaltennummer, sondern eine kurze deutschsprachige Meldung. | Proposed |
| FR-009 | Ist das Gate aktiv, zeigt das Fehler-Overlay den vollständigen Stacktrace wie bisher. | Proposed |
| FR-010 | Ist das Gate inaktiv, ist das Performance-Overlay weder über Taste `P` (D-01) noch über den HUD-Menüpunkt „FPS Overlay" (D-02) erreichbar; der Menüpunkt wird nicht gerendert. | Proposed |
| FR-011 | Ist das Gate inaktiv, produzieren die diagnostischen Konsolenausgaben (F-03, F-04, F-05) keine Ausgabe. Insbesondere ist `__DEV_ROOM_PROFILING__` dann standardmässig **aus**. | Proposed |
| FR-012 | Ist das Gate inaktiv, sind die Debug-Globalen aus E-01…E-16 wirkungslos, auch wenn sie nachträglich aus der Konsole gesetzt werden. | Proposed |
| FR-013 | Ist das Gate inaktiv, ist `TestTerrainScene` (C-06) nicht erreichbar: weder über `window.gotoTestTerrainScene()` noch über `__DEV_AUTO_TEST_TERRAIN__`. | Proposed |
| FR-014 | Ist das Gate aktiv, funktionieren **alle** Zugänge aus den Abschnitten A–E genau wie vor dieser Änderung — einschliesslich `?perf=1`-Overlay, DUMP-Schaltfläche und Live-Umschaltern. | Proposed |
| FR-015 | Der bestehende Bestand an automatisierten Prüfungen läuft **ohne Änderung der Testaufrufe** durch: `node tools/runTests.js`, `node tools/headless.js` (inkl. `--play`/`--soak`) und `node tools/testGame.js`. | Proposed |
| FR-016 | Es gibt einen von aussen setzbaren, dokumentierten Weg, das Gate ohne URL-Parameter zu öffnen, damit `tests/roomModes.test.js:135` (ein `location`-Objekt ohne `hostname`) und künftige Attrappen weiter funktionieren. | Proposed |
| FR-017 | Die Aktivierung des Debug-Modus ist dokumentiert (README oder `docs/`), inklusive der Liste aller Flags aus Abschnitt A. | Proposed |
| FR-018 | Der tote Umschalter „Kein Nebel" (B-03) wird entweder mit einem echten Leser verdrahtet oder entfernt — er wird nicht kommentarlos hinter das Gate geschoben. | Proposed |
| FR-019 | Es existiert eine automatisierte Prüfung, die für jeden Zugang aus den Abschnitten A–D belegt, dass er ohne Gate wirkungslos und mit Gate wirksam ist. | Proposed |

### Nicht-funktionale Anforderungen (NFR)

| ID | Anforderung | Status |
|----|-------------|--------|
| NFR-001 | Die Gate-Auswertung erfolgt genau einmal beim Start und kostet messbar **< 1 ms**; im Spielverlauf (`update`-Schleife) findet keine erneute URL-Auswertung statt. | Proposed |
| NFR-002 | Ein Fehler in der Gate-Auswertung darf den Spielstart **nie** verhindern; im Fehlerfall gilt „Gate aus" (Spielersicht). | Proposed |
| NFR-003 | Alle neuen oder geänderten Nutzertexte sind deutsch mit echten Umlauten (siehe C-002). Betrifft mindestens die neue Fehlermeldung (FR-008) und den bisher englischen Menüpunkt „FPS Overlay" (D-02), falls er erhalten bleibt. | Proposed |
| NFR-004 | Die Spieler-Fehlermeldung (FR-008) ist höchstens einzeilig und verdeckt höchstens 10 % der Bildschirmhöhe — das heutige Overlay nimmt bis zu 45 % ein (`index.html:19`). | Proposed |
| NFR-005 | Bei inaktivem Gate erzeugt ein vollständiger Hub-Besuch **keine** `console.log`-Ausgabe aus Spielcode; `console.warn`/`console.error` bleiben für echte Fehler zulässig. | Proposed |
| NFR-006 | Die Umsetzung fügt der Startzeit keine zusätzliche Netzwerkanfrage hinzu (das Spiel läuft vollständig offline, `index.html:56-70`). | Proposed |
| NFR-007 | `node tools/runTests.js` ist grün; die Gesamtzahl der Prüfungen sinkt nicht (Stand: 543+). | Proposed |

### Constraints (C)

| ID | Constraint | Status |
|----|------------|--------|
| C-001 | Klassische Skripte mit window-Globalen, keine Module. Das Gate muss vor allen Verbrauchern verfügbar sein — der früheste Verbraucher ist das Inline-Skript in `index.html:11-55`. | Accepted |
| C-002 | Alle Nutzertexte auf Deutsch mit echten Umlauten. | Accepted |
| C-003 | Auslieferung über GitHub Pages direkt aus `main`, **ohne Build-Schritt**. Es kann kein Entwicklercode zur Auslieferungszeit entfernt werden; das Gate wirkt ausschliesslich zur Laufzeit. | Accepted |
| C-004 | Jede Änderung unter `js/` erfordert einen `?v=`-Bump des betroffenen Skript-Tags in `index.html` **und** eine neue `GAME_VERSION` in `js/version.js` (dort ebenfalls `?v=` bumpen). | Accepted |
| C-005 | Das Gate ist eine Sichtbarkeitsschranke, **keine Sicherheitsgrenze**. Der Quelltext bleibt unminifiziert öffentlich; wer die Konsole öffnet, kann alles erreichen. Diese Spezifikation verspricht keinen Manipulationsschutz. | Accepted |
| C-006 | Das kopflose Testsystem und der Spieltest-Bot müssen weiter funktionieren; ihre Zugänge dürfen nicht gesperrt werden (siehe FR-015/FR-016). | Accepted |
| C-007 | Keine Änderung am Spielverhalten bei aktivem Gate — dieses Feature ist eine reine Sichtbarkeitsänderung. | Accepted |
| C-008 | Nicht Teil dieses Features: die grosse Konsolen-Aufräumaktion über alle ~250 `console.*`-Stellen. Gegated werden nur die diagnostischen Ausgaben aus F-03…F-05 (siehe „Nicht im Umfang"). | Accepted |

---

## Success Criteria

| ID | Kriterium |
|----|-----------|
| SC-001 | Ein Spieler, der die Pages-URL ohne Parameter öffnet, findet **null** der in den Abschnitten A–D gelisteten Zugänge. |
| SC-002 | Ein Spieler sieht bei einem Absturz **keinen** Stacktrace, sondern eine deutsche Kurzmeldung. |
| SC-003 | Kein URL-Flag kann ohne Gate den Spielstand eines Spielers verändern oder löschen. |
| SC-004 | Mit aktivem Gate ist jeder Zugang aus den Abschnitten A–E funktional identisch zum Zustand vor der Änderung. |
| SC-005 | `node tools/runTests.js`, `node tools/headless.js` und `node tools/testGame.js` laufen ohne Anpassung der Aufrufe durch. |
| SC-006 | Ein Entwickler, der dieses Projekt zum ersten Mal öffnet, findet in der Dokumentation innerhalb einer Minute, wie er den Debug-Modus einschaltet und welche Flags es gibt. |
| SC-007 | Bei inaktivem Gate erzeugt ein Hub-Besuch keine `console.log`-Ausgabe aus Spielcode. |
| SC-008 | Für jeden Zugang aus A–D existiert eine automatisierte Prüfung „ohne Gate wirkungslos / mit Gate wirksam". |

---

## Key Entities

- **Debug-Gate** — der eine zentrale Laufzeit-Zustand (an/aus), aus URL-Parameter,
  Hostname und einer setzbaren Globale abgeleitet, einmalig beim Start ausgewertet.
- **Debug-Zugang** — ein einzelner Einstiegspunkt (URL-Flag, Einstellung, Overlay,
  Tastenkürzel, Menüpunkt, Globale) mit Fundstelle und Gate-Zuordnung.
- **Spieler-Fehlermeldung** — die reduzierte, deutschsprachige Ersatzanzeige des
  Fehler-Overlays bei inaktivem Gate.
- **Automatisierter Verbraucher** — kopfloses Testsystem, Spieltest-Bot oder
  Playwright-Rauchtest, der einen Debug-Zugang benötigt.

---

## Annahmen

Alle folgenden Punkte sind **Annahmen**, nicht bestätigte Vorgaben. Sie stammen
aus Issue #88 oder aus dem Quelltext und ersetzen die ausgefallene Befragung.

- **AN-01** — Der im Issue vorgeschlagene Schalter `?debug=1` **oder** `localhost`
  ist die gewünschte Aktivierungsbedingung (aus Issue #88, Abschnitt „Vorschlag").
- **AN-02** — „localhost" ist als **lokale Ausführung** gemeint, nicht wörtlich als
  dieser eine Hostname. Deshalb schliesst FR-003 `127.0.0.1`, `::1` und `*.localhost`
  ein — sonst sperrt das Gate `tools/testGame.js:14` (`127.0.0.1`) aus.
- **AN-03** — Der Name der Globalen (`window.__DEBUG_ENABLED__`) ist ein Vorschlag
  aus dem Issue, keine Festlegung; der Plan darf einen anderen Namen wählen.
- **AN-04** — Von den beiden Vorschlägen des Issues für das Fehler-Overlay
  (dezente Meldung vs. „dreimal in eine Ecke tippen") wird die **dezente Meldung**
  gewählt: sie ist testbar, das Tipp-Muster wäre eine zweite, ungegatete Hintertür.
- **AN-05** — Der Debug-Modus muss auch **auf der Live-Seite** einschaltbar bleiben
  (nicht nur lokal), weil das Fehler-Overlay ausdrücklich als Mobile-Hilfe gebaut
  wurde und Mobilgeräte keine DevTools haben (`index.html:11-14`).
- **AN-06** — Nicht-diagnostische `window.__`-Globale (E-24: `__MOBILE_*`,
  `__SAFE_AREA__`, `__REDUCED_EFFECTS__`, `__MOVEMENT_WEIGHT__`, `__SKIP_TUTORIAL__`,
  `__ENDLESS_MODE__`) sind reguläre Modulkopplung und **kein** Debug-Zugang.
- **AN-07** — `window.__GAME_PAUSE` (E-19) ist Spielmechanik und wird nicht gegated;
  das kopflose System steuert darüber die Pausen-Uhr.
- **AN-08** — Der Umschalter „Kein Nebel" (B-03) ist heute wirkungslos; „funktioniert
  mit Gate wie bisher" heisst hier deshalb „tut weiterhin nichts", bis FR-018
  entschieden ist.
- **AN-09** — Der Menüpunkt „FPS Overlay" (D-02) ist als Entwicklerwerkzeug gemeint
  und keine bewusste Spielerfunktion — das englische Label in einem sonst
  durchgängig deutschen Menü stützt das.
- **AN-10** — Es wird kein Manipulationsschutz erwartet (C-005); Ziel des Issues ist
  ausdrücklich der „Prototyp-Geruch", nicht Cheat-Abwehr.
- **AN-11** — Die Dokumentation aus FR-017 ist eine kurze Notiz in `README`/`docs/`,
  kein eigenes Handbuch (aus Issue #88, „Definition of Done").
- **AN-12** — GitHub Pages liefert das Repository-Wurzelverzeichnis aus; es gibt
  keinen Workflow unter `.github/workflows/`. Damit wäre `deploy/demonfall/game/`
  (G-01) öffentlich erreichbar. Das ist aus dem Repository abgeleitet und **nicht
  in der Pages-Konfiguration verifiziert** — siehe OQ-1.
- **AN-13** — Der Umfang bleibt auf das Gate beschränkt; die grosse Konsolen-
  Aufräumaktion (F-01/F-02) ist ein eigenes Vorhaben (C-008).

---

## Offene Fragen

Echte Lücken, die ohne den Projektinhaber nicht zu schliessen sind. Keine davon
blockiert die Spezifikation, aber OQ-1 und OQ-2 sollten vor `/spec-kitty.plan`
beantwortet werden.

- **OQ-1 — `deploy/demonfall/game/` (G-01)**: Ist diese versionierte Alt-Kopie über
  die Pages-URL erreichbar? Falls ja, ist sie ein vollständig ungegateter zweiter
  Einstiegspunkt **mit aktivem Cheat** (`grantCheatTestWeapon()` bei jedem frischen
  Spiel) und macht das Gate im Wortsinn wertlos. Optionen: (a) Ordner aus dem Repo
  entfernen, (b) über Pages ausschliessen, (c) mitgaten, (d) als unkritisch
  bewerten. **Empfehlung: (a) oder (b)** — er ist eine Alt-Kopie, kein Spielinhalt.
- **OQ-2 — Beständigkeit des Gates (FR-004)**: Soll `?debug=1` über einen
  `location.reload()` (Slot-Wechsel, `js/saveSlots.js`) hinweg erhalten bleiben?
  Wenn ja: nur für die Sitzung (`sessionStorage`) oder dauerhaft (`localStorage`)?
  Dauerhafte Speicherung würde bedeuten, dass ein Spieler den Debug-Modus einmal
  versehentlich einschaltet und ihn nie wieder los wird.
- **OQ-3 — Einordnung von `window.game` (E-17)**: Der volle Szenengraph aus der
  Konsole ist ein echter Debug-Zugang, wird aber von `tools/testGame.js` gebraucht.
  Gaten (und den Rauchtest anpassen) oder als notwendige Kopplung akzeptieren?
- **OQ-4 — Interne Zustands-Globale (E-20…E-23)**: `__LAST_SAVE_SNAPSHOT__` legt den
  kompletten Spielstand offen, `__ENEMY_CHASE_OVERRIDE__` und `__ESP_GUARD_H` sind
  von aussen setzbare Tuning-Werte. Zählen sie als Debug-Zugang oder als
  Modulkopplung? Sie werden von Tests gelesen.
- **OQ-5 — Menüpunkt „FPS Overlay" (D-02)**: Ganz hinter das Gate, oder als
  bewusste Spielerfunktion behalten (dann eingedeutscht und ohne die
  Speicher-/Timing-Innereien)? Ein FPS-Zähler ist in Spielen durchaus üblich.
- **OQ-6 — „Kein Nebel" (B-03, FR-018)**: verdrahten oder entfernen?

---

## Nicht im Umfang

- Vollständiges Aufräumen aller ~250 `console.*`-Aufrufe (F-01/F-02). Gegated
  werden nur die diagnostischen Ausgaben F-03…F-05.
- Entfernen der Debug-Werkzeuge selbst — sie bleiben erhalten und nutzbar (Ziel
  des Issues).
- Manipulationsschutz, Minifizierung, Verschleierung oder ein Build-Schritt (C-003, C-005).
- Umbau des Einstellungsmenüs über das Ausblenden der DEBUG-Sektion hinaus.
- `js/leaderboard.js` (G-03) und `js/scenes/HubScene.js` (G-04) — Alt-Code, eigenes Thema.
- Änderungen am kopflosen Testsystem oder am Spieltest-Bot, ausser den zwingend
  nötigen Anpassungen aus FR-015/FR-016.

---

## Auslieferungshinweise

- **`?v=`-Bump**: Jede geänderte Datei unter `js/` braucht einen neuen `?v=`-Wert an
  ihrem `<script>`-Tag in `index.html`. Erwartet betroffen: `js/main.js` (`?v=105`),
  `js/scenes/SettingsScene.js` (`?v=004`), `js/scenes/startScene.js` (`?v=084`),
  `js/scenes/HubSceneV2.js` (`?v=103`), `js/roomManager.js` (`?v=107`),
  `js/roomModes.js` (`?v=086`), `js/perfProbe.js` (`?v=053-19`), `js/wave.js` (`?v=087`),
  `js/tutorialSystem.js` (`?v=002`), `js/eventSystem.js` (`?v=010`),
  `js/roomTemplates.js` (`?v=016`), `js/hudV2.js` (`?v=075`), `js/performanceMonitor.js`
  (`?v=002`) sowie eine etwaige neue Gate-Datei.
- **`GAME_VERSION`**: `js/version.js` hochzählen (aktuell `2026-09-01 · b109`) und das
  `?v=104` dieser Datei in `index.html:87` mitbumpen.
- **Ladereihenfolge**: Ein neues Gate-Skript muss **vor** dem Inline-Fehler-Overlay
  wirksam sein (`index.html:11-55`) — das ist heute das allererste Skript der Seite.
- **Pages-Verzögerung**: Der Deploy braucht erfahrungsgemäss 1–4 Minuten.
