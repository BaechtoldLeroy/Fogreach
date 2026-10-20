/* =====================================================================
 * feedback.js — Rueckmeldungen der Tester und Laufbewertung
 * ---------------------------------------------------------------------
 * Ein runder Knopf unter dem Inventarknopf (Hub und Dungeon, Desktop und
 * Mobile) und die Taste F8 oeffnen ein Messing-Panel: Kategorie, Freitext,
 * Haken "Screenshot anhaengen" und ein automatischer Kontext (Version, Szene,
 * Tiefe, Akt, aktive Auftraege, Geraet, Sprache). Keine persoenlichen Daten.
 *
 * Gesendet wird an die Worker-Route POST /api/feedback (worker/feedback.js),
 * die daraus GitHub-Issues macht. Der Client kennt weder Token noch Repo.
 * Scheitert das Senden (offline, Route fehlt, Server ueberlastet), landet die
 * Rueckmeldung in einer Warteschlange (SlotStorage, geraeteweit) und wird beim
 * naechsten Start bzw. nach dem naechsten erfolgreichen Senden nachgereicht.
 *
 * Laufbewertung: jeder 5. Lauf (Rueckkehr in den Hub) bietet einen kleinen
 * Dialog mit 1 bis 5 Sternen und einem optionalen Satz an; in den
 * Einstellungen abschaltbar (gameplay.laufBewertung).
 *
 * Solange ein Panel offen ist, steht die Spieluhr, und Phasers Tastatur ist
 * aus, damit Tippen im Textfeld keine Spieltasten ausloest. Der Freitext ist
 * ein echtes DOM-Feld ueber dem Canvas, weil nur das auf dem Handy die
 * Bildschirmtastatur oeffnet.
 * ===================================================================== */
(function () {
  'use strict';

  var ENDPUNKT = '/api/feedback';
  var SCHLANGE_KEY = 'demonfall.feedbackWarteschlange.v1';
  var LAUF_KEY = 'demonfall.laufZaehler.v1';
  var KATEGORIEN = ['fehler', 'idee', 'balance', 'story', 'sonstiges'];
  var MAX_TEXT = 2000;
  var MAX_SATZ = 300;
  var MAX_SCHLANGE = 20;
  var MAX_BILD = 600000;       // Zeichen der data-URL; der Worker prueft dieselbe Grenze
  var BILD_BREITE = 800;
  var BEWERTUNG_ALLE = 5;
  var TIEFE = 6000;            // ueber HUD, Mobile-Steuerung und Dialogen
  var TINTE = '#2a1d10';

  if (typeof window !== 'undefined' && window.i18n) {
    window.i18n.register('de', {
      'feedback.titel': 'Rückmeldung',
      'feedback.kategorie.fehler': 'Fehler',
      'feedback.kategorie.idee': 'Idee',
      'feedback.kategorie.balance': 'Balance',
      'feedback.kategorie.story': 'Story/Text',
      'feedback.kategorie.sonstiges': 'Sonstiges',
      'feedback.platzhalter': 'Was ist Dir aufgefallen?',
      'feedback.screenshot': 'Screenshot anhängen',
      'feedback.screenshot_fehlt': 'Screenshot nicht verfügbar',
      'feedback.kontext': 'Mitgesendet werden Version, Ort, Tiefe, Akt, aktive Aufträge, Gerät, Fenstergrösse und Sprache. Keine persönlichen Daten.',
      'feedback.senden': 'Senden',
      'feedback.abbrechen': 'Abbrechen [ESC]',
      'feedback.leer': 'Bitte schreib ein paar Worte.',
      'feedback.danke': 'Danke! Deine Rückmeldung ist angekommen.',
      'feedback.offline': 'Keine Verbindung. Wird später nachgesendet.',
      'feedback.abgelehnt': 'Konnte nicht gesendet werden.',
      'bewertung.titel': 'Wie war dieser Lauf?',
      'bewertung.platzhalter': 'Ein Satz dazu (freiwillig)',
      'bewertung.sterne_fehlen': 'Bitte wähle 1 bis 5 Sterne.',
      'bewertung.spaeter': 'Später [ESC]',
      'bewertung.hinweis': 'Abschaltbar in den Einstellungen.'
    });
    window.i18n.register('en', {
      'feedback.titel': 'Feedback',
      'feedback.kategorie.fehler': 'Bug',
      'feedback.kategorie.idee': 'Idea',
      'feedback.kategorie.balance': 'Balance',
      'feedback.kategorie.story': 'Story/Text',
      'feedback.kategorie.sonstiges': 'Other',
      'feedback.platzhalter': 'What did you notice?',
      'feedback.screenshot': 'Attach screenshot',
      'feedback.screenshot_fehlt': 'Screenshot unavailable',
      'feedback.kontext': 'Sent along: version, location, depth, act, active quests, device, window size and language. No personal data.',
      'feedback.senden': 'Send',
      'feedback.abbrechen': 'Cancel [ESC]',
      'feedback.leer': 'Please write a few words.',
      'feedback.danke': 'Thank you! Your feedback has arrived.',
      'feedback.offline': 'No connection. Will be sent later.',
      'feedback.abgelehnt': 'Could not be sent.',
      'bewertung.titel': 'How was this run?',
      'bewertung.platzhalter': 'One sentence about it (optional)',
      'bewertung.sterne_fehlen': 'Please pick 1 to 5 stars.',
      'bewertung.spaeter': 'Later [ESC]',
      'bewertung.hinweis': 'Can be turned off in the settings.'
    });
  }
  function T(key) {
    try {
      var v = window.i18n && window.i18n.t(key);
      return (typeof v === 'string' && v.indexOf('[MISSING') !== 0) ? v : key;
    } catch (e) { return key; }
  }

  function _speicher() { return window.SlotStorage || null; }

  // ---------------------------------------------------------------------
  // Kontext: nur Spielzustand, nichts ueber die Person
  // ---------------------------------------------------------------------

  var _letzterLauf = null;

  function kontext(scene) {
    var key = (scene && scene.sys && scene.sys.settings) ? scene.sys.settings.key : null;
    var k = {
      version: String(window.GAME_VERSION || '?'),
      szene: key || '?',
      tiefe: null,
      akt: null,
      quests: [],
      geraet: 'desktop',
      bildschirm: null,
      sprache: (window.i18n && window.i18n.getLanguage) ? window.i18n.getLanguage() : 'de'
    };
    if (key === 'GameScene' && typeof window.DUNGEON_DEPTH === 'number') k.tiefe = window.DUNGEON_DEPTH;
    try {
      var S = window.storySystem;
      if (S && typeof S.getCurrentActIndex === 'function') k.akt = S.getCurrentActIndex();
    } catch (e) { /* Kontext ist Beiwerk */ }
    try {
      var Q = window.questSystem;
      if (Q && typeof Q.getActiveQuests === 'function') {
        k.quests = Q.getActiveQuests().map(function (q) { return q && q.id; }).filter(Boolean).slice(0, 20);
      }
    } catch (e) { /* Kontext ist Beiwerk */ }
    var g = scene && scene.sys && scene.sys.game;
    if (g && g.device && g.device.input && g.device.input.touch) k.geraet = 'touch';
    if (typeof window.innerWidth === 'number') k.bildschirm = window.innerWidth + 'x' + window.innerHeight;
    if (_letzterLauf) k.lauf = _letzterLauf;
    return k;
  }

  // ---------------------------------------------------------------------
  // Senden und Warteschlange
  // ---------------------------------------------------------------------

  /** 'ok' | 'spaeter' (nochmal versuchen) | 'nein' (Server lehnt den Inhalt ab). */
  function _post(daten) {
    var f = window.fetch;
    if (typeof f !== 'function') return Promise.resolve('spaeter');
    return Promise.resolve().then(function () {
      return f.call(window, ENDPUNKT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      });
    }).then(function (r) {
      if (r && r.ok) return 'ok';
      var s = r ? r.status : 0;
      // Route fehlt (statischer Server: 404/405), Zeitueberschreitung, Rate-Limit,
      // Serverfehler: spaeter nochmal. Alles andere ist ein Inhalt, der nie durchgeht.
      return (!s || s === 404 || s === 405 || s === 408 || s === 429 || s >= 500) ? 'spaeter' : 'nein';
    }, function () { return 'spaeter'; });
  }

  function warteschlange() {
    var S = _speicher();
    if (!S) return [];
    try {
      var l = JSON.parse(S.getItem(SCHLANGE_KEY) || '[]');
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  function _schreiben(liste) {
    var S = _speicher();
    if (!S) return false;
    var roh = JSON.stringify(liste);
    S.setItem(SCHLANGE_KEY, roh);
    // SlotStorage schluckt Schreibfehler (Speicher voll): nachlesen.
    return S.getItem(SCHLANGE_KEY) === roh;
  }

  function einreihen(daten) {
    var l = warteschlange();
    l.push({ id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), zeit: Date.now(), daten: daten });
    while (l.length > MAX_SCHLANGE) l.shift();
    if (_schreiben(l)) return true;
    // Zu gross fuer den Speicher: Bilder opfern, die Texte zaehlen mehr.
    l.forEach(function (e) { if (e.daten) e.daten.bild = null; });
    return _schreiben(l);
  }

  function _entfernen(id) {
    _schreiben(warteschlange().filter(function (e) { return e.id !== id; }));
  }

  var _nachsendenLaeuft = false;

  /** Reicht die Warteschlange der Reihe nach ein; stoppt beim ersten "spaeter". */
  function nachsenden() {
    if (_nachsendenLaeuft || !warteschlange().length) return Promise.resolve(0);
    _nachsendenLaeuft = true;
    var n = 0;
    function weiter() {
      var l = warteschlange();
      if (!l.length) return n;
      var e = l[0];
      return _post(e.daten).then(function (st) {
        if (st === 'spaeter') return n;
        _entfernen(e.id);
        if (st === 'ok') n++;
        return weiter();
      });
    }
    return weiter().then(function (r) { _nachsendenLaeuft = false; return r; },
      function () { _nachsendenLaeuft = false; return n; });
  }

  /** Liefert 'gesendet' | 'gemerkt' | 'abgelehnt'. */
  function senden(daten) {
    return _post(daten).then(function (st) {
      if (st === 'ok') { nachsenden(); return 'gesendet'; }
      if (st === 'spaeter') { einreihen(daten); return 'gemerkt'; }
      return 'abgelehnt';
    });
  }

  // ---------------------------------------------------------------------
  // Screenshot: vor dem Oeffnen, damit das Panel nicht mit im Bild ist
  // ---------------------------------------------------------------------

  function _verkleinern(img) {
    try {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if (!w || !h) return null;
      var f = Math.min(1, BILD_BREITE / w);
      var c = document.createElement('canvas');
      c.width = Math.round(w * f); c.height = Math.round(h * f);
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      var q = 0.72, url = c.toDataURL('image/jpeg', q);
      while (url && url.length > MAX_BILD && q > 0.3) { q -= 0.15; url = c.toDataURL('image/jpeg', q); }
      return (url && url.indexOf('data:image/') === 0 && url.length <= MAX_BILD) ? url : null;
    } catch (e) { return null; }
  }

  /** Ruft fertig(dataUrl | null) genau einmal; ohne Bild nach kurzer Frist. */
  function _bildMachen(scene, fertig) {
    var erledigt = false;
    function ende(url) { if (erledigt) return; erledigt = true; fertig(url || null); }
    try {
      var r = scene && scene.sys && scene.sys.game && scene.sys.game.renderer;
      if (!r || typeof r.snapshot !== 'function') { ende(null); return; }
      r.snapshot(function (img) { ende(img ? _verkleinern(img) : null); }, 'image/jpeg', 0.9);
    } catch (e) { ende(null); return; }
    setTimeout(function () { ende(null); }, 500);
  }

  // ---------------------------------------------------------------------
  // Gemeinsamer Rahmen der beiden Dialoge
  // ---------------------------------------------------------------------

  var _offen = null;   // { art, scene, c, felder, ... }

  function istOffen() { return !!(_offen && _offen.c && _offen.c.scene); }

  /** scrollFactor bis in jedes Kind setzen; Phaser steigt nur eine Ebene hinab. */
  function _tiefScroll(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0, 0);
    if (o.list && o.list.length) o.list.forEach(_tiefScroll);
  }

  function _stopp(p, x, y, e) { if (e && e.stopPropagation) e.stopPropagation(); }

  function _text(scene, x, y, s, stil) {
    return scene.add.text(x, y, s, Object.assign({ fontFamily: 'serif', fontSize: '15px', color: '#efe6d2' }, stil || {}));
  }

  /** Text-Knopf im Messing-Stil; ohne die Bilder ein schlichter Kasten. */
  function _knopf(scene, c, x, y, s, ton, aktion) {
    var b = _text(scene, x, y, s, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#f3e6c4',
      backgroundColor: ton || '#3a2f22', padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    c.add(b);
    if (window.uiRahmen && window.uiRahmen.bereit && window.uiRahmen.bereit(scene)) {
      window.uiRahmen.textKnopf(scene, b, null, { ton: ton || '#3a2f22', loslassen: true });
    }
    b.on('pointerdown', function (p, lx, ly, e) { _stopp(p, lx, ly, e); aktion(); });
    return b;
  }

  /** Echtes Eingabefeld ueber dem Canvas, an Spielkoordinaten ausgerichtet. */
  function _feld(scene, x, y, w, h, mehrzeilig, platzhalter, max) {
    var d = window.document;
    if (!d || typeof d.createElement !== 'function' || !d.body) return null;
    var el = d.createElement(mehrzeilig ? 'textarea' : 'input');
    el.value = '';
    el.placeholder = platzhalter;
    el.maxLength = max;
    if (el.setAttribute) { el.setAttribute('maxlength', String(max)); el.setAttribute('aria-label', platzhalter); }
    var st = el.style || (el.style = {});
    st.position = 'fixed'; st.zIndex = '10000'; st.margin = '0'; st.border = 'none'; st.outline = 'none';
    st.background = 'transparent'; st.color = TINTE; st.fontFamily = 'Georgia, serif'; st.resize = 'none';
    st.padding = '6px 8px'; st.boxSizing = 'border-box';
    // Tasten im Feld gehoeren dem Feld, nicht Phaser (der lauscht am window).
    var halt = function (e) { if (e && e.stopPropagation) e.stopPropagation(); };
    ['keydown', 'keyup', 'keypress'].forEach(function (t) { el.addEventListener(t, halt); });
    d.body.appendChild(el);
    function lage() {
      try {
        var cv = scene.sys.game.canvas;
        var r = cv.getBoundingClientRect();
        var sx = r.width / scene.scale.width, sy = r.height / scene.scale.height;
        st.left = (r.left + x * sx) + 'px'; st.top = (r.top + y * sy) + 'px';
        st.width = (w * sx) + 'px'; st.height = (h * sy) + 'px';
        st.fontSize = Math.max(12, Math.round(15 * sy)) + 'px';
      } catch (e) { /* ohne Canvas bleibt das Feld, wo es ist */ }
    }
    lage();
    window.addEventListener('resize', lage);
    return {
      el: el,
      wert: function () { return String(el.value || '').trim(); },
      weg: function () {
        window.removeEventListener('resize', lage);
        ['keydown', 'keyup', 'keypress'].forEach(function (t) { el.removeEventListener(t, halt); });
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }

  function _taste(e) {
    if (!istOffen() || !e) return;
    var k = e.key || e.code;
    if (k === 'Escape' || k === 'Esc' || e.keyCode === 27 || k === 'F8' || e.keyCode === 119) {
      if (e.preventDefault) e.preventDefault();
      schliessen();
    }
  }

  /** Abgedunkelter Hintergrund, Platte, Spieluhr anhalten, Tastatur umleiten. */
  function _rahmen(scene, art, w, h) {
    schliessen();
    var cw = scene.cameras.main.width, ch = scene.cameras.main.height;
    w = Math.min(w, cw - 16); h = Math.min(h, ch - 12);
    var c = scene.add.container(0, 0).setDepth(TIEFE);
    c.setName(art === 'bewertung' ? 'bewertungDialog' : 'feedbackPanel');
    var hinter = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.62).setInteractive();
    hinter.on('pointerdown', _stopp);
    c.add(hinter);
    var UR = window.uiRahmen;
    var teile = (UR && UR.bereit && UR.bereit(scene)) ? UR.platte(scene, cw / 2, ch / 2, w, h, 0, 0.55) : null;
    if (teile) teile.forEach(function (t) { c.add(t); });
    else c.add(scene.add.rectangle(cw / 2, ch / 2, w, h, 0x1c191f, 0.97).setStrokeStyle(3, 0xb08d57));

    var o = { art: art, scene: scene, c: c, felder: [], links: cw / 2 - w / 2, oben: ch / 2 - h / 2, w: w, h: h, cx: cw / 2 };
    var P = window.__GAME_PAUSE;
    o.pausiert = !!(P && P.since == null && typeof window.pauseGameClock === 'function');
    if (o.pausiert) window.pauseGameClock(scene);
    var kb = scene.input && scene.input.keyboard;
    if (kb) { o.kb = kb; o.kbVorher = kb.enabled; kb.enabled = false; }
    window.addEventListener('keydown', _taste, true);
    o.beiEnde = function () { schliessen(); };
    scene.events.once('shutdown', o.beiEnde);
    _offen = o;
    return o;
  }

  function _status(o, s, farbe) {
    if (!o.statusText || !o.statusText.scene) return;
    o.statusText.setText(s || '').setColor(farbe || '#ffb38a');
  }

  function schliessen() {
    var o = _offen;
    _offen = null;
    if (!o || !o.c) return;       // nichts offen oder nur ein wartender Screenshot
    window.removeEventListener('keydown', _taste, true);
    o.felder.forEach(function (f) { f.weg(); });
    if (o.scene && o.scene.events) o.scene.events.off('shutdown', o.beiEnde);
    if (o.kb) {
      o.kb.enabled = o.kbVorher !== false;
      if (typeof o.kb.resetKeys === 'function') { try { o.kb.resetKeys(); } catch (e) {} }
    }
    if (o.pausiert && typeof window.resumeGameClock === 'function') window.resumeGameClock(o.scene);
    if (o.c && o.c.scene) o.c.destroy(true);
  }

  /** Kurze Meldung oben mittig, verschwindet von selbst. */
  function _meldung(scene, s) {
    if (!scene || !scene.sys || !scene.add || !scene.sys.isActive()) return null;
    var t = scene.add.text(scene.cameras.main.width / 2, 70, s, {
      fontFamily: 'serif', fontSize: '16px', color: '#f3e6c4', backgroundColor: '#1c191f',
      padding: { x: 14, y: 8 }, stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(TIEFE + 1);
    t.setName('feedbackMeldung');
    scene.time.delayedCall(2800, function () { if (t.scene) t.destroy(); });
    return t;
  }

  function _ergebnisMelden(scene, erg) {
    var s = erg === 'gesendet' ? T('feedback.danke') : (erg === 'gemerkt' ? T('feedback.offline') : T('feedback.abgelehnt'));
    _meldung(scene, s);
  }

  // ---------------------------------------------------------------------
  // Panel: Rueckmeldung
  // ---------------------------------------------------------------------

  function oeffnen(scene) {
    if (!scene || !scene.sys || istOffen()) return;
    if (_offen && _offen.wartet) return;
    _offen = null;
    var warte = { wartet: true };
    _offen = warte;
    feedback._bildMachen(scene, function (bild) {
      if (_offen !== warte) return;     // inzwischen anders entschieden
      _offen = null;
      if (!scene.sys || !scene.sys.isActive()) return;
      _panelBauen(scene, bild);
    });
  }

  function umschalten(scene) {
    if (istOffen()) schliessen(); else oeffnen(scene);
  }

  function _panelBauen(scene, bild) {
    var o = _rahmen(scene, 'feedback', 600, 420);
    var c = o.c, L = o.links, O = o.oben, W = o.w, H = o.h;
    o.kontext = kontext(scene);
    o.bild = bild || null;
    o.mitBild = !!bild;
    o.kategorie = 'fehler';

    var titel = _text(scene, o.cx, O + 28, T('feedback.titel'), { fontSize: '24px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(0.5);
    c.add(titel);

    // Kategorien als eine Reihe; die gewaehlte leuchtet.
    o.kats = [];
    var breite = (W - 60) / KATEGORIEN.length;
    KATEGORIEN.forEach(function (k, i) {
      var b = _knopf(scene, c, L + 30 + breite * (i + 0.5), O + 68, T('feedback.kategorie.' + k), '#3a2f22', function () {
        o.kategorie = k; markieren();
      });
      b.setFontSize(Math.min(14, Math.floor(breite / 8)) + 'px');
      b._kategorie = k;
      o.kats.push(b);
    });
    function markieren() {
      o.kats.forEach(function (b) { b.setColor(b._kategorie === o.kategorie ? '#ffd166' : '#bfb39a'); });
      if (o.marke) o.marke.setVisible(true);
      var gew = o.kats.filter(function (b) { return b._kategorie === o.kategorie; })[0];
      if (gew && o.marke) o.marke.setPosition(gew.x, gew.y + 17).setSize(gew.width - 10, 3);
    }
    o.marke = scene.add.rectangle(0, 0, 10, 3, 0xffd166, 1).setOrigin(0.5);
    c.add(o.marke);

    // Pergamentflaeche, darueber das echte Textfeld.
    var fx = L + 30, fy = O + 98, fw = W - 60, fh = Math.max(90, H - 250);
    var perg = scene.add.rectangle(fx, fy, fw, fh, 0xe9dcb8, 1).setOrigin(0, 0).setStrokeStyle(2, 0x8a6a3a);
    c.add(perg);
    var feld = _feld(scene, fx, fy, fw, fh, true, T('feedback.platzhalter'), MAX_TEXT);
    if (feld) {
      o.felder.push(feld);
      o.textarea = feld.el;
      var g = scene.sys.game;
      if (!(g && g.device && g.device.input && g.device.input.touch) && feld.el.focus) { try { feld.el.focus(); } catch (e) {} }
    }

    // Haken: Screenshot anhaengen.
    var hy = fy + fh + 22;
    o.haken = scene.add.rectangle(fx + 9, hy, 18, 18, 0x15110e, 1).setStrokeStyle(2, 0xb08d57);
    o.hakenZeichen = _text(scene, fx + 9, hy, '✓', { fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(0.5);
    var hakenText = _text(scene, fx + 26, hy, bild ? T('feedback.screenshot') : T('feedback.screenshot_fehlt'),
      { fontSize: '15px', color: bild ? '#efe6d2' : '#8d8473' }).setOrigin(0, 0.5);
    c.add([o.haken, o.hakenZeichen, hakenText]);
    var hakenZone = scene.add.rectangle(fx - 4, hy, hakenText.width + 40, 30, 0x000000, 0).setOrigin(0, 0.5);
    hakenZone.setName('feedbackHaken');
    c.add(hakenZone);
    function hakenZeigen() { o.hakenZeichen.setVisible(o.mitBild); }
    if (bild) {
      hakenZone.setInteractive({ useHandCursor: true });
      hakenZone.on('pointerdown', function (p, x, y, e) { _stopp(p, x, y, e); o.mitBild = !o.mitBild; hakenZeigen(); });
    }
    o.hakenZone = hakenZone;
    hakenZeigen();

    var kt = _text(scene, fx, hy + 18, T('feedback.kontext'), {
      fontSize: '12px', color: '#bfb39a', wordWrap: { width: fw }
    });
    c.add(kt);

    o.statusText = _text(scene, o.cx, O + H - 64, '', { fontSize: '14px', color: '#ffb38a' }).setOrigin(0.5);
    c.add(o.statusText);
    o.senden = _knopf(scene, c, o.cx - 90, O + H - 34, T('feedback.senden'), '#24402a', function () { _panelAbsenden(o); });
    o.senden.setName('feedbackSenden');
    o.abbrechen = _knopf(scene, c, o.cx + 90, O + H - 34, T('feedback.abbrechen'), '#4a1e22', schliessen);
    o.abbrechen.setName('feedbackAbbrechen');

    markieren();
    _tiefScroll(c);
    return o;
  }

  function _panelAbsenden(o) {
    if (o.sendet || _offen !== o) return;
    var text = o.felder[0] ? o.felder[0].wert() : '';
    if (!text) { _status(o, T('feedback.leer')); return; }
    o.sendet = true;
    var daten = {
      typ: 'feedback',
      kategorie: o.kategorie,
      text: text.slice(0, MAX_TEXT),
      kontext: o.kontext,
      bild: o.mitBild ? o.bild : null
    };
    var scene = o.scene;
    schliessen();
    return senden(daten).then(function (erg) { _ergebnisMelden(scene, erg); return erg; });
  }

  // ---------------------------------------------------------------------
  // Laufbewertung
  // ---------------------------------------------------------------------

  var _faellig = false;

  function bewertungAn() {
    try {
      var s = typeof window.loadGameSettings === 'function' ? window.loadGameSettings() : null;
      return !(s && s.gameplay && s.gameplay.laufBewertung === false);
    } catch (e) { return true; }
  }

  function laeufe() {
    var S = _speicher();
    return S ? (parseInt(S.getItem(LAUF_KEY), 10) || 0) : 0;
  }

  /** Aus leaveDungeonForHub: Lauf zaehlen; jeder 5. macht eine Bewertung faellig. */
  function laufBeendet(zusammenfassung) {
    var S = _speicher();
    var n = laeufe() + 1;
    if (S) S.setItem(LAUF_KEY, String(n));
    if (zusammenfassung) {
      _letzterLauf = {
        grund: String(zusammenfassung.reason || ''),
        tiefe: zusammenfassung.deepestDepth || null,
        dauerS: Math.round((zusammenfassung.durationMs || 0) / 1000)
      };
    }
    if (n % BEWERTUNG_ALLE === 0 && bewertungAn()) _faellig = true;
    return n;
  }

  function bewertungFaellig() { return _faellig; }

  /**
   * Im Hub, sobald nichts anderes offen ist (Laufzusammenfassung zu).
   * Laeuft gerade ein anderer Dialog, wird spaeter nochmal geschaut.
   */
  function bewertungAnbieten(scene, versuch) {
    if (!_faellig || !scene || !scene.sys || !scene.sys.isActive()) return false;
    versuch = versuch || 0;
    var belegt = istOffen() || scene._dialogOpen
      || (scene.children && scene.children.getByName && scene.children.getByName('runSummaryDialog'));
    if (belegt) {
      if (versuch < 30 && scene.time) scene.time.delayedCall(1000, function () { bewertungAnbieten(scene, versuch + 1); });
      return false;
    }
    if (!bewertungAn()) { _faellig = false; return false; }
    _faellig = false;
    bewertungZeigen(scene);
    return true;
  }

  function bewertungZeigen(scene) {
    var o = _rahmen(scene, 'bewertung', 440, 270);
    var c = o.c, O = o.oben, W = o.w, H = o.h, L = o.links;
    o.kontext = kontext(scene);
    o.sterne = 0;
    c.add(_text(scene, o.cx, O + 30, T('bewertung.titel'), { fontSize: '22px', fontStyle: 'bold', color: '#ffd166' }).setOrigin(0.5));

    o.sternBilder = [];
    for (var i = 1; i <= 5; i++) {
      (function (wert) {
        var x = o.cx + (wert - 3) * 50, y = O + 78;
        var s = scene.add.star(x, y, 5, 9, 20, 0x3a3128, 1).setStrokeStyle(2, 0xb08d57);
        var zone = scene.add.rectangle(x, y, 46, 46, 0x000000, 0).setInteractive({ useHandCursor: true });
        zone.setName('bewertungStern' + wert);
        zone.on('pointerdown', function (p, lx, ly, e) { _stopp(p, lx, ly, e); o.sterne = wert; malen(); _status(o, ''); });
        c.add([s, zone]);
        o.sternBilder.push(s);
      })(i);
    }
    function malen() {
      o.sternBilder.forEach(function (s, k) { s.setFillStyle(k < o.sterne ? 0xffd166 : 0x3a3128, 1); });
    }

    var fx = L + 30, fy = O + 110, fw = W - 60, fh = 34;
    c.add(scene.add.rectangle(fx, fy, fw, fh, 0xe9dcb8, 1).setOrigin(0, 0).setStrokeStyle(2, 0x8a6a3a));
    var feld = _feld(scene, fx, fy, fw, fh, false, T('bewertung.platzhalter'), MAX_SATZ);
    if (feld) { o.felder.push(feld); o.satzFeld = feld.el; }

    c.add(_text(scene, o.cx, fy + fh + 14, T('bewertung.hinweis'), { fontSize: '12px', color: '#bfb39a' }).setOrigin(0.5));
    o.statusText = _text(scene, o.cx, O + H - 62, '', { fontSize: '14px', color: '#ffb38a' }).setOrigin(0.5);
    c.add(o.statusText);
    o.senden = _knopf(scene, c, o.cx - 80, O + H - 32, T('feedback.senden'), '#24402a', function () { _bewertungAbsenden(o); });
    o.senden.setName('bewertungSenden');
    o.abbrechen = _knopf(scene, c, o.cx + 80, O + H - 32, T('bewertung.spaeter'), '#4a1e22', schliessen);
    o.abbrechen.setName('bewertungSpaeter');
    malen();
    _tiefScroll(c);
    return o;
  }

  function _bewertungAbsenden(o) {
    if (o.sendet || _offen !== o) return;
    if (!(o.sterne >= 1 && o.sterne <= 5)) { _status(o, T('bewertung.sterne_fehlen')); return; }
    o.sendet = true;
    var daten = {
      typ: 'bewertung',
      sterne: o.sterne,
      satz: (o.felder[0] ? o.felder[0].wert() : '').slice(0, MAX_SATZ),
      kontext: o.kontext
    };
    var scene = o.scene;
    schliessen();
    return senden(daten).then(function (erg) { _ergebnisMelden(scene, erg); return erg; });
  }

  // ---------------------------------------------------------------------
  // Der runde Knopf unter dem Inventar (Hub und Dungeon)
  // ---------------------------------------------------------------------

  /**
   * o: { x, y } oder lage() -> {x, y} (wird bei Groessenwechsel neu gelesen),
   * r = Radius wie die Nachbarknoepfe, tiefe = deren Tiefe.
   * Bindet zusaetzlich F8 in dieser Szene.
   */
  function knopf(scene, o) {
    if (!scene || !scene.add) return null;
    o = o || {};
    var lage = typeof o.lage === 'function' ? o.lage : function () { return { x: o.x, y: o.y }; };
    var pos = lage(), r = o.r || 22, t = o.tiefe || 1300;
    var UR = window.uiRahmen, HL = window.hudLeiste;
    var messing = !!(UR && UR.bereit && UR.bereit(scene) && UR.ring);
    var bg = scene.add.circle(pos.x, pos.y, r, 0x10131c, 0.95).setStrokeStyle(messing ? 0 : 2, 0xd4a543)
      .setScrollFactor(0).setDepth(t);
    var ring = messing ? UR.ring(scene, pos.x, pos.y, r * 2 + 10, t + 0.5) : null;
    var icon = (HL && HL.bereit(scene) && HL.frame('feedback') >= 0)
      ? scene.add.image(pos.x, pos.y, HL.KEY, HL.frame('feedback')).setDisplaySize(r * 2 - 8, r * 2 - 8)
      : scene.add.text(pos.x, pos.y, '✎', { fontFamily: 'serif', fontSize: '22px', color: '#ffd166' }).setOrigin(0.5);
    icon.setScrollFactor(0).setDepth(t + 1).setName('feedbackSymbol');
    var hit = scene.add.rectangle(pos.x, pos.y, r * 2, r * 2, 0x000000, 0).setScrollFactor(0).setDepth(t + 2)
      .setInteractive({ useHandCursor: true });
    hit.setName('feedbackKnopf');
    var basis = icon.scaleX;
    hit.on('pointerover', function () { icon.setScale(basis * 1.1); });
    hit.on('pointerout', function () { icon.setScale(basis); });
    hit.on('pointerdown', function (p, lx, ly, e) {
      _stopp(p, lx, ly, e);
      icon.setScale(basis * 0.9);
      if (scene.time) scene.time.delayedCall(140, function () { if (icon.scene) icon.setScale(basis); });
      oeffnen(scene);
    });

    var neu = function () {
      var p = lage();
      [bg, ring, icon, hit].forEach(function (g) { if (g && g.scene) g.setPosition(p.x, p.y); });
    };
    if (scene.scale && scene.scale.on) scene.scale.on('resize', neu);
    var kb = scene.input && scene.input.keyboard;
    if (kb && !scene._feedbackF8) {
      scene._feedbackF8 = function () { umschalten(scene); };
      kb.on('keydown-F8', scene._feedbackF8);
    }
    scene.events.once('shutdown', function () {
      if (scene.scale && scene.scale.off) scene.scale.off('resize', neu);
      if (kb && scene._feedbackF8) kb.off('keydown-F8', scene._feedbackF8);
      scene._feedbackF8 = null;
    });
    return { bg: bg, ring: ring, icon: icon, hit: hit };
  }

  // Beim Start und wenn die Verbindung zurueckkommt: Liegengebliebenes nachreichen.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', function () { nachsenden(); });
    setTimeout(function () { nachsenden(); }, 4000);
  }

  var feedback = {
    ENDPUNKT: ENDPUNKT, SCHLANGE_KEY: SCHLANGE_KEY, LAUF_KEY: LAUF_KEY, KATEGORIEN: KATEGORIEN,
    BEWERTUNG_ALLE: BEWERTUNG_ALLE, MAX_BILD: MAX_BILD,
    knopf: knopf, oeffnen: oeffnen, schliessen: schliessen, umschalten: umschalten, istOffen: istOffen,
    kontext: kontext, senden: senden, einreihen: einreihen, warteschlange: warteschlange, nachsenden: nachsenden,
    laufBeendet: laufBeendet, laeufe: laeufe, bewertungAn: bewertungAn, bewertungFaellig: bewertungFaellig,
    bewertungAnbieten: bewertungAnbieten, bewertungZeigen: bewertungZeigen,
    _bildMachen: _bildMachen, _offen: function () { return _offen; },
    _absenden: function () { var o = _offen; if (!o) return null; return o.art === 'bewertung' ? _bewertungAbsenden(o) : _panelAbsenden(o); }
  };
  if (typeof window !== 'undefined') window.Feedback = feedback;
})();
