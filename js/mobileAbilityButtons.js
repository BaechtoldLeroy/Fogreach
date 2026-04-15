// mobileAbilityButtons.js — Decorate mobile ability buttons with icons, labels,
// legible cooldown text, and a desaturated disabled state.
//
// Listens for 'demonfall:mobile-layout-ready' from mobileControls.js, then
// decorates each button in the detail.buttons array. Also rewires the existing
// cooldown Text nodes (kept at window.*BtnCooldownText) with a stroke/shadow
// style so they stay legible over any button color.
//
// Disabled-state detection: we use the visibility of the cooldown Text node as
// the "on cooldown" proxy — the existing ability code already toggles that
// text's .visible when a cooldown starts/ends.
//
// Icon fallback: this project has no ability-icon textures, so we render a
// Unicode/emoji glyph per ability. Modern mobile browsers render emoji in
// color which is enough visual differentiation at a glance.

(function () {
  // Key → { glyph (emoji/unicode), label (1-3 chars), globalCooldownTextName }
  const DECORATION = {
    attack: { glyph: '\u2694\uFE0F',       label: 'Atk',  cd: 'attackBtnCooldownText'    },
    spin:   { glyph: '\uD83C\uDF00',       label: 'Spin', cd: 'spinBtnCooldownText'       },
    charge: { glyph: '\u26A1',             label: 'Ch',   cd: 'chargeSlashCooldownText'   },
    dash:   { glyph: '\uD83D\uDCA8',       label: 'Ds',   cd: 'dashSlashCooldownText'     },
    dagger: { glyph: '\uD83D\uDDE1\uFE0F', label: 'Dg',   cd: 'daggerThrowCooldownText'   },
    shield: { glyph: '\uD83D\uDEE1\uFE0F', label: 'Sh',   cd: 'shieldBashCooldownText'    },
    potion:   { glyph: '\uD83E\uDDEA', label: 'HP',   cd: null },
    interact: { glyph: '\u270B',       label: 'E',    cd: null },
  };

  // Per-scene state so we can clean up listeners on re-entry.
  const sceneState = new WeakMap();

  function _buttonScale() {
    const s = window.__MOBILE_BUTTON_SCALE__;
    return (typeof s === 'number' && isFinite(s) && s > 0) ? s : 1.0;
  }

  function _styleCooldownText(textNode) {
    if (!textNode || !textNode.setStyle) return;
    textNode.setStyle({
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true, stroke: true },
      align: 'center',
    });
    textNode.setDepth(1202); // above button + icon + label
  }

  function _decorateButton(scene, btnInfo) {
    const { spec, circle } = btnInfo;
    const dec = DECORATION[spec.key];
    if (!dec) return null;

    const scale = _buttonScale();
    // circle's underlying geometry carries the radius after setRadius or at
    // creation time — prefer it over spec (spec dropped its baseRadius).
    const baseRadius = (circle && circle.radius) ? circle.radius / scale : 38;
    const radius = baseRadius * scale;

    // Icon glyph (emoji) centered on the button, offset slightly up.
    const icon = scene.add.text(0, 0, dec.glyph, {
      fontSize: Math.round(radius * 0.9) + 'px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1201);

    // Label underneath, inside the button.
    const label = scene.add.text(0, 0, dec.label, {
      fontSize: Math.max(9, Math.round(radius * 0.32)) + 'px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1201);

    const place = () => {
      icon.setPosition(circle.x, circle.y - radius * 0.12);
      label.setPosition(circle.x, circle.y + radius * 0.55);
    };
    place();

    // Cooldown text legibility
    const cdText = window[dec.cd];
    _styleCooldownText(cdText);

    return {
      key: spec.key,
      circle,
      icon,
      label,
      cdText,
      originalColor: circle.fillColor,
      place,
    };
  }

  function _applyEnabledVisual(dec, enabled) {
    if (!dec || !dec.circle) return;
    const a = enabled ? 0.6 : 0.25;
    dec.circle.setFillStyle(dec.originalColor, a);
    if (dec.icon)  dec.icon.setAlpha(enabled ? 1.0 : 0.5);
    if (dec.label) dec.label.setAlpha(enabled ? 1.0 : 0.5);
  }

  function _pollEnabledState(decorations) {
    decorations.forEach((dec) => {
      const cdVisible = !!(dec.cdText && dec.cdText.visible);
      _applyEnabledVisual(dec, !cdVisible);
    });
  }

  function onLayoutReady(event) {
    const detail = event && event.detail;
    if (!detail || !detail.scene || !Array.isArray(detail.buttons)) return;
    const scene = detail.scene;

    // Clean up any previous decorations on this scene
    const prev = sceneState.get(scene);
    if (prev) {
      prev.decorations.forEach((d) => {
        d.icon && d.icon.destroy();
        d.label && d.label.destroy();
      });
      scene.events.off('update', prev.poll);
    }

    const decorations = detail.buttons
      .map((b) => _decorateButton(scene, b))
      .filter(Boolean);

    const poll = () => _pollEnabledState(decorations);
    // Poll enabled state each tick — cheap (visibility check on 6 text nodes).
    scene.events.on('update', poll);

    // Re-place icon + label on layout changes (resize).
    const onChanged = () => decorations.forEach((d) => d.place());
    window.addEventListener('demonfall:mobile-layout-changed', onChanged);

    // Clean up on scene shutdown
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off('update', poll);
      window.removeEventListener('demonfall:mobile-layout-changed', onChanged);
      decorations.forEach((d) => {
        d.icon && d.icon.destroy();
        d.label && d.label.destroy();
      });
      sceneState.delete(scene);
    });

    sceneState.set(scene, { decorations, poll, onChanged });
  }

  window.addEventListener('demonfall:mobile-layout-ready', onLayoutReady);

  // Exports for tests / other WPs
  window.mobileAbilityButtonsDecorate = onLayoutReady;
  window.styleCooldownText = _styleCooldownText;
})();
