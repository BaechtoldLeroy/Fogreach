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
//                              als Handwerk (FinaleHandwerk.halten: Du haeltst
//                              die Aktion an der Esse, mitten im Heben merkst
//                              Du, dass Loesen hier Erneuern heisst, und laesst
//                              los), Elara spricht den Plan aus, Harren ruft
//                              "Lene", sie stoesst ihn bewusst weg
//                              (harren_dead), nimmt Deinen Hammer, und die
//                              Esse nimmt sie. Danach der Kampf (ElaraKampf).
//   nachKampf(scene, boss)     Ihre eigene Klinge trifft sie (kurze Szene). Der
//                              letzte Schlag ist Handwerk: dieselbe Halte-
//                              Aktion in die andere Richtung, die Esse
//                              zerbricht, der Daemon faellt in die Tiefe. Mara
//                              verlangt, dass Du Elara richtest: verschonen
//                              oder richten (elara_spared/killed). Das Ziel der
//                              Quelle ist erfuellt; abgegeben wird sie oben bei
//                              Thom (turnInNpcId), danach die Presse als Epilog
//                              (HubSceneV2, questFinale).
//
// Die Dialoge halten die Spieluhr an, der Kampf wartet also, solange gelesen
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
      // Stufe 3: Eine Seite kann erst ein kurzes Spiel mit Figuren zeigen
      // (ohne Dialog, die Uhr laeuft); danach erscheint ihr Text.
      if (typeof s.vorher === 'function' && !s._vorherGelaufen) { s._vorherGelaufen = true; s.vorher(zeige); return; }
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
      // Steht der Text noch nicht ganz da, zeigt jede Taste dieses Dialogs
      // ihn erst zu Ende — auch die Ziffern: eine Entscheidung trifft man
      // nicht ueber einen halben Satz hinweg.
      var zifferTaste = wahlen.length > 1 && parseInt(k, 10) >= 1 && parseInt(k, 10) <= wahlen.length;
      var weiterTaste = k === 'Escape' || k === ' ' || k === 'Enter' || ev.keyCode === 27 || ev.keyCode === 32 || ev.keyCode === 13;
      if ((zifferTaste || weiterTaste) && aufbau && aufbau.ueberspringen()) return;
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
      '(Am Karren stemmen zwei Wachen eine Kiste von der Ladefläche. Darin, in Stroh gebettet, Phiolen, jede mit dem Wachs des Rats versiegelt. Auf einem Etikett steht ein Name, den Du kennst, und Du weisst nicht, woher.)\n\n(Der Kutscher sieht auf Deine Hand an der Klinge, als ahne er, dass unter der Uniform keiner von ihnen steckt.)',
      '(At the cart two guards heave a crate off the bed. Inside, bedded in straw, vials, each sealed with the council\'s wax. One label bears a name you know, and you do not know from where.)\n\n(The driver looks at your hand on the blade, as if he sensed there is none of them under that uniform.)'
    ), wahlen: [
      {
        label: _t('Still bleiben', 'Stay silent'),
        callback: function () {
          _setzen('convoy_silent');
          ende(_t(
            'Du bleibst im Schatten. Sie laden die Kiste auf und fahren hinab. Du hast gehört, was Du hören solltest, und Maras Weg ins Lagerhaus bleibt offen.',
            'You stay in the shadows. They load the crate and drive down. You heard what you came to hear, and Mara\'s way into the warehouse stays open.'
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
            'Du ziehst. Die Wachen weichen zurück, die Kiste kippt, Glas splittert im Stroh. Im Durcheinander kommst Du davon. Deine Verkleidung ist dahin, und mit ihr Maras Netz: Morgen wissen sie, wer hier ein und aus ging.',
            'You draw. The guards fall back, the crate tips over, glass shatters in the straw. In the confusion you get away. Your disguise is gone, and with it Mara\'s network: by tomorrow they will know who came and went here.'
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
  //
  // Stufe 3: Seite 1 ist kein Text mehr, sondern Handwerk. Der Spieler geht zur
  // Esse und haelt die Aktion (FinaleHandwerk.halten, 'erneuern'); mitten im
  // Heben trifft ihn die Erkenntnis, er laesst los. Erst dann spricht Elara.
  // Harren, ihr Stoss und der Hammer sind mit Figuren gespielt.
  /** Die Seiten vor dem Kampf, ohne Rueckrufe (auch fuer Tests). */
  function vorKampfSeiten() {
    var seiten = [
      // Elara empfaengt Dich als Verbuendete.
      _t('(Die Esse. Ein Schacht aus Glut und Rauch, so hoch wie das Rathaus. Davor, ohne Kapuze: Elara. An ihrem Hals ein Amulett des Rats, ein echtes.)\n\nELARA: Du bist da. Ich wusste es. Jetzt löse die Bindung, so wie ich es Dir gezeigt habe, und die Esse ist Geschichte.',
        '(The Furnace. A shaft of embers and smoke, as tall as the town hall. Before it, hood down: Elara. Around her neck an amulet of the council, a true one.)\n\nELARA: You are here. I knew it. Now loosen the binding, the way I showed you, and the Furnace is history.'),
      // 1. Der erhobene Hammer (Stufe 3: Bildunterschrift beim Ansetzen).
      _t('(Du setzt den Hammer an die Bindung, an der Stelle, die sie Dir gezeigt hat. Deine Hände wissen, was zu tun ist. Sie wissen es zu gut.)',
        '(You set the hammer to the binding, at the spot she showed you. Your hands know what to do. They know it too well.)'),
      _t('(Mitten im Schlag erkennst Du den Griff. Das ist kein Lösen. Das ist das Erneuern, das Du schon einmal verweigert hast, damals, als Du noch wusstest, wer Du bist.)\n\n(Du hältst inne. Der Hammer bleibt oben.)',
        '(In the middle of the strike you recognize the grip. This is no loosening. This is the renewal you refused once before, back when you still knew who you were.)\n\n(You stop. The hammer stays raised.)'),
      _t('ELARA: (leise) Alles haben wir vorausgesehen. Nur nicht, dass Du es merkst.',
        'ELARA: (quietly) We foresaw everything. Except that you would notice.'),
      _t('ELARA: Der Rat hat Dich geleert, damit der Nebel Dich hier unten nicht auslöscht. Ich habe Dir einen Widerstand gegeben, damit Du hinab willst. Und ich habe Dir gezeigt, wie man die Bindung löst, damit Du sie erneuerst.\n\nWir brauchten nie Dein Ja, Archivschmied. Nur Deine Hände.',
        'ELARA: The council emptied you so the fog would not wipe you out down here. I gave you a resistance so you would want to come down. And I showed you how to loosen the binding so you would renew it.\n\nWe never needed your yes, Archivesmith. Only your hands.'),
      // 2. Harren.
      _t('(Schritte hinter Dir. Harren, ohne Amulett, grau vom Nebel. Er hat alles verloren, was er war. Bis auf eines.)\n\nHARREN: Lene.\n\n(Sie zögert. Einen Atemzug lang ist sie wieder ein Kind am Fenster.)',
        '(Footsteps behind you. Harren, without an amulet, grey with fog. He has lost everything he was. All but one thing.)\n\nHARREN: Lene.\n\n(She hesitates. For one breath she is a child at the window again.)'),
      _t('(Dann stösst sie ihn weg. Mit eigener Hand, bewusst, ohne den Blick abzuwenden. Er stürzt gegen den Rand des Schachts und steht nicht mehr auf.)\n\nELARA: Die Esse braucht keinen Vater.',
        '(Then she pushes him away. With her own hand, deliberately, without looking away. He falls against the rim of the shaft and does not get up again.)\n\nELARA: The Furnace needs no father.'),
      // 3. Elara nimmt Deinen Hammer, und die Esse nimmt sie.
      _t('(Sie reisst Dir den Hammer aus der Hand.)\n\nELARA: Dann mache ich es selbst.\n\n(Sie schlägt gegen die Bindung. Einmal, zweimal. Die Glut antwortet.)',
        '(She tears the hammer from your hand.)\n\nELARA: Then I will do it myself.\n\n(She strikes the binding. Once, twice. The embers answer.)'),
      _t('(Doch sie ist keine Archivschmiedin. Die Bindung entgleitet ihr. Statt dass sie die Esse schmiedet, schmiedet die Esse sie. Der Rauch kriecht in sie hinein, und was sich aufrichtet, ist nicht mehr Elara.)',
        '(But she is no Archivesmith. The binding slips away from her. Instead of her forging the Furnace, the Furnace forges her. The smoke crawls into her, and what rises is no longer Elara.)')
    ];
    return seiten;
  }

  // --- Buehne: Figuren an der Esse ---------------------------------------------
  var FIGUR_TIEFE = 85;
  function _spieler() { return (typeof player !== 'undefined' && player) ? player : window.player; }
  function _weg(o) { if (o && o.scene) { try { o.destroy(); } catch (e) {} } }
  function _figur(scene, key, x, y, hoehe) {
    if (!scene.textures || !scene.textures.exists(key)) return null;
    var s = scene.add.image(x, y, key).setDepth(FIGUR_TIEFE);
    s.setScale(hoehe / (s.height || 60));
    return s;
  }
  function _menschHoehe() {
    var p = _spieler();
    var h = p && p.displayHeight;
    return (h && h > 20 && h < 200) ? h : 64;
  }
  function _esse(scene) {
    return (window.FinaleHandwerk && window.FinaleHandwerk.ort(scene)) || { x: 400, y: 300 };
  }
  function _toast(scene, de, en) {
    try {
      if (window.EventSystem && typeof window.EventSystem.showEventToast === 'function') {
        window.EventSystem.showEventToast(scene, _t(de, en), 'finale');
      }
    } catch (e) {}
  }
  /** Eine Zeile ueber einer Figur, die steigt und verblasst. */
  function _zeile(scene, x, y, text, farbe) {
    var t = scene.add.text(x, y, text, {
      fontFamily: 'serif', fontStyle: 'italic', fontSize: '15px', color: farbe || '#efe6d2',
      stroke: '#0b0a10', strokeThickness: 4, align: 'center', wordWrap: { width: 320 }
    }).setOrigin(0.5).setDepth(1004).setName('finaleZeile');
    scene.tweens.add({ targets: t, y: y - 18, alpha: { from: 1, to: 0 }, delay: 2600, duration: 900, onComplete: function () { _weg(t); } });
    return t;
  }

  // Der Boss steht schon (spawnBoss), aber bis zur Besessenheit ist er nicht
  // da: unsichtbar, ohne Koerper, ohne Takt, unverwundbar. Auf der Buehne
  // steht die Elara aus dem Hub.
  function _bossZurueckhalten(boss) {
    if (!boss) return;
    try { boss.setVisible(false); } catch (e) {}
    try { if (boss.body) boss.body.enable = false; } catch (e) {}
    boss._introHaltBis = Number.MAX_SAFE_INTEGER;
    boss._unverwundbar = true;
    if (boss.bossBar && boss.bossBar.setVisible) boss.bossBar.setVisible(false);
  }
  function _bossFreigeben(scene, boss, x, y) {
    if (!boss || !boss.active) return;
    try {
      boss.setPosition(x, y);
      if (boss.body) { boss.body.enable = true; if (boss.body.reset) boss.body.reset(x, y); }
      boss.setVisible(true);
    } catch (e) {}
    boss._unverwundbar = false;
    boss._introHaltBis = (scene.time ? scene.time.now : 0) + 900;
    if (boss.bossBar && boss.bossBar.setVisible) boss.bossBar.setVisible(true);
  }

  function _buehneAufbauen(scene, boss) {
    var e = _esse(scene);
    var mh = _menschHoehe();
    var b = { boss: boss, esse: e, mh: mh };
    b.elara = _figur(scene, 'elara_right0', e.x + 74, e.y + 18, mh);
    if (b.elara) { b.elara.setFlipX(true).setName('finaleElara'); }
    _bossZurueckhalten(boss);
    scene.__finaleBuehne = b;
    scene.events.once('shutdown', function () { _buehneAbbauen(b); });
    return b;
  }
  function _buehneAbbauen(b) {
    if (!b) return;
    ['elara', 'harren', 'hammer'].forEach(function (k) { _weg(b[k]); b[k] = null; });
  }

  // Seite 1: der erhobene Hammer, gespielt.
  function _hammerHeben(scene, b, danach) {
    var FH = window.FinaleHandwerk;
    if (!FH) { danach(); return; }
    _toast(scene, 'Geh zur Esse und setze den Hammer an, so wie Elara es Dir gezeigt hat.',
      'Walk to the Furnace and set your hammer to it, the way Elara showed you.');
    var texte = vorKampfSeiten();
    b.hammerHalt = scene.__finaleHammer = FH.halten(scene, {
      richtung: 'erneuern',
      // Unter der Esse: oben stehen die Meldungen und die Leiste.
      beiAnsetzen: function (h) { _zeile(scene, h.x, h.y + 175, texte[1], '#e8dcc0'); },
      beiErkenntnis: function () {
        // Elara begreift es zuerst: sie dreht sich zu Dir.
        if (b.elara && b.elara.scene) {
          b.elara.setTint(0xffe0d0);
          scene.tweens.add({ targets: b.elara, x: b.elara.x + 10, duration: 220, yoyo: true });
        }
      },
      beiLoslassen: function (h) {
        scene.__finaleHammer = null;
        if (b.elara && b.elara.clearTint) b.elara.clearTint();
        // Die Esse brennt weiter, ruhiger; die Bindung bleibt sichtbar, bis die Esse Elara nimmt.
        if (h && h._glut && h._glut.scene) scene.tweens.add({ targets: h._glut, alpha: 0.45, scale: 1.1, duration: 600 });
        danach();
      }
    });
  }

  // Seiten 2 bis 8: Erkenntnis, Plan, Harren, der Stoss, der Hammer, die Esse nimmt sie.
  function _nachDerErkenntnis(scene, b, boss, weiter) {
    var texte = vorKampfSeiten();
    var seiten = [
      { text: texte[2] },
      { text: texte[3] },
      { text: texte[4] },
      // Harren kommt hinter Dir herein, langsam, und bleibt vor ihr stehen.
      { text: texte[5], vorher: function (fertig) { _harrenKommt(scene, b, fertig); } },
      { text: texte[6], vorher: function (fertig) { _derStoss(scene, b, fertig); },
        // Harren faellt auf der Seite, auf der sie ihn wegstoesst (vor der Esse).
        danach: function () { _setzen('harren_dead'); } },
      { text: texte[7], vorher: function (fertig) { _hammerGenommen(scene, b, fertig); } },
      { text: texte[8], weiter: _t('Kämpfen', 'Fight'),
        // #89: Der Moment, in dem die Esse sie nimmt, ist mehr als eine Textseite.
        beiAnzeige: function () { _quelleNimmtSie(scene); _besessenheit(scene, b); },
        // Wer die Szene vorzeitig verlaesst, soll sie nicht noch einmal sehen.
        danach: function () { _setzen('harren_dead'); } }
    ];
    _seiten(scene, seiten, function () {
      _kampfBeginnt(scene, b, boss);
      if (typeof weiter === 'function') weiter();
    });
  }

  var HARREN_WEG_MS = 1500, STOSS_MS = 1000, HAMMER_MS = 800;
  // Wo Harren geht und liegt: begehbarer Boden (Mitte und Ecken des
  // Koerpers), weg von Waenden und Hindernissen, mit Abstand zu jeder Treppe.
  // Vorher lag er je nach Raum auf der Treppe (gemeldet nach b461).
  var TREPPE_ABSTAND = 40;   // px Luft um das Treppenbild
  var HARREN_RAND = 22;      // halbe Koerperbreite fuer die Bodenpruefung
  function _treppenFrei(scene, x, y, rand) {
    var grp = scene && scene.stairsGroup;
    if (!grp || typeof grp.getChildren !== 'function') return true;
    var r = (rand || 0) + TREPPE_ABSTAND;
    return grp.getChildren().every(function (st) {
      if (!st || !st.active) return true;
      var hb = st.getBounds ? st.getBounds() : { left: st.x - 32, right: st.x + 32, top: st.y - 32, bottom: st.y + 32 };
      return x < hb.left - r || x > hb.right + r || y < hb.top - r || y > hb.bottom + r;
    });
  }
  function _harrenFleckOk(scene, x, y) {
    var frei = function (px, py) { return !scene.isPointAccessible || scene.isPointAccessible(px, py); };
    var r = HARREN_RAND;
    if (!frei(x, y) || !frei(x - r, y - r) || !frei(x + r, y - r) || !frei(x - r, y + r) || !frei(x + r, y + r)) return false;
    return _treppenFrei(scene, x, y, r);
  }
  /** Der erste gute Fleck aus den Kandidaten, sonst einer nahe der Esse. */
  function _harrenFleck(scene, kandidaten, esse) {
    for (var i = 0; i < kandidaten.length; i++) {
      if (_harrenFleckOk(scene, kandidaten[i][0], kandidaten[i][1])) return { x: kandidaten[i][0], y: kandidaten[i][1] };
    }
    for (var r = 60; r <= 300; r += 20) {
      for (var w = 0; w < 16; w++) {
        var a = w * Math.PI / 8;
        var x = esse.x + Math.cos(a) * r, y = esse.y + Math.sin(a) * r;
        if (_harrenFleckOk(scene, x, y)) return { x: x, y: y };
      }
    }
    return { x: esse.x, y: esse.y + 60 };
  }
  /** Wohin Harren laeuft, woher er kommt und wo er nach dem Stoss liegt (auch fuer Tests). */
  function harrenWeg(scene, ex, ey, esse) {
    // Von der Seite der Elara, die vom Spieler abgewandt ist: nicht durch Dich hindurch.
    var p = _spieler();
    var s = (p && p.x > ex) ? -1 : 1;
    var ziel = _harrenFleck(scene, [[ex + s * 48, ey + 4], [ex + s * 48, ey + 40], [ex, ey + 50], [ex, ey - 50], [ex - s * 48, ey + 30]], esse);
    var start = _harrenFleck(scene, [[ziel.x + s * 260, ziel.y + 50], [ziel.x + s * 200, ziel.y], [ziel.x, ziel.y + 220],
      [ziel.x, ziel.y - 220], [ziel.x + s * 140, ziel.y + 120]], esse);
    var richtung = ziel.x >= ex ? 1 : -1;
    var liegt = _harrenFleck(scene, [[ziel.x + richtung * 70, ziel.y + 26], [ziel.x + richtung * 50, ziel.y + 40],
      [ziel.x, ziel.y + 50], [ziel.x + richtung * 40, ziel.y], [ziel.x, ziel.y + 20]], esse);
    return { ziel: ziel, start: start, liegt: liegt, richtung: richtung };
  }
  function _harrenKommt(scene, b, fertig) {
    var e = b.esse;
    var ex = b.elara ? b.elara.x : e.x + 74, ey = b.elara ? b.elara.y : e.y + 18;
    var weg = b.harrenWeg = harrenWeg(scene, ex, ey, e);
    b.harren = _figur(scene, 'harren_right0', weg.start.x, weg.start.y, b.mh * 0.95);
    if (b.harren) {
      b.harren.setTint(0xa8a8b0).setAlpha(0.92).setFlipX(weg.start.x > weg.ziel.x).setName('finaleHarren');
      scene.tweens.add({ targets: b.harren, x: weg.ziel.x, y: weg.ziel.y, duration: HARREN_WEG_MS, ease: 'Sine.easeInOut' });
      _zeile(scene, weg.ziel.x, weg.ziel.y - b.mh * 0.8, 'Lene.', '#d8d8e0');
    }
    // Sie dreht sich zu ihm.
    if (b.elara) scene.time.delayedCall(HARREN_WEG_MS * 0.6, function () { if (b.elara && b.elara.scene) b.elara.setFlipX(weg.ziel.x < b.elara.x); });
    scene.time.delayedCall(HARREN_WEG_MS + 150, function () {
      // Tweens laufen headless langsamer als die Uhr: zum Stoss steht er sicher am Ziel.
      if (b.harren && b.harren.scene) { scene.tweens.killTweensOf(b.harren); b.harren.setPosition(weg.ziel.x, weg.ziel.y); }
      fertig();
    });
  }
  function _derStoss(scene, b, fertig) {
    var weg = b.harrenWeg;
    if (b.elara && b.harren && weg) {
      var ex = b.elara.x;
      scene.tweens.add({ targets: b.elara, x: ex + 22 * weg.richtung, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: b.harren, x: weg.liegt.x, y: weg.liegt.y, angle: 90 * weg.richtung, alpha: 0.75,
        delay: 140, duration: 520, ease: 'Quad.easeOut' });
      if (scene.cameras && scene.cameras.main) { try { scene.cameras.main.shake(180, 0.006); } catch (e) {} }
    }
    scene.time.delayedCall(STOSS_MS, function () {
      if (b.harren && b.harren.scene && weg) {
        scene.tweens.killTweensOf(b.harren);
        b.harren.setPosition(weg.liegt.x, weg.liegt.y).setAngle(90 * weg.richtung).setAlpha(0.75);
      }
      fertig();
    });
  }
  function _hammerGenommen(scene, b, fertig) {
    var p = _spieler();
    var FH = window.FinaleHandwerk;
    if (p && b.elara && FH) {
      b.elara.setFlipX(p.x < b.elara.x);   // zurueck zu Dir
      b.hammer = scene.add.image(p.x + 12, p.y - 6, FH.hammerTextur(scene)).setDepth(FIGUR_TIEFE + 1).setName('finaleHammer');
      scene.tweens.add({ targets: b.hammer, x: b.elara.x - 10, y: b.elara.y - b.mh * 0.35, angle: -60, duration: 420, ease: 'Quad.easeIn' });
      scene.tweens.add({ targets: b.elara, x: b.elara.x - 14, duration: 180, yoyo: true, repeat: 1, delay: 450 });
    }
    scene.time.delayedCall(HAMMER_MS, fertig);
  }
  // Rauch aus der Esse kriecht in sie hinein, sie waechst, die Farbe kippt.
  function _besessenheit(scene, b) {
    if (!b.elara || !b.elara.scene) return;
    b.elara.setTint(0xc4a8ff);
    scene.tweens.add({ targets: b.elara, scale: b.elara.scale * 1.6, duration: 900, ease: 'Quad.easeIn' });
    var e = b.esse;
    for (var i = 0; i < 14; i++) {
      var f = scene.add.circle(e.x + (Math.random() - 0.5) * 50, e.y + (Math.random() - 0.5) * 30, 5 + Math.random() * 5, 0x6a4aa0, 0.6)
        .setDepth(FIGUR_TIEFE + 2).setName('finaleRauch');
      scene.tweens.add({ targets: f, x: b.elara.x, y: b.elara.y - b.mh * 0.3, alpha: 0, scale: 0.4,
        delay: i * 50, duration: 700, onComplete: (function (o) { return function () { _weg(o); }; })(f) });
    }
  }
  function _kampfBeginnt(scene, b, boss) {
    var x = b.elara ? b.elara.x : b.esse.x + 74;
    var y = b.elara ? b.elara.y : b.esse.y + 18;
    // Harren bleibt liegen, wo er fiel (er verschwindet erst mit dem Raum).
    _weg(b.elara); b.elara = null;
    _weg(b.hammer); b.hammer = null;
    if (b.hammerHalt && b.hammerHalt.bildAufraeumen) b.hammerHalt.bildAufraeumen();
    _bossFreigeben(scene, boss, x, y);
    if (window.ElaraKampf && typeof window.ElaraKampf.starten === 'function') {
      try { window.ElaraKampf.starten(scene, boss); } catch (e) {}
    }
  }

  // Gibt true zurueck, wenn die Szene laeuft (dann ruft sie `weiter` selbst
  // und startet den Kampf, ElaraKampf.starten). Bei false startet spawnBoss
  // den Kampf sofort.
  function vorKampf(scene, boss, weiter) {
    if (!scene || !_dialogDa()) return false;
    var schritt = _debugVorbereiten(scene, boss);
    // Elara ist schon gefallen, aber der letzte Schlag fehlt (Lauf vorher
    // verlassen): gleich an die Esse, ohne zweiten Kampf.
    if (_flag('elara_besiegt') && !_flag('elara_spared') && !_flag('elara_killed')) {
      _wiederAnDerEsse(scene, boss);
      return true;
    }
    if (_flag('harren_dead')) return false;   // schon gesehen: gleich der Kampf

    var b = _buehneAufbauen(scene, boss);
    if (schritt === 'harren') {
      _nachDerErkenntnis(scene, b, boss, weiter);
      return true;
    }
    if (schritt === 'erkenntnis') {
      var p = _spieler();
      if (p) { p.setPosition(b.esse.x - 40, b.esse.y + 50); if (p.body && p.body.reset) p.body.reset(p.x, p.y); }
    }
    var texte = vorKampfSeiten();
    _seiten(scene, [{ text: texte[0] }], function () {
      _hammerHeben(scene, b, function () { _nachDerErkenntnis(scene, b, boss, weiter); });
    });
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
    if (scene) scene.__finaleNachKampf = false;
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

  function _klingeAngelegt() {
    try {
      return !!(typeof equipment === 'object' && equipment && equipment.weapon && equipment.weapon.key === 'ELARAS_KLINGE');
    } catch (e) { return false; }
  }

  /** Eine Klinge als Textur: Stahl, Parierstange, und am Heft drei kleine Ketten. */
  function _klingeTextur(scene) {
    var key = 'finale_klinge';
    if (!scene.textures || scene.textures.exists(key)) return key;
    var g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xd8dde4, 1); g.fillTriangle(6, 0, 3, 34, 9, 34);
    g.fillStyle(0x9aa2ac, 1); g.fillRect(5, 4, 2, 30);
    g.fillStyle(0xc9a24a, 1); g.fillRect(0, 34, 12, 3);
    g.fillStyle(0x4a2e1a, 1); g.fillRect(4, 37, 4, 9);
    g.lineStyle(1, 0xffd166, 1);
    g.strokeCircle(4, 28, 2); g.strokeCircle(8, 28, 2); g.strokeCircle(6, 25, 2);
    g.generateTexture(key, 12, 46);
    g.destroy();
    return key;
  }

  // Ihre eigene Klinge trifft sie: die Klinge fliegt aus Deiner Hand in sie,
  // ein Blitz, der Rauch weicht aus ihr in die Esse, und was zurueckbleibt,
  // ist wieder Elara, auf den Knien.
  var KLINGE_MS = 1700;
  function _klingeTrifft(scene, ort, boss, fertig) {
    var p = _spieler();
    var b = { esse: _esse(scene), mh: _menschHoehe() };
    var key = scene.textures && scene.textures.exists('boss_elara_left0') ? 'boss_elara_left0' : 'elara_right0';
    var fig = scene.add.image(ort.x, ort.y, key).setDepth(FIGUR_TIEFE).setName('finaleElaraFall');
    fig.setScale(boss && boss.scaleX ? boss.scaleX : b.mh * 2.6 / (fig.height || 60));
    fig.setTint(0xc4a8ff);
    if (p && p.x > ort.x) fig.setFlipX(true);
    b.elara = fig;
    var klinge = scene.add.image(p ? p.x : ort.x - 80, p ? p.y : ort.y, _klingeTextur(scene)).setDepth(1003).setScale(1.6).setName('finaleKlinge');
    klinge.setRotation(Math.atan2(ort.y - klinge.y, ort.x - klinge.x) + Math.PI / 2);
    scene.tweens.add({ targets: klinge, x: ort.x, y: ort.y - 10, duration: 380, ease: 'Quad.easeIn' });
    _zeile(scene, ort.x, ort.y - 120, _t('Ihre eigene Klinge.', 'Her own blade.'), '#ffd166');
    scene.time.delayedCall(420, function () {
      if (fig.scene) fig.setTintFill(0xffffff);
      if (scene.cameras && scene.cameras.main) { try { scene.cameras.main.flash(200, 255, 255, 255); scene.cameras.main.shake(260, 0.01); } catch (e) {} }
      scene.time.delayedCall(140, function () {
        if (!fig.scene) return;
        fig.clearTint(); fig.setTint(0xc4a8ff);
        // Der Rauch verlaesst sie und kehrt in die Esse zurueck.
        for (var i = 0; i < 16; i++) {
          var f = scene.add.circle(ort.x + (Math.random() - 0.5) * 40, ort.y - 20 + (Math.random() - 0.5) * 60, 5 + Math.random() * 6, 0x6a4aa0, 0.65)
            .setDepth(FIGUR_TIEFE + 2).setName('finaleRauch');
          scene.tweens.add({ targets: f, x: b.esse.x, y: b.esse.y, alpha: 0, scale: 0.3, delay: i * 40, duration: 800,
            onComplete: (function (o) { return function () { _weg(o); }; })(f) });
        }
        scene.tweens.add({ targets: fig, alpha: 0.2, duration: 500, onComplete: function () {
          if (!fig.scene) return;
          // Zurueck bleibt die Frau aus dem Hub, auf den Knien.
          if (scene.textures.exists('elara_right0')) fig.setTexture('elara_right0');
          fig.clearTint();
          fig.setScale(b.mh / (fig.height || 60));
          fig.setScale(fig.scaleX, fig.scaleY * 0.82);
          fig.setFlipX(!!(p && p.x < ort.x));
          scene.tweens.add({ targets: fig, alpha: 1, duration: 400 });
        } });
      });
    });
    scene.time.delayedCall(800, function () { _weg(klinge); });
    scene.time.delayedCall(KLINGE_MS, function () { fertig(b); });
    scene.events.once('shutdown', function () { _weg(fig); _weg(klinge); });
    return b;
  }

  // Der letzte Schlag ist Handwerk: zurueck an die Esse, dieselbe Bewegung,
  // diesmal in die richtige Richtung. Dann zerbricht sie.
  function _letzterSchlag(scene, b) {
    var FH = window.FinaleHandwerk;
    var weiter = function () { _nachDemBruch(scene, b); };
    if (!FH) { weiter(); return; }
    _toast(scene, 'Nimm Deinen Hammer. Löse die Bindung an der Esse, diesmal in die andere Richtung.',
      'Take your hammer. Loosen the binding at the Furnace, this time the other way.');
    scene.__finaleLoesen = FH.halten(scene, {
      richtung: 'loesen',
      beiFertig: function (h) {
        scene.__finaleLoesen = null;
        FH.zerbrechen(scene, function () { if (h && h.bildAufraeumen) h.bildAufraeumen(); weiter(); }, h);
      }
    });
  }

  function _nachDemBruch(scene, b) {
    var texte = nachKampfSeiten();
    var nachWahl = function (text) {
      window.EventSystem.showEventChoiceDialog(scene, text, [{
        label: _t('Weiter', 'Continue'),
        callback: function () { _quelleAbschliessen(scene); }
      }]);
    };
    var maraDa = !_flag('convoy_blown');
    _seiten(scene, [{ text: texte[1] }, { text: texte[2] }, { text: texte[3] }].concat([
      // Stufe 1b: Ist Maras Netz am Konvoi verbrannt, ist sie nicht da (wie
      // im Epilog, questFinale maraFort). Die Frage stellt sich trotzdem.
      { text: !maraDa
        ? _t('(Niemand kommt die Stufen herab. Maras Netz ist seit dem Konvoi zerrissen, keiner nimmt Dir die Entscheidung ab. Elara hat ihren Vater getötet, mit eigener Hand, und sie wusste, was sie tut.)\n\n(Elaras Klinge liegt in Deiner Hand. Was tust Du?)',
          '(No one comes down the steps. Mara\'s network has been torn since the convoy; no one takes the decision from you. Elara killed her father, with her own hand, and she knew what she was doing.)\n\n(Elara\'s blade is in your hand. What do you do?)')
        : _t('MARA: (Sie kommt die letzten Stufen herab, den Bogen gesenkt.) Sie hat ihren Vater getötet. Mit eigener Hand, und sie wusste, was sie tut. Richte sie, Archivschmied.\n\n(Elaras Klinge liegt in Deiner Hand. Was tust Du?)',
          'MARA: (She comes down the last steps, bow lowered.) She killed her father. With her own hand, and she knew what she was doing. Judge her, Archivesmith.\n\n(Elara\'s blade is in your hand. What do you do?)'),
        vorher: maraDa ? function (fertig) { _maraKommt(scene, b, fertig); } : null,
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
              if (b && b.elara && b.elara.scene) scene.tweens.add({ targets: b.elara, alpha: 0, duration: 1200 });
              nachWahl(_t('Du beendest es mit dem Geschenk, das sie Dir gab.',
                'You end it with the gift she gave you.'));
            }
          }
        ] }
    ]));
  }

  var MARA_WEG_MS = 1200;
  function _maraKommt(scene, b, fertig) {
    var p = _spieler();
    var m = scene.__maraFigur && scene.__maraFigur.scene ? scene.__maraFigur
      : _figur(scene, 'spaeherin', (p ? p.x : 0) - 240, (p ? p.y : 0) - 120, _menschHoehe());
    if (m && p) {
      m.setName('finaleMara');
      scene.tweens.add({ targets: m, x: p.x - 50, y: p.y - 10, duration: MARA_WEG_MS, ease: 'Sine.easeInOut' });
    }
    scene.time.delayedCall(m ? MARA_WEG_MS + 100 : 0, fertig);
  }

  // Waehrend Klinge, letztem Schlag und Urteil kommt keine neue Welle in die
  // Arena (wave.js fragt laeuftNachKampf). Vorher hielten die Dialoge die Uhr
  // an; das Handwerk an der Esse laesst sie laufen.
  function _nachKampfBeginnt(scene) {
    scene.__finaleNachKampf = true;
    scene.events.once('shutdown', function () { scene.__finaleNachKampf = false; });
  }
  function laeuftNachKampf(scene) { return !!(scene && scene.__finaleNachKampf); }

  // Schon gefallen, aber nicht geloest: Elara liegt an der Esse, der Boss
  // verschwindet ohne Kampf und ohne zweite Beute.
  function _wiederAnDerEsse(scene, boss) {
    _nachKampfBeginnt(scene);
    var e = _esse(scene);
    if (boss && boss.active) { try { boss.destroy(); } catch (x) {} }
    var b = { esse: e, mh: _menschHoehe() };
    b.elara = _figur(scene, 'elara_right0', e.x + 80, e.y + 30, b.mh);
    if (b.elara) { b.elara.setScale(b.elara.scaleX, b.elara.scaleY * 0.82).setFlipX(true).setName('finaleElaraFall'); }
    scene.events.once('shutdown', function () { _weg(b.elara); });
    _seiten(scene, [{ text: _t('(Elara liegt noch dort, wo sie fiel, und die Esse brennt weiter. Die Bindung wartet auf Deinen Hammer.)',
      '(Elara still lies where she fell, and the Furnace keeps burning. The binding is waiting for your hammer.)') }],
    function () { _letzterSchlag(scene, b); });
  }

  // Gibt true zurueck, wenn das Finale nach dem Kampf laeuft.
  function nachKampf(scene, boss) {
    if (!scene || !_dialogDa()) return false;
    if (_flag('elara_spared') || _flag('elara_killed')) return false;
    // Wer jetzt den Lauf verlaesst, findet Elara beim naechsten Abstieg an der
    // Esse liegend vor (vorKampf), statt sie ein zweites Mal zu bekaempfen.
    _setzen('elara_besiegt');
    _nachKampfBeginnt(scene);
    var ort = (boss && typeof boss.x === 'number') ? { x: boss.x, y: boss.y } : (function () {
      var e = _esse(scene); return { x: e.x + 80, y: e.y + 30 };
    })();
    var texte = nachKampfSeiten();
    _klingeTrifft(scene, ort, boss, function (b) {
      _seiten(scene, [{ text: texte[0] }], function () { _letzterSchlag(scene, b); });
    });
    return true;
  }

  /**
   * Die Seiten nach dem Kampf bis zur Wahl (v6.1, Das Finale 4 bis 6): ihre
   * eigene Klinge trifft sie, der letzte Schlag ist Handwerk, der Daemon faellt
   * zurueck in die Tiefe, ihre letzten Worte. Die Wahl selbst stellt Mara
   * (nachKampf). Zwischen Seite 0 und 1 liegt der Schlag selbst (Stufe 3).
   */
  function nachKampfSeiten() {
    return [
      _klingeAngelegt()
        ? _t('(Elaras Hieb geht fehl. Ihre eigene Klinge, die in Deiner Hand, trifft sie. Sie sinkt in die Knie, und der Rauch weicht aus ihr wie aus einem erkalteten Ofen.)',
          '(Elara\'s blow goes wide. Her own blade, the one in your hand, strikes her. She sinks to her knees, and the smoke leaves her like a cooling furnace.)')
        : _t('(Elaras Hieb geht fehl. Die Klinge, die sie Dir geschenkt hat, trägst Du noch am Gürtel. Du ziehst sie. Ihre eigene Klinge trifft sie. Sie sinkt in die Knie, und der Rauch weicht aus ihr wie aus einem erkalteten Ofen.)',
          '(Elara\'s blow goes wide. The blade she gave you still hangs at your belt. You draw it. Her own blade strikes her. She sinks to her knees, and the smoke leaves her like a cooling furnace.)'),
      _t('(Der Hammer liegt neben ihr. Du hebst ihn auf und setzt ihn noch einmal an die Bindung. Diesmal in die andere Richtung, so wie nur ein Archivschmied es kann.)\n\n(Ein Schlag. Die Bindung löst sich wirklich. Die Esse reisst von oben bis unten, die Glut erlischt, und es kommt kein neuer Rauch nach.)',
        '(The hammer lies beside her. You pick it up and set it to the binding once more. This time in the other direction, the way only an Archivesmith can.)\n\n(One strike. The binding truly comes loose. The Furnace splits from top to bottom, the embers die, and no new smoke follows.)'),
      _t('(Tief unten im Schacht lässt etwas los. Der Dämon verliert seinen Halt an der Stadt und fällt zurück in die Tiefe. Was er noch nicht verbrannt hatte, gibt er frei: Lichter steigen auf, Hunderte, hinauf zu den Gassen.)',
        '(Deep down in the shaft something lets go. The demon loses its hold on the city and falls back into the depths. What it had not yet burned, it releases: lights rise, hundreds of them, up towards the alleys.)'),
      _letzteWorte()
    ];
  }

  // --- Debug: ?finale=<schritt> (docs/debug-modus.md) ----------------------------
  // Springt mit ?boss=elara direkt an eine Stelle des Finales. Stellt den
  // Queststand her (Die Quelle aktiv) und setzt die Flaggen des Schritts.
  var DEBUG_SCHRITTE = ['hammer', 'erkenntnis', 'harren', 'kampf', 'raub', 'zonen', 'echos', 'schlag', 'loesen'];
  var _debugErledigt = false;
  function _debugFlagge(name) {
    try { return (window.DebugGate && window.DebugGate.flagge(name)) || null; } catch (e) { return null; }
  }
  function _debugVorbereiten(scene, boss) {
    var v = _debugFlagge('finale');
    if (!v || _debugErledigt) return null;
    _debugErledigt = true;
    var schritt = String(v).toLowerCase();
    if (DEBUG_SCHRITTE.indexOf(schritt) < 0) {
      try { console.warn('[?finale] unbekannt: "' + v + '", bekannt sind: ' + DEBUG_SCHRITTE.join(', ')); } catch (e) {}
      return null;
    }
    var qs = _qs();
    if (qs && typeof qs.getQuestSaveData === 'function' && typeof qs.loadQuestSaveData === 'function') {
      var st = qs.getQuestSaveData();
      st.quests = st.quests || {};
      st.quests.schattenrat_finale = { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] };
      st.flags = st.flags || {};
      ['harren_dead', 'elara_besiegt', 'elara_spared', 'elara_killed', 'story_ending'].forEach(function (f) { delete st.flags[f]; });
      var extra = _debugFlagge('finaleflags');
      if (extra) String(extra).split(',').forEach(function (f) { if (f) st.flags[f.trim()] = true; });
      if (['kampf', 'raub', 'zonen', 'echos', 'schlag'].indexOf(schritt) >= 0) st.flags.harren_dead = true;
      if (schritt === 'loesen') { st.flags.harren_dead = true; st.flags.elara_besiegt = true; }
      qs.loadQuestSaveData(st);
    }
    // Nach dem Kampfbeginn (spawnBoss startet ElaraKampf gleich danach).
    if (scene && scene.time && boss) {
      scene.time.delayedCall(400, function () {
        if (!boss.active) return;
        var EK = window.ElaraKampf;
        if (schritt === 'raub' && EK && EK.debugGriffBald) EK.debugGriffBald(scene, boss, 1500);
        if (schritt === 'zonen') boss.hp = Math.ceil(boss.maxHp * 0.6);
        if (schritt === 'echos' && typeof BOSS_ATTACK_MAP !== 'undefined' && BOSS_ATTACK_MAP.besiegteRufen) BOSS_ATTACK_MAP.besiegteRufen.call(scene, boss);
        if (schritt === 'schlag') boss.hp = 1;
      });
    }
    try { console.info('[?finale] Schritt ' + schritt); } catch (e) {}
    return schritt;
  }

  window.Finale = { konvoi: konvoi, vorKampf: vorKampf, nachKampf: nachKampf, laeuftNachKampf: laeuftNachKampf,
    vorKampfSeiten: vorKampfSeiten, nachKampfSeiten: nachKampfSeiten, DEBUG_SCHRITTE: DEBUG_SCHRITTE,
    harrenWeg: harrenWeg, treppenFrei: _treppenFrei };
})();
