// js/eventSystem.js — Random Dungeon Events
(function() {
  'use strict';

  var EVENT_TYPES = [
    {
      id: 'treasure_cache',
      name: 'Versteckter Schatz',
      weight: 15,
      minDepth: 1,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('pickup'); } catch (e) {}
        spawnEventChest(scene, 'chest_medium', false);
        showEventToast(scene, '🏴 Versteckter Schatz entdeckt!', 'treasure_cache');
      }
    },
    {
      id: 'ambush',
      name: 'Hinterhalt!',
      weight: 12,
      minDepth: 2,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
        triggerAmbush(scene);
      }
    },
    {
      id: 'wandering_merchant',
      name: 'Wandernder Haendler',
      weight: 15,
      minDepth: 3,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        spawnMerchant(scene);
      }
    },
    {
      id: 'trapped_chest',
      name: 'Verfluchte Truhe',
      weight: 8,
      minDepth: 2,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('enemy_hit'); } catch (e) {}
        spawnEventChest(scene, 'chest_large', true);
        showEventToast(scene, '💀 Eine verfluchte Truhe... vorsichtig!', 'trapped_chest');
      }
    },
    {
      id: 'lore_fragment',
      name: 'Altes Schriftstueck',
      weight: 12,
      minDepth: 1,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {
          try { window.soundManager && window.soundManager.playSFX('click'); } catch (e2) {}
        }
        spawnLoreFragment(scene);
      }
    },
    {
      id: 'environmental_hazard',
      name: 'Einsturzgefahr',
      weight: 7,
      minDepth: 4,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('hit'); } catch (e) {}
        triggerRockfall(scene);
      }
    }
  ];

  // --- Interactable event objects (spawn in room, player presses E to interact) ---

  var activeEventObjects = []; // track spawned event objects for cleanup

  function spawnEventObject(scene, texKey, color, glowColor, label, onInteract) {
    if (!scene || !scene.add || !scene.physics) return;

    // Generate detailed textures per event type
    if (!scene.textures.exists(texKey)) {
      var g = scene.make.graphics({ add: false });
      if (texKey === 'evt_fountain') {
        // Stone basin with glowing water
        g.fillStyle(0x555566, 1); g.fillRect(6, 20, 20, 10); // base
        g.fillStyle(0x666677, 1); g.fillRect(4, 18, 24, 4); // rim
        g.fillStyle(0x777788, 1); g.fillRect(8, 22, 16, 6); // inner
        g.fillStyle(0x3366aa, 0.8); g.fillEllipse(16, 24, 14, 5); // water
        g.fillStyle(0x44aaff, 0.4); g.fillEllipse(16, 23, 10, 3); // water glow
        g.fillStyle(0xffffff, 0.3); g.fillCircle(13, 23, 1.5); // reflection
        // Pillar
        g.fillStyle(0x666677, 1); g.fillRect(13, 6, 6, 14);
        g.fillStyle(0x777788, 1); g.fillRect(12, 4, 8, 4); // capital
        g.fillStyle(0x44aaff, 0.6); g.fillCircle(16, 4, 3); // glow orb
        g.fillStyle(0x88ddff, 0.3); g.fillCircle(16, 4, 5); // outer glow
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_shrine') {
        // Stone altar with purple crystal
        g.fillStyle(0x444455, 1); g.fillRect(6, 22, 20, 8); // base
        g.fillStyle(0x555566, 1); g.fillRect(4, 20, 24, 4); // top slab
        g.fillStyle(0x333344, 1); g.fillRect(10, 24, 4, 6); // left leg
        g.fillStyle(0x333344, 1); g.fillRect(18, 24, 4, 6); // right leg
        // Crystal
        g.fillStyle(0x6644aa, 1);
        g.beginPath(); g.moveTo(16, 6); g.lineTo(20, 18); g.lineTo(12, 18); g.closePath(); g.fillPath();
        g.fillStyle(0x8866cc, 0.7);
        g.beginPath(); g.moveTo(16, 8); g.lineTo(18, 16); g.lineTo(14, 16); g.closePath(); g.fillPath();
        g.fillStyle(0xaa88ff, 0.4); g.fillCircle(16, 12, 6); // glow
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_gamble') {
        // Wooden table with dice/coins
        g.fillStyle(0x6b4226, 1); g.fillRect(4, 16, 24, 12); // table top
        g.fillStyle(0x5a3a1a, 1); g.fillRect(6, 14, 20, 4); // table surface
        g.fillStyle(0x4a2a10, 1); g.fillRect(8, 26, 4, 4); // left leg
        g.fillStyle(0x4a2a10, 1); g.fillRect(20, 26, 4, 4); // right leg
        // Coins
        g.fillStyle(0xffd700, 1); g.fillCircle(11, 16, 2.5);
        g.fillStyle(0xffcc00, 1); g.fillCircle(14, 15, 2);
        g.fillStyle(0xffd700, 1); g.fillCircle(19, 16, 2.5);
        // Dice
        g.fillStyle(0xeeeeee, 1); g.fillRect(15, 12, 5, 5);
        g.fillStyle(0x111111, 1); g.fillCircle(16, 14, 0.5); g.fillCircle(19, 14, 0.5);
        g.generateTexture(texKey, 32, 32);
      } else {
        // Generic fallback
        g.fillStyle(color, 1); g.fillRect(4, 4, 24, 28);
        g.fillStyle(glowColor, 0.5); g.fillCircle(16, 16, 14);
        g.generateTexture(texKey, 32, 32);
      }
      g.destroy();
    }

    // Find accessible spawn position
    var cx = 400, cy = 250;
    if (scene.pickAccessibleSpawnPoint) {
      var spot = scene.pickAccessibleSpawnPoint({ maxAttempts: 30 });
      if (spot) { cx = spot.x; cy = spot.y; }
    } else if (typeof player !== 'undefined' && player && player.active) {
      var angle = Math.random() * Math.PI * 2;
      cx = player.x + Math.cos(angle) * 150;
      cy = player.y + Math.sin(angle) * 150;
    }

    var obj = scene.physics.add.sprite(cx, cy, texKey);
    obj.setDepth(45).setImmovable(true);
    obj.body.setAllowGravity(false);

    // Prompt text
    var prompt = scene.add.text(cx, cy - 24, '[E] ' + label, {
      fontSize: '12px', fill: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(500).setVisible(false);

    // Glow effect
    var glow = scene.add.graphics();
    glow.fillStyle(glowColor, 0.15);
    glow.fillCircle(cx, cy, 30);
    glow.setDepth(44);

    var used = false;
    var updateHandler = function () {
      if (used || !obj.active || typeof player === 'undefined' || !player) return;
      var dx = obj.x - player.x;
      var dy = obj.y - player.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      prompt.setVisible(dist < 80);
    };
    scene.events.on('update', updateHandler);

    // E key handler
    var interactHandler = function () {
      if (used || !obj.active || typeof player === 'undefined' || !player) return;
      var dx = obj.x - player.x;
      var dy = obj.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) > 80) return;
      used = true;
      scene.input.keyboard.off('keydown-E', interactHandler);
      scene.events.off('update', updateHandler);
      prompt.destroy();
      glow.destroy();
      obj.destroy();
      onInteract();
    };
    scene.input.keyboard.on('keydown-E', interactHandler);

    // Mobile interact support
    var mobileHandler = function () {
      if (!window.__MOBILE_INTERACT_ACTIVE__) return;
      interactHandler();
    };
    scene.events.on('update', mobileHandler);

    activeEventObjects.push({
      sprite: obj, prompt: prompt, glow: glow,
      interactHandler: interactHandler, updateHandler: updateHandler, mobileHandler: mobileHandler,
      scene: scene
    });
  }

  function cleanupEventObjects() {
    activeEventObjects.forEach(function (eo) {
      if (eo.scene && eo.scene.input && eo.scene.input.keyboard) {
        eo.scene.input.keyboard.off('keydown-E', eo.interactHandler);
      }
      if (eo.scene && eo.scene.events) {
        eo.scene.events.off('update', eo.updateHandler);
        eo.scene.events.off('update', eo.mobileHandler);
      }
      if (eo.sprite && eo.sprite.destroy) eo.sprite.destroy();
      if (eo.prompt && eo.prompt.destroy) eo.prompt.destroy();
      if (eo.glow && eo.glow.destroy) eo.glow.destroy();
    });
    activeEventObjects.length = 0;
  }

  // --- Choice-based events: spawn object, player interacts, then shows dialog ---

  EVENT_TYPES.push({
    id: 'shrine_buff',
    name: 'Mystischer Schrein',
    weight: 14,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, 'Ein mystischer Schrein erscheint...', 'shrine_buff');
      spawnEventObject(scene, 'evt_shrine', 0x6644aa, 0xaa88ff, 'Schrein', function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}
        showEventChoiceDialog(scene, 'Mystischer Schrein', [
          {
            label: 'Kraft (+25% Schaden, -15% Ruestung)',
            callback: function () {
              window.weaponDamage = Math.round((window.weaponDamage || 5) * 1.25);
              window.playerArmor = Math.max(0, Math.round((window.playerArmor || 0) * 0.85));
              showEventToast(scene, 'Kraft des Schreins: +25% Schaden!', 'shrine_buff');
            }
          },
          {
            label: 'Schutz (+5 Ruestung, -10% Geschw.)',
            callback: function () {
              window.playerArmor = Math.round((window.playerArmor || 0) + 5);
              window.playerSpeed = Math.round((window.playerSpeed || 200) * 0.9);
              showEventToast(scene, 'Schutz des Schreins: +5 Ruestung!', 'shrine_buff');
            }
          },
          { label: 'Ignorieren', callback: function () {} }
        ]);
      });
    }
  });

  EVENT_TYPES.push({
    id: 'gambling',
    name: 'Gluecksspiel',
    weight: 10,
    minDepth: 3,
    handler: function (scene) {
      var cost = 50 + Math.floor(Math.random() * 50);
      showEventToast(scene, 'Ein Spieltisch taucht auf...', 'gambling');
      spawnEventObject(scene, 'evt_gamble', 0x886622, 0xffcc44, 'Gluecksspiel', function () {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        showEventChoiceDialog(scene, 'Gluecksspiel (' + cost + ' Gold)', [
          {
            label: 'Wette ' + cost + ' Gold (40% Chance auf 3x)',
            callback: function () {
              if (!window.LootSystem || !window.LootSystem.spendGold(cost)) {
                showEventToast(scene, 'Nicht genug Gold!', 'gambling');
                return;
              }
              if (Math.random() < 0.4) {
                var winnings = cost * 3;
                if (typeof window.changeMaterialCount === 'function') window.changeMaterialCount('GOLD', winnings);
                showEventToast(scene, 'Gewonnen! +' + winnings + ' Gold!', 'gambling');
              } else {
                showEventToast(scene, 'Verloren! -' + cost + ' Gold...', 'gambling');
              }
            }
          },
          { label: 'Ablehnen', callback: function () {} }
        ]);
      });
    }
  });

  // Elite ambush — fires immediately (no interaction needed)
  EVENT_TYPES.push({
    id: 'elite_ambush',
    name: 'Elite-Hinterhalt',
    weight: 8,
    minDepth: 5,
    handler: function (scene) {
      try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
      showEventToast(scene, 'Ein maechtiger Feind naehert sich!', 'elite_ambush');
      if (typeof spawnMiniBoss === 'function') {
        scene.time.delayedCall(500, function () {
          spawnMiniBoss.call(scene, 0, 0, 0);
        });
      }
    }
  });

  // Healing fountain — spawn object, interact to choose
  EVENT_TYPES.push({
    id: 'healing_fountain',
    name: 'Heilender Brunnen',
    weight: 10,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, 'Ein leuchtender Brunnen erscheint...', 'healing_fountain');
      spawnEventObject(scene, 'evt_fountain', 0x2266aa, 0x44aaff, 'Brunnen', function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}
        showEventChoiceDialog(scene, 'Heilender Brunnen', [
          {
            label: 'Trinken (volle Heilung)',
            callback: function () {
              if (typeof window.setPlayerHealth === 'function' && typeof window.playerMaxHealth === 'number') {
                window.setPlayerHealth(window.playerMaxHealth);
              }
              showEventToast(scene, 'Volle Heilung!', 'healing_fountain');
            }
          },
          {
            label: 'Fuellen (+1 Portalrolle)',
            callback: function () {
              if (!window.materialCounts) window.materialCounts = {};
              window.materialCounts.PORTAL_SCROLL = (window.materialCounts.PORTAL_SCROLL || 0) + 1;
              showEventToast(scene, '+1 Portalrolle!', 'healing_fountain');
            }
          },
          { label: 'Ignorieren', callback: function () {} }
        ]);
      });
    }
  });

  var lastEventId = null;
  var recentEvents = []; // last 3 event IDs for anti-repetition

  function shouldTriggerEvent(depth) {
    var chance = 0.35 + (depth - 1) * 0.02;
    return Math.random() < Math.min(0.55, chance);
  }

  function pickEvent(depth) {
    var eligible = EVENT_TYPES.filter(function(e) {
      if (depth < e.minDepth) return false;
      if (e.id === lastEventId) return false;
      // Anti-repetition: reduce weight if event appeared in last 3
      return true;
    });
    // Soft anti-repetition: halve weight of recently seen events
    eligible = eligible.map(function(e) {
      var count = 0;
      for (var i = 0; i < recentEvents.length; i++) {
        if (recentEvents[i] === e.id) count++;
      }
      if (count > 0) return { id: e.id, name: e.name, weight: Math.max(1, Math.floor(e.weight / (count + 1))), minDepth: e.minDepth, handler: e.handler };
      return e;
    });
    if (!eligible.length) return null;

    var totalWeight = eligible.reduce(function(sum, e) { return sum + e.weight; }, 0);
    var roll = Math.random() * totalWeight;
    for (var i = 0; i < eligible.length; i++) {
      roll -= eligible[i].weight;
      if (roll <= 0) return eligible[i];
    }
    return eligible[eligible.length - 1];
  }

  var EVENT_ACCENT_COLORS = {
    treasure_cache:      0xf5c518,
    ambush:              0xff3333,
    wandering_merchant:  0x44ddaa,
    trapped_chest:       0xaa44ff,
    lore_fragment:       0x66bbff,
    environmental_hazard: 0xff8833
  };

  function showEventToast(scene, message, eventId) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 800;
    var cx = camW / 2;
    var cy = 80;

    var accentHex = EVENT_ACCENT_COLORS[eventId] || 0xffdd44;

    // Create label first to measure its width, then size the panel around it.
    var maxTextWidth = camW - 100;
    var label = scene.add.text(cx, cy, message, {
      fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: maxTextWidth, useAdvancedWrap: true },
      resolution: 2
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0).setAlpha(0);

    // Panel sized to fit the rendered text (+padding)
    var padX = 20, padY = 10;
    var panelW = Math.min(camW - 40, Math.ceil(label.width) + padX * 2);
    var panelH = Math.ceil(label.height) + padY * 2;

    var panel = scene.add.graphics();
    panel.fillStyle(0x0d0d1a, 0.88);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panel.lineStyle(2, accentHex, 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panel.setDepth(1999).setScrollFactor(0).setAlpha(0);

    var targets = [panel, label];

    if (scene.tweens && scene.tweens.add) {
      // Simple fade in (no scale — scale caused text to overflow panel)
      scene.tweens.add({
        targets: targets,
        alpha: 1,
        duration: 250,
        ease: 'Power2',
        onComplete: function() {
          // Hold, then fade out with upward drift
          scene.tweens.add({
            targets: targets,
            alpha: 0,
            y: '+=-30',
            delay: 3200,
            duration: 550,
            ease: 'Power2',
            onComplete: function() {
              panel.destroy();
              label.destroy();
            }
          });
        }
      });
    } else {
      setTimeout(function() {
        if (panel && panel.destroy) panel.destroy();
        if (label && label.destroy) label.destroy();
      }, 4000);
    }
  }

  // --- Wandering Merchant ---
  var activeMerchant = null;

  function spawnMerchant(scene) {
    if (!scene || !scene.add) return;
    cleanupMerchant();

    // Load merchant texture on-demand if not available
    var texKey = 'spaeherin';
    if (!scene.textures.exists(texKey)) {
      scene.load.image(texKey, 'assets/sprites/spaeherin.png');
      scene.load.once('complete', function() { _placeMerchant(scene, texKey); });
      scene.load.start();
    } else {
      _placeMerchant(scene, texKey);
    }
  }

  function _placeMerchant(scene, texKey) {
    if (!scene || !scene.add || !scene.physics) return;

    // Find an accessible position using the spawn system
    var cx = 400, cy = 250;
    if (scene.pickAccessibleSpawnPoint) {
      var spot = scene.pickAccessibleSpawnPoint({ maxAttempts: 30 });
      if (spot) { cx = spot.x; cy = spot.y; }
    } else {
      // Fallback: near player
      if (typeof player !== 'undefined' && player && player.active) {
        var angle = Math.random() * Math.PI * 2;
        cx = player.x + Math.cos(angle) * 150;
        cy = player.y + Math.sin(angle) * 150;
      }
    }

    var merchant = scene.physics.add.sprite(cx, cy, texKey);
    merchant.setDepth(150);
    merchant.body.setImmovable(true);
    merchant.body.setAllowGravity(false);

    // Scale to reasonable NPC size (~120px tall)
    var h = merchant.height || 200;
    merchant.setScale(120 / h);

    // Interaction prompt (floating text above merchant)
    var scaledH = 120;
    var prompt = scene.add.text(cx, cy - scaledH / 2 - 10, '[E] Handel', {
      fontSize: '14px', fill: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 2, align: 'center'
    }).setOrigin(0.5).setDepth(151);

    // Track overlap with player
    var playerRef = window.player || (scene.physics && scene.physics.world &&
      scene.physics.world.bodies && scene.physics.world.bodies.entries &&
      Array.from(scene.physics.world.bodies.entries).find(function(b) {
        return b.gameObject && b.gameObject.body && b.gameObject.body.maxVelocity;
      }));

    var inRange = false;
    var interactHandler = null;

    if (typeof player !== 'undefined' && player) {
      // Check distance each frame
      var updateEvent = scene.events.on('update', function() {
        if (!merchant || !merchant.active || !player || !player.active) return;
        var dx = merchant.x - player.x;
        var dy = merchant.y - player.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        inRange = dist < 80;
        prompt.setVisible(inRange);
        // Update prompt position to follow merchant
        prompt.setPosition(merchant.x, merchant.y - 70);
      });

      // E key to interact
      interactHandler = function() {
        if (!inRange || !merchant || !merchant.active) return;
        if (typeof window.openShopScene === 'function') {
          // Pass dungeon merchant flag for cheaper prices, no reroll tab
          window._dungeonMerchant = true;
          window.openShopScene(scene);
        }
      };
      scene.input.keyboard.on('keydown-E', interactHandler);
    }

    activeMerchant = {
      sprite: merchant,
      prompt: prompt,
      interactHandler: interactHandler,
      scene: scene
    };

    showEventToast(scene, '🛒 Ein wandernder Haendler ist erschienen!', 'wandering_merchant');
  }

  function cleanupMerchant() {
    if (!activeMerchant) return;
    if (activeMerchant.sprite && activeMerchant.sprite.destroy) activeMerchant.sprite.destroy();
    if (activeMerchant.prompt && activeMerchant.prompt.destroy) activeMerchant.prompt.destroy();
    if (activeMerchant.interactHandler && activeMerchant.scene &&
        activeMerchant.scene.input && activeMerchant.scene.input.keyboard) {
      activeMerchant.scene.input.keyboard.off('keydown-E', activeMerchant.interactHandler);
    }
    activeMerchant = null;
  }

  // --- Treasure & Trapped Chests ---
  function spawnEventChest(scene, chestType, isTrapped) {
    if (!scene || !scene.spawnObstacle) return;
    // Spawn chest near player (offset 120-200px in random direction)
    var px = 400, py = 250;
    if (typeof player !== 'undefined' && player && player.active) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 120 + Math.random() * 80;
      px = player.x + Math.cos(angle) * dist;
      py = player.y + Math.sin(angle) * dist;
      // Clamp to world bounds
      var bounds = scene.physics.world && scene.physics.world.bounds;
      if (bounds) {
        px = Math.max(bounds.x + 40, Math.min(bounds.x + bounds.width - 40, px));
        py = Math.max(bounds.y + 40, Math.min(bounds.y + bounds.height - 40, py));
      }
    }
    var chest = scene.spawnObstacle(px, py, chestType);
    if (chest) {
      chest.setData('eventChest', true);
      chest.setData('isTrapped', !!isTrapped);
    }
  }

  // --- Lore Fragment ---
  var activeLore = null;

  function spawnLoreFragment(scene) {
    if (!scene || !scene.add || !scene.physics) return;
    cleanupLore();

    var bounds = scene.physics.world && scene.physics.world.bounds;
    var bx = bounds ? bounds.x + bounds.width / 2 : 400;
    var by = bounds ? bounds.y + bounds.height / 2 : 300;
    if (typeof player !== 'undefined' && player) {
      var ang = Math.random() * Math.PI * 2;
      bx = player.x + Math.cos(ang) * 200;
      by = player.y + Math.sin(ang) * 200;
    }

    // Generate procedural scroll texture if missing
    if (!scene.textures.exists('proc_scroll')) {
      var g = scene.make.graphics({ add: false });
      g.fillStyle(0xeed8a0); g.fillRoundedRect(2, 4, 28, 24, 3);
      g.fillStyle(0x8b6a3a); g.fillRect(2, 4, 28, 3);
      g.fillStyle(0x8b6a3a); g.fillRect(2, 25, 28, 3);
      g.lineStyle(1, 0x6a4a20); g.strokeRoundedRect(2, 4, 28, 24, 3);
      g.fillStyle(0x6a4a20); g.fillRect(8, 12, 16, 1);
      g.fillRect(8, 16, 14, 1);
      g.fillRect(8, 20, 18, 1);
      g.generateTexture('proc_scroll', 32, 32);
      g.destroy();
    }

    var scroll = scene.physics.add.sprite(bx, by, 'proc_scroll');
    scroll.setDepth(50);
    scroll.body.setAllowGravity(false);
    scroll.body.setImmovable(true);

    // Glow effect
    var glow = scene.add.graphics();
    glow.fillStyle(0xffdd44, 0.2);
    glow.fillCircle(bx, by, 30);
    glow.fillStyle(0xffeeaa, 0.15);
    glow.fillCircle(bx, by, 20);
    glow.setDepth(49);

    // Tween bobbing
    if (scene.tweens) {
      scene.tweens.add({
        targets: scroll, y: by - 8, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut'
      });
    }

    // Lore texts pool
    var loreTexts = [
      '...die Schatten flüstern Namen, die niemand mehr aussprechen sollte...',
      '...der Kettenrat schloss einen Pakt mit etwas Älterem als die Stadt...',
      '...wer das Siegel bricht, öffnet einen Pfad in beide Richtungen...',
      '...die Tiere wussten zuerst, dass etwas in den Tiefen wachte...',
      '...verbrannte Seiten, doch ein Wort bleibt: "Dämmerstein"...',
      '...wir gruben tiefer als jede Karte erlaubte. Möge man uns vergeben...'
    ];
    var chosen = loreTexts[Math.floor(Math.random() * loreTexts.length)];

    activeLore = { sprite: scroll, glow: glow, scene: scene, text: chosen, picked: false };

    // Auto-pickup on overlap
    scene.physics.add.overlap(player, scroll, function() {
      if (activeLore && !activeLore.picked) {
        activeLore.picked = true;
        var xpBonus = 15 + (window.DUNGEON_DEPTH || 1) * 5;
        if (typeof addXP === 'function') {
          addXP.call(scene, xpBonus);
        } else if (typeof playerXP !== 'undefined') {
          playerXP += xpBonus;
          window.playerXP = playerXP;
        }
        showLoreDialog(scene, chosen, xpBonus);
        cleanupLore();
      }
    });

    showEventToast(scene, '📜 Ein altes Schriftstück glüht in der Nähe...', 'lore_fragment');
  }

  function showLoreDialog(scene, loreText, xpBonus) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    var overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(2500).setInteractive();

    var panelW = Math.min(560, cw - 40);
    var panelH = 200;
    var panel = scene.add.rectangle(cw / 2, ch / 2, panelW, panelH, 0x1a1a2a, 0.95)
      .setScrollFactor(0).setDepth(2501).setStrokeStyle(2, 0xffdd44);

    var title = scene.add.text(cw / 2, ch / 2 - 70, 'Altes Schriftstück', {
      fontSize: '20px', fill: '#ffdd44', fontFamily: 'serif', fontStyle: 'italic'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var body = scene.add.text(cw / 2, ch / 2 - 10, loreText, {
      fontSize: '14px', fill: '#e8e0c8', fontFamily: 'serif',
      wordWrap: { width: panelW - 40 }, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var bonus = scene.add.text(cw / 2, ch / 2 + 50, '+' + xpBonus + ' XP', {
      fontSize: '16px', fill: '#88ff88', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var hint = scene.add.text(cw / 2, ch / 2 + 80, '[Klick / Space / ESC zum Schliessen]', {
      fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var closed = false;
    var close = function() {
      if (closed) return;
      closed = true;
      scene.input.keyboard.off('keydown-SPACE', close);
      scene.input.keyboard.off('keydown-ESC', close);
      overlay.destroy(); panel.destroy(); title.destroy(); body.destroy(); bonus.destroy(); hint.destroy();
    };
    overlay.on('pointerdown', close);
    scene.input.keyboard.on('keydown-SPACE', close);
    scene.input.keyboard.on('keydown-ESC', close);
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(8000, close);
    }
  }

  function cleanupLore() {
    if (!activeLore) return;
    if (activeLore.sprite && activeLore.sprite.destroy) activeLore.sprite.destroy();
    if (activeLore.glow && activeLore.glow.destroy) activeLore.glow.destroy();
    activeLore = null;
  }

  // --- Ambush ---
  function triggerAmbush(scene) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    // Big dramatic warning
    var warn = scene.add.text(cw / 2, ch / 2 - 50, 'HINTERHALT!', {
      fontSize: '64px', fill: '#ff3333', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

    // Flash + scale pulse
    if (scene.tweens) {
      scene.tweens.add({
        targets: warn, alpha: 1, scale: { from: 0.5, to: 1.2 },
        duration: 400, yoyo: true, hold: 1200,
        onComplete: function() { warn.destroy(); }
      });
    }

    // Camera shake
    if (cam && cam.shake) cam.shake(800, 0.005);

    // Sound cue
    if (window.soundManager && window.soundManager.playSFX) {
      try { window.soundManager.playSFX('enemy_death'); } catch (e) {}
    }

    // Spawn enemies after 1.5s warning
    var extraCount = 2 + Math.floor((window.DUNGEON_DEPTH || 1) / 3);
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1500, function() {
        for (var i = 0; i < extraCount; i++) {
          if (typeof spawnEnemy === 'function') spawnEnemy.call(scene, 0, 0, 'enemy');
        }
        // Bonus reward for surviving
        var bonusGold = 50 + (window.DUNGEON_DEPTH || 1) * 20;
        if (window.LootSystem && window.LootSystem.grantGold) {
          // Delayed reward note — gold given when wave clears
          scene._ambushBonus = bonusGold;
        }
      });
    }
  }

  // --- Environmental Hazard (rockfall) ---
  function triggerRockfall(scene) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    if (typeof player === 'undefined' || !player) return;

    // Show shadow indicator at player position
    var px = player.x;
    var py = player.y;
    var shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillCircle(px, py, 50);
    shadow.setDepth(1000);

    showEventToast(scene, '🪨 Vorsicht — Decke stürzt ein! AUSWEICHEN!', 'environmental_hazard');

    // Pulse the shadow as warning
    if (scene.tweens) {
      scene.tweens.add({
        targets: shadow, alpha: 0.2, duration: 200, yoyo: true, repeat: 5
      });
    }

    // After 1.5s check if player moved away
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1500, function() {
        // Drop rocks visual
        var rockGfx = scene.add.graphics();
        rockGfx.fillStyle(0x4a3a2a, 1);
        for (var r = 0; r < 8; r++) {
          var rx = px + (Math.random() - 0.5) * 80;
          var ry = py + (Math.random() - 0.5) * 80;
          rockGfx.fillCircle(rx, ry, 6 + Math.random() * 6);
        }
        rockGfx.setDepth(60);

        // Check if player still in zone
        var dx = player.x - px;
        var dy = player.y - py;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          // Hit
          if (typeof playerHealth !== 'undefined') {
            playerHealth = Math.max(1, playerHealth - 1);
            window.playerHealth = playerHealth;
          }
          if (cam && cam.shake) cam.shake(300, 0.008);
          showEventToast(scene, '🪨 Einsturz! -1 HP', 'environmental_hazard');
        } else {
          // Dodged
          var goldReward = 25 + (window.DUNGEON_DEPTH || 1) * 10;
          if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
          showEventToast(scene, '🪨 Ausgewichen! +' + goldReward + ' Gold', 'environmental_hazard');
        }

        // Cleanup visuals
        scene.time.delayedCall(2000, function() {
          if (shadow && shadow.destroy) shadow.destroy();
          if (rockGfx && rockGfx.destroy) rockGfx.destroy();
        });
      });
    }
  }

  // --- Choice dialog overlay (032-random-event-rework) ---
  function showEventChoiceDialog(scene, title, choices) {
    if (!scene || !scene.add || !choices || !choices.length) return;
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 960;
    var camH = cam ? cam.height : 480;
    var cx = camW / 2;
    var cy = camH / 2;
    var elements = [];

    scene._eventChoiceActive = true;
    // Pause physics — freeze all bodies
    if (scene.physics && scene.physics.world) {
      scene.physics.world.pause();
    }

    // Dark overlay
    var overlay = scene.add.rectangle(cx, cy, camW, camH, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(2500).setInteractive();
    elements.push(overlay);

    // Title
    var titleText = scene.add.text(cx, cy - 60, title, {
      fontSize: '20px', fill: '#ffd166', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: camW - 100 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501);
    elements.push(titleText);

    var cleanup = function () {
      scene._eventChoiceActive = false;
      // Resume physics
      if (scene.physics && scene.physics.world) {
        scene.physics.world.resume();
      }
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] && elements[i].destroy) elements[i].destroy();
      }
    };

    // Buttons
    var btnY = cy;
    for (var i = 0; i < choices.length && i < 3; i++) {
      (function (choice, by) {
        var btnBg = scene.add.rectangle(cx, by, 340, 34, 0x2a2a2a)
          .setStrokeStyle(2, 0xd4a543)
          .setScrollFactor(0).setDepth(2502)
          .setInteractive({ useHandCursor: true });
        var btnText = scene.add.text(cx, by, choice.label, {
          fontSize: '14px', fill: '#f1e9d8', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2503);
        btnBg.on('pointerover', function () { btnBg.setFillStyle(0x555555); });
        btnBg.on('pointerout', function () { btnBg.setFillStyle(0x2a2a2a); });
        btnBg.on('pointerdown', function () {
          cleanup();
          if (typeof choice.callback === 'function') choice.callback();
        });
        elements.push(btnBg);
        elements.push(btnText);
      })(choices[i], btnY + i * 44);
    }
  }

  function registerEventType(def) {
    if (!def || !def.id || !def.name || !def.handler) return false;
    for (var i = 0; i < EVENT_TYPES.length; i++) {
      if (EVENT_TYPES[i].id === def.id) return false; // duplicate
    }
    EVENT_TYPES.push({
      id: def.id,
      name: def.name,
      weight: def.weight || 10,
      minDepth: def.minDepth || 1,
      handler: def.handler
    });
    return true;
  }

  function onRoomEnter(scene, roomId) {
    // Clean up any active merchant or lore from previous room
    cleanupMerchant();
    cleanupLore();

    if (roomId === 0) return;
    var depth = window.DUNGEON_DEPTH || 1;

    // Debug: force a specific event in a specific room
    // Set window.DEBUG_FORCE_EVENT = { roomId: 1, eventId: 'wandering_merchant' }
    if (window.DEBUG_FORCE_EVENT && window.DEBUG_FORCE_EVENT.roomId === roomId) {
      var forced = EVENT_TYPES.find(function(e) { return e.id === window.DEBUG_FORCE_EVENT.eventId; });
      if (forced) {
        lastEventId = forced.id;
        if (scene && scene.time && scene.time.delayedCall) {
          scene.time.delayedCall(800, function() { forced.handler(scene); });
        } else {
          forced.handler(scene);
        }
        return;
      }
    }

    if (!shouldTriggerEvent(depth)) return;

    var event = pickEvent(depth);
    if (!event) return;

    lastEventId = event.id;
    recentEvents.push(event.id);
    if (recentEvents.length > 3) recentEvents.shift();

    var dispatchEvent = function () {
      var result = event.handler(scene);
      // If handler returns a choice descriptor, show the dialog
      if (result && result.title && Array.isArray(result.choices)) {
        showEventChoiceDialog(scene, result.title, result.choices);
      }
    };

    if (scene && scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(800, dispatchEvent);
    } else {
      dispatchEvent();
    }
  }

  function reset() {
    lastEventId = null;
    recentEvents.length = 0;
    cleanupMerchant();
    cleanupLore();
    cleanupEventObjects();
  }

  window.EventSystem = {
    onRoomEnter: onRoomEnter,
    reset: reset,
    registerEventType: registerEventType,
    showEventChoiceDialog: showEventChoiceDialog,
    EVENT_TYPES: EVENT_TYPES
  };
})();
