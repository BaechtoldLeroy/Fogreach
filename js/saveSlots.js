// js/saveSlots.js — zentrale Slot-Namespacing-Schicht (#63).
//
// Das Spiel hatte EINEN impliziten Spielstand: jedes Subsystem schrieb seinen
// eigenen localStorage-Key (demonfall_save_v1, demonfall.skillTree.v1, ...).
// Damit mehrere Spielstaende nebeneinander existieren koennen, bekommt jeder
// fortschrittsbezogene Key einen Slot-Praefix: `demonfall.slot2.demonfall_save_v1`.
//
// WICHTIG — die eine Regel: JEDER localStorage-Zugriff im Spiel geht durch
// SlotStorage, nie direkt an localStorage. Sonst schreibt ein Subsystem an der
// Slot-Trennung vorbei und Slot 2 erbt still den Fortschritt von Slot 1. Genau
// davor warnt #63 ("sonst driftet ein Slot").
//
// GLOBAL vs. pro Slot:
//   GLOBAL  = Geraete-/Spieler-Praeferenzen, die ueber alle Spielstaende gelten
//             (Lautstaerke, Sprache, Steuerung, Schwierigkeit, Endlos-Bestwert).
//   PRO SLOT = alles, was Spielfortschritt ist.
// Unbekannte Keys gelten als PRO SLOT (+ einmalige Warnung). Das ist die sichere
// Richtung: ein vergessenes Setting wird nur laestig (setzt sich pro Slot neu),
// ein vergessener Fortschritts-Key waere Datenverlust (Slots wuerden sich
// gegenseitig ueberschreiben).
(function () {
  'use strict';

  var SLOT_COUNT = 3;

  // Diese beiden Keys beschreiben das Slot-System SELBST und duerfen nie
  // slot-praefixiert werden — sonst braeuchte man den aktiven Slot, um den
  // aktiven Slot zu lesen.
  var ACTIVE_SLOT_KEY = 'demonfall.activeSlot';
  var MIGRATED_KEY = 'demonfall.slotsMigrated.v1';

  // Geraete-weite Praeferenzen. Bewusst KEIN Fortschritt.
  // - settings/audio: Lautstaerke, Sprache, Steuerung, Debug-Flags.
  // - lastDifficulty: laut persistence.js ausdruecklich ein Setting
  //   ("difficulty ist ein Settings-Regler"), ueberlebt schon heute Neues-Spiel.
  // - endless_best: Bestwert-Anzeige, ueberlebt heute ebenfalls Neues-Spiel
  //   (steht nicht in NEW_GAME_WIPE_KEYS). Global lassen = Semantik unveraendert.
  var GLOBAL_KEYS = [
    'demonfall_settings_v1',
    'demonfall_audio',
    'demonfall_lastDifficulty',
    'demonfall_endless_best',
    ACTIVE_SLOT_KEY,
    MIGRATED_KEY
  ];

  // Fortschritts-Keys. Vollstaendigkeit zaehlt: was hier fehlt, wird zwar
  // trotzdem pro Slot behandelt (sicherer Default), aber die Migration des
  // Alt-Spielstands nach Slot 1 kennt es dann nicht und der Key ginge fuer den
  // Spieler verloren. Darum ist diese Liste die Single Source of Truth fuer
  // "was macht einen Spielstand aus".
  var SLOT_KEYS = [
    'demonfall_save_v1',            // storage.js — Hauptsave
    'demonfall_abilities_v1',       // abilitySystem
    'demonfall.knowledgeTree.v1',   // knowledgeTree
    'demonfall.skillTree.v1',       // skillTree
    'demonfall_factions_v1',        // factionSystem
    'demonfall_printinghouse_v1',   // printingHouse
    'demonfall_tutorial_v1',        // tutorialSystem
    'demonfall_maxDepth',           // persistence
    'demonfall_lastDepth',          // persistence
    'demonfall_seen_intro_splash',  // HubSceneV2
    'demonfall_seen_outro_splash'   // HubSceneV2
  ];

  var SLOT_PREFIX = 'demonfall.slot';

  function _raw(op, key, value) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      if (op === 'get') return localStorage.getItem(key);
      if (op === 'set') { localStorage.setItem(key, value); return null; }
      if (op === 'remove') { localStorage.removeItem(key); return null; }
    } catch (err) {
      try { console.warn('[SaveSlots] localStorage ' + op + ' failed for ' + key, err); } catch (_) {}
    }
    return null;
  }

  function isGlobalKey(k) { return GLOBAL_KEYS.indexOf(k) !== -1; }
  function isSlotKey(k) { return SLOT_KEYS.indexOf(k) !== -1; }

  var _warned = {};
  function _warnUnknown(k) {
    if (_warned[k]) return;
    _warned[k] = true;
    try {
      console.warn('[SaveSlots] Unbekannter Key "' + k + '" — wird pro Slot behandelt. '
        + 'Bitte in js/saveSlots.js als GLOBAL_KEYS oder SLOT_KEYS eintragen.');
    } catch (_) {}
  }

  var _activeSlot = null;

  function getActiveSlot() {
    if (_activeSlot !== null) return _activeSlot;
    var v = parseInt(_raw('get', ACTIVE_SLOT_KEY) || '1', 10);
    _activeSlot = (isFinite(v) && v >= 1 && v <= SLOT_COUNT) ? v : 1;
    return _activeSlot;
  }

  function setActiveSlot(n) {
    var s = parseInt(n, 10);
    if (!isFinite(s) || s < 1 || s > SLOT_COUNT) {
      try { console.warn('[SaveSlots] setActiveSlot: ungueltiger Slot', n); } catch (_) {}
      return getActiveSlot();
    }
    _activeSlot = s;
    _raw('set', ACTIVE_SLOT_KEY, String(s));
    return s;
  }

  // Uebersetzt einen Roh-Key in den tatsaechlichen localStorage-Key.
  function key(rawKey, slot) {
    if (!rawKey) return rawKey;
    if (isGlobalKey(rawKey)) return rawKey;
    if (!isSlotKey(rawKey)) _warnUnknown(rawKey);
    var s = (slot != null) ? slot : getActiveSlot();
    return SLOT_PREFIX + s + '.' + rawKey;
  }

  // Drop-in-Ersatz fuer localStorage. Gleiche Signatur, damit Aufrufstellen
  // sich auf `localStorage.` -> `SlotStorage.` reduzieren.
  var SlotStorage = {
    getItem: function (k) { return _raw('get', key(k)); },
    setItem: function (k, v) { return _raw('set', key(k), String(v)); },
    removeItem: function (k) { return _raw('remove', key(k)); }
  };

  // --- Slot-Verwaltung -----------------------------------------------------

  function hasSaveInSlot(slot) {
    return !!_raw('get', key('demonfall_save_v1', slot));
  }

  // Vorschau fuer die Slot-Auswahl. Liest NUR den Hauptsave — die Felder
  // stammen aus dem Payload, den storage.js schreibt.
  function getSlotMeta(slot) {
    var meta = { slot: slot, exists: false, level: 0, depth: 0, gold: 0, maxDepth: 1, ts: 0 };
    var raw = _raw('get', key('demonfall_save_v1', slot));
    if (!raw) return meta;
    meta.exists = true;
    try {
      var s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        meta.level = Math.max(0, Math.floor(Number(s.playerLevel) || 0));
        meta.depth = Math.max(1, Math.floor(Number(s.dungeonDepth || s.currentWave) || 1));
        meta.gold = Math.max(0, Math.floor(Number(s.materials && s.materials.GOLD) || 0));
        meta.ts = Number(s.ts) || 0;
      }
    } catch (err) {
      // Kaputter Save: exists bleibt true, damit der Slot nicht als "leer"
      // erscheint und stillschweigend ueberschrieben wird.
      try { console.warn('[SaveSlots] Save in Slot ' + slot + ' ist unlesbar', err); } catch (_) {}
    }
    var md = parseInt(_raw('get', key('demonfall_maxDepth', slot)) || '1', 10);
    meta.maxDepth = (isFinite(md) && md > 0) ? md : 1;
    return meta;
  }

  function listSlots() {
    var out = [];
    for (var i = 1; i <= SLOT_COUNT; i++) out.push(getSlotMeta(i));
    return out;
  }

  // Loescht ALLE Fortschritts-Keys eines Slots. Globale Keys bleiben.
  function deleteSlot(slot) {
    var s = parseInt(slot, 10);
    if (!isFinite(s) || s < 1 || s > SLOT_COUNT) return false;
    SLOT_KEYS.forEach(function (k) { _raw('remove', key(k, s)); });
    return true;
  }

  // --- Migration -----------------------------------------------------------

  // Alt-Spielstand (un-praefixierte Keys) nach Slot 1 heben. Laeuft genau
  // einmal, gelatcht ueber MIGRATED_KEY.
  //
  // KOPIEREN statt verschieben: die Alt-Keys bleiben liegen. Das kostet etwas
  // localStorage, kauft aber Rollback-Sicherheit — waere dieser Deploy kaputt,
  // faende die Vorversion ihren Spielstand unveraendert vor. Bei einem Spiel,
  // das direkt auf Pages ausgeliefert wird und wo ein Fehler den Spielstand
  // sonst unrettbar macht, ist das den Platz wert.
  function migrateLegacySave() {
    if (_raw('get', MIGRATED_KEY)) return { migrated: false, reason: 'already-done' };

    var moved = [];
    SLOT_KEYS.forEach(function (k) {
      var legacy = _raw('get', k);
      if (legacy === null || legacy === undefined) return;
      var target = SLOT_PREFIX + '1.' + k;
      // Nie ueberschreiben: liegt in Slot 1 schon etwas, gewinnt das.
      if (_raw('get', target) !== null) return;
      _raw('set', target, legacy);
      moved.push(k);
    });

    _raw('set', MIGRATED_KEY, '1');
    if (!_raw('get', ACTIVE_SLOT_KEY)) setActiveSlot(1);

    if (moved.length) {
      try { console.log('[SaveSlots] Alt-Spielstand nach Slot 1 migriert (' + moved.length + ' Keys)'); } catch (_) {}
    }
    return { migrated: moved.length > 0, keys: moved };
  }

  function _resetForTest() {
    _activeSlot = null;
    _warned = {};
  }

  // Migration laeuft beim Laden — VOR jedem Subsystem, das seinen Key liest.
  // Darum muss saveSlots.js in index.html ganz oben stehen.
  migrateLegacySave();

  window.SaveSlots = {
    SLOT_COUNT: SLOT_COUNT,
    GLOBAL_KEYS: GLOBAL_KEYS.slice(),
    SLOT_KEYS: SLOT_KEYS.slice(),
    isGlobalKey: isGlobalKey,
    isSlotKey: isSlotKey,
    key: key,
    getActiveSlot: getActiveSlot,
    setActiveSlot: setActiveSlot,
    hasSaveInSlot: hasSaveInSlot,
    getSlotMeta: getSlotMeta,
    listSlots: listSlots,
    deleteSlot: deleteSlot,
    migrateLegacySave: migrateLegacySave,
    _resetForTest: _resetForTest
  };
  window.SlotStorage = SlotStorage;
})();
