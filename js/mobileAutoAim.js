// mobileAutoAim.js — Auto-attack targeting assist for mobile.
//
// Listens for 'demonfall:ability-tap' dispatched by mobileControls.js. When
// the tapped ability is 'attack' and the joystick is below the dead zone,
// find the nearest enemy within melee range + 16 px and set
// lastMoveDirection toward it BEFORE the attack handler runs. While the
// joystick is held, only enemies ahead (within 70 deg of the run) pull the
// swing toward them.
//
// Respects window.__MOBILE_AUTO_AIM__ (populated by SettingsScene in WP05)
// and the dead zone setting from WP03.

(function () {
  function _getEnemies() {
    // Shared-script-scope globals (main.js uses `let enemies`) are visible by
    // runtime lookup; fall back to window.enemies if someone exposed it.
    try { if (typeof enemies !== 'undefined' && enemies) return enemies; } catch (e) {}
    if (window.enemies) return window.enemies;
    return null;
  }

  // Nur wen man sieht: unsichtbare (noch nicht im Kampf) und Gegner hinter
  // Wand/Tuer zaehlen nicht, sonst dreht der Schlag ins Leere.
  function _sichtbar(e) {
    if (e.visible === false) return false;
    if (typeof window.hasLineOfSightToTarget === 'function' && !window.hasLineOfSightToTarget(e)) return false;
    return true;
  }

  function findNearestEnemy(playerSprite, maxRange) {
    const group = _getEnemies();
    if (!group || !group.children || !playerSprite) return null;
    let best = null;
    let bestDistSq = maxRange * maxRange;
    group.children.iterate((e) => {
      if (!e || !e.active || !_sichtbar(e)) return;
      const dx = e.x - playerSprite.x;
      const dy = e.y - playerSprite.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        best = { enemy: e, dx, dy, dist: Math.sqrt(d2) };
        bestDistSq = d2;
      }
    });
    return best;
  }

  // Spieler wuenschten eine leichte Zielhilfe auch beim Laufen: der Schlag
  // dreht zum Gegner, der VOR einem steht (bis LAUF_KEGEL neben der
  // Laufrichtung). Wer von ihm weglaeuft, schlaegt weiter in Laufrichtung.
  const LAUF_KEGEL = Math.PI * 70 / 180;
  function findEnemyAhead(playerSprite, dirX, dirY, maxRange) {
    const group = _getEnemies();
    const len = Math.hypot(dirX, dirY);
    if (!group || !group.children || !playerSprite || len < 0.0001) return null;
    const ux = dirX / len, uy = dirY / len, minCos = Math.cos(LAUF_KEGEL);
    let best = null, bestScore = Infinity;
    group.children.iterate((e) => {
      if (!e || !e.active || !_sichtbar(e)) return;
      const dx = e.x - playerSprite.x, dy = e.y - playerSprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRange || dist < 0.001) return;
      const cos = (dx * ux + dy * uy) / dist;
      if (cos < minCos) return;
      // Naeher an der Laufrichtung zaehlt mehr als naeher am Spieler.
      const score = (1 - cos) * 2 + dist / maxRange;
      if (score < bestScore) { bestScore = score; best = { enemy: e, dx, dy, dist }; }
    });
    return best;
  }

  function _currentAutoAimRange() {
    // attackRange is a module-scoped `let` in main.js, reachable at runtime.
    try {
      if (typeof attackRange !== 'undefined' && attackRange) return attackRange + 16;
    } catch (e) {}
    return 116; // sensible fallback
  }

  function _joystickForce() {
    try { if (typeof joystick !== 'undefined' && joystick) return joystick.force || 0; } catch (e) {}
    if (window.joystick) return window.joystick.force || 0;
    return 0;
  }

  function _mobile() {
    try { if (typeof isMobile !== 'undefined') return !!isMobile; } catch (e) {}
    return !!window.isMobile;
  }

  function _aimEnabled() {
    const v = window.__MOBILE_AUTO_AIM__;
    return (v === undefined) ? true : !!v; // default ON
  }

  function _deadZone() {
    const v = window.__MOBILE_DEAD_ZONE__;
    return (typeof v === 'number' && isFinite(v)) ? v : 0.15;
  }

  function _setLastMoveDirection(dx, dy) {
    // lastMoveDirection is a Phaser.Math.Vector2 in player.js global scope.
    try {
      if (typeof lastMoveDirection !== 'undefined' && lastMoveDirection && lastMoveDirection.set) {
        lastMoveDirection.set(dx, dy).normalize();
        return true;
      }
    } catch (e) {}
    if (window.lastMoveDirection && window.lastMoveDirection.set) {
      window.lastMoveDirection.set(dx, dy).normalize();
      return true;
    }
    return false;
  }

  function _currentPlayer() {
    try { if (typeof player !== 'undefined' && player) return player; } catch (e) {}
    return window.player || null;
  }

  function onAbilityTap(event) {
    const detail = event && event.detail;
    if (!detail || detail.ability !== 'attack') return;
    if (!_mobile() || !_aimEnabled()) return;
    const playerSprite = _currentPlayer();
    if (!playerSprite) return;
    let hit;
    if (_joystickForce() > _deadZone()) {
      // Beim Laufen: nur leicht, nach vorn (lastMoveDirection = Laufrichtung).
      const lm = (typeof lastMoveDirection !== 'undefined' && lastMoveDirection) ? lastMoveDirection : window.lastMoveDirection;
      if (!lm) return;
      hit = findEnemyAhead(playerSprite, lm.x, lm.y, _currentAutoAimRange());
    } else {
      hit = findNearestEnemy(playerSprite, _currentAutoAimRange());
    }
    if (!hit) return;
    _setLastMoveDirection(hit.dx, hit.dy);
  }

  window.addEventListener('demonfall:ability-tap', onAbilityTap);

  window.mobileAutoAim = { findNearestEnemy, findEnemyAhead };
})();
