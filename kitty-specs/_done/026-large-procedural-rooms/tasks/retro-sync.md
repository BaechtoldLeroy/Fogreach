# Retro-sync — 026 large-procedural-rooms

Work was committed directly to `main` without spec-kitty WP tracking.
This file records the commits that implemented the spec, for audit purposes.

## Implementing commits (chronological)

- `7a0a2dc` spec(026): large procedural rooms — 2500-5000px with generated layouts
- `5f2a783` feat(026): procedural room generator using BSP + corridors
- `09b4e5a` feat(026): D2-style room generator — adjacent chambers with doorways
- `00b9521` feat(026): scale procedural enemy count with chamber area
- `2baee0f` fix(026): doorways 3-4 tiles wide + no objects blocking passages
- `0196ce2` tune(026): wider doorways (4-5 tiles) + higher merge-wall chance

Related polish (no feature prefix but part of the same work):
- `f6526f0` feat: some BSP leaves stay sealed (inaccessible wall blocks)
- `fdfdfc5` feat: proc rooms — open halls + better reward chest tier
- `5c3aebf` feat: room navigation improvements + proc room tuning
- `66a17bc` perf: proc room optimization
- `dc699b8` fix: stair push-away from player clamps to room bounds
- `e46999c` fix: elite aura/name tag mask + proc doorways blocked by removeChamber

Status: shipped on `main`. Feature moved to `kitty-specs/_done/`.
