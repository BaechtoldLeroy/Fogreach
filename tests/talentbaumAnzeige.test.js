// tests/talentbaumAnzeige.test.js — der Talentbaum erklaert seine Stufen (#175).
//
// Seit #175 geht der Baum ueber das ganze Spiel auf (Lv 1/5/9/14/20/26), und
// die Straenge oeffnen gestaffelt (erster frei, zweiter ab Lv 6, dritter ab
// Lv 12). Das muss der Bildschirm sagen, sonst steht man vor grauen Karten:
//   - die Erklaerzeile unten nennt die naechste Freischaltung,
//   - der Kopf jedes Strangs nennt seinen Zustand,
//   - gesperrte Karten nennen das Level,
//   - ein Klick auf einen gesperrten Knoten nennt den GRUND.
// Geprueft am echten Bildschirm (SkillTreeScene ueber dem Hub).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { hintergrund } = require('./kontrastMessung.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.step(30);
});
after(async () => { if (H) await H.shutdown(); });

/** Oeffnet den Talentbaum mit Level und Raengen und liefert alle Texte. */
function oeffnen(level, ranks, punkte) {
  H.run(`(function () {
    window.playerLevel = ${level};
    window.SkillTree.loadSaveData({ skillPoints: ${punkte || 0}, ranks: ${JSON.stringify(ranks || {})} });
    var gm = window.game.scene;
    if (gm.isActive('SkillTreeScene')) gm.getScene('SkillTreeScene').scene.stop();
  })()`);
  H.step(3);
  H.run(`window.openSkillTreeScene(window.game.scene.getScene('HubSceneV2'))`);
  H.step(5);
  return texte();
}

function texte() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene');
    return sc.children.list.filter(function (o) { return o.type === 'Text' && o.visible; })
      .map(function (o) { return o.text; });
  })()`);
}

test('frisch auf Level 1: jeder Strang ist frei waehlbar, die Regel steht unten', () => {
  const t = oeffnen(1, {}, 1);
  assert.strictEqual(t.filter((x) => x === 'frei wählbar').length, 3, 'nicht alle drei Straenge frei: ' + t.join(' | '));
  assert.ok(t.some((x) => /Der zweite öffnet ab Lv 6, der dritte ab Lv 12/.test(x)), 'die Strang-Regel steht nirgends');
  assert.ok(t.some((x) => x === 'ab Lv 9'), 'gesperrte Karten nennen ihr Level nicht');
});

test('ein offener Strang auf Level 3: die anderen nennen Lv 6, unten die naechste Stufe', () => {
  const t = oeffnen(3, { charge: 1 }, 1);
  assert.ok(t.includes('geöffnet'), 'der offene Strang sagt es nicht');
  assert.strictEqual(t.filter((x) => x === '2. Strang ab Lv 6').length, 2, 'Lv 6 fuer den zweiten Strang fehlt: ' + t.join(' | '));
  assert.ok(t.some((x) => /Nächste Freischaltung: Lv 5/.test(x)), 'die naechste Freischaltung fehlt');
});

test('ein Klick auf einen gesperrten Einstieg nennt den Grund', () => {
  oeffnen(3, { charge: 1 }, 1);
  H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene');
    sc._tryInvest(window.SkillTree.getNode('hammer'));
  })()`);
  H.step(1);
  assert.ok(texte().some((x) => x === '2. Strang erst ab Level 6'), 'der Grund fehlt: ' + texte().join(' | '));
});

test('ab Level 6 ist der zweite Strang waehlbar, nicht "offen"', () => {
  const t = oeffnen(7, { charge: 2 }, 1);
  assert.strictEqual(t.filter((x) => x === '2. Strang wählbar').length, 2, t.join(' | '));
});

// b399: Die Karten tragen keinen farbigen Rand mehr (Strangfarbe bei
// investiert, gold bei lernbar, gruen bei voll, grau sonst). Der Zustand
// muss trotzdem ablesbar bleiben: Helligkeit der Platte, Schloss, Rauten.
const RAENGE = { hammer: 5, frenzy: 2, steelGrasp: 2 };

test('Talentkarten ohne farbigen Rand', () => {
  oeffnen(12, RAENGE, 2);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene'), geo = sc._nodeGeo;
    var karten = Object.keys(geo).map(function (id) { return geo[id]; });
    // Jedes Rechteck, das genau auf einer Karte liegt.
    var aufKarte = sc.children.list.filter(function (o) {
      if (o.type !== 'Rectangle') return false;
      return karten.some(function (k) { return Math.abs(o.x - k.x) < 2 && Math.abs(o.y - k.y) < 2
        && Math.abs(o.width - k.w) < 3 && Math.abs(o.height - k.h) < 3; });
    });
    return { karten: karten.length, rechtecke: aufKarte.length,
      mitRand: aufKarte.filter(function (o) { return o.isStroked && o.strokeAlpha > 0 && o.lineWidth > 0; })
        .map(function (o) { return o._talentId + ':' + o.strokeColor.toString(16); }) };
  })()`);
  assert.ok(r.karten >= 21, 'zu wenige Karten: ' + r.karten);
  assert.strictEqual(r.rechtecke, r.karten, 'nicht jede Karte gefunden');
  assert.strictEqual(r.mitRand.join(', '), '', 'Karten mit farbigem Rand');
});

test('Zustaende bleiben ohne Rand unterscheidbar (Helligkeit, Schloss, Rauten)', () => {
  // Mittlere Leuchtdichte der ganzen Karte (Messing-Beschlag inklusive),
  // Texte ausgeblendet. Gemessen im Canvas-Renderer: dort wirkt keine
  // Toenung, nur die Deckkraft.
  const mittel = (ids) => {
    const geo = H.run(`window.game.scene.getScene('SkillTreeScene')._nodeGeo`);
    const bereich = hintergrund(H);
    const m = {};
    ids.forEach((id) => {
      const g = geo[id];
      const L = bereich(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
      m[id] = L.reduce((s, x) => s + x, 0) / L.length;
    });
    return m;
  };
  // Ohne Punkte: Wirbelwind gesperrt (Lv 20), Berserker ohne Punkte,
  // Raserei investiert, Hammer voll.
  oeffnen(12, RAENGE, 0);
  const a = mittel(['whirlwind', 'berserk', 'frenzy', 'hammer']);
  const info = H.run(`(function () {
    var sc = window.game.scene.getScene('SkillTreeScene'), geo = sc._nodeGeo;
    function in_(o, id) { var g = geo[id]; return Math.abs(o.x - g.x) < g.w / 2 && Math.abs(o.y - g.y) < g.h / 2; }
    var t = sc.children.list.filter(function (o) { return o.type === 'Text'; });
    function name(id) { return t.filter(function (o) { return in_(o, id) && o.text === window.SkillTree.getNode(id).name; })[0]; }
    function rauten(id) { var p = t.filter(function (o) { return in_(o, id) && /[◆◇]/.test(o.text); })[0]; return p ? p.text : null; }
    return {
      schloss: sc.children.list.filter(function (o) { return o.type === 'Image' && o.texture.key === 'talent_schloss' && in_(o, 'whirlwind'); }).length,
      farben: { hammer: name('hammer').style.color, frenzy: name('frenzy').style.color, berserk: name('berserk').style.color },
      rauten: { hammer: rauten('hammer'), frenzy: rauten('frenzy') }
    };
  })()`);
  // Mit Punkten: Berserker wird lernbar.
  oeffnen(12, RAENGE, 2);
  const b = mittel(['berserk']);
  assert.ok(a.whirlwind < a.berserk, 'gesperrt nicht dunkler als ohne Punkte: ' + JSON.stringify(a));
  assert.ok(a.berserk < b.berserk, 'lernbar nicht heller als ohne Punkte: ' + a.berserk + ' / ' + b.berserk);
  assert.ok(a.berserk < a.frenzy, 'investiert nicht heller als ohne Punkte: ' + JSON.stringify(a));
  assert.strictEqual(info.schloss, 1, 'gesperrte Karte ohne Schloss');
  assert.notStrictEqual(info.farben.hammer, info.farben.frenzy, 'voll und investiert gleich gefaerbt');
  assert.notStrictEqual(info.farben.frenzy, info.farben.berserk, 'investiert und offen gleich gefaerbt');
  assert.strictEqual(info.rauten.hammer, '◆ ◆ ◆ ◆ ◆');
  assert.strictEqual(info.rauten.frenzy, '◆ ◆ ◇ ◇ ◇');
});
