# Specification: Enemy-Spawn Story-Gating

**Feature**: 057-enemy-spawn-story-gating
**Created**: 2026-06-24
**Mission**: software-dev
**Tracker**: GitHub #40
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Das Gegner-Spawning im Dungeon filtert das verfügbare Gegner-Roster heute
**ausschließlich nach Dungeon-Tiefe** (`window.DUNGEON_DEPTH`). Die Tiefe ist
über „Der Hinabstieg" (HubSceneV2 / roomManager) jedoch **frei wählbar** — der
Spieler kann tief tauchen, lange bevor die zugehörige Story erreicht ist.
Dadurch erscheinen **narrativ späte Gegnertypen zu früh** (z.B. FlameWeaver
oder ChainGuard, bevor der Kettenrat-Konflikt überhaupt erzählt wurde).

Die Story-Progression lebt in `js/storySystem.js`: `currentActIndex` (0–6)
über die 7 Akte `auftrag → treuer_diener → erste_risse → wahrheit → bruch →
rebellion → offenbarung`. Der Akt wird seit Feature 050 **quest-getrieben**
gesetzt (`advanceToAct`), nicht mehr durch Tiefe/Wave — er ist also ein
verlässliches Maß für den erzählerischen Fortschritt.

Dieses Feature **koppelt das Spawn-Gating zusätzlich an `currentActIndex`**:
pro Gegnertyp ein „min. Akt"-Feld; der Roster-Filter berücksichtigt sowohl die
**Tiefe (Mindest-Floor, bleibt erhalten)** als auch den **erreichten Akt
(zusätzlicher Filter)**. Garantie: das gefilterte Roster wird **nie leer** —
greift kein Akt-erlaubter Typ, fällt die Logik auf einen sicheren
Frühphasen-Typ zurück.

**Erzählprinzip:** Tiefen-Gating sagt *wie stark*; Akt-Gating sagt *was die
Story schon eingeführt hat*. Beide zusammen verhindern, dass ein Wave-Grinder
narrativ späte Gegner sieht, bevor sie in der Geschichte vorkommen.

## 2. Stakeholders & Actors

- **Spieler** — taucht über „Der Hinabstieg" in beliebige Tiefe; soll keine
  narrativ verfrühten Gegnertypen sehen, aber auch nie einen leeren/kaputten
  Spawn erleben.
- **Enemy-Spawn-System** (`js/enemy.js`, `spawnEnemy` Z. 328–347) — wählt
  heute das Roster rein nach `DUNGEON_DEPTH`; wird um den Akt-Filter erweitert.
- **Story-System** (`js/storySystem.js`) — liefert `getCurrentActIndex()` /
  `window.storySystem.getCurrentActIndex()` als Gate-Eingang; bleibt
  unverändert (read-only-Konsument).
- **Roster-Gating-Modul** (neu, `js/enemySpawnGating.js`) — kapselt die reine
  Filter-Funktion `getAvailableEnemyTypes(depth, actIndex)` testbar als IIFE
  auf `window.EnemySpawnGating`.

## 3. User Scenarios

### Primary A: Tiefes Tauchen in frühem Akt
1. Spieler ist erzählerisch in Akt 1 (`currentActIndex` = 0/1) und taucht über
   „Der Hinabstieg" auf Tiefe 9+ (volles Tiefen-Roster).
2. Ohne dieses Feature: FlameWeaver/ChainGuard/Shadow können spawnen.
3. Mit diesem Feature: nur Typen, die der erreichte Akt freigibt, erscheinen —
   späte Typen werden ausgefiltert, Frühphasen-Typen füllen das Roster.

### Primary B: Story-Fortschritt schaltet Typen frei
1. Spieler schließt Akt-Quests ab; `currentActIndex` steigt.
2. Bei jeder Akt-Stufe werden die neu „freigegebenen" Gegnertypen in den
   tiefen-erlaubten Spawn-Pool aufgenommen.
3. Der Spieler erlebt neue Gegnertypen narrativ passend zum Story-Beat.

### Primary C: Fallback — Roster nie leer
1. In einer Tiefe/Akt-Kombination, in der die Schnittmenge
   (tiefen-erlaubt ∩ akt-erlaubt) **leer** wäre …
2. … greift die Fallback-Garantie: es wird mindestens ein sicherer
   Frühphasen-Typ (Tier-Animal/Imp) zurückgegeben.
3. Der Spawn funktioniert immer; es gibt nie einen Frame ohne wählbaren Typ.

### Edge: Explizit angeforderter Typ
- Ruft Code `spawnEnemy(x, y, enemyType)` mit konkretem `enemyType` (1–10) auf
  (z.B. scripted Boss/Event-Spawn), wird der **Akt-Filter NICHT angewendet** —
  ein explizit angeforderter Typ ist Absicht und wird respektiert (heutiges
  Verhalten bleibt).

## 4. Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | **Akt-Gate als zusätzlicher Filter**: `spawnEnemy` (random-Pfad) filtert das tiefen-erlaubte Roster zusätzlich nach `storySystem.getCurrentActIndex()`. Das bestehende Tiefen-Gating (`depth <= 2/4/6/8/full`) bleibt als **Mindest-Floor** unverändert erhalten. | Draft |
| FR-02 | **Pro-Typ Mindest-Akt-Mapping**: jeder Gegnertyp (1–10) erhält ein `minActIndex`-Feld (0–6). Mapping siehe Roster↔Akt-Tabelle (§4.1). Quelle der Wahrheit ist eine einzelne Datenstruktur im Gating-Modul. | Draft |
| FR-03 | **Reine, testbare Filter-Funktion**: `getAvailableEnemyTypes(depth, actIndex)` als seiteneffektfreie Funktion in `js/enemySpawnGating.js` (IIFE → `window.EnemySpawnGating`). `spawnEnemy` ruft sie statt der inline-`if`-Kette. | Draft |
| FR-04 | **Fallback-Garantie (Roster nie leer)**: ist die Schnittmenge (tiefen-erlaubt ∩ `minActIndex <= actIndex`) leer, liefert die Funktion einen nicht-leeren Fallback (mindestens der niedrigste tiefen-erlaubte Typ; ersatzweise Typ 8/Rat). Nie `[]`, nie `undefined`. | Draft |
| FR-05 | **Explizit angeforderter Typ unberührt**: wird `spawnEnemy` mit gültigem `enemyType` (1–10) aufgerufen, bleibt dieser Typ (kein Akt-Filter), wie heute. | Draft |
| FR-06 | **Defensive Akt-Quelle**: fehlt `window.storySystem`/`getCurrentActIndex`, wird der Akt defensiv als „voll freigegeben" (höchster Index) behandelt → kein Crash, kein leeres Roster (Verhalten wie ohne Feature). | Draft |
| FR-07 | **Keine Regression im Tiefen-Verhalten**: bei vollem Akt (`actIndex >= 6`) ist das gefilterte Roster **identisch** zum heutigen reinen Tiefen-Roster (Akt-Filter ist dann ein No-op). | Draft |
| FR-08 | **Einhängung**: `js/enemySpawnGating.js` wird vor `js/enemy.js` in `index.html` geladen, sodass `window.EnemySpawnGating` zur Spawn-Zeit existiert (defensiver Fallback falls nicht). | Draft |

### 4.1 Roster ↔ Akt-Mapping

Gegnertypen: 1=Imp, 2=Archer, 3=Brute, 4=Mage, 5=Shadow, 6=ChainGuard,
7=FlameWeaver, 8=Rat, 9=Bat, 10=Wolf.

Akt-Indizes (`STORY_ACTS`): 0=auftrag, 1=treuer_diener, 2=erste_risse,
3=wahrheit, 4=bruch, 5=rebellion, 6=offenbarung.

| Typ | Name | Tiefen-Floor (heute) | `minActIndex` | Begründung (narrativ) |
|-----|------|----------------------|---------------|------------------------|
| 8 | Rat | depth ≥ 1 | 0 (auftrag) | Wildtier — von Anfang an plausibel. |
| 9 | Bat | depth ≥ 1 | 0 (auftrag) | Wildtier — von Anfang an. |
| 10 | Wolf | depth ≥ 1 | 0 (auftrag) | Wildtier — von Anfang an. |
| 1 | Imp | depth ≥ 3 | 0 (auftrag) | Niederer Dämon — schon im Auftrag präsent. |
| 2 | Archer | depth ≥ 3 | 1 (treuer_diener) | Menschliche Schergen — ab dem Dienst beim Rat. |
| 3 | Brute | depth ≥ 5 | 1 (treuer_diener) | Rats-Schläger — ab dem Dienst. |
| 4 | Mage | depth ≥ 5 | 2 (erste_risse) | Arkane Gegner — erst wenn die Risse sichtbar werden. |
| 5 | Shadow | depth ≥ 7 | 3 (wahrheit) | Schattenwesen — gehören zur enthüllten Wahrheit. |
| 6 | ChainGuard | depth ≥ 9 | 4 (bruch) | Kettenrat-Garde — erst nach dem Bruch mit dem Rat. |
| 7 | FlameWeaver | depth ≥ 9 | 4 (bruch) | Ritual-Kaste — erst nach dem Bruch. |

**Lesart:** Ein Typ kann nur spawnen, wenn **sowohl** die Tiefe seinen
Tiefen-Floor erreicht **als auch** `currentActIndex >= minActIndex`. Beispiel:
ChainGuard (6) braucht Tiefe ≥ 9 **und** Akt ≥ 4 (`bruch`). Taucht der Spieler
in Akt 1 auf Tiefe 9, ist 6/7 akt-gefiltert; übrig bleiben die akt-erlaubten
tiefen-Typen — und wenn das leer würde, greift FR-04.

> Hinweis: Die Tiefen-Floors in der Tabelle leiten sich aus der heutigen
> inline-`if`-Kette (`js/enemy.js` Z. 335–345) ab und werden NICHT geändert;
> die `minActIndex`-Spalte ist die einzige neue Information.

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-01 | Performance unverändert: Filter ist O(Roster-Größe ≤ 10), kein per-Frame-Overhead über das heutige Roster-Picking hinaus. | 60fps Desktop / Mobile-Floor 053 nicht regredieren |
| NFR-02 | Keine neue Dependency; Vanilla-JS + Phaser-built-ins; klassische `<script>`-Einbindung. | — |
| NFR-03 | Reine Filter-Funktion ist ohne Phaser/DOM ladbar und unit-testbar (wie `eliteEnemies.test.js`). | `node tools/runTests.js` grün |

## 6. Constraints

| ID | Constraint |
|----|------------|
| C-01 | Tiefen-Gating bleibt **Mindest-Floor** — Akt-Gate ist nur ein **zusätzlicher** Filter, ersetzt das Tiefen-Gating nicht. |
| C-02 | Roster darf **nie leer** werden (FR-04) — sonst kaputter/leerer Spawn. |
| C-03 | `storySystem.js` bleibt read-only-Konsument; keine Änderung an Story-Progression oder `advanceToAct`. |
| C-04 | Explizit angeforderte Typen (`spawnEnemy(x,y,type)`) bleiben unberührt (FR-05). |
| C-05 | Save-/Story-State unverändert — kein neues Persistenz-Feld nötig (Akt kommt live aus `storySystem`). |

## 7. Success Criteria

| ID | Criterion |
|----|-----------|
| SC-01 | In Akt 0/1 auf Tiefe 9 spawnen **keine** Typen 5/6/7 (Shadow/ChainGuard/FlameWeaver). |
| SC-02 | Bei `currentActIndex >= 6` ist das gefilterte Roster identisch zum heutigen reinen Tiefen-Roster (FR-07). |
| SC-03 | Für jede Kombination aus `depth ∈ {1..12}` × `actIndex ∈ {0..6}` ist `getAvailableEnemyTypes` **nicht-leer** (FR-04). |
| SC-04 | Explizit angeforderter `enemyType` spawnt unverändert (FR-05). |
| SC-05 | Fehlt `storySystem`, spawnt das Spiel wie ohne Feature (voller Tiefen-Roster, kein Crash) (FR-06). |
| SC-06 | Alle bestehenden Tests + neue Gating-Tests grün (`node tools/runTests.js`). |

## 8. Edge Cases

- **Schnittmenge leer** (z.B. Tiefe 9, Akt 0 → tiefen-erlaubt {1,2,3,4,5,6,7},
  akt-erlaubt nur {1,8,9,10}): Schnittmenge = {1}. Falls eine künftige
  Mapping-Änderung das auf `[]` brächte → Fallback (FR-04).
- **actIndex außerhalb 0–6** (defekter State): clampen auf 0–6 bzw. defensiv
  als „voll" behandeln; nie crashen.
- **`depth` 0/undefiniert**: wie heute → Default 1.
- **Gating-Modul nicht geladen**: `spawnEnemy` fällt auf die bisherige
  inline-Tiefen-Logik zurück (defensiver Guard).

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| `js/enemySpawnGating.js` (neu) | IIFE → `window.EnemySpawnGating`: `ENEMY_MIN_ACT` (Typ→minActIndex), `DEPTH_TIERS`, reine `getAvailableEnemyTypes(depth, actIndex)`. |
| `js/enemy.js` | `spawnEnemy` Z. 328–347: ersetzt inline-`if`-Kette durch Aufruf des Gating-Moduls (mit defensivem Fallback). |
| `js/storySystem.js` | liefert `getCurrentActIndex()` als Gate-Eingang (read-only). |
| `index.html` | lädt `enemySpawnGating.js` vor `enemy.js`. |
| `tests/enemySpawnGating.test.js` (neu) | Unit-Tests: Mapping-Shape, Filter-Korrektheit, „nie leer", Tiefen-Identität bei voll-Akt, defensive Defaults. |

## 10. Assumptions

- `currentActIndex` ist ein verlässliches Story-Maß (seit 050 quest-getrieben,
  nicht mehr tiefen-abgeleitet) — im Code verifiziert (`onWaveCompleted`
  advanced den Akt nicht mehr, Z. 602–605).
- Das heutige Tiefen-Roster (Z. 335–345) ist die gewünschte Floor-Definition
  und soll als solche erhalten bleiben.
- Tier-/Animal-Typen (8/9/10) und Imp (1) sind sichere Frühphasen-Fallbacks.

## 11. Out of Scope

- Neue Gegnertypen oder Stat-/Balance-Änderungen bestehender Typen.
- Änderung der Tiefen-Floors selbst (nur Akt-Filter wird ergänzt).
- Quest-spezifisches (statt akt-grobes) Gating einzelner Typen — `currentActIndex`
  als Granularität reicht; feineres Quest-Gating ist eine spätere Option.
- Story-Progression / `advanceToAct` / Save-Format.

## 12. Dependencies

- Feature 050 (Akt-1-Quest-Chain) ✓ — macht `currentActIndex` quest-getrieben.
- `js/storySystem.js` ✓ — `getCurrentActIndex()` / `STORY_ACTS`.

## 13. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | Akt-Filter macht Roster leer → kaputter Spawn. | FR-04 Fallback-Garantie + dedizierter „nie-leer"-Test über alle depth×act-Kombinationen. |
| R-02 | Regression im Tiefen-Verhalten bei voll-Akt. | FR-07 + SC-02: Test auf Identität mit dem heutigen Roster. |
| R-03 | `storySystem` zur Spawn-Zeit nicht geladen → Crash. | FR-06 defensiver Default (voll freigegeben). |
| R-04 | Explizite Event-/Boss-Spawns versehentlich gefiltert. | FR-05: Akt-Filter nur im random-Pfad, nicht bei konkretem `enemyType`. |

## 14. References

- `js/enemy.js` — `spawnEnemy`, Tiefen-Roster Z. 328–347.
- `js/storySystem.js` — `STORY_ACTS` Z. 7–14, `getCurrentActIndex` Z. 518–520, Export Z. 1082–1102.
- `tests/eliteEnemies.test.js` — Vorlage für reine-Logik-Unit-Tests.
- Feature 050 (Akt-1-Quest-Chain, quest-getriebene Akt-Progression).
- GitHub #40.
