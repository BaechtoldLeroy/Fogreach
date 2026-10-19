# Debug-Modus

Alle Entwicklungswerkzeuge des Spiels — Cheats, Fehler-Overlay, URL-Flaggen —
haengen seit #88 an **einem** Schalter. Ohne ihn sieht ein Spieler nichts davon,
und keine Flagge wirkt.

## Einschalten

| Weg | Wann |
|---|---|
| `?debug=1` an die Adresse haengen | auf der veroeffentlichten Seite |
| gar nichts tun | lokal — `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `*.localhost` und `file:` sind automatisch offen |

```
https://baechtoldleroy.github.io/Fogreach/?debug=1
```

Der Schalter gilt **pro Sitzung** und steht in der Adresse. Es gibt bewusst
keinen Haken im Spielstand: ein Gate, das man einmal einschaltet und dann
vergisst, ist keines.

## Flaggen

Alle Flaggen wirken **nur** bei eingeschaltetem Debug-Modus. Kombinierbar mit `&`.

### Einstieg

| Flagge | Wirkung |
|---|---|
| `?dungeon=N` | direkt in Tiefe N starten. **Loescht den Spielstand.** |
| `?autostart=1` | Startbildschirm ueberspringen. **Loescht den Spielstand.** |

### Raum-Modi (#112)

| Flagge | Wirkung |
|---|---|
| `?mode=<id>` | erzwingt den Modus im **ersten** Raum |
| `?modes=a,b,c` | **Rundgang**: Raum 0 bekommt a, Raum 1 b, Raum 2 c, danach von vorn. Der Boss-/Finalraum bleibt ausgenommen. |

Bekannte Modi: `clear`, `defend`, `survival`, `hunt`, `escape`.

```
?dungeon=1&modes=defend,survival,hunt,escape
```

Der Rundgang schreibt pro Raum mit, was ansteht und wo sein Anker liegt — noetig,
weil einem scharfgestellten Raum absichtlich nichts anzusehen ist:

```
[Rundgang] Raum 2: hunt scharfgestellt, beweglicher Anker — losgehen, bis das Ziel im Blick liegt
[Rundgang] Raum 3: escape sofort gestartet
```

Unbekannte Namen werden benannt statt verschluckt:
`[Rundgang] unbekannte Modi uebersprungen: defnd — bekannt sind: clear, defend, escape, hunt, survival`

### Bosse (#77)

| Flagge | Wirkung |
|---|---|
| `?boss=<name>` | setzt den Boss SOFORT in den ersten Raum, statt Tiefe, Finalraum und Akt-Freischaltung zusammenkommen zu lassen |
| `&beat=1` | zeigt die Kettenmeister-Inszenierung, ohne dass `mara_warning` laufen muss |

| Boss | akzeptierte Namen |
|---|---|
| Kettenmeister | `kettenmeister`, `ketten`, `chainMaster`, `1` |
| Zeremonienmeister | `zeremonienmeister`, `zeremonie`, `ceremonyMaster`, `2` |
| Der Nachhall der Esse (ersetzt den Schattenrat) | `esse`, `nachhallEsse`, `3` (alt: `schattenrat`) |
| Elara, besessen | `elara`, `besessen`, `quelle`, `elaraBesessen` |
| Der Nachhall | `nachhall`, `echo`, `hall`, `25` |

```
?dungeon=1&boss=kettenmeister&beat=1
```

Ein unbekannter Name loest bewusst NICHT auf — die Konsole nennt die Liste, und
der Boss-Zweig wird gar nicht erst betreten. Ohne diese Bedingung spawnte der
Zweig einen Boss ohne Definition und riss das Spiel mit (gemessen mit
`?boss=quatsch`: "Cannot read properties of undefined").

### Akt-Zwischenszenen

Jeder Aktwechsel laeuft als Zwischenszene (seit b430 fest, ohne Flagge):
Pixel-Tableau je Akt mit Schwenk und Nebel, Messing-Plakette "Akt N" +
Aktname, Text Stueck fuer Stueck (Leertaste/Enter/Klick/Tippen weiter, ESC
oder "Überspringen" schliesst). Der Einfuehrungstext eines neuen Spiels ist
die Szene von Akt 1. Fehlt das Bild eines Akts, kommt die alte Titelkarte.

| Flagge | Wirkung |
|---|---|
| `?aktprobe=N` | zeigt beim Betreten des Hubs einmal die Szene von Akt N (`1`–`5`) bzw. den Epilog (`6` oder `epilog`). Der Spielstand bleibt unberuehrt. |

```
?debug=1&autostart=1&aktprobe=3
?debug=1&autostart=1&aktprobe=epilog
```

`autostart` loescht den Spielstand; wer seinen Stand behalten will, laesst es
weg und betritt den Hub ueber den Startbildschirm. Bilder:
`assets/sprites/aktwechsel/`, Standbilder aller Karten:
`node tools/aktwechselVorschau.js [en]` (nach `vorschau/`).

#### Zwischenszene vor dem Boss

Beim ERSTEN Kampf gegen jeden Boss laeuft eine Zwischenszene statt Banner und
Beat: Balken, Kamerafahrt zum Boss, Auftritt mit Effekt, Messing-Plakette mit
Siegel, zwei Seiten Rede (weiter per Taste, Klick oder Tipp; ESC oder
"Überspringen" beendet). Gemerkt wird das pro Spielstand als Quest-Flag
`bossintro_<bossId>` (z. B. `bossintro_chainMaster`); spaetere Kaempfe gegen
denselben Boss zeigen wieder den kurzen Banner.

Jeden Boss direkt ansehen — `?boss=` setzt ihn sofort in den ersten Raum und
zeigt die Szene IMMER, auch wenn sie im Spielstand schon gesehen ist:

```
?debug=1&dungeon=1&boss=kettenmeister
?debug=1&dungeon=1&boss=zeremonienmeister
?debug=1&dungeon=1&boss=esse
?debug=1&dungeon=1&boss=elara
?debug=1&dungeon=1&boss=nachhall
```

Der Nachhall (Tiefe 25, Stufe 2) fluestert aus dem Spielstand: wer ihn mit
eigener Stimme hoeren will, schliesst vorher "Wer du warst" ab (oder setzt
`self_remembered`). Seine Gestalt folgt den LP-Phasen (66 % / 33 %); zum
Ansehen in der Konsole `currentBoss.hp = currentBoss.maxHp * 0.6` bzw. `0.3`.
Im regulaeren Spiel erscheint er nur, solange "Was der Rauch behält" laeuft.

Bei Elara laeuft zuerst das Finale an der Quelle (sofern noch nicht gesehen),
die Zwischenszene folgt danach.
Standbilder je Boss: `VORSCHAU=1 node --test tests/bossZwischenszene.test.js`
schreibt `vorschau/bossintro_<boss>_auftritt.png` und `_plakette.png`
(Canvas-Testkopf: ohne Nebel und Licht wie im Spiel). Wie der Spieler es
sieht, nur im echten Browser (WebGL): `npx http-server -p 8080 -c-1 -s .`
und `node tools/bossIntroBrowser.js [kettenmeister ...]` schreibt
`vorschau/bossintro_browser_<boss>_<auftritt|plakette|rede|danach>.png`.

### Das Finale an der Esse (Story-Kern v6.1, Stufe 3)

`?finale=<schritt>` springt mit `?boss=elara` an eine Stelle des Finales. Die
Flagge stellt den Queststand her ("Die Quelle" aktiv), loescht `harren_dead`,
`elara_besiegt`, `elara_spared`, `elara_killed` und `story_ending` und setzt,
was der Schritt braucht. `&room=DieQuelle` stellt die echte Arena (die Glut in
der Mitte ist die Esse); ohne sie steht die Esse auf einem freien Fleck neben
dem Spieler.

| Schritt | Wirkung |
|---|---|
| `?finale=hammer` | von vorn: Elara empfaengt Dich, dann der erhobene Hammer (E halten an der Esse, auf dem Handy den Aktionsknopf) |
| `?finale=erkenntnis` | wie `hammer`, der Spieler steht schon an der Esse: sofort halten, bis die Erkenntnis kommt |
| `?finale=harren` | nach dem Loslassen: Elaras Satz, der Plan, Harren, der Stoss, der Hammer, die Besessenheit |
| `?finale=kampf` | gleich der Kampf (die Szene gilt als gesehen) |
| `?finale=raub` | Kampf, der erste Griff nach der Erinnerung nach 1,5 s; ohne belegte Faehigkeiten werden zwei gelernt und belegt |
| `?finale=zonen` | Kampf bei 60 % LP: Phase 2, die Arena verlischt |
| `?finale=echos` | Kampf, sie ruft sofort die Echos der Besiegten |
| `?finale=schlag` | Kampf bei 1 LP: der naechste Treffer ist der letzte (ihre eigene Klinge, dann der letzte Schlag an der Esse) |
| `?finale=loesen` | nach dem Kampf: Elara liegt an der Esse, gleich der letzte Schlag, dann das Urteil |

`&finaleflags=a,b` setzt zusaetzliche Quest-Flags, etwa
`self_remembered` (der erste Griff prallt an "Wer Du warst" ab),
`zeichen_bemerkt` (sie beginnt bei 85 %), `convoy_blown` (Mara kommt nicht).

```
?debug=1&dungeon=30&room=DieQuelle&boss=elara&finale=hammer
?debug=1&dungeon=30&room=DieQuelle&boss=elara&finale=raub&finaleflags=self_remembered
?debug=1&dungeon=30&room=DieQuelle&boss=elara&finale=loesen
```

`dungeon=` loescht den Spielstand (siehe oben). Ein unbekannter Schritt wird
auf der Konsole mit der Liste benannt und ignoriert.

### Spionage-Zwischenszenen (#197)

Seit b447 fest im Spiel (die Vorschau-Flagge `spionszene` gibt es nicht mehr).
Ansehen mit

```
?debug=1&dungeon=3&spy=1
```

`spy=1` erzwingt einen Spionage-Raum als ersten Raum (ohne Auftrag).

### Druckerpresse (#198)

Seit b447 fest im Spiel (die Vorschau-Flagge `presse` gibt es nicht mehr):
beim Drucken eines Edikts stampft die Presse zweimal, dann schliesst die
Druckerei. Die Presse (assets/sprites/presse/druckerpresse.png, 9 Bilder,
gebaut mit `node tools/presseBauen.js`) zeigt auch die Trailer-Einstellung 8.

### Elaras Kammer (#161)

| Flagge | Wirkung |
|---|---|
| `?versteck=1` | Kammer als erster Raum, erste Szene (sie zeigt Dir ihr Versteck) |
| `?versteck=werkstatt` | Kammer, Szene "ihre Werkstatt" |
| `?versteck=bruch_nacht` | Kammer, "die Nacht nach dem Bruch" (setzt Akt 4) |
| `?versteck=leer` | nur der Raum, ohne sie — zum Ansehen der Einrichtung |

Der Raum allein genuegt nicht: ob Elara dasteht und welche Szene laeuft,
entscheidet `versteckBesuchFaellig()` aus dem Queststand ueber mehrere Akte.
Die Flagge stellt darum den Stand mit her, den die gewuenschte Szene braucht,
und loescht die Gesehen-Flaggen der drei Szenen — sonst laeuft keine davon ein
zweites Mal.

```
?debug=1&versteck=werkstatt
```

`leer` ruehrt den Queststand NICHT an.


### Die sechs Sondergegner (#12)

| Flagge | Wirkung |
|---|---|
| `?sonder=1` | alle sechs, im Kreis um den Spieler |
| `?sonder=alarm,hund` | nur diese |

Bekannte Namen: `geschwuer`, `priester`, `beschwoerer`, `springer`, `hund`,
`alarm`. Ein unbekannter Name setzt nichts und wird auf der Konsole benannt.

Solange die Flagge gesetzt ist, faellt die **normale Welle des Raums aus** —
sechs Sondergegner plus eine volle Welle auf Tiefe 12 bedeuten den Tod, bevor
man den ersten Ruf gehoert hat. Was trotzdem dazukommt, haben sie selbst
gerufen: der Beschwoerer seine Wichte, der Alarmwicht seine Verstaerkung.

Sie werden in **jedem** Raum neu gesetzt, nicht nur im ersten.

```
?debug=1&dungeon=12&sonder=1
```

### Verborgene Funde (#113)


| Flagge | Wirkung |
|---|---|
| `?find=nische` | Wandnische in JEDEM Raum |
| `?find=lager` | Verlassenes Lager |
| `?find=falle` | Koederfalle |
| `?find=durchgang` | verschuetteter Durchgang (Kammer + Geroell), kein Fund am Weg |

Die Flagge erzwingt nicht nur die ART, sondern auch DASS ein Fund erscheint.
Ohne sie liegt die Rate bei ~26 % je Raum und der Durchgang bei 22 % — gezielt
zu treffen ist das nicht. Findet sich keine Stelle weit genug abseits, weicht
der erzwungene Fund auf einen beliebigen begehbaren Punkt aus; gemessen gab es
Raeume ganz ohne brauchbaren Kandidaten.

```
?debug=1&dungeon=4&find=durchgang
```

Der Durchgang erscheint auch mit der Flagge nur in etwa **jedem dritten Raum**: er
braucht eine 3×3-Wandfläche mit mindestens **zwei** Bodenfeldern auf *einer* Seite.
Ein nur eine Kachel breiter Mund reicht nicht — die Begehbarkeitsprüfung verwirft
1-Kachel-Engstellen ausdrücklich, die Kammer wäre dann nie erreichbar.

Auf der **Minikarte** ist die Kammer im Debug-Modus **blau** markiert, das Geröll
**orange**. Dazu sagt die Konsole, welcher Fall vorliegt:

```
[Durchgang] Kammer gestanzt — Kacheln 34/8 35/8 …, Mund 33/8  (Welt ~1104/272)
[Durchgang] Geroell bei Welt 1104/272 (Kachel 34/8), zerschlagbar.
[Durchgang] keine geeignete Wandflaeche in diesem Raum — Kammer entfaellt
[Durchgang] Kammer … waere nicht betretbar (Figur passt nicht hinein)
```


### Raumtypen

| Flagge | Wirkung |
|---|---|
| `?room=<Name>` | setzt diese Vorlage in **jeden** Raum |
| `?rooms=a,b,c` | Rundgang: Raum 0 bekommt a, Raum 1 b, Raum 2 c, danach von vorn |
| `?room=cave` | zwingt die prozeduralen Räume auf den Höhlen-Generator |
| `?room=bsp` | zwingt sie auf den BSP-Generator (rechteckige Kammern) |

Namen werden ohne Rücksicht auf Groß-/Kleinschreibung aufgelöst; unbekannte
werden mit der vollen Liste auf der Konsole benannt und dann ignoriert (der Lauf
bleibt zufällig). Es gibt rund 36 Vorlagen — die Liste steht in
`RoomTemplates.TEMPLATES`.

```
?debug=1&dungeon=3&rooms=Arena,Cathedral
```

Nachgemessen an der Rastergröße je Raum: ohne Flagge 24×24, 30×30, 32×32,
65×69 — mit `?room=Arena` viermal 36×28.

### Ereignisse erzwingen (#71, #129)

| Flagge | Wirkung |
|---|---|
| `?event=<id>` | erzwingt dieses Ereignis in JEDEM Raum |
| `?stark=<faktor>` | Figur staerker, schneller, zaeher: Schaden und Maximal-LP x Faktor; Angriffstempo und Lauftempo mit der Wurzel davon; +25 Prozentpunkte Krit. `?stark=1` heisst Faktor 5. Lauftempo bei x2,5 gedeckelt, Angriffs-Abklingzeit bei 320 ms (Spiel-Untergrenze). |

Raum 0 bekommt grundsätzlich nie ein Ereignis — die Flagge greift ab dem
zweiten Raum. Ein unbekannter Name wird mit der vollen Liste auf der Konsole
benannt statt still verschluckt.

Bekannte Namen: `treasure_cache`, `ambush`, `wandering_merchant`,
`trapped_chest`, `lore_fragment`, `environmental_hazard`, `shrine_buff`,
`gambling`, `elite_ambush`, `healing_fountain`, `sacrifice_altar`,
`chain_lock`.

```
?debug=1&dungeon=10&event=chain_lock
```

Der wandernde Händler (#165, fest eingebaut, keine Flagge mehr) ist der Alte
mit Handkarren, Amuletten und flackernder Laterne; der Spieler wird vor ihm
gezeichnet. Sofort zu sehen ab dem zweiten Raum:

```
?debug=1&dungeon=3&event=wandering_merchant
```

Das **Kettenschloss** (`chain_lock`) startet ein Minispiel: ein Zeiger wandert
über eine Leiste, Leertaste im hellen Fenster setzt einen Stift. Von Stift zu
Stift wird das Fenster enger und der Zeiger schneller; zwei Fehlgriffe sind
frei. Alle Stifte → Ausrüstung auf Belohnungstruhen-Niveau, ein Teil → Gold
nach Anteil, keiner → nichts.

### Kriegsschar (#95)

| Flagge | Wirkung |
|---|---|
| `?schar=1` | erzwingt in JEDEM Raum einen Bannerträger mit Gefolge |

Ohne die Flagge kommt die Schar so oft wie bisher ein Unique: gar nicht unter
Tiefe 6, danach etwa **ein- bis zweimal je Lauf** (gemessen: 0 von 10 Räumen auf
Tiefe 4, 2 von 10 auf Tiefe 20).

```
?debug=1&dungeon=12&schar=1
```

Die Flagge erzwingt den Plan, **nicht** die Mindestfläche: in einem Raum unter
150 000 px² kommt trotzdem keine Schar, weil dort das Gefolge nur eine Falle
wäre. Gemessen gibt es Räume mit 20k, 63k und 84k px² — rund ein Viertel fällt
darunter. Wer eine Schar sehen will und keine bekommt, ist in so einem Raum.

Die Konsole schreibt mit, was gesetzt wurde:

```
[Kriegsschar] Bannertraeger (Typ 1) + 3 Gefolge, geerbter Affix: spectral_hit — Raum bekommt 5 Gegner statt 4
```

Woran man die Schar im Spiel erkennt:

- Der Anführer trägt einen **zweizeiligen goldenen** Namenszug `BANNERTRÄGER · <Typ>`
  mit seinen Affixen darunter. Ein Champion bleibt einzeilig und orange.
- Das Gefolge hat **denselben Gegnertyp** wie er und ist **leicht in seiner
  Aurafarbe getönt** (30 % Richtung Weiss aufgehellt: hell genug, um nicht wie
  vier Elites zu wirken, kräftig genug, um im Raum aufzufallen). Die Tönung überlebt Trefferblitze.
- Auren, Tempo und Mehrfachschuss werden **nie** vererbt — fünf Gegner mit
  Frostaura wären dauerhaft verlangsamt ohne Ausweg.

### Leistungsmessung

| Flagge | Wirkung |
|---|---|
| `?perf=1` | Messung + Overlay einschalten (Voraussetzung fuer alle folgenden) |
| `&nofog=1` `&nomask=1` `&nospot=1` `&noexpl=1` | einzelne Nebel-Schichten abschalten, um den Kostentreiber einzukreisen |
| `&explRes=0..1` | Aufloesung der Erkundungs-Textur |
| `&fogInterval=N` | Nebel nur jeden N-ten Frame aktualisieren |
| `&rays=N` | Anzahl der Sichtstrahlen |

Die gesamte Nebel-Analyse aus #70 lief ueber diese Flaggen.

### Sonstiges

| Flagge | Wirkung |
|---|---|
| `?spy=1` | Spionage-Mission erzwingen |
| `?roomsize=1` | Verteilung der Raumgroessen mitzaehlen und ausgeben |
| `?hubdebug=1` | Hub-Collider sichtbar machen |
| `?lauf=erfolg` | (b419) Zeigt nach dem Betreten des Hubs die Laufzusammenfassung ("Lauf abgeschlossen") mit Beispielwerten: Tiefe 4 bis 9, 14 Raeume, 87 Gegner, 5 Elite, 1 Boss, +3460 XP, +1284 Gold, +2 Fragmente, 12:34. `?lauf=tod` dasselbe als "Im Dungeon gefallen". Einmal je Seitenaufruf. Mit `&autostart=1` direkt in den Hub. |
| `?sitzung=oeffentlich` | (#166) Spielt die oeffentliche Ratssitzung gleich nach dem Betreten des Hubs, ohne passenden Spielstand (Vorschau). `?sitzung=geheim` spielt ebenso die geheime Sitzung. Beide laufen auch ohne Flagge auf der gemalten Buehne; die Flagge ist nur die Abkuerzung dorthin. |

### Trailer-Modus

`?trailer=1` macht das Spiel zum Drehort fuer den 30-Sekunden-Trailer aus
[`trailer-drehbuch.md`](trailer-drehbuch.md). Code: [`js/trailerModus.js`](../js/trailerModus.js).

```
http://localhost:8123/?trailer=1
https://baechtoldleroy.github.io/Fogreach/?debug=1&trailer=1
```

Was die Flagge aendert:

- **Hochkant 9:16** (seit b446): das Spielbild ist 540×960 statt 960×480, fuer
  Reels, TikTok und Shorts. Die Kamera geht nah an die Figuren (Zoom 1,3 bis 2),
  die Kampf-Choreografie laeuft senkrecht; Dialog, Boss-Plakette, Inventar,
  Sitzungsbuehne liegen auf einer zweiten Kamera ohne Zoom und sind fuer die
  schmale Breite eingepasst. `?trailer=1&quer=1` behaelt das Querformat
  960×480 mit den Einstellungen wie zuvor. Ohne `trailer` aendert `quer` nichts.

- **Kein HUD**: Lebensleiste, Faehigkeitenleiste, Minikarte, Questanzeige,
  Hub-Knoepfe, [E]-Hinweise, Tutorial-Hinweise, Toasts — alles, was am
  Bildschirm klebt (Tiefe 1001 bis 2400), wird per Kamera ausgeblendet.
  Ausnahme: Einstellung 5 (Kampf mit HUD) und Taste `H`.
- **Trailer-HUD**: wo das HUD im Bild ist, klebt es vergroessert an den
  Bildraendern — hochkant Leiste (Leben, Erfahrung, Gold) oben links und
  Knoepfe oben rechts 1,4-fach (die Minikarte bleibt weg), die
  Faehigkeitsleiste 1,5-fach unten mittig, Meldungen ("Stufe 2 erreicht!")
  darueber, der Gebietsname unter der Leiste; quer alles 1,25-fach. Je
  Gruppe zeichnet eine eigene Kamera mit Zoom; das Spiel selbst merkt
  nichts. Die Zonen der Plattformen (oben 12 %, unten 20 %) achtet das HUD
  nicht — was deren Oberflaeche verdeckt, entscheidet der Schnitt.
- **Tempo**: jede Einstellung kommt in ~0,3 s zur Sache, ihr Hoehepunkt
  steht nach 0,2–3 s (Kamerafahrten mit easeOut, kurze Abblenden).
- **Unsterblich**: kein Schaden, kein Game Over, keine Erfahrung (ein
  Stufenaufstieg blitzt sonst mitten durchs Bild). Nur Einstellung 5 laesst
  Treffer bis auf ein Viertel des Lebens zu und gibt gezielt Erfahrung.
- **Kein Spielstand wird geschrieben.** Der Trailer beginnt immer mit einem
  frischen Spiel im Speicher; `saveSlots.js` leitet jedes Schreiben in einen
  Sandkasten um. Gelesen werden nur die globalen Einstellungen (Lautstaerke,
  Sprache). Die Slots bleiben unberuehrt, auch wenn das Spiel speichert.
- Der Startbildschirm wird uebersprungen, es geht direkt in den Hub.

| Taste | Wirkung |
|---|---|
| `0`–`9` | Einstellung aus dem Drehbuch aufbauen (Tabelle unten; `0` = Inventar) |
| `R` | Aufnahme starten / stoppen — das Spiel nimmt sich selbst auf (siehe „Trailer aufnehmen“) |
| `Z` | Zeitlupe an/aus — Spieluhr, Physik, Tweens, Animationen auf 0.3x; bleibt ueber Einstellungen hinweg an |
| `L` | Letterbox-Balken an/aus — hochkant die Schutzzonen der Plattformen (oben 12 %, unten 20 %), quer je 12 % |
| `H` | HUD einblenden / wieder ausblenden (fuer Schnittbilder mit Oberflaeche); gross an den Raendern (s. o.) — was dann noch nicht ganz ins Bild passt, bleibt weg |
| `M` | Ton an/aus |

Im Trailer-Modus gehoeren diese Tasten dem Trailer: `1`–`4` und `R` loesen
keine Faehigkeiten aus, `M` schaltet nur einmal um. Eine kurze Tastenhilfe
steht beim Laden 3 s unten im Browserfenster — als Seitenelement ausserhalb
des Spielbilds, sie landet also in keiner Aufnahme — und verschwindet
spaetestens mit der ersten Einstellung. Der Mauszeiger ist ueber dem Spiel
ausgeblendet.

| Taste | Einstellung | Was passiert |
|---|---|---|
| `0` | Inventar | Dungeon, Raster und Papierpuppe voller Beute aller Seltenheiten (legendaere Glutaxt, Amulette, Bannlaterne); nach 0,15 s geht das Inventar auf, nach 0,75 s der Tooltip eines legendaeren Stuecks. |
| `1` | Nebelstadt | Hub aus Schwarz, Nebelschleier lichtet sich, Fahrt ueber den Platz zum Rathaus (2,2 s, setzt sofort ein). Spieler ausgeblendet. |
| `2` | Der Rat | Spieler vor Aldric, nach 0,25 s geht der Messing-Dialog auf: „Der Rat hat Arbeit für Dich, Archivschmied.“ |
| `3` | Abstieg | Spieler an der Rathauskeller-Tuer, geht sofort los, Abblende ab 0,65 s — nach ~1,3 s der erste Kellerraum, aus Schwarz, ohne Gegner. |
| `4` | Kampf-Montage | Je ~0,9 s (Wirbelwind ab 0,2 s, die Wache faellt bei 3,55 s): Wirbelwind in fuenf Wichte, Ansturm durch drei Schlaeger, Hammer der Ahnen, eine Kettenwache faellt (Schild blitzt zuerst). |
| `5` | Kampf mit HUD | Dungeon mit HUD: sechs Gegner rundum, Treffer ab 0,1 s lassen die Lebensleiste unter ein Drittel sinken, Wirbelwind (0,3 s), Trank (1,1 s; die Leiste steigt in 0,5 s um gut die Haelfte), Ansturm (1,4 s), Hammer (1,9–2,3 s), die Erfahrungsleiste fuellt sich bis zum Stufenaufstieg (2,45 s: goldener Blitz, Leben voll, Meldung). Das HUD gross an den Bildraendern. |
| `6` | Geheime Sitzung | Die Ratskammer-Buehne (Magistrat, Klerus, Garde, Kerzen) sofort im Bild, kurze Fahrt heran (2,2 s). |
| `7` | Boss | Die Boss-Zwischenszene des Kettenmeisters (Balken, Schwenk, Plakette) laeuft im Trailer in 60 % der Zeit und ohne Taste durch — Plakette bei ~0,8 s, Rede ab ~1,1 s, nach der ersten Seite (2,2 s) der Ausklang, Weiter/Ueberspringen-Knoepfe nicht im Bild —, dann der Hammer (2,6 s, Einschlag 2,95 s) in Zeitlupe, Bildschirm bebt; ab 4,3 s wieder Normaltempo. Spieler und Boss stehen auf einem freien Platz ohne Treppe oder Tuer dazwischen; Treppen und Tueren sind in dieser Einstellung ausgeblendet. Dauer ~4,5 s. |
| `8` | Die Presse | Die stampfende Presse gross im Bild, drei Stoesse in gut 1,3 s (der erste nach ~0,15 s) mit fliegenden Flugblaettern. Ohne ihr Bild: Kamera auf der Druckerei, drei Stoesse, dann die Druckerei-Ansicht. |
| `9` | Titel | Schwarz, die Laterne vom Startbildschirm leuchtet auf, der Nebel reisst ab 0,4 s auf, FOGREACH in Messing steht nach ~1,3 s. |

Jede Einstellung saet den Zufall fest (Raumfolge, Gegner, Funken) und baut ihre
Szene neu auf — dieselbe Taste ergibt dasselbe Bild, egal was vorher lief.
Szenenwechsel laufen ueber die Wege des Spiels (Rueckweg aus dem Dungeon,
Debug-Abstieg aus dem Hub); ein schwarzer Vorhang deckt sie ab.

Zum Weiterreichen an Tests: `?trailer=1&einstellung=N` startet Einstellung N,
sobald der Hub steht; `window.TrailerModus.taste('4')` wirkt wie der Tastendruck.

#### Trailer aufnehmen

Das Spiel nimmt sich selbst auf: Taste `R` zeichnet das Spielbild (60 fps) mit
Spielton und Musik auf und legt beim Stoppen eine Videodatei in den
Download-Ordner. Kein OBS noetig.

1. Spiel lokal starten (`npx http-server -p 8123 -c-1 .`) und im Browser
   (Chrome oder Edge) `http://localhost:8123/?trailer=1` oeffnen.
2. Die Aufnahme hat eine feste Groesse, egal wie gross das Fenster ist:
   hochkant 1080×1920 (das 540×960-Spielbild mit harten Pixeln verdoppelt),
   quer (`&quer=1`) 960×480.
3. Einmal ins Spiel klicken, damit der Ton freigegeben ist, und warten, bis der
   Hub steht.
4. Die Taste der Einstellung druecken, z. B. `4`.
5. Sofort `R` druecken — oben rechts im Fenster erscheint ein roter Punkt
   (nicht im Video).
6. Die Einstellung laufen lassen (3–5 s), bei Bedarf `Z` fuer Zeitlupe.
7. `R` druecken — die Aufnahme stoppt, die Datei landet im Download-Ordner:
   `fogreach_4_kampf_01.webm`, beim naechsten Mal `_02` usw. Ohne gewaehlte
   Einstellung heisst sie `fogreach_frei_01.webm`.
8. Pro Einstellung 3–5 Durchlaeufe aufnehmen und den besten nehmen. Die
   Nummer zaehlt nur bis zum Neuladen der Seite; danach beginnt sie wieder bei
   `_01` (der Browser haengt bei gleichem Namen selbst „(1)“ an).

Format: WebM (VP9, sonst VP8), 12 Mbit/s, Ton Opus. DaVinci Resolve und CapCut
lesen WebM; wer ein anderes Format braucht, wandelt mit
`ffmpeg -i fogreach_4_kampf_01.webm -c:v libx264 -crf 16 fogreach_4_kampf_01.mp4`.
Ist `M` (stumm) gedrueckt, ist auch die Aufnahme stumm. Kann der Browser nicht
aufnehmen (kein MediaRecorder), erscheint unten eine Meldung statt einer
Aufnahme.

Texttafeln kommen im Schnitt dazu (siehe Drehbuch), nicht ins Spiel.

Alternativ geht weiter OBS (1920×1080, 60 fps, Fenster- oder
Bildschirmaufnahme); die Tastenhilfe ist dann 3 s nach dem Laden weg.

## Was sonst noch am Gate haengt

**Debug-Sektion im Einstellungsmenue** — Auto-Start, „Kein Nebel",
„+100 Eisenbrocken". Wird ausserhalb des Debug-Modus gar nicht erst gezeichnet.

**„+1 Fragment" im Wissensbaum** — vergibt die Waehrung, die das Spiel sonst nur
ueber seltene Lore-Fragmente ausschuettet.

**Fehler-Overlay** — im Debug-Modus der volle Stacktrace auf rotem Grund. Sonst
sieht der Spieler eine einzelne neutrale Zeile, die nach 6 s verschwindet.

**Gespeicherte Debug-Schalter** — `debug.autostart` und `debug.noFow` wirken
ebenfalls nur im Debug-Modus. Die Sektion auszublenden haette nicht gereicht:
wer `autostart` frueher einmal gesetzt hat, traegt ihn im Spielstand weiter, und
Auto-Start loescht den Spielstand bei **jedem** Start. Die Werte bleiben
gespeichert, sie greifen bloss nicht.

## Konsolenbefehle

In der Browser-Konsole aufrufen. `__ruestung()` gibt es immer, auch auf der ausgelieferten Seite ohne `?debug=1`; `__perfDump()` und `__spezialProbe()` nur im Debug-Modus.

| Befehl | Wirkung |
|---|---|
| `__ruestung()` | Zeigt, woher die Ruestung kommt: Grundwerte der Stuecke, Affix-Topf, die vier Buff-Schichten und den Endwert gegen den Deckel (80 %). Gibt dasselbe als Objekt zurueck. (#152) |
| `__perfDump()` | Leistungsbericht als JSON, nur mit `?perf=1`. |
| `__spezialProbe(...ids)` | (#174) Lernt bis zu vier Faehigkeiten und legt sie auf Q/W/E/R, ohne den Skillbaum anzufassen; ihre Bewegungs- und Wirkbilder werden nachgeladen. Ohne Angabe: Wirbel, Hammer, Ansturm, Schattenschritt. IDs: `whirlwind`, `hammer`, `charge`, `teleportDash`, `frostNova`, `cycloneStrike`, `deathBlow`, `steelGrasp`, `twistingBlades`, `frenzy`, `berserk`, `heilwunde`. Beispiel: `__spezialProbe('deathBlow', 'steelGrasp', 'twistingBlades', 'heilwunde')`, Adresse dazu `?debug=1&dungeon=5&autostart=1&stark=1`. |

## Fuer Entwickler

Der Schalter selbst ist [`js/debugGate.js`](../js/debugGate.js) und muss als
**erstes** Spiel-Skript laden — das Fehler-Overlay in `index.html` fragt ihn
schon.

```js
window.DebugGate.aktiv()        // ist der Debug-Modus an?
window.DebugGate.flagge('mode') // Wert der Flagge, oder null
window.DebugGate.an('perf')     // gesetzt und nicht "0"/"false"?
```

Eine neue Debug-Flagge geht **immer** hierueber, nie ueber `location.search`
direkt. Sonst waere sie am Gate vorbei ausgeliefert — genau der Zustand, den #88
beseitigt hat.

Beim Namensvergleich zaehlt das `=` im Muster: in `?modes=a,b` folgt auf `mode`
ein `s`, `mode=` greift dort also nicht. Wer das je auf Teilstring-Suche
umstellt, bricht den Rundgang.

## Verwandt

Die oeffentlich erreichbare Zweitkopie unter `deploy/demonfall/game/` faellt seit
#88 aus dem Pages-Build (siehe [`_config.yml`](../_config.yml)). Sie stammt aus
einem frueheren Stand, ruft noch `grantCheatTestWeapon()` auf und haette jedes
Gate ueber `js/` umgehbar gemacht. Der Ordner bleibt im Repo, wird aber nicht
mehr veroeffentlicht.
