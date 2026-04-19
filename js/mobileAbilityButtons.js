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
  if (window.i18n) {
    window.i18n.register('de', {
      'mobile.btn.attack': 'Angr',
      'mobile.btn.spin': 'Wirbel',
      'mobile.btn.charge': 'Ladung',
      'mobile.btn.dash': 'Sturm',
      'mobile.btn.dagger': 'Dolch',
      'mobile.btn.shield': 'Schild',
      'mobile.btn.interact': 'Aktion'
    });
    window.i18n.register('en', {
      'mobile.btn.attack': 'Atk',
      'mobile.btn.spin': 'Spin',
      'mobile.btn.charge': 'Charge',
      'mobile.btn.dash': 'Dash',
      'mobile.btn.dagger': 'Dagger',
      'mobile.btn.shield': 'Shield',
      'mobile.btn.interact': 'Action'
    });
  }
  const T = (key, fallback) => {
    if (!window.i18n) return fallback;
    const v = window.i18n.t(key);
    return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : fallback;
  };

  // Key → { glyph (emoji/unicode), labelKey (i18n) | label (literal), cd }
  const DECORATION = {
    attack: { glyph: '\u2694\uFE0F',       labelKey: 'mobile.btn.attack',   cd: 'attackBtnCooldownText'   },
    spin:   { glyph: '\uD83C\uDF00',       labelKey: 'mobile.btn.spin',     cd: 'spinBtnCooldownText'     },
    charge: { glyph: '\u26A1',             labelKey: 'mobile.btn.charge',   cd: 'chargeSlashCooldownText' },
    dash:   { glyph: '\uD83D\uDCA8',       labelKey: 'mobile.btn.dash',     cd: 'dashSlashCooldownText'   },
    dagger: { glyph: '\uD83D\uDDE1\uFE0F', labelKey: 'mobile.btn.dagger',   cd: 'daggerThrowCooldownText' },
    shield: { glyph: '\uD83D\uDEE1\uFE0F', labelKey: 'mobile.btn.shield',   cd: 'shieldBashCooldownText'  },
    potion:   { glyph: '\uD83E\uDDEA', label: 'x0',                        cd: null, dynamicLabel: true },
    interact: { glyph: '\u270B',       labelKey: 'mobile.btn.interact',    cd: null, tapFeedback: true  }
  };
  const _initialLabel = (dec) => dec.labelKey ? T(dec.labelKey, dec.label || '') : (dec.label || '');

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
    const label = scene.add.text(0, 0, _initialLabel(dec), {
      fontSize: Math.max(9, Math.round(radius * 0.32)) + 'px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1201);

    // Optional CD overlay text for buttons with no per-ability cooldown text
    // node (e.g. potion). Only shown when the cooldown is active.
    let cdOverlay = null;
    if (spec.key === 'potion') {
      cdOverlay = scene.add.text(0, 0, '', {
        fontSize: Math.round(radius * 0.6) + 'px',
        fontStyle: 'bold',
        color: '#ffd966',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1202).setVisible(false);
    }

    const place = () => {
      icon.setPosition(circle.x, circle.y - radius * 0.12);
      label.setPosition(circle.x, circle.y + radius * 0.55);
      if (cdOverlay) cdOverlay.setPosition(circle.x, circle.y - radius * 0.12);
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
      labelKey: dec.labelKey || null,   // for i18n re-render on language change
      labelLiteral: dec.label || null,  // fallback when no labelKey + dynamic labels
      cdText,
      cdOverlay,
      originalColor: circle.fillColor,
      place,
      // Track per-decoration state for polling
      _lastInteractFlag: false,
    };
  }

  function _applyEnabledVisual(dec, enabled) {
    if (!dec || !dec.circle) return;
    const a = enabled ? 0.6 : 0.25;
    dec.circle.setFillStyle(dec.originalColor, a);
    if (dec.icon)  dec.icon.setAlpha(enabled ? 1.0 : 0.5);
    if (dec.label) dec.label.setAlpha(enabled ? 1.0 : 0.5);
  }

  function _countPotionsInInventory() {
    const inv = (typeof window !== 'undefined' && Array.isArray(window.inventory)) ? window.inventory : null;
    if (!inv) return 0;
    let count = 0;
    for (let i = 0; i < inv.length; i++) {
      const it = inv[i];
      if (it && it.type === 'potion') count += (it.stack || 1);
    }
    return count;
  }

  // Per-button live state polling: cooldown enable/disable, dynamic potion
  // label (count + cooldown overlay), interact button tap-feedback flash.
  function _pollEnabledState(decorations, scene) {
    decorations.forEach((dec) => {
      // Standard cooldown-text-driven enable/disable
      const cdVisible = !!(dec.cdText && dec.cdText.visible);
      _applyEnabledVisual(dec, !cdVisible);

      // Potion-specific: live count + cooldown overlay
      if (dec.key === 'potion') {
        const count = _countPotionsInInventory();
        const labelText = 'x' + count;
        if (dec.label && dec.label.text !== labelText) {
          dec.label.setText(labelText);
          dec.label.setColor(count > 0 ? '#ffffff' : '#888888');
        }
        const onCd = !!(window.LootSystem && typeof window.LootSystem.isPotionOnCooldown === 'function'
          && window.LootSystem.isPotionOnCooldown());
        const remainMs = onCd && typeof window.LootSystem._getPotionCooldownRemaining === 'function'
          ? window.LootSystem._getPotionCooldownRemaining() : 0;
        const usable = count > 0 && !onCd;
        // Override the cdText-based enable: potion has no cdText node, so we
        // drive its enabled state directly from count + isPotionOnCooldown.
        _applyEnabledVisual(dec, usable);
        if (dec.cdOverlay) {
          if (onCd && remainMs > 0) {
            dec.cdOverlay.setText((remainMs / 1000).toFixed(1));
            dec.cdOverlay.setVisible(true);
            if (dec.icon) dec.icon.setAlpha(0.35);
          } else {
            dec.cdOverlay.setVisible(false);
          }
        }
      }

      // Interact-specific: visual tap-feedback when __MOBILE_INTERACT_ACTIVE__
      // pulses true (set by mobileControls._interact). One-shot tween.
      if (dec.key === 'interact') {
        const active = !!window.__MOBILE_INTERACT_ACTIVE__;
        if (active && !dec._lastInteractFlag && scene && scene.tweens) {
          dec._lastInteractFlag = true;
          // Scale-pulse + color flash on the underlying circle
          if (dec.circle && dec.circle.setScale) {
            scene.tweens.add({
              targets: dec.circle,
              scale: { from: 1.0, to: 1.25 },
              duration: 100,
              yoyo: true,
              ease: 'Sine.Out'
            });
          }
          if (dec.icon && dec.icon.setScale) {
            scene.tweens.add({
              targets: dec.icon,
              scale: { from: 1.0, to: 1.3 },
              duration: 100,
              yoyo: true,
              ease: 'Sine.Out'
            });
          }
          // Brief brighten of the original tint
          if (dec.circle && dec.circle.setFillStyle) {
            const orig = dec.originalColor;
            dec.circle.setFillStyle(0xffffff, 0.85);
            if (scene.time && scene.time.delayedCall) {
              scene.time.delayedCall(120, () => {
                if (dec.circle && dec.circle.active) dec.circle.setFillStyle(orig, 0.6);
              });
            }
          }
        } else if (!active && dec._lastInteractFlag) {
          dec._lastInteractFlag = false;
        }
      }
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

    const poll = () => _pollEnabledState(decorations, scene);
    // Poll enabled state each tick — cheap (visibility check on 6 text nodes).
    scene.events.on('update', poll);

    // Re-place icon + label on layout changes (resize).
    const onChanged = () => decorations.forEach((d) => d.place());
    window.addEventListener('demonfall:mobile-layout-changed', onChanged);

    // Refresh i18n labels when the active language changes (the potion
    // 'x{count}' label is dynamic and skipped — its polling tick rewrites
    // it each frame regardless of language).
    const refreshLabels = () => {
      decorations.forEach((d) => {
        if (d.label && d.labelKey) {
          d.label.setText(T(d.labelKey, d.labelLiteral || ''));
        }
      });
    };
    let unsubI18n = null;
    if (window.i18n && typeof window.i18n.onChange === 'function') {
      unsubI18n = window.i18n.onChange(refreshLabels);
    }

    // Clean up on scene shutdown
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off('update', poll);
      window.removeEventListener('demonfall:mobile-layout-changed', onChanged);
      if (typeof unsubI18n === 'function') { try { unsubI18n(); } catch (e) {} }
      decorations.forEach((d) => {
        d.icon && d.icon.destroy();
        d.label && d.label.destroy();
        d.cdOverlay && d.cdOverlay.destroy();
      });
      sceneState.delete(scene);
    });

    sceneState.set(scene, { decorations, poll, onChanged, unsubI18n });
  }

  window.addEventListener('demonfall:mobile-layout-ready', onLayoutReady);

  // Exports for tests / other WPs
  window.mobileAbilityButtonsDecorate = onLayoutReady;
  window.styleCooldownText = _styleCooldownText;
})();
