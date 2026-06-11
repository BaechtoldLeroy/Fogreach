# Tasks: 054 — Dodge Roll

**Plan**: [plan.md](plan.md)
**Spec**: [spec.md](spec.md)
**Research**: [research/code-audit.md](research/code-audit.md)

## Work Package Overview

| WP   | Title                                        | Status   | Depends-on | Risk | LoC |
|------|----------------------------------------------|----------|------------|------|-----|
| WP01 | Input-Binding + State-Flag                   | 📋 Ready | —          | low  | ~20 |
| WP02 | Roll-Movement + Cooldown                     | 📋 Ready | WP01       | med  | ~40 |
| WP03 | i-Frames + Damage-Gate                       | 📋 Ready | WP01, WP02 | low  | ~10 |
| WP04 | Animation Plan-B (Squash + Tint)             | 📋 Ready | WP02       | med  | ~30 |
| WP05 | Afterimage-VFX                               | 📋 Ready | WP04       | med  | ~25 |
| WP06 | Mobile-Button + Roll-into-Attack-Combo       | 📋 Ready | WP02       | low  | ~25 |
| WP07 | Polish + Cancel-Behavior + Risk-Mitigations  | 📋 Ready | WP01-WP06  | med  | ~20 |

**MVP-Stop-Point nach WP03** für ersten Number-Tuning-Playtest.

---

## WP01 — Input-Binding + State-Flag

**Risk**: low.

### Acceptance Criteria
- `js/main.js:2409` dead `spinKey` Block ersetzt durch echten Shift-Handler
- `js/inputScheme.js` neue API `isRollPressed()` für Classic + ARPG-Scheme
- `js/player.js` neuer Flag `this.isRolling = false` initialisiert in player factory
- Shift-Press triggert noch nichts (WP02 macht Movement) — nur Flag-Set
- Andere Ability-Gates (`isAttacking`, `isChargingSlash`) respektieren `isRolling` → keine Attack-Trigger während Roll
- `playerHealth <= 0` blockt Shift-Listener (Edge-Case Section 8)

### Files
- Edit: `js/inputScheme.js` (neue Methode)
- Edit: `js/main.js` (Shift-Handler, alten spinKey-Code entfernen)
- Edit: `js/player.js` (isRolling Flag, Ability-Gates erweitern)

### Verification
- Console: `game.scene.scenes[X].player.isRolling` toggelt manuell auf true → Attacks gefangen
- `node tools/runTests.js` → 268 grün
- DevTools: Shift drücken loggt Console-Event (zu WP02-Debug entfernen)

---

## WP02 — Roll-Movement + Cooldown

**Risk**: medium.

### Acceptance Criteria
- Roll = Phaser-Tween auf Player-Position. 90px in 200ms in Direction.
- Direction = aktueller Movement-Input. Bei stillstehendem Spieler = letzte Bewegungsrichtung (cached property auf Player).
- Cooldown = 600ms ab Roll-Start. Während Cooldown: Shift no-op.
- Cooldown-Pattern analog zu `js/abilitySystem.js` (Object mit `lastUsedAt`-Timestamp).
- Cooldown-Indikator im HUD: klein, unter HP-Bar oder neben Skill-Carousel (entscheidet sich in Implementation).
- Roll-Parameters via zentrale Config (FR-11 Knowledge-Tree-Hook): `RollConfig = { distance: 90, duration: 200, cooldown: 600 }` als `window.RollConfig`, später Buff-Registry-hookable.

### Files
- Edit: `js/player.js` (Roll-Method, Tween-Choreography, Config-Object)
- Edit: `js/hudV2.js` (Cooldown-Indikator)
- Edit: `js/abilitySystem.js` (oder neuer Cooldown-Pattern-Reuse)

### Verification
- Shift + Move → Player bewegt sich 90px in Richtung
- Shift in Stillstand → letzter Movement-Direction
- Shift sofort danach → kein Effekt (Cooldown läuft)
- HUD-Indikator füllt sich in 600ms wieder auf
- Tests grün

---

## WP03 — i-Frames + Damage-Gate

**Risk**: low. 3-LoC-Insert.

### Acceptance Criteria
- `window._playerInvincible = true` beim Roll-Start
- `window._playerInvincible = false` beim Roll-Ende (200ms)
- KEINE Änderung in `enemy.js:1649` `applyPlayerDamage` — respektiert Flag bereits
- Manual-Test: stellt euch in Boss-AOE, Roll → kein Damage
- Manual-Test: DoT-Tick während Roll → Damage trifft trotzdem (C-06 Exception bewusst)
- Manual-Test: Brute-Stun während Roll → Stun trifft (C-07 Exception bewusst)

### Files
- Edit: `js/player.js` (Flag-Set/Reset in Roll-Method)

### Verification
- Spawn Imp/Brute in Procroom, Roll durch Cluster → kein Damage
- Tests grün
- DevTools: `window._playerInvincible` toggelt sichtbar während Roll

### MVP-Stop-Point

**Hier soll erster Playtest erfolgen.** 90/200/600 Number-Tuning. Sprite sieht rough aus (kein Anim/Trail), aber Mechanik funktioniert. Feedback → Config-Tweak → dann Phase 2.

---

## WP04 — Animation Plan-B

**Risk**: medium (Tween-Choreography muss zusammen lesbar sein).

### Acceptance Criteria
- Walk-Animation des Player (anim-key `walk_<dir>`) wird während Roll abgespielt mit:
  - `timeScale = 3` (3× Speed)
  - `setOrigin(0.5, 0.5)` temporär (statt default top-left/bottom-anchor) für sauberen Squash-Pivot
  - `scaleY` Tween 1.0 → 0.7 → 1.0 over 200ms
  - `setTint(0x8844cc)` (purple) für die 200ms, dann clear
- Nach Roll-End: alle Animation-Properties zurück auf default (origin, timeScale, scale, tint)
- Lesbar als "Roll-Bewegung" ohne Verwechslung mit normaler Bewegung
- Falls Walk-Anim für Direction noch nicht geladen ist (lazy `ensureDirectionLoaded`): Fallback auf static frame

### Files
- Edit: `js/player.js` (Roll-Method erweitern um Anim-Choreography)

### Verification
- Visuell: Roll ist als solcher erkennbar (squash + speed + tint)
- Visuell: Nach Roll-End ist Player wieder normal (kein Lila-Bleed)
- Tests grün

---

## WP05 — Afterimage-VFX

**Risk**: medium (Mobile-Performance-Budget kritisch).

### Acceptance Criteria
- Während 200ms Roll-Duration: 2-3 Sprite-Snapshots werden alle ~70ms in Player-Position appended
- Snapshots haben Alpha-Decay (z.B. 0.6 / 0.3 / 0.15)
- Snapshots werden nach 150ms Lebensdauer destroyed (kein Memory-Leak)
- **Mobile**: via `RenderQuality.isMobile()` entweder reduced (1 Snapshot statt 2-3) oder komplett aus — Performance-Mess entscheidet
- Mobile-FPS bleibt mindestens auf Baseline (Procroom 20fps, Combat 40fps)

### Files
- Edit: `js/particleEffects.js` (Afterimage-Helper) ODER
- Edit: `js/player.js` (inline Snapshot-Logic, falls particleEffects.js zu generisch ist)

### Verification
- Desktop: Roll → 2-3 fade-out Sprite-Ghosts hinter Player
- Mobile: FPS-Overlay zeigt unverändert (oder besser) FPS während Roll
- Tests grün
- DevTools: Memory-Snapshot nach 50 Rolls — kein Sprite-Leak

---

## WP06 — Mobile-Button + Roll-into-Attack-Buffer

**Risk**: low.

### Acceptance Criteria
- Neuer Mobile-Button in `js/mobileAbilityButtons.js` Grid-Position col 4 row 0
- Style konsistent mit existing Skill-Buttons (Größe, Background, Icon)
- Icon: einfaches Roll-/Arrow-Symbol (Unicode, kein Asset)
- Button-Tap triggert dieselbe Roll-Method wie Shift
- Roll-into-Attack-Buffer: wenn im letzten 70ms der Roll Attack gedrückt wird (Mouse-Click ARPG / Space Classic / Mobile-Attack-Button) → Attack triggert sofort nach Roll-Ende
- Buffer-Window-Latency klein genug dass es sich wie "smooth combo" anfühlt

### Files
- Edit: `js/mobileAbilityButtons.js` (neuer Button)
- Edit: `js/player.js` (Attack-Buffer-Property + Check in Roll-End-Callback)

### Verification
- Mobile: Roll-Button sichtbar, trefferbar, triggert Roll
- Desktop + Mobile: Shift/Button → letztes Drittel der Roll Attack drücken → Attack feuert direkt nach Roll-End
- Tests grün
- Mobile-Auto-Aim funktioniert weiterhin (Roll-Button stört nicht)

---

## WP07 — Polish + Cancel-Behavior + Risk-Mitigations

**Risk**: medium (5 separate Mitigations).

### Acceptance Criteria — alle 5 Risks aus spec §13 + research §9 abgedeckt
- **R-01 isDashing Cross-Contamination**: bestätigt dass `isRolling !== isDashing` und keine Code-Stelle die beiden vermischt
- **R-02 Stuck Attack-Cooldown**: wenn Roll Attack-Animation cancelt → `attackCooldown` reset auf 0
- **R-03 Charge-Slash-Zombie-Fire**: wenn Roll Charge-Slash cancelt → `chargeSlashMaxTimer` killed
- **R-04 Mobile Tap-to-Move Re-Pull**: wenn Roll auf Mobile startet → `window.__MOBILE_MOVE_TARGET__ = null`
- **R-05 _smoothVelX/Y Carry-Over**: nach Roll-End → `player._smoothVelX = 0; _smoothVelY = 0`
- Edge-Cases aus spec §8:
  - Roll am Wand-Rand: clean stop (Tween onCollision → killTween)
  - Roll während Death (`playerHealth <= 0`): Shift no-op
  - Roll während Modal/Dialog/Cutscene: Shift no-op (check global state-flags)

### Files
- Edit: `js/player.js` (alle 5 Mitigations + Edge-Case-Guards)

### Verification
- Manual Test-Plan durchlaufen:
  - Roll-cancel-Attack während Attack-Animation läuft → Attack-Cooldown sofort frei
  - Roll-cancel Charge-Slash → kein Zombie-Slash nach Roll
  - Mobile Tap-to-Move + Roll → Player bleibt nach Roll stehen (nicht zur Tap-Pos zurück)
  - Roll vs Wall: Player stoppt sauber, kein "ghost-velocity"
  - Roll während Death-Anim: no-op
  - Roll während offenem Modal (z.B. NPC-Dialog): no-op
- Alle 268 Tests grün
- ROADMAP.md updaten falls Phase-3-Status sich ändert

---

## Cross-WP Notes

- **Stop-Point nach WP03 für Number-Tuning**: 90px/200ms/600ms ist research-Vorschlag, Playtest entscheidet ob anpassen. Config liegt in `RollConfig` (WP02) — Tweak ist 1-Zeilen-Edit, kein Code-Touch.
- **Mobile-Hardware-Anforderung**: VFX-Budget eng (WP05). Falls Mobile-FPS einbricht → fallback zu "Mobile-VFX = aus".
- **054-Knowledge-Tree-Node**: separates Feature (056?). Hook ist offen via `RollConfig`-Buff-Registry-Pattern.

## Open Risks

| Risk | Mitigation |
|------|------------|
| Number-Tuning daneben | MVP-Stop nach WP03, Playtest, tweak in Config |
| Mobile-VFX killt FPS | WP05 fallback zu disabled |
| Walk-Anim-Reuse sieht klobig aus | Subjective — Playtest entscheidet ob neue Sprite-Frames doch nötig (out-of-scope für 054, eigenes Folge-Feature) |
| Edge-Case übersehen | WP07 systematisch durchlaufen, sonst kommt's als Bug-Report zurück |
