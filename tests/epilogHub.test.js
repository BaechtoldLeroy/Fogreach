// tests/epilogHub.test.js — der Hub im Epilog (#161).
//
// Story-Bibel v5, Abschnitt 11: "Zeigt die Phase epilogue, was die Bibel
// verspricht (duenner Nebel, Menschen, die auf Plaetzen vorlesen), und zeigt
// sie die Unterschiede aus Abschnitt 9?" Am echten Hub.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Epilog-Stand setzen und den Hub neu aufbauen. */
async function epilog(flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(4);
    var st = qs.getQuestSaveData();
    // Im Epilog ist alles erledigt — sonst bietet Branka noch einen Auftrag an.
    st.quests = {};
    Object.keys(qs.QUEST_DEFINITIONS).forEach(function (id) { st.quests[id] = { status: 'completed', objectives: [] }; });
    st.flags = ${JSON.stringify(Object.assign({ story_ending: true, harren_dead: true }, flags))};
    qs.loadQuestSaveData(st);
    window.game.scene.getScene('HubSceneV2').scene.restart({});
  })()`);
  await H.waitForScene('HubSceneV2', { maxRounds: 100 });
  H.step(10);
}
const hub = `window.game.scene.getScene('HubSceneV2')`;

test('Der Epilog hat duennen Nebel und Thoms Blaetter an den Tafeln', async () => {
  await epilog({});
  const r = H.run(`(function () {
    var s = window.HubPhase.PHASE_STYLE.epilogue;
    return { phase: ${hub}._hubPhase, fog: s.fog, posters: s.posters };
  })()`);
  assert.strictEqual(r.phase, 'epilogue');
  assert.ok(r.fog > 0 && r.fog < 0.12, 'kein duenner Nebel: ' + r.fog);
  assert.strictEqual(r.posters, 'gedruckt', 'an den Tafeln haengen keine gedruckten Blaetter');
});

test('Buerger lesen vor — so viele, wie zurueckkamen', async () => {
  await epilog({ petitions_kept: true });
  const viele = H.run(`${hub}._vorleser.length / 2`);
  await epilog({ petitions_surrendered: true });
  const wenige = H.run(`${hub}._vorleser.length / 2`);
  assert.strictEqual(viele, 3, 'Gesuche behalten: ' + viele + ' Vorleser');
  assert.strictEqual(wenige, 1, 'Gesuche abgeliefert: ' + wenige + ' Vorleser');
});

test('Vor dem Epilog liest niemand vor', async () => {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = {}; qs.loadQuestSaveData(st);
    window.storySystem.advanceToAct(1);
    ${hub}.scene.restart({});
  })()`);
  await H.waitForScene('HubSceneV2', { maxRounds: 100 });
  H.step(5);
  assert.strictEqual(H.run(`(${hub}._vorleser || []).length`), 0);
});

function maraSichtbar() {
  return H.run(`(function () {
    var sc = ${hub};
    sc._refreshNpcVisibility();
    var m = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    return m && m.sprite ? !!m.sprite.active : null;
  })()`);
}

test('Mara fehlt im Epilog, wenn ihr Netz am Konvoi verbrannt ist', async () => {
  await epilog({ convoy_blown: true, convoy_blade_drawn: true });
  assert.strictEqual(maraSichtbar(), false, 'Mara steht trotz verbranntem Netz auf dem Platz');
  await epilog({ convoy_silent: true });
  assert.strictEqual(maraSichtbar(), true, 'Mara fehlt, obwohl ihr Netz steht');
});

function zeilen(npcId) {
  return H.run(`(function () {
    var sc = ${hub};
    var seiten = null;
    var echt = sc._showDialoguePages;
    sc._showDialoguePages = function (npc, titel, p) { seiten = p; };
    try {
      var d = sc.npcs.filter(function (n) { return n.data && n.data.id === '${npcId}'; })[0].data;
      sc._dialogOpen = false;
      sc._showNpcDialogue(d);
    } finally { sc._showDialoguePages = echt; sc._dialogOpen = false; }
    return (seiten || []).map(function (p) { return p.text; }).join(' | ');
  })()`);
}

test('Branka spricht, wie die Geschichte fuer sie ausging', async () => {
  await epilog({ verification_refused: true });
  assert.ok(/Die Presse läuft seit drei Tagen/.test(zeilen('branka')), zeilen('branka'));
  await epilog({ verification_sealed: true });
  assert.ok(/Was davor war, vergesse ich nicht/.test(zeilen('branka')), zeilen('branka'));
});

test('Der lange Epilog blaettert, statt unten aus dem Bild zu laufen', () => {
  // Gemessen im Browser: der Epilog aus den Entscheidungen (sechs bis acht
  // Absaetze) lief unter den Bildrand, samt "Weiter" — der Spieler sass fest.
  const r = H.run(`(function () {
    var sc = ${hub};
    var flags = { story_ending: true, harren_dead: true, petitions_kept: true, convoy_blade_drawn: true,
                  convoy_blown: true, verification_refused: true, thom_ally: true, elara_spared: true };
    var NL2 = String.fromCharCode(10, 10);
    var text = window.QuestFinale.epilog(flags, 'de').join(NL2);
    var zu = false;
    var ov = window.storySystem.showStoryOverlay(sc, { actName: 'Epilog', actNumber: null, narrative: text }, function () { zu = true; });
    var h = sc.cameras.main.height;
    var texte = sc.children.list.filter(function (o) { return o.type === 'Container' && o.depth === 6001; })[0];
    var hinweis = texte.list.filter(function (o) { return o.text === 'Weiter [LEERTASTE]'; })[0];
    var erzaehl = texte.list.filter(function (o) { return o.type === 'Text' && o.style && o.style.wordWrapWidth === 500; })[0];
    var passt = true;
    for (var i = 0; i < ov.seiten.length; i++) {
      if (i > 0) ov.weiter();
      if (texte.y + erzaehl.y + erzaehl.height > texte.y + hinweis.y - 10) passt = false;
    }
    var vorher = zu;
    ov.weiter();
    return { seiten: ov.seiten.length, hinweisImBild: texte.y + hinweis.y < h, passt: passt, vorher: vorher, zu: zu,
             alles: ov.seiten.join(NL2) === text };
  })()`);
  assert.ok(r.seiten >= 2, 'der Epilog steht auf einer einzigen Seite: ' + r.seiten);
  assert.strictEqual(r.hinweisImBild, true, '"Weiter" liegt unter dem Bildrand');
  assert.strictEqual(r.passt, true, 'eine Seite laeuft in den Hinweis hinein');
  assert.strictEqual(r.alles, true, 'beim Aufteilen ging Text verloren');
  assert.strictEqual(r.vorher, false, 'das Overlay schloss vor der letzten Seite');
  assert.strictEqual(r.zu, true, 'nach der letzten Seite schliesst es nicht');
});
