/* =====================================================================
 * uiRahmen.js — gestaltete Rahmen, Knoepfe und Toast-Banner (#189, #182)
 * ---------------------------------------------------------------------
 * Ein gemeinsamer Satz PixelLab-Grafiken (assets/ui/ui_*.png) im Stil des
 * Talentbaums (Messing, dunkles Anthrazit, Nieten). Noch NICHT fest im
 * Spiel: alles wirkt nur mit der Debug-Flagge `?debug=1&ui=neu`. Ohne
 * Flagge liefert an() false und jede Aufrufstelle zeichnet wie bisher.
 *
 * Neunteilig statt Phaser add.nineslice: das laeuft in 3.70 nur unter
 * WebGL und bleibt im Canvas-Renderer (und headless) unsichtbar. Das
 * Muster stammt aus SkillTreeScene (neun Bild-Teile mit eigenen Frames,
 * Ecken optional verkleinert); hier fuer die Wiederverwendung gehoben.
 * ===================================================================== */
(function () {
  'use strict';

  // Rand = Breite der festen Ecke im Originalbild (in Pixeln).
  var RAHMEN = 'ui_rahmen', RAHMEN_RAND = 36;
  var TOAST = 'ui_toast', TOAST_RAND = 46;
  var KNOPF = 'ui_knopf', KNOPF_RAND = 14;
  // Knopfzustaende: eigene Bilder, aus dem einen PixelLab-Knopf abgeleitet
  // (heller, gedrueckt, entsaettigt) — so bleiben sie garantiert deckungsgleich.
  var KNOPF_ZUSTAND = {
    normal: 'ui_knopf',
    hover: 'ui_knopf_hover',
    gedrueckt: 'ui_knopf_gedrueckt',
    aus: 'ui_knopf_aus'
  };
  // Symbol je Toast-Art (Ereignis, Gefahr, Fund, Quest).
  var SYMBOLE = ['ui_symbol_ereignis', 'ui_symbol_gefahr', 'ui_symbol_fund', 'ui_symbol_quest'];
  var ART_SYMBOL = {
    ambush: 'gefahr', elite_ambush: 'gefahr', environmental_hazard: 'gefahr',
    trapped_chest: 'gefahr', hinterhalt: 'gefahr', elara_besessen: 'gefahr',
    treasure_cache: 'fund', gambling: 'fund', chain_lock: 'fund',
    wandering_merchant: 'fund', sacrifice_altar: 'fund',
    quest_objective_done: 'quest', level_up: 'quest', finale: 'quest', edikt: 'quest',
    lore_fragment: 'ereignis', shrine_buff: 'ereignis', healing_fountain: 'ereignis'
  };

  var ALLE = [RAHMEN, TOAST, KNOPF_ZUSTAND.normal, KNOPF_ZUSTAND.hover,
    KNOPF_ZUSTAND.gedrueckt, KNOPF_ZUSTAND.aus].concat(SYMBOLE);

  /** Ist der neue Stil eingeschaltet? (?debug=1&ui=neu) */
  function an() {
    try { return !!(window.DebugGate && window.DebugGate.an('ui')); } catch (e) { return false; }
  }

  function _fehlend(scene) {
    if (!scene || !scene.textures) return ALLE.slice();
    return ALLE.filter(function (k) { return !scene.textures.exists(k); });
  }

  /** Alle Grafiken da? */
  function bereit(scene) { return _fehlend(scene).length === 0; }

  /** Im preload() einer Szene: die Grafiken mitladen (nur mit Flagge). */
  function vorladen(scene) {
    if (!an() || !scene || !scene.load) return;
    _fehlend(scene).forEach(function (k) { scene.load.image(k, 'assets/ui/' + k + '.png'); });
  }

  /**
   * Nachladen zur Laufzeit; fertig() laeuft sofort, wenn alles da ist, sonst
   * nach dem Laden (und nur, wenn die Szene dann noch lebt).
   */
  function nachladen(scene, fertig) {
    var fehlt = _fehlend(scene);
    if (!fehlt.length) { if (fertig) fertig(); return; }
    if (!scene || !scene.load) return;
    fehlt.forEach(function (k) { scene.load.image(k, 'assets/ui/' + k + '.png'); });
    scene.load.once('complete', function () {
      if (fertig && scene.sys && scene.sys.isActive && scene.sys.isActive()) fertig();
    });
    if (!scene.load.isLoading()) scene.load.start();
  }

  /**
   * Neun Bild-Teile: Ecken fest, Kanten und Mitte gedehnt. massstab
   * verkleinert die Ecken; ist die Flaeche kleiner als zwei Raender,
   * schrumpfen sie mit. Liefert die Teile (Reihenfolge: Zeile fuer Zeile).
   */
  /** Die neun Frames einer Textur anlegen (einmal je Textur und Rand). */
  function _frames(scene, key, rand) {
    var tex = scene.textures.get(key);
    var pre = 'u9_' + rand + '_';
    if (tex.has(pre + '0')) return pre;
    var src = tex.getSourceImage();
    var W = src.width, H = src.height;
    var xs = [0, rand, W - rand, W], ys = [0, rand, H - rand, H];
    for (var j = 0; j < 3; j++) {
      for (var i = 0; i < 3; i++) {
        tex.add(pre + (j * 3 + i), 0, xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]);
      }
    }
    return pre;
  }

  function neunteilig(scene, key, cx, cy, w, h, rand, depth, massstab) {
    var pre = _frames(scene, key, rand);
    var r = Math.min(Math.round(rand * (massstab || 1)), Math.floor(w / 2), Math.floor(h / 2));
    var left = Math.round(cx - w / 2), top = Math.round(cy - h / 2);
    var bx = [0, r, w - r], by = [0, r, h - r];
    var bw = [r, w - 2 * r, r], bh = [r, h - 2 * r, r];
    var teile = [];
    for (var jj = 0; jj < 3; jj++) {
      for (var ii = 0; ii < 3; ii++) {
        if (bw[ii] <= 0 || bh[jj] <= 0) continue;
        var t = scene.add.image(left + bx[ii], top + by[jj], key, pre + (jj * 3 + ii))
          .setOrigin(0, 0).setDisplaySize(bw[ii], bh[jj]).setScrollFactor(0).setDepth(depth);
        t._u9 = { key: key, rand: rand, nr: jj * 3 + ii };
        teile.push(t);
      }
    }
    return teile;
  }

  /** Grosse Platte fuer Menues und Dialoge. */
  function platte(scene, cx, cy, w, h, depth, massstab) {
    return neunteilig(scene, RAHMEN, cx, cy, w, h, RAHMEN_RAND, depth, massstab || 0.6);
  }

  /** Banner fuer Toasts. */
  function banner(scene, cx, cy, w, h, depth) {
    return neunteilig(scene, TOAST, cx, cy, w, h, TOAST_RAND, depth, 0.5);
  }

  /** Symbolschluessel fuer eine Toast-Art. */
  function symbol(eventId) {
    return 'ui_symbol_' + (ART_SYMBOL[eventId] || 'ereignis');
  }

  /**
   * Kleidet ein bestehendes Rechteck als Knopf ein: es bleibt Trefferflaeche
   * (seine Klick-Logik bleibt unberuehrt), wird aber selbst unsichtbar
   * gezeichnet; darunter liegt der neunteilige Knopf, der auf Hover und
   * Druck sein Bild wechselt.
   *
   * Die Szenen faerben ihre Rechtecke beim Hover neu (setFillStyle) — das
   * wird fuer dieses Rechteck abgeschaltet, sonst laege die alte Farbe
   * wieder ueber dem Bild.
   *
   * Ruhezustand: setStrokeStyle bleibt als Signal erhalten. Die Szenen
   * markieren damit den gewaehlten Reiter (Rand 0xffd166) und schalten
   * Knoepfe ab (rect._enabled === false, so in den Einstellungen) — das
   * wird zu "gewaehlt" (helles Bild) bzw. "aus" (entsaettigtes Bild).
   *
   * Flache Knoepfe (unter 30 px) bekommen halb so grosse Ecken, sonst
   * bleibt von ihnen nur ein Nietenpaar.
   *
   * @param {object} opts { deaktiviert, massstab }
   */
  function knopf(rect, opts) {
    opts = opts || {};
    var scene = rect && rect.scene;
    if (!scene || !bereit(scene)) return null;
    var w = rect.width * Math.abs(rect.scaleX || 1), h = rect.height * Math.abs(rect.scaleY || 1);
    var cx = rect.x + (0.5 - rect.originX) * w, cy = rect.y + (0.5 - rect.originY) * h;
    function ruheAus(farbe) {
      if (opts.deaktiviert || rect._enabled === false) return 'aus';
      return farbe === 0xffd166 ? 'hover' : 'normal';
    }
    var ruhe = ruheAus(rect.isStroked ? rect.strokeColor : null);
    var teile = neunteilig(scene, KNOPF_ZUSTAND[ruhe], cx, cy, w, h, KNOPF_RAND,
      rect.depth - 0.01, opts.massstab || (h < 30 ? 0.5 : 1));
    // Gleiche Bildlauf-Faktoren und gleicher Behaelter wie das Rechteck.
    var cont = rect.parentContainer;
    teile.forEach(function (t) {
      t.setScrollFactor(rect.scrollFactorX, rect.scrollFactorY);
      t.setVisible(rect.visible);
      if (cont) {
        cont.addAt(t, Math.max(0, cont.getIndex(rect)));
      }
    });
    rect.isFilled = false;
    rect.isStroked = false;
    rect.setFillStyle = function () { return rect; };
    rect.setStrokeStyle = function (breite, farbe) {
      ruhe = ruheAus(farbe);
      setze(ruhe);
      return rect;
    };

    function setze(z) {
      teile.forEach(function (t) {
        if (t.scene) t.setTexture(KNOPF_ZUSTAND[z], 'u9_' + KNOPF_RAND + '_' + t._u9.nr);
      });
    }
    // Die Frames muessen auf jedem Zustandsbild existieren.
    Object.keys(KNOPF_ZUSTAND).forEach(function (z) { _frames(scene, KNOPF_ZUSTAND[z], KNOPF_RAND); });
    rect.on('pointerover', function () { if (ruhe !== 'aus') setze('hover'); });
    rect.on('pointerout', function () { setze(ruhe); });
    rect.on('pointerdown', function () { if (ruhe !== 'aus') setze('gedrueckt'); });
    rect.on('pointerup', function () { if (ruhe !== 'aus') setze('hover'); });
    // Sichtbarkeit und Abbau folgen dem Rechteck.
    var altSichtbar = rect.setVisible;
    rect.setVisible = function (v) {
      teile.forEach(function (t) { if (t.scene) t.setVisible(v); });
      return altSichtbar.call(rect, v);
    };
    var altAlpha = rect.setAlpha;
    rect.setAlpha = function (a) {
      teile.forEach(function (t) { if (t.scene) t.setAlpha(a); });
      return altAlpha.apply(rect, arguments);
    };
    rect.once('destroy', function () {
      teile.forEach(function (t) { if (t.scene) t.destroy(); });
    });
    rect._uiKnopf = { teile: teile, setze: setze };
    return rect._uiKnopf;
  }

  /**
   * Alle Knoepfe einer Menue-Szene einkleiden, auch die, die sie spaeter
   * neu aufbaut (Reiter, Listen, Kauf-Knoepfe nach jedem Kauf).
   *
   * Ein Knopf ist in diesen Szenen immer dasselbe: ein interaktives
   * Rechteck mit Rand, nicht groesser als eine Zeile. Statt jede der
   * Dutzenden Aufrufstellen umzubauen, schaut die Szene nach jedem
   * update() einmal nach neuen solchen Rechtecken (vor dem Zeichnen, damit
   * nie ein Bild ohne Rahmen erscheint). Wer ausgenommen sein soll, setzt
   * rect._uiOhne; einen deaktivierten Knopf markiert rect._uiAus.
   */
  function einkleiden(scene, opts) {
    if (!an() || !scene || !scene.sys || scene._uiEinkleiden) return;
    if (!bereit(scene)) { nachladen(scene, function () { einkleiden(scene, opts); }); return; }
    opts = opts || {};
    var maxW = opts.maxBreite || 320, maxH = opts.maxHoehe || 48;
    function pruefe(o) {
      if (o.type === 'Container') { o.list.forEach(pruefe); return; }
      if (o.type !== 'Rectangle' || o._uiKnopf || o._uiOhne || !o.isStroked) return;
      if (!o._uiAus && (!o.input || !o.input.enabled)) return;
      if (o.width > maxW || o.height > maxH) return;
      knopf(o, { deaktiviert: !!o._uiAus });
    }
    function lauf() { scene.children.list.slice().forEach(pruefe); }
    scene._uiEinkleiden = lauf;
    scene.sys.events.on('postupdate', lauf);
    scene.sys.events.once('shutdown', function () {
      scene.sys.events.off('postupdate', lauf);
      scene._uiEinkleiden = null;
    });
    lauf();
  }

  /** Menue-Platte, wenn der neue Stil an und geladen ist; sonst null. */
  function menuePlatte(scene, cx, cy, w, h, depth) {
    if (!an() || !bereit(scene)) return null;
    return platte(scene, cx, cy, w, h, depth, 0.55);
  }

  var uiRahmen = {
    an: an, bereit: bereit, vorladen: vorladen, nachladen: nachladen,
    neunteilig: neunteilig, platte: platte, banner: banner, knopf: knopf, symbol: symbol,
    einkleiden: einkleiden, menuePlatte: menuePlatte,
    ALLE: ALLE
  };
  if (typeof window !== 'undefined') window.uiRahmen = uiRahmen;
})();
