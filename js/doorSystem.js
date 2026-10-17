// js/doorSystem.js — Door sprite system for Fogreach
// Spawns door sprites at procedural room doorway positions.
// Doors auto-open when the player approaches and auto-close when they leave.

(function () {
  'use strict';

  // ─── Texture generation ───────────────────────────────────────────────────

  // Cache of generated texture keys by size: 'proc_door_closed_WxH' → true
  var generatedTextures = {};

  /**
   * Generate a procedural door texture at a given pixel size.
   * Textures are cached by dimension so we only generate once per unique size.
   *
   * @param {Phaser.Scene} scene
   * @param {number} W  pixel width
   * @param {number} H  pixel height
   * @returns {{ closedKey: string, openKey: string }}
   */
  function generateDoorTextures(scene, W, H) {
    W = W || 32;
    H = H || 48;

    var closedKey = 'proc_door_closed_' + W + 'x' + H;
    var openKey   = 'proc_door_open_' + W + 'x' + H;

    // ── proc_door_closed ──────────────────────────────────────────────────
    if (!generatedTextures[closedKey]) {
      var canvasClosed = scene.textures.createCanvas(closedKey, W, H);
      var ctx = canvasClosed.getContext('2d');

      // Wooden base
      ctx.fillStyle = '#5a3d1f';
      ctx.fillRect(0, 0, W, H);

      // Wood grain lines (evenly spaced)
      ctx.strokeStyle = '#4a3218';
      ctx.lineWidth = 1;
      var grainSpacing = Math.max(8, Math.floor(W / 4));
      for (var gx = grainSpacing; gx < W; gx += grainSpacing) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }

      // Light highlight on left edge
      ctx.fillStyle = '#7a5a35';
      ctx.fillRect(0, 0, 2, H);

      // Iron band top
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 4, W, 5);
      // Iron band rivets
      ctx.fillStyle = '#3a3a3a';
      for (var rx = 3; rx < W - 3; rx += Math.max(10, Math.floor(W / 3))) {
        ctx.fillRect(rx, 5, 3, 3);
      }

      // Iron band bottom
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, H - 9, W, 5);
      ctx.fillStyle = '#3a3a3a';
      for (var rx2 = 3; rx2 < W - 3; rx2 += Math.max(10, Math.floor(W / 3))) {
        ctx.fillRect(rx2, H - 8, 3, 3);
      }

      // Iron band middle
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, Math.floor(H / 2) - 2, W, 4);

      // Handle (right side, vertically centered)
      var hx = W - 7, hy = Math.floor(H / 2) - 4;
      ctx.fillStyle = '#888';
      ctx.fillRect(hx, hy, 4, 8);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(hx + 1, hy + 1, 2, 6);

      // Dark border / frame
      ctx.strokeStyle = '#1a1005';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      canvasClosed.refresh();
      generatedTextures[closedKey] = true;
    }

    // ── proc_door_open ────────────────────────────────────────────────────
    if (!generatedTextures[openKey]) {
      var canvasOpen = scene.textures.createCanvas(openKey, W, H);
      var ctxO = canvasOpen.getContext('2d');

      // Dim background representing the gap/opening (darkened passage)
      ctxO.fillStyle = '#1a1005';
      ctxO.fillRect(0, 0, W, H);

      // Door panel receded to one side (right-hand side, narrower)
      var panelW = Math.max(8, Math.floor(W * 0.25));
      var panelX = W - panelW;
      ctxO.fillStyle = '#3d2a14';
      ctxO.fillRect(panelX, 0, panelW, H);

      // Foreshortened wood lines on the receded panel
      ctxO.strokeStyle = '#2a1c0e';
      ctxO.lineWidth = 1;
      ctxO.beginPath(); ctxO.moveTo(panelX + Math.floor(panelW * 0.4), 0);
      ctxO.lineTo(panelX + Math.floor(panelW * 0.4), H); ctxO.stroke();

      // Iron band top on receded panel
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, 4, panelW, 4);

      // Iron band bottom
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, H - 8, panelW, 4);

      // Opening glow
      var grad = ctxO.createLinearGradient(0, 0, panelX, 0);
      grad.addColorStop(0, 'rgba(90, 60, 20, 0.15)');
      grad.addColorStop(1, 'rgba(90, 60, 20, 0)');
      ctxO.fillStyle = grad;
      ctxO.fillRect(0, 0, panelX, H);

      // Dark frame border
      ctxO.strokeStyle = '#0a0805';
      ctxO.lineWidth = 1;
      ctxO.strokeRect(0.5, 0.5, W - 1, H - 1);

      canvasOpen.refresh();
      generatedTextures[openKey] = true;
    }

    return { closedKey: closedKey, openKey: openKey };
  }

  // ─── Die neuen Tore (Vorschau ?debug=1&tueren=neu) ────────────────────────
  //
  // Schweres Eichentor mit Messingbaendern und Kette zwischen zwei Steinpfosten,
  // Pixelbild aus PixelLab (tools/tuerenBauen.js). Von vorn fuer waagerechte
  // Waende, von der Seite fuer senkrechte. Das Tor fuellt die ganze Wandtiefe
  // (64 px); der Koerper bleibt der alte 24 px-Riegel — Kollision, Sicht und
  // Durchgang verhalten sich genau wie bei der gezeichneten Tuer.
  //
  // Ein Tor ist 4-6 Kacheln lang. Gestreckt wird nichts: es wird aus Stuecken
  // zusammengesetzt (Anfang | Fuellung* | Mitte | Fuellung* | Ende) und je
  // Laenge und Richtung EINMAL als Textur mit vier Bildern abgelegt —
  // Bild 0 zu, 1-2 halb, 3 offen (Fluegel an die Pfosten geklappt, dazwischen
  // ist der Boden zu sehen).
  //
  // Fehlen die Bilder, gibt es KEINEN Rueckgriff auf die alte Zeichnung: das
  // Tor zeigt dann Phasers Fehlbild, damit es auffaellt.

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

  function neueTore() {
    return !!(window.DebugGate && typeof window.DebugGate.flagge === 'function'
      && window.DebugGate.flagge('tueren') === 'neu');
  }

  function torTeilKey(art, teil) { return 'tor_' + art.name + '_' + teil; }

  /** Laedt die Torstuecke in preload der Kellerszene (nur mit Vorschau-Flagge). */
  function bilderVorladen(scene) {
    if (!neueTore() || !scene || !scene.load || !scene.textures) return;
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
   * @param {number} [tint]  Wandfarbe des Raums; nur die neuen Tore nehmen sie an
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

    // Generate textures sized to the doorway
    // For horizontal doorways (wall runs left-right): door spans X, thin in Y
    // For vertical doorways (wall runs up-down): door spans Y, thin in X
    var texW, texH;
    if (orientation === 'horizontal') {
      texW = doorWidthPx;
      texH = doorThickness;
    } else {
      texW = doorThickness;
      texH = doorWidthPx;
    }

    var neu = neueTore();
    var keys;
    if (neu) {
      var torKey = torTextur(scene, orientation, doorWidthPx) || '__MISSING';
      keys = { closedKey: torKey, openKey: torKey };
    } else {
      keys = generateDoorTextures(scene, texW, texH);
    }

    // Create a static physics sprite in the door group (separate from obstacles)
    var door = neu && keys.closedKey !== '__MISSING'
      ? doorGroup.create(x, y, keys.closedKey, 0)
      : doorGroup.create(x, y, keys.closedKey);
    if (!door) return null;

    door.setOrigin(0.5, 0.5);
    // Eine Tuer ist hohe Architektur wie Statue und Saeule: sie steht aufrecht
    // im Rahmen und darf von keinem Prop geschnitten werden.
    door.setDepth(window.WELT_TIEFEN.PROP_HOCH);
    // Nicht nach Bildhoehe sortiert (#165): geschlossen ist der Koerper genau
    // das Bild, der Spieler kommt nie dahinter. Offen fuellt das Bild den
    // Durchgang mit dunklem Boden; angehoben laege dieses Rechteck ueber den
    // Beinen des Spielers, waehrend die Wand daneben (39) unter ihm bleibt.

    // Set the physics body to match the texture size exactly (no rotation needed)
    if (door.body && !neu) {
      door.body.setSize(texW, texH);
      door.body.setOffset(
        (door.width - texW) / 2,
        (door.height - texH) / 2
      );
    }

    door.setData('isDoor', true);
    door.setData('doorState', 'closed');
    door.setData('orientation', orientation);
    door.setData('closedKey', keys.closedKey);
    door.setData('openKey', keys.openKey);
    door.setData('walkthrough', false);
    door.setData('neu', neu);

    door.refreshBody();
    if (neu && door.body) {
      // refreshBody nimmt die Bildgroesse (64 tief). Der Koerper bleibt der
      // alte Riegel, mittig im Tor — sonst haelt die Tuer den Spieler schon
      // 20 px vor der Wandflucht auf und verdeckt mehr Sicht als vorher.
      door.body.setSize(texW, texH, false);
      door.body.setOffset((door.displayWidth - texW) / 2, (door.displayHeight - texH) / 2);
      // Das Tor nimmt die Wandfarbe des Raumthemas an (gefroren, bemoost, blutig…).
      if (tint) door.setTint(tint);
    }

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
    var state = door.getData('doorState');
    if (door.getData('neu')) {
      // Zustand und Koerper wechseln sofort wie bei der alten Tuer; nur das
      // Bild klappt in ~0,2 s nach.
      var auf = state === 'closed';
      var anim = door.texture.key + (auf ? '_auf' : '_zu');
      if (door.anims && door.scene && door.scene.anims && door.scene.anims.exists(anim)) door.play(anim);
      door.setData('doorState', auf ? 'open' : 'closed');
      door.setData('walkthrough', auf);
    } else if (state === 'closed') {
      door.setTexture(door.getData('openKey'));
      door.setData('doorState', 'open');
      door.setData('walkthrough', true);
    } else {
      door.setTexture(door.getData('closedKey'));
      door.setData('doorState', 'closed');
      door.setData('walkthrough', false);
    }
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
    generateDoorTextures: generateDoorTextures,
    bilderVorladen: bilderVorladen,
    torTextur: torTextur,
    spawnDoor: spawnDoor,
    updateDoors: updateDoors,
    tryInteractDoor: tryInteractDoor,
    isDoorInRange: isDoorInRange,
    clearDoors: clearDoors
  };
})();
