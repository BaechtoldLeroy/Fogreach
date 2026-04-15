# Retro-sync — 029 fog-of-war-fix

Work was committed directly to `main` without spec-kitty WP tracking.
This file records the commits that implemented the spec, for audit purposes.

## Implementing commits (chronological)

- `30e74da` spec: 027 doors, 028 proc room themes, 029 fog of war fix
- `4a24289` fix: oversize fog RT centered on viewport to cover zoom gaps
- `f7d60d1` fix(029): fog of war black bars at camera zoom 0.89
- `7ad6650` fix(029): revert to simple fogUnseen oversize — remove broken setScale approach
- `1f759a1` fix(029): oversize all fog RTs (not just fogUnseen) to cover zoom gap
- `0ff893b` fix: remove camera zoom to restore fog of war
- `6b6d50a` docs(029): document failed attempts + revised scope (zoom+fog incompatible)
- `568a20a` fix: fog of war exploredRT in world space — persist explored areas
- `3b86cdb` fix: fog of war — fogUnseen world-sized to align with exploredRT mask
- `a708758` fix: reset fog of war on room change — rebuild RTs to new world bounds
- `c5c47d3` fix: miniboss health bar respects fog of war vision mask

Status: shipped on `main` (with documented scope revision — zoom+fog incompatible). Feature moved to `kitty-specs/_done/`.
