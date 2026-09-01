# Feature-Spezifikation: Ereignisse im Blickbereich

**Feature**: 068-events-im-blickbereich
**Mission**: software-dev
**Erstellt**: 2026-09-01
**Quelle**: GitHub-Issue [#112](https://github.com/) — „Raum-Ereignisse erst ausloesen, wenn sie im Blickbereich liegen"
**Status**: Entwurf zur Freigabe

> **Hinweis zum Entstehungsweg**: Diese Spezifikation wurde ohne Befragung des
> Projektinhabers erstellt. Alle Luecken sind entweder aus dem Quelltext
> abgeleitet und im Abschnitt **Annahmen** einzeln als solche gekennzeichnet
> oder als **Offene Frage** markiert. Jede Annahme laesst sich einzeln
> bestaetigen oder verwerfen; verworfene Annahmen aendern die zugehoerigen
> Anforderungen.

---

## 1. Problem und Ziel

Ein Raum-Ereignis (Altar-Verteidigung, Ueberleben) beginnt heute in dem
Augenblick, in dem der Spieler den Raum betritt. Die Uhr laeuft, Nachschub
spawnt und die Treppe ist gesperrt, bevor der Spieler ueberhaupt weiss, worum
es geht — er sucht erst das Ziel, waehrend er schon unter Druck steht. Das
wirkt willkuerlich statt lesbar.

Ziel: Ein Raum-Ereignis beginnt erst, wenn der Spieler es **sehen** kann. Bis
dahin liegt es sichtbar, aber untaetig im Raum und macht neugierig. Wer es
nicht antritt, darf den Raum verlassen — das Ereignis ist ein **Angebot**,
keine Pflicht. Erst wenn es laeuft, gilt wieder: durchhalten oder scheitern.

**Nicht betroffen**: Die Boss-Sperre aus #109. Der Voll-Boss bleibt Pflicht.

---

## 2. Ist-Zustand (aus dem Quelltext erhoben)

Diese Spezifikation setzt bewusst auf dem tatsaechlichen Ausloeser auf, nicht
auf einem vermuteten. Fundstellen (Stand `main`, Commit `93787bd`):

| # | Sachverhalt | Fundstelle |
|---|---|---|
| I-1 | Die im Issue genannten „Raum-Ereignisse" sind die **Raum-Modi** aus Feature 061, nicht die Zufallsereignisse aus `js/eventSystem.js`. Registrierung ueber `window.RoomMode.register(...)`. | `js/roomModes.js:33`, `js/roomModeDefend.js:228`, `js/roomModeSurvival.js:113` |
| I-2 | **Der Ausloeser ist heute das Betreten des Raums** — weder Naehe noch Sicht noch Zeit. `enterRoom` ruft `RoomMode.beginRoom(scene, info)` direkt nach dem Wellenstart; `beginRoom` waehlt den Modus und ruft sofort dessen `start()`. | `js/roomManager.js:1339-1348`, `js/roomModes.js:76-88` |
| I-3 | `DefendMode.start()` stellt den Altar in die Raummitte, startet Timer und Nachschub-Schuebe und setzt `window.__ENEMY_CHASE_OVERRIDE__` — alles im selben Bild. | `js/roomModeDefend.js:123-166` |
| I-4 | `SurvivalMode.start()` hat **kein Weltobjekt**: nur Timer, Nachschub-Ring um den Spieler und ein HP-Multiplikator (`×2`). Es gibt nichts, was man „sehen" koennte. | `js/roomModeSurvival.js:74-79`, `:105` |
| I-5 | Die **Treppensperre haengt am Raumaufbau**, nicht am Ereignis: unmittelbar nach `beginRoom` wird fuer jeden Spezialmodus ausser `escape` `lockStairs(scene, true)` gerufen. | `js/roomManager.js:1350-1361` |
| I-6 | Entsperrt wird ueber `markRoomCleared`, das `RoomMode.updateActive` bei erfuelltem `isComplete()` ausloest. | `js/roomModes.js:102-120`, `js/roomManager.js:1553-1566` |
| I-7 | Eine **Sichtbarkeitspruefung existiert bereits**: `scene._lastVisionPolygon` (flaches `[x0,y0,x1,y1,…]`-Array) wird je Fog-Tick aus `computeVisionPolygon` gebaut. `hasLineOfSightToTarget` macht daraus einen Punkt-im-Polygon-Test mit **wiederverwendetem** `Phaser.Geom.Polygon`. | `js/roomManager.js:1872-1879`, `js/player.js:904-924` |
| I-8 | Das Sichtpolygon ist ein **360°-Radialpolygon** (kein Blickrichtungs-Kegel), Reichweite `VISION_RADIUS = 220` px, an Waenden und geschlossenen Tueren beschnitten. | `js/roomManager.js:1961`, `:2066-2092` |
| I-9 | Auf Mobilgeraeten wird das Polygon nur jeden 6. Frame neu gebaut (`fogSkipInterval = 6`); Tuer-/Prop-Aenderungen erzwingen einen Sofort-Tick. | `js/roomManager.js:1853-1859` |
| I-10 | `hasLineOfSightToTarget` faellt **„offen"** zurueck, wenn noch kein Polygon vorliegt — richtig fuer den Kampf, aber als Ereignis-Ausloeser falsch (das Ereignis wuerde in fruehen Bildern sofort starten). | `js/player.js:908-912` |
| I-11 | **Nebenwirkung Belohnung**: `allowWaveClearUnlock()` liefert in Spezialraeumen `false`, deshalb ueberspringt `wave.js` den ganzen `markRoomCleared`-Pfad — inklusive Proc-Raum-Belohnung. Ein nie gestartetes Ereignis wuerde den Raum also **belohnungslos** machen. | `js/roomModes.js:124-126`, `js/wave.js:228-242`, `js/roomManager.js:1587-1613` |
| I-12 | Reichweiten-Kollision: der Sichtradius (220 px) ist **kleiner** als der Defend-Spawnring (150–240 px) und liegt nur knapp ueber dem Drain-Radius (190 px). Wer den Altar sieht, steht praktisch schon in der Kampfzone. | `js/roomModeDefend.js:39-40`, `js/roomManager.js:1961` |

**Folgerung für den Zuschnitt**: Der billigste Weg ist tatsaechlich die
Wiederverwendung von `scene._lastVisionPolygon` (I-7). Es braucht keine zweite
Raycast-Schleife. Zwei Dinge muessen aber anders sein als im Kampf: die
Fallback-Richtung (I-10) und ein Anker fuer `survival` (I-4).

---

## 3. Abgrenzung: die zwei Faelle aus dem Issue

Das Issue nennt „Ueberleben ebenfalls an einen Abschnitt oder Ausloeser binden".
Das ist **nicht derselbe Mechanismus**, sondern ein zweiter Fall:

* **Fall A — Altar-Verteidigung (`defend`)**: Es gibt bereits ein sichtbares
  Weltobjekt (den Altar). „Im Blickbereich" ist unmittelbar definierbar: liegt
  der Altarpunkt im Sichtpolygon, beginnt das Ereignis. Rein additive
  Aenderung.
* **Fall B — Ueberleben (`survival`)**: Es gibt **kein** Weltobjekt (I-4). Ohne
  Anker ist „im Blickbereich" nicht definierbar. Der Modus braucht zuerst ein
  eigenes, sichtbares Ereignis-Objekt (Ankerpunkt), an dem derselbe
  Sicht-Auslöser dann haengen kann. Das ist zusaetzliche Arbeit, kein
  Nebeneffekt von Fall A.

Beide Faelle teilen sich denselben Auslöse-Baustein und dieselbe
Treppen-Regel; nur Fall B braucht zusaetzlich einen Anker.

---

## 4. Nutzer-Szenarien

### 4.1 Hauptablauf — Angebot annehmen (Fall A)

1. Der Spieler betritt einen Raum mit Altar-Verteidigung.
2. Der Altar steht sichtbar, aber ruhig im Raum. Kein Timer, kein Banner, keine
   markierte Kampfzone, kein zusaetzlicher Nachschub. Die Treppe ist offen.
3. Der Spieler erkundet, bekommt den Altar in Sicht.
4. Das Ereignis beginnt: Banner, Timer, Kampfzonen-Markierung, Nachschub. Die
   Treppe schliesst sich.
5. Der Spieler haelt die Dauer durch → Ziel erfuellt, Treppe oeffnet,
   Bonus-Truhe.

### 4.2 Angebot ausschlagen

1. Der Spieler betritt denselben Raum.
2. Er sieht den Altar nicht (oder geht ihm aus dem Weg) und laeuft zur Treppe.
3. Die Treppe ist offen. Er steigt ab, ohne das Ereignis ausgeloest zu haben.
4. Es gibt keine Strafe, aber auch keine Bonus-Truhe.

### 4.3 Scheitern

1. Der Spieler loest das Ereignis aus, der Altar faellt.
2. Ziel verfehlt: keine Bonus-Truhe, Raum oeffnet sich trotzdem — unveraendert
   zum heutigen Verhalten.

### 4.4 Raum raeumen, ohne das Ereignis anzutreten

1. Der Spieler toetet alle Gegner der normalen Welle, beruehrt das Ereignis
   aber nie.
2. Der Raum verhaelt sich wie ein gewoehnlicher Raum: Wellen-Clear, normale
   Raum-Belohnung, Treppe offen. (Siehe I-11 — ohne diese Regel bliebe der Raum
   belohnungslos.)

### 4.5 Ueberleben (Fall B)

1. Der Spieler betritt einen Ueberlebens-Raum. Ein ruhiger, sichtbarer Anker
   steht im Raum.
2. Bis der Anker in Sicht kommt, laeuft kein Timer, spawnt kein Nachschub und
   sind die Gegner nicht zaeher.
3. Kommt der Anker in Sicht, beginnt der Ansturm wie bisher.

### 4.6 Randfaelle

| Fall | Erwartung |
|---|---|
| Noch keine Sichtdaten (erste Bilder nach dem Raumaufbau) | Ereignis startet **nicht** (siehe I-10) |
| Ziel nur kurz gesehen, Spieler dreht ab | Ereignis bleibt gestartet — kein Zurueckfallen in den Ruhezustand |
| Ziel steht hinter einer Saeule/Wand, Spieler laeuft daran vorbei | Ereignis startet nicht (Sichtpolygon ist wandbeschnitten) — siehe Offene Frage Q1 |
| Spieler verlaesst den Raum mit laufendem Ereignis | Nicht moeglich: die Treppe ist waehrend des laufenden Ereignisses gesperrt |
| Raumwechsel / Modus-Wechsel | Anker und Zustand werden vollstaendig aufgeraeumt (`stop()`); nichts bleibt in den naechsten Raum haengen |
| Spiel pausiert (Inventar offen) | Der Auslöser prueft nicht weiter; die bestehende Pause-Uhr (`roomModes.js:97-100`) bleibt massgeblich |
| Ereignis ausgeloest, aber Ziel nie erreicht (Spieler stirbt) | Unveraendert zum heutigen Verhalten |

---

## 5. Zustaende eines Raum-Ereignisses

| Zustand | Wann | Erkennbar am | Treppe |
|---|---|---|---|
| **ruhend** | ab Raumaufbau | Anker sichtbar, ruhig, keine Zone, kein HUD-Timer | offen |
| **laufend** | ab erster Sichtung des Ankers | Banner, HUD-Timer, Kampfzone, Nachschub | gesperrt |
| **abgeschlossen** | Ziel erfuellt | Erfolgs-Clue, Bonus-Truhe | offen |
| **gescheitert** | Ziel verfehlt (nur `defend`) | Fehlschlag-Clue, keine Bonus-Truhe | offen |
| **uebergangen** | Spieler verlaesst den Raum aus *ruhend* | — | offen |

Der Uebergang *ruhend → laufend* ist **einmalig und unumkehrbar** (Annahme
A-03).

---

## 6. Anforderungen

### 6.1 Funktionale Anforderungen

| ID | Anforderung | Status |
|---|---|---|
| FR-001 | Ein `defend`-Raum stellt den Altar beim Raumaufbau sichtbar, aber im Zustand *ruhend* auf: kein Timer, kein Ereignis-Nachschub, keine Gegner-Anziehung zum Altar, keine Kampfzonen-Markierung. | Vorschlag |
| FR-002 | Das `defend`-Ereignis wechselt nach *laufend*, sobald der Altarpunkt im Sichtbereich des Spielers liegt. | Vorschlag |
| FR-003 | Liegen (noch) keine Sichtdaten vor, wechselt kein Ereignis nach *laufend* („im Zweifel nicht ausloesen"). | Vorschlag |
| FR-004 | Der Wechsel nach *laufend* geschieht hoechstens einmal pro Raum und ist nicht umkehrbar; Wegsehen setzt das Ereignis nicht zurueck. | Vorschlag |
| FR-005 | Banner, erklaerende Info-Zeile und HUD-Timer erscheinen erst mit dem Wechsel nach *laufend*, nicht beim Raumaufbau. | Vorschlag |
| FR-006 | Der Zustand *ruhend* ist optisch klar vom Zustand *laufend* unterscheidbar und lockt neugierig, ohne Dringlichkeit zu suggerieren. | Vorschlag |
| FR-007 | Die Treppensperre haengt am Ereignisstart, nicht mehr am Raumaufbau. | Vorschlag |
| FR-008 | Solange ein Ereignis *ruhend* ist, kann der Spieler den Raum jederzeit ueber die Treppe verlassen. | Vorschlag |
| FR-009 | Ist ein Ereignis *laufend*, bleibt die Treppe bis zum Abschluss (erfuellt **oder** verfehlt) gesperrt — unveraendert zum heutigen Vertrag. | Vorschlag |
| FR-010 | Verlaesst der Spieler den Raum aus dem Zustand *ruhend*, wird der Anker restlos aufgeraeumt und traegt nicht in den naechsten Raum. | Vorschlag |
| FR-011 | Solange ein Spezialraum *ruhend* ist, verhaelt er sich fuer Wellen-Abschluss und Raum-Belohnung wie ein gewoehnlicher Raum. | Vorschlag (haengt an A-08) |
| FR-012 | Der `survival`-Modus erhaelt einen eigenen sichtbaren Anker im Raum, an dem derselbe Sicht-Auslöser haengt. | Vorschlag (haengt an A-06) |
| FR-013 | Im Zustand *ruhend* laeuft im `survival`-Modus weder ein Timer noch Nachschub, und die Gegner-Zaehigkeit ist unveraendert (kein HP-Multiplikator). | Vorschlag |
| FR-014 | Abschluss-, Fehlschlag- und Belohnungslogik der Modi bleibt inhaltlich unveraendert; nur ihr Startzeitpunkt verschiebt sich. | Vorschlag |
| FR-015 | Die Wahrscheinlichkeit, mit der ein Raum ein Spezialraum wird, bleibt unveraendert. | Vorschlag |
| FR-016 | Die Modi `hunt` und `escape` bleiben in ihrem Verhalten unveraendert. | Offen (siehe Q2) |

### 6.2 Nicht-funktionale Anforderungen

| ID | Anforderung | Schwelle | Status |
|---|---|---|---|
| NFR-001 | Die Sichtpruefung kostet pro Bild und Ereignis hoechstens einen Punkt-im-Polygon-Test und erzeugt **keine** neuen Objekte pro Bild. | 0 zusaetzliche Allokationen pro Bild | Vorschlag |
| NFR-002 | Die Aenderung darf die Bildrate im Spezialraum nicht messbar senken. | Mittlere Bildrate weicht auf dem Mobil-Referenzgeraet um hoechstens 2 fps vom Zustand vor der Aenderung ab | Vorschlag |
| NFR-003 | Zwischen „Ziel im Sichtbereich" und sichtbarem Ereignisstart vergeht keine wahrnehmbare Verzoegerung. | ≤ 200 ms, auch bei der Mobil-Fog-Frequenz (I-9) | Vorschlag |
| NFR-004 | Es entsteht kein Zustand, in dem die Treppe gesperrt ist, ohne dass ein Ereignis laeuft. | 0 Vorkommnisse in 20 aufeinanderfolgenden Testlaeufen | Vorschlag |
| NFR-005 | Die Testsuite bleibt gruen. | 748 Tests, 747 gruen, 1 bewusstes `todo` (#84) — kein neuer roter Test | Vorschlag |
| NFR-006 | Neue Regeln sind ohne laufende Spiel-Schleife pruefbar (Kopflos-Tests wie bei den bestehenden `roomMode*`-Tests). | Mindestens je ein Test fuer *ruhend*, *laufend* und die Treppen-Regel | Vorschlag |

### 6.3 Randbedingungen

| ID | Randbedingung | Status |
|---|---|---|
| C-001 | Klassische Skripte mit `window`-Globalen, keine Module. Neue Bausteine registrieren sich selbst, wie die bestehenden Raum-Modi. | Bindend |
| C-002 | Alle Nutzertexte auf Deutsch mit echten Umlauten; neue Texte als i18n-Schluessel in `de` **und** `en` registrieren (Muster: `js/roomModeDefend.js:17-27`). | Bindend |
| C-003 | Jede Aenderung an einer Datei unter `js/` braucht beim Ausliefern einen `?v=`-Bump des betroffenen Skript-Tags in `index.html`, eine erhoehte `GAME_VERSION` in `js/version.js` und einen `?v=`-Bump auch fuer `version.js` selbst. | Bindend |
| C-004 | Die Sichtbarkeit wird aus der vorhandenen Quelle (`scene._lastVisionPolygon`) gelesen. Keine zweite Raycast-Schleife, kein eigener Sichtkegel. | Bindend (haengt an A-02) |
| C-005 | Fehler im Ereignis duerfen weder den Raumaufbau noch die Spiel-Schleife brechen; das bestehende defensive `try/catch`-Muster bleibt erhalten. | Bindend |
| C-006 | Die Boss-/Klimax-Sperre (#109) bleibt unberuehrt. Der Voll-Boss bleibt Pflicht. | Bindend |
| C-007 | Der Altar bleibt auch im Zustand *ruhend* ein festes Hindernis fuer den Spieler (#82). | Vorschlag (haengt an A-11) |

---

## 7. Erfolgskriterien

| ID | Kriterium |
|---|---|
| SC-001 | In jedem Raum mit Altar-Verteidigung ist das Ereignis vor dem Ausloesen als ruhiges Angebot erkennbar, und der Raum ist ohne Ausloesen verlassbar. |
| SC-002 | Kein Spielstand bleibt in einem Spezialraum stecken: in 20 Testlaeufen 0 Faelle einer gesperrten Treppe ohne laufendes Ereignis. |
| SC-003 | Zwischen dem Moment, in dem der Spieler das Ziel sehen kann, und dem sichtbaren Beginn des Ereignisses vergehen hoechstens 0,2 Sekunden. |
| SC-004 | Ein Spieler, der einen Spezialraum raeumt, ohne das Ereignis anzutreten, erhaelt dieselbe Raum-Belohnung wie in einem gewoehnlichen Raum. |
| SC-005 | Ein einmal begonnenes Ereignis endet weiterhin ausschliesslich mit Erfolg oder Fehlschlag — es laesst sich nicht durch Weglaufen abbrechen. |

---

## 8. Annahmen

Jede Annahme wurde vom Agenten aus Issue und Quelltext abgeleitet, **nicht** mit
dem Projektinhaber abgestimmt. Bitte einzeln bestaetigen oder verwerfen.

| ID | Annahme | Begruendung | Betrifft |
|---|---|---|---|
| A-01 | Mit „Raum-Ereignisse" sind die Raum-Modi aus Feature 061 gemeint (`js/roomModes.js` und die `roomMode*`-Dateien), **nicht** die Zufallsereignisse in `js/eventSystem.js`. | Das Issue nennt `roomModeDefend.js` und `roomModeSurvival.js` namentlich. Die Ereignisse in `eventSystem.js` sind ueberwiegend schon objekt- und naehebasiert (`[E]`-Aufforderung, `eventSystem.js:479-505`); nur `ambush` und `hazard` feuern beim Raumeintritt sofort. | Gesamter Zuschnitt |
| A-02 | „Im Blickbereich" heisst: der Zielpunkt liegt im vorhandenen Sichtpolygon — **nicht** Kamera-Ausschnitt und **nicht** ein zusaetzlicher fester Radius. | Das Polygon beruecksichtigt Waende und geschlossene Tueren, ist ohnehin jedes Bild vorhanden und deckt sich mit dem, was der Spieler wirklich sieht. Das Issue laesst die Wahl ausdruecklich offen. | FR-002, C-004 |
| A-03 | Der Uebergang *ruhend → laufend* ist ein einmaliger, unumkehrbarer Schalter. | Ein Ereignis, das beim Wegsehen wieder einschlaeft, waere weder lesbar noch fair (Timer wuerde springen). | FR-004 |
| A-04 | Es wird hingenommen, dass der Spieler beim Ausloesen bereits nahe am Altar steht (Sichtradius 220 px < Spawnring 150–240 px, siehe I-12). | Sichtbarkeit bleibt der richtige Auslöser, weil sie durch Waende blockiert wird; Naehe allein waere durch Waende hindurch wirksam. | FR-002 |
| A-05 | Ohne Sichtdaten wird **nicht** ausgeloest (Gegenteil des Kampf-Fallbacks in `player.js:908-912`). | Beim Kampf ist „im Zweifel treffen" richtig, damit nichts blockiert. Beim Ereignis waere „im Zweifel starten" genau der Fehler, den das Issue beseitigen will. | FR-003 |
| A-06 | `survival` bekommt ein neues, sichtbares Ankerobjekt im Raum, weil es heute keines hat. | Ohne Anker ist „im Blickbereich" fuer diesen Modus nicht definierbar (I-4). Das ist der zweite Fall aus dem Issue („Abschnitt oder sowas"). | FR-012, FR-013 |
| A-07 | Die Ankerform fuer `survival` wird frei gewaehlt (z. B. Ritualmal oder Signalfeuer) und ist nicht Teil der Freigabeentscheidung. | Das Issue macht keine Vorgabe. | FR-012 |
| A-08 | Solange ein Spezialraum *ruhend* ist, verhaelt er sich fuer Wellen-Abschluss und Belohnung wie ein `clear`-Raum. | Ohne diese Regel bliebe ein uebergangener Spezialraum vollstaendig belohnungslos (I-11) — ein stiller Verlust, der von aussen wie ein Fehler aussieht. | FR-011 |
| A-09 | Ein begonnenes Ereignis laesst sich nicht durch Weglaufen abbrechen. | Das Issue sagt ausdruecklich: „Gesperrt wird erst, wenn das Ereignis tatsaechlich laeuft — dann gilt weiter: durchhalten oder scheitern." | FR-009, SC-005 |
| A-10 | Die Modus-Auswahl (Gewichte und Wahrscheinlichkeit pro Raum) bleibt unveraendert. | Das Issue aendert den Zeitpunkt, nicht die Haeufigkeit. | FR-015 |
| A-11 | Der Altar bleibt auch im Zustand *ruhend* ein festes Hindernis fuer den Spieler. | Er ist heute bewusst solide (#82); ein Altar, der erst beim Ausloesen fest wird, waere ein sichtbarer Bruch. | C-007 |
| A-12 | „Sichtbar, aber inaktiv" braucht keine eigene neue Bildschirm-Einblendung; es genuegt, dass die aktiven Anzeigen (Banner, Timer, Kampfzone) noch **nicht** erscheinen. | Das Issue formuliert das als „sichtbar, aber inaktiv darstellen — es soll neugierig machen", ohne Vorgabe fuer zusaetzliche Hinweistexte. | FR-005, FR-006 |

---

## 9. Offene Fragen

Diese drei Punkte lassen sich weder aus dem Issue noch aus dem Quelltext
entscheiden und brauchen eine Antwort des Projektinhabers.

**Q1 — Naehe als Rueckfallebene?**
`[NEEDS CLARIFICATION: Soll das Ereignis zusaetzlich zur Sichtbarkeit auch bei
blosser Naehe ausloesen (z. B. Spieler naeher als X px, auch ohne Sichtlinie)?]`
Ohne Rueckfallebene kann ein Altar hinter einer Saeule uebersehen werden und der
Spieler verlaesst den Raum, ohne je vom Angebot erfahren zu haben — das ist
konsequent („Angebot"), koennte aber auch als verlorener Inhalt wirken.

**Q2 — Gilt die Regel auch fuer `hunt`?**
`[NEEDS CLARIFICATION: Soll die neue Treppen-Regel auch fuer den Modus `hunt`
gelten?]` Die Sperre im Raumaufbau (I-5) betrifft heute `defend`, `survival`
**und** `hunt` an derselben Stelle. `hunt` spawnt beim Betreten vier
zusaetzliche Gegner und waehlt sein Ziel erst, wenn die Welle da ist — es hat
kein „ruhendes" Objekt zum Ansehen. Loest man die Sperre pauschal, wird `hunt`
zum optionalen Ziel; laesst man sie fuer `hunt` stehen, bleiben zwei
verschiedene Regeln nebeneinander.

**Q3 — Sehen oder bestaetigen?**
`[NEEDS CLARIFICATION: Startet das Ereignis allein durch Hinsehen, oder braucht
es eine bewusste Bestaetigung (z. B. `[E]` am Altar)?]` Das Issue enthaelt hier
zwei Aussagen, die sich reiben: „Ausloeser an Sichtbarkeit oder Naehe haengen"
(Sehen genuegt) gegen „der Spieler entscheidet, wann er es antritt" (bewusste
Entscheidung). Bei reiner Sichtbarkeit ist die Entscheidung nur die, **nicht
hinzusehen** — das ist schwer steuerbar, besonders bei einem Altar in der
Raummitte. Eine Bestaetigung waere die staerkere Umsetzung des
Angebots-Gedankens, weicht aber vom Wortlaut des Umsetzungsvorschlags ab.

---

## 10. Ausserhalb des Auftrags

* Zufallsereignisse aus `js/eventSystem.js` (Schatz, Schrein, Haendler,
  Hinterhalt, Einsturz) — siehe Annahme A-01.
* Die Boss-/Klimax-Sperre aus #109.
* Der Modus `escape`; sein Ausgang ist bereits bewusst von Anfang an offen.
* Balancing der Ereignisdauern, Gegnerzahlen und Belohnungen.
* Eine echte „erreiche-diesen-Ausgang"-Variante fuer `escape`.

---

## 11. Hinweise fuer die spaetere Umsetzung

Diese Hinweise gehoeren nicht zur Anforderung, sollen beim Umsetzen aber nicht
verloren gehen:

1. **Ausliefern**: `?v=`-Bump in `index.html` fuer jede geaenderte Datei unter
   `js/`, neue `GAME_VERSION` in `js/version.js`, `?v=` von `version.js`
   ebenfalls bumpen (C-003).
2. **Polygon wiederverwenden**: Das Muster aus `js/player.js:913-919` (gecachtes
   `Phaser.Geom.Polygon`, an den Datensatz gebunden) erfuellt NFR-001 direkt.
3. **Nicht kopieren, sondern trennen**: `hasLineOfSightToTarget` faellt bewusst
   „offen" zurueck (I-10). Der Ereignis-Auslöser braucht die umgekehrte
   Richtung — also eine eigene, klar benannte Pruefung statt einer
   Wiederverwendung mit Flag.
4. **Kopflos testbar bleiben**: Die bestehenden `tests/roomMode*.test.js` pruefen
   die Modus-Logik ohne Phaser-Schleife. Der neue Zustand sollte auf demselben
   Weg pruefbar sein — die Sichtquelle also als einspeisbarer Wert, nicht als
   harte Abhaengigkeit zur Szene.
5. **Mutationsprobe**: Nach dem Gruenwerden den Fix testweise entfernen und
   pruefen, dass der Test wirklich faellt.
