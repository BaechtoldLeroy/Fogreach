// tests/loadoutOverlay.test.js — das Faehigkeiten-Loadout im neuen Stil (b399).
//
// Messing-Platte (uiRahmen), je Faehigkeit das Pixel-Icon aus hud_icons.png
// (grau = gesperrt), Slots als Messingfelder mit Taste (Q W E R bzw. 1-4),
// Zustaende gesperrt/ausgeruestet/frei als Text ohne eckige Klammern,
// Auswahl ueber den hellen Beschlag. Zuweisen laeuft weiter ueber
// AbilitySystem.setSlot. Mobile: Trefferflaechen >= 44 px, alles mit
// scrollFactor 0, ein Schliessen-Knopf. Rueckfall ohne Bilder: die fruehere
// Darstellung (gezeichneter Kasten, Emoji), Zuweisen geht trotzdem.
//
// Geprueft am echten Hub (headless, Canvas); Mobile und Desktop oeffnen
// dasselbe Overlay (window.openLoadoutUI, ueber K oder das Menue).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung.js');

// Arrays aus dem vm-Realm sind nicht deepStrictEqual zu Node-Arrays: per JSON vergleichen.
const gleich = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

const GELERNT = ['hammer', 'steelGrasp', 'charge', 'frenzy', 'frostNova'];

async function hub() {
  const H = await launch({ search: '?autostart=1', renderer: 'canvas' });
  // Die Intro-Tafel des ersten Hub-Besuchs laege sonst ueber dem Overlay.
  H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.step(30);
  return H;
}

/** Overlay (neu) oeffnen mit fester Belegung: Q Hammer, W Stahlgriff, E leer, R Frostnova. */
function oeffnen(H) {
  H.run(`(function () { var A = window.AbilitySystem, hub = window.game.scene.getScene('HubSceneV2');
    if (hub._loadoutContainer) hub._loadoutContainer.destroy(true);
    hub.children.list.filter(function (o) { return o._loadout; }).forEach(function (o) { o.destroy(); });
    hub._loadoutContainer = null; hub._dialogOpen = false; hub._loadoutSuppressUntil = 0;
    ${JSON.stringify(GELERNT)}.forEach(function (id) { A.learnAbility(id, { silent: true }); });
    A.setSlot('slot1', 'hammer'); A.setSlot('slot2', 'steelGrasp'); A.setSlot('slot3', null); A.setSlot('slot4', 'frostNova');
    window.openLoadoutUI(hub); })()`);
  H.step(3);
}

/** Alles, was das Overlay zeigt, als einfache Daten. */
function lage(H) {
  return H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2'), c = hub._loadoutContainer;
    if (!c) return null;
    var alle = [];
    (function lauf(l) { l.forEach(function (o) { alle.push(o); if (o.type === 'Container') lauf(o.list); }); })(c.list);
    var texte = alle.filter(function (o) { return o.type === 'Text'; });
    return {
      platte: alle.filter(function (o) { return o._loadoutPlatte; }).map(function (o) { return o.texture.key; }),
      grafik: alle.filter(function (o) { return o.type === 'Graphics'; }).length,
      icons: alle.filter(function (o) { return o._loadoutIcon; }).map(function (o) {
        return { id: o._loadoutIcon, key: o.texture.key, frame: o.frame.name, w: o.displayWidth }; }),
      emoji: texte.filter(function (o) { return window.AbilitySystem.getAllAbilityDefs().some(function (d) { return d.icon && o.text === d.icon; }); }).length,
      slots: alle.filter(function (o) { return o._loadoutSlot; }).map(function (o) {
        return { slot: o._loadoutSlot, key: o.texture.key, gewaehlt: o._loadoutGewaehlt }; }),
      tasten: texte.filter(function (o) { return o._loadoutTaste; }).map(function (o) { return o.text; }),
      status: texte.filter(function (o) { return o._loadoutStatus; }).reduce(function (m, o) { m[o._loadoutStatus] = o.text; return m; }, {}),
      texte: texte.map(function (o) { return o.text; }),
      scrollNichtNull: alle.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length
        + (c.scrollFactorX !== 0 ? 1 : 0),
      zonen: hub.children.list.filter(function (o) { return o._loadout && o.active; }).map(function (o) {
        var h = o.input && o.input.hitArea;
        return { art: o._loadout.art, id: o._loadout.id || o._loadout.slot || null,
          w: h ? h.width : 0, h: h ? h.height : 0, sf: o.scrollFactorX + o.scrollFactorY, tiefe: o.depth };
      })
    };
  })()`);
}

function druecke(H, art, id) {
  H.run(`(function () { var hub = window.game.scene.getScene('HubSceneV2');
    var z = hub.children.list.filter(function (o) { return o._loadout && o._loadout.art === '${art}'
      && (${JSON.stringify(id)} === null || o._loadout.id === ${JSON.stringify(id)} || o._loadout.slot === ${JSON.stringify(id)}); })[0];
    if (!z) throw new Error('keine Zone ${art} ${id}');
    z.emit('pointerdown'); })()`);
  H.step(1);
}

describe('Loadout im neuen Stil', () => {
  let H = null;
  before(async () => { H = await hub(); oeffnen(H); });
  after(async () => { if (H) await H.shutdown(); });

  test('Messing-Platte statt gezeichnetem Kasten', () => {
    const l = lage(H);
    assert.ok(l.platte.length >= 4 && l.platte.every((k) => k === 'ui_rahmen'), 'keine Messing-Platte: ' + JSON.stringify(l.platte));
    assert.strictEqual(l.grafik, 0, 'noch gezeichnete Kaesten im Overlay');
  });

  test('jede Faehigkeit mit ihrem Pixel-Icon, gesperrte grau, kein Emoji', () => {
    const l = lage(H);
    const defs = H.run('window.AbilitySystem.getAllAbilityDefs().map(function (d) { return d.id; })');
    const erwartet = H.run(`(function () { var A = window.AbilitySystem, HL = window.hudLeiste, m = {};
      A.getAllAbilityDefs().forEach(function (d) { m[d.id] = HL.frame(d.id, !A.isLearned(d.id)); }); return m; })()`);
    const pool = l.icons.slice(0, defs.length);
    gleich(pool.map((i) => i.id).sort(), defs.slice().sort(), 'nicht jede Faehigkeit hat ein Icon');
    pool.forEach((i) => {
      assert.strictEqual(i.key, 'hud_icons', i.id + ': kein Pixel-Icon');
      assert.strictEqual(i.frame, erwartet[i.id], i.id + ': falsches Bild (grau/farbig)');
      assert.strictEqual(i.w, 40, i.id + ': Icon nicht 40 px');
    });
    assert.strictEqual(l.emoji, 0, 'Emoji-Icons noch sichtbar');
  });

  test('Slots als Messingfelder mit Taste, Zustaende ohne eckige Klammern', () => {
    const l = lage(H);
    gleich(l.slots.map((s) => s.slot), ['slot1', 'slot2', 'slot3', 'slot4']);
    l.slots.forEach((s) => assert.ok(/^ui_feld@/.test(s.key), s.slot + ': kein Messingfeld (' + s.key + ')'));
    gleich(l.tasten, ['Q', 'W', 'E', 'R']);
    assert.strictEqual(l.status.hammer, 'Ausgerüstet · Q');
    assert.strictEqual(l.status.frostNova, 'Ausgerüstet · R');
    assert.strictEqual(l.status.charge, 'Frei');
    assert.strictEqual(l.status.whirlwind, 'Gesperrt');
    assert.ok(l.texte.includes('Leer'), 'leerer Slot sagt es nicht');
    const klammer = l.texte.filter((t) => /[[\]]/.test(t));
    gleich(klammer, [], 'eckige Klammern im Overlay');
  });

  test('Slot waehlen, Faehigkeit waehlen: Slot belegt (AbilitySystem), Auswahl sichtbar', () => {
    oeffnen(H);
    druecke(H, 'slot', 'slot3');
    let l = lage(H);
    gleich(l.slots.map((s) => s.gewaehlt), [false, false, true, false], 'Auswahl nicht sichtbar');
    assert.ok(/^ui_feld_gewaehlt@/.test(l.slots[2].key), 'gewaehlter Slot ohne hellen Beschlag');
    assert.ok(l.texte.includes('Wähle eine Fähigkeit für E.'), 'Hinweis nennt den Slot nicht');
    druecke(H, 'pool', 'charge');
    assert.strictEqual(H.run('window.AbilitySystem.getActiveLoadout().slot3'), 'charge');
    l = lage(H);
    assert.strictEqual(l.status.charge, 'Ausgerüstet · E');
    gleich(l.slots.map((s) => s.gewaehlt), [false, false, false, false]);
    // Gesperrt: erklaeren, nicht zuweisen.
    druecke(H, 'slot', 'slot1');
    druecke(H, 'pool', 'whirlwind');
    assert.strictEqual(H.run('window.AbilitySystem.getActiveLoadout().slot1'), 'hammer', 'gesperrte Faehigkeit zugewiesen');
    assert.ok(lage(H).texte.some((t) => /Talentbaum/.test(t)), 'gesperrte Faehigkeit erklaert sich nicht');
  });

  test('Hover hellt das Feld auf', () => {
    oeffnen(H);
    const key = () => H.run(`window.game.scene.getScene('HubSceneV2')._loadoutContainer.list
      .filter(function (o) { return o._loadoutPool === 'charge'; })[0].texture.key`);
    assert.ok(/^ui_feld@/.test(key()));
    H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) {
      return o._loadout && o._loadout.id === 'charge'; })[0].emit('pointerover')`);
    assert.ok(/^ui_feld_gewaehlt@/.test(key()), 'Hover ohne Wirkung');
  });

  test('Kontrast aller Texte >= 4,5:1', () => {
    oeffnen(H);
    druecke(H, 'pool', 'whirlwind');   // Tooltip sichtbar mitmessen
    const l = kontraste(H, `${TEXTE_IN("window.game.scene.getScene('HubSceneV2')._loadoutContainer.list")}
      .concat(window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o._loadout && o.type === 'Text'; }))`);
    assert.ok(l.length >= 30, 'zu wenige Texte gemessen: ' + l.length);
    alleLesbar(l, 'Loadout');
  });

  test('Mobile: Trefferflaechen >= 44 px, scrollFactor 0, ueber dem Overlay; Schliessen-Knopf', () => {
    H.run('window.game.device.input.touch = true');
    oeffnen(H);
    const l = lage(H);
    H.run('window.game.device.input.touch = false');
    assert.ok(l.texte.includes('Tippe auf einen Slot, dann auf eine erlernte Fähigkeit.'), 'Touch-Hinweis fehlt');
    assert.strictEqual(l.scrollNichtNull, 0, 'Objekte im Overlay scrollen mit');
    const arten = l.zonen.map((z) => z.art);
    assert.strictEqual(arten.filter((a) => a === 'pool').length, 12);
    assert.strictEqual(arten.filter((a) => a === 'slot').length, 4);
    assert.strictEqual(arten.filter((a) => a === 'close').length, 1);
    l.zonen.forEach((z) => {
      assert.ok(z.w >= 44 && z.h >= 44, z.art + ' ' + z.id + ': Trefferflaeche ' + z.w + 'x' + z.h);
      assert.strictEqual(z.sf, 0, z.art + ': scrollFactor');
      assert.ok(z.tiefe > 2000, z.art + ': unter dem Abdunkler');
    });
    druecke(H, 'close', null);
    assert.strictEqual(lage(H), null, 'Schliessen schliesst nicht');
    assert.strictEqual(H.run(`(function () { var hub = window.game.scene.getScene('HubSceneV2');
      return [hub._dialogOpen, hub.children.list.filter(function (o) { return o._loadout; }).length]; })()`).join(','), 'false,0');
  });

  test('ARPG-Schema: Tasten 1-4', () => {
    H.run("window.InputScheme.setScheme('arpg')");
    oeffnen(H);
    const t = lage(H).tasten;
    H.run("window.InputScheme.setScheme('classic')");
    gleich(t, ['1', '2', '3', '4']);
  });
});

describe('Rueckfall: Bilder nicht geladen', () => {
  let H = null;
  before(async () => {
    H = await hub();
    H.run(`(function () { var t = window.game.textures;
      window.uiRahmen.ALLE.forEach(function (k) { if (t.exists(k)) t.remove(k); });
      if (t.exists('hud_icons')) t.remove('hud_icons'); })()`);
    oeffnen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('gezeichneter Kasten und Emoji wie frueher, Zuweisen geht', () => {
    const l = lage(H);
    gleich(l.platte, []);
    assert.ok(l.grafik >= 1 + 12 + 4, 'Kasten/Felder nicht gezeichnet: ' + l.grafik);
    gleich(l.icons, [], 'Icon-Bild trotz fehlendem Streifen');
    assert.ok(l.emoji >= 12, 'Emoji-Ersatz fehlt: ' + l.emoji);
    gleich(l.tasten, ['Q', 'W', 'E', 'R']);
    druecke(H, 'slot', 'slot3');
    druecke(H, 'pool', 'frenzy');
    assert.strictEqual(H.run('window.AbilitySystem.getActiveLoadout().slot3'), 'frenzy');
    const k = kontraste(H, TEXTE_IN("window.game.scene.getScene('HubSceneV2')._loadoutContainer.list"));
    alleLesbar(k, 'Loadout ohne Bilder');
  });
});
