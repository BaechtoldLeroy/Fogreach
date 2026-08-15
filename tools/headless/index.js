// tools/headless/index.js — oeffentliche API des Headless-Testsystems.
//
// Beispiel:
//   const { launch } = require('./tools/headless');
//   const h = await launch();                  // bootet bis StartScene laeuft
//   h.step(60);                                // 60 Frames takten
//   const s = h.scene('StartScene');
//   await h.shutdown();
//
// Warum eine eigene Schicht ueber boot.js: Phasers Boot und der Asset-Loader
// sind asynchron (Timer + Datei-IO), die Spiel-Loop dagegen wird hier von Hand
// getaktet. Beides muss verschraenkt werden — `settle()` kapselt genau das,
// damit Tests nicht jedes Mal die Warte-/Takt-Choreografie nachbauen muessen.

const { boot, readScriptOrder } = require('./boot');

const SCENE_STATUS = {
  0: 'PENDING', 1: 'INIT', 2: 'START', 3: 'LOADING',
  4: 'CREATING', 5: 'RUNNING', 6: 'PAUSED', 7: 'SLEEPING',
  8: 'SHUTDOWN', 9: 'DESTROYED',
};

/** Laesst die Node-Ereignisschleife einmal durchlaufen (Timer + Datei-IO). */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function decorate(h) {
  const game = () => h.window.game;

  /** Alle Szenen mit lesbarem Status. */
  h.scenes = function scenes() {
    const g = game();
    if (!g || !g.scene) return [];
    return g.scene.scenes.map((s) => ({
      key: s.sys && s.sys.settings ? s.sys.settings.key : '?',
      status: SCENE_STATUS[s.sys.settings.status] || s.sys.settings.status,
      active: !!(s.sys && s.sys.isActive && s.sys.isActive()),
      scene: s,
    }));
  };

  /** Eine Szene per Schluessel holen (das echte Phaser-Objekt). */
  h.scene = function scene(key) {
    const found = h.scenes().find((s) => s.key === key);
    return found ? found.scene : null;
  };

  h.activeScenes = function activeScenes() {
    return h.scenes().filter((s) => s.active).map((s) => s.key);
  };

  /**
   * Taktet die Loop und laesst dabei die Ereignisschleife atmen, bis `pred()`
   * wahr ist oder das Zeitbudget aufgebraucht ist.
   * @returns {Promise<boolean>} true, wenn pred erfuellt wurde
   */
  h.settle = async function settle(pred, opts) {
    opts = opts || {};
    const maxRounds = opts.maxRounds || 80;
    const perRound = opts.framesPerRound || 10;
    for (let i = 0; i < maxRounds; i++) {
      if (typeof pred === 'function' && pred(h)) return true;
      h.step(perRound);
      await flush();
    }
    return typeof pred === 'function' ? !!pred(h) : true;
  };

  /** Wartet, bis eine bestimmte Szene laeuft. */
  h.waitForScene = function waitForScene(key, opts) {
    return h.settle((x) => {
      const s = x.scenes().find((sc) => sc.key === key);
      return !!(s && s.status === 'RUNNING' && s.active);
    }, opts);
  };

  /** Nur echte Fehler (ohne Warnungen). */
  h.hardErrors = function hardErrors() {
    return h.errors.filter((e) => e.level === 'error');
  };

  h.shutdown = async function shutdown() {
    try {
      const g = game();
      if (g && typeof g.destroy === 'function') g.destroy(true);
    } catch (e) { /* Abbau darf nie den Test kippen */ }
    await flush();
  };

  h.flush = flush;
  return h;
}

/**
 * Startet das Spiel headless und wartet, bis die erste Szene laeuft.
 * @param {object} [opts] width/height/verbose/waitFor
 */
async function launch(opts) {
  opts = opts || {};
  const h = decorate(boot(opts));
  await flush();                       // Phasers eigenen Boot-Timer durchlassen
  const target = opts.waitFor || 'StartScene';
  await h.waitForScene(target, { maxRounds: opts.maxRounds || 80 });
  return h;
}

module.exports = { launch, boot, readScriptOrder, flush, SCENE_STATUS };
