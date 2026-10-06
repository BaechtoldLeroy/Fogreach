/**
 * tools/pixellabHolen.js — einen PixelLab-Charakter in die Spieler-Bilder legen.
 *
 * PixelLab benennt seine Richtungen nach Himmelsrichtungen, das Spiel nach
 * dir00..dir07 (siehe PLAYER_DIRECTION_SEQUENCE in js/player.js). Die Zuordnung
 * steht unten in RICHTUNGEN und folgt den dortigen Vektoren:
 *
 *   dir00 = west        dir04 = ost
 *   dir01 = nordwest    dir05 = suedost
 *   dir02 = nord        dir06 = sued   (frontal, zum Betrachter)
 *   dir03 = nordost     dir07 = suedwest
 *
 *   node tools/pixellabHolen.js <charakter-id> [--nach assets/PlayerSpritesNeu]
 *                               [--token <schluessel>] [--trocken]
 *
 * Ohne --token wird PIXELLAB_TOKEN aus der Umgebung genommen.
 *
 * Geschrieben wird NUR in den Zielordner; der ausgelieferte Satz unter
 * assets/PlayerSprites bleibt unberuehrt.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ENDPUNKT = 'https://api.pixellab.ai/mcp';

// PixelLab-Richtung -> dir-Nummer des Spiels.
const RICHTUNGEN = {
  'west': '00',
  'north-west': '01',
  'north': '02',
  'north-east': '03',
  'east': '04',
  'south-east': '05',
  'south': '06',
  'south-west': '07'
};

function arg(name, vorgabe) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? vorgabe : process.argv[i + 1];
}

/** Ein JSON-RPC-Aufruf gegen den MCP-Endpunkt (Antwort kommt als SSE). */
async function rpc(token, methode, params) {
  const antwort = await fetch(ENDPUNKT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: methode, params: params })
  });
  const text = await antwort.text();
  for (const zeile of text.split('\n')) {
    const roh = zeile.replace(/^data: /, '').trim();
    if (!roh.startsWith('{')) continue;
    const j = JSON.parse(roh);
    if (j.error) throw new Error(JSON.stringify(j.error));
    if (j.result) return j.result;
  }
  throw new Error('keine Antwort: ' + text.slice(0, 300));
}

/** Die Zeilen der Animationsgruppe aus der Textausgabe von get_character lesen. */
function bilderAuslesen(bericht) {
  // Jede Richtung steht als "    <richtung>: <url>, <url>, ..." in der Ausgabe.
  const treffer = {};
  const zeilen = bericht.split('\n');
  for (const z of zeilen) {
    const m = z.match(/^\s{4}([a-z-]+):\s*(https?:\/\/\S.*)$/);
    if (!m) continue;
    const richtung = m[1];
    if (!(richtung in RICHTUNGEN)) continue;
    const urls = m[2].split(',').map((u) => u.trim()).filter(Boolean);
    if (urls.length) treffer[richtung] = urls;
  }
  return treffer;
}

async function laden(url, ziel) {
  const a = await fetch(url);
  if (!a.ok) throw new Error(a.status + ' ' + url.slice(0, 80));
  fs.writeFileSync(ziel, Buffer.from(await a.arrayBuffer()));
}

(async () => {
  const id = process.argv[2];
  const token = arg('token', process.env.PIXELLAB_TOKEN);
  const nach = arg('nach', 'assets/PlayerSpritesNeu');
  const trocken = process.argv.includes('--trocken');
  if (!id || !token) {
    console.error('Aufruf: node tools/pixellabHolen.js <charakter-id> [--token <schluessel>]');
    process.exit(1);
  }

  const res = await rpc(token, 'tools/call', {
    name: 'get_character',
    arguments: { character_id: id, include_preview: false }
  });
  const bericht = (res.content || []).map((c) => c.text || '').join('\n');
  const bilder = bilderAuslesen(bericht);
  const gefunden = Object.keys(bilder);
  if (!gefunden.length) throw new Error('keine Animationsbilder gefunden — laeuft der Job noch?');

  // Vollstaendigkeit PRUEFEN, bevor etwas geschrieben wird: ein halber Satz
  // faellt im Spiel nicht auf, die fehlende Richtung zeigt dann das alte Bild.
  const fehlend = Object.keys(RICHTUNGEN).filter((r) => !bilder[r]);
  const kurz = gefunden.filter((r) => bilder[r].length !== 8);
  console.log('Richtungen: ' + gefunden.length + '/8'
    + (fehlend.length ? '  FEHLT: ' + fehlend.join(', ') : ''));
  kurz.forEach((r) => console.log('  ' + r + ': nur ' + bilder[r].length + ' Phasen statt 8'));
  if (trocken) return;
  if (fehlend.length || kurz.length) {
    throw new Error('unvollstaendig — es wird nichts geschrieben');
  }

  fs.mkdirSync(nach, { recursive: true });
  let n = 0;
  for (const [richtung, urls] of Object.entries(bilder)) {
    const dd = RICHTUNGEN[richtung];
    for (let f = 0; f < urls.length; f++) {
      const name = 'dir' + dd + '_f' + String(f).padStart(2, '0') + '.png';
      await laden(urls[f], path.join(nach, name));
      n++;
    }
  }
  console.log('geschrieben: ' + n + ' Bilder nach ' + nach);
})().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
