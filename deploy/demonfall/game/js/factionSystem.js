// factionSystem.js — three-faction standing tracker (MVP).
//
// Foundation for #46 Printing House (edicts gated on standing) and the
// future Acts 2-5 branching arc. IIFE attaches `window.FactionSystem`. Owns
// its own localStorage key (`demonfall_factions_v1`) — never bundled into
// the main save (Constraint C-02).
//
// See:
//   kitty-specs/045-faction-system-mvp/contracts/faction-system-api.md
//   kitty-specs/045-faction-system-mvp/data-model.md

(function () {
  var STORAGE_KEY = 'demonfall_factions_v1';
  var SCHEMA_VERSION = 1;
  var FACTION_IDS = ['council', 'resistance', 'independent'];

  // Tier breakpoints. Single config object — one place to retune. Spec D-03.
  var TIER_HOSTILE_MAX  = -25; // value < -25 -> hostile
  var TIER_FRIENDLY_MIN =  25; // value > 25 -> friendly (until 50)
  var TIER_ALLIED_MIN   =  50; // value > 50 -> allied

  // --- i18n string tables -------------------------------------------------
  // Registered once per language at init(). Consumed by WP02 (Aldric greeting
  // variants + Resistance-gated quest). Owned here so the keys ship with
  // this feature regardless of which scene reads them.
  var I18N_DE = {
    'faction.aldric.greet.hostile':  'Aldric: »Verschwinde. Du bist hier nicht willkommen.«',
    'faction.aldric.greet.neutral':  'Aldric: »Halte dich aus den Angelegenheiten des Rats heraus.«',
    'faction.aldric.greet.friendly': 'Aldric: »Du machst dich nützlich. Der Rat bemerkt das.«',
    'faction.aldric.greet.allied':   'Aldric: »Eine Ehre, dich zu sehen. Komm, sprechen wir.«',
    'faction.quest.resistance_fetch.title': 'Botengang für die Resistance',
    'faction.quest.resistance_fetch.desc':  'Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen.'
  };
  var I18N_EN = {
    'faction.aldric.greet.hostile':  "Aldric: 'Begone. You are not welcome here.'",
    'faction.aldric.greet.neutral':  "Aldric: 'Stay out of council business.'",
    'faction.aldric.greet.friendly': "Aldric: 'You make yourself useful. The Council notices.'",
    'faction.aldric.greet.allied':   "Aldric: 'An honor to see you. Come, let us talk.'",
    'faction.quest.resistance_fetch.title': 'Errand for the Resistance',
    'faction.quest.resistance_fetch.desc':  'Fetch the sealed bundle from the cellar. No one must see it.'
  };

  // --- Internal state -----------------------------------------------------
  var state = _freshState();
  var subscribers = new Set();
  var primitives = _defaultPrimitives();
  var _storageWarned = false;
  var _unknownFactionWarned = {}; // factionId -> bool, so we warn once per id

  function _freshState() {
    return {
      initialized: false,
      i18nRegistered: false,
      standings: { council: 0, resistance: 0, independent: 0 },
      // Recursion-safe notify queue (D-07). When a subscriber mutates inside
      // its callback, the inner notify is enqueued and drained after the
      // current loop completes — never stacks unboundedly.
      _notifying: false,
      _pendingNotify: []
    };
  }

  function _defaultPrimitives() {
    var hasWindow = typeof window !== 'undefined';
    return {
      storage: (hasWindow && window.localStorage) || {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
      },
      i18n: (hasWindow && window.i18n) || {
        register: function () {}, t: function (k) { return k; }, onChange: function () { return function () {}; }
      }
    };
  }

  // --- Helpers ------------------------------------------------------------

  function _isKnownFaction(factionId) {
    return FACTION_IDS.indexOf(factionId) >= 0;
  }

  function _clamp(v) {
    if (typeof v !== 'number' || !isFinite(v)) v = 0;
    if (v > 100)  v = 100;
    if (v < -100) v = -100;
    return Math.trunc(v);
  }

  function _warnUnknownOnce(factionId) {
    if (_unknownFactionWarned[factionId]) return;
    _unknownFactionWarned[factionId] = true;
    try { console.warn('[FactionSystem] unknown faction id:', factionId); } catch (_) {}
  }

  // --- Persistence --------------------------------------------------------

  function _persist() {
    var blob = JSON.stringify({
      version: SCHEMA_VERSION,
      standings: {
        council:     state.standings.council     | 0,
        resistance:  state.standings.resistance  | 0,
        independent: state.standings.independent | 0
      }
    });
    try {
      primitives.storage.setItem(STORAGE_KEY, blob);
    } catch (err) {
      if (!_storageWarned) {
        _storageWarned = true;
        try { console.warn('[FactionSystem] persist failed; running in-memory only', err); } catch (_) {}
      }
    }
  }

  function _loadPersisted() {
    var raw;
    try { raw = primitives.storage.getItem(STORAGE_KEY); } catch (_) { raw = null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      _clearPersisted();
      try { console.warn('[FactionSystem] discarded malformed blob'); } catch (_) {}
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
      _clearPersisted();
      try { console.warn('[FactionSystem] discarded blob with incompatible version'); } catch (_) {}
      return null;
    }
    return parsed;
  }

  function _clearPersisted() {
    try { primitives.storage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // --- Notify (recursion-safe) -------------------------------------------

  function _notify(factionId, newValue, oldValue) {
    if (state._notifying) {
      state._pendingNotify.push([factionId, newValue, oldValue]);
      return;
    }
    state._notifying = true;
    try {
      var snapshot = Array.from(subscribers);
      for (var i = 0; i < snapshot.length; i++) {
        try {
          snapshot[i](factionId, newValue, oldValue);
        } catch (err) {
          try { console.error('[FactionSystem] subscriber threw', err); } catch (_) {}
        }
      }
    } finally {
      state._notifying = false;
    }
    while (state._pendingNotify.length) {
      var args = state._pendingNotify.shift();
      _notify(args[0], args[1], args[2]);
    }
  }

  // --- Public API ---------------------------------------------------------

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    if (!state.i18nRegistered) {
      try {
        primitives.i18n.register('de', I18N_DE);
        primitives.i18n.register('en', I18N_EN);
        state.i18nRegistered = true;
      } catch (_) {
        // Swallow — consumers fall back to raw keys.
      }
    }
    var persisted = _loadPersisted();
    if (persisted && persisted.standings && typeof persisted.standings === 'object') {
      // Missing factions default to 0 (FR-08). Out-of-range values clamped.
      for (var i = 0; i < FACTION_IDS.length; i++) {
        var f = FACTION_IDS[i];
        var v = persisted.standings[f];
        state.standings[f] = (typeof v === 'number') ? _clamp(v) : 0;
      }
    }
  }

  function getStanding(factionId) {
    if (!_isKnownFaction(factionId)) return 0; // silent — spec FR-11 says safe before init too
    if (!state.initialized) return 0;
    return state.standings[factionId] | 0;
  }

  function adjustStanding(factionId, delta) {
    if (!_isKnownFaction(factionId)) {
      _warnUnknownOnce(factionId);
      return 0;
    }
    if (!state.initialized) init();
    if (typeof delta !== 'number' || !isFinite(delta) || delta === 0) {
      // Zero-delta no-op: explicitly does NOT notify (spec FR-04 + edge case).
      return state.standings[factionId];
    }
    var oldVal = state.standings[factionId];
    var newVal = _clamp(oldVal + delta);
    if (newVal === oldVal) return newVal;
    state.standings[factionId] = newVal;
    _persist();
    _notify(factionId, newVal, oldVal);
    return newVal;
  }

  function setStanding(factionId, value) {
    if (!_isKnownFaction(factionId)) {
      _warnUnknownOnce(factionId);
      return 0;
    }
    if (!state.initialized) init();
    var oldVal = state.standings[factionId];
    var newVal = _clamp(value);
    if (newVal === oldVal) return newVal;
    state.standings[factionId] = newVal;
    _persist();
    _notify(factionId, newVal, oldVal);
    return newVal;
  }

  function getTier(factionId) {
    if (!_isKnownFaction(factionId)) return 'neutral';
    var v = getStanding(factionId);
    if (v < TIER_HOSTILE_MAX)  return 'hostile';
    if (v > TIER_ALLIED_MIN)   return 'allied';
    if (v > TIER_FRIENDLY_MIN) return 'friendly';
    return 'neutral';
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.add(cb);
    return function () { subscribers.delete(cb); };
  }

  function _configureForTest(p) {
    primitives = _defaultPrimitives();
    if (p && typeof p === 'object') {
      if (p.storage) primitives.storage = p.storage;
      if (p.i18n)    primitives.i18n    = p.i18n;
    }
    state = _freshState();
    subscribers.clear();
    _storageWarned = false;
    _unknownFactionWarned = {};
  }

  // Auto-init on script load so production callers don't have to wire it.
  init();

  window.FactionSystem = {
    init: init,
    getStanding: getStanding,
    adjustStanding: adjustStanding,
    setStanding: setStanding,
    getTier: getTier,
    onChange: onChange,
    _configureForTest: _configureForTest,
    FACTIONS: { COUNCIL: 'council', RESISTANCE: 'resistance', INDEPENDENT: 'independent' },
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
