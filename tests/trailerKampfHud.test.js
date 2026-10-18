// tests/trailerKampfHud.test.js — Trailer-Einstellung 5: Kampf mit HUD.
//
// Wunsch: "was noch fehlt sind kampfszenen mit hud". Taste 5 (frueher die
// Verkleidung) zeigt einen Kampf MIT HUD: Treffer lassen die Lebensleiste
// sinken, ein Trank fuellt sie, Faehigkeiten feuern, die Erfahrung fuellt
// sich bis zum Stufenaufstieg. Hochkant (540x960) steht das HUD versetzt
// zwischen den Zonen, die Reels/Shorts belegen (oben 12 %, unten 20 %) —
// ganz im Bild und lesbar. Auch Taste H nutzt diese Anordnung.

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

test('hochkant: jedes HUD-Teil ganz im Bild, die Leisten zwischen den Zonen', () => {
  const lage = H.run(LAGE);
  const zahl = (band) => lage.filter((x) => x.band === band).length;
  assert.ok(zahl('oben') > 15, 'obere Leiste nicht versetzt: ' + zahl('oben'));
  assert.strictEqual(zahl('unten'), 1, 'Faehigkeitsleiste nicht versetzt');
  const draussen = lage.filter((x) => x.b && (x.b.l < -1 || x.b.t < -1 || x.b.r > 541 || x.b.u > 961));
  assert.strictEqual(JSON.stringify(draussen), "[]", 'HUD-Teile ausserhalb des Bildes');
  // Die Leisten (Leben, Erfahrung, Minikarte, Knoepfe, Faehigkeiten, die
  // Meldung) zwischen 12 % (115 px) und 80 % (768 px).
  const zonen = lage.filter((x) => x.band && x.b && (x.b.t < 115 || x.b.u > 768));
  assert.strictEqual(JSON.stringify(zonen), "[]", 'HUD-Teile in den Zonen der Plattform');
  // Lebensleiste und Faehigkeiten sind wirklich darunter: Text "x / y" oben, Leiste unten.
  const hp = lage.filter((x) => /^\d+ \/ \d+$/.test(x.text))[0];
  assert.ok(hp && hp.band === 'oben' && hp.b.t >= 115, 'Lebensanzeige: ' + JSON.stringify(hp));
  const leiste = lage.filter((x) => x.typ === 'Container' && x.band === 'unten')[0];
  assert.ok(leiste.b.u <= 768 && leiste.b.r - leiste.b.l > 300, 'Faehigkeitsleiste: ' + JSON.stringify(leiste));
  // Und nichts davon ueberdeckt sich: obere Leiste und Leiste unten liegen weit auseinander.
  const obenUnten = Math.max(...lage.filter((x) => x.band === 'oben' && x.b).map((x) => x.b.u));
  assert.ok(obenUnten < leiste.b.t - 200, 'oben bis ' + obenUnten + ', unten ab ' + leiste.b.t);
});

test('hochkant: die Kameras zeigen das HUD versetzt (Bildpunkte, nicht nur Zahlen)', () => {
  const r = H.run(`(function () {
    var gs = ${GS}, hk = gs.__trailerHudKams;
    return { oben: hk.oben.y, unten: hk.unten.y, zoom: [hk.oben.zoom, hk.unten.zoom, gs.__trailerUiKam.zoom],
      hpAufOben: (function () { var t = gs.children.list.filter(function (o) { return o.type === 'Text' && /^\\d+ \\/ \\d+$/.test(o.text); })[0];
        return !!t && (t.cameraFilter & hk.oben.id) === 0 && (t.cameraFilter & gs.cameras.main.id) !== 0 && (t.cameraFilter & gs.__trailerUiKam.id) !== 0; })() };
  })()`);
  assert.strictEqual(JSON.stringify(r), JSON.stringify({ oben: 115, unten: -192, zoom: [1, 1, 1], hpAufOben: true }));
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
  const leiste = lage.filter((x) => x.typ === 'Container')[0];
  assert.ok(leiste && leiste.band === 'unten' && leiste.b.u <= 768, 'Faehigkeitsleiste: ' + JSON.stringify(leiste));
  assert.ok(lage.filter((x) => x.band === 'oben').length > 15);
  assert.strictEqual(JSON.stringify(lage.filter((x) => x.band && x.b && (x.b.t < 115 || x.b.u > 768))), "[]");
});
