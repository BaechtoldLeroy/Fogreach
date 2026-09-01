// tests/inventarSymbolgroesse.test.js — Die Symbole im Inventarraster duerfen
// nicht schrumpfen.
//
// Vorgeschichte: Erst waren es 20 gleich grosse Faecher, und ein fester Deckel
// (0.65) hielt Fach und Symbol klein — 62x42 px Fach, 25x25 px Symbol bei einer
// 48x48-Textur. Nach zwei Runden Nachbesserung stand es bei 84x56 und 44x44.
//
// Mit #123 B ist das Modell ein anderes: das Inventar ist ein Raster aus
// QUADRATISCHEN Zellen, und ein Gegenstand ueberdeckt so viele davon, wie seine
// Groesse verlangt. "Fachgroesse" gibt es nicht mehr — deshalb prueft dieser
// Test jetzt die ZELLE und die daraus abgeleitete Symbolgroesse.
//
// Die alte Zusicherung bleibt in der Sache erhalten: ein Symbol darf nicht
// wieder auf ein Viertel seiner Textur zusammenfallen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'inventory.js'), 'utf8');

function zahl(muster, name) {
  const m = QUELLE.match(muster);
  assert.ok(m, name + ' nicht gefunden');
  return Number(m[1]);
}

test('Inventar: die Zellen sind quadratisch', () => {
  // Ohne das kaemen 48 x 80 px heraus (480/10 gegen 320/4) — ein 1x1-Trank
  // saehe aus wie ein Hochformat, eine 2x3-Ruestung waere verzerrt.
  assert.ok(QUELLE.includes('Math.min(GRID_W / GRID_COLS, GRID_H / GRID_ROWS)'),
    'die Zellenkante wird nicht als kleineres der beiden Masse gebildet');
  assert.ok(/const zelleW = zelle;/.test(QUELLE) && /const zelleH = zelle;/.test(QUELLE),
    'Breite und Hoehe der Zelle sind nicht dasselbe Mass');
});

test('Inventar: das Symbol fuellt seine Zellen spuerbar aus', () => {
  const PANEL_W = zahl(/PANEL_W = ([0-9]+)/, 'PANEL_W');
  const PANEL_H = zahl(/PANEL_H = ([0-9]+)/, 'PANEL_H');
  const fuge = zahl(/const zelleBild = zelle \* ([0-9.]+);/, 'Zellenfuge');
  const marke = "const _sx = (breite * ";
  const iA = QUELLE.indexOf(marke);
  assert.ok(iA > 0, "Symbolanteil nicht gefunden");
  const symbolAnteil = parseFloat(QUELLE.slice(iA + marke.length));
  assert.ok(symbolAnteil > 0, "Symbolanteil nicht lesbar");

  // Der Deckel von vorher ist WIEDER RAUS: er machte den Bogen kuerzer, aber
  // nicht breiter — die Enge kam aus der Zeichnung selbst (in der 48er-Textur
  // nur 21 px breit). Behoben wurde sie an der Quelle, indem die
  // Bogenzeichnung waagerecht gestreckt wird. Hier wird deshalb das Gegenteil
  // festgehalten: es darf voll auf das Rechteck skaliert werden.
  assert.ok(QUELLE.includes("setDisplaySize(breite * 0.86, hoehe * 0.86)"),
    "das Symbol fuellt sein Rechteck nicht mehr voll aus");
  const gfx = fs.readFileSync(path.join(__dirname, "..", "js", "graphics.js"), "utf8");
  const iBow = gfx.indexOf("key: 'itBow'");
  assert.ok(iBow > 0, "itBow nicht gefunden");
  assert.ok(gfx.slice(iBow, iBow + 1200).includes("gestrecktesZeichnen(gBasis, 1.9"),
    "die Bogenzeichnung wird nicht mehr verbreitert — sie wird im 1x3-Feld zum Faden");

  const COLS = 10, ROWS = 4;                 // INV_COLS / INV_ROWS aus main.js
  const GRID_W = PANEL_W - 320;
  const GRID_H = PANEL_H - 160;
  const zelle = Math.min(GRID_W / COLS, GRID_H / ROWS);

  // Kleinster Fall: ein 1x1-Gegenstand (Trank, Material, Amulett).
  const kleinstesRechteck = zelle * fuge;
  const symbolPx = kleinstesRechteck * symbolAnteil;

  // Verlauf im alten Modell: 25 -> 34 -> 44 px. Die Schwelle bleibt bei 36 —
  // im Rastermodell ist die Zelle 48 px, ein 1x1-Symbol also naturgemaess
  // kleiner als ein 2x4-Symbol, aber es darf nicht wieder Richtung 25 fallen.
  assert.ok(symbolPx >= 36,
    'ein 1x1-Symbol ist nur ' + symbolPx.toFixed(0) + ' px gross — erwartet mindestens 36');

  // Und das Raster muss in die Flaeche passen, sonst ragt es aus dem Panel.
  assert.ok(zelle * COLS <= GRID_W && zelle * ROWS <= GRID_H,
    'das Raster passt nicht in die Rasterflaeche: ' + (zelle * COLS) + ' x ' + (zelle * ROWS)
    + ' in ' + GRID_W + ' x ' + GRID_H);
});

test('Inventar: Gegenstaende werden ueber ihre Zellen gespannt, nicht fest gesetzt', () => {
  // Der Kern von #123 B. Bliebe die Groesse fest, waere das Raster nur Kosmetik.
  assert.ok(/const g = G\.groesse\(it\);/.test(QUELLE),
    'die Gegenstandsgroesse wird beim Zeichnen nicht abgefragt');
  assert.ok(/const breite = g\.b \* zW \* [0-9.]+;/.test(QUELLE),
    'die Breite wird nicht aus der Gegenstandsgroesse gebildet');
  assert.ok(/const hoehe = g\.h \* zH \* [0-9.]+;/.test(QUELLE),
    'die Hoehe wird nicht aus der Gegenstandsgroesse gebildet');
});

test('Ausruestung: das Symbol traegt die Form des Gegenstands, nicht die des Platzes', () => {
  // Die Plaetze der Papierpuppe haben verschiedene Formen (Kopf 64x64,
  // Koerper/Waffe 64x96). Auf die PLATZform gezogen wurde ein 2x2-Helm im
  // Koerperplatz um das Anderthalbfache in die Laenge gestreckt — im Raster
  // daneben sah derselbe Helm anders aus.
  assert.ok(QUELLE.includes('window.InventoryGrid.groesse(it)'),
    'die Ausruestung fragt die Gegenstandsgroesse nicht ab');
  assert.ok(QUELLE.includes('const f = Math.min(platzB / gg.b, platzH / gg.h);'),
    'das Symbol wird nicht verhaeltnistreu in den Platz eingepasst');

  // Nachgerechnet: ein 2x2-Gegenstand bleibt quadratisch, egal in welchem Platz.
  const einpassen = (b, h, pw, ph) => {
    const pb = pw * 0.82, phh = ph * 0.82;
    const f = Math.min(pb / b, phh / h);
    return { w: b * f, h: h * f };
  };
  const imKopf = einpassen(2, 2, 64, 64);
  const imKoerper = einpassen(2, 2, 64, 96);
  assert.ok(Math.abs(imKopf.w / imKopf.h - 1) < 0.001, 'im Kopfplatz nicht quadratisch');
  assert.ok(Math.abs(imKoerper.w / imKoerper.h - 1) < 0.001,
    'im Koerperplatz verzerrt — Verhaeltnis ' + (imKoerper.w / imKoerper.h).toFixed(2));

  // Und ein 1x3-Bogen bleibt hoch und schmal.
  const bogen = einpassen(1, 3, 64, 96);
  assert.ok(bogen.h > bogen.w * 2.5,
    'der Bogen ist im Platz nicht mehr hoch und schmal: ' + bogen.w.toFixed(0) + 'x' + bogen.h.toFixed(0));
});

test('Ausruestung: das Seltenheits-Overlay folgt der Platzgroesse', () => {
  // Es lag auf der Naturgroesse der uiSlot-Textur (96x64) und war damit
  // BREITER als der Platz, seit die Plaetze eigene Masse haben — die Farbe
  // faerbte ueber den Rand hinaus.
  const i = QUELLE.indexOf("const highlight = scene.add.image(_ex, y,");
  assert.ok(i > 0, 'Ausruestungs-Overlay nicht gefunden');
  const block = QUELLE.slice(i, i + 260);
  assert.ok(block.includes('setDisplaySize(_lage.w, _lage.h)'),
    'das Overlay folgt nicht der Platzgroesse');
});

test('Inventar: Doppelklick legt an', () => {
  assert.ok(QUELLE.includes('const DOPPELKLICK_MS = 350;'),
    'keine Doppelklick-Spanne gesetzt');
  const i = QUELLE.indexOf('letzterKlick.index === i');
  assert.ok(i > 0, 'der zweite Klick wird nicht gegen den ersten geprueft');
  const block = QUELLE.slice(i, i + 500);
  assert.ok(block.includes('equipSelectedItem()'),
    'der Doppelklick legt nichts an');
  // Die Zeitbasis muss die Spieluhr sein: sonst geht eine Pause zwischen zwei
  // Klicks als langsamer Doppelklick durch.
  const vor = QUELLE.slice(Math.max(0, i - 400), i);
  assert.ok(vor.includes('window.gameNow'),
    'der Doppelklick misst nicht gegen die Spieluhr');
});
