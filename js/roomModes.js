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
  var _scene = null;        // fuer den Anker-Test und den verzoegerten start()
  var _armed = false;       // Ereignis steht bereit, wartet auf Sichtkontakt (#112)
  var _anker = null;        // {x,y} des Ankerobjekts, solange scharfgestellt

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

  // Debug-Einstiege (Vorbild ?spy=1):
  //
  //   ?mode=<id>          erzwingt den Modus im ERSTEN Dungeon-Raum.
  //   ?modes=<a,b,c,...>  RUNDGANG: Raum 0 bekommt a, Raum 1 b, Raum 2 c,
  //                       danach wieder von vorn. So laesst sich jeder Modus
  //                       in einem Durchgang nacheinander ansehen, ohne den
  //                       Lauf jedes Mal neu zu starten.
  //
  // Der Boss-/Finalraum bleibt beim Rundgang ausgenommen — dort haengt der
  // Klimax des Laufs dran, den ein aufgesetztes Raumziel nur stoert.
  // Unbekannte Namen in der Liste werden verworfen, nicht stillschweigend
  // durch clear ersetzt: sonst sucht man den Tippfehler im falschen Modul.
  function _forcedMode(info) {
    try {
      if (typeof window === 'undefined' || !window.location) return null;
      var suche = window.location.search || '';

      var l = /[?&]modes=([a-z,]+)/.exec(suche);
      if (l && l[1] && info && !info.isBoss) {
        var gewuenscht = l[1].split(',');
        var liste = [], verworfen = [];
        for (var i = 0; i < gewuenscht.length; i++) {
          var id = gewuenscht[i];
          if (!id) continue;
          if (has(id) || id === 'clear') liste.push(id); else verworfen.push(id);
        }
        if (verworfen.length && typeof console !== 'undefined' && console.warn) {
          console.warn('[Rundgang] unbekannte Modi uebersprungen: ' + verworfen.join(', ')
            + ' — bekannt sind: ' + Object.keys(_registry).join(', '));
        }
        if (liste.length) {
          var n = (typeof info.roomIndex === 'number' && info.roomIndex >= 0) ? info.roomIndex : 0;
          return liste[n % liste.length];
        }
      }

      // Das '=' im Muster trennt die beiden Schalter sauber: in '?modes=a,b'
      // folgt auf 'mode' ein 's', das Muster greift dort also gar nicht. Wer
      // das hier je auf Teilstring-Suche umstellt, bricht den Rundgang.
      var m = /[?&]mode=([a-z]+)/.exec(suche);
      if (m && m[1] && info && info.roomIndex === 0 && (has(m[1]) || m[1] === 'clear')) return m[1];
    } catch (e) {}
    return null;
  }

  // Beim Rundgang mitschreiben, was der Raum vorhat. Ohne das sieht man einem
  // scharfgestellten Raum absichtlich NICHTS an (kein Banner, keine Sperre) —
  // beim Testen will man aber wissen, worauf man zulaeuft und wo es liegt.
  function _rundgangMelden(info, gearmt, anker) {
    try {
      if (typeof window === 'undefined' || !window.location) return;
      if (!/[?&]modes=/.test(window.location.search || '')) return;
      if (typeof console === 'undefined' || !console.log) return;
      var wo = gearmt
        ? (anker
            ? ' scharfgestellt, Anker bei ' + Math.round(anker.x) + '/' + Math.round(anker.y)
              + ' — hinlaufen, bis er im Blick liegt'
            : ' scharfgestellt, beweglicher Anker — losgehen, bis das Ziel im Blick liegt')
        : ' sofort gestartet';
      console.log('[Rundgang] Raum ' + (info && info.roomIndex) + ': ' + (info && info.modeId) + wo);
    } catch (e) {}
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
    _scene = scene;
    _armed = false; _anker = null;
    _current = create(id, _ctx);
    // #112: Modi mit Ankerobjekt starten NICHT beim Betreten. Sie stellen nur
    // ihr Objekt hin; das Ziel beginnt, sobald der Spieler es sieht. Modi ohne
    // `arm` (clear, escape) verhalten sich unveraendert.
    //
    // `arm` liefert entweder einen FESTEN Punkt {x,y} (defend/survival stellen
    // etwas in den Raum) oder einfach true — dann ist der Anker BEWEGLICH und
    // der Modus nennt ihn pro Frame ueber `ankerPunkt()` (hunt haengt an einem
    // Gegner, der herumlaeuft).
    if (_current && typeof _current.arm === 'function') {
      var a = null;
      try { a = _current.arm(scene, _ctx); } catch (e) { a = null; }
      var beweglich = (typeof _current.ankerPunkt === 'function');
      if (beweglich ? !!a : (a && typeof a.x === 'number' && typeof a.y === 'number' && (a.x || a.y))) {
        _anker = beweglich ? null : a;
        _armed = true;
        _rundgangMelden(_ctx, true, beweglich ? null : a);
        return id;
      }
      // Kein Platz fuer den Anker: lieber sofort starten als das Ereignis
      // stillschweigend verlieren.
    }
    _zielStarten();
    _rundgangMelden(_ctx, false, null);
    return id;
  }

  // Wo liegt der Anker GERADE? Bei einem beweglichen Anker fragt das den Modus
  // pro Frame; ein Gegner als Anker steht nicht still. null heisst: derzeit
  // nichts zu sehen (z. B. die Welle ist noch nicht gespawnt) — dann wartet der
  // Raum einfach weiter.
  function _ankerPunkt() {
    if (_current && typeof _current.ankerPunkt === 'function') {
      var p = null;
      try { p = _current.ankerPunkt(); } catch (e) { p = null; }
      return (p && typeof p.x === 'number' && typeof p.y === 'number') ? p : null;
    }
    return _anker;
  }

  // Startet das Ziel — beim Betreten (Modi ohne Anker) oder beim Sichtkontakt.
  //
  // Hier haengt seit #112 auch die Treppensperre: sie sass frueher im Raumaufbau
  // und sperrte damit, BEVOR der Spieler das Ereignis ueberhaupt sehen konnte.
  // Das Ereignis ist ein Angebot — wer es nicht annimmt, darf gehen; wer es
  // annimmt, sitzt drin. Escape ist eine Flucht: dort bleibt der Ausgang offen.
  function _zielStarten() {
    _armed = false;
    try { if (_current && _current.start) _current.start(_scene, _ctx); } catch (e) {}
    if (_ctx && _ctx.modeId && _ctx.modeId !== 'clear' && _ctx.modeId !== 'escape') {
      try {
        if (typeof window !== 'undefined' && typeof window.lockStairs === 'function') {
          window.lockStairs(_scene, true);
        }
      } catch (e) {}
    }
  }

  /**
   * Nimmt ein noch nicht ausgeloestes Ereignis zurueck (#112).
   *
   * Gerufen, wenn der Raum auf dem normalen Weg gecleart wurde: das Angebot ist
   * dann verfallen. Ohne das wuerde ein spaeterer Blick auf den Altar den
   * bereits abgeschlossenen Raum wieder zusperren.
   *
   * @returns {boolean} ob wirklich etwas zurueckgenommen wurde
   */
  function disarm() {
    if (!_armed) return false;
    _armed = false; _anker = null;
    try { if (_current && _current.stop) _current.stop(); } catch (e) {}
    _current = _registry.clear ? _registry.clear(_ctx || {}) : null;
    if (_ctx) _ctx.modeId = 'clear';
    return true;
  }
  function isArmed() { return _armed; }

  // Pause-Uhr (main.js window.__GAME_PAUSE). Beim Pausieren werden scene.time und
  // die Physik eingefroren, die Scene selbst läuft aber weiter — main.js update()
  // reicht also weiter Phasers rohes `delta` durch. Die Modus-Timer sind rein
  // delta-getrieben (Survival zählt runter, Escape ebenso) und liefen deshalb
  // während offenem Inventar munter weiter; sichtbar wurde es erst beim
  // Schliessen, weil das HUD verdeckt war -> der Timer "sprang". Gate hier statt
  // pro Modus: sonst fällt jeder neue Modus in dieselbe Falle.
  function _clockPaused() {
    return !!(typeof window !== 'undefined' && window.__GAME_PAUSE
      && window.__GAME_PAUSE.since != null);
  }

  function updateActive(dt) {
    if (!_current) return;
    if (_clockPaused()) return;
    // Scharfgestellt: nur auf Sichtkontakt warten, sonst passiert nichts.
    if (_armed) {
      var A = (typeof window !== 'undefined') ? window.RoomModeAnchor : null;
      var pkt = _ankerPunkt();
      if (pkt && A && typeof A.sichtbar === 'function' && A.sichtbar(_scene, pkt.x, pkt.y)) {
        _zielStarten();
      }
      return;
    }
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
    // Solange nur scharfgestellt, ist der Raum ein GANZ normaler Raum: die Welle
    // clearen muss ihn oeffnen und die uebliche Belohnung geben (#112).
    return !_ctx || _armed || _ctx.modeId === 'clear';
  }
  function onWaveCleared() {
    // #112: Wer den Raum leergeraeumt hat, ohne das Ereignis je zu sehen, hat es
    // verpasst — das Angebot verfaellt HIER, vor der Unlock-Abfrage in wave.js.
    // Ohne das wuerde ein spaeterer Blick auf den Anker einen bereits
    // abgeschlossenen Raum wieder zusperren.
    disarm();
    try { if (_current && _current.onWaveCleared) _current.onWaveCleared(); } catch (e) {}
  }

  function activeModeId() { return _ctx ? _ctx.modeId : 'clear'; }
  // "Ein Spezialziel LAEUFT" — nicht "der Raum hat eines vorgesehen". Banner,
  // HUD und Treppensperre haengen daran und duerfen im scharfgestellten Zustand
  // noch nicht greifen. Wer den Raum nur vormerken will (eventSystem: kein
  // Zufallsereignis obendrauf), fragt zusaetzlich isArmed().
  function isSpecialRoom() { return !!(_ctx && _ctx.modeId && _ctx.modeId !== 'clear' && !_armed); }
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
      // Vor dem Ausloesen ist die Welle eine normale Welle — der Survival-
      // Zuschlag darf sie nicht schon zaeher machen.
      if (_armed) return 1;
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
    _scene = null; _armed = false; _anker = null;
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
    isArmed: isArmed, disarm: disarm,
    enemyHpMultiplier: enemyHpMultiplier,
    _SPECIAL_WEIGHTS: SPECIAL_WEIGHTS
  };
  if (typeof window !== 'undefined') window.RoomMode = RoomMode;
  if (typeof module !== 'undefined' && module.exports) module.exports = RoomMode;
})();
