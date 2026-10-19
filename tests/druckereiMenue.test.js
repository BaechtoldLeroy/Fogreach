// tests/druckereiMenue.test.js — Die Druckerei im Messing-Stil (b435).
//
// Vorher zeigte das Raster nur, was auf den Schirm passte: Karten darunter
// fielen weg, scrollen ging nicht, gesperrte Edikte standen nur als
// Fusszeile da. Jetzt steht JEDES Edikt des Katalogs als Karte in einer
// maskierten Liste (Mausrad, Ziehen, Pfeiltasten), gesperrte gedimmt mit
// Grund und Aktnummer wie der Splashscreen (Index + 1). Geprueft am echten
// Hub (headless, Canvas-Renderer).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const PH = "window.game.scene.getScene('PrintingHouseScene')";

/** Spielstand fuer die Druckerei setzen: Akt-Index, Papier, Verdacht, aktives Edikt, Gold. */
function stand(H, s) {
  H.run(`(function () {
    var ph = window.PrintingHouse;
    if (!window.__echtAkt) window.__echtAkt = window.storySystem.getCurrentActIndex;
    window.storySystem.getCurrentActIndex = function () { return ${s.akt | 0}; };
    ph.clearActivePublication();
    ph.addDruckblaetter(${s.papier | 0} - ph.getDruckblaetter());
    ph.addSuspicion(${s.verdacht | 0} - ph.getSuspicion());
    if (!window.__echtGold) window.__echtGold = window.LootSystem.getGold;
    window.LootSystem.getGold = function () { return ${s.gold | 0}; };
    ${s.aktiv ? `ph.addDruckblaetter(10); ph.publishEdict('${s.aktiv}'); ph.addDruckblaetter(${s.papier | 0} - ph.getDruckblaetter());` : ''}
  })()`);
}

async function oeffnen(H, s) {
  if (H.run(`!!(${PH} && ${PH}.sys.isActive())`)) { H.run(`${PH}._close()`); H.step(2); }
  stand(H, s || {});
  H.run(`window.openPrintingHouseScene(${HUB})`);
  for (let i = 0; i < 8; i++) { H.step(2); await flush(); }
  assert.ok(H.run(`!!(${PH} && ${PH}.sys.isActive() && ${PH}._druck)`), 'die Druckerei geht nicht auf');
}

function sprache(H, l) { H.run(`window.i18n.setLanguage('${l}')`); H.step(3); }

/** Alle Texte der Szene mit Bildschirm-Grenzen (Container eingerechnet). */
function texte(H) {
  return echt(H, `(function () { var r = []; (function lauf(l) { l.forEach(function (o) {
    if (o.type === 'Container') return lauf(o.list);
    if (o.type === 'Text' && o.visible) { var b = o.getBounds(); r.push({ liste: !!o.parentContainer, text: String(o.text), name: o.name, farbe: o.style.color, x: b.x, y: b.y, w: b.width, h: b.height }); }
  }); })(${PH}.children.list); return r; })()`);
}

/** Ergebnis aus dem Spiel-Realm als gewoehnliche Node-Werte (deepStrictEqual prueft Prototypen). */
const echt = (H, js) => JSON.parse(JSON.stringify(H.run(js)));

const ueber = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const innen = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

describe('Druckerei-Menue', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
    await H.waitForScene('HubSceneV2', { maxRounds: 600 });
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  });
  after(async () => {
    if (H) {
      H.run(`(function () { if (window.__echtAkt) window.storySystem.getCurrentActIndex = window.__echtAkt;
        if (window.__echtGold) window.LootSystem.getGold = window.__echtGold; })()`);
      await H.shutdown();
    }
  });

  test('jedes Edikt des Katalogs ist eine Karte und per Scrollen erreichbar', async () => {
    await oeffnen(H, { akt: 0, papier: 5 });
    const r = H.run(`(function () {
      var L = ${PH}._druck, kat = window.PrintingHouse.getEdictCatalog();
      var erreichbar = L.karten.map(function (k, i) {
        ${PH}._fokussiere(i, true);
        var oben = k.y - L.scroll;
        return k.hit.input.enabled && oben >= 0 && oben + k.h <= L.viewport.h ? k.id : null;
      });
      return { ids: L.karten.map(function (k) { return k.id; }), kat: kat.map(function (e) { return e.id; }),
               erreichbar: erreichbar, max: L.maxScroll };
    })()`);
    assert.strictEqual(r.ids.join(','), r.kat.join(','), 'nicht alle Edikte als Karte');
    assert.ok(r.max > 0, 'bei 480 px Hoehe passt nicht alles; die Liste muss scrollen');
    assert.strictEqual(r.erreichbar.join(','), r.kat.join(','), 'nicht jede Karte laesst sich ins Bild holen');
    // Unten angekommen: oben liegende Karten sind keine Trefferflaeche mehr.
    assert.strictEqual(H.run(`${PH}._druck.karten[0].hit.input.enabled`), false, 'ausgeblendete Karte bleibt klickbar');
  });

  test('gesperrte Edikte: gedimmte Karte mit Grund, Aktnummer wie die Titelkarte (DE und EN)', async () => {
    // Stufe 1b: Prolog ohne Nummer, dann Akt 1-4; die Nummer ist der Index.
    for (const [l, wort, prolog] of [['de', 'Ab Akt ', 'Prolog'], ['en', 'From act ', 'Prologue']]) {
      sprache(H, l);
      await oeffnen(H, { akt: 0, papier: 5 });
      const k = H.run(`${PH}._druck.karten.map(function (k) { return [k.id, k.zustand, k.sperrText]; })`);
      const kat = H.run('window.PrintingHouse.getEdictCatalog()');
      kat.forEach((e, i) => {
        if (e.requireAct > 0) {
          assert.strictEqual(k[i][1], 'gesperrt', e.id + ' nicht gesperrt');
          assert.strictEqual(k[i][2], wort + e.requireAct, e.id + ': falscher Sperrgrund');
        } else {
          assert.strictEqual(k[i][1], 'druckbar', e.id);
        }
      });
      // Die Akt-Plakette zaehlt wie die Titelkarte: Index 0 ist der Prolog.
      assert.strictEqual(texte(H).filter((t) => t.name === 'druckWertAkt').map((t) => t.text).join(), prolog);
      const sichtbar = texte(H).filter((t) => t.name === 'druckZustand').map((t) => t.text);
      assert.ok(sichtbar.includes(wort + '2') && sichtbar.includes(wort + '3'), 'Sperrgrund steht nicht auf den Karten: ' + sichtbar.join('|'));
      // Ein Tipp auf eine gesperrte Karte druckt nicht, er nennt den Grund.
      H.run(`window.__druckAufrufe = 0; window.__echtPub = window.PrintingHouse.publishEdict;
        window.PrintingHouse.publishEdict = function () { window.__druckAufrufe++; return window.__echtPub.apply(this, arguments); };
        ${PH}._waehle(9);
        window.PrintingHouse.publishEdict = window.__echtPub;`);
      assert.strictEqual(H.run('window.__druckAufrufe'), 0);
      assert.ok(H.run(`${PH}.children.list.some(function (o) { return o.name === 'druckToast' && o.text === '${wort}3'; })`), 'kein Hinweis beim Tipp');
    }
    sprache(H, 'de');
  });

  test('Mausrad und Ziehen verschieben die Liste; ein Wisch druckt nicht, ein Tipp schon', async () => {
    await oeffnen(H, { akt: 2, papier: 5 });
    const vp = H.run(`${PH}._druck.viewport`);
    const p = { x: vp.x + 60, y: vp.y + 40 };
    H.run(`${PH}.input.emit('wheel', { x: ${p.x}, y: ${p.y} }, [], 0, 120, 0)`);
    const nachRad = H.run(`${PH}._druck.scroll`);
    assert.ok(nachRad > 0, 'Mausrad scrollt nicht');
    H.run(`${PH}._druck.setScroll(0)`);
    // Ziehen: 70 px nach oben, dann auf einer druckbaren Karte loslassen.
    H.run(`window.__druckAufrufe = []; window.__echtPub = window.PrintingHouse.publishEdict;
      window.PrintingHouse.publishEdict = function (id) { window.__druckAufrufe.push(id); return window.__echtPub.apply(this, arguments); };
      var sc = ${PH}, a = { x: ${p.x}, y: ${p.y + 150} }, b = { x: ${p.x}, y: ${p.y + 80} };
      sc.input.emit('pointerdown', a, []);
      sc.input.emit('pointermove', b, []);
      sc._druck.karten[2].hit.emit('pointerup', b);
      sc.input.emit('pointerup', b, []);`);
    assert.strictEqual(H.run(`${PH}._druck.scroll`), 70, 'Ziehen scrollt nicht');
    assert.strictEqual(H.run('window.__druckAufrufe.length'), 0, 'ein Wisch hat gedruckt');
    // Tipp ohne Bewegung: druckt genau dieses Edikt (publishEdict wie bisher).
    H.run(`var sc = ${PH}; sc._druck.setScroll(0); var k = sc._druck.karten[1], q = { x: ${p.x + 300}, y: ${vp.y} + k.y - sc._druck.scroll + 30 };
      sc.input.emit('pointerdown', q, []);
      k.hit.emit('pointerup', q);
      sc.input.emit('pointerup', q, []);
      window.PrintingHouse.publishEdict = window.__echtPub;`);
    assert.deepStrictEqual(Array.from(H.run('window.__druckAufrufe')), [H.run('window.PrintingHouse.getEdictCatalog()[1].id')]);
    assert.strictEqual(H.run('window.PrintingHouse.getActivePublication().id'), H.run('window.PrintingHouse.getEdictCatalog()[1].id'));
    for (let i = 0; i < 80 && H.run(`${PH}.sys.isActive()`); i++) { H.step(2); await flush(); }
    assert.strictEqual(H.run(`${PH}.sys.isActive()`), false, 'die Druckerei schliesst nach dem Drucken nicht');
    H.run('window.PrintingHouse.clearActivePublication()');
  });

  test('Pfeiltasten waehlen und scrollen, Enter druckt die gewaehlte Karte', async () => {
    await oeffnen(H, { akt: 2, papier: 5 });
    H.run(`window.__druckAufrufe = []; window.__echtPub = window.PrintingHouse.publishEdict;
      window.PrintingHouse.publishEdict = function (id) { window.__druckAufrufe.push(id); return { success: false, reason: 'Probe' }; };`);
    H.run(`${PH}._taste({ code: 'ArrowDown' })`);
    assert.strictEqual(H.run(`${PH}._druck.fokus`), 0, 'der erste Tastendruck waehlt die erste Karte');
    for (let i = 0; i < 3; i++) H.run(`${PH}._taste({ code: 'ArrowDown' })`);
    assert.strictEqual(H.run(`${PH}._druck.fokus`), 6);
    assert.ok(H.run(`${PH}._druck.scroll`) > 0, 'die gewaehlte Karte wird nicht ins Bild geholt');
    H.run(`${PH}._taste({ code: 'Enter' })`);
    H.run('window.PrintingHouse.publishEdict = window.__echtPub');
    assert.deepStrictEqual(Array.from(H.run('window.__druckAufrufe')), [H.run('window.PrintingHouse.getEdictCatalog()[6].id')]);
    H.step(4);
  });

  test('ESC und E schliessen ohne Reste', async () => {
    for (const taste of ['keydown-ESC', 'keydown-E']) {
      await oeffnen(H, { akt: 0, papier: 2 });
      const vorher = H.run(`${PH}.input.listenerCount('wheel')`);
      assert.strictEqual(vorher, 1);
      H.run(`${PH}.input.keyboard.emit('${taste}', {})`);
      H.step(3);
      const r = echt(H, `(function () { var sc = ${PH};
        return { aktiv: sc.sys.isActive(), rad: sc.input.listenerCount('wheel'), down: sc.input.listenerCount('pointerdown'),
                 tasten: sc.input.keyboard.listenerCount('keydown'), druck: sc._druck, objekte: sc.children.list.length }; })()`);
      assert.deepStrictEqual(r, { aktiv: false, rad: 0, down: 0, tasten: 0, druck: null, objekte: 0 }, taste);
    }
  });

  test('keine eckigen Klammern, keine Sonderzeichen als Symbol (DE und EN)', async () => {
    for (const l of ['de', 'en']) {
      sprache(H, l);
      await oeffnen(H, { akt: 0, papier: 0, verdacht: 12, gold: 500 });
      const schlecht = texte(H).filter((t) => /[[\]]/.test(t.text) || /[^\x20-\x7E\näöüÄÖÜß]/.test(t.text));
      assert.deepStrictEqual(schlecht.map((t) => t.text), [], l);
      const knoepfe = texte(H).filter((t) => /^(Schliessen|Close|Bestechen|Bribe|Tauschen|Trade)$/.test(t.text)).length;
      assert.strictEqual(knoepfe, 3, l + ': Knopfbeschriftung');
      // Kosten als Pixel-Symbole, nicht als Text.
      assert.ok(H.run(`${PH}.children.list.filter(function (o) { return o.name === 'druckSymbol_gold' && o.type === 'Image'; }).length`) === 2);
    }
    sprache(H, 'de');
  });

  test('nichts ueberlappt, alles bleibt in seiner Karte/Plakette/Knopf (DE und EN, alle Zustaende)', async () => {
    const staende = [
      { akt: 0, papier: 0, verdacht: 25, gold: 0 },
      { akt: 4, papier: 4, verdacht: 3, gold: 500, aktiv: 'smuggling_network' },
      { akt: 2, papier: 50, verdacht: 12, gold: 80 }
    ];
    for (const l of ['de', 'en']) {
      sprache(H, l);
      for (const s of staende) {
        await oeffnen(H, s);
        const max = H.run(`${PH}._druck.maxScroll`);
        for (const scroll of [0, max]) {
          H.run(`${PH}._druck.setScroll(${scroll})`);
          const r = H.run(`(function () {
            var sc = ${PH}, L = sc._druck, out = { karten: [], fehler: [] };
            function gr(o) { var b = o.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height, t: String(o.text || o.name) }; }
            var cont = sc.children.list.filter(function (o) { return o.name === 'druckListe'; })[0];
            L.karten.forEach(function (k) {
              var kb = gr(k.hit);
              if (kb.y < L.viewport.y || kb.y + kb.h > L.viewport.y + L.viewport.h) return;
              var teile = cont.list.filter(function (o) {
                if (o.type !== 'Text' && !(o.type === 'Image' && /^druckSymbol/.test(o.name))) return false;
                var b = gr(o); return b.x + b.w / 2 > kb.x && b.x + b.w / 2 < kb.x + kb.w && b.y + b.h / 2 > kb.y && b.y + b.h / 2 < kb.y + kb.h;
              }).map(gr);
              out.karten.push({ karte: kb, teile: teile });
            });
            out.kopf = sc.children.list.filter(function (o) { return o.type === 'Text' || (o.type === 'Image' && /^druck/.test(o.name)); }).map(gr);
            out.knoepfe = sc.children.list.filter(function (o) { return o._uiKnopf || (o.type === 'Rectangle' && /^druck(Bestechen|Tauschen|Schliessen)/.test(o.name)); }).map(gr);
            out.panel = sc._panel;
            return out;
          })()`);
          assert.ok(r.karten.length >= 2, 'keine Karte im Bild');
          for (const k of r.karten) {
            assert.ok(k.teile.length >= 6, 'zu wenig Teile auf der Karte');
            k.teile.forEach((a, i) => {
              assert.ok(innen(a, k.karte), `${l}: "${a.t}" ragt aus der Karte`);
              k.teile.slice(i + 1).forEach((b) => assert.ok(!ueber(a, b), `${l}: "${a.t}" ueberlappt "${b.t}"`));
            });
          }
          // Kopf, Plaketten und Knopfbeschriftungen: keine Ueberlappung untereinander.
          r.kopf.forEach((a, i) => {
            assert.ok(innen(a, { x: r.panel.left, y: r.panel.top, w: r.panel.w, h: r.panel.h }), `${l}: "${a.t}" ausserhalb der Platte`);
            r.kopf.slice(i + 1).forEach((b) => assert.ok(!ueber(a, b), `${l}: "${a.t}" ueberlappt "${b.t}"`));
          });
          // Jede Knopfbeschriftung samt Symbol liegt in ihrem Knopf.
          const kn = r.knoepfe;
          r.kopf.filter((t) => t.y > kn[0].y - 1 && t.y < kn[0].y + kn[0].h).forEach((t) => {
            assert.ok(kn.some((k) => innen(t, k)), `${l}: "${t.t}" ragt aus dem Knopf`);
          });
        }
      }
    }
    sprache(H, 'de');
  });

  test('Rueckfall ohne Messing-Grafiken und ohne Symbol-Streifen', async () => {
    H.run(`window.__echtBereit = window.uiRahmen.bereit; window.__echtNach = window.uiRahmen.nachladen;
      window.uiRahmen.bereit = function () { return false; }; window.uiRahmen.nachladen = function () {};
      // Fehlen die Bilder, laedt einkleiden nur nach (hier: nie fertig) und kleidet nichts ein.
      window.__echtEin = window.uiRahmen.einkleiden; window.uiRahmen.einkleiden = function () {};
      window.__echtSym = window.PrintingHouseScene.prototype._symbolDa;
      window.PrintingHouseScene.prototype._symbolDa = function () { return false; };`);
    try {
      await oeffnen(H, { akt: 0, papier: 1 });
      const r = echt(H, `(function () { var sc = ${PH}, n = 0;
        (function lauf(l) { l.forEach(function (o) { if (o.type === 'Container') return lauf(o.list);
          if (o.type === 'Image' && /^ui_(rahmen|feld|knopf)/.test(o.texture.key)) n++;
          if (o.type === 'Image' && o.texture.key === 'ui_druck_symbole') n += 100; }); })(sc.children.list);
        return { messingBilder: n, karten: sc._druck.karten.length, max: sc._druck.maxScroll,
          wort: sc.children.list.some(function (o) { return o.type === 'Container' && o.list.some(function (t) { return t.type === 'Text' && t.text === 'Blatt'; }); }) }; })()`);
      assert.deepStrictEqual(r, { messingBilder: 0, karten: 10, max: r.max, wort: true });
      assert.ok(r.max > 0);
      H.run(`window.__druckAufrufe = []; window.__echtPub = window.PrintingHouse.publishEdict;
        window.PrintingHouse.publishEdict = function (id) { window.__druckAufrufe.push(id); return { success: false, reason: 'Probe' }; };
        ${PH}._druck.karten[0].hit.emit('pointerup', { x: ${PH}._druck.viewport.x + 50, y: ${PH}._druck.viewport.y + 30 });
        window.PrintingHouse.publishEdict = window.__echtPub;`);
      assert.strictEqual(H.run('window.__druckAufrufe.length'), 1, 'im Rueckfall laesst sich nicht drucken');
    } finally {
      H.run(`window.uiRahmen.bereit = window.__echtBereit; window.uiRahmen.nachladen = window.__echtNach; window.uiRahmen.einkleiden = window.__echtEin;
        window.PrintingHouseScene.prototype._symbolDa = window.__echtSym;`);
      H.step(4);
      if (H.run(`${PH}.sys.isActive()`)) H.run(`${PH}._close()`);
      H.step(2);
    }
  });
});

// ---- Lesbarkeit: gemessener Kontrast (wie tests/uiRahmen.test.js) ----------

function leucht(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hexLeucht(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h.slice(0, 6), 16);
  return leucht((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe('Druckerei: Kontrast >= 4,5:1', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
    await H.waitForScene('HubSceneV2', { maxRounds: 600 });
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  });
  after(async () => { if (H) await H.shutdown(); });

  for (const [name, s] of [
    ['gesperrt + zu wenig Papier', { akt: 0, papier: 0, verdacht: 25 }],
    ['aktiv + anderes Edikt aktiv', { akt: 4, papier: 4, verdacht: 3, gold: 500, aktiv: 'war_cry' }],
    ['druckbar', { akt: 2, papier: 50, verdacht: 12, gold: 80 }]
  ]) {
    test(name, async () => {
      for (const l of ['de', 'en']) {
        sprache(H, l);
        await oeffnen(H, s);
        for (const scroll of [0, 9999]) {
          H.run(`${PH}._druck.setScroll(${scroll})`);
          H.step(2);
          const vp = H.run(`${PH}._druck.viewport`);
          const liste = texte(H).filter((t) => t.text.trim() && t.name !== 'druckToast'
            && (!t.liste || (t.y >= vp.y && t.y + t.h <= vp.y + vp.h)));
          // Hintergrund ohne Texte
          H.run(`(function () { window.__versteckt = [];
            window.game.scene.scenes.forEach(function (s) { (function lauf(l) { l.forEach(function (o) {
              if (o.type === 'Container') return lauf(o.list);
              if (o.type === 'Text' && o.visible) { o.visible = false; window.__versteckt.push(o); } }); })(s.children ? s.children.list : []); });
          })()`);
          H.step(1);
          const c = H.window.game.canvas;
          const bild = c.getContext('2d').getImageData(0, 0, c.width, c.height);
          H.run('window.__versteckt.forEach(function (o) { o.visible = true; })');
          const sx = c.width / 960, sy = c.height / 480;
          const schlecht = [];
          liste.forEach((t) => {
            const L = [];
            for (let yy = Math.max(0, Math.floor(t.y * sy)); yy < Math.min(c.height, Math.ceil((t.y + t.h) * sy)); yy++) {
              for (let xx = Math.max(0, Math.floor(t.x * sx)); xx < Math.min(c.width, Math.ceil((t.x + t.w) * sx)); xx++) {
                const i = (yy * c.width + xx) * 4;
                L.push(leucht(bild.data[i], bild.data[i + 1], bild.data[i + 2]));
              }
            }
            L.sort((a, b) => a - b);
            const k = kontrast(hexLeucht(t.farbe), L[Math.floor(L.length / 2)]);
            if (k < 4.5) schlecht.push(`"${t.text.slice(0, 30)}" ${t.farbe} ${k.toFixed(2)}:1`);
          });
          assert.ok(liste.length > 20, 'zu wenig Texte gemessen');
          assert.deepStrictEqual(schlecht, [], l + ' (scroll ' + scroll + ')');
        }
      }
      sprache(H, 'de');
    });
  }
});
