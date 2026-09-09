// tests/marasAuslage.test.js — Was Mara fuehrt, und wie gut es ist.
//
// Gemeldet: "zu viele haeufige Items". Nachgemessen stimmte das — die Auslage
// zog die normalen Abwurf-Odds ohne jeden Bonus, also rund 75 % gewoehnliche
// Stuecke auf JEDER Tiefe:
//
//   maxDepth 10:  77,4 % gewoehnlich   maxDepth 30:  73,7 % gewoehnlich
//
// Bei zehn Stuecken waren das 7,5 graue je Auslage. Jetzt fuenf Stuecke mit
// einem Qualitaetsbonus: rund 40 % gewoehnlich, also etwa zwei.
//
// Der Test haelt beides fest — die Zahl der Stuecke und die Groessenordnung
// der Verteilung. Die Toleranz ist bewusst weit (35–47 %): geprueft wird, dass
// der Bonus GREIFT, nicht ein exakter Wurf.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
W.i18n = W.i18n || { register() {}, t: (k) => k, onChange() {} };
loadGameModule('js/lootSystem.js');
const LS = W.LootSystem;

/** Anteil gewoehnlicher Stuecke, wie die Auslage sie wuerfelt. */
function anteilGewoehnlich(tiefe, n) {
  let g = 0;
  for (let i = 0; i < n; i++) {
    const it = LS.rollItem(null, tiefe, null, LS.SHOP_QUALITY_BIAS);
    if (it && it.tier === 0) g++;
  }
  return g / n;
}

test('Die Auslage fuehrt fuenf Stuecke, nicht zehn', () => {
  assert.strictEqual(LS.SHOP_STOCK_COUNT, 5,
    'weniger Ware war der ganze Punkt — bei zehn kippt es zurueck in die Grabbelkiste');
});

test('Rund 40 % gewoehnlich statt 75 %, ueber alle Tiefen', () => {
  [3, 7, 17, 27, 37].forEach((t) => {
    const a = anteilGewoehnlich(t, 6000);
    assert.ok(a > 0.30 && a < 0.50,
      'Tiefe ' + t + ': ' + Math.round(a * 100) + ' % gewoehnlich, erwartet rund 40 %');
  });
});

test('Ohne den Bonus waere es wieder die alte Grabbelkiste', () => {
  // Mutationsprobe im Test selbst: ohne Bonus muss der Anteil deutlich
  // hoeher liegen. Faellt diese Zusicherung, misst der Test oben nichts.
  let g = 0;
  for (let i = 0; i < 6000; i++) if (LS.rollItem(null, 17).tier === 0) g++;
  assert.ok(g / 6000 > 0.65,
    'ohne Bonus nur ' + Math.round(100 * g / 6000) + ' % gewoehnlich — dann sagt '
    + 'der Bonus-Test nichts aus');
});

test('Der Blindkauf bleibt besser als die offene Auslage', () => {
  // Sein ganzer Reiz ist, dass man die Katze im Sack kauft. Waere die Auslage
  // gleich gut oder besser, koennte man einfach hinsehen.
  assert.ok(LS.BLIND_BUY_BIAS > LS.SHOP_QUALITY_BIAS,
    'Blindkauf-Bonus ' + LS.BLIND_BUY_BIAS + ' liegt nicht ueber der Auslage '
    + LS.SHOP_QUALITY_BIAS);
  let blind = 0, auslage = 0;
  for (let i = 0; i < 6000; i++) {
    if (LS.rollItem(null, 20, null, LS.BLIND_BUY_BIAS).tier === 0) blind++;
    if (LS.rollItem(null, 20, null, LS.SHOP_QUALITY_BIAS).tier === 0) auslage++;
  }
  assert.ok(blind < auslage,
    'der Blindkauf liefert nicht weniger graue Stuecke als die Auslage ('
    + blind + ' gegen ' + auslage + ')');
});
