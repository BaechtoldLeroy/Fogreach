// js/dialogChoice.js — wiederverwendbare Spieler-Auswahl-Komponente (Feature 063 WP02).
//
// Erweitert additiv das bestehende _showDialoguePages-Modell in HubSceneV2
// (page.choices = [{label, action}]). Eine Auswahl-Option kann eine Antwortzeile
// zeigen, Story-Flags setzen ({flag}) und flag-abhaengig sichtbar sein (showIf).
// Kontrakt: kitty-specs/063-story-v4-inszenierung/contracts/dialog-ui-contract.md.
//
// WP05 haengt die Komponente in _showDialoguePages ein: eine `page` mit
// `_choiceConfig` (via toPage) wird ueber present() gerendert.
//
// Classic Script: haengt window.DialogChoice an. `resolve`/`pickResult`/
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

  // Baut das ChoiceResult fuer eine gewaehlte Option.
  function pickResult(choice, index) {
    return {
      index: index,
      choice: choice,
      flagsSet: (choice && choice.setFlags) ? choice.setFlags.slice() : []
    };
  }

  // --- Flag-Anbindung (lazy, ueber questSystem) -----------------------------

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

  // Rendert einen Auswahlblock in `scene`. Gibt ein Handle mit destroy() zurueck.
  function present(scene, config) {
    var cam = scene.cameras.main;
    var visible = resolve(config, _getFlags()).visibleChoices;
    if (!visible.length) {
      // Kontrakt: nach Filter muss mind. eine Option bleiben. Defensiv: nichts
      // rendern, direkt aufloesen mit null.
      if (config && typeof config.onResolved === 'function') config.onResolved(null);
      return { destroy: function () {} };
    }

    var panelWidth = 540;
    var pad = 20;
    var rowH = 40;
    var promptH = config && config.prompt ? 60 : 0;
    var panelHeight = pad * 2 + promptH + visible.length * rowH;
    var cx = cam.width / 2;
    var cy = cam.height - 180;

    var container = scene.add.container(cx, cy).setDepth(1600).setScrollFactor(0);
    container.setName('dialogChoiceContainer');

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

    var handleClosed = false;
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
      zone.on('pointerup', function () { closeAndResolve(choice, i); });
      container.add(btnBg);
      container.add(label);
      container.add(zone);
    });

    // Rekursiv scrollFactor(0) — inkl. aller Kinder.
    _applyScrollFactorRecursive(container);

    function destroy() {
      if (container) { container.destroy(true); container = null; }
    }

    return { destroy: destroy };
  }

  // --- Adapter fuer _showDialoguePages --------------------------------------

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
    toPage: toPage
  };
})();
