// Game test runner — uses Playwright to load the game in headless Chromium,
// captures console errors, takes screenshots, and reports findings.
//
// Usage:
//   node tools/testGame.js              # quick smoke test
//   node tools/testGame.js --hub        # test hub scene
//   node tools/testGame.js --dungeon    # walk into dungeon
//   node tools/testGame.js --full       # extended test sequence

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:3456/?autostart=1';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-output');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const args = process.argv.slice(2);
const mode = args[0] || '--smoke';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  const consoleLogs = [];

  page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
  });
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push('[' + msg.type() + '] ' + text);
    if (msg.type() === 'error') errors.push(text);
    if (msg.type() === 'warning') warnings.push(text);
  });

  console.log('Loading game from', URL);
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.error('Failed to load page:', e.message);
    await browser.close();
    process.exit(1);
  }

  // Wait for game to fully initialize and reach HubSceneV2
  console.log('Waiting for game to initialize...');
  try {
    await page.waitForFunction(() => typeof window.game !== 'undefined', { timeout: 15000 });
    console.log('window.game found');
  } catch (e) {
    console.log('window.game timeout');
  }

  // Game uses ?autostart=1 to skip menu

  // Wait for HubSceneV2 to be active (means StartScene finished loading)
  console.log('Waiting for HubSceneV2...');
  try {
    await page.waitForFunction(() => {
      if (!window.game?.scene?.scenes) return false;
      return window.game.scene.scenes.some(s => s.scene?.key === 'HubSceneV2' && s.scene.isActive());
    }, { timeout: 30000 });
    console.log('HubSceneV2 active!');
  } catch (e) {
    console.log('HubSceneV2 not reached in 30s');
  }

  // Extra wait for hub assets to render
  await page.waitForTimeout(2000);

  // Initial screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial.png') });
  console.log('Screenshot saved: 01-initial.png');

  // Check if game is in hub scene
  const sceneInfo = await page.evaluate(() => {
    try {
      if (typeof window.game === 'undefined') return { error: 'window.game not defined' };
      if (!window.game.scene || !window.game.scene.scenes) return { error: 'no scenes' };
      const scenes = window.game.scene.scenes
        .filter(s => s.scene && s.scene.isActive())
        .map(s => s.scene.key);
      return {
        activeScenes: scenes,
        playerExists: typeof window.player !== 'undefined' && window.player && window.player.active,
        playerPos: window.player && window.player.active ? { x: Math.round(window.player.x), y: Math.round(window.player.y) } : null,
        currentWave: window.currentWave || 0,
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Scene info:', JSON.stringify(sceneInfo, null, 2));

  if ((mode === '--hub' || mode === '--full') && !sceneInfo.error) {
    // Test NPC visibility
    const npcInfo = await page.evaluate(() => {
      try {
        const hubScene = window.game.scene.getScene('HubSceneV2');
        if (!hubScene) return { error: 'No HubSceneV2' };
        if (!hubScene.npcs) return { error: 'hubScene.npcs is undefined' };
        return hubScene.npcs.map(n => ({
          id: n.data && n.data.id,
          name: n.data && n.data.name,
          visible: n.sprite && n.sprite.visible,
          active: n.sprite && n.sprite.active,
          x: n.sprite ? Math.round(n.sprite.x) : null,
          y: n.sprite ? Math.round(n.sprite.y) : null,
        }));
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('\nNPCs in hub:');
    if (Array.isArray(npcInfo)) {
      npcInfo.forEach(n => console.log('  -', JSON.stringify(n)));
    } else {
      console.log('  ', npcInfo);
    }
  }

  if (mode === '--loadout' || mode === '--full') {
    console.log('\n--- Loadout UI Test ---');

    // Note: HUD lives in GameScene, not HubSceneV2 — we'll verify it after entering the dungeon below.

    // Verify new-game reset wiped any leftover ability state from a prior run.
    // (autostart=1 should call resetForNewGame.)
    const learnedAtStart = await page.evaluate(() => window.AbilitySystem.getLearnedAbilities());
    console.log('Learned abilities at fresh start:', learnedAtStart);
    if (learnedAtStart.length === 0) {
      console.log('  ✓ New game starts with no learned abilities');
    } else {
      console.log('  ✗ NEW GAME LEAKED ABILITIES from previous run:', learnedAtStart);
    }

    // Force-learn 2 abilities so we have something to click
    await page.evaluate(() => {
      if (window.AbilitySystem) {
        window.AbilitySystem.learnAbility('spinAttack', { silent: true });
        window.AbilitySystem.learnAbility('chargeSlash', { silent: true });
      }
    });
    console.log('Learned 2 abilities for testing');

    // Open loadout menu (K key)
    await page.keyboard.press('k');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-loadout-open.png') });
    console.log('Screenshot: 04-loadout-open.png');

    // Check loadout menu is open
    const menuOpen = await page.evaluate(() => {
      const hub = window.game?.scene?.getScene?.('HubSceneV2');
      return !!hub?._loadoutContainer;
    });
    console.log('Loadout menu open:', menuOpen);

    if (menuOpen) {
      // Find a clickable ability cell (the spinAttack cell)
      // The cells are interactive zones — find their world position
      const cellPos = await page.evaluate(() => {
        const hub = window.game?.scene?.getScene?.('HubSceneV2');
        if (!hub || !hub._loadoutContainer) return null;
        // Look for interactive zones in the scene
        const zones = hub.children.list.filter(c =>
          c.type === 'Zone' && c.input && c.input.enabled && c.depth >= 2002
        );
        if (!zones.length) return { error: 'no zones found' };
        // Get the canvas position to compute screen coords
        const canvas = window.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.game.scale.width;
        const scaleY = rect.height / window.game.scale.height;
        return zones.slice(0, 5).map(z => ({
          x: rect.left + z.x * scaleX,
          y: rect.top + z.y * scaleY,
          width: z.width,
          height: z.height,
        }));
      });

      console.log('Found clickable zones:', JSON.stringify(cellPos));

      if (Array.isArray(cellPos) && cellPos.length > 0) {
        // Get loadout BEFORE click
        const before = await page.evaluate(() => window.AbilitySystem.getActiveLoadout());
        console.log('Loadout BEFORE click:', JSON.stringify(before));

        // Click first zone (should be a learned ability cell)
        const target = cellPos[0];
        console.log('Clicking zone at', target.x, target.y);
        await page.mouse.click(target.x, target.y);
        await page.waitForTimeout(500);

        // Get loadout AFTER click
        const after = await page.evaluate(() => window.AbilitySystem.getActiveLoadout());
        console.log('Loadout AFTER click: ', JSON.stringify(after));

        const changed = JSON.stringify(before) !== JSON.stringify(after);
        console.log(changed ? '✓ CLICK REGISTERED — loadout changed' : '✗ CLICK FAILED — loadout unchanged');

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-after-click.png') });
        console.log('Screenshot: 05-after-click.png');

        // Verify HUD updated to reflect newly equipped ability
        const hudAfter = await page.evaluate(() => window._getAbilityHUDState && window._getAbilityHUDState());
        if (Array.isArray(hudAfter)) {
          const visibleAfter = hudAfter.filter(t => t.visible).map(t => t.key);
          const equippedIds = Object.values(after || {}).filter(Boolean);
          console.log('HUD after equip:', visibleAfter, '— equipped IDs:', equippedIds);

          // Expected: attack + one tile per equipped ability
          const expectedCount = 1 + equippedIds.length;
          if (visibleAfter.length === expectedCount && visibleAfter.includes('attack')) {
            console.log('  ✓ HUD updated correctly — shows attack + ' + equippedIds.length + ' equipped');
          } else {
            console.log('  ✗ HUD MISMATCH — expected ' + expectedCount + ' tiles, got ' + visibleAfter.length);
          }

          // Verify no unlearned ability is visible
          const unlearned = hudAfter.filter(t => t.visible && t.abilityId && !equippedIds.includes(t.abilityId));
          if (unlearned.length === 0) {
            console.log('  ✓ No unequipped abilities leaking into HUD');
          } else {
            console.log('  ✗ HUD shows unequipped abilities:', unlearned.map(t => t.key));
          }
        }
      }
    }

    // Close loadout
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ---- NPC Interaction / Quest Indicator Test ----
    console.log('\n--- NPC Interaction Test ---');

    // Helper to read aldric's quest indicator state from the hub scene
    const readAldricIndicator = () => page.evaluate(() => {
      const hub = window.game?.scene?.getScene?.('HubSceneV2');
      if (!hub || !hub.npcs) return { error: 'no hub or npcs' };
      const aldric = hub.npcs.find(n => n.data && n.data.id === 'aldric');
      if (!aldric) return { error: 'aldric not found' };
      const ind = aldric.questIndicator;
      if (!ind) return { error: 'no questIndicator' };
      return {
        text: ind.text,
        visible: ind.visible,
        color: ind.style && ind.style.color
      };
    });

    const indBefore = await readAldricIndicator();
    console.log('Aldric indicator BEFORE accept:', JSON.stringify(indBefore));
    if (indBefore.text === '!' && indBefore.visible) {
      console.log('  ✓ Available quest shows gold "!"');
    } else {
      console.log('  ✗ Expected visible "!" — got', indBefore);
    }

    // Simulate the player accepting Aldric's quest via the actual handler chain.
    // This invokes _handleDialogueChoice('accept', ...) which is exactly what
    // happens when the player clicks "Annehmen" in the dialogue.
    const acceptResult = await page.evaluate(() => {
      const hub = window.game.scene.getScene('HubSceneV2');
      const qs = window.questSystem;
      if (!hub || !qs) return { error: 'missing hub or questSystem' };
      const available = qs.getAvailableQuests('aldric');
      if (!available.length) return { error: 'no available quests for aldric' };
      const questData = available[0];
      try {
        // Mimic the dialog accept path (no real dialog open, but accept logic runs)
        hub._handleDialogueChoice('accept', { id: 'aldric' }, '', [], 'offer', questData, 0, []);
      } catch (e) {
        return { error: 'handler threw: ' + e.message, questId: questData.id };
      }
      return { questId: questData.id, activeAfter: qs.getActiveQuests('aldric').map(q => q.id) };
    });
    console.log('Accept result:', JSON.stringify(acceptResult));

    await page.waitForTimeout(200);

    const indAfter = await readAldricIndicator();
    console.log('Aldric indicator AFTER accept: ', JSON.stringify(indAfter));
    if (indAfter.text === '…' && indAfter.visible) {
      console.log('  ✓ Accepted quest shows gray "…" — indicator transitioned correctly');
    } else if (indAfter.text === '!' && indAfter.visible) {
      console.log('  ✗ INDICATOR DID NOT UPDATE — still shows "!" after accept');
    } else if (indAfter.text === '?' && indAfter.visible) {
      console.log('  (quest already ready to complete — shows "?")');
    } else {
      console.log('  ✗ Unexpected indicator state:', indAfter);
    }

    // Walk-up interaction smoke test: verify the dialogue system can be opened
    // by directly invoking _showNpcDialogue (the same call site _refreshInteractionPrompt uses).
    const dialogueOpened = await page.evaluate(() => {
      const hub = window.game.scene.getScene('HubSceneV2');
      const aldric = hub.npcs.find(n => n.data && n.data.id === 'aldric');
      if (!aldric) return { error: 'no aldric' };
      try {
        hub._showNpcDialogue(aldric.data);
        return { opened: !!hub._dialogOpen };
      } catch (e) {
        return { error: 'showNpcDialogue threw: ' + e.message };
      }
    });
    console.log('Dialogue open via _showNpcDialogue:', JSON.stringify(dialogueOpened));
    if (dialogueOpened.opened) {
      console.log('  ✓ NPC dialogue opened successfully');
    } else {
      console.log('  ✗ NPC dialogue failed to open:', dialogueOpened);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-npc-dialogue.png') });
    console.log('Screenshot: 07-npc-dialogue.png');

    // Close dialogue before warping to GameScene
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ---- HUD Verification (requires GameScene) ----
    console.log('\n--- HUD Verification ---');
    const expectedLoadout = await page.evaluate(() => window.AbilitySystem.getActiveLoadout());
    const expectedEquipped = Object.values(expectedLoadout || {}).filter(Boolean);
    console.log('Equipped abilities going into dungeon:', expectedEquipped);

    // Force-start GameScene directly (skip walking to entrance)
    await page.evaluate(() => {
      const hub = window.game.scene.getScene('HubSceneV2');
      if (hub && hub.scene) {
        hub.scene.start('GameScene');
      }
    });

    // Wait for GameScene to come up and create the HUD
    try {
      await page.waitForFunction(() => {
        const gs = window.game?.scene?.getScene?.('GameScene');
        return gs && gs.scene.isActive() && typeof window._getAbilityHUDState === 'function';
      }, { timeout: 15000 });
      console.log('GameScene + HUD ready');
    } catch (e) {
      console.log('✗ GameScene/HUD did not become ready');
    }

    await page.waitForTimeout(800);

    const hudState = await page.evaluate(() => window._getAbilityHUDState && window._getAbilityHUDState());
    if (Array.isArray(hudState)) {
      const visible = hudState.filter(t => t.visible);
      const visibleKeys = visible.map(t => t.key);
      console.log('HUD tiles visible:', visibleKeys);
      console.log('All HUD tiles:', JSON.stringify(hudState));

      const expectedCount = 1 + expectedEquipped.length; // attack + equipped
      if (visible.length === expectedCount && visibleKeys.includes('attack')) {
        console.log('  ✓ HUD shows attack + ' + expectedEquipped.length + ' equipped abilities');
      } else {
        console.log('  ✗ HUD count wrong — expected ' + expectedCount + ' tiles, got ' + visible.length);
      }

      // Verify each equipped ability has its slot tile visible with correct ability id
      const visibleEquippedIds = hudState.filter(t => t.visible && t.abilityId).map(t => t.abilityId);
      const missing = expectedEquipped.filter(id => !visibleEquippedIds.includes(id));
      if (missing.length === 0) {
        console.log('  ✓ All equipped abilities present in HUD');
      } else {
        console.log('  ✗ Equipped abilities missing from HUD:', missing);
      }

      // Verify slot tile labels match the equipped ability name + correct key letter (Q/E/R/F)
      const expectedSlotKey = { slot1: 'Q', slot2: 'W', slot3: 'E', slot4: 'R' };
      const labelOk = hudState
        .filter(t => t.slot && t.visible)
        .every(t => t.keyLabel === expectedSlotKey[t.slot] && t.label && t.label !== 'Empty');
      console.log(labelOk
        ? '  ✓ Slot tile labels match Q/E/R/F binding and ability names'
        : '  ✗ Slot tile labels mismatched — ' + JSON.stringify(hudState.filter(t => t.slot && t.visible)));

      // Verify no unequipped ability tile leaks in
      const leaked = hudState.filter(t => t.visible && t.slot && t.abilityId && !expectedEquipped.includes(t.abilityId));
      if (leaked.length === 0) {
        console.log('  ✓ No unequipped ability tiles in HUD');
      } else {
        console.log('  ✗ Unequipped tiles leaking into HUD:', leaked.map(t => t.key));
      }

      // Verify visible tiles stack without gaps (y positions strictly increasing)
      const ys = visible.map(t => t.y).sort((a, b) => a - b);
      const stacked = ys.every((y, i) => i === 0 || y > ys[i - 1]);
      console.log(stacked ? '  ✓ Tiles stacked without overlap' : '  ✗ Tiles overlap/misaligned');
    } else {
      console.log('  ✗ window._getAbilityHUDState unavailable in GameScene');
    }

    // HUD region screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-hud-final.png'),
      clip: { x: 1200, y: 100, width: 336, height: 400 }
    });
    console.log('Screenshot: 06-hud-final.png (HUD region)');

    // ---- Crafting Scene: inventory recraft test ----
    console.log('\n--- Crafting Scene Test ---');

    // Inject an equipment item into inventory, then start CraftingScene
    const craftSetup = await page.evaluate(() => {
      if (typeof window.inventory === 'undefined') return { error: 'no inventory global' };
      // Find an empty slot
      let idx = -1;
      for (let i = 0; i < window.inventory.length; i++) {
        if (!window.inventory[i]) { idx = i; break; }
      }
      if (idx < 0) return { error: 'inventory full' };
      const testItem = {
        type: 'weapon', key: 'WPN_TEST', name: 'Test-Klinge',
        tier: 0, affixes: [], iLevel: 1, itemLevel: 1,
        baseStats: { damage: 5 },
        hp: 0, damage: 5, speed: 0, range: 0, armor: 0, crit: 0
      };
      window.inventory[idx] = testItem;
      // Give some Eisenbrocken so enhance is affordable
      if (typeof window.changeMaterialCount === 'function') {
        window.changeMaterialCount('MAT', 50);
      }
      // Start crafting scene
      window.game.scene.start('CraftingScene');
      return { injectedAt: idx, testName: testItem.name };
    });
    console.log('Crafting setup:', JSON.stringify(craftSetup));

    try {
      await page.waitForFunction(() => {
        const cs = window.game?.scene?.getScene?.('CraftingScene');
        return cs && cs.scene.isActive() && cs.invRows;
      }, { timeout: 10000 });
      console.log('CraftingScene ready');
    } catch (e) {
      console.log('✗ CraftingScene did not become ready');
    }

    await page.waitForTimeout(500);

    const invListState = await page.evaluate(() => {
      const cs = window.game.scene.getScene('CraftingScene');
      return {
        rowCount: cs.invRows.length,
        rows: cs.invRows.map(r => ({
          invIndex: r.invIndex,
          label: r.nameText && r.nameText.text
        })),
        emptyTextVisible: cs.invEmptyText && cs.invEmptyText.visible
      };
    });
    console.log('Inventory list state:', JSON.stringify(invListState));

    if (invListState.rowCount > 0 && !invListState.emptyTextVisible) {
      console.log('  ✓ Inventory list shows ' + invListState.rowCount + ' equipment item(s)');
    } else {
      console.log('  ✗ Inventory list empty or not rendered');
    }

    const testRow = invListState.rows.find(r => r.label && r.label.includes('Test-Klinge'));
    if (testRow) {
      console.log('  ✓ Injected test item visible:', testRow.label);
    } else {
      console.log('  ✗ Injected test item NOT in list');
    }

    // Click the test item via internal selection (faster than mouse simulation).
    // WP08 T050: the Verbessern button was removed; only salvage remains.
    const selectResult = await page.evaluate(() => {
      const cs = window.game.scene.getScene('CraftingScene');
      const testRow = cs.invRows.find(r => r.nameText && r.nameText.text.includes('Test-Klinge'));
      if (!testRow) return { error: 'no test row' };
      cs._selectInventory(testRow.invIndex);
      return {
        selection: cs._selection,
        salvageBtnVisible: cs.salvageBtn && cs.salvageBtn.container.visible,
        enhanceBtnRemoved: cs.enhanceBtn === null,
        infoText: cs.enhanceInfo && cs.enhanceInfo.text
      };
    });
    console.log('After selecting inventory item:', JSON.stringify(selectResult));

    if (selectResult.selection && selectResult.selection.kind === 'inv'
        && selectResult.salvageBtnVisible && selectResult.enhanceBtnRemoved) {
      console.log('  ✓ Salvage UI activated and Verbessern button removed (WP08)');
    } else {
      console.log('  ✗ UI did not activate correctly for inventory selection');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-crafting.png') });
    console.log('Screenshot: 08-crafting.png');

    // ---- Shop Test (WP08 T053) ----
    // Returns to the hub, injects gold + a magic item, opens the Schwarzmarkt,
    // switches to Reroll, and verifies LootSystem.rerollItem mutates affixes.
    console.log('\n--- Shop Test (WP08 T053) ---');
    // Close CraftingScene first
    await page.evaluate(() => {
      const cs = window.game.scene.getScene('CraftingScene');
      if (cs && cs._returnToHub) { try { cs._returnToHub(); } catch (e) {} }
    });
    await page.waitForTimeout(600);

    const shopSetup = await page.evaluate(() => {
      if (!window.LootSystem) return { error: 'no LootSystem' };
      if (typeof window.LootSystem.grantGold === 'function') {
        window.LootSystem.grantGold(1000);
      }
      // Inject a forced-tier-1 (Magic) weapon into inventory so reroll has an affix to mutate
      let magicItem = null;
      try {
        magicItem = window.LootSystem.rollItem('WPN_EISENKLINGE', 5, 1);
      } catch (e) {
        return { error: 'rollItem failed: ' + e.message };
      }
      let injectedAt = -1;
      for (let i = 0; i < window.inventory.length; i++) {
        if (!window.inventory[i]) { window.inventory[i] = magicItem; injectedAt = i; break; }
      }
      return { injectedAt, tier: magicItem && magicItem.tier, affixCount: magicItem && magicItem.affixes && magicItem.affixes.length };
    });
    console.log('Shop setup:', JSON.stringify(shopSetup));

    const shopOpen = await page.evaluate(() => {
      if (typeof window.openShopScene === 'function') {
        const hub = window.game.scene.getScene('HubSceneV2');
        try { window.openShopScene(hub); return { ok: true, method: 'openShopScene' }; }
        catch (e) { /* fall through to start */ }
      }
      // Fallback: register + start ShopScene directly against the SceneManager
      try {
        if (window.ShopScene && window.game && window.game.scene) {
          let registered = null;
          try { registered = window.game.scene.getScene('ShopScene'); } catch (e) {}
          if (!registered) {
            window.game.scene.add('ShopScene', window.ShopScene, false);
          }
          window.game.scene.start('ShopScene');
          return { ok: true, method: 'start' };
        }
      } catch (e) { return { ok: false, error: e.message }; }
      return { ok: false, error: 'no ShopScene export' };
    });
    console.log('Shop open attempt:', JSON.stringify(shopOpen));

    let shopActive = false;
    try {
      await page.waitForFunction(() => {
        return window.game && window.game.scene.isActive('ShopScene');
      }, { timeout: 5000 });
      shopActive = true;
      console.log('  ✓ ShopScene activated');
    } catch (e) {
      console.log('  ⚠ ShopScene did not become active — exercising LootSystem.rerollItem directly');
    }

    // Regardless of scene activation, verify the reroll contract works against
    // the injected item. This is the load-bearing check for T053 — the whole
    // reason we added a shop block is to catch reroll regressions.
    const rerollResult = await page.evaluate(() => {
      const shop = window.game.scene.getScene('ShopScene');
      if (shop && typeof shop._renderTab === 'function') {
        try { shop._renderTab('reroll'); } catch (e) { /* ignore */ }
      }
      // Prefer items that already have affixes (the injected Magic weapon).
      // Skip devCheat items and anything with tier 0 or no affixes.
      const items = (window.inventory || []).filter((it) => it
        && it.type !== 'potion'
        && !it.devCheat
        && typeof it.tier === 'number' && it.tier >= 1
        && Array.isArray(it.affixes) && it.affixes.length > 0);
      if (items.length === 0) return { error: 'no reroll-eligible items' };
      const target = items[0];
      if (shop) shop.selectedRerollItem = target;
      const before = JSON.stringify(target.affixes);
      const cost = (shop && typeof shop._computeRerollCost === 'function')
        ? shop._computeRerollCost(target)
        : (window.LootSystem._computeRerollCost ? window.LootSystem._computeRerollCost(target) : 0);
      const ok = window.LootSystem.rerollItem(target, cost);
      const after = JSON.stringify(target.affixes);
      return { ok, changed: before !== after, before, after, cost };
    });
    console.log('  Reroll result:', JSON.stringify(rerollResult));
    if (rerollResult.ok && rerollResult.changed) {
      console.log('  ✓ Reroll mutated affixes');
    } else if (rerollResult.ok) {
      console.log('  ⚠ Reroll succeeded but affixes unchanged (low affix count?)');
    } else {
      console.log('  ✗ Reroll failed:', JSON.stringify(rerollResult));
    }

    if (shopActive) {
      // Close shop with ESC
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const shopClosed = await page.evaluate(() => !window.game.scene.isActive('ShopScene'));
      if (shopClosed) console.log('  ✓ Shop closed via ESC');
      else console.log('  ⚠ Shop did not close via ESC');
    }
  }

  if (mode === '--dungeon' || mode === '--full') {
    // Walk up toward Rathaus entrance
    console.log('\nWalking up toward Rathaus...');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(2500);
    await page.keyboard.up('ArrowUp');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-walked-up.png') });
    console.log('Screenshot saved: 02-walked-up.png');

    // Press E to interact
    await page.keyboard.press('e');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-after-interact.png') });
    console.log('Screenshot saved: 03-after-interact.png');
  }

  // Final report
  console.log('\n=== TEST REPORT ===');
  console.log('Active scenes:', sceneInfo.activeScenes);
  console.log('Player exists:', sceneInfo.playerExists);
  console.log('Errors found:', errors.length);
  if (errors.length > 0) {
    console.log('\n--- ERRORS ---');
    errors.slice(0, 20).forEach(e => console.log('  ✗', e));
  }
  if (warnings.length > 0 && (mode === '--full')) {
    console.log('\n--- WARNINGS (first 10) ---');
    warnings.slice(0, 10).forEach(w => console.log('  ⚠', w));
  }

  // Save full log
  const logFile = path.join(SCREENSHOT_DIR, 'console.log');
  fs.writeFileSync(logFile, consoleLogs.join('\n'));
  console.log('\nFull console log saved:', logFile);

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
