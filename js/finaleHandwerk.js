// js/finaleHandwerk.js — die Esse als Handwerk (Story-Kern v6.1, Stufe 3).
//
// Zweimal steht der Archivschmied im Finale mit dem Hammer an der Esse:
//
//   1. Der erhobene Hammer (richtung 'erneuern'): Elara hat ihm gezeigt, wie
//      man die Bindung "loest". Er haelt die Aktion, der Hammer steigt, die
//      Glut antwortet, der Daemon zieht. Auf ERKENNEN_BEI kippt es: der
//      Schirm pulst, der Ton reisst ab, die Pfeile der Bindung zeigen rot in
//      die Glut hinein. Das ist kein Loesen, das ist das Erneuern. Er muss
//      loslassen; erst dann geht es weiter.
//   2. Der letzte Schlag (richtung 'loesen'): dieselbe Bewegung, die Pfeile
//      zeigen hinaus. Bis zum Ende gehalten, zerbricht die Esse (zerbrechen).
//
// Halten heisst: Taste E (beide Steuerungen) oder der Aktionsknopf auf dem
// Handy (mobileControls setzt __MOBILE_INTERACT_HELD__, solange er liegt).
// Ein kurzer Druck reicht nicht: ohne Halten faellt der Fortschritt zurueck.
// Offene Dialoge halten alles an (die Spieluhr steht dann ohnehin).
(function () {
  'use strict';

  var REICHWEITE = 95;        // px um die Esse, in denen man ansetzen kann
  var DAUER_MS = 2600;        // so lange haelt man bis zum vollen Schlag
  var ERKENNEN_BEI = 0.62;    // hier trifft Dich die Erkenntnis (erneuern)
  var ABFALL_JE_S = 0.7;      // so viel faellt ohne Halten je Sekunde zurueck
  var LOSLASSEN_AB_MS = 450;  // so lange steht der Moment, bevor Loslassen zaehlt
  var TIEFE = 32;             // ueber der Glut der Arena (31), unter den Figuren

  function _en() {
    try { return !!(window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en'); } catch (e) { return false; }
  }
  function _t(de, en) { return _en() ? en : de; }
  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _spieler() { return (typeof player !== 'undefined' && player) ? player : window.player; }
  function _mobil(scene) {
    // Dasselbe Merkmal wie main.js (isMobile): Beruehrung, nicht das Betriebssystem.
    try { return !!(scene.sys.game.device && scene.sys.game.device.input.touch); } catch (e) { return false; }
  }
  function _pausiert() {
    var p = window.__GAME_PAUSE;
    return !!(window.eventChoiceOpen || (p && p.since != null));
  }

  /** Wo steht die Esse? Die Glut der Arena (DieQuelle), sonst ein freier Fleck nahe dem Spieler. */
  function ort(scene) {
    var g = scene && scene._quelleGlow;
    if (g && g.active) return { x: g.x, y: g.y };
    // Die Glut ist erloschen, das Bild der zerbrochenen Esse steht noch.
    var bild = scene && scene._esseBild;
    if (bild && bild.active) return { x: bild.x, y: bild.y - ESSE_SOCKEL };
    if (scene && scene.__esseOrt) return scene.__esseOrt;
    var p = _spieler() || { x: 400, y: 300 };
    var b = scene && scene.physics && scene.physics.world && scene.physics.world.bounds;
    var versuche = [[0, -170], [170, 0], [-170, 0], [0, 170], [120, -120], [-120, -120]];
    var wahl = null;
    for (var i = 0; i < versuche.length && !wahl; i++) {
      var x = p.x + versuche[i][0], y = p.y + versuche[i][1];
      if (b) { x = Math.max(b.x + 100, Math.min(b.x + b.width - 100, x)); y = Math.max(b.y + 100, Math.min(b.y + b.height - 100, y)); }
      if (!scene.isPointAccessible || scene.isPointAccessible(x, y)) wahl = { x: x, y: y };
    }
    scene.__esseOrt = wahl || { x: p.x, y: p.y - 170 };
    return scene.__esseOrt;
  }

  /** Ein Hammer als Textur, einmal gezeichnet (Stiel, Kopf, Messingband). */
  function hammerTextur(scene) {
    var key = 'finale_hammer';
    if (!scene.textures || scene.textures.exists(key)) return key;
    var g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x5a3a22, 1); g.fillRect(9, 10, 5, 30);
    g.fillStyle(0xc9a24a, 1); g.fillRect(8, 10, 7, 3);
    g.fillStyle(0x6f7680, 1); g.fillRect(0, 0, 24, 11);
    g.fillStyle(0xa7aeb8, 1); g.fillRect(1, 1, 22, 3);
    g.generateTexture(key, 24, 40);
    g.destroy();
    return key;
  }

  /**
   * Die Bindung um die Esse: drei ineinandergreifende Ketten (das Zeichen)
   * und sechs Pfeile, die zeigen, wohin die Bindung arbeitet.
   * nachInnen: in die Glut hinein (erneuern), sonst hinaus (loesen).
   */
  function _zeichneBindung(g, r, farbe, alpha, nachInnen, dreh) {
    g.clear();
    g.lineStyle(3, farbe, alpha);
    for (var k = 0; k < 3; k++) {
      var w = dreh + k * (Math.PI * 2 / 3);
      g.strokeCircle(Math.cos(w) * r * 0.32, Math.sin(w) * r * 0.32, r * 0.55);
    }
    g.fillStyle(farbe, alpha);
    for (var i = 0; i < 6; i++) {
      var a = dreh * 0.5 + i * Math.PI / 3;
      var innen = r * 1.05, aussen = r * 1.35;
      var spitze = nachInnen ? innen : aussen;
      var fuss = nachInnen ? aussen : innen;
      var sx = Math.cos(a) * spitze, sy = Math.sin(a) * spitze;
      var q = a + Math.PI / 2, br = 7;
      var fx = Math.cos(a) * fuss, fy = Math.sin(a) * fuss;
      g.fillTriangle(sx, sy, fx + Math.cos(q) * br, fy + Math.sin(q) * br, fx - Math.cos(q) * br, fy - Math.sin(q) * br);
    }
  }

  // Der Ton reisst ab: Master-Lautstaerke kurz auf null, ohne die gespeicherte
  // Einstellung zu beruehren (stumm bleibt stumm).
  function tonSchnitt(ms) {
    var sm = window.soundManager;
    if (!sm) return false;
    try { if (typeof sm.stopMusic === 'function') sm.stopMusic(); } catch (e) {}
    var gain = sm._masterGain && sm._masterGain.gain;
    if (!gain || sm.muted) return false;
    gain.value = 0;
    setTimeout(function () {
      try { if (!sm.muted && sm._masterGain) sm._masterGain.gain.value = sm.masterVolume; } catch (e) {}
    }, ms || 1600);
    return true;
  }

  /** Haelt der Spieler gerade die Aktion? */
  function haeltGedrueckt(scene, h) {
    if (h && h._testHalten) return true;
    if (window.__MOBILE_INTERACT_HELD__) return true;
    try {
      var k = scene.input && scene.input.keyboard && scene.input.keyboard.addKey('E', false);
      return !!(k && k.isDown);
    } catch (e) { return false; }
  }

  /**
   * Die Halte-Aktion an der Esse.
   * cfg: richtung 'erneuern'|'loesen', beiErkenntnis(), beiLoslassen(), beiFertig(), hinweis
   * Rueckgabe: das Handle (auch fuer Tests): phase, fortschritt, abbrechen().
   */
  function halten(scene, cfg) {
    cfg = cfg || {};
    var erneuern = cfg.richtung !== 'loesen';
    var e = ort(scene);
    var h = { richtung: erneuern ? 'erneuern' : 'loesen', phase: 'hingehen', fortschritt: 0,
      x: e.x, y: e.y, erkanntUm: 0, _testHalten: false };
    var dreh = 0;

    var bindung = scene.add.graphics().setDepth(TIEFE).setPosition(e.x, e.y).setName('esseBindung');
    var glut = scene.add.graphics().setDepth(TIEFE - 1).setPosition(e.x, e.y).setName('esseGlut');
    glut.fillStyle(0xff8a3a, 0.35); glut.fillCircle(0, 0, 60);
    glut.fillStyle(0xffd28a, 0.45); glut.fillCircle(0, 0, 28);
    glut.setAlpha(0.35);
    var zug = scene.add.graphics().setDepth(TIEFE + 1).setName('esseZug');
    // Ueber dem Spieler (Tiefe 100), gross genug, um ihn steigen zu sehen.
    var hammer = scene.add.image(0, 0, hammerTextur(scene)).setOrigin(0.5, 0.92).setDepth(101).setScale(1.5)
      .setVisible(false).setName('esseHammer');
    var prompt = scene.add.text(e.x, e.y - 96, '', {
      fontSize: '14px', fill: '#ffdd44', fontFamily: 'monospace', stroke: '#000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5).setDepth(500).setName('esseHinweis');
    var balken = scene.add.graphics().setDepth(500).setName('esseBalken');
    var satz = null;

    function promptText() {
      if (h.phase === 'erkannt') return _mobil(scene) ? _t('Lass den Knopf los', 'Let go of the button') : _t('Lass los', 'Let go');
      var was = erneuern ? _t('Hammer ansetzen', 'Raise the hammer') : _t('Die Bindung lösen', 'Loosen the binding');
      return _mobil(scene) ? _t('[E] Aktion halten: ', '[E] Hold action: ') + was : _t('[E] halten: ', '[E] hold: ') + was;
    }

    // Das E an der Esse gehoert ihr: sonst feuert derselbe Druck die
    // Faehigkeit auf Slot 3 (main.js prueft diese Marke wie bei Ereignisobjekten).
    var beiE = function () {
      var p = _spieler();
      if (!p || h.phase === 'fertig' || h.phase === 'losgelassen') return;
      if (Math.hypot(p.x - e.x, p.y - e.y) > REICHWEITE) return;
      try { window.__eventConsumedEAt = Date.now(); window.__eventConsumedE = true; } catch (x) {}
    };
    if (scene.input && scene.input.keyboard) scene.input.keyboard.on('keydown-E', beiE);

    function zeichnen(ms) {
      dreh += (erneuern ? 1 : -1) * ms * 0.0006 * (1 + h.fortschritt * 3);
      var rot = h.phase === 'erkannt';
      var farbe = rot ? 0xff4a3a : (erneuern ? 0xd9b867 : 0xfff2c4);
      var alpha = rot ? 1 : (0.35 + h.fortschritt * 0.6);
      _zeichneBindung(bindung, 70, farbe, alpha, erneuern, dreh);
      glut.setAlpha(0.35 + h.fortschritt * 0.65);
      glut.setScale(1 + h.fortschritt * 0.8);
      var p = _spieler();
      zug.clear();
      balken.clear();
      if (p && h.fortschritt > 0.02 && h.phase !== 'losgelassen') {
        // Der Zug des Daemons: Fahnen aus Rauch vom Spieler in die Glut.
        var n = 3 + Math.round(h.fortschritt * 5);
        zug.lineStyle(2, rot ? 0xff6a5a : 0x9a7cd8, 0.25 + h.fortschritt * 0.5);
        for (var i = 0; i < n; i++) {
          var f = ((scene.time.now / 600) + i / n) % 1;
          var sx = p.x + (e.x - p.x) * f, sy = p.y + (e.y - p.y) * f + Math.sin(f * 9 + i) * 10;
          zug.lineBetween(sx, sy, sx + (e.x - p.x) * 0.08, sy + (e.y - p.y) * 0.08);
        }
        // Fortschritt ueber dem Kopf; die Marke zeigt, wo die Erkenntnis liegt.
        var bx = p.x - 30, by = p.y - 52;
        balken.fillStyle(0x000000, 0.7); balken.fillRect(bx - 1, by - 1, 62, 7);
        balken.fillStyle(rot ? 0xff4a3a : 0xffb347, 1); balken.fillRect(bx, by, 60 * h.fortschritt, 5);
      }
      if (p && (h.phase === 'heben' || h.phase === 'erkannt' || h.fortschritt > 0.02)) {
        hammer.setVisible(true).setPosition(p.x + 12, p.y - 6);
        var zittern = rot ? Math.sin(scene.time.now / 30) * 0.06 : 0;
        hammer.setRotation(1.0 - h.fortschritt * 2.4 + zittern);
      } else {
        hammer.setVisible(false);
      }
      prompt.setText(promptText());
      // Unter den Fuessen: oben stehen Balken, Satz und die Meldungen am Schirmrand.
      if (p) prompt.setPosition(p.x, p.y + 44);
      var nah = p && Math.hypot(p.x - e.x, p.y - e.y) <= REICHWEITE;
      prompt.setVisible(h.phase === 'erkannt' || (!!nah && h.phase !== 'fertig' && h.phase !== 'losgelassen'));
    }

    function erkennen() {
      h.phase = 'erkannt';
      h.erkanntUm = Date.now();
      h._erkanntTakt = 0;
      var kam = scene.cameras && scene.cameras.main;
      if (kam) {
        try { kam.flash(260, 255, 240, 230); } catch (x) {}
        try { kam.shake(260, 0.006); } catch (x) {}
      }
      // Der Schirm pulst: ein Schlag in Violett, dann Stille.
      var puls = scene.add.rectangle(0, 0, kam ? kam.width : 960, kam ? kam.height : 480, 0x2a1240, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(1040).setAlpha(0).setName('esseErkenntnisPuls');
      scene.tweens.add({ targets: puls, alpha: { from: 0.6, to: 0 }, duration: 1400, ease: 'Quad.easeOut', onComplete: function () { _weg(puls); } });
      tonSchnitt(1700);
      var p = _spieler();
      satz = scene.add.text(p ? p.x : e.x, (p ? p.y : e.y) - 78, _t('Das ist kein Lösen. Das ist Erneuern.', 'This is no loosening. This is renewal.'), {
        fontFamily: 'serif', fontStyle: 'bold italic', fontSize: '17px', color: '#ffe2c8', stroke: '#1a0a0a', strokeThickness: 4, align: 'center'
      }).setOrigin(0.5).setDepth(1004).setName('esseErkenntnisSatz');
      if (typeof cfg.beiErkenntnis === 'function') { try { cfg.beiErkenntnis(h); } catch (x) {} }
    }

    function aufraeumen() {
      if (scene.events) { scene.events.off('update', takt); scene.events.off('shutdown', aufraeumen); }
      if (scene.input && scene.input.keyboard) scene.input.keyboard.off('keydown-E', beiE);
      [zug, prompt, balken, hammer].forEach(_weg);
      if (satz && satz.scene) scene.tweens.add({ targets: satz, alpha: 0, duration: 900, onComplete: function () { _weg(satz); } });
      if (scene.__esseHalten === h) scene.__esseHalten = null;
    }
    h._bindung = bindung;
    h._glut = glut;
    h.bildAufraeumen = function () { _weg(bindung); _weg(glut); };

    var takt = function (zeit, delta) {
      if (_pausiert()) return;
      var ms = Math.min(50, delta || 16);
      var p = _spieler();
      var nah = !!(p && Math.hypot(p.x - e.x, p.y - e.y) <= REICHWEITE);
      var haelt = haeltGedrueckt(scene, h);
      if (h.phase === 'hingehen' || h.phase === 'bereit' || h.phase === 'heben') {
        if (nah && haelt) {
          if (h.phase !== 'heben' && typeof cfg.beiAnsetzen === 'function' && !h._angesetzt) {
            h._angesetzt = true;
            try { cfg.beiAnsetzen(h); } catch (x) {}
          }
          h.phase = 'heben';
          h.fortschritt = Math.min(1, h.fortschritt + ms / DAUER_MS);
          if (scene.cameras && scene.cameras.main && Math.random() < 0.08) {
            try { scene.cameras.main.shake(120, 0.0015 + h.fortschritt * 0.003); } catch (x) {}
          }
        } else {
          h.fortschritt = Math.max(0, h.fortschritt - ABFALL_JE_S * ms / 1000);
          h.phase = nah ? 'bereit' : 'hingehen';
        }
        if (erneuern && h.fortschritt >= ERKENNEN_BEI) {
          h.fortschritt = ERKENNEN_BEI;
          erkennen();
        } else if (!erneuern && h.fortschritt >= 1) {
          h.phase = 'fertig';
          zeichnen(ms);
          aufraeumen();
          if (typeof cfg.beiFertig === 'function') cfg.beiFertig(h);
          return;
        }
      } else if (h.phase === 'erkannt') {
        // Gemessen in Spielbildern, nicht an der Wanduhr: headless laeuft die
        // Uhr schneller als die Bilder.
        h._erkanntTakt = (h._erkanntTakt || 0) + ms;
        if (!haelt && h._erkanntTakt >= LOSLASSEN_AB_MS) {
          h.phase = 'losgelassen';
          zeichnen(ms);
          aufraeumen();
          if (typeof cfg.beiLoslassen === 'function') cfg.beiLoslassen(h);
          return;
        }
      }
      zeichnen(ms);
    };

    scene.events.on('update', takt);
    scene.events.once('shutdown', aufraeumen);
    h.abbrechen = function () { aufraeumen(); h.bildAufraeumen(); h.phase = 'abgebrochen'; };
    scene.__esseHalten = h;
    zeichnen(0);
    return h;
  }

  /**
   * Die Esse zerbricht: Risse, die Glut faellt in sich zusammen, der Daemon
   * verliert den Halt und sinkt in den Schacht, der Nebel weicht, und was er
   * noch nicht verbrannt hatte, steigt als Lichter auf.
   * fertig() kommt nach DAUER (ueber die Spieluhr, nicht ueber Tweens).
   */
  var ZERBRECHEN_MS = 3200;
  function zerbrechen(scene, fertig, halt) {
    var e = ort(scene);
    var teile = [];
    // Glut und Bindung der Halte-Aktion fallen mit der Esse in sich zusammen.
    if (halt && scene.tweens) {
      [halt._glut, halt._bindung].forEach(function (o) {
        if (o && o.scene) scene.tweens.add({ targets: o, alpha: 0, scale: 0.2, duration: 1400, ease: 'Quad.easeIn' });
      });
    }
    var kam = scene.cameras && scene.cameras.main;
    if (kam) { try { kam.shake(700, 0.012); kam.flash(400, 255, 230, 200); } catch (x) {} }
    // Im Blitz reisst sie: das Bild zeigt ab jetzt die kalte, gespaltene Esse.
    esseZustand(scene, 'zerbrochen');

    // Risse durch die Bindung.
    var risse = scene.add.graphics().setDepth(TIEFE + 2).setPosition(e.x, e.y).setName('esseRisse');
    risse.lineStyle(3, 0xfff2c4, 1);
    for (var i = 0; i < 7; i++) {
      var a = i * 0.9 + 0.3, r = 0;
      var x = 0, y = 0;
      for (var s = 0; s < 4; s++) {
        r += 18 + s * 6;
        var nx = Math.cos(a + (s % 2 ? 0.25 : -0.2)) * r, ny = Math.sin(a + (s % 2 ? 0.25 : -0.2)) * r;
        risse.lineBetween(x, y, nx, ny); x = nx; y = ny;
      }
    }
    teile.push(risse);

    // Die Glut der Arena faellt in sich zusammen.
    var glut = scene._quelleGlow;
    if (glut && glut.active && scene.tweens) {
      scene.tweens.killTweensOf(glut);
      scene.tweens.add({ targets: glut, alpha: 0, scale: 0.2, duration: 1500, ease: 'Quad.easeIn',
        onComplete: function () { _weg(glut); } });
    }
    scene._quelleGlow = null;

    // Der Daemon: eine Gestalt aus Rauch mit zwei Gluten, die sich noch
    // einmal aufrichtet und dann in die Tiefe faellt.
    // Ueber den Figuren (Spieler 100): er soll ueber allem aufragen, bevor er faellt.
    var daemon = scene.add.container(e.x, e.y - 30).setDepth(102).setName('esseDaemon');
    var leib = scene.add.graphics();
    leib.fillStyle(0x7a4ad0, 0.35); leib.fillEllipse(0, 0, 150, 200);
    leib.fillStyle(0x1c0f2a, 0.9); leib.fillEllipse(0, 0, 120, 170);
    leib.fillStyle(0x3a2258, 0.75); leib.fillEllipse(0, -30, 90, 90);
    leib.lineStyle(3, 0xb48cff, 0.9); leib.strokeEllipse(0, 0, 120, 170);
    leib.fillStyle(0xff5a2a, 1); leib.fillCircle(-18, -38, 8); leib.fillCircle(18, -38, 8);
    leib.fillStyle(0xffd28a, 1); leib.fillCircle(-18, -38, 3); leib.fillCircle(18, -38, 3);
    daemon.add(leib);
    daemon.setAlpha(0).setScale(0.6);
    scene.tweens.add({ targets: daemon, alpha: 1, scale: 1.1, y: e.y - 45, duration: 700, ease: 'Quad.easeOut',
      onComplete: function () {
        scene.tweens.add({ targets: daemon, y: e.y + 30, scale: 0.05, alpha: 0, angle: 25, duration: 1300, ease: 'Quad.easeIn' });
      } });
    teile.push(daemon);

    // Der Nebel weicht: ein grauer Ring laeuft nach aussen und verblasst.
    var ring = scene.add.graphics().setDepth(TIEFE + 1).setPosition(e.x, e.y).setName('esseNebelRing');
    ring.lineStyle(60, 0xd8d0e8, 0.5); ring.strokeCircle(0, 0, 70);
    scene.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 2600, delay: 600, ease: 'Sine.easeOut' });
    teile.push(ring);

    // Erinnerungen steigen auf: Lichter mit Schein, die nach oben wegziehen.
    for (var k = 0; k < 30; k++) {
      var lx = e.x + (Math.random() - 0.5) * 120, ly = e.y + (Math.random() - 0.5) * 60;
      var l = scene.add.container(lx, ly).setDepth(1003).setAlpha(0).setName('esseLicht');
      l.add(scene.add.circle(0, 0, 9, 0xffd88a, 0.3));
      l.add(scene.add.circle(0, 0, 3 + Math.random() * 3, k % 3 ? 0xffe6a0 : 0xfff8e0, 1));
      scene.tweens.add({ targets: l, alpha: { from: 1, to: 0 }, y: ly - 260 - Math.random() * 180,
        x: lx + (Math.random() - 0.5) * 200, delay: 500 + k * 55, duration: 2400, ease: 'Sine.easeIn' });
      teile.push(l);
    }
    tonSchnitt(900);
    scene.__esseZerbrochen = true;
    var ende = function () {
      teile.forEach(function (t) { if (t !== risse) _weg(t); });
      scene.tweens.add({ targets: risse, alpha: 0.35, duration: 600 });
      if (typeof fertig === 'function') fertig();
    };
    if (scene.time) scene.time.delayedCall(ZERBRECHEN_MS, ende);
    else ende();
    return teile;
  }

  // ---------------------------------------------------------------------
  // Die Esse als Bild (PixelLab, assets/finale/esse_*.png, Rohbilder unter
  // tools/rohbilder/esse/). Drei Zustaende: intakt (glimmt), flackern
  // (Finale und Kampf, der Daemon zieht), zerbrochen (nach dem letzten
  // Schlag). Fehlt das Bild, bleibt es beim gezeichneten Leuchten.
  // ---------------------------------------------------------------------
  var ESSE_BILDER = { intakt: 'esse_intakt', flackern: 'esse_flackern', zerbrochen: 'esse_zerbrochen' };
  // Wo das Bild auf dem Ort der Esse steht: Bildpunkt (68, 112) ist die Mitte
  // der Sockelunterkante, sie liegt ESSE_SOCKEL px unter dem Ort. So bleiben
  // Ort, [E]-Reichweite und Bindung, wo sie waren.
  var ESSE_ANKER = { x: 68 / 128, y: 112 / 128 };
  var ESSE_SOCKEL = 8;
  // Der Koerper ist nur der Sockel (Bildpunkte 30..106 x 84..112), nicht der
  // Schornstein: hinter dem Schacht kann man vorbeigehen.
  var ESSE_KOERPER = { w: 76, h: 28 };
  // Das Flackern: festes Muster statt Zufall (1 = auflodern, 0 = Glimmen).
  var FLACKER_MUSTER = [1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1];
  var FLACKER_MS = 110;

  function bilderVorladen(scene) {
    if (!scene || !scene.load || !scene.textures) return;
    Object.keys(ESSE_BILDER).forEach(function (z) {
      var key = ESSE_BILDER[z];
      if (!scene.textures.exists(key)) scene.load.image(key, 'assets/finale/' + key + '.png');
    });
  }

  /** Stellt die Esse als Bild samt Sockelkoerper auf; null, wenn das Bild fehlt. */
  function esseAufstellen(scene, x, y, zustand) {
    if (!scene || !scene.add || !scene.textures || !scene.textures.exists(ESSE_BILDER.intakt)) return null;
    var T = window.WELT_TIEFEN || {};
    var bild = scene.add.image(x, y + ESSE_SOCKEL, ESSE_BILDER.intakt).setOrigin(ESSE_ANKER.x, ESSE_ANKER.y)
      .setDepth((T.BODENDEKO_MAX || 30) + 0.8).setName('esseBild');
    bild.setData('esseZustand', 'intakt');
    bild.once('destroy', function () { if (bild._flackern) { bild._flackern.remove(false); bild._flackern = null; } });
    scene._esseBild = bild;
    // Steht der Spieler hinter dem Schacht, kommt die Esse vor ihn.
    if (typeof window.sortiereZumSpieler === 'function') window.sortiereZumSpieler(scene, bild);
    if (typeof obstacles !== 'undefined' && obstacles && typeof obstacles.create === 'function') {
      var k = obstacles.create(x, y + ESSE_SOCKEL - ESSE_KOERPER.h / 2, '__WHITE');
      k.setVisible(false).setDisplaySize(ESSE_KOERPER.w, ESSE_KOERPER.h).setName('esseKoerper');
      if (typeof k.refreshBody === 'function') k.refreshBody();
      obstacles.__steerRects = null;
      scene._esseKoerper = k;
    }
    if (zustand && zustand !== 'intakt') esseZustand(scene, zustand);
    return bild;
  }

  /** Wechselt das Bild der Esse; ohne Bild (Ersatzdarstellung) geschieht nichts. */
  function esseZustand(scene, zustand) {
    var bild = scene && scene._esseBild;
    if (!bild || !bild.scene || !ESSE_BILDER[zustand]) return false;
    if (bild.getData('esseZustand') === zustand) return true;
    if (bild._flackern) { bild._flackern.remove(false); bild._flackern = null; }
    bild.setData('esseZustand', zustand);
    var key = ESSE_BILDER[zustand];
    if (!scene.textures.exists(key)) key = ESSE_BILDER.intakt;
    bild.setTexture(key);
    var glut = scene._quelleGlow;
    if (zustand === 'flackern') {
      if (scene.time && scene.textures.exists(ESSE_BILDER.flackern)) {
        var i = 0;
        bild._flackern = scene.time.addEvent({ delay: FLACKER_MS, loop: true, callback: function () {
          if (!bild.scene) return;
          i = (i + 1) % FLACKER_MUSTER.length;
          bild.setTexture(FLACKER_MUSTER[i] ? ESSE_BILDER.flackern : ESSE_BILDER.intakt);
        } });
      }
      // Der Schein unter der Esse zuckt mit: schnell, nur in der Helligkeit
      // (die Groesse gehoert dem Aufflammen, Finale._quelleNimmtSie).
      if (glut && glut.active && scene.tweens) {
        scene.tweens.killTweensOf(glut);
        glut.setScale(1);
        scene.tweens.add({ targets: glut, alpha: { from: 0.55, to: 1 }, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    return true;
  }

  window.FinaleHandwerk = {
    REICHWEITE: REICHWEITE, DAUER_MS: DAUER_MS, ERKENNEN_BEI: ERKENNEN_BEI, ZERBRECHEN_MS: ZERBRECHEN_MS,
    ort: ort, halten: halten, zerbrechen: zerbrechen, haeltGedrueckt: haeltGedrueckt,
    hammerTextur: hammerTextur, tonSchnitt: tonSchnitt,
    ESSE_BILDER: ESSE_BILDER, ESSE_KOERPER: ESSE_KOERPER, ESSE_SOCKEL: ESSE_SOCKEL, FLACKER_MUSTER: FLACKER_MUSTER, FLACKER_MS: FLACKER_MS,
    bilderVorladen: bilderVorladen, esseAufstellen: esseAufstellen, esseZustand: esseZustand
  };
})();
