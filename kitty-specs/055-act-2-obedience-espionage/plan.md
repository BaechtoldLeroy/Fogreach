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

**Bestand integrieren (nicht duplizieren):** `requiredAct: 2` hat heute schon
**3 dünne Quests** — `mara_contact` (Widerstand-Kontakt), `elara_meeting`
„Elaras Geheimnis" (fetch 2 Dokumente, `unlocks: ['elara_trust']`),
`branka_doubt` (kill 5 Elite). 055 **reichert diese an** und ergänzt neue
Quests drumherum — kein Parallel-Content. (Akte 3–5 haben analog dünne,
wave-/boss-gegatete Skelette — separat, hier out of scope.)

**Entry**: `act2_open` (von Akt-1-Q6) → `currentActIndex` auf Akt 2.
**Thema**: Routine-Council-Aufträge entlarven sich Schritt für Schritt.
**Ende**: `wahrheit`→`bruch`-Beats. **Umfang (User-Wunsch: größer)**: ~11
authored Quests, **3 Espionage-Missionen**, + Surveillance-Typ.

| # | Quest (id) | NPC | Typ | Inhalt / Story-Funktion |
|---|-----------|-----|-----|------------------------|
| Q1 | `council_seizure` „Beschlagnahme" | aldric | fetch/kill | Council-Auftrag: „subversive Schriften" holen. **Crack #1**: es sind Zeugenaussagen/Bürgerbriefe. Öffnet die Chain. |
| Q2 | `council_surveillance` „Überwachung" | aldric | observe (lite) | **Surveillance-Typ**: einen „verdächtigen" Bezirk überwachen → der Spieler sieht, dass die Überwachten harmlose Bürger sind. **Crack #2**. |
| Q3 | `mara_contact` „Maras Kontakt" *(Bestand, anreichern)* | mara | dialogue | Widerstand nimmt Kontakt auf; bietet die privaten Jobs an. |
| Q4 | `branka_transcripts` „Verbotene Abschriften" | branka | fetch | Privat-Job: Dämonenverhör-Protokolle abschreiben → Rat verhört Bürger. **Lore-Fragment** (FR-10). |
| Q5 | `branka_doubt` „Brankas Zweifel" *(Bestand, anreichern)* | branka | kill (elite) | Brankas Zweifel vertieft sich an dem, was der Spieler ihr bringt. |
| Q6 | `espionage_convoy` „Der Konvoi" 🕵️ | mara | **espionage** | **Espionage #1**: verkleidet einen Konvoi im kuratierten Lager beschatten; Stealth + abhören → Fracht = Ritual-Komponenten. |
| Q7 | `espionage_archive` „Das versiegelte Archiv" 🕵️ | harren | **espionage** | **Espionage #2** + **Elara-Foreshadow #1**: ins Council-Archiv infiltrieren, Schreiber abhören, versiegelten Akt bergen — Elaras „Verschwinden" verdächtig sauber dokumentiert. |
| Q8 | `elara_meeting` „Elaras Geheimnis" *(Bestand, anreichern)* | elara | fetch | Elara teilt „geheime" Dokumente (`elara_trust`). **Elara-Foreshadow #2**: ihre Belege passen zu glatt zur Rats-Deutung. |
| Q9 | `espionage_informant` „Der Maulwurf" 🕵️ | widerstand | **espionage** | **Espionage #3**: einen Council-Maulwurf im Widerstand enttarnen (Paranoia-Saat; deutet subtil Richtung Elara, ohne sie zu bestätigen). |
| Q10 | `ritual_chamber` „Die Ritualkammer" | aldric | kill/explore | Council-„Reinigung" = Beschwörungskammer → triggert **`wahrheit`-Milestone** (Text existiert). **Scripted Wendepunkt** (FR-08). |
| Q11 | `bruch_confrontation` „Der Bruch" | aldric | dialogue | Aldric konfrontiert den Spieler (`bruch`-Text). Scripted Akt-2-Abschluss + Akt-3-Hook. |

Reihenfolge via `prerequisites` (Council-Strang Q1→Q2→…; Privat-Strang
parallel offen; Espionage nach Mara-Kontakt; Q10 nach den drei Espionage +
Privat-Jobs; Q11 zuletzt). **Alles in einem Playthrough spielbar, nichts
hinter Entscheidungen.**

**Playtime-Schätzung**: ~11 Quests à 15–25 min + 3 Espionage à 20–30 min ≈
**~3–4 h authored Akt-2-Content**. Mit Akt 1 (~2 h) → Akt 1+2 ≈ **~5–6 h
authored** + Loop = **komfortabel über dem 6-h-Constitution-Ziel**.

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
  Analyse, roomTemplate-Zonen-Schema; `espionageSystem.js`-Skelett + Tests-Setup;
  Surveillance-`observe`-lite + Bestands-Quest-Integration (`mara_contact`,
  `branka_doubt`, `elara_meeting` anreichern statt duplizieren).
- **WP02** — Akt-2-Story-Quests **ohne** Espionage (Q1 council_seizure,
  Q2 council_surveillance, Q3 mara_contact, Q4 branka_transcripts,
  Q5 branka_doubt, Q8 elara_meeting, Q10 ritual_chamber, Q11 bruch): voll
  spielbare Story-Chain bis `wahrheit`/`bruch`. **Allein shippbar** (R-01).
- **WP03** — Espionage-Mechanik: Disguise + Detection + Info-Gathering +
  kuratierte Räume + neue Objective-Typen (`observe`/`infiltrate`).
- **WP04** — Espionage-Quests (Q6 convoy, Q7 archive, Q9 informant) auf WP03;
  Elara-Foreshadow #1 + Paranoia-Saat.
- **WP05** — i18n-Vollständigkeit, Save-Kompat-Test (Alt-Save), Trigger-Audit
  (C-05), Playtest-Tuning Stealth (C-04), NFR-Mess-Check, Playtime-Verifikation
  (~3–4 h Akt 2).

## Risiken (s. Spec §13)

R-01 Scope (WP-Schnitt erlaubt Story-zuerst-Ship) · R-02 Stealth-Fairness
(kein Insta-Fail, Tuning) · R-03 Quest-Trigger-Audit · R-04 Save-Migration ·
R-05 Mobile-Bedienbarkeit (Disguise-Toggle ins Mobile-Slot-Layout).

## Open Questions (für `tasks`/Implementierung)

- Genaue Detection-Schwellen + Sichtkegel vs. Radius (Playtest-getrieben).
- Disguise als Sprite-Swap vs. Tint — abhängig von verfügbaren Assets.
- Lore-Fragment-Texte (Akt-2-Inhalt) — final beim Quest-Schreiben.
