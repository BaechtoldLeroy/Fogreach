# Specification: Act 2 — Obedience vs. Memory (+ Espionage Mission-Type)

**Feature**: 055-act-2-obedience-espionage
**Created**: 2026-06-23
**Mission**: software-dev
**Tracker**: Acts 2–3 Story (Roadmap Phase 3, aus #31 abgespalten) + #30 Espionage Mission-Type
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Der Vertical Slice (Akt 1) ist komplett: Spieler durchläuft Game-Start →
Akt-1-Collusion-Reveal über ~6 authored Quests. Danach existiert das
**Story-Gerüst** (storySystem.js: Milestones `wahrheit → bruch → rebellion
→ offenbarung` mit fertigen Erzähltexten + NPC-Dialogen), aber **keine
authored Quest-Inhalte** — die späten Beats erreicht man aktuell nur durch
Wave-Grinding statt durch gespielte Missionen.

Dieses Feature füllt **Akt 2 — „Gehorsam vs. Erinnerung"** mit echtem
Content und führt den in der Constitution beschriebenen, bisher fehlenden
**Mission-Typ Spionage** (#30) als neue Gameplay-Mechanik ein. Ziel: mehr
**Story-Tiefe UND Spieldauer** (~+1–2 h), additiv auf bestehender
Infrastruktur (questSystem, storySystem, factionSystem, NPCs).

**Narrativer Bogen (Constitution Akt 2):** Council-Missions
(Dokumenten-Beschaffung, Überwachung, Spionage) kontrastieren mit privaten
Jobs und verbotenen Lore-Fragmenten. Erste Hinweise auf Chain-Council-
Rituale verdichten sich.

**Erzählprinzip (User-Vorgabe):** Die Story wird **durch die Quests selbst**
erzählt, **nicht durch Spieler-Entscheidungen**. Es gibt **keine
Verzweigungen und kein Gating** — **alle Akt-2-Quests stehen dem Spieler zur
Verfügung**. Das Thema „Gehorsam vs. Erinnerung" entsteht *im Erleben*: der
Spieler führt Council-Aufträge aus und entdeckt durch sie selbst, was wirklich
geschieht — der Zwiespalt wird gezeigt, nicht abgefragt.

## 2. Stakeholders & Actors

- **Spieler** — durchläuft Akt 2 nach dem Akt-1-Reveal; spielt alle
  verfügbaren Council-Aufträge, private Jobs und verdeckte Spionage-Missionen
  und erlebt die Story dabei linear-erzählend (keine Entscheidungen).
- **Quest-System** (`js/questSystem.js`) — in-code Quest-Objekte (id/title/
  npcId/objectives); wird um Akt-2-Quests + Espionage-Objective-Typen erweitert.
- **Story-System** (`js/storySystem.js`) — Milestone-Progression
  (`currentActIndex`, `wahrheit`/`bruch`); Akt-2-Quests hängen an diese Beats.
- **Faction-System** (`js/factionSystem.js`) — Standing kann sich durch
  Quest-Abschluss narrativ verschieben (Flavor), **gated aber KEINE Quests
  und keine Verkleidung** (User-Vorgabe: alles verfügbar).
- **NPCs** (aldric, harren, klerus_priester, stadtwache, widerstand, branka,
  mara, elara) — Quest-Geber & Spionage-Ziele; bestehende Dialog-Register
  pro Milestone werden genutzt/erweitert.

## 3. User Scenarios

### Primary A: Council-Mission (Gehorsam-Pfad)
1. Nach Akt-1-Reveal nimmt der Spieler bei Aldric einen Council-Auftrag an
   (z.B. „Beschlagnahme verbotener Schriften").
2. Dungeon-Run mit Quest-Objective; Rückkehr zum Hub, Abgabe.
3. Standing beim Kettenrat steigt; ein Lore-Fragment deutet an, was wirklich
   konfisziert wurde → wachsender moralischer Zwiespalt.

### Primary B: Espionage-Mission (verdeckt)
1. Der Widerstand (Branka/Mara) bittet den Spieler, einen Council-Konvoi zu
   beschatten.
2. Spieler nimmt für die Mission eine **Verkleidung** an (Identity-Switching
   als Mission-Mechanik — frei verfügbar, NICHT an Standing gebunden).
3. Im Zielgebiet gilt eine **Stealth-Komponente**: Wachen haben eine
   Detection-Range; der Spieler nutzt Deckung/Verstecke; Entdeckung →
   Mission erschwert (Kampf/Fehlschlag-Konsequenz, kein Hard-Game-Over).
4. **Information-Gathering**: bestimmte NPCs/Objekte beobachten/abhören
   (z.B. an einer Tür lauschen) erfüllt das Objective.
5. Abgabe enthüllt einen Akt-2-Story-Beat (Ritual-Hinweis).

### Primary C: Story-Enthüllung durch Quests (statt Entscheidung)
1. Der Spieler erlebt den Wendepunkt **durch das Spielen** der Quests: was als
   Routine-Council-Auftrag beginnt, entlarvt sich Schritt für Schritt
   (konfiszierte „Schriften" = Zeugenaussagen, „Eindringlinge" = Widerständige).
2. Ein Story-Beat (`wahrheit`) zeigt die Ritualkammer — der Bruch mit dem Rat
   geschieht **erzählerisch/scripted**, nicht als Spieler-Wahl. Faction-Standing
   kann sich dabei narrativ verschieben, ohne dass der Spieler abbiegen muss.

### Edge: Reihenfolge / Verfügbarkeit
- **Alle Akt-2-Quests sind verfügbar** (kein Gating). Eine lose erzählerische
  Reihenfolge ist erlaubt (Quest B referenziert A), aber nichts ist hinter
  Entscheidungen oder Standing gesperrt.
- Das **Story-Gating der Milestones** (`wahrheit`/`bruch`) wird an
  Akt-2-Quest-Abschluss gekoppelt statt an reines Wave-Grinding (FR-09).

## 4. Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | **Akt-2-Quest-Chain**: 5–7 neue authored Quests in `questSystem.js`, die vom Akt-1-Collusion-Reveal in die `wahrheit`/`bruch`-Beats führen (Mix aus Council-Missions + privaten Jobs). | Draft |
| FR-02 | **Council-Missions** (offiziell): Dokumenten-Beschaffung / Konfiszierung als Objective-Varianten der bestehenden Quest-Typen; erhöhen Council-Standing. | Draft |
| FR-03 | **Espionage-Mission-Typ** als distinkte Quest-Kategorie mit eigenem UI-Indicator (Hub-Quest-Log + Marker). | Draft |
| FR-04 | **Identity-Switching**: Verkleidung als Mission-Mechanik, **frei verfügbar** (NICHT standing-gated); Toggle/Annahme an Mission-Start. **Angreifen lässt die Verkleidung fallen** (Tarnung weg → Detection steigt). | Draft |
| FR-05 | **Stealth-Komponente** (in **kuratierten Fix-Räumen**, nicht Procrooms — kontrollierbares Stealth): Wachen mit Detection-Range; Spieler-Verstecken/Deckung; Entdeckung verschärft die Mission (Konsequenz statt Game-Over). | Draft |
| FR-06 | **Information-Gathering-Objective**: NPC/Objekt beobachten/abhören (Aufenthalt in Zone für X Sek, oder Interaktion) erfüllt Espionage-Ziele. | Draft |
| FR-07 | **2–3 Showcase-Espionage-Quests** als Initial-Content, eingebettet in die Akt-2-Chain. | Draft |
| FR-08 | **Scripted Wendepunkt** (statt Entscheidung): der Bruch mit dem Rat (`wahrheit`/`bruch`) wird erzählerisch durch Quest-Abschluss ausgelöst — **keine Spieler-Wahl, keine Verzweigung**. Faction-Standing darf sich narrativ mitbewegen. | Draft |
| FR-09 | **Keine Quest-Gates**: alle Akt-2-Quests sind verfügbar (lose erzählerische Reihenfolge erlaubt, aber nichts hinter Entscheidungen/Standing gesperrt). Milestones (`wahrheit`/`bruch`) an Quest-Abschluss koppeln statt an Wave-Grinding. | Draft |
| FR-10 | **Lore-Fragmente Akt 2**: 2–3 neue verbotene Lore-Fragmente, die Ritual-Hinweise streuen (Hook in Knowledge-Tree / storySystem). | Draft |
| FR-11 | **i18n**: alle neuen Texte über das bestehende DE/EN-i18n-Register (Feature 041), keine hartkodierten Strings. | Draft |
| FR-12 | **Persistenz**: Akt-2-Quest-Fortschritt + Verkleidungs-State im bestehenden Save (loadQuestSaveData / storySystem load) — kein Wipe bestehender Saves. | Draft |
| FR-13 | **Elara-Foreshadowing**: Akt 2 sät subtile Hinweise auf Elaras späteren Verrat (kanonisches Ende: sie steht neben dem Schattenrat), OHNE den Twist zu spoilern — z.B. widersprüchliche Spuren, ein zu glatt gelöster Hinweis, ein Lore-Fragment, das nicht zu ihrer Geschichte passt. Zahlt auf den bestehenden `offenbarung`-Payoff ein. | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-01 | Performance unverändert: 60fps Desktop, Mobile-Procroom ≥45 (053 nicht regredieren). | gemessen |
| NFR-02 | Stealth-Detection darf den Dungeon-Loop nicht ruckeln lassen (Detection-Check leichtgewichtig, kein per-Frame O(n²)). | 60fps |
| NFR-03 | Spieldauer-Zuwachs Akt 2: ~+1–2 h gegenüber heute (geschätzt, Playtest-validiert). | subjektiv |
| NFR-04 | Keine Regression in Akt 1 (bestehende Quests/Saves/Story-Beats unverändert). | Playtest |

## 6. Constraints

| ID | Constraint |
|----|------------|
| C-01 | Additiv auf bestehender Infrastruktur — questSystem/storySystem/factionSystem wiederverwenden, kein paralleles Quest-Runtime. |
| C-02 | Keine neuen Dependencies; Vanilla-JS + Phaser-built-ins. |
| C-03 | Bestehende Akt-1-Saves bleiben spielbar (additive Felder, defensive Loads). |
| C-04 | Stealth bleibt zugänglich/low-threshold (Donor-Demo-tauglich) — kein punitives Hardcore-Stealth; Entdeckung = Erschwernis, kein Insta-Fail. |
| C-05 | Quest-Trigger müssen vor Ship gegen `updateQuestProgress(type, target)` auditiert werden (sonst uncompletable). |

## 7. Success Criteria

| ID | Criterion |
|----|-----------|
| SC-01 | Spieler kann nach Akt-1-Reveal eine zusammenhängende Akt-2-Quest-Chain (5–7 Quests) end-to-end spielen. |
| SC-02 | Mindestens 2 Espionage-Missionen mit Verkleidung + Stealth + Info-Gathering sind abschließbar. |
| SC-03 | Der Akt-2-Wendepunkt (Ritualkammer/`wahrheit`) wird allein durch Quest-Abschluss erzählerisch ausgelöst — keine Entscheidung, keine gesperrten Quests. |
| SC-04 | Akt-2-Story-Beats (`wahrheit`/`bruch`) werden durch Quest-Abschluss erreicht, nicht nur durch Wave-Grinding. |
| SC-05 | DE/EN vollständig; keine hartkodierten Strings; alle Tests grün. |
| SC-06 | Bestehende Akt-1-Saves laden ohne Fehler; keine Akt-1-Regression. |
| SC-07 | 1 Playtester bestätigt: spürbar mehr Story + Spielzeit, Stealth fühlt sich fair an. |
| SC-08 | Akt 2 enthält ≥2 subtile Elara-Foreshadowing-Momente, die den späteren Verrat vorbereiten, ohne ihn zu spoilern. |

## 8. Edge Cases

- **Verkleidung + Kampf**: Was passiert, wenn der Spieler in Verkleidung
  angreift? (Verkleidung fällt / Detection steigt) — definieren in FR-04/05.
- **Save aus Akt 1 mitten in altem Wave-Gating**: defensive Migration, Akt-2-
  Quests werden nachträglich verfügbar.
- **Stealth-Räume kuratiert** (Entscheidung): Espionage-Missionen spielen in
  kuratierten Fix-Räumen mit definierten Stealth-Zonen/Deckung — nicht in
  prozeduralen Procrooms (kontrollierbares, faires Stealth).
- **Verkleidung + Angriff** (Entscheidung): Zuschlagen lässt die Tarnung
  fallen → Detection steigt; bewusster Trade-off Stealth vs. Kampf.
- **Mobile**: Verkleidungs-Toggle + Stealth müssen mit Touch-Controls bedienbar
  sein (Mobile-Slot-Layout wiederverwenden).

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| `js/questSystem.js` | Quest-Definitionen — Akt-2-Quests + Espionage-Objective-Typen. |
| `js/storySystem.js` | Milestone-Progression — Akt-2-Beats an Quests koppeln (FR-09). |
| `js/factionSystem.js` | Standing bewegt sich narrativ durch Quests (Flavor) — kein Gating, keine Weiche. |
| Espionage-Runtime (neu) | Detection-Range, Verstecken, Info-Gathering-Zonen — leichtgewichtiges Modul. |
| `js/knowledgeTree.js` | Hook für Akt-2-Lore-Fragmente. |
| i18n-Register (041) | DE/EN für alle neuen Texte. |

## 10. Assumptions

- Das bestehende Quest-Objective-Framework (kill/explore/talk) lässt sich um
  „beobachten/abhören/verstecken" erweitern, ohne Neubau. (In Research validieren.)
- Stealth kann auf vorhandener Enemy-/Detection-Logik aufbauen (Aggro-Range
  existiert bereits im Combat). (Validieren.)
- Verkleidung ist primär ein State-Flag + Visual-Swap, keine vollständige
  AI-Faction-Reaktions-Simulation.

## 11. Out of Scope

- **Akt 3–5** (eigene Folge-Features; dieses Feature endet am `bruch`-Beat).
  Hinweis: Das **kanonische Ende = Elara-Verrat** (offenbarung); Akt 2 baut
  nur Foreshadowing auf (FR-13), löst den Twist aber NICHT auf. Das
  widersprüchliche Alt-Ende wurde bereits angeglichen (Commit `7e2a1ec`).
- **Vollständiger Story-Split** mit divergenten Enden (das ist #28, Phase 4).
- **Neue Boss-Encounter** für Akt 2 (separat, falls nötig).
- **Voice/Audio** für Dialoge.

## 12. Dependencies

- Akt 1 (050) gemerged ✓ — liefert Collusion-Reveal als Einstieg.
- Faction-System (045) ✓ — für Identity/Standing.
- i18n (041) ✓ — für DE/EN.
- Knowledge-Tree (047) ✓ — für Lore-Fragment-Hook.

## 13. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | **Scope-Explosion** (voller Akt 2 + neue Mechanik). | WP-Schnitt erlaubt inkrementelles Shippen: Story-Quests zuerst, Espionage-Mechanik als eigenes WP, Integration zuletzt. Espionage notfalls auf 2 Showcase-Quests begrenzen. |
| R-02 | **Stealth fühlt sich unfair/frustrierend an** (Donor-Demo-Risiko, C-04). | Entdeckung = Erschwernis statt Insta-Fail; großzügige Detection-Range; Playtest-Tuning. |
| R-03 | **Quest-Trigger broken → uncompletable** (bekannte Falle). | C-05: `updateQuestProgress`-Audit vor Ship. |
| R-04 | **Save-Migration bricht Akt-1-Saves**. | Additive Felder, defensive Loads, Test mit Alt-Save. |
| R-05 | **Mobile-Bedienbarkeit** von Verkleidung/Stealth. | Früh auf Touch testen; Toggle in bestehendes Mobile-Slot-Layout. |

## 14. References

- `.kittify/constitution/constitution.md` §Storyline (Akt 2), §Quest Types (Espionage)
- Issue #30 — Espionage Mission-Type (Identity-Switching, Stealth, Info-Gathering)
- `js/questSystem.js` — Akt-1-Quest-Definitionen als Vorlage
- `js/storySystem.js` — Milestone-Register (`wahrheit`/`bruch`)
- Feature 050 (Akt-1-Quest-Chain), 045 (Faction), 041 (i18n), 047 (Knowledge-Tree)
