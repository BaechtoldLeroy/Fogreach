// js/enemySpawnGating.js
// Feature 057 (#40): gate the enemy spawn roster by STORY ACT, layered on top
// of the existing depth-based roster. Pure, Phaser-free IIFE so it can be
// unit-tested; enemy.js's spawnEnemy wires it in. NEVER returns an empty roster.
(function () {
  'use strict';

  // Ab welchem Akt ein Gegnertyp erscheint (Story-Bibel v5, Abschnitt 12).
  // Akte (storySystem.STORY_ACTS): 0 Der Dienst, 1 Treuer Diener, 2 Doppelspiel,
  // 3 Enttarnung, 4 Verrat und Presse.
  // Typen: 1=Imp 2=Archer 3=Brute 4=Mage 5=Shadow 6=ChainGuard 7=FlameWeaver
  //        8=Rat 9=Bat 10=Wolf 11=Nebelgeschwuer 12=Priester.
  // #12: Priester in den Katakomben (ab Akt 2), Nebelgeschwuer auf der
  // Ritualebene (ab Akt 3) — dieselben Schwellen wie gebietsName in roomManager.
  // #162: Die Kettenwache kommt schon in Akt 3 — sie jagt Dich nach dem Bruch.
  var ENEMY_MIN_ACT = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 0, 9: 0, 10: 0, 11: 3, 12: 2 };

  // #162: Was die Gegner in der Geschichte sind. Keine neuen Typen, aber ein
  // Name, der sagt, gegen wen man kaempft: Ungeziefer der Keller, Wesen aus
  // dem Nebel, Menschen des Rats — und ab der Enttarnung die Vergessenen,
  // Buerger, die der Rat geopfert hat.
  var ENEMY_NAMEN = {
    1:  { de: 'Nebelwicht',    en: 'Fog Wisp' },       // kleinste Nebelwesen
    2:  { de: 'Kellerwächter', en: 'Cellar Warden' },  // Menschen des Rats
    3:  { de: 'Nebelbestie',   en: 'Fog Beast' },      // gewachsen aus dem, was die Quelle frisst
    4:  { de: 'Kultist',       en: 'Cultist' },        // fuehrt die Rituale des Klerus aus
    5:  { de: 'Vergessener',   en: 'Forgotten One' },  // was von den Verschwundenen bleibt
    6:  { de: 'Kettenwache',   en: 'Chain Guard' },    // Garde des Schattenrats
    7:  { de: 'Flammenweber',  en: 'Flameweaver' },    // Ritualisten der Quelle
    8:  { de: 'Ratte',         en: 'Rat' },
    9:  { de: 'Fledermaus',    en: 'Bat' },
    10: { de: 'Wolf',          en: 'Wolf' },
    11: { de: 'Nebelgeschwür', en: 'Fog Blight' },   // #12: was die Quelle auswirft
    12: { de: 'Priester',      en: 'Priest' }        // #12: stärkt die Kultisten
  };

  /** Anzeigename eines Gegnertyps; unbekannte Typen heissen "Gegner". */
  function enemyName(type, lang) {
    var n = ENEMY_NAMEN[type];
    var en = (lang === 'en');
    if (!n) return en ? 'Enemy' : 'Gegner';
    return en ? n.en : n.de;
  }

  // Pure depth roster — 1:1 mirror of enemy.js's historical depth tiers. Acts
  // as the FLOOR (depth still gates); the act filter only removes types that
  // the story hasn't unlocked yet. Default depth 1 for missing/invalid input.
  function depthRoster(depth) {
    var d = (typeof depth === 'number' && isFinite(depth) && depth >= 1) ? depth : 1;
    // KUMULATIV: früh eingeführte Typen (v. a. die Bestien 8/9/10) bleiben auch
    // tiefer im Pool -> mehr Abwechslung. Tiefe skaliert die Gegner-Stats
    // (enemy.js statScale), Bestien bleiben also unten relevant statt trivial.
    // Neue, gefährlichere Typen kommen mit der Tiefe oben drauf.
    if (d <= 2) return [8, 9, 10];
    if (d <= 4) return [8, 9, 10, 1, 2];
    if (d <= 6) return [8, 9, 10, 1, 2, 3, 4];
    if (d <= 8) return [8, 9, 10, 1, 2, 3, 4, 5];
    if (d <= 9) return [8, 9, 10, 1, 2, 3, 4, 5, 6, 7];
    if (d <= 19) return [8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 12];
    return [8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 12, 11];
  }

  // Available enemy types for (depth, actIndex). GUARANTEE: never empty.
  function getAvailableEnemyTypes(depth, actIndex) {
    var roster = depthRoster(depth);
    // Clamp act to 0..6. Undefined/NaN/non-number -> treat as full (6) so a
    // missing/uninitialised story system never over-restricts spawns (FR-06).
    var act;
    if (typeof actIndex !== 'number' || !isFinite(actIndex)) {
      act = 6;
    } else {
      act = Math.max(0, Math.min(6, Math.floor(actIndex)));
    }
    var minActOf = function (t) {
      var m = ENEMY_MIN_ACT[t];
      return (typeof m === 'number') ? m : 0;
    };
    var filtered = roster.filter(function (t) { return minActOf(t) <= act; });
    if (filtered.length > 0) return filtered;
    // Fallback (FR-04): nothing in the roster is act-unlocked yet -> take the
    // roster entry with the LOWEST min-act; if the roster is somehow empty,
    // fall back to Rat (8). Never returns an empty array.
    if (roster.length > 0) {
      var best = roster[0];
      var bestMin = minActOf(best);
      for (var i = 1; i < roster.length; i++) {
        var m = minActOf(roster[i]);
        if (m < bestMin) { bestMin = m; best = roster[i]; }
      }
      return [best];
    }
    return [8];
  }

  window.EnemySpawnGating = {
    ENEMY_MIN_ACT: ENEMY_MIN_ACT,
    ENEMY_NAMEN: ENEMY_NAMEN,
    enemyName: enemyName,
    depthRoster: depthRoster,
    getAvailableEnemyTypes: getAvailableEnemyTypes
  };
})();
