// tests/ruestungDeckel.test.js — Deckel 80 % und halbierte Ruestungsknoten (#152).
//
// Gemeldet: "Ruestung ist zu einfach auf 85 % zu bringen." Spielstand Tiefe 34:
// 44 % aus den Stuecken, 18 % aus Affixen, mindestens 25 aus dem Wissensbaum.
// Gemessen: der Baum allein gab ohne jede Ausruestung 60-70 %.
//
// Entschieden: Deckel 85 -> 80 %, die vier Ruestungsknoten halbiert, Affixe
// bleiben. Gemessen wird am laufenden Spiel — recalcDerived und
// applyPlayerDamage, keine nachgerechnete Formel.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

test('Mehr Ruestung als der Deckel wird bei 80 % geklemmt', () => {
  // Jede Schicht einzeln ueber den Deckel schieben: die Klemmung sitzt an
  // sieben Stellen, und EINE vergessene 0,85 liesse genau diese Schicht durch.
  const r = H.run(`(function () {
    var aus = {};
    ['eventBuffs', 'brunnenBuffs', 'tiefenBuffs', 'knowledgeTreeBuffs'].forEach(function (k) {
      var gemerkt = window[k];
      window[k] = Object.assign({}, gemerkt || {}, { armorAdd: 2, armorMult: 1 });
      try { recalcDerived(0, 0); aus[k] = playerArmor; }
      finally { window[k] = gemerkt; }
    });
    recalcDerived(0, 0);
    return aus;
  })()`);
  Object.keys(r).forEach((k) => {
    assert.ok(Math.abs(r[k] - 0.80) < 1e-9, k + ': Ruestung ' + r[k] + ' statt 0,80');
  });
});

test('Der Schaden kommt mit mindestens 20 % durch', () => {
  // Die zweite Klemmung sitzt im Schaden selbst (enemy.js). Stand dort 0,9,
  // haette ein anderer Weg zu playerArmor den Deckel umgehen koennen.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var echtZufall = Math.random;
    var vorher = { lp: playerHealth, ruestung: playerArmor, unverwundbar: window._playerInvincible,
                   ausweichen: window.PLAYER_DODGE_CHANCE, block: window.playerBlockChance };
    Math.random = function () { return 0.99; };
    window._playerInvincible = false;
    window.PLAYER_DODGE_CHANCE = 0;
    window.playerBlockChance = 0;
    // Gemessen wird der RUECKGABEWERT, nicht die Differenz der Lebenspunkte:
    // das Spiel klemmt playerHealth auf die Max-LP (im Testkopf 30). Ein
    // erster Entwurf las darum immer "20", auch mit der alten Klemmung bei 0,9
    // — und blieb bei der Mutation gruen.
    playerHealth = typeof playerMaxHealth === 'number' ? playerMaxHealth : playerHealth;
    playerArmor = 0.95;
    try { return applyPlayerDamage(100, sc, null); }
    finally {
      Math.random = echtZufall;
      playerHealth = vorher.lp; playerArmor = vorher.ruestung;
      window._playerInvincible = vorher.unverwundbar;
      window.PLAYER_DODGE_CHANCE = vorher.ausweichen; window.playerBlockChance = vorher.block;
    }
  })()`);
  assert.strictEqual(r, 20, '100 Rohschaden bei 95 % Ruestung ergaben ' + r + ' statt 20');
});

test('Der volle Rustungsteil des Wissensbaums gibt hoechstens +35', () => {
  // Rang 5, Turmwache, Eisenhaut und Zaeher Lauf zusammen. Vorher +70.
  // Eisenhaut und Zaeher Lauf sind BEIDE Notables im Zaehigkeits-Zweig; der
  // Weg zu ihnen fuehrt ueber die uebrigen Zaehigkeits-Knoten.
  const r = H.run(`(function () {
    var KT = window.KnowledgeTree;
    KT.addFragments(500);
    ['node_armor', 'node_max_hp', 'node_speed', 'node_ausweichen'].forEach(function (id) {
      for (var i = 0; i < 5; i++) KT.invest(id);
    });
    var schritte = {
      eisenhaut: KT.investNotable('not_eisenhaut'),
      zaeherLauf: KT.investNotable('not_zaeher_lauf'),
      turmwache: KT.investKeystone('key_turmwache')
    };
    return { schritte: schritte, rang: KT.getRank('node_armor'), armorAdd: window.knowledgeTreeBuffs.armorAdd };
  })()`);
  // Gegenprobe: ist wirklich alles gesetzt? Sonst misst der Test weniger als +35.
  assert.strictEqual(r.rang, 5, 'Rang ' + r.rang);
  assert.ok(r.schritte.eisenhaut && r.schritte.zaeherLauf && r.schritte.turmwache,
    'nicht alles gesetzt: ' + JSON.stringify(r.schritte));
  assert.ok(Math.abs(r.armorAdd - 0.355) < 1e-9,
    'der Baum gibt ' + Math.round(r.armorAdd * 1000) / 10 + ' statt 35,5 Punkte');
});
