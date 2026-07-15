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

const ACTS = ['Auftrag', 'Treuer Diener', 'Erste Risse', 'Wahrheit', 'Bruch', 'Rebellion', 'Offenbarung'];
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
let out = '';
out += '# Quest-Übersicht — Fogreach\n\n';
out += '_Automatisch generiert aus_ `js/questSystem.js` _(QUEST_DEFINITIONS) — ' + all.length + ' Quests._\n\n';
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
out += '| Schattenrat | 30 | Rettung oder Beweis |\n\n';
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
