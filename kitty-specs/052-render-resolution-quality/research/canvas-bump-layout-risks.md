# WP04 Canvas-Bump Layout Risk Audit (960x480 -> 1920x960)

**Feature**: 052 - Render Resolution Quality
**WP**: WP04 (Canvas-Bump) - **pre-implementation audit only, no code changed**
**Date**: 2026-06-10
**Spec**: [spec.md](../spec.md) C-04 + FR-06
**Plan**: [plan.md](../plan.md) Phase 3

---

## TL;DR for the implementor

The good news: **almost no UI code in the project uses raw pixel literals**. Phaser-scene UI in this codebase consistently reads `cameras.main.width/height` (alias `cw`/`ch`) and centers from there, then clamps panel dimensions with `Math.min(target, cw - 40)`. WP04's 2x canvas bump leaves that math working correctly because `cw` doubles, so panels grow and stay centered.

The bad news: there is **one really sharp landmine** and **three medium-risk clusters**.

| # | Risk | Where | Severity |
|---|---|---|---|
| 1 | Legacy GameScene HUD positioned with hardcoded `(400, 300)` / `(400, 150)` / `(16, 12..144)` text stack | `js/main.js:1907-1953` | RED (sort of) - drifts to upper-left corner under 2x; but every visible piece is `setVisible(false)` once HUDv2 takes over (`main.js:1939`). Real risk: any setup path that doesn't reach `HUDv2.build` falls back to a corner-pinned death/level-up overlay |
| 2 | Leaderboard render uses literal `(400, 360)` / `(400, 400)` for "Highscores" stack on death | `js/main.js:1810-1830` | RED - drifts to upper-left corner; this code path is reachable on every death |
| 3 | Hub mobile-interact button position works **only** because it reads `this.scale.width/height` - which doubles correctly under WP04. But the `btnRadius=38`, label sizes etc are pixels, and at 2x they'll appear half-size on the displayed screen | `js/scenes/HubSceneV2.js:222-247` | YELLOW |
| 4 | `mobileControls.js` (joystick + skill grid) uses `BASE_RADIUS = 38`, `CORNER_PAD = 20`, `GRID_GAP = 12`, `MIN_HIT_HALF = 22` - all pixel literals. Reads `scene.scale.width/height` for positioning so the grid stays bottom-right anchored, but the buttons themselves stay **the same world-pixel size** and therefore appear visually smaller on the displayed screen under a 2x bump | `js/mobileControls.js:43-47` | YELLOW (mobile-only, see Special Check) |
| 5 | `hudV2.js` constants `HP_BAR_W = 220`, `XP_BAR_W = 220`, `PORTRAIT_R = 26`, `ICON_R = 22` are pixel-sized. Top-left layout reads `x0 = 12`, top-right reads `cw - 12 - ICON_R`. Under 2x the bars stay 220x18 world-pixels but the canvas is 1920 wide - so they look correctly anchored, just **half the screen-area they used to occupy** | `js/hudV2.js:57-64`, `184-221` | YELLOW |
| 6 | Rathauskeller BG image hardcoded at `(480, 240)` with `setDisplaySize(960, 480)` | `js/main.js:1061-1062` | **RED** - the only image in the codebase positioned at the unscaled canvas center. Under 2x it lands at `(480, 240)` which is the upper-left quadrant. `setDisplaySize(960, 480)` keeps it half-size |
| 7 | KnowledgeTree confirm-modal uses literal `(-200, -80, 400, 160)` panel rect (inside container, so origin-relative) | `js/scenes/HubSceneV2.js:2370-2372` | GREEN-ish - the container is at `(cam.width/2, cam.height/2)` so the modal stays centered; only the modal itself stays 400x160 pixels (looks half-size at 2x but readable) |

The cascading conclusion: the **modal scenes are safe**. The **HUDv2 + mobileControls + Rathauskeller-BG + legacy fallback HUD** are the audit hotspots.

---

## ## Methodik

Three grep families against `js/`:

1. **Numeric-literal coords**: `add\.(text|image|container|rectangle|graphics|circle|sprite|tileSprite)\s*\(\s*\d+\s*,\s*\d+` - finds every `scene.add.X(literalX, literalY, ...)` call. ~30 raw hits across all 6 target files.
2. **Camera-aware coords**: same prefix, but verifying the call uses `cw`, `ch`, `cameras.main.width/height`, `scale.width/height`, or local container coords (`-panelW/2` etc.). These are GREEN.
3. **Safe-area / mobile-aware reads**: `__SAFE_AREA__`, `scale.on('resize'`. These prove which sites already react to viewport changes (so a Phaser resize event on canvas-bump triggers reflow).

Cross-checked the targets enumerated in spec.md C-04: `HubSceneV2`, `GameScene` (in `main.js`), `SettingsScene`, `CraftingScene`, `HUDv2`, `PrintingHouseScene`. Also peeked at the secondary consumers actually reachable from the canvas-bump blast radius: `mobileControls.js`, `loadoutOverlay.js`, `inventory.js`, `minimap.js`, `mobileSafeArea.js`, plus `index.html` for canvas CSS.

### Scoring rubric (consistent across all findings)

- **GREEN** = uses `cameras.main.width/height`, `cw`/`ch`, `scale.width/height`, container-local `-panelW/2 + pad` math, OR a `scale.on('resize', ...)` handler that re-flows. WP04 bump auto-rescales these.
- **YELLOW** = hardcoded pixel positions in **edge-anchored** UI that uses screen-dim reads for the anchor (e.g. `scene.scale.width - 80`, `cw - 12 - ICON_R`). Will not crash and will not appear off-screen, but the **visual size** of the element stays at the world-pixel value and therefore looks ~50 % smaller on screen after the 2x bump. Worth a polish pass; not a blocker.
- **RED** = hardcoded pixel positions with **NO** screen-dim alias - the element sits at the literal canvas coord, which after 2x bump lands in the upper-left quadrant of the (doubled) canvas. Player sees broken layout.

---

## ## Pro-Scene Inventar

### A. `js/scenes/HubSceneV2.js` (2768 lines, scanned in full)

**Verdict: GREEN with one YELLOW (mobile-interact button sizing).**

| Site | Lines | What | Tag |
|---|---|---|---|
| `bg = this.add.image(0, 0, 'hubscene_bg')` | 145 | Hub painterly background. `setOrigin(0,0)`, `setScale(1.0)`. The hub world is 1536x1024 (`W, H` consts at line 115), camera bounds are `(0, 0, W, H)` (line 117). The canvas bump does NOT change `W, H` because they're hub world coords - so the bg position stays correct relative to the world. Camera follows player, viewport widens. GREEN. | GREEN |
| Mobile joystick base/thumb | 208-216 | `add.circle(0, 0, 60, ...)`, `add.circle(0, 0, 30, ...)`. The joystick is positioned via the plugin's `x: 100, y: this.scale.height - 100` config - so it stays bottom-left anchored. The circle radius `60/30` is world-pixel-sized; under 2x bump the joystick **renders half-size on screen** (still functional, but visibly smaller). | YELLOW |
| Mobile interact button + glyph | 222-247 | `bx = this.scale.width - 20 - sa.right - btnRadius`, `by = this.scale.height - 20 - sa.bottom - btnRadius`. Edge-anchored via `this.scale.width/height` so it stays in the bottom-right. **However** `btnRadius = 38`, label glyph size `Math.round(btnRadius * 0.9)` = world-pixels. Same YELLOW pattern as mobileControls. There IS a `scale.on('resize', reflowBtn)` listener (line 249) that re-positions but does NOT re-size. | YELLOW |
| Prompt text + interactable labels | 412-417, 480-486, 602-608, 639 | All positioned by `sx + sw/2`, `sy - 10`, `sy - 90`, etc. - all use the per-NPC/per-entrance computed positions, which derive from `HUB_HITBOXES * SCALE_FACTOR`. GREEN. | GREEN |
| NPC sprite placement | 516-619 | All via `npc.x * SCALE_FACTOR` / `npc.y * SCALE_FACTOR`. Anchored to the hub world. GREEN. | GREEN |
| Dialog modal (`_showDialoguePages`) | 1176-1332 | `cx = cam.width / 2`, `cy = cam.height - 180`. Panel is 540x{dynamic}, drawn at container-local `(-panelWidth/2, -panelHeight/2)`. Lines 1180-1332 walk the panel relative to the container origin. GREEN. | GREEN |
| Wave-select modal (`_openWaveSelectDialog`) | 1793-2080 | `cx = cam.width / 2`, `cy = cam.height / 2`. Panel `440x340` (matches the burger menu numbers - the value mentioned in the task prompt as "panelW=280, panelH=340"). At 2x the panel stays 440x340 world-pixels which is 23 % of a 1920-wide canvas - **looks slightly smaller** but still readable. Text fontSize `18-48px` stays the same; will appear smaller on screen (see Text-Sizing-Audit). | GREEN (positioning) / YELLOW (panel sizing) |
| Knowledge Tree modal | 2086-2356 | `panelW = Math.min(920, cw - 10)`, `panelH = Math.min(460, ch - 10)`. **Adaptive** - at 2x bump `cw = 1920`, so `panelW = 920` (capped). On a 4K display + 2x bump the panel stays 920px which is `920 / 1920 = 48 %` of the canvas, looks slightly smaller. GREEN math, slight YELLOW visual. | GREEN |
| KT respec confirm dialog | 2358-2399 | Container at `(cam.width/2, cam.height/2)`. Panel literal `(-200, -80, 400, 160)` inside container. Container is screen-centered so the modal stays centered; the modal itself stays 400x160 world-pixels (looks half-size at 2x). | GREEN (positioning) / YELLOW (size) |
| Run summary modal | 2462-2587 | `cw = cam.width`, `ch = cam.height`. `panelW = Math.min(520, cw - 40)`, `panelH = Math.min(460, ch - 60)`. Inner rows at `-panelW/2 + innerPad`. GREEN. | GREEN |
| Splash modal (intro/outro) | 2713-2767 | Same shape as run summary; `Math.min(620, cw - 40)`, `Math.min(360, ch - 60)`. GREEN. | GREEN |

**Per-scene summary**: `HubSceneV2` is the most-disciplined consumer in the codebase - every modal uses cam-dim reads. **Only YELLOW**: mobile interact button + joystick stay world-pixel-sized.

### B. `js/main.js` (GameScene + utility) (2522 lines, scanned bands 1050-1110, 1240-1335, 1800-1990, 2400-2470)

**Verdict: RED in two places (rathauskeller BG, leaderboard); YELLOW for ability-CD positioning; the legacy text HUD is RED-by-coords but hidden in practice.**

| Site | Lines | What | Tag |
|---|---|---|---|
| `this.rathauskellerBg = this.add.image(480, 240, 'rathauskeller_bg')` + `setDisplaySize(960, 480)` | 1061-1066 | **RED**. Position `(480, 240)` was the unscaled canvas center (`960/2, 480/2`). Under WP04 the new canvas is `1920x960`, true center = `(960, 480)`. The image lands in the upper-left quadrant and only covers a quarter of the canvas. Must change to `(scene.scale.width/2, scene.scale.height/2)` or read `cameras.main.centerX/Y` AND `setDisplaySize(scene.scale.width, scene.scale.height)`. | **RED** |
| Status-effect HUD icons | 1247-1273 | Positioned by computed `startX + i * (iconSize + spacing + 30)`. `startX` is passed in from caller - need to check. Mid-scan band suggests caller uses `cw - X` math. Sample sites scanned suggest GREEN, but worth a quick verify-pass before WP04. | GREEN (likely) |
| `scene.add.text(400, 360, 'Highscores', ...)` + `(400, 400 + i * 22, ...)` + `(400, 400, 'Fehler...', ...)` | 1810-1830 | **RED**. Hard literals `(400, 360)`, `(400, 400)`. At 2x bump these land in the upper-left quadrant. Reachable on player death (called from `handlePlayerDeath` -> `loadScores().then(...)`). Must change to `cw/2, ch * 0.75` etc. | **RED** |
| Legacy text HUD: `weaponStatsText`, `playerHealthText`, `playerXPText`, `waveText`, `_roomCounterText`, `_goldText` | 1907-1919 | All hardcoded `(16, 12)`, `(16, 56)`, `(16, 78)`, ... in the top-left corner. **However** line 1939 immediately calls `.setVisible(false)` once HUDv2 builds. The risk surfaces ONLY if `window.HUDv2` is missing or `HUDv2.build` throws (try/catch on line 1937 swallows that path - falls back to the legacy text HUD visible at literal coords). At 2x bump the text stack stays at `(16, 12)` which IS still the top-left corner (correct) but only occupies `220px / 1920px = 11 %` of width (very small visually). Not RED in normal play, RED in degraded play. | YELLOW (RED in HUDv2 failure) |
| `gameOverText = this.add.text(400, 300, 'hud.dead', {fontSize: '40px'})` | 1948 | **RED**. Hard `(400, 300)` for death overlay. Under 2x lands in upper-left quadrant. Pre-set `setOrigin(0.5)`, but the position is the screen center under 960x480, NOT the 1920x960 canvas. Must change to `scene.scale.width/2, scene.scale.height/2`. | **RED** |
| `levelUpText = this.add.text(400, 150, 'hud.level_up', {fontSize: '48px'})` | 1951 | **RED**. Same problem as gameOverText - the level-up modal "level up!" splash lands off-center. | **RED** |
| Cooldown text positions: `updateAbilityCooldownPositions(width, height)` | 1970-1985 | Reads `width - 80`, `height - 80`, etc. Anchored to bottom-right via `width`/`height` reads. Reflows on `scale.on('resize', ...)`. GREEN. | GREEN |
| Ability tiles: `positionStatusTiles(width, height)` | 2235-2266 | `baseX = width - 20 - tileWidth`. Reads width. `tileWidth = 220`, `tileHeight = 42`. Reflows on resize. GREEN positioning, YELLOW tile size. | GREEN (positioning) / YELLOW (size) |
| Quest tracker text | 2315-2330 | `width - 220`, `16`. Reflows on resize. GREEN. | GREEN |
| Player spawn position | 2409-2411 | `this.scale.width / 2, this.scale.height / 2`. GREEN. | GREEN |

**Per-scene summary**: `main.js` is the **biggest WP04 risk** — 4 RED sites (rathauskeller BG, leaderboard, gameOver, levelUp) + the latent legacy HUD risk.

### C. `js/scenes/SettingsScene.js` (710 lines, scanned 160-700)

**Verdict: GREEN.**

Every coordinate derives from `cw, ch, cx, cy`, `px, py`, `panelW = Math.min(720, cw - 40)`, `panelH = Math.min(600, ch - 20)`. The column geometry (`SIDE_PAD`, `COL_GAP`, `COL_W`, `LEFT_C`, `RIGHT_C`, etc.) is all panel-relative. Toggle/slider buttons use `centerX + 80`, `centerX + 110` etc. - all relative to the per-column center.

| Site | Lines | Tag |
|---|---|---|
| Backdrop `add.rectangle(cw/2, ch/2, cw, ch, ...)` | 173 | GREEN |
| Panel `panelW = Math.min(720, cw - 40)`, `panelH = Math.min(600, ch - 20)` | 179-186 | GREEN (adaptive) |
| Column math (`SIDE_PAD`, `COL_W`, `LEFT_C`, `RIGHT_C`) | 200-206 | GREEN |
| All row helpers (`_volumeRow`, `_toggleRow`, `_pickerRow`, `_fullscreenRow`, `_actionRow`, `_tutorialButton`) | 377-639 | GREEN (centerX/panelW relative) |
| Close button | 297-303 | GREEN |
| Toast | 652-655 | GREEN |

**One concern**: button widths `60, 80, 200, 240` and rectangle heights `22, 24, 36` stay world-pixel-sized. At 2x bump the touch targets stay 22x24 world-pixels = small. Still hittable, but **mobile-thumb-fat-finger** test recommended. YELLOW polish, not RED breakage.

### D. `js/scenes/CraftingScene.js` (880 lines, scanned 85-430)

**Verdict: RED-ish (uses canvas dims `W`/`H` directly).**

```js
create() {
  const W = this.scale.width;
  const H = this.scale.height;
  ...
  this.add.rectangle(W / 2, H / 2, W, H, COL_BG).setDepth(0);
  this.add.text(W / 2, 20, 'crafting.title', ...).setOrigin(0.5, 0).setDepth(10);
  this.matText = this.add.text(W / 2, 50, '', ...).setOrigin(0.5, 0).setDepth(10);
  ...
}
```

Good news: positions like `W / 2`, `W - 50`, `H - 60` SCALE correctly because `W = this.scale.width` doubles under WP04.

**However**, between those there's a pile of layout literals that DON'T scale:

| Site | Lines | What | Tag |
|---|---|---|---|
| `leftX = 30`, `panelY = 80`, `panelW = (W/2) - 50`, `panelH = H - 140` | 182-185 | `leftX` is literal-30, others derived from W/H. GREEN-ish. | YELLOW |
| Equipment slot grid: `slotStartY = panelY + 24`, `slotH = 36`, `slotW = panelW`, then `sy = slotStartY + i * (slotH + 4)` | 202-207 | Anchored to `panelY` (derived). GREEN, but row height 36 stays small. | GREEN |
| Inventory list: `this.invListY`, `this.invRowH = 28`, `this.invMaxRows = 3`. Background at `leftX + slotW/2`, `invListY + (invRowH * invMaxRows)/2`. | 247-256 | Anchored to `leftX, slotW` - derived. GREEN. | GREEN |
| Salvage / enhance buttons: `leftX + slotW/2 - 60, enhY + 80` | 290-300 | All derived. GREEN. | GREEN |
| Right panel: `rightX = W/2 + 20`, `rightW = (W/2) - 50` | 303-304 | Derived from W. GREEN. | GREEN |
| Recipes: `recipeStartY = panelY + 30`, `recipeH = 80`, then `ry = recipeStartY + i * (recipeH + 10)` | 310-315 | Anchored. GREEN. | GREEN |
| Forge background: `g.fillRect(0, H * 0.7, W, H * 0.3)` + nested `for (let x = 0; x < W; x += 48)` + `for (let y = H * 0.7; y < H; y += 32)` | 385-420 | W/H-derived. The tile loop step `48`, `32` stays world-pixel-sized so under 2x bump there are 2x as many tiles (more work but visually-OK). The forge glow circles `(W - 80, H * 0.5, 100/60)` and `(W - 80, H * 0.5, 60)` are anchor-by-W/H but radius stays 100/60. YELLOW polish. | GREEN (positioning) / YELLOW (sizing) |
| Feedback text `add.text(W/2, H - 60)` | 351 | GREEN |
| Back button `_createButton(W/2, H - 25, 220, 32, ...)` | 356 | GREEN |
| Flash effect `add.rectangle(W/2, H/2, W, H, ...)` | 860 | GREEN |

**Per-scene summary**: CraftingScene is mostly GREEN - layout positions are W/H-relative. The **risk band** is the dense pile of fontSize `'10px' / '11px' / '12px'` text that stays small. See Text-Sizing-Audit.

### E. `js/hudV2.js` (506 lines, scanned in full)

**Verdict: YELLOW (positioning) - bars + portrait stay world-pixel-sized.**

| Site | Lines | What | Tag |
|---|---|---|---|
| Constants `HP_BAR_W = 220`, `XP_BAR_W = 220`, `PORTRAIT_R = 26`, `ICON_R = 22` | 60-64 | All world-pixel literals. Under 2x bump bars stay 220x18 - the player sees them at the top-left corner at half their previous on-screen size. Still legible. Touch-target-OK (44x44 from rect hit-zone). | YELLOW |
| `_buildTopLeft`: `x0 = 12`, `y0 = 12` literal padding | 117-119 | Anchors to TL corner; GREEN positioning. | GREEN |
| Portrait/HP/XP at `x0 + PORTRAIT_R, hpX, hpY, xpX, xpY` | 122-178 | Derived from x0/y0/constants. GREEN. | GREEN |
| `_buildTopRight`: `cw = scene.cameras.main.width; burgerCx = cw - 12 - ICON_R` | 182-202 | Reads `cw`. GREEN anchoring. | GREEN |
| Burger / inventory icon CDs hardcoded `ICON_R * 2 + 8` spacing between burger and inventory | 202 | World-pixel-relative. Stays same screen-size under 2x bump = smaller on-screen. YELLOW polish. | YELLOW |
| `_buildVignette`: reads `cw, ch`, `Math.hypot(cw, ch) / 2` | 224-260 | GREEN. | GREEN |
| `_openStatsMenu`: `panelW = Math.min(420, cw - 40)`, `panelH = 360`. `panelH` literal at 360 means at 2x bump the panel is 360px = ~38 % of 960-tall canvas. | 338-415 | GREEN positioning, YELLOW sizing. Note `panelH` is NOT adaptive (no `Math.min(360, ch - X)`). On a very small viewport with shrunken canvas the menu can overflow. Worth changing to `Math.min(360, ch - 40)`. | YELLOW |
| `_openMenuOverlay` (burger menu): `panelW = 280`, `panelH = 340` (task prompt's specific concern) | 419-500 | **YELLOW**. Both panel dims are literals, NOT adaptive. At 2x bump the canvas is 1920x960 - the modal is 280 / 1920 = ~15 % of canvas width. Stays centered. Text `fontSize '15px'` etc. stays world-pixel-sized so appears smaller. Buttons `panelW - 40 = 240` x 44 - same story. Still readable, still tap-able (`44px = OK`), but visibly small. **Recommendation**: make adaptive: `panelW = Math.min(560, cw - 40)`, `panelH = Math.min(680, ch - 40)` for the bumped canvas - that doubles the burger menu size to match the doubled canvas. | YELLOW |

**Direct answer to the question in the task prompt** ("panelW=280, panelH=340 im Burger - wird der bei 2x zu klein wirken?"): **Ja, der wird halb so groß wirken**. Phaser fontSize is canvas-space - the `15px` button label stays 15 canvas pixels. The browser then scales the canvas 1:1 to display (instead of 2x scaling 960->1920 like today). So at the displayed-pixel level the text appears the same physical size as today, **BUT** the panel occupies half the visible canvas relative to its surroundings. That's a "feels weirdly small / lonely" UX risk, not a "text is unreadable" risk.

### F. `js/scenes/PrintingHouseScene.js` (531 lines, scanned 75-510)

**Verdict: GREEN.**

| Site | Lines | What | Tag |
|---|---|---|---|
| Backdrop `add.rectangle(cw/2, ch/2, cw, ch, ...)` | 86 | GREEN |
| Panel `panelW = Math.min(900, cw - 40)`, `panelH = Math.min(640, ch - 40)` | 89-94 | GREEN |
| Header titles at `(px, panelTop + 14)` and `(px, panelTop + 40)` | 105-110 | Derived. GREEN |
| Status bar `_renderStatusBar(panelLeft, panelTop + 64, panelW)` then `cellW = (w - sidePad*2)/4` | 113, 167-261 | Cell-relative math. GREEN |
| Edict grid `_renderEdictGrid` - `cardW = (w - colGap * (cols-1)) / cols`, `cardH = Math.min(140, Math.max(90, (gridH - rowGap*(rows-1))/rows))` | 267-295 | Fully derived. GREEN |
| Edict card `_renderEdictCard(e, cx, cy, cardW, cardH, ...)` - tier badge at `(x + w - 14, y + 12)`, etc. | 329-425 | All `(x + ...)`, `(y + ...)` relative to the card. GREEN |
| Action bar `_renderActionBar(left, top + panelH - 56, panelW)` | 134, 428-456 | Bottom-of-panel-relative. GREEN |
| Toast at `(cam.width/2, cam.height - 100)` | 497 | GREEN |

**Per-scene summary**: PrintingHouseScene is the cleanest of all 6 audit targets - **fully derived from `cw/ch/panelW/panelH/cardW/cardH`**. Zero RED sites.

---

## ## RED-Findings (the MUST-fix shortlist)

In severity order:

### R1. `js/main.js:1061` - Rathauskeller background

```js
this.rathauskellerBg = this.add.image(480, 240, 'rathauskeller_bg');
this.rathauskellerBg.setDisplaySize(960, 480);
```

Hardcoded `(480, 240)` is the 960x480 center. Under WP04 the canvas is 1920x960 - new center is `(960, 480)`. `setDisplaySize(960, 480)` keeps it at half the canvas size.

**Fix**: `this.add.image(this.scale.width / 2, this.scale.height / 2, 'rathauskeller_bg')` + `setDisplaySize(this.scale.width, this.scale.height)`.

### R2. `js/main.js:1948, 1951` - GameOver / LevelUp text

```js
gameOverText = this.add.text(400, 300, 'hud.dead', {fontSize: '40px'})
levelUpText = this.add.text(400, 150, 'hud.level_up', {fontSize: '48px'})
```

Both lands in upper-left quadrant under 2x. **Fix**: read `this.scale.width / 2` for X. For levelUp the spec wants it near the top - read `this.scale.height * 0.31` (matches `150 / 480`) so it stays one-third from the top.

### R3. `js/main.js:1810-1830` - Highscores stack on death

```js
scene.add.text(400, 360, 'Highscores', ...)
scene.add.text(400, 400 + i * 22, ...)
scene.add.text(400, 400, 'Fehler beim Laden der Highscores', ...)
```

Three literal `(400, ...)` coords. **Fix**: replace with `scene.scale.width / 2` (X) and `scene.scale.height * 0.75` (Y baseline).

### R4. **Latent** `js/main.js:1907-1953` - Legacy text HUD

If `HUDv2.build` throws (try/catch swallows the throw on line 1937), the legacy `(16, 12)..(16, 144)` text stack stays visible at the top-left. At 2x canvas the corner is still correct, but on a 2x-bumped canvas the text is half the visual size and would look out-of-place AND the `setVisible(false)` block under HUDv2 success means a single uncaught throw in HUDv2 leaves a half-visible / half-textual HUD - not breaking, but ugly.

**Recommendation**: not a WP04 hard-fix, but worth a `try-finally` to mark "legacy HUD active" so devs can see the fallback path was triggered.

---

## ## YELLOW-Findings (visible-small but functional)

These are "half-size on screen at 2x" sites. None break, all stay tappable / readable. Worth a polish pass post-WP04:

1. **`js/hudV2.js` constants** (`HP_BAR_W = 220`, `XP_BAR_W = 220`, `PORTRAIT_R = 26`, `ICON_R = 22`) - bars/portrait stay world-pixel-sized. At 2x the visible size halves.
2. **`js/hudV2.js:419-500` burger menu** `panelW = 280`, `panelH = 340` - both literals, not adaptive. Recommendation: `Math.min(560, cw - 40)` / `Math.min(680, ch - 40)`.
3. **`js/hudV2.js:338-415` stats menu** `panelH = 360` literal - not adaptive on the ch axis. Recommendation: `Math.min(360, ch - 40)` or scale up like burger menu.
4. **`js/mobileControls.js:43-47`** `BASE_RADIUS = 38, CORNER_PAD = 20, GRID_GAP = 12, MIN_HIT_HALF = 22` - same world-pixel story. Mobile already has `__MOBILE_BUTTON_SCALE__` knob (line 64) - bump that to 2.0 at the same time WP04 lands, OR recompute BASE_RADIUS as a function of `scene.scale.width / 24` (current 38 / 960 * 24 = 0.95 ratio).
5. **`js/scenes/HubSceneV2.js:222-247`** mobile interact button: `btnRadius = 38` literal. Same as above.
6. **`js/scenes/HubSceneV2.js:208-216`** mobile joystick: plugin radius `60` + thumb `30` literals. Same.
7. **`js/scenes/HubSceneV2.js:2370-2372`** KT respec confirm `(-200, -80, 400, 160)` panel inside container. Centered correctly but stays 400x160 world-pixels - half-size on a 2x canvas.
8. **All `fontSize: '11px' / '12px' / '13px' / '14px' / '16px' / '18px' / '24px' / '28px'`** text values across all scenes. These are canvas-pixel sizes - they stay constant in canvas-space and therefore visually-shrink relative to the (doubled) canvas. See Text-Sizing-Audit below.

---

## ## Spezial-Check: Mobile-Positioning

`mobileControls.js` is **already safe-area-aware** (`_safeArea()` reads `window.__SAFE_AREA__` from `mobileSafeArea.js`). The cell-anchor math in `_anchorOrigin / _cellCenter` reads:

```js
const padRight = CORNER_PAD + sa.right;
const padBottom = CORNER_PAD + sa.bottom;
const x = screenW - padRight - cs * (col + 0.5);
const y = screenH - padBottom - cs * (row + 0.5);
```

So the grid **stays bottom-right-anchored regardless of canvas dim**. The buttons themselves stay world-pixel-sized at `BASE_RADIUS * scale * 2` = nominal 76px diameter. Under WP04 the canvas doubles - so the buttons occupy half their previous portion of the screen. Player on a phone sees smaller buttons.

**Fix path #1 (mechanical)**: bump `BASE_RADIUS` from 38 to 76 inline with the canvas bump, OR

**Fix path #2 (config-driven)**: set `window.__MOBILE_BUTTON_SCALE__ = 2.0` when `__RENDER_QUALITY__` = `"high"` (already wired in spec FR-05 - this is a one-line connection).

**Resize handler check**: line 312-317 wires `scene.scale.on('resize', ...)` - so a Phaser scale event from WP04 triggers `_positionAll(gs.width, gs.height)`. Positioning re-flows correctly. Only sizing stays wrong without the WP05 config tie-in.

**DPR-aware-resolution + 2x canvas interaction**: this is the critical risk. If WP02 (lever 1, `resolution: window.devicePixelRatio` from `plan.md`) lands first AND WP04 also bumps canvas to 1920x960, then on a 3x-DPR phone the internal render target becomes `1920 * 3 = 5760 x 2880`. That's 16.6M pixels per frame - mobile-FPS-suicide territory. **Mitigation**: WP02 must clamp DPR to 1.0 on mobile when WP04's canvas bump is in effect. This is the implicit "render quality = high" setting; spec FR-05's "Mittel" default should map to (WP02 only, no WP04) so mobile mid-tier is safe by default.

---

## ## Modal-Overlay-Audit

The task prompt asks specifically: "Modals nutzen oft `cw/2, ch/2` - sollte sicher sein, aber Inhalt mit Padding (`panelW=280, panelH=340` im Burger z.B.) - wird der bei 2x zu klein wirken? Oder Text wird scharf, Panel zu klein für den Text?"

**Antwort**: Bei einem 2x-Canvas-Bump und `image-rendering: auto` auf dem Canvas (`index.html:103`) skaliert der Browser das doppelt-große Canvas 1:1 zum displayed-Viewport (statt 2:1 wie heute). Das heißt:

- **fontSize: '15px' im Burger**: bleibt 15 canvas-pixel, wird unter WP04 als **15 displayed-pixel** angezeigt (statt heute 30 displayed-pixel über die CSS-Skalierung). **Text wird visuell halb so groß**.
- **panelW = 280 canvas-pixel**: wird unter WP04 als 280 displayed-pixel angezeigt (statt 560 heute). **Panel wird visuell halb so groß**.
- **Relativ zueinander**: Text + Panel skalieren beide gleich → das Verhältnis bleibt. Text wird NICHT relativ zum Panel größer/kleiner.

Das heißt **das Panel ist nicht "zu klein für den Text"** - es ist alles proportional half-size. Player-Erfahrung: "die Burger-UI ist plötzlich winzig". Nicht broken, nur visuell schwächer.

**Empfohlene Fix-Strategie** für Modal-Inhalt: alle hardcoded `panelW` / `panelH` / fontSize in `hudV2.js` als Funktion vom Canvas-Maß ausdrücken:

```js
// statt: const panelW = 280;
const sw = scene.cameras.main.width;
const scale = sw / 960;  // 1.0 vor WP04, 2.0 nach WP04
const panelW = 280 * scale;
const fontSize = `${Math.round(15 * scale)}px`;
```

ODER (cleaner) - im Settings-Toggle (WP05) einen globalen `__UI_SCALE__` flag setzen, der von WP04's canvas-bump-decision abgeleitet wird, und alle Konstanten in `hudV2.js + mobileControls.js + main.js` durch diesen Flag multiplizieren.

---

## ## Text-Sizing-Audit

Phaser 3.70 Text-rendering: `fontSize: '16px'` → rasterisiert auf canvas-pixel. Bei 960×480 Canvas + 2× Browser-Stretch heute: 16 canvas-pixel = **32 displayed-pixel** auf 1080p Desktop.

Bei WP04 (1920×960 Canvas + 1:1 Browser-Stretch): 16 canvas-pixel = **16 displayed-pixel** auf 1080p Desktop = **halb so groß**.

**Workaround heute**: viele Text-Calls in `HubSceneV2.js` setzen `resolution: 2` (z.B. KnowledgeTree: line 2135, 2144, 2259, 2267, 2276, 2287). Das macht den Text bei 2× scharf, aber NICHT größer. Unter WP04 ist `resolution: 2` redundant (das Canvas IST schon 2× was Phaser scharf rastert).

**Empfehlung**:

1. WP04 lässt `fontSize` Strings unangetastet → Text wird visuell kleiner aber schärfer (entspricht dem Feature-Ziel: schärfer rendern).
2. Wenn das visuell zu klein wirkt im Playtesting → globalen Text-Scale-Faktor einführen (siehe Modal-Overlay-Audit), ODER alle fontSize-Werte verdoppeln (mechanisch).
3. `resolution: 2` overrides können nach WP04 entfernt werden (Phase 5 cleanup) — sie kosten 4x Text-RAM ohne Nutzen wenn das Canvas schon 2× rendert.

---

## ## Empfohlene Fix-Strategie

**Drei Optionen, vom least-invasive zum cleanest:**

### Option A — "Punkt-für-Punkt RED fixen" (recommended for WP04 first ship)

1. Fix R1 (rathauskeller BG) - 2 line edit
2. Fix R2 (gameOver + levelUp text) - 2 line edit
3. Fix R3 (highscores stack) - 3 line edit
4. Leave YELLOWS as-is, document in PR description for post-WP04 polish
5. Pre-WP04 acceptance: drive death + level-up + start-rathauskeller and visually confirm centered

**Effort**: 30 min. **Risk**: low. **Caveat**: leaves visual "half-size HUD" feeling that may require WP04.5 polish.

### Option B — "Einheitlicher `__UI_SCALE__` flag" (recommended for WP04 + WP05 combined)

1. Introduce `window.__UI_SCALE__` (default 1.0) in `main.js` BEFORE scene start
2. WP04: when canvas-bump is active, set `__UI_SCALE__ = 2.0`
3. `hudV2.js + mobileControls.js + main.js + HubSceneV2.js` constants get multiplied through a helper `S(n) => n * (window.__UI_SCALE__ || 1)`
4. fontSize strings: helper `SF(n) => Math.round(n * (window.__UI_SCALE__ || 1)) + 'px'`
5. Fix R1-R3 mechanically while doing the find/replace pass

**Effort**: 2-3 hours (most of it is mechanical text-replace). **Risk**: medium - touching many files at once. **Caveat**: requires WP05 settings toggle ready to flip the flag back to 1.0 on "low" mode.

### Option C — "Phaser `cameras.main.setZoom`" (NOT recommended)

In theory: keep canvas at 960×480, set `camera.setZoom(2)` and let the world render at 2× internally. Problem: `setZoom` ALSO scales scroll-factor-0 UI elements - the HUDv2 portrait would scale to 2× and the burger menu would too, but they wouldn't reposition. Spec C-04 already enumerates the broken assumption. **Skip this option** unless WP04 is going to be redesigned around it.

---

## ## Test-Plan post-WP04

Manual smoke once WP04 lands (in this order, ~15 min):

1. **Start → MainMenu**: highscores stack rendered (death not yet triggered - but `loadScores` runs in start scene too, scan for the call site). Confirm visual position.
2. **Start → Hub → Walk to NPC → Open dialog**: dialog centered, hint text bottom-centered, choice buttons centered. → `HubSceneV2._showDialoguePages`.
3. **Hub → Talk to Mara → Open Knowledge Tree (K)**: modal centered, cards in 2-col grid centered, +button hit-test works. → `HubSceneV2._ktRenderCards`.
4. **Hub → Walk to Rathauskeller entrance → Open wave-select**: modal centered, +/- buttons land within the modal, BG-checkbox toggles. → `HubSceneV2._openWaveSelectDialog`.
5. **Hub → Settings (open from burger menu)**: SettingsScene 2-col layout fits, audio sliders work, close button hittable.
6. **Hub → Druckerei → PrintingHouseScene**: status bar 4 cells, edict grid renders, action bar buttons hittable.
7. **Hub → CraftingScene (forge entrance)**: title centered, equipment slots + inventory list + recipes columns laid out, back button at bottom.
8. **Hub → Start dungeon → enter combat → die**: gameOverText centered AT THE MIDDLE of the canvas (R2 fix), highscores stack below it (R3 fix), restart-loop works.
9. **Hub → Start dungeon with USE_RATHAUSKELLER_BG = true → confirm BG covers full canvas** (R1 fix).
10. **In dungeon → level up**: levelUpText shows centered horizontally, near the top (R2 fix).
11. **In dungeon → open burger menu → check the 4 menu items**: panel centered, buttons tap-able. (YELLOW issue 2.)
12. **In dungeon → open inventory icon (top-right of HUD)**: inventory panel centered, slots align.
13. **Mobile (touch device) — joystick + skill buttons + interact button**: all 4 corners of the bottom panel, hit-tests pass, joystick tracks dragged finger. (YELLOW issues 4-6.)
14. **Mobile — open dialog → tap a choice button**: choice button responds (scroll-factor recursion preserved; the `_ktPropagateScrollFactor` helper from project memory `phaser_scrollfactor_dialogs.md`).

For each step: take a screenshot if available, eyeball-compare to pre-WP04 canvas.

**Automated check**: confirm `tools/runTests.js` still passes (SC-04 from spec.md - 251 tests must stay green).

**FPS check**: run `window.PerformanceMonitor` overlay (already wired in burger menu's "FPS Overlay" item per `hudV2.js:449-456`) and confirm:
- Desktop hub idle: ≥58fps
- Desktop combat (5+ enemies): ≥58fps
- Mobile (if available): hub idle ≥55fps, combat ≥50fps

If mobile drops below 55fps → revert WP04 per plan.md Phase 3 gate.

---

## ## Open question for the WP04 implementor

- **`SCALE_FACTOR = 1536 / 960` in `HubSceneV2.js:85`**: this hub-world-to-canvas scale factor is independent of WP04's canvas bump (the hub world stays 1536×1024). After WP04 the canvas is 1920×960, so the hub world is now **smaller than the canvas in X dim** (1536 < 1920). The camera bounds at `(0, 0, 1536, 1024)` and player spawn at `(W/2, H * 0.65) = (768, 665)` are world coords - they're fine. But the camera viewport widens beyond hub bounds. Verify Phaser doesn't render anything outside the hub world (background should still tile correctly because it's `setOrigin(0, 0)` at world `(0, 0)`).
- **`HubSceneV2.js:115`** `const W = 1536, H = 1024` - this is the hub WORLD size, NOT the canvas size. The canvas bump does NOT change this. The hub world stays 1536×1024 (smaller than the 1920×960 canvas in X, larger in Y). Camera follows player; deadzone is 15% of camera.width/height; should still work but worth a visual check that the player can scroll/explore the hub edges correctly.
- **Inventory UI position** (`js/inventory.js:417`): `scene.add.container(scene.scale.width / 2, scene.scale.height / 2)` - GREEN. Panel internals at `-PANEL_W/2 + 20` etc. - GREEN. Inventory passes.
- **MinimapRT** (`js/minimap.js:10-20`): reads `scene.scale.width` then `SCREEN_W - MAP_W - RIGHT_MARGIN`. Anchored top-right. **YELLOW**: MAP_W = 160, MAP_H = 120 stay world-pixel, look half-size at 2x. Not blocker.
- **Loadout overlay** (`js/loadoutOverlay.js`): `(cw/2, ch/2)` centered, container-relative children. GREEN.

---

## Confidence statement

I scanned the 6 audit targets enumerated in spec.md C-04 **plus** the 3 secondary consumers reachable from the canvas-bump blast radius (mobileControls, mobileSafeArea, hudV2, minimap, inventory, loadoutOverlay, index.html). I did NOT exhaustively scan `js/main.js` line-by-line (2522 lines) - I targeted the HUD/UI/modal bands identified in the task prompt plus a grep-driven search for hardcoded literals. The 4 RED + 8 YELLOW findings above are what surfaced from that scan. There is a small residual risk of missing a niche HUD overlay buried in a `js/main.js` band I didn't read (e.g. tutorial overlay positioning, mobile-specific D2 controls overlay) - but neither is enumerated in the C-04 audit list. Worth a final pass through `js/tutorialSystem.js` + `js/scenes/tutorialOverlay.js` + `js/mobileAbilityButtons.js` if WP04 wants to be exhaustive before merge.
