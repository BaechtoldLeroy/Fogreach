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
 *   R  Rathaus       undurchlaessig, Wiese darunter
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
    fest: 'HRBMxgh',

    // Bodenarten je Zeichen. Gezeichnet wird in Schichten: Erde als Grund,
    // darueber Gras und Platte, darueber Pflaster.
    arten: {
      '.': 'platte', '#': 'pflaster', 'd': 'erde', 'g': 'gras',
      'T': 'platte', 'M': 'erde', 'S': 'platte', 'B': 'platte',
      'H': 'erde', 'h': 'erde', 'x': null,
      // Unter dem Rathaus liegt Wiese: an seiner schraegen Sockel-Ecke sieht
      // man den Boden, und dort war es grauer Stein.
      'R': 'gras'
    },

    zeilen: [
'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'gggggggggggggggRRRRRRRRRRggggggggggggggg',
      'gggggggggggggggRRRRRRRRRRggggggggggggggg',
      'gggggggggggggggRRRRRRRRRRggggggggggggggg',
      'gggggggggggggggTTTTTTTTTTggggggggggggggg',
      'gggggggggggggggTTTTTTTTTTggggggggggggggg',
      'gggggggggggggggTTTTTTTTTTggggggggggggggg',
      'gggggggggggggMMMMMSSSSMMMMMggggggggggggg',
      'gghhhhhhhddddMMMMMSSSSMMMMMddddhhhhhhhgg',
      'gghHHHHHh.........####.........hHHHHHhgg',
      'gghHHHHHh.....#############....hHHHHHhgg',
      'gghHHHHHh.....#############....hHHHHHhgg',
      'gghHHHHHh.....##.........##....hHHHHHhgg',
      'ggddd###########..BBBBB..###########ddgg',
      'ggddd###########..BBBBB..###########ddgg',
      'ggdddddd......##..BBBBB..##.....ddddddgg',
      'gghhhhhhh.....##.........##hhhhhhhddddgg',
      'gghhhhhhh.....#############hhhhhhhddddgg',
      'gghHHHHHh.....#############hhhhhhhddddgg',
      'gghHHHHHh.........###......hHHHHHhddddgg',
      'gghHHHHHhddddddddd###ddddddhHHHHHhddddgg',
      'gghHHHHHhddddddddd###ddddddhHHHHHhgggggg',
      'ggdddddddddddddddd###dddddddddddddgggggg'
    ],

    // --- Anker: alles in Kachelkoordinaten ------------------------------
    // Tueren sind Rechtecke (x,y = linke obere Ecke, b,h = Groesse), alles
    // andere steht auf einem Fusspunkt (x = Mitte, y = Standlinie).
    //
    // Der Spielerkoerper ist 34x56 — so hoch wie die Figur. Wer von Sueden
    // an eine Wand laeuft, stoppt mit dem KOPF an ihr, die Fuesse stehen
    // 56 px davor. Darum reichen Tueren bis weit unter die Wand, und darum
    // ist der Vorplatz drei Kacheln tief: bei einer (32 px) passte der
    // Koerper nicht hinein, und Aldric war unerreichbar.

    tueren: [
      // Vor dem Rathausportal, auf dem Vorplatz.
      { id: 'rathaus_entrance',   x: 18,  y: 5.1,  b: 4,   h: 2.4 },
      { id: 'schmiede_entrance',  x: 4,   y: 13.6, b: 3,   h: 1.3 },
      { id: 'druckerei_entrance', x: 33,  y: 13.6, b: 3,   h: 1.3 },
      // Neben der Werkstatt, ausserhalb des Hinterhofs der linken Kate.
      { id: 'truhe_entrance',     x: 9.4, y: 16.0, b: 1.8, h: 1.4 }
    ],

    // Jeder NPC steht an seiner Funktion — und VOR dem Haus, zu dem er
    // gehoert, nie daneben: ein Haus in Schraegsicht ragt seitlich ueber
    // seine Grundflaeche hinaus, und wer dort steht, verschwindet dahinter.
    npcs: [
      { id: 'aldric',          x: 23.4, y: 7.1 },   // auf dem Vorplatz des Rates
      { id: 'klerus_priester', x: 16.8, y: 10.9 },  // am Fuss der Treppe, links
      { id: 'stadtwache',      x: 23.2, y: 10.9 },  // am Fuss der Treppe, rechts
      { id: 'branka',          x: 8.6,  y: 14.3 },  // an der Hauswand, nicht im Gang
      { id: 'thom',            x: 31.4, y: 14.3 },  // an der Hauswand, nicht im Gang
      { id: 'mara',            x: 11.4, y: 10.5 },  // im Winkel zwischen Wald und Terrasse
      { id: 'harren',          x: 11.6, y: 21.1 },  // abseits, bei den Baenken
      { id: 'buerger',         x: 24.3, y: 21.0 },  // beim Marktstand
      { id: 'elara',           x: 10.4, y: 22.6 }   // am Rand, wenn sie je kommt
    ],

    // Die beiden Anschlagtafeln des Rates. Sie gehoeren zur Phasen-
    // Darstellung (frisch / verblichen / abgerissen / gedruckt) und sind
    // ansprechbar — darum keine Requisiten, sondern eigene Anker. "Vor dem
    // Rathaus", wie die Edikt-Quest sagt: an der Mauer, links und rechts
    // der Treppe. Vorher standen sie auf den alten Koordinaten und landeten
    // hinter dem Brunnen.
    anschlagtafeln: [
      { x: 14.7, y: 10.9 },
      { x: 25.3, y: 10.9 }
    ],

    haeuser: [
      { bild: 'hub_rathaus_sockel', x: 20,   y: 5,  breite: 12,  farbe: 0xa9b2bf },
      { bild: 'hub_werkstatt',      x: 5.5,  y: 14, breite: 7.6 },
      { bild: 'hub_druckerei',      x: 34.5, y: 14, breite: 7.6 },
      { bild: 'hub_kate_a',         x: 30.5, y: 23, breite: 5.5 },
      { bild: 'hub_kate_b',         x: 5.5,  y: 23, breite: 6.0 }
    ],

    // Requisiten stehen mit ihrer HOEHE in Pixeln, wie die Figuren (der
    // Spieler ist 54). Nur der Brunnen fuellt sein Becken und steht ueber
    // die Breite in Kacheln.
    //   fest:  Breite eines Fuss-Colliders in Kacheln. Ohne ihn laeuft man
    //          durch Baenke und Faesser — und steht dann je nach Seite
    //          davor oder dahinter, was nach Fehler aussieht.
    //   boden: liegt flach auf dem Boden (Schutt) und wird nie ueber eine
    //          Figur gezeichnet.
    //   licht: flackernder Schein; Zahl = Hoehe der Flamme als Anteil von
    //          oben am Bild.
    //   anim:  wird als Animation abgespielt.
    requisiten: [
      { bild: 'hub_kettenbrunnen', x: 20.5, y: 17.1, breite: 5.4, anim: 'brunnen' },

      // Der Vorplatz des Rates: Feuerkoerbe am Portal, Banner zu beiden
      // Seiten des Portals und die Statue an der Kante.
      { bild: 'brazier0',      x: 17.0, y: 5.7,  hoehe: 44, anim: 'feuer', licht: 0.35, fest: 0.8 },
      { bild: 'brazier0',      x: 23.0, y: 5.7,  hoehe: 44, anim: 'feuer', licht: 0.35, fest: 0.8, spiegeln: true },
      { bild: 'hub_banner',    x: 15.6, y: 5.05, hoehe: 96 },
      { bild: 'hub_banner',    x: 24.4, y: 5.05, hoehe: 96, spiegeln: true },
      { bild: 'hub_statue',    x: 16.2, y: 7.9,  hoehe: 88, fest: 0.9 },

      // Die Mauer endet nicht im Nichts: ein Pfeiler an jedem Ende, im Stil
      // der Mauer selbst (mit ihr als Vorlage erzeugt). Der erste war hell
      // und anders gemauert und passte nicht.
      { bild: 'hub_mauerende', x: 13.0, y: 10.0, hoehe: 74 },
      { bild: 'hub_mauerende', x: 27.0, y: 10.0, hoehe: 74 },

      // Strassenlaternen an den Ecken der Ringstrasse.
      { bild: 'hub_laternenpfahl',   x: 12.4, y: 10.6, hoehe: 104, fest: 0.5, licht: 0.12 },
      { bild: 'hub_laternenpfahl_b', x: 27.6, y: 10.6, hoehe: 104, fest: 0.5, licht: 0.12 },
      { bild: 'hub_laternenpfahl',   x: 13.9, y: 20.5, hoehe: 104, fest: 0.5, licht: 0.12, spiegeln: true },

      // Westen arbeitet: vor der Werkstatt, nicht neben ihr.
      { bild: 'hub_fass',      x: 2.7,  y: 15.0, hoehe: 32, fest: 0.9 },
      { bild: 'hub_holz',      x: 3.8,  y: 15.3, hoehe: 26, fest: 1.4 },
      // Der Karren steht bei der Werkstatt. Unten bei den Baenken schloss er
      // mit Kate, Harren und Laterne Elaras Ecke ein.
      { bild: 'hub_karren',    x: 5.6,  y: 16.7, hoehe: 36, fest: 1.8 },

      // Osten ist Amt: Blumen unter dem Fenster, Papier in Kisten.
      { bild: 'hub_blumenkasten', x: 36.4, y: 14.2, hoehe: 26, fest: 1.4 },
      { bild: 'hub_kisten',    x: 37.2, y: 16.4, hoehe: 40, fest: 1.4 },
      { bild: 'hub_saecke',    x: 35.9, y: 16.8, hoehe: 30, fest: 1.4 },
      { bild: 'hub_trog',      x: 36.0, y: 18.4, hoehe: 24, fest: 1.8 },

      // Sueden ist arm.
      { bild: 'hub_stand',     x: 22.4, y: 20.6, hoehe: 74, fest: 2.0 },
      { bild: 'hub_bank',      x: 10.6, y: 20.3, hoehe: 30, fest: 1.6 },
      { bild: 'hub_bank',      x: 12.8, y: 20.3, hoehe: 30, fest: 1.6, spiegeln: true },
      { bild: 'hub_schild',    x: 21.8, y: 22.4, hoehe: 64, fest: 0.4 },
      { bild: 'hub_poller',    x: 17.5, y: 23.5, hoehe: 24, fest: 0.5 },
      { bild: 'hub_poller',    x: 21.5, y: 23.5, hoehe: 24, fest: 0.5 },
      { bild: 'hub_schutt',    x: 14.5, y: 22.6, hoehe: 24, boden: true }
    ],

    // Die Glut in der Esse der Werkstatt — ein Schein ohne eigenes Bild.
    lichter: [
      { x: 5.9, y: 12.4, r: 1.6, tiefe: 14.1 }
    ],

    // Wo die Figur den Platz betritt: suedlich des Brunnens auf der
    // Ringstrasse, mit Blick auf Brunnen, Treppe und Rathaus. Der alte
    // Startpunkt (Weltmitte, 72 % der Hoehe) war fuer das gemalte Bild
    // abgestimmt und stellte die Figur hier halb in das Brunnenbecken.
    start: { x: 20, y: 19.9 },

    // Die Spielerfigur im Hub: etwas kleiner als die 54 des Dungeons. Gleich
    // hoch gemessen wie die NPC, wirkte sie mit dem breiten hellen Umhang
    // neben den schmalen Stadtleuten zu gross.
    spielerHoehe: 50,

    // Die Terrasse: Rathaus in Zeile 2-4, Vorplatz 5-7, Mauer 8-9.
    // h zaehlt die Mauerzeilen mit. Die Treppe fuellt die Luecke in der
    // Mauer; links und rechts davon steht je ein Mauerstueck.
    terrasse: { x: 13, y: 2, b: 14, h: 8, treppeX: 18, treppeB: 4 }
  };

  if (typeof window !== 'undefined') window.HUB_NEU_KARTE = HUB_NEU_KARTE;
  if (typeof module !== 'undefined' && module.exports) module.exports = HUB_NEU_KARTE;
})();
