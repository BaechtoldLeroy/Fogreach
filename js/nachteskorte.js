// js/nachteskorte.js — die Nachteskorte: ein Transport des Rats (garde_night_escort).
//
// Der Wachtmeister schickt Dich als Eskorte mit, verkleidet, durch die
// Umschlagstelle (js/roomTemplates/Umschlagstelle.json). Ein Karren mit
// Phiolenkisten, gezogen vom Fuhrmann, dahinter zwei Geleerte als Traeger,
// faehrt drei Stationen ab:
//
//   Verladung   jede Phiole bekommt ein Schild mit einem Namen
//   Waage       ein Schreiber liest die Namen aus dem Register, einen kennst
//               Du (Maras Liste, je nach Wahl in "Reinigung eines Bezirks").
//               Danach die Wahl: die Seite einpraegen oder herausreissen.
//   Schacht     die Geleerten tragen die Kisten in den Nebel hinab
//
// Jede Station ist eine Abhoer-Zone der Spionage (espionageSystem), die erst
// zaehlt, wenn der Karren dort haelt. Unterwegs gilt die Regel der Eskorte:
// bleib in Reichweite des Karrens. Wer zu lange zurueckbleibt, den vermisst
// der Fuhrmann: der Verdacht steigt, und der Transport faengt an der letzten
// Station neu an. Das Gespraech an jeder Station ist eine Szene aus
// spionageSzenen.js (mit eigenem Tableau), der Abschluss eine eigene.
//
// Zustaende des Karrens: halt (an der Station, Zone offen) -> fahren ->
// halt ... -> fertig. Nach einem Zuruecksetzen: warten (an der Station, bis
// Du wieder bei ihm bist) -> fahren.
(function () {
  'use strict';

  var QUEST = 'garde_night_escort';
  var RAUM = 'Umschlagstelle';
  var ZIELE = ['eskorte_verladung', 'eskorte_waage', 'eskorte_schacht'];
  var VERDACHT_BEI_VERLUST = 0.5;   // so viel Verdacht kostet es, den Karren zu verlieren
  var LOSFAHREN_BEI = 0.75;         // Anteil der Reichweite: so nah, und er faehrt wieder
  var TIEFE_FIGUREN = 521;          // wie die Wachen der Spionage (espionageVisuals)
  var FIGUR_H = 72;
  var KARREN_H = 76;
  var ABSTAND_TRAEGER = 46;         // px Spur zwischen Karren und Traegern

  // Der Name auf der Waage. Wer Maras Liste gewarnt hat, liest den Namen der
  // einen, die es nicht schaffte (wie der Nachhall, js/nachhall.js); wer sie
  // abgeliefert hat, einen von der Liste; sonst einen von Maras Leuten.
  var NAMEN = { gewarnt: 'Oda Kessler', abgeliefert: 'Benno Falk', mara: 'Wendel Rusk' };

  var DE = {
    'eskorte.bleiben': 'Bleib beim Karren bis zur nächsten Station.',
    'eskorte.zurueck': 'Zu weit vom Transport! Zurück zum Karren ({s})',
    'eskorte.station': 'Der Karren hält. Hör an der Station zu.',
    'eskorte.warten': 'Geh zum Karren. Er fährt weiter, sobald Du bei ihm bist.',
    'eskorte.verloren': 'FUHRMANN: Wo bleibt die Eskorte? Alles zurück zur letzten Station!',
    'eskorte.wahl.titel': 'An der Waage',
    'eskorte.wahl.text': '(Der Schreiber dreht sich zur Waage um. Das Register liegt offen, die Seite mit {name} obenauf. Einen Atemzug lang sieht keiner hin.)',
    'eskorte.wahl.merken': 'Die Seite einprägen',
    'eskorte.wahl.reissen': 'Die Seite herausreissen',
    'eskorte.wahl.gemerkt': 'Du liest die Seite zweimal, Zeile für Zeile, bis Du sie mit geschlossenen Augen siehst. Das Register bleibt, wie es war. Keiner wird merken, dass jemand mitgelesen hat.',
    'eskorte.wahl.gerissen': 'Ein leises Reissen, und die Seite verschwindet unter Deiner Uniform. Der Schreiber blättert zurück und stutzt. Dann schreibt er die Fuhre einfach noch einmal ab, und der Fuhrmann sieht Dich länger an als nötig.',
    'eskorte.ende.kopf': 'Nachteskorte',
    'eskorte.ende.titel': 'Leer zurück',
    'eskorte.ende.1': '(Der Karren rollt leer zurück. Die Träger kommen nicht wieder herauf.)',
    'eskorte.ende.gemerkt': '(Die Seite trägst Du im Kopf, Zeile für Zeile. Mara wird jeden Namen hören, zuerst {name}.)',
    'eskorte.ende.gerissen': '(Die Seite knistert unter Deiner Uniform. Mara wird jeden Namen lesen können, zuerst {name}.)',
    'eskorte.ende.ohne': '(Die Namen trägst Du im Kopf. Mara wird sie hören.)',
    'eskorte.ende.2': 'Gute Arbeit, Eskorte. Sag Deinem Hauptmann, die Fuhre ist verzeichnet.'
  };
  var EN = {
    'eskorte.bleiben': 'Stay with the cart until the next station.',
    'eskorte.zurueck': 'Too far from the transport! Back to the cart ({s})',
    'eskorte.station': 'The cart has stopped. Listen at the station.',
    'eskorte.warten': 'Go to the cart. It moves on as soon as you are with it.',
    'eskorte.verloren': 'CARTER: Where is the escort? Everyone back to the last station!',
    'eskorte.wahl.titel': 'At the Scale',
    'eskorte.wahl.text': '(The scribe turns to the scale. The register lies open, the page with {name} on top. For one breath nobody is looking.)',
    'eskorte.wahl.merken': 'Memorize the page',
    'eskorte.wahl.reissen': 'Tear out the page',
    'eskorte.wahl.gemerkt': 'You read the page twice, line by line, until you can see it with your eyes shut. The register stays as it was. Nobody will notice that someone read along.',
    'eskorte.wahl.gerissen': 'A quiet tear, and the page disappears under your uniform. The scribe leafs back and frowns. Then he simply copies the load out again, and the carter looks at you longer than he needs to.',
    'eskorte.ende.kopf': 'Night Escort',
    'eskorte.ende.titel': 'Back Empty',
    'eskorte.ende.1': '(The cart rolls back empty. The porters do not come back up.)',
    'eskorte.ende.gemerkt': '(You carry the page in your head, line by line. Mara will hear every name, {name} first.)',
    'eskorte.ende.gerissen': '(The page rustles under your uniform. Mara will be able to read every name, {name} first.)',
    'eskorte.ende.ohne': '(You carry the names in your head. Mara will hear them.)',
    'eskorte.ende.2': 'Good work, escort. Tell your captain the load is recorded.'
  };
  try {
    if (window.i18n && typeof window.i18n.register === 'function') {
      window.i18n.register('de', DE);
      window.i18n.register('en', EN);
    }
  } catch (e) {}

  function _t(k, name) {
    var v = null;
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        v = window.i18n.t(k);
        if (!v || v === k || v.indexOf('[MISSING') === 0) v = null;
      }
    } catch (e) {}
    v = v || DE[k] || k;
    return v.split('{name}').join(name || erkannterName());
  }
  function _flags() {
    var qs = window.questSystem;
    return (qs && typeof qs.getFlags === 'function') ? qs.getFlags() : {};
  }

  /** Woher kennst Du den Namen auf der Waage? 'gewarnt' | 'abgeliefert' | 'mara'. Rein. */
  function namensHerkunft(flags) {
    var f = flags || _flags();
    return f.namen_gewarnt ? 'gewarnt' : f.namen_abgeliefert ? 'abgeliefert' : 'mara';
  }
  /** Der Name, den Du an der Waage erkennst. Rein. */
  function erkannterName(flags) { return NAMEN[namensHerkunft(flags)]; }

  // --- Zustand ---------------------------------------------------------------
  var st = null;

  function _zone(ziel) {
    var E = window.EspionageSystem;
    var s = E && E.getState ? E.getState() : null;
    return ((s && s.observeZones) || []).filter(function (z) { return z && z.questTarget === ziel; })[0] || null;
  }
  function _quest() {
    var qs = window.questSystem;
    var aktiv = (qs && typeof qs.getActiveQuests === 'function') ? qs.getActiveQuests() : [];
    return aktiv.filter(function (q) { return q && q.id === QUEST; })[0] || null;
  }
  function _zielErledigt(q, ziel) {
    var o = ((q && q.objectives) || []).filter(function (x) { return x.target === ziel; })[0];
    return !!(o && (o.current || 0) >= (o.required || 1));
  }

  /**
   * Der Transport beginnt (roomManager._maybeStartEspionage, nach startMission).
   * Schon erledigte Stationen (ein Lauf vorher, Spielstand) zaehlen als
   * gehoert; der Karren wartet dann an der letzten davon.
   */
  function starten(scene, cfg, ursprung) {
    beenden();
    if (!scene || !cfg || !cfg.pfad || cfg.pfad.length < 2) return null;
    var T = (ursprung && ursprung.tile) || 32;
    var ox = (ursprung && ursprung.x) || 0, oy = (ursprung && ursprung.y) || 0;
    var welt = function (p) { return { x: ox + p.x * T, y: oy + p.y * T }; };
    st = {
      scene: scene,
      pfad: cfg.pfad.map(welt),
      stationen: (cfg.stationen || []).map(function (s) { return { punkt: s.punkt, zone: s.zone }; }),
      reichweite: cfg.reichweite || 210,
      frist: cfg.frist || 5,
      tempo: cfg.tempo || 46,
      schacht: cfg.schacht ? welt(cfg.schacht) : null,
      phase: 'halt', station: 0, ziel: 1, abstand: 0, verloren: 0,
      pos: null, richtung: 1, spur: [], teile: {}, abschlussGespielt: false
    };
    var q = _quest();
    var erste = -1;
    st.stationen.forEach(function (s, i) {
      if (erste === -1 && !_zielErledigt(q, s.zone)) erste = i;
    });
    st.stationen.forEach(function (s, i) {
      var z = _zone(s.zone);
      if (z && (erste === -1 || i < erste)) { z._done = true; z._fxDone = true; z.gesperrt = false; }
    });
    if (erste === -1) {
      var letzte = st.stationen[st.stationen.length - 1];
      st.station = st.stationen.length - 1;
      st.pos = Object.assign({}, st.pfad[letzte ? letzte.punkt : st.pfad.length - 1]);
      st.phase = 'fertig';
    } else if (erste === 0) {
      st.station = 0;
      st.pos = Object.assign({}, st.pfad[st.stationen[0].punkt]);
      st.phase = 'halt';
    } else {
      st.station = erste - 1;
      st.pos = Object.assign({}, st.pfad[st.stationen[erste - 1].punkt]);
      st.ziel = st.stationen[erste - 1].punkt + 1;
      st.phase = 'warten';
    }
    _vorladen(scene);
    _schachtZeichnen(scene);
    _spurZeichnen(scene);
    if (scene.events && typeof scene.events.once === 'function') scene.events.once('shutdown', beenden);
    _debugSzeneVorbereiten(scene);
    return st;
  }

  function beenden() {
    if (!st) return;
    Object.keys(st.teile).forEach(function (k) {
      var o = st.teile[k];
      (Array.isArray(o) ? o : [o]).forEach(function (x) { if (x && x.scene) { try { x.destroy(); } catch (e) {} } });
    });
    st = null;
  }

  function aktiv() { return !!st; }
  function getState() { return st; }

  // --- Bilder ----------------------------------------------------------------
  var TEX = { karren: 'eskorte_karren', traeger: 'buerger', fuhrmann: 'garde' };
  var DATEI = {
    eskorte_karren: 'assets/hub/karren.png',
    buerger: 'assets/sprites/buerger.png?v=2',
    garde: 'assets/sprites/garde.png'
  };
  function _vorladen(scene) {
    if (!scene.load || !scene.textures) return;
    // Die Tableaus der Stationen auch dann, wenn keine Auftrags-Szene lief (Debug-Sprung).
    if (window.SpionageSzenen && window.SpionageSzenen.vorladen) { try { window.SpionageSzenen.vorladen(scene); } catch (e) {} }
    var fehlt = Object.keys(DATEI).filter(function (k) { return !scene.textures.exists(k); });
    fehlt.forEach(function (k) { scene.load.image(k, DATEI[k]); });
    if (fehlt.length) { try { if (!scene.load.isLoading()) scene.load.start(); } catch (e) {} }
  }

  // Figuren entstehen, sobald ihre Bilder da sind (sie laden erst beim Betreten).
  function _figur(scene, name, tex, hoehe, tint) {
    var o = st.teile[name];
    if (o && o.scene) return o;
    if (!scene.textures || !scene.textures.exists(tex) || !scene.add) return null;
    o = scene.add.image(st.pos.x, st.pos.y, tex).setDepth(TIEFE_FIGUREN).setOrigin(0.5, 0.85);
    o.setScale(hoehe / (o.height || hoehe));
    if (tint) o.setTint(tint);
    st.teile[name] = o;
    return o;
  }

  // Der Schacht: ein dunkles Loch, von unten glimmt es warm (die Esse, Tiefe 20).
  function _schachtZeichnen(scene) {
    if (!st.schacht || !scene.add || !scene.add.graphics) return;
    var g = scene.add.graphics().setDepth(31);
    g.fillStyle(0x050407, 0.95); g.fillEllipse(0, 0, 150, 96);
    g.fillStyle(0x3a1408, 0.6); g.fillEllipse(0, 6, 104, 62);
    g.fillStyle(0xb2481a, 0.35); g.fillEllipse(0, 10, 56, 30);
    g.lineStyle(3, 0x2a2622, 1); g.strokeEllipse(0, 0, 150, 96);
    g.setPosition(st.schacht.x, st.schacht.y);
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: { from: 0.8, to: 1 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    st.teile.schacht = g;
  }
  // Radspuren auf dem Boden zeigen, wohin der Transport faehrt.
  function _spurZeichnen(scene) {
    if (!scene.add || !scene.add.graphics) return;
    var g = scene.add.graphics().setDepth(30);
    g.lineStyle(3, 0x4a3a2a, 0.45);
    for (var i = 1; i < st.pfad.length; i++) {
      var a = st.pfad[i - 1], b = st.pfad[i];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len * 12, ny = dx / len * 12;
      for (var d = 0; d < len; d += 22) {
        var t0 = d / len, t1 = Math.min(1, (d + 11) / len);
        [-1, 1].forEach(function (s) {
          g.beginPath();
          g.moveTo(a.x + dx * t0 + nx * s, a.y + dy * t0 + ny * s);
          g.lineTo(a.x + dx * t1 + nx * s, a.y + dy * t1 + ny * s);
          g.strokePath();
        });
      }
    }
    st.teile.spur = g;
    st.teile.ring = scene.add.graphics().setDepth(32);
  }

  function _zeichnen(scene) {
    var karren = _figur(scene, 'karren', TEX.karren, KARREN_H, null);
    var fuhrmann = _figur(scene, 'fuhrmann', TEX.fuhrmann, FIGUR_H, 0xb8b0a0);
    var t1 = st.traegerFort ? null : _figur(scene, 'traeger1', TEX.traeger, FIGUR_H, 0x8d949c);
    var t2 = st.traegerFort ? null : _figur(scene, 'traeger2', TEX.traeger, FIGUR_H, 0x7c838b);
    var p = st.pos;
    if (karren) { karren.setPosition(p.x, p.y + 18); karren.setFlipX(st.richtung < 0); }
    if (fuhrmann) { fuhrmann.setPosition(p.x + st.richtung * 46, p.y + 16); fuhrmann.setFlipX(st.richtung < 0); }
    // Die Traeger gehen in der Spur des Karrens; steht er, warten sie daneben.
    [t1, t2].forEach(function (t, i) {
      if (!t) return;
      var hinten = _spurPunkt(ABSTAND_TRAEGER * (i + 1));
      t.setPosition(hinten ? hinten.x : p.x - st.richtung * (40 + 26 * i), (hinten ? hinten.y : p.y) + 14 + 6 * i);
      t.setFlipX(st.richtung < 0);
    });
    // Der Ring der Eskorte: so weit darfst Du Dich entfernen. Rot, sobald Du draussen bist.
    var g = st.teile.ring;
    if (g && g.scene) {
      g.clear();
      if (st.phase === 'fahren' || st.phase === 'warten') {
        var rot = st.abstand > 0;
        g.lineStyle(2, rot ? 0xff5a4a : 0x8fb8d8, rot ? 0.75 : 0.35);
        g.strokeCircle(p.x, p.y, st.reichweite);
      }
    }
  }

  function _spurPunkt(abstand) {
    var rest = abstand, last = st.pos;
    for (var i = st.spur.length - 1; i >= 0; i--) {
      var q = st.spur[i];
      var d = Math.sqrt((q.x - last.x) * (q.x - last.x) + (q.y - last.y) * (q.y - last.y));
      if (d >= rest) {
        var t = rest / (d || 1);
        return { x: last.x + (q.x - last.x) * t, y: last.y + (q.y - last.y) * t };
      }
      rest -= d; last = q;
    }
    return null;
  }

  // --- Takt ------------------------------------------------------------------
  function _haeltAn(scene) {
    return !!(scene.__spionSzene || scene.__konvoiDialog || window.eventChoiceOpen);
  }

  function update(scene, delta) {
    if (!st) return;
    var E = window.EspionageSystem;
    if (!E || !E.isActive || !E.isActive()) { beenden(); return; }
    scene = scene || st.scene;
    var dt = Math.min(0.1, Math.max(0, (delta || 16) / 1000));
    if (!_haeltAn(scene)) _schritt(dt);
    _zeichnen(scene);
  }

  function _schritt(dt) {
    var p = window.player;
    var d = p ? Math.sqrt((p.x - st.pos.x) * (p.x - st.pos.x) + (p.y - st.pos.y) * (p.y - st.pos.y)) : 0;
    var station = st.stationen[st.station];
    if (st.phase === 'halt') {
      var z = station && _zone(station.zone);
      if (z) z.gesperrt = false;
      if (z && z._done) {
        if (st.station >= st.stationen.length - 1) st.phase = 'fertig';
        else { st.phase = 'fahren'; st.ziel = station.punkt + 1; st.abstand = 0; }
      }
      return;
    }
    if (st.phase === 'warten') {
      if (d <= st.reichweite * LOSFAHREN_BEI) { st.phase = 'fahren'; st.abstand = 0; }
      return;
    }
    if (st.phase !== 'fahren') return;
    // Enttarnt: der Transport wartet, bis Du wieder untergetaucht bist.
    var E = window.EspionageSystem;
    if (E.isDetected && E.isDetected()) return;
    if (d > st.reichweite) {
      st.abstand += dt;
      if (st.abstand >= st.frist) { _verloren(); return; }
    } else {
      st.abstand = 0;
    }
    _fahren(dt);
  }

  function _fahren(dt) {
    var weg = st.tempo * dt;
    while (weg > 0 && st.phase === 'fahren') {
      var z = st.pfad[st.ziel];
      var dx = z.x - st.pos.x, dy = z.y - st.pos.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dx) > 0.5) st.richtung = dx > 0 ? 1 : -1;
      if (len <= weg) {
        st.pos = { x: z.x, y: z.y };
        weg -= len;
        _spurMerken();
        var halt = -1;
        st.stationen.forEach(function (s, i) { if (s.punkt === st.ziel) halt = i; });
        if (halt !== -1) { st.station = halt; st.phase = 'halt'; st.abstand = 0; }
        else st.ziel++;
      } else {
        st.pos = { x: st.pos.x + dx / len * weg, y: st.pos.y + dy / len * weg };
        weg = 0;
        _spurMerken();
      }
    }
  }

  function _spurMerken() {
    var l = st.spur[st.spur.length - 1];
    if (!l || Math.abs(l.x - st.pos.x) + Math.abs(l.y - st.pos.y) >= 6) st.spur.push({ x: st.pos.x, y: st.pos.y });
    if (st.spur.length > 80) st.spur.shift();
  }

  // Zu lange zurueckgeblieben: der Fuhrmann ruft, alles zurueck zur letzten Station.
  function _verloren() {
    var s = st.stationen[st.station];
    st.pos = Object.assign({}, st.pfad[s.punkt]);
    st.ziel = s.punkt + 1;
    st.phase = 'warten';
    st.abstand = 0;
    st.spur = [];
    st.verloren++;
    var E = window.EspionageSystem;
    if (E && E.verdacht) E.verdacht(VERDACHT_BEI_VERLUST);
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(st.scene, _t('eskorte.verloren'), 'quest');
      }
    } catch (e) {}
  }

  /** Die Aktionszeile der Spionage (espionageVisuals). null = die uebliche. */
  function hinweis(espState) {
    if (!st || (espState && espState.exposed)) return null;
    if (st.phase === 'fahren' && st.abstand > 0) {
      return _t('eskorte.zurueck').replace('{s}', String(Math.max(1, Math.ceil(st.frist - st.abstand))));
    }
    if (st.phase === 'fahren') return _t('eskorte.bleiben');
    if (st.phase === 'warten') return _t('eskorte.warten');
    if (st.phase === 'halt') return _t('eskorte.station');
    return null;
  }
  function warnt() { return !!(st && st.phase === 'fahren' && st.abstand > 0); }

  // --- Die Wahl an der Waage ------------------------------------------------
  function wahl(scene) {
    var qs = window.questSystem;
    if (!scene || !qs) return false;
    if (qs.hasFlag('eskorte_seite_gemerkt') || qs.hasFlag('eskorte_seite_gerissen')) return false;
    var F = window.Finale;
    if (!F || typeof F.wahlSeite !== 'function') return false;
    var titel = _t('eskorte.wahl.titel'), bild = 'spionbild_eskorte_waage';
    var ende = function (text) {
      F.wahlSeite(scene, { titel: titel, bild: bild, text: text, wahlen: [{ label: _en() ? 'Continue' : 'Weiter', callback: function () {} }] });
    };
    F.wahlSeite(scene, { titel: titel, bild: bild, text: _t('eskorte.wahl.text'), wahlen: [
      { label: _t('eskorte.wahl.merken'), callback: function () {
        qs.setFlag('eskorte_seite_gemerkt', true);
        ende(_t('eskorte.wahl.gemerkt'));
      } },
      { label: _t('eskorte.wahl.reissen'), ton: '#4a1e22', callback: function () {
        qs.setFlag('eskorte_seite_gerissen', true);
        // Der Schreiber stutzt: das kostet etwas Verdacht, mehr nicht.
        var E = window.EspionageSystem;
        if (E && E.verdacht) E.verdacht(0.35);
        ende(_t('eskorte.wahl.gerissen'));
      } }
    ] });
    return true;
  }
  function _en() {
    try { return !!(window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en'); } catch (e) { return false; }
  }

  // --- Der Abschluss am Schacht ----------------------------------------------
  function abschluss(scene) {
    var S = window.SpionageSzenen;
    if (!scene || !S || typeof S.spiele !== 'function') return null;
    var qs = window.questSystem;
    var seite = (qs && qs.hasFlag('eskorte_seite_gerissen')) ? 'gerissen'
      : (qs && qs.hasFlag('eskorte_seite_gemerkt')) ? 'gemerkt' : 'ohne';
    if (st) st.abschlussGespielt = true;
    return S.spiele(scene, {
      art: 'eskorte_abschluss', bild: S.bildKey('eskorte_abschluss'),
      ziel: st && st.schacht ? { x: st.schacht.x, y: st.schacht.y } : null,
      kopf: _t('eskorte.ende.kopf'), titel: _t('eskorte.ende.titel'), farbe: '#d8ccb4',
      seiten: [
        { sprecher: '', text: _t('eskorte.ende.1') },
        { sprecher: '', text: _t('eskorte.ende.' + seite) },
        { sprecher: _t('spion.fuhrmann'), text: _t('eskorte.ende.2') }
      ],
      // Die Traeger sind hinab in den Nebel.
      onEnde: function () { if (st) _traegerFort(); }
    });
  }
  function _traegerFort() {
    st.traegerFort = true;
    ['traeger1', 'traeger2'].forEach(function (k) {
      var o = st.teile[k];
      if (o && o.scene) { try { o.destroy(); } catch (e) {} }
      st.teile[k] = null;
    });
  }

  // --- Debug (?eskorte=, docs/debug-modus.md) --------------------------------
  var SZENEN = { verladung: 0, waage: 1, schacht: 2, wahl: 1, abschluss: 2 };
  var _debugGesetzt = false;
  function _debugWert() {
    var G = window.DebugGate;
    var v = G && G.flagge ? G.flagge('eskorte') : null;
    return (v === null || v === undefined) ? null : String(v).toLowerCase();
  }
  /** Debug: aktiviert den Auftrag und zwingt die Umschlagstelle als ersten Raum. */
  function debugRaum(roomId) {
    var v = _debugWert();
    if (v === null || roomId !== 0) return false;
    if (_debugGesetzt) return true;
    _debugGesetzt = true;
    var qs = window.questSystem;
    if (!qs || typeof qs.getQuestSaveData !== 'function') return true;
    var daten = qs.getQuestSaveData();
    daten.quests = daten.quests || {};
    daten.flags = daten.flags || {};
    var bis = SZENEN.hasOwnProperty(v) ? SZENEN[v] : 0;
    if (v === 'abschluss') bis = 3;
    daten.quests[QUEST] = { status: 'active', objectives: ZIELE.map(function (z, i) {
      return { type: 'observe', target: z, current: i < bis ? 1 : 0, required: 1 };
    }) };
    daten.flags.eskorte_seite_gemerkt = false;
    daten.flags.eskorte_seite_gerissen = false;
    var namen = window.DebugGate.flagge('eskortenamen');
    if (namen) {
      daten.flags.namen_gewarnt = namen === 'gewarnt';
      daten.flags.namen_abgeliefert = namen === 'abgeliefert';
    }
    try { qs.loadQuestSaveData(daten); } catch (e) {}
    return true;
  }
  /** Debug: soll gleich eine Szene der Eskorte laufen (dann ohne Auftrags-Szene)? */
  function debugSzene() {
    var v = _debugWert();
    return !!(v && SZENEN.hasOwnProperty(v));
  }
  function _debugSzeneVorbereiten(scene) {
    var v = _debugWert();
    if (!v || !SZENEN.hasOwnProperty(v) || !scene.time) return;
    var s = st.stationen[SZENEN[v]];
    if (v === 'abschluss') {
      // Alles erledigt: der Karren steht am Schacht.
      st.station = st.stationen.length - 1;
      st.pos = Object.assign({}, st.pfad[s.punkt]);
      st.phase = 'fertig';
      scene.time.delayedCall(700, function () { if (st) abschluss(scene); });
      return;
    }
    if (v === 'wahl') {
      scene.time.delayedCall(700, function () { if (st) wahl(scene); });
    }
    // Karren an die Station, Spieler in die Zone: die Szene folgt im echten Ablauf.
    st.station = SZENEN[v];
    st.pos = Object.assign({}, st.pfad[s.punkt]);
    st.phase = 'halt';
    if (v === 'wahl') return;
    // Erst wenn der Raum steht: vorher setzt ihn der Raumaufbau noch an den Start.
    scene.time.delayedCall(400, function () {
      var z = st && _zone(s.zone);
      var p = window.player;
      if (!z || !p) return;
      z.gesperrt = false;
      z._elapsed = z.seconds;
      if (typeof p.setPosition === 'function') p.setPosition(z.x, z.y + 24); else { p.x = z.x; p.y = z.y + 24; }
    });
  }

  window.Nachteskorte = {
    RAUM: RAUM, QUEST: QUEST, ZIELE: ZIELE, NAMEN: NAMEN,
    starten: starten, beenden: beenden, update: update, aktiv: aktiv, getState: getState,
    hinweis: hinweis, warnt: warnt, wahl: wahl, abschluss: abschluss,
    erkannterName: erkannterName, namensHerkunft: namensHerkunft,
    debugRaum: debugRaum, debugSzene: debugSzene
  };
})();
