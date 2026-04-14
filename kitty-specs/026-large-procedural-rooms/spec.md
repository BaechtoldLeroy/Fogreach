# Feature: Large Procedural Rooms

## Problem
Current rooms are small (640x512px to 1280x1088px), ~1-2 camera viewports in size. They feel more like arenas than explorable dungeon areas. D2-style pacing requires larger, more open rooms where players discover scattered enemy groups as they traverse.

## Goal
Introduce larger rooms (2500-5000px) with procedural generation so every run feels different. Rooms should have natural-looking corridors, chambers, and open areas — not just bigger versions of current templates.

## Technical Context
- Engine: Phaser 3
- Current templates: hand-authored JSON ASCII-art in `js/roomTemplates/`
- Room sizes: 20x16 to 40x24 tiles
- Procedural generation would produce wall layouts at runtime instead of loading fixed templates

## Functional Requirements
- **FR-001**: Procedural room generator that produces 80x80 to 150x150 tile rooms (2560x2560 to 4800x4800px)
- **FR-002**: Generator uses a recognizable algorithm (cellular automata, BSP, or drunkard's walk) with connected accessible area guaranteed
- **FR-003**: Generated rooms have entrances/exits on multiple sides (not just N/S)
- **FR-004**: Scatter enemy spawn points throughout accessible area (no single-wave arena feel)
- **FR-005**: Place objects (chests, barrels, crates, braziers) procedurally in reasonable positions
- **FR-006**: Integrate with existing dungeon run — procedural rooms mix with hand-authored templates
- **FR-007**: Generated rooms have tags (theme, difficulty) for run-level composition
- **FR-008**: Seed-based so the same seed produces the same room (debuggable)

## Procedural Approaches to Consider
- **Cellular Automata**: good for cave-like organic rooms
- **BSP**: good for structured rectangular chambers with corridors
- **Drunkard's Walk**: good for twisty corridor mazes
- **Hybrid**: BSP for structure + cellular smoothing for organic feel

## Related
- Pairs well with removing the wave-spawn system (enemies scattered at template-defined positions)
