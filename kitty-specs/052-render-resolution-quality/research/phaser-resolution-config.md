# Phaser 3.70 `scale.resolution` — Research for WP02

**Feature**: 052 — Render Resolution Quality
**WP**: WP02 — set `resolution: window.devicePixelRatio` in the Phaser scale config (FR-02, R-04)
**Date**: 2026-06-10
**Status**: Research only — no code changed. Implementor reads this, then ships.

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
