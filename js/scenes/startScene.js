// startScene.js

if (window.i18n) {
  window.i18n.register('de', {
    'start.subtitle': 'Ein Dungeon-Crawler',
    'start.btn.continue': 'FORTSETZEN',
    'start.btn.delete_save': 'Spielstand löschen',
    'start.btn.new_game': 'NEUES SPIEL',
    'start.btn.start_game': 'SPIEL STARTEN',
    'start.btn.settings': 'EINSTELLUNGEN',
    'start.highscores': '🏆 Highscores',
    'start.highscores.error': 'Fehler beim Laden der Highscores',
    'start.slot.label': 'SLOT {n}',
    'start.slot.empty': 'leer',
    'start.slot.info': 'Lv {level} · Tiefe {depth} · {gold} G',
    'start.slot.broken': 'beschädigt',
    'start.slot.confirm_delete': 'Slot {n} wirklich löschen?',
    'start.slot.confirm_yes': 'Ja, löschen',
    'start.slot.confirm_no': 'Abbrechen'
  });
  window.i18n.register('en', {

    'start.subtitle': 'A dungeon crawler',
    'start.btn.continue': 'CONTINUE',
    'start.btn.delete_save': 'Delete save',
    'start.btn.new_game': 'NEW GAME',
    'start.btn.start_game': 'START GAME',
    'start.btn.settings': 'SETTINGS',
    'start.highscores': '🏆 Highscores',
    'start.highscores.error': 'Failed to load highscores',
    'start.slot.label': 'SLOT {n}',
    'start.slot.empty': 'empty',
    'start.slot.info': 'Lv {level} · Depth {depth} · {gold} G',
    'start.slot.broken': 'corrupted',
    'start.slot.confirm_delete': 'Really delete slot {n}?',
    'start.slot.confirm_yes': 'Yes, delete',
    'start.slot.confirm_no': 'Cancel'
  });
}
const _START_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

// #63: Uebergabe ueber den Reload hinweg — "Neues Spiel" leert den Slot, laedt
// neu (damit jedes Modul frisch initialisiert) und startet dann automatisch.
// sessionStorage, nicht localStorage: der Marker gilt nur fuer diesen Tab und
// diesen einen Reload. Auf Modulebene, damit Setzer und Leser in create()
// dieselbe Konstante benutzen (sie liegen weit auseinander).
const _NEW_GAME_FLAG = 'demonfall.pendingNewGame';

// 1) Scene-Konstruktor
function StartScene() {
  Phaser.Scene.call(this, { key: "StartScene" });
}
StartScene.prototype = Object.create(Phaser.Scene.prototype);
StartScene.prototype.constructor = StartScene;

// 2) preload / create / update der Menu-Scene
StartScene.prototype.preload = function () {
  const width = this.cameras.main.width;
  const height = this.cameras.main.height;

  // Load-time instrumentation: how long does the initial preload take?
  const preloadStart = performance.now();
  this.load.once('complete', () => {
    const elapsed = (performance.now() - preloadStart).toFixed(0);
    console.log(`[StartScene] preload complete in ${elapsed}ms`);
  });

  // Dark background for loading screen
  const bg = this.add.graphics();
  bg.fillStyle(0x1a1a1a, 1);
  bg.fillRect(0, 0, width, height);

  if (window.i18n) {
    window.i18n.register('de', {
      'start.loading': 'Laden...',
      'start.loading_file': 'Lade: {file}'
    });
    window.i18n.register('en', {
      'start.loading': 'Loading...',
      'start.loading_file': 'Loading: {file}'
    });
  }
  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  // Progress bar container (outline)
  const progressBox = this.add.graphics();
  progressBox.lineStyle(2, 0x666666, 1);
  progressBox.strokeRect(width / 2 - 200, height / 2 - 10, 400, 20);

  // Progress bar fill
  const progressBar = this.add.graphics();

  // "Laden..." text above the bar
  const loadingText = this.make.text({
    x: width / 2,
    y: height / 2 - 30,
    text: T('start.loading'),
    style: {
      font: '20px monospace',
      fill: '#ccaa33'
    }
  });
  loadingText.setOrigin(0.5, 0.5);

  // Percentage text below the bar
  const percentText = this.make.text({
    x: width / 2,
    y: height / 2 + 25,
    text: '0%',
    style: {
      font: '16px monospace',
      fill: '#ffffff'
    }
  });
  percentText.setOrigin(0.5, 0.5);

  // Currently-loading file name
  const fileText = this.make.text({
    x: width / 2,
    y: height / 2 + 50,
    text: '',
    style: {
      font: '12px monospace',
      fill: '#888888'
    }
  });
  fileText.setOrigin(0.5, 0.5);

  this.load.on('progress', function (value) {
    percentText.setText(parseInt(value * 100) + '%');
    progressBar.clear();
    progressBar.fillStyle(0xccaa33, 1);
    progressBar.fillRect(width / 2 - 198, height / 2 - 8, 396 * value, 16);
  });

  this.load.on('fileprogress', function (file) {
    fileText.setText(T('start.loading_file', { file: file.key }));
  });

  this.load.on('complete', function () {
    bg.destroy();
    progressBar.destroy();
    progressBox.destroy();
    loadingText.destroy();
    percentText.destroy();
    fileText.destroy();
    // 052 WP03: apply LINEAR filter to all painterly assets that the
    // preload just put into the TextureManager. Procedural textures from
    // graphics.js / proceduralRooms.js stay NEAREST (they aren't loaded
    // here — they're runtime-generated via createCanvas/generateTexture).
    if (window.RenderQuality) {
      window.RenderQuality.applyLinearFilterByPrefix(this, [
        'brute_', 'imp_', 'shadow_', 'flameweaver_', 'chainguard_',
        'archer_', 'mage_', 'rat_', 'bat_', 'wolf_',
        'sprite_imp', 'sprite_archer', 'sprite_mage', 'sprite_shadow',
        'sprite_chainguard', 'sprite_flameweaver',
        'boss_chain_', 'boss_ceremony_', 'boss_shadow_',
        'sprite_boss_',
        'proj_',
        'dir'
      ]);
      window.RenderQuality.applyLinearFilter(this, ['stairDown']);
    }
  });

  // Only preload initial direction (dir00) at startup - other directions lazy-loaded
  if (typeof preloadPlayerDirectionalFrames === 'function') {
    preloadPlayerDirectionalFrames(this.load);
  }

  // NPC sprites for the hub are now lazy-loaded inside HubSceneV2.preload()
  // — keeps the StartScene menu reachable in fewer HTTP round-trips.

  // Brute enemy sprites
  this.load.image('brute_left0', 'assets/enemy/brute/left0.png');
  this.load.image('brute_left1', 'assets/enemy/brute/left1.png');
  this.load.image('brute_left2', 'assets/enemy/brute/left2.png');
  this.load.image('brute_right0', 'assets/enemy/brute/right0.png');
  this.load.image('brute_right1', 'assets/enemy/brute/right1.png');
  this.load.image('brute_right2', 'assets/enemy/brute/right2.png');

  // Imp enemy sprites
  this.load.image('imp_left0', 'assets/enemy/imp/left0.png');
  this.load.image('imp_left1', 'assets/enemy/imp/left1.png');
  this.load.image('imp_left2', 'assets/enemy/imp/left2.png');
  this.load.image('imp_right0', 'assets/enemy/imp/right0.png');
  this.load.image('imp_right1', 'assets/enemy/imp/right1.png');
  this.load.image('imp_right2', 'assets/enemy/imp/right2.png');

  // Shadow Creeper enemy sprites
  this.load.image('shadow_left0', 'assets/enemy/shadow/left0.png');
  this.load.image('shadow_left1', 'assets/enemy/shadow/left1.png');
  this.load.image('shadow_left2', 'assets/enemy/shadow/left2.png');
  this.load.image('shadow_right0', 'assets/enemy/shadow/right0.png');
  this.load.image('shadow_right1', 'assets/enemy/shadow/right1.png');
  this.load.image('shadow_right2', 'assets/enemy/shadow/right2.png');

  // Flame Weaver enemy sprites
  this.load.image('flameweaver_left0', 'assets/enemy/flameweaver/left0.png');
  this.load.image('flameweaver_left1', 'assets/enemy/flameweaver/left1.png');
  this.load.image('flameweaver_left2', 'assets/enemy/flameweaver/left2.png');
  this.load.image('flameweaver_right0', 'assets/enemy/flameweaver/right0.png');
  this.load.image('flameweaver_right1', 'assets/enemy/flameweaver/right1.png');
  this.load.image('flameweaver_right2', 'assets/enemy/flameweaver/right2.png');

  // Chain Guard enemy sprites
  this.load.image('chainguard_left0', 'assets/enemy/chainguard/left0.png');
  this.load.image('chainguard_left1', 'assets/enemy/chainguard/left1.png');
  this.load.image('chainguard_left2', 'assets/enemy/chainguard/left2.png');
  this.load.image('chainguard_right0', 'assets/enemy/chainguard/right0.png');
  this.load.image('chainguard_right1', 'assets/enemy/chainguard/right1.png');
  this.load.image('chainguard_right2', 'assets/enemy/chainguard/right2.png');

  // Archer enemy sprites
  this.load.image('archer_left0', 'assets/enemy/archer/left0.png');
  this.load.image('archer_left1', 'assets/enemy/archer/left1.png');
  this.load.image('archer_left2', 'assets/enemy/archer/left2.png');
  this.load.image('archer_right0', 'assets/enemy/archer/right0.png');
  this.load.image('archer_right1', 'assets/enemy/archer/right1.png');
  this.load.image('archer_right2', 'assets/enemy/archer/right2.png');

  // Mage enemy sprites
  this.load.image('mage_left0', 'assets/enemy/mage/left0.png');
  this.load.image('mage_left1', 'assets/enemy/mage/left1.png');
  this.load.image('mage_left2', 'assets/enemy/mage/left2.png');
  this.load.image('mage_right0', 'assets/enemy/mage/right0.png');
  this.load.image('mage_right1', 'assets/enemy/mage/right1.png');
  this.load.image('mage_right2', 'assets/enemy/mage/right2.png');

  // Rat directional frames
  this.load.image('rat_left0', 'assets/enemy/rat/left0.png');
  this.load.image('rat_left1', 'assets/enemy/rat/left1.png');
  this.load.image('rat_left2', 'assets/enemy/rat/left2.png');
  this.load.image('rat_right0', 'assets/enemy/rat/right0.png');
  this.load.image('rat_right1', 'assets/enemy/rat/right1.png');
  this.load.image('rat_right2', 'assets/enemy/rat/right2.png');

  // Bat directional frames
  this.load.image('bat_left0', 'assets/enemy/bat/left0.png');
  this.load.image('bat_left1', 'assets/enemy/bat/left1.png');
  this.load.image('bat_left2', 'assets/enemy/bat/left2.png');
  this.load.image('bat_right0', 'assets/enemy/bat/right0.png');
  this.load.image('bat_right1', 'assets/enemy/bat/right1.png');
  this.load.image('bat_right2', 'assets/enemy/bat/right2.png');

  // Wolf directional frames
  this.load.image('wolf_left0', 'assets/enemy/wolf/left0.png');
  this.load.image('wolf_left1', 'assets/enemy/wolf/left1.png');
  this.load.image('wolf_left2', 'assets/enemy/wolf/left2.png');
  this.load.image('wolf_right0', 'assets/enemy/wolf/right0.png');
  this.load.image('wolf_right1', 'assets/enemy/wolf/right1.png');
  this.load.image('wolf_right2', 'assets/enemy/wolf/right2.png');

  // Enemy sprites (pixel art)
  this.load.image('sprite_imp', 'assets/enemy/imp/imp.png');
  this.load.image('sprite_archer', 'assets/enemy/archer/archer.png');
  this.load.image('sprite_mage', 'assets/enemy/mage/mage.png');
  this.load.image('sprite_shadow', 'assets/enemy/shadow/shadow.png');
  this.load.image('sprite_chainguard', 'assets/enemy/chainguard/chainguard.png');
  this.load.image('sprite_flameweaver', 'assets/enemy/flameweaver/flameweaver.png');
  // Boss sprites (animated)
  ['boss_chain', 'boss_ceremony', 'boss_shadow'].forEach(boss => {
    ['left0','left1','left2','right0','right1','right2'].forEach(frame => {
      this.load.image(boss + '_' + frame, 'assets/enemy/' + boss + '/' + frame + '.png');
    });
  });
  // Fallbacks
  this.load.image('sprite_boss_chain', 'assets/enemy/boss_chain/idle.png');
  this.load.image('sprite_boss_ceremony', 'assets/enemy/boss_ceremony/idle.png');
  this.load.image('sprite_boss_shadow', 'assets/enemy/boss_shadow/idle.png');

  // UI/environment sprites
  this.load.image('stairDown', 'assets/tiles/stairDown.png');

  // Enemy projectile sprites — distinct per enemy archetype
  this.load.image('proj_arrow',    'assets/projectiles/proj_arrow.png');
  this.load.image('proj_arcane',   'assets/projectiles/proj_arcane.png');
  this.load.image('proj_fireball', 'assets/projectiles/proj_fireball.png');
  this.load.image('proj_default',  'assets/projectiles/proj_default.png');

  // Hub NPCs (Aldric, Elara, Harren) are also lazy-loaded inside HubSceneV2.preload()

  const templateNames = [
    "Arena", "ArmoryVault", "BridgeOverGap", "Cathedral", "CelestialGardens", "Checkerboard",
    "CirclePillars", "CollapsingHall", "Crosshall", "CrossroadChamber", "Crossroads",
    "Crypt_Small_Altar", "DungeonLibrary", "GrandBazaar", "MazeLite", "PrisonCells",
    "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault",
    "RathausArchive", "RitualVault", "PrisonDepths", "CouncilChamber", "ForgottenCrypt",
    // Feature 049: new procedural layouts
    "CorridorLong", "CorridorBranch", "PillarHall", "AsymmetricChamber", "TerracedHall", "DoubleAlcove",
    // Feature 055: curated espionage stealth rooms
    "CouncilWarehouse", "SealedArchive", "InformantDen"
  ];
  for (const name of templateNames) {
    this.load.json(name, `js/roomTemplates/${name}.json?v=070`);
  }
};

StartScene.prototype.create = function () {
  // Track translatable text nodes so an i18n.onChange subscriber can re-render
  // them when the user flips the language in SettingsScene.
  const _i18nRefs = [];
  const _trackI18n = (obj, key, params) => {
    if (obj && key) _i18nRefs.push({ obj, key, params: params || null });
    return obj;
  };

  if (typeof normalizePlayerDirectionalFrames === 'function') {
    normalizePlayerDirectionalFrames(this);
    // 052 WP03: normalization swaps textures via addCanvas, wiping any
    // LINEAR filter the preload-complete handler applied. Re-apply now,
    // POST-normalization, so player frames bilinear-interpolate.
    if (window.RenderQuality) {
      window.RenderQuality.applyLinearFilterByPrefix(this, ['dir']);
    }
  }

  // Apply persisted settings on game boot (volume, debug flags, etc.)
  if (typeof window.applyGameSettings === 'function' && typeof window.loadGameSettings === 'function') {
    try { window.applyGameSettings(window.loadGameSettings()); } catch (e) { /* ignore */ }
  }

  // #63: "Neues Spiel" hat den Slot geleert und die Seite neu geladen, damit
  // jedes Modul frisch aus dem leeren Slot initialisiert. Hier die Gegenseite:
  // das Flag konsumieren und direkt starten, statt das Menue nochmal zu zeigen.
  // Der Wipe ist bereits passiert — hier wird nur noch gestartet.
  const _pendingNewGame = (() => {
    try {
      const v = window.sessionStorage.getItem(_NEW_GAME_FLAG);
      if (v !== null) window.sessionStorage.removeItem(_NEW_GAME_FLAG);
      return v;
    } catch (e) { return null; }
  })();
  if (_pendingNewGame !== null) {
    if (typeof window.pendingLoadedSave !== 'undefined') window.pendingLoadedSave = null;
    window.__DEV_FORCE_CHEAT__ = true;
    const selfNG = this;
    setTimeout(() => loadRoomTemplatesAndStart.call(selfNG), 100);
    return;
  }

  // Auto-start support: ?autostart=1 in URL OR debug.autostart in settings.
  // Treated as a fresh new game — wipe persistent state so test runs are deterministic.
  const settingsAutostart = (() => {
    try {
      const s = window.loadGameSettings && window.loadGameSettings();
      return !!(s && s.debug && s.debug.autostart);
    } catch (e) { return false; }
  })();
  if (typeof window !== 'undefined' && window.location && (window.location.search.includes('autostart=1') || settingsAutostart)) {
    if (window.clearSave) clearSave();
    if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
      window.AbilitySystem.resetForNewGame();
    }
    if (window.KnowledgeTree && typeof window.KnowledgeTree.resetForNewGame === 'function') {
      window.KnowledgeTree.resetForNewGame();
    }
    window.__DEV_FORCE_CHEAT__ = true;
    if (typeof window.pendingLoadedSave !== 'undefined') window.pendingLoadedSave = null;
    const self = this;
    setTimeout(() => loadRoomTemplatesAndStart.call(self), 100);
    return;
  }

  // Vollbild bei erstem Touch
  this.input.addPointer(1);
  /*this.input.on('pointerdown', () => {
    if (!this.scale.isFullscreen) this.scale.startFullscreen();
  });*/

  // Titel
  const cw = this.cameras.main.width;
  const ch = this.cameras.main.height;
  const cx = cw / 2;

  this.add
    .text(cx, ch * 0.18, "Demonfall", {
      fontFamily: 'serif', fontSize: "48px", fill: "#ffd166", fontStyle: 'bold'
    })
    .setOrigin(0.5);

  // Subtitle
  const subtitleText = this.add
    .text(cx, ch * 0.18 + 50, _START_T('start.subtitle'), {
      fontFamily: 'serif', fontSize: "16px", fill: "#888888"
    })
    .setOrigin(0.5);
  _trackI18n(subtitleText, 'start.subtitle');

  // ---- #63 Speicherslots -------------------------------------------------
  // Die Slot-Zeilen WAEHLEN nur aus; FORTSETZEN/NEUES SPIEL darunter behalten
  // ihre Bedeutung und wirken auf den gewaehlten Slot. Das ist bewusst der
  // kleinere Eingriff gegenueber "Klick auf Slot startet direkt" — der Boot-
  // Pfad (pendingLoadedSave, Reset-Aufrufe, Endlos) bleibt unveraendert.
  const _slots = window.SaveSlots || null;
  let activeSlot = _slots ? _slots.getActiveSlot() : 1;

  // Slot-Wechsel MUSS die Seite neu laden — scene.restart() reicht nicht.
  //
  // Die Satelliten-Module (KnowledgeTree, FactionSystem, SkillTree, Druckerei,
  // Tutorial) laden ihren Zustand EINMAL beim Modul-Init und halten ihn dann im
  // Speicher; init() hat eine Latch ("if (state.initialized) return"). Ein
  // scene.restart() baut nur die Szene neu — die Module behalten den Zustand des
  // ALTEN Slots und schreiben ihn beim naechsten _persist() in den NEUEN.
  // Ein Reload initialisiert jedes Modul frisch aus dem aktiven Slot.
  //
  // Bewusst ein Reload statt "jedes Modul bekommt reloadFromStorage() und wird
  // hier aufgerufen": FactionSystem und PrintingHouse haben gar keine Reset-API,
  // und die Liste muesste bei jedem neuen Modul gepflegt werden — genau die
  // Drift, vor der #63 warnt. Der Reload weiss nichts ueber Module und kann
  // darum nichts vergessen.
  function _reloadForSlotChange() {
    try { window.location.reload(); }
    catch (e) { try { this.scene.restart(); } catch (_) {} }
  }

  if (_slots) {
    // Vertikal ist es eng: bei der kleinsten Kamerahoehe (480) sitzt der
    // Untertitel absolut bei 136px und EINSTELLUNGEN ganz unten bei ~452.
    // Dazwischen muessen 3 Slot-Zeilen + bis zu 4 Buttons passen. Die Werte
    // sind an camH=480 ausgemessen (Ueberlappung mit dem Untertitel darueber
    // und FORTSETZEN darunter) — beim Aendern nachmessen.
    const rowY = [ch * 0.335, ch * 0.395, ch * 0.455];
    _slots.listSlots().forEach((meta, i) => {
      const isActive = meta.slot === activeSlot;
      let info;
      if (!meta.exists) info = _START_T('start.slot.empty');
      else if (meta.level === 0 && meta.depth === 1 && meta.gold === 0) {
        // getSlotMeta meldet exists=true auch bei unlesbarem Save — dann sind
        // alle Felder auf Default. Als "beschaedigt" zeigen statt "Lv 0", damit
        // klar ist, dass da etwas ist, das nicht gelesen werden konnte.
        info = _START_T('start.slot.broken');
      } else {
        info = _START_T('start.slot.info', {
          level: meta.level, depth: meta.depth, gold: meta.gold
        });
      }
      const label = (isActive ? '▸ ' : '  ') + _START_T('start.slot.label', { n: meta.slot })
        + '   ' + info;

      const row = this.add
        .text(cx, rowY[i], label, {
          fontFamily: 'monospace', fontSize: '15px',
          fill: isActive ? '#ffd166' : '#8a8a8a',
          backgroundColor: isActive ? '#241d10' : '#141414',
          padding: { x: 12, y: 5 },
          fixedWidth: 0
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(1001);

      row.on('pointerover', () => { if (!isActive) row.setStyle({ fill: '#cccccc' }); });
      row.on('pointerout', () => { if (!isActive) row.setStyle({ fill: '#8a8a8a' }); });
      row.on('pointerdown', () => {
        if (isActive) return;
        _slots.setActiveSlot(meta.slot);
        _reloadForSlotChange();
      });

      // Loeschen nur fuer belegte Slots.
      if (meta.exists) {
        const del = this.add
          .text(cx + row.width / 2 + 18, rowY[i], '✕', {
            fontFamily: 'monospace', fontSize: '15px',
            fill: '#ff6666', backgroundColor: '#141414',
            padding: { x: 7, y: 5 }
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .setDepth(1001);
        del.on('pointerover', () => del.setStyle({ fill: '#ff9999' }));
        del.on('pointerout', () => del.setStyle({ fill: '#ff6666' }));
        del.on('pointerdown', () => _confirmDeleteSlot.call(this, meta.slot));
      }
    });
  }

  // Loeschen ist unumkehrbar -> Rueckfrage. Ohne sie kostet ein Fehlklick neben
  // der Slot-Zeile einen ganzen Spielstand.
  function _confirmDeleteSlot(slot) {
    const scene = this;
    const veil = scene.add.rectangle(cx, ch / 2, cw, ch, 0x000000, 0.75)
      .setDepth(2000).setInteractive();
    const q = scene.add.text(cx, ch * 0.45, _START_T('start.slot.confirm_delete', { n: slot }), {
      fontFamily: 'serif', fontSize: '22px', fill: '#ffdddd'
    }).setOrigin(0.5).setDepth(2001);
    const yes = scene.add.text(cx - 90, ch * 0.55, _START_T('start.slot.confirm_yes'), {
      fontFamily: 'monospace', fontSize: '16px', fill: '#ff8888',
      backgroundColor: '#2a1414', padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setDepth(2001).setInteractive({ useHandCursor: true });
    const no = scene.add.text(cx + 90, ch * 0.55, _START_T('start.slot.confirm_no'), {
      fontFamily: 'monospace', fontSize: '16px', fill: '#cccccc',
      backgroundColor: '#1a1a1a', padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setDepth(2001).setInteractive({ useHandCursor: true });

    const close = () => { veil.destroy(); q.destroy(); yes.destroy(); no.destroy(); };
    no.on('pointerdown', close);
    yes.on('pointerdown', () => {
      // deleteSlot statt clearSave: es muessen ALLE Keys des Slots weg
      // (Skillbaum, Fraktionen, Druckerei, ...). clearSave raeumt nur den
      // Hauptsave — der Rest waere sonst Altlast im naechsten Spiel dort.
      if (window.SaveSlots) window.SaveSlots.deleteSlot(slot);
      close();
      // Reload aus demselben Grund wie beim Slot-Wechsel: die Module halten den
      // geloeschten Stand sonst weiter im Speicher und schreiben ihn zurueck.
      _reloadForSlotChange();
    });
  }

  const hasExistingSave = window.hasSave && hasSave();

  // Startpunkt der Buttons liegt unter den Slot-Zeilen (bis ch*0.44).
  let startY = hasExistingSave ? ch * 0.65 : ch * 0.55;

  let btn;

  // Fortsetzen zuerst, wenn Save vorhanden ist. Bezieht sich auf den oben
  // gewaehlten Slot — hasSave() liest ueber SlotStorage bereits den aktiven.
  if (hasExistingSave) {
    const contBtn = this.add
      .text(cx, ch * 0.55, _START_T('start.btn.continue'), {
        fontFamily: 'serif', fontSize: "32px",
        fill: "#ffea6a",
        backgroundColor: "#111",
        padding: { x: 16, y: 8 },
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);

    contBtn.on("pointerdown", async () => {
      try {
        const save = window.loadGame.length ? await loadGame() : loadGame();
        window.pendingLoadedSave = save || null;
        window.__DEV_FORCE_CHEAT__ = false;
        loadRoomTemplatesAndStart.call(this);
      } catch (e) {
        console.error("[StartScene] loadGame failed:", e);
      }
    });

    contBtn.on('pointerover', () => contBtn.setStyle({ fill: '#fff27c' }));
    contBtn.on('pointerout', () => contBtn.setStyle({ fill: '#ffea6a' }));
    _trackI18n(contBtn, 'start.btn.continue');

    // Der fruehere "Spielstand löschen"-Button ist entfallen: jede Slot-Zeile
    // hat jetzt ihr eigenes ✕. Zwei Loesch-Wege nebeneinander waeren
    // mehrdeutig ("welcher Stand?") — und der alte raeumte ohnehin nur den
    // Hauptsave, nicht Skillbaum/Fraktionen.
    //
    // startY wird NICHT mehr hier gesetzt: der Ternaer bei der Deklaration ist
    // die einzige Quelle. Vorher stand hier eine zweite Zuweisung, die den
    // Ternaer ueberschrieb — der war dadurch toter Code (im Original ebenso).
  }

  // START GAME
  const startKey = hasExistingSave ? 'start.btn.new_game' : 'start.btn.start_game';
  btn = this.add
    .text(cx, startY, _START_T(startKey), {
      fontFamily: 'serif', fontSize: hasExistingSave ? "24px" : "28px",
      fill: hasExistingSave ? "#88ff88" : "#88ff88",
      backgroundColor: "#1a1a1a",
      padding: { x: 14, y: 6 },
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);
  _trackI18n(btn, startKey);

  btn
    .on("pointerdown", () => {
      // #63: den gewaehlten Slot komplett leeren. clearSave() allein raeumte nur
      // den Hauptsave + Tutorial — Skillbaum, Fraktionen und Druckerei
      // ueberlebten ein "Neues Spiel" und wanderten in den neuen Durchgang.
      if (window.SaveSlots) window.SaveSlots.deleteSlot(activeSlot);
      if (window.clearSave) clearSave();

      // Danach neu laden, statt direkt zu starten: die Module haelten den
      // geloeschten Stand sonst weiter im Speicher (init() ist gelatcht) und
      // schrieben ihn beim naechsten _persist() zurueck — der Wipe waere
      // wirkungslos. Der Kommentar an den beiden resetForNewGame-Aufrufen unten
      // kannte das Problem schon, loeste es aber nur fuer AbilitySystem und
      // KnowledgeTree; FactionSystem/PrintingHouse/SkillTree/Tutorial blieben
      // stehen. Der Reload deckt alle ab, auch kuenftige.
      // Das Flag ueberlebt den Reload und startet danach automatisch.
      try { window.sessionStorage.setItem(_NEW_GAME_FLAG, String(activeSlot)); } catch (e) {}

      // Falls sessionStorage fehlt (Privatmodus o. ae.): ohne Flag kaeme man
      // nach dem Reload nur ins Menue zurueck — dann lieber wie bisher direkt
      // starten und die In-Memory-Resets machen, was sie koennen.
      let flagOk = false;
      try { flagOk = window.sessionStorage.getItem(_NEW_GAME_FLAG) !== null; } catch (e) {}
      if (flagOk) { _reloadForSlotChange(); return; }

      if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
        window.AbilitySystem.resetForNewGame();
      }
      if (window.KnowledgeTree && typeof window.KnowledgeTree.resetForNewGame === 'function') {
        window.KnowledgeTree.resetForNewGame();
      }
      if (typeof window.pendingLoadedSave !== "undefined") {
        window.pendingLoadedSave = null;
      }
      window.__DEV_FORCE_CHEAT__ = true;
      loadRoomTemplatesAndStart.call(this);
    })
    .on("pointerover", () => btn.setStyle({ fill: '#b0ffb0' }))
    .on("pointerout", () => btn.setStyle({ fill: '#88ff88' }));

  // ENDLOS-MODUS button (roguelike: no hub, descend forever, pick 1-of-3
  // upgrades after each cleared room)
  const endlessBtn = this.add
    .text(cx, startY + 92, _START_T('endless.btn.start'), {
      fontFamily: 'serif', fontSize: '20px',
      fill: '#ff8866',
      backgroundColor: '#1a1a1a',
      padding: { x: 12, y: 5 },
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);
  _trackI18n(endlessBtn, 'endless.btn.start');
  endlessBtn
    .on('pointerdown', () => {
      if (window.clearSave) clearSave();
      if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
        window.AbilitySystem.resetForNewGame();
      }
      if (typeof window.pendingLoadedSave !== 'undefined') {
        window.pendingLoadedSave = null;
      }
      window.__DEV_FORCE_CHEAT__ = false;
      // Activate endless run BEFORE GameScene boots so initUI sees the flag
      if (window.Endless && typeof window.Endless.start === 'function') {
        window.Endless.start();
      }
      loadRoomTemplatesAndStart.call(this);
    })
    .on('pointerover', () => endlessBtn.setStyle({ fill: '#ffaa88' }))
    .on('pointerout',  () => endlessBtn.setStyle({ fill: '#ff8866' }));

  // EINSTELLUNGEN button below the start button
  const settingsBtn = this.add
    .text(cx, startY + 140, _START_T('start.btn.settings'), {
      fontFamily: 'monospace', fontSize: "16px",
      fill: "#aaaaaa",
      backgroundColor: "#1a1a1a",
      padding: { x: 10, y: 4 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);
  _trackI18n(settingsBtn, 'start.btn.settings');
  settingsBtn.on("pointerdown", () => {
    if (typeof window.openSettingsScene === 'function') window.openSettingsScene(this);
  });
  settingsBtn.on("pointerover", () => settingsBtn.setStyle({ fill: '#ffffff' }));
  settingsBtn.on("pointerout", () => settingsBtn.setStyle({ fill: '#aaaaaa' }));

  // Optional: Highscores
  if (window.loadScores) {
    const highscoresHeader = this.add
      .text(400, 460, _START_T('start.highscores'), {
        fontSize: "22px",
        fill: "#ffff00",
      })
      .setOrigin(0.5)
      .setDepth(1001);
    _trackI18n(highscoresHeader, 'start.highscores');

    window
      .loadScores()
      .then((list) => {
        (list || []).slice(0, 10).forEach((entry, i) => {
          this.add
            .text(
              400,
              490 + i * 22,
              `${i + 1}. ${entry.name}: ${entry.score}`,
              { fontSize: "16px", fill: "#ffffff" },
            )
            .setOrigin(0.5, 0)
            .setDepth(1001);
        });
      })
      .catch((err) => {
        const errText = this.add
          .text(400, 490, _START_T('start.highscores.error'), {
            fontSize: "16px",
            fill: "#ff0000",
          })
          .setOrigin(0.5)
          .setDepth(1001);
        _trackI18n(errText, 'start.highscores.error');
      });
  }

  // Re-render tracked labels when the user flips language in SettingsScene.
  let _unsubI18n = null;
  if (window.i18n && typeof window.i18n.onChange === 'function') {
    _unsubI18n = window.i18n.onChange(() => {
      _i18nRefs.forEach((ref) => {
        if (ref.obj && ref.obj.active && typeof ref.obj.setText === 'function') {
          ref.obj.setText(_START_T(ref.key, ref.params));
        }
      });
    });
  }
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (typeof _unsubI18n === 'function') { try { _unsubI18n(); } catch (e) {} }
  });

  // -------------- Loader-Logik fuer RoomTemplates ----------------

  function loadRoomTemplatesAndStart() {
    window.RoomTemplates = window.RoomTemplates || {};
    const RT = window.RoomTemplates;
    RT.TEMPLATES = RT.TEMPLATES || {};
    
    const allTemplateNames = [
      "Arena", "ArmoryVault", "BridgeOverGap", "Cathedral", "CelestialGardens", "Checkerboard",
      "CirclePillars", "CollapsingHall", "Crosshall", "CrossroadChamber", "Crossroads",
      "Crypt_Small_Altar", "DungeonLibrary", "GrandBazaar", "MazeLite", "PrisonCells",
      "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault",
      // Story rooms (gated by act / story system, but must be registered in
      // RT.TEMPLATES so the room picker can use them)
      "RathausArchive", "RitualVault", "PrisonDepths", "CouncilChamber", "ForgottenCrypt",
      // Feature 049: new procedural layouts
      "CorridorLong", "CorridorBranch", "PillarHall", "AsymmetricChamber", "TerracedHall", "DoubleAlcove",
      // Feature 055: curated espionage stealth rooms (registered in RT.TEMPLATES
      // so EspionageSystem can build them by name; not part of the random pool)
      "CouncilWarehouse", "SealedArchive", "InformantDen"
    ];

    for (const name of allTemplateNames) {
      const tpl = this.cache.json.get(name);
      if (tpl) {
        RT.TEMPLATES[name] = tpl;
      }
    }

    // Don't overwrite RT.MANIFEST — it's set in roomTemplates.js
    window.game = this.game;
    // Tutorial auto-skip (feature 044): runs once per session entry into the
    // game proper. With an existing save, marks the tutorial skipped so no
    // overlay frame ever renders. Without a save, seeds fresh tutorial state
    // at the first visible step. Idempotent across all entry buttons
    // (Continue, New Game, Endless).
    if (window.TutorialSystem && typeof window.TutorialSystem.maybeAutoSkip === 'function') {
      window.TutorialSystem.maybeAutoSkip();
    }
    // Endless mode skips the hub and boots straight into the dungeon.
    const target = (window.__ENDLESS_MODE__ ? 'GameScene' : 'HubSceneV2');
    this.scene.start(target);
  }
};

// 3) Hier ganz unten, außerhalb aller Methoden:
window.StartScene = StartScene;
