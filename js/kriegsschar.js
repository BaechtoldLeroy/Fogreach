/**
 * js/kriegsschar.js — Der Bannerträger bringt sein Gefolge mit (#95).
 *
 * Die Vorlage war D2s Unique-Pack. Gemessen passt sie so NICHT auf dieses
 * Spiel, und zwar aus zwei Gründen:
 *
 *   1. D2-Packs sind eine Gruppe, die man umgehen kann. Bei uns öffnet die
 *      Treppe erst, wenn der Raum leer ist — es gibt keine Entscheidung
 *      "angehen oder nicht".
 *   2. Die Räume sind sehr verschieden gross. Über ganze Läufe gemessen haben
 *      rund 60 % der Räume 4 Gegner (Untergrenze), aber jeder fünfte hat 14
 *      bis 28. In einem 4-Gegner-Raum WÄRE ein Pack der ganze Raum.
 *
 * Was übrig bleibt und trägt: dem Raum eine Identität geben. Statt vier
 * zusammenhangloser Einzelgegner steht dort ein Trupp unter einem Anführer —
 * gleicher Typ, geteiltes Zeichen, geerbter Affix.
 *
 * Die Regel skaliert deshalb mit der Raumgrösse:
 *
 *   Gefolge = clamp(round((N − 1) / 2), 3, 5)
 *   Zusatz  = max(0, (2 + Gefolge) − N)
 *
 *   N =  4 → 1 + 3, ein Fremder bleibt, +1 Gegner gespawnt
 *   N =  7 → 1 + 3, drei Fremde
 *   N = 28 → 1 + 5, 22 Fremde — eine Formation IM Raum, wie in D2
 *
 * Der Deckel bei 5 hält die Zahl der Gegner mit geerbtem Affix konstant, egal
 * wie voll der Raum ist. Dass immer mindestens ein Fremder übrig bleibt, ist
 * Absicht: der Kontrast macht die Schar überhaupt erst sichtbar.
 */
(function () {
  'use strict';

  // Unterhalb dieser begehbaren Fläche keine Schar. Gemessen gibt es Räume mit
  // 20k, 63k und 84k px² — Kammern von wenigen hundert Pixeln Kantenlänge. Dort
  // einen Gegner dazuzustellen wäre eine Falle, keine Begegnung. Die
  // Gegnerzahl kann das nicht ausdrücken: sie klemmt bei 4 für alles unter
  // 382k px². Schliesst rund ein Viertel der Räume aus.
  var MIN_FLAECHE = 150000;

  var GEFOLGE_MIN = 3;
  var GEFOLGE_MAX = 5;

  // Ring, auf dem das Gefolge um seinen Anführer steht.
  var RING_MIN = 70;
  var RING_MAX = 120;

  // Affixe, die vervielfacht unfair werden. Auren stapeln sich mechanisch UND
  // optisch; Tempo und Mehrfachschuss machen eine Gruppe unkitebar. Sie bleiben
  // dem Anführer, werden aber nicht vererbt.
  var NICHT_VERERBBAR = {
    cold_aura: 1,
    extra_fast: 1,
    multishot: 1,
    lightning_enchanted: 1
  };

  /** Wie viele folgen dem Bannerträger in einem Raum mit n Gegnern? */
  function gefolgeGroesse(n) {
    var roh = Math.round((Math.max(1, n || 1) - 1) / 2);
    return Math.max(GEFOLGE_MIN, Math.min(GEFOLGE_MAX, roh));
  }

  /** Wie viele Gegner stehen am Ende im Raum? Nie weniger als die Welle vorsah. */
  function zielGesamt(n, gefolge) {
    return Math.max(Math.max(1, n || 1), 2 + gefolge);
  }

  /**
   * Kommt in diesem Raum eine Schar?
   *
   * Die Chance ist bewusst die RAUM-Wahrscheinlichkeit eines Uniques nach der
   * bisherigen Regel: dort würfelt jeder Gegner einzeln, also 1-(1-p)^n. So
   * erscheint der Bannerträger genau so oft wie ein Unique bisher — die
   * Häufigkeit ändert sich nicht, nur was er mitbringt.
   *
   * @param {number} n        Gegner, die die Welle vorsieht
   * @param {number} flaeche  begehbare Fläche in px²
   * @param {number} tiefe    Dungeon-Tiefe
   * @param {function} [rng]
   * @returns {{gefolge:number, gesamt:number}|null}
   */
  function plane(n, flaeche, tiefe, rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    if (!(flaeche >= MIN_FLAECHE)) return null;
    var p = uniqueRate(tiefe);
    if (p <= 0) return null;
    var raumChance = 1 - Math.pow(1 - p, Math.max(1, n || 1));
    if (r() >= raumChance) return null;
    var gefolge = gefolgeGroesse(n);
    return { gefolge: gefolge, gesamt: zielGesamt(n, gefolge) };
  }

  /**
   * Die Unique-Rate je Gegner, wie sie shouldSpawnElite verwendet.
   *
   * Bewusst hier gespiegelt statt aus eliteEnemies gelesen: dort ist sie in
   * einer Funktion eingebacken, die gleich WÜRFELT. Wer die Zahlen dort ändert,
   * muss sie hier nachziehen — der Test haelt beide zusammen.
   */
  function uniqueRate(tiefe) {
    var t = tiefe || 1;
    if (t < 6) return 0;
    if (t <= 10) return 0.02;
    if (t <= 15) return 0.04;
    return 0.05;
  }

  /**
   * Welchen Affix gibt der Anführer weiter?
   *
   * Einen einzigen, und nur aus der sicheren Teilmenge. Fünf Gegner mit
   * Frostaura heissen dauerhaft verlangsamt ohne Ausweg — das ist kein
   * schwierigerer Kampf, sondern ein unfairer.
   *
   * @param {Array<string>} affixIds die Affixe des Anführers
   * @param {function} [rng]
   * @returns {string|null}
   */
  function erbbarerAffix(affixIds, rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    if (!Array.isArray(affixIds) || !affixIds.length) return null;
    var moeglich = affixIds.filter(function (id) { return !NICHT_VERERBBAR[id]; });
    if (!moeglich.length) return null;
    return moeglich[Math.floor(r() * moeglich.length)];
  }

  /**
   * Setzt das Gefolge um seinen Anführer.
   *
   * spawnEnemy verteilt selbst und haelt 300 px Mindestabstand zum Spieler —
   * uebergebene Koordinaten werden dabei ueberschrieben. Darum ERST spawnen,
   * DANN umsetzen. Dieselbe Falle wie bei der Koederfalle (#113) und den
   * geweckten Wachen (#71); dort hat sie je einen Anlauf gekostet.
   *
   * @returns {Array<object>} die tatsaechlich gesetzten Gefolgsleute
   */
  function gefolgeSpawnen(scene, fuehrer, anzahl, affixId, rng) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var raus = [];
    if (!scene || !fuehrer || typeof spawnEnemy !== 'function') return raus;
    var typ = (typeof fuehrer.enemyType === 'number') ? fuehrer.enemyType : undefined;
    for (var i = 0; i < anzahl; i++) {
      var g = null;
      try { g = spawnEnemy.call(scene, 0, 0, typ); } catch (e) { g = null; }
      if (!g) continue;
      var winkel = (Math.PI * 2 * i) / anzahl + r() * 0.6;
      var radius = RING_MIN + r() * (RING_MAX - RING_MIN);
      var zx = fuehrer.x + Math.cos(winkel) * radius;
      var zy = fuehrer.y + Math.sin(winkel) * radius;
      var frei = true;
      try {
        if (typeof window.isSpawnPositionBlocked === 'function') {
          frei = !window.isSpawnPositionBlocked(zx, zy, 20);
        }
      } catch (e) { frei = true; }
      if (frei) {
        g.x = zx; g.y = zy;
        if (g.body && typeof g.body.reset === 'function') g.body.reset(zx, zy);
      }
      // Die Leine: handleEnemies zieht Gefolgsleute zu ihrem Anführer, solange
      // er lebt. Faellt er, loest sich die Bindung — das ist gleichzeitig die
      // Belohnung dafuer, ihn zuerst zu toeten.
      g._scharFuehrer = fuehrer;
      if (affixId) erbeAffix(g, affixId);
      raus.push(g);
    }
    fuehrer._scharGefolge = raus;
    return raus;
  }

  /**
   * Traegt einen abgeschwaechten Affix auf einen Gefolgsmann.
   *
   * Der Affix wird ueber dieselbe Definition angewandt wie beim Elite, aber der
   * Gegner wird NICHT zum Elite: kein Lebens-Multiplikator, keine
   * Zusatzbeute, kein eigener Namenszug. Er traegt nur das Zeichen seines
   * Anfuehrers.
   */
  function erbeAffix(gegner, affixId) {
    try {
      var defs = (window.EliteEnemies && window.EliteEnemies.ENEMY_AFFIX_DEFS) || [];
      var def = null;
      for (var i = 0; i < defs.length; i++) {
        if (defs[i].id === affixId) { def = defs[i]; break; }
      }
      if (!def) return false;
      if (typeof def.apply === 'function') def.apply(gegner);
      gegner._scharAffix = affixId;
      // Sichtbares Zeichen der Zugehoerigkeit: die Toenung des Anfuehrer-Affixes,
      // aber blasser als beim Elite selbst.
      if (typeof gegner.setTint === 'function' && typeof def.tint === 'number') {
        gegner.setTint(def.tint);
        if (typeof gegner.setAlpha === 'function') gegner.setAlpha(0.92);
      }
      return true;
    } catch (e) { return false; }
  }

  window.Kriegsschar = {
    MIN_FLAECHE: MIN_FLAECHE,
    GEFOLGE_MIN: GEFOLGE_MIN,
    GEFOLGE_MAX: GEFOLGE_MAX,
    NICHT_VERERBBAR: NICHT_VERERBBAR,
    gefolgeGroesse: gefolgeGroesse,
    zielGesamt: zielGesamt,
    uniqueRate: uniqueRate,
    plane: plane,
    erbbarerAffix: erbbarerAffix,
    gefolgeSpawnen: gefolgeSpawnen,
    erbeAffix: erbeAffix
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.Kriegsschar;
})();
