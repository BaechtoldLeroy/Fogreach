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
      'find.lager.rast':       'Du rastest kurz. {n} Leben zurück.',
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
  // Der Wurf laeuft VOR der Platzsuche: die tatsaechliche Rate ist
  // DURCHGANG_CHANCE mal dem Anteil der Raeume, die ueberhaupt eine geeignete
  // Wandflaeche haben. Die Randregel (keine Kammern in freistehenden Klotzen)
  // hat diesen Anteil gemessen von 10/30 auf 8/30 gedrueckt — Faktor 0,8.
  //
  // 0,22 / 0,8 = 0,275 gleicht genau das aus und nicht mehr: der Durchgang
  // soll so haeufig bleiben wie vorher, nicht haeufiger werden.
  //
  // b474: die Vorpruefung (Ecken in der Mauer, Vorplatz, erreichbar vom
  // Start) verwirft Plaetze, an denen die Kammer sonst halb frei stand oder
  // nicht zu betreten war — gemessen 14 -> 11 von 38 Vorlagen, im Spiel
  // 47 -> 37 von 100 Raeumen, Faktor ~0,79. 0,275 / 0,79 = 0,348; 0,34
  // bleibt knapp darunter und unter der Fundchance.
  var DURCHGANG_CHANCE = 0.34;

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
    // Wand ist nur '#' (so fuehrt sie jede Vorlage in der Legende). Mit
    // "alles ausser '.'" galt der Zierboden '+' der TerracedHall als Wand-
    // masse, und die Kammer wurde mitten in die Terrasse gestanzt.
    return c === '#';
  }

  /**
   * Teilt alle Wandkacheln in zusammenhaengende Massen und sagt je Masse, ob
   * sie den Raumrand erreicht.
   *
   * Wozu: "in der Wand" heisst fuer den Spieler die MAUER des Raums, nicht
   * irgendein Felsklotz mitten drin. Gemessen lagen 2 von 5 Kammern in einer
   * freistehenden Insel — eine davon in nur 11 Wandkacheln, also einer duennen
   * Schale um das ausgestanzte Loch. Der Spieler stand dann vor einem Geroell-
   * haufen im offenen Raum.
   *
   * Die alte Pfeiler-Pruefung reichte dafuer nicht: sie sieht nur den
   * unmittelbaren Ring des 3x3-Blocks. Ein 5x5-Klotz enthaelt Teilbloecke, die
   * ringsum Wand haben und trotzdem freistehen.
   *
   * @returns {{ label: Array<Int32Array|Array>, amRand: Object }}
   */
  function _wandMassen(raster, W, H) {
    var label = [], y, x;
    for (y = 0; y < H; y++) {
      label.push(new Array(W).fill(0));
    }
    var naechste = 1, amRand = {};
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        if (label[y][x] || !_istWand(raster, x, y)) continue;
        var id = naechste++;
        var stapel = [[x, y]];
        while (stapel.length) {
          var p = stapel.pop(), px = p[0], py = p[1];
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          if (label[py][px] || !_istWand(raster, px, py)) continue;
          label[py][px] = id;
          if (px === 0 || py === 0 || px === W - 1 || py === H - 1) amRand[id] = 1;
          stapel.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
      }
    }
    return { label: label, amRand: amRand };
  }

  function _setzeZeichen(raster, x, y, c) {
    var z = raster[y];
    if (typeof z === 'string') {
      raster[y] = z.slice(0, x) + c + z.slice(x + 1);
    } else if (Array.isArray(z)) {
      z[x] = c;
    }
  }

  function _setzeBoden(raster, x, y) {
    var z = raster[y];
    if (Array.isArray(z) && typeof z[x] === 'number') z[x] = 0;
    else _setzeZeichen(raster, x, y, BODEN);
  }

  // Ohne Legende: Boden ist alles, was weder Wand noch Leere (' ') ist — so
  // zaehlen auch 'P' und der Zierboden '+'. Mit Legende entscheidet der
  // Aufrufer (roomTemplates kennt die Bodenregel der Vorlage).
  function _istBodenStandard(c) {
    if (c === null || c === undefined) return false;
    if (typeof c === 'number') return c === 0;
    return c !== '#' && c !== ' ';
  }

  /** Welche Bodenzellen erreicht man vom Startpunkt aus (4er-Nachbarschaft)? */
  function _erreichbar(raster, W, H, istBoden, start) {
    var sx = Math.round(start.x), sy = Math.round(start.y);
    // Der Startpunkt kann auf einem Zierstueck liegen: naechsten Boden suchen.
    if (!istBoden(_zeichen(raster, sx, sy))) {
      var gefunden = null;
      for (var r = 1; r <= 3 && !gefunden; r++) {
        for (var dy = -r; dy <= r && !gefunden; dy++) {
          for (var dx = -r; dx <= r && !gefunden; dx++) {
            if (istBoden(_zeichen(raster, sx + dx, sy + dy))) gefunden = { x: sx + dx, y: sy + dy };
          }
        }
      }
      if (!gefunden) return null;
      sx = gefunden.x; sy = gefunden.y;
    }
    var gesehen = new Uint8Array(W * H), stapel = [sx, sy];
    gesehen[sy * W + sx] = 1;
    while (stapel.length) {
      var py = stapel.pop(), px = stapel.pop();
      var nb = [px + 1, py, px - 1, py, px, py + 1, px, py - 1];
      for (var i = 0; i < nb.length; i += 2) {
        var nx = nb[i], ny = nb[i + 1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || gesehen[ny * W + nx]) continue;
        if (!istBoden(_zeichen(raster, nx, ny))) continue;
        gesehen[ny * W + nx] = 1;
        stapel.push(nx, ny);
      }
    }
    return gesehen;
  }

  /**
   * Sucht eine Wandflaeche, die zur Kammer werden kann, und stanzt sie aus.
   *
   * Alles, was sich am RASTER pruefen laesst, wird VOR dem Stanzen geprueft.
   * Gemeldet als "dunkle Bereiche, als ob das eine Kammer haette sein sollen":
   * eine Kammer, die hinterher scheitert, hinterlaesst sonst ein Loch.
   *
   * Bedingungen an den Platz:
   *  - KAMMER_B x KAMMER_H Zellen, ALLE Wand, nicht am Kartenrand
   *  - Zugang nur von EINER Seite; die drei anderen Seiten und deren Ecken
   *    sind Wand (die Kammer steckt ganz im Mauerband, auch diagonal)
   *  - auf der Zugangsseite mindestens zwei nebeneinanderliegende Bodenfelder,
   *    vor denen noch einmal Boden liegt (die Spielfigur muss heranlaufen
   *    koennen), und kein Nachbar ist Leere oder ein Zierstueck
   *  - mit opts.start: dieser Vorplatz ist vom Startpunkt aus erreichbar
   *  - die Wandmasse haengt am Raumrand (keine freistehenden Klotze)
   *
   * @param {Array<string|Array>} raster wird VERAENDERT (Aufrufer kopiert)
   * @param {function} [rng]
   * @param {{istBoden?:function, start?:{x:number,y:number}}} [opts]
   * @returns {{kammer:Array,mund:{x:number,y:number},vorher:Array}|null}
   */
  function stanzeKammer(raster, rng, opts) {
    // Zeilen sind Strings ODER Felder — beides zulassen. Die urspruengliche
    // Pruefung verlangte Felder und brach bei den echten String-Zeilen
    // sofort ab, ohne dass es auffiel: sie gab einfach null zurueck.
    if (!Array.isArray(raster) || !raster.length) return null;
    if (typeof raster[0] !== 'string' && !Array.isArray(raster[0])) return null;
    var r = (typeof rng === 'function') ? rng : Math.random;
    opts = opts || {};
    var istBoden = (typeof opts.istBoden === 'function') ? opts.istBoden : _istBodenStandard;
    var H = raster.length, W = raster[0].length;
    if (!W) return null;

    // Einmal je Raum: welche Wandmasse haengt am Raumrand, was ist erreichbar?
    var massen = _wandMassen(raster, W, H);
    var erreicht = opts.start ? _erreichbar(raster, W, H, istBoden, opts.start) : null;
    if (opts.start && !erreicht) return null;
    var bodenDa = function (x, y) {
      if (!istBoden(_zeichen(raster, x, y))) return false;
      return !erreicht || !!erreicht[y * W + x];
    };

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

        // Die vier Seiten des Blocks, jeweils mit Blickrichtung nach aussen.
        var seiten = [
          { id: 'links',  zellen: [], ax: -1, ay: 0 },
          { id: 'rechts', zellen: [], ax: 1,  ay: 0 },
          { id: 'oben',   zellen: [], ax: 0,  ay: -1 },
          { id: 'unten',  zellen: [], ax: 0,  ay: 1 }
        ];
        for (dy = 0; dy < KAMMER_H; dy++) {
          seiten[0].zellen.push({ x: x - 1, y: y + dy });
          seiten[1].zellen.push({ x: x + KAMMER_B, y: y + dy });
        }
        for (dx = 0; dx < KAMMER_B; dx++) {
          seiten[2].zellen.push({ x: x + dx, y: y - 1 });
          seiten[3].zellen.push({ x: x + dx, y: y + KAMMER_H });
        }
        // Alle Muender muessen auf DERSELBEN Seite liegen. Was ausgeschlossen
        // wird, ist der Durchbruch zwischen zwei Seiten — das waere eine
        // Abkuerzung, kein verschuetteter Durchgang.
        var offen = seiten.filter(function (s) {
          return s.zellen.some(function (z) { return !_istWand(raster, z.x, z.y); });
        });
        if (offen.length !== 1) continue;
        var seite = offen[0];
        // Jede Oeffnung ist echter Boden — keine Leere, kein Zierstueck.
        if (seite.zellen.some(function (z) {
          return !_istWand(raster, z.x, z.y) && !istBoden(_zeichen(raster, z.x, z.y));
        })) continue;

        // Ecken, die NICHT an der Zugangsseite liegen, muessen Wand sein —
        // sonst beruehrt die Kammer diagonal den Boden und steht halb frei.
        var ecken = [
          { x: x - 1, y: y - 1, s: ['links', 'oben'] },
          { x: x + KAMMER_B, y: y - 1, s: ['rechts', 'oben'] },
          { x: x - 1, y: y + KAMMER_H, s: ['links', 'unten'] },
          { x: x + KAMMER_B, y: y + KAMMER_H, s: ['rechts', 'unten'] }
        ];
        if (ecken.some(function (e) {
          return e.s.indexOf(seite.id) < 0 && !_istWand(raster, e.x, e.y);
        })) continue;

        // MINDESTENS ZWEI nebeneinanderliegende Muender mit Boden davor: die
        // Begehbarkeitspruefung verwirft 1-Kachel-Engstellen ausdruecklich
        // (CHAR_CLEAR_HALF_W/H in roomManager). Mit einem Kachel breiten
        // Mund war die Kammer NIE erreichbar.
        var lauf = [], besterLauf = [];
        seite.zellen.forEach(function (z) {
          if (bodenDa(z.x, z.y) && bodenDa(z.x + seite.ax, z.y + seite.ay)) {
            lauf.push(z);
            if (lauf.length > besterLauf.length) besterLauf = lauf.slice();
          } else {
            lauf = [];
          }
        });
        if (besterLauf.length < 2) continue;

        // Die Masse, in der der Block steckt, muss bis zum Raumrand reichen —
        // sonst ist es keine Mauer, sondern ein Felsklotz im offenen Raum.
        if (!massen.amRand[massen.label[y][x]]) continue;

        kandidaten.push({ x: x, y: y, mund: besterLauf[0] });
      }
    }
    if (!kandidaten.length) return null;

    var w = kandidaten[Math.floor(r() * kandidaten.length)];
    var kammer = [], vorher = [];
    for (var ky = 0; ky < KAMMER_H; ky++) {
      for (var kx = 0; kx < KAMMER_B; kx++) {
        // Das Original merken: scheitert die Kammer spaeter, wird exakt
        // zurueckgebaut (mauereKammerZu).
        vorher.push(_zeichen(raster, w.x + kx, w.y + ky));
        _setzeBoden(raster, w.x + kx, w.y + ky);
        kammer.push({ x: w.x + kx, y: w.y + ky });
      }
    }
    return { kammer: kammer, mund: w.mund, vorher: vorher };
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
   * Raeumt die Verdeckung der vorigen Kammer ab.
   *
   * GEMELDET: "Es spawnen manchmal dunkle Bereiche, als ob das eine Kammer
   * haette sein sollen." Die schwarze Verdeckung haengt an keiner Raumliste.
   * Bis b465 verschwand sie trotzdem beim Raumwechsel, weil das Abraeumen des
   * Gerölls die Kammer "oeffnete". Seit nur noch das Zerschlagen oeffnet, blieb
   * sie stehen und lag im naechsten Raum mitten auf dem Boden — gemessen in
   * 99 von 100 Raeumen mit erzwungener Kammer. Darum raeumt jeder Raumaufbau
   * sie hier ausdruecklich ab.
   */
  function raeumeKammerAuf(scene) {
    if (!scene) return;
    var alt = scene._kammerVerdeckung;
    scene._kammerVerdeckung = null;
    scene._kammerToken = null;
    scene._kammerMarkierung = null;
    if (Array.isArray(alt)) {
      alt.slice().forEach(function (g) { try { g.destroy(); } catch (e) {} });
      alt.length = 0;
    }
  }

  /**
   * Baut eine gestanzte Kammer zurueck zur Wand, wenn sie nach dem Stanzen
   * scheitert (nicht betretbar, Geroell im Freiraum der Treppe, Ausnahme).
   *
   * Vorher blieb dann "eine offene, leere Nische": ein Loch in der Mauer ohne
   * Schutt, ohne Fund. Jetzt wird alles wiederhergestellt, was das Stanzen
   * veraendert hat: Raster (liest die Minikarte und die Spawnregeln live),
   * Wandkoerper, Wandbild, Sichtgeometrie und Begehbarkeit.
   *
   * @returns {boolean} true, wenn zurueckgebaut wurde
   */
  function mauereKammerZu(scene, kammerInfo, ox, oy, T) {
    if (!scene || !kammerInfo || !Array.isArray(kammerInfo.kammer) || !kammerInfo.kammer.length) return false;
    ox = ox || 0; oy = oy || 0;
    T = T || scene._minimapTileSize || 32;
    var kammer = kammerInfo.kammer, vorher = kammerInfo.vorher || [];
    var W = (typeof window !== 'undefined') ? window : {};

    // 1) Raster: genau die Zeichen von vorher.
    var grid = scene._minimapWallsGrid;
    if (Array.isArray(grid)) {
      kammer.forEach(function (t, i) {
        var c = vorher[i];
        _setzeZeichen(grid, t.x, t.y, (c === undefined || c === null) ? '#' : c);
      });
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    kammer.forEach(function (t) {
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
    });
    var x0 = ox + minX * T, y0 = oy + minY * T;
    var w = (maxX - minX + 1) * T, h = (maxY - minY + 1) * T;
    var cx = x0 + w / 2, cy = y0 + h / 2;

    // 2) Was inzwischen in der Kammer steht, vor den Mund stellen — sonst
    // steckt es gleich in der Wand. (Gemessen bisher nie, aber billig.)
    var vor = kammerInfo.mund
      ? { x: ox + (kammerInfo.mund.x + 0.5) * T, y: oy + (kammerInfo.mund.y + 0.5) * T }
      : null;
    var drin = function (o) {
      return o && o.active !== false && Number.isFinite(o.x) && Number.isFinite(o.y)
        && o.x >= x0 && o.x < x0 + w && o.y >= y0 && o.y < y0 + h;
    };
    var kinder = function (g) {
      try { return (g && typeof g.getChildren === 'function') ? g.getChildren().slice() : []; } catch (e) { return []; }
    };
    if (vor) {
      var bewegt = kinder(W.enemies).concat(W.player ? [W.player] : []);
      bewegt.forEach(function (o) {
        if (!drin(o)) return;
        try {
          if (o.body && typeof o.body.reset === 'function') o.body.reset(vor.x, vor.y);
          else o.setPosition(vor.x, vor.y);
        } catch (e) {}
      });
      var fest = kinder(W.obstacles).concat(kinder(W.lootGroup), scene._activeLootSprites || []);
      fest.forEach(function (o) {
        if (!drin(o) || (o.getData && o.getData('isMergedWall'))) return;
        try {
          o.setPosition(vor.x, vor.y);
          if (typeof o.refreshBody === 'function') o.refreshBody();
        } catch (e) {}
      });
    }

    // 3) Wandkoerper: dieselbe Textur wie die uebrigen Waende des Raums, sonst
    // haelt die Sichtpruefung (_buildWallCache: obstacleWall/wall_*) ihn nicht
    // fuer Wand und man saehe durch ihn hindurch.
    var tex = 'obstacleWall', bild = null;
    kinder(W.obstacles).some(function (o) {
      if (o && o.getData && o.getData('isMergedWall') && o.texture) { tex = o.texture.key; return true; }
      return false;
    });
    try {
      var wand = (typeof W.spawnWallRect === 'function') ? W.spawnWallRect(cx, cy, w, h, tex) : null;
      if (wand && typeof wand.setData === 'function') wand.setData('kammerZugemauert', true);
    } catch (e) {}

    // 4) Wandbild: das gebackene Bild hat an der Stelle ein Loch. Eine Kachel-
    // flaeche derselben Textur deckt es — auf der Tiefe der Wandkante, damit
    // auch die Schattenkanten, die rund um das Loch gezeichnet wurden,
    // darunter verschwinden. 'isFloor' wie das gebackene Bild: Platzierungen
    // laufen ueber Physik und Raster, nicht ueber dieses Bild.
    try {
      (scene._templateWalls || []).some(function (o) {
        if (o && o.getData && o.getData('isBakedWall')) { bild = o; return true; }
        return false;
      });
      if (scene.add && typeof scene.add.tileSprite === 'function' && scene.textures
          && scene.textures.exists && scene.textures.exists(tex)) {
        var tiefe = (W.WELT_TIEFEN && W.WELT_TIEFEN.WANDKANTE) || 39.5;
        var deck = scene.add.tileSprite(cx, cy, w, h, tex).setOrigin(0.5).setDepth(tiefe);
        if (bild && bild.isTinted && typeof deck.setTint === 'function') deck.setTint(bild.tintTopLeft);
        if (typeof deck.setData === 'function') {
          deck.setData('isFloor', true);
          deck.setData('kammerZugemauert', true);
        }
        scene._templateWalls = scene._templateWalls || [];
        scene._templateWalls.push(deck);
      }
    } catch (e) {}

    // 5) Sicht und Begehbarkeit neu: die Kammerzellen waren begehbar und
    // durchsichtig.
    try { if (typeof W.invalidateWallCache === 'function') W.invalidateWallCache(); } catch (e) {}
    try { if (typeof W.recomputeAccessibleArea === 'function') W.recomputeAccessibleArea(scene); } catch (e) {}
    scene._kammerMarkierung = null;
    return true;
  }

  /**
   * Schuettet die gestanzte Kammer zu und legt die Belohnung hinein (unrein).
   *
   * Der Schutt ist ein gewoehnliches zerstoerbares Hindernis vom Typ 'rubble' —
   * das kennt das Spiel schon (roomTemplates: destructibleTypes), also gilt
   * dieselbe Zerschlag-Mechanik wie bei Faessern, ohne neuen Sonderweg.
   *
   * Scheitert irgendeine Pruefung, wird die Kammer zurueckgemauert: kein Loch,
   * keine Meldung, kein Gegenstand.
   *
   * @param {object} kammerInfo  Rueckgabe von stanzeKammer
   * @param {number} ox,oy,T     Ursprung und Kachelgroesse in Weltkoordinaten
   */
  function verschuetteKammer(scene, kammerInfo, ox, oy, T) {
    if (!scene) return false;
    raeumeKammerAuf(scene);
    if (!kammerInfo || !kammerInfo.kammer || !kammerInfo.mund) return false;
    var schutt = [], ok = false, grund = 'Ausnahme';
    try {
      grund = _verschuetten(scene, kammerInfo, ox, oy, T, schutt);
      ok = (grund === true);
    } catch (e) { ok = false; }
    if (ok) return true;
    schutt.forEach(function (s) {
      try { if (s.body) s.body.enable = false; } catch (e) {}
      try { s.destroy(); } catch (e) {}
    });
    mauereKammerZu(scene, kammerInfo, ox, oy, T);
    try {
      if (window.DebugGate && window.DebugGate.aktiv() && typeof console !== 'undefined') {
        console.log('[Durchgang] Kammer bei Kachel ' + kammerInfo.kammer[0].x + '/' + kammerInfo.kammer[0].y
          + ' verworfen (' + grund + ') — wieder zugemauert, kein Geroell, kein Fund.');
      }
    } catch (e) {}
    return false;
  }

  /** @returns {true|string} true oder der Grund des Scheiterns */
  function _verschuetten(scene, kammerInfo, ox, oy, T, schuttStuecke) {
    var eingang = kammerEingang(kammerInfo.kammer, kammerInfo.mund);
    if (!eingang) return 'kein Eingang';
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
      if (!frei) return 'nicht betretbar';
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

    var spawn = scene.spawnObstacle
      || (window.RoomTemplates && window.RoomTemplates.spawnObstacle);
    if (typeof spawn !== 'function') return 'kein spawnObstacle';
    eingangsReihe.forEach(function (t) {
      var p = mitte(t);
      var s = spawn.call(scene, p.x, p.y, 'rubble');
      if (s && typeof s.setData === 'function') {
        s.setData('kammerSchutt', true);
        schuttStuecke.push(s);
      }
    });
    // Jede Kachel der Oeffnung braucht ihr Stueck — eine Luecke waere ein
    // Durchblick auf die verdeckte Kammer.
    if (schuttStuecke.length !== eingangsReihe.length) return 'Geroell unvollstaendig';
    // Kein Schutt im Freiraum einer Treppe. Das Netz (raeumePropsAufTreppen)
    // ist da laengst gelaufen, und nachraeumen ginge auch nicht: das destroy
    // eines Brockens oeffnet die Kammer samt Belohnung (unten).
    var anTreppe = typeof window.imTreppenFreiraum === 'function'
      && schuttStuecke.some(function (s) { return window.imTreppenFreiraum(scene, s); });
    if (anTreppe) return 'Geroell im Freiraum der Treppe';

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
        // Nur der Teil HINTER dem Geroell wird verdeckt. Lag der Nebel auch
        // ueber dem Schutt, sah man nicht mehr, worauf man einschlagen soll —
        // und ohne sichtbares Geroell gibt es keinen Grund, es zu versuchen.
        var _istSchutt = function (t) {
          return eingangsReihe.some(function (e) { return e.x === t.x && e.y === t.y; });
        };
        var dahinter = kammerInfo.kammer.filter(function (t) { return !_istSchutt(t); });
        if (!dahinter.length) dahinter = kammerInfo.kammer;
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        dahinter.forEach(function (t) {
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
        // Flaeche merken, damit sich pruefen laesst, was sie verdeckt.
        g.__flaeche = { x: x0, y: y0, w: w, h: hh };
        verdeckung.push(g);
      }
    } catch (e) {}
    // An der Szene festhalten: der naechste Raumaufbau raeumt sie ab
    // (raeumeKammerAuf), ob die Kammer geoeffnet wurde oder nicht.
    var token = {};
    scene._kammerVerdeckung = verdeckung;
    scene._kammerToken = token;

    // Belohnung erst, wenn aufgebrochen ist — vorher waere sie sichtbar.
    var hinten = kammerInfo.kammer[0], weit = -1;
    kammerInfo.kammer.forEach(function (t) {
      var d = Math.abs(t.x - kammerInfo.mund.x) + Math.abs(t.y - kammerInfo.mund.y);
      if (d > weit) { weit = d; hinten = t; }
    });

    var weg = function () {
      verdeckung.slice().forEach(function (r) { try { r.destroy(); } catch (e) {} });
      verdeckung.length = 0;
    };
    var geoeffnet = false;
    function oeffnen() {
      if (geoeffnet) return;
      // Beim ERSTEN Brocken, nicht erst beim letzten: sobald eine Luecke da
      // ist, sieht man hinein — der Rest waere nur noch Aufraeumen vor einer
      // schwarzen Wand.
      geoeffnet = true;
      // Weglichten statt wegschalten: der Nebel weicht, er verschwindet nicht
      // schlagartig. Ohne Tween-Manager (Test) sofort raus.
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
        _belohnung(scene, b.x, b.y);
      } catch (e) {}
      try {
        if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
          window.EventSystem.showToast(scene, _t('find.durchgang.toast'));
        }
      } catch (e) {}
    }
    // NUR das Zerschlagen oeffnet. 'destroy' feuert auch, wenn enterRoom beim
    // naechsten Raumwechsel die Hindernisse abraeumt — und zwar NACHDEM die
    // Beute geleert wurde. Gemeldet als "zu oft 'hinter dem Schutt liegt
    // etwas', und dann liegt das Item irgendwo rum": Meldung und Gegenstand
    // landeten im neuen Raum, in dem es gar keine Kammer gibt.
    // Verschwindet ein Brocken auf anderem Weg, solange dieser Raum noch steht,
    // faellt wenigstens die Verdeckung — ohne Belohnung, aber kein schwarzer
    // Kasten vor einer offenen Kammer.
    schuttStuecke.forEach(function (s) {
      try {
        if (s && typeof s.once === 'function') {
          s.once('destroy', function () {
            if (s.__zerschlagen) oeffnen();
            else if (scene._kammerToken === token) weg();
          });
        }
      } catch (e) {}
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
    if (gut) return { type: 'chest_large', locked: false, tier: r < 0.6 ? 2 : 3 };
    return { type: 'chest_small', locked: false, tier: r < 0.35 ? 1 : 0 };
  }

  /**
   * Legt eine Belohnung ab, die BESSER ist als ein gewoehnlicher Fund.
   *
   * Nicht ueber eine Truhe: die schuettet beim Zerschlagen nur mit der
   * Behaelter-Chance aus (chest_medium 10 %, chest_large 15 %), und fuer eine
   * Kammer, die man erst aufschlagen muss, ist das praktisch immer leer. Der
   * Umweg ueber isRewardChest schlug fehl, weil die von spawnLoot
   * zurueckgegebene Truhe die Marke nicht annahm (gemessen: getData lieferte
   * durchweg undefined).
   *
   * Stattdessen direkt der Gegenstand, mit derselben Qualitaetsverteilung, die
   * eine Belohnungstruhe erzeugt (main.js: 82 % Magisch / 15 % Selten /
   * 3 % Legendaer) und iLevel wie eine grosse Truhe (Tiefe + 8).
   */
  function _belohnung(scene, x, y) {
    var tiefe = Math.max(1, (typeof window !== 'undefined' && window.DUNGEON_DEPTH) || 1);
    var iLevel = tiefe + 8;
    var r = Math.random();
    var stufe = r < 0.03 ? 3 : (r < 0.18 ? 2 : 1);
    try {
      if (window.LootSystem && typeof window.LootSystem.rollItem === 'function'
          && typeof window.spawnLoot === 'function') {
        var item = window.LootSystem.rollItem(null, iLevel, stufe);
        if (item) { window.spawnLoot.call(scene, x, y, item, null); return true; }
      }
    } catch (e) {}
    // Rueckfall: lieber eine Truhe als gar nichts.
    try {
      if (typeof window.spawnLoot === 'function') {
        window.spawnLoot.call(scene, x, y, _truhe(true));
        return true;
      }
    } catch (e) {}
    return false;
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
          // Ohne Runden steht dort "12.399999999999999 Leben": die Heilmenge ist
          // ganzzahlig, das AKTUELLE Leben aber nicht (Lebensraub und prozentuale
          // Treffer erzeugen Brueche).
          _melde(scene, _t('find.lager.rast', { n: Math.round(neu - jetzt) }), pos, '#7dffa0');
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
          // Garantiert, nicht gewuerfelt: der Hinterhalt ist der Preis.
          _belohnung(scene, pos.x, pos.y + 24);
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
    _belohnung: _belohnung,
    kammerEingang: kammerEingang,
    verschuetteKammer: verschuetteKammer,
    mauereKammerZu: mauereKammerZu,
    raeumeKammerAuf: raeumeKammerAuf,
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
