function createObstacleGraphics() {
  const g = this.add.graphics();

  // Grundflaeche: neutral grauer Stein 32x32
  g.fillStyle(0x5a5a5a, 1);
  g.fillRect(0, 0, 32, 32);

  // leichte Marmorierung: weiche Flecken
  g.fillStyle(0x6a6a6a, 0.35);
  g.fillCircle(10, 10, 6);
  g.fillCircle(22, 8, 5);
  g.fillCircle(20, 20, 7);
  g.fillCircle(8, 22, 5);

  // dunklere Inseln fuer Tiefe
  g.fillStyle(0x4a4a4a, 0.25);
  g.fillCircle(14, 14, 4);
  g.fillCircle(24, 18, 3);
  g.fillCircle(12, 24, 3);

  // feine Sprenkel, fest definierte Punkte fuer Wiederholbarkeit
  g.fillStyle(0x7a7a7a, 0.6);
  [ [5,6],[7,17],[12,9],[15,23],[20,12],[23,27],[26,16],[28,7] ].forEach(([x,y])=>{
    g.fillRect(x, y, 1, 1);
  });

  // sehr feine Haarrisse, dezent
  g.lineStyle(1, 0x3c3c3c, 0.5);
  g.beginPath();
  g.moveTo(6, 12); g.lineTo(10, 16); g.lineTo(8, 20); g.strokePath();
  g.beginPath();
  g.moveTo(22, 6); g.lineTo(24, 10); g.lineTo(20, 14); g.strokePath();

  // ganz leichte Kantenbetonung innen, nicht an den Rand zeichnen damit nahtlos bleibt
  g.lineStyle(1, 0x6e6e6e, 0.25);
  g.strokeRect(1, 1, 30, 30);

  // Textur erzeugen und Graphics entsorgen
  g.generateTexture('floor_stone', 32, 32);
  g.clear();
  
  // 1) Ziegelmauer mit Rissen und Tiefenwirkung (64×64)
  // Grundfarbe
  g.fillStyle(0x5a5a5a, 1);
  g.fillRect(0, 0, 64, 64);
  // Mauersteine (helle Oberseite, dunkle Unterseite)
  for (let by = 0; by < 64; by += 16) {
    for (let bx = 0; bx < 64; bx += 32) {
      // Obere Hälfte
      g.fillStyle(0x6e6e6e, 1);
      g.fillRect(bx, by, 32, 8);
      // Untere Hälfte
      g.fillStyle(0x4a4a4a, 1);
      g.fillRect(bx, by + 8, 32, 8);
      // Fugenrand leicht aufhellen
      g.lineStyle(1, 0x7e7e7e, 1);
      g.lineBetween(bx, by + 8, bx + 32, by + 8);
    }
  }
  // Vertikale Fugen
  g.lineStyle(2, 0x3e3e3e, 1);
  g.lineBetween(32, 0, 32, 64);
  // Risse
  g.lineStyle(1, 0x2a2a2a, 1);
  g.beginPath();
  g.moveTo(10, 5).lineTo(14, 20).lineTo(8, 35).lineTo(12, 50);
  g.strokePath();
  g.beginPath();
  g.moveTo(50, 15).lineTo(46, 30).lineTo(52, 45);
  g.strokePath();

  g.generateTexture('obstacleWall', 64, 64);
  g.clear();

  // -----------------------
  // Baum-Krone (64×64)
  // -----------------------
  // Grundform: drei überlappende Kreise für voluminöse Krone
  g.fillStyle(0x2E8B57, 1);            // dunkles Grün
  g.fillCircle(32, 24, 20);            // mittlerer Kreis
  g.fillStyle(0x3CB371, 1);            // mittleres Grün
  g.fillCircle(20, 32, 18);            // links
  g.fillCircle(44, 32, 18);            // rechts

  // Lichtakzente: helle Flecken
  g.fillStyle(0x90EE90, 0.6);          // helles Grün, halbtransparent
  g.fillCircle(28, 20, 8);
  g.fillCircle(38, 28, 6);

  // -----------------------
  // Stamm
  // -----------------------
  // Rechteck mit Rindenstruktur
  g.fillStyle(0x8B4513, 1);
  g.fillRoundedRect(28, 40, 8, 24, 2); // runde Ecken für stylischen Look

  // Rindenmuster: schräge Linien
  g.lineStyle(1, 0x704214, 1);
  for (let i = 0; i < 3; i++) {
    const y = 44 + i * 6;
    g.beginPath();
    g.moveTo(28, y).lineTo(36, y + 4).strokePath();
  }

  // -----------------------
  // Textur fertigstellen
  // -----------------------
  g.generateTexture('obstacleTree', 64, 64);

  // ROCK (48×32) – detailreicher Felsen
  g.clear();

  // Grundform
  g.fillStyle(0x6a6a6a, 1);
  g.fillEllipse(24, 16, 48, 32);

  // Lichtkante oben links
  g.fillStyle(0x8a8a8a, 1);
  g.fillEllipse(18, 12, 24, 16);

  // Schatten unten rechts
  g.fillStyle(0x4a4a4a, 1);
  g.fillEllipse(30, 20, 28, 20);

  // Grobe Risse (dünne Linien)
  g.lineStyle(1, 0x2e2e2e, 1);
  g.beginPath();
  g.moveTo(12, 10).lineTo(16, 18).lineTo(10, 24);
  g.strokePath();
  g.beginPath();
  g.moveTo(36, 14).lineTo(32, 22).lineTo(40, 26);
  g.strokePath();

  // Kleine Körner („Grain“)
  g.fillStyle(0x7a7a7a, 0.6);
  for (let i = 0; i < 8; i++) {
    const rx = Phaser.Math.Between(8, 40);
    const ry = Phaser.Math.Between(8, 24);
    g.fillRect(rx, ry, 1, 1);
  }

  // Kontur leicht betonen
  g.lineStyle(1, 0x3e3e3e, 1);
  g.strokeEllipse(24, 16, 48, 32);

  // Textur erzeugen
  g.generateTexture('obstacleRock', 48, 32);

  // ===== Neue Objekte =====

  // pillar_small 32x32
  g.clear();
  g.fillStyle(0x8a8a8a, 1);           // Steinbasis
  g.fillRoundedRect(6, 24, 20, 6, 2); // Sockel
  g.fillStyle(0x9c9c9c, 1);
  g.fillRoundedRect(10, 6, 12, 20, 3);// Schaft
  g.fillStyle(0xb0b0b0, 1);
  g.fillRoundedRect(4, 2, 24, 6, 2);  // Kapitell
  g.lineStyle(1, 0x6e6e6e, 0.6);      // Fugen
  g.strokeRoundedRect(10, 6, 12, 20, 3);
  g.generateTexture('pillar_small', 32, 32);

  // pillar_large 48x48
  g.clear();
  g.fillStyle(0x7a7a7a, 1);
  g.fillRoundedRect(6, 38, 36, 8, 3);        // Sockel breit
  g.fillStyle(0x9a9a9a, 1);
  g.fillRoundedRect(18, 8, 12, 30, 4);       // Schaft
  g.fillStyle(0xbcbcbc, 1);
  g.fillRoundedRect(8, 2, 32, 10, 3);        // Kapitell
  g.lineStyle(2, 0x6c6c6c, 0.8);
  g.strokeRoundedRect(18, 8, 12, 30, 4);
  g.generateTexture('pillar_large', 48, 48);

  // statue_knight 48x64
  g.clear();
  // Sockel
  g.fillStyle(0x6e6e6e, 1);
  g.fillRoundedRect(8, 52, 32, 10, 2);
  // Figur stilisiert
  g.fillStyle(0x9d9d9d, 1);
  g.fillRect(20, 18, 8, 18);          // Oberkoerper
  g.fillRect(18, 36, 12, 14);         // Huefte
  g.fillRect(16, 50, 6, 6);           // Bein links
  g.fillRect(26, 50, 6, 6);           // Bein rechts
  g.fillStyle(0xbdbdbd, 1);
  g.fillRect(18, 10, 12, 10);         // Helm
  g.fillStyle(0x888888, 1);
  g.fillRect(30, 24, 10, 4);          // Schildkante
  g.fillStyle(0xaaaaaa, 1);
  g.fillRect(30, 20, 8, 12);          // Schild
  g.fillStyle(0xcccccc, 1);
  g.fillRect(14, 18, 2, 24);          // Waffe Stil
  g.fillRect(12, 12, 6, 6);           // Klinge
  // leichte Kanten
  g.lineStyle(1, 0x5a5a5a, 0.8);
  g.strokeRoundedRect(8, 52, 32, 10, 2);
  g.generateTexture('statue_knight', 48, 64);

  // brazier 24x32
  g.clear();
  // Schale
  g.fillStyle(0x4a4040, 1);
  g.fillEllipse(12, 20, 20, 8);
  g.fillStyle(0x5a5050, 1);
  g.fillEllipse(12, 18, 18, 6);
  // Flamme stilisiert
  g.fillStyle(0xffcc33, 1);
  g.fillTriangle(12, 4, 6, 18, 18, 18);
  g.fillStyle(0xff6633, 1);
  g.fillTriangle(12, 8, 9, 18, 15, 18);
  // Fuss
  g.fillStyle(0x3a3333, 1);
  g.fillRect(10, 22, 4, 6);
  g.generateTexture('brazier', 24, 32);

  // crate 32x32
  g.clear();
  g.fillStyle(0x7a4a1a, 1);  // Holz
  g.fillRect(0, 0, 32, 32);
  // Bretter
  g.fillStyle(0x8a5a2a, 1);
  g.fillRect(2, 6, 28, 4);
  g.fillRect(2, 14, 28, 4);
  g.fillRect(2, 22, 28, 4);
  // Kanten
  g.lineStyle(2, 0x5a3a1a, 1);
  g.strokeRect(1, 1, 30, 30);
  // Diagonalstreben
  g.lineStyle(2, 0x704520, 0.9);
  g.beginPath(); g.moveTo(3, 29); g.lineTo(29, 3); g.strokePath();
  g.generateTexture('crate', 32, 32);

  const chestDefs = [
    { key: 'chest_small', w: 36, h: 26 },
    { key: 'chest_medium', w: 44, h: 32 },
    { key: 'chest_large', w: 52, h: 38 }
  ];

  chestDefs.forEach(({ key, w, h }) => {
    g.clear();

    const lidHeight = Math.round(h * 0.4);
    const baseHeight = h - lidHeight;
    const bandY = Math.round(baseHeight * 0.45);

    // Unterteil
    g.fillStyle(0x8c5223, 1).fillRoundedRect(0, lidHeight, w, baseHeight, 4);
    g.fillStyle(0xa8662e, 1).fillRoundedRect(2, lidHeight + 2, w - 4, baseHeight - 4, 3);

    // Deckel
    g.fillStyle(0xa15b28, 1).fillRoundedRect(0, 0, w, lidHeight + 4, 6);
    g.fillStyle(0xc97b36, 1).fillRoundedRect(2, 2, w - 4, lidHeight, 5);

    // Metallband horizontal
    g.fillStyle(0x3d2b1f, 1).fillRect(0, lidHeight + bandY, w, 4);
    // Metallband vertikal (Schlossbereich)
    g.fillRect(Math.floor(w / 2) - 2, lidHeight - 2, 4, baseHeight + 4);

    // Schloss / Verzierung
    g.fillStyle(0xe6c97d, 1).fillRect(Math.floor(w / 2) - 3, lidHeight + bandY - 2, 6, 6);
    g.fillRect(Math.floor(w / 2) - 1, lidHeight + bandY + 4, 2, 6);

    // Highlights & Schatten
    g.lineStyle(1, 0xf2d9a0, 0.6).strokeRoundedRect(1, 1, w - 2, lidHeight, 5);
    g.lineStyle(1, 0x6e3f1b, 0.7).strokeRoundedRect(0, lidHeight, w, baseHeight, 4);

    // Kleine Nieten auf dem Band
    g.fillStyle(0xc9b075, 0.9);
    const spacing = Math.max(6, Math.floor(w / 6));
    for (let x = spacing; x < w; x += spacing) {
      g.fillCircle(x, lidHeight + bandY + 2, 1.2);
    }

    g.generateTexture(key, w, h);
  });

  // barrel 24x32
  g.clear();
  // Koerper
  const cx = 12, cy = 16; // Mittelpunkt

  // Holzkoerper
  g.fillStyle(0x7a4a22, 1);
  g.fillEllipse(cx, cy, 20, 26);

  // Seitenabdunklung
  g.fillStyle(0x5a3418, 0.6);
  g.fillEllipse(cx + 3, cy, 7, 24);
  g.fillStyle(0x3a1f0f, 0.35);
  g.fillEllipse(cx + 6, cy, 3, 22);

  // Highlight links oben
  g.fillStyle(0xB97A3A, 0.5);
  g.fillEllipse(cx - 4, cy - 4, 6, 10);

  // Holzmaserung: schmale, gebogene Staves
  g.lineStyle(1, 0x4e2d15, 0.7);
  for (let i = -8; i <= 8; i += 3) {
    g.strokeEllipse(cx + i, cy, 2, 24);
  }

  // Metallbaender (gefüllt fuer 3D-Feeling)
  g.fillStyle(0x3d2c1a, 1);
  g.fillEllipse(cx, cy - 5, 18, 6);
  g.fillEllipse(cx, cy + 5, 18, 6);

  // Kanten der Baender leicht betonen
  g.lineStyle(1, 0xa38a6a, 0.5);
  g.strokeEllipse(cx, cy - 5, 18, 6);
  g.strokeEllipse(cx, cy + 5, 18, 6);

  // Nieten
  g.fillStyle(0xd0c8b8, 0.9);
  [[-6,-5],[0,-5],[6,-5],[-6,5],[0,5],[6,5]].forEach(([dx,dy])=>{
    g.fillCircle(cx + dx, cy + dy, 0.8);
  });

  // Kontur des Fasses
  g.lineStyle(2, 0x2b180d, 0.9);
  g.strokeEllipse(cx, cy, 20, 26);

  // Oberer Rand leicht betonen
  g.lineStyle(2, 0xffe0b0, 0.35);
  g.strokeEllipse(cx, cy - 10, 14, 4);

  // Boden-Schatten dezent
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(cx, 30, 18, 4);

  // Textur erzeugen
  g.generateTexture('barrel', 24, 32);
  
  // rubble 32x24
  g.clear();
  g.fillStyle(0x6e6e6e, 1);
  g.fillTriangle(4, 22, 12, 8, 20, 22);
  g.fillStyle(0x7e7e7e, 1);
  g.fillTriangle(14, 22, 22, 12, 30, 22);
  g.fillStyle(0x5a5a5a, 1);
  g.fillTriangle(8, 22, 16, 14, 24, 22);
  // kleine Brocken
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(6, 20, 2, 2);
  g.fillRect(26, 20, 2, 2);
  g.fillRect(18, 18, 2, 2);
  g.generateTexture('rubble', 32, 24);

  // altar 48x32
  g.clear();
  // Platte
  g.fillStyle(0x8c8c8c, 1);
  g.fillRoundedRect(4, 4, 40, 12, 4);
  // Fuesse
  g.fillStyle(0x7a7a7a, 1);
  g.fillRoundedRect(8, 18, 8, 10, 2);
  g.fillRoundedRect(32, 18, 8, 10, 2);
  // Zierkante
  g.lineStyle(2, 0xbcbcbc, 0.8);
  g.strokeRoundedRect(4, 4, 40, 12, 4);
  g.generateTexture('altar', 48, 32);
  
  // Treppe
  const w = 48, h = 48;

  g.clear();

  const stepCount = 6;
  const stepDepth = Math.floor(h / stepCount);

  for (let i = 0; i < stepCount; i++) {
    const offset = i * 8; // schräge versetzen
    const y = h - (i + 1) * stepDepth;

    // Stufenfläche
    g.fillStyle(0xcccccc, 1);
    g.fillRect(offset, y, w - offset, stepDepth - 2);

    // Oberkante heller
    g.fillStyle(0xffffff, 1);
    g.fillRect(offset, y, w - offset, 2);

    // Vorderkante dunkler
    g.fillStyle(0x888888, 1);
    g.fillRect(offset, y + stepDepth - 3, w - offset, 3);
  }

  // --- Pfeil oben links (außerhalb der Treppe) ---
  g.fillStyle(0x000000, 1);
  const ax = 10;   // etwas vom linken Rand weg
  const ay = 10;   // etwas vom oberen Rand weg
  g.beginPath();
  g.moveTo(ax, ay);        // Spitze unten
  g.lineTo(ax - 6, ay - 10); // links oben
  g.lineTo(ax + 6, ay - 10); // rechts oben
  g.closePath();
  g.fillPath();

  g.generateTexture('stairDown', w, h);

  g.destroy();
}

function createInventoryGraphics() {
  const g = this.add.graphics();

  // Panel
  g.fillStyle(0x111111, 0.95);
  g.fillRoundedRect(0, 0, 560, 360, 12);
  g.lineStyle(2, 0xffffff, 0.2);
  g.strokeRoundedRect(0, 0, 560, 360, 12);
  g.generateTexture('uiPanel', 560, 360);
  g.clear();

  // Slot Hintergrund
  g.fillStyle(0x222222, 1);
  g.fillRoundedRect(0, 0, 120, 60, 8);
  g.lineStyle(2, 0xffffff, 0.15);
  g.strokeRoundedRect(0, 0, 120, 60, 8);
  g.generateTexture('uiSlot', 120, 60);
  g.clear();

  // Slot ausgewählt
  g.fillStyle(0x444444, 1);
  g.fillRoundedRect(0, 0, 120, 60, 8);
  g.lineStyle(3, 0xffff00, 0.9);
  g.strokeRoundedRect(0, 0, 120, 60, 8);
  g.generateTexture('uiSlotSel', 120, 60);
  g.destroy();
}

function createProjectileGraphics() {
  const g = this.add.graphics();

  // Schaft (dünner Balken)
  g.fillStyle(0xff00ff, 1);
  g.fillRect(2, 7, 12, 2);

  // Pfeilspitze (Dreieck)
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(14, 5, 14, 11, 18, 8);

  // ggf. kleiner Schatten
  g.lineStyle(1, 0x880088, 0.5);
  g.strokeRect(2, 7, 12, 2);

  // Textur erzeugen und Graphics wegwerfen
  g.generateTexture('projectileTexture', 20, 20);
  g.destroy();
}

/**
 * Erzeugt ausgiebig alle vier Enemy-Texturen.
 */
function createEnemyGraphics() {
  // 1) Imp-Dämon (Nahkämpfer)
  {
    const g = this.add.graphics();
    // Hörner
    g.fillStyle(0xffffff, 1);
    g.fillRect(18, 4, 6, 10);
    g.fillRect(40, 4, 6, 10);
    // Augen
    g.fillStyle(0x000000, 1);
    g.fillRect(28, 16, 4, 4);
    g.fillRect(36, 16, 4, 4);
    // Kopf
    g.fillStyle(0xff4444, 1);
    g.fillRect(24, 12, 16, 16);
    // Mund (Zähne)
    g.fillStyle(0xffffff, 1);
    g.fillRect(28, 24, 8, 2);
    // Körper mit Rüstung
    g.fillStyle(0xaa0000, 1);
    g.fillRect(20, 28, 24, 24);
    g.fillStyle(0x550000, 1);
    g.fillRect(20, 36, 24, 4); // Gürtel
    // Beine
    g.fillStyle(0x550000, 1);
    g.fillRect(20, 52, 10, 12);
    g.fillRect(34, 52, 10, 12);
    g.generateTexture('enemyImp', 64, 64);
    g.destroy();
  }

  // 2) Bogenschütze (Fernkämpfer)
  {
    const g = this.add.graphics();
    // Kapuze
    g.fillStyle(0x222222, 1);
    g.fillRect(22, 4, 20, 24);
    // Gesicht
    g.fillStyle(0xddddcc, 1);
    g.fillRect(26, 12, 12, 12);
    // Schultern
    g.fillStyle(0x333333, 1);
    g.fillRect(20, 28, 24, 12);
    // Armschützer
    g.fillStyle(0x555555, 1);
    g.fillRect(16, 28, 6, 20);
    g.fillRect(42, 28, 6, 20);
    // Umhang
    g.fillStyle(0x444444, 1);
    g.fillRect(18, 40, 28, 18);
    // Beine
    g.fillStyle(0x333333, 1);
    g.fillRect(22, 58, 8, 14);
    g.fillRect(34, 58, 8, 14);
    // Bogen
    g.lineStyle(2, 0x885522, 1);
    g.strokeLineShape(new Phaser.Geom.Line(32, 36, 50, 44));
    g.generateTexture('enemyArcher', 64, 64);
    g.destroy();
  }

  // 3) Brute (Panzer-Typ)
  {
    const g = this.add.graphics();
    // Helm
    g.fillStyle(0x999999, 1);
    g.fillRect(22, 4, 20, 16);
    g.fillStyle(0x333333, 1);
    g.fillRect(26, 8, 12, 4);
    // Brustpanzer
    g.fillStyle(0x777777, 1);
    g.fillRect(18, 20, 28, 36);
    // Stachel
    g.fillStyle(0x444444, 1);
    g.fillTriangle(18, 20, 14, 28, 18, 36);
    g.fillTriangle(46, 20, 50, 28, 46, 36);
    // Beine
    g.fillStyle(0x555555, 1);
    g.fillRect(18, 56, 12, 12);
    g.fillRect(34, 56, 12, 12);
    // Streitkolben
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(44, 24, 4, 24);
    g.fillStyle(0x666666, 1);
    g.fillRect(42, 24, 8, 4);
    g.generateTexture('enemyBrute', 64, 64);
    g.destroy();
  }

  // 4) Magier (Support-Typ)
  {
    const g = this.add.graphics();
    // Kapuze
    g.fillStyle(0x222288, 1);
    g.fillRect(22, 4, 20, 24);
    // Augen leuchten
    g.fillStyle(0xffff00, 1);
    g.fillRect(28, 16, 4, 4);
    g.fillRect(36, 16, 4, 4);
    // Robe
    g.fillStyle(0x3333aa, 1);
    g.fillRect(18, 28, 28, 36);
    // Zauberstab
    g.fillStyle(0x8888ff, 1);
    g.fillRect(46, 40, 4, 28);
    g.generateTexture('enemyMage', 64, 64);
    g.destroy();
  }
}

function createItemGraphics() {
  const g = this.add.graphics();
  const SIZE = 48;

  const icons = [
    {
      key: 'itWeapon',
      draw: () => {
        const cx = SIZE / 2;
        g.fillStyle(0xeeeeee, 1);
        g.fillRect(cx - 4, 6, 8, 26);
        g.fillStyle(0xcfd4d9, 1);
        g.fillRect(cx - 2, 6, 4, 26);
        g.fillStyle(0xffd37f, 1);
        g.fillRect(cx - 10, 24, 20, 4);
        g.fillStyle(0x6b3e26, 1);
        g.fillRect(cx - 2, 28, 4, 12);
        g.fillStyle(0xffd37f, 1);
        g.fillCircle(cx, 40, 4);
      }
    },
    {
      key: 'itHead',
      draw: () => {
        const cx = SIZE / 2;
        // äußere Haube
        g.fillStyle(0x4b6074, 1);
        g.fillCircle(cx, 18, 16);
        // helle Haube innen
        g.fillStyle(0x8fa5b8, 1);
        g.fillCircle(cx, 16, 14);
        // seitliche Wangenstücke
        g.fillStyle(0x4b6074, 1);
        g.fillRect(cx - 18, 24, 8, 12);
        g.fillRect(cx + 10, 24, 8, 12);
        // Gesichtsschutz
        g.fillStyle(0x6f8395, 1);
        g.fillRect(cx - 14, 24, 28, 14);
        // Nasenschutz
        g.fillStyle(0xbcccdc, 1);
        g.fillRect(cx - 2, 20, 4, 18);
        // Augenschlitz
        g.fillStyle(0x141b22, 1);
        g.fillRect(cx - 12, 26, 24, 4);
        // Spiegelung
        g.fillStyle(0xd9e4ef, 0.9);
        g.fillCircle(cx + 6, 14, 4);
      }
    },
    {
      key: 'itBody',
      draw: () => {
        g.fillStyle(0x5cb85c, 1);
        g.fillRoundedRect(10, 8, 28, 30, 10);
        g.fillStyle(0x3b7e3b, 1);
        g.fillRect(14, 26, 20, 10);
        g.fillStyle(0x7cd37c, 1);
        g.fillRect(18, 14, 12, 6);
      }
    },
    {
      key: 'itBoots',
      draw: () => {
        g.fillStyle(0xf0ad4e, 1);
        g.fillRoundedRect(10, 28, 10, 12, 4);
        g.fillRoundedRect(26, 28, 10, 12, 4);
        g.fillStyle(0xc27d21, 1);
        g.fillRect(10, 36, 12, 4);
        g.fillRect(26, 36, 12, 4);
      }
    },
    {
      key: 'itConsumable',
      draw: () => {
        g.fillStyle(0xb07cc6, 1);
        g.fillCircle(24, 26, 12);
        g.fillStyle(0x8e5ba5, 1);
        g.fillCircle(24, 26, 10);
        g.fillStyle(0xd7b8ef, 0.7);
        g.fillCircle(20, 22, 6);
        g.fillStyle(0xdddddd, 1);
        g.fillRect(18, 8, 12, 6);
        g.fillRoundedRect(20, 6, 8, 6, 2);
      }
    },
    {
      key: 'itMat',
      draw: () => {
        g.fillStyle(0x9b9b9b, 1);
        g.fillRoundedRect(8, 20, 32, 16, 6);
        g.fillStyle(0xbfbfbf, 1);
        g.fillRoundedRect(12, 18, 24, 12, 4);
        g.fillStyle(0x6f6f6f, 1);
        g.fillRect(12, 30, 24, 4);
      }
    },
    {
      key: 'uiItemBetter',
      draw: () => {
        const baseY = SIZE - 10;
        const centerX = SIZE / 2;
        g.fillStyle(0x1fc96a, 1);
        g.fillTriangle(centerX, 8, centerX - 10, baseY - 12, centerX + 10, baseY - 12);
        g.fillRect(centerX - 4, baseY - 12, 8, 16);
        g.fillStyle(0x0f7f3e, 1);
        g.fillRect(centerX - 4, baseY - 4, 8, 4);
      }
    }
  ];

  icons.forEach(({ key, draw }) => {
    g.clear();
    g.fillStyle(0x000000, 0);
    g.fillRect(0, 0, SIZE, SIZE);
    draw();
    g.generateTexture(key, SIZE, SIZE);
  });

  g.destroy();
}

function createInventoryGraphics() {
  const g = this.add.graphics();

  // Panel
  g.fillStyle(0x0e0e0e, 0.95);
  g.fillRoundedRect(0, 0, 680, 420, 12);
  g.lineStyle(2, 0xffffff, 0.15);
  g.strokeRoundedRect(0, 0, 680, 420, 12);
  g.generateTexture('uiPanel', 680, 420);
  g.clear();

  // Slot normal
  g.fillStyle(0x222222, 1);
  g.fillRoundedRect(0, 0, 96, 64, 8);
  g.lineStyle(2, 0xffffff, 0.12);
  g.strokeRoundedRect(0, 0, 96, 64, 8);
  g.generateTexture('uiSlot', 96, 64);
  g.clear();

  // Slot selected
  g.fillStyle(0x3a3a3a, 1);
  g.fillRoundedRect(0, 0, 96, 64, 8);
  g.lineStyle(3, 0xffd33b, 0.95);
  g.strokeRoundedRect(0, 0, 96, 64, 8);
  g.generateTexture('uiSlotSel', 96, 64);
  g.destroy();
}

function createLootGraphics() {
    const g = this.add.graphics();

    // 1) Health-Drop als rotes Herz (16×16)
    g.fillStyle(0xff0000, 1);
    // linker Herz-Halbkreis
    g.fillCircle(5, 6, 4);
    // rechter Herz-Halbkreis
    g.fillCircle(11, 6, 4);
    // Herz-Spitze
    g.fillTriangle(3, 8, 13, 8, 8, 14);
    g.generateTexture('healthDrop', 16, 16);
    g.clear();

    // 2) XP-Drop als blauer Kristall (16×16)
    g.fillStyle(0x00ffff, 1);
    // oberes Dreieck
    g.fillTriangle(8, 2, 4, 8, 12, 8);
    // unteres Dreieck
    g.fillTriangle(8, 14, 4, 8, 12, 8);
    g.generateTexture('xpDrop', 16, 16);
    g.destroy();
}

function createPlayerGraphics() {
  if (this.textures.exists('playerTexture') || this.textures.exists('playerSprites')) {
    return;
  }
  const g = this.add.graphics();

  // Umhang (ganz hinten)
  g.fillStyle(0x330000, 1);
  g.fillRect(40, 32, 48, 80);

  // Kopf + Helm
  g.fillStyle(0xddddcc, 1); // Gesicht
  g.fillRect(56, 16, 16, 16);
  g.fillStyle(0x999999, 1); // Helmkante
  g.fillRect(56, 16, 16, 6);

  // Brustpanzer
  g.fillStyle(0x666666, 1);
  g.fillRect(48, 40, 32, 40);

  // Gürtel + Schnalle
  g.fillStyle(0x333333, 1);
  g.fillRect(48, 72, 32, 6);
  g.fillStyle(0xffff00, 1);
  g.fillRect(60, 72, 8, 6);

  // Armschützer
  g.fillStyle(0xaaaaaa, 1);
  g.fillRect(32, 44, 8, 28); // linker Arm
  g.fillRect(88, 44, 8, 28); // rechter Arm

  // Beine + Stiefel
  g.fillStyle(0x222222, 1);
  g.fillRect(48, 80, 12, 32); // linkes Bein
  g.fillRect(68, 80, 12, 32); // rechtes Bein

  // Schwert (auf dem Rücken)
  g.fillStyle(0xcccccc, 1);
  g.fillRect(88, 32, 4, 48); // Klinge
  g.fillStyle(0xffcc00, 1);
  g.fillRect(86, 30, 8, 4);  // Griff

  // Textur erzeugen
  g.generateTexture('playerTexture', 128, 128);
  g.destroy();
}
