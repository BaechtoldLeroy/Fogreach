# Fogreach — Roadmap

Strategische Roadmap. Konkrete Items leben als [GitHub Issues](https://github.com/BaechtoldLeroy/Fogreach/issues).

## Status: Alpha (Jul 2026) — Vertical Slice ✅ + volle v4-Story ✅
- 40+ Features im Combat / Crafting / Dungeon / Itemization-Bereich
- **Phase 1 (Foundations) komplett** — alle 4 MVP-Systeme live
- **Phase 2 (Content + Polish) komplett** — Akt-1 Quest-Chain (050) + Tone-Polish (051) gemerged
- **Story v4 komplett (Jul 2026)** — 062 Quest-Rückgrat (34 Quests, 5 Akte, lückenlose Akt-Leiter) + 063 Inszenierung (verzweigtes Dialog-UI, Schlüsselszenen, Vier-Regler-Finale `the_reckoning`). Damit sind die alten Epics **#31 (Story Acts 2–5)** und **#28 (Multiple Endings)** abgelöst — v4 liefert bewusst **ein** Ende mit vier Reglern statt Faction-Standing-Endings.
- Zusätzlich shipped: Brunnen-Rework (#16, 048), More Room Layouts (#5, 049), Cave Generator (CA-Procgen), Save-Slots (#63), Dodge-Roll (054), Boss-Phasen/Signature-Moves (062-Balancing), Run-Summary Modal, diverse Polish + Bugfixes
- Public auf GitHub Pages: https://baechtoldleroy.github.io/Fogreach/
- **Aktueller Fokus:** Playtest der v4-Story + offene Inszenierungs-Stränge (Hub-Evolution #67, v4-Boss-Mechaniken)

---

## Strategie: Vertical Slice

Ein vollständiger, dichter Act 1 (~2–3h Spielzeit) statt 50% eines 30h-Spiels.

**Warum:**
- Donor-Strategie braucht ein konkretes Erlebnis, nicht eine Feature-Liste
- Solo-Dev: Validation > Vollständigkeit. Erst wenn Loop + Story + politische Message zusammen funktionieren, lohnt Scale-Up
- Foundational-Systeme (Faction, Knowledge-Tree, Printing-House) reichen als MVP für Act 1 — Ausbau erst wenn Loop validiert

---

## Phase 1 — Foundations ✅ **abgeschlossen (Mai 2026)**

Alle 4 MVP-Systeme live und im Spiel verwendet:

| Issue | Spec / Commit | Status |
|---|---|---|
| [#29 Tutorial / Mechanik-Intro](https://github.com/BaechtoldLeroy/Fogreach/issues/29) | 044-tutorial-onboarding-flow | ✅ |
| [#25 Faction-System MVP](https://github.com/BaechtoldLeroy/Fogreach/issues/25) | 045-faction-system-mvp | ✅ |
| [#26 Knowledge-Tree](https://github.com/BaechtoldLeroy/Fogreach/issues/26) | 047-knowledge-tree-mvp | ✅ |
| [#24 Printing House](https://github.com/BaechtoldLeroy/Fogreach/issues/24) | 046-printing-house-stub | ✅ |

## Phase 2 — Content + Polish ✅ **abgeschlossen (Mai 2026)**

Story-Inhalt + Donor-Demo-Build auf den Foundations aufbauen.

| Issue | Spec / Commit | Status |
|---|---|---|
| [#33 Act 1 Quest-Chain](https://github.com/BaechtoldLeroy/Fogreach/issues/33) | 050-act-1-quest-chain — 6 Quests, Faction-Decision, Q6 Collusion-Reveal, in-Keller Elara-Encounter | ✅ |
| [#34 Tone & Theme Pass](https://github.com/BaechtoldLeroy/Fogreach/issues/34) | 051-tone-and-theme-polish — Intro/Outro-Splash, Skip-Toggle, 3 Akt-1 Lore-Fragmente | ✅ |

**Deferred aus 051 (nicht blocker für Donor-Demo):** Word-level Tone-Refinement auf Q2-Q5 Dialogen (FR-07/FR-08). Hub-Visual + Audio-Atmosphäre (braucht neue Assets, separates Issue).

**Tracker:** [#32 Vertical Slice Epic](https://github.com/BaechtoldLeroy/Fogreach/issues/32)

**Definition of Done für Phase 1+2:**
- Spieler kann Game-Start → Act-1-Ende durchlaufen
- 4 MVP-Systeme im Einsatz und spürbar
- Politische Message kommt rüber (Donor-Demo-tauglich)
- Skip-Tutorial funktioniert
- 60fps, Scene-Transitions <1s, keine Console-Errors

---

## Phase 3 — Lateral Expansion (Monate 4–6)

Erst nach validierter Vertical Slice. Reihenfolge wird durch Learnings aus Phase 2 bestimmt.

- ~~[#11 Difficulty Scaling](https://github.com/BaechtoldLeroy/Fogreach/issues/11)~~ ✅ geschlossen (Jul 2026) — durch die Balancing-Pässe abgedeckt (#41 Frontier-Gate, Elite-Deckelung ~30%, XP-Kurve, Boss-Phasen). Bei neuem Pacing-Bedarf frisches, gezieltes Issue.
- [#6 Itemization Update](https://github.com/BaechtoldLeroy/Fogreach/issues/6) — Scope nach Playtest-Feedback
- [#27 Seasonal Mechanics](https://github.com/BaechtoldLeroy/Fogreach/issues/27) — Endless-Loop-Wiederspielbarkeit
- ~~[#1 Shift / Roll / Parry](https://github.com/BaechtoldLeroy/Fogreach/issues/1)~~ ✅ geschlossen (Jul 2026) — Dodge-Roll ist der Defensiv-Move (054). Ein separates Parry-Feature ggf. als neues Issue, wenn gewünscht.
- ~~[#5 Mehr Proc-Room Layouts](https://github.com/BaechtoldLeroy/Fogreach/issues/5)~~ ✅ (049 + Cave-Generator gemerged Mai 2026)
- [#12 Mehr Gegnertypen](https://github.com/BaechtoldLeroy/Fogreach/issues/12) — basierend auf enemy_ideas.md
- ~~Acts 2–3 Story~~ ✅ ausgeliefert als Story v4 (062 + 063)

## Phase 4+ — Long Tail

- ~~[#31 Story Acts 2–5](https://github.com/BaechtoldLeroy/Fogreach/issues/31) (Epic)~~ ✅ geschlossen (Jul 2026) — ausgeliefert als Story v4: 062 Quest-Rückgrat + 063 Inszenierung, Akte 0–4.
- ~~[#28 Multiple Endings](https://github.com/BaechtoldLeroy/Fogreach/issues/28)~~ ✅ geschlossen (Jul 2026) — abgelöst durch das v4-Design: **ein** Ende, vier Regler (`computeFinaleState`), statt Faction-Standing-Endings.
- **Offene v4-Inszenierungs-Stränge:** [#67 Hub-Evolution über die Akte](https://github.com/BaechtoldLeroy/Fogreach/issues/67); v4-Boss-Mechaniken (Kettenmeister-Fesselung, Zeremonienmeister-Auslöschung, Schattenrat-Quelle) — noch ohne Issue.
- [#30 Espionage Missions](https://github.com/BaechtoldLeroy/Fogreach/issues/30)
- [#2 Casino-Events](https://github.com/BaechtoldLeroy/Fogreach/issues/2)
- [#7 Player-Sprites via Fiverr](https://github.com/BaechtoldLeroy/Fogreach/issues/7)

---

## Workflow

1. **Idee** → Issue (Template `Feature Idea`), Labels `idea` + `area:*`
2. **Reift** → Kommentare, Verfeinerung, ggf. `p:next` Label
3. **Ready** → `spec-kitty specify <slug>` (für grössere Features) ODER direkt Branch + PR (kleine Fixes)
4. **Implementiert** → Label `s:ready-to-test`, manueller Playtest
5. **Verified** → Merge in main, Issue auto-close via Commit-Message (`Closes #N`)

## Langfristige Shape (12–24 Monate)

```
Monat 1–3:  Vertical Slice (Phase 1+2) → Act 1 polished + 4 MVP-Systeme
            ├── Phase 1 ✅ abgeschlossen (Mai 2026)
            └── Phase 2 ✅ abgeschlossen (Mai 2026) — #33 Quest-Chain + #34 Tone-Pass

Monat 4–6:  Donor-Demo + Community-Feedback + Polish-Pass
            ├── geshipped: 052 Render-Quality, 053 Mobile-Perf, 054 Dodge-Roll
            └── geshipped: Save-Slots (#63), Boss-Phasen/Signature-Moves
Monat 6–9:  Story v4 ✅ ausgeliefert — 062 Quest-Rückgrat (Akte 0–4, 34 Quests)
            + 063 Inszenierung (Dialog-UI, Schlüsselszenen, Vier-Regler-Finale)  ← AKTUELL
Monat 9–12: v4-Inszenierungs-Ausbau (Hub-Evolution #67, Boss-Mechaniken),
            Faction-Tiefe, Playtest-getriebenes Balancing
Monat 12+:  Endless-Loop-Polish, Seasonal-Cycles, Community-Content
```

Realistisch nur mit Scope-Disziplin — die Phase-2-Liste ist der Kompass, nicht die Phase-3+-Liste.
