// tests/trailerKampfHud.test.js — Trailer-Einstellung 5: Kampf mit HUD.
//
// Wunsch: "was noch fehlt sind kampfszenen mit hud". Taste 5 (frueher die
// Verkleidung) zeigt einen Kampf MIT HUD: Treffer lassen die Lebensleiste
// sinken, ein Trank fuellt sie, Faehigkeiten feuern, die Erfahrung fuellt
// sich bis zum Stufenaufstieg.
//
// Wunsch (b454): "HUD für den Trailer anpassen, dass es an den
// Bildschirmrändern ist und tendenziell eher etwas grösser ist." Hochkant
// (540x960) klebt das HUD an den Raendern — Leiste oben links, Knoepfe oben
// rechts, Karte darunter, Faehigkeiten unten — vergroessert (oben 1.4, unten
// 1.5), ganz im Bild und ohne dass sich Gruppen ueberdecken. Auch Taste H
// nutzt diese Anordnung.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

let H = null;
const zustand = () => H.run('window.TrailerModus.zustand()');
const GS = `window.game.scene.getScene('GameScene')`;

before(async () => {
  H = await launch({ search: '?trailer=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 300 }), 'kein Hub');
  await H.settle(() => zustand().hubGesehen, { maxRounds: 40 });
});
after(async () => { if (H) await H.shutdown(); });

/** Taktet bis zur Bildzeit `ms` der Einstellung; `jeBild(seit)` sieht jeden Schritt. */
async function bisSeit(ms, jeBild) {
  for (let i = 0; i < 2000; i++) {
    const seit = zustand().seit;
    if (jeBild && seit >= 0) jeBild(seit);
    if (seit >= ms) return true;
    H.step(2);
    await flush();
  }
  return false;
}

const LAGE = `window.TrailerModus._hudLage(${GS})`;
const W = 540, HOEHE = 960, RAND = 16;
let fruehLage = null, meldungLage = null;

/** Umriss je Gruppe (Band) im Bild. */
function gruppen(lage) {
  const g = {};
  lage.filter((x) => x.band && x.b).forEach((x) => {
    const r = g[x.band];
    g[x.band] = r ? { l: Math.min(r.l, x.b.l), t: Math.min(r.t, x.b.t), r: Math.max(r.r, x.b.r), u: Math.max(r.u, x.b.u) } : Object.assign({}, x.b);
  });
  return g;
}

/** Die Gruppenpaare, die sich ueberdecken (mehr als 1 px Rundung). */
function ueberdeckt(g) {
  const namen = Object.keys(g), out = [];
  for (let i = 0; i < namen.length; i++) {
    for (let j = i + 1; j < namen.length; j++) {
      const a = g[namen[i]], b = g[namen[j]];
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.u, b.u) - Math.max(a.t, b.t) > 1) out.push(namen[i] + '/' + namen[j]);
    }
  }
  return out;
}

/** Hochkant: das HUD an den Raendern, gross, ganz im Bild, nichts ueberdeckt sich. */
function amRand(lage) {
  const g = gruppen(lage);
  for (const band of ['links', 'knoepfe', 'unten']) assert.ok(g[band], 'Gruppe fehlt: ' + band + ' in ' + Object.keys(g));
  // Die Minikarte bleibt im Trailer weg (b456).
  assert.ok(!g.karte, 'Minikarte im Trailer sichtbar: ' + JSON.stringify(g.karte));
  const draussen = lage.filter((x) => x.b && (x.b.l < -1 || x.b.t < -1 || x.b.r > W + 1 || x.b.u > HOEHE + 1));
  assert.strictEqual(JSON.stringify(draussen), '[]', 'HUD-Teile ausserhalb des Bildes');
  assert.ok(g.links.t <= RAND && g.links.l <= RAND, 'Leiste nicht oben links am Rand: ' + JSON.stringify(g.links));
  assert.ok(g.knoepfe.t <= RAND && g.knoepfe.r >= W - RAND, 'Knoepfe nicht oben rechts am Rand: ' + JSON.stringify(g.knoepfe));
  assert.ok(g.unten.u >= HOEHE - RAND, 'Faehigkeitsleiste nicht am unteren Rand: ' + JSON.stringify(g.unten));
  assert.ok(Math.abs((g.unten.l + g.unten.r) / 2 - W / 2) <= 2, 'Faehigkeitsleiste nicht mittig: ' + JSON.stringify(g.unten));
  const klein = lage.filter((x) => ['links', 'knoepfe', 'unten'].indexOf(x.band) !== -1 && x.zoom < 1.4);
  assert.strictEqual(JSON.stringify(klein), '[]', 'HUD nicht vergroessert');
  assert.deepStrictEqual(ueberdeckt(g), [], 'Gruppen ueberdecken sich: ' + JSON.stringify(g));
  return g;
}

test('Taste 5: Leben sinkt, Trank heilt, Faehigkeiten feuern, Stufenaufstieg — in unter 3 s', async () => {
  const fehlerVorher = H.hardErrors().length;
  H.run(`(function () {
    window.__faehig = [];
    var A = window.AbilitySystem, echt = A.tryActivate;
    A.tryActivate = function (slot) { window.__faehig.push(slot); return echt.apply(this, arguments); };
    window.TrailerModus.taste('5');
  })()`);
  const verlauf = [];
  assert.ok(await bisSeit(2900, (seit) => {
    verlauf.push({ seit, hp: H.run('playerHealth / playerMaxHealth'), stufe: H.run('playerLevel') });
    // Mit Gebietsnamen (frueh) und mit Meldung (nach dem Aufstieg) fuer die Lage-Tests.
    if (!fruehLage && seit >= 1300) fruehLage = H.run(LAGE);
    if (!meldungLage && H.run(LAGE).some((x) => x.band === 'meldung')) meldungLage = H.run(LAGE);
  }), 'Einstellung 5 laeuft nicht an');
  assert.deepStrictEqual(H.hardErrors().slice(fehlerVorher).map((f) => f.msg), []);
  const z = zustand();
  assert.strictEqual(z.hudAn, true, 'das HUD ist nicht im Bild');
  // Die Lebensleiste sinkt sichtbar (unter die Haelfte), stirbt aber nicht.
  const tief = Math.min(...verlauf.map((v) => v.hp));
  assert.ok(tief < 0.5 && tief >= 0.25, 'tiefster Stand ' + tief);
  // Der Trank hebt sie wieder, noch vor dem Stufenaufstieg.
  const vorStufe = verlauf.filter((v) => v.seit > z.momente.trank && v.stufe === verlauf[0].stufe);
  assert.ok(vorStufe.length && Math.max(...vorStufe.map((v) => v.hp)) > tief + 0.3, 'der Trank heilt nicht (hoechstens ' + Math.max(...vorStufe.map((v) => v.hp)) + ')');
  assert.ok(z.momente.treffer <= 300, 'erster Treffer erst bei ' + z.momente.treffer);
  assert.ok(z.momente.trank <= 1500, 'Trank erst bei ' + z.momente.trank);
  assert.ok(z.momente.stufe <= 2600, 'Stufenaufstieg erst bei ' + z.momente.stufe);
  assert.ok(verlauf[verlauf.length - 1].stufe > verlauf[0].stufe, 'keine neue Stufe');
  assert.deepStrictEqual(H.run('window.__faehig.join(",")'), 'slot1,slot2,slot3');
  // Nach dem Aufstieg steht die Faehigkeitsleiste noch voll (der Talentpunkt
  // raeumte sie frueher leer).
  assert.strictEqual(H.run(`window.AbilitySystem.getActiveLoadout().slot3`), 'hammer');
});

test('hochkant: das HUD an den Raendern, vergroessert, ganz im Bild, nichts ueberdeckt sich', () => {
  // Frueh: mit Gebietsnamen — er rueckt unter die Leiste statt hinter sie.
  assert.ok(fruehLage && meldungLage, 'keine Lage gemessen');
  const frueh = amRand(fruehLage);
  assert.ok(frueh.titel, 'Gebietsname fehlt: ' + JSON.stringify(fruehLage.filter((x) => x.typ === 'Text')));
  assert.ok(frueh.titel.t >= frueh.links.u, 'Gebietsname in der Leiste: ' + JSON.stringify(frueh));
  // Nach dem Aufstieg: mit Meldung — ueber der Faehigkeitsleiste.
  const spaet = amRand(meldungLage);
  assert.ok(spaet.meldung.u <= spaet.unten.t && spaet.meldung.t > HOEHE / 2, 'Meldung: ' + JSON.stringify(spaet));
  // Lebensanzeige in der Leiste oben, die Faehigkeitsleiste breit (1.5 x 342 px).
  const hp = fruehLage.filter((x) => /^\d+ \/ \d+$/.test(x.text))[0];
  assert.ok(hp && hp.band === 'links' && hp.b.t < 60, 'Lebensanzeige: ' + JSON.stringify(hp));
  // Das Gold am Ende der Leiste ragt hochkant ueber die Bildmitte — es bleibt trotzdem bei ihr.
  const gold = fruehLage.filter((x) => /⛃/.test(x.text))[0];
  assert.ok(gold && gold.band === 'links' && gold.b.u <= frueh.links.u, 'Gold: ' + JSON.stringify(gold));
  assert.ok(frueh.unten.r - frueh.unten.l > 480, 'Faehigkeitsleiste: ' + JSON.stringify(frueh.unten));
});

test('hochkant: die Kameras zeigen das HUD gross am Rand (Bildpunkte, nicht nur Zahlen)', () => {
  const r = H.run(`(function () {
    var gs = ${GS}, hk = gs.__trailerHudKams, f = window.HUDv2.elements.hpFill, t = gs.__trailerHudLage.links;
    var hpText = gs.children.list.filter(function (o) { return o.type === 'Text' && /^\\d+ \\/ \\d+$/.test(o.text); })[0];
    // Der Lebensbalken leuchtet dort im Bild, wo ihn die vergroesserte Leiste hinstellt.
    var b = f.getBounds(), x = Math.round(t.x + t.z * (b.left + 4)), y = Math.round(t.y + t.z * (b.top + b.height / 2));
    var px = window.game.canvas.getContext('2d').getImageData(x, y, 1, 1).data;
    return { zoom: [hk.links.zoom, hk.knoepfe.zoom, hk.karte.zoom, hk.unten.zoom, gs.__trailerUiKam.zoom],
      hpNurAufLinks: !!hpText && (hpText.cameraFilter & hk.links.id) === 0 && (hpText.cameraFilter & gs.cameras.main.id) !== 0
        && (hpText.cameraFilter & gs.__trailerUiKam.id) !== 0 && (hpText.cameraFilter & hk.knoepfe.id) !== 0,
      farbe: Array.prototype.slice.call(px, 0, 3).map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''),
      soll: f.fillColor.toString(16).padStart(6, '0') };
  })()`);
  assert.strictEqual(JSON.stringify(r.zoom), "[1.4,1.4,1.4,1.5,1]");
  assert.strictEqual(r.hpNurAufLinks, true);
  assert.strictEqual(r.farbe, r.soll, 'Lebensbalken nicht an seinem Platz im Bild');
});

test('danach: Taste 4 ohne HUD, der Spieler wieder unverwundbar und voll', async () => {
  H.run(`window.TrailerModus.taste('4')`);
  assert.ok(await bisSeit(300));
  assert.strictEqual(zustand().hudAn, false);
  assert.strictEqual(JSON.stringify(H.run(LAGE)), "[]", 'HUD noch im Bild');
  const r = H.run(`(function () {
    applyPlayerDamage(9999, ${GS}, null);
    return playerHealth === playerMaxHealth && window._playerInvincible === true;
  })()`);
  assert.strictEqual(r, true);
});

test('Taste H nutzt hochkant dieselbe Anordnung', () => {
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  const lage = H.run(LAGE);
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  amRand(lage);
});

test('Taste H im Hub: die Knoepfe gross oben rechts', async () => {
  H.run(`window.TrailerModus.taste('2')`);
  assert.ok(await bisSeit(300));
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  await flush();
  H.step(2);
  const lage = H.run(`window.TrailerModus._hudLage(window.game.scene.getScene('HubSceneV2'))`);
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  const g = gruppen(lage);
  // Im Hub zeigt das Spiel nur Zahnrad und Truhe.
  assert.ok(g.knoepfe && g.knoepfe.t <= RAND && g.knoepfe.r >= W - RAND, 'Knoepfe: ' + JSON.stringify(lage));
  assert.ok(lage.every((x) => x.band !== 'knoepfe' || x.zoom >= 1.4), 'Knoepfe nicht vergroessert');
  assert.deepStrictEqual(ueberdeckt(g), [], JSON.stringify(g));
  assert.strictEqual(JSON.stringify(lage.filter((x) => x.b && (x.b.l < -1 || x.b.t < -1 || x.b.r > W + 1 || x.b.u > HOEHE + 1))), '[]');
});
