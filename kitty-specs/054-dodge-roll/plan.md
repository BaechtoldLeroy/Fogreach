# Implementation Plan: 054 — Dodge Roll

**Branch**: `main` (planning + small-blast-radius shipping per project workflow)
**Date**: 2026-06-11
**Spec**: [spec.md](spec.md)

## Summary

Dodge-Roll auf Shift. **MVP-shippbar in 3 WPs (~120 LoC)** dank Single-Chokepoint-Damage-Architektur + existierendem `_playerInvincible`-Flag. VFX + Mobile-Button + Combo-Buffer = Polish-Layer in WP04-WP06.

7 WPs gesamt:
1. **WP01 Input + State-Flag** — Shift-Listener (Classic + ARPG) + `isRolling` Flag auf Player.
2. **WP02 Roll-Movement + Cooldown** — Phaser-Tween 90px/200ms in Direction, 600ms Cooldown via abilitySystem-Pattern.
3. **WP03 i-Frames + Damage-Gate** — `window._playerInvincible = true` für 200ms (= MVP-fertig).
4. **WP04 Animation Plan-B** — Walk-Anim-Reuse + scaleY-Squash + timeScale + Tint.
5. **WP05 Afterimage-VFX** — Sprite-Snapshot-Trail mit Alpha-Decay (Mobile-Skip via `RenderQuality.isMobile()`).
6. **WP06 Mobile-Button + Roll-into-Attack-Buffer** — Mobile-Button in col 4 row 0 + Attack-Buffer im letzten 70ms der Roll-Window.
7. **WP07 Polish + Cancel-Behavior** — Cancel laufender Attack, Cooldown-Reset, Charge-Slash-Timer kill, Velocity-Smoothing-Reset (alle 5 Risks aus research §9 sauber abgedeckt).

**MVP-Stop-Point nach WP03**: Spielbar, funktional, sieht aber rough aus (Sprite spinnt nicht, kein Trail). Sinnvoll für ersten Playtest-Feedback ob 90px/200ms/600ms-Numbers sich richtig anfühlen, BEVOR Polish-LoC investiert wird.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2015+), Phaser 3.70 (CDN)
**Primary Dependencies**: Phaser 3 (Tweens, Physics-Body, Anims)
**Storage**: keine neuen Storage-Anforderungen (FR-11 Knowledge-Tree-Hook nutzt zentrale Config, kein localStorage)
**Testing**: `node tools/runTests.js` (268 Tests, müssen alle grün bleiben — SC-07)
**Target Platform**: Browser (Desktop + Mobile)
**Project Type**: Single-page Phaser-Spiel
**Performance Goals**: Mobile-VFX darf Baseline (20fps Procroom) NICHT verschlechtern (NFR-02)
**Constraints**: Single-Chokepoint Damage-Architektur (`enemy.js:1649`) bleibt unangetastet (C-04)
**Scale/Scope**: ~150 LoC total, 7 WPs

## Constitution Check

*GATE: Must pass before WP01 implementation starts.*

- ✅ **Test-First (paradigm-test-first.md)** — Roll-Mechanik ist gameplay-Tweak; Unit-Tests greifen nicht. Acceptance via Playtest-Subjective (SC-08). Bestehende 268 Tests müssen grün bleiben (NFR-04).
- ✅ **No new deps (C-02)** — Vanilla-JS + Phaser-built-ins.
- ✅ **No balance change (C-03)** — Enemy-Stats, Damage-Numbers, Telegraph-Times unangetastet.
- ✅ **Single-Chokepoint preserved (C-04)** — `applyPlayerDamage` wird nicht refactored, nur `_playerInvincible`-Flag-Reuse.
- ✅ **No asset re-authoring (C-01)** — Animation Plan-B walk-anim-reuse statt neuer Frames.

## Project Structure

### Documentation (this feature)

```
kitty-specs/054-dodge-roll/
├── plan.md                  # Dieses File
├── spec.md                  # ✅ vorhanden
├── tasks.md                 # WP01..WP07 — Output von /spec-kitty.tasks
└── research/
    └── code-audit.md        # ✅ vorhanden (Agent-Output)
```

### Source Code (Single project, kein neuer Strukturbedarf)

```
js/
├── inputScheme.js           # WP01: Shift-Binding-Pattern
├── player.js                # WP01-WP04: isRolling Flag, Tween, Anim Plan-B
├── abilitySystem.js         # WP02: Cooldown-Pattern reuse
├── main.js:2409             # WP01: dead spinKey ersetzen / weiterverwenden
├── enemy.js:1649            # WP03: KEINE Änderung — Flag respektiert bereits
├── mobileAbilityButtons.js  # WP06: neuer Button col 4 row 0
├── hudV2.js                 # WP02: Cooldown-Indikator
├── particleEffects.js       # WP05: Afterimage-VFX
└── renderQuality.js         # WP05 reuse: isMobile() für VFX-Mobile-Skip
```

**Structure Decision**: keine neuen Files. Alle Edits in bestehenden Modulen.

## Phase Breakdown

### Phase 0 — Research ✅ DONE

`research/code-audit.md` ist fertig. SHIFT frei bestätigt, Damage-Chokepoint identifiziert, Animation-Plan-B beschrieben, 5 Regression-Risks gelistet mit Mitigations.

### Phase 1 — MVP (WP01-WP03)

Ziel: Roll funktioniert mechanisch (Input → Movement → i-Frames), sieht aber rough aus. Spielbar für Number-Tuning-Feedback.

**Stop-Point nach WP03**: Erster Playtest. Wenn 90/200/600 daneben → tweaken via FR-11 zentrale Config, BEVOR weitere LoC in Polish gehen.

### Phase 2 — Polish (WP04-WP06)

Animation + VFX + Mobile + Combo. Macht die Mechanik *gut anfühlend*.

### Phase 3 — Hardening (WP07)

Alle 5 Risk-Mitigations sauber abgedeckt. Edge-Cases (Modal, Death, Cutscene) explizit gehandhabt.

## Complexity Tracking

| Aspekt | Risk | LoC est. |
|--------|------|----------|
| WP01 Input + Flag | low | ~20 |
| WP02 Movement + Cooldown | med (Tween + Cooldown-Pattern) | ~40 |
| WP03 i-Frames | low (3-LoC-Insert) | ~10 |
| WP04 Animation Plan-B | med (Tween-Choreography) | ~30 |
| WP05 Afterimage-VFX | med (Performance-Budget mobile) | ~25 |
| WP06 Mobile-Button + Combo | low | ~25 |
| WP07 Polish + Hardening | med (5 Risk-Mitigations) | ~20 |

**Total: ~170 LoC** (research-Schätzung 150 war optimistisch). Immer noch klein.

## Open Questions vor WP01

1. **Cooldown-Indikator-Position im HUD**: über Skill-Slot-Carousel? Daneben? Eigene Ecke? Spec sagt "unaufdringlich, nicht im Slot-Carousel" — exact place wird in WP02-Tasks entschieden.
2. **Audio-Cue für Roll**: bestehendes SFX reuse (z.B. dashSlash-sound)? Oder neuer Sound nötig? Spec sagt "optional Audio-Cue beim Cooldown-Block" — entscheidet sich in WP02.
3. **Mobile-VFX-Mode**: research empfiehlt "auto-skip auf Mobile". Komplett aus, oder 1 Snapshot statt 2-3? Performance-Mess in WP05 entscheidet.

Alle drei werden während Implementation entschieden, nicht im Plan.
