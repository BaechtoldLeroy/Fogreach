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
    var txt = _isEN() ? '▼ EAVESDROP' : '▼ ABHOEREN';
    for (var j = 0; j < zones.length; j++) {
      var z = zones[j];
      var lbl = scene.add.text(z.x, z.y - (z.r || 64) - 16, txt, {
        fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffe27a',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(DEPTH_WORLD + 1).setScrollFactor(1);
      zoneLabels.push(lbl);
    }
  }

  function _bannerText(st) {
    var en = _isEN();
    var allDone = (st.observeZones || []).length > 0
      && st.observeZones.every(function (z) { return z._done; });
    if (st.exposed) {
      // Recoverable: leave the red guard zones so suspicion fades + you re-blend.
      var dpct = Math.round((st.detection || 0) * 100);
      return en
        ? '! EXPOSED (' + dpct + '%) — get away from the red guard zones to blend back in.'
        : '! ENTTARNT (' + dpct + '%) — raus aus den roten Wachen-Zonen, dann bist du wieder verdeckt.';
    }
    if (allDone) {
      return en ? '✓ Overheard everything — leave via the stairs.'
                : '✓ Alles abgehoert — verlass den Raum ueber die Treppe.';
    }
    return en
      ? 'Disguised. Reach the GOLD circle and wait to listen — do NOT draw your blade.'
      : 'Verdeckt. Geh in den GOLDENEN Kreis und warte zum Abhoeren — zieh KEINE Klinge.';
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
    var en = _isEN();

    // --- Wachen-Sichtradien (rot) — NUR sichtbar, wenn enttarnt --------
    // Solange du verdeckt bist, sehen dich die Wachen per Naehe NIE (nur ein
    // Angriff enttarnt). Die roten Zonen sind also erst relevant, wenn du
    // enttarnt bist und wieder untertauchen willst — vorher waeren sie nur
    // verwirrender Clutter. Darum hier bewusst an `st.exposed` gekoppelt.
    if (st.exposed) {
      (st.guards || []).forEach(function (gd) {
        var range = gd.range || 0;
        if (range <= 0) return;
        g.fillStyle(0xff4444, 0.14);
        g.fillCircle(gd.x, gd.y, range);
        g.lineStyle(2, 0xff5555, 0.85);
        g.strokeCircle(gd.x, gd.y, range);
        g.fillStyle(0xff8888, 0.95);
        g.fillCircle(gd.x, gd.y, 6);
      });
    }

    // --- Abhoer-Zone (das EINE Ziel) — golden, pulsierend; gruen wenn fertig
    var zones = st.observeZones || [];
    _ensureZoneLabels(scene, zones);
    zones.forEach(function (z, i) {
      var r = z.r || 64;
      if (z._done) {
        g.fillStyle(0x33dd88, 0.20);
        g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0x44ee99, 0.95);
        g.strokeCircle(z.x, z.y, r);
        if (zoneLabels[i]) {
          zoneLabels[i].setText(en ? '✓ HEARD' : '✓ ABGEHOERT');
          zoneLabels[i].setColor('#7dffb0');
        }
      } else {
        // Kraeftiges Gold + Marker-Kreuz in der Mitte, damit das Ziel
        // unverwechselbar ist (Feedback: "blauer Kreis, was macht der?").
        g.fillStyle(0xffc23a, 0.12 + 0.16 * pulse);
        g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0xffd966, 0.6 + 0.4 * pulse);
        g.strokeCircle(z.x, z.y, r);
        g.lineStyle(2, 0xffe27a, 0.8);
        g.beginPath(); g.moveTo(z.x - 10, z.y); g.lineTo(z.x + 10, z.y); g.strokePath();
        g.beginPath(); g.moveTo(z.x, z.y - 10); g.lineTo(z.x, z.y + 10); g.strokePath();
        // Fortschrittsring beim Lauschen
        var prog = (z.seconds > 0) ? Math.min(1, (z._elapsed || 0) / z.seconds) : 0;
        if (prog > 0.001) {
          g.lineStyle(6, 0xffffff, 0.95);
          g.beginPath();
          g.arc(z.x, z.y, r + 7, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false);
          g.strokePath();
        }
      }
    });

    banner.setText(_bannerText(st));
    banner.setColor(st.exposed ? '#ff9a9a' : '#ffe6a8');
  }

  window.EspionageVisuals = { sync: sync, mount: mount, unmount: unmount };
})();
