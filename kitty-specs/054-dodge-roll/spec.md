# Specification: Dodge Roll

**Feature**: 054-dodge-roll
**Created**: 2026-06-11
**Mission**: software-dev
**Tracker**: ROADMAP Phase 3, Donor-Demo-Validation. Combat-Tiefe ohne Cognitive-Load-Spike.
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Combat fühlt sich heute taktisch limitiert an — Spieler läuft auf Gegner zu, Standard-Attack + 1-4 Abilities mit Cooldowns, fertig. Es fehlt der Moment-to-Moment Skill-Layer der 2D-Action-RPGs auszeichnet.

054 fügt **EINE** Mechanik hinzu: **Dodge-Roll auf Shift** (Desktop) / dedizierter Mobile-Button. Bewusste Beschränkung — Parry/Block weggelassen, damit das Feature shipping-bar bleibt und die Cognitive-Load-Schwelle nicht überschreitet (Demonfall hat schon Movement + Attack + 4 Abilities = 6 Inputs; Roll macht 7).

Referenz-Genre-Standard: Hades-Dash, Children-of-Morta-Roll. Snappy, 0.4s i-Frames, kurzer Cooldown.

**Donor-Demo-Wert**: Erste 5 Min des Playtests entscheiden ob "fühlt sich gut an". Roll ist die billigste Combat-Tiefe-Investition mit der größten gefühlten Wirkung.

## 2. Stakeholders & Actors

- **Spieler** (Desktop + Mobile) — primärer Beneficiary. Bekommt taktischen Out-of-Telegraph-Tool.
- **Enemy-AI** — unverändert. Gegner reagieren nicht auf Roll-Mechanik, ihre AOEs/Attacks bleiben gleich. Skill-Ceiling kommt durch Spieler-Mastery, nicht durch AI-Update.
- **Donor-Demo-Tester** — fühlen direkter "polished" weil Combat reaktiver wirkt.
- **Knowledge-Tree** — späterer Hook für Roll-Upgrades (out-of-scope, nur Hook offen halten).

## 3. User Scenarios

### Primary: Spieler dodged Boss-AOE

1. Boss telegrafiert AOE (existing Visual).
2. Spieler drückt Shift + bewegt sich in beliebige Richtung.
3. Player-Sprite rollt 90px in 200ms in Bewegungsrichtung mit Afterimage-Trail.
4. AOE trifft 150ms später — `_playerInvincible=true` blockt Damage.
5. Cooldown 600ms läuft, indicator im HUD sichtbar.
6. Spieler kommt sicher hinter dem Boss raus, kann sofort attacken.

### Primary: Spieler rollt aus normalem Combat

1. 2 Imps attacken den Spieler aus verschiedenen Winkeln.
2. Spieler Shift + Direction → rollt durch das Imp-Cluster.
3. i-Frames blocken ihre Attacks; Player kommt sicher auf der anderen Seite raus.
4. Direkt-Attack (Roll-into-Combo via Buffer im letzten i-Frame).

### Edge case: Roll während Attack-Animation

1. Spieler startet Attack-Animation (e.g. Slash 400ms).
2. Bei 200ms: Spieler drückt Shift.
3. Attack-Animation wird gecancelt, Roll startet sofort.
4. Attack-Cooldown wird sauber reset (siehe Risk-Liste in research).

### Edge case: Roll während Ability-Cast

1. Spieler casted DashSlash (existing offensive lunge, ~220ms).
2. Bei 100ms: Spieler drückt Shift.
3. DashSlash wird abgebrochen, Roll überlebt. Cooldown der DashSlash-Ability bleibt aktiv (= bewusster Trade-off, kein "free reset").

### Edge case: Roll-Cooldown läuft

1. Spieler hat gerade gerollt, Cooldown läuft (600ms verbleibend).
2. Shift erneut → kein Effekt. Optional: kurzer "click"-Sound + Cooldown-Indicator-Flash.

### Edge case: DoT-Tick während Roll

1. Spieler hat Poison-DoT aktiv (statusEffects.js:210 — schreibt playerHealth direkt).
2. Spieler rollt.
3. DoT-Tick trifft trotz i-Frames (bewusster Trade-off: i-Frames blocken nur direkten Combat-Damage, nicht Status-Effects-Ticks).

## 4. Functional Requirements

| ID    | Requirement | Status |
|-------|-------------|--------|
| FR-01 | **Trigger-Binding**: Shift (Classic + ARPG-Scheme) auslösen Roll. SHIFT-Key ist frei (research §1: `main.js:2409` `spinKey = addKey('SHIFT')` ist dead code). Mobile: neuer Button alongside Attack/Spin/Dagger/Potion (col 4 row 0 in 4×2 Grid). | Draft |
| FR-02 | **Movement**: Roll-Distance ~90px in ~200ms (= ~450 px/s, ~3× normale Move-Speed). Richtung = aktueller Movement-Input; bei stillstehendem Spieler = letzte Bewegungsrichtung. World-Coords-Bewegung via Phaser tween auf Player-Position. | Draft |
| FR-03 | **i-Frames**: Während der gesamten Roll-Duration (200ms) `window._playerInvincible = true`. Reset auf `false` nach Roll-Ende. Hook in das bestehende `applyPlayerDamage` Pattern (`enemy.js:1651` respektiert Flag bereits — kein neuer Code-Touch nötig dort). | Draft |
| FR-04 | **Cooldown**: 600ms ab Roll-Start. Während Cooldown: Shift no-op (optional: kurzer Audio-Cue). Cooldown-Indikator im HUD (klein, unaufdringlich, nicht im Skill-Slot-Carousel). | Draft |
| FR-05 | **State-Flag**: Neuer `isRolling` Flag auf Player-Object. **NICHT** den existierenden `isDashing` reusen (research §5 + §9: hat Wall-Tunneling-Snap-Back-Bug). Andere Ability-Gates (`isAttacking`, `isChargingSlash`) müssen `isRolling` respektieren — keine Attack-Trigger während Roll. | Draft |
| FR-06 | **Animation Plan-B** (kein Roll-Sprite-Asset vorhanden): Walk-Anim-Reuse mit Origin-Shift zu Center + `scaleY` Squash-Tween (1.0 → 0.7 → 1.0) + `timeScale` Boost (3×) + temporärem Tint (Lila/Purple). Zusammen lesbar als "Roll-Bewegung" ohne Asset-Arbeit. | Draft |
| FR-07 | **Afterimage-VFX**: Während i-Frames: kurze Trail von 2-3 Sprite-Snapshots mit Alpha-Decay (z.B. 0.6, 0.3, 0.15). Performance-Budget: muss in Procroom (heute 20fps Mobile) ohne weitere Verschlechterung laufen — daher Mobile auto-skip oder reduzierte Snapshot-Count auf Mobile. | Draft |
| FR-08 | **Cancel-Behavior**: Roll cancelt laufende Attack-Animation + Ability-Animations (= Combat-Fluidität). Attack-Cooldown wird beim Cancel sauber reset (vermeidet Risk #2 aus research). Charge-Slash-Timer (Risk #3) wird beim Cancel killed. | Draft |
| FR-09 | **Roll-into-Attack-Buffer**: Wenn im letzten Drittel der Roll (= letzte 70ms) Attack gedrückt wird, Attack triggert sofort nach Roll-Ende. Skill-Ceiling-Hook ohne Cognitive-Load-Erhöhung. | Draft |
| FR-10 | **Mobile-Input**: Dedicated Button (KEIN Swipe-Gesture — research §6: würde mit `mobileControls.js:330-370` `__MOBILE_MOVE_TARGET__` Tap-to-Move kollidieren). Position: col 4 row 0, alongside Attack-Button. Größe/Style konsistent mit existing Skill-Buttons. | Draft |
| FR-11 | **Knowledge-Tree-Hook (offen)**: Roll-Parameters (Distance, i-Frame-Duration, Cooldown) müssen über zentrale Config gehen — NICHT magic numbers im Code. Damit später Tree-Node "Längere i-Frames" oder "Kürzerer Cooldown" via Buff-Registry hookbar ist. Implementation des Nodes selbst NICHT in 054. | Draft |

## 5. Non-Functional Requirements

| ID     | Requirement | Threshold |
|--------|-------------|-----------|
| NFR-01 | Roll fühlt sich snappy an. Latency Shift-Press → Roll-Start ≤16ms (1 Frame @60fps). | Subjective playtest |
| NFR-02 | Mobile-FPS darf durch Roll-VFX NICHT unter aktuelle Baseline (Procroom 20fps, Combat 40fps) fallen. | FPS-Overlay nach Implementierung |
| NFR-03 | Desktop FPS bleibt 60fps. | 1080p Standard |
| NFR-04 | Keine neuen Tests müssen 268 existierende rot machen. | `node tools/runTests.js` |
| NFR-05 | Code-Add ≤ ~150 LoC (research-Schätzung: MVP WP01-03 ≈ 120 LoC; VFX + Mobile-Button addieren ~30). | git diff line count |

## 6. Constraints

| ID    | Constraint |
|-------|------------|
| C-01  | KEIN Asset-Re-Authoring (Sprite-Frames für Roll erschaffen). Plan-B Walk-Anim-Reuse ist verbindlich. |
| C-02  | KEINE neuen Dependencies (Vanilla-JS + Phaser-built-ins). |
| C-03  | KEINE Änderung von Game-Balance (Enemy-Stats, Damage-Numbers, Boss-AOE-Telegraph-Times). 054 ist additive Player-Mechanic, nicht balance-pass. |
| C-04  | KEIN Damage-System-Refactor. Single-Chokepoint (`enemy.js:1649 applyPlayerDamage`) wird respektiert über bestehenden `_playerInvincible`-Flag. |
| C-05  | KEINE Story-/Quest-Logic-Änderung. Pure Combat-Layer. |
| C-06  | Status-Effect-Ticks (`statusEffects.js:210`) IGNORE i-Frames (research §4 Exception). Bewusster Trade-off: i-Frames nur für direkten Combat-Damage. |
| C-07  | Brute-Stun-Application (`enemy.js:1235-1239`) IGNORE i-Frames (research §4 Exception). Trade-off begründet weil Stun kein "damage" ist, sondern Status. |

## 7. Success Criteria

| ID    | Criterion |
|-------|-----------|
| SC-01 | Spieler kann Shift drücken und sich aus Boss-AOE rauswölfen (verifiziert via Run durch Akt-1 Boss). |
| SC-02 | Spieler kann durch Enemy-Cluster rollen ohne Damage zu nehmen (verifiziert: 3+ Imps im Procroom). |
| SC-03 | Roll-into-Attack-Combo funktioniert (Buffer-Timing fühlbar). |
| SC-04 | Mobile-Button ist trefferbar ohne dass Auto-Aim/Joystick stört (Mobile-Playtest). |
| SC-05 | Cooldown-Indikator ist sichtbar aber nicht aufdringlich. |
| SC-06 | Afterimage-VFX ist subtle aber lesbar als "invincible window". |
| SC-07 | Alle 268 Tests bleiben grün. |
| SC-08 | Donor-Playtester berichtet subjektiv "Combat fühlt sich besser an" oder "ich mag den Roll". |

## 8. Edge Cases

- **Roll am Wand-Rand**: Player-Body kollidiert mit Wall mid-roll. Soll der Roll früher enden (clean stop) oder gegen die Wall sliden? Empfehlung: clean stop, weil Slide klobig wirkt.
- **Roll während fallender Animation/Death**: Wenn `playerHealth ≤ 0`, Shift no-op.
- **Roll während Modal/Dialog offen**: Shift no-op (kein Combat-Layer aktiv).
- **Roll während Cutscene/Splash**: Shift no-op.
- **Roll während Mobile-Tap-to-Move aktiv**: Tap-to-Move wird beim Roll-Start gekillt (Risk #4 aus research). Sonst pullt Player nach Roll automatisch zurück zur Tap-Position.
- **Spam-Shift**: Cooldown verhindert. Visualer/Audio-Feedback dass es noch cooled.
- **Roll auf Treppe/Stair-Tile**: keine Sonderlogik nötig — Roll ist movement, Stair-Trigger feuert erst bei tatsächlicher Position auf Stair.

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| `js/inputScheme.js` | Classic + ARPG Key-Bindings. Wo Shift-Listener registriert werden muss. |
| `js/player.js` | Player-State (Health, Velocity, isDashing, isAttacking, isChargingSlash). Neuer `isRolling` Flag hier. |
| `js/enemy.js:1649` `applyPlayerDamage` | Single-Chokepoint für Combat-Damage. Respektiert bereits `window._playerInvincible`. |
| `js/main.js:2409` `spinKey` | Dead Code mit SHIFT-Binding. Wird ersetzt/weiterverwendet. |
| `js/mobileAbilityButtons.js` | 4×2 Skill-Button-Grid. Neuer Button in col 4 row 0. |
| `js/hudV2.js` | HUD-Layer. Cooldown-Indikator landet hier. |
| `js/abilitySystem.js` | Existing Cooldown-Pattern. Roll-Cooldown analog implementieren. |
| `js/particleEffects.js` | Existing VFX-Layer. Afterimage-Implementation hier. |

## 10. Assumptions

- Walk-Anim-Reuse mit Squash + TimeScale + Tint reicht als visuelle Lesbarkeit für Roll. Validierbar erst post-Implementation via Playtest.
- 90px Distance + 200ms Duration fühlt sich richtig an. Tweak nach Playtest-Feedback erwartbar.
- 600ms Cooldown erlaubt taktische Nutzung ohne Spam. Tweakable.
- Mobile-Hardware kann Afterimage-VFX schultern. Falls Mobile-FPS-Drop: VFX auf Mobile reduziert/disabled.

## 11. Out of Scope

- **Parry/Block-Mechanik** — explizit verworfen vor Spec-Start. Eigener Feature falls je gewünscht.
- **Stamina-System** — kein Cost. Eigener Feature.
- **Roll-Upgrades via Knowledge-Tree** — Hook offen halten (FR-11), implementiert nicht.
- **Roll-Frames als eigene Sprite-Assets** — Walk-Reuse via Plan B.
- **Enemy-AI-Reaktion** auf Roll (z.B. Boss "vorhersehen" und Trick-AOE) — nein, Skill-Ceiling kommt aus Player-Mastery.
- **Multi-Roll-Combo** (z.B. "3× rollen ohne Cooldown") — nein.

## 12. Dependencies

- Bestehender `_playerInvincible`-Flag in `enemy.js:1651` (= triviale Reuse).
- `js/inputScheme.js` Pattern für neue Key-Bindings.
- `js/mobileAbilityButtons.js` Pattern für neuen Button.
- Keine cross-feature dependencies (kein 052, kein 053).

## 13. Risks

- **R-01 — `isDashing` Cross-Contamination**: research §9 Risk #1. Mitigation: neuer Flag `isRolling`, NICHT `isDashing` reusen.
- **R-02 — Stuck Attack-Cooldown bei Roll-Cancel**: research §9 Risk #2. Mitigation: FR-08 cooldown-reset auf Cancel.
- **R-03 — Charge-Slash-Zombie-Fire**: research §9 Risk #3. Mitigation: Roll killed Charge-Timer explizit.
- **R-04 — Mobile Tap-to-Move Re-Pull**: research §9 Risk #4. Mitigation: `__MOBILE_MOVE_TARGET__` clear bei Roll-Start.
- **R-05 — `_smoothVelX/Y` Carry-Over**: research §9 Risk #5. Mitigation: Velocity-Smoothing-Buffer reset bei Roll-End.
- **R-06 — Mobile-FPS-Verschlechterung durch VFX**: NFR-02. Mitigation: Mobile-VFX reduziert/skipped via existing `RenderQuality.isMobile()`.
- **R-07 — Roll-Distance fühlt sich daneben an**: Subjective. Mitigation: Playtest, tweak via FR-11 zentrale Config.

## 14. References

- ROADMAP.md Phase 3 "Lateral Expansion"
- `research/code-audit.md` — vollständiger Code-Audit (Input, Movement, Damage, Mobile, VFX)
- Hades / Children-of-Morta / Hyper-Light-Drifter als Genre-Referenzen
- `kitty-specs/_done/042-arpg-control-scheme/` — Input-Scheme-Pattern als Vorbild
- Memory [[project_classic_script_scope]] — Buff-Pattern für FR-11 Knowledge-Tree-Hook
