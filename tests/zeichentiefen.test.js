// tests/zeichentiefen.test.js — die Treppe verschwindet hinter Props (#142).
//
// BEFUND: Treppen lagen manchmal unter dem, was daneben stand. Zwei Ursachen:
//
//   1) Die Treppe (roomManager.js) und die gewoehnlichen Props (roomTemplates.js)
//      trugen BEIDE die Zeichentiefe 40. Bei gleicher Tiefe entscheidet Phaser
//      nach der Anzeigeliste, also nach der Erzeugungsreihenfolge — mal lag das
//      Fass vorn, mal die Treppe. Daher das "manchmal".
//   2) Statue, Saeule und Altar lagen auf 42 und damit immer vor der Treppe.
//
// ENTSCHEIDUNG: Props liegen VOR der Treppe, sonst sieht das Layout falsch aus.
// Die Treppe ist deshalb die unterste Ebene ueber der Bodendeko. Damit sie
// trotzdem auffindbar bleibt, raeumt raeumePropsAufTreppen() jedes Prop weg, das
// ihren Freiraum betritt — das ist die einzige Sicherung, und sie wird hier
// eigens geprueft.
//
// Der erste Block haette Punkt 1 rein rechnerisch verhindert. Der zweite prueft
// dasselbe am laufenden Spiel, damit die Tabelle nicht sauber sein kann, waehrend
// der Code weiter nackte Zahlen setzt. Der dritte nimmt das Sicherheitsnetz
// einzeln auseinander — in einem echten Raum feuert es zu selten, um es dort
// nachweisen zu koennen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(WURZEL, p), 'utf8');

if (!globalThis.window) require('./setup');
loadGameModule('js/roomTemplates.js');
loadGameModule('js/roomManager.js');
const T = globalThis.window.WELT_TIEFEN;
const raeume_frei = globalThis.window.raeumePropsAufTreppen;

// Jede Ebene, auf der ein Prop landen kann. Kommt eine neue dazu, gehoert sie
// hier hinein — sonst prueft der Test sie nicht.
const PROP_EBENEN = ['PROP_SCHATTEN', 'PROP', 'UEBER_PROP', 'PROP_HOCH'];

// ---------------------------------------------------------------------------
// Rechnerisch: die Tabelle selbst
// ---------------------------------------------------------------------------

test('Die Tiefen stehen an EINER benannten Stelle', () => {
  assert.ok(T && typeof T === 'object', 'window.WELT_TIEFEN fehlt');
  ['BODENDEKO_MAX', 'TREPPE', 'PROP_SCHATTEN', 'WAND', 'WANDKANTE', 'PROP',
    'UEBER_PROP', 'PROP_HOCH', 'GEGNER'].forEach((k) => {
    assert.strictEqual(typeof T[k], 'number', 'WELT_TIEFEN.' + k + ' fehlt oder ist keine Zahl');
  });
});

test('Keine Prop-Tiefe ist gleich der Treppen-Tiefe', () => {
  // DAS ist der Kern von #142. Gleiche Tiefe heisst zufaellige Reihenfolge, und
  // ein Fehler, der nur manchmal auftritt, ist der teuerste.
  PROP_EBENEN.forEach((k) => {
    assert.notStrictEqual(T[k], T.TREPPE,
      'WELT_TIEFEN.' + k + ' teilt sich die Tiefe ' + T.TREPPE + ' mit der Treppe — '
      + 'dann entscheidet die Anzeigeliste, wer vorn liegt');
  });
});

test('Die Treppe liegt unter allen Props, aber ueber der Bodendeko', () => {
  PROP_EBENEN.forEach((k) => {
    assert.ok(T.TREPPE < T[k],
      'Treppe (' + T.TREPPE + ') liegt nicht unter ' + k + ' (' + T[k] + ')');
  });
  assert.ok(T.TREPPE > T.BODENDEKO_MAX,
    'Treppe (' + T.TREPPE + ') verschwindet in der Bodendeko (bis ' + T.BODENDEKO_MAX + ')');
});

test('Alles bleibt unter der Gegnerebene', () => {
  ['TREPPE', 'WAND', 'WANDKANTE'].concat(PROP_EBENEN).forEach((k) => {
    assert.ok(T[k] < T.GEGNER,
      k + ' (' + T[k] + ') liegt nicht unter der Gegnerebene (' + T.GEGNER + ')');
  });
});

test('Die Ebenen sind paarweise verschieden', () => {
  const werte = ['TREPPE', 'WAND', 'WANDKANTE'].concat(PROP_EBENEN).map((k) => T[k]);
  assert.strictEqual(new Set(werte).size, werte.length,
    'zwei Weltebenen teilen sich eine Tiefe: ' + werte.join(', '));
});

// ---------------------------------------------------------------------------
// Quelltext: die Tabelle nuetzt nichts, wenn daneben weiter Zahlen stehen
// ---------------------------------------------------------------------------

test('Treppe und Props holen ihre Tiefe aus der Tabelle', () => {
  const rm = lies('js/roomManager.js');
  const rt = lies('js/roomTemplates.js');
  const treppen = rm.match(/setDepth\([^)]*\)\.refreshBody\(\)/g) || [];
  assert.ok(treppen.length >= 2,
    'die beiden Treppen-Aufrufe (regulaer + Notfall) sind nicht mehr auffindbar');
  treppen.forEach((s) => {
    assert.ok(s.indexOf('WELT_TIEFEN.TREPPE') >= 0,
      'Treppe setzt eine nackte Tiefe: ' + s);
  });
  assert.ok(rt.indexOf('WELT_TIEFEN.PROP_HOCH : window.WELT_TIEFEN.PROP') >= 0,
    'spawnObstacle setzt die Prop-Tiefe nicht mehr ueber die Tabelle');
  [['js/roomManager.js', rm], ['js/roomTemplates.js', rt]].forEach(([name, src]) => {
    const nackt = src.match(/setDepth\((?:3[4-9]|4[0-9]|50)(?:\.\d+)?\)/g) || [];
    assert.deepStrictEqual(nackt, [],
      name + ' setzt wieder nackte Zahlen in der Weltebene: ' + nackt.join(', '));
  });
});

// ---------------------------------------------------------------------------
// Am laufenden Spiel: echte Raeume, echte Sprites
// ---------------------------------------------------------------------------

const RAEUME = 8;

test('Echte Raeume: kein Prop teilt die Tiefe der Treppe oder verdeckt sie', async (t) => {
  const FREIRAUM = 44; // halbes Treppen-Sprite (80/2) + 4px Marge
  const H = await launchDungeon({ depth: 1 });
  t.after(async () => { await H.shutdown(); });

  const raeume = [];
  for (let i = 0; i < RAEUME; i++) {
    if (i > 0) H.run(`window.enterRoom(window.game.scene.getScene('GameScene'));`);
    raeume.push(JSON.parse(H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var st = sc.stairsGroup ? sc.stairsGroup.getChildren() : [];
      // Die Hindernis-Gruppe haengt global, NICHT an der Szene (main.js).
      var obs = (window.obstacles && window.obstacles.getChildren)
        ? window.obstacles.getChildren() : [];
      var treppen = st.map(function (s) { return { d: s.depth, x: s.x, y: s.y }; });
      var props = [], waende = 0;
      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];
        if (!o || o.active === false) continue;
        var typ = (o.getData && o.getData('type')) || '';
        // Waende sind unsichtbare Physik-Rechtecke, keine Props.
        if (typ === 'obstacleWall' || (o.getData && o.getData('isMergedWall'))) { waende++; continue; }
        props.push({ typ: typ, d: o.depth, x: o.x, y: o.y,
                     w: o.displayWidth || 32, h: o.displayHeight || 32 });
      }
      return JSON.stringify({ treppen: treppen, props: props, waende: waende,
                              gegner: sc.enemyLayer ? sc.enemyLayer.depth : null });
    })()`)));
    await H.settle(() => false, { maxRounds: 2 });
  }

  const alleProps = raeume.reduce((n, r) => n + r.props.length, 0);
  const alleTreppen = raeume.reduce((n, r) => n + r.treppen.length, 0);
  const alleWaende = raeume.reduce((n, r) => n + r.waende, 0);
  assert.ok(alleTreppen > 0, 'kein einziger Raum hatte eine Treppe — der Test misst nichts');
  assert.ok(alleProps > 0, 'kein einziger Raum hatte ein Prop — der Test misst nichts');
  // Waende liegen in derselben Gruppe wie die Props und ihre displayWidth ist die
  // ganze Spanne. Wuerde das Sicherheitsnetz sie mitnehmen, fehlte rund um jede
  // Treppe ein Stueck Wand — ein Loch im Raum.
  assert.ok(alleWaende > 0, 'kein Raum hatte Wandkoerper — das Netz hat sie verschluckt');

  const verdeckt = [];
  raeume.forEach((r, ri) => {
    r.treppen.forEach((s) => {
      r.props.forEach((p) => {
        assert.notStrictEqual(p.d, s.d,
          'Raum ' + ri + ': Prop "' + (p.typ || '?') + '" liegt auf derselben Tiefe '
          + p.d + ' wie die Treppe — dann entscheidet der Zufall der Anzeigeliste');
        assert.ok(p.d > s.d,
          'Raum ' + ri + ': Prop "' + (p.typ || '?') + '" (Tiefe ' + p.d
          + ') liegt nicht vor der Treppe (Tiefe ' + s.d + ')');
        if (Math.abs(p.x - s.x) - p.w / 2 < FREIRAUM
            && Math.abs(p.y - s.y) - p.h / 2 < FREIRAUM) {
          verdeckt.push('Raum ' + ri + ': ' + (p.typ || '?'));
        }
      });
      if (r.gegner !== null) {
        assert.ok(s.d < r.gegner,
          'Raum ' + ri + ': die Treppe (' + s.d + ') liegt nicht unter der Gegnerebene ('
          + r.gegner + ')');
      }
    });
    r.props.forEach((p) => {
      if (r.gegner !== null) {
        assert.ok(p.d < r.gegner,
          'Raum ' + ri + ': Prop "' + (p.typ || '?') + '" (' + p.d
          + ') liegt nicht unter der Gegnerebene (' + r.gegner + ')');
      }
    });
  });
  assert.deepStrictEqual(verdeckt, [],
    'Props stehen im Freiraum der Treppe und verdecken sie: ' + verdeckt.join(', '));
});

// ---------------------------------------------------------------------------
// Das Sicherheitsnetz einzeln — im echten Raum feuert es zu selten
// ---------------------------------------------------------------------------

function machProp(x, y, opts) {
  opts = opts || {};
  const daten = Object.assign({ type: 'barrel' }, opts.daten || {});
  const o = {
    x: x, y: y,
    displayWidth: opts.w || 32,
    displayHeight: opts.h || 32,
    active: true,
    zerstoert: false,
    body: { enable: true },
    getData: (k) => daten[k],
    destroy() { o.active = false; o.zerstoert = true; }
  };
  return o;
}

// Szene mit einer Treppe im Ursprung. _templateWalls fuehrt dieselben Objekte
// mit; ein zerstoertes Prop muss auch dort verschwinden.
function machSzene(props) {
  return {
    stairsGroup: { getChildren: () => [{ x: 0, y: 0 }] },
    _templateWalls: props.slice()
  };
}
const machGruppe = (props) => ({ getChildren: () => props });

test('Das Netz ist ueberhaupt erreichbar', () => {
  assert.strictEqual(typeof raeume_frei, 'function',
    'window.raeumePropsAufTreppen fehlt — dann ist die Treppe ungesichert');
});

test('Ein Fass auf der Treppe fliegt raus', () => {
  const fass = machProp(0, 0, { daten: { type: 'barrel', destructible: true } });
  const szene = machSzene([fass]);
  assert.strictEqual(raeume_frei(szene, machGruppe([fass])), 1);
  assert.strictEqual(fass.zerstoert, true);
  assert.strictEqual(fass.body.enable, false, 'der Koerper blockiert weiter');
  assert.deepStrictEqual(szene._templateWalls, [],
    'das zerstoerte Prop haengt noch im Aufraeum-Verzeichnis');
});

test('Ein Prop OHNE destructible-Flag fliegt genauso raus', () => {
  // Frueher fasste der erste Durchgang nur `destructible`-Props an. Alles andere
  // blieb stehen — und liegt seit #142 garantiert VOR der Treppe.
  const brocken = machProp(0, 0, { daten: { type: 'obstacleRock' } });
  assert.strictEqual(raeume_frei(machSzene([brocken]), machGruppe([brocken])), 1,
    'ein Prop ohne destructible-Flag bleibt auf der Treppe stehen');
  assert.strictEqual(brocken.zerstoert, true);
});

test('Ein Prop, das nur mit dem Sprite hineinragt, fliegt auch raus', () => {
  // Mitte 58px neben der Treppenmitte: das Rechteck der Treppe (halbe Breite 40)
  // beruehrt es gerade noch nicht, das Sprite (halbe Breite 16) ragt aber in den
  // reservierten Freiraum. Genau der Fall, der frueher stehenblieb.
  const kiste = machProp(58, 0, { w: 32, h: 32, daten: { type: 'crate', destructible: true } });
  assert.strictEqual(raeume_frei(machSzene([kiste]), machGruppe([kiste])), 1,
    'ein Prop im Freiraum der Treppe bleibt stehen');
});

test('Ein Prop in sicherem Abstand bleibt stehen', () => {
  // Sonst raeumt das Netz halbe Raeume leer, nur weil irgendwo eine Treppe ist.
  const fass = machProp(200, 200, { daten: { type: 'barrel', destructible: true } });
  assert.strictEqual(raeume_frei(machSzene([fass]), machGruppe([fass])), 0);
  assert.strictEqual(fass.zerstoert, false);
});

test('Eine Wandspanne bleibt stehen, auch wenn ihre Mitte nah liegt', () => {
  // Waende liegen in derselben Gruppe. Ihre displayWidth ist die GANZE Spanne,
  // also faellt fast jede Wand in den Abstandstest — sie zu entfernen risse ein
  // Loch in den Raum.
  const wand = machProp(30, 0, { w: 400, h: 32, daten: { type: 'obstacleWall', isMergedWall: true } });
  assert.strictEqual(raeume_frei(machSzene([wand]), machGruppe([wand])), 0);
  assert.strictEqual(wand.zerstoert, false, 'das Netz hat eine Wand eingerissen');
});

test('Mit der Fackel verschwindet auch ihr Licht', () => {
  // Die Brazier-Lichter liegen aus Perf-Gruenden in EINEM geteilten Graphics und
  // ueberleben ein destroy() sonst als Leuchten ohne Quelle.
  const RT = globalThis.window.RoomTemplates;
  const alt = RT.removeBrazierGlow;
  const gerufen = [];
  RT.removeBrazierGlow = (sc, x, y) => { gerufen.push({ x, y }); return true; };
  try {
    const fackel = machProp(10, 10, { daten: { type: 'brazier', destructible: true } });
    assert.strictEqual(raeume_frei(machSzene([fackel]), machGruppe([fackel])), 1,
      'die Fackel bleibt auf der Treppe stehen');
    assert.deepStrictEqual(gerufen, [{ x: 10, y: 10 }],
      'das Licht der Fackel wurde nicht mit entfernt');
  } finally {
    RT.removeBrazierGlow = alt;
  }
});

test('Ohne Treppe raeumt das Netz nichts weg', () => {
  const fass = machProp(0, 0, { daten: { type: 'barrel', destructible: true } });
  const szene = { stairsGroup: { getChildren: () => [] }, _templateWalls: [fass] };
  assert.strictEqual(raeume_frei(szene, machGruppe([fass])), 0);
  assert.strictEqual(fass.zerstoert, false);
});

test('Eine Truhe wird NICHT geraeumt — das waere zerstoerte Beute', () => {
  // Der Freiraum von 44 px ist grosszuegig gewaehlt, damit auch ein knapp
  // danebenstehendes Fass fliegt. Bei einer Truhe hiesse dasselbe, BEUTE zu
  // zerstoeren — schlimmer als eine seltene Verdeckung. Gemessen: mit dem
  // geweiteten Netz und ohne diese Ausnahme flog eine Truhe 28 px neben einer
  // Treppe.
  const truhe = machProp(0, 0, { daten: { type: 'chest', destructible: true } });
  const szene = { stairsGroup: { getChildren: () => [{ x: 20, y: 20 }] }, _templateWalls: [] };
  assert.strictEqual(raeume_frei(szene, machGruppe([truhe])), 0,
    'die Truhe wurde geraeumt');
  assert.strictEqual(truhe.zerstoert, false, 'die Truhe wurde zerstoert');

  // Gegenprobe: ein Fass an derselben Stelle MUSS fliegen. Sonst waere
  // "alles stehen lassen" die einfachste Art, den Test oben zu bestehen.
  const fass = machProp(0, 0, { daten: { type: 'barrel', destructible: true } });
  const szene2 = { stairsGroup: { getChildren: () => [{ x: 20, y: 20 }] }, _templateWalls: [] };
  assert.strictEqual(raeume_frei(szene2, machGruppe([fass])), 1,
    'das Fass blieb stehen — das Netz greift gar nicht mehr');
});
