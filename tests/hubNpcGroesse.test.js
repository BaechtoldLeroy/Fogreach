// tests/hubNpcGroesse.test.js — die Hub-Figuren stehen auf einer Leiter.
//
// Vorher trug jeder NPC einen festen Skalierungsfaktor, geeicht auf das Mass
// genau eines Bildes: 0.36, 0.30, 0.18, 0.16 ... Gemessen stand damit im Hub
// Thom mit 122 Pixeln da, Mara mit 122, Elara mit 111, der Klerus mit 97 —
// und der Spieler daneben mit 54. Es gab keine Leiter, nur neun
// Einzelentscheidungen, und beim Bilderwechsel waeren alle neun falsch
// gewesen.
//
// Jetzt traegt jeder NPC eine HOEHE, und der Hub rechnet die Skalierung aus
// der FIGUR im Bild. Geprueft wird am laufenden Hub, nicht an der Tabelle:
// eine Zahl, die niemand liest, aendert nichts am Bild.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

/** Die Hoehen aus hubLayout.js — EINE Quelle, kein Abschreiben. */
function sollHoehen() {
  const s = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'scenes', 'hub', 'hubLayout.js'), 'utf8');
  const out = {};
  const re = /texture:\s*'([^']+)'[\s\S]{0,400}?hoehe:\s*(\d+)/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = Number(m[2]);
  return out;
}

async function imHub() {
  const h = await launch({ search: '', renderer: 'canvas', waitFor: 'StartScene' });
  h.run("window.game.scene.start('HubSceneV2')");
  const ok = await h.waitForScene('HubSceneV2', { maxRounds: 250 });
  if (!ok) { await h.shutdown(); throw new Error('HubSceneV2 wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 20 });
  return h;
}

test('jeder Hub-NPC erscheint in seiner vorgesehenen Hoehe', async () => {
  const soll = sollHoehen();
  assert.ok(Object.keys(soll).length >= 9,
    'nur ' + Object.keys(soll).length + ' NPC mit Hoehe in hubLayout — zu wenig');

  const H = await imHub();
  try {
    const ist = H.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var out = {};
      (sc.children.list || []).forEach(function (c) {
        if (!c.texture || !c.texture.key || !c.getData) return;
        if (!c.getData('id')) return;              // nur die NPC-Sprites
        out[c.texture.key] = c.displayHeight;
      });
      return out;
    })()`);

    const daneben = [];
    Object.keys(soll).forEach((tex) => {
      if (!(tex in ist)) return;                   // der NPC steht gerade nicht da
      if (Math.abs(ist[tex] - soll[tex]) > 1.5) {
        daneben.push(tex + ' ' + ist[tex].toFixed(1) + ' statt ' + soll[tex]);
      }
    });
    const gesehen = Object.keys(soll).filter((t) => t in ist);
    assert.ok(gesehen.length >= 6,
      'nur ' + gesehen.length + ' NPC standen im Hub — der Fall misst zu wenig');
    assert.strictEqual(daneben.length, 0, daneben.join('; '));
  } finally { await H.shutdown(); }
});

test('kein NPC ueberragt den Spieler um mehr als eine Handbreit', async () => {
  // Der eigentliche Punkt. Einzelne Hoehen zu pruefen genuegt nicht: setzte
  // jemand alle neun auf 120, waere jede fuer sich "richtig".
  const H = await imHub();
  try {
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var p = sc.player;
      var npc = [];
      (sc.children.list || []).forEach(function (c) {
        if (c.getData && c.getData('id') && c.texture) {
          npc.push({ k: c.texture.key, h: c.displayHeight });
        }
      });
      return { spieler: p ? p.displayHeight : null, npc: npc };
    })()`);
    assert.ok(r.spieler > 0, 'kein Spieler im Hub');
    const zuGross = Array.prototype.filter.call(r.npc, (n) => n.h > r.spieler + 8);
    assert.strictEqual(zuGross.length, 0,
      'der Spieler ist ' + r.spieler.toFixed(0) + ' hoch, diese ueberragen ihn deutlich: '
      + Array.prototype.map.call(zuGross, (n) => n.k + ' ' + n.h.toFixed(0)).join(', '));
  } finally { await H.shutdown(); }
});
