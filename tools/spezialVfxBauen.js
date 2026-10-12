/**
 * tools/spezialVfxBauen.js — die Wirkbilder der Spezialangriffe (#174, Nachbesserung).
 *
 * Die Figur bewegt sich seit b380 mit eigener Bildfolge (tools/spezialBauen.js);
 * hier entstehen die Effekte darum herum: Staubring und Schwunglinien des
 * Wirbels, Glimmen und Aufschlag des Hammers, Staub und Funken des Ansturms,
 * Schattenwolke des Schattenschritts, Frostring der Nova, Nebelsog des
 * Wirbelsogs.
 *
 * Gebaut im PixelLab vfx_workbench (ein Renderer, keine KI-Erzeugung: Ebenen
 * aus Ringen, Rissen, Staubwolken, Teilchen, nach Rezept gezeichnet). Jeder
 * Effekt ist unter "My effects" auf pixellab.ai gespeichert (ID unten) und
 * laesst sich dort mit Reglern nachstellen. Der Export liefert ein Raster
 * (PNG) und eine JSON-Liste der Bilder; beide liegen unverändert unter
 * tools/rohbilder/spezialvfx/<effekt>/vfx.png|vfx.json. Fehlen sie, holt das
 * Werkzeug sie vom Export-Link.
 *
 * Heraus kommt je Effekt EINE Zeile Bilder: assets/vfx/spezial_<effekt>.png.
 * Der Anker des Effekts (Mitte der Wirkung, beim Staub der Fusspunkt) wird
 * dabei in die Bildmitte geschoben — im Spiel sitzt jedes Bild mit Ursprung
 * 0.5/0.5 auf der Stelle. Bildmasse und Anzahl gehören zu SPEZIAL_VFX in
 * js/player.js; das Werkzeug gibt sie aus.
 *
 *   node tools/spezialVfxBauen.js [--bogen vorschau/spezialvfx_bogen.png] [effekt ...]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROH = path.join(__dirname, 'rohbilder', 'spezialvfx');
const ZIEL = path.join(__dirname, '..', 'assets', 'vfx');
const EXPORT = 'https://api.pixellab.ai/mcp/pixel-tools/';

// effekt: PixelLab-Effekt (My effects), Export (Bild-ID + Dateiname), Anker im Raster.
const EFFEKTE = {
  frost:          { effekt: '6849ea2a-805c-4697-9da4-70295780f93f', bild: '4a0b909f-1423-4b66-9bf1-81750af9020b', datei: 'fogreach-frostnova-boden', anker: [98, 98] },
  wirbel_boden:   { effekt: '9d84b693-83d3-48f9-855f-1843f6e65211', bild: '4d74283f-c99a-49bb-b1be-75d02a313c4d', datei: 'fogreach-wirbel-boden', anker: [64, 64] },
  wirbel_luft:    { effekt: '98d11f4c-405c-4ef5-b1fa-1e272e30edf9', bild: 'e4ee5394-30f7-4e10-8f47-63ec1c48701d', datei: 'fogreach-wirbel-luft', anker: [64, 64] },
  hammer_boden:   { effekt: '88208897-c982-4c5f-a41e-854bd10cafb5', bild: '126af5af-bde8-477e-8787-2f9c2fc02900', datei: 'fogreach-hammer-aufschlag-boden', anker: [70, 70] },
  hammer_luft:    { effekt: 'e7799056-ecc2-46a1-bdfd-3f70b1822da7', bild: '3bdf6411-7565-4bc2-9cbb-e0b4446ee883', datei: 'fogreach-hammer-aufschlag-luft', anker: [88, 50] },
  hammer_glimmen: { effekt: '8bbfaabe-adf6-46a4-b7e7-5829395dfa75', bild: '95579e96-6651-4390-87ec-ca10383da082', datei: 'fogreach-hammer-glimmen', anker: [24, 24] },
  staub:          { effekt: 'ac149a31-342a-4677-a3fe-5545915d16d2', bild: 'fa194d67-9717-4102-9bbb-9351b2c5d718', datei: 'fogreach-staubtritt', anker: [20, 18] },
  funken:         { effekt: '487b9a37-a8b0-4777-b8ba-5f071c78d2e6', bild: 'cf9c77c2-b14b-40c1-8332-bc5127d0be94', datei: 'fogreach-aufprall-funken', anker: [33, 22] },
  schatten:       { effekt: '3cdc3b9b-b64f-4bec-bfee-9ebbf26b1cf8', bild: '35338270-1fa1-4771-b0fd-8c2d8fdd0ee1', datei: 'fogreach-schatten-puff', anker: [30, 27] },
  zyklon:         { effekt: 'c49e3d18-b07e-4134-8605-4ba689decbe0', bild: '4e169a83-aacc-4948-add3-45c4afbdc832', datei: 'fogreach-wirbelsog', anker: [148, 148] }
};

async function holen(name, e) {
  const ordner = path.join(ROH, name);
  fs.mkdirSync(ordner, { recursive: true });
  for (const [endung, ziel] of [['.png', 'vfx.png'], ['.json', 'vfx.json']]) {
    const datei = path.join(ordner, ziel);
    if (fs.existsSync(datei)) continue;
    const url = EXPORT + e.bild + '/' + e.datei + endung;
    const res = await fetch(url);
    if (!res.ok) throw new Error(name + ': ' + url + ' -> ' + res.status);
    fs.writeFileSync(datei, Buffer.from(await res.arrayBuffer()));
    console.log('geholt: ' + datei);
  }
  fs.writeFileSync(path.join(ordner, 'quelle.txt'),
    'PixelLab vfx_workbench, My effects ' + e.effekt + '\nExport ' + e.bild + '/' + e.datei + '\nAnker ' + e.anker.join(',') + '\n');
  return ordner;
}

async function bauen(name) {
  const e = EFFEKTE[name];
  if (!e) throw new Error('unbekannter Effekt: ' + name);
  const ordner = await holen(name, e);
  const liste = JSON.parse(fs.readFileSync(path.join(ordner, 'vfx.json'), 'utf8')).frames;
  const roh = path.join(ordner, 'vfx.png');
  const w = liste[0].sourceSize.w, h = liste[0].sourceSize.h;
  // Anker in die Mitte: links/rechts bzw. oben/unten so weit auffuellen, dass
  // er auf beiden Seiten gleich weit vom Rand liegt.
  const [ax, ay] = e.anker;
  const halbW = Math.max(ax, w - ax), halbH = Math.max(ay, h - ay);
  const fw = 2 * halbW, fh = 2 * halbH;
  const teile = [];
  for (let i = 0; i < liste.length; i++) {
    const f = liste[i].frame;
    const stueck = await sharp(roh).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).png().toBuffer();
    teile.push({ input: stueck, left: i * fw + (halbW - ax), top: halbH - ay });
  }
  fs.mkdirSync(ZIEL, { recursive: true });
  const ziel = path.join(ZIEL, 'spezial_' + name + '.png');
  await sharp({ create: { width: fw * liste.length, height: fh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(teile).png().toFile(ziel);
  console.log(name + ': ' + liste.length + ' Bilder je ' + fw + 'x' + fh + ' -> ' + path.relative(process.cwd(), ziel));
  return { name, ziel, fw, fh, n: liste.length };
}

(async () => {
  const args = process.argv.slice(2);
  const b = args.indexOf('--bogen');
  const bogen = b >= 0 ? args.splice(b, 2)[1] : null;
  const namen = args.length ? args : Object.keys(EFFEKTE);
  const fertig = [];
  for (const n of namen) fertig.push(await bauen(n));
  if (bogen) {
    // Kontaktbogen: eine Zeile je Effekt, doppelt gross, auf Kellerboden-Dunkel.
    const zeilen = [];
    let breite = 0, hoehe = 0;
    for (const f of fertig) {
      const m = await sharp(f.ziel).metadata();
      const buf = await sharp(f.ziel).resize(m.width * 2, m.height * 2, { kernel: 'nearest' }).png().toBuffer();
      zeilen.push({ input: buf, left: 0, top: hoehe });
      breite = Math.max(breite, m.width * 2);
      hoehe += m.height * 2 + 8;
    }
    fs.mkdirSync(path.dirname(bogen), { recursive: true });
    await sharp({ create: { width: breite, height: hoehe, channels: 4, background: '#2a2a30' } })
      .composite(zeilen).png().toFile(bogen);
    console.log('Bogen: ' + bogen);
  }
})().catch((err) => { console.error(err.message); process.exit(1); });
