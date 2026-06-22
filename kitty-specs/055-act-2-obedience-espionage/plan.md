# Implementation Plan: 055 — Act 2 (Obedience vs. Memory) + Espionage

**Branch**: `main` (planning + shipping on main, per project workflow)
**Date**: 2026-06-23
**Spec**: [spec.md](spec.md)

## Summary

Akt 2 als **lineare, gating-freie Quest-Chain** (6–7 authored Quests), die
vom bereits existierenden `act2_open`-Unlock (Akt-1-Q6) ausgeht und in die
schon ausformulierten Story-Milestones `wahrheit` → `bruch` mündet. Plus ein
neuer **Espionage-Mission-Typ** (Verkleidung + Stealth + Info-Gathering) in
kuratierten Räumen. Story wird durch die Quests erzählt — keine
Entscheidungen, alle Quests verfügbar (prerequisites nur als Erzähl-
Reihenfolge, exakt wie Akt 1 es bereits handhabt).

## Technical Context

**Sprache/Stack**: ES6+ JavaScript, Phaser 3, kein Build-Pipeline (Classic
`<script>`-Tags, globaler Scope).
**Storage**: localStorage-Save via `loadQuestSaveData` (questSystem) +
`storySystem` load/save. Additive Felder, keine Migration.
**Testing**: `node tools/runTests.js` (268 Tests). Neue Unit-Tests für
Espionage-Objective-Progress + Akt-2-Quest-Unlock-Kette.
**Target**: Browser (Desktop + Mobile). i18n DE/EN (Feature 041).
**Performance**: 60fps Desktop, Mobile-Procroom ≥45 (053 nicht regredieren);
Detection-Check leichtgewichtig (NFR-02).

### Phase-0-Research-Befunde (verifiziert am Code)

| Befund | Konsequenz |
|--------|------------|
| Quest-Schema: `{id,title,description,npcId,type,chain,objectives:[{type,target,current,required}],rewards:{xp,materials,druckblaetter,fragments,unlocks:[]},prerequisites:[id],requiredAct,dialogueOffer/Progress/Complete}` | Akt-2-Quests als gleiche Objekte in `questSystem.js` ergänzen. |
| Objective-Typen heute: `kill`, `fetch`, `explore`, `dialogue`, `wave` | Espionage braucht NEUE Typen: `observe`/`eavesdrop` (Info-Gathering), `infiltrate`/`reach` (Stealth-Ziel). |
| Akt-1-Q6 hat `unlocks: ['act2_open']`; Akt 1 nutzt `prerequisites` nur als Reihenfolge, „all in one playthrough, NOT a content-gate" | **Entry-Hook existiert.** Gleiches gating-freies Muster für Akt 2 — passt zur User-Vorgabe. |
| `requiredAct`-Feld + `unlocks`-Mechanik vorhanden | Akt-2-Quests `requiredAct: 2`; Quest-Abschluss treibt `storySystem.currentActIndex` (Milestone-Kopplung, FR-09). |
| Story-Milestones (`wahrheit`/`bruch`) + Texte + NPC-Dialoge existieren bereits | Akt 2 muss nur die Quests liefern, die diese Beats zünden — kein neues Narrativ-Runtime. |
| `elara_meeting`/`elara_ritual` (Akt 1) bauen `elara_trust` auf | Anker für Elara-Foreshadowing (FR-13). |
| **Offene Research für WP01**: Enemy-Aggro/Detection-Logik (Basis für Stealth), wie `currentActIndex` heute getriggert wird (Wave vs. Quest), Schema kuratierter roomTemplate-JSONs (Zonen-Metadaten). | In WP01 klären, bevor Espionage-Runtime gebaut wird. |

## Constitution Check

- ✅ Additiv, kein paralleles Runtime (C-01), keine neuen Deps (C-02).
- ✅ Story durch Quests, keine Entscheidungen/Gates (User-Vorgabe + Akt-1-Muster).
- ✅ i18n DE/EN, save-kompatibel, 60fps.
- ✅ `test-first` (Constitution `selected_directives: [TEST_FIRST]`): Unit-Tests
  für Objective-Progress + Unlock-Kette vor Implementierung.
- ⚠️ Stealth ist neue Mechanik → Komplexitäts-Risiko (R-01); via WP-Schnitt
  isoliert (Espionage als eigenes WP, notfalls auf 2 Showcase-Quests kürzbar).

## Akt-2-Quest-Entwurf (Kern — zur Abnahme)

**Entry**: `act2_open` (von Akt-1-Q6). **Thema**: Routine-Council-Aufträge
entlarven sich Schritt für Schritt. **Ende**: `wahrheit`→`bruch`-Beats.

| # | Quest (id) | NPC | Typ | Inhalt / Story-Funktion |
|---|-----------|-----|-----|------------------------|
| Q1 | `council_seizure` „Beschlagnahme" | aldric | fetch/kill | Council-Auftrag: „subversive Schriften" aus einem Versteck holen. **Crack #1**: die Schriften sind Zeugenaussagen/Bürgerbriefe, keine Propaganda. Öffnet die Chain. |
| Q2 | `branka_transcripts` „Verbotene Abschriften" | branka | fetch | Privat-Job: Dämonenverhör-Protokolle abschreiben (knüpft an Akt-1-Branka). Enthüllt: der Rat verhört Bürger. **Lore-Fragment** (FR-10). |
| Q3 | `espionage_convoy` „Der Konvoi" 🕵️ | mara/widerstand | **espionage** | **Showcase-Espionage #1**: als Council-Träger verkleidet (Identity) einen Konvoi in einem kuratierten Lagerraum beschatten; **Stealth** + **abhören** (observe), um die Fracht zu erfahren = Ritual-Komponenten. |
| Q4 | `espionage_archive` „Das versiegelte Archiv" 🕵️ | harren | **espionage** | **Showcase-Espionage #2**: verkleidet ins Council-Archiv infiltrieren; Schreiber abhören; versiegelten Akt bergen. **Elara-Foreshadow #1**: der Akt zu Elaras „Verschwinden" ist verdächtig sauber / widerspricht Harrens Version. |
| Q5 | `elara_trail` „Elaras Spur" | harren | fetch/dialogue | **Elara-Foreshadow #2**: Harren fleht, Elara zu finden; eine Tagebuchseite, deren Worte die Sprache des Rats spiegeln („du verstehst das nicht"). Baut das Vertrauen, das der spätere Verrat bricht. |
| Q6 | `ritual_chamber` „Die Ritualkammer" | aldric | kill/explore | Council-Auftrag „Reinigung" einer unteren Kammer — es IST die Beschwörungskammer. Triggert den **`wahrheit`-Milestone** (Text existiert). **Scripted Wendepunkt** (FR-08), keine Wahl. |
| Q7 | `bruch_confrontation` „Der Bruch" *(optional)* | aldric | dialogue | Aldric konfrontiert den Spieler (`bruch`-Text: „Du stellst zu viele Fragen"). Scripted Akt-2-Abschluss; setzt Akt-3-Hook. |

Reihenfolge via `prerequisites` (Q1 → Q2–Q5 verfügbar → Q6 nach Q3+Q4+Q5 →
Q7). **Alles in einem Playthrough spielbar, nichts hinter Entscheidungen.**

## Espionage-Mechanik (technischer Entwurf)

**Neues Modul** `js/espionageSystem.js` (leichtgewichtig, no-op außerhalb
Espionage-Missionen):
- **Disguise-State**: `window.espionage.disguised` (bool) + Visual-Swap des
  Player-Sprites; gesetzt bei Mission-Start, **fällt bei Angriff** (FR-04).
- **Detection**: Wachen in kuratierten Räumen haben eine Detection-Range;
  Check baut wo möglich auf bestehender Enemy-Aggro-Logik auf (WP01-Research).
  Spieler verkleidet + außerhalb Range = unentdeckt; Angriff/zu nah/zu lange
  in Sicht → Detection steigt → bei Schwelle „enttarnt" = Kampf (Konsequenz,
  **kein Insta-Fail**, C-04).
- **Info-Gathering-Zonen**: markierte Zonen am Ziel-NPC/Objekt; `observe`-
  Objective inkrementiert bei Aufenthalt X Sek unentdeckt.
- **Neue Objective-Typen** in questSystem-Progress: `observe`, `infiltrate`/
  `reach` — via bestehendem `updateQuestProgress(type, target)`-Pfad
  (Trigger-Audit C-05!).

**Kuratierte Stealth-Räume**: 2 neue roomTemplate-JSONs (`CouncilWarehouse`,
`SealedArchive`) mit Zonen-Metadaten (Wachen-Posten, Deckung, Observe-Zonen).
Verankert in kuratierten Fix-Räumen, NICHT Procrooms (Entscheidung).

## storySystem-Kopplung (FR-09)

Akt-2-Quest-Abschlüsse treiben `currentActIndex` zu `wahrheit`/`bruch` —
über die `unlocks`-Mechanik + einen Hook, der den Milestone bei
Quest-Abschluss feuert statt bei Wave-Count. WP01 klärt, wie der Index heute
getriggert wird, damit Quest-Trigger sauber danebenliegen (nicht ersetzen,
um Akt-1 + Wave-Pfad nicht zu brechen).

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `js/questSystem.js` | +6–7 Akt-2-Quest-Objekte; Progress-Handling für `observe`/`infiltrate`. |
| `js/storySystem.js` | Milestone-Trigger an Akt-2-Quest-Abschluss koppeln; +Lore-Fragmente. |
| `js/espionageSystem.js` *(neu)* | Disguise/Detection/Info-Gathering-Runtime. |
| `js/roomTemplates/CouncilWarehouse.json`, `SealedArchive.json` *(neu)* | Kuratierte Stealth-Räume. |
| `js/knowledgeTree.js` | Hook für Akt-2-Lore-Fragmente. |
| i18n-Register (storySystem/questSystem) | DE/EN für alle neuen Texte. |
| `index.html` | `<script>` für espionageSystem.js. |
| `tests/` | Unit-Tests: Objective-Progress, Unlock-Kette, Disguise-fällt-bei-Angriff. |

## WP-Schnitt (Vorschau — finalisiert in `tasks`)

- **WP01** — Research + Gerüst: Enemy-Detection-Analyse, Milestone-Trigger-
  Analyse, roomTemplate-Zonen-Schema; `espionageSystem.js`-Skelett + Tests-Setup.
- **WP02** — Akt-2-Story-Quests (Q1, Q2, Q5, Q6, Q7) ohne Espionage: voll
  spielbare Story-Chain bis `wahrheit`/`bruch`. **Allein shippbar** (R-01).
- **WP03** — Espionage-Mechanik: Disguise + Detection + Info-Gathering +
  kuratierte Räume + neue Objective-Typen.
- **WP04** — Espionage-Quests (Q3, Q4) auf WP03 aufgesetzt; Elara-Foreshadow.
- **WP05** — i18n-Vollständigkeit, Save-Kompat-Test (Alt-Save), Trigger-Audit
  (C-05), Playtest-Tuning Stealth (C-04), NFR-Mess-Check.

## Risiken (s. Spec §13)

R-01 Scope (WP-Schnitt erlaubt Story-zuerst-Ship) · R-02 Stealth-Fairness
(kein Insta-Fail, Tuning) · R-03 Quest-Trigger-Audit · R-04 Save-Migration ·
R-05 Mobile-Bedienbarkeit (Disguise-Toggle ins Mobile-Slot-Layout).

## Open Questions (für `tasks`/Implementierung)

- Genaue Detection-Schwellen + Sichtkegel vs. Radius (Playtest-getrieben).
- Disguise als Sprite-Swap vs. Tint — abhängig von verfügbaren Assets.
- Lore-Fragment-Texte (Akt-2-Inhalt) — final beim Quest-Schreiben.
