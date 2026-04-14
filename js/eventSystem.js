// js/eventSystem.js — Random Dungeon Events
(function() {
  'use strict';

  var EVENT_TYPES = [
    {
      id: 'treasure_cache',
      name: 'Versteckter Schatz',
      weight: 25,
      minDepth: 1,
      handler: function(scene) {
        spawnEventChest(scene, 'chest_medium', false);
        showEventToast(scene, 'Versteckter Schatz entdeckt!');
      }
    },
    {
      id: 'ambush',
      name: 'Hinterhalt!',
      weight: 20,
      minDepth: 2,
      handler: function(scene) {
        triggerAmbush(scene);
      }
    },
    {
      id: 'wandering_merchant',
      name: 'Wandernder Haendler',
      weight: 15,
      minDepth: 3,
      handler: function(scene) {
        spawnMerchant(scene);
      }
    },
    {
      id: 'trapped_chest',
      name: 'Verfluchte Truhe',
      weight: 15,
      minDepth: 2,
      handler: function(scene) {
        spawnEventChest(scene, 'chest_large', true);
        showEventToast(scene, 'Eine verfluchte Truhe... vorsichtig!');
      }
    },
    {
      id: 'lore_fragment',
      name: 'Altes Schriftstueck',
      weight: 15,
      minDepth: 1,
      handler: function(scene) {
        spawnLoreFragment(scene);
      }
    },
    {
      id: 'environmental_hazard',
      name: 'Einsturzgefahr',
      weight: 10,
      minDepth: 4,
      handler: function(scene) {
        triggerRockfall(scene);
      }
    }
  ];

  var lastEventId = null;

  function shouldTriggerEvent(depth) {
    var chance = 0.30 + (depth - 1) * 0.02;
    return Math.random() < Math.min(0.50, chance);
  }

  function pickEvent(depth) {
    var eligible = EVENT_TYPES.filter(function(e) {
      return depth >= e.minDepth && e.id !== lastEventId;
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

  function showEventToast(scene, message) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var toast = scene.add.text(
      cam ? cam.width / 2 : 600, 80, message,
      {
        fontSize: '22px', fill: '#ffdd44', fontFamily: 'monospace',
        stroke: '#000', strokeThickness: 3, align: 'center'
      }
    ).setOrigin(0.5).setDepth(2000).setScrollFactor(0);

    if (scene.tweens && scene.tweens.add) {
      scene.tweens.add({
        targets: toast, alpha: 0, y: toast.y - 40,
        duration: 2500, ease: 'Power2',
        onComplete: function() { toast.destroy(); }
      });
    } else {
      setTimeout(function() { if (toast && toast.destroy) toast.destroy(); }, 2500);
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

    // Find a position away from player
    var cam = scene.cameras && scene.cameras.main;
    var bounds = scene.physics.world && scene.physics.world.bounds;
    var cx = bounds ? bounds.x + bounds.width / 2 : 400;
    var cy = bounds ? bounds.y + bounds.height / 2 : 300;

    // Place merchant near room center
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

    showEventToast(scene, 'Ein wandernder Haendler ist erschienen!');
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
    var bounds = scene.physics.world && scene.physics.world.bounds;
    if (!bounds) return;
    // Pick a position near room center but offset from player
    var px = bounds.x + bounds.width / 2;
    var py = bounds.y + bounds.height / 2;
    if (typeof player !== 'undefined' && player) {
      var dx = px - player.x, dy = py - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 200) {
        // Push chest away from player
        px = player.x + (dx / (d || 1)) * 250;
        py = player.y + (dy / (d || 1)) * 250;
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
        if (typeof playerXP !== 'undefined') {
          playerXP += xpBonus;
          window.playerXP = playerXP;
        }
        showLoreDialog(scene, chosen, xpBonus);
        cleanupLore();
      }
    });

    showEventToast(scene, 'Ein altes Schriftstück glüht in der Nähe...');
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

    var hint = scene.add.text(cw / 2, ch / 2 + 80, '[Klick zum Schließen]', {
      fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var close = function() {
      overlay.destroy(); panel.destroy(); title.destroy(); body.destroy(); bonus.destroy(); hint.destroy();
    };
    overlay.on('pointerdown', close);
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(8000, close); // auto-close after 8s
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
        var bonusGold = 30 + (window.DUNGEON_DEPTH || 1) * 10;
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

    showEventToast(scene, 'Vorsicht — Decke stürzt ein! AUSWEICHEN!');

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
          showEventToast(scene, 'Einsturz! -1 HP');
        } else {
          // Dodged
          var goldReward = 25 + (window.DUNGEON_DEPTH || 1) * 10;
          if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
          showEventToast(scene, 'Ausgewichen! +' + goldReward + ' Gold');
        }

        // Cleanup visuals
        scene.time.delayedCall(2000, function() {
          if (shadow && shadow.destroy) shadow.destroy();
          if (rockGfx && rockGfx.destroy) rockGfx.destroy();
        });
      });
    }
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

    if (scene && scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(800, function() { event.handler(scene); });
    } else {
      event.handler(scene);
    }
  }

  function reset() {
    lastEventId = null;
    cleanupMerchant();
    cleanupLore();
  }

  window.EventSystem = {
    onRoomEnter: onRoomEnter,
    reset: reset,
    EVENT_TYPES: EVENT_TYPES
  };
})();
