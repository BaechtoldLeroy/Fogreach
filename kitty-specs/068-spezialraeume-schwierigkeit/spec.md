# Spezifikation: Spezialräume — Schwierigkeit harmonisieren

**Feature**: 068-spezialraeume-schwierigkeit
**Mission**: software-dev
**Planungs-/Zielzweig**: `spec/issue-103`
**GitHub-Issue**: [#103](https://github.com/-/-/issues/103) — „Spezialräume: HP-Modifikator nur in survival — Schwierigkeit harmonisieren"
**Status**: Entwurf (Spezifikationsphase; kein Plan, keine Arbeitspakete)

> **Wichtig zur Entstehung**: Diese Spezifikation entstand OHNE Befragung des
> Projektinhabers. Alle Aussagen sind entweder **gemessen** (Abschnitt 2) oder
> **abgeleitet und als Annahme gekennzeichnet** (Abschnitt 8). Echte Lücken
> stehen als offene Frage in Abschnitt 9.

---

## 1. Problem

Ein Lauf besteht aus normalen Räumen (`clear`) und gelegentlichen Spezialräumen.
Vier Spezialmodi existieren: `survival`, `escape`, `defend`, `hunt`. Sie sollen
Abwechslung bringen — heute bringen sie vor allem **stark unterschiedliche
Schwierigkeit**, ohne dass irgendwo festgehalten wäre, wie schwer ein
Spezialraum überhaupt sein soll.

Der Auslöser im Issue ist der Gegner-HP-Multiplikator, den nur `survival`
liefert (×2). Die Messung (Abschnitt 2) zeigt: **der Multiplikator ist ein
Symptom, nicht die Ursache.** Selbst ohne ihn bliebe der Abstand zwischen den
Modi grösser als Faktor 2. Vier Modi drehen an vier unabhängigen Reglern
(Dauer, Nachschub-Takt, Schubgrösse, Gleichzeitigkeits-Deckel) plus einem
fünften (HP), und kein gemeinsames Budget begrenzt das Ergebnis.

---

## 2. Ist-Zustand — GEMESSEN

Alle Zahlen dieses Abschnitts sind gemessen, nicht aus den Konstanten
abgeschrieben. Zwei Messwege:

* **A — echtes Spiel, kopflos** (`tools/headless`, `launchDungeon`): Räume
  wurden wirklich betreten, Gegner über den echten `spawnEnemy`-Funnel erzeugt,
  HP am Objekt abgelesen. Je Stichprobe 300 Spawns, Elite-Würfe unterdrückt
  (Muster aus `tools/headless/lab.js`, Begründung #110).
* **B — echte Modul-Schleifen** (`js/roomMode*.js` gegen einen zählenden
  `spawnEnemy`-Ersatz): die Update-Schleife jedes Modus lief mit 16 ms/Tick über
  die volle Modus-Dauer, inklusive echter Deckel-Logik. Die Basis-HP je Gegner
  stammen aus Messung A.

### 2.1 Was ein Gegner an HP mitbringt (Messweg A, je 300 Spawns)

| Tiefe | `clear` | `survival` (×2) | `clear` + Edikt *Offener Aufstand* (×1,5) | `survival` + Edikt |
|---|---|---|---|---|
| 1 | 1,29 HP | 2,63 HP | 1,89 HP | 4,67 HP |
| 10 | 2,50 HP | 4,89 HP | 3,67 HP | 7,34 HP |
| 20 | 3,81 HP | 7,46 HP | 6,09 HP | **12,13 HP** (max. 18) |

**Befund**: Tiefe × Edikt × Modus stapeln tatsächlich multiplikativ auf dieselbe
HP. Auf Tiefe 20 ist ein gewöhnlicher Gegner im Überlebensraum mit aktivem
Edikt **3,2× so zäh** wie derselbe Gegner im Nachbarraum desselben Laufs
(12,13 gegen 3,81 HP; Spitzenwert 18 gegen 6).

### 2.2 Bekommt schon die BASISWELLE den Modus-Multiplikator? — Ja (Messweg A)

`enterRoom` ruft `startNextWave` **vor** `RoomMode.beginRoom`; `startNextWave`
spawnt aber über `time.delayedCall(0, …)`, also erst im nächsten Tick. Damit
sieht die Basiswelle den Modus bereits. Gemessen über `?dungeon=10&mode=<id>`
(erzwungener Modus im ersten Raum), Zustand direkt nach dem Raumaufbau:

| Modus | aktiver Multiplikator | Gegner im Raum | Ø HP je Gegner | höchste HP |
|---|---|---|---|---|
| clear | ×1 | 7 | 2,57 | 4 |
| survival | ×2 | 6 | **6,00** | 8 |
| escape | ×1 | 10 | 2,20 | 4 |
| defend | ×1 | 6 | 3,33 | 8 |
| hunt | ×1 | 8 | 4,25 | **12** (Rudelführer) |

Der ×2 wirkt also nicht nur auf den Nachschub, sondern auf den ganzen Raum.
Diese Wirkung hängt an einer **Reihenfolge, die nirgends zugesichert ist**
(delayedCall gegen direkten Aufruf) — ohne den Umweg über den Timer bekäme die
Basiswelle noch den Multiplikator des VORIGEN Raums.

### 2.3 Was ein Spezialraum insgesamt liefert (Messweg B)

Modellannahme: eine Tötungsrate `kps` (Gegner je Sekunde) gibt frei, wie schnell
der Gleichzeitigkeits-Deckel wieder Platz macht. Gemessen über ein Band
0,5–4,0 Gegner/s; ab 2,0 Gegner/s ist der Deckel nicht mehr bindend, die Werte
laufen in ein Plateau. **Tiefe 10, kps = 2,0** (kompetenter Spieler):

| Modus | Dauer | Gegner gesamt | Gegner-HP gesamt | HP je Sekunde | Ø HP je Gegner |
|---|---|---|---|---|---|
| `clear` (Referenz) | offen | 5 | **12,4** | – | 2,47 |
| `hunt` | offen | 9 | **34,6** | – | 2,47 (Ziel allein 14,8) |
| `defend` | 39 s | 23 | **56,9** | 1,46 | 2,47 |
| `escape` | 39 s | 62 | **153,3** | 3,93 | 2,47 |
| `survival` | 78 s | 67 | **331,4** | 4,25 | 4,95 |

**Tiefe 20, kps = 2,0**: clear 14,7 · hunt 47,8 · defend 103,0 · escape 279,7 ·
survival 603,5 Gegner-HP.

### 2.4 Die Kernzahlen des Issues

* **Spannweite zwischen den drei zeitgesteuerten Modi: Faktor 5,8** in gelieferter
  Gegner-HP (survival 331,4 gegen defend 56,9 auf Tiefe 10; auf Tiefe 20:
  Faktor 5,9). In Gegnerzahl: Faktor 2,9 (67 gegen 23).
* **Spannweite über ALLE Modi inklusive `clear`: Faktor 27** (331,4 gegen 12,4).
* **Der HP-Multiplikator erklärt davon nur einen Teil.** Ohne ihn läge survival
  bei 165,7 HP — immer noch **2,9×** defend. Die grössere Ursache ist der
  Nachschub-Durchsatz mal Dauer.
* **Nachschub-Durchsatz** (Schub ÷ Intervall), die eigentlich prägende Grösse:
  escape 1,50 Gegner/s · survival 0,80 · defend 0,50 · hunt 0 (nur 4 Gegner
  einmalig beim Betreten).
* **Nachschub-Obergrenze** (Dauer ÷ Intervall × Schub) auf Tiefe 10, exakt so
  gemessen: survival 62 · escape 57 · defend 18. survival und escape schicken
  also **fast gleich viele** Gegner; dass survival trotzdem 2,2× so viel HP
  liefert, kommt aus ×2-HP mal doppelter Dauer.
* **`hunt` ist NICHT reglerlos** — hier korrigiert die Messung das Issue. `hunt`
  spawnt 4 Extra-Gegner (`EXTRA_ENEMIES`) und macht ein Ziel zum Mini-Boss:
  Champion-Elite ×1,5 mal `HUNT_HP_MULT` ×4,0 = **×6,0** auf einen Gegner. Im
  Raum gemessen: 12 HP gegen 2,57 HP Raumdurchschnitt bei `clear`. `hunt` hat
  nur keinen Regler, der über `RoomMode.enemyHpMultiplier()` läuft.

### 2.5 Wie oft trifft man das überhaupt? (200 000 Ziehungen, `selectForRoom`)

Auf Tiefe 10 sind **20,0 %** der in Frage kommenden Räume Spezialräume:
`defend` 5,31 % · `hunt` 5,27 % · `survival` 5,22 % · `escape` 4,21 % ·
`clear` 79,98 %. Der schwerste und der leichteste Spezialmodus sind also
praktisch **gleich wahrscheinlich** — die Spannweite aus 2.4 trifft den Spieler
als reines Würfelergebnis.

### 2.6 Wo die Werte heute stehen

Fünf Dateien, kein gemeinsamer Ort:

| Datei | Regler darin |
|---|---|
| `js/roomModeSurvival.js` | `BASE_SECONDS 60`, `MAX_SECONDS 120`, `SPAWN_INTERVAL 2.5`, `SPAWN_BATCH 2`, `MAX_CONCURRENT 14`, `HP_MULT 2` |
| `js/roomModeEscape.js` | `BASE_SECONDS 30`, `MAX_BONUS 30`, `SPAWN_INTERVAL 2.0`, `SPAWN_BATCH 3`, `MAX_CONCURRENT 16` |
| `js/roomModeDefend.js` | `BASE_SECONDS 30`, `MAX_BONUS 20`, `SPAWN_INTERVAL 4.0`, `SPAWN_BATCH 2`, `MAX_CONCURRENT 8`, `BASE_HP 100`, `DRAIN_PER_ENEMY_PER_SEC 1.5`, `DRAIN_ESCALATION 0.2` |
| `js/roomModeHunt.js` | `HUNT_HP_MULT 4.0`, `EXTRA_ENEMIES 4` |
| `js/roomModes.js` | `SPECIAL_WEIGHTS`, Auswahlwahrscheinlichkeit `p` |

Dazu die Fremdquellen auf derselben HP: Tiefen-Skalierung `1 + (Tiefe-1)*0,1`
(`js/enemy.js`) und `printingBuffs.enemyHpMult` (Edikt *Offener Aufstand* ×1,5,
`js/printingHouse.js`).

---

## 3. Zielbild

Ein Spezialraum soll sich **anders** anfühlen als ein normaler Raum und anders
als die übrigen Spezialräume — aber nicht **beliebig viel schwerer**. Nach der
Änderung soll gelten:

1. Es gibt **eine** Stelle, an der die Schwierigkeit jedes Modus abgelesen und
   verändert werden kann.
2. Die Spezialmodi liegen in einem **festgelegten, engen Band** zueinander.
3. Die Stapelung Tiefe × Edikt × Modus hat eine **benannte Obergrenze**.
4. Jeder Modus trägt seine Schwierigkeit über einen **erklärbaren Regler**
   (Zähigkeit, Menge oder Zeit), nicht über zufällig gewachsene Konstanten.

Nicht Ziel: die Modi gleich schwer machen. Unterschiedliche Handschrift ist
gewollt — nur der Abstand soll bekannt und gedeckelt sein.

---

## 4. Nutzerszenarien

### S1 — Spieler betritt einen Spezialraum auf mittlerer Tiefe
Der Spieler räumt seit einigen Räumen normal. Der nächste Raum kündigt ein
Spezialziel an. Er erkennt am Banner, worum es geht, und der Raum fordert ihn
spürbar mehr als ein normaler Raum — aber er kann einschätzen, worauf er sich
einlässt, **egal welcher der vier Modi gezogen wurde**.
*Heute*: je nach Würfel liefert der Raum 57 oder 331 Gegner-HP (Faktor 5,8).

### S2 — Spieler mit riskantem Edikt auf grosser Tiefe
Der Spieler hat *Offener Aufstand* gewählt (mehr Gold, zähere Gegner) und läuft
auf Tiefe 20. Er zieht einen Überlebensraum. Die Gegner sind zäher als sonst —
aber nicht so weit über allem anderen, dass der Raum mit den Werkzeugen dieses
Laufs unspielbar wird.
*Heute*: 12,13 HP Ø gegen 3,81 HP im Nachbarraum, Spitze 18 HP.

### S3 — Entwickler will die Schwierigkeit eines Modus verändern
Jemand findet den Fluchtraum zu hektisch. Er findet **einen** Ort, an dem
Dauer, Nachschub und Zähigkeit aller vier Modi nebeneinander stehen, ändert
einen Wert und sieht am selben Ort, wie sich der Modus zu den anderen verhält.
*Heute*: fünf Dateien, keine gemeinsame Sicht, kein Vergleichsmass.

### S4 — Jagdraum
Der Spieler zieht einen Jagdraum. Der Rudelführer ist klar zäher als der Trash
und trägt die Schwierigkeit des Raums.
*Heute*: funktioniert, ist aber nirgends als Regler geführt und daher beim
Angleichen unsichtbar (das Issue hielt `hunt` für reglerlos).

### Randfälle
* Erster Raum, Bossraum und Spionageraum sind immer `clear` — dort darf kein
  Modus-Regler greifen.
* Ein Modus-Wechsel darf keinen Regler in den nächsten Raum schleppen.
* `escape` hat die Treppe von Anfang an offen: der Spieler kann jederzeit gehen,
  das Durchhalten ist freiwillig (Bonus-Truhe). Sein Schwierigkeitsbeitrag ist
  damit **optional**, anders als bei `survival`/`defend`/`hunt`.
* `defend` kann verfehlt werden (Altar fällt) und endet dann früher.
* Fällt der Nachschub-Deckel weg oder tötet der Spieler nicht, sinkt der
  Durchsatz — gemessen bei kps 0,5 statt 2,0: survival 257 statt 331 HP,
  escape 84 statt 153. Die Rangfolge bleibt in jedem gemessenen Band gleich.

---

## 5. Funktionale Anforderungen

| ID | Anforderung | Status |
|---|---|---|
| FR-001 | Es existiert **eine** gemeinsame Quelle, die für jeden Spezialmodus (`survival`, `escape`, `defend`, `hunt`) alle Schwierigkeitsregler führt: Dauer, Nachschub-Intervall, Schubgrösse, Gleichzeitigkeits-Deckel, Gegner-HP-Faktor, sowie modus-eigene Werte (Altar-HP/Drain, Ziel-HP-Faktor). | Offen |
| FR-002 | Jedes Modus-Modul liest seine Werte aus dieser Quelle, statt sie als eigene Konstanten zu führen. Bestehende Modul-Konstanten werden ersetzt, nicht dupliziert. | Offen |
| FR-003 | Der Gegner-HP-Faktor jedes Modus wird einheitlich über `RoomMode.enemyHpMultiplier()` geführt. Der bestehende Zielgruppen-Boost von `hunt` (Champion ×1,5 × `HUNT_HP_MULT` 4,0) wird als das ausgewiesen, was er ist: ein Regler — auch wenn er weiterhin nur auf den Rudelführer wirkt. | Offen |
| FR-004 | Der gemeinsame HP-Pfad hat eine **benannte Obergrenze** für das Produkt aus Tiefen-Skalierung, Edikt-Faktor und Modus-Faktor. Übersteigt das Produkt die Grenze, wird auf die Grenze gedeckelt. | Offen |
| FR-005 | Für die drei zeitgesteuerten Modi (`survival`, `escape`, `defend`) ist ein **Schwierigkeitsbudget** definiert und dokumentiert, gemessen in gelieferter Gegner-HP je Raum und in Gegner-HP je Sekunde. Die Modi liegen innerhalb des in NFR-001/NFR-002 festgelegten Bands. | Offen |
| FR-006 | Für jeden Modus ist benannt, **welcher Regler** seine Schwierigkeit trägt (Zähigkeit / Menge / Zeit). Ein Modus ändert seine Zuordnung nur bewusst, nicht als Nebenwirkung. | Offen |
| FR-007 | Der Beitrag von `hunt` und `clear` zum Band wird ausdrücklich geregelt: `hunt` ist zielgetrieben ohne Dauer und liegt heute bei 34,6 HP (Tiefe 10) — ob es ins Band der zeitgesteuerten Modi gehört oder eine eigene Klasse ist, wird entschieden und festgehalten. | Offen |
| FR-008 | Die Basiswelle eines Spezialraums erhält den Modus-Faktor **zugesichert** und nicht als Nebenwirkung der Aufrufreihenfolge (`startNextWave` vor `beginRoom`, Rettung durch `delayedCall(0)`). Die Zusicherung ist durch einen Test gedeckt. | Offen |
| FR-009 | Beim Raumwechsel wird jeder Modus-Regler zurückgesetzt; ein Raum ohne Spezialmodus (`clear`, erster Raum, Boss, Spionage) liefert unverändert ×1 und keine Zusatz-Spawns. | Offen |
| FR-010 | Die gemessene Ist-Lage (Abschnitt 2) und die gewählten Zielwerte stehen als Kommentar bei der gemeinsamen Quelle, damit spätere Änderungen nicht wieder blind erfolgen. | Offen |

## 6. Nicht-funktionale Anforderungen

| ID | Anforderung | Schwelle | Status |
|---|---|---|---|
| NFR-001 | Die gelieferte **Gegner-HP je Raum** der drei zeitgesteuerten Modi liegt innerhalb eines Bandes von höchstens **Faktor 2,0** zwischen schwerstem und leichtestem Modus, gemessen bei Tiefe 10 und Tiefe 20 mit kps = 2,0. | heute Faktor 5,8 (T10) bzw. 5,9 (T20) → Ziel ≤ 2,0 | Offen |
| NFR-002 | Die **Gegner-HP je Sekunde** der drei zeitgesteuerten Modi liegt innerhalb eines Bandes von höchstens **Faktor 1,8**. | heute 4,25 / 3,93 / 1,46 = Faktor 2,9 → Ziel ≤ 1,8 | Offen |
| NFR-003 | Ein Spezialraum liefert mindestens **3×** und höchstens **12×** die Gegner-HP eines `clear`-Raums derselben Tiefe (Untergrenze: er soll sich als Ereignis anfühlen; Obergrenze: er soll kein Lauf-Ende sein). | heute 2,8× (hunt) · 4,6× (defend) · 12,4× (escape) · 26,7× (survival) auf Tiefe 10 | Offen |
| NFR-004 | Der **gestapelte** HP-Faktor eines einzelnen Gegners (Tiefe × Edikt × Modus) überschreitet den Wert eines gleichwertigen `clear`-Gegners derselben Tiefe um höchstens **Faktor 2,5**. | heute 3,2× (Tiefe 20, survival + *Offener Aufstand*: 12,13 gegen 3,81 HP) | Offen |
| NFR-005 | Die Änderung ändert das Spielerlebnis in `clear`-Räumen **nicht messbar**: Gegnerzahl und Gegner-HP eines `clear`-Raums bleiben bei gleicher Tiefe und gleicher begehbarer Fläche identisch zu heute. | Abweichung 0 | Offen |
| NFR-006 | Die Modus-Auswahlwahrscheinlichkeit bleibt unverändert (20,0 % Spezialräume auf Tiefe 10; Verteilung wie in 2.5), sofern nicht ausdrücklich anders entschieden. | Abweichung ≤ 0,5 Prozentpunkte über 200 000 Ziehungen | Offen |
| NFR-007 | `node tools/runTests.js` läuft grün. Die bestehenden 748 Tests (747 grün, 1 bewusstes `todo` zu #84) bleiben grün oder werden bewusst und begründet angepasst. | 0 neue Fehlschläge | Offen |
| NFR-008 | Die Zielwerte sind mit demselben kopflosen Messweg nachprüfbar, mit dem der Ist-Zustand gemessen wurde — die Messung wird als Test hinterlegt, nicht als Einmal-Skript. | Messung reproduzierbar | Offen |

## 7. Randbedingungen

| ID | Randbedingung | Status |
|---|---|---|
| C-001 | Klassische Skripte mit `window`-Globalen, keine Module. `let`/`const` auf oberster Ebene sind von aussen **nicht** erreichbar — eine gemeinsame Werte-Quelle muss über `window.<Name>` hängen, sonst ist sie weder testbar noch von anderen Dateien lesbar. | Fest |
| C-002 | Alle Nutzertexte auf Deutsch mit echten Umlauten (`ä ö ü`). Asset-Schlüssel und IDs bleiben unverändert. | Fest |
| C-003 | Jede Änderung unter `js/` erfordert einen `?v=`-Bump der betroffenen Skript-Einbindungen in `index.html` **und** eine neue `GAME_VERSION` in `js/version.js` (samt deren eigenem `?v=`). | Fest |
| C-004 | Die Ladereihenfolge in `index.html` muss stimmen: eine neue gemeinsame Werte-Datei muss **vor** `roomModes.js` und den vier Modus-Dateien geladen werden, sonst greift der Zugriff zur Registrierungszeit ins Leere (bekannte Falle: `mobileAbilityButtons.js` gegen `i18n.js`). | Fest |
| C-005 | Der Phaser-Loop läuft in einem versteckten Browser-Tab nicht; optische Abnahme braucht ein echtes Fenster. Logik und Globale sind kopflos prüfbar. | Fest |
| C-006 | Keine Änderung an `js/enemy.js`-Fremdquellen (Tiefen-Skalierung, Edikt-Faktor) ausser dem gemeinsamen Deckel aus FR-004 — Edikt-Balance ist nicht Teil dieses Features. | Fest |
| C-007 | Der Fix ist nach dem Muster „Fix testweise entfernen und prüfen, dass der Test WIRKLICH fällt" abzusichern (Mutationsprobe). | Fest |

---

## 8. Annahmen

Jede dieser Aussagen ist **abgeleitet**, nicht bestätigt. Sie wären die erste
Liste, die ein Gespräch mit dem Projektinhaber prüfen müsste.

* **A-01 — Ziel ist Angleichen, nicht Absenken.** Das Issue sagt
  „harmonisieren", nicht „leichter machen". Angenommen: die Modi rücken
  aufeinander zu; wo genau das Band liegt, ist eine Balance-Entscheidung. Die
  Zahlen in NFR-001..003 sind als **Vorschlag** gesetzt, nicht als Vorgabe des
  Inhabers.
* **A-02 — `survival` ist heute zu schwer, nicht `defend` zu leicht.**
  Angenommen, weil `survival` mit 331 HP auch gegen den `clear`-Raum (12,4 HP)
  völlig aus dem Rahmen fällt, während `defend` mit 56,9 HP nur 4,6× darüber
  liegt. Falsch, wenn der Inhaber Spezialräume grundsätzlich als Grossereignis
  will — dann müssten defend und hunt steigen statt survival sinken.
* **A-03 — Gelieferte Gegner-HP je Raum ist das richtige Vergleichsmass.**
  Angenommen, weil sie Zähigkeit und Menge in einer Zahl zusammenführt.
  Sie unterschlägt Gegnerschaden, Gleichzeitigkeit und Raumgeometrie. Für die
  Frage „welcher Modus ist schwerer" ist sie die beste verfügbare Einzelzahl,
  aber sie ist kein Ersatz für einen Spieldurchlauf je Modus (der Hinweis am
  Ende des Issues fordert genau das).
* **A-04 — Tötungsrate 2,0 Gegner/s ist der Referenzspieler.** Angenommen, weil
  ab dieser Rate der Gleichzeitigkeits-Deckel in allen Modi aufhört zu binden;
  die Messung wird damit unabhängig von der Spielstärke. Bei 0,5 Gegner/s
  ändern sich die Absolutwerte, die Rangfolge nicht.
* **A-05 — `escape` darf leichter sein als sein Durchsatz vermuten lässt**,
  weil die Treppe von Anfang an offen ist und das Durchhalten freiwillig bleibt.
  Angenommen aus dem Kommentar in `roomManager.js`. Ob das Band von NFR-001
  deshalb für `escape` anders gelten soll, ist offen (siehe Q2).
* **A-06 — `clear` bleibt unverändert.** Angenommen, weil das Issue nur die
  Spezialräume nennt und `clear` ~80 % aller Räume stellt; eine Änderung dort
  würde das ganze Spiel verschieben.
* **A-07 — Die Auswahlwahrscheinlichkeit (20 % auf Tiefe 10) bleibt.**
  Angenommen, weil das Issue sie nicht erwähnt. Sie ist aber ein Hebel: seltener
  gezogene Spezialräume dürften härter sein.
* **A-08 — Der Deckel aus FR-004 ist multiplikativ und wirkt am Gegner**, nicht
  als Neuverteilung der drei Quellen. Angenommen als einfachste Form.
* **A-09 — `hunt` behält seinen Ziel-Boost.** Angenommen, weil er die Identität
  des Modus ist („erlege den Rudelführer"); er wird nur sichtbar gemacht, nicht
  entfernt.
* **A-10 — Mission `software-dev`.** Abgeleitet aus dem Issue (Code-Änderung
  mit Tests), nicht bestätigt.
* **A-11 — Die Reihenfolge-Rettung durch `delayedCall(0)` ist unbeabsichtigt.**
  Angenommen, weil kein Kommentar sie erwähnt und `enterRoom` die Aufrufe in der
  umgekehrten Reihenfolge notiert. Sie funktioniert heute — FR-008 will sie
  festschreiben, nicht ändern.

---

## 9. Offene Fragen

Echte Lücken, die aus Code und Issue **nicht** beantwortbar sind:

* **Q1 — Wo soll das Band liegen?** NFR-001 schlägt Faktor 2,0 vor, weil das die
  heutige Spannweite etwa dritteln würde und ein spürbarer, aber nicht
  willkürlicher Unterschied bleibt. Der Wert ist eine Balance-Entscheidung des
  Inhabers, keine technische Ableitung.
* **Q2 — Zählt `escape` ins selbe Band?** Sein Ziel ist freiwillig (offene
  Treppe). Entweder gilt für ihn dasselbe Band, oder er bekommt ein eigenes,
  höheres — mit der Begründung, dass der Spieler jederzeit aussteigen kann.
* **Q3 — Soll `hunt` einen breitenwirksamen Regler bekommen?** Heute trägt ein
  einzelner Gegner die Schwierigkeit. Das ist konsistent mit dem Modus-Namen,
  macht ihn aber zum leichtesten Spezialraum nach `defend` (34,6 HP). Alternativ:
  Ziel bleibt wie es ist, aber `hunt` wird ausdrücklich als eigene, leichtere
  Klasse geführt (dann greift NFR-001 nicht für ihn).
* **Q4 — Ist die Stapelung Tiefe × Edikt × Modus gewollt?** Das Issue nennt sie
  als „an drei Stellen unabhängig gewachsen". NFR-004 schlägt einen Deckel bei
  Faktor 2,5 gegenüber einem `clear`-Gegner derselben Tiefe vor — der konkrete
  Wert braucht eine Entscheidung.

---

## 10. Erfolgskriterien

| ID | Kriterium |
|---|---|
| SC-001 | Zwischen dem schwersten und dem leichtesten zeitgesteuerten Spezialmodus liegt auf Tiefe 10 **höchstens Faktor 2,0** in gelieferter Gegner-HP (heute 5,8) und **höchstens Faktor 1,8** in Gegner-HP je Sekunde (heute 2,9). |
| SC-002 | Kein Spezialraum liefert weniger als **3×** oder mehr als **12×** die Gegner-HP eines `clear`-Raums derselben Tiefe (heute 2,8× für `hunt` bis 26,7× für `survival`). |
| SC-003 | Ein einzelner Gegner ist auf Tiefe 20 mit riskantem Edikt im Spezialraum **höchstens 2,5×** so zäh wie im `clear`-Raum desselben Laufs (heute 3,2×). |
| SC-004 | Alle Schwierigkeitsregler der vier Modi sind an **einer** Stelle ablesbar; ein Entwickler kann die Verhältnisse ohne Öffnen der vier Modus-Dateien vergleichen. |
| SC-005 | Für jeden der vier Modi ist in einem Satz benannt, welcher Regler seine Schwierigkeit trägt. |
| SC-006 | Ein `clear`-Raum liefert bei gleicher Tiefe und Fläche exakt dieselbe Gegnerzahl und Gegner-HP wie vor der Änderung. |
| SC-007 | Die Messung aus Abschnitt 2 ist als Test hinterlegt und schlägt fehl, wenn ein Modus-Regler das Band wieder verlässt. |
| SC-008 | `node tools/runTests.js` grün; `?v=` und `GAME_VERSION` gebumpt. |

---

## 11. Schlüsselgrössen (Begriffe)

| Begriff | Bedeutung |
|---|---|
| **Spezialraum** | Raum mit einem anderen Modus als `clear`. Erster Raum, Bossraum und Spionageraum sind nie speziell. |
| **Gelieferte Gegner-HP** | Summe der Maximal-HP aller Gegner, die ein Raum über seine Lebensdauer erzeugt (Basiswelle + Nachschub). Vergleichsmass dieses Features. |
| **Nachschub-Durchsatz** | Schubgrösse ÷ Nachschub-Intervall, in Gegnern je Sekunde. |
| **Gleichzeitigkeits-Deckel** | Obergrenze lebender Gegner, ab der der Nachschub pausiert. |
| **Modus-Faktor** | Gegner-HP-Multiplikator des aktiven Modus (`RoomMode.enemyHpMultiplier()`). |
| **Gestapelter Faktor** | Produkt aus Tiefen-Skalierung, Edikt-Faktor und Modus-Faktor auf derselben Gegner-HP. |

---

## 12. Abgrenzung

**Nicht Teil dieses Features**: Balance der Edikte, Elite-Affix-Werte,
Boss-/Mini-Boss-Skalierung, die Auswahlwahrscheinlichkeit von Spezialräumen
(ausser als bewusste Entscheidung zu Q3/A-07), neue Spezialmodi, sowie die
optische Darstellung der Modi (`roomModeVisuals.js`).

---

## Anhang A — Wie gemessen wurde

Reproduzierbar, alle Skripte kopflos, keine Änderung an Spielcode:

1. **Gegner-HP je Modus** — `launchDungeon({depth})` aus
   `tools/headless/index.js`, dann je 300 Spawns über den echten
   `spawnEnemy`-Funnel bei erzwungenem `RoomMode.enemyHpMultiplier()` und
   erzwungenem `printingBuffs.enemyHpMult`; Elite-Würfe unterdrückt.
2. **Basiswelle je Modus** — `launch({search:'?dungeon=10&mode=<id>'})`; der
   Debug-Einstieg `?mode=` erzwingt den Modus im ersten Raum. Gegnerliste direkt
   nach dem Raumaufbau ausgelesen.
3. **Raum-Durchsatz je Modus** — die echten Modul-Schleifen aus
   `js/roomMode*.js` (über das `loadGameModule`-Muster aus `tests/`) gegen einen
   zählenden `spawnEnemy`-Ersatz, 16 ms je Tick über die volle Modus-Dauer, mit
   Tötungsraten 0,5/1,0/2,0/4,0 Gegner je Sekunde und den unter 1. gemessenen
   Basis-HP.
4. **Auswahlverteilung** — 200 000 Aufrufe von `RoomMode.selectForRoom`.

Vorbild für das Vorgehen: `tests/doorwayCorner.test.js` und
`tests/treppenPlatzierung.test.js`.
