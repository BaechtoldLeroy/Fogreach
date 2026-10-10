/**
 * js/bodenDeko.js — Boden-Deko je Raumthema (#184), nur mit ?boden=neu.
 *
 * Bisher liegen in jedem Raum dieselben Risse und Flecken (floor_crack0..7,
 * floor_stain0..7). Die bleiben. DAZU kommt hier, was zum Raum passt: in der
 * Krypta Knochen und Asche, im Keller Schlamm und Moos, in der Ritualebene
 * Blut und Salz.
 *
 * Alles ist reine Optik: Bilder ohne Koerper, ganz unten in der Zeichenfolge
 * (dieselbe Tiefe wie die Risse), als Boden markiert, damit die Treppensuche
 * sie nicht fuer Hindernisse haelt. Tueren und Spawn bleiben frei; was nach
 * dem Setzen der Treppe unter ihr liegt, raeumt treppenFrei weg.
 *
 * Alle Bilder liegen in EINER Tafel (assets/tiles/bodendeko_atlas.png, eine
 * Zeile je Art, 32x32 je Bild) — gebaut von tools/bodenDekoBauen.js.
 */
(function () {
  var ATLAS = 'bodendeko_atlas';
  var DATEI = 'assets/tiles/bodendeko_atlas.png';
  var FELD = 32;
  var SPALTEN = 4;

  // Reihenfolge = Zeile in der Tafel. Muss zu tools/bodenDekoBauen.js passen.
  var ARTEN = [
    'knochen', 'asche', 'kreide', 'fliesen', 'wachs', 'pergament', 'blaetter', 'schlamm',
    'moos', 'pfuetze', 'kette', 'blut', 'brand', 'salz', 'reif', 'stroh'
  ];

  // Je Raumthema fuenf oder sechs Arten. Die Themen kommen aus proceduralRooms.js
  // (tpl.theme.id); die festen Vorlagen werden unten zugeordnet.
  var THEMEN = {
    crypt:        ['knochen', 'asche', 'kreide', 'wachs', 'kette'],
    cathedral:    ['fliesen', 'wachs', 'pergament', 'blaetter', 'kreide'],
    archiv:       ['pergament', 'wachs', 'fliesen', 'kreide', 'asche'],
    sewer:        ['schlamm', 'moos', 'pfuetze', 'kette', 'stroh'],
    // Der Keller ist das haeufigste Thema (Rathauskeller, alle schlichten
    // Vorlagen) — darum eine Art mehr.
    dungeon:      ['kette', 'stroh', 'pfuetze', 'knochen', 'pergament', 'wachs'],
    overgrown:    ['moos', 'blaetter', 'schlamm', 'pfuetze', 'stroh'],
    bloodstained: ['blut', 'brand', 'salz', 'knochen', 'kette'],
    frozen:       ['reif', 'pfuetze', 'knochen', 'kette', 'asche']
  };

  // Feste Raumvorlagen (js/roomTemplates/*.json und ROOM_THEMES) -> Thema,
  // nach dem, was der Name verspricht. Die uebrigen gehen nach Boden und Gebiet.
  var VORLAGEN = {
    Crypt_Small_Altar: 'crypt', ForgottenCrypt: 'crypt',
    Cathedral: 'cathedral', ThroneRoom: 'cathedral', CouncilChamber: 'cathedral', CirclePillars: 'cathedral',
    DungeonLibrary: 'archiv', RathausArchive: 'archiv', SealedArchive: 'archiv',
    ElarasVersteck: 'archiv', InformantDen: 'archiv',
    RitualVault: 'bloodstained', RitualChamber: 'bloodstained', DieQuelle: 'bloodstained',
    SewageTunnel: 'sewer', BridgeOverGap: 'sewer',
    CelestialGardens: 'overgrown',
    PrisonCells: 'dungeon', PrisonDepths: 'dungeon', ArmoryVault: 'dungeon', CouncilWarehouse: 'dungeon',
    TreasureVault: 'dungeon', Treasure_Small: 'dungeon', GrandBazaar: 'dungeon'
  };

  // Bodenkachel -> Thema, fuer Vorlagen ohne sprechenden Namen.
  var BOEDEN = { floor_stone_dark: 'crypt', floor_tile_ornate: 'cathedral', floor_cobble: 'sewer' };

  // Arten, deren Bilder schraeg von vorn gezeichnet sind (Kerzenstummel,
  // Schaedel): nur spiegeln, nicht drehen.
  var AUFRECHT = { wachs: 1, knochen: 1 };

  // Abstand zur Treppenmitte, unter dem Deko weichen muss. Die Treppe ist
  // rund 80 px hoch und 60 px breit; dieselbe Zahl wie STAIR_HALF.
  var TREPPEN_FREIRAUM = 44;
  // Und zu jeder Tuer zwei Kacheln (wie beim Streuen ueber tpl.entrances).
  var TUER_FREIRAUM = 64;

  function an(scene) {
    if (!(window.DebugGate && window.DebugGate.an('boden'))) return false;
    return !!(scene && scene.textures && scene.textures.exists(ATLAS));
  }

  /**
   * Das Thema eines Raums — nie leer, Vorgabe ist der Keller.
   *
   * Reihenfolge: eigenes Thema (prozedurale Raeume) > Name der Vorlage >
   * Ritualebene > Bodenkachel > Katakomben > Keller. Die Ritualebene schlaegt
   * den Boden, weil dort ALLES dem Rat dient; die Katakomben nicht, weil eine
   * Kathedrale auch in der Tiefe eine Kathedrale bleibt.
   *
   * @param {object} tpl Raumvorlage
   * @param {{boden?: string, tiefe?: number, akt?: number}} [kontext]
   */
  function thema(tpl, kontext) {
    var k = kontext || {};
    var id = tpl && tpl.theme && tpl.theme.id;
    if (id && THEMEN[id]) return id;
    var name = (tpl && tpl.name) || '';
    if (VORLAGEN[name]) return VORLAGEN[name];
    // Dieselben Schwellen wie gebietsName in roomManager.js.
    var tiefe = Number(k.tiefe) || 1, akt = Number(k.akt) || 0;
    if (tiefe >= 20 && akt >= 3) return 'bloodstained';
    if (k.boden && BOEDEN[k.boden]) return BOEDEN[k.boden];
    if (tiefe >= 10 && akt >= 2) return 'crypt';
    return 'dungeon';
  }

  /** Bildnummer in der Tafel fuer Art und Variante. */
  function bild(art, variante) {
    return ARTEN.indexOf(art) * SPALTEN + (variante % SPALTEN);
  }

  /**
   * Streut die Deko in einen gerade gebauten Raum.
   *
   * @param {Phaser.Scene} scene
   * @param {object} r Raumdaten aus applyRoomTemplate:
   *   tpl, W, H, T, ox, oy, istBegehbar(tx,ty), boden (Bodenkachel),
   *   tint (Bodentoenung oder null),
   *   ablage (Array, in das die Bilder zum Aufraeumen beim Raumwechsel kommen)
   * @returns {Array} die gesetzten Bilder (leer ohne Flagge)
   */
  function streuen(scene, r) {
    scene._bodenDeko = [];
    if (!an(scene) || !r || !r.tpl) return scene._bodenDeko;
    var akt = 0;
    try { akt = window.storySystem.getCurrentActIndex(); } catch (e) {}
    var arten = THEMEN[thema(r.tpl, { boden: r.boden, tiefe: window.DUNGEON_DEPTH, akt: akt })];
    var W = r.W, H = r.H, T = r.T;

    // Tueren und Spawn freihalten — mit zwei Kacheln Rand, damit an einem
    // Durchgang nichts den Blick auf den Weg verstellt.
    var frei = {};
    var halte = function (x, y, rad) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      for (var dy = -rad; dy <= rad; dy++) {
        for (var dx = -rad; dx <= rad; dx++) frei[(Math.round(x) + dx) + '|' + (Math.round(y) + dy)] = 1;
      }
    };
    (r.tpl.entrances || []).forEach(function (e) { halte(e.x, e.y, 2); });
    if (r.tpl.spawns && r.tpl.spawns.player) halte(r.tpl.spawns.player.x, r.tpl.spawns.player.y, 1);

    // Mit der Raumgroesse mitwachsen: ein 80er-Saal mit zehn Stuecken wirkt
    // leer, ein Kaemmerchen mit dreissig zugemuellt.
    var ziel = Math.max(6, Math.min(36, Math.round((W * H) / 40)));
    var belegt = {};
    for (var versuch = 0; versuch < ziel * 4 && scene._bodenDeko.length < ziel; versuch++) {
      var tx = 2 + Math.floor(Math.random() * Math.max(1, W - 4));
      var ty = 2 + Math.floor(Math.random() * Math.max(1, H - 4));
      var k = tx + '|' + ty;
      if (belegt[k] || frei[k] || !r.istBegehbar(tx, ty)) continue;
      belegt[k] = 1;
      var art = arten[Math.floor(Math.random() * arten.length)];
      // Etwas aus der Kachelmitte geschoben, sonst liegt alles im Raster.
      var px = r.ox + tx * T + T / 2 + Math.round((Math.random() - 0.5) * T * 0.4);
      var py = r.oy + ty * T + T / 2 + Math.round((Math.random() - 0.5) * T * 0.4);
      var img = scene.add.image(px, py, ATLAS, bild(art, Math.floor(Math.random() * SPALTEN)));
      img.setDepth(-4);
      // Nur rechte Winkel: frei gedrehte Pixelgrafik franst aus. Kerzen und
      // Schaedel stehen im Bild aufrecht — gedreht laegen sie auf der Seite.
      if (!AUFRECHT[art]) img.setAngle(90 * Math.floor(Math.random() * 4));
      img.setFlipX(Math.random() < 0.5);
      img.setAlpha(0.7 + Math.random() * 0.25);
      if (r.tint) img.setTint(r.tint);
      img.setData('isFloor', true);      // fuer die Treppensuche kein Hindernis
      img.setData('bodenDeko', art);
      scene._bodenDeko.push(img);
      if (r.ablage) r.ablage.push(img);
    }
    return scene._bodenDeko;
  }

  /**
   * Nach dem Setzen der Treppen: was darunter liegt, verschwindet. Die
   * Treppe ist leicht durchscheinend; ein Knochen darunter saehe aus wie ein
   * Loch in der Stufe.
   *
   * Ebenso an den Tueren: tpl.entrances, die streuen kennt, sind nicht alle
   * Tueren des Raums — roomManager legt eigene an (builtMeta.doors, stehende
   * Tueren, eine Ersatztuer). Erst hier steht die vollstaendige Liste fest.
   */
  function treppenFrei(scene) {
    var liste = scene && scene._bodenDeko;
    if (!liste || !liste.length || !scene.stairsGroup) return 0;
    var treppen = scene.stairsGroup.getChildren ? scene.stairsGroup.getChildren() : [];
    var tueren = Array.isArray(scene.__treppenTuerListe) ? scene.__treppenTuerListe : [];
    var frei = [];
    treppen.forEach(function (t) { frei.push({ x: t.x, y: t.y, r: TREPPEN_FREIRAUM }); });
    tueren.forEach(function (t) { if (t) frei.push({ x: t.x, y: t.y, r: TUER_FREIRAUM }); });
    var weg = 0;
    for (var i = liste.length - 1; i >= 0; i--) {
      var d = liste[i];
      if (!d || !d.active) continue;
      for (var j = 0; j < frei.length; j++) {
        var t = frei[j];
        if (Math.abs(d.x - t.x) < t.r && Math.abs(d.y - t.y) < t.r) {
          d.destroy();
          liste.splice(i, 1);
          weg++;
          break;
        }
      }
    }
    return weg;
  }

  /** In preload: die Tafel nur laden, wenn die Flagge gesetzt ist. */
  function vorladen(scene) {
    if (!(window.DebugGate && window.DebugGate.an('boden'))) return;
    if (!scene || !scene.load || scene.textures.exists(ATLAS)) return;
    scene.load.spritesheet(ATLAS, DATEI, { frameWidth: FELD, frameHeight: FELD });
  }

  window.BodenDeko = {
    ATLAS: ATLAS, ARTEN: ARTEN, THEMEN: THEMEN, SPALTEN: SPALTEN,
    an: an, thema: thema, streuen: streuen, treppenFrei: treppenFrei, vorladen: vorladen
  };
})();
