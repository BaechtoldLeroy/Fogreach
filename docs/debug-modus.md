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
