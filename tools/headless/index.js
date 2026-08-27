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
      // Letzten Tastenstand merken. play() ruft am Ende releaseAll(), also
      // misst jede Aufnahme NACH einem Block zwangslaeufig "keine Taste
      // gedrueckt, Geschwindigkeit 0". Genau daraus hatte ich faelschlich
      // geschlossen, der Bot stehe still — der Wert konnte gar nichts anderes
      // zeigen. Deshalb hier den letzten ECHTEN Stand festhalten.
      h._letzteTasten = { left: !!d.left, right: !!d.right, up: !!d.up, down: !!d.down };
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
    releaseAll() {
      const gemerkt = h._letzteTasten;   // Aufraeumen faelscht die Messung nicht
      h.input.hold({});
      h._letzteTasten = gemerkt;
      // Auch die Aktionstaste loslassen — sonst bleibt sie gedrueckt und
      // main.js verriegelt jede weitere Tuerbetaetigung (s. interact()).
      try { h.run('window.__MOBILE_INTERACT_ACTIVE__ = false;'); } catch (e) { /* egal */ }
    },

    /** Bewegt sich Richtung Zielpunkt, indem die passenden Tasten gehalten werden. */
    steerTowards(x, y, deadzone) {
      const dz = typeof deadzone === 'number' ? deadzone : 12;
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
      // Ein Tastendruck ist ein IMPULS, kein Dauerzustand. Vorher wurde die
      // Flagge nur gesetzt und nie geloescht — main.js:1929 verriegelt daraufhin
      // fuer immer:
      //     if (AKTIV && !verbraucht) { tryInteractDoor(); verbraucht = true; }
      //     if (!AKTIV)              { verbraucht = false; }
      // Die Flagge wurde schon im Hub gesetzt (Rathaus betreten) und blieb
      // stehen, also gab es GENAU EINE Tuerbetaetigung pro Lauf, irgendwo
      // zufaellig verbraucht. Danach lief der Bot gegen jede geschlossene Tuer
      // und drueckte tausendfach ins Leere — gemessen in 3 von 4 Versuchen,
      // einmal 164 px vor der offenen Treppe.
      // Deshalb: Verriegelung mitloesen, dann druecken. Losgelassen wird in
      // releaseAll(), das der Bot ohnehin jede Runde aufruft.
      try {
        h.run('window.__doorInteractConsumed = false; window.__MOBILE_INTERACT_ACTIVE__ = true;');
        ok = true;
      } catch (e) { /* egal */ }
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
  /**
   * Erlegte Gegner — LAUFEND, ueber Runs hinweg.
   *
   * `window.runStats` wird beim Verlassen des Dungeons auf null gesetzt
   * (main.js:2025). Wer einfach den Zaehler liest, sieht danach wieder 0 —
   * und wer Differenzen bildet, bekommt einen NEGATIVEN Wert, der die zuvor
   * gezaehlten Kills wieder auffrisst. Genau daran lag es, dass abgeschlossene
   * Runs im Protokoll mit "0 Kills" standen, obwohl der Bot den Mini-Boss
   * erschlagen haben muss: jeder Run endet mit einem Klimax-Gegner, der die
   * Treppe sperrt (wave.js:122).
   *
   * Deshalb wird ein Nullstellen erkannt und der bisherige Stand aufaddiert.
   */
  h.kills = function kills() {
    const cur = h.run('(window.runStats && window.runStats.enemiesKilled) || 0') || 0;
    if (!h._killStand) h._killStand = { summe: 0, zuletzt: 0 };
    const s = h._killStand;
    if (cur < s.zuletzt) s.summe += s.zuletzt;   // runStats wurde genullt
    s.zuletzt = cur;
    return s.summe + cur;
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
        roomsEntered: 0, stairsTaken: 0, abandoned: 0, retries: 0, paths: 0, tueren: 0,
        bossGesehen: null, bossTot: null };
      // Ziele, die sich als unerreichbar erwiesen haben (Rasterschluessel).
      // Wird bei jedem Raumwechsel geleert — aber NICHT zwischen zwei
      // play()-Aufrufen: das Gedaechtnis haengt an `h`, nicht am Aufruf.
      //
      // Frueher war es eine lokale Variable. Wer play() in kleinen Haeppchen
      // aufruft (etwa um zwischendurch den Fortschritt zu lesen), setzte damit
      // bei jedem Aufruf das Wissen zurueck und lief dieselbe blockierte Treppe
      // endlos wieder an — beobachtet als Pendeln zwischen zwei Positionen
      // ueber Tausende Runden ohne Fortschritt.
      // ---- Gedaechtnis ueber play()-Aufrufe hinweg ------------------------
      //
      // ALLES, was den Raum ueberdauern muss, haengt an `h` — nicht am Aufruf.
      // Wer play() in Haeppchen ruft (naheliegend, um zwischendurch den
      // Fortschritt zu lesen), setzte sonst bei jedem Aufruf zurueck: den Weg
      // zur Treppe, die aufgegebenen Ziele, den Verfolgungsstand. Gemessen
      // wurde der Unterschied deutlich — 12x400 Runden kamen auf 13
      // Raumwechsel, 1x4800 Runden auf 19. Derselbe Fehler ist mir hier
      // zweimal unterlaufen (erst beim Aufgeben-Set, dann beim Weg); deshalb
      // steht der Zustand jetzt geschlossen an EINER Stelle.
      if (!h._botGedaechtnis) {
        h._botGedaechtnis = {
          aufgegeben: new Set(), roomId: null,
          notweg: null, notwegIdx: 0,
          verfolgtKey: null, verfolgtRunden: 0, besteDistanz: Infinity, besterWegpunkt: 0, planFehler: 0,
          treppeSeit: 0, zielHp: null, zielKeyHp: null, ohneWirkung: 0, zweig: null,
        };
      }
      const G = h._botGedaechtnis;
      const aufgegeben = G.aufgegeben;
      let roomId = G.roomId;
      let verfolgtKey = G.verfolgtKey; let verfolgtRunden = G.verfolgtRunden;
      let besteDistanz = G.besteDistanz;
      // Weitester bereits erreichter Wegpunkt des aktuellen Weges — misst
      // Fortschritt ENTLANG des Weges statt in der Luftlinie.
      let besterWegpunkt = G.besterWegpunkt || 0;
      let planFehler = G.planFehler || 0;
      // Wie lange der Bot schon auf einer Treppe steht, ohne dass der Raum
      // wechselt. Dient dazu, eine nicht funktionierende Treppe aufzugeben.
      let treppeSeit = G.treppeSeit;
      // Weg aus der Wegsuche — nur aktiv, wenn die gerade Linie versagt hat.
      // Der geplante Weg haengt an `h`, NICHT am Aufruf. Als lokale Variable
      // ging er bei jedem play()-Aufruf verloren: wer in Haeppchen spielt —
      // naheliegend, um zwischendurch den Fortschritt zu lesen — verlor damit
      // staendig den Weg zur Treppe und kam nie aus dem Raum. Genau derselbe
      // Fehler wie zuvor beim Aufgeben-Gedaechtnis.
      let notweg = G.notweg;
      let notwegIdx = G.notwegIdx || 0;
      let notwegAlter = 0; let notwegZiel = null;
      // Naehert sich der Bot dem AKTUELLEN Wegpunkt ueberhaupt? Ohne diese
      // Buchfuehrung war "unerreichbar" nicht von "gleich da" zu unterscheiden.
      // Wie lange schlaegt der Bot schon auf einen Blockierer ein, ohne
      // freizukommen? Ohne Deckel frisst dieser Zweig jede Runde auf.
      // Wie lange drueckt der Bot schon gegen eine WAND (kein Gegner)?
      let wandRunden = G.wandRunden || 0;
      let schlagRunden = G.schlagRunden || 0;
      let schlagPause = G.schlagPause || 0;
      let wpBest = (typeof G.wpBest === 'number') ? G.wpBest : null;
      let wpZaeh = G.wpZaeh || 0;
      // Wirkt der Angriff? HP des aktuellen Ziels und wie lange sie schon
      // nicht mehr faellt.
      let zielHp = G.zielHp; let zielKeyHp = G.zielKeyHp; let ohneWirkung = G.ohneWirkung;
      const gibAufNach = opts.gibAufNach || 50;
      // Wie weit der Bot fuer eine Truhe vom Weg abweicht. Truhen sind Beiwerk,
      // nicht das Rundenziel — alles Weitere liegt einfach nicht am Weg.
      const chestDetour = typeof opts.chestDetour === "number" ? opts.chestDetour : 200;
      let lastX = null; let lastY = null; let stuckFor = 0; let detourLeft = 0; let detour = null;
      const fenster = [];   // letzte Positionen, fuer die Nettostrecke
      let planSperre = 0;   // Runden, bevor erneut umgeplant werden darf
      let rueckzugLeft = 0;   // Runden, die der Bot noch rueckwaerts geht
      let spionageWeg = null; let spionageIdx = 0;   // Weg zur Beobachtungszone

      // FLUGSCHREIBER. Eine Momentaufnahme NACH play() kann nicht zeigen,
      // woran der Bot haengt: play() endet mit releaseAll(), also sind
      // Tastenstand und Geschwindigkeit dort zwangslaeufig leer. Genau daran
      // bin ich zweimal hereingefallen ("er drueckt keine Taste", "er drueckt
      // und bewegt sich nicht") — beides waren Artefakte der Messung.
      //
      // Deshalb JEDE Runde mitschreiben, waehrend es passiert. Der Puffer
      // haelt die letzten 40 Runden; h.flugschreiber() liest sie aus.
      const schreiber = h._flug || (h._flug = []);
      let beruehrer = null;   // was den Bot beim Feststecken beruehrt
      // Stabiler Schluessel fuer ein Ziel (16-px-Raster). MUSS hier oben
      // stehen: freimachen() weiter unten benutzt ihn, und eine Deklaration
      // in der Rundenschleife war fuer diese Funktion unsichtbar
      // ("zielKey is not defined", drei Versuche in Folge abgebrochen).
      const zielKey = (o) => Math.round(o.x / 16) + '|' + Math.round(o.y / 16);
      let blockerKey = null;   // Gegner, der uns gerade physisch festhaelt
      let blockerRunden = 0;   // wie lange er noch Vorrang als Ziel hat

      /** Zerstoerbares in Reichweite aufschlagen. Meldet, wie viel fiel. */
      const brich = () => h.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        if (typeof breakDestructiblesInRange !== 'function') return 0;
        return breakDestructiblesInRange(sc, 90) || 0;
      })()`);

      /**
       * Festgefahren -> aufraeumen, was VOR einem steht. Drei Moeglichkeiten,
       * alle billig, deshalb einfach alle drei:
       *
       *   Tuer  — [E] oeffnet sie. Vorher wurde nur gedrueckt, wenn der
       *           aktuelle WEGPUNKT eine Tuer war; liegt sie zwischen zwei
       *           Wegpunkten, lief der Bot dagegen. Gemessen: 500 Runden auf
       *           demselben Pixel gegen proc_door_closed_192x24.
       *   Gegner— schubst physisch (main.js:2875 Kollider), ist aber ausserhalb
       *           von 60 px kein Angriffsziel. Gemessen: haengengeblieben mit
       *           einem Gegner auf 73 px, ohne dass ihn etwas beruehrte.
       *           Deshalb hier bis 110 px zuschlagen — mit Blick auf ihn, sonst
       *           verfehlt der 60-Grad-Kegel (player.js:1866).
       *   Prop  — zerschlagen.
       */
      /**
       * Steht eine GESCHLOSSENE Tuer in Betaetigungsreichweite?
       * DoorSystem.tryInteractDoor SCHALTET UM (doorSystem.js:256) — wer an
       * einer offenen Tuer weiterdrueckt, macht sie wieder zu. Deshalb wird
       * nie blind gedrueckt, sondern nur bei tatsaechlich geschlossener Tuer.
       * 100 px = INTERACT_DIST (doorSystem.js:250).
       */
      const tuerZuNah = () => h.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        if (!sc || typeof player === 'undefined' || !player) return false;
        var liste = sc._doors || [];
        for (var i = 0; i < liste.length; i++) {
          var t = liste[i];
          if (!t || !t.active) continue;
          if (t.getData && t.getData('doorState') !== 'closed') continue;
          var dx = t.x - player.x, dy = t.y - player.y;
          if (dx * dx + dy * dy < 100 * 100) return true;
        }
        return false;
      })()`);

      const freimachen = (naheGegner) => {
        if (tuerZuNah()) h.input.interact();
        const g = (naheGegner || [])[0];
        if (g) {
          h.input.steerTowards(g.x, g.y, 4);
          h.input.attack();
          // Merken: der naechste Zug gehoert ihm. Ein Einzelschlag aus alter
          // Blickrichtung verfehlt, ein paar Runden Verfolgung nicht.
          blockerKey = zielKey(g);
          blockerRunden = 40;
        }
        return brich();
      };

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
                // Der locked-Merker entscheidet ueber die ganze Strategie:
                // normale Raeume lassen die Treppe OFFEN (roomManager.js:1326,
                // "player can leave room even with enemies alive"), nur
                // Spezialraeume (defend/hunt) sperren sie bis zum Ziel.
                if (s && s.active) {
                  stairs.push({ x: s.x, y: s.y,
                    locked: !!(s.getData && s.getData('locked')) });
                }
              });
            }
          } catch (e) { stairs = []; }
          // Der Klimax-Gegner haelt die Treppe zu, bis er faellt.
          var kl = window.__climaxEnemy;
          var klimax = (kl && kl.active) ? { x: kl.x, y: kl.y, hp: kl.hp } : null;
          return {
            klimax: klimax,
            px: p ? p.x : null, py: p ? p.y : null,
            // Geschwindigkeit gehoert in den Rundenzustand, nicht in eine
            // Aufnahme danach: play() endet mit releaseAll(), dort ist sie
            // immer 0. Hier ist sie echt.
            vx: (p && p.body) ? p.body.velocity.x : null,
            vy: (p && p.body) ? p.body.velocity.y : null,
            // WARUM keine Geschwindigkeit? Der Flugschreiber zeigt Tasten
            // gehalten, Position eingefroren, v=0 — waehrend der Runde
            // gemessen, also echt. handlePlayerMovement setzt die
            // Geschwindigkeit also nicht. Diese Sperren kommen dafuer in
            // Frage; sie werden hier mitgelesen statt geraten.
            sperren: [
              (typeof playerStunned !== "undefined" && playerStunned) ? "stunned" : null,
              (typeof isRolling !== "undefined" && isRolling) ? "rolling" : null,
              (typeof isDashing !== "undefined" && isDashing) ? "dashing" : null,
              (typeof isChargingSlash !== "undefined" && isChargingSlash) ? "charging" : null,
              (typeof isReturningToHub !== "undefined" && isReturningToHub) ? "zurueckZumHub" : null,
              (window.statusEffectManager && window.statusEffectManager.isStunned
                && window.statusEffectManager.isStunned(p)) ? "statusStun" : null,
              (p && p.body && p.body.moves === false) ? "bodyMovesFalse" : null,
              (p && p.active === false) ? "inaktiv" : null
            ].filter(Boolean).join("+") || null,
            // Liest der Spielcode ueberhaupt die Tasten, die wir setzen?
            // Phasers Kollisionsflaggen PRO RUNDE. blocked wird jeden
            // Physikschritt neu gesetzt; wer sie nach releaseAll() liest,
            // sieht immer "keiner" — genau das hat mich zweimal in die Irre
            // gefuehrt. Sie sagen als Einzige, ob ihn etwas aufhaelt, das die
            // Navigationskarte nicht kennt (so lag es beim defend-Altar).
            // Die verbleibenden Kandidaten fuer "Tasten gedrueckt, kein
            // Anschlag, keine Sperre, trotzdem v=0":
            //  * _pullUntil — handlePlayerMovement kehrt still zurueck,
            //    solange es laeuft (player.js:1383). Gesetzt von Ketten-Zuegen
            //    (enemy.js:2911/3347) gegen Date.now(), also ECHTZEIT.
            //  * isMobile — dann laeuft handleMobileMovement und liest den
            //    Joystick statt cursors; der Bot setzt aber cursors.
            //  * playerSpeed — waere er 0, bliebe die Zielgeschwindigkeit 0.
            zug: (window._pullUntil && Date.now() < window._pullUntil)
              ? (window._pullUntil - Date.now()) : null,
            // DER Pruefstein fuer Stillstand-Art B (v=0, nichts blockiert,
            // nichts beruehrt): handlePlayerMovement holt die Richtung NICHT
            // aus cursors, sondern aus InputScheme.getMovementInput(), das
            // eigene Tastenobjekte liest (inputScheme.js:56 kb.addKey). Und
            // init(scene) wird von ZWEI Szenen gerufen — Hub und Dungeon.
            // Liefert es {0,0}, waehrend cursors gedrueckt sind, sind die
            // Primitive an die falsche Szene gebunden. Ohne Fehlermeldung.
            // LAEUFT die Szene ueberhaupt? Die Bewegungskette ist zu Ende
            // gelesen: setVelocity wird bedingungslos aufgerufen, die Eingabe
            // ist nachweislich ungleich null, keine Sperre, kein Anschlag —
            // rechnerisch KANN v nicht 0 sein. Also stimmt die Annahme nicht,
            // dass update() in diesen Runden laeuft. Die Szenenuhr beweist es:
            // steht sie still, wird die Szene nicht getaktet.
            // scene.time.now taugt NICHT als Taktnachweis: im Normalbetrieb
            // steht sie ebenfalls konstant bei 67, waehrend sich der Spieler
            // bewegt. Statt ihrer die Loop-Zeit, die nachweislich laeuft.
            loopZeit: (window.game && window.game.loop) ? Math.round(window.game.loop.time) : null,
            // Zeigt window.player noch auf das AKTUELLE Sprite? Ein veraltetes
            // waere genau das gemessene Bild: Position eingefroren,
            // Geschwindigkeit 0, nichts beruehrt es, keine Sperre — waehrend
            // die Szene normal weiterlaeuft.
            spielerGeist: (function () {
              if (!p) return "kein player";
              var inListe = !!(sc && sc.children && sc.children.list.indexOf(p) >= 0);
              var szeneOk = !!(p.scene && sc && p.scene === sc);
              if (inListe && szeneOk) return null;
              return (inListe ? "" : "nichtInAnzeigeliste ") + (szeneOk ? "" : "fremdeSzene");
            })(),
            szeneAktiv: (sc && sc.sys && sc.sys.isActive) ? !!sc.sys.isActive() : null,
            szenePausiert: (sc && sc.sys && sc.sys.isPaused) ? !!sc.sys.isPaused() : null,
            eingabe: (window.InputScheme && window.InputScheme.getMovementInput)
              ? (function () { var m = window.InputScheme.getMovementInput();
                  return m.x + "," + m.y; })()
              : null,
            mobil: (typeof isMobile !== "undefined") ? !!isMobile : null,
            tempo: (typeof playerSpeed === "number") ? Math.round(playerSpeed) : null,
            // DIE DREI AUSSTIEGE am Anfang von update() (main.js:1680-1700).
            // Laeuft einer davon, wird handlePlayerMovement NIE gerufen — von
            // aussen ununterscheidbar von "Bewegung kaputt": keine
            // Geschwindigkeit, keine Kollision, keine Sperrflagge, aber
            // tickende Szene. Genau dieses Profil hat mich neun Kandidaten
            // lang in die Irre gefuehrt.
            //
            // Zwei Reproduktionsversuche im kontrollierten Aufbau sind
            // gescheitert (frisches Spiel und echter Stand auf Tiefe 10, beide
            // ohne Stillstand). Deshalb steht die Messung jetzt im laufenden
            // Betrieb, wo der Fehler nachweislich auftritt.
            ausstieg: [
              (typeof invOpen !== "undefined" && invOpen) ? "invOpen" : null,
              (window.__GAME_PAUSE && window.__GAME_PAUSE.since != null) ? "pause" : null,
              (typeof playerDeathHandled !== "undefined" && playerDeathHandled) ? "todGehandhabt" : null,
              (typeof isReturningToHub !== "undefined" && isReturningToHub) ? "zurueckZumHub" : null
            ].filter(Boolean).join("+") || null,
            // Ohne Zeitfortschritt bewegt die Physik nichts, egal wie hoch die
            // Geschwindigkeit ist. In der Sonde fiel delta beim Einzelschritt
            // auf 0 — im Dauerlauf bisher ungemessen.
            delta: (sc && sc.game && sc.game.loop) ? Math.round(sc.game.loop.delta) : null,
            anschlag: (p && p.body && p.body.blocked)
              ? (["left","right","up","down"].filter(function (k) {
                  return p.body.blocked[k]; }).join("+") || null)
              : null,
            beruehrt: (p && p.body && p.body.touching)
              ? (["left","right","up","down"].filter(function (k) {
                  return p.body.touching[k]; }).join("+") || null)
              : null,
            cursorsDown: (typeof cursors !== "undefined" && cursors)
              ? ["left","right","up","down"].filter(function (k) {
                  return cursors[k] && cursors[k].isDown; }).join("+") || "-"
              : "kein cursors",
            hp: window.playerHealth, maxHp: window.playerMaxHealth,
            // SPIONAGE-Beobachtungszonen. Sie sind der einzige Weg, die
            // Quest-Kette zum Kettenmeister zu oeffnen: espionage_convoy
            // verlangt das Ziel convoy_intel, das NUR feuert, wenn der Spieler
            // eine bestimmte Zeit lang in einer Zone steht (espionageSystem.js:466).
            // Ohne diese Zonen bleibt maxDepth bei 9 stehen — das Gate in
            // runDepth.js:22 haengt daran. Treppen, Gegner und Truhen reichen
            // dafuer nicht; sie sind bisher die einzigen Zielarten des Bots.
            spionage: (function () {
              var E = window.EspionageSystem;
              if (!E || typeof E.isActive !== "function" || !E.isActive()) return null;
              var s2 = (typeof E.getState === "function") ? E.getState() : null;
              if (!s2) return null;
              return {
                enttarnt: !!s2.exposed,
                zonen: (s2.observeZones || []).filter(function (zz) { return zz && !zz._done; })
                  .map(function (zz) {
                    return { x: zz.x, y: zz.y, r: zz.r || 60,
                             sek: zz.seconds || 0, bisher: zz._elapsed || 0,
                             ziel: zz.questTarget || null };
                  })
              };
            })(),
            // BOSS. Am Kettenmeister-Tor (Tiefe 10) liess sich nachtraeglich
            // nicht mehr feststellen, ob der Bot dem Boss ueberhaupt begegnet
            // ist: das Laufprotokoll kannte weder Boss-Raum noch Boss-Tod, und
            // der Quest-Zaehler mara_warning stand auf 0. Ohne diese Zeilen
            // bleibt beides Ratesache.
            boss: (function () {
              if (!lebt(eg)) return null;
              var b = eg.getChildren()
                .filter(function (x) { return x && x.active && x.bossType; })
                .map(function (x) {
                  return { typ: String(x.bossType), x: Math.round(x.x), y: Math.round(x.y),
                           hp: Math.round(x.hp || 0), maxHp: Math.round(x.maxHp || 0) };
                });
              return b.length ? b : null;
            })(),
            // WER blockiert? "anschlag" sagt nur, DASS etwas blockiert.
            // Gemessen: 18 von 19 Stillstaenden hingen an einer obstacleWall,
            // waehrend der Bot auf einen zufaellig nahen Gegner einschlug —
            // die Bedingung lautete "Gegner in 70 px", nicht "Gegner
            // blockiert mich". Deshalb hier der echte Ueberlappungstest eine
            // Schrittweite in die blockierte Richtung.
            blockierer: (function () {
              if (!p || !p.body) return null;
              var b = p.body;
              var sx = b.blocked.left ? -8 : (b.blocked.right ? 8 : 0);
              var sy = b.blocked.up ? -8 : (b.blocked.down ? 8 : 0);
              if (!sx && !sy) return null;
              var w = sc && sc.physics && sc.physics.world;
              if (!w) return null;
              var gl = lebt(eg) ? eg.getChildren() : [];
              var gegner = false, name = null;
              [w.bodies, w.staticBodies].forEach(function (menge) {
                if (!menge || !menge.entries) return;
                menge.entries.forEach(function (o) {
                  if (!o || o === b || !o.gameObject) return;
                  var rx = b.x + sx, ry = b.y + sy;
                  if (rx < o.right && rx + b.width > o.left
                      && ry < o.bottom && ry + b.height > o.top) {
                    if (gl.indexOf(o.gameObject) >= 0) gegner = true;
                    else if (!name) {
                      name = (o.gameObject.getData && o.gameObject.getData("type"))
                        || (o.gameObject.texture && o.gameObject.texture.key) || "?";
                    }
                  }
                });
              });
              return { gegner: gegner, name: name };
            })(),
            enemies: list, chests: chests, stairs: stairs,
            roomId: (sc && sc.currentRoom) ? String(sc.currentRoom.id) : null,
          };
        })()`);

        if (!st || st.px === null) { stats.deaths++; break; }
        const enemyList = Array.from(st.enemies || []);

        // --- BLOCKADE LOESEN: pausiert wartende Dialoge beantworten ------
        // Mehrere Stellen pausieren das Spiel und warten auf eine Eingabe:
        //   eventSystem.js:1480  Ereignis-Auswahl (window.eventChoiceOpen)
        //   eventSystem.js:1290  Ereignis-Dialog
        //   abilitySystem.js:574 Lernhinweis (loest sich nach 15 s selbst)
        //   inventory.js:1300    Inventar
        // Der Bot beantwortete keinen davon. Folge: pauseGameClock haelt die
        // Physik an, waehrend Eingabe, Schleife und Szene normal weiterlaufen —
        // der lange ungeklaerte Stillstand "Art B". Gemessen:
        //     weltPausiert true | blockiert false/false/false/false
        //     v 0,-170 | pos unveraendert | delta 13
        // und im Mitschnitt EIN PAUSE-Eintrag ohne passendes RESUME:
        //     PAUSE pauseGameClock (main.js:862) <- showEventChoiceDialog
        //
        // Bewusst NICHT je Dialogart nachgeruestet: nach dem Ereignis-Dialog
        // stand sofort der naechste Pausierer im Weg. Der Loeser fragt deshalb
        // den ZUSTAND ab (pausiert?) statt die Art, und probiert der Reihe
        // nach das, was ein Spieler taete: Knopf druecken, sonst Leertaste,
        // sonst Escape.
        if (h.run('!!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)')) {
          const geloest = h.run(`(function () {
            var s = window.game.scene.getScene("GameScene");
            if (!s || !s.children) return "keine Szene";
            var knoepfe = s.children.list.filter(function (o) {
              return o && o.input && o.input.enabled && o.visible
                && (o.type === "Rectangle" || o.type === "Text" || o.type === "Container");
            }).sort(function (a2, b2) { return (b2.depth || 0) - (a2.depth || 0) || a2.y - b2.y; });
            if (knoepfe.length) {
              knoepfe[0].emit("pointerdown");
              if (!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)) return "Knopf";
            }
            if (s.input && s.input.keyboard && s.input.keyboard.emit) {
              ["keydown-SPACE", "keydown-ENTER", "keydown-ESC"].forEach(function (ev) {
                s.input.keyboard.emit(ev, { preventDefault: function () {} });
              });
              s.input.keyboard.emit("keydown", { code: "Space", preventDefault: function () {} });
              if (!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)) return "Taste";
            }
            return "haelt an (" + knoepfe.length + " Knoepfe)";
          })()`);
          stats.blockaden = (stats.blockaden || 0) + 1;
          G.zweig = "Blockade: " + geloest;
          continue;
        }

        // --- BLOCKIERT? Dann steht meist ein GEGNER im Weg ----------------
        // body.blocked ist das direkte Signal. Der positionsbasierte Zaehler
        // ist es nicht: gemessen pendelte er 3,4,1,2 und erreichte die
        // Schwelle stuckFor >= 4 kaum, waehrend der Bot minutenlang gegen eine
        // Gegnergruppe drueckte.
        //
        // Gemessen im eingefrorenen Zustand, ein Schritt (-6 px) in
        // Laufrichtung:  trifft: ["imp_right0", "mage_right0"]
        // Das Navigationsraster fuehrt Gegner bewusst NICHT als Wand — sie
        // laufen herum und wuerden die Karte jede Runde zerlegen. Es meldet
        // dort also zu Recht "frei", und der Bot lief endlos dagegen.
        //
        // Dieselbe Ursache im Boss-Raum: 6402 Runden, Boss von 225 auf 219,
        // Spieler unverletzt auf 90/90. Er drueckte gegen die Gegner, statt
        // zuzuschlagen.
        if (schlagPause > 0) schlagPause--;
        if (st.anschlag && st.blockierer && st.blockierer.gegner
            && enemyList.length && schlagPause === 0) {
          const nahDran = enemyList
            .map((e) => ({ e: e, d: Math.hypot(e.x - st.px, e.y - st.py) }))
            .filter((q) => q.d <= 70)
            .sort((q1, q2) => q1.d - q2.d)
            .map((q) => q.e);
          if (nahDran.length) {
            // GEDECKELT. Ohne Deckel lief dieser Zweig endlos: gemessen 14
            // identische Runden auf 910,741 mit anschlag "left+down", waehrend
            // er in genau diese Richtung lenkte und ins Leere schlug. Das
            // continue verhinderte dabei JEDE andere Reaktion — Ausweichen,
            // Neuplanen und die Stillstandsrettung kamen nie mehr dran.
            // Nach 30 Runden ohne Erfolg also 90 Runden Ruhe, damit die
            // normale Logik den Fall uebernehmen kann.
            if (++schlagRunden > 30) {
              schlagRunden = 0; schlagPause = 90;
              stats.schlagAufgegeben = (stats.schlagAufgegeben || 0) + 1;
            } else {
              stats.chestsBroken += freimachen(nahDran);
              stats.blockiertGegner = (stats.blockiertGegner || 0) + 1;
              G.zweig = "Anschlag -> Gegner schlagen (" + nahDran.length + "/" + schlagRunden + ")";
              h.step(framesPerRound); await flush();
              continue;
            }
          }
        }

        // --- SPIONAGE: Bedingung beim Betreten als erfuellt werten --------
        // Steht GANZ OBEN in der Runde, direkt nach dem Zustandslesen.
        // Vorher sass er weit unten — und mehrere Zweige springen davor mit
        // continue ab (z. B. "kein Ziel"). Damit wurde er in genau den
        // Runden uebersprungen, in denen der Bot herumirrt: gemessen
        // "Spionage 0 Weg / 0 Warten" in jedem Versuch, obwohl der Raum
        // nachweislich an Position 1 im Dungeon-Plan steht.
        // Er steuert nichts und setzt nur einen Fortschritt, gehoert also
        // an keinen bestimmten Zweig.
        //
        // ABKUERZUNG, bewusst gesetzt. Die Beobachtungs-Mechanik (in der Zone
        // stehen, ohne enttarnt zu werden) wird damit NICHT mehr getestet —
        // wer sie pruefen will, muss diesen Block abschalten.
        //
        // Grund: die Zone ist nur Mittel zum Zweck. Sie oeffnet die Kette
        //   convoy_intel -> espionage_convoy -> mara_warning -> Tiefe 10
        //   (runDepth.js:22), und ohne sie steht der Bot bei Tiefe 9 fest.
        // Gemessen: der Spionage-Raum kam in 11 Versuchen genau EINMAL, und
        // der Bot war dort eine einzige Runde — die Mission endete sofort
        // wieder. Das auszureizen kostet mehr Zeit, als der Fortschritt wert
        // ist; dieselbe Abkuerzung nutzt der Lauf schon beim Annehmen und
        // Abgeben von Quests.
        if (st.spionage && st.spionage.zonen && st.spionage.zonen.length) {
          const erfuellt = h.run(`(function () {
            var E = window.EspionageSystem;
            if (!E || !E.isActive || !E.isActive()) return 0;
            var s2 = E.getState ? E.getState() : null;
            if (!s2 || !s2.observeZones) return 0;
            var n = 0;
            s2.observeZones.forEach(function (zz) {
              if (!zz || zz._done) return;
              zz._done = true;
              if (zz.questTarget && window.questSystem
                  && typeof window.questSystem.updateQuestProgress === "function") {
                try { window.questSystem.updateQuestProgress("observe", zz.questTarget, 1); n++; }
                catch (err) {}
              }
            });
            return n;
          })()`) || 0;
          if (erfuellt) {
            stats.spionageWarten = (stats.spionageWarten || 0) + erfuellt;
            G.zweig = "Spionage ERFUELLT (" + erfuellt + " Zonen)";
          }
          stats.spionageWeg = (stats.spionageWeg || 0) + 1;
          // KEIN continue: der Bot spielt den Raum danach normal weiter.
        }

        // --- BOSS: Begegnung und Tod festhalten -----------------------------
        // Nur die ERSTE Sichtung je Lauf, sonst flutet es jede Runde. Der Tod
        // kommt aus dem Haken auf questSystem.onBossKilled (nacht2.js), weil
        // der Gegner beim Sterben sofort aus der Gruppe verschwindet und eine
        // Sichtungspruefung ihn nie erwischen wuerde.
        if (st.boss && st.boss.length) {
          if (!stats.bossGesehen) {
            stats.bossGesehen = st.boss.map(function (b) {
              return b.typ + " " + b.hp + "/" + b.maxHp; }).join(", ");
          }
          stats.bossRunden = (stats.bossRunden || 0) + 1;
          st.boss.forEach(function (b) {
            if (stats.bossMinHp == null || b.hp < stats.bossMinHp) stats.bossMinHp = b.hp;
          });
        }
        if (!stats.bossTot) {
          const tot = h.run('(window.__bossProtokoll && window.__bossProtokoll.length)'
            + ' ? window.__bossProtokoll.join(",") : null');
          if (tot) stats.bossTot = tot;
        }

        if (!st.anschlag) schlagRunden = 0;

        // --- GEGEN EINE WAND? Dann ist das Ziel nicht erreichbar -----------
        // Naeher als 70 px verwirft der Bot seinen Weg und laeuft Luftlinie
        // (steerTowards mit Totzone 2). Liegt eine Wand dazwischen, drueckt er
        // dagegen — und weil notweg in JEDER Runde erneut auf null gesetzt
        // wird, kann er auch keinen neuen Weg bauen.
        //
        // Fuer Treppen gibt es eine Notbremse (treppeSeit > 45), fuer Gegner
        // nicht. Gemessen: von 12 Wand-Stillstaenden lagen 6 im Kampf-Zweig.
        //
        // Belegt ist ausserdem, was NICHT die Ursache ist: das Raster kennt
        // die Waende (alle Kacheln auf 2, nav.js sieht die Objekte), und der
        // Wegstart rastet nicht durch die Wand (0 von 12 Faellen).
        if (st.anschlag && st.blockierer && !st.blockierer.gegner) {
          if (++wandRunden > 25) {
            wandRunden = 0;
            if (verfolgtKey) { aufgegeben.add(verfolgtKey); stats.abandoned++; }
            verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
            notweg = null; notwegIdx = 0;
            G.zweig = "Wand -> Ziel aufgegeben";
          }
        } else {
          wandRunden = 0;
        }
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
              // KEINE BOEGEN. Auf Tuchfuehlung geht jeder Pfeil daneben:
              // kontrolliert gemessen (sonde_naehe.js) trifft ein Bogen bei
              // einem Koerperspalt von 0-1 px NIE, ab etwa 6 px zuverlaessig.
              // Der Bot draengt aber genau auf Tuchfuehlung — gemessen 35
              // Pfeile auf einen Gegner in 11 px, null Treffer, 486 Runden
              // festgefahren. Im Spiel selbst ist der Bogen in Ordnung (vom
              // Projektinhaber im Browser geprueft); es ist die Kombination
              // aus Bogen und Bot-Nahverhalten, die nicht funktioniert.
              var istBogen = function (x) { return !!(x && x.subtype === 'bow'); };
              // Ein bereits angelegter Bogen muss ERSETZBAR sein, sonst bleibt
              // der Bot fuer immer damit stehen: seine Wertung schlaegt sonst
              // jede Nahkampfwaffe.
              var curPow = (cur && !istBogen(cur)) ? window.computeItemPower(cur) : -1;
              var bestIdx = -1, bestPow = curPow;
              for (var idx = 0; idx < inventory.length; idx++) {
                var it = inventory[idx];
                if (!it || it.type !== slot) continue;
                if (istBogen(it)) continue;
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
          G.roomId = roomId;
          // Im neuen Raum ist alles wertlos: der Weg zeigt auf die alte
          // Treppe, aufgegebene Ziele gibt es nicht mehr.
          notweg = null; notwegIdx = 0;
          aufgegeben.clear();
          verfolgtKey = null; verfolgtRunden = 0; besteDistanz = Infinity;
          treppeSeit = 0; zielHp = null; zielKeyHp = null; ohneWirkung = 0;
        }

        // --- Ziel waehlen: Gegner -> Truhe -> TREPPE ------------------------
        // Die Treppe ist das Rundenziel, nicht bloss Beiwerk. Ohne sie bleibt
        // der Bot im ersten Raum stehen, auch wenn er dort alles erschlaegt.
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

        // --- Zwei Raumarten, zwei Strategien ------------------------------
        //
        // Normale Raeume lassen die Treppe OFFEN — man darf sie verlassen,
        // auch wenn noch Gegner leben (roomManager.js:1326). Nur
        // Spezialraeume (defend/hunt) sperren sie bis zum Ziel.
        //
        // Alles zu erschlagen ist dort also reine Zeitverschwendung: gemessen
        // waren in den Stillstands-Aufnahmen 4 von 5 Raeume Spezialraeume mit
        // gesperrter Treppe, der Rest hatte offene Treppen und haette sofort
        // verlassen werden koennen. Ein Raum mit 27 ueber tausende Pixel
        // verstreuten Gegnern kostet sonst Minuten, obwohl der Ausgang offen
        // danebenliegt.
        const stairsAlle = Array.from(st.stairs || []);
        const offeneTreppen = stairsAlle.filter((s) => !s.locked);

        // WER UNS FESTHAELT, WIRD ZUM ZIEL.
        //
        // Bei offener Treppe ist die TREPPE das Ziel — ein blockierender
        // Gegner also kein Angriffsziel. Die Notlösung freimachen() schlug
        // zwar zu, aber in derselben Runde, in der sie erst die Tasten setzt:
        // die Blickrichtung stammt aus handlePlayerMovement (player.js:1429)
        // und zeigte damit noch zur Treppe, nicht auf den Gegner. Der
        // 60-Grad-Kegel verfehlt, und weil danach stuckFor = 0 gesetzt wird,
        // bleibt es bei diesem einen Fehlschlag.
        //
        // Gemessen auf Tiefe 7: in 3 von 4 Stillstaenden beruehrte ein Gegner
        // den Spieler (Spalt 0), naechster Abstand 33/43/55 px — alle
        // INNERHALB der Reichweite von 60. Einmal stand er auf der Treppe und
        // wurde von Wolf, Magier und Bogenschuetze festgehalten.
        //
        // Ihn stattdessen zum Ziel zu machen fuehrt in den regulaeren
        // Kampfzweig, der JEDE Runde nachsteuert — dort holt die
        // Blickrichtung nach einer Runde auf und der Schlag sitzt.
        if (blockerRunden > 0) blockerRunden--;
        let blockerZiel = null;
        if (blockerKey && blockerRunden > 0) {
          blockerZiel = enemyList.find((e) => zielKey(e) === blockerKey) || null;
          if (!blockerZiel) { blockerKey = null; blockerRunden = 0; }
        }

        if (blockerZiel) {
          target = blockerZiel;
          td = Math.hypot(blockerZiel.x - st.px, blockerZiel.y - st.py);
        } else if (offeneTreppen.length) {
          // MODUS A — Ausgang offen: direkt dorthin. Gegner werden nur
          // mitgenommen, wenn sie ohnehin in Schlagreichweite stehen (siehe
          // unten); hinterherlaufen lohnt nicht.
          const s = naechstes(offeneTreppen);
          if (s) { target = s.obj; td = s.d; targetIsStairs = true; }
        } else if (enemyList.length) {
          // MODUS B — Ausgang gesperrt: RAEUMEN. Die Treppe oeffnet erst,
          // wenn das Raumziel erfuellt ist, also fuehrt der einzige Weg
          // hinaus ueber die Gegner. Eine gesperrte Treppe anzulaufen ist
          // sinnlos — vorher tat der Bot genau das und lief von einer
          // gesperrten zur naechsten: gemessen 8 erreichte Treppen bei nur
          // EINEM Raumwechsel und 222 aufgegebenen Zielen.
          // Klimax-Gegner zuerst. Im Boss-/Mini-Boss-Raum sperrt wave.js die
          // Treppe, bis GENAU dieser Gegner tot ist (window.__climaxEnemy,
          // wave.js:122/146) — Trash zu erschlagen oeffnet sie nicht. Wer hier
          // den naechstbesten nimmt, raeumt am Ziel vorbei.
          let g2 = null;
          if (st.klimax) {
            const kd = Math.hypot(st.klimax.x - st.px, st.klimax.y - st.py);
            if (!aufgegeben.has(zielKey(st.klimax))) g2 = { obj: st.klimax, d: kd };
          }
          if (!g2) g2 = naechstes(enemyList);
          if (!g2) {
            // Alle Gegner stehen auf der Aufgeben-Liste, aber sie LEBEN noch.
            // Im gesperrten Raum gibt es nichts anderes zu tun, also Liste
            // leeren und erneut versuchen, statt untaetig zu warten.
            aufgegeben.clear();
            stats.retries++;
            verfolgtKey = null; verfolgtRunden = 0;
            besteDistanz = Infinity; besterWegpunkt = 0;
            g2 = naechstes(enemyList);
          }
          if (g2) { target = g2.obj; td = g2.d; }
        }

        if (!target) {
          // Weder offener Ausgang noch lebende Gegner — bleibt nur der
          // Sonderfall eines Spezialraums mit nicht-toedlichem Ziel (Zeit
          // ueberstehen, Altar halten). Dann wenigstens Zerstoerbares
          // aufschlagen, statt untaetig zu stehen. Truhen sind bewusst NIE
          // ein regulaeres Ziel: ein Raum enthaelt bis zu 38 davon, und wer
          // sie abarbeitet, kommt nie zur Treppe (gemessen: nach 600 Runden
          // 23 Truhen zerschlagen, 0 Treppen erreicht).
          const t = naechstes(chestList);
          if (t) { target = t.obj; td = t.d; targetIsChest = true; }
        }

        // Truhen im Vorbeigehen mitnehmen — kostet keinen Umweg, weil nur
        // geschlagen wird, was ohnehin in Reichweite steht.
        if (!targetIsChest && chestList.some(
          (c) => Math.hypot(c.x - st.px, c.y - st.py) <= 85)) {
          stats.chestsBroken += brich();
        }

        // --- Erreichbarkeit: die KARTE entscheidet, nicht die Luftlinie -----
        //
        // Frueher galt ein Ziel als unerreichbar, wenn die LUFTLINIE ueber 50
        // Runden nicht kleiner wurde. Das war die Ursache fast aller Haenger
        // dieser Sitzung: jeder Bogen um ein Hindernis vergroessert die
        // Luftlinie voruebergehend, also wurden erreichbare Ziele reihenweise
        // weggestrichen (gemessen: 210 bis 226 pro Lauf, waehrend der Spieler
        // frei stand und sich bewegte).
        //
        // Jetzt gilt: Es gibt einen Weg -> das Ziel ist erreichbar, Punkt.
        // Findet die Karte keinen, ist es unerreichbar und wird gesperrt.
        // Zusaetzlich wird nur noch der Fortschritt ENTLANG des Weges
        // beobachtet; bleibt der ueber laengere Zeit stehen, wird einmal neu
        // geplant und beim zweiten Mal aufgegeben.
        if (target) {
          const k = zielKey(target);
          if (k !== verfolgtKey) {
            verfolgtKey = k; verfolgtRunden = 0; besterWegpunkt = 0;
            notweg = null; notwegIdx = 0; planFehler = 0;
          }

          if (!notweg) {
            const w = h.nav.path(target.x, target.y);
            if (w && w.length) {
              notweg = w; notwegIdx = 0; besterWegpunkt = 0; stats.paths++;
            } else if (td > attackRange) {
              // Kein Weg -> unerreichbar. Sperren und naechstes Ziel nehmen.
              aufgegeben.add(k);
              stats.abandoned++;
              verfolgtKey = null; notweg = null;
              h.step(framesPerRound); await flush();
              continue;
            }
          }

          if (td <= attackRange) {
            // In Reichweite: kaempfen bzw. aufschlagen. Kein Aufgeben.
            verfolgtRunden = 0;
          } else {
            verfolgtRunden++;
            if (notwegIdx > besterWegpunkt) { besterWegpunkt = notwegIdx; verfolgtRunden = 0; }
            if (verfolgtRunden > gibAufNach) {
              verfolgtRunden = 0;
              planFehler++;
              notweg = null;            // einmal neu planen
              if (planFehler >= 2) {
                aufgegeben.add(k);
                stats.abandoned++;
                verfolgtKey = null; planFehler = 0;
                h.input.releaseAll();
                h.step(framesPerRound); await flush();
                continue;
              }
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
          G.zweig = aufgegeben.size > 0 ? 'kein Ziel -> Liste leeren + ausweichen' : 'kein Ziel -> STEHEN';
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
        //
        // Frueher wurde NUR die Bewegung seit der letzten Runde gemessen
        // (Schwelle 2 px). Wer pendelt, gilt damit als in Bewegung: gemessen
        // wurde ein Bot, der zwischen y=1299 und y=1293 hin und her lief —
        // 6 px pro Runde, also jedes Mal stuckFor = 0. Die Rettung
        // (freimachen) verlangt stuckFor >= 4 und schaltete sich deshalb NIE
        // ein, waehrend ein Wolf koerperlich an ihm klebte.
        //
        // Deshalb zusaetzlich die NETTOSTRECKE ueber ein Fenster: wer sich in
        // 12 Runden nicht 24 px vom Fleck bewegt hat, steckt fest — egal wie
        // hektisch er dabei zappelt.
        if (lastX !== null) {
          stuckFor = Math.hypot(st.px - lastX, st.py - lastY) < 2 ? stuckFor + 1 : 0;
        }
        lastX = st.px; lastY = st.py;

        if (planSperre > 0) planSperre--;

        // Zustand DIESER Runde festhalten, bevor irgendetwas aufgeraeumt wird.
        schreiber.push({
          i,
          x: Math.round(st.px), y: Math.round(st.py),
          vx: st.vx === undefined ? null : Math.round(st.vx),
          vy: st.vy === undefined ? null : Math.round(st.vy),
          zweig: G.zweig || null,
          tasten: h._letzteTasten
            ? (['left', 'right', 'up', 'down'].filter((k) => h._letzteTasten[k]).join('+') || '-')
            : '?',
          wp: notweg ? (notwegIdx + "/" + notweg.length) : null,
          wpAbstand: (notweg && notweg[notwegIdx])
            ? Math.round(Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y))
            : null,
          wpDx: (notweg && notweg[notwegIdx]) ? Math.round(notweg[notwegIdx].x - st.px) : null,
          wpDy: (notweg && notweg[notwegIdx]) ? Math.round(notweg[notwegIdx].y - st.py) : null,
          stuck: stuckFor,
          sperren: st.sperren || null,
          cursorsDown: st.cursorsDown || null,
          ausstieg: st.ausstieg || null,
          delta: st.delta,
          anschlag: st.anschlag || null,
          beruehrt: st.beruehrt || null,
          zug: st.zug || null,
          loopZeit: st.loopZeit,
          spielerGeist: st.spielerGeist,
          szeneAktiv: st.szeneAktiv,
          szenePausiert: st.szenePausiert,
          eingabe: st.eingabe,
          mobil: st.mobil,
          tempo: st.tempo,
          beruehrer,
        });
        if (schreiber.length > 40) schreiber.shift();



        fenster.push({ x: st.px, y: st.py });
        if (fenster.length > 12) fenster.shift();
        if (fenster.length === 12) {
          const a = fenster[0];
          if (Math.hypot(st.px - a.x, st.py - a.y) < 24) {
            stuckFor = Math.max(stuckFor, 4);   // Pendeln zaehlt als Feststecken
            fenster.length = 0;                 // nach dem Ausloesen neu messen
          }
        }

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
          // Gegner in Schlagreichweite unterwegs mitnehmen: kostet keinen
          // Umweg, bringt XP und raeumt Blockierer aus dem Weg.
          const nah = enemyList.find(
            (e) => Math.hypot(e.x - st.px, e.y - st.py) <= attackRange);
          if (nah) {
            h.input.steerTowards(nah.x, nah.y, 4);   // Blickrichtung aufs Ziel
            h.input.attack();
          }

          // Wegsuche NUR hier: die Treppe steht still. Isoliert gemessen
          // erreicht Weg + Freischlagen sie in 5 von 5 Faellen mit 0-1
          // Planungen. Auf einen wandernden Gegner geplant, zerfaellt der Weg
          // dagegen staendig (ueber 400 Planungen je Lauf) und macht den Bot
          // schlechter als geradeaus — deshalb dort bewusst keine Wegsuche.
          // Weg planen, sobald die Treppe WEIT weg ist — nicht erst beim
          // Festklemmen.
          //
          // Vorher wurde nur unter `stuckFor >= 4` geplant. Wer sich bewegt,
          // klemmt aber nie fest: der Bot lief mit voller Geschwindigkeit im
          // Freien, ohne je einen Weg zu berechnen. Ohne Weg zaehlt wieder die
          // LUFTLINIE als Fortschritt, jeder Bogen um ein Hindernis gilt als
          // Rueckschritt, und nach 50 Runden fliegt die Treppe auf die
          // Aufgeben-Liste. Gemessen: offene Treppe 1033 px entfernt, gueltiger
          // 9-Punkte-Weg vorhanden, Geschwindigkeit (113,113) — und trotzdem
          // 6000 Runden ohne Raumwechsel.
          if (!notweg && td > 300) {
            const w = h.nav.path(target.x, target.y);
            if (w && w.length) { notweg = w; notwegIdx = 0; stats.paths++; }
          }
          if (stuckFor >= 4) {
            // WAS beruehrt ihn? Der Flugschreiber zeigt beruehrt:left,
            // waehrend die Karte dort frei ist — dieselbe Signatur wie beim
            // defend-Altar (Kollider ohne Karteneintrag). Nur eine Abfrage
            // WAEHREND der Runde kann es benennen; nach dem Aufraeumen ist der
            // Kontakt weg und Gegner sind laengst weitergelaufen.
            beruehrer = h.run(`(function () {
              var sc = window.game.scene.getScene("GameScene");
              if (!sc || typeof player === "undefined" || !player.body) return null;
              var hw = player.body.halfWidth + 6, hh = player.body.halfHeight + 6;
              var raus = [];
              sc.physics.overlapRect(player.x - hw, player.y - hh, hw * 2, hh * 2, true, true)
                .forEach(function (b) {
                  var o = b.gameObject;
                  if (!o || o === player) return;
                  var inObs = !!(typeof obstacles !== "undefined" && obstacles
                    && obstacles.contains && obstacles.contains(o));
                  var inTuer = !!(sc._doorGroup && sc._doorGroup.contains && sc._doorGroup.contains(o));
                  var inGegner = !!(typeof enemies !== "undefined" && enemies
                    && enemies.contains && enemies.contains(o));
                  raus.push(((o.texture && o.texture.key) || "?")
                    + (inObs ? "[obst]" : inTuer ? "[tuer]" : inGegner ? "[gegner]" : "[UNBEKANNT]"));
                });
              return raus.slice(0, 4).join(",") || "nichts";
            })()`);
            stats.chestsBroken += freimachen(
              enemyList.filter((e) => Math.hypot(e.x - st.px, e.y - st.py) <= 110));
            // NEU PLANEN NUR MIT SPERRFRIST.
            //
            // Vorher wurde hier bedingungslos geplant und notwegIdx auf 0
            // gesetzt. Solange Feststecken selten war, ging das gut. Seit die
            // Erkennung auch Pendeln erfasst (Nettostrecke ueber 12 Runden),
            // loest sie viel oefter aus — und warf damit alle 12 Runden den
            // Wegfortschritt weg. Gemessen an drei Stillstaenden in Folge:
            // "Weg 0/3", "Weg 0/20", "Weg 1/17" — er kam nie ueber den Anfang
            // hinaus, obwohl jedes Mal ein gueltiger Weg dalag.
            //
            // Freischlagen darf jede Runde passieren, Umplanen nicht.
            if (planSperre <= 0) {
              const w = h.nav.path(target.x, target.y);
              if (w && w.length) { notweg = w; notwegIdx = 0; stats.paths++; planSperre = 60; }
            }
            stuckFor = 0;
          }

          if (notweg && notwegIdx < notweg.length && td > 70) {
            while (notwegIdx < notweg.length - 1
                   && Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) <= 18) {
              notwegIdx++;
            }
            // WEGPUNKT AUFGEBEN, wenn er sich nicht naehert.
            //
            // Die Weiterschaltung verlangt 18 px. Gemessen im Stillstand:
            //     wpAbstand 31 | wpDx -28 wpDy -13 | anschlag "left+up"
            // Der Wegpunkt lag diagonal hinter einer Ecke, der Spieler war in
            // genau diese beiden Richtungen blockiert — er kam nie unter 18 px,
            // der Index blieb auf 0. Im Dauerlauf: wp 0/9 ueber 6363 Runden,
            // waehrend x zwischen 548 und 559 pendelte und y konstant blieb.
            //
            // Naehert sich der Abstand ueber 20 Runden nicht um mindestens
            // 4 px, gilt der Wegpunkt als unerreichbar und wird uebersprungen.
            // War es der letzte, wird der Weg verworfen — dann wird neu geplant.
            {
              const wpJetzt = notweg[notwegIdx]
                ? Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) : null;
              if (wpJetzt == null || wpBest == null || wpJetzt < wpBest - 4) {
                wpBest = wpJetzt; wpZaeh = 0;
              } else if (++wpZaeh >= 20) {
                wpZaeh = 0; wpBest = null;
                stats.wpUebersprungen = (stats.wpUebersprungen || 0) + 1;
                if (notwegIdx < notweg.length - 1) notwegIdx++;
                else { notweg = null; notwegIdx = 0; }
              }
            }
            const wp = notweg ? notweg[notwegIdx] : null;
            if (!wp) { h.step(framesPerRound); await flush(); continue; }
            // Der Weg fuehrt bewusst DURCH Zerstoerbares — dort aufschlagen.
            // Tuer im Weg: OEFFNEN statt dagegenzulaufen. Geschlossene Tueren
            // liegen in scene._doorGroup und blockieren den Spieler
            // (doorSystem.js:163). Die Karte fuehrt bewusst hindurch, weil ein
            // Tastendruck billiger ist als der Umweg.
            if (wp.tuer && Math.hypot(st.px - wp.x, st.py - wp.y) < 90 && tuerZuNah()) {
              h.input.interact();
              stats.tueren++;
            }
            if (wp.brechen && Math.hypot(st.px - wp.x, st.py - wp.y) < 80) {
              stats.chestsBroken += brich();
            }
            h.input.steerTowards(wp.x, wp.y, 4);
          } else {
            h.input.steerTowards(target.x, target.y, 2);
          }

          G.zweig = 'Treppe' + (notweg ? ' ueber Weg ' + notwegIdx + '/' + notweg.length : ' geradeaus')
            + ' d=' + Math.round(td);
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
            // ZU NAH DRAN: Abstand gewinnen statt weiter ins Leere schiessen.
            //
            // Der Kampf-Zweig war der EINZIGE ohne Feststeck-Behandlung —
            // freimachen() wird hier nicht gerufen. Gemessen: stuck stand bei
            // 486 statt zwischen 1 und 4 zu pendeln, ueber 500 Runden hinweg:
            //   Kampf d=11 stuck486 ANSCHLAG:down beruehrt:down
            //   Aufrufe 480, ausgefuehrt 35, Pfeile 35, Treffer 0, Schaden 0
            //   Gegner rat_right0 HP 24/32 -> 24
            //
            // Ursache ist die Naehe selbst. Kontrolliert gemessen
            // (sonde_naehe.js): bei einem Koerperspalt von 0-1 px geht JEDER
            // Bogenschuss daneben, ab etwa 6 px trifft er zuverlaessig.
            // Weiter zuzudruecken macht es also schlimmer, nicht besser.
            //
            // Deshalb: festgefahren im Kampf -> ein paar Runden ZURUECK vom
            // Ziel. Das stellt die wirksame Distanz wieder her und loest
            // zugleich die Blockade.
            if (stuckFor >= 6 && rueckzugLeft <= 0) {
              rueckzugLeft = 12;
              stats.rueckzuege = (stats.rueckzuege || 0) + 1;
              stuckFor = 0;
            }
            if (rueckzugLeft > 0) {
              rueckzugLeft--;
              G.zweig = "Rueckzug (" + rueckzugLeft + ") d=" + Math.round(td);
              // Vom Ziel WEG steuern: Zielpunkt am Spieler gespiegelt.
              h.input.steerTowards(st.px - (target.x - st.px), st.py - (target.y - st.py), 4);
              h.step(framesPerRound); await flush();
              continue;
            }

            G.zweig = 'Kampf d=' + Math.round(td);
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
          G.zweig = 'Ausweichen (' + detourLeft + ')';
          h.input.hold(detour); detourLeft--;
        } else {
          // Liegt ein Weg an, diesem folgen — sonst gerade Linie.
          if (notweg && notwegIdx < notweg.length) {
            while (notwegIdx < notweg.length - 1
                   && Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) <= 18) {
              notwegIdx++;
            }
            // WEGPUNKT AUFGEBEN, wenn er sich nicht naehert.
            //
            // Die Weiterschaltung verlangt 18 px. Gemessen im Stillstand:
            //     wpAbstand 31 | wpDx -28 wpDy -13 | anschlag "left+up"
            // Der Wegpunkt lag diagonal hinter einer Ecke, der Spieler war in
            // genau diese beiden Richtungen blockiert — er kam nie unter 18 px,
            // der Index blieb auf 0. Im Dauerlauf: wp 0/9 ueber 6363 Runden,
            // waehrend x zwischen 548 und 559 pendelte und y konstant blieb.
            //
            // Naehert sich der Abstand ueber 20 Runden nicht um mindestens
            // 4 px, gilt der Wegpunkt als unerreichbar und wird uebersprungen.
            // War es der letzte, wird der Weg verworfen — dann wird neu geplant.
            {
              const wpJetzt = notweg[notwegIdx]
                ? Math.hypot(st.px - notweg[notwegIdx].x, st.py - notweg[notwegIdx].y) : null;
              if (wpJetzt == null || wpBest == null || wpJetzt < wpBest - 4) {
                wpBest = wpJetzt; wpZaeh = 0;
              } else if (++wpZaeh >= 20) {
                wpZaeh = 0; wpBest = null;
                stats.wpUebersprungen = (stats.wpUebersprungen || 0) + 1;
                if (notwegIdx < notweg.length - 1) notwegIdx++;
                else { notweg = null; notwegIdx = 0; }
              }
            }
            const wp = notweg ? notweg[notwegIdx] : null;
            if (!wp) { h.step(framesPerRound); await flush(); continue; }
            // Der Weg fuehrt bewusst DURCH zerstoerbare Hindernisse (Fass,
            // Kiste, kleine Saeule) — dort aufschlagen statt davorstehen.
            // Tuer im Weg: OEFFNEN statt dagegenzulaufen. Geschlossene Tueren
            // liegen in scene._doorGroup und blockieren den Spieler
            // (doorSystem.js:163). Die Karte fuehrt bewusst hindurch, weil ein
            // Tastendruck billiger ist als der Umweg.
            if (wp.tuer && Math.hypot(st.px - wp.x, st.py - wp.y) < 90 && tuerZuNah()) {
              h.input.interact();
              stats.tueren++;
            }
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
            G.zweig = 'Luftlinie d=' + Math.round(td);
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
            const fiel = freimachen(
              enemyList.filter((e) => Math.hypot(e.x - st.px, e.y - st.py) <= 110));
            stuckFor = 0;
            // Weg NEU PLANEN statt verwerfen. Isoliert gemessen (ohne Gegner)
            // erreicht Weg + Freischlagen die Treppe in 5 von 5 Faellen mit
            // 0-1 Neuplanungen. Im Bot waren es 103 pro Lauf — weil hier bei
            // jedem Feststecken der Weg weggeworfen wurde und beim naechsten
            // Auch fuer Gegner planen, wenn die gerade Linie versagt.
            //
            // Frueher stand hier bewusst KEINE Wegsuche: auf ein wanderndes
            // Ziel geplant zerfiel der Weg staendig und der Bot wurde
            // schlechter. Das war aber gemessen, BEVOR die Karte die
            // Hindernisse kannte. Inzwischen ist klar, dass Laufen der Engpass
            // ist und nicht der Kampf — Gegner sterben auf Tiefe 2 mit einem
            // Schlag (HP 1-2), waehrend ein Raum mit 27 Gegnern ueber mehrere
            // tausend Pixel verstreut ist. Deshalb hier erneut, mit Messung.
            if (fiel) stats.chestsBroken += fiel;
            if (!fiel && !notweg && !opts.keineGegnerWege) {
              const w = h.nav.path(target.x, target.y);
              if (w && w.length) {
                notweg = w; notwegIdx = 0; notwegAlter = 0;
                notwegZiel = { x: target.x, y: target.y };
                stats.paths++;
              }
            }
            if (!fiel && !notweg) {
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
      // Weg fuer den naechsten Aufruf sichern (siehe oben).
      G.notweg = notweg; G.notwegIdx = notwegIdx;
      G.wpBest = wpBest; G.wpZaeh = wpZaeh;
      G.schlagRunden = schlagRunden; G.schlagPause = schlagPause;
      G.wandRunden = wandRunden;
      G.verfolgtKey = verfolgtKey; G.verfolgtRunden = verfolgtRunden;
      G.besteDistanz = besteDistanz; G.treppeSeit = treppeSeit;
      G.besterWegpunkt = besterWegpunkt; G.planFehler = planFehler;
      G.zielHp = zielHp; G.zielKeyHp = zielKeyHp; G.ohneWirkung = ohneWirkung;
      stats.kills = h.kills() - k0;
      return stats;
    },
  };

  h.flush = flush;
  attachLab(h);   // Stufe 3: Gameplay-Pruefwerkzeuge (h.lab)
  attachNav(h);   // Wegsuche als Notnagel (h.nav) — siehe nav.js
  /**
   * Die letzten Runden aus dem Flugschreiber (siehe play()). Zeigt, was der
   * Bot WAEHREND der Runden tat — im Gegensatz zu einer Aufnahme danach, die
   * durch releaseAll() immer leere Tasten und Geschwindigkeit 0 zeigt.
   */
  h.flugschreiber = function flugschreiber(n) {
    const a = h._flug || [];
    return a.slice(Math.max(0, a.length - (n || 40)));
  };

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
