// Idle-Schleifen der Hub-Figuren (#194) — nur hinter ?idle=1.
//
// Die NPC im Hub stehen als Standbild da. Mit der Flagge spielt jede Figur
// eine kurze PixelLab-Schleife (atmen, Gewicht verlagern, eine kleine Geste).
// Jede Schleife liegt als EIN Streifen unter assets/sprites/hubidle/: acht
// Bilder nebeneinander, jedes genau so gross wie das Standbild und mit
// demselben Ausschnitt (tools/hubIdleBauen.js). Bild 0 IST das Standbild.
// Darum bleiben Groesse, Fusspunkt und [E]-Zone gleich: die Skalierung misst
// der Hub weiterhin am Standbild, und jedes Schleifenbild hat dessen Mass.
//
// Ohne Flagge wird hier nichts geladen und nichts angelegt — der Hub sieht
// aus wie vorher.
(function () {
  'use strict';

  // Standbild-Textur -> Name des Streifens. Reihenfolge = Startphase (siehe phase()).
  const FIGUREN = [
    ['schmiedemeisterin', 'schmiedemeisterin'],
    ['setzer_thom', 'setzer_thom'],
    ['spaeherin', 'spaeherin'],
    ['aldric_right0', 'aldric'],
    ['elara_right0', 'elara'],
    ['harren_right0', 'harren'],
    ['klerus', 'klerus'],
    ['garde', 'garde'],
    ['buerger', 'buerger'],
    ['patrouille', 'patrouille'],
    ['vorleser_frau', 'vorleser_frau'],
    ['vorleser_alter', 'vorleser_alter'],
    ['vorleser_junge', 'vorleser_junge']
  ];
  const BILDER = 8;
  // Ruhiger Takt: eine Schleife dauert rund 1,6 s.
  const TAKT = 5;

  function an() {
    try { return !!(window.DebugGate && window.DebugGate.an('idle')); } catch (e) { return false; }
  }

  function eintrag(standbild) {
    for (let i = 0; i < FIGUREN.length; i++) if (FIGUREN[i][0] === standbild) return i;
    return -1;
  }
  const streifen = (i) => 'hubidle_' + FIGUREN[i][1];
  const animName = (i) => 'hubidle_' + FIGUREN[i][1] + '_schleife';

  /** Laedt die Streifen (nur mit Flagge, nur fehlende). */
  function vorladen(scene) {
    if (!an()) return 0;
    let n = 0;
    FIGUREN.forEach(function (f, i) {
      if (scene.textures.exists(streifen(i))) return;
      scene.load.image(streifen(i), 'assets/sprites/hubidle/' + f[1] + '_idle.png?v=1');
      n++;
    });
    return n;
  }

  /**
   * Zerlegt einen geladenen Streifen in seine acht Bilder und legt die
   * Schleife EINMAL bei Phaser an (anims ist spielweit, ueberlebt den
   * Szenenwechsel).
   */
  function schleifeAnlegen(scene, i) {
    const key = streifen(i);
    if (!scene.textures.exists(key)) return null;
    const tex = scene.textures.get(key);
    if (!tex.has('0') || !tex.has(String(BILDER - 1))) {
      const src = tex.getSourceImage();
      const w = Math.floor(src.width / BILDER), h = src.height;
      if (!(w > 0 && h > 0)) return null;
      for (let b = 0; b < BILDER; b++) tex.add(String(b), 0, b * w, 0, w, h);
    }
    if (!scene.anims.exists(animName(i))) {
      const frames = [];
      for (let b = 0; b < BILDER; b++) frames.push({ key: key, frame: String(b) });
      scene.anims.create({ key: animName(i), frames: frames, frameRate: TAKT, repeat: -1 });
    }
    return animName(i);
  }

  /**
   * Eigene Startphase je Figur, fest und ohne Zufall: Nachbarn in der Liste
   * liegen drei Bilder auseinander, Wiederholungen (zwei Patrouillen) zwei.
   */
  function phase(i, nr) {
    return (i * 3 + (nr || 0) * 2) % BILDER;
  }

  /**
   * Laesst ein Hub-Sprite seine Schleife spielen. `nr` unterscheidet
   * mehrere Figuren mit demselben Bild (Patrouillen).
   * Liefert true, wenn eine Schleife laeuft.
   */
  function spielen(scene, sprite, standbild, nr) {
    if (!an() || !sprite || typeof sprite.play !== 'function') return false;
    const i = eintrag(standbild);
    if (i < 0) return false;
    const name = schleifeAnlegen(scene, i);
    if (!name) return false;
    // Weichzeichnung wie beim Standbild (RenderQuality setzt sie fuer die Hub-NPC).
    if (window.RenderQuality && scene.textures.get(standbild)) {
      try {
        const lin = scene.textures.get(standbild).source[0].filterMode;
        scene.textures.get(streifen(i)).setFilter(lin);
      } catch (e) { /* nicht fatal */ }
    }
    sprite.play({ key: name, startFrame: phase(i, nr) });
    return true;
  }

  /** Bild oder Sprite: ohne Flagge bleibt es beim Bild wie bisher. */
  function figur(scene, x, y, standbild) {
    return an() ? scene.add.sprite(x, y, standbild) : scene.add.image(x, y, standbild);
  }

  window.HubIdle = { an: an, vorladen: vorladen, spielen: spielen, figur: figur, phase: phase,
    FIGUREN: FIGUREN, BILDER: BILDER };
})();
