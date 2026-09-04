/**
 * js/kettenschloss.js — Ein Kettenschloss knacken (#71).
 *
 * Warum kein Kartenspiel: Blackjack und Roulette wären generisches
 * Taverneninventar. Diese Stadt heisst nach ihren Ketten — Kettenrat,
 * Kettenmeister, Kettenwächter. Ein verkettetes Gitter aufzubrechen ist das
 * Minispiel, das aus dem Stoff dieses Spiels kommt.
 *
 * ZWEITE FASSUNG. Die erste liess einen Zeiger über eine Leiste laufen; man
 * drückte im richtigen Moment. Zwei Dinge stimmten daran nicht:
 *
 *   1. Der Zeiger stand still. Das Spiel hält die Spieluhr an (pauseGameClock),
 *      las die Zeigerposition aber aus eben dieser Uhr (gameNow). Übrig blieb:
 *      drücken — und bei jedem Fehlgriff wurde das Trefferfenster neu
 *      ausgewürfelt. Reiner Zufall, genau wie berichtet.
 *   2. Auch heil gewesen wäre es dünn: eine Achse, ein Knopf, keine
 *      Entscheidung.
 *
 * Jetzt wird wirklich ein Schloss abgetastet. Der Dietrich wird von Hand über
 * das Schloss geführt (Pfeiltasten oder Ziehen); ein Widerstands-Anzeiger sagt
 * grob, wie nah der Stift ist — aber seine feinste Stufe ist BREITER als die
 * Trefferzone. Wer blind zugreift, sobald es greift, trifft in etwa zwei von
 * fünf Fällen. Wer die Kanten der greifenden Zone abtastet und die Mitte
 * nimmt, trifft sicher — das kostet Zeit, und Zeit ist knapp. Daraus entstehen
 * die beiden Entscheidungen, die dem Spiel vorher fehlten:
 *
 *   * Sondieren oder zugreifen? Zeit gegen Dietrich.
 *   * Aufhören oder weitermachen? Sicheres Gold gegen Ausrüstung — denn wer
 *     den letzten Dietrich verliert, geht mit leeren Händen.
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

  // Dietriche = erlaubte Fehlgriffe. Drei, weil ein Fehlgriff jetzt nicht mehr
  // nur Pech ist, sondern eine bewusst eingegangene Wette.
  var DIETRICHE = 3;

  // Halbe Breite der Trefferzone als Anteil der Leiste, erster bis letzter
  // Stift. 0,045 heisst ein Fenster von 9 % der Leiste.
  var TOLERANZ_START = 0.045;
  var TOLERANZ_ENDE = 0.020;

  // Wie viel breiter als die Trefferzone ist die feinste Anzeigestufe? DAS ist
  // die Stellschraube des ganzen Spiels: bei 1,0 wäre "es greift" dasselbe wie
  // "Treffer" und alles Können bestünde im Warten. Bei 2,5 hat blindes
  // Zugreifen im greifenden Bereich rund 40 % Erfolg — genug, dass Sondieren
  // sich lohnt, wenig genug, dass Ungeduld nicht bestraft wirkt.
  var STUFE_FAKTOR = 2.5;

  // Die Stufen als Vielfache der Toleranz, grob nach fein. Absichtlich weit
  // gespreizt: von aussen soll man merken, dass man in die richtige Richtung
  // läuft, ohne die Stelle geschenkt zu bekommen.
  var STUFEN = [28, 16, 9, 5, STUFE_FAKTOR];

  // Wie schnell der Dietrich wandert (Anteil der Leiste je Sekunde). 0,42
  // heisst rund 2,4 s für die volle Breite — schnell genug zum Suchen,
  // langsam genug zum Zielen.
  var TEMPO = 0.42;

  // Gesamtzeit fürs Schloss (ms): Grundstock plus Zuschlag je Stift. Ohne Uhr
  // wäre Sondieren gratis und jeder Stift sicher.
  var ZEIT_GRUND = 7000;
  var ZEIT_JE_STIFT = 4200;

  /** Wie viele Stifte hat ein Schloss in dieser Tiefe? */
  function stifteFuerTiefe(tiefe) {
    var t = Math.max(1, tiefe || 1);
    return Math.max(STIFTE_MIN, Math.min(STIFTE_MAX, STIFTE_MIN + Math.floor(t / 8)));
  }

  /** Wie lange darf das ganze Schloss dauern (ms)? */
  function gesamtzeit(anzahl) {
    var n = Math.max(1, anzahl || 1);
    return ZEIT_GRUND + ZEIT_JE_STIFT * n;
  }

  /**
   * Halbe Breite der Trefferzone für Stift `index` von `anzahl`, als Anteil
   * der Leiste. Der erste Stift ist grosszügig, der letzte eng — die Spannung
   * soll steigen, nicht am Anfang stehen.
   */
  function toleranz(index, anzahl) {
    var n = Math.max(1, anzahl || 1);
    if (n <= 1) return TOLERANZ_START;
    var t = Math.max(0, Math.min(n - 1, index || 0)) / (n - 1);
    return TOLERANZ_START + (TOLERANZ_ENDE - TOLERANZ_START) * t;
  }

  /**
   * Wo sitzt der Stift? Nie so nah am Rand, dass die Trefferzone hinausragt —
   * sonst wäre er durch blosses Anfahren des Endanschlags zu finden.
   */
  function zielPosition(tol, rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var rand = Math.max(0, Math.min(0.49, (tol || 0) * 1.5));
    return rand + r() * Math.max(0, 1 - 2 * rand);
  }

  /**
   * Wie stark greift der Dietrich? 0 = nichts zu spüren, 5 = er greift.
   *
   * Die oberste Stufe ist bewusst breiter als die Trefferzone (STUFE_FAKTOR).
   * Wer sie erreicht, weiss, dass der Stift nah ist — aber nicht, wo genau.
   * Die Kanten dieser Zone zu suchen und die Mitte zu nehmen ist das
   * eigentliche Können.
   */
  function widerstandStufe(x, ziel, tol) {
    var t = Math.max(1e-6, tol || 1e-6);
    var d = Math.abs((x || 0) - (ziel || 0)) / t;
    // Von fein nach grob prüfen: die ENGSTE zutreffende Stufe gilt.
    for (var i = STUFEN.length - 1; i >= 0; i--) {
      if (d <= STUFEN[i]) return i + 1;
    }
    return 0;
  }

  /** Sitzt der Dietrich auf dem Stift? Beide Werte als Anteil der Leiste. */
  function istTreffer(x, ziel, tol) {
    return Math.abs((x || 0) - (ziel || 0)) <= (tol || 0);
  }

  /**
   * Ein Bewegungsschritt. `richtung` ist -1, 0 oder 1; `dtMs` die vergangene
   * Zeit. Das Tempo ist konstant — würde es in der Nähe langsamer, verriete
   * schon die Bewegung die Stelle.
   */
  function dietrichSchritt(x, richtung, dtMs) {
    var r = (richtung > 0) ? 1 : (richtung < 0 ? -1 : 0);
    var neu = (x || 0) + r * TEMPO * (Math.max(0, dtMs || 0) / 1000);
    return Math.max(0, Math.min(1, neu));
  }

  /**
   * Was gibt es für `gesetzt` von `anzahl` Stiften?
   *
   * Gestaffelt: alles offen -> Ausrüstung auf Belohnungstruhen-Niveau; teils
   * -> Gold nach Anteil; nichts -> das Schloss klemmt. Wer aber den letzten
   * Dietrich verliert (`verloren`), geht leer aus, egal wie weit er kam —
   * sonst wäre Aufhören nie eine echte Entscheidung.
   *
   * @returns {{art:'item'|'gold'|'nichts', gold:number, iLevel:number, stufe:number}}
   */
  function belohnung(gesetzt, anzahl, tiefe, verloren) {
    var t = Math.max(1, tiefe || 1);
    var n = Math.max(1, anzahl || 1);
    var g = Math.max(0, Math.min(n, gesetzt || 0));
    if (verloren) return { art: 'nichts', gold: 0, iLevel: 0, stufe: 0 };
    if (g >= n) return { art: 'item', gold: 0, iLevel: t + 4, stufe: 2 };
    if (g <= 0) return { art: 'nichts', gold: 0, iLevel: 0, stufe: 0 };
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
   * Eingabe: Pfeiltasten (oder A/D) führen den Dietrich, LEERTASTE setzt den
   * Stift, E hört auf und nimmt das bisher verdiente Gold. Auf der Leiste
   * tippen oder ziehen setzt den Dietrich direkt dorthin — auf dem Handy ist
   * das die eigentliche Steuerung.
   *
   * Die Kampfeingabe wird über window.eventChoiceOpen unterdrückt und die
   * Spieluhr angehalten — sonst greift man beim Setzen an oder wird nebenher
   * totgeschlagen. Die Uhr DIESES Spiels ist deshalb die Wanduhr: die
   * Spieluhr steht ja gerade still. Genau daran ist die erste Fassung
   * gescheitert.
   *
   * @param {Phaser.Scene} scene
   * @param {number} tiefe
   * @param {function} fertig  bekommt { gesetzt, anzahl, geschafft, verloren }
   */
  function spiele(scene, tiefe, fertig) {
    if (!scene || !scene.add) {
      if (fertig) fertig({ gesetzt: 0, anzahl: 0, geschafft: false, verloren: false });
      return null;
    }

    var anzahl = stifteFuerTiefe(tiefe);
    var gesetzt = 0;
    var dietriche = DIETRICHE;
    var beendet = false;
    var elemente = [];
    var tasten = [];
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 960;
    var camH = cam ? cam.height : 480;
    var cx = camW / 2;

    var leisteB = Math.min(440, camW - 120);
    var leisteX = cx - leisteB / 2;
    var leisteY = camH / 2;

    var tol = toleranz(0, anzahl);
    var ziel = zielPosition(tol, Math.random);
    var pos = 0.5;
    var start = Date.now();
    var letzterTick = start;
    var frist = gesamtzeit(anzahl);
    var ruettelBis = 0;

    var halten = function (o) {
      if (o) { o.setScrollFactor(0); o.setDepth(4000); elemente.push(o); }
      return o;
    };

    halten(scene.add.rectangle(cx, camH / 2, camW, camH, 0x000000, 0.7));
    halten(scene.add.text(cx, leisteY - 110, _t('lock.title', 'Kettenschloss'), {
      fontFamily: 'serif', fontSize: '26px', color: '#ffd166', fontStyle: 'bold',
      stroke: '#2a1c00', strokeThickness: 4
    }).setOrigin(0.5));
    halten(scene.add.text(cx, leisteY - 78,
      _t('lock.hint', '← → tasten · Leertaste setzen · E aufhören'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#cfd4dd'
    }).setOrigin(0.5));
    var stand = halten(scene.add.text(cx, leisteY + 84, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
    }).setOrigin(0.5));
    var gfx = halten(scene.add.graphics());

    var standText = function () {
      var stifte = '';
      for (var i = 0; i < anzahl; i++) stifte += (i < gesetzt) ? '●' : '○';
      var picks = '';
      for (var k = 0; k < DIETRICHE; k++) picks += (k < dietriche) ? '†' : '·';
      var rest = Math.max(0, frist - (Date.now() - start));
      stand.setText(_t('lock.status', 'Stifte {stifte}   Dietriche {picks}   {zeit}s')
        .replace('{stifte}', stifte).replace('{picks}', picks)
        .replace('{zeit}', (rest / 1000).toFixed(1)));
    };

    var zeichne = function () {
      var stufe = widerstandStufe(pos, ziel, tol);
      gfx.clear();

      // Das Schloss von der Seite
      gfx.fillStyle(0x1a1620, 0.95);
      gfx.fillRect(leisteX - 6, leisteY - 20, leisteB + 12, 40);
      gfx.fillStyle(0x3a3446, 1);
      gfx.fillRect(leisteX, leisteY - 16, leisteB, 32);
      gfx.fillStyle(0x2a2634, 1);
      for (var k = 1; k < 8; k++) gfx.fillRect(leisteX + (leisteB * k) / 8, leisteY - 16, 1, 32);

      // Der Dietrich. Er zittert, je stärker es greift — dieselbe Auskunft wie
      // die Anzeige, aber dort, wo der Blick ohnehin liegt.
      var ruettel = (Date.now() < ruettelBis) ? (Math.random() - 0.5) * 6 : 0;
      var px = leisteX + pos * leisteB + ruettel;
      var zitter = (stufe >= 4) ? (Math.random() - 0.5) * (stufe - 3) * 1.8 : 0;
      gfx.fillStyle(0xe8e2d4, 1);
      gfx.fillRect(px - 2, leisteY - 30, 4, 52);
      gfx.fillStyle(0x8f7334, 1);
      gfx.fillRect(px - 6, leisteY + 22, 12, 8);
      gfx.fillStyle(stufe >= 5 ? 0xffd166 : 0x6b6478, 1);
      gfx.fillRect(px - 3, leisteY - 34 + zitter, 6, 6);

      // Widerstands-Anzeige: fünf Balken, links grob, rechts fein.
      var bx = cx - 100, by = leisteY + 46, bw = 36, bh = 10;
      for (var i = 0; i < 5; i++) {
        gfx.fillStyle(0x241f2e, 1);
        gfx.fillRect(bx + i * (bw + 5), by, bw, bh);
        if (stufe > i) {
          gfx.fillStyle(i >= 4 ? 0xffd166 : (i >= 2 ? 0xc9a227 : 0x6f7f5a), 1);
          gfx.fillRect(bx + i * (bw + 5), by, bw, bh);
        }
      }

      // Restzeit als schmaler Streifen unter der Leiste.
      var anteil = Math.max(0, 1 - (Date.now() - start) / frist);
      gfx.fillStyle(0x241f2e, 1);
      gfx.fillRect(leisteX, leisteY + 30, leisteB, 5);
      gfx.fillStyle(anteil < 0.25 ? 0xff6b6b : 0x7dffa0, 1);
      gfx.fillRect(leisteX, leisteY + 30, leisteB * anteil, 5);
    };

    var aufraeumen = function () {
      for (var i = 0; i < elemente.length; i++) {
        try { if (elemente[i] && elemente[i].destroy) elemente[i].destroy(); } catch (e) {}
      }
      elemente.length = 0;
      try { scene.events.off('update', tick); } catch (e) {}
      try {
        if (scene.input && scene.input.keyboard) {
          scene.input.keyboard.off('keydown-SPACE', setzen);
          scene.input.keyboard.off('keydown-E', aufhoeren);
          for (var k = 0; k < tasten.length; k++) {
            try { scene.input.keyboard.removeKey(tasten[k]); } catch (e) {}
          }
        }
      } catch (e) {}
      tasten.length = 0;
      try {
        if (scene.input) {
          scene.input.off('pointerdown', zeigen);
          scene.input.off('pointermove', zeigen);
        }
      } catch (e) {}
      window.eventChoiceOpen = false;
      try {
        if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
        else if (scene.physics && scene.physics.world) scene.physics.world.resume();
      } catch (e) {}
    };

    var schliesse = function (geschafft, verloren) {
      if (beendet) return;
      beendet = true;
      aufraeumen();
      if (fertig) {
        fertig({ gesetzt: gesetzt, anzahl: anzahl,
                 geschafft: !!geschafft, verloren: !!verloren });
      }
    };

    var naechsterStift = function () {
      tol = toleranz(gesetzt, anzahl);
      ziel = zielPosition(tol, Math.random);
    };

    var setzen = function () {
      if (beendet) return;
      if (istTreffer(pos, ziel, tol)) {
        gesetzt++;
        try { window.soundManager && window.soundManager.playSFX('pickup'); } catch (e) {}
        standText();
        if (gesetzt >= anzahl) { schliesse(true, false); return; }
        naechsterStift();
      } else {
        dietriche--;
        ruettelBis = Date.now() + 220;
        try { window.soundManager && window.soundManager.playSFX('hit'); } catch (e) {}
        standText();
        // Der Stift bleibt, wo er ist: ein Fehlgriff kostet einen Dietrich,
        // vernichtet aber nicht das schon Ertastete — sonst wäre Sondieren
        // sinnlos.
        if (dietriche <= 0) { schliesse(false, true); return; }
      }
    };

    // Aufhören nimmt das bisher verdiente Gold mit. Vor dem ersten Stift ist
    // das blosses Abbrechen — erlaubt, bringt aber nichts.
    var aufhoeren = function () { schliesse(false, false); };

    // Tippen oder Ziehen auf der Leiste setzt den Dietrich direkt dorthin.
    var zeigen = function (zeiger) {
      if (beendet || !zeiger || !zeiger.isDown) return;
      if (zeiger.y < leisteY - 70 || zeiger.y > leisteY + 70) return;
      pos = Math.max(0, Math.min(1, (zeiger.x - leisteX) / leisteB));
    };

    var tick = function () {
      if (beendet) return;
      var jetzt = Date.now();
      var dt = jetzt - letzterTick;
      letzterTick = jetzt;

      var richtung = 0;
      for (var i = 0; i < tasten.length; i++) {
        if (tasten[i] && tasten[i].isDown) richtung += tasten[i].__richtung;
      }
      if (richtung) pos = dietrichSchritt(pos, richtung, dt);

      if (jetzt - start >= frist) { schliesse(false, false); return; }
      standText();
      zeichne();
    };

    window.eventChoiceOpen = true;
    try {
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
      else if (scene.physics && scene.physics.world) scene.physics.world.pause();
    } catch (e) {}
    // Damit derselbe E-Druck, der das Schloss geöffnet hat, hier nicht sofort
    // als Aufhören zählt (b153: __eventConsumedEAt).
    try { window.__eventConsumedEAt = Date.now(); } catch (e) {}

    standText();
    zeichne();
    scene.events.on('update', tick);
    if (scene.input && scene.input.keyboard) {
      var lege = function (code, richtung) {
        try {
          var taste = scene.input.keyboard.addKey(code);
          if (taste) { taste.__richtung = richtung; tasten.push(taste); }
        } catch (e) {}
      };
      lege('LEFT', -1); lege('A', -1);
      lege('RIGHT', 1); lege('D', 1);
      scene.input.keyboard.on('keydown-SPACE', setzen);
      scene.input.keyboard.on('keydown-E', aufhoeren);
    }
    if (scene.input) {
      scene.input.on('pointerdown', zeigen);
      scene.input.on('pointermove', zeigen);
    }

    // position() ist fuer die Verifikation da: der alte Fehler (der Zeiger
    // bewegte sich nicht, weil er an der angehaltenen Spieluhr hing) war von
    // aussen sonst nicht nachweisbar.
    return {
      setzen: setzen,
      position: function () { return pos; },
      abbrechen: function () { schliesse(false, false); }
    };
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
    TOLERANZ_START: TOLERANZ_START,
    TOLERANZ_ENDE: TOLERANZ_ENDE,
    STUFE_FAKTOR: STUFE_FAKTOR,
    TEMPO: TEMPO,
    stifteFuerTiefe: stifteFuerTiefe,
    gesamtzeit: gesamtzeit,
    toleranz: toleranz,
    zielPosition: zielPosition,
    widerstandStufe: widerstandStufe,
    istTreffer: istTreffer,
    dietrichSchritt: dietrichSchritt,
    belohnung: belohnung,
    spiele: spiele
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.Kettenschloss;
})();
