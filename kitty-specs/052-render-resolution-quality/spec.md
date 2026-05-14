# Specification: Render Resolution Quality

**Feature**: 052-render-resolution-quality
**Created**: 2026-05-14
**Mission**: software-dev
**Tracker**: Internal — surfaced during 050/051 polish work; not yet a GitHub issue
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

During the 050 → 051 polish cycle a recurring observation surfaced: **all sprites look low-resolution** even after per-texture LINEAR filtering and pre-resized source PNGs. Root cause is structural — `main.js:91-99` renders the game canvas at a fixed **960 × 480** internal resolution, then the browser CSS-scales that to the player's viewport (typically 1080p–4K on desktop, 2-3× DPR on mobile). The result is uniform softening across the whole rendered surface that no per-texture fix can recover.

The constraint that locked us in: `pixelArt: true` is required for the procedural dungeon's runtime-generated floor / wall / obstacle textures to render at all (per the comment in `main.js:80-84` — disabling it produces broken TileSprite frames). So we can't just flip pixelArt off.

This feature investigates and ships the safe combination of three independent levers:

1. **Bump the internal canvas resolution** (e.g. 960×480 → 1920×960) so the browser CSS-scale ratio drops from ~2× to ~1× on common displays. Trade-off: ~4× more rendering work.
2. **Use Phaser's scale `resolution`** to render at `window.devicePixelRatio` so the canvas matches physical pixels on retina / high-DPI displays. Trade-off: Phaser-version-dependent quirks.
3. **Audit the procedural-texture pipeline** to find out exactly what breaks under `pixelArt: false` — then either fix the specific generators OR keep `pixelArt: true` globally and rely on per-texture filter overrides (the 051 LINEAR pattern, scaled out across more textures).

Each lever has different blast-radius. The spec defines acceptance criteria + a phased roll-out: ship the safest combination first, measure FPS impact, then iterate. Mobile playability is NON-NEGOTIABLE — any change that drops mobile below 60fps gets reverted.

## 2. Stakeholders & Actors

- **Player on desktop 1080p / 1440p / 4K** — currently sees softened sprites due to 2-4× browser stretch. Primary beneficiary.
- **Player on mobile (Pixel-class device, 2-3× DPR)** — currently sees softened sprites AND already has tight FPS budget. Beneficiary if quality lever doesn't break perf.
- **Player on low-end hardware** — currently runs at 60fps. Must keep 60fps.
- **Procedural dungeon system** (`js/proceduralRooms.js`, `js/roomTemplates.js`, runtime texture generation) — currently relies on `pixelArt: true`. Must keep working.
- **Existing per-texture LINEAR override** (`js/scenes/HubSceneV2.create:124-141`, feature 051) — pattern that must scale to whatever final configuration we land on.

## 3. User Scenarios

### Primary: Desktop player on 1920×1080 monitor

1. Player launches game. Current state: canvas is 960×480 internal, browser stretches to 1920×960 (with CSS letterboxing for 1080p aspect). NPC sprites look blurry/soft.
2. After feature: canvas is e.g. 1920×960 internal (lever 1) OR rendered at DPR=1 with resolution config (lever 2). Browser stretch ratio → 1:1. NPC sprites render at native pixel density.
3. Subjective improvement: visible sharpness on NPC portraits, hub background, weapon icons, UI text.
4. FPS unchanged on desktop (~60fps cap maintained).

### Primary: Mobile player on Pixel-class device

1. Player launches game. Current state: canvas 960×480, device 2-3× DPR, double-soft rendering.
2. After feature: canvas renders at DPR-aware resolution. Sprites sharper.
3. CRITICAL: FPS must stay at 60. If the higher render target drops mobile below 50fps in dungeon combat, lever 1 (canvas bump) auto-degrades or the feature is reverted.

### Edge case: Player on a 4K display

1. Without feature: canvas 960×480 stretched to 3840×1620 = 4× stretch. Significant softening.
2. With feature: canvas 1920×960 (lever 1) still 2× stretch — better but not native. Or DPR-based resolution scales further.
3. Acceptable: not pixel-perfect but visibly sharper than current.

### Edge case: Procedural dungeon textures break

1. After enabling some lever, proc-dungeon floor / wall / obstacle textures render incorrectly (transparent, wrong frame, etc.).
2. Acceptance: REVERT the lever that broke them, document the breakage, narrow scope.

## 4. Functional Requirements

| ID    | Requirement | Status |
|-------|-------------|--------|
| FR-01 | Document, with measurements, what each of the three levers (canvas bump, resolution config, pixelArt audit) does to perceived sharpness AND FPS on at least three devices: desktop-1080p, desktop-1440p, mobile-Pixel-class. | Draft |
| FR-02 | Ship the LEAST-risky lever first — `resolution: window.devicePixelRatio` in the scale config — if it doesn't break the proc dungeon. Verify by running a full Q1-Q6 chain + at least 3 procedural-dungeon rooms. | Draft |
| FR-03 | If FR-02 is safe: extend the 051 per-texture LINEAR filter pattern to cover EVERY non-procedurally-generated texture (hub bg, all NPC sprites, weapon icons, UI elements, fonts). Maintain the existing NEAREST default for proc textures. | Draft |
| FR-04 | If FR-02 is safe + FR-03 is shipped: bump the internal canvas resolution from 960×480 to 1920×960 ONLY if mobile FPS stays ≥ 55 with the bump. Measure before merging. | Draft |
| FR-05 | Provide a Settings toggle "Render-Qualität" (Niedrig / Mittel / Hoch) so a player on low-end hardware can opt out of the higher resolution. Niedrig = current 960×480 + pixelArt; Hoch = the maximum lever combination this feature can safely ship. Default: Mittel. | Draft |
| FR-06 | All UI elements MUST gracefully handle the new internal resolution — buttons, modals, HUD positions, font sizes. If anything breaks layout, fix the affected scene OR cap the lever at a value the existing UI tolerates. | Draft |
| FR-07 | NO regression on the existing pixelArt path — proc dungeon, generated textures, room tiles all render exactly as before for the same player perspective and FPS. | Draft |

## 5. Non-Functional Requirements

| ID     | Requirement | Threshold | Status |
|--------|-------------|-----------|--------|
| NFR-01 | Mobile FPS in combat MUST stay ≥ 55. | Measured on a mid-tier mobile device (Pixel 4 / iPhone XR class). | Draft |
| NFR-02 | Desktop FPS in combat MUST stay ≥ 60 (the cap). | Standard 1080p desktop benchmark. | Draft |
| NFR-03 | Memory footprint increase from higher-res rendering MUST stay under +50 MB. | Measured via DevTools Performance / Memory tab. | Draft |
| NFR-04 | Initial load time MUST NOT increase by more than 10 %. | Cold-load timing comparison. | Draft |

## 6. Constraints

| ID    | Constraint | Status |
|-------|------------|--------|
| C-01  | NO disabling `pixelArt: true` globally without first proving the proc-dungeon generators still produce correct textures. Documented in `main.js:80-84` as a known landmine. | Draft |
| C-02  | NO new dependencies. Use Phaser's built-in scale/resolution config only. | Draft |
| C-03  | Mobile is the limiting factor for FPS targets. Desktop perf is secondary. | Draft |
| C-04  | UI layouts in `HubSceneV2`, `GameScene`, `SettingsScene`, `CraftingScene`, `HUDv2`, `PrintingHouseScene` MUST continue to work at the new resolution. Each is a separate audit step. | Draft |
| C-05  | Settings persist via the existing `demonfall_settings_v1` flow. Quality toggle uses the same nested-key pattern as `gameplay.skipTutorial`. | Draft |
| C-06  | Render-quality toggle MUST take effect on next scene transition OR via explicit "Restart Game" — applying mid-scene risks breaking active textures. | Draft |

## 7. Success Criteria

| ID    | Criterion |
|-------|-----------|
| SC-01 | Subjective sharpness improvement on hub NPCs, hub background, weapon icons (vs current build) reported by at least one playtester. |
| SC-02 | Procedural dungeon visuals identical (or improved) — no broken floor/wall textures, no missing tiles, no checkerboarding. |
| SC-03 | FPS measurements: desktop ≥ 60 cap; mobile mid-tier ≥ 55 in combat. |
| SC-04 | All 251 existing tests still green. |
| SC-05 | Settings toggle round-trips correctly — change Niedrig→Hoch, restart, see the higher-res render. Change back, see the original. |
| SC-06 | All UI scenes still readable + interactable at the new resolution — buttons sized correctly, text not cut off, modals fit. |
| SC-07 | No regression in the 050/051 flows — Q1-Q6 chain completes, splashes show, side-dialogues fire, faction standings update. |

## 8. Edge Cases

- **DevicePixelRatio = 1 (older displays)** — `resolution: window.devicePixelRatio` is a no-op; current behavior preserved.
- **DPR > 2 (high-end retina)** — lever 2 produces a 3× internal render. Memory + perf may not allow it on mobile — needs gate.
- **Window resize / fullscreen toggle** — Phaser scale mode handles this; verify the new resolution config doesn't break the resize path.
- **Game launches in iframe (embed)** — devicePixelRatio inside iframes can be quirky; fallback to fixed multiplier if DPR detection fails.
- **Player opens DevTools** — resizing the dev pane changes effective viewport but should not trigger a Phaser scale event mid-frame.

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| Phaser config (`main.js`) | Where `pixelArt`, `roundPixels`, `scale.width`, `scale.height` are set. Single source of truth. |
| Settings.gameplay.renderQuality | New nested-key setting: `"low" | "medium" | "high"`. Default `"medium"`. |
| `window.__RENDER_QUALITY__` | Surface flag set by applySettings; read by main.js / scene init to pick the appropriate scale params. |
| Per-texture filter override | Existing 051 pattern (HubSceneV2._showCollusionReveal's `_ktPropagateScrollFactor`-adjacent LINEAR list). To be extracted into a shared helper if the audit reveals more touchpoints. |

## 10. Assumptions

- Phaser 3 supports `scale.resolution` (or equivalent) — to be verified against the project's Phaser version.
- The proc-dungeon texture generators are localised in `js/roomTemplates.js` + `js/proceduralRooms.js` — auditing them is bounded.
- Settings system tolerates a new nested-key field without migration (verified during 045/050/051).
- Mobile FPS measurement is feasible via the existing `js/performanceMonitor.js` (need to spot-check this).

## 11. Out of Scope

- **WebGL → WebGPU upgrade** — out of Phaser 3's wheelhouse for now.
- **Custom shader pipeline** for bloom / motion blur etc. — pure resolution work only.
- **Texture compression formats** (ASTC, ETC2) for mobile — would help memory but is a deep dive.
- **Asset re-authoring** (higher-res sprite sources) — the 050/051 sprites are already 600-1500px tall; we have headroom.
- **Voice acting / cutscene rendering** — not relevant to baseline render quality.

## 12. Dependencies

- `js/main.js` — Phaser config, where all the levers live.
- `js/scenes/HubSceneV2.js` — existing per-texture LINEAR override pattern, possibly extracted to a helper.
- `js/scenes/SettingsScene.js` — new Render-Qualität toggle row.
- `js/proceduralRooms.js` + `js/roomTemplates.js` — proc-texture audit target (do they work without pixelArt?).
- `js/performanceMonitor.js` — perf instrumentation for verification.

## 13. Risks

- **R-01 — Proc-dungeon visual regression**: the single biggest risk. `pixelArt: true` is load-bearing for the runtime-generated textures. Mitigation: audit the generators incrementally, ship the safest lever first (FR-02), keep `pixelArt: true` if any generator breaks.
- **R-02 — Mobile FPS regression**: higher resolution = more pixels = more GPU work. Mid-tier mobile may not absorb a 4× resolution bump. Mitigation: NFR-01 hard floor; default Settings to "Mittel" (conservative); make "Hoch" opt-in.
- **R-03 — UI layout breakage**: positioned-in-pixels UI elements may misplace under a new resolution. Mitigation: audit each scene individually, C-04 enumeration.
- **R-04 — Phaser version quirks**: the scale `resolution` config behaves differently across Phaser 3 minor versions. Mitigation: lock to verified-working approach, document the exact Phaser version + config in the implementation.
- **R-05 — Settings toggle race**: changing render quality mid-scene might leave the canvas in an inconsistent state. Mitigation: C-06 — apply on next transition, show a "Wirkt beim nächsten Szenenwechsel" hint.

## 14. References

- ROADMAP.md §Phase 3 (lateral expansion — quality/perf falls here)
- `js/main.js:80-99` — current Phaser config + comment explaining the pixelArt lock
- Feature 050 + 051 — current render state on `main`; this feature builds on top
- Project memory: [[project_phaser_scrollfactor_dialogs]] — mobile-safe modal pattern; analogous attention needed for mobile rendering
- Issue #11 (someday): "Schwierigkeit an Metaprogression anpassen" — adjacent perf consideration since high-difficulty runs stress the engine more
