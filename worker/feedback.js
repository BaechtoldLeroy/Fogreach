// worker/feedback.js — Rueckmeldungen der Tester als GitHub-Issues.
//
// POST /api/feedback               Rueckmeldung (typ 'feedback') oder Laufbewertung (typ 'bewertung')
// GET  /api/feedback/bild/<id>     Screenshot aus dem KV-Namespace FEEDBACK_BILDER
//
// Umgebung (siehe docs/feedback.md):
//   env.GITHUB_TOKEN     Secret, Fine-grained Token mit Issues: Read and write
//   env.GITHUB_REPO      "besitzer/repo", als Secret oder Variable im Dashboard
//   env.FEEDBACK_BILDER  KV-Bindung; fehlt sie, werden Screenshots verworfen
//
// Der Handler ist eine reine Funktion von (Request, env, deps): Tests reichen
// ein eigenes fetch fuer GitHub, eine KV-Attrappe und eine Uhr hinein.

export const KATEGORIEN = {
  fehler: { label: 'fehler', titel: 'Fehler' },
  idee: { label: 'idee', titel: 'Idee' },
  balance: { label: 'balance', titel: 'Balance' },
  story: { label: 'story-text', titel: 'Story/Text' },
  sonstiges: { label: 'sonstiges', titel: 'Sonstiges' }
};
export const GRENZEN = {
  koerper: 900000,     // ganze Anfrage in Zeichen
  text: 2000,
  satz: 300,
  bild: 600000,        // data-URL in Zeichen (ca. 450 KB Bild)
  feld: 120            // einzelne Kontextwerte
};
export const RATE = { fensterMs: 10 * 60 * 1000, max: 8 };
const BILD_TTL_S = 180 * 24 * 3600;
const KONTEXT_FELDER = ['version', 'szene', 'tiefe', 'akt', 'geraet', 'bildschirm', 'sprache'];

// Einfaches Rate-Limit je IP, im Speicher der Worker-Instanz. Instanzen leben
// nicht ewig und laufen parallel; gegen versehentliches Dauerfeuer reicht das.
const _treffer = new Map();

export function rateLimit(ip, jetzt, speicher) {
  const m = speicher || _treffer;
  const frisch = (m.get(ip) || []).filter((t) => jetzt - t < RATE.fensterMs);
  if (frisch.length >= RATE.max) { m.set(ip, frisch); return false; }
  frisch.push(jetzt);
  m.set(ip, frisch);
  if (m.size > 5000) m.clear();   // nie unbegrenzt wachsen
  return true;
}

function antwort(status, daten) {
  return new Response(JSON.stringify(daten), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/** Freitext entschaerfen: keine @-Erwaehnungen, keine #-Querverweise, keine HTML-Kommentare. */
export function entschaerfen(s, max) {
  return String(s == null ? '' : s)
    .slice(0, max)
    .replace(/\r\n?/g, '\n')
    .replace(/@/g, '@​')
    .replace(/#(\d)/g, '#​$1')
    .replace(/<!--/g, '&lt;!--')
    .trim();
}

function zitat(s) { return s.split('\n').map((z) => '> ' + z).join('\n'); }

function kurz(v) {
  if (v == null || v === '') return '-';
  return entschaerfen(String(v), GRENZEN.feld).replace(/[|\n`]/g, ' ');
}

/** Kontext als Tabelle; nur bekannte Felder, alles gekuerzt. */
export function kontextTabelle(k) {
  k = (k && typeof k === 'object') ? k : {};
  const zeilen = ['| Feld | Wert |', '| --- | --- |'];
  KONTEXT_FELDER.forEach((f) => zeilen.push('| ' + f + ' | ' + kurz(k[f]) + ' |'));
  const q = Array.isArray(k.quests) ? k.quests.slice(0, 20).map((x) => kurz(x)).join(', ') : '';
  zeilen.push('| quests | ' + (q || '-') + ' |');
  if (k.lauf && typeof k.lauf === 'object') {
    zeilen.push('| lauf | ' + kurz(k.lauf.grund) + ', Tiefe ' + kurz(k.lauf.tiefe) + ', ' + kurz(k.lauf.dauerS) + ' s |');
  }
  return zeilen.join('\n');
}

function version(k) {
  const v = (k && typeof k.version === 'string') ? k.version : '';
  return v.replace(/[^\w .:·-]/g, '').slice(0, 40).trim() || 'unbekannt';
}

function gh(env, deps, pfad, methode, koerper) {
  return deps.fetch('https://api.github.com/repos/' + env.GITHUB_REPO + pfad, {
    method: methode,
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fogreach-feedback',
      'Content-Type': 'application/json'
    },
    body: koerper ? JSON.stringify(koerper) : undefined
  });
}

function base64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function bildSpeichern(env, deps, dataUrl, herkunft) {
  if (!env.FEEDBACK_BILDER || typeof dataUrl !== 'string' || !dataUrl) return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const id = deps.id();
  await env.FEEDBACK_BILDER.put(id, base64Bytes(m[2]), {
    expirationTtl: BILD_TTL_S, metadata: { typ: 'image/' + m[1] }
  });
  return herkunft + '/api/feedback/bild/' + id;
}

async function feedbackIssue(env, deps, daten, herkunft) {
  const kat = KATEGORIEN[daten.kategorie];
  if (!kat) return antwort(400, { fehler: 'kategorie' });
  const text = entschaerfen(daten.text, GRENZEN.text);
  if (!text) return antwort(400, { fehler: 'text' });
  if (daten.bild != null && (typeof daten.bild !== 'string' || daten.bild.length > GRENZEN.bild)) {
    return antwort(413, { fehler: 'bild' });
  }
  const bildUrl = await bildSpeichern(env, deps, daten.bild, herkunft);
  const ersteZeile = text.split('\n')[0].replace(/^>\s*/, '');
  const titel = '[' + kat.titel + '] ' + (ersteZeile.length > 70 ? ersteZeile.slice(0, 67) + '...' : ersteZeile);
  const teile = [zitat(text), '', '### Kontext', kontextTabelle(daten.kontext)];
  if (bildUrl) teile.push('', '### Screenshot', '![Screenshot](' + bildUrl + ')');
  teile.push('', '_Gesendet aus dem Spiel (Tester-Rückmeldung)._');
  const r = await gh(env, deps, '/issues', 'POST', {
    title: titel, body: teile.join('\n'), labels: [kat.label, 'tester-feedback']
  });
  if (!r.ok) return antwort(502, { fehler: 'github', status: r.status });
  const issue = await r.json();
  return antwort(201, { ok: true, nummer: issue.number });
}

/** Das eine Issue je Spielversion, in dem alle Bewertungen als Kommentare landen. */
async function bewertungsIssue(env, deps, ver) {
  const titel = 'Laufbewertungen ' + ver;
  const kvKey = 'bewertung-issue:' + ver;
  if (env.FEEDBACK_BILDER) {
    const n = await env.FEEDBACK_BILDER.get(kvKey);
    if (n) return parseInt(n, 10);
  }
  const suche = await gh(env, deps, '/issues?labels=laufbewertung&state=all&per_page=100', 'GET');
  if (suche.ok) {
    const liste = await suche.json();
    const treffer = Array.isArray(liste) ? liste.find((i) => i && i.title === titel) : null;
    if (treffer) {
      if (env.FEEDBACK_BILDER) await env.FEEDBACK_BILDER.put(kvKey, String(treffer.number));
      return treffer.number;
    }
  }
  const neu = await gh(env, deps, '/issues', 'POST', {
    title: titel,
    body: 'Sternebewertungen der Tester für die Spielversion ' + ver + ', je Lauf ein Kommentar.',
    labels: ['laufbewertung', 'tester-feedback']
  });
  if (!neu.ok) return null;
  const issue = await neu.json();
  if (env.FEEDBACK_BILDER) await env.FEEDBACK_BILDER.put(kvKey, String(issue.number));
  return issue.number;
}

async function bewertungKommentar(env, deps, daten) {
  const sterne = daten.sterne;
  if (!Number.isInteger(sterne) || sterne < 1 || sterne > 5) return antwort(400, { fehler: 'sterne' });
  const satz = entschaerfen(daten.satz, GRENZEN.satz);
  const ver = version(daten.kontext);
  const nummer = await bewertungsIssue(env, deps, ver);
  if (!nummer) return antwort(502, { fehler: 'github' });
  const koerper = ['**' + '★'.repeat(sterne) + '☆'.repeat(5 - sterne) + '** (' + sterne + '/5)'];
  if (satz) koerper.push('', zitat(satz));
  koerper.push('', '<details><summary>Kontext</summary>', '', kontextTabelle(daten.kontext), '', '</details>');
  const r = await gh(env, deps, '/issues/' + nummer + '/comments', 'POST', { body: koerper.join('\n') });
  if (!r.ok) return antwort(502, { fehler: 'github', status: r.status });
  return antwort(201, { ok: true, nummer });
}

async function bildAusliefern(env, id) {
  if (!/^[a-f0-9-]{16,64}$/.test(id) || !env.FEEDBACK_BILDER) return new Response('Nicht gefunden', { status: 404 });
  const r = await env.FEEDBACK_BILDER.getWithMetadata(id, { type: 'arrayBuffer' });
  if (!r || !r.value) return new Response('Nicht gefunden', { status: 404 });
  const typ = (r.metadata && /^image\/(jpeg|png)$/.test(r.metadata.typ)) ? r.metadata.typ : 'image/jpeg';
  return new Response(r.value, {
    status: 200,
    headers: { 'Content-Type': typ, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }
  });
}

/**
 * deps (optional): { fetch, jetzt, id, treffer } fuer Tests; sonst die
 * Laufzeit (globales fetch, Date.now, crypto.randomUUID, Speicher der Instanz).
 */
export async function behandle(request, env, deps) {
  env = env || {};
  deps = Object.assign({
    fetch: (...a) => fetch(...a),
    jetzt: () => Date.now(),
    id: () => crypto.randomUUID(),
    treffer: _treffer
  }, deps || {});
  const url = new URL(request.url);
  const pfad = url.pathname.replace(/\/+$/, '');

  if (pfad.startsWith('/api/feedback/bild/')) {
    if (request.method !== 'GET') return antwort(405, { fehler: 'methode' });
    return bildAusliefern(env, pfad.slice('/api/feedback/bild/'.length));
  }
  if (pfad !== '/api/feedback') return antwort(404, { fehler: 'pfad' });
  if (request.method !== 'POST') return antwort(405, { fehler: 'methode' });
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return antwort(503, { fehler: 'nicht eingerichtet' });

  const laenge = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (laenge > GRENZEN.koerper) return antwort(413, { fehler: 'zu gross' });
  const ip = request.headers.get('CF-Connecting-IP') || 'unbekannt';
  if (!rateLimit(ip, deps.jetzt(), deps.treffer)) return antwort(429, { fehler: 'zu viele' });

  const roh = await request.text();
  if (roh.length > GRENZEN.koerper) return antwort(413, { fehler: 'zu gross' });
  let daten;
  try { daten = JSON.parse(roh); } catch (e) { return antwort(400, { fehler: 'json' }); }
  if (!daten || typeof daten !== 'object') return antwort(400, { fehler: 'json' });

  try {
    if (daten.typ === 'bewertung') return await bewertungKommentar(env, deps, daten);
    if (daten.typ === 'feedback') return await feedbackIssue(env, deps, daten, url.origin);
    return antwort(400, { fehler: 'typ' });
  } catch (e) {
    return antwort(502, { fehler: 'intern' });
  }
}
