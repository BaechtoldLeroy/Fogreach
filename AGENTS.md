# SPEC.md — Fogreach (Codename: Demonfall)

## Tech Stack
- **Engine**: Phaser (JavaScript)
- **Levels**: Tilemap-based
- **Combat**: Custom enemy AI and combat logic
- **Style**: Clean, minimal code — no overengineering

---

## Setting

Fogreach is a dark medieval city shrouded in permanent mist. Life appears orderly,
but every rule, trade, and prayer is dictated by the **Chain Council (Kettenrat)**:
officially democratic, secretly unified behind an occult agenda.

The fog = collective amnesia and manipulation. Light, writing, and knowledge pierce it.

---

## Player Role

The protagonist is a former **Archivsmith** — a craftsman-scholar who maintained
the mechanical archive beneath the city. After losing parts of his memory in an
accident at the Archive Forge, he notices inconsistencies in official history and
begins uncovering the council's deception.

**Goal**: Decentralize knowledge and restore collective memory before the city is
consumed by darkness.

---

## Hub World — Main Locations

| Location | Function | Gameplay |
|---|---|---|
| **Archive Forge** | Memory preservation workshop, partly corrupted | Crafting, upgrading, decoding |
| **Town Hall & Catacombs (Rathauskeller)** | Council HQ above; forbidden rituals below | Dungeon runs, combat, lore fragments |
| **Printing House** | Propaganda center of the city | Story progression, faction influence |

---

## Narrative Arc

1. **Awakening** — Basic mechanics; player notices the unnatural fog
2. **Obedience vs. Memory** — Council missions contrast with glimpses of forbidden truth
3. **Descent** — Catacombs reveal demonic pacts behind the council's authority
4. **Rebellion** — Archive Forge and Printing House reclaimed as resistance tools
5. **Revelation** — The council's final illusion collapses; light confronts the fog

---

## Core Conflict

The Chain Council maintains "peace through order" — but every citizen is registered,
every act recorded, every deviation punished. The deeper the player goes, the more
they discover the chains are both political and literal: demonic contracts power
the council's authority.

---

## Missions (examples)

- **Official missions**: Retrieve/deliver documents for the council
- **Private missions**: Covert jobs from citizens, not council-sanctioned
- **Espionage**: Infiltrate organizations, work undercover

---

## Early Story Hook

The mayor's daughter has disappeared. This pre-occult conflict introduces factions,
underground locations, and council complicity — before the demonic layer is revealed.

---

## Tone & Visuals

- Philosophical but accessible; combat-driven but lore-rich
- Gothic, foggy, oppressive — with sparks of rebellion
- Medieval pixel art: dim warm lanterns, handwritten posters, brass and parchment textures

---

## Factions

Multiple factions each with distinct agendas. Player can align, play them off each other,
or go independent. Secret organizations may support or obstruct. Political intrigue is layered.

---

## Coding Guidelines

- Phaser best practices; keep scenes modular
- Tilemap levels: keep map data separate from game logic
- Enemy AI: state-machine pattern preferred
- No premature abstraction — solve the immediate problem cleanly
- Comment intent, not mechanics
