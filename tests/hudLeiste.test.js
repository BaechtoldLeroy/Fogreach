// tests/hudLeiste.test.js — Faehigkeitsleiste mit Pixel-Icons (#195).
//
// Desktop: Aktionsleiste unten mittig (Messingfelder, Icon aus
// assets/ui/hud_icons.png, Taste klein in der Ecke, dunkler Sweep fuer die
// Abklingzeit). Mobile: dieselben Icons in Messingringen auf den Kreisen von
// mobileControls, deren Lage und Trefferflaechen unveraendert bleiben.
// Portraet, Menue- und Inventarknopf als Pixel-Icons.
//
// Rueckfall, wenn der Icon-Streifen nicht geladen ist: dieselbe Leiste und
// dieselben Ringe, statt der Icons ein kurzer Name; Portraet leer, Menue und
// Inventar als schlichte Zeichen.
//
// Geprueft am echten Dungeon (headless, Canvas). Der Dungeon selbst rendert
// headless schwarz, das HUD aber sichtbar — genau das wird gemessen.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');
const { kontraste, alleLesbar } = require('./kontrastMessung.js');

const BELEGUNG = { slot1: 'hammer', slot2: 'steelGrasp', slot3: 'charge', slot4: 'frostNova' };

function belegen(H, belegung) {
  H.run(`(function () { var A = window.AbilitySystem, b = ${JSON.stringify(belegung)};
    Object.keys(b).forEach(function (s) { if (b[s]) A.learnAbility(b[s], { silent: true }); A.setSlot(s, b[s]); });
    window._refreshAbilityHUD && window._refreshAbilityHUD(); })()`);
  H.step(2);
}

/**
 * Der Spieler darf nicht sterben: die Faelle takten bis zu 15 s Spielzeit, und
 * ein Tod wechselt die Szene (im Gesamtlauf so passiert: die Leiste war mitten
 * im Fall weg). _playerInvincible allein reicht nicht — das Spiel setzt es
 * nach Unverwundbarkeitsfenstern zurueck, und Brand/Gift ziehen daran vorbei.
 * Darum je Bild auffuellen; haengt an der Szene, also nach Neustart erneut.
 */
function schutz(H) {
  H.run(`window.game.scene.getScene('GameScene').events.on('update', function () {
    window._playerInvincible = true; if (playerHealth < playerMaxHealth) playerHealth = playerMaxHealth; })`);
}

/** GameScene neu starten (optional als Touch-Geraet) und wieder belegen. */
async function neustart(H, touch) {
  H.run(`(function () { window.game.device.input.touch = ${!!touch};
    window.game.scene.getScene('GameScene').scene.restart(); })()`);
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 250 }), 'GameScene nach dem Neustart nicht erreicht');
  schutz(H);
  H.step(30);
  belegen(H, BELEGUNG);
  H.step(5);
}

/** Laden des Icon-Streifens gescheitert nachstellen (bleibt fuer die Sitzung so). */
function ohneStreifen(H) {
  H.run(`(function () { window.hudLeiste.vorladen = function () {};
    window.game.textures.remove('hud_icons'); })()`);
}

/** Objekte unter der Leiste, durch Container hindurch gezaehlt. */
const LEISTE_OBJEKTE = `(function () { var n = 0; (function lauf(l) { l.forEach(function (o) { n++;
  if (o.type === 'Container') lauf(o.list); }); })(window.hudLeiste._leiste().wurzel.list); return n; })()`;

/**
 * Trefferflaechen der Mobile-Knoepfe, nach Schluessel: das gemeldete Rechteck
 * aus mobileControls, der Radius des Kreises (er ist das Tap-Ziel) und die
 * Groesse seiner Eingabeflaeche.
 */
function trefferflaechen(H) {
  const l = H.run(`(function () { var s = window.game.scene.getScene('GameScene');
    var kreise = s.children.list.filter(function (o) { return o.type === 'Arc' && o.depth === 1200 && o.input; });
    return window.getMobileAbilityButtonHitRects().map(function (r) {
      var k = kreise.filter(function (o) { return Math.abs(o.x - r.x) < 0.5 && Math.abs(o.y - r.y) < 0.5; })[0];
      var ha = k && k.input.hitArea;
      return [r.key, r.halfW, r.halfH, k ? k.radius : 0, ha ? (ha.width || ha.radius * 2 || 0) : 0]; }); })()`);
  const m = {};
  for (let i = 0; i < l.length; i++) m[l[i][0]] = l[i].slice(1);
  return m;
}

/**
 * Radius je Knopf, wie mobileControls ihn festlegt (BASE_RADIUS 38 mal Faktor
 * bei Knopfgroesse 1): Primaer 1,71, Ring 0,9, Trank 1,0. Die Ringe duerfen
 * daran nichts aendern.
 */
const SOLL_RADIUS = { attack: 38 * 1.71, roll: 38 * 0.9, potion: 38, hammer: 38 * 0.9, steelGrasp: 38 * 0.9, charge: 38 * 0.9, frostNova: 38 * 0.9 };

function pruefeTrefferflaechen(tr) {
  assert.deepStrictEqual(Object.keys(tr).sort().join(','), Object.keys(SOLL_RADIUS).sort().join(','));
  Object.keys(SOLL_RADIUS).forEach((k) => {
    const [halbW, halbH, radius, flaeche] = tr[k];
    assert.ok(Math.abs(halbW - SOLL_RADIUS[k]) < 0.01 && Math.abs(halbH - SOLL_RADIUS[k]) < 0.01,
      k + ' Trefferrechteck ' + halbW + ' statt ' + SOLL_RADIUS[k]);
    assert.ok(Math.abs(radius - SOLL_RADIUS[k]) < 0.01, k + ' Kreisradius ' + radius + ' statt ' + SOLL_RADIUS[k]);
    assert.ok(flaeche >= 2 * SOLL_RADIUS[k] - 0.01, k + ' Eingabeflaeche ' + flaeche + ' zu klein');
  });
}

/** Mittlere Helligkeit (0..255) eines Bildschirm-Rechtecks im gerenderten Bild. */
function helligkeit(H, b) {
  H.step(1);
  const c = H.window.game.canvas;
  const sx = c.width / 960, sy = c.height / 480;
  const d = c.getContext('2d').getImageData(Math.round(b.x * sx), Math.round(b.y * sy),
    Math.round((b.r - b.x) * sx), Math.round((b.u - b.y) * sy)).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return s / (d.length / 4);
}

/** Ein Tutorialbanner bauen und seine Unterkante liefern (danach wieder weg). */
function bannerUnterkante(H) {
  return H.run(`(function () { var s = window.game.scene.getScene('GameScene');
    var o = window.TutorialOverlay.create(s); var b = o._buildBanner('Pfeiltasten zum Bewegen');
    var r = b.bg.getBounds(); b.bg.destroy(); b.text.destroy(); return r.bottom; })()`);
}

/**
 * Menue- und Inventarknopf oben rechts: Icon (Bild oder Zeichen) und
 * Klickflaeche. Die Klickflaechen liegen fest: ICON_R 22, 12 px vom Rand,
 * 8 px Abstand untereinander.
 */
const MENUE_KNOEPFE = `(function () { var e = window.HUDv2.elements;
  var flaeche = function (h) { var b = h.getBounds(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height), !!(h.input && h.input.enabled)]; };
  var icon = function (b) { return { typ: b.type, frame: b.frame ? b.frame.name : null, tex: b.texture ? b.texture.key : null,
    text: b.text || null, sichtbar: b.visible, w: Math.round(b.displayWidth) }; };
  return { burgerHit: flaeche(e.burgerHit), invHit: flaeche(e.invHit), burger: icon(e.burgerIcon), inv: icon(e.invIcon),
    portraet: e.portraitIcon ? icon(e.portraitIcon) : null }; })()`;
const KLICK_MENUE = JSON.stringify([[904, 12, 44, 44, true], [904, 64, 44, 44, true]]);

/** Hover hebt das Knopf-Icon, Verlassen setzt zurueck, Druck gibt nach und federt zurueck. */
function pruefeKnopfZustaende(H) {
  const skala = (n) => H.run(`window.HUDv2.elements.${n}Icon.scaleX`);
  const s0 = skala('inv');
  H.run(`window.HUDv2.elements.invHit.emit('pointerover')`);
  assert.ok(skala('inv') > s0, 'kein Hover');
  H.run(`window.HUDv2.elements.invHit.emit('pointerout')`);
  assert.strictEqual(skala('inv'), s0);
  // Druck: nur den Zustands-Lauscher rufen (der erste oeffnet das Menue, das
  // wuerde die folgenden Faelle verdecken). Ein Tap auf dem Handy ist derselbe
  // pointerdown; ein pointerup kommt dort nicht an.
  const b0 = skala('burger');
  H.run(`(function () { var l = window.HUDv2.elements.burgerHit.listeners('pointerdown'); l[l.length - 1](); })()`);
  assert.ok(skala('burger') < b0, 'kein Druckzustand');
  H.step(20);
  assert.strictEqual(skala('burger'), b0, 'Druckzustand federt nicht zurueck');
}

const felder = (H) => H.run(`window.hudLeiste._leiste().felder.filter(function (f) { return f.c.visible; })
  .map(function (f) { var b = f.c.getBounds(); return { key: f.key, id: f.abilityId, taste: f.taste.text,
    tex: f.a.icon.texture.key, frame: f.a.icon.frame.name, iconSichtbar: f.a.icon.visible,
    ersatz: f.a.ersatz.visible ? f.a.ersatz.text : null,
    x: b.x, y: b.y, r: b.right, u: b.bottom }; })`);

/** Sweep des Felds an Position idx: erscheint beim Ausloesen, dunkelt ab, schrumpft. */
function pruefeSweep(H, idx) {
  const lese = () => H.run(`(function () { var f = window.hudLeiste._leiste().felder[${idx}];
    return { anteil: f.a.anteil, zahl: f.a.zahl.visible ? f.a.zahl.text : '', befehle: f.a.sweep.commandBuffer.length,
      blitz: f.a.blitz.alpha }; })()`);
  for (let n = 0; lese().anteil > 0 && n < 200; n++) H.step(10);
  assert.strictEqual(lese().anteil, 0, 'Sweep ohne Abklingzeit');
  // Gemessen am Bild: das Feld wird sichtbar dunkler (Feld ohne Rand).
  const feld = H.run(`(function () { var f = window.hudLeiste._leiste().felder[${idx}], b = f.c.getBounds();
    return { x: b.x + 8, y: b.y + 16, r: b.right - 8, u: b.bottom - 8 }; })()`);
  const hellFrei = helligkeit(H, feld);
  H.run(`window.AbilitySystem.tryActivate('slot${idx - 1}', window.game.scene.getScene('GameScene'))`);
  H.step(3);
  const a = lese();
  assert.ok(a.anteil > 0.9 && a.befehle > 0, 'kein Sweep nach dem Ausloesen: ' + JSON.stringify(a));
  const hellCd = helligkeit(H, feld);
  assert.ok(hellCd < hellFrei * 0.75, 'Sweep dunkelt das Feld nicht ab: ' + hellFrei.toFixed(1) + ' -> ' + hellCd.toFixed(1));
  assert.ok(/^\d+$/.test(a.zahl), 'keine Restsekunden: ' + a.zahl);
  H.step(120);
  const b = lese();
  assert.ok(b.anteil < a.anteil && b.anteil > 0, 'Sweep schrumpft nicht: ' + a.anteil + ' -> ' + b.anteil);
  return lese;
}

describe('Normalfall: Leiste, Ringe und Knoepfe mit Pixel-Icons', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 5, zusatz: '&debug=1' });
    schutz(H);
    H.step(20);
    belegen(H, BELEGUNG);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Desktop: Leiste unten mittig, ein Feld je belegtem Slot, in Tastenreihenfolge', () => {
    let f = felder(H);
    assert.deepStrictEqual(f.map((x) => x.key).join(','), 'attack,roll,slot1,slot2,slot3,slot4,potion');
    const links = Math.min(...f.map((x) => x.x)), rechts = Math.max(...f.map((x) => x.r));
    assert.ok(Math.abs((links + rechts) / 2 - 480) <= 2, 'nicht mittig: ' + links + '..' + rechts);
    f.forEach((x) => assert.ok(x.u <= 480 && x.y >= 400, x.key + ' nicht unten: ' + x.y + '..' + x.u));
    assert.deepStrictEqual(f.map((x) => x.taste).join(','), 'Leer,Shift,Q,W,E,R,F');
    // Zwei Slots leer -> zwei Felder weniger, weiterhin mittig.
    belegen(H, { slot1: 'hammer', slot2: null, slot3: 'charge', slot4: null });
    f = felder(H);
    assert.deepStrictEqual(f.map((x) => x.key).join(','), 'attack,roll,slot1,slot3,potion');
    const l2 = Math.min(...f.map((x) => x.x)), r2 = Math.max(...f.map((x) => x.r));
    assert.ok(Math.abs((l2 + r2) / 2 - 480) <= 2, 'nicht mittig nach Umbelegung');
    belegen(H, BELEGUNG);
  });

  test('Desktop: die alten Kacheln oben rechts gibt es nicht mehr', () => {
    const r = H.run(`(function () { var s = window.game.scene.getScene('GameScene');
      return { kacheln: s.children.list.filter(function (o) { return o.type === 'Container' && o.depth === 1001
          && o !== window.hudLeiste._leiste().wurzel; }).length,
        status: typeof window.updateAbilityStatus, zustand: window._getAbilityHUDState().map(function (t) {
          return t.key + ':' + t.keyLabel + ':' + t.label; }).join(',') }; })()`);
    assert.strictEqual(r.kacheln, 0, 'Kachel-Container stehen noch da');
    assert.strictEqual(r.status, 'undefined', 'updateAbilityStatus lebt noch');
    assert.strictEqual(r.zustand, 'attack:Leer:Hieb,slot1:Q:Hammer,slot2:W:Stahlgr,slot3:E:Ansturm,slot4:R:Frostno');
  });

  test('Desktop: jedes Feld zeigt ein Pixel-Icon, kein Emoji-Text; Portraet als Bild', () => {
    const f = felder(H);
    const reihe = H.run('window.hudLeiste.REIHE.slice()');
    const erwartet = { attack: 'angriff', roll: 'rolle', potion: 'trank' };
    f.forEach((x) => {
      assert.strictEqual(x.tex, 'hud_icons', x.key + ' ohne Icon-Textur');
      assert.ok(x.iconSichtbar && x.ersatz === null, x.key + ' Icon unsichtbar oder Ersatzname sichtbar');
      assert.strictEqual(reihe[Number(x.frame) % reihe.length], erwartet[x.key] || x.id, x.key + ' falsches Icon');
    });
    // Kein sichtbarer Text im HUD enthaelt ein Symbol-Zeichen (Emoji,
    // Dingbats) — die erscheinen im Canvas als Kaestchen.
    const emoji = H.run(`(function () { var r = [];
      (function lauf(l) { l.forEach(function (o) { if (o.type === 'Container') return lauf(o.list);
        if (o.type !== 'Text' || !o.visible) return;
        var b = o.getBounds(), oben = b.bottom < 120 && (b.right < 80 || b.x > 880);
        var leiste = o.parentContainer && o.parentContainer.parentContainer === window.hudLeiste._leiste().wurzel;
        if ((oben || leiste) && /[\\u2190-\\u2BFF\\uD83C-\\uD83E]/.test(o.text)) r.push(o.text); }); })
        (window.game.scene.getScene('GameScene').children.list);
      return r; })()`);
    assert.strictEqual(emoji.length, 0, 'Emoji-Text sichtbar: ' + emoji.join(' | '));
    const k = H.run(MENUE_KNOEPFE);
    assert.ok(k.portraet && k.portraet.sichtbar && k.portraet.frame === H.run(`window.hudLeiste.frame('portrait')`),
      'kein Pixel-Portraet: ' + JSON.stringify(k.portraet));
  });

  test('Menue- und Inventarknopf: Pixel-Icons im Ring, Klickflaechen fest, Hover/Druck', () => {
    const k = H.run(MENUE_KNOEPFE);
    const f = (id) => H.run(`window.hudLeiste.frame('${id}')`);
    assert.ok(k.burger.typ === 'Image' && k.burger.sichtbar && k.burger.frame === f('menu'), 'kein Menue-Icon: ' + JSON.stringify(k.burger));
    assert.ok(k.inv.typ === 'Image' && k.inv.sichtbar && k.inv.frame === f('inventory'), 'kein Inventar-Icon: ' + JSON.stringify(k.inv));
    assert.ok(k.burger.w >= 32 && k.inv.w >= 32, 'Icons zu klein fuer den Knopf');
    assert.strictEqual(JSON.stringify([k.burgerHit, k.invHit]), KLICK_MENUE, 'Klickflaechen veraendert');
    pruefeKnopfZustaende(H);
  });

  test('Desktop: Tastenbeschriftung und Trankzahl lesbar (>= 4,5:1)', () => {
    const l = kontraste(H, `window.hudLeiste._leiste().felder.filter(function (f) { return f.c.visible; })
      .map(function (f) { return f.taste; }).concat([window.hudLeiste._leiste().felder[6].anzahl])`);
    assert.strictEqual(l.length, 8, 'nicht alle Beschriftungen gemessen: ' + l.map((t) => t.text).join(','));
    alleLesbar(l, 'Leiste');
  });

  test('Desktop: Minikarte und "Raum x/9" frei', () => {
    const r = H.run(`(function () { var s = window.game.scene.getScene('GameScene');
      var ziele = [s._minimapBorder.getBounds(), window._roomCounterText.getBounds()];
      var treffer = [];
      s.children.list.forEach(function (o) {
        if (!o.visible || !o.getBounds || o.depth < 1000 || o.depth >= 1499 || o === s._minimapBorder) return;
        if (o.type === 'Graphics') return;
        var b = o.getBounds();
        ziele.forEach(function (z) { if (Phaser.Geom.Rectangle.Overlaps(b, z)) treffer.push(o.type + '@' + o.depth + ' ' + Math.round(b.x) + ',' + Math.round(b.y)); });
      });
      return { treffer: treffer, raum: window._roomCounterText.text, sichtbar: window._roomCounterText.visible }; })()`);
    assert.ok(r.sichtbar && /\d+\/\d+/.test(r.raum), 'kein Raumzaehler: ' + r.raum);
    assert.strictEqual(r.treffer.join(' | '), '', 'Minikarte/Raumzaehler verdeckt');
  });

  test('Desktop: Tutorialbox sitzt ueber der Leiste', () => {
    const unten = bannerUnterkante(H);
    const oben = Math.min(...felder(H).map((x) => x.y));
    assert.ok(unten <= oben - 4, 'Tutorialbox (bis ' + unten + ') ueberdeckt die Leiste (ab ' + oben + ')');
  });

  test('Desktop: Abklingzeit als Sweep, schrumpft mit der Zeit, Aufleuchten beim Freiwerden', () => {
    H.run(`window.AbilitySystem.setSlot('slot1', 'frostNova'); window._refreshAbilityHUD()`);
    const lese = pruefeSweep(H, 2);
    let c = lese(), n = 0;
    while (c.anteil > 0 && n++ < 200) { H.step(10); c = lese(); }
    assert.strictEqual(c.anteil, 0, 'Sweep verschwindet nicht');
    assert.strictEqual(c.zahl, '', 'Restsekunden bleiben stehen');
    assert.ok(c.blitz > 0, 'kein Aufleuchten beim Freiwerden');
    belegen(H, BELEGUNG);
  });

  test('Desktop: ohne Trank entsaettigt', () => {
    const grau = () => H.run(`(function () { var f = window.hudLeiste._leiste().felder[6];
      return Number(f.a.icon.frame.name) >= window.hudLeiste.REIHE.length; })()`);
    // Sicher einen Trank im Gepaeck, damit "zurueck" auch farbig heisst.
    H.run(`(function () { var inv = window.inventory, i = inv.indexOf(null);
      if (i < 0) i = inv.length; inv[i] = { type: 'potion', potionTier: 1, stack: 2, name: 'Heiltrank' }; })()`);
    H.step(2);
    assert.strictEqual(grau(), false, 'mit Trank entsaettigt');
    H.run(`window.__inv = window.inventory.slice(); for (var i = 0; i < window.inventory.length; i++)
      if (window.inventory[i] && window.inventory[i].type === 'potion') window.inventory[i] = null;`);
    H.step(2);
    assert.strictEqual(grau(), true, 'leerer Trank nicht entsaettigt');
    H.run(`for (var i = 0; i < window.__inv.length; i++) window.inventory[i] = window.__inv[i];`);
    H.step(2);
    assert.strictEqual(grau(), false);
  });

  test('Leistung: keine neuen Objekte je Bild, Sweep nur bei Aenderung neu', () => {
    H.run(`window.AbilitySystem.tryActivate('slot4', window.game.scene.getScene('GameScene'))`);
    H.step(2);
    // Jede Anlage in der Szene mitzaehlen, die aus hudLeiste.js kommt (die
    // Szene selbst legt waehrend des Zaubers Partikel an und raeumt sie ab).
    H.run(`(function () { var s = window.game.scene.getScene('GameScene'); window.__hudNeu = 0; window.__hudAdd = {};
      ['text', 'image', 'graphics', 'rectangle', 'circle', 'container'].forEach(function (k) {
        var f = s.add[k]; window.__hudAdd[k] = f;
        s.add[k] = function () { if (/hudLeiste\\.js/.test(new Error().stack)) window.__hudNeu++; return f.apply(this, arguments); };
      }); })()`);
    const vorher = H.run(LEISTE_OBJEKTE);
    H.step(30);
    const neu = H.run(`(function () { var s = window.game.scene.getScene('GameScene');
      Object.keys(window.__hudAdd).forEach(function (k) { s.add[k] = window.__hudAdd[k]; }); return window.__hudNeu; })()`);
    assert.strictEqual(neu, 0, 'die Leiste legt je Bild Objekte an');
    assert.strictEqual(H.run(LEISTE_OBJEKTE), vorher, 'die Leiste waechst');
    const zeichnungen = () => H.run(`window.hudLeiste._leiste().felder.reduce(function (s, f) { return s + f.a.zeichnungen; }, 0)`);
    // Ruhe: Angriff/Rolle/Trank ohne Abklingzeit -> nichts darf neu gezeichnet werden.
    H.run(`window.AbilitySystem.setSlot('slot4', null); window._refreshAbilityHUD()`);
    H.step(2);
    const z0 = zeichnungen();
    H.step(30);
    assert.strictEqual(zeichnungen(), z0, 'Sweep wird ohne Aenderung neu gezeichnet');
    belegen(H, BELEGUNG);
  });

  test('Desktop: alles mit scrollFactor 0', () => {
    const falsch = H.run(`(function () { var r = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) r.push(o.type);
        (o.list || []).forEach(lauf); })(window.hudLeiste._leiste().wurzel); return r; })()`);
    assert.strictEqual(falsch.join(','), '');
  });

  test('Mobile: Ringe mit Icon, Trefferflaechen unveraendert, Sweep, kein Emoji', async () => {
    await neustart(H, true);
    const deko = H.run(`window.hudLeiste._mobil().map(function (d) { return { key: d.key, id: d.abilityId,
      tex: d.a.icon.texture.key, icon: d.a.icon.visible, ersatz: d.a.ersatz.visible,
      ring: d.c.list.some(function (o) { return o.type === 'Image' && o.texture.key === 'ui_ring'; }),
      sf: d.c.scrollFactorX === 0 && d.c.list.every(function (o) { return o.scrollFactorX === 0; }) }; })`);
    const tr = trefferflaechen(H);
    assert.strictEqual(deko.length, Object.keys(tr).length, 'nicht jeder Knopf hat einen Ring');
    deko.forEach((d) => {
      assert.ok(d.tex === 'hud_icons' && d.icon && !d.ersatz, d.key + ' ohne Icon');
      assert.ok(d.ring, d.key + ' ohne Messingring');
      assert.ok(d.sf, d.key + ' nicht scrollFactor 0');
    });
    pruefeTrefferflaechen(tr);
    const emoji = H.run(`window.game.scene.getScene('GameScene').children.list.filter(function (o) {
      return o.type === 'Text' && o.visible && o.depth >= 1200 && o.depth < 1300; }).map(function (o) { return o.text; })`);
    assert.strictEqual(emoji.join('|'), '', 'Texte (Emoji/Beschriftung) auf den Knoepfen');
    // Sweep: dieselbe Anzeige wie am Desktop.
    const anteil = () => H.run(`window.hudLeiste._mobil().filter(function (d) { return d.abilityId === 'frostNova'; })[0].a.anteil`);
    // Frostnova kann vom Desktop-Teil noch abklingen: erst frei werden lassen.
    for (let n = 0; anteil() > 0 && n < 200; n++) H.step(10);
    assert.strictEqual(anteil(), 0);
    H.run(`window.AbilitySystem.tryActivate('slot4', window.game.scene.getScene('GameScene'))`);
    H.step(3);
    const a = anteil();
    H.step(120);
    const b = anteil();
    assert.ok(a > 0.9 && b < a && b > 0, 'Mobile-Sweep laeuft nicht: ' + a + ' -> ' + b);
  });

  test('Mobile: Primaerknopf wechselt das Icon zwischen Angriff und Aktion', () => {
    const icon = () => H.run(`(function () { var d = window.hudLeiste._mobil().filter(function (d) { return d.key === 'attack'; })[0];
      return window.hudLeiste.REIHE[Number(d.a.icon.frame.name) % window.hudLeiste.REIHE.length]; })()`);
    H.run('window.__altPeace = window.hasPeacefulTarget; window.hasPeacefulTarget = function () { return false; }');
    H.step(1);
    assert.strictEqual(icon(), 'angriff');
    H.run('window.hasPeacefulTarget = function () { return true; }');
    H.step(1);
    assert.strictEqual(icon(), 'aktion');
    H.run('window.hasPeacefulTarget = window.__altPeace');
    H.step(1);
  });

  test('Mobile: Boss-Inszenierung blendet Kreise samt Ringen aus und wieder ein', () => {
    const sicht = () => H.run(`window.hudLeiste._mobil().map(function (d) { return d.kreis.visible && d.c.visible; })`);
    assert.ok(sicht().every(Boolean));
    assert.ok(H.run('window.mobileAbilityLeisteSichtbar(false)') > 0);
    H.step(1);
    assert.ok(sicht().every((v) => !v), 'Ringe bleiben stehen');
    H.run('window.mobileAbilityLeisteSichtbar(true)');
    H.step(1);
    assert.ok(sicht().every(Boolean), 'Ringe kommen nicht zurueck');
  });
});

describe('Rueckfall: Icon-Streifen nicht geladen', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 5, zusatz: '&debug=1' });
    schutz(H);
    H.step(10);
    ohneStreifen(H);
    await neustart(H, false);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Desktop: dieselbe Leiste, statt Icons kurze Namen, kein Platzhalterbild', () => {
    const f = felder(H);
    assert.deepStrictEqual(f.map((x) => x.key).join(','), 'attack,roll,slot1,slot2,slot3,slot4,potion');
    assert.deepStrictEqual(f.map((x) => x.ersatz).join(','), 'Hieb,Rolle,Hammer,Stahlgr,Ansturm,Frostno,Trank');
    f.forEach((x) => assert.ok(!x.iconSichtbar && x.tex !== '__MISSING', x.key + ': Icon/Platzhalter sichtbar (' + x.tex + ')'));
    assert.deepStrictEqual(f.map((x) => x.taste).join(','), 'Leer,Shift,Q,W,E,R,F');
    const l = kontraste(H, `window.hudLeiste._leiste().felder.filter(function (f) { return f.c.visible; })
      .map(function (f) { return f.a.ersatz; })`);
    assert.strictEqual(l.length, 7);
    alleLesbar(l, 'Ersatznamen');
    assert.ok(bannerUnterkante(H) <= Math.min(...f.map((x) => x.y)) - 4, 'Tutorialbox ueberdeckt die Leiste');
  });

  test('Desktop: Sweep und Grau laufen auch ohne Icons', () => {
    pruefeSweep(H, 5);
    H.run(`window.__inv = window.inventory.slice(); for (var i = 0; i < window.inventory.length; i++)
      if (window.inventory[i] && window.inventory[i].type === 'potion') window.inventory[i] = null;`);
    H.step(2);
    assert.strictEqual(H.run(`window.hudLeiste._leiste().felder[6].a.ersatz.style.color`), '#bdb4a6', 'leerer Trank nicht grau');
    H.run(`for (var i = 0; i < window.__inv.length; i++) window.inventory[i] = window.__inv[i];`);
    H.step(2);
  });

  test('Portraet leer, Menue und Inventar als Zeichen, Klickflaechen fest, Hover/Druck', () => {
    const k = H.run(MENUE_KNOEPFE);
    assert.strictEqual(k.portraet, null, 'Portraet ohne Streifen');
    assert.deepStrictEqual([k.burger.typ, k.burger.text, k.burger.sichtbar], ['Text', '☰', true]);
    assert.deepStrictEqual([k.inv.typ, k.inv.text, k.inv.sichtbar], ['Text', 'I', true]);
    assert.strictEqual(JSON.stringify([k.burgerHit, k.invHit]), KLICK_MENUE, 'Klickflaechen veraendert');
    pruefeKnopfZustaende(H);
  });

  test('Mobile: Ringe mit kurzem Namen, Trefferflaechen unveraendert', async () => {
    await neustart(H, true);
    const deko = H.run(`window.hudLeiste._mobil().map(function (d) { return { key: d.key, icon: d.a.icon.visible,
      ersatz: d.a.ersatz.visible ? d.a.ersatz.text : null,
      ring: d.c.list.some(function (o) { return o.type === 'Image' && o.texture.key === 'ui_ring'; }) }; })`);
    assert.strictEqual(deko.length, 7);
    deko.forEach((d) => assert.ok(!d.icon && d.ersatz && d.ring, JSON.stringify(d)));
    pruefeTrefferflaechen(trefferflaechen(H));
  });
});
