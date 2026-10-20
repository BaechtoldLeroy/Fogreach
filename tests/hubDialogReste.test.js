// tests/hubDialogReste.test.js — Ein geschlossener Dialog kommt nicht wieder.
//
// Gemeldet (Leroy, im Spiel):
//   1) "Wenn bei Mara ein Quest angenommen wird, taucht der Dialog mit ihr
//      manchmal wieder auf, wenn das Rathaus betreten werden will oder mit
//      Aldric gesprochen wird."
//   2) "Nach dem Anbringen der Edikte an der Anschlagtafel kommt nochmals der
//      Dialog mit Aldric."
//   3) "Die NPCs sagen zu oft 'Dein Erfolg bei X hat mir Mut gemacht'."
//
// 1) und 2) hatten EINE Ursache: jede Dialogseite ohne Auswahl haengt einen
// Tipp-Hoerer an (input.once('pointerdown')). Er verfaellt nur, wenn
// wirklich getippt wird. Wer mit E, Leertaste oder Enter weiterblaettert,
// liess ihn liegen — gemerkt war nur der der NEUEN Seite, und nur den loeste
// _closeDialog. Der Rest feuerte beim naechsten Klick in irgendeinem Dialog
// (Aldric, Hinabstieg am Rathaus, die Edikt-Wahl an der Tafel) und blaetterte
// mit seiner alten Closure den alten Dialog wieder auf. An der Tafel
// zerstoerte er dabei das Wahl-Panel, bevor der Klick ankam: die Edikte
// hingen nicht, dafuer stand Aldric da.
//
// Gemessen wird am echten Hub: echte Tastenereignisse, echte Klickfolge
// (pointerdown in der Szene, pointerup auf der Schaltflaeche).

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;
const FERTIG = { status: 'completed', objectives: [] };

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(30);
  H.run(`(function () {
    var sc = ${hub};
    // Der Einfuehrungs-Splash haengt sonst ueber allem.
    sc.input.keyboard.emit('keydown-ESC', {});
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '6');
    // Jede Seite, die gezeigt wird — gleich, wer sie aufruft.
    window.__seiten = [];
    var echt = sc._showDialoguePages;
    sc._showDialoguePages = function (npc, t, p, m, q, i) {
      window.__seiten.push((npc && (npc.id || npc.name)) + '#' + i);
      return echt.apply(this, arguments);
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Questzustand und Akt setzen, Dialog zu, Seitenprotokoll leeren.
 * advanceToAct geht nur aufwaerts — darum erst auf Akt 0 zurueck. Die
 * Akt-Titelkarte, die der Sprung vormerkt, wird verworfen: sie oeffnete sich
 * sonst beim naechsten Schliessen eines Dialogs.
 */
function stand(quests, akt, flags) {
  H.run(`(function () {
    var sc = ${hub};
    try { sc._closeDialog(null); } catch (e) {}
    sc._dialogOpen = false;
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
    var ss = window.storySystem;
    ss.resetToAct0();
    ss.advanceToAct(${akt || 0});
    while (ss.consumePendingEvent()) {}
    window.__seiten = [];
  })()`);
  H.step(5);
}

function zuNpc(id) {
  H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data.id === '${id}'; })[0];
    sc.player.setPosition(n.data.x * SCALE_FACTOR, n.data.y * SCALE_FACTOR + 40);
  })()`);
  H.step(5);
}

function zuRathaus() {
  H.run(`(function () {
    var sc = ${hub};
    var e = sc.entranceLabels.filter(function (x) { return x.data.target === 'GameScene'; })[0];
    var b = e.zone.getBounds();
    sc.player.setPosition(b.centerX, b.bottom - 5);
  })()`);
  H.step(5);
}

const taste = (name) => { H.run(`${hub}.input.keyboard.emit('keydown-${name}', {})`); H.step(3); };
const offen = () => H.run(`${hub}._dialogOpen`);
const seiten = () => Array.from(H.run(`window.__seiten.slice()`));
const ziel = () => H.run(`(function () { var a = ${hub}._activeInteractable;
  return a ? a.type + ':' + (a.data ? (a.data.id || a.data.name) : '') : null; })()`);

/** Ein Klick mitten in einen offenen Dialog (Weiterblaettern per Maus/Finger). */
function klick() {
  H.run(`(function () { var sc = ${hub}; sc.input.emit('pointerdown', sc.input.activePointer, []); })()`);
  H.step(3);
}

/** Eine Wahl im DialogChoice-Panel, wie ein echter Klick: erst down, dann up. */
function wahl(i) {
  const n = H.run(`(function () {
    var sc = ${hub};
    var c = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer' && o.active; })[0];
    if (!c) return 0;
    // Die Wahl-Knoepfe (dialogChoiceKnopf), gleich wie tief sie liegen.
    var zonen = [];
    (function suchen(o) {
      (o.list || []).forEach(function (k) {
        if (k.name === 'dialogChoiceKnopf') zonen.push(k);
        suchen(k);
      });
    })(c);
    if (!zonen[${i}]) return 0;
    sc.input.emit('pointerdown', sc.input.activePointer, [zonen[${i}]]);
    // Hat der Klick das Panel abgeraeumt, kommt das pointerup nie an.
    if (zonen[${i}].active) zonen[${i}].emit('pointerup', sc.input.activePointer);
    return zonen.length;
  })()`);
  H.step(3);
  return n;
}
const panelOffen = () => H.run(`${hub}.children.list.some(function (o) { return o.name === 'dialogChoiceContainer' && o.active; })`);

/**
 * Den Dialog wie ein Tastatur-Spieler durchgehen: weiterblaettern mit
 * `weiter`, Story-Auswahlen per Klick, am Ende mit E annehmen (E liegt auf
 * der Hauptwahl). Liefert die Zahl der Seiten ohne Auswahl.
 */
function durchlesen(weiter) {
  for (let i = 0; i < 30 && offen(); i++) {
    if (panelOffen()) { wahl(0); continue; }
    const hatWahl = H.run(`!!(${hub}._currentKeyClosers || []).some(function (k) { return k.eventName === 'keydown'; })`);
    taste(hatWahl ? 'E' : weiter);
  }
  assert.strictEqual(offen(), false, 'der Dialog ging nicht zu');
}

const zeigerHoerer = () => H.run(`${hub}.input.listenerCount('pointerdown')`);

let grund = 0;
beforeEach(() => {
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG });
  grund = zeigerHoerer();
});

/**
 * Annehmen bei `npc`, danach ein Ziel ansprechen und hineinklicken.
 * Prueft: nur Seiten des Ziels erscheinen, nichts vom ersten NPC.
 */
function annehmenUndWeiter(npc, quest, weiter, danach) {
  zuNpc(npc);
  assert.strictEqual(ziel(), 'npc:' + npc, npc + ' ist nicht ansprechbar');
  taste('E');
  durchlesen(weiter);
  const gezeigt = seiten().filter((s) => s.indexOf(npc + '#') === 0).length;
  assert.ok(gezeigt >= 3, npc + ': zu wenige Seiten, der Test misst nichts (' + seiten().join(' ') + ')');
  assert.ok(H.run(`window.questSystem.getActiveQuests().some(function (q) { return q.id === '${quest}'; })`),
    quest + ' wurde nicht angenommen: ' + seiten().join(' '));
  assert.strictEqual(zeigerHoerer(), grund, npc + ': nach dem Schliessen haengen Tipp-Hoerer des Dialogs');

  H.run(`window.__seiten = []`);
  danach();
  // In aller Ruhe lesen, dann klicken.
  H.step(400);
  klick();
  const nachher = seiten();
  // Erlaubt sind nur Seiten von Aldric selbst — kein alter Dialog, gleich
  // von wem (an der Rathaustuer also gar keine).
  assert.deepStrictEqual(nachher.filter((s) => s.indexOf('aldric#') !== 0), [],
    'ein alter Dialog taucht wieder auf (' + npc + '): ' + nachher.join(' '));
}

test('Mara: Auftrag annehmen (E), dann E bei Aldric und klicken -> Aldric, nicht Mara', () => {
  // Nach einem Abschluss: Begruessung + Angebot + Annehmen.
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG });
  annehmenUndWeiter('mara', 'einfuehrung_amulett', 'E', () => {
    zuNpc('aldric');
    taste('E');
    assert.strictEqual(H.run(`${hub}._currentDialogNpc`), 'aldric');
  });
  assert.strictEqual(H.run(`${hub}._currentDialogNpc`), 'aldric', 'der Dialog gehoert nicht mehr Aldric');
});

test('Mara: Leertaste blaettert, E an der Rathaustuer und klicken -> Hinabstieg', () => {
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG });
  annehmenUndWeiter('mara', 'einfuehrung_amulett', 'SPACE', () => {
    zuRathaus();
    assert.strictEqual(ziel(), 'entrance:rathaus_entrance');
    taste('E');
    assert.strictEqual(offen(), true, 'der Hinabstieg-Dialog ging nicht auf');
  });
  // Der Hinabstieg steht noch — mit ESC zu.
  H.run(`${hub}.input.keyboard.emit('keydown', { code: 'Escape' })`);
  H.step(3);
  assert.strictEqual(offen(), false);
});

test('Mara: Enter blaettert, Tipp auf den mobilen [E]-Knopf bei Aldric -> Aldric', () => {
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG });
  annehmenUndWeiter('mara', 'einfuehrung_amulett', 'ENTER', () => {
    zuNpc('aldric');
    // Der [E]-Knopf oeffnet den Dialog IM pointerdown-Emit desselben Tipps.
    H.run(`(function () { var sc = ${hub}; sc._mobileInteractHandler();
      sc.input.emit('pointerdown', sc.input.activePointer, []); })()`);
    // Derselbe Tipp darf in Aldrics frischem Dialog nichts tun. Ein
    // liegengebliebener Hoerer Maras fing ihn ab und holte Aldrics Text
    // sofort zu Ende.
    assert.strictEqual(H.run(`${hub}._dialogTextLaeuft()`), true,
      'der [E]-Tipp wirkt in Aldrics Dialog weiter');
    H.step(3);
  });
  assert.strictEqual(H.run(`${hub}._currentDialogNpc`), 'aldric');
});

test('Die Story-Auswahl bei Mara erscheint nach dem Klick nicht noch einmal', () => {
  // Derselbe liegengebliebene Hoerer zeigte beim Klick auf die Antwort die
  // Auswahl erneut — die Wahl selbst kam nie an.
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG, einfuehrung_amulett: FERTIG }, 2);
  zuNpc('mara');
  taste('E');
  for (let i = 0; i < 6 && !panelOffen(); i++) taste('E');
  assert.ok(panelOffen(), 'keine Auswahl bei mara_contact');
  const vorher = seiten().length;
  // Die Auswahlseite ist die zuletzt gezeigte (ihr Index haengt davon ab, auf
  // wie viele Seiten der Angebotstext passt, seit b477 werden lange geteilt).
  const auswahlSeite = Number(seiten()[vorher - 1].split('#')[1]);
  wahl(0);
  const neu = seiten().slice(vorher);
  assert.strictEqual(panelOffen(), false, 'die Auswahl steht nach dem Klick wieder da: ' + neu.join(' '));
  // Die Antwortzeile wird hinter der Auswahlseite eingeschoben. Ein
  // liegengebliebener Hoerer zeigte stattdessen das Angebot erneut.
  assert.deepStrictEqual(Array.from(neu), ['mara#' + (auswahlSeite + 1)], 'nach der Wahl kam nicht die Antwortseite: ' + neu.join(' '));
  H.run(`${hub}._closeDialog(null)`);
});

/**
 * Ein Stand, in dem der NPC gerade einen Auftrag abgeschlossen hat und den
 * naechsten anbietet: [sein letzter Abschluss, weitere Abschluesse, Akt].
 * elara_ist_lene: sonst spielt bei Harren ab Akt 3 zuerst das Wiedersehen.
 */
const NPC_STAND = {
  branka: ['einfuehrung_schmiede', [], 2],
  thom: ['einfuehrung_presse', [], 3],
  harren: ['harren_daughter_investigation', ['mara_contact', 'espionage_convoy'], 3],
  aldric: ['aldric_patrol', ['harren_daughter_investigation'], 1]
};
function npcStand(npc) {
  const [letzter, weitere, akt] = NPC_STAND[npc];
  const q = { aldric_cleanup: FERTIG, aldric_patrol: FERTIG };
  [letzter].concat(weitere).forEach((id) => { q[id] = FERTIG; });
  stand(q, akt, { elara_ist_lene: true });
}

['branka', 'thom', 'harren'].forEach((npc) => {
  test(npc + ': Auftrag annehmen (Leertaste), dann E bei Aldric und klicken -> Aldric', () => {
    // Je ein frischer Abschluss davor, damit das Angebot mehrseitig ist.
    npcStand(npc);
    // Seit Stufe 1b kommt ein Story-Auftrag vor einem Nebenauftrag.
    const angebot = H.run(`(function () { var qs = window.questSystem, a = qs.getAvailableQuests('${npc}');
      return (a.filter(function (q) { return qs.istStoryAuftrag(q); })[0] || a[0] || {}).id; })()`);
    assert.ok(angebot, npc + ' bietet nichts an');
    annehmenUndWeiter(npc, angebot, 'SPACE', () => {
      zuNpc('aldric');
      taste('E');
    });
    assert.strictEqual(H.run(`${hub}._currentDialogNpc`), 'aldric');
  });
});

test('Edikte aushaengen: kein Aldric-Dialog, die Wahl kommt an', () => {
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, harren_daughter_investigation: FERTIG,
    einfuehrung_talente: FERTIG, magistrat_verification: FERTIG }, 1);
  zuNpc('aldric');
  assert.strictEqual(H.run(`window.questSystem.getAvailableQuests('aldric')[0].id`), 'faction_campaign');
  taste('E');
  durchlesen('E');
  assert.ok(H.run(`window.questSystem.getActiveQuests().some(function (q) { return q.id === 'faction_campaign'; })`));
  // Drucken bei Thom: Text zu Ende holen, dann E auf "Drucken".
  H.run(`${hub}._enterLocation({ target: 'druckerei', id: 'Druckerei' })`);
  H.step(3); taste('E'); taste('E');
  assert.strictEqual(H.run(`${hub}._ediktSchritt()`), 1, 'nicht gedruckt');
  H.run(`(function () { var sc = ${hub}; var p = sc._hubPhaseRefs.posterSpots[0]; sc.player.setPosition(p.x, p.y - 30); })()`);
  H.step(5);
  H.run(`window.__seiten = []`);
  taste('E');
  assert.ok(panelOffen(), 'an der Tafel kommt keine Wahl');
  // Zuerst abbrechen: haengt nichts aus.
  taste('ESC');
  assert.strictEqual(offen(), false, 'ESC laesst den Hub gesperrt');
  assert.strictEqual(H.run(`${hub}._ediktSchritt()`), 1, 'Abbrechen zaehlt als ausgehaengt');
  H.step(5);
  taste('E');
  H.step(200);
  wahl(1);
  assert.deepStrictEqual(seiten(), [], 'beim Aushaengen erscheint ein Dialog: ' + seiten().join(' '));
  assert.strictEqual(offen(), false);
  assert.strictEqual(H.run(`window.questSystem.hasFlag('edikt_klerus')`), true, 'die Wahl kam nicht an');
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('faction_campaign')`), true);
});

// --- 3) Die Begruessung nach einem Abschluss --------------------------------

/** Baut das Angebot eines NPC und gibt die Texte der Seiten zurueck. */
function angebotsTexte(npc) {
  return Array.from(H.run(`(function () {
    var sc = ${hub};
    var texte = null;
    var echt = sc._showDialoguePages;
    sc._showDialoguePages = function (d, t, p) { texte = p.map(function (s) { return s.text; }); };
    var n = sc.npcs.filter(function (x) { return x.data.id === '${npc}'; })[0];
    try { sc._showNpcDialogue(n ? n.data : { id: '${npc}', name: '${npc}', lines: [] }); }
    finally { sc._showDialoguePages = echt; sc._dialogOpen = false; }
    return texte || [];
  })()`));
}
const gruss = (texte, titel) => texte.filter((t) => t && t.indexOf('"' + titel + '"') >= 0);

test('Begruessung: einmal nach dem Abschluss, nicht vor jedem Angebot', () => {
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG });
  const titel = H.run(`window.i18n.t('quest.einfuehrung_markt.title')`);
  const erst = angebotsTexte('mara');
  assert.strictEqual(gruss(erst, titel).length, 1, 'keine Begruessung nach dem frischen Abschluss: ' + erst.join(' || '));
  // Abgelehnt und wieder angesprochen: derselbe Abschluss, kein zweites Mal.
  const zweit = angebotsTexte('mara');
  assert.strictEqual(gruss(zweit, titel).length, 0, 'die Begruessung kommt bei jedem Gespraech');
  // Ueberlebt einen Hub-Neuaufbau: das Merkzeichen liegt im Spielstand.
  assert.strictEqual(H.run(`window.questSystem.getQuestSaveData().flags.gruss_einfuehrung_markt`), true);
});

test('Begruessung: jeder NPC in seinem Ton, Fassungen wechseln', () => {
  const t = (k) => H.run(`window.i18n.t('hub.dialog.npc_quest.greeting_returning.${k}', { title: 'X' })`);
  const texte = ['aldric.1', 'branka.1', 'thom.1', 'harren.1', 'mara.1', 'allgemein.1'].map(t);
  assert.strictEqual(new Set(texte).size, texte.length, 'zwei NPC sagen dasselbe');
  texte.forEach((x) => assert.ok(/"X"/.test(x), 'ohne Titel: ' + x));
  ['aldric', 'branka', 'thom', 'harren', 'mara', 'allgemein'].forEach((n) => {
    assert.notStrictEqual(t(n + '.2'), 'hub.dialog.npc_quest.greeting_returning.' + n + '.2', n + ' hat nur eine Fassung');
    assert.notStrictEqual(t(n + '.1'), t(n + '.2'));
  });
  // Englisch vorhanden
  const en = H.run(`(function () { var l = window.i18n.getLanguage(); window.i18n.setLanguage('en');
    var s = window.i18n.t('hub.dialog.npc_quest.greeting_returning.thom.2', { title: 'X' });
    window.i18n.setLanguage(l); return s; })()`);
  assert.ok(/Ink/.test(en), 'kein Englisch: ' + en);
  // Reihum: die zweite Begruessung bei Mara klingt anders als die erste.
  // Akt 2, damit nach dem zweiten Abschluss noch mara_contact angeboten wird.
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG, einfuehrung_markt: FERTIG }, 2);
  const g1 = gruss(angebotsTexte('mara'), H.run(`window.i18n.t('quest.einfuehrung_markt.title')`))[0];
  H.run(`(function () { var qs = window.questSystem; qs.acceptQuest('einfuehrung_amulett');
    qs.updateQuestProgress('system', 'haendler', 1); qs.completeQuest('einfuehrung_amulett');
    while (window.storySystem.consumePendingEvent()) {} })()`);
  assert.strictEqual(H.run(`(window.questSystem.getAvailableQuests('mara')[0] || {}).id`), 'mara_contact');
  const g2 = gruss(angebotsTexte('mara'), H.run(`window.i18n.t('quest.einfuehrung_amulett.title')`))[0];
  assert.ok(g1 && g2, 'eine der beiden Begruessungen fehlt');
  assert.notStrictEqual(g2.replace(/"[^"]*"/, ''), g1.replace(/"[^"]*"/, ''), 'zweimal dieselbe Fassung');
});

['branka', 'thom', 'harren', 'aldric'].forEach((npc) => {
  test('Begruessung bei ' + npc + ': eigener Ton, nur einmal', () => {
    npcStand(npc);
    // Aldric: der letzte eigene Abschluss ist aldric_patrol.
    const quelle = NPC_STAND[npc][0];
    const titel = H.run(`window.i18n.t('quest.${quelle}.title')`);
    const erst = angebotsTexte(npc);
    const g = gruss(erst, titel);
    assert.strictEqual(g.length, 1, npc + ': keine Begruessung: ' + erst.join(' || '));
    const eigen = [1, 2, 3].map((n) => H.run(`window.i18n.t('hub.dialog.npc_quest.greeting_returning.${npc}.${n}', { title: ${JSON.stringify(titel)} })`));
    assert.ok(eigen.indexOf(g[0]) >= 0, npc + ' spricht nicht in seinem Ton: ' + g[0]);
    assert.strictEqual(gruss(angebotsTexte(npc), titel).length, 0, npc + ': Begruessung beim zweiten Gespraech');
  });
});

test('Begruessung: nach dem Abgeben beim NPC keine zweite Wuerdigung desselben Auftrags', () => {
  // Das Abgabegespraech wuerdigt den Auftrag schon. Bis b413 begann das
  // naechste Angebot trotzdem mit "Dein Erfolg bei ..." ueber denselben.
  stand({ aldric_cleanup: FERTIG, aldric_patrol: FERTIG });
  H.run(`(function () {
    var sc = ${hub}, qs = window.questSystem;
    qs.acceptQuest('einfuehrung_markt');
    var q = (qs.getActiveQuests() || []).filter(function (x) { return x.id === 'einfuehrung_markt'; })[0];
    (q.objectives || []).forEach(function (o) { o.current = o.required; });
    var n = sc.npcs.filter(function (x) { return x.data.id === 'mara'; })[0];
    sc._handleDialogueChoice('complete', n.data, '', [], 'turnin', q, 0, null);
    sc._dialogOpen = false;
    while (window.storySystem.consumePendingEvent()) {}
  })()`);
  assert.strictEqual(H.run(`window.questSystem.isQuestCompleted
    ? window.questSystem.isQuestCompleted('einfuehrung_markt')
    : window.questSystem.getQuestSaveData().quests.einfuehrung_markt.status === 'completed'`), true,
    'der Auftrag wurde nicht abgegeben — Test misst nichts');
  const titel = H.run(`window.i18n.t('quest.einfuehrung_markt.title')`);
  const texte = angebotsTexte('mara');
  assert.ok(texte.length > 0, 'Mara bietet nichts an — Test misst nichts');
  assert.strictEqual(gruss(texte, titel).length, 0, 'Gruss nach der Abgabe: ' + texte.join(' || '));
});

test('Kein NPC sagt mehr "hat mir Mut gemacht"', () => {
  const quelle = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'scenes', 'HubSceneV2.js'), 'utf8');
  assert.ok(!/Mut gemacht|gave me courage/.test(quelle), 'der abgenutzte Satz steht noch drin');
});
