// tests/wissensfragmentAbstand.test.js — das Wissensfragment liegt nicht auf
// dem Spieler.
//
// Gemeldet: "Wissensfragmente nicht so nahe vom Player-Spawn generieren."
//
// Die Rolle wurde in einem Band von 60 bis 220 px um den Spieler abgelegt. Bei
// 60 px liegt sie praktisch unter ihm — und weil sie sich beim Beruehren SELBST
// einsammelt, war sie aufgehoben, bevor man sie gesehen hat.
//
// Gemessen wird am laufenden Spiel: der Ereignisgriff wird oft ausgeloest und
// jedes Mal der echte Abstand der gesetzten Rolle genommen. Eine Nachrechnung
// der Formel wuerde den Rueckfall auf den Spielerplatz uebersehen, der bei zu
// grossem Mindestabstand zuschlaegt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const VERSUCHE = 40;

let H = null;
let messung = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);

  messung = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var ES = window.EventSystem;
    var def = null;
    ES.EVENT_TYPES.forEach(function (e) { if (e && e.id === 'lore_fragment') def = e; });
    if (!def) return { fehler: 'lore_fragment nicht gefunden' };

    var abstaende = [];
    for (var i = 0; i < ${VERSUCHE}; i++) {
      def.handler(sc);
      var rolle = null;
      sc.children.list.forEach(function (o) {
        if (o.texture && o.texture.key === 'proc_scroll') rolle = o;
      });
      if (!rolle) return { fehler: 'keine Rolle gesetzt (Durchgang ' + i + ')' };
      abstaende.push(Math.hypot(rolle.x - player.x, rolle.y - player.y));
    }
    return {
      abstaende: abstaende,
      min: Math.min.apply(null, abstaende),
      max: Math.max.apply(null, abstaende),
      aufDemSpieler: abstaende.filter(function (d) { return d < 40; }).length,
      band: [ES.LORE_ABSTAND_MIN, ES.LORE_ABSTAND_MAX]
    };
  })()`);
  assert.ok(!messung.fehler, messung.fehler);
});
after(async () => { if (H) await H.shutdown(); });

// Die Grenzen stehen hier als FESTE Zahlen, nicht als Verweis auf die
// Konstanten im Spiel. Der erste Entwurf las das Band ueber den Export und
// verglich dagegen — dann wandert die Zusicherung mit, sobald jemand die Zahl
// senkt, und der Test bleibt gruen. Genau das ist bei der Mutationsprobe
// passiert: Untergrenze zurueck auf 60, alle drei Tests weiter gruen.
const NIE_NAEHER_ALS = 100;
const MITTE_MINDESTENS = 200;
const NIE_WEITER_ALS = 460;

test('Keine Rolle landet nahe beim Spieler', () => {
  // Die Rolle sammelt sich beim Beruehren selbst ein: was neben dem Spieler
  // liegt, ist aufgehoben, bevor man es gesehen hat.
  const nah = messung.abstaende.filter((d) => d < NIE_NAEHER_ALS);
  assert.strictEqual(nah.length, 0,
    nah.length + ' von ' + VERSUCHE + ' Rollen lagen naeher als '
    + NIE_NAEHER_ALS + ' px (naechste: ' + Math.round(messung.min) + ' px)');
});

test('Die Rollen liegen im Schnitt deutlich abseits', () => {
  // Nicht nur der schlechteste Fall zaehlt. Ein Band, das meistens knapp
  // ausfaellt, ist derselbe Fehler mit besserem Wuerfelglueck.
  const sortiert = messung.abstaende.slice().sort((a, b) => a - b);
  const mitte = sortiert[Math.floor(sortiert.length / 2)];
  assert.ok(mitte >= MITTE_MINDESTENS,
    'die mittlere Rolle lag ' + Math.round(mitte) + ' px entfernt, erwartet mindestens '
    + MITTE_MINDESTENS + ' px');
});

test('Die Rolle bleibt erreichbar und fliegt nicht aus dem Raum', () => {
  assert.ok(messung.max <= NIE_WEITER_ALS,
    'eine Rolle lag ' + Math.round(messung.max) + ' px entfernt, mehr als '
    + NIE_WEITER_ALS + ' px');
});
