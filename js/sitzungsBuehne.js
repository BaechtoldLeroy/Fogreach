// js/sitzungsBuehne.js — gemalte Buehne fuer die beiden Ratssitzungen (#166, #167).
//
// Die oeffentliche Sitzung (Ratssaal, laut, drei Pulte vor den Buergern) und
// die geheime (Ratskammer bei Nacht, dieselben drei an einem Tisch unter dem
// Siegel des Schattenrats) sind ein Paar: der Kontrast IST die Aussage. Statt
// gezeichneter Kaesten stehen hier PixelLab-Bilder, die Sprecher sind sichtbar,
// und wer gerade redet, tritt aus dem Halbdunkel.
//
// Vorerst nur hinter der Debug-Flagge `sitzung` (?debug=1&sitzung=neu). Ohne
// Flagge bleibt alles, wie es war — storyScenes fragt aktiv() und faellt sonst
// auf den alten Weg zurueck. Mit sitzung=oeffentlich bzw. sitzung=geheim
// spielt die Szene zusaetzlich gleich nach dem Betreten des Hubs (Vorschau).
//
// Der Text der Szenen bleibt unberuehrt: die Buehne LIEST nur mit, was gerade
// auf dem Bildschirm steht, und hebt danach den Sprecher hervor.
(function () {
  'use strict';

  var PFAD = 'assets/sitzung/';
  var FIGUREN = ['aldric', 'klerus', 'garde'];
  // Wer spricht, steht als Kuerzel vor dem Satz. Magistrat = Aldric.
  var SPRECHER = {
    ALDRIC: 'aldric', MAGISTRAT: 'aldric', MAGISTRATE: 'aldric',
    KLERUS: 'klerus', CLERGY: 'klerus',
    GARDE: 'garde', GUARD: 'garde'
  };
  var DUNKEL = 0x5a5a68;   // Tönung der Schweigenden

  function aktiv() {
    return !!(window.DebugGate && typeof window.DebugGate.an === 'function' && window.DebugGate.an('sitzung'));
  }


  /**
   * Wer spricht gerade? Massgeblich ist der LETZTE Absatz des bisher
   * geschriebenen Textes: beginnt er mit "NAME:", spricht NAME; beginnt er
   * mit einer Klammer, erzaehlt die Szene, und niemand ist hervorgehoben.
   */
  function sprecherAus(text) {
    var absaetze = String(text || '').split(/\n\s*\n/).filter(function (a) { return a.trim(); });
    if (!absaetze.length) return null;
    var m = /^\s*([A-ZÄÖÜ][A-ZÄÖÜ ]+):/.exec(absaetze[absaetze.length - 1]);
    return m ? (SPRECHER[m[1].trim()] || null) : null;
  }

  /**
   * Laedt die Bilder der Buehne nach, falls die Szene sie noch nicht hat.
   * Der Ratssaal spielt im Hub, die Kammer im Dungeon — beide sollen sie nicht
   * beim Start mitschleppen, solange die Buehne nur hinter der Flagge haengt.
   */
  function laden(scene, fertig) {
    var tex = scene && scene.textures;
    var ld = scene && scene.load;
    var fehlt = 0;
    var fertigEinmal = function () { if (fertig) { var f = fertig; fertig = null; f(); } };
    if (!tex || !ld) { fertigEinmal(); return; }
    var bild = function (key, datei) {
      if (tex.exists(key)) return;
      ld.image(key, PFAD + datei); fehlt++;
    };
    bild('sitzung_saal', 'saal.png');
    bild('sitzung_kammer', 'kammer.png');
    bild('sitzung_tisch', 'tisch.png');
    bild('sitzung_menge', 'menge.png');
    ['magistrat', 'klerus', 'garde'].forEach(function (p) { bild('sitzung_pult_' + p, 'pult_' + p + '.png'); });
    FIGUREN.forEach(function (n) {
      if (tex.exists('sitzung_' + n)) return;
      ld.spritesheet('sitzung_' + n, PFAD + n + '_atem.png', { frameWidth: 64, frameHeight: 64 }); fehlt++;
    });
    if (!fehlt) { fertigEinmal(); return; }
    ld.once('complete', fertigEinmal);
    ld.start();
  }

  // --- Bausteine ----------------------------------------------------------

  function _bild(scene, teile, key, x, y, tiefe) {
    if (!scene.textures.exists(key)) return null;
    var o = scene.add.image(x, y, key).setScrollFactor(0).setDepth(tiefe);
    teile.push(o);
    return o;
  }

  // Eine Figur, die atmet: die PixelLab-Schleife, falls geladen.
  function _figur(scene, teile, name, x, fussY, massstab, tiefe) {
    var key = 'sitzung_' + name;
    if (!scene.textures.exists(key)) return null;
    var s = scene.add.sprite(x, fussY, key, 0).setOrigin(0.5, 1).setScale(massstab)
      .setScrollFactor(0).setDepth(tiefe);
    var animKey = key + '_atmen';
    if (scene.anims && !scene.anims.exists(animKey) && scene.textures.get(key).frameTotal > 2) {
      scene.anims.create({ key: animKey, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 4, repeat: -1, yoyo: true });
    }
    // Versetzt anfangen, damit die drei nicht im Gleichschritt atmen.
    if (scene.anims && scene.anims.exists(animKey)) s.play({ key: animKey, startFrame: FIGUREN.indexOf(name) % 4 });
    s.__basis = { x: x, y: fussY, m: massstab };
    s.__name = name;
    teile.push(s);
    return s;
  }

  // Ein warmer Lichtschein, der flackert. Gezeichnet statt geladen: es sind
  // nur ein paar Kreise, und so passt er an jede Kerze im Bild.
  function _flamme(scene, teile, x, y, radius, tiefe) {
    var g = scene.add.graphics().setScrollFactor(0).setDepth(tiefe);
    g.setPosition(x, y);
    [[1, 0.06], [0.7, 0.08], [0.4, 0.12], [0.18, 0.22]].forEach(function (r) {
      g.fillStyle(0xffb35a, r[1]); g.fillCircle(0, 0, radius * r[0]);
    });
    if (g.setBlendMode && window.Phaser) g.setBlendMode(window.Phaser.BlendModes.ADD);
    if (scene.tweens) {
      scene.tweens.add({ targets: g, alpha: { from: 1, to: 0.55 }, scale: { from: 1, to: 0.9 },
        duration: 140 + Math.floor(Math.random() * 160), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Math.floor(Math.random() * 200) });
    }
    teile.push(g);
    return g;
  }

  // Nebelbaenke, die langsam durch den Raum ziehen.
  function _nebel(scene, teile, w, y, hoehe, tiefe, staerke) {
    for (var i = 0; i < 3; i++) {
      var g = scene.add.graphics().setScrollFactor(0).setDepth(tiefe);
      for (var k = 0; k < 7; k++) {
        g.fillStyle(0xa8b0bc, staerke);
        g.fillEllipse(k * w / 6 - w / 2, (k % 2) * hoehe * 0.3, w * 0.32, hoehe);
      }
      g.setPosition(w / 2 + (i - 1) * 120, y + i * hoehe * 0.35);
      if (scene.tweens) {
        scene.tweens.add({ targets: g, x: g.x + (i % 2 ? -90 : 90), duration: 9000 + i * 2500,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      teile.push(g);
    }
  }

  // Ein warmer Schein hinter dem, der spricht. Unsichtbar, solange erzaehlt wird.
  function _lichtkegel(scene, teile, y, tiefe) {
    var g = scene.add.graphics().setScrollFactor(0).setDepth(tiefe);
    g.setPosition(scene.cameras.main.width / 2, y);
    [[110, 0.05], [80, 0.07], [55, 0.09]].forEach(function (r) {
      g.fillStyle(0xffd08a, r[1]); g.fillEllipse(0, 0, r[0] * 1.3, r[0] * 2);
    });
    if (g.setBlendMode && window.Phaser) g.setBlendMode(window.Phaser.BlendModes.ADD);
    g.setAlpha(0);
    teile.push(g);
    return g;
  }

  /**
   * Haengt die Buehne an den Text: jeden Frame wird nachgesehen, was dasteht,
   * und der Sprecher tritt hervor. Bei Erzaehlung stehen alle gleich im Licht.
   */
  function _sprecherFolgen(scene, figuren, liefereText, licht) {
    var zuletzt;
    var setze = function (wer) {
      if (licht && licht.scene) {
        var ziel = figuren.filter(function (f) { return f && f.__name === wer; })[0];
        if (scene.tweens) scene.tweens.killTweensOf(licht);
        if (ziel && scene.tweens) scene.tweens.add({ targets: licht, x: ziel.__basis.x, alpha: 1, duration: 320, ease: 'Sine.easeOut' });
        else if (ziel) licht.setPosition(ziel.__basis.x, licht.y).setAlpha(1);
        else if (scene.tweens) scene.tweens.add({ targets: licht, alpha: 0, duration: 320 });
        else licht.setAlpha(0);
      }
      figuren.forEach(function (f) {
        if (!f || !f.scene) return;
        var b = f.__basis;
        var spricht = (wer === f.__name);
        var still = (wer && !spricht);
        if (still) f.setTint(DUNKEL); else f.clearTint();
        if (scene.tweens) {
          scene.tweens.killTweensOf(f);
          scene.tweens.add({ targets: f, scale: b.m * (spricht ? 1.1 : 1), y: b.y + (spricht ? 6 : 0),
            alpha: still ? 0.8 : 1, duration: 260, ease: 'Sine.easeOut' });
        } else {
          f.setScale(b.m * (spricht ? 1.1 : 1)).setY(b.y + (spricht ? 6 : 0)).setAlpha(still ? 0.8 : 1);
        }
      });
    };
    var beiUpdate = function () {
      var t = liefereText();
      if (t == null) return;
      var wer = sprecherAus(t);
      if (wer === zuletzt) return;
      zuletzt = wer;
      buehne.sprecher = wer;
      setze(wer);
    };
    var buehne = { sprecher: null, pruefen: beiUpdate };
    if (scene.events && typeof scene.events.on === 'function') scene.events.on('update', beiUpdate);
    buehne.loesen = function () {
      try { scene.events.off('update', beiUpdate); } catch (e) {}
    };
    return buehne;
  }

  function _abbau(scene, teile, folgen) {
    return function () {
      if (folgen && folgen.loesen) folgen.loesen();
      teile.forEach(function (o) {
        try { if (scene.tweens) scene.tweens.killTweensOf(o); } catch (e) {}
        if (o && o.destroy) o.destroy();
      });
      teile.length = 0;
    };
  }

  // --- Der Ratssaal ---------------------------------------------------------

  /**
   * Die oeffentliche Sitzung: Tribuene mit drei Pulten, davor die Menge von
   * hinten. Unten eine Tafel fuer den Text. Gibt ein Objekt mit destroy()
   * zurueck (passt damit in die Kulissen-Liste von storyScenes) und folgen(),
   * das den Text zum Mitlesen anhaengt.
   */
  function oeffentlich(scene) {
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var teile = [];
    var T = 1530;   // unter dem Text (1550), wie die alte Kulisse
    var schwarz = scene.add.rectangle(w / 2, h / 2, w, h, 0x050407, 1).setScrollFactor(0).setDepth(T);
    teile.push(schwarz);
    // Das Gewoelbe oben ist verzichtbar; die Tribuene soll ins obere Drittel.
    // Das Gewoelbe oben ist verzichtbar; die Tribuene soll ins obere Drittel.
    var hoch = 140;
    var bg = _bild(scene, teile, 'sitzung_saal', w / 2, h / 2 - hoch, T + 1);
    if (bg) bg.setDisplaySize(w, h);
    // Kronleuchter und Wandlampen im Bild flackern mit (Bildkoordinaten x2).
    [[120, 40], [338, 40], [152, 76], [180, 98], [300, 98], [322, 76], [34, 104], [446, 104], [98, 120], [384, 120]]
      .forEach(function (p) { _flamme(scene, teile, p[0] * w / 480, p[1] * 2 - hoch, 26, T + 2); });
    _nebel(scene, teile, w, 150, 60, T + 3, 0.05);

    var fussY = 192;
    var licht = _lichtkegel(scene, teile, fussY - 70, T + 3);
    var figuren = [];
    var pulte = ['klerus', 'magistrat', 'garde'];
    for (var i = 0; i < 3; i++) {
      var px = w / 2 + (i - 1) * 190;
      figuren.push(_figur(scene, teile, pulte[i] === 'magistrat' ? 'aldric' : pulte[i], px, fussY - 30, 2.2, T + 4));
      var pult = _bild(scene, teile, 'sitzung_pult_' + pulte[i], px, fussY, T + 6);
      if (pult) pult.setOrigin(0.5, 1).setScale(1.25);
    }
    figuren = figuren.filter(Boolean);

    // Die Menge, von hinten: sie wogt, als riefe sie durcheinander.
    var menge = _bild(scene, teile, 'sitzung_menge', w / 2, 300, T + 7);
    if (menge) {
      menge.setOrigin(0.5, 1).setDisplaySize(w + 40, 190);
      if (scene.tweens) scene.tweens.add({ targets: menge, y: menge.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Die Texttafel: dunkles Pergament mit Messingkante.
    var tafelY = 232;
    var tafel = scene.add.graphics().setScrollFactor(0).setDepth(T + 8);
    tafel.fillStyle(0x07060a, 0.93); tafel.fillRect(0, tafelY, w, h - tafelY);
    tafel.fillStyle(0x8a6a3a, 1); tafel.fillRect(0, tafelY, w, 2);
    tafel.fillStyle(0x3a2c1a, 1); tafel.fillRect(0, tafelY + 2, w, 1);
    teile.push(tafel);

    var folgen = null;
    var buehne = {
      teile: teile, figuren: figuren,
      textY: tafelY + 10, textBreite: w - 60, hinweisX: w - 70, hinweisY: h - 12,
      folgen: function (textObj) {
        folgen = _sprecherFolgen(scene, figuren, function () { return (textObj && textObj.scene) ? textObj.text : null; }, licht);
        buehne.mitleser = folgen;
        return folgen;
      },
      destroy: null
    };
    buehne.destroy = function () { _abbau(scene, teile, folgen)(); };
    return buehne;
  }

  // --- Die Ratskammer bei Nacht ----------------------------------------------

  /**
   * Die geheime Sitzung: dieselben drei an einem Tisch, ueber ihnen das
   * Siegel. Auf dem Blatt die drei Siegel mit dem Zeichen (#156). Liegt unter
   * dem Dialog von EventSystem (Tiefe 2500+), der die Seiten weiterhin zeigt.
   */
  function geheim(scene) {
    var cam = scene.cameras.main;
    var w = cam.width, h = cam.height;
    var teile = [];
    var T = 2480;
    teile.push(scene.add.rectangle(w / 2, h / 2, w, h, 0x030205, 1).setScrollFactor(0).setDepth(T));
    var hoch = 60;
    var bg = _bild(scene, teile, 'sitzung_kammer', w / 2, h / 2 - hoch, T + 1);
    if (bg) bg.setDisplaySize(w, h);
    // Die Kerzen der Leuchter im Bild (Bildkoordinaten x2).
    [[24, 118], [42, 112], [58, 118], [134, 124], [146, 120], [334, 124], [346, 120], [446, 118], [462, 112], [476, 118]]
      .forEach(function (p) { _flamme(scene, teile, p[0] * w / 480, p[1] * 2 - hoch, 18, T + 2); });
    _nebel(scene, teile, w, 260, 50, T + 3, 0.04);

    // Die drei hinter dem Tisch; ueber Aldric haengt das Siegel an der Wand.
    var fussY = 272;
    var licht = _lichtkegel(scene, teile, fussY - 90, T + 3);
    var figuren = [
      _figur(scene, teile, 'klerus', w / 2 - 160, fussY, 2.1, T + 4),
      _figur(scene, teile, 'aldric', w / 2, fussY, 2.1, T + 4),
      _figur(scene, teile, 'garde', w / 2 + 160, fussY, 2.1, T + 4)
    ].filter(Boolean);

    // Der Tisch: Bildzeile 45 ist die Tischplatte.
    var M = 1.7, platteY = 236;
    var tisch = _bild(scene, teile, 'sitzung_tisch', w / 2, platteY, T + 6);
    if (tisch) tisch.setOrigin(0.5, 45 / 96).setScale(M);
    // Die Kerzen auf dem Tisch (Bildspalten 80, 90, 230, 240; Flammen in Zeile 20).
    [80, 90, 230, 240].forEach(function (x) {
      _flamme(scene, teile, w / 2 + (x - 160) * M, platteY + (20 - 45) * M, 26, T + 7);
    });
    // Das Blatt mit den drei Siegeln: auf jedem dasselbe Zeichen.
    if (window.Zeichen && typeof window.Zeichen.bild === 'function') {
      for (var k = 0; k < 3; k++) {
        var z = null;
        try { z = window.Zeichen.bild(scene, w / 2 + (157 - 160) * M + (k - 1) * 30, platteY + 2 * M, 16); } catch (e) { z = null; }
        if (z) {
          z.setScrollFactor(0).setDepth(T + 8).setTint(0xb83a2a);
          teile.push(z);
        }
      }
    }

    // Unten Platz fuer den Dialog: dunkler Verlauf, damit er lesbar bleibt.
    var tafelY = 308;
    var tafel = scene.add.graphics().setScrollFactor(0).setDepth(T + 9);
    for (var s = 0; s < 8; s++) {
      tafel.fillStyle(0x030205, 0.12 * (s + 1));
      tafel.fillRect(0, tafelY - 16 + s * 2, w, 2);
    }
    tafel.fillStyle(0x030205, 0.92); tafel.fillRect(0, tafelY, w, h - tafelY);
    teile.push(tafel);

    var folgen = null;
    var buehne = {
      teile: teile, figuren: figuren, textOben: tafelY - 4,
      folgen: function (textObj) {
        if (folgen) folgen.loesen();
        folgen = _sprecherFolgen(scene, figuren, function () { return (textObj && textObj.scene) ? textObj.text : null; }, licht);
        buehne.mitleser = folgen;
        return folgen;
      },
      destroy: null
    };
    buehne.destroy = function () { _abbau(scene, teile, folgen)(); };
    return buehne;
  }

  /**
   * Schiebt einen eben geoeffneten EventSystem-Dialog unter die Buehne.
   *
   * Der Dialog zentriert sich auf dem Bildschirm und laege sonst genau ueber
   * den drei Figuren. Er wird als Ganzes nach unten geschoben — Text und
   * Knoepfe zusammen, damit seine eigene Ausrichtung erhalten bleibt — und
   * seine Abdunklung wird fast durchsichtig, weil die Buehne selbst dunkel ist.
   * Gibt das Titel-Textobjekt zurueck (fuer das Mitlesen).
   */
  function dialogUnterBuehne(scene, neue, oben) {
    var cam = scene.cameras.main;
    var titel = null, minY = Infinity, maxY = -Infinity;
    neue.forEach(function (o) {
      if (!o || typeof o.getBounds !== 'function') return;
      if (o.type === 'Rectangle' && o.width >= cam.width) { o.setAlpha(0.15); return; }
      if (o.type === 'Text' && !titel) titel = o;
      var b = o.getBounds();
      minY = Math.min(minY, b.top); maxY = Math.max(maxY, b.bottom);
    });
    if (minY === Infinity) return titel;
    var dy = Math.min(oben - minY, cam.height - 8 - maxY);
    if (dy > 0) {
      neue.forEach(function (o) {
        if (!o || (o.type === 'Rectangle' && o.width >= cam.width)) return;
        if (typeof o.y === 'number') o.y += dy;
      });
    }
    return titel;
  }

  /**
   * Debug-Vorschau: sitzung=oeffentlich / sitzung=geheim spielt die Szene
   * direkt nach dem Betreten des Hubs, damit man sie ohne Spielstand sieht.
   * Einmal pro Seitenaufruf.
   */
  var _vorschauGespielt = false;
  function vorschau(scene) {
    if (_vorschauGespielt || !aktiv()) return false;
    var art = window.DebugGate.flagge('sitzung');
    var S = window.storyScenes;
    if (!S || (art !== 'oeffentlich' && art !== 'geheim')) return false;
    _vorschauGespielt = true;
    // Die Begruessungstafel eines frischen Spiels laege sonst ueber der Szene.
    try { (window.SlotStorage || window.localStorage).setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    var los = function () {
      if (art === 'oeffentlich') S.playOeffentlicheSitzung(scene, function () {});
      else S.playGeheimeSitzung(scene, function () {});
    };
    if (scene.time && typeof scene.time.delayedCall === 'function') scene.time.delayedCall(600, los);
    else los();
    return true;
  }

  window.SitzungsBuehne = {
    aktiv: aktiv, laden: laden, sprecherAus: sprecherAus,
    oeffentlich: oeffentlich, geheim: geheim,
    dialogUnterBuehne: dialogUnterBuehne, vorschau: vorschau
  };
})();
