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

  // --- Overlay-DOM ----------------------------------------------------
  function buildOverlay() {
    var box = document.createElement('div');
    box.id = 'perf-probe-overlay';
    box.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'z-index:99999',
      'font:11px/1.35 monospace', 'color:#0f0',
      'background:rgba(0,0,0,0.78)', 'padding:6px 8px',
      'white-space:pre', 'pointer-events:none',
      'border-bottom-right-radius:6px', 'max-width:60vw',
      'text-shadow:0 0 2px #000'
    ].join(';');

    var pre = document.createElement('div');
    pre.id = 'perf-probe-text';
    box.appendChild(pre);

    var btn = document.createElement('button');
    btn.id = 'perf-probe-dump';
    btn.textContent = '⤓ DUMP';
    btn.style.cssText = [
      'pointer-events:auto', 'margin-top:6px', 'width:100%',
      'font:bold 13px monospace', 'color:#000', 'background:#0f0',
      'border:0', 'border-radius:4px', 'padding:8px 0', 'cursor:pointer'
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
      var scene = activeScene(game);
      var fps = game.loop && game.loop.actualFps ? game.loop.actualFps : 0;
      var ms = game.loop && game.loop.delta ? game.loop.delta : 0;
      var objs = scene ? countObjects(scene) : -1;
      var b = scene ? countBodies(scene) : { d: -1, s: -1 };
      var tex = textureStats(game);
      var heap = 0;
      try { if (performance && performance.memory) heap = performance.memory.usedJSHeapSize / (1024 * 1024); } catch (e) {}
      var ctx = scene ? contextKey(scene) : 'unknown';

      // Sample akkumulieren (FPS min/avg pro Kontext)
      if (fps > 0) {
        var s = samples[ctx] || (samples[ctx] = { fpsMin: 999, fpsSum: 0, n: 0, objMax: 0, drawMax: 0, texMb: 0 });
        s.fpsMin = Math.min(s.fpsMin, fps);
        s.fpsSum += fps; s.n++;
        s.objMax = Math.max(s.objMax, objs);
        s.drawMax = Math.max(s.drawMax, DRAW.last);
        s.texMb = tex.mb;
      }

      if (preEl) {
        preEl.textContent =
          'PERF-PROBE  [053 WP01]\n' +
          'ctx   ' + ctx + '\n' +
          'fps   ' + fps.toFixed(0) + '   (' + ms.toFixed(1) + ' ms)\n' +
          'objs  ' + objs + '   bodies ' + b.d + '+' + b.s + 's\n' +
          'draws ' + DRAW.last + '/frame\n' +
          'tex   ' + tex.count + '  (~' + tex.mb.toFixed(1) + ' MB VRAM)\n' +
          'heap  ' + (heap ? heap.toFixed(1) + ' MB' : '—');
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
        texMb: Math.round(s.texMb * 10) / 10
      };
    }
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
