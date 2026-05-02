// js/eventSystem.js — Random Dungeon Events
(function() {
  'use strict';

  if (window.i18n) {
    window.i18n.register('de', {
      // Treasure cache
      'event.treasure.name': 'Versteckter Schatz',
      'event.treasure.toast_spawn': 'Etwas Verborgenes schimmert...',
      'event.treasure.object_label': 'Schatz',
      'event.treasure.choice_gold': 'Gold nehmen (+{amount})',
      'event.treasure.choice_search': 'Gründlich durchsuchen (Item)',
      'event.treasure.choice_ignore': 'Ignorieren',
      'event.treasure.toast_gold': '+{amount} Gold!',
      'event.treasure.toast_item': 'Ein Gegenstand gefunden!',
      // Ambush
      'event.ambush.name': 'Hinterhalt!',
      // Wandering merchant
      'event.merchant.name': 'Wandernder Händler',
      'event.merchant.toast_spawn': '🛒 Ein wandernder Händler ist erschienen!',
      // Cursed chest
      'event.cursed.name': 'Verfluchte Truhe',
      'event.cursed.toast_spawn': 'Eine dunkle Aura umgibt etwas...',
      'event.cursed.object_label': 'Verfl. Truhe',
      'event.cursed.choice_open': 'Öffnen (Risiko: -3 HP, Belohnung: {amount} Gold + Item)',
      'event.cursed.choice_safe': 'Vorsichtig öffnen (kein Risiko, weniger Beute)',
      'event.cursed.choice_leave': 'In Ruhe lassen',
      'event.cursed.toast_curse': 'Fluch! -3 HP, aber gute Beute!',
      'event.cursed.toast_safe': '+{amount} Gold (sicher)',
      // Lore fragment
      'event.lore.name': 'Altes Schriftstück',
      'event.lore.toast_spawn': '📜 Ein altes Schriftstück glüht in der Nähe...',
      'event.lore.dialog_title': 'Altes Schriftstück',
      'event.lore.dialog_hint': '[Klick / Space / ESC zum Schliessen]',
      'event.lore.text.1': '...die Schatten flüstern Namen, die niemand mehr aussprechen sollte...',
      'event.lore.text.2': '...der Kettenrat schloss einen Pakt mit etwas Älterem als die Stadt...',
      'event.lore.text.3': '...wer das Siegel bricht, öffnet einen Pfad in beide Richtungen...',
      'event.lore.text.4': '...die Tiere wussten zuerst, dass etwas in den Tiefen wachte...',
      'event.lore.text.5': '...verbrannte Seiten, doch ein Wort bleibt: "Dämmerstein"...',
      'event.lore.text.6': '...wir gruben tiefer als jede Karte erlaubte. Möge man uns vergeben...',
      // Environmental hazard
      'event.hazard.name': 'Einsturzgefahr',
      'event.hazard.toast_spawn': '🪨 Vorsicht — Decke stürzt ein! AUSWEICHEN!',
      'event.hazard.toast_hit': '🪨 Einsturz! -1 HP',
      'event.hazard.toast_dodge': '🪨 Ausgewichen! +{amount} Gold',
      // Shrine
      'event.shrine.name': 'Mystischer Schrein',
      'event.shrine.toast_spawn': 'Ein mystischer Schrein erscheint...',
      'event.shrine.object_label': 'Schrein',
      'event.shrine.choice_power': 'Kraft (+25% Schaden, -{armor}% Rüstung)',
      'event.shrine.choice_protection': 'Schutz (+5% Rüstung, -10% Geschw.)',
      'event.shrine.choice_ignore': 'Ignorieren',
      'event.shrine.toast_power': 'Kraft des Schreins: +25% Schaden, -{armor}% Rüstung!',
      'event.shrine.toast_protection': 'Schutz des Schreins: +5% Rüstung!',
      // Gambling
      'event.gambling.name': 'Glücksspiel',
      'event.gambling.toast_spawn': 'Ein Spieltisch taucht auf...',
      'event.gambling.object_label': 'Glücksspiel',
      'event.gambling.title': 'Glücksspiel ({cost} Gold)',
      'event.gambling.choice_bet': 'Wette {cost} Gold (40% Chance auf 3x)',
      'event.gambling.choice_decline': 'Ablehnen',
      'event.gambling.toast_no_gold': 'Nicht genug Gold!',
      'event.gambling.toast_won': 'Gewonnen! Netto +{amount} Gold!',
      'event.gambling.toast_lost': 'Verloren! -{amount} Gold',
      // Elite ambush
      'event.elite.name': 'Elite-Hinterhalt',
      'event.elite.toast_spawn': 'Ein mächtiger Feind nähert sich!',
      // Healing fountain
      'event.fountain.name': 'Heilender Brunnen',
      'event.fountain.toast_spawn': 'Ein leuchtender Brunnen erscheint...',
      'event.fountain.object_label': 'Brunnen',
      'event.fountain.choice_drink': 'Trinken (volle Heilung)',
      'event.fountain.choice_fill': 'Füllen (+1 Portalrolle)',
      'event.fountain.choice_ignore': 'Ignorieren',
      'event.fountain.toast_heal': 'Volle Heilung!',
      'event.fountain.toast_scroll': '+1 Portalrolle!'
    });
    window.i18n.register('en', {
      'event.treasure.name': 'Hidden Treasure',
      'event.treasure.toast_spawn': 'Something hidden glimmers...',
      'event.treasure.object_label': 'Treasure',
      'event.treasure.choice_gold': 'Take gold (+{amount})',
      'event.treasure.choice_search': 'Search thoroughly (Item)',
      'event.treasure.choice_ignore': 'Ignore',
      'event.treasure.toast_gold': '+{amount} gold!',
      'event.treasure.toast_item': 'Found an item!',
      'event.ambush.name': 'Ambush!',
      'event.merchant.name': 'Wandering Merchant',
      'event.merchant.toast_spawn': '🛒 A wandering merchant has appeared!',
      'event.cursed.name': 'Cursed Chest',
      'event.cursed.toast_spawn': 'A dark aura surrounds something...',
      'event.cursed.object_label': 'Cursed Chest',
      'event.cursed.choice_open': 'Open (Risk: -3 HP, Reward: {amount} gold + Item)',
      'event.cursed.choice_safe': 'Open carefully (no risk, less loot)',
      'event.cursed.choice_leave': 'Leave alone',
      'event.cursed.toast_curse': 'Curse! -3 HP, but great loot!',
      'event.cursed.toast_safe': '+{amount} gold (safe)',
      'event.lore.name': 'Old Manuscript',
      'event.lore.toast_spawn': '📜 An old manuscript glows nearby...',
      'event.lore.dialog_title': 'Old Manuscript',
      'event.lore.dialog_hint': '[Click / Space / ESC to close]',
      'event.lore.text.1': '...the shadows whisper names no one should speak anymore...',
      'event.lore.text.2': '...the Chain Council made a pact with something older than the city...',
      'event.lore.text.3': '...whoever breaks the seal opens a path in both directions...',
      'event.lore.text.4': '...the animals knew first that something waited in the depths...',
      'event.lore.text.5': '...burned pages, but one word remains: "Twilightstone"...',
      'event.lore.text.6': '...we dug deeper than any map allowed. May we be forgiven...',
      'event.hazard.name': 'Cave-in Risk',
      'event.hazard.toast_spawn': '🪨 Watch out — ceiling collapsing! DODGE!',
      'event.hazard.toast_hit': '🪨 Cave-in! -1 HP',
      'event.hazard.toast_dodge': '🪨 Dodged! +{amount} gold',
      'event.shrine.name': 'Mystical Shrine',
      'event.shrine.toast_spawn': 'A mystical shrine appears...',
      'event.shrine.object_label': 'Shrine',
      'event.shrine.choice_power': 'Power (+25% damage, -{armor}% armor)',
      'event.shrine.choice_protection': 'Protection (+5% armor, -10% speed)',
      'event.shrine.choice_ignore': 'Ignore',
      'event.shrine.toast_power': 'Shrine of Power: +25% damage, -{armor}% armor!',
      'event.shrine.toast_protection': 'Shrine of Protection: +5% armor!',
      'event.gambling.name': 'Gambling',
      'event.gambling.toast_spawn': 'A gambling table appears...',
      'event.gambling.object_label': 'Gambling',
      'event.gambling.title': 'Gambling ({cost} gold)',
      'event.gambling.choice_bet': 'Bet {cost} gold (40% chance for 3x)',
      'event.gambling.choice_decline': 'Decline',
      'event.gambling.toast_no_gold': 'Not enough gold!',
      'event.gambling.toast_won': 'You won! Net +{amount} gold!',
      'event.gambling.toast_lost': 'Lost! -{amount} gold',
      'event.elite.name': 'Elite Ambush',
      'event.elite.toast_spawn': 'A mighty foe approaches!',
      'event.fountain.name': 'Healing Fountain',
      'event.fountain.toast_spawn': 'A glowing fountain appears...',
      'event.fountain.object_label': 'Fountain',
      'event.fountain.choice_drink': 'Drink (full heal)',
      'event.fountain.choice_fill': 'Fill (+1 portal scroll)',
      'event.fountain.choice_ignore': 'Ignore',
      'event.fountain.toast_heal': 'Full heal!',
      'event.fountain.toast_scroll': '+1 portal scroll!'
    });
  }
  var T = function (key, params) { return window.i18n ? window.i18n.t(key, params) : key; };

  var EVENT_TYPES = [
    {
      id: 'treasure_cache',
      name: T('event.treasure.name'),
      weight: 15,
      minDepth: 1,
      handler: function(scene) {
        showEventToast(scene, T('event.treasure.toast_spawn'), 'treasure_cache');
        var goldAmount = 30 + Math.floor(Math.random() * 40) + (window.DUNGEON_DEPTH || 1) * 15;
        spawnEventObject(scene, 'evt_treasure', 0xccaa33, 0xffd700, T('event.treasure.object_label'), function () {
          try { window.soundManager && window.soundManager.playSFX('pickup'); } catch (e) {}
          showEventChoiceDialog(scene, T('event.treasure.name'), [
            {
              label: T('event.treasure.choice_gold', { amount: goldAmount }),
              callback: function () {
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldAmount);
                showEventToast(scene, T('event.treasure.toast_gold', { amount: goldAmount }), 'treasure_cache');
              }
            },
            {
              label: T('event.treasure.choice_search'),
              callback: function () {
                if (window.LootSystem && window.LootSystem.rollItem && typeof spawnLoot === 'function') {
                  var iLevel = (window.DUNGEON_DEPTH || 1) + 2;
                  var item = window.LootSystem.rollItem(null, iLevel);
                  if (item) spawnLoot.call(scene, player.x, player.y - 30, item, null);
                }
                showEventToast(scene, T('event.treasure.toast_item'), 'treasure_cache');
              }
            },
            { label: T('event.treasure.choice_ignore'), callback: function () {} }
          ]);
        });
      }
    },
    {
      id: 'ambush',
      name: T('event.ambush.name'),
      weight: 12,
      minDepth: 2,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
        triggerAmbush(scene);
      }
    },
    {
      id: 'wandering_merchant',
      name: T('event.merchant.name'),
      weight: 15,
      minDepth: 3,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        spawnMerchant(scene);
      }
    },
    {
      id: 'trapped_chest',
      name: T('event.cursed.name'),
      weight: 8,
      minDepth: 2,
      handler: function(scene) {
        showEventToast(scene, T('event.cursed.toast_spawn'), 'trapped_chest');
        var goldReward = 60 + Math.floor(Math.random() * 60) + (window.DUNGEON_DEPTH || 1) * 20;
        spawnEventObject(scene, 'evt_cursed', 0x662244, 0xaa44ff, T('event.cursed.object_label'), function () {
          try { window.soundManager && window.soundManager.playSFX('enemy_hit'); } catch (e) {}
          showEventChoiceDialog(scene, T('event.cursed.name'), [
            {
              label: T('event.cursed.choice_open', { amount: goldReward }),
              callback: function () {
                // Take damage
                if (typeof window.setPlayerHealth === 'function') {
                  window.setPlayerHealth(Math.max(1, (window.playerHealth || 10) - 3));
                }
                // Grant gold
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
                // Drop rare item
                if (window.LootSystem && window.LootSystem.rollItem && typeof spawnLoot === 'function') {
                  var iLevel = (window.DUNGEON_DEPTH || 1) + 4;
                  var roll = Math.random();
                  var forcedTier = roll < 0.15 ? 3 : (roll < 0.5 ? 2 : 1);
                  var item = window.LootSystem.rollItem(null, iLevel, forcedTier);
                  if (item) spawnLoot.call(scene, player.x, player.y - 30, item, null);
                }
                var cam = scene.cameras && scene.cameras.main;
                if (cam && cam.shake) cam.shake(200, 0.006);
                showEventToast(scene, T('event.cursed.toast_curse'), 'trapped_chest');
              }
            },
            {
              label: T('event.cursed.choice_safe'),
              callback: function () {
                var safeGold = Math.floor(goldReward * 0.4);
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(safeGold);
                showEventToast(scene, T('event.cursed.toast_safe', { amount: safeGold }), 'trapped_chest');
              }
            },
            { label: T('event.cursed.choice_leave'), callback: function () {} }
          ]);
        });
      }
    },
    {
      id: 'lore_fragment',
      name: T('event.lore.name'),
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
      name: T('event.hazard.name'),
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
      } else if (texKey === 'evt_treasure') {
        // Gold pile with sparkle
        g.fillStyle(0x8B6914, 1); g.fillRect(6, 18, 20, 12); // base chest
        g.fillStyle(0x7a5a10, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0x3a3a3a, 1); g.fillRect(14, 18, 4, 3); // lock
        g.fillStyle(0xffd700, 1); g.fillCircle(10, 14, 3); // coin 1
        g.fillStyle(0xffcc00, 1); g.fillCircle(16, 12, 3); // coin 2
        g.fillStyle(0xffd700, 1); g.fillCircle(22, 14, 2.5); // coin 3
        g.fillStyle(0xffffff, 0.5); g.fillCircle(16, 10, 2); // sparkle
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_cursed') {
        // Dark chest with purple aura
        g.fillStyle(0x331122, 1); g.fillRect(6, 18, 20, 12); // base chest
        g.fillStyle(0x441133, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0xaa44ff, 0.4); g.fillCircle(16, 20, 12); // purple aura
        g.fillStyle(0x222222, 1); g.fillRect(6, 18, 20, 12); // chest over aura
        g.fillStyle(0x331133, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0xff2222, 1); g.fillCircle(16, 22, 2); // red eye
        g.fillStyle(0xaa44ff, 0.6); g.fillCircle(10, 14, 1.5); // particle
        g.fillStyle(0xaa44ff, 0.4); g.fillCircle(22, 12, 1.5); // particle
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
    name: T('event.shrine.name'),
    weight: 14,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, T('event.shrine.toast_spawn'), 'shrine_buff');
      // Altar power debuff scales with player level so the choice stays meaningful in late game.
      // Base: -30% armor (was -15%). Per-level: +0.5%. Cap: -50% armor.
      // Armor is clamped 0..0.85 in inventory.recalcDerived, so this never permanently bricks the player.
      var lvl = (typeof window.playerLevel === 'number') ? window.playerLevel : 1;
      var debuffPct = Math.min(0.50, 0.30 + lvl * 0.005);
      var armorMultStep = 1 - debuffPct;
      var armorPctLabel = Math.round(debuffPct * 100);
      spawnEventObject(scene, 'evt_shrine', 0x6644aa, 0xaa88ff, T('event.shrine.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}
        showEventChoiceDialog(scene, T('event.shrine.name'), [
          {
            label: T('event.shrine.choice_power', { armor: armorPctLabel }),
            callback: function () {
              window.eventBuffs = window.eventBuffs || { damageMult: 1, armorAdd: 0, armorMult: 1, speedMult: 1 };
              window.eventBuffs.damageMult *= 1.25;
              window.eventBuffs.armorMult *= armorMultStep;
              if (typeof recalcDerived === 'function') recalcDerived(0, 0);
              showEventToast(scene, T('event.shrine.toast_power', { armor: armorPctLabel }), 'shrine_buff');
            }
          },
          {
            label: T('event.shrine.choice_protection'),
            callback: function () {
              window.eventBuffs = window.eventBuffs || { damageMult: 1, armorAdd: 0, armorMult: 1, speedMult: 1 };
              window.eventBuffs.armorAdd += 0.05;
              window.eventBuffs.speedMult *= 0.9;
              if (typeof recalcDerived === 'function') recalcDerived(0, 0);
              showEventToast(scene, T('event.shrine.toast_protection'), 'shrine_buff');
            }
          },
          { label: T('event.shrine.choice_ignore'), callback: function () {} }
        ]);
      });
    }
  });

  EVENT_TYPES.push({
    id: 'gambling',
    name: T('event.gambling.name'),
    weight: 10,
    minDepth: 3,
    handler: function (scene) {
      var cost = 50 + Math.floor(Math.random() * 50);
      showEventToast(scene, T('event.gambling.toast_spawn'), 'gambling');
      spawnEventObject(scene, 'evt_gamble', 0x886622, 0xffcc44, T('event.gambling.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        showEventChoiceDialog(scene, T('event.gambling.title', { cost: cost }), [
          {
            label: T('event.gambling.choice_bet', { cost: cost }),
            callback: function () {
              if (!window.LootSystem || !window.LootSystem.spendGold(cost)) {
                showEventToast(scene, T('event.gambling.toast_no_gold'), 'gambling');
                return;
              }
              if (Math.random() < 0.4) {
                // Won: return bet + winnings (net gain = 2x bet)
                var winnings = cost * 3;
                if (window.LootSystem && window.LootSystem.grantGold) {
                  window.LootSystem.grantGold(winnings);
                }
                var netGain = winnings - cost;
                showEventToast(scene, T('event.gambling.toast_won', { amount: netGain }), 'gambling');
              } else {
                showEventToast(scene, T('event.gambling.toast_lost', { amount: cost }), 'gambling');
              }
            }
          },
          { label: T('event.gambling.choice_decline'), callback: function () {} }
        ]);
      });
    }
  });

  // Elite ambush — fires immediately (no interaction needed)
  EVENT_TYPES.push({
    id: 'elite_ambush',
    name: T('event.elite.name'),
    weight: 8,
    minDepth: 5,
    handler: function (scene) {
      try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
      showEventToast(scene, T('event.elite.toast_spawn'), 'elite_ambush');
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
    name: T('event.fountain.name'),
    weight: 10,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, T('event.fountain.toast_spawn'), 'healing_fountain');
      spawnEventObject(scene, 'evt_fountain', 0x2266aa, 0x44aaff, T('event.fountain.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}
        showEventChoiceDialog(scene, T('event.fountain.name'), [
          {
            label: T('event.fountain.choice_drink'),
            callback: function () {
              if (typeof window.setPlayerHealth === 'function' && typeof window.playerMaxHealth === 'number') {
                window.setPlayerHealth(window.playerMaxHealth);
              }
              showEventToast(scene, T('event.fountain.toast_heal'), 'healing_fountain');
            }
          },
          {
            label: T('event.fountain.choice_fill'),
            callback: function () {
              if (!window.materialCounts) window.materialCounts = {};
              window.materialCounts.PORTAL_SCROLL = (window.materialCounts.PORTAL_SCROLL || 0) + 1;
              showEventToast(scene, T('event.fountain.toast_scroll'), 'healing_fountain');
            }
          },
          { label: T('event.fountain.choice_ignore'), callback: function () {} }
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

    showEventToast(scene, T('event.merchant.toast_spawn'), 'wandering_merchant');
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
    // Spawn chest near player. Try up to 16 random offsets (60-220 px) and
    // pick the first one that isn't blocked by a wall / obstacle. The
    // previous code used a single fixed-distance angle which would happily
    // place the chest inside a wall — visible but unreachable. Mirrors
    // the lore-scroll wall-spawn fix from earlier.
    var px = 400, py = 250;
    if (typeof player !== 'undefined' && player && player.active) {
      var bounds = scene.physics.world && scene.physics.world.bounds;
      var halfSize = 24; // chest sprite half-width-ish
      var placed = false;
      for (var attempt = 0; attempt < 16 && !placed; attempt++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = 60 + Math.random() * 160;
        var tx = player.x + Math.cos(angle) * dist;
        var ty = player.y + Math.sin(angle) * dist;
        if (bounds) {
          var margin = halfSize + 16;
          if (tx < bounds.x + margin || tx > bounds.x + bounds.width - margin) continue;
          if (ty < bounds.y + margin || ty > bounds.y + bounds.height - margin) continue;
        }
        var blocked = false;
        if (typeof window !== 'undefined' && typeof window.isSpawnPositionBlocked === 'function') {
          try { blocked = !!window.isSpawnPositionBlocked(tx, ty, halfSize); } catch (_) { blocked = false; }
        }
        if (!blocked) {
          px = tx; py = ty;
          placed = true;
        }
      }
      // Fallback: drop the chest right next to the player (their tile is
      // guaranteed walkable since they are standing on it).
      if (!placed) { px = player.x; py = player.y; }
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
      // Try up to 16 random offsets around the player (60 - 220 px) and
      // pick the first one that isn't blocked by a wall / obstacle. The
      // old code picked a single fixed-radius angle and would happily
      // place the scroll inside a wall — making the lore unreachable.
      var placed = false;
      var halfSize = 18; // ~ scroll sprite half-width
      for (var attempt = 0; attempt < 16 && !placed; attempt++) {
        var ang = Math.random() * Math.PI * 2;
        var radius = 60 + Math.random() * 160;
        var tx = player.x + Math.cos(ang) * radius;
        var ty = player.y + Math.sin(ang) * radius;
        // Stay inside the world bounds (with margin) when known.
        if (bounds) {
          var margin = halfSize + 8;
          if (tx < bounds.x + margin || tx > bounds.x + bounds.width - margin) continue;
          if (ty < bounds.y + margin || ty > bounds.y + bounds.height - margin) continue;
        }
        var blocked = false;
        if (typeof window !== 'undefined' && typeof window.isSpawnPositionBlocked === 'function') {
          try { blocked = !!window.isSpawnPositionBlocked(tx, ty, halfSize); } catch (_) { blocked = false; }
        }
        if (!blocked) {
          bx = tx; by = ty;
          placed = true;
        }
      }
      // If every attempt was blocked, fall back to the player's own tile —
      // they are guaranteed to be on a walkable tile.
      if (!placed) {
        bx = player.x; by = player.y;
      }
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

    // Lore texts pool — keys resolved at display time
    var loreKeys = [
      'event.lore.text.1',
      'event.lore.text.2',
      'event.lore.text.3',
      'event.lore.text.4',
      'event.lore.text.5',
      'event.lore.text.6'
    ];
    var chosen = T(loreKeys[Math.floor(Math.random() * loreKeys.length)]);

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

    showEventToast(scene, T('event.lore.toast_spawn'), 'lore_fragment');
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

    var title = scene.add.text(cw / 2, ch / 2 - 70, T('event.lore.dialog_title'), {
      fontSize: '20px', fill: '#ffdd44', fontFamily: 'serif', fontStyle: 'italic'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var body = scene.add.text(cw / 2, ch / 2 - 10, loreText, {
      fontSize: '14px', fill: '#e8e0c8', fontFamily: 'serif',
      wordWrap: { width: panelW - 40 }, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var bonus = scene.add.text(cw / 2, ch / 2 + 50, '+' + xpBonus + ' XP', {
      fontSize: '16px', fill: '#88ff88', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var hint = scene.add.text(cw / 2, ch / 2 + 80, T('event.lore.dialog_hint'), {
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

    showEventToast(scene, T('event.hazard.toast_spawn'), 'environmental_hazard');

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
          showEventToast(scene, T('event.hazard.toast_hit'), 'environmental_hazard');
        } else {
          // Dodged
          var goldReward = 25 + (window.DUNGEON_DEPTH || 1) * 10;
          if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
          showEventToast(scene, T('event.hazard.toast_dodge', { amount: goldReward }), 'environmental_hazard');
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

    // Buttons — dynamic height so long labels wrap cleanly inside the box.
    var BTN_W = Math.min(520, camW - 40);
    var BTN_PAD_X = 16;
    var BTN_PAD_Y = 8;
    var BTN_GAP = 10;
    var cursorY = cy; // top edge of next button
    for (var i = 0; i < choices.length && i < 3; i++) {
      var btnText = scene.add.text(0, 0, choices[i].label, {
        fontSize: '14px', fill: '#f1e9d8', fontFamily: 'monospace',
        align: 'center',
        wordWrap: { width: BTN_W - BTN_PAD_X * 2 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2503);
      var btnH = Math.max(34, btnText.height + BTN_PAD_Y * 2);
      var by = cursorY + btnH / 2;
      var btnBg = scene.add.rectangle(cx, by, BTN_W, btnH, 0x2a2a2a)
        .setStrokeStyle(2, 0xd4a543)
        .setScrollFactor(0).setDepth(2502)
        .setInteractive({ useHandCursor: true });
      btnText.setPosition(cx, by);
      (function (bg, choice) {
        bg.on('pointerover', function () { bg.setFillStyle(0x555555); });
        bg.on('pointerout', function () { bg.setFillStyle(0x2a2a2a); });
        bg.on('pointerdown', function () {
          cleanup();
          if (typeof choice.callback === 'function') choice.callback();
        });
      })(btnBg, choices[i]);
      elements.push(btnBg);
      elements.push(btnText);
      cursorY = by + btnH / 2 + BTN_GAP;
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
