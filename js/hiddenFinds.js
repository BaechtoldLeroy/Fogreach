/* =====================================================================
 * hiddenFinds.js — Funde abseits des Wegs (#113)
 * ---------------------------------------------------------------------
 * Der schnellste Weg durch einen Raum war auch der beste: von der Tuer zur
 * Treppe, fertig. In eine Seitenkammer zu gehen kostete Zeit und brachte
 * nichts — Erkundung war damit reine Zeitkosten, und die grossen Raumlayouts
 * blieben Kulisse.
 *
 * Ein verborgener Fund ist das Gegenangebot. Der Kern ist NICHT das Objekt
 * (das kann eventSystem.spawnEventObject) sondern die PLATZIERUNG: er muss
 * dort liegen, wo man beim Durchqueren nicht vorbeikommt.
 *
 * Deshalb ist `abseitsWert` hier die eigentliche Arbeit und rein gehalten:
 * ohne Phaser, ohne Szene, ohne Zufall — und damit pruefbar. Was ein Fund
 * hergibt, entscheidet der Aufrufer.
 * ===================================================================== */
(function () {
  'use strict';

  // Die Texte gehoerten frueher als Rueckfall in den Aufrufer — im Spiel stand
  // deshalb "[E] [MISSING:find.nische.label]" auf dem Schirm: i18n.t liefert
  // bei unbekanntem Schluessel diese Markierung zurueck, nicht den Schluessel,
  // und der Rueckfall griff nie. Registrierte Schluessel statt Rueckfall.
  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'find.nische.label':     'Lose Steine',
      'find.nische.material':  'Hinter den Steinen: {n} Eisenbrocken.',
      'find.nische.fragment':  'Hinter den Steinen: ein Wissensfragment.',
      'find.nische.beute':     'Hinter den Steinen lag etwas.',
      'find.nische.leer':      'Hinter den Steinen: nichts als Staub.',
      'find.lager.label':      'Verlassenes Lager',
      'find.lager.rast':       'Du rastest kurz. {n} Leben zurueck.',
      'find.lager.voll':       'Nichts zu heilen — du gehst weiter.',
      'find.falle.label':      'Zurueckgelassener Beutel',
      'find.falle.zuschnappt': 'Ein Hinterhalt! Aber der Beutel ist voll.',
      'find.durchgang.toast':  'Der Schutt gibt nach — dahinter liegt eine Kammer.'
    });
    window.i18n.register('en', {
      'find.nische.label':     'Loose Stones',
      'find.nische.material':  'Behind the stones: {n} iron chunks.',
      'find.nische.fragment':  'Behind the stones: a knowledge fragment.',
      'find.nische.beute':     'Something lay behind the stones.',
      'find.nische.leer':      'Behind the stones: nothing but dust.',
      'find.lager.label':      'Abandoned Camp',
      'find.lager.rast':       'You rest a moment. {n} health back.',
      'find.lager.voll':       'Nothing to heal — you move on.',
      'find.falle.label':      'Abandoned Pouch',
      'find.falle.zuschnappt': 'An ambush! But the pouch is full.',
      'find.durchgang.toast':  'The rubble gives way — a chamber lies behind it.'
    });
  }

  function _t(key, vars) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') return window.i18n.t(key, vars);
    } catch (e) {}
    return key;
  }

  // Naeher als das am Durchgangsweg gilt nicht als abseits. 160 px sind gut
  // zwei Spielerbreiten neben der Laufspur — nah genug, dass man den Fund im
  // Vorbeigehen SIEHT, weit genug, dass man dafuer abbiegen muss.
  var MIN_ABSTAND = 160;

  /**
   * Kuerzester Abstand eines Punktes zur Strecke von A nach B.
   *
   * Nicht der Abstand zu A oder B: ein Fund genau in der Mitte zwischen Tuer
   * und Treppe waere von beiden weit weg und trotzdem mitten auf dem Weg.
   */
  function abstandZurStrecke(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var laengeQ = dx * dx + dy * dy;
    if (laengeQ === 0) return Math.hypot(px - ax, py - ay);   // A und B gleich
    // Projektion auf die Strecke, auf [0,1] beschnitten -> Lot faellt ausserhalb
    // der Strecke, dann zaehlt der naehere Endpunkt.
    var t = ((px - ax) * dx + (py - ay) * dy) / laengeQ;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * Wie gut liegt ein Punkt abseits? Groesser ist besser, 0 heisst "auf dem Weg".
   *
   * @param {{x:number,y:number}} punkt
   * @param {{x:number,y:number}} eingang  wo der Spieler den Raum betritt
   * @param {{x:number,y:number}} ausgang  wo die Treppe liegt
   */
  function abseitsWert(punkt, eingang, ausgang) {
    if (!punkt || !eingang || !ausgang) return 0;
    return abstandZurStrecke(punkt.x, punkt.y, eingang.x, eingang.y, ausgang.x, ausgang.y);
  }

  /**
   * Waehlt aus Kandidaten die Punkte, die am weitesten abseits liegen.
   *
   * Zusaetzlich wird ein Mindestabstand ZWISCHEN den gewaehlten Punkten
   * gewahrt: zwei Funde nebeneinander sind ein Fund, kein zweiter Grund
   * abzubiegen.
   *
   * @param {Array<{x:number,y:number}>} kandidaten
   * @param {{x:number,y:number}} eingang
   * @param {{x:number,y:number}} ausgang
   * @param {number} anzahl  wie viele Punkte hoechstens
   * @param {number} [mindestAbstand] zwischen zwei Funden (Standard 240)
   * @returns {Array<{x:number,y:number}>} kann kuerzer sein als `anzahl`
   */
  function waehleAbseits(kandidaten, eingang, ausgang, anzahl, mindestAbstand) {
    if (!Array.isArray(kandidaten) || !kandidaten.length || anzahl <= 0) return [];
    var trenn = (typeof mindestAbstand === 'number') ? mindestAbstand : 240;

    var bewertet = [];
    for (var i = 0; i < kandidaten.length; i++) {
      var k = kandidaten[i];
      if (!k || typeof k.x !== 'number' || typeof k.y !== 'number') continue;
      var w = abseitsWert(k, eingang, ausgang);
      if (w < MIN_ABSTAND) continue;          // liegt am Weg -> kein Fund
      bewertet.push({ p: k, w: w });
    }
    bewertet.sort(function (a, b) { return b.w - a.w; });

    var gewaehlt = [];
    for (var j = 0; j < bewertet.length && gewaehlt.length < anzahl; j++) {
      var p = bewertet[j].p;
      var zuNah = false;
      for (var g = 0; g < gewaehlt.length; g++) {
        if (Math.hypot(p.x - gewaehlt[g].x, p.y - gewaehlt[g].y) < trenn) { zuNah = true; break; }
      }
      if (!zuNah) gewaehlt.push(p);
    }
    return gewaehlt;
  }

  /**
   * Wie viele Funde bekommt ein Raum?
   *
   * Bewusst hoechstens einer je Raum und nicht in jedem: Erkundung soll ein
   * Angebot bleiben. Wer in jedem Raum absuchen MUSS, erlebt keine Entdeckung
   * mehr, sondern eine Pflichtaufgabe — das ist die offene Frage aus #113,
   * hier mit dem vorsichtigen Wert beantwortet.
   *
   * ACHTUNG, das ist nicht die Rate, die im Spiel ankommt: danach muss noch
   * ein Platz weit genug abseits gefunden werden. Am laufenden Spiel
   * gemessen (Tiefe 3, 12 Raeume, Chance auf 1 gesetzt) gelingt das in 9 von
   * 12 Raeumen — die tatsaechliche Rate liegt also bei rund 0.35 * 0.75 =
   * ~26 %. Wer hier dreht, sollte den Trichter neu messen statt zu rechnen.
   */
  var CHANCE = 0.35;

  function anzahlFuerRaum(rng) {
    // ?find=<art> soll den Fund auch WIRKLICH herbeifuehren, nicht nur seine
    // Art bestimmen — sonst muesste man fuer einen Test durch Raeume laufen,
    // bis der Wuerfel mitspielt. ?find=durchgang meint die Kammer und laesst
    // den Fund am Weg bewusst weg.
    var erzwungen = erzwungeneArt();
    if (erzwungen) return erzwungen === 'durchgang' ? 0 : 1;
    var r = (typeof rng === 'function') ? rng : Math.random;
    // Chance ueber das Modul-Objekt, nicht die Konstante: so laesst sich die
    // Haeufigkeit messen und nachjustieren, ohne den Code anzufassen.
    return r() < HiddenFinds.CHANCE ? 1 : 0;
  }

  // Was in der Nische liegt. Bewusst kein garantierter Ausruestungsfund: der
  // Reiz soll das Abbiegen sein, nicht die Beute — sonst wird Erkunden Pflicht.
  var BEUTE = [
    { gewicht: 45, art: 'material' },
    { gewicht: 30, art: 'trank' },
    { gewicht: 20, art: 'item' },
    { gewicht: 5,  art: 'fragment' }
  ];

  /** Was gibt dieser Fund her? Gewichtet gezogen. */
  function beuteArt(rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var summe = 0, i;
    for (i = 0; i < BEUTE.length; i++) summe += BEUTE[i].gewicht;
    var wurf = r() * summe;
    for (i = 0; i < BEUTE.length; i++) {
      wurf -= BEUTE[i].gewicht;
      if (wurf <= 0) return BEUTE[i].art;
    }
    return BEUTE[BEUTE.length - 1].art;
  }

  // --- Verschuetteter Durchgang (#113) -------------------------------------
  //
  // Die Kammer wird beim RAUMAUFBAU gestanzt, nicht zur Laufzeit. Zur Laufzeit
  // ginge es nicht sinnvoll: spawnWallRect fasst Waende zu Rechtecken zusammen
  // und die Optik wird in EIN Bild gebacken (__wall_baked_*, aus #70). Ein Loch
  // spaeter hiesse Rechtecke zerschneiden und neu backen. Vor der
  // Zusammenfassung sind es dagegen nur ein paar Rasterzellen.
  //
  // Rein gehalten: Raster rein, Raster raus. Kein Phaser, kein Zustand.

  // Groesse in Kacheln. 3x3 und nicht kleiner: die Spielfigur braucht 34x56 px
  // Freiraum (CHAR_CLEAR_HALF_W/H in roomManager). Eine 2x2-Kammer ist 64x64 px
  // — die obere Pruefstelle liegt dann schon in der Wand, isPointAccessible
  // meldet "nicht begehbar", und der Spieler kaeme nicht hinein. Gemessen:
  // Raster sagte Boden, isPointAccessible sagte false. Genau deshalb war der
  // Durchgang im Spiel nicht zu benutzen.
  var KAMMER_B = 3, KAMMER_H = 3;

  // Wie oft bekommt ein Raum ueberhaupt eine Kammer? Deutlich seltener als ein
  // gewoehnlicher Fund: sie veraendert die Raumgeometrie, und in jedem zweiten
  // Raum ein zugeschuetteter Gang laesst die Karte beliebig wirken.
  var DURCHGANG_CHANCE = 0.22;

  function willDurchgang(rng) {
    // ?find=durchgang erzwingt die Kammer in JEDEM Raum.
    try {
      if (window.DebugGate && window.DebugGate.flagge('find')
          && String(window.DebugGate.flagge('find')).toLowerCase() === 'durchgang') return true;
    } catch (e) {}
    var r = (typeof rng === 'function') ? rng : Math.random;
    return r() < HiddenFinds.DURCHGANG_CHANCE;
  }

  // Das Wandraster besteht aus ZEICHEN, nicht aus Zahlen, und die Zeilen sind
  // STRINGS: '#' Wand, '.' Boden, 'P' Startpunkt (auch Boden). Der erste
  // Entwurf pruefte auf Truthiness und hielt damit jeden Boden fuer Wand — und
  // das Schreiben in einen String ist ohnehin unmoeglich. Beide Zeilenformen
  // werden hier bedient, damit ein spaeterer Umbau auf Felder nichts bricht.
  var BODEN = '.';

  function _zeichen(raster, x, y) {
    var z = raster[y];
    if (z === undefined || z === null) return null;
    var c = z[x];
    return (c === undefined) ? null : c;
  }

  function _istWand(raster, x, y) {
    var c = _zeichen(raster, x, y);
    if (c === null) return true;          // ausserhalb zaehlt als Wand
    if (typeof c === 'number') return c !== 0;
    return c !== BODEN && c !== 'P';
  }

  function _setzeBoden(raster, x, y) {
    var z = raster[y];
    if (typeof z === 'string') {
      raster[y] = z.slice(0, x) + BODEN + z.slice(x + 1);
    } else if (Array.isArray(z)) {
      z[x] = (typeof z[x] === 'number') ? 0 : BODEN;
    }
  }

  /**
   * Sucht eine Wandflaeche, die zur Kammer werden kann, und stanzt sie aus.
   *
   * Bedingungen an den Platz:
   *  - KAMMER_B x KAMMER_H Zellen, ALLE Wand
   *  - nicht am Kartenrand (sonst stanzt man nach draussen)
   *  - genau EIN angrenzendes Bodenfeld als Mund — mehrere Zugaenge waeren
   *    kein verschuetteter Durchgang, sondern eine Abkuerzung
   *
   * @param {Array<Array<number>>} raster wird VERAENDERT (Aufrufer kopiert)
   * @param {function} [rng]
   * @returns {{kammer:Array,mund:{x:number,y:number}}|null}
   */
  function stanzeKammer(raster, rng) {
    // Zeilen sind Strings ODER Felder — beides zulassen. Die urspruengliche
    // Pruefung verlangte Felder und brach bei den echten String-Zeilen
    // sofort ab, ohne dass es auffiel: sie gab einfach null zurueck.
    if (!Array.isArray(raster) || !raster.length) return null;
    if (typeof raster[0] !== 'string' && !Array.isArray(raster[0])) return null;
    var r = (typeof rng === 'function') ? rng : Math.random;
    var H = raster.length, W = raster[0].length;
    if (!W) return null;

    var kandidaten = [];
    for (var y = 1; y + KAMMER_H <= H - 1; y++) {
      for (var x = 1; x + KAMMER_B <= W - 1; x++) {
        var alleWand = true, dx, dy;
        for (dy = 0; dy < KAMMER_H && alleWand; dy++) {
          for (dx = 0; dx < KAMMER_B; dx++) {
            if (!_istWand(raster, x + dx, y + dy)) { alleWand = false; break; }
          }
        }
        if (!alleWand) continue;

        // Angrenzende Bodenfelder zaehlen (4er-Nachbarschaft des Blocks).
        var muender = [];
        for (dy = 0; dy < KAMMER_H; dy++) {
          if (!_istWand(raster, x - 1, y + dy)) muender.push({ x: x - 1, y: y + dy });
          if (!_istWand(raster, x + KAMMER_B, y + dy)) muender.push({ x: x + KAMMER_B, y: y + dy });
        }
        for (dx = 0; dx < KAMMER_B; dx++) {
          if (!_istWand(raster, x + dx, y - 1)) muender.push({ x: x + dx, y: y - 1 });
          if (!_istWand(raster, x + dx, y + KAMMER_H)) muender.push({ x: x + dx, y: y + KAMMER_H });
        }
        // Alle Muender muessen auf DERSELBEN Seite liegen. "Genau einer" war zu
        // streng: eine Nische an einer Korridorwand hat zwei Muender
        // nebeneinander und ist trotzdem eine Sackgasse. Was hier ausgeschlossen
        // wird, ist der Durchbruch zwischen zwei Seiten — das waere eine
        // Abkuerzung, kein verschuetteter Durchgang.
        // MINDESTENS ZWEI Muender: die Begehbarkeitspruefung verwirft
        // 1-Kachel-Engstellen ausdruecklich (CHAR_CLEAR_HALF_W/H in
        // roomManager, "1-Tile-Korridore als unpassierbar"). Mit einem
        // Kachel breiten Mund war die Kammer NIE erreichbar — gemessen war
        // keine einzige betretbar, obwohl das Wandraster Boden meldete.
        if (muender.length < 2) continue;
        var seiten = {};
        muender.forEach(function (m) {
          if (m.x < x) seiten.links = 1;
          else if (m.x >= x + KAMMER_B) seiten.rechts = 1;
          else if (m.y < y) seiten.oben = 1;
          else seiten.unten = 1;
        });
        if (Object.keys(seiten).length !== 1) continue;
        kandidaten.push({ x: x, y: y, mund: muender[0] });
      }
    }
    if (!kandidaten.length) return null;

    var w = kandidaten[Math.floor(r() * kandidaten.length)];
    var kammer = [];
    for (var ky = 0; ky < KAMMER_H; ky++) {
      for (var kx = 0; kx < KAMMER_B; kx++) {
        _setzeBoden(raster, w.x + kx, w.y + ky);
        kammer.push({ x: w.x + kx, y: w.y + ky });
      }
    }
    return { kammer: kammer, mund: w.mund };
  }

  /**
   * Welche Kammerkachel liegt am Mund? Dorthin kommt der Schutt.
   *
   * Nicht auf den Mund selbst: der ist Boden ausserhalb der Kammer und liegt im
   * begehbaren Raum — Schutt dort staende mitten im Weg.
   */
  function kammerEingang(kammer, mund) {
    if (!Array.isArray(kammer) || !kammer.length || !mund) return null;
    var beste = null, bestD = Infinity;
    for (var i = 0; i < kammer.length; i++) {
      var d = Math.abs(kammer[i].x - mund.x) + Math.abs(kammer[i].y - mund.y);
      if (d < bestD) { bestD = d; beste = kammer[i]; }
    }
    return beste;
  }

  /**
   * Schuettet die gestanzte Kammer zu und legt die Belohnung hinein (unrein).
   *
   * Der Schutt ist ein gewoehnliches zerstoerbares Hindernis vom Typ 'rubble' —
   * das kennt das Spiel schon (roomTemplates: destructibleTypes), also gilt
   * dieselbe Zerschlag-Mechanik wie bei Faessern, ohne neuen Sonderweg.
   *
   * @param {object} kammerInfo  Rueckgabe von stanzeKammer
   * @param {number} ox,oy,T     Ursprung und Kachelgroesse in Weltkoordinaten
   */
  function verschuetteKammer(scene, kammerInfo, ox, oy, T) {
    if (!scene || !kammerInfo || !kammerInfo.kammer || !kammerInfo.mund) return false;
    var eingang = kammerEingang(kammerInfo.kammer, kammerInfo.mund);
    if (!eingang) return false;
    var mitte = function (t) { return { x: ox + (t.x + 0.5) * T, y: oy + (t.y + 0.5) * T }; };

    // Ist die Kammer ueberhaupt BETRETBAR? Das Wandraster allein genuegt
    // nicht: die Spielfigur braucht 34x56 px Freiraum, und je nach Lage der
    // Kammer passt sie nirgends hinein. Gemessen waren so 3 von 5 Kammern
    // unbenutzbar — Geroell davor waere dann eine Kulisse, hinter der man
    // nie steht. Lieber gar kein Durchgang als ein toter.
    if (typeof scene.isPointAccessible === 'function') {
      var frei = kammerInfo.kammer.some(function (t) {
        var m = mitte(t);
        return scene.isPointAccessible(m.x, m.y);
      });
      if (!frei) {
        try {
          if (window.DebugGate && window.DebugGate.aktiv() && typeof console !== 'undefined') {
            console.log('[Durchgang] Kammer bei Kachel ' + eingang.x + '/' + eingang.y
              + ' waere nicht betretbar (Figur passt nicht hinein) — kein Geroell gesetzt.');
          }
        } catch (e) {}
        return false;
      }
    }

    // Schutt ueber die GANZE Oeffnung, nicht nur eine Kachel: ein einzelnes
    // 32-px-Stueck in einer 96 px breiten Kammer laesst rechts und links frei,
    // man sieht hindurch und laeuft daran vorbei.
    // Liegt der Mund seitlich, ist die Oeffnungskante die SPALTE des Eingangs;
    // liegt er ober- oder unterhalb, die ZEILE.
    var seitlich = (kammerInfo.mund.x !== eingang.x);
    var eingangsReihe = kammerInfo.kammer.filter(function (t) {
      return seitlich ? (t.x === eingang.x) : (t.y === eingang.y);
    });
    if (!eingangsReihe.length) eingangsReihe = [eingang];

    var schuttStuecke = [];
    try {
      var spawn = scene.spawnObstacle
        || (window.RoomTemplates && window.RoomTemplates.spawnObstacle);
      if (typeof spawn !== 'function') return false;
      eingangsReihe.forEach(function (t) {
        var p = mitte(t);
        var s = spawn.call(scene, p.x, p.y, 'rubble');
        if (s && typeof s.setData === 'function') {
          s.setData('kammerSchutt', true);
          schuttStuecke.push(s);
        }
      });
      if (!schuttStuecke.length) return false;
      // Fuer den Minikarten-Marker im Debug-Modus (minimap.js).
      scene._kammerMarkierung = { kammer: kammerInfo.kammer, schutt: eingang };
      try {
        if (window.DebugGate && window.DebugGate.aktiv() && typeof console !== 'undefined') {
          console.log('[Durchgang] Geroell auf ' + schuttStuecke.length + ' Kachel(n) ab '
            + eingang.x + '/' + eingang.y + ', zerschlagbar.'
            + ' Kammer verdeckt, oeffnet sich beim letzten Stueck.'
            + ' Minikarte: blau = Kammer, orange = Geroell.');
        }
      } catch (e) {}
    } catch (e) { return false; }

    // --- Die Kammer bleibt VERBORGEN, bis der Schutt faellt -----------------
    //
    // Sonst sieht man durch die Oeffnung eine fertige Kammer samt Truhe und
    // weiss vorher, was drin ist — der Reiz des Aufbrechens ist dann weg.
    //
    // Gemacht wie der Nebel selbst, nicht als schwarzes Viereck: derselbe Ton
    // (reines Schwarz) auf derselben Ebene (Tiefe 1000, wo fogUnseen liegt),
    // und der Rand laeuft ueber mehrere Stufen aus, statt hart abzubrechen —
    // die Kante ist es, die ein Rechteck als Rechteck verraet.
    var verdeckung = [];
    try {
      if (scene.add && scene.add.graphics) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        kammerInfo.kammer.forEach(function (t) {
          minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
          minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
        });
        var x0 = ox + minX * T, y0 = oy + minY * T;
        var w = (maxX - minX + 1) * T, hh = (maxY - minY + 1) * T;

        var g = scene.add.graphics().setDepth(1000);
        // Eindeutig markieren: auf Tiefe 1000 liegt auch fogUnseen selbst.
        if (typeof g.setData === 'function') g.setData('kammerVerdeckung', true);
        // Auslaufender Saum von aussen nach innen, dann der volle Kern.
        [[18, 0.15], [13, 0.35], [8, 0.60], [4, 0.85]].forEach(function (s) {
          g.fillStyle(0x000000, s[1]);
          g.fillRect(x0 - s[0], y0 - s[0], w + s[0] * 2, hh + s[0] * 2);
        });
        g.fillStyle(0x000000, 1);
        g.fillRect(x0, y0, w, hh);
        verdeckung.push(g);
      }
    } catch (e) {}

    // Belohnung erst, wenn aufgebrochen ist — vorher waere sie sichtbar.
    var hinten = kammerInfo.kammer[0], weit = -1;
    kammerInfo.kammer.forEach(function (t) {
      var d = Math.abs(t.x - kammerInfo.mund.x) + Math.abs(t.y - kammerInfo.mund.y);
      if (d > weit) { weit = d; hinten = t; }
    });

    var geoeffnet = false, zerschlagen = 0;
    function oeffnen() {
      if (geoeffnet) return;
      // Selbst mitzaehlen statt s.active abzufragen: ein zerstoertes Phaser-
      // Objekt meldet nicht zuverlaessig active=false, und die Verdeckung
      // blieb dadurch stehen (gemessen: Schutt 0, Verdeckung 9).
      zerschlagen++;
      if (zerschlagen < schuttStuecke.length) return;
      geoeffnet = true;
      // Weglichten statt wegschalten: der Nebel weicht, er verschwindet nicht
      // schlagartig. Ohne Tween-Manager (Test) sofort raus.
      var weg = function () {
        verdeckung.forEach(function (r) { try { r.destroy(); } catch (e) {} });
        verdeckung.length = 0;
      };
      if (scene.tweens && typeof scene.tweens.add === 'function' && verdeckung.length) {
        try {
          scene.tweens.add({ targets: verdeckung.slice(), alpha: 0, duration: 420,
            ease: 'Quad.easeOut', onComplete: weg });
          // Sicherung: klemmt der Tween, bleibt die Kammer sonst fuer immer
          // schwarz. Echte Zeit, unabhaengig von Spieluhr und Bildrate.
          setTimeout(weg, 2000);
        } catch (e) { weg(); }
      } else {
        weg();
      }
      try {
        var b = mitte(hinten);
        if (typeof window.spawnLoot === 'function') {
          window.spawnLoot.call(scene, b.x, b.y, _truhe(true));
        }
      } catch (e) {}
      try {
        if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
          window.EventSystem.showToast(scene, _t('find.durchgang.toast'));
        }
      } catch (e) {}
    }
    schuttStuecke.forEach(function (s) {
      try { if (s && typeof s.once === 'function') s.once('destroy', oeffnen); } catch (e) {}
    });

    return true;
  }

  // Wie oft welche Art? Die Nische bleibt der Regelfall; Lager und Falle geben
  // dem Absuchen zwei ANDERE Antworten als "noch etwas Beute".
  var ARTEN = [
    { id: 'nische', gewicht: 45 },
    { id: 'lager',  gewicht: 30 },
    { id: 'falle',  gewicht: 25 }
  ];

  /** Welche Fundart steht in diesem Raum? Gewichtet gezogen. */
  function fundArt(rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var summe = 0, i;
    for (i = 0; i < ARTEN.length; i++) summe += ARTEN[i].gewicht;
    var wurf = r() * summe;
    for (i = 0; i < ARTEN.length; i++) {
      wurf -= ARTEN[i].gewicht;
      if (wurf <= 0) return ARTEN[i].id;
    }
    return ARTEN[ARTEN.length - 1].id;
  }

  /**
   * Debug: ?find=<art> erzwingt die Fundart (nische|lager|falle|durchgang).
   * Ohne das trifft man eine bestimmte Art nur ueber viele Laeufe — der
   * Durchgang ist bei 22 % je Raum praktisch nicht gezielt zu erreichen.
   */
  function erzwungeneArt() {
    try {
      var v = window.DebugGate && window.DebugGate.flagge('find');
      if (!v) return null;
      v = String(v).toLowerCase();
      if (v === 'durchgang' || v === 'nische' || v === 'lager' || v === 'falle') return v;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[?find] unbekannt: "' + v + '" — bekannt: nische, lager, falle, durchgang');
      }
    } catch (e) {}
    return null;
  }

  /** Stellt den Fund dieses Raums hin — welchen, entscheidet fundArt. */
  function spawne(scene, pos) {
    var erzwungen = erzwungeneArt();
    // ?find=durchgang meint die Kammer, nicht den Fund am Weg — dann steht
    // hier gar nichts, damit man das Geroell nicht mit einem Fund verwechselt.
    if (erzwungen === 'durchgang') return false;
    var art = erzwungen || HiddenFinds.fundArt(Math.random);
    if (art === 'lager') return spawneLager(scene, pos);
    if (art === 'falle') return spawneFalle(scene, pos);
    return spawneNische(scene, pos);
  }

  /**
   * Eine GARANTIERTE Belohnung.
   *
   * spawnLoot ohne uebergebenen Gegenstand wuerfelt nur eine Drop-Chance
   * (loot.js: `if (maybeItem || roll < dropThreshold)`) — gemessen blieb die
   * Kammer damit leer. Wer erst Schutt wegschlaegt oder einen Hinterhalt
   * ueberlebt, darf nicht mit nichts dastehen.
   */
  function _truhe(gut) {
    var r = Math.random();
    if (gut) return { type: 'chest_medium', locked: false, tier: r < 0.5 ? 2 : 1 };
    return { type: 'chest_small', locked: false, tier: r < 0.35 ? 1 : 0 };
  }

  /**
   * Sagt an, was der Fund hergab — AM OBJEKT und am Bildrand.
   *
   * Der Toast allein reichte nicht: er erscheint oben am Rand, der Blick des
   * Spielers ist aber beim Objekt, das er gerade aufgebrochen hat ("man sieht
   * nicht gut was gedroppt wurde"). Der aufsteigende Text folgt dem Muster von
   * _healFx in player.js.
   *
   * @param {{x:number,y:number}} [pos]  wo der Text aufsteigt; ohne ihn nur Toast
   * @param {string} [farbe]             Schriftfarbe des aufsteigenden Texts
   */
  function _melde(scene, text, pos, farbe) {
    try {
      if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
        window.EventSystem.showToast(scene, text);
      }
    } catch (e) {}
    if (!pos || !scene || !scene.add || !scene.add.text) return;
    try {
      var txt = scene.add.text(pos.x, pos.y - 20, text, {
        fontFamily: 'monospace', fontSize: '13px', color: farbe || '#ffe9b0',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        align: 'center', wordWrap: { width: 200 }
      }).setOrigin(0.5, 1).setDepth(520);
      if (scene.tweens && scene.tweens.add) {
        scene.tweens.add({
          targets: txt, y: pos.y - 62, alpha: 0, duration: 1800,
          ease: 'Sine.easeOut',
          onComplete: function () { try { txt.destroy(); } catch (e) {} }
        });
      } else if (scene.time && scene.time.delayedCall) {
        scene.time.delayedCall(1800, function () { try { txt.destroy(); } catch (e) {} });
      }
    } catch (e) { /* nur Optik */ }
  }

  // Anteil der maximalen Lebenspunkte, den eine Rast zurueckgibt.
  var LAGER_HEILUNG = 0.28;

  /**
   * Verlassenes Lager: eine einmalige Rast.
   *
   * Der Reiz liegt in der KONKURRENZ zum Trankvorrat — es fuellt ihn nicht auf,
   * es ersetzt einen Trank an dieser Stelle. Wer voll ist, hat nichts davon;
   * das ist Absicht und wird auch so gesagt, statt stumm nichts zu tun.
   */
  function spawneLager(scene, pos) {
    if (!scene || !pos || !window.EventSystem
        || typeof window.EventSystem.spawnEventObject !== 'function') return false;
    window.EventSystem.spawnEventObject(
      scene, 'evt_lager', 0x6b4a2a, 0xffd08a, _t('find.lager.label'),
      function () {
        try {
          var max = window.playerMaxHealth || 0;
          var jetzt = window.playerHealth || 0;
          if (!max || jetzt >= max) { _melde(scene, _t('find.lager.voll'), pos, '#b9b2a4'); return; }
          var heilung = Math.max(1, Math.round(max * LAGER_HEILUNG));
          var neu = Math.min(max, jetzt + heilung);
          if (typeof window.setPlayerHealth === 'function') window.setPlayerHealth(neu);
          _melde(scene, _t('find.lager.rast', { n: neu - jetzt }), pos, '#7dffa0');
        } catch (e) { /* eine misslungene Rast darf nichts brechen */ }
      },
      { spawnAt: pos }
    );
    return true;
  }

  var FALLE_GEGNER = 3;
  var FALLE_RING_MIN = 90, FALLE_RING_MAX = 170;

  /**
   * Koeder mit Falle: sichtbar wertvolle Beute, aber bewacht.
   *
   * Die Beute faellt TROTZDEM — die Falle ist der Preis, nicht die Strafe. Wer
   * fuer das Absuchen nur Aerger bekommt, sucht beim naechsten Mal nicht mehr,
   * und genau das soll #113 ja beheben.
   */
  function spawneFalle(scene, pos) {
    if (!scene || !pos || !window.EventSystem
        || typeof window.EventSystem.spawnEventObject !== 'function') return false;
    window.EventSystem.spawnEventObject(
      scene, 'evt_falle', 0x6b5a2a, 0xffd966, _t('find.falle.label'),
      function () {
        try {
          // Erst die Beute: sie darf nicht daran haengen, dass der Spieler den
          // Hinterhalt ueberlebt.
          if (typeof window.spawnLoot === 'function') {
            // Garantiert, nicht gewuerfelt: der Hinterhalt ist der Preis.
            window.spawnLoot.call(scene, pos.x, pos.y + 24, _truhe(true));
          }
          if (typeof window.spawnEnemy === 'function') {
            // Solange abtasten, bis die Zahl steht: ein fester Winkel je Gegner
            // scheitert an Waenden, und gemessen kam nur EINER von dreien an.
            var gesetzt = 0;
            for (var v = 0; v < 24 && gesetzt < FALLE_GEGNER; v++) {
              var a = Math.random() * Math.PI * 2;
              var r = FALLE_RING_MIN + Math.random() * (FALLE_RING_MAX - FALLE_RING_MIN);
              var x = pos.x + Math.cos(a) * r, y = pos.y + Math.sin(a) * r;
              if (x <= 0 || y <= 0) continue;
              if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) continue;
              try {
                var g = window.spawnEnemy.call(scene, x, y, 'enemy');
                // spawnEnemy lehnt JEDEN Platz unter 300 px vom Spieler ab
                // (MIN_SPAWN_DISTANCE) und versetzt den Gegner quer durch den
                // Raum. Fuer normale Wellen richtig — ein Hinterhalt AM Koeder
                // ist die bewusste Ausnahme, sonst passiert er woanders und der
                // Spieler merkt gar nichts davon (gemeldet und nachgemessen).
                if (g && g.body && typeof g.body.reset === 'function') { g.body.reset(x, y); gesetzt++; }
                else if (g) { g.x = x; g.y = y; gesetzt++; }
              } catch (e) {}
            }
          }
          _melde(scene, _t('find.falle.zuschnappt'), pos, '#ff8a6a');
        } catch (e) {}
      },
      { spawnAt: pos }
    );
    return true;
  }

  /**
   * Stellt die Wandnische hin (unrein: braucht Szene und EventSystem).
   *
   * JEDER Ausgang sagt dem Spieler, was er bekommen hat. Material und
   * Wissensfragment sind sonst UNSICHTBAR — changeMaterialCount und
   * addFragments zeigen von sich aus nichts an, und der Fund fuehlte sich an,
   * als sei nichts passiert.
   */
  function spawneNische(scene, pos) {
    if (!scene || !pos || !window.EventSystem
        || typeof window.EventSystem.spawnEventObject !== 'function') return false;

    window.EventSystem.spawnEventObject(
      scene, 'evt_nische', 0x4a4356, 0xd8c48a, _t('find.nische.label'),
      function () {
        // Ueber das Modul-Objekt, nicht die lokale Fassung: sonst laesst sich
        // kein einzelner Ausgang gezielt pruefen (erster Versuch lief ins
        // Leere und meldete bei "trank" Eisenbrocken).
        var art = HiddenFinds.beuteArt(Math.random);
        var tiefe = Math.max(1, window.DUNGEON_DEPTH || 1);
        var meldung = _t('find.nische.leer');
        var farbe = '#b9b2a4';           // Staub — nichts gefunden
        try {
          if (art === 'fragment' && window.KnowledgeTree
              && typeof window.KnowledgeTree.addFragments === 'function') {
            window.KnowledgeTree.addFragments(1);
            meldung = _t('find.nische.fragment');
            farbe = '#c8a8ff';
          } else if (art === 'material' && typeof window.changeMaterialCount === 'function') {
            var n = 2 + Math.floor(Math.random() * 3);
            window.changeMaterialCount('MAT', n);
            meldung = _t('find.nische.material', { n: n });
            farbe = '#d8c48a';
          } else if (typeof window.spawnLoot === 'function') {
            // Ueber den normalen Beute-Pfad, damit Seltenheitsfarbe,
            // Aufsammel-Sperre und Rasterplatzierung genauso greifen wie sonst.
            // 4. Argument ist sourceEnemy, NICHT die Tiefe.
            var beute = (art === 'trank' && typeof window.makePotionDrop === 'function')
              ? window.makePotionDrop(tiefe) : null;
            window.spawnLoot.call(scene, pos.x, pos.y + 24, beute);
            meldung = _t('find.nische.beute');
            farbe = '#88ddff';
          }
        } catch (e) { /* ein leerer Fund ist besser als ein Absturz */ }
        _melde(scene, meldung, pos, farbe);
      },
      { spawnAt: pos }
    );
    return true;
  }

  var HiddenFinds = {
    MIN_ABSTAND: MIN_ABSTAND,
    KAMMER_B: KAMMER_B,
    KAMMER_H: KAMMER_H,
    DURCHGANG_CHANCE: DURCHGANG_CHANCE,
    willDurchgang: willDurchgang,
    erzwungeneArt: erzwungeneArt,
    stanzeKammer: stanzeKammer,
    _truhe: _truhe,
    kammerEingang: kammerEingang,
    verschuetteKammer: verschuetteKammer,
    LAGER_HEILUNG: LAGER_HEILUNG,
    FALLE_GEGNER: FALLE_GEGNER,
    beuteArt: beuteArt,
    fundArt: fundArt,
    spawne: spawne,
    spawneNische: spawneNische,
    spawneLager: spawneLager,
    spawneFalle: spawneFalle,
    CHANCE: CHANCE,
    abstandZurStrecke: abstandZurStrecke,
    abseitsWert: abseitsWert,
    waehleAbseits: waehleAbseits,
    anzahlFuerRaum: anzahlFuerRaum
  };
  if (typeof window !== 'undefined') window.HiddenFinds = HiddenFinds;
  if (typeof module !== 'undefined' && module.exports) module.exports = HiddenFinds;
})();
