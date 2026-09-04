function createObstacleGraphics() {
  // Cache guard: skip if textures already exist (037-mobile-performance)
  if (this.textures.exists('floor_stone') && this.textures.exists('obstacleWall')) return;

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
  // Körper
  const cx = 12, cy = 16; // Mittelpunkt

  // Holzkörper
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

  // Metallbänder (gefüllt für 3D-Feeling)
  g.fillStyle(0x3d2c1a, 1);
  g.fillEllipse(cx, cy - 5, 18, 6);
  g.fillEllipse(cx, cy + 5, 18, 6);

  // Kanten der Bänder leicht betonen
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

// #117-Nachtrag: Die Waffensymbole waren zu SCHMAL — fünf von acht blieben
// unter 25 von 48 Pixeln Breite und liessen seitlich mehr als die halbe Kachel
// leer. Statt jede einzelne Zahl in jeder Zeichenroutine nachzuziehen (und dabei
// die mühsam abgestimmten Proportionen zu zerlegen), bekommt jedes Symbol einen
// eigenen Streckfaktor um die Kachelmitte.
//
// X wird stärker gestreckt als Y, weil nur die Breite fehlte: die Höhen waren
// schon in Ordnung, und das Richtschwert stand mit 46 von 48 ohnehin am Anschlag.
//
// WICHTIG — die Faktoren sind mit Absicht VERSCHIEDEN, nicht aus Nachlässigkeit:
// Dolch < Kurzschwert < Axt < Hammer < Richtschwert ist die gewollte Rangfolge.
// Die Grösse selbst trägt die Erkennbarkeit im 48x48-Slot — der Dolch soll klein
// und tief sitzen, das Richtschwert die Kachel füllen. Wer hier später einen
// gemeinsamen Faktor "sauber glattzieht", nimmt dem Inventar genau diesen
// Kontrast. tests/waffenSymbole.test.js hält die Rangfolge deshalb fest.
function gestrecktesZeichnen(g, sx, sy, dx, dy) {
  const P = 24;                               // Kachelmitte (SIZE / 2)
  const vx = dx || 0, vy = dy || 0;
  const X = (x) => P + (x - P) * sx + vx;
  const Y = (y) => P + (y - P) * sy + vy;
  const L = (w) => w * (sx + sy) / 2;         // Linien bleiben rund, kein Ei
  const w = {
    fillStyle: (c, a) => { g.fillStyle(c, a); return w; },
    lineStyle: (lw, c, a) => { g.lineStyle(L(lw), c, a); return w; },
    fillRect: (x, y, bw, bh) => { g.fillRect(X(x), Y(y), bw * sx, bh * sy); return w; },
    fillRoundedRect: (x, y, bw, bh, r) => {
      g.fillRoundedRect(X(x), Y(y), bw * sx, bh * sy, r * Math.min(sx, sy)); return w;
    },
    strokeRoundedRect: (x, y, bw, bh, r) => {
      g.strokeRoundedRect(X(x), Y(y), bw * sx, bh * sy, r * Math.min(sx, sy)); return w;
    },
    // Kreise werden VERSCHOBEN wie alles andere, wachsen aber RUND (Mittel aus
    // beiden Faktoren): ein zum Ei gezogener Knauf oder eine ovale Niete fiele
    // sofort als Fehler auf, während ein zu schmaler Knauf neben der
    // verbreiterten Klinge nur mickrig wirkt.
    fillCircle: (x, y, r) => { g.fillCircle(X(x), Y(y), L(r)); return w; },
    fillEllipse: (x, y, bw, bh) => { g.fillEllipse(X(x), Y(y), bw * sx, bh * sy); return w; },
    fillTriangle: (x1, y1, x2, y2, x3, y3) => {
      g.fillTriangle(X(x1), Y(y1), X(x2), Y(y2), X(x3), Y(y3)); return w;
    },
    beginPath: () => { g.beginPath(); return w; },
    closePath: () => { g.closePath(); return w; },
    moveTo: (x, y) => { g.moveTo(X(x), Y(y)); return w; },
    lineTo: (x, y) => { g.lineTo(X(x), Y(y)); return w; },
    strokePath: () => { g.strokePath(); return w; },
    // ARC fehlte: der Helfer wurde fuer die sechs Nahkampfsymbole gebaut, und
    // die zeichnen keine Boegen. Der Bogen tut es — ohne diesen Eintrag warf
    // er "g.arc is not a function", sobald er gestreckt werden sollte.
    //
    // Ein ungleich gestreckter Kreisbogen ist ein ELLIPSENbogen, den Phaser
    // Graphics nicht direkt kann. Deshalb als Streckenzug annaehern: 20
    // Stuetzpunkte sind bei 48 px Kachelgroesse nicht mehr unterscheidbar.
    arc: (x, y, r, a1, a2, gegen) => {
      const N = 20;
      let b1 = a1, b2 = a2;
      if (gegen && b2 > b1) b2 -= Math.PI * 2;
      for (let k = 0; k <= N; k++) {
        const a = b1 + (b2 - b1) * (k / N);
        const px = X(x + Math.cos(a) * r);
        const py = Y(y + Math.sin(a) * r);
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      return w;
    }
  };
  return w;
}

function createItemGraphics() {
  const g = this.add.graphics();
  // Rohes Graphics-Objekt für die gestreckten Waffensymbole (siehe
  // gestrecktesZeichnen): dort verdeckt ein lokales `g` dieses hier.
  const gBasis = g;
  const SIZE = 48;

  // --- Bausteine fuer die Ausruestungs-Symbole (#125) -----------------------
  //
  // Vierzehn Amulette teilten sich EIN Bild, dazu je drei Helme, Ruestungen und
  // Stiefel und vier Boegen — 27 von 33 Basen waren im Inventar nicht
  // auseinanderzuhalten. Die Faelle unten geben jeder Basis eine eigene
  // Silhouette.
  //
  // Drei Lagen, wie schon bei den Fund-Texturen (#113): dunkle Grundform als
  // Umriss, darauf die Flaeche, darauf EINE helle Lichtkante plus ein
  // Glanzpunkt. Ohne diese drei Lagen wirkt alles flach. Und: die Form muss
  // schon in Graustufen tragen — Farbe ist die Zugabe, nicht die Auskunft.

  /** Die Kette, an der jedes Amulett haengt. Bei allen gleich — sie ist der
   *  gemeinsame Rahmen, vor dem der Anhaenger auffaellt. */
  const amuKette = () => {
    const cx = SIZE / 2;
    g.fillStyle(0x8a6a20, 1);
    g.fillRect(cx - 11, 9, 3, 3); g.fillRect(cx + 8, 9, 3, 3);
    g.fillRect(cx - 8, 13, 3, 3); g.fillRect(cx + 5, 13, 3, 3);
    g.fillStyle(0xd4a030, 1);
    g.fillRect(cx - 11, 9, 3, 1.4); g.fillRect(cx + 8, 9, 3, 1.4);
    g.fillRect(cx - 5, 17, 10, 2.5);
    g.fillStyle(0xf0d48a, 0.8); g.fillRect(cx - 5, 17, 10, 1);
  };

  /** Grundform des Anhaengers: dunkler Umriss + Flaeche + Lichtkante oben. */
  const amuScheibe = (r, aussen, innen, licht) => {
    const cx = SIZE / 2, cy = 31;
    g.fillStyle(0x120e18, 1); g.fillCircle(cx, cy, r + 1.5);
    g.fillStyle(aussen, 1); g.fillCircle(cx, cy, r);
    g.fillStyle(innen, 1); g.fillCircle(cx, cy, r - 3);
    g.fillStyle(licht, 0.55); g.fillEllipse(cx - r * 0.3, cy - r * 0.45, r * 0.8, r * 0.4);
  };

  /**
   * Ein gefuellter Bogenschenkel (Sichel) statt einer gezogenen Linie.
   *
   * Die erste Fassung der Boegen bestand aus lineStyle+arc. Eine Linie hat
   * keine Dicke, die man staffeln kann — also kein dunkler Umriss, keine
   * Lichtkante, kein Koerper. Sie sahen aus wie ein Draht. Hier wird der
   * Schenkel als geschlossene Flaeche zwischen zwei Radien gezogen; darauf
   * lassen sich dieselben drei Lagen legen wie bei allem anderen.
   */
  const bogenSichel = (mx, my, r, dicke, a0, a1, farbe, deckung) => {
    const N = 18;
    g.fillStyle(farbe, deckung === undefined ? 1 : deckung);
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * (i / N);
      const x = mx + Math.cos(a) * r, y = my + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    for (let i = N; i >= 0; i--) {
      const a = a0 + (a1 - a0) * (i / N);
      g.lineTo(mx + Math.cos(a) * (r - dicke), my + Math.sin(a) * (r - dicke));
    }
    g.fillPath();
  };

  /** Sehne und Nocken — bei jedem Bogen gleich, sie machen ihn erst zum Bogen. */
  const bogenSehne = (x, y0, y1, farbe) => {
    g.fillStyle(0x14121a, 1); g.fillRect(x - 1.5, y0, 3, y1 - y0);
    g.fillStyle(farbe === undefined ? 0xe8e0cc : farbe, 0.95);
    g.fillRect(x - 0.7, y0, 1.4, y1 - y0);
  };

  /** Ein Glanzpunkt — die letzte Lage, ohne die alles stumpf bleibt. */
  const glanz = (x, y, r, farbe) => {
    g.fillStyle(farbe === undefined ? 0xffffff : farbe, 0.85);
    g.fillCircle(x, y, r === undefined ? 1.6 : r);
  };

  const icons = [
    {
      key: 'itWeapon',
      draw: () => {
        const cx = SIZE / 2;
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRect(cx - 2, 8, 8, 28);
        // Blade base (slightly richer steel)
        g.fillStyle(0xc8cdd2, 1);
        g.fillRect(cx - 4, 6, 8, 26);
        // Blade mid sheen
        g.fillStyle(0xe8edf2, 1);
        g.fillRect(cx - 2, 6, 4, 26);
        // Blade edge accent
        g.fillStyle(0xf8fcff, 0.7);
        g.fillRect(cx - 1, 6, 2, 26);
        // Guard (warm gold)
        g.fillStyle(0xd4a030, 1);
        g.fillRect(cx - 10, 24, 20, 4);
        // Guard highlight
        g.fillStyle(0xffe080, 0.5);
        g.fillRect(cx - 9, 24, 18, 2);
        // Grip
        g.fillStyle(0x5c3318, 1);
        g.fillRect(cx - 2, 28, 4, 12);
        // Pommel
        g.fillStyle(0xd4a030, 1);
        g.fillCircle(cx, 40, 4);
        // Top-left highlight
        g.fillStyle(0xffffff, 0.40);
        g.fillRect(cx - 3, 7, 2, 6);
      }
    },

    // --- #117: waffentypische Symbole ---------------------------------------
    // Sechs eigene Umrisse statt eines Sammel-Icons. Der Spieler soll die
    // Waffenart am UMRISS erkennen, nicht am Namen — im 48x48-Inventarslot ist
    // die Silhouette das Einzige, was auf einen Blick ankommt. Deshalb tragen
    // Länge, Breite und Lage der Masse den Charakter (kurz/schmal beim Dolch,
    // ein schwerer Block beim Hammer, schräg beim Morgenstern) und nicht bloss
    // die Farbe.
    // `itWeapon` oben bleibt absichtlich stehen: es ist der Rückfall für Waffen
    // ohne erkannten iconKey (FALLBACK_ITEM_ICONS in js/inventory.js) und darf
    // deshalb nie verschwinden.
    {
      key: 'itSword',
      draw: () => {
        // Bezugsgrösse der Rangfolge (siehe gestrecktesZeichnen).
        const g = gestrecktesZeichnen(gBasis, 1.45, 1.0, 0, -1);
        const cx = SIZE / 2;
        // Eisenklinge — schlichtes Kurzschwert. Bewusst die Mitte des Feldes:
        // die Bezugsgrösse, an der Dolch (kürzer) und Richtschwert (länger)
        // gelesen werden.
        // Schatten
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillTriangle(cx - 2, 15, cx + 6, 15, cx + 2, 7);
        g.fillRect(cx - 2, 15, 8, 17);
        g.fillRect(cx - 7, 32, 18, 4);
        // Klinge
        g.fillStyle(0xc8cdd2, 1);
        g.fillTriangle(cx - 4, 13, cx + 4, 13, cx, 5);
        g.fillRect(cx - 4, 13, 8, 17);
        // Mittelgrat
        g.fillStyle(0xe8edf2, 1);
        g.fillTriangle(cx - 2, 13, cx + 2, 13, cx, 9);
        g.fillRect(cx - 2, 13, 4, 17);
        // Schneidenglanz
        g.fillStyle(0xf8fcff, 0.7);
        g.fillRect(cx - 1, 13, 2, 17);
        // Parierstange
        g.fillStyle(0xd4a030, 1);
        g.fillRect(cx - 9, 30, 18, 4);
        g.fillStyle(0xffe080, 0.5);
        g.fillRect(cx - 8, 30, 16, 2);
        // Griff
        g.fillStyle(0x5c3318, 1);
        g.fillRect(cx - 2, 34, 4, 8);
        // Knauf
        g.fillStyle(0xd4a030, 1);
        g.fillCircle(cx, 43, 4);
        // Glanzkante oben links
        g.fillStyle(0xffffff, 0.40);
        g.fillRect(cx - 3, 15, 2, 6);
      }
    },
    {
      key: 'itDagger',
      draw: () => {
        // Kleinstes der sechs — bleibt es auch (siehe gestrecktesZeichnen).
        const g = gestrecktesZeichnen(gBasis, 1.42, 1.08, 0, -1);
        const cx = SIZE / 2;
        // Schattendolch — kürzeste und schmalste Klinge der sechs, dazu tief
        // im Feld sitzend: viel Leerraum oben ist selbst ein Erkennungsmerkmal.
        // Schattenschleier (Namensgeber und zweiter, farblicher Unterschied
        // zum Kurzschwert, falls die Grösse allein nicht trägt)
        g.fillStyle(0x6a3a8a, 0.20);
        g.fillEllipse(cx, 23, 19, 26);
        // Schatten
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillTriangle(cx, 21, cx + 5, 21, cx + 2, 14);
        g.fillRect(cx, 21, 5, 10);
        // Klinge (kalter, dunklerer Stahl als beim Schwert)
        g.fillStyle(0xb8c4cc, 1);
        g.fillTriangle(cx - 3, 19, cx + 3, 19, cx, 11);
        g.fillRect(cx - 3, 19, 6, 11);
        // Mittelgrat + Schneidenglanz
        g.fillStyle(0xdfe9f0, 1);
        g.fillRect(cx - 1, 19, 3, 11);
        g.fillStyle(0xf8fcff, 0.65);
        g.fillRect(cx - 1, 14, 2, 16);
        // Kleine Parierstange (gedecktes Gold — der Dolch ist kein Prunkstück)
        g.fillStyle(0x9a7a30, 1);
        g.fillRect(cx - 6, 30, 12, 3);
        g.fillStyle(0xd4a030, 0.6);
        g.fillRect(cx - 6, 30, 12, 1);
        // Umwickelter Griff
        g.fillStyle(0x3a2a3a, 1);
        g.fillRect(cx - 2, 33, 4, 8);
        g.fillStyle(0x6a4a6a, 0.7);
        g.fillRect(cx - 2, 35, 4, 1);
        g.fillRect(cx - 2, 38, 4, 1);
        // Knauf
        g.fillStyle(0x9a7a30, 1);
        g.fillCircle(cx, 42, 3);
      }
    },
    {
      key: 'itFlail',
      draw: () => {
        // Der Morgenstern füllte die Kachel schon vorher; er wird nur minimal
        // eingezogen, damit die Stacheln nicht an der Kante kleben.
        const g = gestrecktesZeichnen(gBasis, 1.0, 0.96, 0, -0.5);
        const cx = SIZE / 2;
        // Kettenmorgenstern — als Einziges ein SCHRÄGER Umriss: Stiel unten
        // links, Masse oben rechts, dazwischen sichtbare Kettenglieder.
        // Stielschatten
        g.lineStyle(6, 0x1a1a1a, 0.30);
        g.beginPath();
        g.moveTo(12, 45); g.lineTo(21, 31); g.strokePath();
        // Stiel (Holz)
        g.lineStyle(6, 0x6a3818, 1);
        g.beginPath();
        g.moveTo(10, 43); g.lineTo(19, 29); g.strokePath();
        g.lineStyle(2, 0xc88a44, 1);
        g.beginPath();
        g.moveTo(9, 42); g.lineTo(18, 29); g.strokePath();
        // Lederwicklung am Stielende
        g.lineStyle(7, 0x3a2410, 1);
        g.beginPath();
        g.moveTo(10, 43); g.lineTo(13, 38); g.strokePath();
        // Kettenglieder
        g.fillStyle(0x8a9298, 1);
        g.fillCircle(21, 26, 2.6);
        g.fillCircle(24, 22, 2.6);
        g.fillCircle(27, 19, 2.6);
        g.fillStyle(0xc0c8ce, 0.7);
        g.fillCircle(21, 25, 1.2);
        g.fillCircle(24, 21, 1.2);
        g.fillCircle(27, 18, 1.2);
        // Kugel: Schatten zuerst, dann Stacheln, dann der Körper darüber —
        // so ragen die Stacheln heraus, ohne den Schatten zu zerschneiden.
        const bx = 33, by = 15, br = 9;
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillCircle(bx + 2, by + 2, br);
        g.fillStyle(0x7a8288, 1);
        [-105, -45, 12, 68, 140, 200].forEach((deg) => {
          const a = deg * Math.PI / 180;
          const ux = Math.cos(a), uy = Math.sin(a);
          g.fillTriangle(
            bx + ux * (br + 5), by + uy * (br + 5),
            bx + ux * (br - 2) - uy * 3.5, by + uy * (br - 2) + ux * 3.5,
            bx + ux * (br - 2) + uy * 3.5, by + uy * (br - 2) - ux * 3.5
          );
        });
        g.fillStyle(0x5e666c, 1);
        g.fillCircle(bx, by, br);
        g.fillStyle(0x8a9298, 0.8);
        g.fillCircle(bx - 3, by - 3, 4);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(bx - 4, by - 4, 2);
      }
    },
    {
      key: 'itAxe',
      draw: () => {
        // Grösser als das Kurzschwert, kleiner als der Hammer.
        const g = gestrecktesZeichnen(gBasis, 1.34, 1.08);
        const cx = SIZE / 2;
        // Glutaxt — Stiel rechts, das Blatt hängt als breiter Keil nach links.
        // Diese Asymmetrie ist das Erkennungsmerkmal; Schwert und Hammer sind
        // beide achsensymmetrisch.
        const hx = cx + 5;
        // Blatt als geflanschtes Trapez: am Stiel SCHMAL, an der Schneide HOCH
        // und leicht nach aussen gewölbt. Genau diese Umkehrung macht den
        // Axtumriss aus — ein gleich hohes Viereck las sich als Rechteck.
        const A = { x: hx - 1, y: 12 };    // Stiel oben
        const B = { x: hx - 1, y: 25 };    // Stiel unten
        const D = { x: hx - 16, y: 6 };    // Schneide oben
        const M = { x: hx - 19, y: 16 };   // Schneide Mitte (Wölbung)
        const C = { x: hx - 17, y: 28 };   // Schneide unten
        // Schatten (Stiel + Blatt)
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRect(hx - 1, 9, 6, 35);
        g.fillTriangle(A.x + 2, A.y + 2, D.x + 2, D.y + 2, M.x + 2, M.y + 2);
        g.fillTriangle(A.x + 2, A.y + 2, M.x + 2, M.y + 2, C.x + 2, C.y + 2);
        g.fillTriangle(A.x + 2, A.y + 2, C.x + 2, C.y + 2, B.x + 2, B.y + 2);
        // Stiel
        g.fillStyle(0x6a3818, 1);
        g.fillRect(hx - 2, 7, 5, 36);
        g.fillStyle(0xc88a44, 0.55);
        g.fillRect(hx - 2, 7, 2, 36);
        // Lederwicklung
        g.fillStyle(0x3a2410, 1);
        g.fillRect(hx - 3, 33, 7, 9);
        g.fillStyle(0x6a4a28, 0.6);
        g.fillRect(hx - 3, 35, 7, 1);
        g.fillRect(hx - 3, 39, 7, 1);
        // Blatt
        g.fillStyle(0x9aa2a8, 1);
        g.fillTriangle(A.x, A.y, D.x, D.y, M.x, M.y);
        g.fillTriangle(A.x, A.y, M.x, M.y, C.x, C.y);
        g.fillTriangle(A.x, A.y, C.x, C.y, B.x, B.y);
        // Untere Blatthälfte abdunkeln (Volumen)
        g.fillStyle(0x6e767c, 0.5);
        g.fillTriangle(A.x, A.y, M.x, M.y, C.x, C.y);
        g.fillTriangle(A.x, A.y, C.x, C.y, B.x, B.y);
        // Schneide
        g.lineStyle(3, 0xf0f6fa, 0.9);
        g.beginPath();
        g.moveTo(D.x, D.y); g.lineTo(M.x, M.y); g.lineTo(C.x, C.y);
        g.strokePath();
        // Glut direkt hinter der Schneide (Namensgeber)
        g.lineStyle(3, 0xff7020, 0.6);
        g.beginPath();
        g.moveTo(D.x + 2, D.y + 2); g.lineTo(M.x + 3, M.y); g.lineTo(C.x + 2, C.y - 2);
        g.strokePath();
        g.fillStyle(0xffc040, 0.85);
        g.fillCircle(M.x + 4, 11, 1.4);
        g.fillCircle(M.x + 4, 22, 1.2);
        // Augenringe: nur knapp breiter als der Stiel, sonst lesen sie sich als
        // eigenes Objekt neben der Axt statt als Beschlag.
        g.fillStyle(0xd4a030, 1);
        g.fillRect(hx - 3, 10, 7, 3);
        g.fillRect(hx - 3, 24, 7, 3);
        g.fillStyle(0xffe080, 0.5);
        g.fillRect(hx - 3, 10, 7, 1);
      }
    },
    {
      key: 'itGreatsword',
      draw: () => {
        // Grösstes der fünf gereihten Symbole. In der Höhe stand es schon am
        // Anschlag, deshalb wächst hier nur die Breite (sy = 1) und der
        // Versatz hebt die Klinge von der Kachelkante weg.
        const g = gestrecktesZeichnen(gBasis, 1.45, 0.95, 0, -1.6);
        const cx = SIZE / 2;
        // Richtschwert — längste und breiteste Klinge, füllt das Feld von oben
        // bis unten. Zusammen mit der weit ausladenden Parierstange und dem
        // zweihändigen Griff der wuchtigste Schwert-Umriss.
        // Schatten
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillTriangle(cx - 4, 11, cx + 8, 11, cx + 2, 3);
        g.fillRect(cx - 4, 11, 12, 23);
        g.fillRect(cx - 11, 34, 26, 4);
        // Klinge
        g.fillStyle(0xc8cdd2, 1);
        g.fillTriangle(cx - 6, 9, cx + 6, 9, cx, 1);
        g.fillRect(cx - 6, 9, 12, 23);
        // Blutrinne
        g.fillStyle(0xe8edf2, 1);
        g.fillRect(cx - 3, 9, 6, 23);
        g.fillStyle(0x8a9298, 0.5);
        g.fillRect(cx - 1, 11, 2, 20);
        // Schneidenglanz aussen
        g.fillStyle(0xf8fcff, 0.7);
        g.fillRect(cx - 6, 9, 2, 23);
        // Parierstange (breit, mit herabgezogenen Enden)
        g.fillStyle(0xd4a030, 1);
        g.fillRect(cx - 13, 32, 26, 4);
        g.fillRect(cx - 13, 36, 4, 4);
        g.fillRect(cx + 9, 36, 4, 4);
        g.fillStyle(0xffe080, 0.5);
        g.fillRect(cx - 12, 32, 24, 2);
        // Zweihandgriff
        g.fillStyle(0x5c3318, 1);
        g.fillRect(cx - 3, 36, 6, 8);
        g.fillStyle(0x8a5828, 0.6);
        g.fillRect(cx - 3, 38, 6, 1);
        g.fillRect(cx - 3, 41, 6, 1);
        // Knauf
        g.fillStyle(0xd4a030, 1);
        g.fillCircle(cx, 45, 3.5);
        // Glanzkante
        g.fillStyle(0xffffff, 0.40);
        g.fillRect(cx - 5, 12, 2, 8);
      }
    },
    {
      key: 'itHammer',
      draw: () => {
        // Zwischen Axt und Richtschwert; der Kopf war schon breit, deshalb der
        // kleinste X-Faktor der fünf.
        const g = gestrecktesZeichnen(gBasis, 1.26, 1.1);
        const cx = SIZE / 2;
        // Kettenrat-Kriegshammer — ein einziger schwerer Block obenauf. Die
        // grösste zusammenhängende Fläche aller sechs Symbole; "schwer und
        // langsam" soll ohne Text ankommen.
        // Schatten
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRect(cx - 12, 9, 28, 16);
        g.fillRect(cx - 1, 24, 6, 21);
        // Stiel
        g.fillStyle(0x6a3818, 1);
        g.fillRect(cx - 3, 6, 6, 38);
        g.fillStyle(0xc88a44, 0.5);
        g.fillRect(cx - 3, 6, 2, 38);
        // Lederwicklung
        g.fillStyle(0x3a2410, 1);
        g.fillRect(cx - 4, 31, 8, 12);
        g.fillStyle(0x6a4a28, 0.6);
        g.fillRect(cx - 4, 33, 8, 1);
        g.fillRect(cx - 4, 36, 8, 1);
        g.fillRect(cx - 4, 39, 8, 1);
        // Kopf
        g.fillStyle(0x5e666c, 1);
        g.fillRect(cx - 14, 7, 28, 16);
        g.fillStyle(0x7e878e, 1);
        g.fillRect(cx - 14, 7, 28, 5);
        g.fillStyle(0x3e4449, 1);
        g.fillRect(cx - 14, 20, 28, 3);
        // Schlagflächen links/rechts
        g.fillStyle(0x9aa2a8, 1);
        g.fillRect(cx - 14, 7, 4, 16);
        g.fillRect(cx + 10, 7, 4, 16);
        // Goldbänder
        g.fillStyle(0xd4a030, 1);
        g.fillRect(cx - 10, 7, 3, 16);
        g.fillRect(cx + 7, 7, 3, 16);
        // Nieten
        g.fillStyle(0xffe080, 0.8);
        g.fillCircle(cx - 8.5, 11, 1.3);
        g.fillCircle(cx - 8.5, 19, 1.3);
        g.fillCircle(cx + 8.5, 11, 1.3);
        g.fillCircle(cx + 8.5, 19, 1.3);
        // Glanzkante
        g.fillStyle(0xffffff, 0.35);
        g.fillRect(cx - 13, 8, 26, 2);
      }
    },

    {
      key: 'itPortalScroll',
      draw: () => {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRoundedRect(cx - 11, cy - 14, 22, 30, 4);
        // Parchment body
        g.fillStyle(0xe8d8a0, 1);
        g.fillRoundedRect(cx - 12, cy - 16, 24, 30, 4);
        // Parchment shading
        g.fillStyle(0xc8b070, 0.55);
        g.fillRect(cx - 12, cy + 8, 24, 6);
        g.fillRect(cx - 12, cy - 16, 24, 4);
        // Top + bottom rolled edges (darker)
        g.fillStyle(0x8a6a30, 1);
        g.fillRect(cx - 14, cy - 18, 28, 4);
        g.fillRect(cx - 14, cy + 14, 28, 4);
        // Rolled-edge highlight
        g.fillStyle(0xd8b878, 0.5);
        g.fillRect(cx - 13, cy - 17, 26, 1);
        g.fillRect(cx - 13, cy + 15, 26, 1);
        // Purple ribbon (portal magic accent)
        g.fillStyle(0x6a3a8a, 1);
        g.fillRect(cx - 14, cy - 2, 28, 4);
        g.fillStyle(0xa874c8, 0.6);
        g.fillRect(cx - 14, cy - 1, 28, 1);
        // Rune sigil (light blue glow)
        g.fillStyle(0x88ccff, 1);
        g.fillCircle(cx, cy - 7, 3);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(cx, cy - 7, 1);
      }
    },
    {
      key: 'itPotionMinor',
      draw: () => {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillEllipse(cx + 1, cy + 16, 20, 6);
        // Cork
        g.fillStyle(0x8a5828, 1);
        g.fillRect(cx - 4, cy - 18, 8, 5);
        g.fillStyle(0xb87838, 0.6);
        g.fillRect(cx - 4, cy - 18, 8, 1);
        // Bottle neck
        g.fillStyle(0xc8e0a8, 0.65);
        g.fillRect(cx - 3, cy - 13, 6, 4);
        // Bottle body (rounded flask)
        g.fillStyle(0xb04a4a, 0.95);
        g.fillCircle(cx, cy + 4, 12);
        g.fillRect(cx - 8, cy - 6, 16, 10);
        // Liquid sheen
        g.fillStyle(0xff7878, 0.5);
        g.fillCircle(cx - 3, cy - 1, 4);
        // Glass highlight
        g.fillStyle(0xffffff, 0.35);
        g.fillRect(cx - 6, cy - 4, 2, 10);
        // Plus icon
        g.fillStyle(0xffffff, 0.85);
        g.fillRect(cx - 1, cy + 2, 3, 9);
        g.fillRect(cx - 4, cy + 5, 9, 3);
      }
    },
    {
      key: 'itPotionNormal',
      draw: () => {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        g.fillStyle(0x1a1a1a, 0.30); g.fillEllipse(cx + 1, cy + 16, 22, 6);
        g.fillStyle(0x8a5828, 1); g.fillRect(cx - 5, cy - 19, 10, 5);
        g.fillStyle(0xb87838, 0.6); g.fillRect(cx - 5, cy - 19, 10, 1);
        g.fillStyle(0xc8e0a8, 0.65); g.fillRect(cx - 4, cy - 14, 8, 4);
        // Rose-red, larger flask
        g.fillStyle(0xc04040, 0.95); g.fillCircle(cx, cy + 4, 14);
        g.fillRect(cx - 9, cy - 7, 18, 11);
        g.fillStyle(0xff8888, 0.55); g.fillCircle(cx - 4, cy - 1, 5);
        g.fillStyle(0xffffff, 0.40); g.fillRect(cx - 7, cy - 4, 2, 12);
        g.fillStyle(0xffffff, 0.85);
        g.fillRect(cx - 1, cy + 1, 3, 10); g.fillRect(cx - 4, cy + 4, 9, 3);
      }
    },
    {
      key: 'itPotionMajor',
      draw: () => {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        g.fillStyle(0x1a1a1a, 0.30); g.fillEllipse(cx + 1, cy + 17, 24, 6);
        g.fillStyle(0x8a5828, 1); g.fillRect(cx - 5, cy - 20, 10, 5);
        g.fillStyle(0xb87838, 0.6); g.fillRect(cx - 5, cy - 20, 10, 1);
        g.fillStyle(0xc8e0a8, 0.65); g.fillRect(cx - 4, cy - 15, 8, 4);
        // Crimson, even bigger flask
        g.fillStyle(0xa02828, 1); g.fillCircle(cx, cy + 5, 16);
        g.fillRect(cx - 11, cy - 8, 22, 13);
        g.fillStyle(0xff5050, 0.55); g.fillCircle(cx - 4, cy, 6);
        g.fillStyle(0xffffff, 0.45); g.fillRect(cx - 9, cy - 5, 2, 14);
        // Gold trim
        g.fillStyle(0xd4a030, 1); g.fillRect(cx - 11, cy - 2, 22, 2);
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(cx - 1, cy + 3, 3, 11); g.fillRect(cx - 5, cy + 6, 11, 3);
      }
    },
    {
      key: 'itPotionSuper',
      draw: () => {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        g.fillStyle(0x1a1a1a, 0.30); g.fillEllipse(cx + 1, cy + 18, 26, 6);
        // Gold cork
        g.fillStyle(0xd4a030, 1); g.fillRect(cx - 6, cy - 21, 12, 6);
        g.fillStyle(0xffe080, 0.55); g.fillRect(cx - 6, cy - 21, 12, 1);
        g.fillStyle(0xc8e0a8, 0.65); g.fillRect(cx - 4, cy - 15, 8, 4);
        // Deep purple, large flask (Super)
        g.fillStyle(0x6a2882, 1); g.fillCircle(cx, cy + 5, 17);
        g.fillRect(cx - 12, cy - 9, 24, 14);
        g.fillStyle(0xc878ff, 0.55); g.fillCircle(cx - 4, cy, 7);
        g.fillStyle(0xffffff, 0.5); g.fillRect(cx - 10, cy - 6, 2, 16);
        // Twin gold trim
        g.fillStyle(0xd4a030, 1);
        g.fillRect(cx - 12, cy - 4, 24, 2);
        g.fillRect(cx - 12, cy + 8, 24, 2);
        // Star sigil
        g.fillStyle(0xffe080, 1);
        g.fillTriangle(cx, cy - 4, cx - 4, cy + 4, cx + 4, cy + 4);
        g.fillTriangle(cx, cy + 6, cx - 4, cy - 2, cx + 4, cy - 2);
      }
    },
    {
      key: 'itBow',
      draw: () => {
        // Die Bogenzeichnung war in der 48er-Textur nur 21 px breit. Auf
        // ein 1x3-Rasterfeld (45 px breit) gezogen blieben davon 17 px —
        // im Spiel ein Faden. Waagerecht gestreckt fuellt sie das Feld,
        // ohne dass die Zeichnung selbst angefasst werden muss.
        // Versatz 19: die Zeichnung ist NICHT mittig — ihr Buegel liegt bei x 6..20,
        // also links der Kachelmitte 24. Ohne Ausgleich zieht die Streckung sie
        // bis x=-10 aus der Kachel heraus (gemessen). Mit 19 sitzt sie bei
        // 8.8..39.7, also mittig und breit.
        const g = gestrecktesZeichnen(gBasis, 1.9, 1.0, 19, 0);
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        // Big vertical recurve: bold filled crescent, tip flares, taut string
        // and a clean horizontal arrow. Designed to read at 48×48 thumbnail.

        // Limb-arc geometry
        const armX = cx + 4;        // arc center sits right of icon center so
                                    // the bow body bulges left
        const armR = 22;            // limb radius
        const startA = Phaser.Math.DegToRad(112);
        const endA   = Phaser.Math.DegToRad(248);

        // Drop shadow under the bow
        g.lineStyle(7, 0x000000, 0.30);
        g.beginPath();
        g.arc(armX + 1, cy + 2, armR, startA, endA, false);
        g.strokePath();

        // Main wood (warm dark walnut)
        g.lineStyle(7, 0x6a3818, 1);
        g.beginPath();
        g.arc(armX, cy, armR, startA, endA, false);
        g.strokePath();

        // Wood grain highlight (slightly inner curve, warmer tone)
        g.lineStyle(2, 0xc88a44, 1);
        g.beginPath();
        g.arc(armX, cy, armR - 1, startA + 0.05, endA - 0.05, false);
        g.strokePath();

        // Recurve flare at each tip — small inward hook that gives the
        // silhouette the iconic "horsebow" shape. Computed from the limb
        // tangent at the start/end angles.
        const tipPx = (a) => ({ x: armX + Math.cos(a) * armR, y: cy + Math.sin(a) * armR });
        const top = tipPx(endA);
        const bot = tipPx(startA);

        // Recurve hooks (curl inward toward center)
        g.lineStyle(5, 0x6a3818, 1);
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.lineTo(top.x - 4, top.y - 5);
        g.lineTo(top.x + 1, top.y - 9);
        g.strokePath();
        g.beginPath();
        g.moveTo(bot.x, bot.y);
        g.lineTo(bot.x - 4, bot.y + 5);
        g.lineTo(bot.x + 1, bot.y + 9);
        g.strokePath();

        // Brass tip caps
        g.fillStyle(0xd4a030, 1);
        g.fillCircle(top.x + 1, top.y - 9, 2);
        g.fillCircle(bot.x + 1, bot.y + 9, 2);
        g.fillStyle(0xffe080, 0.7);
        g.fillCircle(top.x + 1, top.y - 9, 1);
        g.fillCircle(bot.x + 1, bot.y + 9, 1);

        // String — straight taut line from tip cap to tip cap (no pull notch
        // / nocked arrow now). Shadow underneath, light cord on top.
        const stringTop = { x: top.x + 1, y: top.y - 9 };
        const stringBot = { x: bot.x + 1, y: bot.y + 9 };

        g.lineStyle(2, 0x000000, 0.35);
        g.beginPath();
        g.moveTo(stringTop.x, stringTop.y + 1);
        g.lineTo(stringBot.x, stringBot.y + 1);
        g.strokePath();

        g.lineStyle(1.5, 0xf2ecd6, 1);
        g.beginPath();
        g.moveTo(stringTop.x, stringTop.y);
        g.lineTo(stringBot.x, stringBot.y);
        g.strokePath();

        // Grip wrap (cord-bound center of the bow)
        g.fillStyle(0x2a1408, 1);
        g.fillRect(armX - armR + 0, cy - 6, 6, 12);
        g.fillStyle(0xa87940, 0.7);
        g.fillRect(armX - armR + 0, cy - 5, 6, 1);
        g.fillRect(armX - armR + 0, cy + 0, 6, 1);
        g.fillRect(armX - armR + 0, cy + 4, 6, 1);
      }
    },
    {
      key: 'itHead',
      draw: () => {
        const cx = SIZE / 2;
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillCircle(cx + 2, 20, 16);
        // Outer helm (darker steel base)
        g.fillStyle(0x3d5060, 1);
        g.fillCircle(cx, 18, 16);
        // Inner dome (lighter)
        g.fillStyle(0x7a98ae, 1);
        g.fillCircle(cx, 16, 14);
        // Dome sheen
        g.fillStyle(0xa8c0d0, 0.5);
        g.fillCircle(cx - 2, 12, 8);
        // Cheek guards
        g.fillStyle(0x3d5060, 1);
        g.fillRect(cx - 18, 24, 8, 12);
        g.fillRect(cx + 10, 24, 8, 12);
        // Face guard
        g.fillStyle(0x607888, 1);
        g.fillRect(cx - 14, 24, 28, 14);
        // Face guard edge highlight
        g.fillStyle(0x8fa5b8, 0.4);
        g.fillRect(cx - 13, 24, 26, 3);
        // Nose guard
        g.fillStyle(0xaabccc, 1);
        g.fillRect(cx - 2, 20, 4, 18);
        // Eye slot
        g.fillStyle(0x0d1318, 1);
        g.fillRect(cx - 12, 26, 24, 4);
        // Reflection
        g.fillStyle(0xe0ecf8, 0.85);
        g.fillCircle(cx + 6, 14, 4);
        // Top-left highlight
        g.fillStyle(0xffffff, 0.40);
        g.fillCircle(cx - 6, 10, 3);
      }
    },
    {
      key: 'itBody',
      draw: () => {
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRoundedRect(12, 10, 28, 30, 10);
        // Chest base (richer forest green)
        g.fillStyle(0x4a9a4a, 1);
        g.fillRoundedRect(10, 8, 28, 30, 10);
        // Mid shadow stripe
        g.fillStyle(0x2e6a2e, 1);
        g.fillRect(14, 26, 20, 10);
        // Collar highlight
        g.fillStyle(0x82da82, 1);
        g.fillRect(18, 14, 12, 6);
        // Rivet row
        g.fillStyle(0xd4a030, 0.8);
        g.fillCircle(16, 22, 2);
        g.fillCircle(24, 22, 2);
        g.fillCircle(32, 22, 2);
        // Top-left highlight spot
        g.fillStyle(0xffffff, 0.40);
        g.fillCircle(15, 13, 4);
      }
    },
    {
      key: 'itBoots',
      draw: () => {
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRoundedRect(12, 30, 10, 12, 4);
        g.fillRoundedRect(28, 30, 10, 12, 4);
        // Boot uppers (warm amber leather)
        g.fillStyle(0xd4922a, 1);
        g.fillRoundedRect(10, 16, 10, 24, 4);
        g.fillRoundedRect(26, 16, 10, 24, 4);
        // Boot cuff highlight
        g.fillStyle(0xf0c060, 1);
        g.fillRect(10, 16, 10, 5);
        g.fillRect(26, 16, 10, 5);
        // Sole
        g.fillStyle(0x7a4a10, 1);
        g.fillRect(8, 36, 14, 4);
        g.fillRect(24, 36, 14, 4);
        // Sole edge
        g.fillStyle(0x3a2008, 1);
        g.fillRect(8, 39, 14, 2);
        g.fillRect(24, 39, 14, 2);
        // Top-left highlight spots
        g.fillStyle(0xffffff, 0.40);
        g.fillCircle(13, 19, 3);
        g.fillCircle(29, 19, 3);
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
        // Shadow
        g.fillStyle(0x1a1a1a, 0.30);
        g.fillRoundedRect(10, 22, 32, 16, 6);
        // Base ore chunk (darker stone)
        g.fillStyle(0x7a7a80, 1);
        g.fillRoundedRect(8, 20, 32, 16, 6);
        // Mid highlight slab
        g.fillStyle(0xb0b0b8, 1);
        g.fillRoundedRect(12, 18, 24, 12, 4);
        // Top highlight face
        g.fillStyle(0xd0d0d8, 0.6);
        g.fillRoundedRect(14, 18, 18, 6, 3);
        // Bottom shadow
        g.fillStyle(0x484850, 1);
        g.fillRect(12, 30, 24, 4);
        // Mineral vein accent
        g.fillStyle(0xc8a830, 0.5);
        g.fillRect(16, 22, 6, 2);
        g.fillRect(26, 25, 4, 2);
        // Top-left highlight spot
        g.fillStyle(0xffffff, 0.40);
        g.fillCircle(14, 20, 3);
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
    },
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
    },
    {
      // Feature 059 (#42): amulet item icon — purple gem pendant on a gold chain.
      key: 'itAmulet',
      draw: () => {
        const cx = SIZE / 2;
        g.fillStyle(0xd4a030, 1); // gold chain hint
        g.fillRect(cx - 8, 8, 3, 3); g.fillRect(cx + 5, 8, 3, 3);
        g.fillRect(cx - 6, 12, 3, 3); g.fillRect(cx + 3, 12, 3, 3);
        g.fillStyle(0xd4a030, 1); g.fillCircle(cx, 30, 11); // gold bezel
        g.fillStyle(0x6a3fb0, 1); g.fillCircle(cx, 30, 8);  // purple gem
        g.fillStyle(0xb085e8, 0.85); g.fillCircle(cx, 30, 4);
        g.fillStyle(0xeadcff, 0.8); g.fillCircle(cx - 3, 27, 2); // highlight
      }
    },

    // ── Amulette (#125) ────────────────────────────────────────────────────
    // Jeder Name gibt die Form vor. Wer "Frostsiegel" liest und ein Sechseck
    // aus Eis sieht, muss den Namen nicht mehr lesen.

    {
      key: 'amuZwillingsklinge',       // zwei gekreuzte Klingen an einem Ring
      draw: () => {
        // Die Klingen haengen an einem Ring, der Ring an der Kette. Vorher
        // schwebten sie frei unter dem Band — es war nicht zu sehen, woran sie
        // haengen, und das Amulett zerfiel in zwei Bilder.
        amuKette();
        const cx = SIZE / 2;
        // Traegerring, in dem sich die Klingen kreuzen
        g.fillStyle(0x120e18, 1); g.fillCircle(cx, 22, 5.2);
        g.fillStyle(0xd4a030, 1); g.fillCircle(cx, 22, 4.2);
        g.fillStyle(0x2a2018, 1); g.fillCircle(cx, 22, 2.2);
        // Klingen: Spitzen nach unten, Griffe oben AM RING
        g.fillStyle(0x120e18, 1);
        g.fillTriangle(cx - 9, 23, cx - 5, 22, cx + 8, 43);
        g.fillTriangle(cx + 9, 23, cx + 5, 22, cx - 8, 43);
        g.fillStyle(0xb9c4d6, 1);
        g.fillTriangle(cx - 8, 23.5, cx - 5.6, 23, cx + 7, 41.5);
        g.fillTriangle(cx + 8, 23.5, cx + 5.6, 23, cx - 7, 41.5);
        // EINE Lichtkante je Klinge
        g.fillStyle(0xeef3fb, 0.95);
        g.fillTriangle(cx - 8, 23.5, cx - 7.2, 23.3, cx + 7, 41.5);
        g.fillTriangle(cx + 8, 23.5, cx + 7.2, 23.3, cx - 7, 41.5);
        // Parierstangen, damit die Klingen am Ring ansetzen statt daran zu kleben
        g.fillStyle(0x7a5a20, 1);
        g.fillRect(cx - 10, 21.5, 6, 2.6); g.fillRect(cx + 4, 21.5, 6, 2.6);
        g.fillStyle(0xc0a050, 1);
        g.fillRect(cx - 10, 21.5, 6, 1); g.fillRect(cx + 4, 21.5, 6, 1);
        glanz(cx - 2, 20, 1.4);
      }
    },
    {
      key: 'amuKettenherz',            // ein Herz aus Kettengliedern
      draw: () => {
        amuKette();
        const cx = SIZE / 2, cy = 31;
        g.fillStyle(0x120e18, 1);
        g.fillCircle(cx - 5, cy - 3, 7); g.fillCircle(cx + 5, cy - 3, 7);
        g.fillTriangle(cx - 11, cy, cx + 11, cy, cx, cy + 12);
        g.fillStyle(0x8a2230, 1);
        g.fillCircle(cx - 5, cy - 3, 5.6); g.fillCircle(cx + 5, cy - 3, 5.6);
        g.fillTriangle(cx - 9.6, cy, cx + 9.6, cy, cx, cy + 10.4);
        // Kettenglieder als dunkle Ringe darauf
        g.fillStyle(0x3a1018, 1);
        [[cx - 5, cy - 4], [cx + 5, cy - 4], [cx, cy + 3]].forEach((p) => {
          g.fillCircle(p[0], p[1], 3.1);
        });
        g.fillStyle(0x8a2230, 1);
        [[cx - 5, cy - 4], [cx + 5, cy - 4], [cx, cy + 3]].forEach((p) => {
          g.fillCircle(p[0], p[1], 1.6);
        });
        g.fillStyle(0xd4566a, 0.7); g.fillEllipse(cx - 5, cy - 7, 6, 3);
        glanz(cx - 6, cy - 7, 1.5);
      }
    },
    {
      key: 'amuSchnitterband',         // eine Sensenklinge als Anhaenger
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x120e18, 1);
        g.fillTriangle(cx - 13, 24, cx + 12, 22, cx + 3, 42);
        g.fillStyle(0xb0bccd, 1);
        g.fillTriangle(cx - 11, 25, cx + 10, 23.5, cx + 2.5, 40);
        // Schneide: eine einzelne helle Kante
        g.fillStyle(0xf2f7ff, 0.95);
        g.fillTriangle(cx - 11, 25, cx + 10, 23.5, cx + 8, 26);
        g.fillStyle(0x5a3a18, 1); g.fillRect(cx + 6, 22, 4, 18);
        g.fillStyle(0x8a5c28, 1); g.fillRect(cx + 6, 22, 1.6, 18);
        glanz(cx - 6, 27, 1.3);
      }
    },
    {
      key: 'amuAderlass',              // Phiole mit einem Tropfen
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x120e18, 1); g.fillRoundedRect(cx - 7, 20, 14, 22, 5);
        g.fillStyle(0x2a2230, 1); g.fillRoundedRect(cx - 5.6, 21.5, 11.2, 19, 4);
        g.fillStyle(0x9a1828, 1); g.fillRoundedRect(cx - 5.6, 28, 11.2, 12.5, 4);
        g.fillStyle(0xd4404e, 0.8); g.fillEllipse(cx, 28.5, 11, 3);
        g.fillStyle(0x6a5020, 1); g.fillRect(cx - 4, 18, 8, 4);
        g.fillStyle(0xc0a050, 1); g.fillRect(cx - 4, 18, 8, 1.4);
        g.fillStyle(0xe8eef8, 0.35); g.fillRect(cx - 4, 23, 2, 14);
        glanz(cx - 3, 32, 1.4, 0xffd0d8);
      }
    },
    {
      key: 'amuBrandmal',              // eingebranntes Zeichen, gluehend
      draw: () => {
        amuKette();
        amuScheibe(11, 0x4a2a12, 0x1c1008, 0xffb050);
        const cx = SIZE / 2, cy = 31;
        g.fillStyle(0xff8a20, 1);
        g.fillRect(cx - 6, cy - 1.2, 12, 2.4);
        g.fillRect(cx - 1.2, cy - 6, 2.4, 12);
        g.fillStyle(0xffd070, 0.9);
        g.fillRect(cx - 6, cy - 1.2, 12, 1);
        g.fillStyle(0xff6a00, 0.35); g.fillCircle(cx, cy, 9);
        glanz(cx, cy, 1.8, 0xfff0c0);
      }
    },
    {
      key: 'amuSturmschritt',          // Feder / Fluegel
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x120e18, 1);
        g.fillTriangle(cx - 2, 19, cx + 12, 33, cx - 4, 43);
        g.fillStyle(0x6fa8c8, 1);
        g.fillTriangle(cx - 2, 20.5, cx + 10.5, 33, cx - 3.5, 41.5);
        // Fahnen: drei helle Streifen quer
        g.fillStyle(0xbfe4f5, 0.9);
        g.fillTriangle(cx - 2, 22, cx + 5, 29, cx - 2, 30);
        g.fillTriangle(cx - 2, 31, cx + 6.5, 34, cx - 2, 37);
        g.fillStyle(0x2a5468, 1); g.fillRect(cx - 3, 20, 2, 22);
        glanz(cx + 1, 26, 1.3, 0xeafaff);
      }
    },
    {
      key: 'amuTrabantenstein',        // Stein mit umlaufenden Trabanten
      draw: () => {
        amuKette();
        const cx = SIZE / 2, cy = 31;
        g.lineStyle(1.6, 0x4a4266, 0.9);
        g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.strokePath();
        amuScheibe(7, 0x3a3450, 0x7a6ac0, 0xc8bcff);
        g.fillStyle(0x120e18, 1);
        [[cx + 12, cy], [cx - 8.5, cy + 8.5], [cx - 8.5, cy - 8.5]].forEach((p) => g.fillCircle(p[0], p[1], 3));
        g.fillStyle(0xc8bcff, 1);
        [[cx + 12, cy], [cx - 8.5, cy + 8.5], [cx - 8.5, cy - 8.5]].forEach((p) => g.fillCircle(p[0], p[1], 2));
        glanz(cx - 2, cy - 3, 1.5);
      }
    },
    {
      key: 'amuAschefunke',            // Glut mit Funken
      draw: () => {
        amuKette();
        const cx = SIZE / 2, cy = 32;
        g.fillStyle(0x120e18, 1); g.fillCircle(cx, cy, 9);
        g.fillStyle(0x3a2018, 1); g.fillCircle(cx, cy, 7.6);
        g.fillStyle(0xd05a10, 1); g.fillCircle(cx, cy, 5);
        g.fillStyle(0xffb040, 1); g.fillCircle(cx - 1, cy - 1, 2.6);
        // Funken springen weg — ungleichmaessig, sonst wirkt es wie ein Muster
        g.fillStyle(0xffd070, 0.95);
        [[cx + 9, cy - 7, 1.5], [cx - 8, cy - 9, 1.2], [cx + 6, cy + 8, 1.1], [cx - 10, cy + 3, 1]]
          .forEach((p) => g.fillCircle(p[0], p[1], p[2]));
        glanz(cx - 2, cy - 2, 1.2, 0xfff4d0);
      }
    },
    {
      key: 'amuSchattenmantel',        // Kapuze im Profil
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x0e0c14, 1);
        g.fillTriangle(cx, 18, cx - 11, 42, cx + 11, 42);
        g.fillStyle(0x2e2840, 1);
        g.fillTriangle(cx, 20.5, cx - 9, 40.5, cx + 9, 40.5);
        // Dunkles Innere: die Kapuze ist leer
        g.fillStyle(0x0a0810, 1);
        g.fillTriangle(cx, 27, cx - 5, 39.5, cx + 5, 39.5);
        g.fillStyle(0x6a5fa0, 0.85);
        g.fillTriangle(cx, 20.5, cx - 9, 40.5, cx - 6.5, 40.5);
        glanz(cx - 2, 34, 1.2, 0x9a86ff);
      }
    },
    {
      key: 'amuSchlaechterkrone',      // gezackte Krone
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x120e18, 1); g.fillRect(cx - 12, 33, 24, 9);
        g.fillTriangle(cx - 12, 33, cx - 7, 20, cx - 2, 33);
        g.fillTriangle(cx - 5, 33, cx, 17, cx + 5, 33);
        g.fillTriangle(cx + 2, 33, cx + 7, 20, cx + 12, 33);
        g.fillStyle(0xb08820, 1); g.fillRect(cx - 10.5, 34, 21, 6.5);
        g.fillTriangle(cx - 10.5, 33, cx - 7, 22.5, cx - 3.5, 33);
        g.fillTriangle(cx - 4, 33, cx, 19.5, cx + 4, 33);
        g.fillTriangle(cx + 3.5, 33, cx + 7, 22.5, cx + 10.5, 33);
        g.fillStyle(0xf0d070, 0.9); g.fillRect(cx - 10.5, 34, 21, 1.4);
        g.fillStyle(0x9a1828, 1); g.fillCircle(cx, 37.5, 2.2);
        glanz(cx - 6, 26, 1.2);
      }
    },
    {
      key: 'amuFrostsiegel',           // Sechseck aus Eis
      draw: () => {
        amuKette();
        const cx = SIZE / 2, cy = 31, r = 11;
        const ecke = (i, rr) => [cx + Math.cos(Math.PI / 3 * i - Math.PI / 2) * rr,
                                 cy + Math.sin(Math.PI / 3 * i - Math.PI / 2) * rr];
        const sechs = (rr, farbe, deckung) => {
          g.fillStyle(farbe, deckung === undefined ? 1 : deckung);
          for (let i = 0; i < 6; i++) {
            const a = ecke(i, rr), b = ecke((i + 1) % 6, rr);
            g.fillTriangle(cx, cy, a[0], a[1], b[0], b[1]);
          }
        };
        sechs(r + 1.5, 0x123040);
        sechs(r, 0x3a86a8);
        sechs(r - 3.5, 0x9fdcf0);
        // Kristallachsen
        g.fillStyle(0xffffff, 0.85);
        for (let i = 0; i < 3; i++) {
          const a = ecke(i, r - 1.5), b = ecke(i + 3, r - 1.5);
          g.fillTriangle(a[0], a[1], b[0], b[1], cx + 0.9, cy + 0.9);
        }
        glanz(cx - 3, cy - 4, 1.5, 0xffffff);
      }
    },
    {
      key: 'amuGlasherz',              // ein zersprungener Glasscherben-Splitter
      draw: () => {
        // Erster Entwurf war ein rundes Herz — und damit im Rastervergleich
        // 0,0010 von amuKettenherz entfernt, also praktisch deckungsgleich.
        // Beide Namen enthalten "Herz", beide Formen waren rund; in Graustufen
        // war es dasselbe Bild. Jetzt ein KANTIGER, geschliffener Splitter mit
        // einer fehlenden Ecke: dieselbe Idee, andere Silhouette.
        amuKette();
        const cx = SIZE / 2, cy = 31;
        g.fillStyle(0x101820, 1);
        g.fillTriangle(cx - 11, cy - 8, cx + 11, cy - 8, cx, cy + 12);
        g.fillTriangle(cx - 11, cy - 8, cx, cy - 13, cx + 11, cy - 8);
        g.fillStyle(0x9fd8e8, 0.9);
        g.fillTriangle(cx - 9.2, cy - 7, cx + 9.2, cy - 7, cx, cy + 10);
        g.fillTriangle(cx - 9.2, cy - 7, cx, cy - 11.4, cx + 9.2, cy - 7);
        // Schliff: drei Facetten, unterschiedlich hell
        g.fillStyle(0x6fb4cc, 1);
        g.fillTriangle(cx - 9.2, cy - 7, cx, cy - 7, cx, cy + 10);
        g.fillStyle(0xd8f2fb, 0.9);
        g.fillTriangle(cx, cy - 11.4, cx + 9.2, cy - 7, cx, cy - 7);
        // Die fehlende Ecke — hier ist er zerbrochen
        g.fillStyle(0x0a0e14, 1);
        g.fillTriangle(cx + 3, cy - 7, cx + 9.2, cy - 7, cx + 4.5, cy + 1);
        // Sprung quer durch den Rest
        g.lineStyle(1.3, 0x14242e, 0.95);
        g.beginPath(); g.moveTo(cx - 7, cy - 6); g.lineTo(cx - 2, cy - 1);
        g.lineTo(cx - 4.5, cy + 2); g.lineTo(cx, cy + 8); g.strokePath();
        glanz(cx - 5, cy - 5, 1.5);
      }
    },
    {
      key: 'amuZweiterAtem',           // Sanduhr
      draw: () => {
        amuKette();
        const cx = SIZE / 2;
        g.fillStyle(0x120e18, 1);
        g.fillRect(cx - 9, 19, 18, 3); g.fillRect(cx - 9, 40, 18, 3);
        g.fillTriangle(cx - 8, 22, cx + 8, 22, cx, 31);
        g.fillTriangle(cx - 8, 40, cx + 8, 40, cx, 31);
        g.fillStyle(0x5a4a30, 1);
        g.fillRect(cx - 8, 19.5, 16, 2.2); g.fillRect(cx - 8, 40.2, 16, 2.2);
        g.fillStyle(0xbfe8d0, 0.75);
        g.fillTriangle(cx - 6.5, 23, cx + 6.5, 23, cx, 30.5);
        g.fillTriangle(cx - 6.5, 39.5, cx + 6.5, 39.5, cx, 32);
        // Der Sand, der schon unten liegt
        g.fillStyle(0x7ad0a0, 1);
        g.fillTriangle(cx - 5, 39.5, cx + 5, 39.5, cx, 35);
        g.fillStyle(0xe8f8f0, 0.9); g.fillRect(cx - 8, 19.5, 16, 1);
        glanz(cx - 3, 25, 1.2, 0xeafff4);
      }
    },
    {
      key: 'amuBlutpakt',              // Siegel mit Nagel
      draw: () => {
        amuKette();
        const cx = SIZE / 2, cy = 32;
        g.fillStyle(0x120e18, 1); g.fillCircle(cx, cy, 10.5);
        g.fillStyle(0x7a1420, 1); g.fillCircle(cx, cy, 9);
        g.fillStyle(0xa82838, 1); g.fillCircle(cx, cy, 6.5);
        g.fillStyle(0xd45a68, 0.6); g.fillEllipse(cx - 2, cy - 4, 8, 3.5);
        // Der Nagel steckt schraeg im Siegel
        g.fillStyle(0x14121a, 1);
        g.fillTriangle(cx - 7, 22, cx - 4, 21, cx + 5, 39);
        g.fillStyle(0x9aa4b4, 1);
        g.fillTriangle(cx - 6.2, 23, cx - 4.6, 22.4, cx + 4, 38);
        g.fillStyle(0xdfe6f0, 0.9);
        g.fillTriangle(cx - 6.2, 23, cx - 5.6, 22.7, cx + 4, 38);
        glanz(cx - 3, cy - 4, 1.4, 0xffc8c8);
      }
    },

    // ── Helme ──────────────────────────────────────────────────────────────
    // Drei Stufen, drei Umrisse: runde Kappe, Kettenhaube mit Nackenschutz,
    // kantige Maske. Ueber Masse und Zierrat getrennt, nicht ueber Farbe —
    // sonst wuerden sie in Graustufen wieder gleich aussehen.
    {
      key: 'itHeadBronze',
      draw: () => {
        const cx = SIZE / 2;
        // Helmbusch — er gibt dem Bronzehelm seinen Umriss und trennt ihn von
        // allem anderen im Raster.
        g.fillStyle(0x4a1010, 1);
        g.fillTriangle(cx - 3, 12, cx + 3, 12, cx, 3);
        g.fillTriangle(cx - 4, 14, cx + 4, 14, cx + 1, 5);
        g.fillStyle(0x8a2020, 1);
        g.fillTriangle(cx - 2.4, 12.5, cx + 2.4, 12.5, cx + 0.3, 5);
        g.fillStyle(0xc04040, 0.75);
        g.fillTriangle(cx - 2.4, 12.5, cx - 1.2, 12.5, cx + 0.3, 6);
        // Glocke
        g.fillStyle(0x1a1208, 1); g.fillCircle(cx, 27, 14); g.fillRect(cx - 14, 27, 28, 10);
        g.fillStyle(0x7a5618, 1); g.fillCircle(cx, 27, 12.6); g.fillRect(cx - 12.6, 27, 25.2, 8.6);
        // Kammleiste ueber der Kuppe
        g.fillStyle(0xa87c26, 1); g.fillRect(cx - 1.6, 14, 3.2, 12);
        g.fillStyle(0xd8a840, 0.9); g.fillRect(cx - 1.6, 14, 1.2, 12);
        // Augenschlitz mit dunkler Tiefe, Nasensteg dazwischen
        g.fillStyle(0x0e0a04, 1); g.fillRect(cx - 11, 29, 22, 5);
        g.fillStyle(0x7a5618, 1); g.fillRect(cx - 1.8, 29, 3.6, 5);
        g.fillStyle(0x1a1208, 1); g.fillRect(cx - 2.2, 32, 4.4, 6);
        g.fillStyle(0x8a6420, 1); g.fillRect(cx - 1.6, 32, 3.2, 5.4);
        // Nieten am Rand
        g.fillStyle(0xd8a840, 1);
        [-9, -3, 3, 9].forEach((dx) => g.fillCircle(cx + dx, 36.4, 1.15));
        // Eine Lichtkante oben, ein Schattenfuss unten
        g.fillStyle(0xd8a840, 0.85); g.fillEllipse(cx - 3, 19.5, 14, 4.6);
        g.fillStyle(0x3a2606, 1); g.fillRect(cx - 12.6, 35, 25.2, 2.4);
        glanz(cx - 6, 19, 1.7);
      }
    },
    {
      key: 'itHeadKettenhaube',
      draw: () => {
        const cx = SIZE / 2;
        // Haube mit ausgestelltem Nackenschutz — breiter unten als oben.
        g.fillStyle(0x0c0e14, 1);
        g.fillCircle(cx, 23, 13.5);
        g.fillTriangle(cx - 13.5, 23, cx + 13.5, 23, cx + 15, 42);
        g.fillTriangle(cx - 13.5, 23, cx - 15, 42, cx + 15, 42);
        g.fillStyle(0x4e5464, 1);
        g.fillCircle(cx, 23, 12);
        g.fillTriangle(cx - 12, 23, cx + 12, 23, cx + 13.4, 40.5);
        g.fillTriangle(cx - 12, 23, cx - 13.4, 40.5, cx + 13.4, 40.5);
        // Geflecht: versetzte Ringe, jeder mit hellem Oberrand — DAS macht
        // Kettenzeug aus, eine glatte Flaeche waere nur ein grauer Fleck.
        for (let ry = 0; ry < 6; ry++) {
          for (let rx = 0; rx < 8; rx++) {
            const gx = cx - 12.5 + rx * 3.4 + (ry % 2) * 1.7;
            const gy = 15 + ry * 4.2;
            if (Math.hypot(gx - cx, (gy - 23) * 0.9) > 14) continue;
            g.fillStyle(0x232936, 1); g.fillCircle(gx, gy, 1.5);
            g.fillStyle(0x7d8698, 1); g.fillCircle(gx, gy - 0.45, 1.0);
            g.fillStyle(0x232936, 1); g.fillCircle(gx, gy, 0.55);
          }
        }
        // Gesichtsoeffnung mit Lederrand
        g.fillStyle(0x0a0c10, 1); g.fillEllipse(cx, 29, 15.5, 12);
        g.fillStyle(0x3a2a18, 1); g.fillEllipse(cx, 29, 17, 13.4);
        g.fillStyle(0x0a0c10, 1); g.fillEllipse(cx, 29, 15, 11.6);
        g.fillStyle(0x5a422a, 0.9); g.fillEllipse(cx, 23.4, 15, 2.4);
        // Kappe oben: eine Lichtkante ueber dem Geflecht
        g.fillStyle(0xa4aebe, 0.75); g.fillEllipse(cx - 3, 14.5, 12, 4);
        glanz(cx - 6, 14.5, 1.5);
      }
    },
    {
      key: 'itHeadSchlangenmaske',
      draw: () => {
        const cx = SIZE / 2;
        // Kapuzenhaube mit Schlangenkopf: oben breit, unten spitz.
        g.fillStyle(0x08120c, 1);
        g.fillTriangle(cx, 10, cx - 15, 29, cx + 15, 29);
        g.fillTriangle(cx - 15, 29, cx + 15, 29, cx, 45);
        g.fillStyle(0x1e5c38, 1);
        g.fillTriangle(cx, 13, cx - 13, 29, cx + 13, 29);
        g.fillTriangle(cx - 13, 29, cx + 13, 29, cx, 42.5);
        // Schuppen: versetzte Boegen, nach unten kleiner werdend
        for (let sr = 0; sr < 4; sr++) {
          const sy = 18 + sr * 4.6;
          const halb = 11 - sr * 1.9;
          for (let sc = -3; sc <= 3; sc++) {
            const sx = cx + sc * (halb / 2.6) + (sr % 2) * 1.3;
            if (Math.abs(sx - cx) > halb) continue;
            g.fillStyle(0x143f26, 1); g.fillEllipse(sx, sy, 3.4, 2.6);
            g.fillStyle(0x2f8a52, 1); g.fillEllipse(sx, sy - 0.5, 2.8, 1.9);
          }
        }
        // Schlitzaugen, tiefliegend mit dunklem Grund
        g.fillStyle(0x050a06, 1);
        g.fillTriangle(cx - 10, 25.5, cx - 1.5, 28.2, cx - 10, 30.5);
        g.fillTriangle(cx + 10, 25.5, cx + 1.5, 28.2, cx + 10, 30.5);
        g.fillStyle(0xe4f430, 1);
        g.fillTriangle(cx - 8.6, 26.6, cx - 3, 28.2, cx - 8.6, 29.6);
        g.fillTriangle(cx + 8.6, 26.6, cx + 3, 28.2, cx + 8.6, 29.6);
        g.fillStyle(0x0a1a0e, 1);
        g.fillTriangle(cx - 7.4, 27.4, cx - 4.4, 28.2, cx - 7.4, 29);
        g.fillTriangle(cx + 7.4, 27.4, cx + 4.4, 28.2, cx + 7.4, 29);
        // Fangzaehne aus dem Maul
        g.fillStyle(0x08120c, 1); g.fillRect(cx - 6, 33, 12, 3);
        g.fillStyle(0xeaf4e8, 1);
        g.fillTriangle(cx - 4.6, 35, cx - 2.2, 35, cx - 3.4, 41.5);
        g.fillTriangle(cx + 4.6, 35, cx + 2.2, 35, cx + 3.4, 41.5);
        g.fillStyle(0xffffff, 0.7);
        g.fillTriangle(cx - 4.6, 35, cx - 3.9, 35, cx - 3.4, 41.5);
        // Eine Lichtkante links, damit der Kopf Volumen bekommt
        g.fillStyle(0x6adc90, 0.7); g.fillTriangle(cx, 13, cx - 13, 29, cx - 10, 29);
        glanz(cx - 4, 17, 1.4, 0xcfffe0);
      }
    },

    // ── Ruestungen ─────────────────────────────────────────────────────────
    {
      key: 'itBodyLeder',
      draw: () => {
        const cx = SIZE / 2;
        // Torso-Umriss mit Schulterkappen und schmalerer Taille — nicht der
        // Kasten von vorher.
        g.fillStyle(0x180f08, 1);
        g.fillRoundedRect(cx - 13, 13, 26, 28, 5);
        g.fillCircle(cx - 12, 17, 5.5); g.fillCircle(cx + 12, 17, 5.5);
        g.fillStyle(0x63401e, 1);
        g.fillRoundedRect(cx - 11.6, 14.4, 23.2, 25.4, 4);
        g.fillCircle(cx - 11.6, 17, 4.4); g.fillCircle(cx + 11.6, 17, 4.4);
        // Halsausschnitt
        g.fillStyle(0x180f08, 1); g.fillEllipse(cx, 14.6, 12, 6);
        g.fillStyle(0x2a1a0c, 1); g.fillEllipse(cx, 14, 10, 4.6);
        // Genaehte Platten: drei Bahnen mit Naht dazwischen
        g.fillStyle(0x4e3116, 1);
        g.fillRect(cx - 11.6, 22.6, 23.2, 1.3); g.fillRect(cx - 11.6, 31.2, 23.2, 1.3);
        g.fillStyle(0x8a5f2c, 0.8);
        for (let sx = -10; sx <= 10; sx += 2.6) {
          g.fillRect(cx + sx, 22.8, 1.1, 0.9); g.fillRect(cx + sx, 31.4, 1.1, 0.9);
        }
        // Riemen quer mit Schnalle
        g.fillStyle(0x33200e, 1); g.fillRect(cx - 11.6, 26.4, 23.2, 3.6);
        g.fillStyle(0x1e1208, 1); g.fillRect(cx - 3.2, 25.6, 6.4, 5.2);
        g.fillStyle(0xc79a48, 1); g.fillRect(cx - 2.6, 26.2, 5.2, 4);
        g.fillStyle(0x33200e, 1); g.fillRect(cx - 1.1, 27.2, 2.2, 2);
        // Nieten an den Schultern
        g.fillStyle(0xc79a48, 1);
        [[-11, 17], [11, 17], [-9.5, 20.5], [9.5, 20.5]].forEach((p) => g.fillCircle(cx + p[0], p[1], 1.1));
        // Lichtkante oben, Schatten unten
        g.fillStyle(0x9a7038, 0.85); g.fillRect(cx - 11.6, 14.4, 23.2, 1.8);
        g.fillStyle(0x2a1808, 1); g.fillRect(cx - 11.6, 37.6, 23.2, 2.3);
        glanz(cx - 7, 18, 1.5);
      }
    },
    {
      key: 'itBodyPlatte',
      draw: () => {
        const cx = SIZE / 2;
        // Geschulterter Kuerass: breite Schulterstuecke, verjuengte Taille,
        // Lamellenschuerze unten.
        g.fillStyle(0x0b0d13, 1);
        g.fillCircle(cx - 14, 18, 7); g.fillCircle(cx + 14, 18, 7);
        g.fillTriangle(cx - 15, 16, cx + 15, 16, cx + 11, 34);
        g.fillTriangle(cx - 15, 16, cx - 11, 34, cx + 11, 34);
        g.fillRoundedRect(cx - 11.5, 32, 23, 10, 3);
        g.fillStyle(0x646c82, 1);
        g.fillTriangle(cx - 13.4, 17.4, cx + 13.4, 17.4, cx + 9.8, 33);
        g.fillTriangle(cx - 13.4, 17.4, cx - 9.8, 33, cx + 9.8, 33);
        g.fillCircle(cx - 13.6, 18, 5.6); g.fillCircle(cx + 13.6, 18, 5.6);
        // Schulterstuecke bekommen eigene Rippen
        g.fillStyle(0x39404f, 1);
        g.fillEllipse(cx - 13.6, 18, 9, 2.2); g.fillEllipse(cx + 13.6, 18, 9, 2.2);
        // Halsausschnitt
        g.fillStyle(0x0b0d13, 1); g.fillEllipse(cx, 16.6, 12, 6);
        g.fillStyle(0x272d39, 1); g.fillEllipse(cx, 16, 10, 4.4);
        // Mittelgrat mit Lichtkante — er teilt die Brust und traegt das Volumen
        g.fillStyle(0x39404f, 1); g.fillTriangle(cx - 2.2, 18, cx + 2.2, 18, cx, 33);
        g.fillStyle(0x9aa6bc, 0.9); g.fillTriangle(cx - 0.9, 18, cx + 0.2, 18, cx, 33);
        // Lamellenschuerze
        g.fillStyle(0x525a6e, 1); g.fillRoundedRect(cx - 10.4, 32.6, 20.8, 8.6, 2);
        g.fillStyle(0x2f3542, 1);
        [35.2, 38].forEach((y) => g.fillRect(cx - 10.4, y, 20.8, 1.4));
        // Nieten am Brustrand
        g.fillStyle(0xb8c4d8, 1);
        [[-8, 20], [8, 20], [-9.4, 27], [9.4, 27]].forEach((p) => g.fillCircle(cx + p[0], p[1], 1.15));
        // EINE Lichtkante ueber der Brust, ein Schattenfuss
        g.fillStyle(0xb8c4d8, 0.9); g.fillRect(cx - 12.6, 17.4, 25.2, 1.8);
        g.fillStyle(0x1a1e26, 1); g.fillRect(cx - 10.4, 39.6, 20.8, 1.8);
        glanz(cx - 8, 21, 1.7);
      }
    },
    {
      key: 'itBodySchattenkutte',
      draw: () => {
        const cx = SIZE / 2;
        // Kutte mit Kapuze und Faltenwurf. Die Falten machen den Unterschied:
        // ein glatter Kegel sah aus wie ein Huetchen.
        g.fillStyle(0x07060b, 1);
        g.fillTriangle(cx, 9, cx - 16, 43, cx + 16, 43);
        g.fillStyle(0x2c2540, 1);
        g.fillTriangle(cx, 11.5, cx - 13.6, 41.2, cx + 13.6, 41.2);
        // Falten: drei dunkle Bahnen von der Schulter zum Saum
        g.fillStyle(0x1b172a, 1);
        g.fillTriangle(cx - 6, 20, cx - 4.4, 20, cx - 8.6, 41.2);
        g.fillTriangle(cx + 6, 20, cx + 4.4, 20, cx + 8.6, 41.2);
        g.fillTriangle(cx - 1, 24, cx + 1, 24, cx + 0.4, 41.2);
        // Kapuze: dunkler Bogen ueber der Brust, darin die Leere
        g.fillStyle(0x07060b, 1);
        g.fillTriangle(cx, 12, cx - 8.4, 27, cx + 8.4, 27);
        g.fillEllipse(cx, 26.5, 16.8, 7);
        g.fillStyle(0x241e36, 1);
        g.fillTriangle(cx, 14.6, cx - 7, 26, cx + 7, 26);
        g.fillStyle(0x07060b, 1);
        g.fillTriangle(cx, 17.5, cx - 4.6, 26.5, cx + 4.6, 26.5);
        // Guertelstrick mit Knoten
        g.fillStyle(0x4a3f22, 1); g.fillRect(cx - 9.6, 30.5, 19.2, 2.2);
        g.fillStyle(0x7a6a38, 1); g.fillRect(cx - 9.6, 30.5, 19.2, 0.9);
        g.fillStyle(0x4a3f22, 1); g.fillCircle(cx + 5.5, 31.6, 2);
        g.fillStyle(0x2a2412, 1); g.fillCircle(cx + 5.5, 31.6, 0.9);
        // Saum und EINE Lichtkante an der linken Flanke
        g.fillStyle(0x171326, 1); g.fillRect(cx - 13.6, 39.6, 27.2, 1.8);
        g.fillStyle(0x6a5fa0, 0.85);
        g.fillTriangle(cx, 11.5, cx - 13.6, 41.2, cx - 10.8, 41.2);
        // Ein Glimmen im Kapuzenschatten — bewusst EIN Punkt, kein Augenpaar:
        // die Kutte soll leer wirken.
        g.fillStyle(0x9a86ff, 0.55); g.fillCircle(cx, 22.5, 1.5);
        glanz(cx - 7, 20, 1.3, 0x9a86ff);
      }
    },

    // ── Stiefel ────────────────────────────────────────────────────────────
    {
      key: 'itBootsLeder',
      draw: () => {
        const cx = SIZE / 2;
        g.fillStyle(0x180f08, 1);
        g.fillRoundedRect(cx - 9, 12, 15, 22, 3);
        g.fillRoundedRect(cx - 9, 30, 24, 10, 3);
        g.fillStyle(0x6a4520, 1);
        g.fillRoundedRect(cx - 7.5, 13.5, 12, 20, 2);
        g.fillRoundedRect(cx - 7.5, 31, 21.5, 7.5, 2);
        g.fillStyle(0x3a2410, 1); g.fillRect(cx - 7.5, 20, 12, 3); // Schaftriemen
        g.fillStyle(0x2a1808, 1); g.fillRect(cx - 9, 38, 24, 2.5); // Sohle
        g.fillStyle(0x9a7038, 0.85); g.fillRect(cx - 7.5, 13.5, 12, 1.8);
        glanz(cx - 4, 16, 1.4);
      }
    },
    {
      key: 'itBootsStahl',
      draw: () => {
        const cx = SIZE / 2;
        g.fillStyle(0x0e1016, 1);
        g.fillRoundedRect(cx - 10, 11, 17, 23, 2);
        g.fillRoundedRect(cx - 10, 30, 26, 11, 2);
        g.fillStyle(0x6a7288, 1);
        g.fillRoundedRect(cx - 8.5, 12.5, 14, 21, 1.5);
        g.fillRoundedRect(cx - 8.5, 31.2, 23.5, 8, 1.5);
        // Lamellen: waagerechte Baender machen den Stahlschuh aus
        g.fillStyle(0x2a3040, 1);
        [16, 21, 26].forEach((y) => g.fillRect(cx - 8.5, y, 14, 2));
        g.fillStyle(0x3a4050, 1); g.fillRect(cx - 8.5, 35, 23.5, 2);
        g.fillStyle(0xb8c4d8, 0.9); g.fillRect(cx - 8.5, 12.5, 14, 1.8);
        g.fillStyle(0x14161e, 1); g.fillRect(cx - 10, 39, 26, 2.5);
        glanz(cx - 5, 14.5, 1.5);
      }
    },
    {
      key: 'itBootsWindlaeufer',
      draw: () => {
        const cx = SIZE / 2;
        g.fillStyle(0x0c1418, 1);
        g.fillRoundedRect(cx - 8, 14, 13, 20, 4);
        g.fillRoundedRect(cx - 8, 30, 21, 9, 4);
        g.fillStyle(0x2a6a80, 1);
        g.fillRoundedRect(cx - 6.5, 15.5, 10, 18, 3);
        g.fillRoundedRect(cx - 6.5, 31, 18.5, 6.5, 3);
        // Der Fluegel am Knoechel — das Erkennungszeichen
        g.fillStyle(0x0c1418, 1);
        g.fillTriangle(cx - 8, 20, cx - 18, 15, cx - 8, 27);
        g.fillStyle(0xbfe4f5, 1);
        g.fillTriangle(cx - 8.5, 21, cx - 16.5, 16.5, cx - 8.5, 26);
        g.fillStyle(0x6fa8c8, 1);
        g.fillTriangle(cx - 8.5, 23, cx - 13, 20, cx - 8.5, 26);
        g.fillStyle(0x9fdcf0, 0.9); g.fillRect(cx - 6.5, 15.5, 10, 1.6);
        g.fillStyle(0x0c1418, 1); g.fillRect(cx - 8, 37, 21, 2);
        glanz(cx - 3, 18, 1.4, 0xeafaff);
      }
    },

    // ── Boegen ─────────────────────────────────────────────────────────────
    // Vier Boegen, vier Umrisse: schlichter Langbogen, Reflexbogen mit
    // Hornspitzen, glimmender Bogen, blasser Nebelbogen.
    {
      key: 'itBowEsche',
      draw: () => {
        // Langbogen aus Eschenholz: EIN grosser Schenkel, dicker Griff, Sehne.
        // Vorher waren die Boegen gezogene Linien — eine Linie hat keine
        // Dicke, die man staffeln kann, und sah aus wie ein Draht.
        const MX = 31, MY = 24, A0 = -Math.PI * 0.60, A1 = Math.PI * 0.60;
        bogenSichel(MX, MY, 20.5, 6.5, A0, A1, 0x241708);     // Umriss
        bogenSichel(MX, MY, 19.6, 4.8, A0, A1, 0x8a6a34);     // Holz
        bogenSichel(MX, MY, 19.6, 1.6, A0, A1, 0xc6a262, 0.95); // Lichtkante aussen
        bogenSichel(MX, MY, 15.6, 1.3, A0, A1, 0x4a3418, 0.9);  // Schattenkante innen
        // Maserung: zwei kurze dunkle Striche auf dem Holz
        g.fillStyle(0x60481f, 0.9);
        g.fillRect(20, 12.5, 5.5, 1); g.fillRect(20, 34.5, 5.5, 1);
        // Griffwicklung
        g.fillStyle(0x2a1c0c, 1); g.fillRect(24.5, 18, 8, 12);
        g.fillStyle(0x6a4a22, 1); g.fillRect(25.2, 18.6, 6.6, 10.8);
        g.fillStyle(0x3a2810, 1);
        [20.4, 23.4, 26.4].forEach((y) => g.fillRect(25.2, y, 6.6, 1.2));
        g.fillStyle(0x9a7038, 0.85); g.fillRect(25.2, 18.6, 1.4, 10.8);
        // Nocken und Sehne
        g.fillStyle(0x241708, 1);
        g.fillCircle(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5, 2);
        g.fillCircle(MX + Math.cos(A1) * 18.5, MY + Math.sin(A1) * 18.5, 2);
        bogenSehne(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5, MY + Math.sin(A1) * 18.5);
        glanz(24, 11, 1.3, 0xf0e0b0);
      }
    },
    {
      key: 'itBowHorn',
      draw: () => {
        // Reflexbogen: zwei Gegenbiegungen statt eines Bogens
        g.lineStyle(5, 0x1a1208, 1);
        g.beginPath(); g.moveTo(14, 40); g.lineTo(24, 32); g.lineTo(26, 24);
        g.lineTo(24, 16); g.lineTo(14, 8); g.strokePath();
        g.lineStyle(3, 0x9a7a3a, 1);
        g.beginPath(); g.moveTo(14, 40); g.lineTo(24, 32); g.lineTo(26, 24);
        g.lineTo(24, 16); g.lineTo(14, 8); g.strokePath();
        // Hornspitzen
        g.fillStyle(0xe8e0cc, 1);
        g.fillTriangle(14, 8, 18, 6, 14.5, 11);
        g.fillTriangle(14, 40, 18, 42, 14.5, 37);
        g.lineStyle(1.2, 0xf0ece0, 0.9);
        g.beginPath(); g.moveTo(15, 7.5); g.lineTo(15, 40.5); g.strokePath();
        g.fillStyle(0x3a2a12, 1); g.fillRect(23, 20, 5, 8);
        g.fillStyle(0xc8a860, 0.9); g.fillRect(23, 20, 5, 1.5);
        glanz(25, 14, 1.2);
      }
    },
    {
      key: 'itBowGlut',
      draw: () => {
        // Verkohltes Holz mit einer gluehenden Spalte, die MITTEN durch den
        // Schenkel laeuft. Die Glut sitzt IM Bogen, nicht als Schein daneben.
        const MX = 31, MY = 24, A0 = -Math.PI * 0.60, A1 = Math.PI * 0.60;
        g.fillStyle(0xff5a00, 0.13); g.fillCircle(16, 24, 13);   // Hitzeschleier
        bogenSichel(MX, MY, 20.5, 7, A0, A1, 0x1c0a04);          // verkohlter Umriss
        bogenSichel(MX, MY, 19.6, 5.2, A0, A1, 0x5e2410);        // Holz
        bogenSichel(MX, MY, 17.4, 1.5, A0, A1, 0xff8a20);        // die Spalte
        bogenSichel(MX, MY, 17.9, 0.7, A0, A1, 0xffd070, 0.95);  // ihr heller Kern
        bogenSichel(MX, MY, 19.6, 1.3, A0, A1, 0x8a3a18, 0.9);   // Aussenkante
        // Glutflecken auf dem Holz
        g.fillStyle(0xff8a20, 0.9);
        [[19.5, 13.5], [18.5, 33], [22.5, 9.5]].forEach((p) => g.fillCircle(p[0], p[1], 1.2));
        // Griff aus dunklem Eisen
        g.fillStyle(0x140804, 1); g.fillRect(24.5, 18, 8, 12);
        g.fillStyle(0x4a2418, 1); g.fillRect(25.2, 18.6, 6.6, 10.8);
        g.fillStyle(0x8a4a28, 0.9); g.fillRect(25.2, 18.6, 1.4, 10.8);
        g.fillStyle(0xff8a20, 1); g.fillRect(25.2, 23.4, 6.6, 1.2);
        // Nocken und Sehne — die Sehne glimmt mit
        g.fillStyle(0x1c0a04, 1);
        g.fillCircle(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5, 2);
        g.fillCircle(MX + Math.cos(A1) * 18.5, MY + Math.sin(A1) * 18.5, 2);
        bogenSehne(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5,
                   MY + Math.sin(A1) * 18.5, 0xffb040);
        glanz(21, 11, 1.3, 0xfff0c0);
      }
    },
    {
      key: 'itBowNebel',
      draw: () => {
        // Bleiches Horn, an den Enden vom Nebel aufgezehrt: der Schenkel ist
        // ganz da, aber seine Spitzen verschwimmen. Die Schwaden liegen DAVOR,
        // nicht daneben — sonst sind es nur Flecken.
        const MX = 31, MY = 24, A0 = -Math.PI * 0.60, A1 = Math.PI * 0.60;
        bogenSichel(MX, MY, 20.5, 6.5, A0, A1, 0x101820);        // Umriss
        bogenSichel(MX, MY, 19.6, 4.8, A0, A1, 0x7d8ea0);        // bleiches Horn
        bogenSichel(MX, MY, 19.6, 1.5, A0, A1, 0xc8d8e8, 0.95);  // Lichtkante
        bogenSichel(MX, MY, 15.6, 1.2, A0, A1, 0x3a4552, 0.9);   // Schattenkante
        // Griff aus dunklem Leder
        g.fillStyle(0x0c1218, 1); g.fillRect(24.5, 18, 8, 12);
        g.fillStyle(0x2e3a48, 1); g.fillRect(25.2, 18.6, 6.6, 10.8);
        g.fillStyle(0x1a222c, 1);
        [20.4, 23.4, 26.4].forEach((y) => g.fillRect(25.2, y, 6.6, 1.2));
        g.fillStyle(0x9aacc0, 0.85); g.fillRect(25.2, 18.6, 1.4, 10.8);
        // Nocken und Sehne
        g.fillStyle(0x101820, 1);
        g.fillCircle(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5, 2);
        g.fillCircle(MX + Math.cos(A1) * 18.5, MY + Math.sin(A1) * 18.5, 2);
        bogenSehne(MX + Math.cos(A0) * 18.5, MY + Math.sin(A0) * 18.5, MY + Math.sin(A1) * 18.5);
        // Schwaden ZULETZT, damit sie die Enden wirklich verschlucken
        g.fillStyle(0xc8d8e8, 0.20); g.fillEllipse(17, 11, 20, 11);
        g.fillStyle(0xc8d8e8, 0.16); g.fillEllipse(18, 38, 22, 10);
        g.fillStyle(0xdfe8f0, 0.10); g.fillEllipse(24, 24, 26, 30);
        glanz(23, 20, 1.4, 0xeaf2fa);
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

  // ── uiPanel: ornate dungeon-scroll look ──────────────────────────────────
  // Outer glow: subtle amber tint at low alpha
  g.fillStyle(0x3a2a1a, 0.10);
  g.fillRoundedRect(-4, -4, 688, 428, 14);
  // Base: dark wood
  g.fillStyle(0x1a1410, 1);
  g.fillRoundedRect(0, 0, 680, 420, 12);
  // Inner border: gold/bronze, inset 6px
  g.lineStyle(3, 0xa87940, 1);
  g.strokeRoundedRect(6, 6, 668, 408, 9);
  // Corner diamonds (filled triangles forming a diamond shape)
  const diamondOffsets = [[18, 18], [662, 18], [18, 402], [662, 402]];
  g.fillStyle(0xa87940, 1);
  for (const [dx, dy] of diamondOffsets) {
    g.fillTriangle(dx, dy - 8, dx - 8, dy, dx, dy + 8); // left half
    g.fillTriangle(dx, dy - 8, dx + 8, dy, dx, dy + 8); // right half
  }
  g.generateTexture('uiPanel', 680, 420);
  g.clear();

  // ── uiSlot: slot normal ──────────────────────────────────────────────────
  g.fillStyle(0x222222, 1);
  g.fillRoundedRect(0, 0, 96, 64, 8);
  g.lineStyle(2, 0xffffff, 0.12);
  g.strokeRoundedRect(0, 0, 96, 64, 8);
  g.generateTexture('uiSlot', 96, 64);
  g.clear();

  // ── uiZelle / uiZelleSel (#123 A): VERTIEFTE Rasterzelle ────────────────
  //
  // Das Rasterinventar braucht eine andere Anmutung als die alten Faecher:
  // eine Zelle ist eine Mulde, in die etwas hineingelegt wird, kein Knopf.
  // Deshalb umgekehrte Kantenbeleuchtung — oben und links dunkel (Schatten
  // faellt hinein), unten und rechts hell (Lichtkante am Wannenrand). Das
  // ist derselbe Trick wie bei einem eingelassenen Feld in einer Oberflaeche,
  // nur mit vertauschten Seiten.
  const _zelle = (key, grund, rand, akzent) => {
    g.fillStyle(grund, 1);
    g.fillRoundedRect(0, 0, 48, 48, 5);
    // Schattenkante innen oben/links
    g.fillStyle(0x000000, 0.34);
    g.fillRect(2, 2, 44, 2);
    g.fillRect(2, 2, 2, 44);
    // Lichtkante innen unten/rechts
    g.fillStyle(0xffffff, 0.07);
    g.fillRect(2, 44, 44, 2);
    g.fillRect(44, 2, 2, 44);
    // Aussenrahmen
    g.lineStyle(1, rand, 0.85);
    g.strokeRoundedRect(0.5, 0.5, 47, 47, 5);
    if (akzent) {
      g.lineStyle(2, akzent, 0.95);
      g.strokeRoundedRect(1.5, 1.5, 45, 45, 5);
    }
    g.generateTexture(key, 48, 48);
    g.clear();
  };
  _zelle("uiZelle", 0x1b1e23, 0x3a404a, null);
  _zelle("uiZelleSel", 0x24282f, 0x3a404a, 0xffd33b);

  // ── uiSlotSel: slot selected ─────────────────────────────────────────────
  g.fillStyle(0x3a3a3a, 1);
  g.fillRoundedRect(0, 0, 96, 64, 8);
  g.lineStyle(3, 0xffd33b, 0.95);
  g.strokeRoundedRect(0, 0, 96, 64, 8);
  g.generateTexture('uiSlotSel', 96, 64);
  g.clear();

  // ── hudFrame: 200x40 ornate bar frame ────────────────────────────────────
  // Dark base
  g.fillStyle(0x0a0a0a, 1);
  g.fillRoundedRect(0, 0, 200, 40, 6);
  // Gold inner border (2px)
  g.lineStyle(2, 0xa87940, 1);
  g.strokeRoundedRect(2, 2, 196, 36, 5);
  // Repeating dots along top edge
  g.fillStyle(0xa87940, 0.7);
  for (let x = 10; x < 190; x += 10) {
    g.fillCircle(x, 5, 1.5);  // top edge dots
    g.fillCircle(x, 35, 1.5); // bottom edge dots
  }
  g.generateTexture('hudFrame', 200, 40);
  g.clear();

  // ── barFill: 196x36 health gradient (red) ────────────────────────────────
  // Simulate gradient via stacked horizontal slices from #cc0000 to #660000
  for (let i = 0; i < 36; i++) {
    const t = i / 35;
    // Interpolate R channel 0xcc → 0x66, keep G/B at 0
    const r = Math.round(0xcc + t * (0x66 - 0xcc));
    const col = (r << 16) | 0x000000;
    const alpha = 0.85 + t * 0.15;
    g.fillStyle(col, alpha);
    g.fillRect(0, i, 196, 1);
  }
  // Bright highlight strip at top
  g.fillStyle(0xff4444, 0.30);
  g.fillRect(0, 0, 196, 6);
  g.generateTexture('barFill', 196, 36);
  g.clear();

  // ── barFillXP: 196x36 XP gradient (green) ────────────────────────────────
  for (let i = 0; i < 36; i++) {
    const t = i / 35;
    // Interpolate top #00cc44 → bottom #006622
    const r = 0x00;
    const gv = Math.round(0xcc + t * (0x66 - 0xcc));
    const b  = Math.round(0x44 + t * (0x22 - 0x44));
    const col = (r << 16) | (gv << 8) | b;
    g.fillStyle(col, 0.9);
    g.fillRect(0, i, 196, 1);
  }
  g.fillStyle(0x44ff88, 0.25);
  g.fillRect(0, 0, 196, 6);
  g.generateTexture('barFillXP', 196, 36);

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

// --- Decorative prop textures (030-large-room-variety) ---
function createPropTextures(scene) {
  if (!scene || !scene.textures) return;
  var g;

  // Barrel (16x20)
  if (!scene.textures.exists('prop_barrel')) {
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x6b4226); g.fillRect(1, 2, 14, 16);
    g.fillStyle(0x7a4e2e); g.fillRect(2, 3, 12, 14); // wood body
    g.fillStyle(0x3a3a3a); g.fillRect(0, 4, 16, 2); // iron band top
    g.fillStyle(0x3a3a3a); g.fillRect(0, 14, 16, 2); // iron band bottom
    g.fillStyle(0x5a3a1a); g.fillRect(5, 3, 1, 14); // plank line
    g.fillStyle(0x5a3a1a); g.fillRect(10, 3, 1, 14); // plank line
    g.generateTexture('prop_barrel', 16, 20); g.destroy();
  }

  // Crate (16x16)
  if (!scene.textures.exists('prop_crate')) {
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x8B6914); g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x7a5a10); g.fillRect(1, 1, 14, 14);
    g.lineStyle(1, 0x5a4010, 0.8);
    g.lineBetween(0, 0, 16, 16); g.lineBetween(16, 0, 0, 16); // cross boards
    g.fillStyle(0x3a3a3a); g.fillRect(7, 7, 3, 3); // nail
    g.generateTexture('prop_crate', 16, 16); g.destroy();
  }

  // Pillar (12x24)
  if (!scene.textures.exists('prop_pillar')) {
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x888888); g.fillRect(1, 0, 10, 24);
    g.fillStyle(0x999999); g.fillRect(2, 1, 8, 22); // body
    g.fillStyle(0x777777); g.fillRect(0, 0, 12, 3); // capital
    g.fillStyle(0x777777); g.fillRect(0, 21, 12, 3); // base
    g.fillStyle(0xaaaaaa, 0.3); g.fillRect(3, 3, 2, 18); // highlight
    g.generateTexture('prop_pillar', 12, 24); g.destroy();
  }

  // Rubble (16x10)
  if (!scene.textures.exists('prop_rubble')) {
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x666666); g.fillCircle(4, 6, 4);
    g.fillStyle(0x777777); g.fillCircle(10, 5, 3);
    g.fillStyle(0x555555); g.fillCircle(7, 8, 3);
    g.fillStyle(0x888888); g.fillRect(12, 6, 3, 3);
    g.generateTexture('prop_rubble', 16, 10); g.destroy();
  }

  // Puddle (20x12)
  if (!scene.textures.exists('prop_puddle')) {
    g = scene.make.graphics({ add: false });
    g.fillStyle(0x334466, 0.5); g.fillEllipse(10, 6, 18, 10);
    g.fillStyle(0x445577, 0.3); g.fillEllipse(10, 6, 14, 7);
    g.fillStyle(0xffffff, 0.1); g.fillCircle(7, 4, 2); // reflection
    g.generateTexture('prop_puddle', 20, 12); g.destroy();
  }

  // Cobweb (16x16)
  if (!scene.textures.exists('prop_cobweb')) {
    g = scene.make.graphics({ add: false });
    g.lineStyle(1, 0xcccccc, 0.4);
    g.lineBetween(0, 0, 16, 16);
    g.lineBetween(0, 0, 16, 8);
    g.lineBetween(0, 0, 8, 16);
    g.lineStyle(1, 0xdddddd, 0.25);
    g.lineBetween(4, 0, 0, 4);
    g.lineBetween(8, 0, 0, 8);
    g.lineBetween(12, 0, 0, 12);
    g.generateTexture('prop_cobweb', 16, 16); g.destroy();
  }
}
if (typeof window !== 'undefined') {
  window.createPropTextures = createPropTextures;
}

// ========== Welt-Objekt-Atlas (#70, GPU-Draw-Reduktion) ==========
// Hindernisse/Props/Deko werden prozedural als je EIGENE Textur erzeugt (graphics.js).
// Im Top-Down-Rendern wechseln sich diese vielen Texturen ab -> jeder Wechsel = ein
// eigener Draw-Call (large-room: ~247/Frame). Loesung: alle kleinen Welt-Objekt-
// Texturen EINMALIG in EINE Canvas-Textur ('worldAtlas') packen + Frames definieren.
// Konsumenten (obstacles.create / add.image) zeichnen dann Frames DERSELBEN Basis-
// textur -> Phasers Batcher flusht nicht mehr pro Objekt. Originaltexturen bleiben als
// Fallback erhalten; schlaegt der Bau fehl, laufen alle Pfade unveraendert weiter.
function buildWorldAtlas(scene) {
  try {
    if (!scene || !scene.textures || typeof document === 'undefined') return;
    if (scene.textures.exists('worldAtlas')) return;
    // Deko-Props sind lazy -> vor dem Packen sicher erzeugen.
    if (typeof createPropTextures === 'function') {
      try { createPropTextures(scene); } catch (e) { /* optional */ }
    }
    var KEYS = [
      'obstacleWall', 'obstacleTree', 'obstacleRock',
      'pillar_small', 'pillar_large', 'statue_knight', 'brazier', 'crate',
      'barrel', 'rubble', 'altar',
      'chest_small', 'chest_medium', 'chest_large',
      'prop_barrel', 'prop_crate', 'prop_pillar', 'prop_rubble', 'prop_puddle', 'prop_cobweb'
    ];
    var items = [];
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (!scene.textures.exists(k)) continue;
      var src = scene.textures.get(k).getSourceImage();
      if (!src || !src.width || !src.height) continue;
      items.push({ key: k, img: src, w: src.width, h: src.height });
    }
    if (!items.length) return;
    // Regal-Packing (nach Hoehe absteigend), 2px Rand gegen Bleeding bei Skalierung.
    items.sort(function (a, b) { return b.h - a.h; });
    var PAD = 2, MAXW = 512;
    var x = PAD, y = PAD, rowH = 0;
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (x + it.w + PAD > MAXW) { x = PAD; y += rowH + PAD; rowH = 0; }
      it.ax = x; it.ay = y;
      x += it.w + PAD;
      if (it.h > rowH) rowH = it.h;
    }
    var atlasH = y + rowH + PAD;
    var canvas = document.createElement('canvas');
    canvas.width = MAXW; canvas.height = atlasH;
    var ctx = canvas.getContext('2d');
    for (var m = 0; m < items.length; m++) {
      var t = items[m];
      ctx.drawImage(t.img, t.ax, t.ay, t.w, t.h);
    }
    var tex = scene.textures.addCanvas('worldAtlas', canvas);
    if (!tex) return;
    var frames = {};
    for (var n = 0; n < items.length; n++) {
      var f = items[n];
      tex.add(f.key, 0, f.ax, f.ay, f.w, f.h);
      frames[f.key] = true;
    }
    window.__worldAtlasFrames = frames;
  } catch (e) {
    window.__worldAtlasFrames = null;
    try { console.warn('[buildWorldAtlas] fehlgeschlagen, nutze Einzeltexturen', e); } catch (_) {}
  }
}

// Liefert [textureKey, frame] fuer add.image/group.create: den Atlas, wenn der Key als
// Frame existiert, sonst die Originaltextur (frame undefined). Ein einziger Umschaltpunkt.
function worldTexArgs(key) {
  var f = window.__worldAtlasFrames;
  if (f && f[key]) return ['worldAtlas', key];
  return [key, undefined];
}

if (typeof window !== 'undefined') {
  window.buildWorldAtlas = buildWorldAtlas;
  window.worldTexArgs = worldTexArgs;
}
