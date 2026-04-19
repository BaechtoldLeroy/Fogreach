// Simple playground scene to compare terrain blending variants in isolation.
class TestTerrainScene extends Phaser.Scene {
  constructor() {
    super('TestTerrainScene');
    this._variantCache = new Map();
  }

  preload() {
    this.load.setPath('assets/sprites');
    this.load.image('ground', 'ground.png');
    this.load.image('ground_dirt', 'ground_dirt.png');
    this.load.image('ground_street', 'ground_street.png');
  }

  create() {
    const W = 1280;
    const H = 720;

    this.cameras.main.setBounds(0, 0, W, H);
    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.centerOn(W / 2, H / 2);

    this.add.rectangle(0, 0, W * 2, H * 2, 0x1a1a1a).setOrigin(0, 0).setDepth(-5);

    const sectionWidth = 380;
    const sectionHeight = 520;
    const marginX = 80;
    const marginY = 120;

    const sections = [
      { key: 'ground', label: 'Gras' },
      { key: 'ground_street', label: 'Strasse' },
      { key: 'ground_dirt', label: 'Dirt' },
    ];

    sections.forEach((section, idx) => {
      const sx = marginX + idx * (sectionWidth + 40);
      const sy = marginY;
      this._drawSection(sx, sy, sectionWidth, sectionHeight, section);
    });

    this.add.text(W / 2, 48, 'Terrain-Testfeld', {
      fontFamily: 'monospace',
      fontSize: 24,
      color: '#f0f0f0',
    }).setOrigin(0.5, 0.5);

    const help = [
      'Links: Basistile unverändert',
      'Mitte: Aktuelle Variant-Overlay-Logik',
      'Rechts: Vorschlag mit starkem Overblend (zum Vergleich)',
      '→ Szene über window.gotoTestTerrainScene() erneut laden',
    ];

    help.forEach((line, idx) => {
      this.add.text(W / 2, H - 96 + idx * 22, line, {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#d0d0d0',
      }).setOrigin(0.5, 0.5);
    });

    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.start('HubScene');
    });
  }

  _drawSection(x, y, width, height, section) {
    const label = this.add.text(x + width / 2, y - 40, section.label, {
      fontFamily: 'monospace',
      fontSize: 20,
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    const colWidth = Math.floor(width / 3);

    const colConfigs = [
      {
        title: 'Base',
        options: { useBaseTexture: true, coverEdges: true, jitter: 0 },
      },
      {
        title: 'Overlay',
        options: {
          useBaseTexture: true,
          coverEdges: true,
          overlayVariants: true,
          overlayAlpha: 0.45,
          overlayTintRange: 0.09,
          overlayJitter: 0.8,
        },
      },
      {
        title: 'Overlay Strong',
        options: {
          useBaseTexture: true,
          coverEdges: true,
          overlayVariants: true,
          overlayAlpha: 0.65,
          overlayTintRange: 0.18,
          overlayJitter: 1.6,
        },
      },
    ];

    colConfigs.forEach((colConfig, colIdx) => {
      const colX = x + colIdx * colWidth;
      const title = this.add.text(colX + colWidth / 2, y - 10, colConfig.title, {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#b0b0b0',
      }).setOrigin(0.5, 0.5);

      this._placeTiles(
        colX,
        y,
        colWidth,
        height,
        section.key,
        1,
        colConfig.options
      );

      if (colIdx < colConfigs.length - 1) {
        this.add.rectangle(colX + colWidth, y + height / 2, 2, height, 0x303030, 0.8)
          .setDepth(-1);
      }
    });

    // frame around section
    this.add.rectangle(x + width / 2, y + height / 2, width, height, 0xffffff, 0.08);
    this.add.rectangle(x + width / 2, y + height / 2, width, height)
      .setStrokeStyle(2, 0xffffff, 0.2);
  }

  _ensureVariants(textureKey) {
    if (this._variantCache.has(textureKey)) {
      return this._variantCache.get(textureKey);
    }
    const texture = this.textures.get(textureKey);
    if (!texture) {
      this._variantCache.set(textureKey, []);
      return [];
    }
    const baseImage = texture.getSourceImage();
    const w = baseImage.width;
    const h = baseImage.height;
    const count = 6;
    const keys = [];

    for (let i = 0; i < count; i++) {
      const key = `${textureKey}__test_variant_${i}`;
      if (this.textures.exists(key)) {
        keys.push(key);
        continue;
      }
      const canvas = this.textures.createCanvas(key, w, h);
      const ctx = canvas.context;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(baseImage, 0, 0, w, h);

      const fade = (dir, thickness) => {
        if (thickness <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = Phaser.Math.FloatBetween(0.45, 0.7);
        let gradient;
        switch (dir) {
          case 'left':
            gradient = ctx.createLinearGradient(thickness, 0, 0, 0);
            break;
          case 'right':
            gradient = ctx.createLinearGradient(w - thickness, 0, w, 0);
            break;
          case 'top':
            gradient = ctx.createLinearGradient(0, thickness, 0, 0);
            break;
          default:
            gradient = ctx.createLinearGradient(0, h - thickness, 0, h);
            break;
        }
        const edgeStrength = Phaser.Math.FloatBetween(0.55, 0.85);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${edgeStrength})`);
        ctx.fillStyle = gradient;
        if (dir === 'left') ctx.fillRect(0, 0, thickness, h);
        if (dir === 'right') ctx.fillRect(w - thickness, 0, thickness, h);
        if (dir === 'top') ctx.fillRect(0, 0, w, thickness);
        if (dir === 'bottom') ctx.fillRect(0, h - thickness, w, thickness);
        ctx.restore();
      };

      const fadeCorners = () => {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = Phaser.Math.FloatBetween(0.5, 0.75);
        const corners = [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: 0, y: h },
          { x: w, y: h },
        ];
        corners.forEach(({ x, y }) => {
          const radius = Phaser.Math.FloatBetween(w * 0.12, w * 0.22);
          const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
          const strength = Phaser.Math.FloatBetween(0.55, 0.8);
          grad.addColorStop(0, `rgba(0,0,0,${strength})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      };

      const applyNoise = () => {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.globalCompositeOperation = 'multiply';
        const passes = 3;
        for (let p = 0; p < passes; p++) {
          const shade = Phaser.Math.Between(205, 240);
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          const fw = Phaser.Math.FloatBetween(w * 0.45, w * 0.75);
          const fh = Phaser.Math.FloatBetween(h * 0.45, h * 0.75);
          const fx = Phaser.Math.FloatBetween(-w * 0.25, w * 0.25);
          const fy = Phaser.Math.FloatBetween(-h * 0.25, h * 0.25);
          ctx.fillRect(fx, fy, fw, fh);
        }
        ctx.restore();
      };

      fade('left', Phaser.Math.FloatBetween(w * 0.06, w * 0.16));
      fade('right', Phaser.Math.FloatBetween(w * 0.06, w * 0.16));
      fade('top', Phaser.Math.FloatBetween(h * 0.06, h * 0.16));
      fade('bottom', Phaser.Math.FloatBetween(h * 0.06, h * 0.16));
      fadeCorners();
      applyNoise();

      canvas.refresh();
      keys.push(key);
    }

    this._variantCache.set(textureKey, keys);
    return keys;
  }

  _placeTiles(x, y, w, h, textureKey, depth = 1, options = {}) {
    const TILE = 32;
    const tiles = [];
    const startX = Math.floor(x / TILE) * TILE;
    const startY = Math.floor(y / TILE) * TILE;
    const endX = Math.ceil((x + w) / TILE) * TILE;
    const endY = Math.ceil((y + h) / TILE) * TILE;
    const baseTexture = this.textures.get(textureKey);
    const scaleX = TILE / baseTexture.source[0].width;
    const scaleY = TILE / baseTexture.source[0].height;

    const {
      useBaseTexture = false,
      coverEdges = false,
      randomRotation = true,
      randomFlip = true,
      tintRange = 0.08,
      baseTint = 0xffffff,
      jitter = 0.4,
      overlayVariants = false,
      overlayBlend = Phaser.BlendModes.MULTIPLY,
      overlayAlpha = 0.5,
      overlayTintRange = 0.1,
      overlayJitter = 1.2,
    } = options;

    const tintClamp = (v) => Phaser.Math.Clamp(v, 0, 255);
    const variantKeys = useBaseTexture ? [] : this._ensureVariants(textureKey);
    const overlayKeys = overlayVariants ? this._ensureVariants(textureKey) : null;
    const baseLocked = useBaseTexture || overlayVariants;
    const effectiveRotation = baseLocked ? false : randomRotation;
    const effectiveFlip = baseLocked ? false : randomFlip;
    const effectiveJitter = baseLocked ? 0 : jitter;

    for (let ty = startY; ty < endY; ty += TILE) {
      for (let tx = startX; tx < endX; tx += TILE) {
        const centerX = tx + TILE / 2;
        const centerY = ty + TILE / 2;
        if (!coverEdges && (centerX < x || centerX >= x + w || centerY < y || centerY >= y + h)) {
          continue;
        }

        const chosenKey = (variantKeys && variantKeys.length)
          ? Phaser.Utils.Array.GetRandom(variantKeys)
          : textureKey;
        const baseKey = baseLocked ? textureKey : chosenKey;
        const tile = this.add.image(tx, ty, baseKey)
          .setOrigin(0, 0)
          .setScale(scaleX, scaleY)
          .setDepth(depth);

        if (effectiveRotation) {
          const angle = Phaser.Utils.Array.GetRandom([0, 90, 180, 270]);
          if (angle !== 0) tile.setAngle(angle);
        }
        if (effectiveFlip) {
          tile.setFlipX(Math.random() < 0.5);
          tile.setFlipY(Math.random() < 0.5);
        }
        if (tintRange > 0) {
          const factor = 1 + Phaser.Math.FloatBetween(-tintRange, tintRange);
          const color = Phaser.Display.Color.ValueToColor(baseTint);
          const r = tintClamp(color.red * factor);
          const g = tintClamp(color.green * factor);
          const b = tintClamp(color.blue * factor);
          tile.setTint(Phaser.Display.Color.GetColor(r, g, b));
        } else if (baseTint !== 0xffffff) {
          tile.setTint(baseTint);
        }
        if (effectiveJitter > 0) {
          tile.setPosition(
            tx + Phaser.Math.FloatBetween(-effectiveJitter, effectiveJitter),
            ty + Phaser.Math.FloatBetween(-effectiveJitter, effectiveJitter)
          );
        }
        tiles.push(tile);

        if (overlayKeys && overlayKeys.length) {
          const overlayKey = Phaser.Utils.Array.GetRandom(overlayKeys);
          const overlay = this.add.image(tx, ty, overlayKey)
            .setOrigin(0, 0)
            .setScale(scaleX, scaleY)
            .setDepth(depth + 0.01)
            .setBlendMode(overlayBlend)
            .setAlpha(overlayAlpha);

          if (randomRotation) {
            const angle = Phaser.Utils.Array.GetRandom([0, 90, 180, 270]);
            if (angle !== 0) overlay.setAngle(angle);
          }
          if (randomFlip) {
            overlay.setFlipX(Math.random() < 0.5);
            overlay.setFlipY(Math.random() < 0.5);
          }
          if (overlayTintRange > 0) {
            const factor = 1 + Phaser.Math.FloatBetween(-overlayTintRange, overlayTintRange);
            const color = Phaser.Display.Color.ValueToColor(baseTint);
            const r = tintClamp(color.red * factor);
            const g = tintClamp(color.green * factor);
            const b = tintClamp(color.blue * factor);
            overlay.setTint(Phaser.Display.Color.GetColor(r, g, b));
          }
          if (overlayJitter > 0) {
            overlay.setPosition(
              tx + Phaser.Math.FloatBetween(-overlayJitter, overlayJitter),
              ty + Phaser.Math.FloatBetween(-overlayJitter, overlayJitter)
            );
          }
          tiles.push(overlay);
        }
      }
    }
    return tiles;
  }
}
