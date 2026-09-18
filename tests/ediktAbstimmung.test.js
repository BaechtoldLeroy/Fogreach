// tests/ediktAbstimmung.test.js — Das Edikt der Woche als Abstimmung (#160).
//
// #150, Vorschlag 5: Die Buerger waehlen zwischen drei Edikten, der Spieler
// druckt und plakatiert sie. Egal welches gewinnt, die Patrouillen verdoppeln
// sich. Die Wahl faellt an der Anschlagtafel: welches Edikt ganz oben haengt —
// und genau das gewinnt. Am echten Hub.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const FERTIG = { status: 'completed', objectives: [] };

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(1);
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const hub = `window.game.scene.getScene('HubSceneV2')`;
const ziele = () => H.run(`(function () {
  var q = window.questSystem.getActiveQuests().filter(function (x) { return x.id === 'faction_campaign'; })[0];
  return q ? q.objectives.map(function (o) { return o.current; }).join(',') : null;
})()`);

test('Annehmen hakt nichts ab: drucken, aushaengen, auszaehlen', () => {
  stand({ harren_daughter_investigation: FERTIG, aldric_cleanup: FERTIG });
  const ok = H.run(`window.questSystem.acceptQuest('faction_campaign')`);
  assert.strictEqual(ok, true);
  assert.strictEqual(ziele(), '0,0,0');
  assert.strictEqual(H.run(`${hub}._ediktSchritt()`), 0);
});

test('In der Druckerei druckt Thom die drei Edikte', () => {
  const r = H.run(`(function () {
    var sc = ${hub};
    var seiten = null;
    var echt = sc._showDialoguePages;
    sc._showDialoguePages = function (npc, titel, p) { seiten = p; };
    try { sc._enterLocation({ target: 'druckerei', id: 'Druckerei' }); } finally { sc._showDialoguePages = echt; }
    sc._dialogOpen = false;
    return seiten ? { text: seiten[0].text, aktion: seiten[0].choices[0].action } : null;
  })()`);
  assert.ok(r, 'die Druckerei zeigt keinen Druckauftrag');
  assert.ok(/Dasselbe Papier/.test(r.text), 'das Papier kommt nicht vor: ' + r.text);
  assert.strictEqual(r.aktion, 'edikt_drucken');
  H.run(`(function () { var sc = ${hub}; sc._handleDialogueChoice('edikt_drucken', {}, '', [], 'flavor', null, 0, null); sc._dialogOpen = false; })()`);
  assert.strictEqual(ziele(), '1,0,0');
});

test('Die Anschlagtafel wird ansprechbar, und oben haengt, was Du waehlst', () => {
  const r = H.run(`(function () {
    var sc = ${hub};
    var p = sc._hubPhaseRefs.posterSpots[0];
    sc.player.setPosition(p.x, p.y - 30);
    sc._dialogOpen = false;
    sc.update(0, 16);
    var art = sc._activeInteractable && sc._activeInteractable.type;
    // Die Wahl: Klerus nach oben.
    var echt = window.DialogChoice.present;
    window.DialogChoice.present = function (s, cfg) {
      cfg.choices[1].setFlags.forEach(function (f) { window.questSystem.setFlag(f); });
      cfg.onResolved();
    };
    try { sc._handleInteract(); } finally { window.DialogChoice.present = echt; }
    return { art: art, offen: sc._dialogOpen };
  })()`);
  assert.strictEqual(r.art, 'anschlag', 'an der Tafel gibt es nichts zu tun');
  assert.strictEqual(r.offen, false);
  assert.strictEqual(ziele(), '1,1,0');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('edikt_klerus')`), true);
});

test('Ausgezaehlt wird erst nach dem naechsten Abstieg — gewonnen hat, was oben hing', async () => {
  // Ohne Abstieg: kein Ergebnis.
  H.run(`${hub}.scene.restart({})`);
  await H.waitForScene('HubSceneV2', { maxRounds: 100 });
  H.step(10);
  assert.strictEqual(ziele(), '1,1,0', 'ausgezaehlt, ohne dass eine Woche vergangen ist');

  H.run(`(function () {
    window.__hinweise = [];
    var echt = window.EventSystem.showEventToast;
    window.EventSystem.showEventToast = function (s, t) { window.__hinweise.push(String(t)); return echt.apply(this, arguments); };
    ${hub}.scene.restart({ gameState: { hubPhase: 0 } });
  })()`);
  await H.waitForScene('HubSceneV2', { maxRounds: 100 });
  H.step(10);
  assert.strictEqual(ziele(), '1,1,1', 'nach dem Abstieg nicht ausgezaehlt');
  const hinweise = H.run(`window.__hinweise`);
  assert.ok(hinweise.some((t) => /Edikt des Klerus hat gewonnen/.test(t)), JSON.stringify(hinweise));
});

test('Abgabe: die Patrouillen verdoppeln sich — im Hub stehen zwei Wachen mehr', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var fertig = qs.completeQuest('faction_campaign');
    var sc = ${hub};
    return { fertig: fertig, flag: qs.hasFlag('patrouillen_verdoppelt'), wachen: sc._patrouillenAufstellen(),
             text: qs.QUEST_DEFINITIONS.faction_campaign.dialogueComplete };
  })()`);
  assert.strictEqual(r.fertig, true);
  assert.strictEqual(r.flag, true);
  assert.strictEqual(r.wachen, 2, 'keine zusaetzlichen Wachen');
  assert.ok(/Patrouillen verdoppeln wir trotzdem/.test(r.text));
});

test('Danach oeffnet die Druckerei wieder ihr normales Menue', () => {
  const r = H.run(`(function () {
    var sc = ${hub};
    var gedruckt = false;
    var echt = sc._ediktDrucken;
    sc._ediktDrucken = function () { gedruckt = true; };
    try { sc._enterLocation({ target: 'druckerei', id: 'Druckerei' }); } finally { sc._ediktDrucken = echt; }
    try { sc._closeDialog(null); } catch (e) {}
    sc._dialogOpen = false;
    if (window.game.scene.isActive('PrintingHouseScene')) window.game.scene.stop('PrintingHouseScene');
    return gedruckt;
  })()`);
  assert.strictEqual(r, false, 'die Druckerei druckt weiter Edikte');
});

test('#145: Wer verweigert hat, traegt nach dem Abgeben nicht auch verification_sealed', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var st = qs.getQuestSaveData();
    st.quests = { magistrat_verification: { status: 'active', objectives: [{ type: 'fetch', target: 'verification_seal', current: 1, required: 1 }] } };
    st.flags = { verification_refused: true };
    qs.loadQuestSaveData(st);
    qs.completeQuest('magistrat_verification');
    return { sealed: qs.hasFlag('verification_sealed'), refused: qs.hasFlag('verification_refused') };
  })()`);
  assert.strictEqual(r.refused, true);
  assert.strictEqual(r.sealed, false, 'die Vorgabe setzt verification_sealed trotz Verweigerung');
});
