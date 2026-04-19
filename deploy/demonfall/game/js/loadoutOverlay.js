// Shared Loadout overlay — works in any Phaser scene (HubSceneV2 + GameScene).
// Reads/writes via window.AbilitySystem; manages its own scene-local state via
// scene._loadoutContainer / scene._loadoutSuppressUntil / scene._dialogOpen.

(function () {
  if (window.i18n) {
    window.i18n.register('de', {
      'loadout.title': 'Fähigkeiten-Loadout',
      'loadout.hint': 'Klicke auf einen Slot, dann auf eine erlernte Fähigkeit. ESC zum Schliessen.',
      'loadout.pool_header': 'Erlernte & verfügbare Fähigkeiten',
      'loadout.locked': '[Gesperrt: {hint}]',
      'loadout.equipped': '[Ausgerüstet: {slot}]',
      'loadout.empty_slot': '(leer)'
    });
    window.i18n.register('en', {
      'loadout.title': 'Ability Loadout',
      'loadout.hint': 'Click a slot, then a learned ability. Press ESC to close.',
      'loadout.pool_header': 'Learned & available abilities',
      'loadout.locked': '[Locked: {hint}]',
      'loadout.equipped': '[Equipped: {slot}]',
      'loadout.empty_slot': '(empty)'
    });
  }
  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  function openLoadoutUI(scene) {
    if (!scene || !window.AbilitySystem) {
      console.warn('[LoadoutOverlay] missing scene or AbilitySystem');
      return;
    }
    if (scene._loadoutContainer) return;
    if (scene._loadoutSuppressUntil && scene.time.now < scene._loadoutSuppressUntil) return;
    if (scene._dialogOpen) return;

    scene._dialogOpen = true;

    const cam = scene.cameras.main;
    const cw = cam.width;
    const ch = cam.height;

    const overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.78)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    const panelW = Math.min(900, cw - 20);
    const panelH = Math.min(460, ch - 20);
    const container = scene.add.container(cw / 2, ch / 2).setDepth(2001).setScrollFactor(0);
    scene._loadoutContainer = container;

    const bg = scene.add.graphics();
    bg.fillStyle(0x0a0a12, 0.97).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    bg.lineStyle(3, 0x4a86ff, 0.9).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    container.add(bg);

    const title = scene.add.text(0, -panelH / 2 + 16, T('loadout.title'), {
      fontFamily: 'serif',
      fontSize: 28,
      color: '#e8d4b8'
    }).setOrigin(0.5, 0);
    container.add(title);

    const hint = scene.add.text(0, -panelH / 2 + 52, T('loadout.hint'), {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#a0b0d0'
    }).setOrigin(0.5, 0);
    container.add(hint);

    let selectedSlot = null;

    // ---- Pool grid ----
    // Horizontal cell layout (icon left, name right) — keeps cells short so the
    // grid + slot bar both fit inside the 480px game canvas.
    const poolStartY = -panelH / 2 + 76;
    const allDefs = window.AbilitySystem.getAllAbilityDefs();
    const cellW = 138;
    const cellH = 56;
    const gap = 10;
    const cols = Math.max(3, Math.min(5, Math.floor((panelW - 60) / (cellW + gap))));

    const poolText = scene.add.text(-panelW / 2 + 24, poolStartY, T('loadout.pool_header'), {
      fontFamily: 'serif',
      fontSize: 16,
      color: '#c8d8ff'
    }).setOrigin(0, 0);
    container.add(poolText);

    const gridStartY = poolStartY + 30;
    const poolGfxList = [];

    const renderPool = () => {
      poolGfxList.forEach((g) => g.destroy());
      poolGfxList.length = 0;

      const learned = window.AbilitySystem.getLearnedAbilities();
      const learnedSet = new Set(learned);
      const ordered = allDefs.slice().sort((a, b) => {
        const la = learnedSet.has(a.id) ? 0 : 1;
        const lb = learnedSet.has(b.id) ? 0 : 1;
        if (la !== lb) return la - lb;
        return a.name.localeCompare(b.name);
      });

      ordered.forEach((def, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = -((cols * (cellW + gap)) - gap) / 2 + col * (cellW + gap) + cellW / 2;
        const cy = gridStartY + row * (cellH + gap) + cellH / 2;

        const isLearnedDef = learnedSet.has(def.id);
        const equipped = window.AbilitySystem.isEquipped(def.id);

        const cell = scene.add.graphics();
        const fill = isLearnedDef ? 0x1a2238 : 0x0e0e16;
        const stroke = equipped ? 0xffd166 : (isLearnedDef ? def.color : 0x333344);
        cell.fillStyle(fill, 0.95).fillRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 10);
        cell.lineStyle(equipped ? 3 : 2, stroke, 0.95).strokeRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 10);
        container.add(cell);
        poolGfxList.push(cell);

        // Horizontal layout: icon on the left, name on the right.
        // The icon and the name occupy distinct horizontal regions so they
        // physically cannot overlap.
        const iconCx = cx - cellW / 2 + 22;
        const textCx = cx - cellW / 2 + 42;
        const textW = cellW - 50; // leave room for lock badge in top-right

        const icon = scene.add.text(iconCx, cy, def.icon || '?', {
          fontFamily: 'serif',
          fontSize: 18,
          color: isLearnedDef ? '#ffffff' : '#555566'
        }).setOrigin(0.5);
        container.add(icon);
        poolGfxList.push(icon);

        const nameTxt = scene.add.text(textCx, cy, def.name, {
          fontFamily: 'monospace',
          fontSize: 11,
          color: isLearnedDef ? '#e0e8ff' : '#888899',
          wordWrap: { width: textW },
          lineSpacing: 2
        }).setOrigin(0, 0.5).setMaxLines(2);
        container.add(nameTxt);
        poolGfxList.push(nameTxt);

        // Lock badge top-right corner
        if (!isLearnedDef) {
          const rule = window.AbilitySystem.getUnlockRule(def.id);
          if (rule) {
            const lockTxt = scene.add.text(cx + cellW / 2 - 6, cy - cellH / 2 + 4, '\u{1F512}', {
              fontFamily: 'serif',
              fontSize: 11,
              color: '#aa8855'
            }).setOrigin(1, 0);
            container.add(lockTxt);
            poolGfxList.push(lockTxt);
          }
        }

        const hit = scene.add.zone(container.x + cx, container.y + cy, cellW, cellH)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2002)
          .setInteractive({ useHandCursor: isLearnedDef });
        poolGfxList.push(hit);

        hit.on('pointerover', () => {
          let tip = def.name + '\n' + def.description;
          if (!isLearnedDef) {
            const rule = window.AbilitySystem.getUnlockRule(def.id);
            if (rule) tip += '\n' + T('loadout.locked', { hint: rule.hint });
          } else if (equipped) {
            const slot = window.AbilitySystem.getSlotForAbility(def.id);
            tip += '\n' + T('loadout.equipped', { slot: window.AbilitySystem.SLOT_KEY_LABELS[slot] || slot });
          }
          tooltip.setText(tip);
          tooltip.setVisible(true);
        });
        hit.on('pointerout', () => tooltip.setVisible(false));
        hit.on('pointerdown', () => {
          if (!isLearnedDef) return;
          if (!selectedSlot) {
            let target = window.AbilitySystem.SLOT_KEYS.find((s) => !window.AbilitySystem.getActiveLoadout()[s]);
            if (!target) target = 'slot1';
            window.AbilitySystem.setSlot(target, def.id);
          } else {
            window.AbilitySystem.setSlot(selectedSlot, def.id);
            selectedSlot = null;
          }
          renderAll();
        });
      });
    };

    // ---- Slot bar ----
    // Compact horizontal slot tiles. Tooltip sits above so it never collides.
    const slotW = 160;
    const slotH = 64;
    const slotGap = 16;
    const slotBarY = panelH / 2 - 28 - slotH / 2;
    const slotGfxList = [];

    const renderSlots = () => {
      slotGfxList.forEach((g) => g.destroy());
      slotGfxList.length = 0;

      const loadout = window.AbilitySystem.getActiveLoadout();
      const slots = window.AbilitySystem.SLOT_KEYS;
      const totalW = slots.length * slotW + (slots.length - 1) * slotGap;
      const startX = -totalW / 2 + slotW / 2;

      slots.forEach((slot, i) => {
        const cx = startX + i * (slotW + slotGap);
        const cy = slotBarY;
        const abilityId = loadout[slot];
        const def = abilityId ? window.AbilitySystem.getAbilityDef(abilityId) : null;
        const isSelected = selectedSlot === slot;

        const slotG = scene.add.graphics();
        slotG.fillStyle(0x141828, 0.95).fillRoundedRect(cx - slotW / 2, cy - slotH / 2, slotW, slotH, 12);
        slotG.lineStyle(isSelected ? 4 : 2, isSelected ? 0xffd166 : (def ? def.color : 0x4a4a66), 0.95)
          .strokeRoundedRect(cx - slotW / 2, cy - slotH / 2, slotW, slotH, 12);
        container.add(slotG);
        slotGfxList.push(slotG);

        // Horizontal slot layout: [key] | [icon] | [name]
        const keyCx = cx - slotW / 2 + 14;
        const iconCx = cx - slotW / 2 + 38;
        const textCx = cx - slotW / 2 + 56;
        const textW = slotW - 64;

        // Key letter badge — left side, large
        const keyLbl = scene.add.text(keyCx, cy, window.AbilitySystem.SLOT_KEY_LABELS[slot], {
          fontFamily: 'monospace',
          fontSize: 18,
          color: '#ffd166',
          fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(keyLbl);
        slotGfxList.push(keyLbl);

        if (def) {
          const icon = scene.add.text(iconCx, cy, def.icon || '?', {
            fontFamily: 'serif',
            fontSize: 18,
            color: '#ffffff'
          }).setOrigin(0.5);
          container.add(icon);
          slotGfxList.push(icon);

          const nameTxt = scene.add.text(textCx, cy, def.name, {
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#e0e8ff',
            wordWrap: { width: textW },
            lineSpacing: 2
          }).setOrigin(0, 0.5).setMaxLines(2);
          container.add(nameTxt);
          slotGfxList.push(nameTxt);
        } else {
          const empty = scene.add.text(iconCx + 8, cy, T('loadout.empty_slot'), {
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#666677'
          }).setOrigin(0, 0.5);
          container.add(empty);
          slotGfxList.push(empty);
        }

        const hit = scene.add.zone(container.x + cx, container.y + cy, slotW, slotH)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2002)
          .setInteractive({ useHandCursor: true });
        slotGfxList.push(hit);

        hit.on('pointerdown', () => {
          selectedSlot = (selectedSlot === slot) ? null : slot;
          renderAll();
        });
      });
    };

    // Tooltip ABOVE the slot bar so it can't overlap with slot tiles
    const tooltip = scene.add.text(0, slotBarY - slotH / 2 - 8, '', {
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#ffe28a',
      align: 'center',
      wordWrap: { width: panelW - 80 }
    }).setOrigin(0.5, 1).setMaxLines(3).setVisible(false);
    container.add(tooltip);

    const renderAll = () => {
      renderPool();
      renderSlots();
    };
    renderAll();

    const close = () => {
      // Hit zones are scene-level (NOT inside the container, because they
      // need world coords) so container.destroy(true) doesn't catch them.
      // Their pointerover closures reference `tooltip` — if we don't destroy
      // them explicitly, the next stray pointer event after close throws
      // "Cannot read properties of null (reading 'cut')" when it tries to
      // setText on the already-destroyed tooltip.
      poolGfxList.forEach((g) => { if (g && g.destroy) g.destroy(); });
      poolGfxList.length = 0;
      slotGfxList.forEach((g) => { if (g && g.destroy) g.destroy(); });
      slotGfxList.length = 0;
      if (scene._loadoutContainer) {
        scene._loadoutContainer.destroy(true);
        scene._loadoutContainer = null;
      }
      overlay.destroy();
      scene.input.keyboard.off('keydown-ESC', close);
      scene.input.keyboard.off('keydown-K', close);
      scene._dialogOpen = false;
      scene._loadoutSuppressUntil = (scene.time?.now || 0) + 200;
    };
    overlay.on('pointerdown', (pointer, lx, ly) => {
      if (Math.abs(lx - cw / 2) > panelW / 2 || Math.abs(ly - ch / 2) > panelH / 2) {
        close();
      }
    });
    scene.input.keyboard.on('keydown-ESC', close);
    scene.time.delayedCall(50, () => {
      if (scene._loadoutContainer) scene.input.keyboard.on('keydown-K', close);
    });
  }

  window.openLoadoutUI = openLoadoutUI;
})();
