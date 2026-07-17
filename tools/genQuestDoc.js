// Generiert docs/QUESTS.md aus den echten QUEST_DEFINITIONS (single source of truth).
//
// Aufruf:  node tools/genQuestDoc.js            (Repo-Root wird aus dem Skript-Ort
//          node tools/genQuestDoc.js <root>      abgeleitet; optionales Override)
//
// Hinweis: der Pfad MUSS absolut sein — require('js/questSystem.js') wuerde sonst
// als Modulname statt als Datei aufgeloest.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
global.window = {};
require(path.join(ROOT, 'js', 'questSystem.js'));
const D = window.questSystem.QUEST_DEFINITIONS;

// Story v4 (Feature 062): fünf Akte, Index 0 = Startzustand. Kein Akt 5/6 mehr.
const ACTS = ['Der Dienst', 'Treuer Diener', 'Das Doppelspiel', 'Die Enttarnung', 'Der Verrat und die Presse'];
const NPC = {
  aldric: 'Ratsherr Aldric', harren: 'Bürgermeister Harren', elara: 'Elara',
  mara: 'Mara vom Untergrund', branka: 'Schmiedemeisterin Branka', thom: 'Setzer Thom',
  klerus_priester: 'Klerus-Priester', stadtwache: 'Stadtwache', widerstand: 'Widerstand'
};
const TICK = String.fromCharCode(96);

function rew(r) {
  if (!r) return '–';
  const p = [];
  if (r.xp) p.push(r.xp + ' XP');
  if (r.materials) Object.entries(r.materials).forEach(([k, v]) => p.push(v + ' ' + k));
  if (r.druckblaetter) p.push(r.druckblaetter + ' Druckblätter');
  if (r.fragments) p.push(r.fragments + ' Wissens-Fragment(e)');
  if (r.factionStanding) Object.entries(r.factionStanding).forEach(([k, v]) => p.push('+' + v + ' Ansehen (' + k + ')'));
  if (r.items) r.items.forEach((i) => p.push('**' + i.name + '** (' + (i.rarityLabel || '?') + ', iLvl ' + (i.itemLevel || '?') + ')'));
  if (r.unlocks) p.push('schaltet frei: ' + r.unlocks.join(', '));
  if (r.info) p.push('Info: ' + r.info);
  return p.join(' · ') || '–';
}
const objStr = (q) => (q.objectives || []).map((o) => TICK + o.type + TICK + ' → ' + TICK + o.target + TICK + ' ×' + o.required).join('; ');
const quote = (s) => '> ' + String(s).replace(/\n/g, '\n> ');

const all = Object.values(D);

// Akt-Aufstieg: rein quest-getrieben. `advanceAct: N` auf einer Quest springt bei
// Abschluss auf STORY_ACTS[N]. Story v4: genau vier Quests tragen advanceAct
// (harren_daughter_investigation→1, council_collusion_reveal→2, mara_warning→3,
// bruch_confrontation→4) — der Reveal nutzt jetzt das advanceAct-Feld statt einer
// Hart-Verdrahtung. Depth-basierter Aufstieg wurde in Feature 050 entfernt.
const ADVANCERS = {};
all.forEach((q) => { if (typeof q.advanceAct === 'number') (ADVANCERS[q.advanceAct] = ADVANCERS[q.advanceAct] || []).push(q); });

let out = '';
out += '# Quest-Übersicht — Fogreach\n\n';
out += '_Quest-Daten automatisch generiert aus_ `js/questSystem.js` _(QUEST_DEFINITIONS) — ' + all.length + ' Quests._  \n';
out += '_Neu erzeugen:_ `node tools/genQuestDoc.js`\n\n';
out += '---\n\n';
out += '# Kontext\n\n';
out += '## Prämisse\n\n';
out += 'Du spielst den **Archivschmied** — Handwerker im Dienst des Stadtrats, der Akten, Waffen und Siegel instand hält. Unter der Stadt liegt der Nebel: ein Kellerlabyrinth, in das der Rat dich zum Aufräumen schickt.\n\n';
out += 'Der Rat gibt sich als drei rivalisierende Fraktionen, die sich öffentlich bekämpfen. Tatsächlich **dienen sie alle derselben okkulten Agenda** — und der Spieler ist genau die Art von nützlichem Handwerker, der ihre Spuren beseitigt, ohne Fragen zu stellen.\n\n';
out += 'Auslöser ist die verschwundene Tochter des Bürgermeisters. Jede Fraktion hat eine eigene Version: entführt, besessen, pflichtvergessen. Ihr Tagebuchfragment sagt etwas anderes — **sie ist geflohen**, und alle drei Ratsfraktionen stehen namentlich darin. Von da an ist die Frage nicht mehr *was ist passiert*, sondern *wem gehorchst du noch*.\n\n';
out += '## Charaktere\n\n';
out += '| Figur | Rolle | Steht für | Funktion im Bogen |\n|---|---|---|---|\n';
out += '| **Ratsherr Aldric** | Ratsherr, dein Auftraggeber | Magistrat | Gibt die harmlosen Anfangsjobs. Schickt dich später in die Ritualkammer, um die **eigene Spur des Rats zu verwischen** — der Moment, in dem der Auftraggeber zum Gegner wird. |\n';
out += '| **Bürgermeister Harren** | Vater der Verschwundenen | (unabhängig) | Traut keiner der drei Versionen. Startet die Untersuchung und hält den Reveal in der Hand. |\n';
out += '| **Elara** | Kontakt im Untergrund | Widerstand | Gesicht der Opposition. Führt dich zur Beschwörungskammer, schenkt am Ende ihre Klinge. |\n';
out += '| **Mara vom Untergrund** | Späherin, Schwarzmarkt | Widerstand-nah | Netzwerk & Spionage-Aufträge; treibt die Boss-Konfrontationen. Betreibt auch den Schwarzmarkt. |\n';
out += '| **Schmiedemeisterin Branka** | Archivschmiede | (unabhängig) | Stellt Fragen, die man nicht stellen soll. Ihre Zweifel eskalieren zum **Bruch**. |\n';
out += '| **Setzer Thom** | Hinterhaus-Druckerei | Widerstand-nah | Macht Wahrheit zu Pamphleten — die Presse als Waffe. |\n';
out += '| **Klerus-Priester** | Geistlicher | Klerus | Nennt Flucht „Besessenheit" und Aufräumen „Reinigung". |\n';
out += '| **Stadtwache** | Garde-Offizier | Garde | Antwortet auf alles mit mehr Patrouillen. |\n\n';
out += '## Fraktionen\n\n';
out += 'Ansehen wird pro Fraktion getrackt (`js/factionSystem.js`): feindlich < −25 · neutral · freundlich > 25 · verbündet > 50.\n\n';
out += '- **Magistrat**, **Klerus**, **Garde** — die drei *ratsinternen* Fraktionen. Konkurrieren nach außen, dienen innen derselben Agenda.\n';
out += '- **Widerstand** — die Opposition außerhalb des Systems.\n';
out += '- **Unabhängig** — neutrale Flagge.\n\n';
out += 'In Akt 1 arbeitest du **für alle vier** — das Ansehen ist Konsequenz deines Handelns, kein Content-Gate.\n\n';
out += '## Akt-Struktur\n\n';
out += 'Der Bogen ist **rein quest-getrieben**: ein Akt steigt nur, wenn eine Quest ihn per `advanceAct` hochsetzt. Tiefen-basierter Aufstieg wurde in Feature 050 entfernt.\n\n';
out += '| Index | Akt | Wird erreicht durch |\n|---|---|---|\n';
ACTS.forEach((n, i) => {
  const by = (ADVANCERS[i] || []).map((q) => '**' + q.title + '**').join(', ');
  let how;
  if (i === 0) how = '_Startzustand_';
  else if (by) how = 'Abschluss von ' + by;
  else how = '⚠️ **kein Trigger** — nicht erreichbar';
  out += '| `' + i + '` | ' + n + ' | ' + how + ' |\n';
});
// Lücken aus den Daten ableiten: ein Akt ohne Advancer blockiert sich selbst und
// alles dahinter. Gestrandet ist jede Quest, deren requiredAct >= erster Lücke.
const gaps = ACTS.map((n, i) => i).filter((i) => i > 0 && !(ADVANCERS[i] || []).length);
if (gaps.length) {
  const firstGap = gaps[0];
  const stranded = all.filter((q) => (q.requiredAct || 0) >= firstGap);
  out += '\n**Bekannte Lücken:**\n\n';
  out += '- Kein Trigger für ' + gaps.map((i) => '`' + i + '` ' + ACTS[i]).join(', ')
    + ' — keine Quest setzt ' + gaps.map((i) => TICK + 'advanceAct: ' + i + TICK).join(' bzw. ') + '.\n';
  if (stranded.length) {
    out += '- Dadurch nicht erreichbar: ' + stranded.map((q) => '**' + q.title + '** (' + TICK + q.id + TICK + ')').join(', ')
      + ' — der Fortschritt endet nach Akt ' + (firstGap - 1) + ' (' + ACTS[firstGap - 1] + '). → Issue **#44**.\n';
  }
  out += '\n';
} else {
  out += '\nJeder Akt hat einen Trigger — die Leiter ist lückenlos.\n\n';
}
out += '---\n\n';
out += '# Referenz\n\n';
out += '## Wie eine Quest angeboten wird\n\n';
out += 'Ein NPC bietet eine Quest an, wenn **alle** Bedingungen gelten:\n\n';
out += '1. Status ist `available` (noch nicht angenommen/abgeschlossen)\n';
out += '2. Die Quest gehört diesem NPC (`npcId`)\n';
out += '3. `currentAct >= requiredAct`\n';
out += '4. **Alle** `prerequisites` sind abgeschlossen\n';
out += '5. Optionales `gate()` liefert `true` _(aktuell nutzt keine Quest ein Gate)_\n\n';
out += '**`minDepth` gated nicht das Angebot, sondern den Fortschritt:** Ziele zählen erst, wenn der laufende Run auf mindestens dieser Tiefe ist.\n\n';
out += '**Akt-Index → Name:** ' + ACTS.map((a, i) => '`' + i + '` ' + a).join(' · ') + '\n\n';
out += '## Ziel-Typen und ihre Trigger\n\n';
out += '| Typ | Trigger im Code |\n|---|---|\n';
out += '| `kill` (`enemy` / `elite_enemy`) | Gegner-Tod (`js/player.js`) |\n';
out += '| `explore` (`room`) | Raum gecleart (`js/roomManager.js` → `markRoomCleared`) |\n';
out += '| `fetch` | Quest-Item aufgesammelt (`js/loot.js`) |\n';
out += '| `observe` | Spionage-Zone abgehört (`js/espionageSystem.js`) |\n';
out += '| `boss_kill` | Boss-Tod → `onBossKilled` (`js/player.js` Mapping) |\n';
out += '| `wave` (`reach_wave`) | Run auf Tiefe ≥ Ziel (`onWaveCompleted`) |\n';
out += '| `dungeon_run` | Abgeschlossener Run (`onDungeonCompleted`) |\n';
out += '| `craft` | Item gecraftet (`onCraft`) |\n';
out += '| `dialogue` | **Auto-Complete bei Annahme** |\n\n';
out += '## Boss-Leiter ↔ Quest-Leiter\n\n';
out += 'Bosse spawnen nur an Tier-Gates (Tiefe = Vielfaches von 10, ab Akt 2):\n\n';
out += '| Boss | Tiefe | Quest |\n|---|---|---|\n';
out += '| Kettenmeister | 10 | Maras Warnung |\n';
out += '| Zeremonienmeister | 20 | Die Ritualkammer (Elara) |\n';
out += '| Schattenrat | 30 | Die Quelle (Harren) |\n\n';
out += '---\n';

const byAct = {};
all.forEach((q) => { (byAct[q.requiredAct] = byAct[q.requiredAct] || []).push(q); });

Object.keys(byAct).map(Number).sort((a, b) => a - b).forEach((a) => {
  out += '\n# Akt-Index ' + a + ' — ' + ACTS[a] + '\n';
  byAct[a].sort((x, y) => (x.chain || 0) - (y.chain || 0)).forEach((q) => {
    out += '\n## ' + q.title + '\n\n';
    out += TICK + q.id + TICK + ' · **NPC:** ' + (NPC[q.npcId] || q.npcId)
      + ' · **Kette:** ' + (q.chain || 0)
      + (q.minDepth ? ' · **Fortschritt erst ab Tiefe ' + q.minDepth + '**' : '') + '\n\n';
    out += quote(q.description) + '\n\n';
    out += '- **Ziel:** ' + objStr(q) + '\n';
    out += '- **Vorbedingung:** ' + ((q.prerequisites && q.prerequisites.length)
      ? q.prerequisites.map((p) => (D[p] ? D[p].title : p)).join(' **+** ') : 'keine') + '\n';
    out += '- **Belohnung:** ' + rew(q.rewards) + '\n\n';
    if (q.dialogueOffer) out += '**Angebot**\n\n' + quote(q.dialogueOffer) + '\n\n';
    if (q.dialogueProgress) out += '**Unterwegs**\n\n' + quote(q.dialogueProgress) + '\n\n';
    if (q.dialogueComplete) out += '**Abschluss**\n\n' + quote(q.dialogueComplete) + '\n\n';
  });
});

const dest = path.join(ROOT, 'docs', 'QUESTS.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, 'utf8');
console.log('geschrieben: ' + dest + ' (' + all.length + ' Quests, ' + out.length + ' bytes)');
