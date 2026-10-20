// tests/feedbackWorker.test.js — Worker-Route /api/feedback als reine Funktion.
//
// GitHub und der KV-Namespace sind Attrappen; geprueft wird, was der Worker
// daraus macht: Issue mit Labels nach Kategorie, Screenshot in KV und im
// Issue verlinkt, Bewertungen als Kommentare in EINEM Issue je Spielversion,
// Rate-Limit, Groessengrenzen, kein Token in Antworten.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

const modul = () => import(pathToFileURL(path.join(__dirname, '..', 'worker', 'feedback.js')).href);
const TOKEN = 'ghp_geheim_nur_im_test';
const REPO = 'besitzer/repo';
const BILD = 'data:image/jpeg;base64,' + Buffer.from('JPEGDATEN').toString('base64');

function kv() {
  const m = new Map();
  return {
    m,
    async put(k, v, o) { m.set(k, { v, o }); },
    async get(k) { const e = m.get(k); return e ? e.v : null; },
    async getWithMetadata(k) { const e = m.get(k); return e ? { value: e.v, metadata: e.o && e.o.metadata } : { value: null }; }
  };
}

/** GitHub-Attrappe: merkt sich jeden Aufruf, liefert passende Antworten. */
function github(vorhandene) {
  const aufrufe = [];
  let naechste = 41;
  const f = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    aufrufe.push({ url, methode: opts.method, headers: opts.headers, body });
    const json = (status, d) => ({ ok: status < 300, status, json: async () => d });
    if (opts.method === 'GET' && url.includes('/issues?labels=laufbewertung')) return json(200, vorhandene || []);
    if (opts.method === 'POST' && url.endsWith('/issues')) return json(201, { number: ++naechste });
    if (opts.method === 'POST' && /\/issues\/\d+\/comments$/.test(url)) return json(201, { id: 1 });
    return json(404, {});
  };
  return { f, aufrufe };
}

let zaehler = 0;
function req(daten, opts) {
  opts = opts || {};
  const roh = typeof daten === 'string' ? daten : JSON.stringify(daten);
  return new Request('https://spiel.example/api/feedback', {
    method: opts.methode || 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': opts.ip || ('10.0.0.' + (++zaehler)) },
    body: (opts.methode || 'POST') === 'POST' ? roh : undefined
  });
}

const KONTEXT = { version: '2026-10-20 · b999', szene: 'GameScene', tiefe: 4, akt: 2, quests: ['q_eins', 'q_zwei'],
  geraet: 'touch', bildschirm: '800x400', sprache: 'de', email: 'darf@nicht.rein' };

function deps(gh, extra) {
  return Object.assign({ fetch: gh.f, jetzt: () => 1000, id: () => '0123456789abcdef0123', treffer: new Map() }, extra || {});
}

test('Rueckmeldung: Issue mit Labels, Kontext und verlinktem Screenshot', async () => {
  const { behandle } = await modul();
  const gh = github(), K = kv();
  const env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO, FEEDBACK_BILDER: K };
  const r = await behandle(req({ typ: 'feedback', kategorie: 'story', text: 'Tippfehler bei @jemand im Brief\nZeile zwei', kontext: KONTEXT, bild: BILD }), env, deps(gh));
  assert.strictEqual(r.status, 201);
  const antwortText = await r.text();
  assert.ok(!antwortText.includes(TOKEN) && !antwortText.includes(REPO), 'Token oder Repo in der Antwort');
  assert.strictEqual(gh.aufrufe.length, 1);
  const a = gh.aufrufe[0];
  assert.strictEqual(a.url, 'https://api.github.com/repos/besitzer/repo/issues');
  assert.strictEqual(a.headers.Authorization, 'Bearer ' + TOKEN);
  assert.ok(a.headers['User-Agent'], 'GitHub verlangt einen User-Agent');
  assert.deepStrictEqual(a.body.labels, ['story-text', 'tester-feedback']);
  assert.match(a.body.title, /^\[Story\/Text\] Tippfehler bei @​jemand/);
  assert.ok(a.body.body.includes('https://spiel.example/api/feedback/bild/0123456789abcdef0123'), 'Screenshot nicht verlinkt');
  assert.ok(a.body.body.includes('| tiefe | 4 |') && a.body.body.includes('q_eins, q_zwei'), 'Kontext fehlt');
  assert.ok(!a.body.body.includes('darf@nicht.rein'), 'unbekannte Kontextfelder duerfen nicht ins Issue');
  // Bild liegt in KV und kommt ueber die Bild-Route zurueck.
  const e = K.m.get('0123456789abcdef0123');
  assert.strictEqual(Buffer.from(e.v).toString(), 'JPEGDATEN');
  assert.ok(e.o.expirationTtl > 0);
  const b = await behandle(new Request('https://spiel.example/api/feedback/bild/0123456789abcdef0123'), env, deps(gh));
  assert.strictEqual(b.status, 200);
  assert.strictEqual(b.headers.get('Content-Type'), 'image/jpeg');
  assert.strictEqual(Buffer.from(await b.arrayBuffer()).toString(), 'JPEGDATEN');
  const fehlt = await behandle(new Request('https://spiel.example/api/feedback/bild/ffffffffffffffffffff'), env, deps(gh));
  assert.strictEqual(fehlt.status, 404);
});

test('Rueckmeldung: alle Kategorien haben ihr Label', async () => {
  const { behandle } = await modul();
  const erwartet = { fehler: 'fehler', idee: 'idee', balance: 'balance', story: 'story-text', sonstiges: 'sonstiges' };
  for (const k of Object.keys(erwartet)) {
    const gh = github();
    const r = await behandle(req({ typ: 'feedback', kategorie: k, text: 'x', kontext: KONTEXT }), { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO }, deps(gh));
    assert.strictEqual(r.status, 201, k);
    assert.deepStrictEqual(gh.aufrufe[0].body.labels, [erwartet[k], 'tester-feedback']);
    assert.ok(!gh.aufrufe[0].body.body.includes('Screenshot'), 'ohne KV kein Screenshot-Abschnitt');
  }
});

test('Bewertungen: Kommentare in EINEM Issue je Spielversion', async () => {
  const { behandle } = await modul();
  const gh = github([]), K = kv();
  const env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO, FEEDBACK_BILDER: K };
  const r1 = await behandle(req({ typ: 'bewertung', sterne: 4, satz: 'Gut, aber lang.', kontext: KONTEXT }), env, deps(gh));
  assert.strictEqual(r1.status, 201);
  const r2 = await behandle(req({ typ: 'bewertung', sterne: 2, satz: '', kontext: KONTEXT }), env, deps(gh));
  assert.strictEqual(r2.status, 201);
  const neu = gh.aufrufe.filter((a) => a.methode === 'POST' && a.url.endsWith('/issues'));
  assert.strictEqual(neu.length, 1, 'je Version genau ein Issue');
  assert.strictEqual(neu[0].body.title, 'Laufbewertungen 2026-10-20 · b999');
  assert.deepStrictEqual(neu[0].body.labels, ['laufbewertung', 'tester-feedback']);
  const kommentare = gh.aufrufe.filter((a) => a.url.endsWith('/issues/42/comments'));
  assert.strictEqual(kommentare.length, 2);
  assert.match(kommentare[0].body.body, /^\*\*★★★★☆\*\* \(4\/5\)/);
  assert.ok(kommentare[0].body.body.includes('> Gut, aber lang.'));
  assert.match(kommentare[1].body.body, /^\*\*★★☆☆☆\*\* \(2\/5\)/);
  // Andere Version -> eigenes Issue.
  await behandle(req({ typ: 'bewertung', sterne: 5, kontext: Object.assign({}, KONTEXT, { version: 'b1000' }) }), env, deps(gh));
  assert.strictEqual(gh.aufrufe.filter((a) => a.methode === 'POST' && a.url.endsWith('/issues')).length, 2);
});

test('Bewertungen ohne KV: bestehendes Issue wird ueber die Suche gefunden', async () => {
  const { behandle } = await modul();
  const gh = github([{ number: 7, title: 'Laufbewertungen 2026-10-20 · b999' }]);
  const r = await behandle(req({ typ: 'bewertung', sterne: 3, kontext: KONTEXT }), { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO }, deps(gh));
  assert.strictEqual(r.status, 201);
  assert.ok(gh.aufrufe.some((a) => a.url.endsWith('/issues/7/comments')));
  assert.ok(!gh.aufrufe.some((a) => a.methode === 'POST' && a.url.endsWith('/issues')), 'kein neues Issue');
});

test('Ungueltiges wird abgewiesen, ohne GitHub zu fragen', async () => {
  const { behandle } = await modul();
  const env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO, FEEDBACK_BILDER: kv() };
  const faelle = [
    [{ typ: 'feedback', kategorie: 'unsinn', text: 'x' }, 400],
    [{ typ: 'feedback', kategorie: 'idee', text: '   ' }, 400],
    [{ typ: 'feedback', kategorie: 'idee', text: 'x', bild: 'data:image/jpeg;base64,' + 'A'.repeat(600001) }, 413],
    [{ typ: 'bewertung', sterne: 6 }, 400],
    [{ typ: 'bewertung', sterne: 2.5 }, 400],
    [{ typ: 'etwas' }, 400],
    ['kein json', 400],
    ['x'.repeat(900001), 413]
  ];
  for (const [d, status] of faelle) {
    const gh = github();
    const r = await behandle(req(d), env, deps(gh));
    assert.strictEqual(r.status, status, JSON.stringify(d).slice(0, 80));
    assert.strictEqual(gh.aufrufe.length, 0);
  }
  const gh = github();
  assert.strictEqual((await behandle(req({}, { methode: 'GET' }), env, deps(gh))).status, 405);
  assert.strictEqual((await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }), {}, deps(gh))).status, 503);
});

test('Rate-Limit je IP', async () => {
  const { behandle, RATE } = await modul();
  const gh = github(), treffer = new Map();
  const env = { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO };
  let t = 0;
  const d = deps(gh, { treffer, jetzt: () => t });
  for (let i = 0; i < RATE.max; i++) {
    assert.strictEqual((await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }, { ip: '1.2.3.4' }), env, d)).status, 201);
  }
  assert.strictEqual((await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }, { ip: '1.2.3.4' }), env, d)).status, 429);
  assert.strictEqual((await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }, { ip: '5.6.7.8' }), env, d)).status, 201, 'andere IP betroffen');
  t = RATE.fensterMs + 1;
  assert.strictEqual((await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }, { ip: '1.2.3.4' }), env, d)).status, 201, 'Fenster laeuft nicht ab');
});

test('GitHub-Fehler wird als 502 gemeldet (der Client merkt sich die Rueckmeldung)', async () => {
  const { behandle } = await modul();
  const f = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const r = await behandle(req({ typ: 'feedback', kategorie: 'idee', text: 'x' }), { GITHUB_TOKEN: TOKEN, GITHUB_REPO: REPO }, deps({ f }));
  assert.strictEqual(r.status, 502);
});

test('Kein Token, kein Repo und kein Entwicklername im Client oder Worker-Code', () => {
  const fs = require('fs');
  const dateien = ['js/feedback.js', 'worker/feedback.js', 'worker/index.js', 'wrangler.jsonc'];
  for (const d of dateien) {
    const s = fs.readFileSync(path.join(__dirname, '..', d), 'utf8');
    assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_/.test(s), d + ': Token im Code');
    assert.ok(!/B(ae|ä)chtold|BaechtoldLeroy|Leroy/i.test(s), d + ': Entwicklername');
    assert.ok(!/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+/.test(s), d + ': festes Repo');
  }
});
