# Fogreach — Roadmap

Strategische Roadmap. Konkrete Items leben als [GitHub Issues](https://github.com/BaechtoldLeroy/Fogreach/issues).

## Status: Alpha (Mai 2026) — Vertical Slice ✅
- 40+ Features im Combat / Crafting / Dungeon / Itemization-Bereich
- **Phase 1 (Foundations) komplett** — alle 4 MVP-Systeme live
- **Phase 2 (Content + Polish) komplett** — Akt-1 Quest-Chain (050) + Tone-Polish (051) gemerged
- Zusätzlich shipped: Brunnen-Rework (#16, 048), More Room Layouts (#5, 049), Cave Generator (CA-Procgen), Run-Summary Modal, diverse Polish + Bugfixes
- Public auf GitHub Pages: https://baechtoldleroy.github.io/Fogreach/
- **Aktueller Fokus:** Donor-Demo-Validation + Phase-3-Auswahl (siehe unten)

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

- [#11 Difficulty Scaling](https://github.com/BaechtoldLeroy/Fogreach/issues/11) — wenn Act-1-Pacing zu flach
- [#6 Itemization Update](https://github.com/BaechtoldLeroy/Fogreach/issues/6) — Scope nach Playtest-Feedback
- [#27 Seasonal Mechanics](https://github.com/BaechtoldLeroy/Fogreach/issues/27) — Endless-Loop-Wiederspielbarkeit
- [#1 Shift / Roll / Parry](https://github.com/BaechtoldLeroy/Fogreach/issues/1) — Combat-Tiefe
- ~~[#5 Mehr Proc-Room Layouts](https://github.com/BaechtoldLeroy/Fogreach/issues/5)~~ ✅ (049 + Cave-Generator gemerged Mai 2026)
- [#12 Mehr Gegnertypen](https://github.com/BaechtoldLeroy/Fogreach/issues/12) — basierend auf enemy_ideas.md
- Acts 2–3 Story (aus #31 abspalten)

## Phase 4+ — Long Tail

- [#31 Story Acts 2–5](https://github.com/BaechtoldLeroy/Fogreach/issues/31) (Epic)
- [#28 Multiple Endings](https://github.com/BaechtoldLeroy/Fogreach/issues/28)
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
            └── Phase 2 🟡 #33 Quest-Chain + #34 Tone-Pass

Monat 4–6:  Donor-Demo + Community-Feedback + Polish-Pass
Monat 6–9:  Acts 2–3 Story + Faction-Tiefe + Combat-Depth
Monat 9–12: Acts 4–5 + Multiple Endings + Knowledge-Tree-Tiefe
Monat 12+:  Endless-Loop-Polish, Seasonal-Cycles, Community-Content
```

Realistisch nur mit Scope-Disziplin — die Phase-2-Liste ist der Kompass, nicht die Phase-3+-Liste.
