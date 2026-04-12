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
        var goldAmount = 20 + (window.DUNGEON_DEPTH || 1) * 10;
        if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldAmount);
        showEventToast(scene, 'Versteckter Schatz! +' + goldAmount + ' Gold');
      }
    },
    {
      id: 'ambush',
      name: 'Hinterhalt!',
      weight: 20,
      minDepth: 2,
      handler: function(scene) {
        var extraCount = 2 + Math.floor((window.DUNGEON_DEPTH || 1) / 3);
        for (var i = 0; i < extraCount; i++) {
          if (typeof spawnEnemy === 'function') spawnEnemy.call(scene, 0, 0, 'enemy');
        }
        showEventToast(scene, 'Hinterhalt! ' + extraCount + ' zusaetzliche Gegner!');
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
        var goldReward = 30 + (window.DUNGEON_DEPTH || 1) * 15;
        if (typeof playerHealth !== 'undefined') {
          playerHealth = Math.max(1, playerHealth - 1);
          window.playerHealth = playerHealth;
        }
        if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
        showEventToast(scene, 'Verfluchte Truhe! -1 HP, +' + goldReward + ' Gold');
      }
    },
    {
      id: 'lore_fragment',
      name: 'Altes Schriftstueck',
      weight: 15,
      minDepth: 1,
      handler: function(scene) {
        var xpBonus = 15 + (window.DUNGEON_DEPTH || 1) * 5;
        if (typeof playerXP !== 'undefined') {
          playerXP += xpBonus;
          window.playerXP = playerXP;
        }
        showEventToast(scene, 'Altes Schriftstueck gefunden! +' + xpBonus + ' XP');
      }
    },
    {
      id: 'environmental_hazard',
      name: 'Einsturzgefahr',
      weight: 10,
      minDepth: 4,
      handler: function(scene) {
        var dodged = Math.random() > 0.5;
        if (dodged) {
          var goldReward = 25 + (window.DUNGEON_DEPTH || 1) * 10;
          if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
          showEventToast(scene, 'Einsturz ausgewichen! +' + goldReward + ' Gold');
        } else {
          if (typeof playerHealth !== 'undefined') {
            playerHealth = Math.max(1, playerHealth - 1);
            window.playerHealth = playerHealth;
          }
          showEventToast(scene, 'Einsturz! -1 HP');
        }
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

    // Scale to reasonable NPC size
    var h = merchant.height || 200;
    merchant.setScale(64 / h);

    // Interaction prompt (floating text above merchant)
    var prompt = scene.add.text(cx, cy - 45, '[E] Handel', {
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
        prompt.setPosition(merchant.x, merchant.y - 45);
      });

      // E key to interact
      interactHandler = function() {
        if (!inRange || !merchant || !merchant.active) return;
        if (typeof window.openShopScene === 'function') {
          window.openShopScene(scene);
        }
        showEventToast(scene, 'Der wandernde Haendler bietet seine Waren an!');
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

  function onRoomEnter(scene, roomId) {
    // Clean up any active merchant from previous room
    cleanupMerchant();

    if (roomId === 0) return;
    var depth = window.DUNGEON_DEPTH || 1;
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
  }

  window.EventSystem = {
    onRoomEnter: onRoomEnter,
    reset: reset,
    EVENT_TYPES: EVENT_TYPES
  };
})();
