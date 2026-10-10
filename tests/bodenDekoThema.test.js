// tests/bodenDekoThema.test.js — #184: Boden-Deko je Raumthema hinter ?boden=neu.
//
// Zu den sechzehn Rissen und Flecken (tests/bodenspuren.test.js) kommt mit
// der Flagge Deko, die zum Raum passt. Sie darf am Spiel NICHTS aendern
// ausser dem Bild:
//   - ohne Flagge keine Tafel, kein einziges Bild davon,
//   - mit Flagge nur Arten des Raumthemas,
//   - nur auf Boden, nicht an Tueren, nicht unter der Treppe,
//   - ohne Koerper und ganz unten in der Zeichenfolge.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const sharp = require('sharp');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const TAFEL = path.join(__dirname, '..', 'assets', 'tiles', 'bodendeko_atlas.png');

async function startenMit(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await h.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) { await h.shutdown(); throw new Error('GameScene wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 10 });
  return h;
}

// Alles, was im gebauten Raum liegt und aus der Deko-Tafel stammt.
const ERHEBEN = `(function () {
  var sc = window.game.scene.getScene('GameScene');
  var grid = sc._minimapWallsGrid || [];
  var T = sc._minimapTileSize || 32;
  var treppen = sc.stairsGroup ? sc.stairsGroup.getChildren().map(function (t) { return { x: t.x, y: t.y }; }) : [];
  var tueren = (sc.__treppenTuerListe || []).map(function (d) { return { x: d.x, y: d.y }; });
  var stuecke = [];
  (sc.children.list || []).forEach(function (c) {
    if (!c || !c.texture || c.texture.key !== 'bodendeko_atlas') return;
    var tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    stuecke.push({
      x: c.x, y: c.y, art: c.getData('bodenDeko'),
      zeichen: (grid[ty] || '')[tx] || null,
      koerper: !!c.body, tiefe: c.depth, boden: !!c.getData('isFloor')
    });
  });
  return {
    tafel: sc.textures.exists('bodendeko_atlas'),
    stuecke: stuecke, treppen: treppen, tueren: tueren,
    treppenTiefe: window.WELT_TIEFEN.TREPPE
  };
})()`;

const NAECHSTER = `(function () {
  var sc = window.game.scene.getScene('GameScene');
  window.enterRoom(sc);
  return 1;
})()`;

test('die Tafel: sechzehn Arten zu vier Bildern, keines leer, keine zwei gleich', async () => {
  const m = await sharp(TAFEL).metadata();
  assert.strictEqual(m.width + 'x' + m.height, '128x512');
  const { data } = await sharp(TAFEL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const masken = [];
  for (let z = 0; z < 16; z++) {
    for (let s = 0; s < 4; s++) {
      const mk = [];
      let n = 0;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const a = data[(((z * 32 + y) * 128) + s * 32 + x) * 4 + 3] > 24 ? 1 : 0;
        mk.push(a); n += a;
      }
      assert.ok(n >= 20, 'Art ' + z + ', Bild ' + s + ' ist fast leer (' + n + ' Pixel)');
      masken.push(mk);
    }
  }
  for (let i = 0; i < masken.length; i++) {
    for (let j = i + 1; j < masken.length; j++) {
      let d = 0;
      for (let k = 0; k < masken[i].length; k++) d += Math.abs(masken[i][k] - masken[j][k]);
      assert.ok(d > 8, 'Bild ' + i + ' und ' + j + ' sind dasselbe');
    }
  }
});

test('das Thema: theme.id, Vorlagenname, Gebiet, Boden, sonst Keller', () => {
  // Rein, ohne Spiel: die Datei laedt nur window.BodenDeko.
  const vm = require('vm');
  const fs = require('fs');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'bodenDeko.js'), 'utf8'), ctx);
  const BD = ctx.window.BodenDeko;
  assert.strictEqual(BD.thema({ theme: { id: 'crypt' } }), 'crypt');
  assert.strictEqual(BD.thema({ theme: { id: 'sewer' }, name: 'RitualVault' }), 'sewer');
  assert.strictEqual(BD.thema({ name: 'RitualVault' }), 'bloodstained');
  assert.strictEqual(BD.thema({ name: 'DungeonLibrary' }), 'archiv');
  assert.strictEqual(BD.thema({ name: 'Irgendwas' }), 'dungeon');
  // Ohne sprechenden Namen: der Boden, darueber die Gebiete der Story.
  assert.strictEqual(BD.thema({ name: 'Spiral' }, { boden: 'floor_cobble' }), 'sewer');
  assert.strictEqual(BD.thema({ name: 'Spiral' }, { boden: 'floor_stone', tiefe: 12, akt: 2 }), 'crypt');
  assert.strictEqual(BD.thema({ name: 'Spiral' }, { boden: 'floor_tile_ornate', tiefe: 12, akt: 2 }), 'cathedral');
  assert.strictEqual(BD.thema({ name: 'Spiral' }, { boden: 'floor_tile_ornate', tiefe: 22, akt: 3 }), 'bloodstained');
  // Das Gebiet haengt am Akt, nicht nur an der Tiefe (wie gebietsName).
  assert.strictEqual(BD.thema({ name: 'Spiral' }, { boden: 'floor_stone', tiefe: 22, akt: 0 }), 'dungeon');
  assert.strictEqual(BD.thema({ theme: { id: 'unbekannt' } }), 'dungeon');
  // Jede Art eines Themas gibt es in der Tafel.
  Object.keys(BD.THEMEN).forEach((t) => BD.THEMEN[t].forEach((a) => {
    assert.ok(BD.ARTEN.indexOf(a) >= 0, t + ': ' + a + ' fehlt in der Tafel');
  }));
});

test('ohne Flagge: keine Tafel, kein Stueck', async () => {
  const H = await launchDungeon({ depth: 5 });
  try {
    for (let i = 0; i < 3; i++) {
      const r = H.run(ERHEBEN);
      assert.strictEqual(r.tafel, false, 'die Tafel wird auch ohne Flagge geladen');
      assert.strictEqual(r.stuecke.length, 0, r.stuecke.length + ' Stuecke ohne Flagge');
      H.run(NAECHSTER); H.step(8);
    }
    // Exakt wie vorher heisst auch: kein einziger Wurf mehr. Ein verbrauchter
    // Zufallswert verschoebe alles, was der Raumbau danach auswuerfelt.
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var echt = Math.random, wuerfe = 0;
      Math.random = function () { wuerfe++; return echt(); };
      var vorher = sc.children.list.length;
      try {
        window.BodenDeko.streuen(sc, { tpl: { name: 'Spiral' }, W: 20, H: 20, T: 32, ox: 0, oy: 0,
          istBegehbar: function () { return true; }, ablage: [] });
        window.BodenDeko.treppenFrei(sc);
      } finally { Math.random = echt; }
      return { wuerfe: wuerfe, neu: sc.children.list.length - vorher };
    })()`);
    assert.strictEqual(r.wuerfe, 0, 'ohne Flagge wurde ' + r.wuerfe + ' Mal gewuerfelt');
    assert.strictEqual(r.neu, 0, 'ohne Flagge kamen ' + r.neu + ' Objekte dazu');
  } finally { await H.shutdown(); }
});

test('mit Flagge: Themen-Deko auf Boden, frei von Treppe und Tuer, ohne Koerper', async () => {
  const H = await startenMit('?dungeon=5&boden=neu');
  try {
    const BD = H.run('({ THEMEN: window.BodenDeko.THEMEN })').THEMEN;
    const alleArten = new Set();
    let raeume = 0;
    for (let i = 0; i < 6; i++) {
      const r = H.run(ERHEBEN);
      assert.strictEqual(r.tafel, true, 'die Tafel wurde mit ?boden=neu nicht geladen');
      if (r.stuecke.length) raeume++;
      const arten = new Set(r.stuecke.map((s) => s.art));
      arten.forEach((a) => alleArten.add(a));
      // Alle Arten eines Raums stammen aus EINEM Thema.
      const passend = Object.keys(BD).filter((t) => [...arten].every((a) => BD[t].indexOf(a) >= 0));
      assert.ok(passend.length > 0, 'Raum ' + i + ' mischt Themen: ' + [...arten].join(', '));
      r.stuecke.forEach((s) => {
        assert.strictEqual(s.koerper, false, s.art + ' hat einen Koerper');
        assert.strictEqual(s.boden, true, s.art + ' ist nicht als Boden markiert');
        assert.ok(s.tiefe < r.treppenTiefe, s.art + ' liegt auf Tiefe ' + s.tiefe);
        assert.ok(s.zeichen !== '#' && s.zeichen !== null, s.art + ' liegt in der Wand (' + s.zeichen + ')');
        // Zwei Kacheln um jede Tuer bleiben frei (Mitte der Kachel, +-6 px versetzt).
        r.tueren.forEach((d) => {
          assert.ok(Math.max(Math.abs(s.x - d.x), Math.abs(s.y - d.y)) >= 56,
            s.art + ' liegt an der Tuer bei ' + d.x + '/' + d.y);
        });
        r.treppen.forEach((t) => {
          assert.ok(Math.abs(s.x - t.x) >= 44 || Math.abs(s.y - t.y) >= 44,
            s.art + ' liegt unter der Treppe bei ' + t.x + '/' + t.y);
        });
      });
      H.run(NAECHSTER); H.step(8);
    }
    assert.ok(raeume >= 4, 'nur in ' + raeume + ' von 6 Raeumen lag Deko');
    assert.ok(alleArten.size >= 4, 'nur ' + alleArten.size + ' Arten in sechs Raeumen');
  } finally { await H.shutdown(); }
});

test('mit Flagge: was nach dem Setzen unter einer Treppe oder an einer Tuer liegt, verschwindet', async () => {
  const H = await startenMit('?dungeon=5&boden=neu');
  try {
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var t = sc.stairsGroup.getChildren()[0];
      if (!t) return { keineTreppe: true };
      var unter = sc.add.image(t.x + 10, t.y - 10, 'bodendeko_atlas', 0);
      // 'neben' frei von ALLEN Treppen waehlen — ein Raum hat oft zwei.
      var alle = sc.stairsGroup.getChildren();
      var platz = [[120, 0], [-120, 0], [0, 120], [0, -120], [160, 160], [-160, -160]].map(function (o) {
        return { x: t.x + o[0], y: t.y + o[1] };
      }).filter(function (q) {
        return alle.every(function (a) { return Math.abs(q.x - a.x) >= 60 || Math.abs(q.y - a.y) >= 60; });
      })[0];
      if (!platz) return { keinPlatz: true };
      var neben = sc.add.image(platz.x, platz.y, 'bodendeko_atlas', 1);
      // Eine Tuer an bekannter Stelle, weit weg von 'neben' — die echten
      // Tueren koennten zufaellig neben der Treppe liegen.
      var echteTueren = sc.__treppenTuerListe;
      var tuer = { x: t.x + 400, y: t.y + 400 };
      sc.__treppenTuerListe = [tuer];
      var anTuer = sc.add.image(tuer.x + 20, tuer.y + 20, 'bodendeko_atlas', 2);
      sc._bodenDeko.push(unter, neben);
      sc._bodenDeko.push(anTuer);
      var weg = window.BodenDeko.treppenFrei(sc);
      sc.__treppenTuerListe = echteTueren;
      return { weg: weg, unterDa: unter.active, nebenDa: neben.active, tuerDa: anTuer.active };
    })()`);
    assert.ok(!r.keineTreppe, 'der Raum hat keine Treppe — der Fall misst nichts');
    assert.ok(!r.keinPlatz, 'kein freier Platz neben der Treppe gefunden');
    assert.strictEqual(r.unterDa, false, 'das Stueck unter der Treppe blieb liegen');
    assert.strictEqual(r.nebenDa, true, 'ein Stueck neben der Treppe wurde mit entfernt');
    // Tueren, die roomManager selbst anlegt, kennt streuen nicht — darum hier.
    assert.strictEqual(r.tuerDa, false, 'das Stueck an der Tuer blieb liegen (' + r.tuerDa + ')');
  } finally { await H.shutdown(); }
});
