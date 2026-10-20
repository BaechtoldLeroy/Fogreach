/* =====================================================================
 * espionageSystem.js — Espionage-Mission-Mechanik (Feature 055, #30, #54)
 * ---------------------------------------------------------------------
 * Verkleidung + STEALTH (patrouillierende Wachen mit Sichtkegel) + Info-
 * Gathering. Läuft NUR während aktiver Espionage-Missionen (kuratierte
 * Räume) — ausserhalb komplett no-op.
 *
 * #54-Umbau (echtes Schleichen):
 *  - Wachen sind bewegliche Entitäten: patrouillieren Wegpunkte ODER scannen
 *    stationär; sie haben eine BLICKRICHTUNG (_facing) + einen SICHTKEGEL
 *    (range + halfAngle), kein abstrakter Rundum-Radius mehr.
 *  - Detection nach Kegel-INTENSITAET (Nähe x Zentralität). Verkleidung =
 *    TOLERANZ, keine Unsichtbarkeit: weit/am Kegelrand bleibt folgenlos, aber
 *    nah + zentral im Blick treibt den Verdacht — auch verkleidet.
 *  - Unverkleidet (nach Angriff): jede Sicht treibt schnell hoch.
 *  - Entdeckung = Erschwernis (Recovery), KEIN Insta-Fail (C-04).
 * ===================================================================== */
(function () {
  'use strict';

  // --- Tuning -----------------------------------------------------------
  var DISGUISE_TINT = 0x8899cc;
  var DETECT_HZ_MS = 60;            // ~16×/s — flüssige Kegel-Bewegung
  var RISE_PER_SEC = 0.95;          // unverkleidet: schnell enttarnt
  var DECAY_PER_SEC = 0.7;
  var ATTACK_SPIKE = 0.6;
  var RANGE_GRACE = 1.0;
  var DISGUISE_TOLERANCE = 0.5;     // verkleidet: Sicht-Intensität bis hier folgenlos
  var DISGUISE_RISE_PER_SEC = 0.75; // verkleidet: Anstieg oberhalb der Toleranz
  // Wachen-Defaults (falls im Raum-Template nicht gesetzt)
  var DEF_VISION = 190;             // Sichtreichweite px
  var DEF_HALFANGLE = 0.62;         // ~35° Halbkegel
  var DEF_SPEED = 58;               // px/s Patrouille
  var DEF_PAUSE = 0.7;              // s Pause am Wegpunkt
  var DEF_SCANARC = 0.9;            // rad — stationäres Hin-und-Her-Scannen
  var DEF_SCANSPEED = 0.85;         // Scan-Geschwindigkeit

  // --- Weitere Figuren neben den Wachen ----------------------------------
  // Spieler meldeten: "immer nur Wachen". Jede Figur hat ein eigenes Verhalten
  // und dieselbe Zeichensprache ("?" bemerkt etwas, "!" schlaegt an):
  //   schreiber  sitzt am Pult, kleiner Kegel; wer zu lange zu nah steht, nach
  //              dem ruft er die Wache (Verkleidung schuetzt nur kurz)
  //   diener     Ritualdiener, geht von Feuerschale zu Feuerschale, wie oben
  //   spitzel    wandert, erkennt Dich schnell und rennt zur naechsten Wache:
  //              fang ihn ab (beruehren), bevor er sie erreicht, sonst enttarnt
  //   ratsbote   eilt mit Depeschen von Tuer zu Tuer, sieht nur kurz nach vorn;
  //              erkennt er Dich, eilt er zur Wache und macht sie WACHSAM (roter
  //              Kegel, durchschaut die Verkleidung), enttarnt aber nicht sofort
  //   geleerter  arbeitet stumpf an seiner Station, sieht und meldet nichts
  //   traeger    traegt Kisten, sieht nichts, verdeckt aber die Sicht (bewegte
  //              Deckung); wer ihn anrempelt, macht sich verdaechtig
  //   ratte/brut feindselig in dunklen Ecken; jeder Schlag auf sie ist LAERM:
  //              Wachen in Hoerweite gehen nachsehen, der Verdacht steigt
  var ACTOR_TYPES = {
    schreiber: { watcher: true, range: 105, halfAngle: 0.8, rise: 0.32, tolerance: 0.08, solid: 22, hp: 1, speed: 0, scanArc: 0.45 },
    diener: { watcher: true, range: 135, halfAngle: 0.6, rise: 0.45, tolerance: 0.1, solid: 22, hp: 1, speed: 34, pause: 2.2 },
    spitzel: { watcher: true, informer: true, range: 175, halfAngle: 0.7, rise: 0.8, tolerance: 0.22, solid: 22, hp: 1, speed: 46, runSpeed: 105, pause: 1.2 },
    ratsbote: { watcher: true, informer: true, warns: true, range: 95, halfAngle: 0.5, rise: 0.7, tolerance: 0.15, solid: 22, hp: 1, speed: 70, runSpeed: 125, pause: 0.6 },
    traeger: { porter: true, solid: 24, hp: 1, speed: 40, pause: 1.6 },
    geleerter: { blind: true, solid: 22, hp: 2, speed: 0 },
    ratte: { vermin: true, hp: 1, speed: 92, damage: 4, aggro: 105, leash: 95, bite: 1.0 },
    brut: { vermin: true, hp: 2, speed: 72, damage: 7, aggro: 115, leash: 105, bite: 1.1 }
  };
  var NOTICE_DECAY = 0.45;          // /s, wenn die Figur Dich nicht (mehr) sieht
  var NOTICE_MARK = 0.12;           // ab hier steht das "?" ueber der Figur
  var UNDISGUISED_MULT = 1.6;       // ohne Verkleidung bemerken sie Dich schneller
  var WATCHER_ALARM = 0.5;          // Ruf eines Schreibers/Dieners: Verdacht +0.5
  var WATCHER_COOLDOWN = 5;         // s Ruhe nach einem Ruf
  var INFORMER_MAX_RUN = 7;         // s: so lange rennt der Spitzel, dann ruft er
  var INFORMER_REPORT_R = 40;       // so nah muss er an die Wache
  var INFORMER_COOLDOWN = 8;        // s nach einer Meldung
  var BOTE_ALARM = 0.35;            // Meldung des Ratsboten: Verdacht +0.35, Wache wachsam
  var INTERCEPT_R = 38;             // Spitzel beruehren = leise abfangen
  var PORTER_BLOCK_R = 22;          // Traeger mit Kiste: verdeckt die Sichtlinie
  var PORTER_BUMP_SUSPICION = 0.12;
  var PORTER_BUMP_CD = 3;
  var VERMIN_BITE_R = 26;
  var NOISE_R = 300;                // Hoerweite eines Kampfgeraeuschs
  var NOISE_SUSPICION = 0.2;
  var INVESTIGATE_T = 5;            // s: so lange sieht eine Wache nach
  var BARK_T = 2.2;                 // s: so lange steht ein Ausruf

  var DEFAULT_STATE = function () {
    return {
      active: false, missionId: null,
      disguised: false, detection: 0, exposed: false,
      observeZones: [], guards: [], cover: [], actors: [],
      barks: [], noises: [],
      blockedAt: null,                // (wx,wy)=>bool: Wand/Hindernis-Test für Wachen
      seed: 0,
      _acc: 0
    };
  };

  // Kleiner, reproduzierbarer Zufall: dieselbe Zahl, dieselbe Aufstellung.
  function _rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

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

  function _anyHostileAlive() {
    var gs = state.guards;
    for (var i = 0; i < gs.length; i++) { if (gs[i] && gs[i].hostile && !gs[i].knocked) return true; }
    return false;
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

  var GUARD_HIT_RANGE = 92;         // Reichweite des Spieler-Schwungs auf Wachen
  var GUARD_ATK_CD = 0.85;          // s zwischen Wachen-Schlägen
  var GUARD_CONTACT = 34;           // Nahkampf-Distanz Wache->Spieler
  var GUARD_SOLID_R = 26;           // Kollisionsradius: Spieler wird herausgeschoben
  var GUARD_CHASE_MULT = 1.15;      // feindselige Wachen sind etwas schneller
  var EXPOSE_AGGRO_R = 300;         // bei Enttarnung: nur Wachen im Umkreis werden feindselig

  // Normalisiert eine Wache aus dem Raum-Template in eine Laufzeit-Entität.
  function _makeGuard(g) {
    g = g || {};
    var hasFacing = (typeof g.facing === 'number');
    var isAlert = !!(g.alert || g.seesThroughDisguise);
    var hp = (typeof g.hp === 'number') ? g.hp : (isAlert ? 3 : 2);
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
      // (Standard) lässt dich verkleidet in Ruhe, solange du nicht auffliegst.
      alert: isAlert,
      // Offener Nahkampf: Wachen sind besiegbar (hp) und wehren sich (damage),
      // sobald sie feindselig werden (gesehen/getroffen).
      hp: hp, maxHp: hp,
      damage: (typeof g.damage === 'number') ? g.damage : 8,
      hostile: false,
      knocked: false,                 // niedergestreckt (hp<=0) ODER Takedown
      _atkCd: 0, _calmT: 0,
      _facing: hasFacing ? g.facing : 0,
      _baseFacing: hasFacing ? g.facing : 0,
      _wpIndex: 0, _pauseT: 0, _scanT: 0,
      _homeX: g.x || 0, _homeY: g.y || 0,
      _invest: null,                  // {x,y,t}: geht einem Geraeusch nach
      _mark: null                     // '?' | '!' | null
    };
  }

  // Eine Figur aus der Missions-Konfiguration. Ort/Weg kommen aus der
  // Auswahl in _placeActors (Zufall des Raums).
  function _makeActor(type, place, rnd) {
    var T = ACTOR_TYPES[type];
    if (!T || !place) return null;
    var route = place.route && place.route.length ? place.route.map(function (w) { return { x: w.x || 0, y: w.y || 0 }; }) : null;
    var start = route ? Math.floor(rnd() * route.length) : 0;
    var x = route ? route[start].x : (place.x || 0);
    var y = route ? route[start].y : (place.y || 0);
    var facing = (typeof place.facing === 'number') ? place.facing : 0;
    return {
      type: type, x: x, y: y,
      range: T.range || 0, halfAngle: T.halfAngle || 0,
      speed: T.speed || 0, pause: T.pause || 0,
      patrol: route, _wpIndex: route ? (start + 1) % route.length : 0, _pauseT: 0,
      hp: T.hp || 1, maxHp: T.hp || 1,
      knocked: false, quiet: false,
      _facing: facing, _baseFacing: facing, _scanT: rnd() * 6,
      _homeX: x, _homeY: y,
      _notice: 0, _cool: 0, _markT: 0, _mark: null,
      _state: 'idle',                 // spitzel: idle | report | rest; ungeziefer: idle | chase
      _target: null, _runT: 0, _biteCd: 0, _bumpCd: 0, _stopT: 0, _wanderT: 0, _wx: x, _wy: y
    };
  }

  // Waehlt je Figurentyp `count` Orte/Wege aus den Kandidaten; die Auswahl
  // haengt am Zufall des Raums, damit jeder Besuch etwas anders aussieht.
  function _placeActors(defs, rnd) {
    var out = [];
    (defs || []).forEach(function (d) {
      if (!d || !ACTOR_TYPES[d.type]) return;
      var cands = (d.routes && d.routes.length) ? d.routes.map(function (r) { return { route: r }; })
        : (d.spots || []).slice();
      for (var i = cands.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var tmp = cands[i]; cands[i] = cands[j]; cands[j] = tmp;
      }
      var n = Math.min(cands.length, (typeof d.count === 'number') ? d.count : 1);
      for (var k = 0; k < n; k++) {
        var a = _makeActor(d.type, cands[k], rnd);
        if (a) out.push(a);
      }
    });
    return out;
  }

  function _bark(ent, key) {
    state.barks.push({ ent: ent, key: key, t: 0 });
  }

  // Stoesst den Spieler aus dem Radius einer stehenden Figur (respektiert Waende).
  // true, wenn er drin stand.
  function _pushOut(p, ent, r) {
    var sdx = p.x - ent.x, sdy = p.y - ent.y;
    var sdd = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sdd >= r || sdd <= 0.001) return false;
    var tx = p.x + (sdx / sdd) * (r - sdd);
    var ty = p.y + (sdy / sdd) * (r - sdd);
    var blk = state.blockedAt;
    if (!blk || !blk(tx, ty)) {
      if (typeof p.setPosition === 'function') p.setPosition(tx, ty);
      else { p.x = tx; p.y = ty; }
    }
    return true;
  }

  // Geht ein Wegpunkt-Stueck; true, wenn der Wegpunkt erreicht ist.
  function _walkTo(ent, tx, ty, speed, dt) {
    var dx = tx - ent.x, dy = ty - ent.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return true;
    var step = Math.min(speed * dt, dist);
    _moveGuard(ent, ent.x + (dx / dist) * step, ent.y + (dy / dist) * step);
    ent._facing = Math.atan2(dy, dx);
    return false;
  }

  function _nearestGuard(x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < state.guards.length; i++) {
      var g = state.guards[i];
      if (!g || g.knocked) continue;
      var d = (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y);
      if (d < bestD) { bestD = d; best = g; }
    }
    return best;
  }

  // Schickt die naechsten Wachen (hoechstens n) nachsehen, was bei (x,y) los ist.
  function _sendGuards(x, y, n, radius) {
    var list = state.guards.filter(function (g) {
      if (!g || g.knocked || g.hostile) return false;
      var dx = g.x - x, dy = g.y - y;
      return dx * dx + dy * dy <= radius * radius;
    }).sort(function (a, b) {
      return ((a.x - x) * (a.x - x) + (a.y - y) * (a.y - y)) - ((b.x - x) * (b.x - x) + (b.y - y) * (b.y - y));
    });
    var sent = list.slice(0, n);
    sent.forEach(function (g) { g._invest = { x: x, y: y, t: INVESTIGATE_T }; });
    return sent.length;
  }

  // Kampfgeraeusch bei (x,y): Wachen in Hoerweite gehen nachsehen, wer Augen
  // hat, dreht sich hin, und der Verdacht steigt, sobald es jemand hoert.
  function _noise(x, y) {
    state.noises.push({ x: x, y: y, t: 0 });
    var heard = _sendGuards(x, y, 99, NOISE_R);
    if (heard > 0) _bark(_nearestGuard(x, y), 'laerm');
    state.actors.forEach(function (a) {
      if (!a || a.knocked || !ACTOR_TYPES[a.type].watcher) return;
      var dx = x - a.x, dy = y - a.y;
      if (dx * dx + dy * dy > NOISE_R * NOISE_R) return;
      a._facing = Math.atan2(dy, dx);
      a._notice = Math.min(0.95, a._notice + 0.25);
      heard++;
    });
    if (heard > 0 && !state.exposed) {
      state.detection = Math.min(1, state.detection + NOISE_SUSPICION);
      if (state.detection >= 1) _expose();
    }
    return heard;
  }

  // Bewegt eine Wache Richtung (nx,ny), respektiert Wände (gleitet an ihnen
  // entlang). Ohne blockedAt-Callback frei beweglich.
  function _moveGuard(g, nx, ny) {
    var b = state.blockedAt;
    if (!b) { g.x = nx; g.y = ny; return; }
    if (!b(nx, ny)) { g.x = nx; g.y = ny; return; }
    if (!b(nx, g.y)) { g.x = nx; return; }   // an Wand entlang (X)
    if (!b(g.x, ny)) { g.y = ny; return; }   // an Wand entlang (Y)
    /* eingeklemmt: keine Bewegung */
  }

  // Wachen bewegen sich jeden Tick (feindselig jagen ODER patrouillieren/scannen).
  function _updateGuards(dt) {
    var gs = state.guards;
    var p = _player();
    var scene = (p && p.scene) ? p.scene : null;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (!g || g.knocked) continue;
      // Soft-Kollision: der Spieler kann nicht DURCH eine (stehende ODER jagende)
      // Wache laufen. Bei Überlappung wird er aus dem Wachen-Radius geschoben —
      // nur wenn das Ziel begehbar ist (respektiert Wände via blockedAt).
      if (p) _pushOut(p, g, GUARD_SOLID_R);
      // Feindselig: auf den Spieler zu bewegen und im Nahkampf zuschlagen.
      if (g.hostile && p) {
        var hdx = p.x - g.x, hdy = p.y - g.y;
        var hdist = Math.sqrt(hdx * hdx + hdy * hdy);
        if (hdist > 0.001) g._facing = Math.atan2(hdy, hdx);
        if (hdist > GUARD_CONTACT) {
          var hstep = Math.min((g.speed || DEF_SPEED) * GUARD_CHASE_MULT * dt, hdist);
          _moveGuard(g, g.x + (hdx / hdist) * hstep, g.y + (hdy / hdist) * hstep);
        }
        g._atkCd = Math.max(0, (g._atkCd || 0) - dt);
        if (hdist <= GUARD_CONTACT && g._atkCd <= 0) {
          g._atkCd = GUARD_ATK_CD;
          try { if (typeof window !== 'undefined' && typeof window.applyPlayerDamage === 'function') window.applyPlayerDamage(g.damage || 8, scene); } catch (_) {}
        }
        continue;
      }
      // Einem Geraeusch oder Ruf nachgehen: hin, umsehen, dann zurueck an die Arbeit.
      if (g._invest) {
        var iv = g._invest;
        iv.t -= dt;
        var ivx = iv.x - g.x, ivy = iv.y - g.y;
        if (ivx * ivx + ivy * ivy > 46 * 46) _walkTo(g, iv.x, iv.y, (g.speed || DEF_SPEED) * 1.1, dt);
        else g._facing = Math.atan2(ivy, ivx) + Math.sin(iv.t * 2.5) * 0.8;
        if (iv.t <= 0) g._invest = null;
        continue;
      }
      if (g.patrol && g.patrol.length > 1) {
        var t = g.patrol[g._wpIndex % g.patrol.length];
        var dx = t.x - g.x, dy = t.y - g.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 4) {
          g._pauseT += dt;
          if (g._pauseT >= g.pause) { g._pauseT = 0; g._wpIndex = (g._wpIndex + 1) % g.patrol.length; }
        } else {
          var step = Math.min(g.speed * dt, dist);
          _moveGuard(g, g.x + (dx / dist) * step, g.y + (dy / dist) * step);
          g._facing = Math.atan2(dy, dx);
        }
      } else if ((g.x - g._homeX) * (g.x - g._homeX) + (g.y - g._homeY) * (g.y - g._homeY) > 16) {
        _walkTo(g, g._homeX, g._homeY, g.speed || DEF_SPEED, dt);   // nach dem Nachsehen zurueck auf den Posten
      } else {
        // stationär: Blick schwenkt hin und her (Sichtkegel sweept)
        g._scanT += dt;
        g._facing = g._baseFacing + Math.sin(g._scanT * DEF_SCANSPEED) * g.scanArc;
      }
    }
  }

  // Sichtlinie frei? Rastert die Strecke ab und prüft gegen Wände (blockedAt).
  function _losBlocked(x0, y0, x1, y1) {
    var b = state.blockedAt;
    if (!b) return false;
    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return false;
    var steps = Math.ceil(dist / 12);
    for (var i = 1; i < steps; i++) {          // Endpunkte (Wache/Spieler) auslassen
      var t = i / steps;
      if (b(x0 + dx * t, y0 + dy * t)) return true;
    }
    return false;
  }

  // Steht ein Traeger zwischen Betrachter und Punkt? (bewegte Deckung)
  function _porterBlocks(viewer, px, py) {
    var as = state.actors;
    if (!as || !as.length) return false;
    var dx = px - viewer.x, dy = py - viewer.y;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1) return false;
    for (var i = 0; i < as.length; i++) {
      var a = as[i];
      if (!a || a === viewer || a.knocked || a.type !== 'traeger') continue;
      var t = ((a.x - viewer.x) * dx + (a.y - viewer.y) * dy) / len2;
      if (t <= 0 || t >= 1) continue;
      var cx = viewer.x + dx * t - a.x, cy = viewer.y + dy * t - a.y;
      if (cx * cx + cy * cy <= PORTER_BLOCK_R * PORTER_BLOCK_R) return true;
    }
    return false;
  }
  // Fuer die Kegel-Zeichnung: verdeckt an (x,y) eine Wand ODER ein Traeger die Sicht?
  function _sightBlockedAt(x, y) {
    if (state.blockedAt && state.blockedAt(x, y)) return true;
    var as = state.actors;
    for (var i = 0; i < as.length; i++) {
      var a = as[i];
      if (!a || a.knocked || a.type !== 'traeger') continue;
      var dx = x - a.x, dy = y - a.y;
      if (dx * dx + dy * dy <= PORTER_BLOCK_R * PORTER_BLOCK_R) return true;
    }
    return false;
  }

  // Sicht-INTENSITAET (0..1) EINER Wache auf einen Punkt (0 = ausserhalb Kegel
  // ODER durch eine Wand verdeckt).
  function _coneIntensity(g, px, py) {
    if (!g || g.knocked) return 0;
    var range = (g.range || DEF_VISION) * RANGE_GRACE;
    if (range <= 0) return 0;
    var dx = px - g.x, dy = py - g.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > range) return 0;
    if (dist < 1) return 1;
    var half = g.halfAngle || DEF_HALFANGLE;
    var da = Math.abs(_angDiff(Math.atan2(dy, dx), g._facing || 0));
    if (da > half) return 0;                   // ausserhalb des Sichtkegels
    if (_losBlocked(g.x, g.y, px, py)) return 0; // Wand dazwischen -> keine Sicht
    if (_porterBlocks(g, px, py)) return 0;    // Traeger mit Kiste dazwischen
    var distI = 1 - dist / range;              // nah = hoch
    var angI = 1 - da / half;                  // zentral = hoch
    return distI * (0.45 + 0.55 * angI);
  }

  // Höchste Sicht-INTENSITAET (0..1) über Wachen, die den Punkt im Kegel
  // haben. filter: true = nur Alarm-Wachen, false = nur normale, undefined = alle.
  function _guardExposure(px, py, filter) {
    var gs = state.guards, maxI = 0;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (!g || g.knocked) continue;
      if (filter === true && !g.alert) continue;
      if (filter === false && g.alert) continue;
      var inten = _coneIntensity(g, px, py);
      if (inten > maxI) maxI = inten;
    }
    return maxI;
  }
  // Kompat: "wird der Punkt von irgendeiner Wache gesehen?" (Kegel-basiert).
  function _seenByGuard(px, py) { return _guardExposure(px, py) > 0.02; }

  // #197: von einer Wache entdeckt -> kurzer Moment an der Wache.
  // Nicht beim eigenen Angriff (onPlayerAttack), der ist kein Entdecktwerden.
  function _entdeckt(scene) {
    if (typeof window === 'undefined' || !window.SpionageSzenen) return;
    try { window.SpionageSzenen.enttarnt(scene); } catch (_) {}
  }

  function _expose() {
    if (state.exposed) return;
    state.exposed = true;
    state.detection = 1;
    if (state.disguised) { state.disguised = false; _clearTint(); }
    // Nur NAHE Wachen reagieren (werden feindselig); der Rest patrouilliert weiter.
    var pp = _player();
    if (pp) {
      for (var i = 0; i < state.guards.length; i++) {
        var g = state.guards[i];
        if (!g || g.knocked) continue;
        var dx = pp.x - g.x, dy = pp.y - g.y;
        if (dx * dx + dy * dy <= EXPOSE_AGGRO_R * EXPOSE_AGGRO_R) g.hostile = true;
      }
    }
    try {
      if (typeof window !== 'undefined' && window.EspionageSystem
          && typeof window.EspionageSystem.onExposed === 'function') {
        window.EspionageSystem.onExposed(state);
      }
    } catch (_) {}
  }

  // Ein Schreiber/Diener hat genug gesehen: er ruft die Wache.
  function _watcherCalls(a, p, scene) {
    a._notice = 0; a._cool = WATCHER_COOLDOWN; a._markT = 2;
    _bark(a, 'ruf_' + a.type);
    _sendGuards(p.x, p.y, 2, 420);
    state.detection = Math.min(1, state.detection + WATCHER_ALARM);
    if (state.detection >= 1) { _expose(); _entdeckt(scene); }
  }

  // Der Spitzel ist bei der Wache angekommen (oder hat lange genug gerannt).
  function _informerReports(a, scene) {
    a._state = 'rest'; a._cool = INFORMER_COOLDOWN; a._markT = 2; a._notice = 0;
    // Der Ratsbote meldet nur: die Wache wird wachsam, der Verdacht steigt.
    if (ACTOR_TYPES[a.type].warns) {
      _bark(a, 'bote_meldet');
      if (a._target && !a._target.knocked) a._target.alert = true;
      a._target = null;
      if (!state.exposed) {
        state.detection = Math.min(1, state.detection + BOTE_ALARM);
        if (state.detection >= 1) { _expose(); _entdeckt(scene); }
      }
      return;
    }
    _bark(a, 'meldet');
    if (a._target && !a._target.knocked) a._target.hostile = true;
    a._target = null;
    if (!state.exposed) { _expose(); _entdeckt(scene); }
  }

  function _updateActors(dt, p, scene, inCover) {
    var as = state.actors;
    for (var i = 0; i < as.length; i++) {
      var a = as[i];
      if (!a || a.knocked) { if (a) a._mark = null; continue; }
      var T = ACTOR_TYPES[a.type];
      a._markT = Math.max(0, a._markT - dt);
      a._cool = Math.max(0, a._cool - dt);
      a._bumpCd = Math.max(0, a._bumpCd - dt);

      if (T.vermin) { _updateVermin(a, T, dt, p, scene); continue; }

      // Gehen: Spitzel auf Meldung rennt, sonst Weg/Posten.
      if (a._state === 'report') {
        if (!a._target || a._target.knocked) a._target = _nearestGuard(a.x, a.y);
        a._runT += dt;
        if (a._target) _walkTo(a, a._target.x, a._target.y, T.runSpeed, dt);
        var gd = a._target ? Math.sqrt((a._target.x - a.x) * (a._target.x - a.x) + (a._target.y - a.y) * (a._target.y - a.y)) : 0;
        // Leise abfangen: wer ihn auf dem Weg erwischt, haelt ihm den Mund zu.
        if (p) {
          var ix = p.x - a.x, iy = p.y - a.y;
          if (ix * ix + iy * iy <= INTERCEPT_R * INTERCEPT_R) {
            a.knocked = true; a.quiet = true; a._state = 'idle'; a._target = null; a._mark = null;
            _bark(a, 'abgefangen');
            continue;
          }
        }
        if (!a._target || gd <= INFORMER_REPORT_R || a._runT >= INFORMER_MAX_RUN) _informerReports(a, scene);
        a._mark = '!';
        continue;
      }
      var bumped = false;
      if (p && T.solid) bumped = _pushOut(p, a, T.solid);
      if (a.patrol && a.patrol.length > 1) {
        if (bumped && T.porter && a._bumpCd <= 0) {
          // Angerempelt: der Traeger bleibt stehen und schimpft.
          a._bumpCd = PORTER_BUMP_CD; a._markT = 1.5; a._stopT = 1;
          _bark(a, 'rempler');
          if (!state.exposed) {
            state.detection = Math.min(1, state.detection + PORTER_BUMP_SUSPICION);
            if (state.detection >= 1) { _expose(); _entdeckt(scene); }
          }
        }
        var wp = a.patrol[a._wpIndex % a.patrol.length];
        if (a._stopT > 0) {
          a._stopT -= dt;
        } else if (Math.abs(wp.x - a.x) < 4 && Math.abs(wp.y - a.y) < 4) {
          a._pauseT += dt;
          if (a._pauseT >= (T.pause || 0)) { a._pauseT = 0; a._wpIndex = (a._wpIndex + 1) % a.patrol.length; }
          if (T.watcher) a._facing += Math.sin(a._scanT += dt) * 0.6 * dt;   // beim Innehalten umsehen
        } else {
          _walkTo(a, wp.x, wp.y, T.speed, dt);
        }
      } else if (T.watcher) {
        // Am Pult: meist der Blick aufs Papier (kurzer Kegel), dann und wann
        // hebt er den Kopf und sieht sich um (voller Kegel).
        a._scanT += dt;
        var zyklus = a._scanT % 6.2, schaut = zyklus >= 4;
        a.range = T.range * (schaut ? 1 : 0.55);
        a._facing = a._baseFacing + (schaut ? Math.sin((zyklus - 4) * 2.2) * (T.scanArc || 0) : 0);
      }

      if (T.porter) { a._mark = a._markT > 0 ? '?' : null; continue; }
      // Geleerte arbeiten nur: kein Blick, kein Zaehler, keine Marke.
      if (T.blind) { a._workT = (a._workT || 0) + dt; a._notice = 0; a._mark = null; continue; }

      // Bemerken (Schreiber, Diener, Spitzel): eigener Zaehler je Figur.
      if (a._state === 'rest') {
        if (a._cool <= 0) a._state = 'idle';
      } else if (!state.exposed && a._cool <= 0 && p) {
        var inten = inCover ? 0 : _coneIntensity(a, p.x, p.y);
        var eff = state.disguised ? inten - T.tolerance : inten;
        if (eff > 0.02) {
          var mult = state.disguised ? 1 : UNDISGUISED_MULT;
          a._notice = Math.min(1, a._notice + T.rise * mult * (0.4 + 0.6 * inten) * dt);
        } else {
          a._notice = Math.max(0, a._notice - NOTICE_DECAY * dt);
        }
        if (a._notice >= 1) {
          if (T.informer) {
            a._state = 'report'; a._runT = 0; a._target = _nearestGuard(a.x, a.y);
            _bark(a, 'erkannt');
          } else {
            _watcherCalls(a, p, scene);
          }
        }
      } else {
        a._notice = Math.max(0, a._notice - NOTICE_DECAY * dt);
      }
      a._mark = (a._markT > 0 || a._state === 'report') ? '!' : (a._notice > NOTICE_MARK ? '?' : null);
    }
  }

  // Ratten und Brut: bleiben in ihrer Ecke, beissen, wer ihnen zu nahe kommt.
  function _updateVermin(a, T, dt, p, scene) {
    var hx = a.x - a._homeX, hy = a.y - a._homeY;
    var pd = p ? Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y)) : Infinity;
    var pHome = p ? Math.sqrt((p.x - a._homeX) * (p.x - a._homeX) + (p.y - a._homeY) * (p.y - a._homeY)) : Infinity;
    a._biteCd = Math.max(0, a._biteCd - dt);
    if (a._state === 'chase') {
      if (!p || pHome > T.leash * 1.8) { a._state = 'idle'; }
      else {
        if (pd > VERMIN_BITE_R * 0.8) _walkTo(a, p.x, p.y, T.speed, dt);
        if (pd <= VERMIN_BITE_R && a._biteCd <= 0) {
          a._biteCd = T.bite;
          try { if (typeof window !== 'undefined' && typeof window.applyPlayerDamage === 'function') window.applyPlayerDamage(T.damage, scene); } catch (_) {}
        }
      }
    } else {
      if (p && pd <= T.aggro && pHome <= T.leash * 1.8) { a._state = 'chase'; }
      else if (hx * hx + hy * hy > 30 * 30) { _walkTo(a, a._homeX, a._homeY, T.speed * 0.6, dt); }
      else {
        // Unruhiges Scharren in der Ecke.
        a._wanderT -= dt;
        if (a._wanderT <= 0) {
          a._wanderT = 1.2 + Math.random() * 1.6;
          var ang = Math.random() * Math.PI * 2;
          a._wx = a._homeX + Math.cos(ang) * 22; a._wy = a._homeY + Math.sin(ang) * 22;
        }
        _walkTo(a, a._wx, a._wy, T.speed * 0.35, dt);
      }
    }
    a._mark = a._state === 'chase' ? '!' : null;
  }

  // "?" / "!" der Wachen: "!" feindselig, "?" sieht Dich (zaehlt) oder sieht nach.
  function _markGuards(px, py) {
    for (var i = 0; i < state.guards.length; i++) {
      var g = state.guards[i];
      if (!g || g.knocked) { if (g) g._mark = null; continue; }
      if (g.hostile) { g._mark = '!'; continue; }
      var counts = g.alert || !state.disguised;
      g._mark = (g._invest || (counts && _coneIntensity(g, px, py) > 0.02)) ? '?' : null;
    }
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
      if (typeof config.blockedAt === 'function') state.blockedAt = config.blockedAt;
      // actors:[{type, count, spots:[{x,y,facing}] | routes:[[{x,y},..]]}]: welche
      // Kandidaten zum Zug kommen, entscheidet seed (reproduzierbar).
      state.seed = (typeof config.seed === 'number') ? config.seed : Math.floor(Math.random() * 1e9);
      if (config.actors && config.actors.length) state.actors = _placeActors(config.actors, _rng(state.seed));
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

    // Offener Nahkampf: der Spieler-Schwung trifft Wachen im vorderen Kegel.
    // Jeder Treffer -1 hp + macht die Wache feindselig; hp<=0 -> niedergestreckt
    // (Sichtkegel verschwindet). Gibt Anzahl getroffener Wachen zurück.
    attackGuards: function (px, py, dirX, dirY, range) {
      if (!state.active) return 0;
      var gs = state.guards, hits = 0;
      var rng = (typeof range === 'number' && range > 0) ? range : GUARD_HIT_RANGE;
      var hasDir = (typeof dirX === 'number' && typeof dirY === 'number' && (dirX || dirY));
      for (var i = 0; i < gs.length; i++) {
        var g = gs[i];
        if (!g || g.knocked) continue;
        var dx = g.x - px, dy = g.y - py;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rng) continue;
        if (hasDir && dist > 1) {
          var dot = (dx / dist) * dirX + (dy / dist) * dirY;
          if (dot < 0.35) continue;            // nur ~70° nach vorn
        }
        g.hostile = true;
        g.hp = (typeof g.hp === 'number' ? g.hp : 3) - 1;
        hits++;
        if (g.hp <= 0) { g.knocked = true; g.hostile = false; }
      }
      // Dieselbe Klinge trifft die anderen Figuren, und jeder Treffer ist laut.
      var as = state.actors;
      for (var k = 0; k < as.length; k++) {
        var a = as[k];
        if (!a || a.knocked) continue;
        var ax = a.x - px, ay = a.y - py;
        var ad = Math.sqrt(ax * ax + ay * ay);
        if (ad > rng) continue;
        if (hasDir && ad > 1 && ((ax / ad) * dirX + (ay / ad) * dirY) < 0.35) continue;
        a.hp -= 1;
        hits++;
        if (a.hp <= 0) { a.knocked = true; a._state = 'idle'; a._target = null; a._mark = null; }
        else if (ACTOR_TYPES[a.type].vermin) a._state = 'chase';
        _noise(a.x, a.y);
      }
      return hits;
    },

    // Hoechster Bemerk-Zaehler der Figuren (0..1) fuer die Anzeige "VERDAECHTIG".
    getNotice: function () {
      if (!state.active) return 0;
      var m = 0;
      state.actors.forEach(function (a) { if (a && !a.knocked && a._notice > m) m = a._notice; });
      return m;
    },
    // Verdeckt an (x,y) eine Wand oder ein Traeger die Sicht? (Kegel-Zeichnung)
    sightBlockedAt: function (x, y) { return _sightBlockedAt(x, y); },
    // Nur fuer Tests/Debug: ein Kampfgeraeusch ausloesen.
    _noise: function (x, y) { return state.active ? _noise(x, y) : 0; },
    ACTOR_TYPES: ACTOR_TYPES,

    isDetected: function () { return !!(state.active && state.exposed); },
    // #158: Die Verkleidung faellt auf Wunsch der Geschichte (Konvoi: Klinge
    // gezogen) — dieselbe Folge wie ein entdeckter Angriff.
    enttarnen: function () { if (state.active) _expose(); },
    // Nachteskorte: der Fuhrmann vermisst seine Eskorte. Treibt den Verdacht;
    // voll laesst er die Verkleidung auffliegen wie eine Entdeckung.
    verdacht: function (menge) {
      if (!state.active || state.exposed) return;
      state.detection = Math.min(1, state.detection + (menge || 0));
      if (state.detection >= 1) _expose();
    },
    getDetection: function () { return state.active ? state.detection : 0; },

    registerObserveZone: function (zone) {
      if (!state.active || !zone) return;
      state.observeZones.push({
        id: zone.id || null,
        x: zone.x || 0, y: zone.y || 0, r: zone.r || 64,
        seconds: (typeof zone.seconds === 'number') ? zone.seconds : 4,
        questTarget: zone.questTarget || zone.target || null,
        // Nachteskorte: die Station zaehlt erst, wenn der Karren dort haelt.
        gesperrt: !!zone.gesperrt,
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
        state.barks = state.barks.filter(function (b) { b.t += dt; return b.t < BARK_T; });
        state.noises = state.noises.filter(function (n) { n.t += dt; return n.t < 0.8; });

        var p = _player();
        var inCover = p ? _inCover(p.x, p.y) : false;
        _updateActors(dt, p, scene, inCover);
        if (!p) return;
        var px = p.x, py = p.y;
        _markGuards(px, py);
        // Getrennt: Alarm-Wachen (durchschauen die Verkleidung) vs. normale.
        var intenAlert = inCover ? 0 : _guardExposure(px, py, true);
        var intenNormal = inCover ? 0 : _guardExposure(px, py, false);
        var intenAny = Math.max(intenAlert, intenNormal);

        // Alarm-Wachen, die den Spieler sehen, werden feindselig (jagen + Nahkampf).
        for (var hi = 0; hi < state.guards.length; hi++) {
          var hg = state.guards[hi];
          if (!hg || hg.knocked || hg.hostile || !hg.alert) continue;
          if (_coneIntensity(hg, px, py) > 0.02) hg.hostile = true;
        }
        // Feindselige Wachen beruhigen sich, wenn sie den Spieler länger nicht
        // sehen UND er weit weg ist -> kehren zur Patrouille zurück.
        for (var ci = 0; ci < state.guards.length; ci++) {
          var cg = state.guards[ci];
          if (!cg || cg.knocked || !cg.hostile) continue;
          if (_coneIntensity(cg, px, py) > 0.02) { cg._calmT = 0; continue; }
          cg._calmT = (cg._calmT || 0) + dt;
          var rr = (cg.range || DEF_VISION);
          var cdx = px - cg.x, cdy = py - cg.y;
          if (cg._calmT > 4 && (cdx * cdx + cdy * cdy) > rr * rr * 2.25) { cg.hostile = false; cg._calmT = 0; }
        }

        if (!state.exposed) {
          if (state.disguised) {
            // Verkleidet: NUR Alarm-Wachen (rote Kegel) durchschauen die
            // Verkleidung. Normale (blaue) Wachen sind komplett getäuscht —
            // an ihnen kann man gefahrlos vorbei.
            if (intenAlert > 0.02) {
              state.detection = Math.min(1, state.detection + RISE_PER_SEC * (0.4 + 0.6 * intenAlert) * dt);
              if (state.detection >= 1) { _expose(); _entdeckt(scene); }
            } else {
              state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
            }
          } else {
            // Unverkleidet: jede Sicht (egal welcher Typ) treibt schnell hoch.
            if (intenAny > 0.02) {
              state.detection = Math.min(1, state.detection + RISE_PER_SEC * (0.4 + 0.6 * intenAny) * dt);
              if (state.detection >= 1) { _expose(); _entdeckt(scene); }
            } else {
              state.detection = Math.max(0, state.detection - DECAY_PER_SEC * dt);
            }
          }
          // Wieder untertauchen: unverkleidet (z.B. nach einem Angriff) + kein
          // Verdacht + keine Alarm-Wache sieht dich + keine feindselige Wache mehr
          // aktiv -> die Verkleidung kehrt automatisch zurück.
          if (!state.disguised && state.detection <= 0 && intenAlert <= 0.02 && !_anyHostileAlive()) {
            state.disguised = true; _applyTint();
          }
        } else {
          // Recovery: raus aus den Sichtkegeln / in Deckung -> Verdacht fällt.
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
            if (!z || z._done || z.gesperrt) continue;
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
                // #159: Die geheime Sitzung ist belauscht — sie spielt jetzt.
                if (z.questTarget === 'collusion_reveal_seen' && typeof window !== 'undefined'
                    && window.storyScenes && typeof window.storyScenes.playGeheimeSitzung === 'function') {
                  try { window.storyScenes.playGeheimeSitzung(scene); } catch (_) {}
                }
                // #197: das mitgehoerte Gespraech als Zwischenszene.
                var szene = null;
                if (typeof window !== 'undefined' && window.SpionageSzenen) {
                  var alleGehoert = state.observeZones.every(function (oz) { return !oz || oz._done; });
                  try { szene = window.SpionageSzenen.belauscht(scene, z, alleGehoert); } catch (_) {}
                }
                // #158: Am Konvoi faellt eine Entscheidung (Bibel v5, Abschnitt 9).
                // Spielt die Abhoer-Szene, ruft sie sie an ihrem Ende selbst —
                // hier nur, wenn keine Szene zustande kam (sonst zwei Dialoge).
                if (z.questTarget === 'convoy_intel' && !szene && typeof window !== 'undefined'
                    && window.Finale && typeof window.Finale.konvoi === 'function') {
                  try { window.Finale.konvoi(scene); } catch (_) {}
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
