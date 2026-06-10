# Phaser 3.70 `scale.resolution` — Research for WP02

**Feature**: 052 — Render Resolution Quality
**WP**: WP02 — set `resolution: window.devicePixelRatio` in the Phaser scale config (FR-02, R-04)
**Date**: 2026-06-10 (revised same day)
**Status**: Research only — no code changed. Implementor reads this, then ships.

---

## REVISION 2026-06-10 — §5.2 pattern is BROKEN, not subtle

> **READ THIS FIRST. Everything below §1 in the original doc is still factually correct about `scale.resolution` being dead. But the §5.2 / §9 "minimal safe patch" is *also* broken — for a totally different reason. Both the dead `resolution` key AND the `width×DPR + zoom=1/DPR` workaround fail on Phaser 3.70 in FIT mode, for the reasons documented below. Skip to §10 for the only pattern that actually does what FR-02 wants. Skip to §11 for the honest assessment of why this WP is harder than the spec assumed.**

### Bug report
The §5.2 pattern (`width: 960*DPR, height: 480*DPR, zoom: 1/DPR, mode: FIT`) was shipped to a DPR=1.5 dev device. **Observed**: the procedural dungeon rendered "zoomed out" — sprites clustered in the upper-left quadrant of a 1440×720 viewport with empty space around them. The dungeon-layout generator had clearly produced obstacle/floor coords as if the world was 960×480, but the camera was rendering a 1440×720 region with the (960,480) point in the middle of the visible area, not at the right edge.

That is the **exact** failure mode you'd expect if `gameSize` (the world-coord space the cameras render) had been DPR-multiplied, not just the backing buffer. Which is exactly what happened — confirmed by direct ScaleManager source-read (see below).

### Root cause — what the §5.2 pattern actually does in 3.70

Verified by direct read of `src/scale/ScaleManager.js` from the v3.70.0 tag at `https://raw.githubusercontent.com/phaserjs/phaser/v3.70.0/src/scale/ScaleManager.js` (1783 lines, downloaded 2026-06-10):

| Property | Where it's set | Value with `{width:1920, height:960, zoom:0.5}` | What it controls |
|---|---|---|---|
| `gameSize.width` | `parseConfig()` line 551: `this.gameSize.setSize(width, height)` | **1920** (raw width, NOT divided by zoom) | World bounds; **camera projection size**; what `this.scale.width` returns. |
| `baseSize.width` | `parseConfig()` line 566: `this.baseSize.setSize(width, height)` | **1920** | The canvas backing-buffer attribute (`canvas.width`). |
| `displaySize.width` | `parseConfig()` line 586: `this.displaySize.setSize(width, height)` | **1920** | The basis for CSS `style.width` (FIT-scaled to parent). |
| `this.zoom` | `parseConfig()` line 558: `this.zoom = zoom` | **0.5** | **In FIT mode: literally never read by `updateScale()`. Zoom is honored only in NONE mode** (line 1005-1008) and in `resize()` (line 851/858) which we don't call. |

And from `src/core/CreateRenderer.js`:
```js
var width = baseSize.width;     // 1920
var height = baseSize.height;   // 960
game.canvas = CanvasPool.create(game, width, height, config.renderType);
```
→ canvas backing buffer = 1920×960. ✓ (what we wanted)

But then `WebGLRenderer.boot()` does:
```js
game.scale.on(ScaleEvents.RESIZE, this.onResize, this);
// onResize: resize(baseSize.width, baseSize.height) → setProjectionMatrix(1920, 960)
//                                                  → gl.viewport(0, 0, 1920, 960)
```
And `setProjectionMatrix(1920, 960)`:
```js
this.projectionMatrix.ortho(0, width, height, 0, -1000, 1000);
// → projection space is [0..1920] × [0..960]
```

**Result**: WebGL's clip-space maps to a 1920×960 world. Every camera by default uses `this.scene.cameras.main` with viewport=`(0,0, scale.width, scale.height)` = `(0,0,1920,960)`. A sprite at world (480, 240) projects to (480, 240) in a 1920×960 space → upper-left quadrant. Exactly the observed bug.

`scale.zoom = 0.5` does **nothing** in FIT mode because:
- `parseConfig()` stores it on `this.zoom` (line 558) and that's it.
- `updateScale()`'s FIT branch (lines 1050-1066) never reads `this.zoom` — only `gameSize` → `displaySize` (CSS-only).
- `resize()` would honor zoom (line 851: `displaySize.setSize(width*zoom, height*zoom)`) but FIT mode never calls `resize()` — it calls `refresh()` → `updateScale()`.

So §5.2 was wrong on a load-bearing claim: **"World coords stay 960×480, only backing-buffer grows"** is false. World coords DO grow with `scale.width` because `gameSize` IS `scale.width`. The §5.2 zoom division is a no-op in FIT mode.

### Why §5.2 passed the §6.1 "DevTools backing buffer" check anyway
The §6.1 verification (`Phaser.GAMES[0].canvas.width === 1920`) passes correctly — the backing buffer IS 1920×960. That's misleading, because the world ALSO became 1920×960. Both grew together. The check was insufficient — it should have ALSO verified `Phaser.GAMES[0].scale.width === 960` (which would have caught this).

### Where the supernapie / Quinten / Discourse pattern actually works
The community pattern that §5.2 was modeled on uses `scale.mode: Phaser.Scale.NONE` (verified by reading Quinten's `phaser3-retina/src/index.js` directly, and the supernapie blog post). In NONE mode, `updateScale()` lines 1005-1025 DO honor zoom — but only for the CSS `style.width/height`, NOT for `gameSize` either. In all those community examples, **`gameSize` is intentionally set to `innerWidth*DPR`** because those are full-viewport games that WANT the world to scale with screen size. None of them have a fixed-aspect logical world like ours.

→ The pattern does not apply to our use case. There is no Phaser-config-only path in 3.70 that gives backing-buffer=1920×960 AND world-coords=960×480 simultaneously.

---

## TL;DR for the implementor

**The single most important finding**: `scale.resolution` is a **no-op** in Phaser 3.70. The Spec's FR-02 assumption ("`resolution: window.devicePixelRatio` is the smallest of the three quality levers") is **wrong as written** — the property the spec names does not exist on the Scale Manager in 3.70. It was a config key on older Phaser 3 (≤ 3.15) versions, regressed in 3.16 (Phaser-issue #4417, never fixed), and quietly removed from the ScaleManager class entirely some time before 3.50. In 3.70 the ScaleManager source contains **zero** references to `resolution`, `pixelRatio`, or `devicePixelRatio`.

That means WP02, taken literally ("just add `resolution: window.devicePixelRatio` to `scale` config"), has **no behavioural effect at all** — the canvas still rasterises at 960×480 internal, the browser still stretches it to the viewport, and DPR-aware crispness does not materialise. This needs to be reframed before WP02 is shipped.

The two viable replacements, both compatible with the spec's R-04 ("Phaser-version-dependent quirks — mitigation: lock to verified-working approach"), are:

1. **DOM-level CSS `image-rendering` tweak** (already covered by `index.html`'s `image-rendering: auto`). **Zero additional code.** This is what `main.js:80-84` describes today and is the lowest-risk lever to leave alone.
2. **Multiply `scale.width` / `scale.height` by `window.devicePixelRatio` AND `scale.zoom = 1/DPR`** — this is the community-converged pattern for DPR-aware sharp rendering in Phaser 3.16+. Functionally equivalent to what the dead `resolution` key was supposed to do. **This is what WP02 should ship instead.**

The "minimal safe patch" at the bottom of this doc implements option 2 with a DPR cap of 2, an `undefined` fallback, and a feature-flag gate so WP04 can opt in/out per quality preset.

---

## 1. What `scale.resolution` does in Phaser 3.70 — empirical answer

### 1.1 The CDN-shipped 3.70 source has zero ScaleManager / Config code paths that read `resolution`

Pulled directly from `https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.js` (the exact CDN URL pinned in `index.html:11`).

| What we searched | Where | Result |
|---|---|---|
| `this.resolution` | whole bundle | **3 hits**: `TextStyle.resolution` (per-Text setting, default 0), `TextStyle.setResolution()` setter, `TextureSource.resolution` (per-source, default 1). **None on ScaleManager / Config.** |
| `scale.resolution`, `ScaleManager.*resolution`, `config.resolution`, `GetValue(...'resolution'...)` | whole bundle | **0 hits.** |
| ScaleManager class body (decl. ~line 191244, runs to ~194000 in 3.70 bundle) | scanned for `resolution`, `pixelRatio`, `devicePixelRatio`, `dpr` | **0 hits.** The class manages `gameSize`, `baseSize`, `displaySize`, `parentSize`, `zoom`, `displayScale`, `scaleMode`, `autoCenter`, `autoRound` — and that's it. |
| `devicePixelRatio` | whole bundle | **1 hit**, at the OS-detection layer: `OS.pixelRatio = window['devicePixelRatio'] \|\| 1;` — this only populates `Phaser.Device.OS.pixelRatio` for inspection. It is **never** read by the renderer or ScaleManager to size the canvas. |

Verified: line numbers 24614, 83003, 83531, 213959 in the unminified 3.70 bundle.

### 1.2 What this means concretely

- Canvas pixel ratio: **not affected** by any `scale.resolution` value you pass. The canvas's `width`/`height` attributes come from `scale.width` × `scale.zoom`. The CSS size comes from the scale mode (FIT / RESIZE / etc.).
- WebGL texture sampling: **not affected**. Filter mode is determined per-texture (NEAREST when `pixelArt: true`; LINEAR via per-texture override or when `pixelArt: false`).
- Game-world coordinates: **not affected**. World coords are always in the 960×480 logical space we configure; cameras zoom them onto the canvas independently.
- Default value of `scale.resolution` in 3.70: **does not exist**. Setting it adds an inert property to the `scale` config object that nothing consumes.

### 1.3 The historical arc, briefly

- Phaser 3.0–3.15: `Config.resolution` existed and the WebGL/Canvas renderers honoured it. Game canvas backing-buffer was multiplied by it; CSS size stayed at logical. The "correct" DPR pattern was `resolution: window.devicePixelRatio`.
- Phaser 3.16: ScaleManager was introduced. The renderers were rewired to read width/height/resolution from the ScaleManager rather than the Game Config. This regressed `resolution` — reported as photonstorm/phaser issue #4417 ("Resolution does not work"). Never properly fixed.
- Phaser 3.50–3.60: silent removal. The property continued to be in some older docs and examples but is gone from the live API.
- Phaser 3.70 (our pinned version): **the property is fully absent**. Not deprecated-with-warning — just absent. No console warning when you set it. It silently becomes dead config.
- Phaser 4 (post-3.88 rewrite): `ScaleManager` API documents at `docs.phaser.io/api-documentation/class/scale-scalemanager` still show no `resolution` property. The story did not change.

---

## 2. Known quirks specific to 3.70

Cross-referenced against the official 3.70 changelog (`github.com/phaserjs/phaser/blob/master/changelog/3.70/CHANGELOG-v3.70.md`):

- **`roundPixels` default flipped to `true` globally in 3.70**. We already set it explicitly (`main.js:86, 90`), so no change for us — but worth knowing if WP02 needs to touch this neighbourhood. The 3.70 release notes specifically call this out as enabling smoother camera scrolling at non-integer offsets.
- **All core vertex shaders gained `uRoundPixels` uniform in 3.70**. Pixel-rounding happens on the GPU now, not the CPU. Saves cycles in our procedural-dungeon hot path. Relevant for the WP04 FPS measurement at higher canvas sizes — this is partly *why* we have headroom to push the canvas resolution at all.
- **`resolution` is not mentioned in the 3.70 changelog**. It is not added, not deprecated, not removed in 3.70. It simply isn't there. Consistent with our source-grep finding.
- **NineSlice / Scale9 work was added in 3.70**, unrelated to our scope.

**No 3.70-specific quirks block WP02** — but the spec's named approach doesn't apply.

---

## 3. Interaction with `pixelArt: true`

Reading the 3.70 source (`main.js:80-85` comment is accurate but slightly outdated wording-wise):

```javascript
// From phaser@3.70.0/dist/phaser.js line ~16205
this.pixelArt = GetValue(renderConfig, 'pixelArt', this.zoom !== 1, config);

if (this.pixelArt)
{
    this.antialias = false;
    this.antialiasGL = false;
    this.roundPixels = true;
}
```

So `pixelArt: true` is purely a derived setting: it forces `antialias=false`, `antialiasGL=false`, `roundPixels=true`, and the texture loader uses NEAREST filter by default. That's the entire mechanism.

Because the dead `scale.resolution` key is never read, the question "what happens with `pixelArt: true` and `resolution: 2`" reduces to "what happens with `pixelArt: true`" — i.e. **nothing changes**, no new failure mode. Procedural textures keep working exactly as today. TileSprites keep working exactly as today.

**If WP02 takes the working path (option 2 above — multiply width/height by DPR, divide zoom by DPR), the interaction with `pixelArt: true` is different**:
- The canvas backing-buffer becomes DPR×960 by DPR×480 (e.g. 1920×960 on a DPR=2 device).
- The 960×480 logical world is rendered into that buffer via a `zoom = 1/DPR` camera-effective scaling.
- `pixelArt: true` continues to set NEAREST on procedural textures → each logical pixel becomes a 2×2 block of identical canvas pixels. **No checkerboarding, no half-pixel rounding artefacts**, because `roundPixels: true` is still in force.
- TileSprites: Phaser TileSprites in 3.70 render via the MultiPipeline with the same NEAREST filter when `pixelArt: true`. With the DPR-multiplied canvas, the tile pattern still aligns to logical pixels — *the tile won't shimmer or seam* as long as the camera position is integer-rounded (`roundPixels: true` guarantees this).
- Procedural `graphics.generateTexture(...)` outputs: also unaffected. The generator draws into an offscreen canvas at the logical (post-zoom-out) size, then the texture is sampled at NEAREST onto the DPR-multiplied backing buffer. The 2×2 sample is exactly what we want.

**Sanity check on the spec's R-04 concern**: yes, the DPR-multiplied path is safe with `pixelArt: true`. No proc-dungeon regression risk from option 2 alone.

---

## 4. Mobile-specific risks

### 4.1 GPU fragment-shader load scales quadratically with DPR

| DPR | Canvas backing | Pixels rendered per frame (vs DPR=1) |
|-----|---|---|
| 1 (most desktops, older Android) | 960 × 480 = 460 800 | 1.0× |
| 2 (most modern smartphones, Retina) | 1920 × 960 = 1 843 200 | 4.0× |
| 3 (Pixel 7 Pro, iPhone 14 Pro etc.) | 2880 × 1440 = 4 147 200 | 9.0× |
| 4 (Galaxy Fold-class, rare) | 3840 × 1920 = 7 372 800 | 16.0× |

**Mobile reality**: most affordable Pixel/Galaxy/iPhone devices report DPR=2 or DPR=3. Mid-tier Android (the NFR-01 target — Pixel 4 class) usually 2.625 or 2.75 — these are passed verbatim by `window.devicePixelRatio` and Phaser will multiply the canvas to fractional resolution if you don't cap.

**Cap recommendation**: clamp DPR at 2 for the first WP02 ship. This is the industry-standard safe choice — sharp visible improvement, manageable GPU cost, no fragment-shader cliff on DPR=3 phones. Spec NFR-03 (<+50 MB memory) is comfortably satisfied at DPR=2 (estimate ~14 MB additional VRAM for the larger backbuffer + procedural texture re-bake).

### 4.2 Memory overhead

The dominant cost is the **canvas backbuffer**. At DPR=2: `1920 × 960 × 4 bytes (RGBA) = 7.4 MB`. WebGL double-buffering adds another ~7 MB. Procedural runtime textures don't grow because they're drawn at logical size and sampled up — they stay at their current memory footprint.

Per-texture LINEAR-filtered uploads (the WP03 inventory) don't grow either; filter mode is a sampler state, not a memory multiplier.

**Bottom line for NFR-03**: well within the +50 MB budget.

### 4.3 Mobile pipeline auto-detection

`main.js` doesn't override `autoMobilePipeline` — Phaser defaults to `true`, which means iOS / Android auto-switch to the SinglePipeline shader. This was specifically optimised for the cheap-mobile-GPU path in 3.60+. It interacts fine with the DPR-multiplied canvas — confirmed via Phaser 3.70 changelog: `uRoundPixels` is in the MobilePipeline shader too.

---

## 5. Concrete code recommendation for WP02

### 5.1 What WP02 should NOT do

```javascript
// DO NOT SHIP — does nothing in Phaser 3.70:
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 960,
  height: 480,
  zoom: 1,
  resolution: window.devicePixelRatio   // <-- DEAD KEY, NO EFFECT
}
```

If you ship that, the canvas stays 960×480 internal, sprites still look soft on Retina, and the spec FR-02 acceptance criterion ("after feature: sprites sharper") fails subjectively without any console error to tell you why.

### 5.2 What WP02 should ship — the minimal sufficient patch

> **BROKEN — see "REVISION 2026-06-10" at the top of this document.** This pattern was shipped and failed: `scale.zoom` is a no-op in FIT mode (verified by ScaleManager source-read), so the camera projection grew to 1920×960 along with the backing buffer, and the dungeon rendered as if the world had been scaled up. The §6.1 verification was insufficient — it only checked the backing buffer, not `this.scale.width` (which would have caught the gameSize growth). Use §10 instead.

```javascript
// js/main.js — replace the `scale` block at line 91-99 with this.
// 
// In Phaser 3.70 the legacy `scale.resolution` key is a no-op (the property
// was effectively removed when the ScaleManager was introduced in 3.16 and
// never reinstated — see kitty-specs/052/research/phaser-resolution-config.md
// section 1). The working DPR-aware pattern is to multiply the canvas
// backing-buffer by DPR and divide the zoom by DPR so world coords stay 
// unchanged.

// --- DPR detection with safe fallback (Spec Edge Case 8.4 — iframe) -------
const RAW_DPR = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number')
  ? window.devicePixelRatio
  : 1;
// Cap at 2 for the WP02 ship — DPR=3 phones go quadratic on fragment shader
// load (4147200 px/frame). WP05 can lift this for the "Hoch" preset once
// mobile FPS is measured (NFR-01).
const DPR = Math.max(1, Math.min(RAW_DPR, 2));

// --- Phaser scale config --------------------------------------------------
scale: {
  mode: Phaser.Scale.FIT,                  // unchanged — FIT is correct
  autoCenter: Phaser.Scale.CENTER_BOTH,    // unchanged
  // Backing buffer is DPR-multiplied. Browser DOWN-samples this to the CSS
  // display size, which is what produces the perceived sharpness.
  width: 960 * DPR,
  height: 480 * DPR,
  // Zoom compensates so the world is still 960×480 in logical units —
  // every existing camera, every existing sprite position, every existing
  // UI coord stays valid.
  zoom: 1 / DPR
},
```

Surface the effective DPR globally for diagnostics & later WP05 quality presets:

```javascript
// Right after the const definitions above:
if (typeof window !== 'undefined') {
  window.__RENDER_DPR__ = DPR;   // for SettingsScene preview + perf overlay
}
```

### 5.3 Should `scale.mode` change?

**No**. `Phaser.Scale.FIT` is the correct mode for a fixed-aspect game. It will scale the (now DPR-multiplied) canvas down to the viewport while preserving the 2:1 aspect ratio. The DPR multiplier acts orthogonally to the FIT scaling — FIT measures CSS pixels, while the multiplier acts on backing-buffer pixels. They compose correctly.

If we ever wanted to mirror the canvas to fill arbitrary aspect ratios (mobile portrait, ultra-wide), we'd switch to `RESIZE` — but that's a separate spec, not WP02.

### 5.4 Hardcoded `DPR` vs runtime preset

For the WP02 ship: hardcoded `Math.min(window.devicePixelRatio, 2)`. **Do not** make it runtime-mutable from SettingsScene in WP02 — Phaser does not support changing the canvas backbuffer size at runtime cleanly (textures bound to the GL context would need rebinding). WP05 (the SettingsScene "Render-Qualität" toggle, FR-05) will handle this by reloading the page on toggle, which is the spec-sanctioned escape hatch per C-06.

### 5.5 Iframe / undefined-DPR fallback

Already covered above: `typeof window.devicePixelRatio === 'number'` check. Falls back to DPR=1 (current behaviour) if the property is missing or non-numeric. This satisfies spec edge case 8.4 ("Game launches in iframe").

---

## 6. Verification strategy

### 6.1 Browser DevTools checks (post-change, dev environment)

| Check | How to do it | Expected pre-WP02 | Expected post-WP02 |
|---|---|---|---|
| Canvas backing-buffer size | DevTools Elements → inspect `<canvas>` → check `width` / `height` *attributes* (not CSS) | `width="960" height="480"` | `width="1920" height="960"` on a DPR=2 display; `width="960" height="480"` on a DPR=1 display |
| CSS rendered size | Same canvas, check Computed Styles → width/height | depends on viewport (FIT-letterboxed) | **identical to pre-WP02** — FIT mode unchanged |
| WebGL drawing-buffer | DevTools Console: `Phaser.GAMES[0].canvas.getContext('webgl').drawingBufferWidth` | `960` | `1920` (DPR=2) |
| Procedural floor texture sample | Console: `Phaser.GAMES[0].textures.get('floor_proc').getSourceImage().width` (key may differ — check `js/proceduralRooms.js`) | unchanged | **unchanged** — proc textures are drawn at logical size and sampled at NEAREST |
| Per-texture filter mode survives | Console: `Phaser.GAMES[0].textures.get('hub_bg_01').source[0].source.minFilter` | `9728` (NEAREST) for unconfigured, `9729` (LINEAR) for ones in the WP03 allow-list | **identical** — `pixelArt: true` still defaults to NEAREST; WP03 LINEAR overrides survive untouched |

### 6.2 Visual smoke tests (manual playtest)

1. Launch on a DPR=2 display (any Retina MacBook / Pixel-class Android in DevTools device emulation).
2. Hub: NPC portraits should look distinctly sharper. The hub background (`hub_bg_01`) should show no new artefacts vs pre-WP02. Mobile control overlay buttons should remain crisp (they're DOM elements — DPR-handled by the browser independently).
3. Procedural dungeon: enter via Q1 first room. Verify floor tiles, wall tiles, obstacle textures all render. **No checkerboarding, no missing frames, no transparent quads**. This is the FR-07 / C-01 acceptance — if anything visually breaks here, REVERT.
4. Combat: a few enemy hits, projectile rendering, particle effects. Verify no GPU-stutter / frame drops.
5. UI scenes: open CraftingScene, SettingsScene, PrintingHouseScene. All buttons sized correctly, modals position correctly.

### 6.3 FPS measurement

`js/performanceMonitor.js` already exists (per spec §12 / assumption 10.4). Spot-check it now — confirm it surfaces an FPS counter. Run a 60-second combat scenario pre-WP02 and post-WP02 on the same device:
- Desktop 1080p: target **≥60 FPS** before AND after (NFR-02).
- Mobile mid-tier (Pixel-4-class, real device or emulated): target **≥55 FPS** before AND after (NFR-01). The capped `Math.min(DPR, 2)` is specifically chosen to keep this safe.

If mobile drops below 55 FPS with DPR=2: cap at DPR=1.5 instead (treat as a tuning knob), document the measurement, ship the lower cap. Don't ship and pray.

### 6.4 Impact on the existing 251 tests

**Zero**. Confirmed by inspection:

- `tests/setup.js` stubs only `window` (empty object), `localStorage`, `console`. It does NOT load Phaser, does NOT call `new Phaser.Game(...)`, does NOT touch `main.js`.
- The 13 test files (`abilitySystem.test.js` through `tutorialSystem.test.js`) exercise game logic systems (quests, factions, loot, abilities, rooms, etc.) under Node, not the rendering layer.
- `main.js` is never `require`'d by the test suite — it's the browser entry point only.

**Therefore SC-04 ("All 251 existing tests still green") is automatically satisfied** by any change confined to the `scale` block in `main.js`. No new tests required by WP02. WP04 (FPS measurement) will add manual measurement notes, not unit tests.

### 6.5 Regression checkpoints (the spec's SC-07 "no regression in 050/051 flows")

Run a 10-minute sanity loop after WP02 lands:
- Start → name entry → hub.
- Q1 → Q2 → Q3 → Q4 → Q5 (the cellar Elara encounter — recent fix `a33a7bb`).
- Open Crafting, buy something. Open Settings. Visit PrintingHouse.
- Enter the dungeon (any quest that triggers it). Clear 3 rooms.
- Death + revive flow if you have time.

Every one of these must work identically to pre-WP02. If anything misbehaves, the cause is *not* the DPR multiplication (it changes only the backbuffer size) — investigate as a separate regression and revert WP02 to unblock.

---

## 7. Spec implications (for the spec maintainer, not WP02 implementor)

The spec text (`spec.md` §1 lever 2, §4 FR-02, §10 assumption 10.1, §13 R-04) frames WP02 as "use Phaser's scale `resolution`". That phrasing should be updated post-WP02 to "DPR-multiplied scale.width/height with compensating zoom" — the actual shipped mechanism. The acceptance criteria (FR-02 verification = "full Q1-Q6 chain + 3 procedural-dungeon rooms") stay valid as written; only the *how* changes.

R-04 (Phaser-version quirks) is **fully validated** by this research: there IS a quirk, it's load-bearing, and the workaround in §5.2 of this doc is the verified-working approach the risk mitigation calls for.

---

## 8. Sources

Primary sources, all verified by direct fetch on 2026-06-10:

- Phaser 3.70.0 bundle (the exact CDN the project loads at `index.html:11`): `https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.js` — searched for `resolution`, `pixelRatio`, `devicePixelRatio`, `ScaleManager`. Findings reported by line number in §1.1 above.
- Phaser 3.70 changelog: `https://github.com/phaserjs/phaser/blob/master/changelog/3.70/CHANGELOG-v3.70.md` — confirms `roundPixels` default flip and `uRoundPixels` shader uniform; no mention of `resolution`.
- Current Phaser ScaleManager API docs: `https://docs.phaser.io/api-documentation/class/scale-scalemanager` — no `resolution` property documented.
- GitHub issue #4417 ("Resolution does not work"): `https://github.com/phaserjs/phaser/issues/4417` — the 3.16 regression report; never resolved.
- Phaser Discourse "Help! Resizing a game with dpr": `https://phaser.discourse.group/t/help-resizing-a-game-with-dpr-device-pixel-ratio/3242` — community-consensus pattern (multiply width/height by DPR, divide zoom by DPR). Source for the §5.2 patch shape.
- Supernapie "Support retina with Phaser 3": `https://supernapie.com/blog/support-retina-with-phaser-3/` — second-source confirmation of the DPR-multiplied + inverse-zoom pattern.
- Josh Morony "How to scale a game for all device sizes in Phaser 3": `https://www.joshmorony.com/how-to-scale-a-game-for-all-device-sizes-in-phaser/` — corroborates `setRoundPixels(true)` + integer camera positions for sharp pixel art.

Project sources reviewed:

- `js/main.js:80-99` — current Phaser config, the WP02 patch target.
- `index.html:11` — the exact Phaser CDN URL pinned (`phaser@3.70.0/dist/phaser.js`).
- `kitty-specs/052-render-resolution-quality/spec.md` — FR-02, FR-07, NFR-01..04, C-01, R-04, SC-04.
- `kitty-specs/052-render-resolution-quality/research/linear-filter-inventory.md` — adjacent WP03 research; confirms the per-texture LINEAR pattern is independent of and compatible with the DPR change.
- `tests/setup.js` and `tests/*.test.js` — confirmed test suite does not load Phaser; SC-04 is preserved by construction.

---

## 9. Proposed code patch for WP02 (copy-paste ready)

> **BROKEN — see "REVISION 2026-06-10" at the top.** Use §10 instead.


**File**: `js/main.js`
**Replace**: lines 91–99 (the `scale: { ... }` block).
**Insert**: just before the `const config = { ... }` declaration starts (line 79 region), add the DPR constants. Or inline them inside the scale block — both work; inline keeps the diff smaller.

```javascript
// js/main.js — WP02 patch
// Replace existing scale block (lines 91-99) with:

scale: (() => {
  // -----------------------------------------------------------------
  // WP02 — Render Resolution Quality, FR-02 / R-04
  //
  // The Phaser-3.70 ScaleManager has NO functional `resolution` key
  // (the property was removed in the 3.16 ScaleManager rewrite and
  // never reinstated; see kitty-specs/052-render-resolution-quality/
  // research/phaser-resolution-config.md).
  //
  // The working DPR-aware pattern is to multiply the canvas backing
  // buffer by DPR and divide the camera zoom by DPR, so world
  // coordinates stay in the 960×480 logical space all existing
  // sprites / UI / cameras already use.
  //
  // DPR is capped at 2:
  //   - DPR=1 desktops / old Android → no change (no-op, current behaviour preserved)
  //   - DPR=2 Retina / modern phones  → 1920×960 backing, sharp
  //   - DPR=3 phones                  → capped to 2 (the un-capped path
  //     renders 9× pixels per frame and risks dropping below NFR-01's
  //     55-FPS floor — WP05 can lift this cap for the "Hoch" preset
  //     once mobile FPS is measured)
  // -----------------------------------------------------------------
  const rawDpr = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number')
    ? window.devicePixelRatio
    : 1;
  const dpr = Math.max(1, Math.min(rawDpr, 2));
  if (typeof window !== 'undefined') {
    window.__RENDER_DPR__ = dpr;
  }
  return {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960 * dpr,
    height: 480 * dpr,
    zoom: 1 / dpr
  };
})(),
```

**Acceptance check after applying**:
1. Hard-reload the page in a DPR=2 browser (Retina display, or DevTools "Sensors → Device Pixel Ratio = 2").
2. DevTools Console: `Phaser.GAMES[0].canvas.width` should print **1920**.
3. DevTools Console: `window.__RENDER_DPR__` should print **2**.
4. Visual: NPC portraits and the hub background should look noticeably sharper.
5. Enter the procedural dungeon (Q1 first room). Floor / walls / obstacles must render identically to pre-patch (NEAREST sampling preserved by `pixelArt: true`).
6. `node --test tests/` — all 251 tests still pass (unchanged — they don't load Phaser).

If step 5 fails (any visual regression in the procedural dungeon), revert the patch and re-open WP02 with a narrower DPR cap (e.g. `Math.min(rawDpr, 1.5)`) or skip WP02 entirely and proceed to WP04 with current behaviour preserved.

---

## 10. Correct pattern v2 — backing-buffer-only DPR upscale

**Goal**: backing buffer 1920×960 (DPR=2) or 1440×720 (DPR=1.5), projection / world / cameras / UI / mouse-pick coords ALL still at 960×480, CSS displayed size unchanged from current FIT behaviour.

**Why it's not a one-liner**: Phaser 3.70's `ScaleManager` couples `gameSize` (projection / world / camera basis) to `scale.width` 1:1. The dead `resolution` key was the intended decoupling point and was never reinstated. In 3.70 there is **no Phaser-config-only path** that achieves the goal. The only routes are post-boot manipulation, and they fight the framework — see §11 for the honest assessment of fragility.

### 10.1 Option A — Post-boot canvas + viewport upscale (the manual decouple)

Keep the Phaser config unchanged (960×480, FIT, zoom:1). Right after `new Phaser.Game(config)`, **manually** upscale the canvas backing buffer and tell WebGL to rasterize the (unchanged) 960×480 projection onto the larger viewport.

```javascript
// js/main.js — add AFTER `let game = new Phaser.Game(config);` (line 124).
// Keep the existing scale block (960×480, FIT, zoom:1) unchanged.

(function applyDprBackingBuffer () {
  // -----------------------------------------------------------------
  // WP02 v2 — Render Resolution Quality (FR-02 / R-04)
  //
  // The Phaser 3.70 ScaleManager couples `gameSize` (camera projection
  // basis) to `scale.width` 1:1. There is no config-only way to size
  // the canvas backing buffer independently of the world. So we do it
  // post-boot, by hand:
  //   1. Wait until the renderer / canvas are wired up.
  //   2. Resize the canvas DOM element width/height (backing buffer).
  //   3. Override CSS to keep the displayed size identical (preserves
  //      the FIT layout the rest of the page expects).
  //   4. Update gl.viewport to rasterize the 960×480 projection onto
  //      the full DPR-multiplied backing buffer.
  //   5. Surface the renderer's idea of width/height so resetViewport()
  //      (called on framebuffer rebinds, e.g. post-process pipelines)
  //      doesn't snap us back to 960×480.
  //   6. Re-apply on every ScaleManager RESIZE so window resize /
  //      orientation change don't undo it.
  // We do NOT call renderer.resize() — that would clobber the
  // projection matrix back to backing-buffer dimensions, recreating
  // the §5.2 bug.
  // -----------------------------------------------------------------
  if (typeof window === 'undefined') return;
  const rawDpr = typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;
  const DPR = Math.max(1, Math.min(rawDpr, 2));
  window.__RENDER_DPR__ = DPR;
  if (DPR === 1) return; // no-op on DPR=1 devices — current behaviour preserved

  const LOGICAL_W = 960;
  const LOGICAL_H = 480;

  function applyOnce () {
    const canvas = game.canvas;
    const renderer = game.renderer;
    if (!canvas || !renderer || !renderer.gl) return false;

    // Snapshot the FIT-computed CSS BEFORE we touch backing buffer —
    // the ScaleManager already set style.width/height to the parent-
    // FIT-letterboxed values. We want to keep exactly that.
    const cssW = canvas.style.width;
    const cssH = canvas.style.height;

    // Grow backing buffer.
    canvas.width  = LOGICAL_W * DPR;
    canvas.height = LOGICAL_H * DPR;

    // Restore CSS (browser would otherwise scale the new backing 1:1).
    if (cssW) canvas.style.width  = cssW;
    if (cssH) canvas.style.height = cssH;

    // Tell WebGL to map the [0..960]×[0..480] projection onto the full
    // DPR-multiplied viewport. This is the actual sharpness gain.
    renderer.gl.viewport(0, 0, LOGICAL_W * DPR, LOGICAL_H * DPR);

    // Keep renderer's width/height in sync so resetViewport() (called
    // by setFramebuffer on framebuffer rebinds) uses the upscaled
    // viewport, not the original 960×480.
    renderer.width  = LOGICAL_W * DPR;
    renderer.height = LOGICAL_H * DPR;
    renderer.drawingBufferHeight = renderer.gl.drawingBufferHeight;
    if (renderer.defaultScissor) {
      renderer.defaultScissor[2] = LOGICAL_W * DPR;
      renderer.defaultScissor[3] = LOGICAL_H * DPR;
    }

    // CRITICAL: do NOT call renderer.setProjectionMatrix() — keep the
    // projection at the original 960×480 (set during boot). That's the
    // entire point: backing 1920×960, projection 960×480 → GPU
    // up-rasterizes each logical pixel to a 2×2 block, *without* the
    // world-coord space growing.

    return true;
  }

  // Try right away (works in most cases — Phaser.Game boots synchronously
  // for the renderer-attach step). If not yet ready, retry on READY.
  if (!applyOnce()) {
    game.events.once('ready', applyOnce);
  }

  // Re-apply on ScaleManager resize so window / orientation changes
  // don't reset us. ScaleManager fires this AFTER it has updated the
  // FIT CSS, so we just need to re-grow the backing buffer.
  game.scale.on('resize', () => {
    // Defer one frame: ScaleManager's onResize handler in WebGLRenderer
    // (registered in renderer.boot) will fire synchronously on the same
    // event and call renderer.resize(baseSize.w, baseSize.h) →
    // setProjectionMatrix(960, 480) [unchanged] + gl.viewport(0,0,960,480)
    // [WRONG]. We re-stomp it next tick.
    Promise.resolve().then(applyOnce);
  });
})();
```

**Acceptance check**:
1. Hard-reload in DPR=1.5 or DPR=2 browser.
2. DevTools: `game.canvas.width === 1920` (DPR=2) — backing buffer grew. ✓
3. DevTools: `game.scale.width === 960` — world / camera basis unchanged. ✓
4. DevTools: `game.renderer.projectionWidth === 960` — projection unchanged. ✓
5. DevTools: `game.renderer.gl.getParameter(game.renderer.gl.VIEWPORT)` returns `[0, 0, 1920, 960]` — viewport correctly upscaled. ✓
6. **Visual**: dungeon renders identically to DPR=1 baseline (same layout, same camera framing). NPC portraits look sharper.
7. Mouse / touch input: clicking the right edge of the visible canvas registers as world-coord x≈960. (Phaser's pointer code reads `canvas.getBoundingClientRect()` → CSS pixels → divides by `displayScale` → world coords. `displayScale` is computed from baseSize/displaySize. Because we keep `baseSize = 960×480`, this conversion stays correct.)

### 10.2 Option B — Multi-canvas RESIZE mode with manual camera viewport (rejected)

Use `scale.mode: Phaser.Scale.RESIZE` and `width: window.innerWidth*DPR, height: window.innerHeight*DPR`, then in every scene's `create()` do `this.cameras.main.setSize(960, 480).setZoom(window.innerWidth*DPR/960)`.

**Why rejected**: every scene already in the codebase (HubSceneV2, GameScene, CraftingScene, SettingsScene, PrintingHouseScene, StartScene — 6 scenes plus mobile-control overlays) would need camera-viewport math added. Mobile control overlays in `HubSceneV2.js` use scrollFactor-recursive setup (per `feedback_phaser_scrollfactor_dialogs.md`) and would need parallel updates. This is invasive enough that the spec's "WP02 ≤ 5 LoC config change" assumption (10.4) becomes false; touches every scene. The §13 R-04 risk mitigation also forbids "scope grows beyond a single touchpoint".

### 10.3 Option C — Phaser game-level `resolution` config key (does not exist)

Phaser 3.70 has no top-level `resolution` config key either (verified by source-grep of `src/core/Config.js`). The Phaser 2 path is closed. Not viable.

### 10.4 Option D — Per-texture supersampling (out of scope)

Load each art asset at @2x resolution. Crispness without ScaleManager surgery. **Rejected** for this spec because (a) asset pipeline rework is enormous; (b) procedurally-generated dungeon textures (`proceduralRooms.js`) draw at logical size and would need parallel @2x generation paths; (c) spec's NFR-03 +50 MB memory budget would be exceeded by doubled texture VRAM. Out of scope for 052.

### 10.5 Recommendation

**Ship Option A** (§10.1). It's the only path that:
- Keeps Phaser config unchanged (zero regression on the existing 251 tests + 6 scenes).
- Achieves FR-02 (visibly sharper sprites on DPR>1 devices).
- Preserves world-coord invariants (FR-07 / C-01 — proc dungeon renders identically).
- Is reversible at runtime (the `DPR === 1` early-return means the patch is a literal no-op on non-Retina devices).

The fragility cost is documented in §11.

---

## 11. Honest assessment — WP04 + WP05 in Phaser 3.70 are not trivial

The original spec (`spec.md` §1, §4 FR-02, §10 assumption 10.4) framed WP02 as "a single config key change, ≤5 LoC, no behaviour risk". This research disproves that framing on two counts:

### 11.1 Cost of doing it right
- The "single config key" doesn't exist (§1).
- The community-converged config workaround (§5.2) **doesn't work for fixed-aspect games** (revision, top of doc).
- The actual working pattern (§10.1) is ~70 lines of post-boot canvas-and-WebGL-state manipulation, NOT a config change.
- It maintains an event subscription (`game.scale.on('resize', ...)`) for the lifetime of the game.
- It mutates `renderer.width`, `renderer.height`, `renderer.drawingBufferHeight`, `renderer.defaultScissor` — internal renderer state — to work around `resetViewport()` calls from framebuffer rebinds.

### 11.2 Fragility / risk inventory
1. **Framebuffer rebinds**: any pipeline that does `setFramebuffer(null, true)` triggers `resetViewport()` which reads `this.width`/`this.height` from the renderer. We set those to `1920×960`, so it works — but it relies on us catching every internal field. If Phaser 3.71+ adds a new field (e.g. `renderer.bufferWidth`), the patch silently breaks.
2. **`renderer.resize()` from any other path**: anything that calls `game.renderer.resize(w, h)` will call `setProjectionMatrix(w, h)`, growing the projection space and reproducing the §5.2 bug. The ScaleManager RESIZE event handler calls this; we patch around it with `Promise.resolve().then(applyOnce)`. If a future scene calls `game.scale.resize(w, h)` directly, we have a frame-long visual glitch before our microtask fixes it.
3. **Post-process pipelines**: any custom WebGL pipeline that does framebuffer ping-pong (bloom, blur, color grade) needs its render-target sized at the new backing (`1920×960`), not the projection (`960×480`). The codebase doesn't use these today, but WP05's "Hoch" quality preset might.
4. **Text rendering**: `Phaser.GameObjects.Text` rasterizes through a Canvas2D context at its own `resolution` (default 1). It does NOT inherit the backing-buffer upscale. To make Text sharp at DPR=2, you'd ALSO need `text.setResolution(DPR)` on every text object (or shim `Text.prototype.constructor` to default `resolution = DPR`). The current spec doesn't mention this — the 30+ text-using scenes will look "sprites sharp, text still soft" without it.
5. **Input pointer math**: relies on `displayScale = baseSize / displaySize`. We don't touch `baseSize`, so it works — but the moment anyone tries `game.scale.resize()` instead of `game.scale.setGameSize()`, baseSize moves and pointer math drifts.
6. **WP05 runtime toggle (FR-05, "low / medium / high preset")**: changing DPR at runtime requires re-doing every step of `applyOnce()` PLUS re-uploading every Text texture at the new resolution PLUS re-running every procedural texture generator that captured the old `gl.drawingBufferHeight`. Spec C-06 ("preset switch requires page reload") covers this, but the UX cost is real — users lose their current dungeon run on toggle.

### 11.3 Pragmatic recommendation for the WP02–WP05 chain

| WP | Original framing | Reality | Recommendation |
|---|---|---|---|
| WP02 — `scale.resolution` | "5 LoC config change" | The key doesn't exist; the workaround pattern §5.2 is broken; the real fix §10.1 is ~70 LoC of post-boot wiring. | Ship §10.1 with explicit acknowledgement that it's "post-boot canvas decouple" not "config key". Update spec.md §4 FR-02 wording. |
| WP03 — Per-texture LINEAR | unchanged (independent, already validated) | independent | Ship as planned. |
| WP04 — FPS measurement at DPR=2 | "instrument what we shipped" | Need to also measure `game.canvas.width`, `game.scale.width`, and `gl.getParameter(VIEWPORT)` to verify the §10.1 decouple held over a real play session — not just initial-boot. | Add invariants check to performanceMonitor.js: warn if `game.scale.width !== 960` after any frame. |
| WP05 — Settings preset toggle | "user picks low/medium/high" | Requires page reload (C-06). At "high" preset you'd need DPR=3 uncapped + per-Text resolution + per-procedural-texture re-bake. NFR-01 (Pixel-4-class ≥55 FPS) is at risk above DPR=2. | Ship as 2-preset (Standard / Scharf), not 3. Standard = current behaviour (`DPR=1` early-return in §10.1). Scharf = §10.1 with `DPR = Math.min(rawDpr, 2)`. Skip the "Hoch / DPR=3" preset until WP04 measurements justify it. |

### 11.4 What this means for the spec
The spec's R-04 ("Phaser-version-dependent quirks — mitigation: lock to verified-working approach") is **vindicated** by this research: there IS a verified-working approach (§10.1), but it's **not what the spec assumed**, and it's load-bearing enough to warrant updating the spec text. Specifically:
- spec.md §1 lever 2 ("`resolution` is the smallest lever") → false; it's the largest of the three and the only one that requires post-boot wiring.
- spec.md §4 FR-02 ("set `resolution` in scale config") → reword to "decouple canvas backing buffer from world projection via post-boot canvas resize + `gl.viewport` override".
- spec.md §10 assumption 10.4 (config change is ≤5 LoC) → false; ~70 LoC; revise the WP02 effort estimate.
- spec.md §13 R-04 mitigation → reference §10.1 of this doc as the verified-working approach.

### 11.5 Out-of-scope alternatives (if §10.1 turns out fragile in practice)

If §10.1 breaks under real-world use (e.g. someone hits one of the §11.2 issues in production), the realistic escape hatches are:
1. **Wait for Phaser 4** (post-3.88 rewrite). Re-check whether the renderer / scale separation got cleaned up. If yes, migrate the whole game to Phaser 4 and use the modern API. Cost: significant.
2. **Skip FR-02 entirely**. Ship FR-03 (per-texture LINEAR for painterly assets), accept that the rest of the rendering is at logical 960×480 backing — i.e. soft on Retina. This is the cheapest path; subjectively the game is already shipped this way and nobody has complained.
3. **Switch to CSS-only sharpness**. Ensure `image-rendering: auto` on the canvas (already set per `index.html`), and accept browser's bilinear upscale. Lowest quality but zero engine-side risk. Roughly tied with option 2 visually.

**Default position if §10.1 is unstable**: ship option 2 (skip FR-02, keep FR-03). Document the spec deviation. Re-evaluate when Phaser 4 lands.

---

## 12. Sources (added 2026-06-10 revision)

Direct source reads, all on 2026-06-10:

- `src/scale/ScaleManager.js` at v3.70.0 tag — `https://raw.githubusercontent.com/phaserjs/phaser/v3.70.0/src/scale/ScaleManager.js` — 1783 lines, downloaded and grepped locally. Key findings at lines 551 (gameSize.setSize), 558 (this.zoom=zoom), 566 (baseSize.setSize), 586 (displaySize.setSize), 788-789 (setGameSize → canvas.width = baseSize.width), 853-854 (resize → canvas.width = baseSize.width), 992-1066 (updateScale: FIT branch doesn't read this.zoom), 1005-1008 (NONE branch DOES read zoom but only for displaySize/CSS).
- `src/core/CreateRenderer.js` at v3.70.0 tag — confirms initial canvas backing buffer = `baseSize.width × baseSize.height`, no zoom multiplication.
- `src/renderer/webgl/WebGLRenderer.js` at v3.70.0 tag — `resize(w, h)` calls `setProjectionMatrix(w, h)` (orthographic projection space = w × h), `gl.viewport(0, 0, w, h)`, and sets `this.width/this.height/defaultScissor`. `onResize(gameSize, baseSize)` calls `this.resize(baseSize.width, baseSize.height)` — confirms projection is tied to baseSize. `resetViewport()` (line ~1800) reads `this.width/this.height` — meaning §10.1 must set `renderer.width/height` to the upscaled values to survive framebuffer rebinds.

Community pattern sources re-read to confirm they don't apply to fixed-aspect games:
- `https://supernapie.com/blog/support-retina-with-phaser-3/` — uses `scale.mode: NONE` + `width: innerWidth*DPR`. Full-viewport pattern; doesn't apply to fixed 960×480.
- `https://github.com/Quinten/phaser3-retina/blob/master/src/index.js` — identical to supernapie; `mode: NONE`, full-viewport.
- `https://phaser.discourse.group/t/help-resizing-a-game-with-dpr-device-pixel-ratio/3242` — post 3 solution uses FIT mode but ALSO sizes the game to `innerWidth*DPR` × `innerHeight*DPR`. Full-viewport. Includes a post-boot canvas-resize step which is the seed of our §10.1 pattern, but their world is still innerWidth-sized.
- `https://github.com/phaserjs/phaser/issues/3198` — original 3.16 regression report. Never resolved upstream. Confirms the entire problem class is known and unfixed in 3.70.
- `https://phaser.discourse.group/t/high-resolution-is-not-as-sharp-as-possible/1612` — confirms the 3.16 disable was deliberate to avoid blocking the release; no workaround merged.
