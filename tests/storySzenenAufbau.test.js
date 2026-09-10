// tests/storySzenenAufbau.test.js — auch die Elara-Szenen schreiben sich Wort
// fuer Wort auf (#139).
//
// Der Aufbau steckte als Methode in HubSceneV2 und galt nur fuer Hub-Dialoge.
// Die inszenierten Szenen in js/storyScenes.js setzten ihren Text in einem
// Stueck und raeumten ihn nach festen 900 ms wieder ab.
//
// Jetzt treibt DialogTypewriter.anTextobjekt beide an. Dieser Test faehrt eine
// Attrappe von Phaser: ein Textobjekt, das mitschreibt, was gesetzt wird, und
// eine Uhr, die der Test selbst stellt. So laesst sich pruefen, dass der Text
// WAECHST — und nicht nur, dass am Ende alles dasteht.

const { test } = require('node:test');
const assert = require('node:assert');

function ladeStoryScenes() {
  delete require.cache[require.resolve('../js/dialogTypewriter.js')];
  global.window = global.window || {};
  require('../js/dialogTypewriter.js');
  delete require.cache[require.resolve('../js/storyScenes.js')];
  require('../js/storyScenes.js');
  return global.window.storyScenes;
}

/**
 * Eine Szenen-Attrappe. `takte(n)` laesst n Ticks vergehen und gibt zurueck,
 * was das Textobjekt zwischendurch angezeigt hat.
 */
function attrappe() {
  const gesetzt = [];
  const textObj = {
    scene: true, text: '',
    setText(t) { this.text = t; gesetzt.push(t); return this; },
    setOrigin() { return this; }, setDepth() { return this; },
    setScrollFactor() { return this; },
    destroy() { this.scene = null; }
  };
  const takte = [];
  const verzoegert = [];
  const scene = {
    cameras: { main: { width: 800, height: 600 } },
    add: {
      text: () => textObj,
      graphics: () => ({
        setDepth() { return this; }, setScrollFactor() { return this; },
        lineStyle() { return this; }, strokeRect() { return this; },
        fillStyle() { return this; }, fillRect() { return this; },
        clear() { return this; }, destroy() {}
      })
    },
    input: { on() {}, off() {} },
    tweens: { add: () => null },
    time: {
      now: 0,
      addEvent(cfg) { const e = { cfg, remove() { e.weg = true; } }; takte.push(e); return e; },
      delayedCall(ms, fn) { verzoegert.push({ ms, fn }); return { remove() {} }; }
    }
  };
  return {
    scene, textObj, gesetzt, verzoegert,
    /** n Ticks zu je msProTick Millisekunden. */
    takte(n, msProTick) {
      for (let i = 0; i < n; i++) {
        scene.time.now += (msProTick || 60);
        takte.forEach((e) => { if (!e.weg) e.cfg.callback(); });
      }
    }
  };
}

test('Die Elara-Szene setzt ihren Text nicht in einem Stueck', () => {
  const S = ladeStoryScenes();
  const A = attrappe();
  S.playElaraFirstCrack(A.scene, () => {});
  // Der volle Text steht schon beim Anlegen im Textobjekt (dort wird er
  // vermessen); der Aufbau leert es als Erstes wieder.
  assert.strictEqual(A.gesetzt[0], '',
    'vor dem Aufbau wurde nicht geleert: ' + JSON.stringify(A.gesetzt[0]));

  A.takte(40);
  const laengen = A.gesetzt.map((t) => t.length);
  const gewachsen = laengen.filter((l, i) => i > 0 && l > laengen[i - 1]).length;
  assert.ok(gewachsen >= 5,
    'der Text ist nur ' + gewachsen + ' mal gewachsen — das ist kein Aufbau');
  assert.ok(A.textObj.text.indexOf('nicht in die Presse') > 0,
    'am Ende steht nicht der volle Text: ' + JSON.stringify(A.textObj.text));
});

test('Die Lesepause laeuft erst NACH dem Aufbau an', () => {
  // Vorher stand hier eine feste Verzoegerung von 900 ms, gestartet sofort.
  // Bei langsamem Tempo haette sie den Text mitten im Satz abgeschnitten.
  const S = ladeStoryScenes();
  const A = attrappe();
  S.playElaraCamp(A.scene, () => {});
  assert.strictEqual(A.verzoegert.length, 0,
    'die Lesepause laeuft schon, bevor ein Wort geschrieben ist');
  A.takte(60);
  assert.strictEqual(A.verzoegert.length, 1,
    'nach dem Aufbau wurde keine Lesepause gestartet');
  assert.strictEqual(A.verzoegert[0].ms, 900, 'die Lesepause hat sich geaendert');
});

test('Der Sprecher wird aus der Zeile gelesen, nicht gepflegt', () => {
  // Die Tonhoehe des Klangs haengt am Sprechernamen. Sie hier von Hand zu
  // fuehren hiesse, sie bei jeder neuen Szene zu vergessen.
  const S = ladeStoryScenes();
  const TW = global.window.DialogTypewriter;
  assert.notStrictEqual(TW.tonhoehe('ELARA'), TW.tonhoehe('ALDRIC'),
    'Elara und Aldric klingen gleich');
  assert.strictEqual(TW.tonhoehe('ELARA'), TW.tonhoehe('ELARA'),
    'derselbe Sprecher klingt nicht stabil gleich');
  assert.ok(S, 'storyScenes nicht geladen');
});

test('anTextobjekt raeumt seinen Takt weg, wenn das Textobjekt stirbt', () => {
  // Ein Timer, der auf ein zerstoertes Textobjekt schreibt, wirft bei jedem
  // Frame — und zwar leise, weil Phaser den Fehler im Timer schluckt.
  ladeStoryScenes();
  const TW = global.window.DialogTypewriter;
  const A = attrappe();
  const lauf = TW.anTextobjekt(A.scene, A.textObj, 'Ein zwei drei vier fuenf', {});
  A.takte(2);
  A.textObj.destroy();
  assert.doesNotThrow(() => A.takte(5), 'der Takt schreibt auf ein totes Textobjekt');
  assert.strictEqual(lauf.ueberspringen(), true,
    'nach dem Abbruch laesst sich nicht mehr ueberspringen');
});

test('Ueberspringen zeigt sofort den vollen Text', () => {
  ladeStoryScenes();
  const TW = global.window.DialogTypewriter;
  const A = attrappe();
  let fertig = 0;
  const voll = 'Erste Zeile hier. Zweite Zeile dort.';
  const lauf = TW.anTextobjekt(A.scene, A.textObj, voll, { onFertig: () => { fertig++; } });
  A.takte(2);
  assert.ok(A.textObj.text.length < voll.length, 'der Text war schon fertig');
  assert.strictEqual(lauf.ueberspringen(), true);
  assert.strictEqual(A.textObj.text, voll, 'nach dem Ueberspringen fehlt Text');
  assert.strictEqual(fertig, 1, 'onFertig lief nicht genau einmal');
  assert.strictEqual(lauf.ueberspringen(), false, 'ein zweites Ueberspringen meldet Erfolg');
});

test('Auch der Dungeon-Dialog baut sich Wort fuer Wort auf', () => {
  // Gemeldet: "Elara-Text wird immer noch nicht Wort fuer Wort eingeblendet im
  // Dungeon". Stimmt — ihre Auftritte IM DUNGEON laufen ueber
  // EventSystem.showEventChoiceDialog, einen dritten Weg neben HubSceneV2 und
  // storyScenes. Der stand weiter in einem Stueck da.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'eventSystem.js'), 'utf8');
  const i = quelle.indexOf('function showEventChoiceDialog');
  assert.ok(i > 0, 'showEventChoiceDialog nicht gefunden');
  const block = quelle.slice(i, i + 4000);
  assert.ok(block.indexOf('anTextobjekt') > 0,
    'der Dungeon-Dialog benutzt den gemeinsamen Aufbau nicht');
  assert.ok(block.indexOf('ueberspringen') > 0,
    'der Aufbau laesst sich nicht ueberspringen');
  assert.ok(block.indexOf('abbrechen') > 0,
    'der Takt wird beim Schliessen nicht abgeraeumt — er schreibt dann auf ein '
    + 'zerstoertes Textobjekt');
});

test('Der Aufbau startet NACH der Hoehenmessung des Titels', () => {
  // Der Kasten richtet die Knopfreihe an titleText.height aus. Leerte man den
  // Text vorher, fiele die Hoehe auf eine Zeile zusammen und die Knoepfe
  // ruecken nach oben — der Kasten wuechse beim Schreiben mit.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'eventSystem.js'), 'utf8');
  const i = quelle.indexOf('function showEventChoiceDialog');
  const block = quelle.slice(i, i + 4000);
  const messung = block.indexOf('_buttonsTop = _blockTop + titleText.height');
  const aufbau = block.indexOf('anTextobjekt');
  assert.ok(messung > 0, 'die Hoehenmessung ist verschwunden');
  assert.ok(aufbau > messung,
    'der Aufbau startet VOR der Hoehenmessung — die Knopfreihe verrutscht');
});
