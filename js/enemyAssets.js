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

  // Alle Gegner-Sprite-URLs (fuer den Hintergrund-Prefetch).
  function _allEnemyUrls() {
    var urls = [];
    ENEMY_TYPES.forEach(function (t) {
      FRAMES.forEach(function (f) { urls.push('assets/enemy/' + t + '/' + f + '.png'); });
    });
    Object.keys(SINGLE_FALLBACKS).forEach(function (key) {
      urls.push('assets/enemy/' + SINGLE_FALLBACKS[key]);
    });
    BOSSES.forEach(function (b) {
      FRAMES.forEach(function (f) { urls.push('assets/enemy/' + b + '/' + f + '.png'); });
      urls.push('assets/enemy/' + b + '/idle.png');
    });
    return urls;
  }

  // Nicht-blockierender Hintergrund-Prefetch waehrend der Hub-Szene: laedt die
  // Gegner-Bilder per rohem Image() in den BROWSER-HTTP-Cache — voellig ohne
  // Phasers Loader (dessen Timing im Hintergrund fragil war). Beim Abstieg holt
  // GameScene.preload sie dann per Phaser aus dem Cache -> schnell, kein Netz.
  // Gestaffelt (wenige parallel) statt 87 Requests auf einmal, damit der Hub
  // nicht ruckelt. Idempotent-freundlich: laeuft hoechstens einmal pro Session.
  var _prefetchStarted = false;
  window.prefetchEnemySprites = function () {
    if (_prefetchStarted || typeof Image === 'undefined') return;
    _prefetchStarted = true;
    var urls = _allEnemyUrls();
    var i = 0;
    var CONCURRENCY = 4;
    var loadNext = function () {
      if (i >= urls.length) return;
      var img = new Image();
      var done = function () { img.onload = img.onerror = null; loadNext(); };
      img.onload = done;
      img.onerror = done;
      img.src = urls[i++];
    };
    for (var s = 0; s < CONCURRENCY; s++) loadNext();
  };

  window.queueEnemySprites = function (scene) {
    if (!scene || !scene.load) return;
    var L = scene.load;
    var tex = scene.textures;
    // Schon gecachte Keys NICHT erneut queuen. Ohne das re-fetchte Phasers Loader
    // beim Dungeon-Eintritt ALLE 87 Sprites nochmal (auch wenn der Hub sie im
    // Hintergrund schon geladen hatte) -> lange Ladezeit, egal wie lange man im
    // Hub war. Mit dem Guard ist das GameScene.preload-Sicherheitsnetz gratis,
    // wenn der Hub-Load fertig war, und laedt sonst nur die noch fehlenden.
    var img = function (key, url) {
      if (tex && typeof tex.exists === 'function' && tex.exists(key)) return;
      L.image(key, url);
    };
    ENEMY_TYPES.forEach(function (t) {
      FRAMES.forEach(function (f) { img(t + '_' + f, 'assets/enemy/' + t + '/' + f + '.png'); });
    });
    Object.keys(SINGLE_FALLBACKS).forEach(function (key) {
      img(key, 'assets/enemy/' + SINGLE_FALLBACKS[key]);
    });
    BOSSES.forEach(function (b) {
      FRAMES.forEach(function (f) { img(b + '_' + f, 'assets/enemy/' + b + '/' + f + '.png'); });
      img('sprite_' + b, 'assets/enemy/' + b + '/idle.png'); // sprite_boss_chain etc.
    });
  };
})();
