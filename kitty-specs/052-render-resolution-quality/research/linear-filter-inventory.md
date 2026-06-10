# WP03 LINEAR-Filter Inventory

**Feature**: 052 — Render Resolution Quality
**WP**: WP03 — LINEAR-Audit (extends the 051 per-texture filter pattern from a hand-picked Hub allow-list to every non-procedural texture in the game)
**Date**: 2026-06-10
**Status**: Research for WP03 implementor — no code changed.

---

## TL;DR for the implementor

- **Pattern lives in `js/scenes/HubSceneV2.js:121-143`** — copy/expand it; don't reinvent it.
- **Only one set of textures must keep NEAREST**: anything generated at runtime via `graphics.generateTexture(...)` / `textures.createCanvas(...)` AND drawn into the procedural dungeon (floor/wall/obstacle tiles, doors, particle, dungeon enemy procs). Comment in `js/main.js:80-84` is the canonical reason.
- All other textures (file-loaded PNGs for player, hub bg, hub NPCs, enemy frames, projectiles, boss frames, the painterly `rathauskeller_bg`, the Q5-cellar `elara_right0`) are safe and visibly benefit from LINEAR.
- A small helper `applyLinearFilter(scene, keys, opts)` in a shared module (e.g. `js/renderQuality.js`) lets the four scenes that need it (StartScene, HubSceneV2, GameScene, the future SettingsScene preview) share one implementation.

---

## ## Bestehende Calls

The **only** existing per-texture filter override in the whole `js/` tree today is the Feature-051 Hub allow-list. Nothing else touches `setFilter` / `FilterMode`.

| File | Line | Context |
|---|---|---|
| `js\scenes\HubSceneV2.js` | 122-126 | Comment block explaining why per-texture LINEAR is needed (global `pixelArt: true` ⇒ NEAREST is required for proc dungeon but kills painterly NPC sprites at 15× downscale) |
| `js\scenes\HubSceneV2.js` | 127 | `const LINEAR = Phaser.Textures.FilterMode.LINEAR;` |
| `js\scenes\HubSceneV2.js` | 128-137 | `smoothTextures = [...]` allow-list (hub-bg + every NPC sprite key currently in the hub) |
| `js\scenes\HubSceneV2.js` | 138-143 | The `forEach` loop: guards `t.key !== '__MISSING'` and `typeof t.setFilter === 'function'` before calling `t.setFilter(LINEAR)` |
| `js\main.js` | 80-84 | Comment block declaring the global constraint: `pixelArt: true` is load-bearing for procedural floor + obstacle textures; the upscale is meant to happen at the BROWSER level (`image-rendering: auto` on the canvas). This is the C-01 constraint from `plan.md`. |
| `js\main.js` | 85 / 90 | The actual `pixelArt: true` + `render.antialias: false` + `roundPixels: true` triple — DO NOT touch in WP03. |

> Grep used: `setFilter | LINEAR | NEAREST | Phaser.Textures.FilterMode | FilterMode.LINEAR` against `js/`. Six matches total, all of them above.

---

## ## Non-Proc Inventar (sollten LINEAR bekommen)

These are real-PNG textures (loaded via `this.load.image(...)`) or single-use canvas portraits drawn once. None of them participate in the procedural dungeon tiling. All visibly benefit from bilinear filtering when downscaled.

### A. Hub background + Hub NPCs (already covered today — WP03 keeps these)

Currently in the `smoothTextures` array at `HubSceneV2.js:128-137`. WP03 just needs to keep them.

| Key | Loaded at | Used at | Note |
|---|---|---|---|
| `hubscene_bg` | `js\scenes\HubSceneV2.js:93` | `HubSceneV2.js:145` (`add.image(0,0,'hubscene_bg')`) | 1536×1024 painterly, drawn at scale ~0.625 in 960×480 canvas |
| `schmiedemeisterin` | `HubSceneV2.js:98` | NPC factory `HubSceneV2.js:589` via `npc.texture` | Mara |
| `setzer_thom` | `HubSceneV2.js:99` | dito | Thom |
| `spaeherin` | `HubSceneV2.js:100` + lazy reload `eventSystem.js:948` | NPC factory + `_placeMerchant` dungeon spawn (`eventSystem.js:973`) | Branka — also used as in-dungeon merchant; cellar usage is a second filter site (see § Other scenes below) |
| `klerus` | `HubSceneV2.js:104` | NPC factory | Priest (Feature 050) |
| `garde` | `HubSceneV2.js:105` | NPC factory | City watch (Feature 050) |
| `aldric_{left,right}{0,1,2}` (6 keys) | `HubSceneV2.js:106-110` | NPC factory | Aldric walk frames |
| `elara_{left,right}{0,1,2}` (6 keys) | `HubSceneV2.js:106-110` | NPC factory | Elara walk frames (hub-side) |
| `harren_{left,right}{0,1,2}` (6 keys) | `HubSceneV2.js:106-110` | NPC factory | Harren walk frames |

### B. Player sprites (currently NOT filtered — WP03 should add)

Big 125×500 PNG-per-frame; 8 directions × 8 frames = 64 textures. Drawn at `PLAYER_VISUAL_SCALE = 0.456` (`player.js:22`) and a frame size up to ~57×228 — strong downscale, will benefit a lot.

| Key pattern | Loaded at | Used at | Note |
|---|---|---|---|
| `dir{00..07}_f{00..07}` (64 keys) | `js\player.js:47-62` `preloadPlayerDirectionalFrames` (StartScene) + lazy `player.js:71-98` `ensureDirectionLoaded` | Player sprite created in `HubSceneV2.js:696` and in `GameScene` via the wired player factory | Lazy load: Start preloads dir00; the other 7 dirs stream in via `ensureDirectionLoaded` and the `scene.load.once('complete', ...)` callback. WP03 must filter inside that complete-callback or these will silently stay NEAREST. |
| `playerTexture` | generated in `js\graphics.js:1990` | fallback player placeholder | Procedural — leave NEAREST (looks pixel-art anyway, see § Proc) |
| `playerDagger` | generated `graphics.js:1837` | thrown dagger projectile | Same — proc, NEAREST OK |
| `playerArrow` | generated `graphics.js:1853` | arrow projectile | Same |

> Implementation note for the lazy directional frames: filter must be applied **after** `scene.load.complete` fires for that direction, otherwise `textures.get(key).setFilter` will hit the `__MISSING` texture. See § Helper for the suggested signature.

### C. Enemy + Boss + Projectile PNG sprites (currently NOT filtered — WP03 should add)

All loaded in `js\scenes\startScene.js` preload. Each enemy uses 6 directional frames (left/right × 0/1/2) plus a generic still. Bosses use a 6-frame pack + idle fallback.

| Key pattern | Loaded at | Note |
|---|---|---|
| `brute_{left,right}{0,1,2}` | `startScene.js:137-142` | Brute walk |
| `imp_{left,right}{0,1,2}` | `startScene.js:145-150` | Imp |
| `shadow_{left,right}{0,1,2}` | `startScene.js:153-158` | Shadow Creeper |
| `flameweaver_{left,right}{0,1,2}` | `startScene.js:161-166` | Flame Weaver |
| `chainguard_{left,right}{0,1,2}` | `startScene.js:169-174` | Chain Guard |
| `archer_{left,right}{0,1,2}` | `startScene.js:177-182` | Archer |
| `mage_{left,right}{0,1,2}` | `startScene.js:185-190` | Mage |
| `rat_{left,right}{0,1,2}` | `startScene.js:193-198` | Rat |
| `bat_{left,right}{0,1,2}` | `startScene.js:201-206` | Bat |
| `wolf_{left,right}{0,1,2}` | `startScene.js:209-214` | Wolf |
| `sprite_imp`, `sprite_archer`, `sprite_mage`, `sprite_shadow`, `sprite_chainguard`, `sprite_flameweaver` | `startScene.js:217-222` | Generic still fallbacks |
| `boss_chain_{...}`, `boss_ceremony_{...}`, `boss_shadow_{...}` (6 frames each) | `startScene.js:224-228` (loop) | Boss walk |
| `sprite_boss_chain`, `sprite_boss_ceremony`, `sprite_boss_shadow` | `startScene.js:230-232` | Boss idle fallbacks |
| `proj_arrow`, `proj_arcane`, `proj_fireball`, `proj_default` | `startScene.js:238-241` | Projectile sprites — small but used at large display scale in some cases; LINEAR safe |
| `stairDown` | `startScene.js:235` | Tile asset PNG. **Edge case**: used IN the dungeon. Worth a quick visual check; if it looks soft against NEAREST floor tiles, can stay NEAREST. Default WP03 stance: filter LINEAR. |

### D. Cellar-only / runtime-loaded NPC sprites

| Key | Loaded at | Used at | Note |
|---|---|---|---|
| `rathauskeller_bg` | `js\main.js:821` (`function preload()`) | `main.js:1061` (`add.image(480,240,'rathauskeller_bg')`) — guarded by `window.USE_RATHAUSKELLER_BG` | Painterly 960×480 background; clearly benefits from LINEAR. |
| `elara_right0` | `js\main.js:826-828` (lazy guard) | `roomManager.js:1766` via `EventSystem.spawnEventObject(scene, 'elara_right0', ...)` — Feature 050 Q5 cellar encounter | Single painterly frame, rendered at `{ scale: 0.16 }`. Per the auto-memory note: scale must stay `0.16` (matched to hub display size). LINEAR will further smooth the 1:1→0.16 downscale. |
| `spaeherin` (re-load) | `js\eventSystem.js:948` | Dungeon merchant `_placeMerchant` at `eventSystem.js:973` | Same PNG as hub Branka, but loaded by the GameScene loader if missing. WP03 must filter it on the GameScene side too — or, better, hook the lazy `scene.load.once('complete', ...)` callback. |

### E. HUD / UI: text + circles only (no extra filter touch needed)

`js\hudV2.js` builds the HUD entirely from `scene.add.circle`, `scene.add.text`, `scene.add.graphics` — there are no `add.image` calls except via the inventory overlay (see F below). Phaser text/shape gameobjects do not flow through the texture filter pipeline, so WP03 does **not** need to touch HUDv2.

### F. Inventory / Loadout / Crafting UI (uses generated UI textures — already-NEAREST-OK by design, but LINEAR safe)

These textures are generated procedurally in `js\graphics.js` (`createUIGraphics` block, ~lines 1853-1918) and consumed in `js\inventory.js`:

| Key | Generated at | Used at | WP03 recommendation |
|---|---|---|---|
| `uiPanel` | `graphics.js:1853` | `inventory.js:421` (inventory panel BG) | Stylized rounded-rect, looks fine either way. Default: leave NEAREST (consistent with the rest of generated UI), but harmless to flip to LINEAR. |
| `uiSlot` | `graphics.js:1861` | `inventory.js:637, 662, 697, 724` (slot frames) | Same as above. |
| `uiSlotSel` | `graphics.js:1869` | (selection highlight) | Same. |
| `hudFrame`, `barFill`, `barFillXP`, `healthDrop`, `xpDrop` | `graphics.js:1885, 1902, 1918, 1934, 1943` | various | These are **drawn in the dungeon HUD context, but as scene-level images, not into procedural tiles**. Either way works. Default: leave NEAREST for consistency. |
| `itMat`, `lootTexture`, `chest_small`, `chest_medium`, `chest_large`, `goldPile`, `proc_scroll`, `evt_fountain`, `evt_shrine`, `evt_gamble`, `evt_treasure`, `evt_cursed`, prop_* | `graphics.js` + `eventSystem.js:319-389` + `main.js:832` | Loot drops + event-object overlays | All procedural — **leave NEAREST**. These are the small 16×16…32×32 pixel-art icons that look correct only at NEAREST. |

> Bottom-line for UI: WP03 can skip the inventory/HUD/event icons. The painterly assets (hub-bg, NPCs, rathauskeller-bg, player, enemies, projectiles) are where the perceptible win is.

---

## ## Proc-Texturen DON'T-TOUCH

These are the textures the `pixelArt: true` global config is protecting (see `js\main.js:80-84` comment). LINEAR breaks them — either visually (mortar lines smear into tiles), or structurally (the pre-baked floor canvas in `roomTemplates.js:447-487` explicitly disables `imageSmoothingEnabled` on the 2D context, then registers the canvas as a Phaser texture; LINEAR on top of that would re-introduce the smoothing the bake was meant to defeat).

**Hard NO list**:

| Generated at | Texture key(s) | Why NEAREST is load-bearing |
|---|---|---|
| `js\graphics.js:49, 651, 692, 742, 902, 910, 943` | `floor_stone`, `floor_stone_dark`, `floor_cobble`, `floor_tile_ornate`, `floor_crack`, `floor_stain`, `floor_blood` | Tiled into TileSprite or baked into giant floor canvas (`roomTemplates.js:478`). |
| `js\graphics.js:105, 793, 836, 895, 985` | `obstacleWall`, `wall_brick`, `wall_stone_large`, `wall_dungeon`, `wall_mossy` | Drawn via `scene.add.tileSprite(...)` at `roomTemplates.js:530`. **TileSprite + LINEAR + pixel-art source = the bug `main.js:80-84` describes.** |
| `js\graphics.js:141, 180, 213, 254, 314, 350, 395, 514, 541, 573, 611, 1000, 1019, 1029, 1041` | `obstacleTree`, `obstacleRock`, `pillar_small`, `pillar_large`, `statue_knight`, `brazier`, `crate`, `barrel`, `rubble`, `altar`, `stairDown`-proc, `torch_glow`, `cobweb`, `particle`, `particle_soft` | Proc-dungeon obstacles, particle FX |
| `js\graphics.js:1062, 1096, 1126, 1155, 1184, 1207, 1231, 1256, 1297, 1336, 1377, 1637, 1644` | `projectileTexture`, `enemyImp`/`enemyArcher`/`enemyBrute`/`enemyMage`/`enemyShadow`/`enemyChainGuard`/`enemyFlameWeaver`, `bossChainMaster`/`bossCeremonyMaster`/`bossShadowCouncillor`, `eSlashArc`, `eHitSpark` | Pixel-art proc enemies + slash FX. Conceptually proc — leave NEAREST. |
| `js\graphics.js:2037, 2048, 2059, 2069, 2078, 2092` | `prop_barrel`, `prop_crate`, `prop_pillar`, `prop_rubble`, `prop_puddle`, `prop_cobweb` | Proc props decorating dungeon rooms |
| `js\enemy.js:315, 320, 325, 1637, 1644` | `proc_rat`, `proc_bat`, `proc_wolf`, plus the slash/spark above | Proc enemy fallbacks |
| `js\eventSystem.js:334, 347, 361, 371, 382, 387, 1142` | `evt_fountain`, `evt_shrine`, `evt_gamble`, `evt_treasure`, `evt_cursed`, `proc_scroll` | Event objects drawn into the dungeon |
| `js\doorSystem.js:31, 89` | `proc_door_closed_{W}x{H}`, `proc_door_open_{W}x{H}` | Per-room door canvas textures |
| `js\main.js:832` | `lootTexture` | 16×16 generated loot placeholder |
| `js\graphics.js:397-440` (chestDefs forEach, ends `generateTexture(key,w,h)`) | `chest_small`, `chest_medium`, `chest_large` | Proc dungeon chests |
| `js\graphics.js:2016` | `goldPile` | Proc loot drop |
| `js\scenes\TestTerrainScene.js:157` | dev tile canvas | Dev-only scene |
| `js\scenes\HubSceneV2.js:584` | placeholder NPC texture (only when an NPC PNG is missing) | If the asset PNG exists this branch is dead. If it ever runs (e.g. dev), the placeholder is procedural — leave NEAREST. |

**Heuristic for the implementor**: if a key is registered via `g.generateTexture(...)` or `scene.textures.createCanvas(...)` and it's drawn into the GameScene dungeon, **don't filter it**. If a key is registered via `this.load.image(...)` from `assets/...`, it's almost certainly painterly and safe to filter.

There are two file-loaded keys with proc-style intent that are edge cases:
- `stairDown` (`startScene.js:235`) — PNG asset, but used inside the dungeon next to NEAREST tiles. Recommendation: filter LINEAR, but watch for visual regression.
- `tile_grass`, `tile_ground`, `tile_ground_street`, `tile_grass_*` (`HubScene.js:43-49`) — PNG assets, but `HubScene` is the legacy hub that **is no longer in the scene list** (`main.js:106` mounts `HubSceneV2`, not `HubScene`). The only caller is `TestTerrainScene.js:64`. **Skip in WP03 unless dev-tooling is in scope.**

---

## ## 051-Pattern (verbatim from `HubSceneV2.create`)

This is the proven shape WP03 should expand. From `js\scenes\HubSceneV2.js:121-143`:

```js
// Per-texture filter override. The global game config (main.js:85) sets
// pixelArt: true → NEAREST sampling for all textures. That's required by
// the procedural dungeon floor/wall textures, but it produces jagged
// edges on the painterly NPC + hub-background sprites when downscaled
// (1536x1024 source → ~100px display = ~15x downscale). Force LINEAR
// filter on the hub assets so they bilinear-interpolate smoothly.
const LINEAR = Phaser.Textures.FilterMode.LINEAR;
const smoothTextures = [
  'hubscene_bg', 'schmiedemeisterin', 'setzer_thom', 'spaeherin',
  'klerus', 'garde',
  'aldric_left0', 'aldric_left1', 'aldric_left2',
  'aldric_right0', 'aldric_right1', 'aldric_right2',
  'elara_left0', 'elara_left1', 'elara_left2',
  'elara_right0', 'elara_right1', 'elara_right2',
  'harren_left0', 'harren_left1', 'harren_left2',
  'harren_right0', 'harren_right1', 'harren_right2'
];
smoothTextures.forEach((key) => {
  const t = this.textures.get(key);
  if (t && t.key !== '__MISSING' && typeof t.setFilter === 'function') {
    t.setFilter(LINEAR);
  }
});
```

Key properties of the pattern (preserve all of them):

1. `LINEAR = Phaser.Textures.FilterMode.LINEAR` — `Phaser.Textures.FilterMode` is the canonical Phaser 3.70 path; do not invent.
2. `this.textures.get(key)` — by-key lookup; returns the sentinel `__MISSING` texture if the key doesn't exist.
3. Guard `t && t.key !== '__MISSING'` — keeps the call no-op when a deferred asset hasn't loaded yet (matters for lazy player frames and the runtime-loaded `spaeherin` in the cellar).
4. Guard `typeof t.setFilter === 'function'` — defensive against unusual texture sources (canvas textures expose the method too, but it costs nothing).
5. Called from `scene.create()` — i.e. after preload finished. **For lazy/streamed assets, the equivalent call must move into the `scene.load.once('complete', ...)` callback.**

---

## ## Helper-Vorschlag

WP03 will be touching at minimum: StartScene preload-complete (enemies + projectiles + bosses), HubSceneV2 (already done — just expand the array or call the helper), the GameScene preload + the lazy `ensureDirectionLoaded` callback (player frames), the merchant-respawn callback in `eventSystem.js:948-953` (dungeon `spaeherin` reload). That's 4–5 sites. A helper pays for itself.

**Suggested home**: new file `js\renderQuality.js`, loaded **before** any scene that consumes it (i.e. before `js/scenes/startScene.js` in `index.html`). Reason: the same module will host the WP02 `resolution` decision and the WP05 settings toggle (see `plan.md`).

**Suggested signature** (no implementation — just the shape WP03 should fit):

```js
window.RenderQuality = window.RenderQuality || {
  // Apply LINEAR (bilinear) filter to a list of texture keys.
  // - scene: any Phaser scene (uses scene.textures)
  // - keys: array of strings; non-existent / __MISSING entries are silently skipped
  // - opts.warnOnMissing (default false): console.warn each skipped key
  // Returns: number of textures actually filtered (for telemetry / smoke test)
  applyLinearFilter(scene, keys, opts) { ... },

  // Convenience: apply LINEAR to every texture key matching a prefix.
  // Use case: `applyLinearFilterByPrefix(scene, ['dir', 'brute_', 'imp_', ...])`
  // to cover lazy-loaded directional frame families in one call.
  applyLinearFilterByPrefix(scene, prefixes, opts) { ... },

  // Mark a list of keys as "always proc / always NEAREST" so accidental
  // future calls can be audited. Optional — only worth adding if WP05
  // ends up exposing a "force LINEAR everywhere" debug toggle.
  registerProcKeys(keys) { ... }
};
```

**Where WP03 would call it**:

| Site | Call |
|---|---|
| `startScene.js` after `this.load.on('complete', ...)` (around line 119) | `RenderQuality.applyLinearFilterByPrefix(this, ['brute_', 'imp_', 'shadow_', 'flameweaver_', 'chainguard_', 'archer_', 'mage_', 'rat_', 'bat_', 'wolf_', 'sprite_', 'boss_', 'proj_'])` plus explicit list for `stairDown`, `dir00_*` (the initial direction). |
| `HubSceneV2.js:138-143` | Replace inline loop with `RenderQuality.applyLinearFilter(this, [...smoothTextures])`. |
| `player.js:85` inside `ensureDirectionLoaded` completion handler | `RenderQuality.applyLinearFilterByPrefix(scene, ['dir' + dd + '_'])` after `ensureDirectionAnimations` runs. |
| `eventSystem.js:949` (`scene.load.once('complete', ...)` for cellar `spaeherin`) | `RenderQuality.applyLinearFilter(scene, ['spaeherin'])` before `_placeMerchant`. |
| `main.js` `preload()` line 826 (lazy `elara_right0` for Q5 cellar) | After `this.load.image(...)`, also wire a `load.once('complete', () => RenderQuality.applyLinearFilter(this, ['elara_right0', 'rathauskeller_bg']))`. Or apply unconditionally in `create()` after the preload chain — both work. |

A self-contained helper also makes it trivial to add an FPS-instrumented smoke test in WP01 follow-up (count how many textures we filter on each scene boot — useful for the `lever-impact-matrix.md` columns).

---

## ## Open question for the implementor

- **Frame normalization caveat for `player.js:171, 230, 336`**: `normalizePlayerDirectionalFrames` does `texManager.remove(key); texManager.addCanvas(key, canvasTex.canvas)`. After this swap, any LINEAR-filter previously applied to the original PNG-backed texture is gone — the new canvas-backed texture defaults to NEAREST. The fix is to apply the filter **after** normalization runs, which lines up with the `ensureDirectionLoaded` completion handler already proposed above. Worth confirming in WP03 with a single `console.log` of `scene.textures.get('dir00_f00').source[0].source.constructor.name` after both steps.

- **Other consumers of `pixelArt: true`'s NEAREST default**: nothing found outside the proc-dungeon pipeline. If WP04 (Canvas-Bump 960×480 → 1920×960) lands, the per-texture LINEAR list from WP03 should still be correct — the bigger canvas just reduces the downscale factor, so LINEAR will be even safer for the painterly assets.
