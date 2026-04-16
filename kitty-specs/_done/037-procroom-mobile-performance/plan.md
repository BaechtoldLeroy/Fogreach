# Implementation Plan: Procroom Mobile Performance

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/037-procroom-mobile-performance/spec.md`

## Summary

Optimize procedural rooms for mobile. Currently unplayable frame rates on mobile devices. Phaser config: 960x480, arcade physics, procedural textures via Canvas 2D, fog of war with RenderTextures.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0 (WebGL, Canvas fallback)
**Testing**: Mobile device testing, `js/performanceMonitor.js` (P key)
**Target Platform**: Mid-range mobile browsers
**Performance Goals**: Stable 30fps+ on mobile

## Approach

1. **Profile** — Use `js/performanceMonitor.js` on mobile to identify bottlenecks. Likely suspects:
   - Fog of war RenderTextures (`roomManager.js`: exploredRT, spotlightRT) — expensive on mobile GPU
   - Vision polygon computation (`computeVisionPolygon`) — per-frame raycasting
   - Procedural texture generation (`graphics.js`) — large Canvas 2D operations
   - Many physics bodies (enemies, obstacles, walls)

2. **Fog of war optimization** — Reduce fog update frequency on mobile (every 2-3 frames). Simplify vision polygon (fewer rays). Smaller RT resolution on mobile.

3. **Object culling** — Only update/render objects within camera viewport + margin. Disable physics for off-screen enemies.

4. **Texture optimization** — Pre-render procedural textures at room load time instead of per-frame. Cache aggressively.

5. **Mobile quality toggle** — Add "reduced effects" setting in `SettingsScene.js` for mobile (simpler particles, fewer decorations, simplified fog).

## Key Files

- `js/roomManager.js` — Fog of war (main bottleneck candidate)
- `js/proceduralRooms.js` — Room generation timing
- `js/graphics.js` — Texture generation
- `js/enemy.js` — Enemy update loops
- `js/performanceMonitor.js` — Profiling tool
- `js/scenes/SettingsScene.js` — Quality settings

## Dependencies

- Should be done after 030 (large room variety) and 036 (stairs) to optimize the final room content
