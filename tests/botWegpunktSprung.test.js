// tests/botWegpunktSprung.test.js — Der uebersprungene Wegpunkt darf den
// Aufgeben-Zaehler des Spieltest-Bots nicht scharf halten.
//
// MESSUNG, die dahinter steht: ueber 13 Stillstaende eines Dauerlaufs stand
// der Planfehler-Zaehler JEDES Mal auf 0 und die Verfolgung nie ueber 28 —
// bei einer Aufgeben-Schwelle von 50 Runden, waehrend der Bot 3000 bis 6400
// Runden feststeckte. Die Aufgabe-Spur eines weiteren Stillstands zeigte
// 7 von 7 Ruecksetzungen aus dem Wegpunkt-Zweig, 0 aus Zielwechseln.
//
// URSACHE: Der Sprung ueber einen unerreichbaren Wegpunkt erhoehte notwegIdx.
// Der Zielblock liest `notwegIdx > besterWegpunkt` als Fortschritt entlang
// des Weges und setzt verfolgtRunden auf 0. Da der Sprung nach 20 Runden
// feuert und der Ausstieg erst bei 50 greift, kam der Ausstieg NIE zustande.
// Das ist keine Wahrscheinlichkeit, sondern Arithmetik: 20 < 50.
//
// Die Regel steht ZWEIMAL im Bot (Treppen- und Verfolgungs-Zweig). Deshalb
// prueft dieser Test beide Stellen und schlaegt an, wenn eine dritte Kopie
// dazukommt, die niemand mitgezogen hat.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = path.join(__dirname, '..', 'tools', 'headless', 'index.js');

/** Kommentare entfernen — sonst liest der Test seine eigene Begruendung als
 *  Beleg. Genau dieser Fehlalarm ist hier schon einmal passiert. */
function ohneKommentare(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const CODE = ohneKommentare(fs.readFileSync(QUELLE, 'utf8'));

test('Wegpunkt-Sprung: beide Stellen zaehlen den Sprung nicht als Fortschritt', () => {
  const stellen = [];
  let ab = 0;
  for (;;) {
    const i = CODE.indexOf('wpZaeh >= 20', ab);
    if (i < 0) break;
    stellen.push(i);
    ab = i + 1;
  }
  assert.strictEqual(stellen.length, 2,
    'erwartet: genau 2 Wegpunkt-Sprungstellen, gefunden: ' + stellen.length);

  stellen.forEach((i, n) => {
    const block = CODE.slice(i, i + 400);
    assert.ok(block.includes('notwegIdx++'),
      'Stelle ' + (n + 1) + ': kein notwegIdx++ im Sprungblock');
    assert.ok(/besterWegpunkt\s*=\s*Math\.max\(\s*besterWegpunkt\s*,\s*notwegIdx\s*\)/.test(block),
      'Stelle ' + (n + 1) + ': der Sprung hebt besterWegpunkt nicht mit — '
      + 'damit gilt er als Fortschritt und setzt den Aufgeben-Zaehler zurueck');
  });
});

test('Wegpunkt-Sprung: die Schwellen stehen noch im gemessenen Verhaeltnis', () => {
  // Der Sprung (20) muss kleiner bleiben als das Aufgeben (50), sonst greift
  // die Begruendung oben nicht mehr — und wer die Zahlen dreht, soll hier
  // darueber stolpern statt im naechsten Dauerlauf.
  assert.ok(CODE.includes('wpZaeh >= 20'), 'Sprung-Schwelle nicht mehr 20');
  const m = CODE.match(/gibAufNach\s*=\s*opts\.gibAufNach\s*\|\|\s*(\d+)/);
  assert.ok(m, 'Aufgeben-Schwelle nicht gefunden');
  assert.ok(Number(m[1]) > 20,
    'Aufgeben-Schwelle (' + m[1] + ') liegt nicht mehr ueber der Sprung-Schwelle (20)');
});

test('Zielwechsel: der Verfolgungsstand wird je Ziel gemerkt, nicht verworfen', () => {
  // Zweiter Ruecksetzpfad — sichtbar geworden, nachdem der erste zu war.
  // Gemessen: 5 Zielwechsel in 160 Runden, immer zwischen denselben zwei
  // Treppen (41|7 <-> 41|41). Jeder Wechsel nullte verfolgtRunden, planFehler
  // und den Weg; Pendeln hielt den Ausstieg damit dauerhaft entschaerft.
  const i = CODE.indexOf('if (k !== verfolgtKey) {');
  assert.ok(i > 0, 'Zielwechsel-Block nicht gefunden');
  const block = CODE.slice(i, i + 600);
  assert.ok(block.includes('G.zielStand.set(verfolgtKey'),
    'der Stand des verlassenen Ziels wird nicht gesichert');
  assert.ok(block.includes('G.zielStand.get(k)'),
    'der Stand des neuen Ziels wird nicht wiederhergestellt');
  assert.ok(!block.includes('verfolgtKey = k; verfolgtRunden = 0'),
    'verfolgtRunden wird beim Zielwechsel weiterhin bedingungslos genullt');
});

test('Freigabe: Staende werden halbiert, nicht geleert', () => {
  // Die Aufgeben-Liste wird freigegeben, sobald dem Bot die Ziele ausgehen —
  // sonst streicht er sich Gegner UND Treppen weg und steht endgueltig still.
  // Diese Freigabe loeschte auch die Verfolgungsstaende, und damit lief der
  // Ausstieg in einen Kreis:
  //     bremsen -> sperren -> alles gesperrt -> freigeben -> Uhr auf 0
  // Gemessen in Kampagne 2: hoechster Zaehler 28 bei Schwelle 50, fuenf
  // Ruecksetzungen in 160 Runden, alle von der Stelle "kein Ziel mehr".
  //
  // Halbieren durchbricht den Kreis, ohne ihn zu kappen.
  const zeilen = CODE.split('\n').map((z) => z.trim());
  const stellen = [];
  zeilen.forEach((z, n) => { if (z === 'aufgegeben.clear();') stellen.push(n); });
  assert.ok(stellen.length >= 3,
    'erwartet: mindestens 3 Freigabestellen, gefunden: ' + stellen.length);

  let geleert = 0; let halbiert = 0;
  stellen.forEach((n) => {
    const folge = zeilen[n + 1] || '';
    if (folge === 'G.zielStand.clear();') geleert++;
    else if (folge.startsWith('staendeHalbieren(')) halbiert++;
    else assert.fail('Zeile ' + (n + 1) + ': aufgegeben.clear() ohne Standbehandlung — ' + folge);
  });

  // Nur der Raumwechsel darf noch vollstaendig leeren: dort gibt es die alten
  // Ziele wirklich nicht mehr. Alles andere haelt den Ausstieg sonst offen.
  assert.strictEqual(geleert, 1,
    'genau eine Freigabe (der Raumwechsel) darf leeren, gefunden: ' + geleert);
  assert.ok(halbiert >= 2,
    'die uebrigen Freigaben halbieren nicht, gefunden: ' + halbiert);

  // Und die Rechnung SELBST pruefen, nicht nur den Aufruf. Ohne das ging
  // eine Mutation durch, die staendeHalbieren still auf Nullung umstellte —
  // die Aufrufstelle sah unveraendert aus.
  const iFn = CODE.indexOf('const staendeHalbieren =');
  assert.ok(iFn > 0, 'staendeHalbieren nicht gefunden');
  const rumpf = CODE.slice(iFn, iFn + 400);
  const inSchleife = rumpf.slice(rumpf.indexOf('forEach'));
  const gesetzt = (inSchleife.match(/vr:[^,]*/) || ['?'])[0];
  assert.ok(gesetzt.includes('Math.floor') && gesetzt.includes('/ 2'),
    'staendeHalbieren halbiert nicht — der Stand wird gesetzt als: ' + gesetzt);
});

test('Halbierung: der Zaehler erreicht die Schwelle trotz Freigaben', () => {
  // Die eigentliche Zusicherung: mit Halbierung konvergiert die Uhr gegen die
  // Schwelle, mit Leerung nie. Ohne diese Rechnung waere der Test nur eine
  // Formpruefung.
  const SCHWELLE = 50;
  const laufBis = (nachFreigabe) => {
    let uhr = 0;
    for (let runde = 0; runde < 2000; runde++) {
      uhr++;
      if (uhr >= SCHWELLE) return runde;      // Ausstieg feuert
      // Alle 30 Runden gehen die Ziele aus -> Freigabe.
      if (runde % 30 === 29) uhr = nachFreigabe(uhr);
    }
    return null;                               // nie ausgeloest
  };

  assert.strictEqual(laufBis(() => 0), null,
    'Voraussetzung entfaellt: mit Leerung feuert der Ausstieg doch');
  const mitHalbierung = laufBis((u) => Math.floor(u / 2));
  assert.ok(mitHalbierung !== null,
    'mit Halbierung feuert der Ausstieg immer noch nicht');
});

test('Blockierer-Zweig: wirkungslose Schuebe loesen ein Umgehen aus', () => {
  // Der Deckel im Blockierer-Zweig war zahnlos: 30 Runden schlagen, 90 Runden
  // Pause, von vorn. Nach der Pause ist die Lage unveraendert, also greift die
  // Bedingung sofort wieder. Gemessen am Kettenmeister: dreimal dieselbe Mauer,
  // 6105 bis 6223 Runden je Versuch, Boss konstant 225/225.
  const i = CODE.indexOf('stats.schlagAufgegeben');
  assert.ok(i > 0, 'Blockierer-Deckel nicht gefunden');
  const block = CODE.slice(i - 400, i + 1200);

  assert.ok(block.includes('schlagOhneWirkung++'),
    'der Zweig zaehlt wirkungslose Schuebe nicht');
  assert.ok(block.includes('schlagPause = 300'),
    'Stufe 1 fehlt: der Zweig wird nicht lange genug gesperrt');
  assert.ok(/notweg = null; notwegIdx = 0;/.test(block),
    'Stufe 1 verwirft den Weg nicht — die Wegsuche bekommt keinen neuen Versuch');
  assert.ok(block.includes('aufgegeben.add(zielKey(e2))'),
    'Stufe 2 fehlt: das Ziel wird nie als unerreichbar gesperrt');
});

test('Blockierer-Zweig: die Umgehung greift, das Zuschlagen bleibt erlaubt', () => {
  // Modell des Zweigs, mit den Schwellen aus dem Code. Zweck: zeigen, dass die
  // Umgehung bei ausbleibender Wirkung KOMMT und bei echtem Schaden AUSBLEIBT —
  // eine reine Formpruefung liesse beides offen.
  const lauf = (hpFaellt) => {
    let schlagRunden = 0; let schlagPause = 0;
    let schlagHp = null; let ohneWirkung = 0;
    let hp = 225;
    for (let runde = 0; runde < 5000; runde++) {
      if (schlagPause > 0) { schlagPause--; continue; }
      const summe = hp;
      if (schlagRunden === 0) schlagHp = summe;
      if (++schlagRunden > 30) {
        schlagRunden = 0;
        if (schlagHp !== null && summe >= schlagHp) ohneWirkung++;
        else ohneWirkung = 0;
        schlagHp = null;
        if (ohneWirkung >= 2) return { umgangen: true, runde };
        schlagPause = 90;
      } else if (hpFaellt) {
        hp -= 1;                       // ein Treffer je Runde
      }
    }
    return { umgangen: false, runde: null };
  };

  const ohneSchaden = lauf(false);
  assert.ok(ohneSchaden.umgangen,
    'ohne jeden Trefferpunkt kommt die Umgehung nicht zustande');
  assert.ok(ohneSchaden.runde < 300,
    'die Umgehung kommt zu spaet (Runde ' + ohneSchaden.runde
    + ') — gemessen wurden zuvor ueber 6000 Runden');

  assert.strictEqual(lauf(true).umgangen, false,
    'die Umgehung feuert auch dann, wenn der Bot tatsaechlich Schaden macht');
});
