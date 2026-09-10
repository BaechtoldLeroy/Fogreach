// tests/keineVerwaistenFaehigkeiten.test.js — jede Fähigkeits-Funktion in
// player.js muss auch aufgerufen werden.
//
// Version 060 hat den Erwerb auf den Skillbaum umgestellt und dabei die alten
// Definitionen aus ABILITY_DEFS entfernt. Die IMPLEMENTIERUNGEN in player.js
// blieben stehen — spinAttack, dashSlash und throwDagger hatten seither keinen
// Aufrufer mehr.
//
// Das waere blosser Ballast gewesen, wenn nicht zwei bezahlte Passivknoten
// darin verhungert waeren: Kettenblitz und Giftklinge standen nur im alten
// Wirbel. Investiert, bezahlt, wirkungslos — und drei Messungen hintereinander
// haben genau diese tote Funktion aufgerufen und waren gruen.
//
// Dieser Test prueft die KLASSE, nicht die drei Namen: eine neue
// Fähigkeits-Funktion, die niemand aufruft, faellt sofort auf.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const wurzel = path.join(__dirname, '..', 'js');
const spieler = fs.readFileSync(path.join(wurzel, 'player.js'), 'utf8');
const faehigkeiten = fs.readFileSync(path.join(wurzel, 'abilitySystem.js'), 'utf8');

/**
 * Bewusst NICHT verdrahtete Funktionen.
 *
 * Wer hier etwas einträgt, sagt damit: das ist bekannt und gewollt. Der
 * Kommentar an der Funktion selbst muss den Grund nennen.
 */
const GEDULDET = {
  shieldBash: 'Schildstoss — hat keinen Nachfolger, steht fuer spaeter (b239)'
};

/**
 * abilitySystem.js OHNE Kommentare.
 *
 * Der erste Entwurf suchte den Namen in der ganzen Datei — und eine Erwaehnung
 * im Kommentar zaehlte als Aufruf. Die Mutationsprobe (einen Aufruf abhaengen)
 * blieb deshalb gruen, obwohl die Faehigkeit ins Leere lief. Genau die Sorte
 * Test, die dieser Test verhindern soll.
 */
const faehigkeitenOhneKommentare = faehigkeiten
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

/** Ruft abilitySystem diese Funktion wirklich auf? */
function wirdAufgerufen(name) {
  return new RegExp('window\\.' + name + '\\s*(\\.call\\b|\\()')
    .test(faehigkeitenOhneKommentare);
}

/** Alle Funktionen in player.js, die nach einer Fähigkeit aussehen. */
function faehigkeitsFunktionen() {
  const treffer = [];
  const re = /^function ((?:cast|shadow)[A-Z]\w*)\s*\(/gm;
  let m;
  while ((m = re.exec(spieler)) !== null) treffer.push(m[1]);
  return treffer;
}

test('Jede cast/shadow-Funktion wird von abilitySystem aufgerufen', () => {
  const funktionen = faehigkeitsFunktionen();
  // Gegenprobe: findet der Test ueberhaupt etwas? Sonst waere er immer gruen.
  assert.ok(funktionen.length >= 8,
    'nur ' + funktionen.length + ' Faehigkeits-Funktionen gefunden — '
    + 'das Muster greift nicht mehr');

  const verwaist = funktionen.filter((n) => !wirdAufgerufen(n));
  assert.deepStrictEqual(verwaist, [],
    'diese Funktionen ruft niemand auf: ' + verwaist.join(', ')
    + ' — passive Knoten darin wuerden still verhungern');
});

test('Der Wirbel des Spielers ruft castWhirlwind, nicht eine zweite Fassung', () => {
  // Der konkrete Fall hinter dem Test darueber. Faellt er, steht der
  // Kettenblitz wieder am falschen Ort.
  const i = faehigkeitenOhneKommentare.indexOf('whirlwind: {');
  assert.ok(i > 0, 'die Faehigkeit Wirbelwind wurde nicht gefunden');
  assert.ok(faehigkeitenOhneKommentare.slice(i, i + 1200).indexOf('castWhirlwind') > 0,
    'Wirbelwind ruft nicht mehr castWhirlwind auf');
});

test('Die ersetzten Alt-Funktionen sind wirklich weg', () => {
  // spinAttack, dashSlash und throwDagger wurden durch castWhirlwind,
  // castCycloneStrike und castFrostNova ersetzt. Kaeme eine davon zurueck,
  // waere sofort wieder unklar, welche der beiden Fassungen im Spiel laeuft.
  ['spinAttack', 'dashSlash', 'throwDagger'].forEach((n) => {
    assert.ok(spieler.indexOf('function ' + n + '(') < 0,
      n + ' steht wieder in player.js — sie wurde ersetzt, nicht vergessen');
  });
});

test('Was geduldet wird, traegt einen Grund an der Funktion', () => {
  Object.keys(GEDULDET).forEach((n) => {
    const i = spieler.indexOf('function ' + n + '(');
    assert.ok(i > 0, n + ' steht gar nicht mehr in player.js — '
      + 'dann gehoert der Eintrag aus GEDULDET raus');
    // Der Hinweis steht ueber der Funktion, nicht irgendwo in der Datei.
    const davor = spieler.slice(Math.max(0, i - 1200), i);
    assert.ok(davor.indexOf('MOMENTAN NICHT VERWENDET') >= 0,
      n + ' wird geduldet, sagt aber an der Funktion nicht, dass sie brachliegt');
  });
});
