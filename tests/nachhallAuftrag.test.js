// tests/nachhallAuftrag.test.js — "Was der Rauch behaelt" (Story-Kern v6.1, Stufe 2).
//
// Auftraggeberin Mara, Art Boss, ab Tiefe 25, Lohn 220 Erfahrung (Gewicht
// 'boss', skaliert ueber lohnBerechnen). Nach "Der Maulwurf", vor "Die
// Quelle". Spielstaende, in denen die Quelle schon laeuft oder fertig ist,
// sperrt der neue Auftrag nicht. Am echten questSystem mit Akt-Attrappe.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const ID = 'was_der_rauch_behaelt';

function system(akt) {
  resetStore();
  delete globalThis.window.questSystem;
  const story = { akt: akt || 0 };
  globalThis.window.storySystem = {
    getCurrentActIndex: () => story.akt,
    advanceToAct: (n) => { if (n > story.akt) story.akt = n; },
    resetToAct0: () => { story.akt = 0; }
  };
  globalThis.window.DUNGEON_DEPTH = 99;
  loadGameModule('js/questSystem.js');
  return globalThis.window.questSystem;
}

function stand(qs, eintraege, extra) {
  const st = Object.assign({ storyVersion: qs.STORY_VERSION, quests: {}, flags: {} }, extra || {});
  Object.keys(eintraege).forEach((id) => {
    const d = qs.QUEST_DEFINITIONS[id];
    st.quests[id] = { status: eintraege[id],
      objectives: d.objectives.map((o) => ({ type: o.type, target: o.target, current: 0, required: o.required })) };
  });
  qs.loadQuestSaveData(st);
}
const angebot = (qs, npc) => qs.getAvailableQuests(npc).map((q) => q.id);

test('Die Eckdaten aus dem Story-Kern', () => {
  const qs = system(4);
  const d = qs.QUEST_DEFINITIONS[ID];
  assert.strictEqual(d.title, 'Was der Rauch behält');
  assert.strictEqual(d.npcId, 'mara');
  assert.strictEqual(d.type, 'boss');
  assert.strictEqual(d.minDepth, 25);
  assert.strictEqual(d.rewards.xp, 220);
  assert.strictEqual(d.rewardTier, 'boss');
  assert.deepStrictEqual(d.objectives.map((o) => o.type + ':' + o.target), ['boss_kill:nachhall']);
  // Lohn skaliert wie bei den anderen Bossauftraegen, 220 ist die Untergrenze.
  assert.strictEqual(qs.lohnBerechnen(d, { xpFuerStufe: 100 }).xp, 220);
  assert.strictEqual(qs.lohnBerechnen(d, { xpFuerStufe: 10000 }).xp, Math.round(qs.LOHN_ANTEIL.boss * 10000));
});

test('Angebot und Abschluss stehen wortgleich wie im Story-Kern', () => {
  const qs = system(4);
  const d = qs.QUEST_DEFINITIONS[ID];
  assert.strictEqual(d.dialogueOffer, 'Die Leute, die sie mir genommen haben, sind nicht tot. Nicht ganz. Wer tief genug hinabsteigt, hört sie, auf Tiefe 25, alle durcheinander. Die Späher nennen es den Nachhall. Er steht zwischen Dir und der Esse. Geh hin, hör nicht zu lange zu und bring sie nach Hause.');
  assert.strictEqual(d.dialogueComplete, 'Du hast sie gehen lassen. (Sie schweigt lange.) Hast Du einen Namen gehört, den Du kennst? (Eine der Stimmen war Deine eigene. Du sagst es ihr nicht.) Gib Thom die Namen, die Du lesen konntest. Dann geh. Die Esse wartet, und Elara mit ihr.');
});

test('Nach dem Maulwurf, vor der Quelle', () => {
  const qs = system(4);
  stand(qs, {});
  assert.ok(angebot(qs, 'mara').indexOf(ID) < 0, 'kommt vor dem Maulwurf');
  stand(qs, { espionage_informant: 'completed' });
  assert.ok(angebot(qs, 'mara').indexOf(ID) >= 0, 'Mara bietet ihn nach dem Maulwurf nicht an');
  assert.ok(angebot(qs, 'branka').indexOf('schattenrat_finale') < 0, 'die Quelle kommt vor dem Nachhall');
  qs.acceptQuest(ID);
  qs.onBossKilled('nachhall');
  assert.strictEqual(qs.completeQuest(ID), true);
  assert.ok(angebot(qs, 'branka').indexOf('schattenrat_finale') >= 0, 'nach dem Nachhall keine Quelle');
});

test('Alte Staende: eine laufende oder fertige Quelle bleibt, wie sie ist', () => {
  const qs = system(4);
  stand(qs, { espionage_informant: 'completed', schattenrat_finale: 'active' });
  assert.ok(qs.getActiveQuests().some((q) => q.id === 'schattenrat_finale'), 'die laufende Quelle ist weg');
  qs.onBossKilled('schattenrat');
  assert.strictEqual(qs.isQuestReadyToComplete('schattenrat_finale'), true);
  assert.strictEqual(qs.completeQuest('schattenrat_finale'), true, 'die Quelle laesst sich nicht abgeben');
  // Der Nachhall bleibt danach trotzdem spielbar.
  assert.ok(angebot(qs, 'mara').indexOf(ID) >= 0);
});

test('Die Namen aus dem Nachhall stehen im Spielstand und in getFlags', () => {
  const qs = system(4);
  stand(qs, {});
  assert.strictEqual(qs.getFlags().nachhall_namen, undefined, 'ohne Namen keine Liste');
  qs.setNachhallNamen(['Ilse Brandt', 'Oda Kessler', 'Ilse Brandt', '', 7]);
  assert.deepStrictEqual(qs.getNachhallNamen(), ['Ilse Brandt', 'Oda Kessler']);
  const st = JSON.parse(JSON.stringify(qs.getQuestSaveData()));
  const qs2 = system(4);
  qs2.loadQuestSaveData(st);
  assert.deepStrictEqual(qs2.getFlags().nachhall_namen, ['Ilse Brandt', 'Oda Kessler']);
  // Alter Stand ohne das Feld: leer, kein Absturz.
  stand(qs2, {});
  assert.deepStrictEqual(qs2.getNachhallNamen(), []);
});

test('Tiefentor vor dem Nachhall (24), alte Staende mit Quelle laufen durch', () => {
  const qs = system(4);
  loadGameModule('js/runDepth.js');
  const RD = globalThis.window.RunDepth;
  stand(qs, { espionage_informant: 'completed' });
  const tor = RD.torBei(24);
  assert.ok(tor && tor.questId === ID, 'kein Tor auf 24');
  qs.acceptQuest(ID);
  assert.strictEqual(RD.torBei(24), null, 'das Tor bleibt zu, obwohl der Auftrag laeuft');
  stand(qs, { espionage_informant: 'completed', schattenrat_finale: 'active' });
  assert.strictEqual(RD.torBei(24), null, 'ein alter Stand mit laufender Quelle haengt auf 24 fest');
});

test('i18n: alle Felder auf Englisch', () => {
  const qs = system(4);
  loadGameModule('js/i18n.js');
  const I = globalThis.window.i18n;
  delete globalThis.window.questSystem;
  loadGameModule('js/questSystem.js');
  ['title', 'description', 'dialogueOffer', 'dialogueProgress', 'dialogueComplete'].forEach((f) => {
    assert.ok(/\S/.test(String(I._wert('en', 'quest.' + ID + '.' + f) || '')),
      'quest.' + ID + '.' + f + ' fehlt auf Englisch');
  });
  void qs;
});
