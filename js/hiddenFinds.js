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
      'find.nische.leer':      'Hinter den Steinen: nichts als Staub.'
    });
    window.i18n.register('en', {
      'find.nische.label':     'Loose Stones',
      'find.nische.material':  'Behind the stones: {n} iron chunks.',
      'find.nische.fragment':  'Behind the stones: a knowledge fragment.',
      'find.nische.beute':     'Something lay behind the stones.',
      'find.nische.leer':      'Behind the stones: nothing but dust.'
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
        try {
          if (art === 'fragment' && window.KnowledgeTree
              && typeof window.KnowledgeTree.addFragments === 'function') {
            window.KnowledgeTree.addFragments(1);
            meldung = _t('find.nische.fragment');
          } else if (art === 'material' && typeof window.changeMaterialCount === 'function') {
            var n = 2 + Math.floor(Math.random() * 3);
            window.changeMaterialCount('MAT', n);
            meldung = _t('find.nische.material', { n: n });
          } else if (typeof window.spawnLoot === 'function') {
            // Ueber den normalen Beute-Pfad, damit Seltenheitsfarbe,
            // Aufsammel-Sperre und Rasterplatzierung genauso greifen wie sonst.
            // 4. Argument ist sourceEnemy, NICHT die Tiefe.
            var beute = (art === 'trank' && typeof window.makePotionDrop === 'function')
              ? window.makePotionDrop(tiefe) : null;
            window.spawnLoot.call(scene, pos.x, pos.y + 24, beute);
            meldung = _t('find.nische.beute');
          }
        } catch (e) { /* ein leerer Fund ist besser als ein Absturz */ }
        try {
          if (typeof window.EventSystem.showToast === 'function') {
            window.EventSystem.showToast(scene, meldung);
          }
        } catch (e) {}
      },
      { spawnAt: pos }
    );
    return true;
  }

  var HiddenFinds = {
    MIN_ABSTAND: MIN_ABSTAND,
    beuteArt: beuteArt,
    spawneNische: spawneNische,
    CHANCE: CHANCE,
    abstandZurStrecke: abstandZurStrecke,
    abseitsWert: abseitsWert,
    waehleAbseits: waehleAbseits,
    anzahlFuerRaum: anzahlFuerRaum
  };
  if (typeof window !== 'undefined') window.HiddenFinds = HiddenFinds;
  if (typeof module !== 'undefined' && module.exports) module.exports = HiddenFinds;
})();
