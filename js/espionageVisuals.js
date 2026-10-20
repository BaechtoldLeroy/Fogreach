/* =====================================================================
 * espionageVisuals.js — Sichtbarkeitsschicht für Espionage-Missionen
 * ---------------------------------------------------------------------
 * Feature 055 lieferte die Stealth-MECHANIK (espionageSystem.js), aber kein
 * klares Feedback. Dieses Modul rendert den Missions-State, OHNE die testbare
 * Logik zu berühren. #54-Redesign:
 *
 *   - Detection-RING am Spieler (grün->gelb->rot) — der zentrale, bisher
 *     unsichtbare detection-Zustand wird sichtbar (auch die Recovery-Phase).
 *   - Status-CHIP (VERKLEIDET / VERDAECHTIG / ENTTARNT / ABGEHOERT) + kurze
 *     Aktionszeile statt langem Negativ-Banner.
 *   - Wachen-Sichtradien IMMER (dezent gedimmt, intensivieren mit detection /
 *     bei Enttarnung) — die Welt wird lesbar.
 *   - Deckungs-Zonen (blau-grün) — der _inCover-Vorteil wird sichtbar.
 *   - Off-screen-Pfeil zur nächsten Abhör-Zone.
 *   - Enttarn-Moment: Kamera-Flash + Shake + Sound (Flankenerkennung).
 *
 * Selbstverwaltend: sync(scene) wird jeden Frame aus dem GameScene-Update
 * aufgerufen, no-op ausserhalb einer Mission.
 * ===================================================================== */
(function () {
  'use strict';

  var DEPTH_WORLD = 520;   // über Boden/Gegnern, unter HUD
  var DEPTH_HUD = 1640;    // über dem normalen HUD-Layer
  var DEPTH_MARKE = 1001;  // "?"/"!" und Ausrufe: über dem Nebel (1000), lesbar auch am Rand

  var mounted = false;
  var g = null;            // world-space Graphics (Zonen/Wachen/Deckung/Ring)
  var gHud = null;         // HUD-space Graphics (Off-screen-Pfeil)
  var banner = null;       // HUD-Text (kurze Aktionszeile)
  var bannerBg = null;
  var chipBg = null;       // Status-Chip Hintergrund
  var chipText = null;     // Status-Chip Text
  var zoneLabels = [];     // Text-Labels an den Abhör-Zonen
  var guardSprites = [];   // echte Wachen-Sprites (statt Kreise)
  var _guardTex = null;    // aufgelöste Wachen-Textur (ChainGuard o.ae.)
  // Verkleidung ist KEIN Overlay mehr: das Spieler-Sprite selbst wird in
  // player.js durch die Kettenrat-Montur ersetzt.
  var _t = 0;              // Pulse-Akkumulator
  var _prevExposed = false;
  var _cw = 1536, _ch = 800;

  // --- Die anderen Figuren (Schreiber, Diener, Traeger, Spitzel, Ungeziefer) ---
  // Vorhandene Bilder: die Menschen aus dem Hub (einfache Einzelbilder, nach
  // rechts gewandt), Spitzel/Ratte/Brut aus den Gegnerbildern (links/rechts).
  // `eigen`: die eigenen PixelLab-Figuren (tools/spionageFigurenBauen.js) mit
  // Gehbildern; h ist ihre Bildhoehe, abgestimmt auf die 54 des Spielers.
  // Fehlt das Bild, bleibt das alte Hub-Bild (key/url/h/tint) — die Toenung
  // greift ohnehin nur unter WebGL, darum tragen die neuen Figuren keine.
  var FIGUR = {
    schreiber: { key: 'vorleser_alter', url: 'assets/sprites/vorleser_alter.png', h: 66, eigen: { name: 'schreiber', h: 54, gehen: 0 } },
    diener: { key: 'klerus', url: 'assets/sprites/klerus.png', h: 58 },
    // Der Traeger traegt seine Kiste selbst auf der Schulter (kein Beiwerk).
    traeger: { key: 'buerger', url: 'assets/sprites/buerger.png?v=2', h: 68, eigen: { name: 'traeger', h: 56, gehen: 6, kiste: true } },
    // Ratsbote in Ratsrot mit Depeschentasche; Geleerter: grau, leer, apathisch.
    ratsbote: { key: 'vorleser_junge', url: 'assets/sprites/vorleser_junge.png', h: 60, tint: 0xe0a8a0, eigen: { name: 'ratsbote', h: 54, gehen: 6 } },
    geleerter: { key: 'buerger', url: 'assets/sprites/buerger.png?v=2', h: 68, tint: 0x8d949c, eigen: { name: 'geleerter', h: 52, gehen: 8 } },
    spitzel: { dir: 'alarm', h: 66 },
    ratte: { dir: 'rat', h: 28 },
    brut: { dir: 'imp', h: 46 }
  };
  // Die eigenen Figurbilder: right0 steht, walk_right0..n-1 geht (nach rechts,
  // links = gespiegelt). Auch die Nachteskorte holt ihre Figuren hierueber.
  var FigurBilder = {
    ORDNER: 'assets/sprites/spionage/figuren/',
    key: function (name, i) { return 'spion_fig_' + name + (i === undefined || i < 0 ? '_right0' : '_walk_right' + i); },
    // Laedt, was fehlt; true, wenn etwas in die Ladeliste kam.
    laden: function (scene, name, gehen) {
      if (!scene || !scene.load || !scene.textures) return false;
      var neu = false;
      for (var i = -1; i < (gehen || 0); i++) {
        var k = FigurBilder.key(name, i);
        if (scene.textures.exists(k)) continue;
        scene.load.image(k, FigurBilder.ORDNER + name + '/' + (i < 0 ? 'right0' : 'walk_right' + i) + '.png');
        neu = true;
      }
      return neu;
    },
    // Geht die Figur? Lage gegen die zuletzt gesehene; die Spionage rechnet nicht
    // in jedem Bild, darum gilt eine Bewegung noch 200 ms (sonst flackert der Gang).
    geht: function (scene, merk, x, y) {
      var t = (scene.time && scene.time.now) || 0;
      if (merk._gx !== undefined && Math.abs(x - merk._gx) + Math.abs(y - merk._gy) > 0.05) merk._gt = t;
      merk._gx = x; merk._gy = y;
      return merk._gt !== undefined && t - merk._gt < 200;
    },
    da: function (scene, name) { return !!(scene && scene.textures && scene.textures.exists(FigurBilder.key(name))); },
    // Stehend right0, gehend ein Bild des Gangs im Takt der Spieluhr.
    bild: function (scene, name, gehen, laeuft) {
      if (laeuft && gehen > 0) {
        var t = (scene.time && scene.time.now) || 0;
        var k = FigurBilder.key(name, Math.floor(t / 110) % gehen);
        if (scene.textures.exists(k)) return k;
      }
      return FigurBilder.key(name);
    }
  };
  if (typeof window !== 'undefined') window.SpionageFigurBilder = FigurBilder;
  // Requisiten (PixelLab, tools/spionageFigurenBauen.js); ohne sie die gezeichneten esp_kiste/esp_pult.
  var REQUISIT = {
    spion_req_phiolenkiste: 'assets/sprites/spionage/requisiten/phiolenkiste.png',
    spion_req_pult: 'assets/sprites/spionage/requisiten/pult.png'
  };
  var REQ_H = { spion_req_phiolenkiste: 20, spion_req_pult: 34 };

  // Kegelfarben: bernstein = bemerkt Dich, wenn Du zu lange bleibst;
  // violett = meldet Dich einer Wache (Spitzel, Ratsbote). (Blau/rot bleiben den Wachen.)
  var KEGEL = { schreiber: 0xf2c35a, diener: 0xf2c35a, spitzel: 0xc77dff, ratsbote: 0xc77dff };
  var figurSprites = [];   // je Figur ein Sprite
  var beiwerk = [];        // je Figur: Kiste (Traeger) / Pult (Schreiber) oder null
  var marken = [];         // "?"/"!" je Wache bzw. Figur
  var rufe = [];           // [{b, txt}] Ausrufe ueber den Koepfen

  var RUF_DE = {
    'spion.ruf.ruf_schreiber': 'Wache! Der da schnüffelt in den Akten!',
    'spion.ruf.ruf_diener': 'Wer bist Du? Wache, hierher!',
    'spion.ruf.erkannt': 'Dich kenne ich nicht ...',
    'spion.ruf.meldet': 'Da drüben! Ein Fremder in Uniform!',
    'spion.ruf.abgefangen': 'Mmpf!',
    'spion.ruf.rempler': 'He! Pass doch auf!',
    'spion.ruf.laerm': 'Was war das?',
    'spion.ruf.bote_meldet': 'Hauptmann, da treibt sich einer herum. Haltet die Augen offen!',
    'spion.hinweis.spitzel': 'Der Spitzel rennt zur Wache! Fang ihn ab, bevor er sie erreicht.',
    'spion.hinweis.ratsbote': 'Der Ratsbote eilt zur Wache! Fang ihn ab, sonst wird sie wachsam.'
  };
  var RUF_EN = {
    'spion.ruf.ruf_schreiber': 'Guard! That one is snooping in the files!',
    'spion.ruf.ruf_diener': 'Who are you? Guard, over here!',
    'spion.ruf.erkannt': 'I do not know you ...',
    'spion.ruf.meldet': 'Over there! A stranger in uniform!',
    'spion.ruf.abgefangen': 'Mmph!',
    'spion.ruf.rempler': 'Hey! Watch it!',
    'spion.ruf.laerm': 'What was that?',
    'spion.ruf.bote_meldet': 'Captain, someone is lurking about. Keep your eyes open!',
    'spion.hinweis.spitzel': 'The informer is running to a guard! Catch him before he gets there.',
    'spion.hinweis.ratsbote': 'The council messenger is hurrying to a guard! Catch him, or the guard turns watchful.'
  };
  try {
    if (window.i18n && typeof window.i18n.register === 'function') {
      window.i18n.register('de', RUF_DE);
      window.i18n.register('en', RUF_EN);
    }
  } catch (e) {}
  function _rufText(k) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(k);
        if (v && v !== k && v.indexOf('[MISSING') !== 0) return v;
      }
    } catch (e) {}
    return (_isEN() ? RUF_EN[k] : RUF_DE[k]) || RUF_DE[k] || k;
  }

  // Hub-Bilder nachladen (der Direkteinstieg in den Keller kommt am Hub vorbei)
  // und die kleinen Requisiten einmal zeichnen.
  function _figurenVorbereiten(scene) {
    if (!scene || !scene.textures) return;
    var fehlt = false;
    Object.keys(FIGUR).forEach(function (t) {
      var f = FIGUR[t];
      if (f.url && !scene.textures.exists(f.key) && scene.load) { scene.load.image(f.key, f.url); fehlt = true; }
      if (f.eigen && FigurBilder.laden(scene, f.eigen.name, f.eigen.gehen)) fehlt = true;
    });
    Object.keys(REQUISIT).forEach(function (k) {
      if (!scene.textures.exists(k) && scene.load) { scene.load.image(k, REQUISIT[k]); fehlt = true; }
    });
    if (fehlt) { try { if (!scene.load.isLoading()) scene.load.start(); } catch (e) {} }
    try {
      if (!scene.textures.exists('esp_figur_fallback')) {
        var a = scene.make.graphics({ add: false });
        a.fillStyle(0x4a4038, 1); a.fillTriangle(12, 10, 2, 40, 22, 40);   // Kutte
        a.fillStyle(0x8a7a66, 1); a.fillCircle(12, 8, 6);                   // Kopf
        a.generateTexture('esp_figur_fallback', 24, 40); a.destroy();
      }
      if (!scene.textures.exists('esp_kiste')) {
        var k = scene.make.graphics({ add: false });
        k.fillStyle(0x7a5230, 1); k.fillRect(0, 0, 18, 14);
        k.lineStyle(2, 0x3e2814, 1); k.strokeRect(1, 1, 16, 12);
        k.lineBetween(1, 1, 17, 13); k.lineBetween(17, 1, 1, 13);
        k.generateTexture('esp_kiste', 18, 14); k.destroy();
      }
      if (!scene.textures.exists('esp_pult')) {
        var p = scene.make.graphics({ add: false });
        p.fillStyle(0x3e2a18, 1); p.fillRect(0, 4, 36, 14);                 // Pult
        p.fillStyle(0x5c3f24, 1); p.fillRect(0, 2, 36, 5);
        p.fillStyle(0xe8dcb8, 1); p.fillRect(8, 0, 14, 8);                  // Blatt
        p.fillStyle(0x1a1a22, 1); p.fillCircle(28, 3, 2.5);                 // Tintenfass
        p.fillStyle(0xffd27a, 1); p.fillRect(3, 0, 2, 4);                   // Kerze
        p.generateTexture('esp_pult', 36, 18); p.destroy();
      }
    } catch (e) {}
  }

  function _requisitKey(scene, a, tx) {
    if (a.type === 'traeger') return (tx.eigen && tx.eigen.kiste) ? null : 'esp_kiste';
    if (a.type === 'geleerter') return scene.textures.exists('spion_req_phiolenkiste') ? 'spion_req_phiolenkiste' : 'esp_kiste';
    if (a.type === 'schreiber') return scene.textures.exists('spion_req_pult') ? 'spion_req_pult' : 'esp_pult';
    return null;
  }

  // Sichtbare Hoehe einer Figur (fuer "?"/"!" ueber dem Kopf).
  function _figurHoehe(scene, a) {
    var f = FIGUR[a.type] || { h: 60 };
    return (f.eigen && FigurBilder.da(scene, f.eigen.name)) ? f.eigen.h : f.h;
  }

  function _figurTex(scene, a, laeuft) {
    var f = FIGUR[a.type];
    if (!f) return { key: 'esp_figur_fallback', flip: false };
    var links = Math.cos(a._facing || 0) < 0;
    if (f.eigen && FigurBilder.da(scene, f.eigen.name)) {
      return { key: FigurBilder.bild(scene, f.eigen.name, f.eigen.gehen, !a.knocked && !!laeuft), flip: links, eigen: f.eigen };
    }
    if (f.dir) {
      var k = f.dir + (links ? '_left0' : '_right0');
      if (scene.textures.exists(k)) return { key: k, flip: false };
      if (scene.textures.exists(f.dir + '_right0')) return { key: f.dir + '_right0', flip: links };
      return { key: 'esp_figur_fallback', flip: false };
    }
    return scene.textures.exists(f.key) ? { key: f.key, flip: links } : { key: 'esp_figur_fallback', flip: false };
  }

  // Echte Wachen-Textur auflösen (ChainGuard passt zum Kettenrat-Warenhaus);
  // Fallback: einmalig eine simple Wachen-Figur generieren.
  // enemyChainGuard/enemyImp sind die Rueckfall-Formen aus graphics.js (#177),
  // nur gesehen, wenn die Sprite-Dateien fehlen.
  function _resolveGuardTex(scene) {
    var cands = ['chainguard_right0', 'sprite_chainguard', 'enemyChainGuard', 'imp_right0', 'sprite_imp', 'enemyImp'];
    for (var i = 0; i < cands.length; i++) {
      if (scene.textures && scene.textures.exists(cands[i])) return cands[i];
    }
    if (scene.textures && !scene.textures.exists('esp_guard_fallback')) {
      try {
        var gg = scene.make.graphics({ add: false });
        gg.fillStyle(0x3a3f52, 1); gg.fillRoundedRect(5, 9, 18, 20, 5);   // Körper
        gg.fillStyle(0x6a7088, 1); gg.fillCircle(14, 8, 7);                // Kopf
        gg.lineStyle(2, 0x9aa2bd, 1); gg.strokeRoundedRect(5, 9, 18, 20, 5);
        gg.generateTexture('esp_guard_fallback', 28, 32); gg.destroy();
      } catch (e) {}
    }
    return 'esp_guard_fallback';
  }

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
    _prevExposed = false;
    g = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);
    gHud = scene.add.graphics().setDepth(DEPTH_HUD).setScrollFactor(0);

    // Echte Wachen-Sprites vorbereiten (Verkleidung = ersetztes Spieler-Sprite).
    _guardTex = _resolveGuardTex(scene);
    guardSprites = [];
    _figurenVorbereiten(scene);

    var cam = scene.cameras && scene.cameras.main;
    _cw = cam ? cam.width : 1536;
    _ch = cam ? cam.height : 800;

    // Aktionszeile unter dem Status-Chip. Der Text kann lang sein (die deutsche
    // "Geh in den goldenen Kreis..."-Zeile lief vorher ueber die Box hinaus),
    // daher Zeilenumbruch auf die Box-Breite + dynamische Box-Hoehe (in sync()).
    // Etwas tiefer (y=80) als der Chip (y=40), damit die 2. Zeile ihn nicht
    // ueberlappt.
    var _bannerW = Math.min(760, _cw - 40);
    bannerBg = scene.add.rectangle(_cw / 2, 80, _bannerW, 28, 0x10131c, 0.85)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(1, 0x5a6580, 0.7);
    banner = scene.add.text(_cw / 2, 80, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cdd9ff', align: 'center',
      wordWrap: { width: _bannerW - 24 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);

    // Status-Chip (Pille) darüber
    chipBg = scene.add.rectangle(_cw / 2, 40, 150, 26, 0x4a8fd0, 0.95)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(2, 0xffffff, 0.5);
    chipText = scene.add.text(_cw / 2, 40, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);

    zoneLabels = [];
  }

  function unmount() {
    mounted = false;
    [g, gHud, banner, bannerBg, chipBg, chipText].forEach(function (o) {
      if (o) { try { o.destroy(); } catch (e) {} }
    });
    g = gHud = banner = bannerBg = chipBg = chipText = null;
    for (var i = 0; i < zoneLabels.length; i++) { try { zoneLabels[i].destroy(); } catch (e) {} }
    for (var k = 0; k < guardSprites.length; k++) { try { guardSprites[k].destroy(); } catch (e) {} }
    zoneLabels = [];
    guardSprites = [];
    _figurenWeg();
  }

  function _figurenWeg() {
    figurSprites.concat(beiwerk, marken).forEach(function (o) { if (o) { try { o.destroy(); } catch (e) {} } });
    rufe.forEach(function (r) { try { r.txt.destroy(); } catch (e) {} });
    figurSprites = []; beiwerk = []; marken = []; rufe = [];
  }

  // Figuren, Requisiten, "?"/"!" und Ausrufe, jeden Frame aus dem State.
  function _figurenZeichnen(scene, st, sichtZu) {
    var actors = st.actors || [];
    var D = DEPTH_WORLD + 2;
    while (figurSprites.length < actors.length) {
      figurSprites.push(scene.add.sprite(0, 0, 'esp_figur_fallback').setDepth(D).setScrollFactor(1));
      beiwerk.push(null);
    }
    while (figurSprites.length > actors.length) {
      try { figurSprites.pop().destroy(); } catch (e) {}
      var bw = beiwerk.pop(); if (bw) { try { bw.destroy(); } catch (e) {} }
    }
    for (var i = 0; i < actors.length; i++) {
      var a = actors[i], spr = figurSprites[i], f = FIGUR[a.type] || { h: 60 };
      var laeuft = FigurBilder.geht(scene, spr, a.x, a.y);
      var tx = _figurTex(scene, a, laeuft);
      if (spr.texture.key !== tx.key) spr.setTexture(tx.key);
      var fh = (spr.frame && spr.frame.height) || 40;            // Masse vom Frame
      spr.setScale((tx.eigen ? tx.eigen.h : f.h) / fh);
      spr.setFlipX(tx.flip);
      // Geleerte buecken sich im Takt ueber ihre Arbeit.
      var buecken = (a.type === 'geleerter' && !a.knocked) ? Math.max(0, Math.sin((a._workT || 0) * 2.4)) : 0;
      spr.setPosition(a.x, a.y + buecken * 3);
      if (a.knocked) { spr.setTint(0x777777); spr.setAlpha(0.7); spr.setAngle(90); }
      else {
        spr.setAngle(buecken * 8 * (tx.flip ? -1 : 1)); spr.setAlpha(1);
        if (a._mark === '!') spr.setTint(0xffb0a0); else if (f.tint && !tx.eigen) spr.setTint(f.tint); else spr.clearTint();
      }
      // Requisit: die Kiste des Traegers, das Pult des Schreibers, die Arbeit des Geleerten.
      // Der eigene Traeger hat seine Kiste auf der Schulter; sonst die PixelLab-Requisiten, wenn geladen.
      var reqKey = _requisitKey(scene, a, tx);
      if (beiwerk[i] && beiwerk[i].texture.key !== reqKey) {
        if (reqKey && scene.textures.exists(reqKey)) beiwerk[i].setTexture(reqKey);
        else { try { beiwerk[i].destroy(); } catch (e) {} beiwerk[i] = null; }
      }
      if (reqKey && !beiwerk[i] && scene.textures.exists(reqKey)) beiwerk[i] = scene.add.image(0, 0, reqKey).setScrollFactor(1);
      if (beiwerk[i]) beiwerk[i].setScale(REQ_H[reqKey] ? REQ_H[reqKey] / (beiwerk[i].frame.height || 1) : 1);
      var req = beiwerk[i];
      if (req && a.type === 'traeger') {
        var dir = Math.cos(a._facing || 0) < 0 ? -1 : 1;
        if (a.knocked) req.setPosition(a.x + 14, a.y + 16).setDepth(D - 0.1).setAngle(20);
        else req.setPosition(a.x + dir * 9, a.y - 4).setDepth(D + 0.1).setAngle(0);
      } else if (req && a.type === 'geleerter') {
        var gd = Math.cos(a._baseFacing || 0) < 0 ? -1 : 1;
        req.setPosition(a._homeX + gd * 16, a._homeY + 22).setDepth(D + 0.1);
      } else if (req) {
        var bf = a._baseFacing || 0;
        var rx = a._homeX + Math.cos(bf) * 22, ry = a._homeY + Math.sin(bf) * 18 + 10;
        req.setPosition(rx, ry).setDepth(ry > a.y ? D + 0.2 : D - 0.2);
      }
    }

    // Kegel der Figuren, die Augen haben (an Waenden und Traegern abgeschnitten).
    actors.forEach(function (a) {
      var col = KEGEL[a.type];
      if (!col || a.knocked || !a.range) return;
      if (a._state === 'report') {
        // Der Spitzel rennt: gestrichelte Linie zu der Wache, die er holt.
        if (a._target) {
          var dx = a._target.x - a.x, dy = a._target.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
          g.lineStyle(3, 0xff5a5a, 0.85);
          for (var s = 0; s < L; s += 18) {
            var e = Math.min(L, s + 10);
            g.beginPath(); g.moveTo(a.x + dx * s / L, a.y + dy * s / L); g.lineTo(a.x + dx * e / L, a.y + dy * e / L); g.strokePath();
          }
        }
        return;
      }
      var f0 = a._facing || 0, half = a.halfAngle || 0.6, pts = [], RAYS = 12;
      for (var ri = 0; ri <= RAYS; ri++) {
        var ang = f0 - half + 2 * half * (ri / RAYS), hit = a.range;
        for (var d = 9; d <= a.range; d += 9) { if (sichtZu(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d)) { hit = Math.max(0, d - 4); break; } }
        pts.push(a.x + Math.cos(ang) * hit, a.y + Math.sin(ang) * hit);
      }
      var n = a._notice || 0;
      g.fillStyle(col, 0.07 + 0.22 * n);
      g.beginPath(); g.moveTo(a.x, a.y);
      for (var pi = 0; pi < pts.length; pi += 2) g.lineTo(pts[pi], pts[pi + 1]);
      g.closePath(); g.fillPath();
      g.lineStyle(1.5, col, 0.35 + 0.5 * n);
      g.beginPath(); g.moveTo(a.x, a.y);
      for (var pk = 0; pk < pts.length; pk += 2) g.lineTo(pts[pk], pts[pk + 1]);
      g.closePath(); g.strokePath();
    });

    // "?" / "!" ueber Wachen und Figuren: dieselbe Sprache fuer alle.
    var ents = (st.guards || []).map(function (gd) { return { e: gd, h: 78 }; })
      .concat(actors.map(function (a) { return { e: a, h: _figurHoehe(scene, a) }; }));
    while (marken.length < ents.length) {
      marken.push(scene.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#ffd24a', stroke: '#000000', strokeThickness: 5
      }).setOrigin(0.5, 1).setDepth(DEPTH_MARKE).setScrollFactor(1));
    }
    while (marken.length > ents.length) { try { marken.pop().destroy(); } catch (e) {} }
    var puls = 1 + 0.12 * Math.sin(_t * 6);
    ents.forEach(function (it, mi) {
      var m = marken[mi], e = it.e, mk = (e && !e.knocked) ? e._mark : null;
      if (!mk) { m.setVisible(false); return; }
      var top = e.y - it.h / 2 - 8;
      m.setVisible(true).setText(mk).setColor(mk === '!' ? '#ff4a3a' : '#ffd24a').setPosition(e.x, top).setScale(puls);
      // Wie weit ist die Figur? Kleiner Balken unter dem "?".
      if (mk === '?' && typeof e._notice === 'number' && e._notice > 0) {
        var bw = 26;
        g.fillStyle(0x000000, 0.6); g.fillRect(e.x - bw / 2 - 1, top + 1, bw + 2, 6);
        g.fillStyle(0xffd24a, 1); g.fillRect(e.x - bw / 2, top + 2, bw * Math.min(1, e._notice), 4);
      }
    });

    // Ausrufe: kurz ueber dem Kopf, dann verblassen.
    var barks = st.barks || [];
    rufe = rufe.filter(function (r) {
      if (barks.indexOf(r.b) !== -1) return true;
      try { r.txt.destroy(); } catch (e) {}
      return false;
    });
    barks.forEach(function (b) {
      if (!b.ent) return;
      var r = null;
      for (var ri2 = 0; ri2 < rufe.length; ri2++) if (rufe[ri2].b === b) { r = rufe[ri2]; break; }
      if (!r) {
        var warn = b.key === 'meldet' || b.key === 'bote_meldet' || b.key.indexOf('ruf_') === 0;
        r = { b: b, txt: scene.add.text(0, 0, _rufText('spion.ruf.' + b.key), {
          fontFamily: 'serif', fontSize: '16px', fontStyle: 'bold', color: warn ? '#ff9e8f' : '#f4efe2',
          stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 260 }
        }).setOrigin(0.5, 1).setDepth(DEPTH_MARKE + 1).setScrollFactor(1) };
        rufe.push(r);
      }
      var hh = FIGUR[b.ent.type] ? FIGUR[b.ent.type].h : 78;
      r.txt.setPosition(b.ent.x, b.ent.y - hh / 2 - 36 - b.t * 6).setAlpha(b.t > 1.6 ? Math.max(0, 1 - (b.t - 1.6) / 0.6) : 1);
    });

    // Laerm: ein Ring, der sich vom Kampfort ausbreitet.
    (st.noises || []).forEach(function (nz) {
      g.lineStyle(3, 0xffe9a8, Math.max(0, 0.9 - nz.t));
      g.strokeCircle(nz.x, nz.y, 24 + nz.t * 200);
    });
  }

  function _ensureZoneLabels(scene, zones) {
    if (zoneLabels.length === zones.length) return;
    for (var i = 0; i < zoneLabels.length; i++) { try { zoneLabels[i].destroy(); } catch (e) {} }
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

  // Status-Chip-Inhalt nach State.
  function _statusInfo(st, allDone) {
    var en = _isEN();
    if (st.exposed) return { txt: en ? '! EXPOSED' : '! ENTTARNT', col: 0xff4444, tcol: '#ffffff', hot: true };
    if (allDone) return { txt: en ? '✓ ALL HEARD' : '✓ ABGEHOERT', col: 0x33cc77, tcol: '#06210f', hot: false };
    var notice = (window.EspionageSystem && window.EspionageSystem.getNotice) ? window.EspionageSystem.getNotice() : 0;
    if ((st.detection || 0) > 0.05 || notice > 0.15) return { txt: en ? 'SUSPICIOUS' : 'VERDAECHTIG', col: 0xe0a020, tcol: '#1a1200', hot: true };
    return { txt: en ? 'DISGUISED' : 'VERKLEIDET', col: 0x4a8fd0, tcol: '#04121f', hot: false };
  }

  function _actionText(st, allDone) {
    var en = _isEN();
    // Ein Melder rennt: das ist dringender als alles andere (auch in der Nachteskorte).
    if (!st.exposed) {
      var rennt = (st.actors || []).filter(function (a) { return a && !a.knocked && a._state === 'report'; })[0];
      if (rennt) return _rufText(rennt.type === 'ratsbote' ? 'spion.hinweis.ratsbote' : 'spion.hinweis.spitzel');
    }
    // Die Nachteskorte sagt selbst, was gerade zu tun ist (beim Karren bleiben).
    var NK = window.Nachteskorte;
    var eigen = (NK && NK.aktiv && NK.aktiv() && NK.hinweis) ? NK.hinweis(st) : null;
    if (eigen) return eigen;
    if (st.exposed) return en ? 'Get out of the red zones to blend back in.'
                              : 'Raus aus den roten Zonen, dann tauchst du wieder unter.';
    if (allDone) return en ? 'Leave via the stairs.' : 'Verlass den Raum über die Treppe.';
    return en ? 'Reach the gold circle to listen. Avoid the RED cones — or fight through the red guards.'
              : 'Geh in den goldenen Kreis zum Abhören. Meide die ROTEN Kegel — oder kämpf dich durch die roten Wachen.';
  }

  function sync(scene) {
    scene = scene || _scene();
    var active = !!(window.EspionageSystem && typeof window.EspionageSystem.isActive === 'function'
      && window.EspionageSystem.isActive());
    // Stale-mount guard (Hub-Rückkehr / Scene-Switch zerstört unsere Objekte).
    if (mounted && (!g || !g.scene)) { mounted = false; g = gHud = banner = bannerBg = chipBg = chipText = null; zoneLabels = []; guardSprites = []; figurSprites = []; beiwerk = []; marken = []; rufe = []; }

    if (!active) { if (mounted) unmount(); return; }
    if (!mounted) mount(scene);
    if (!g || !banner) return;

    var st = window.EspionageSystem.getState ? window.EspionageSystem.getState() : null;
    if (!st) return;
    _t += 0.06;
    var pulse = 0.5 + 0.5 * Math.sin(_t * 2.2);
    var en = _isEN();
    var det = (typeof st.detection === 'number') ? st.detection : 0;
    var zones = st.observeZones || [];
    var allDone = zones.length > 0 && zones.every(function (z) { return z._done; });
    var cam = scene.cameras && scene.cameras.main;
    var pl = window.player;
    var px = (pl && pl.active) ? pl.x : 0, py = (pl && pl.active) ? pl.y : 0;

    // --- Enttarn-Moment (Flanke verdeckt -> enttarnt) ------------------------
    if (st.exposed && !_prevExposed && cam) {
      try { cam.flash(180, 200, 30, 30, false); } catch (e) {}
      try { cam.shake(170, 0.006); } catch (e) {}
      if (window.soundManager) { try { window.soundManager.playSFX('hit'); } catch (e) {} }
    }
    _prevExposed = st.exposed;

    g.clear();

    // --- Sichtkegel (Graphics) + echte Wachen-SPRITES ------------------------
    // Zwei Wachen-Typen (klar unterscheidbar):
    //   alert=true  -> ROTER Kegel: erkennt dich AUCH verkleidet (meiden!)
    //   alert=false -> BLAUER Kegel: lässt dich verkleidet in Ruhe
    var alert = st.exposed ? 1 : Math.min(1, det * 1.5);
    var guards = st.guards || [];
    var blockedAt = st.blockedAt;   // (wx,wy)=>bool: Wand-Test für Sichtlinien
    // Traeger mit Kiste schneiden die Kegel ab wie eine Wand (bewegte Deckung).
    var sichtZu = (typeof window.EspionageSystem.sightBlockedAt === 'function')
      ? window.EspionageSystem.sightBlockedAt : (blockedAt || function () { return false; });
    // Raycast: wie weit reicht ein Strahl aus (gx,gy) unter Winkel ang, bis er
    // auf eine Wand trifft (oder die volle Reichweite)?
    var _rayHit = function (gx, gy, ang, range) {
      var cx = Math.cos(ang), sy = Math.sin(ang), step = 9;
      for (var d = step; d <= range; d += step) {
        if (sichtZu(gx + cx * d, gy + sy * d)) return Math.max(0, d - step * 0.5);
      }
      return range;
    };
    // 1) Sichtkegel zeichnen — an Wänden abgeschnitten (Line-of-Sight).
    guards.forEach(function (gd) {
      if (gd.knocked) return;
      var range = gd.range || 0;
      if (range <= 0) return;
      var isAlert = !!gd.alert;
      var coneCol = st.exposed ? 0xff2020
        : isAlert ? 0xff4040                              // rot: durchschaut Verkleidung
        : (alert > 0.5 ? 0xff8a2a : 0x53b6ff);            // blau (safe) -> orange bei Verdacht
      var f = gd._facing || 0, half = gd.halfAngle || 0.6;
      var baseA = isAlert ? 0.14 : 0.08;
      // Strahlenfächer: jeder Strahl wird an der ersten Wand gestoppt.
      var RAYS = 18, pts = [];
      for (var ri = 0; ri <= RAYS; ri++) {
        var a = f - half + (2 * half) * (ri / RAYS);
        var hit = _rayHit(gd.x, gd.y, a, range);
        pts.push(gd.x + Math.cos(a) * hit, gd.y + Math.sin(a) * hit);
      }
      // Füllung (Polygon Wache -> Fächerpunkte)
      g.fillStyle(coneCol, baseA + 0.12 * alert);
      g.beginPath(); g.moveTo(gd.x, gd.y);
      for (var pi = 0; pi < pts.length; pi += 2) g.lineTo(pts[pi], pts[pi + 1]);
      g.closePath(); g.fillPath();
      // Kontur
      g.lineStyle(1.5, coneCol, (isAlert ? 0.6 : 0.4) + 0.4 * alert);
      g.beginPath(); g.moveTo(gd.x, gd.y);
      for (var pk = 0; pk < pts.length; pk += 2) g.lineTo(pts[pk], pts[pk + 1]);
      g.closePath(); g.strokePath();
      // Blickstrahl (Mitte), ebenfalls an Wand gestoppt
      var cHit = _rayHit(gd.x, gd.y, f, range * 0.55);
      g.lineStyle(2, coneCol, 0.5);
      g.beginPath(); g.moveTo(gd.x, gd.y); g.lineTo(gd.x + Math.cos(f) * cHit, gd.y + Math.sin(f) * cHit); g.strokePath();
    });
    // 2) Wachen-Sprites synchronisieren (erstellen/positionieren/stylen)
    // Self-Heal: ChainGuard-Textur erst jetzt verfügbar -> Fallback ersetzen.
    if (_guardTex !== 'chainguard_right0' && scene.textures && scene.textures.exists('chainguard_right0')) {
      _guardTex = 'chainguard_right0';
      for (var sh = 0; sh < guardSprites.length; sh++) { try { guardSprites[sh].setTexture(_guardTex); } catch (e) {} }
    }
    // Wachen genau so gross wie die verkleidete Spielerfigur: derselbe feste
    // Massstab wie die Montur (window.montureSkala), nicht deren Hoehe im
    // gerade gezeigten Laufbild — die wechselte und liess die Wachen pumpen.
    var _gSkala = (_guardTex === 'chainguard_right0' && typeof window.montureSkala === 'function')
      ? window.montureSkala(scene) : 0;
    var _gH = 78;
    var _gAspect = 0.82;
    try { var _gsrc = scene.textures.get(_guardTex).getSourceImage(); if (_gsrc && _gsrc.height) _gAspect = _gsrc.width / _gsrc.height; } catch (e) {}
    var _gW = Math.max(1, Math.round(_gH * _gAspect));
    while (guardSprites.length < guards.length) {
      var sp = scene.add.sprite(0, 0, _guardTex || 'esp_guard_fallback').setDepth(DEPTH_WORLD + 2).setScrollFactor(1);
      guardSprites.push(sp);
    }
    while (guardSprites.length > guards.length) { try { guardSprites.pop().destroy(); } catch (e) {} }
    for (var gi = 0; gi < guards.length; gi++) {
      var gd2 = guards[gi], spr = guardSprites[gi];
      if (!spr) continue;
      spr.setVisible(true);
      if (_gSkala > 0) spr.setScale(_gSkala);   // gleiche Grösse wie der verkleidete Spieler
      else spr.setDisplaySize(_gW, _gH);
      spr.setPosition(gd2.x, gd2.y);
      var ff = gd2._facing || 0;
      spr.setFlipX(Math.cos(ff) < 0);                 // nach links schauen -> spiegeln
      if (gd2.knocked) {
        spr.setTint(0x777777); spr.setAlpha(0.7); spr.setAngle(90);  // liegt
      } else {
        spr.setAngle(0); spr.setAlpha(1);
        if (st.exposed) spr.setTint(0xff5a5a);              // alarmiert -> rot
        else if (alert > 0.4) spr.setTint(0xffc080);        // misstrauisch -> orange
        else if (gd2.alert) spr.setTint(0xff9a9a);          // Alarm-Typ: rot-Tint als Warnung
        else spr.clearTint();                               // normaler Typ: neutral
        // Lebensbalken — erscheint, sobald die Wache Schaden genommen hat.
        if (typeof gd2.hp === 'number' && typeof gd2.maxHp === 'number' && gd2.maxHp > 0 && gd2.hp < gd2.maxHp) {
          var frac = Math.max(0, Math.min(1, gd2.hp / gd2.maxHp));
          var bw = 36, bh = 5;
          var bx = gd2.x - bw / 2, by = gd2.y - _gH / 2 - 12;
          g.fillStyle(0x000000, 0.65); g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          g.fillStyle(0x3a0d0d, 1); g.fillRect(bx, by, bw, bh);       // leerer Teil
          var hcol = frac > 0.5 ? 0x53e07a : (frac > 0.25 ? 0xffd24a : 0xff5a5a);
          g.fillStyle(hcol, 1); g.fillRect(bx, by, bw * frac, bh);    // gefüllter Teil
          g.lineStyle(1, 0x000000, 0.8); g.strokeRect(bx, by, bw, bh);
        }
      }
    }
    // Verkleidung = ersetztes Spieler-Sprite (siehe player.js), kein Overlay hier.

    _figurenZeichnen(scene, st, sichtZu);

    // --- Abhör-Zonen (golden, pulsierend; grün wenn fertig) ----------------
    _ensureZoneLabels(scene, zones);
    zones.forEach(function (z, i) {
      var r = z.r || 64;
      // Gesperrte Station (Nachteskorte): erst sichtbar, wenn der Karren dort haelt.
      if (zoneLabels[i]) zoneLabels[i].setVisible(!z.gesperrt);
      if (z.gesperrt) return;
      // Fertigstellungs-Pop (einmalig je Zone)
      if (z._done && !z._fxDone) {
        z._fxDone = true;
        try {
          var fx = scene.add.circle(z.x, z.y, r, 0x66ffaa, 0.5).setDepth(DEPTH_WORLD).setScrollFactor(1);
          if (scene.tweens) scene.tweens.add({ targets: fx, scale: 1.5, alpha: 0, duration: 420, onComplete: function () { try { fx.destroy(); } catch (e) {} } });
          else scene.time.delayedCall(420, function () { try { fx.destroy(); } catch (e) {} });
          if (window.soundManager) window.soundManager.playSFX('level_up');
        } catch (e) {}
      }
      if (z._done) {
        g.fillStyle(0x33dd88, 0.20); g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0x44ee99, 0.95); g.strokeCircle(z.x, z.y, r);
        if (zoneLabels[i]) { zoneLabels[i].setText(en ? '✓ HEARD' : '✓ ABGEHOERT'); zoneLabels[i].setColor('#7dffb0'); }
      } else {
        g.fillStyle(0xffc23a, 0.12 + 0.16 * pulse); g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0xffd966, 0.6 + 0.4 * pulse); g.strokeCircle(z.x, z.y, r);
        g.lineStyle(2, 0xffe27a, 0.8);
        g.beginPath(); g.moveTo(z.x - 10, z.y); g.lineTo(z.x + 10, z.y); g.strokePath();
        g.beginPath(); g.moveTo(z.x, z.y - 10); g.lineTo(z.x, z.y + 10); g.strokePath();
        var prog = (z.seconds > 0) ? Math.min(1, (z._elapsed || 0) / z.seconds) : 0;
        if (prog > 0.001) {
          g.lineStyle(6, 0xffffff, 0.95);
          g.beginPath(); g.arc(z.x, z.y, r + 7, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false); g.strokePath();
        }
      }
    });

    // Kein Ring mehr am Spieler: der Kreis um die Figur stoerte (User-Wunsch).
    // Verdacht zeigen die Wachen selbst — Kegel und Figur faerben sich orange,
    // bei Enttarnung rot.

    // --- Off-screen-Pfeil zur nächsten offenen Zone -------------------------
    gHud.clear();
    if (cam && !st.exposed && !allDone) {
      var open = zones.filter(function (z) { return !z._done && !z.gesperrt; });
      if (open.length && pl) {
        var tgt = open[0], best = Infinity;
        open.forEach(function (z) {
          var d = (z.x - px) * (z.x - px) + (z.y - py) * (z.y - py);
          if (d < best) { best = d; tgt = z; }
        });
        var onScreen = (tgt.x >= cam.scrollX && tgt.x <= cam.scrollX + cam.width
          && tgt.y >= cam.scrollY && tgt.y <= cam.scrollY + cam.height);
        if (!onScreen) {
          var sx = cam.width / 2, sy = cam.height / 2;
          var ang = Math.atan2((tgt.y - cam.scrollY) - sy, (tgt.x - cam.scrollX) - sx);
          var ex = sx + Math.cos(ang) * (cam.width / 2 - 60);
          var ey = sy + Math.sin(ang) * (cam.height / 2 - 60);
          var s = 15;
          gHud.fillStyle(0xffd24a, 0.92);
          gHud.beginPath();
          gHud.moveTo(ex + Math.cos(ang) * s, ey + Math.sin(ang) * s);
          gHud.lineTo(ex + Math.cos(ang + 2.5) * s, ey + Math.sin(ang + 2.5) * s);
          gHud.lineTo(ex + Math.cos(ang - 2.5) * s, ey + Math.sin(ang - 2.5) * s);
          gHud.closePath(); gHud.fillPath();
        }
      }
    }

    // --- HUD: Status-Chip + Aktionszeile ------------------------------------
    var si = _statusInfo(st, allDone);
    chipText.setText(si.txt);
    chipText.setColor(si.tcol);
    chipBg.setSize(Math.max(120, chipText.width + 26), 26);
    chipBg.setFillStyle(si.col, si.hot ? (0.75 + 0.25 * pulse) : 0.95);
    banner.setText(_actionText(st, allDone));
    var _nkWarnt = !!(window.Nachteskorte && window.Nachteskorte.warnt && window.Nachteskorte.warnt());
    banner.setColor((st.exposed || _nkWarnt) ? '#ff9a9a' : '#ffe6a8');
    // Box an den (evtl. umgebrochenen) Text anpassen, damit er nie ueberlaeuft.
    if (bannerBg && typeof bannerBg.setSize === 'function') {
      var _camW = (cam && cam.width) ? cam.width : 800;
      bannerBg.setSize(Math.min(760, _camW - 40, banner.width + 24), banner.height + 12);
    }
  }

  window.EspionageVisuals = { sync: sync, mount: mount, unmount: unmount };
})();
