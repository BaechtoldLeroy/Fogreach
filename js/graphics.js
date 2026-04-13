function createObstacleGraphics() {
  const g = this.add.graphics();

  // ===== floor_stone (32x32) — standard stone floor with rich detail =====
  // Base fill with subtle gradient bands
  g.fillStyle(0x585858, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(0x5e5e5e, 1);
  g.fillRect(0, 0, 32, 16);
  g.fillStyle(0x545454, 1);
  g.fillRect(0, 16, 32, 16);
  // Stone grain — 5 shades of noise
  g.fillStyle(0x6a6a6a, 0.35);
  g.fillCircle(10, 10, 6); g.fillCircle(22, 8, 5);
  g.fillCircle(20, 20, 7); g.fillCircle(8, 22, 5);
  g.fillStyle(0x4a4a4a, 0.25);
  g.fillCircle(14, 14, 4); g.fillCircle(24, 18, 3); g.fillCircle(12, 24, 3);
  g.fillStyle(0x727272, 0.2);
  g.fillCircle(6, 16, 3); g.fillCircle(26, 6, 4); g.fillCircle(18, 28, 3);
  g.fillStyle(0x505050, 0.15);
  g.fillCircle(16, 4, 5); g.fillCircle(28, 14, 3);
  // Mortar lines forming tile grid
  g.lineStyle(1, 0x3e3e3e, 0.35);
  g.lineBetween(0, 16, 32, 16);
  g.lineBetween(16, 0, 16, 32);
  // Wear marks — small dark scuffs
  g.fillStyle(0x3a3a3a, 0.2);
  g.fillRect(4, 10, 3, 1); g.fillRect(20, 22, 4, 1); g.fillRect(12, 28, 2, 1);
  // Pixel-level noise speckles
  g.fillStyle(0x7a7a7a, 0.5);
  [[5,6],[7,17],[12,9],[15,23],[20,12],[23,27],[26,16],[28,7],[3,14],[18,3],[25,20],[10,26]].forEach(([x,y])=>{
    g.fillRect(x, y, 1, 1);
  });
  g.fillStyle(0x424242, 0.4);
  [[8,4],[14,20],[22,14],[2,28],[27,2],[30,24]].forEach(([x,y])=>{
    g.fillRect(x, y, 1, 1);
  });
  // Hairline cracks
  g.lineStyle(1, 0x3c3c3c, 0.4);
  g.beginPath(); g.moveTo(6, 12); g.lineTo(10, 16); g.lineTo(8, 20); g.strokePath();
  g.beginPath(); g.moveTo(22, 6); g.lineTo(24, 10); g.lineTo(20, 14); g.strokePath();
  // Tiny crack near edge
  g.lineStyle(1, 0x444444, 0.25);
  g.beginPath(); g.moveTo(28, 24); g.lineTo(30, 28); g.strokePath();

  g.generateTexture('floor_stone', 32, 32);
  g.clear();
  
  // ===== obstacleWall (64x64) — detailed brick wall with 3D effect =====
  g.fillStyle(0x4e4e4e, 1);
  g.fillRect(0, 0, 64, 64);
  // Brick rows with offset pattern and individual color variation
  const owBrickColors = [0x5a5a5a, 0x5e5e5e, 0x565656, 0x626262, 0x585858];
  for (let by = 0; by < 64; by += 16) {
    const rowOffset = (Math.floor(by / 16) % 2) * 16;
    let ci = 0;
    for (let bx = -16 + rowOffset; bx < 64; bx += 32) {
      const brickColor = owBrickColors[(ci + Math.floor(by / 16)) % owBrickColors.length];
      ci++;
      const x0 = Math.max(0, bx + 1);
      const x1 = Math.min(64, bx + 31);
      if (x1 <= x0) continue;
      // Brick body
      g.fillStyle(brickColor, 1);
      g.fillRect(x0, by + 1, x1 - x0, 14);
      // Top-edge highlight (3D)
      g.fillStyle(0x787878, 0.5);
      g.fillRect(x0, by + 1, x1 - x0, 2);
      // Bottom-edge shadow (3D)
      g.fillStyle(0x2e2e2e, 0.4);
      g.fillRect(x0, by + 13, x1 - x0, 2);
      // Per-brick surface noise
      g.fillStyle(0x6a6a6a, 0.15);
      g.fillCircle(x0 + 8, by + 7, 3);
      g.fillStyle(0x3e3e3e, 0.1);
      g.fillCircle(x0 + 18, by + 9, 2);
    }
  }
  // Mortar lines
  g.lineStyle(1, 0x333333, 0.9);
  for (let by = 0; by <= 64; by += 16) {
    g.lineBetween(0, by, 64, by);
  }
  // Vertical mortar at brick joints
  g.lineStyle(1, 0x333333, 0.7);
  for (let by = 0; by < 64; by += 16) {
    const rowOffset = (Math.floor(by / 16) % 2) * 16;
    for (let bx = -16 + rowOffset; bx < 80; bx += 32) {
      if (bx > 0 && bx < 64) g.lineBetween(bx, by, bx, by + 16);
    }
  }
  // Cracks
  g.lineStyle(1, 0x1e1e1e, 0.7);
  g.beginPath(); g.moveTo(10, 5); g.lineTo(14, 20); g.lineTo(8, 35); g.lineTo(12, 50); g.strokePath();
  g.beginPath(); g.moveTo(50, 15); g.lineTo(46, 30); g.lineTo(52, 45); g.strokePath();
  // Moss spots
  g.fillStyle(0x2a4a2a, 0.25);
  g.fillCircle(6, 58, 4); g.fillCircle(54, 62, 3);
  g.fillStyle(0x1e3e1e, 0.15);
  g.fillCircle(10, 60, 3);

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

  // pillar_small 32x32 — detailed with carved rings
  g.clear();
  // Sockel with shadow
  g.fillStyle(0x6a6a6a, 1);
  g.fillRoundedRect(6, 25, 20, 6, 2);
  g.fillStyle(0x8a8a8a, 1);
  g.fillRoundedRect(6, 24, 20, 5, 2);
  // Schaft with gradient
  g.fillStyle(0x8e8e8e, 1);
  g.fillRoundedRect(10, 6, 12, 20, 3);
  // Light side highlight
  g.fillStyle(0xa8a8a8, 0.4);
  g.fillRect(10, 6, 4, 20);
  // Dark side shadow
  g.fillStyle(0x606060, 0.3);
  g.fillRect(18, 6, 4, 20);
  // Carved rings on shaft
  g.lineStyle(1, 0x6e6e6e, 0.5);
  g.lineBetween(10, 10, 22, 10);
  g.lineBetween(10, 16, 22, 16);
  g.lineBetween(10, 22, 22, 22);
  // Kapitell with highlight
  g.fillStyle(0x9a9a9a, 1);
  g.fillRoundedRect(4, 2, 24, 6, 2);
  g.fillStyle(0xc0c0c0, 0.4);
  g.fillRoundedRect(4, 2, 24, 3, 2);
  // Outline
  g.lineStyle(1, 0x5a5a5a, 0.5);
  g.strokeRoundedRect(10, 6, 12, 20, 3);
  g.generateTexture('pillar_small', 32, 32);

  // pillar_large 48x48 — ornate pillar with fluted shaft
  g.clear();
  // Sockel with 3D edge
  g.fillStyle(0x5e5e5e, 1);
  g.fillRoundedRect(6, 39, 36, 8, 3);
  g.fillStyle(0x7a7a7a, 1);
  g.fillRoundedRect(6, 38, 36, 7, 3);
  g.fillStyle(0x929292, 0.3);
  g.fillRoundedRect(6, 38, 36, 3, 3);
  // Schaft with fluting (vertical grooves)
  g.fillStyle(0x8a8a8a, 1);
  g.fillRoundedRect(16, 8, 16, 30, 4);
  // Flute highlights
  g.fillStyle(0xa4a4a4, 0.35);
  g.fillRect(17, 8, 3, 30);
  g.fillRect(22, 8, 2, 30);
  g.fillRect(27, 8, 2, 30);
  // Flute shadows
  g.fillStyle(0x5a5a5a, 0.25);
  g.fillRect(20, 8, 2, 30);
  g.fillRect(25, 8, 2, 30);
  g.fillRect(30, 8, 2, 30);
  // Carved rings
  g.lineStyle(1, 0x6a6a6a, 0.6);
  g.lineBetween(16, 12, 32, 12);
  g.lineBetween(16, 20, 32, 20);
  g.lineBetween(16, 28, 32, 28);
  g.lineBetween(16, 35, 32, 35);
  // Kapitell with ornate top
  g.fillStyle(0x9a9a9a, 1);
  g.fillRoundedRect(8, 2, 32, 10, 3);
  g.fillStyle(0xc0c0c0, 0.4);
  g.fillRoundedRect(8, 2, 32, 4, 3);
  // Decorative band on kapitell
  g.lineStyle(1, 0xbcbcbc, 0.5);
  g.lineBetween(10, 8, 38, 8);
  // Outline
  g.lineStyle(1, 0x4e4e4e, 0.6);
  g.strokeRoundedRect(16, 8, 16, 30, 4);
  g.generateTexture('pillar_large', 48, 48);

  // statue_knight 48x64 — detailed knight statue with shading
  g.clear();
  // Sockel with beveled edge
  g.fillStyle(0x555555, 1);
  g.fillRoundedRect(8, 53, 32, 10, 2);
  g.fillStyle(0x6e6e6e, 1);
  g.fillRoundedRect(8, 52, 32, 9, 2);
  g.fillStyle(0x8a8a8a, 0.35);
  g.fillRoundedRect(8, 52, 32, 3, 2);
  // Legs with armor plates
  g.fillStyle(0x7a7a7a, 1);
  g.fillRect(16, 44, 6, 10);
  g.fillRect(26, 44, 6, 10);
  g.fillStyle(0x8e8e8e, 0.5);
  g.fillRect(16, 44, 3, 10); g.fillRect(26, 44, 3, 10);
  // Body — torso armor
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(18, 20, 12, 24);
  // Chest plate highlight
  g.fillStyle(0xb0b0b0, 0.4);
  g.fillRect(18, 20, 6, 12);
  // Armor shadow
  g.fillStyle(0x5a5a5a, 0.3);
  g.fillRect(26, 24, 4, 18);
  // Belt
  g.fillStyle(0x5a4a3a, 1);
  g.fillRect(17, 36, 14, 3);
  g.fillStyle(0xc9a050, 1);
  g.fillRect(22, 36, 4, 3);
  // Helm with visor
  g.fillStyle(0x9a9a9a, 1);
  g.fillRect(18, 10, 12, 12);
  g.fillStyle(0xbcbcbc, 0.5);
  g.fillRect(18, 10, 12, 5);
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(20, 16, 8, 2); // visor slit
  // Plume on helm
  g.fillStyle(0x8a2020, 0.7);
  g.fillRect(22, 6, 4, 6);
  // Shield on right arm
  g.fillStyle(0x7a7a7a, 1);
  g.fillRect(30, 20, 8, 14);
  g.fillStyle(0x9a9a9a, 0.5);
  g.fillRect(30, 20, 8, 6);
  g.lineStyle(1, 0xaaaaaa, 0.4);
  g.lineBetween(34, 20, 34, 34);
  g.lineBetween(30, 27, 38, 27);
  // Sword on left arm
  g.fillStyle(0xc0c0c0, 1);
  g.fillRect(13, 12, 2, 30);
  g.fillStyle(0xe0e0e0, 0.5);
  g.fillRect(13, 12, 1, 30);
  // Crossguard
  g.fillStyle(0x8a7a50, 1);
  g.fillRect(10, 18, 8, 2);
  // Outline
  g.lineStyle(1, 0x4a4a4a, 0.6);
  g.strokeRoundedRect(8, 52, 32, 10, 2);
  g.generateTexture('statue_knight', 48, 64);

  // brazier 24x32 — bright animated-look fire brazier
  g.clear();
  // Stand/legs
  g.fillStyle(0x3a3030, 1);
  g.fillRect(5, 24, 3, 6);
  g.fillRect(16, 24, 3, 6);
  g.fillStyle(0x4a3a3a, 1);
  g.fillRect(9, 26, 6, 4);
  // Bowl — dark iron
  g.fillStyle(0x3e3535, 1);
  g.fillEllipse(12, 22, 22, 8);
  g.fillStyle(0x504545, 1);
  g.fillEllipse(12, 20, 20, 6);
  // Bowl inner glow (hot)
  g.fillStyle(0x8a3000, 0.4);
  g.fillEllipse(12, 20, 14, 4);
  // Outer flame — bright yellow
  g.fillStyle(0xffdd44, 1);
  g.fillTriangle(12, 2, 4, 18, 20, 18);
  // Mid flame — orange
  g.fillStyle(0xff8822, 1);
  g.fillTriangle(12, 5, 7, 18, 17, 18);
  // Inner flame — bright white-yellow core
  g.fillStyle(0xffeeaa, 0.9);
  g.fillTriangle(12, 8, 9, 16, 15, 16);
  // Hot core
  g.fillStyle(0xffffff, 0.6);
  g.fillTriangle(12, 10, 10, 15, 14, 15);
  // Sparks (bright dots above flame)
  g.fillStyle(0xffee66, 0.8);
  g.fillRect(10, 1, 1, 1); g.fillRect(14, 0, 1, 1); g.fillRect(8, 3, 1, 1);
  // Bowl rim highlight
  g.lineStyle(1, 0x6a5a5a, 0.5);
  g.strokeEllipse(12, 20, 20, 6);
  g.generateTexture('brazier', 24, 32);

  // crate 32x32 — detailed wooden crate with nails and wood grain
  g.clear();
  // Base wood
  g.fillStyle(0x7a4a1a, 1);
  g.fillRect(0, 0, 32, 32);
  // Individual planks with slight color variation
  g.fillStyle(0x8a5a2a, 1);
  g.fillRect(2, 1, 28, 5);
  g.fillStyle(0x7e4e1e, 1);
  g.fillRect(2, 7, 28, 5);
  g.fillStyle(0x8a5828, 1);
  g.fillRect(2, 13, 28, 5);
  g.fillStyle(0x765018, 1);
  g.fillRect(2, 19, 28, 5);
  g.fillStyle(0x84562a, 1);
  g.fillRect(2, 25, 28, 5);
  // Wood grain lines
  g.lineStyle(1, 0x604010, 0.25);
  g.lineBetween(4, 2, 28, 2); g.lineBetween(6, 9, 26, 9);
  g.lineBetween(3, 15, 29, 15); g.lineBetween(5, 21, 27, 21);
  g.lineBetween(4, 27, 28, 27);
  // Iron bands (horizontal)
  g.fillStyle(0x4a3a1a, 1);
  g.fillRect(0, 6, 32, 2);
  g.fillRect(0, 18, 32, 2);
  // Kanten — darker frame
  g.lineStyle(2, 0x5a3a1a, 1);
  g.strokeRect(1, 1, 30, 30);
  // Corner braces
  g.fillStyle(0x3e2e10, 1);
  g.fillRect(0, 0, 4, 4); g.fillRect(28, 0, 4, 4);
  g.fillRect(0, 28, 4, 4); g.fillRect(28, 28, 4, 4);
  // Nails
  g.fillStyle(0xaaaaaa, 0.7);
  g.fillRect(2, 2, 1, 1); g.fillRect(29, 2, 1, 1);
  g.fillRect(2, 29, 1, 1); g.fillRect(29, 29, 1, 1);
  g.fillRect(15, 6, 1, 1); g.fillRect(15, 18, 1, 1);
  // Diagonal brace
  g.lineStyle(2, 0x604018, 0.7);
  g.beginPath(); g.moveTo(3, 29); g.lineTo(29, 3); g.strokePath();
  // Top edge highlight
  g.fillStyle(0x9a6a30, 0.3);
  g.fillRect(1, 1, 30, 1);
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

    // Lid wood grain
    g.lineStyle(1, 0x9a6020, 0.2);
    for (let ly = 3; ly < lidHeight; ly += 3) {
      g.lineBetween(3, ly, w - 3, ly);
    }

    // Metallband horizontal
    g.fillStyle(0x3d2b1f, 1).fillRect(0, lidHeight + bandY, w, 4);
    // Metallband vertikal (Schlossbereich)
    g.fillRect(Math.floor(w / 2) - 2, lidHeight - 2, 4, baseHeight + 4);

    // Schloss / Verzierung — golden gleam
    g.fillStyle(0xe6c97d, 1).fillRect(Math.floor(w / 2) - 3, lidHeight + bandY - 2, 6, 6);
    g.fillRect(Math.floor(w / 2) - 1, lidHeight + bandY + 4, 2, 6);
    // Gleam highlight on lock
    g.fillStyle(0xfff0c0, 0.7);
    g.fillRect(Math.floor(w / 2) - 2, lidHeight + bandY - 1, 2, 2);

    // Highlights & Schatten
    g.lineStyle(1, 0xf2d9a0, 0.6).strokeRoundedRect(1, 1, w - 2, lidHeight, 5);
    g.lineStyle(1, 0x6e3f1b, 0.7).strokeRoundedRect(0, lidHeight, w, baseHeight, 4);

    // Gleam on lid — bright diagonal highlight
    g.fillStyle(0xffe8b0, 0.25);
    g.fillRect(4, 3, Math.floor(w * 0.4), 2);
    g.fillStyle(0xfff0c8, 0.15);
    g.fillRect(4, 5, Math.floor(w * 0.3), 1);

    // Kleine Nieten auf dem Band
    g.fillStyle(0xc9b075, 0.9);
    const spacing = Math.max(6, Math.floor(w / 6));
    for (let x = spacing; x < w; x += spacing) {
      g.fillCircle(x, lidHeight + bandY + 2, 1.2);
    }

    // Bottom shadow
    g.fillStyle(0x000000, 0.15);
    g.fillRect(2, lidHeight + baseHeight - 3, w - 4, 2);

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
  
  // rubble 32x24 — scattered stone rubble with shading
  g.clear();
  // Large chunks with highlight/shadow
  g.fillStyle(0x5a5a5a, 1);
  g.fillTriangle(4, 22, 12, 8, 20, 22);
  g.fillStyle(0x727272, 0.5);
  g.fillTriangle(6, 20, 12, 10, 14, 20);
  g.fillStyle(0x7e7e7e, 1);
  g.fillTriangle(14, 22, 22, 10, 30, 22);
  g.fillStyle(0x909090, 0.4);
  g.fillTriangle(16, 20, 22, 12, 24, 20);
  g.fillStyle(0x4e4e4e, 1);
  g.fillTriangle(8, 22, 16, 14, 24, 22);
  // Small scattered pebbles
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(2, 20, 2, 2); g.fillRect(26, 19, 3, 3);
  g.fillRect(18, 17, 2, 2); g.fillRect(10, 20, 2, 1);
  g.fillStyle(0x6e6e6e, 1);
  g.fillRect(28, 21, 2, 1); g.fillRect(1, 22, 1, 1);
  // Dust/debris marks
  g.fillStyle(0x4a4a4a, 0.3);
  g.fillCircle(12, 21, 4); g.fillCircle(22, 21, 3);
  // Crack detail on large chunk
  g.lineStyle(1, 0x3a3a3a, 0.5);
  g.beginPath(); g.moveTo(10, 12); g.lineTo(12, 18); g.strokePath();
  g.generateTexture('rubble', 32, 24);

  // altar 48x32 — ornate stone altar with carved details
  g.clear();
  // Legs with shadowed faces
  g.fillStyle(0x6a6a6a, 1);
  g.fillRoundedRect(8, 18, 8, 12, 2);
  g.fillRoundedRect(32, 18, 8, 12, 2);
  g.fillStyle(0x7e7e7e, 0.4);
  g.fillRect(8, 18, 4, 12); g.fillRect(32, 18, 4, 12);
  // Top slab — polished stone
  g.fillStyle(0x8c8c8c, 1);
  g.fillRoundedRect(2, 4, 44, 14, 4);
  // Top surface highlight
  g.fillStyle(0xa4a4a4, 0.4);
  g.fillRoundedRect(2, 4, 44, 6, 4);
  // Front face shadow
  g.fillStyle(0x5a5a5a, 0.3);
  g.fillRect(4, 14, 40, 4);
  // Carved border pattern
  g.lineStyle(1, 0xbcbcbc, 0.6);
  g.strokeRoundedRect(4, 5, 40, 12, 3);
  // Inner carved line
  g.lineStyle(1, 0x9a9a9a, 0.3);
  g.strokeRoundedRect(6, 7, 36, 8, 2);
  // Center symbol (diamond)
  g.fillStyle(0xc0c0c0, 0.4);
  g.fillTriangle(24, 7, 28, 11, 24, 15);
  g.fillTriangle(24, 7, 20, 11, 24, 15);
  // Corner accents
  g.fillStyle(0xaaaaaa, 0.5);
  g.fillRect(6, 7, 2, 2); g.fillRect(40, 7, 2, 2);
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

  // ===== Room-Theme Floor & Wall Variants =====

  // floor_stone_dark — darker variant with dampness and wear (32x32)
  g.clear();
  // Base with subtle banding
  g.fillStyle(0x333333, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(0x383838, 1);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(0x303030, 1);
  g.fillRect(16, 16, 16, 16);
  // Stone grain — 5 shades
  g.fillStyle(0x404040, 0.35);
  g.fillCircle(10, 10, 6); g.fillCircle(22, 8, 5);
  g.fillCircle(20, 20, 7); g.fillCircle(8, 22, 5);
  g.fillStyle(0x282828, 0.3);
  g.fillCircle(14, 14, 4); g.fillCircle(24, 18, 3); g.fillCircle(12, 24, 3);
  g.fillStyle(0x484848, 0.15);
  g.fillCircle(4, 28, 4); g.fillCircle(28, 4, 3);
  // Dampness stains (dark blue-gray)
  g.fillStyle(0x2a2a34, 0.2);
  g.fillCircle(8, 14, 5); g.fillCircle(24, 26, 4);
  // Mortar lines
  g.lineStyle(1, 0x222222, 0.4);
  g.lineBetween(0, 16, 32, 16); g.lineBetween(16, 0, 16, 32);
  // Wear marks
  g.fillStyle(0x1e1e1e, 0.2);
  g.fillRect(6, 10, 4, 1); g.fillRect(22, 22, 3, 1);
  // Speckles
  g.fillStyle(0x505050, 0.45);
  [[5,6],[7,17],[12,9],[15,23],[20,12],[23,27],[26,16],[28,7],[3,20],[18,2]].forEach(([px,py])=>{
    g.fillRect(px, py, 1, 1);
  });
  // Deep cracks
  g.lineStyle(1, 0x1a1a1a, 0.5);
  g.beginPath(); g.moveTo(6, 12); g.lineTo(10, 16); g.lineTo(8, 22); g.strokePath();
  g.beginPath(); g.moveTo(22, 4); g.lineTo(24, 10); g.lineTo(20, 16); g.strokePath();
  g.beginPath(); g.moveTo(26, 20); g.lineTo(28, 26); g.strokePath();
  g.generateTexture('floor_stone_dark', 32, 32);

  // floor_cobble — cobblestone with individual stone colors and worn edges (32x32)
  g.clear();
  // Deep mortar base
  g.fillStyle(0x3a3228, 1);
  g.fillRect(0, 0, 32, 32);
  // Individual cobblestones — each a different shade
  g.fillStyle(0x6a5e4e, 1);
  g.fillRoundedRect(1, 1, 14, 14, 3);
  g.fillStyle(0x746850, 1);
  g.fillRoundedRect(17, 1, 14, 14, 3);
  g.fillStyle(0x5e5444, 1);
  g.fillRoundedRect(1, 17, 14, 14, 3);
  g.fillStyle(0x6e6252, 1);
  g.fillRoundedRect(17, 17, 14, 14, 3);
  // Top-left highlight on each stone (3D)
  g.fillStyle(0x8a7e6e, 0.35);
  g.fillRect(2, 2, 12, 4); g.fillRect(18, 2, 12, 4);
  g.fillRect(2, 18, 12, 4); g.fillRect(18, 18, 12, 4);
  // Bottom-right shadow on each stone
  g.fillStyle(0x3e3828, 0.3);
  g.fillRect(2, 12, 12, 2); g.fillRect(18, 12, 12, 2);
  g.fillRect(2, 28, 12, 2); g.fillRect(18, 28, 12, 2);
  // Surface texture on stones
  g.fillStyle(0x7a6e5a, 0.2);
  g.fillCircle(6, 8, 3); g.fillCircle(23, 9, 2);
  g.fillCircle(8, 24, 2); g.fillCircle(25, 25, 3);
  g.fillStyle(0x4a4438, 0.2);
  g.fillCircle(10, 5, 2); g.fillCircle(26, 6, 2);
  // Mortar lines — deep and uneven
  g.lineStyle(2, 0x2e2820, 0.9);
  g.lineBetween(15, 0, 16, 32);
  g.lineBetween(0, 15, 32, 16);
  // Tiny pebbles in mortar
  g.fillStyle(0x5a5040, 0.5);
  g.fillRect(15, 4, 1, 1); g.fillRect(16, 20, 1, 1);
  g.fillRect(6, 15, 1, 1); g.fillRect(26, 16, 1, 1);
  // Wear/chip marks
  g.fillStyle(0x4e4638, 0.3);
  g.fillRect(4, 10, 2, 1); g.fillRect(22, 22, 3, 1);
  g.generateTexture('floor_cobble', 32, 32);

  // floor_tile_ornate — rich decorative tile with inlay pattern (32x32)
  g.clear();
  // Base — warm polished stone
  g.fillStyle(0x6a5a4a, 1);
  g.fillRect(0, 0, 32, 32);
  // Slight gradient for depth
  g.fillStyle(0x705e4e, 0.3);
  g.fillRect(0, 0, 32, 16);
  g.fillStyle(0x5e5040, 0.2);
  g.fillRect(0, 16, 32, 16);
  // Triple border pattern
  g.lineStyle(1, 0x8a7a5a, 0.6);
  g.strokeRect(1, 1, 30, 30);
  g.lineStyle(1, 0x9a8a6a, 0.5);
  g.strokeRect(3, 3, 26, 26);
  g.lineStyle(1, 0x7a6a4a, 0.3);
  g.strokeRect(5, 5, 22, 22);
  // Diamond inlay — two-tone
  g.fillStyle(0x7a6a52, 0.7);
  g.fillTriangle(16, 7, 25, 16, 16, 25);
  g.fillTriangle(16, 7, 7, 16, 16, 25);
  // Diamond highlight (lighter half)
  g.fillStyle(0x9a8a6a, 0.3);
  g.fillTriangle(16, 7, 7, 16, 16, 16);
  // Diamond shadow (darker half)
  g.fillStyle(0x5a4a3a, 0.2);
  g.fillTriangle(16, 16, 25, 16, 16, 25);
  // Center medallion
  g.fillStyle(0x8a7a62, 0.6);
  g.fillCircle(16, 16, 4);
  g.fillStyle(0xa09070, 0.3);
  g.fillCircle(16, 15, 2);
  // Corner rosettes
  g.fillStyle(0x9a8a6a, 0.5);
  [[3,3],[28,3],[3,28],[28,28]].forEach(([px,py])=>{
    g.fillCircle(px, py, 2);
  });
  g.fillStyle(0xaa9a7a, 0.3);
  [[3,3],[28,3]].forEach(([px,py])=>{
    g.fillRect(px-1, py-1, 1, 1);
  });
  // Subtle wear/patina
  g.fillStyle(0x4a3a2a, 0.2);
  g.fillCircle(10, 22, 3); g.fillCircle(24, 10, 2);
  // Grout line at edges
  g.lineStyle(1, 0x3e3428, 0.3);
  g.lineBetween(0, 0, 32, 0); g.lineBetween(0, 31, 32, 31);
  g.lineBetween(0, 0, 0, 32); g.lineBetween(31, 0, 31, 32);
  g.generateTexture('floor_tile_ornate', 32, 32);

  // wall_brick — warm brick wall with individual brick colors and 3D mortar (64x64)
  g.clear();
  g.fillStyle(0x5a3a2a, 1);
  g.fillRect(0, 0, 64, 64);
  // Brick rows with offset pattern and color variation
  const wbColors = [0x7a5a42, 0x7e5e46, 0x765640, 0x82624a, 0x745038];
  for (let by = 0; by < 64; by += 16) {
    const rowOffset = (Math.floor(by / 16) % 2) * 16;
    let ci = 0;
    for (let bx = -16 + rowOffset; bx < 64; bx += 32) {
      const x0 = Math.max(0, bx + 1);
      const x1 = Math.min(64, bx + 31);
      if (x1 <= x0) continue;
      const bc = wbColors[(ci + Math.floor(by / 16) * 2) % wbColors.length];
      ci++;
      // Brick face
      g.fillStyle(bc, 1);
      g.fillRect(x0, by + 1, x1 - x0, 14);
      // Top highlight
      g.fillStyle(0x9a7a5a, 0.35);
      g.fillRect(x0, by + 1, x1 - x0, 2);
      // Bottom shadow
      g.fillStyle(0x3a2218, 0.3);
      g.fillRect(x0, by + 13, x1 - x0, 2);
      // Surface noise
      g.fillStyle(0x8a6a50, 0.15);
      g.fillCircle(x0 + 8, by + 7, 3);
    }
  }
  // Mortar lines
  g.lineStyle(1, 0x3a2218, 0.9);
  for (let by = 0; by <= 64; by += 16) {
    g.lineBetween(0, by, 64, by);
  }
  // Vertical mortar
  g.lineStyle(1, 0x3a2218, 0.7);
  for (let by = 0; by < 64; by += 16) {
    const rowOffset = (Math.floor(by / 16) % 2) * 16;
    for (let bx = -16 + rowOffset; bx < 80; bx += 32) {
      if (bx > 0 && bx < 64) g.lineBetween(bx, by, bx, by + 16);
    }
  }
  // Cracks
  g.lineStyle(1, 0x2a1a10, 0.6);
  g.beginPath(); g.moveTo(20, 8); g.lineTo(24, 24); g.lineTo(18, 40); g.strokePath();
  g.beginPath(); g.moveTo(48, 20); g.lineTo(44, 36); g.strokePath();
  // Soot/stain
  g.fillStyle(0x3a2a1a, 0.15);
  g.fillCircle(40, 56, 6);
  g.generateTexture('wall_brick', 64, 64);

  // wall_stone_large — massive cut stone blocks with chisel marks (64x64)
  g.clear();
  // Mortar base
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(0, 0, 64, 64);
  // Four large blocks — each slightly different shade
  const wslColors = [0x828282, 0x8a8a8a, 0x7e7e7e, 0x868686];
  const wslBlocks = [[1,1,30,30],[33,1,30,30],[1,33,30,30],[33,33,30,30]];
  wslBlocks.forEach(([bx,by,bw,bh], i) => {
    g.fillStyle(wslColors[i], 1);
    g.fillRect(bx, by, bw, bh);
    // Top-edge highlight
    g.fillStyle(0xa0a0a0, 0.35);
    g.fillRect(bx, by, bw, 3);
    // Left-edge highlight
    g.fillStyle(0x969696, 0.2);
    g.fillRect(bx, by, 3, bh);
    // Bottom-edge shadow
    g.fillStyle(0x4e4e4e, 0.35);
    g.fillRect(bx, by + bh - 3, bw, 3);
    // Right-edge shadow
    g.fillStyle(0x565656, 0.2);
    g.fillRect(bx + bw - 3, by, 3, bh);
    // Chisel texture — rough surface marks
    g.fillStyle(0x6a6a6a, 0.2);
    g.fillCircle(bx + 10, by + 10, 4);
    g.fillCircle(bx + 20, by + 18, 3);
    g.fillStyle(0x929292, 0.15);
    g.fillCircle(bx + 8, by + 22, 3);
  });
  // Deep mortar joints
  g.lineStyle(2, 0x3a3a3a, 1);
  g.lineBetween(31, 0, 32, 64);
  g.lineBetween(0, 31, 64, 32);
  // Joint highlight (top edge of mortar)
  g.lineStyle(1, 0x5e5e5e, 0.3);
  g.lineBetween(0, 30, 64, 30);
  g.lineBetween(30, 0, 30, 64);
  // Minor crack
  g.lineStyle(1, 0x3e3e3e, 0.4);
  g.beginPath(); g.moveTo(44, 4); g.lineTo(48, 16); g.strokePath();
  g.generateTexture('wall_stone_large', 64, 64);

  // wall_dungeon — oppressive dark dungeon stone with moss and damp (64x64)
  g.clear();
  g.fillStyle(0x2e2e2e, 1);
  g.fillRect(0, 0, 64, 64);
  // Rough stone blocks with individual shading
  const wdColors = [0x3e3e3e, 0x424242, 0x3a3a3a, 0x444444, 0x383838, 0x404040, 0x3c3c3c, 0x464646];
  let wdci = 0;
  for (let by = 0; by < 64; by += 16) {
    const rowOff = (Math.floor(by / 16) % 2) * 16;
    for (let bx = -16 + rowOff; bx < 64; bx += 32) {
      const x0 = Math.max(0, bx + 1);
      const x1 = Math.min(64, bx + 31);
      if (x1 <= x0) continue;
      g.fillStyle(wdColors[wdci % wdColors.length], 1);
      wdci++;
      g.fillRect(x0, by + 1, x1 - x0, 14);
      // Top highlight
      g.fillStyle(0x505050, 0.25);
      g.fillRect(x0, by + 1, x1 - x0, 2);
      // Bottom shadow
      g.fillStyle(0x1a1a1a, 0.3);
      g.fillRect(x0, by + 13, x1 - x0, 2);
    }
  }
  // Mortar
  g.lineStyle(1, 0x1e1e1e, 1);
  for (let by = 0; by <= 64; by += 16) {
    g.lineBetween(0, by, 64, by);
  }
  // Vertical mortar
  for (let by = 0; by < 64; by += 16) {
    const rowOff = (Math.floor(by / 16) % 2) * 16;
    for (let bx = -16 + rowOff; bx < 80; bx += 32) {
      if (bx > 0 && bx < 64) g.lineBetween(bx, by, bx, by + 16);
    }
  }
  // Heavy moss patches
  g.fillStyle(0x2a4a2a, 0.45);
  g.fillCircle(8, 48, 7); g.fillCircle(52, 56, 6); g.fillCircle(28, 60, 5);
  g.fillCircle(40, 50, 4); g.fillCircle(16, 58, 5);
  g.fillStyle(0x1a3a1a, 0.35);
  g.fillCircle(12, 52, 5); g.fillCircle(56, 60, 4); g.fillCircle(4, 60, 4);
  g.fillStyle(0x336633, 0.15);
  g.fillCircle(30, 54, 8);
  // Cracks — deep and jagged
  g.lineStyle(1, 0x141414, 0.8);
  g.beginPath(); g.moveTo(10, 3); g.lineTo(14, 18); g.lineTo(8, 32); g.lineTo(12, 44); g.strokePath();
  g.beginPath(); g.moveTo(50, 8); g.lineTo(46, 24); g.lineTo(52, 40); g.strokePath();
  g.beginPath(); g.moveTo(34, 12); g.lineTo(30, 22); g.strokePath();
  // Water stains — damp gradient at bottom
  g.fillStyle(0x222230, 0.25);
  g.fillRect(0, 46, 64, 18);
  g.fillStyle(0x1e1e2a, 0.15);
  g.fillRect(0, 38, 64, 10);
  // Drip marks
  g.lineStyle(1, 0x202030, 0.2);
  g.lineBetween(20, 30, 20, 50); g.lineBetween(44, 26, 44, 48);
  g.generateTexture('wall_dungeon', 64, 64);

  // Floor detail textures for atmospheric scatter
  // crack_detail 8x8
  g.clear();
  g.lineStyle(1, 0x222222, 0.6);
  g.beginPath(); g.moveTo(1, 2); g.lineTo(4, 5); g.lineTo(7, 3); g.strokePath();
  g.generateTexture('floor_crack', 8, 8);

  // stain_detail 10x10
  g.clear();
  g.fillStyle(0x3a3a2a, 0.3);
  g.fillCircle(5, 5, 4);
  g.fillStyle(0x2a2a1a, 0.2);
  g.fillCircle(5, 5, 2);
  g.generateTexture('floor_stain', 10, 10);

  // ===== NEW TEXTURES =====

  // floor_blood (32x32) — blood-stained stone floor variant
  g.clear();
  // Same stone base as floor_stone
  g.fillStyle(0x585858, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(0x5e5e5e, 1);
  g.fillRect(0, 0, 32, 16);
  // Stone grain
  g.fillStyle(0x6a6a6a, 0.3);
  g.fillCircle(10, 10, 5); g.fillCircle(22, 20, 6);
  g.fillStyle(0x4a4a4a, 0.2);
  g.fillCircle(14, 14, 4);
  // Mortar lines
  g.lineStyle(1, 0x3e3e3e, 0.3);
  g.lineBetween(0, 16, 32, 16); g.lineBetween(16, 0, 16, 32);
  // Blood stains — dark crimson pools
  g.fillStyle(0x4a1010, 0.6);
  g.fillCircle(12, 14, 7);
  g.fillStyle(0x5a1818, 0.5);
  g.fillCircle(18, 18, 5);
  g.fillStyle(0x3a0808, 0.4);
  g.fillCircle(8, 20, 4);
  // Blood splatter
  g.fillStyle(0x6a2020, 0.35);
  g.fillCircle(22, 10, 3); g.fillCircle(26, 16, 2);
  g.fillRect(14, 8, 2, 1); g.fillRect(20, 24, 1, 2);
  // Dried blood — darker edges
  g.fillStyle(0x2a0808, 0.3);
  g.fillCircle(12, 16, 4);
  g.generateTexture('floor_blood', 32, 32);

  // wall_mossy (64x64) — wall with heavy moss/vine growth
  g.clear();
  // Stone base
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(0, 0, 64, 64);
  // Block pattern
  for (let by = 0; by < 64; by += 16) {
    const rowOff = (Math.floor(by / 16) % 2) * 16;
    for (let bx = -16 + rowOff; bx < 64; bx += 32) {
      const x0 = Math.max(0, bx + 1);
      const x1 = Math.min(64, bx + 31);
      if (x1 <= x0) continue;
      g.fillStyle(0x565656, 1);
      g.fillRect(x0, by + 1, x1 - x0, 14);
    }
  }
  // Mortar
  g.lineStyle(1, 0x2a2a2a, 0.8);
  for (let by = 0; by <= 64; by += 16) g.lineBetween(0, by, 64, by);
  g.lineBetween(32, 0, 32, 64); g.lineBetween(16, 16, 16, 32); g.lineBetween(48, 0, 48, 16); g.lineBetween(48, 32, 48, 48);
  // Heavy moss covering — large patches
  g.fillStyle(0x2a5a2a, 0.5);
  g.fillCircle(10, 12, 10); g.fillCircle(30, 20, 12); g.fillCircle(50, 16, 8);
  g.fillCircle(16, 40, 10); g.fillCircle(44, 44, 12); g.fillCircle(8, 56, 8);
  g.fillStyle(0x1e4a1e, 0.4);
  g.fillCircle(20, 16, 8); g.fillCircle(40, 28, 9); g.fillCircle(56, 52, 7);
  g.fillCircle(24, 48, 8);
  // Vine lines
  g.lineStyle(2, 0x1a3a1a, 0.6);
  g.beginPath(); g.moveTo(4, 0); g.lineTo(8, 16); g.lineTo(6, 32); g.lineTo(10, 48); g.lineTo(6, 64); g.strokePath();
  g.beginPath(); g.moveTo(36, 0); g.lineTo(32, 20); g.lineTo(38, 40); g.lineTo(34, 64); g.strokePath();
  g.beginPath(); g.moveTo(56, 0); g.lineTo(52, 24); g.lineTo(58, 48); g.lineTo(54, 64); g.strokePath();
  // Vine leaves (small green dots along vines)
  g.fillStyle(0x3a6a2a, 0.5);
  [[6,10],[8,26],[10,42],[7,58],[34,8],[32,30],[36,50],[54,12],[52,36],[56,56]].forEach(([px,py])=>{
    g.fillCircle(px, py, 3);
  });
  // Lighter moss highlights
  g.fillStyle(0x4a8a3a, 0.2);
  g.fillCircle(12, 10, 4); g.fillCircle(32, 18, 5); g.fillCircle(48, 42, 4);
  g.generateTexture('wall_mossy', 64, 64);

  // torch_glow (48x48) — warm light circle for behind braziers
  g.clear();
  // Outer warm glow — mostly transparent
  g.fillStyle(0xff8800, 0.05);
  g.fillCircle(24, 24, 24);
  g.fillStyle(0xffaa22, 0.08);
  g.fillCircle(24, 24, 20);
  g.fillStyle(0xffcc44, 0.12);
  g.fillCircle(24, 24, 14);
  g.fillStyle(0xffdd66, 0.18);
  g.fillCircle(24, 24, 8);
  g.fillStyle(0xffee88, 0.22);
  g.fillCircle(24, 24, 4);
  g.generateTexture('torch_glow', 48, 48);

  // cobweb (32x32) — spider web on transparent background
  g.clear();
  // Radial threads from top-left corner
  g.lineStyle(1, 0xdddddd, 0.35);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(30, 8); g.strokePath();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 16); g.strokePath();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(20, 24); g.strokePath();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 28); g.strokePath();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(4, 30); g.strokePath();
  // Cross threads (arcs approximated with lines)
  g.lineStyle(1, 0xcccccc, 0.2);
  g.beginPath(); g.moveTo(10, 2); g.lineTo(8, 6); g.lineTo(5, 8); g.lineTo(2, 10); g.strokePath();
  g.beginPath(); g.moveTo(20, 5); g.lineTo(16, 10); g.lineTo(10, 14); g.lineTo(6, 16); g.lineTo(3, 18); g.strokePath();
  g.beginPath(); g.moveTo(28, 10); g.lineTo(22, 18); g.lineTo(14, 22); g.lineTo(8, 24); g.lineTo(4, 26); g.strokePath();
  // Tiny dew drops
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(14, 6, 1, 1); g.fillRect(8, 14, 1, 1); g.fillRect(20, 12, 1, 1);
  g.generateTexture('cobweb', 32, 32);

  g.destroy();
}

function createParticleTextures() {
  // Hard-edge particle: 8x8 white filled circle
  const g = this.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('particle', 8, 8);
  g.clear();

  // Soft-edge particle: 8x8 with gradient feel (layered circles)
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(4, 4, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(4, 4, 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 1);
  g.generateTexture('particle_soft', 8, 8);

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

  // 3) Brute (Panzer-Typ) - OLD GENERATED GRAPHICS (commented out, using sprite sheets now)
  /*
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
  */
  // Brute now uses loaded sprites: brute_left0, brute_right0 (idle/walk), brute_left1/2, brute_right1/2 (attack)
  // Default texture for spawning uses brute_right0
  if (this.textures.exists('brute_right0')) {
    // Create enemyBrute as alias to brute_right0 for initial spawn compatibility
    if (!this.textures.exists('enemyBrute')) {
      this.textures.addImage('enemyBrute', this.textures.get('brute_right0').getSourceImage());
    }
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

  // 5) Schattenschleicher (Shadow Creeper) - small dark purple with darker core
  {
    const g = this.add.graphics();
    // Outer body - dark purple
    g.fillStyle(0x3a0050, 1);
    g.fillCircle(24, 24, 18);
    // Darker core
    g.fillStyle(0x1a0028, 1);
    g.fillCircle(24, 24, 10);
    // Glowing eyes
    g.fillStyle(0xcc00ff, 1);
    g.fillCircle(20, 20, 3);
    g.fillCircle(28, 20, 3);
    // Wispy tendrils
    g.lineStyle(1, 0x5500aa, 0.6);
    g.beginPath();
    g.moveTo(10, 30); g.lineTo(6, 38); g.strokePath();
    g.beginPath();
    g.moveTo(38, 30); g.lineTo(42, 38); g.strokePath();
    g.generateTexture('enemyShadow', 48, 48);
    g.destroy();
  }

  // 6) Kettenwächter (Chain Guard) - large gray with shield overlay
  {
    const g = this.add.graphics();
    // Large body - dark gray
    g.fillStyle(0x444444, 1);
    g.fillCircle(40, 40, 32);
    // Armor plates
    g.fillStyle(0x666666, 1);
    g.fillCircle(40, 40, 24);
    // Shield overlay - lighter
    g.fillStyle(0x888888, 0.7);
    g.fillCircle(40, 32, 16);
    // Shield cross pattern
    g.lineStyle(2, 0xaaaaaa, 0.8);
    g.lineBetween(40, 18, 40, 46);
    g.lineBetween(28, 32, 52, 32);
    // Eyes behind helmet
    g.fillStyle(0xff4444, 1);
    g.fillCircle(34, 36, 3);
    g.fillCircle(46, 36, 3);
    g.generateTexture('enemyChainGuard', 80, 80);
    g.destroy();
  }

  // 7) Flammenweber (Flame Weaver) - medium orange with red center
  {
    const g = this.add.graphics();
    // Outer flames - orange
    g.fillStyle(0xff6600, 1);
    g.fillCircle(32, 32, 22);
    // Inner fire - red
    g.fillStyle(0xcc0000, 1);
    g.fillCircle(32, 32, 12);
    // Bright core
    g.fillStyle(0xffaa00, 1);
    g.fillCircle(32, 32, 6);
    // Flame wisps
    g.fillStyle(0xff8800, 0.6);
    g.fillTriangle(32, 6, 28, 16, 36, 16);
    g.fillTriangle(10, 28, 18, 24, 18, 32);
    g.fillTriangle(54, 28, 46, 24, 46, 32);
    // Eyes
    g.fillStyle(0xffff00, 1);
    g.fillCircle(28, 28, 3);
    g.fillCircle(36, 28, 3);
    g.generateTexture('enemyFlameWeaver', 64, 64);
    g.destroy();
  }

  // ===== Boss Textures =====

  // Boss 1 - Kettenmeister (Chain Master): large gray figure with chain patterns
  {
    const g = this.add.graphics();
    // Large body - dark gray/silver
    g.fillStyle(0x555555, 1);
    g.fillRect(16, 12, 48, 56);
    // Shoulders - broad armor plates
    g.fillStyle(0x777777, 1);
    g.fillRect(8, 16, 16, 16);
    g.fillRect(56, 16, 16, 16);
    // Helmet
    g.fillStyle(0x888888, 1);
    g.fillRect(24, 2, 32, 18);
    g.fillStyle(0x444444, 1);
    g.fillRect(28, 8, 24, 6); // visor slit
    // Eyes behind visor - red glow
    g.fillStyle(0xff3333, 1);
    g.fillCircle(34, 10, 2);
    g.fillCircle(46, 10, 2);
    // Chain patterns across body - horizontal links
    g.lineStyle(2, 0xaaaaaa, 0.9);
    for (let cy = 24; cy < 64; cy += 10) {
      g.strokeCircle(30, cy, 4);
      g.strokeCircle(38, cy, 4);
      g.strokeCircle(46, cy, 4);
    }
    // Chain whip in right hand
    g.lineStyle(3, 0xcccccc, 1);
    g.beginPath();
    g.moveTo(64, 28); g.lineTo(72, 36); g.lineTo(68, 44); g.lineTo(74, 52);
    g.strokePath();
    // Legs
    g.fillStyle(0x444444, 1);
    g.fillRect(22, 68, 14, 12);
    g.fillRect(44, 68, 14, 12);
    g.generateTexture('bossChainMaster', 80, 80);
    g.destroy();
  }

  // Boss 2 - Zeremonienmeister (Ceremony Master): purple robed figure with ritual symbols
  {
    const g = this.add.graphics();
    // Robe - dark purple/red
    g.fillStyle(0x440044, 1);
    g.fillRect(16, 20, 48, 52);
    // Robe hem - darker
    g.fillStyle(0x330022, 1);
    g.fillRect(12, 56, 56, 16);
    // Hood - deep purple
    g.fillStyle(0x550055, 1);
    g.fillRect(20, 2, 40, 24);
    g.fillStyle(0x330033, 1);
    g.fillRect(24, 8, 32, 14); // face shadow
    // Glowing eyes - yellow/orange
    g.fillStyle(0xffaa00, 1);
    g.fillCircle(32, 14, 3);
    g.fillCircle(48, 14, 3);
    // Ritual symbols on robe
    g.lineStyle(1, 0xff0066, 0.8);
    g.strokeCircle(40, 40, 10);
    g.strokeCircle(40, 40, 6);
    // Pentagram-like star
    g.beginPath();
    g.moveTo(40, 30); g.lineTo(44, 46); g.lineTo(32, 36); g.lineTo(48, 36); g.lineTo(36, 46); g.lineTo(40, 30);
    g.strokePath();
    // Hands with magic glow
    g.fillStyle(0xff0066, 0.6);
    g.fillCircle(14, 40, 6);
    g.fillCircle(66, 40, 6);
    // Staff
    g.fillStyle(0x220011, 1);
    g.fillRect(68, 10, 4, 58);
    g.fillStyle(0xff0066, 1);
    g.fillCircle(70, 10, 5);
    g.generateTexture('bossCeremonyMaster', 80, 80);
    g.destroy();
  }

  // Boss 3 - Schattenrat (Shadow Councillor): dark figure with glowing red accents
  {
    const g = this.add.graphics();
    // Body - pure black
    g.fillStyle(0x111111, 1);
    g.fillRect(18, 16, 44, 52);
    // Cloak billowing
    g.fillStyle(0x0a0a0a, 1);
    g.fillTriangle(10, 20, 18, 16, 14, 68);
    g.fillTriangle(70, 20, 62, 16, 66, 68);
    // Hood
    g.fillStyle(0x080808, 1);
    g.fillRect(22, 2, 36, 22);
    // Face is void - just eyes
    g.fillStyle(0x050505, 1);
    g.fillRect(26, 6, 28, 14);
    // Glowing red eyes - prominent
    g.fillStyle(0xff0000, 1);
    g.fillCircle(34, 12, 4);
    g.fillCircle(46, 12, 4);
    // Inner eye glow
    g.fillStyle(0xff4444, 0.6);
    g.fillCircle(34, 12, 6);
    g.fillCircle(46, 12, 6);
    // Red energy veins across body
    g.lineStyle(1, 0xcc0000, 0.7);
    g.beginPath();
    g.moveTo(30, 24); g.lineTo(26, 40); g.lineTo(30, 56); g.strokePath();
    g.beginPath();
    g.moveTo(50, 24); g.lineTo(54, 40); g.lineTo(50, 56); g.strokePath();
    g.beginPath();
    g.moveTo(34, 30); g.lineTo(46, 30); g.strokePath();
    g.beginPath();
    g.moveTo(32, 44); g.lineTo(48, 44); g.strokePath();
    // Shadow wisps at base
    g.fillStyle(0x1a0000, 0.5);
    g.fillEllipse(40, 68, 50, 10);
    g.generateTexture('bossShadowCouncillor', 80, 80);
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
    // Potion icons (4 tiers, progressively more vibrant)
    {
      key: 'itPotionMinor',
      draw: () => {
        g.fillStyle(0x444444, 1); g.fillRect(18, 8, 12, 4); // cork
        g.fillStyle(0x8B0000, 1); g.fillRoundedRect(14, 12, 20, 28, 4); // bottle
        g.fillStyle(0xCC2222, 0.6); g.fillRoundedRect(18, 16, 12, 18, 2); // liquid
      }
    },
    {
      key: 'itPotionNormal',
      draw: () => {
        g.fillStyle(0x444444, 1); g.fillRect(18, 6, 12, 4);
        g.fillStyle(0xCC0000, 1); g.fillRoundedRect(12, 10, 24, 32, 5);
        g.fillStyle(0xFF3333, 0.6); g.fillRoundedRect(16, 14, 16, 22, 3);
      }
    },
    {
      key: 'itPotionMajor',
      draw: () => {
        g.fillStyle(0x666666, 1); g.fillRect(18, 4, 12, 4);
        g.fillStyle(0xEE0000, 1); g.fillRoundedRect(10, 8, 28, 34, 6);
        g.fillStyle(0xFF4444, 0.7); g.fillRoundedRect(14, 12, 20, 24, 4);
        g.fillStyle(0xFFAAAA, 0.4); g.fillCircle(20, 18, 4); // shine
      }
    },
    {
      key: 'itPotionSuper',
      draw: () => {
        g.fillStyle(0xFFD700, 1); g.fillRect(16, 2, 16, 5); // gold cork
        g.fillStyle(0xFF0000, 1); g.fillRoundedRect(8, 7, 32, 36, 7);
        g.fillStyle(0xFF5555, 0.7); g.fillRoundedRect(12, 11, 24, 26, 5);
        g.fillStyle(0xFFCCCC, 0.5); g.fillCircle(20, 16, 5); // shine
        g.fillStyle(0xFFD700, 0.8); g.fillCircle(28, 14, 3); // sparkle
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

// WP03: procedural goldPile sprite (stack of coins). Drawn small so it reads
// clearly on the dungeon floor without competing with item loot.
function createGoldPileGraphics() {
  if (!this || !this.add || !this.add.graphics) return;
  if (this.textures && typeof this.textures.exists === 'function' && this.textures.exists('goldPile')) {
    return;
  }
  const g = this.add.graphics();
  // Base shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(12, 15, 18, 6);
  // Coin pile (3 stacked coins, rim + highlight)
  const coinColors = [0xffd166, 0xffe89a, 0xffd166];
  for (let i = 0; i < 3; i++) {
    g.fillStyle(coinColors[i], 1);
    g.fillCircle(12, 13 - i * 3, 7 - i);
    g.lineStyle(1, 0xb89030, 0.85);
    g.strokeCircle(12, 13 - i * 3, 7 - i);
  }
  // Specular highlight
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(10, 5, 1.5);
  g.generateTexture('goldPile', 24, 20);
  g.destroy();
}
if (typeof window !== 'undefined') {
  window.createGoldPileGraphics = createGoldPileGraphics;
}
