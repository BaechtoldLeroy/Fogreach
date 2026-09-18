// tests/zeichenKlinge.test.js — das Zeichen des Schattenrats auf Elaras Klinge (#156).
//
// Story-Bibel v5, Abschnitt 5: Statt der Blaetter-Mechanik gibt es EIN
// Zeichen, das der Spieler wiedererkennt — drei Ketten, ineinander
// verschlungen. Auf Elaras Klinge ist es nahe am Heft eingraviert. Wer es
// vorher auf den Siegeln der geheimen Sitzung gesehen hat, erkennt es; das
// setzt zeichen_bemerkt, und im Finale gilt der Verrat als vorhergesehen.
//
// Geprueft ueber window.formatItemTooltip — dieselbe Formatierung, die
// Inventar und Truhe beim Hinsehen benutzen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

const KLINGE = "({ type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', rarity: 'legendary', rarityValue: 4, damage: 7, speed: 1.3, range: 120, crit: 0.15 })";

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests || {})};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}

test('Die Klinge traegt die Gravur', () => {
  stand({});
  const r = H.run(`(function () {
    if (typeof window.formatItemTooltip !== 'function') return { fehler: 'formatItemTooltip fehlt' };
    return { body: window.formatItemTooltip(${KLINGE}).body };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(/drei Ketten/.test(r.body), 'keine Gravur im Tooltip: ' + r.body);
});

test('Ohne die geheime Sitzung erkennt man das Zeichen nicht', () => {
  stand({});
  const r = H.run(`(function () {
    var body = window.formatItemTooltip(${KLINGE}).body;
    return { body: body, flag: window.questSystem.hasFlag('zeichen_bemerkt') };
  })()`);
  assert.ok(!/geheimen Sitzung/.test(r.body), 'man erkennt ein Zeichen, das man nie gesehen hat');
  assert.strictEqual(r.flag, false, 'zeichen_bemerkt ohne die Sitzung gesetzt');
});

test('Nach der Sitzung erkennt man es — und der Verrat gilt als vorhergesehen', () => {
  stand({ council_collusion_reveal: { status: 'completed', objectives: [] } });
  const r = H.run(`(function () {
    var body = window.formatItemTooltip(${KLINGE}).body;
    var flags = window.questSystem.getFlags();
    return { body: body, flag: !!flags.zeichen_bemerkt,
             regler: window.QuestFinale.computeFinaleState(flags).betrayalForeseen };
  })()`);
  assert.ok(/geheimen Sitzung/.test(r.body), 'das Zeichen wird nicht erkannt: ' + r.body);
  assert.strictEqual(r.flag, true, 'zeichen_bemerkt wurde nicht gesetzt');
  assert.strictEqual(r.regler, true, 'der Finale-Regler "Verrat vorhergesehen" bleibt aus');
});

test('Andere Stuecke tragen keine Gravur', () => {
  const r = H.run(`(function () {
    var it = window.LootSystem.rollItem(null, 5, 2);
    return window.formatItemTooltip(it).body;
  })()`);
  assert.ok(!/drei Ketten|eingraviert/.test(r), 'ein gewoehnliches Stueck traegt die Gravur');
});
