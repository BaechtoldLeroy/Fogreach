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
    h.run('window.__lab = window.__lab || { refs: [] };');
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
     * Erzeugt einen Gegner und legt ihn in die Registry.
     * @returns {number} ref-Index
     */
    spawnEnemy(type, dx, dy) {
      ensureRegistry();
      return h.run(`(function () {
        var sc = window.game.scene.getScene('${SCENE}');
        var e = spawnEnemy.call(sc, player.x + ${dx || 150}, player.y + ${dy || 0}, ${type || 1});
        window.__lab.refs.push(e);
        return window.__lab.refs.length - 1;
      })()`);
    },

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
