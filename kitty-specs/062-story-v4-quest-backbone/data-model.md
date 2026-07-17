# Data Model — Story v4 Quest-Rückgrat (Phase 1)

## 1. Quest-Definition (Schema)

Eintrag in `QUEST_DEFINITIONS` (`js/questSystem.js`). Felder (ASCII-Code-Strings gemäß C-002):

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `id` | string | ja | eindeutige Quest-ID |
| `title` | string | ja | Anzeigename (eindeutig, FR-020) |
| `npcId` | string | ja | gebender NPC (aldric, harren, elara, mara, branka, thom, klerus_priester/klerus, stadtwache/garde) |
| `chain` | number | ja | Reihenfolge innerhalb des NPC-Strangs |
| `requiredAct` | number | ja | Akt-Index, ab dem angeboten wird (FR-005) |
| `prerequisites` | string[] | ja | abzuschließende Quest-IDs (FR-006) |
| `objectives` | object[] | ja | `{ type, target, current, required }` |
| `rewards` | object | nein | `xp`, `factionStanding`, `fragments`, `materials`, `unlocks`, `items`, `info` (R3) |
| `advanceAct` | number | nein | setzt bei Abschluss den Akt auf diesen Index (nur 4 Quests, FR-001) |
| `minDepth` | number | nein | Objective zählt erst ab dieser Tiefe |
| `unlocks` | string[] | nein | Freischalt-Flags (z. B. `story_ending`) |
| `dialogueOffer` / `dialogueProgress` / `dialogueComplete` | string | ja(Offer/Complete) | Quest-Texte |

**Objective-Typen (bestehend):** `kill` (enemy/elite_enemy), `explore` (room), `fetch`, `observe`, `boss_kill`, `wave` (reach_wave), `dungeon_run`, `craft`, `dialogue` (auto-complete bei Annahme).

### 1a. Objective-Trigger-Verdrahtung (Option B)

Jedes Ziel muss auslösbar sein (Trigger-Audit, sonst Fehlerklasse #44).

| Objective-Ziel | Quest | Trigger-Quelle | Wer |
|---|---|---|---|
| `fetch verification_seal` | magistrat_verification | Quest-Item-Drop (loot.js, Muster `journal_fragment`) | **WP05** |
| `fetch proclamation` | faction_campaign | Quest-Item-Drop | **WP05** |
| `fetch memory_shard` | who_you_were | Quest-Item-Drop | **WP05** |
| `observe escort_route` | garde_night_escort | Spionage-Zone (espionageSystem.js) | **WP05** |
| `observe informant_id` | espionage_informant | Spionage-Zone | **WP05** |
| `dialogue collusion_reveal_seen` | council_collusion_reveal | Auto-Complete bei Annahme (Szene folgt) | ⏳ Platzhalter |
| `dialogue three_hands_seen` | elara_second_truth | Auto-Complete bei Annahme (Szene folgt) | ⏳ Platzhalter |
| alle übrigen | — | bereits verdrahtet (kill/boss_kill/explore/craft/dungeon_run/wave/bestehende fetch·observe) | — |

## 2. Akt-Register (kanonisch)

Genau vier `advanceAct`-Trigger; `council_collusion_reveal` läuft zusätzlich über den hartverdrahteten `advanceToAct(2)`-Sprung (bestehend). Kein weiterer Trigger.

| Von→Nach | Akt-Index/Name | Trigger-Quest | Mechanismus |
|---|---|---|---|
| Start | `0` Der Dienst | — | Startzustand |
| →1 | `1` Treuer Diener | `harren_daughter_investigation` | `advanceAct: 1` |
| →2 | `2` Das Doppelspiel | `council_collusion_reveal` | `advanceAct: 2` (+ hartverdrahtet) |
| →3 | `3` Die Enttarnung | `mara_warning` | `advanceAct: 3` |
| →4 | `4` Der Verrat und die Presse | `bruch_confrontation` | `advanceAct: 4` |
| Ende | — | `the_reckoning` | `unlocks: ['story_ending']` |

**`storySystem.js` STORY_ACTS-Namen** werden auf die v4-Namen gesetzt (Index 0–4): Der Dienst, Treuer Diener, Das Doppelspiel, Die Enttarnung, Der Verrat und die Presse. (Die alten Indizes 5/6 entfallen bzw. werden nicht mehr referenziert.)

## 3. Quest-Platzierung (34, Zielzustand)

Verbindliche Zuordnung im Kontrakt: [contracts/quest-data-contract.md](contracts/quest-data-contract.md). Kurzfassung der Änderungen ggü. Ist:

- **Umbenannt:** `ritual_chamber`→`verseuchte_kammer` (Akt 3, Doppel), `harren_rescue`→`schattenrat_finale` (Akt 4, `boss_kill schattenrat`).
- **Entfernt:** `final_truth`.
- **Neu:** `faction_campaign` (A1), `klerus_district_purge` (A2, Doppel), `garde_night_escort` (A3, Doppel), `who_you_were` (A3), `elara_second_truth` (A3, kein Trigger), `the_reckoning` (A4, schaltet `story_ending`).
- **Trigger verschoben:** `mara_warning` `advanceAct: 3`; `bruch_confrontation` `advanceAct: 4`; `elara_second_truth` OHNE `advanceAct`.
- **requiredAct/prerequisites:** Doppelspiel-Verteilung über Akt 2/3 gemäß Kontrakt.
- **`espionage_informant`:** `npcId: mara`, Akt 3, setzt `mole_evidence`.
- **`thom_truth`:** nach Akt 3 hochgezogen.

## 4. Story-Flags (Backbone)

Gespeichert im bestehenden `questFlags`-Store (`setFlag`/`hasFlag`), NICHT in einem neuen Modul (R1). Persistiert im Quest-Save-Blob, slot-getrennt.

| Flag | gesetzt von | Zweck (Backbone) |
|---|---|---|
| `verification_sealed` / `verification_refused` | `magistrat_verification` | Siegel-Wahl; später Regler 2 |
| `petitions_kept` / `petitions_surrendered` | `council_seizure` | Gesuche-Wahl; später Regler 2 |
| `convoy_blade_drawn` | `espionage_convoy` (Tarnung auffliegt) | später Regler 2 |
| `elara_trust` | `elara_meeting` | später Regler 3 |
| `mole_evidence` | `espionage_informant` | später Regler 3 |
| `self_remembered` | `who_you_were` | später Regler 4 |

Finale-Flags (`harren_dead`, `elara_spared`/`elara_killed`) gehören zum Finale-Folge-Feature und werden hier NICHT gesetzt.

## 5. Save-Format & Reset

- Quest-Save-Blob (`getQuestSaveData()`): `{ storyVersion: <int>, quests: {...}, flags: {...} }`.
- `STORY_VERSION` als Konstante in `questSystem.js` (v4).
- `loadQuestSaveData(data)`: wenn `data.storyVersion` fehlt oder `< STORY_VERSION` → Quest-State + Flags verwerfen, `_initQuestState()`, Akt auf 0; sonst normal laden. (FR-016/FR-017)
- Der zugehörige Story-Akt (`storySystem`) wird beim Reset auf 0 gesetzt.
- Charakter-State (Level/Inventar/Gold/Skillbaum) liegt außerhalb des `quests`-Blobs → unberührt.

## 6. Berührte Systeme

| Datei | Änderung |
|---|---|
| `js/questSystem.js` | QUEST_DEFINITIONS (v4), Register/Trigger, `STORY_VERSION` + Reset in `loadQuestSaveData`, `getFlags()`-Ergänzung |
| `js/storySystem.js` | STORY_ACTS-Namen (v4), Reset-Hook auf Akt 0 |
| `js/storage.js` | ggf. Reihenfolge/Weitergabe beim Laden (Story-Reset zusammen mit Quest-Reset) |
| `js/player.js` | Boss-Mapping gegenprüfen (R6) |
| `tools/genQuestDoc.js` | Lauf → `docs/QUESTS.md` |
| `tests/questSystem.test.js` | Trigger-/Reset-/Invarianten-Tests |
| `index.html` | Cache-Buster-Bumps |
