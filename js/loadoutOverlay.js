// Shared Loadout overlay — works in any Phaser scene (HubSceneV2 + GameScene).
// Reads/writes via window.AbilitySystem; manages its own scene-local state via
// scene._loadoutContainer / scene._loadoutSuppressUntil / scene._dialogOpen.
//
// Seit b399 im Stil der Faehigkeitsleiste (#195): Messing-Platte
// (uiRahmen), Faehigkeiten mit den Pixel-Icons aus hud_icons.png, Slots als
// Messingfelder mit Taste in der Ecke. Gesperrte Faehigkeiten stehen grau mit
// Hinweis auf den Talentbaum da (Erwerb laeuft weiter nur dort). Fehlen die
// Bilder, zeichnet das Overlay die fruehere Darstellung (Kasten + Emoji).
// Auch Mobile oeffnet dieses Overlay (Menue -> Loadout); alle Trefferflaechen
// sind mindestens 44 px gross.

(function () {
  if (window.i18n) {
    window.i18n.register('de', {
      'loadout.title': 'Fähigkeiten-Loadout',
      'loadout.hint': 'Klicke auf einen Slot, dann auf eine erlernte Fähigkeit. ESC zum Schließen.',
      'loadout.hint_touch': 'Tippe auf einen Slot, dann auf eine erlernte Fähigkeit.',
      'loadout.hint_slot': 'Wähle eine Fähigkeit für {slot}.',
      'loadout.pool_header': 'Fähigkeiten',
      'loadout.status.locked': 'Gesperrt',
      'loadout.status.equipped': 'Ausgerüstet · {slot}',
      'loadout.status.free': 'Frei',
      'loadout.locked_tip': 'Noch nicht erlernt — schalte sie im Talentbaum frei.',
      'loadout.equipped_tip': 'Ausgerüstet auf {slot}',
      'loadout.empty_slot': 'Leer',
      'loadout.close': 'Schließen'
    });
    window.i18n.register('en', {
      'loadout.title': 'Ability Loadout',
      'loadout.hint': 'Click a slot, then a learned ability. Press ESC to close.',
      'loadout.hint_touch': 'Tap a slot, then a learned ability.',
      'loadout.hint_slot': 'Choose an ability for {slot}.',
      'loadout.pool_header': 'Abilities',
      'loadout.status.locked': 'Locked',
      'loadout.status.equipped': 'Equipped · {slot}',
      'loadout.status.free': 'Free',
      'loadout.locked_tip': 'Not learned yet — unlock it in the talent tree.',
      'loadout.equipped_tip': 'Equipped on {slot}',
      'loadout.empty_slot': 'Empty',
      'loadout.close': 'Close'
    });
  }
  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  // Farben wie in der Faehigkeitsleiste: Messing auf Anthrazit, Grau fuer
  // gesperrt/leer, Gold fuer ausgeruestet. Alle >= 4,5:1 auf dem Feld.
  const MESSING = '#f3e6c4';
  const GRAU = '#bdb4a6';
  const GOLD = '#ffd166';
  const FREI = '#b8e0a8';
  const MIN_TREFFER = 44;

  /** Taste eines Slots wie in der Leiste: Q W E R bzw. 1-4 (ARPG-Schema). */
  function tasteVon(slot, idx) {
    const IS = window.InputScheme;
    if (IS && typeof IS.getSlotLabel === 'function') {
      const t = IS.getSlotLabel(idx + 1);
      if (t) return t;
    }
    return (window.AbilitySystem.SLOT_KEY_LABELS || {})[slot] || slot;
  }

  /**
   * Der Spieler hat selbst eine Faehigkeit auf eine Taste gelegt — das traegt
   * die Einfuehrung "Wofuer du taugst". Bewusst hier und nicht in
   * AbilitySystem.setSlot: dort landen auch Laden, Endlosmodus und Debug.
   */
  function loadoutGemeldet() {
    if (window.questSystem && typeof window.questSystem.onSystemUsed === 'function') {
      try { window.questSystem.onSystemUsed('loadout'); } catch (e) { /* swallow */ }
    }
  }
  window.loadoutGemeldet = loadoutGemeldet;

  function openLoadoutUI(scene) {
    if (!scene || !window.AbilitySystem) {
      console.warn('[LoadoutOverlay] missing scene or AbilitySystem');
      return;
    }
    if (scene._loadoutContainer) return;
    if (scene._loadoutSuppressUntil && scene.time.now < scene._loadoutSuppressUntil) return;
    if (scene._dialogOpen) return;

    scene._dialogOpen = true;

    const AS = window.AbilitySystem;
    const UR = window.uiRahmen;
    const HL = window.hudLeiste;
    // Messing nur, wenn der ganze Bildsatz da ist; Icons unabhaengig davon.
    const messing = !!(UR && UR.bereit(scene));
    const icons = !!(HL && HL.bereit(scene));
    const touch = !!(scene.sys && scene.sys.game && scene.sys.game.device
      && scene.sys.game.device.input && scene.sys.game.device.input.touch);

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
    // Rekursiv scrollFactor 0, sonst verfehlen Taps im Hub (Kamera folgt).
    const fest = (o) => { o.setScrollFactor(0); container.add(o); return o; };

    if (messing) {
      UR.menuePlatte(scene, 0, 0, panelW, panelH, 2001).forEach((t) => { t._loadoutPlatte = true; fest(t); });
    } else {
      const bg = scene.add.graphics();
      bg.fillStyle(0x0a0a12, 0.97).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
      bg.lineStyle(3, 0x4a86ff, 0.9).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
      fest(bg);
    }

    fest(scene.add.text(0, -panelH / 2 + 18, T('loadout.title'), {
      fontFamily: 'serif',
      fontSize: 28,
      color: messing ? '#ffd98a' : '#e8d4b8'
    }).setOrigin(0.5, 0));

    const hint = fest(scene.add.text(0, -panelH / 2 + 54, '', {
      fontFamily: 'monospace',
      fontSize: 14,
      color: messing ? '#d8cbb0' : '#a0b0d0'
    }).setOrigin(0.5, 0));

    let selectedSlot = null;

    // ---- Pool grid ----
    // Horizontal cell layout (icon left, name + status right) — keeps cells
    // short so the grid + slot bar both fit inside the 480px game canvas.
    const poolStartY = -panelH / 2 + 80;
    const allDefs = AS.getAllAbilityDefs();
    const cellW = 196;
    const cellH = 56;
    const gap = 10;
    const cols = Math.max(3, Math.min(4, Math.floor((panelW - 60) / (cellW + gap))));

    fest(scene.add.text(-panelW / 2 + 32, poolStartY, T('loadout.pool_header'), {
      fontFamily: 'serif',
      fontSize: 16,
      color: messing ? '#ffd98a' : '#c8d8ff'
    }).setOrigin(0, 0));

    const gridStartY = poolStartY + 26;
    const poolGfxList = [];

    /** Icon einer Faehigkeit: Pixel-Icon (grau = gesperrt), sonst das Emoji. */
    const iconFuer = (def, x, y, grau) => {
      const f = icons ? HL.frame(def.id, grau) : -1;
      if (f >= 0) {
        const img = scene.add.image(x, y, 'hud_icons', f).setDisplaySize(40, 40);
        img._loadoutIcon = def.id;
        return img;
      }
      return scene.add.text(x, y, def.icon || '?', {
        fontFamily: 'serif',
        fontSize: 18,
        color: grau ? GRAU : '#ffffff'
      }).setOrigin(0.5);
    };

    const renderPool = () => {
      poolGfxList.forEach((g) => g.destroy());
      poolGfxList.length = 0;

      // 060 WP03: Erwerb läuft ausschließlich über den Skill-Baum. Erlernte
      // Faehigkeiten stehen vorn und lassen sich zuweisen; ungelernte stehen
      // grau dahinter und verweisen auf den Talentbaum.
      const learnedSet = new Set(AS.getLearnedAbilities());
      const byName = (a, b) => a.name.localeCompare(b.name);
      const ordered = allDefs.filter((d) => learnedSet.has(d.id)).sort(byName)
        .concat(allDefs.filter((d) => !learnedSet.has(d.id)).sort(byName));

      ordered.forEach((def, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = -((cols * (cellW + gap)) - gap) / 2 + col * (cellW + gap) + cellW / 2;
        const cy = gridStartY + row * (cellH + gap) + cellH / 2;

        const locked = !learnedSet.has(def.id);
        const slot = locked ? null : AS.getSlotForAbility(def.id);
        const slotLabel = slot ? tasteVon(slot, AS.SLOT_KEYS.indexOf(slot)) : null;
        const zeig = (o) => { fest(o); poolGfxList.push(o); return o; };

        // Feld: Messing (gesperrt mit abgedunkelter Mitte), sonst der alte Kasten.
        let cell;
        if (messing) {
          cell = zeig(scene.add.image(cx, cy, UR.feldBild(scene, cellW, cellH, false, locked ? '#0b090c' : null)));
          cell._loadoutPool = def.id;
        } else {
          cell = scene.add.graphics();
          const stroke = slot ? 0xffd166 : (locked ? 0x4a4a66 : def.color);
          cell.fillStyle(0x1a2238, 0.95).fillRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 10);
          cell.lineStyle(slot ? 3 : 2, stroke, 0.95).strokeRoundedRect(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 10);
          zeig(cell);
        }

        // Icon links, Name und Zustand rechts — getrennte Bereiche, keine Ueberlappung.
        zeig(iconFuer(def, cx - cellW / 2 + 28, cy, locked));
        const textX = cx - cellW / 2 + 54;
        const textW = cellW - 62;
        zeig(scene.add.text(textX, cy + 3, def.name, {
          fontFamily: 'monospace',
          fontSize: 12,
          fontStyle: 'bold',
          color: locked ? GRAU : MESSING,
          wordWrap: { width: textW },
          lineSpacing: 1
        }).setOrigin(0, 1).setMaxLines(2));
        const status = locked ? T('loadout.status.locked')
          : (slot ? T('loadout.status.equipped', { slot: slotLabel }) : T('loadout.status.free'));
        const statusTxt = zeig(scene.add.text(textX, cy + 6, status, {
          fontFamily: 'monospace',
          fontSize: 11,
          color: locked ? GRAU : (slot ? GOLD : FREI)
        }).setOrigin(0, 0));
        statusTxt._loadoutStatus = def.id;

        const hit = scene.add.zone(container.x + cx, container.y + cy, cellW, cellH)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2002)
          .setInteractive({ useHandCursor: !locked });
        hit._loadout = { art: 'pool', id: def.id, locked: locked };
        poolGfxList.push(hit);

        const tipText = () => {
          let tip = def.name + '\n' + def.description;
          if (locked) tip += '\n' + T('loadout.locked_tip');
          else if (slot) tip += '\n' + T('loadout.equipped_tip', { slot: slotLabel });
          return tip;
        };
        hit.on('pointerover', () => {
          if (messing && !locked && cell.scene) cell.setTexture(UR.feldBild(scene, cellW, cellH, true));
          tooltip.setText(tipText());
          tooltip.setVisible(true);
        });
        hit.on('pointerout', () => {
          if (messing && !locked && cell.scene) cell.setTexture(UR.feldBild(scene, cellW, cellH, false));
          tooltip.setVisible(false);
        });
        hit.on('pointerdown', () => {
          // Gesperrt: nur erklaeren (auf Mobile gibt es kein Hover).
          if (locked) {
            tooltip.setText(tipText());
            tooltip.setVisible(true);
            return;
          }
          let gelegt;
          if (!selectedSlot) {
            let target = AS.SLOT_KEYS.find((s) => !AS.getActiveLoadout()[s]);
            if (!target) target = 'slot1';
            gelegt = AS.setSlot(target, def.id);
          } else {
            gelegt = AS.setSlot(selectedSlot, def.id);
            selectedSlot = null;
          }
          if (gelegt) loadoutGemeldet();
          renderAll();
        });
      });
    };

    // ---- Slot bar ----
    // Messingfelder wie in der Faehigkeitsleiste, Taste klein oben links.
    // Tooltip sits above so it never collides.
    const slotW = 170;
    const slotH = 64;
    const slotGap = 16;
    const slotBarY = panelH / 2 - 26 - slotH / 2;
    const slotGfxList = [];

    const renderSlots = () => {
      slotGfxList.forEach((g) => g.destroy());
      slotGfxList.length = 0;

      const loadout = AS.getActiveLoadout();
      const slots = AS.SLOT_KEYS;
      const totalW = slots.length * slotW + (slots.length - 1) * slotGap;
      const startX = -totalW / 2 + slotW / 2;

      slots.forEach((slot, i) => {
        const cx = startX + i * (slotW + slotGap);
        const cy = slotBarY;
        const abilityId = loadout[slot];
        const def = abilityId ? AS.getAbilityDef(abilityId) : null;
        const isSelected = selectedSlot === slot;
        const zeig = (o) => { fest(o); slotGfxList.push(o); return o; };
        const taste = tasteVon(slot, i);

        if (messing) {
          // Gewaehlter Slot = heller Beschlag (feld_gewaehlt), wie in der Schmiede.
          const feld = zeig(scene.add.image(cx, cy, UR.feldBild(scene, slotW, slotH, isSelected)));
          feld._loadoutSlot = slot;
          feld._loadoutGewaehlt = isSelected;
        } else {
          const slotG = scene.add.graphics();
          slotG.fillStyle(0x141828, 0.95).fillRoundedRect(cx - slotW / 2, cy - slotH / 2, slotW, slotH, 12);
          slotG.lineStyle(isSelected ? 4 : 2, isSelected ? 0xffd166 : (def ? def.color : 0x4a4a66), 0.95)
            .strokeRoundedRect(cx - slotW / 2, cy - slotH / 2, slotW, slotH, 12);
          zeig(slotG);
        }
        // Hover: zarter heller Schleier (der Beschlag zeigt die Auswahl).
        const schleier = zeig(scene.add.rectangle(cx, cy, slotW - 8, slotH - 8, 0xffffff, 0));

        // Taste oben links auf eigener dunkler Marke (immer lesbar);
        // beim gewaehlten Slot gold hinterlegt.
        const markeX = cx - slotW / 2 + 6, markeY = cy - slotH / 2 + 6;
        zeig(scene.add.rectangle(markeX, markeY, 18, 18, isSelected ? 0x5a4214 : 0x120e0b, 0.95)
          .setOrigin(0, 0).setStrokeStyle(1, isSelected ? 0xffd166 : 0xb08d57, 0.95));
        const tasteTxt = zeig(scene.add.text(markeX + 9, markeY + 9, taste, {
          fontFamily: 'monospace',
          fontSize: taste.length > 1 ? 10 : 13,
          fontStyle: 'bold',
          color: isSelected ? GOLD : MESSING
        }).setOrigin(0.5));
        tasteTxt._loadoutTaste = slot;

        const iconX = cx - slotW / 2 + 48;
        const textX = cx - slotW / 2 + 74;
        const textW = slotW - 82;
        if (def) {
          zeig(iconFuer(def, iconX, cy, false));
          zeig(scene.add.text(textX, cy, def.name, {
            fontFamily: 'monospace',
            fontSize: 12,
            fontStyle: 'bold',
            color: MESSING,
            wordWrap: { width: textW },
            lineSpacing: 1
          }).setOrigin(0, 0.5).setMaxLines(2));
        } else {
          zeig(scene.add.text(iconX - 8, cy, T('loadout.empty_slot'), {
            fontFamily: 'monospace',
            fontSize: 12,
            color: GRAU
          }).setOrigin(0, 0.5));
        }

        const hit = scene.add.zone(container.x + cx, container.y + cy, slotW, slotH)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2002)
          .setInteractive({ useHandCursor: true });
        hit._loadout = { art: 'slot', slot: slot };
        slotGfxList.push(hit);

        hit.on('pointerover', () => { if (schleier.scene) schleier.setFillStyle(0xffffff, 0.08); });
        hit.on('pointerout', () => { if (schleier.scene) schleier.setFillStyle(0xffffff, 0); });
        hit.on('pointerdown', () => {
          selectedSlot = (selectedSlot === slot) ? null : slot;
          renderAll();
        });
      });
    };

    // Tooltip ABOVE the slot bar so it can't overlap with slot tiles
    const tooltip = fest(scene.add.text(0, slotBarY - slotH / 2 - 8, '', {
      fontFamily: 'monospace',
      fontSize: 12,
      color: messing ? MESSING : '#ffe28a',
      align: 'center',
      wordWrap: { width: panelW - 80 }
    }).setOrigin(0.5, 1).setMaxLines(3).setVisible(false));

    const renderAll = () => {
      renderPool();
      renderSlots();
      hint.setText(selectedSlot
        ? T('loadout.hint_slot', { slot: tasteVon(selectedSlot, AS.SLOT_KEYS.indexOf(selectedSlot)) })
        : T(touch ? 'loadout.hint_touch' : 'loadout.hint'));
    };
    renderAll();

    // Schliessen-Knopf oben rechts: auf Mobile der einzige sichere Weg
    // hinaus (der Rand ausserhalb der Platte ist nur 10 px breit).
    const closeBtn = scene.add.text(0, 0, T('loadout.close'), {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#f1e9d8',
      backgroundColor: messing ? null : '#3a3a3a',
      padding: { left: 14, right: 14, top: 14, bottom: 14 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(2003);
    if (closeBtn.height < MIN_TREFFER) closeBtn.setPadding(14, 14 + Math.ceil((MIN_TREFFER - closeBtn.height) / 2));
    closeBtn.setPosition(container.x + panelW / 2 - 18, container.y - panelH / 2 + 12);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn._loadout = { art: 'close' };
    if (messing) UR.textKnopf(scene, closeBtn, '#f1e9d8');

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
      if (closeBtn.scene) closeBtn.destroy();
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
    closeBtn.on('pointerdown', close);
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
