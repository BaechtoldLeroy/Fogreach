/* =====================================================================
 * bossIntro.js — der Auftritt eines benannten Bosses (#77)
 * ---------------------------------------------------------------------
 * Bis hierher bestand der Auftritt aus einem Blitz, einem Ruckeln und zwei
 * Textzeilen, die ueber dem schon losstuermenden Boss einblendeten. Der
 * Spieler las die Zeile, waehrend er auswich — die Inszenierung fand
 * gleichzeitig mit dem Kampf statt und ging darin unter.
 *
 * Der Vorkampf-Beat trennt beides: das Spiel haelt an, die Kamera geht auf
 * den Boss, Name und Zeile bekommen Raum — und der Kampf beginnt erst, wenn
 * der Spieler BESTAETIGT (Leertaste oder Tippen). Eine feste Lesezeit ist
 * entweder zu kurz zum Lesen oder zu lang zum Wiedersehen; die Entscheidung
 * gehoert dem Spieler.
 *
 * NUR fuer die inszenierte Begegnung (Kettenmeister mit aktiver Quest). Jeder
 * andere Boss behaelt den bisherigen Banner — ein Beat, den man beim Grinden
 * zum fuenften Mal sieht, ist kein Beat mehr, sondern eine Wartezeit.
 *
 * ---------------------------------------------------------------------
 * WARUM DIE SEQUENZ AUF ECHTER ZEIT LAEUFT
 *
 * Der erste Entwurf verkettete die Schritte ueber `onComplete` der Tweens.
 * Am laufenden Spiel gemessen: nach 5,3 s stand alles noch — Spiel pausiert,
 * Kamera herangefahren, Gegner unbeweglich. Ein Tween erreichte 99 % und
 * feuerte sein `onComplete` nie; mit angehaltener Spieluhr sogar nur 50 %.
 *
 * Der Ablauf haengt deshalb an `setTimeout`. Das laeuft unabhaengig von
 * Spieluhr, Physik und Bildrate: klemmt die Optik, klemmt trotzdem nicht das
 * Spiel. Tweens sind nur noch Zierde — was sie nicht schaffen, kostet
 * Aussehen, nicht Spielbarkeit. Der Notausgang bleibt als zweite Sicherung.
 * ===================================================================== */
(function () {
  'use strict';

  var BALKEN_MS = 320;      // Letterbox faehrt ein
  var NAME_MS = 420;        // Name skaliert herunter
  var ZEILE_AB = 520;       // Verzoegerung der Lore-Zeile
  var AUSBLENDEN_MS = 420;
  // Erst nach dieser Frist zaehlt eine Eingabe. Ohne sie beendet der Tastendruck
  // oder Tipp, der noch vom Kampf davor in der Luft liegt, den Beat sofort —
  // dasselbe Problem und dieselbe Loesung wie beim Faehigkeiten-Hinweis
  // (abilitySystem, 150 ms).
  var EINGABE_AB = 300;
  // Notausgang. KEINE Lesezeit-Obergrenze — der Spieler darf sich Zeit lassen.
  // Das hier ist der Fall "Eingabe kommt gar nicht an": dann lieber ohne
  // Inszenierung weiterspielen als in einem toten Spiel stehen.
  var NOTAUSGANG_MS = 60000;

  function _weg(o) { if (o) { try { o.destroy(); } catch (e) {} } }

  /**
   * Spielt den Vorkampf-Beat.
   *
   * @param {Phaser.Scene} scene
   * @param {object} boss    das Boss-Sprite (wird waehrenddessen stillgelegt)
   * @param {string} name    Boss-Name (gross)
   * @param {string} zeile   Lore-Zeile darunter
   * @returns {boolean} ob der Beat laeuft; false = Aufrufer zeigt den Banner
   */
  function inszeniere(scene, boss, name, zeile) {
    if (!scene || !scene.add || !scene.tweens || !scene.scale) return false;
    if (scene.__bossIntroLaeuft) return false;   // nie zwei gleichzeitig
    scene.__bossIntroLaeuft = true;

    // Tempo-Faktor auf ALLE Fristen. Regelt im Spiel nichts (1), erlaubt dem
    // Test aber, die Sequenz in Millisekunden statt in Sekunden durchlaufen zu
    // lassen — sonst waere der Ablauf nur behauptet, nicht geprueft.
    var f = BossIntro._TEMPO > 0 ? BossIntro._TEMPO : 1;
    var frist = function (ms) { return Math.max(1, Math.round(ms * f)); };

    var b = scene.scale.width, h = scene.scale.height;
    var kam = scene.cameras && scene.cameras.main;
    var zoomVorher = (kam && typeof kam.zoom === 'number') ? kam.zoom : 1;
    // Die verfolgte Figur JETZT festhalten statt beim Aufraeumen erneut aus
    // window.player zu lesen: die Kamera soll dem folgen, dem sie vorher folgte.
    var figur = (typeof window !== 'undefined') ? window.player : null;
    var balkenH = Math.round(h * 0.14);
    var teile = [];
    var uhren = [];
    var beendet = false;
    var abmelden = [];                       // Eingabe-Handler zum Loesen
    var choiceVorher = (typeof window !== 'undefined') ? window.eventChoiceOpen : undefined;

    function spaeter(ms, fn) { uhren.push(setTimeout(fn, frist(ms))); }
    function tween(cfg) { try { scene.tweens.add(cfg); } catch (e) { /* Zierde */ } }

    // Der Boss steht still, solange der Beat laeuft. handleBossAI prueft die
    // Marke; `active` anzufassen waere gefaehrlich, daran haengen Treffer-
    // erkennung und die Klimax-Logik (#109).
    if (boss) {
      try {
        boss._introHaltBis = Number.MAX_SAFE_INTEGER;
        if (boss.body && boss.body.setVelocity) boss.body.setVelocity(0, 0);
      } catch (e) {}
    }

    function aufraeumen() {
      if (beendet) return;
      beendet = true;
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      uhren.length = 0;
      abmelden.forEach(function (f) { try { f(); } catch (e) {} });
      abmelden.length = 0;
      // Kampfeingabe wieder freigeben (Wert von vorher, nicht hart auf false:
      // theoretisch koennte ein Ereignis-Dialog darunter liegen).
      try { if (typeof window !== 'undefined') window.eventChoiceOpen = choiceVorher; } catch (e) {}
      teile.forEach(_weg);
      teile.length = 0;
      if (boss) { try { boss._introHaltBis = 0; } catch (e) {} }
      if (kam) {
        try {
          // Hart zuruecksetzen statt auf den Rueckweg-Tween zu vertrauen: der
          // ist genau das, was im Notausgang-Fall nicht angekommen ist.
          if (kam.zoom !== zoomVorher && typeof kam.setZoom === 'function') kam.setZoom(zoomVorher);
          if (figur && typeof kam.startFollow === 'function') {
            kam.startFollow(figur, true, 0.12, 0.12);
          }
        } catch (e) {}
      }
      try {
        if (typeof window !== 'undefined' && typeof window.resumeGameClock === 'function') {
          window.resumeGameClock(scene);
        }
      } catch (e) {}
      scene.__bossIntroLaeuft = false;
    }

    // Ab hier steht das Spiel. eventChoiceOpen unterdrueckt zusaetzlich die
    // Kampfeingabe (inputScheme.shouldSuppressCombatInput) — sonst schwingt die
    // bestaetigende Leertaste gleich noch das Schwert.
    try {
      if (typeof window !== 'undefined') window.eventChoiceOpen = true;
      if (typeof window !== 'undefined' && typeof window.pauseGameClock === 'function') {
        window.pauseGameClock(scene);
      }
    } catch (e) {}
    // Zweite Sicherung, falls oben etwas nicht ankommt. Frist ueber das
    // Modul-Objekt, damit der Test sie wirklich ausloesen kann.
    uhren.push(setTimeout(aufraeumen, BossIntro._NOTAUSGANG_MS));

    // --- Letterbox ---------------------------------------------------------
    var oben = scene.add.rectangle(b / 2, -balkenH / 2, b, balkenH, 0x05060a, 1)
      .setScrollFactor(0).setDepth(1098);
    var unten = scene.add.rectangle(b / 2, h + balkenH / 2, b, balkenH, 0x05060a, 1)
      .setScrollFactor(0).setDepth(1098);
    teile.push(oben, unten);
    tween({ targets: oben, y: balkenH / 2, duration: BALKEN_MS, ease: 'Quad.easeOut' });
    tween({ targets: unten, y: h - balkenH / 2, duration: BALKEN_MS, ease: 'Quad.easeOut' });

    // --- Kamera auf den Boss ----------------------------------------------
    if (kam) {
      try {
        if (typeof kam.stopFollow === 'function') kam.stopFollow();
        if (boss && typeof kam.pan === 'function'
            && typeof boss.x === 'number' && typeof boss.y === 'number') {
          kam.pan(boss.x, boss.y, 700, 'Quad.easeInOut');
        }
        if (typeof kam.zoomTo === 'function') kam.zoomTo(zoomVorher * 1.22, 700, 'Quad.easeInOut');
      } catch (e) { /* Kamera ist Zierde, nie Bedingung */ }
    }

    // --- Name gross, Zeile darunter ---------------------------------------
    var cx = b / 2, cy = h * 0.42;
    var nameTxt = scene.add.text(cx, cy - 26, String(name || ''), {
      fontSize: '40px', fontFamily: 'serif', color: '#ff5a5a', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6, align: 'center'
    }).setOrigin(0.5).setDepth(1101).setScrollFactor(0).setAlpha(0).setScale(1.5);
    var zeileTxt = scene.add.text(cx, cy + 26, String(zeile || ''), {
      fontSize: '17px', fontFamily: 'monospace', color: '#e8e2d6',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: Math.min(680, b - 80) }
    }).setOrigin(0.5, 0).setDepth(1101).setScrollFactor(0).setAlpha(0);
    teile.push(nameTxt, zeileTxt);

    tween({ targets: nameTxt, alpha: 1, scale: 1, duration: NAME_MS, ease: 'Back.easeOut' });
    spaeter(ZEILE_AB, function () {
      tween({ targets: zeileTxt, alpha: 1, duration: NAME_MS, ease: 'Quad.easeOut' });
    });

    // --- Aufforderung zu bestaetigen ---------------------------------------
    var mobil = !!(typeof window !== 'undefined' && window.isMobile);
    var hinweisTxt = scene.add.text(cx, h - balkenH - 26,
      mobil ? 'Tippen, um den Kampf zu beginnen' : '[Leertaste] — Kampf beginnen', {
        fontSize: '14px', fontFamily: 'monospace', color: '#c8c0b0',
        stroke: '#000000', strokeThickness: 3, align: 'center'
      }).setOrigin(0.5).setDepth(1101).setScrollFactor(0).setAlpha(0);
    teile.push(hinweisTxt);
    spaeter(ZEILE_AB + NAME_MS, function () {
      tween({ targets: hinweisTxt, alpha: 1, duration: 300 });
      tween({ targets: hinweisTxt, alpha: 0.45, duration: 900, delay: 300,
              yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // --- Ausklang, sobald bestaetigt wird ----------------------------------
    var ausklangLaeuft = false;
    function ausklang() {
      if (ausklangLaeuft || beendet) return;
      ausklangLaeuft = true;
      abmelden.forEach(function (f) { try { f(); } catch (e) {} });
      abmelden.length = 0;
      if (kam) {
        try {
          if (typeof kam.zoomTo === 'function') kam.zoomTo(zoomVorher, AUSBLENDEN_MS, 'Quad.easeInOut');
        } catch (e) {}
      }
      tween({ targets: [nameTxt, zeileTxt, hinweisTxt], alpha: 0, duration: AUSBLENDEN_MS });
      tween({ targets: oben, y: -balkenH / 2, duration: AUSBLENDEN_MS });
      tween({ targets: unten, y: h + balkenH / 2, duration: AUSBLENDEN_MS });
      spaeter(AUSBLENDEN_MS, aufraeumen);
    }

    // Erst nach EINGABE_AB binden, sonst beendet ein noch fliegender Tastendruck
    // den Beat, bevor man ihn gelesen hat.
    spaeter(EINGABE_AB, function () {
      if (beendet) return;
      try {
        var ein = scene.input;
        if (ein && ein.keyboard) {
          ein.keyboard.on('keydown-SPACE', ausklang);
          ein.keyboard.on('keydown-ENTER', ausklang);
          abmelden.push(function () {
            ein.keyboard.off('keydown-SPACE', ausklang);
            ein.keyboard.off('keydown-ENTER', ausklang);
          });
        }
        if (ein && typeof ein.on === 'function') {
          ein.on('pointerdown', ausklang);
          abmelden.push(function () { ein.off('pointerdown', ausklang); });
        }
      } catch (e) {
        // Ohne Eingabe kaeme man hier nicht mehr raus — dann lieber wie frueher
        // nach kurzer Lesezeit von selbst weiter.
        spaeter(2400, ausklang);
      }
    });

    return true;
  }

  var BossIntro = {
    inszeniere: inszeniere,
    _TEMPO: 1,
    _BALKEN_MS: BALKEN_MS,
    _EINGABE_AB: EINGABE_AB,
    _BIS_HINWEIS_MS: ZEILE_AB + NAME_MS,
    _NOTAUSGANG_MS: NOTAUSGANG_MS
  };
  if (typeof window !== 'undefined') window.BossIntro = BossIntro;
  if (typeof module !== 'undefined' && module.exports) module.exports = BossIntro;
})();
