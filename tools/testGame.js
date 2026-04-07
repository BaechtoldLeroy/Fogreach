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
