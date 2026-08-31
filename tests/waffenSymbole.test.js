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

test('#117: die Boegen bleiben bewusst auf itBow', () => {
  const basen = waffenBasen();
  ['WPN_ESCHENBOGEN', 'WPN_HORNBOGEN', 'WPN_GLUTBOGEN', 'WPN_NEBELBOGEN'].forEach((k) => {
    assert.strictEqual(basen[k].iconKey, 'itBow', k + ' wurde ungewollt mitgeaendert');
  });
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
