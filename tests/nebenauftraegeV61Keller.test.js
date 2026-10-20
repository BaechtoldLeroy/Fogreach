// tests/nebenauftraegeV61Keller.test.js — die Nebenauftraege der Akte 3/4
// (Story-Kern v6.1), der Teil unten im Keller. Jeder Fortschritt wird ueber
// den Weg des Spiels ausgeloest, nicht ueber updateQuestProgress:
//
//   * Die schweigenden Brueder: Beschwoerer toeten (dealDamageToEnemy +
//     handleEnemyHit, wie ein Treffer), kill:typ_13. Andere Typen zaehlen
//     nicht, ein zurueckgekehrter Vergessener auch nicht. Solange der Auftrag
//     laeuft, kommen Beschwoerer auf Tiefe 15-19 deutlich oefter.
//   * Ein Name auf dem Helm: die Helmmarke faellt nur von Elites (spawnLoot
//     beim Tod), aufgesammelt ueber collectLoot.
//   * Kreide an der Zellenwand: der Raumaufbau (enterRoom) stellt ein Zeichen
//     hin, [E] liest es; der zweite Satz nennt Oda Kessler, wenn gewarnt.
//   * Die Hand am Schloss: das Kettenschloss-Ereignis, [E] am Schloss, nur
//     ganz geloest zaehlt; das Ereignis kommt haeufiger. Elara bietet den
//     Auftrag im Keller an und nimmt ihn ab.
//   * Die letzte Fuhre / Die Schmiede halten: Jagd und Verteidigung im
//     echten Raum-Modus gewinnen (raum:hunt, raum:defend); beide Modi kommen
//     haeufiger, solange der Auftrag laeuft.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GS = `window.game.scene.getScene('GameScene')`;
let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 20 });
  L = H.lab;
  H.run(`window.__echtRandom = Math.random; window.__echtDialog = window.EventSystem.showEventChoiceDialog;
    window.__echtSpiele = window.Kettenschloss && window.Kettenschloss.spiele;`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`Math.random = window.__echtRandom; window.EventSystem.showEventChoiceDialog = window.__echtDialog;
    if (window.Kettenschloss) window.Kettenschloss.spiele = window.__echtSpiele;
    window.eventChoiceOpen = false; window._playerInvincible = true;`);
  L.clearEnemies();
  L.healPlayer();
});

/** Quest-Stand und Akt; die Tiefe des Laufs setzt der Fall selbst. */
function stand(akt, eintraege, flags) {
  H.run(`(function () {
    window.storySystem.loadStorySaveData({ currentActIndex: ${akt},
      eventsSeen: ['auftrag', 'treuer_diener', 'erste_risse', 'wahrheit', 'bruch'] });
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '30');
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = ${JSON.stringify(flags || {})};
    var e = ${JSON.stringify(eintraege)};
    Object.keys(e).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id];
      var v = e[id];
      st.quests[id] = { status: v === 'completed' ? 'completed' : 'active', abTiefe: d.minDepth == null ? null : d.minDepth,
        objectives: d.objectives.map(function (o) {
          return { type: o.type, target: o.target, current: v === 'active' ? 0 : o.required, required: o.required }; }) };
    });
    qs.loadQuestSaveData(st);
    return true;
  })()`);
}

const ziel = (id) => H.run(`(function () { var q = window.questSystem.getActiveQuests().filter(function (x) { return x.id === '${id}'; })[0];
  return q ? q.objectives[0].current : null; })()`);

/** Ein Gegner faellt so, wie ein Treffer ihn faellt. */
function toeten(ref) {
  H.run(`(function () { var sc = ${GS}, e = window.__lab.refs[${ref}];
    if (!e || !e.active) return; e.hp = 1; dealDamageToEnemy(sc, e, 999, 'attack', {}); handleEnemyHit(sc, e, {}); })()`);
}

// --- Die schweigenden Brueder ---------------------------------------------------

test('Brueder: Beschwoerer toeten zaehlt, andere Typen und Vergessene nicht', () => {
  L.setDepth(15, 15);
  stand(3, { klerus_district_purge: 'completed', klerus_brueder: 'active' });
  const kultist = L.spawnEnemy(4, 200, 0);
  toeten(kultist);
  assert.strictEqual(ziel('klerus_brueder'), 0, 'ein Kultist zaehlt als Beschwoerer');
  const vergessen = L.spawnEnemy(13, 200, 0);
  H.run(`window.__lab.refs[${vergessen}]._vergessen = true`);
  toeten(vergessen);
  assert.strictEqual(ziel('klerus_brueder'), 0, 'ein zurueckgekehrter Vergessener zaehlt mit');
  for (let i = 0; i < 3; i++) {
    const b = L.spawnEnemy(13, 200, 0);
    assert.strictEqual(H.run(`window.__lab.refs[${b}].enemyType`), 13);
    toeten(b);
    assert.strictEqual(ziel('klerus_brueder'), i + 1, 'Beschwoerer ' + (i + 1) + ' zaehlt nicht');
  }
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('klerus_brueder')`), true);
});

test('Brueder: unterhalb von Tiefe 15 zaehlt kein Beschwoerer', () => {
  L.setDepth(14, 14);
  stand(3, { klerus_district_purge: 'completed', klerus_brueder: 'active' });
  toeten(L.spawnEnemy(13, 200, 0));
  assert.strictEqual(ziel('klerus_brueder'), 0);
});

/** Anteil der Beschwoerer an 400 frei gewuerfelten Gegnern. */
function beschwoererAnteil(tiefe) {
  L.setDepth(tiefe, tiefe);
  return H.run(`(function () {
    var sc = ${GS}, n = 0, b = 0;
    for (var i = 0; i < 400; i++) {
      var e = spawnEnemy.call(sc, 0, 0);
      if (!e) continue;
      n++; if (e.enemyType === 13) b++;
      e.destroy();
    }
    return b / Math.max(1, n);
  })()`);
}

test('Brueder: solange der Auftrag laeuft, kommen Beschwoerer auf Tiefe 15-19 oft genug', () => {
  stand(3, { klerus_district_purge: 'completed' });
  const ohne = beschwoererAnteil(17);
  stand(3, { klerus_district_purge: 'completed', klerus_brueder: 'active' });
  const mit15 = beschwoererAnteil(15);
  const mit19 = beschwoererAnteil(19);
  assert.ok(ohne < 0.13, 'Grundzustand verschoben: ' + ohne);
  assert.ok(mit15 >= 0.18 && mit19 >= 0.18, 'zu selten mit Auftrag: T15 ' + mit15 + ', T19 ' + mit19);
  assert.ok(mit15 >= ohne * 2, 'der Schub bleibt aus: ' + ohne + ' -> ' + mit15);
  // Erfuellt: kein Schub mehr.
  stand(3, { klerus_district_purge: 'completed', klerus_brueder: 'ready' });
  assert.ok(beschwoererAnteil(17) < 0.13, 'der Schub laeuft nach dem Ziel weiter');
});

// --- Ein Name auf dem Helm ------------------------------------------------------

/** Gegner fallen lassen und die liegende Helmmarke suchen (Math.random fest). */
function helmFall(elite) {
  L.setDepth(24, 24);
  // Ein Brute ohne Affixe: Affixe (Ausweichen, Schild) machen den Tod vom
  // festgehaltenen Zufall abhaengig. Fuer die Beute zaehlt nur isElite.
  const ref = L.spawnEnemy(3, 200, 0);
  if (elite) H.run(`window.__lab.refs[${ref}].isElite = true`);
  H.run(`(function () { var lg = window.lootGroup || lootGroup; lg.getChildren().slice().forEach(function (l) { l.destroy(); }); })()`);
  H.run('Math.random = function () { return 0.01; }');
  try { toeten(ref); } finally { H.run('Math.random = window.__echtRandom'); }
  return H.run(`(function () {
    var lg = window.lootGroup || lootGroup;
    var m = lg.getChildren().filter(function (l) { var it = l.getData && l.getData('item'); return it && it.questTarget === 'helmmarke'; })[0];
    if (!m) return { da: false };
    collectLoot.call(${GS}, player, m);
    return { da: true };
  })()`);
}

test('Helm: die Marke faellt von einem Elite und zaehlt beim Aufheben', () => {
  stand(3, { wache_helm: 'active' }, { enttarnt: true });
  const r = helmFall(true);
  assert.strictEqual(r.da, true, 'keine Helmmarke vom Elite');
  assert.strictEqual(ziel('wache_helm'), 1);
});

test('Helm: ein gewoehnlicher Gegner traegt keine Marke', () => {
  stand(3, { wache_helm: 'active' }, { enttarnt: true });
  const r = helmFall(false);
  assert.strictEqual(r.da, false, 'Helmmarke von einem gewoehnlichen Gegner');
  assert.strictEqual(ziel('wache_helm'), 0);
});

// --- Kreide an der Zellenwand ---------------------------------------------------

let raumNr = 1;
/** Raum aufbauen (wie beim Betreten), das Kreidezeichen suchen, [E] druecken. */
function kreideLesen() {
  H.run(`window.Kreidezeichen.CHANCE = 1; window.__kreideText = null;
    window.EventSystem.showEventChoiceDialog = function (sc, text, wahl) { window.__kreideText = text; };`);
  try {
    H.run(`enterRoom(${GS}, ${raumNr++})`);
    H.step(2);
    const da = H.run(`(function () {
      var o = ${GS}.children.list.filter(function (x) { return x.texture && x.texture.key === 'evt_kreide' && x.active; })[0];
      if (!o) return false;
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      player.body.reset(o.x + 30, o.y);
      return true;
    })()`);
    if (!da) return { da: false };
    H.step(2);
    H.input.interact();
    H.step(3);
    H.input.releaseAll();
    return { da: true, text: H.run('window.__kreideText') };
  } finally {
    H.run(`window.Kreidezeichen.CHANCE = 0.5; window.EventSystem.showEventChoiceDialog = window.__echtDialog;`);
  }
}

test('Kreide: der Raum stellt ein Zeichen hin, [E] liest es, drei Saetze in Folge', () => {
  L.setDepth(18, 18);
  stand(3, { mara_warning: 'completed', mara_kreide: 'active' });
  const gelesen = [];
  for (let i = 0; i < 3; i++) {
    const r = kreideLesen();
    assert.strictEqual(r.da, true, 'Raum ' + i + ': kein Kreidezeichen');
    assert.ok(r.text, 'Raum ' + i + ': [E] liest nichts');
    gelesen.push(r.text);
    assert.strictEqual(ziel('mara_kreide'), i + 1);
  }
  assert.ok(/Der Treffpunkt war verraten. Nur sieben wussten ihn./.test(gelesen[0]), gelesen[0]);
  assert.ok(!/Oda Kessler/.test(gelesen.join(' ')), 'Oda Kessler ohne Warnung');
  // Erfuellt: kein weiteres Zeichen.
  assert.strictEqual(kreideLesen().da, false, 'Zeichen nach erfuelltem Auftrag');
});

test('Kreide: wer Maras Liste gewarnt hat, liest Oda Kessler', () => {
  L.setDepth(18, 18);
  stand(3, { mara_warning: 'completed', mara_kreide: 'active' }, { namen_gewarnt: true });
  kreideLesen();
  const zwei = kreideLesen();
  assert.ok(/Oda Kessler/.test(zwei.text), zwei.text);
});

test('Kreide: ohne Auftrag oder zu flach kein Zeichen', () => {
  L.setDepth(18, 18);
  stand(3, { mara_warning: 'completed' });
  assert.strictEqual(kreideLesen().da, false, 'Zeichen ohne Auftrag');
  L.setDepth(17, 17);
  stand(3, { mara_warning: 'completed', mara_kreide: 'active' });
  assert.strictEqual(kreideLesen().da, false, 'Zeichen unter Tiefe 18');
});

// --- Die Hand am Schloss ----------------------------------------------------------

/** Das Kettenschloss-Ereignis, [E] am Schloss, das Minispiel endet mit `erg`. */
function schlossFall(erg) {
  L.setDepth(21, 21);
  H.run(`(function () {
    window.Kettenschloss.spiele = function (sc, tiefe, fertig) { fertig(${JSON.stringify(erg)}); };
    var ev = window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'chain_lock'; })[0];
    ev.handler(${GS});
  })()`);
  const da = H.run(`(function () {
    var o = ${GS}.children.list.filter(function (x) { return x.texture && x.texture.key === 'evt_schloss' && x.active; }).pop();
    if (!o) return false;
    player.body.reset(o.x + 30, o.y);
    return true;
  })()`);
  assert.ok(da, 'kein Schloss im Raum');
  H.step(2);
  H.input.interact();
  H.step(3);
  H.input.releaseAll();
}

test('Schloss: nur ganz geloest zaehlt fuer Elaras Uebung', () => {
  stand(3, { elara_ritual: 'completed', elara_schloesser: 'active' });
  schlossFall({ gesetzt: 2, anzahl: 3, geschafft: false, verloren: false });
  assert.strictEqual(ziel('elara_schloesser'), 0, 'ein halbes Schloss zaehlt');
  schlossFall({ gesetzt: 3, anzahl: 3, geschafft: true, verloren: true });
  assert.strictEqual(ziel('elara_schloesser'), 0, 'ein gebrochener Dietrich zaehlt');
  schlossFall({ gesetzt: 3, anzahl: 3, geschafft: true, verloren: false });
  assert.strictEqual(ziel('elara_schloesser'), 1, 'ein ganz geloestes Schloss zaehlt nicht');
});

function schlossAnteil() {
  return H.run(`(function () {
    var sc = ${GS}, t = 0, N = 4000;
    for (var i = 0; i < N; i++) { var e = window.EventSystem.pickEvent(21, sc); if (e && e.id === 'chain_lock') t++; }
    return t / N;
  })()`);
}

test('Schloss: solange die Uebung laeuft, kommt das Kettenschloss oefter', () => {
  L.setDepth(21, 21);
  stand(3, { elara_ritual: 'completed' });
  const ohne = schlossAnteil();
  stand(3, { elara_ritual: 'completed', elara_schloesser: 'active' });
  const mit = schlossAnteil();
  assert.ok(mit >= ohne * 3, 'der Schub bleibt aus: ' + ohne + ' -> ' + mit);
  assert.ok(mit < 0.5, 'das Schloss verdraengt alles andere: ' + mit);
});

test('Elara bietet die Uebung im Keller an und nimmt sie dort ab', () => {
  L.setDepth(21, 21);
  stand(3, { resistance_fetch_01: 'completed', widerstand_proof: 'completed', elara_meeting: 'completed',
    elara_ritual: 'completed', elara_blade: 'completed', elara_second_truth: 'completed' }, { elaraMet: true });
  const fall = () => H.run(`(function () {
    var sc = ${GS}, orig = window._spawnElaraSprite, gefunden = null;
    window._spawnElaraSprite = function (s, stage) { gefunden = stage; };
    try { for (var r = 1; r < 40 && !gefunden; r++) _elaraSpaetereAuftraege(sc, r); }
    finally { window._spawnElaraSprite = orig; }
    if (!gefunden) return null;
    var text = null;
    window.EventSystem.showEventChoiceDialog = function (s, t, wahl) { if (text === null) { text = t; wahl[0].callback(); } };
    _showElaraDialog(sc, gefunden);
    return { id: gefunden.id, modus: gefunden.modus, text: text };
  })()`);
  const an = fall();
  assert.ok(an, 'Elara erscheint nicht');
  assert.strictEqual(an.id, 'elara_schloesser');
  assert.strictEqual(an.modus, 'angebot');
  assert.ok(/Die Esse hält eine Bindung wie ein Schloss/.test(an.text), an.text);
  assert.strictEqual(ziel('elara_schloesser'), 0, 'nicht angenommen');
  // Drei Schloesser ganz geloest, dann die Abgabe bei ihr.
  for (let i = 0; i < 3; i++) schlossFall({ gesetzt: 3, anzahl: 3, geschafft: true, verloren: false });
  const ab = fall();
  assert.strictEqual(ab && ab.modus, 'abgabe');
  assert.ok(/Am Ende ist es dieselbe Drehung, nur grösser./.test(ab.text), ab.text);
  assert.strictEqual(H.run(`window.questSystem.getFlags().drehung_geuebt`), true);
});

// --- Die letzte Fuhre / Die Schmiede halten ----------------------------------------

/** Ein Jagdraum: Rudel steht, der Spieler sieht es, der Rudelfuehrer faellt. */
function jagdGewinnen() {
  L.setDepth(28, 28);
  L.clearEnemies();
  for (let i = 0; i < 4; i++) L.spawnEnemy(3, 120 + i * 30, 40);
  assert.strictEqual(H.run(`window.RoomMode.beginRoom(${GS}, { modus: 'hunt', roomIndex: 3, depth: 28 })`), 'hunt');
  let ref = null;
  for (let r = 0; r < 40 && ref === null; r++) {
    H.run(`(function () { var c = window.EliteEnemies.pickHuntTarget(window.enemies); if (c) player.body.reset(c.x + 30, c.y); })()`);
    H.step(5);
    ref = H.run(`(function () { var t = enemies.getChildren().filter(function (e) { return e && e.active && e.__huntTarget; })[0];
      if (!t) return null; window.__lab.refs.push(t); return window.__lab.refs.length - 1; })()`);
  }
  assert.notStrictEqual(ref, null, 'kein Rudelfuehrer');
  toeten(ref);
  for (let r = 0; r < 20 && !H.run('window.RoomMode.isObjectiveComplete()'); r++) H.step(5);
  assert.strictEqual(H.run('window.RoomMode.isObjectiveComplete()'), true, 'Jagd nicht abgeschlossen');
}

/** Ein Verteidigungsraum: Altar sehen, die Zeit ohne Gegner am Altar ueberstehen. */
function altarHalten() {
  L.setDepth(27, 27);
  L.clearEnemies();
  L.spawnEnemy(3, 300, 0);
  assert.strictEqual(H.run(`window.RoomMode.beginRoom(${GS}, { modus: 'defend', roomIndex: 3, depth: 27 })`), 'defend');
  for (let r = 0; r < 800 && !H.run('window.RoomMode.isObjectiveComplete()'); r++) {
    H.run(`(function () { var s = window.RoomMode.activeState(); if (s && (s.x || s.y)) player.body.reset(s.x + 40, s.y);
      if (window.RoomMode.isSpecialRoom()) enemies.getChildren().slice().forEach(function (e) { if (e) e.destroy(); }); })()`);
    H.step(10);
  }
  assert.strictEqual(H.run('window.RoomMode.isObjectiveComplete()'), true, 'Verteidigung nicht abgeschlossen');
  assert.strictEqual(H.run('window.RoomMode.objectiveFailed()'), false);
}

test('Fuhre: zwei gewonnene Jagdraeume machen den Auftrag fertig', () => {
  stand(4, { was_der_rauch_behaelt: 'completed', mara_letzte_fuhre: 'active', branka_schmiede_halten: 'active' });
  jagdGewinnen();
  assert.strictEqual(ziel('mara_letzte_fuhre'), 1);
  assert.strictEqual(ziel('branka_schmiede_halten'), 0, 'die Jagd zaehlt als Verteidigung');
  jagdGewinnen();
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_letzte_fuhre')`), true);
});

test('Schmiede: zwei gehaltene Altaere machen den Auftrag fertig', () => {
  stand(4, { bruch_confrontation: 'completed', branka_schmiede_halten: 'active', mara_letzte_fuhre: 'active' });
  altarHalten();
  assert.strictEqual(ziel('branka_schmiede_halten'), 1);
  assert.strictEqual(ziel('mara_letzte_fuhre'), 0, 'die Verteidigung zaehlt als Jagd');
  altarHalten();
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('branka_schmiede_halten')`), true);
});

function modusAnteil(modus) {
  return H.run(`(function () {
    var t = 0, N = 6000;
    for (var i = 0; i < N; i++) if (window.RoomMode.selectForRoom({ roomIndex: 3, depth: 28 }) === '${modus}') t++;
    return t / N;
  })()`);
}

test('Fuhre und Schmiede: ihre Raum-Modi kommen oefter, solange sie laufen', () => {
  L.setDepth(28, 28);
  stand(4, {});
  const jagdOhne = modusAnteil('hunt'), altarOhne = modusAnteil('defend');
  stand(4, { mara_letzte_fuhre: 'active' });
  const jagdMit = modusAnteil('hunt');
  stand(4, { branka_schmiede_halten: 'active' });
  const altarMit = modusAnteil('defend');
  assert.ok(jagdMit >= jagdOhne * 3, 'Jagd: ' + jagdOhne + ' -> ' + jagdMit);
  assert.ok(altarMit >= altarOhne * 3, 'Verteidigung: ' + altarOhne + ' -> ' + altarMit);
  assert.ok(jagdMit < 0.4 && altarMit < 0.4, 'zu viele Spezialraeume: ' + jagdMit + ' / ' + altarMit);
});
