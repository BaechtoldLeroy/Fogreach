// tests/aktnummerImText.test.js — Kein Spieltext nennt eine Aktnummer fest.
//
// Intern sind Akte Indizes in STORY_ACTS (0..4), die Titelkarte zeigt
// "Akt " + (index + 1). b296 hat die BERECHNETEN Stellen angeglichen
// (tests/aktnummern.test.js) — Harrens Satz nach der geheimen Sitzung trug die
// Zahl aber fest im Text: "Akt 2 beginnt hier", waehrend die Titelkarte gleich
// danach "Akt 3 — Das Doppelspiel" zeigte. Feste Zahlen im Text laufen
// zwangslaeufig auseinander, sobald sich die Zaehlung aendert; Texte nennen den
// Akt deshalb beim NAMEN.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function jsDateien(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(jsDateien(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('Kein Text im Spiel nennt "Akt N" / "Act N" als feste Zahl', () => {
  const funde = [];
  for (const f of jsDateien(path.join(__dirname, '..', 'js'))) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((zeile, i) => {
      const t = zeile.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (/console\.(log|warn|error)/.test(t)) return;
      // Nur innerhalb eines Stringliterals: Anfuehrungszeichen, dann ohne
      // weiteres Anfuehrungszeichen bis "Akt 2" / "Act 2". Kein \b davor: im
      // Quelltext steht "\n\nAkt 2", und zwischen dem n und dem A liegt keine
      // Wortgrenze — genau dieser Satz waere sonst durchgerutscht.
      if (/['"`][^'"`]*(?:\\n|[^A-Za-z])(Akt|Act) [0-9]/.test(t)) {
        funde.push(path.relative(path.join(__dirname, '..'), f) + ':' + (i + 1));
      }
    });
  }
  assert.deepStrictEqual(funde, [],
    'feste Aktnummer im Text (stattdessen den Aktnamen nennen): ' + funde.join(', '));
});

test('Harrens Satz nach der geheimen Sitzung nennt den Akt beim Namen', () => {
  const hub = fs.readFileSync(path.join(__dirname, '..', 'js', 'scenes', 'HubSceneV2.js'), 'utf8');
  assert.ok(hub.includes('Hier beginnt das Doppelspiel'), 'deutscher Satz fehlt');
  assert.ok(hub.includes('The Double Game begins here'), 'englischer Satz fehlt');
});
