/* =====================================================================
 * bossZwischenszene.js — kurze Zwischenszene vor jedem Boss
 * ---------------------------------------------------------------------
 * Vorschau hinter ?debug=1&bossintro=neu. Ohne Flagge laeuft alles wie
 * bisher (Banner bzw. der Vorkampf-Beat aus js/bossIntro.js).
 *
 * Ablauf: Spieluhr steht, Letterbox-Balken fahren ein, die Kamera schwenkt
 * vom Spieler zum Boss, ein kurzer Zoom-Stoss zum Auftritt (ein Schritt
 * auf den Spieler zu, Effekt je Boss: Risse, Kerzenkreis, Schatten,
 * Quellnebel). Dann die Messing-Plakette mit Siegel, Name und Beiname, und
 * der Boss spricht — Seite fuer Seite, weiter per Taste, Klick oder Tipp.
 * ESC oder der Knopf "Ueberspringen" beenden jederzeit. Danach Kamera
 * zurueck, Balken raus, und der Kampf beginnt wie ohne Szene: Boss-KI,
 * Musik und Angriffstakt sind nicht beruehrt, nur angehalten.
 *
 * Der Ablauf haengt an setTimeout (wie js/bossIntro.js): Tweens sind Zierde,
 * ein haengender Tween darf das Spiel nie festhalten. Fehlt ein Bild, faellt
 * nur dieses Stueck weg (kein Siegel, kein Effekt, schlichte Plakette).
 *
 * Bilder: assets/sprites/bossintro/, gebaut von tools/bossIntroBauen.js.
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/bossintro/';
  var V = 1;

  // Effekt je Art: Rastergroesse und Bildzahl wie in tools/bossIntroBauen.js.
  // lage: 'fuss' = Mitte am Boden unter dem Boss, 'hinter' = Boden, hinter ihm.
  var VFX = {
    ketten: { w: 91, h: 56, n: 8, bis: 6, fps: 12, schleife: false, massstab: 2, ankerY: 0.5, lage: 'fuss' },
    kerzen: { w: 144, h: 74, n: 12, fps: 12, schleife: true, massstab: 1.25, ankerY: 44 / 74, lage: 'fuss', alpha: 0.85 },
    schatten: { w: 72, h: 116, n: 16, fps: 12, schleife: true, massstab: 1.7, ankerY: 97 / 116, lage: 'hinter' },
    nebel: { w: 174, h: 56, n: 24, fps: 10, schleife: true, massstab: 1.6, ankerY: 31 / 56, lage: 'fuss', alpha: 0.9 }
  };

  // Je Boss: Siegel, Effekt, Text-Keys (Name kommt aus BOSS_DEFINITIONS).
  var BOSSE = {
    chainMaster: { siegel: 'ketten', vfx: 'ketten', stoss: true, seiten: 2 },
    ceremonyMaster: { siegel: 'kerze', vfx: 'kerzen', seiten: 2 },
    shadowCouncillor: { siegel: 'maske', vfx: 'schatten', seiten: 2 },
    elaraBesessen: { siegel: 'ring', vfx: 'nebel', seiten: 2 }
  };

  var DE = {
    'bossintro.weiter': 'Weiter',
    'bossintro.ueberspringen': 'Überspringen (ESC)',
    'bossintro.ueberspringen_mobil': 'Überspringen',
    'bossintro.chainMaster.beiname': 'Folterknecht der Garde',
    'bossintro.chainMaster.1': 'Noch einer, der Fragen stellt. Der Rat hat für jeden eine Kette.',
    'bossintro.chainMaster.2': 'Knie nieder. Wer sich fügt, wird nur vergessen.',
    'bossintro.ceremonyMaster.beiname': 'Oberster Ritualist des Klerus',
    'bossintro.ceremonyMaster.1': 'Jede Kerze hier brennt mit einem Namen, den die Stadt vergessen hat.',
    'bossintro.ceremonyMaster.2': 'Deiner wird ein schönes Licht geben.',
    'bossintro.shadowCouncillor.beiname': 'Der innere Kreis des Kettenrats',
    'bossintro.shadowCouncillor.1': 'Du hast für uns gearbeitet, Archivschmied. Auf beiden Seiten.',
    'bossintro.shadowCouncillor.2': 'Wer bestimmt, woran sich die Stadt erinnert, beherrscht sie. Heute vergisst sie Dich.',
    'bossintro.elaraBesessen.beiname': 'Gefäß der Quelle',
    'bossintro.elaraBesessen.1': 'Die Quelle flüstert Deinen Namen. Gleich hat sie ihn vergessen.',
    'bossintro.elaraBesessen.2': 'Bleib. Lass sie nehmen, woran Du Dich erinnerst. Es tut nicht weh.'
  };
  var EN = {
    'bossintro.weiter': 'Continue',
    'bossintro.ueberspringen': 'Skip (ESC)',
    'bossintro.ueberspringen_mobil': 'Skip',
    'bossintro.chainMaster.beiname': 'Torturer of the Guard',
    'bossintro.chainMaster.1': 'Another one asking questions. The council has a chain for everyone.',
    'bossintro.chainMaster.2': 'Kneel. Those who yield are merely forgotten.',
    'bossintro.ceremonyMaster.beiname': 'High Ritualist of the Clergy',
    'bossintro.ceremonyMaster.1': 'Every candle here burns with a name the city has forgotten.',
    'bossintro.ceremonyMaster.2': 'Yours will make a lovely light.',
    'bossintro.shadowCouncillor.beiname': 'Inner circle of the Chain Council',
    'bossintro.shadowCouncillor.1': 'You worked for us, Archivesmith. On both sides.',
    'bossintro.shadowCouncillor.2': 'Whoever decides what the city remembers rules it. Today it forgets you.',
    'bossintro.elaraBesessen.beiname': 'Vessel of the Source',
    'bossintro.elaraBesessen.1': 'The source whispers your name. Soon it will have forgotten it.',
    'bossintro.elaraBesessen.2': 'Stay. Let it take what you remember. It does not hurt.'
  };
  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', DE);
    window.i18n.register('en', EN);
  }
  function _t(key) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (I && typeof I.t === 'function') {
      var s = I.t(key);
      if (s && s !== key) return s;
    }
    var en = !!(I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en');
    return (en ? EN : DE)[key] || key;
  }

  // Zeiten (ms), alle mit _TEMPO multipliziert.
  var BALKEN_MS = 350;
  var KAMERA_MS = 900;
  var AUFTRITT_AB = 700;
  var STOSS_MS = 350;
  var PLAKETTE_AB = 1300;
  var REDE_AB = 1800;
  var AUSKLANG_MS = 500;
  // Eine Eingabe zaehlt erst so lange nach dem Erscheinen einer Seite: sonst
  // blaettert der Tastendruck aus dem Kampf davor gleich die erste Seite weg.
  var EINGABE_AB = 300;
  var NOTAUSGANG_MS = 60000;
  var KNOPF_MIN_H = 44;

  function aktiv() {
    var G = (typeof window !== 'undefined') ? window.DebugGate : null;
    try { return !!(G && G.flagge('bossintro') === 'neu'); } catch (e) { return false; }
  }

  function siegelKey(n) { return 'bossintro_siegel_' + n; }
  function vfxKey(n) { return 'bossintro_vfx_' + n; }

  /** Im preload(): nur mit Flagge, nur die fehlenden. */
  function vorladen(scene) {
    if (!aktiv() || !scene || !scene.load || !scene.textures) return;
    ['ketten', 'kerze', 'maske', 'ring'].forEach(function (n) {
      var k = siegelKey(n);
      if (!scene.textures.exists(k)) scene.load.image(k, ORDNER + k + '.png?v=' + V);
    });
    Object.keys(VFX).forEach(function (n) {
      var k = vfxKey(n), s = VFX[n];
      if (!scene.textures.exists(k)) scene.load.spritesheet(k, ORDNER + k + '.png?v=' + V, { frameWidth: s.w, frameHeight: s.h });
    });
  }

  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }

  function _mobil(scene) {
    try { return !!(scene.sys.game.device.input.touch); } catch (e) { return false; }
  }

  function _effekt(scene, art, boss) {
    var s = VFX[art], key = vfxKey(art);
    if (!s || !scene.textures || !scene.textures.exists(key) || !scene.add.sprite) return null;
    var b = boss.getBounds ? boss.getBounds() : { centerX: boss.x, bottom: boss.y + 48 };
    var fussY = b.bottom - 4;
    var spr = scene.add.sprite(b.centerX, fussY, key, 0).setOrigin(0.5, s.ankerY).setScale(s.massstab);
    spr.setDepth((boss.depth || 0) + (s.lage === 'hinter' ? -0.5 : 0.5));
    if (s.alpha) spr.setAlpha(s.alpha);
    var name = key + '_lauf';
    try {
      if (scene.anims && !scene.anims.exists(name)) {
        scene.anims.create({
          key: name, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: (s.bis || s.n) - 1 }),
          frameRate: s.fps, repeat: s.schleife ? -1 : 0
        });
      }
      spr.play(name);
      if (!s.schleife) spr.once('animationcomplete', function () { _weg(spr); });
    } catch (e) { /* steht dann als Standbild */ }
    return spr;
  }

  // Lichtkreis: ein Weltbild mit hellem Loch um den Boss, aussen fast
  // schwarz. Als Bild statt Maske: kein Neuzeichnen pro Bild, und es
  // wirkt im Canvas-Renderer genauso wie unter WebGL.
  var LICHT = 'bossintro_licht', LICHT_PX = 512, LICHT_WELT = 2200;
  var LICHT_INNEN = 210, LICHT_AUSSEN = 380, LICHT_DUNKEL = 0.86;
  function _lichtkreis(scene, boss) {
    if (!scene.textures || !scene.add || !scene.add.image) return null;
    try {
      if (!scene.textures.exists(LICHT)) {
        var ct = scene.textures.createCanvas(LICHT, LICHT_PX, LICHT_PX);
        if (!ct) return null;
        var ctx = ct.getContext(), m = LICHT_PX / 2, k = LICHT_PX / LICHT_WELT;
        var g = ctx.createRadialGradient(m, m, LICHT_INNEN * k, m, m, LICHT_AUSSEN * k);
        g.addColorStop(0, 'rgba(5,6,10,0)');
        g.addColorStop(1, 'rgba(5,6,10,' + LICHT_DUNKEL + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, LICHT_PX, LICHT_PX);
        ct.refresh();
        // Weich gestreckt, nicht in Pixelstufen (pixelArt: true waehlt NEAREST).
        try { ct.setFilter(0); } catch (e) {}
      }
      var b = boss.getBounds ? boss.getBounds() : { centerX: boss.x, centerY: boss.y };
      return scene.add.image(b.centerX, b.centerY, LICHT).setDisplaySize(LICHT_WELT, LICHT_WELT)
        .setDepth(999).setAlpha(0).setName('bossintroLicht');
    } catch (e) { return null; }
  }

  /**
   * Spielt die Zwischenszene.
   *
   * @param {Phaser.Scene} scene
   * @param {object} boss  das Boss-Sprite (steht waehrenddessen still)
   * @param {object} def   Eintrag aus BOSS_DEFINITIONS (id, name)
   * @returns {boolean} ob die Szene laeuft; false = Aufrufer zeigt den Banner
   */
  function spiele(scene, boss, def) {
    if (!scene || !scene.add || !scene.tweens || !scene.scale || !def) return false;
    if (scene.__bossIntroLaeuft) return false;
    scene.__bossIntroLaeuft = true;

    var f = Zwischenszene._TEMPO > 0 ? Zwischenszene._TEMPO : 1;
    var frist = function (ms) { return Math.max(1, Math.round(ms * f)); };
    var cfg = BOSSE[def.id] || { seiten: 0 };
    var UR = (typeof window !== 'undefined') ? window.uiRahmen : null;
    var messing = !!(UR && UR.bereit && UR.bereit(scene));
    var mobil = _mobil(scene);

    var b = scene.scale.width, h = scene.scale.height;
    var obenH = Math.round(h * 0.12), untenH = Math.round(h * 0.22);
    var kam = scene.cameras && scene.cameras.main;
    var zoomVorher = (kam && typeof kam.zoom === 'number') ? kam.zoom : 1;
    var figur = (typeof window !== 'undefined') ? window.player : null;
    var teile = [], uhren = [], abmelden = [];
    var beendet = false, ausklangLaeuft = false, leisteWarAn = false;
    var choiceVorher = (typeof window !== 'undefined') ? window.eventChoiceOpen : undefined;
    var seiten = [];
    for (var i = 1; i <= cfg.seiten; i++) seiten.push(_t('bossintro.' + def.id + '.' + i));
    var zustand = { phase: 'auftritt', seite: -1, seiten: seiten.length };

    function spaeter(ms, fn) { uhren.push(setTimeout(function () { if (!beendet) fn(); }, frist(ms))); }
    function tween(c) { try { return scene.tweens.add(c); } catch (e) { return null; } }
    function neu(o) { if (o) { if (o.setScrollFactor) o.setScrollFactor(0); teile.push(o); } return o; }

    // --- Spiel anhalten -----------------------------------------------------
    if (boss) {
      try {
        boss._introHaltBis = Number.MAX_SAFE_INTEGER;
        if (boss.body && boss.body.setVelocity) boss.body.setVelocity(0, 0);
      } catch (e) {}
    }
    try {
      if (typeof window.faehigkeitsLeisteSichtbar === 'function') {
        leisteWarAn = window.faehigkeitsLeisteSichtbar(false) > 0 || leisteWarAn;
      }
      if (typeof window.mobileAbilityLeisteSichtbar === 'function') {
        leisteWarAn = window.mobileAbilityLeisteSichtbar(false) > 0 || leisteWarAn;
      }
    } catch (e) {}
    // Die uebrige Bildschirm-Oberflaeche (Lebensleiste, Karte, Hinweise) aus:
    // sie stuende sonst auf den Balken und mitten im Bild. Gemerkt wird genau,
    // was hier ausgeblendet wurde — nur das kommt danach zurueck. Darunter
    // (Spotlight, Nebel) bleibt alles, das gehoert zur Welt.
    //
    // Nicht nur einmal: ein per ?boss= erzwungener Boss erscheint noch im
    // create() der Szene, VOR der Minikarte und dem Raumbalken. Darum fegt
    // die Szene jedes Bild nach (im Browser gemessen: graues Rechteck und
    // Punktreihe oben rechts, ueber Plakette und Ueberspringen-Knopf).
    var hudAus = [];
    function hudFegen() {
      try {
        scene.children.list.forEach(function (o) {
          if (o && o.visible && o.scrollFactorX === 0 && (o.depth || 0) >= 1000 && teile.indexOf(o) < 0) {
            o.setVisible(false);
            hudAus.push(o);
          }
        });
      } catch (e) {}
    }
    hudFegen();
    if (scene.events && typeof scene.events.on === 'function') {
      scene.events.on('update', hudFegen);
      abmelden.push(function () { scene.events.off('update', hudFegen); });
    }

    // --- Licht ----------------------------------------------------------------
    // Waehrend der Szene steht die Spieluhr, und mit ihr der Nebel-Tick: der
    // Kriegsnebel (fogUnseen) deckt alles noch Unerkundete schwarz zu, das
    // Spotlight dunkelt alles ausser dem LETZTEN Sichtfeld des Spielers ab,
    // und die Sichtmaske der Gegner laesst den Boss nur dort durch. Ein Boss,
    // der beim Betreten des Raums erscheint, stand so im Schwarzen (im Browser
    // gemessen: die ganze Welt schwarz). Fuer die Dauer der Szene treten diese
    // drei zurueck; ein eigener Lichtkreis um den Boss haelt den Rest dunkel.
    // Danach kommt alles zurueck, und ein erzwungener Nebel-Tick zeichnet das
    // Sichtfeld neu. Erkundet wird dabei nichts.
    var lichtAus = [];
    ['fogUnseen', 'spotlightDim'].forEach(function (n) {
      var o = scene[n];
      if (o && o.visible && o.setVisible) { o.setVisible(false); lichtAus.push(o); }
    });
    var maskeBoss = boss && boss.mask ? boss.mask : null;
    var ebene = scene.enemyLayer && scene.enemyLayer.mask ? scene.enemyLayer : null;
    var maskeEbene = ebene ? ebene.mask : null;
    try { if (maskeBoss && boss.clearMask) boss.clearMask(); } catch (e) {}
    try { if (ebene && ebene.clearMask) ebene.clearMask(); } catch (e) {}
    var licht = boss ? _lichtkreis(scene, boss) : null;
    if (licht) {
      teile.push(licht);
      tween({ targets: licht, alpha: 1, duration: frist(BALKEN_MS) });
    }
    try {
      window.eventChoiceOpen = true;
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    } catch (e) {}

    function aufraeumen() {
      if (beendet) return;
      beendet = true;
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      uhren.length = 0;
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      abmelden.length = 0;
      try { window.eventChoiceOpen = choiceVorher; } catch (e) {}
      teile.forEach(_weg);
      teile.length = 0;
      hudAus.forEach(function (o) { if (o && o.scene) { try { o.setVisible(true); } catch (e) {} } });
      hudAus.length = 0;
      lichtAus.forEach(function (o) { if (o && o.scene) { try { o.setVisible(true); } catch (e) {} } });
      lichtAus.length = 0;
      try { if (maskeBoss && boss && boss.scene && boss.setMask) boss.setMask(maskeBoss); } catch (e) {}
      try { if (maskeEbene && ebene.scene && ebene.setMask) ebene.setMask(maskeEbene); } catch (e) {}
      try { if (typeof window.forceFogUpdate === 'function') window.forceFogUpdate(); } catch (e) {}
      if (boss) {
        try {
          boss._introHaltBis = 0;
          // Der Auftrittsschritt hat das Bild verschoben; der (angehaltene)
          // Koerper muss mitkommen, sonst springt der Boss beim ersten Bild.
          if (boss.body && typeof boss.body.reset === 'function') boss.body.reset(boss.x, boss.y);
        } catch (e) {}
      }
      if (kam) {
        try {
          if (typeof kam.setZoom === 'function') kam.setZoom(zoomVorher);
          if (figur && typeof kam.startFollow === 'function') kam.startFollow(figur, true, 0.12, 0.12);
        } catch (e) {}
      }
      try {
        if (leisteWarAn) {
          if (typeof window.faehigkeitsLeisteSichtbar === 'function') window.faehigkeitsLeisteSichtbar(true);
          if (typeof window.mobileAbilityLeisteSichtbar === 'function') window.mobileAbilityLeisteSichtbar(true);
        }
      } catch (e) {}
      try { if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene); } catch (e) {}
      zustand.phase = 'fertig';
      scene.__bossIntroLaeuft = false;
      if (scene.__bossZwischenszene === zustand) scene.__bossZwischenszene = null;
    }
    uhren.push(setTimeout(aufraeumen, Zwischenszene._NOTAUSGANG_MS));

    // --- Letterbox ------------------------------------------------------------
    var oben = neu(scene.add.rectangle(b / 2, -obenH / 2, b, obenH, 0x05060a, 1).setDepth(1098));
    var unten = neu(scene.add.rectangle(b / 2, h + untenH / 2, b, untenH, 0x05060a, 1).setDepth(1098));
    tween({ targets: oben, y: obenH / 2, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });
    tween({ targets: unten, y: h - untenH / 2, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });

    // --- Kamera vom Spieler zum Boss ----------------------------------------
    // Ziel so, dass der Boss in der Mitte des freien Streifens zwischen den
    // Balken steht, nicht in der Bildmitte (die unten im Textbalken laege).
    var versatzY = (untenH - obenH) / 2;
    if (kam) {
      try {
        if (typeof kam.stopFollow === 'function') kam.stopFollow();
        if (boss && typeof kam.pan === 'function') kam.pan(boss.x, boss.y + versatzY, frist(KAMERA_MS), 'Quad.easeInOut');
      } catch (e) { /* Kamera ist Zierde */ }
    }

    // --- Auftritt -----------------------------------------------------------
    spaeter(AUFTRITT_AB, function () {
      if (kam && typeof kam.zoomTo === 'function') {
        try {
          kam.zoomTo(zoomVorher * 1.18, frist(STOSS_MS), 'Quad.easeOut');
          // Vor der Plakette wieder bei 1: die Texte stehen ohne Zoom scharf
          // an ihrem Platz, und Trefferflaechen liegen, wo man sie sieht.
          spaeter(STOSS_MS + 150, function () { kam.zoomTo(zoomVorher, frist(400), 'Quad.easeInOut'); });
        } catch (e) {}
      }
      if (cfg.stoss && kam && typeof kam.shake === 'function') { try { kam.shake(frist(260), 0.006); } catch (e) {} }
      if (boss && cfg.vfx) { var fx = _effekt(scene, cfg.vfx, boss); if (fx) teile.push(fx); }
      // Ein Schritt auf den Spieler zu, mit den Laufbildern des Bosses.
      if (boss && figur && typeof boss.x === 'number') {
        var dir = figur.x >= boss.x ? 'right' : 'left';
        var pre = boss._bossPrefix;
        var bild = function (n) {
          var k = pre + '_' + dir + n;
          if (pre && scene.textures && scene.textures.exists(k) && boss.scene) { try { boss.setTexture(k); } catch (e) {} }
        };
        if (pre) boss._bossDirection = dir;
        bild(1);
        spaeter(200, function () { bild(2); });
        spaeter(400, function () { bild(0); });
        tween({ targets: boss, x: boss.x + (dir === 'right' ? 18 : -18), duration: frist(500), ease: 'Quad.easeOut' });
      }
    });

    // --- Plakette: Siegel, Name, Beiname -----------------------------------
    spaeter(PLAKETTE_AB, function () {
      var pw = Math.min(420, b - 40), ph = 76;
      var px = 24 + pw / 2 + 24, py = obenH + 14 + ph / 2;
      // Steht der Boss links im Bild (Kamera an der Raumkante), kommt die
      // Plakette nach rechts — sie soll ihn vorstellen, nicht verdecken.
      // Ebenso nach unten, wenn er oben steht: an der Raumkante kann die
      // Kamera ihn nicht in die Mitte holen (im Browser: Kopf unter der Plakette).
      try {
        var sicht = kam && kam.worldView;
        if (boss && sicht && sicht.width) {
          if (boss.x - sicht.x < b / 2) px = b - 24 - pw / 2;
          var kopf = boss.getBounds ? boss.getBounds().top : boss.y;
          if (kopf - sicht.y < obenH + 14 + ph + 10) py = h - untenH - 14 - ph / 2;
        }
      } catch (e) {}
      var platte;
      if (messing && UR.kachelBild) {
        var tex = UR.kachelBild(scene, pw, ph);
        platte = tex ? scene.add.image(px, py, tex) : null;
      }
      if (!platte) {
        platte = scene.add.rectangle(px, py, pw, ph, 0x1c191f, 0.96).setStrokeStyle(2, 0xd9b867, 1);
      }
      neu(platte.setDepth(1101));
      var sk = siegelKey(cfg.siegel || '');
      var textLinks = px - pw / 2 + 20;
      if (cfg.siegel && scene.textures && scene.textures.exists(sk)) {
        // Das Medaillon haengt ueber dem linken Rand der Plakette, doppelt
        // so gross wie gemalt (ganze Pixel).
        neu(scene.add.image(px - pw / 2 + 8, py, sk).setScale(2).setDepth(1102)).setName('bossintroSiegel');
        textLinks = px - pw / 2 + 64;
      }
      var name = neu(scene.add.text(textLinks, py - 6, String(def.name || ''), {
        fontFamily: 'serif', fontSize: '24px', fontStyle: 'bold', color: '#ffd166',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0, 1).setDepth(1102)).setName('bossintroName');
      var beiname = neu(scene.add.text(textLinks, py + 2, _t('bossintro.' + def.id + '.beiname'), {
        fontFamily: 'monospace', fontSize: '14px', color: '#efe6d2'
      }).setOrigin(0, 0).setDepth(1102)).setName('bossintroBeiname');
      // Lange Namen (EN) in die Plakette einpassen.
      var platz = px + pw / 2 - 16 - textLinks;
      [name, beiname].forEach(function (t) { if (t.width > platz) t.setScale(platz / t.width); });
      [platte, name, beiname].concat(teile.filter(function (o) { return o.name === 'bossintroSiegel'; }))
        .forEach(function (o) {
          var zielX = o.x;
          o.x = zielX - 40; o.setAlpha(0);
          tween({ targets: o, x: zielX, alpha: 1, duration: frist(350), ease: 'Quad.easeOut' });
        });
    });

    // --- Rede, Seite fuer Seite -------------------------------------------
    var sprecher = null, rede = null, weiterKnopf = null;
    var bereitAb = Date.now() + frist(EINGABE_AB);
    var textB = b - 48 - 150;

    function zeigeSeite(n) {
      zustand.seite = n;
      zustand.phase = 'rede';
      if (!sprecher) {
        sprecher = neu(scene.add.text(24, h - untenH + 10, String(def.name || '').toUpperCase(), {
          fontFamily: 'serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd166'
        }).setDepth(1102)).setName('bossintroSprecher');
        rede = neu(scene.add.text(24, h - untenH + 34, '', {
          fontFamily: 'monospace', fontSize: '16px', color: '#efe6d2', lineSpacing: 4,
          wordWrap: { width: textB }
        }).setDepth(1102)).setName('bossintroRede');
      }
      rede.setText(seiten[n]);
      rede.setAlpha(0);
      tween({ targets: rede, alpha: 1, duration: frist(220) });
      bereitAb = Date.now() + frist(EINGABE_AB);
    }

    function knopf(text, x, y, ton) {
      var t = scene.add.text(x, y, text, {
        fontFamily: 'monospace', fontSize: '14px', color: '#f4efe2', align: 'center',
        padding: { x: 14, y: 8 }
      }).setOrigin(1, 0.5).setDepth(1103);
      // Mind. 44 px hoch: Polster statt fester Groesse.
      var py = Math.max(8, Math.ceil((KNOPF_MIN_H - (t.height - 16)) / 2));
      t.setPadding(14, py, 14, py);
      t.setInteractive({ useHandCursor: true });
      neu(t);
      if (messing && UR.textKnopf) {
        var bild = UR.textKnopf(scene, t, null, ton ? { ton: ton } : null);
        if (bild) neu(bild);
      } else {
        t.setStroke('#000000', 3);
      }
      return t;
    }

    function weiter() {
      if (beendet || ausklangLaeuft) return;
      if (Date.now() < bereitAb) return;
      if (zustand.phase === 'auftritt') { springeZurRede(); return; }
      if (zustand.seite + 1 < seiten.length) zeigeSeite(zustand.seite + 1);
      else ausklang();
    }

    function ueberspringen() { if (!beendet) ausklang(); }

    var redeLaeuft = false;
    function redeBeginnen() {
      if (redeLaeuft || beendet) return;
      redeLaeuft = true;
      weiterKnopf = knopf(_t('bossintro.weiter'), b - 24, h - untenH / 2, null).setName('bossintroWeiter');
      weiterKnopf.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); weiter(); });
      tween({ targets: weiterKnopf, alpha: 0.6, duration: frist(900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (seiten.length) zeigeSeite(0);
      else { zustand.phase = 'rede'; zustand.seite = 0; bereitAb = Date.now() + frist(EINGABE_AB); }
    }
    // Wer waehrend des Auftritts weiterdrueckt, will lesen: Plakette und
    // Rede kommen sofort, die Kamerafahrt laeuft darunter zu Ende.
    function springeZurRede() {
      redeBeginnen();
      bereitAb = Date.now() + frist(EINGABE_AB);
    }
    spaeter(REDE_AB, redeBeginnen);

    // Ueberspringen sofort sichtbar: ESC wirkt ab dem ersten Bild.
    knopf(_t(mobil ? 'bossintro.ueberspringen_mobil' : 'bossintro.ueberspringen'), b - 16, obenH / 2, '#3a2a1a')
      .setName('bossintroUeberspringen')
      .on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); ueberspringen(); });

    // --- Ausklang ---------------------------------------------------------
    function ausklang() {
      if (ausklangLaeuft || beendet) return;
      ausklangLaeuft = true;
      zustand.phase = 'ausklang';
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      abmelden.length = 0;
      teile.forEach(function (o) {
        if (o === oben || o === unten) return;
        try { if (o.disableInteractive) o.disableInteractive(); } catch (e) {}
        tween({ targets: o, alpha: 0, duration: frist(AUSKLANG_MS * 0.6) });
      });
      if (kam) {
        try {
          if (typeof kam.zoomTo === 'function') kam.zoomTo(zoomVorher, frist(AUSKLANG_MS), 'Quad.easeInOut');
          if (figur && typeof kam.pan === 'function') kam.pan(figur.x, figur.y, frist(AUSKLANG_MS), 'Quad.easeInOut', true);
        } catch (e) {}
      }
      tween({ targets: oben, y: -obenH / 2, duration: frist(AUSKLANG_MS) });
      tween({ targets: unten, y: h + untenH / 2, duration: frist(AUSKLANG_MS) });
      spaeter(AUSKLANG_MS, aufraeumen);
    }

    // --- Eingabe ------------------------------------------------------------
    try {
      var ein = scene.input;
      if (ein && ein.keyboard && typeof ein.keyboard.on === 'function') {
        var beiTaste = function (ev) {
          var k = ev && (ev.key || ev.code);
          if (k === 'Escape' || (ev && ev.keyCode === 27)) { ueberspringen(); return; }
          if (ev && ev.repeat) return;
          weiter();
        };
        ein.keyboard.on('keydown', beiTaste);
        abmelden.push(function () { ein.keyboard.off('keydown', beiTaste); });
      }
      if (ein && typeof ein.on === 'function') {
        var beiZeiger = function () { weiter(); };
        ein.on('pointerdown', beiZeiger);
        abmelden.push(function () { ein.off('pointerdown', beiZeiger); });
      }
    } catch (e) {}

    zustand.teile = teile;
    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    scene.__bossZwischenszene = zustand;
    return true;
  }

  var Zwischenszene = {
    aktiv: aktiv, vorladen: vorladen, spiele: spiele,
    BOSSE: BOSSE, VFX: VFX, siegelKey: siegelKey, vfxKey: vfxKey,
    _TEMPO: 1, _NOTAUSGANG_MS: NOTAUSGANG_MS, _EINGABE_AB: EINGABE_AB, _REDE_AB: REDE_AB
  };
  if (typeof window !== 'undefined') window.BossZwischenszene = Zwischenszene;
  if (typeof module !== 'undefined' && module.exports) module.exports = Zwischenszene;
})();
