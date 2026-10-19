// tests/stufe1bTexte.test.js — Texte nach Story v6.1 (Stufe 1b, Variante A).
//
// Die Daemonen bleiben (die Esse haelt einen gebundenen Daemon, die Pakte
// sind in ihrem Feuer gesiegelt). Angeglichen werden die Texte, die etwas
// anderes erzaehlten: der Kettenmeister als Folterknecht, die "Quelle" als
// Ding, ein Gefangener am Konvoi, das Unfall-Fragment im Prolog, englische
// Affixe im Namenszug, "Dungeon" und "Run" in der deutschen Oberflaeche.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
});
after(async () => {
  if (H) { try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {} await H.shutdown(); }
});

const de = (k) => H.run(`window.i18n.t(${JSON.stringify(k)})`);

test('"Zwei Listen" (der geplante Unfall) liegt erst ab der Enttarnung', () => {
  const r = H.run(`({ prolog: window.EventSystem.lorePool(0), akt2: window.EventSystem.lorePool(2), akt3: window.EventSystem.lorePool(3) })`);
  const k = 'event.lore.text.fragment_personal_amnesia';
  assert.ok(!Array.from(r.prolog).includes(k), 'im Prolog');
  assert.ok(!Array.from(r.akt2).includes(k), 'im Doppelspiel');
  assert.ok(Array.from(r.akt3).includes(k), 'fehlt ab der Enttarnung');
  assert.match(de(k), /Unfall in der Archivschmiede war geplant/);
  assert.match(de('event.lore.text.fragment_council_pact'), /Feuer der Esse/);
});

test('Kettenmeister: Hauptmann der Garde, geleert, nur der Befehl', () => {
  assert.strictEqual(de('bossintro.chainMaster.1'), 'Halt. Niemand passiert.');
  assert.strictEqual(de('bossintro.chainMaster.2'), 'Befehl ist Befehl. Von wem, weiss ich nicht mehr.');
  assert.ok(!/Folterknecht/.test(de('bossintro.chainMaster.beiname')));
  const lore = H.run(`getBossDefinition(10).def.loreIntro`);
  assert.match(lore, /Hauptmann der Garde/);
  assert.match(lore, /geleert/);
  assert.ok(!/Folterknecht|Beweis/.test(lore), lore);
});

test('Zeremonienmeister: aus Ueberzeugung geblieben, haelt die Kammer am Schacht zur Esse', () => {
  const lore = H.run(`getBossDefinition(20).def.loreIntro`);
  assert.match(lore, /Überzeugung/);
  assert.match(lore, /freiwillig/);
  assert.match(lore, /Schacht zur Esse/);
  assert.ok(!/Quelle/.test(lore), lore);
  assert.ok(!/Quelle/.test(de('boss.ceremonyMaster.lore')));
});

test('Orte: die Esse statt der Quelle, die Ritualkammer mit Kreide, Ketten, Phiolen', () => {
  const r = H.run(`({ esse: ROOM_DESCRIPTIONS.DieQuelle, ritual: ROOM_DESCRIPTIONS.RitualVault })`);
  assert.match(r.esse, /^Die Esse/);
  assert.match(r.ritual, /Kreidekreis, Ketten, leere Phiolen/);
  assert.match(r.ritual, /Atem des Dämons/);
});

test('Konvoi: versiegelte Phiolen, kein Gefangener', () => {
  const r = H.run(`(function () {
    var t = []; ['spion.convoy_intel.1', 'spion.convoy_intel.2', 'spion.convoy_intel.3'].forEach(function (k) { t.push(window.i18n.t(k)); });
    return t.join(' | ');
  })()`);
  assert.ok(!/gebundenen Händen|Liste steht/.test(r), r);
  assert.match(r, /Kisten mit dem Wachs/);
});

test('Elite-Affixe im Namenszug sind deutsch', () => {
  assert.strictEqual(de('elite.affix.vampiric'), 'Blutsaugend');
  assert.strictEqual(de('elite.affix.spectral_hit'), 'Geisterhieb');
  H.run(`window.i18n.setLanguage('en')`);
  assert.strictEqual(de('elite.affix.vampiric'), 'Vampiric');
  H.run(`window.i18n.setLanguage('de')`);
  // Am echten Namenszug: ein Champion mit festem Wurf.
  const zug = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var e = sc.add.sprite(200, 200, '__DEFAULT');
    e.type = 'rat'; e.hp = 10; e.maxHp = 10; e.speed = 50; e.damage = 1;
    window.EliteEnemies.applyEliteToEnemy(e, 'champion', function () { return 0; });
    var t = e._eliteNameTag ? String(e._eliteNameTag.text) : null;
    try { window.EliteEnemies.removeEliteFromEnemy(e); } catch (x) {}
    e.destroy();
    return t;
  })()`);
  assert.ok(zug, 'kein Namenszug');
  assert.ok(!/Fanatic|Lightning|Cold Aura|Spectral|Multishot|Vampiric|Extra |Magic/.test(zug), 'englisch im Namenszug: ' + zug);
});

test('Oberflaeche: kein "Dungeon", "Run" oder "Item" in den geaenderten deutschen Zeilen', () => {
  const keys = ['start.subtitle', 'inv.amulet.badge', 'inv.amulet.run_hint', 'inventory.help', 'event.cursed.choice_open',
    'event.fountain.outcome.damage_buff', 'printingHouse.edict.war_cry.desc', 'printingHouse.ui.suspicion',
    'printingHouse.ui.suspicion_hint', 'tutorial.step.loot_pickup', 'stash.label.bag', 'endless.death.best',
    'quest.espionage_convoy.description', 'quest.thom_pamphlets.description'];
  const funde = keys.map((k) => [k, de(k)]).filter(([, v]) => /Dungeon|\bRun\b|\bItems?\b|Council/.test(v) || /MISSING/.test(v));
  assert.deepStrictEqual(funde, []);
  assert.strictEqual(de('inv.amulet.run_hint'), 'Nachbildung · hält einen Lauf');
  assert.strictEqual(de('printingHouse.edict.amulets_distributed.label'), 'Laternen verteilt');
  assert.strictEqual(de('quest.reward.RITUAL_AMULETT'), 'Nebelamulett des Rats');
});

test('Gespraeche: keine Wahl, die keine ist; "man hat Dich geleert"', () => {
  const r = H.run(`(function () {
    var b = window.storyDialog.byQuest;
    return { wer: b.who_you_were.choices.length, thom: b.thom_truth.choices.length,
      mara: b.mara_contact.choices[0].response, buerger: b.hub_buerger_a2.prompt };
  })()`);
  assert.strictEqual(r.wer, 1, 'zwei Antworten mit demselben Flag');
  assert.strictEqual(r.thom, 1, 'zwei Antworten mit demselben Flag');
  assert.match(r.mara, /hat man Dich deshalb geleert/);
  assert.match(r.buerger, /^BÜRGER:/);
});

test('Gesuche: das Abgeben setzt kein Vorgabe-Flag mehr; Altstaende behalten die echte Wahl', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    var flagsVorher = st.flags;
    st.flags = { petitions_kept: true, petitions_surrendered: true };
    qs.loadQuestSaveData(st);
    var f = qs.getFlags();
    var r = { kept: !!f.petitions_kept, surrendered: !!f.petitions_surrendered,
      vorgabe: qs.QUEST_DEFINITIONS.council_seizure.completionFlags || null };
    st.flags = flagsVorher; qs.loadQuestSaveData(st);
    return r;
  })()`);
  assert.deepStrictEqual([r.kept, r.surrendered, r.vorgabe], [true, false, null]);
});

test('Elara lebt im Rathauskeller, in dem sie Dich gerettet hat', () => {
  const t = H.run(`window.QuestFinale.epilog({ elara_spared: true }, 'de').join(' ')`);
  assert.match(t, /in dem sie Dich einst gerettet hat/);
  assert.ok(!/hinabgeschickt/.test(t));
});

test('Textregeln fuer neue Zeilen: kein ß, keine Gedankenstriche, Du gross', () => {
  const r = H.run(`(function () {
    var S = window.storySystem.NPC_DIALOGUE, P = window.HubPhase.npcFlavorByPhase, t = [];
    ['mara', 'harren'].forEach(function (n) { (S[n].enttarnt || []).forEach(function (z) { t.push(z); }); });
    ['broken', 'epilogue'].forEach(function (p) { Object.keys(P[p]).forEach(function (n) { P[p][n].forEach(function (z) { t.push(z); }); }); });
    ['quest.einfuehrung_wissen.dialogueOffer', 'quest.einfuehrung_wissen.dialogueProgress', 'quest.einfuehrung_wissen.dialogueComplete',
     'quest.mara_warning.dialogueOffer', 'quest.mara_warning.dialogueComplete', 'bossintro.ceremonyMaster.1', 'bossintro.ceremonyMaster.2',
     'story.journal.rat_keine_auftraege', 'hub.knowledge.learn', 'schrift.hinweis.wissensbaum'].forEach(function (k) { t.push(window.i18n.t(k)); });
    return t;
  })()`);
  const verstoss = Array.from(r).filter((z) => /ß|—|–|\b(du|dich|dir|dein|deine)\b/.test(z));
  assert.deepStrictEqual(verstoss, []);
});
