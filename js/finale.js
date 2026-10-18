// js/finale.js — das Finale an der Quelle und die Entscheidung am Konvoi (#158).
//
// Story-Bibel v5, Abschnitt 8 und 9. Das Ende steht fest: Endkampf, Presse,
// der Nebel bricht. Hier liegen die Momente im Dungeon, die dorthin fuehren:
//
//   konvoi(scene)              Akt 2: still bleiben oder die Klinge ziehen.
//                              Wer zieht, rettet einen Mann und verbrennt Maras
//                              Netz (convoy_blade_drawn, convoy_blown) — Mara
//                              kommt im Endkampf nicht.
//   vorKampf(scene, boss, weiter)
//                              Tiefe 30, Story-Kern v6.1: der erhobene Hammer
//                              (Du merkst, dass Loesen hier Erneuern heisst),
//                              Elara spricht den Plan aus, Harren ruft "Lene",
//                              sie stoesst ihn bewusst weg (harren_dead), nimmt
//                              Deinen Hammer, und die Esse nimmt sie. Danach
//                              der Kampf (bestehende Mechanik).
//   nachKampf(scene)           Der letzte Schlag ist Handwerk: Du loest die
//                              Bindung in die andere Richtung, die Esse
//                              zerbricht. Mara verlangt, dass Du Elara richtest:
//                              verschonen oder richten (elara_spared/killed).
//                              Das Ziel der Quelle ist erfuellt; abgegeben wird
//                              sie oben bei Thom (turnInNpcId), danach die
//                              Presse als Epilog (HubSceneV2, questFinale).
//
// TODO(Stufe 3): der erhobene Hammer, Elaras Griff nach Deiner Erinnerung und
// der letzte Schlag sind hier Text. Spielerisch folgen sie spaeter.
//
// Alle drei halten die Spieluhr an, der Kampf wartet also, solange gelesen
// wird. Vor- und Nachkampf laufen ueber EventSystem.showEventChoiceDialog; der
// Konvoi hat seit b447 einen eigenen Messing-Dialog (er folgt direkt auf die
// Abhoer-Szene und soll aussehen wie sie).
(function () {
  'use strict';

  function _en() {
    try {
      return !!(window.i18n && typeof window.i18n.getLanguage === 'function' && window.i18n.getLanguage() === 'en');
    } catch (e) { return false; }
  }
  function _t(de, en) { return _en() ? en : de; }

  function _qs() { return window.questSystem || null; }
  function _flag(name) {
    var qs = _qs();
    return !!(qs && typeof qs.hasFlag === 'function' && qs.hasFlag(name));
  }
  function _setzen(name) {
    var qs = _qs();
    if (qs && typeof qs.setFlag === 'function') qs.setFlag(name, true);
  }
  function _dialogDa() {
    return !!(window.EventSystem && typeof window.EventSystem.showEventChoiceDialog === 'function');
  }

  /**
   * Spielt Seiten nacheinander. Jede Seite: { text, weiter?, auswahl? }.
   * `auswahl` ist eine Liste { label, callback } — die letzte Seite entscheidet.
   */
  function _seiten(scene, seiten, amEnde) {
    var i = 0;
    function zeige() {
      var s = seiten[i];
      if (!s) { if (typeof amEnde === 'function') amEnde(); return; }
      if (typeof s.beiAnzeige === 'function') { try { s.beiAnzeige(); } catch (e) {} }
      var knoepfe = s.auswahl || [{
        label: s.weiter || _t('Weiter', 'Continue'),
        callback: function () { if (typeof s.danach === 'function') s.danach(); i++; zeige(); }
      }];
      window.EventSystem.showEventChoiceDialog(scene, s.text, knoepfe);
    }
    zeige();
  }

  // --- Akt 2: der Konvoi -------------------------------------------------------
  // Die Entscheidung folgt direkt auf die Abhoer-Szene (spionageSzenen.js) und
  // traegt deshalb deren Messing statt des Ereignis-Kastens: Platte und
  // Knoepfe aus uiRahmen, dahinter abgedunkelt das Tableau des Konvois.
  var KONVOI_TIEFE = 2500;
  var KONVOI_EINGABE_AB = 300;   // so lange zaehlt nach dem Aufgehen keine Taste
  var KONVOI_KNOPF_H = 44;       // Fingerbreite auf dem Handy

  function _mobil(scene) {
    try { return !!(scene.sys.game.device && !scene.sys.game.device.os.desktop); } catch (e) { return false; }
  }
  // Ein Container mit scrollFactor 0 gibt ihn NICHT an seine Kinder weiter:
  // ohne das driften die Trefferflaechen mit der Kamera, und auf dem Handy
  // gehen die Taps daneben.
  function _fest(o) {
    if (!o || !o.setScrollFactor) return;
    o.setScrollFactor(0);
    if (o.list) o.list.forEach(_fest);
  }

  /**
   * Eine Seite der Konvoi-Entscheidung.
   * @param {object} cfg  text, wahlen [{ label, callback, ton? }]
   * Tasten: bei mehreren Wahlen 1/2 (bewusst nicht Leertaste/Enter — wer die
   * Szene davor durchblaettert, soll nicht versehentlich entscheiden), bei
   * einer Wahl ESC/Leertaste/Enter wie im Ereignis-Dialog.
   */
  function _konvoiSeite(scene, cfg) {
    var UR = window.uiRahmen;
    var messing = !!(UR && UR.bereit && UR.bereit(scene));
    if (UR && !messing && UR.nachladen) { try { UR.nachladen(scene); } catch (e) {} }
    var kam = scene.cameras.main;
    var b = kam.width, h = kam.height, cx = b / 2;
    var pw = Math.min(580, b - 32);
    var wahlen = cfg.wahlen;
    var box = scene.add.container(0, 0).setDepth(KONVOI_TIEFE).setName('konvoiDialog');

    // Grund: das Tableau des Konvois (falls geladen), darueber Abdunklung.
    // Die Abdunklung faengt Klicks ab — nichts geht durch den Dialog hindurch.
    var bildKey = 'spionbild_convoy_intel';
    if (scene.textures && scene.textures.exists(bildKey)) {
      var tab = scene.add.image(cx, h / 2, bildKey);
      tab.setScale(Math.max(b / tab.width, h / tab.height));
      box.add(tab);
    }
    var dunkel = scene.add.rectangle(cx, h / 2, b, h, 0x05060a, 0.72).setInteractive();
    box.add(dunkel);

    var kopf = scene.add.text(cx, 0, _t('ENTSCHEIDUNG', 'DECISION'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#d8ccb4'
    }).setOrigin(0.5, 0);
    var titel = scene.add.text(cx, 0, _t('Am Konvoi', 'At the Convoy'), {
      fontFamily: 'serif', fontSize: '24px', fontStyle: 'bold', color: '#ffd166', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0);
    var rede = scene.add.text(cx, 0, cfg.text, {
      fontFamily: 'serif', fontSize: '16px', color: '#efe6d2', align: 'center', lineSpacing: 4,
      wordWrap: { width: pw - 88 }   // Luft zum Messingrand (im Browser zu knapp)
    }).setOrigin(0.5, 0).setName('konvoiText');

    // Knoepfe: nebeneinander, wenn sie passen, sonst untereinander (Handy hochkant).
    var knoepfe = wahlen.map(function (w, i) {
      var t = scene.add.text(0, 0, w.label, {
        fontFamily: 'monospace', fontSize: '15px', color: '#f4efe2', align: 'center',
        backgroundColor: w.ton || '#2a2a30', padding: { x: 18, y: 8 }
      }).setOrigin(0.5);
      var py = Math.max(8, Math.ceil((KONVOI_KNOPF_H - (t.height - 16)) / 2));
      t.setPadding(18, py, 18, py).setName('konvoiWahl' + i);
      return t;
    });
    var LUECKE = 16;
    var reihe = knoepfe.reduce(function (s, k) { return s + k.width; }, 0) + LUECKE * (knoepfe.length - 1);
    var nebeneinander = reihe <= pw - 48;
    var knopfH = knoepfe.reduce(function (m, k) { return Math.max(m, k.height); }, 0);
    var blockH = nebeneinander ? knopfH : knoepfe.reduce(function (s, k) { return s + k.height; }, 0) + 10 * (knoepfe.length - 1);

    var tasten = !_mobil(scene);
    var hinweis = tasten ? scene.add.text(cx, 0, wahlen.length > 1
      ? _t('Taste 1 / 2', 'Key 1 / 2')
      : _t('Leertaste / Enter', 'Space / Enter'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#9a8f7c'
    }).setOrigin(0.5, 0) : null;

    // Hoehe aus dem Inhalt, mittig auf dem Schirm.
    var RAND = 24;
    var innen = kopf.height + 4 + titel.height + 14 + rede.height + 20 + blockH + (hinweis ? 10 + hinweis.height : 0);
    var ph = Math.min(h - 16, innen + RAND * 2);
    var oben = Math.max(8, (h - ph) / 2);
    var y = oben + RAND;
    kopf.setY(y); y += kopf.height + 4;
    titel.setY(y); y += titel.height + 14;
    rede.setY(y); y += rede.height + 20;
    if (nebeneinander) {
      var x = cx - reihe / 2;
      knoepfe.forEach(function (k) { k.setPosition(x + k.width / 2, y + knopfH / 2); x += k.width + LUECKE; });
      y += knopfH;
    } else {
      knoepfe.forEach(function (k) { k.setPosition(cx, y + k.height / 2); y += k.height + 10; });
      y -= 10;
    }
    if (hinweis) hinweis.setY(y + 10);

    var platte = messing && UR.menuePlatte ? UR.menuePlatte(scene, cx, oben + ph / 2, pw, ph, KONVOI_TIEFE) : null;
    if (platte) platte.forEach(function (t) { box.add(t); });
    else box.add(scene.add.rectangle(cx, oben + ph / 2, pw, ph, 0x1c191f, 0.97).setStrokeStyle(2, 0xd9b867, 1));
    box.add([kopf, titel, rede]);
    if (hinweis) box.add(hinweis);

    var zustand = { text: cfg.text, wahlen: wahlen.map(function (w) { return w.label; }), box: box, knoepfe: knoepfe, messing: !!platte };
    var offen = true;
    var bereitAb = Date.now() + KONVOI_EINGABE_AB;
    var aufbau = null;

    function zu() {
      if (!offen) return;
      offen = false;
      if (aufbau) { try { aufbau.abbrechen(); } catch (e) {} aufbau = null; }
      if (scene.input && scene.input.keyboard) scene.input.keyboard.off('keydown', beiTaste);
      if (scene.events) scene.events.off('shutdown', zu);
      scene._eventChoiceActive = false;
      window.eventChoiceOpen = false;
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
      if (scene.__konvoiDialog === zustand) scene.__konvoiDialog = null;
      try { box.destroy(true); } catch (e) {}
    }
    function waehle(i) {
      var w = wahlen[i];
      if (!offen || !w) return false;
      zu();
      if (typeof w.callback === 'function') w.callback();
      return true;
    }
    function beiTaste(ev) {
      if (!offen || !ev || ev.repeat || Date.now() < bereitAb) return;
      var k = ev.key;
      if (wahlen.length > 1) {
        var n = parseInt(k, 10);
        if (n >= 1 && n <= wahlen.length) waehle(n - 1);
      } else if (k === 'Escape' || k === ' ' || k === 'Enter' || ev.keyCode === 27 || ev.keyCode === 32 || ev.keyCode === 13) {
        waehle(0);
      }
    }

    knoepfe.forEach(function (k, i) {
      box.add(k);
      k.setScrollFactor(0).setInteractive({ useHandCursor: true });
      if (platte) UR.textKnopf(scene, k, '#f4efe2');
      k.on('pointerdown', function (p, lx, ly, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        waehle(i);
      });
    });
    _fest(box);

    // Klick auf die Abdunklung: den Wort-fuer-Wort-Aufbau ueberspringen.
    dunkel.on('pointerdown', function () { if (aufbau) aufbau.ueberspringen(); });
    var TW = window.DialogTypewriter;
    if (TW && typeof TW.anTextobjekt === 'function') {
      // wanduhr: die Spieluhr steht gleich still, auf scene.time liefe nichts.
      aufbau = TW.anTextobjekt(scene, rede, cfg.text, { wanduhr: true });
    }

    scene._eventChoiceActive = true;
    window.eventChoiceOpen = true;   // sperrt Angriffe durch den Dialog hindurch
    if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    if (scene.input && scene.input.keyboard) scene.input.keyboard.on('keydown', beiTaste);
    scene.events.once('shutdown', zu);

    zustand.waehle = waehle;
    zustand.zu = zu;
    scene.__konvoiDialog = zustand;
    return zustand;
  }

  function konvoi(scene) {
    if (!scene || !scene.add || !scene.cameras || !scene.cameras.main) return false;
    if (_flag('convoy_silent') || _flag('convoy_blade_drawn')) return false;   // nur einmal
    if (scene.__konvoiDialog) return false;                                     // steht schon

    var ende = function (text) {
      _konvoiSeite(scene, { text: text, wahlen: [{ label: _t('Weiter', 'Continue'), callback: function () {} }] });
    };
    _konvoiSeite(scene, { text: _t(
      '(Am Karren zerren zwei Wachen einen Mann von der Ladefläche. Kein Verbrecher: ein Bürger, die Hände gebunden. Einer der Verschwundenen.)\n\n(Er sieht Dich an, als wüsste er, dass unter der Uniform keiner von ihnen steckt.)',
      '(At the cart two guards drag a man off the bed. No criminal: a citizen, hands bound. One of the disappeared.)\n\n(He looks at you as if he knew there is none of them under that uniform.)'
    ), wahlen: [
      {
        label: _t('Still bleiben', 'Stay silent'),
        callback: function () {
          _setzen('convoy_silent');
          ende(_t(
            'Du bleibst im Schatten. Sie bringen ihn fort. Du hast gehört, was Du hören solltest, und Maras Weg ins Lagerhaus bleibt offen.',
            'You stay in the shadows. They take him away. You heard what you came to hear, and Mara\'s way into the warehouse stays open.'
          ));
        }
      },
      {
        label: _t('Die Klinge ziehen', 'Draw your blade'),
        ton: '#4a1e22',   // rot getoent: dieser Weg verbrennt etwas
        callback: function () {
          _setzen('convoy_blade_drawn');
          _setzen('convoy_blown');
          try {
            if (window.EspionageSystem && typeof window.EspionageSystem.enttarnen === 'function') window.EspionageSystem.enttarnen();
          } catch (e) {}
          ende(_t(
            'Du ziehst. Der Mann rennt, und Du hältst die Wachen auf. Er entkommt. Deine Verkleidung ist dahin, und mit ihr Maras Netz: Morgen wissen sie, wer hier ein und aus ging.',
            'You draw. The man runs, and you hold the guards back. He gets away. Your disguise is gone, and with it Mara\'s network: by tomorrow they will know who came and went here.'
          ));
        }
      }
    ] });
    return true;
  }

  // --- Tiefe 30: vor dem Kampf -------------------------------------------------
  // v6.1, Das Finale 1 bis 3. Die Reihenfolge traegt die Geschichte: Elara
  // stoesst ihren Vater weg, BEVOR die Esse sie nimmt. Das ist ihr Punkt ohne
  // Rueckkehr, keine Besessenheit.
  /** Die Seiten vor dem Kampf, ohne Rueckrufe (auch fuer Tests). */
  function vorKampfSeiten() {
    var seiten = [
      // Elara empfaengt Dich als Verbuendete.
      _t('(Die Esse. Ein Schacht aus Glut und Rauch, so hoch wie das Rathaus. Davor, ohne Kapuze: Elara. An ihrem Hals ein Amulett des Rats, ein echtes.)\n\nELARA: Du bist da. Ich wusste es. Jetzt löse die Bindung, so wie ich es Dir gezeigt habe, und die Esse ist Geschichte.',
        '(The forge. A shaft of embers and smoke, as tall as the town hall. Before it, hood down: Elara. Around her neck an amulet of the council, a true one.)\n\nELARA: You are here. I knew it. Now loosen the binding, the way I showed you, and the forge is history.'),
      // 1. Der erhobene Hammer.
      _t('(Du setzt den Hammer an die Bindung, an der Stelle, die sie Dir gezeigt hat. Deine Hände wissen, was zu tun ist. Sie wissen es zu gut.)',
        '(You set the hammer to the binding, at the spot she showed you. Your hands know what to do. They know it too well.)'),
      _t('(Mitten im Schlag erkennst Du den Griff. Das ist kein Lösen. Das ist das Erneuern, das Du schon einmal verweigert hast, damals, als Du noch wusstest, wer Du bist.)\n\n(Du hältst inne. Der Hammer bleibt oben.)',
        '(In the middle of the strike you recognise the grip. This is no loosening. This is the renewal you refused once before, back when you still knew who you were.)\n\n(You stop. The hammer stays raised.)'),
      _t('ELARA: (leise) Alles haben wir vorausgesehen. Nur nicht, dass Du es merkst.',
        'ELARA: (quietly) We foresaw everything. Except that you would notice.'),
      _t('ELARA: Der Rat hat Dich geleert, damit der Nebel Dich hier unten nicht auslöscht. Ich habe Dir einen Widerstand gegeben, damit Du hinab willst. Und ich habe Dir gezeigt, wie man die Bindung löst, damit Du sie erneuerst.\n\nWir brauchten nie Dein Ja, Archivschmied. Nur Deine Hände.',
        'ELARA: The council emptied you so the fog would not wipe you out down here. I gave you a resistance so you would want to come down. And I showed you how to loosen the binding so you would renew it.\n\nWe never needed your yes, Archivesmith. Only your hands.'),
      // 2. Harren.
      _t('(Schritte hinter Dir. Harren, ohne Amulett, grau vom Nebel. Er hat alles verloren, was er war. Bis auf eines.)\n\nHARREN: Lene.\n\n(Sie zögert. Einen Atemzug lang ist sie wieder ein Kind am Fenster.)',
        '(Footsteps behind you. Harren, without an amulet, grey with fog. He has lost everything he was. All but one thing.)\n\nHARREN: Lene.\n\n(She hesitates. For one breath she is a child at the window again.)'),
      _t('(Dann stösst sie ihn weg. Mit eigener Hand, bewusst, ohne den Blick abzuwenden. Er stürzt gegen den Rand des Schachts und steht nicht mehr auf.)\n\nELARA: Die Esse braucht keinen Vater.',
        '(Then she pushes him away. With her own hand, deliberately, without looking away. He falls against the rim of the shaft and does not get up again.)\n\nELARA: The forge needs no father.'),
      // 3. Elara nimmt Deinen Hammer, und die Esse nimmt sie.
      _t('(Sie reisst Dir den Hammer aus der Hand.)\n\nELARA: Dann mache ich es selbst.\n\n(Sie schlägt gegen die Bindung. Einmal, zweimal. Die Glut antwortet.)',
        '(She tears the hammer from your hand.)\n\nELARA: Then I will do it myself.\n\n(She strikes the binding. Once, twice. The embers answer.)'),
      _t('(Doch sie ist keine Archivschmiedin. Die Bindung entgleitet ihr. Statt dass sie die Esse schmiedet, schmiedet die Esse sie. Der Rauch kriecht in sie hinein, und was sich aufrichtet, ist nicht mehr Elara.)',
        '(But she is no Archivesmith. The binding slips away from her. Instead of her forging the forge, the forge forges her. The smoke crawls into her, and what rises is no longer Elara.)')
    ];
    return seiten;
  }

  // Gibt true zurueck, wenn die Szene laeuft (dann ruft sie `weiter` selbst).
  function vorKampf(scene, boss, weiter) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('harren_dead')) return false;   // schon gesehen: gleich der Kampf

    var texte = vorKampfSeiten();
    var seiten = texte.map(function (text, i) {
      var s = { text: text };
      // Harren faellt auf der Seite, auf der sie ihn wegstoesst (vor der Esse).
      if (i === 6) s.danach = function () { _setzen('harren_dead'); };
      if (i === texte.length - 1) {
        s.weiter = _t('Kämpfen', 'Fight');
        // #89: Der Moment, in dem die Esse sie nimmt, ist mehr als eine Textseite.
        s.beiAnzeige = function () { _quelleNimmtSie(scene); };
        // Wer die Szene vorzeitig verlaesst, soll sie nicht noch einmal sehen.
        s.danach = function () { _setzen('harren_dead'); };
      }
      return s;
    });
    _seiten(scene, seiten, function () { if (typeof weiter === 'function') weiter(); });
    return true;
  }

  // #89: Violetter Blitz, ein Stoss durch den Raum, die Quelle flammt auf.
  function _quelleNimmtSie(scene) {
    var kam = scene && scene.cameras && scene.cameras.main;
    if (kam) {
      try { kam.flash(700, 170, 136, 238); } catch (e) {}
      try { kam.shake(450, 0.012); } catch (e) {}
    }
    var glut = scene && scene._quelleGlow;
    if (glut && glut.active && scene.tweens) {
      try {
        scene.tweens.add({ targets: glut, scale: 1.6, duration: 380, yoyo: true, ease: 'Quad.easeOut' });
      } catch (e) {}
    }
    if (window.soundManager && typeof window.soundManager.stopMusic === 'function') {
      try { window.soundManager.stopMusic(); } catch (e) {}
    }
    scene.__quelleNahmSie = true;
  }

  // --- Tiefe 30: nach dem Kampf ------------------------------------------------
  // Ihre letzten Worte haengen daran, was zwischen euch war.
  function _letzteWorte() {
    var teile = [];
    if (_flag('elara_trust')) {
      teile.push(_t('ELARA: Du hast mir vertraut. Bis zum letzten Schlag. Und dann hast Du Dich erinnert.',
        'ELARA: You trusted me. Until the last strike. And then you remembered.'));
    } else {
      teile.push(_t('ELARA: Du hast mir nie ganz getraut. Klug. Klüger als er.',
        'ELARA: You never fully trusted me. Wise. Wiser than him.'));
    }
    if (_flag('zeichen_bemerkt')) {
      teile.push(_t('(Sie sieht auf ihren Ring.) Du hast es erkannt. Das Zeichen. Schon damals.',
        '(She looks at her ring.) You recognized it. The sign. Even back then.'));
    }
    return teile.join('\n\n');
  }

  // v6.1: Das Ziel ist mit dem Sieg erfuellt (onBossKilled); abgegeben wird
  // die Quelle oben bei Thom (turnInNpcId), und dort spricht er den Abschluss.
  // Faellt der Abschuss aus irgendeinem Grund nicht ins Ziel (Debug-Boss),
  // hier nachziehen, damit die Abgabe moeglich bleibt.
  function _quelleAbschliessen(scene) {
    var qs = _qs();
    if (qs && typeof qs.isQuestReadyToComplete === 'function' && !qs.isQuestReadyToComplete('schattenrat_finale')
        && typeof qs.updateQuestProgress === 'function') {
      try { qs.updateQuestProgress('boss_kill', 'schattenrat', 1); } catch (e) {}
    }
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(scene, _t('Kehre zurück. Thom wartet an der Presse.', 'Go back up. Thom is waiting at the press.'), 'finale');
      }
    } catch (e) {}
  }

  function nachKampf(scene) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('elara_spared') || _flag('elara_killed')) return false;

    var nachWahl = function (text) {
      window.EventSystem.showEventChoiceDialog(scene, text, [{
        label: _t('Weiter', 'Continue'),
        callback: function () { _quelleAbschliessen(scene); }
      }]);
    };
    // #161: Die Quelle in der Arena erlischt.
    try {
      var glut = scene._quelleGlow;
      if (glut && glut.active && scene.tweens) {
        scene.tweens.killTweensOf(glut);
        scene.tweens.add({ targets: glut, alpha: 0, scale: 0.3, duration: 1200,
          onComplete: function () { try { glut.destroy(); } catch (e) {} } });
      } else if (glut && glut.destroy) glut.destroy();
      scene._quelleGlow = null;
    } catch (e) {}

    _seiten(scene, nachKampfSeiten().map(function (text) { return { text: text }; }).concat([
      { text: _t('MARA: (Sie kommt die letzten Stufen herab, den Bogen gesenkt.) Sie hat ihren Vater getötet. Mit eigener Hand, und sie wusste, was sie tut. Richte sie, Archivschmied.\n\n(Elaras Klinge liegt in Deiner Hand. Was tust Du?)',
        'MARA: (She comes down the last steps, bow lowered.) She killed her father. With her own hand, and she knew what she was doing. Judge her, Archivesmith.\n\n(Elara\'s blade is in your hand. What do you do?)'),
        auswahl: [
          {
            label: _t('Verschonen', 'Spare her'),
            callback: function () {
              _setzen('elara_spared');
              nachWahl(_t('Du lässt die Klinge sinken. Sie wird leben, hinter Gittern, mit dem, was sie getan hat.',
                'You lower the blade. She will live, behind bars, with what she has done.'));
            }
          },
          {
            label: _t('Richten', 'Judge her'),
            callback: function () {
              _setzen('elara_killed');
              nachWahl(_t('Du beendest es mit dem Geschenk, das sie Dir gab.',
                'You end it with the gift she gave you.'));
            }
          }
        ] }
    ]));
    return true;
  }

  /**
   * Die Seiten nach dem Kampf bis zur Wahl (v6.1, Das Finale 4 bis 6): ihre
   * eigene Klinge trifft sie, der letzte Schlag ist Handwerk, ihre letzten
   * Worte. Die Wahl selbst stellt Mara (nachKampf).
   */
  function nachKampfSeiten() {
    return [
      _t('(Elaras Hieb geht fehl. Ihre eigene Klinge, die in Deiner Hand, trifft sie. Sie sinkt in die Knie, und der Rauch weicht aus ihr wie aus einem erkalteten Ofen.)',
        '(Elara\'s blow goes wide. Her own blade, the one in your hand, strikes her. She sinks to her knees, and the smoke leaves her like a cooling furnace.)'),
      _t('(Der Hammer liegt neben ihr. Du hebst ihn auf und setzt ihn noch einmal an die Bindung. Diesmal in die andere Richtung, so wie nur ein Archivschmied es kann.)\n\n(Ein Schlag. Die Bindung löst sich wirklich. Die Esse reisst von oben bis unten, die Glut erlischt, und es kommt kein neuer Rauch nach.)',
        '(The hammer lies beside her. You pick it up and set it to the binding once more. This time in the other direction, the way only an Archivesmith can.)\n\n(One strike. The binding truly comes loose. The forge splits from top to bottom, the embers die, and no new smoke follows.)'),
      _letzteWorte()
    ];
  }

  window.Finale = { konvoi: konvoi, vorKampf: vorKampf, nachKampf: nachKampf,
    vorKampfSeiten: vorKampfSeiten, nachKampfSeiten: nachKampfSeiten };
})();
