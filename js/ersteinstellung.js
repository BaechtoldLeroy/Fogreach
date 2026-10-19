// js/ersteinstellung.js — Ersteinstellung beim allerersten Start eines Slots.
//
// Wer ein neues Spiel beginnt, waehlt zuerst Schwierigkeit und (am Desktop)
// das Steuerungsschema und erfaehrt, wo die Einstellungen spaeter liegen.
// Vorher fand man beides nur, wenn man selbst ins Einstellungsmenue ging; die
// meisten spielten mit Klassisch, ohne zu wissen, dass es ARPG gibt.
//
// Gezeigt im Startbildschirm nach "Neues Spiel" (startScene.js), bevor der Hub
// laeuft: so kreuzt es weder die Akt-1-Karte noch den ersten Tutorial-Hinweis,
// und die Spieluhr laeuft noch gar nicht. Fortsetzen kommt hier nie vorbei.
//
// Gespeichert wird genau dort, wo die Einstellungen es auch tun:
//   Schwierigkeit -> window.DIFFICULTY_MULTIPLIER + demonfall_lastDifficulty
//   Steuerung     -> Persistence.setControlScheme + InputScheme.setScheme
// Die Marke "schon gesehen" liegt pro Slot (SlotStorage). "Neues Spiel" leert
// den Slot samt Marke: ein frischer Durchgang fragt also wieder.
(function () {
  'use strict';

  var KEY = 'demonfall_ersteinstellung';
  var TIEFE = 3000;

  var STUFEN = [
    { key: 'easy', mult: 0.6 },
    { key: 'normal', mult: 1.0 },
    { key: 'hard', mult: 1.5 }
  ];
  var SCHEMATA = ['classic', 'arpg'];

  if (window.i18n) {
    window.i18n.register('de', {
      'erst.titel': 'Bevor es losgeht',
      'erst.schwierigkeit': 'Schwierigkeit',
      'erst.schwierigkeit.easy': 'Schwächere Gegner, schwächere Beute. Für die Geschichte.',
      'erst.schwierigkeit.normal': 'So ist Fogreach gedacht.',
      'erst.schwierigkeit.hard': 'Stärkere Gegner, stärkere Beute.',
      'erst.steuerung': 'Steuerung',
      'erst.steuerung.classic': 'Pfeiltasten laufen, Leertaste schlägt, Q W E R für Fähigkeiten.',
      'erst.steuerung.arpg': 'WASD laufen, die Maus zielt und schlägt, 1 2 3 4 für Fähigkeiten.',
      'erst.hinweis': 'Alle Einstellungen findest Du jederzeit mit O oder über das Menü oben rechts.',
      'erst.hinweis.mobil': 'Alle Einstellungen findest Du jederzeit über das Menü oben rechts.',
      'erst.los': "Los geht's"
    });
    window.i18n.register('en', {
      'erst.titel': 'Before you begin',
      'erst.schwierigkeit': 'Difficulty',
      'erst.schwierigkeit.easy': 'Weaker enemies, weaker loot. For the story.',
      'erst.schwierigkeit.normal': 'Fogreach as it is meant to be played.',
      'erst.schwierigkeit.hard': 'Stronger enemies, stronger loot.',
      'erst.steuerung': 'Controls',
      'erst.steuerung.classic': 'Arrow keys move, Space attacks, Q W E R for abilities.',
      'erst.steuerung.arpg': 'WASD moves, the mouse aims and attacks, 1 2 3 4 for abilities.',
      'erst.hinweis': 'You can open all settings at any time with O or via the menu at the top right.',
      'erst.hinweis.mobil': 'You can open all settings at any time via the menu at the top right.',
      'erst.los': "Let's go"
    });
  }

  function T(k) { return window.i18n ? window.i18n.t(k) : k; }

  function _speicher() { return window.SlotStorage || null; }

  /** Dieselbe Touch-Erkennung wie die Einstellungen (SettingsScene). */
  function istTouch(scene) {
    var d = scene && scene.sys && scene.sys.game && scene.sys.game.device;
    return !!(d && d.input && d.input.touch);
  }

  /** Neuer Slot, noch nicht gefragt, kein Trailer, kein Spielstand. */
  function faellig() {
    if (window.TrailerModus && window.TrailerModus.aktiv()) return false;
    try { if (typeof window.hasSave === 'function' && window.hasSave()) return false; } catch (e) {}
    var s = _speicher();
    if (!s) return false;
    return s.getItem(KEY) !== '1';
  }

  function _aktuelleStufe() {
    var v = window.DIFFICULTY_MULTIPLIER;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return 1;
    var bi = 1, bd = Infinity;
    STUFEN.forEach(function (t, i) { var d = Math.abs(t.mult - v); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }

  function _aktuellesSchema() {
    var s = (window.InputScheme && window.InputScheme.getScheme) ? window.InputScheme.getScheme()
      : (window.Persistence && window.Persistence.getControlScheme ? window.Persistence.getControlScheme() : 'classic');
    var i = SCHEMATA.indexOf(s);
    return i < 0 ? 0 : i;
  }

  /** Auswahl uebernehmen, an denselben Stellen wie die Einstellungen. */
  function anwenden(stufeIdx, schemaIdx) {
    var mult = STUFEN[stufeIdx].mult;
    window.DIFFICULTY_MULTIPLIER = mult;
    var s = _speicher();
    try { if (s) s.setItem('demonfall_lastDifficulty', JSON.stringify(mult)); } catch (e) {}
    if (schemaIdx !== null && schemaIdx !== undefined) {
      var schema = SCHEMATA[schemaIdx];
      // Persistence direkt: InputScheme kennt seine Speicher-Primitiven erst,
      // wenn der Hub es initialisiert hat — vorher wuerde setScheme nur im
      // Speicher wechseln und nach dem naechsten Laden vergessen sein.
      if (window.Persistence && window.Persistence.setControlScheme) window.Persistence.setControlScheme(schema);
      if (window.InputScheme && window.InputScheme.setScheme) window.InputScheme.setScheme(schema);
    }
    try { if (s) s.setItem(KEY, '1'); } catch (e) {}
  }

  /** Scrollfaktor 0 bis in jeden Behaelter (sonst verfehlen Taps auf Mobile). */
  function _fest(o) {
    if (!o) return;
    if (o.setScrollFactor) o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  /**
   * Das Fenster zeigen. weiter() laeuft nach "Los geht's" (Klick oder Enter).
   * Liefert einen Griff fuer Tests: { objekte, bestaetigen, waehle, zustand }.
   */
  function zeige(scene, weiter) {
    var UR = window.uiRahmen;
    var messing = !!(UR && UR.bereit && UR.bereit(scene));
    var touch = istTouch(scene);
    var cam = scene.cameras.main;
    var cw = cam.width, ch = cam.height, cx = cw / 2, cy = ch / 2;
    var objekte = [];
    var add = function (o) { objekte.push(o); return o; };

    var z = { stufe: _aktuelleStufe(), schema: touch ? null : _aktuellesSchema(), fokus: 0, fertig: false };
    // Fokus-Reihen: Schwierigkeit, (Steuerung), Los-Knopf.
    var reihen = touch ? ['stufe', 'los'] : ['stufe', 'schema', 'los'];

    var W = Math.min(640, cw - 40);
    var H = touch ? 256 : 362;
    var top = cy - H / 2;

    // Abdunkeln und alle Klicks dahinter abfangen.
    add(scene.add.rectangle(cx, cy, cw, ch, 0x000000, 0.6).setDepth(TIEFE).setInteractive());

    if (messing) {
      (UR.menuePlatte(scene, cx, cy, W, H, TIEFE + 1) || []).forEach(add);
    } else {
      var g = add(scene.add.graphics().setDepth(TIEFE + 1));
      g.fillStyle(0x12121a, 0.96).fillRoundedRect(cx - W / 2, top, W, H, 14);
      g.lineStyle(2, 0xaa8844, 0.95).strokeRoundedRect(cx - W / 2, top, W, H, 14);
    }

    var text = function (x, y, inhalt, stil, ox) {
      return add(scene.add.text(x, y, inhalt, Object.assign({
        fontFamily: 'monospace', color: '#f1e9d8', align: 'center'
      }, stil)).setOrigin(ox === undefined ? 0.5 : ox, 0.5).setDepth(TIEFE + 3));
    };

    text(cx, top + 34, T('erst.titel'), { fontFamily: 'serif', fontSize: '26px', color: '#ffd166', fontStyle: 'bold' });

    // Eine Knopfreihe: Rechtecke mit Rand; uiRahmen.knopf zeigt einen goldenen
    // Rand (0xffd166) als hellen Knopf, also als die getroffene Wahl.
    function knopfReihe(y, labels, breite, abstand, onWahl) {
      var n = labels.length;
      var x0 = cx - (abstand * (n - 1)) / 2;
      return labels.map(function (lbl, i) {
        var x = x0 + i * abstand;
        var r = add(scene.add.rectangle(x, y, breite, 36, 0x2a2a2a)
          .setStrokeStyle(1, 0x666666).setDepth(TIEFE + 2).setInteractive({ useHandCursor: true }));
        var t = text(x, y, lbl, { fontSize: '16px', color: '#f1e9d8', fontStyle: 'bold' });
        r.on('pointerdown', function () { onWahl(i); });
        return { r: r, t: t };
      });
    }

    var y = top + 74;
    var lblStufe = text(cx, y, '', { fontSize: '15px', color: '#d8cbb0' });
    var stufenKn = knopfReihe(y + 32, STUFEN.map(function (s) { return T('settings.difficulty.' + s.key); }), 150, 170,
      function (i) { z.stufe = i; z.fokus = 0; zeichne(); });
    var infoStufe = text(cx, y + 66, '', { fontSize: '13px', color: '#cfc3a8', wordWrap: { width: W - 60 } });
    y += 100;

    var lblSchema = null, schemaKn = [], infoSchema = null;
    if (!touch) {
      lblSchema = text(cx, y, '', { fontSize: '15px', color: '#d8cbb0' });
      schemaKn = knopfReihe(y + 32, SCHEMATA.map(function (s) { return T('input.scheme.' + s); }), 170, 200,
        function (i) { z.schema = i; z.fokus = 1; zeichne(); });
      infoSchema = text(cx, y + 66, '', { fontSize: '13px', color: '#cfc3a8', wordWrap: { width: W - 60 } });
      y += 100;
    }

    var hinweis = text(cx, y + 6, T(touch ? 'erst.hinweis.mobil' : 'erst.hinweis'),
      { fontSize: '13px', color: '#e8dcc0', wordWrap: { width: W - 70 } });

    var losY = top + H - 38;
    var los = add(scene.add.rectangle(cx, losY, 200, 40, 0x2a2a2a)
      .setStrokeStyle(1, 0x666666).setDepth(TIEFE + 2).setInteractive({ useHandCursor: true }));
    var losText = text(cx, losY, T('erst.los'), { fontSize: '18px', color: '#b8e6a0', fontStyle: 'bold' });
    los.on('pointerdown', function () { bestaetigen(); });

    // Messing erst, wenn alle Beschriftungen stehen (Knoepfe wachsen mit ihr).
    if (messing && UR.knopf) {
      stufenKn.concat(schemaKn).forEach(function (k) { UR.knopf(k.r); });
      UR.knopf(los);
    }
    // Die Knopf-Bilder entstehen in uiRahmen; mit in die Aufraeumliste.
    stufenKn.concat(schemaKn).concat([{ r: los }]).forEach(function (k) {
      if (k.r._uiKnopf) k.r._uiKnopf.teile.forEach(add);
    });

    function zeichne() {
      var f = touch ? null : reihen[z.fokus];   // Fokus-Marke nur mit Tastatur
      lblStufe.setText((f === 'stufe' ? '▸ ' : '') + T('erst.schwierigkeit'));
      lblStufe.setColor(f === 'stufe' ? '#ffd166' : '#d8cbb0');
      stufenKn.forEach(function (k, i) {
        k.r.setStrokeStyle(i === z.stufe ? 2 : 1, i === z.stufe ? 0xffd166 : 0x666666);
        k.t.setColor(i === z.stufe ? '#ffe08a' : '#cfc3a8');
      });
      infoStufe.setText(T('erst.schwierigkeit.' + STUFEN[z.stufe].key));
      if (!touch) {
        lblSchema.setText((f === 'schema' ? '▸ ' : '') + T('erst.steuerung'));
        lblSchema.setColor(f === 'schema' ? '#ffd166' : '#d8cbb0');
        schemaKn.forEach(function (k, i) {
          k.r.setStrokeStyle(i === z.schema ? 2 : 1, i === z.schema ? 0xffd166 : 0x666666);
          k.t.setColor(i === z.schema ? '#ffe08a' : '#cfc3a8');
        });
        infoSchema.setText(T('erst.steuerung.' + SCHEMATA[z.schema]));
      }
      losText.setText((f === 'los' ? '▸ ' : '') + T('erst.los'));
    }

    function waehle(reihe, idx) {
      if (reihe === 'stufe') z.stufe = Math.max(0, Math.min(STUFEN.length - 1, idx));
      else if (reihe === 'schema' && !touch) z.schema = Math.max(0, Math.min(SCHEMATA.length - 1, idx));
      zeichne();
    }

    function verschiebe(d) {
      var f = reihen[z.fokus];
      if (f === 'stufe') waehle('stufe', z.stufe + d);
      else if (f === 'schema') waehle('schema', z.schema + d);
    }
    function fokus(d) {
      z.fokus = (z.fokus + d + reihen.length) % reihen.length;
      zeichne();
    }

    var kb = scene.input && scene.input.keyboard;
    var tasten = {
      'keydown-ENTER': function () { bestaetigen(); },
      'keydown-LEFT': function () { verschiebe(-1); },
      'keydown-RIGHT': function () { verschiebe(1); },
      'keydown-A': function () { verschiebe(-1); },
      'keydown-D': function () { verschiebe(1); },
      'keydown-UP': function () { fokus(-1); },
      'keydown-DOWN': function () { fokus(1); },
      'keydown-TAB': function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        fokus(ev && ev.shiftKey ? -1 : 1);
      },
      'keydown-SPACE': function () { if (reihen[z.fokus] === 'los') bestaetigen(); }
    };
    // Im Browser kommt dasselbe Tastenereignis bei schnellen Folgen mehrfach
    // im selben Bild an (gemessen: ArrowDown zwei- bis dreimal, dasselbe
    // KeyboardEvent-Objekt). Ohne Sperre sprang der Fokus dann ueber die
    // Steuerungszeile hinweg. Jedes Ereignis zaehlt darum genau einmal.
    var gesehen = (typeof WeakSet === 'function') ? new WeakSet() : null;
    Object.keys(tasten).forEach(function (k) {
      var roh = tasten[k];
      tasten[k] = function (ev) {
        if (gesehen && ev && typeof ev === 'object') {
          if (gesehen.has(ev)) return;
          gesehen.add(ev);
        }
        roh(ev);
      };
    });
    if (kb) Object.keys(tasten).forEach(function (k) { kb.on(k, tasten[k]); });

    function abbauen() {
      if (kb) Object.keys(tasten).forEach(function (k) { kb.off(k, tasten[k]); });
      objekte.forEach(function (o) { if (o && o.scene) o.destroy(); });
      objekte.length = 0;
      if (scene._ersteinstellung === griff) scene._ersteinstellung = null;
    }

    function bestaetigen() {
      if (z.fertig) return;
      z.fertig = true;
      anwenden(z.stufe, touch ? null : z.schema);
      abbauen();
      if (typeof weiter === 'function') weiter();
    }

    scene.events.once('shutdown', abbauen);
    zeichne();
    objekte.forEach(_fest);

    var griff = { objekte: objekte, bestaetigen: bestaetigen, waehle: waehle, zustand: z, touch: touch, hinweis: hinweis };
    scene._ersteinstellung = griff;
    return griff;
  }

  window.Ersteinstellung = { KEY: KEY, faellig: faellig, zeige: zeige, anwenden: anwenden, istTouch: istTouch };
})();
