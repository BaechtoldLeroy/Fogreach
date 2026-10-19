/* =====================================================================
 * ladeBildschirm.js — Ladebildschirm im Messing-Stil des Startmenues
 * ---------------------------------------------------------------------
 * Dunkler Grund mit Nebel und Vignette, oben der Messing-Schriftzug
 * "Fogreach", darunter die Laterne des Archivschmieds und eine
 * Messingleiste mit warm gluehender Fuellung, dazu Status und Prozent in
 * der Serifenschrift des Menues.
 *
 * Das Problem: Waehrend des ersten Ladens sind die Bilder des Startmenues
 * selbst noch nicht da. Darum laedt StartScene die vier kleinen Bilder
 * dieses Bildschirms (PACK, zusammen rund 17 KB) ueber ihren Szenen-`pack`
 * VOR preload(). Fehlt davon auch nur eines (Laden gescheitert), zeichnet
 * der Bildschirm den schlichten Rueckfall: Schriftzug als Text, Leiste als
 * gezeichneter Rahmen — in denselben Farben und derselben Schrift.
 *
 * Den Dateinamen zeigt er bewusst NICHT mehr: der wechselte zu schnell, um
 * ihn zu lesen, und sagte Spielern nichts. Wer wissen will, was laedt,
 * sieht es in der Konsole/Netzwerkansicht.
 *
 * Hub und Keller laden beim ersten Betreten ebenfalls dutzende Bilder und
 * zeigten bis dahin nur Schwarz. Dort erscheint derselbe Bildschirm, aber
 * erst nach einer kurzen Verzoegerung: schnelle Ladungen (Wiederbetreten,
 * alles im Speicher) sollen nicht aufblitzen.
 *
 * Ein- und Ausblenden laufen im update der Szene statt ueber Tweens oder
 * scene.time: der Keller haelt seine Uhr an (Dialoge), und ein stehender
 * Tween liesse den Bildschirm halb durchsichtig ueber dem Spiel haengen.
 * ===================================================================== */
(function () {
  'use strict';

  // Die Bilder, die StartScene vor preload() laedt (Szenen-pack).
  var PACK = [
    { type: 'spritesheet', key: 'start_titel', url: 'assets/start/start_titel.png', frameConfig: { frameWidth: 199, frameHeight: 40 } },
    { type: 'spritesheet', key: 'start_laterne', url: 'assets/start/start_laterne.png', frameConfig: { frameWidth: 32, frameHeight: 64 } },
    { type: 'image', key: 'start_nebel_b', url: 'assets/start/start_nebel_b.png' },
    { type: 'image', key: 'ui_leiste', url: 'assets/ui/ui_leiste.png' }
  ];
  var PACK_KEYS = PACK.map(function (f) { return f.key; });

  var TIEFE = 20000;          // ueber allem, auch ueber HUD und Dialogen
  var PX = 2;                 // Pixelmassstab wie im Startmenue
  var EINBLENDEN_MS = 200;
  var AUSBLENDEN_MS = 400;

  // Masse der Leiste und ihr Innenraum (Messingrand der gebackenen Leiste).
  var LEISTE_B = 440, LEISTE_H = 36, LEISTE_RAND = 7;

  var FARBE = {
    grund: 0x0b0910,
    titel: '#e8c37a',           // Rueckfall-Schriftzug
    status: '#f0dcae',
    prozent: '#cdb78c',
    kontur: '#0b0910',
    rille: 0x120c08,            // leerer Innenraum der Leiste
    messing: 0x9a7740,          // Rueckfall-Rahmen
    glut: [0x8a3e12, 0xc4621e, 0xe8892e, 0xffcf7a]   // unten -> oben
  };

  if (window.i18n) {
    window.i18n.register('de', {
      'start.loading': 'Die Stadt erwacht im Nebel …',
      'start.loading_hub': 'Hinaus in die Stadt …',
      'start.loading_dungeon': 'Hinab in den Rathauskeller …'
    });
    window.i18n.register('en', {
      'start.loading': 'The city wakes in the fog …',
      'start.loading_hub': 'Out into the city …',
      'start.loading_dungeon': 'Down into the Town Hall Cellar …'
    });
  }
  function T(key) { return window.i18n ? window.i18n.t(key) : key; }

  function bilderDa(scene) {
    return PACK_KEYS.every(function (k) { return scene.textures.exists(k); });
  }

  // Weicher Lichtfleck bzw. Vignette als Canvas-Textur (einmal je Spiel).
  // Gezeichnet statt geladen: die Vignette des Menues wiegt 31 KB.
  function verlauf(scene, key, w, h, innen, aussen) {
    if (scene.textures.exists(key)) return key;
    var ct = scene.textures.createCanvas(key, w, h);
    if (!ct) return null;
    var ctx = ct.getContext();
    var r = Math.max(w, h) / 2;
    var g = ctx.createRadialGradient(w / 2, h / 2, r * innen[0], w / 2, h / 2, r);
    g.addColorStop(0, innen[1]);
    g.addColorStop(1, aussen);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ct.refresh();
    return key;
  }

  /**
   * Baut den Ladebildschirm in scene (im preload aufrufen) und haengt ihn an
   * die Loader-Ereignisse. Nach create() blendet er sich selbst aus.
   * @param {object} [opts] status: i18n-Schluessel; verzoegerung: ms bis zum Einblenden
   * @returns {object} Griff (auch als scene.ladeBildschirm)
   */
  function zeigen(scene, opts) {
    opts = opts || {};
    if (scene.ladeBildschirm && scene.ladeBildschirm.container) scene.ladeBildschirm.abraeumen();
    var cw = scene.cameras.main.width, ch = scene.cameras.main.height, cx = cw / 2;
    var voll = bilderDa(scene) && !!(window.uiRahmen && window.uiRahmen.leisteBild);
    var c = scene.add.container(0, 0).setDepth(TIEFE).setScrollFactor(0);
    var h = { container: c, voll: voll, wert: 0, fuellBreite: 0 };

    c.add(scene.add.rectangle(0, 0, cw, ch, FARBE.grund, 1).setOrigin(0));

    // Nebel zieht in zwei Baendern langsam durchs Bild.
    h.nebel = [];
    if (voll) {
      h.nebel.push({ ts: scene.add.tileSprite(0, ch * 0.30, cw / PX, 60, 'start_nebel_b').setOrigin(0).setScale(PX).setAlpha(0.22), tempo: 4 });
      h.nebel.push({ ts: scene.add.tileSprite(0, ch - 130, cw / PX, 60, 'start_nebel_b').setOrigin(0).setScale(PX).setAlpha(0.4), tempo: 9 });
      h.nebel[1].ts.tilePositionX = 170;
      h.nebel.forEach(function (n) { c.add(n.ts); });
    }

    // Warmer Schein hinter der Laterne (und am Kopf der Fuellung). Ohne
    // Laterne (Rueckfall) kein Schein: ein Lichtfleck aus dem Nichts.
    var glut = verlauf(scene, 'lade_glut', 64, 64, [0, 'rgba(255,176,90,0.85)'], 'rgba(255,120,40,0)');
    var laterneY = 228;
    if (glut && voll) {
      h.schein = scene.add.image(cx, laterneY - 10, glut).setScale(3.2).setAlpha(0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
      c.add(h.schein);
    }
    var vig = verlauf(scene, 'lade_vignette', 480, 240, [0.35, 'rgba(11,9,16,0)'], 'rgba(3,2,6,0.92)');
    if (vig) c.add(scene.add.image(0, 0, vig).setOrigin(0).setScale(PX));

    // Schriftzug: das Messingbild des Menues, sonst derselbe Name als Text.
    if (voll) {
      h.titel = scene.add.sprite(cx, 104, 'start_titel', 0).setScale(PX);
    } else {
      h.titel = scene.add.text(cx, 104, 'Fogreach', {
        fontFamily: 'serif', fontSize: '60px', fontStyle: 'bold', color: FARBE.titel,
        stroke: FARBE.kontur, strokeThickness: 6
      }).setOrigin(0.5);
    }
    c.add(h.titel);

    // Die Laterne steht still; nur ihr Schein atmet (siehe update).
    if (voll) {
      h.laterne = scene.add.sprite(cx, laterneY, 'start_laterne', 0).setScale(PX);
      c.add(h.laterne);
    }

    // Leiste: gebackener Messing-Neunteiler, sonst ein gezeichneter Rahmen.
    var lx = cx - LEISTE_B / 2, ly = 330 - LEISTE_H / 2;
    if (voll) {
      h.rahmen = scene.add.image(cx, 330, window.uiRahmen.leisteBild(scene, LEISTE_B, LEISTE_H));
    } else {
      h.rahmen = scene.add.graphics();
      h.rahmen.fillStyle(FARBE.rille, 1).fillRect(lx, ly, LEISTE_B, LEISTE_H);
      h.rahmen.lineStyle(3, FARBE.messing, 1).strokeRect(lx + 1.5, ly + 1.5, LEISTE_B - 3, LEISTE_H - 3);
    }
    c.add(h.rahmen);
    var ix = lx + LEISTE_RAND, iy = ly + LEISTE_RAND;
    var iw = LEISTE_B - 2 * LEISTE_RAND, ih = LEISTE_H - 2 * LEISTE_RAND;
    h.innen = { x: ix, y: iy, w: iw, h: ih };
    h.fuellung = scene.add.graphics();
    c.add(h.fuellung);
    if (glut) {
      h.kopf = scene.add.image(ix, iy + ih / 2, glut).setScale(0.9, 0.7).setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      c.add(h.kopf);
    }

    h.status = scene.add.text(cx, 384, T(opts.status || 'start.loading'), {
      fontFamily: 'serif', fontSize: '28px', fontStyle: 'bold', color: FARBE.status,
      stroke: FARBE.kontur, strokeThickness: 5
    }).setOrigin(0.5);
    h.prozent = scene.add.text(cx, 420, '0 %', {
      fontFamily: 'serif', fontSize: '22px', color: FARBE.prozent,
      stroke: FARBE.kontur, strokeThickness: 4
    }).setOrigin(0.5);
    c.add([h.status, h.prozent]);

    /** Fortschritt 0..1 zeigen: die Glut fuellt die Leiste von links. */
    h.setzen = function (wert) {
      wert = Math.max(0, Math.min(1, Number(wert) || 0));
      h.wert = wert;
      h.fuellBreite = Math.round(iw * wert);
      var g = h.fuellung.clear();
      if (h.fuellBreite > 0) {
        // Vier Baender von dunkler Glut unten bis hellem Saum oben —
        // Graphics kennt im Canvas-Renderer keine Verlaeufe.
        var b = ih / 4;
        for (var i = 0; i < 4; i++) {
          g.fillStyle(FARBE.glut[i], 1).fillRect(ix, iy + ih - (i + 1) * b, h.fuellBreite, b);
        }
        g.fillStyle(0xfff0c8, 1).fillRect(ix + h.fuellBreite - 2, iy, 2, ih);
      }
      if (h.kopf) h.kopf.setX(ix + h.fuellBreite).setAlpha(wert > 0 && wert < 1 ? 0.8 : 0);
      h.prozent.setText(Math.round(wert * 100) + ' %');
    };
    h.setzen(0);

    // Schnelle Ladungen sollen nicht aufblitzen: erst nach der Verzoegerung einblenden.
    var verz = opts.verzoegerung || 0;
    c.setAlpha(verz > 0 ? 0 : 1);
    var zeit = 0, aus = null;

    function weiter(t, dt) {
      dt = Math.min(dt || 0, 100);
      zeit += dt;
      h.nebel.forEach(function (n) { n.ts.tilePositionX += n.tempo * dt / 1000; });
      if (h.schein) h.schein.setAlpha(0.5 + 0.12 * Math.sin(zeit / 650));
      if (aus !== null) {
        aus += dt;
        c.setAlpha(Math.max(0, h.alphaVorAus * (1 - aus / AUSBLENDEN_MS)));
        if (aus >= AUSBLENDEN_MS) h.abraeumen();
      } else if (zeit > verz && c.alpha < 1) {
        c.setAlpha(Math.min(1, (zeit - verz) / EINBLENDEN_MS));
      }
    }
    function fortschritt(wert) { h.setzen(wert); }

    /** Weich ausblenden; war er nie zu sehen, sofort weg. */
    h.abblenden = function () {
      if (!h.container || aus !== null) return;
      if (c.alpha < 0.05) { h.abraeumen(); return; }
      h.alphaVorAus = c.alpha;
      aus = 0;
    };
    h.abraeumen = function () {
      if (!h.container) return;
      scene.load.off('progress', fortschritt);
      scene.events.off('update', weiter);
      scene.events.off('create', h.abblenden);
      scene.events.off('shutdown', h.abraeumen);
      c.destroy();
      h.container = null;
      if (scene.ladeBildschirm === h) scene.ladeBildschirm = null;
    };

    scene.load.on('progress', fortschritt);
    scene.events.on('update', weiter);
    // create kommt nach dem Laden — auch dann, wenn gar nichts zu laden war
    // (dann feuert der Loader kein 'complete').
    scene.events.once('create', h.abblenden);
    scene.events.once('shutdown', h.abraeumen);
    scene.ladeBildschirm = h;
    return h;
  }

  window.Ladebildschirm = { PACK: PACK, PACK_KEYS: PACK_KEYS, zeigen: zeigen, bilderDa: bilderDa };
})();
