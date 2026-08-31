// tools/headless/lab.js — Stufe 3 des Headless-Testsystems (#96).
//
// Werkzeuge, um Gameplay-BEHAUPTUNGEN zu pruefen statt nur "es crasht nicht":
// Gegner gezielt erzeugen, Affixe anwenden, Schaden ueber die echten Funnels
// zufuegen und die Wirkung messen.
//
// Genau die Aussagen, die zuletzt nur per Einmal-Skript belegt wurden
// (Boss-HP-Verhaeltnis, Wirkung der Elite-Affixe), werden damit dauerhaft
// abgesichert.
//
// Objekte koennen die vm-Grenze nicht passieren, deshalb arbeitet das Labor mit
// einer Registry IM Spielkontext (window.__lab.refs) und gibt nach aussen nur
// Indizes ("refs") und einfache Daten zurueck.

function attachLab(h) {
  const SCENE = 'GameScene';

  /** Registry im Kontext anlegen (idempotent). */
  function ensureRegistry() {
    h.run(`(function () {
      window.__lab = window.__lab || { refs: [] };

      // __labOhneElite(fn): fuehrt fn aus, waehrend BEIDE Elite-Wuerfe aus
      // spawnEnemy stillgelegt sind. Begruendung siehe lab.spawnEnemy (#110).
      //
      // Die Zuweisung an window.makeElite greift, weil die Spielskripte im
      // vm-Kontext auf oberster Ebene laufen: eine \`function\`-Deklaration legt
      // dort eine Eigenschaft auf dem globalen Objekt an, und die Aufrufstelle
      // in enemy.js (\`makeElite.call(this, enemy)\`) loest ueber genau diese
      // Eigenschaft auf. (Fuer \`let\`/\`const\` gilt das NICHT — die liegen nur
      // im lexikalischen Scope und sind von aussen unerreichbar.)
      if (!window.__labOhneElite) {
        window.__labOhneElite = function (fn) {
          var altMake = window.makeElite;
          var EE = window.EliteEnemies;
          var altApply = EE ? EE.applyEliteToEnemy : null;
          window.makeElite = function () {};
          if (EE) EE.applyEliteToEnemy = function () {};
          try { return fn(); }
          finally {
            window.makeElite = altMake;
            if (EE) EE.applyEliteToEnemy = altApply;
          }
        };
      }
    })()`);
  }

  const lab = {
    /** Tiefe UND Welle setzen — beide steuern Skalierung bzw. Bossauswahl. */
    setDepth(depth, wave) {
      const w = (typeof wave === 'number') ? wave : depth;
      h.run(`(function () {
        window.DUNGEON_DEPTH = ${depth};
        window.currentWave = ${w};
        if (typeof currentWave !== 'undefined') currentWave = ${w};
      })()`);
    },

    /** Alle Gegner entfernen, damit ein Testfall sauber startet. */
    clearEnemies() {
      h.run(`(function () {
        if (typeof enemies === 'undefined' || !enemies) return;
        enemies.getChildren().slice().forEach(function (e) {
          if (e) { try { e.destroy(); } catch (x) {} }
        });
        window.__lab = { refs: [] };
      })()`);
    },

    /**
     * Erzeugt einen GEWOEHNLICHEN Gegner und legt ihn in die Registry.
     *
     * FLATTER-URSACHE (#110), belegt: spawnEnemy wuerfelt ganz am Ende ZWEI
     * Elite-Chancen — Legacy-Elite (makeElite, ~8 % ab Tiefe 5) und
     * Champion/Unique (EliteEnemies.applyEliteToEnemy, ~11 % auf Tiefe 10).
     * Messung ueber 200 Spawns (Typ 3, Tiefe 10): 17,5 % kamen als Elite
     * heraus, darunter magic_resistant und spectral_hit. Beide senken den
     * Schaden in genau dem Funnel, den die Affix-Tests messen:
     *   Faehigkeitsschaden bei weaponDamage 20 -> 20 (196x), 10 (2x), 7 (2x).
     * Der "gewoehnliche" Kontrollgegner war also gelegentlich selbst resistent
     * bzw. selbst ein Berserker. Daher die Meldungen "ohne=10, mit=10" und
     * "ohne=4, mit=10" (20 x 0.5 x 0.35 = 3.5 -> gerundet 4).
     *
     * Der Wurf wird deshalb UNTERDRUECKT statt hinterher rueckgaengig gemacht:
     * removeEliteFromEnemy laesst die HP-/Tempo-Aufschlaege stehen, und ein
     * halb zurueckgebauter Gegner ist als Kontrolle wertlos.
     *
     * @param {object} [opts] { elite: true } laesst den Zufallswurf wieder zu.
     * @returns {number} ref-Index
     */
    spawnEnemy(type, dx, dy, opts) {
      ensureRegistry();
      const roh = `spawnEnemy.call(sc, player.x + ${dx || 150}, player.y + ${dy || 0}, ${type || 1})`;
      const ausdruck = (opts && opts.elite)
        ? roh
        : `window.__labOhneElite(function () { return ${roh}; })`;
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        var e = ${ausdruck};
        window.__lab.refs.push(e);
        return window.__lab.refs.length - 1;
      })()`);
    },

    /**
     * Mini-Boss erzeugen. ABSICHTLICH MIT Elite-Wurf (anders als spawnEnemy):
     * der Boss/Mini-Boss-Test misst das HP-VERHAELTNIS gegen die Verteilung,
     * wie sie im Spiel wirklich vorkommt. Nachgemessen (5 x 36 Wuerfe, T10):
     * mit Wurf liegt das Verhaeltnis bei 3.29-3.84, ohne Wurf bei 3.78-4.15 —
     * letzteres kratzt an der Obergrenze 4.2 des Zielbands. Den Wurf hier
     * stillzulegen wuerde also ein NEUES Flattern erzeugen, kein altes
     * beheben (#110).
     */
    spawnMiniBoss(baseType, dx, dy) {
      ensureRegistry();
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        var e = spawnMiniBoss.call(sc, player.x + ${dx || 150}, player.y + ${dy || 0}, ${baseType || 3});
        window.__lab.refs.push(e);
        return window.__lab.refs.length - 1;
      })()`);
    },

    /**
     * Erzeugt den zur aktuellen Welle passenden Boss und gibt seine Daten
     * zurueck. spawnBoss() liefert selbst nichts — der Boss wird ueber die
     * Gegner-Gruppe eingesammelt.
     */
    spawnBoss() {
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        try { spawnBoss.call(sc); } catch (e) { return { error: e.message }; }
        var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
        return b ? { type: b.bossType, hp: b.hp, maxHp: b.maxHp, damage: b.damage } : { error: 'kein Boss erzeugt' };
      })()`);
    },

    /**
     * Wendet EINEN benannten Elite-Affix an (statt der zufaelligen Auswahl aus
     * applyEliteToEnemy) — nur so ist ein Effekt gezielt pruefbar.
     */
    applyAffix(ref, affixId) {
      return h.run(`(function () {
        var e = window.__lab.refs[${ref}];
        var def = window.EliteEnemies.ENEMY_AFFIX_DEFS.filter(function (d) { return d.id === '${affixId}'; })[0];
        if (!e || !def) return false;
        def.apply(e);
        return true;
      })()`);
    },

    /** Rohdaten eines registrierten Gegners. */
    enemy(ref) {
      return h.run(`(function () {
        var e = window.__lab.refs[${ref}];
        if (!e) return null;
        return {
          hp: e.hp, maxHp: e.maxHp, damage: e.damage, baseDamage: e.baseDamage,
          speed: e.speed, x: e.x, y: e.y, active: !!e.active,
          isMiniBoss: !!e.isMiniBoss, isBoss: !!e.isBoss,
          attackCdMul: e._attackCdMul,
          // #110: Elite-Zustand mitmelden, damit ein Test seine Ausgangslage
          // zusichern kann ("mein Kontrollgegner ist wirklich gewoehnlich")
          // statt sie nur anzunehmen.
          isElite: !!(e.isElite || e._isElite),
          affixe: (e.eliteAffixes || []).join(','),
        };
      })()`);
    },

    /**
     * Fuegt einem Gegner ueber den ECHTEN Funnel Schaden zu
     * (player.js dealDamageToEnemy) und meldet die Wirkung.
     * @param {object} [opts] { ability: 'attack'|'whirlwind'|..., multiplier }
     */
    hitEnemy(ref, opts) {
      opts = opts || {};
      const ability = opts.ability || 'attack';
      const mult = typeof opts.multiplier === 'number' ? opts.multiplier : 1;
      const ranged = opts.ranged ? 'true' : 'false';
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        var e = window.__lab.refs[${ref}];
        if (!e) return null;
        var before = e.hp;
        var res = dealDamageToEnemy(sc, e, ${mult}, '${ability}', { ranged: ${ranged} });
        return { before: before, after: e.hp, dealt: before - e.hp, reported: res ? res.damage : null };
      })()`);
    },

    /**
     * Laesst einen registrierten Gegner den Spieler treffen — ueber den echten
     * Funnel (enemy.js applyPlayerDamage) inklusive des dritten Parameters
     * `attacker`, an dem vampiric/berserker haengen.
     */
    hitPlayerFrom(ref, rawDamage) {
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        var e = window.__lab.refs[${ref}];
        var hpBefore = window.playerHealth;
        var eHpBefore = e ? e.hp : null;
        applyPlayerDamage(${rawDamage}, sc, e || undefined);
        return {
          playerBefore: hpBefore, playerAfter: window.playerHealth,
          playerLost: hpBefore - window.playerHealth,
          enemyBefore: eHpBefore, enemyAfter: e ? e.hp : null,
        };
      })()`);
    },

    /**
     * Spieler auf volle Lebenspunkte setzen (Vorbedingung fuer Schadenstests).
     *
     * FALLE: `playerHealth` existiert DOPPELT — als top-level `let` in main.js
     * und als Spiegel `window.playerHealth`. Nur den Spiegel zu setzen heilt
     * den Spieler NICHT; die naechste Schadensrechnung arbeitet mit dem echten
     * Wert und schreibt ihn zurueck. Ergebnis waeren Messungen, die Schaden aus
     * einem frueheren Testfall mitzaehlen. Deshalb beide setzen.
     */
    healPlayer() {
      h.run(`(function () {
        if (typeof playerHealth !== 'undefined') playerHealth = window.playerMaxHealth;
        window.playerHealth = window.playerMaxHealth;
      })()`);
    },

    /** Unverwundbarkeit/Ausweichen abschalten, damit Schaden messbar ankommt. */
    makePlayerVulnerable() {
      h.run(`(function () {
        window._playerInvincible = false;
        window.PLAYER_DODGE_CHANCE = 0;
        if (typeof playerArmor !== 'undefined') playerArmor = 0;
      })()`);
    },

    /** Waffenschaden fest setzen, damit Tests nicht von Ausruestung abhaengen. */
    setWeaponDamage(v) {
      h.run(`if (typeof weaponDamage !== 'undefined') weaponDamage = ${v};`);
    },

    /** Kritische Treffer ausschalten — sonst schwanken Schadensmessungen. */
    disableCrit() {
      h.run(`if (typeof playerCritChance !== 'undefined') playerCritChance = 0;`);
    },
  };

  h.lab = lab;

  // ---------------------------------------------------------------------------
  // Stufe 4: Dauerlauf ("soak")
  // ---------------------------------------------------------------------------
  /**
   * Spielt viele Raeume am Stueck und meldet, was dabei passiert ist.
   *
   * Zweck: Fehler finden, die erst in der Menge auftreten — Speicherlecks,
   * unerreichbare Treppen, kaputte Raumgeneratoren, Zustands-Reste zwischen
   * Raeumen. Das ist die Klasse Fehler, die ein einzelner Testfall nie sieht.
   *
   * Der Raumwechsel wird ueber `nextRoom()` erzwungen, statt den Bot die Treppe
   * suchen zu lassen — der hat keine Wegfindung, und die Suche ist nicht das,
   * was hier geprueft werden soll.
   */
  h.soak = async function soak(opts) {
    opts = opts || {};
    const rooms = opts.rooms || 25;
    const roundsPerRoom = opts.roundsPerRoom || 25;
    const report = { rooms: 0, kills: 0, errors: [], roomsWithoutEnemies: 0, deaths: 0 };
    const startKills = h.kills();

    for (let i = 0; i < rooms; i++) {
      const w = h.world();
      if (!w.player) { report.deaths++; break; }
      if (w.enemies === 0) report.roomsWithoutEnemies++;

      await h.bot.hunt({ rounds: roundsPerRoom });

      // Naechsten Raum erzwingen. roomManager stellt dafuer eine Funktion
      // bereit; faellt sie aus, bricht der Dauerlauf sauber ab statt endlos
      // im selben Raum zu drehen.
      // enterRoom(scene, roomId) nimmt die Szene als ARGUMENT (nicht als `this`).
      const advanced = h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        try {
          if (typeof window.enterRoom === 'function') { window.enterRoom(sc); return 'enterRoom'; }
        } catch (e) { return 'FEHLER: ' + e.message; }
        return null;
      })()`);
      if (advanced && String(advanced).startsWith('FEHLER')) {
        report.errors.push('Raumwechsel ' + i + ': ' + advanced);
        break;
      }
      if (!advanced) { report.errors.push('kein Raumwechsel moeglich (enterRoom fehlt)'); break; }

      await h.settle(() => false, { maxRounds: 4 });
      report.rooms++;
    }

    report.kills = h.kills() - startKills;
    report.consoleErrors = h.hardErrors().length;
    return report;
  };

  return h;
}

module.exports = { attachLab };
