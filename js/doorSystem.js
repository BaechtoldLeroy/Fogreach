// js/doorSystem.js — Door sprite system for Fogreach
// Spawns door sprites at procedural room doorway positions.
// Doors auto-open when the player approaches and auto-close when they leave.

(function () {
  'use strict';

  // ─── Die Kellertore ────────────────────────────────────────────────────────
  //
  // Schweres Eichentor mit Messingbaendern und Kette zwischen zwei Steinpfosten,
  // Pixelbild aus PixelLab (tools/tuerenBauen.js). Von vorn fuer waagerechte
  // Waende, von der Seite fuer senkrechte. Das Tor fuellt die ganze Wandtiefe
  // (64 px); der Koerper bleibt der alte 24 px-Riegel — Kollision, Sicht und
  // Durchgang verhalten sich genau wie bei der frueheren gezeichneten Tuer.
  //
  // Ein Tor ist 4-6 Kacheln lang. Gestreckt wird nichts: es wird aus Stuecken
  // zusammengesetzt (Anfang | Fuellung* | Mitte | Fuellung* | Ende) und je
  // Laenge und Richtung EINMAL als Textur mit vier Bildern abgelegt —
  // Bild 0 zu, 1-2 halb, 3 offen (Fluegel an die Pfosten geklappt, dazwischen
  // ist der Boden zu sehen).
  //
  // Fehlen die Bilder, zeigt das Tor Phasers Fehlbild, damit es auffaellt.

  var TOR_ORDNER = 'assets/sprites/tueren/';
  var TOR_TIEFE = 64;                        // Wandtiefe: 2 Kacheln
  var TOR_BILDER = 4;
  var TOR_OEFFNUNG = [1, 0.62, 0.32, 0.14];  // sichtbarer Anteil der Fluegel je Bild
  var TOR_ART = {
    // Stuecke in Reihenfolge: Anfang, Mitte, Ende, Fuellung vorn, Fuellung hinten.
    // pfosten: wie weit Anfang/Ende in die Laenge reichen, ohne zu klappen.
    horizontal: { name: 'waag', teile: ['links', 'mitte', 'rechts', 'fuell_l', 'fuell_r'], pfosten: [20, 20] },
    vertical: { name: 'senk', teile: ['oben', 'mitte', 'unten', 'fuell_o', 'fuell_u'], pfosten: [20, 20] }
  };

  function torTeilKey(art, teil) { return 'tor_' + art.name + '_' + teil; }

  /** Laedt die Torstuecke in preload der Kellerszene. */
  function bilderVorladen(scene) {
    if (!scene || !scene.load || !scene.textures) return;
    Object.keys(TOR_ART).forEach(function (o) {
      var art = TOR_ART[o];
      art.teile.forEach(function (t) {
        var k = torTeilKey(art, t);
        if (!scene.textures.exists(k)) scene.load.image(k, TOR_ORDNER + k + '.png');
      });
    });
  }

  /**
   * Setzt das Tor fuer eine Laenge zusammen und legt es als Textur mit vier
   * Bildern ab (Bild i liegt quer zur Laenge versetzt bei i*64).
   * @returns {string|null} Texturschluessel, null wenn Stuecke fehlen
   */
  function torTextur(scene, orientation, laenge) {
    var art = TOR_ART[orientation === 'horizontal' ? 'horizontal' : 'vertical'];
    var waag = art.name === 'waag';
    var key = 'tor_neu_' + art.name + '_' + laenge;
    if (scene.textures.exists(key)) return key;

    var bilder = [];
    for (var i = 0; i < art.teile.length; i++) {
      var tk = torTeilKey(art, art.teile[i]);
      if (!scene.textures.exists(tk)) return null;
      bilder.push(scene.textures.get(tk).getSourceImage());
    }
    var lang = function (b) { return waag ? b.width : b.height; };
    var anfang = bilder[0], mitte = bilder[1], ende = bilder[2];

    var tex = scene.textures.createCanvas(key,
      waag ? laenge : TOR_TIEFE * TOR_BILDER, waag ? TOR_TIEFE * TOR_BILDER : laenge);
    var ctx = tex.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Rechteck entlang der Laenge (von, n) im Bild f -> Leinwandkoordinaten.
    var rechteck = function (f, von, n) {
      return waag ? [von, f * TOR_TIEFE, n, TOR_TIEFE] : [f * TOR_TIEFE, von, TOR_TIEFE, n];
    };
    var setzen = function (b, von, n) {
      var r = rechteck(0, von, n);
      ctx.drawImage(b, 0, 0, waag ? n : TOR_TIEFE, waag ? TOR_TIEFE : n, r[0], r[1], r[2], r[3]);
    };
    // Fuellung wiederholen; ein Rest (Laengen ausserhalb des 16er-Rasters) wird angeschnitten.
    var fuellen = function (b, von, n) {
      for (var p = 0; p < n; p += lang(b)) setzen(b, von + p, Math.min(lang(b), n - p));
    };

    // Bild 0: das geschlossene Tor.
    var rest = Math.max(0, laenge - lang(anfang) - lang(mitte) - lang(ende));
    var restVorn = Math.floor(rest / 32) * 16 + (rest % 32 ? Math.floor((rest % 32) / 2) : 0);
    var pos = 0;
    setzen(anfang, pos, lang(anfang)); pos += lang(anfang);
    fuellen(bilder[3], pos, restVorn); pos += restVorn;
    setzen(mitte, pos, lang(mitte)); pos += lang(mitte);
    fuellen(bilder[4], pos, rest - restVorn); pos += rest - restVorn;
    setzen(ende, laenge - lang(ende), lang(ende));

    // Bilder 1-3: Pfosten bleiben, jeder Fluegel dreht sich um seinen Pfosten
    // weg und wird dabei schmaler und dunkler (er wendet sich vom Licht ab).
    var pa = art.pfosten[0], pb = art.pfosten[1];
    var naht = Math.round(laenge / 2);
    var quelle = tex.getSourceImage();
    for (var f = 1; f < TOR_BILDER; f++) {
      var k = TOR_OEFFNUNG[f];
      var kopie = function (von, n, nach, m) {
        var q = rechteck(0, von, n), z = rechteck(f, nach, m);
        ctx.drawImage(quelle, q[0], q[1], q[2], q[3], z[0], z[1], z[2], z[3]);
      };
      kopie(0, pa, 0, pa);
      kopie(laenge - pb, pb, laenge - pb, pb);
      var na = Math.max(2, Math.round((naht - pa) * k));
      var nb = Math.max(2, Math.round((laenge - pb - naht) * k));
      kopie(pa, naht - pa, pa, na);
      kopie(naht, laenge - pb - naht, laenge - pb - nb, nb);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(8, 5, 2, ' + (0.55 * (1 - k)).toFixed(3) + ')';
      var ra = rechteck(f, pa, na), rb = rechteck(f, laenge - pb - nb, nb);
      ctx.fillRect(ra[0], ra[1], ra[2], ra[3]);
      ctx.fillRect(rb[0], rb[1], rb[2], rb[3]);
      ctx.restore();
    }

    for (var b = 0; b < TOR_BILDER; b++) {
      var r = rechteck(b, 0, laenge);
      tex.add(b, 0, r[0], r[1], r[2], r[3]);
    }
    tex.refresh();

    if (scene.anims && !scene.anims.exists(key + '_auf')) {
      var folge = [];
      for (var a = 0; a < TOR_BILDER; a++) folge.push({ key: key, frame: a });
      scene.anims.create({ key: key + '_auf', frames: folge, frameRate: 14, repeat: 0 });
      scene.anims.create({ key: key + '_zu', frames: folge.slice().reverse(), frameRate: 14, repeat: 0 });
    }
    return key;
  }

  // ─── Door spawning ────────────────────────────────────────────────────────

  var TILE_SIZE = 32;

  /**
   * Spawn a door sprite at world-pixel position (x, y).
   *
   * @param {Phaser.Scene} scene
   * @param {number} x       World pixel X (center of doorway)
   * @param {number} y       World pixel Y (center of doorway)
   * @param {string} orientation  'horizontal' or 'vertical'
   * @param {number} [doorWidthTiles]  width of the doorway in tiles (default 4)
   * @param {number} [tint]  Wandfarbe des Raums, die das Tor annimmt
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  function spawnDoor(scene, x, y, orientation, doorWidthTiles, tint) {
    if (!scene || !scene.physics) return null;

    // Doors use their own static group — NOT the obstacles group.
    // obstacles.refresh() re-enables all bodies, which breaks open doors.
    if (!scene._doorGroup) {
      scene._doorGroup = scene.physics.add.staticGroup();
    }
    // Recreate colliders if missing
    var playerRef = (typeof player !== 'undefined') ? player : null;
    var doorProcessCb = function (obj, door) {
      return !(door && door.getData && door.getData('walkthrough'));
    };
    if (playerRef && !scene._doorPlayerCollider) {
      scene._doorPlayerCollider = scene.physics.add.collider(
        playerRef, scene._doorGroup, null, doorProcessCb
      );
    }
    // Projectiles + enemies collide with closed doors
    if (window.enemyProjectiles && !scene._doorEnemyProjCollider) {
      scene._doorEnemyProjCollider = scene.physics.add.collider(
        window.enemyProjectiles, scene._doorGroup, function (proj) {
          if (proj && proj.active) {
            if (typeof window.releaseEnemyProjectile === 'function') window.releaseEnemyProjectile(proj);
            else proj.destroy();
          }
        }, doorProcessCb
      );
    }
    if (window.playerProjectiles && !scene._doorPlayerProjCollider) {
      scene._doorPlayerProjCollider = scene.physics.add.collider(
        window.playerProjectiles, scene._doorGroup, function (proj) {
          if (!proj || !proj.active) return;
          // Wirbelklingen (twistingBlades) prallt an geschlossenen Türen AB und
          // kehrt zurück — wie an Wänden (twStartReturn), damit sie nicht mehr
          // durch Türen fliegt. Andere Projektile werden an der Tür zerstört.
          var sr = (typeof proj.getData === 'function') ? proj.getData('twStartReturn') : null;
          if (typeof sr === 'function') sr();
          else proj.destroy();
        }, doorProcessCb
      );
    }
    if (window.enemies && !scene._doorEnemyCollider) {
      scene._doorEnemyCollider = scene.physics.add.collider(
        window.enemies, scene._doorGroup, null, doorProcessCb
      );
    }
    var doorGroup = scene._doorGroup;

    doorWidthTiles = doorWidthTiles || 4;
    var doorWidthPx = doorWidthTiles * TILE_SIZE;
    var doorThickness = 24; // pixels — thick enough to visually fill the doorway

    // Der Koerper ist ein 24 px-Riegel quer im Durchgang: bei waagerechten
    // Durchgaengen (Wand laeuft links-rechts) lang in X, bei senkrechten in Y.
    var bodyW, bodyH;
    if (orientation === 'horizontal') {
      bodyW = doorWidthPx;
      bodyH = doorThickness;
    } else {
      bodyW = doorThickness;
      bodyH = doorWidthPx;
    }

    // Create a static physics sprite in the door group (separate from obstacles)
    var torKey = torTextur(scene, orientation, doorWidthPx);
    var door = torKey ? doorGroup.create(x, y, torKey, 0) : doorGroup.create(x, y, '__MISSING');
    if (!door) return null;

    door.setOrigin(0.5, 0.5);
    // Eine Tuer ist hohe Architektur wie Statue und Saeule: sie steht aufrecht
    // im Rahmen und darf von keinem Prop geschnitten werden.
    door.setDepth(window.WELT_TIEFEN.PROP_HOCH);
    // Nicht nach Bildhoehe sortiert (#165): geschlossen haelt der Riegel den
    // Spieler vor dem Tor, er kommt nie dahinter. Offen fuellt das Bild den
    // Durchgang mit dunklem Boden; angehoben laege dieses Rechteck ueber den
    // Beinen des Spielers, waehrend die Wand daneben (39) unter ihm bleibt.

    door.setData('isDoor', true);
    door.setData('doorState', 'closed');
    door.setData('orientation', orientation);
    door.setData('walkthrough', false);

    door.refreshBody();
    if (door.body) {
      // refreshBody nimmt die Bildgroesse (64 tief). Der Koerper bleibt der
      // Riegel, mittig im Tor — sonst haelt die Tuer den Spieler schon 20 px
      // vor der Wandflucht auf und verdeckt mehr Sicht als noetig.
      door.body.setSize(bodyW, bodyH, false);
      door.body.setOffset((door.displayWidth - bodyW) / 2, (door.displayHeight - bodyH) / 2);
    }
    // Das Tor nimmt die Wandfarbe des Raumthemas an (gefroren, bemoost, blutig…).
    if (tint) door.setTint(tint);

    // Track all doors on the scene for the update loop
    if (!scene._doors) scene._doors = [];
    scene._doors.push(door);

    return door;
  }

  // ─── Door interaction ──────────────────────────────────────────────────────

  var INTERACT_DIST = 100; // player must be within this distance to interact

  /**
   * Toggle the nearest door's open/closed state.
   * @param {Phaser.Physics.Arcade.Sprite} door
   */
  function toggleDoor(door) {
    // Zustand und Koerper wechseln sofort; nur das Bild klappt in ~0,2 s nach.
    var auf = door.getData('doorState') === 'closed';
    var anim = door.texture.key + (auf ? '_auf' : '_zu');
    if (door.anims && door.scene && door.scene.anims && door.scene.anims.exists(anim)) door.play(anim);
    door.setData('doorState', auf ? 'open' : 'closed');
    door.setData('walkthrough', auf);
    // Invalidate wall cache so fog of war updates immediately
    if (typeof window.invalidateWallCache === 'function') {
      window.invalidateWallCache();
    }
  }

  /**
   * Find the nearest door within interaction range of the player.
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  function findNearestDoor(scene, player) {
    if (!scene || !player) return null;
    var doors = scene._doors;
    if (!doors || !doors.length) return null;

    var px = player.x, py = player.y;
    var best = null;
    var bestDist = Infinity;

    for (var i = doors.length - 1; i >= 0; i--) {
      var door = doors[i];
      if (!door || !door.active || door.scene == null) {
        doors.splice(i, 1);
        continue;
      }
      var dx = door.x - px;
      var dy = door.y - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACT_DIST && dist < bestDist) {
        bestDist = dist;
        best = door;
      }
    }
    return best;
  }

  /**
   * Try to interact with the nearest door. Call when E is pressed.
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} player
   * @returns {boolean} true if a door was toggled
   */
  function tryInteractDoor(scene, player) {
    var door = findNearestDoor(scene, player);
    if (door) {
      toggleDoor(door);
      return true;
    }
    return false;
  }

  /**
   * Update loop: just cleans up destroyed doors from the tracking list.
   * Call this every frame from the main update loop.
   *
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} player
   */
  function updateDoors(scene, player) {
    if (!scene) return;
    var doors = scene._doors;
    if (!doors || !doors.length) return;

    var nearestDoor = null;
    var nearestDist = INTERACT_DIST;

    for (var i = doors.length - 1; i >= 0; i--) {
      var door = doors[i];
      if (!door || !door.active || door.scene == null) {
        doors.splice(i, 1);
        continue;
      }
      // Find nearest door for prompt
      if (player) {
        var dx = door.x - player.x;
        var dy = door.y - player.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestDoor = door;
        }
      }
    }

    // Show/hide [E] prompt above nearest door
    if (nearestDoor && player) {
      if (!scene._doorPrompt) {
        scene._doorPrompt = scene.add.text(0, 0, (window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en') ? '[E] Door' : '[E] Tür', {
          fontSize: '12px', fill: '#ffdd44', fontFamily: 'monospace',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(500).setScrollFactor(1);
      }
      scene._doorPrompt.setPosition(nearestDoor.x, nearestDoor.y - 20);
      scene._doorPrompt.setVisible(true);
    } else if (scene._doorPrompt) {
      scene._doorPrompt.setVisible(false);
    }
  }

  /**
   * Clear all tracked doors (call on room cleanup).
   * @param {Phaser.Scene} scene
   */
  function clearDoors(scene) {
    if (!scene) return;
    if (scene._doors) {
      scene._doors.length = 0;
    }
    if (scene._doorPrompt) {
      try { scene._doorPrompt.destroy(); } catch (e) {}
      scene._doorPrompt = null;
    }
    var colliderKeys = ['_doorPlayerCollider', '_doorEnemyProjCollider', '_doorPlayerProjCollider', '_doorEnemyCollider'];
    for (var ci = 0; ci < colliderKeys.length; ci++) {
      if (scene[colliderKeys[ci]]) {
        try { scene[colliderKeys[ci]].destroy(); } catch (e) {}
        scene[colliderKeys[ci]] = null;
      }
    }
    if (scene._doorGroup) {
      try {
        scene._doorGroup.clear(true, true);
        scene._doorGroup.destroy(true);
      } catch (e) {}
      scene._doorGroup = null;
    }
  }

  /**
   * #065 Kontext-Primärbutton: leichtes Query-Signal, ob eine Tür in
   * Interaktions-Reichweite ist. Dieselbe Prüfung wie updateDoors (nearest door
   * < INTERACT_DIST), aber reine Query ohne Nebenwirkung. Defensiv -> false.
   * @returns {boolean}
   */
  function isDoorInRange(scene, player) {
    if (!scene || !player) return false;
    var doors = scene._doors;
    if (!doors || !doors.length) return false;
    for (var i = 0; i < doors.length; i++) {
      var door = doors[i];
      if (!door || !door.active) continue;
      var dx = door.x - player.x, dy = door.y - player.y;
      if (dx * dx + dy * dy < INTERACT_DIST * INTERACT_DIST) return true;
    }
    return false;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.DoorSystem = {
    bilderVorladen: bilderVorladen,
    torTextur: torTextur,
    spawnDoor: spawnDoor,
    updateDoors: updateDoors,
    tryInteractDoor: tryInteractDoor,
    isDoorInRange: isDoorInRange,
    clearDoors: clearDoors
  };
})();
