// tests/elaraBesessen.test.js — der Endgegner: Elara, besessen (#157).
//
// Story-Bibel v5, Abschnitt 8: Auf Tiefe 30 wartet nicht mehr der
// Schattenrat, sondern Elara, von der Quelle besessen. Was der Spieler
// unterwegs erfahren und gesammelt hat, veraendert den Kampf:
//   * ihre eigene Klinge trifft sie haerter,
//   * wer das Zeichen erkannt hat, trifft sie angeschlagen an,
//   * Mara kommt zu Hilfe, wenn das Finale sie an Deiner Seite sieht.
// Ist die Geschichte zu Ende (story_ending), kehrt der Schattenrat zurueck.

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

test('Auf Tiefe 30 wartet Elara, nicht der Schattenrat', () => {
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'elaraBesessen');
});

test('Nach dem Ende der Geschichte kehrt der Schattenrat zurueck', () => {
  flaggen({ story_ending: 'reckoning' });
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'shadowCouncillor');
});

test('Vor der letzten Quest steht dort der Schattenrat', () => {
  // Sonst verriete schon der Bossname in der Tiefenwahl des Hubs, was kommt.
  flaggen({}, false);
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  assert.strictEqual(b.type, 'shadowCouncillor', 'Elara wartet schon, bevor die Geschichte dort ist');
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

test('Der Griff nach der Erinnerung sperrt die Faehigkeiten kurz', () => {
  L.spawnBoss();
  const vorher = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    var AS = window.AbilitySystem;
    // Der Testlauf startet ohne Belegung: zwei Faehigkeiten lernen und ablegen.
    var ids = AS.getAllAbilityDefs().map(function (d) { return d.id; }).slice(0, 2);
    ids.forEach(function (id, i) { AS.learnAbility(id, { silent: true }); AS.setSlot('slot' + (i + 1), id); });
    var bel = AS.getActiveLoadout();
    Object.keys(bel).forEach(function (s) { if (bel[s]) AS.resetCooldown(bel[s]); });
    BOSS_ATTACK_MAP.erinnerungsGriff.call(sc, b);
    return Object.keys(bel).filter(function (s) { return bel[s]; }).length;
  })()`);
  assert.ok(vorher > 0, 'keine Faehigkeit belegt — nichts zu pruefen');
  H.step(90);   // Vorlauf 900 ms
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var AS = window.AbilitySystem, bel = AS.getActiveLoadout();
    var jetzt = window.gameNow(sc);
    return Object.keys(bel).filter(function (s) { return bel[s]; })
      .map(function (s) { return AS.getCooldownRemaining(bel[s], jetzt); });
  })()`);
  assert.ok(r.every((ms) => ms > 1500), 'nicht alle Faehigkeiten gesperrt: ' + JSON.stringify(r));
});

test('Mara hilft, wenn das Finale sie an Deiner Seite sieht', () => {
  const maraFlags = H.run(`(function () {
    // Die Bedingung selbst gehoert questFinale; hier nur ein Stand, der sie erfuellt.
    var kandidaten = [{ mole_evidence: true }, { mole_evidence: true, wanted_kept: true }, { wanted_kept: true }];
    for (var i = 0; i < kandidaten.length; i++) {
      if (window.QuestFinale.computeFinaleState(kandidaten[i]).allies.mara) return kandidaten[i];
    }
    return null;
  })()`);
  assert.ok(maraFlags, 'kein Flag-Stand gefunden, bei dem Mara hilft');

  const ohne = L.spawnBoss();
  const ohneMara = H.run(`enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]._maraHilft`);
  assert.strictEqual(ohneMara, false);
  L.clearEnemies();

  flaggen(maraFlags);
  L.spawnBoss();
  const vor = H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.damage = 0; b.speed = 0; b.nextPatternAt = 1e12;
    return { hilft: b._maraHilft, hp: b.hp };
  })()`);
  assert.strictEqual(vor.hilft, true);
  // Unverwundbar: stirbt der Spieler waehrend des Wartens, startet die Szene
  // neu und die Gegnergruppe ist weg (so unter Last im Gesamtlauf passiert).
  H.run(`window._playerInvincible = true`);
  for (let i = 0; i < 8; i++) { H.step(60); L.healPlayer(); }  // ~8 s: ein Pfeil
  H.run(`window._playerInvincible = false`);
  const nach = H.run(`enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0].hp`);
  assert.ok(nach < vor.hp, 'Maras Pfeil hat nicht getroffen (' + vor.hp + ' -> ' + nach + ')');
  assert.ok(ohne.hp > 0);
});
