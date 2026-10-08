/* =====================================================================
 * hubNeuKarte.js — der Marktplatz von Fogreach als Kachelkarte (#181)
 * ---------------------------------------------------------------------
 * Reine Daten, keine Phaser-Abhaengigkeit.
 *
 * DIE KARTE IST DIE QUELLE. Bisher standen die Kollisionen in einer von
 * Hand gepflegten Rechteckliste (hubLayout.js) und die Grafik musste sich
 * danach richten — zwei Wahrheiten, die nur zufaellig uebereinstimmten.
 * Daher die Fehlplatzierungen: ein Trog halb in der Kate, ein Marktstand
 * im Nichts. Hier gilt die Karte, und hubNeuWelt leitet die Kollisionen
 * daraus ab. Eine Bank dort, wo man laeuft, ist damit nicht mehr moeglich.
 *
 * Masse: 40x24 Kacheln zu je 32 Weltpixeln = 1280x768. Eine Kachel sind
 * 20 Entwurfseinheiten (Weltpixel / 1.6), damit alles, was schon mit dem
 * SCALE_FACTOR 1536/960 rechnet — HubSceneV2, tutorialOverlay — ohne
 * Aenderung weiterlaeuft.
 *
 * Grundriss: eine Ringstrasse um den Kettenbrunnen, vier Speichen nach
 * Norden (Rathaustreppe), Westen (Werkstatt), Osten (Druckerei) und
 * Sueden (Strasse hinaus). Wer den Ring einmal abgeht, kommt an jeder
 * Tuer und jedem NPC vorbei. Der Rat sitzt auf einer Terrasse: man steigt
 * zu ihm hinauf, und man kommt nur ueber die Freitreppe dorthin.
 *
 * Zeichen:
 *   .  Platte        die gehauenen Steinplatten des Platzes
 *   #  Pflaster      Ringstrasse und Speichen
 *   d  Erde          der getretene Saum zwischen Platz und Gras
 *   g  Gras          Waldrand
 *   T  Terrasse      begehbare Flaeche des Rates (Hoehe +2 Kacheln)
 *   M  Stuetzmauer   die Kante der Terrasse — undurchlaessig
 *   S  Freitreppe    der einzige Weg hinauf
 *   H  Gebaeude      undurchlaessig
 *   B  Brunnenbecken undurchlaessig
 *   x  nichts        hinter der Terrasse: Nebel
 *
 * Stein stoesst nirgends direkt an Gras: dazwischen liegt immer Erde,
 * und fuer jede Grenze gibt es Uebergangskacheln (tools/uebergangBauen.js).
 * ===================================================================== */
(function () {
  'use strict';

  var HUB_NEU_KARTE = {
    kachel: 32,              // Weltpixel je Kachel — wie TILE_PX im Dungeon
    breite: 40,
    hoehe: 24,
    jeKachel: 20,            // Entwurfseinheiten je Kachel (32 / 1.6)

    // Welche Zeichen sind undurchlaessig. Daraus baut hubNeuWelt die
    // Kollisionsflaechen — es gibt keine zweite Liste.
    fest: 'HBMx',

    // Bodenarten je Zeichen. Gezeichnet wird in Schichten: Erde als Grund,
    // darueber Gras und Platte, darueber Pflaster.
    arten: {
      '.': 'platte', '#': 'pflaster', 'd': 'erde', 'g': 'gras',
      'T': 'platte', 'M': 'erde', 'S': 'platte', 'B': 'platte',
      'H': 'erde', 'x': null
    },

    zeilen: [
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'gggggggggggggMTHHHHHHHHHHTMggggggggggggg',
      'gggggggggggggMTHHHHHHHHHHTMggggggggggggg',
      'gggggggggggggMTHHHHHHHHHHTMggggggggggggg',
      'gggggggggggggMTHHHHHHHHHHTMggggggggggggg',
      'gggggggggggggMTTTTSSSSTTTTMggggggggggggg',
      'gggggggggggggMMMMMSSSSMMMMMggggggggggggg',
      'ggdddddddddddMMMMMSSSSMMMMMdddddddddddgg',
      'ggdHHHHH..........####..........HHHHHdgg',
      'ggdHHHHH......#############.....HHHHHdgg',
      'ggdHHHHH......#############.....HHHHHdgg',
      'ggdHHHHH......##.........##.....HHHHHdgg',
      'ggddd###########..BBBBB..###########ddgg',
      'ggddd###########..BBBBB..###########ddgg',
      'ggdddddd......##..BBBBB..##.....ddddddgg',
      'ggdddddd......##.........##.....ddddddgg',
      'ggdddddd......#############.....ddddddgg',
      'ggdHHHHH......#############.....ddddddgg',
      'ggdHHHHH..........###.......HHHHHdddddgg',
      'ggdHHHHHdddddddddd###dddddddHHHHHdddddgg',
      'gggHHHHHdddddddddd###dddddddHHHHHdgggggg',
      'gggddddddddddddddd###dddddddddddddgggggg'
    ],

    // --- Anker: alles in Kachelkoordinaten ------------------------------
    // Tueren sind Rechtecke (x,y = linke obere Ecke, b,h = Groesse), alles
    // andere steht auf einem Fusspunkt (x = Mitte, y = Standlinie).

    tueren: [
      // Oben an der Freitreppe, vor dem Rathausportal.
      { id: 'rathaus_entrance',   x: 18,  y: 6.8,  b: 4,   h: 1.2 },
      { id: 'schmiede_entrance',  x: 4,   y: 13.6, b: 3,   h: 1.3 },
      { id: 'druckerei_entrance', x: 33,  y: 13.6, b: 3,   h: 1.3 },
      // Die Truhe steht neben der Werkstatt, wo Ausruestung hingehoert —
      // und weit genug weg, dass sich die beiden nicht um [E] streiten.
      { id: 'truhe_entrance',     x: 8.2, y: 16.3, b: 2.2, h: 1.4 }
    ],

    // Jeder NPC steht an seiner Funktion, keiner frei auf dem Platz.
    npcs: [
      { id: 'aldric',          x: 24.2, y: 7.75 },  // oben auf der Terrasse, neben dem Portal
      { id: 'klerus_priester', x: 16.6, y: 10.6 },  // am Fuss der Treppe, links
      { id: 'stadtwache',      x: 23.4, y: 10.6 },  // am Fuss der Treppe, rechts
      { id: 'branka',          x: 8.4,  y: 14.9 },  // vor ihrer Esse, nicht neben dem Haus
      { id: 'thom',            x: 31.6, y: 14.9 },  // vor der Druckerei
      { id: 'mara',            x: 11.4, y: 10.5 },  // im Winkel zwischen Wald und Terrasse
      { id: 'harren',          x: 11.5, y: 21.0 },  // abseits, bei den Baenken
      { id: 'buerger',         x: 24.3, y: 21.0 },  // an der Anschlagtafel
      { id: 'elara',           x: 10.4, y: 22.6 }   // am Rand, wenn sie je kommt
    ],

    haeuser: [
      { bild: 'hub_rathaus_sockel', x: 20,   y: 7,  breite: 12,  farbe: 0xa9b2bf },
      { bild: 'hub_werkstatt',      x: 5.5,  y: 14, breite: 7.6 },
      { bild: 'hub_druckerei',      x: 34.5, y: 14, breite: 7.6 },
      { bild: 'hub_kate_a',         x: 30.5, y: 23, breite: 7.2 },
      { bild: 'hub_kate_b',         x: 5.5,  y: 23, breite: 7.2 }
    ],

    // Requisiten stehen mit ihrer HOEHE in Pixeln, wie die Figuren (der
    // Spieler ist 54). Die Breite war das falsche Mass: bei schraeg
    // gezeichneten Objekten sagt sie wenig ueber die sichtbare Masse, und
    // so kam eine Bank hoeher heraus als ein Mensch. Nur der Brunnen fuellt
    // sein Becken und steht darum ueber die Breite (in Kacheln).
    requisiten: [
      { bild: 'hub_brunnen', x: 20.5, y: 17.0, breite: 5.0 },
      // Auf der Galerie: das Portal flankiert, die Statue des Rates daneben.
      { bild: 'hub_statue',  x: 15.6, y: 7.75, hoehe: 88 },
      { bild: 'hub_laterne', x: 17.4, y: 7.75, hoehe: 40 },
      { bild: 'hub_laterne', x: 22.6, y: 7.75, hoehe: 40, spiegeln: true },
      // Am Fuss der Mauer, links der Treppe: die Verlautbarungen des Rates.
      { bild: 'hub_tafel',   x: 14.4, y: 10.7, hoehe: 60 },
      // Die Ecken der Ringstrasse.
      { bild: 'hub_laterne', x: 12.6, y: 11.0, hoehe: 40 },
      { bild: 'hub_laterne', x: 27.4, y: 10.8, hoehe: 40, spiegeln: true },
      { bild: 'hub_laterne', x: 13.6, y: 20.4, hoehe: 40 },
      // Westen arbeitet: vor der Werkstatt, nicht neben ihr.
      { bild: 'hub_fass',    x: 2.7,  y: 15.0, hoehe: 32 },
      { bild: 'hub_holz',    x: 3.8,  y: 15.3, hoehe: 26 },
      { bild: 'hub_karren',  x: 11.0, y: 17.6, hoehe: 36 },
      // Osten ist Amt: Kisten mit Papier vor der Druckerei.
      { bild: 'hub_kisten',  x: 37.0, y: 15.0, hoehe: 40 },
      // Sueden ist arm.
      { bild: 'hub_stand',   x: 22.4, y: 20.6, hoehe: 74 },
      { bild: 'hub_tafel',   x: 25.6, y: 20.6, hoehe: 60, spiegeln: true },
      { bild: 'hub_bank',    x: 10.6, y: 20.3, hoehe: 30 },
      { bild: 'hub_bank',    x: 12.8, y: 20.3, hoehe: 30, spiegeln: true },
      { bild: 'hub_trog',    x: 36.0, y: 18.2, hoehe: 24 },
      { bild: 'hub_schild',  x: 21.8, y: 22.4, hoehe: 64 },
      { bild: 'hub_schutt',  x: 14.5, y: 22.4, hoehe: 24 }
    ],

    // Die Terrasse: Kante und Treppe werden als Bilder darueber gelegt.
    // h zaehlt die beiden Mauerzeilen mit. Die Treppe fuellt die Luecke in
    // der Mauer; links und rechts davon steht je ein Mauerstueck.
    terrasse: { x: 13, y: 3, b: 14, h: 7, treppeX: 18, treppeB: 4 }
  };

  if (typeof window !== 'undefined') window.HUB_NEU_KARTE = HUB_NEU_KARTE;
  if (typeof module !== 'undefined' && module.exports) module.exports = HUB_NEU_KARTE;
})();
