// js/Archivschmiede.js
(function () {

  // ================= Helpers =================

  function drawBricks(g, x, y, w, h, bw = 24, bh = 14, gap = 2, col = 0xb8a48e) {
    // Strenges Clipping, keine Ueberhaenge links
    g.fillStyle(col, 1);
    const stepX = bw + gap, stepY = bh + gap;
    const rows = Math.ceil(h / stepY) + 1;
    const cols = Math.ceil(w / stepX) + 2;
    for (let r = 0; r <= rows; r++) {
      const odd = (r & 1) ? bw / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const rx = x + c * stepX - odd;
        const ry = y + r * stepY;
        const sx = Math.max(rx, x);
        const sy = Math.max(ry, y);
        const ex = Math.min(rx + bw, x + w);
        const ey = Math.min(ry + bh, y + h);
        const cw = ex - sx, ch = ey - sy;
        if (cw > 0 && ch > 0) g.fillRect(Math.round(sx), Math.round(sy), Math.round(cw), Math.round(ch));
      }
    }
  }

  function drawInnerFrame(g, x, y, w, h, t = 2, col = 0x1c1c1c) {
    // Innere Leiste verdeckt Ziegelkanten
    g.fillStyle(col, 1);
    g.fillRect(x, y, w, t);
    g.fillRect(x, y + h - t, w, t);
    g.fillRect(x, y, t, h);
    g.fillRect(x + w - t, y, t, h);
  }

function drawGableRoof(g, x, y, w, {
  h = 44,
  over = 12,                 // Ueberstand links/rechts
  base = 0x3b2b1b,
  ridge = 0x24170e,
  shadow = 0x2d1e12
} = {}) {
  const apexX = Math.round(x + w / 2);
  const apexY = Math.round(y - h);
  const lx = Math.round(x - over);
  const rx = Math.round(x + w + over);
  const by = Math.round(y);

  // Dachflaeche
  g.fillStyle(base, 1);
  g.fillTriangle(apexX, apexY, lx, by, rx, by);

  // Schattenband
  g.fillStyle(shadow, 0.35);
  g.fillTriangle(apexX, Math.round(by - h * 0.55), lx + 3, by - 3, rx - 3, by - 3);

  // Traufe ueber voller Breite inkl. Ueberstand
  g.fillStyle(0x2a1d14, 1);
  g.fillRect(lx + 1, by - 2, (rx - lx) - 2, 2);

  // Firstlinie
  g.lineStyle(2, ridge, 1);
  g.strokeTriangle(apexX, apexY, lx, by, rx, by);
}

  function drawAnvil(g, x, y, s = 1, fill = 0x2b2b2b, line = 0x111111) {
    g.fillStyle(fill, 1);
    g.lineStyle(2, line, 1);
    g.beginPath();
    g.moveTo(x + 0 * s, y + 0 * s);
    g.lineTo(x + 90 * s, y + 0 * s);
    g.lineTo(x + 126 * s, y + 12 * s);
    g.lineTo(x + 86 * s, y + 20 * s);
    g.lineTo(x + 68 * s, y + 28 * s);
    g.lineTo(x + 46 * s, y + 28 * s);
    g.lineTo(x + 42 * s, y + 40 * s);
    g.lineTo(x + 60 * s, y + 40 * s);
    g.lineTo(x + 60 * s, y + 56 * s);
    g.lineTo(x + 30 * s, y + 56 * s);
    g.lineTo(x + 30 * s, y + 40 * s);
    g.lineTo(x + 0 * s, y + 40 * s);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillRect(x + 18 * s, y + 56 * s, 54 * s, 10 * s);
  }

  function flamePath(g, x, y, w, h) {
    const pts = [
      x + w * 0.5, y + h,
      x + w * 0.25, y + h * 0.85,
      x + w * 0.15, y + h * 0.60,
      x + w * 0.35, y + h * 0.40,
      x + w * 0.45, y + h * 0.15,
      x + w * 0.50, y + h * 0.05,
      x + w * 0.55, y + h * 0.15,
      x + w * 0.65, y + h * 0.40,
      x + w * 0.85, y + h * 0.60,
      x + w * 0.75, y + h * 0.85
    ];
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }

  function drawArchedDoor(g, x, y, w, h, col = 0x3b2b1b, stroke = 0x24170e) {
    g.fillStyle(col, 1);
    g.lineStyle(2, stroke, 1);
    g.beginPath();
    g.moveTo(x, y + 20);
    g.lineTo(x, y + h);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w, y + 20);
    g.arc(x + w / 2, y + 20, w / 2, 0, Math.PI, true);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.lineBetween(x + w * 0.33, y + 28, x + w * 0.33, y + h - 2);
    g.lineBetween(x + w * 0.66, y + 28, x + w * 0.66, y + h - 2);
    g.fillStyle(stroke, 1).fillCircle(x + w * 0.72, y + h * 0.56, 4);
  }

  // ================= Haus =================

  window.makeArchivschmiedeTexture = function (scene, key = 'tx_archivschmiede', cfg = {}) {
    if (scene.textures.exists(key)) return scene.textures.get(key);

    const W = cfg.w || 360, H = cfg.h || 220;
    const PAD = 1;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    const pad = 14;
    const bodyX = pad, bodyY = 40, bodyW = W - pad * 2, bodyH = H - 60;

    // Wand
    g.fillStyle(0x6a5a49, 1).fillRect(bodyX - 2, bodyY - 2, bodyW + 4, bodyH + 4);
    drawBricks(g, bodyX, bodyY, bodyW, bodyH, 24, 14, 2, 0xb19b82);
    drawInnerFrame(g, bodyX, bodyY, bodyW, bodyH, 2, 0x1c1c1c);

    // Dach sauber
    drawGableRoof(g, bodyX, bodyY, bodyW, { h: 40, over: 12 });

    // Schild
    const signW = 220, signH = 36, signX = Math.round(W * 0.5 - signW * 0.5), signY = bodyY + 6;
    g.fillStyle(0x4a3b2b, 1).fillRoundedRect(signX - 4, signY - 4, signW + 8, signH + 8, 6);
    g.fillStyle(0xd8c7aa, 1).fillRoundedRect(signX, signY, signW, signH, 4);

    // Regal wieder wie vorher, detailreich
    const shelfX = bodyX + 16, shelfY = bodyY + 54, shelfW = 68, shelfH = bodyH - 80;
    g.fillStyle(0x3a2a1a, 1).fillRect(shelfX, shelfY, shelfW, shelfH);
    g.lineStyle(2, 0x1e140b, 1).strokeRect(shelfX, shelfY, shelfW, shelfH);
    g.fillStyle(0x4b3723, 1);
    for (let i = 1; i <= 4; i++) {
      const yy = shelfY + (shelfH / 5) * i;
      g.fillRect(shelfX + 2, yy - 2, shelfW - 4, 4);
      g.fillStyle(0x2d1f12, 1).fillRect(shelfX + 2, yy - 3, shelfW - 4, 1);
      g.fillStyle(0x4b3723, 1);
    }
    // Regal 1
    g.fillStyle(0x7a4b3b, 1).fillRect(shelfX + 8, shelfY + 8, 10, 20);
    g.fillStyle(0x5a3b2b, 1).fillRect(shelfX + 9, shelfY + 10, 8, 2);
    g.lineStyle(1, 0x8b5b3b, 1).lineBetween(shelfX + 13, shelfY + 8, shelfX + 13, shelfY + 28);
    g.fillStyle(0x2d586b, 1).fillRect(shelfX + 20, shelfY + 6, 8, 24);
    g.fillStyle(0xd8c7aa, 1).fillRect(shelfX + 21, shelfY + 8, 6, 1);
    g.fillRect(shelfX + 21, shelfY + 12, 4, 1);
    g.fillStyle(0x7a6b2d, 1).fillRect(shelfX + 30, shelfY + 10, 12, 18);
    g.fillStyle(0x6b5b1d, 1).fillRect(shelfX + 31, shelfY + 12, 10, 2);
    g.fillStyle(0xead7c2, 1).fillRect(shelfX + 32, shelfY + 14, 8, 1);
    g.fillStyle(0x5d4a2d, 1).fillRect(shelfX + 44, shelfY + 8, 9, 22);
    g.lineStyle(1, 0x3d2a1d, 1).lineBetween(shelfX + 48, shelfY + 8, shelfX + 48, shelfY + 30);
    // Regal 2
    const r2y = shelfY + (shelfH / 5) * 1 + 4;
    g.fillStyle(0x8b2d2d, 1).fillRect(shelfX + 6, r2y, 11, 18);
    g.fillStyle(0xd8c7aa, 1).fillRect(shelfX + 7, r2y + 2, 9, 1);
    g.fillStyle(0x6b1d1d, 1).fillRect(shelfX + 7, r2y + 16, 9, 1);
    g.fillStyle(0x2d4a5d, 1).fillRect(shelfX + 19, r2y + 2, 10, 16);
    g.fillStyle(0x1d3a4d, 1).fillRect(shelfX + 20, r2y + 4, 8, 2);
    g.fillStyle(0xb8a792, 1).fillRect(shelfX + 21, r2y + 8, 6, 1);
    g.fillStyle(0x4a2d5d, 1).fillRect(shelfX + 31, r2y, 8, 19);
    g.fillStyle(0x6a4d7d, 1).fillRect(shelfX + 32, r2y + 2, 6, 1);
    g.fillStyle(0x5d5d2d, 1).fillRect(shelfX + 41, r2y + 3, 12, 15);
    g.fillStyle(0x4d4d1d, 1).fillRect(shelfX + 42, r2y + 5, 10, 2);
    // Regal 3
    const r3y = shelfY + (shelfH / 5) * 2 + 4;
    g.fillStyle(0x3b7a4b, 1).fillRect(shelfX + 7, r3y, 9, 17);
    g.fillStyle(0x2b6a3b, 1).fillRect(shelfX + 8, r3y + 2, 7, 1);
    g.fillStyle(0xead7c2, 1).fillRect(shelfX + 8, r3y + 6, 5, 1);
    g.fillStyle(0x6b4b2d, 1).fillRect(shelfX + 18, r3y + 1, 11, 16);
    g.fillStyle(0x5b3b1d, 1).fillRect(shelfX + 19, r3y + 3, 9, 2);
    g.fillStyle(0xd8c7aa, 1).fillRect(shelfX + 20, r3y + 7, 7, 1);
    g.fillStyle(0x4b6b7a, 1).fillRect(shelfX + 31, r3y, 10, 18);
    g.fillStyle(0xb8a792, 1).fillRect(shelfX + 32, r3y + 4, 8, 1);
    g.lineStyle(1, 0x3b5b6a, 1).lineBetween(shelfX + 36, r3y, shelfX + 36, r3y + 18);
    g.fillStyle(0x7a3b4b, 1).fillRect(shelfX + 43, r3y + 2, 8, 15);
    g.fillStyle(0x6a2b3b, 1).fillRect(shelfX + 44, r3y + 4, 6, 1);
    // Regal 4
    const r4y = shelfY + (shelfH / 5) * 3 + 4;
    g.fillStyle(0x6b5d4b, 1).fillRect(shelfX + 8, r4y, 8, 15);
    g.fillStyle(0x5b4d3b, 1).fillRect(shelfX + 9, r4y + 2, 6, 1);
    g.fillStyle(0xead7c2, 1).fillRect(shelfX + 9, r4y + 6, 4, 1);
    g.fillStyle(0xd8c7aa, 1); g.fillCircle(shelfX + 24, r4y + 8, 4);
    g.fillStyle(0xc8b79a, 1).fillCircle(shelfX + 24, r4y + 8, 2);
    g.fillStyle(0x8b2d2d, 1).fillRect(shelfX + 22, r4y + 7, 4, 2);
    g.fillStyle(0xd8c7aa, 1); g.fillCircle(shelfX + 32, r4y + 6, 4);
    g.fillStyle(0xc8b79a, 1).fillCircle(shelfX + 32, r4y + 6, 2);
    g.fillStyle(0x2d4a5d, 1).fillRect(shelfX + 30, r4y + 5, 4, 2);
    g.fillStyle(0xd8c7aa, 1); g.fillCircle(shelfX + 40, r4y + 10, 4);
    g.fillStyle(0xc8b79a, 1).fillCircle(shelfX + 40, r4y + 10, 2);
    g.fillStyle(0x5d5d2d, 1).fillRect(shelfX + 38, r4y + 9, 4, 2);
    g.fillStyle(0x4a3b2b, 1).fillRect(shelfX + 46, r4y + 2, 12, 14);
    g.fillStyle(0x6a5b4b, 1).fillRect(shelfX + 47, r4y + 4, 10, 2);
    g.fillStyle(0x8b7a6b, 1);
    g.fillRect(shelfX + 48, r4y + 6, 2, 2);
    g.fillRect(shelfX + 54, r4y + 6, 2, 2);
    g.fillStyle(0xead7c2, 1).fillRect(shelfX + 48, r4y + 10, 6, 1);

    // Laterne
    const lx = bodyX + 98, ly = bodyY + 58;
    g.lineStyle(3, 0x2a2a2a, 1);
    g.lineBetween(lx - 22, ly - 16, lx, ly - 6);
    g.fillStyle(0x2a2a2a, 1).fillRect(lx - 6, ly - 6, 12, 4);
    g.fillStyle(0xffe2a8, 1).fillRoundedRect(lx - 10, ly - 4, 20, 28, 4);
    g.lineStyle(2, 0x2a2a2a, 1).strokeRoundedRect(lx - 10, ly - 4, 20, 28, 4);
    g.fillStyle(0xffe2a8, 0.18).fillCircle(lx, ly + 6, 26);

    // Tuer
    const doorW = 68, doorH = 92, doorX = Math.round(W * 0.5 - doorW * 0.5), doorY = bodyY + bodyH - doorH - 10;
    drawArchedDoor(g, doorX, doorY, doorW, doorH);

    // Banner
    const banW = 26, banH = 96, banX = bodyX + bodyW - banW - 16, banY = bodyY + 40;
    g.fillStyle(0x7a2b2b, 1).fillRect(banX, banY, banW, banH);
    g.fillStyle(0x3b0f0f, 1).fillRect(banX, banY + banH - 16, banW, 16);
    g.lineStyle(2, 0xead7c2, 1);
    g.strokeCircle(banX + banW / 2, banY + banH / 2, 8);
    g.lineBetween(banX + banW / 2, banY + banH / 2 - 8, banX + banW / 2, banY + banH / 2 + 8);

    // Render
    const rt = scene.make.renderTexture({ x: 0, y: 0, width: W + PAD * 2, height: H + PAD * 2, add: false });
    rt.draw(g, PAD, PAD);

    // Label schaerfer
    const txt = scene.add.text(W / 2 + PAD, signY + signH * 0.5 + PAD, 'ARCHIVSCHMIEDE', {
      fontFamily: 'serif',
      fontSize: 40,
      resolution: 2,
      color: '#2a2016'
    }).setOrigin(0.5);
    txt.setScale(0.5);
    rt.draw(txt);
    txt.destroy();

    rt.saveTexture(key);
    g.destroy(); rt.destroy();

    scene.textures.get(key).customData = {
      size: { w: W + PAD * 2, h: H + PAD * 2 },
      door: { x: doorX + PAD, y: doorY + PAD, w: doorW, h: doorH }
    };
    return scene.textures.get(key);
  };

  window.placeArchivschmiede = function (scene, x, y, key = 'tx_archivschmiede', opts = {}) {
    if (!scene.textures.exists(key)) makeArchivschmiedeTexture(scene, key, opts);
    const tex = scene.textures.get(key);
    const img = scene.add.image(Math.round(x), Math.round(y), key).setOrigin(0, 1).setDepth(opts.depth || 4);
    return { img, glow: null, meta: tex.customData };
  };

  // ================= Anbau =================

  function makeAnvilShedTexture(scene, key = 'tx_anvil_shed') {
    /*if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const W = 180, H = 220;

    const shedX = 20, shedY = 55, shedW = W - 40, shedH = H - 75;

    // Wand
    g.fillStyle(0x5a4a39, 1).fillRect(shedX - 2, shedY - 2, shedW + 4, shedH + 4);
    drawBricks(g, shedX, shedY, shedW, shedH, 24, 14, 2, 0xb19b82);
    drawInnerFrame(g, shedX, shedY, shedW, shedH, 2, 0x1c1c1c);

    // Dach wie beim Haus
    drawGableRoof(g, shedX, shedY, shedW, { h: 45, over: 12 });

    const openW = shedW - 20;
    const archBaseY = shedY + (shedH - 36);

    const forgeW = 64, forgeH = 46;
    const forgeX = shedX + shedW - forgeW - 22;
    const forgeY = archBaseY + 20 - forgeH;

    // Pfeiler und Bogen vorne
    g.fillStyle(0x4a3a29, 1);
    g.fillRect(shedX + 6, shedY + 8, 12, shedH - 8);
    g.fillRect(shedX + shedW - 18, shedY + 8, 12, shedH - 8);

    // Öffnung
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(shedX + 10, archBaseY, openW, 10);
    g.beginPath();
    g.arc(shedX + shedW / 2, archBaseY + 35, (openW / 2)+8, Math.PI, 0);
    g.fillPath();

    // Oeffnung hochgezogen mit elliptischem Bogen
    const joinY = archBaseY;                  // Federhoehe des Bogens
    const baseY = shedY + shedH - 12;         // wie weit die Oeffnung nach unten reicht
    const cx = shedX + shedW / 2;
    const rx = (openW / 2) + 8;               // Breite der Kappe
    const ry = 62;                            // Hoehe der Kappe  → macht es hochgezogen

    // Ellipse fuer die obere Haelfte des Bogens
    const curve = new Phaser.Curves.Ellipse(cx, joinY, rx, ry);
    curve.setStartAngle(180);                  // von links
    curve.setEndAngle(360);                    // nach rechts, obere Haelfte
    curve.setClockwise(true);

    const pts = curve.getPoints(48);           // Stuetzpunkte fuer den Bogen

    g.fillStyle(0x1a1a1a, 1);
    g.beginPath();
    // linke Wange hoch
    g.moveTo(shedX + 10, baseY);
    g.lineTo(shedX + 10, joinY);

    // elliptischer Bogen oben
    for (let i = 0; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }

    // rechte Wange runter
    g.lineTo(shedX + 10 + openW, joinY);
    g.lineTo(shedX + 10 + openW, baseY);

    g.closePath();
    g.fillPath();

    // optionale Kontur fuer eine saubere obere Kante
    g.lineStyle(6, 0x1a1a1a, 1);
    curve.draw(g, 48);

    // Feuer zuerst, damit es hinter der Oeffnung liegt
    g.fillStyle(0x2a1d15, 1).fillRoundedRect(forgeX - 2, forgeY - 2, forgeW + 4, forgeH + 4, 4);
    g.fillStyle(0x4b2f1f, 1).fillRoundedRect(forgeX, forgeY, forgeW, forgeH, 3);
    g.fillStyle(0xff5a1a, 0.95); flamePath(g, forgeX + 10, forgeY + 10, forgeW - 20, forgeH - 18); g.fillPath();
    g.fillStyle(0xffc04a, 0.75); flamePath(g, forgeX + 16, forgeY + 16, forgeW - 32, forgeH - 28); g.fillPath();
    g.fillStyle(0xfff08a, 0.55); flamePath(g, forgeX + 22, forgeY + 20, forgeW - 44, forgeH - 36); g.fillPath();

    // Kleiner Tisch + Amboss links
    const tableX = shedX + 24, tableY = shedY + shedH - 40;
    g.fillStyle(0x3a2a1a, 1).fillRect(tableX, tableY, 50, 10);
    g.fillRect(tableX + 4, tableY + 10, 8, 15);
    g.fillRect(tableX + 38, tableY + 10, 8, 15);
    drawAnvil(g, tableX + 6, tableY - 25, 0.6);

    // Werkzeuge
    g.lineStyle(3, 0x4a4a4a, 1);
    g.lineBetween(shedX + 12, shedY + 25, shedX + 12, shedY + 55);
    g.lineBetween(shedX + 18, shedY + 30, shedX + 18, shedY + 50);
    g.fillStyle(0x3a3a3a, 1);
    g.fillCircle(shedX + 12, shedY + 23, 5);
    g.fillRect(shedX + 14, shedY + 28, 8, 6);

    const rt = scene.make.renderTexture({ x: 0, y: 0, width: W, height: H, add: false });
    rt.draw(g);
    rt.saveTexture(key);
    g.destroy(); rt.destroy();
    return key;*/
  }

  window.placeAnvilShed = function (scene, x, y, depth) {
    const key = makeAnvilShedTexture(scene);
    const img = scene.add.image(Math.round(x), Math.round(y), key).setOrigin(0, 1).setDepth(depth);

    // Glow hinten
    const forgeGlow = scene.add.ellipse(img.x + 118, img.y - 70, 100, 75, 0xff8c3a, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 5);

    /*const anvilGlow = scene.add.ellipse(img.x + 50, img.y - 45, 55, 30, 0xffa43a, 0.10)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth + 1);*/

          const anvilGlow = null;


    scene.tweens.add({
      targets: [forgeGlow, anvilGlow],
      scaleX: { from: 0.95, to: 1.08 },
      scaleY: { from: 0.90, to: 1.12 },
      alpha:  { from: 0.12, to: 0.25 },
      duration: 800, yoyo: true, repeat: -1
    });

    if (scene.physics && scene.player) {
      const shedBody = scene.physics.add.staticImage(img.x + 90, img.y - 110, null).setSize(160, 160).setVisible(false);
      scene.physics.add.collider(scene.player, shedBody);
      const anvilBody = scene.physics.add.staticImage(img.x + 50, img.y - 50, null).setSize(55, 40).setVisible(false);
      scene.physics.add.collider(scene.player, anvilBody);
    }

    return { img, glow: forgeGlow, anvilGlow };
  };

})();