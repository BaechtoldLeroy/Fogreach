// js/inventoryGrid.js — Rasterbelegung des Inventars (#123, Ausbaustufe B).
//
// Bis hierher war das Inventar eine Liste aus 20 gleich grossen Faechern: ein
// Dolch belegte genauso viel wie ein Zweihaender. Jetzt hat jeder Gegenstand
// eine Groesse in Rasterzellen, und das Raster wird zum Packproblem — so wie in
// Diablo 2.
//
// ENTWURFSENTSCHEIDUNG, die den Umbau klein haelt: `inventory` bleibt ein
// FLACHES Feld aus Gegenstaenden. Die Lage steht am Gegenstand selbst
// (`gridX`/`gridY`), die Belegung wird daraus abgeleitet. Damit funktionieren
// die 37 bestehenden Zugriffe der Art `inventory[i]`, `findIndex(s => !s)` und
// `filter(Boolean)` unveraendert weiter; nur das SUCHEN eines Platzes aendert
// sich. Eine 2D-Matrix als Wahrheit haette jede dieser Stellen angefasst.
//
// Die Funktionen hier sind rein: keine Szene, kein Phaser, kein window-Zustand
// ausser den uebergebenen Daten. Deshalb ohne laufendes Spiel testbar.
(function () {
  'use strict';

  // Rastermass. 10 Spalten passen genau in die 480 px Rasterbreite des Panels
  // (48 px je Zelle); 4 Zeilen lassen darunter Platz fuer die Ausruestung.
  var COLS = 10;
  var ROWS = 4;

  // Groesse je Gegenstand in Zellen: [Breite, Hoehe].
  //
  // Die Silhouette soll die Waffenart tragen — dieselbe Absicht wie bei den
  // Symbolen aus #117. Ein Dolch ist schmal und kurz, ein Richtschwert lang,
  // ein Kriegshammer breit. Wer das Raster ansieht, erkennt die Waffenart, bevor
  // er den Namen liest.
  var GROESSE_NACH_SCHLUESSEL = {
    WPN_SCHATTENDOLCH: [1, 2],
    WPN_EISENKLINGE: [1, 3],
    WPN_KETTENMORGENSTERN: [2, 3],
    WPN_GLUTAXT: [2, 3],
    // Kein Gegenstand ist so hoch wie das Raster (4 Zeilen). Ein 2x4-Stueck
    // belegt sonst eine Doppelspalte von oben bis unten und ZERSCHNEIDET das
    // Raster, statt nur Platz zu kosten — in der untersten Zeile bliebe dann
    // nichts mehr fuer Kleinteile.
    WPN_RICHTSCHWERT: [2, 3],
    WPN_KRIEGSHAMMER: [2, 3],
    ELARAS_KLINGE: [1, 3],
  };

  // Rueckfall nach Art, wenn der Schluessel unbekannt ist. Ein neuer
  // Gegenstand landet damit auf einem sinnvollen Mass statt auf 1x1 —
  // stillschweigend zu klein waere schlimmer als grob geschaetzt.
  var GROESSE_NACH_ART = {
    weapon: [1, 3],
    head: [2, 2],
    body: [2, 3],
    boots: [2, 2],
    amulet: [1, 1],
    potion: [1, 1],
    material: [1, 1],
  };

  /**
   * Groesse eines Gegenstands in Rasterzellen.
   * @param {object} item
   * @returns {{b:number,h:number}} Breite und Hoehe, mindestens 1x1
   */
  function groesse(item) {
    if (!item) return { b: 1, h: 1 };
    var m = GROESSE_NACH_SCHLUESSEL[item.key];
    if (!m && item.subtype === 'bow') m = [2, 3];   // s. Richtschwert
    if (!m) m = GROESSE_NACH_ART[item.type];
    if (!m) m = [1, 1];
    return {
      b: Math.max(1, Math.min(COLS, m[0])),
      h: Math.max(1, Math.min(ROWS, m[1])),
    };
  }

  /**
   * Belegungskarte aus dem flachen Inventarfeld.
   * @param {Array} inventar
   * @returns {Array<Array<number>>} rows x cols, -1 = frei, sonst Feldindex
   */
  function belegung(inventar) {
    var karte = [];
    for (var y = 0; y < ROWS; y++) {
      var z = [];
      for (var x = 0; x < COLS; x++) z.push(-1);
      karte.push(z);
    }
    if (!Array.isArray(inventar)) return karte;
    for (var i = 0; i < inventar.length; i++) {
      var it = inventar[i];
      if (!it) continue;
      // Gegenstaende ohne Lage (Altbestand, frisch geladen) bleiben hier
      // unsichtbar — `lageErgaenzen` weist ihnen erst einen Platz zu.
      if (typeof it.gridX !== 'number' || typeof it.gridY !== 'number') continue;
      var g = groesse(it);
      for (var dy = 0; dy < g.h; dy++) {
        for (var dx = 0; dx < g.b; dx++) {
          var yy = it.gridY + dy, xx = it.gridX + dx;
          if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS) karte[yy][xx] = i;
        }
      }
    }
    return karte;
  }

  /**
   * Passt ein Rechteck an diese Stelle?
   * @param {Array<Array<number>>} karte
   * @param {number} x linke Spalte
   * @param {number} y obere Zeile
   * @param {number} b Breite
   * @param {number} h Hoehe
   * @param {number} [ausser] Feldindex, der ignoriert wird (fuer Umlegen)
   */
  function passt(karte, x, y, b, h, ausser) {
    if (x < 0 || y < 0 || x + b > COLS || y + h > ROWS) return false;
    for (var dy = 0; dy < h; dy++) {
      for (var dx = 0; dx < b; dx++) {
        var belegt = karte[y + dy][x + dx];
        if (belegt !== -1 && belegt !== ausser) return false;
      }
    }
    return true;
  }

  /**
   * Erster freier Platz fuer eine Groesse, zeilenweise von oben links.
   *
   * Zeilenweise und nicht "bestpassend": der Spieler soll vorhersagen koennen,
   * wo ein Fund landet. Eine clevere Packstrategie verschiebt dieselbe Waffe je
   * nach Inventarzustand irgendwohin — das ist schwerer zu lesen als eine
   * gelegentlich schlechtere Ausnutzung.
   *
   * @returns {{x:number,y:number}|null} null, wenn nichts passt
   */
  function findePlatz(inventar, item, ausser) {
    var g = groesse(item);
    var karte = belegung(inventar);
    for (var y = 0; y <= ROWS - g.h; y++) {
      for (var x = 0; x <= COLS - g.b; x++) {
        if (passt(karte, x, y, g.b, g.h, ausser)) return { x: x, y: y };
      }
    }
    return null;
  }

  /**
   * Legt einen Gegenstand ins Inventar, wenn Platz ist.
   * @returns {number} Feldindex, oder -1 wenn das Raster voll ist
   */
  function einfuegen(inventar, item) {
    if (!Array.isArray(inventar) || !item) return -1;
    var platz = findePlatz(inventar, item);
    if (!platz) return -1;
    var idx = inventar.findIndex(function (s) { return !s; });
    if (idx < 0) return -1;              // Feld voll (sollte vor dem Raster nie eintreten)
    item.gridX = platz.x;
    item.gridY = platz.y;
    inventar[idx] = item;
    return idx;
  }

  /**
   * Weist Gegenstaenden ohne Lage einen Platz zu.
   *
   * Noetig nach dem Laden eines Spielstands, der noch aus der Zeit gleich
   * grosser Faecher stammt: dort hat kein Gegenstand gridX/gridY. Ohne diesen
   * Schritt waeren sie im Raster unsichtbar und wuerden von jedem neuen Fund
   * ueberschrieben.
   *
   * Was keinen Platz mehr findet, faellt heraus und wird zurueckgegeben — der
   * Aufrufer entscheidet, ob er es einschmilzt oder verwirft. Stillschweigend
   * verschwinden lassen waere die schlechteste Antwort.
   *
   * @returns {Array} die Gegenstaende, fuer die kein Platz war
   */
  function lageErgaenzen(inventar) {
    if (!Array.isArray(inventar)) return [];
    var heimatlos = [];
    for (var i = 0; i < inventar.length; i++) {
      var it = inventar[i];
      if (!it) continue;
      if (typeof it.gridX === 'number' && typeof it.gridY === 'number') continue;
      var platz = findePlatz(inventar, it);
      if (!platz) { heimatlos.push(it); inventar[i] = null; continue; }
      it.gridX = platz.x;
      it.gridY = platz.y;
    }
    return heimatlos;
  }

  /**
   * Darf der Gegenstand an Platz `index` nach (x,y)?
   *
   * Der Gegenstand selbst wird beim Pruefen AUSGEBLENDET (`ausser`) — sonst
   * blockierte er sich beim Verschieben um eine Zelle mit seinen eigenen
   * Zellen und man koennte ihn nie leicht versetzen.
   */
  function kannHin(inventar, index, x, y) {
    if (!Array.isArray(inventar)) return false;
    var it = inventar[index];
    if (!it) return false;
    var g = groesse(it);
    return passt(belegung(inventar), x, y, g.b, g.h, index);
  }

  /**
   * Verschiebt einen Gegenstand, wenn der Zielplatz frei ist.
   * @returns {boolean} ob verschoben wurde
   */
  function verschiebe(inventar, index, x, y) {
    if (!kannHin(inventar, index, x, y)) return false;
    inventar[index].gridX = x;
    inventar[index].gridY = y;
    return true;
  }

  /** Gegenstand an einer Rasterzelle, oder null. */
  function itemAn(inventar, x, y) {
    var karte = belegung(inventar);
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return null;
    var i = karte[y][x];
    return i === -1 ? null : inventar[i];
  }

  /** Feldindex an einer Rasterzelle, oder -1. */
  function indexAn(inventar, x, y) {
    var karte = belegung(inventar);
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return -1;
    return karte[y][x];
  }

  /** Wie viele Zellen sind frei? Fuer Anzeige und Tests. */
  function freieZellen(inventar) {
    var karte = belegung(inventar);
    var n = 0;
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (karte[y][x] === -1) n++;
    return n;
  }

  window.InventoryGrid = {
    COLS: COLS,
    ROWS: ROWS,
    groesse: groesse,
    belegung: belegung,
    passt: passt,
    findePlatz: findePlatz,
    kannHin: kannHin,
    verschiebe: verschiebe,
    einfuegen: einfuegen,
    lageErgaenzen: lageErgaenzen,
    itemAn: itemAn,
    indexAn: indexAn,
    freieZellen: freieZellen,
  };
})();
