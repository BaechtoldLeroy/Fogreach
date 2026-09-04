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
| Schattenrat | `schattenrat`, `schatten`, `shadowCouncillor`, `3` |

```
?dungeon=1&boss=kettenmeister&beat=1
```

Ein unbekannter Name loest bewusst NICHT auf — die Konsole nennt die Liste, und
der Boss-Zweig wird gar nicht erst betreten. Ohne diese Bedingung spawnte der
Zweig einen Boss ohne Definition und riss das Spiel mit (gemessen mit
`?boss=quatsch`: "Cannot read properties of undefined").

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
| `?stark=<faktor>` | Figur staerker und schneller: Schaden x Faktor, Angriffstakt und Lauftempo mit der Wurzel davon, +25 % Krit. `?stark=1` heisst Faktor 5. Lauftempo bei x2,5 gedeckelt. |

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
