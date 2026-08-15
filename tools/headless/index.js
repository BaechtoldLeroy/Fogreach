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
const { attachLab } = require('./lab');

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

  // -------------------------------------------------------------------------
  // Eingabe-Treiber
  // -------------------------------------------------------------------------
  // Schreibt auf DIESELBEN Pfade wie echte Eingaben, damit Tests den echten
  // Spielcode durchlaufen und keinen Sonderweg:
  //   Bewegung  -> cursors.<dir>.isDown   (gelesen in player.js handlePlayerMovement)
  //   Angriff   -> globales attack()      (player.js)
  //   Faehigkeit-> AbilitySystem.tryActivate(slot, scene)  (wie Q/W/E/R und Mobile)
  h.input = {
    /** Richtungstasten setzen, z. B. hold({ left: true, up: true }). */
    hold(dirs) {
      const d = dirs || {};
      ['left', 'right', 'up', 'down'].forEach((k) => {
        const v = !!d[k];
        try { h.run(`if (typeof cursors !== 'undefined' && cursors && cursors.${k}) cursors.${k}.isDown = ${v};`); }
        catch (e) { /* Szene evtl. noch ohne cursors */ }
      });
    },
    releaseAll() { h.input.hold({}); },

    /** Bewegt sich Richtung Zielpunkt, indem die passenden Tasten gehalten werden. */
    steerTowards(x, y, deadzone) {
      const dz = typeof deadzone === 'number' ? deadzone : 8;
      const p = h.run('(typeof player !== "undefined" && player) ? { x: player.x, y: player.y } : null');
      if (!p) return false;
      h.input.hold({
        left: p.x - x > dz,
        right: x - p.x > dz,
        up: p.y - y > dz,
        down: y - p.y > dz,
      });
      return true;
    },

    // WICHTIG: attack() erwartet die Szene als `this` (nutzt this.time.delayedCall).
    // Im Spiel wird es als `attack.call(this)` aus dem Eingabe-Handler gerufen
    // (main.js:1168) — headless muss denselben Kontext liefern, sonst passiert
    // nichts (und zwar lautlos, ohne Fehler).
    attack(sceneKey) {
      try {
        h.run(`(function () {
          var sc = window.game.scene.getScene('${sceneKey || 'GameScene'}');
          if (sc && typeof attack === 'function') attack.call(sc);
        })()`);
        return true;
      } catch (e) { return false; }
    },

    ability(slot, sceneKey) {
      try {
        h.run(`(function () {
          var sc = window.game.scene.getScene('${sceneKey || 'GameScene'}');
          if (window.AbilitySystem && typeof window.AbilitySystem.tryActivate === 'function') {
            window.AbilitySystem.tryActivate('slot${slot}', sc);
          }
        })()`);
        return true;
      } catch (e) { return false; }
    },

    interact() {
      try { h.run('window.__MOBILE_INTERACT_ACTIVE__ = true;'); return true; }
      catch (e) { return false; }
    },
  };

  // -------------------------------------------------------------------------
  // Weltzustand — bequemer Lesezugriff auf die top-level-Globals
  // -------------------------------------------------------------------------
  h.world = function world() {
    return h.run(`(function () {
      var p = (typeof player !== 'undefined' && player) ? player : null;
      var e = (typeof enemies !== 'undefined' && enemies) ? enemies : window.enemies;
      return {
        player: p ? { x: p.x, y: p.y, active: !!p.active } : null,
        hp: window.playerHealth, maxHp: window.playerMaxHealth,
        enemies: (e && e.countActive) ? e.countActive(true) : 0,
        depth: window.DUNGEON_DEPTH, wave: window.currentWave,
        enemyList: (e && e.getChildren) ? e.getChildren()
          .filter(function (x) { return x && x.active; })
          .map(function (x) { return { x: x.x, y: x.y, hp: x.hp }; }) : [],
      };
    })()`);
  };

  /** Gesamtzahl erlegter Gegner im Run (aus der Run-Statistik des Spiels). */
  h.kills = function kills() {
    return h.run('(window.runStats && window.runStats.enemiesKilled) || 0');
  };

  // -------------------------------------------------------------------------
  // Bot — spielt das Spiel ueber den Eingabe-Treiber
  // -------------------------------------------------------------------------
  h.bot = {
    /**
     * Laeuft zum naechsten Gegner und schlaegt zu, bis `rounds` verbraucht sind
     * oder `stopWhen(h)` wahr wird. Bewusst simpel: der Bot muss nicht klug
     * sein, er soll den Zustandsraum abdecken.
     * @returns {Promise<{kills:number, rounds:number}>}
     */
    async hunt(opts) {
      opts = opts || {};
      const rounds = opts.rounds || 250;
      const framesPerRound = opts.framesPerRound || 4;
      // 60 px: die Nahkampf-Reichweite des Spiels ist groesser als sie aussieht.
      // Mit 34 blieb der Bot ausserhalb und traf nie (0 Kills ueber 200 Runden).
      const attackRange = opts.attackRange || 60;
      const k0 = h.kills();
      let used = 0;

      // Feststeck-Erkennung: Die Lenkung haelt nur Richtungstasten, sie kennt
      // keine Wegfindung. An Waenden/Hindernissen bleibt der Bot sonst dauerhaft
      // in konstanter Distanz haengen (beobachtet: 67 px). Bewegt er sich ueber
      // mehrere Runden kaum, weicht er kurz zufaellig aus. Gegner verfolgen den
      // Spieler ohnehin — Warten allein bringt oft schon Treffer.
      let lastX = null; let lastY = null; let stuckFor = 0; let detourLeft = 0; let detour = null;

      for (let i = 0; i < rounds; i++) {
        used++;
        if (typeof opts.stopWhen === 'function' && opts.stopWhen(h)) break;
        const w = h.world();
        if (!w.player || !w.enemyList.length) {
          h.input.releaseAll();
          h.step(framesPerRound);
          await flush();
          continue;
        }

        if (lastX !== null) {
          const moved = Math.hypot(w.player.x - lastX, w.player.y - lastY);
          stuckFor = moved < 2 ? stuckFor + 1 : 0;
        }
        lastX = w.player.x; lastY = w.player.y;

        let best = null; let bd = Infinity;
        for (const e of w.enemyList) {
          const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
          if (d < bd) { bd = d; best = e; }
        }

        if (bd <= attackRange) {
          h.input.releaseAll();
          h.input.attack();
          detourLeft = 0;
        } else if (detourLeft > 0) {
          h.input.hold(detour);
          detourLeft--;
        } else if (stuckFor >= 4) {
          // Zufaellige Ausweichrichtung fuer ein paar Runden
          const dirs = [{ left: true }, { right: true }, { up: true }, { down: true },
            { left: true, up: true }, { right: true, down: true }];
          detour = dirs[Math.floor(Math.random() * dirs.length)];
          detourLeft = 8;
          stuckFor = 0;
          h.input.hold(detour);
        } else {
          h.input.steerTowards(best.x, best.y);
        }

        h.step(framesPerRound);
        await flush();
      }
      h.input.releaseAll();
      return { kills: h.kills() - k0, rounds: used };
    },

    /**
     * Vollwertiger Spieltest-Bot. Anders als hunt() nutzt er die Systeme:
     * Truhen zerschlagen, Faehigkeiten zuenden, Tranke trinken, bessere
     * Ausruestung anlegen — und weicht Hindernissen gezielter aus.
     *
     * Hintergrund: hunt() war fuer Stufe 2 gebaut ("laeuft die Schleife?") und
     * ignorierte strukturell die ergiebigere Haelfte des Lootsystems — Truhen
     * sind ZERSTOERBARE HINDERNISSE (main.js breakDestructibleObstacle), keine
     * [E]-Objekte, und hunt() greift nur Gegner an. Bodenbeute wird dagegen
     * automatisch eingesammelt (overlap player<->lootGroup).
     */
    async play(opts) {
      opts = opts || {};
      const rounds = opts.rounds || 400;
      const framesPerRound = opts.framesPerRound || 4;
      const attackRange = opts.attackRange || 60;
      const potionAt = typeof opts.potionAt === 'number' ? opts.potionAt : 0.45;
      const equipEvery = opts.equipEvery || 40;

      const k0 = h.kills();
      const stats = { kills: 0, chestsBroken: 0, potions: 0, abilities: 0, equipped: 0,
        skillPoints: 0, abilitiesEquipped: 0, rounds: 0, deaths: 0 };
      let lastX = null; let lastY = null; let stuckFor = 0; let detourLeft = 0; let detour = null;

      for (let i = 0; i < rounds; i++) {
        stats.rounds++;

        // --- Zustand in EINEM Durchgriff holen (spart vm-Uebergaenge) --------
        const st = h.run(`(function () {
          var p = (typeof player !== 'undefined' && player) ? player : null;
          var eg = (typeof enemies !== 'undefined' && enemies) ? enemies : window.enemies;
          var og = (typeof obstacles !== 'undefined' && obstacles) ? obstacles : window.obstacles;
          var list = (eg && eg.getChildren) ? eg.getChildren().filter(function (x) { return x && x.active; })
            .map(function (x) { return { x: x.x, y: x.y }; }) : [];
          // Truhen/Faesser/Kisten = zerstoerbare Hindernisse mit lootTier
          var chests = [];
          if (og && og.getChildren) {
            og.getChildren().forEach(function (o) {
              if (!o || !o.active || !o.getData) return;
              var t = String(o.getData('type') || '').toLowerCase();
              if (t.indexOf('chest') === 0 || t.indexOf('barrel') === 0 || t.indexOf('crate') === 0) {
                chests.push({ x: o.x, y: o.y });
              }
            });
          }
          return {
            px: p ? p.x : null, py: p ? p.y : null,
            hp: window.playerHealth, maxHp: window.playerMaxHealth,
            enemies: list, chests: chests,
          };
        })()`);

        if (!st || st.px === null) { stats.deaths++; break; }
        const enemyList = Array.from(st.enemies || []);
        const chestList = Array.from(st.chests || []);

        // --- Trank, wenn es eng wird ----------------------------------------
        if (st.maxHp > 0 && (st.hp / st.maxHp) < potionAt) {
          const drank = h.run(`(function () {
            if (window.LootSystem && typeof window.LootSystem.onPotionKey === 'function') {
              return !!window.LootSystem.onPotionKey();
            }
            return false;
          })()`);
          if (drank) stats.potions++;
        }

        // --- Fortschritt ausgeben: Talentpunkte + Faehigkeiten in die Slots --
        // Ein frischer Charakter hat NULL von 12 Faehigkeiten gelernt — sie
        // haengen komplett am Talentbaum. Die Kette lautet:
        //   Level -> Talentpunkt -> investPoint() -> Faehigkeit GELERNT
        //   -> setSlot() -> erst jetzt per tryActivate nutzbar.
        // Ohne den setSlot-Schritt bleibt das Loadout leer und der Bot koennte
        // nie eine Faehigkeit zuenden.
        // ACHTUNG: isNodeAvailable(id, playerLevel) und investPoint(id, playerLevel)
        // nehmen das Level als PARAMETER und fallen ohne ihn auf 0 zurueck —
        // dann ist KEIN Knoten verfuegbar (minLevel 1).
        if (i % equipEvery === 0) {
          const prog = h.run(`(function () {
            var ST = window.SkillTree, A = window.AbilitySystem;
            if (!ST || !A) return { invested: 0, slotted: 0 };
            var lvl = window.playerLevel || 1;
            var invested = 0;
            for (var guard = 0; guard < 20 && ST.getSkillPoints() > 0; guard++) {
              var avail = ST.getAllNodes().filter(function (n) { return ST.isNodeAvailable(n.id, lvl); });
              if (!avail.length) break;
              if (!ST.investPoint(avail[0].id, lvl)) break;
              invested++;
            }
            var slotted = 0;
            var learned = A.getLearnedAbilities() || [];
            var loadout = A.getActiveLoadout() || {};
            for (var s = 0; s < A.SLOT_KEYS.length; s++) {
              var key = A.SLOT_KEYS[s];
              if (loadout[key]) continue;
              var free = learned.filter(function (id) { return !A.isEquipped(id); });
              if (!free.length) break;
              if (A.setSlot(key, free[0])) slotted++;
            }
            return { invested: invested, slotted: slotted };
          })()`);
          stats.skillPoints += prog.invested;
          stats.abilitiesEquipped += prog.slotted;
        }

        // --- Bessere Ausruestung anlegen (nicht jede Runde) -----------------
        if (i % equipEvery === 0) {
          stats.equipped += h.run(`(function () {
            if (typeof inventory === 'undefined' || !Array.isArray(inventory)) return 0;
            if (typeof equipSelectedItem !== 'function' || typeof window.computeItemPower !== 'function') return 0;
            var slots = ['weapon', 'head', 'body', 'boots', 'amulet'];
            var n = 0;
            for (var s = 0; s < slots.length; s++) {
              var slot = slots[s];
              var cur = (typeof equipment !== 'undefined' && equipment) ? equipment[slot] : null;
              var curPow = cur ? window.computeItemPower(cur) : -1;
              var bestIdx = -1, bestPow = curPow;
              for (var idx = 0; idx < inventory.length; idx++) {
                var it = inventory[idx];
                if (!it || it.type !== slot) continue;
                var pw = window.computeItemPower(it);
                if (pw > bestPow) { bestPow = pw; bestIdx = idx; }
              }
              if (bestIdx >= 0) { invSelected = bestIdx; equipSelectedItem(); n++; }
            }
            return n;
          })()`);
        }

        // --- Ziel waehlen: Gegner zuerst, sonst Truhe -----------------------
        let target = null; let td = Infinity; let targetIsChest = false;
        enemyList.forEach((e) => {
          const d = Math.hypot(e.x - st.px, e.y - st.py);
          if (d < td) { td = d; target = e; }
        });
        if (!target) {
          chestList.forEach((c) => {
            const d = Math.hypot(c.x - st.px, c.y - st.py);
            if (d < td) { td = d; target = c; targetIsChest = true; }
          });
        }

        if (!target) { h.input.releaseAll(); h.step(framesPerRound); await flush(); continue; }

        // --- Feststeck-Erkennung -------------------------------------------
        if (lastX !== null) {
          stuckFor = Math.hypot(st.px - lastX, st.py - lastY) < 2 ? stuckFor + 1 : 0;
        }
        lastX = st.px; lastY = st.py;

        if (td <= attackRange) {
          h.input.releaseAll();
          detourLeft = 0;
          if (targetIsChest) {
            // Truhen brechen ueber den echten Pfad (dieselbe Funktion, die auch
            // Skills nutzen), nicht ueber einen Sonderweg.
            const broke = h.run(`(function () {
              var sc = window.game.scene.getScene('GameScene');
              if (typeof breakDestructiblesInRange !== 'function') return 0;
              return breakDestructiblesInRange(sc, 90) || 0;
            })()`);
            stats.chestsBroken += broke;
            if (!broke) h.input.attack();
          } else {
            h.input.attack();
            // Faehigkeit zuenden, wenn eine bereit ist (rotierend ueber die Slots)
            const slot = (i % 4) + 1;
            const fired = h.run(`(function () {
              var sc = window.game.scene.getScene('GameScene');
              if (!window.AbilitySystem || typeof window.AbilitySystem.tryActivate !== 'function') return false;
              try { return !!window.AbilitySystem.tryActivate('slot${slot}', sc); } catch (e) { return false; }
            })()`);
            if (fired) stats.abilities++;
          }
        } else if (detourLeft > 0) {
          h.input.hold(detour); detourLeft--;
        } else if (stuckFor >= 4) {
          const dirs = [{ left: true }, { right: true }, { up: true }, { down: true },
            { left: true, up: true }, { right: true, down: true }, { left: true, down: true }, { right: true, up: true }];
          detour = dirs[Math.floor(Math.random() * dirs.length)];
          detourLeft = 10; stuckFor = 0;
          h.input.hold(detour);
        } else {
          h.input.steerTowards(target.x, target.y);
        }

        h.step(framesPerRound);
        await flush();
      }

      h.input.releaseAll();
      stats.kills = h.kills() - k0;
      return stats;
    },
  };

  h.flush = flush;
  attachLab(h);   // Stufe 3: Gameplay-Pruefwerkzeuge (h.lab)
  return h;
}

/**
 * Startet direkt in einen Dungeon-Run (Tiefe `depth`).
 * Nutzt den vorhandenen Debug-Einstieg `?dungeon=N`, der intern denselben
 * _enterLocation-Pfad geht wie ein echter Klick im Hub.
 * Braucht den CANVAS-Renderer: graphics.js erzeugt Spieler-/Weltgrafik ueber
 * generateTexture(), was ohne echten Renderer nicht funktioniert.
 */
async function launchDungeon(opts) {
  opts = opts || {};
  const depth = opts.depth || 1;
  const h = await launch(Object.assign({}, opts, {
    search: '?dungeon=' + depth,
    renderer: opts.renderer || 'canvas',
    waitFor: 'StartScene',
  }));
  const ok = await h.waitForScene('GameScene', { maxRounds: opts.maxRounds || 250 });
  if (!ok) throw new Error('GameScene wurde nicht erreicht');
  await h.settle(() => false, { maxRounds: opts.warmupRounds || 10 });
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

module.exports = { launch, launchDungeon, boot, readScriptOrder, flush, SCENE_STATUS };
