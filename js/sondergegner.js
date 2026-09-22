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
//
// Die Rechnungen (wen heilt er, wie viel, wie hart knallt es) sind reine
// Funktionen und ohne Phaser testbar. Die Ticks werden aus handleEnemies
// (enemy.js) gerufen, der Todesplatzer aus handleEnemyHit (player.js).
(function () {
  'use strict';

  var TYP_GESCHWUER = 11;
  var TYP_PRIESTER = 12;

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
      : typ === TYP_GESCHWUER ? GESCHWUER.maxImRaum : Infinity;
    if (!isFinite(grenze) || !Array.isArray(gegner)) return false;
    var n = 0;
    for (var i = 0; i < gegner.length; i++) {
      if (_lebt(gegner[i]) && gegner[i].enemyType === typ) n++;
    }
    return n >= grenze;
  }

  function istSondertyp(typ) { return typ === TYP_PRIESTER || typ === TYP_GESCHWUER; }

  // ------------------------------------------------------------------- Grafik

  /**
   * Platzhalter, bis die echten Sprites da sind. Liegen 'priester_right0' bzw.
   * 'geschwuer_right0' geladen vor, nimmt spawnEnemy die.
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
    // Aufblaehen: das Geschwuer schwillt an, bevor es platzt.
    try {
      if (scene && scene.tweens) {
        scene.tweens.add({ targets: g, scaleX: g.scaleX * 1.3, scaleY: g.scaleY * 1.3,
          duration: GESCHWUER.zuendMs / 4, yoyo: true, repeat: 1 });
      }
      if (typeof g.setTint === 'function') g.setTint(0xd6f0a0);
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

  window.Sondergegner = {
    TYP_GESCHWUER: TYP_GESCHWUER,
    TYP_PRIESTER: TYP_PRIESTER,
    PRIESTER: PRIESTER,
    GESCHWUER: GESCHWUER,
    heilziele: heilziele,
    heilmenge: heilmenge,
    explosionsSchaden: explosionsSchaden,
    voll: voll,
    istSondertyp: istSondertyp,
    platzhalterTexturen: platzhalterTexturen,
    priesterTick: priesterTick,
    geschwuerTick: geschwuerTick,
    explodieren: explodieren,
    todesPlatzer: todesPlatzer
  };
})();
