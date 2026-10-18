# Fogreach — Trailer-Drehbuch (30 Sekunden, hochkant 9:16)

Ton: düster, langsamer Aufbau, ab Sekunde 9 Schlagzeug/Schnitte im Takt,
am Ende Stille vor dem Titel. Texttafeln im Messing-Stil des Spiels
(Pergamentschrift auf dunklem Grund, kurz, groß, nie mehr als 5 Wörter).

Jede Einstellung ist im Spiel per Trailer-Modus abrufbar
(`?trailer=1`, Taste in Klammern — siehe docs/debug-modus.md).

**Format: hochkant 9:16** fuer Reels, TikTok und YouTube Shorts. `?trailer=1`
stellt das Spielbild auf 540×960, die Aufnahme (Taste `R`) speichert es mit
harten Pixeln verdoppelt als 1080×1920. Die Querfassung (960×480, Aufnahme
960×480) gibt es weiter mit `?trailer=1&quer=1`.

## Schutzzonen hochkant

Die Plattformen legen ihre Oberflaeche ueber das Video: **oben 12 %** (Konto,
Suche) und **unten 20 %** (Beschreibung, Musik, Knoepfe). Alles Wichtige —
Gesichter, Dialog, Plakette, Tooltip, Texttafeln — steht dazwischen. Taste `L`
zeigt die beiden Zonen im Spiel als schwarze Balken (zum Pruefen und als
Platz fuer Tafeln). Die Hochkant-Tafeln liegen in `trailer/tafeln_hochkant/`
(1080×1920), die Schnittanleitung in `trailer/schnittanleitung_hochkant.md`.

| Zeit | Einstellung (Taste) | Bild | Text / Ton |
|---|---|---|---|
| 0:00–0:03 | Nebelstadt (1) | Schwarz, Nebel lichtet sich langsam; Kamera fährt langsam über den Hub zum Rathaus. Keine Figur bewegt sich. | Tafel: **„Eine Stadt im Nebel.“** — tiefer Ton, Glocke |
| 0:03–0:06 | Der Rat (2) | Aldric vor dem Rathaus, Messing-Dialog geht auf. | Dialogzeile im Bild: „Der Rat hat Arbeit für Dich, Archivschmied.“ |
| 0:06–0:09 | Abstieg (3) | Rathauskeller-Tür, Abblende; erster Kellerraum, Spieler mit Laterne im Nebel, Fackeln flackern. | Tafel: **„Was hast Du vergessen?“** |
| 0:09–0:14 | Kampf-Montage (4) | Schnelle Schnitte, je ~1 s: Wirbelwind in eine Gegnergruppe · Ansturm · Hammer der Ahnen · Kettenwache fällt · Blutspritzer/Splitter. | Musik setzt voll ein, Schnitte auf den Schlag |
| 0:14–0:15,5 | Inventar (0) | Das Inventar geht auf, voll mit Beute aller Seltenheiten; der Tooltip eines legendären Stücks erscheint. | Musik läuft weiter |
| 0:15,5–0:18 | Verkleidung (5) | Spieler in Wachen-Montur schleicht an blauen Sichtkegeln vorbei, ein Kegel färbt sich orange. | Leises Herzklopfen |
| 0:18–0:21 | Geheime Sitzung (6) | Ratskammer: Magistrat, Klerus, Garde am Tisch, Kerzenlicht. | Tafel: **„Ein Gesicht. Drei Masken.“** |
| 0:21–0:25 | Boss (7) | Kettenmeister-Intro, ein schwerer Treffer in Zeitlupe, Bildschirm bebt. | Schlag, dann abrupte Stille |
| 0:25–0:27 | Die Presse (8) | Druckerei: die Presse stampft, Flugblätter fliegen. | Tafel: **„Erinnere Dich.“** |
| 0:27–0:30 | Titel (9) | Schwarz, Laterne leuchtet auf, Nebel reißt auf: Schriftzug **FOGREACH**. | Letzter Ton klingt aus |

## Bildaufbau hochkant je Einstellung

Im Hochformat geht die Kamera nah heran (Zoom 1,8 im Keller: der Spieler
steht so gross im Bild wie quer), die Choreografie laeuft senkrecht statt
waagerecht. Dialog, Plakette, Inventar und Sitzungsbuehne liegen auf einer
eigenen Kamera ohne Zoom und sind fuer 540 Breite eingepasst.

| Taste | Bildaufbau hochkant |
|---|---|
| 0 Inventar | Welt dahinter nah (1,8), Spieler mittig im Raum. Inventar ueber die ganze Breite in der oberen Haelfte (oberhalb 12 %), darunter der Tooltip 1,6-fach vergroessert, endet ueber der unteren Zone. |
| 1 Nebelstadt | Zoom 1,3; senkrechter Schwenk vom Brunnen hinauf zum Rathaus. |
| 2 Der Rat | Zoom 2: Aldric im oberen Drittel, Spieler davor; der Dialog (94 %) steht darunter und endet ueber der unteren Zone. |
| 3 Abstieg | Zoom 1,8 an der Tuer; im Keller steht der Spieler im oberen Drittel (er kommt an der Oberkante herein), darunter der Raum. |
| 4 Kampf-Montage | Zoom 1,8; der Spieler wird nahe der Raummitte auf freien Boden gestellt, Ansturm, Hammer und Kettenwache laufen nach unten — auf die Kamera zu, Gesichter sichtbar. |
| 5 Verkleidung | Zoom 1,5: Wache, Kegel und Spieler zusammen im Bild. |
| 6 Geheime Sitzung | Die quer gebaute Buehne fuellt die Breite (Tisch und die drei), Tischmitte bei 55 % der Hoehe; darueber und darunter Dunkel — Platz fuer die Tafel. Die Fahrt heran macht der Rahmen der Buehne. |
| 7 Boss | Zoom 1,8; Kettenmeister ueber dem Spieler (170 px), Plakette oben unter dem Balken, Rede im hoeheren unteren Balken (34 %) in 20 px — ueber der unteren Zone. Der Hammer schlaegt von unten nach oben. |
| 8 Die Presse | Die Presse vierfach (512 px) ueber die Breite, mehr Flugblaetter. |
| 9 Titel | Schriftzug FOGREACH doppelt (398 px) mittig, Laterne darunter. |

Das HUD (Taste `H`) zeigt hochkant nur, was ganz ins schmale Bild passt.

## Aufnahme-Hinweise
- Am einfachsten nimmt das Spiel selbst auf: im Trailer-Modus Taste `R`
  (Start/Stopp, Datei `fogreach_<nr>_<name>_<lauf>.webm` im Download-Ordner,
  siehe docs/debug-modus.md, „Trailer aufnehmen“) — hochkant 1080×1920,
  quer (`&quer=1`) 960×480. Alternativ OBS mit dem Spiel im Vollbild.
- Pro Einstellung 3–5 Durchläufe aufnehmen, die beste nehmen.
- Zeitlupe (Taste `Z` im Trailer-Modus) für Treffer und Boss.
- Schnitt: DaVinci Resolve oder CapCut; Texttafeln als Einblendung über
  Schwarz oder halbtransparent über dem Bild.
