# Fogreach — Roadmap

High-level Phasen und Themen. Konkrete Items leben als [GitHub Issues](https://github.com/BaechtoldLeroy/Fogreach/issues), spec-kitty Missions führen sie aus.

## Status: Alpha (April 2026)
- 40+ Features implementiert (Combat, Dungeons, Crafting, Narrative-Basis, UI)
- 041 i18n DE/EN ✅
- 042 ARPG Control Scheme ✅
- Public auf GitHub Pages: https://baechtoldleroy.github.io/Fogreach/

---

## 🎯 Now
*Aktuell in Arbeit oder direkt nächstes Thema.*

- _(noch leer — als Issue mit `p:now` markieren)_

## 📅 Next
*Reife Ideen, klar genug zum Bauen, kommen als nächste Missionen.*

- _(als Issue mit `p:next` markieren)_

## 💡 Someday / Maybe
*Themen die spannend wären, aber noch nicht ausgereift.*

- _(als Issue mit `p:someday` und `idea` markieren)_

---

## Mögliche zukünftige Phasen

Lose Themengruppen — keine Festlegung.

### Narrative Expansion
Acts 4–5 der fünfaktigen Story, mehr Quest-Inhalt, Lore-Tiefe um Kettenrat & Archivsmiths.

### Fraktions-Mechanik
Spielbare Reputation/Einfluss-Systeme zwischen den Fraktionen, Auswirkungen auf Dungeons & NPCs.

### Combat-Tiefe
Weitere Gegner-Archetypen, Boss-Varianz, Status-Effekt-Kombos, optionale Klassen/Builds.

### Endgame
Endless-Mode-Polish, Leaderboard-Features, New-Game+, Daily-Runs.

### Tech & Polish
Build-Pipeline (Bundling), formale Test-Suite, Performance auf schwachen Geräten.

---

## Workflow
1. **Idee** → Issue (Template `Feature Idea`), Labels `idea` + `area:*`
2. **Reift** → Kommentare, Verfeinerung, ggf. `p:next` Label
3. **Ready** → `spec-kitty specify <slug>`, Issue im `spec.md` verlinken, Label `p:now`
4. **Done** → Mission gemerged, Issue auto-closed via Commit (`Closes #N`)
