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
require(path.join(ROOT, 'js', 'storyDialog.js'));
const D = window.questSystem.QUEST_DEFINITIONS;
// Entscheidungen beim Abgeben (storyDialog, Auswahl mit setFlags).
const WAHL = (window.storyDialog && window.storyDialog.byQuest) || {};

// Story v6.1: Prolog und vier Akte (Index 0 = Prolog · Der Dienst), Namen wie
// in js/storySystem.js, die Nummer fuer den Spieler ist der Index (Stufe 1b).
const ACTS = ['Prolog · Der Dienst', 'Akt 1 · Treuer Diener', 'Akt 2 · Das Doppelspiel', 'Akt 3 · Die Enttarnung', 'Akt 4 · Die Quelle'];
const NPC = {
  aldric: 'Ratsherr Aldric', harren: 'Bürgermeister Harren', elara: 'Elara',
  mara: 'Späherin Mara', branka: 'Schmiedemeisterin Branka', thom: 'Setzer Thom',
  klerus_priester: 'Klerus-Priester', stadtwache: 'Stadtwache', widerstand: 'Widerstand'
};
const TICK = String.fromCharCode(96);

const SELTENHEIT = ['gewöhnlich', 'magisch', 'selten', 'legendär'];
// Gewicht des Auftrags -> Anteil des Stufenbedarfs als Erfahrungs-Mindestlohn
// (questSystem LOHN_ANTEIL). Die Zahl in der Definition bleibt Untergrenze.
const GEWICHT = { neben: 'Neben', story: 'Story', boss: 'Boss', finale: 'Finale' };

function rew(r, q) {
  if (!r) return '–';
  const p = [];
  const anteil = window.questSystem.LOHN_ANTEIL[q && q.rewardTier];
  if (q && q.rewardTier === 'einfuehrung') { if (r.xp) p.push(r.xp + ' XP (fest, Einführung — wächst nicht mit dem Stufenbedarf)'); }
  else if (r.xp || anteil) p.push('mind. ' + (r.xp || 0) + ' XP' + (anteil ? ' (bzw. ' + Math.round(anteil * 100) + ' % des Stufenbedarfs, ' + GEWICHT[q.rewardTier] + ')' : ''));
  if (r.gold) p.push('mind. ' + r.gold + ' Gold (wächst mit der Tiefe ab ' + ((q && q.minDepth) || 1) + ')');
  if (r.materials) Object.entries(r.materials).forEach(([k, v]) => p.push(v + ' ' + k));
  if (r.druckblaetter) p.push(r.druckblaetter + ' Druckblätter');
  if (r.fragments) p.push(r.fragments + ' Wissens-Fragment(e)');
  if (r.potions) p.push(r.potions + ' Heiltrank');
  if (r.items) r.items.forEach((i) => p.push('**' + (i.name || 'Ausrüstungsstück') + '** (' + (SELTENHEIT[i.tier | 0]) + ', auf Spielerstufe gewürfelt)'));
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
// Kontext nach dem Story-Kern v6.1 (kitty-specs/062-story-v4-quest-backbone/research/Fogreach_Story_v6.md).
out += '## Prämisse\n\n';
out += 'Unter Fogreach brennt eine **Esse**, die Erinnerungen verbrennt. Ihr Rauch ist der Nebel, und wer ihn atmet, vergisst. Der Kettenrat tritt als drei streitende Fraktionen auf, Magistrat, Klerus und Garde; innen gehören ihre Spitzen demselben Kreis an, dem **Schattenrat**. Er füttert die Esse mit beschlagnahmten Schriften und mit den Erinnerungen der Verschwundenen.\n\n';
out += 'Du bist der **Archivschmied**, der letzte Mensch, der die Esse erneuern kann. Der Rat hat Dich geleert, damit der Nebel Dich in der Tiefe nicht auslöscht, und gibt Dir einen Widerstand, den er selbst anführt: durch **Elara**, Harrens Tochter. Sie lehrt Dich, die Esse zu «zerstören», indem man ihre Bindung löst. In Wahrheit ist genau dieses Lösen das Erneuern.\n\n';
out += '> Du hast geglaubt, Du arbeitest für den Rat, dann gegen ihn. In Wahrheit hast Du die ganze Zeit für ihn gearbeitet, auch auf der anderen Seite. Er brauchte nie Dein Ja, nur Deine Hände.\n\n';
out += '## Charaktere\n\n';
out += '| Figur | Rolle | Kern |\n|---|---|---|\n';
out += '| **Archivschmied** (Du) | Letzter seines Handwerks, geleert vom Rat | Erst Ordnung, dann die Wahrheit, am Ende die eigene Geschichte. |\n';
out += '| **Elara** (Kindername Lene) | Harrens Tochter, Gesicht des Widerstands, **Mitglied des Schattenrats** | Soll Dich zur Esse bringen, damit Du sie erneuerst. Stösst im Finale ihren Vater weg; die Esse nimmt sie. |\n';
out += '| **Ratsherr Aldric** | Auftraggeber, Stimme des Schattenrats im Rat | Hat Dich geleert. Flieht nach dem Bruch der Esse in die Tiefe und wird selbst leer. |\n';
out += '| **Bürgermeister Harren** | Amt ohne Macht, kein Mitglied des Widerstands | Will sein Kind zurück. Steigt ohne Amulett hinab und verliert unterwegs alles bis auf «Lene». |\n';
out += '| **Mara** | Späherin, Schwarzmarkt, kennt Dich von früher | Merkt als Erste, dass der Widerstand verraten wird. Verlangt, dass Du Elara richtest. |\n';
out += '| **Branka** | Schmiedemeisterin | Moralischer Kompass, hilft Dir, Dich zu erinnern, und warnt vor dem Preis. |\n';
out += '| **Setzer Thom** | Druckerei | Die Presse ist die Bühne des Endes. |\n';
out += '| **Klerus-Priester**, **Stadtwache** | Fraktionsstimmen | Nennen Flucht „Besessenheit“ und Aufräumen „Reinigung“; antworten mit mehr Patrouillen. |\n\n';
out += '## Fraktionen\n\n';
out += '- **Magistrat**, **Klerus**, **Garde**: die drei ratsinternen Fraktionen. Streiten nach außen, gehören innen dem Schattenrat.\n';
out += '- **Widerstand**: die Opposition, in Wahrheit vom Schattenrat geführt (durch Elara).\n';
out += '- Ansehen bei Fraktionen gibt es seit Story v5 nicht mehr.\n\n';
out += 'Die eine Spur durch das Spiel ist das **Siegel des Schattenrats**, ein Kreis aus drei ineinandergreifenden Ketten.\n\n';
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
out += '5. Optionales `gate()` liefert `true` _(z. B. Maras Schwarzmarkt-Auftrag erst ab erreichter Tiefe 4)_\n\n';
out += '**Reihenfolge im Gespräch (Stufe 1b):** Abgabe, dann ein neuer **Story-Auftrag** (Gewicht story, boss oder finale), dann der Stand eines laufenden Auftrags, dann ein neuer Nebenauftrag. Story-Aufträge kommen also auch neben einem laufenden Nebenauftrag derselben Figur.\n\n';
out += '**Aldric nach dem Bruch:** Ab `enttarnt` steht er nicht mehr im Hub. Was er noch vergeben hatte, laufend oder nie angenommen, bekommt den Status `entfallen` (kein Lohn; im Journal: „Der Rat gibt Dir keine Aufträge mehr.“).\n\n';
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
out += '## Wie die Sammelstücke ins Spiel kommen\n\n';
out += 'Gilt für alle ' + TICK + 'fetch' + TICK + '-Ziele. Quelle: ' + TICK + 'js/loot.js' + TICK
  + ' (questItemDefs) und ' + TICK + 'js/roomManager.js' + TICK + '.\n\n';
out += '- **Sie fallen nur, wenn sie gebraucht werden.** Ein Questgegenstand fällt'
  + ' ausschliesslich, solange die passende Quest läuft UND ihr Zähler noch nicht voll'
  + ' ist. Ohne angenommene Quest gibt es das Stück nicht, und nach dem letzten Exemplar'
  + ' hört es sofort auf zu fallen.\n';
out += '- **Sie fallen von Gegnern.** Je erschlagenem Gegner 10 %. Einzige Ausnahme ist das'
  + ' Ratsdokument mit 20 %. Pro Gegner fällt höchstens EIN Questgegenstand, auch wenn'
  + ' zwei Sammelquests gleichzeitig laufen: die Schleife bricht nach dem ersten Treffer'
  + ' ab.\n';
out += '- **Sie landen nie in einer Wand.** Stirbt der Gegner auf einem unbegehbaren Feld,'
  + ' rückt das Stück auf den nächsten erreichbaren Punkt. Sonst könnte eine'
  + ' Sammelquest unerfüllbar werden.\n';
out += '- **Aufheben zählt, nicht Tragen.** Der Zähler springt beim Darüberlaufen.'
  + ' Questgegenstände gehen nicht ins Inventar und belegen keinen Rasterplatz.\n';
out += '- **Ausnahme Ratsdokument.** Es liegt zusätzlich einmal garantiert in Elaras'
  + ' Kellerbegegnung. Vorher gab es nur die Platzierung, und Spieler suchten zu lange.\n';
out += '- **Beobachten ist etwas anderes.** Die ' + TICK + 'observe' + TICK + '-Ziele sammelt man'
  + ' nicht ein. Sie sind Spionagemissionen in eigenen Raumvorlagen (CouncilWarehouse,'
  + ' SealedArchive, InformantDen): verkleidet in die Zone, dort bleiben, nicht gesehen'
  + ' werden. Zieht man die Klinge, fliegt die Tarnung auf.\n\n';

out += '## Befunde\n\n';
out += 'Aus dem Abgleich mit der Story-Bibel v4 (Stand b246). Keine davon ist ein Fehler im'
  + ' engeren Sinn. Jede ist eine Stelle, an der Umsetzung und Entwurf auseinandergehen.\n\n';
out += '**Vier Quests erfüllen ihr Kriterium beim Annehmen automatisch**, weil sie vom Typ '
  + TICK + 'dialogue' + TICK + ' sind: die geheime Sitzung, Elaras Geschenk, Elaras zweite'
  + ' Wahrheit, die Abrechnung.\n\n';
out += '**Die Abweichung liegt nicht bei den Quests, sondern unter ihnen.** Die geheime'
  + ' Sitzung, der Kippmoment der ganzen Geschichte, ist eine Quest, die sich beim Annehmen'
  + ' selbst abhakt. Ein Kommentar im Code sagt das offen: die inszenierte Szene sollte mit'
  + ' einem späteren Feature kommen. Dasselbe gilt für Elaras Geschenk und ihre zweite'
  + ' Wahrheit.\n\n';
out += '**Die Doppelagenten-Tonspur trägt vier der fünf verlangten Quests.** Überwachung'
  + ' fällt heraus: der Abschlusstext sagt nur, dass man keine Verschwörer gesehen hat.'
  + ' Der vom Entwurf verlangte Halbsatz, dass Mara erfährt, was der Rat nicht erfährt,'
  + ' fehlt.\n\n';
out += '**Eine Unstimmigkeit in der Reihenfolge.** Die Keller-Patrouille trägt '
  + TICK + 'chain: 2' + TICK + ', ihre Folgequest aber ' + TICK + 'chain: 1' + TICK + '. Die'
  + ' Reihenfolge im Hub stellt damit den Auftraggeber vor seine eigene Voraussetzung.\n\n';

out += '## Boss-Leiter ↔ Quest-Leiter\n\n';
out += 'Bosse spawnen an Tier-Gates (Tiefe = Vielfaches von 10, ab Akt 2), der Nachhall dazwischen auf Tiefe 25, solange sein Auftrag läuft:\n\n';
out += '| Boss | Tiefe | Quest |\n|---|---|---|\n';
out += '| Kettenmeister | 10 | Der Kettenmeister (Mara) |\n';
out += '| Zeremonienmeister | 20 | Die Ritualkammer (Elara) |\n';
out += '| Der Nachhall | 25 | Was der Rauch behält (Mara); flüstert aus dem Gespielten, wechselt die Gestalt (Hall, Schwarm, Chor), Namen gehen an Thoms Presse |\n';
out += '| Elara, besessen | 30 | Die Quelle (Branka, Abgabe bei Thom) |\n';
out += '| Der Nachhall der Esse | 30, 60, … | kein Auftrag: steht dort, wenn die Quelle nicht läuft (ersetzt den Schattenrat) |\n\n';
out += '---\n';

const byAct = {};
all.forEach((q) => { (byAct[q.requiredAct] = byAct[q.requiredAct] || []).push(q); });

Object.keys(byAct).map(Number).sort((a, b) => a - b).forEach((a) => {
  out += '\n# Akt-Index ' + a + ' — ' + ACTS[a] + '\n';
  byAct[a].sort((x, y) => (x.chain || 0) - (y.chain || 0)).forEach((q) => {
    out += '\n## ' + q.title + '\n\n';
    out += TICK + q.id + TICK + ' · **NPC:** ' + (NPC[q.npcId] || q.npcId)
      + (q.turnInNpcId ? ' · **Abgabe bei:** ' + (NPC[q.turnInNpcId] || q.turnInNpcId) : '')
      + ' · **Kette:** ' + (q.chain || 0)
      + (q.minDepth ? ' · **Fortschritt erst ab Tiefe ' + q.minDepth + '**' : '') + '\n\n';
    out += quote(q.description) + '\n\n';
    out += '- **Ziel:** ' + objStr(q) + '\n';
    out += '- **Vorbedingung:** ' + ((q.prerequisites && q.prerequisites.length)
      ? q.prerequisites.map((p) => (D[p] ? D[p].title : p)).join(' **+** ') : 'keine')
      + (typeof q.gate === 'function' ? ' (dazu eine Bedingung im Code, ' + TICK + 'gate' + TICK + ')' : '') + '\n';
    out += '- **Belohnung:** ' + rew(q.rewards, q) + '\n\n';
    if (q.dialogueOffer) out += '**Angebot**\n\n' + quote(q.dialogueOffer) + '\n\n';
    if (q.dialogueProgress) out += '**Unterwegs**\n\n' + quote(q.dialogueProgress) + '\n\n';
    if (q.dialogueComplete) out += '**Abschluss**\n\n' + quote(q.dialogueComplete) + '\n\n';
    const wahl = WAHL[q.id];
    if (wahl && (wahl.choices || []).some((c) => c.setFlags && c.setFlags.length)) {
      out += '**Entscheidung beim Abgeben**\n\n';
      wahl.choices.forEach((c) => {
        out += '- _' + c.label + '_ (' + (c.setFlags || []).map((f) => TICK + f + TICK).join(', ') + '): '
          + String(c.response || '').replace(/\n+/g, ' ') + '\n';
      });
      out += '\n';
    }
  });
});

const dest = path.join(ROOT, 'docs', 'QUESTS.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, 'utf8');
console.log('geschrieben: ' + dest + ' (' + all.length + ' Quests, ' + out.length + ' bytes)');
