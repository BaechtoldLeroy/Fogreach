// tests/elaraBesessen.test.js — der Endgegner: Elara, besessen (#157).
//
// Story-Bibel v5, Abschnitt 8: Auf Tiefe 30 wartet nicht mehr der
// Schattenrat, sondern Elara, von der Quelle besessen. Was der Spieler
// unterwegs erfahren und gesammelt hat, veraendert den Kampf:
//   * ihre eigene Klinge trifft sie haerter,
//   * wer das Zeichen erkannt hat, trifft sie angeschlagen an,
//   * Mara kommt zu Hilfe, wenn ihr Netz den Konvoi ueberstanden hat.
// Die Mechaniken aus Stufe 3 (Griff nach der Erinnerung, verloeschende
// Arena, Echos) stehen in tests/elaraKampf.test.js.
// Ist die Geschichte zu Ende (story_ending), steht dort der Nachhall der Esse
// (v6.1 Stufe 2, er ersetzt den Schattenrat).

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 30 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  // Unverwundbar in JEDEM Fall (#178). Stirbt der Spieler, friert der Fall
  // ein, und 1,5 s spaeter verlaesst das Spiel den Dungeon — die
  // Gegnergruppe ist weg, und alle folgenden Faelle fallen mit ("vier Faelle
  // auf einmal"). Gemessen: in 3 von 40 Laeufen starb er im Angriffsfall,
  // obwohl dort b.damage = 0 steht — jeder Treffer kostet mindestens 1 LP
  // (applyPlayerDamage), und Elara schlaegt dort ungebremst zu.
  H.run('window._playerInvincible = true');
  L.clearEnemies();
  L.disableCrit();
  L.setWeaponDamage(20);
  L.healPlayer();
  L.setDepth(30, 30);
  flaggen({});
});

// Standard: die letzte Quest laeuft — nur dann wartet Elara. harren_dead:
// die Szene vor dem Kampf (#158, finaleQuelle.test.js) ist schon gespielt;
// sie haelt die Spieluhr an, und hier geht es um den Kampf selbst.
function flaggen(flags, mitQuest) {
  const quests = mitQuest === false ? {}
    : { schattenrat_finale: { status: 'active', objectives: [{ type: 'kill', target: 'schattenrat', current: 0, required: 1 }] } };
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(Object.assign({ harren_dead: true }, flags))};
    qs.loadQuestSaveData(st);
  })()`);
}

test('Auf Tiefe 30 wartet Elara, solange die Quelle laeuft', () => {
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'elaraBesessen');
});

test('Nach dem Ende der Geschichte steht dort der Nachhall der Esse', () => {
  flaggen({ story_ending: 'reckoning' });
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'nachhallEsse');
});

test('Vor der letzten Quest steht dort der Nachhall der Esse', () => {
  // Sonst verriete schon der Bossname in der Tiefenwahl des Hubs, was kommt.
  flaggen({}, false);
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'nachhallEsse', 'Elara wartet schon, bevor die Geschichte dort ist');
});

test('Die anderen Bosse bleiben, wer sie sind', () => {
  L.setDepth(10, 10);
  assert.strictEqual(L.spawnBoss().type, 'chainMaster');
  L.clearEnemies();
  L.setDepth(20, 20);
  assert.strictEqual(L.spawnBoss().type, 'ceremonyMaster');
});

test('Wer das Zeichen erkannt hat, trifft sie angeschlagen an', () => {
  const ohne = L.spawnBoss();
  L.clearEnemies();
  flaggen({ zeichen_bemerkt: true });
  const mit = L.spawnBoss();
  assert.strictEqual(mit.maxHp, ohne.maxHp, 'die volle Lebensleiste soll gleich bleiben');
  assert.ok(Math.abs(mit.hp / ohne.hp - 0.85) < 0.01,
    'Start-LP ' + mit.hp + ' von ' + ohne.hp + ' — erwartet 85 %');
});

test('Ihre eigene Klinge trifft sie haerter', () => {
  L.spawnBoss();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    var alt = equipment.weapon;
    function treffer(key) {
      equipment.weapon = { type: 'weapon', key: key, name: key, damage: 7, tier: 3 };
      b.hp = b.maxHp;
      var vor = b.hp;
      dealDamageToEnemy(sc, b, 1, 'attack', {});
      return vor - b.hp;
    }
    var fremd = treffer('SCHWERT');
    var eigen = treffer('ELARAS_KLINGE');
    equipment.weapon = alt;
    return { fremd: fremd, eigen: eigen };
  })()`);
  assert.ok(r.fremd > 0, 'kein Schaden gemessen');
  assert.ok(Math.abs(r.eigen / r.fremd - 1.5) < 0.1,
    'Klinge ' + r.eigen + ' gegen fremde Waffe ' + r.fremd + ' — erwartet x1,5');
});

test('Die Klinge wirkt nur gegen sie', () => {
  L.setDepth(20, 20);
  L.spawnBoss();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    var alt = equipment.weapon;
    function treffer(key) {
      equipment.weapon = { type: 'weapon', key: key, name: key, damage: 7, tier: 3 };
      b.hp = b.maxHp;
      var vor = b.hp;
      dealDamageToEnemy(sc, b, 1, 'attack', {});
      return vor - b.hp;
    }
    var fremd = treffer('SCHWERT');
    var eigen = treffer('ELARAS_KLINGE');
    equipment.weapon = alt;
    return { fremd: fremd, eigen: eigen };
  })()`);
  assert.strictEqual(r.eigen, r.fremd, 'die Klinge ist gegen jeden Boss staerker');
});

test('Ihre Angriffe bleiben, der Griff nach der Erinnerung hat seinen eigenen Takt (Stufe 3)', () => {
  // Bis b460 sperrte der Griff als Signatur alle Faehigkeiten fuer 3 s. Seit
  // Stufe 3 nimmt er eine bestimmte, bis man sie sich zurueckholt
  // (js/elaraKampf.js, tests/elaraKampf.test.js); ihre Signatur ab Phase 2
  // sind die Echos der Besiegten.
  L.spawnBoss();
  const r = H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return { angriffe: b.bossAttacks.join(','), signatur: BOSS_SIGNATURE.elaraBesessen,
      griff: BOSS_ATTACK_MAP.erinnerungsGriff === window.ElaraKampf.erinnerungsGriff,
      takt: !!(b._elaraKampf && b._elaraKampf.naechsterGriff > 0) };
  })()`);
  assert.strictEqual(r.angriffe, 'shadowDash,vergesseneRufen,nebelAusloeschung');
  assert.strictEqual(r.signatur, 'besiegteRufen');
  assert.strictEqual(r.griff, true);
  assert.strictEqual(r.takt, true, 'der Griff hat keinen Takt');
});

test('Mara hilft, wenn ihr Netz den Konvoi ueberstanden hat (wie im Urteil und im Epilog)', () => {
  // Stufe 1b: Finale.nachKampf und der Epilog lassen Mara fort, wenn ihr Netz
  // am Konvoi verbrannt ist (convoy_blown). Der Kampf folgt derselben Regel.
  flaggen({ convoy_blown: true, convoy_blade_drawn: true });
  L.spawnBoss();
  const ohneMara = H.run(`enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]._maraHilft`);
  assert.strictEqual(ohneMara, false, 'Mara hilft trotz verbranntem Netz');
  L.clearEnemies();

  flaggen({ convoy_silent: true });
  L.spawnBoss();
  const vor = H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.damage = 0; b.speed = 0; b.nextPatternAt = 1e12;
    b._elaraKampf.naechsterGriff = 1e15;
    return { hilft: b._maraHilft, hp: b.hp };
  })()`);
  assert.strictEqual(vor.hilft, true);

  // Takten, BIS der Pfeil einschlaegt — nicht 480 Bilder und dann messen.
  //
  // Nachgerechnet: Mara schiesst alle 7000 ms (Bild 420), der Pfeil fliegt
  // als Tween ueber 350 ms. Getaktet braucht ein Tween aber rund das
  // Doppelte (Phasers Tween-Delta passt nicht zum gepumpten dt), der
  // Einschlag liegt also bei Bild ~466. Von 480 Bildern blieben 14 Bilder
  // Marge — unter 3 %, und genau so oft fiel der Fall im Gesamtlauf.
  const bossHp = () => H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return b ? b.hp : -1;
  })()`);
  let nach = bossHp();
  for (let i = 0; i < 1200 && nach >= vor.hp; i++) {
    H.step(10);
    if (i % 6 === 0) L.healPlayer();
    nach = bossHp();
  }
  assert.ok(nach >= 0, 'der Boss ist waehrend des Wartens verschwunden');
  assert.ok(nach < vor.hp, 'Maras Pfeil hat nicht getroffen (' + vor.hp + ' -> ' + nach + ')');
});

// --------------------------------------------------------------- Ihr Bild

const fs = require('fs');

test('Ihre Sprites liegen vollstaendig vor', () => {
  const fehlt = ['right0', 'right1', 'right2', 'left0', 'left1', 'left2', 'idle']
    .map((f) => 'assets/enemy/boss_elara/' + f + '.png')
    .filter((p) => !fs.existsSync(p));
  assert.deepStrictEqual(fehlt, []);
});

/** Masse aus dem PNG-Kopf, ohne die Datei zu dekodieren. */
function pngMasse(datei) {
  const b = fs.readFileSync(datei);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('Sie traegt ihr eigenes Bild, nicht das der Elara aus dem Hub', () => {
  // Der Schluessel allein sagt nichts: boss_elara_* wurde frueher aus
  // assets/npc/elara geladen — derselbe Mantel wie im Hub, nur groesser
  // gezogen. Geprueft werden deshalb die MASSE der geladenen Textur.
  L.spawnBoss();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    var q = sc.textures.get('boss_elara_right0').source[0];
    // Die FIGUR messen, nicht den Rahmen: seit b314 skaliert makeBoss auf die
    // sichtbaren Pixel, displayHeight traegt noch den leeren Rand mit.
    var box = _computeSpriteAlphaBounds(b);
    return b ? { key: b.texture.key, prefix: b._bossPrefix || null,
      hoehe: box ? Math.round(box.h * b.scaleY) : Math.round(b.displayHeight),
      w: q.width, h: q.height } : null;
  })()`);
  assert.ok(r, 'kein Boss erzeugt');
  assert.strictEqual(r.key, 'boss_elara_right0', JSON.stringify(r));
  assert.strictEqual(r.prefix, 'boss_elara', 'ohne Prefix gibt es keine Angriffs-Pose');
  const soll = pngMasse('assets/enemy/boss_elara/right0.png');
  assert.deepStrictEqual({ w: r.w, h: r.h }, soll,
    'geladen wurde ein anderes Bild als assets/enemy/boss_elara/right0.png');
  const hub = pngMasse('assets/npc/elara/right0.png');
  assert.notDeepStrictEqual(soll, hub, 'die beiden Bilder sind nicht unterscheidbar');
  // makeBoss normiert auf 96 * def.scale — sie ueberragt alles im Raum.
  //
  // 283 statt der frueheren 288: gemessen wird jetzt die Figur. Sie ist
  // GENAUSO gross wie vorher — ihr alter Rahmen war 256 hoch bei 252 Zeilen
  // Figur, die vier leeren Zeilen fielen beim Umrechnen von scale 3.0 auf
  // 2.95 weg (siehe gegnerAufHoeheSkalieren in js/enemy.js).
  assert.ok(Math.abs(r.hoehe - 283) <= 3, 'sie ist ' + r.hoehe + ' px hoch statt 283');
});

test('Beim Angriff holt sie aus und kehrt danach zur Ruhe zurueck', () => {
  L.spawnBoss();
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.nextPatternAt = sc.time.now;        // gleich im naechsten Takt
    b.speed = 0; b.damage = 0;
  })()`);
  const gesehen = new Set();
  for (let i = 0; i < 90; i++) {
    H.step(1);
    gesehen.add(H.run(`(function () {
      var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
      return b ? b.texture.key : null; })()`));
  }
  const bilder = [...gesehen].join(',');
  assert.ok(/boss_elara_(right|left)1/.test(bilder), 'kein Ansatz: ' + bilder);
  assert.ok(/boss_elara_(right|left)2/.test(bilder), 'kein Schlag: ' + bilder);
  assert.match(H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return b ? b.texture.key : ''; })()`), /boss_elara_(right|left)0$/,
    'sie bleibt in der Angriffspose stehen');
});
