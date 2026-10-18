# Fogreach — Trailer-Drehbuch (25 Sekunden, hochkant 9:16)

Ton: düster, aber zügig — der Aufbau dauert nur 6 s, ab Sekunde 6
Schlagzeug und Schnitte im Takt (Vorschlag 120 BPM: ein Schlag = 0,5 s,
ein Takt = 2 s), vor dem Titel ein Moment Stille. Texttafeln im Messing-Stil
des Spiels (Pergamentschrift auf dunklem Grund, kurz, groß, nie mehr als
5 Wörter), je nur ~1 s im Bild.

Jede Einstellung ist im Spiel per Trailer-Modus abrufbar
(`?trailer=1`, Taste in Klammern — siehe docs/debug-modus.md). Seit b449
kommt jede Einstellung in ~0,3 s nach dem Tastendruck zur Sache und
liefert ihren Höhepunkt nach 0,2–3 s (Spalte „Höhepunkt“, gemessen ab dem
Aufbau der Einstellung). Die frühere Verkleidung (Taste 5) ist raus; auf
Taste 5 liegt jetzt der **Kampf mit HUD**.

**Format: hochkant 9:16** fuer Reels, TikTok und YouTube Shorts. `?trailer=1`
stellt das Spielbild auf 540×960, die Aufnahme (Taste `R`) speichert es mit
harten Pixeln verdoppelt als 1080×1920. Die Querfassung (960×480, Aufnahme
960×480) gibt es weiter mit `?trailer=1&quer=1`.

## Schutzzonen hochkant

Die Plattformen legen ihre Oberflaeche ueber das Video: **oben 12 %** (Konto,
Suche) und **unten 20 %** (Beschreibung, Musik, Knoepfe). Alles Wichtige —
Gesichter, Dialog, Plakette, Tooltip, Texttafeln — steht dazwischen. Ausnahme
ist das HUD (Einstellung 5, Taste `H`): es klebt seit b454 gross an den
Bildraendern und liegt damit in den Zonen (siehe Einstellung 5). Taste `L`
zeigt die beiden Zonen im Spiel als schwarze Balken (zum Pruefen und als
Platz fuer Tafeln). Die Hochkant-Tafeln liegen in `trailer/tafeln_hochkant/`
(1080×1920), die Schnittanleitung in `trailer/schnittanleitung_hochkant.md`.

| Zeit | Einstellung (Taste) | Bild | Höhepunkt im Clip | Text / Ton |
|---|---|---|---|---|
| 0:00–0:02,5 | Nebelstadt (1) | Aus Schwarz (0,5 s), Nebel lichtet sich; die Kamera fährt sofort los und steht nach 2,2 s am Rathaus. | Rathaus bei 2,2 s | Tafel **„Eine Stadt im Nebel.“** (~1,2 s) — tiefer Ton, Glocke |
| 0:02,5–0:04 | Der Rat (2) | Aldric vor dem Rathaus, der Messing-Dialog geht nach 0,25 s auf. | Dialog bei 0,25 s | Dialogzeile im Bild: „Der Rat hat Arbeit für Dich, Archivschmied.“ |
| 0:04–0:06 | Abstieg (3) | Spieler geht sofort zur Kellertür, Abblende ab 0,65 s; nach ~1,3 s der erste Kellerraum im Nebel. | Keller bei ~1,3 s | Tafel **„Was hast Du vergessen?“** (~1 s) |
| 0:06–0:09,5 | Kampf-Montage (4) | Vier harte Schnitte, je ~0,9 s: Wirbelwind in eine Gruppe (ab 0,2 s) · Ansturm (1,2 s) · Hammer der Ahnen (Einschlag 2,35 s) · Kettenwache fällt (3,55 s). | Wache fällt bei 3,55 s | Musik setzt voll ein, Schnitte auf den Schlag |
| 0:09,5–0:12,5 | Kampf mit HUD (5) | Eine durchgehende Einstellung MIT Oberfläche: Gegner rundum, Treffer lassen die Lebensleiste unter ein Drittel fallen, Wirbelwind, Trank (die Leiste steigt), Ansturm, Hammer, die Erfahrungsleiste füllt sich — Stufenaufstieg mit goldenem Blitz und Meldung „Stufe 2 erreicht!“. | Treffer 0,1 s · Trank 1,1 s · Stufe 2,45 s | Treffergeräusche, Trank, Stufen-Fanfare |
| 0:12,5–0:14 | Inventar (0) | Das Inventar geht nach 0,15 s auf, voll mit Beute aller Seltenheiten; nach 0,75 s der Tooltip eines legendären Stücks. | Tooltip bei 0,75 s | Musik läuft weiter |
| 0:14–0:16 | Geheime Sitzung (6) | Ratskammer: Magistrat, Klerus, Garde am Tisch, Kerzenlicht, sofort im Bild, kurze Fahrt heran. | sofort | Tafel **„Ein Gesicht. Drei Masken.“** (~1,2 s) |
| 0:16–0:20 | Boss (7) | Kettenmeister-Auftritt im Trailer-Tempo (Plakette bei ~0,8 s, Rede ab ~1,1 s, nach der ersten Seite Ausklang), Hammer ab 2,6 s, Einschlag 2,95 s in Zeitlupe, Bildschirm bebt; ab 4,3 s Normaltempo. | Plakette 0,8 s · Einschlag 2,95 s | Schlag, dann abrupte Stille (0,3 s) |
| 0:20–0:21,5 | Die Presse (8) | Die Presse stampft dreimal in gut 1,3 s (erster Stoß nach ~0,15 s), Flugblätter fliegen. | erster Stoß ~0,15 s | Tafel **„Erinnere Dich.“** (~1 s) |
| 0:21,5–0:25 | Titel (9) | 0,3 s Schwarz, dann: Laterne leuchtet gleich auf, Nebel reißt ab 0,4 s auf, Schriftzug **FOGREACH** steht nach ~1,3 s — stehen lassen. | Schriftzug ~1,3 s | Letzter Ton klingt aus |

## Bildaufbau hochkant je Einstellung

Im Hochformat geht die Kamera nah heran (Zoom 1,8 im Keller: der Spieler
steht so gross im Bild wie quer), die Choreografie laeuft senkrecht statt
waagerecht. Dialog, Plakette, Inventar und Sitzungsbuehne liegen auf einer
eigenen Kamera ohne Zoom und sind fuer 540 Breite eingepasst.

| Taste | Bildaufbau hochkant |
|---|---|
| 0 Inventar | Welt dahinter nah (1,8), Spieler mittig im Raum. Inventar ueber die ganze Breite in der oberen Haelfte (oberhalb 12 %), darunter der Tooltip 1,6-fach vergroessert, endet ueber der unteren Zone. |
| 1 Nebelstadt | Zoom 1,3; senkrechter Schwenk vom Brunnen hinauf zum Rathaus (2,2 s, easeOut). |
| 2 Der Rat | Zoom 2: Aldric im oberen Drittel, Spieler davor; der Dialog (94 %) steht darunter und endet ueber der unteren Zone. |
| 3 Abstieg | Zoom 1,8 an der Tuer; im Keller steht der Spieler im oberen Drittel (er kommt an der Oberkante herein), darunter der Raum. |
| 4 Kampf-Montage | Zoom 1,8; der Spieler wird nahe der Raummitte auf freien Boden gestellt, Ansturm, Hammer und Kettenwache laufen nach unten — auf die Kamera zu, Gesichter sichtbar. |
| 5 Kampf mit HUD | Zoom 1,6 (etwas weiter: oben und unten nimmt das HUD Platz); der Kampf laeuft waagerecht durch die Bildmitte, nicht in die Faehigkeitsleiste hinein. Das HUD klebt vergroessert an den Bildraendern (10 px Abstand): Portraet, Lebens- und Erfahrungsleiste 1,4-fach oben links (bis 97 px von 960), Zahnrad und Truhe 1,4-fach oben rechts (die Minikarte bleibt im Trailer weg, seit b456), die Faehigkeitsleiste mit den Messingfeldern 1,5-fach unten in der Mitte (872–950 px), die Meldung „Stufe 2 erreicht!“ direkt darueber. Die Gebietsbeschriftung des Raums rueckt unter die Lebensleiste (ab 105 px) und vergeht nach 2 s. **Fuer den Schnitt:** das HUD liegt damit in den Zonen (oben 12 %, unten 20 %) — Konto/Suche der Plattform verdecken die obere Leiste, Beschreibung und Knoepfe die Faehigkeitsleiste. Den Clip darum ohne Plattform-Oberflaeche zeigen (eigene Plattform, Website, Zuschnitt) oder dort keine Tafeln einblenden; wo die Oberflaeche liegt, bleibt ein Teil des HUD verdeckt. |
| 6 Geheime Sitzung | Die quer gebaute Buehne fuellt die Breite (Tisch und die drei), Tischmitte bei 55 % der Hoehe; darueber und darunter Dunkel — Platz fuer die Tafel. Die Fahrt heran (3,5 %) macht der Rahmen der Buehne; die aeusseren Figuren bleiben ganz im Bild. |
| 7 Boss | Zoom 1,8; Kettenmeister ueber dem Spieler (170 px), Plakette oben unter dem Balken, Rede im hoeheren unteren Balken (34 %) in 20 px — ueber der unteren Zone. Der Hammer schlaegt von unten nach oben. |
| 8 Die Presse | Die Presse vierfach (512 px) ueber die Breite, mehr Flugblaetter. |
| 9 Titel | Schriftzug FOGREACH doppelt (398 px) mittig, Laterne darunter. |

Das HUD (Taste `H`) nutzt dieselbe Anordnung wie Einstellung 5 — gross an
den Raendern; was dann noch nicht ganz ins schmale Bild passt, bleibt weg.
Quer (`&quer=1`) steht das HUD ebenfalls an den Raendern, 1,25-fach: Leiste
oben links, Knoepfe oben rechts (ohne Minikarte), Faehigkeiten unten mittig,
Meldung darueber, Gebietsname unter der Leiste.

## Aufnahme-Hinweise
- Am einfachsten nimmt das Spiel selbst auf: im Trailer-Modus Taste `R`
  (Start/Stopp, Datei `fogreach_<nr>_<name>_<lauf>.webm` im Download-Ordner,
  siehe docs/debug-modus.md, „Trailer aufnehmen“) — hochkant 1080×1920,
  quer (`&quer=1`) 960×480. Alternativ OBS mit dem Spiel im Vollbild.
- Die Taste der Einstellung und gleich danach `R` (der Dateiname nimmt die
  Einstellung, die beim Start der Aufnahme läuft): die Handlung beginnt
  ~0,3 s nach dem Aufbau, ein spätes `R` verpasst den Anfang. Jede
  Einstellung ist nach 3–5 s durch.
- Pro Einstellung 3–5 Durchläufe aufnehmen, die beste nehmen.
- Zeitlupe (Taste `Z` im Trailer-Modus) für Treffer; der Boss-Einschlag läuft
  schon von selbst in Zeitlupe.
- Schnitt: DaVinci Resolve oder CapCut; Texttafeln als Einblendung über
  Schwarz oder halbtransparent über dem Bild.
