# Fogreach — Roadmap

Strategische Roadmap. Konkrete Items leben als [GitHub Issues](https://github.com/BaechtoldLeroy/Fogreach/issues).

## Status: Alpha (Mai 2026)
- 40+ Features im Combat / Crafting / Dungeon / Itemization-Bereich (Mission 001–042)
- 042 ARPG Control Scheme ✅ · 041 i18n DE/EN ✅ · 043 LP-Affix-Fix ✅
- Public auf GitHub Pages: https://baechtoldleroy.github.io/Fogreach/
- **Strategie:** Vertical Slice — polierter Act 1 statt breit gestreutem Content

---

## Strategie: Vertical Slice

Ein vollständiger, dichter Act 1 (~2–3h Spielzeit) statt 50% eines 30h-Spiels.

**Warum:**
- Donor-Strategie braucht ein konkretes Erlebnis, nicht eine Feature-Liste
- Solo-Dev: Validation > Vollständigkeit. Erst wenn Loop + Story + politische Message zusammen funktionieren, lohnt Scale-Up
- Foundational-Systeme (Faction, Knowledge-Tree, Printing-House) reichen als MVP für Act 1 — Ausbau erst wenn Loop validiert

---

## Phase 1 — Foundations (~6–8 Wochen)

System-MVPs damit Act 1 funktional läuft.

| Issue | Scope |
|---|---|
| [#29 Tutorial / Mechanik-Intro](https://github.com/BaechtoldLeroy/Fogreach/issues/29) `p:now` | Hub-Tour, Combat-Intro, Inventar, NPC-Dialog. ~10–15 min |
| [#25 Faction-System](https://github.com/BaechtoldLeroy/Fogreach/issues/25) `p:next` | 3 Fraktionen, Standing-API, 1–2 gateable NPCs |
| [#26 Knowledge-Tree](https://github.com/BaechtoldLeroy/Fogreach/issues/26) `p:next` | 8–10 passive Nodes, Lore-Fragment-Currency, persistiert |
| [#24 Printing House](https://github.com/BaechtoldLeroy/Fogreach/issues/24) `p:next` | Hub-Location-Stub + 2 Proof-Edicts, faction-gated |

## Phase 2 — Content + Polish (~4–6 Wochen)

Story-Inhalt + Donor-Demo-Build auf den Foundations aufbauen.

| Issue | Scope |
|---|---|
| [#33 Act 1 Quest-Chain](https://github.com/BaechtoldLeroy/Fogreach/issues/33) `p:next` | 5–7 Quests, Bürgermeisters-Tochter, Faction-Decision-Point, Initial-NPCs |
| [#34 Tone & Theme Pass](https://github.com/BaechtoldLeroy/Fogreach/issues/34) `p:next` | Politische Message spürbar, Demo-Intro/Outro, Skip-Toggle |

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
- [#5 Mehr Proc-Room Layouts](https://github.com/BaechtoldLeroy/Fogreach/issues/5) — Dungeon-Variation
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
Monat 4–6:  Donor-Demo + Community-Feedback + Polish-Pass
Monat 6–9:  Acts 2–3 Story + Faction-Tiefe + Combat-Depth
Monat 9–12: Acts 4–5 + Multiple Endings + Knowledge-Tree-Tiefe
Monat 12+:  Endless-Loop-Polish, Seasonal-Cycles, Community-Content
```

Realistisch nur mit Scope-Disziplin — die Phase-1-Liste ist der Kompass, nicht die Phase-3+-Liste.
