/**
 * js/hubTruhe.js — die Truhe im Hub (#127).
 *
 * Alles, was man behalten wollte, musste bisher ins Laufinventar. Das ist klein
 * und wird im Dungeon gebraucht: wer ein gutes Stueck fuer einen spaeteren
 * Aufbau aufheben wollte, konnte nur einen Platz dauerhaft blockieren oder es
 * wegwerfen. Beides ist kein Abwaegen, sondern ein Verlust. Damit fehlte dem
 * Spiel die Ebene, von der Aufbau-Laeufe leben: etwas mitnehmen, das erst in
 * drei Laeufen nuetzt.
 *
 * ENTSCHEIDUNGEN, die hier festgeschrieben sind:
 *
 *   * GROESSE: ein festes Raster, kein unbegrenzter Speicher. Unbegrenzt macht
 *     die Frage "was hebe ich auf" wertlos. Zehn Spalten, weil das
 *     Laufinventar dieselbe Rasterbreite hat — Packlogik und Zellenmass sind
 *     damit dieselben und nicht zwei Verfahren, die auseinanderlaufen. Die
 *     Zeilenzahl steht im Spielstand, damit eine spaetere Erweiterung ueber
 *     eine Geldsenke (#98) nur eine Zahl ist.
 *
 *   * INHALT: Ausruestung und Traenke. KEIN Material — das hat mit
 *     changeMaterialCount schon einen eigenen, unbegrenzten Speicher; ein
 *     zweiter waere nur verwirrend.
 *
 *   * TOD IM DUNGEON: die Truhe bleibt unangetastet. Sie ist der sichere
 *     Hafen, das Risiko liegt im Laufinventar.
 *
 *   * EIN STUECK LIEGT NIE DOPPELT. Legen und Nehmen sind je EIN Vorgang, der
 *     erst wegnimmt und dann ablegt — und der bei fehlendem Platz gar nichts
 *     tut. Ein "kopieren und hoffen" waere die naheliegende Fehlerquelle: aus
 *     einem Stueck wuerden zwei.
 *
 * Kein Phaser, kein Szenenzustand: die Oberflaeche (js/hubTruheUI.js) ruft nur
 * die Funktionen hier. Damit ist die Rechnerei ohne laufendes Spiel pruefbar.
 */
(function () {
  'use strict';

  var SPALTEN = 10;
  var ZEILEN_START = 3;
  var ZEILEN_MAX = 6;          // Obergrenze fuer spaetere Erweiterungen

  // Was darf hinein?
  //
  // Die Liste ist AUS DEN ECHTEN ARTEN GEZOGEN, nicht geraten. Der erste
  // Anlauf hatte 'consumable' darin — die Art gibt es bei Traenken gar nicht,
  // sie heissen 'potion' (js/loot.js, _makePotionDrop). Und 'accessory' fehlte
  // ganz, obwohl das Ritualamulett aus der Quest genau so heisst. Beides wurde
  // abgewiesen, und die Oberflaeche meldete dazu "Die Truhe ist voll" —
  // gemeldet als "es kommt die Meldung die Truhe ist voll, obwohl nichts drin
  // liegt".
  //
  // Draussen bleiben:
  //   material    — hat mit changeMaterialCount schon einen eigenen,
  //                 unbegrenzten Vorrat; ein zweiter waere nur verwirrend.
  //   quest_item  — gehoert zum laufenden Auftrag, nicht ins Lager.
  var ERLAUBT = {
    weapon: 1, head: 1, body: 1, boots: 1,
    amulet: 1, accessory: 1,
    potion: 1, consumable: 1
  };

  var _faecher = [];
  var _zeilen = ZEILEN_START;

  function _grid() {
    return (typeof window !== 'undefined') ? window.InventoryGrid : null;
  }

  /** Rastermass der Truhe — so, wie InventoryGrid es erwartet. */
  function mass() {
    return { cols: SPALTEN, rows: _zeilen };
  }

  function plaetze() {
    return SPALTEN * _zeilen;
  }

  function _sicherstellen() {
    var soll = plaetze();
    if (!Array.isArray(_faecher)) _faecher = [];
    while (_faecher.length < soll) _faecher.push(null);
    if (_faecher.length > soll) _faecher.length = soll;
    return _faecher;
  }

  /** Das Feld selbst — die Oberflaeche zeichnet direkt daraus. */
  function faecher() {
    return _sicherstellen();
  }

  function zeilen() { return _zeilen; }

  /** Darf dieses Stueck in die Truhe? */
  function darfHinein(item) {
    if (!item || !item.type) return false;
    return !!ERLAUBT[item.type];
  }

  /**
   * Wie viele Gegenstaende liegen drin? (Nicht Zellen — Stuecke.)
   */
  function anzahl() {
    var n = 0;
    var f = _sicherstellen();
    for (var i = 0; i < f.length; i++) if (f[i]) n++;
    return n;
  }

  /**
   * Sucht den Zielplatz: erst die gewuenschte Stelle, sonst irgendeine freie.
   *
   * Beides in EINER Funktion, weil beide Uebertragungen dieselbe Frage
   * stellen. Wer beim Ziehen genau zielt, soll dort landen; wer nur
   * hinueberwirft, soll trotzdem einen Platz bekommen, statt eine Absage.
   */
  function _zielplatz(behaelter, item, x, y, m) {
    var G = _grid();
    if (typeof x === 'number' && typeof y === 'number') {
      var g = G.groesse(item, m);
      if (G.passt(G.belegung(behaelter, m), x, y, g.b, g.h, -2, m)) return { x: x, y: y };
    }
    return G.findePlatz(behaelter, item, undefined, m);
  }

  /**
   * Legt ein Stueck aus dem Laufinventar in die Truhe.
   *
   * Der Vorgang ist unteilbar: passt es nicht, bleibt ALLES, wie es war. Sonst
   * koennte ein Stueck aus dem Inventar verschwinden, ohne in der Truhe
   * anzukommen.
   *
   * @param {Array} inventar  das Laufinventar (flaches Feld)
   * @param {number} index    Platz im Laufinventar
   * @param {number} [x]      gewuenschte Rasterzelle in der Truhe
   * @param {number} [y]
   * @returns {boolean} ob gelegt wurde
   */
  function hineinlegen(inventar, index, x, y) {
    var G = _grid();
    if (!G || !Array.isArray(inventar)) return false;
    var item = inventar[index];
    if (!item || !darfHinein(item)) return false;

    var f = _sicherstellen();
    var platz = _zielplatz(f, item, x, y, mass());
    if (!platz) return false;
    var frei = f.findIndex(function (s) { return !s; });
    if (frei < 0) return false;

    inventar[index] = null;             // erst weg…
    item.gridX = platz.x;
    item.gridY = platz.y;
    f[frei] = item;                     // …dann hin
    return true;
  }

  /**
   * Holt ein Stueck aus der Truhe zurueck ins Laufinventar.
   * Ebenfalls unteilbar: ohne Platz im Inventar passiert nichts.
   *
   * @returns {boolean} ob genommen wurde
   */
  function herausnehmen(inventar, index, x, y) {
    var G = _grid();
    if (!G || !Array.isArray(inventar)) return false;
    var f = _sicherstellen();
    var item = f[index];
    if (!item) return false;

    var platz = _zielplatz(inventar, item, x, y, undefined);
    if (!platz) return false;
    var frei = inventar.findIndex(function (s) { return !s; });
    if (frei < 0) return false;

    f[index] = null;
    item.gridX = platz.x;
    item.gridY = platz.y;
    inventar[frei] = item;
    return true;
  }

  /**
   * Verschiebt ein Stueck INNERHALB der Truhe.
   * @returns {boolean} ob verschoben wurde
   */
  function verschiebe(index, x, y) {
    var G = _grid();
    if (!G) return false;
    return G.verschiebe(_sicherstellen(), index, x, y, mass());
  }

  /** Was liegt an dieser Rasterzelle? */
  function indexAn(x, y) {
    var G = _grid();
    if (!G) return -1;
    return G.indexAn(_sicherstellen(), x, y, mass());
  }

  // -------------------------------------------------------------------------
  // Spielstand
  // -------------------------------------------------------------------------

  /**
   * Der Teil, der in den Spielstand geht.
   *
   * NIE direkt in localStorage: der Stand laeuft ueber window.SlotStorage
   * (#63). Die Truhe gehoert in denselben Spielstand wie alles andere, sonst
   * taucht sie beim Slot-Wechsel im falschen Durchgang auf.
   */
  function alsSpielstand() {
    return { zeilen: _zeilen, faecher: _sicherstellen().map(function (s) { return s || null; }) };
  }

  /**
   * Uebernimmt einen gespeicherten Stand.
   *
   * Vertraegt auch Altstaende ohne Truhe (dann bleibt sie leer) und
   * Gegenstaende ohne Lage — die bekommen einen Platz zugewiesen, statt
   * unsichtbar zu werden. Was keinen Platz findet, wird zurueckgegeben statt
   * still verschluckt.
   *
   * @returns {Array} Stuecke, fuer die kein Platz war
   */
  function ausSpielstand(stand) {
    _zeilen = ZEILEN_START;
    if (stand && typeof stand.zeilen === 'number') {
      _zeilen = Math.max(1, Math.min(ZEILEN_MAX, Math.floor(stand.zeilen)));
    }
    _faecher = [];
    _sicherstellen();
    if (!stand || !Array.isArray(stand.faecher)) return [];
    for (var i = 0; i < stand.faecher.length && i < _faecher.length; i++) {
      _faecher[i] = stand.faecher[i] || null;
    }
    var G = _grid();
    return G ? G.lageErgaenzen(_faecher, mass()) : [];
  }

  /** Fuer "neues Spiel": komplett leeren. */
  function leeren() {
    _zeilen = ZEILEN_START;
    _faecher = [];
    _sicherstellen();
  }

  window.HubTruhe = {
    SPALTEN: SPALTEN,
    ZEILEN_START: ZEILEN_START,
    ZEILEN_MAX: ZEILEN_MAX,
    ERLAUBT: ERLAUBT,
    mass: mass,
    plaetze: plaetze,
    zeilen: zeilen,
    faecher: faecher,
    anzahl: anzahl,
    darfHinein: darfHinein,
    hineinlegen: hineinlegen,
    herausnehmen: herausnehmen,
    verschiebe: verschiebe,
    indexAn: indexAn,
    alsSpielstand: alsSpielstand,
    ausSpielstand: ausSpielstand,
    leeren: leeren
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.HubTruhe;
})();
