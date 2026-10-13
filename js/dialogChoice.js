// js/dialogChoice.js — wiederverwendbare Spieler-Auswahl-Komponente (Feature 063 WP02).
//
// Erweitert additiv das bestehende _showDialoguePages-Modell in HubSceneV2
// (page.choices = [{label, action}]). Eine Auswahl-Option kann eine Antwortzeile
// zeigen, Story-Flags setzen ({flag}) und flag-abhängig sichtbar sein (showIf).
// Kontrakt: kitty-specs/063-story-v4-inszenierung/contracts/dialog-ui-contract.md.
//
// WP05 hängt die Komponente in _showDialoguePages ein: eine `page` mit
// `_choiceConfig` (via toPage) wird über present() gerendert.
//
// Aussehen: Messing-Platte und -Knoepfe aus uiRahmen (wie Ereignis- und
// NPC-Dialoge), Sprecher ("ALDRIC: ...") als eigene Messing-Zeile. Fehlen
// die Bilder, zeichnet present() die alten schlichten Kaesten.
//
// Classic Script: hängt window.DialogChoice an. `resolve`/`pickResult`/
// `applyChoice` sind DOM-frei und testbar; `present` nutzt Phaser.
(function () {
  'use strict';

  // --- reine Logik (DOM-frei, testbar) --------------------------------------

  // Filtert Optionen per showIf(flags). Fehlt showIf, ist die Option sichtbar.
  function resolve(config, flags) {
    var f = flags || {};
    var choices = (config && config.choices) || [];
    var visible = choices.filter(function (c) {
      return typeof c.showIf !== 'function' ? true : !!c.showIf(f);
    });
    return { visibleChoices: visible };
  }

  // Baut das ChoiceResult für eine gewählte Option.
  function pickResult(choice, index) {
    return {
      index: index,
      choice: choice,
      flagsSet: (choice && choice.setFlags) ? choice.setFlags.slice() : []
    };
  }

  // --- Flag-Anbindung (lazy, über questSystem) -----------------------------

  function _setFlag(name) {
    if (name && typeof name === 'string'
        && typeof window !== 'undefined' && window.questSystem
        && typeof window.questSystem.setFlag === 'function') {
      window.questSystem.setFlag(name);
    }
  }

  function _getFlags() {
    if (typeof window !== 'undefined' && window.questSystem
        && typeof window.questSystem.getFlags === 'function') {
      return window.questSystem.getFlags();
    }
    return {};
  }

  // Wendet eine Auswahl an: setzt Flags, ruft onPick, liefert das Result.
  // DOM-frei — von present() UND von den Tests genutzt.
  function applyChoice(choice, index) {
    if (choice && choice.setFlags) {
      choice.setFlags.forEach(function (fn) { _setFlag(fn); });
    }
    if (choice && typeof choice.onPick === 'function') {
      choice.onPick({ choice: choice, index: index });
    }
    return pickResult(choice, index);
  }

  // --- Phaser-Rendering ------------------------------------------------------

  // Rekursive scrollFactor-Propagation (sonst verfehlen mobile Taps).
  function _applyScrollFactorRecursive(obj) {
    if (!obj) return;
    if (typeof obj.setScrollFactor === 'function') obj.setScrollFactor(0);
    if (obj.list && obj.list.length) {
      for (var i = 0; i < obj.list.length; i++) _applyScrollFactorRecursive(obj.list[i]);
    }
  }

  // --- Aufbau des Panels -----------------------------------------------------

  var PANEL_BREITE = 540;
  // Mobile: jede Trefferflaeche mind. 44 px hoch (Fingerbreite).
  var KNOPF_MIN_H = 44;

  function _istEn() {
    return !!(typeof window !== 'undefined' && window.i18n && window.i18n.getLanguage
      && window.i18n.getLanguage() === 'en');
  }

  function _abbrechenText() {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    if (I && typeof I.has === 'function' && I.has('dialog.choice.cancel')) return I.t('dialog.choice.cancel');
    return _istEn() ? 'Cancel (ESC)' : 'Abbrechen (ESC)';
  }

  // "ALDRIC: Setz das Siegel ..." -> Sprecher und Rede getrennt, damit der
  // Name als eigene Messing-Zeile ueber der Rede stehen kann. Ohne Sprecher
  // (Edikt-Tafel) bleibt der ganze Text Rede.
  function sprecherTeilen(prompt) {
    var s = String(prompt || '');
    var m = /^([A-ZÄÖÜ][A-ZÄÖÜ .'-]*[A-ZÄÖÜ]):\s*([\s\S]*)$/.exec(s);
    return m ? { name: m[1], rede: m[2] } : { name: '', rede: s };
  }

  // Messing-Platte mit Sprecher-Zeile, Rede in Pergament, Wahlen als
  // Messingknoepfe (uiRahmen.textKnopf: Hover/Gedrueckt), Abbrechen als
  // schmaler, rot getoenter Knopf. Alles liegt im Container — der Sweep der
  // Hub-Dialoge (Tiefe 1500..1700) raeumt es mit ihm ab.
  function _messingAufbau(scene, container, config, visible, allowCancel, waehlen, abbrechen, UR) {
    var cam = scene.cameras.main;
    var rand = 24, abstand = 8;
    var innen = PANEL_BREITE - rand * 2;
    var inhalt = [];   // [objekt, y ab Oberkante des Inhalts, istKnopf]
    var y = 0;

    function knopf(text, breite, farbe, groesse) {
      var t = scene.add.text(0, 0, text, {
        fontFamily: 'monospace', fontSize: groesse, color: farbe, align: 'center',
        wordWrap: { width: breite - 28 }, padding: { x: 14, y: 8 }
      }).setOrigin(0.5, 0);
      // Gleich breite Knoepfe, mind. 44 px hoch: Polster statt fester Groesse,
      // so bleibt die Beschriftung mittig, auch wenn sie umbricht.
      var nackt = t.width - 28, hoch = t.height - 16;
      var px = Math.max(14, Math.floor((breite - nackt) / 2));
      var py = Math.max(8, Math.ceil((KNOPF_MIN_H - hoch) / 2));
      t.setPadding(px, py, Math.max(14, breite - nackt - px), py);
      t.setInteractive({ useHandCursor: true });
      return t;
    }

    var teil = sprecherTeilen(config && config.prompt);
    if (teil.name) {
      var name = scene.add.text(-innen / 2, 0, teil.name, {
        fontFamily: 'serif', fontSize: 18, fontStyle: 'bold', color: '#ffd166'
      });
      inhalt.push([name, y, false]);
      y += name.height + 4;
    }
    if (teil.rede) {
      var rede = scene.add.text(-innen / 2, 0, teil.rede, {
        fontFamily: 'monospace', fontSize: 15, color: '#efe6d2',
        wordWrap: { width: innen }, lineSpacing: 3
      });
      inhalt.push([rede, y, false]);
      y += rede.height + 14;
    }

    visible.forEach(function (choice, i) {
      var b = knopf(choice.label, innen, '#f4efe2', 15);
      b.on('pointerup', function () { waehlen(choice, i); });
      b.setName('dialogChoiceKnopf');
      inhalt.push([b, y, true]);
      y += b.height + abstand;
    });
    if (allowCancel) {
      y += 2;
      var c = knopf(_abbrechenText(), 240, '#eadbd3', 14);
      c.on('pointerup', function () { abbrechen(); });
      c.setName('dialogChoiceAbbrechen');
      inhalt.push([c, y, true, '#4a1e22']);
      y += c.height + abstand;
    }
    y -= abstand;

    var hoehe = Math.ceil(y + rand * 2);
    // Ganz im Bild halten (lange Edikt-Frage, kleine Kamera).
    var mitte = Math.min(cam.height - 180, cam.height - hoehe / 2 - 8);
    container.y = Math.max(hoehe / 2 + 8, mitte);

    container.add(UR.platte(scene, 0, 0, PANEL_BREITE, hoehe, 0, 0.6));
    var oben = -hoehe / 2 + rand;
    inhalt.forEach(function (e) {
      var o = e[0];
      o.y = oben + e[1];
      container.add(o);
      // Knopfbild erst, wenn der Text an seinem Platz im Container liegt:
      // textKnopf legt es direkt darunter in denselben Container.
      if (e[2]) UR.textKnopf(scene, o, null, e[3] ? { ton: e[3] } : null);
    });
    if (typeof UR.lesbarAlle === 'function') UR.lesbarAlle(container.list);
  }

  // Rueckfall ohne Grafiken: die bisherige Zeichnung (abgerundete Kaesten,
  // unsichtbare Trefferzonen).
  function _schlichtAufbau(scene, container, config, visible, allowCancel, waehlen, abbrechen) {
    var panelWidth = PANEL_BREITE;
    var pad = 20;
    var rowH = 40;
    var promptH = config && config.prompt ? 60 : 0;
    var cancelRows = allowCancel ? 1 : 0;
    var panelHeight = pad * 2 + promptH + (visible.length + cancelRows) * rowH;

    var g = scene.add.graphics();
    g.fillStyle(0x0c0c11, 0.96).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    g.lineStyle(2, 0x484850, 0.9).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    container.add(g);

    var topY = -panelHeight / 2 + pad;
    if (config && config.prompt) {
      var promptText = scene.add.text(-panelWidth / 2 + pad, topY, config.prompt, {
        fontFamily: 'monospace', fontSize: 15, color: '#d8d2c3',
        wordWrap: { width: panelWidth - pad * 2 }, lineSpacing: 3
      });
      container.add(promptText);
      topY += promptH;
    }

    visible.forEach(function (choice, i) {
      var by = topY + i * rowH;
      var btnBg = scene.add.graphics();
      btnBg.fillStyle(0x1c1c24, 0.95).fillRoundedRect(-panelWidth / 2 + pad, by, panelWidth - pad * 2, rowH - 8, 8);
      var label = scene.add.text(-panelWidth / 2 + pad + 12, by + 6, choice.label, {
        fontFamily: 'monospace', fontSize: 15, color: '#e6dcc2',
        wordWrap: { width: panelWidth - pad * 2 - 24 }
      });
      var zone = scene.add.zone(0, by + (rowH - 8) / 2, panelWidth - pad * 2, rowH - 8)
        .setOrigin(0.5, 0.5).setPosition(0, by + (rowH - 8) / 2);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerup', function () { waehlen(choice, i); });
      container.add(btnBg);
      container.add(label);
      container.add(zone);
    });

    // Abbrechen-Zeile unter den Optionen (dezent, rötlicher Ton).
    if (allowCancel) {
      var cby = topY + visible.length * rowH;
      var cbg = scene.add.graphics();
      cbg.fillStyle(0x241618, 0.95).fillRoundedRect(-panelWidth / 2 + pad, cby, panelWidth - pad * 2, rowH - 8, 8);
      var clabel = scene.add.text(-panelWidth / 2 + pad + 12, cby + 6, _abbrechenText(), {
        fontFamily: 'monospace', fontSize: 15, color: '#c99'
      });
      var czone = scene.add.zone(0, cby + (rowH - 8) / 2, panelWidth - pad * 2, rowH - 8)
        .setOrigin(0.5, 0.5).setPosition(0, cby + (rowH - 8) / 2);
      czone.setInteractive({ useHandCursor: true });
      czone.on('pointerup', function () { abbrechen(); });
      container.add(cbg);
      container.add(clabel);
      container.add(czone);
    }
  }

  // Rendert einen Auswahlblock in `scene`. Gibt ein Handle mit destroy() zurück.
  function present(scene, config) {
    var cam = scene.cameras.main;
    var visible = resolve(config, _getFlags()).visibleChoices;
    if (!visible.length) {
      // Kontrakt: nach Filter muss mind. eine Option bleiben. Defensiv: nichts
      // rendern, direkt auflösen mit null.
      if (config && typeof config.onResolved === 'function') config.onResolved(null);
      return { destroy: function () {} };
    }

    // Abbrechen-Zeile (ausser der Aufrufer unterdrückt sie ausdrücklich).
    // Erlaubt dem Spieler, die Antwort-Auswahl zu verlassen, ohne zu wählen.
    var allowCancel = !(config && config.noCancel);
    var container = scene.add.container(cam.width / 2, cam.height - 180).setDepth(1600).setScrollFactor(0);
    container.setName('dialogChoiceContainer');

    var handleClosed = false;
    var escHandler = null;
    // ESC-Handler abhaengen — idempotent. Wird sowohl von destroy() (normaler
    // Abbruch/Auswahl) als auch vom 'destroy'-Event des Containers gerufen, damit
    // der Handler AUCH verschwindet, wenn das Panel EXTERN zerstoert wird (z. B.
    // HubSceneV2._sweepDialogSurfaces beim erneuten Ansprechen). Ohne das leakt
    // der Handler und haeuft sich ueber wiederholtes Oeffnen/Abbrechen an —
    // irgendwann schliesst ein Alt-Handler den frischen Dialog vorzeitig und der
    // NPC wird unansprechbar.
    function removeEscHandler() {
      if (escHandler && scene.input && scene.input.keyboard) {
        try { scene.input.keyboard.off('keydown-ESC', escHandler); } catch (e) {}
      }
      escHandler = null;
    }
    function closeAndResolve(choice, index) {
      if (handleClosed) return;
      handleClosed = true;
      var result = applyChoice(choice, index);
      // optionale Antwortzeile
      if (choice && choice.response && typeof config._onResponse === 'function') {
        config._onResponse(choice.response);
      }
      destroy();
      if (config && typeof config.onResolved === 'function') config.onResolved(result);
    }
    // Abbrechen: schliesst die Auswahl OHNE eine Option anzuwenden. Der Aufrufer
    // entscheidet über onCancel, was danach passiert (im Hub: Dialog schliessen).
    function cancel() {
      if (handleClosed) return;
      handleClosed = true;
      destroy();
      if (config && typeof config.onCancel === 'function') config.onCancel();
      else if (config && typeof config.onResolved === 'function') config.onResolved(null);
    }

    // Messing-Stil (#182), sobald die Grafiken geladen sind. Fehlen sie, die
    // schlichte Zeichnung von frueher — und fuer den naechsten Dialog nachladen.
    var UR = (typeof window !== 'undefined') ? window.uiRahmen : null;
    var messing = !!(UR && typeof UR.bereit === 'function' && UR.bereit(scene));
    if (UR && !messing && typeof UR.nachladen === 'function') {
      try { UR.nachladen(scene); } catch (e) {}
    }
    if (messing) _messingAufbau(scene, container, config, visible, allowCancel, closeAndResolve, cancel, UR);
    else _schlichtAufbau(scene, container, config, visible, allowCancel, closeAndResolve, cancel);

    // ESC bricht ebenfalls ab (Desktop). Handler beim Schliessen entfernen.
    if (allowCancel && scene.input && scene.input.keyboard) {
      escHandler = function () { cancel(); };
      scene.input.keyboard.on('keydown-ESC', escHandler);
      // Sicherheitsnetz: Wird der Container extern zerstoert (Sweep beim
      // erneuten Ansprechen), haengt das 'destroy'-Event den ESC-Handler ab.
      // Nur aufraeumen (kein cancel/onCancel) — die externe Schliessung
      // verwaltet _dialogOpen bereits selbst.
      container.once('destroy', removeEscHandler);
    }

    // Rekursiv scrollFactor(0) — inkl. aller Kinder.
    _applyScrollFactorRecursive(container);

    function destroy() {
      removeEscHandler();
      if (container) {
        // 'destroy'-Listener abhaengen, bevor wir selbst zerstoeren — sonst
        // liefe removeEscHandler ein zweites Mal (harmlos, aber unnoetig).
        try { container.off('destroy', removeEscHandler); } catch (e) {}
        container.destroy(true);
        container = null;
      }
    }

    return { destroy: destroy };
  }

  // --- Adapter für _showDialoguePages --------------------------------------

  // Liefert ein page-kompatibles Objekt. WP05 erkennt `_choiceConfig` und ruft
  // present() statt der Standard-Button-Logik.
  function toPage(config) {
    return {
      text: (config && config.prompt) || '',
      choices: ((config && config.choices) || []).map(function (c) {
        return { label: c.label, action: 'choice' };
      }),
      _choiceConfig: config
    };
  }

  window.DialogChoice = {
    resolve: resolve,
    pickResult: pickResult,
    applyChoice: applyChoice,
    present: present,
    toPage: toPage,
    sprecherTeilen: sprecherTeilen
  };

  if (window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', { 'dialog.choice.cancel': 'Abbrechen (ESC)' });
    window.i18n.register('en', { 'dialog.choice.cancel': 'Cancel (ESC)' });
  }
})();
