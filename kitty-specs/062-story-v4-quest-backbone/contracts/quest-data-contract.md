# Quest-Daten-Kontrakt — v4-Zielzustand (34 Quests)

Verbindliche Zuordnung für Umsetzung und Tests, abgeleitet aus Migration Abschnitt B/C. **Objective-Feld heißt im Code `required`/`current`** (bestehende Konvention), nicht `count` (Migration-Notation) — VERIFY beim Umsetzen. Nur `harren_daughter_investigation`, `council_collusion_reveal`, `mara_warning`, `bruch_confrontation` setzen `advanceAct`.

Legende: **T→N** setzt `advanceAct: N` · **D** Doppel-Tonspur im Abschluss · **N** neue Quest · Flag in `{…}` · **⚙WP05** Objective-Ziel wird von WP05 verdrahtet · **⏳auto** szenengebundenes Reveal → `dialogue` (Auto-Complete-Platzhalter bis zum Inszenierungs-Feature).

## Trigger-Regel (nach der Analyse, Option B)

Jedes Objective-Ziel MUSS auslösbar sein, sonst ist die Quest uncompletable (Fehlerklasse #44). Drei Fälle:
1. **Bereits verdrahtet** (kill / boss_kill / explore / craft / dungeon_run / wave; `fetch` mit bestehendem Quest-Item; `observe` in bestehender Spionage-Zone) → keine Aktion.
2. **Neu, gameplay-basiert** (`fetch verification_seal|proclamation|memory_shard`, `observe escort_route|informant_id`) → **WP05** verdrahtet Drop bzw. Spionage-Zone.
3. **Neu, szenengebunden** (`collusion_reveal_seen` = geheime Sitzung, `three_hands_seen` = Elaras zweite Wahrheit) → Szene ist Out-of-Scope; Objective bleibt **`dialogue`** (Auto-Complete bei Annahme), bis das Inszenierungs-Feature die Szene liefert und den `observe`-Trigger setzt.

## Akt 0 — Der Dienst (requiredAct 0)

| id | npcId | prerequisites | objective | Marker/Flags |
|---|---|---|---|---|
| `resistance_fetch_01` | elara | — | kill enemy ×5 | |
| `aldric_cleanup` | aldric | — | kill enemy ×10 | |
| `aldric_patrol` | aldric | — | explore room ×3 | |
| `harren_daughter_investigation` | harren | aldric_cleanup, aldric_patrol | fetch journal_fragment ×1 | **T→1** |

## Akt 1 — Treuer Diener (requiredAct 1)

| id | npcId | prerequisites | objective | Marker/Flags |
|---|---|---|---|---|
| `magistrat_verification` | aldric | harren_daughter_investigation | fetch verification_seal ×1 **⚙WP05** | Wahl {verification_sealed / verification_refused} |
| `klerus_purification` | klerus_priester | harren_daughter_investigation | kill elite_enemy ×3, minDepth 3 | |
| `garde_patrol_expansion` | stadtwache | harren_daughter_investigation | kill enemy ×10 | |
| `widerstand_proof` | elara | harren_daughter_investigation | fetch council_document ×1 | |
| `faction_campaign` | aldric | harren_daughter_investigation | fetch proclamation ×3 **⚙WP05** | **N**, optional; Wahl (factionStanding) |
| `council_collusion_reveal` | harren | magistrat_verification, klerus_purification, garde_patrol_expansion, widerstand_proof | dialogue collusion_reveal_seen ×1 **⏳auto** | **T→2** |

## Akt 2 — Das Doppelspiel (requiredAct 2)

| id | npcId | prerequisites | objective | Marker/Flags |
|---|---|---|---|---|
| `council_seizure` | aldric | — | fetch seized_writings ×3 | **D**; Wahl {petitions_kept / petitions_surrendered} |
| `council_surveillance` | aldric | council_seizure | explore room ×3 | **D** |
| `klerus_district_purge` | klerus_priester | — | kill enemy ×8 | **N D** |
| `mara_contact` | mara | — | explore room ×3 | |
| `elara_meeting` | elara | — | fetch document ×2 | unlock elara_trust → {elara_trust} |
| `branka_doubt` | branka | — | kill elite_enemy ×5 | |
| `branka_transcripts` | branka | mara_contact | fetch interrogation_record ×2 | |
| `espionage_convoy` | mara | mara_contact | observe convoy_intel ×1 | ggf. {convoy_blade_drawn} |
| `mara_warning` | mara | mara_contact, espionage_convoy | boss_kill kettenmeister ×1 | **T→3** (Boss Tiefe 10) |

## Akt 3 — Die Enttarnung (requiredAct 3)

| id | npcId | prerequisites | objective | Marker/Flags |
|---|---|---|---|---|
| `verseuchte_kammer` | aldric | council_surveillance | explore room ×2 | **D** (ex-`ritual_chamber`) |
| `garde_night_escort` | stadtwache | — | observe escort_route ×1 **⚙WP05** | **N D** |
| `espionage_archive` | harren | espionage_convoy | observe archive_record ×1 | |
| `espionage_informant` | mara | espionage_archive | observe informant_id ×1 **⚙WP05** | setzt {mole_evidence} |
| `thom_truth` | thom | — | fetch print_plate ×5 | von Akt 4 hochgezogen |
| `elara_ritual` | elara | elara_meeting | boss_kill zeremonienmeister ×1 | (Boss Tiefe 20) |
| `elara_blade` | elara | elara_ritual | dialogue elara_gift ×1 | Elaras Klinge (Item) |
| `elara_second_truth` | elara | thom_truth, elara_ritual | dialogue three_hands_seen ×1 **⏳auto** | Teil-Reveal, **KEIN advanceAct** |
| `who_you_were` | branka | branka_doubt | fetch memory_shard ×3, minDepth 5 **⚙WP05** | setzt {self_remembered} |
| `bruch_confrontation` | branka | verseuchte_kammer, elara_second_truth | kill elite_enemy ×3, minDepth 8 | **T→4** |

## Akt 4 — Der Verrat und die Presse (requiredAct 4)

| id | npcId | prerequisites | objective | Marker/Flags |
|---|---|---|---|---|
| `branka_weapons` | branka | branka_doubt | craft craft_item ×3 | |
| `thom_pamphlets` | thom | thom_truth | dungeon_run ×3, minDepth 22 | unlock xp_bonus_10 |
| `schattenrat_finale` | harren | — | boss_kill schattenrat ×1 | (Boss Tiefe 30, ex-`harren_rescue`) |
| `mara_assault` | mara | schattenrat_finale | wave reach_wave ×30 | optional |
| `the_reckoning` | thom | schattenrat_finale | dialogue press_decision ×1 | **unlocks story_ending** |

**Gestrichen:** `final_truth`.

## Invarianten (für Tests)

- Genau **4** Quests mit `advanceAct` (die vier T-Markierten). `council_collusion_reveal` zusätzlich hartverdrahtet auf `advanceToAct(2)`.
- Jeder Akt-Index 1–4 hat genau einen Trigger; kein `advanceAct: 5/6`.
- Abschluss von `the_reckoning` → `story_ending` gesetzt.
- 34 Quests, keine doppelten `id`, keine doppelten `title`.
- Doppel-Tonspur (D) an: `council_seizure`, `council_surveillance`, `verseuchte_kammer` (+ die neuen Tarnaufträge `klerus_district_purge`, `garde_night_escort`).
- Boss-Objectives ↔ `player.js` bossMapping: kettenmeister / zeremonienmeister / schattenrat.
- **npcId** entspricht den BESTEHENDEN Code-Werten: `klerus_priester` (nicht `klerus`), `stadtwache` (nicht `garde`). Die Migration-C-Blöcke nutzen abweichende Werte — ignorieren.
- **Trigger-Audit:** jedes Objective-Ziel ist auslösbar — entweder bereits verdrahtet, von **⚙WP05** verdrahtet, oder **⏳auto** (`dialogue`). Kein Ziel bleibt ohne Trigger.
