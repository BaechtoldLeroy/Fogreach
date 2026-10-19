/* =====================================================================
 * rettungsSzene.js — Elaras Rettung im Keller als Zwischensequenz (Akt 1)
 * und ihr Rueckblick in der Ratskammer (Akt 3). Story-Kern v6.1.
 * ---------------------------------------------------------------------
 * Die Rettung ist inszeniert. Beim ersten Sehen soll sie eine echte Rettung
 * sein, im Rueckblick soll man sehen, dass sie gespielt war. Drei Spuren,
 * leise, aber fuer Aufmerksame sichtbar:
 *
 *   1. Die Kettenwache weicht einen Takt zurueck, BEVOR Elara zuschlaegt,
 *      als haette jemand ein Zeichen gegeben.
 *   2. Ein Waechter mit rotem Helmbusch nickt ihr kaum merklich zu.
 *   3. Sie nennt Dich "Archivschmied", obwohl Du es ihr nie gesagt hast.
 *
 * Den Helmbusch traegt er schon im Kampf: wer ihn spaeter in der Ratskammer
 * neben Aldric und Elara stehen sieht, kennt ihn. Dort spielt der Rueckblick
 * die Rettung entsaettigt noch einmal ab und hebt die drei Spuren hervor.
 *
 * Ablauf der Zwischensequenz: Spieluhr steht, Balken fahren ein, die Wachen
 * weichen, Elara tritt aus dem Nebel, der Waechter nickt, sie schlaegt zu,
 * und erst dann spricht sie. Ueberspringen nur bewusst (ESC oder der Knopf):
 * ein Klick oder Tastendruck aus dem Kampf blaettert nichts weg. Wer
 * ueberspringt, landet bei ihrer Zeile, nicht dahinter.
 *
 * Flaggen: elara_rettung_gesehen (die Rettung war, wie bisher) und
 * rettung_inszeniert (diese Fassung mit dem Helmbusch). Alte Spielstaende
 * kennen nur die erste; ihr Rueckblick kommt ohne den Waechter aus.
 *
 * Wie bossZwischenszene.js haengt der Ablauf an setTimeout, Tweens sind
 * Zierde. Ein fehlendes Bild laesst nur dieses Stueck weg.
 * ===================================================================== */
(function () {
  'use strict';

  var DE = {
    'rettung.ueberspringen': 'Überspringen (ESC)',
    'rettung.ueberspringen_mobil': 'Überspringen',
    'rettung.weiter': 'Weiter',
    'rettung.sprecher': 'ELARA',
    'rettung.zeile': 'Steh auf, Archivschmied.',
    'rueckblick.titel': 'Erinnerung · Der Keller',
    'rueckblick.jetzt': 'Der Kettenwächter mit dem roten Helmbusch. Du kennst ihn.',
    'rueckblick.jetzt_allgemein': 'Ein Kettenwächter. Irgendwoher kennst Du ihn.',
    'rueckblick.rueckzug': 'Sie weichen zurück. Noch bevor sie zuschlägt.',
    'rueckblick.nicken': 'Er nickt ihr zu.',
    'rueckblick.name': 'Du hattest ihr nie gesagt, wer Du bist.',
    // Alte Staende sahen die Rettung ohne Zwischensequenz: dort fiel das Wort
    // erst im Gespraech danach.
    'rueckblick.zeile_alt': 'Du. Der Archivschmied.',
    'rueckblick.taste': 'Taste drücken',
    'rueckblick.ueberspringen': 'ESC: Rückblick beenden'
  };
  var EN = {
    'rettung.ueberspringen': 'Skip (ESC)',
    'rettung.ueberspringen_mobil': 'Skip',
    'rettung.weiter': 'Continue',
    'rettung.sprecher': 'ELARA',
    'rettung.zeile': 'Get up, Archivesmith.',
    'rueckblick.titel': 'Memory · The Cellar',
    'rueckblick.jetzt': 'The chain guard with the red plume. You know him.',
    'rueckblick.jetzt_allgemein': 'A chain guard. You know him from somewhere.',
    'rueckblick.rueckzug': 'They fall back. Before she even strikes.',
    'rueckblick.nicken': 'He nods to her.',
    'rueckblick.name': 'You never told her who you are.',
    'rueckblick.zeile_alt': 'You. The Archivesmith.',
    'rueckblick.taste': 'Press any key',
    'rueckblick.ueberspringen': 'ESC: end memory'
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

  // Zeitplan der Zwischensequenz (ms ab Beginn). Der Rueckzug liegt bewusst
  // vor dem Auftritt und weit vor dem Schlag: das ist die erste Spur.
  var ZEIT = { rueckzug: 450, auftritt: 1150, nicken: 1850, schlag: 2550, rede: 3250 };
  var BALKEN_MS = 350;
  var AUSKLANG_MS = 450;
  var EINGABE_AB = 300;
  var NOTAUSGANG_MS = 60000;
  var RUECKZUG_PX = 46;
  var ELARA_HOEHE = 54;
  var WACHE_HOEHE = 56;
  var KNOPF_MIN_H = 44;

  var FLAGGE = 'rettung_inszeniert';
  var ALTE_FLAGGE = 'elara_rettung_gesehen';
  var RUECKBLICK_FLAGGE = 'rueckblick_rettung_gesehen';

  // Rot fuer den Helmbusch; im entsaettigten Rueckblick zuerst grau.
  var BUSCH_ROT = [0x4a0d08, 0xa8221a, 0xd8432f];
  var BUSCH_GRAU = [0x2a2a2e, 0x6a6a70, 0x8e8e94];

  function _qs() { return (typeof window !== 'undefined') ? window.questSystem : null; }
  function _flag(n) {
    var qs = _qs();
    try { return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(n)); } catch (e) { return false; }
  }
  function _setzen(n) {
    var qs = _qs();
    try { if (qs && typeof qs.setFlag === 'function') qs.setFlag(n, true); } catch (e) {}
  }
  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _mobil(scene) {
    try { return !!(scene.sys.game.device.input.touch); } catch (e) { return false; }
  }

  // --- Der Helmbusch ----------------------------------------------------------

  /**
   * Zeichnet den Busch in Pixelbloecken, Nullpunkt = Helmspitze. Er steht
   * hoch und faellt nach hinten (blick: +1 = Waechter schaut nach rechts).
   */
  function _buschZeichnen(g, m, blick, farben) {
    var b = blick < 0 ? -1 : 1;
    var px = function (x, y, w, h, f) {
      g.fillStyle(f, 1);
      // Gespiegelt um die Helmspitze; w bleibt positiv.
      var gx = b > 0 ? x : -x - w;
      g.fillRect(gx * m, y * m, w * m, h * m);
    };
    g.clear();
    // Ein Kamm, der auf dem Helm sitzt und nach hinten faellt.
    [[-4, -8, 7, 2], [-7, -6, 11, 2], [-10, -4, 13, 2], [-12, -2, 7, 2], [-12, 0, 3, 1], [-1, -2, 4, 3]]
      .forEach(function (r) { px(r[0], r[1], r[2], r[3], farben[0]); });
    [[-3, -7, 5, 1], [-6, -6, 9, 1], [-9, -5, 11, 1], [-9, -4, 11, 1], [-11, -3, 6, 1], [-11, -2, 4, 1], [0, -2, 2, 2]]
      .forEach(function (r) { px(r[0], r[1], r[2], r[3], farben[1]); });
    [[-2, -7, 3, 1], [-5, -6, 5, 1]]
      .forEach(function (r) { px(r[0], r[1], r[2], r[3], farben[2]); });
  }

  /** Wo sitzt die Helmspitze dieses Waechters gerade (Welt)? */
  function _helmspitze(scene, s) {
    var key = s.texture && s.texture.key;
    var links = /left/.test(String(key || ''));
    var meta = (typeof window.figurGrenzen === 'function') ? window.figurGrenzen(scene, key) : null;
    var fw = s.width || 72, fh = s.height || 91;
    // Der Helm sitzt im Kettenwaechter-Bild links der Mitte (rechts, wenn er
    // nach links schaut): bei 24 von 72 Spalten.
    var hx = (links ? 48 : 24) / 72 * fw;
    var hy = meta ? meta.minY : fh * 0.15;
    var sx = s.scaleX || 1, sy = s.scaleY || 1;
    var ox = (typeof s.originX === 'number') ? s.originX : 0.5;
    var oy = (typeof s.originY === 'number') ? s.originY : 0.5;
    return {
      x: s.x + (hx - fw * ox) * sx * (s.flipX ? -1 : 1),
      // Drei Bildpunkte unter der Oberkante: der Kamm sitzt auf, nicht darueber.
      y: s.y + (hy + 3 - fh * oy) * sy,
      blick: (links !== !!s.flipX) ? -1 : 1,
      // Ein Bildpunkt des Buschs so gross wie einer des Waechters.
      m: Math.max(0.5, sy)
    };
  }

  /**
   * Gibt einem Waechter den roten Helmbusch. Er folgt ihm in postupdate
   * (aus update() hinkt eine Marke ein Bild nach) und geht mit ihm.
   */
  function markieren(scene, wache) {
    if (!scene || !wache || !scene.add || wache._helmbusch) return null;
    var g = scene.add.graphics();
    // In dieselbe Ebene wie der Waechter (die Gegnerebene mit Sichtmaske):
    // sonst laege der Busch unter dem Boden, und ausserhalb der Sicht stuende
    // er allein in der Luft.
    try {
      var ebene = wache.displayList;
      if (ebene && ebene !== scene.sys.displayList && typeof ebene.add === 'function') {
        scene.sys.displayList.remove(g);
        ebene.add(g);
      }
    } catch (e) {}
    var folgen = function () {
      if (!wache.scene || !wache.active) { aus(); return; }
      var h = _helmspitze(scene, wache);
      _buschZeichnen(g, h.m, h.blick, BUSCH_ROT);
      g.setPosition(h.x, h.y);
      g.setDepth((wache.depth || 0) + 0.05);
      g.setAlpha(wache.alpha);
      g.setVisible(wache.visible);
    };
    var aus = function () {
      try { scene.events.off('postupdate', folgen); } catch (e) {}
      _weg(g);
    };
    try { scene.events.on('postupdate', folgen); } catch (e) {}
    try { wache.once('destroy', aus); } catch (e) {}
    folgen();
    wache._helmbusch = g;
    wache._rettungsZeichen = true;
    return g;
  }

  // --- Bausteine --------------------------------------------------------------

  /** Ein Figurenbild in Hoehe `hoehe` (an der Figur gemessen, nicht am Rahmen). */
  function _figur(scene, key, x, fussY, hoehe) {
    if (!scene.textures || !scene.textures.exists(key)) return null;
    var o = scene.add.image(x, fussY, key);
    var meta = (typeof window.figurGrenzen === 'function') ? window.figurGrenzen(scene, key) : null;
    var fh = (meta && meta.boundsHeight) ? meta.boundsHeight : (o.height || hoehe);
    var m = hoehe / fh;
    o.setScale(m);
    // Fuesse auf fussY: Unterkante der Figur, nicht des Rahmens.
    var unten = meta ? (meta.maxY + 1) : o.height;
    o.setOrigin(0.5, unten / o.height);
    return o;
  }

  function _textKnopf(scene, text, x, y, ton, tiefe) {
    var t = scene.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '14px', color: '#f4efe2', align: 'center',
      padding: { x: 14, y: 8 }
    }).setOrigin(1, 0.5).setDepth(tiefe).setScrollFactor(0);
    var py = Math.max(8, Math.ceil((KNOPF_MIN_H - (t.height - 16)) / 2));
    t.setPadding(14, py, 14, py);
    t.setInteractive({ useHandCursor: true });
    var UR = window.uiRahmen;
    var bild = null;
    if (UR && UR.bereit && UR.bereit(scene) && UR.textKnopf) bild = UR.textKnopf(scene, t, null, ton ? { ton: ton } : null);
    else t.setStroke('#000000', 3);
    return { text: t, bild: bild };
  }

  // Lichtkreis: ein Weltbild mit hellem Loch, aussen fast schwarz. Als Bild
  // statt Maske, damit es im Canvas-Renderer genauso wirkt wie unter WebGL.
  var LICHT = 'rettung_licht', LICHT_PX = 512, LICHT_WELT = 2000;
  function _lichtkreis(scene, x, y) {
    if (!scene.textures || !scene.add || !scene.add.image) return null;
    try {
      if (!scene.textures.exists(LICHT)) {
        var ct = scene.textures.createCanvas(LICHT, LICHT_PX, LICHT_PX);
        if (!ct) return null;
        var ctx = ct.getContext(), m = LICHT_PX / 2, k = LICHT_PX / LICHT_WELT;
        var g = ctx.createRadialGradient(m, m, 230 * k, m, m, 400 * k);
        g.addColorStop(0, 'rgba(5,6,10,0)');
        g.addColorStop(1, 'rgba(5,6,10,0.88)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, LICHT_PX, LICHT_PX);
        ct.refresh();
        try { ct.setFilter(0); } catch (e) {}
      }
      return scene.add.image(x, y, LICHT).setDisplaySize(LICHT_WELT, LICHT_WELT).setDepth(999).setAlpha(0);
    } catch (e) { return null; }
  }

  /** Balken oben und unten, mit Messingkante zur Bildmitte. */
  function _balken(scene, b, h, obenH, untenH, tiefe) {
    var oben = scene.add.container(0, -obenH).setScrollFactor(0).setDepth(tiefe);
    var unten = scene.add.container(0, untenH).setScrollFactor(0).setDepth(tiefe);
    var go = scene.add.graphics().setScrollFactor(0);
    go.fillStyle(0x05060a, 1); go.fillRect(0, 0, b, obenH);
    go.fillStyle(0x8a6a3a, 1); go.fillRect(0, obenH - 2, b, 2);
    go.fillStyle(0x3a2c1a, 1); go.fillRect(0, obenH, b, 1);
    oben.add(go);
    var gu = scene.add.graphics().setScrollFactor(0);
    gu.fillStyle(0x05060a, 1); gu.fillRect(0, h - untenH, b, untenH);
    gu.fillStyle(0x8a6a3a, 1); gu.fillRect(0, h - untenH, b, 2);
    gu.fillStyle(0x3a2c1a, 1); gu.fillRect(0, h - untenH - 1, b, 1);
    unten.add(gu);
    return { oben: oben, unten: unten };
  }

  // --- Die Zwischensequenz im Keller -----------------------------------------

  /**
   * Spielt die Rettung als Zwischensequenz.
   *
   * @param {Phaser.Scene} scene  die GameScene im Hinterhalt-Raum
   * @param {object} o
   *   wachen     aktive Wachen des Hinterhalts
   *   platz      wo Elara hervortritt ({x,y}), oder null
   *   vertreiben function: loest die Wachen im Nebel auf (der Schlag)
   * @param {function} fertig  laeuft genau einmal, nach dem Ausklang
   * @returns {boolean} false = nicht gestartet, der Aufrufer macht es wie bisher
   */
  function spielen(scene, o, fertig) {
    if (!scene || !scene.add || !scene.tweens || !scene.scale) return false;
    if (scene.__rettungsSzene && scene.__rettungsSzene.phase !== 'fertig') return false;
    o = o || {};
    var wachen = (o.wachen || []).filter(function (w) { return w && w.active; });
    var gezeichnet = wachen.filter(function (w) { return w._rettungsZeichen; })[0] || null;
    var figur = window.player || null;
    var start = Date.now();
    var f = Rettung._TEMPO > 0 ? Rettung._TEMPO : 1;
    var frist = function (ms) { return Math.max(1, Math.round(ms * f)); };

    // Schon beim Beginn: wer ueberspringt, hat sie gesehen.
    _setzen(ALTE_FLAGGE);
    _setzen(FLAGGE);

    var b = scene.scale.width, h = scene.scale.height;
    var obenH = Math.round(h * 0.1), untenH = Math.round(h * 0.17);
    var kam = scene.cameras && scene.cameras.main;
    var teile = [], uhren = [], abmelden = [];
    var beendet = false, ausklangLaeuft = false, vertrieben = false, leisteWarAn = false;
    var choiceVorher = window.eventChoiceOpen;
    var zustand = { phase: 'auftritt', protokoll: [], gezeichnet: gezeichnet, wachen: wachen, elara: null };
    // Der Bildmittelpunkt der Szene: Spieler, Elara und der Gezeichnete.
    var fokus = null;
    if (figur) {
      var punkte = [{ x: figur.x, y: figur.y }];
      if (o.platz) punkte.push(o.platz);
      if (gezeichnet) punkte.push({ x: gezeichnet.x, y: gezeichnet.y });
      fokus = { x: 0, y: 0 };
      punkte.forEach(function (p) { fokus.x += p.x / punkte.length; fokus.y += p.y / punkte.length; });
    }

    function spaeter(ms, fn) { uhren.push(setTimeout(function () { if (!beendet) fn(); }, frist(ms))); }
    function tween(c) { try { return scene.tweens.add(c); } catch (e) { return null; } }
    function neu(x) { if (x) teile.push(x); return x; }
    function abstand() {
      if (!figur) return 0;
      var lebend = wachen.filter(function (w) { return w && w.scene; });
      if (!lebend.length) return 0;
      var s = 0;
      lebend.forEach(function (w) { s += Math.hypot(w.x - figur.x, w.y - figur.y); });
      return s / lebend.length;
    }
    function notiere(was, mehr) {
      var e = { was: was, t: Date.now() - start, abstand: Math.round(abstand()) };
      if (mehr) Object.keys(mehr).forEach(function (k) { e[k] = mehr[k]; });
      zustand.protokoll.push(e);
    }

    // --- Spiel anhalten, Oberflaeche aus -------------------------------------
    try {
      window.eventChoiceOpen = true;
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
      if (figur && figur.body && figur.body.setVelocity) figur.body.setVelocity(0, 0);
    } catch (e) {}
    try {
      if (typeof window.faehigkeitsLeisteSichtbar === 'function') leisteWarAn = window.faehigkeitsLeisteSichtbar(false) > 0;
      if (typeof window.mobileAbilityLeisteSichtbar === 'function') leisteWarAn = window.mobileAbilityLeisteSichtbar(false) > 0 || leisteWarAn;
    } catch (e) {}
    // Die Bildschirm-Oberflaeche stuende sonst auf den Balken. Gemerkt wird
    // genau, was hier ausgeblendet wurde (wie bossZwischenszene).
    var hudAus = [];
    var eigene = function (x) {
      return teile.indexOf(x) >= 0 || (x.parentContainer && teile.indexOf(x.parentContainer) >= 0);
    };
    function hudFegen() {
      try {
        scene.children.list.forEach(function (x) {
          if (x && x.visible && x.scrollFactorX === 0 && (x.depth || 0) >= 1000 && !eigene(x)) {
            x.setVisible(false);
            hudAus.push(x);
          }
        });
      } catch (e) {}
    }
    hudFegen();
    if (scene.events && typeof scene.events.on === 'function') {
      scene.events.on('update', hudFegen);
      abmelden.push(function () { scene.events.off('update', hudFegen); });
    }

    // Licht: Kriegsnebel, Spotlight und Sichtmaske stehen mit der Spieluhr
    // still und wuerden Elara am Rand des Sichtfelds ins Dunkel setzen. Fuer
    // die Dauer der Szene treten sie zurueck, ein eigener Lichtkreis um die
    // Mitte haelt den Rest dunkel (wie bossZwischenszene).
    var lichtAus = [];
    ['fogUnseen', 'spotlightDim'].forEach(function (n) {
      var x = scene[n];
      if (x && x.visible && x.setVisible) { x.setVisible(false); lichtAus.push(x); }
    });
    var ebene = scene.enemyLayer && scene.enemyLayer.mask ? scene.enemyLayer : null;
    var maskeEbene = ebene ? ebene.mask : null;
    try { if (ebene && ebene.clearMask) ebene.clearMask(); } catch (e) {}
    var masken = [];
    wachen.forEach(function (w) {
      if (w.mask && w.clearMask) { masken.push({ o: w, m: w.mask }); try { w.clearMask(); } catch (e) {} }
    });
    if (fokus) {
      var licht = neu(_lichtkreis(scene, fokus.x, fokus.y));
      if (licht) tween({ targets: licht, alpha: 1, duration: frist(BALKEN_MS) });
    }

    function aufraeumen() {
      if (beendet) return;
      beendet = true;
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      uhren.length = 0;
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      abmelden.length = 0;
      if (!vertrieben) schlagen();
      teile.forEach(_weg);
      teile.length = 0;
      hudAus.forEach(function (x) { if (x && x.scene) { try { x.setVisible(true); } catch (e) {} } });
      hudAus.length = 0;
      lichtAus.forEach(function (x) { if (x && x.scene) { try { x.setVisible(true); } catch (e) {} } });
      lichtAus.length = 0;
      try { if (maskeEbene && ebene.scene && ebene.setMask) ebene.setMask(maskeEbene); } catch (e) {}
      masken.forEach(function (k) { try { if (k.o.scene) k.o.setMask(k.m); } catch (e) {} });
      try { if (typeof window.forceFogUpdate === 'function') window.forceFogUpdate(); } catch (e) {}
      try {
        if (leisteWarAn) {
          if (typeof window.faehigkeitsLeisteSichtbar === 'function') window.faehigkeitsLeisteSichtbar(true);
          if (typeof window.mobileAbilityLeisteSichtbar === 'function') window.mobileAbilityLeisteSichtbar(true);
        }
      } catch (e) {}
      if (kam && grenzen) { try { kam.setBounds(grenzen.x, grenzen.y, grenzen.w, grenzen.h); } catch (e) {} }
      if (kam && figur) { try { kam.startFollow(figur, true, 0.12, 0.12); } catch (e) {} }
      try { window.eventChoiceOpen = choiceVorher; } catch (e) {}
      try { if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene); } catch (e) {}
      zustand.phase = 'fertig';
      notiere('ende');
      if (typeof fertig === 'function') { try { fertig(); } catch (e) {} }
    }
    uhren.push(setTimeout(aufraeumen, Rettung._NOTAUSGANG_MS));

    // --- Balken und Kamera ----------------------------------------------------
    var balken = _balken(scene, b, h, obenH, untenH, 1098);
    neu(balken.oben); neu(balken.unten);
    tween({ targets: balken.oben, y: 0, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });
    tween({ targets: balken.unten, y: 0, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });
    // Spieler, Elara und der Waechter mit dem Helmbusch gehoeren ins Bild,
    // mittig in den freien Streifen. Die Raumgrenze der Kamera hielt sie
    // sonst am Rand fest, und Elara stand unter dem unteren Balken.
    var grenzen = null;
    if (kam && figur) {
      try {
        var zx = fokus.x, zy = fokus.y;
        if (kam.useBounds && typeof kam.getBounds === 'function') {
          var r = kam.getBounds();
          grenzen = { x: r.x, y: r.y, w: r.width, h: r.height };
          kam.removeBounds();
        }
        if (typeof kam.stopFollow === 'function') kam.stopFollow();
        if (typeof kam.pan === 'function') kam.pan(zx, zy + (untenH - obenH) / 2 / (kam.zoom || 1), frist(700), 'Quad.easeInOut');
      } catch (e) {}
    }

    // Nebel quillt aus den Fugen: vom Spieler aus durch den Raum.
    try {
      if (figur) {
        var ring = neu(scene.add.circle(figur.x, figur.y, 20, 0x8866cc, 0.3).setDepth(90));
        tween({ targets: ring, scale: 30, alpha: 0, duration: frist(1400) });
      }
    } catch (e) {}

    // --- 1. Die Wachen weichen, bevor jemand zuschlaegt ---------------------
    var rueckzug = [];
    // Der Rueckzug steht, bevor jemand nickt: zwei Tweens auf y wuerden sich
    // das Nicken gegenseitig wegnehmen.
    function rueckzugFertig() {
      rueckzug.forEach(function (t) { try { if (t && t.isPlaying()) t.complete(); } catch (e) {} });
    }
    spaeter(ZEIT.rueckzug, function () {
      notiere('rueckzug_beginnt');
      wachen.forEach(function (w) {
        if (!w.scene || !figur) return;
        var a = Math.atan2(w.y - figur.y, w.x - figur.x);
        rueckzug.push(tween({ targets: w, x: w.x + Math.cos(a) * RUECKZUG_PX, y: w.y + Math.sin(a) * RUECKZUG_PX,
          duration: frist(600), ease: 'Sine.easeOut' }));
      });
      spaeter(620, function () { notiere('rueckzug'); });
    });

    // --- 2. Elara tritt aus dem Nebel -----------------------------------------
    spaeter(ZEIT.auftritt, function () {
      var p = o.platz || (figur ? { x: figur.x + 120, y: figur.y } : null);
      if (!p) return;
      var links = figur && figur.x < p.x;
      var key = links && scene.textures.exists('elara_left0') ? 'elara_left0' : 'elara_right0';
      var el = _figur(scene, key, p.x, p.y + ELARA_HOEHE / 2, ELARA_HOEHE);
      if (!el) return;
      el.setDepth((window.WELT_TIEFEN && window.WELT_TIEFEN.NPC) || 45);
      el.setAlpha(0);
      neu(el);
      zustand.elara = el;
      var dunst = neu(scene.add.ellipse(p.x, p.y + ELARA_HOEHE / 2 - 4, 70, 22, 0xa8b0bc, 0.0).setDepth(el.depth - 0.1));
      tween({ targets: dunst, fillAlpha: 0.32, duration: frist(500), yoyo: true, hold: frist(500) });
      el.y += 10;
      tween({ targets: el, alpha: 1, y: el.y - 10, duration: frist(650), ease: 'Sine.easeOut' });
      notiere('auftritt');
    });

    // --- 3. Der Waechter mit dem Helmbusch nickt ihr zu ----------------------
    spaeter(ZEIT.nicken, function () {
      var g = gezeichnet;
      if (!g || !g.scene) return;
      rueckzugFertig();
      var el = zustand.elara;
      if (el) {
        var dir = el.x < g.x ? 'left' : 'right';
        if (scene.textures.exists('chainguard_' + dir + '0') && /^chainguard_/.test(String(g.texture && g.texture.key))) {
          try { g.setTexture('chainguard_' + dir + '0'); } catch (e) {}
        }
      }
      // Kaum merklich: drei Pixel, einmal.
      tween({ targets: g, y: g.y + 3, duration: frist(150), yoyo: true, ease: 'Sine.easeInOut' });
      notiere('nicken', { wache: wachen.indexOf(g) });
    });

    // --- 4. Der Schlag --------------------------------------------------------
    function schlagen() {
      if (vertrieben) return;
      vertrieben = true;
      var el = zustand.elara;
      try {
        if (el) {
          var stoss = neu(scene.add.circle(el.x, el.y - ELARA_HOEHE / 2, 12, 0xb399ff, 0.6).setDepth(91));
          tween({ targets: stoss, scale: 14, alpha: 0, duration: frist(600) });
        }
      } catch (e) {}
      notiere('schlag');
      if (typeof o.vertreiben === 'function') { try { o.vertreiben(); } catch (e) {} }
    }
    spaeter(ZEIT.schlag, schlagen);

    // --- 5. Erst dann spricht sie ---------------------------------------------
    var mobil = _mobil(scene);
    var rede = null, sprecher = null, weiterK = null;
    var bereitAb = 0;
    function redeZeigen() {
      if (zustand.phase === 'rede' || beendet) return;
      zustand.phase = 'rede';
      sprecher = neu(scene.add.text(28, h - untenH + 14, _t('rettung.sprecher'), {
        fontFamily: 'serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd166'
      }).setScrollFactor(0).setDepth(1102));
      rede = neu(scene.add.text(28, h - untenH + 40, '', {
        fontFamily: 'monospace', fontSize: '17px', color: '#efe6d2', wordWrap: { width: b - 220 }
      }).setScrollFactor(0).setDepth(1102));
      var zeile = _t('rettung.zeile');
      var TW = window.DialogTypewriter;
      if (TW && typeof TW.anTextobjekt === 'function') {
        try { zustand.lauf = TW.anTextobjekt(scene, rede, zeile, { sprecher: 'ELARA', wanduhr: true }); } catch (e) { rede.setText(zeile); }
        abmelden.push(function () { try { if (zustand.lauf) zustand.lauf.abbrechen(); } catch (e) {} });
      } else rede.setText(zeile);
      var k = _textKnopf(scene, _t('rettung.weiter'), b - 24, h - untenH / 2, null, 1103);
      weiterK = neu(k.text); neu(k.bild);
      weiterK.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); weiter(); });
      tween({ targets: weiterK, alpha: 0.6, duration: frist(900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      bereitAb = Date.now() + frist(EINGABE_AB);
      notiere('rede', { text: zeile });
    }
    spaeter(ZEIT.rede, redeZeigen);

    // Weiter wirkt nur auf der Rede. Waehrend des Auftritts blaettert keine
    // Taste und kein Klick etwas weg: Ueberspringen ist eine eigene Geste.
    function weiter() {
      if (beendet || ausklangLaeuft || zustand.phase !== 'rede') return;
      if (Date.now() < bereitAb) return;
      if (rede && rede.text !== _t('rettung.zeile')) {
        // Erst die Zeile ganz zeigen, dann weiter.
        try { if (zustand.lauf) zustand.lauf.ueberspringen(); } catch (e) {}
        rede.setText(_t('rettung.zeile'));
        bereitAb = Date.now() + frist(EINGABE_AB);
        return;
      }
      ausklang();
    }

    // Ueberspringen springt zu ihrer Zeile, nicht dahinter: die Zeile ist
    // eine der drei Spuren und soll niemandem verloren gehen.
    function ueberspringen() {
      if (beendet || ausklangLaeuft) return;
      if (zustand.phase === 'rede') { ausklang(); return; }
      notiere('uebersprungen');
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      uhren.length = 0;
      uhren.push(setTimeout(aufraeumen, Rettung._NOTAUSGANG_MS));
      if (!zustand.elara && o.platz) {
        var el = _figur(scene, 'elara_right0', o.platz.x, o.platz.y + ELARA_HOEHE / 2, ELARA_HOEHE);
        if (el) { el.setDepth((window.WELT_TIEFEN && window.WELT_TIEFEN.NPC) || 45); neu(el); zustand.elara = el; }
      }
      if (zustand.elara) zustand.elara.setAlpha(1);
      schlagen();
      redeZeigen();
    }

    var skip = _textKnopf(scene, _t(mobil ? 'rettung.ueberspringen_mobil' : 'rettung.ueberspringen'), b - 16, obenH / 2, '#3a2a1a', 1103);
    neu(skip.text); neu(skip.bild);
    skip.text.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); ueberspringen(); });

    function ausklang() {
      if (ausklangLaeuft || beendet) return;
      ausklangLaeuft = true;
      zustand.phase = 'ausklang';
      teile.forEach(function (x) {
        if (x === balken.oben || x === balken.unten) return;
        try { if (x.disableInteractive) x.disableInteractive(); } catch (e) {}
        tween({ targets: x, alpha: 0, duration: frist(AUSKLANG_MS * 0.6) });
      });
      tween({ targets: balken.oben, y: -obenH, duration: frist(AUSKLANG_MS) });
      tween({ targets: balken.unten, y: untenH, duration: frist(AUSKLANG_MS) });
      if (kam && figur && typeof kam.pan === 'function') {
        try { kam.pan(figur.x, figur.y, frist(AUSKLANG_MS), 'Quad.easeInOut', true); } catch (e) {}
      }
      spaeter(AUSKLANG_MS, aufraeumen);
    }

    // --- Eingabe --------------------------------------------------------------
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
    scene.__rettungsSzene = zustand;
    notiere('beginn');
    return true;
  }

  // --- Der Rueckblick in der Ratskammer --------------------------------------

  /**
   * Welche Fassung des Rueckblicks passt zu diesem Spielstand?
   *   'voll'      die Zwischensequenz mit dem Helmbusch wurde gesehen
   *   'allgemein' ein alter Stand: die Rettung war, aber ohne Helmbusch
   *   null        keine Rettung im Spielstand: kein Rueckblick
   */
  function rueckblickArt() {
    if (_flag(FLAGGE)) return 'voll';
    if (_flag(ALTE_FLAGGE) || _flag('elaraMet')) return 'allgemein';
    return null;
  }

  /** Laedt die Kettenwache nach, falls die Szene (der Hub) sie nicht hat. */
  function laden(scene, fertig) {
    var tex = scene && scene.textures, ld = scene && scene.load;
    var einmal = function () { if (fertig) { var f = fertig; fertig = null; f(); } };
    if (!tex || !ld) { einmal(); return; }
    var fehlt = 0;
    ['right0', 'left0'].forEach(function (r) {
      var k = 'chainguard_' + r;
      if (tex.exists(k)) return;
      ld.image(k, 'assets/enemy/chainguard/' + r + '.png');
      fehlt++;
    });
    if (!fehlt) { einmal(); return; }
    ld.once('complete', einmal);
    ld.start();
  }

  /** Entsaettigt ein Bild: unter WebGL echt, sonst ein kuehles Grau. */
  function _grau(o) {
    if (!o) return;
    try {
      if (o.preFX && typeof o.preFX.addColorMatrix === 'function') {
        var cm = o.preFX.addColorMatrix();
        cm.grayscale(1);
        o.setTint(0xb8b8bc);
        return;
      }
    } catch (e) {}
    try { o.setTint(0x8a8a92); } catch (e) {}
  }

  /**
   * Spielt den Rueckblick: erst die Gegenwart (der Waechter neben Aldric und
   * Elara), dann die Rettung entsaettigt noch einmal, mit den Spuren
   * hervorgehoben. Weiter per Taste/Klick, ESC beendet.
   *
   * @param {string} art 'voll' oder 'allgemein'
   * @returns {boolean} ob er laeuft
   */
  function rueckblick(scene, art, fertig) {
    var einmal = function () { if (typeof fertig === 'function') { var f = fertig; fertig = null; f(); } };
    if (!scene || !scene.add || !scene.cameras || !scene.cameras.main || (art !== 'voll' && art !== 'allgemein')) {
      einmal();
      return false;
    }
    var voll = art === 'voll';
    var cam = scene.cameras.main;
    var b = cam.width, h = cam.height;
    var T = 2400;
    var f = Rettung._TEMPO > 0 ? Rettung._TEMPO : 1;
    var frist = function (ms) { return Math.max(1, Math.round(ms * f)); };
    var teile = [], uhren = [], abmelden = [];
    var beendet = false;
    var zustand = { art: art, phase: 'laden', protokoll: [], teile: teile };
    scene.__rueckblick = zustand;
    _setzen(RUECKBLICK_FLAGGE);

    function spaeter(ms, fn) { uhren.push(setTimeout(function () { if (!beendet) fn(); }, frist(ms))); }
    function tween(c) { try { return scene.tweens.add(c); } catch (e) { return null; } }
    function neu(x) { if (x) { if (x.setScrollFactor) x.setScrollFactor(0); teile.push(x); } return x; }

    function ende() {
      if (beendet) return;
      beendet = true;
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      teile.forEach(function (x) { try { scene.tweens.killTweensOf(x); } catch (e) {} _weg(x); });
      teile.length = 0;
      zustand.phase = 'fertig';
      einmal();
    }
    uhren.push(setTimeout(ende, Rettung._NOTAUSGANG_RUECKBLICK_MS));

    // Warten auf die naechste Geste; ESC beendet den ganzen Rueckblick.
    var wartet = null, bereitAb = 0, hinweis = null;
    function warte(weiterFn) {
      wartet = weiterFn;
      bereitAb = Date.now() + frist(EINGABE_AB);
      if (hinweis) { hinweis.setVisible(true); }
    }
    function weiter() {
      if (beendet || !wartet || Date.now() < bereitAb) return;
      var w = wartet; wartet = null;
      if (hinweis) hinweis.setVisible(false);
      w();
    }
    try {
      var ein = scene.input;
      if (ein && ein.keyboard && typeof ein.keyboard.on === 'function') {
        var beiTaste = function (ev) {
          var k = ev && (ev.key || ev.code);
          if (k === 'Escape' || (ev && ev.keyCode === 27)) { ende(); return; }
          if (ev && ev.repeat) return;
          weiter();
        };
        ein.keyboard.on('keydown', beiTaste);
        abmelden.push(function () { ein.keyboard.off('keydown', beiTaste); });
      }
      if (ein && typeof ein.on === 'function') {
        ein.on('pointerdown', weiter);
        abmelden.push(function () { ein.off('pointerdown', weiter); });
      }
    } catch (e) {}
    zustand.weiter = weiter;
    zustand.wartet = function () { return !!wartet && Date.now() >= bereitAb; };
    zustand.ueberspringen = ende;

    // Grund, Balken, Unterzeile.
    neu(scene.add.rectangle(b / 2, h / 2, b, h, 0x050407, 1).setDepth(T));
    var obenH = Math.round(h * 0.1), untenH = Math.round(h * 0.17);
    var unterzeile = neu(scene.add.text(b / 2, h - untenH / 2, '', {
      fontFamily: 'serif', fontSize: '18px', fontStyle: 'italic', color: '#efe6d2', align: 'center',
      wordWrap: { width: b - 200 }
    }).setOrigin(0.5).setDepth(T + 22));
    function sage(text, farbe) {
      unterzeile.setText(text || '');
      unterzeile.setColor(farbe || '#efe6d2');
      unterzeile.setAlpha(0);
      tween({ targets: unterzeile, alpha: 1, duration: frist(350) });
      zustand.protokoll.push({ was: 'zeile', phase: zustand.phase, text: text });
    }

    function aufbauen() {
      zustand.phase = 'jetzt';
      var balken = _balken(scene, b, h, obenH, untenH, T + 20);
      balken.oben.y = 0; balken.unten.y = 0;
      neu(balken.oben); neu(balken.unten);
      hinweis = neu(scene.add.text(b - 20, h - 12, _t('rueckblick.taste'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#8a8478'
      }).setOrigin(1, 1).setDepth(T + 22).setVisible(false));
      neu(scene.add.text(20, h - 12, _t('rueckblick.ueberspringen'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#6a645a'
      }).setOrigin(0, 1).setDepth(T + 22));
      tween({ targets: hinweis, alpha: 0.4, duration: frist(900), yoyo: true, repeat: -1 });

      // --- Die Gegenwart: der Waechter neben den beiden --------------------
      var fuss = Math.round(h * 0.66);
      var jetzt = [];
      var licht = neu(scene.add.ellipse(b / 2 + 150, fuss - 42, 170, 210, 0xffd08a, 0.08).setDepth(T + 1));
      jetzt.push(licht);
      var al = neu(_figur(scene, 'aldric_right0', b / 2 - 190, fuss, 58 * 1.5));
      var el = neu(_figur(scene, 'elara_right0', b / 2 - 80, fuss, ELARA_HOEHE * 1.5));
      [al, el].forEach(function (x) { if (x) { x.setDepth(T + 2).setTint(0x3a3646); jetzt.push(x); } });
      var wj = neu(_figur(scene, 'chainguard_left0', b / 2 + 150, fuss, WACHE_HOEHE * 1.5));
      if (wj) {
        wj.setDepth(T + 3);
        jetzt.push(wj);
        if (voll) {
          var bj = neu(scene.add.graphics().setDepth(T + 4));
          var hj = _helmspitze(scene, wj);
          _buschZeichnen(bj, hj.m, hj.blick, BUSCH_ROT);
          bj.setPosition(hj.x, hj.y);
          jetzt.push(bj);
          zustand.buschJetzt = bj;
        }
      }
      sage(_t(voll ? 'rueckblick.jetzt' : 'rueckblick.jetzt_allgemein'));
      warte(vergangenheit);

      // --- Die Vergangenheit, entsaettigt ---------------------------------------
      function vergangenheit() {
        // Ein heller Riss, dann grau.
        var blitz = neu(scene.add.rectangle(b / 2, h / 2, b, h, 0xf4efe2, 0.7).setDepth(T + 19));
        tween({ targets: blitz, alpha: 0, duration: frist(450) });
        jetzt.forEach(_weg);
        zustand.phase = 'rueckzug';
        neu(scene.add.text(24, obenH / 2, _t('rueckblick.titel'), {
          fontFamily: 'serif', fontSize: '17px', fontStyle: 'italic', color: '#d9b867'
        }).setOrigin(0, 0.5).setDepth(T + 22));
        unterzeile.setText('');

        // Die Buehne als Container: so laesst sie sich auf den Waechter zoomen.
        var mitte = { x: b / 2, y: obenH + (h - obenH - untenH) / 2 };
        var box = neu(scene.add.container(mitte.x, mitte.y).setDepth(T + 5));
        var feldH = h - obenH - untenH;
        var boden = scene.add.graphics();
        var k = 40;
        for (var gy = -Math.ceil(feldH / 2 / k) - 1; gy <= Math.ceil(feldH / 2 / k); gy++) {
          for (var gx = -Math.ceil(b / 2 / k) - 1; gx <= Math.ceil(b / 2 / k); gx++) {
            var hell = ((gx + gy) & 1) ? 0x2e2d31 : 0x353439;
            boden.fillStyle(hell, 1);
            boden.fillRect(gx * k + ((gy & 1) ? k / 2 : 0), gy * k, k - 2, k - 2);
          }
        }
        // Rand ins Dunkel.
        for (var s = 0; s < 6; s++) {
          boden.lineStyle(26, 0x050407, 0.18 + s * 0.12);
          boden.strokeEllipse(0, 0, b * (1.25 - s * 0.06), feldH * (1.5 - s * 0.07));
        }
        box.add(boden);
        var r = Math.min(150, feldH * 0.4);
        // Der Spieler in seiner Ruhepose nach Sueden, wie im Keller.
        var spieler = window.player || scene.player || null;
        var sp = _figur(scene, 'dir06_f00', 0, r * 0.15 + 27, 54);
        if (sp) {
          box.add(sp);
        } else if (spieler && spieler.texture && scene.textures.exists(spieler.texture.key)) {
          sp = scene.add.image(0, r * 0.15, spieler.texture.key, spieler.frame ? spieler.frame.name : undefined);
          var spm = (typeof window.figurGrenzen === 'function') ? window.figurGrenzen(scene, spieler.texture.key) : null;
          var sph = (spm && spm.boundsHeight) ? spm.boundsHeight : (sp.height || 54);
          // Spritesheets messen nur das ganze Blatt: dann am Rahmen.
          if (spieler.frame && spieler.frame.name !== '__BASE') sph = sp.height || 54;
          sp.setScale(54 / sph);
          box.add(sp);
        } else {
          sp = scene.add.ellipse(0, r * 0.15, 22, 44, 0x7a7a80, 1);
          box.add(sp);
        }
        _grau(sp);

        var winkel = [-2.35, -0.55, 0.85, 2.45];
        var wachen = [];
        winkel.forEach(function (w, i) {
          var x = Math.cos(w) * r * 1.35, y = Math.sin(w) * r * 0.75 + r * 0.15;
          var key = x < 0 ? 'chainguard_right0' : 'chainguard_left0';
          var g = _figur(scene, key, x, y + WACHE_HOEHE / 2, WACHE_HOEHE);
          if (!g) g = scene.add.ellipse(x, y, 30, 52, 0x55555c, 1);
          _grau(g);
          box.add(g);
          wachen.push(g);
        });
        // Der Gezeichnete steht oben rechts; Elara tritt neben ihm hervor.
        var gz = wachen[1];
        var busch = null;
        if (voll && gz && gz.texture) {
          busch = scene.add.graphics();
          var hb = _helmspitze(scene, gz);
          _buschZeichnen(busch, hb.m, hb.blick, BUSCH_GRAU);
          busch.setPosition(hb.x, hb.y);
          box.add(busch);
        }
        zustand.gezeichnet = gz;
        zustand.busch = busch;
        zustand.wachen = wachen;

        // 1. Sie weichen, bevor sie da ist.
        spaeter(700, function () {
          wachen.forEach(function (g) {
            var a = Math.atan2(g.y - sp.y, g.x - sp.x);
            tween({ targets: g, x: g.x + Math.cos(a) * 36, y: g.y + Math.sin(a) * 36, duration: frist(700), ease: 'Sine.easeOut' });
          });
          if (busch) {
            var a1 = Math.atan2(gz.y - sp.y, gz.x - sp.x);
            tween({ targets: busch, x: busch.x + Math.cos(a1) * 36, y: busch.y + Math.sin(a1) * 36, duration: frist(700), ease: 'Sine.easeOut' });
          }
          spaeter(800, function () {
            // Messingringe um jeden, der zurueckwich.
            wachen.forEach(function (g) {
              var ring = scene.add.ellipse(g.x, g.y - WACHE_HOEHE / 2, 64, 78);
              ring.setStrokeStyle(2, 0xd9b867, 0.9);
              ring.isFilled = false;
              box.add(ring);
              tween({ targets: ring, scale: 1.12, alpha: 0.4, duration: frist(600), yoyo: true, repeat: -1 });
            });
            sage(_t('rueckblick.rueckzug'), '#ffd98a');
            zustand.protokoll.push({ was: 'hervorgehoben', phase: 'rueckzug', ringe: wachen.length });
            warte(auftritt);
          });
        });

        // 2. Elara, und das Nicken.
        var elb = null;
        function auftritt() {
          box.list.filter(function (x) { return x.type === 'Ellipse' && !x.isFilled; }).forEach(function (x) {
            try { scene.tweens.killTweensOf(x); } catch (e) {} x.destroy();
          });
          var ex = gz.x + 70, ey = gz.y + 18;
          elb = _figur(scene, 'elara_left0', ex, ey + ELARA_HOEHE / 2, ELARA_HOEHE) || _figur(scene, 'elara_right0', ex, ey + ELARA_HOEHE / 2, ELARA_HOEHE);
          if (elb) { _grau(elb); elb.setAlpha(0); box.add(elb); tween({ targets: elb, alpha: 1, duration: frist(500) }); }
          sage('');
          if (!voll) { spaeter(700, schlag); return; }
          zustand.phase = 'nicken';
          spaeter(650, function () {
            // Heran an den Waechter.
            tween({ targets: box, scale: 1.8, x: mitte.x - gz.x * 1.8, y: mitte.y - (gz.y - WACHE_HOEHE / 2) * 1.8,
              duration: frist(650), ease: 'Sine.easeInOut' });
            spaeter(700, function () {
              // Er wendet sich ihr zu; der Busch sitzt danach anders und wird rot.
              try { if (gz.texture && scene.textures.exists('chainguard_right0')) gz.setTexture('chainguard_right0'); } catch (e) {}
              if (busch) {
                var hn = _helmspitze(scene, gz);
                _buschZeichnen(busch, hn.m, hn.blick, BUSCH_ROT);
                busch.setPosition(hn.x, hn.y);
              }
              tween({ targets: busch ? [gz, busch] : [gz], y: '+=3', duration: frist(200), yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
              var kreis = scene.add.ellipse(gz.x, gz.y - WACHE_HOEHE / 2, 70, 84);
              kreis.setStrokeStyle(2, 0xd9b867, 0.95);
              kreis.isFilled = false;
              box.add(kreis);
              sage(_t('rueckblick.nicken'), '#ffd98a');
              zustand.protokoll.push({ was: 'hervorgehoben', phase: 'nicken', rot: !!busch });
              warte(function () {
                _weg(kreis);
                tween({ targets: box, scale: 1, x: mitte.x, y: mitte.y, duration: frist(450), ease: 'Sine.easeInOut' });
                spaeter(500, schlag);
              });
            });
          });
        }

        // 3. Der Schlag und ihre Zeile.
        function schlag() {
          zustand.phase = 'name';
          if (elb) {
            var st = scene.add.circle(elb.x, elb.y - ELARA_HOEHE / 2, 10, 0xb0a8c8, 0.6);
            box.add(st);
            tween({ targets: st, scale: 12, alpha: 0, duration: frist(600) });
          }
          wachen.concat(busch ? [busch] : []).forEach(function (g) { tween({ targets: g, alpha: 0, duration: frist(450) }); });
          spaeter(650, function () {
            // Ihre Zeile, das Wort hervorgehoben.
            var zeile = _t(voll ? 'rettung.zeile' : 'rueckblick.zeile_alt');
            var wort = zeile.match(/Archiv\w+/);
            var tz = neu(scene.add.text(b / 2, obenH + 26, 'ELARA: ' + zeile, {
              fontFamily: 'monospace', fontSize: '18px', color: '#c8c4bc'
            }).setOrigin(0.5, 0).setDepth(T + 21));
            if (wort) {
              // Das Wort in Messing ueber die graue Zeile legen.
              var vor = 'ELARA: ' + zeile.slice(0, zeile.indexOf(wort[0]));
              var mess = scene.add.text(0, 0, vor, { fontFamily: 'monospace', fontSize: '18px' });
              var x0 = tz.x - tz.width / 2 + mess.width;
              mess.destroy();
              var hw = neu(scene.add.text(x0, tz.y, wort[0], {
                fontFamily: 'monospace', fontSize: '18px', color: '#ffd166'
              }).setOrigin(0, 0).setDepth(T + 22));
              var strich = neu(scene.add.rectangle(x0 + hw.width / 2, tz.y + hw.height + 1, hw.width, 2, 0xd9b867, 1).setDepth(T + 22));
              tween({ targets: [hw, strich], alpha: 0.55, duration: frist(700), yoyo: true, repeat: -1 });
            }
            zustand.protokoll.push({ was: 'hervorgehoben', phase: 'name', text: zeile });
            spaeter(500, function () {
              sage(_t('rueckblick.name'), '#ffd98a');
              warte(function () {
                teile.forEach(function (x) { tween({ targets: x, alpha: 0, duration: frist(400) }); });
                spaeter(420, ende);
              });
            });
          });
        }
      }
    }

    laden(scene, function () { if (!beendet) aufbauen(); });
    return true;
  }

  /**
   * Debug-Vorschau im Hub: ?rueckblick=voll (bzw. allgemein, keiner) spielt
   * die Maulwurf-Szene mit dem Rueckblick gleich nach dem Betreten. Setzt
   * dafuer die Rettungs-Flaggen passend. Einmal pro Seitenaufruf.
   */
  var _vorschauGespielt = false;
  function vorschau(scene) {
    var G = window.DebugGate;
    var art = (G && typeof G.flagge === 'function') ? G.flagge('rueckblick') : null;
    var S = window.storyScenes;
    if (_vorschauGespielt || !art || !S || typeof S.playMaulwurfEnthuellung !== 'function') return false;
    art = String(art).toLowerCase();
    if (art === '1' || art === 'true') art = 'voll';
    _vorschauGespielt = true;
    var qs = _qs();
    if (qs && typeof qs.setFlag === 'function') {
      qs.setFlag(FLAGGE, art === 'voll');
      qs.setFlag(ALTE_FLAGGE, art !== 'keiner');
      qs.setFlag('elaraMet', art !== 'keiner');
    }
    // Die Begruessungstafel eines frischen Spiels laege sonst ueber der Szene.
    try { (window.SlotStorage || window.localStorage).setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    // Die Prolog-Karte eines frischen Spiels erst wegklicken lassen: ihr ESC
    // wuerde sonst die Szene darunter weiterblaettern.
    var los = function () {
      var karte = scene.children && typeof scene.children.getByName === 'function' && scene.children.getByName('aktwechsel');
      if (karte && karte.active && scene.time) { scene.time.delayedCall(400, los); return; }
      S.playMaulwurfEnthuellung(scene, function () {});
    };
    if (scene.time && typeof scene.time.delayedCall === 'function') scene.time.delayedCall(600, los);
    else los();
    return true;
  }

  var Rettung = {
    vorschau: vorschau,
    spielen: spielen, markieren: markieren, rueckblick: rueckblick, rueckblickArt: rueckblickArt, laden: laden,
    ZEIT: ZEIT, FLAGGE: FLAGGE, ALTE_FLAGGE: ALTE_FLAGGE, RUECKBLICK_FLAGGE: RUECKBLICK_FLAGGE,
    RUECKZUG_PX: RUECKZUG_PX,
    _TEMPO: 1, _NOTAUSGANG_MS: NOTAUSGANG_MS, _NOTAUSGANG_RUECKBLICK_MS: 300000, _helmspitze: _helmspitze
  };
  if (typeof window !== 'undefined') window.RettungsSzene = Rettung;
})();
