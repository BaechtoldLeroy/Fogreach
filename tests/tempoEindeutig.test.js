// tests/tempoEindeutig.test.js — "Tempo" allein ist mehrdeutig.
//
// Das Spiel kennt ZWEI Tempi, und der Charakterbogen zeigt beide nebeneinander:
// Angriffstempo (weaponAttackSpeed) und Lauftempo (playerSpeed). Fuenf
// Beschreibungen sagten nur "Tempo" — dreimal war Lauftempo gemeint, zweimal
// Angriffstempo. Gemeldet an "Leichter Schritt": +35 % Tempo, und niemand
// konnte sehen, welches.
//
// Die englischen Fassungen waren dabei schon eindeutig ("move speed"). Das ist
// das Muster, das dieser Test festhaelt: eine Sprache wird nachgezogen, die
// andere vergessen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

// Die Dateien mit sichtbaren deutschen Texten, die ueber Tempo reden.
const DATEIEN = [
  'js/knowledgeTree.js',
  'js/eventSystem.js',
  'js/hudV2.js',
  'js/inventory.js',
  'js/skillTree.js',
  'js/scenes/CraftingScene.js',
  'js/scenes/ShopScene.js',
  'js/scenes/SkillTreeScene.js'
];

// Wortverbindungen, in denen "Tempo" eindeutig ist.
const ERLAUBT = [
  'Angriffstempo', 'Angr.tempo', 'Lauftempo', 'Textempo', 'Tempo:'
];

/** Alle Zeilen einer Datei, die sichtbaren Text mit "Tempo" tragen. */
function fundstellen(rel) {
  const quelle = fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  return quelle.split(/\r?\n/)
    .map((z, i) => ({ nr: i + 1, text: z }))
    // Kommentarzeilen zaehlen nicht: dort ist "Tempo" Prosa, kein Spieltext.
    .filter((z) => !/^\s*(\/\/|\*)/.test(z.text))
    .filter((z) => z.text.indexOf('Tempo') >= 0);
}

test('Kein sichtbarer Text sagt nur "Tempo"', () => {
  const unklar = [];
  DATEIEN.forEach((rel) => {
    fundstellen(rel).forEach((z) => {
      // Jedes Vorkommen einzeln pruefen: eine Zeile kann beide Tempi nennen.
      let rest = z.text;
      ERLAUBT.forEach((w) => { rest = rest.split(w).join(''); });
      if (rest.indexOf('Tempo') >= 0) unklar.push(rel + ':' + z.nr + '  ' + z.text.trim());
    });
  });
  assert.deepStrictEqual(unklar, [],
    'diese Stellen sagen nur "Tempo" und lassen offen, welches:' + '\n  ' + unklar.join('\n  '));
});

test('Die drei Wissensbaum-Knoten meinen wirklich das LAUFtempo', () => {
  // Die Gegenprobe zur Textpruefung: dass dort "Lauftempo" steht, ist nur dann
  // richtig, wenn der Effekt auch auf speedMult geht. Stuende er auf
  // attackSpeedMult, waere der Text zwar eindeutig, aber falsch.
  const quelle = fs.readFileSync(path.join(WURZEL, 'js/knowledgeTree.js'), 'utf8');
  ['key_leichter_schritt', 'key_ruhige_hand', 'not_zaeher_lauf'].forEach((id) => {
    const i = quelle.indexOf("id: '" + id + "'");
    assert.ok(i > 0, id + ' nicht gefunden');
    const block = quelle.slice(i, i + 500);
    assert.ok(block.indexOf('speedMult') >= 0,
      id + ' aendert gar kein Lauftempo — der Text waere falsch');
    assert.ok(block.indexOf('attackSpeedMult') < 0,
      id + ' aendert das ANGRIFFStempo, der Text sagt aber Lauftempo');
  });
});

test('Der Brunnenbuff meint das Lauftempo', () => {
  const quelle = fs.readFileSync(path.join(WURZEL, 'js/eventSystem.js'), 'utf8');
  const i = quelle.indexOf("case 'buff_speed':");
  assert.ok(i > 0, 'buff_speed nicht gefunden');
  const block = quelle.slice(i, i + 200);
  assert.ok(block.indexOf('speedMult') >= 0,
    'der Brunnenbuff aendert kein Lauftempo — der Text waere falsch');
});

test('Auch die englischen Fassungen nennen die Achse', () => {
  // Das Muster, das den Fehler erzeugt hat, laeuft in beide Richtungen: hier
  // war Englisch schon richtig und Deutsch nicht.
  const quelle = fs.readFileSync(path.join(WURZEL, 'js/eventSystem.js'), 'utf8');
  const zeilen = quelle.split(/\r?\n/)
    .filter((z) => z.indexOf('fountain.outcome.speed_') >= 0 && z.indexOf('%') >= 0);
  assert.ok(zeilen.length >= 4, 'die vier Brunnentexte fehlen: ' + zeilen.length);
  zeilen.forEach((z) => {
    const ok = z.indexOf('Lauftempo') >= 0 || z.indexOf('move speed') >= 0;
    assert.ok(ok, 'nennt die Achse nicht: ' + z.trim());
  });
});
