/* =====================================================================
 * aktwechsel.js — Aktwechsel als kurze Zwischenszene statt Text-Splash
 * ---------------------------------------------------------------------
 * Vorschau hinter ?debug=1&aktwechsel=neu. Ohne Flagge (oder wenn das
 * Bild des Akts fehlt) zeigt storySystem.showStoryOverlay die alte
 * Titelkarte — dieses Modul wird dann gar nicht gefragt.
 *
 * Aufbau: ein Pixel-Tableau je Akt (PixelLab, assets/sprites/aktwechsel/)
 * mit langsamem Schwenk/Zoom und treibendem Nebel, oben eine
 * Messing-Plakette "Akt N" + Aktname, unten eine Messing-Platte, auf der
 * der Text Stueck fuer Stueck erscheint. Weiter per Leertaste/Enter/Klick/
 * Tippen, ESC oder "Ueberspringen" schliesst sofort.
 *
 * Die Spieluhr steht, solange die Szene offen ist. Darum laeuft hier
 * NICHTS ueber scene.time (pauseGameClock friert dessen Ereignisse ein):
 * Schwenk, Nebel und Einblenden sind Tweens bzw. Partikel, die Sperrfrist
 * gegen den ausloesenden Klick misst die Spiel-Schleife.
 *
 * Debug: ?aktprobe=N (1-5, 6 oder "epilog") zeigt beim Hub-Eintritt diese
 * Karte, ohne den Spielstand anzufassen — siehe docs/debug-modus.md.
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/aktwechsel/';
  var V = 1;
  var AKTE = ['auftrag', 'treuer_diener', 'erste_risse', 'wahrheit', 'bruch', 'ending'];
  var NEBEL = 'aktwechsel_nebelflocke';
  var TIEFE = 6000;
  var SPERRE_MS = 350;   // so lange zaehlt kein Klick (der ausloesende Klick)
  var EINBLENDEN_MS = 450;
  var MIN_TREFFER = 44;  // Mobile: Trefferflaechen mindestens so hoch
  var VORSPANN_MS = 1400; // so lange steht das Bild allein, bevor der Text kommt
  // Worauf die Kamera zufaehrt (Anteil an Bildbreite/-hoehe): die Figur in
  // der Schmiede, Harren mit dem Tagebuch, die Masken, die Wachen, die
  // Quelle, die Presse.
  var FOKUS = {
    auftrag: [0.42, 0.55],
    treuer_diener: [0.68, 0.62],
    erste_risse: [0.5, 0.32],
    wahrheit: [0.55, 0.5],
    bruch: [0.5, 0.72],
    ending: [0.4, 0.5]
  };

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'aktwechsel.akt': 'Akt {n}',
      'aktwechsel.weiter': 'Weiter',
      'aktwechsel.ueberspringen': 'Überspringen'
    });
    window.i18n.register('en', {
      'aktwechsel.akt': 'Act {n}',
      'aktwechsel.weiter': 'Continue',
      'aktwechsel.ueberspringen': 'Skip'
    });
  }

  function _t(key, params, rueckfall) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (!I || typeof I.t !== 'function') return rueckfall;
    var v = I.t(key, params || {});
    return (typeof v === 'string' && v.indexOf('[') !== 0) ? v : rueckfall;
  }

  /** Steht die Vorschau-Flagge? (?debug=1&aktwechsel=neu) */
  function aktiv() {
    var G = (typeof window !== 'undefined') ? window.DebugGate : null;
    try { return !!(G && G.flagge('aktwechsel') === 'neu'); } catch (e) { return false; }
  }

  function bildKey(actId) { return 'aktwechsel_' + actId; }

  /** Im preload(): nur mit Flagge, nur die fehlenden. */
  function vorladen(scene) {
    if (!aktiv() || !scene || !scene.load || !scene.textures) return;
    AKTE.forEach(function (id) {
      var k = bildKey(id);
      if (!scene.textures.exists(k)) scene.load.image(k, ORDNER + k + '.png?v=' + V);
    });
  }

  /** Neue Szene moeglich? Nur mit Flagge UND vorhandenem Bild des Akts. */
  function kann(scene, eventData) {
    if (!aktiv() || !scene || !scene.textures || !eventData) return false;
    return scene.textures.exists(bildKey(eventData.actId));
  }

  // ---- Text in Stuecke ----------------------------------------------------
  // Absaetze sind die natuerlichen Stuecke. Die Akt-Texte sind aber je EIN
  // Absatz — darum werden lange Absaetze an Satzenden geteilt, nie mitten in
  // einem Zitat ('…' zaehlt nur als Zitatzeichen am Wortrand, nicht als
  // Apostroph wie in "mayor's").
  function _saetze(absatz) {
    var teile = [];
    var rest = '';
    var offen = false;
    var woerter = absatz.split(/\s+/).filter(Boolean);
    woerter.forEach(function (w) {
      if (/^['‚„"«]/.test(w)) offen = true;
      if (/['‘“"»]$/.test(w)) offen = false;
      rest += (rest ? ' ' : '') + w;
      if (!offen && /[.!?]['‘“"»]?$/.test(w)) { teile.push(rest); rest = ''; }
    });
    if (rest) teile.push(rest);
    return teile;
  }

  /**
   * Text in Seiten teilen, die in den Platz passen (passt(text) -> bool).
   * Absatzgrenzen bleiben Seitengrenzen; ein Absatz, der zu lang ist oder
   * aus mehreren Saetzen besteht, wird in Satzgruppen bis ~zielLaenge
   * Zeichen zerlegt.
   */
  function seitenAus(text, passt, zielLaenge) {
    var ziel = zielLaenge || 150;
    var seiten = [];
    String(text || '').split('\n\n').forEach(function (absatz) {
      absatz = absatz.trim();
      if (!absatz) return;
      var stueck = '';
      _saetze(absatz).forEach(function (s) {
        var probe = stueck ? stueck + ' ' + s : s;
        if (stueck && (probe.length > ziel || !passt(probe))) { seiten.push(stueck); stueck = s; }
        else stueck = probe;
      });
      if (stueck) seiten.push(stueck);
    });
    if (!seiten.length) seiten.push('');
    return seiten;
  }

  // ---- Bausteine -----------------------------------------------------------

  /** Weiche Nebelflocke einmal als Textur anlegen. */
  function _nebelTextur(scene) {
    if (scene.textures.exists(NEBEL)) return NEBEL;
    var g = 48;
    var ct = scene.textures.createCanvas(NEBEL, g, g);
    if (!ct) return null;
    var ctx = ct.getContext();
    var grad = ctx.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g, g);
    ct.refresh();
    return NEBEL;
  }

  /** scrollFactor 0 bis in jedes Kind (sonst treffen Mobile-Taps daneben). */
  function _fest(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  /** Platte aus uiRahmen oder, ohne Messing-Bilder, ein dunkler Kasten. */
  function _platte(scene, c, cx, cy, w, h, linie) {
    var UR = window.uiRahmen;
    var teile = UR && typeof UR.bereit === 'function' && UR.bereit(scene)
      ? UR.platte(scene, cx, cy, w, h, TIEFE + 2, 0.5) : null;
    if (teile) { teile.forEach(function (t) { c.add(t); }); return true; }
    var g = scene.add.graphics();
    g.fillStyle(0x1c191f, 0.94).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    g.lineStyle(2, linie, 0.8).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    c.add(g);
    return false;
  }

  /**
   * Die Zwischenszene zeigen. Gleiches Rueckgabe-Format wie die alte Karte
   * ({ seiten, seite(), weiter }) plus ueberspringen().
   */
  function zeigen(scene, eventData, onDismiss) {
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var S = window.storySystem;
    var stimmung = (S && typeof S.aktStimmung === 'function') ? S.aktStimmung(eventData.actId)
      : { grund: 0x0b0d12, titel: '#f1e9d8', linie: 0xa8a090 };
    var schleife = scene.game && scene.game.loop;
    var jetzt = function () { return schleife ? schleife.time : Date.now(); };
    var start = jetzt();
    var tweens = [];
    function tween(cfg) { var t = scene.tweens.add(cfg); tweens.push(t); return t; }

    if (typeof window.pauseGameClock === 'function') {
      try { window.pauseGameClock(scene); } catch (e) {}
    }

    var c = scene.add.container(0, 0).setDepth(TIEFE);
    c.setName('aktwechsel');

    // Schwarzer Grund = Trefferflaeche fuer "weiter" (Klick/Tippen irgendwo).
    var grund = scene.add.rectangle(w / 2, h / 2, w + 40, h + 40, 0x000000, 1);
    grund.setName('aktwechselGrund');
    c.add(grund);

    // Tableau: fuellt das Bild und faehrt langsam auf den Kern des Akts zu.
    // Gezoomt wird um den Fokuspunkt — so bleibt das Bild immer randvoll.
    var f = FOKUS[eventData.actId] || [0.5, 0.5];
    var bild = scene.add.image(w * f[0], h * f[1], bildKey(eventData.actId));
    bild.setName('aktwechselBild');
    var basis = Math.max(w / bild.width, h / bild.height);
    bild.setOrigin(f[0], f[1]).setScale(basis).setAlpha(0);
    c.add(bild);
    tween({ targets: bild, alpha: 1, duration: 700 });
    tween({ targets: bild, scale: basis * 1.14, duration: 24000, ease: 'Sine.easeOut' });

    // Nebel: treibende Flocken in der Farbe der Akt-Linie.
    var nebel = null;
    var nk = _nebelTextur(scene);
    if (nk && scene.add.particles) {
      try {
        nebel = scene.add.particles(0, 0, nk, {
          x: { min: -80, max: w },
          y: { min: h * 0.25, max: h + 20 },
          speedX: { min: 6, max: 22 },
          speedY: { min: -6, max: 2 },
          scale: { min: 2.5, max: 5 },
          alpha: { onEmit: function () { return 0; },
            onUpdate: function (p, k, t) { return Math.sin(t * Math.PI) * 0.16; } },
          tint: stimmung.linie,
          lifespan: 9000,
          frequency: 320,
          advance: 6000
        });
        nebel.setName('aktwechselNebel');
        c.add(nebel);
      } catch (e) { nebel = null; }
    }

    // ---- Plakette oben: "Akt N" und der Aktname ----
    var plY = 16;
    var aktLabel = null;
    if (eventData.actNumber) {
      aktLabel = scene.add.text(w / 2, 0, _t('aktwechsel.akt', { n: eventData.actNumber }, 'Akt ' + eventData.actNumber), {
        fontFamily: 'serif', fontSize: 16, color: '#d4a543', fontStyle: 'bold'
      }).setOrigin(0.5, 0);
      aktLabel.setName('aktwechselAkt');
    }
    var titel = scene.add.text(w / 2, 0, eventData.actName, {
      fontFamily: 'serif', fontSize: 30, color: stimmung.titel, fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    titel.setName('aktwechselTitel');
    var plInnen = (aktLabel ? aktLabel.height + 2 : 0) + titel.height;
    var plH = plInnen + 30;
    var plW = Math.min(w - 32, Math.max(300, Math.max(titel.width, aktLabel ? aktLabel.width : 0) + 90));
    _platte(scene, c, w / 2, plY + plH / 2, plW, plH, stimmung.linie);
    var yy = plY + 15;
    if (aktLabel) { aktLabel.y = yy; c.add(aktLabel); yy += aktLabel.height + 2; }
    titel.y = yy;
    c.add(titel);

    // ---- Ueberspringen oben rechts (Trefferflaeche >= 44 px) ----
    var skipText = scene.add.text(0, 0, _t('aktwechsel.ueberspringen', null, 'Überspringen'), {
      fontFamily: 'monospace', fontSize: 14, color: '#e6dcc6'
    }).setOrigin(0.5);
    var skipW = Math.max(110, skipText.width + 28), skipH = MIN_TREFFER;
    var skipX = w - 16 - skipW / 2, skipY = plY + skipH / 2;
    // Nicht in die Plakette ragen: auf schmalem Bild unter sie ruecken.
    if (skipX - skipW / 2 < w / 2 + plW / 2 + 8) skipY = plY + plH + 8 + skipH / 2;
    var UR = window.uiRahmen;
    var kachel = UR && typeof UR.kachelBild === 'function' && UR.bereit && UR.bereit(scene)
      ? UR.kachelBild(scene, skipW, skipH) : null;
    var skipFeld = kachel ? scene.add.image(skipX, skipY, kachel)
      : scene.add.rectangle(skipX, skipY, skipW, skipH, 0x1c191f, 0.9).setStrokeStyle(1, stimmung.linie, 0.8);
    skipFeld.setName('aktwechselUeberspringen');
    skipText.setPosition(skipX, skipY);
    c.add(skipFeld);
    c.add(skipText);

    // ---- Textplatte unten (erscheint nach dem Vorspann) ----
    var textC = scene.add.container(0, 0);
    c.add(textC);
    var tpW = Math.min(780, w - 32);
    var tpH = Math.min(132, Math.round(h * 0.28));
    var tpY = h - 16 - tpH / 2;
    _platte(scene, textC, w / 2, tpY, tpW, tpH, stimmung.linie);
    var hinweis = scene.add.text(w / 2 + tpW / 2 - 26, tpY + tpH / 2 - 14, _t('aktwechsel.weiter', null, 'Weiter'), {
      fontFamily: 'monospace', fontSize: 14, color: '#c8bca4'
    }).setOrigin(1, 1);
    hinweis.setName('aktwechselWeiter');
    var textW = tpW - 72;
    var textMaxH = tpH - 28 - hinweis.height - 8;
    var erzaehl = scene.add.text(w / 2, tpY - tpH / 2 + 22, '', {
      fontFamily: 'serif', fontSize: 19, color: '#f1e9d8', align: 'center',
      wordWrap: { width: textW }, lineSpacing: 5
    }).setOrigin(0.5, 0);
    erzaehl.setName('aktwechselText');
    textC.add(erzaehl);
    textC.add(hinweis);
    tween({ targets: hinweis, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });

    var seiten = seitenAus(eventData.narrative, function (t) {
      erzaehl.setText(t);
      return erzaehl.height <= textMaxH;
    }, 150);
    // Notfalls (ein einzelner Satz zu lang) die Schrift verkleinern.
    seiten.forEach(function (s) {
      erzaehl.setText(s);
      while (erzaehl.height > textMaxH && parseFloat(erzaehl.style.fontSize) > 13) {
        erzaehl.setFontSize((parseFloat(erzaehl.style.fontSize) - 1) + 'px');
      }
    });
    var seite = 0;
    var blende = null;
    function zeigeSeite() {
      erzaehl.setText(seiten[seite]);
      // Kurze Seiten mittig im Textfeld, nicht oben angeklebt.
      erzaehl.y = tpY - tpH / 2 + 20 + Math.max(0, Math.floor((textMaxH - erzaehl.height) / 2));
      erzaehl.setAlpha(0);
      if (blende) blende.stop();
      blende = tween({ targets: erzaehl, alpha: 1, duration: EINBLENDEN_MS,
        onComplete: function () { blende = null; } });
    }
    // Vorspann: erst nur das Bild, dann gleitet die Platte herein. Ein
    // Druck auf Weiter kuerzt ihn ab.
    erzaehl.setText(seiten[0]).setAlpha(0);
    textC.setAlpha(0);
    textC.y = 16;
    var vorspann = tween({ targets: textC, alpha: 1, y: 0, delay: VORSPANN_MS, duration: 450,
      ease: 'Sine.easeOut', onComplete: function () { vorspann = null; zeigeSeite(); } });
    function vorspannEnde() {
      if (vorspann) vorspann.stop();
      vorspann = null;
      textC.setAlpha(1);
      textC.y = 0;
      zeigeSeite();
    }

    _fest(c);
    if (nebel) nebel.setScrollFactor(0);

    // ---- Steuerung ----
    var zu = false;
    var tasten = { 'keydown-SPACE': null, 'keydown-ENTER': null, 'keydown-ESC': null };
    function aufraeumen() {
      if (zu) return false;
      zu = true;
      Object.keys(tasten).forEach(function (t) {
        try { if (tasten[t]) scene.input.keyboard.off(t, tasten[t]); } catch (e) {}
      });
      try { scene.events.off('shutdown', beiEnde); } catch (e) {}
      tweens.forEach(function (t) { try { t.stop(); t.remove(); } catch (e) {} });
      try { c.destroy(true); } catch (e) {}
      if (typeof window.resumeGameClock === 'function') {
        try { window.resumeGameClock(scene); } catch (e) {}
      }
      return true;
    }
    function schliessen() {
      if (aufraeumen() && typeof onDismiss === 'function') onDismiss();
    }
    function beiEnde() { aufraeumen(); }
    function weiter() {
      if (zu) return;
      if (vorspann) { vorspannEnde(); return; }
      // Laeuft das Einblenden noch, erst fertig zeigen.
      if (blende) { blende.stop(); blende = null; erzaehl.setAlpha(1); return; }
      if (seite < seiten.length - 1) { seite++; zeigeSeite(); return; }
      schliessen();
    }
    function ueberspringen() { if (!zu) schliessen(); }
    function scharf() { return jetzt() - start >= SPERRE_MS; }

    tasten['keydown-SPACE'] = weiter;
    tasten['keydown-ENTER'] = weiter;
    tasten['keydown-ESC'] = ueberspringen;
    Object.keys(tasten).forEach(function (t) { scene.input.keyboard.on(t, tasten[t]); });
    scene.events.once('shutdown', beiEnde);

    grund.setInteractive();
    grund.on('pointerdown', function () { if (scharf()) weiter(); });
    skipFeld.setInteractive({ useHandCursor: true });
    skipFeld.on('pointerdown', function () { if (scharf()) ueberspringen(); });

    return {
      neu: true,
      seiten: seiten,
      seite: function () { return seite; },
      weiter: weiter,
      ueberspringen: ueberspringen,
      offen: function () { return !zu; }
    };
  }

  /**
   * Debug-Abkuerzung: ?aktprobe=N zeigt beim Hub-Eintritt einmal pro Laden
   * die Karte von Akt N (1-5) bzw. den Epilog (6 / "epilog"). Laeuft durch
   * showStoryOverlay — ohne ?aktwechsel=neu also die alte Karte, zum
   * Vergleichen. Der Spielstand bleibt unberuehrt.
   */
  var _probeGezeigt = false;
  function probe(scene, fertig) {
    var G = window.DebugGate;
    var wert = null;
    try { wert = G && G.flagge('aktprobe'); } catch (e) { wert = null; }
    if (!wert || _probeGezeigt) return false;
    var S = window.storySystem;
    var ev = S && typeof S.probeEreignis === 'function' ? S.probeEreignis(wert) : null;
    if (!ev) return false;
    _probeGezeigt = true;
    S.showStoryOverlay(scene, ev, fertig);
    return true;
  }

  window.Aktwechsel = {
    AKTE: AKTE,
    aktiv: aktiv,
    vorladen: vorladen,
    kann: kann,
    zeigen: zeigen,
    probe: probe,
    seitenAus: seitenAus,
    bildKey: bildKey
  };
})();
