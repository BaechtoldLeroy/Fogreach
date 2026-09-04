/**
 * js/kettenschloss.js — Ein Kettenschloss knacken (#71).
 *
 * Warum kein Kartenspiel: Blackjack und Roulette wären generisches
 * Taverneninventar. Diese Stadt heisst nach ihren Ketten — Kettenrat,
 * Kettenmeister, Kettenwächter. Ein verkettetes Gitter aufzubrechen ist das
 * Minispiel, das aus dem Stoff dieses Spiels kommt.
 *
 * Mechanik: mehrere Stifte nacheinander. Ein Zeiger wandert über eine Leiste;
 * im richtigen Moment drücken setzt den Stift, danach wird das Fenster enger.
 * Ein Fehlgriff kostet einen Dietrich.
 *
 * Die Rechnerei steht hier oben und ohne Phaser — sie ist der Teil, der
 * balanciert werden muss, und der einzige, der sich sinnvoll testen lässt.
 */
(function () {
  'use strict';

  // Stifte je Tiefe. Drei sind schnell genug, dass es nicht zäh wird; mehr als
  // fünf wäre in einem Dungeon-Kampf eine Geduldsprobe.
  var STIFTE_MIN = 3;
  var STIFTE_MAX = 5;

  // Dietriche = erlaubte Fehlgriffe. Zwei, damit ein Ausrutscher nicht sofort
  // alles kostet — aber nicht so viele, dass Timing egal wird.
  var DIETRICHE = 2;

  // Breite des Trefferfensters als Anteil der Leiste. Der erste Stift ist
  // grosszügig, der letzte eng — die Spannung soll steigen, nicht am Anfang
  // stehen.
  var ZONE_START = 0.26;
  var ZONE_ENDE = 0.11;

  // Wie lange der Zeiger für einen Durchlauf braucht (ms), erster bis letzter
  // Stift. Schneller wird schwerer — zusammen mit dem engeren Fenster ergibt
  // das zwei Achsen statt einer.
  var LAUF_START = 1500;
  var LAUF_ENDE = 900;

  /** Wie viele Stifte hat ein Schloss in dieser Tiefe? */
  function stifteFuerTiefe(tiefe) {
    var t = Math.max(1, tiefe || 1);
    return Math.max(STIFTE_MIN, Math.min(STIFTE_MAX, STIFTE_MIN + Math.floor(t / 8)));
  }

  /**
   * Breite des Trefferfensters für Stift `index` von `anzahl`, als Anteil
   * der Leiste (0..1).
   */
  function zonenBreite(index, anzahl) {
    var n = Math.max(1, anzahl || 1);
    if (n <= 1) return ZONE_START;
    var t = Math.max(0, Math.min(n - 1, index || 0)) / (n - 1);
    return ZONE_START + (ZONE_ENDE - ZONE_START) * t;
  }

  /** Dauer eines Zeigerdurchlaufs für Stift `index` von `anzahl`, in ms. */
  function laufzeit(index, anzahl) {
    var n = Math.max(1, anzahl || 1);
    if (n <= 1) return LAUF_START;
    var t = Math.max(0, Math.min(n - 1, index || 0)) / (n - 1);
    return Math.round(LAUF_START + (LAUF_ENDE - LAUF_START) * t);
  }

  /**
   * Wo liegt die Mitte des Trefferfensters?
   *
   * Nie so nah am Rand, dass das Fenster hinausragt — sonst wäre ein Stift
   * durch blosses Warten am Umkehrpunkt zu treffen.
   */
  function zonenMitte(breite, rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var halb = breite / 2;
    return halb + r() * Math.max(0, 1 - breite);
  }

  /** Sitzt der Zeiger im Fenster? Beide Werte als Anteil der Leiste (0..1). */
  function istTreffer(zeiger, mitte, breite) {
    return Math.abs(zeiger - mitte) <= breite / 2;
  }

  /**
   * Position des Zeigers zum Zeitpunkt `ms` — hin und zurück (Dreieckswelle).
   *
   * Kein Sprung am Rand: der Zeiger kehrt um, statt neu zu starten. Ein
   * Sprung wäre unfair, weil man ihn nicht kommen sieht.
   */
  function zeigerPosition(ms, dauer) {
    var d = Math.max(1, dauer || 1);
    var p = (ms % (d * 2)) / d;
    return p <= 1 ? p : 2 - p;
  }

  /**
   * Was gibt es für `gesetzt` von `anzahl` Stiften?
   *
   * Gestaffelt: alles offen -> Ausrüstung auf Belohnungstruhen-Niveau; teils
   * -> Gold nach Anteil; nichts -> das Schloss klemmt. So lohnt sich auch ein
   * halber Erfolg, ohne den ganzen zu entwerten.
   *
   * @returns {{art:'item'|'gold'|'nichts', gold:number, iLevel:number, stufe:number}}
   */
  function belohnung(gesetzt, anzahl, tiefe) {
    var t = Math.max(1, tiefe || 1);
    var n = Math.max(1, anzahl || 1);
    var g = Math.max(0, Math.min(n, gesetzt || 0));
    if (g >= n) {
      return { art: 'item', gold: 0, iLevel: t + 4, stufe: 2 };
    }
    if (g <= 0) {
      return { art: 'nichts', gold: 0, iLevel: 0, stufe: 0 };
    }
    // Anteiliges Gold, in derselben Grössenordnung wie der versteckte Schatz
    // (30-70 + 15/Tiefe), damit ein halber Erfolg nicht besser zahlt als ein
    // ganzes anderes Ereignis.
    var voll = 40 + 15 * t;
    return { art: 'gold', gold: Math.round(voll * (g / n)), iLevel: 0, stufe: 0 };
  }

  // -------------------------------------------------------------------------
  // Die Spieloberfläche
  // -------------------------------------------------------------------------

  /**
   * Startet das Schloss-Minispiel.
   *
   * Eingabe: LEERTASTE, E oder Tippen/Klick. Die Kampfeingabe wird über
   * window.eventChoiceOpen unterdrückt und die Spieluhr über pauseGameClock
   * angehalten — dasselbe Muster wie beim Wahl-Dialog. Ohne das greift man
   * beim Setzen an oder wird nebenher totgeschlagen.
   *
   * @param {Phaser.Scene} scene
   * @param {number} tiefe
   * @param {function} fertig  bekommt { gesetzt, anzahl, geschafft }
   */
  function spiele(scene, tiefe, fertig) {
    if (!scene || !scene.add) { if (fertig) fertig({ gesetzt: 0, anzahl: 0, geschafft: false }); return null; }

    var anzahl = stifteFuerTiefe(tiefe);
    var gesetzt = 0;
    var dietriche = DIETRICHE;
    var beendet = false;
    var elemente = [];
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 960;
    var camH = cam ? cam.height : 480;
    var cx = camW / 2;

    // Leiste
    var leisteB = Math.min(420, camW - 120);
    var leisteX = cx - leisteB / 2;
    var leisteY = camH / 2;

    var breite = zonenBreite(0, anzahl);
    var mitte = zonenMitte(breite, Math.random);
    var dauer = laufzeit(0, anzahl);
    var start = 0;

    var halten = function (o) { if (o) { o.setScrollFactor(0); o.setDepth(4000); elemente.push(o); } return o; };

    var schleier = halten(scene.add.rectangle(cx, camH / 2, camW, camH, 0x000000, 0.66));
    var titel = halten(scene.add.text(cx, leisteY - 92, _t('lock.title', 'Kettenschloss'), {
      fontFamily: 'serif', fontSize: '26px', color: '#ffd166', fontStyle: 'bold',
      stroke: '#2a1c00', strokeThickness: 4
    }).setOrigin(0.5));
    var hinweis = halten(scene.add.text(cx, leisteY - 58,
      _t('lock.hint', 'Leertaste, wenn der Zeiger im Licht steht'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd4dd'
    }).setOrigin(0.5));
    var stand = halten(scene.add.text(cx, leisteY + 62, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5));

    var gfx = halten(scene.add.graphics());

    var standText = function () {
      var stifte = '';
      for (var i = 0; i < anzahl; i++) stifte += (i < gesetzt) ? '\u25CF' : '\u25CB';
      var picks = '';
      for (var k = 0; k < DIETRICHE; k++) picks += (k < dietriche) ? '\u2020' : '\u00B7';
      stand.setText(_t('lock.status', 'Stifte {stifte}   Dietriche {picks}')
        .replace('{stifte}', stifte).replace('{picks}', picks));
    };

    var zeichne = function (pos) {
      gfx.clear();
      // Leiste
      gfx.fillStyle(0x1a1620, 0.95);
      gfx.fillRect(leisteX - 4, leisteY - 18, leisteB + 8, 36);
      gfx.fillStyle(0x3a3446, 1);
      gfx.fillRect(leisteX, leisteY - 14, leisteB, 28);
      // Trefferfenster
      var zx = leisteX + (mitte - breite / 2) * leisteB;
      var zb = breite * leisteB;
      gfx.fillStyle(0xffd166, 0.30);
      gfx.fillRect(zx, leisteY - 14, zb, 28);
      gfx.lineStyle(2, 0xffd166, 0.9);
      gfx.strokeRect(zx, leisteY - 14, zb, 28);
      // Zeiger
      var px = leisteX + pos * leisteB;
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(px - 2, leisteY - 22, 4, 44);
    };

    var aufraeumen = function () {
      for (var i = 0; i < elemente.length; i++) {
        try { if (elemente[i] && elemente[i].destroy) elemente[i].destroy(); } catch (e) {}
      }
      elemente.length = 0;
      try { scene.events.off('update', tick); } catch (e) {}
      try { if (scene.input && scene.input.keyboard) {
        scene.input.keyboard.off('keydown-SPACE', druck);
        scene.input.keyboard.off('keydown-E', druck);
      } } catch (e) {}
      try { if (scene.input) scene.input.off('pointerdown', druck); } catch (e) {}
      window.eventChoiceOpen = false;
      try {
        if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
        else if (scene.physics && scene.physics.world) scene.physics.world.resume();
      } catch (e) {}
    };

    var schliesse = function (geschafft) {
      if (beendet) return;
      beendet = true;
      aufraeumen();
      if (fertig) fertig({ gesetzt: gesetzt, anzahl: anzahl, geschafft: !!geschafft });
    };

    var naechsterStift = function () {
      breite = zonenBreite(gesetzt, anzahl);
      mitte = zonenMitte(breite, Math.random);
      dauer = laufzeit(gesetzt, anzahl);
      start = _jetzt(scene);
    };

    var druck = function () {
      if (beendet) return;
      var pos = zeigerPosition(_jetzt(scene) - start, dauer);
      if (istTreffer(pos, mitte, breite)) {
        gesetzt++;
        try { window.soundManager && window.soundManager.playSFX('pickup'); } catch (e) {}
        standText();
        if (gesetzt >= anzahl) { schliesse(true); return; }
        naechsterStift();
      } else {
        dietriche--;
        try { window.soundManager && window.soundManager.playSFX('hit'); } catch (e) {}
        standText();
        if (dietriche < 0) { schliesse(false); return; }
        // Kein neuer Stift: derselbe bleibt, nur das Fenster wandert.
        mitte = zonenMitte(breite, Math.random);
        start = _jetzt(scene);
      }
    };

    var tick = function () {
      if (beendet) return;
      zeichne(zeigerPosition(_jetzt(scene) - start, dauer));
    };

    // Kampfeingabe unterdrücken und die Uhr anhalten — wie der Wahl-Dialog.
    window.eventChoiceOpen = true;
    try {
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
      else if (scene.physics && scene.physics.world) scene.physics.world.pause();
    } catch (e) {}
    // Damit derselbe E-Druck, der das Schloss geöffnet hat, hier nicht sofort
    // als erster Versuch zählt (b153: __eventConsumedEAt).
    try { window.__eventConsumedEAt = Date.now(); } catch (e) {}

    start = _jetzt(scene);
    standText();
    zeichne(0);
    scene.events.on('update', tick);
    if (scene.input && scene.input.keyboard) {
      scene.input.keyboard.on('keydown-SPACE', druck);
      scene.input.keyboard.on('keydown-E', druck);
    }
    if (scene.input) scene.input.on('pointerdown', druck);

    return { druck: druck, abbrechen: function () { schliesse(false); } };
  }

  /** Zeitbasis: die Spieluhr, damit eine Pause die Runde nicht verbraucht. */
  function _jetzt(scene) {
    try {
      if (typeof window.gameNow === 'function') return window.gameNow(scene);
    } catch (e) {}
    return Date.now();
  }

  function _t(key, fallback) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(key);
        if (v && String(v).indexOf('[MISSING:') !== 0 && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  window.Kettenschloss = {
    STIFTE_MIN: STIFTE_MIN,
    STIFTE_MAX: STIFTE_MAX,
    DIETRICHE: DIETRICHE,
    ZONE_START: ZONE_START,
    ZONE_ENDE: ZONE_ENDE,
    stifteFuerTiefe: stifteFuerTiefe,
    zonenBreite: zonenBreite,
    laufzeit: laufzeit,
    zonenMitte: zonenMitte,
    istTreffer: istTreffer,
    zeigerPosition: zeigerPosition,
    belohnung: belohnung,
    spiele: spiele
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.Kettenschloss;
})();
