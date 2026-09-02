/* =====================================================================
 * debugGate.js — EIN Schalter fuer alle Debug-Oberflaechen (#88)
 * ---------------------------------------------------------------------
 * Der ausgelieferte Build enthielt Werkzeuge, die fuer die Entwicklung
 * gebaut wurden und im normalen Spiel nichts zu suchen haben: eine
 * Cheat-Zeile in den Einstellungen (+100 Eisenbrocken), ein Overlay, das
 * Spielern rohe JS-Stacktraces zeigt, und ein Dutzend URL-Flaggen, mit
 * denen man in jede Tiefe springen oder den Nebel abschalten kann.
 *
 * Die Werkzeuge sollen BLEIBEN — die Nebel-Analyse lief komplett ueber
 * ?perf=1, der Raum-Rundgang ueber ?modes=. Sie haengen nur ab jetzt an
 * einem bewussten Schalter.
 *
 * Aktiv, wenn EINES gilt:
 *   - ?debug=1 steht in der Adresse
 *   - die Seite laeuft lokal (localhost / 127.0.0.1 / file:)
 *
 * Bewusst KEIN Schalter im Spielstand: ein Gate, das sich einmal
 * einschalten und dann vergessen laesst, ist kein Gate. Wer Debug will,
 * schreibt es in die Adresse — sichtbar, pro Sitzung, ohne Nachwirkung.
 *
 * MUSS als erstes Spiel-Skript laden: alles andere fragt hier.
 * ===================================================================== */
(function () {
  'use strict';

  var _aktiv = null;    // einmal ermittelt, danach zwischengespeichert
  var _gewarnt = false; // der Hinweis unten faellt hoechstens einmal

  function _lokal(host, protokoll) {
    if (protokoll === 'file:') return true;
    if (!host) return false;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
      || host === '0.0.0.0' || /\.localhost$/.test(host);
  }

  /**
   * Ist der Debug-Modus eingeschaltet?
   *
   * Das Ergebnis wird gemerkt: die Frage faellt pro Frame an (Nebel,
   * Raum-Modi), und der Wert kann sich waehrend einer Sitzung nicht
   * aendern — die Adresse steht fest.
   */
  function aktiv() {
    if (_aktiv !== null) return _aktiv;
    _aktiv = false;
    try {
      var l = (typeof window !== 'undefined') ? window.location : null;
      if (l) {
        if (/[?&]debug=1\b/.test(l.search || '')) _aktiv = true;
        else if (_lokal(l.hostname, l.protocol)) _aktiv = true;
      }
    } catch (e) { _aktiv = false; }
    if (!_aktiv) _hinweisWennZu();
    return _aktiv;
  }

  /**
   * Eine URL-Flagge auslesen — aber nur bei aktivem Gate.
   *
   * Der einzige Weg, wie eine Debug-Flagge im Spiel wirken darf. Jede
   * Stelle, die frueher selbst `location.search` durchsucht hat, geht
   * jetzt hier durch; dadurch gibt es genau EINEN Ort, an dem sich
   * "wirkt diese Flagge?" entscheidet.
   *
   * @param {string} name Flaggenname ohne = (z. B. 'perf')
   * @returns {string|null} der Wert, oder null (auch bei aktivem Gate,
   *                        wenn die Flagge nicht in der Adresse steht)
   */
  function flagge(name) {
    if (!aktiv() || !name) return null;
    try {
      var s = (window.location && window.location.search) || '';
      var m = new RegExp('[?&]' + name + '=([^&]*)').exec(s);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  /** Kurzform fuer Ein-/Aus-Flaggen: ist sie gesetzt und nicht "0"? */
  function an(name) {
    var v = flagge(name);
    return v !== null && v !== '0' && v !== 'false';
  }

  // Alle Flaggen, die es gibt. Dient NUR dem Hinweis unten — wirksam wird
  // eine Flagge ausschliesslich ueber flagge()/an().
  var BEKANNTE_FLAGGEN = [
    'dungeon', 'autostart', 'mode', 'modes', 'boss', 'beat',
    'perf', 'nofog', 'nomask', 'nospot', 'noexpl', 'explRes', 'fogInterval', 'rays',
    'spy', 'roomsize', 'hubdebug'
  ];

  /**
   * Sagt einmal Bescheid, wenn jemand eine Debug-Flagge setzt, das Gate aber
   * zu ist.
   *
   * Ohne das passiert schlicht NICHTS und man sucht den Fehler im Spiel statt
   * in der Adresse — genau so ist es beim ersten Einsatz von ?boss= passiert.
   */
  function _hinweisWennZu() {
    if (_gewarnt) return;
    _gewarnt = true;
    try {
      var s = (window.location && window.location.search) || '';
      var gefunden = BEKANNTE_FLAGGEN.filter(function (n) {
        return new RegExp('[?&]' + n + '=').test(s);
      });
      if (!gefunden.length) return;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Debug] ' + gefunden.join(', ') + ' gesetzt, aber der Debug-Modus'
          + ' ist AUS — die Flaggen wirken nicht. Haenge ?debug=1 an die Adresse'
          + ' (lokal ist er automatisch an). Siehe docs/debug-modus.md');
      }
    } catch (e) {}
  }

  /** Nur fuer Tests: den gemerkten Zustand vergessen. */
  function _vergessen() { _aktiv = null; _gewarnt = false; }

  var DebugGate = { aktiv: aktiv, flagge: flagge, an: an, _vergessen: _vergessen };
  if (typeof window !== 'undefined') window.DebugGate = DebugGate;
  if (typeof module !== 'undefined' && module.exports) module.exports = DebugGate;
})();
