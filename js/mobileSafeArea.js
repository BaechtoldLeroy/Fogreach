// mobileSafeArea.js — Surface iOS/Android safe-area insets to JS for layout math.
//
// Populates `window.__SAFE_AREA__ = {top, right, bottom, left}` in CSS px by
// reading env(safe-area-inset-*) via a hidden DOM probe. Re-measures on
// orientation change / viewport resize (debounced). Requires
// <meta name="viewport" ... viewport-fit=cover> in index.html.

(function () {
  if (typeof document === 'undefined') return;

  const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
  let probe = null;
  let debounceId = null;

  function ensureProbe() {
    if (probe) return probe;
    probe = document.createElement('div');
    probe.style.cssText = [
      'position: fixed',
      'top: 0', 'left: 0',
      'width: 0', 'height: 0',
      'pointer-events: none',
      'opacity: 0',
      'visibility: hidden',
      'padding-top: env(safe-area-inset-top, 0px)',
      'padding-right: env(safe-area-inset-right, 0px)',
      'padding-bottom: env(safe-area-inset-bottom, 0px)',
      'padding-left: env(safe-area-inset-left, 0px)',
    ].join(';');
    document.body.appendChild(probe);
    return probe;
  }

  function _parsePx(str) {
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  }

  function readSafeArea() {
    try {
      if (!document.body) return Object.assign({}, ZERO);
      const el = ensureProbe();
      const cs = window.getComputedStyle(el);
      const safe = {
        top:    _parsePx(cs.paddingTop),
        right:  _parsePx(cs.paddingRight),
        bottom: _parsePx(cs.paddingBottom),
        left:   _parsePx(cs.paddingLeft),
      };
      window.__SAFE_AREA__ = safe;
      return safe;
    } catch (err) {
      window.__SAFE_AREA__ = Object.assign({}, ZERO);
      return window.__SAFE_AREA__;
    }
  }

  function scheduleRemeasure() {
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(readSafeArea, 200);
  }

  // Initial read as soon as DOM is ready.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(readSafeArea, 0);
  } else {
    document.addEventListener('DOMContentLoaded', () => readSafeArea(), { once: true });
  }

  window.addEventListener('orientationchange', scheduleRemeasure);
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', scheduleRemeasure);
  } else {
    window.addEventListener('resize', scheduleRemeasure);
  }

  // Pre-seed so consumers can read before first async tick.
  window.__SAFE_AREA__ = window.__SAFE_AREA__ || Object.assign({}, ZERO);
  window.readSafeArea = readSafeArea;
})();
