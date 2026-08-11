// Zentrale Gegner-Sprite-Ladeliste.
//
// Frueher lagen diese ~70 Loads in startScene.preload und wurden bei JEDEM Boot
// geladen — auch bei reinem Hub-Besuch, obwohl Gegner nur im Dungeon vorkommen.
// Das verlaengerte den Start unnoetig (v.a. Mobile).
//
// Jetzt:
//   - HubSceneV2.create() laedt sie IM HINTERGRUND (load.start()), waehrend der
//     Spieler im Hub ist -> beim Abstieg sind sie da, ohne Boot oder Dungeon-
//     Eintritt zu blockieren.
//   - GameScene.preload() ruft dieselbe Funktion als SICHERHEITSNETZ: deckt den
//     Endlos-Modus (kein Hub) ab und den Fall, dass der Hintergrund-Load beim
//     Abstieg noch nicht fertig war.
//
// load.image ist idempotent: bereits gecachte Keys ueberspringt Phaser, der
// Sicherheitsnetz-Aufruf kostet im Normalfall also nichts.
(function () {
  var ENEMY_TYPES = ['brute', 'imp', 'shadow', 'flameweaver', 'chainguard', 'archer', 'mage', 'rat', 'bat', 'wolf'];
  var FRAMES = ['left0', 'left1', 'left2', 'right0', 'right1', 'right2'];
  // Einzel-Fallback-Sprites (enemy.js faellt darauf zurueck, wenn die gerichteten
  // Frames fehlen). Kein brute/rat/bat/wolf hier — brute nutzt brute_right0 direkt,
  // rat/bat/wolf haben prozedurale proc_*-Fallbacks.
  var SINGLE_FALLBACKS = {
    sprite_imp: 'imp/imp.png',
    sprite_archer: 'archer/archer.png',
    sprite_mage: 'mage/mage.png',
    sprite_shadow: 'shadow/shadow.png',
    sprite_chainguard: 'chainguard/chainguard.png',
    sprite_flameweaver: 'flameweaver/flameweaver.png'
  };
  var BOSSES = ['boss_chain', 'boss_ceremony', 'boss_shadow'];

  window.queueEnemySprites = function (scene) {
    if (!scene || !scene.load) return;
    var L = scene.load;
    ENEMY_TYPES.forEach(function (t) {
      FRAMES.forEach(function (f) { L.image(t + '_' + f, 'assets/enemy/' + t + '/' + f + '.png'); });
    });
    Object.keys(SINGLE_FALLBACKS).forEach(function (key) {
      L.image(key, 'assets/enemy/' + SINGLE_FALLBACKS[key]);
    });
    BOSSES.forEach(function (b) {
      FRAMES.forEach(function (f) { L.image(b + '_' + f, 'assets/enemy/' + b + '/' + f + '.png'); });
      L.image('sprite_' + b, 'assets/enemy/' + b + '/idle.png'); // sprite_boss_chain etc.
    });
  };
})();
