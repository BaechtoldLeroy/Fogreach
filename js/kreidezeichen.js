/* =====================================================================
 * kreidezeichen.js — "Kreide an der Zellenwand" (Mara, Story v6.1)
 * ---------------------------------------------------------------------
 * Maras verhaftete Leute sassen unten in Zellen. Wer eingesperrt wird,
 * schreibt an die Wand, was er weiss: mit Kreide, klein, unten am Stein.
 *
 * Solange der Auftrag mara_kreide laeuft (und seine Tiefe erreicht ist),
 * steht in manchen Raeumen hoechstens EIN Zeichen, abseits des Wegs
 * (HiddenFinds.waehleAbseits). Lesen meldet observe:kreidezeichen; der Text
 * folgt der Reihenfolge des Lesens. Wer Maras Liste gewarnt hat
 * (namen_gewarnt), liest beim zweiten Zeichen den Namen der einen, die es
 * nicht rechtzeitig fort schaffte (nachhall.js: MARAS_LISTE[0]).
 *
 * Nach dem Auftrag fluestert der Nachhall die Saetze mit (satzListe).
 * ===================================================================== */
(function () {
  'use strict';

  var QUEST_ID = 'mara_kreide';
  var ZIEL = 'kreidezeichen';
  // Hoechstens ein Zeichen je Raum, und nicht in jedem: es soll ein Fund
  // bleiben, kein Pflichtgang. Drei braucht der Auftrag.
  var CHANCE = 0.5;
  var TEX = 'evt_kreide';

  var TEXTE = {
    de: {
      label: 'Kreidezeichen',
      weiter: 'Weiter',
      kopf: '(Unten am Stein, klein, in Kreide:)',
      saetze: [
        'Der Treffpunkt war verraten. Nur sieben wussten ihn.',
        'Sie kamen, bevor wir losgingen. Sie kannten den Weg besser als wir.',
        'Wer das liest: Wir haben nichts gesagt. Wir sind nicht die, die geredet haben.'
      ],
      // namen_gewarnt: die eine von der Liste, die es nicht schaffte.
      gewarnt: 'Ich war gewarnt und bin trotzdem nicht rechtzeitig fort. {name}.'
    },
    en: {
      label: 'Chalk Mark',
      weiter: 'Continue',
      kopf: '(Low on the stone, small, in chalk:)',
      saetze: [
        'The meeting place was betrayed. Only seven knew it.',
        'They came before we set out. They knew the way better than we did.',
        'Whoever reads this: we said nothing. We are not the ones who talked.'
      ],
      gewarnt: 'I was warned and still did not get away in time. {name}.'
    }
  };

  function _sprache(lang) {
    if (lang === 'en' || lang === 'de') return lang;
    var I = window.i18n;
    return (I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en') ? 'en' : 'de';
  }

  /** Der Name der einen, die es nicht schaffte (Maras Liste, erster Eintrag). */
  function _gewarnteName() {
    var N = window.Nachhall;
    return (N && Array.isArray(N.MARAS_LISTE) && N.MARAS_LISTE[0]) || 'Oda Kessler';
  }

  /**
   * Der Satz des n-ten gelesenen Zeichens (0, 1, 2). Rein.
   * @param {number} n
   * @param {object} [flags]
   * @param {string} [lang]
   */
  function satz(n, flags, lang) {
    var T = TEXTE[_sprache(lang)];
    var i = Math.max(0, Math.min(T.saetze.length - 1, n | 0));
    if (i === 1 && flags && flags.namen_gewarnt) return T.gewarnt.replace('{name}', _gewarnteName());
    return T.saetze[i];
  }

  /** Alle Saetze, wie sie gelesen wurden (fuer den Nachhall). Rein. */
  function satzListe(flags, lang) {
    var out = [];
    for (var i = 0; i < TEXTE.de.saetze.length; i++) out.push(satz(i, flags, lang));
    return out;
  }

  function _ziel() {
    var qs = window.questSystem;
    if (!qs || typeof qs.getActiveQuests !== 'function') return null;
    var q = (qs.getActiveQuests() || []).filter(function (x) { return x && x.id === QUEST_ID; })[0];
    if (!q) return null;
    return (q.objectives || []).filter(function (o) { return o && o.type === 'observe' && o.target === ZIEL; })[0] || null;
  }

  /** Steht gerade ein Zeichen an? Auftrag laeuft, Ziel offen, Tiefe erreicht. */
  function laeuft() {
    try {
      var o = _ziel();
      if (!o || o.current >= o.required) return false;
      var qs = window.questSystem;
      if (typeof qs.tiefeErreicht === 'function' && !qs.tiefeErreicht(QUEST_ID)) return false;
      return true;
    } catch (e) { return false; }
  }

  /** Ein Stein mit Kreidestrichen, wie die anderen Ereignisbilder 32x32. */
  function _textur(scene) {
    if (!scene || !scene.textures || scene.textures.exists(TEX) || !scene.make) return;
    var g = scene.make.graphics({ add: false });
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 28.5, 26, 6);
    g.fillStyle(0x15131a, 1); g.fillRect(4, 8, 24, 20);          // Umriss
    g.fillStyle(0x4a4553, 1); g.fillRect(5, 9, 22, 18);          // Stein
    g.fillStyle(0x625c6e, 1); g.fillRect(5, 9, 22, 2);           // Lichtkante
    g.fillStyle(0x34303c, 1); g.fillRect(5, 25, 22, 2);          // Schattenfuss
    g.fillStyle(0x3a3644, 1); g.fillRect(15, 11, 1, 6);          // Fuge
    // Kreide: Strichliste und eine kurze Zeile
    g.fillStyle(0xeae6da, 0.95);
    [8, 10, 12, 14].forEach(function (x) { g.fillRect(x, 15, 1, 6); });
    g.fillRect(7, 17, 9, 1);
    g.fillRect(18, 15, 6, 1); g.fillRect(18, 18, 7, 1); g.fillRect(18, 21, 4, 1);
    g.fillStyle(0xffffff, 0.35); g.fillRect(9, 15, 1, 1); g.fillRect(19, 15, 1, 1);
    g.generateTexture(TEX, 32, 32);
    g.destroy();
  }

  /** Das Zeichen lesen: Fortschritt melden, dann den Satz zeigen. */
  function lesen(scene) {
    var o = _ziel();
    var n = o ? (o.current | 0) : 0;
    var qs = window.questSystem;
    var flags = (qs && typeof qs.getFlags === 'function') ? qs.getFlags() : {};
    var T = TEXTE[_sprache()];
    var text = T.kopf + '\n\n"' + satz(n, flags) + '"';
    try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
    if (qs && typeof qs.updateQuestProgress === 'function') qs.updateQuestProgress('observe', ZIEL, 1);
    var ES = window.EventSystem;
    if (ES && typeof ES.showEventChoiceDialog === 'function') {
      try { ES.showEventChoiceDialog(scene, text, [{ label: T.weiter, callback: function () {} }]); } catch (e) {}
    }
    return text;
  }

  /**
   * Stellt im neuen Raum vielleicht ein Zeichen hin. Bricht nie den Raumaufbau.
   * @param {object} scene
   * @param {object} [opts] { erzwingen: true } ueberspringt den Wurf
   * @returns {{x:number,y:number}|null} der Platz oder null
   */
  function vielleichtSpawnen(scene, opts) {
    try {
      if (!laeuft()) return null;
      // Debug ?kreide=1: in jedem Raum ein Zeichen (zum Testen des Auftrags).
      var erzwungen = (opts && opts.erzwingen) || !!(window.DebugGate && window.DebugGate.an('kreide'));
      if (!erzwungen && Math.random() >= Kreidezeichen.CHANCE) return null;
      var ES = window.EventSystem, HF = window.HiddenFinds;
      if (!scene || !ES || typeof ES.spawnEventObject !== 'function') return null;
      if (typeof player === 'undefined' || !player) return null;
      var platz = null;
      if (HF && typeof HF.waehleAbseits === 'function' && typeof scene.pickAccessibleSpawnPoint === 'function') {
        var ausgang = null;
        if (scene.stairsGroup && typeof scene.stairsGroup.getChildren === 'function') {
          var st = scene.stairsGroup.getChildren().filter(function (s) { return s && s.active; })[0];
          if (st) ausgang = { x: st.x, y: st.y };
        }
        var kandidaten = [];
        for (var i = 0; i < 40; i++) {
          var p = scene.pickAccessibleSpawnPoint({ maxAttempts: 8 });
          if (!p) continue;
          if (typeof window.isSpawnPositionBlocked === 'function' && window.isSpawnPositionBlocked(p.x, p.y, 20)) continue;
          if (typeof window.isNearStair === 'function' && window.isNearStair(scene, p.x, p.y, 60)) continue;
          kandidaten.push(p);
        }
        if (ausgang) {
          // Den zweitbesten Platz: den besten nimmt oft schon der verborgene Fund.
          var plaetze = HF.waehleAbseits(kandidaten, { x: player.x, y: player.y }, ausgang, 2);
          platz = plaetze[plaetze.length - 1] || null;
        }
        if (!platz) platz = kandidaten[0] || null;
      }
      _textur(scene);
      var T = TEXTE[_sprache()];
      ES.spawnEventObject(scene, TEX, 0x4a4553, 0xeae6da, T.label, function () { lesen(scene); },
        platz ? { spawnAt: platz } : undefined);
      return platz || { x: NaN, y: NaN };
    } catch (e) { return null; }
  }

  var Kreidezeichen = {
    QUEST_ID: QUEST_ID,
    ZIEL: ZIEL,
    CHANCE: CHANCE,
    TEX: TEX,
    TEXTE: TEXTE,
    satz: satz,
    satzListe: satzListe,
    laeuft: laeuft,
    lesen: lesen,
    vielleichtSpawnen: vielleichtSpawnen
  };
  window.Kreidezeichen = Kreidezeichen;
})();
