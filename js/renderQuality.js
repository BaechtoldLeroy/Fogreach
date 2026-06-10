// Render Quality helper module (Feature 052).
//
// Provides:
//   - isMobile(): boolean — central mobile-detect for the whole app
//   - getDPR(): number — devicePixelRatio capped at MAX_DPR (=2)
//   - applyLinearFilter(scene, keys, opts): number — set LINEAR filter on a
//     list of texture keys (no-ops on missing/__MISSING/invalid textures)
//   - applyLinearFilterByPrefix(scene, prefixes, opts): number — same but
//     matches every loaded texture key starting with any given prefix
//
// Why this exists: WP02-WP06 of feature 052 all need a consistent mobile
// detection (Quality-Levers ship Desktop-only) and a one-line LINEAR-filter
// API to expand the 051 hand-picked list to every painterly asset.
// See kitty-specs/052-render-resolution-quality/research/linear-filter-inventory.md
//
// Test surface: every function is pure / scene-parameterised so unit tests
// can stub matchMedia, navigator, and scene.textures without bootstrapping
// Phaser.

(function () {
  const MAX_DPR = 2;

  function _isMobile() {
    try {
      if (typeof window === 'undefined') return false;
      // Primary: pointer-coarse media query (works on Android/iOS, accurate)
      if (typeof window.matchMedia === 'function') {
        const mm = window.matchMedia('(pointer: coarse)');
        if (mm && mm.matches) return true;
      }
      // Fallback: navigator.userAgent (covers older iOS Safari that
      // misreports pointer accuracy and edge desktop-with-touchscreen cases)
      const ua = (window.navigator && window.navigator.userAgent) || '';
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function _getDPR() {
    try {
      if (typeof window === 'undefined') return 1;
      const raw = window.devicePixelRatio;
      if (typeof raw !== 'number' || !isFinite(raw) || raw <= 0) return 1;
      return Math.min(raw, MAX_DPR);
    } catch (_) {
      return 1;
    }
  }

  function _resolveLinearMode() {
    try {
      if (typeof Phaser !== 'undefined'
          && Phaser.Textures
          && Phaser.Textures.FilterMode
          && typeof Phaser.Textures.FilterMode.LINEAR === 'number') {
        return Phaser.Textures.FilterMode.LINEAR;
      }
    } catch (_) {}
    // Phaser canonical value (3.x) — used only as fallback in test contexts
    // where Phaser isn't loaded. Real browser path always hits the try-branch.
    return 1;
  }

  function _applyToKey(scene, key, linearMode) {
    if (!scene || !scene.textures || typeof scene.textures.get !== 'function') return false;
    if (typeof key !== 'string' || key.length === 0) return false;
    const t = scene.textures.get(key);
    if (!t) return false;
    if (t.key === '__MISSING') return false;
    if (typeof t.setFilter !== 'function') return false;
    try {
      t.setFilter(linearMode);
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyLinearFilter(scene, keys, opts) {
    if (!Array.isArray(keys) || keys.length === 0) return 0;
    const linearMode = _resolveLinearMode();
    const warnOnMissing = !!(opts && opts.warnOnMissing);
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
      const ok = _applyToKey(scene, keys[i], linearMode);
      if (ok) count += 1;
      else if (warnOnMissing && typeof console !== 'undefined') {
        console.warn('[RenderQuality] LINEAR-filter skip: ' + keys[i]);
      }
    }
    return count;
  }

  function applyLinearFilterByPrefix(scene, prefixes, opts) {
    if (!Array.isArray(prefixes) || prefixes.length === 0) return 0;
    if (!scene || !scene.textures) return 0;
    // Collect texture key list — TextureManager exposes .list (object map)
    let allKeys = [];
    try {
      const list = scene.textures.list;
      if (list && typeof list === 'object') {
        allKeys = Object.keys(list);
      } else if (typeof scene.textures.getTextureKeys === 'function') {
        allKeys = scene.textures.getTextureKeys() || [];
      }
    } catch (_) {
      return 0;
    }
    if (allKeys.length === 0) return 0;
    const matched = [];
    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i];
      if (typeof key !== 'string') continue;
      for (let p = 0; p < prefixes.length; p++) {
        const pref = prefixes[p];
        if (typeof pref === 'string' && pref.length > 0 && key.indexOf(pref) === 0) {
          matched.push(key);
          break;
        }
      }
    }
    return applyLinearFilter(scene, matched, opts);
  }

  const RenderQuality = {
    MAX_DPR: MAX_DPR,
    isMobile: _isMobile,
    getDPR: _getDPR,
    applyLinearFilter: applyLinearFilter,
    applyLinearFilterByPrefix: applyLinearFilterByPrefix
  };

  if (typeof window !== 'undefined') {
    window.RenderQuality = RenderQuality;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderQuality;
  }
})();
