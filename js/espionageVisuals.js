/* =====================================================================
 * espionageVisuals.js — Sichtbarkeitsschicht fuer Espionage-Missionen
 * ---------------------------------------------------------------------
 * Feature 055 lieferte die Stealth-MECHANIK (espionageSystem.js), aber kein
 * Feedback: der Spieler betrat einen scheinbar normalen Raum, war unsichtbar
 * verkleidet und hatte keine Ahnung, dass/wo er abhoeren muss. Dieses Modul
 * rendert den Missions-State, OHNE die testbare Logik zu beruehren:
 *
 *   - HUD-Banner mit Anweisung + Live-Status (verdeckt / Verdacht / enttarnt /
 *     abgehoert).
 *   - Abhoer-Zone(n) als pulsierender Marker (gruen + Haken, wenn fertig).
 *   - Wachen-Sichtradien (rot) zum Ausweichen; Deckungszonen (gruen).
 *
 * Selbstverwaltend: `sync(scene)` wird jeden Frame aus dem GameScene-Update
 * aufgerufen und montiert / aktualisiert / demontiert sich je nach
 * EspionageSystem.isActive(). Komplett no-op ausserhalb einer Mission.
 * ===================================================================== */
(function () {
  'use strict';

  var DEPTH_WORLD = 520;   // ueber Boden/Gegnern, unter HUD
  var DEPTH_HUD = 1640;    // ueber dem normalen HUD-Layer

  var mounted = false;
  var g = null;            // world-space Graphics (Zonen/Wachen/Deckung)
  var banner = null;       // HUD-Text (Anweisung + Status)
  var bannerBg = null;
  var zoneLabels = [];     // Text-Labels an den Abhoer-Zonen
  var _t = 0;              // Pulse-Akkumulator

  function _scene() {
    return (typeof window !== 'undefined' && window.currentScene) ? window.currentScene : null;
  }

  function _isEN() {
    return !!(window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en');
  }

  function mount(scene) {
    if (mounted || !scene || !scene.add) return;
    mounted = true;
    _t = 0;
    g = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);

    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 1536;
    bannerBg = scene.add.rectangle(cw / 2, 54, Math.min(900, cw - 40), 38, 0x10131c, 0.82)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(2, 0x8899cc, 0.9);
    banner = scene.add.text(cw / 2, 54, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#cdd9ff',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);

    zoneLabels = [];
  }

  function unmount() {
    mounted = false;
    if (g) { try { g.destroy(); } catch (e) {} g = null; }
    if (banner) { try { banner.destroy(); } catch (e) {} banner = null; }
    if (bannerBg) { try { bannerBg.destroy(); } catch (e) {} bannerBg = null; }
    for (var i = 0; i < zoneLabels.length; i++) {
      try { zoneLabels[i].destroy(); } catch (e) {}
    }
    zoneLabels = [];
  }

  function _ensureZoneLabels(scene, zones) {
    // Lazily create one label per observe zone (created once per mission).
    if (zoneLabels.length === zones.length) return;
    for (var i = 0; i < zoneLabels.length; i++) {
      try { zoneLabels[i].destroy(); } catch (e) {}
    }
    zoneLabels = [];
    var txt = _isEN() ? 'Eavesdrop' : 'Lauschen';
    for (var j = 0; j < zones.length; j++) {
      var z = zones[j];
      var lbl = scene.add.text(z.x, z.y - (z.r || 64) - 14, txt, {
        fontFamily: 'monospace', fontSize: '13px', color: '#9fe7ff',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(DEPTH_WORLD + 1).setScrollFactor(1);
      zoneLabels.push(lbl);
    }
  }

  function _bannerText(st) {
    var en = _isEN();
    var allDone = (st.observeZones || []).length > 0
      && st.observeZones.every(function (z) { return z._done; });
    if (st.exposed) {
      return en ? '! EXPOSED — the guards are on you. Fight or flee.'
                : '! ENTTARNT — die Wachen sind auf dich. Kaempfen oder fliehen.';
    }
    if (allDone) {
      return en ? '✓ Overheard everything — leave via the stairs.'
                : '✓ Alles abgehoert — verlass den Raum ueber die Treppe.';
    }
    if (st.detection > 0.18) {
      var pct = Math.round(st.detection * 100);
      return (en ? 'Suspicion ' : 'Verdacht ') + pct + '% — '
        + (en ? 'get into cover (green).' : 'geh in Deckung (gruen).');
    }
    return en
      ? 'Disguised. Sneak to the marked spot and listen — do NOT draw your blade.'
      : 'Verdeckt. Schleich zur markierten Stelle und hoere ab — zieh KEINE Klinge.';
  }

  function sync(scene) {
    scene = scene || _scene();
    var active = !!(window.EspionageSystem && typeof window.EspionageSystem.isActive === 'function'
      && window.EspionageSystem.isActive());
    // Stale-mount guard: if the GameScene was torn down (return to hub /
    // scene switch), our game objects are destroyed but `mounted` is still
    // true with dead references. Detect via the graphics' severed .scene link
    // and reset so the next mission re-mounts cleanly.
    if (mounted && (!g || !g.scene)) { mounted = false; g = null; banner = null; bannerBg = null; zoneLabels = []; }

    if (!active) { if (mounted) unmount(); return; }
    if (!mounted) mount(scene);
    if (!g || !banner) return;

    var st = window.EspionageSystem.getState ? window.EspionageSystem.getState() : null;
    if (!st) return;
    _t += 0.06;
    var pulse = 0.5 + 0.5 * Math.sin(_t * 2.2);

    g.clear();

    // --- Deckungszonen (gruen, "sicher") -------------------------------
    (st.cover || []).forEach(function (c) {
      g.fillStyle(0x33dd88, 0.10);
      g.fillRect(c.x, c.y, c.w || 0, c.h || 0);
      g.lineStyle(2, 0x33dd88, 0.55);
      g.strokeRect(c.x, c.y, c.w || 0, c.h || 0);
    });

    // --- Wachen-Sichtradien (rot, "meiden") ----------------------------
    (st.guards || []).forEach(function (gd) {
      var range = gd.range || 0;
      if (range <= 0) return;
      g.fillStyle(0xff4444, st.exposed ? 0.16 : 0.07);
      g.fillCircle(gd.x, gd.y, range);
      g.lineStyle(2, 0xff5555, st.exposed ? 0.8 : 0.4);
      g.strokeCircle(gd.x, gd.y, range);
      // Wachen-Position als kleiner Punkt
      g.fillStyle(0xff8888, 0.9);
      g.fillCircle(gd.x, gd.y, 6);
    });

    // --- Abhoer-Zonen (cyan, pulsierend; gruen wenn fertig) ------------
    var zones = st.observeZones || [];
    _ensureZoneLabels(scene, zones);
    zones.forEach(function (z, i) {
      var r = z.r || 64;
      if (z._done) {
        g.fillStyle(0x33dd88, 0.18);
        g.fillCircle(z.x, z.y, r);
        g.lineStyle(3, 0x33dd88, 0.95);
        g.strokeCircle(z.x, z.y, r);
        if (zoneLabels[i]) { zoneLabels[i].setText('✓'); zoneLabels[i].setColor('#7dffb0'); }
      } else {
        g.fillStyle(0x33c2ff, 0.10 + 0.12 * pulse);
        g.fillCircle(z.x, z.y, r);
        g.lineStyle(3, 0x66d9ff, 0.5 + 0.4 * pulse);
        g.strokeCircle(z.x, z.y, r);
        // Fortschrittsring beim Lauschen
        var prog = (z.seconds > 0) ? Math.min(1, (z._elapsed || 0) / z.seconds) : 0;
        if (prog > 0.001) {
          g.lineStyle(5, 0xffffff, 0.9);
          g.beginPath();
          g.arc(z.x, z.y, r + 6, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false);
          g.strokePath();
        }
      }
    });

    banner.setText(_bannerText(st));
    banner.setColor(st.exposed ? '#ff9a9a' : '#cdd9ff');
  }

  window.EspionageVisuals = { sync: sync, mount: mount, unmount: unmount };
})();
