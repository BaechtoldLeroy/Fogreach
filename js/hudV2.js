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
      'hud.menu.btn.talents': 'Talente',
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
      'hud.stats.label.move_speed': 'Lauftempo',
      // #124: Nebenhand.
      'hud.stats.label.block': 'Blockchance',
      'hud.stats.label.brand': 'Brandchance',
      'hud.stats.label.sicht': 'Sichtweite',
      'hud.stats.points': 'Pkt.',
      'hud.stats.attributes': '— Attribute (von Items) —',
      'hud.stats.label.strength': 'Stärke',
      'hud.stats.label.dexterity': 'Geschicklichkeit',
      'hud.stats.label.vitality': 'Vitalität',
      'hud.stats.label.focus': 'Fokus',
      'hud.tooltip.portrait': 'Charakter (klicken für Stats)',
      'hud.tooltip.menu': 'Menü',
      'hud.tooltip.inventory': 'Inventar (I)'
    });
    window.i18n.register('en', {
      'hud.menu.title': 'Menu',
      'hud.menu.btn.loadout': 'Ability Loadout',
      'hud.menu.btn.talents': 'Talents',
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
      'hud.stats.label.move_speed': 'Movement Speed',
      'hud.stats.label.block': 'Block Chance',
      'hud.stats.label.brand': 'Burn Chance',
      'hud.stats.label.sicht': 'Sight',
      'hud.stats.points': 'pts',
      'hud.stats.attributes': '— Attributes (from items) —',
      'hud.stats.label.strength': 'Strength',
      'hud.stats.label.dexterity': 'Dexterity',
      'hud.stats.label.vitality': 'Vitality',
      'hud.stats.label.focus': 'Focus',
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

    // ALWAYS rebuild — scene shutdown destroys all GameObjects, so any prior
    // HUDv2.elements references are stale (point at dead Phaser objects whose
    // setSize/setText silently no-op). Returning early on `scene === HUDv2.scene`
    // was the bug: when the GameScene instance is reused after Hub→Dungeon,
    // the elements look populated but are unusable.
    HUDv2.scene = scene;
    HUDv2.elements = {};
    HUDv2.lowHpStage = 0;
    if (HUDv2.pulseTween) { try { HUDv2.pulseTween.stop(); } catch (e) {} HUDv2.pulseTween = null; }

    _buildTopLeft(scene);
    _buildTopRight(scene);
    _buildVignette(scene);

    // Reset state on scene shutdown so next build() doesn't trip over dead
    // tweens / element refs.
    if (scene.events && typeof scene.events.once === 'function') {
      scene.events.once('shutdown', () => {
        if (HUDv2.pulseTween) { try { HUDv2.pulseTween.stop(); } catch (e) {} HUDv2.pulseTween = null; }
        HUDv2.scene = null;
        HUDv2.elements = null;
        HUDv2.lowHpStage = 0;
        HUDv2._statsContainer = null;
        HUDv2._menuContainer = null;
      });
    }

    // Re-render on language change
    if (window.i18n && !HUDv2._i18nWired) {
      HUDv2._i18nWired = true;
      window.i18n.onChange(() => update());
    }

    // Initial render
    update();
  }

  function _buildTopLeft(scene) {
    // Use absolute scene positions instead of a container — interactive
    // children inside containers can be flaky for input hit-testing in
    // Phaser 3, especially when other scene-wide pointer handlers are active.
    const x0 = 12;
    const y0 = 12;

    // Portrait — circular frame with clickable hit zone
    const portraitCx = x0 + PORTRAIT_R;
    const portraitCy = y0 + PORTRAIT_R;
    const portraitBg = scene.add.circle(portraitCx, portraitCy, PORTRAIT_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(HUD_DEPTH);
    const portraitGlow = scene.add.circle(portraitCx, portraitCy, PORTRAIT_R + 2, 0xff4040, 0)
      .setStrokeStyle(3, 0xff4040, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    const portraitIcon = scene.add.text(portraitCx, portraitCy, '\u2694', {
      fontFamily: 'serif', fontSize: '28px', color: '#ffd166'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    // Dedicated rectangle hit zone above the visual circle (rectangles have
    // reliable hit-testing across Phaser versions).
    const portraitHit = scene.add.rectangle(portraitCx, portraitCy, PORTRAIT_R * 2, PORTRAIT_R * 2, 0x000000, 0)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 2)
      .setInteractive({ useHandCursor: true });
    portraitHit.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      _openStatsMenu(scene);
    });

    // HP bar
    const hpX = x0 + PORTRAIT_R * 2 + 12;
    const hpY = y0 + 6;
    const hpFrame = scene.add.rectangle(hpX, hpY, HP_BAR_W, HP_BAR_H, 0x000000, 0.8)
      .setOrigin(0).setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(HUD_DEPTH);
    const hpFillBg = scene.add.rectangle(hpX + 2, hpY + 2, HP_BAR_W - 4, HP_BAR_H - 4, 0x3a1010, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(HUD_DEPTH);
    const hpFill = scene.add.rectangle(hpX + 2, hpY + 2, HP_BAR_W - 4, HP_BAR_H - 4, 0xc0392b, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const hpText = scene.add.text(hpX + HP_BAR_W / 2, hpY + HP_BAR_H / 2, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 2);

    // XP bar (thinner, below HP)
    const xpX = hpX;
    const xpY = hpY + HP_BAR_H + 4;
    const xpFrame = scene.add.rectangle(xpX, xpY, XP_BAR_W, XP_BAR_H, 0x000000, 0.8)
      .setOrigin(0).setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(HUD_DEPTH);
    const xpFill = scene.add.rectangle(xpX + 1, xpY + 1, XP_BAR_W - 2, XP_BAR_H - 2, 0x88ff88, 1)
      .setOrigin(0).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const levelText = scene.add.text(xpX, xpY + XP_BAR_H + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#aabbff',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const goldText = scene.add.text(xpX + XP_BAR_W, xpY + XP_BAR_H + 2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffd166',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(HUD_DEPTH + 1);

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

    // Burger menu — direct scene children, absolute positions, dedicated hit zone
    const burgerCx = cw - 12 - ICON_R;
    const burgerCy = 12 + ICON_R;
    const burgerBg = scene.add.circle(burgerCx, burgerCy, ICON_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(HUD_DEPTH);
    const burgerIcon = scene.add.text(burgerCx, burgerCy, '\u2630', {
      fontFamily: 'serif', fontSize: '24px', color: '#ffd166'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const burgerHit = scene.add.rectangle(burgerCx, burgerCy, ICON_R * 2, ICON_R * 2, 0x000000, 0)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 2)
      .setInteractive({ useHandCursor: true });
    burgerHit.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      _openMenuOverlay(scene);
    });

    // Inventory icon (below burger)
    const invCx = cw - 12 - ICON_R;
    const invCy = burgerCy + (ICON_R * 2 + 8);
    const invBg = scene.add.circle(invCx, invCy, ICON_R, 0x10131c, 0.95)
      .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(HUD_DEPTH);
    const invIcon = scene.add.text(invCx, invCy, '\u{1F392}', {
      fontFamily: 'serif', fontSize: '22px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 1);
    const invHit = scene.add.rectangle(invCx, invCy, ICON_R * 2, ICON_R * 2, 0x000000, 0)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 2)
      .setInteractive({ useHandCursor: true });
    invHit.on('pointerdown', (pointer, lx, ly, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (typeof window.openInventory === 'function') {
        window.openInventory();
      } else if (typeof openInventory === 'function') {
        openInventory();
      }
    });

    HUDv2.elements.burgerBg = burgerBg;
    HUDv2.elements.invBg = invBg;
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
    HUDv2.elements.hpText.setText(Math.round(cur) + ' / ' + Math.round(max));

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
    const panelW = Math.min(400, cw - 28);
    // Responsiv: nie größer als der Bildschirm. Inhalt wird bei Überlauf gescrollt.
    const panelH = Math.min(500, ch - 24);
    const px = cw / 2;
    const py = ch / 2;

    const overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(2500).setInteractive();
    const panel = scene.add.graphics().setScrollFactor(0).setDepth(2501);
    panel.fillStyle(0x10131c, 0.97).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(3, 0xd4a543, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

    const title = scene.add.text(px, py - panelH / 2 + 10, T('hud.stats.title'), {
      fontFamily: 'serif', fontSize: '20px', color: '#ffd166', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2502);

    const cur = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
    const max = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : 1;
    const wpd = (typeof window.weaponDamage === 'number') ? window.weaponDamage : (typeof weaponDamage !== 'undefined' ? weaponDamage : 0);
    const was = (typeof window.weaponAttackSpeed === 'number') ? window.weaponAttackSpeed : (typeof weaponAttackSpeed !== 'undefined' ? weaponAttackSpeed : 0);
    const rng = (typeof window.attackRange === 'number') ? window.attackRange : (typeof attackRange !== 'undefined' ? attackRange : 0);
    const arm = (typeof window.playerArmor === 'number') ? window.playerArmor : (typeof playerArmor !== 'undefined' ? playerArmor : 0);
    const crt = (typeof window.playerCritChance === 'number') ? window.playerCritChance : (typeof playerCritChance !== 'undefined' ? playerCritChance : 0);
    const spd = (typeof window.playerSpeed === 'number') ? window.playerSpeed : (typeof playerSpeed !== 'undefined' ? playerSpeed : 0);
    // playerXP / neededXP / playerLevel are script-scoped `let`s in main.js
    // and only show up under `window` when explicit assignments mirror them
    // (eventSystem + questSystem do so on grant; main.js itself does not).
    // Mirror the Mini-HUD pattern at line 267 and fall back to the
    // script-scoped binding so the menu shows the real values, not defaults.
    const xp = (typeof window.playerXP === 'number') ? window.playerXP : (typeof playerXP !== 'undefined' ? playerXP : 0);
    const need = (typeof window.neededXP === 'number') ? window.neededXP : (typeof neededXP !== 'undefined' ? neededXP : 1);
    const lvl = (typeof window.playerLevel === 'number') ? window.playerLevel : (typeof playerLevel !== 'undefined' ? playerLevel : 1);
    // #60: D2-Kern-Attribute (nur von Items; in recalcDerived nach window gespiegelt).
    const _s = (typeof window.playerStrength === 'number') ? window.playerStrength : 0;
    const _d = (typeof window.playerDexterity === 'number') ? window.playerDexterity : 0;
    const _v = (typeof window.playerVitality === 'number') ? window.playerVitality : 0;
    const _vhp = (typeof window.playerVitalityHp === 'number') ? window.playerVitalityHp : 0;
    // Die Zahl kommt aus recalcDerived, nicht aus einer zweiten Rechnung hier:
    // sonst zeigt der Bogen beim naechsten Nachziehen etwas anderes an, als
    // das Spiel tut.
    const _vreg = (typeof window.playerVitalityRegen === 'number') ? window.playerVitalityRegen : 0;
    // #124: Nebenhand-Wirkungen.
    const _blk = (typeof window.playerBlockChance === 'number') ? window.playerBlockChance : 0;
    const _brn = (typeof window.playerBrandChance === 'number') ? window.playerBrandChance : 0;
    const _sch = (typeof window.playerSichtBonus === 'number') ? window.playerSichtBonus : 0;
    const _f = (typeof window.playerFocus === 'number') ? window.playerFocus : 0;

    // #122/#104: Ruestung, Krit und Lauftempo stehen auf der Ausruestung als
    // ABSOLUTE Punkte, die mit der Fundtiefe gewachsen sind. Was sie hier
    // bewirken, entscheidet die aktuelle Tiefe.
    //
    // Der Bogen erklaert das nicht mehr: die Zeilen oben zeigen einfach, was
    // gerade gilt, die Attributzeilen die Punkte vom Stueck. Eine Fusszeile
    // ueber die Umrechnung war Erklaerung fuer eine Darstellung, die es nicht
    // mehr gibt.
    const _LS = window.LootSystem;
    function _punkte(stat, affixKey) {
      if (!_LS) return 0;
      let p = 0;
      if (typeof _LS.basisPunkteSumme === 'function') p += _LS.basisPunkteSumme(stat);
      if (affixKey && typeof _LS.affixPunkteSumme === 'function') p += _LS.affixPunkteSumme(affixKey);
      return Math.round(p * 10) / 10;
    }
    const rows = [
      [T('hud.stats.label.health'), Math.round(cur) + ' / ' + Math.round(max)],
      [T('hud.stats.label.level'), String(lvl)],
      [T('hud.stats.label.xp'), xp + ' / ' + need],
      [T('hud.stats.label.damage'), String(wpd)],
      [T('hud.stats.label.attack_speed'), Number(was).toFixed(2)],
      // Reichweite ist eine Pixelzahl. Die Nachkommastellen kamen aus der
      // Affixrechnung und sagten nichts — 118,4 statt 118 ist keine
      // Auskunft, die man beim Vergleichen braucht.
      [T('hud.stats.label.range'), String(Math.round(rng))],
      // Hier steht nur noch, was der Wert BEWIRKT. Die Punkte daneben
      // ("16% (36.3 Pkt.)") waren eine Zwischengroesse: sie erklaerten die
      // Umrechnung, aber die Zeile mit der Tiefe weiter unten tut das auch —
      // und die Punkte selbst liest man am Gegenstand ab.
      [T('hud.stats.label.armor'), Math.round(arm * 100) + '%'],
      [T('hud.stats.label.crit'), (crt * 100).toFixed(1) + '%'],
      [T('hud.stats.label.move_speed'), String(Math.round(spd))],
      // #124: Nur zeigen, wenn ueberhaupt etwas da ist — drei Nullzeilen im
      // Bogen waeren fuer jeden ohne Nebenhand-Stueck reines Rauschen.
    ].concat(_blk > 0 ? [[T('hud.stats.label.block'), Math.round(_blk * 100) + '%']] : [])
     .concat(_brn > 0 ? [[T('hud.stats.label.brand'), Math.round(_brn * 100) + '%']] : [])
     .concat(_sch > 0 ? [[T('hud.stats.label.sicht'), '+' + Math.round(_sch * 100) + '%']] : []);
    // #104: Die Attribute stehen auf der Ausruestung als ABSOLUTE Punkte und
    // werden mit der aktuellen Tiefe umgerechnet. Beide Zahlen nebeneinander zu
    // zeigen ("18.8 (7.5 Pkt.)") half nicht: die umgerechnete Punktzahl ist eine
    // Zwischengroesse, die fuer sich genommen nichts aussagt.
    //
    // Deshalb hier nur die Punkte vom Stueck — dieselbe Zahl, die auch im
    // Tooltip steht, also unmittelbar vergleichbar. Was sie BEWIRKEN, sagt die
    // Zeile darunter, und zwar in Einheiten, die man kennt (Waffenschaden,
    // Lebenspunkte, Abklingzeit). Die Umrechnung passiert dort still.
    const _a1 = (x) => String(Math.round(x * 10) / 10);
    /** Die Punkte, die auf der Ausruestung STEHEN — ohne die Umrechnung. */
    const _attrPunkte = (stat) => {
      const p = _punkte(stat, stat);
      return p ? p + ' ' + T('hud.stats.points') : '0';
    };
    const attrDefs = [
      { label: T('hud.stats.label.strength'), val: _attrPunkte('strength'),
        desc: '+' + _a1(_s) + '% Waffenschaden · +' + (_s * 1.5).toFixed(1) + '% Krit-Schaden' },
      { label: T('hud.stats.label.dexterity'), val: _attrPunkte('dexterity'),
        desc: '+' + (_d * 1).toFixed(1) + '% Tempo · +' + (_d * 0.67).toFixed(1) + '% Krit · +' + (_d * 0.83).toFixed(1) + '% Ausweichen' },
      { label: T('hud.stats.label.vitality'), val: _attrPunkte('vitality'),
        // #114: Die Lebenspunkte stehen ABSOLUT da. Sie folgen nicht mehr aus
        // der Punktzahl daneben, sondern haengen an der Fundtiefe der Stuecke
        // — ein Prozentsatz an dieser Stelle waere schlicht falsch.
        desc: '+' + _vhp + ' Max-LP · +' + _vreg.toFixed(2) + ' LP/s Regen' },
      { label: T('hud.stats.label.focus'), val: _attrPunkte('focus'),
        desc: '−' + Math.min(40, _f * 1).toFixed(0) + '% Cooldown · +' + (_f * 1.25).toFixed(1) + '% Fähigkeitsschaden' }
    ];

    // Scrollbereich zwischen Titel und Close-Button.
    const viewTop = py - panelH / 2 + 40;
    const viewBottom = py + panelH / 2 - 40;
    const viewH = viewBottom - viewTop;

    // Inhalt kommt in einen Container -> bei Überlauf scrollbar (Maske + Leiste).
    const content = scene.add.container(0, 0).setScrollFactor(0).setDepth(2502);
    const ROW_H = 22;
    let cy = viewTop + 2;
    rows.forEach((r) => {
      content.add(scene.add.text(px - panelW / 2 + 20, cy, r[0] + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd0ff'
      }).setScrollFactor(0));
      content.add(scene.add.text(px + panelW / 2 - 20, cy, r[1], {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffe28a'
      }).setOrigin(1, 0).setScrollFactor(0));
      cy += ROW_H;
    });
    cy += 6;
    content.add(scene.add.text(px - panelW / 2 + 20, cy, T('hud.stats.attributes') + ':', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffd166', fontStyle: 'bold'
    }).setScrollFactor(0));
    cy += 22;
    attrDefs.forEach((a) => {
      content.add(scene.add.text(px - panelW / 2 + 20, cy, a.label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd0ff'
      }).setScrollFactor(0));
      content.add(scene.add.text(px + panelW / 2 - 20, cy, String(a.val), {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffe28a'
      }).setOrigin(1, 0).setScrollFactor(0));
      content.add(scene.add.text(px - panelW / 2 + 32, cy + 15, a.desc, {
        fontFamily: 'monospace', fontSize: '10px', color: '#8a8fb0',
        wordWrap: { width: panelW - 54 }
      }).setScrollFactor(0));
      cy += 34;
    });
    // Nur fuer tests/ und Sonden: der Inhalt liegt in einem Container und ist
    // sonst von aussen nicht erreichbar.
    HUDv2._statsInhalt = content;
    const contentH = cy - (viewTop + 2);
    const scrollMax = Math.max(0, contentH - viewH);

    // Scroll nur einrichten, wenn der Inhalt wirklich überläuft.
    let maskG = null, track = null, thumb = null, wheelHandler = null;
    if (scrollMax > 0) {
      maskG = scene.make.graphics();
      if (typeof maskG.setScrollFactor === 'function') maskG.setScrollFactor(0);
      maskG.fillStyle(0xffffff).fillRect(px - panelW / 2 + 4, viewTop, panelW - 8, viewH);
      content.setMask(maskG.createGeometryMask());

      const trackX = px + panelW / 2 - 10;
      track = scene.add.rectangle(trackX, viewTop + viewH / 2, 6, viewH, 0x000000, 0.35)
        .setScrollFactor(0).setDepth(2503);
      const thumbH = Math.max(24, Math.round(viewH * (viewH / contentH)));
      const minThumbY = viewTop + thumbH / 2, maxThumbY = viewBottom - thumbH / 2;
      thumb = scene.add.rectangle(trackX, minThumbY, 9, thumbH, 0xd4a543, 0.9)
        .setScrollFactor(0).setDepth(2504).setInteractive({ useHandCursor: true });
      let scrollY = 0;
      const applyScroll = () => {
        scrollY = Phaser.Math.Clamp(scrollY, 0, scrollMax);
        content.y = -scrollY;
        const frac = scrollMax > 0 ? scrollY / scrollMax : 0;
        thumb.y = minThumbY + frac * (maxThumbY - minThumbY);
      };
      scene.input.setDraggable(thumb);
      thumb.on('drag', (p, dx, dy) => {
        const span = Math.max(1, maxThumbY - minThumbY);
        scrollY = Phaser.Math.Clamp((dy - minThumbY) / span, 0, 1) * scrollMax;
        applyScroll();
      });
      wheelHandler = (p, over, dx, dy) => { scrollY += dy * 0.5; applyScroll(); };
      scene.input.on('wheel', wheelHandler);
    }

    const closeBtn = scene.add.text(px, py + panelH / 2 - 22, T('hud.menu.btn.close'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8',
      backgroundColor: '#3a3a3a', padding: { x: 12, y: 5 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2505).setInteractive({ useHandCursor: true });

    const close = () => {
      if (wheelHandler) { try { scene.input.off('wheel', wheelHandler); } catch (e) {} }
      [overlay, panel, title, closeBtn, content, maskG, track, thumb].forEach((o) => {
        if (o) { try { o.destroy(); } catch (e) {} }
      });
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

    // Die Eintraege stehen VOR der Geometrie, weil die Panelhoehe sich aus
    // ihrer Zahl ergibt. Mit der frueheren festen 400 waere der sechste Knopf
    // in die Schliessen-Zeile gelaufen.
    const items = [
      // Die Charakterwerte lagen bisher NUR hinter dem Portrait im HUD — ein
      // Klickziel ohne Beschriftung. Hier stehen sie zuerst, weil man sie
      // haeufiger nachschlaegt als alles andere im Menue.
      { label: T('hud.stats.title'), action: () => { _openStatsMenu(scene); } },
      { label: T('hud.menu.btn.loadout'), action: () => {
          if (typeof window.openLoadoutUI === 'function') window.openLoadoutUI(scene);
        } },
      { label: T('hud.menu.btn.talents'), action: () => {
          if (typeof window.openSkillTreeScene === 'function') window.openSkillTreeScene(scene);
        } },
      { label: T('hud.menu.btn.journal'), action: () => {
          if (window.storySystem && typeof window.storySystem.showJournalOverlay === 'function') {
            window.storySystem.showJournalOverlay(scene, () => {});
          }
        } },
      { label: T('hud.menu.btn.settings'), action: () => {
          if (typeof window.openSettingsScene === 'function') window.openSettingsScene(scene);
        } },
      { label: 'FPS Overlay', action: () => {
          if (!scene._perfMonitor && window.PerformanceMonitor) {
            scene._perfMonitor = new window.PerformanceMonitor(scene);
          }
          if (scene._perfMonitor && typeof scene._perfMonitor.toggleOverlay === 'function') {
            scene._perfMonitor.toggleOverlay();
          }
        } }
    ];

    const panelW = 280;
    // 60 px Kopfzeile, je Eintrag 56 px, 40 px fuer den Schliessen-Knopf.
    const panelH = 60 + items.length * 56 + 40;
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
        // Run the action FIRST, then close. delayedCall + close-first was
        // racy when the parent scene was paused (no time-step → action
        // never fired). Synchronous order is more reliable.
        try {
          if (typeof it.action === 'function') it.action();
        } catch (e) {
          console.warn('[HUDv2] menu action threw', e);
        }
        close();
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
  // Öffentlicher Menü-Opener, damit auch Nicht-Dungeon-Scenes (z.B. der Hub)
  // dasselbe Menü-Overlay öffnen können (Talente/Loadout/Journal/Einstellungen).
  HUDv2.openMenu = function (scene) {
    if (scene && scene.cameras && scene.cameras.main) _openMenuOverlay(scene);
  };
  // Dieselbe Werteansicht wie hinter dem Portrait — als Einstieg fuer das
  // Inventar, das in einer anderen Datei liegt.
  HUDv2.openStats = function (scene) {
    if (scene && scene.cameras && scene.cameras.main) _openStatsMenu(scene);
  };
  window.HUDv2 = HUDv2;
})();
