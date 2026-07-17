# Research — Story v4 Quest-Rückgrat (Phase 0)

Auflösung der offenen Unbekannten aus dem Plan. Format je Punkt: Entscheidung · Begründung · Verworfene Alternativen.

## R1 — Story-Flag-Speicher

**Entscheidung:** Den bestehenden Flag-Speicher in `js/questSystem.js` weiterverwenden (`setFlag(name, value)` / `hasFlag(name)`, interne `questFlags`-Map), NICHT das in der Migration skizzierte separate `js/questFlags.js` anlegen. Fehlende Lesehilfen (`getFlags()`/`listFlags()`) werden dort ergänzt, damit das spätere Finale-Feature darauf aufsetzen kann.

**Begründung:** Der Store existiert bereits, wird über `getQuestSaveData()`/`loadQuestSaveData()` mit dem Quest-State persistiert und reist damit automatisch über `window.SlotStorage` slot-getrennt mit. Ein zweites, paralleles Modul wäre ein zweiter Wahrheitsspeicher — exakt das Drift-Muster, das in diesem Projekt schon den Speicherslot-Bug (Wissensbaum) verursacht hat. FR-014/FR-015 sind damit größtenteils bereits erfüllt; die Arbeit reduziert sich auf Wiring (neue Quests rufen `setFlag`).

**Verworfen:** `js/questFlags.js` als `StoryFlags`-Modul (Migration Abschnitt E/F). Zusätzlich verworfen: die ES-`import`-Form der Vorlage (Projekt ist Classic-Script, C-001).

## R2 — Altstand-Erkennung und Reset

**Entscheidung:** Ein Feld `storyVersion` (Integer, v4 = z. B. `4`) im Quest-Save-Blob (`getQuestSaveData()`). Beim Laden (`loadQuestSaveData()`): wenn `storyVersion` fehlt oder `< STORY_VERSION`, den Quest-State + Flags NICHT übernehmen, sondern frisch auf Akt 0 initialisieren (bestehendes `_initQuestState()` + `advanceToAct`-Reset). Charakter-State bleibt unberührt, weil er außerhalb des `quests`-Blobs liegt.

**Begründung:** Version-gated Reset ist deterministisch und testbar (Alt-Save-Fixture ohne `storyVersion` → Akt 0). Er isoliert exakt den Story-Teil. Erkennung über „enthält alte IDs" wäre fragil (Teilüberschneidungen).

**Verworfen:** Heuristische Erkennung anhand vorhandener alter Quest-IDs (`ritual_chamber`, `final_truth`). Verworfen: harte Migration alter Fortschritte (vom Nutzer als Reset entschieden, Spec-Assumption).

**Offen für Umsetzung:** Der Akt-Index lebt in `storySystem.js` (`advanceToAct`/`getCurrentActIndex`). Der Reset muss auch den Story-Akt auf 0 setzen, nicht nur den Quest-State. Beim Umsetzen sicherstellen, dass `storySystem`-Reset mit dem Quest-Reset zusammen passiert.

## R3 — Reward-Feldnamen

**Entscheidung:** Die Migration nennt `reputation: { klerus: 1 }` und `knowledgeFragments: N`. Diese auf die bestehenden Reward-Felder abbilden: `reputation` → `factionStanding` (verarbeitet von `factionSystem`), `knowledgeFragments` → `fragments` (verarbeitet von `knowledgeTree`). Keine neuen Reward-Pipelines.

**Begründung:** Die bestehende `questSystem`-Reward-Verarbeitung kennt `factionStanding` und `fragments` bereits (siehe `rewards`-Handling + `genQuestDoc.rew`). Neue Feldnamen würden ins Leere laufen oder eine zweite Pipeline erfordern.

**Verworfen:** Neue Reward-Felder `reputation`/`knowledgeFragments` im Code einführen.

## R4 — Flag-abhängige Dialog-Varianten

**Entscheidung:** Für den Backbone werden Quest-Texte als die bestehenden Angebots-/Unterwegs-/Abschluss-Strings umgesetzt. Wo die Migration einen flag-abhängigen Abschlusstext zeigt (z. B. `council_collusion_reveal.complete` je nach `verification_sealed`), wird geprüft, ob das bestehende Dialogsystem einen Funktions-/Varianten-Abschluss trägt; falls nein, wird die häufigere/neutrale Variante als String gewählt und die Flag-Abzweigung als Kommentar/TODO fürs Inszenierungs-Feature markiert. KEIN neues Auswahl-UI (`[Spieler: …]`).

**Begründung:** Rich-Branching-Dialoge und Szenen sind explizit Out of Scope (Spec). Der Backbone muss die Akt-Leiter und Texte liefern, nicht die Inszenierung.

**Verworfen:** Ausbau des Dialogsystems um Spieler-Antwortauswahl in diesem Feature.

**Umsetzungsnotiz:** Beim Umsetzen einmal prüfen, wie `questSystem` den Abschlusstext rendert (fixer String vs. Callback), und die tragfähige Form wählen.

## R5 — „Genau vier Trigger"-Invariante als Test

**Entscheidung:** Ein Test verankert, dass GENAU vier Quests `advanceAct` setzen (plus der hartverdrahtete `council_collusion_reveal`-Sprung, der über `advanceToAct(2)` läuft), und dass jeder bewohnte Akt bis 4 einen Trigger hat. Zusätzlich ein Test, dass `story_ending` nach `the_reckoning` gesetzt wird.

**Begründung:** Genau das Fehlen eines solchen Invarianten-Tests führte zu #44 (Akt 5/6 ohne Trigger, unbemerkt). Der Test macht künftige Drift sichtbar. Es gibt bereits einen verwandten Test aus der Akt-1-Reparatur, der als Vorlage dient.

**Verworfen:** Nur manuelle Prüfung.

## R7 — Objective-Trigger-Verdrahtung (aus der Analyse, Option B)

**Entscheidung:** Jedes neue/geänderte Objective-Ziel muss auslösbar sein. Drei Fälle:
1. Bereits verdrahtet (kill/boss_kill/explore/craft/dungeon_run/wave; bestehende fetch/observe-Ziele) → keine Aktion.
2. Neu, gameplay-basiert → **WP05** verdrahtet: `fetch verification_seal|proclamation|memory_shard` als Quest-Item-Drops in `loot.js` (Muster `journal_fragment`), `observe escort_route|informant_id` als Spionage-Zonen in `espionageSystem.js` (Muster `convoy_intel`/`archive_record`).
3. Neu, szenengebunden (`collusion_reveal_seen` = geheime Sitzung, `three_hands_seen` = Elaras zweite Wahrheit) → Szene ist Out-of-Scope; Objective bleibt **`dialogue`** (Auto-Complete bei Annahme). Der `observe`-Trigger kommt mit der jeweiligen Szene im Inszenierungs-Feature.

**Begründung (verifiziert am Code):** `council_collusion_reveal` ist heute `dialogue` und advanciert zuverlässig auf Akt 2; ein Wechsel auf `observe collusion_reveal_seen` ohne Trigger machte Akt 2 unerreichbar. `magistrat_verification` ist heute `kill enemy ×8` (ein früherer Trigger-Fix); `verification_seal` ist nirgends verdrahtet. Ohne R7 hätte die wörtliche Migration mehrere Quests auf dem Akt-Pfad uncompletable gemacht — dieselbe Fehlerklasse wie #44. Ein Trigger-Audit-Test (WP03) verankert die Regel dauerhaft.

**Verworfen:** Option A (überall wirkende Alt-Typen behalten) — verwarf der Nutzer zugunsten der vollständigen Verdrahtung (Option B). Verworfen: `observe`-Trigger für die zwei szenengebundenen Ziele „irgendwie" faken — das hieße die Out-of-Scope-Szene bauen.

## R6 — Boss-Ziel-IDs

**Entscheidung:** Die Boss-Quest-Objectives (`mara_warning`→`kettenmeister`, `elara_ritual`→`zeremonienmeister`, `schattenrat_finale`→`schattenrat`) gegen das Boss-Mapping in `js/player.js` (`bossMapping`) gegenprüfen. Umbenennung `harren_rescue`→`schattenrat_finale` darf das `boss_kill`-Ziel `schattenrat` nicht verlieren.

**Begründung:** In dieser Session gab es bereits einen Copy-Paste-Fehler im Boss-Mapping; die Umbenennungen sind eine Wiederholungsgefahr. Bestehende Boss-Leiter-Tests decken das ab und werden angepasst.

**Verworfen:** —
