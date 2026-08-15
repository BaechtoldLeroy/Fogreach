// tests/headlessCombat.test.js — Stufe 3 des Headless-Testsystems (#96).
//
// Sichert GAMEPLAY-AUSSAGEN ab, die bisher nur per Einmal-Skript belegt waren:
//   * Boss-HP-Verhaeltnis zu Mini-Bossen (b75)
//   * Wirkung der Elite-Affixe (b76, Issue #90)
//
// Beides sind Aenderungen, die im laufenden Spiel getroffen wurden, ohne dass
// ein einziger Test sie abdeckte — genau die Luecke, die #96 schliessen soll.
// Der Schaden laeuft dabei durch die ECHTEN Funnels (dealDamageToEnemy /
// applyPlayerDamage), nicht durch nachgebaute Formeln.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 10 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  // Jeder Fall startet mit leerem Raum und ohne Zufallsquellen, die
  // Schadensmessungen verrauschen wuerden.
  L.clearEnemies();
  L.disableCrit();
  L.setWeaponDamage(20);
  L.healPlayer();
  L.makePlayerVulnerable();
});

// ---------------------------------------------------------------------------
// Boss-Skalierung (b75)
// ---------------------------------------------------------------------------

test('Boss ist auf seiner Gate-Tiefe deutlich zaeher als ein Mini-Boss', () => {
  L.setDepth(10, 10);

  // Mini-Boss-Bandbreite ueber mehrere Basistypen abtasten (HP haengt am Typ).
  const miniHps = [1, 2, 3].map((t) => {
    L.clearEnemies();
    const ref = L.spawnMiniBoss(t);
    return L.enemy(ref).hp;
  });
  const miniAvg = miniHps.reduce((a, b) => a + b, 0) / miniHps.length;
  const miniMax = Math.max(...miniHps);

  L.clearEnemies();
  const boss = L.spawnBoss();
  assert.ok(!boss.error, 'Boss konnte nicht erzeugt werden: ' + boss.error);
  assert.strictEqual(boss.type, 'chainMaster', 'unerwarteter Boss: ' + boss.type);

  // Kernaussage aus b75: der Boss muss ueber dem ZAEHESTEN Mini-Boss liegen —
  // vorher lag er darunter, obwohl ein Mini-Boss jeden gewoehnlichen Raum
  // abschliesst.
  assert.ok(boss.hp > miniMax,
    `Boss (${boss.hp} HP) ist nicht zaeher als der zaeheste Mini-Boss (${miniMax} HP)`);

  const ratio = boss.hp / miniAvg;
  assert.ok(ratio >= 2.2 && ratio <= 4.5,
    `Boss/Mini-Boss-Verhaeltnis ${ratio.toFixed(2)} liegt ausserhalb des Zielbands (Ziel ~3x)`);
});

test('Boss-HP waechst mit der Tiefe (nicht mehr fix)', () => {
  L.setDepth(10, 10);
  L.clearEnemies();
  const atTen = L.spawnBoss();

  L.setDepth(40, 10);   // gleiche Welle -> gleicher Bosstyp, nur tiefer
  L.clearEnemies();
  const atForty = L.spawnBoss();

  assert.ok(!atTen.error && !atForty.error, 'Boss-Erzeugung fehlgeschlagen');
  assert.strictEqual(atTen.type, atForty.type, 'unterschiedliche Bosstypen verglichen');
  assert.ok(atForty.hp > atTen.hp,
    `Boss skaliert nicht mit der Tiefe: T10=${atTen.hp} HP, T40=${atForty.hp} HP`);
});

// ---------------------------------------------------------------------------
// Elite-Affixe (b76 / #90)
// ---------------------------------------------------------------------------

test('magic_resistant halbiert Faehigkeitsschaden, laesst den Basisangriff voll', () => {
  const plain = L.spawnEnemy(3, 150, 0);
  const warded = L.spawnEnemy(3, -150, 0);
  L.applyAffix(warded, 'magic_resistant');

  const abilityPlain = L.hitEnemy(plain, { ability: 'whirlwind' }).dealt;
  const abilityWarded = L.hitEnemy(warded, { ability: 'whirlwind' }).dealt;
  assert.ok(abilityWarded < abilityPlain,
    `Faehigkeitsschaden nicht reduziert: ohne=${abilityPlain}, mit=${abilityWarded}`);
  assert.ok(Math.abs(abilityWarded - abilityPlain / 2) <= 1,
    `erwartet ~halber Schaden, war ${abilityWarded} statt ${abilityPlain / 2}`);

  // Der Basisangriff muss unberuehrt bleiben — das ist der Kniff des Affixes.
  const plain2 = L.spawnEnemy(3, 200, 0);
  const warded2 = L.spawnEnemy(3, -200, 0);
  L.applyAffix(warded2, 'magic_resistant');
  assert.strictEqual(
    L.hitEnemy(warded2, { ability: 'attack' }).dealt,
    L.hitEnemy(plain2, { ability: 'attack' }).dealt,
    'Basisangriff wurde faelschlich reduziert',
  );
});

test('vampiric heilt den Angreifer am zugefuegten Schaden', () => {
  const ref = L.spawnEnemy(3, 150, 0);
  L.applyAffix(ref, 'vampiric');
  // Der Gegner muss verletzt sein und ein maxHp tragen, sonst greift die
  // Deckelung im Effekt (bewusst so gebaut).
  H.run(`(function () {
    var e = window.__lab.refs[${ref}];
    e.maxHp = 100; e.hp = 50;
  })()`);

  const res = L.hitPlayerFrom(ref, 10);
  assert.ok(res.playerLost > 0, 'Spieler nahm keinen Schaden');
  assert.ok(res.enemyAfter > res.enemyBefore,
    `Angreifer heilte sich nicht: ${res.enemyBefore} -> ${res.enemyAfter}`);
});

test('berserker verdoppelt den Schaden unter 30% eigener HP', () => {
  // Kontrolle: gleicher Gegner, gleicher Rohschaden, aber ohne Affix.
  const control = L.spawnEnemy(3, 150, 0);
  H.run(`(function () { var e = window.__lab.refs[${control}]; e.maxHp = 100; e.hp = 20; })()`);
  L.healPlayer();
  const plainLoss = L.hitPlayerFrom(control, 6).playerLost;

  const raging = L.spawnEnemy(3, -150, 0);
  L.applyAffix(raging, 'berserker');
  H.run(`(function () { var e = window.__lab.refs[${raging}]; e.maxHp = 100; e.hp = 20; })()`);
  L.healPlayer();
  const ragingLoss = L.hitPlayerFrom(raging, 6).playerLost;

  assert.ok(ragingLoss > plainLoss,
    `berserker richtete nicht mehr Schaden an: ohne=${plainLoss}, mit=${ragingLoss}`);
  assert.ok(Math.abs(ragingLoss - plainLoss * 2) <= 1,
    `erwartet ~doppelter Schaden, war ${ragingLoss} statt ${plainLoss * 2}`);
});

test('berserker wirkt NICHT bei voller Gesundheit', () => {
  const healthy = L.spawnEnemy(3, 150, 0);
  L.applyAffix(healthy, 'berserker');
  H.run(`(function () { var e = window.__lab.refs[${healthy}]; e.maxHp = 100; e.hp = 100; })()`);
  L.healPlayer();
  const withAffix = L.hitPlayerFrom(healthy, 6).playerLost;

  const control = L.spawnEnemy(3, -150, 0);
  H.run(`(function () { var e = window.__lab.refs[${control}]; e.maxHp = 100; e.hp = 100; })()`);
  L.healPlayer();
  const without = L.hitPlayerFrom(control, 6).playerLost;

  assert.strictEqual(withAffix, without,
    'berserker verstaerkte bereits bei voller HP — die 30%-Schwelle greift nicht');
});

test('fanatic setzt Tempo UND Angriffstakt', () => {
  const ref = L.spawnEnemy(3, 150, 0);
  const before2 = L.enemy(ref);
  L.applyAffix(ref, 'fanatic');
  const after2 = L.enemy(ref);

  assert.ok(after2.speed > before2.speed, 'fanatic erhoehte das Tempo nicht');
  assert.ok(typeof after2.attackCdMul === 'number' && after2.attackCdMul < 1,
    'fanatic setzte _attackCdMul nicht (' + after2.attackCdMul + ')');
});

// ---------------------------------------------------------------------------
// Struktur-Zusicherung: kein Affix darf wirkungslos sein
// ---------------------------------------------------------------------------
// Genau der Defekt aus #90: sieben Affixe setzten Flags, die NIRGENDS gelesen
// wurden. Dieser Test faengt den Rueckfall automatisch ab.

test('jeder Elite-Affix setzt nur Werte, die der Spielcode auch liest', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const consumers = ['js/enemy.js', 'js/player.js', 'js/main.js']
    .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

  const report = H.run(`(function () {
    var out = [];
    window.EliteEnemies.ENEMY_AFFIX_DEFS.forEach(function (d) {
      var e = { speed: 60, damage: 5, baseDamage: 5, hp: 10, maxHp: 10 };
      d.apply(e);
      Object.keys(e).forEach(function (k) {
        if (['speed', 'damage', 'baseDamage', 'hp', 'maxHp'].indexOf(k) >= 0) return;
        if (k.indexOf('_orig') === 0) return;
        out.push({ affix: d.id, key: k, marker: /^(is|has)/.test(k) });
      });
    });
    return out;
  })()`);

  // FALLE: `report` kommt aus dem vm-Kontext und ist deshalb KEIN Array des
  // Host-Realms (anderer Prototyp). deepStrictEqual wuerde selbst bei leerer
  // Liste scheitern — daher umkopieren und ueber die Laenge zusichern.
  const dead = Array.from(report).filter((r) => {
    if (r.marker) return false; // reine Marker-Flags duerfen ungelesen bleiben
    return !new RegExp('\\b' + r.key + '\\b').test(consumers);
  });

  assert.strictEqual(dead.length, 0,
    'Affix-Werte ohne Leser (wie in #90): ' + dead.map((d) => d.affix + '.' + d.key).join(', '));
});
