// PrintingHouseScene — die Druckerei als eigene Overlay-Szene (#24, b435).
//
// Messing-Stil wie die Tiefenwahl (b417): Kopf mit Setzer Thoms Medaillon,
// Statusplaketten (Druckblaetter, Akt, Verdacht, aktives Edikt), darunter
// ALLE Edikte des Katalogs als Karten in einer scrollbaren, maskierten Liste
// (Mausrad, Ziehen, Pfeiltasten) — auch die gesperrten, gedimmt und mit
// ihrem Grund. Vorher fielen Karten, die nicht passten, einfach weg.
//
// Launched via window.openPrintingHouseScene(parentScene). The parent stays
// running underneath; ESC, E or the Close button stops this overlay.

(function () {
  if (window.i18n) {
    window.i18n.register('de', {
      'printingHouse.ui.title': 'Druckerei',
      'printingHouse.ui.paper': 'Druckblätter',
      'printingHouse.ui.suspicion': 'Council-Verdacht',
      'printingHouse.ui.state.alert': 'wachsam',
      'printingHouse.ui.state.hunt': 'Jagd',
      'printingHouse.ui.suspicion_hint': 'Ab 10: mehr Elite-Gegner im Dungeon.\nAb 20: Aldric verweigert neue Aufträge.\nSinkt um 1 je Lauf ohne Edikt. Bestechen: -5 für 100 Gold.',
      'printingHouse.ui.act': 'Akt',
      'printingHouse.ui.active_edict': 'Aktives Edikt',
      'printingHouse.ui.no_active': 'Kein Edikt aktiv',
      'printingHouse.ui.status.locked': 'Ab Akt {req}',
      'printingHouse.ui.status.unaffordable': 'Zu wenig Papier',
      'printingHouse.ui.status.active': 'Aktiv',
      'printingHouse.ui.status.available': 'Drucken',
      'printingHouse.ui.status.blocked_by_active': 'Anderes Edikt aktiv',
      'printingHouse.ui.btn.bribe': 'Bestechen',
      'printingHouse.ui.btn.tradegold': 'Tauschen',
      'printingHouse.ui.btn.close': 'Schließen',
      'printingHouse.ui.sym.paper': 'Blatt',
      'printingHouse.ui.sym.suspicion': 'Verdacht',
      'printingHouse.ui.sym.gold': 'Gold'
    });
    window.i18n.register('en', {
      'printingHouse.ui.title': 'Printing House',
      'printingHouse.ui.paper': 'Print sheets',
      'printingHouse.ui.suspicion': 'Council suspicion',
      'printingHouse.ui.state.alert': 'alert',
      'printingHouse.ui.state.hunt': 'hunt',
      'printingHouse.ui.suspicion_hint': 'From 10: more elite enemies in the dungeon.\nFrom 20: Aldric refuses new assignments.\nDrops by 1 per run without an edict. Bribe: -5 for 100 gold.',
      'printingHouse.ui.act': 'Act',
      'printingHouse.ui.active_edict': 'Active edict',
      'printingHouse.ui.no_active': 'No edict active',
      'printingHouse.ui.status.locked': 'From act {req}',
      'printingHouse.ui.status.unaffordable': 'Not enough paper',
      'printingHouse.ui.status.active': 'Active',
      'printingHouse.ui.status.available': 'Print',
      'printingHouse.ui.status.blocked_by_active': 'Another edict active',
      'printingHouse.ui.btn.bribe': 'Bribe',
      'printingHouse.ui.btn.tradegold': 'Trade',
      'printingHouse.ui.btn.close': 'Close',
      'printingHouse.ui.sym.paper': 'Sheet',
      'printingHouse.ui.sym.suspicion': 'Susp.',
      'printingHouse.ui.sym.gold': 'Gold'
    });
  }

  const T = (k, p) => (window.i18n ? window.i18n.t(k, p) : k);

  // Pixel-Symbole (tools/druckSymboleBauen.js baut den Streifen in dieser Reihenfolge).
  const DRUCK_SYMBOLE = ['papier', 'verdacht', 'gold', 'schloss'];
  const SYMBOL_KEY = 'ui_druck_symbole';
  const THOM_KEY = 'ui_symbol_thom';

  // Je Stufe: Farbton der Kartenmitte, Akzent (Plakette, "Drucken") und
  // die schlichte Rueckfall-Farbe ohne Messing.
  const TIER_THEME = {
    mild:   { ton: '#1d3a22', accent: '#8fe0a8', border: 0x6fb98f, soft: 0x1d3a22 },
    strong: { ton: '#40331c', accent: '#ffd166', border: 0xddbb55, soft: 0x40331c },
    risky:  { ton: '#431a1a', accent: '#ff9a8a', border: 0xdd5555, soft: 0x431a1a }
  };
  const TIER_FARBE = { mild: 0x8fe0a8, strong: 0xffd166, risky: 0xff9a8a };

  // Raster der Liste
  const CARD_H = 88;
  const ROW_GAP = 8;
  const COL_GAP = 12;
  const ROW_H = CARD_H + ROW_GAP;
  const DRAG_SCHWELLE = 8;

  /** Alles rekursiv bildschirmfest (wie HubSceneV2._ktPropagateScrollFactor). */
  function bildschirmfest(o) {
    if (!o) return;
    if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0, 0);
    if (o.list && Array.isArray(o.list)) o.list.forEach(bildschirmfest);
  }

  /** Text in seine Breite einpassen: erst kleiner, dann kuerzen. */
  function einpassen(t, breite, minPx) {
    let px = parseFloat(t.style.fontSize) || 14;
    while (t.width > breite && px > minPx) { px -= 1; t.setFontSize(px + 'px'); }
    if (t.width > breite) {
      let s = String(t.text);
      while (s.length > 1 && t.width > breite) { s = s.slice(0, -1); t.setText(s.trimEnd() + '...'); }
    }
    return t;
  }

  class PrintingHouseScene extends Phaser.Scene {
    constructor() { super({ key: 'PrintingHouseScene' }); }

    preload() {
      // #198: die Presse, die beim Drucken stampft.
      const P = window.Druckerpresse;
      if (P && !P.da(this)) {
        this.load.spritesheet(P.KEY, 'assets/sprites/presse/druckerpresse.png', { frameWidth: 128, frameHeight: 128 });
      }
      if (!this.textures.exists(SYMBOL_KEY)) {
        this.load.spritesheet(SYMBOL_KEY, 'assets/ui/ui_druck_symbole.png?v=1', { frameWidth: 32, frameHeight: 32 });
      }
      if (!this.textures.exists(THOM_KEY)) this.load.image(THOM_KEY, 'assets/ui/ui_symbol_thom.png?v=1');
    }

    create(data) {
      this.parentSceneKey = (data && data.from) || null;
      this._gesperrt = false;
      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;
      const UR = window.uiRahmen;
      this._messing = !!(UR && UR.bereit(this));
      // Ohne Messing: nachladen und dann in Messing neu aufbauen.
      if (UR && !this._messing) {
        try { UR.nachladen(this, () => this._refresh()); } catch (e) { /* Rueckfall bleibt */ }
      }

      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.78)
        .setScrollFactor(0).setDepth(2000);

      const ph = window.PrintingHouse;
      const katalog = ph.getEdictCatalog();

      // Hoehen: Kopf + Plaketten, Liste (nur ganze Zeilen), Fusszeile.
      const panelW = Math.min(900, cw - 24);
      const kopfH = 120;
      const fussH = 62;
      const innenW = panelW - 48;
      const zeilen = Math.max(1, Math.ceil(katalog.length / 2));
      const inhaltH = zeilen * ROW_H - ROW_GAP;
      const platzH = Math.max(CARD_H, ch - 12 - kopfH - fussH);
      const ganze = Math.max(1, Math.floor((platzH + ROW_GAP) / ROW_H));
      const viewH = Math.min(inhaltH, ganze * ROW_H - ROW_GAP);
      const panelH = kopfH + viewH + fussH;
      const px = cw / 2;
      const py = ch / 2;
      const left = Math.round(px - panelW / 2);
      const top = Math.round(py - panelH / 2);
      this._panel = { left, top, w: panelW, h: panelH };

      if (!(this._messing && UR.menuePlatte(this, px, py, panelW, panelH, 2000.5))) {
        const g = this.add.graphics().setScrollFactor(0).setDepth(2001);
        g.fillStyle(0x10131c, 0.97).fillRoundedRect(left, top, panelW, panelH, 16);
        g.lineStyle(3, 0xffd166, 0.92).strokeRoundedRect(left, top, panelW, panelH, 16);
      }

      this._renderKopf(left + 24, top + 14, innenW);
      this._renderStatus(left + 24, top + 64, innenW, 46);
      this._renderListe(left + 24, top + kopfH, innenW, viewH, katalog, data || {});
      this._renderActionBar(left, top + panelH - fussH + 6, panelW);

      // #189: Knoepfe im Messing-Stil, Texte lesbar.
      if (UR) UR.einkleiden(this);

      this.input.keyboard.on('keydown-ESC', () => this._close());
      this.input.keyboard.on('keydown-E',   () => this._close());
      this._tasten = (ev) => this._taste(ev);
      this.input.keyboard.on('keydown', this._tasten);

      if (window.i18n && typeof window.i18n.onChange === 'function') {
        this._unsubI18n = window.i18n.onChange(() => {
          if (this.scene && this.scene.isActive && this.scene.isActive()) this._refresh();
        });
      }
      this.events.once('shutdown', () => {
        if (this._unsubI18n) { this._unsubI18n(); this._unsubI18n = null; }
        this._abmelden();
      });
    }

    // ---- Bausteine ---------------------------------------------------------

    _symbolDa() { return this.textures.exists(SYMBOL_KEY); }

    /** Pixel-Symbol (oder kurzes Wort, wenn der Streifen fehlt); origin links-mitte. */
    _symbol(name, x, y, groesse, ziel) {
      let o;
      if (this._symbolDa()) {
        o = this.add.image(x + groesse / 2, y, SYMBOL_KEY, DRUCK_SYMBOLE.indexOf(name)).setDisplaySize(groesse, groesse);
        o._breite = groesse;
      } else {
        const wort = { papier: 'paper', verdacht: 'suspicion', gold: 'gold', schloss: null }[name];
        o = this.add.text(x, y, wort ? T('printingHouse.ui.sym.' + wort) : '', {
          fontFamily: 'monospace', fontSize: '11px', color: '#d8ccb4'
        }).setOrigin(0, 0.5);
        o._breite = o.width;
      }
      o.setName('druckSymbol_' + name);
      if (ziel) ziel.add(o); else o.setScrollFactor(0).setDepth(2003);
      return o;
    }

    /** Kleine Platte (Plakette) als Bild oder schlichter Kasten. */
    _plakette(x, y, w, h, ziel, rand) {
      const UR = window.uiRahmen;
      const key = this._messing && UR.kachelBild ? UR.kachelBild(this, w, h) : null;
      let o;
      if (key) {
        o = this.add.image(x + w / 2, y + h / 2, key);
      } else {
        o = this.add.graphics();
        o.fillStyle(0x0c0c12, 0.9).fillRoundedRect(x, y, w, h, 6);
        o.lineStyle(1, rand || 0x806b3a, 0.9).strokeRoundedRect(x, y, w, h, 6);
      }
      if (ziel) ziel.add(o); else o.setScrollFactor(0).setDepth(2002);
      return o;
    }

    _text(x, y, s, stil, ziel) {
      const t = this.add.text(x, y, s, Object.assign({ fontFamily: 'monospace', fontSize: '12px', color: '#efe6d2' }, stil));
      if (ziel) ziel.add(t); else t.setScrollFactor(0).setDepth(2003);
      return t;
    }

    // ---- Kopf: Medaillon, Titel, Thoms Frage --------------------------------
    _renderKopf(x, y, w) {
      let tx = x;
      if (this.textures.exists(THOM_KEY)) {
        this.add.image(x + 23, y + 23, THOM_KEY).setDisplaySize(46, 46)
          .setScrollFactor(0).setDepth(2003).setName('druckThom');
        tx = x + 46 + 12;
      }
      const titel = this._text(tx, y, T('printingHouse.ui.title'), {
        fontFamily: 'serif', fontSize: '24px', color: '#ffd166', fontStyle: 'bold'
      });
      titel.setName('druckTitel');
      const frage = this._text(tx, y + 30, T('printingHouse.npc.name') + ': ' + T('printingHouse.dialog.intro'), {
        fontSize: '13px', color: '#d8ccb4'
      });
      frage.setName('druckFrage');
      einpassen(frage, x + w - tx, 11);
    }

    // ---- Statusplaketten ----------------------------------------------------
    _renderStatus(x, y, w, h) {
      const ph = window.PrintingHouse;
      const paper = ph.getDruckblaetter();
      const suspicion = ph.getSuspicion();
      const active = ph.getActivePublication();
      // Akt wie der Splashscreen: Index + 1 (tests/aktnummern*.test.js).
      const aktIdx = (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function')
        ? window.storySystem.getCurrentActIndex() | 0 : 0;
      const gap = 10;
      const bw = [0.24, 0.17, 0.27, 0.32].map((f) => Math.floor((w - gap * 3) * f));
      let px = x;
      const zellen = [];
      bw.forEach((b) => { zellen.push(px); px += b + gap; });
      const label = (cx, s, breite) => {
        const t = this._text(cx + 10, y + 5, s.toUpperCase(), { fontSize: '11px', color: '#d8ccb4' });
        t.setName('druckLabel');
        return einpassen(t, breite - 20, 9);
      };
      const balken = (bx, by, bwid, anteile) => {
        const g = this.add.graphics().setScrollFactor(0).setDepth(2003);
        g.fillStyle(0x000000, 0.55).fillRect(bx, by, bwid, 6);
        const seg = bwid / anteile.length;
        anteile.forEach(([a, farbe], i) => {
          if (a > 0) g.fillStyle(farbe, 1).fillRect(bx + seg * i, by, Math.round(seg * Math.min(1, a)), 6);
        });
        g.lineStyle(1, 0xc9a25a, 0.7).strokeRect(bx - 0.5, by - 0.5, bwid + 1, 7);
        for (let i = 1; i < anteile.length; i++) g.lineBetween(bx + seg * i, by, bx + seg * i, by + 6);
        return g;
      };
      const wertY = y + h - 15;

      // 1) Druckblaetter: Symbol, "x / 50", Balken
      {
        const cx = zellen[0], b = bw[0];
        this._plakette(cx, y, b, h);
        label(cx, T('printingHouse.ui.paper'), b);
        const s = this._symbol('papier', cx + 10, wertY, 22);
        const v = this._text(cx + 10 + s._breite + 6, wertY, paper + ' / 50', {
          fontSize: '16px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        v.setName('druckWertPapier');
        const bx = v.x + v.width + 10;
        if (cx + b - 12 - bx >= 24) balken(bx, wertY - 3, cx + b - 12 - bx, [[paper / 50, 0xffd166]]);
      }
      // 2) Akt: Zahl wie der Splashscreen, drei Stufen-Punkte (offen = gefuellt)
      {
        const cx = zellen[1], b = bw[1];
        this._plakette(cx, y, b, h);
        label(cx, T('printingHouse.ui.act'), b);
        const v = this._text(cx + 10, wertY, String(aktIdx + 1), {
          fontFamily: 'serif', fontSize: '20px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        v.setName('druckWertAkt');
        const g = this.add.graphics().setScrollFactor(0).setDepth(2003);
        const offen = { mild: true, strong: false, risky: false };
        ph.getEdictCatalog().forEach((e) => { if (e.isUnlocked) offen[e.tier] = true; });
        ['mild', 'strong', 'risky'].forEach((tier, i) => {
          const qx = v.x + v.width + 12 + i * 14, qy = wertY - 5;
          if (offen[tier]) g.fillStyle(TIER_FARBE[tier], 1).fillRect(qx, qy, 10, 10);
          else g.lineStyle(1, TIER_FARBE[tier], 0.8).strokeRect(qx + 0.5, qy + 0.5, 9, 9);
        });
      }
      // 3) Verdacht: Auge, Zahl, Balken in drei Stufen (0-10 ruhig, 10-20 wachsam, 20+ Jagd)
      {
        const cx = zellen[2], b = bw[2];
        this._plakette(cx, y, b, h);
        // Die Folgen stehen dabei: ab 10 mehr Elite-Gegner, ab 20 verweigert
        // Aldric Auftraege (printingHouse.getRetaliationTier) — vorher zeigte
        // der Balken nur eine Zahl, die Wirkung blieb unsichtbar.
        const stufe = suspicion >= 20 ? 'hunt' : suspicion >= 10 ? 'alert' : null;
        label(cx, T('printingHouse.ui.suspicion') + (stufe ? ': ' + T('printingHouse.ui.state.' + stufe) : ''), b)
          .setName('druckLabelVerdacht');
        this._verdachtHinweis(cx, y, b, h);
        const s = this._symbol('verdacht', cx + 10, wertY, 22);
        const farbe = suspicion >= 20 ? '#ff8a7a' : suspicion >= 10 ? '#ffb86a' : '#8fe0a8';
        const v = this._text(cx + 10 + s._breite + 6, wertY, String(suspicion), {
          fontSize: '16px', color: farbe, fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        v.setName('druckWertVerdacht');
        const bx = Math.max(v.x + v.width + 10, cx + 10 + s._breite + 40);
        balken(bx, wertY - 3, cx + b - 12 - bx, [
          [suspicion / 10, 0x8fe0a8], [(suspicion - 10) / 10, 0xffb86a], [(suspicion - 20) / 10, 0xff6a5a]
        ]);
      }
      // 4) Aktives Edikt
      {
        const cx = zellen[3], b = bw[3];
        this._plakette(cx, y, b, h);
        label(cx, T('printingHouse.ui.active_edict'), b);
        const v = this._text(cx + 10, wertY, active
          ? T('printingHouse.edict.' + active.id + '.label') : T('printingHouse.ui.no_active'), {
          fontFamily: 'serif', fontSize: '15px',
          color: active ? '#9be89b' : '#bfb5a0', fontStyle: active ? 'bold' : 'italic'
        }).setOrigin(0, 0.5);
        v.setName('druckWertAktiv');
        einpassen(v, b - 20, 11);
      }
    }

    /** Hinweis mit den Regeln des Verdachts: beim Ueberfahren, auf Mobile per Tipp. */
    _verdachtHinweis(x, y, w, h) {
      const zone = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
        .setScrollFactor(0).setDepth(2004).setInteractive({ useHandCursor: true }).setName('druckVerdachtZone');
      const text = this._text(0, 0, T('printingHouse.ui.suspicion_hint'), {
        fontSize: '12px', color: '#efe6d2', lineSpacing: 4, wordWrap: { width: Math.max(260, w + 60) }
      }).setDepth(2302).setVisible(false).setName('druckVerdachtHinweis');
      const pad = 10, links = Math.max(8, x + w / 2 - (text.width + pad * 2) / 2), oben = y + h + 6;
      text.setPosition(links + pad, oben + pad);
      const UR = window.uiRahmen;
      // Die Platte erst beim ersten Zeigen anlegen: sie besteht aus neun
      // Rahmenteilen, die sonst schon beim Oeffnen in der Szene laegen.
      let platte = null, grund = null;
      let offen = false;
      const zeigen = (an) => {
        offen = an;
        if (an && !platte && !grund) {
          platte = this._messing && UR.tipPlatte ? UR.tipPlatte(this, 2301, 0.4) : null;
          if (!platte) {
            grund = this.add.rectangle(links, oben, text.width + pad * 2, text.height + pad * 2, 0x0c0c12, 0.96)
              .setOrigin(0, 0).setStrokeStyle(1, 0xc9a25a, 0.9).setScrollFactor(0).setDepth(2301).setVisible(false);
          }
        }
        text.setVisible(an);
        if (platte) { if (an) platte.lege(links, oben, text.width + pad * 2, text.height + pad * 2); else platte.verstecke(); }
        if (grund) grund.setVisible(an);
      };
      zone.on('pointerover', () => zeigen(true));
      zone.on('pointerout', () => zeigen(false));
      zone.on('pointerdown', () => zeigen(!offen));
      this._verdachtZeigen = zeigen;
    }

    // ---- Edikt-Liste --------------------------------------------------------
    _zustand(e, active, paper) {
      if (active && active.id === e.id) return 'aktiv';
      if (!e.isUnlocked) return 'gesperrt';
      if (active) return 'blockiert';
      if (paper < e.cost) return 'papier';
      return 'druckbar';
    }

    _renderListe(x, y, w, viewH, katalog, data) {
      const ph = window.PrintingHouse;
      const active = ph.getActivePublication();
      const paper = ph.getDruckblaetter();
      const zeilen = Math.max(1, Math.ceil(katalog.length / 2));
      const inhaltH = zeilen * ROW_H - ROW_GAP;
      const maxScroll = Math.max(0, inhaltH - viewH);
      const scrollbar = maxScroll > 1;
      const listW = w - (scrollbar ? 16 : 0);
      const cardW = Math.floor((listW - COL_GAP) / 2);

      const listC = this.add.container(x, y).setDepth(2002);
      listC.setName('druckListe');
      const maskG = this.make.graphics({ add: false });
      maskG.fillStyle(0xffffff, 1).fillRect(x - 4, y - 2, listW + 8, viewH + 4);
      listC.setMask(maskG.createGeometryMask());
      this._maskG = maskG;

      const karten = [];
      katalog.forEach((e, i) => {
        const kx = (i % 2) * (cardW + COL_GAP);
        const ky = Math.floor(i / 2) * ROW_H;
        karten.push(this._renderKarte(listC, e, kx, ky, cardW, CARD_H, this._zustand(e, active, paper), i));
      });

      // Rollbalken in Messing
      let thumb = null;
      if (scrollbar) {
        const trackX = x + listW + 10;
        const g = this.add.graphics().setScrollFactor(0).setDepth(2003);
        g.fillStyle(0x000000, 0.45).fillRoundedRect(trackX - 3, y + 2, 6, viewH - 4, 3);
        g.lineStyle(1, 0x806b3a, 0.8).strokeRoundedRect(trackX - 3.5, y + 1.5, 7, viewH - 3, 3);
        thumb = this.add.rectangle(trackX, y, 6, 30, 0xc9a25a, 1).setOrigin(0.5, 0)
          .setScrollFactor(0).setDepth(2004);
        thumb.setName('druckRollbalken');
      }

      const vp = { x: x - 4, y, w: w + 8, h: viewH };
      const imViewport = (p) => !!p && p.x >= vp.x && p.x <= vp.x + vp.w && p.y >= vp.y && p.y <= vp.y + vp.h;
      const L = this._druck = {
        karten, maxScroll, viewport: vp, scroll: 0, dragMoved: 0, fokus: -1, imViewport,
        setScroll: (v) => {
          L.scroll = Phaser.Math.Clamp(v, 0, maxScroll);
          listC.y = y - L.scroll;
          karten.forEach((k) => {
            const oben = k.y - L.scroll, unten = oben + CARD_H;
            if (k.hit.input) k.hit.input.enabled = unten > 4 && oben < viewH - 4;
          });
          if (thumb && thumb.scene) {
            const trackH = viewH - 4;
            const thumbH = Math.max(24, Math.round(trackH * viewH / inhaltH));
            thumb.y = y + 2 + (maxScroll > 0 ? L.scroll / maxScroll : 0) * (trackH - thumbH);
            thumb.height = thumbH;
            thumb.setSize(6, thumbH);
          }
        }
      };

      // Mausrad und Ziehen (Klick zaehlt erst beim Loslassen ohne Wisch)
      let ziehen = false, startY = 0, startScroll = 0;
      this._onWheel = (p, over, dx, dy) => { if (!this._gesperrt) L.setScroll(L.scroll + dy * 0.5); };
      this._onDown = (p) => {
        L.dragMoved = 0;
        if (this._gesperrt || !imViewport(p)) return;
        ziehen = true; startY = p.y; startScroll = L.scroll;
      };
      this._onMove = (p) => {
        if (!ziehen) return;
        const d = startY - p.y;
        L.dragMoved = Math.max(L.dragMoved, Math.abs(d));
        if (L.dragMoved >= DRAG_SCHWELLE) L.setScroll(startScroll + d);
      };
      this._onUp = () => { ziehen = false; };
      this.input.on('wheel', this._onWheel);
      this.input.on('pointerdown', this._onDown);
      this.input.on('pointermove', this._onMove);
      this.input.on('pointerup', this._onUp);

      bildschirmfest(listC);
      L.setScroll(data.scroll || 0);
      if (typeof data.fokus === 'number' && data.fokus >= 0) this._fokussiere(data.fokus, false);
    }

    _renderKarte(listC, e, x, y, w, h, zustand, index) {
      const UR = window.uiRahmen;
      const th = TIER_THEME[e.tier] || TIER_THEME.mild;
      const gesperrt = zustand === 'gesperrt';
      const aktiv = zustand === 'aktiv';
      const matt = gesperrt || zustand === 'blockiert';
      const ton = aktiv ? '#1f3a1f' : (matt ? '#141216' : th.ton);

      // Grund: Messingfeld (aktiv = heller Beschlag) bzw. schlichter Kasten.
      let box;
      if (this._messing) {
        box = this.add.image(x + w / 2, y + h / 2, UR.feldBild(this, w, h, aktiv, ton));
      } else {
        box = this.add.graphics();
        box.fillStyle(matt ? 0x161618 : th.soft, 0.95).fillRoundedRect(x, y, w, h, 10);
        box.lineStyle(2, aktiv ? 0x88ff88 : th.border, matt ? 0.4 : 0.9).strokeRoundedRect(x, y, w, h, 10);
      }
      if (gesperrt) box.setAlpha(0.75);
      listC.add(box);
      const fokusG = this.add.graphics();
      fokusG.lineStyle(2, 0xffd166, 0.95).strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 8);
      fokusG.setVisible(aktiv);
      listC.add(fokusG);

      const innen = 14;
      const farben = {
        druckbar:  { name: '#f2e9d8', desc: '#d8ccb4', zustand: th.accent },
        papier:    { name: '#e6dac2', desc: '#c8bca4', zustand: '#ffb07a' },
        aktiv:     { name: '#c8f5c8', desc: '#d8ccb4', zustand: '#9be89b' },
        blockiert: { name: '#d0c6b2', desc: '#c4baa6', zustand: '#c4baa6' },
        gesperrt:  { name: '#ccc2ae', desc: '#c4baa6', zustand: '#e0c890' }
      }[zustand];

      // Stufen-Plakette oben rechts
      const tierText = T('printingHouse.tier.' + e.tier).toUpperCase();
      const plW = 74, plH = 20;
      const plX = x + w - innen - plW, plY = y + 9;
      this._plakette(plX, plY, plW, plH, listC, th.border);
      const tierT = this._text(plX + plW / 2, plY + plH / 2, tierText, {
        fontSize: '11px', color: th.accent, fontStyle: 'bold'
      }, listC).setOrigin(0.5);
      tierT.setName('druckStufe');
      einpassen(tierT, plW - 8, 9);

      // Name
      const name = this._text(x + innen, y + 8, T('printingHouse.edict.' + e.id + '.label'), {
        fontFamily: 'serif', fontSize: '17px', color: farben.name, fontStyle: 'bold'
      }, listC);
      name.setName('druckName');
      einpassen(name, plX - 8 - (x + innen), 13);

      // Wirkung (bis zwei Zeilen)
      const desc = this._text(x + innen, y + 31, T('printingHouse.edict.' + e.id + '.desc'), {
        fontSize: '13px', color: farben.desc, lineSpacing: 1,
        wordWrap: { width: w - innen * 2, useAdvancedWrap: true }
      }, listC);
      desc.setName('druckWirkung');
      const descMax = 34;
      if (desc.height > descMax) {
        desc.setFontSize('12px');
        if (desc.height > descMax) desc.setText(desc.getWrappedText(desc.text).slice(0, 2).join('\n').replace(/\s*$/, '...'));
      }

      // Kosten: Druckblaetter und Verdacht als Symbol + Zahl
      const ky = y + h - 15;
      let cx = x + innen;
      const kostenFarbe = zustand === 'papier' ? '#ffb07a' : farben.name;
      const sP = this._symbol('papier', cx, ky, 18, listC);
      if (matt) sP.setAlpha(0.6);
      cx += sP._breite + 4;
      const vP = this._text(cx, ky, String(e.cost), { fontSize: '13px', color: kostenFarbe, fontStyle: 'bold' }, listC).setOrigin(0, 0.5);
      vP.setName('druckKostenPapier');
      cx += vP.width + 14;
      const sV = this._symbol('verdacht', cx, ky, 18, listC);
      if (matt) sV.setAlpha(0.6);
      cx += sV._breite + 4;
      const vV = this._text(cx, ky, '+' + e.suspicionCost, { fontSize: '13px', color: farben.name, fontStyle: 'bold' }, listC).setOrigin(0, 0.5);
      vV.setName('druckKostenVerdacht');
      const kostenEnde = vV.x + vV.width;

      // Zustand rechts unten (gesperrt mit Schloss und Aktnummer = Index + 1)
      const zText = {
        druckbar: T('printingHouse.ui.status.available'),
        papier: T('printingHouse.ui.status.unaffordable'),
        aktiv: T('printingHouse.ui.status.active'),
        blockiert: T('printingHouse.ui.status.blocked_by_active'),
        gesperrt: T('printingHouse.ui.status.locked', { req: (e.requireAct | 0) + 1 }).replace('{req}', (e.requireAct | 0) + 1)
      }[zustand];
      const zT = this._text(x + w - innen, ky, zText, {
        fontSize: '13px', color: farben.zustand, fontStyle: 'bold'
      }, listC).setOrigin(1, 0.5);
      zT.setName('druckZustand');
      let schlossBreite = 0;
      if (gesperrt && this._symbolDa()) schlossBreite = 22;
      einpassen(zT, x + w - innen - kostenEnde - 12 - schlossBreite, 10);
      if (schlossBreite) this._symbol('schloss', zT.x - zT.width - 20, ky, 16, listC);

      // Trefferflaeche: ganze Karte (>= 44 px), Wahl erst beim Loslassen ohne Wisch.
      const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0xffffff, 0)
        .setInteractive({ useHandCursor: zustand === 'druckbar' });
      hit.setName('druckKarte');
      hit._uiOhne = true;
      hit.on('pointerover', () => this._fokussiere(index, false));
      hit.on('pointerup', (p) => {
        const L = this._druck;
        if (!L || this._gesperrt || L.dragMoved >= DRAG_SCHWELLE) return;
        if (p && typeof p.x === 'number' && !L.imViewport(p)) return;
        this._waehle(index);
      });
      listC.add(hit);

      const karte = { id: e.id, zustand, x, y, w, h, hit, sperrText: gesperrt ? zText : null,
        fokus: (an) => fokusG.setVisible(an || aktiv) };
      if (this._messing && !aktiv) {
        karte.fokus = (an) => {
          fokusG.setVisible(an);
          if (box.scene) box.setTexture(UR.feldBild(this, w, h, an, ton));
        };
      }
      return karte;
    }

    _fokussiere(i, sichtbar) {
      const L = this._druck;
      if (!L || !L.karten.length) return;
      i = Phaser.Math.Clamp(i, 0, L.karten.length - 1);
      L.fokus = i;
      L.karten.forEach((k, n) => k.fokus(n === i));
      if (sichtbar) {
        const k = L.karten[i];
        if (k.y < L.scroll) L.setScroll(k.y);
        else if (k.y + CARD_H > L.scroll + L.viewport.h) L.setScroll(k.y + CARD_H - L.viewport.h);
      }
    }

    /** Karte gewaehlt: druckbar -> drucken, sonst den Grund melden. */
    _waehle(i) {
      const k = this._druck && this._druck.karten[i];
      if (!k || this._gesperrt) return;
      if (k.zustand === 'druckbar') { this._publish(k.id); return; }
      const msg = {
        gesperrt: k.sperrText,
        papier: T('printingHouse.toast.no_paper'),
        blockiert: T('printingHouse.toast.already_active'),
        aktiv: T('printingHouse.toast.already_active')
      }[k.zustand];
      if (msg) this._toast(msg, '#ffd9a0');
    }

    _taste(ev) {
      const L = this._druck;
      if (!L || this._gesperrt || !ev) return;
      const f = L.fokus < 0 ? 0 : L.fokus;
      const schritt = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[ev.code];
      if (schritt) {
        if (ev.preventDefault) ev.preventDefault();
        this._fokussiere(L.fokus < 0 ? 0 : f + schritt, true);
        return;
      }
      if ((ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') && L.fokus >= 0) {
        if (ev.preventDefault) ev.preventDefault();
        this._waehle(L.fokus);
      }
    }

    // ---- Aktionsleiste ------------------------------------------------------
    _renderActionBar(left, top, w) {
      const ph = window.PrintingHouse;
      const suspicion = ph.getSuspicion();
      const paper = ph.getDruckblaetter();
      const gold = (window.LootSystem && typeof window.LootSystem.getGold === 'function')
        ? window.LootSystem.getGold() : 0;

      const btnH = 44;
      const cy = top + btnH / 2;
      const canBribe = suspicion > 0 && gold >= 100;
      const canTrade = paper < 50 && gold >= 50;
      const breiten = [230, 230, 170];
      const gap = 14;
      const gesamt = breiten.reduce((a, b) => a + b, 0) + gap * 2;
      let x = left + (w - gesamt) / 2;
      const mitte = breiten.map((b) => { const m = x + b / 2; x += b + gap; return m; });

      this._actionButton(mitte[0], cy, breiten[0], btnH, T('printingHouse.ui.btn.bribe'),
        [['gold', '-100'], ['verdacht', '-5']], canBribe, 'druckBestechen', () => {
          if (ph.bribe()) this._refresh();
        });
      this._actionButton(mitte[1], cy, breiten[1], btnH, T('printingHouse.ui.btn.tradegold'),
        [['gold', '-50'], ['papier', '+1']], canTrade, 'druckTauschen', () => {
          if (ph.tradeGoldForPaper()) this._refresh();
        });
      this._actionButton(mitte[2], cy, breiten[2], btnH, T('printingHouse.ui.btn.close'),
        [], true, 'druckSchliessen', () => this._close());
    }

    /** Knopf: Rechteck mit Rand (uiRahmen kleidet es in Messing), Wort + Kosten-Symbole. */
    _actionButton(cx, cy, w, h, label, kosten, enabled, name, onClick) {
      const bg = this.add.rectangle(cx, cy, w, h, enabled ? 0x2a2e3a : 0x1a1a1a)
        .setStrokeStyle(2, enabled ? 0xc9a25a : 0x444444)
        .setScrollFactor(0).setDepth(2002);
      bg.setName(name);
      if (!enabled) bg._uiAus = true;
      const teile = [];
      const farbe = enabled ? '#f2e9d8' : '#bfb5a0';
      teile.push(this._text(0, cy, label, { fontSize: '15px', color: farbe, fontStyle: 'bold' }).setOrigin(0, 0.5));
      kosten.forEach(([sym, wert]) => {
        const s = this._symbol(sym, 0, cy, 18);
        if (!enabled) s.setAlpha(0.55);
        s._luecke = 12;
        teile.push(s);
        teile.push(this._text(0, cy, wert, { fontSize: '13px', color: farbe }).setOrigin(0, 0.5));
      });
      const breite = (o) => (o.type === 'Image' ? o._breite : o.width);
      const gesamt = teile.reduce((a, o) => a + breite(o) + (o._luecke || 3), 0) - 3;
      let x = cx - gesamt / 2;
      teile.forEach((o, i) => {
        if (i > 0) x += o._luecke || 3;
        if (o.type === 'Image') o.x = x + o._breite / 2; else o.x = x;
        x += breite(o);
      });
      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => { if (!this._gesperrt) onClick(); });
      }
      return bg;
    }

    // ---- Aktionen -----------------------------------------------------------
    _publish(edictId) {
      const ph = window.PrintingHouse;
      const result = ph.publishEdict(edictId);
      if (result.success) {
        this._gesperrt = true;
        this._toast(T('printingHouse.toast.published', { name: T('printingHouse.edict.' + edictId + '.label') }));
        // #198: erst stampft die Presse, dann schliesst die Druckerei. Fehlt
        // ihr Bild (Laden gescheitert), schliesst druckSzene sofort.
        const P = window.Druckerpresse;
        if (P) P.druckSzene(this, () => this._close());
        else this._close();
      } else if (result.reasonKey === 'locked') {
        // Lokalisiert und mit derselben Aktnummer wie der Splashscreen.
        this._toast(T('printingHouse.toast.locked').replace('{req}', result.req), '#ffd9a0');
      } else {
        this._toast(result.reason || 'Publish fehlgeschlagen', '#ffd9a0');
        this._refresh();
      }
    }

    _refresh() {
      // Neu aufbauen, Lage der Liste und Fokus bleiben.
      const L = this._druck;
      this.scene.restart({ from: this.parentSceneKey, scroll: L ? L.scroll : 0, fokus: L ? L.fokus : -1 });
    }

    _toast(msg, farbe) {
      const cam = this.cameras.main;
      const txt = this.add.text(cam.width / 2, cam.height - 100, msg, {
        fontFamily: 'monospace', fontSize: '14px', color: farbe || '#88ff88',
        backgroundColor: '#0c0c11dd', padding: { x: 10, y: 6 }
      // Ueber der stampfenden Presse (#198, Tiefe 2400/2401), sonst laege die
      // Meldung "gedruckt" hinter ihrem dunklen Grund.
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2450);
      txt.setName('druckToast');
      this.tweens.add({
        targets: txt, alpha: 0, delay: 1500, duration: 400,
        onComplete: () => txt.destroy()
      });
    }

    _abmelden() {
      if (this._onWheel) this.input.off('wheel', this._onWheel);
      if (this._onDown) this.input.off('pointerdown', this._onDown);
      if (this._onMove) this.input.off('pointermove', this._onMove);
      if (this._onUp) this.input.off('pointerup', this._onUp);
      if (this._tasten) this.input.keyboard.off('keydown', this._tasten);
      this._onWheel = this._onDown = this._onMove = this._onUp = this._tasten = null;
      if (this._maskG) { try { this._maskG.destroy(); } catch (e) { /* schon weg */ } this._maskG = null; }
      this._druck = null;
    }

    _close() {
      this.input.keyboard.off('keydown-ESC');
      this.input.keyboard.off('keydown-E');
      if (this._unsubI18n) { this._unsubI18n(); this._unsubI18n = null; }
      this._abmelden();
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
