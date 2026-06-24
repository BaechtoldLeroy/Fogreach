# Specification: Run-Amulett-Slot + Inventar-UI-Redesign

**Feature**: 059-run-amulet-slot
**Created**: 2026-06-24
**Mission**: software-dev
**Tracker**: #42
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Das Equipment-System (`js/main.js` `equipment = { weapon, head, body, boots }`,
Stat-Pipeline über `recalcDerived` in `js/inventory.js` + Affix-`getBonus` in
`js/lootSystem.js`) ist heute rein **persistent**: was der Spieler anlegt, bleibt
über Runs und Hub-Rückkehr hinweg im Save. Loot ist inkrementell (besseres Gear =
höhere Zahlen), aber kein Run fühlt sich **strukturell anders** an als der
vorherige.

Dieses Feature führt einen **fünften Equipment-Slot „Amulett"** ein, der bewusst
**run-spezifisch** ist (roguelike-Relikt): Er gilt nur für den aktuellen
Hinabstieg und wird bei Run-Ende / Hub-Rückkehr zurückgesetzt — analog zu den
bereits existierenden run-scoped Buffs (Brunnen #16, Druckhaus #24), die in
`leaveDungeonForHub` (`js/main.js:1689`) geleert werden. Amulette tragen
**run-definierende Effekte** (Extra-Projektil/Cleave, Ketteneffekt, Aura, starker
Lebensraub, Tempo/Burst), sodass jeder Run einen eigenen „Build-Seed" bekommt.

Amulette sind **früh findbar** (in den ersten Räumen eines Runs), aber erst **ab
Dungeon-Tiefe 10** freigeschaltet, damit der frühe Spielverlauf nicht von
build-definierenden Relikten überrollt wird. Ein **fliegender Händler** verkauft
zusätzlich eine kuratierte Amulett-Auswahl pro Run.

Im selben Zug wird das **Inventar-UI neu strukturiert**: Der neue Slot muss
sauber integriert werden, das Layout lesbarer werden, und der run-spezifische
Charakter des Amuletts **visuell deutlich** vom persistenten Gear abgesetzt sein
(eigene Slot-Optik, Run-Badge, eigener Tooltip-Block).

**Designprinzip:** Effekte sind **stark und spürbar** (sollen einen Run prägen),
dürfen aber den restlichen Loot **nicht entwerten** — Amulette ergänzen einen
Build, sie ersetzen kein gutes Gear (Balance über Tiefen-/Seltenheits-Gating und
bewusst orthogonale Effekte, nicht über rohe Stat-Inflation).

## 2. Stakeholders & Actors

- **Spieler** — findet/kauft pro Run höchstens ein aktives Amulett, spürt einen
  klaren Spielgefühl-Twist, verliert das Amulett bei Hub-Rückkehr/Tod und startet
  den nächsten Run wieder „nackt" im Amulett-Slot.
- **Equipment-/Inventar-System** (`js/inventory.js`, `js/main.js` `equipment`) —
  bekommt einen fünften Slot `amulet` + UI-Integration + run-scoped Reset.
- **Loot-System** (`js/loot.js`, `js/lootSystem.js`) — neuer Item-`type: 'amulet'`,
  eigener Amulett-Definitions-Pool, eigener Roll-/Spawn-Pfad (NICHT im regulären
  `rollItem`-Droppool, damit Amulette nicht reguläres Gear verdrängen).
- **Effekt-Hooks** (`js/player.js`, Combat) — Amulett-Effekte, die nicht reine
  Stats sind (Extra-Projektil, Cleave, Chain, Lifesteal, Aura), brauchen eigene
  Hooks im Player-/Combat-Pfad, lesen aus `window.runAmulet`.
- **Run-Lifecycle** (`js/roomManager.js` `initDungeonRun`, `js/main.js`
  `leaveDungeonForHub`) — Spawn-Gating früher Räume + Reset-Zeitpunkt.
- **Fliegender Händler** (erweitert `LootSystem.getOrCreateShopState`-Muster,
  `js/lootSystem.js:854`) — verkauft pro Run eine Amulett-Auswahl.
- **Persistenz** (`js/persistence.js`) — stellt sicher, dass Amulette **NICHT**
  ins persistente Save-Equipment wandern (kein neuer SAVE-Pfad; Reset
  garantiert).

## 3. User Scenarios

### Primary A: Amulett finden (run-definierender Build-Seed)
1. Spieler steigt auf **Tiefe ≥ 10** hinab. In einem der ersten Räume liegt ein
   deutlich markiertes Amulett (eigenes Drop-Visual/Glow).
2. Spieler hebt es auf → Tooltip zeigt den **run-definierenden Effekt** (z.B.
   „Jeder Angriff feuert ein zweites Projektil") plus Run-Badge „Nur dieser Run".
3. Spieler legt es im neuen Amulett-Slot an → der Effekt ist sofort spürbar; der
   restliche Run dreht sich um diesen Build-Seed.

### Primary B: Amulett beim fliegenden Händler kaufen
1. Im Run trifft der Spieler auf den **fliegenden Händler** (eigener NPC/Encounter).
2. Dessen Auslage zeigt eine **kuratierte Amulett-Auswahl** (run-fix gerollt,
   2–3 Optionen) gegen Gold.
3. Kauf legt das Amulett ins Inventar; Anlegen wie in Szenario A.

### Primary C: Tausch innerhalb eines Runs
1. Spieler trägt Amulett X, findet später Amulett Y.
2. Spieler kann **tauschen** (Y anlegen → X zurück ins Inventar). Es ist immer nur
   **ein** Amulett aktiv (Slot-Kapazität 1). Tausch ist erlaubt; Amulette sind
   nicht „verbraucht".

### Primary D: Reset bei Run-Ende
1. Spieler kehrt über Portal in den Hub zurück **oder** stirbt.
2. `leaveDungeonForHub` leert den Amulett-Slot + run-Amulett-State (analog
   Brunnen/Druckhaus); `recalcDerived` läuft, Stats fallen auf Gear+Skill-Baseline
   zurück.
3. Beim nächsten Hinabstieg ist der Amulett-Slot wieder leer — kein Amulett im
   Hub-Inventar, kein Amulett im persistenten Save.

### Edge: Tiefe < 10
- Unter Tiefe 10 spawnen **keine** Amulette und der fliegende Händler bietet
  **keine** an. Der Slot ist sichtbar, aber leer/gesperrt (UI-Hinweis „ab Tiefe
  10").

## 4. Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | **Neuer Equipment-Slot `amulet`**: `equipment`-Objekt (`js/main.js:825`) um `amulet: null` erweitern; `equipKeys` (`js/inventory.js:619`) um `'amulet'`. Slot-Kapazität 1. | Draft |
| FR-02 | **Neuer Item-`type: 'amulet'`**: eigener Amulett-Definitions-Pool (`AMULET_DEFS`) in `js/loot.js`/`js/lootSystem.js`, getrennt von `ITEM_BASES`. Amulette werden **nicht** vom regulären `rollItem(null, depth)`-Droppool gerollt. | Draft |
| FR-03 | **Run-spezifisch / Reset**: Amulett lebt in run-scoped State (`window.runAmulet` + `equipment.amulet`), wird in `leaveDungeonForHub` (`js/main.js:1689`) geleert (analog `brunnenBuffs`/`printingBuffs`), gefolgt von `recalcDerived(0,0)`. **Kein** Persist ins SAVE-Equipment. | Draft |
| FR-04 | **Spawn-Gating ab Tiefe 10, früh im Run**: `initDungeonRun` (`js/roomManager.js:141`) injiziert genau dann eine Amulett-Spawn-Garantie in einen der **ersten** Räume, wenn `DUNGEON_DEPTH >= 10`. Unter 10: kein Amulett-Spawn. | Draft |
| FR-05 | **Effekt-Pool (run-definierend)**: 5–8 Amulette mit klar unterscheidbaren, spürbaren Effekten (siehe §6). Effekte, die keine reinen Stats sind, hängen an eigenen Hooks (`js/player.js`/Combat), lesen aus `window.runAmulet.effect`. | Draft |
| FR-06 | **Effekt-Anwendung über getBonus-/Pipeline-Erweiterung**: reine Stat-Anteile eines Amuletts fließen über `recalcDerived` (`js/inventory.js:842`, iteriert `Object.values(equipment)`) bzw. eine Amulett-Bonus-Quelle in die Stat-Pipeline ein; Nicht-Stat-Effekte über explizite Combat-Hooks. | Draft |
| FR-07 | **Fliegender Händler**: ein run-spezifischer Händler-Encounter bietet 2–3 kuratierte Amulette pro Run (run-fix gerollt, Muster wie `getOrCreateShopState`, `js/lootSystem.js:854`). Auswahl wechselt run-to-run. | Draft |
| FR-08 | **Tausch innerhalb des Runs**: findet/kauft der Spieler ein zweites Amulett, kann er tauschen (altes zurück ins Inventar). Immer genau 1 aktiv. | Draft |
| FR-09 | **Inventar-UI-Redesign**: Amulett-Slot ins Inventar-Grid integrieren; Layout/Lesbarkeit optimieren; run-spezifischer Charakter **visuell** abgesetzt (eigene Slot-Optik + Run-Badge + Tooltip-Block „Nur dieser Run"). | Draft |
| FR-10 | **Tooltip**: `formatItemTooltip` (`js/inventory.js:515`) rendert Amulett-Effekt-Beschreibung + Run-Hinweis; klar lesbar, eigener visueller Block. | Draft |
| FR-11 | **i18n DE/EN**: alle neuen Strings (Amulett-Namen, Effekt-Texte, Slot-Label, Badge, Händler-Dialog, Tiefe-10-Hinweis) über `window.i18n` (DE source-of-truth). Keine hartkodierten Strings. | Draft |
| FR-12 | **Persistenz-Garantie**: `js/persistence.js` und der Save-Pfad bleiben unverändert bzgl. Amulett — `equipment.amulet` wird beim Speichern **nicht** in den persistenten Equipment-Block übernommen (oder beim Laden defensiv genullt). Alt-Saves laden ohne Crash. | Draft |
| FR-13 | **Tiefe < 10 UI-State**: Slot ist sichtbar, zeigt aber gesperrt/leer mit Hinweis „freigeschaltet ab Tiefe 10". | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-01 | Performance unverändert: Desktop 60fps, Mobile-Procroom ≥45 (053 nicht regredieren). Amulett-Effekt-Hooks (Extra-Projektil/Cleave) dürfen den Combat-Loop nicht ruckeln. | gemessen |
| NFR-02 | Balance: Amulett-Effekte spürbar run-definierend, ohne reguläres Gear/Loot zu entwerten (Playtest-validiert). | subjektiv |
| NFR-03 | Reset deterministisch: nach Hub-Rückkehr/Tod ist `equipment.amulet === null` und `window.runAmulet` geleert — unit-test-verifizierbar. | Test |
| NFR-04 | Keine Regression im bestehenden Equipment/Loot-/Save-Verhalten der 4 Bestands-Slots. | Playtest + Test |

## 6. Beispiel-Effekt-Pool (5–8 Amulette)

Konkreter Startpool (im Plan/Research finalisierbar; Werte sind Tuning-Targets):

| # | Amulett (DE) | Effekt-Typ | Wirkung | Hook |
|---|--------------|-----------|---------|------|
| A1 | **Amulett der Zwillingsklinge** | Extra-Projektil/Doppelschlag | Jeder Angriff löst einen zweiten, leicht versetzten Treffer/Projektil aus (~60% Schaden). | Combat-Attack-Hook (`js/player.js`, vgl. `_fireBowArrow` :2040 / Melee-Pfad) |
| A2 | **Kettenherz** | Ketteneffekt | Treffer springt auf bis zu 2 nahe Gegner (~40% Schaden, abnehmend). | Hit-Resolve-Hook (Chain-Suche im Enemy-Pool) |
| A3 | **Schnitterband** | Cleave | Nahkampftreffer schlägt einen Kegel statt Einzelziel (AoE-Sweep). | Melee-Hit-Region-Hook |
| A4 | **Aderlass-Talisman** | Starker Lebensraub | Heilt X% des verursachten Schadens (deutlich über jedem Affix-Lifesteal). | Damage-Dealt-Hook + `setPlayerHealth` |
| A5 | **Brandmal der Gier** | Aura | Pulsierende Schadens-Aura um den Spieler (Tick-DoT an nahe Gegner). | Per-Tick-Aura im Update-Loop (throttled) |
| A6 | **Sturmschritt-Amulett** | Tempo/Burst | +Bewegungstempo & +Angriffstempo; nach Kill kurzer Burst (Speed-Spike X s). | `recalcDerived` move/speed + Kill-Hook Buff |
| A7 | **Vergeltermünze** | Fähigkeit-Umbau | Erlittener Schaden lädt einen Konter; nächster Angriff stark verstärkt. | Damage-Taken-Hook + nächster-Treffer-Flag |
| A8 | **Glasherz** | High-Risk-Burst | +50% Schaden, aber -25% Max-LP für den Run (build-definierender Trade-off). | `recalcDerived` (damage up, maxHp down) |

Mindestens **5** davon im ersten Ship; A1–A4 (Extra-Projektil/Chain/Cleave/
Lifesteal) sind die Kern-Showcases. Seltenheits-/Tiefen-Gating: tiefere Runs
können stärkere/seltenere Amulette in Händler/Spawn ziehen (optionaler Tiefen-Bias,
siehe Decision D5).

## 7. Inventar-UI-Redesign (eigener Scope-Block)

- **Slot-Integration**: Amulett als fünfter Slot in der Equipment-Spalte
  (`invUI.equip`, `js/inventory.js:660`), eigene Slot-Optik (run-Farbton/Rahmen),
  damit er nicht wie persistentes Gear aussieht.
- **Run-Badge**: kleines „Nur dieser Run"-Label am Slot + im Tooltip.
- **Layout/Lesbarkeit**: Equipment-Spalte auf 5 Slots umbauen (Abstände/Größen),
  Tooltip-Clipping (vgl. Kommentar `js/inventory.js:576`) für den neuen Slot prüfen.
- **Gesperrt-Zustand** (Tiefe < 10): Slot ausgegraut + i18n-Hinweis.
- **Mobile**: Slot muss mit Touch bedienbar bleiben (Slot-Layout/scrollFactor-Falle
  beachten, vgl. Memory `project_phaser_scrollfactor_dialogs`).
- **Effekt-Tooltip**: Amulett-Effekt prominent, vom Stat-Block abgesetzt.

## 8. Offene Design-Entscheidungen (mit Empfehlung)

| ID | Frage | Optionen | **Empfehlung** |
|----|-------|----------|----------------|
| D1 | Reset-Zeitpunkt? | (a) nur Tod (b) nur Hub-Rückkehr (c) jeder Hub-Eintritt egal wie | **(c)** Reset in `leaveDungeonForHub` für **alle** Reasons (`portal`/`death`/…) — ein einziger, deterministischer Hook, deckt Tod + Portal ab. Konsistent mit Brunnen/Druckhaus. |
| D2 | Genau 1 Amulett pro Run oder tauschbar? | (a) fix 1, nicht tauschbar (b) tauschbar, immer 1 aktiv | **(b)** Slot-Kapazität 1, aber tauschbar (FR-08). Mehr Spielerfreiheit, kein „Fehlgriff bestraft den ganzen Run". |
| D3 | Effekt-Pool-Größe im ersten Ship? | 5 / 6 / 8 | **6** (A1–A6): deckt alle Effekt-Archetypen ab, hält Tuning-Aufwand beherrschbar. A7/A8 als Folge-Erweiterung. |
| D4 | Fliegender Händler = neuer NPC oder bestehender Shop? | (a) Mara-Shop erweitern (b) eigener run-Encounter-NPC | **(b)** eigener „fliegender Händler"-Encounter (Spawn im Run, nicht im Hub) — passt zum run-spezifischen Charakter; nutzt aber das **Shop-State-Muster** (`getOrCreateShopState`) für die run-fixe Auswahl. |
| D5 | Tiefen-/Seltenheits-Gating der Effekte? | (a) flach gleichverteilt (b) Tiefen-Bias auf stärkere Amulette | **(b)** leichter Tiefen-Bias: ab 10 alle möglich, tiefere Runs erhöhen Gewicht der stärkeren/Trade-off-Amulette (A7/A8). Hält tiefe Runs interessant. |
| D6 | Spawn früh: Garantie oder Chance? | (a) garantiert 1 in ersten Räumen (b) hohe Chance | **(a)** ab Tiefe 10 **garantiert** genau 1 Amulett-Spawn früh im Run + zusätzlich Händler-Auswahl. „Jeder Run ein Build-Seed" verlangt Verlässlichkeit. |
| D7 | Amulett im Hub-Inventar sichtbar? | (a) verschwindet komplett (b) liegt als „inaktiv" im Hub | **(a)** verschwindet bei Reset komplett (run-spezifisch heißt run-spezifisch). Klarheit > Sammel-Gefühl. |

## 9. Acceptance-Kriterien

| ID | Criterion |
|----|-----------|
| SC-01 | **Slot existiert**: `equipment.amulet` ist ein echter, an-/ablegbarer Slot; Inventar-UI zeigt ihn als fünften Equipment-Slot. |
| SC-02 | **Reset verifizierbar**: nach `leaveDungeonForHub` (Portal **und** Tod) ist `equipment.amulet === null` und `window.runAmulet` geleert; Unit-Test deckt beide Reasons ab. |
| SC-03 | **Spawn-Gating**: auf Tiefe < 10 spawnt **kein** Amulett und der Händler bietet keins; auf Tiefe ≥ 10 erscheint **garantiert** ein Amulett in einem der ersten Räume. |
| SC-04 | **Händler bietet Amulette**: der fliegende Händler zeigt pro Run eine kuratierte (run-fixe) Amulett-Auswahl, kaufbar gegen Gold. |
| SC-05 | **Effekte wirken**: mind. 5 Amulette mit unterscheidbaren, spürbaren Effekten; Extra-Projektil/Chain/Cleave/Lifesteal sind im Spiel beobachtbar; getBonus/Effekt-Anwendung unit-getestet. |
| SC-06 | **Kein Persist**: nach Hub-Rückkehr enthält das gespeicherte/geladene Save **kein** Amulett im Equipment; Alt-Saves laden fehlerfrei. |
| SC-07 | **UI-Redesign**: Slot visuell als „Nur dieser Run" erkennbar (Badge/Optik); Tooltip zeigt Effekt; Layout lesbar; Mobile bedienbar. |
| SC-08 | **i18n + Tests + Perf**: DE/EN vollständig, keine hartkodierten Strings; alle Tests grün (`node tools/runTests.js`); 60fps Desktop / Mobile ≥45 unverändert. |

## 10. Edge Cases

- **Tausch mit vollem Inventar**: kein freier Platz fürs alte Amulett → wie reguläres
  Equip-Swap behandeln (Bestands-Logik `js/inventory.js:1220`), ggf. Drop-Warnung.
- **Tod mitten im Run mit Amulett**: Reset greift (D1c); kein „Mitnahme-Exploit".
- **Save während Run mit Amulett angelegt**: Save darf das Amulett NICHT im
  Equipment persistieren (FR-12) — beim Laden defensiv `equipment.amulet = null`.
- **Tiefe genau 10**: Grenze inklusiv (≥ 10), nicht > 10.
- **Mehrere Amulett-Spawns**: max. 1 garantierter Spawn; Händler zusätzlich.
- **Mobile-Slot**: Touch-Tap muss den 5. Slot treffen (scrollFactor-/Hit-Area-Falle).

## 11. Key Entities

| Entity | Description |
|--------|-------------|
| `js/main.js` `equipment` | +`amulet`-Slot; `window.runAmulet` run-scoped State. |
| `js/main.js` `leaveDungeonForHub` | Reset-Hook (Amulett leeren + recalcDerived). |
| `js/loot.js` / `js/lootSystem.js` `AMULET_DEFS` | Amulett-Definitions-Pool, eigener Roll-/Spawn-Pfad, Item-`type:'amulet'`. |
| `js/inventory.js` | `equipKeys`, Slot-UI, Tooltip, Redesign. |
| `js/roomManager.js` `initDungeonRun` | Spawn-Gating ab Tiefe 10 in frühen Räumen. |
| Fliegender Händler | run-Encounter + run-fixe Amulett-Auswahl (Shop-State-Muster). |
| `js/player.js` | Combat-Hooks für Nicht-Stat-Effekte (Extra-Proj/Chain/Cleave/Lifesteal/Aura). |
| `js/persistence.js` | Garantie: Amulett nicht im persistenten Save. |

## 12. Assumptions

- Das bestehende Equip-Swap (`js/inventory.js:1220`) lässt sich um einen 5. Slot
  erweitern, ohne den Bestands-Pfad zu brechen. (In Research bestätigen.)
- `recalcDerived` (`js/inventory.js:842`) iteriert bereits über `equipment`-Werte
  (`Object.values(equipment)` :852) — ein 5. Slot fließt automatisch ein, solange
  Amulett-Stats kompatibel sind. (Validieren; Nicht-Stat-Effekte brauchen Extra-Hooks.)
- Combat-Attack-Pfad in `js/player.js` (Bow `_fireBowArrow` :2040, Melee) bietet
  brauchbare Einstiegspunkte für Extra-Projektil/Cleave-Hooks. (Research.)
- Das Shop-State-Muster (`getOrCreateShopState`, run-fix per `runId`) ist für die
  Händler-Auswahl wiederverwendbar.

## 13. Out of Scope

- Persistente Amulett-Sammlung / Amulett-Crafting / Upgrade.
- Mehr als 1 aktiver Amulett-Slot.
- Komplette Affix-System-Überarbeitung (Amulette nutzen einen eigenen Pool, kein
  Umbau von `AFFIX_DEFS`).
- Voll prozedurale Amulett-Generierung (Startpool ist kuratiert).
- Neue Boss-/Story-Inhalte.

## 14. Dependencies

- Loot-/Affix-System (#37/#38) ✓ — Item-Datenmodell, `rollItem`, Tier/Tooltip.
- Run-scoped-Buff-Muster (Brunnen #16, Druckhaus #24) ✓ — Reset-Vorlage in
  `leaveDungeonForHub`.
- Shop-State (`getOrCreateShopState`) ✓ — Muster für run-fixe Auswahl.
- i18n (041) ✓ — DE/EN.

## 15. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | **Amulett entwertet regulären Loot** (NFR-02). | Eigener Pool (kein `rollItem`-Verdrängen); orthogonale Effekte statt Stat-Inflation; Playtest-Tuning. |
| R-02 | **Reset-Leck**: Amulett überlebt Run (Persist-/Exploit-Bug). | Single-Hook in `leaveDungeonForHub` für alle Reasons; FR-12 Save-Guard; Unit-Test SC-02/SC-06. |
| R-03 | **Combat-Hooks ruckeln** (Extra-Proj/Chain/Aura). | Throttle/lightweight; kein per-Frame O(n²); NFR-01-Messung. |
| R-04 | **UI-Redesign bricht Bestands-Slots**. | Additive 5-Slot-Umbau; Tooltip-Clipping-Check; Mobile-Touch-Test; keine Regression der 4 Slots. |
| R-05 | **Spawn-Gating falsch** (Amulett unter Tiefe 10 / nie früh). | Test gegen `DUNGEON_DEPTH` ≥10 inklusiv + Early-Room-Inject; SC-03. |

## 16. References

- `js/main.js:825` `equipment`-Objekt; `:1689` `leaveDungeonForHub` (Reset-Muster).
- `js/inventory.js:619` `equipKeys`; `:515` `formatItemTooltip`; `:842` `recalcDerived`.
- `js/lootSystem.js:255` `ITEM_BASES`; `:854` `getOrCreateShopState`; `:514` `rollItem`.
- `js/roomManager.js:141` `initDungeonRun` (Spawn-Order, `getStoryAct`/Tiefe).
- `js/persistence.js:8` `KEYS` / `:38` `NEW_GAME_WIPE_KEYS`.
- 055-act-2 spec als Format-Vorlage.
