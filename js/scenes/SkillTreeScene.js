// js/scenes/SkillTreeScene.js
// Feature 060 (#58) WP04 — Skill-Baum Hub-UI.
//
// Modal Phaser-Overlay (Vorbild: ShopScene). Wird via window.openSkillTreeScene
// (parentScene) über dem Hub (HubSceneV2) gestartet; der Hub läuft darunter
// weiter, scene.stop() entfernt das Overlay ohne den Hub zu beeinflussen.
//
// Inhalt: 3 Spalten = 3 Stränge (wut/ketten/schatten), je 4 Knoten vertikal
// nach Tier. Pro Knoten: Name, Rang x/maxRank (Pips), Zustand (gesperrt /
// verfügbar / investiert/max). Klick auf verfügbaren Knoten investiert einen
// Punkt via SkillTree.investPoint. Respec-Button zeigt Gold-Kosten und führt
// LootSystem.spendGold + SkillTree.respec aus.
//
// Contracts (WP01 skillTree.js, WP05 gold): window.SkillTree.{getAllNodes,
// getNode,getRank,getSkillPoints,getSpentPoints,isNodeAvailable,investPoint,
// respec,getRespecCost?,onChange}; window.LootSystem.{getGold,spendGold}.
// window.playerLevel (global, Fallback 1).

(function () {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  if (window.i18n) {
    window.i18n.register('de', {
      'skilltree.title': 'Talente',
      'skilltree.points': 'Punkte: {amount}',
      'skilltree.close': 'Schliessen [ESC]',
      'skilltree.strand.wut': 'Wut & Wucht',
      'skilltree.strand.ketten': 'Ketten & Kontrolle',
      'skilltree.strand.schatten': 'Schatten & Jagd',
      'skilltree.node.rank': 'Rang {cur}/{max}',
      'skilltree.node.cost': 'Nächster Rang: {cost} Pkt',
      'skilltree.node.req_level': 'Ab Stufe {level}',
      'skilltree.node.req_node': 'Benötigt {name} Rang {rank}',
      'skilltree.node.synergy': 'Synergie: stärker mit {source}',
      'skilltree.respec.btn': 'Respec',
      'skilltree.respec.cost': 'Respec: {cost} Gold',
      'skilltree.respec.gold': 'Gold: {amount}',
      'skilltree.toast.invested': '{name} → Rang {rank}',
      'skilltree.toast.no_points': 'Keine Skillpunkte',
      'skilltree.toast.locked': 'Knoten gesperrt',
      'skilltree.toast.maxed': 'Maximaler Rang erreicht',
      'skilltree.toast.respec_done': 'Talente zurückgesetzt — {points} Punkte erstattet',
      'skilltree.toast.respec_nogold': 'Nicht genug Gold',
      'skilltree.toast.respec_nothing': 'Nichts zum Zurücksetzen'
    });
    window.i18n.register('en', {
      'skilltree.title': 'Talents',
      'skilltree.points': 'Points: {amount}',
      'skilltree.close': 'Close [ESC]',
      'skilltree.strand.wut': 'Rage & Force',
      'skilltree.strand.ketten': 'Chains & Control',
      'skilltree.strand.schatten': 'Shadow & Hunt',
      'skilltree.node.rank': 'Rank {cur}/{max}',
      'skilltree.node.cost': 'Next rank: {cost} pts',
      'skilltree.node.req_level': 'From level {level}',
      'skilltree.node.req_node': 'Requires {name} rank {rank}',
      'skilltree.node.synergy': 'Synergy: stronger with {source}',
      'skilltree.respec.btn': 'Respec',
      'skilltree.respec.cost': 'Respec: {cost} gold',
      'skilltree.respec.gold': 'Gold: {amount}',
      'skilltree.toast.invested': '{name} → rank {rank}',
      'skilltree.toast.no_points': 'No skill points',
      'skilltree.toast.locked': 'Node locked',
      'skilltree.toast.maxed': 'Maximum rank reached',
      'skilltree.toast.respec_done': 'Talents reset — {points} points refunded',
      'skilltree.toast.respec_nogold': 'Not enough gold',
      'skilltree.toast.respec_nothing': 'Nothing to reset'
    });
  }
  const _ST_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  const STRANDS = ['wut', 'ketten', 'schatten'];
  const STRAND_COLORS = {
    wut: 0xff6644,
    ketten: 0x66aaff,
    schatten: 0xaa66ff
  };
  const STRAND_COLORS_HEX = {
    wut: '#ff8866',
    ketten: '#88bbff',
    schatten: '#bb88ff'
  };

  // Helper — reads the live player level (classic script scope global).
  function _playerLevel() {
    return (typeof window.playerLevel === 'number' && window.playerLevel > 0)
      ? window.playerLevel : 1;
  }

  // Respec cost: prefer the WP05 contract; if not yet wired, fall back to a
  // gold-cost scaled by spent points so the UI stays sensible standalone.
  function _respecCost() {
    const ST = window.SkillTree;
    if (ST && typeof ST.getRespecCost === 'function') {
      const c = ST.getRespecCost();
      if (typeof c === 'number' && isFinite(c)) return Math.max(0, Math.trunc(c));
    }
    const spent = (ST && typeof ST.getSpentPoints === 'function') ? ST.getSpentPoints() : 0;
    return spent * 50;
  }

  class SkillTreeScene extends Phaser.Scene {
    constructor() {
      super({ key: 'SkillTreeScene' });
    }

    create(data) {
      this.parentSceneKey = (data && data.from) || null;
      this.nodeViews = [];   // re-rendered on each refresh
      this._buildLayout();
      this._render();

      // Re-render when the tree state changes elsewhere (e.g. level-up grants).
      if (window.SkillTree && typeof window.SkillTree.onChange === 'function') {
        this._unsub = window.SkillTree.onChange(() => {
          if (this.scene && this.sys && this.sys.isActive()) this._render();
        });
      }

      this._escHandler = () => this._close();
      this.input.keyboard.on('keydown-ESC', this._escHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this._escHandler && this.input && this.input.keyboard) {
          this.input.keyboard.off('keydown-ESC', this._escHandler);
        }
        if (typeof this._unsub === 'function') { try { this._unsub(); } catch (e) {} this._unsub = null; }
        this._destroyNodeViews();
      });
    }

    // -----------------------------------------------------------------------
    // Static panel / header / footer
    // -----------------------------------------------------------------------
    _buildLayout() {
      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;

      // Mobile-safe insets so header/footer clear notches and rounded corners.
      const sa = (window.__SAFE_AREA__ || {});
      this._safe = {
        top: sa.top || 0, bottom: sa.bottom || 0,
        left: sa.left || 0, right: sa.right || 0
      };

      // Dim backdrop
      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.72)
        .setScrollFactor(0).setDepth(2000);

      // Panel — fills most of the screen but respects safe area.
      const panelW = Math.min(760, cw - 24 - this._safe.left - this._safe.right);
      const panelH = Math.min(500, ch - 24 - this._safe.top - this._safe.bottom);
      const px = cw / 2;
      const py = (this._safe.top - this._safe.bottom) / 2 + ch / 2;
      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.97)
        .fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
      panel.lineStyle(3, 0xffd166, 0.9)
        .strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

      // Title
      this.add.text(px, py - panelH / 2 + 12, _ST_T('skilltree.title'), {
        fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      // Points counter (top-left of panel)
      this.pointsText = this.add.text(px - panelW / 2 + 16, py - panelH / 2 + 16,
        _ST_T('skilltree.points', { amount: 0 }), {
          fontFamily: 'monospace', fontSize: '14px', color: '#ffd166'
        }).setScrollFactor(0).setDepth(2002);

      // Close button (top-right of panel)
      const closeBg = this.add.rectangle(px + panelW / 2 - 110, py - panelH / 2 + 22, 200, 28, 0x3a3a3a)
        .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(px + panelW / 2 - 110, py - panelH / 2 + 22, _ST_T('skilltree.close'), {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      closeBg.on('pointerdown', () => this._close());

      // --- Respec-Cluster: direkt NEBEN/UNTER den Punkten (nicht in einer Ecke,
      // um Fehlklicks zu vermeiden). Button auf der Punkte-Zeile, Kosten + Gold
      // als kleine Info-Zeile darunter. ---
      this.respecBg = this.add.rectangle(px - panelW / 2 + 156, py - panelH / 2 + 24, 96, 24, 0x3a2a2a)
        .setStrokeStyle(2, 0xd46a43).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(px - panelW / 2 + 156, py - panelH / 2 + 24, _ST_T('skilltree.respec.btn'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      this.respecBg.on('pointerdown', () => this._doRespec());
      this.respecBg.on('pointerover', () => this.respecBg.setFillStyle(0x553333));
      this.respecBg.on('pointerout', () => this.respecBg.setFillStyle(0x3a2a2a));

      this.respecCostText = this.add.text(px - panelW / 2 + 16, py - panelH / 2 + 38,
        _ST_T('skilltree.respec.cost', { cost: 0 }), {
          fontFamily: 'monospace', fontSize: '11px', color: '#cccccc'
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);
      this.goldText = this.add.text(px - panelW / 2 + 152, py - panelH / 2 + 38,
        _ST_T('skilltree.respec.gold', { amount: 0 }), {
          fontFamily: 'monospace', fontSize: '11px', color: '#ffd166'
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(2002);

      // Layout geometry for the columns. Header (Punkte+Respec+Info ~58); der
      // Footer entfällt, daher reichen die Knoten fast bis zum Panel-Rand.
      this._panel = { px, py, panelW, panelH };
      this._grid = {
        top: py - panelH / 2 + 58,
        bottom: py + panelH / 2 - 18,
        left: px - panelW / 2 + 14,
        width: panelW - 28
      };
    }

    _destroyNodeViews() {
      if (this.nodeViews) this.nodeViews.forEach(g => g && g.destroy && g.destroy());
      this.nodeViews = [];
    }

    // -----------------------------------------------------------------------
    // Render the 3 strand columns of nodes.
    // -----------------------------------------------------------------------
    _render() {
      this._destroyNodeViews();
      const ST = window.SkillTree;
      if (!ST || typeof ST.getAllNodes !== 'function') return;

      this._refreshHeader();

      const { left, top, bottom, width } = this._grid;
      const colW = width / STRANDS.length;
      const lvl = _playerLevel();

      const all = ST.getAllNodes() || [];

      STRANDS.forEach((strand, ci) => {
        const cx = left + ci * colW + colW / 2;

        // Column header
        const hdr = this.add.text(cx, top, _ST_T('skilltree.strand.' + strand), {
          fontFamily: 'monospace', fontSize: '13px', color: STRAND_COLORS_HEX[strand],
          fontStyle: 'bold', align: 'center', wordWrap: { width: colW - 8 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
        this.nodeViews.push(hdr);

        // Nodes of this strand, ordered by tier (minLevel asc, then prereq depth).
        const nodes = all.filter(n => n && n.strand === strand);
        nodes.sort((a, b) => this._tierOf(a) - this._tierOf(b));

        const rowsTop = top + 30;
        const rowGap = (bottom - rowsTop) / Math.max(1, nodes.length);
        const cardW = Math.min(colW - 12, 220);
        const cardH = Math.min(rowGap - 8, 78);

        nodes.forEach((node, ri) => {
          const cy = rowsTop + ri * rowGap + rowGap / 2;
          this._renderNode(node, cx, cy, cardW, cardH, lvl);
        });
      });
    }

    // Tier ordering: T1 (no prereq) -> T2 (prereq) -> Capstone (maxRank 3).
    _tierOf(node) {
      const req = node.requires || {};
      const minLevel = req.minLevel || 0;
      // Capstone nodes cap at rank 3; T1/T2 cap at 5. Use both signals so the
      // ordering survives data tweaks.
      const capstone = (node.maxRank && node.maxRank <= 3) ? 1 : 0;
      return minLevel * 10 + capstone;
    }

    _renderNode(node, cx, cy, w, h, playerLevel) {
      const ST = window.SkillTree;
      const rank = ST.getRank(node.id);
      const maxRank = node.maxRank || 1;
      const isMax = rank >= maxRank;
      const prereqOk = ST.isNodeAvailable(node.id, playerLevel);
      // Höhere Ränge kosten mehr — leistbar heißt: genug Punkte für den nächsten Rang.
      const nextCost = (typeof ST.getNextRankCost === 'function') ? ST.getNextRankCost(node.id) : 1;
      const canAfford = ST.getSkillPoints() >= nextCost;
      const investable = prereqOk && !isMax && canAfford;

      // State: locked (prereq not met), maxed, invested (>0), available.
      let fill, stroke, nameColor, descColor;
      if (!prereqOk && rank === 0) {
        fill = 0x1c1c22; stroke = 0x3a3a3a; nameColor = '#666666'; descColor = '#555555';
      } else if (isMax) {
        fill = 0x243024; stroke = 0x66cc66; nameColor = '#cfffcf'; descColor = '#88bb88';
      } else if (rank > 0) {
        fill = 0x232830; stroke = STRAND_COLORS[node.strand]; nameColor = STRAND_COLORS_HEX[node.strand]; descColor = '#aaaaaa';
      } else if (investable) {
        fill = 0x2c2a1a; stroke = 0xffd166; nameColor = '#ffe9a8'; descColor = '#bbbbaa';
      } else {
        // prereq met but no points to spend yet
        fill = 0x222226; stroke = 0x555555; nameColor = '#cccccc'; descColor = '#888888';
      }

      const card = this.add.rectangle(cx, cy, w, h, fill)
        .setStrokeStyle(2, stroke).setScrollFactor(0).setDepth(2002);
      this.nodeViews.push(card);
      if (investable) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x3a3522));
        card.on('pointerout', () => card.setFillStyle(fill));
      } else {
        // still interactive so a tap gives feedback (locked / maxed / no points)
        card.setInteractive({ useHandCursor: true });
      }
      card.on('pointerdown', () => this._tryInvest(node));

      const topY = cy - h / 2 + 6;
      // Name
      const nameText = this.add.text(cx, topY, node.name || node.id, {
        fontFamily: 'monospace', fontSize: '12px', color: nameColor, fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
      this.nodeViews.push(nameText);

      // Rank pips: filled = invested, hollow = remaining.
      const pips = [];
      for (let i = 0; i < maxRank; i++) pips.push(i < rank ? '◆' : '◇');
      const pipText = this.add.text(cx, topY + 16, pips.join(' '), {
        fontFamily: 'monospace', fontSize: '12px',
        color: rank > 0 ? STRAND_COLORS_HEX[node.strand] : '#666666'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
      this.nodeViews.push(pipText);

      // Sub-line: requirement hint (locked) OR rank x/max + synergy marker.
      let sub = '';
      if (!prereqOk && rank === 0) {
        const req = node.requires || {};
        // Alle Knoten-Vorbedingungen sammeln (Einzel-`node` + `nodes`-Array).
        const reqParts = [];
        if (req.node) {
          const reqNode = ST.getNode(req.node);
          reqParts.push(_ST_T('skilltree.node.req_node', {
            name: (reqNode && reqNode.name) || req.node, rank: req.rank || 1
          }));
        }
        if (Array.isArray(req.nodes)) {
          req.nodes.forEach((nr) => {
            if (!nr || !nr.node) return;
            const rn = ST.getNode(nr.node);
            reqParts.push(_ST_T('skilltree.node.req_node', {
              name: (rn && rn.name) || nr.node, rank: nr.rank || 1
            }));
          });
        }
        if (reqParts.length) sub = reqParts.join('\n');
        else if (req.minLevel) sub = _ST_T('skilltree.node.req_level', { level: req.minLevel });
      } else {
        sub = _ST_T('skilltree.node.rank', { cur: rank, max: maxRank });
        // Kosten des nächsten Rangs anzeigen, solange nicht gemaxt.
        if (!isMax) sub += '  ·  ' + _ST_T('skilltree.node.cost', { cost: nextCost });
        if (Array.isArray(node.synergies) && node.synergies.length > 0) {
          // Nenne die Quell-Knoten: dieser Skill wird stärker, je höher die
          // genannten geskillt sind (z.B. Hammer stärker mit Wirbelwind).
          const srcNames = [];
          node.synergies.forEach((s) => {
            const sn = ST.getNode(s.from);
            const nm = (sn && sn.name) || s.from;
            if (srcNames.indexOf(nm) === -1) srcNames.push(nm);
          });
          sub += '\n' + _ST_T('skilltree.node.synergy', { source: srcNames.join(', ') });
        }
      }
      const subText = this.add.text(cx, topY + 34, sub, {
        fontFamily: 'monospace', fontSize: '9px', color: descColor,
        align: 'center', wordWrap: { width: w - 8 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
      this.nodeViews.push(subText);
    }

    _refreshHeader() {
      const ST = window.SkillTree;
      const pts = (ST && typeof ST.getSkillPoints === 'function') ? ST.getSkillPoints() : 0;
      if (this.pointsText) this.pointsText.setText(_ST_T('skilltree.points', { amount: pts }));

      const gold = (window.LootSystem && typeof window.LootSystem.getGold === 'function')
        ? window.LootSystem.getGold() : 0;
      if (this.goldText) this.goldText.setText(_ST_T('skilltree.respec.gold', { amount: gold }));

      const cost = _respecCost();
      if (this.respecCostText) {
        this.respecCostText.setText(_ST_T('skilltree.respec.cost', { cost: cost }));
        this.respecCostText.setColor(gold >= cost ? '#88cc88' : '#cc6666');
      }
    }

    // -----------------------------------------------------------------------
    // Invest / Respec
    // -----------------------------------------------------------------------
    _tryInvest(node) {
      const ST = window.SkillTree;
      if (!ST) return;
      const rank = ST.getRank(node.id);
      const maxRank = node.maxRank || 1;
      const lvl = _playerLevel();

      if (rank >= maxRank) { this._shake(); this._toast(_ST_T('skilltree.toast.maxed'), '#ffaa66'); return; }
      if (!ST.isNodeAvailable(node.id, lvl)) { this._shake(); this._toast(_ST_T('skilltree.toast.locked'), '#cc6666'); return; }
      const nextCost = (typeof ST.getNextRankCost === 'function') ? ST.getNextRankCost(node.id) : 1;
      if (ST.getSkillPoints() < nextCost) { this._shake(); this._toast(_ST_T('skilltree.toast.no_points'), '#cc6666'); return; }

      const ok = ST.investPoint(node.id, lvl);
      if (!ok) { this._shake(); this._toast(_ST_T('skilltree.toast.no_points'), '#cc6666'); return; }
      // onChange may already re-render; render again to be safe (idempotent).
      this._render();
      this._toast(_ST_T('skilltree.toast.invested', { name: node.name || node.id, rank: ST.getRank(node.id) }), '#88ff88');
    }

    _doRespec() {
      const ST = window.SkillTree;
      if (!ST || typeof ST.respec !== 'function') return;
      const spent = (typeof ST.getSpentPoints === 'function') ? ST.getSpentPoints() : 0;
      if (spent <= 0) { this._shake(); this._toast(_ST_T('skilltree.toast.respec_nothing'), '#ffaa66'); return; }

      const cost = _respecCost();
      const gold = (window.LootSystem && typeof window.LootSystem.getGold === 'function')
        ? window.LootSystem.getGold() : 0;
      if (cost > 0) {
        if (gold < cost || !window.LootSystem || typeof window.LootSystem.spendGold !== 'function') {
          this._shake();
          this._toast(_ST_T('skilltree.toast.respec_nogold'), '#cc6666');
          return;
        }
        const paid = window.LootSystem.spendGold(cost);
        if (!paid) { this._shake(); this._toast(_ST_T('skilltree.toast.respec_nogold'), '#cc6666'); return; }
      }
      const refunded = ST.respec();
      this._render();
      this._toast(_ST_T('skilltree.toast.respec_done', { points: (typeof refunded === 'number' ? refunded : spent) }), '#88ff88');
    }

    // -----------------------------------------------------------------------
    // Feedback
    // -----------------------------------------------------------------------
    _toast(msg, color) {
      const { px, py, panelH } = this._panel;
      const txt = this.add.text(px, py + panelH / 2 - 54, msg, {
        fontFamily: 'monospace', fontSize: '13px', color: color || '#88ff88',
        backgroundColor: '#0c0c11', padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
      this.tweens.add({
        targets: txt, alpha: 0, delay: 1300, duration: 400,
        onComplete: () => { try { txt.destroy(); } catch (e) {} }
      });
    }

    _shake() {
      try { this.cameras.main.shake(120, 0.004); } catch (e) { /* swallow */ }
      if (window.soundManager && typeof window.soundManager.play === 'function') {
        try { window.soundManager.play('error'); } catch (e) { /* swallow */ }
      }
    }

    _close() {
      try { this.scene.stop(); } catch (e) { /* swallow */ }
    }
  }

  window.SkillTreeScene = SkillTreeScene;

  function _ensureRegistered(game) {
    if (!game || !game.scene) return false;
    let registered = null;
    try { registered = game.scene.getScene('SkillTreeScene'); } catch (e) { registered = null; }
    if (!registered) {
      try { game.scene.add('SkillTreeScene', SkillTreeScene, false); } catch (e) { /* already added */ }
    }
    return true;
  }

  // Launch the overlay over the running hub. Mirrors window.openShopScene.
  window.openSkillTreeScene = function (parentScene) {
    const game = window.game;
    if (!game || !game.scene) return;
    _ensureRegistered(game);
    if (game.scene.isActive && game.scene.isActive('SkillTreeScene')) return;
    const launcher = (parentScene && parentScene.scene && typeof parentScene.scene.launch === 'function')
      ? parentScene.scene
      : (function () {
          const active = game.scene.scenes.find((s) => s && s.sys && s.sys.isActive());
          return active && active.scene && typeof active.scene.launch === 'function' ? active.scene : null;
        }());
    if (!launcher) return;
    launcher.launch('SkillTreeScene', {
      from: (parentScene && parentScene.scene && parentScene.scene.key) || null
    });
  };
})();
