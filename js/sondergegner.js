// js/sondergegner.js — Gegner, die eine eigene Antwort verlangen (#12).
//
// Story-Bibel v5, Abschnitt 12: Neue Gegnertypen haben eine Rolle in der
// Geschichte und zwingen den Spieler zu etwas anderem als "mehr Schaden".
//
//   Priester (Typ 12)     Katakomben. Greift nicht an, haelt Abstand und heilt
//                         verwundete Verbuendete. Antwort: ihn zuerst fallen.
//   Nebelgeschwuer (11)   Ritualebene. Kriecht heran, zuendet in Nahdistanz und
//                         platzt; stirbt es, platzt es nach kurzer Warnung
//                         ebenfalls. Antwort: Abstand halten, von weitem toeten.
//   Beschwoerer (13)      Katakomben. Haelt Abstand und ruft Nebelwichte; faellt
//                         er, loesen sie sich auf. Antwort: den Rufer zuerst.
//   Nebelspringer (14)    Katakomben/Ritualebene. Springt hinter den Spieler,
//                         das Ziel kuendigt sich an. Antwort: in Bewegung
//                         bleiben, Flaechenschaden.
//   Kettenhund (15)       Hunde der Kettenwache, jagen nach dem Bruch. Ducken
//                         sich, dann ein Satz auf die Stelle, an der man stand.
//                         Antwort: ausweichen, Kontrolle (Verlangsamen, Betaeuben).
//   Alarmwicht (16)       Keller. Flieht, sobald er den Spieler sieht, und ruft
//                         nach drei Sekunden Verstaerkung. Antwort: nachsetzen.
//
// Die Rechnungen (wen heilt er, wie viel, wie hart knallt es) sind reine
// Funktionen und ohne Phaser testbar. Die Ticks werden aus handleEnemies
// (enemy.js) gerufen, der Todesplatzer aus handleEnemyHit (player.js).
(function () {
  'use strict';

  var TYP_GESCHWUER = 11;
  var TYP_PRIESTER = 12;
  var TYP_BESCHWOERER = 13;
  var TYP_SPRINGER = 14;
  var TYP_HUND = 15;
  var TYP_ALARM = 16;
  var TYP_WICHT = 1;         // was der Beschwoerer ruft (Nebelwicht)

  var PRIESTER = {
    heilTaktMs: 3500,       // alle 3,5 s ein Heilstoss
    heilRadius: 280,        // so weit reicht sein Strahl
    heilAnteil: 0.25,       // ein Viertel der maximalen Lebenspunkte
    maxZiele: 2,            // pro Stoss hoechstens zwei Verbuendete
    maxImRaum: 2            // mehr Priester gleichzeitig spawnen nicht
  };

  var GESCHWUER = {
    zuendRadius: 62,        // so nah muss der Spieler sein, damit es zuendet
    zuendMs: 800,           // Warnzeit vor dem Platzen am Spieler
    todesMs: 450,           // Warnzeit, wenn es getoetet wurde
    radius: 100,            // Reichweite der Explosion
    maxImRaum: 3
  };

  var BESCHWOERER = {
    rufTaktMs: 6000,        // alle 6 s eine Beschwoerung
    rufDauerMs: 1000,       // so lange steht er still und ruft (sichtbar)
    proRuf: 2,              // zwei Wichte je Ruf
    maxLebend: 4,           // hoechstens vier seiner Wichte gleichzeitig
    maxGesamt: 8,           // und acht in seinem ganzen Leben (kein Farmen)
    maxImRaum: 2
  };

  var SPRINGER = {
    taktMs: 4000,           // alle 4 s ein Sprung
    ankuendigungMs: 550,    // so lange zeigt der Nebelwirbel das Ziel an
    minAbstand: 110,        // naeher dran springt er nicht, er schlaegt zu
    maxAbstand: 420,
    hinterDem: 55,          // hoechstens so weit hinter dem Spieler landet er
    schlagNachMs: 350,      // Reaktionsfenster nach der Landung, dann schlaegt er
    maxImRaum: 3
  };

  var HUND = {
    satzMin: 60,            // naeher dran beisst er normal
    satzMax: 170,           // weiter weg rennt er erst heran
    duckMs: 350,            // so lange duckt er sich (die Warnung)
    satzTempo: 520,         // px/s im Satz — dreimal so schnell wie der Spieler
    ueberschuss: 20,        // er springt ein Stueck UEBER die Stelle hinaus
    trefferRadius: 36,      // so nah muss man bei der Landung noch stehen
    erholMs: 700,           // danach steht er still (verwundbar)
    taktMs: 2200,           // hoechstens alle 2,2 s ein Satz
    schadenFaktor: 1.5,
    maxImRaum: 4            // ein Rudel
  };

  var ALARM = {
    sichtweite: 260,        // so nah, und er hat Dich gesehen
    fluchtMs: 3000,         // so lange flieht er, bevor er ruft
    rufMs: 1200,            // so lange ruft er (die letzte Chance)
    verstaerkung: 2,        // so viele kommen
    maxImRaum: 2
  };

  // --------------------------------------------------------------- Bilder

  /**
   * Bild eines Sondergegners setzen: 0 Ruhe, 1 Ansatz, 2 Wirkung. Ohne
   * geliefertes Sprite (Platzhalter) passiert nichts.
   * @param {object} e
   * @param {number} n
   */
  function bild(e, n) {
    if (!e || !e._spritePrefix || typeof e.setTexture !== 'function') return false;
    var key = e._spritePrefix + '_' + (e._spriteDir || 'right') + n;
    try {
      if (e.scene && e.scene.textures && !e.scene.textures.exists(key)) return false;
      e.setTexture(key);
    } catch (x) { return false; }
    return true;
  }

  /** Ansatz zeigen, nach ms die Wirkung, dann zurueck in die Ruhe. */
  function bildFolge(scene, e, ansatzMs, wirkungMs) {
    if (!bild(e, 1)) return;
    e._spriteAktion = true;
    var zurueck = function () {
      if (!e || e.active === false) return;
      bild(e, 0);
      e._spriteAktion = false;
    };
    if (!scene || !scene.time || typeof scene.time.delayedCall !== 'function') { zurueck(); return; }
    scene.time.delayedCall(ansatzMs, function () { if (e && e.active !== false) bild(e, 2); });
    scene.time.delayedCall(ansatzMs + wirkungMs, zurueck);
  }

  /**
   * Ein Standbild halten, ohne jeden Takt setTexture zu rufen.
   *
   * Der Alarmwicht braucht das, weil enemy.js ihn waehrend Flucht und Ruf
   * gar nicht mehr anfasst (alarmTick gibt true zurueck, der Aufrufer kehrt
   * um) — auch den Richtungswechsel nicht. Er dreht sich also selbst.
   */
  function bildHalten(e, n) {
    if (!e) return;
    if (e._bildN === n && e._bildDir === e._spriteDir) return;
    if (!bild(e, n)) return;
    e._bildN = n;
    e._bildDir = e._spriteDir;
  }

  // ---------------------------------------------------------------- Rechnungen

  function _lebt(e) { return !!(e && e.active !== false && typeof e.hp === 'number' && e.hp > 0); }

  /**
   * Wen heilt der Priester? Verwundete Verbuendete in Reichweite, die am
   * schwersten getroffenen zuerst. Nie sich selbst, nie andere Priester (zwei
   * Priester, die sich gegenseitig hochhalten, waeren unbesiegbar), nie Bosse
   * oder Minibosse (ein Viertel ihrer Lebenspunkte wuerde den Kampf umdrehen).
   *
   * @param {object} priester  {x, y}
   * @param {Array<object>} gegner
   * @returns {Array<object>}
   */
  function heilziele(priester, gegner) {
    if (!priester || !Array.isArray(gegner)) return [];
    var r2 = PRIESTER.heilRadius * PRIESTER.heilRadius;
    return gegner.filter(function (e) {
      if (!_lebt(e) || e === priester || e.isPriester || e.isBoss || e.isMiniBoss) return false;
      var max = (typeof e.maxHp === 'number' && e.maxHp > 0) ? e.maxHp : e.hp;
      if (e.hp >= max) return false;
      var dx = e.x - priester.x, dy = e.y - priester.y;
      return dx * dx + dy * dy <= r2;
    }).sort(function (a, b) {
      return (a.hp / (a.maxHp || a.hp)) - (b.hp / (b.maxHp || b.hp));
    }).slice(0, PRIESTER.maxZiele);
  }

  /** Wie viele Lebenspunkte ein Heilstoss zurueckgibt (mindestens 1). */
  function heilmenge(ziel) {
    if (!ziel) return 0;
    var max = (typeof ziel.maxHp === 'number' && ziel.maxHp > 0) ? ziel.maxHp : (ziel.hp || 1);
    var fehlt = Math.max(0, max - (ziel.hp || 0));
    return Math.min(fehlt, Math.max(1, Math.round(max * PRIESTER.heilAnteil)));
  }

  /**
   * Schaden der Explosion. Aus der Gegnerstaerke abgeleitet und gedeckelt:
   * soll spuerbar weh tun (auf Tiefe 20 etwa ein Viertel der Lebenspunkte),
   * aber aus voller Gesundheit nie toeten.
   */
  function explosionsSchaden(geschwuer) {
    var basis = (geschwuer && (geschwuer.baseDamage || geschwuer.damage)) || 3;
    return Math.max(4, Math.min(24, Math.round(basis * 3)));
  }

  /** Ist fuer diesen Typ im Raum schon genug los? (Obergrenze je Raum) */
  function voll(typ, gegner) {
    var grenze = typ === TYP_PRIESTER ? PRIESTER.maxImRaum
      : typ === TYP_GESCHWUER ? GESCHWUER.maxImRaum
      : typ === TYP_BESCHWOERER ? BESCHWOERER.maxImRaum
      : typ === TYP_SPRINGER ? SPRINGER.maxImRaum
      : typ === TYP_HUND ? HUND.maxImRaum
      : typ === TYP_ALARM ? ALARM.maxImRaum : Infinity;
    if (!isFinite(grenze) || !Array.isArray(gegner)) return false;
    var n = 0;
    for (var i = 0; i < gegner.length; i++) {
      if (_lebt(gegner[i]) && gegner[i].enemyType === typ) n++;
    }
    return n >= grenze;
  }

  function istSondertyp(typ) {
    return typ === TYP_PRIESTER || typ === TYP_GESCHWUER
      || typ === TYP_BESCHWOERER || typ === TYP_SPRINGER
      || typ === TYP_HUND || typ === TYP_ALARM;
  }

  /**
   * Wohin setzt der Kettenhund? Auf die Stelle, an der der Spieler beim
   * Ducken stand, ein Stueck darueber hinaus. Ausserhalb des Fensters: nicht.
   * @returns {{x:number,y:number}|null}
   */
  function satzZiel(hund, p) {
    if (!hund || !p) return null;
    var dx = p.x - hund.x, dy = p.y - hund.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < HUND.satzMin || d > HUND.satzMax) return null;
    return { x: p.x + (dx / d) * HUND.ueberschuss, y: p.y + (dy / d) * HUND.ueberschuss };
  }

  /** Schaden des Satzes: anderthalbfacher Biss. */
  function satzSchaden(hund) {
    var basis = (hund && (hund.damage || hund.baseDamage)) || 1;
    return Math.max(1, Math.round(basis * HUND.schadenFaktor));
  }

  /**
   * Wie viele Wichte ruft der Beschwoerer diesmal? Beide Deckel zaehlen:
   * gleichzeitig lebende und alle, die er je gerufen hat.
   * @param {number} lebend  seine Wichte, die gerade leben
   * @param {number} gesamt  alle, die er schon gerufen hat
   */
  function rufAnzahl(lebend, gesamt) {
    var frei = Math.min(BESCHWOERER.maxLebend - (lebend || 0), BESCHWOERER.maxGesamt - (gesamt || 0));
    return Math.max(0, Math.min(BESCHWOERER.proRuf, frei));
  }

  /**
   * Wohin springt der Nebelspringer? Auf die Linie von ihm durch den Spieler,
   * hinter px HINTER den Spieler (Standard hinterDem). Ausserhalb des
   * Abstandsfensters: nirgends.
   * @returns {{x:number,y:number}|null}
   */
  function sprungZiel(springer, p, hinter) {
    var h = (typeof hinter === 'number' && hinter > 0) ? hinter : SPRINGER.hinterDem;
    if (!springer || !p) return null;
    var dx = p.x - springer.x, dy = p.y - springer.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < SPRINGER.minAbstand || d > SPRINGER.maxAbstand) return null;
    return { x: p.x + (dx / d) * h, y: p.y + (dy / d) * h };
  }

  // ------------------------------------------------------------------- Grafik

  /**
   * Gezeichnete Platzhalter. Seit b280 gibt es echte Sprites fuer alle Typen
   * ausser dem Alarmwicht (assets/enemy/<typ>/), und spawnEnemy nimmt die,
   * sobald sie geladen sind. Die Zeichnungen bleiben als Rueckfall, wenn ein
   * Bild fehlt oder nicht laedt.
   */
  function platzhalterTexturen(scene) {
    if (!scene || !scene.textures || !scene.make) return;
    if (!scene.textures.exists('proc_priester')) {
      var g = scene.make.graphics({ add: false });
      // Robe: helles Leinen mit goldenem Saum, spitz zulaufend.
      g.fillStyle(0xe8e2cf, 1);
      g.fillTriangle(20, 12, 4, 50, 36, 50);
      g.fillStyle(0xc8b26a, 1);
      g.fillRect(4, 46, 32, 4);
      g.fillRect(18, 18, 4, 26);           // Stola
      // Kopf unter der Kapuze.
      g.fillStyle(0xb9a98a, 1);
      g.fillCircle(20, 11, 7);
      g.fillStyle(0x2a2420, 1);
      g.fillCircle(20, 13, 4);
      g.generateTexture('proc_priester', 40, 52);
      g.destroy();
    }
    if (!scene.textures.exists('proc_geschwuer')) {
      var h = scene.make.graphics({ add: false });
      // Graugruener, aufgeblaehter Klumpen mit helleren Pusteln.
      h.fillStyle(0x4f5e45, 1);
      h.fillEllipse(22, 26, 40, 32);
      h.fillStyle(0x6f8260, 1);
      h.fillEllipse(18, 20, 22, 16);
      h.fillStyle(0xb7c98f, 1);
      h.fillCircle(12, 22, 4);
      h.fillCircle(28, 16, 3);
      h.fillCircle(30, 30, 5);
      h.fillCircle(17, 33, 3);
      h.generateTexture('proc_geschwuer', 44, 44);
      h.destroy();
    }
    if (!scene.textures.exists('proc_beschwoerer')) {
      var b = scene.make.graphics({ add: false });
      // Dunkle Kultistenrobe mit violett glimmender Kugel in der Hand.
      b.fillStyle(0x2c2238, 1);
      b.fillTriangle(20, 10, 3, 50, 37, 50);
      b.fillStyle(0x4a3a60, 1);
      b.fillRect(3, 46, 34, 4);
      b.fillStyle(0x17121e, 1);
      b.fillCircle(20, 11, 8);             // Kapuze
      b.fillStyle(0xb58cff, 0.45);
      b.fillCircle(33, 28, 8);             // Glimmen
      b.fillStyle(0xe2d0ff, 1);
      b.fillCircle(33, 28, 4);             // Kugel
      b.generateTexture('proc_beschwoerer', 42, 52);
      b.destroy();
    }
    if (!scene.textures.exists('proc_springer')) {
      var s2 = scene.make.graphics({ add: false });
      // Blasse, zerfaserte Gestalt aus Nebel: Umriss, der nach unten ausfranst.
      s2.fillStyle(0x9aa6b8, 0.85);
      s2.fillCircle(18, 10, 7);
      s2.fillTriangle(18, 14, 5, 40, 31, 40);
      s2.fillStyle(0x9aa6b8, 0.5);
      s2.fillTriangle(6, 38, 10, 48, 14, 38);
      s2.fillTriangle(15, 38, 19, 50, 23, 38);
      s2.fillTriangle(24, 38, 28, 47, 31, 38);
      s2.fillStyle(0xd9f2ff, 1);
      s2.fillCircle(15, 10, 1.5);          // Augen
      s2.fillCircle(21, 10, 1.5);
      s2.generateTexture('proc_springer', 36, 52);
      s2.destroy();
    }
    if (!scene.textures.exists('proc_hund')) {
      var d = scene.make.graphics({ add: false });
      // Dunkler, hagerer Hund mit Kettenhalsband, seitlich.
      d.fillStyle(0x3a302a, 1);
      d.fillEllipse(22, 16, 30, 13);        // Rumpf
      d.fillRect(8, 18, 4, 11);             // Beine
      d.fillRect(15, 18, 4, 11);
      d.fillRect(27, 18, 4, 11);
      d.fillRect(33, 18, 4, 11);
      d.fillTriangle(34, 8, 46, 14, 34, 18); // Kopf, Schnauze nach rechts
      d.fillTriangle(35, 9, 37, 2, 40, 10);  // Ohr
      d.fillStyle(0xaab0b8, 1);
      d.fillRect(32, 9, 3, 9);              // Kettenhalsband
      d.fillStyle(0xff5533, 1);
      d.fillCircle(41, 12, 1.5);            // Auge
      d.generateTexture('proc_hund', 48, 30);
      d.destroy();
    }
    if (!scene.textures.exists('proc_alarm')) {
      var a = scene.make.graphics({ add: false });
      // Kleiner, magerer Wicht mit Horn um den Hals.
      a.fillStyle(0x6b4a3a, 1);
      a.fillCircle(14, 10, 7);              // Kopf
      a.fillTriangle(8, 6, 6, 0, 11, 5);    // Hoerner
      a.fillTriangle(20, 6, 22, 0, 17, 5);
      a.fillEllipse(14, 24, 14, 16);        // Leib
      a.fillRect(9, 30, 3, 7);
      a.fillRect(16, 30, 3, 7);
      a.fillStyle(0xd9b25a, 1);
      a.fillTriangle(20, 18, 28, 14, 28, 24); // Horn
      a.fillStyle(0xffe08a, 1);
      a.fillCircle(11, 9, 1.5);
      a.fillCircle(17, 9, 1.5);
      a.generateTexture('proc_alarm', 30, 38);
      a.destroy();
    }
  }

  // Wie die Telegraphen der Minibosse: ueber der Dunkelheit (Tiefe 1001), aber
  // mit der Sichtmaske der Gegner — sonst saehe man sie durch Waende. Auf
  // Tiefe ~80 lagen sie UNTER dem Nebel und blieben unsichtbar.
  function _sichtbar(scene, obj, tiefe) {
    if (!obj) return obj;
    try { obj.setDepth(tiefe || 1001); } catch (e) {}
    try { if (typeof window._sichtMaskeAnlegen === 'function') window._sichtMaskeAnlegen(scene, obj); } catch (e) {}
    return obj;
  }

  function _textSchweben(scene, x, y, text, farbe) {
    if (!scene || !scene.add || typeof scene.add.text !== 'function') return;
    try {
      var t = scene.add.text(x, y, text, {
        fontFamily: 'monospace', fontSize: 14, color: farbe, stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);
      _sichtbar(scene, t, 1002);
      if (scene.tweens) {
        scene.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 700,
          onComplete: function () { try { t.destroy(); } catch (e) {} } });
      } else if (scene.time) {
        scene.time.delayedCall(700, function () { try { t.destroy(); } catch (e) {} });
      }
    } catch (e) { /* nur Anzeige */ }
  }

  function _strahl(scene, von, zu) {
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') return;
    try {
      var g = _sichtbar(scene, scene.add.graphics());
      g.lineStyle(4, 0xf3e7a0, 0.85);
      g.lineBetween(von.x, von.y - 10, zu.x, zu.y);
      g.lineStyle(1, 0xffffff, 1);
      g.lineBetween(von.x, von.y - 10, zu.x, zu.y);
      if (scene.tweens) {
        scene.tweens.add({ targets: g, alpha: 0, duration: 380,
          onComplete: function () { try { g.destroy(); } catch (e) {} } });
      } else if (scene.time) {
        scene.time.delayedCall(380, function () { try { g.destroy(); } catch (e) {} });
      }
    } catch (e) { /* nur Anzeige */ }
  }

  /** Warnkreis am Boden, der sich bis zum Platzen fuellt. */
  function _warnkreis(scene, x, y, dauer) {
    if (!scene || !scene.add || typeof scene.add.circle !== 'function') return null;
    try {
      var rand = _sichtbar(scene, scene.add.circle(x, y, GESCHWUER.radius));
      rand.setStrokeStyle(2, 0xb7c98f, 0.9);
      rand.setFillStyle(0x6f8260, 0.12);
      var kern = _sichtbar(scene, scene.add.circle(x, y, GESCHWUER.radius, 0x9fbf6a, 0.28)).setScale(0.05);
      if (scene.tweens) scene.tweens.add({ targets: kern, scale: 1, duration: dauer });
      return { rand: rand, kern: kern, zu: function () {
        try { rand.destroy(); } catch (e) {}
        try { kern.destroy(); } catch (e) {}
      } };
    } catch (e) { return null; }
  }

  // --------------------------------------------------------------------- Ticks

  function _alleGegner() {
    try {
      if (typeof enemies !== 'undefined' && enemies && typeof enemies.getChildren === 'function') {
        return enemies.getChildren().slice();
      }
    } catch (e) {}
    return [];
  }

  /**
   * Priester: alle heilTaktMs ein Heilstoss auf die schwersten Verwundeten.
   * @returns {Array<object>} die geheilten Gegner (fuer Tests)
   */
  function priesterTick(scene, priester, zeit) {
    if (!_lebt(priester)) return [];
    if (typeof priester._naechsteHeilung !== 'number') {
      priester._naechsteHeilung = zeit + PRIESTER.heilTaktMs * 0.5;
      return [];
    }
    if (zeit < priester._naechsteHeilung) return [];
    var ziele = heilziele(priester, _alleGegner());
    // Niemand verwundet: bald wieder schauen, statt den vollen Takt zu warten.
    if (!ziele.length) { priester._naechsteHeilung = zeit + 400; return []; }
    priester._naechsteHeilung = zeit + PRIESTER.heilTaktMs;
    bildFolge(scene, priester, 220, 500);      // Buch heben, dann das Licht
    ziele.forEach(function (z) {
      var plus = heilmenge(z);
      if (plus <= 0) return;
      z.hp = Math.min(z.maxHp || z.hp + plus, z.hp + plus);
      _strahl(scene, priester, z);
      _textSchweben(scene, z.x, z.y - 24, '+' + plus, '#c8f0a0');
      try { if (typeof drawEnemyHpBar === 'function' && z.hpBar) drawEnemyHpBar(z); } catch (e) {}
    });
    return ziele;
  }

  /**
   * Die Explosion selbst: trifft den Spieler UND andere Gegner im Radius. Ein
   * Geschwuer, das dabei stirbt, platzt nach seiner eigenen Warnzeit — so
   * entstehen Kettenreaktionen, die der Spieler auch fuer sich nutzen kann.
   */
  function explodieren(scene, x, y, schaden, quelle) {
    var r2 = GESCHWUER.radius * GESCHWUER.radius;
    var p = (typeof player !== 'undefined' && player) ? player : window.player;
    var spielerGetroffen = false;
    if (p && p.active !== false && typeof p.x === 'number') {
      var dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy <= r2 && typeof applyPlayerDamage === 'function') {
        try { applyPlayerDamage(schaden, scene); spielerGetroffen = true; } catch (e) {}
      }
    }
    _alleGegner().forEach(function (e) {
      if (!_lebt(e) || e === quelle || e.isBoss) return;
      var ex = e.x - x, ey = e.y - y;
      if (ex * ex + ey * ey > r2) return;
      e.hp -= schaden;
      try {
        if (typeof handleEnemyHit === 'function') handleEnemyHit(scene, e, { tint: 0x9fbf6a, duration: 90 });
      } catch (err) {}
    });
    try {
      if (window.particleFactory && typeof window.particleFactory.deathBurst === 'function') {
        window.particleFactory.deathBurst(x, y);
        if (spielerGetroffen && typeof window.particleFactory.screenShake === 'function') {
          window.particleFactory.screenShake(160, 0.006);
        }
      }
      if (scene && scene.add && typeof scene.add.circle === 'function') {
        var welle = _sichtbar(scene, scene.add.circle(x, y, GESCHWUER.radius * 0.4, 0xb7c98f, 0.5));
        if (scene.tweens) {
          scene.tweens.add({ targets: welle, alpha: 0, scale: 2.5, duration: 260,
            onComplete: function () { try { welle.destroy(); } catch (e) {} } });
        } else if (scene.time) {
          scene.time.delayedCall(260, function () { try { welle.destroy(); } catch (e) {} });
        }
      }
    } catch (e) { /* nur Anzeige */ }
    return spielerGetroffen;
  }

  /**
   * Nebelgeschwuer: zuendet, wenn der Spieler nah genug ist, steht dann still
   * und platzt nach zuendMs. Wer rechtzeitig wegrollt oder weggeht, entkommt.
   *
   * @returns {boolean} true, solange es zuendet (handleEnemies ueberspringt
   *   dann Bewegung und Angriff)
   */
  function geschwuerTick(scene, g, zeit, p) {
    if (!_lebt(g)) return false;
    if (typeof g._zuendetBis === 'number') {
      if (g.body && typeof g.body.setVelocity === 'function') g.body.setVelocity(0, 0);
      if (zeit >= g._zuendetBis) {
        var x = g.x, y = g.y;
        if (g._warnung) { g._warnung.zu(); g._warnung = null; }
        g._explodiert = true;          // kein zweiter Platzer im Todespfad
        explodieren(scene, x, y, explosionsSchaden(g), g);
        g.hp = 0;
        try {
          if (typeof handleEnemyHit === 'function') handleEnemyHit(scene, g, {});
          else g.destroy();
        } catch (e) { try { g.destroy(); } catch (x2) {} }
      }
      return true;
    }
    if (!p || p.active === false) return false;
    var dx = p.x - g.x, dy = p.y - g.y;
    if (dx * dx + dy * dy > GESCHWUER.zuendRadius * GESCHWUER.zuendRadius) return false;
    g._zuendetBis = zeit + GESCHWUER.zuendMs;
    if (g.body && typeof g.body.setVelocity === 'function') g.body.setVelocity(0, 0);
    g._warnung = _warnkreis(scene, g.x, g.y, GESCHWUER.zuendMs);
    // Aufblaehen: das Geschwuer schwillt an, bevor es platzt. Mit Sprite ist
    // das eine eigene Pose, sonst faellt es auf Skalierung und Faerbung zurueck.
    try {
      if (bild(g, 1)) {
        g._spriteAktion = true;
        if (scene && scene.tweens) {
          scene.tweens.add({ targets: g, scaleX: g.scaleX * 1.12, scaleY: g.scaleY * 1.12,
            duration: GESCHWUER.zuendMs / 3, yoyo: true, repeat: 1 });
        }
      } else {
        if (scene && scene.tweens) {
          scene.tweens.add({ targets: g, scaleX: g.scaleX * 1.3, scaleY: g.scaleY * 1.3,
            duration: GESCHWUER.zuendMs / 4, yoyo: true, repeat: 1 });
        }
        if (typeof g.setTint === 'function') g.setTint(0xd6f0a0);
      }
    } catch (e) {}
    return true;
  }

  /**
   * Getoetet: das Geschwuer platzt trotzdem, nach einer kurzen Warnung an der
   * Stelle, wo es lag. Wer es im Nahkampf erschlaegt, muss danach weg.
   */
  function todesPlatzer(scene, g) {
    if (!g || g._explodiert) return false;
    g._explodiert = true;
    // Mitten im Zuenden erschlagen: der alte Warnkreis weicht dem neuen.
    if (g._warnung) { g._warnung.zu(); g._warnung = null; }
    var x = g.x, y = g.y, schaden = explosionsSchaden(g);
    var warn = _warnkreis(scene, x, y, GESCHWUER.todesMs);
    var los = function () {
      if (warn) warn.zu();
      explodieren(scene, x, y, schaden, null);
    };
    if (scene && scene.time && typeof scene.time.delayedCall === 'function') {
      scene.time.delayedCall(GESCHWUER.todesMs, los);
    } else {
      los();
    }
    return true;
  }

  // ------------------------------------------------------------ Beschwoerer

  /** Liegt der Punkt begehbar und frei von Hindernissen? */
  function _frei(scene, x, y) {
    try {
      if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(x, y)) return false;
      if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(x, y)) return false;
    } catch (e) { return false; }
    return true;
  }

  /** n freie Plaetze im Kreis um den Beschwoerer, sonst seine eigene Stelle. */
  function _rufOrte(scene, b, n) {
    var orte = [];
    for (var i = 0; i < n; i++) {
      var ort = null;
      for (var v = 0; v < 8 && !ort; v++) {
        var w = (Math.PI * 2 * (i + v / 8)) / n;
        var x = b.x + Math.cos(w) * 48, y = b.y + Math.sin(w) * 48;
        if (_frei(scene, x, y)) ort = { x: x, y: y };
      }
      orte.push(ort || { x: b.x, y: b.y });
    }
    return orte;
  }

  function _wichtRufen(scene, b, ort) {
    if (typeof spawnEnemy !== 'function') return null;
    var w = null;
    // Ohne Koordinaten erzeugen: spawnEnemy haelt 300 px Abstand zum Spieler
    // und gibt null zurueck, wenn es so nah keinen Platz findet — dann fehlte
    // ein Wicht. Erzeugt wird irgendwo, versetzt wird gleich danach.
    try { w = spawnEnemy.call(scene, 0, 0, TYP_WICHT, { ohneElite: true }); } catch (e) { w = null; }
    if (!w) return null;
    // spawnEnemy schiebt Gegner weg vom Spieler; gerufene erscheinen aber
    // genau dort, wo der Kreis am Boden war.
    try {
      if (w.body && typeof w.body.reset === 'function') w.body.reset(ort.x, ort.y);
      else w.setPosition(ort.x, ort.y);
    } catch (e) {}
    w._beschworenVon = b;
    b._gerufen.push(w);
    b._rufGesamt = (b._rufGesamt || 0) + 1;
    try {
      if (scene.tweens) { w.setAlpha(0); scene.tweens.add({ targets: w, alpha: 1, duration: 300 }); }
    } catch (e) {}
    return w;
  }

  /**
   * Beschwoerer: alle rufTaktMs eine Beschwoerung. Er steht dabei rufDauerMs
   * still (enemy.js haelt Gegner mit _castingUntil an), die Kreise zeigen,
   * wo die Wichte erscheinen. Wird er in der Zeit erschlagen, kommt keiner.
   * @returns {Array<{x,y}>} die Orte, an denen gerufen wird (fuer Tests)
   */
  function beschwoererTick(scene, b, zeit) {
    if (!_lebt(b)) return [];
    if (typeof b._naechsterRuf !== 'number') {
      b._naechsterRuf = zeit + BESCHWOERER.rufTaktMs * 0.4;
      return [];
    }
    if (zeit < b._naechsterRuf) return [];
    b._naechsterRuf = zeit + BESCHWOERER.rufTaktMs;
    b._gerufen = (b._gerufen || []).filter(_lebt);
    var n = rufAnzahl(b._gerufen.length, b._rufGesamt || 0);
    if (!n) return [];
    var orte = _rufOrte(scene, b, n);
    b._castingUntil = zeit + BESCHWOERER.rufDauerMs;
    if (b.body && typeof b.body.setVelocity === 'function') b.body.setVelocity(0, 0);

    var zeichen = [];
    try {
      if (scene && scene.add && typeof scene.add.circle === 'function') {
        var ring = _sichtbar(scene, scene.add.circle(b.x, b.y + 14, 30));
        ring.setStrokeStyle(2, 0xb58cff, 0.9);
        zeichen.push(ring);
        orte.forEach(function (o) {
          var k = _sichtbar(scene, scene.add.circle(o.x, o.y, 16, 0x6a4a9a, 0.35));
          k.setStrokeStyle(2, 0xe2d0ff, 0.9);
          if (scene.tweens) scene.tweens.add({ targets: k, scale: 1.25, duration: 250, yoyo: true, repeat: -1 });
          zeichen.push(k);
        });
      }
      if (!bild(b, 1)) { if (typeof b.setTint === 'function') b.setTint(0xd8b8ff); }
      b._spriteAktion = true;
    } catch (e) {}

    var fertig = function () {
      zeichen.forEach(function (z) { try { z.destroy(); } catch (e) {} });
      try {
        if (b.active) {
          if (!bild(b, 2)) { if (typeof b.clearTint === 'function') b.clearTint(); }
          if (scene && scene.time && typeof scene.time.delayedCall === 'function') {
            scene.time.delayedCall(350, function () {
              if (!b || b.active === false) return;
              bild(b, 0);
              if (typeof b.clearTint === 'function') b.clearTint();
              b._spriteAktion = false;
            });
          } else { bild(b, 0); b._spriteAktion = false; }
        }
      } catch (e) {}
      if (!_lebt(b)) return;
      orte.forEach(function (o) { _wichtRufen(scene, b, o); });
    };
    if (scene && scene.time && typeof scene.time.delayedCall === 'function') {
      scene.time.delayedCall(BESCHWOERER.rufDauerMs, fertig);
    } else {
      fertig();
    }
    return orte;
  }

  /** Faellt der Beschwoerer, loesen sich seine Wichte auf (ohne Beute). */
  function rufAufloesen(scene, b) {
    var weg = 0;
    (b && b._gerufen || []).forEach(function (w) {
      if (!_lebt(w)) return;
      weg++;
      try {
        if (window.particleFactory && typeof window.particleFactory.hitSpark === 'function') {
          window.particleFactory.hitSpark(w.x, w.y);
        }
      } catch (e) {}
      try { w.destroy(); } catch (e) {}
    });
    if (b) b._gerufen = [];
    return weg;
  }

  // ----------------------------------------------------------- Nebelspringer

  function _wirbel(scene, x, y) {
    if (!scene || !scene.add || typeof scene.add.circle !== 'function') return null;
    try {
      var k = _sichtbar(scene, scene.add.circle(x, y, 26, 0x3a4a66, 0.45));
      k.setStrokeStyle(2, 0xd9f2ff, 0.9);
      k.setScale(0.2);
      if (scene.tweens) scene.tweens.add({ targets: k, scale: 1, duration: SPRINGER.ankuendigungMs * 0.8 });
      return k;
    } catch (e) { return null; }
  }

  /**
   * Nebelspringer: alle taktMs ein Sprung hinter den Spieler. Der Wirbel am
   * Ziel kuendigt ihn ankuendigungMs vorher an; wer sich bewegt, steht nicht
   * mehr da, wo er landet. Nach der Landung schlaegt er fast sofort zu.
   *
   * @returns {boolean} true waehrend der Ankuendigung (handleEnemies haelt
   *   ihn dann an)
   */
  function springerTick(scene, s, zeit, p) {
    if (!_lebt(s)) return false;
    if (typeof s._sprungBis === 'number') {
      if (s.body && typeof s.body.setVelocity === 'function') s.body.setVelocity(0, 0);
      if (zeit < s._sprungBis) return true;
      var z = s._sprungZiel;
      if (s._wirbel) { try { s._wirbel.destroy(); } catch (e) {} s._wirbel = null; }
      s._sprungBis = null;
      s._sprungZiel = null;
      s._naechsterSprung = zeit + SPRINGER.taktMs;
      if (z) {
        try {
          if (s.body && typeof s.body.reset === 'function') s.body.reset(z.x, z.y);
          else s.setPosition(z.x, z.y);
        } catch (e) {}
        // Nach der Landung schlaegt er nach schlagNachMs zu, nicht frueher und
        // nicht spaeter: der Nahkampftakt in enemy.js wartet 1500 ms (mal
        // _attackCdMul) seit dem letzten Schlag. Die kurze Pause ist das Fenster,
        // in dem der Spieler auf die Landung reagieren kann.
        var cd = 1500 * ((typeof s._attackCdMul === 'number' && s._attackCdMul > 0) ? s._attackCdMul : 1);
        s.lastAttackTime = zeit - cd + SPRINGER.schlagNachMs;
      }
      try {
        s.setAlpha(0.3);
        if (scene && scene.tweens) scene.tweens.add({ targets: s, alpha: 1, duration: 250 });
        else s.setAlpha(1);
        // Gelandet: die Klauen, dann zurueck in die Ruhe.
        if (bild(s, 2)) {
          if (scene && scene.time && typeof scene.time.delayedCall === 'function') {
            scene.time.delayedCall(SPRINGER.schlagNachMs + 200, function () {
              if (!s || s.active === false) return;
              bild(s, 0);
              s._spriteAktion = false;
            });
          } else { bild(s, 0); s._spriteAktion = false; }
        } else { s._spriteAktion = false; }
      } catch (e) {}
      return false;
    }
    if (typeof s._naechsterSprung !== 'number') {
      s._naechsterSprung = zeit + SPRINGER.taktMs * 0.5;
      return false;
    }
    if (zeit < s._naechsterSprung || !p || p.active === false) return false;
    // In Schlagdistanz landen: enemy.js schlaegt zu, wenn der Abstand unter
    // (Breite Gegner + Breite Spieler) / 1,5 liegt. Landet er weiter weg und
    // steht ein Hindernis im Weg, rutscht er daran entlang und kommt nie an.
    var schlag = ((s.body && s.body.width) || 36) + ((p.body && p.body.width) || 24);
    var ziel = sprungZiel(s, p, Math.min(SPRINGER.hinterDem, (schlag / 1.5) * 0.85));
    if (!ziel || !_frei(scene, ziel.x, ziel.y)) {
      s._naechsterSprung = zeit + 500;          // gleich nochmal schauen
      return false;
    }
    s._sprungZiel = ziel;
    s._sprungBis = zeit + SPRINGER.ankuendigungMs;
    s._wirbel = _wirbel(scene, ziel.x, ziel.y);
    if (bild(s, 1)) s._spriteAktion = true;     // in Nebel gehuellt
    if (!s._wirbelAufraeumen && typeof s.once === 'function') {
      s._wirbelAufraeumen = true;
      s.once('destroy', function () { if (s._wirbel) { try { s._wirbel.destroy(); } catch (e) {} s._wirbel = null; } });
    }
    try { s.setAlpha(0.45); } catch (e) {}
    if (s.body && typeof s.body.setVelocity === 'function') s.body.setVelocity(0, 0);
    return true;
  }

  // ------------------------------------------------------------- Kettenhund

  function _hundLinie(scene, von, zu) {
    if (!scene || !scene.add || typeof scene.add.graphics !== 'function') return null;
    try {
      var g = _sichtbar(scene, scene.add.graphics());
      g.lineStyle(3, 0xff5533, 0.7);
      g.lineBetween(von.x, von.y, zu.x, zu.y);
      g.fillStyle(0xff5533, 0.35);
      g.fillCircle(zu.x, zu.y, HUND.trefferRadius);
      return g;
    } catch (e) { return null; }
  }

  function _sichtlinie(h, p) {
    try {
      if (typeof Steering !== 'undefined' && Steering && typeof Steering.hasLineOfSight === 'function') {
        return Steering.hasLineOfSight(h, p, (typeof obstacles !== 'undefined') ? obstacles : null);
      }
    } catch (e) {}
    return true;
  }

  /**
   * Kettenhund: duckt sich duckMs lang (rote Linie auf die Stelle, an der
   * der Spieler steht), dann ein Satz dorthin — ueber die Ansturm-Maschinerie
   * in enemy.js (_dashTarget). Wer noch da steht, wird gebissen; danach steht
   * der Hund erholMs still und ist verwundbar.
   *
   * @returns {boolean} true, solange er sich duckt
   */
  function hundTick(scene, h, zeit, p) {
    if (!_lebt(h)) return false;
    if (typeof h._duckBis === 'number') {
      if (h.body && typeof h.body.setVelocity === 'function') h.body.setVelocity(0, 0);
      if (zeit < h._duckBis) return true;
      var ziel = h._satzZiel;
      h._duckBis = null;
      h._satzZiel = null;
      if (h._satzLinie) { try { h._satzLinie.destroy(); } catch (e) {} h._satzLinie = null; }
      try {
        if (typeof h.clearTint === 'function') h.clearTint();
        if (h._grundSkala) h.setScale(h._grundSkala);
      } catch (e) {}
      if (!ziel) return false;
      var dist = Math.hypot(ziel.x - h.x, ziel.y - h.y);
      h._dashTarget = ziel;
      h._dashSpeed = HUND.satzTempo;
      h._dashUntil = zeit + Math.max(120, (dist / HUND.satzTempo) * 1000 + 80);
      h._dashGleichmaessig = true;
      h._dashOnArrive = function () {
        // Angekommen: zubeissen, dann zurueck in die Ruhe.
        if (bild(h, 2) && scene && scene.time && typeof scene.time.delayedCall === 'function') {
          scene.time.delayedCall(300, function () {
            if (!h || h.active === false) return;
            bild(h, 0);
            h._spriteAktion = false;
          });
        } else { h._spriteAktion = false; }
        var pl = (typeof player !== 'undefined' && player) ? player : window.player;
        if (_lebt(h) && pl && pl.active !== false
            && Math.hypot(pl.x - h.x, pl.y - h.y) <= HUND.trefferRadius
            && typeof applyPlayerDamage === 'function') {
          try { applyPlayerDamage(satzSchaden(h), scene, h); } catch (e) {}
        }
        var jetzt = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : zeit;
        h._castingUntil = jetzt + HUND.erholMs;     // steht still, verwundbar
        h._naechsterSatz = jetzt + HUND.taktMs;
      };
      return false;
    }
    if (typeof h._naechsterSatz !== 'number') { h._naechsterSatz = zeit + HUND.taktMs * 0.4; return false; }
    if (zeit < h._naechsterSatz || !p || p.active === false) return false;
    var z = satzZiel(h, p);
    if (!z || !_sichtlinie(h, p)) return false;
    // Landet der Ueberschuss in einer Wand, dann genau auf die Stelle.
    if (!_frei(scene, z.x, z.y)) z = { x: p.x, y: p.y };
    h._satzZiel = z;
    h._duckBis = zeit + HUND.duckMs;
    h._naechsterSatz = zeit + HUND.taktMs;
    h._satzLinie = _hundLinie(scene, h, z);
    if (!h._linieAufraeumen && typeof h.once === 'function') {
      h._linieAufraeumen = true;
      h.once('destroy', function () { if (h._satzLinie) { try { h._satzLinie.destroy(); } catch (e) {} h._satzLinie = null; } });
    }
    try {
      if (bild(h, 1)) {
        h._spriteAktion = true;                     // zum Satz angesetzt
      } else {
        h._grundSkala = h.scaleX;
        h.setScale(h.scaleX * 1.1, h.scaleY * 0.8); // geduckt
        if (typeof h.setTint === 'function') h.setTint(0xff8866);
      }
    } catch (e) {}
    if (h.body && typeof h.body.setVelocity === 'function') h.body.setVelocity(0, 0);
    return true;
  }

  // ------------------------------------------------------------- Alarmwicht

  function _ausruf(scene, a) {
    if (!scene || !scene.add || typeof scene.add.text !== 'function') return null;
    try {
      var t = scene.add.text(a.x, a.y - 30, '!', {
        fontFamily: 'monospace', fontSize: 20, color: '#ffd24a', stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);
      _sichtbar(scene, t, 1002);
      return t;
    } catch (e) { return null; }
  }

  function _verstaerkungRufen(scene, a) {
    var neu = [];
    if (typeof spawnEnemy !== 'function') return neu;
    var orte = _rufOrte(scene, a, ALARM.verstaerkung);
    orte.forEach(function (o) {
      var e = null;
      try { e = spawnEnemy.call(scene, 0, 0, undefined, { ohneSonder: true }); } catch (x) { e = null; }
      if (!e) return;
      try {
        if (e.body && typeof e.body.reset === 'function') e.body.reset(o.x, o.y);
        else e.setPosition(o.x, o.y);
        if (scene.tweens) { e.setAlpha(0); scene.tweens.add({ targets: e, alpha: 1, duration: 300 }); }
      } catch (x) {}
      e._verstaerkungVon = a;
      neu.push(e);
    });
    return neu;
  }

  /**
   * Alarmwicht: sieht er den Spieler, flieht er (Ausrufezeichen ueber dem
   * Kopf). Nach fluchtMs bleibt er stehen und ruft rufMs lang — ein
   * wachsender Ring zeigt es. Ist er dann noch am Leben, kommt Verstaerkung.
   * Danach kaempft er wie ein gewoehnlicher Wicht.
   *
   * @returns {boolean} true, solange er flieht oder ruft (enemy.js steuert
   *   ihn dann nicht)
   */
  function alarmTick(scene, a, zeit, p) {
    if (!_lebt(a)) return false;
    if (a._alarm === 'gerufen') { a._spriteAktion = false; bildHalten(a, 0); return false; }
    if (a._alarm === 'ruft') {
      a._spriteAktion = true;                  // er steht und blaest, das Bild bleibt
      bildHalten(a, 2);
      if (a.body && typeof a.body.setVelocity === 'function') a.body.setVelocity(0, 0);
      if (zeit < a._rufBis) return true;
      a._alarm = 'gerufen';
      if (a._rufRing) { try { a._rufRing.destroy(); } catch (e) {} a._rufRing = null; }
      if (a._ausrufText) { try { a._ausrufText.destroy(); } catch (e) {} a._ausrufText = null; }
      a._gerufeneVerstaerkung = _verstaerkungRufen(scene, a);
      return false;
    }
    if (a._alarm === 'flieht') {
      if (a._ausrufText) { try { a._ausrufText.setPosition(a.x, a.y - 30); } catch (e) {} }
      if (zeit - a._fluchtSeit >= ALARM.fluchtMs) {
        a._alarm = 'ruft';
        a._rufBis = zeit + ALARM.rufMs;
        if (a.body && typeof a.body.setVelocity === 'function') a.body.setVelocity(0, 0);
        try {
          if (scene && scene.add && typeof scene.add.circle === 'function') {
            var ring = _sichtbar(scene, scene.add.circle(a.x, a.y, 40));
            ring.setStrokeStyle(3, 0xffd24a, 0.9);
            if (scene.tweens) scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0.2, duration: 400, repeat: -1 });
            a._rufRing = ring;
          }
        } catch (e) {}
        return true;
      }
      // Weg vom Spieler. Waende bremsen ihn — in der Ecke holt man ihn ein.
      if (p && a.body && typeof a.body.setVelocity === 'function') {
        var dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
        var v = a.speed || 125;
        try {
          if (window.statusEffectManager && typeof window.statusEffectManager.getSpeedMultiplier === 'function') {
            v *= window.statusEffectManager.getSpeedMultiplier(a);
          }
        } catch (e) {}
        a.body.setVelocity((dx / d) * v, (dy / d) * v);
        // Er schaut dorthin, wohin er laeuft. Die Schwelle daempft das
        // Flackern, wenn er fast senkrecht vom Spieler weg rennt.
        if (Math.abs(dx) > 12) a._spriteDir = dx > 0 ? 'right' : 'left';
      }
      bildHalten(a, 1);
      return true;
    }
    // Noch ahnungslos: sieht er den Spieler?
    if (!p || p.active === false) return false;
    if (Math.hypot(p.x - a.x, p.y - a.y) > ALARM.sichtweite || !_sichtlinie(a, p)) return false;
    a._alarm = 'flieht';
    a._fluchtSeit = zeit;
    a._ausrufText = _ausruf(scene, a);
    if (!a._alarmAufraeumen && typeof a.once === 'function') {
      a._alarmAufraeumen = true;
      a.once('destroy', function () {
        if (a._ausrufText) { try { a._ausrufText.destroy(); } catch (e) {} a._ausrufText = null; }
        if (a._rufRing) { try { a._rufRing.destroy(); } catch (e) {} a._rufRing = null; }
      });
    }
    return true;
  }

  /**
   * Aus handleEnemyHit (player.js), wenn ein Gegner faellt: was die
   * Sondertypen beim Tod tun.
   */
  function beimTod(scene, e) {
    if (!e) return;
    if (e.isGeschwuer && !e._explodiert) todesPlatzer(scene, e);
    if (e.isBeschwoerer) rufAufloesen(scene, e);
    // Wirbel, Warnlinie, Ausrufezeichen und Rufring raeumen die destroy-Haken
    // der Gegner selbst ab (springerTick, hundTick, alarmTick).
  }

  window.Sondergegner = {
    TYP_GESCHWUER: TYP_GESCHWUER,
    TYP_PRIESTER: TYP_PRIESTER,
    TYP_BESCHWOERER: TYP_BESCHWOERER,
    TYP_SPRINGER: TYP_SPRINGER,
    TYP_HUND: TYP_HUND,
    TYP_ALARM: TYP_ALARM,
    PRIESTER: PRIESTER,
    GESCHWUER: GESCHWUER,
    BESCHWOERER: BESCHWOERER,
    SPRINGER: SPRINGER,
    HUND: HUND,
    ALARM: ALARM,
    satzZiel: satzZiel,
    satzSchaden: satzSchaden,
    hundTick: hundTick,
    alarmTick: alarmTick,
    heilziele: heilziele,
    heilmenge: heilmenge,
    explosionsSchaden: explosionsSchaden,
    rufAnzahl: rufAnzahl,
    sprungZiel: sprungZiel,
    voll: voll,
    istSondertyp: istSondertyp,
    platzhalterTexturen: platzhalterTexturen,
    bild: bild,
    priesterTick: priesterTick,
    geschwuerTick: geschwuerTick,
    beschwoererTick: beschwoererTick,
    springerTick: springerTick,
    rufAufloesen: rufAufloesen,
    explodieren: explodieren,
    todesPlatzer: todesPlatzer,
    beimTod: beimTod
  };
})();
