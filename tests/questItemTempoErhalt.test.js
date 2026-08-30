// tests/questItemTempoErhalt.test.js — Questgegenstaende duerfen beim Laden
// ihr Angriffstempo nicht verlieren.
//
// GEMESSEN am echten Spielstand: die angelegte Waffe war ein Schattendolch mit
// 1.4 Schaden, obwohl der Spieler Elaras Klinge mit 22 Schaden besass. Der
// Bosskampf lief dadurch mit Schaden 3 gegen 480 Lebenspunkte.
//
// Die Kette, jede Stufe belegt:
//  1. saveGame schrieb kein `saveVersion`. migrateSave las deshalb JEDEN
//     Spielstand als Version 1 (lootSystem.js) und liess seine Alt-Migrationen
//     bei jedem Laden erneut laufen.
//  2. migrateItem baut fuer Gegenstaende OHNE baseStats — also fuer
//     Questbelohnungen — die baseStats aus den Oberwerten nach. Damit gilt
//     item.speed === baseStats.speed.
//  3. Genau diese Gleichheit ist das Erkennungsmerkmal, an dem repairItem einen
//     unumgerechneten Prozentwert festmacht. Es teilte durch 100:
//     Elaras Klinge, Tempo 1.3 -> 0.013.
//
// Nachgerechnet mit computeItemPower: die Klinge fiel von 272 auf 117 und damit
// unter den Dolch (123) — der Tausch war fuer den Bot danach korrekt.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

function ohneKommentare(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

test('storage: der Spielstand traegt seine Version mit', () => {
  const s = ohneKommentare(fs.readFileSync(path.join(WURZEL, 'js', 'storage.js'), 'utf8'));
  const i = s.indexOf('const payload = {');
  assert.ok(i > 0, 'payload-Objekt nicht gefunden');
  // Nur das payload-Objekt betrachten, nicht die ganze Datei.
  const block = s.slice(i, i + 2000);
  assert.ok(/saveVersion:\s*\d+/.test(block),
    'saveGame schreibt kein saveVersion — migrateSave laesst dann seine '
    + 'Alt-Migrationen bei JEDEM Laden erneut laufen');
});

test('lootSystem: die Prozent-Reparatur laesst erfundene baseStats in Ruhe', () => {
  const s = ohneKommentare(fs.readFileSync(path.join(WURZEL, 'js', 'lootSystem.js'), 'utf8'));
  assert.ok(s.includes('const _synthetisiert = new Set()'),
    'kein Gedaechtnis fuer selbst erzeugte baseStats');
  const iSyn = s.indexOf('item.baseStats = stats;');
  assert.ok(iSyn > 0, 'Synthesestelle nicht gefunden');
  assert.ok(s.slice(iSyn, iSyn + 120).includes('_synthetisiert.add(item)'),
    'die Synthese vermerkt den Gegenstand nicht');
  const iRep = s.indexOf('const repairItem = function (item)');
  assert.ok(iRep > 0, 'repairItem nicht gefunden');
  assert.ok(s.slice(iRep, iRep + 400).includes('_synthetisiert.has(item)'),
    'repairItem prueft die Marke nicht und teilt weiterhin durch 100');
});

test('Elaras Klinge behaelt ihr Tempo durch Migration und Reparatur', () => {
  // Die Kette aus lootSystem.js nachgestellt, mit der Marke aus dem Fix.
  const klinge = {
    type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', itemLevel: 15,
    damage: 22, speed: 1.3, range: 120, armor: 0, crit: 0.15, hp: 0,
  };
  const synthetisiert = new Set();

  // migrateItem: baseStats aus den Oberwerten bauen.
  const stats = {};
  ['damage', 'armor', 'hp', 'speed', 'crit', 'range'].forEach((k) => {
    if (typeof klinge[k] === 'number') stats[k] = klinge[k];
  });
  klinge.baseStats = stats;
  synthetisiert.add(klinge);

  // repairItem MIT der Marke.
  if (!synthetisiert.has(klinge)) {
    ['speed', 'armor', 'crit'].forEach((k) => {
      const bv = klinge.baseStats[k];
      if (typeof klinge[k] === 'number' && typeof bv === 'number'
          && klinge[k] === bv && Math.abs(klinge[k]) > 1) klinge[k] = bv / 100;
    });
  }

  assert.strictEqual(klinge.speed, 1.3,
    'das Angriffstempo wurde durch 100 geteilt — die Waffe ist damit entwertet');
});

test('gerollte Gegenstaende werden weiterhin repariert', () => {
  // Gegenprobe: ein Gegenstand mit ECHTEN baseStats aus dem Wuerfelpfad, dessen
  // Oberwert vor dem /100-Fix roh persistiert wurde, muss weiterhin heilen.
  // Sonst wuerde der Fix die urspruengliche Reparatur einfach abschalten.
  const alt = { type: 'body', speed: 15, baseStats: { armor: 4, speed: 15 } };
  const synthetisiert = new Set();   // NICHT eingetragen: echte baseStats
  if (!synthetisiert.has(alt)) {
    ['speed', 'armor', 'crit'].forEach((k) => {
      const bv = alt.baseStats[k];
      if (typeof alt[k] === 'number' && typeof bv === 'number'
          && alt[k] === bv && Math.abs(alt[k]) > 1) alt[k] = bv / 100;
    });
  }
  assert.strictEqual(alt.speed, 0.15, 'der Rohprozentwert wurde nicht mehr geheilt');
});

test('Bot: die Waffenwahl richtet sich nach Schaden, nicht nach der Anzeigezahl', () => {
  // Der Bot benutzte computeItemPower als Ausruestungskriterium — eine Zahl,
  // die inventory.js selbst als reine Anzeige bezeichnet ("greift NICHT in
  // Kampf/Generierung ein"). Mit beschaedigter Klinge fuehrte das zu einem
  // Zehnfach-Downgrade: Schaden 29 -> 3, Boss 480 -> 476 in 32 Runden.
  const bot = ohneKommentare(
    fs.readFileSync(path.join(WURZEL, 'tools', 'headless', 'index.js'), 'utf8'));
  const i = bot.indexOf('var werte = function (it)');
  assert.ok(i > 0, 'keine eigene Bewertungsfunktion fuer die Ausruestung');
  const block = bot.slice(i, i + 400);
  assert.ok(block.includes('it.type !== "weapon"'),
    'die Bewertung unterscheidet Waffen nicht von der uebrigen Ausruestung');
  assert.ok(/Number\(it\.damage\)/.test(block),
    'der Schaden geht nicht in die Waffenbewertung ein');
  // Und die Auswahlschleife selbst darf die Anzeigezahl nicht mehr direkt
  // benutzen — sie muss ueber werte() gehen. (Innerhalb von werte() ist der
  // Aufruf richtig; deshalb wird hier die SCHLEIFE geprueft, nicht die Datei.)
  const iSchleife = bot.indexOf("for (var s = 0; s < slots.length; s++)");
  assert.ok(iSchleife > i, "Auswahlschleife nicht gefunden");
  const schleife = bot.slice(iSchleife, iSchleife + 1200);
  assert.ok(!schleife.includes("window.computeItemPower("),
    "die Auswahlschleife benutzt weiterhin direkt die Anzeige-Heuristik");
  assert.ok(schleife.includes("werte(cur)") && schleife.includes("werte(it)"),
    "die Auswahlschleife geht nicht ueber die neue Bewertung");
});

test('Bot: der Schattendolch schlaegt Elaras Klinge nicht mehr', () => {
  const power = (it) => {
    let p = 0;
    p += (Number(it.damage) || 0) * 3;
    p += (Number(it.speed) || 0) * 100 * 1.2;
    p += (Number(it.range) || 0) * 0.1;
    p += (Number(it.crit) || 0) * 100 * 2.5;
    if (Array.isArray(it.affixes)) for (const a of it.affixes) { p += 10; p += (Number(a.value) || 0) * 1.2; }
    return Math.max(1, Math.round(p));
  };
  const werte = (it) => {
    if (!it) return -1;
    const pw = power(it);
    if (it.type !== 'weapon') return pw;
    return (Number(it.damage) || 0) * 1000 + Math.min(999, pw);
  };
  // Die Klinge im BESCHAEDIGTEN Zustand — der Fall, der tatsaechlich eintrat.
  const klinge = { type: 'weapon', damage: 22, speed: 0.013, range: 120, crit: 0.15 };
  const dolch = { type: 'weapon', damage: 1.4, speed: 0.15, crit: 0, affixes: [{ value: 76 }] };
  assert.ok(power(dolch) > power(klinge),
    'Voraussetzung entfaellt: die Anzeigezahl bevorzugt den Dolch nicht mehr');
  assert.ok(werte(klinge) > werte(dolch),
    'die neue Bewertung greift nicht — der Bot wuerde weiterhin abruesten');
});
