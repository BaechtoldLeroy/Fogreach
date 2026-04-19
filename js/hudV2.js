// hudV2.js — Diablo Immortal-style HUD overlay.
// Single entry point: window.HUDv2.build(scene). Reads global player state
// (playerHealth, playerMaxHealth, playerXP, neededXP, materialCounts.GOLD,
// playerLevel) and renders bars + portrait + menu/inventory icons.
//
// Old text-stack elements (playerHealthText, playerXPText, _goldText,
// weaponStatsText, _roomCounterText) remain wired so legacy setText calls
// don't crash; we hide them and route updates through HUDv2.update().

(function () {
  'use strict';

  if (window.i18n) {
    window.i18n.register('de', {
      'hud.menu.title': 'Menü',
      'hud.menu.btn.loadout': 'Fähigkeiten-Loadout',
      'hud.menu.btn.journal': 'Journal',
      'hud.menu.btn.settings': 'Einstellungen',
      'hud.menu.btn.close': 'Schließen [ESC]',
      'hud.stats.title': 'Charakterwerte',
      'hud.stats.label.health': 'Lebenspunkte',
      'hud.stats.label.level': 'Stufe',
      'hud.stats.label.xp': 'Erfahrung',
      'hud.stats.label.damage': 'Schaden',
      'hud.stats.label.attack_speed': 'Angriffstempo',
      'hud.stats.label.range': 'Reichweite',
      'hud.stats.label.armor': 'Rüstung',
      'hud.stats.label.crit': 'Krit. Chance',
      'hud.stats.label.move_speed': 'Bewegungstempo',
      'hud.tooltip.portrait': 'Charakter (klicken für Stats)',
      'hud.tooltip.menu': 'Menü',
      'hud.tooltip.inventory': 'Inventar (I)'
    });
    window.i18n.register('en', {
      'hud.menu.title': 'Menu',
      'hud.menu.btn.loadout': 'Ability Loadout',
      'hud.menu.btn.journal': 'Journal',
      'hud.menu.btn.settings': 'Settings',
      'hud.menu.btn.close': 'Close [ESC]',
      'hud.stats.title': 'Character Stats',
      'hud.stats.label.health': 'Health',
      'hud.stats.label.level': 'Level',
      'hud.stats.label.xp': 'Experience',
      'hud.stats.label.damage': 'Damage',
      'hud.stats.label.attack_speed': 'Attack Speed',
      'hud.stats.label.range': 'Range',
      'hud.stats.label.armor': 'Armor',
      'hud.stats.label.crit': 'Crit Chance',
      'hud.stats.label.move_speed': 'Move Speed',
      'hud.tooltip.portrait': 'Character (click for stats)',
      'hud.tooltip.menu': 'Menu',
      'hud.tooltip.inventory': 'Inventory (I)'
    });
  }
  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  // ---- Layout constants ----
  const HUD_DEPTH = 1600; // above minimap (1500) but below dialogs (2000+)
  const PORTRAIT_R = 26;
  const HP_BAR_W = 220;
  const HP_BAR_H = 18;
  const XP_BAR_W = 220;
  const XP_BAR_H = 6;
  const ICON_R = 22;

  // ---- State ----
  const HUDv2 = {
    scene: null,
    elements: null, // { hpFill, hpText, xpFill, xpText, goldText, portraitGlow, vignette, ... }
    pulseTween: null,
    lowHpStage: 0 // 0=ok, 1=below 40%, 2=below 20%
  };

  function build(scene) {
    if (!scene || !scene.add) return;
    if (HUDv2.scene === scene && HUDv2.elements) return; // already built for this scene

    HUDv2.scene = scene;
    HUDv2.elements = {};
    HUDv2.lowHpStage = 0;
    if (HUDv2.pulseTween) { try { HUDv2.pulseTween.stop(); } catch (e) {} HUDv2.pulseTween = null; }

    _buildTopLeft(scene);
    _buildTopRight(scene);
    _buildVignette(scene);

    // Re-render on language change
    if (window.i18n && !HUDv2._i18nWired) {
      HUDv2._i18nWired = true;
      window.i18n.onChange(() => update());
    }

    // Initial render
    update();
  }

  function _buildTopLeft(scene) {
    const x0 = 12;
    const y0 = 12;
    const c = scene.add.container(x0, y0).setDepth(HUD_DEPTH).setScrollFactor(0);

    // Portrait — circular frame, clickable
    const portraitBg = scene.add.circle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543);
    const portraitGlow = scene.add.circle(PORTRAIT_R, PORTRAIT_R, PORTRAIT_R + 2, 0xff4040, 0)
      .setStrokeStyle(3, 0xff4040, 0); // visible only at low HP
    const portraitIcon = scene.add.text(PORTRAIT_R, PORTRAIT_R, '\u2694', {
      fontFamily: 'serif', fontSize: '28px', color: '#ffd166'
    }).setOrigin(0.5);
    const portraitHit = scene.add.zone(0, 0, PORTRAIT_R * 2, PORTRAIT_R * 2)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    portraitHit.on('pointerdown', (pointer, x, y, event) => {
      event && event.stopPropagation && event.stopPropagation();
      _openStatsMenu(scene);
    });

    // HP bar
    const hpX = PORTRAIT_R * 2 + 12;
    const hpY = 6;
    const hpFrame = scene.add.rectangle(hpX, hpY, HP_BAR_W, HP_BAR_H, 0x000000, 0.8)
      .setOrigin(0).setStrokeStyle(2, 0xd4a543);
    const hpFillBg = scene.add.rectangle(hpX + 2, hpY + 2, HP_BAR_W - 4, HP_BAR_H - 4, 0x3a1010, 1)
      .setOrigin(0);
    const hpFill = scene.add.rectangle(hpX + 2, hpY + 2, HP_BAR_W - 4, HP_BAR_H - 4, 0xc0392b, 1)
      .setOrigin(0);
    const hpText = scene.add.text(hpX + HP_BAR_W / 2, hpY + HP_BAR_H / 2, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // XP bar (thinner, below HP)
    const xpX = hpX;
    const xpY = hpY + HP_BAR_H + 4;
    const xpFrame = scene.add.rectangle(xpX, xpY, XP_BAR_W, XP_BAR_H, 0x000000, 0.8)
      .setOrigin(0).setStrokeStyle(1, 0x666666);
    const xpFill = scene.add.rectangle(xpX + 1, xpY + 1, XP_BAR_W - 2, XP_BAR_H - 2, 0x88ff88, 1)
      .setOrigin(0);
    const levelText = scene.add.text(xpX, xpY + XP_BAR_H + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#aabbff',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0);
    const goldText = scene.add.text(xpX + XP_BAR_W, xpY + XP_BAR_H + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffd166',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(1, 0);

    c.add([portraitBg, portraitGlow, portraitIcon, portraitHit,
           hpFrame, hpFillBg, hpFill, hpText,
           xpFrame, xpFill, levelText, goldText]);

    HUDv2.elements.topLeft = c;
    HUDv2.elements.portraitGlow = portraitGlow;
    HUDv2.elements.hpFill = hpFill;
    HUDv2.elements.hpText = hpText;
    HUDv2.elements.xpFill = xpFill;
    HUDv2.elements.levelText = levelText;
    HUDv2.elements.goldText = goldText;
    HUDv2.elements.hpBarMaxW = HP_BAR_W - 4;
    HUDv2.elements.xpBarMaxW = XP_BAR_W - 2;
  }

  function _buildTopRight(scene) {
    const cw = scene.cameras.main.width;
    const x0 = cw - 12;
    const y0 = 12;
    const c = scene.add.container(x0, y0).setDepth(HUD_DEPTH).setScrollFactor(0);

    // Burger menu (top icon — directly under top edge)
    const burgerBg = scene.add.circle(-ICON_R, ICON_R, ICON_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543).setInteractive({ useHandCursor: true });
    const burgerIcon = scene.add.text(-ICON_R, ICON_R, '\u2630', {
      fontFamily: 'serif', fontSize: '24px', color: '#ffd166'
    }).setOrigin(0.5);
    burgerBg.on('pointerdown', (pointer, x, y, event) => {
      event && event.stopPropagation && event.stopPropagation();
      _openMenuOverlay(scene);
    });

    // Inventory icon (below burger)
    const invBg = scene.add.circle(-ICON_R, ICON_R + (ICON_R * 2 + 8), ICON_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543).setInteractive({ useHandCursor: true });
    const invIcon = scene.add.text(-ICON_R, ICON_R + (ICON_R * 2 + 8), '\u{1F392}', {
      fontFamily: 'serif', fontSize: '22px'
    }).setOrigin(0.5);
    invBg.on('pointerdown', (pointer, x, y, event) => {
      event && event.stopPropagation && event.stopPropagation();
      if (typeof window.openInventory === 'function') {
        window.openInventory();
      } else if (typeof openInventory === 'function') {
        openInventory();
      }
    });

    c.add([burgerBg, burgerIcon, invBg, invIcon]);
    HUDv2.elements.topRight = c;
  }

  function _buildVignette(scene) {
    const cw = scene.cameras.main.width;
    const ch = scene.cameras.main.height;
    // Use a graphics object to fake a radial vignette via concentric rings.
    // Cheap, no shader. Visible only when low-HP stage > 0.
    const g = scene.add.graphics().setDepth(2999).setScrollFactor(0).setVisible(false);
    const draw = (alpha) => {
      g.clear();
      const rings = 14;
      const cx = cw / 2;
      const cy = ch / 2;
      const maxR = Math.hypot(cw, ch) / 2;
      const minR = Math.min(cw, ch) * 0.30;
      for (let i = 0; i < rings; i++) {
        const t = i / rings;
        const innerR = minR + (maxR - minR) * t;
        const outerR = minR + (maxR - minR) * (t + 1.5 / rings);
        const ringAlpha = alpha * (0.04 + t * 0.10);
        g.fillStyle(0xff1a1a, ringAlpha);
        g.fillCircle(cx, cy, outerR);
        g.fillStyle(0x000000, 0);
        // (we don't subtract — overlapping fills create the gradient effect)
      }
    };
    g._drawVignette = draw;
    g.setAlpha(0);

    HUDv2.elements.vignette = g;
    // Reposition on resize
    scene.scale.on('resize', (gs) => {
      g.setPosition(0, 0);
      // Redraw at current intensity
      const stage = HUDv2.lowHpStage;
      const baseAlpha = stage === 2 ? 1.0 : (stage === 1 ? 0.55 : 0);
      g._drawVignette(baseAlpha);
    });
  }

  // ---- Update loop ----
  function update() {
    if (!HUDv2.elements) return;
    const cur = (typeof window.playerHealth === 'number') ? window.playerHealth : (typeof playerHealth !== 'undefined' ? playerHealth : 0);
    const max = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : (typeof playerMaxHealth !== 'undefined' ? playerMaxHealth : 1);
    const xp = (typeof window.playerXP === 'number') ? window.playerXP : (typeof playerXP !== 'undefined' ? playerXP : 0);
    const need = (typeof window.neededXP === 'number') ? window.neededXP : (typeof neededXP !== 'undefined' ? neededXP : 1);
    const lvl = (typeof window.playerLevel === 'number') ? window.playerLevel : (typeof playerLevel !== 'undefined' ? playerLevel : 1);
    const gold = (window.materialCounts && window.materialCounts.GOLD) || 0;

    // HP bar
    const hpPct = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));
    const hpW = Math.max(0, Math.round(HUDv2.elements.hpBarMaxW * hpPct));
    HUDv2.elements.hpFill.setSize(hpW, HUDv2.elements.hpFill.height);
    // Color shift
    let hpColor = 0xc0392b;
    if (hpPct < 0.20) hpColor = 0xff2020;
    else if (hpPct < 0.40) hpColor = 0xe06030;
    HUDv2.elements.hpFill.setFillStyle(hpColor);
    HUDv2.elements.hpText.setText(cur + ' / ' + max);

    // XP bar
    const xpPct = Math.max(0, Math.min(1, need > 0 ? xp / need : 0));
    const xpW = Math.max(0, Math.round(HUDv2.elements.xpBarMaxW * xpPct));
    HUDv2.elements.xpFill.setSize(xpW, HUDv2.elements.xpFill.height);
    HUDv2.elements.levelText.setText(T('hud.stats.label.level') + ' ' + lvl + '  ' + xp + ' / ' + need);
    HUDv2.elements.goldText.setText('\u26C3 ' + gold);

    // Low-HP vignette + pulse stages: 0=normal, 1=<40%, 2=<20%
    let stage = 0;
    if (hpPct < 0.20 && hpPct > 0) stage = 2;
    else if (hpPct < 0.40 && hpPct > 0) stage = 1;
    if (stage !== HUDv2.lowHpStage) {
      _setLowHpStage(stage);
    }
  }

  function _setLowHpStage(stage) {
    HUDv2.lowHpStage = stage;
    const v = HUDv2.elements.vignette;
    const glow = HUDv2.elements.portraitGlow;
    if (HUDv2.pulseTween) { try { HUDv2.pulseTween.stop(); } catch (e) {} HUDv2.pulseTween = null; }
    if (!v || !glow) return;

    if (stage === 0) {
      v.setVisible(false).setAlpha(0);
      glow.setStrokeStyle(0, 0, 0);
      glow.setAlpha(0);
      return;
    }

    // Stage 1: gentle pulse, lower base alpha
    // Stage 2: faster pulse, higher base alpha
    const baseAlpha = stage === 2 ? 1.0 : 0.55;
    const pulseTo = stage === 2 ? 1.0 : 0.7;
    const pulseFrom = stage === 2 ? 0.55 : 0.35;
    const duration = stage === 2 ? 480 : 880;

    v._drawVignette(baseAlpha);
    v.setVisible(true).setAlpha(pulseFrom);

    // Portrait halo
    glow.setStrokeStyle(3, stage === 2 ? 0xff2020 : 0xe06030, 0.85);
    glow.setAlpha(1);

    HUDv2.pulseTween = HUDv2.scene.tweens.add({
      targets: v,
      alpha: { from: pulseFrom, to: pulseTo },
      duration: duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  // ---- Stats menu ----
  function _openStatsMenu(scene) {
    if (HUDv2._statsContainer) return;
    const cw = scene.cameras.main.width;
    const ch = scene.cameras.main.height;
    const panelW = Math.min(420, cw - 40);
    const panelH = 360;
    const px = cw / 2;
    const py = ch / 2;

    const overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(2500).setInteractive();
    const panel = scene.add.graphics().setScrollFactor(0).setDepth(2501);
    panel.fillStyle(0x10131c, 0.97).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(3, 0xd4a543, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

    const title = scene.add.text(px, py - panelH / 2 + 14, T('hud.stats.title'), {
      fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2502);

    const cur = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
    const max = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : 1;
    const wpd = (typeof window.weaponDamage === 'number') ? window.weaponDamage : (typeof weaponDamage !== 'undefined' ? weaponDamage : 0);
    const was = (typeof window.weaponAttackSpeed === 'number') ? window.weaponAttackSpeed : (typeof weaponAttackSpeed !== 'undefined' ? weaponAttackSpeed : 0);
    const rng = (typeof window.attackRange === 'number') ? window.attackRange : (typeof attackRange !== 'undefined' ? attackRange : 0);
    const arm = (typeof window.playerArmor === 'number') ? window.playerArmor : (typeof playerArmor !== 'undefined' ? playerArmor : 0);
    const crt = (typeof window.playerCritChance === 'number') ? window.playerCritChance : (typeof playerCritChance !== 'undefined' ? playerCritChance : 0);
    const spd = (typeof window.playerSpeed === 'number') ? window.playerSpeed : (typeof playerSpeed !== 'undefined' ? playerSpeed : 0);
    const xp = (typeof window.playerXP === 'number') ? window.playerXP : 0;
    const need = (typeof window.neededXP === 'number') ? window.neededXP : 1;
    const lvl = (typeof window.playerLevel === 'number') ? window.playerLevel : 1;

    const rows = [
      [T('hud.stats.label.health'), cur + ' / ' + max],
      [T('hud.stats.label.level'), String(lvl)],
      [T('hud.stats.label.xp'), xp + ' / ' + need],
      [T('hud.stats.label.damage'), String(wpd)],
      [T('hud.stats.label.attack_speed'), Number(was).toFixed(2)],
      [T('hud.stats.label.range'), String(rng)],
      [T('hud.stats.label.armor'), Math.round(arm * 100) + '%'],
      [T('hud.stats.label.crit'), (crt * 100).toFixed(1) + '%'],
      [T('hud.stats.label.move_speed'), String(spd)]
    ];
    const rowGfx = [];
    rows.forEach((r, i) => {
      const ry = py - panelH / 2 + 56 + i * 28;
      const lbl = scene.add.text(px - panelW / 2 + 22, ry, r[0] + ':', {
        fontFamily: 'monospace', fontSize: '14px', color: '#cfd0ff'
      }).setScrollFactor(0).setDepth(2502);
      const val = scene.add.text(px + panelW / 2 - 22, ry, r[1], {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffe28a'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(2502);
      rowGfx.push(lbl, val);
    });

    const closeBtn = scene.add.text(px, py + panelH / 2 - 26, T('hud.menu.btn.close'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8',
      backgroundColor: '#3a3a3a', padding: { x: 14, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ useHandCursor: true });

    const close = () => {
      try { overlay.destroy(); } catch (e) {}
      try { panel.destroy(); } catch (e) {}
      try { title.destroy(); } catch (e) {}
      try { closeBtn.destroy(); } catch (e) {}
      rowGfx.forEach(g => { try { g.destroy(); } catch (e) {} });
      scene.input.keyboard.off('keydown-ESC', close);
      HUDv2._statsContainer = null;
    };
    closeBtn.on('pointerdown', close);
    overlay.on('pointerdown', close);
    scene.input.keyboard.on('keydown-ESC', close);

    HUDv2._statsContainer = { close };
  }

  // ---- Menu burger overlay ----
  function _openMenuOverlay(scene) {
    if (HUDv2._menuContainer) return;
    const cw = scene.cameras.main.width;
    const ch = scene.cameras.main.height;
    const panelW = 280;
    const panelH = 280;
    const px = cw / 2;
    const py = ch / 2;

    const overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(2500).setInteractive();
    const panel = scene.add.graphics().setScrollFactor(0).setDepth(2501);
    panel.fillStyle(0x10131c, 0.97).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(3, 0xd4a543, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
    const title = scene.add.text(px, py - panelH / 2 + 14, T('hud.menu.title'), {
      fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2502);

    const items = [
      { label: T('hud.menu.btn.loadout'), action: () => {
          if (typeof window.openLoadoutUI === 'function') window.openLoadoutUI(scene);
        } },
      { label: T('hud.menu.btn.journal'), action: () => {
          if (window.storySystem && typeof window.storySystem.showJournalOverlay === 'function') {
            window.storySystem.showJournalOverlay(scene, () => {});
          }
        } },
      { label: T('hud.menu.btn.settings'), action: () => {
          if (typeof window.openSettingsScene === 'function') window.openSettingsScene(scene);
        } }
    ];
    const btns = [];
    items.forEach((it, i) => {
      const by = py - panelH / 2 + 60 + i * 56;
      const bg = scene.add.rectangle(px, by, panelW - 40, 44, 0x2a2a3d)
        .setScrollFactor(0).setDepth(2502).setStrokeStyle(2, 0x4a4a6a).setInteractive({ useHandCursor: true });
      const lbl = scene.add.text(px, by, it.label, {
        fontFamily: 'monospace', fontSize: '15px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2503);
      bg.on('pointerover', () => bg.setFillStyle(0x3a3a5a));
      bg.on('pointerout', () => bg.setFillStyle(0x2a2a3d));
      bg.on('pointerdown', () => {
        close();
        // Defer so overlay-destroy flush completes before launching child UI
        scene.time.delayedCall(50, it.action);
      });
      btns.push(bg, lbl);
    });

    const closeBtn = scene.add.text(px, py + panelH / 2 - 26, T('hud.menu.btn.close'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8',
      backgroundColor: '#3a3a3a', padding: { x: 14, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502).setInteractive({ useHandCursor: true });

    const close = () => {
      try { overlay.destroy(); } catch (e) {}
      try { panel.destroy(); } catch (e) {}
      try { title.destroy(); } catch (e) {}
      try { closeBtn.destroy(); } catch (e) {}
      btns.forEach(g => { try { g.destroy(); } catch (e) {} });
      scene.input.keyboard.off('keydown-ESC', close);
      HUDv2._menuContainer = null;
    };
    closeBtn.on('pointerdown', close);
    overlay.on('pointerdown', close);
    scene.input.keyboard.on('keydown-ESC', close);

    HUDv2._menuContainer = { close };
  }

  HUDv2.build = build;
  HUDv2.update = update;
  window.HUDv2 = HUDv2;
})();
