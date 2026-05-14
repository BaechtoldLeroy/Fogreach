// PrintingHouseScene — full-overlay edict-browser for the Druckerei (#24).
// Replaces the legacy choice-list dialog inside HubSceneV2 with a dedicated
// scene that uses tier columns + edict cards + a status bar so all 10
// edicts plus suspicion/paper status are visible at a glance.
//
// Launched via window.openPrintingHouseScene(parentScene). The parent stays
// running underneath; ESC or the Close button stops this overlay.

(function () {
  if (window.i18n) {
    window.i18n.register('de', {
      'printingHouse.ui.title': 'Druckerei',
      'printingHouse.ui.subtitle': 'Welche Botschaft soll Setzer Thom drucken?',
      'printingHouse.ui.paper': 'Druckblätter',
      'printingHouse.ui.suspicion': 'Council-Verdacht',
      'printingHouse.ui.active_edict': 'Aktiv',
      'printingHouse.ui.no_active': 'Kein Edikt aktiv',
      'printingHouse.ui.tier.mild': 'Mild',
      'printingHouse.ui.tier.strong': 'Stark',
      'printingHouse.ui.tier.risky': 'Riskant',
      'printingHouse.ui.tier.mild.sub': 'unter dem Radar',
      'printingHouse.ui.tier.strong.sub': 'beobachtet',
      'printingHouse.ui.tier.risky.sub': 'Council schlägt zurück',
      'printingHouse.ui.status.locked': 'Standing {req}',
      'printingHouse.ui.status.unaffordable': 'Zu wenig Papier',
      'printingHouse.ui.status.active': 'Aktiv',
      'printingHouse.ui.status.available': 'Verfügbar',
      'printingHouse.ui.status.blocked_by_active': 'Anderes Edikt aktiv',
      'printingHouse.ui.btn.bribe': 'Bestechen  -100G · -5V',
      'printingHouse.ui.btn.tradegold': 'Tauschen  -50G · +1p',
      'printingHouse.ui.btn.close': 'Schließen [ESC]',
      'printingHouse.ui.legend.paper': 'Kosten',
      'printingHouse.ui.legend.suspicion': 'Verdacht',
      'printingHouse.ui.locked_summary': 'Noch verschlossen:',
      'printingHouse.ui.empty_state': 'Noch keine Edikte freigeschaltet — verbessere deinen Stand bei der Resistance, um stärkere Botschaften drucken zu lassen.'
    });
    window.i18n.register('en', {
      'printingHouse.ui.title': 'Printing House',
      'printingHouse.ui.subtitle': 'What message shall Setzer Thom print?',
      'printingHouse.ui.paper': 'Paper',
      'printingHouse.ui.suspicion': 'Council Suspicion',
      'printingHouse.ui.active_edict': 'Active',
      'printingHouse.ui.no_active': 'No edict active',
      'printingHouse.ui.tier.mild': 'Mild',
      'printingHouse.ui.tier.strong': 'Strong',
      'printingHouse.ui.tier.risky': 'Risky',
      'printingHouse.ui.tier.mild.sub': 'under the radar',
      'printingHouse.ui.tier.strong.sub': 'watched',
      'printingHouse.ui.tier.risky.sub': 'Council retaliates',
      'printingHouse.ui.status.locked': 'Standing {req}',
      'printingHouse.ui.status.unaffordable': 'Not enough paper',
      'printingHouse.ui.status.active': 'Active',
      'printingHouse.ui.status.available': 'Available',
      'printingHouse.ui.status.blocked_by_active': 'Another edict active',
      'printingHouse.ui.btn.bribe': 'Bribe  -100G · -5 susp',
      'printingHouse.ui.btn.tradegold': 'Trade  -50G · +1 paper',
      'printingHouse.ui.btn.close': 'Close [ESC]',
      'printingHouse.ui.legend.paper': 'Cost',
      'printingHouse.ui.legend.suspicion': 'Suspicion',
      'printingHouse.ui.locked_summary': 'Still locked:',
      'printingHouse.ui.empty_state': 'No edicts unlocked yet — raise your standing with the Resistance to print stronger messages.'
    });
  }

  const T = (k, p) => (window.i18n ? window.i18n.t(k, p) : k);

  // Per-tier color theming. Border + bg are used on the column header AND
  // each edict card belonging to that tier so the eye can group them at a
  // glance (cool/safe → warm/risky).
  const TIER_THEME = {
    mild:   { border: 0x6fb98f, bg: 0x18301c, soft: 0x1d3a22, accent: '#88ffaa', dim: '#557a64' },
    strong: { border: 0xddbb55, bg: 0x382b18, soft: 0x40331c, accent: '#ffd166', dim: '#806b3a' },
    risky:  { border: 0xdd5555, bg: 0x381818, soft: 0x431a1a, accent: '#ff8888', dim: '#7a4444' }
  };

  class PrintingHouseScene extends Phaser.Scene {
    constructor() { super({ key: 'PrintingHouseScene' }); }

    create(data) {
      this.parentSceneKey = (data && data.from) || null;
      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;

      // Dim backdrop. Slightly darker than Settings so the panel pops.
      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.78)
        .setScrollFactor(0).setDepth(2000);

      const panelW = Math.min(900, cw - 40);
      const panelH = Math.min(640, ch - 40);
      const px = cw / 2;
      const py = ch / 2;
      const panelLeft = px - panelW / 2;
      const panelTop  = py - panelH / 2;

      // Panel background
      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.97).fillRoundedRect(panelLeft, panelTop, panelW, panelH, 16);
      panel.lineStyle(3, 0xffd166, 0.92).strokeRoundedRect(panelLeft, panelTop, panelW, panelH, 16);
      // Subtle gradient overlay (top is lighter)
      panel.fillStyle(0x1c2030, 0.35).fillRoundedRect(panelLeft, panelTop, panelW, 56, 16);

      // Compact header — title only, no subtitle. Saves vertical space for
      // the card grid.
      this.add.text(px, panelTop + 14, T('printingHouse.ui.title'), {
        fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
      this.add.text(px, panelTop + 40, T('printingHouse.npc.name'), {
        fontFamily: 'serif', fontSize: '11px', color: '#888', fontStyle: 'italic'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);

      // Status bar (paper / standing / suspicion / active edict) — 4 cells
      this._renderStatusBar(panelLeft, panelTop + 64, panelW);

      // Filter to edicts the player can consider right now (tier-unlocked)
      // plus the currently active one. Tier-locked are summarised in a
      // footer line so the grid stays uncluttered.
      const ph = window.PrintingHouse;
      const fullCatalog = ph.getEdictCatalog();
      const active = ph.getActivePublication();
      const visibleEdicts = fullCatalog.filter((e) => {
        if (e.isUnlocked) return true;
        if (active && active.id === e.id) return true;
        return false;
      });

      // Card grid (2 columns, auto-rows). Smaller header + smaller action
      // bar leaves more room for cards.
      const gridTop    = panelTop + 144;
      const gridHeight = panelH - 144 - 70; // 70px reserved for action bar
      this._renderEdictGrid(panelLeft + 18, gridTop, panelW - 36, gridHeight, visibleEdicts, fullCatalog.length);

      // Action bar at the bottom
      this._renderActionBar(panelLeft, panelTop + panelH - 56, panelW);

      // Keys: ESC closes; E (interaction key) also closes so the player
      // doesn't get stuck pressing it again at the entrance.
      this.input.keyboard.on('keydown-ESC', () => this._close());
      this.input.keyboard.on('keydown-E',   () => this._close());

      // Live re-render on language change.
      if (window.i18n && typeof window.i18n.onChange === 'function') {
        this._unsubI18n = window.i18n.onChange(() => {
          if (this.scene && this.scene.isActive && this.scene.isActive()) {
            this.scene.restart({ from: this.parentSceneKey });
          }
        });
        this.events.once('shutdown', () => {
          if (this._unsubI18n) { this._unsubI18n(); this._unsubI18n = null; }
        });
      }
    }

    // ---- status bar (4 cells: Paper | Standing | Suspicion | Active) ----
    _renderStatusBar(left, top, w) {
      const ph = window.PrintingHouse;
      const paper = ph.getDruckblaetter();
      const suspicion = ph.getSuspicion();
      const active = ph.getActivePublication();
      const standing = (window.FactionSystem && typeof window.FactionSystem.getStanding === 'function')
        ? window.FactionSystem.getStanding('widerstand') | 0
        : 0;

      // Background strip behind the status bar so it visually separates from
      // the card grid below.
      const stripG = this.add.graphics().setScrollFactor(0).setDepth(2001);
      stripG.fillStyle(0x161a26, 0.7).fillRect(left + 8, top - 4, w - 16, 70);

      const sidePad = 18;
      const cellW = (w - sidePad * 2) / 4;
      const cellTop = top + 4;
      const labelStyle = { fontFamily: 'monospace', fontSize: '10px', color: '#9994a0' };

      // === Cell 1: Paper ===
      {
        const cx = left + sidePad + cellW * 0;
        this.add.text(cx + 12, cellTop, T('printingHouse.ui.paper').toUpperCase(), labelStyle)
          .setScrollFactor(0).setDepth(2003);
        this.add.text(cx + 12, cellTop + 14, paper + ' / 50', {
          fontFamily: 'monospace', fontSize: '18px', color: '#ffd166', fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(2003);
        const barW = cellW - 24;
        const barG = this.add.graphics().setScrollFactor(0).setDepth(2003);
        barG.fillStyle(0x2a2a2a, 1).fillRoundedRect(cx + 12, cellTop + 42, barW, 4, 2);
        barG.fillStyle(0xffd166, 1).fillRoundedRect(cx + 12, cellTop + 42, Math.round(barW * (paper / 50)), 4, 2);
      }

      // === Cell 2: Standing (Resistance) — new ===
      {
        const cx = left + sidePad + cellW * 1;
        this.add.text(cx + 12, cellTop, 'STANDING', labelStyle)
          .setScrollFactor(0).setDepth(2003);
        // Color-coded by tier threshold (0 / 25 / 50)
        const stColor = standing >= 50 ? '#ff8888' : standing >= 25 ? '#ffd166' : '#88ddaa';
        this.add.text(cx + 12, cellTop + 14, String(standing), {
          fontFamily: 'monospace', fontSize: '18px', color: stColor, fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(2003);
        // Tier hint right of the number
        const tierName = standing >= 50 ? T('printingHouse.tier.risky')
                       : standing >= 25 ? T('printingHouse.tier.strong')
                       : T('printingHouse.tier.mild');
        this.add.text(cx + 50, cellTop + 18, '· ' + tierName, {
          fontFamily: 'monospace', fontSize: '11px', color: '#aaa6a0'
        }).setScrollFactor(0).setDepth(2003);
        // Three-segment threshold meter (0..25 mild, 25..50 strong, 50+ risky)
        const meterW = cellW - 24;
        const meterH = 4;
        const meterX = cx + 12;
        const meterY = cellTop + 42;
        const segW = meterW / 3;
        const meterG = this.add.graphics().setScrollFactor(0).setDepth(2003);
        meterG.fillStyle(0x2a2a2a, 1).fillRoundedRect(meterX, meterY, meterW, meterH, 2);
        meterG.fillStyle(0x88ddaa, 1).fillRect(meterX,             meterY, segW * Math.min(1, standing / 25), meterH);
        meterG.fillStyle(0xffd166, 1).fillRect(meterX + segW,      meterY, segW * Math.max(0, Math.min(1, (standing - 25) / 25)), meterH);
        meterG.fillStyle(0xff8888, 1).fillRect(meterX + segW * 2,  meterY, segW * Math.max(0, Math.min(1, (standing - 50) / 25)), meterH);
        meterG.lineStyle(1, 0x10131c, 1);
        meterG.lineBetween(meterX + segW,     meterY, meterX + segW,     meterY + meterH);
        meterG.lineBetween(meterX + segW * 2, meterY, meterX + segW * 2, meterY + meterH);
      }

      // === Cell 3: Suspicion ===
      {
        const cx = left + sidePad + cellW * 2;
        this.add.text(cx + 12, cellTop, T('printingHouse.ui.suspicion').toUpperCase(), labelStyle)
          .setScrollFactor(0).setDepth(2003);
        const susColor = suspicion >= 20 ? '#ff5555' : suspicion >= 10 ? '#ffaa44' : '#88ff88';
        this.add.text(cx + 12, cellTop + 14, String(suspicion), {
          fontFamily: 'monospace', fontSize: '18px', color: susColor, fontStyle: 'bold'
        }).setScrollFactor(0).setDepth(2003);
        // Three-segment threshold meter (0..10 safe, 10..20 alert, 20+ hunt)
        const meterW = cellW - 24;
        const meterH = 4;
        const meterX = cx + 12;
        const meterY = cellTop + 42;
        const segW = meterW / 3;
        const meterG = this.add.graphics().setScrollFactor(0).setDepth(2003);
        meterG.fillStyle(0x2a2a2a, 1).fillRoundedRect(meterX, meterY, meterW, meterH, 2);
        meterG.fillStyle(0x88ff88, 1).fillRect(meterX,             meterY, segW * Math.min(1, suspicion / 10), meterH);
        meterG.fillStyle(0xffaa44, 1).fillRect(meterX + segW,      meterY, segW * Math.max(0, Math.min(1, (suspicion - 10) / 10)), meterH);
        meterG.fillStyle(0xff5555, 1).fillRect(meterX + segW * 2,  meterY, segW * Math.max(0, Math.min(1, (suspicion - 20) / 10)), meterH);
        meterG.lineStyle(1, 0x10131c, 1);
        meterG.lineBetween(meterX + segW,     meterY, meterX + segW,     meterY + meterH);
        meterG.lineBetween(meterX + segW * 2, meterY, meterX + segW * 2, meterY + meterH);
      }

      // === Cell 4: Active edict ===
      {
        const cx = left + sidePad + cellW * 3;
        this.add.text(cx + 12, cellTop, T('printingHouse.ui.active_edict').toUpperCase(), labelStyle)
          .setScrollFactor(0).setDepth(2003);
        const activeText = active
          ? T('printingHouse.edict.' + active.id + '.label')
          : T('printingHouse.ui.no_active');
        this.add.text(cx + 12, cellTop + 14, activeText, {
          fontFamily: 'serif', fontSize: active ? '13px' : '12px',
          color: active ? '#88ff88' : '#666',
          fontStyle: active ? 'bold' : 'italic',
          wordWrap: { width: cellW - 24, useAdvancedWrap: true }
        }).setScrollFactor(0).setDepth(2003);
      }
    }

    // ---- card grid ----
    // Two-column auto-row layout. With only-unlocked filter, count is small
    // (3 / 7 / 10) and each card gets generous height. Locked tiers are
    // summarised in a single footer line.
    _renderEdictGrid(x, y, w, h, edicts, totalCount) {
      const ph = window.PrintingHouse;
      const active = ph.getActivePublication();
      const paper  = ph.getDruckblaetter();

      // Footer reserve (locked-tier summary line + spacing)
      const footerReserveH = 22;
      const gridH = h - footerReserveH;

      const cols = 2;
      const colGap = 14;
      const rowGap = 10;
      const cardW = (w - colGap * (cols - 1)) / cols;

      const rows = Math.max(1, Math.ceil(edicts.length / cols));
      // Cap card height to ~140 so text never feels lost; minimum 90 to keep
      // description legible. Within that, scale to fill the grid vertically.
      const cardH = Math.min(140, Math.max(90, (gridH - rowGap * (rows - 1)) / rows));

      edicts.forEach((e, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x + col * (cardW + colGap);
        const cy = y + row * (cardH + rowGap);
        const tc = TIER_THEME[e.tier];
        this._renderEdictCard(e, cx, cy, cardW, cardH, tc, active, paper);
      });

      // Footer: locked-tier summary
      const lockedByTier = { strong: 0, risky: 0 };
      const lockedReq = { strong: 25, risky: 50 };
      ph.getEdictCatalog().forEach((e) => {
        if (!e.isUnlocked && e.tier in lockedByTier) lockedByTier[e.tier] += 1;
      });
      const parts = [];
      if (lockedByTier.strong > 0) {
        parts.push(lockedByTier.strong + 'x ' + T('printingHouse.tier.strong')
          + ' (Standing ' + lockedReq.strong + ')');
      }
      if (lockedByTier.risky > 0) {
        parts.push(lockedByTier.risky + 'x ' + T('printingHouse.tier.risky')
          + ' (Standing ' + lockedReq.risky + ')');
      }
      if (parts.length > 0) {
        const footerY = y + h - footerReserveH + 4;
        this.add.text(x + w / 2, footerY,
          T('printingHouse.ui.locked_summary') + '  ' + parts.join('   ·   '),
          { fontFamily: 'monospace', fontSize: '11px', color: '#888', fontStyle: 'italic' }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
      }

      // Empty state
      if (edicts.length === 0) {
        this.add.text(x + w / 2, y + gridH / 2,
          T('printingHouse.ui.empty_state'),
          { fontFamily: 'serif', fontSize: '14px', color: '#888', fontStyle: 'italic',
            wordWrap: { width: w - 40, useAdvancedWrap: true }, align: 'center' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      }
    }

    // ---- single edict card ----
    _renderEdictCard(edict, x, y, w, h, tc, active, paper) {
      const isActive       = !!(active && active.id === edict.id);
      const otherActive    = !!(active && active.id !== edict.id);
      const isUnaffordable = !otherActive && paper < edict.cost;
      // (Tier-locked edicts are filtered out before this renders — they only
      // appear in the bottom footer. The only locked-state we still render
      // here is "an edict is already active for this run".)

      // Visual theming per state.
      let bgColor     = tc.soft;
      let borderColor = tc.border;
      let borderAlpha = 0.6;
      let textColor   = '#f1e9d8';
      let descColor   = '#c8c2b8';
      let costColor   = tc.accent;
      let interactive = false;

      if (isActive) {
        bgColor = 0x1f3a1f; borderColor = 0x88ff88; borderAlpha = 1;
        textColor = '#aaffaa'; descColor = '#bce3bc'; costColor = '#88ff88';
      } else if (otherActive) {
        bgColor = 0x161618; borderColor = 0x333333; borderAlpha = 0.5;
        textColor = '#555'; descColor = '#3d3d3d'; costColor = '#444';
      } else if (isUnaffordable) {
        bgColor = 0x1f1d18; borderColor = 0x554c3a; borderAlpha = 0.65;
        textColor = '#a89c84'; descColor = '#85795f'; costColor = '#aa8866';
      } else {
        interactive = true;
        borderAlpha = 0.9;
      }

      // Card body (drawn into a graphics so we can repaint on hover).
      const cardG = this.add.graphics().setScrollFactor(0).setDepth(2002);
      const repaint = (hover) => {
        cardG.clear();
        cardG.fillStyle(bgColor, 0.95).fillRoundedRect(x, y, w, h, 10);
        cardG.lineStyle(hover ? 3 : 2, borderColor, hover ? 1 : borderAlpha)
          .strokeRoundedRect(x, y, w, h, 10);
        // Tier accent stripe on the left edge — replaces the missing tier
        // column from v1, so the player can still tell mild/strong/risky
        // apart at a glance.
        cardG.fillStyle(tc.border, otherActive ? 0.25 : 0.95)
          .fillRoundedRect(x, y, 6, h, { tl: 10, bl: 10, tr: 0, br: 0 });
      };
      repaint(false);

      // Tier mini-badge top-right (small uppercase pill)
      const tierLabel = T('printingHouse.tier.' + edict.tier).toUpperCase();
      this.add.text(x + w - 14, y + 12, tierLabel, {
        fontFamily: 'monospace', fontSize: '10px', color: tc.accent, fontStyle: 'bold'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(2003);

      // Edict name (top, leaving 60px on the right for the tier label)
      this.add.text(x + 18, y + 10, T('printingHouse.edict.' + edict.id + '.label'), {
        fontFamily: 'serif', fontSize: '16px', color: textColor, fontStyle: 'bold',
        wordWrap: { width: w - 90, useAdvancedWrap: true }
      }).setScrollFactor(0).setDepth(2003);

      // Description (middle, full card width)
      this.add.text(x + 18, y + 36, T('printingHouse.edict.' + edict.id + '.desc'), {
        fontFamily: 'monospace', fontSize: '12px', color: descColor, lineSpacing: 2,
        wordWrap: { width: w - 28, useAdvancedWrap: true }
      }).setScrollFactor(0).setDepth(2003);

      // Bottom row: cost pill (left) + status badge (right)
      const bottomY = y + h - 24;
      this.add.text(x + 18, bottomY,
        edict.cost + ' Druckblätter   +' + edict.suspicionCost + ' Verdacht', {
          fontFamily: 'monospace', fontSize: '12px', color: costColor, fontStyle: 'bold'
        }
      ).setScrollFactor(0).setDepth(2003);

      let statusText = '';
      let statusColor = textColor;
      if (isActive) {
        statusText = T('printingHouse.ui.status.active'); statusColor = '#88ff88';
      } else if (otherActive) {
        statusText = T('printingHouse.ui.status.blocked_by_active'); statusColor = '#666';
      } else if (isUnaffordable) {
        statusText = T('printingHouse.ui.status.unaffordable'); statusColor = '#aa8866';
      } else {
        statusText = T('printingHouse.ui.status.available'); statusColor = tc.accent;
      }
      this.add.text(x + w - 14, bottomY, statusText, {
        fontFamily: 'monospace', fontSize: '12px', color: statusColor, fontStyle: 'bold'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(2003);

      // Click hit area (only for available edicts)
      if (interactive) {
        const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0)
          .setScrollFactor(0).setDepth(2004)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => repaint(true));
        hit.on('pointerout',  () => repaint(false));
        hit.on('pointerdown', () => this._publish(edict.id));
      }
    }

    // ---- action bar (compact, single-line button labels) ----
    _renderActionBar(left, top, w) {
      const ph = window.PrintingHouse;
      const suspicion = ph.getSuspicion();
      const paper = ph.getDruckblaetter();
      const gold = (window.LootSystem && typeof window.LootSystem.getGold === 'function')
        ? window.LootSystem.getGold() : 0;

      const btnH = 36;
      const sidePad = 18;
      const btnGap = 10;
      const usableW = w - sidePad * 2;
      const btnW = (usableW - btnGap * 2) / 3;
      const btnY = top + btnH / 2;

      const cx1 = left + sidePad + btnW / 2;
      const cx2 = left + sidePad + btnW + btnGap + btnW / 2;
      const cx3 = left + sidePad + (btnW + btnGap) * 2 + btnW / 2;

      const canBribe = suspicion > 0 && gold >= 100;
      const canTrade = paper < 50 && gold >= 50;

      this._actionButton(cx1, btnY, btnW, btnH, T('printingHouse.ui.btn.bribe'),     canBribe, 0xc35a4e, () => {
        if (ph.bribe()) this._refresh();
      });
      this._actionButton(cx2, btnY, btnW, btnH, T('printingHouse.ui.btn.tradegold'), canTrade, 0xd4a543, () => {
        if (ph.tradeGoldForPaper()) this._refresh();
      });
      this._actionButton(cx3, btnY, btnW, btnH, T('printingHouse.ui.btn.close'),     true,     0x7a7a7a, () => this._close());
    }

    _actionButton(cx, cy, w, h, label, enabled, accentColor, onClick) {
      const bgColor     = enabled ? 0x2a2e3a : 0x1a1a1a;
      const borderColor = enabled ? accentColor : 0x444444;
      const txtColor    = enabled ? '#f1e9d8' : '#666';
      const bg = this.add.rectangle(cx, cy, w, h, bgColor)
        .setStrokeStyle(2, borderColor)
        .setScrollFactor(0).setDepth(2002);
      this.add.text(cx, cy, label, {
        fontFamily: 'monospace', fontSize: '11px', color: txtColor, align: 'center',
        wordWrap: { width: w - 12, useAdvancedWrap: true }, lineSpacing: 1
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x3a3f50));
        bg.on('pointerout',  () => bg.setFillStyle(bgColor));
        bg.on('pointerdown', onClick);
      }
    }

    // ---- actions ----
    _publish(edictId) {
      const ph = window.PrintingHouse;
      const result = ph.publishEdict(edictId);
      if (result.success) {
        this._toast(T('printingHouse.toast.published', { name: T('printingHouse.edict.' + edictId + '.label') }));
        this.time.delayedCall(900, () => this._close());
      } else {
        this._toast(result.reason || 'Publish fehlgeschlagen');
        this._refresh();
      }
    }

    _refresh() {
      // Quickest way to reflect new state across status + cards.
      this.scene.restart({ from: this.parentSceneKey });
    }

    _toast(msg) {
      const cam = this.cameras.main;
      const txt = this.add.text(cam.width / 2, cam.height - 100, msg, {
        fontFamily: 'monospace', fontSize: '14px', color: '#88ff88',
        backgroundColor: '#0c0c11dd', padding: { x: 10, y: 6 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
      this.tweens.add({
        targets: txt, alpha: 0, delay: 1500, duration: 400,
        onComplete: () => txt.destroy()
      });
    }

    _close() {
      this.input.keyboard.off('keydown-ESC');
      this.input.keyboard.off('keydown-E');
      if (this._unsubI18n) { this._unsubI18n(); this._unsubI18n = null; }
      this.scene.stop();
    }
  }

  window.PrintingHouseScene = PrintingHouseScene;

  window.openPrintingHouseScene = function (fromScene) {
    if (!fromScene || !fromScene.scene) return;
    try {
      if (fromScene.scene.isActive('PrintingHouseScene')) {
        fromScene.scene.stop('PrintingHouseScene');
      }
    } catch (e) { /* ignore */ }
    try {
      fromScene.scene.launch('PrintingHouseScene', { from: fromScene.scene.key });
      fromScene.scene.bringToTop('PrintingHouseScene');
    } catch (e) {
      console.warn('[openPrintingHouseScene] launch failed', e);
    }
  };
})();
