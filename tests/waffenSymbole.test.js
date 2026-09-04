// #117: Waffentypische Symbole statt eines Sammel-Icons.
//
// Die Optik selbst ist nicht testbar — ob ein Umriss "wie eine Axt" aussieht,
// entscheidet nur ein Blick. Testbar sind die drei Wege, auf denen die Sache
// STILL kaputtgeht:
//   1. zwei Waffen teilen sich wieder ein Symbol (der Befund aus dem Issue),
//   2. ein iconKey verweist ins Leere, weil die Zeichenroutine fehlt oder
//      umbenannt wurde -> Phaser zeigt den grünen "missing texture"-Kasten,
//      ohne dass irgendwo ein Fehler auftaucht,
//   3. der Rückfall für unbekannte Schlüssel geht verloren -> Altspielstände
//      mit gespeichertem iconKey verlieren ihr Symbol.
//
// Die Symbole sind KEINE Bilddateien, sondern Zeichenroutinen in
// createItemGraphics() (js/graphics.js). Deshalb wird die Funktion hier mit
// einem Graphics-Attrappen wirklich AUSGEFÜHRT — ein Textscan über die Datei
// würde einen Zeichenfehler (z. B. eine fehlende Phaser-Methode) durchlassen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const REPO = path.join(__dirname, '..');

const NAHKAMPF = {
  WPN_EISENKLINGE: 'Eisenklinge',
  WPN_SCHATTENDOLCH: 'Schattendolch',
  WPN_KETTENMORGENSTERN: 'Kettenmorgenstern',
  WPN_GLUTAXT: 'Glutaxt',
  WPN_RICHTSCHWERT: 'Richtschwert',
  WPN_KRIEGSHAMMER: 'Kettenrat-Kriegshammer'
};

// Bekannte Altlast, nicht Teil von #117: 'itAccessory' (Ritualamulett in
// js/questSystem.js) hat nie eine Zeichenroutine gehabt und fällt über
// resolveItemIconKey auf 'itMat' zurück. Bewusst ausgenommen, damit dieser
// Test nicht an einer fremden Baustelle rot ist — verschwindet der Eintrag,
// darf die Zeile hier mit weg.
const BEKANNTE_LUECKEN = new Set(['itAccessory']);

// --- Hilfen ---------------------------------------------------------------

// Führt createItemGraphics() gegen eine Graphics-Attrappe aus und liefert die
// Liste der erzeugten Texturschlüssel. graphics.js hängt die Funktion nicht an
// window, deshalb wird sie über ein angehängtes `return` herausgereicht.
function erzeugteSymbole() {
  const code = fs.readFileSync(path.join(REPO, 'js', 'graphics.js'), 'utf8');
  const keys = [];
  const g = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'generateTexture') return (key) => { keys.push(key); };
      return () => g;
    }
  });
  const szene = { add: { graphics: () => g }, textures: { exists: () => false } };
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'Phaser', 'console', 'document',
    code + '\n;return { createItemGraphics };');
  const api = fn({}, { Math: { DegToRad: (d) => d * Math.PI / 180 } }, console, undefined);
  api.createItemGraphics.call(szene);
  return keys;
}

function waffenBasen() {
  resetStore();
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  const nach = {};
  globalThis.window.LootSystem.ITEM_BASES.forEach((b) => { nach[b.key] = b; });
  return nach;
}

// Alle im Spielcode als Literal vergebenen iconKeys einsammeln.
function verwendeteSymbole() {
  const gefunden = new Set();
  const lauf = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return lauf(p);
      if (!e.name.endsWith('.js')) return;
      const src = fs.readFileSync(p, 'utf8');
      const re = /iconKey:\s*'([A-Za-z_][A-Za-z0-9_]*)'/g;
      let m;
      while ((m = re.exec(src)) !== null) gefunden.add(m[1]);
    });
  };
  lauf(path.join(REPO, 'js'));
  return gefunden;
}

// Lädt resolveItemIconKey aus js/inventory.js. Die Datei ist ein klassisches
// Skript ohne Export; `tooltip`/`invUI` sind im Browser Globals aus main.js und
// müssen als Bindings existieren, sonst wirft schon der Ladevorgang.
function ladeIconAufloesung(vorhandeneTexturen) {
  const code = fs.readFileSync(path.join(REPO, 'js', 'inventory.js'), 'utf8');
  const win = {};
  win.game = { textures: { exists: (k) => vorhandeneTexturen.has(k) } };
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'localStorage', 'console', 'Phaser', 'tooltip', 'invUI',
    code + '\n;return { resolveItemIconKey };');
  return fn(win, ls, console, { Math: { DegToRad: (d) => d * Math.PI / 180 } }, undefined, undefined)
    .resolveItemIconKey;
}

// --- Tests ----------------------------------------------------------------

test('#117: jede der sechs Nahkampfwaffen traegt ein EIGENES Symbol', () => {
  const basen = waffenBasen();
  const gesehen = new Map();
  Object.keys(NAHKAMPF).forEach((k) => {
    const b = basen[k];
    assert.ok(b, k + ' fehlt in ITEM_BASES');
    assert.ok(typeof b.iconKey === 'string' && b.iconKey.length > 0, k + ' hat keinen iconKey');
    assert.notStrictEqual(b.iconKey, 'itWeapon',
      NAHKAMPF[k] + ' haengt wieder am Sammel-Icon itWeapon');
    const doppelt = gesehen.get(b.iconKey);
    assert.ok(!doppelt,
      NAHKAMPF[k] + ' teilt sich das Symbol ' + b.iconKey + ' mit ' + NAHKAMPF[doppelt]);
    gesehen.set(b.iconKey, k);
  });
  assert.strictEqual(gesehen.size, 6);
});

test('Auch die Boegen haben eigene Symbole (#125 loest #117 ab)', () => {
  // #117 liess die vier Boegen bewusst auf dem Sammel-Icon itBow: dort ging es
  // um die Nahkampfwaffen. #125 hat den Umfang erweitert — vier gleich
  // aussehende Boegen sind derselbe Befund wie vierzehn gleich aussehende
  // Amulette. Der Test kehrt sich damit um: er hielt das Sammel-Icon fest,
  // jetzt haelt er die Trennung fest.
  const basen = waffenBasen();
  const gesehen = new Map();
  ['WPN_ESCHENBOGEN', 'WPN_HORNBOGEN', 'WPN_GLUTBOGEN', 'WPN_NEBELBOGEN'].forEach((k) => {
    const b = basen[k];
    assert.ok(b, k + ' fehlt in ITEM_BASES');
    assert.notStrictEqual(b.iconKey, 'itBow', k + ' haengt wieder am Sammel-Icon itBow');
    const doppelt = gesehen.get(b.iconKey);
    assert.ok(!doppelt, k + ' teilt sich ' + b.iconKey + ' mit ' + doppelt);
    gesehen.set(b.iconKey, k);
  });
  assert.strictEqual(gesehen.size, 4);
});

test('#117: Elaras Klinge traegt ein Schwert-Symbol, nicht mehr das Sammel-Icon', () => {
  // Die Questbelohnung steht als Literal in js/questSystem.js und laeuft nicht
  // ueber ITEM_BASES — sie wuerde beim Umstellen der Basen still zurueckbleiben.
  const src = fs.readFileSync(path.join(REPO, 'js', 'questSystem.js'), 'utf8');
  const m = src.match(/key: 'ELARAS_KLINGE'[^}]*?iconKey: '([A-Za-z0-9_]+)'/);
  assert.ok(m, 'ELARAS_KLINGE oder ihr iconKey nicht gefunden');
  const basen = waffenBasen();
  const schwerter = [basen.WPN_EISENKLINGE.iconKey, basen.WPN_RICHTSCHWERT.iconKey];
  assert.ok(schwerter.includes(m[1]),
    'Elaras Klinge nutzt ' + m[1] + ' — erwartet eines von ' + schwerter.join('/'));
});

test('#117: jeder verwendete iconKey wird auch gezeichnet — kein Verweis ins Leere', () => {
  const erzeugt = new Set(erzeugteSymbole());
  verwendeteSymbole().forEach((key) => {
    if (BEKANNTE_LUECKEN.has(key)) return;
    assert.ok(erzeugt.has(key),
      'iconKey ' + key + ' wird im Code vergeben, aber von createItemGraphics nie erzeugt');
  });
});

test('#117: itWeapon bleibt als Rueckfall-Textur erhalten', () => {
  // FALLBACK_ITEM_ICONS.weapon zeigt weiter auf itWeapon (js/inventory.js) und
  // js/loot.js vergibt es an Alt-Drops. Verschwindet die Zeichenroutine, waere
  // der Rueckfall selbst kaputt.
  assert.ok(erzeugteSymbole().includes('itWeapon'));
});

test('#117: unbekannter iconKey faellt auf das Typ-Symbol zurueck statt abzustuerzen', () => {
  const vorhanden = new Set(erzeugteSymbole());
  const aufloesen = ladeIconAufloesung(vorhanden);
  assert.strictEqual(aufloesen({ type: 'weapon', iconKey: 'itGibtEsNicht' }), 'itWeapon');
  assert.strictEqual(aufloesen({ type: 'head', iconKey: 'itGibtEsNicht' }), 'itHead');
  // Bekannter Schluessel wird unveraendert durchgereicht.
  assert.strictEqual(aufloesen({ type: 'weapon', iconKey: 'itHammer' }), 'itHammer');
  // Gar kein Schluessel und ein voellig fremder Typ duerfen ebenfalls nicht werfen.
  assert.strictEqual(aufloesen({ type: 'weapon' }), 'itWeapon');
  assert.strictEqual(aufloesen({ type: 'quatsch', iconKey: 'itGibtEsNicht' }), 'itMat');
  assert.strictEqual(aufloesen(null), null);
});

// --- Groesse (Nachtrag zu #117) -------------------------------------------
//
// Die sechs Symbole waren zwar unterscheidbar, aber zu SCHMAL: fuenf von acht
// blieben unter 25 von 48 Pixeln Breite und liessen seitlich mehr als die
// halbe Kachel leer. Nachgezogen wird das ueber je einen Streckfaktor pro
// Symbol in js/graphics.js (gestrecktesZeichnen).
//
// Hier festgehalten wird, was dabei still verloren gehen kann:
//   1. die Breite rutscht wieder zurueck (jemand dreht einen Faktor heraus),
//   2. die RANGFOLGE Dolch < Kurzschwert < Axt < Hammer < Richtschwert wird
//      eingeebnet — sie ist gewollt und traegt die Erkennbarkeit im Slot: der
//      Dolch ist mit Absicht der kleinste, das Richtschwert fuellt die Kachel.
//      Ein "aufgeraeumter" gemeinsamer Faktor waere genau der Fehler,
//   3. ein Symbol waechst ueber den Rand hinaus und klebt an der Kachelkante.
//
// Gemessen wird der Umriss-Rahmen, indem die Zeichenbefehle wirklich
// ausgefuehrt und gerastert werden (tests/iconRaster.js) — nicht, indem
// Zahlen im Quelltext gelesen werden.

const { alleRahmen } = require('./iconRaster');

// Die sechs Waffensymbole aus #117. itWeapon (Sammel-Icon) und itBow sind
// bewusst NICHT dabei: sie wurden nicht angefasst; itBow fuellt die Kachel
// senkrecht ohnehin von 0 bis 47.
const SECHS = {
  itDagger: 'Dolch',
  itSword: 'Kurzschwert',
  itAxe: 'Axt',
  itHammer: 'Hammer',
  itGreatsword: 'Richtschwert',
  itFlail: 'Morgenstern'
};

// Rangfolge nach Flaeche des Umriss-Rahmens. Der Morgenstern steht bewusst
// ausserhalb: er ist schraeg gezeichnet und fuellt die Kachel von jeher.
const RANGFOLGE = ['itDagger', 'itSword', 'itAxe', 'itHammer', 'itGreatsword'];

const MIN_BREITE = 24;   // halbe Kachel — darunter war der Befund "zu schmal"
const RAND_MIN = 1;      // Zeile/Spalte 0 bleibt frei
const RAND_MAX = 46;     // Zeile/Spalte 47 bleibt frei
const MIN_ABSTAND = 100; // px^2 Flaechenabstand zwischen zwei Raengen

test('#117: kein Waffensymbol bleibt schmaler als die halbe Kachel', () => {
  const r = alleRahmen();
  Object.keys(SECHS).forEach((k) => {
    assert.ok(r[k], k + ' wird gar nicht gezeichnet');
    assert.ok(r[k].breite >= MIN_BREITE,
      SECHS[k] + ' (' + k + ') ist nur ' + r[k].breite + '/48 breit — erwartet mindestens '
      + MIN_BREITE + '/48, sonst steht das Symbol wieder als Streifen in der Kachel');
  });
});

test('#117: die Groessen-Rangfolge Dolch < Kurzschwert < Axt < Hammer < Richtschwert haelt', () => {
  const r = alleRahmen();
  const flaeche = (k) => r[k].breite * r[k].hoehe;
  for (let i = 1; i < RANGFOLGE.length; i++) {
    const klein = RANGFOLGE[i - 1], gross = RANGFOLGE[i];
    assert.ok(flaeche(gross) - flaeche(klein) >= MIN_ABSTAND,
      SECHS[gross] + ' (' + r[gross].breite + 'x' + r[gross].hoehe + ') muss deutlich groesser sein als '
      + SECHS[klein] + ' (' + r[klein].breite + 'x' + r[klein].hoehe + ') — Abstand '
      + (flaeche(gross) - flaeche(klein)) + ' px^2, verlangt sind ' + MIN_ABSTAND
      + '. Der Groessenunterschied ist gewollt, nicht Schlamperei.');
  }
});

test('#117: kein Waffensymbol klebt an der Kachelkante', () => {
  const r = alleRahmen();
  Object.keys(SECHS).forEach((k) => {
    const b = r[k];
    assert.ok(b.breite <= RAND_MAX && b.hoehe <= RAND_MAX,
      SECHS[k] + ' misst ' + b.breite + 'x' + b.hoehe + '/48 — hoechstens '
      + RAND_MAX + '/48 erlaubt');
    assert.ok(b.x0 >= RAND_MIN && b.x1 <= RAND_MAX && b.y0 >= RAND_MIN && b.y1 <= RAND_MAX,
      SECHS[k] + ' reicht bis x ' + b.x0 + '..' + b.x1 + ', y ' + b.y0 + '..' + b.y1
      + ' — es muss rundum mindestens ein Pixel Rand bleiben');
  });
});
