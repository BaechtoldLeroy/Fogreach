/* =====================================================================
 * trailerModus.js — Einstellungen fuer den 30-Sekunden-Trailer
 * ---------------------------------------------------------------------
 * Mit ?trailer=1 (Debug-Gate, lokal automatisch offen) wird das Spiel zum
 * Drehort: kein HUD, der Spieler stirbt nicht, und die Tasten 0-9 bauen je
 * eine Einstellung aus docs/trailer-drehbuch.md auf — mit festem Zufall,
 * damit jeder Durchlauf gleich aussieht und man den besten nehmen kann.
 * Jede Einstellung kommt schnell zur Sache: Handlung ab ~0,3 s nach dem
 * Tastendruck, der Hoehepunkt nach 1,5-3 s (Schnitte im Takt der Musik).
 *
 *   0-9  Einstellung (Szene, Figuren, Kamerafahrt; 0 = Inventar,
 *        5 = Kampf mit HUD)
 *   R    Aufnahme starten/stoppen (Canvas + Spielton -> .webm-Download)
 *   Z    Zeitlupe an/aus (Spieluhr x0.3)
 *   L    Letterbox-Balken an/aus
 *   H    HUD kurz einblenden / wieder weg
 *   M    Ton an/aus
 *
 * Der Spielstand bleibt unberuehrt: saveSlots.js leitet im Trailer-Modus
 * jedes Schreiben in einen Speicher-Sandkasten um.
 *
 * Ohne Flagge legt das Modul nur TrailerModus.aktiv() an (immer false) und
 * tut sonst nichts.
 * ===================================================================== */
(function () {
  'use strict';

  function aktiv() {
    try { return !!(window.DebugGate && window.DebugGate.an('trailer')); } catch (e) { return false; }
  }

  var TM = { aktiv: aktiv };
  window.TrailerModus = TM;
  if (!aktiv()) return;

  var ZEITLUPE = 0.3;
  var HAUPTSZENEN = ['HubSceneV2', 'GameScene'];
  var HILFE_MS = 3000;

  // Hochkant (9:16 fuer Reels/Shorts): main.js stellt das Canvas im
  // Trailer-Modus auf 540x960, mit &quer=1 bleibt es 960x480. Im Hochformat
  // geht die Kamera nah an die Figuren (Zoom), die Choreografie laeuft
  // senkrecht statt waagerecht, und die Aufnahme wird doppelt so gross
  // (1080x1920) gespeichert.
  var HOCHKANT = (function () {
    var g = spiel();
    return !!(g && g.config && Number(g.config.height) > Number(g.config.width));
  })();
  // Kamera-Zoom im Hochformat: im Dungeon steht der Spieler damit etwa so
  // gross im Bild wie quer (72 px auf 480 Bildhoehe).
  var NAH = 1.8;
  var echtesXP = null; // das addXP des Spiels (die Drehregeln schalten es stumm)

  var S = {
    einstellung: null, // zuletzt gestartete Einstellung (0 ist das Inventar)
    lauf: 0,          // zaehlt hoch; alte Ablaeufe erkennen sich daran als veraltet
    uhr: 0,           // Echtzeit seit Beginn der Einstellung (ms)
    plan: [],         // { ab, fn, lauf }
    hud: false,       // HUD sichtbar?
    zeitlupe: false,      // wirkt gerade
    zeitlupeTaste: false, // vom Aufnehmenden per Z gewaehlt; gilt ueber Einstellungen hinweg
    letterbox: false,
    ruhe: null,       // null | 'alle' | 'fremde' | 'boss' — welche Gegner weichen
    hudZwang: false,  // die Einstellung zeigt das HUD selbst (Kampf mit HUD)
    boden: 1,         // Anteil des Lebens, unter den es nie faellt (1 = immer voll)
    verwundbar: false, // Treffer kommen an (nur bis zum Boden)
    momente: {},      // Hoehepunkte der Einstellung: Name -> ms ab Aufbau
    planEnde: 0,      // letzter geplanter Schritt (ms ab Aufbau)
    wartend: null,    // Einstellung, die auf den ersten Hub wartet
    hubGesehen: false,
    gesperrt: false   // ein Szenenwechsel laeuft gerade
  };

  // ---------------------------------------------------------------------
  // Fester Zufall
  // ---------------------------------------------------------------------
  // Math.random wird fuer die Dauer der Einstellung durch einen gesaeten
  // Generator (mulberry32) ersetzt; Phasers eigener Generator bekommt
  // denselben Samen. Die naechste Einstellung saet neu.
  function saeen(samen) {
    var a = samen >>> 0;
    Math.random = function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { Phaser.Math.RND.sow([String(samen)]); } catch (e) {}
  }

  function spiel() { return window.game || (typeof game !== 'undefined' ? game : null); }

  function szene(key) {
    var g = spiel();
    try { return (g && g.scene) ? g.scene.getScene(key) : null; } catch (e) { return null; }
  }

  function laeuft(key) {
    var sc = szene(key);
    return !!(sc && sc.sys && sc.sys.settings && sc.sys.settings.status === 5 && sc.sys.isActive());
  }

  function hauptszene() {
    if (laeuft('GameScene')) return szene('GameScene');
    if (laeuft('HubSceneV2')) return szene('HubSceneV2');
    if (laeuft('TrailerTitel')) return szene('TrailerTitel');
    return null;
  }

  // ---------------------------------------------------------------------
  // Ablaufplan: Schritte in Echtzeit ab Beginn der Einstellung. Er zaehlt
  // die Bildzeit des Spiels, nicht die Spieluhr — die Zeitlupe dehnt also
  // die Handlung, nicht die Choreografie.
  // ---------------------------------------------------------------------
  function plan(ms, fn) {
    S.plan.push({ ab: S.uhr + ms, fn: fn, lauf: S.lauf });
    if (S.aufbauAb != null) S.planEnde = Math.max(S.planEnde, S.uhr + ms - S.aufbauAb);
  }

  /** Haelt fest, wann der Hoehepunkt einer Einstellung kommt (fuer Tests und Schnitt). */
  function moment(name) {
    if (S.aufbauAb != null && S.momente[name] === undefined) S.momente[name] = Math.round(S.uhr - S.aufbauAb);
  }

  function planAbarbeiten() {
    var faellig = S.plan.filter(function (p) { return p.ab <= S.uhr; });
    if (!faellig.length) return;
    S.plan = S.plan.filter(function (p) { return p.ab > S.uhr; });
    faellig.forEach(function (p) {
      if (p.lauf !== S.lauf) return;
      try { p.fn(); } catch (e) { console.error('[Trailer] Schritt fehlgeschlagen', e); }
    });
  }

  // ---------------------------------------------------------------------
  // HUD ausblenden: alles am Bildschirm Klebende im HUD-Band (Tiefe 1001 bis
  // 2000) und die Hub-Beschriftungen. Ausgeblendet wird ueber die Kamera
  // (ignore), nicht ueber visible — das Spiel schaltet visible selbst und
  // wuerde gegen uns arbeiten. Was der Trailer selbst oeffnet (Dialog,
  // Boss-Auftritt), traegt __trailerBild und bleibt.
  // ---------------------------------------------------------------------
  function hudObjekte(sc) {
    var out = [];
    var liste = (sc.children && sc.children.list) || [];
    for (var i = 0; i < liste.length; i++) {
      var o = liste[i];
      if (!o || o.__trailerBild) continue;
      if (o.scrollFactorX === 0 && o.depth >= 1001 && o.depth < 2400) out.push(o);
    }
    if (sc.sys.settings.key === 'HubSceneV2') {
      (sc.npcs || []).forEach(function (n) { out.push(n.questIndicator, n.nameText); });
      (sc.entranceLabels || []).forEach(function (e) { out.push(e.label); });
      (sc._brettZeichen || []).forEach(function (t) { out.push(t); });
      out.push(sc.prompt && sc.prompt._c);
    }
    return out.filter(function (o) { return o && !o.__trailerBild; });
  }

  function kameras(sc) {
    return (sc.cameras && sc.cameras.cameras) ? sc.cameras.cameras : [];
  }

  function hudVerstecken(sc) {
    var kams = kameras(sc);
    hudObjekte(sc).forEach(function (o) {
      if (o.__trailerVersteckt) return;
      kams.forEach(function (k) { try { k.ignore(o); } catch (e) {} });
      o.__trailerVersteckt = true;
    });
  }

  function hudZeigen(sc) {
    var kams = kameras(sc);
    var alle = ((sc.children && sc.children.list) || []).slice();
    if (sc.sys.settings.key === 'HubSceneV2') alle = alle.concat(hudObjekte(sc));
    alle.forEach(function (o) {
      if (!o || !o.__trailerVersteckt) return;
      kams.forEach(function (k) { o.cameraFilter &= ~k.id; });
      o.__trailerVersteckt = false;
    });
  }

  // ---------------------------------------------------------------------
  // Hochkant: eine zweite Kamera ohne Zoom fuer alles am Bildschirm Klebende
  // ---------------------------------------------------------------------
  // Phaser zoomt Objekte mit scrollFactor 0 mit (um die Bildmitte). Im
  // Hochformat steht die Hauptkamera aber nah an den Figuren — Dialog,
  // Boss-Plakette, Inventar und Sitzungsbuehne waeren vergroessert und
  // abgeschnitten. Sie gehen darum auf eine eigene Kamera ohne Zoom; die
  // Hauptkamera zeigt nur die Welt. Unter Tiefe 1001 bleibt alles auf der
  // Hauptkamera: Sichtfeld-Abdunklung und Nebelschleier rechnen mit ihrem Zoom.
  //
  // Hochkant-HUD: das HUD ist fuer 960x480 gebaut — oben klebt es am Rand,
  // die Faehigkeitsleiste unten. Im 9:16-Bild laege beides in den Zonen, die
  // Reels/Shorts mit ihrer Oberflaeche belegen (oben 12 %, unten 20 %). Zwei
  // weitere Kameras ohne Zoom zeigen es darum versetzt: die obere Leiste
  // (Leben, Erfahrung, Minikarte, Knoepfe) um die obere Zone nach unten, die
  // Faehigkeitsleiste um die untere Zone nach oben, Meldungen unter die obere
  // Leiste. Die Spielobjekte selbst bleiben, wo das Spiel sie hinstellt.
  // Senkrechter Versatz je Band (px im Bild).
  function hudVersatz(sc) {
    var h = sc.scale.height, oben = Math.round(h * 0.12);
    return { oben: oben, unten: -(h - Math.round(h * 0.8)), meldung: oben + 145 };
  }

  function uiKamera(sc) {
    var k = sc.__trailerUiKam;
    if (!k || kameras(sc).indexOf(k) === -1) {
      var w = sc.scale.width, h = sc.scale.height, v = hudVersatz(sc);
      // Zuerst die HUD-Kameras: sie zeichnen vor der UI-Kamera, Dialog,
      // Plakette und Inventar liegen also ueber dem HUD.
      sc.__trailerHudKams = {};
      ['oben', 'unten', 'meldung'].forEach(function (band) {
        sc.__trailerHudKams[band] = sc.cameras.add(0, v[band], w, h, false, 'trailerHud_' + band);
      });
      k = sc.cameras.add(0, 0, w, h, false, 'trailerUi');
      sc.__trailerUiKam = k;
    }
    return k;
  }

  /** Grenzen dessen, was man sieht: ein Container nur mit sichtbaren Kindern. */
  function sichtbareGrenzen(o) {
    if (o.type === 'Container' && o.list) {
      var r = null;
      o.list.forEach(function (k) {
        if (!k || k.visible === false) return;
        var b = sichtbareGrenzen(k);
        if (!b) return;
        r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) }
          : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      });
      return r;
    }
    if (!o.getBounds) return null;
    try {
      var g = o.getBounds();
      return isFinite(g.left) && isFinite(g.top) ? { left: g.left, top: g.top, right: g.right, bottom: g.bottom } : null;
    } catch (e) { return null; }
  }

  /**
   * Wohin ein HUD-Teil hochkant gehoert: 'oben' (im oberen Viertel an den
   * Rand geklebt), 'unten' (in den unteren 20 %), 'meldung' (die Meldung
   * oben in der Mitte) oder null (bleibt, wo es ist). Eine breite
   * Ueberschrift in der Mitte (der Gebietsname) bleibt: sie vergeht von
   * selbst und wuerde versetzt die Leisten ueberdecken.
   * Zeichnungen ohne Grenzen (der Raumbalken unter der Minikarte) gehen mit
   * der oberen Leiste.
   */
  function hudBand(sc, o) {
    if (o.scrollFactorX !== 0) return null;
    // Die Meldung (etwa "Stufe 2 erreicht!") steht oben in der Mitte — dort,
    // wo jetzt die Leisten stehen. Sie rutscht ganz darunter.
    var toast = sc._activeEventToast;
    if (toast && toast.teile && toast.teile.indexOf(o) !== -1) return 'meldung';
    // Ab 1900 liegen Meldungen und Menues; die Leisten liegen darunter.
    if (!(o.depth >= 1001 && o.depth < 1900)) return null;
    var w = sc.scale.width, h = sc.scale.height, b = sichtbareGrenzen(o);
    if (!b) return o.type === 'Graphics' ? 'oben' : null;
    if (b.bottom > h * 0.8 + 1) return 'unten';
    var mitte = (b.left + b.right) / 2, breite = b.right - b.left;
    if (breite > w * 0.4 && Math.abs(mitte - w / 2) < w * 0.1) return null;
    return b.top < h * 0.25 ? 'oben' : null;
  }

  function kamerasVerteilen(sc) {
    var ui = uiKamera(sc), haupt = sc.cameras.main;
    if (!ui || !haupt || ui === haupt) return;
    var hk = sc.__trailerHudKams || {};
    var hud = 0;
    Object.keys(hk).forEach(function (b) { hud |= hk[b].id; });
    var liste = (sc.children && sc.children.list) || [];
    for (var i = 0; i < liste.length; i++) {
      var o = liste[i];
      if (!o || o.cameraFilter === undefined) continue;
      if (o.scrollFactorX === 0 && o.depth >= 1001) {
        o.cameraFilter |= haupt.id | hud | ui.id;
        o.__trailerUi = true;
        // Versteckte HUD-Teile bleiben fuer alle Kameras weg.
        if (o.__trailerVersteckt) continue;
        var band = (!o.__trailerBild && S.hudAn) ? hudBand(sc, o) : null;
        o.__trailerBand = band;
        o.cameraFilter &= ~((band && hk[band]) || ui).id;
      } else {
        if (o.__trailerUi) { o.cameraFilter &= ~haupt.id; o.__trailerUi = false; }
        o.cameraFilter |= ui.id | hud;
      }
    }
  }

  /** Wo ein HUD-Teil hochkant im Bild steht (mit dem Versatz seiner Kamera). */
  function imBild(sc, o) {
    var b = sichtbareGrenzen(o);
    if (!b) return null;
    var dy = o.__trailerBand ? hudVersatz(sc)[o.__trailerBand] : 0;
    return { left: b.left, top: b.top + dy, right: b.right, bottom: b.bottom + dy };
  }

  // Was auch versetzt nicht ganz ins Bild passt, bleibt weg — halb
  // abgeschnittene Teile sahen kaputt aus.
  function hudBeschneiden(sc) {
    if (!sc.__trailerUiKam) return;
    var w = sc.scale.width, h = sc.scale.height;
    var alle = sc.__trailerUiKam.id, hk = sc.__trailerHudKams || {};
    Object.keys(hk).forEach(function (b) { alle |= hk[b].id; });
    hudObjekte(sc).forEach(function (o) {
      if (o.scrollFactorX !== 0) return;
      var b = imBild(sc, o);
      if (b && (b.left < -1 || b.top < -1 || b.right > w + 1 || b.bottom > h + 1)) o.cameraFilter |= alle;
    });
  }

  /**
   * Fuer Tests: jedes HUD-Teil, das gerade eine Kamera zeigt, mit seiner
   * Lage im Bild und seinem Band.
   */
  function hudLage(sc) {
    return hudObjekte(sc).filter(function (o) {
      return o.scrollFactorX === 0 && o.visible !== false && o.alpha !== 0
        && kameras(sc).some(function (k) { return (o.cameraFilter & k.id) === 0; });
    }).map(function (o) {
      var b = HOCHKANT ? imBild(sc, o) : sichtbareGrenzen(o);
      return { typ: o.type, tiefe: o.depth, band: o.__trailerBand || null, text: o.text ? String(o.text).slice(0, 24) : '',
        b: b ? { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), u: Math.round(b.bottom) } : null };
    });
  }

  /** Alles, was jetzt neu entsteht, gehoert zum Bild und wird nie versteckt. */
  function behalten(sc, fn) {
    var vorher = ((sc.children && sc.children.list) || []).slice();
    try { fn(); } finally {
      ((sc.children && sc.children.list) || []).forEach(function (o) {
        if (vorher.indexOf(o) === -1) o.__trailerBild = true;
      });
    }
  }

  // ---------------------------------------------------------------------
  // Zeitlupe: Spieluhr (gameNow) plus die Phaser-Uhren der laufenden Szenen
  // ---------------------------------------------------------------------
  function zeitfaktor() { return S.zeitlupe ? ZEITLUPE : 1; }

  function zeitAnwenden(sc) {
    var f = zeitfaktor();
    // Jedes Bild neu: ein Szenen-Neustart baut Physik und Uhren frisch auf.
    try { if (sc.time && sc.time.timeScale !== f) sc.time.timeScale = f; } catch (e) {}
    try { if (sc.tweens && sc.tweens.timeScale !== f) sc.tweens.timeScale = f; } catch (e) {}
    try { if (sc.physics && sc.physics.world && sc.physics.world.timeScale !== 1 / f) sc.physics.world.timeScale = 1 / f; } catch (e) {}
  }

  function zeitlupeSetzen(an) {
    S.zeitlupe = !!an;
    var sc = hauptszene();
    if (typeof window.setGameTimeScale === 'function') window.setGameTimeScale(zeitfaktor(), sc);
    try { spiel().anims.globalTimeScale = zeitfaktor(); } catch (e) {}
    var g = spiel();
    if (g && g.scene) g.scene.getScenes(true).forEach(zeitAnwenden);
  }

  // ---------------------------------------------------------------------
  // Drehregeln: unverwundbar, keine Erfahrung, fester Lauf
  // ---------------------------------------------------------------------
  function drehregeln() {
    // Jeder Treffer prallt ab: applyPlayerDamage fragt zuerst hier. Nur der
    // Kampf mit HUD laesst Treffer durch — die Lebensleiste soll sinken.
    try {
      Object.defineProperty(window, '_playerInvincible', {
        configurable: true, get: function () { return !S.verwundbar; }, set: function () {}
      });
    } catch (e) {}
    // Was daran vorbeigeht (Brand, Gift, Blutpakt), zieht ueber
    // setPlayerHealth ab — dort bleibt das Leben voll (bzw. ueber dem Boden).
    var orig = window.setPlayerHealth;
    if (typeof orig === 'function' && !orig.__trailer) {
      var voll = function (wert, ui) {
        var max = (typeof playerMaxHealth !== 'undefined' && playerMaxHealth) || wert;
        return orig(Math.max(Number(wert) || 0, Math.ceil(max * S.boden)), ui);
      };
      voll.__trailer = true;
      window.setPlayerHealth = voll;
    }
    // Keine Erfahrung: ein Stufenaufstieg legt sonst mitten in der Montage
    // seinen goldenen Blitz uebers Bild. Der Kampf mit HUD gibt sie gezielt
    // ueber das echte addXP (Leiste fuellt sich, Stufenaufstieg).
    echtesXP = window.addXP;
    window.addXP = function () {};
    // Den Lauf (Raumfolge) immer aus demselben Samen wuerfeln.
    var init = window.initDungeonRun;
    if (typeof init === 'function') {
      window.initDungeonRun = function () {
        if (S.laufSamen) { saeen(S.laufSamen); S.laufSamen = 0; }
        return init.apply(this, arguments);
      };
    }
  }

  function lebenHalten() {
    try {
      if (typeof playerHealth !== 'undefined' && typeof playerMaxHealth !== 'undefined'
          && playerHealth < Math.ceil(playerMaxHealth * S.boden)) {
        playerHealth = Math.ceil(playerMaxHealth * S.boden);
        window.playerHealth = playerHealth;
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Gegner aus dem Bild halten (ruhige Einstellungen)
  // ---------------------------------------------------------------------
  function gegnerListe() {
    try { return (typeof enemies !== 'undefined' && enemies && enemies.getChildren) ? enemies.getChildren().slice() : []; }
    catch (e) { return []; }
  }

  function ruheHalten() {
    if (!S.ruhe || !laeuft('GameScene')) return;
    gegnerListe().forEach(function (e) {
      if (!e || !e.active) return;
      if (S.ruhe !== 'alle' && e.__trailer) return;
      if (S.ruhe === 'boss' && e.isBoss) return;
      try { e.destroy(); } catch (err) {}
    });
  }

  // ---------------------------------------------------------------------
  // Overlay-Szene: Letterbox, Vorhang fuer Szenenwechsel, Flugblaetter.
  // Liegt immer ganz oben und ueberlebt jeden Szenenwechsel.
  // ---------------------------------------------------------------------
  class TrailerOverlay extends Phaser.Scene {
    constructor() { super({ key: 'TrailerOverlay' }); }
    create() {
      var w = this.scale.width, h = this.scale.height;
      // Hochkant markieren die Balken die Zonen, die Reels/Shorts/TikTok mit
      // ihrer Oberflaeche belegen (oben 12 %, unten 20 %): Platz fuer Texttafeln.
      var oben = Math.round(h * 0.12), unten = Math.round(h * (HOCHKANT ? 0.20 : 0.12));
      this.balken = [
        this.add.rectangle(w / 2, oben / 2, w, oben, 0x000000, 1),
        this.add.rectangle(w / 2, h - unten / 2, w, unten, 0x000000, 1)
      ];
      this.balken.forEach(function (b) { b.setDepth(10).setVisible(S.letterbox); });
      this.vorhang = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 1).setDepth(20).setVisible(false);
      // Flugblaetter der Druckerei fliegen hier, damit sie auch ueber der
      // Druckerei-Ansicht liegen.
      blattTextur(this);
    }
  }

  function overlay() { return szene('TrailerOverlay'); }

  // ---------------------------------------------------------------------
  // Hinweise AUSSERHALB des Canvas (DOM): Tastenhilfe, Aufnahmepunkt,
  // kurze Meldungen. Was im Canvas steht, landet in der Aufnahme.
  // ---------------------------------------------------------------------
  var HILFE_TEXT = 'TRAILER-MODUS — 0-9 Einstellung · R Aufnahme · Z Zeitlupe · '
    + 'L Letterbox · H HUD · M Ton';

  function domElement(stil, text) {
    try {
      var d = document.createElement('div');
      Object.keys(stil).forEach(function (k) { d.style[k] = stil[k]; });
      if (text) d.textContent = text;
      document.body.appendChild(d);
      return d;
    } catch (e) { return null; }
  }

  function domWeg(d) {
    try { if (d && d.parentNode) d.parentNode.removeChild(d); } catch (e) {}
  }

  var HINWEIS_STIL = {
    position: 'fixed', left: '50%', bottom: '8px', transform: 'translateX(-50%)',
    zIndex: '10000', padding: '6px 14px', background: 'rgba(13,10,18,0.85)',
    color: '#e8c98a', font: '15px serif', border: '1px solid #8a6a32',
    borderRadius: '4px', pointerEvents: 'none'
  };

  var _hilfe = null;
  function hilfeZeigen() {
    _hilfe = domElement(HINWEIS_STIL, HILFE_TEXT);
    setTimeout(hilfeWeg, HILFE_MS);
  }

  function hilfeWeg() { domWeg(_hilfe); _hilfe = null; }

  /** Eine kurze Meldung (DOM, 3 s) — statt eines Fehlers. */
  function meldung(text) {
    try { console.warn('[Trailer] ' + text); } catch (e) {}
    var d = domElement(HINWEIS_STIL, text);
    setTimeout(function () { domWeg(d); }, HILFE_MS);
    TM.letzteMeldung = text;
  }

  // Der Mauszeiger gehoert nicht ins Bild.
  function zeigerAus() {
    try {
      var st = document.createElement('style');
      st.textContent = 'canvas { cursor: none !important; }';
      (document.head || document.body).appendChild(st);
    } catch (e) {}
  }

  function vorhang(an) {
    var o = overlay();
    if (o && o.vorhang) o.vorhang.setVisible(!!an);
  }

  function letterboxSetzen(an) {
    S.letterbox = !!an;
    var o = overlay();
    if (o && o.balken) o.balken.forEach(function (b) { b.setVisible(S.letterbox); });
  }

  // Ein Flugblatt: Pergament mit Tintenzeilen, prozedural (keine Datei noetig).
  function blattTextur(sc) {
    if (sc.textures.exists('trailer_blatt')) return;
    var g = sc.make.graphics({ add: false });
    g.fillStyle(0xe8d9b0, 1).fillRect(0, 0, 12, 16);
    g.fillStyle(0xc9b483, 1).fillRect(0, 13, 12, 3);
    g.fillStyle(0x3a2a1a, 1);
    [3, 6, 9].forEach(function (y) { g.fillRect(2, y, 8, 1); });
    g.generateTexture('trailer_blatt', 12, 16);
    g.destroy();
  }

  // ---------------------------------------------------------------------
  // Titel-Szene (Einstellung 9): Schwarz, Laterne, Nebel reisst auf,
  // FOGREACH in Messing. Bilder und Glanz-Animation vom Startbildschirm.
  // ---------------------------------------------------------------------
  class TrailerTitel extends Phaser.Scene {
    constructor() { super({ key: 'TrailerTitel' }); }
    create() {
      var w = this.scale.width, h = this.scale.height, cx = w / 2;
      var ADD = Phaser.BlendModes.ADD;
      this.cameras.main.setBackgroundColor('#000000');
      var hat = this.textures.exists.bind(this.textures);

      // Die Laterne mit ihrem Schein, zunaechst dunkel.
      var ly = h / 2 + 120;
      this.schein = hat('start_schein')
        ? this.add.image(cx, ly - 13 * 3, 'start_schein').setBlendMode(ADD).setScale(0.2).setAlpha(0).setDepth(2)
        : null;
      this.laterne = hat('start_laterne')
        ? this.add.sprite(cx, ly, 'start_laterne', 0).setOrigin(19.5 / 32, 55 / 64).setScale(3).setAlpha(0).setDepth(3)
        : null;

      // Nebel: zwei Haelften, die die Mitte verdecken und dann auseinanderreissen.
      this.nebel = [];
      if (hat('start_nebel_a')) {
        var self = this;
        [[-1, 0x9aa3b5], [1, 0x8a93a5]].forEach(function (s) {
          var ts = self.add.tileSprite(cx, h / 2, w / 2 + 40, h / 2, 'start_nebel_a')
            .setOrigin(s[0] < 0 ? 1 : 0, 0.5).setScale(2).setAlpha(0.95).setTint(s[1]).setDepth(5);
          ts.x = cx - s[0] * 24;   // die Haelften ueberlappen: keine Naht
          ts.__seite = s[0];
          self.nebel.push(ts);
        });
      }

      // Der Schriftzug, wie auf dem Startbildschirm.
      if (hat('start_titel') && !this.anims.exists('start_titel_glanz')) {
        this.anims.create({
          key: 'start_titel_glanz',
          frames: this.anims.generateFrameNumbers('start_titel', { start: 1, end: 11 })
            .concat([{ key: 'start_titel', frame: 0 }]),
          frameRate: 20, repeat: -1, repeatDelay: 3800
        });
      }
      var ty = h / 2 - 60;
      // Der Schriftzug (199 px breit) in ganzen Pixeln: quer dreifach,
      // hochkant so gross, wie er mit Rand ins schmale Bild passt.
      var ts = Math.max(1, Math.min(3, Math.floor((w - 40) / 199)));
      this.titelSchein = hat('start_schein')
        ? this.add.image(cx, ty, 'start_schein').setScale(10 * ts / 3, 2.4).setAlpha(0).setBlendMode(ADD).setDepth(7)
        : null;
      this.titel = hat('start_titel')
        ? this.add.sprite(cx, ty, 'start_titel', 0).setScale(ts).setAlpha(0).setDepth(8)
        : null;

      var self2 = this;
      this.events.on('update', function (zeit, dt) {
        self2.nebel.forEach(function (n) { n.tilePositionX += n.__seite * 6 * dt / 1000; });
      });
    }

    /** Der Ablauf; vom Trailer-Plan gerufen, damit er mit der Einstellung startet. */
    // Knapp: die Laterne gleich, der Nebel reisst ab 0,4 s, der Schriftzug
    // steht nach ~1,3 s — danach traegt das Standbild die Tafel/den Ausklang.
    abspielen() {
      var tw = this.tweens;
      var self = this;
      if (this.laterne) tw.add({ targets: this.laterne, alpha: 1, duration: 400, ease: 'Quad.easeOut' });
      if (this.schein) {
        tw.add({ targets: this.schein, alpha: 0.75, scale: 2.6, duration: 600, ease: 'Quad.easeOut',
          onComplete: function () {
            tw.add({ targets: self.schein, alpha: 0.55, scale: 2.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          } });
      }
      this.nebel.forEach(function (n) {
        tw.add({ targets: n, x: n.x + n.__seite * (self.scale.width * 0.7), alpha: 0, duration: 900, delay: 400, ease: 'Cubic.easeIn' });
      });
      if (this.titelSchein) tw.add({ targets: this.titelSchein, alpha: 0.3, duration: 600, delay: 700 });
      if (this.titel) {
        tw.add({ targets: this.titel, alpha: 1, duration: 600, delay: 700, ease: 'Quad.easeOut',
          onStart: function () { if (self.titel.anims) self.titel.play('start_titel_glanz'); },
          onComplete: function () { moment('titel'); } });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Szenenwechsel ueber die vorhandenen Wege
  // ---------------------------------------------------------------------
  function nachCreate(key, fn) {
    var sc = szene(key);
    if (!sc) return;
    var lauf = S.lauf;
    sc.sys.events.once('create', function () { if (lauf === S.lauf) fn(sc); });
  }

  function overlaysSchliessen() {
    ['PrintingHouseScene', 'SkillTreeScene', 'SettingsScene', 'CraftingScene'].forEach(function (k) {
      try { if (laeuft(k)) szene(k).scene.stop(); } catch (e) {}
    });
  }

  function aufraeumen() {
    S.ruhe = null;
    S.hudZwang = false;
    S.boden = 1;
    S.verwundbar = false;
    window.lastRunSummary = null;
    // Eine laufende Boss-Zwischenszene beenden, statt sie auf der naechsten
    // Szene weiterlaufen zu lassen.
    try {
      var gsz = szene('GameScene');
      var z = gsz && gsz.__bossZwischenszene;
      if (z && typeof z.ueberspringen === 'function') z.ueberspringen();
    } catch (e) {}
    // Wer mitten im Boss-Auftritt umschaltet, liesse die Spieluhr angehalten
    // zurueck — dann stuenden in jeder folgenden Einstellung die Abklingzeiten.
    try {
      if (window.__GAME_PAUSE && window.__GAME_PAUSE.since != null && typeof window.resumeGameClock === 'function') {
        window.resumeGameClock();
      }
    } catch (e) {}
  }

  /** In einen frischen Hub. fertig(hub) laeuft, sobald er steht. */
  function zumHub(samen, fertig) {
    overlaysSchliessen();
    nachCreate('HubSceneV2', fertig);
    if (laeuft('GameScene')) {
      // Der regulaere Rueckweg — ohne Blende, der Vorhang deckt.
      saeen(samen);
      window.leaveDungeonForHub(szene('GameScene'), { reason: 'portal', skipFade: true });
      window.lastRunSummary = null;
    } else if (laeuft('TrailerTitel')) {
      saeen(samen);
      szene('TrailerTitel').scene.start('HubSceneV2');
    } else if (laeuft('HubSceneV2')) {
      saeen(samen);
      szene('HubSceneV2').scene.restart();
    }
  }

  /** Vom Hub aus in Tiefe 1 — wie der Debug-Abstieg (?dungeon=1), ohne Speichern. */
  function abstieg(hub, samen, fertig) {
    window.SELECTED_WAVE_OVERRIDE = 1;
    window.DUNGEON_DEPTH = 1;
    window.NEXT_DUNGEON_DEPTH = 2;
    if (!window.DIFFICULTY_MULTIPLIER) {
      window.DIFFICULTY_MULTIPLIER = (typeof window.getDifficultyMultiplier === 'function')
        ? (window.getDifficultyMultiplier() || 1) : 1;
    }
    // Die Faehigkeiten der Montage VOR dem Abstieg lernen: GameScene.preload
    // laedt die Wirkbilder nur fuer gelernte Faehigkeiten. Erst im Dungeon
    // gelernt, fehlten sie bei den ersten Schlaegen — die Montage zeigte die
    // alten Linien.
    lernen(['whirlwind', 'charge', 'hammer']);
    nachCreate('GameScene', function (gs) {
      // Der erste Raum baut sich noch ein paar Bilder lang fertig (der
      // Vorhang deckt es).
      plan(250, function () { fertig(gs); });
    });
    // Jeder Lauf legt seine Zufallsraeume in den Vorlagen ab; der naechste
    // wuerfelt dann aus einem groesseren Topf. Fuer gleiche Bilder weg damit.
    var RT = window.RoomTemplates && window.RoomTemplates.TEMPLATES;
    if (RT) Object.keys(RT).forEach(function (k) { if (/^(Cave|Procedural)_/.test(k)) delete RT[k]; });
    // Gesaet wird erst unmittelbar vor dem Auswuerfeln des Laufs (Huelle um
    // initDungeonRun oben): was davor liegt — Nachladen, beim ersten Mal
    // erzeugte Texturen — verbraucht je nach Herkunft verschieden viele Wuerfe.
    S.laufSamen = samen;
    saeen(samen);
    hub.scene.start('GameScene');
  }

  function zumDungeon(samen, fertig) {
    zumHub(samen, function (hub) { abstieg(hub, samen, fertig); });
  }

  function zumTitel(samen, fertig) {
    overlaysSchliessen();
    var von = hauptszene();
    nachCreate('TrailerTitel', fertig);
    saeen(samen);
    if (von) von.scene.start('TrailerTitel');
    else spiel().scene.start('TrailerTitel');
  }

  // ---------------------------------------------------------------------
  // Werkzeuge fuer die Einstellungen
  // ---------------------------------------------------------------------
  function rathausTuer(hub) {
    var r = (hub._hubPhaseRefs && hub._hubPhaseRefs.rathausEntrance) || { x: 600, y: 131, w: 80, h: 109 };
    return { x: r.x + r.w / 2, y: r.y + r.h };
  }

  function eingang(hub, id) {
    var z = (hub.entranceGroup && hub.entranceGroup.getChildren() || []).filter(function (e) {
      return e.getData && e.getData('id') === id;
    })[0];
    return z ? { x: z.x, y: z.y } : null;
  }

  function npc(hub, id) {
    return (hub.npcs || []).filter(function (n) { return n.data && n.data.id === id; })[0] || null;
  }

  function hubSpielerStellen(hub, x, y) {
    var p = hub.player;
    if (!p) return;
    p.setPosition(x, y);
    if (p.body && p.body.reset) p.body.reset(x, y);
  }

  /** Kamera vom Spieler loesen und auf einen Punkt setzen. */
  function kameraAuf(sc, x, y, zoom) {
    var cam = sc.cameras.main;
    cam.stopFollow();
    cam.setZoom(zoom || 1);
    cam.centerOn(x, y);
    return cam;
  }

  /** Hochkant: Kamera nah an die Figuren (quer bleibt alles bei Zoom 1). */
  function nah(sc, zoom) {
    if (HOCHKANT && sc && sc.cameras && sc.cameras.main) sc.cameras.main.setZoom(zoom || NAH);
  }

  // Die Kampf-Choreografie laeuft quer nach rechts, hochkant nach unten — auf
  // die Kamera zu, so bleibt sie im schmalen Bild und man sieht Gesichter.
  var RX = HOCHKANT ? 0 : 1, RY = HOCHKANT ? 1 : 0;

  /** Punkt `d` in Laufrichtung vor p, `seit` quer dazu versetzt. */
  function vor(p, d, seit) {
    return HOCHKANT ? { x: p.x + seit, y: p.y + d } : { x: p.x + d, y: p.y + seit };
  }

  // Nebelschleier ueber dem Hub, der sich lichtet (Einstellung 1).
  function nebelSchleier(sc, dauer) {
    if (!sc.textures.exists('start_nebel_a')) return;
    var w = sc.scale.width, h = sc.scale.height;
    var lagen = [[0.95, 0, 4], [0.85, 160, -7]].map(function (l) {
      var ts = sc.add.tileSprite(0, 0, w / 2, h / 2, 'start_nebel_a')
        .setOrigin(0).setScale(2).setScrollFactor(0).setDepth(960).setAlpha(l[0]).setTint(0xb8c0d0);
      ts.tilePositionX = l[1];
      ts.__tempo = l[2];
      ts.__trailerBild = true;
      return ts;
    });
    var ziehen = function (zeit, dt) { lagen.forEach(function (t) { t.tilePositionX += t.__tempo * dt / 1000; }); };
    sc.events.on('update', ziehen);
    sc.events.once('shutdown', function () { sc.events.off('update', ziehen); });
    sc.tweens.add({ targets: lagen, alpha: 0.12, duration: dauer, ease: 'Sine.easeInOut' });
  }

  function lernen(ids) {
    var A = window.AbilitySystem;
    if (!A) return;
    ids.forEach(function (id, i) {
      try { A.learnAbility(id, { silent: true }); } catch (e) {}
      try { A.setSlot('slot' + (i + 1), id); } catch (e) {}
      try { A.resetCooldown(id); } catch (e) {}
    });
  }

  /** Faehigkeit in Blickrichtung (dx, dy) ausloesen — derselbe Weg wie Q/W/E/R. */
  function mitBlick(dx, dy, fn) {
    var IS = window.InputScheme;
    var alt = IS && IS.getAimDirection;
    try { if (typeof lastMoveDirection !== 'undefined' && lastMoveDirection.set) lastMoveDirection.set(dx, dy); } catch (e) {}
    if (IS) IS.getAimDirection = function () { return { x: dx, y: dy, source: 'trailer' }; };
    try { return fn(); } finally { if (IS) IS.getAimDirection = alt; }
  }

  function faehigkeit(gs, slot, dx, dy) {
    var A = window.AbilitySystem;
    if (!A) return false;
    var id = A.getActiveLoadout && A.getActiveLoadout()[slot];
    if (id) { try { A.resetCooldown(id); } catch (e) {} }
    return mitBlick(dx, dy, function () { return A.tryActivate(slot, gs); });
  }

  function loslassen(gs, slot, dx, dy) {
    var A = window.AbilitySystem;
    if (!A) return false;
    return mitBlick(dx, dy, function () { return A.tryRelease(slot, gs); });
  }

  function gegner(gs, x, y, typ) {
    if (typeof spawnEnemy !== 'function') return null;
    var e = null;
    try { e = spawnEnemy.call(gs, x, y, typ, { ohneSonder: true, ohneElite: true }); } catch (err) { e = null; }
    if (!e) { console.warn('[Trailer] Gegner ' + typ + ' bei ' + Math.round(x) + ',' + Math.round(y) + ' nicht gesetzt'); return null; }
    e.setPosition(x, y);
    if (e.body && e.body.reset) e.body.reset(x, y);
    e.__trailer = true;
    return e;
  }

  function trailerGegnerWeg() {
    gegnerListe().forEach(function (e) { if (e && e.__trailer && e.active) { try { e.destroy(); } catch (err) {} } });
  }

  // --- Kampf mit HUD (Einstellung 5) --------------------------------------
  /** Ein Treffer am Spieler ueber den echten Weg (Blut, Aufblitzen, Ton), `anteil` vom Leben. */
  function treffer(gs, anteil) {
    if (typeof applyPlayerDamage !== 'function' || typeof playerMaxHealth === 'undefined') return;
    var p = spielerPos(), naechster = null, best = Infinity;
    gegnerListe().forEach(function (e) {
      if (!e || !e.active || !e.__trailer || !p) return;
      var d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; naechster = e; }
    });
    // Die Ruestung (etwa aus dem Inventar-Bild) zieht ab — vorher ausgleichen.
    var r = (typeof playerArmor !== 'undefined' && playerArmor) ? Math.min(playerArmor, window.RUESTUNG_DECKEL || 0.8) : 0;
    try { applyPlayerDamage(Math.round(playerMaxHealth * anteil / Math.max(0.2, 1 - r)), gs, naechster); } catch (e) {}
  }

  /** Ein Heiltrank im Inventar, damit F etwas zu trinken hat. */
  function trankBereit() {
    var inv = window.inventory, G = window.InventoryGrid;
    if (!Array.isArray(inv) || inv.some(function (i) { return i && i.type === 'potion'; })) return;
    try { if (G && typeof window.makePotionDrop === 'function') G.einfuegen(inv, window.makePotionDrop(1)); } catch (e) {}
    try { if (typeof window._refreshInventoryHUD === 'function') window._refreshInventoryHUD(); } catch (e) {}
  }

  /** Trank wie Taste F; steht er noch in der Abklingzeit, heilt es ohne ihn. */
  // Der Trank heilt im Spiel ueber 3 s — fuer den Schnitt zu langsam. Die
  // Leiste steigt darum in 0,5 s um gut die Haelfte; der Trank selbst (Zahl,
  // Abklingzeit in der Leiste) laeuft ueber Taste F wie im Spiel.
  function trinken() {
    var L = window.LootSystem;
    try { if (L && L.onPotionKey) L.onPotionKey(); } catch (e) {}
    for (var i = 1; i <= 5; i++) {
      plan(i * 100, function () {
        if (typeof addPlayerHealth === 'function' && typeof playerMaxHealth !== 'undefined') {
          addPlayerHealth(Math.round(playerMaxHealth * 0.11));
        }
      });
    }
  }

  /** Erfahrung ueber das echte addXP: `anteil` der Leiste dieser Stufe. */
  function xpAnteil(anteil) {
    if (typeof echtesXP !== 'function' || typeof neededXP === 'undefined' || typeof playerXP === 'undefined') return;
    var n = Math.max(1, Math.round(neededXP * anteil));
    // Nie bis zum Aufstieg — der gehoert dem Hoehepunkt.
    n = Math.min(n, neededXP - playerXP - 1);
    if (n > 0) { try { echtesXP(n); } catch (e) {} }
  }

  function stufenAufstieg() {
    if (typeof echtesXP !== 'function' || typeof neededXP === 'undefined' || typeof playerXP === 'undefined') return;
    // Ohne Talentpunkt: der Talentbaum gleicht beim Punkt die gelernten
    // Faehigkeiten ab — die Leiste stuende mitten im Bild leer.
    var ST = window.SkillTree, punkt = ST && ST.grantSkillPoint;
    if (punkt) ST.grantSkillPoint = function () { return 0; };
    try { echtesXP(Math.max(1, neededXP - playerXP)); } catch (e) {}
    finally { if (punkt) ST.grantSkillPoint = punkt; }
  }

  function spielerPos() {
    try { if (typeof player !== 'undefined' && player) return { x: player.x, y: player.y }; } catch (e) {}
    return null;
  }

  function stellen(x, y) {
    if (typeof player === 'undefined' || !player) return;
    player.setPosition(x, y);
    if (player.body && player.body.reset) player.body.reset(x, y);
  }

  /**
   * Hochkant: den Spieler nahe der Raummitte auf freien Boden stellen. Er
   * kommt an der Tuer herein, am Raumrand — im schmalen Bild laege der Kampf
   * dann am Rand des Sichtkreises, halb im Dunkel. `vorne`: so viel freie
   * Strecke braucht die Choreografie in Laufrichtung (nach unten).
   */
  function zurRaummitte(gs, vorne) {
    var r = gs.currentRoom, p0 = spielerPos();
    if (!HOCHKANT || !r || !r.origin || !p0) return;
    var frei = function (x, y) { return typeof gs.isPointAccessible !== 'function' || gs.isPointAccessible(x, y); };
    var hind = hindernisse();
    var cx = r.origin.x + r.w / 2, cy = r.origin.y + r.h / 2 - vorne / 2;
    var bester = null;
    for (var dy = -192; dy <= 192; dy += 16) {
      for (var dx = -192; dx <= 192; dx += 16) {
        var x = cx + dx, y = cy + dy, ok = true;
        for (var a = 0; a < 8 && ok; a++) ok = frei(x + Math.cos(a * Math.PI / 4) * 70, y + Math.sin(a * Math.PI / 4) * 70);
        for (var d = 0; d <= vorne && ok; d += 20) ok = frei(x - 30, y + d) && frei(x + 30, y + d);
        if (!ok) continue;
        var s = { x: x, y: y }, e = { x: x, y: y + vorne };
        if (hind.some(function (o) { return abstandZurStrecke(o, s, e) < 48; })) continue;
        var wert = Math.hypot(dx, dy);
        if (!bester || wert < bester.wert) bester = { wert: wert, x: x, y: y };
      }
    }
    if (!bester) return;
    stellen(bester.x, bester.y);
    // Mit der Kamera zusammen: sie soll nicht erst hinterherfahren.
    gs.cameras.main.centerOn(bester.x, bester.y + vorne / 3);
  }

  // Was im Bossbild stoert: Treppen (Durchgaenge), Tueren — und zwischen den
  // beiden Kaempfern auch Hindernisse wie Saeulen und Kisten.
  function bildStoerer(gs) {
    var out = [];
    ((gs.children && gs.children.list) || []).forEach(function (o) {
      if (o && o.visible && o.texture && /^(stair|tor_neu|door)/i.test(o.texture.key)) out.push({ x: o.x, y: o.y });
    });
    (gs._doors || []).forEach(function (d) { if (d && d.active !== false) out.push({ x: d.x, y: d.y }); });
    return out;
  }

  function hindernisse() {
    try {
      return (typeof obstacles !== 'undefined' && obstacles && obstacles.getChildren)
        ? obstacles.getChildren().filter(function (o) { return o && o.active; }) : [];
    } catch (e) { return []; }
  }

  function abstandZurStrecke(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /**
   * Ein Platz fuer Spieler und Kettenmeister (Einstellung 7): beide auf
   * begehbarem Boden, nichts zwischen ihnen, keine Treppe oder Tuer nah am
   * Kampf — und moeglichst keine im Bild. Ohne das stand im Pfeilerhaus eine
   * Treppe genau zwischen beiden ("eine Tuer im Weg").
   */
  function bossPlatz(gs) {
    var wb = gs.physics.world.bounds;
    var frei = function (x, y) { return typeof gs.isPointAccessible !== 'function' || gs.isPointAccessible(x, y); };
    var stoerer = bildStoerer(gs), hind = hindernisse();
    // Der Ausschnitt, den die Kamera mit ihrem Zoom zeigt.
    var zoom = gs.cameras.main.zoom || 1;
    var halbB = gs.cameras.main.width / 2 / zoom, halbH = gs.cameras.main.height / 2 / zoom;
    // Quer steht der Boss rechts neben dem Spieler, hochkant ueber ihm.
    var ABSTAND = 170, RAND = 160, bester = null;
    var ox = HOCHKANT ? 10 : ABSTAND, oy = HOCHKANT ? -ABSTAND : -10;
    for (var y = wb.y + RAND + (HOCHKANT ? ABSTAND : 0); y <= wb.bottom - RAND; y += 32) {
      for (var x = wb.x + RAND; x <= wb.right - RAND - Math.max(ox, 0); x += 32) {
        var s = { x: x, y: y }, b = { x: x + ox, y: y + oy };
        var ok = true;
        for (var i = 0; i <= 8 && ok; i++) {
          var px = x + ox * i / 8, py = y + oy * i / 8;
          ok = HOCHKANT ? (frei(px, py) && frei(px - 40, py) && frei(px + 40, py))
            : (frei(px, py) && frei(px, py - 40) && frei(px, py + 40));
        }
        if (!ok) continue;
        var nah = Infinity;
        stoerer.forEach(function (st) { nah = Math.min(nah, abstandZurStrecke(st, s, b)); });
        if (nah < 180) continue;
        if (hind.some(function (o) { return abstandZurStrecke(o, s, b) < 56; })) continue;
        var mx = (s.x + b.x) / 2;
        // Die Kamera steht mal auf dem Boss (Zwischenszene), mal auf dem
        // Spieler — beide Ausschnitte, so wie die Weltgrenze sie einklemmt.
        var bilder = [s, b].map(function (q) {
          var x0 = Math.max(wb.x, Math.min(q.x - halbB, wb.right - 2 * halbB));
          var y0 = Math.max(wb.y, Math.min(q.y + 30 - halbH, wb.bottom - 2 * halbH));
          return { x0: x0 - 24, y0: y0 - 24, x1: x0 + 2 * halbB + 24, y1: y0 + 2 * halbH + 24 };
        });
        var imBild = stoerer.filter(function (st) {
          return bilder.some(function (r) { return st.x > r.x0 && st.x < r.x1 && st.y > r.y0 && st.y < r.y1; });
        }).length;
        // Moeglichst mittig (der Kriegsnebel laesst am Rand wenig Raum), lieber
        // ohne Treppe im Ausschnitt und mit Luft zu ihr; ausgeblendet wird sie ohnehin.
        var wert = Math.hypot(mx - wb.centerX, y - wb.centerY) + imBild * 150 - Math.min(nah, 300) * 0.3;
        if (!bester || wert < bester.wert) bester = { wert: wert, spieler: s, boss: b, imBild: imBild, nah: nah };
      }
    }
    if (!bester) console.warn('[Trailer] kein freier Platz fuer den Bosskampf');
    TM._bossPlatz = bester;
    return bester;
  }

  function gehen(richtung, an) {
    try { if (typeof cursors !== 'undefined' && cursors && cursors[richtung]) cursors[richtung].isDown = !!an; } catch (e) {}
    var sc = hauptszene();
    if (sc && sc.cursors && sc.cursors[richtung]) sc.cursors[richtung].isDown = !!an;
  }

  function allesLoslassen() { ['left', 'right', 'up', 'down'].forEach(function (r) { gehen(r, false); }); }

  // Flugblaetter fliegen aus einem Bildschirmpunkt (Overlay, ueber allem).
  function flugblaetter(x, y, menge) {
    var o = overlay();
    if (!o) return;
    blattTextur(o);
    var em = o.add.particles(x, y, 'trailer_blatt', {
      speed: { min: 140, max: 320 }, angle: { min: 200, max: 340 },
      gravityY: 260, rotate: { start: 0, end: 540 }, scale: { min: 1.4, max: 2.4 },
      lifespan: 2200, quantity: menge || 14, emitting: false
    }).setDepth(5);
    em.explode(menge || 14);
    o.time.delayedCall(2600, function () { try { em.destroy(); } catch (e) {} });
  }

  function bildschirmPunkt(sc, wx, wy) {
    var v = sc.cameras.main.worldView;
    var z = sc.cameras.main.zoom || 1;
    return { x: (wx - v.x) * z, y: (wy - v.y) * z };
  }

  // ---------------------------------------------------------------------
  // Beute fuer Einstellung 0
  // ---------------------------------------------------------------------
  var BEUTE_RASTER = [
    ['WPN_GLUTAXT', 3], ['WPN_NEBELBOGEN', 2], ['BD_SCHATTENKUTTE', 3], ['HD_SCHLANGENMASKE', 2],
    ['BT_WINDLAEUFER', 2], ['WPN_RICHTSCHWERT', 2], ['WPN_KETTENMORGENSTERN', 1], ['OF_TALGLICHT', 2],
    ['HD_KETTENHAUBE', 1], ['WPN_SCHATTENDOLCH', 1], ['OF_PAVESE', 0], ['BD_LEDERHARNISCH', 0]
  ];
  // Einhaendige Waffe: ein Zweihaender liesse die Nebenhand leer.
  var BEUTE_ANGELEGT = {
    weapon: ['WPN_EISENKLINGE', 3], offhand: ['OF_BANNLATERNE', 2], head: ['HD_BRONZEHELM', 2],
    body: ['BD_PLATTENPANZER', 2], boots: ['BT_STAHLSOHLEN', 1]
  };

  /** Inventar und Ausruestung leeren und mit einer vorzeigbaren Auswahl fuellen. */
  function beuteFuellen() {
    var L = window.LootSystem, G = window.InventoryGrid;
    var inv = window.inventory, eq = window.equipment;
    if (!L || !G || !Array.isArray(inv) || !eq) return;
    for (var i = 0; i < inv.length; i++) inv[i] = null;
    S.prunkstueck = null;
    Object.keys(BEUTE_ANGELEGT).forEach(function (slot) {
      try { eq[slot] = L.rollItem(BEUTE_ANGELEGT[slot][0], 24, BEUTE_ANGELEGT[slot][1], 0, { ohneDeckel: true }); } catch (e) {}
    });
    try { eq.amulet = L.rollAmulet(18, Math.random); } catch (e) {}
    BEUTE_RASTER.forEach(function (b) {
      try {
        var it = L.rollItem(b[0], 24, b[1], 0, { ohneDeckel: true });
        if (G.einfuegen(inv, it) >= 0 && b[1] === 3 && !S.prunkstueck) S.prunkstueck = it;
      } catch (e) {}
    });
    try { G.einfuegen(inv, L.rollAmulet(12, Math.random)); } catch (e) {}
    try { if (typeof recalcDerived === 'function') recalcDerived(); } catch (e) {}
  }

  /** Den Tooltip eines Stuecks im Raster zeigen, als laege der Zeiger darauf. */
  function tooltipZeigen(item) {
    if (!item || typeof invUI === 'undefined' || !invUI || !invUI.zellen) return false;
    var z = invUI.zellen.filter(function (zz) { return zz.c === item.gridX && zz.r === item.gridY; })[0];
    if (!z || !z.bg) return false;
    var b = z.bg.getBounds();
    z.bg.emit('pointerover', { x: b.centerX, y: b.centerY, worldX: b.centerX, worldY: b.centerY });
    // Nur das Stueck selbst: der Vergleich mit dem angelegten (zweiter Kasten)
    // deckte im Bild das ganze Raster zu.
    try { if (typeof tooltip !== 'undefined' && tooltip && tooltip.compareBox) tooltip.compareBox.setVisible(false); } catch (e) {}
    return true;
  }

  /**
   * Hochkant: der Tooltip gross und mittig unter dem Raster statt am Zeiger —
   * dort ist Platz, und auf dem Telefon soll man ihn lesen koennen.
   */
  function tooltipUnterRaster() {
    if (typeof tooltip === 'undefined' || !tooltip || typeof invUI === 'undefined' || !invUI || !invUI.panel) return;
    var sc = tooltip.scene;
    var w = sc.scale.width, h = sc.scale.height;
    var unten = invUI.panel.getBounds().bottom;
    var tw = tooltip._width || 200, th = tooltip._height || 120;
    // Bis knapp ueber die untere Schutzzone (20 %) der Plattformen.
    var m = Math.min(1.6, (w - 24) / tw, (h * 0.8 - 12 - (unten + 14)) / th);
    tooltip.setScale(m);
    tooltip.setPosition(Math.round((w - tw * m) / 2), Math.round(unten + 14));
  }

  // ---------------------------------------------------------------------
  // Einstellung 8: die Presse
  // ---------------------------------------------------------------------
  /** Ohne Bild der Presse: die Fassade der Druckerei mit Kamerastoessen. */
  function presseFassade(hub) {
    var e = eingang(hub, 'druckerei_entrance') || { x: 1069, y: 534 };
    var thom = npc(hub, 'thom');
    if (hub.player) hub.player.setVisible(false);
    var cam = kameraAuf(hub, e.x, e.y - 60, 1.3);
    cam.fadeIn(150, 0, 0, 0);
    if (thom) cam.pan((e.x + thom.sprite.x) / 2, e.y - 60, 1500, 'Quad.easeOut');
    [200, 550, 900].forEach(function (ab, i) {
      plan(ab, function () {
        if (!i) moment('presse');
        cam.shake(140, 0.008);
        var s = bildschirmPunkt(hub, e.x, e.y - 10);
        flugblaetter(s.x, s.y, 10 + i * 4);
      });
    });
    plan(1300, function () {
      if (typeof window.openPrintingHouseScene === 'function') window.openPrintingHouseScene(hub);
    });
    plan(1600, function () {
      var o = overlay();
      if (o) flugblaetter(o.scale.width / 2, o.scale.height * 0.62, 26);
    });
  }

  /** #198: die stampfende Presse gross im Bild, Flugblaetter bei jedem Stoss. */
  function presseImBild(hub) {
    var cam = hub.cameras.main, b = cam.width, h = cam.height;
    if (hub.player) hub.player.setVisible(false);
    behalten(hub, function () {
      hub.add.rectangle(b / 2, h / 2, b, h, 0x07060a, 1).setScrollFactor(0).setDepth(2499).setName('trailerPresseGrund');
      // Ganze Pixel, und hochkant nicht breiter als das Bild (128 px je Stufe).
      var skala = HOCHKANT ? Math.floor(b / 128) : Math.max(3, Math.floor(h / 170));
      // Schneller als in der Druckerei: drei Stoesse in gut 2 s.
      window.Druckerpresse.stampfen(hub, b / 2, h / 2 + 10, {
        skala: skala, stoesse: 3, tiefe: 2500, fest: true, blaetter: HOCHKANT ? 20 : 14, tempo: 1.7,
        beiStoss: function () { moment('presse'); }
      });
    });
    cam.fadeIn(150, 0, 0, 0);
  }

  // ---------------------------------------------------------------------
  // Die Einstellungen (docs/trailer-drehbuch.md)
  // ---------------------------------------------------------------------
  var EINSTELLUNGEN = {
    // 0 — Inventar: die Beute nach der Montage. Raster und Papierpuppe voll
    // mit Stuecken aller Seltenheiten, dann der Tooltip eines legendaeren.
    0: { name: 'Inventar', kurz: 'inventar', ziel: 'dungeon', samen: 1410, aufbau: function (gs) {
      S.ruhe = 'alle';
      beuteFuellen();
      nah(gs);
      zurRaummitte(gs, 0);
      gs.cameras.main.fadeIn(150, 0, 0, 0);
      plan(150, function () { if (typeof openInventory === 'function') openInventory(); });
      plan(750, function () {
        if (tooltipZeigen(S.prunkstueck) && HOCHKANT) tooltipUnterRaster();
        moment('tooltip');
      });
    } },

    // 1 — Nebelstadt: Schwarz, Nebel lichtet sich, Fahrt ueber den Platz zum Rathaus.
    1: { name: 'Nebelstadt', kurz: 'nebelstadt', ziel: 'hub', aufbau: function (hub) {
      if (hub.player) hub.player.setVisible(false);
      var t = rathausTuer(hub);
      // Hochkant: ein Schwenk von unten (Brunnen) hinauf zum Rathaus.
      // Die Fahrt setzt sofort ein (easeOut) und steht nach 2,2 s am Rathaus.
      var cam = HOCHKANT ? kameraAuf(hub, t.x, t.y + 420, 1.3) : kameraAuf(hub, t.x, 560, 1.12);
      cam.fadeIn(500, 0, 0, 0);
      nebelSchleier(hub, 1600);
      cam.pan(t.x, HOCHKANT ? t.y - 40 : t.y - 70, 2200, 'Quad.easeOut');
      plan(2200, function () { moment('rathaus'); });
    } },

    // 2 — Der Rat: Aldric vor dem Rathaus, der Messing-Dialog geht auf.
    2: { name: 'Der Rat', kurz: 'rat', ziel: 'hub', aufbau: function (hub) {
      var a = npc(hub, 'aldric');
      var ax = a ? a.sprite.x : 768, ay = a ? a.sprite.y : 205;
      hubSpielerStellen(hub, ax - 40, ay + 46);
      // Aldric im oberen Drittel — darunter geht der Dialog auf. Hochkant
      // nah: Aldric und der Spieler gross, der Dialog darunter.
      var cam = HOCHKANT ? kameraAuf(hub, ax - 34, ay + 84, 2) : kameraAuf(hub, ax - 60, ay + 120, 1);
      cam.fadeIn(200, 0, 0, 0);
      if (HOCHKANT) cam.pan(ax - 20, ay + 74, 1800, 'Quad.easeOut');
      else cam.pan(ax - 30, ay + 104, 1800, 'Quad.easeOut');
      plan(250, function () {
        moment('dialog');
        var name = (window.i18n ? window.i18n.t('hub.npc.aldric.name') : 'Ratsherr Aldric');
        behalten(hub, function () {
          hub._dialogOpen = true;
          hub._showDialoguePages({ id: 'trailer_aldric', name: name }, name,
            [{ text: 'Der Rat hat Arbeit für Dich, Archivschmied.', choices: null }], 'flavor', null, 0);
        });
        // Die Bedienzeile ("ESC: schliessen") gehoert nicht ins Bild.
        var hinweis = window.i18n ? window.i18n.t('hub.dialog.hint.close') : 'ESC';
        var c = hub._dialogContainer;
        ((c && c.list) || []).forEach(function (o) {
          if (o && o.type === 'Text' && String(o.text).indexOf(hinweis) !== -1) o.setVisible(false);
        });
        // Der Dialog ist 540 breit und saesse hochkant in der unteren
        // Schutzzone (20 %): etwas schmaler, ueber die Zone gehoben.
        if (HOCHKANT && c) {
          var h = hub.scale.height;
          c.setScale(0.94);
          var b = c.getBounds();
          c.y += Math.round(h * 0.8 - 16 - b.bottom);
        }
      });
    } },

    // 3 — Abstieg: Rathauskeller-Tuer, Abblende, erster Kellerraum im Nebel.
    3: { name: 'Abstieg', kurz: 'abstieg', ziel: 'hub', aufbau: function (hub) {
      var t = rathausTuer(hub);
      hubSpielerStellen(hub, t.x, t.y + 40);
      var cam = HOCHKANT ? kameraAuf(hub, t.x, t.y + 10, NAH) : kameraAuf(hub, t.x, t.y - 10, 1.25);
      // Er geht sofort los; nach gut 1 s ist er im Keller.
      cam.fadeIn(150, 0, 0, 0);
      plan(150, function () { gehen('up', true); });
      plan(650, function () { cam.fadeOut(350, 0, 0, 0); });
      plan(1000, function () {
        allesLoslassen();
        vorhang(true);
        abstieg(hub, 3003, function (gs) {
          S.ruhe = 'alle';
          vorhang(false);
          nah(gs);
          // Hochkant steht der Spieler im oberen Drittel: er kommt an der
          // Oberkante des Raums herein, darunter liegt der Keller.
          if (HOCHKANT) gs.cameras.main.setFollowOffset(0, -100);
          gs.cameras.main.fadeIn(500, 0, 0, 0);
          moment('keller');
        });
      });
    } },

    // 4 — Kampf-Montage: Wirbelwind, Ansturm, Hammer, eine Kettenwache faellt.
    4: { name: 'Kampf-Montage', kurz: 'kampf', ziel: 'dungeon', samen: 1204, aufbau: function (gs) {
      S.ruhe = 'fremde';
      lernen(['whirlwind', 'charge', 'hammer']);
      var p0 = spielerPos();
      if (!p0) return;
      zurRaummitte(gs, 200);
      var ring = function (r, n, typ) {
        var p = spielerPos();
        for (var i = 0; i < n; i++) {
          var a = (Math.PI * 2 * i) / n;
          gegner(gs, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, typ);
        }
      };
      nah(gs);
      gs.cameras.main.fadeIn(150, 0, 0, 0);
      // Vier Schlaege, je ~0,9 s — Schnitte im Takt.
      // Schlag 1: Wirbelwind in eine Gruppe.
      ring(62, 5, 1);
      plan(200, function () { faehigkeit(gs, 'slot1', RX, RY); moment('wirbel'); });
      // Schlag 2: Ansturm durch eine Reihe.
      plan(1050, function () {
        trailerGegnerWeg();
        var p = spielerPos();
        [70, 120, 170].forEach(function (d, i) { var q = vor(p, d, i % 2 ? 10 : -10); gegner(gs, q.x, q.y, 3); });
      });
      plan(1200, function () { faehigkeit(gs, 'slot2', RX, RY); });
      // Schlag 3: Hammer der Ahnen, kurz aufgeladen (Mindestladung 300 ms).
      plan(1950, function () {
        trailerGegnerWeg();
        var p = spielerPos();
        var a = vor(p, 52, -20), b = vor(p, 58, 22);
        gegner(gs, a.x, a.y, 3);
        gegner(gs, b.x, b.y, 1);
        faehigkeit(gs, 'slot3', RX, RY);
      });
      plan(2350, function () { loslassen(gs, 'slot3', RX, RY); });
      // Schlag 4: eine Kettenwache faellt. Ihr Schild nimmt den ersten Hieb
      // (weisser Blitz), der zweite faellt sie.
      var wache = null;
      var hieb = function () {
        mitBlick(RX, RY, function () {
          if (typeof attack === 'function') { try { attack.call(gs); } catch (e) {} }
        });
      };
      plan(2900, function () {
        trailerGegnerWeg();
        var p = spielerPos();
        var q = vor(p, 40, 0);
        wache = gegner(gs, q.x, q.y, 6);
        if (wache) wache.hp = 1;
      });
      plan(2980, hieb);
      plan(3280, hieb);
      plan(3550, function () {
        moment('wache');
        if (wache && wache.active && wache.hp > 0 && typeof dealDamageToEnemy === 'function') {
          wache.shieldActive = false;
          try { dealDamageToEnemy(gs, wache, 50); } catch (e) {}
          if (wache.hp <= 0 && typeof handleEnemyHit === 'function') { try { handleEnemyHit(gs, wache); } catch (e) {} }
        }
      });
    } },

    // 5 — Kampf mit HUD: Gegner rundum, das HUD im Bild. Treffer lassen die
    // Lebensleiste sinken, ein Trank fuellt sie, Faehigkeiten (Abklingzeiten
    // in der Leiste) raeumen auf, die Erfahrung fuellt sich bis zum
    // Stufenaufstieg. Hochkant steht das HUD versetzt zwischen den Zonen.
    5: { name: 'Kampf mit HUD', kurz: 'kampfhud', ziel: 'dungeon', samen: 1505, aufbau: function (gs) {
      S.ruhe = 'fremde';
      S.hudZwang = true;
      lernen(['whirlwind', 'charge', 'hammer']);
      if (!spielerPos()) return;
      trankBereit();
      // Erst mit etwas Erfahrung: die Leiste steht sichtbar, nicht leer.
      xpAnteil(0.25);
      zurRaummitte(gs, 0);
      // Hochkant etwas weiter als die Montage: oben und unten nimmt das HUD Platz.
      nah(gs, 1.6);
      gs.cameras.main.fadeIn(150, 0, 0, 0);
      // Treffer kommen an, das Leben faellt aber nie unter ein Viertel.
      S.boden = 0.25;
      S.verwundbar = true;
      // Der Kampf laeuft in beiden Formaten waagerecht: hochkant liefe er
      // sonst in die Faehigkeitsleiste hinein (und an den Raumrand, an dem
      // die Kamera stehen bleibt).
      var vorn = function (p, d, seit) { return { x: p.x + d, y: p.y + seit }; };
      var p0 = spielerPos();
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI * 2 * i) / 6 + 0.3;
        gegner(gs, p0.x + Math.cos(a) * 66, p0.y + Math.sin(a) * 66, i % 3 ? 1 : 3);
      }
      plan(100, function () { treffer(gs, 0.22); moment('treffer'); });
      plan(300, function () { faehigkeit(gs, 'slot1', 1, 0); });
      plan(650, function () { treffer(gs, 0.22); });
      plan(850, function () { xpAnteil(0.3); treffer(gs, 0.2); });
      plan(1100, function () { trinken(); moment('trank'); });
      // Eine Reihe fuer den Ansturm.
      plan(1250, function () {
        var p = spielerPos();
        [70, 115, 160].forEach(function (d, i) { var q = vorn(p, d, i % 2 ? 12 : -12); gegner(gs, q.x, q.y, i === 1 ? 3 : 1); });
      });
      plan(1400, function () { faehigkeit(gs, 'slot2', 1, 0); });
      plan(1900, function () {
        xpAnteil(0.3);
        trailerGegnerWeg();
        var p = spielerPos();
        var a = vorn(p, 50, -24), b = vorn(p, 56, 24);
        gegner(gs, a.x, a.y, 3);
        gegner(gs, b.x, b.y, 1);
        faehigkeit(gs, 'slot3', 1, 0);
      });
      plan(2300, function () { loslassen(gs, 'slot3', 1, 0); });
      // Der Rest bis zur naechsten Stufe: goldener Blitz, Leben voll.
      plan(2450, function () { stufenAufstieg(); moment('stufe'); });
      plan(3200, function () { S.verwundbar = false; S.boden = 1; });
    } },

    // 6 — Geheime Sitzung: Magistrat, Klerus, Garde am Tisch, Kerzenlicht.
    6: { name: 'Geheime Sitzung', kurz: 'sitzung', ziel: 'hub', aufbau: function (hub) {
      var SB = window.SitzungsBuehne;
      if (!SB) return;
      var cam = hub.cameras.main;
      cam.fadeIn(300, 0, 0, 0);
      SB.laden(hub, function () {
        behalten(hub, function () { hub.__trailerBuehne = SB.geheim(hub); });
        moment('sitzung');
        var box = hub.__trailerBuehne && hub.__trailerBuehne.box;
        // Die Fahrt heran setzt sofort ein und ist nach 2,2 s am Ziel.
        if (box) {
          // Hochkant liegt die Buehne auf der Kamera ohne Zoom: die Fahrt
          // heran macht ihr Rahmen selbst, um die Tischmitte — nur so weit,
          // dass die beiden aeusseren Figuren ganz im schmalen Bild bleiben.
          var m = box.scale, z = 1.035, fx = box.__mitte.x, fy = box.__mitte.y;
          hub.tweens.add({
            targets: box, scale: m * z, x: fx - (fx - box.x) * z, y: fy - (fy - box.y) * z,
            duration: 2200, ease: 'Quad.easeOut'
          });
          return;
        }
        cam.setZoom(1);
        cam.zoomTo(1.07, 2200, 'Quad.easeOut');
      });
    } },

    // 7 — Boss: die Zwischenszene des Kettenmeisters (Balken, Schwenk,
    // Plakette, Rede) laeuft ohne Eingabe durch, dann ein schwerer Treffer
    // in Zeitlupe, der Bildschirm bebt.
    7: { name: 'Boss', kurz: 'boss', ziel: 'dungeon', samen: 1307, aufbau: function (gs) {
      S.ruhe = 'boss';
      lernen(['whirlwind', 'charge', 'hammer']);
      nah(gs);
      var wb = gs.physics.world.bounds;
      var platz = bossPlatz(gs) || {
        spieler: { x: wb.centerX - 85, y: wb.centerY + 60 }, boss: { x: wb.centerX + 85, y: wb.centerY + 50 }
      };
      var boss = null;
      var BZ = window.BossZwischenszene;
      var erzwungen = (typeof BOSS_DEFINITIONS !== 'undefined') ? BOSS_DEFINITIONS.chainMaster : null;
      var alt = { forced: window.debugForcedBoss, soll: BZ && BZ.soll, between: Phaser.Math.Between };
      // Der Boss erscheint um den Spieler herum, mit zwei Zufallsversaetzen.
      // Darum steht der Spieler kurz auf dem Bossplatz, die Versaetze sind 0,
      // und danach geht er an seinen eigenen Platz: so stehen beide frei.
      stellen(platz.boss.x, platz.boss.y);
      gs.cameras.main.centerOn(platz.spieler.x, platz.spieler.y);
      var versatz = 2;
      Phaser.Math.Between = function (a, b) { return versatz-- > 0 ? 0 : alt.between(a, b); };
      window.debugForcedBoss = function () { return erzwungen; };
      // Die Zwischenszene laeuft beim ersten Kampf; im Trailer jedes Mal —
      // und zuegiger (Balken, Schwenk, Plakette in 60 % der Zeit).
      if (BZ) { BZ.soll = function (def) { return !!(def && def.id === 'chainMaster'); }; alt.tempo = BZ._TEMPO; BZ._TEMPO = 0.6; }
      gs.__bossIntroLaeuft = false;
      try {
        behalten(gs, function () { boss = spawnBoss.call(gs); });
      } catch (e) {
        console.error('[Trailer] Boss', e);
      } finally {
        Phaser.Math.Between = alt.between;
        window.debugForcedBoss = alt.forced;
        if (BZ) { BZ.soll = alt.soll; BZ._TEMPO = alt.tempo; }
      }
      stellen(platz.spieler.x, platz.spieler.y);
      // Treppen und Tueren kommen in dieser Einstellung gar nicht ins Bild —
      // auch nicht am Rand (die Treppe ist der Durchgang des Raums).
      ((gs.children && gs.children.list) || []).forEach(function (o) {
        if (o && o.texture && /^(stair|tor_neu|door)/i.test(o.texture.key)) {
          kameras(gs).forEach(function (k) { try { k.ignore(o); } catch (e) {} });
          o.__trailerStoerer = true;
        }
      });
      if (!boss) return;
      boss.__trailer = true;
      // Ohne Taste: Plakette nach ~0,8 s, die Rede ab ~1,1 s; nach der ersten
      // Seite geht die Szene aus, der Hammer faellt ab 2,6 s.
      var plakette = function () {
        var z = gs.__bossZwischenszene;
        if (z && (z.teile || []).some(function (o) { return o && o.name === 'bossintroName'; })) moment('plakette');
      };
      [600, 800, 1000, 1200].forEach(function (ms) { plan(ms, plakette); });
      plan(2200, function () {
        var z = gs.__bossZwischenszene;
        if (z && typeof z.ueberspringen === 'function') z.ueberspringen();
      });
      plan(2600, function () {
        if (!boss.active) return;
        if (HOCHKANT) {
          // Von unten an den Boss heran, der Hammer schlaegt nach oben.
          stellen(boss.x, boss.y + 58);
          boss.__trailerDx = 0;
          faehigkeit(gs, 'slot3', 0, -1);
          return;
        }
        var dx = boss.x >= player.x ? 1 : -1;
        stellen(boss.x - dx * 58, boss.y + 6);
        boss.__trailerDx = dx;
        faehigkeit(gs, 'slot3', dx, 0);
      });
      plan(2950, function () {
        zeitlupeSetzen(true);
        if (HOCHKANT) loslassen(gs, 'slot3', 0, -1);
        else loslassen(gs, 'slot3', boss.__trailerDx || 1, 0);
        gs.cameras.main.shake(700, 0.018);
        moment('treffer');
      });
      plan(4300, function () { zeitlupeSetzen(S.zeitlupeTaste); });
    } },

    // 8 — Die Presse: die Presse stampft, Flugblaetter fliegen, dann die Druckerei.
    8: { name: 'Die Presse', kurz: 'presse', ziel: 'hub', aufbau: function (hub) {
      // #198: die stampfende Presse gross im Bild; ohne ihr Bild wie bisher
      // die Fassade mit Kamerastoessen.
      var lauf = S.lauf;
      if (window.Druckerpresse) {
        window.Druckerpresse.vorladen(hub, function (ok) {
          if (lauf !== S.lauf) return;
          if (ok) presseImBild(hub); else presseFassade(hub);
        });
        return;
      }
      presseFassade(hub);
    } },

    // 9 — Titel: Schwarz, Laterne leuchtet auf, Nebel reisst auf: FOGREACH.
    9: { name: 'Titel', kurz: 'titel', ziel: 'titel', aufbau: function (titel) {
      titel.abspielen();
    } }
  };

  // ---------------------------------------------------------------------
  // Einstellung starten
  // ---------------------------------------------------------------------
  function einstellung(n) {
    var def = EINSTELLUNGEN[n];
    if (!def) return false;
    if (!S.hubGesehen) { S.wartend = n; return true; }
    S.lauf++;
    S.einstellung = n;
    S.plan = [];
    S.uhr = 0;
    S.aufbauAb = null;
    S.momente = {};
    S.planEnde = 0;
    allesLoslassen();
    aufraeumen();
    hilfeWeg();
    zeitlupeSetzen(S.zeitlupeTaste);
    vorhang(true);
    var samen = def.samen || (1000 + n);
    var los = function (sc) {
      saeen(samen + 500);
      S.aufbauAb = S.uhr;
      vorhang(false);
      zeitlupeSetzen(S.zeitlupeTaste);
      try { def.aufbau(sc); } catch (e) { console.error('[Trailer] Einstellung ' + n, e); }
    };
    if (def.ziel === 'hub') zumHub(samen, los);
    else if (def.ziel === 'dungeon') zumDungeon(samen, los);
    else if (def.ziel === 'titel') zumTitel(samen, los);
    return true;
  }

  // ---------------------------------------------------------------------
  // Aufnahme (Taste R): Spiel-Canvas + Spielton -> MediaRecorder -> .webm
  // ---------------------------------------------------------------------
  // Der Ton: Phaser und SoundManager teilen sich EINEN AudioContext. Ein
  // MediaStreamDestination daran bekommt den Master-Ausgang beider
  // angeklemmt. Der SoundManager wird bei jedem Szenenwechsel neu gebaut —
  // sein neuer Ausgang wird in proBild nachgeklemmt.
  var A = { rec: null, teile: [], datei: null, mime: '', ton: null, ctx: null, angeklemmt: [], punkt: null, zaehler: {} };

  function dateiName() {
    var def = EINSTELLUNGEN[S.einstellung];
    var stamm = def ? (S.einstellung + '_' + def.kurz) : 'frei';
    var nr = (A.zaehler[stamm] || 0) + 1;
    A.zaehler[stamm] = nr;
    return 'fogreach_' + stamm + '_' + (nr < 10 ? '0' : '') + nr + '.webm';
  }

  function tonKlemmen(knoten) {
    if (!A.ton || !knoten || A.angeklemmt.indexOf(knoten) !== -1) return;
    if (knoten.context && knoten.context !== A.ctx) return;
    try { knoten.connect(A.ton); A.angeklemmt.push(knoten); } catch (e) {}
  }

  function tonAbgreifen() {
    var g = spiel();
    var ctx = (g && g.sound && g.sound.context)
      || (window.soundManager && window.soundManager.context) || null;
    if (!ctx || typeof ctx.createMediaStreamDestination !== 'function') return null;
    try { A.ton = ctx.createMediaStreamDestination(); } catch (e) { return null; }
    A.ctx = ctx;
    A.angeklemmt = [];
    tonKlemmen(g && g.sound && g.sound.masterVolumeNode);
    tonKlemmen(window.soundManager && window.soundManager._masterGain);
    return A.ton;
  }

  function mimeWahl() {
    var MR = window.MediaRecorder;
    var kandidaten = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'];
    if (typeof MR.isTypeSupported !== 'function') return '';
    for (var i = 0; i < kandidaten.length; i++) {
      try { if (MR.isTypeSupported(kandidaten[i])) return kandidaten[i]; } catch (e) {}
    }
    return '';
  }

  // Hochkant nimmt eine doppelt so grosse Leinwand auf (1080x1920): nach
  // jedem Bild wird das Spielbild mit harten Pixeln hineinkopiert. Reels und
  // Shorts wollen Full-HD hochkant; ein 540x960-Video skaliert die Plattform
  // weich und verwaschen hoch.
  function aufnahmeQuelle(cv) {
    if (!HOCHKANT) return { canvas: cv, loesen: function () {} };
    var f = Math.max(1, Math.round(1920 / (cv.height || 960)));
    var gross = null, ctx = null;
    try {
      gross = document.createElement('canvas');
      gross.width = (cv.width || 540) * f;
      gross.height = (cv.height || 960) * f;
      ctx = gross.getContext ? gross.getContext('2d') : null;
    } catch (e) { ctx = null; }
    if (!ctx) return null;
    var kopieren = function () {
      try { ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, 0, 0, gross.width, gross.height); } catch (e) {}
    };
    // Gleich nach dem Zeichnen, solange der WebGL-Puffer noch steht.
    var g = spiel();
    g.events.on('postrender', kopieren);
    kopieren();
    return { canvas: gross, loesen: function () { g.events.off('postrender', kopieren); } };
  }

  function aufnahmeStarten() {
    var g = spiel();
    var cv = g && g.canvas;
    var quelle = (cv && typeof window.MediaRecorder === 'function') ? aufnahmeQuelle(cv) : null;
    if (!quelle || typeof quelle.canvas.captureStream !== 'function') {
      if (quelle) quelle.loesen();
      meldung('Aufnahme hier nicht möglich (Browser ohne MediaRecorder/captureStream).');
      return false;
    }
    A.quelle = quelle;
    A.groesse = quelle.canvas.width + 'x' + quelle.canvas.height;
    var strom, rec;
    try {
      strom = quelle.canvas.captureStream(60);
      var ton = tonAbgreifen();
      if (ton && ton.stream) ton.stream.getAudioTracks().forEach(function (t) { strom.addTrack(t); });
      A.mime = mimeWahl();
      var opts = { videoBitsPerSecond: 12000000, audioBitsPerSecond: 192000 };
      if (A.mime) opts.mimeType = A.mime;
      rec = new window.MediaRecorder(strom, opts);
    } catch (e) {
      tonLoesen();
      quelleLoesen();
      meldung('Aufnahme konnte nicht starten: ' + ((e && e.message) || e));
      return false;
    }
    A.teile = [];
    A.datei = dateiName();
    A.mitTon = !!A.ton;
    rec.ondataavailable = function (ev) { if (ev && ev.data && ev.data.size) A.teile.push(ev.data); };
    rec.onstop = speichern;
    A.rec = rec;
    rec.start(1000);
    // Der rote Punkt sitzt im Browserfenster, nicht im Canvas — er ist im
    // Video also nicht zu sehen.
    A.punkt = domElement({
      position: 'fixed', top: '10px', right: '10px', width: '14px', height: '14px',
      borderRadius: '50%', background: '#e01818', boxShadow: '0 0 6px #ff3030',
      zIndex: '10001', pointerEvents: 'none'
    });
    if (!A.mitTon) meldung('Aufnahme läuft — ohne Ton (Spielton nicht abgreifbar).');
    return true;
  }

  function tonLoesen() {
    A.angeklemmt.forEach(function (k) { try { k.disconnect(A.ton); } catch (e) {} });
    A.angeklemmt = [];
    A.ton = null;
    A.ctx = null;
  }

  function aufnahmeStoppen() {
    if (!A.rec) return false;
    var rec = A.rec;
    A.rec = null;
    domWeg(A.punkt);
    A.punkt = null;
    try { rec.stop(); } catch (e) { speichern(); }
    return true;
  }

  function quelleLoesen() {
    if (A.quelle) A.quelle.loesen();
    A.quelle = null;
  }

  function speichern() {
    tonLoesen();
    quelleLoesen();
    var name = A.datei || 'fogreach_frei.webm';
    var teile = A.teile;
    A.teile = [];
    var blob = null;
    try { blob = new Blob(teile, { type: A.mime || 'video/webm' }); } catch (e) { blob = null; }
    TM.letzteAufnahme = { datei: name, teile: teile.length, mime: A.mime, mitTon: !!A.mitTon, groesse: A.groesse };
    if (!blob) return;
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      if (typeof a.click === 'function') a.click();
      domWeg(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 5000);
    } catch (e) {
      meldung('Speichern der Aufnahme fehlgeschlagen: ' + ((e && e.message) || e));
    }
  }

  // ---------------------------------------------------------------------
  // Pro Bild
  // ---------------------------------------------------------------------
  // Die Boss-Zwischenszene baut ihr Bild nach und nach auf (Plakette, Rede):
  // alles davon gehoert ins Bild — nur ihre Knoepfe (Weiter, Ueberspringen)
  // nicht, die Einstellung blaettert ja selbst.
  function bossSzeneBehalten() {
    var gs = laeuft('GameScene') ? szene('GameScene') : null;
    var z = gs && gs.__bossZwischenszene;
    var teile = (z && z.teile) || [];
    for (var i = 0; i < teile.length; i++) {
      var o = teile[i];
      if (!o) continue;
      // (Auch wenn behalten() sie beim Erscheinen schon markiert hat.)
      if (/^bossintro(Weiter|Ueberspringen)$/.test(o.name || '')) {
        o.__trailerBild = false;
        // Die Messingplatte des Knopfs folgt ihm in der Liste.
        var platte = teile[i + 1];
        if (platte && !platte.name) { platte.__trailerBild = false; i++; }
        continue;
      }
      if (o.__trailerBild === undefined) o.__trailerBild = true;
    }
  }

  function proBild(zeit, delta) {
    S.uhr += (typeof delta === 'number' && delta > 0) ? delta : 16.67;
    var g = spiel();
    if (!g || !g.scene) return;

    if (!S.hubGesehen && laeuft('HubSceneV2')) {
      S.hubGesehen = true;
      var hub = szene('HubSceneV2');
      if (hub.player) hub.player.setVisible(true);
      if (S.wartend != null) { var n = S.wartend; S.wartend = null; einstellung(n); }
    }

    planAbarbeiten();

    bossSzeneBehalten();
    S.hudAn = S.hud || S.hudZwang;
    HAUPTSZENEN.forEach(function (key) {
      if (!laeuft(key)) return;
      var sc = szene(key);
      if (HOCHKANT) uiKamera(sc);
      if (S.hudAn) hudZeigen(sc); else hudVerstecken(sc);
      if (HOCHKANT) {
        kamerasVerteilen(sc);
        if (S.hudAn) hudBeschneiden(sc);
      }
    });
    g.scene.getScenes(true).forEach(zeitAnwenden);

    lebenHalten();
    ruheHalten();
    // Ein neuer SoundManager (Szenenwechsel) spielt in die laufende Aufnahme.
    if (A.rec && A.ton && window.soundManager) tonKlemmen(window.soundManager._masterGain);

    // Das Overlay bleibt oben (die Druckerei holt sich sonst den Platz).
    try {
      var o = overlay();
      var liste = g.scene.scenes;
      if (o && liste[liste.length - 1] !== o) g.scene.bringToTop('TrailerOverlay');
    } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Tasten
  // ---------------------------------------------------------------------
  function taste(k) {
    k = String(k || '').toLowerCase();
    if (/^[0-9]$/.test(k)) return einstellung(Number(k));
    if (k === 'z') { S.zeitlupeTaste = !S.zeitlupe; zeitlupeSetzen(S.zeitlupeTaste); return true; }
    if (k === 'l') { letterboxSetzen(!S.letterbox); return true; }
    if (k === 'h') { S.hud = !S.hud; return true; }
    if (k === 'r') { if (A.rec) aufnahmeStoppen(); else aufnahmeStarten(); return true; }
    if (k === 'm') {
      if (window.soundManager && typeof window.soundManager.toggleMute === 'function') window.soundManager.toggleMute();
      return true;
    }
    return false;
  }

  // Im Fangschritt am Fenster, damit die Spieltasten (1-4 Faehigkeiten, M
  // im Hub/Dungeon) dieselbe Taste nicht noch einmal auswerten.
  window.addEventListener('keydown', function (ev) {
    if (!ev || ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (!taste(ev.key)) return;
    try { ev.preventDefault(); } catch (e) {}
    try { ev.stopImmediatePropagation(); } catch (e) {}
  }, true);

  // ---------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------
  /** Vom Startbildschirm gerufen, bevor er in den Hub wechselt. */
  function vorbereiten() {
    saeen(1000);
    window.__SKIP_TUTORIAL__ = true;
    try { (window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1'); } catch (e) {}
    var n = parseInt((window.DebugGate && window.DebugGate.flagge('einstellung')) || '', 10);
    if (n >= 0 && n <= 9) S.wartend = n;
  }

  drehregeln();
  hilfeZeigen();
  zeigerAus();
  (function anmelden() {
    var g = spiel();
    if (!g) return;
    g.scene.add('TrailerTitel', TrailerTitel, false);
    g.scene.add('TrailerOverlay', TrailerOverlay, true);
    g.events.on('poststep', proBild);
  })();

  TM.vorbereiten = vorbereiten;
  TM.einstellung = einstellung;
  TM.taste = taste;
  TM.EINSTELLUNGEN = EINSTELLUNGEN;
  TM.zustand = function () {
    return {
      hochkant: HOCHKANT, einstellung: S.einstellung, hud: S.hud, zeitlupe: S.zeitlupe, letterbox: S.letterbox,
      aufnahme: !!A.rec, uhr: S.uhr, seit: (S.aufbauAb == null ? -1 : S.uhr - S.aufbauAb), offen: S.plan.length, hubGesehen: S.hubGesehen, wartend: S.wartend,
      hudAn: !!S.hudAn, momente: S.momente, planEnde: S.planEnde
    };
  };
  TM._hudObjekte = hudObjekte;
  TM._hudLage = hudLage;
})();
