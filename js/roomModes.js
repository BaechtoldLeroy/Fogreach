/* =====================================================================
 * roomModes.js — steckbare Raum-Ziel-Modi (Feature 061, WP01)
 * ---------------------------------------------------------------------
 * Der Kern-Loop war "jeder Raum = eine Welle clearen". Diese Schicht
 * kapselt das Raum-Objektiv (Spawn/Abschluss/Treppe/HUD) hinter einem
 * Interface, sodass zusätzliche Modi (survival/defend/hunt/escape) je in
 * einer EIGENEN, self-registrierenden Datei dazukommen.
 *
 * WP01 liefert NUR das Fundament + den `clear`-Modus (verhaltensidentisch
 * zu heute) + die gewichtete Auswahl + den Bonus-Chest-Hook. Solange nur
 * `clear` registriert ist, ändert sich für den Spieler NICHTS (NFR-01).
 *
 * Interface eines Modus:
 *   start(scene, ctx)  — Raumaufbau
 *   update(dt)         — pro Frame (billig, defensiv)
 *   isComplete()       — Ziel erfüllt? (schaltet die Treppe frei)
 *   objectiveFailed()  — Ziel verfehlt? (→ kein Bonus-Chest, aber Raum offen)
 *   onWaveCleared()    — optionaler Hook, wenn die Welle geräumt ist
 *   getState()         — HUD-Datenquelle (Rendering macht ein Visuals-Modul)
 * ===================================================================== */
(function () {
  'use strict';

  var _registry = {};       // modeId -> factory(ctx)
  var _current = null;      // aktive Modus-Instanz
  var _ctx = null;          // aktueller Raum-Kontext (inkl. modeId)
  var _completedFired = false;

  // Kandidaten-Spezialmodi + Gewichte (tunebar). Nur REGISTRIERTE Modi zählen —
  // in WP01 ist noch keiner davon registriert, also fällt alles auf `clear`.
  var SPECIAL_WEIGHTS = { survival: 1, defend: 1, hunt: 1, escape: 0.8 };

  function register(id, factory) {
    if (id && typeof factory === 'function') _registry[id] = factory;
  }
  function has(id) { return Object.prototype.hasOwnProperty.call(_registry, id); }

  function create(id, ctx) {
    var f = _registry[id] || _registry.clear;
    try { return f ? f(ctx || {}) : null; }
    catch (e) { return _registry.clear ? _registry.clear(ctx || {}) : null; }
  }

  // Gewichtete Auswahl eines Modus für EINEN Raum. Erwartungswert ~1–2
  // Spezialräume pro Run, leicht mit Tiefe steigend. Harte Ausnahmen:
  // erster Raum, Boss-Raum, Espionage-Raum → immer `clear`.
  function selectForRoom(info, rng) {
    info = info || {};
    rng = (typeof rng === 'function') ? rng : Math.random;
    if (info.roomIndex === 0 || info.isBoss || info.isEspionage) return 'clear';
    var ids = Object.keys(SPECIAL_WEIGHTS).filter(function (m) { return has(m); });
    if (!ids.length) return 'clear';
    var depth = Math.max(1, info.depth || 1);
    // Pro Nicht-Erst-/Nicht-Boss-Raum die Chance, dass er speziell ist.
    // Bei ~8 solcher Räume/Run ergibt p≈0.18–0.28 im Schnitt 1–2 Spezialräume.
    var p = Math.min(0.30, 0.16 + depth * 0.004);
    if (rng() >= p) return 'clear';
    var total = 0, i;
    for (i = 0; i < ids.length; i++) total += SPECIAL_WEIGHTS[ids[i]];
    var r = rng() * total;
    for (i = 0; i < ids.length; i++) { r -= SPECIAL_WEIGHTS[ids[i]]; if (r <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }

  // Debug: ?mode=<id> erzwingt den Modus im ERSTEN Dungeon-Raum (Vorbild ?spy=1).
  function _forcedMode(info) {
    try {
      if (typeof window === 'undefined' || !window.location) return null;
      var m = /[?&]mode=([a-z]+)/.exec(window.location.search || '');
      if (m && m[1] && info && info.roomIndex === 0 && (has(m[1]) || m[1] === 'clear')) return m[1];
    } catch (e) {}
    return null;
  }

  // --- Lifecycle -----------------------------------------------------------
  function beginRoom(scene, info) {
    // Alten Modus aufräumen (z. B. Defend-Altar-Sprite), sonst bleibt er in den
    // nächsten Raum hängen.
    try { if (_current && _current.stop) _current.stop(); } catch (e) {}
    _ctx = info || {};
    _completedFired = false;
    var id = _forcedMode(_ctx) || selectForRoom(_ctx, Math.random);
    if (!has(id)) id = 'clear';
    _ctx.modeId = id;
    _current = create(id, _ctx);
    try { if (_current && _current.start) _current.start(scene, _ctx); } catch (e) {}
    return id;
  }

  function updateActive(dt) {
    if (!_current) return;
    try { if (_current.update) _current.update(dt); } catch (e) {}
    // Nicht-`clear`-Modi schalten die Treppe SELBST frei, sobald ihr Ziel
    // erfüllt ist (`clear` nutzt weiter die checkWaveEnd→markRoomCleared-Kette).
    if (!_completedFired && _ctx && _ctx.modeId !== 'clear') {
      var done = false;
      try { done = !!(_current.isComplete && _current.isComplete()); } catch (e) {}
      if (done) {
        _completedFired = true;
        // objective:true -> Ziel-Clue statt "Raum gecleart"-Toast. failed
        // unterscheidet Erfolg (✓ grün) von Fehlschlag (z. B. Altar zerstört).
        var _failed = false;
        try { _failed = !!(_current.objectiveFailed && _current.objectiveFailed()); } catch (e) {}
        try { if (typeof window.markRoomCleared === 'function') window.markRoomCleared({ objective: true, failed: _failed }); } catch (e) {}
      }
    }
  }

  // `clear` schaltet die Treppe über die bestehende checkWaveEnd-Kette frei;
  // andere Modi unterdrücken das (sie haben ihre eigene Abschluss-Bedingung).
  function allowWaveClearUnlock() {
    return !_ctx || _ctx.modeId === 'clear';
  }
  function onWaveCleared() {
    try { if (_current && _current.onWaveCleared) _current.onWaveCleared(); } catch (e) {}
  }

  function activeModeId() { return _ctx ? _ctx.modeId : 'clear'; }
  function isSpecialRoom() { return !!(_ctx && _ctx.modeId && _ctx.modeId !== 'clear'); }
  function isObjectiveComplete() { return _completedFired; }
  function objectiveFailed() {
    try { return !!(_current && _current.objectiveFailed && _current.objectiveFailed()); }
    catch (e) { return false; }
  }
  function activeState() {
    try { return (_current && _current.getState) ? _current.getState() : null; }
    catch (e) { return null; }
  }
  // Optionaler Enemy-HP-Multiplikator des aktiven Modus (z. B. survival ×2), von
  // spawnEnemy pro Gegner abgefragt. Modi ohne den Hook / `clear` liefern ×1.
  function enemyHpMultiplier() {
    try {
      if (_current && typeof _current.enemyHpMultiplier === 'function') {
        var m = _current.enemyHpMultiplier();
        if (typeof m === 'number' && m > 0) return m;
      }
    } catch (e) {}
    return 1;
  }
  function reset() {
    try { if (_current && _current.stop) _current.stop(); } catch (e) {}
    _current = null; _ctx = null; _completedFired = false;
  }

  // --- ClearMode: kapselt das heutige "Welle clearen" (verlustfrei) --------
  function ClearMode() {
    var waveCleared = false;
    return {
      start: function () { waveCleared = false; },
      update: function () {},
      onWaveCleared: function () { waveCleared = true; },
      isComplete: function () { return waveCleared; },
      objectiveFailed: function () { return false; },
      getState: function () { return { mode: 'clear' }; }
    };
  }
  register('clear', ClearMode);

  var RoomMode = {
    register: register, has: has, create: create, selectForRoom: selectForRoom,
    beginRoom: beginRoom, updateActive: updateActive,
    allowWaveClearUnlock: allowWaveClearUnlock, onWaveCleared: onWaveCleared,
    activeModeId: activeModeId, isSpecialRoom: isSpecialRoom,
    isObjectiveComplete: isObjectiveComplete,
    objectiveFailed: objectiveFailed, activeState: activeState, reset: reset,
    enemyHpMultiplier: enemyHpMultiplier,
    _SPECIAL_WEIGHTS: SPECIAL_WEIGHTS
  };
  if (typeof window !== 'undefined') window.RoomMode = RoomMode;
  if (typeof module !== 'undefined' && module.exports) module.exports = RoomMode;
})();
