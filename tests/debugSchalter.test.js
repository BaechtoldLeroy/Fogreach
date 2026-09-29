// tests/debugSchalter.test.js — ?versteck= und ?sonder=.
//
// Zwei Schalter zum Ansehen, was sich sonst schwer herstellen laesst:
// Elaras Kammer haengt an einem Queststand ueber mehrere Akte, und die sechs
// Sondergegner treten je nach Tiefe und Akt auf, nie zusammen.
//
// Beide haengen am DebugGate — ohne ?debug=1 (oder localhost) duerfen sie
// NICHTS tun. Das ist der Teil, der im ausgelieferten Spiel zaehlt.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`(function () {
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    window._playerInvincible = true;
    return 1;
  })()`);
});

/** Setzt eine Debug-Flagge, ruft die Funktion, raeumt wieder auf. */
function mitFlagge(such, code) {
  return H.run(`(function () {
    var G = window.DebugGate;
    var echteSuche = window.location.search;
    var echtAktiv = G.aktiv;
    try {
      Object.defineProperty(window.location, 'search', { value: ${JSON.stringify(such)}, configurable: true });
    } catch (e) { return { fehler: 'search nicht setzbar' }; }
    G._vergessen();
    try { return (function () { ${code} })(); }
    finally {
      try { Object.defineProperty(window.location, 'search', { value: echteSuche, configurable: true }); } catch (e) {}
      G.aktiv = echtAktiv;
      G._vergessen();
    }
  })()`);
}

const sonderZahl = () => H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e._debugSonder; }).length`);

test('?sonder=1 setzt alle sechs Sondergegner', () => {
  const r = mitFlagge('?debug=1&sonder=1', `
    var sc = window.game.scene.getScene('GameScene');
    return window._debugSondergegnerSetzen(sc);
  `);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r, 6, 'es wurden ' + r + ' statt sechs gesetzt');
  assert.strictEqual(sonderZahl(), 6);
  const typen = H.run(`enemies.getChildren().filter(function (e) { return e && e._debugSonder; })
    .map(function (e) { return e._debugSonder; }).sort().join(',')`);
  assert.strictEqual(typen, 'alarm,beschwoerer,geschwuer,hund,priester,springer');
});

test('?sonder=alarm,hund setzt genau diese zwei', () => {
  const r = mitFlagge('?debug=1&sonder=alarm,hund', `
    var sc = window.game.scene.getScene('GameScene');
    return window._debugSondergegnerSetzen(sc);
  `);
  assert.strictEqual(r, 2);
  assert.strictEqual(
    H.run(`enemies.getChildren().filter(function (e) { return e && e._debugSonder; })
      .map(function (e) { return e._debugSonder; }).sort().join(',')`), 'alarm,hund');
});

test('Ein Tippfehler setzt nichts und sagt es', () => {
  const r = mitFlagge('?debug=1&sonder=alrm', `
    var sc = window.game.scene.getScene('GameScene');
    var echt = console.warn, gesagt = [];
    console.warn = function () { gesagt.push(Array.prototype.join.call(arguments, ' ')); };
    var n;
    try { n = window._debugSondergegnerSetzen(sc); } finally { console.warn = echt; }
    return { n: n, gesagt: gesagt.join(' | ') };
  `);
  assert.strictEqual(r.n, 0, 'ein unbekannter Name hat etwas gesetzt');
  assert.match(r.gesagt, /alrm/, 'der Tippfehler blieb stumm: ' + r.gesagt);
  assert.match(r.gesagt, /alarm/, 'die Warnung nennt die bekannten Namen nicht');
});

test('Ohne Debug-Modus tut der Schalter nichts', () => {
  // Der eigentliche Punkt: im ausgelieferten Spiel muss ?sonder= wirkungslos
  // sein. Sonst haette jeder Spieler sechs Sondergegner auf Tiefe 1.
  //
  // Das Tor richtig SCHLIESSEN ist der heikle Teil. Ein erster Anlauf hat
  // `DebugGate.aktiv` ueberschrieben — wirkungslos, denn `flagge()` ruft die
  // modulinterne Funktion, nicht die exportierte. Der Test war gruen, ohne
  // irgendetwas zu pruefen. Geschlossen ist das Tor nur, wenn weder ?debug=1
  // in der Adresse steht NOCH der Rechnername lokal ist.
  const r = H.run(`(function () {
    var G = window.DebugGate;
    var l = window.location;
    var alt = { search: l.search, hostname: l.hostname, protocol: l.protocol };
    var setzen = function (k, v) {
      try { Object.defineProperty(l, k, { value: v, configurable: true }); } catch (e) {}
    };
    setzen('search', '?sonder=1');       // Flagge gesetzt ...
    setzen('hostname', 'fogreach.example');  // ... Gate aber zu
    setzen('protocol', 'https:');
    G._vergessen();
    var sc = window.game.scene.getScene('GameScene');
    try {
      return { offen: G.aktiv(), gesetzt: window._debugSondergegnerSetzen(sc) };
    } finally {
      Object.keys(alt).forEach(function (k) { setzen(k, alt[k]); });
      G._vergessen();
    }
  })()`);
  assert.strictEqual(r.offen, false, 'das Tor liess sich nicht schliessen — der Test prueft nichts');
  assert.strictEqual(r.gesetzt, 0, 'der Schalter wirkte trotz geschlossenem Tor');
  assert.strictEqual(sonderZahl(), 0);
});

test('Die beiden Flaggen stehen in der Liste des Gates', () => {
  // Steht eine Flagge nicht drin, warnt das Gate nicht, wenn jemand sie ohne
  // ?debug=1 setzt — und man sucht den Fehler im Spiel statt in der Adresse.
  const quelle = require('fs').readFileSync('js/debugGate.js', 'utf8');
  const block = quelle.slice(quelle.indexOf('BEKANNTE_FLAGGEN'), quelle.indexOf('];', quelle.indexOf('BEKANNTE_FLAGGEN')));
  ['versteck', 'sonder'].forEach((f) => {
    assert.ok(block.indexOf("'" + f + "'") >= 0, f + ' fehlt in BEKANNTE_FLAGGEN');
  });
});

// ?versteck= taugt nur, wenn Elara danach WIRKLICH da ist. Ob sie dasteht und
// welche Szene laeuft, entscheidet versteckBesuchFaellig() aus dem Queststand
// — der Schalter muss also genau den Stand herstellen, den die gewuenschte
// Szene braucht. Die Kammer allein waere ein leerer Raum.
[['versteck', 'versteck'], ['werkstatt', 'werkstatt'], ['bruch_nacht', 'bruch_nacht']]
  .forEach(([wert, erwartet]) => {
    test('?versteck=' + wert + ' macht genau diese Szene faellig', () => {
      const faellig = H.run(`(function () {
        window._debugVersteckStandSetzen(${JSON.stringify(wert)});
        return window.versteckBesuchFaellig();
      })()`);
      assert.strictEqual(faellig, erwartet,
        'faellig ist "' + faellig + '" statt "' + erwartet + '"');
    });
  });

test('?versteck=leer ruehrt den Queststand nicht an', () => {
  // Nur der Raum, ohne sie — zum Ansehen der Einrichtung. Geprueft wird, dass
  // der Schalter NICHTS aendert; ob danach ein Besuch faellig ist, haengt am
  // Stand, den der Spieler mitbringt, und geht diesen Schalter nichts an.
  const vorher = H.run('JSON.stringify(window.questSystem.getQuestSaveData())');
  H.run(`window._debugVersteckStandSetzen('leer')`);
  const nachher = H.run('JSON.stringify(window.questSystem.getQuestSaveData())');
  assert.strictEqual(nachher, vorher, '"leer" hat den Queststand veraendert');
});
