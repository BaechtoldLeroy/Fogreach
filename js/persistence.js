// Centralised persistence registry. Documents every localStorage key the game
// uses + exposes a single clearAllSaves() helper so "new game" wipes EVERY
// piece of state in one place (instead of forcing each subsystem to remember).
//
// New code should reference Persistence.KEYS rather than hard-coding strings.

(function () {
  const KEYS = Object.freeze({
    /**
     * Main save game (player stats, inventory, equipment, room progress).
     * WP03: also carries `materials.GOLD` (player gold counter). Gold lives
     * inside the existing `materials` map that storage.js already round-trips,
     * so no new localStorage key is needed. Old saves without `materials.GOLD`
     * default to 0 via `LootSystem.getGold` on first read.
     */
    SAVE: 'demonfall_save_v1',
    /** Learned abilities + active loadout + cooldowns. */
    ABILITIES: 'demonfall_abilities_v1',
    /** UI/audio settings + debug toggles. */
    SETTINGS: 'demonfall_settings_v1',
    /** Legacy audio-only key written by SoundManager pre-SettingsScene. */
    AUDIO_LEGACY: 'demonfall_audio',
    /** Last selected dungeon difficulty multiplier. */
    LAST_DIFFICULTY: 'demonfall_lastDifficulty',
    /** Knowledge Tree fragments + per-node ranks (feature 047). */
    KNOWLEDGE_TREE: 'demonfall.knowledgeTree.v1',
    /** Tiefste je erreichte Dungeon-Tiefe (Hinabstieg-Optionen). */
    MAX_DEPTH: 'demonfall_maxDepth',
    /** Zuletzt im Hinabstieg gewaehlte Tiefe (Dialog-Default). */
    LAST_DEPTH: 'demonfall_lastDepth'
  });

  // Keys that should be wiped on "new game". SETTINGS is intentionally
  // preserved — players don't expect their volume to reset when they start a
  // new run. LAST_DIFFICULTY is likewise preserved: difficulty is now a
  // Settings-Regler (kein per-Run-Picker mehr), verhaelt sich also wie ein
  // Setting und bleibt ueber Neues-Spiel erhalten.
  const NEW_GAME_WIPE_KEYS = [
    KEYS.SAVE,
    KEYS.ABILITIES,
    KEYS.KNOWLEDGE_TREE,
    KEYS.MAX_DEPTH,
    KEYS.LAST_DEPTH
  ];

  function clearAllSaves() {
    NEW_GAME_WIPE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[Persistence] failed to remove', key, err);
      }
    });
  }

  // Wipe ABSOLUTELY everything (including settings + audio). Used by debug
  // tooling, never by the new-game flow.
  function clearEverything() {
    Object.values(KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[Persistence] failed to remove', key, err);
      }
    });
  }

  function listAllKeys() {
    return Object.values(KEYS).slice();
  }

  // --- Language helpers (i18n) ---
  // Language lives inside the existing SETTINGS blob (`demonfall_settings_v1`).
  // No new localStorage key — keeps the surface minimal and consistent with
  // other settings that SettingsScene already round-trips.

  const SUPPORTED_LANGS = ['de', 'en'];
  const DEFAULT_LANG = 'de';

  function readSettingsRaw() {
    try {
      const raw = localStorage.getItem(KEYS.SETTINGS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeSettingsField(field, value) {
    const current = readSettingsRaw();
    current[field] = value;
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(current));
    } catch (err) {
      console.warn('[Persistence] writeSettingsField failed', field, err);
    }
  }

  function getLanguage() {
    const lang = readSettingsRaw().language;
    return SUPPORTED_LANGS.indexOf(lang) !== -1 ? lang : DEFAULT_LANG;
  }

  function setLanguage(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) {
      console.warn('[Persistence] setLanguage: invalid language', lang);
      return;
    }
    writeSettingsField('language', lang);
  }

  const SUPPORTED_CONTROL_SCHEMES = ['classic', 'arpg'];
  const DEFAULT_CONTROL_SCHEME = 'classic';

  function getControlScheme() {
    const value = readSettingsRaw().controlScheme;
    return SUPPORTED_CONTROL_SCHEMES.indexOf(value) !== -1 ? value : DEFAULT_CONTROL_SCHEME;
  }

  function setControlScheme(value) {
    if (SUPPORTED_CONTROL_SCHEMES.indexOf(value) === -1) {
      console.warn('[Persistence] setControlScheme: invalid scheme', value);
      return;
    }
    writeSettingsField('controlScheme', value);
  }

  // Feature 058 (#41): depth-progression persistence. MAX_DEPTH = deepest run
  // ever completed (anchors the "Hinabstieg" options); LAST_DEPTH = last chosen
  // start depth (dialog default). Centralised here so the +1 is written in
  // exactly one place (NFR-02: once per completed run, never per room/frame).
  function getMaxDepth() {
    try {
      const v = parseInt(localStorage.getItem(KEYS.MAX_DEPTH) || '0', 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (err) { return 0; }
  }

  // Increment MAX_DEPTH by exactly 1 and persist it. Returns the new value
  // (or the unchanged value if persistence fails). Caller (RunDepth) owns the
  // once-per-run idempotency guard.
  function bumpMaxDepth() {
    const next = getMaxDepth() + 1;
    try {
      localStorage.setItem(KEYS.MAX_DEPTH, String(next));
    } catch (err) {
      console.warn('[Persistence] bumpMaxDepth failed', err);
    }
    return next;
  }

  function getLastDepth() {
    try {
      const v = parseInt(localStorage.getItem(KEYS.LAST_DEPTH) || '0', 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (err) { return 0; }
  }

  function setLastDepth(depth) {
    const d = Math.max(1, Math.round(Number(depth) || 1));
    try {
      localStorage.setItem(KEYS.LAST_DEPTH, String(d));
    } catch (err) {
      console.warn('[Persistence] setLastDepth failed', err);
    }
    return d;
  }

  window.Persistence = {
    KEYS,
    clearAllSaves,
    clearEverything,
    listAllKeys,
    getLanguage,
    setLanguage,
    getControlScheme,
    setControlScheme,
    // Feature 058 (#41): run-based depth progression.
    getMaxDepth,
    bumpMaxDepth,
    getLastDepth,
    setLastDepth
  };
})();
