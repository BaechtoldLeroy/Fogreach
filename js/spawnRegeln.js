// js/spawnRegeln.js — Wo der Spieler und die Gegner beim Raumaufbau stehen.
//
// Zwei gemeldete Fehler, eine Datei:
//  A) "Der Spieler spawnt manchmal auf Mauern und kann sich nicht mehr
//     bewegen." Der Spawnplatz wird nach dem VOLLSTAENDIGEN Raumaufbau
//     geprueft (Truhen, Funde, Kammern kommen erst nach der Vorlage), und ein
//     Waechter setzt den Spieler frei, wenn er laenger in einer Wand steckt.
//  B) "In der Ritual Chamber spawnen die Gegner fast immer beim Spawn des
//     Players." Gegnerplaetze halten einen Mindestabstand zum Spieler, der
//     von der Raumgroesse abhaengt, und verteilen sich ueber den Raum.
//
// Die Regeln sind reine Funktionen (ohne Phaser), damit Tests sie mit einer
// offengelegten Liste fuettern koennen, statt seltene Faelle auszuwuerfeln.
(function () {
  'use strict';

  // Spielerkoerper fuer den Fall, dass keiner zur Hand ist: 34x56, die Fuesse
  // auf der Position (player.js richtet den Koerper an den Fuessen aus).
  var KOERPER_ERSATZ = { dx: -13, dy: -54, w: 34, h: 56 };

  /**
   * Mindestabstand eines Gegners zum Spieler beim Spawnen, in px.
   * 40 % der kuerzeren Raumseite, gedeckelt auf 220..300: in kleinen Raeumen
   * (Treasure_Small, 640x512) bleiben 220 px, in grossen gelten wie bisher
   * 300 px (MIN_SPAWN_DISTANCE in enemy.js).
   */
  function mindestAbstand(raumW, raumH) {
    var w = Number(raumW) || 0, h = Number(raumH) || 0;
    var kurz = (w > 0 && h > 0) ? Math.min(w, h) : 0;
    if (!kurz) return 300;
    return Math.max(220, Math.min(300, Math.round(kurz * 0.4)));
  }

  function abstand(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /**
   * Waehlt einen Gegnerplatz aus erreichbaren Kandidaten.
   *
   *  1. Nur Kandidaten mit `mindest` px Abstand zum Spieler.
   *  2. Davon einer mit mindestens `trennung` px Abstand zum naechsten schon
   *     stehenden Gegner (per Zufall); hat keiner so viel Luft, der
   *     luftigste. So fuellt eine Welle den Raum, statt sich zu ballen.
   *  3. Haelt KEIN Kandidat den Mindestabstand (winziger Raum), wird der vom
   *     Spieler am weitesten entfernte genommen — nie ein naeherer als noetig.
   *
   * @param {Array<{x:number,y:number}>} kandidaten
   * @param {{x:number,y:number}|null} spieler
   * @param {Array<{x:number,y:number}>} vorhandene  schon stehende Gegner
   * @param {{mindest?:number, trennung?:number, zufall?:Function}} [opts]
   * @returns {{x:number,y:number}|null}
   */
  function waehleGegnerPlatz(kandidaten, spieler, vorhandene, opts) {
    var o = opts || {};
    var liste = (kandidaten || []).filter(function (k) { return k && isFinite(k.x) && isFinite(k.y); });
    if (!liste.length) return null;
    var mindest = (typeof o.mindest === 'number') ? o.mindest : 300;
    var trennung = (typeof o.trennung === 'number') ? o.trennung : 140;
    var zufall = (typeof o.zufall === 'function') ? o.zufall : Math.random;
    var andere = (vorhandene || []).filter(function (v) { return v && isFinite(v.x) && isFinite(v.y); });

    var weit = spieler
      ? liste.filter(function (k) { return abstand(k, spieler) >= mindest; })
      : liste;
    if (!weit.length) {
      var best = liste[0], bestD = -1;
      liste.forEach(function (k) {
        var d = abstand(k, spieler);
        if (d > bestD) { bestD = d; best = k; }
      });
      return { x: best.x, y: best.y };
    }

    // Luft = Abstand zum naechsten stehenden Gegner. Alle Plaetze mit genug
    // Luft sind gleich gut — einer davon per Zufall, das streut die Welle
    // gleichmaessig. Hat keiner genug, gewinnt der luftigste.
    var mitLuft = [], gewinner = null, gewinnerLuft = -1;
    for (var n = 0; n < weit.length; n++) {
      var k = weit[n], l = Infinity;
      for (var i = 0; i < andere.length && l >= trennung; i++) l = Math.min(l, abstand(k, andere[i]));
      if (l >= trennung) mitLuft.push(k);
      else if (l > gewinnerLuft) { gewinnerLuft = l; gewinner = k; }
    }
    var wahl = mitLuft.length ? mitLuft[Math.floor(zufall() * mitLuft.length) % mitLuft.length] : gewinner;
    return { x: wahl.x, y: wahl.y };
  }

  /** Koerper-Rechteck des Spielers, wenn er auf (x, y) stuende. */
  function koerperBei(x, y, masse) {
    var m = masse || KOERPER_ERSATZ;
    return { x: x + m.dx, y: y + m.dy, w: m.w, h: m.h };
  }

  /**
   * Wie tief ueberlappt das Rechteck `r` mit den festen Rechtecken? Gemessen
   * als groesste Eindringtiefe (kleinere Achse); 0 = frei.
   */
  function eindringtiefe(r, feste) {
    var tief = 0;
    for (var i = 0; i < (feste || []).length; i++) {
      var f = feste[i];
      if (!f) continue;
      var ix = Math.min(r.x + r.w, f.x + f.w) - Math.max(r.x, f.x);
      var iy = Math.min(r.y + r.h, f.y + f.h) - Math.max(r.y, f.y);
      if (ix > 0 && iy > 0) tief = Math.max(tief, Math.min(ix, iy));
    }
    return tief;
  }

  /**
   * Naechster Punkt um (x, y), an dem `istFrei` gilt — Suche in Ringen
   * wachsenden Radius (wie bei Treppen und Hinterhalt), naechste zuerst.
   * @returns {{x:number,y:number}|null}
   */
  function naechsterFreierPunkt(x, y, istFrei, opts) {
    var o = opts || {};
    var schritt = o.schritt || 8;
    var maxRadius = o.maxRadius || 640;
    if (istFrei(x, y)) return { x: x, y: y };
    for (var r = schritt; r <= maxRadius; r += schritt) {
      var ring = [];
      for (var d = -r; d <= r; d += schritt) {
        ring.push({ x: x + d, y: y - r }, { x: x + d, y: y + r });
        if (d !== -r && d !== r) ring.push({ x: x - r, y: y + d }, { x: x + r, y: y + d });
      }
      ring.sort(function (a, b) { return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y); });
      for (var i = 0; i < ring.length; i++) {
        if (istFrei(ring[i].x, ring[i].y)) return ring[i];
      }
    }
    return null;
  }

  /**
   * Steckt der Koerper fest? Er ueberlappt eine Wand um mehr als `toleranz`
   * px UND keine der vier Richtungen (je `ruck` px) waere frei.
   */
  function stecktFest(r, feste, toleranz, ruck) {
    var tol = (typeof toleranz === 'number') ? toleranz : 3;
    var d = ruck || 6;
    if (eindringtiefe(r, feste) <= tol) return false;
    var richtungen = [[-d, 0], [d, 0], [0, -d], [0, d]];
    for (var i = 0; i < richtungen.length; i++) {
      var v = { x: r.x + richtungen[i][0], y: r.y + richtungen[i][1], w: r.w, h: r.h };
      if (eindringtiefe(v, feste) <= tol) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Anbindung an Phaser (nicht rein)
  // ---------------------------------------------------------------------

  /** Koerpermasse relativ zur Position, abgelesen am echten Koerper. */
  function koerperMasse(sprite) {
    var b = sprite && sprite.body;
    if (!b || !isFinite(b.width) || !isFinite(b.height)) return KOERPER_ERSATZ;
    // Der Koerper folgt der Figur erst im naechsten Physikschritt; reset
    // gleicht beides sofort ab (setzt auch die Geschwindigkeit auf 0).
    if (typeof b.reset === 'function') b.reset(sprite.x, sprite.y);
    return { dx: b.x - sprite.x, dy: b.y - sprite.y, w: b.width, h: b.height };
  }

  /** Feste Koerper einer oder mehrerer Gruppen als Rechtecke. */
  function festeRechtecke(gruppen) {
    var raus = [];
    (gruppen || []).forEach(function (g) {
      if (!g || typeof g.getChildren !== 'function') return;
      g.getChildren().forEach(function (o) {
        if (!o || o.active === false || !o.body || o.body.enable === false) return;
        // Offene Tueren und Durchgaenge sind begehbar.
        if (o.getData && o.getData('walkthrough')) return;
        raus.push({ x: o.body.x, y: o.body.y, w: o.body.width, h: o.body.height });
      });
    });
    return raus;
  }

  /**
   * Stellt die Figur auf den naechsten freien Platz, falls ihr Koerper in
   * einer Wand oder einem Hindernis steht. Kein Schaden, kein Effekt.
   * @param {object} sprite   Spielerfigur mit Arcade-Koerper
   * @param {Array} feste     Rechtecke der festen Koerper
   * @param {object} [opts]   { welt: {x,y,w,h}, erreichbar(x,y), toleranz }
   * @returns {{x:number,y:number}|null} neuer Platz, null wenn unveraendert
   */
  function freiStellen(sprite, feste, opts) {
    var o = opts || {};
    if (!sprite || !sprite.body) return null;
    var masse = koerperMasse(sprite);
    var tol = (typeof o.toleranz === 'number') ? o.toleranz : 0.5;
    var welt = o.welt;
    var istFrei = function (x, y) {
      var r = koerperBei(x, y, masse);
      if (welt && (r.x < welt.x || r.y < welt.y || r.x + r.w > welt.x + welt.w || r.y + r.h > welt.y + welt.h)) return false;
      if (eindringtiefe(r, feste) > tol) return false;
      if (typeof o.erreichbar === 'function' && !o.erreichbar(x, y)) return false;
      return true;
    };
    var x0 = sprite.x, y0 = sprite.y;
    if (eindringtiefe(koerperBei(x0, y0, masse), feste) <= tol) return null;
    var p = naechsterFreierPunkt(x0, y0, istFrei, { schritt: 8, maxRadius: o.maxRadius || 640 });
    // Ohne erreichbaren Platz zaehlt wenigstens ein freier.
    if (!p && typeof o.erreichbar === 'function') {
      p = naechsterFreierPunkt(x0, y0, function (x, y) {
        var r = koerperBei(x, y, masse);
        if (welt && (r.x < welt.x || r.y < welt.y || r.x + r.w > welt.x + welt.w || r.y + r.h > welt.y + welt.h)) return false;
        return eindringtiefe(r, feste) <= tol;
      }, { schritt: 8, maxRadius: o.maxRadius || 640 });
    }
    if (!p) return null;
    sprite.setPosition(p.x, p.y);
    if (typeof sprite.body.reset === 'function') sprite.body.reset(p.x, p.y);
    return p;
  }

  /**
   * Waechter je Frame: steckt die Figur laenger als `grenzeMs` fest, wird
   * sie freigestellt. Der Zustand haengt an der Figur.
   * @returns {{x:number,y:number}|null} neuer Platz, wenn eingegriffen wurde
   */
  function steckWaechter(sprite, feste, jetzt, opts) {
    var o = opts || {};
    if (!sprite || !sprite.body || sprite.active === false) return null;
    var grenze = (typeof o.grenzeMs === 'number') ? o.grenzeMs : 500;
    var b = sprite.body;
    var r = { x: b.x, y: b.y, w: b.width, h: b.height };
    if (!stecktFest(r, feste, o.toleranz, o.ruck)) { sprite._steckSeit = null; return null; }
    if (sprite._steckSeit == null) { sprite._steckSeit = jetzt; return null; }
    if (jetzt - sprite._steckSeit < grenze) return null;
    sprite._steckSeit = null;
    var p = freiStellen(sprite, feste, { welt: o.welt, erreichbar: o.erreichbar, toleranz: 0.5 });
    if (p) {
      try { console.warn('[Spawn] Spieler steckte fest — freigestellt auf', Math.round(p.x), Math.round(p.y)); } catch (e) {}
    }
    return p;
  }

  // ---------------------------------------------------------------------
  // Grosse Koerper (Bosse)
  // ---------------------------------------------------------------------
  //
  // "Der Kettenmeister stand in der rechten Wand, unerreichbar." spawnBoss
  // setzte den Boss auf Spieler + Zufallsversatz und pruefte nur die
  // Weltgrenze. Gemessen ueber 3 Laeufe x alle Raeume: der Koerper ueberlappte
  // beim Spawn in 60 % (Kettenmeister) bis 90 % (Elara) der Faelle eine Wand
  // oder ein Hindernis, bis 96 px tief. Arcade trennt so tiefe Ueberlappungen
  // nicht mehr, der Boss blieb stecken.

  /**
   * Platz fuer einen grossen Koerper: der GANZE Koerper (plus `rand`) liegt
   * frei in der Welt, seine Mitte auf einem erreichbaren Kandidaten.
   * Reine Funktion, ohne Zufall.
   *
   *  1. Nur Kandidaten, auf denen der Koerper mit `rand` Luft frei steht
   *     (mit weniger Luft, wenn es mit keinem geht).
   *  2. Davon die mit `mindest` px Abstand zum Spieler — sonst der entfernteste.
   *  3. Unter ihnen der dem Wunschplatz naechste.
   *  4. Passt der Koerper nirgends ganz, der Kandidat mit der geringsten
   *     Ueberlappung. Erreichbar geht vor frei: ein freier Platz hinter der
   *     Wand macht den Kampf unmoeglich.
   *
   * @param {Array<{x:number,y:number}>} kandidaten erreichbare Punkte (Koerpermitte)
   * @param {{dx:number,dy:number,w:number,h:number}} masse Koerper relativ zur Position
   * @param {Array<{x,y,w,h}>} feste Waende und Hindernisse
   * @param {{welt?:{x,y,w,h}, rand?:number, wunsch?:{x,y}, spieler?:{x,y}, mindest?:number}} [opts]
   * @returns {{x:number,y:number}|null} Position der Figur (nicht der Koerpermitte)
   */
  function grosserKoerperPlatz(kandidaten, masse, feste, opts) {
    var o = opts || {};
    var m = masse || KOERPER_ERSATZ;
    var welt = o.welt;
    var spieler = o.spieler || null;
    var mindest = (typeof o.mindest === 'number') ? o.mindest : 0;
    var ziel = o.wunsch || spieler;
    var rand0 = (typeof o.rand === 'number') ? o.rand : 12;
    var raender = [rand0, Math.min(rand0, 4), 0];
    var naheWand = festeNachbarn(feste);

    // Erst ordnen, dann der Reihe nach pruefen: der erste freie gewinnt.
    // (Alle Kandidaten gegen alle Waende zu pruefen dauerte in Hoehlenraeumen
    // mit tausenden Zellen ueber zwei Minuten.)
    var weit = [], nah = [];
    (kandidaten || []).forEach(function (k) {
      if (!k || !isFinite(k.x) || !isFinite(k.y)) return;
      var f = { mitte: k, pos: { x: k.x - m.dx - m.w / 2, y: k.y - m.dy - m.h / 2 } };
      if (!spieler || abstand(k, spieler) >= mindest) {
        f.rang = ziel ? abstand(f.pos, ziel) : 0;
        weit.push(f);
      } else {
        f.rang = -abstand(k, spieler);   // zu nah: der entfernteste zuerst
        nah.push(f);
      }
    });
    var nachRang = function (a, b) { return a.rang - b.rang; };
    var reihe = weit.sort(nachRang).concat(nah.sort(nachRang));
    var rechteck = function (k, rand) {
      return { x: k.x - m.w / 2 - rand, y: k.y - m.h / 2 - rand, w: m.w + 2 * rand, h: m.h + 2 * rand };
    };
    var inWelt = function (r) {
      return !welt || (r.x >= welt.x && r.y >= welt.y && r.x + r.w <= welt.x + welt.w && r.y + r.h <= welt.y + welt.h);
    };
    for (var ri = 0; ri < raender.length; ri++) {
      for (var i = 0; i < reihe.length; i++) {
        var r = rechteck(reihe[i].mitte, raender[ri]);
        if (inWelt(r) && eindringtiefe(r, naheWand(r)) <= 0) return reihe[i].pos;
      }
    }
    var knapp = null, knappTief = Infinity;
    reihe.forEach(function (f) {
      var r = rechteck(f.mitte, 0);
      if (!inWelt(r)) return;
      var t = eindringtiefe(r, naheWand(r));
      if (t < knappTief) { knappTief = t; knapp = f; }
    });
    return knapp ? knapp.pos : null;
  }

  /** Raster ueber die festen Rechtecke: liefert nur die, die `r` beruehren koennten. */
  function festeNachbarn(feste) {
    var Z = 64, fach = {};
    (feste || []).forEach(function (f) {
      if (!f) return;
      for (var gx = Math.floor(f.x / Z); gx <= Math.floor((f.x + f.w) / Z); gx++) {
        for (var gy = Math.floor(f.y / Z); gy <= Math.floor((f.y + f.h) / Z); gy++) {
          (fach[gx + '|' + gy] || (fach[gx + '|' + gy] = [])).push(f);
        }
      }
    });
    return function (r) {
      var raus = [];
      for (var gx = Math.floor(r.x / Z); gx <= Math.floor((r.x + r.w) / Z); gx++) {
        for (var gy = Math.floor(r.y / Z); gy <= Math.floor((r.y + r.h) / Z); gy++) {
          var l = fach[gx + '|' + gy];
          if (l) for (var i = 0; i < l.length; i++) raus.push(l[i]);
        }
      }
      return raus;
    };
  }

  /**
   * Stellt einen grossen Koerper (Boss) auf einen freien, erreichbaren Platz,
   * moeglichst nah am Wunschplatz. Kandidaten sind die erreichbaren Zellen
   * des Raums (scene._accessibleArea). Ohne Kandidaten der naechste freie
   * Punkt um die Weltmitte.
   * @param {object} scene
   * @param {object} sprite   Figur mit Arcade-Koerper (Groesse schon gesetzt)
   * @param {Array} feste     Rechtecke der festen Koerper
   * @param {{wunsch?:{x,y}, mindest?:number, rand?:number}} [opts]
   * @returns {{x:number,y:number}|null} neuer Platz
   */
  function grossFreiStellen(scene, sprite, feste, opts) {
    var o = opts || {};
    if (!sprite || !sprite.body) return null;
    var masse = koerperMasse(sprite);
    var wb = scene && scene.physics && scene.physics.world && scene.physics.world.bounds;
    var welt = wb ? { x: wb.x, y: wb.y, w: wb.width, h: wb.height } : null;
    var a = scene && scene._accessibleArea;
    var zellen = (a && a.reachableCells && a.reachableCells.length) ? a.reachableCells
      : (a && a.fallbackCandidates) || [];
    // Die Koerpermitte darf irgendwo in der erreichbaren Zelle liegen, nicht
    // nur auf ihrer Mitte: in engen Raeumen passt ein grosser Boss sonst um
    // wenige Pixel nirgends hin.
    var VERSATZ = [0, -12, 12, -6, 6];
    var kandidaten = [];
    zellen.forEach(function (c) {
      VERSATZ.forEach(function (vx) {
        VERSATZ.forEach(function (vy) { kandidaten.push({ x: c.x + vx, y: c.y + vy }); });
      });
    });
    var sp = (typeof player !== 'undefined' && player && player.body)
      ? { x: player.body.x + player.body.width / 2, y: player.body.y + player.body.height / 2 } : null;
    var p = grosserKoerperPlatz(kandidaten, masse, feste, {
      welt: welt, rand: o.rand, wunsch: o.wunsch || { x: sprite.x, y: sprite.y },
      spieler: sp, mindest: o.mindest || 0
    });
    if (!p && welt && !kandidaten.length) {
      p = naechsterFreierPunkt(welt.x + welt.w / 2, welt.y + welt.h / 2, function (x, y) {
        var r = koerperBei(x, y, masse);
        if (r.x < welt.x || r.y < welt.y || r.x + r.w > welt.x + welt.w || r.y + r.h > welt.y + welt.h) return false;
        return eindringtiefe(r, feste) <= 0;
      }, { schritt: 16, maxRadius: Math.max(welt.w, welt.h) });
    }
    if (!p) return null;
    sprite.setPosition(p.x, p.y);
    if (typeof sprite.body.reset === 'function') sprite.body.reset(p.x, p.y);
    return p;
  }

  var api = {
    grosserKoerperPlatz: grosserKoerperPlatz,
    grossFreiStellen: grossFreiStellen,
    mindestAbstand: mindestAbstand,
    waehleGegnerPlatz: waehleGegnerPlatz,
    koerperBei: koerperBei,
    eindringtiefe: eindringtiefe,
    naechsterFreierPunkt: naechsterFreierPunkt,
    stecktFest: stecktFest,
    koerperMasse: koerperMasse,
    festeRechtecke: festeRechtecke,
    freiStellen: freiStellen,
    steckWaechter: steckWaechter,
  };
  if (typeof window !== 'undefined') window.SpawnRegeln = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
