/* =====================================================================
 * perfProbe.js — WP01 Mobile-Diagnose-Probe (Feature 053)
 * ---------------------------------------------------------------------
 * Zweck: liefert die in tasks.md WP01 geforderten Frame-Counter
 * (FPS, #GameObjects, #Physics-Bodies, Draw-Calls/Frame, #Texturen,
 * geschätzte Texture-VRAM, JS-Heap) als Live-Overlay — damit die
 * Mobile-Diagnose OHNE Chrome-DevTools ablesbar ist.
 *
 * AKTIVIERUNG: nur wenn die URL `?perf=1` enthält. Sonst kompletter
 * No-Op (kein Overlay, keine Hooks, null Overhead im Normalbetrieb).
 *
 * Bedienung Mobile:
 *   1. Spiel öffnen mit  index.html?perf=1
 *   2. Durch Hub → Combat-Room → Procroom laufen, je ~20-30s stehen.
 *   3. Overlay-Zahlen ablesen / screenshotten.
 *   4. Auf "⤓ DUMP" tippen → strukturierter Report landet in der
 *      Zwischenablage (und window.__perfDump() in der Konsole).
 *
 * Das Modul ist bewusst defensiv (try/catch überall): ein API-Mismatch
 * darf das Spiel NIE crashen — im Zweifel zeigt das Feld "—".
 * ===================================================================== */
(function () {
  'use strict';

  // --- Gate: nur bei ?perf=1 aktiv -----------------------------------
  try {
    var qs = (typeof window !== 'undefined' && window.location && window.location.search) || '';
    if (!/[?&]perf=1\b/.test(qs)) return;
  } catch (e) { return; }

  var DRAW = { frame: 0, last: 0 };     // Draw-Calls: laufend / letzter Frame
  var samples = {};                     // Kontext-Key -> { fpsMin, fpsSum, n, ... }
  var glHooked = false;

  // Live-Diagnose-Toggles: vom Spiel honoriert (updateFogOfWar).
  // Zero-Effekt für normale Spieler, weil __PERF nur bei ?perf=1 existiert.
  // Initialzustand optional aus URL (z.B. &nofog=1 / &nospot=1).
  function _numParam(name) {
    var m = new RegExp('[?&]' + name + '=([0-9.]+)').exec(window.location.search);
    return m ? parseFloat(m[1]) : undefined;
  }
  window.__PERF = window.__PERF || {
    nofog: /[?&]nofog=1\b/.test(window.location.search),
    nomask: /[?&]nomask=1\b/.test(window.location.search),
    nospot: /[?&]nospot=1\b/.test(window.location.search),
    noexpl: /[?&]noexpl=1\b/.test(window.location.search),
    // Numerische Live-Tuner (vom Spiel honoriert): explRes (RT-Auflösung
    // 0..1), fogInterval (Update jeden N-ten Frame), rays (Vision-Rays).
    explRes: _numParam('explRes'),
    fogInterval: _numParam('fogInterval'),
    rays: _numParam('rays')
  };

  // --- Overlay-DOM ----------------------------------------------------
  function buildOverlay() {
    var box = document.createElement('div');
    box.id = 'perf-probe-overlay';
    box.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'z-index:99999',
      'font:10px/1.3 monospace', 'color:#0f0',
      'background:rgba(0,0,0,0.7)', 'padding:3px 5px',
      'white-space:pre', 'pointer-events:none',
      'border-bottom-right-radius:6px', 'max-width:44vw',
      'text-shadow:0 0 2px #000'
    ].join(';');

    var pre = document.createElement('div');
    pre.id = 'perf-probe-text';
    box.appendChild(pre);

    var btn = document.createElement('button');
    btn.id = 'perf-probe-dump';
    btn.textContent = '⤓ DUMP';
    btn.style.cssText = [
      'pointer-events:auto', 'margin-top:4px', 'width:100%',
      'font:bold 12px monospace', 'color:#000', 'background:#0f0',
      'border:0', 'border-radius:4px', 'padding:5px 0', 'cursor:pointer'
    ].join(';');
    btn.addEventListener('click', function () {
      var report = window.__perfDump();
      try {
        var json = JSON.stringify(report, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json);
        }
        btn.textContent = '✓ kopiert (' + Object.keys(report.contexts).length + ' Kontexte)';
        setTimeout(function () { btn.textContent = '⤓ DUMP'; }, 1800);
      } catch (e) { btn.textContent = '⤓ DUMP'; }
    });
    box.appendChild(btn);

    // Live-Toggle-Buttons (A/B ohne Reload): FOG + CULL an/aus.
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;pointer-events:none';
    function mkToggle(label, flag) {
      var t = document.createElement('button');
      t.style.cssText = [
        'pointer-events:auto', 'flex:1 0 40%', 'font:bold 11px monospace',
        'border:0', 'border-radius:4px', 'padding:4px 0', 'cursor:pointer'
      ].join(';');
      var paint = function () {
        var on = !window.__PERF[flag]; // flag=true bedeutet Subsystem AUS
        t.textContent = label + ': ' + (on ? 'ON' : 'OFF');
        t.style.background = on ? '#0a0' : '#a00';
        t.style.color = '#fff';
      };
      t.addEventListener('click', function () {
        window.__PERF[flag] = !window.__PERF[flag];
        paint();
      });
      paint();
      return t;
    }
    row.appendChild(mkToggle('FOG', 'nofog'));
    row.appendChild(mkToggle('MASK', 'nomask'));
    row.appendChild(mkToggle('SPOT', 'nospot'));
    row.appendChild(mkToggle('EXPL', 'noexpl'));
    box.appendChild(row);

    document.body.appendChild(box);
    return pre;
  }

  // --- WebGL Draw-Call-Zähler (Monkey-Patch) -------------------------
  function hookGL(game) {
    if (glHooked) return;
    try {
      var gl = game.renderer && game.renderer.gl;
      if (!gl) return; // Canvas-Renderer → keine Draw-Call-Daten
      ['drawArrays', 'drawElements'].forEach(function (fn) {
        var orig = gl[fn];
        if (typeof orig !== 'function') return;
        gl[fn] = function () { DRAW.frame++; return orig.apply(this, arguments); };
      });
      // Pro Frame: Wert sichern + zurücksetzen
      game.renderer.on('postrender', function () { DRAW.last = DRAW.frame; DRAW.frame = 0; });
      glHooked = true;
    } catch (e) { /* degrade gracefully */ }
  }

  // --- Hilfsfunktionen -----------------------------------------------
  function activeScene(game) {
    try {
      var list = game.scene.getScenes(true); // nur aktive
      // Bevorzuge GameScene/HubSceneV2 (sichtbare Spielszene) vor Overlays
      for (var i = list.length - 1; i >= 0; i--) {
        var k = list[i].scene.key;
        if (k === 'GameScene' || k === 'HubSceneV2') return list[i];
      }
      return list[list.length - 1] || null;
    } catch (e) { return null; }
  }

  function countObjects(scene) {
    var n = 0;
    try {
      var walk = function (arr) {
        for (var i = 0; i < arr.length; i++) {
          n++;
          var c = arr[i];
          if (c && c.list && c.list.length) walk(c.list); // Container rekursiv
        }
      };
      walk(scene.children.list);
    } catch (e) { return -1; }
    return n;
  }

  function countBodies(scene) {
    try {
      var w = scene.physics && scene.physics.world;
      if (!w) return { d: 0, s: 0 };
      return { d: w.bodies ? w.bodies.size : 0, s: w.staticBodies ? w.staticBodies.size : 0 };
    } catch (e) { return { d: -1, s: -1 }; }
  }

  // Typ-Histogramm: zählt GameObject-Typen rekursiv (TileSprite, Image,
  // Sprite, Graphics, Text, Container...) — zeigt, was die Draw-Calls treibt.
  function typeHistogram(scene) {
    var h = {};
    try {
      var walk = function (arr) {
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          var t = (c && c.type) || '?';
          h[t] = (h[t] || 0) + 1;
          if (c && c.list && c.list.length) walk(c.list);
        }
      };
      walk(scene.children.list);
    } catch (e) { /* partial ok */ }
    return h;
  }

  // Wie typeHistogram, aber NUR sichtbare Blatt-Objekte (visible & alpha>0,
  // inkl. sichtbarer Eltern) — deutlich naeher an den echten Draw-Calls, weil
  // der normale Histogramm auch inaktive Pool-Objekte (Projektil-/Loot-Pools)
  // mitzaehlt. Container/Layer werden nicht selbst gezaehlt, nur ihre Blaetter.
  function visibleTypeHistogram(scene) {
    var h = {};
    try {
      var walk = function (arr, parentVis) {
        for (var i = 0; i < arr.length; i++) {
          var c = arr[i];
          if (!c) continue;
          var vis = parentVis && (c.visible !== false) && (c.alpha === undefined || c.alpha > 0.01);
          if (c.list && c.list.length) { walk(c.list, vis); }
          else if (vis) { var t = c.type || '?'; h[t] = (h[t] || 0) + 1; }
        }
      };
      walk(scene.children.list, true);
    } catch (e) { /* partial ok */ }
    return h;
  }

  // Sammelt bis zu `max` Text-Inhalte (Diagnose: woher der hohe Text-Grundwert?).
  function collectTextSamples(scene, max) {
    var out = [];
    try {
      var walk = function (arr) {
        for (var i = 0; i < arr.length && out.length < max; i++) {
          var c = arr[i];
          if (!c) continue;
          if (c.type === 'Text' && typeof c.text === 'string') {
            out.push((c.visible === false ? '(hid) ' : '') + c.text.slice(0, 22));
          }
          if (c.list && c.list.length) walk(c.list);
        }
      };
      walk(scene.children.list);
    } catch (e) { /* partial ok */ }
    return out;
  }

  // Aktive/gesamte Gegnerzahl (Hypothese: FPS-Drop skaliert mit Gegnern).
  function enemyCounts() {
    try {
      var g = (typeof window !== 'undefined') && window.enemies;
      if (g && typeof g.getChildren === 'function') {
        var arr = g.getChildren();
        var active = 0;
        for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].active) active++;
        return { active: active, total: arr.length };
      }
    } catch (e) {}
    return { active: -1, total: -1 };
  }

  // --- CPU-Timing: wo geht die Frame-Zeit hin? -----------------------
  // Wrappt GameScene.update (JS-CPU pro Frame gesamt) + updateFogOfWar
  // (Fog-Anteil). Zeigt, ob der Flaschenhals CPU (update) statt GPU (draws) ist
  // und wie viel davon das Fog frisst. Nur wenn die Funktionen existieren.
  var _cpu = { updMs: 0, updN: 0, fogMs: 0, fogN: 0 };
  function hookSceneTiming(game) {
    try {
      var gs = game.scene.getScene('GameScene');
      if (!gs || gs.__perfCpuHooked) return;
      gs.__perfCpuHooked = true;
      if (typeof gs.update === 'function') {
        var origU = gs.update;
        gs.update = function (t, d) {
          var s = _now();
          var r = origU.call(this, t, d);
          _cpu.updMs += _now() - s; _cpu.updN++;
          return r;
        };
      }
      if (typeof gs.updateFogOfWar === 'function') {
        var origF = gs.updateFogOfWar;
        gs.updateFogOfWar = function () {
          var s = _now();
          var r = origF.apply(this, arguments);
          _cpu.fogMs += _now() - s; _cpu.fogN++;
          return r;
        };
      }
    } catch (e) { /* Hook optional */ }
  }
  function _now() { try { return performance.now(); } catch (e) { return 0; } }

  // Sprite-Poster aufschluesseln: aktive/sichtbare Mitglieder der grossen
  // sprite-produzierenden Gruppen. Zeigt, ob der Sprite-Draw-Posten von Gegnern,
  // Gold, Loot oder Projektilen getrieben wird.
  function groupCounts() {
    var out = {};
    var W = (typeof window !== 'undefined') ? window : {};
    var groups = { enem: W.enemies, gold: W.goldGroup, loot: W.lootGroup, proj: W.enemyProjectiles, obst: W.obstacles };
    Object.keys(groups).forEach(function (k) {
      try {
        var grp = groups[k];
        if (grp && typeof grp.getChildren === 'function') {
          var arr = grp.getChildren(), vis = 0;
          for (var i = 0; i < arr.length; i++) { if (arr[i] && arr[i].active && arr[i].visible !== false) vis++; }
          out[k] = vis;
        }
      } catch (e) {}
    });
    return out;
  }

  // Kompakte Top-N-Darstellung des Histogramms, absteigend nach Count
  function histTop(h, n) {
    try {
      var keys = Object.keys(h).sort(function (a, b) { return h[b] - h[a]; });
      var parts = [];
      for (var i = 0; i < keys.length && i < n; i++) {
        parts.push(keys[i].replace('TileSprite', 'TS').replace('Graphics', 'GFX')
          .replace('Image', 'IMG').replace('Sprite', 'SPR').replace('Container', 'CNT')
          .replace('Text', 'TXT') + ':' + h[keys[i]]);
      }
      return parts.join(' ');
    } catch (e) { return '—'; }
  }

  function textureStats(game) {
    var count = 0, bytes = 0;
    try {
      var skip = { __DEFAULT: 1, __MISSING: 1, __WHITE: 1, __NORMAL: 1 };
      var list = game.textures.list;
      for (var key in list) {
        if (!list.hasOwnProperty(key) || skip[key]) continue;
        count++;
        var src = list[key].source;
        if (src && src.length) {
          for (var i = 0; i < src.length; i++) {
            var s = src[i];
            if (s && s.width && s.height) bytes += s.width * s.height * 4;
          }
        }
      }
    } catch (e) { return { count: -1, mb: -1 }; }
    return { count: count, mb: bytes / (1024 * 1024) };
  }

  function contextKey(scene) {
    try {
      var k = scene.scene.key;
      if (k === 'GameScene' && window.gameScene && window.gameScene.currentRoom) {
        var r = window.gameScene.currentRoom;
        var kind = r.kind || 'room';
        if (r.isLarge) kind = 'large/' + kind;
        return 'GameScene:' + kind;
      }
      return k;
    } catch (e) { return 'unknown'; }
  }

  // --- Sampling-Loop --------------------------------------------------
  var preEl = null;
  function tick(game) {
    try {
      hookSceneTiming(game); // CPU-Timing-Hooks setzen, sobald GameScene existiert
      var scene = activeScene(game);
      var fps = game.loop && game.loop.actualFps ? game.loop.actualFps : 0;
      var ms = game.loop && game.loop.delta ? game.loop.delta : 0;
      var objs = scene ? countObjects(scene) : -1;
      var b = scene ? countBodies(scene) : { d: -1, s: -1 };
      var tex = textureStats(game);
      var hist = scene ? typeHistogram(scene) : {};
      var ec = enemyCounts();
      var heap = 0;
      try { if (performance && performance.memory) heap = performance.memory.usedJSHeapSize / (1024 * 1024); } catch (e) {}
      var ctx = scene ? contextKey(scene) : 'unknown';

      // Sample akkumulieren (FPS min/avg pro Kontext)
      if (fps > 0) {
        var s = samples[ctx] || (samples[ctx] = { fpsMin: 999, fpsSum: 0, n: 0, objMax: 0, drawMax: 0, texMb: 0, hist: {}, visHist: {}, textSample: [], enemiesMax: 0, fpsAtEnemiesMax: 0, drawAtObjMax: 0 });
        s.fpsMin = Math.min(s.fpsMin, fps);
        s.fpsSum += fps; s.n++;
        s.objMax = Math.max(s.objMax, objs);
        s.drawMax = Math.max(s.drawMax, DRAW.last);
        s.texMb = tex.mb;
        // Korrelation Gegner<->FPS: FPS beim Maximum aktiver Gegner festhalten.
        if (ec.active > (s.enemiesMax || 0)) { s.enemiesMax = ec.active; s.fpsAtEnemiesMax = Math.round(fps); }
        if (objs >= (s.objMax || 0)) {
          s.hist = hist;                 // Voll-Histogramm vom dichtesten Frame
          s.drawAtObjMax = DRAW.last;
          s.groups = groupCounts();      // Sprite-Poster-Aufschluesselung
          // Sichtbaren Draw-Anteil + Text-Stichprobe nur am dichtesten Frame
          // berechnen (Baum-Walk ist teuer, laeuft so selten).
          if (scene) { s.visHist = visibleTypeHistogram(scene); s.textSample = collectTextSamples(scene, 16); }
        }
      }

      if (preEl) {
        // Kompakt: 2 Zeilen fuers schnelle A/B (der volle Report steckt im DUMP).
        var _u = _cpu.updN ? (_cpu.updMs / _cpu.updN) : 0;
        var _f = _cpu.fogN ? (_cpu.fogMs / _cpu.fogN) : 0;
        preEl.textContent =
          fps.toFixed(0) + 'fps ' + ms.toFixed(0) + 'ms · en' + ec.active + ' · dr' + DRAW.last + '\n' +
          'upd' + _u.toFixed(1) + ' fog' + _f.toFixed(1) + ' · ' + histTop(scene ? visibleTypeHistogram(scene) : {}, 3);
      }
    } catch (e) { /* keep ticking */ }
  }

  // --- Öffentlicher Dump ----------------------------------------------
  window.__perfDump = function () {
    var out = { generatedBy: 'perfProbe.js (053 WP01)', contexts: {} };
    for (var k in samples) {
      if (!samples.hasOwnProperty(k)) continue;
      var s = samples[k];
      out.contexts[k] = {
        fpsMin: Math.round(s.fpsMin),
        fpsAvg: s.n ? Math.round(s.fpsSum / s.n) : 0,
        frames: s.n,
        objMax: s.objMax,
        drawMax: s.drawMax,
        drawAtObjMax: s.drawAtObjMax || 0,
        enemiesMax: s.enemiesMax || 0,
        fpsAtEnemiesMax: s.fpsAtEnemiesMax || 0,
        texMb: Math.round(s.texMb * 10) / 10,
        types: s.hist || {},          // alle Objekte (inkl. inaktiver Pools)
        visTypes: s.visHist || {},    // nur SICHTBARE -> naeher an den Draws
        spriteGroups: s.groups || {}, // sichtbare Gegner/Gold/Loot/Projektile
        textSample: s.textSample || []
      };
    }
    // CPU-Timing (GameScene, global gemittelt): zeigt, ob der Flaschenhals die
    // JS-update() ist (CPU) statt der Draws (GPU), und wie viel davon das Fog ist.
    out.cpu = {
      updateMsAvg: _cpu.updN ? Math.round((_cpu.updMs / _cpu.updN) * 100) / 100 : 0,
      fogMsAvg: _cpu.fogN ? Math.round((_cpu.fogMs / _cpu.fogN) * 100) / 100 : 0,
      updateFrames: _cpu.updN
    };
    try {
      var rows = [];
      for (var c in out.contexts) rows.push(Object.assign({ context: c }, out.contexts[c]));
      if (console.table) console.table(rows); else console.log(out);
    } catch (e) { console.log(out); }
    return out;
  };

  // --- Bootstrap: auf window.game warten ------------------------------
  function boot() {
    if (!window.game || !window.game.loop) { setTimeout(boot, 200); return; }
    var game = window.game;
    hookGL(game);
    if (!preEl) {
      if (document.body) preEl = buildOverlay();
      else { window.addEventListener('DOMContentLoaded', function () { preEl = buildOverlay(); }); }
    }
    // GL ggf. nachträglich hooken (Renderer kann später bereit sein)
    var glRetry = setInterval(function () { if (glHooked) clearInterval(glRetry); else hookGL(game); }, 500);
    setInterval(function () { tick(game); }, 250);
    console.log('[perfProbe] aktiv — ?perf=1 erkannt. window.__perfDump() für Report.');
  }
  boot();
})();
