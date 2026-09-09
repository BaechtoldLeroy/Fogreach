// Regression #107: gewoehnliche Gegner hatten kein maxHp.
//
// spawnEnemy setzte enemy.hp, maxHp entstand aber nur in bedingten Zweigen:
// Edikt-Buff (enemy.js:776), Raum-Modus (:806), Elite (:1905), Boss (:2702).
// Ein normaler Gegner in einem normalen Raum blieb ohne.
//
// Gemessen in den Spieltest-Protokollen (#96), Format hp/maxHp:
//     6x  HP 2/undefined      3x  HP 3/undefined
//    11x  HP 83/83            (Elite/Boss — dort wird maxHp gesetzt)
//
// Der Rueckfall in enemy.js:1999 nimmt dann die AKTUELLE HP als Maximum. Ein
// Gegner mit 1 von 3 HP erscheint dadurch unversehrt, und jede Prozentrechnung
// (Hinrichtungs-Schwellen, Heilanteile) sitzt auf falscher Basis.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LF = String.fromCharCode(10);
const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'js', 'enemy.js'), 'utf8');
const ZEILEN = QUELLE.split(LF).map((z) => z.trim());

test('#107: spawnEnemy setzt maxHp direkt neben hp', () => {
  const i = ZEILEN.findIndex((z) => z.startsWith('enemy.hp = Math.max(1, Math.round(hp * statScale));'));
  assert.ok(i >= 0, 'die hp-Zuweisung im Normalpfad wurde nicht gefunden');
  // Innerhalb der naechsten zehn Zeilen, damit keine Bedingung dazwischen passt.
  const fenster = ZEILEN.slice(i, i + 10);
  assert.ok(fenster.some((z) => z === 'enemy.maxHp = enemy.hp;'),
    'maxHp wird im Normalpfad nicht gesetzt — Gegner ohne Buff/Modus/Elite bleiben ohne Maximum');
});

test('#107: die Zuweisung steht unbedingt, nicht in einem if-Zweig', () => {
  const i = ZEILEN.findIndex((z) => z.startsWith('enemy.hp = Math.max(1, Math.round(hp * statScale));'));
  const j = ZEILEN.findIndex((z, k) => k > i && z === 'enemy.maxHp = enemy.hp;');
  assert.ok(j > i, 'Zuweisung nicht gefunden');
  // Zwischen hp und maxHp darf kein if/try/for stehen — sonst waere sie wieder bedingt.
  const dazwischen = ZEILEN.slice(i + 1, j)
    .filter((z) => z.startsWith('if ') || z.startsWith('if(') || z.startsWith('try') || z.startsWith('for '));
  assert.deepStrictEqual(dazwischen, [],
    'zwischen hp und maxHp steht eine Bedingung: ' + dazwischen.join(' | '));
});

test('#107: die bedingten Nachsetzer bleiben erhalten', () => {
  // Sie korrigieren maxHp nach einem Multiplikator und muessen weiter laufen.
  const treffer = QUELLE.split('enemy.maxHp = enemy.hp').length - 1;
  assert.ok(treffer >= 3,
    'erwartet: Normalpfad plus die bedingten Nachsetzer, gefunden ' + treffer);
});

// ---------------------------------------------------------------------------
// Der Schwierigkeitsregler skalierte hp, aber nicht maxHp.
//
// spawnEnemy setzt maxHp aus der ungeskalierten HP und multipliziert die HP
// erst danach mit dem Schwierigkeitsfaktor. Auf "schwer" (1,5) stand damit
// hp=2 gegen maxHp=1; drawEnemyHpBar klemmt hp/maxHp auf 1, der Balken blieb
// also voll, bis die HP auf das alte Maximum gefallen war. Gemeldet als
// "der erste Schlag macht keinen Schaden, er macht nur den Balken sichtbar" —
// auf Tiefe 1 gingen so die halben Lebenspunkte unsichtbar weg.
//
// Diese Pruefung laeuft im Testkopf, misst also das VERHALTEN und nicht den
// Quelltext: die drei Zuweisungen richtig zu sortieren ist leicht, sie beim
// naechsten Umbau wieder zu vertauschen ebenso.
// ---------------------------------------------------------------------------

const { launch } = require('../tools/headless/index.js');

test('Schwierigkeit: hp und maxHp bleiben im Gleichschritt', async () => {
  const H = await launch({ search: '?autostart=1&dungeon=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    const ok = await H.waitForScene('GameScene', { maxRounds: 400 });
    assert.ok(ok, 'GameScene wurde nicht erreicht');

    const mess = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var vorher = window.DIFFICULTY_MULTIPLIER;
      var raus = {};
      [1, 1.5, 0.6].forEach(function (mult) {
        window.DIFFICULTY_MULTIPLIER = mult;
        var e = spawnEnemy.call(sc, 400, 300, 1);
        if (!e) { raus[mult] = null; return; }
        raus[mult] = { hp: e.hp, maxHp: e.maxHp };
        e.destroy();
      });
      window.DIFFICULTY_MULTIPLIER = vorher;
      return raus;
    })()`);

    ['1', '1.5', '0.6'].forEach((k) => {
      const v = mess[k];
      assert.ok(v, 'kein Gegner bei Schwierigkeit ' + k);
      assert.strictEqual(v.hp, v.maxHp,
        'Schwierigkeit ' + k + ': hp=' + v.hp + ' aber maxHp=' + v.maxHp
        + ' — der Balken rechnet ' + (v.hp / v.maxHp).toFixed(2) + ' und wird geklemmt');
    });

    // Und der Regler muss ueberhaupt noch etwas bewirken: waere die
    // Skalierung versehentlich ganz herausgefallen, stuende hp === maxHp
    // ebenfalls, aber "schwer" waere wirkungslos.
    assert.ok(mess['1.5'].hp > mess['1'].hp,
      'schwer erhoeht die Lebenspunkte nicht mehr: '
      + mess['1'].hp + ' -> ' + mess['1.5'].hp);
  } finally {
    await H.shutdown();
  }
});
