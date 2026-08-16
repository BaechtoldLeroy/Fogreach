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
const { attachNav } = require('./nav');

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
    /**
     * Richtungstasten setzen, z. B. hold({ left: true, up: true }).
     *
     * Setzt BEIDE Tastenquellen: das globale `cursors` (GameScene, player.js
     * handlePlayerMovement) UND `scene.cursors` jeder laufenden Szene. Der Hub
     * legt sich naemlich ein eigenes an (HubSceneV2.js:280) und liest nur
     * dieses (HubSceneV2.js:913) — wer nur das globale setzt, bewegt im Hub
     * gar nichts. Das sah in zwei Spieltests wie "der Weg ist blockiert" aus,
     * war aber schlicht eine Luecke im Testwerkzeug.
     */
    hold(dirs) {
      const d = dirs || {};
      ['left', 'right', 'up', 'down'].forEach((k) => {
        const v = !!d[k];
        try { h.run(`if (typeof cursors !== 'undefined' && cursors && cursors.${k}) cursors.${k}.isDown = ${v};`); }
        catch (e) { /* Szene evtl. noch ohne cursors */ }
      });
      // Werte vereinheitlichen: hold({ left: 1 }) muss genauso wirken wie
      // hold({ left: true }).
      const norm = JSON.stringify({
        left: !!d.left, right: !!d.right, up: !!d.up, down: !!d.down,
      });
      try {
        h.run(`(function () {
          var want = ${norm};
          var g = window.game;
          if (!g || !g.scene) return;
          g.scene.scenes.forEach(function (s) {
            if (!s || !s.cursors || !s.sys || !s.sys.isActive || !s.sys.isActive()) return;
            ['left', 'right', 'up', 'down'].forEach(function (k) {
              if (s.cursors[k]) s.cursors[k].isDown = want[k];
            });
          });
        })()`);
      } catch (e) { /* keine Szene mit eigenen Tasten */ }
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

    /**
     * Interagieren — [E].
     *
     * Zwei Wege, weil das Spiel zwei kennt: die Mobile-Flagge (Dungeon-Treppen,
     * Tueren) UND das Tastaturereignis `keydown-E`. Der Hub haengt
     * ausschliesslich am Ereignis (HubSceneV2.js:394), der Dungeon nutzt es fuer
     * NPCs und Haendler (eventSystem.js:503). Wer nur die Flagge setzt, kann im
     * Hub keinen Ort betreten.
     */
    interact() {
      let ok = false;
      try { h.run('window.__MOBILE_INTERACT_ACTIVE__ = true;'); ok = true; } catch (e) { /* egal */ }
      try {
        h.run(`(function () {
          var g = window.game;
          if (!g || !g.scene) return;
          g.scene.scenes.forEach(function (s) {
            if (!s || !s.sys || !s.sys.isActive || !s.sys.isActive()) return;
            if (s.input && s.input.keyboard && s.input.keyboard.emit) {
              s.input.keyboard.emit('keydown-E');
            }
          });
        })()`);
        ok = true;
      } catch (e) { /* keine Szene mit Tastatur */ }
      return ok;
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
        skillPoints: 0, abilitiesEquipped: 0, rounds: 0, deaths: 0,
        roomsEntered: 0, stairsTaken: 0, abandoned: 0, retries: 0, paths: 0 };
      // Ziele, die sich als unerreichbar erwiesen haben (Rasterschluessel).
      // Wird bei jedem Raumwechsel geleert — aber NICHT zwischen zwei
      // play()-Aufrufen: das Gedaechtnis haengt an `h`, nicht am Aufruf.
      //
      // Frueher war es eine lokale Variable. Wer play() in kleinen Haeppchen
      // aufruft (etwa um zwischendurch den Fortschritt zu lesen), setzte damit
      // bei jedem Aufruf das Wissen zurueck und lief dieselbe blockierte Treppe
      // endlos wieder an — beobachtet als Pendeln zwischen zwei Positionen
      // ueber Tausende Runden ohne Fortschritt.
      if (!h._botGedaechtnis) h._botGedaechtnis = { aufgegeben: new Set(), roomId: null };
      const aufgegeben = h._botGedaechtnis.aufgegeben;
      let roomId = h._botGedaechtnis.roomId;
      let verfolgtKey = null; let verfolgtRunden = 0; let besteDistanz = Infinity;
      // Wie lange der Bot schon auf einer Treppe steht, ohne dass der Raum
      // wechselt. Dient dazu, eine nicht funktionierende Treppe aufzugeben.
      let treppeSeit = 0;
      // Weg aus der Wegsuche — nur aktiv, wenn die gerade Linie versagt hat.
      let notweg = null; let notwegIdx = 0; let notwegAlter = 0; let notwegZiel = null;
      // Wirkt der Angriff? HP des aktuellen Ziels und wie lange sie schon
      // nicht mehr faellt.
      let zielHp = null; let zielKeyHp = null; let ohneWirkung = 0;
      const gibAufNach = opts.gibAufNach || 50;
      // Wie weit der Bot fuer eine Truhe vom Weg abweicht. Truhen sind Beiwerk,
      // nicht das Rundenziel — alles Weitere liegt einfach nicht am Weg.
      const chestDetour = typeof opts.chestDetour === "number" ? opts.chestDetour : 200;
      let lastX = null; let lastY = null; let stuckFor = 0; let detourLeft = 0; let detour = null;

      /** Zerstoerbares in Reichweite aufschlagen. Meldet, wie viel fiel. */
      const brich = () => h.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        if (typeof breakDestructiblesInRange !== 'function') return 0;
        return breakDestructiblesInRange(sc, 90) || 0;
      })()`);

      for (let i = 0; i < rounds; i++) {
        stats.rounds++;

        // --- Zustand in EINEM Durchgriff holen (spart vm-Uebergaenge) --------
        const st = h.run(`(function () {
          var p = (typeof player !== 'undefined' && player) ? player : null;
          var eg = (typeof enemies !== 'undefined' && enemies) ? enemies : window.enemies;
          var og = (typeof obstacles !== 'undefined' && obstacles) ? obstacles : window.obstacles;
          // WICHTIG: waehrend eines Raumwechsels sind die Gruppen bereits
          // zerstoert, ihre Referenzen aber noch gesetzt. getChildren() wirft
          // dann in Phaser (Cannot read properties of undefined, reading
          // entries) und riss den ganzen Bot-Lauf ab. Deshalb ueberall
          // zusaetzlich children mitpruefen.
          var lebt = function (grp) { return !!(grp && grp.children && grp.getChildren); };
          var list = lebt(eg) ? eg.getChildren().filter(function (x) { return x && x.active; })
            .map(function (x) { return { x: x.x, y: x.y, hp: x.hp }; }) : [];
          // Truhen/Faesser/Kisten = zerstoerbare Hindernisse mit lootTier
          var chests = [];
          if (lebt(og)) {
            og.getChildren().forEach(function (o) {
              if (!o || !o.active || !o.getData) return;
              var t = String(o.getData('type') || '').toLowerCase();
              if (t.indexOf('chest') === 0 || t.indexOf('barrel') === 0 || t.indexOf('crate') === 0) {
                chests.push({ x: o.x, y: o.y });
              }
            });
          }
          // Treppen: das eigentliche Rundenziel. Ohne sie endet jeder Run im
          // ersten Raum, egal wie gut gekaempft wird.
          var stairs = [];
          var sc = window.game.scene.getScene('GameScene');
          // Waehrend eines Raumwechsels ist die Gruppe bereits zerstoert, die
          // Referenz auf der Szene aber noch gesetzt — getChildren() wirft dann
          // in Phaser. Deshalb children mitpruefen und absichern.
          try {
            if (sc && lebt(sc.stairsGroup)) {
              sc.stairsGroup.getChildren().forEach(function (s) {
                if (s && s.active) stairs.push({ x: s.x, y: s.y });
              });
            }
          } catch (e) { stairs = []; }
          return {
            px: p ? p.x : null, py: p ? p.y : null,
            hp: window.playerHealth, maxHp: window.playerMaxHealth,
            enemies: list, chests: chests, stairs: stairs,
            roomId: (sc && sc.currentRoom) ? String(sc.currentRoom.id) : null,
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

        // --- Raumwechsel bemerken ------------------------------------------
        // Neuer Raum: aufgegebene Ziele wieder freigeben, Verfolgung zuruecksetzen.
        if (st.roomId && st.roomId !== roomId) {
          if (roomId !== null) stats.roomsEntered++;
          roomId = st.roomId;
          h._botGedaechtnis.roomId = roomId;
          notweg = null;
          aufgegeben.clear();
          verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
        }

        // --- Ziel waehlen: Gegner -> Truhe -> TREPPE ------------------------
        // Die Treppe ist das Rundenziel, nicht bloss Beiwerk. Ohne sie bleibt
        // der Bot im ersten Raum stehen, auch wenn er dort alles erschlaegt.
        const zielKey = (o) => Math.round(o.x / 16) + '|' + Math.round(o.y / 16);
        const naechstes = (liste) => {
          let best = null; let bestD = Infinity;
          liste.forEach((o) => {
            if (aufgegeben.has(zielKey(o))) return;
            const d = Math.hypot(o.x - st.px, o.y - st.py);
            if (d < bestD) { bestD = d; best = o; }
          });
          return best ? { obj: best, d: bestD } : null;
        };

        let target = null; let td = Infinity;
        let targetIsChest = false; let targetIsStairs = false;
        const g = naechstes(enemyList);
        if (g) {
          target = g.obj; td = g.d;
        } else {
          // Kein Gegner mehr -> zur TREPPE. Truhen sind KEIN Ziel.
          //
          // Ein Raum enthaelt bis zu 38 zerstoerbare Objekte. Solange sie als
          // Ziel zaehlen, findet der Bot immer noch eine in der Naehe und kommt
          // nie zur Treppe — gemessen mit 200 px Toleranz: nach 600 Runden
          // 23 Truhen zerschlagen, 0 Gegner uebrig, 0 Treppen erreicht.
          // Deshalb: Truhen werden nur noch NEBENBEI aufgeschlagen (unten),
          // wenn sie ohnehin in Schlagreichweite liegen.
          const s = naechstes(Array.from(st.stairs || []));
          if (s) { target = s.obj; td = s.d; targetIsStairs = true; } else {
            const t = naechstes(chestList);
            if (t) { target = t.obj; td = t.d; targetIsChest = true; }
          }
        }

        // Truhen im Vorbeigehen mitnehmen — kostet keinen Umweg, weil nur
        // geschlagen wird, was ohnehin in Reichweite steht.
        if (!targetIsChest && chestList.some(
          (c) => Math.hypot(c.x - st.px, c.y - st.py) <= 85)) {
          stats.chestsBroken += brich();
        }

        // --- Nicht endlos umrunden ------------------------------------------
        // Kommt der Bot einem Ziel ueber laengere Zeit nicht naeher, ist es
        // unerreichbar (hinter einer Wand, in einer Nische). Dann wird es
        // aufgegeben und das naechste angegangen, statt es weiter zu umkreisen.
        if (target) {
          const k = zielKey(target);
          if (k !== verfolgtKey) {
            verfolgtKey = k; verfolgtRunden = 0; besteDistanz = td;
          } else if (td <= attackRange) {
            // In Reichweite = der Bot KAEMPFT bzw. schlaegt auf. Das ist kein
            // Umrunden, also darf hier nichts aufgegeben werden. Ohne diese
            // Ausnahme gab der Bot ausgerechnet den Gegner auf, den er gerade
            // erschlug — die Kills fielen dadurch von 29 auf 18.
            verfolgtRunden = 0; besteDistanz = Math.min(besteDistanz, td);
          } else {
            verfolgtRunden++;
            if (td < besteDistanz - 8) { besteDistanz = td; verfolgtRunden = 0; }
            if (verfolgtRunden > gibAufNach) {
              aufgegeben.add(k);
              stats.abandoned++;
              verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
              h.input.releaseAll();
              h.step(framesPerRound); await flush();
              continue;
            }
          }
        }

        if (!target) {
          // Kein Ziel mehr — fast immer, weil der Bot ALLES aufgegeben hat.
          //
          // Die Aufgeben-Liste wird sonst nur bei einem Raumwechsel geleert.
          // Kommt der aber nie zustande, streicht sich der Bot nacheinander
          // Gegner UND Treppen weg und steht danach endgueltig still: gemessen
          // dreimal in Folge exakt dasselbe Muster — Aufgaben haeufen sich
          // (3, 4, 6), dann faellt der Zaehler auf 0 und die Position aendert
          // sich ueber Tausende Runden nicht mehr, obwohl Treppen im Raum
          // liegen. Die Logik gegen das Umrunden erzeugte so ihre eigene
          // Sackgasse.
          //
          // Also: Liste leeren und neu ansetzen. Vorher ein Stueck umsetzen —
          // vom selben Fleck aus scheitert der zweite Anlauf genauso wie der
          // erste.
          if (aufgegeben.size > 0) {
            aufgegeben.clear();
            stats.retries++;
            verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
            const dirs = [{ left: true }, { right: true }, { up: true }, { down: true },
              { left: true, up: true }, { right: true, down: true },
              { left: true, down: true }, { right: true, up: true }];
            detour = dirs[Math.floor(Math.random() * dirs.length)];
            detourLeft = 25;
            h.input.hold(detour);
          } else {
            h.input.releaseAll();
          }
          h.step(framesPerRound); await flush(); continue;
        }

        // --- Feststeck-Erkennung -------------------------------------------
        if (lastX !== null) {
          stuckFor = Math.hypot(st.px - lastX, st.py - lastY) < 2 ? stuckFor + 1 : 0;
        }
        lastX = st.px; lastY = st.py;

        // Muss VOR dem Angriffs-Zweig stehen und dessen Reichweite abdecken:
        // eine Treppe wird betreten, nicht erschlagen. Mit einer Schwelle von
        // 44 px bei attackRange 60 landete der Bot im Angriffs-Zweig und
        // preschte 600 Runden lang auf die Treppe ein, statt hineinzugehen
        // (gemessen: Position unveraendert, Geschwindigkeit 0).
        if (targetIsStairs) {
          // NICHT stehenbleiben und nur [E] druecken: der Raumwechsel haengt am
          // Overlap-Ausloeser (roomManager onStairOverlap), also muss der Bot
          // WEITER in die Treppe hineinlaufen. Eine fruehere Fassung hielt hier
          // an und drueckte [E] — in vier von fuenf Laeufen stand der Bot
          // danach 1300 Runden regungslos auf der Treppe.
          // Wegsuche NUR hier: die Treppe steht still. Isoliert gemessen
          // erreicht Weg + Freischlagen sie in 5 von 5 Faellen mit 0-1
          // Planungen. Auf einen wandernden Gegner geplant, zerfaellt der Weg
          // dagegen staendig (ueber 400 Planungen je Lauf) und macht den Bot
          // schlechter als geradeaus — deshalb dort bewusst keine Wegsuche.
          if (stuckFor >= 4) {
            stats.chestsBroken += brich();
            const w = h.nav.path(target.x, target.y);
            if (w && w.length) { notweg = w; notwegIdx = 0; stats.paths++; }
            stuckFor = 0;
          }

          if (notweg && notwegIdx < notweg.length && td > 70) {
            while (notwegIdx < notweg.length - 1
                   && Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) <= 18) {
              notwegIdx++;
            }
            const wp = notweg[notwegIdx];
            // Der Weg fuehrt bewusst DURCH Zerstoerbares — dort aufschlagen.
            if (wp.brechen && Math.hypot(st.px - wp.x, st.py - wp.y) < 80) {
              stats.chestsBroken += brich();
            }
            h.input.steerTowards(wp.x, wp.y, 4);
          } else {
            h.input.steerTowards(target.x, target.y, 2);
          }

          if (td <= 70) { h.input.interact(); notweg = null; }
          treppeSeit = (td <= 70) ? treppeSeit + 1 : 0;
          if (treppeSeit === 1) stats.stairsTaken++;
          // Tut sich nichts, ist diese Treppe nicht die richtige (oder noch
          // verschlossen) — aufgeben und die naechste nehmen. Es liegen in der
          // Regel mehrere im Raum.
          if (treppeSeit > 45) {
            aufgegeben.add(zielKey(target));
            stats.abandoned++;
            treppeSeit = 0;
            verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
          }
          h.step(framesPerRound); await flush();
          continue;
        }
        if (!targetIsStairs) treppeSeit = 0;

        if (td <= attackRange) {
          detourLeft = 0;
          if (targetIsChest) {
            h.input.releaseAll();
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
            // WEITER auf den Gegner zusteuern statt anzuhalten.
            //
            // Der Nahkampf trifft nur in einem 60-Grad-Kegel in BLICKRICHTUNG
            // (player.js:1866, dot <= 0.5 verwirft den Treffer), und die
            // Blickrichtung ist die letzte BEWEGUNGSrichtung. Wer bei Reichweite
            // anhaelt, friert sie ein: steht der Gegner ausserhalb des Kegels,
            // geht jeder Schlag daneben — und weil der Bot "in Reichweite" ist,
            // bewegt er sich nie wieder. Gemessen: 7200 Runden regungslos auf
            // demselben Pixel, 56 px neben einem lebenden Gegner.
            //
            // Weiterlaufen haelt die Blickrichtung am Ziel; die Kollision
            // verhindert, dass er hindurchlaeuft.
            h.input.steerTowards(target.x, target.y, 4);
            h.input.attack();

            // Sicherung nach dem Grundsatz "nimmt er keinen Schaden, muss man
            // naeher ran": faellt die HP des Ziels ueber viele Runden nicht,
            // zaehlt das NICHT als Kampf — dann darf die Aufgeben-Logik greifen
            // und der Bot sucht sich ein anderes Ziel.
            if (typeof target.hp === 'number') {
              const kHp = zielKey(target);
              if (zielHp === null || zielKeyHp !== kHp) {
                zielHp = target.hp; zielKeyHp = kHp; ohneWirkung = 0;
              } else if (target.hp < zielHp) {
                zielHp = target.hp; ohneWirkung = 0;
              } else {
                ohneWirkung++;
                if (ohneWirkung > 30) {
                  aufgegeben.add(kHp);
                  stats.abandoned++;
                  ohneWirkung = 0; zielHp = null; zielKeyHp = null;
                  verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
                }
              }
            }

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
        } else {
          // Liegt ein Weg an, diesem folgen — sonst gerade Linie.
          if (notweg && notwegIdx < notweg.length) {
            while (notwegIdx < notweg.length - 1
                   && Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) <= 18) {
              notwegIdx++;
            }
            const wp = notweg[notwegIdx];
            // Der Weg fuehrt bewusst DURCH zerstoerbare Hindernisse (Fass,
            // Kiste, kleine Saeule) — dort aufschlagen statt davorstehen.
            if (wp.brechen && Math.hypot(st.px - wp.x, st.py - wp.y) < 80) {
              stats.chestsBroken += brich();
            }
            h.input.steerTowards(wp.x, wp.y, 4);
            notwegAlter++;
            // Der Weg gehoert zu SEINEM Ziel. Verworfen wird er nur, wenn das
            // Ziel weit weggewandert ist (Gegner bewegen sich) oder er zu alt
            // wird — nicht bei jedem Feststecken.
            const zielWeg = notwegZiel
              ? Math.hypot(target.x - notwegZiel.x, target.y - notwegZiel.y) : 0;
            if (notwegAlter > 400 || zielWeg > 140) notweg = null;
          } else {
            h.input.steerTowards(target.x, target.y);
          }

          // Festgefahren: ERST freischlagen, dann erst ausweichen.
          //
          // Das ist der wirksamste Hebel am ganzen Bot. Wer sofort ausweicht,
          // umrundet endlos das Fass, das ihm im Weg steht; wer zuschlaegt,
          // raeumt es weg und geht geradeaus weiter. Gemessen ueber je acht
          // Laeufe a 400 Runden auf Tiefe 1:
          //   vorher (nur ausweichen) : 17/33 Gegner,  10 Truhen, --
          //   nachher (erst schlagen) : 35/36 Gegner,  91 Truhen, 7/8 Raeume leer
          //
          // Die Wegsuche (nav.js) steht bewusst NUR hier unten als Notnagel:
          // als Ersatz fuer die gerade Linie wurde sie dreimal gemessen und
          // war jedes Mal schlechter. Im offenen Raum gewinnt geradeaus.
          if (stuckFor >= 4) {
            const fiel = brich();
            stuckFor = 0;
            // Weg NEU PLANEN statt verwerfen. Isoliert gemessen (ohne Gegner)
            // erreicht Weg + Freischlagen die Treppe in 5 von 5 Faellen mit
            // 0-1 Neuplanungen. Im Bot waren es 103 pro Lauf — weil hier bei
            // jedem Feststecken der Weg weggeworfen wurde und beim naechsten
            // HIER bewusst KEINE Wegsuche. Ziele in diesem Zweig sind Gegner
            // und Truhen; auf ein wanderndes Ziel geplant zerfaellt der Weg
            // staendig (ueber 400 Planungen je Lauf gemessen) und der Bot wird
            // dadurch schlechter als geradeaus. Die Wegsuche steht nur im
            // Treppen-Zweig, wo das Ziel stillsteht.
            if (fiel) stats.chestsBroken += fiel;
            if (!fiel) {
              const dirs = [{ left: true }, { right: true }, { up: true }, { down: true },
                { left: true, up: true }, { right: true, down: true },
                { left: true, down: true }, { right: true, up: true }];
              detour = dirs[Math.floor(Math.random() * dirs.length)];
              detourLeft = 8;
              h.input.hold(detour);
            }
          }
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
  attachNav(h);   // Wegsuche als Notnagel (h.nav) — siehe nav.js
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
