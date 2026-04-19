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

  window.i18n = { register, t, setLanguage, getLanguage, onChange };
})();
