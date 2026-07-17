# Fogreach — Quest-System-Migration (v4)

_Gleicht die Migration an die Story-Bibel v4 an. Neu gegenüber v3: Doppelagenten-Aktstruktur mit spätem Bruch, verschobene Trigger, zwei neue Tarnaufträge, `elara_second_truth` ist kein Akt-Trigger mehr, Vatermord im Finale, aktualisiertes Vier-Regler-Modul._

> **Konvention:** Fliesstext in Umlauten (ä, ö, ü). Code-Strings in ASCII (ae, oe, ue), passend zu Deinen bestehenden Spieldaten in `questSystem.js`.

> **Schema-Hinweis:** Feldnamen sind aus der generierten Quest-Übersicht abgeleitet, nicht aus der Quelldatei. Alles mit **VERIFY** einmal gegen `questSystem.js` abgleichen.

---

## A. Kanonisches Akt-Trigger-Register

Regel: genau eine Quest setzt pro Akt-Grenze `advanceAct`, immer nur auf `currentAct + 1`. Abschlusstexte nennen nie eine Aktnummer.

| Ziel-Akt | Index | Name | Trigger-Quest (`id`) | Mechanismus |
|---|---|---|---|---|
| Start | `0` | Der Dienst | — | Startzustand |
| → 1 | `1` | Treuer Diener | `harren_daughter_investigation` | `advanceAct: 1` |
| → 2 | `2` | Das Doppelspiel | `council_collusion_reveal` | `advanceAct: 2` |
| → 3 | `3` | Die Enttarnung | `mara_warning` | `advanceAct: 3` |
| → 4 | `4` | Der Verrat und die Presse | `bruch_confrontation` | `advanceAct: 4` |
| Ende | — | Auflösung | `the_reckoning` | `unlocks: ['story_ending']` |

**Geändert gegenüber v3:** `mara_warning` ist jetzt der Trigger nach Akt 3 (war eine normale Boss-Quest). `bruch_confrontation` triggert Akt 4 (war Akt 3). `elara_second_truth` ist **kein Trigger mehr**, sondern ein Teil-Reveal in Akt 3.

---

## B. Vollständige Platzierung (34 Quests)

`requiredAct` in Klammern. **T** = setzt `advanceAct` (Trigger). **D** = Doppelagenten-Tonspur. **N** = neu.

### Akt 0 (0)
| id | NPC | prerequisites | Objective | |
|---|---|---|---|---|
| `resistance_fetch_01` | Elara | — | kill enemy ×5 | |
| `aldric_cleanup` | Aldric | — | kill enemy ×10 | |
| `aldric_patrol` | Aldric | — | explore room ×3 | |
| `harren_daughter_investigation` | Harren | cleanup, patrol | fetch journal_fragment ×1 | **T→1** |

### Akt 1 (1)
| id | NPC | prerequisites | Objective | |
|---|---|---|---|---|
| `magistrat_verification` | Aldric | daughter_investigation | fetch verification_seal ×1 + Wahl | |
| `klerus_purification` | Klerus | daughter_investigation | kill elite ×3, minDepth 3 | |
| `garde_patrol_expansion` | Garde | daughter_investigation | kill enemy ×10 | |
| `widerstand_proof` | Elara | daughter_investigation | fetch council_document ×1 | |
| `faction_campaign` | Aldric (VERIFY) | daughter_investigation | fetch proclamation ×3 + Wahl | **N**, optional |
| `council_collusion_reveal` | Harren | die 4 Fraktions-Quests | observe collusion_reveal_seen ×1 | **T→2** |

### Akt 2 — Das Doppelspiel (2)
| id | NPC | prerequisites | Objective | |
|---|---|---|---|---|
| `council_seizure` | Aldric | — | fetch seized_writings ×3 + Wahl | **D** |
| `council_surveillance` | Aldric | seizure | explore room ×3 | **D** |
| `klerus_district_purge` | Klerus | — | kill enemy ×8 | **N D** |
| `mara_contact` | Mara | — | explore room ×3 | |
| `elara_meeting` | Elara | — | fetch document ×2 | unlock elara_trust |
| `branka_doubt` | Branka | — | kill elite ×5 | |
| `branka_transcripts` | Branka | mara_contact | fetch interrogation_record ×2 | |
| `espionage_convoy` | Mara | mara_contact | observe convoy_intel ×1 | setzt ggf. convoy_blade_drawn |
| `mara_warning` | Mara | mara_contact, espionage_convoy | boss_kill kettenmeister ×1 | **T→3** (Boss 10) |

### Akt 3 — Die Enttarnung (3)
| id | NPC | prerequisites | Objective | |
|---|---|---|---|---|
| `verseuchte_kammer` | Aldric | council_surveillance | explore room ×2 | **D** |
| `garde_night_escort` | Garde | — | observe escort_route ×1 | **N D** |
| `espionage_archive` | Harren | espionage_convoy | observe archive_record ×1 | |
| `espionage_informant` | Mara | espionage_archive | observe informant_id ×1 | setzt mole_evidence |
| `thom_truth` | Thom | — | fetch print_plate ×5 | von Akt 4 hochgezogen |
| `elara_ritual` | Elara | elara_meeting | boss_kill zeremonienmeister ×1 | (Boss 20) |
| `elara_blade` | Elara | elara_ritual | dialogue elara_gift ×1 | Elaras Klinge |
| `elara_second_truth` | Elara | thom_truth, elara_ritual | observe three_hands_seen ×1 | Teil-Reveal, kein Trigger |
| `who_you_were` | Branka | branka_doubt, minDepth 5 | fetch memory_shard ×3 | setzt self_remembered |
| `bruch_confrontation` | Branka | verseuchte_kammer, elara_second_truth | kill elite ×3, minDepth 8 | **T→4** |

### Akt 4 — Der Verrat und die Presse (4)
| id | NPC | prerequisites | Objective | |
|---|---|---|---|---|
| `branka_weapons` | Branka | branka_doubt | craft craft_item ×3 | |
| `thom_pamphlets` | Thom | thom_truth | dungeon_run ×3, minDepth 22 | unlock xp_bonus_10 |
| `schattenrat_finale` | Harren | — | boss_kill schattenrat ×1 | (Boss 30) |
| `mara_assault` | Mara | schattenrat_finale | wave reach_wave ×30 | optional |
| `the_reckoning` | Thom | schattenrat_finale | dialogue press_decision ×1 | unlock story_ending |

Gestrichen: `final_truth`.

---

## C. Code-Blöcke (geändert oder neu)

> Unverändert gültig aus v3: `harren_daughter_investigation`, `magistrat_verification`, `council_seizure`, `verseuchte_kammer` (Basis), `elara_second_truth` (bis auf entfernten `advanceAct`, s.u.), `schattenrat_finale`, `who_you_were`, `faction_campaign`, `questFlags.js`. Nur die folgenden ändern sich oder kommen neu.

### C1. `council_collusion_reveal` (Trigger → Akt 2, neuer Abschluss ins Doppelspiel)

```js
{
  id: 'council_collusion_reveal',
  npcId: 'harren',
  chain: 3,
  requiredAct: 1,
  prerequisites: ['magistrat_verification','klerus_purification','garde_patrol_expansion','widerstand_proof'],
  objectives: [{ type: 'observe', target: 'collusion_reveal_seen', count: 1 }],
  rewards: { xp: 150, knowledgeFragments: 1 },
  advanceAct: 2,
  text: {
    offer: 'Komm mit. Kein Wort, keine Klinge. Was Du gleich siehst, kannst Du nicht mehr vergessen.',
    progress: 'Folge mir. Es ist Zeit.',
    // Neuer Abschluss: du fliehst NICHT, du bleibst eingebettet. Weiche ins Doppelspiel.
    complete: (flags) => (flags.has('verification_sealed')
      ? 'Ein Gesicht, drei Masken. Und Du hast gehoert, wessen Siegel die Tochter verwaltet hat. Deins. '
      : 'Ein Gesicht, drei Masken. Du hast Dich damals geweigert zu siegeln, und es hat nichts geaendert. '
    ) + 'Du koenntest fliehen. Aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, '
      + 'die ein Fluechtiger nie sieht. Bleib, wo Du bist. Raeum weiter fuer sie, und raeum heimlich fuer '
      + 'uns. Es ist gefaehrlicher. Es ist auch das Einzige, was nuetzt.'
  }
}
```

### C2. `mara_warning` (jetzt Trigger → Akt 3, Kettenmeister mit Fessel-Mechanik)

```js
{
  id: 'mara_warning',
  npcId: 'mara',
  chain: 2,
  requiredAct: 2,
  prerequisites: ['mara_contact', 'espionage_convoy'], // Spionage zuerst, damit die Doppelphase atmet
  objectives: [{ type: 'boss_kill', target: 'kettenmeister', count: 1 }],
  rewards: { xp: 200 },
  advanceAct: 3, // NEU: der Fall des Kettenmeisters sichert die ersten echten Beweise und oeffnet Akt 3
  text: {
    offer: 'Der Kettenmeister haelt die Siegel auf Tiefe 10. Er fesselt, was er fangen will. Faell ihn, dann haben wir den ersten harten Beweis.',
    progress: 'Der Kettenmeister lebt noch, auf Tiefe 10. Wenn er Dich kettet, schlag die Kette, sonst haelt er Dich.',
    complete: 'Der Kettenmeister ist gefallen, die Beweise gesichert. Jetzt kann niemand mehr leugnen, dass der Rat Menschen verarbeitet.'
  }
}
```

### C3. `bruch_confrontation` (jetzt Trigger → Akt 4, Enttarnung)

```js
{
  id: 'bruch_confrontation',
  npcId: 'branka',
  chain: 5,
  requiredAct: 3,
  prerequisites: ['verseuchte_kammer', 'elara_second_truth'],
  minDepth: 8,
  objectives: [{ type: 'kill', target: 'elite_enemy', count: 3 }],
  rewards: { xp: 200 },
  advanceAct: 4, // NEU: der Bruch triggert jetzt Akt 4
  text: {
    offer: 'Aldric weiss es. Dein Doppelspiel ist aufgeflogen, seine Elite-Wachen riegeln die tiefen Gaenge ab, ab Tiefe 8 stellst Du sie. Schlag Dich durch und komm zu mir.',
    progress: 'Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 8 stellst Du sie.',
    complete: 'Du stellst zu viele Fragen, hat er gesagt. Jetzt stellst Du gar keine mehr, Du weisst es. Die Tarnung ist verbrannt, der Bruch ist da. Mara, Thom, ich, wir sind bereit.'
  }
}
```

### C4. `elara_second_truth` (Teil-Reveal, `advanceAct` ENTFERNT)

```js
{
  id: 'elara_second_truth',
  npcId: 'elara',
  chain: 4,
  requiredAct: 3,
  prerequisites: ['thom_truth', 'elara_ritual'],
  objectives: [{ type: 'observe', target: 'three_hands_seen', count: 1 }],
  rewards: { xp: 200, knowledgeFragments: 2 },
  // KEIN advanceAct mehr. Der Reveal liegt jetzt mitten in Akt 3, der Bruch triggert den Aktwechsel.
  text: {
    offer: 'Bevor Du das Letzte tust, sollst Du wissen, fuer wen. Komm, nur wir zwei.',
    progress: 'Elara wartet mit den drei Blaettern.',
    complete: 'Drei Blaetter, eine Hand. Elara ist Harrens Tochter, und der Widerstand hat kuratiert, nicht der Rat allein. Nicht Branka, nicht Mara. Sie. Aber sie erfindet nichts, sie waehlt aus. Merk Dir den Unterschied.'
  }
}
```

### C5. `klerus_district_purge` (NEU, Akt 2, Klerus, Doppel)

```js
{
  id: 'klerus_district_purge',
  npcId: 'klerus',
  chain: 3,
  requiredAct: 2,
  prerequisites: [],
  objectives: [{ type: 'kill', target: 'enemy', count: 8 }],
  rewards: { xp: 70, reputation: { klerus: 1 } },
  text: {
    offer: 'Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen.',
    progress: 'Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.',
    // Doppel: du gibst Mara die Liste, bevor der Rat sie bekommt.
    complete: 'Du bringst die Namen. (Eine Abschrift steckt schon bei Mara. Wer auf dieser Liste steht, verschwindet, aber vielleicht nicht mehr alle.)'
  }
}
```

### C6. `garde_night_escort` (NEU, Akt 3, Garde, Doppel)

```js
{
  id: 'garde_night_escort',
  npcId: 'garde',
  chain: 3,
  requiredAct: 3,
  prerequisites: [],
  objectives: [{ type: 'observe', target: 'escort_route', count: 1 }],
  rewards: { xp: 90, reputation: { garde: 1 } },
  text: {
    offer: 'Heute Nacht geht ein Transport. Sicher die Route, frag nicht, was drin ist. Loyalitaet zahlt sich aus.',
    progress: 'Der Transport rollt noch nicht. Halt die Route im Auge, bleib unauffaellig.',
    // Doppel: du merkst dir Route und Ladung fuer Mara.
    complete: 'Die Route ist sicher. (Und in Deinem Kopf, Weg, Zeit und Fracht, bereit fuer Mara. Es waren keine Waffen, es waren Ritualzutaten.)'
  }
}
```

### C7. Doppel-Tonspur an bestehenden Rats-Quests

`council_seizure`, `council_surveillance` und `verseuchte_kammer` behalten ihre v3-Objectives, bekommen aber im `complete`-Text die zweite Tonspur. Muster (Beispiel `council_surveillance`):

```js
// council_surveillance.text.complete (ersetzt v1-Text)
complete: 'Bericht angenommen. (Du hast keine Verschwoerer gesehen, nur Familien, die Brot teilen. '
        + 'Was der Rat nicht erfaehrt, erfaehrt Mara. Zwei Namen weniger auf dem Bericht, als Du gesehen hast.)'
```

`verseuchte_kammer.text.complete` bleibt inhaltlich (Beschwoerungskammer, Aldric benutzt Dich), ergaenzt um den Doppel-Halbsatz, dass Du das Gesehene an Mara weitergibst.

### C8. `the_reckoning` (Vatermord-Fassung, ersetzt jede frühere Finale-Version)

Volltext: `Fogreach_Story_v4.md`, Abschnitt 13.4. Das Ende ist fix (Du druckst). Die eine echte Wahl (Elara verschonen) erscheint nur, wenn `elaraSpareable`. Der Vatermord passiert in jedem Fall vor der Wahl.

```js
{
  id: 'the_reckoning',
  npcId: 'thom',
  chain: 6,
  requiredAct: 4,
  prerequisites: ['schattenrat_finale'],
  objectives: [{ type: 'dialogue', target: 'press_decision', count: 1 }],
  unlocks: ['story_ending'],
  // Ablauf der Endsequenz (Skript, nicht Quest-Feld):
  //  1. Elara will die saubere Wahrheit drucken und greift zur Nebelschleuse.
  //  2. Harren tritt dazwischen. Elara toetet ihn im Affekt -> setFlag 'harren_dead'. Ihr Zusammenbruch.
  //  3. Vier-Regler-Zustand aus computeFinaleState() wird gelesen.
  decision: {
    id: 'elara_confrontation',
    gate: (s) => s.elaraSpareable, // sonst erzwungen: nur die Klinge
    prompt: 'Elara steht ueber ihrem toten Vater. Du haeltst die drei Blaetter und ihr Vertrauen. Was tust Du?',
    options: [
      { id: 'spare',  label: 'Mit Worten aufhalten', setFlags: ['elara_spared'] },
      { id: 'strike', label: 'Mit ihrer Klinge',      setFlags: ['elara_killed'] }
    ]
  }
  // gate false -> erzwungene Sequenz, elara_killed.
  // Endsequenz rendert aus computeFinaleState + elara_spared/killed:
  //  - betrayalForeseen: Nebel steigt nicht, sonst steigt er und Erinnerung duennt.
  //  - allies: voller oder leerer Raum.
  //  - selfRemembered: letzter Satz gehoert Dir, sonst namenlos.
  //  - IMMER: du druckst; Elara verbrennt zuvor das eine belastende Blatt; die Wahrheit ist unvollstaendig.
}
```

---

## D. Boss-Mechaniken (Combat-Design)

Kein Quest-Feld, sondern Vorgabe fuer die Boss-Implementierung.

- **Kettenmeister (Tiefe 10, Akt 2).** Fesselung. In Abstaenden kettet er den Spieler an Wand oder Boden, Bewegung blockiert. Der Spieler zerschlaegt die Kette (mehrere Treffer), waehrend der Boss zuschlaegt. Klar lesbar, thematisch: ergriffen werden.
- **Zeremonienmeister (Tiefe 20, Akt 3).** Auslöschung. Loescht Arena-Sektoren mit Nebel (temporaer unbegehbar oder sichtblockiert), laesst bereits getoetete Gegner einmalig zurueckkehren, stoert kurz eine Spieler-Faehigkeit. Vorspiel auf Elaras Nebelgriff.
- **Schattenrat (Tiefe 30, Akt 4).** Die Quelle. Finale-Boss, thematisch die gesammelte weggegebene Erinnerung. Mechanik frei, sollte Elemente beider Vorgaenger aufgreifen (Fesselung plus Auslöschung).

---

## E. Die vier Regler als Modul

```js
// js/questFinale.js
import { StoryFlags } from './questFlags.js';

export function computeFinaleState(quests, reputation, knowledgeFragments) {
  // Regler 1: Verrat vorhergesehen? Beide Spionage-Faeden verfolgt.
  const betrayalForeseen =
    isComplete(quests, 'espionage_archive') && isComplete(quests, 'espionage_informant');

  // Regler 3: Elara mit Worten aufhaltbar? Vertrauen plus Beweis.
  // Harren ist zu diesem Zeitpunkt tot (Vatermord), also haengt es allein an Dir.
  const elaraSpareable =
    StoryFlags.has('elara_trust') && StoryFlags.has('mole_evidence');

  // Regler 4: Selbst-Erinnerung, nur ueber die optionale Quest.
  const selfRemembered = StoryFlags.has('self_remembered');

  // Regler 2: Wer steht neben Dir? Waermescore.
  let allies = 0;
  if (isComplete(quests, 'branka_transcripts')) allies++;
  if (isComplete(quests, 'mara_warning'))       allies++;
  if (isComplete(quests, 'thom_truth'))         allies++;
  if (StoryFlags.has('verification_sealed'))    allies--;
  if (StoryFlags.has('petitions_surrendered'))  allies--;
  if (StoryFlags.has('convoy_blade_drawn'))     allies--;

  return { betrayalForeseen, elaraSpareable, selfRemembered, allies };
}
```

**Geändert gegenüber v3:** Harren kann Elara nicht mehr mit seinem Flehen brechen, weil er im Finale stirbt. Regler 3 haengt jetzt allein an `elara_trust` plus `mole_evidence` und Deiner Wahl. Das Verschonen ist damit die duesterere Entscheidung, eine Vatermoerderin am Leben zu lassen.

---

## F. Flag-Herkunft (vollständig)

| Flag | gesetzt von | speist |
|---|---|---|
| `verification_sealed` / `verification_refused` | `magistrat_verification` | Sitzung-Abschluss, Regler 2 |
| `petitions_kept` / `petitions_surrendered` | `council_seizure` | Rueckruf Akt 3, Regler 2 |
| `convoy_blade_drawn` | `espionage_convoy` (Tarnung fliegt auf) | Regler 2 |
| `elara_trust` | `elara_meeting` | Regler 3 |
| `mole_evidence` | `espionage_informant` | Regler 3 |
| `self_remembered` | `who_you_were` | Regler 4 |
| `harren_dead` | `the_reckoning` (Vatermord, immer) | Endsequenz |
| `elara_spared` / `elara_killed` | `the_reckoning` (Wahl oder erzwungen) | Endsequenz |

---

## G. Verifikations-Checkliste

1. Frischer Spielstand erreicht Akt 1, 2, 3, 4 in Folge, jeder Uebergang von genau der Quest im Register.
2. **Doppelspiel:** Nach der Sitzung fliehst Du nicht, die Rats-Quests in Akt 2 und 3 sind weiter annehmbar, ihre Abschlusstexte tragen die zweite Tonspur.
3. **Später Bruch:** `bruch_confrontation` triggert Akt 4, nicht Akt 3. Aldric ist bis dahin nicht feindlich.
4. `mara_warning` triggert Akt 3.
5. Nach `the_reckoning` ist `story_ending` gesetzt, `harren_dead` gesetzt, Du druckst in jedem Fall.
6. **Regler-Test:** einmal mit verfolgtem Verrat und `who_you_were`, einmal ohne. Finale unterscheidet sich in Nebel-Anstieg, Anwesenden, Elaras Ueberleben, letztem Satz.
7. `elara_second_truth` setzt keinen `advanceAct`.
8. Keine zwei Quests mit gleichem Namen. `espionage_informant` von Mara. Neue Tarnaufträge von Klerus und Garde.
9. Identitaet: Harren nennt die Tochter bis `elara_second_truth` nie Elara.
10. Console fehlerfrei, keine Regressionen.

---

## H. Reihenfolge der Umsetzung

1. Register (A) als Kommentar-Header in `questSystem.js`.
2. Alte `actN_open`-Flags raus, `advanceAct` nur noch auf den vier Trigger-Quests des Registers.
3. Trigger verschieben: `mara_warning` → 3, `bruch_confrontation` → 4, `elara_second_truth` ohne `advanceAct`.
4. `requiredAct` und `prerequisites` aller Quests gemaess Tabelle B setzen (Doppelspiel-Verteilung).
5. `ritual_chamber` → `verseuchte_kammer`, `harren_rescue` → `schattenrat_finale`, `final_truth` entfernen.
6. `espionage_informant.npcId` → `mara`, setzt `mole_evidence`.
7. Neue Quests: `faction_campaign`, `who_you_were`, `klerus_district_purge`, `garde_night_escort`, `elara_second_truth`, `the_reckoning`.
8. Doppel-Tonspur in `council_seizure`, `council_surveillance`, `verseuchte_kammer`, plus die beiden neuen Tarnaufträge.
9. `questFlags.js` und `questFinale.js` anlegen, in Speicher- und Endlogik einhaengen.
10. Boss-Mechaniken (D) implementieren.
11. Hub-Uebergaenge gemaess Bibel Abschnitt 15, der grosse Wechsel liegt am Bruch (Ende Akt 3).
12. Checkliste G durchspielen.
