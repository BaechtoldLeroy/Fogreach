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
      'ggddddddddddddddddSSSSddddddddddddddddgg',
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
      { id: 'aldric',          x: 23.2, y: 7.9 },   // oben auf der Terrasse
      { id: 'klerus_priester', x: 16.6, y: 10.6 },  // am Fuss der Treppe, links
      { id: 'stadtwache',      x: 23.4, y: 10.6 },  // am Fuss der Treppe, rechts
      { id: 'branka',          x: 8.6,  y: 13.6 },  // an ihrer Essentuer
      { id: 'thom',            x: 31.4, y: 13.6 },  // unter der Druckerei
      { id: 'mara',            x: 8.6,  y: 10.8 },  // im Schatten neben der Werkstatt
      { id: 'harren',          x: 11.5, y: 21.0 },  // abseits, bei den Baenken
      { id: 'buerger',         x: 25.2, y: 20.9 },  // an der Anschlagtafel
      { id: 'elara',           x: 9.2,  y: 22.4 }   // am Rand, wenn sie je kommt
    ],

    haeuser: [
      { bild: 'hub_rathaus_sockel', x: 20,   y: 7,  breite: 11,  farbe: 0x99a3b1 },
      { bild: 'hub_werkstatt',      x: 5.5,  y: 14, breite: 7.6 },
      { bild: 'hub_druckerei',      x: 34.5, y: 14, breite: 7.6 },
      { bild: 'hub_kate_a',         x: 30.5, y: 23, breite: 7.2 },
      { bild: 'hub_kate_b',         x: 5.5,  y: 23, breite: 7.2 }
    ],

    requisiten: [
      { bild: 'hub_brunnen', x: 20.5, y: 17.0, breite: 6.0 },
      { bild: 'hub_statue',  x: 15.6, y: 7.9,  breite: 1.5 },
      { bild: 'hub_kuebel',  x: 17.3, y: 7.9,  breite: 1.3 },
      { bild: 'hub_kuebel',  x: 22.7, y: 7.9,  breite: 1.3, spiegeln: true },
      { bild: 'hub_tafel',   x: 15.3, y: 9.7,  breite: 2.1 },
      { bild: 'hub_tafel',   x: 26.6, y: 20.6, breite: 2.1, spiegeln: true },
      { bild: 'hub_laterne', x: 13.6, y: 10.8, breite: 1.1 },
      { bild: 'hub_laterne', x: 27.4, y: 10.8, breite: 1.1, spiegeln: true },
      { bild: 'hub_laterne', x: 13.6, y: 20.4, breite: 1.1 },
      { bild: 'hub_laterne', x: 27.4, y: 20.4, breite: 1.1, spiegeln: true },
      { bild: 'hub_fass',    x: 8.5,  y: 12.2, breite: 1.4 },
      { bild: 'hub_holz',    x: 8.5,  y: 11.2, breite: 1.9 },
      { bild: 'hub_kisten',  x: 31.4, y: 12.2, breite: 2.0 },
      { bild: 'hub_karren',  x: 6.5,  y: 17.2, breite: 2.3 },
      { bild: 'hub_stand',   x: 22.4, y: 20.6, breite: 2.6 },
      { bild: 'hub_bank',    x: 10.6, y: 20.3, breite: 2.1 },
      { bild: 'hub_bank',    x: 12.8, y: 20.3, breite: 2.1, spiegeln: true },
      { bild: 'hub_trog',    x: 34.5, y: 18.2, breite: 2.2 },
      { bild: 'hub_schild',  x: 21.8, y: 22.4, breite: 1.3 },
      { bild: 'hub_schutt',  x: 14.5, y: 22.4, breite: 2.2 }
    ],

    // Die Terrasse: Kante und Treppe werden als Bilder darueber gelegt.
    terrasse: { x: 13, y: 3, b: 14, h: 6, treppeX: 18, treppeB: 4 }
  };

  if (typeof window !== 'undefined') window.HUB_NEU_KARTE = HUB_NEU_KARTE;
  if (typeof module !== 'undefined' && module.exports) module.exports = HUB_NEU_KARTE;
})();
