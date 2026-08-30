# Spieltest-Flugschreiber (Stand 2026-08-30)

Messprotokoll der kopflosen Bot-Kampagne vom 17. bis 30. August 2026. Der Bot
spielt über dieselben Codepfade wie echte Eingaben (`tools/headless/`).

Aufgezeichnet wurden Läufe, Ausgänge, Bosskämpfe, erlittener Schaden und der
Fortschritt der Questkette. Alle Zahlen stammen aus `fortlauf.log` (Zeilen vor
der Auswertung dedupliziert) und dem Spielstand, Slot 1.

**Einschränkung:** Der Bot weicht Angriffen nicht aus und öffnet die Schmiede
nicht. Tode und Kampfdauern sind daher keine Aussage darüber, was ein Mensch
erreicht.

---

## 1. Auf einen Blick

| | |
|---|---|
| Läufe gesamt | 730 |
| Tiefster erreichter Punkt | 31 |
| Bosse erlegt | 18 |
| Tode | 45 |
| Quests abgeschlossen | 32 von 34 |
| Story | Epilog erreicht, `story_ending` gesetzt |

---

## 2. Kampagne gesamt

Der Ausgang „Portal" bedeutet, dass der Bot einen Raum nicht verlassen konnte
und über das Notportal ausgestiegen ist — er bringt keinen Tiefenfortschritt,
rettet aber die Beute.

| Ausgang | Läufe | Anteil |
|---|---:|---:|
| Portal (Stillstand) | 563 | 77,1 % |
| Dungeon abgeschlossen | 93 | 12,7 % |
| Gestorben | 45 | 6,2 % |
| Dungeon verlassen | 16 | 2,2 % |
| Rundenbudget aus | 13 | 1,8 % |
| **Gesamt** | **730** | **100 %** |

### Bosse erlegt

| Boss | Tor | Lebenspunkte | Kills |
|---|---|---:|---:|
| Kettenmeister | Tiefe 10 | — | 12 |
| Zeremonienmeister | Tiefe 20 | 349 | 5 |
| Schattenrat | Tiefe 30 | 480 | 1 |

---

## 3. Sitzung vom 30. August

54 Läufe an einem Tag. Die Tiefengrenze stieg von 21 auf 31, der Charakter von
Level 30 auf 34. In dieser Sitzung fielen der Zeremonienmeister und — erstmals
überhaupt — der Schattenrat.

| Ausgang | Läufe |
|---|---:|
| Portal (Stillstand) | 29 |
| Gestorben | 13 |
| Dungeon abgeschlossen | 11 |
| Rundenbudget aus | 1 |
| **Gesamt** | **54** |

### Tiefenverlauf

```
21 → 21 → 21 → 21 → 21 → 22 → 23 → 24 → 24 → 24 → 24 → 24 → 25
25 → 25 → 25 → 25 → 25 → 25 → 26 → 26 → 26 → 27 → 28 → 29 → 30 → 31
```

Jeder Pfeil ist ein Lauf. Nur Läufe mit dem Ausgang „Dungeon abgeschlossen"
heben die Grenze; die übrigen wiederholen dieselbe Tiefe.

---

## 4. Bosskämpfe am Schattenrat

Zehn Begegnungen mit dem niedrigsten erreichten Lebenspunktestand und der Dauer
in Bot-Runden. Eine Runde ist ein Entscheidungszyklus plus vier Bilder bei
festem Zeitschritt.

| Tiefster Stand | Runden | Waffenschaden | Ausgang |
|---:|---:|---:|---|
| 1 | 1878 | 3 | erlegt |
| 18 | 204 | 23 | Spieler gestorben |
| 80 | 236 | 23 | Spieler gestorben |
| 202 | 138 | 23 | Spieler gestorben |
| 294 | 62 | 23 | Spieler gestorben |
| 392 | 83 | 8 | Spieler gestorben |
| 457 | 4705 | 23 | Stillstand |
| 476 | 32 | 3 | Spieler gestorben |
| 477 | 110 | 3 | Spieler gestorben |
| 480 | 49 | 8 | Spieler gestorben |
| 480 | 4574 | 23 | Stillstand |

### Muster der Stillstände

Alle Stillstände am Boss zeigen dasselbe Bild: konstant 67 px Abstand, Schwünge
werden ausgeführt, die Sichtlinienprüfung weist sie ab.

```
KAMPF (500 Runden): Aufrufe 204, davon ausgefuehrt 60, Treffer 0, Schaden 0
Tore: keinGegner 0, ausserhalb 0, Kegel 0, Sichtlinie 60, offen 0
naechster Gegner boss_shadow_left0 HP 457/480 | Abstand 67>67>67>67>67…
```

Die Blockerliste derselben Runde nennt die Ursache:

```
BLOCKER (Spalt): wall_stone_large/obstacleWall@0px [obstacles],
                 boss_shadow_left0@3px [gegner],
                 wall_stone_large/obstacleWall@32px [obstacles]
Spieler (1868,450)  Anschlag: rechts  Zweig "Anschlag -> Gegner schlagen"
```

Der Spieler steht mit 0 px Spalt an einer Steinmauer, der Boss unmittelbar
dahinter. Die Linie von Spielermitte zu Bossmitte kreuzt die Mauer — die
Sichtlinienprüfung arbeitet korrekt. Der Bot bleibt im Zweig
„Anschlag → Gegner schlagen" hängen, statt um die Mauer herumzugehen.

---

## 5. Erlittener Schaden

Ab dem 30. August wird der Schaden am Spieler mitgeschrieben — gemessen als
Differenz der Lebenspunkte, nicht als Rückgabewert der Schadensfunktion, damit
Unverwundbarkeit und Rüstung korrekt herausfallen.

Läufe auf Tiefe 31, 57 maximale Lebenspunkte:

| Räume | Boss | Schaden | Treffer | Härtester | Ausgang |
|---:|---|---:|---:|---:|---|
| 7 | — | 7 | 1 | 7 | überlebt |
| 8 | — | 27 | 3 | 9 | überlebt |
| 6 | — | 45 | 5 | 11 | überlebt |
| 11 | ja | 33 | 3 | 15 | Stillstand |
| 12 | ja | 76 | 6 | 15 | gestorben |
| 12 | ja | 98 | 8 | 15 | gestorben |
| 12 | ja | 94 | 7 | 15 | gestorben |
| 11 | ja | 117 | 13 | 15 | gestorben |
| 12 | ja | 123 | 13 | 15 | gestorben |
| 1 | — | 105 | 15 | 7 | gestorben |

Summen über 57 bedeuten, dass zwischendurch geheilt wurde. Der letzte Eintrag
ist ein einzelner Raum mit 34 Gegnern.

Bosstreffer liegen bei 13 bis 15, normale Gegner bei 7 bis 11.

---

## 6. Quests und Story

Die Questkette wurde bis zum Epilog durchgespielt. Der Schattenrat-Kill
schaltete `the_reckoning` frei; `story_ending` ist gesetzt und im Spielstand
festgeschrieben, der Hub steht in Phase `epilogue`.

| Zustand | Anzahl | Betrifft |
|---|---:|---|
| abgeschlossen | 32 | gesamte Hauptkette bis `the_reckoning` |
| aktiv | 1 | `branka_weapons` — 3 Gegenstände herstellen |
| verfügbar | 1 | `resistance_fetch_01` |

### Fraktionsansehen

Ansehen entsteht ausschließlich aus Questbelohnungen; im Spiel existieren acht
davon zu je einem Punkt. Der Spielstand hat jede Fraktion ausgereizt.

| Fraktion | Erreicht | Maximum |
|---|---:|---:|
| Magistrat | 2 | 2 |
| Klerus | 2 | 2 |
| Garde | 2 | 2 |
| Widerstand | 1 | 1 |
| Unabhängig | 1 | 1 |

Das Tor von `resistance_fetch_01` verlangt Widerstand ≥ 25 auf einer Skala von
−100 bis 100, auf der 25 die Schwelle „freundlich" ist.

### Gesamtzähler im Spielstand

| Kills | Räume geräumt | Wellen überstanden | Akt | Level |
|---:|---:|---:|---:|---:|
| 12 436 | 398 | 228 | 4 | 34 |

---

## 7. Werte aus dem Spielstand

### Lebenspunkte über die Tiefe

| Tiefe | Level | Max. LP |
|---:|---:|---:|
| 1 | 1 | 30 |
| 3 | 3 | 34 |
| 17 | 29 | 57 |
| 24 | 31 | 59 |
| 26 | 32 | 61 |
| 31 | 34 | 57 |

Schwankungen von 57 bis 61 stammen aus wechselnder Ausrüstung.

### Waffen-Basisschaden

| Waffe | Band | Herkunft |
|---|---:|---|
| Kettenrat-Kriegshammer | 6,3 – 9,1 | Fund |
| Richtschwert | 4,9 – 7,7 | Fund |
| Nebelbogen | 4,9 – 7,7 | Fund |
| Kettenmorgenstern | 2,8 – 4,9 | Fund |
| Glutaxt | 2,8 – 4,2 | Fund |
| Hornbogen | 2,1 – 4,2 | Fund |
| Eisenklinge | 1,4 – 3,5 | Fund |
| Schattendolch | 0,7 – 2,8 | Fund |
| Eschenbogen | 0,7 – 2,8 | Fund |
| Elaras Klinge | 7,0 | Quest, fest |

Der stärkste Schadensaffix `sharp_dmg` gibt +6 % bis +33 %. Elaras Klinge stand
bis zum 30.08.2026 auf 22.

---

## 8. Änderungen in dieser Sitzung

### Spiel

- **Speicherstand-Version wird mitgeschrieben.** Ohne das Feld galt jeder
  Spielstand als Version 1, und die Alt-Migrationen liefen bei jedem Laden
  erneut.
- **Prozent-Reparatur überspringt selbst erzeugte Basiswerte.** Betroffen waren
  Questgegenstände: Elaras Klinge verlor beim Laden 99 % ihres Angriffstempos
  (1,3 → 0,013).
- **Elaras Klinge von 22 auf 7 Schaden.** Gesamtschaden damit 8 statt 23.

### Spieltest-Bot

- **Übersprungener Wegpunkt zählt nicht mehr als Fortschritt.** Die Sprungregel
  greift nach 20 Runden, der Ausstieg erst nach 50 — der Sprung kam ihm zuvor
  und setzte ihn zurück. In 13 gemessenen Stillständen stand der
  Planfehler-Zähler jedes Mal auf 0.
- **Verfolgungsstand wird je Ziel gemerkt.** Ein Pendeln zwischen zwei Treppen
  hielt den Ausstieg dauerhaft entschärft.
- **Waffenwahl nach Schaden statt nach der Stärkeanzeige.** Die Anzeigezahl
  gewichtet Affixe hoch; ein Dolch mit 1,4 Schaden schlug damit eine Klinge mit
  22.

### Messinstrumente

Vier Ergänzungen im Laufprotokoll: Toraufschlüsselung (warum ein Schwung
abgewiesen wird), Aufgabe-Spur (warum der Ausstieg nicht feuert), Schadenszähler
(wie viel Schaden ankommt) und Sicht-Blocker (welches Hindernis die Sichtlinie
schneidet).

Testbestand 675, davon 674 grün und 1 als `todo` markiert. Alle Korrekturen
mutationsgeprüft: die Korrektur testweise entfernt und bestätigt, dass der
zugehörige Test wirklich fällt.

---

## 9. Offene Beobachtungen

| Zustand | Beobachtung |
|---|---|
| offen | **Bot bleibt an Wänden hängen.** Steht der Boss hinter einer Mauer, schlägt der Bot in die Mauer statt herumzugehen. Betrifft 2 von 10 Bossbegegnungen. |
| offen | **Questwaffe im laufgebundenen Inventar.** Ausrüstung ist dauerhaft, das Inventar nicht. Wird etwas über eine Questwaffe gelegt, wandert diese ins Inventar und ist am Laufende verschwunden — so ging Elaras Klinge verloren. |
| offen | **`magic_resistant` flattert.** Der Test fällt in etwa einem von drei Läufen ohne Codeänderung (#110). |
| offen | **`resistance_fetch_01` unerreichbar.** Tor verlangt Widerstand ≥ 25, erreichbares Maximum ist 1. |
| erledigt | **Story bis zum Epilog.** 32 von 34 Quests abgeschlossen, `story_ending` gesetzt und gespeichert. |
