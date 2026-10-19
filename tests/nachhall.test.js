// tests/nachhall.test.js — der Nachhall auf Tiefe 25 (Story-Kern v6.1, Stufe 2).
//
// Niemand. Alle verbrannten Erinnerungen, zu einem Wesen verschmolzen.
//   * Er steht auf Tiefe 25, solange "Was der Rauch behaelt" laeuft; der
//     Zehnerrhythmus der anderen Bosse bleibt.
//   * Er fluestert aus dem, was wirklich gespielt wurde. Die eigene Stimme
//     nur mit "Wer du warst".
//   * Er wechselt mit jeder Phase die Gestalt: Hall, Schwarm, Chor.
//   * Seine Bruchstuecke kehren in ihn zurueck und heilen ihn.
//   * Nach dem Sieg bleiben Namen lesbar; Thom druckt sie im Epilog.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

loadGameModule('js/nachhall.js');
const N = globalThis.window.Nachhall;

const ERLEDIGT = { status: 'completed', objectives: [] };
const AUFTRAG_AKTIV = { status: 'active', objectives: [{ type: 'boss_kill', target: 'nachhall', current: 0, required: 1 }] };

// --- Rein: was er fluestern kann --------------------------------------------

test('Pool: Maras Leute immer, die Liste je nach Wahl', () => {
  const namen = (flags) => N.fluesterPool({ flags, lang: 'de' })
    .filter((p) => p.art === 'name').map((p) => p.text);
  const ohne = namen({});
  assert.deepStrictEqual(ohne, N.MARAS_LEUTE, 'ohne Wahl nur Maras Leute');
  const abgeliefert = namen({ namen_abgeliefert: true });
  N.MARAS_LISTE.forEach((n) => assert.ok(abgeliefert.includes(n), n + ' fehlt nach dem Abliefern'));
  // Gewarnt: die meisten sind rechtzeitig fort, weniger bekannte Gesichter.
  const gewarnt = namen({ namen_gewarnt: true });
  const ausListe = gewarnt.filter((n) => N.MARAS_LISTE.includes(n));
  assert.ok(ausListe.length >= 1 && ausListe.length < N.MARAS_LISTE.length,
    'gewarnt: ' + ausListe.length + ' von der Liste');
});

test('Pool: Saetze aus Gesuchen und aus erledigten Auftraegen', () => {
  const pool = N.fluesterPool({ lang: 'de', erledigt: [
    { id: 'council_seizure', text: 'Gib her.\n\n(Bevor du sie abgibst ...) Es sind keine Pamphlete. Es sind Gesuche.' },
    { id: 'mara_warning', text: 'Der Kettenmeister ist gefallen, die Beweise gesichert.' }
  ] });
  assert.ok(pool.some((p) => p.quelle === 'gesuch'), 'keine Gesuche, obwohl beschlagnahmt');
  assert.ok(pool.some((p) => p.quelle === 'auftrag:mara_warning' && /Kettenmeister/.test(p.text)));
  // Regieanweisungen in Klammern fluestert er nicht.
  assert.ok(!pool.some((p) => /\(/.test(p.text)), 'Klammertext im Pool');
  const ohneGesuche = N.fluesterPool({ lang: 'de', erledigt: [] });
  assert.ok(!ohneGesuche.some((p) => p.quelle === 'gesuch'), 'Gesuche ohne beschlagnahmte Schriften');
});

test('Die eigene Stimme nur mit "Wer du warst", und genau einmal', () => {
  const ohne = N.fluesterPool({ lang: 'de', erledigt: [{ id: 'mara_contact', text: 'Hallo.' }] });
  assert.ok(!ohne.some((p) => p.art === 'eigen'), 'eigene Stimme ohne Wer du warst');
  const mit = N.fluesterPool({ lang: 'de', erledigt: [{ id: 'who_you_were', text: 'Da bist Du.' }] });
  assert.strictEqual(mit.filter((p) => p.art === 'eigen').length, 1);
  const d = { pool: mit, gesagt: [] };
  const folge = [];
  for (let i = 0; i < 20; i++) { const e = N.naechstes(d, () => 0.5); d.gesagt.push(e); folge.push(e.art); }
  assert.strictEqual(folge[N.EIGEN_ALS - 1], 'eigen', 'die eigene Stimme kommt nicht als ' + N.EIGEN_ALS + '.');
  assert.strictEqual(folge.filter((a) => a === 'eigen').length, 1, 'eigene Stimme mehrfach: ' + folge.join(','));
});

test('Restnamen: nur Namen aus dem Pool, hoechstens vier', () => {
  const pool = N.fluesterPool({ flags: { namen_abgeliefert: true }, lang: 'de' });
  const rest = N.restNamen(pool, () => 0.7);
  assert.ok(rest.length >= 1 && rest.length <= N.REST_NAMEN);
  rest.forEach((n) => assert.ok(N.MARAS_LEUTE.concat(N.MARAS_LISTE).includes(n), n));
  assert.strictEqual(new Set(rest).size, rest.length, 'doppelte Namen');
});

test('Gestalt je Phase: Hall, Schwarm, Chor', () => {
  assert.deepStrictEqual([1, 2, 3].map(N.gestaltFuer), ['hall', 'schwarm', 'chor']);
  const angriffe = Object.keys(N.GESTALTEN).map((g) => N.GESTALTEN[g].angriffe.join());
  assert.strictEqual(new Set(angriffe).size, 3, 'zwei Gestalten greifen gleich an');
});

// --- Im Spiel -------------------------------------------------------------------

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 25 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run('window._playerInvincible = true');
  L.clearEnemies();
  L.disableCrit();
  L.healPlayer();
  L.setDepth(25, 25);
  stand({ was_der_rauch_behaelt: AUFTRAG_AKTIV }, {});
});

/** Spielstand setzen. Die Zwischenszene gilt als gesehen (haelt sonst die Uhr an). */
function stand(quests, flags, namen) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(Object.assign({ bossintro_nachhall: true }, flags))};
    st.nachhallNamen = ${JSON.stringify(namen || [])};
    qs.loadQuestSaveData(st);
    if (window.storySystem && window.storySystem.advanceToAct) window.storySystem.advanceToAct(4);
  })()`);
}

const BOSS = `enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]`;

/** Der Weg des Spiels: Finalraum, Welle startet (wave.js). */
function klimax() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__isFinalDungeonRoom = true;
    window.__runClimaxSpawned = false;
    try { startNextWave.call(sc, true); } finally { window.__isFinalDungeonRoom = false; }
    var b = ${BOSS};
    return b ? b.bossType : null;
  })()`);
}

test('Auf Tiefe 25 steht der Nachhall, solange der Auftrag laeuft', () => {
  assert.strictEqual(klimax(), 'nachhall');
});

test('Ohne den Auftrag ist Tiefe 25 ein gewoehnlicher Lauf', () => {
  stand({}, {});
  assert.notStrictEqual(klimax(), 'nachhall');
  L.clearEnemies();
  stand({ was_der_rauch_behaelt: ERLEDIGT }, {});
  assert.notStrictEqual(klimax(), 'nachhall', 'nach dem Auftrag wartet er weiter');
});

test('Der Zehnerrhythmus bleibt: Tiefe 20 und 30', () => {
  L.setDepth(20, 20);
  assert.strictEqual(klimax(), 'ceremonyMaster');
  L.clearEnemies();
  L.setDepth(30, 30);
  assert.strictEqual(klimax(), 'nachhallEsse');
});

test('Staerke zwischen Zeremonienmeister und Elara', () => {
  const b = L.spawnBoss();
  assert.strictEqual(b.type, 'nachhall');
  const r = H.run(`(function () {
    var d = BOSS_DEFINITIONS;
    return { z: Math.ceil(d.ceremonyMaster.baseHP * 2.9), e: Math.ceil(d.elaraBesessen.baseHP * 3.9),
      zs: d.ceremonyMaster.baseDamage, es: d.elaraBesessen.baseDamage, h: Math.round(${BOSS}._hitHalfH * 2) };
  })()`);
  assert.ok(b.maxHp > r.z && b.maxHp < r.e, 'LP ' + b.maxHp + ' nicht zwischen ' + r.z + ' und ' + r.e);
  assert.ok(b.damage > r.zs && b.damage < r.es, 'Schaden ' + b.damage);
  assert.ok(r.h > 127 && r.h < 173, 'Figur ' + r.h + ' px');
});

function ruhig() {
  H.run(`(function () { var b = ${BOSS}; b.nextPatternAt = 1e12; b.speed = 0; b.damage = 0; })()`);
}

test('Die Gestalt wechselt mit der Phase: Schwarm, dann Chor mit zwei Echos', () => {
  L.spawnBoss();
  ruhig();
  const sieh = () => H.run(`(function () { var b = ${BOSS};
    return { g: b._nachhall.gestalt, pre: b._bossPrefix, tex: b.texture.key, an: b.bossAttacks.slice(),
      echos: b._nachhall.echos.filter(function (e) { return e.active; }).length }; })()`);
  assert.strictEqual(sieh().g, 'hall');
  H.run(`(function () { var b = ${BOSS}; b.hp = Math.floor(b.maxHp * 0.6); })()`);
  H.step(3);
  let s = sieh();
  assert.strictEqual(s.g, 'schwarm');
  assert.strictEqual(s.pre, 'boss_nachhall_schwarm');
  assert.ok(s.tex.indexOf('boss_nachhall_schwarm_') === 0, s.tex);
  assert.ok(s.an.includes('gesichterSchwarm'), s.an.join());
  H.run(`(function () { var b = ${BOSS}; b.hp = Math.floor(b.maxHp * 0.3); })()`);
  H.step(3);
  s = sieh();
  assert.strictEqual(s.g, 'chor');
  assert.ok(s.an.includes('chorRuf'), s.an.join());
  assert.strictEqual(s.echos, 2, 'der Chor ruft keine zwei Echos');
});

/** Takten, bis n Fluestern gesagt sind (oder Abbruch). */
function fluesternBis(n) {
  for (let i = 0; i < 120; i++) {
    if (H.run(`${BOSS}._nachhall.gesagt.length`) >= n) break;
    H.step(15);
  }
  return H.run(`${BOSS}._nachhall.gesagt.slice()`);
}

test('Er fluestert aus dem Gespielten, die eigene Stimme mit "Wer du warst"', () => {
  stand({ was_der_rauch_behaelt: AUFTRAG_AKTIV, who_you_were: ERLEDIGT, council_seizure: ERLEDIGT },
    { namen_abgeliefert: true, self_remembered: true });
  L.spawnBoss();
  ruhig();
  const gesagt = fluesternBis(N.EIGEN_ALS);
  assert.ok(gesagt.length >= N.EIGEN_ALS, 'zu wenig gefluestert: ' + gesagt.length);
  assert.strictEqual(gesagt[N.EIGEN_ALS - 1].art, 'eigen', JSON.stringify(gesagt));
  assert.strictEqual(gesagt.filter((g) => g.art === 'eigen').length, 1);
  const pool = H.run(`${BOSS}._nachhall.pool.map(function (p) { return p.quelle; })`);
  assert.ok(pool.includes('liste') && pool.includes('gesuch') && pool.some((q) => /^auftrag:/.test(q)),
    'Pool zieht nicht aus dem Gespielten: ' + pool.join(','));
  // Die eigene Stimme steht sichtbar und anders gefaerbt (gleich nach dem Fluestern).
  const farbe = H.run(`(function () {
    var t = window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'nachhallEigen'; })[0];
    return t ? t.style.color : null; })()`);
  assert.strictEqual(farbe, '#ffd166');
});

test('Ohne "Wer du warst" keine eigene Stimme', () => {
  L.spawnBoss();
  ruhig();
  const gesagt = fluesternBis(N.EIGEN_ALS + 3);
  assert.ok(gesagt.length >= N.EIGEN_ALS + 1);
  assert.ok(!gesagt.some((g) => g.art === 'eigen'), JSON.stringify(gesagt));
  assert.ok(!H.run(`${BOSS}._nachhall.pool.some(function (p) { return p.art === 'eigen'; })`));
});

test('Bruchstuecke, die leben bleiben, kehren in ihn zurueck und heilen ihn', () => {
  L.spawnBoss();
  ruhig();
  H.run(`(function () {
    var b = ${BOSS};
    b.hp = Math.floor(b.maxHp * 0.7);
    BOSS_ATTACK_MAP.bruchstuecke.call(window.game.scene.getScene('GameScene'), b);
  })()`);
  H.step(60);
  const vorher = H.run(`(function () { var b = ${BOSS};
    return { hp: b.hp, n: b._nachhall.stuecke.filter(function (e) { return e.active; }).length }; })()`);
  assert.ok(vorher.n >= 1, 'keine Bruchstuecke');
  for (let i = 0; i < 60 && H.run(`${BOSS}.hp`) <= vorher.hp; i++) H.step(15);
  const nachher = H.run(`${BOSS}.hp`);
  assert.ok(nachher > vorher.hp, 'nicht geheilt: ' + vorher.hp + ' -> ' + nachher);
});

test('Wer die Bruchstuecke faellt, dem heilt er nicht', () => {
  L.spawnBoss();
  ruhig();
  H.run(`(function () {
    var b = ${BOSS};
    b.hp = Math.floor(b.maxHp * 0.7);
    BOSS_ATTACK_MAP.bruchstuecke.call(window.game.scene.getScene('GameScene'), b);
  })()`);
  H.step(60);
  const hp = H.run(`(function () { var sc = window.game.scene.getScene('GameScene'); var b = ${BOSS};
    b._nachhall.stuecke.forEach(function (e) { if (e.active) { e.hp = 0; handleEnemyHit(sc, e, {}); } });
    return b.hp; })()`);
  H.step(600);
  assert.strictEqual(H.run(`${BOSS}.hp`), hp);
});

test('Nach dem Sieg bleiben Namen, der Auftrag ist erfuellt, Thom druckt sie', () => {
  stand({ was_der_rauch_behaelt: AUFTRAG_AKTIV }, { namen_abgeliefert: true });
  L.spawnBoss();
  ruhig();
  H.run(`(function () { var sc = window.game.scene.getScene('GameScene'); var b = ${BOSS};
    b.hp = 0; handleEnemyHit(sc, b, {}); })()`);
  H.step(3);
  const r = H.run(`(function () { var qs = window.questSystem;
    return { namen: qs.getNachhallNamen(), flag: qs.hasFlag('nachhall_verklungen'),
      bereit: qs.isQuestReadyToComplete('was_der_rauch_behaelt'),
      amBoden: window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'nachhallName'; }).map(function (o) { return o.text; }),
      steigen: window.game.scene.getScene('GameScene').children.list.filter(function (o) { return o.name === 'nachhallAufstieg'; }).length,
      epilog: window.QuestFinale.epilog(qs.getFlags(), 'de').join(' ') }; })()`);
  assert.ok(r.namen.length >= 1 && r.namen.length <= N.REST_NAMEN, JSON.stringify(r.namen));
  r.namen.forEach((n) => assert.ok(N.MARAS_LEUTE.concat(N.MARAS_LISTE).includes(n), n));
  assert.deepStrictEqual(r.amBoden.slice().sort(), r.namen.slice().sort(), 'die Namen am Boden sind andere');
  assert.ok(r.steigen > 0, 'die Stimmen steigen nicht auf');
  assert.strictEqual(r.flag, true);
  assert.strictEqual(r.bereit, true, 'der Auftrag ist nicht erfuellt');
  r.namen.forEach((n) => assert.ok(r.epilog.includes(n), 'Thom druckt ' + n + ' nicht'));
  // Der Spielstand traegt sie.
  const st = H.run('window.questSystem.getQuestSaveData().nachhallNamen');
  assert.deepStrictEqual(st, r.namen);
});

test('Ohne Nachhall-Namen bleibt der Epilog, wie er war', () => {
  stand({}, {});
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(!/Nachhall/.test(ep), ep);
});

test('Die Zwischenszene kennt den Nachhall (Siegel, Rede in beiden Sprachen)', () => {
  const r = H.run(`(function () { var Z = window.BossZwischenszene; var I = window.i18n;
    var lang = I.getLanguage(); var out = { cfg: Z.BOSSE.nachhall, de: [], en: [] };
    ['de', 'en'].forEach(function (l) { I.setLanguage(l);
      ['beiname', '1', '2'].forEach(function (k) { out[l].push(I.t('bossintro.nachhall.' + k)); });
      out[l].push(BOSS_DEFINITIONS.nachhall.name, BOSS_DEFINITIONS.nachhall.loreIntro); });
    I.setLanguage(lang); return out; })()`);
  assert.strictEqual(r.cfg.siegel, 'stimmen');
  assert.strictEqual(r.cfg.seiten, 2);
  assert.strictEqual(r.de[3], 'Der Nachhall');
  assert.strictEqual(r.en[3], 'The Echo');
  r.de.concat(r.en).forEach((t) => assert.ok(t && !/^bossintro\./.test(t) && !/MISSING/.test(t), t));
  assert.notStrictEqual(r.de[1], r.en[1]);
});

test('Jeder Angriff jeder Gestalt laeuft ohne Fehler, auch die Signatur', () => {
  L.spawnBoss();
  ruhig();
  const namen = Object.keys(N.GESTALTEN).reduce((a, g) => a.concat(N.GESTALTEN[g].angriffe), ['fluesterSturm']);
  const vorher = H.errors.filter((e) => e.level === 'error').length;
  H.run(`(function () { var b = ${BOSS}; b.hp = Math.floor(b.maxHp * 0.3); })()`);
  H.step(3);                                   // Chor: die Echos stehen
  for (const n of namen) {
    const ok = H.run(`(function () { var b = ${BOSS}; b.damage = 1;
      if (typeof BOSS_ATTACK_MAP['${n}'] !== 'function') return false;
      BOSS_ATTACK_MAP['${n}'].call(window.game.scene.getScene('GameScene'), b); b.nextPatternAt = 1e12; return true; })()`);
    assert.ok(ok, n + ' fehlt in BOSS_ATTACK_MAP');
    H.step(120);
  }
  const neu = H.errors.filter((e) => e.level === 'error').slice(vorher);
  assert.deepStrictEqual(neu.map((e) => e.msg), []);
  assert.strictEqual(H.run('BOSS_SIGNATURE.nachhall'), 'fluesterSturm');
});

// --- Der Nachhall der Esse ersetzt den Schattenrat ----------------------------

const QUELLE_AKTIV = { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] };

test('Tiefe 30 ohne laufende Quelle: der Nachhall der Esse, nie der Schattenrat', () => {
  const faelle = [
    ['ohne Auftraege', {}, {}],
    ['nach dem Ende', { schattenrat_finale: ERLEDIGT }, { story_ending: 'reckoning', elara_spared: true }],
    ['Die letzte Wache', { schattenrat_finale: ERLEDIGT, mara_assault: { status: 'active', objectives: [{ type: 'wave', target: 'reach_wave', current: 0, required: 30 }] } }, { elara_killed: true }],
    ['Quelle laeuft, Elara schon entschieden', { schattenrat_finale: QUELLE_AKTIV }, { elara_spared: true }]
  ];
  for (const [name, quests, flags] of faelle) {
    for (const tiefe of [30, 60]) {
      L.clearEnemies();
      stand(quests, flags);
      L.setDepth(tiefe, tiefe);
      assert.strictEqual(klimax(), 'nachhallEsse', name + ', Tiefe ' + tiefe);
    }
  }
});

test('Solange die Quelle laeuft, wartet auf Tiefe 30 weiter Elara', () => {
  stand({ schattenrat_finale: QUELLE_AKTIV }, { harren_dead: true });
  L.setDepth(30, 30);
  assert.strictEqual(klimax(), 'elaraBesessen');
});

test('Der Nachhall der Esse: dieselbe Mechanik, groesser und haerter', () => {
  L.setDepth(30, 30);
  stand({}, {});
  const b = L.spawnBoss();
  assert.strictEqual(b.type, 'nachhallEsse');
  const r = H.run(`(function () { var b = ${BOSS};
    return { n: !!b._nachhall, g: b._nachhall.gestalt, h: Math.round(b._hitHalfH * 2), an: b.bossAttacks.slice() }; })()`);
  assert.ok(r.n && r.g === 'hall', 'ohne Nachhall-Mechanik');
  assert.ok(r.h >= 160 && r.h < 283, 'Figur ' + r.h + ' px');
  ruhig();
  H.run(`(function () { var b = ${BOSS}; b.hp = Math.floor(b.maxHp * 0.3); })()`);
  H.step(3);
  assert.strictEqual(H.run(`${BOSS}._nachhall.gestalt`), 'chor');
  const klein = H.run('Math.ceil(BOSS_DEFINITIONS.nachhall.baseHP * 3.4)');
  assert.ok(b.maxHp > klein, 'nicht haerter als der Nachhall: ' + b.maxHp);
});

test('Kein Schattenrat mehr sichtbar: Definition, Rede und Texte sind fort', () => {
  const r = H.run(`(function () {
    var I = window.i18n, out = { def: typeof BOSS_DEFINITIONS.shadowCouncillor, treffer: [], namen: [] };
    Object.keys(BOSS_DEFINITIONS).forEach(function (k) { out.namen.push(BOSS_DEFINITIONS[k].name); });
    ['de', 'en'].forEach(function (l) {
      I._keys(l).forEach(function (k) {
        if (!/^(boss|bossintro)\\./.test(k)) return;
        var v = String(I._wert(l, k));
        if (/shadowCouncillor/.test(k) || /Schattenrat|Shadow Councillor|beiden Seiten|both sides/i.test(v)) out.treffer.push(l + ':' + k + '=' + v);
      });
    });
    out.zwischenszene = Object.keys(window.BossZwischenszene.BOSSE);
    return out; })()`);
  assert.strictEqual(r.def, 'undefined');
  assert.strictEqual(r.treffer.length, 0, r.treffer.join(' | '));
  assert.ok(!r.namen.some((n) => /Schattenrat|Shadow Councillor/.test(n)), r.namen.join());
  assert.ok(!r.zwischenszene.includes('shadowCouncillor'));
  assert.ok(r.zwischenszene.includes('nachhallEsse'));
});

test('Alte Spielstaende mit dem Schattenrat stuerzen nicht ab', () => {
  stand({}, { bossintro_shadowCouncillor: true });
  const r = H.run(`(function () {
    var Z = window.BossZwischenszene;
    return { soll: Z.soll({ id: 'shadowCouncillor', name: 'x' }), def: BOSS_DEFINITIONS.shadowCouncillor === undefined };
  })()`);
  assert.strictEqual(r.soll, false);
  assert.strictEqual(r.def, true);
  L.setDepth(30, 30);
  assert.strictEqual(klimax(), 'nachhallEsse');
});
