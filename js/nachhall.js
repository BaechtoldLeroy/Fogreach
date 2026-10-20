/* =====================================================================
 * nachhall.js — der Nachhall, Boss auf Tiefe 25 (Story-Kern v6.1, Stufe 2)
 * ---------------------------------------------------------------------
 * Niemand. Alle verbrannten Erinnerungen, so dicht, dass sie zu einem Wesen
 * verschmolzen sind. Die Kreaturen sind seine Bruchstuecke, er ist das Ganze.
 *
 * Was ihn von den anderen Bossen unterscheidet:
 *   1. Er fluestert. Die Bruchstuecke stammen aus dem, was der Spieler
 *      wirklich gespielt hat: Namen aus Maras Liste (je nach Wahl in
 *      "Reinigung eines Bezirks"), Saetze aus den Gesuchen und aus den
 *      Abschluessen erledigter Auftraege. Wer "Wer du warst" abgeschlossen
 *      hat, hoert einmal die eigene Stimme und erkennt sie sofort.
 *   2. Er wechselt die Gestalt, je eine pro LP-Phase (66 % / 33 %):
 *      der Hall (Ringe, die nachhallen), der Schwarm der Gesichter (schnell,
 *      Spiralen) und der zerstreute Chor (zwei Echos, nur einer ist echt).
 *   3. Seine Bruchstuecke sind Kreaturen des Nebels. Wer sie nicht faellt,
 *      dem kehren sie nach einer Weile in ihn zurueck und heilen ihn.
 * Nach dem Sieg verstummen die Stimmen nicht, sie loesen sich und steigen
 * auf. Ein paar Namen bleiben lesbar am Boden; questSystem merkt sie sich,
 * und Thom druckt sie im Epilog (questFinale.epilog).
 *
 * Reiner Teil (Pool, Gestalt, Restnamen) ist ohne Phaser testbar. Der Rest
 * Der Nachhall der Esse (BOSS_DEFINITIONS.nachhallEsse) ist dasselbe Wesen,
 * groesser und haerter, auf dem frueheren Platz des Schattenrats (Tiefe 30,
 * 60, ...), wann immer dort nicht die besessene Elara wartet.
 * haengt sich an enemy.js: BOSS_DEFINITIONS.nachhall, makeBoss (aufbauen),
 * updateBossPhase (gestaltWechsel), player.js beim Tod (verklingen).
 * ===================================================================== */
(function () {
  'use strict';

  var QUEST_ID = 'was_der_rauch_behaelt';
  var TIEFE = 25;

  // Maras verhaftete Leute (Akt 3, der Maulwurf). Ihretwegen der Auftrag:
  // sie stecken immer im Nachhall.
  var MARAS_LEUTE = ['Wendel Rusk', 'Ilse Brandt', 'Corvin Asch', 'Hedda Lorn'];
  // Die Namen auf der Liste aus "Reinigung eines Bezirks". Wer sie gewarnt
  // hat, trifft spaeter weniger bekannte Gesichter (Story-Kern: Kreaturen):
  // dann ist nur noch einer im Nachhall, der es nicht rechtzeitig schaffte.
  var MARAS_LISTE = ['Oda Kessler', 'Benno Falk', 'Grete Imhof', 'Matthis Rabe', 'Liesl Vogt', 'Anselm Kirch'];

  var TEXTE = {
    de: {
      gesuche: [
        'Wo ist mein Bruder? Er ging zum Markt und kam nicht zurück.',
        'Ich frage nach meiner Tochter. Sie heisst Wenna. Sie ist sieben.',
        'Mein Mann trug die Laterne am Nordtor. Seit dem Neumond nicht mehr.'
      ],
      eigen: 'Nein. Das schmiede ich nicht. Nicht noch einmal.',
      eigenToast: 'Diese Stimme kennst Du. Es ist Deine.',
      gestalt: { hall: 'Der Hall', schwarm: 'Der Schwarm', chor: 'Der Chor' },
      rueckkehr: 'Ein Bruchstück kehrt in den Nachhall zurück.',
      verklungen: 'Die Stimmen verstummen nicht. Sie lösen sich und steigen auf. Ein paar Namen bleiben lesbar zurück.'
    },
    en: {
      gesuche: [
        'Where is my brother? He went to the market and never came back.',
        'I am asking about my daughter. Her name is Wenna. She is seven.',
        'My husband carried the lantern at the north gate. Not since the new moon.'
      ],
      eigen: 'No. I will not forge that. Not again.',
      eigenToast: 'You know this voice. It is yours.',
      gestalt: { hall: 'The Hall', schwarm: 'The Swarm', chor: 'The Chorus' },
      rueckkehr: 'A fragment returns into the Echo.',
      verklungen: 'The voices do not fall silent. They come loose and rise. A few names stay readable.'
    }
  };

  // Je Gestalt: Bildsatz, sichtbare Hoehe (px), Tempo-Faktor, Angriffe.
  // Groesse zwischen Zeremonienmeister (127) und Schattenrat (173).
  var GESTALTEN = {
    hall: { prefix: 'boss_nachhall', hoehe: 150, tempo: 1.0, angriffe: ['echoRing', 'bruchstuecke', 'darkBlast'] },
    schwarm: { prefix: 'boss_nachhall_schwarm', hoehe: 132, tempo: 1.45, angriffe: ['gesichterSchwarm', 'shadowDash', 'bruchstuecke'] },
    chor: { prefix: 'boss_nachhall_chor', hoehe: 124, tempo: 0.9, angriffe: ['chorRuf', 'chorTausch', 'echoRing'] }
  };

  var FLUESTER_MS = 2200;        // Abstand zweier Fluestern
  var EIGEN_ALS = 3;             // die eigene Stimme ist das dritte Fluestern
  var STUECK_RUECKKEHR_MS = 8000; // so lange darf ein Bruchstueck leben
  var STUECK_HEILT = 0.04;        // Anteil der Max-LP je zurueckgekehrtem Stueck
  var REST_NAMEN = 4;             // so viele Namen bleiben hoechstens lesbar

  function _sprache(lang) {
    if (lang === 'en' || lang === 'de') return lang;
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    return (I && typeof I.getLanguage === 'function' && I.getLanguage() === 'en') ? 'en' : 'de';
  }

  /** Erster gut lesbarer Satz eines Abschlusstexts, ohne Regieanweisungen. */
  function satzAus(text) {
    if (!text) return null;
    var rein = String(text).replace(/\([^)]*\)/g, ' ').replace(/["„“«»]/g, '').replace(/\s+/g, ' ').trim();
    var saetze = rein.split(/(?<=[.!?])\s+/);
    for (var i = 0; i < saetze.length; i++) {
      var s = saetze[i].trim();
      if (s.length >= 14 && s.length <= 72) return s;
    }
    return null;
  }

  /**
   * Was der Nachhall fluestern kann. Rein: Flags und die erledigten
   * Auftraege (mit ihrem Abschlusstext) rein, Liste raus.
   * @param {{flags?:object, erledigt?:Array<{id:string,text?:string}>, lang?:string}} e
   * @returns {Array<{text:string, art:'name'|'satz'|'eigen', quelle:string}>}
   */
  function fluesterPool(e) {
    e = e || {};
    var flags = e.flags || {};
    var erledigt = e.erledigt || [];
    var T = TEXTE[_sprache(e.lang)];
    var ids = erledigt.map(function (q) { return q && q.id; });
    var pool = [];
    MARAS_LEUTE.forEach(function (n) { pool.push({ text: n, art: 'name', quelle: 'mara' }); });
    var liste = flags.namen_abgeliefert ? MARAS_LISTE
      : flags.namen_gewarnt ? MARAS_LISTE.slice(0, 1) : [];
    liste.forEach(function (n) { pool.push({ text: n, art: 'name', quelle: 'liste' }); });
    if (ids.indexOf('council_seizure') >= 0) {
      T.gesuche.forEach(function (s) { pool.push({ text: s, art: 'satz', quelle: 'gesuch' }); });
    }
    erledigt.forEach(function (q) {
      if (!q || q.id === QUEST_ID) return;
      var s = satzAus(q.text);
      if (s) pool.push({ text: s, art: 'satz', quelle: 'auftrag:' + q.id });
    });
    // v6.1: Wer Maras Kreidezeichen gelesen hat, hoert sie wieder.
    var K = (typeof window !== 'undefined') ? window.Kreidezeichen : null;
    if (ids.indexOf('mara_kreide') >= 0 && K && typeof K.satzListe === 'function') {
      K.satzListe(flags, e.lang).forEach(function (s) { pool.push({ text: s, art: 'satz', quelle: 'kreide' }); });
    }
    if (ids.indexOf('who_you_were') >= 0 || flags.self_remembered) {
      pool.push({ text: T.eigen, art: 'eigen', quelle: 'eigen' });
    }
    return pool;
  }

  /** Der Pool aus dem laufenden Spielstand. */
  function poolAusSpiel(lang) {
    var qs = (typeof window !== 'undefined') ? window.questSystem : null;
    if (!qs) return fluesterPool({ lang: lang });
    var flags = (typeof qs.getFlags === 'function') ? qs.getFlags() : {};
    var erledigt = (typeof qs.getCompletedQuests === 'function' ? qs.getCompletedQuests() : []).map(function (q) {
      var text = (typeof qs.getQuestField === 'function') ? qs.getQuestField(q, 'dialogueComplete') : q.dialogueComplete;
      return { id: q.id, text: text };
    });
    return fluesterPool({ flags: flags, erledigt: erledigt, lang: lang });
  }

  /** Welche Gestalt gehoert zu dieser Boss-Phase (1..3)? */
  function gestaltFuer(phase) {
    return phase >= 3 ? 'chor' : phase >= 2 ? 'schwarm' : 'hall';
  }

  /**
   * Das naechste Fluestern. Die eigene Stimme kommt genau einmal, als
   * EIGEN_ALS-tes; sonst zufaellig, ohne die letzten drei zu wiederholen.
   * @param {object} d  boss._nachhall
   * @param {function} [zufall]
   * @param {boolean} [ohneEigen] fuer Kraenze und den Sturm: die eigene
   *   Stimme soll einzeln und lesbar kommen, nicht im Gedraenge.
   */
  function naechstes(d, zufall, ohneEigen) {
    var r = zufall || Math.random;
    if (!ohneEigen) d.zaehler = (d.zaehler || 0) + 1;
    var eigen = d.pool.filter(function (p) { return p.art === 'eigen'; })[0];
    if (!ohneEigen && eigen && !d.eigenGesagt && d.zaehler >= EIGEN_ALS) {
      d.eigenGesagt = true;
      return eigen;
    }
    var rest = d.pool.filter(function (p) { return p.art !== 'eigen'; });
    if (!rest.length) return null;
    var letzte = (d.gesagt || []).slice(-3).map(function (g) { return g.text; });
    var frei = rest.filter(function (p) { return letzte.indexOf(p.text) < 0; });
    var aus = frei.length ? frei : rest;
    return aus[Math.floor(r() * aus.length) % aus.length];
  }

  /** Welche Namen nach dem Sieg lesbar bleiben (bis REST_NAMEN). */
  function restNamen(pool, zufall) {
    var r = zufall || Math.random;
    var namen = [];
    (pool || []).forEach(function (p) {
      if (p.art === 'name' && namen.indexOf(p.text) < 0) namen.push(p.text);
    });
    for (var i = namen.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)) % (i + 1);
      var t = namen[i]; namen[i] = namen[j]; namen[j] = t;
    }
    return namen.slice(0, REST_NAMEN);
  }

  /** Wartet der Nachhall? Nur solange sein Auftrag laeuft und offen ist. */
  function wartet() {
    try {
      var qs = window.questSystem;
      if (!qs || typeof qs.getActiveQuests !== 'function') return false;
      var q = (qs.getActiveQuests() || []).filter(function (x) { return x && x.id === QUEST_ID; })[0];
      if (!q) return false;
      return (q.objectives || []).some(function (o) {
        return o.type === 'boss_kill' && o.target === 'nachhall' && o.current < o.required;
      });
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------
  // Ab hier Phaser. Globale aus enemy.js/player.js: player, enemies,
  // spawnEnemy, applyPlayerDamage, bossFireProjectile,
  // gegnerAufHoeheSkalieren, fitBodyToSprite.
  // ---------------------------------------------------------------------

  function _jetzt(scene) {
    return (typeof window.gameNow === 'function') ? window.gameNow(scene) : scene.time.now;
  }

  function _toast(scene, text) {
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(scene, text, 'nachhall');
      }
    } catch (e) {}
  }

  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }

  /** Ein Fluestern sichtbar machen: steigt auf und verblasst. */
  function fluestern(scene, boss, eintrag) {
    var d = boss._nachhall;
    if (!eintrag || !d) return null;
    d.gesagt.push({ text: eintrag.text, art: eintrag.art, quelle: eintrag.quelle });
    var eigen = eintrag.art === 'eigen';
    var stil = {
      fontFamily: 'serif', fontStyle: eigen ? 'bold italic' : 'italic',
      fontSize: eigen ? '17px' : (eintrag.art === 'name' ? '15px' : '13px'),
      color: eigen ? '#ffd166' : (eintrag.art === 'name' ? '#efe2c0' : '#cfc6e6'),
      stroke: '#0b0a10', strokeThickness: eigen ? 4 : 3, align: 'center',
      wordWrap: { width: 240 }
    };
    // Die eigene Stimme unter ihm: oben stuende sie unter dem Hinweis.
    var x = eigen ? boss.x : boss.x + Phaser.Math.Between(-130, 130);
    var y = eigen ? boss.y + 80 : boss.y + Phaser.Math.Between(-110, 40);
    var t = scene.add.text(x, y, eintrag.text, stil).setOrigin(0.5).setDepth(1004).setAlpha(0);
    t.setName(eigen ? 'nachhallEigen' : 'nachhallFluestern');
    d.texte.push(t);
    scene.tweens.add({ targets: t, alpha: eigen ? 1 : 0.9, y: y - 14, duration: 500 });
    scene.tweens.add({
      targets: t, alpha: 0, y: y - 46, delay: eigen ? 3200 : 2000, duration: 900,
      onComplete: function () { _weg(t); }
    });
    if (eigen) _toast(scene, TEXTE[_sprache()].eigenToast);
    return t;
  }

  /** Gestalt anlegen: Bildsatz, Groesse, Koerper, Angriffe. */
  function _gestaltSetzen(scene, boss, name) {
    var g = GESTALTEN[name];
    var d = boss._nachhall;
    if (!g || !d) return;
    d.gestalt = name;
    boss._bossPrefix = g.prefix;
    var dir = boss._bossDirection || 'right';
    var key = g.prefix + '_' + dir + '0';
    if (scene.textures && scene.textures.exists(key)) {
      try { boss.setTexture(key); } catch (e) {}
    }
    if (typeof gegnerAufHoeheSkalieren === 'function') gegnerAufHoeheSkalieren(boss, g.hoehe * (d.groesse || 1));
    if (typeof fitBodyToSprite === 'function') fitBodyToSprite(boss);
    boss.bossAttacks = g.angriffe.slice();
    boss._lastAttack = null;
  }

  /**
   * Beim Spawn (makeBoss): Pool, Hall-Gestalt, Aura, Fluester-Takt.
   * def.scale gibt die Groesse relativ zum Nachhall (der der Esse ist groesser).
   */
  function aufbauen(boss, def) {
    var scene = this;
    var basis = GESTALTEN.hall.hoehe;
    boss._nachhall = {
      groesse: (def && def.scale) ? (96 * def.scale) / basis : 1,
      pool: poolAusSpiel(), gesagt: [], texte: [], stuecke: [], echos: [],
      zaehler: 0, eigenGesagt: false, gestalt: null, bisFluestern: 900
    };
    _gestaltSetzen(scene, boss, 'hall');

    var aura = scene.add.graphics().setDepth((boss.depth || 50) - 1);
    for (var r = 120, a = 0.05; r >= 40; r -= 20, a += 0.04) {
      aura.fillStyle(0xb8acd8, a);
      aura.fillCircle(0, 0, r);
    }
    scene.tweens.add({ targets: aura, alpha: { from: 0.55, to: 1 }, duration: 1300, yoyo: true, repeat: -1 });

    var takt = scene.time.addEvent({ delay: 250, loop: true, callback: function () {
      if (!boss.active) return;
      aura.setPosition(boss.x, boss.y);
      var d = boss._nachhall;
      // Waehrend der Zwischenszene steht er, und er schweigt.
      if (boss._introHaltBis && _jetzt(scene) < boss._introHaltBis) return;
      d.bisFluestern -= 250;
      if (d.bisFluestern <= 0) {
        d.bisFluestern = FLUESTER_MS;
        fluestern(scene, boss, naechstes(d));
      }
      _stueckeHeimholen(scene, boss);
    } });

    boss.on('destroy', function () {
      try { takt.remove(); } catch (e) {}
      _weg(aura);
      var d = boss._nachhall;
      if (!d) return;
      d.texte.forEach(_weg);
      d.stuecke.concat(d.echos).forEach(function (e) { if (e && e.active) _weg(e); });
    });
  }

  /** Phasenwechsel (updateBossPhase): neue Gestalt, Stimmen stieben auf. */
  function gestaltWechsel(scene, boss, phase) {
    var d = boss._nachhall;
    if (!d) return;
    var name = gestaltFuer(phase);
    if (name === d.gestalt) return;
    _gestaltSetzen(scene, boss, name);
    boss.speed = Math.round((boss.speed || 50) * GESTALTEN[name].tempo);
    // Ein Kranz aus Fluestern bricht auf: so sieht man, dass er zerfaellt
    // und sich neu fuegt.
    for (var i = 0; i < 8; i++) {
      var e = naechstes(d, null, true);
      if (!e) continue;
      var w = (i / 8) * Math.PI * 2;
      var t = scene.add.text(boss.x, boss.y, e.text, {
        fontFamily: 'serif', fontStyle: 'italic', fontSize: '12px', color: '#cfc6e6',
        stroke: '#0b0a10', strokeThickness: 3
      }).setOrigin(0.5).setDepth(1004).setAlpha(0.9);
      d.texte.push(t);
      scene.tweens.add({
        targets: t, x: boss.x + Math.cos(w) * 170, y: boss.y + Math.sin(w) * 120, alpha: 0,
        duration: 1100, ease: 'Quad.easeOut', onComplete: (function (o) { return function () { _weg(o); }; })(t)
      });
    }
    if (name === 'chor') _echosRufen(scene, boss);
  }

  function gestaltName(boss) {
    var d = boss && boss._nachhall;
    return TEXTE[_sprache()].gestalt[(d && d.gestalt) || 'hall'];
  }

  // --- Bruchstuecke: Kreaturen des Nebels, die in ihn zurueckkehren --------
  function bruchstuecke(boss) {
    var scene = this;
    var d = boss._nachhall;
    var anzahl = d && d.gestalt === 'schwarm' ? 3 : 2;
    var warn = scene.add.graphics().setDepth(1001);
    warn.fillStyle(0xb8acd8, 0.3);
    warn.fillCircle(boss.x, boss.y, 70);
    scene.time.delayedCall(400, function () { _weg(warn); });
    scene.time.delayedCall(600, function () {
      if (!boss.active || !d) return;
      for (var i = 0; i < anzahl; i++) {
        var e = spawnEnemy.call(scene, boss.x + Phaser.Math.Between(-110, 110), boss.y + Phaser.Math.Between(-110, 110), 5);
        if (!e) continue;
        e.hp = Math.max(4, Math.ceil(boss.maxHp * 0.03));
        e.maxHp = e.hp;
        e._nachhallStueck = true;
        e._rueckkehrUm = _jetzt(scene) + STUECK_RUECKKEHR_MS;
        if (e.setTint) e.setTint(0xc8b8e8);
        if (e.setAlpha) e.setAlpha(0.85);
        d.stuecke.push(e);
      }
    });
  }

  function _stueckeHeimholen(scene, boss) {
    var d = boss._nachhall;
    var jetzt = _jetzt(scene);
    d.stuecke = d.stuecke.filter(function (e) { return e && e.active; });
    d.stuecke.forEach(function (e) {
      if (e._heimweg || jetzt < e._rueckkehrUm) return;
      e._heimweg = true;
      try { if (e.body) e.body.enable = false; } catch (x) {}
      scene.tweens.add({
        targets: e, x: boss.x, y: boss.y, alpha: 0.2, duration: 450,
        onComplete: function () {
          if (e.hpBar) _weg(e.hpBar);
          _weg(e);
          if (!boss.active || boss.hp <= 0) return;
          boss.hp = Math.min(boss.maxHp, boss.hp + Math.ceil(boss.maxHp * STUECK_HEILT));
          d.heimgekehrt = (d.heimgekehrt || 0) + 1;
          if (d.heimgekehrt === 1) _toast(scene, TEXTE[_sprache()].rueckkehr);
        }
      });
    });
  }

  // --- Der Hall: Ringe, die nachhallen ---------------------------------------
  // Drei Ringe laufen nacheinander von ihm weg, jeder schwaecher. Wer im
  // Ring steht, wird getroffen; man weicht durch den Ring hindurch aus.
  function echoRing(boss) {
    var scene = this;
    var cx = boss.x, cy = boss.y;
    var warn = scene.add.graphics().setDepth(1001);
    warn.lineStyle(3, 0xd8ccf0, 0.6);
    warn.strokeCircle(cx, cy, 46);
    scene.time.delayedCall(450, function () { _weg(warn); });
    [0, 520, 1040].forEach(function (verzug, i) {
      scene.time.delayedCall(450 + verzug, function () {
        if (!boss.active) return;
        var g = scene.add.graphics().setDepth(1001);
        var start = scene.time.now, getroffen = false, dauer = 1000;
        var staerke = [0.7, 0.5, 0.35][i];
        var uhr = scene.time.addEvent({ delay: 30, loop: true, callback: function () {
          var p = Math.min(1, (scene.time.now - start) / dauer);
          var r = 40 + p * 360;
          g.clear();
          g.lineStyle(6 - i * 1.5, 0xd8ccf0, 0.85 - p * 0.6);
          g.strokeCircle(cx, cy, r);
          if (!getroffen && player && player.active) {
            var dd = Phaser.Math.Distance.Between(cx, cy, player.x, player.y);
            if (Math.abs(dd - r) < 18) {
              getroffen = true;
              applyPlayerDamage(Math.max(1, Math.ceil(boss.damage * staerke)), scene);
            }
          }
          if (p >= 1 || !boss.active) { uhr.remove(); _weg(g); }
        } });
        boss.once('destroy', function () { try { uhr.remove(); } catch (e) {} _weg(g); });
      });
    });
  }

  // --- Der Schwarm: Gesichter in einer Spirale ------------------------------
  function gesichterSchwarm(boss) {
    var scene = this;
    var basis = Math.random() * Math.PI * 2;
    for (var k = 0; k < 6; k++) {
      (function (k) {
        scene.time.delayedCall(250 + k * 130, function () {
          if (!boss.active) return;
          for (var s = 0; s < 2; s++) {
            var w = basis + k * 0.45 + s * Math.PI;
            bossFireProjectile(scene, boss, w, 170, 14, 0xd8ccf0, Math.max(1, Math.ceil(boss.damage * 0.6)));
          }
        });
      })(k);
    }
  }

  // --- Der Chor: zwei Echos, nur einer ist echt ------------------------------
  function _echosRufen(scene, boss) {
    var d = boss._nachhall;
    d.echos = d.echos.filter(function (e) { return e && e.active; });
    var key = boss.texture && boss.texture.key;
    for (var i = d.echos.length; i < 2; i++) {
      var w = (Math.PI * 2 / 3) * (i + 1);
      var b = scene.physics && scene.physics.world && scene.physics.world.bounds;
      var ex = boss.x + Math.cos(w) * 120, ey = boss.y + Math.sin(w) * 90;
      if (b) {
        ex = Phaser.Math.Clamp(ex, b.x + 40, b.x + b.width - 40);
        ey = Phaser.Math.Clamp(ey, b.y + 40, b.y + b.height - 40);
      }
      var e = enemies.create(ex, ey, key || 'enemyMage');
      e.hp = Math.max(4, Math.ceil(boss.maxHp * 0.06));
      e.maxHp = e.hp;
      e.damage = Math.ceil(boss.damage * 0.3);
      e.baseDamage = e.damage;
      e.speed = boss.speed * 0.7;
      e.isBoss = false;
      e._nachhallEcho = true;
      if (typeof gegnerAufHoeheSkalieren === 'function') gegnerAufHoeheSkalieren(e, GESTALTEN.chor.hoehe * 0.9 * (d.groesse || 1));
      if (typeof fitBodyToSprite === 'function') fitBodyToSprite(e);
      e.setAlpha(0.7);
      e.setCollideWorldBounds(true);
      if (e.body && e.body.setPushable) e.body.setPushable(false);
      if (scene._enemyVisionMask && e.setMask) e.setMask(scene._enemyVisionMask);
      d.echos.push(e);
    }
  }

  function _faecher(scene, quelle, boss) {
    var basis = Math.atan2(player.y - quelle.y, player.x - quelle.x);
    var spreiz = Phaser.Math.DegToRad(22);
    var warn = scene.add.graphics().setDepth(1001);
    warn.lineStyle(2, 0xd8ccf0, 0.6);
    for (var i = -1; i <= 1; i++) {
      var a = basis + i * spreiz;
      warn.lineBetween(quelle.x, quelle.y, quelle.x + Math.cos(a) * 70, quelle.y + Math.sin(a) * 70);
    }
    scene.time.delayedCall(320, function () { _weg(warn); });
    scene.time.delayedCall(380, function () {
      if (!boss.active || !quelle.active) return;
      for (var i = -1; i <= 1; i++) {
        var p = bossFireProjectile(scene, boss, basis + i * spreiz, 190, 12, 0xcfc6e6, Math.max(1, Math.ceil(boss.damage * 0.5)));
        if (p && quelle !== boss) p.setPosition(quelle.x, quelle.y);
      }
    });
  }

  function chorRuf(boss) {
    var scene = this;
    var d = boss._nachhall;
    [boss].concat((d && d.echos) || []).forEach(function (q) {
      if (q && q.active) _faecher(scene, q, boss);
    });
  }

  function chorTausch(boss) {
    var scene = this;
    var d = boss._nachhall;
    var echos = ((d && d.echos) || []).filter(function (e) { return e && e.active; });
    if (!echos.length) { _echosRufen(scene, boss); return; }
    var e = echos[Math.floor(Math.random() * echos.length)];
    boss.setAlpha(0.3);
    e.setAlpha(0.3);
    scene.time.delayedCall(300, function () {
      if (!boss.active) return;
      var bx = boss.x, by = boss.y;
      boss.setPosition(e.x, e.y);
      if (boss.body && boss.body.reset) boss.body.reset(e.x, e.y);
      // Das Echo ist klein, der Nachhall nicht: auf dem Platz des Echos ragte
      // sein Koerper gemessen in 3 von 4 Taeuschen in Wand oder Hindernis.
      if (typeof window.bossFreiStellen === 'function') window.bossFreiStellen(scene, boss, { x: e.x, y: e.y }, 0);
      if (e.active) {
        e.setPosition(bx, by);
        if (e.body && e.body.reset) e.body.reset(bx, by);
        e.setAlpha(0.7);
      }
      boss.setAlpha(1);
      var g = scene.add.graphics().setDepth(1001);
      g.fillStyle(0xd8ccf0, 0.4);
      g.fillCircle(boss.x, boss.y, 56);
      scene.time.delayedCall(200, function () { _weg(g); });
      if (player && player.active && Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y) <= 64) {
        applyPlayerDamage(boss.damage, scene);
      }
    });
  }

  // --- Signatur: der Fluestersturm -------------------------------------------
  // Sechs Bruchstuecke stellen sich um den Spieler und ziehen sich zusammen.
  // Wer in der Mitte bleibt, hoert alle zugleich.
  function fluesterSturm(boss) {
    var scene = this;
    var d = boss._nachhall;
    var tx = player.x, ty = player.y, radius = 105, windup = 1000;
    var worte = [];
    for (var i = 0; i < 6; i++) {
      var e = d ? naechstes(d, null, true) : null;
      var w = (i / 6) * Math.PI * 2;
      var t = scene.add.text(tx + Math.cos(w) * 190, ty + Math.sin(w) * 150, e ? e.text : '...', {
        fontFamily: 'serif', fontStyle: 'italic', fontSize: '12px', color: '#cfc6e6',
        stroke: '#0b0a10', strokeThickness: 3
      }).setOrigin(0.5).setDepth(1004).setAlpha(0.85);
      worte.push(t);
      if (d) d.texte.push(t);
      scene.tweens.add({ targets: t, x: tx + Math.cos(w) * 30, y: ty + Math.sin(w) * 22, duration: windup, ease: 'Quad.easeIn' });
    }
    var warn = scene.add.graphics().setDepth(1000);
    var start = scene.time.now;
    var uhr = scene.time.addEvent({ delay: 30, loop: true, callback: function () {
      var p = Math.min(1, (scene.time.now - start) / windup);
      warn.clear();
      warn.lineStyle(3, 0xd8ccf0, 0.9);
      warn.strokeCircle(tx, ty, radius);
      warn.fillStyle(0x8a7cb8, 0.1 + p * 0.25);
      warn.fillCircle(tx, ty, radius * (0.4 + p * 0.6));
      if (p >= 1) uhr.remove();
    } });
    scene.time.delayedCall(windup, function () {
      try { uhr.remove(); } catch (e) {}
      _weg(warn);
      worte.forEach(_weg);
      if (!boss.active) return;
      var hit = scene.add.graphics().setDepth(1001);
      hit.fillStyle(0xd8ccf0, 0.5);
      hit.fillCircle(tx, ty, radius);
      scene.time.delayedCall(160, function () { _weg(hit); });
      if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(200, 0.01);
      if (player && player.active && Phaser.Math.Distance.Between(tx, ty, player.x, player.y) <= radius) {
        applyPlayerDamage(Math.ceil(boss.damage * 1.8), scene);
      }
    });
  }

  /**
   * Der Nachhall faellt (player.js, nach enemy.destroy()). Die Stimmen
   * loesen sich und steigen auf, ein paar Namen bleiben am Boden lesbar.
   * Merkt sie im Spielstand. Gibt die Namen zurueck.
   */
  function verklingen(scene, boss, zufall) {
    var d = (boss && boss._nachhall) || { pool: poolAusSpiel() };
    var namen = restNamen(d.pool, zufall);
    var qs = window.questSystem;
    try {
      if (qs && typeof qs.setNachhallNamen === 'function') qs.setNachhallNamen(namen);
      if (qs && typeof qs.setFlag === 'function') qs.setFlag('nachhall_verklungen', true);
    } catch (e) {}
    if (!scene || !scene.add) return namen;
    var x = boss ? boss.x : 0, y = boss ? boss.y : 0;
    var stimmen = d.pool.filter(function (p) { return p.art !== 'eigen'; });
    for (var i = 0; i < Math.min(14, stimmen.length * 2); i++) {
      (function (i) {
        var s = stimmen[i % stimmen.length];
        var t = scene.add.text(x + Phaser.Math.Between(-90, 90), y + Phaser.Math.Between(-40, 40), s.text, {
          fontFamily: 'serif', fontStyle: 'italic', fontSize: '12px', color: '#d8d0ec',
          stroke: '#0b0a10', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1004).setAlpha(0).setName('nachhallAufstieg');
        scene.tweens.add({
          targets: t, alpha: { from: 0, to: 0.9 }, y: t.y - 280, delay: i * 160, duration: 2600,
          onComplete: function () { _weg(t); }
        });
        scene.tweens.add({ targets: t, alpha: 0, delay: i * 160 + 1700, duration: 900 });
      })(i);
    }
    // Die Namen am Boden, wie in Stein geritzt: nebeneinander, versetzt in
    // zwei Reihen, damit lange Namen nicht ineinanderlaufen.
    namen.forEach(function (n, k) {
      var t = scene.add.text(x + (k - (namen.length - 1) / 2) * 125, y + 34 + (k % 2) * 24, n, {
        fontFamily: 'serif', fontStyle: 'bold', fontSize: '15px', color: '#efe2c0',
        stroke: '#1a1408', strokeThickness: 3
      }).setOrigin(0.5).setDepth(60).setAlpha(0).setName('nachhallName');
      scene.tweens.add({ targets: t, alpha: 1, delay: 1400 + k * 300, duration: 900 });
      scene.time.delayedCall(25000, function () {
        if (t.scene) scene.tweens.add({ targets: t, alpha: 0, duration: 1500, onComplete: function () { _weg(t); } });
      });
    });
    _toast(scene, TEXTE[_sprache()].verklungen);
    return namen;
  }

  // In die Angriffstabelle von enemy.js einhaengen (laedt vor dieser Datei).
  if (typeof BOSS_ATTACK_MAP !== 'undefined') {
    BOSS_ATTACK_MAP.echoRing = echoRing;
    BOSS_ATTACK_MAP.bruchstuecke = bruchstuecke;
    BOSS_ATTACK_MAP.gesichterSchwarm = gesichterSchwarm;
    BOSS_ATTACK_MAP.chorRuf = chorRuf;
    BOSS_ATTACK_MAP.chorTausch = chorTausch;
    BOSS_ATTACK_MAP.fluesterSturm = fluesterSturm;
  }

  var Nachhall = {
    QUEST_ID: QUEST_ID, TIEFE: TIEFE, MARAS_LEUTE: MARAS_LEUTE, MARAS_LISTE: MARAS_LISTE,
    GESTALTEN: GESTALTEN, TEXTE: TEXTE, EIGEN_ALS: EIGEN_ALS, FLUESTER_MS: FLUESTER_MS,
    STUECK_RUECKKEHR_MS: STUECK_RUECKKEHR_MS, STUECK_HEILT: STUECK_HEILT, REST_NAMEN: REST_NAMEN,
    satzAus: satzAus, fluesterPool: fluesterPool, poolAusSpiel: poolAusSpiel,
    gestaltFuer: gestaltFuer, naechstes: naechstes, restNamen: restNamen, wartet: wartet,
    aufbauen: aufbauen, gestaltWechsel: gestaltWechsel, gestaltName: gestaltName,
    fluestern: fluestern, verklingen: verklingen,
    angriffe: { echoRing: echoRing, bruchstuecke: bruchstuecke, gesichterSchwarm: gesichterSchwarm,
      chorRuf: chorRuf, chorTausch: chorTausch, fluesterSturm: fluesterSturm }
  };
  if (typeof window !== 'undefined') window.Nachhall = Nachhall;
  if (typeof module !== 'undefined' && module.exports) module.exports = Nachhall;
})();
