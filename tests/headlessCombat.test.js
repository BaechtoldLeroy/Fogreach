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

// FLATTERN (#110), behoben: der KONTROLLGEGNER war nicht zuverlaessig
// gewoehnlich. spawnEnemy wuerfelt zum Schluss Elite-Affixe (auf Tiefe 10 in
// 17,5 % der Spawns, gemessen ueber 200 Wuerfe). Kam dabei magic_resistant
// oder spectral_hit heraus, mass der Test zwei resistente Gegner
// gegeneinander — daher "ohne=10, mit=10" bzw. "ohne=4, mit=10"
// (20 x 0.5 x 0.35 = 3.5 -> 4). Nicht die Toleranz war zu eng, die
// Ausgangslage war es. lab.spawnEnemy legt den Wurf jetzt still; die
// istGewoehnlich-Zusicherungen unten halten das fest, falls je eine neue
// Zufallsquelle dazukommt.
function istGewoehnlich(ref, wer) {
  const e = L.enemy(ref);
  assert.ok(e && !e.isElite,
    `${wer} kam als Elite aus dem Spawn (Affixe: ${e ? e.affixe : '?'}) — `
    + 'die Messung haette keine Aussagekraft');
}

test('magic_resistant halbiert Faehigkeitsschaden, laesst den Basisangriff voll', () => {
  const plain = L.spawnEnemy(3, 150, 0);
  const warded = L.spawnEnemy(3, -150, 0);
  istGewoehnlich(plain, 'Kontrollgegner');
  istGewoehnlich(warded, 'Testgegner');
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
  istGewoehnlich(plain2, 'Kontrollgegner (Basisangriff)');
  istGewoehnlich(warded2, 'Testgegner (Basisangriff)');
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
  // FLATTERN (#110): der Kontrollgegner wuerfelte in ~2 % der Spawns selbst
  // 'berserker' — dann waren beide Messungen 12 und der Test meldete
  // "berserker richtete nicht mehr Schaden an: ohne=12, mit=12".
  const control = L.spawnEnemy(3, 150, 0);
  istGewoehnlich(control, 'Kontrollgegner');
  H.run(`(function () { var e = window.__lab.refs[${control}]; e.maxHp = 100; e.hp = 20; })()`);
  L.healPlayer();
  const plainLoss = L.hitPlayerFrom(control, 6).playerLost;

  const raging = L.spawnEnemy(3, -150, 0);
  istGewoehnlich(raging, 'Testgegner');
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

test('Wirbelklingen zaehlen als FERNKAMPF', () => {
  // Die Wurfklinge laeuft ueber denselben Weg wie der Dolchwurf und wird mit
  // { ranged: true } gemeldet. Damit daempft sie der Fernkampfpanzer
  // (bulwark) — und WEDER Nahkampfhaut (bruiser) NOCH Bannschild (warded).
  //
  // WICHTIG: alle Messungen am SELBEN Gegner. Frisch gespawnte Gegner
  // unterscheiden sich in Ruestung und Typ — ein Vergleich ueber mehrere
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
      dealDamageToEnemy(sc, e, 1, 'twistingBlades', { ranged: true });
      return vor - e.hp;
    })()`);
  };
  const ohne = messen(null);
  const nahkampfhaut = messen('melee');
  const bannschild = messen('skill');
  const fernkampfpanzer = messen('ranged');

  assert.ok(ohne > 0, 'Grundschaden nicht messbar: ' + ohne);
  assert.strictEqual(nahkampfhaut, ohne,
    'Nahkampfhaut daempft Wirbelklingen (' + nahkampfhaut + ' statt ' + ohne + ')');
  assert.strictEqual(bannschild, ohne,
    'Bannschild daempft Wirbelklingen (' + bannschild + ' statt ' + ohne + ')');
  assert.ok(fernkampfpanzer < ohne,
    'Fernkampfpanzer daempft Wirbelklingen NICHT (' + fernkampfpanzer + ' wie ' + ohne + ')');
});

test('Wirbelklingen: der ECHTE Treffer meldet sich als Fernkampf', () => {
  // Der Fall darueber ruft dealDamageToEnemy direkt auf. Faellt das
  // { ranged: true } im Treffer-Zweig von player.js weg, bemerkt er das NICHT.
  // Hier wird der Schaden ueber den echten Kollisionspfad ausgeloest.
  const ref = L.spawnEnemy(3, 120, 0);
  const res = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = window.__lab.refs[${ref}];
    if (!e) return { fehler: 'Gegner fehlt' };

    function treffer(resist) {
      e.maxHp = 100000; e.hp = 100000;
      e._enchant = resist ? { resist: resist, resistMul: 0.3 } : null;
      e._twId = null;
      if (playerProjectiles && playerProjectiles.children) {
        playerProjectiles.getChildren().slice().forEach(function (p) { if (p && p.destroy) p.destroy(); });
      }
      lastMoveDirection.set(1, 0);
      castTwistingBlades.call(sc);
      var k = playerProjectiles.getChildren().filter(function (p) {
        return p && p.active && p.getData && p.getData('twistingBlades');
      })[0];
      if (!k) return null;
      var vor = e.hp;
      handlePlayerProjectileEnemyOverlap.call(sc, k, e);   // echter Kollisions-Handler
      return vor - e.hp;
    }
    return { ohne: treffer(null), fern: treffer('ranged') };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.ok(res.ohne > 0, 'kein Schaden ueber den Kollisionspfad: ' + JSON.stringify(res));
  assert.ok(res.fern < res.ohne,
    'Fernkampfpanzer greift beim echten Treffer nicht (' + res.fern + ' wie ' + res.ohne
    + ') — das { ranged: true } fehlt im Treffer-Zweig');
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

// ---------------------------------------------------------------------------
// Bogen: Zielhilfe (#119)
// ---------------------------------------------------------------------------
// Aufbau wie oben ueber `stelleAuf`: Gegner fest, Spieler im gewuenschten
// Winkel und Abstand davor, Blick exakt waagerecht.

/** Feuert einen Pfeil und meldet dessen Flugrichtung in Grad. */
function schiesse(opts) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (playerProjectiles && playerProjectiles.children) {
      playerProjectiles.getChildren().slice().forEach(function (p) { if (p && p.destroy) p.destroy(); });
    }
    _fireBowArrow(sc, ${JSON.stringify(opts || {})});
    var pfeil = playerProjectiles.getChildren().filter(function (p) {
      return p && p.active && p.getData && p.getData('isBowArrow');
    })[0];
    if (!pfeil || !pfeil.body) return { fehler: 'kein Pfeil erzeugt' };
    return { grad: Math.atan2(pfeil.body.velocity.y, pfeil.body.velocity.x) * 180 / Math.PI };
  })()`);
}

test('Bogen: der ECHTE Schuss dreht auf einen Gegner im Kegel', () => {
  const auf = stelleAuf(200, 60);          // ~17 Grad, gut innerhalb der 30
  assert.ok(auf, 'Aufbau fehlgeschlagen');
  assert.ok(Math.abs(auf.grad) < 30, 'Aufbau liegt ausserhalb des Kegels: ' + auf.grad);

  const res = schiesse();
  assert.ok(!res.fehler, res.fehler);
  assert.ok(Math.abs(res.grad - auf.grad) < 1.5,
    'Pfeil fliegt auf ' + res.grad.toFixed(1) + ' statt ' + auf.grad.toFixed(1)
    + ' Grad — _fireBowArrow ruft die Zielhilfe nicht auf');
});

test('Bogen: ausserhalb des Kegels bleibt die Schussrichtung unangetastet', () => {
  // Gegenprobe zum Fall darueber: eine Zielhilfe, die IMMER dreht, waere dort
  // nicht von einer richtigen zu unterscheiden.
  const auf = stelleAuf(100, 400);         // ~76 Grad — deutlich ausserhalb
  assert.ok(auf, 'Aufbau fehlgeschlagen');
  assert.ok(Math.abs(auf.grad) > 30, 'Aufbau liegt im Kegel: ' + auf.grad);

  const res = schiesse();
  assert.ok(!res.fehler, res.fehler);
  assert.ok(Math.abs(res.grad) < 0.6,
    'Richtung wurde trotz ' + auf.grad.toFixed(0) + ' Grad auf ' + res.grad.toFixed(1)
    + ' Grad gedreht — die Zielhilfe zieht den Pfeil um Ecken');
});

test('Bogen: der Zwillings-Versatz ueberlebt die Zielhilfe', () => {
  // Reihenfolge-Falle: liefe die Zielhilfe NACH dem Versatz, zoege sie den
  // zweiten Pfeil wieder auf denselben Gegner — der Faecher waere weg.
  const auf = stelleAuf(200, 60);
  assert.ok(auf, 'Aufbau fehlgeschlagen');

  const VERSATZ = 0.18;                    // wie in attack() fuer den 2. Pfeil
  const erster = schiesse();
  const zweiter = schiesse({ angleOffset: VERSATZ });
  assert.ok(!erster.fehler && !zweiter.fehler, erster.fehler || zweiter.fehler);

  const soll = auf.grad + (VERSATZ * 180 / Math.PI);
  assert.ok(Math.abs(zweiter.grad - soll) < 1.5,
    'zweiter Pfeil fliegt auf ' + zweiter.grad.toFixed(1) + ' statt ' + soll.toFixed(1)
    + ' Grad (erster: ' + erster.grad.toFixed(1) + ') — der Versatz wurde von der '
    + 'Zielhilfe wieder eingesammelt');
});

test('Bogen: die Zielhilfe reicht genau so weit wie der Pfeil fliegt', () => {
  // Bewusst NICHT die 420 px der Wirbelklingen: die stammen aus einer
  // Nahkampf-Faehigkeit. Der Pfeil kommt bei Grundreichweite nur ~372 px weit
  // und mit Reichweiten-Boni deutlich weiter. Gemessen wird an einem Gegner
  // auf 400 px — der laege bei fixen 420 px IMMER im Kegel, bei einer an die
  // Flugweite gebundenen Zielhilfe dagegen erst nach einem Reichweiten-Bonus.
  const auf = stelleAuf(383, 115);         // ~16.7 Grad, ~400 px entfernt
  assert.ok(auf, 'Aufbau fehlgeschlagen');
  assert.ok(Math.abs(auf.grad) < 30, 'Aufbau liegt ausserhalb des Kegels: ' + auf.grad);

  const messen = (range) => {
    H.run('attackRange = ' + range + ';');
    return schiesse();
  };
  const kurz = messen(100);                // Flugweite ~372 px < 400
  const weit = messen(140);                // Flugweite ~471 px > 400
  H.run('attackRange = 100;');

  assert.ok(!kurz.fehler && !weit.fehler, kurz.fehler || weit.fehler);
  assert.ok(Math.abs(kurz.grad) < 0.6,
    'auf Grundreichweite wurde auf einen Gegner gedreht, den der Pfeil nicht '
    + 'erreicht (' + kurz.grad.toFixed(1) + ' Grad)');
  assert.ok(Math.abs(weit.grad - auf.grad) < 1.5,
    'mit Reichweiten-Bonus wird der erreichbare Gegner nicht anvisiert ('
    + weit.grad.toFixed(1) + ' statt ' + auf.grad.toFixed(1) + ' Grad)');
});

test('Beruehrungsschaden stempelt auf der Szenenuhr, nicht auf der Wanduhr', () => {
  // Die Angriffs-KI und der Beruehrungsschaden aus dem Physik-Overlap teilen
  // sich EIN Feld: enemy.lastAttackTime. Die KI rechnet mit der Szenenzeit
  // (Sekunden seit Szenenstart), hitByMelee stempelte Date.now() (~1,79
  // Billionen). Nach der ersten Beruehrung war 'time - lastAttackTime' in der
  // KI fuer immer negativ — der Gegner griff nie wieder sichtbar an, sondern
  // stand scheinbar untaetig auf dem Spieler und tat trotzdem weh.
  L.clearEnemies();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = spawnEnemy.call(sc, player.x + 300, player.y, 10);
    e.lastAttackTime = 0;
    hitByMelee.call(sc, player, e);
    return { stempel: e.lastAttackTime, szene: sc.time.now, wanduhr: Date.now() };
  })()`);
  assert.ok(Math.abs(r.stempel - r.szene) < 1000,
    'Stempel ' + r.stempel + ' passt nicht zur Szenenuhr ' + Math.round(r.szene));
  assert.ok(r.stempel < r.wanduhr / 1000,
    'Stempel liegt auf der Wanduhr: ' + r.stempel);
});

test('Beruehrungsschaden laesst dem KI-Angriff den Vortritt', () => {
  // Wer zuletzt stempelt, schiebt den anderen. Beide Pfade auf demselben Takt
  // hiessen: bei Koerperkontakt gewann die Beruehrung das Rennen, und der
  // sichtbare Angriff kam nie — genau der Fall "man steht auf dem Wolf, er
  // greift nicht an". Der Beruehrungstakt ist deshalb LAENGER als die 1500 ms
  // der KI; im Fenster dazwischen haelt er sich heraus.
  const probe = (verstrichen) => H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (x) { try { x.destroy(); } catch (e) {} });
    playerMaxHealth = 99999; playerHealth = 99999;
    var e = spawnEnemy.call(sc, player.x + 300, player.y, 10);
    e.lastAttackTime = sc.time.now - ${verstrichen};
    var vorher = playerHealth;
    hitByMelee.call(sc, player, e);
    return vorher - playerHealth;
  })()`);

  assert.strictEqual(probe(1600), 0,
    'Beruehrung schlaegt schon im KI-Fenster zu und nimmt ihr den Takt');
  assert.ok(probe(2500) > 0,
    'Beruehrung greift gar nicht mehr — der Notnagel fuer Fernkaempfer faellt weg');
});

test('Das Kettenschloss laesst die Laufsteuerung unangetastet', async () => {
  // Der erste Anlauf holte sich die Richtungstasten ueber
  // scene.input.keyboard.addKey('LEFT'). Phaser gibt dabei die BEREITS
  // vorhandene Key-Instanz zurueck — dieselbe, die createCursorKeys() in
  // main.js fuer die Laufsteuerung angelegt hat. Das removeKey() beim
  // Aufraeumen nahm sie der Tastaturverwaltung wieder weg: nach dem Minispiel
  // liefen Pfeil links/rechts im ganzen Spiel nicht mehr.
  //
  // Ein Minispiel darf die Steuerung des Spiels nicht anfassen.
  L.clearEnemies();
  const registrierung = () => H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var vorhanden = sc.input.keyboard.keys.filter(function (k) { return !!k; });
    return {
      links: vorhanden.indexOf(cursors.left) >= 0,
      rechts: vorhanden.indexOf(cursors.right) >= 0,
      anzahl: vorhanden.length
    };
  })()`);

  const vorher = registrierung();
  assert.ok(vorher.links && vorher.rechts, 'Ausgangslage stimmt nicht');

  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__griff = window.Kettenschloss.spiele(sc, 10, function () {});
    return 1;
  })()`);
  H.step(3);
  H.run('window.__griff.abbrechen()');
  H.step(3);

  const nachher = registrierung();
  assert.ok(nachher.links, 'Pfeil links ist aus der Tastaturverwaltung verschwunden');
  assert.ok(nachher.rechts, 'Pfeil rechts ist aus der Tastaturverwaltung verschwunden');
  assert.strictEqual(nachher.anzahl, vorher.anzahl,
    'Tastenzahl veraendert: ' + vorher.anzahl + ' -> ' + nachher.anzahl);

  // Bewusst NICHT geprueft: ob die Figur danach tatsaechlich laeuft. Das
  // haengt am Eingabeschema (im ARPG-Modus liest die Bewegung WASD statt der
  // Cursor) und daran, ob sie gerade an einer Wand steht — beides flattert und
  // hat mit diesem Fehler nichts zu tun. Die Registrierung IST der Fehler:
  // removeKey() nimmt dem Plugin die Taste, danach wird ihr isDown nie wieder
  // fortgeschrieben. Von Hand am laufenden Spiel nachgemessen (b158):
  // Spieler-x 650 -> 724 nach dem Minispiel.
});

test('Ein deaktivierter Elite laesst weder Aura noch Namenszug zurueck', () => {
  // Der Sicht-Timer stieg bei !enemy.active aus und nahm nur SICH mit. Aura
  // und Namenszug blieben an der letzten Stelle im Raum stehen, bis der Raum
  // gewechselt wurde (#128). Der Fall tritt ein, sobald ein Gegner
  // deaktiviert statt zerstoert wird — z. B. wenn sich das Rudel nach dem Fall
  // des Rudelfuehrers aufloest und der Aufloese-Tween nicht fertig laeuft.
  //
  // Gemessen wird der Gegner selbst, nicht die Zahl der Objekte in der Szene:
  // spawnEnemy wuerfelt eigene Elite-Chancen, die Szenenzaehlung rauscht.
  const lauf = (wie) => {
    L.clearEnemies();
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var e = spawnEnemy.call(sc, player.x + 300, player.y, 3);
      window.EliteEnemies.applyEliteToEnemy(e, 'champion');
      window.__elite = e;
      return 1;
    })()`);
    H.step(5);
    const vorher = H.run(`(function () {
      var e = window.__elite;
      return { aura: !!e._eliteAura, tafel: !!e._eliteNameTag };
    })()`);
    H.run(`(function () { var e = window.__elite; ${wie} return 1; })()`);
    H.step(20);
    return { vorher: vorher, nachher: H.run(`(function () {
      var e = window.__elite;
      return {
        aura: !!e._eliteAura, tafel: !!e._eliteNameTag,
        // Nicht nur die Referenz: das Objekt selbst muss weg sein.
        auraInSzene: !!(e.__auraProbe && e.__auraProbe.scene)
      };
    })()`) };
  };

  const tot = lauf('e.destroy();');
  assert.ok(tot.vorher.aura, 'ohne Aura ist der Fall nicht messbar');
  assert.strictEqual(tot.nachher.aura, false, 'destroy() laesst die Aura stehen');
  assert.strictEqual(tot.nachher.tafel, false, 'destroy() laesst den Namenszug stehen');

  const inaktiv = lauf('e.setActive(false);');
  assert.ok(inaktiv.vorher.aura, 'ohne Aura ist der Fall nicht messbar');
  assert.strictEqual(inaktiv.nachher.aura, false,
    'deaktivierter Elite laesst die Aura im Raum liegen');
  assert.strictEqual(inaktiv.nachher.tafel, false,
    'deaktivierter Elite laesst den Namenszug im Raum liegen');
});

test('Ein verfehltes Raumziel gibt gar keine Belohnung', () => {
  // Es gibt ZWEI Belohnungswege beim Raumabschluss: den Bonus-Chest fuers
  // erfuellte Spezialziel und den Lohn fuers Leerraeumen eines prozeduralen
  // Raums. Nur der erste fragte nach dem Ziel. Wer den Altar verlor und danach
  // die Wellen raeumte, bekam den zweiten trotzdem — in einem Viertel der
  // Faelle eine grosse Truhe (Stufe 2/3).
  //
  // Beide markRoomCleared-Aufrufe werden nachgestellt: der des Modus (mit
  // failed) und der spaetere aus der Wellen-Kette, bei dem der Modus schon
  // nichts mehr zu melden hat. Genau der vergab die Truhe doch.
  const vorbereitet = H.run(`(function () {
    var r = window.dungeonRun, idx = -1;
    for (var i = 0; i < r.templateOrder.length; i++) {
      var t = window.RoomTemplates.TEMPLATES[r.templateOrder[i]];
      if (t && t._procedural) { idx = i; break; }
    }
    if (idx < 0) return false;                 // ohne prozeduralen Raum nicht messbar
    window.__altarSicherung = {
      raum: currentRoomId, spawnLoot: window.spawnLoot,
      isSpecialRoom: window.RoomMode.isSpecialRoom,
      objectiveFailed: window.RoomMode.objectiveFailed
    };
    currentRoomId = idx; window.currentRoomId = idx;
    if (!rooms[idx]) rooms[idx] = {};
    // Beute nur zaehlen, nicht wirklich in die Welt legen.
    window.spawnLoot = function (x, y, item) {
      window.__lohn.push((item && item.type) ? item.type : 'zufall');
      return { setData: function () {}, getData: function () {} };
    };
    return true;
  })()`);
  assert.ok(vorbereitet, 'kein prozeduraler Raum im Lauf — Fall nicht messbar');

  try {
    const durchgang = (verloren) => H.run(`(function () {
      window.RoomMode.isSpecialRoom = function () { return true; };
      window.RoomMode.objectiveFailed = function () { return ${verloren}; };
      var r = rooms[currentRoomId];
      delete r._rewardGranted; delete r._bonusGranted;
      delete r._bonusEntschieden; delete r._bonusVerfehlt;
      window.__lohn = [];
      window.markRoomCleared({ objective: true, failed: ${verloren} });
      window.markRoomCleared({});
      return window.__lohn;
    })()`);

    // Kontrolle: gehalten muss zuverlaessig zahlen, sonst misst der Fall nichts.
    let gehalten = 0;
    for (let i = 0; i < 20; i++) gehalten += durchgang(false).length;
    assert.ok(gehalten >= 20,
      'gehaltener Altar zahlt nicht — Kontrolle wertlos: ' + gehalten + ' aus 20');

    let verloren = 0;
    for (let i = 0; i < 40; i++) verloren += durchgang(true).length;
    assert.strictEqual(verloren, 0,
      'verlorener Altar zahlt trotzdem: ' + verloren + ' Belohnungen aus 40 Durchgaengen');
  } finally {
    H.run(`(function () {
      var s = window.__altarSicherung;
      if (!s) return 0;
      currentRoomId = s.raum; window.currentRoomId = s.raum;
      window.spawnLoot = s.spawnLoot;
      window.RoomMode.isSpecialRoom = s.isSpecialRoom;
      window.RoomMode.objectiveFailed = s.objectiveFailed;
      window.__altarSicherung = null;
      return 1;
    })()`);
  }
});

test('Der Pluenderer flieht zur Treppe, statt den Spieler zu jagen', () => {
  // Die Meldung im Hinterhalt versprach eine Jagd, das Verhalten lieferte
  // einen ganz normalen Gegner (#129). Jetzt setzt er zur Treppe ab — ueber
  // die vorhandene Ansturm-Maschinerie (_dashTarget/_dashUntil), nicht ueber
  // eine neue Kraft in der Steering: bei der Leine der Kriegsschar (#95) ging
  // eine Zusatzkraft in Steering.limit unter und war praktisch wirkungslos.
  const lauf = (flieht) => {
    L.clearEnemies();
    const start = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      sc._enemyAttackGraceUntil = 0;
      var t = sc.stairsGroup && sc.stairsGroup.getChildren()[0];
      if (!t) return null;
      var e = spawnEnemy.call(sc, player.x + 300, player.y, 3);
      e.x = player.x + 90; e.y = player.y;
      if (e.body) e.body.reset(e.x, e.y);
      e.hp = 9999;
      e._istPluenderer = ${flieht};
      window.__p = e;
      return { treppe: Math.round(Math.hypot(t.x - e.x, t.y - e.y)) };
    })()`);
    if (!start) return null;
    H.step(400);
    const ende = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var t = sc.stairsGroup.getChildren()[0];
      var e = window.__p;
      if (!e || !e.active) return { weg: true };
      return { treppe: Math.round(Math.hypot(t.x - e.x, t.y - e.y)),
               spieler: Math.round(Math.hypot(e.x - player.x, e.y - player.y)) };
    })()`);
    return { start: start, ende: ende };
  };

  const ohne = lauf(false);
  if (!ohne) return;                     // Raum ohne Treppe: nicht messbar
  const mit = lauf(true);

  // Die Kontrolle muss stehenbleiben und den Spieler jagen, sonst misst der
  // Fall nichts.
  assert.ok(!ohne.ende.weg, 'die Kontrolle ist verschwunden');
  assert.ok(ohne.ende.treppe > ohne.start.treppe - 100,
    'die Kontrolle laeuft selbst zur Treppe — Fall nicht aussagekraeftig');

  // Der staerkste Beleg: er hat die Treppe erreicht und ist samt Beute weg.
  // Je nach Raumzuschnitt schafft er das in den vier Sekunden nicht immer —
  // dann muss er ihr wenigstens deutlich naeher gekommen sein und Abstand zum
  // Spieler halten.
  if (mit.ende.weg) return;
  assert.ok(mit.ende.treppe < mit.start.treppe - 150,
    'er kommt der Treppe nicht naeher: ' + mit.start.treppe + ' -> ' + mit.ende.treppe);
  assert.ok(mit.ende.spieler > ohne.ende.spieler + 100,
    'er haelt keinen Abstand: mit ' + mit.ende.spieler + ' vs ohne ' + ohne.ende.spieler);
});

test('Entkommt der Pluenderer, ist die Beute weg — erschlagen zahlt sie aus', () => {
  // Erst das macht aus dem Hinterhalt eine Entscheidung: den Traeger jagen
  // oder erst die anderen abraeumen. Ohne Folgen waere die Flucht Dekoration.
  const probe = (wie) => H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (x) { try { x.destroy(); } catch (e) {} });
    sc._enemyAttackGraceUntil = 0;
    var t = sc.stairsGroup.getChildren()[0];
    if (!window.__goldHaken) {
      window.__goldHaken = true;
      var o = window.LootSystem.grantGold;
      window.LootSystem.grantGold = function (n) { window.__gold += n; return o.apply(this, arguments); };
    }
    window.__gold = 0;
    var e = spawnEnemy.call(sc, player.x + 300, player.y, 3);
    e._istPluenderer = true;
    e.setData('pluendererGold', 200);
    if ('${wie}' === 'flucht') {
      e.x = t.x + 20; e.y = t.y; if (e.body) e.body.reset(e.x, e.y);
    } else {
      e.hp = 0;
      handleEnemyHit(sc, e, {});
    }
    window.__p = e;
    return 1;
  })()`);

  probe('tot');
  H.step(20);
  const tot = H.run('(function(){var e=window.__p;return {weg:!(e&&e.active&&e.scene),gold:window.__gold};})()');
  assert.strictEqual(tot.weg, true, 'der erschlagene Traeger bleibt stehen');
  assert.strictEqual(tot.gold, 200, 'der erschlagene Traeger zahlt nicht aus');

  probe('flucht');
  H.step(20);
  const weg = H.run('(function(){var e=window.__p;return {weg:!(e&&e.active&&e.scene),gold:window.__gold};})()');
  assert.strictEqual(weg.weg, true, 'er erreicht die Treppe, verschwindet aber nicht');
  assert.strictEqual(weg.gold, 0, 'die Flucht bleibt folgenlos: er zahlt trotzdem');
});

test('Ein Boss laesst IMMER Ausruestung fallen', () => {
  // Gemessen ueber 200 Kills auf Tiefe 10: vorher fiel bei einem Boss in
  // 10,5 % der Faelle etwas — neun von zehn Bosskaempfen endeten ohne ein
  // einziges Stueck (#130). Ein Boss erscheint ohnehin nur alle zehn Tiefen,
  // das ist also kein Beutestrom, sondern eine Handvoll Stuecke ueber einen
  // ganzen Durchgang.
  //
  // Garantiert ist DASS etwas faellt, nicht WAS — die Qualitaet bleibt
  // gewuerfelt.
  const quote = (was, n) => H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var mit = 0;
    for (var i = 0; i < ${n}; i++) {
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      lootGroup.getChildren().slice().forEach(function (d) { try { d.destroy(); } catch (x) {} });
      window.__runItemsDropped = 0;
      var e = null;
      if ('${was}' === 'boss') { spawnBoss.call(sc); e = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]; }
      else { e = spawnEnemy.call(sc, player.x + 200, player.y, 3); }
      if (!e) continue;
      e.hp = 0;
      handleEnemyHit(sc, e, {});
      var stuecke = 0;
      lootGroup.getChildren().forEach(function (d) {
        var it = d.getData && d.getData('item');
        if (it && it.type && it.type !== 'gold') stuecke++;
      });
      if (stuecke > 0) mit++;
    }
    return mit;
  })()`);

  const N = 40;
  assert.strictEqual(quote('boss', N), N, 'ein Boss ging leer aus');

  // Gegenprobe: fuer normale Gegner bleibt es beim Wurf. Sonst waere aus dem
  // garantierten Bossabwurf versehentlich ein garantierter Abwurf fuer alle
  // geworden — und der Beuteregen haette das ganze Gleichgewicht gekippt.
  assert.ok(quote('normal', N) < N * 0.5,
    'auch normale Gegner lassen jetzt fast immer etwas fallen');
});

test('Der Pluenderer klaut beim ersten Treffer und rennt erst dann los', () => {
  // Das dreht das Ereignis um: vorher trug er Beute, die man ihm abnehmen
  // konnte; jetzt nimmt er DIR etwas weg, und die Jagd holt es zurueck. Wer
  // ihn laufen laesst, zahlt dafuer.
  //
  // Anteilig statt fest: ein fester Betrag waere frueh vernichtend und
  // spaeter belanglos.
  const lauf = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    sc._enemyAttackGraceUntil = 0;
    playerMaxHealth = 99999; playerHealth = 99999;
    var LS = window.LootSystem;
    LS.spendGold(LS.getGold() || 0); LS.grantGold(1000);
    var start = LS.getGold();
    var e = spawnEnemy.call(sc, player.x + 200, player.y, 3);
    e._istPluenderer = true; e.setData('pluendererGold', 100); e.hp = 9999;
    window.__pl = e;
    return { start: start, hatGeklaut: !!e._hatGeklaut, gerannt: !!e._letzteFlucht };
  })()`);
  assert.strictEqual(lauf.hatGeklaut, false);

  // Ungeschlagen bleibt er stehen — sonst waere er nie einzuholen.
  H.step(200);
  const ohne = H.run('(function(){var e=window.__pl;return {geklaut:!!e._hatGeklaut,gerannt:!!e._letzteFlucht};})()');
  assert.strictEqual(ohne.geklaut, false, 'er klaut ohne Treffer');
  assert.strictEqual(ohne.gerannt, false, 'er rennt schon vor dem ersten Treffer los');

  // Der Griff in den Beutel.
  const klau = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = window.__pl, LS = window.LootSystem;
    var vorher = LS.getGold();
    var beute = _pluendererKlaut(sc, e);
    return { beute: beute, vorher: vorher, nachher: LS.getGold(),
             seineBeute: e.getData('pluendererGold'), geklaut: !!e._hatGeklaut };
  })()`);
  assert.ok(klau.beute > 0, 'er nimmt nichts');
  assert.strictEqual(klau.nachher, klau.vorher - klau.beute, 'der Beutel stimmt nicht');
  assert.strictEqual(klau.seineBeute, 100 + klau.beute,
    'das Gestohlene liegt nicht auf dem Topf, der beim Tod ausgeschuettet wird');

  // Ein zweiter Griff darf nicht nochmal zulangen.
  const zweimal = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var LS = window.LootSystem, vorher = LS.getGold();
    _pluendererKlaut(sc, window.__pl);
    return LS.getGold() === vorher;
  })()`);
  assert.strictEqual(zweimal, true, 'er klaut mehrfach');

  // Jetzt rennt er.
  H.step(60);
  const danach = H.run('(function(){var e=window.__pl;return !e||!e.active?true:!!e._letzteFlucht;})()');
  assert.strictEqual(danach, true, 'nach dem Griff rennt er nicht');

  // Und beim Tod kommt alles zurueck: seine Beute UND das Gestohlene.
  const tot = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = window.__pl, LS = window.LootSystem;
    if (!e || !e.active) return null;
    var vorher = LS.getGold();
    var trug = e.getData('pluendererGold');
    e.hp = 0; handleEnemyHit(sc, e, {});
    return { vorher: vorher, trug: trug, nachher: LS.getGold() };
  })()`);
  if (tot) {
    assert.strictEqual(tot.nachher, tot.vorher + tot.trug,
      'der Erschlagene zahlt nicht alles aus: ' + JSON.stringify(tot));
  }
});
