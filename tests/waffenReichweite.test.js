// #121: Jede Nahkampfwaffe traegt einen eigenen Reichweiten-Wert.
//
// `range` ist kein toter Stat: recalcDerived rechnet
//   attackRange = max(20, baseStats.range + sum.range)   (js/inventory.js)
// auf den Spieler-Grundwert 100 (js/main.js), und attackRange steuert
// forEachEnemyInRange in attack() (js/player.js) — also die Schwungweite.
//
// Geprueft wird die INVARIANTE, nicht die einzelne Zahl: Tempo und Reichweite
// muessen gegeneinander laufen. Ein Test auf feste Werte waere bei jedem
// Balancing-Schritt rot geworden, ohne je einen echten Fehler zu finden.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function frisch() {
  resetStore();
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

const NAHKAMPF = ['WPN_EISENKLINGE', 'WPN_SCHATTENDOLCH', 'WPN_KETTENMORGENSTERN',
  'WPN_GLUTAXT', 'WPN_RICHTSCHWERT', 'WPN_KRIEGSHAMMER'];

function waffen(sys) {
  const nach = {};
  sys.ITEM_BASES.forEach((b) => { nach[b.key] = b; });
  return nach;
}

test('#121: alle sechs Nahkampfwaffen tragen range UND speed', () => {
  const alle = waffen(frisch());
  NAHKAMPF.forEach((k) => {
    const b = alle[k];
    assert.ok(b, k + ' fehlt in ITEM_BASES');
    assert.ok(!b.subtype, k + ' ist kein Nahkampf mehr');
    assert.strictEqual(typeof b.baseStats.range, 'number', k + ' hat keinen range-Wert');
    assert.strictEqual(typeof b.baseStats.speed, 'number', k + ' hat keinen speed-Wert');
  });
});

test('#121: Tempo und Reichweite laufen gegeneinander — keine Waffe gewinnt beide Achsen', () => {
  const alle = waffen(frisch());
  const liste = NAHKAMPF.map((k) => ({
    k, speed: alle[k].baseStats.speed, range: alle[k].baseStats.range
  }));
  // Pareto-Dominanz auf (speed, range): keine Waffe darf in einer Achse besser
  // und in der anderen mindestens gleich gut sein wie eine andere.
  liste.forEach((a) => {
    liste.forEach((b) => {
      if (a.k === b.k) return;
      const dominiert = a.speed >= b.speed && a.range >= b.range
        && (a.speed > b.speed || a.range > b.range);
      assert.ok(!dominiert,
        a.k + ' (speed ' + a.speed + ', range ' + a.range + ') gewinnt beide Achsen gegen '
        + b.k + ' (speed ' + b.speed + ', range ' + b.range + ')');
    });
  });
  // Und die Achsen muessen wirklich gegenlaeufig sein, nicht nur nicht-dominant:
  const schnellste = liste.reduce((m, w) => (w.speed > m.speed ? w : m));
  const langsamste = liste.reduce((m, w) => (w.speed < m.speed ? w : m));
  assert.ok(schnellste.range < 0, 'die schnellste Waffe muss unter der Grundreichweite liegen');
  assert.ok(langsamste.range > 0, 'die langsamste Waffe muss ueber der Grundreichweite liegen');
});

test('#121: die Spanne bleibt moderat (Grundwert 100, kein Ausreisser)', () => {
  const alle = waffen(frisch());
  NAHKAMPF.forEach((k) => {
    const r = alle[k].baseStats.range;
    assert.ok(Math.abs(r) <= 25, k + ' reisst mit range ' + r + ' aus (erlaubt +/-25)');
  });
});

test('#121: Boegen bleiben unangetastet — dort ist range die Flugweite', () => {
  const alle = waffen(frisch());
  assert.strictEqual(alle.WPN_ESCHENBOGEN.baseStats.range, 80);
  assert.strictEqual(alle.WPN_HORNBOGEN.baseStats.range, 100);
  assert.strictEqual(alle.WPN_GLUTBOGEN.baseStats.range, 120);
  assert.strictEqual(alle.WPN_NEBELBOGEN.baseStats.range, 130);
});

test('#121: der Wert kommt am gerollten Item FLACH an (nicht als Prozent)', () => {
  // rollItem teilt speed/armor/crit durch 100, range aber NICHT — es ist eine
  // absolute px-Zugabe auf baseStats.range = 100. Ginge range faelschlich durch
  // die Prozent-Umrechnung, waere die ganze Aenderung praktisch wirkungslos.
  const sys = frisch();
  const dolch = sys.ITEM_BASES.find((b) => b.key === 'WPN_SCHATTENDOLCH');
  const hammer = sys.ITEM_BASES.find((b) => b.key === 'WPN_KRIEGSHAMMER');
  assert.strictEqual(dolch.baseStats.range, Math.round(dolch.baseStats.range),
    'range muss ganzzahlig sein');
  // Die Umrechnungstabelle in rollItem darf range nicht als Prozent fuehren.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'lootSystem.js'), 'utf8');
  const treffer = quelle.match(/const _percentStats = \{([^}]*)\}/);
  assert.ok(treffer, '_percentStats nicht gefunden — rollItem umgebaut?');
  assert.ok(!/range/.test(treffer[1]),
    'range steht in _percentStats und wuerde durch 100 geteilt');
  // Reichweite und Schwungweite muessen sich real unterscheiden.
  assert.notStrictEqual(dolch.baseStats.range, hammer.baseStats.range);
});

test('#121: eine negative Reichweite wird im Tooltip nicht verschluckt', () => {
  // pushStat verwarf Werte <= 0, solange allowNegative fehlte. Mit negativer
  // Reichweite an Dolch/Eisenklinge waere der Nachteil unsichtbar gewesen.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  const zeile = quelle.split(String.fromCharCode(10))
    .find((z) => z.indexOf("inventory.label.range'), it.range") >= 0);
  assert.ok(zeile, 'Tooltip-Zeile fuer Reichweite nicht gefunden');
  assert.ok(/,\s*true\s*\)/.test(zeile),
    'pushStat fuer Reichweite ohne allowNegative — negative Werte werden verschluckt: ' + zeile.trim());
});

test('#122: Basis und Affix tragen Reichweite in DERSELBEN Einheit', () => {
  // Sie trugen zwei Einheiten unter einem Namen: auf der Basis Pixel
  // (Nebelbogen +130), im Affix Punkte, die als PROZENTSATZ auf die
  // Gesamtreichweite wirkten. Der Tooltip schrieb beide gleich an, und ein
  // Affix mit '+23' bedeutete etwas voellig anderes als eine Basis mit '+23'.
  //
  // Jetzt beides Pixel. Der Bezug ist der Grundwert des Spielers (100) und
  // waechst NICHT mit der Tiefe — anders als bei den Lebenspunkten, wo die
  // Basis mit jeder Stufe steigt. Es gibt hier nichts, woran der Affix
  // mitwachsen koennte.
  const LS = frisch();
  const def = LS.AFFIX_DEFS.find((d) => d.statKey === 'range');
  assert.ok(def, 'kein Reichweitenaffix mehr vorhanden');

  const tiefen = [1, 5, 10, 20, 30];
  const werte = tiefen.map((t) => LS.affixWert(def, 0.10, t));
  werte.forEach((w, i2) => {
    assert.ok(w >= 8 && w <= 12,
      'Fundtiefe ' + tiefen[i2] + ': ' + w + ' px liegt nicht im 8-12-Band');
  });

  // Und die Zahl wird beim Tragen NICHT umgerechnet: 10 bleiben 10.
  [1, 20, 30].forEach((d) => {
    const wirk = LS.affixWirkung(def, werte[2], d);
    assert.strictEqual(wirk, werte[2],
      'auf Tiefe ' + d + ' wirken ' + wirk + ' statt der ' + werte[2] + ' vom Stueck');
  });
});

test('#122: der Reichweitenaffix wird ADDIERT, nicht multipliziert', () => {
  // Solange er ein Anteil war, stand in recalcDerived eine Multiplikation.
  // Mit Pixeln waere sie um Groessenordnungen daneben.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  const zeile = quelle.split(String.fromCharCode(10))
    .find((z) => z.indexOf("_gb('range')") >= 0);
  assert.ok(zeile, 'die Zeile fuer den Reichweitenaffix fehlt');
  assert.ok(zeile.indexOf('attackRange +') >= 0,
    'der Affix wird nicht addiert: ' + zeile.trim());
});
