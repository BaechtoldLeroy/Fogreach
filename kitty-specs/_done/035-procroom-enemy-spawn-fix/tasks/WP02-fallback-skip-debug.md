---
work_package_id: WP02
title: Fallback Skip Logic and Debug Overlay
dependencies: [WP01]
requirement_refs:
- FR-004
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-16T09:15:00Z'
subtasks: [T004, T005, T006]
history:
- timestamp: '2026-04-16T09:15:00Z'
  action: created
  by: spec-kitty.tasks
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/enemy.js
---

# WP02: Fallback Skip Logic and Debug Overlay

## Branch Strategy

- **Planning base branch**: `main`
- **Merge target branch**: `main`
- **Implementation command**: `spec-kitty implement WP02 --base WP01`
- Note: This WP depends on WP01 (spawn validation hardening must be in place first)

## Objective

Ensure that when no valid spawn position can be found after exhausting all attempts, the enemy spawn is cleanly skipped rather than placing the enemy at an invalid or fallback position. Also add an optional debug overlay for visualizing the accessible-area grid, making future spawn issues easy to diagnose.

## Context

The spawn pipeline flows: `enemy.js` calls `pickAccessibleSpawnPosition()` -> which calls `scene.pickAccessibleSpawnPoint()` (defined by `recomputeAccessibleArea` in `roomManager.js`). After WP01, the validation is tighter, so `null` returns are more likely in edge cases. Every caller must handle `null` gracefully.

**Key files**:
- `js/enemy.js` -- `pickAccessibleSpawnPosition()` (line 52), `spawnEnemy()` / enemy placement logic
- `js/roomManager.js` -- `pickAccessibleSpawnPoint` (line 1238), debug overlay target

**Current behavior**:
- `pickAccessibleSpawnPosition` (enemy.js line 52) already returns `null` if all attempts fail
- BUT callers may still place enemies at a default or zero position when they receive `null`
- `spawnEnemy`-family functions in enemy.js handle the spawn coordinate -- audit all paths

---

## Subtask T004: Add Graceful Skip When No Valid Spawn Found

**Purpose**: Verify that `pickAccessibleSpawnPosition` returns `null` cleanly when all attempts are exhausted, and that no fallback code places the enemy at an arbitrary position (like 0,0 or the room center).

**Steps**:

1. **Audit `pickAccessibleSpawnPosition` return paths** (enemy.js, starting line 52):
   - The function has multiple exit paths:
     - Line 89-92: Main loop -- calls `scene.pickAccessibleSpawnPoint()`, breaks if null
     - Line 108-123: Distance-from-player loop with `bestCandidate`
     - Line 126-131: Final fallback using `scene.pickAccessibleSpawnPoint({ maxAttempts: 1 })`
     - End of function: implicit `undefined` return
   - Verify that ALL exit paths return either a valid `{x, y}` or explicitly `null`
   - The final fallback (line 126-131) calls `pickAccessibleSpawnPoint` one more time -- this is OK but ensure it returns `null` (not a random position) when the pool is empty

2. **Check the `clampCandidate` helper** used inside `pickAccessibleSpawnPosition`:
   - It clamps coordinates to the room bounds and applies jitter
   - Verify it returns `null` for out-of-bounds candidates, not a clamped-to-edge position that might be on a wall

3. **Add a console.warn when spawn is skipped**:
   - At the end of `pickAccessibleSpawnPosition`, before returning `null`:
     ```javascript
     console.warn('[spawn] No valid spawn position found after', attempts, 'attempts -- skipping enemy');
     ```
   - This helps designers detect rooms where spawns are being skipped excessively

4. **Ensure the function contract is clear**:
   - Return type: `{x: number, y: number} | null`
   - `null` means "skip this enemy, do not place it"

**Files**: `js/enemy.js`

**Validation**:
- [ ] `pickAccessibleSpawnPosition` returns `null` (not undefined, not {x:0,y:0}) when no valid position exists
- [ ] Console warning logged when spawn is skipped
- [ ] `clampCandidate` does not silently return edge positions on walls

---

## Subtask T005: Wire Skip Logic into All Callers in `enemy.js`

**Purpose**: Every function in `enemy.js` that calls `pickAccessibleSpawnPosition` (or directly calls `scene.pickAccessibleSpawnPoint`) must handle a `null` result by skipping the spawn entirely -- not placing the enemy, and adjusting any enemy count tracking.

**Steps**:

1. **Find all call sites** of `pickAccessibleSpawnPosition` in `enemy.js`:
   - Search for `pickAccessibleSpawnPosition(` and `pickAccessibleSpawnPoint(` throughout the file
   - Known locations from the codebase grep:
     - Line 89: inside `pickAccessibleSpawnPosition` itself (internal)
     - Line 111: distance loop inside `pickAccessibleSpawnPosition` (internal)
     - Line 127: final fallback inside `pickAccessibleSpawnPosition` (internal)
   - Also search for callers OF `pickAccessibleSpawnPosition` -- these are the external call sites that need null-handling

2. **For each external caller, add null guard**:
   ```javascript
   const spawnPos = pickAccessibleSpawnPosition(scene, bounds, margin, maxAttempts, minDist);
   if (!spawnPos) {
     // Skip this enemy -- no valid position available
     console.warn('[spawn] Skipping enemy spawn: no valid position in room');
     continue; // or return, depending on loop structure
   }
   const { x, y } = spawnPos;
   ```

3. **Check spawn-counting logic**:
   - If the caller tracks enemy count (e.g., `enemiesRemaining`, `waveEnemyCount`), ensure the count is NOT incremented for skipped spawns
   - If enemies are added to a group, ensure no phantom entries exist
   - Look in `js/wave.js` and `js/roomManager.js` for callers too -- they may call enemy spawn functions

4. **Check the `isSpawnPositionBlocked` direct callers** in enemy.js:
   - Line 297-299: A fallback that calls `scene.pickAccessibleSpawnPoint` directly
   - Ensure this path also handles `null` (the `if (pick)` guard on line 299 already does, but verify the surrounding logic doesn't place the enemy at the original bad position)

5. **Audit the broader spawn flow in enemy.js**:
   - Look at functions like `spawnEnemy`, `spawnEnemyWave`, `spawnEliteEnemy` etc.
   - Each should have early-return or continue logic when position is null
   - Verify no enemy sprite is created before position validation

**Files**: `js/enemy.js`

**Validation**:
- [ ] Every external caller of `pickAccessibleSpawnPosition` handles `null` by skipping the spawn
- [ ] Enemy count is not incremented for skipped spawns
- [ ] No enemy sprite is created at position (0,0) or (NaN, NaN)
- [ ] Rooms still function correctly when one or more spawns are skipped
- [ ] Room clear condition still triggers even with fewer enemies than intended

---

## Subtask T006: Add Optional Debug Overlay for Accessible-Area Grid

**Purpose**: Add a visual debug overlay that renders the accessible-area grid cells color-coded by type (spawn candidate = green, fallback = yellow, blocked = red). This makes future spawn issues trivially diagnosable without reading code.

**Steps**:

1. **Add a debug rendering function in `roomManager.js`**:
   ```javascript
   function debugRenderAccessibleArea(scene) {
     if (!scene._accessibleArea) return;
     const grid = scene._accessibleArea;
     const { bounds, cellSize, visited, spawnCandidates, fallbackCandidates } = grid;

     // Create a graphics object for debug rendering
     if (scene._debugSpawnOverlay) scene._debugSpawnOverlay.destroy();
     const gfx = scene.add.graphics();
     scene._debugSpawnOverlay = gfx;
     gfx.setDepth(9999);

     // Draw spawn candidates in green
     const spawnSet = new Set(spawnCandidates.map(c => `${Math.floor((c.x - bounds.x) / cellSize)}|${Math.floor((c.y - bounds.y) / cellSize)}`));
     const fallbackSet = new Set(fallbackCandidates.map(c => `${Math.floor((c.x - bounds.x) / cellSize)}|${Math.floor((c.y - bounds.y) / cellSize)}`));

     const cols = Math.ceil(bounds.width / cellSize);
     const rows = Math.ceil(bounds.height / cellSize);
     for (let cy = 0; cy < rows; cy++) {
       for (let cx = 0; cx < cols; cx++) {
         const key = `${cx}|${cy}`;
         const px = bounds.x + cx * cellSize;
         const py = bounds.y + cy * cellSize;
         if (spawnSet.has(key)) {
           gfx.fillStyle(0x00ff00, 0.25); // green = spawn candidate
         } else if (fallbackSet.has(key)) {
           gfx.fillStyle(0xffff00, 0.25); // yellow = fallback only
         } else if (visited.has(key)) {
           gfx.fillStyle(0x0000ff, 0.15); // blue = reachable but not candidate
         } else {
           gfx.fillStyle(0xff0000, 0.15); // red = blocked/unreachable
         }
         gfx.fillRect(px, py, cellSize, cellSize);
       }
     }
   }
   ```

2. **Toggle via a debug flag**:
   - Check for `window.DEBUG_SPAWN_GRID = true` or a URL parameter `?debugSpawn=1`
   - Call `debugRenderAccessibleArea(scene)` at the end of `recomputeAccessibleArea` when the flag is set
   - Clean up the overlay on room transition (destroy `scene._debugSpawnOverlay`)

3. **Expose the function globally** for console use:
   ```javascript
   window.debugRenderAccessibleArea = debugRenderAccessibleArea;
   ```
   - This lets developers call it manually from the browser console without needing to set the flag before room entry

4. **Clean up on room exit**:
   - In `enterRoom()` or wherever room cleanup happens, destroy the debug overlay:
     ```javascript
     if (scene._debugSpawnOverlay) {
       scene._debugSpawnOverlay.destroy();
       scene._debugSpawnOverlay = null;
     }
     ```

**Files**: `js/roomManager.js` (debug overlay only -- does not conflict with WP01's owned_files since WP01 will be merged first)

**Validation**:
- [ ] Setting `window.DEBUG_SPAWN_GRID = true` before entering a room shows colored grid overlay
- [ ] Green cells = valid spawn positions, yellow = fallback, red = blocked
- [ ] Overlay is cleaned up on room transition (no stale graphics)
- [ ] Function can be called from browser console: `debugRenderAccessibleArea(game.scene.scenes[0])`
- [ ] No performance impact when debug flag is off

---

## Definition of Done

- [ ] No enemy is ever placed at an invalid position -- spawn is skipped instead
- [ ] Console warning logged for every skipped spawn
- [ ] Room clear condition still works with fewer enemies
- [ ] Debug overlay available for future spawn diagnostics
- [ ] No console errors in normal (non-debug) play
- [ ] Enemy count in waves is accurate (no phantom enemies)

## Risks

| Risk | Mitigation |
|------|------------|
| Skipping too many spawns makes rooms too easy | Log warnings so designers can detect; consider adjusting room generation to produce more walkable area |
| Debug overlay causes performance issues if left on | Only renders when flag is explicitly set; uses alpha-blended rectangles (cheap) |
| Room clear condition broken by skipped enemies | Verify clear condition checks actual spawned count, not intended count |

## Reviewer Guidance

- Test in a procedural room with debug overlay enabled (`window.DEBUG_SPAWN_GRID = true`)
- Verify all enemies appear on green or yellow cells, never on red
- Force a small room scenario -- check that skipped spawns log a warning and the room still clears
- Check that no enemies spawn at position (0,0) or outside room bounds
- Verify `enemiesRemaining` counter matches actual enemy count on screen
