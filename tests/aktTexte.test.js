// tests/aktTexte.test.js — Akt-Titelkarten und NPC-Zeilen auf Story-Bibel v5 (#89).
//
// Die Titelkarten und die Flavor-Zeilen der Figuren stammten noch aus v3:
// "Eindringlinge stehlen unsere Archive", "Faelschungen", ein Buergermeister,
// der sich "alter Handwerker" nennt, Elara, die im Hub die Klinge ueberreicht.
// Seit v5 erzaehlt die Geschichte etwas anderes — die Texte muessen folgen.

const { test, before } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

let S = null;
let dicts = null;

before(() => {
  if (!globalThis.window) globalThis.window = {};
  dicts = { de: {}, en: {} };
  let lang = 'de';
  globalThis.window.i18n = {
    register(l, obj) { dicts[l] = Object.assign(dicts[l] || {}, obj || {}); },
    t: (k) => {
      const v = (dicts[lang] && dicts[lang][k] != null) ? dicts[lang][k] : dicts.de[k];
      return v != null ? v : '[MISSING:' + k + ']';
    },
    setLanguage(l) { lang = l; },
    getLanguage: () => lang,
    onChange: () => () => {}
  };
  delete globalThis.window.storySystem;
  loadGameModule('js/storySystem.js');
  S = globalThis.window.storySystem;
});

// Saetze aus v3/v4, die der v5-Geschichte widersprechen.
const ALT = [/Eindringling/, /Fälschung/, /Wilde Tiere/, /alter Handwerker/, /Beschwörungskammer/,
  /Erledige deinen Auftrag/, /Ich habe es für dich geschmiedet/, /Dämonen.*eingeladen/, /Kugel gegen/];

function alleDeutschenTexte() {
  const texte = [];
  Object.keys(S.ACT_NARRATIVES).forEach((k) => texte.push(['Akt ' + k, S.ACT_NARRATIVES[k]]));
  Object.keys(S.NPC_DIALOGUE).forEach((npc) => Object.keys(S.NPC_DIALOGUE[npc]).forEach((akt) =>
    S.NPC_DIALOGUE[npc][akt].forEach((z, i) => texte.push([npc + '.' + akt + '.' + i, z]))));
  return texte;
}

test('Keine Saetze aus v3/v4 mehr in Titelkarten und NPC-Zeilen', () => {
  const treffer = [];
  alleDeutschenTexte().forEach(([wo, text]) => {
    ALT.forEach((re) => { if (re.test(text)) treffer.push(wo + ': ' + text); });
  });
  assert.deepStrictEqual(treffer, [], 'alte Texte');
});

test('Akt 4 heisst wie in der Bibel: Die Quelle', () => {
  assert.strictEqual(dicts.de['story.act.bruch.name'], 'Die Quelle');
  assert.strictEqual(dicts.en['story.act.bruch.name'], 'The Source');
});

test('Die Titelkarte von Akt 4 verraet den Maulwurf noch nicht', () => {
  // Beim Beginn von Akt 4 (nach dem Bruch) hat der Spieler Elara noch nicht
  // mit Aldric gesehen — die Karte darf ihm das nicht vorwegnehmen.
  assert.ok(!/Elara|Maulwurf|Ring/.test(S.ACT_NARRATIVES.bruch), S.ACT_NARRATIVES.bruch);
});

test('Jede Zeile gibt es auch auf Englisch', () => {
  const fehlt = [];
  Object.keys(S.ACT_NARRATIVES).forEach((k) => {
    const en = dicts.en['story.act.' + k + '.narrative'];
    if (!en || en === S.ACT_NARRATIVES[k]) fehlt.push('Akt ' + k);
  });
  Object.keys(S.NPC_DIALOGUE).forEach((npc) => Object.keys(S.NPC_DIALOGUE[npc]).forEach((akt) =>
    S.NPC_DIALOGUE[npc][akt].forEach((z, i) => {
      const k = 'story.npc.' + npc + '.' + akt + '.' + i;
      if (!dicts.en[k] || dicts.en[k] === z) fehlt.push(k);
    })));
  assert.deepStrictEqual(fehlt, [], 'ohne englische Fassung');
});

test('Keine verwaisten englischen Zeilen', () => {
  const verwaist = Object.keys(dicts.en).filter((k) => /^story\.npc\./.test(k) && dicts.de[k] == null);
  assert.deepStrictEqual(verwaist, []);
});

test('Jeder Akt hat seine eigene Stimmung', () => {
  const ids = ['auftrag', 'treuer_diener', 'erste_risse', 'wahrheit', 'bruch', 'ending'];
  const gruende = ids.map((id) => S.aktStimmung(id).grund);
  assert.strictEqual(new Set(gruende).size, ids.length, 'zwei Akte sehen gleich aus: ' + gruende.join(', '));
});
