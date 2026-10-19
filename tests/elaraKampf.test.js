// tests/elaraKampf.test.js — der Kampf gegen die besessene Elara (Stufe 3).
//
// Story-Kern v6.1, Das Finale 4: "Sie löscht Teile der Arena, lässt Besiegte
// zurückkehren und greift nach Deiner Erinnerung. Je mehr Du im Spiel
// zurückgewonnen hast, desto mehr kann sie Dir nehmen. Was Du in «Wer du
// warst» zurückholst, gehört nicht dazu." (js/elaraKampf.js)
//
// Geprueft am laufenden Spiel, jeder Ausloeser auf seinem echten Weg: der
// Griff ueber seinen Takt, die Rueckgabe ueber handleEnemyHit, die Zonen ueber
// den Phasenwechsel der Boss-KI, die Echos ueber ihre Signatur.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;
const GSC = "window.game.scene.getScene('GameScene')";
const BOSS = 'enemies.getChildren().filter(function (x) { return x && x.isBoss && x.active; })[0]';

before(async () => {
  H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run('window._playerInvincible = true');
  L.clearEnemies();
  L.healPlayer();
  L.setDepth(30, 30);
  H.run('window.ElaraKampf.allesZurueck()');
  belegen(2);
  wissen(0, {});
});

/** Die letzte Quest laeuft, die Szene an der Esse ist gesehen (der Kampf beginnt sofort). */
function stand(flags, erledigt) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };
    ${(erledigt || []).map((id) => `st.quests['${id}'] = { status: 'completed', objectives: [] };`).join('\n')}
    st.flags = ${JSON.stringify(Object.assign({ harren_dead: true }, flags || {}))};
    qs.loadQuestSaveData(st);
  })()`);
}
/** n Faehigkeiten lernen und in Slot 1..n legen. */
function belegen(n) {
  H.run(`(function () {
    var AS = window.AbilitySystem;
    AS.SLOT_KEYS.forEach(function (s) { AS.setSlot(s, null); });
    AS.getAllAbilityDefs().slice(0, ${n}).forEach(function (d, i) { AS.learnAbility(d.id, { silent: true }); AS.setSlot('slot' + (i + 1), d.id); AS.resetCooldown(d.id); });
  })()`);
}
/** Wissensbaum: freie Fragmente und Raenge setzen (ueber den Spielstand des Baums). */
function wissen(fragmente, raenge) {
  H.run(`(function () {
    var KT = window.KnowledgeTree;
    (window.SlotStorage || localStorage).setItem(KT._STORAGE_KEY, JSON.stringify({ v: KT._SCHEMA_VERSION, version: KT._SCHEMA_VERSION,
      fragments: ${fragmente}, ranks: ${JSON.stringify(raenge)} }));
    KT._configureForTest({ storage: window.SlotStorage || localStorage, i18n: window.i18n, recalcDerived: window.recalcDerived });
  })()`);
}
function kampf(flags, erledigt) {
  stand(flags, erledigt);
  const b = L.spawnBoss();
  assert.strictEqual(b.type, 'elaraBesessen');
  H.run(`(function () { var b = ${BOSS}; b.speed = 0; b.damage = 1; b.nextPatternAt = 1e15; })()`);
  return b;
}
const k = (feld) => H.run(`(function () { var b = ${BOSS}; return b && b._elaraKampf ? b._elaraKampf.${feld} : null; })()`);
/** Den naechsten Griff gleich kommen lassen und ihn treffen lassen (Spieler bleibt stehen). */
function griffBisAufgeloest() {
  const vorher = H.run(`${BOSS}._elaraKampf.griffe`);
  // Der Spieler bleibt, wo er steht (dort ist sicher Boden): der Griff zielt auf ihn.
  H.run(`(function () { var b = ${BOSS}; b._elaraKampf.naechsterGriff = window.gameNow(${GSC}); })()`);
  for (let i = 0; i < 300; i++) {
    H.step(1);
    if (H.run(`(function () { var kk = ${BOSS}._elaraKampf; return kk.griffe > ${vorher} && !kk.griffLaeuft; })()`)) return true;
  }
  return false;
}
const gesperrt = () => H.run(`(function () { var AS = window.AbilitySystem, bel = AS.getActiveLoadout();
  return AS.SLOT_KEYS.filter(function (s) { return bel[s] && window.ElaraKampf.gesperrt(bel[s]); }); })()`);

// ------------------------------------------------------------- rein

test('Zurueckgewonnen: Fragmente und Raenge zaehlen, "Wer du warst" nicht', () => {
  const r = H.run(`(function () { var E = window.ElaraKampf;
    return [E.zurueckgewonnen({ fragmente: 2, raenge: { damage: 3, armor: 1 } }),
      E.zurueckgewonnen({ fragmente: 2, raenge: { damage: 3, armor: 1 }, werDuWarst: true }),
      E.zurueckgewonnen({ fragmente: 0, raenge: {}, werDuWarst: true }),
      E.kapazitaet(0), E.kapazitaet(5), E.kapazitaet(6), E.kapazitaet(15), E.kapazitaet(16), E.kapazitaet(99)]; })()`);
  assert.strictEqual(JSON.stringify(r), JSON.stringify([6, 5, 0, 1, 1, 2, 2, 3, 3]));
});

// ------------------------------------------------------------- Griff

test('Der Griff kommt angekuendigt: eine Sekunde Vorlauf, ein Kreis, ein Arm', () => {
  kampf();
  H.run(`(function () { var b = ${BOSS}; b._elaraKampf.naechsterGriff = window.gameNow(${GSC}); })()`);
  let start = null;
  for (let i = 0; i < 60 && start === null; i++) { H.step(1); if (k('griffLaeuft')) start = i; }
  assert.ok(start !== null, 'der Griff beginnt nicht ueber seinen Takt');
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('elaraGriffHinweis')`), true, 'kein Hinweis am Kreis');
  let dauer = 0;
  while (k('griffLaeuft') && dauer < 200) { H.step(1); dauer++; }
  // Vorlauf 0,8 bis 1,2 s (scene.time, 60 Bilder je Sekunde).
  assert.ok(dauer >= 48 && dauer <= 75, 'Vorlauf ' + dauer + ' Bilder');
});

test('Wer aus dem Kreis tritt, dem nimmt sie nichts', () => {
  kampf();
  H.run(`(function () { var b = ${BOSS}; b._elaraKampf.naechsterGriff = window.gameNow(${GSC}); })()`);
  for (let i = 0; i < 60 && !k('griffLaeuft'); i++) H.step(1);
  H.run('player.setPosition(player.x + 200, player.y); player.body.reset(player.x, player.y)');
  for (let i = 0; i < 120 && k('griffLaeuft'); i++) H.step(1);
  assert.strictEqual(gesperrt().length, 0, 'ausgewichen und trotzdem genommen');
  assert.strictEqual(k('verfehlt'), 1);
});

test('Sie nimmt eine Faehigkeit; die Leiste zeigt sie grau, die Anzeige nennt sie', () => {
  kampf();
  assert.ok(griffBisAufgeloest(), 'der Griff loest sich nicht auf');
  const g = gesperrt();
  assert.strictEqual(g.length, 1, 'nichts genommen: ' + JSON.stringify(g));
  H.step(10);   // die Anzeige zeichnet im Takt der Mechanik (100 ms)
  const r = H.run(`(function () {
    var AS = window.AbilitySystem, sc = ${GSC}, slot = '${g[0]}', id = AS.getActiveLoadout()[slot];
    var z = window.hudLeiste.zustand(slot, id, sc);
    var vor = AS.getCooldownRemaining(id, window.gameNow(sc));
    var feuert = AS.tryActivate(slot, sc);
    var anz = sc.children.getByName('elaraGenommen');
    var texte = [];
    (function lauf(o) { if (o.type === 'Text') texte.push(o.text); (o.list || []).forEach(lauf); })(anz);
    return { grau: z.gesperrt, genommen: !!z.genommen, feuert: feuert, anzeige: texte.join(' | ') };
  })()`);
  assert.strictEqual(r.grau, true, 'die Leiste zeigt die genommene Faehigkeit nicht grau');
  assert.strictEqual(r.feuert, false, 'die genommene Faehigkeit feuert trotzdem');
  assert.ok(/Genommen/.test(r.anzeige) && /3 Treffer/.test(r.anzeige), 'die Anzeige fehlt: ' + r.anzeige);
});

test('Wie viel sie halten kann, haengt am Zurueckgewonnenen', () => {
  belegen(4);
  // Wenig zurueckgewonnen: hoechstens eine.
  wissen(1, { damage: 2 });
  kampf();
  assert.strictEqual(k('kapazitaet'), 1);
  for (let i = 0; i < 3; i++) griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 1, 'mit 3 Fragmenten nimmt sie mehr als eine');
  L.clearEnemies();
  H.run('window.ElaraKampf.allesZurueck()');
  // Viel zurueckgewonnen: drei, nie alle vier.
  wissen(4, { damage: 5, armor: 5, speed: 5 });
  kampf();
  assert.strictEqual(k('kapazitaet'), 3);
  for (let i = 0; i < 5; i++) griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 3, 'mit 19 Fragmenten haelt sie nicht drei');
});

test('"Wer du warst" zaehlt nicht mit und haelt dem ersten Griff stand', () => {
  belegen(4);
  // 6 Fragmente: ohne "Wer du warst" Kapazitaet 2, mit (das eine Fragment abgezogen) 1.
  wissen(6, {});
  kampf();
  assert.strictEqual(k('kapazitaet'), 2);
  L.clearEnemies();
  kampf({ self_remembered: true }, ['who_you_were']);
  assert.strictEqual(k('kapazitaet'), 1, 'das Fragment aus "Wer du warst" gibt ihr mehr Griff');
  assert.strictEqual(k('werDuWarst'), true);
  griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 0, 'der erste Griff nimmt trotz gebundener Erinnerung');
  assert.strictEqual(k('gebundenGezeigt'), true);
  const r = H.run(`({ a: (${GSC}.children.getByName('elaraGebunden') || {}).text, b: (${GSC}.children.getByName('elaraGebundenSatz') || {}).text })`);
  assert.strictEqual(r.a, 'Wer Du warst');
  assert.strictEqual(r.b, 'Daran kommt sie nicht heran.');
  // Danach greift sie wie sonst.
  griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 1);
});

test('Ohne "Wer du warst" prallt kein Griff ab', () => {
  kampf();
  griffBisAufgeloest();
  assert.strictEqual(k('gebundenGezeigt'), false);
  assert.strictEqual(gesperrt().length, 1);
});

test('Drei Treffer auf sie holen das Genommene zurueck (handleEnemyHit)', () => {
  kampf();
  griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 1);
  const treffer = () => H.run(`(function () { var sc = ${GSC}, b = ${BOSS}; dealDamageToEnemy(sc, b, 1, 'attack', {}); handleEnemyHit(sc, b, {}); })()`);
  treffer(); treffer();
  assert.strictEqual(gesperrt().length, 1, 'schon nach zwei Treffern zurueck');
  assert.strictEqual(k('genommen')[0].rest, 1);
  treffer();
  assert.strictEqual(gesperrt().length, 0, 'nach drei Treffern nicht zurueck');
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('elaraZurueck')`), true, 'keine Rueckmeldung am Spieler');
});

/** Alles im Spielstand-Speicher als Liste "schluessel=wert". */
const speicher = () => H.run(`(function () { var alle = {};
  alle.faehigkeiten = (window.SlotStorage || localStorage).getItem('demonfall_abilities_v1');
  for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); alle[key] = localStorage.getItem(key); }
  return JSON.stringify(alle); })()`);

test('Nie dauerhaft: gespeichert wird nichts, mit dem Kampf kommt alles zurueck', () => {
  belegen(3);
  wissen(10, {});
  kampf();
  H.run('window.AbilitySystem.save()');
  const vorher = JSON.parse(speicher());
  griffBisAufgeloest(); griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 2);
  H.run('window.AbilitySystem.save()');
  const nachher = JSON.parse(speicher());
  // Die Belegung im Spielstand ist dieselbe; nirgends steht, was sie haelt.
  assert.ok(nachher.faehigkeiten, 'kein Faehigkeiten-Eintrag im Speicher gefunden');
  assert.strictEqual(nachher.faehigkeiten, vorher.faehigkeiten, 'die gespeicherte Belegung aendert sich durch den Griff');
  assert.ok(!/gesperrt|genommen|elaraKampf/.test(JSON.stringify(nachher)), 'die Sperre landet im Speicher');
  // Neu geladen (Laden aus dem Spielstand): die Belegung ist vollstaendig.
  const geladen = H.run(`(function () { var AS = window.AbilitySystem; AS.load(); var bel = AS.getActiveLoadout();
    return AS.SLOT_KEYS.filter(function (s) { return !!bel[s]; }).length; })()`);
  assert.strictEqual(geladen, 3);
  // Der Boss faellt (oder wird entfernt): alles zurueck.
  L.clearEnemies();
  assert.strictEqual(gesperrt().length, 0, 'nach dem Kampf bleibt etwas genommen');
});

test('Ein frisch geladenes Spiel kennt keine Sperre (das Modul beginnt leer)', () => {
  // Was ein Neuladen der Seite tut: js/elaraKampf.js laeuft von vorn.
  const vm = require('vm');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'elaraKampf.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const ids = H.run('window.AbilitySystem.getAllAbilityDefs().map(function (d) { return d.id; })');
  assert.ok(ids.length > 0);
  assert.strictEqual(ids.filter((id) => ctx.window.ElaraKampf.gesperrt(id)).length, 0);
});

// ------------------------------------------------------------- Arena

test('Die Arena verlischt: bei Phase 2 und 3 je zwei angekuendigte Zonen, die zehren', () => {
  kampf();
  assert.strictEqual(k('zonen').length, 0);
  H.run(`${BOSS}.hp = Math.ceil(${BOSS}.maxHp * 0.6)`);
  H.step(3);
  assert.strictEqual(H.run(`${BOSS}.phase`), 2);
  const zonen = () => H.run(`${BOSS}._elaraKampf.zonen.map(function (z) { return { x: z.x, y: z.y, r: z.r, aktiv: z.aktiv }; })`);
  let z = zonen();
  assert.strictEqual(z.length, 2, 'Phase 2 loescht nicht zwei Stellen');
  assert.ok(z.every((x) => !x.aktiv), 'die Zonen sind ohne Ankuendigung scharf');
  for (let i = 0; i < 90; i++) H.step(1);
  z = zonen();
  assert.ok(z.every((x) => x.aktiv), 'nach 1,1 s Vorlauf sind sie nicht scharf');
  // In der Zone zehrt es (auch durch die Unverwundbarkeit des Tests gemessen).
  H.run('window._playerInvincible = false; player.setPosition(' + z[0].x + ', ' + z[0].y + '); player.body.reset(player.x, player.y)');
  L.healPlayer();
  const lp = H.run('playerHealth');
  for (let i = 0; i < 70; i++) H.step(1);
  assert.ok(H.run('playerHealth') < lp, 'die geloeschte Zone zehrt nicht');
  H.run('window._playerInvincible = true');
  // Die Mitte (die Esse) bleibt frei.
  const mitte = H.run(`(function () { var g = ${GSC}._quelleGlow; return { x: g.x, y: g.y }; })()`);
  assert.ok(z.every((x) => Math.hypot(x.x - mitte.x, x.y - mitte.y) > x.r), 'eine Zone liegt auf der Esse');
  H.run(`${BOSS}.hp = Math.ceil(${BOSS}.maxHp * 0.3)`);
  H.step(3);
  assert.strictEqual(zonen().length, 4, 'Phase 3 loescht keine weiteren zwei');
  L.clearEnemies();
  assert.strictEqual(H.run(`${GSC}.children.list.filter(function (o) { return o.name === 'elaraZone' && o.active; }).length`), 0,
    'die Zonen bleiben nach dem Kampf liegen');
});

// ------------------------------------------------------------- Echos

test('Die Besiegten kehren zurueck: graue Echos, angekuendigt, hoechstens zwei', () => {
  kampf({ nachhall_verklungen: true });
  H.run(`BOSS_ATTACK_MAP.besiegteRufen.call(${GSC}, ${BOSS})`);
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('elaraEchoName')`), true, 'kein Name ueber dem Echo');
  assert.strictEqual(H.run(`enemies.getChildren().filter(function (e) { return e.active && e._elaraEcho; }).length`), 0,
    'das Echo steht ohne Vorlauf da');
  for (let i = 0; i < 80; i++) H.step(1);
  const echos = () => H.run(`enemies.getChildren().filter(function (e) { return e.active && e._elaraEcho; })
    .map(function (e) { return { art: e._elaraEcho, key: e.texture.key, tint: e.tintTopLeft, alpha: e.alpha, boss: !!e.isBoss, hp: e.hp }; })`);
  let e = echos();
  assert.strictEqual(e.length, 1);
  assert.ok(/^boss_(chain|ceremony|nachhall)_right0$/.test(e[0].key), 'kein Bild eines frueheren Bosses: ' + e[0].key);
  assert.strictEqual(e[0].tint, 0x8c8c9c, 'nicht grau');
  assert.ok(e[0].alpha < 0.8 && e[0].boss === false);
  H.run(`(function () { var b = ${BOSS}; b.phase = 3; for (var i = 0; i < 3; i++) { b._elaraKampf.letzteEchos = 0; BOSS_ATTACK_MAP.besiegteRufen.call(${GSC}, b); } })()`);
  for (let i = 0; i < 80; i++) H.step(1);
  e = echos();
  assert.strictEqual(e.length, 2, 'mehr als zwei Echos zugleich: ' + e.length);
  // Und nicht in Folge: hoechstens einmal je ECHO_PAUSE_MS.
  const vorher = H.run(`${BOSS}._elaraKampf.letzteEchos`);
  H.run(`(function () { var kk = ${BOSS}._elaraKampf; kk.echos = []; BOSS_ATTACK_MAP.besiegteRufen.call(${GSC}, ${BOSS}); })()`);
  assert.strictEqual(H.run(`${BOSS}._elaraKampf.letzteEchos`), vorher, 'sie ruft gleich wieder');
  assert.strictEqual(new Set(e.map((x) => x.art)).size, 2, 'zweimal dasselbe Echo');
  assert.deepStrictEqual(Array.from(H.run('window.ElaraKampf.echoArten({})')), ['kettenmeister', 'zeremonienmeister']);
  assert.ok(Array.from(H.run('window.ElaraKampf.echoArten({ nachhall_verklungen: true })')).indexOf('nachhall') >= 0);
  // Ab Phase 2 ist es ihre Signatur.
  assert.strictEqual(H.run(`BOSS_SIGNATURE.elaraBesessen`), 'besiegteRufen');
  L.clearEnemies();
  assert.strictEqual(echos().length, 0, 'die Echos ueberleben sie');
});

// ------------------------------------------------------------- Zeichen, Mara

test('Das Zeichen: sie beginnt bei 85 %, sichtbar am Ring der drei Ketten', () => {
  const ohne = kampf();
  L.clearEnemies();
  const mit = kampf({ zeichen_bemerkt: true });
  assert.strictEqual(mit.maxHp, ohne.maxHp);
  assert.ok(Math.abs(H.run(`${BOSS}.hp`) / ohne.hp - 0.85) < 0.01);
  for (let i = 0; i < 40; i++) H.step(1);
  assert.strictEqual(H.run(`(${GSC}.children.getByName('elaraZeichenText') || {}).text`), 'Das Zeichen der drei Ketten');
});

test('Mara hilft, wenn ihr Netz den Konvoi ueberstanden hat, und steht sichtbar am Rand', () => {
  kampf({ convoy_blown: true, convoy_blade_drawn: true });
  assert.strictEqual(H.run(`${BOSS}._maraHilft`), false, 'Mara hilft trotz verbranntem Netz');
  L.clearEnemies();
  H.run(`(function () { var m = ${GSC}.__maraFigur; if (m) m.destroy(); ${GSC}.__maraFigur = null; })()`);
  kampf({ convoy_silent: true });
  assert.strictEqual(H.run(`${BOSS}._maraHilft`), true);
  assert.strictEqual(H.run(`!!(${GSC}.__maraFigur && ${GSC}.__maraFigur.active && ${GSC}.__maraFigur.texture.key === 'spaeherin')`), true,
    'Mara steht nicht in der Arena');
  const vor = H.run(`${BOSS}.hp`);
  let nach = vor;
  for (let i = 0; i < 1200 && nach >= vor; i++) { H.step(10); nach = H.run(`${BOSS}.hp`); }
  assert.ok(nach < vor, 'Maras Pfeil trifft nicht');
});

// Zuletzt: Die Szene endet wirklich (Tod oder Rueckweg in den Hub laufen
// beide ueber das Ende der GameScene). Danach ist hier nichts mehr zu testen.
test('Tod oder Raumwechsel: endet die Szene, kommt alles zurueck', () => {
  kampf();
  griffBisAufgeloest();
  assert.strictEqual(gesperrt().length, 1);
  H.run(`${GSC}.scene.stop()`);
  H.step(3);
  assert.strictEqual(gesperrt().length, 0, 'nach dem Ende der Szene bleibt etwas genommen');
  assert.strictEqual(H.run(`(function () { var AS = window.AbilitySystem, bel = AS.getActiveLoadout();
    return AS.SLOT_KEYS.filter(function (s) { return bel[s]; }).every(function (s) { return !window.ElaraKampf.gesperrt(bel[s]); }); })()`), true);
});
