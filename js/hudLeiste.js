/* =====================================================================
 * hudLeiste.js — Faehigkeitsleiste mit Pixel-Icons (#195)
 * ---------------------------------------------------------------------
 * Desktop: klassische Aktionsleiste unten mittig — quadratische
 * Messingfelder in der Reihenfolge der Tasten (Angriff, Rolle, Q W E R,
 * Trank). Mobile: dieselben Icons in Messingringen auf den Kreisen von
 * mobileControls (die bleiben Trefferflaeche, Lage und Groesse unveraendert).
 *
 * Beide lesen ihren Zustand aus EINER Funktion (zustand) und zeichnen
 * ihn mit EINER Anzeige (Sweep + Restsekunden + Aufleuchten), damit
 * Desktop und Mobile dasselbe zeigen. Alles wird einmal angelegt; je Bild
 * wird nur neu gezeichnet, wenn sich der Anteil sichtbar geaendert hat.
 *
 * Icons: assets/ui/hud_icons.png, ein Streifen aus 48x48-Feldern, oben
 * farbig, darunter entsaettigt (gesperrt). Gebaut von tools/hudIconsBauen.js
 * aus den PixelLab-Rohbildern unter tools/rohbilder/hudicons/.
 *
 * Rueckfall, wenn der Streifen nicht geladen ist: Felder und Ringe stehen
 * trotzdem, statt des Icons zeigen sie einen kurzen Namen (ersatz), und
 * Sweep, Zahl und Zustaende laufen wie sonst.
 * ===================================================================== */
(function () {
  'use strict';

  // Reihenfolge der Bilder im Streifen — tools/hudIconsBauen.js liest sie hier.
  // Neue Icons nur hinten anhaengen, sonst verschieben sich die Frames.
  var REIHE = ['angriff', 'rolle', 'trank', 'aktion', 'portraet',
    'hammer', 'steelGrasp', 'charge', 'frenzy', 'berserk', 'whirlwind',
    'twistingBlades', 'cycloneStrike', 'frostNova', 'teleportDash', 'heilwunde', 'deathBlow',
    'inventar', 'menue', 'feedback'];
  var KEY = 'hud_icons';
  var KANTE = 48;
  var BILD_V = 3;
  // Feste Knoepfe -> Bildname; Faehigkeiten heissen wie ihre ID.
  var NAME = { attack: 'angriff', roll: 'rolle', potion: 'trank', interact: 'aktion', portrait: 'portraet',
    inventory: 'inventar', menu: 'menue', feedback: 'feedback' };

  // Leiste (Desktop): Feldkante, Icon darin, Abstand, Rand unten.
  var FELD = 52, ICON = 40, ABSTAND = 6, RAND_UNTEN = 8;
  var TIEFE = 1001;
  var MESSING = '#f3e6c4';

  if (typeof window !== 'undefined' && window.i18n) {
    window.i18n.register('de', {
      'hud.leiste.taste.leer': 'Leer',
      'hud.leiste.taste.leer_kurz': 'Leer',
      'hud.leiste.ersatz.attack': 'Hieb',
      'hud.leiste.ersatz.roll': 'Rolle',
      'hud.leiste.ersatz.potion': 'Trank',
      'hud.leiste.ersatz.interact': 'Aktion'
    });
    window.i18n.register('en', {
      'hud.leiste.taste.leer': 'Space',
      'hud.leiste.taste.leer_kurz': 'Spc',
      'hud.leiste.ersatz.attack': 'Hit',
      'hud.leiste.ersatz.roll': 'Roll',
      'hud.leiste.ersatz.potion': 'Potion',
      'hud.leiste.ersatz.interact': 'Use'
    });
  }
  function T(key, rueck) {
    try {
      var v = window.i18n && window.i18n.t(key);
      return (typeof v === 'string' && v.indexOf('[MISSING') !== 0) ? v : rueck;
    } catch (e) { return rueck; }
  }

  /** Im preload(): den Icon-Streifen laden, falls er noch fehlt. */
  function vorladen(scene) {
    if (!scene || !scene.load || !scene.textures || scene.textures.exists(KEY)) return;
    scene.load.spritesheet(KEY, 'assets/ui/hud_icons.png?v=' + BILD_V, { frameWidth: KANTE, frameHeight: KANTE });
  }

  function bereit(scene) { return !!(scene && scene.textures && scene.textures.exists(KEY)); }

  /** Frame-Nummer eines Icons; grau = die entsaettigte Zeile darunter. -1 = unbekannt. */
  function frame(id, grau) {
    var n = REIHE.indexOf(NAME[id] || id);
    if (n < 0) return -1;
    return grau ? n + REIHE.length : n;
  }

  /** Kurzer Name fuer den Rueckfall ohne Icon-Streifen. */
  function ersatzName(id) {
    if (NAME[id]) return T('hud.leiste.ersatz.' + id, id);
    var defs = window.AbilitySystem && window.AbilitySystem.ABILITY_DEFS;
    var name = (defs && defs[id] && defs[id].name) || String(id || '');
    // Erstes Wort, hoechstens 7 Zeichen: passt bei 11 px in ein Feld.
    return name.split(' ')[0].slice(0, 7);
  }

  function _zahlTraenke() {
    var inv = Array.isArray(window.inventory) ? window.inventory : [];
    var n = 0;
    for (var i = 0; i < inv.length; i++) if (inv[i] && inv[i].type === 'potion') n += (inv[i].stack || 1);
    return n;
  }

  function _jetzt(scene) {
    if (typeof window.gameNow === 'function') return window.gameNow(scene);
    return (scene && scene.time) ? scene.time.now : 0;
  }

  /**
   * Zustand eines Knopfs, fuer Desktop und Mobile gleich.
   * key: attack | roll | potion | interact | slot1..4; abilityId fuer Slots.
   * rest/dauer in ms (dauer 0 = unbekannt, die Anzeige merkt sie sich selbst),
   * gesperrt = entsaettigt zeigen, anzahl/ladungen nur beim Trank.
   */
  function zustand(key, abilityId, scene) {
    var z = { rest: 0, dauer: 0, gesperrt: false, anzahl: null, ladungen: null, ladungenMax: 0 };
    if (key === 'attack') {
      var m = window.__abilityCooldownMs__;
      z.rest = (m && m.attack) || 0;
    } else if (key === 'roll') {
      z.rest = window.__rollCooldownRemainingMs__ || 0;
      z.dauer = window.__rollCooldownDurationMs__ || 0;
    } else if (key === 'potion') {
      var LS = window.LootSystem;
      z.anzahl = _zahlTraenke();
      if (LS) {
        if (typeof LS.isPotionOnCooldown === 'function' && LS.isPotionOnCooldown()
            && typeof LS._getPotionCooldownRemaining === 'function') z.rest = LS._getPotionCooldownRemaining() || 0;
        if (typeof LS.getPotionCooldownDuration === 'function') z.dauer = LS.getPotionCooldownDuration() || 0;
        if (typeof LS.getPotionCharges === 'function') z.ladungen = LS.getPotionCharges();
        if (typeof LS.getPotionChargesMax === 'function') z.ladungenMax = LS.getPotionChargesMax();
      }
      z.gesperrt = z.anzahl === 0;
    } else if (abilityId) {
      var A = window.AbilitySystem;
      if (A) {
        if (typeof A.getCooldownRemaining === 'function') z.rest = A.getCooldownRemaining(abilityId, _jetzt(scene)) || 0;
        if (typeof A.getCooldownDuration === 'function') z.dauer = A.getCooldownDuration(abilityId) || 0;
        if (!z.dauer && A.ABILITY_DEFS && A.ABILITY_DEFS[abilityId]) z.dauer = A.ABILITY_DEFS[abilityId].cooldownMs || 0;
        if (typeof A.isLearned === 'function') z.gesperrt = !A.isLearned(abilityId);
      }
      // Stufe 3: von Elara genommen -> entsaettigt, bis Du es zurueckholst.
      var EK = window.ElaraKampf;
      if (EK && typeof EK.gesperrt === 'function' && EK.gesperrt(abilityId)) { z.gesperrt = true; z.genommen = true; }
    }
    if (!(z.rest > 0)) z.rest = 0;
    return z;
  }

  // Ecken eines Quadrats als Winkel (Bildschirmkoordinaten, y nach unten).
  var ECKEN = [-3 * Math.PI / 4, -Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4];

  /**
   * Dunkler Sweep fuer den noch offenen Teil, im Uhrzeigersinn ab oben.
   * Beim Quadrat genau an den Rand geschnitten (Ecken als Stuetzpunkte),
   * beim Kreis in feinen Schritten.
   */
  function zeichneSweep(g, form, r, anteil) {
    g.clear();
    if (!(anteil > 0)) return;
    var a0 = -Math.PI / 2, a1 = a0 + Math.min(1, anteil) * Math.PI * 2;
    var winkel = [a0];
    if (form === 'kreis') {
      var n = Math.max(2, Math.ceil(anteil * 64));
      for (var i = 1; i < n; i++) winkel.push(a0 + (a1 - a0) * i / n);
    } else {
      for (var k = 0; k < 3; k++) {
        ECKEN.forEach(function (e) {
          var w = e + k * Math.PI * 2 - Math.PI * 2;
          if (w > a0 && w < a1) winkel.push(w);
        });
      }
      winkel.sort(function (a, b) { return a - b; });
    }
    winkel.push(a1);
    var punkte = [{ x: 0, y: 0 }];
    winkel.forEach(function (a) {
      var c = Math.cos(a), s = Math.sin(a);
      var d = form === 'kreis' ? r : r / Math.max(Math.abs(c), Math.abs(s));
      punkte.push({ x: c * d, y: s * d });
    });
    g.fillStyle(0x000000, 0.62);
    g.fillPoints(punkte, true);
  }

  /**
   * Eine Knopf-Anzeige: Icon (bzw. Ersatzname), Sweep, Restsekunden,
   * Aufleuchten. In einem Container (Mitte = 0,0). form 'quadrat' (Desktop)
   * oder 'kreis' (Mobile), r = halbe Kante bzw. Radius der Sweep-Flaeche.
   */
  function baueAnzeige(scene, c, form, r, iconGroesse, schrift) {
    var mitBild = bereit(scene);
    // Ohne Streifen ein leeres Bild statt Phasers gruenem Platzhalter.
    var icon = scene.add.image(0, 0, mitBild ? KEY : '__DEFAULT', mitBild ? 0 : undefined)
      .setDisplaySize(iconGroesse, iconGroesse).setScrollFactor(0).setVisible(false);
    var ersatz = scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: Math.max(10, Math.round(schrift * 0.7)) + 'px', fontStyle: 'bold',
      color: MESSING, stroke: '#000000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false);
    var sweep = scene.add.graphics().setScrollFactor(0);
    var blitz = form === 'kreis'
      ? scene.add.circle(0, 0, r, 0xffe7a3, 1)
      : scene.add.rectangle(0, 0, r * 2, r * 2, 0xffe7a3, 1);
    blitz.setScrollFactor(0).setAlpha(0);
    var zahl = scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: schrift + 'px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false);
    c.add([icon, ersatz, sweep, blitz, zahl]);
    return {
      form: form, r: r, mitBild: mitBild, icon: icon, ersatz: ersatz, sweep: sweep, blitz: blitz, zahl: zahl,
      id: null, grau: null, anteil: 0, rest: 0, dauer: 0, zahlText: '', zeichnungen: 0
    };
  }

  /** Icon setzen (nur bei Wechsel); ohne Bild der Ersatzname, gesperrt grau. */
  function setzeIcon(a, id, grau, erzwingen) {
    if (!erzwingen && a.id === id && a.grau === !!grau) return;
    a.id = id; a.grau = !!grau;
    var f = a.mitBild ? frame(id, grau) : -1;
    a.icon.setVisible(f >= 0);
    if (f >= 0) a.icon.setFrame(f);
    a.ersatz.setVisible(f < 0 && !!id);
    if (f < 0 && id) {
      a.ersatz.setText(ersatzName(id));
      a.ersatz.setColor(grau ? '#bdb4a6' : MESSING);
    }
  }

  /** Den Zustand eines Bildes auftragen; zeichnet nur bei sichtbarer Aenderung. */
  function takt(scene, a, z) {
    var rest = z.rest || 0;
    // Dauer unbekannt (Angriff): beim Start steht die volle Dauer als Rest da.
    if (z.dauer > 0) a.dauer = z.dauer;
    else if (rest > a.rest) a.dauer = rest;
    var anteil = (rest > 0 && a.dauer > 0) ? Math.min(1, rest / a.dauer) : 0;
    anteil = Math.ceil(anteil * 120) / 120;
    if (anteil !== a.anteil) {
      zeichneSweep(a.sweep, a.form, a.r, anteil);
      a.anteil = anteil;
      a.zeichnungen++;
    }
    var text = rest <= 0 ? '' : (rest >= 1000 ? String(Math.ceil(rest / 1000)) : (rest / 1000).toFixed(1));
    if (text !== a.zahlText) {
      a.zahlText = text;
      a.zahl.setText(text);
      a.zahl.setVisible(text !== '');
    }
    // "Bereit": kurzes Aufleuchten in dem Bild, in dem die Abklingzeit endet.
    if (a.rest > 0 && rest <= 0 && scene && scene.tweens) {
      a.blitz.setAlpha(0.75);
      scene.tweens.add({ targets: a.blitz, alpha: 0, duration: 380, ease: 'Quad.Out' });
    }
    a.rest = rest;
  }

  // ---------------------------------------------------------------------
  // Desktop: die Leiste
  // ---------------------------------------------------------------------

  var _leiste = null;

  function _tastenText(key, idx) {
    if (key === 'attack') {
      // Mit Zusatztaste (Einstellungen) knapp beide: "Leer/X", passt ins Feld.
      var zusatz = { x: 'X', y: 'Y', num0: 'N0' }[
        window.InputScheme && typeof window.InputScheme.getExtraAttackKey === 'function'
          ? window.InputScheme.getExtraAttackKey() : 'none'];
      return zusatz ? T('hud.leiste.taste.leer_kurz', 'Leer') + '/' + zusatz
        : T('hud.leiste.taste.leer', 'Leer');
    }
    if (key === 'roll') return 'Shift';
    if (key === 'potion') return 'F';
    var IS = window.InputScheme;
    if (IS && typeof IS.getSlotLabel === 'function') return IS.getSlotLabel(idx);
    return ['Q', 'W', 'E', 'R'][idx - 1] || '';
  }

  function _baueFeld(scene, wurzel, key, slotIdx) {
    var UR = window.uiRahmen;
    var c = scene.add.container(0, 0).setScrollFactor(0);
    var tex = (UR && UR.bereit(scene)) ? UR.feldBild(scene, FELD, FELD) : null;
    var grund = tex
      ? scene.add.image(0, 0, tex)
      : scene.add.rectangle(0, 0, FELD, FELD, 0x1c191f, 0.92).setStrokeStyle(2, 0xb08d57, 1);
    grund.setScrollFactor(0);
    c.add(grund);
    var a = baueAnzeige(scene, c, 'quadrat', FELD / 2 - 5, ICON, 16);
    // Taste klein oben links, auf eigener dunkler Marke (immer lesbar).
    var marke = scene.add.rectangle(-FELD / 2 + 3, -FELD / 2 + 3, 10, 13, 0x120e0b, 0.9)
      .setOrigin(0, 0).setStrokeStyle(1, 0xb08d57, 0.9).setScrollFactor(0);
    var taste = scene.add.text(-FELD / 2 + 6, -FELD / 2 + 3, '', {
      fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: MESSING
    }).setScrollFactor(0);
    c.add([marke, taste]);
    var feld = { key: key, slotIdx: slotIdx, c: c, a: a, marke: marke, taste: taste, abilityId: null };
    if (key === 'potion') {
      feld.anzahl = scene.add.text(FELD / 2 - 4, FELD / 2 - 3, '', {
        fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: MESSING,
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(1, 1).setScrollFactor(0);
      feld.pips = [];
      var max = (window.LootSystem && typeof window.LootSystem.getPotionChargesMax === 'function')
        ? window.LootSystem.getPotionChargesMax() : 3;
      for (var i = 0; i < max; i++) {
        feld.pips.push(scene.add.circle(-FELD / 2 + 8 + i * 7, FELD / 2 - 7, 2.5, 0x78f3c7, 1)
          .setStrokeStyle(1, 0x000000, 0.8).setScrollFactor(0));
      }
      c.add([feld.anzahl].concat(feld.pips));
      feld.anzahlWert = null; feld.ladungenWert = null;
    }
    wurzel.add(c);
    return feld;
  }

  function _setzeTaste(feld) {
    var t = _tastenText(feld.key, feld.slotIdx);
    if (feld.taste.text === t) return;
    feld.taste.setText(t);
    feld.marke.setSize(Math.ceil(feld.taste.width) + 6, 13);
  }

  /** Belegung neu lesen (Icons, Tasten, welche Slots sichtbar) und mittig anordnen. */
  function _auffrischen() {
    var L = _leiste;
    if (!L || !L.scene || !L.wurzel.scene) return;
    var A = window.AbilitySystem;
    var loadout = (A && typeof A.getActiveLoadout === 'function') ? A.getActiveLoadout() : null;
    var sichtbar = [];
    L.felder.forEach(function (f) {
      _setzeTaste(f);
      if (f.slotIdx) {
        var id = loadout ? loadout['slot' + f.slotIdx] : null;
        f.abilityId = id || null;
        f.c.setVisible(!!id);
        if (!id) return;
        setzeIcon(f.a, id, false, true);
      } else {
        // erzwingen: der Ersatzname folgt so auch einem Sprachwechsel.
        setzeIcon(f.a, f.key, f.a.grau, true);
      }
      sichtbar.push(f);
    });
    var breite = sichtbar.length * FELD + (sichtbar.length - 1) * ABSTAND;
    var w = L.scene.scale.width, h = L.scene.scale.height;
    var x0 = Math.round(w / 2 - breite / 2 + FELD / 2);
    var y = Math.round(h - RAND_UNTEN - FELD / 2);
    sichtbar.forEach(function (f, i) { f.c.setPosition(x0 + i * (FELD + ABSTAND), y); });
  }

  function _taktLeiste() {
    var L = _leiste;
    if (!L || !L.wurzel.scene || !L.wurzel.visible) return;
    L.felder.forEach(function (f) {
      if (!f.c.visible) return;
      var z = zustand(f.key, f.abilityId, L.scene);
      setzeIcon(f.a, f.abilityId || f.key, z.gesperrt);
      takt(L.scene, f.a, z);
      if (f.key === 'potion') {
        if (z.anzahl !== f.anzahlWert) {
          f.anzahlWert = z.anzahl;
          f.anzahl.setText(String(z.anzahl));
          f.anzahl.setColor(z.anzahl > 0 ? MESSING : '#bdb4a6');
        }
        if (z.ladungen !== f.ladungenWert) {
          f.ladungenWert = z.ladungen;
          f.pips.forEach(function (p, i) {
            var frei = z.ladungen == null || i < z.ladungen;
            p.setFillStyle(frei ? 0x78f3c7 : 0x333333, frei ? 1 : 0.7);
          });
        }
      }
    });
  }

  /**
   * Leiste in der GameScene bauen (Desktop). Stellt die Rueckrufe, ueber
   * die AbilitySystem, LootSystem und die Boss-Inszenierung sie ansprechen.
   */
  function bauen(scene) {
    var wurzel = scene.add.container(0, 0).setDepth(TIEFE).setScrollFactor(0);
    var felder = [
      ['attack', 0], ['roll', 0], ['slot1', 1], ['slot2', 2], ['slot3', 3], ['slot4', 4], ['potion', 0]
    ].map(function (p) { return _baueFeld(scene, wurzel, p[0], p[1]); });
    _leiste = { scene: scene, wurzel: wurzel, felder: felder };

    window._refreshAbilityHUD = _auffrischen;
    // #77: waehrend eines inszenierten Moments ausblenden. Rueckgabe: wie viele
    // Felder umgeschaltet wurden (der Aufrufer merkt sich, ob es etwas gab).
    window.faehigkeitsLeisteSichtbar = function (an) {
      if (!_leiste || !_leiste.wurzel.scene) return 0;
      _leiste.wurzel.setVisible(!!an);
      return _leiste.felder.length;
    };
    // Pruefhilfe (tools/testGame.js): Angriff und die vier Slots.
    window._getAbilityHUDState = function () {
      return felder.filter(function (f) { return f.key === 'attack' || f.slotIdx; }).map(function (f) {
        return { key: f.key, slot: f.slotIdx ? 'slot' + f.slotIdx : null, abilityId: f.abilityId,
          label: ersatzName(f.abilityId || f.key), keyLabel: f.taste.text, visible: f.c.visible,
          x: Math.round(f.c.x), y: Math.round(f.c.y) };
      });
    };

    _auffrischen();
    _taktLeiste();
    scene.events.on('update', _taktLeiste);
    var beiGroesse = function () { _auffrischen(); };
    scene.scale.on('resize', beiGroesse);
    // Steuerungswechsel (Q/W/E/R <-> 1-4) und Sprache aendern die Beschriftung.
    var IS = window.InputScheme;
    var abIS = (IS && typeof IS.onChange === 'function') ? IS.onChange(_auffrischen) : null;
    var abSprache = (window.i18n && typeof window.i18n.onChange === 'function') ? window.i18n.onChange(_auffrischen) : null;
    scene.events.once('shutdown', function () {
      scene.events.off('update', _taktLeiste);
      scene.scale.off('resize', beiGroesse);
      if (typeof abIS === 'function') abIS();
      if (typeof abSprache === 'function') abSprache();
      if (_leiste && _leiste.scene === scene) _leiste = null;
    });
    return _leiste;
  }

  /**
   * Wie viel Platz die Leiste unten braucht (Abstand vom unteren Rand bis
   * knapp ueber ihre Oberkante); 0, wo es keine gibt (Hub, Mobile).
   * Tutorialbox und Richtungspfeil rutschen darueber. Aus der Szene
   * bestimmt, nicht aus der gebauten Leiste: die Tutorialbox entsteht teils
   * schon beim Szenenstart, vor dem HUD.
   */
  function freiraumUnten(scene) {
    if (!scene || !scene.sys || !scene.sys.settings) return 0;
    if (scene.sys.settings.key !== 'GameScene') return 0;
    var g = scene.sys.game;
    if (g && g.device && g.device.input && g.device.input.touch) return 0;
    return RAND_UNTEN + FELD + 10;
  }

  // ---------------------------------------------------------------------
  // Mobile: Ringe mit Icon auf den Kreisen von mobileControls
  // ---------------------------------------------------------------------

  var _mobil = { scene: null, deko: [], takt: null };

  function _mobilAbbauen() {
    if (_mobil.scene && _mobil.takt) _mobil.scene.events.off('update', _mobil.takt);
    _mobil.deko.forEach(function (d) { if (d.c && d.c.scene) d.c.destroy(); });
    _mobil.deko = [];
    _mobil.takt = null;
  }

  /**
   * Die Kreise (buttons aus mobileControls: { spec, circle }) bekommen einen
   * Messingring mit Icon, Sweep und Zahl. Kreis und Trefferflaeche bleiben,
   * wie sie sind; der Kreis wird nur dunkel hinterlegt.
   */
  function mobil(scene, buttons) {
    _mobilAbbauen();
    if (!scene || !Array.isArray(buttons)) return [];
    var UR = window.uiRahmen;
    if (_mobil.scene !== scene) {
      scene.events.once('shutdown', function () { if (_mobil.scene === scene) { _mobilAbbauen(); _mobil.scene = null; } });
    }
    _mobil.scene = scene;
    _mobil.deko = buttons.map(function (b) {
      var spec = b.spec, kreis = b.circle;
      var r = kreis.radius;
      var key = spec._abilityId ? 'slot' : spec.key;
      kreis.setFillStyle(0x15110e, 0.88);
      var c = scene.add.container(kreis.x, kreis.y).setDepth(1201).setScrollFactor(0);
      var ring = (UR && UR.bereit(scene)) ? UR.ring(scene, 0, 0, r * 2.2, 0) : null;
      if (ring) c.add(ring.setScrollFactor(0));
      var a = baueAnzeige(scene, c, 'kreis', r, Math.round(r * 1.3), Math.max(14, Math.round(r * 0.55)));
      var d = { key: key, abilityId: spec._abilityId || null, kreis: kreis, c: c, a: a, modus: null };
      if (spec.key === 'potion') {
        d.anzahl = scene.add.text(r * 0.62, r * 0.62, '', {
          fontFamily: 'monospace', fontSize: Math.max(11, Math.round(r * 0.4)) + 'px', fontStyle: 'bold',
          color: MESSING, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);
        c.add(d.anzahl);
        d.pips = [];
        var max = (window.LootSystem && typeof window.LootSystem.getPotionChargesMax === 'function')
          ? window.LootSystem.getPotionChargesMax() : 3;
        for (var i = 0; i < max; i++) {
          d.pips.push(scene.add.circle((i - (max - 1) / 2) * r * 0.32, -r * 0.82, Math.max(2, r * 0.11), 0x78f3c7, 1)
            .setStrokeStyle(1, 0x000000, 0.8).setScrollFactor(0));
        }
        c.add(d.pips);
        d.anzahlWert = null; d.ladungenWert = null;
      }
      setzeIcon(a, d.abilityId || key, false);
      return d;
    });
    _mobil.takt = function () { taktMobil(_mobil.deko, scene); };
    scene.events.on('update', _mobil.takt);
    taktMobil(_mobil.deko, scene);
    return _mobil.deko;
  }

  /**
   * Lebt eine Dekoration noch? Ein zerstoertes Phaser-Objekt ist weiterhin
   * truthy, destroy() setzt aber `scene` zurueck. setText auf einem toten
   * Text rendert die Textur neu und stuerzt ab ("reading 'glTexture'") —
   * darum wird eine Dekoration als Einheit geprueft und sonst uebergangen.
   */
  function lebtDeko(d) {
    if (!d || !d.c || !d.c.scene || !d.kreis || !d.kreis.scene || !d.a) return false;
    var teile = [d.a.icon, d.a.ersatz, d.a.sweep, d.a.blitz, d.a.zahl, d.anzahl].concat(d.pips || []);
    for (var i = 0; i < teile.length; i++) if (teile[i] && !teile[i].scene) return false;
    return true;
  }

  function taktMobil(liste, scene) {
    liste.forEach(function (d) {
      if (!lebtDeko(d)) return;
      // Kreis kann sich verschieben (Groessenwechsel) — Ring folgt.
      if (d.c.x !== d.kreis.x || d.c.y !== d.kreis.y) d.c.setPosition(d.kreis.x, d.kreis.y);
      if (d.c.visible !== d.kreis.visible) d.c.setVisible(d.kreis.visible);
      if (d.key === 'attack') {
        // Kontext-Primaerknopf: friedliches Ziel -> Aktion, sonst Angriff.
        var friedlich = !!(window.hasPeacefulTarget && window.hasPeacefulTarget(scene));
        d.modus = friedlich ? 'interact' : 'attack';
        if (friedlich) {
          setzeIcon(d.a, 'interact', false);
          takt(scene, d.a, { rest: 0, dauer: 0 });
          return;
        }
      }
      var z = zustand(d.key, d.abilityId, scene);
      setzeIcon(d.a, d.abilityId || d.key, z.gesperrt);
      takt(scene, d.a, z);
      if (d.key === 'potion') {
        if (z.anzahl !== d.anzahlWert) {
          d.anzahlWert = z.anzahl;
          d.anzahl.setText(String(z.anzahl));
        }
        if (z.ladungen !== d.ladungenWert) {
          d.ladungenWert = z.ladungen;
          d.pips.forEach(function (p, i) {
            var frei = z.ladungen == null || i < z.ladungen;
            p.setFillStyle(frei ? 0x78f3c7 : 0x333333, frei ? 1 : 0.7);
          });
        }
      }
    });
  }

  /** #77 (Boss-Inszenierung): Kreise samt Ringen aus- und wieder einblenden. */
  function mobilSichtbar(an) {
    var n = 0;
    _mobil.deko.forEach(function (d) {
      if (!lebtDeko(d)) return;
      // Der Ring folgt im Takt der Sichtbarkeit seines Kreises.
      if (!an) { d.warSichtbar = d.kreis.visible; d.kreis.setVisible(false); d.c.setVisible(false); }
      else if (d.warSichtbar) { d.kreis.setVisible(true); d.c.setVisible(true); }
      n++;
    });
    return n;
  }

  var hudLeiste = {
    vorladen: vorladen, bereit: bereit, frame: frame, ersatzName: ersatzName, zustand: zustand,
    bauen: bauen, freiraumUnten: freiraumUnten, mobil: mobil, mobilSichtbar: mobilSichtbar,
    zeichneSweep: zeichneSweep, taktMobil: taktMobil, lebtDeko: lebtDeko, REIHE: REIHE, KEY: KEY,
    _leiste: function () { return _leiste; }, _mobil: function () { return _mobil.deko; }
  };
  if (typeof window !== 'undefined') {
    window.hudLeiste = hudLeiste;
    window.mobileAbilityLeisteSichtbar = mobilSichtbar;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = hudLeiste;
})();
