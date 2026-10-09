// tests/ausweichRolle.test.js — die Ausweichrolle ist eine Rolle (#179).
//
// Vorher spielte performRoll die GEHBILDER der Richtung dreifach schnell ab
// und stauchte den Spieler: er trippelte durch den Raum. Jetzt laeuft eine
// eigene Bildfolge (assets/PlayerSprites/rolleDD_f00..f07, PixelLab,
// tools/rolleBauen.js) auf einem Bild, das dem Spieler folgt.
//
// Geprueft am laufenden Spiel ueber den echten Weg (performRoll), in allen
// acht Richtungen:
//   - das Rollbild steht dort, wo die Figur eben noch stand — Fuesse und
//     Mitte, gemessen an der Zeichnung, nicht am Bildrahmen. Die Rollbilder
//     sind 92x92 und roh, die Gehbilder zugeschnitten; ohne die Umrechnung
//     sprang die Figur beim Losrollen.
//   - die ganze Folge laeuft in der Dauer der Rolle durch;
//   - danach ist der Spieler wieder sichtbar und unveraendert gross, das
//     Rollbild ist weg.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launchDungeon({ depth: 1 });
  H.run('window._playerInvincible = true');
});
after(async () => { if (H) await H.shutdown(); });

// dir-Nummer -> Bewegungsvektor (PLAYER_DIRECTION_SEQUENCE in js/player.js).
const RICHTUNGEN = {
  '00': [-1, 0], '01': [-1, -1], '02': [0, -1], '03': [1, -1],
  '04': [1, 0], '05': [1, 1], '06': [0, 1], '07': [-1, 1]
};

/** Rollt in Richtung dd und misst Geh- und Rollfigur im ersten Bild. */
function rollen(dd) {
  const [x, y] = RICHTUNGEN[dd];
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    isRolling = false; rollCooldown = false;
    // Die Figur steht in Richtung ${dd} — wie nach einem Schritt dorthin.
    player.setTexture('dir${dd}_f00');
    applyPlayerDisplaySettings(player);
    lastMoveDirection.set(${x}, ${y});
    var vorher = { w: player.displayWidth, h: player.displayHeight, ox: player.originX, oy: player.originY };

    /** Figur einer Textur in Weltkoordinaten, gezeigt wie sprite. */
    function welt(sprite, key) {
      var m = figurGrenzen(sc, key);
      // Masse vom Frame — die Quellleinwand kann im Pool wiederverwendet sein.
      var fr = sc.textures.getFrame(key);
      var sx = sprite.displayWidth / fr.width, sy = sprite.displayHeight / fr.height;
      var links = sprite.x - sprite.originX * sprite.displayWidth;
      var oben = sprite.y - sprite.originY * sprite.displayHeight;
      return { mitte: links + (m.minX + m.maxX + 1) / 2 * sx, fuss: oben + (m.maxY + 1) * sy };
    }
    var geh = welt(player, 'dir${dd}_f00');
    var ok = performRoll.call(sc);
    var bild = sc.children.list.filter(function (o) {
      return o.active && o.texture && /^rolle/.test(o.texture.key);
    })[0];
    if (!bild) return { ok: ok, bild: null };
    return { ok: ok, key: bild.texture.key, sichtbar: player.visible, vorher: vorher,
             geh: geh, rolle: welt(bild, bild.texture.key) };
  })()`);
}

/** Taktet die Rolle zu Ende und sammelt die gezeigten Rollbilder. */
function zuEnde() {
  const gesehen = new Set();
  for (let i = 0; i < 40; i++) {
    const k = H.run(`(function () {
      var o = window.game.scene.getScene('GameScene').children.list.filter(function (o) {
        return o.active && o.texture && /^rolle/.test(o.texture.key); })[0];
      return o ? o.texture.key : null; })()`);
    if (!k) break;
    gesehen.add(k);
    H.step(1);
  }
  return gesehen;
}

test('in jeder Richtung rollt eine eigene Bildfolge, ausgerichtet auf die Figur', () => {
  const abweichung = [];
  for (const dd of Object.keys(RICHTUNGEN)) {
    const r = rollen(dd);
    assert.strictEqual(r.ok, true, dd + ': performRoll hat nicht gerollt');
    assert.ok(r.key, dd + ': kein Rollbild — es lief der alte Notbehelf');
    assert.strictEqual(r.key, 'rolle' + dd + '_f00', dd + ': falsche Richtung ' + r.key);
    assert.strictEqual(r.sichtbar, false, dd + ': der Spieler steht sichtbar neben seiner Rolle');
    // Die Werte sind Anzeigepixel. tools/rolleBauen.js richtet auf ganze
    // Bildpixel aus (eines ist hier knapp 0,9 Anzeigepixel); dazu kommt,
    // dass Bild 0 der Rolle schon leicht in die Hocke geht.
    const dm = Math.abs(r.rolle.mitte - r.geh.mitte), df = Math.abs(r.rolle.fuss - r.geh.fuss);
    if (dm > 4 || df > 4) abweichung.push(dd + ' Mitte ' + dm.toFixed(1) + ' Fuss ' + df.toFixed(1));

    const gesehen = zuEnde();
    assert.ok(gesehen.size >= 7, dd + ': nur ' + gesehen.size + ' Rollbilder gezeigt: ' + [...gesehen]);
    const nach = H.run(`({ sichtbar: player.visible, key: player.texture.key, w: player.displayWidth, h: player.displayHeight,
      ox: player.originX, oy: player.originY,
      rest: window.game.scene.getScene('GameScene').children.list.filter(function (o) {
        return o.active && o.texture && /^rolle/.test(o.texture.key); }).length })`);
    assert.strictEqual(nach.rest, 0, dd + ': das Rollbild bleibt stehen');
    assert.strictEqual(nach.sichtbar, true, dd + ': der Spieler bleibt unsichtbar');
    assert.ok(nach.key.indexOf('dir' + dd + '_') === 0, dd + ': nach der Rolle schaut er anderswohin (' + nach.key + ')');
    assert.deepStrictEqual([nach.w, nach.h, nach.ox, nach.oy],
      [r.vorher.w, r.vorher.h, r.vorher.ox, r.vorher.oy], dd + ': der Spieler hat Groesse oder Ursprung geaendert');
    H.step(40);                                   // Abklingzeit der Rolle
  }
  assert.deepStrictEqual(abweichung, [], 'das Rollbild steht neben der Figur: ' + abweichung.join('; '));
});

test('die Groesse der Rolle haengt nicht an der Quellleinwand des Gehbilds', () => {
  // Im Browser gemessen: normalizeDirectionFrames gibt seine Leinwand an
  // Phasers Pool zurueck, ein Textfeld nimmt sie, und getSourceImage() des
  // Gehbilds meldet 255x23. Die Rolle rechnete daraus ihre Skala und war
  // 248 statt rund 60 Pixel hoch. Hier wird die Leinwand genauso verbogen.
  H.step(40);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    isRolling = false; rollCooldown = false;
    player.setTexture('dir04_f00');
    applyPlayerDisplaySettings(player);
    lastMoveDirection.set(1, 0);
    var hoehe = player.displayHeight;
    var quelle = sc.textures.get('dir04_f00').getSourceImage();
    quelle.width = 255; quelle.height = 23;
    performRoll.call(sc);
    var b = sc.children.list.filter(function (o) {
      return o.active && o.texture && /^rolle/.test(o.texture.key); })[0];
    return { spieler: hoehe, rolle: b ? b.displayHeight : 0,
             gehFrame: sc.textures.getFrame('dir04_f00').height, rolleFrame: b ? b.frame.height : 0 };
  })()`);
  // Gleiche Skala wie das Gehbild: Anzeigehoehe je Bildpixel.
  const soll = r.spieler / r.gehFrame * r.rolleFrame;
  assert.ok(Math.abs(r.rolle - soll) < 1, 'Rolle ' + r.rolle.toFixed(1) + ' px hoch statt ' + soll.toFixed(1));
});
