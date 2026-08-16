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

  // Breit abtasten: Mini-Boss-HP = HP eines gewoehnlichen Gegners x16
  // (enemy.js), haengt also am Basistyp UND wuerfelt. Die Spanne auf T10 reicht
  // ueber 300 Wuerfe von 32 bis 320 HP. Eine kleine Stichprobe misst deshalb
  // nichts Stabiles — frueher standen hier drei Typen, was den Test sporadisch
  // fehlschlagen liess.
  const SAMPLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const miniHps = SAMPLES.concat(SAMPLES).concat(SAMPLES).map((t) => {
    L.clearEnemies();
    const ref = L.spawnMiniBoss(t);
    return L.enemy(ref).hp;
  });
  const miniAvg = miniHps.reduce((a, b) => a + b, 0) / miniHps.length;
  const sorted = miniHps.slice().sort((a, b) => a - b);
  const miniMedian = sorted[Math.floor(sorted.length / 2)];

  L.clearEnemies();
  const boss = L.spawnBoss();
  assert.ok(!boss.error, 'Boss konnte nicht erzeugt werden: ' + boss.error);
  assert.strictEqual(boss.type, 'chainMaster', 'unerwarteter Boss: ' + boss.type);

  // Zusicherung aus b75, korrigiert: gemessen wird gegen den DURCHSCHNITT, denn
  // das war die Vorgabe ("Boss ~3x Mini-Boss"). Gegen das Maximum zu pruefen
  // waere nicht erfuellbar — die Mini-Boss-Verteilung hat einen langen
  // Auslaeufer (T10 bis 320 HP), weil der zaeheste Gegnertyp x16 genommen wird.
  // Dass ein seltener Mini-Boss-Wurf den Boss uebertreffen kann, ist eine
  // offene Design-Frage der Mini-Boss-Skalierung, keine der Boss-Werte.
  const ratio = boss.hp / miniAvg;
  assert.ok(ratio >= 2.5 && ratio <= 4.2,
    `Boss/Mini-Boss-Verhaeltnis ${ratio.toFixed(2)} liegt ausserhalb des Zielbands (Ziel ~3x, Boss ${boss.hp} HP, Mini-Schnitt ${miniAvg.toFixed(1)} HP)`);

  // Der typische Mini-Boss muss klar unter dem Boss liegen — das ist die
  // stabile Form der urspruenglichen Aussage.
  assert.ok(boss.hp > miniMedian * 2,
    `Boss (${boss.hp} HP) liegt nicht klar ueber dem typischen Mini-Boss (Median ${miniMedian} HP)`);
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

// ---------------------------------------------------------------------------
// Wirbelklingen: Zielhilfe und Verzauberungs-Klassifizierung
// ---------------------------------------------------------------------------
// Hinweis zum Aufbau: der Winkel wird ueber die SPIELER-Position gesetzt, nicht
// ueber die des Gegners. `spawnEnemy` verschiebt den Gegner auf einen
// erreichbaren Punkt (gemessen: angefordert +100/+400, gelandet -150/-270), der
// Winkel waere damit nicht steuerbar und der Test verliesse sich auf Zufall.

/** Genau EIN Gegner im Raum, Spieler im gewuenschten Winkel davor. */
function stelleAuf(dx, dy) {
  L.clearEnemies();
  const ref = L.spawnEnemy(3, 150, 0);
  return H.run(`(function () {
    var e = window.__lab.refs[${ref}];
    if (!e) return null;
    player.body.reset(e.x - ${dx}, e.y - ${dy});
    lastMoveDirection.set(1, 0);          // Blick exakt waagerecht
    return { grad: Math.atan2(e.y - player.y, e.x - player.x) * 180 / Math.PI };
  })()`);
}

test('Wirbelklingen: die Wurfrichtung dreht auf einen Gegner im Kegel', () => {
  const auf = stelleAuf(200, 60);         // ~17 Grad — innerhalb der 30
  assert.ok(auf, 'Aufbau fehlgeschlagen');
  assert.ok(Math.abs(auf.grad) < 30, 'Aufbau liegt ausserhalb des Kegels: ' + auf.grad);

  const ist = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var d = _aimAssistVector(_getAimVector2(sc), 420, 30);
    return Math.atan2(d.y, d.x) * 180 / Math.PI;
  })()`);
  assert.ok(Math.abs(auf.grad - ist) < 0.5,
    'Wurf zielt auf ' + ist.toFixed(1) + ' statt ' + auf.grad.toFixed(1) + ' Grad');
});

test('Wirbelklingen: ausserhalb des Kegels bleibt die Richtung unangetastet', () => {
  const auf = stelleAuf(100, 400);        // ~76 Grad — deutlich ausserhalb
  assert.ok(auf, 'Aufbau fehlgeschlagen');
  assert.ok(Math.abs(auf.grad) > 30, 'Aufbau liegt im Kegel: ' + auf.grad);

  const abweichung = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var d = _aimAssistVector(_getAimVector2(sc), 420, 30);
    return Math.abs(d.y);
  })()`);
  assert.ok(abweichung < 0.01,
    'Richtung wurde trotz ' + auf.grad.toFixed(0) + ' Grad gedreht (y=' + abweichung + ') — '
    + 'die Zielhilfe zieht die Klinge um Ecken');
});

test('Wirbelklingen zaehlen als Faehigkeit, nicht als Nahkampf', () => {
  // Klassifizierung in dealDamageToEnemy (player.js): 'melee' ist NUR der
  // Basisangriff. Nahkampfhaut (bruiser) darf die Wurfklinge deshalb nicht
  // daempfen — Bannschild (warded) schon.
  // WICHTIG: alle drei Messungen am SELBEN Gegner. Frisch gespawnte Gegner
  // unterscheiden sich in Ruestung und Typ — ein Vergleich ueber drei
  // Exemplare hinweg schlug dadurch sporadisch fehl (20 gegen 7 Schaden,
  // ohne dass eine Resistenz im Spiel war).
  const ref = L.spawnEnemy(3, 150, 0);
  const messen = (resist) => {
    const ench = resist ? "{ resist: '" + resist + "', resistMul: 0.3 }" : 'null';
    return H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var e = window.__lab.refs[${ref}];
      if (!e) return null;
      e.maxHp = 100000; e.hp = 100000;
      e._enchant = ${ench};
      var vor = e.hp;
      dealDamageToEnemy(sc, e, 1, 'twistingBlades');
      return vor - e.hp;
    })()`);
  };
  const ohne = messen(null);
  const nahkampfhaut = messen('melee');
  const bannschild = messen('skill');

  assert.ok(ohne > 0, 'Grundschaden nicht messbar: ' + ohne);
  assert.strictEqual(nahkampfhaut, ohne,
    'Nahkampfhaut daempft Wirbelklingen (' + nahkampfhaut + ' statt ' + ohne + ')');
  assert.ok(bannschild < ohne,
    'Bannschild daempft Wirbelklingen NICHT (' + bannschild + ' wie ' + ohne + ')');
});

test('Wirbelklingen: der ECHTE Wurf nutzt die Zielhilfe', () => {
  // Der Fall darueber prueft nur die Hilfsfunktion. Wird sie in
  // castTwistingBlades nicht mehr aufgerufen, faellt das dort NICHT auf —
  // hier schon: gemessen wird die Flugrichtung des erzeugten Geschosses.
  const auf = stelleAuf(200, 60);          // ~17 Grad, Blick waagerecht
  assert.ok(auf, 'Aufbau fehlgeschlagen');

  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (playerProjectiles && playerProjectiles.children) {
      playerProjectiles.getChildren().slice().forEach(function (p) { if (p && p.destroy) p.destroy(); });
    }
    castTwistingBlades.call(sc);
    var klinge = playerProjectiles.getChildren().filter(function (p) {
      return p && p.active && p.getData && p.getData('twistingBlades');
    })[0];
    if (!klinge || !klinge.body) return { fehler: 'keine Klinge erzeugt' };
    return { grad: Math.atan2(klinge.body.velocity.y, klinge.body.velocity.x) * 180 / Math.PI };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.ok(Math.abs(res.grad - auf.grad) < 1.5,
    'Klinge fliegt auf ' + res.grad.toFixed(1) + ' statt ' + auf.grad.toFixed(1)
    + ' Grad — castTwistingBlades ruft die Zielhilfe nicht auf');
});
