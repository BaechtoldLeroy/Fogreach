// i18n — minimal vanilla string-lookup for DE/EN.
// Public API on window.i18n (see kitty-specs/041-i18n-de-en/contracts/i18n-api.md).
// Module-files register their own keys via window.i18n.register(lang, dict).

(function () {
  const SUPPORTED = ['de', 'en'];
  const DEFAULT_LANG = 'de';

  const dicts = { de: {}, en: {} };
  let active = DEFAULT_LANG;
  const subscribers = new Set();

  function isSupported(lang) {
    return SUPPORTED.indexOf(lang) !== -1;
  }

  function register(lang, dict) {
    if (!isSupported(lang)) {
      console.warn('[i18n] register: unsupported language', lang);
      return;
    }
    if (!dict || typeof dict !== 'object') return;
    Object.assign(dicts[lang], dict);
  }

  function t(key, params) {
    let val = dicts[active] && dicts[active][key];
    // #87: Im Debug-Modus (?debug=1&i18nstrict=1) zeigt eine fehlende
    // englische Fassung sich sichtbar, statt still auf Deutsch zu fallen.
    if (val === undefined && active !== DEFAULT_LANG && _strikt()) {
      return '[EN-MISSING:' + key + ']';
    }
    if (val === undefined && active !== DEFAULT_LANG) {
      val = dicts[DEFAULT_LANG] && dicts[DEFAULT_LANG][key];
    }
    if (val === undefined) {
      console.warn('[i18n] missing key:', key);
      return '[MISSING:' + key + ']';
    }
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((k) => {
        val = val.split('{' + k + '}').join(String(params[k]));
      });
    }
    return val;
  }

  // Existence check — returns true iff the key is registered in either the
  // active language or the default fallback. Does NOT log a warning when the
  // key is missing (unlike t()), so callers can probe optional variants
  // (e.g. tutorial hints with `.classic`/`.arpg`/`.mobile` suffixes) without
  // spamming the console.
  function has(key) {
    if (dicts[active] && Object.prototype.hasOwnProperty.call(dicts[active], key)) return true;
    if (active !== DEFAULT_LANG && dicts[DEFAULT_LANG] && Object.prototype.hasOwnProperty.call(dicts[DEFAULT_LANG], key)) return true;
    return false;
  }

  function _strikt() {
    try {
      var G = window.DebugGate;
      return !!(G && typeof G.an === 'function' && G.an('i18nstrict'));
    } catch (e) { return false; }
  }

  // #87: Nur lesen — fuer tools/checkI18n.js und den Test, der fehlende
  // englische Fassungen meldet.
  function _keys(lang) {
    return isSupported(lang) ? Object.keys(dicts[lang]) : [];
  }
  function _wert(lang, key) {
    return isSupported(lang) ? dicts[lang][key] : undefined;
  }

  // #87: Ein Textfeld eines Datensatzes an einen Key binden. Der Text, der im
  // Datensatz steht, wird die deutsche Fassung; das Feld liefert danach immer
  // die aktive Sprache. Die Daten bleiben lesbar, und tools/checkI18n.js sieht
  // jede Stelle, an der die englische Fassung fehlt.
  function binden(obj, feld, key) {
    if (!obj || typeof obj[feld] !== 'string') return;
    dicts[DEFAULT_LANG][key] = obj[feld];
    Object.defineProperty(obj, feld, {
      get: function () { return t(key); },
      enumerable: true,
      configurable: true
    });
  }

  function setLanguage(lang) {
    if (!isSupported(lang)) {
      console.warn('[i18n] setLanguage: invalid language, falling back to', DEFAULT_LANG, '(was:', lang, ')');
      lang = DEFAULT_LANG;
    }
    if (lang === active) return;
    active = lang;
    subscribers.forEach((cb) => {
      try { cb(lang); } catch (err) { console.error('[i18n] subscriber error', err); }
    });
  }

  function getLanguage() {
    return active;
  }

  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    subscribers.add(callback);
    return function () { subscribers.delete(callback); };
  }

  window.i18n = { register, t, has, setLanguage, getLanguage, onChange, binden, _keys, _wert };
})();
