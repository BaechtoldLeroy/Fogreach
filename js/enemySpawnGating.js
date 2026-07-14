// js/enemySpawnGating.js
// Feature 057 (#40): gate the enemy spawn roster by STORY ACT, layered on top
// of the existing depth-based roster. Pure, Phaser-free IIFE so it can be
// unit-tested; enemy.js's spawnEnemy wires it in. NEVER returns an empty roster.
(function () {
  'use strict';

  // Minimum story-act index at which each enemy type may appear (spec §4.1).
  // Acts (storySystem.STORY_ACTS): 0 auftrag, 1 treuer_diener, 2 erste_risse,
  // 3 wahrheit, 4 bruch, 5 rebellion, 6 offenbarung.
  // Types: 1=Imp 2=Archer 3=Brute 4=Mage 5=Shadow 6=ChainGuard 7=FlameWeaver
  //        8=Rat 9=Bat 10=Wolf.
  var ENEMY_MIN_ACT = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4, 7: 4, 8: 0, 9: 0, 10: 0 };

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
    return [8, 9, 10, 1, 2, 3, 4, 5, 6, 7];
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
    depthRoster: depthRoster,
    getAvailableEnemyTypes: getAvailableEnemyTypes
  };
})();
