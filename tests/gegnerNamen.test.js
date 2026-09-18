// tests/gegnerNamen.test.js — die Gegner tragen ihre Bedeutung im Namen (#162).
//
// Story-Bibel v5, Abschnitt 12: keine neuen Gegnertypen, aber ein Name, der
// sagt, gegen wen man kaempft. Sichtbar wird er am Namenszug der Elites —
// vorher stand dort "Brute", "Archer" oder bei Tieren nur "Gegner".

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 10 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

function namenszug(type) {
  L.clearEnemies();
  const ref = L.spawnEnemy(type);
  return H.run(`(function () {
    var e = window.__lab.refs[${ref}];
    window.EliteEnemies.applyEliteToEnemy(e, 'champion', function () { return 0; });
    return e.eliteNameTag || '';
  })()`);
}

test('Elites tragen den Namen aus der Geschichte', () => {
  const erwartet = { 1: 'Nebelwicht', 2: 'Kellerwächter', 3: 'Nebelbestie', 4: 'Kultist',
    5: 'Vergessener', 6: 'Kettenwache', 7: 'Flammenweber', 8: 'Ratte', 9: 'Fledermaus', 10: 'Wolf' };
  for (const [typ, name] of Object.entries(erwartet)) {
    const tag = namenszug(Number(typ));
    assert.ok(tag.endsWith(name), 'Typ ' + typ + ': "' + tag + '" statt ' + name);
  }
});

test('Auf Englisch die englischen Namen', () => {
  H.run(`window.i18n.setLanguage('en')`);
  try {
    assert.ok(namenszug(5).endsWith('Forgotten One'));
  } finally {
    H.run(`window.i18n.setLanguage('de')`);
  }
});
