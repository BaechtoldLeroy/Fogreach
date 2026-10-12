// tests/markenname.test.js — Das Spiel heisst Fogreach, nicht Demonfall.
//
// "Demonfall" war der Arbeitsname. Sichtbar darf er nirgends mehr stehen:
// Tab-Titel, Favicon, Texte. Bewusst ERLAUBT bleiben die Speicher-Schluessel
// (demonfall.slot…, demonfall_audio, …): sie umzubenennen hiesse, allen
// Spielern Spielstaende und Einstellungen zu nehmen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

test('Tab-Titel ist Fogreach', () => {
  assert.strictEqual((/<title>([^<]*)<\/title>/.exec(html) || [])[1], 'Fogreach');
});

test('Favicon zeigt auf eine vorhandene Pixel-Datei, kein altes SVG', () => {
  const m = /<link rel="icon"[^>]*href="([^"?]+)/.exec(html);
  assert.ok(m, 'kein Favicon-Verweis');
  assert.ok(!/^data:/.test(m[1]), 'Favicon ist noch das eingebettete SVG');
  assert.ok(fs.existsSync(path.join(WURZEL, m[1])), 'Favicon-Datei fehlt: ' + m[1]);
  assert.ok(fs.existsSync(path.join(WURZEL, 'favicon.ico')), 'favicon.ico fehlt');
});

test('Kein sichtbares "Demonfall" in index.html und den Spieltexten', () => {
  const funde = [];
  const pruefe = (datei, text) => {
    text.split(/\r?\n/).forEach((z, i) => {
      // Schluessel (demonfall.x, demonfall_x, demonfall:x, demonfall-x) zaehlen nicht.
      if (/demonfall(?![._:\-])/i.test(z)) funde.push(datei + ':' + (i + 1) + ' ' + z.trim().slice(0, 80));
    });
  };
  pruefe('index.html', html);
  const js = path.join(WURZEL, 'js');
  const alle = [];
  (function lauf(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) lauf(p); else if (e.name.endsWith('.js')) alle.push(p);
  }); })(js);
  alle.forEach((p) => pruefe(path.relative(WURZEL, p), fs.readFileSync(p, 'utf8')));
  assert.deepStrictEqual(funde, []);
});
