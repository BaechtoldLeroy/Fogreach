# User Project Profile

- Mission: `software-dev`
- Interview profile: `minimal`

## Interview Answers

- **Project Intent**: Deliver a combat-driven, lore-rich action RPG (Fogreach) where the player uncovers an occult conspiracy through dungeon exploration, crafting, and faction decisions - built with Phaser, tilemap levels, and clean modular JavaScript.
- **Languages Frameworks**: JavaScript (ES6+), Phaser 3, Tiled tilemaps, HTML5 Canvas. No build framework - keep tooling minimal and repo-local.
- **Testing Requirements**: No formal test suite. Manual playtesting is primary. For risky logic changes (combat, AI state machines, collision), verify nothing, we're in proof of concept mode and there are backups
- **Quality Gates**: Manual playtest passes, no console errors, combat and enemy AI behave correctly, no regressions in existing scenes.
- **Review Policy**: No review required. Merge when playtest passes and no console errors.
- **Performance Targets**: 60fps on desktop browsers. Scene transitions under 1 second. No memory leaks in long play sessions.
- **Deployment Constraints**: Browser-based. Must run on Edge desktop. No server required - static file deployment

## Selected Doctrine

- Paradigms: clean-code, minimal-tooling, modular-scenes
- Directives: CLEAN_CODE, MINIMAL_TOOLING, MODULAR_SCENES
- Tools: git, spec-kitty, node, npm, phaser

