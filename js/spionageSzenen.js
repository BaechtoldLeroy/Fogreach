// js/spionageSzenen.js — Kurze Zwischenszenen in der Spionage (#197).
//
// Bisher liefen die Momente eines Spionage-Auftrags still ab: ein Status-Chip
// (VERKLEIDET / ENTTARNT / ABGEHOERT) und eine Hinweiszeile. Jetzt bekommen
// die Wendepunkte eine kleine Szene — Balken, Kamera auf das Geschehen,
// Messing-Plakette, Text Seite fuer Seite (Taste/Klick weiter, ESC beendet):
//
//   Missionsstart   Auftrag + Regel der Verkleidung, Kamera ueber die Wachen
//   Belauscht       das mitgehoerte Gespraech, Sprecher fuer Sprecher; der
//                   Toast "Quest-Ziel erfuellt" wird zur letzten Seite. Am
//                   Konvoi folgt danach die Entscheidung (Finale.konvoi).
//                   Die Ratskammer hat ihre eigene Buehne (geheime Sitzung).
//   Enttarnt        nur Blitz, Kamerastoss und der Ruf der Wache — haelt NICHTS
//                   an: man muss sofort gegen die Wachen kaempfen koennen
//   Alles gehoert   kurzer Abschluss
//
// "Verdacht steigt" bleibt bewusst ohne Szene: Kegel und Faerbung zeigen es,
// ohne das Schleichen zu unterbrechen.
//
// Fest im Spiel seit b447 (vorher Vorschau ?spionszene=neu).
(function () {
  'use strict';

  // Kein Kamera-Zoom: das Spiel hat keine eigene Kamera fuer die Oberflaeche,
  // Balken und Texte zoomten mit und liefen ueber den Rand (im Browser gesehen).
  var BALKEN_MS = 450;
  var KAMERA_MS = 700;
  var PLAKETTE_AB = 550;
  var REDE_AB = 900;
  var EINGABE_AB = 350;     // so lange nach jeder Seite zaehlt kein Tastendruck
  var AUSKLANG_MS = 420;
  var NOTAUSGANG_MS = 45000;
  var KNOPF_MIN_H = 44;

  // Lauschposten mit eigener Story-Buehne (die geheime Sitzung).
  var STORY_ZIELE = { collusion_reveal_seen: true };
  // Ein Pixel-Tableau je mitgehoertem Gespraech (PixelLab, 384x192, im Stil
  // der Akt-Zwischenszenen). Fehlt eines, schwenkt die Kamera wie bisher auf
  // den Lauschposten in der Spielwelt.
  var BILDER = ['convoy_intel', 'escort_route', 'archive_record', 'informant_id'];
  function bildKey(ziel) { return 'spionbild_' + ziel; }
  function vorladen(scene) {
    if (!scene || !scene.load || !scene.textures) return;
    var fehlt = BILDER.filter(function (z) { return !scene.textures.exists(bildKey(z)); });
    if (!fehlt.length) return;
    fehlt.forEach(function (z) { scene.load.image(bildKey(z), 'assets/sprites/spionage/' + z + '.png'); });
    try { if (!scene.load.isLoading()) scene.load.start(); } catch (e) {}
  }
  // Nach dem Gespraech: was die Story an dieser Stelle weiter erzaehlt.
  var DANACH = {
    convoy_intel: function (scene) {
      if (window.Finale && typeof window.Finale.konvoi === 'function') { try { window.Finale.konvoi(scene); } catch (e) {} }
    }
  };

  var DE = {
    'spion.ueberspringen': 'Überspringen (ESC)',
    'spion.ueberspringen_mobil': 'Überspringen',
    'spion.weiter': 'Weiter',
    'spion.auftrag': 'Auftrag',
    'spion.regel': 'Blaue Kegel lassen Dich in der Uniform vorbei, rote durchschauen sie. Ziehst Du die Klinge, fällt die Verkleidung.',
    'spion.CouncilChamber.titel': 'Die geheime Sitzung',
    'spion.CouncilChamber.1': 'Unter dem Rathaus tagt der Rat, wenn keiner zusieht. Komm nah genug heran, um jedes Wort zu hören.',
    'spion.CouncilWarehouse.titel': 'Der Konvoi',
    'spion.CouncilWarehouse.1': 'Heute Nacht entlädt der Rat im alten Lagerhaus. Hör den Kutschern zu und merk Dir ihren Weg.',
    'spion.SealedArchive.titel': 'Das versiegelte Archiv',
    'spion.SealedArchive.1': 'Die Schreiber flüstern, wenn sie glauben, allein zu sein. Hör zu, was sie umschreiben.',
    'spion.InformantDen.titel': 'Der Maulwurf',
    'spion.InformantDen.1': 'Einer von uns trifft sich hier mit dem Rat. Finde heraus, wer.',
    'spion.allgemein.titel': 'Im Schatten',
    'spion.allgemein.1': 'Bleib unerkannt und hör zu.',
    'spion.belauscht': 'Mitgehört',
    'spion.wache': 'Wache',
    'spion.kutscher': 'Kutscher',
    'spion.schreiber': 'Schreiber',
    'spion.archivar': 'Archivar',
    'spion.stimme': 'Gedämpfte Stimme',
    'spion.mann': 'Mann im Mantel',
    'spion.convoy_intel.titel': 'Die Ladung',
    'spion.convoy_intel.1': 'Noch drei Fuhren heute Nacht. Alles, was aus den Kellern kommt.',
    'spion.convoy_intel.2': 'Und der da hinten, mit den gebundenen Händen?',
    'spion.convoy_intel.3': 'Der kommt mit. Wer einmal auf der Liste steht, steht drauf.',
    'spion.escort_route.titel': 'Der Weg des Konvois',
    'spion.archive_record.titel': 'Akt einhundertsiebzehn',
    'spion.informant_id.titel': 'Das Treffen am Brunnen',
    'spion.escort_route.1': 'Nicht über die Hauptstraße. Durch die Gerbergasse, dann zum Wassertor.',
    'spion.escort_route.2': 'Und wenn einer fragt, was wir laden?',
    'spion.escort_route.3': 'Keiner fragt. Das Siegel des Rats beantwortet jede Frage.',
    'spion.archive_record.1': 'Akt einhundertsiebzehn. Ich soll nur ein Datum ändern, sonst nichts.',
    'spion.archive_record.2': 'Dann ändere es. Was im Archiv steht, ist wahr. Was nicht drinsteht, ist nie geschehen.',
    'spion.informant_id.1': 'Morgen beim Glockenschlag, am alten Brunnen. Bring die Namen.',
    'spion.informant_id.2': 'Und wenn sie fragen, wo ich war?',
    'spion.informant_id.3': 'Bei den Kranken. Der Klerus lügt für uns, wenn wir es verlangen.',
    'spion.enttarnt': 'Enttarnt',
    'spion.enttarnt.1': 'Halt! Das ist keiner von uns!',
    'spion.fertig': 'Alles gehört',
    'spion.fertig.1': 'Genug gehört. Zurück, bevor sie Fragen stellen.'
  };
  var EN = {
    'spion.ueberspringen': 'Skip (ESC)',
    'spion.ueberspringen_mobil': 'Skip',
    'spion.weiter': 'Continue',
    'spion.auftrag': 'Assignment',
    'spion.regel': 'Blue cones let you pass in the uniform, red ones see through it. Draw your blade and the disguise falls.',
    'spion.CouncilChamber.titel': 'The Secret Session',
    'spion.CouncilChamber.1': 'Beneath the town hall the council meets when no one is watching. Get close enough to hear every word.',
    'spion.CouncilWarehouse.titel': 'The Convoy',
    'spion.CouncilWarehouse.1': 'Tonight the council unloads at the old warehouse. Listen to the drivers and remember their route.',
    'spion.SealedArchive.titel': 'The Sealed Archive',
    'spion.SealedArchive.1': 'The scribes whisper when they think they are alone. Listen to what they rewrite.',
    'spion.InformantDen.titel': 'The Mole',
    'spion.InformantDen.1': 'One of ours meets the council here. Find out who.',
    'spion.allgemein.titel': 'In the Shadows',
    'spion.allgemein.1': 'Stay unseen and listen.',
    'spion.belauscht': 'Overheard',
    'spion.wache': 'Guard',
    'spion.kutscher': 'Driver',
    'spion.schreiber': 'Scribe',
    'spion.archivar': 'Archivist',
    'spion.stimme': 'Muffled voice',
    'spion.mann': 'Cloaked man',
    'spion.convoy_intel.titel': 'The Cargo',
    'spion.convoy_intel.1': 'Three more loads tonight. Everything that comes up from the cellars.',
    'spion.convoy_intel.2': 'And that one in the back, with his hands bound?',
    'spion.convoy_intel.3': 'He comes along. Once you are on the list, you stay on it.',
    'spion.escort_route.titel': 'The Convoy Route',
    'spion.archive_record.titel': 'File One Hundred Seventeen',
    'spion.informant_id.titel': 'The Meeting at the Well',
    'spion.escort_route.1': 'Not the main road. Through Tanners\' Lane, then to the Water Gate.',
    'spion.escort_route.2': 'And if someone asks what we carry?',
    'spion.escort_route.3': 'No one asks. The council\'s seal answers every question.',
    'spion.archive_record.1': 'File one hundred seventeen. I am only to change a date, nothing more.',
    'spion.archive_record.2': 'Then change it. What is in the archive is true. What is not, never happened.',
    'spion.informant_id.1': 'Tomorrow at the bell, by the old well. Bring the names.',
    'spion.informant_id.2': 'And if they ask where I was?',
    'spion.informant_id.3': 'With the sick. The clergy lies for us when we ask.',
    'spion.enttarnt': 'Exposed',
    'spion.enttarnt.1': 'Halt! That one is not one of us!',
    'spion.fertig': 'All heard',
    'spion.fertig.1': 'Heard enough. Back out before they ask questions.'
  };
  try {
    if (window.i18n && typeof window.i18n.register === 'function') {
      window.i18n.register('de', DE);
      window.i18n.register('en', EN);
    }
  } catch (e) {}

  // Gespraeche an den Lauschposten: [Sprecher-Schluessel, Text-Schluessel].
  var GESPRAECHE = {
    convoy_intel: [['spion.kutscher', 'spion.convoy_intel.1'], ['spion.wache', 'spion.convoy_intel.2'], ['spion.kutscher', 'spion.convoy_intel.3']],
    escort_route: [['spion.kutscher', 'spion.escort_route.1'], ['spion.wache', 'spion.escort_route.2'], ['spion.kutscher', 'spion.escort_route.3']],
    archive_record: [['spion.schreiber', 'spion.archive_record.1'], ['spion.archivar', 'spion.archive_record.2']],
    informant_id: [['spion.stimme', 'spion.informant_id.1'], ['spion.mann', 'spion.informant_id.2'], ['spion.stimme', 'spion.informant_id.3']]
  };

  function _t(k) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(k);
        if (v && v !== k && v.indexOf('[MISSING') !== 0) return v;
      }
    } catch (e) {}
    return DE[k] || k;
  }

  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _mobil(scene) {
    try { return !!(scene && scene.sys && scene.sys.game && scene.sys.game.device && !scene.sys.game.device.os.desktop); } catch (e) { return false; }
  }

  /**
   * Spielt eine Szene. Laeuft schon eine, wird diese hinten angestellt.
   *
   * @param {object} cfg
   *   ziel     {x,y} Weltpunkt, auf den die Kamera schwenkt (sonst der Spieler)
   *   titel    Ueberschrift der Plakette
   *   kopf     kleine Zeile darueber ("Auftrag", "Mitgehoert", ...)
   *   farbe    Farbe des Titels
   *   seiten   [{sprecher, text}]
   *   auto     ms: die Szene schliesst von selbst (Enttarnung), keine Eingabe noetig
   *   blitz    roter Blitz zu Beginn
   *   onEnde   nach dem Schliessen
   */
  function spiele(scene, cfg) {
    if (!scene || !scene.add || !scene.tweens || !scene.scale || !cfg) return null;
    if (scene.__spionSzene) {
      scene.__spionWarteschlange = scene.__spionWarteschlange || [];
      scene.__spionWarteschlange.push(cfg);
      return scene.__spionSzene;
    }
    var f = Szenen._TEMPO > 0 ? Szenen._TEMPO : 1;
    var frist = function (ms) { return Math.max(1, Math.round(ms * f)); };
    var UR = window.uiRahmen;
    var messing = !!(UR && UR.bereit && UR.bereit(scene));
    var b = scene.scale.width, h = scene.scale.height;
    var obenH = Math.round(h * 0.1), untenH = Math.round(h * 0.2);
    var kam = scene.cameras && scene.cameras.main;
    var zoomVorher = (kam && typeof kam.zoom === 'number') ? kam.zoom : 1;
    var figur = window.player;
    var seiten = cfg.seiten || [];
    var teile = [], uhren = [], abmelden = [], hudAus = [], lichtAus = [];
    var beendet = false, ausklangLaeuft = false;
    var choiceVorher = window.eventChoiceOpen;
    var zustand = { art: cfg.art || '', phase: 'auftakt', seite: -1, seiten: seiten.length, teile: teile };
    scene.__spionSzene = zustand;

    function spaeter(ms, fn) { uhren.push(setTimeout(function () { if (!beendet) fn(); }, frist(ms))); }
    function tween(c) { try { return scene.tweens.add(c); } catch (e) { return null; } }
    function neu(o) { if (o) { if (o.setScrollFactor) o.setScrollFactor(0); teile.push(o); } return o; }

    // --- Spiel anhalten, Oberflaeche und Nebel aus ---------------------------
    function hudFegen() {
      try {
        scene.children.list.forEach(function (o) {
          if (o && o.visible && o.scrollFactorX === 0 && (o.depth || 0) >= 1000 && teile.indexOf(o) < 0) {
            o.setVisible(false); hudAus.push(o);
          }
        });
      } catch (e) {}
    }
    hudFegen();
    if (scene.events && typeof scene.events.on === 'function') {
      scene.events.on('update', hudFegen);
      abmelden.push(function () { scene.events.off('update', hudFegen); });
    }
    ['fogUnseen', 'spotlightDim'].forEach(function (n) {
      var o = scene[n];
      if (o && o.visible && o.setVisible) { o.setVisible(false); lichtAus.push(o); }
    });
    try {
      window.eventChoiceOpen = true;
      if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    } catch (e) {}

    // Endet die Szene mit dem Raum (Tod, Rueckkehr in den Hub), bleibt sonst
    // ihr HUD-Feger am wiederverwendeten Szenen-Objekt haengen und blendet in
    // der naechsten GameScene alles aus — Story und Warteschlange gehen mit.
    var abbruch = false;
    function beiShutdown() {
      abbruch = true;
      scene.__spionWarteschlange = null;
      aufraeumen();
    }
    if (scene.events && typeof scene.events.once === 'function') {
      scene.events.once('shutdown', beiShutdown);
      abmelden.push(function () { scene.events.off('shutdown', beiShutdown); });
    }

    function aufraeumen() {
      if (beendet) return;
      beendet = true;
      uhren.forEach(function (u) { try { clearTimeout(u); } catch (e) {} });
      abmelden.forEach(function (fn) { try { fn(); } catch (e) {} });
      teile.forEach(_weg);
      hudAus.forEach(function (o) { if (o && o.scene) { try { o.setVisible(true); } catch (e) {} } });
      lichtAus.forEach(function (o) { if (o && o.scene) { try { o.setVisible(true); } catch (e) {} } });
      try { window.eventChoiceOpen = choiceVorher; } catch (e) {}
      try { if (typeof window.forceFogUpdate === 'function') window.forceFogUpdate(); } catch (e) {}
      if (kam) {
        try {
          if (typeof kam.setZoom === 'function') kam.setZoom(zoomVorher);
          if (figur && figur.active && typeof kam.startFollow === 'function') kam.startFollow(figur, true, 0.12, 0.12);
        } catch (e) {}
      }
      try { if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene); } catch (e) {}
      zustand.phase = 'fertig';
      if (scene.__spionSzene === zustand) scene.__spionSzene = null;
      if (abbruch) return;
      try { if (typeof cfg.onEnde === 'function') cfg.onEnde(); } catch (e) {}
      // Die naechste wartende Szene (z. B. "Alles gehoert" nach dem Gespraech).
      var naechste = scene.__spionWarteschlange && scene.__spionWarteschlange.shift();
      if (naechste && scene.sys && scene.sys.isActive && scene.sys.isActive()) spiele(scene, naechste);
    }
    uhren.push(setTimeout(aufraeumen, NOTAUSGANG_MS));

    // --- Balken, Blitz, Kamera ----------------------------------------------
    var oben = neu(scene.add.rectangle(b / 2, -obenH / 2, b, obenH, 0x05060a, 1).setDepth(1098));
    var unten = neu(scene.add.rectangle(b / 2, h + untenH / 2, b, untenH, 0x05060a, 1).setDepth(1098));
    tween({ targets: oben, y: obenH / 2, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });
    tween({ targets: unten, y: h - untenH / 2, duration: frist(BALKEN_MS), ease: 'Quad.easeOut' });
    if (cfg.blitz) {
      var blitz = neu(scene.add.rectangle(b / 2, h / 2, b, h, 0xff2a2a, 0.45).setDepth(1097));
      tween({ targets: blitz, alpha: 0, duration: frist(450) });
      if (kam && typeof kam.shake === 'function') { try { kam.shake(frist(220), 0.006); } catch (e) {} }
    }
    var ziel = cfg.ziel || (figur ? { x: figur.x, y: figur.y } : null);
    if (kam && ziel) {
      try {
        if (typeof kam.stopFollow === 'function') kam.stopFollow();
        if (typeof kam.pan === 'function') kam.pan(ziel.x, ziel.y + (untenH - obenH) / 2, frist(KAMERA_MS), 'Quad.easeInOut');
      } catch (e) {}
    }

    // --- Tableau (das mitgehoerte Gespraech als Bild) --------------------------
    // Fuellt das Bild zwischen den Balken und faehrt langsam heran.
    if (cfg.bild && scene.textures && scene.textures.exists(cfg.bild)) {
      var grundBild = neu(scene.add.rectangle(b / 2, h / 2, b, h, 0x05060a, 1).setDepth(1095).setAlpha(0));
      var tab = neu(scene.add.image(b / 2, h / 2, cfg.bild).setDepth(1096).setAlpha(0)).setName('spionTableau');
      var basis = Math.max(b / tab.width, h / tab.height);
      tab.setScale(basis);
      tween({ targets: [grundBild, tab], alpha: 1, duration: frist(500) });
      tween({ targets: tab, scale: basis * 1.12, duration: frist(20000), ease: 'Sine.easeOut' });
      zustand.tableau = cfg.bild;
    }

    // --- Plakette -----------------------------------------------------------
    spaeter(PLAKETTE_AB, function () {
      var pw = Math.min(460, b - 40), ph = 70;
      var px = b / 2, py = obenH + 12 + ph / 2;
      var platte = null;
      if (messing && UR.kachelBild) {
        var tex = UR.kachelBild(scene, pw, ph);
        platte = tex ? scene.add.image(px, py, tex) : null;
      }
      if (!platte) platte = scene.add.rectangle(px, py, pw, ph, 0x1c191f, 0.96).setStrokeStyle(2, 0xd9b867, 1);
      neu(platte.setDepth(1101)).setName('spionPlatte');
      var kopf = neu(scene.add.text(px, py - 14, String(cfg.kopf || '').toUpperCase(), {
        fontFamily: 'monospace', fontSize: '12px', color: '#d8ccb4'
      }).setOrigin(0.5).setDepth(1102)).setName('spionKopf');
      // Ohne Kopfzeile steht der Titel mittig (Enttarnt, Alles gehoert).
      var titel = neu(scene.add.text(px, cfg.kopf ? py + 10 : py, String(cfg.titel || ''), {
        fontFamily: 'serif', fontSize: '24px', fontStyle: 'bold', color: cfg.farbe || '#ffd166',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(1102)).setName('spionTitel');
      [kopf, titel].forEach(function (t) { if (t.width > pw - 32) t.setScale((pw - 32) / t.width); });
      [platte, kopf, titel].forEach(function (o) {
        var zy = o.y; o.y = zy - 20; o.setAlpha(0);
        tween({ targets: o, y: zy, alpha: 1, duration: frist(300), ease: 'Quad.easeOut' });
      });
    });

    // --- Rede ---------------------------------------------------------------
    var sprecher = null, rede = null, weiterKnopf = null;
    var bereitAb = Date.now() + frist(EINGABE_AB);
    function zeigeSeite(n) {
      zustand.seite = n;
      zustand.phase = 'rede';
      var s = seiten[n] || {};
      if (!rede) {
        sprecher = neu(scene.add.text(28, h - untenH + 12, '', {
          fontFamily: 'serif', fontSize: '16px', fontStyle: 'bold', color: '#ffd166'
        }).setDepth(1102)).setName('spionSprecher');
        rede = neu(scene.add.text(28, h - untenH + 36, '', {
          fontFamily: 'monospace', fontSize: '16px', color: '#efe6d2', lineSpacing: 4,
          wordWrap: { width: b - 56 - (cfg.auto ? 0 : 150) }
        }).setDepth(1102)).setName('spionRede');
      }
      sprecher.setText(String(s.sprecher || '').toUpperCase());
      rede.setText(String(s.text || ''));
      rede.setColor(s.ziel ? '#7dffb0' : '#efe6d2');
      rede.setAlpha(0);
      tween({ targets: rede, alpha: 1, duration: frist(200) });
      bereitAb = Date.now() + frist(EINGABE_AB);
    }

    function knopf(text, x, y, ton) {
      var t = scene.add.text(x, y, text, {
        fontFamily: 'monospace', fontSize: '14px', color: '#f4efe2', align: 'center', padding: { x: 14, y: 8 }
      }).setOrigin(1, 0.5).setDepth(1103);
      var py = Math.max(8, Math.ceil((KNOPF_MIN_H - (t.height - 16)) / 2));
      t.setPadding(14, py, 14, py);
      t.setInteractive({ useHandCursor: true });
      neu(t);
      if (messing && UR.textKnopf) { var bild = UR.textKnopf(scene, t, null, ton ? { ton: ton } : null); if (bild) neu(bild); }
      else t.setStroke('#000000', 3);
      return t;
    }

    function weiter() {
      if (beendet || ausklangLaeuft || cfg.auto) return;
      if (Date.now() < bereitAb) return;
      if (zustand.phase === 'auftakt') { redeBeginnen(); return; }
      if (zustand.seite + 1 < seiten.length) zeigeSeite(zustand.seite + 1);
      else ausklang();
    }
    function ueberspringen() { if (!beendet) ausklang(); }

    var redeLaeuft = false;
    function redeBeginnen() {
      if (redeLaeuft || beendet) return;
      redeLaeuft = true;
      if (!cfg.auto) {
        weiterKnopf = knopf(_t('spion.weiter'), b - 24, h - untenH / 2, null).setName('spionWeiter');
        weiterKnopf.on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); weiter(); });
      }
      if (seiten.length) zeigeSeite(0);
      else { zustand.phase = 'rede'; zustand.seite = 0; }
      if (cfg.auto) spaeter(cfg.auto, ausklang);
    }
    spaeter(REDE_AB, redeBeginnen);

    if (!cfg.auto) {
      knopf(_t(_mobil(scene) ? 'spion.ueberspringen_mobil' : 'spion.ueberspringen'), b - 16, obenH / 2, '#3a2a1a')
        .setName('spionUeberspringen')
        .on('pointerdown', function (p, x, y, ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); ueberspringen(); });
    }

    function ausklang() {
      if (ausklangLaeuft || beendet) return;
      ausklangLaeuft = true;
      zustand.phase = 'ausklang';
      teile.forEach(function (o) {
        if (o === oben || o === unten) return;
        try { if (o.disableInteractive) o.disableInteractive(); } catch (e) {}
        tween({ targets: o, alpha: 0, duration: frist(AUSKLANG_MS * 0.6) });
      });
      if (kam) {
        try {
          if (typeof kam.zoomTo === 'function') kam.zoomTo(zoomVorher, frist(AUSKLANG_MS), 'Quad.easeInOut');
          if (figur && typeof kam.pan === 'function') kam.pan(figur.x, figur.y, frist(AUSKLANG_MS), 'Quad.easeInOut', true);
        } catch (e) {}
      }
      tween({ targets: oben, y: -obenH / 2, duration: frist(AUSKLANG_MS) });
      tween({ targets: unten, y: h + untenH / 2, duration: frist(AUSKLANG_MS) });
      spaeter(AUSKLANG_MS, aufraeumen);
    }

    try {
      var ein = scene.input;
      if (ein && ein.keyboard && typeof ein.keyboard.on === 'function') {
        var beiTaste = function (ev) {
          if (ev && (ev.key === 'Escape' || ev.keyCode === 27)) { if (!cfg.auto) ueberspringen(); return; }
          if (ev && ev.repeat) return;
          weiter();
        };
        ein.keyboard.on('keydown', beiTaste);
        abmelden.push(function () { ein.keyboard.off('keydown', beiTaste); });
      }
      if (ein && typeof ein.on === 'function') {
        var beiZeiger = function () { weiter(); };
        ein.on('pointerdown', beiZeiger);
        abmelden.push(function () { ein.off('pointerdown', beiZeiger); });
      }
    } catch (e) {}

    zustand.weiter = weiter;
    zustand.ueberspringen = ueberspringen;
    // Weitere Seiten, solange die Szene noch nicht ausklingt (der Ziel-Text).
    zustand.seitenAnhaengen = function (neu) {
      if (beendet || ausklangLaeuft) return false;
      neu.forEach(function (s) { seiten.push(s); });
      zustand.seiten = seiten.length;
      return true;
    };
    return zustand;
  }

  // --- Die vier Momente ---------------------------------------------------
  function _mitte(punkte) {
    var p = (punkte || []).filter(function (q) { return q && typeof q.x === 'number'; });
    if (!p.length) return null;
    var x = 0, y = 0;
    p.forEach(function (q) { x += q.x; y += q.y; });
    return { x: x / p.length, y: y / p.length };
  }

  /** Missionsstart: Auftrag und Regel, Kamera ueber Wachen und Lauschposten. */
  function start(scene, templateName) {
    // Die Tableaus der Gespraeche jetzt holen: sie werden erst beim Abhoeren gebraucht.
    vorladen(scene);
    var st = window.EspionageSystem && window.EspionageSystem.getState ? window.EspionageSystem.getState() : null;
    var stamm = DE['spion.' + templateName + '.titel'] ? templateName : 'allgemein';
    var ziel = _mitte(((st && st.guards) || []).concat((st && st.observeZones) || []));
    return spiele(scene, {
      art: 'start', ziel: ziel,
      kopf: _t('spion.auftrag'), titel: _t('spion.' + stamm + '.titel'),
      seiten: [{ sprecher: _t('spion.auftrag'), text: _t('spion.' + stamm + '.1') }, { sprecher: _t('spion.auftrag'), text: _t('spion.regel') }]
    });
  }

  // "Quest-Ziel erfuellt" waehrend einer Mission: wird zur letzten Seite der
  // Szene statt eines Toasts. Kommt der Toast vor der Szene, wartet er hier.
  var _zielText = null;

  /**
   * Vom QuestSystem gerufen, bevor es "Quest-Ziel erfuellt" zeigt. true = die
   * Spionage-Szene uebernimmt den Text (kein Toast).
   */
  function zielToast(text) {
    if (!text) return false;
    if (!(window.EspionageSystem && window.EspionageSystem.isActive && window.EspionageSystem.isActive())) return false;
    var sc = window.gameScene || (window.game && window.game.scene && window.game.scene.getScene('GameScene'));
    var laufend = sc && sc.__spionSzene;
    if (laufend && laufend.art === 'belauscht' && laufend.seitenAnhaengen) {
      laufend.seitenAnhaengen([{ sprecher: '', text: text, ziel: true }]);
      return true;
    }
    _zielText = text;
    // Holt keine Szene den Text im selben Takt ab (Ratskammer: eigene Buehne),
    // kommt er doch als Toast.
    setTimeout(function () {
      if (!_zielText) return;
      var t = _zielText; _zielText = null;
      try { if (sc && window.EventSystem && window.EventSystem.showToast) window.EventSystem.showToast(sc, t, 'quest_objective_done'); } catch (e) {}
    }, 0);
    return true;
  }

  /**
   * Ein Lauschposten ist abgehoert. Liefert die Szene (oder null): spielt sie
   * am Konvoi, ruft sie die Entscheidung selbst — der Aufrufer dann nicht.
   */
  function belauscht(scene, zone, allesGehoert) {
    if (!zone) return null;
    var story = STORY_ZIELE[zone.questTarget];
    var g = GESPRAECHE[zone.questTarget];
    var z = null;
    if (!story && g) {
      var seiten = g.map(function (s) { return { sprecher: _t(s[0]), text: _t(s[1]) }; });
      if (_zielText) { seiten.push({ sprecher: '', text: _zielText, ziel: true }); _zielText = null; }
      var danach = DANACH[zone.questTarget];
      z = spiele(scene, {
        art: 'belauscht', ziel: { x: zone.x, y: zone.y }, bild: bildKey(zone.questTarget),
        kopf: _t('spion.belauscht'), titel: _t('spion.' + zone.questTarget + '.titel'),
        seiten: seiten,
        onEnde: danach ? function () { danach(scene); } : null
      });
    }
    // Der Abschluss nur, wenn keine Story-Szene das Ende erzaehlt.
    // Erzaehlt die Story danach weiter (Konvoi-Entscheidung), kein eigener Abschluss.
    if (allesGehoert && !story && !DANACH[zone.questTarget]) {
      z = spiele(scene, {
        art: 'fertig', kopf: '', titel: _t('spion.fertig'), farbe: '#7dffb0',
        seiten: [{ sprecher: '', text: _t('spion.fertig.1') }], auto: 2200
      }) || z;
    }
    return z;
  }

  /**
   * Enttarnt: roter Blitz, Kamerastoss, der Ruf der Wache ueber ihrem Kopf.
   * Haelt NICHTS an — keine Pause, keine Balken, keine Eingabesperre: die
   * Wachen greifen sofort an, und man muss sich wehren koennen.
   */
  function enttarnt(scene) {
    if (!scene || !scene.add || !scene.tweens) return null;
    var st = window.EspionageSystem && window.EspionageSystem.getState ? window.EspionageSystem.getState() : null;
    var p = window.player, wache = null, best = Infinity;
    ((st && st.guards) || []).forEach(function (g) {
      if (!g || g.knocked || !p) return;
      var d = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y);
      if (d < best) { best = d; wache = g; }
    });
    var b = scene.scale.width, h = scene.scale.height;
    var blitz = scene.add.rectangle(b / 2, h / 2, b, h, 0xff2a2a, 0.35).setScrollFactor(0).setDepth(1097).setName('spionBlitz');
    scene.tweens.add({ targets: blitz, alpha: 0, duration: 450, onComplete: function () { blitz.destroy(); } });
    try { scene.cameras.main.shake(220, 0.006); } catch (e) {}
    // Der Ruf steht ueber der Wache — ausser sie ist nicht im Bild (Nebel,
    // Kante): dann ueber dem Spieler, sonst sieht ihn keiner.
    var sicht = scene.cameras && scene.cameras.main && scene.cameras.main.worldView;
    var imBild = wache && sicht && sicht.contains && sicht.contains(wache.x, wache.y);
    var ort = imBild ? wache : (p || wache);
    var ruf = null;
    if (ort) {
      ruf = scene.add.text(ort.x, ort.y - 56, _t('spion.enttarnt.1'), {
        fontFamily: 'serif', fontSize: '18px', fontStyle: 'bold', color: '#ff9e8f',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5, 1).setDepth(1096).setName('spionRuf');
      scene.tweens.add({ targets: ruf, y: ruf.y - 14, alpha: 0, delay: 1300, duration: 500, onComplete: function () { ruf.destroy(); } });
    }
    return { art: 'enttarnt', ruf: ruf, blitz: blitz };
  }

  var Szenen = {
    spiele: spiele, start: start, belauscht: belauscht, enttarnt: enttarnt, zielToast: zielToast,
    vorladen: vorladen, bildKey: bildKey, BILDER: BILDER,
    GESPRAECHE: GESPRAECHE, STORY_ZIELE: STORY_ZIELE, _TEMPO: 1
  };
  window.SpionageSzenen = Szenen;
})();
