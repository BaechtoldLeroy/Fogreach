/* =====================================================================
 * espionageSystem.js — Espionage-Mission-Mechanik (Feature 055, #30, #54)
 * ---------------------------------------------------------------------
 * Verkleidung + STEALTH (patrouillierende Wachen mit Sichtkegel) + Info-
 * Gathering. Laeuft NUR waehrend aktiver Espionage-Missionen (kuratierte
 * Raeume) — ausserhalb komplett no-op.
 *
 * #54-Umbau (echtes Schleichen):
 *  - Wachen sind bewegliche Entitaeten: patrouillieren Wegpunkte ODER scannen
 *    stationaer; sie haben eine BLICKRICHTUNG (_facing) + einen SICHTKEGEL
 *    (range + halfAngle), kein abstrakter Rundum-Radius mehr.
 *  - Detection nach Kegel-INTENSITAET (Naehe x Zentralitaet). Verkleidung =
 *    TOLERANZ, keine Unsichtbarkeit: weit/am Kegelrand bleibt folgenlos, aber
 *    nah + zentral im Blick treibt den Verdacht — auch verkleidet.
 *  - Unverkleidet (nach Angriff): jede Sicht treibt schnell hoch.
 *  - Entdeckung = Erschwernis (Recovery), KEIN Insta-Fail (C-04).
 * ===================================================================== */
(function () {
  'use strict';

  // --- Tuning -----------------------------------------------------------
  var DISGUISE_TINT = 0x8899cc;
  var DETECT_HZ_MS = 60;            // ~16×/s — fluessige Kegel-Bewegung
  var RISE_PER_SEC = 0.95;          // unverkleidet: schnell enttarnt
  var DECAY_PER_SEC = 0.7;
  var ATTACK_SPIKE = 0.6;
  var RANGE_GRACE = 1.0;
  var DISGUISE_TOLERANCE = 0.5;     // verkleidet: Sicht-Intensitaet bis hier folgenlos
  var DISGUISE_RISE_PER_SEC = 0.75; // verkleidet: Anstieg oberhalb der Toleranz
  // Wachen-Defaults (falls im Raum-Template nicht gesetzt)
  var DEF_VISION = 190;             // Sichtreichweite px
  var DEF_HALFANGLE = 0.62;         // ~35° Halbkegel
  var DEF_SPEED = 58;               // px/s Patrouille
  var DEF_PAUSE = 0.7;              // s Pause am Wegpunkt
  var DEF_SCANARC = 0.9;            // rad — stationaeres Hin-und-Her-Scannen
  var DEF_SCANSPEED = 0.85;         // Scan-Geschwindigkeit

  var DEFAULT_STATE = function () {
    return {
      active: false, missionId: null,
      disguised: false, detection: 0, exposed: false,
      observeZones: [], guards: [], cover: [],
      _acc: 0
    };
  };

  var state = DEFAULT_STATE();

  // --- interne Helfer ---------------------------------------------------
  function _player() {
    return (typeof window !== 'undefined' && window.player) ? window.player : null;
  }
  function _applyTint() {
    var p = _player();
    if (p && typeof p.setTint === 'function') { try { p.setTint(DISGUISE_TINT); } catch (_) {} }
  }
  function _clearTint() {
    var p = _player();
    if (p && typeof p.clearTint === 'function') { try { p.clearTint(); } catch (_) {} }
  }
  function _angDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function _inCover(px, py) {
    var zones = state.cover;
    if (!zones || !zones.length) return false;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (!z) continue;
      var w = z.w || 0, h = z.h || 0;
      if (px >= z.x && px <= z.x + w && py >= z.y && py <= z.y + h) return true;
    }
    return false;
  }

  // Normalisiert eine Wache aus dem Raum-Template in eine Laufzeit-Entitaet.
  function _makeGuard(g) {
    g = g || {};
    var hasFacing = (typeof g.facing === 'number');
    return {
      x: g.x || 0, y: g.y || 0,
      range: (typeof g.range === 'number' && g.range > 0) ? g.range : DEF_VISION,
      halfAngle: (typeof g.halfAngle === 'number') ? g.halfAngle : DEF_HALFANGLE,
      speed: (typeof g.speed === 'number') ? g.speed : DEF_SPEED,
      pause: (typeof g.pause === 'number') ? g.pause : DEF_PAUSE,
      patrol: (g.patrol && g.patrol.length) ? g.patrol.map(function (w) { return { x: w.x || 0, y: w.y || 0 }; }) : null,
      scanArc: (typeof g.scanArc === 'number') ? g.scanArc : DEF_SCANARC,
      // Wachen-TYP: alert=true durchschaut die Verkleidung (roter Kegel) und
      // treibt den Verdacht wie bei einem unverkleideten Spieler; alert=false
      // (Standard) laesst dich verkleidet in Ruhe, solange du nicht auffliegst.
      alert: !!(g.alert || g.seesThroughDisguise),
      knocked: false,                 // (Phase 4: Niederschlag)
      _facing: hasFacing ? g.facing : 0,
      _baseFacing: hasFacing ? g.facing : 0,
      _wpIndex: 0, _pauseT: 0, _scanT: 0
    };
  }

  // Wachen bewegen sich jeden Tick (patrouillieren oder scannen).
  function _updateGuards(dt) {
    var gs = state.guards;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (!g || g.knocked) continue;
      if (g.patrol && g.patrol.length > 1) {
        var t = g.patrol[g._wpIndex % g.patrol.length];
        var dx = t.x - g.x, dy = t.y - g.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 4) {
          g._pauseT += dt;
          if (g._pauseT >= g.pause) { g._pauseT = 0; g._wpIndex = (g._wpIndex + 1) % g.patrol.length; }
        } else {
          var step = Math.min(g.speed * dt, dist);
          g.x += (dx / dist) * step;
          g.y += (dy / dist) * step;
          g._facing = Math.atan2(dy, dx);
        }
      } else {
        // stationaer: Blick schwenkt hin und her (Sichtkegel sweept)
        g._scanT += dt;
        g._facing = g._baseFacing + Math.sin(g._scanT * DEF_SCANSPEED) * g.scanArc;
      }
    }
  }

  // Hoechste Sicht-INTENSITAET (0..1) ueber Wachen, die den Punkt im Kegel
  // haben. 0 = von keiner Wache gesehen. filter: true = nur Alarm-Wachen,
  // false = nur normale Wachen, undefined = alle.
  function _guardExposure(px, py, filter) {
    var gs = state.guards, maxI = 0;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (!g || g.knocked) continue;
      if (filter === true && !g.alert) continue;
      if (filter === false && g.alert) continue;
      var range = (g.range || DEF_VISION) * RANGE_GRACE;
      if (range <= 0) continue;
      var dx = px - g.x, dy = py - g.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range) continue;
      if (dist < 1) { maxI = 1; continue; }
      var half = g.halfAngle || DEF_HALFANGLE;
      var da = Math.abs(_angDiff(Math.atan2(dy, dx), g._facing || 0));
      if (da > half) continue;                 // ausserhalb des Sichtkegels
      var distI = 1 - dist / range;            // nah = hoch
      var angI = 1 - da / half;                // zentral = hoch
      var inten = distI * (0.45 + 0.55 * angI);
      if (inten > maxI) maxI = inten;
    }
    return maxI;
  }
  // Kompat: "wird der Punkt von irgendeiner Wache gesehen?" (Kegel-basiert).
  function _seenByGuard(px, py) { return _guardExposure(px, py) > 0.02; }

  function _expose() {
    if (state.exposed) return;
    state.exposed = true;
    state.detection = 1;
    if (state.disguised) { state.disguised = false; _clearTint(); }
    try {
      if (typeof window !== 'undefined' && window.EspionageSystem
          && typeof window.EspionageSystem.onExposed === 'function') {
        window.EspionageSystem.onExposed(state);
      }
    } catch (_) {}
  }

  var EspionageSystem = {
    // config: { missionId, guards:[{x,y,range,halfAngle?,speed?,patrol?,facing?,scanArc?}],
    //           cover:[{x,y,w,h}], observeZones:[{id,x,y,r,seconds,questTarget}] }
    startMission: function (scene, config) {
      if (state.disguised) _clearTint();
      state = DEFAULT_STATE();
      state.active = true;
      config = config || {};
      state.missionId = config.missionId || null;
      if (config.guards && config.guards.length) {
        state.guards = config.guards.map(_makeGuard);
      }
      if (config.cover && config.cover.length) state.cover = config.cover.slice();
      if (config.observeZones && config.observeZones.length) {
        for (var i = 0; i < config.observeZones.length; i++) this.registerObserveZone(config.observeZones[i]);
      }
      return state;
    },

    endMission: function () {
      var prev = state;
      if (state.disguised) _clearTint();
      state = DEFAULT_STATE();
      return prev;
    },

    isActive: function () { return !!state.active; },
    getState: function () { return state; },

    setDisguise: function (on) {
      if (!state.active) return false;
      var want = !!on;
      if (want && state.exposed) return false;
      state.disguised = want;
      if (want) _applyTint(); else _clearTint();
      return state.disguised;
    },
    isDisguised: function () { return !!(state.active && state.disguised); },

    onPlayerAttack: function () {
      if (!state.active) return false;
      var hadDisguise = state.disguised;
      if (state.disguised) { state.disguised = false; _clearTint(); }
      state.detection = Math.min(1, state.detection + ATTACK_SPIKE);
      if (state.detection >= 1) _expose();
      return hadDisguise;
    },

    // Phase 4: Niederschlag von hinten — schaltet eine Wache aus, wenn der
    // Spieler nah + AUSSERHALB ihres Sichtkegels (von hinten) ist. Gibt true,
    // wenn eine Wache ausgeschaltet wurde.
    tryTakedown: function () {
      if (!state.active || state.exposed) return false;
      var p = _player(); if (!p) return false;
      var px = p.x, py = p.y, gs = state.guards, best = null, bestD = 1e9;
      for (var i = 0; i < gs.length; i++) {
        var g = gs[i];
        if (!g || g.knocked) continue;
        var dx = px - g.x, dy = py - g.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 70) continue;                                  // nah genug?
        var da = Math.abs(_angDiff(Math.atan2(dy, dx), g._facing || 0));
        if (da < Math.PI - (g.halfAngle || DEF_HALFANGLE)) continue; // muss HINTER der Wache sein
        if (dist < bestD) { bestD = dist; best = g; }
      }
      if (best) { best.knocked = true; return true; }
      return false;
    },

    isDetected: function () { return !!(state.active && state.exposed); },
    getDetection: function () { return state.active ? state.detection : 0; },

    registerObserveZone: function (zone) {
      if (!state.active || !zone) return;
      state.observeZones.push({
        id: zone.id || null,
        x: zone.x || 0, y: zone.y || 0, r: zone.r || 64,
        seconds: (typeof zone.seconds === 'number') ? zone.seconds : 4,
        questTarget: zone.questTarget || zone.target || null,
        _elapsed: 0, _done: false
      });
    },

    update: function (scene, time, delta) {
      if (!state.active) return;
      try {
        var d = (typeof delta === 'number' && delta > 0) ? delta : 16;
        state._acc += d;
        if (state._acc < DETECT_HZ_MS) return;
        var dt = state._acc / 1000;
        state._acc = 0;

        _updateGuards(dt);   // Wachen bewegen sich IMMER

        var p = _player();
        if (!p) return;
        var px = p.x, py = p.y;
        var inCover = _inCover(px, py);
        // Getrennt: Alarm-Wachen (durchschauen die Verkleidung) vs. normale.
        var intenAlert = inCover ? 0 : _guardExposure(px, py, true);
        var intenNormal = inCover ? 0 : _guardExposure(px, py, false);
        var intenAny = Math.max(intenAlert, intenNormal);

        if (!state.exposed) {
          if (state.disguised) {
            // Verkleidet: NUR Alarm-Wachen (rote Kegel) durchschauen die
            // Verkleidung. Normale (blaue) Wachen sind komplett getaeuscht —
            // an ihnen kann man gefahrlos vorbei.
            if (intenAlert > 0.02) {
              state.detection = Math.min(1, state.detection + RISE_PER_SEC * (0.4 + 0.6 * intenAlert) * dt);
              if (state.detection >= 1) _expose();
            } else {
              state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
            }
          } else {
            // Unverkleidet: jede Sicht (egal welcher Typ) treibt schnell hoch.
            if (intenAny > 0.02) {
              state.detection = Math.min(1, state.detection + RISE_PER_SEC * (0.4 + 0.6 * intenAny) * dt);
              if (state.detection >= 1) _expose();
            } else {
              state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
            }
          }
        } else {
          // Recovery: raus aus den Sichtkegeln / in Deckung -> Verdacht faellt.
          if (!inCover && intenAny > 0.05) {
            state.detection = 1;
          } else {
            state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
            if (state.detection <= 0) { state.exposed = false; state.disguised = true; _applyTint(); }
          }
        }

        // Info-Gathering — nur solange NICHT enttarnt.
        if (!state.exposed) {
          for (var i = 0; i < state.observeZones.length; i++) {
            var z = state.observeZones[i];
            if (!z || z._done) continue;
            var rr = z.r || 0;
            var zdx = px - z.x, zdy = py - z.y;
            if (zdx * zdx + zdy * zdy <= rr * rr) {
              z._elapsed += dt;
              if (z._elapsed >= z.seconds) {
                z._done = true;
                if (z.questTarget && typeof window !== 'undefined' && window.questSystem
                    && typeof window.questSystem.updateQuestProgress === 'function') {
                  try { window.questSystem.updateQuestProgress('observe', z.questTarget, 1); } catch (_) {}
                }
              }
            } else {
              z._elapsed = 0;
            }
          }
        }
      } catch (_) { /* nie den Game-Loop brechen */ }
    }
  };

  if (typeof window !== 'undefined') window.EspionageSystem = EspionageSystem;
  if (typeof module !== 'undefined' && module.exports) module.exports = EspionageSystem;
})();
