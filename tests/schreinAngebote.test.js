// tests/schreinAngebote.test.js — Der Schrein zieht Segen und Preis (#71).
//
// Vorher standen am Schrein zwei feste Knoepfe, und der Preis hing an der
// SPIELERSTUFE: -30 % Ruestung plus 0,5 % je Stufe bis -50 %, waehrend der
// Ertrag bei x1,25 stehen blieb. Der Handel wurde also mit jedem Aufstieg
// teurer — und er hing an der falschen Groesse, denn die Gefahr kommt aus der
// Tiefe, nicht aus dem Level.
//
// Dazu kam ein Fehler, der jede Zahl am Schrein wertlos machte:
// window.eventBuffs wurde NIRGENDS zurueckgesetzt. Gemessen: nach
// leaveDungeonForHub war brunnenBuffs geleert, eventBuffs stand unveraendert
// da. Zehnmal "Macht" waren 1,25^10 Schaden bei praktisch keiner Ruestung.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
const WURZEL = path.join(__dirname, '..');

// eventSystem.js registriert Texte und braucht dafuer i18n. Mehr nicht — die
// Ziehung selbst ist reine Rechnerei.
W.i18n = W.i18n || {
  register() {},
  t(k, v) { return k + (v ? JSON.stringify(v) : ''); },
};
W.Phaser = W.Phaser || { Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) } };

loadGameModule('js/eventSystem.js');
const E = W.EventSystem;

// Steuerbare Zufallsquelle: gibt die Werte der Reihe nach zurueck.
function folge(werte) {
  let i = 0;
  return () => werte[i++ % werte.length];
}

test('Der Preis trifft nie dieselbe Groesse wie der Segen', () => {
  // Sonst huebe sich der Handel auf: +20 % Schaden gegen -20 % Schaden ist
  // keine Entscheidung, sondern ein Knopf ohne Wirkung.
  let angebote = 0;
  for (let i = 0; i < 2000; i++) {
    E.schreinAngebote(5, Math.random).forEach((a) => {
      angebote++;
      assert.notStrictEqual(a.segen.feld, a.preis.feld,
        'Segen und Preis auf ' + a.segen.feld);
    });
  }
  assert.ok(angebote > 3000, 'zu wenige Angebote geprueft: ' + angebote);
});

test('Zwei Angebote nebeneinander sind nie derselbe Segen', () => {
  for (let i = 0; i < 500; i++) {
    const a = E.schreinAngebote(5, Math.random);
    assert.strictEqual(a.length, 2, 'es sollen zwei Angebote sein');
    assert.notStrictEqual(a[0].segen.id, a[1].segen.id, 'zweimal derselbe Segen');
  }
});

test('Der Ertrag waechst mit der Tiefe und deckelt', () => {
  // rng = 0 zieht immer den ersten Eintrag: Macht, Basis 25 %, +1,5 je Tiefe,
  // Deckel 55 %.
  const bei = (t) => E.schreinAngebote(t, () => 0)[0].segenProzent;
  assert.strictEqual(bei(1), 25, 'Tiefe 1');
  assert.ok(bei(10) > bei(1), 'Tiefe 10 muss ueber Tiefe 1 liegen');
  assert.ok(bei(40) <= 55, 'Deckel bei 55 %, bekam ' + bei(40));
  assert.strictEqual(bei(40), bei(100), 'ueber dem Deckel bleibt es stehen');
});

test('Der Preis haengt NICHT an der Spielerstufe', () => {
  // Der alte Fehler: playerLevel steuerte den Abzug. Wer aufstieg, zahlte mehr
  // fuer denselben Ertrag.
  W.playerLevel = 1;
  const niedrig = E.schreinAngebote(5, () => 0)[0].preisProzent;
  W.playerLevel = 60;
  const hoch = E.schreinAngebote(5, () => 0)[0].preisProzent;
  assert.strictEqual(niedrig, hoch,
    'die Spielerstufe darf den Preis nicht bewegen (' + niedrig + ' vs ' + hoch + ')');
});

test('Der Preis kommt aus einem Band, nicht als feste Zahl', () => {
  // Zwei Begegnungen sollen sich unterscheiden.
  const klein = E.schreinAngebote(5, folge([0, 0, 0]))[0].preisProzent;
  const gross = E.schreinAngebote(5, folge([0, 0, 0.999]))[0].preisProzent;
  assert.ok(gross > klein, 'das Band ist wirkungslos: ' + klein + ' vs ' + gross);
});

test('Alle vier Segen und alle vier Preise kommen vor', () => {
  const segen = {}, preise = {};
  for (let i = 0; i < 3000; i++) {
    E.schreinAngebote(5, Math.random).forEach((a) => {
      segen[a.segen.id] = 1; preise[a.preis.id] = 1;
    });
  }
  assert.strictEqual(Object.keys(segen).length, E.SCHREIN_SEGEN.length, 'Segen fehlen');
  assert.strictEqual(Object.keys(preise).length, E.SCHREIN_PREISE.length, 'Preise fehlen');
});

test('Angenommen wird multiplikativ auf die Lauf-Buffs geschrieben', () => {
  W.eventBuffs = null;
  W.recalcDerived = () => {};
  const a = E.schreinAngebote(1, () => 0)[0];   // Macht +25 %, Ruestung -30 %
  E.schreinAnwenden(a);
  assert.ok(Math.abs(W.eventBuffs.damageMult - 1.25) < 1e-9, 'Segen nicht angekommen');
  assert.ok(Math.abs(W.eventBuffs.armorMult - 0.70) < 1e-9, 'Preis nicht angekommen');
  E.schreinAnwenden(a);
  assert.ok(Math.abs(W.eventBuffs.damageMult - 1.5625) < 1e-9, 'zweimal muss stapeln');
  W.eventBuffs = null;
});

// --- Der Fehler, der jede Zahl wertlos machte ------------------------------

test('Schrein-Buffs enden mit dem Durchgang', () => {
  // Geprueft am Quelltext, weil leaveDungeonForHub eine ganze Szene braucht:
  // die Ruecksetzung muss eventBuffs ausdruecklich mitnehmen.
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'main.js'), 'utf8');
  const i = s.indexOf('function leaveDungeonForHub');
  assert.ok(i > 0, 'leaveDungeonForHub nicht gefunden');
  const block = s.slice(i);
  assert.ok(/window\.eventBuffs\s*=\s*null/.test(block),
    'eventBuffs wird beim Rueckweg in den Hub nicht geleert — der Schrein-Handel '
    + 'gilt dann fuer die ganze Sitzung und stapelt ueber Laeufe');
  assert.ok(/window\.tiefenBuffs\s*=\s*null/.test(block),
    'tiefenBuffs wird beim Rueckweg in den Hub nicht geleert');
});

test('Tiefen-Buffs enden auch beim Aufstieg im Endlosmodus', () => {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'roomManager.js'), 'utf8');
  const i = s.indexOf('const newDepth = (window.DUNGEON_DEPTH || 1) + 1;');
  assert.ok(i > 0, 'Tiefenaufstieg nicht gefunden');
  assert.ok(/window\.tiefenBuffs\s*=\s*null/.test(s.slice(i, i + 600)),
    'im Endlosmodus geht der Lauf weiter — ohne diese Loeschung gaelte das '
    + 'Gluecksspiel-Zeichen ueber die Tiefe hinaus');
});

test('Das Angriffstempo der Lauf-Buffs wird wirklich verrechnet', () => {
  // Der Schrein kann Angriffstempo als Segen ODER als Preis ziehen. Fehlt die
  // Zeile in recalcDerived, sind beide wirkungslos — und der Handel waere ein
  // halber Knopf.
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'inventory.js'), 'utf8');
  assert.ok(/buffs\.attackSpeedMult/.test(s),
    'recalcDerived verrechnet eventBuffs.attackSpeedMult nicht');
});
