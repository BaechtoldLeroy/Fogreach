// tests/questFinaleEpilog.test.js — der Epilog haengt an den Entscheidungen (#158).
//
// Story-Bibel v5, Abschnitt 9: ein Ende, aber jede Entscheidung unterwegs
// aendert, was danach erzaehlt wird. Geprueft an der reinen Funktion
// QuestFinale.epilog(flags, lang) — dieselbe, die die Presse im Hub und die
// Epilog-Titelkarte benutzen.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

loadGameModule('js/questFinale.js');
const QF = globalThis.window.QuestFinale;
const text = (flags, lang) => QF.epilog(flags, lang).join('\n');

test('Das Ratssiegel entscheidet, ob Branka neben Dir steht (#145)', () => {
  assert.strictEqual(QF.computeFinaleState({ verification_refused: true }).allies.branka, true);
  assert.strictEqual(QF.computeFinaleState({ verification_sealed: true, branka_ally: true }).allies.branka, false,
    'wer gesiegelt hat, dem steht sie nicht zur Seite');
  // Alte Spielstaende ohne Siegel-Antwort: das Gespraech zaehlt wie bisher.
  assert.strictEqual(QF.computeFinaleState({ branka_ally: true }).allies.branka, true);
});

test('Harrens Tod steht im Epilog, wenn er an der Quelle starb', () => {
  assert.ok(/Lene/.test(text({ harren_dead: true })));
  assert.ok(!/Lene/.test(text({})));
});

test('Elara lebt oder liegt neben ihrem Vater — wie Du gewaehlt hast', () => {
  assert.ok(/hinter den Gittern/.test(text({ elara_spared: true })));
  assert.ok(/liegt neben ihrem Vater/.test(text({ elara_killed: true })));
});

test('Die Namen auf den Gesuchen: wie viele zurueckkehren', () => {
  assert.ok(/Viele der Verschwundenen/.test(text({ petitions_kept: true })));
  assert.ok(/Nur wenige der Verschwundenen/.test(text({ petitions_surrendered: true })));
  assert.ok(/Einige der Verschwundenen/.test(text({})));
});

test('Der Konvoi: der gerettete Mann kehrt zurueck, Maras Netz ist zerrissen', () => {
  const t = text({ convoy_blade_drawn: true, convoy_blown: true, petitions_kept: true });
  assert.ok(/Mann vom Konvoi/.test(t), 'der Mann vom Konvoi fehlt');
  assert.ok(/Mara bleibt verschwunden/.test(t), 'Maras Fehlen wird nicht erzaehlt');
  assert.ok(!/Mara verteilt/.test(t));
  assert.ok(/Mara verteilt/.test(text({ petitions_kept: true })), 'ohne Konvoi-Folgen hilft Mara');
});

test('Wer sich erinnert, dem gehoert der letzte Satz', () => {
  const mit = QF.epilog({ self_remembered: true });
  const ohne = QF.epilog({});
  assert.ok(/letzte Satz gehört Dir/.test(mit[mit.length - 1]));
  assert.ok(/bleibt im Nebel/.test(ohne[ohne.length - 1]));
});

test('Allein am Ende, wenn niemand bleibt', () => {
  assert.ok(/Niemand steht neben Dir/.test(text({})));
  assert.ok(!/Niemand steht neben Dir/.test(text({ thom_ally: true })));
});

test('Der Epilog gibt es auch auf Englisch', () => {
  const t = text({ harren_dead: true, elara_spared: true }, 'en');
  assert.ok(/The fog breaks/.test(t));
  assert.ok(/behind the bars/.test(t));
  assert.ok(!/Nebel/.test(t), 'deutscher Text im englischen Epilog');
});
