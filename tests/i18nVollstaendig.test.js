// tests/i18nVollstaendig.test.js — jede deutsche Zeile hat eine englische (#87).
//
// Deutsch ist die Quelle: Quest-, Story-, Dialog-, Hub- und Boss-Texte stehen
// deutsch in den Daten und werden als Keys registriert (i18n.binden bzw. die
// Auto-Registrierung in questSystem/storySystem). Englisch gibt es nur als
// ausdrueckliche Uebersetzung. Fehlt sie, faellt das Spiel still auf Deutsch
// zurueck. Dieser Test laeuft auf dem echten Hub, damit auch Keys zaehlen, die
// erst beim Szenenaufbau registriert werden.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { vergleichen } = require('../tools/checkI18n.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  assert.ok(ok, 'HubSceneV2 wurde nicht erreicht');
  H.step(10);
});
// H.run liefert Arrays aus einem anderen Realm: Laengen vergleichen, nicht deepStrictEqual.
after(async () => {
  if (H) {
    try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {}
    await H.shutdown();
  }
});

test('i18n: kein deutscher Key ohne englische Fassung', () => {
  const r = vergleichen(H);
  assert.ok(r.de > 1200, 'zu wenige deutsche Keys erfasst: ' + r.de);
  assert.strictEqual(r.fehlend.length, 0, 'ohne englische Fassung:\n  ' + r.fehlend.join('\n  '));
  assert.strictEqual(r.verwaist.length, 0, 'englisch ohne deutsche Quelle:\n  ' + r.verwaist.join('\n  '));
});

test('i18n: keine englische Fassung, die deutsch aussieht', () => {
  const r = vergleichen(H);
  assert.strictEqual(r.deutschInEn.length, 0, 'deutsch in EN:\n  ' + r.deutschInEn.join('\n  '));
});

test('i18n: gebundene Story-Texte folgen der Sprache', () => {
  const r = H.run(`(function () {
    function lesen() {
      var sd = window.storyDialog.byScene.maulwurf_reveal;
      var hp = window.HubPhase.npcFlavorByPhase.broken.aldric;
      var boss = getBossDefinition(10);
      return {
        prompt: sd.prompt,
        label: sd.choices[1].label,
        flavor: hp[0],
        boss: boss && boss.def && boss.def.name,
        raum: ROOM_DESCRIPTIONS.DieQuelle,
        quest: window.i18n.t('quest.the_reckoning.title')
      };
    }
    window.i18n.setLanguage('de');
    var de = lesen();
    window.i18n.setLanguage('en');
    var en = lesen();
    window.i18n.setLanguage('de');
    return { de: de, en: en, json: JSON.stringify(window.storyDialog.byScene.bruch_nacht) };
  })()`);
  assert.strictEqual(r.de.prompt, 'MARA: (als Du zurückkommst) Und? Wer ist es?');
  assert.strictEqual(r.en.prompt, 'MARA: (as you return) Well? Who is it?');
  assert.strictEqual(r.en.label, "I don't know.");
  assert.match(r.en.flavor, /^You\. I know what you are/);
  assert.strictEqual(r.de.boss, 'Kettenmeister');
  assert.strictEqual(r.en.boss, 'Chainmaster');
  assert.match(r.en.raum, /^The Source/);
  assert.strictEqual(r.en.quest, 'The Reckoning');
  // Gebundene Felder bleiben normale, serialisierbare Daten.
  assert.match(r.json, /"prompt":"ELARA: Du hast mir vertraut/);
});
