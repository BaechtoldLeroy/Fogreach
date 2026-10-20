/* =====================================================================
 * elaraKampf.js — der Kampf gegen die besessene Elara (Story-Kern v6.1, Stufe 3)
 * ---------------------------------------------------------------------
 * "Sie löscht Teile der Arena, lässt Besiegte zurückkehren und greift nach
 * Deiner Erinnerung. Je mehr Du im Spiel zurückgewonnen hast, desto mehr kann
 * sie Dir nehmen. Was Du in «Wer du warst» zurückholst, gehört nicht dazu."
 *
 * Zu ihren Angriffen aus enemy.js (shadowDash, vergesseneRufen,
 * nebelAusloeschung) kommt hier:
 *   1. Der Griff nach der Erinnerung (erinnerungsGriff, eigener Takt): eine
 *      Sekunde Vorlauf, ein Kreis unter dem Spieler. Wer drin bleibt, dem
 *      nimmt sie eine Faehigkeit (einen belegten Slot). Sie haelt hoechstens
 *      kapazitaet() Stueck zugleich; wie viele, haengt an dem, was der Spieler
 *      zurueckgewonnen hat (gebundene Fragmente im Wissensbaum), ohne das
 *      Fragment aus "Wer du warst". Diese Erinnerung ist gebunden: Der erste
 *      Griff, der trifft, prallt an ihr ab ("Daran kommt sie nicht heran.").
 *      Zurueck kommt das Genommene durch Treffer: je TREFFER_ZURUECK Treffer
 *      auf sie das aelteste Stueck. Am Ende des Kampfs, beim Tod, beim
 *      Verlassen des Raums kommt alles zurueck; gespeichert wird nie etwas
 *      (nur eine Sperre im Speicher, AbilitySystem.tryActivate fragt sie ab).
 *   2. Die Arena verlischt: bei Phase 2 und 3 werden zwei Stellen der Arena
 *      angekuendigt (Vorlauf) und dann zu Nebel, der zehrt, bis sie faellt.
 *   3. Die Besiegten kehren zurueck (besiegteRufen, ihre Signatur ab Phase 2):
 *      graue Echos von Kettenmeister, Zeremonienmeister und, wer ihn gehoert
 *      hat, dem Nachhall. Hoechstens ECHO_MAX zugleich.
 *   4. Das Zeichen auf der Klinge erkannt: sie beginnt angeschlagen (85 %),
 *      sichtbar am Ring der drei Ketten, der ueber ihr zerbricht.
 *   5. Mara hilft, wenn ihr Netz den Konvoi ueberstanden hat (nicht
 *      convoy_blown, wie in Finale.nachKampf und im Epilog): sie steht am
 *      Rand der Arena und schiesst.
 * ===================================================================== */
(function () {
  'use strict';

  var GRIFF_ERSTER_MS = 6000;                 // erster Griff nach Kampfbeginn
  var GRIFF_TAKT_MS = { 1: 15000, 2: 12500, 3: 10000 };
  var GRIFF_VORLAUF_MS = 1000;                // so lange sieht man ihn kommen
  var GRIFF_RADIUS = 80;
  var GRIFF_SCHADEN = 0.6;                    // Anteil ihres Schadens
  var TREFFER_ZURUECK = 3;                    // Treffer je zurueckgeholter Faehigkeit
  var KAPAZITAET_STUFEN = [5, 15];            // bis 5 Fragmente: 1, bis 15: 2, sonst 3

  var ZONEN_VORLAUF_MS = 1100;
  var ZONEN_TICK_MS = 500;
  var ZONEN_SCHADEN = 0.15;                   // gemessen: 0.25 machte den Kampf fuer Stehenbleiber zu zaeh

  var ECHO_MAX = 2;
  var ECHO_VORLAUF_MS = 1000;
  var ECHO_LP = 0.04;                         // Anteil ihrer Max-LP
  var ECHO_PAUSE_MS = 12000;                  // so lange ruft sie hoechstens einmal
  var ECHO_SCHADEN = 0.25;

  var ZEICHEN_START = 0.85;                   // Zeichen erkannt: sie beginnt angeschlagen
  var MARA_TAKT_MS = 7000;                    // so oft trifft Maras Pfeil
  var MARA_ANTEIL = 0.03;                     // Anteil der Max-LP je Pfeil

  var ECHO_ARTEN = {
    kettenmeister: { prefix: 'boss_chain', hoehe: 104, de: 'Echo: Der Kettenmeister', en: 'Echo: The Chainmaster' },
    zeremonienmeister: { prefix: 'boss_ceremony', hoehe: 100, de: 'Echo: Der Zeremonienmeister', en: 'Echo: The Master of Ceremonies' },
    nachhall: { prefix: 'boss_nachhall', hoehe: 104, de: 'Echo: Der Nachhall', en: 'Echo: The Echo' }
  };

  function _en() {
    try { return !!(window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en'); } catch (e) { return false; }
  }
  function _t(de, en) { return _en() ? en : de; }
  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _qs() { return window.questSystem || null; }
  function _flags() {
    var qs = _qs();
    return (qs && typeof qs.getFlags === 'function') ? (qs.getFlags() || {}) : {};
  }
  function _toast(scene, de, en) {
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(scene, _t(de, en), 'elara_besessen');
      }
    } catch (e) {}
  }
  function _spieler() { return (typeof player !== 'undefined' && player) ? player : window.player; }

  // ---------------------------------------------------------------------
  // Rein: was hat der Spieler zurueckgewonnen, wie viel kann sie nehmen?
  // ---------------------------------------------------------------------

  /**
   * Zurueckgewonnene Erinnerung = gebundene Fragmente (Raenge im
   * Wissensbaum) plus freie Fragmente. "Wer du warst" zaehlt nicht mit: das
   * eine Fragment, das der Auftrag gibt, wird abgezogen.
   * @param {{fragmente?:number, raenge?:object, werDuWarst?:boolean}} e
   */
  function zurueckgewonnen(e) {
    e = e || {};
    var summe = Math.max(0, e.fragmente | 0);
    var r = e.raenge || {};
    Object.keys(r).forEach(function (k) { summe += Math.max(0, r[k] | 0); });
    if (e.werDuWarst) summe -= 1;
    return Math.max(0, summe);
  }

  /** Wie viele Faehigkeiten sie zugleich halten kann (1..3). */
  function kapazitaet(n) {
    if (n <= KAPAZITAET_STUFEN[0]) return 1;
    if (n <= KAPAZITAET_STUFEN[1]) return 2;
    return 3;
  }

  function werDuWarstGebunden(flags) {
    flags = flags || _flags();
    if (flags.self_remembered) return true;
    var qs = _qs();
    try {
      return !!(qs && typeof qs.getCompletedQuests === 'function'
        && (qs.getCompletedQuests() || []).some(function (q) { return q && q.id === 'who_you_were'; }));
    } catch (e) { return false; }
  }

  function zurueckgewonnenAusSpiel(flags) {
    var KT = window.KnowledgeTree;
    var st = (KT && typeof KT.getState === 'function') ? KT.getState() : { fragments: 0, ranks: {} };
    return zurueckgewonnen({ fragmente: st.fragments, raenge: st.ranks, werDuWarst: werDuWarstGebunden(flags) });
  }

  /** Maras Hilfe im Kampf: ihr Netz hat den Konvoi ueberstanden. */
  function maraHilft(flags) {
    return !(flags || {}).convoy_blown;
  }

  // ---------------------------------------------------------------------
  // Die Sperre: was sie gerade haelt (nur im Speicher, nie im Spielstand).
  // ---------------------------------------------------------------------
  var _gesperrt = {};
  function gesperrt(abilityId) { return !!(abilityId && _gesperrt[abilityId]); }
  function allesZurueck(grund) {
    var ids = Object.keys(_gesperrt);
    _gesperrt = {};
    if (ids.length && typeof window._refreshAbilityHUD === 'function') { try { window._refreshAbilityHUD(); } catch (e) {} }
    return ids;
  }

  function _jetzt(scene) {
    return (typeof window.gameNow === 'function') ? window.gameNow(scene) : scene.time.now;
  }

  // ---------------------------------------------------------------------
  // Kampfbeginn
  // ---------------------------------------------------------------------

  /** Startet die Mechaniken (einmal je Boss). Vorher wartet sie (Buehne). */
  function starten(scene, boss) {
    if (!scene || !boss || !boss.active || boss._elaraKampf) return null;
    var flags = _flags();
    var k = boss._elaraKampf = {
      genommen: [], zonen: [], echos: [], adds: [], texte: [],
      naechsterGriff: _jetzt(scene) + GRIFF_ERSTER_MS,
      gebundenGezeigt: false, griffe: 0, phasenZonen: {},
      zurueck: zurueckgewonnenAusSpiel(flags),
      werDuWarst: werDuWarstGebunden(flags)
    };
    k.kapazitaet = kapazitaet(k.zurueck);
    // Solange sie kaempft, lodert die Esse hinter ihr.
    if (window.FinaleHandwerk && window.FinaleHandwerk.esseZustand) window.FinaleHandwerk.esseZustand(scene, 'flackern');

    // Besessen: violett, der Nebel quillt um sie.
    if (typeof boss.setTint === 'function') boss.setTint(0xc4a8ff);
    var aura = scene.add.graphics().setDepth((boss.depth || 50) - 1);
    aura.fillStyle(0x8866cc, 0.28); aura.fillCircle(0, 0, 70);
    aura.fillStyle(0xaa88ee, 0.18); aura.fillCircle(0, 0, 110);
    scene.tweens.add({ targets: aura, alpha: { from: 0.6, to: 1 }, duration: 900, yoyo: true, repeat: -1 });

    if (flags.zeichen_bemerkt) _zeichenVorteil(scene, boss);

    boss._maraHilft = maraHilft(flags);
    var maraTakt = boss._maraHilft ? _maraAufstellen(scene, boss) : null;

    var anzeige = _anzeigeBauen(scene);
    var takt = scene.time.addEvent({ delay: 100, loop: true, callback: function () {
      if (!boss.active) return;
      aura.setPosition(boss.x, boss.y);
      if (boss._introHaltBis && scene.time.now < boss._introHaltBis) return;
      if (boss.hp > 0 && !k.griffLaeuft && _jetzt(scene) >= k.naechsterGriff) {
        erinnerungsGriff.call(scene, boss);
      }
      _anzeigeZeichnen(scene, boss, anzeige);
    } });

    var ende = function () {
      try { takt.remove(); } catch (e) {}
      try { if (maraTakt) maraTakt.remove(); } catch (e) {}
      _weg(aura);
      _weg(anzeige);
      k.texte.forEach(_weg);
      k.zonen.forEach(function (z) { try { if (z.uhr) z.uhr.remove(); } catch (e) {} _weg(z.bild); });
      // Was sie gerufen hat, vergeht mit ihr.
      k.echos.concat(k.adds).forEach(function (e) { if (e && e.active) { if (e.hpBar) _weg(e.hpBar); _weg(e); } });
      allesZurueck('ende');
    };
    boss.once('destroy', ende);
    scene.events.once('shutdown', function () { allesZurueck('raum'); });
    return k;
  }

  // Das Zeichen: ueber ihr die drei Ketten, die zerspringen; ein Teil der
  // Leiste blitzt golden und fehlt.
  function _zeichenVorteil(scene, boss) {
    boss.hp = Math.max(1, Math.ceil(boss.hp * ZEICHEN_START));
    // Zu sehen erst, wenn die Zwischenszene vor dem Boss durch ist: die
    // Spieluhr steht waehrenddessen, Tweens liefen ungesehen ab.
    scene.time.delayedCall(500, function () { if (boss.active) _zeichenZeigen(scene, boss); });
  }
  function _zeichenZeigen(scene, boss) {
    var k = boss._elaraKampf;
    var g = scene.add.graphics().setDepth(1004).setPosition(boss.x, boss.y - 60).setName('elaraZeichen');
    g.lineStyle(4, 0xffd166, 1);
    for (var i = 0; i < 3; i++) {
      var w = i * Math.PI * 2 / 3 - Math.PI / 2;
      g.strokeCircle(Math.cos(w) * 14, Math.sin(w) * 14, 18);
    }
    scene.tweens.add({ targets: g, scale: 1.8, alpha: 0, delay: 900, duration: 700, onComplete: function () { _weg(g); } });
    var t = scene.add.text(boss.x, boss.y - 110, _t('Das Zeichen der drei Ketten', 'The sign of the three chains'), {
      fontFamily: 'serif', fontStyle: 'bold', fontSize: '16px', color: '#ffd166', stroke: '#0b0a10', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraZeichenText');
    k.texte.push(t, g);
    scene.tweens.add({ targets: t, y: t.y - 20, alpha: 0, delay: 2200, duration: 900, onComplete: function () { _weg(t); } });
    _toast(scene, 'Du kennst das Zeichen an ihrem Ring. Du warst vorbereitet.', 'You know the sign on her ring. You came prepared.');
  }

  // Mara am Rand der Arena, sichtbar, und ihre Pfeile kommen von dort.
  function _maraAufstellen(scene, boss) {
    var b = scene.physics && scene.physics.world && scene.physics.world.bounds;
    var mx = b ? b.x + b.width * 0.18 : boss.x - 300, my = b ? b.y + b.height * 0.2 : boss.y - 240;
    if (scene.isPointAccessible) {
      for (var i = 0; i < 8 && !scene.isPointAccessible(mx, my); i++) { mx += (boss.x - mx) * 0.2; my += (boss.y - my) * 0.2; }
    }
    var mara = null;
    if (scene.textures && scene.textures.exists('spaeherin')) {
      mara = scene.add.image(mx, my, 'spaeherin').setDepth(85).setName('elaraKampfMara');
      var p = _spieler();
      mara.setScale(((p && p.displayHeight > 20 && p.displayHeight < 200) ? p.displayHeight : 64) / (mara.height || 62));
      scene.__maraFigur = mara;
      boss.once('destroy', function () { /* sie bleibt fuer das Urteil stehen (Finale) */ });
    }
    var ersterPfeil = true;
    return scene.time.addEvent({ delay: MARA_TAKT_MS, loop: true, callback: function () {
      if (!boss.active || boss.hp <= 0) return;
      if (ersterPfeil) {
        ersterPfeil = false;
        _toast(scene, 'Mara ist da. Ihre Pfeile kommen aus dem Dunkel.', 'Mara is here. Her arrows come out of the dark.');
      }
      var cam = scene.cameras && scene.cameras.main;
      var sx = mara && mara.scene ? mara.x : (cam ? cam.scrollX : boss.x - 400);
      var sy = mara && mara.scene ? mara.y - 10 : (cam ? cam.scrollY + cam.height * 0.2 : boss.y - 300);
      if (mara && mara.scene) mara.setFlipX(boss.x < mara.x);
      var pfeil = scene.add.graphics().setDepth(1003);
      pfeil.lineStyle(3, 0xe8d8a0, 1);
      pfeil.lineBetween(-10, 0, 10, 0);
      pfeil.setPosition(sx, sy);
      pfeil.setRotation(Math.atan2(boss.y - sy, boss.x - sx));
      scene.tweens.add({ targets: pfeil, x: boss.x, y: boss.y, duration: 350, onComplete: function () {
        pfeil.destroy();
        if (!boss.active || boss.hp <= 0) return;
        boss.hp = Math.max(1, boss.hp - Math.ceil(boss.maxHp * MARA_ANTEIL));
      } });
    } });
  }

  // ---------------------------------------------------------------------
  // 1. Der Griff nach der Erinnerung
  // ---------------------------------------------------------------------
  function erinnerungsGriff(boss) {
    var scene = this;
    var k = boss && boss._elaraKampf;
    var p = _spieler();
    if (!k || !p || k.griffLaeuft) return;
    k.griffLaeuft = true;
    k.griffe++;
    var tx = p.x, ty = p.y;
    var start = scene.time.now;
    var g = scene.add.graphics().setDepth(1001).setName('elaraGriff');
    var hinweis = scene.add.text(tx, ty - GRIFF_RADIUS - 16, _t('Sie greift nach Deiner Erinnerung', 'She reaches for your memory'), {
      fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', color: '#d8c8ff', stroke: '#0b0a10', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraGriffHinweis');
    k.texte.push(g, hinweis);
    if (k.griffe === 1) _toast(scene, 'Elara greift nach Deiner Erinnerung. Tritt aus dem Kreis.', 'Elara reaches for your memory. Step out of the circle.');
    var uhr = scene.time.addEvent({ delay: 30, loop: true, callback: function () {
      var f = Math.min(1, (scene.time.now - start) / GRIFF_VORLAUF_MS);
      g.clear();
      g.lineStyle(3, 0xb48cff, 0.9);
      g.strokeCircle(tx, ty, GRIFF_RADIUS);
      g.fillStyle(0x6a3cc8, 0.12 + f * 0.25);
      g.fillCircle(tx, ty, GRIFF_RADIUS * (0.3 + f * 0.7));
      if (boss.active) {
        // Der Arm aus Rauch: von ihr zum Kreis, waechst mit dem Vorlauf.
        var ex = boss.x + (tx - boss.x) * f, ey = boss.y + (ty - boss.y) * f;
        g.lineStyle(4 + f * 6, 0x3a2258, 0.55 + f * 0.3);
        g.lineBetween(boss.x, boss.y, ex, ey);
        for (var i = 0; i < 5; i++) {
          var a = i * 1.26 + f * 2;
          g.lineStyle(2, 0xb48cff, 0.7);
          g.lineBetween(ex, ey, ex + Math.cos(a) * 16 * f, ey + Math.sin(a) * 16 * f);
        }
      }
      if (f >= 1) {
        uhr.remove();
        _weg(g); _weg(hinweis);
        _griffAufloesen(scene, boss, tx, ty);
      }
    } });
    boss.once('destroy', function () { try { uhr.remove(); } catch (e) {} _weg(g); _weg(hinweis); });
  }

  function _griffAufloesen(scene, boss, tx, ty) {
    var k = boss._elaraKampf;
    if (!k) return;
    k.griffLaeuft = false;
    k.naechsterGriff = _jetzt(scene) + (GRIFF_TAKT_MS[boss.phase || 1] || GRIFF_TAKT_MS[1]);
    var p = _spieler();
    if (!boss.active || boss.hp <= 0 || !p || !p.active) return;
    var rollt = (typeof isRolling !== 'undefined' && isRolling);
    var drin = Math.hypot(p.x - tx, p.y - ty) <= GRIFF_RADIUS && !rollt;
    if (!drin) { k.verfehlt = (k.verfehlt || 0) + 1; return; }

    // Die gebundene Erinnerung: daran kommt sie nicht heran.
    if (k.werDuWarst && !k.gebundenGezeigt) {
      k.gebundenGezeigt = true;
      _gebundenZeigen(scene, boss, p);
      return;
    }
    if (typeof applyPlayerDamage === 'function') applyPlayerDamage(Math.max(1, Math.ceil((boss.damage || 8) * GRIFF_SCHADEN)), scene);
    nehmen(scene, boss);
  }

  function _gebundenZeigen(scene, boss, p) {
    var k = boss._elaraKampf;
    var ring = scene.add.graphics().setDepth(1003).setPosition(p.x, p.y).setName('elaraGebundenRing');
    ring.lineStyle(5, 0xffd166, 1); ring.strokeCircle(0, 0, 34);
    ring.lineStyle(2, 0xfff2c4, 0.9); ring.strokeCircle(0, 0, 46);
    scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 900, onComplete: function () { _weg(ring); } });
    var a = scene.add.text(p.x, p.y - 64, _t('Wer Du warst', 'Who you were'), {
      fontFamily: 'serif', fontStyle: 'bold', fontSize: '17px', color: '#ffd166', stroke: '#1a1408', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraGebunden');
    var b = scene.add.text(p.x, p.y - 42, _t('Daran kommt sie nicht heran.', 'That she cannot reach.'), {
      fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', color: '#f3e6c4', stroke: '#1a1408', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraGebundenSatz');
    k.texte.push(a, b);
    [a, b].forEach(function (t) {
      scene.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 2400, duration: 900, onComplete: function () { _weg(t); } });
    });
    // Sie zuckt zurueck, als haette sie sich verbrannt.
    if (boss.active) {
      try { boss.setTintFill(0xffe8b0); } catch (e) {}
      scene.time.delayedCall(160, function () { if (boss.active) { boss.clearTint(); boss.setTint(0xc4a8ff); } });
      var w = Math.atan2(boss.y - p.y, boss.x - p.x);
      var nx = boss.x + Math.cos(w) * 50, ny = boss.y + Math.sin(w) * 50;
      if (!scene.isPointAccessible || scene.isPointAccessible(nx, ny)) {
        boss.setPosition(nx, ny);
        if (boss.body && boss.body.reset) boss.body.reset(nx, ny);
      }
    }
    _toast(scene, 'Daran kommt sie nicht heran. Was Branka gebunden hat, bleibt Dir.', 'That she cannot reach. What Branka bound stays yours.');
  }

  /** Nimmt eine belegte, noch nicht genommene Faehigkeit (falls Platz). */
  function nehmen(scene, boss) {
    var k = boss._elaraKampf;
    var AS = window.AbilitySystem;
    if (!k || !AS || typeof AS.getActiveLoadout !== 'function') return null;
    if (k.genommen.length >= k.kapazitaet) {
      _zeile(scene, boss, _t('Sie hält schon, was sie fassen kann.', 'She already holds all she can grasp.'));
      return null;
    }
    var bel = AS.getActiveLoadout();
    var frei = (AS.SLOT_KEYS || Object.keys(bel)).filter(function (s) { return bel[s] && !gesperrt(bel[s]); });
    if (!frei.length) {
      _zeile(scene, boss, _t('Sie greift ins Leere.', 'She grasps at nothing.'));
      return null;
    }
    var slot = frei[Math.floor(Math.random() * frei.length) % frei.length];
    var eintrag = { slot: slot, abilityId: bel[slot], rest: TREFFER_ZURUECK };
    k.genommen.push(eintrag);
    _gesperrt[eintrag.abilityId] = true;
    if (typeof window._refreshAbilityHUD === 'function') { try { window._refreshAbilityHUD(); } catch (e) {} }
    var name = _faehigkeitName(eintrag.abilityId);
    _zeile(scene, boss, _t('Genommen: ', 'Taken: ') + name, '#c8a8ff');
    if (k.genommen.length === 1 && !k.erklaert) {
      k.erklaert = true;
      _toast(scene, 'Sie hat Dir «' + name + '» genommen. Triff sie, und Du holst es Dir zurück.',
        'She took «' + name + '» from you. Strike her and you take it back.');
    }
    return eintrag;
  }

  /** Ein Treffer auf sie: zaehlt fuer das aelteste genommene Stueck. */
  function treffer(scene, boss) {
    var k = boss && boss._elaraKampf;
    if (!k || !k.genommen.length) return null;
    var e = k.genommen[0];
    e.rest--;
    if (e.rest > 0) return null;
    k.genommen.shift();
    delete _gesperrt[e.abilityId];
    if (typeof window._refreshAbilityHUD === 'function') { try { window._refreshAbilityHUD(); } catch (x) {} }
    var p = _spieler();
    if (p) {
      var t = scene.add.text(p.x, p.y - 56, _t('Zurück: ', 'Back: ') + _faehigkeitName(e.abilityId), {
        fontFamily: 'serif', fontStyle: 'bold', fontSize: '15px', color: '#ffe6a0', stroke: '#1a1408', strokeThickness: 4
      }).setOrigin(0.5).setDepth(1004).setName('elaraZurueck');
      k.texte.push(t);
      scene.tweens.add({ targets: t, y: t.y - 24, alpha: 0, delay: 900, duration: 700, onComplete: function () { _weg(t); } });
    }
    return e;
  }

  function _faehigkeitName(id) {
    var AS = window.AbilitySystem;
    try {
      var def = AS && AS.getAbilityDef && AS.getAbilityDef(id);
      if (window.i18n && window.i18n.t) {
        var v = window.i18n.t('ability.' + id + '.name');
        if (typeof v === 'string' && v.indexOf('[MISSING') !== 0 && v !== 'ability.' + id + '.name') return v;
      }
      return (def && def.name) || id;
    } catch (e) { return id; }
  }

  function _zeile(scene, boss, text, farbe) {
    var k = boss._elaraKampf;
    var p = _spieler();
    var t = scene.add.text(p ? p.x : boss.x, (p ? p.y : boss.y) - 60, text, {
      fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', color: farbe || '#d8c8ff', stroke: '#0b0a10', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraZeile');
    if (k) k.texte.push(t);
    scene.tweens.add({ targets: t, y: t.y - 20, alpha: 0, delay: 1200, duration: 700, onComplete: function () { _weg(t); } });
  }

  // Die Anzeige an der Leiste: was sie haelt, und wie viele Treffer fehlen.
  function _anzeigeBauen(scene) {
    // Leer unsichtbar: sonst zaehlt sie als HUD, das in Zwischenszenen stehen bleibt.
    return scene.add.container(0, 0).setDepth(1150).setScrollFactor(0).setVisible(false).setName('elaraGenommen');
  }
  function _anzeigeZeichnen(scene, boss, c) {
    var k = boss._elaraKampf;
    if (!c || !c.scene || !k) return;
    var schluessel = k.genommen.map(function (e) { return e.slot + ':' + e.rest; }).join(',');
    if (c.__stand === schluessel) return;
    c.__stand = schluessel;
    c.removeAll(true);
    c.setVisible(k.genommen.length > 0);
    if (!k.genommen.length) return;
    var kam = scene.cameras.main;
    var HL = window.hudLeiste;
    var unten = (HL && typeof HL.freiraumUnten === 'function') ? HL.freiraumUnten(scene) : 0;
    var mobil = !unten;
    var y = kam.height - (mobil ? 150 : unten + 14);
    var labels = (window.AbilitySystem && window.AbilitySystem.SLOT_KEY_LABELS) || {};
    var breite = 0;
    var zeilen = k.genommen.map(function (e) {
      var zeile = scene.add.container(0, 0);
      var x = 0;
      if (HL && HL.bereit && HL.bereit(scene) && HL.frame(e.abilityId, false) >= 0) {
        var ic = scene.add.image(12, 0, HL.KEY, HL.frame(e.abilityId, false)).setDisplaySize(26, 26).setAlpha(0.85);
        zeile.add(ic);
        // Eine violette Kette quer ueber dem Bild: gebunden, nicht verloren.
        var kette = scene.add.graphics();
        kette.lineStyle(2, 0xc8a8ff, 1); kette.strokeCircle(4, 6, 5); kette.strokeCircle(12, 0, 5); kette.strokeCircle(20, -6, 5);
        zeile.add(kette);
        x = 30;
      }
      var taste = (window.InputScheme && window.InputScheme.getScheme && window.InputScheme.getScheme() === 'arpg')
        ? String(e.slot).replace('slot', '') : (labels[e.slot] || e.slot);
      var txt = scene.add.text(x, 0, _t('Genommen', 'Taken') + ' [' + taste + '] ' + _faehigkeitName(e.abilityId)
        + ' · ' + e.rest + ' ' + (e.rest === 1 ? _t('Treffer', 'hit') : _t('Treffer', 'hits')), {
        fontFamily: 'monospace', fontSize: '13px', color: '#e2d4ff', stroke: '#0b0a10', strokeThickness: 3
      }).setOrigin(0, 0.5);
      zeile.add(txt);
      zeile.__breite = x + txt.width;
      breite = Math.max(breite, zeile.__breite);
      return zeile;
    });
    var hoehe = zeilen.length * 26;
    var bg = scene.add.rectangle(0, 0, breite + 20, hoehe + 8, 0x1a1028, 0.82).setStrokeStyle(1, 0xb48cff, 0.9).setOrigin(0.5, 1);
    c.add(bg);
    zeilen.forEach(function (z, i) {
      z.setPosition(-breite / 2, -hoehe - 4 + 13 + i * 26);
      c.add(z);
    });
    c.setPosition(kam.width / 2, y);
  }

  // ---------------------------------------------------------------------
  // 2. Die Arena verlischt (Phase 2 und 3)
  // ---------------------------------------------------------------------
  function _arenaMitte(scene) {
    var g = scene._quelleGlow;
    if (g && g.active) return { x: g.x, y: g.y };
    var b = scene.physics && scene.physics.world && scene.physics.world.bounds;
    if (b) return { x: b.centerX, y: b.centerY };
    var p = _spieler();
    return { x: p ? p.x : 400, y: p ? p.y : 300 };
  }

  /** Die Orte, die in dieser Phase verloeschen (rein bis auf die Raumgroesse). */
  function zonenOrte(mitte, breite, hoehe, phase, drehung) {
    var r = Math.max(90, Math.min(130, Math.min(breite, hoehe) * 0.14));
    var abstand = Math.min(breite, hoehe) * 0.28;
    var basis = (drehung || 0) + (phase >= 3 ? Math.PI / 2 : 0);
    return [0, Math.PI].map(function (d) {
      return { x: mitte.x + Math.cos(basis + d) * abstand, y: mitte.y + Math.sin(basis + d) * abstand, r: r };
    });
  }

  function phasenWechsel(scene, boss, phase) {
    var k = boss && boss._elaraKampf;
    if (!k || phase < 2 || k.phasenZonen[phase]) return [];
    k.phasenZonen[phase] = true;
    if (k.drehung == null) k.drehung = Math.random() * Math.PI;
    var b = scene.physics && scene.physics.world && scene.physics.world.bounds;
    var orte = zonenOrte(_arenaMitte(scene), b ? b.width : 960, b ? b.height : 640, phase, k.drehung);
    _toast(scene, 'Die Arena verlischt. Bleib aus dem Nebel.', 'The arena is being erased. Stay out of the fog.');
    return orte.map(function (o) { return _zoneAnlegen(scene, boss, o); });
  }

  function _zoneAnlegen(scene, boss, o) {
    var k = boss._elaraKampf;
    var bild = scene.add.graphics().setDepth(34).setName('elaraZone');
    var z = { x: o.x, y: o.y, r: o.r, bild: bild, aktiv: false, uhr: null };
    k.zonen.push(z);
    var start = scene.time.now;
    var vorlauf = scene.time.addEvent({ delay: 30, loop: true, callback: function () {
      var f = Math.min(1, (scene.time.now - start) / ZONEN_VORLAUF_MS);
      bild.clear();
      bild.lineStyle(3, 0xe8e4f0, 0.5 + 0.5 * Math.abs(Math.sin(f * 9)));
      bild.strokeCircle(o.x, o.y, o.r);
      bild.fillStyle(0xd8d4e4, 0.08 + f * 0.25);
      bild.fillCircle(o.x, o.y, o.r * f);
      if (f >= 1) { vorlauf.remove(); _zoneScharf(scene, boss, z); }
    } });
    z.uhr = vorlauf;
    return z;
  }

  // Geloeschter Boden: grauweisser Nebel, der zehrt, solange man drinsteht.
  function _zoneScharf(scene, boss, z) {
    z.aktiv = true;
    var t0 = scene.time.now;
    z.uhr = scene.time.addEvent({ delay: ZONEN_TICK_MS, loop: true, callback: function () {
      if (!boss.active) return;
      var w = (scene.time.now - t0) / 1000;
      z.bild.clear();
      z.bild.fillStyle(0xcfcbd8, 0.42);
      z.bild.fillCircle(z.x, z.y, z.r);
      z.bild.fillStyle(0xf2f0f6, 0.25);
      for (var i = 0; i < 5; i++) {
        var a = w * 0.6 + i * 1.25;
        z.bild.fillCircle(z.x + Math.cos(a) * z.r * 0.5, z.y + Math.sin(a) * z.r * 0.45, z.r * 0.35);
      }
      z.bild.lineStyle(2, 0xffffff, 0.35);
      z.bild.strokeCircle(z.x, z.y, z.r);
      var p = _spieler();
      if (p && p.active && Math.hypot(p.x - z.x, p.y - z.y) <= z.r && typeof applyPlayerDamage === 'function') {
        applyPlayerDamage(Math.max(1, Math.ceil((boss.damage || 4) * ZONEN_SCHADEN)), scene);
      }
    } });
  }

  // ---------------------------------------------------------------------
  // 3. Die Besiegten kehren zurueck
  // ---------------------------------------------------------------------
  function echoArten(flags) {
    var arten = ['kettenmeister', 'zeremonienmeister'];
    if ((flags || {}).nachhall_verklungen) arten.push('nachhall');
    return arten;
  }

  function besiegteRufen(boss) {
    var scene = this;
    var k = boss && boss._elaraKampf;
    if (!k) return [];
    // Hoechstens alle ECHO_PAUSE_MS: als Signatur steht sie ab Phase 3 doppelt im Pool.
    var jetzt = _jetzt(scene);
    if (k.letzteEchos && jetzt - k.letzteEchos < ECHO_PAUSE_MS) return [];
    k.letzteEchos = jetzt;
    k.echos = k.echos.filter(function (e) { return e && e.active; });
    var frei = ECHO_MAX - k.echos.length - (k.echosUnterwegs || 0);
    if (frei <= 0) return [];
    var arten = echoArten(_flags());
    var p = _spieler();
    var gerufen = [];
    for (var i = 0; i < Math.min(frei, 1); i++) {   // eines je Ruf: Echos sind Druck, keine Welle
      var art = arten[(k.echoZaehler = (k.echoZaehler || 0) + 1) % arten.length];
      var w = Math.random() * Math.PI * 2;
      var ex = (p ? p.x : boss.x) + Math.cos(w) * 170, ey = (p ? p.y : boss.y) + Math.sin(w) * 130;
      var b = scene.physics && scene.physics.world && scene.physics.world.bounds;
      if (b) { ex = Math.max(b.x + 60, Math.min(b.x + b.width - 60, ex)); ey = Math.max(b.y + 60, Math.min(b.y + b.height - 60, ey)); }
      if (scene.isPointAccessible && !scene.isPointAccessible(ex, ey)) { ex = boss.x; ey = boss.y + 60; }
      gerufen.push(_echoAnkuendigen(scene, boss, art, ex, ey));
    }
    return gerufen;
  }

  function _echoAnkuendigen(scene, boss, art, x, y) {
    var k = boss._elaraKampf;
    var def = ECHO_ARTEN[art];
    var key = def.prefix + '_right0';
    var hatBild = scene.textures && scene.textures.exists(key);
    k.echosUnterwegs = (k.echosUnterwegs || 0) + 1;
    // Vorlauf: ein grauer Umriss, der sich verdichtet, darueber sein Name.
    var schatten = hatBild ? scene.add.image(x, y, key).setDepth(84).setTint(0x9a9aa8).setAlpha(0).setName('elaraEchoUmriss') : null;
    if (schatten) schatten.setScale(def.hoehe / (schatten.height || 100));
    var ring = scene.add.graphics().setDepth(1001).setName('elaraEchoRing');
    ring.lineStyle(2, 0xc8c8d4, 0.8); ring.strokeCircle(x, y, 44);
    var name = scene.add.text(x, y - def.hoehe * 0.6 - 10, _en() ? def.en : def.de, {
      fontFamily: 'serif', fontStyle: 'italic', fontSize: '14px', color: '#d8d8e4', stroke: '#0b0a10', strokeThickness: 4
    }).setOrigin(0.5).setDepth(1004).setName('elaraEchoName');
    k.texte.push(ring, name);
    if (schatten) { k.texte.push(schatten); scene.tweens.add({ targets: schatten, alpha: 0.55, duration: ECHO_VORLAUF_MS }); }
    var info = { art: art, x: x, y: y, gegner: null };
    scene.time.delayedCall(ECHO_VORLAUF_MS, function () {
      k.echosUnterwegs = Math.max(0, (k.echosUnterwegs || 1) - 1);
      _weg(schatten); _weg(ring);
      scene.tweens.add({ targets: name, alpha: 0, delay: 1400, duration: 600, onComplete: function () { _weg(name); } });
      if (!boss.active || boss.hp <= 0) { _weg(name); return; }
      info.gegner = _echoErzeugen(scene, boss, art, x, y);
    });
    return info;
  }

  function _echoErzeugen(scene, boss, art, x, y) {
    var k = boss._elaraKampf;
    var def = ECHO_ARTEN[art];
    var key = def.prefix + '_right0';
    if (!scene.textures || !scene.textures.exists(key)) key = 'enemyMage';
    var e = enemies.create(x, y, key);
    e.hp = Math.max(4, Math.ceil(boss.maxHp * ECHO_LP));
    e.maxHp = e.hp;
    e.damage = Math.max(1, Math.ceil((boss.damage || 8) * ECHO_SCHADEN));
    e.baseDamage = e.damage;
    e.speed = (boss.speed || 70) * 0.7;
    e.isBoss = false;
    e._elaraEcho = art;
    if (typeof gegnerAufHoeheSkalieren === 'function') gegnerAufHoeheSkalieren(e, def.hoehe);
    if (typeof fitBodyToSprite === 'function') fitBodyToSprite(e);
    // Grau und durchscheinend: ein Echo, nicht der Boss von damals.
    e.setTint(0x8c8c9c);
    e.setAlpha(0.62);
    e.setCollideWorldBounds(true);
    if (e.body && e.body.setPushable) e.body.setPushable(false);
    if (scene._enemyVisionMask && e.setMask) e.setMask(scene._enemyVisionMask);
    k.echos.push(e);
    return e;
  }

  /** Fuer die Vergessenen aus enemy.js: auch sie vergehen mit ihr. */
  function addMerken(boss, e) {
    var k = boss && boss._elaraKampf;
    if (k && e) k.adds.push(e);
  }

  /** Debug (?finale=raub): der naechste Griff kommt gleich, und es gibt etwas zu nehmen. */
  function debugGriffBald(scene, boss, ms) {
    var k = boss && boss._elaraKampf;
    if (!k) return;
    var AS = window.AbilitySystem;
    if (AS && AS.getActiveLoadout) {
      var bel = AS.getActiveLoadout();
      if (!Object.keys(bel).some(function (s) { return bel[s]; })) {
        AS.getAllAbilityDefs().slice(0, 2).forEach(function (d, i) {
          AS.learnAbility(d.id, { silent: true });
          AS.setSlot('slot' + (i + 1), d.id);
        });
      }
    }
    k.naechsterGriff = _jetzt(scene) + (ms || 1500);
  }

  // ---------------------------------------------------------------------
  // Einhaengen: Angriffe und Treffer (enemy.js laedt vor dieser Datei).
  // ---------------------------------------------------------------------
  if (typeof BOSS_ATTACK_MAP !== 'undefined') {
    BOSS_ATTACK_MAP.erinnerungsGriff = erinnerungsGriff;
    BOSS_ATTACK_MAP.besiegteRufen = besiegteRufen;
  }
  // Jeder Treffer des Spielers geht durch dealDamageToEnemy (player.js):
  // Waffe, Faehigkeiten, Geschosse. handleEnemyHit kommt erst danach und sieht
  // die LP schon gesenkt (gemessen: dort zaehlte kein einziger Treffer).
  (function () {
    if (typeof window === 'undefined' || typeof window.dealDamageToEnemy !== 'function') return;
    if (window.dealDamageToEnemy._elaraWrapped) return;
    var orig = window.dealDamageToEnemy;
    window.dealDamageToEnemy = function (scene, enemy) {
      var vor = (enemy && enemy._elaraKampf && typeof enemy.hp === 'number') ? enemy.hp : null;
      var ret = orig.apply(this, arguments);
      if (vor !== null && enemy.hp < vor) { try { treffer(scene, enemy); } catch (e) {} }
      return ret;
    };
    window.dealDamageToEnemy._elaraWrapped = true;
  })();

  var ElaraKampf = {
    GRIFF_ERSTER_MS: GRIFF_ERSTER_MS, GRIFF_TAKT_MS: GRIFF_TAKT_MS, GRIFF_VORLAUF_MS: GRIFF_VORLAUF_MS,
    GRIFF_RADIUS: GRIFF_RADIUS, TREFFER_ZURUECK: TREFFER_ZURUECK, KAPAZITAET_STUFEN: KAPAZITAET_STUFEN,
    ZONEN_VORLAUF_MS: ZONEN_VORLAUF_MS, ECHO_MAX: ECHO_MAX, ECHO_PAUSE_MS: ECHO_PAUSE_MS, ECHO_VORLAUF_MS: ECHO_VORLAUF_MS,
    ZEICHEN_START: ZEICHEN_START, MARA_TAKT_MS: MARA_TAKT_MS, ECHO_ARTEN: ECHO_ARTEN,
    zurueckgewonnen: zurueckgewonnen, kapazitaet: kapazitaet, zurueckgewonnenAusSpiel: zurueckgewonnenAusSpiel,
    werDuWarstGebunden: werDuWarstGebunden, maraHilft: maraHilft, zonenOrte: zonenOrte, echoArten: echoArten,
    gesperrt: gesperrt, allesZurueck: allesZurueck,
    starten: starten, erinnerungsGriff: erinnerungsGriff, nehmen: nehmen, treffer: treffer,
    phasenWechsel: phasenWechsel, besiegteRufen: besiegteRufen, addMerken: addMerken, debugGriffBald: debugGriffBald
  };
  if (typeof window !== 'undefined') window.ElaraKampf = ElaraKampf;
  if (typeof module !== 'undefined' && module.exports) module.exports = ElaraKampf;
})();
