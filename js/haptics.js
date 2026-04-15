// haptics.js — Minimal wrapper around navigator.vibrate() with a
// user-toggleable kill switch. Subscribes to the mobile CustomEvent bus.
//
// Gated by window.__MOBILE_HAPTICS__ (populated by SettingsScene, default ON).
// Silently no-ops where navigator.vibrate is unavailable (e.g. iOS Safari).

(function () {
  function _supported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function _enabled() {
    const v = window.__MOBILE_HAPTICS__;
    return (v === undefined) ? true : !!v;
  }

  function _vibrate(pattern) {
    if (!_supported() || !_enabled()) return false;
    try { navigator.vibrate(pattern); return true; } catch (err) { return false; }
  }

  function tap()      { _vibrate(10); }
  function hit()      { _vibrate(25); }
  function damage()   { _vibrate(50); }
  function levelUp()  { _vibrate([30, 30, 80]); }

  window.Haptics = { tap, hit, damage, levelUp };

  // Wired to the events emitted by mobileControls.js. hit/damage/level-up
  // wiring is scoped out per WP05 T002 — left for a follow-up since existing
  // code paths don't emit those CustomEvents yet.
  window.addEventListener('demonfall:ability-tap', tap);
  window.addEventListener('demonfall:player-hit-connect', hit);
  window.addEventListener('demonfall:player-damaged', damage);
  window.addEventListener('demonfall:level-up', levelUp);
})();
