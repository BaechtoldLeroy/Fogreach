/**
 * tools/storySeite.js — die teilbare Seite "Fogreach Dossier": Geschichte und
 * alle Auftraege auf einen Blick.
 *
 * Die Geschichte folgt dem Story-Kern v6.1 (kitty-specs/062-.../Fogreach_Story_v6.md),
 * die Akt-Einleitungen kommen aus dem Spiel (js/storySystem.js, ACT_NARRATIVES),
 * die Auftraege direkt aus js/questSystem.js (QUEST_DEFINITIONS). So bleibt die
 * Seite beim naechsten Aufruf auf dem Stand des Spiels.
 *
 *   node tools/storySeite.js [ziel.html]
 *
 * Ohne Ziel: docs/storySeite.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ZIEL = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'storySeite.html'));

global.window = {};
require(path.join(ROOT, 'js', 'questSystem.js'));
require(path.join(ROOT, 'js', 'storyDialog.js'));
const D = window.questSystem.QUEST_DEFINITIONS;
const WAHL = (window.storyDialog && window.storyDialog.byQuest) || {};

// Die Akt-Einleitungen, wie das Spiel sie zeigt.
const storyQuelle = fs.readFileSync(path.join(ROOT, 'js', 'storySystem.js'), 'utf8');
const nb = storyQuelle.indexOf('const ACT_NARRATIVES = {');
const ne = storyQuelle.indexOf('};', nb);
const ERZAEHLT = Function('return ' + storyQuelle.slice(nb + 'const ACT_NARRATIVES = '.length, ne + 1))();

const versionQuelle = fs.readFileSync(path.join(ROOT, 'js', 'version.js'), 'utf8');
const STAND = (/GAME_VERSION = '([^']+)'/.exec(versionQuelle) || [])[1] || '';

const NPC = {
  aldric: 'Ratsherr Aldric', harren: 'Bürgermeister Harren', elara: 'Elara',
  mara: 'Mara', branka: 'Branka', thom: 'Setzer Thom',
  klerus_priester: 'Klerus-Priester', stadtwache: 'Stadtwache', buerger: 'Bürger',
  anschlagtafel: 'Anschlagtafel'
};
const REIHENFOLGE = ['aldric', 'harren', 'elara', 'mara', 'branka', 'thom', 'klerus_priester', 'stadtwache', 'buerger', 'anschlagtafel'];

const TYP = {
  kill: 'Kampf', explore: 'Erkunden', fetch: 'Bringen', observe: 'Beobachten', boss: 'Boss',
  system: 'Einführung', craft: 'Schmieden', dungeon_runs: 'Läufe', dungeon_run: 'Läufe',
  wave: 'Standhalten', dialogue: 'Gespräch'
};

// Die Akte: Geschichte aus dem Story-Kern v6.1, Akt-Index wie im Spiel (storySystem).
const AKTE = [
  { idx: 0, id: 'auftrag', titel: 'Der Dienst', label: 'Prolog',
    inhalt: 'Du erwachst in der Archivschmiede ohne Erinnerung. Aldric schickt Dich in die Keller. Die Einführungen zeigen Schmiede, Presse, Schwarzmarkt und Wissensbaum. Mara behandelt Dich wie einen Fremden, lässt aber einen Satz fallen, der zu viel weiss. Harrens Tochter ist verschwunden, ihr Tagebuch nennt alle drei Fraktionen.',
    boss: null, momente: [] },
  { idx: 1, id: 'treuer_diener', titel: 'Treuer Diener', label: 'Akt 1',
    inhalt: 'Elara rettet Dich im Keller vor der Kettenwache und gibt Dir erst danach Aufträge: das versiegelte Bündel, dann das Dokument mit den drei Siegeln. Du arbeitest für Magistrat, Klerus und Garde. Die Stadt stimmt über das Edikt der Woche ab; in der öffentlichen Sitzung wird verkündet: Egal was gewinnt, die Patrouillen verdoppeln sich. In der geheimen Sitzung siehst Du ein Gesicht, drei Masken, das Zeichen der drei Ketten. Harren bittet Dich zu bleiben: «Räum weiter für sie, und heimlich für mich.»',
    boss: null,
    momente: ['Sie rettet Dich: Im Keller, umzingelt von der Kettenwache, taucht Elara auf und bringt Dich raus. Erst danach gibt sie Dir einen Auftrag.',
      'Ihr Versteck: Sie zeigt Dir einen Ort, den sonst niemand kennt. «Hier vergisst der Nebel einen nicht so schnell.»'] },
  { idx: 2, id: 'erste_risse', titel: 'Das Doppelspiel', label: 'Akt 2',
    inhalt: 'Aussen Rat, innen Widerstand. Mara sagt Dir, dass sie Dich von früher kennt, und öffnet Dir ihr Netz. Elara zeigt Dir, dass die Verschwundenen für Rituale gebraucht werden. Beim Konvoi siehst Du versiegelte Phiolen; was darin ist, weisst Du noch nicht. Der Kettenmeister fällt. Am Ende erfährst Du, dass Elara Harrens Tochter ist; ihm erzählt sie, sie sei aus eigenem Willen geflohen.',
    boss: 'Kettenmeister (Tiefe 10)',
    momente: ['Dein alter Hammer: «Ich habe ihn aufgehoben.» Deine Hände erkennen ihn, Du selbst nicht.',
      'Ihre Angst: wie es ist, die eigene Familie nicht sehen zu dürfen.',
      'Das Wiedersehen mit Harren. Sie zögert einen Atemzug zu lang, bevor sie ihn umarmt.'] },
  { idx: 3, id: 'wahrheit', titel: 'Die Enttarnung', label: 'Akt 3',
    inhalt: 'Der Widerstand verliert, Maras Leute werden verhaftet, bevor sie losgehen. Es gibt einen Maulwurf. Im Ratsarchiv findest Du Elaras Akte: «Vermisst, Fall geschlossen», datiert vor dem Tag ihres Verschwindens. In der verseuchten Kammer siehst Du, wo Menschen abgefüllt werden. Am Schacht zur Esse erklärt Elara Dir, wie man sie «zerstört»: indem man ihre Bindung löst. Aldric enttarnt Dich, Branka bringt Dich in Elaras Versteck. Du folgst dem Maulwurf bis in die Ratskammer: Elara neben Aldric, an ihrem Ring das Zeichen.',
    boss: 'Zeremonienmeister (Tiefe 20)',
    momente: ['Die Klinge: «Ich habe sie für Dich schmieden lassen.» Wer sie im Inventar genauer ansieht, findet das Zeichen der drei Ketten im Stahl.',
      'Eine wahre Meldung, die sie verschweigt: «Nicht alles hilft.»',
      'Die Nacht nach dem Bruch: Branka bringt Dich zu ihr, sie bleibt die Nacht bei Dir.'] },
  { idx: 4, id: 'bruch', titel: 'Die Quelle', label: 'Akt 4',
    inhalt: 'Das Rathaus ist zu, oben bleibt Dir kein Ort. Elara ist zur Esse hinabgestiegen, und Du folgst ihr, um sie zu zerstören. Harren folgt Dir ohne Amulett; mit jeder Tiefe nimmt ihm der Nebel mehr, bis nur «Lene» bleibt. An der Esse, mit erhobenem Hammer, durchschaust Du, was Deine Hände tun, und hältst inne. «Alles haben wir vorausgesehen. Nur nicht, dass Du es merkst.» Harren erreicht sie, sie stösst ihn bewusst weg, nimmt Deinen Hammer, und die Esse nimmt sie. Der letzte Schlag ist Handwerk: Du löst die Bindung in die andere Richtung, die Esse zerbricht. Mara verlangt, dass Du Elara richtest. Danach druckst Du alles, und die Stadt glaubt es, weil sie sich erinnert. In «Die letzte Wache» führt Mara Dich zu Aldric, leer vom Nebel.',
    boss: 'Der Nachhall (Tiefe 25), Elara, besessen (Tiefe 30)', momente: [] }
];

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function questZeile(id) {
  const q = D[id];
  const lohn = [];
  if (q.rewards && q.rewards.xp) lohn.push(q.rewards.xp + ' Erfahrung');
  if (q.rewards && q.rewards.gold) lohn.push(q.rewards.gold + ' Gold');
  if (q.rewards && (q.rewards.item || q.rewards.items)) lohn.push('Gegenstand');
  const fakten = [];
  fakten.push('<span>Art <b>' + esc(TYP[q.type] || q.type || '—') + '</b></span>');
  if (lohn.length) fakten.push('<span>Lohn <b>' + esc(lohn.join(', ')) + '</b></span>');
  if (q.minDepth) fakten.push('<span>ab Tiefe <b>' + q.minDepth + '</b></span>');
  const vor = (q.prerequisites || []).map((p) => (D[p] && D[p].title) || p);
  if (vor.length) fakten.push('<span>nach <b>' + esc(vor.join(', ')) + '</b></span>');
  if (q.turnInNpcId) fakten.push('<span>Abgabe bei <b>' + esc(NPC[q.turnInNpcId] || q.turnInNpcId) + '</b></span>');
  const wer = q.npcId || 'unbekannt';
  const dialog = [];
  if (q.dialogueOffer) dialog.push('<div class="dialog"><span class="etikett">Angebot</span>' + esc(q.dialogueOffer) + '</div>');
  if (q.dialogueComplete) dialog.push('<div class="dialog"><span class="etikett">Abschluss</span>' + esc(q.dialogueComplete) + '</div>');
  // v6.1: zwei Abschluesse, die Wahl beim Abgeben (storyDialog mit setFlags).
  const wahl = WAHL[q.id];
  if (wahl && (wahl.choices || []).some((c) => c.setFlags && c.setFlags.length)) {
    wahl.choices.forEach((c) => {
      dialog.push('<div class="dialog"><span class="etikett">' + esc(c.label) + '</span>' + esc(c.response || '') + '</div>');
    });
  }
  return '<details class="quest" data-wer="' + esc(wer) + '" data-wer-name="' + esc(NPC[wer] || wer) + '">'
    + '<summary><span class="q-titel">' + esc(q.title) + '</span><span class="q-wer">' + esc(NPC[wer] || wer) + '</span>'
    + '<span class="q-was">' + esc(q.description) + '</span></summary>'
    + '<div class="q-detail"><div class="q-fakten">' + fakten.join('') + '</div>' + dialog.join('') + '</div></details>';
}

function sortiert(ids) {
  return ids.slice().sort((a, b) => {
    const ra = REIHENFOLGE.indexOf(D[a].npcId), rb = REIHENFOLGE.indexOf(D[b].npcId);
    if (ra !== rb) return ra - rb;
    return (D[a].chain || 0) - (D[b].chain || 0);
  });
}

const ids = Object.keys(D);
const brett = ids.filter((id) => D[id].npcId === 'anschlagtafel');
const aktSeiten = AKTE.map((a) => {
  const qs = sortiert(ids.filter((id) => D[id].npcId !== 'anschlagtafel' && (D[id].requiredAct || 0) === a.idx));
  const momente = a.momente.length
    ? '<h3>Elara</h3><ul class="momente">' + a.momente.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '';
  return '<section class="akt" id="' + a.id + '">'
    + '<div class="akt-kopf"><span class="etikett">' + esc(a.label) + '</span><h2>' + esc(a.titel) + '</h2>'
    + (a.boss ? '<span class="boss">Boss: ' + esc(a.boss) + '</span>' : '') + '</div>'
    + (ERZAEHLT[a.id] ? '<p class="erzaehlt">' + esc(ERZAEHLT[a.id]) + '</p>' : '')
    + '<p>' + esc(a.inhalt) + '</p>' + momente
    + '<h3>Aufträge ab diesem Akt (' + qs.length + ')</h3>'
    + '<div class="quests">' + qs.map(questZeile).join('') + '<p class="leer" hidden>Kein Auftrag passt zum Filter.</p></div>'
    + '</section>';
}).join('\n');
const brettSeite = '<section class="akt" id="brett"><div class="akt-kopf"><span class="etikett">Nebenher</span><h2>Aushänge an der Anschlagtafel</h2></div>'
  + '<p>Kleine Aufträge des Magistrats und der Druckerei, jederzeit am Brett auf dem Platz.</p>'
  + '<div class="quests">' + sortiert(brett).map(questZeile).join('') + '<p class="leer" hidden>Kein Auftrag passt zum Filter.</p></div></section>';

const nav = AKTE.map((a) => '<a href="#' + a.id + '">' + esc(a.label + ' · ' + a.titel) + '</a>').join('')
  + '<a href="#brett">Anschlagtafel</a><a href="#entscheidungen">Entscheidungen</a>';

const vorlage = fs.readFileSync(path.join(__dirname, 'storySeite.template.html'), 'utf8');
const seite = vorlage
  .replace('__STAND__', () => esc(STAND))
  .replace('__ANZAHL__', () => String(ids.length))
  .replace('__NAV__', () => nav)
  .replace('__AKTE__', () => aktSeiten + '\n' + brettSeite)
  .replace('__DATEN__', () => JSON.stringify({ reihenfolge: REIHENFOLGE }).replace(/</g, '\\u003c'));
fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, seite);
console.log('geschrieben: ' + ZIEL + ' (' + ids.length + ' Auftraege, ' + Math.round(seite.length / 1024) + ' KB)');
