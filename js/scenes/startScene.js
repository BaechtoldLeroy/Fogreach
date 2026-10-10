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
    'start.slot.confirm_no': 'Abbrechen',
    'start.hint.rotate': 'Bitte das Gerät quer halten\n↻'
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
    'start.slot.confirm_no': 'Cancel',
    'start.hint.rotate': 'Please turn your device sideways\n↻'
  });
}
const _START_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

// #63: Übergabe über den Reload hinweg — "Neues Spiel" leert den Slot, lädt
// neu (damit jedes Modul frisch initialisiert) und startet dann automatisch.
// sessionStorage, nicht localStorage: der Marker gilt nur für diesen Tab und
// diesen einen Reload. Auf Modulebene, damit Setzer und Leser in create()
// dieselbe Konstante benutzen (sie liegen weit auseinander).
const _NEW_GAME_FLAG = 'demonfall.pendingNewGame';

// Einmaliges Flag: der Spieler war beim gewollten Reload (Neues Spiel /
// Slot-Wechsel) im Vollbild. Nach dem Reload wird es konsumiert und Vollbild
// bei der ersten Touch-Geste wiederhergestellt. Bewusst sessionStorage und NICHT
// in den Settings — kein Auto-Restore beim normalen Start, kein Focus-Regain-
// Hijack (genau der Bug, der die alte settings.fullscreen-Persistenz killte).
const _RESUME_FS_FLAG = 'demonfall.resumeFullscreen';

// #190: Endlos-Modus ist on hold. Seit #175 wurde der Talentbaum fuer die
// Geschichte umgebaut (Stufen, Strang-Staffel); der Endlos-Modus lernt
// Faehigkeiten ueber eigene Aufwertungen und ist darauf nicht abgestimmt. Der
// Knopf im Startmenue entsteht nur, wenn dieser Schalter an ist — der Code
// dahinter bleibt. Wieder aufmachen: ENDLOS_AKTIV = true.
const ENDLOS_AKTIV = false;

// ---- Startmenue-Kulisse ---------------------------------------------------
// Alle Bilder in assets/start sind Pixelgrafik in halber Aufloesung
// (Hintergrund 480x240) und werden einheitlich verdoppelt, damit die Pixel
// ueberall gleich gross sind.
const _START_PX = 2;
// Leuchtende Fenster im Hintergrundbild (Basis-Pixel), aus dem Bild vermessen.
const _START_FENSTER = [
  [100, 124], [41, 127], [460, 131], [397, 141], [460, 138], [371, 142], [77, 148],
  [237, 149], [121, 150], [368, 162], [376, 163], [468, 164], [397, 165], [116, 170],
  [109, 171], [468, 171], [308, 177], [357, 177], [262, 181], [270, 182], [128, 186],
  [358, 186], [302, 191], [28, 198], [274, 200], [230, 206], [211, 207]
];
const _START_RATSFENSTER = [172, 78];   // das rote Fenster im Turm des Kettenrats
const _START_MOND = [222, 57];
// Wo die Laterne steht: Mitte der Zinne rechts vom Archivschmied, auf ihrer
// Oberkante (Pixel im Bruestungsbild 480x72, das unten buendig liegt).
const _START_LATERNE = [144.5, 40];
// Die Laterne sitzt auf einem kurzen Eisenstab, damit ihr spitzer Fuss nicht
// auf der Zinne zu schweben scheint: so viele Bildpixel hoch.
const _START_STAB = 8;

// Ein Knopf aus Messingplatte (Spritesheet: 0 normal, 1 hover, 2 gedrueckt)
// und Beschriftung. Die Aktion haengt der Aufrufer selbst an platte
// ('pointerdown'), wie vorher an den Text-Knoepfen.
function _messingKnopf(scene, x, y, sheet, label, stil, opts) {
  opts = opts || {};
  const ruhe = opts.ruhe || 0;
  const tiefe = opts.tiefe || 1001;
  const farbe = stil.fill;
  const platte = scene.add.sprite(x, y, sheet, ruhe).setScale(_START_PX).setDepth(tiefe)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, Object.assign({
    shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true }
  }, stil)).setOrigin(0.5).setDepth(tiefe + 1);
  const knopf = { platte, text };
  const setze = (bild, dy, f) => { platte.setFrame(bild); text.y = y + dy; text.setColor(f); };
  platte.on('pointerover', () => setze(1, 0, opts.hover || farbe));
  platte.on('pointerout', () => setze(ruhe, 0, farbe));
  platte.on('pointerdown', () => setze(2, 2, opts.hover || farbe));
  platte.on('pointerup', () => setze(1, 0, opts.hover || farbe));
  knopf.zerstoeren = () => { platte.destroy(); text.destroy(); };
  return knopf;
}

// Handy hochkant? Dann ist das Querformat-Spiel zu klein zum Bedienen.
function _istHandyHochkant(scene) {
  const touch = !!(scene.sys.game.device && scene.sys.game.device.input && scene.sys.game.device.input.touch);
  return touch && (window.innerHeight || 0) > (window.innerWidth || 0);
}

// Baut die animierte Kulisse: Stadt, Mondschein, flackernde Fenster, Nebel in
// drei Ebenen, Bruestung, Archivschmied im Wind, Laterne und aufsteigende Glut.
function _baueKulisse(scene) {
  const S = _START_PX;
  const cw = scene.cameras.main.width, ch = scene.cameras.main.height;
  const ADD = Phaser.BlendModes.ADD;
  const k = {};

  scene.add.image(0, 0, 'start_hintergrund').setOrigin(0).setScale(S).setDepth(0);

  k.mond = scene.add.image(_START_MOND[0] * S, _START_MOND[1] * S, 'start_schein')
    .setScale(5).setTint(0xb8c8ff).setAlpha(0.2).setBlendMode(ADD).setDepth(1);
  scene.tweens.add({ targets: k.mond, alpha: 0.34, scale: 5.4, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Fensterlicht: jedes Fenster bekommt einen warmen Schein; ein Taktgeber
  // laesst laufend zufaellige Fenster auf- und abglimmen.
  k.fenster = _START_FENSTER.map(([x, y]) => scene.add.image(x * S, y * S, 'start_schein')
    .setScale(0.3 + Math.random() * 0.12).setAlpha(0.3 + Math.random() * 0.4)
    .setBlendMode(ADD).setDepth(2));
  k.flackern = scene.time.addEvent({
    delay: 110, loop: true, callback: () => {
      const g = k.fenster[Math.floor(Math.random() * k.fenster.length)];
      scene.tweens.add({ targets: g, alpha: 0.15 + Math.random() * 0.6, duration: 200 + Math.random() * 700 });
    }
  });

  // Das rote Fenster des Kettenrats pulsiert langsam und bedrohlich.
  k.ratsfenster = scene.add.image(_START_RATSFENSTER[0] * S, _START_RATSFENSTER[1] * S, 'start_schein')
    .setScale(0.7).setTint(0xff2a1a).setAlpha(0.35).setBlendMode(ADD).setDepth(2);
  scene.tweens.add({ targets: k.ratsfenster, alpha: 0.95, scale: 0.9, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Ein kleiner Kraehenschwarm zieht regelmaessig ueber den Himmel. Halber
  // Pixelmassstab, weil weit weg.
  if (!scene.anims.exists('start_kraehe_flug')) {
    scene.anims.create({
      key: 'start_kraehe_flug', frames: scene.anims.generateFrameNumbers('start_kraehe', { start: 0, end: 7 }),
      frameRate: 12, repeat: -1
    });
  }
  k.kraehen = [0, 1, 2].map((i) => scene.add.sprite(-80, 0, 'start_kraehe', 0).setDepth(2)
    .play({ key: 'start_kraehe_flug', startFrame: i * 3 }));
  const kraehenFlug = () => {
    const y0 = 50 + Math.random() * 80;
    k.kraehen.forEach((c, i) => {
      c.setPosition(-40 - i * 38 - Math.random() * 20, y0 + i * 14 + Math.random() * 10);
      scene.tweens.add({ targets: c, x: cw + 60, duration: 9000 + i * 700 });
      scene.tweens.add({ targets: c, y: c.y - 16, duration: 1300 + i * 200, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    });
  };
  kraehenFlug();
  k.kraehenTakt = scene.time.addEvent({ delay: 17000, loop: true, callback: kraehenFlug });

  // Nebel: drei kachelbare Baender, je weiter vorn, desto schneller.
  const nebel = (key, y, h, alpha, tiefe, tempo, versatz) => {
    const ts = scene.add.tileSprite(0, y, cw / S, h, key).setOrigin(0).setScale(S)
      .setAlpha(alpha).setDepth(tiefe);
    ts.tilePositionX = versatz || 0;
    return { ts, tempo };
  };
  k.nebel = [
    nebel('start_nebel_b', 196, 60, 0.6, 3, 2.5, 0),
    nebel('start_nebel_a', 270, 90, 0.75, 4, 5, 120),
    nebel('start_nebel_a', 372, 90, 0.8, 7, 11, 300)
  ];

  scene.add.image(0, ch, 'start_bruestung').setOrigin(0, 1).setScale(S).setDepth(5);

  // Der Archivschmied auf der Bruestung, Mantel und Kapuze im Wind
  // (PixelLab-Animation, hin und zurueck abgespielt).
  if (!scene.anims.exists('start_held_wind')) {
    scene.anims.create({
      key: 'start_held_wind', frames: scene.anims.generateFrameNumbers('start_held', { start: 0, end: 8 }),
      frameRate: 7, yoyo: true, repeat: -1, repeatDelay: 500
    });
  }
  k.held = scene.add.sprite(214, 470, 'start_held', 0).setOrigin(0.5, 75 / 92).setScale(S).setDepth(6);
  k.held.play('start_held_wind');
  k.augen = scene.add.image(214 - 7, 470 - 100, 'start_schein')
    .setScale(0.32, 0.18).setTint(0xffb040).setAlpha(0.5).setBlendMode(ADD).setDepth(6);
  scene.tweens.add({ targets: k.augen, alpha: 0.95, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Die Laterne des Archivschmieds, rechts neben ihm auf der Zinne. Sie steht
  // STILL (ein Bild, ruhiger Schein): flackernd zog sie zu viel Aufmerksamkeit
  // vom Menue ab. Bis b352 hing sie an einem
  // Wandhalter neben dem Wasserspeier — der Halter griff aber in die Luft,
  // und fuer eine Wandlaterne ist unter der Bruestung kein Platz mehr. Darum
  // traegt das Bild nur noch Ring und Laterne; ihr Fuss (Bildzeile 55 von 64)
  // sitzt auf dem Teller eines kurzen Stabs, der auf der Zinne steht.
  const lx = _START_LATERNE[0] * S, zinne = ch - (72 - _START_LATERNE[1]) * S;
  // Der Stab: Fussplatte auf der Zinne, zwei Pixel Eisen (Licht links, Schatten
  // rechts), oben ein Teller, auf dem die Laternenspitze sitzt.
  const ly = zinne - _START_STAB * S;
  const px = (x) => Math.round(lx + x * S);
  k.laternenStab = scene.add.graphics().setDepth(5.9);
  k.laternenStab.fillStyle(0x1b1816, 1).fillRect(px(-2.5), zinne - S, 5 * S, S);
  k.laternenStab.fillStyle(0x6b5f55, 1).fillRect(px(-1), ly, S, zinne - ly - S);
  k.laternenStab.fillStyle(0x2c2724, 1).fillRect(px(0), ly, S, zinne - ly - S);
  k.laternenStab.fillStyle(0x3a332e, 1).fillRect(px(-2.5), ly, 5 * S, S);
  // Fuer die Pruefung: wo der Stab steht und wo er endet.
  k.laternenStab.setData({ x: lx, oben: ly, unten: zinne });
  k.laterne = scene.add.sprite(lx, ly, 'start_laterne', 0).setOrigin(19.5 / 32, 55 / 64).setScale(S).setDepth(6);
  // Der Schein sitzt auf dem Glas, 13 Bildpixel ueber dem Fuss.
  k.laternenSchein = scene.add.image(lx, ly - 13 * S, 'start_schein')
    .setScale(2.2).setAlpha(0.55).setBlendMode(ADD).setDepth(6);

  // Glut steigt aus der Stadt auf — die Funken der Rebellion.
  k.funken = scene.add.particles(0, 0, 'start_funke', {
    x: { min: 0, max: cw }, y: ch + 4,
    lifespan: { min: 5000, max: 9000 },
    speedY: { min: -46, max: -16 }, speedX: { min: -10, max: 16 },
    scale: { start: S, end: 1 }, alpha: { start: 1, end: 0 },
    tint: [0xffb347, 0xff7a2a, 0xffd27a, 0xff5a1a],
    blendMode: 'ADD', frequency: 140, quantity: 1
  }).setDepth(8);
  if (typeof k.funken.fastForward === 'function') k.funken.fastForward(6000, 50);

  scene.add.image(0, 0, 'start_vignette').setOrigin(0).setScale(S).setDepth(9);

  // Nebel ziehen lassen (eigener update-Hoerer, beim Verlassen wieder weg)
  const ziehen = (zeit, dt) => {
    k.nebel.forEach((n) => { n.ts.tilePositionX += n.tempo * dt / 1000; });
  };
  scene.events.on('update', ziehen);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off('update', ziehen));
  return k;
}

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
        'boss_chain_', 'boss_ceremony_', 'boss_shadow_', 'boss_elara_',
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

  // Gegner-Sprites (~70 Bilder) werden NICHT mehr hier beim Boot geladen: sie
  // kommen nur im Dungeon vor. Stattdessen laedt HubSceneV2 sie im Hintergrund
  // (queueEnemySprites -> load.start), und GameScene.preload holt Fehlende als
  // Sicherheitsnetz nach (Endlos-Modus/verpasster Hintergrund-Load). Siehe
  // js/enemyAssets.js. Das verkuerzt den Startvorgang spuerbar (v.a. Mobile).

  // UI/environment sprites
  this.load.image('stairDown', 'assets/tiles/stairDown.png');

  // Startmenue-Kulisse (PixelLab-Pixelgrafik, siehe _baueKulisse)
  ['hintergrund', 'bruestung', 'vignette', 'nebel_a', 'nebel_b', 'schein', 'funke'].forEach((n) => {
    this.load.image('start_' + n, 'assets/start/start_' + n + '.png');
  });
  [['held', 92, 92], ['laterne', 32, 64], ['titel', 199, 40], ['kraehe', 32, 32],
    ['knopf', 130, 26], ['slot', 172, 18], ['klein', 22, 18]].forEach(([n, w, h]) => {
    this.load.spritesheet('start_' + n, 'assets/start/start_' + n + '.png', { frameWidth: w, frameHeight: h });
  });

  // Enemy projectile sprites — distinct per enemy archetype
  this.load.image('proj_arrow',    'assets/projectiles/proj_arrow.png');
  this.load.image('proj_arcane',   'assets/projectiles/proj_arcane.png');
  this.load.image('proj_fireball', 'assets/projectiles/proj_fireball.png');
  // #173: die Flugbilder von Feuerball und Arkangeschoss (je acht, Loop).
  for (let i = 0; i < 8; i++) {
    this.load.image('proj_fireball' + i, 'assets/projectiles/proj_fireball' + i + '.png');
    this.load.image('proj_arcane' + i, 'assets/projectiles/proj_arcane' + i + '.png');
  }
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
    "CouncilWarehouse", "SealedArchive", "InformantDen",
    // #161: Die Quelle, Finalarena auf Tiefe 30 (nur als Boss-Arena),
    // und Elaras Versteck (nur, wenn ein Besuch faellig ist)
    "DieQuelle", "ElarasVersteck"
  ];
  for (const name of templateNames) {
    this.load.json(name, `js/roomTemplates/${name}.json?v=074`);
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

  // Vollbild nach einem gewollten Reload (Neues Spiel / Slot-Wechsel) wieder
  // herstellen. Die Fullscreen-API ueberlebt keinen Reload und laesst sich nur
  // aus einer echten User-Geste heraus neu anfordern — also auf die erste
  // Touch-Geste warten und startFullscreen() aufrufen. Der Listener haengt am
  // window (nicht an this.input), weil die Szene nach "Neues Spiel" sofort in den
  // Hub wechselt und ein szenen-lokaler Listener beim Shutdown wegfiele; der
  // erste Touch im Hub (typ. [Weiter] am Intro-Splash) soll es ausloesen. Das
  // Flag wird SOFORT konsumiert (kein Nachwirken bei spaeteren Starts); der
  // Listener selbst bleibt bis zum bestaetigten Erfolg scharf (siehe unten).
  // MUSS vor den Autostart-/New-Game-Early-Returns stehen, damit es ueberall armt.
  (function _armFullscreenResume(scene) {
    let want = null;
    try { want = window.sessionStorage.getItem(_RESUME_FS_FLAG); } catch (e) { return; }
    if (want == null) return;
    try { window.sessionStorage.removeItem(_RESUME_FS_FLAG); } catch (e) {}

    // RETRY-BIS-BESTAETIGT statt one-shot. Grund: nach "Neues Spiel" laeuft der
    // Reload SYNCHRON im Start-Tap-Handler — der Finger kann beim Reload noch
    // unten sein. Dann feuert auf der neuen Seite ein touchend/pointerup OHNE
    // User-Aktivierung, startFullscreen() schlaegt fehl. Wuerden wir den Listener
    // dabei entfernen, waere die Chance verbrannt. Also: auf JEDE Geste
    // startFullscreen() versuchen und NUR aufraeumen, wenn Vollbild wirklich
    // aktiv wurde (kurz danach isFullscreen pruefen). Sicherheitsnetz nach N
    // Versuchen, damit auf Geraeten ohne Element-Vollbild (iOS) nicht ewig
    // gelauscht wird.
    const EVENTS = ['pointerdown', 'pointerup', 'touchend'];
    let settled = false, attempts = 0;
    const cleanup = () => {
      settled = true;
      EVENTS.forEach((ev) => { try { window.removeEventListener(ev, onGesture, true); } catch (e) {} });
    };
    const onGesture = () => {
      if (settled) return;
      const g = window.game || (scene && scene.game);
      const sc = g && g.scale;
      if (!sc) return;                       // Spiel noch nicht bereit -> naechste Geste
      if (sc.isFullscreen) { cleanup(); return; }
      attempts++;
      try { sc.startFullscreen(); } catch (e) { /* still ignorieren */ }
      // Erfolg nicht annehmen: erst nach kurzem Moment pruefen und dann erst
      // aufraeumen. So bleibt der Listener nach einem Fehlversuch scharf.
      setTimeout(() => {
        try { if (!settled && g && g.scale && g.scale.isFullscreen) cleanup(); } catch (e) {}
      }, 60);
      if (attempts >= 10) cleanup();
    };
    EVENTS.forEach((ev) => {
      try { window.addEventListener(ev, onGesture, { capture: true }); }
      catch (e) { try { window.addEventListener(ev, onGesture, true); } catch (_) {} }
    });
  })(this);

  // #63: "Neues Spiel" hat den Slot geleert und die Seite neu geladen, damit
  // jedes Modul frisch aus dem leeren Slot initialisiert. Hier die Gegenseite:
  // das Flag konsumieren und direkt starten, statt das Menü nochmal zu zeigen.
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
    const selfNG = this;
    setTimeout(() => loadRoomTemplatesAndStart.call(selfNG), 100);
    return;
  }

  // Debug-Direkteinstieg ins Dungeon: ?dungeon=1 (oder ?dungeon=N). Wie autostart
  // ein frisches Spiel, aber HubSceneV2 descendet danach automatisch weiter in den
  // Dungeon — ueber DENSELBEN _enterLocation-Pfad wie der echte Klick, damit
  // Dungeon-Bugs treu reproduziert werden (man sieht die Konsole auf Mobile nicht).
  // MUSS vor dem Autostart-Block stehen (der sonst greifen wuerde, wenn beide
  // Parameter zusammenkommen — hier nicht der Fall, aber Reihenfolge ist eindeutig).
  // #88: nur im Debug-Modus. Der Einstieg loescht den Spielstand (clearSave
  // gleich unten) — das darf kein Spieler versehentlich ueber einen geteilten
  // Link ausloesen.
  const _dungeonParam = window.DebugGate ? window.DebugGate.flagge('dungeon') : null;
  if (_dungeonParam) {
    window.__DEBUG_AUTO_DESCEND__ = Math.max(1, parseInt(_dungeonParam, 10) || 1);
    if (window.clearSave) clearSave();
    if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') window.AbilitySystem.resetForNewGame();
    if (window.KnowledgeTree && typeof window.KnowledgeTree.resetForNewGame === 'function') window.KnowledgeTree.resetForNewGame();
    if (typeof window.pendingLoadedSave !== 'undefined') window.pendingLoadedSave = null;
    const selfD = this;
    setTimeout(() => loadRoomTemplatesAndStart.call(selfD), 100);
    return;
  }

  // Auto-start support: ?autostart=1 in URL OR debug.autostart in settings.
  // Treated as a fresh new game — wipe persistent state so test runs are deterministic.
  // #88: Autostart LOESCHT den Spielstand (clearSave gleich unten). Beide
  // Quellen — URL-Flagge und gespeicherter Schalter — haengen deshalb am
  // Debug-Modus. Der gespeicherte Schalter ist der gefaehrlichere Fall: er
  // ueberlebt das Ausblenden der Sektion.
  const settingsAutostart = (() => {
    try {
      if (!(window.DebugGate && window.DebugGate.aktiv())) return false;
      const s = window.loadGameSettings && window.loadGameSettings();
      return !!(s && s.debug && s.debug.autostart);
    } catch (e) { return false; }
  })();
  const urlAutostart = !!(window.DebugGate && window.DebugGate.an('autostart'));
  if (urlAutostart || settingsAutostart) {
    if (window.clearSave) clearSave();
    if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
      window.AbilitySystem.resetForNewGame();
    }
    if (window.KnowledgeTree && typeof window.KnowledgeTree.resetForNewGame === 'function') {
      window.KnowledgeTree.resetForNewGame();
    }
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

  const cw = this.cameras.main.width;
  const ch = this.cameras.main.height;
  const cx = cw / 2;

  // Kulisse: Fogreach im Nebel, Archivschmied und Glut animiert, die Laterne steht still.
  this.kulisse = _baueKulisse(this);

  // Menuespalte rechts neben dem Ratsturm. Auf Handys mit Notch rechts um den
  // Safe-Area-Rand einruecken (CSS-px -> Spiel-px ueber displayScale).
  let _safeRechts = 0;
  try {
    const sa = window.__SAFE_AREA__ || {};
    const ds = (this.scale && this.scale.displayScale) ? this.scale.displayScale.x : 1;
    _safeRechts = Math.max(0, (sa.right || 0) * ds - 10);
  } catch (e) { /* ohne Safe-Area einfach nicht einruecken */ }
  const mx = Math.round(cw * 0.765 - _safeRechts);
  this.menuKnoepfe = {};

  // Titel-Schriftzug in Messing (Pixelschrift aus PixelLab) mit wanderndem Glanz.
  if (!this.anims.exists('start_titel_glanz')) {
    this.anims.create({
      key: 'start_titel_glanz',
      frames: this.anims.generateFrameNumbers('start_titel', { start: 1, end: 11 })
        .concat([{ key: 'start_titel', frame: 0 }]),
      frameRate: 20, repeat: -1, repeatDelay: 3800
    });
  }
  const titelSchein = this.add.image(mx, 62, 'start_schein')
    .setScale(7, 1.6).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(1000);
  this.tweens.add({ targets: titelSchein, alpha: 0.34, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  this.titel = this.add.sprite(mx, 62, 'start_titel', 0).setScale(_START_PX).setDepth(1002);
  this.titel.play('start_titel_glanz');
  this.tweens.add({ targets: [this.titel, titelSchein], y: 60, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Untertitel
  const subtitleText = this.add
    .text(mx, 114, _START_T('start.subtitle'), {
      fontFamily: 'serif', fontSize: '17px', fill: '#cdb78c', fontStyle: 'italic',
      stroke: '#0d0a12', strokeThickness: 4
    })
    .setOrigin(0.5).setDepth(1002);
  _trackI18n(subtitleText, 'start.subtitle');

  // Versionsnummer unten rechts — zum Pruefen, ob ein Release live ist.
  this.add.text(this.cameras.main.width - 8 - _safeRechts, this.cameras.main.height - 6,
    'v ' + (window.GAME_VERSION || '?'), {
      fontFamily: 'monospace', fontSize: '11px', fill: '#8a8296'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(9999);

  // Hochformat auf dem Handy: das Spiel ist ein Querformat-Spiel (960x480,
  // FIT) und wird hochkant winzig. Statt eines unlesbaren Menues einen
  // grossen Hinweis zeigen, das Geraet zu drehen. Er verschwindet von selbst,
  // sobald gedreht wird (resize).
  const drehHinweis = this.add.text(cx, ch * 0.5, _START_T('start.hint.rotate'), {
    fontFamily: 'serif', fontSize: '44px', fill: '#ffe2a0', fontStyle: 'bold',
    stroke: '#0d0a12', strokeThickness: 8, align: 'center'
  }).setOrigin(0.5).setDepth(3000);
  _trackI18n(drehHinweis, 'start.hint.rotate');
  const drehSchleier = this.add.rectangle(cx, ch / 2, cw, ch, 0x07060c, 0.72).setDepth(2999)
    .setInteractive();
  // Wer die Drehsperre an hat, kann den Hinweis wegtippen (gilt bis zum Reload).
  let _drehWeg = false;
  drehSchleier.on('pointerdown', () => { _drehWeg = true; _pruefeHochformat(); });
  const _pruefeHochformat = () => {
    const hoch = !_drehWeg && _istHandyHochkant(this);
    drehHinweis.setVisible(hoch);
    drehSchleier.setVisible(hoch);   // unsichtbar trifft ihn kein Tap (Phaser-Hit-Test)
  };
  this.drehHinweis = drehHinweis;
  this.drehSchleier = drehSchleier;
  _pruefeHochformat();
  // Der ScaleManager meldet auch das Drehen des Geraets als 'resize' (refresh).
  this.scale.on('resize', _pruefeHochformat);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', _pruefeHochformat));

  // ---- #63 Speicherslots -------------------------------------------------
  // Die Slot-Zeilen WAEHLEN nur aus; FORTSETZEN/NEUES SPIEL darunter behalten
  // ihre Bedeutung und wirken auf den gewählten Slot. Das ist bewusst der
  // kleinere Eingriff gegenüber "Klick auf Slot startet direkt" — der Boot-
  // Pfad (pendingLoadedSave, Reset-Aufrufe, Endlos) bleibt unverändert.
  const _slots = window.SaveSlots || null;
  let activeSlot = _slots ? _slots.getActiveSlot() : 1;

  // Slot-Wechsel MUSS die Seite neu laden — scene.restart() reicht nicht.
  //
  // Die Satelliten-Module (KnowledgeTree, FactionSystem, SkillTree, Druckerei,
  // Tutorial) laden ihren Zustand EINMAL beim Modul-Init und halten ihn dann im
  // Speicher; init() hat eine Latch ("if (state.initialized) return"). Ein
  // scene.restart() baut nur die Szene neu — die Module behalten den Zustand des
  // ALTEN Slots und schreiben ihn beim nächsten _persist() in den NEUEN.
  // Ein Reload initialisiert jedes Modul frisch aus dem aktiven Slot.
  //
  // Bewusst ein Reload statt "jedes Modul bekommt reloadFromStorage() und wird
  // hier aufgerufen": FactionSystem und PrintingHouse haben gar keine Reset-API,
  // und die Liste müsste bei jedem neuen Modul gepflegt werden — genau die
  // Drift, vor der #63 warnt. Der Reload weiss nichts über Module und kann
  // darum nichts vergessen.
  // Szene fuer _reloadForSlotChange festhalten (wird bare aufgerufen, hat also
  // kein eigenes `this`). Braucht's fuer die prefix-agnostische Vollbild-Abfrage.
  const _fsSceneRef = this;
  function _reloadForSlotChange() {
    // Vollbild ueberlebt keinen Page-Reload (Fullscreen-API ist ans Dokument
    // gebunden). War der Spieler im Vollbild, ein einmaliges Flag setzen, das
    // die create() nach dem Reload konsumiert und Vollbild bei der ersten
    // Touch-Geste wiederherstellt.
    // WICHTIG: primaer Phasers scale.isFullscreen pruefen — document.fullscreen-
    // Element ist auf mobilen Browsern mit prefixed API (webkit) oft null, das
    // war der Grund, warum der Fix zuerst nicht griff. document.*-Varianten nur
    // als Fallback.
    try {
      const _sc = _fsSceneRef && _fsSceneRef.scale;
      const _inFs = !!(
        (_sc && _sc.isFullscreen) ||
        document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement
      );
      if (_inFs) window.sessionStorage.setItem(_RESUME_FS_FLAG, '1');
    } catch (e) { /* sessionStorage evtl. blockiert */ }
    try { window.location.reload(); }
    catch (e) { try { this.scene.restart(); } catch (_) {} }
  }

  if (_slots) {
    // Vertikal ist es eng: bei der kleinsten Kamerahöhe (480) sitzt der
    // Untertitel absolut bei 136px und EINSTELLUNGEN ganz unten bei ~452.
    // Dazwischen müssen 3 Slot-Zeilen + bis zu 4 Buttons passen. Die Werte
    // sind an camH=480 ausgemessen (Überlappung mit dem Untertitel darüber
    // und FORTSETZEN darunter) — beim Ändern nachmessen.
    // Neu (Startmenue-Kulisse): feste Zeilen in der Menuespalte rechts, je
    // eine Messingleiste (344 px) plus ✕-Knopf (44 px) daneben.
    const rowY = [158, 198, 238];
    const zeileX = mx - 26, loeschX = mx + 176;
    _slots.listSlots().forEach((meta, i) => {
      const isActive = meta.slot === activeSlot;
      let info;
      if (!meta.exists) info = _START_T('start.slot.empty');
      else if (meta.level === 0 && meta.depth === 1 && meta.gold === 0) {
        // getSlotMeta meldet exists=true auch bei unlesbarem Save — dann sind
        // alle Felder auf Default. Als "beschädigt" zeigen statt "Lv 0", damit
        // klar ist, dass da etwas ist, das nicht gelesen werden konnte.
        info = _START_T('start.slot.broken');
      } else {
        info = _START_T('start.slot.info', {
          level: meta.level, depth: meta.depth, gold: meta.gold
        });
      }
      const label = (isActive ? '▸ ' : '  ') + _START_T('start.slot.label', { n: meta.slot })
        + '   ' + info;

      // Der aktive Slot leuchtet dauerhaft (Bild 1), die anderen nur beim Hover.
      const row = _messingKnopf(this, zeileX, rowY[i], 'start_slot', label, {
        fontFamily: 'monospace', fontSize: '14px',
        fill: isActive ? '#ffd166' : '#a8997c'
      }, { ruhe: isActive ? 1 : 0, hover: isActive ? '#ffd166' : '#fff1cc' });
      row.text.setX(zeileX - 156).setOrigin(0, 0.5);
      this.menuKnoepfe['slot' + meta.slot] = row;

      row.platte.on('pointerdown', () => {
        if (isActive) return;
        _slots.setActiveSlot(meta.slot);
        _reloadForSlotChange();
      });

      // Löschen nur für belegte Slots.
      if (meta.exists) {
        const del = _messingKnopf(this, loeschX, rowY[i], 'start_klein', '✕', {
          fontFamily: 'monospace', fontSize: '16px', fill: '#ff7b6b', fontStyle: 'bold'
        }, { hover: '#ffb0a6' });
        this.menuKnoepfe['loeschen' + meta.slot] = del;
        del.platte.on('pointerdown', () => _confirmDeleteSlot.call(this, meta.slot));
      }
    });
  }

  // Löschen ist unumkehrbar -> Rückfrage. Ohne sie kostet ein Fehlklick neben
  // der Slot-Zeile einen ganzen Spielstand.
  function _confirmDeleteSlot(slot) {
    const scene = this;
    const veil = scene.add.rectangle(cx, ch / 2, cw, ch, 0x000000, 0.75)
      .setDepth(2000).setInteractive();
    const q = scene.add.text(cx, ch * 0.42, _START_T('start.slot.confirm_delete', { n: slot }), {
      fontFamily: 'serif', fontSize: '26px', fill: '#ffe0d6', fontStyle: 'bold',
      stroke: '#0d0a12', strokeThickness: 5
    }).setOrigin(0.5).setDepth(2001);
    const knopfText = { fontFamily: 'serif', fontSize: '20px', fontStyle: 'bold', stroke: '#1a0f06', strokeThickness: 4 };
    const yes = _messingKnopf(scene, cx - 140, ch * 0.57, 'start_knopf', _START_T('start.slot.confirm_yes'),
      Object.assign({ fill: '#ff9a88' }, knopfText), { tiefe: 2001, hover: '#ffc4b8' });
    const no = _messingKnopf(scene, cx + 140, ch * 0.57, 'start_knopf', _START_T('start.slot.confirm_no'),
      Object.assign({ fill: '#f3e2b3' }, knopfText), { tiefe: 2001 });
    scene.menuKnoepfe.loeschenJa = yes;
    scene.menuKnoepfe.loeschenNein = no;

    const close = () => {
      veil.destroy(); q.destroy(); yes.zerstoeren(); no.zerstoeren();
      delete scene.menuKnoepfe.loeschenJa; delete scene.menuKnoepfe.loeschenNein;
    };
    no.platte.on('pointerdown', close);
    yes.platte.on('pointerdown', () => {
      // deleteSlot statt clearSave: es müssen ALLE Keys des Slots weg
      // (Skillbaum, Fraktionen, Druckerei, ...). clearSave räumt nur den
      // Hauptsave — der Rest wäre sonst Altlast im nächsten Spiel dort.
      if (window.SaveSlots) window.SaveSlots.deleteSlot(slot);
      close();
      // Reload aus demselben Grund wie beim Slot-Wechsel: die Module halten den
      // gelöschten Stand sonst weiter im Speicher und schreiben ihn zurück.
      _reloadForSlotChange();
    });
  }

  const hasExistingSave = window.hasSave && hasSave();

  // Die grossen Knoepfe stehen unter den Slot-Zeilen (bis y=256), im Raster
  // von 56 px (Knopf 52 px hoch, touch-tauglich).
  let knopfY = hasExistingSave ? 296 : 300;
  const naechsteY = () => { const y = knopfY; knopfY += 56; return y; };
  const knopfStil = (farbe, groesse) => ({
    fontFamily: 'serif', fontSize: groesse || '24px', fill: farbe, fontStyle: 'bold',
    stroke: '#1a0f06', strokeThickness: 4
  });

  // Fortsetzen zuerst, wenn Save vorhanden ist. Bezieht sich auf den oben
  // gewählten Slot — hasSave() liest über SlotStorage bereits den aktiven.
  if (hasExistingSave) {
    const cont = _messingKnopf(this, mx, naechsteY(), 'start_knopf', _START_T('start.btn.continue'),
      knopfStil('#ffe08a', '26px'), { hover: '#fff2c0' });
    this.menuKnoepfe.fortsetzen = cont;

    cont.platte.on("pointerdown", async () => {
      try {
        const save = window.loadGame.length ? await loadGame() : loadGame();
        window.pendingLoadedSave = save || null;
        loadRoomTemplatesAndStart.call(this);
      } catch (e) {
        console.error("[StartScene] loadGame failed:", e);
      }
    });
    _trackI18n(cont.text, 'start.btn.continue');

    // Der frühere "Spielstand löschen"-Button ist entfallen: jede Slot-Zeile
    // hat jetzt ihr eigenes ✕. Zwei Lösch-Wege nebeneinander wären
    // mehrdeutig ("welcher Stand?") — und der alte räumte ohnehin nur den
    // Hauptsave, nicht Skillbaum/Fraktionen.
    //
  }

  // START GAME
  const startKey = hasExistingSave ? 'start.btn.new_game' : 'start.btn.start_game';
  const neu = _messingKnopf(this, mx, naechsteY(), 'start_knopf', _START_T(startKey),
    knopfStil('#b8e6a0', hasExistingSave ? '24px' : '26px'), { hover: '#e2ffd2' });
  this.menuKnoepfe.neuesSpiel = neu;
  _trackI18n(neu.text, startKey);

  neu.platte
    .on("pointerdown", () => {
      // #63: den gewählten Slot komplett leeren. clearSave() allein räumte nur
      // den Hauptsave + Tutorial — Skillbaum, Fraktionen und Druckerei
      // überlebten ein "Neues Spiel" und wanderten in den neuen Durchgang.
      if (window.SaveSlots) window.SaveSlots.deleteSlot(activeSlot);
      if (window.clearSave) clearSave();

      // Danach neu laden, statt direkt zu starten: die Module hälten den
      // gelöschten Stand sonst weiter im Speicher (init() ist gelatcht) und
      // schrieben ihn beim nächsten _persist() zurück — der Wipe wäre
      // wirkungslos. Der Kommentar an den beiden resetForNewGame-Aufrufen unten
      // kannte das Problem schon, löste es aber nur für AbilitySystem und
      // KnowledgeTree; FactionSystem/PrintingHouse/SkillTree/Tutorial blieben
      // stehen. Der Reload deckt alle ab, auch künftige.
      // Das Flag überlebt den Reload und startet danach automatisch.
      try { window.sessionStorage.setItem(_NEW_GAME_FLAG, String(activeSlot)); } catch (e) {}

      // Falls sessionStorage fehlt (Privatmodus o. ae.): ohne Flag käme man
      // nach dem Reload nur ins Menü zurück — dann lieber wie bisher direkt
      // starten und die In-Memory-Resets machen, was sie können.
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
      loadRoomTemplatesAndStart.call(this);
    });

  // ENDLOS-MODUS button (roguelike: no hub, descend forever, pick 1-of-3
  // upgrades after each cleared room). #190: on hold — nur bei ENDLOS_AKTIV.
  if (ENDLOS_AKTIV) {
    const endless = _messingKnopf(this, mx, naechsteY(), 'start_knopf', _START_T('endless.btn.start'),
      knopfStil('#ff9a7a', '22px'), { hover: '#ffc0a8' });
    this.menuKnoepfe.endlos = endless;
    _trackI18n(endless.text, 'endless.btn.start');
    endless.platte
      .on('pointerdown', () => {
        if (window.clearSave) clearSave();
        if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
          window.AbilitySystem.resetForNewGame();
        }
        if (typeof window.pendingLoadedSave !== 'undefined') {
          window.pendingLoadedSave = null;
        }
        // Activate endless run BEFORE GameScene boots so initUI sees the flag
        if (window.Endless && typeof window.Endless.start === 'function') {
          window.Endless.start();
        }
        loadRoomTemplatesAndStart.call(this);
      });
  }

  // EINSTELLUNGEN button below the start button
  const settings = _messingKnopf(this, mx, naechsteY(), 'start_knopf', _START_T('start.btn.settings'),
    knopfStil('#d8cbb0', '20px'), { hover: '#ffffff' });
  this.menuKnoepfe.einstellungen = settings;
  _trackI18n(settings.text, 'start.btn.settings');
  settings.platte.on("pointerdown", () => {
    if (typeof window.openSettingsScene === 'function') window.openSettingsScene(this);
  });

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

  // -------------- Loader-Logik für RoomTemplates ----------------

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
      "CouncilWarehouse", "SealedArchive", "InformantDen",
      // #161: Finalarena (BOSS_ARENAS) und Elaras Versteck (versteckBesuchFaellig)
      "DieQuelle", "ElarasVersteck"
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
