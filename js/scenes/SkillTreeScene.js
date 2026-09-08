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
      // #93: Passive haben keine abilityId, also auch keine Ability-Beschreibung.
      // Der Text steht deshalb hier — je Rang formuliert, weil die Wirkung
      // mit dem Rang waechst.
      'skilltree.passive.combat_poison_blade': '10 % Chance je Rang, einen Gegner zu vergiften.',
      'skilltree.passive.combat_lethal_thrust': '+10 % Kritchance je Rang waehrend des Stosses.',
      'skilltree.passive.combat_chain_lightning': 'Der Wirbel springt je Rang auf einen weiteren Gegner ueber.',
      'skilltree.passive.mobility_wind_gust': 'Geschosse durchschlagen je Rang einen Gegner mehr.',
      'skilltree.passive.survival_thorn_armor': 'Reflektiert 1,5 % der max-LP des Angreifers je Rang.',
      'skilltree.passive.survival_second_chance': 'Einmal je Lauf zurueck ins Leben, mit 15 % Leben je Rang.',
      'skilltree.passive.mobility_shadow_step': '+20 % Weite der Ausweichrolle je Rang.',
      'skilltree.passive.mobility_lightning_reflex': '+3 % Ausweichen je Rang. Nach einem Ausweichen 250 ms je Rang unverwundbar.',
      'skilltree.passive.survival_life_steal': '+4 % Lebensraub je Rang.',
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
      'skilltree.passive.combat_poison_blade': '10% chance per rank to poison an enemy.',
      'skilltree.passive.combat_lethal_thrust': '+10% crit chance per rank during the thrust.',
      'skilltree.passive.combat_chain_lightning': 'The spin chains to one more enemy per rank.',
      'skilltree.passive.mobility_wind_gust': 'Projectiles pierce one more enemy per rank.',
      'skilltree.passive.survival_thorn_armor': 'Reflects 1.5% of the attacker max HP per rank.',
      'skilltree.passive.survival_second_chance': 'Revive once per run with 15% life per rank.',
      'skilltree.passive.mobility_shadow_step': '+20% dodge roll distance per rank.',
      'skilltree.passive.mobility_lightning_reflex': '+3% dodge per rank. After a dodge, 250ms invulnerable per rank.',
      'skilltree.passive.survival_life_steal': '+4% life steal per rank.',
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
      this._buildTooltip();  // #78: Hover-Tooltip mit Talent-Erklaerung
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
        if (this._tt) {
          try { this._tt.bg.destroy(); this._tt.txt.destroy(); } catch (e) {}
          this._tt = null;
        }
      });
    }

    // #78: geteilter Hover-Tooltip (einmal gebaut, ueberlebt Re-Renders, da NICHT
    // in nodeViews). Zeigt beim Ueberfahren eines Talents die volle Erklaerung.
    _buildTooltip() {
      const bg = this.add.graphics().setScrollFactor(0).setDepth(2050).setVisible(false);
      const txt = this.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#e8e8f0',
        wordWrap: { width: 300 }, lineSpacing: 3, align: 'left'
      }).setScrollFactor(0).setDepth(2051).setVisible(false);
      this._tt = { bg: bg, txt: txt, pad: 10, maxW: 320 };
    }

    _showTooltip(text, cx, cy, cardH) {
      if (!this._tt || !text) return;
      const cam = this.cameras.main;
      const cw = cam.width, ch = cam.height;
      const pad = this._tt.pad, maxW = this._tt.maxW;
      const txt = this._tt.txt;
      txt.setWordWrapWidth(maxW - pad * 2);
      txt.setText(text);
      const boxW = Math.min(maxW, txt.width + pad * 2);
      const boxH = txt.height + pad * 2;
      // Bevorzugt ueber der Karte, sonst darunter; horizontal an der Karte
      // zentriert und auf den Bildschirm geklemmt.
      let x = Math.max(8, Math.min(cw - boxW - 8, cx - boxW / 2));
      let y = cy - cardH / 2 - 8 - boxH;
      if (y < 8) y = cy + cardH / 2 + 8;
      y = Math.max(8, Math.min(ch - boxH - 8, y));
      // Ganze Pixel, sonst flimmert der Tooltip-Text beim Wechsel zwischen
      // zwei Karten (derselbe Grund wie bei der Knoten-Geometrie).
      x = Math.round(x); y = Math.round(y);
      const bg = this._tt.bg;
      bg.clear();
      bg.fillStyle(0x0c0c14, 0.97).fillRoundedRect(x, y, boxW, boxH, 8);
      bg.lineStyle(2, 0xd4a543, 0.9).strokeRoundedRect(x, y, boxW, boxH, 8);
      bg.setVisible(true);
      txt.setPosition(x + pad, y + pad).setVisible(true);
    }

    _hideTooltip() {
      if (!this._tt) return;
      try { this._tt.bg.clear().setVisible(false); this._tt.txt.setVisible(false); } catch (e) {}
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
      // Tooltip verstecken: die Karte, ueber der er hing, wird gerade zerstoert.
      this._hideTooltip();
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
      // #93/UI: Geometrie je Knoten merken, damit die Voraussetzungen
      // anschliessend als Pfeile gezeichnet werden koennen (D2-artig).
      this._nodeGeo = {};

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

        // GLEICHRANGIGE KNOTEN TEILEN SICH EINE ZEILE (D2-artig).
        //
        // Vorher bekam jeder Knoten eine eigene Zeile — 21 Knoten ergaben drei
        // perfekte Saeulen, in denen nichts die Struktur des Baums zeigte.
        // Hammer und Raserei stehen aber auf DERSELBEN Stufe; nebeneinander
        // gesetzt sieht man das sofort, und die Pfeile darunter gabeln sich
        // sichtbar auf den Capstone zu.
        const zeilen = [];
        nodes.forEach((n) => {
          const t = this._tierOf(n);
          const letzte = zeilen[zeilen.length - 1];
          if (letzte && letzte.tier === t) letzte.knoten.push(n);
          else zeilen.push({ tier: t, knoten: [n] });
        });

        const rowsTop = top + 30;
        const rowGap = (bottom - rowsTop) / Math.max(1, zeilen.length);
        const cardH = Math.min(rowGap - 10, 74);

        zeilen.forEach((z, ri) => {
          const cy = rowsTop + ri * rowGap + rowGap / 2;
          const anzahl = z.knoten.length;
          // Schmaler als vorher (220 -> 140): die Karte traegt seit dem
          // Entschlacken nur noch Name, Pips und ggf. eine Zeile.
          const cardW = Math.min((colW - 20) / anzahl - 8, 140);
          z.knoten.forEach((node, ki) => {
            let ox;
            if (anzahl === 1) {
              // Einzelne Knoten leicht versetzt, damit keine perfekte Saeule
              // entsteht. Wechselnd nach Zeile — das erzeugt den leichten
              // Zickzack, den die D2-Baeume haben.
              ox = ((ri % 2 === 0) ? -1 : 1) * (colW * 0.09);
            } else {
              ox = (ki - (anzahl - 1) / 2) * (cardW + 12);
            }
            // AUF GANZE PIXEL RUNDEN.
            //
            // rowGap und die Spaltenmitte sind Brueche: gemessen lagen Knoten
            // auf x 214.04 und y 362.50000000000006. Canvas rastert Text auf
            // Sub-Pixeln mit Kantenglaettung — beim Neuzeichnen (z. B. wenn
            // der Hover die Fuellfarbe wechselt) faellt die Rasterung anders
            // aus, und die Beschriftung wirkt um ein Pixel verschoben.
            this._nodeGeo[node.id] = {
              x: Math.round(cx + ox), y: Math.round(cy),
              w: Math.round(cardW), h: Math.round(cardH), strand: strand
            };
          });
        });
      });

      // Erst die Pfeile (unter den Karten), dann die Karten darueber.
      this._renderPfeile(lvl);

      // Karten aus der gespeicherten Geometrie — nicht nochmal rechnen, sonst
      // laufen Pfeile und Karten beim naechsten Umbau auseinander.
      all.forEach((node) => {
        const geo = this._nodeGeo[node.id];
        if (geo) this._renderNode(node, geo.x, geo.y, geo.w, geo.h, lvl);
      });
    }

    /**
     * Voraussetzungen als Pfeile — analog zum Talentbaum von Diablo 2.
     *
     * Bis hierher stand die Bedingung nur als Text auf der gesperrten Karte
     * ("Benoetigt Hammer Rang 2"). Bei 21 Knoten ist eine Linie schneller zu
     * lesen als neun Saetze.
     *
     * Gefuehrt wird seitlich an der Spalte entlang: alle Knoten eines Strangs
     * stehen untereinander, eine gerade Verbindung liefe quer durch die Karten
     * dazwischen. Der Pfeil geht also aus der Flanke heraus, an der Spalte
     * hinunter und von der Seite in den Zielknoten.
     */
    _renderPfeile(playerLevel) {
      const ST = window.SkillTree;
      if (!ST || !this._nodeGeo) return;
      const g = this.add.graphics().setScrollFactor(0).setDepth(2001);
      this.nodeViews.push(g);

      const alle = ST.getAllNodes() || [];
      alle.forEach((node) => {
        const req = node.requires || {};
        const quellen = [];
        if (req.node) quellen.push({ node: req.node, rank: req.rank || 1 });
        if (Array.isArray(req.nodes)) {
          req.nodes.forEach((nr) => { if (nr && nr.node) quellen.push({ node: nr.node, rank: nr.rank || 1 }); });
        }
        const ziel = this._nodeGeo[node.id];
        if (!ziel || !quellen.length) return;

        quellen.forEach((q) => {
          const von = this._nodeGeo[q.node];
          if (!von) return;
          // Erfuellt? Dann kraeftig, sonst gedaempft — man sieht auf einen
          // Blick, welcher Weg schon offen ist.
          const erfuellt = ST.getRank(q.node) >= q.rank;
          const farbe = erfuellt ? (STRAND_COLORS[node.strand] || 0x8899aa) : 0x44444c;
          g.lineStyle(erfuellt ? 2 : 1.5, farbe, erfuellt ? 0.85 : 0.45);

          // Ellbogen von unten nach oben: senkrecht aus der Quelle heraus, auf
          // halber Hoehe waagerecht herueber, senkrecht in das Ziel. Seit die
          // Knoten seitlich versetzt sind, laeuft eine gerade Linie nicht mehr
          // durch die Karten dazwischen — und die Gabelung zweier Quellen auf
          // einen Capstone wird als solche sichtbar.
          const vonY = von.y + von.h / 2;
          const zielY = ziel.y - ziel.h / 2;
          const mitteY = vonY + (zielY - vonY) * 0.5;

          g.beginPath();
          g.moveTo(von.x, vonY);
          g.lineTo(von.x, mitteY);
          g.lineTo(ziel.x, mitteY);
          g.lineTo(ziel.x, zielY);
          g.strokePath();

          // Spitze am Zielknoten, zeigt nach unten auf ihn.
          const s = 5;
          g.fillStyle(farbe, erfuellt ? 0.9 : 0.5);
          g.beginPath();
          g.moveTo(ziel.x, zielY);
          g.lineTo(ziel.x - s * 0.8, zielY - s);
          g.lineTo(ziel.x + s * 0.8, zielY - s);
          g.closePath();
          g.fillPath();
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
      let fill, stroke, nameColor;
      if (!prereqOk && rank === 0) {
        fill = 0x1c1c22; stroke = 0x3a3a3a; nameColor = '#666666';
      } else if (isMax) {
        fill = 0x243024; stroke = 0x66cc66; nameColor = '#cfffcf';
      } else if (rank > 0) {
        fill = 0x232830; stroke = STRAND_COLORS[node.strand]; nameColor = STRAND_COLORS_HEX[node.strand];
      } else if (investable) {
        fill = 0x2c2a1a; stroke = 0xffd166; nameColor = '#ffe9a8';
      } else {
        // prereq met but no points to spend yet
        fill = 0x222226; stroke = 0x555555; nameColor = '#cccccc';
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

      // UNTER DEN PIPS STEHT NICHTS MEHR.
      //
      // Hier standen nacheinander: "Rang 2/5", "Naechster Rang: 5 Pkt",
      // "Ab Stufe 6" und "Staerker mit Wirbelwind". Vier Zeilen auf einer
      // Karte, die bei 21 Knoten auf drei Spalten 140 px breit ist — das war
      // nicht mehr zu lesen.
      //
      // Alles davon liegt jetzt im Hover. Die Karte zeigt nur noch, was auf
      // einen Blick erfassbar sein muss: Name, Rang als Pips, Zustand ueber
      // die Farbe. Die Voraussetzungen zeigen die Pfeile.
      const infoZeilen = [];
      infoZeilen.push(_ST_T('skilltree.node.rank', { cur: rank, max: maxRank }));
      if (!isMax) infoZeilen.push(_ST_T('skilltree.node.cost', { cost: nextCost }));

      const req = node.requires || {};
      if (!prereqOk && rank === 0) {
        // Alle Knoten-Vorbedingungen sammeln (Einzel-`node` + `nodes`-Array).
        if (req.node) {
          const reqNode = ST.getNode(req.node);
          infoZeilen.push(_ST_T('skilltree.node.req_node', {
            name: (reqNode && reqNode.name) || req.node, rank: req.rank || 1
          }));
        }
        if (Array.isArray(req.nodes)) {
          req.nodes.forEach((nr) => {
            if (!nr || !nr.node) return;
            const rn = ST.getNode(nr.node);
            infoZeilen.push(_ST_T('skilltree.node.req_node', {
              name: (rn && rn.name) || nr.node, rank: nr.rank || 1
            }));
          });
        }
      }
      // Das Level-Tor auch dann nennen, wenn die Knoten-Bedingung erfuellt
      // ist — sonst steht man vor einem gesperrten Knoten ohne Grund.
      if (req.minLevel && playerLevel < req.minLevel) {
        infoZeilen.push(_ST_T('skilltree.node.req_level', { level: req.minLevel }));
      }
      if (Array.isArray(node.synergies) && node.synergies.length > 0) {
        // Nenne die Quell-Knoten: dieser Skill wird stärker, je höher die
        // genannten geskillt sind (z.B. Hammer stärker mit Wirbelwind).
        const srcNames = [];
        node.synergies.forEach((s) => {
          const sn = ST.getNode(s.from);
          const nm = (sn && sn.name) || s.from;
          if (srcNames.indexOf(nm) === -1) srcNames.push(nm);
        });
        infoZeilen.push(_ST_T('skilltree.node.synergy', { source: srcNames.join(', ') }));
      }
      const sub = infoZeilen.join('\n');

      // #78: Mouse-over-Tooltip mit voller Talent-Erklaerung. Der Effekt-Text
      // kommt aus dem AbilitySystem (getAbilityDef) — die Karte selbst zeigt ihn
      // aus Platzgruenden nicht. EN ueber i18n-Key, sonst Inline-Beschreibung.
      const strandName = _ST_T('skilltree.strand.' + node.strand);
      let effect = '';
      // #93: Passive haben keine abilityId — ihr Text kommt aus der
      // i18n-Tabelle dieser Szene. Ohne das blieb der Hover leer.
      if (node.passiv) {
        const pk = 'skilltree.passive.' + node.id;
        const pt = _ST_T(pk);
        if (pt && pt !== pk) effect = pt;
      }
      const AS = window.AbilitySystem;
      if (!effect && AS && typeof AS.getAbilityDef === 'function' && node.abilityId) {
        const adef = AS.getAbilityDef(node.abilityId);
        if (adef) {
          const dkey = 'ability.' + node.abilityId + '.description';
          const dloc = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(dkey) : null;
          effect = (dloc && dloc.indexOf('[MISSING') !== 0 && dloc !== dkey) ? dloc : (adef.description || '');
        }
      }
      const ttText = (node.name || node.id) + '   [' + strandName + ']'
        + (effect ? '\n\n' + effect : '')
        + (sub ? '\n\n' + sub : '');
      card.on('pointerover', () => this._showTooltip(ttText, cx, cy, h));
      card.on('pointerout', () => this._hideTooltip());
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
