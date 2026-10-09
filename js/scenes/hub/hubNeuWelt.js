/* =====================================================================
 * hubNeuWelt.js — den Marktplatz aus der Karte bauen (#181)
 * ---------------------------------------------------------------------
 * Seit b334 IST das der Hub. Bis b333 lag er hinter der Flagge
 * ?debug=1&hubneu=1, und das gemalte Bild (6,2 MB) war der ausgelieferte.
 *
 * Drei Dinge macht diese Datei, und die Reihenfolge ist der Punkt:
 *
 *  1. layoutUebernehmen() schreibt Kollisionen, Tueren und NPC-Plaetze aus
 *     der Karte in window.HUB_HITBOXES — IN DAS BESTEHENDE OBJEKT.
 *     HubSceneV2 haelt eine Referenz darauf, die beim Laden entstanden
 *     ist; ein Ersetzen waere wirkungslos. Die NPC-Eintraege selbst
 *     bleiben dieselben Objekte, nur x/y aendern sich — an ihnen haengen
 *     die i18n-Getter, factionId, visibleFromAct und die Quest-Flaggen.
 *
 *  2. bauen() zeichnet den Boden in EINE RenderTexture: Erde als Grund,
 *     darueber Gras und Platte, darueber Pflaster. Jede Grenze laeuft
 *     ueber Uebergangskacheln (Eckregel NW/NE/SW/SE), nie auf Stoss.
 *
 *  3. Darueber die Terrasse (Stuetzmauer + Freitreppe), die Haeuser, die
 *     Requisiten, die Baeume am Rand und zuletzt der Nebel.
 *
 * Masse: alle Tabellen stehen in KACHELN. Umgerechnet wird einmal, hier.
 * Eine Kachel = 20 Entwurfseinheiten = 32 Weltpixel.
 * ===================================================================== */
(function () {
  'use strict';

  var BODEN_BILDER = 16;
  var TIEFE_BODEN = -20;

  // Waldsaum ueber dem oberen Kartenrand, in Kachelzeilen. Die Kamera darf
  // ueber den Rand hinaus (sonst schnitte sie das Rathaus ab), und dort lag
  // bis b332 NICHTS — man sah die graue Hintergrundfarbe. Jetzt wird bis
  // hierhin gezeichnet, und die Kamera reicht genau bis hierhin und nicht
  // weiter. Begehbar ist der Saum nicht: die Physik endet am Kartenrand.
  var SAUM = 4;
  // Bodennebel: direkt ueber dem Boden, unter allem, was steht. Bis b330
  // stand hier 95 — gemeint als "ueber allem", in einer Szene, die nach y
  // sortiert (100 bis 800), also faktisch genau das hier. Der Nebel lag
  // auf dem Pflaster und die Haeuser ragten heraus; das sieht richtig aus
  // und bleibt so, jetzt aber mit Absicht.
  var TIEFE_NEBEL = TIEFE_BODEN + 3;

  // Die drei Grenzen, fuer die tools/uebergangBauen.js Kacheln gebaut hat.
  // oben sagt, welche Arten als "obere" gelten; flaeche sind die Kacheln
  // fuer das reine Innere (mehrere = gestreut).
  var SCHICHTEN = [
    { name: 'gras', oben: ['gras'], flaeche: ['hub_boden12', 'hub_boden13'] },
    { name: 'platte', oben: ['platte', 'pflaster'],
      flaeche: ['hub_boden0', 'hub_boden1', 'hub_boden2', 'hub_boden3'] },
    { name: 'pflaster', oben: ['pflaster'],
      flaeche: ['hub_flaeche_pflaster0'] }
  ];
  var ERDE = 'hub_boden9';

  var BAU_BILDER = ['stuetzmauer', 'freitreppe', 'truhe',
    'tafel_fresh', 'tafel_faded', 'tafel_torn', 'tafel_gedruckt'];
  var BAUM_BILDER = ['hub_kiefer', 'hub_baum'];
  var FEUER_BILDER = 9;            // brazier0..8, wie im Dungeon
  var BRUNNEN_BILDER = 8;          // hub_kettenbrunnen0..7

  // Fuss-Collider: so hoch, dass man nicht hindurchlaeuft, und flach genug,
  // dass er nur den Fuss eines Moebels traegt, nicht seinen Koerper.
  var FUSS_HOEHE = 0.35;           // Kacheln

  function karte() { return (typeof window !== 'undefined') ? window.HUB_NEU_KARTE : null; }

  /** Die Weltmasse des neuen Platzes — HubSceneV2 setzt Kamera und Physik danach. */
  function welt() {
    var K = karte();
    if (!K) return null;
    // oben: wie weit die Kamera UEBER den Kartenrand hinaussehen darf.
    // Das Rathaus steht mit dem Fuss auf Zeile 7 und ist hoeher als das,
    // was ueber ihm liegt — ohne diese Luft wuerde sein Dach abgeschnitten.
    // Die Physik bleibt bei 0: hinauslaufen kann niemand.
    var start = K.start ? { x: K.start.x * K.kachel, y: K.start.y * K.kachel } : null;
    return { breite: K.breite * K.kachel, hoehe: K.hoehe * K.kachel, oben: -SAUM * K.kachel, start: start,
      spielerHoehe: K.spielerHoehe || null };
  }

  /**
   * Ein fester Wuerfel: dieselbe Stelle gibt immer dieselbe Zahl.
   *
   * Math.random waere hier falsch. Der Platz wird bei jeder Rueckkehr aus
   * dem Dungeon neu gebaut — mit echtem Zufall laege nach jedem Besuch ein
   * anderes Pflaster da, und das sieht man sofort.
   */
  function streu(x, y, salz) {
    var h = (x * 73856093) ^ (y * 19349663) ^ ((salz || 0) * 83492791);
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function zeichenAn(K, tx, ty) {
    // Ueber dem Kartenrand: der Waldsaum (nur zum Zeichnen, nie zum Laufen —
    // die Kollisionen werden nur aus den Zeilen 0..hoehe gebaut).
    if (ty < 0 && ty >= -SAUM && tx >= 0 && tx < K.breite) return 'g';
    if (tx < 0 || ty < 0 || tx >= K.breite || ty >= K.hoehe) return 'x';
    return (K.zeilen[ty] || '').charAt(tx) || 'x';
  }
  function artAn(K, tx, ty) { return K.arten[zeichenAn(K, tx, ty)] || null; }

  // ---------------------------------------------------------------- Layout

  /**
   * Zusammenhaengende feste Zellen zu moeglichst wenigen Rechtecken
   * zusammenfassen.
   *
   * Je Zelle ein Collider waeren rund dreihundert Koerper, und eine Figur
   * bleibt an den Innenkanten zweier buendiger Koerper haengen. Darum:
   * zeilenweise Laeufe bilden und nach unten verschmelzen, solange der
   * Lauf darunter genau gleich liegt.
   */
  function _festeFlaechen(K) {
    var fest = K.fest || '';
    var offen = [];
    var fertig = [];
    for (var ty = 0; ty < K.hoehe; ty++) {
      var laeufe = [];
      var x = 0;
      while (x < K.breite) {
        if (fest.indexOf(zeichenAn(K, x, ty)) < 0) { x++; continue; }
        var von = x;
        while (x < K.breite && fest.indexOf(zeichenAn(K, x, ty)) >= 0) x++;
        laeufe.push({ x: von, b: x - von });
      }
      var neu = [];
      laeufe.forEach(function (l) {
        for (var i = 0; i < offen.length; i++) {
          var o = offen[i];
          if (o && o.x === l.x && o.b === l.b && o.y + o.h === ty) {
            o.h++; neu.push(o); offen[i] = null; return;
          }
        }
        neu.push({ x: l.x, y: ty, b: l.b, h: 1 });
      });
      offen.forEach(function (o) { if (o) fertig.push(o); });
      offen = neu;
    }
    offen.forEach(function (o) { if (o) fertig.push(o); });
    return fertig;
  }

  /**
   * Die Karte nach HUB_HITBOXES schreiben.
   *
   * Das bestehende Objekt wird GEAENDERT, nicht ersetzt: HubSceneV2 merkt
   * sich die Referenz beim Laden. Und die Eintraege der NPC und Tueren
   * bleiben dieselben Objekte, damit i18n-Getter, factionId und die
   * Sichtbarkeitsflaggen erhalten bleiben.
   */
  function layoutUebernehmen() {
    var K = karte();
    var HB = (typeof window !== 'undefined') ? window.HUB_HITBOXES : null;
    if (!K || !HB) return null;
    var E = K.jeKachel;

    HB.colliders.length = 0;
    _festeFlaechen(K).forEach(function (f, i) {
      HB.colliders.push({
        id: 'karte_' + i, x: f.x * E, y: f.y * E, w: f.b * E, h: f.h * E
      });
    });

    // Feste Requisiten bekommen einen flachen Collider unter dem Fuss.
    // Ohne ihn laeuft man durch Baenke und Faesser und steht dann, je nach
    // Seite, davor oder dahinter — das sah nach Fehler aus.
    (K.requisiten || []).forEach(function (r, i) {
      if (!r.fest) return;
      HB.colliders.push({
        id: 'fuss_' + i,
        x: (r.x - r.fest / 2) * E, y: (r.y - FUSS_HOEHE) * E,
        w: r.fest * E, h: FUSS_HOEHE * E
      });
    });

    (K.tueren || []).forEach(function (t) {
      var e = HB.entrances.filter(function (q) { return q.id === t.id; })[0];
      if (!e) return;
      e.x = t.x * E; e.y = t.y * E; e.w = t.b * E; e.h = t.h * E;
    });

    (K.npcs || []).forEach(function (n) {
      var npc = HB.npcs.filter(function (q) { return q.id === n.id; })[0];
      if (!npc) return;
      npc.x = n.x * E; npc.y = n.y * E;
    });

    return HB;
  }

  // ----------------------------------------------------------------- Laden

  function vorladen(scene) {
    if (!scene || !scene.load || !scene.textures) return 0;
    var n = 0;
    var nimm = function (key, pfad) {
      if (scene.textures.exists(key)) return;
      scene.load.image(key, pfad); n++;
    };
    var i;
    for (i = 0; i < BODEN_BILDER; i++) nimm('hub_boden' + i, 'assets/hub/boden' + i + '.png');
    SCHICHTEN.forEach(function (s) {
      for (var m = 1; m < 15; m++) {
        nimm('hub_ueber_' + s.name + m, 'assets/hub/ueber_' + s.name + m + '.png');
      }
    });
    for (i = 0; i < 1; i++) {
      nimm('hub_flaeche_pflaster' + i, 'assets/hub/flaeche_pflaster' + i + '.png');
    }
    BAU_BILDER.forEach(function (b) { nimm('hub_' + b, 'assets/hub/' + b + '.png'); });
    // Was die Karte nennt, wird geladen — keine zweite Liste, die veralten
    // koennte. hub_* liegt in assets/hub, die Feuerkoerbe sind die des
    // Dungeons und brauchen alle neun Bilder ihrer Animation.
    var K = karte();
    var bilder = [];
    (K.haeuser || []).concat(K.requisiten || []).forEach(function (r) {
      if (bilder.indexOf(r.bild) < 0) bilder.push(r.bild);
    });
    BAUM_BILDER.forEach(function (b) { if (bilder.indexOf(b) < 0) bilder.push(b); });
    bilder.forEach(function (b) {
      if (b.indexOf('hub_') === 0) nimm(b, 'assets/hub/' + b.slice(4) + '.png');
    });
    (K.requisiten || []).forEach(function (q) {
      if (q.anim === 'feuer') {
        for (var f = 0; f < FEUER_BILDER; f++) nimm('brazier' + f, 'assets/tiles/brazier' + f + '.png');
      }
      if (q.anim === 'brunnen') {
        for (var w = 0; w < BRUNNEN_BILDER; w++) {
          nimm(q.bild + w, 'assets/hub/' + q.bild.slice(4) + w + '.png');
        }
      }
    });
    return n;
  }

  // --------------------------------------------------------------- Zeichnen

  /** Ist die Ecke (tx,ty) von der oberen Art? Mehrheit der vier Nachbarzellen. */
  function _ecke(K, oben, tx, ty) {
    var n = 0;
    if (oben.indexOf(artAn(K, tx - 1, ty - 1)) >= 0) n++;
    if (oben.indexOf(artAn(K, tx, ty - 1)) >= 0) n++;
    if (oben.indexOf(artAn(K, tx - 1, ty)) >= 0) n++;
    if (oben.indexOf(artAn(K, tx, ty)) >= 0) n++;
    return n >= 2 ? 1 : 0;
  }

  function _bodenZeichnen(scene) {
    var K = karte();
    if (!K) return null;
    var z = K.kachel;
    var oben = SAUM * z;
    var rt = scene.add.renderTexture(0, -oben, K.breite * z, K.hoehe * z + oben).setOrigin(0, 0);
    rt.setDepth(TIEFE_BODEN);
    var stapel = (typeof rt.beginDraw === 'function');
    var male = function (key, x, y) {
      if (!scene.textures.exists(key)) return;
      if (stapel) rt.batchDraw(key, x, y); else rt.draw(key, x, y);
    };
    if (stapel) rt.beginDraw();

    var tx, ty;
    // Grund: Erde ueberall, wo ueberhaupt Boden ist.
    for (ty = -SAUM; ty < K.hoehe; ty++) {
      for (tx = 0; tx < K.breite; tx++) {
        if (artAn(K, tx, ty)) male(ERDE, tx * z, ty * z + oben);
      }
    }
    // Darueber die Schichten, jede mit ihren Uebergaengen.
    SCHICHTEN.forEach(function (s, si) {
      for (ty = -SAUM; ty < K.hoehe; ty++) {
        for (tx = 0; tx < K.breite; tx++) {
          if (!artAn(K, tx, ty)) continue;
          var m = (_ecke(K, s.oben, tx, ty) << 3)
            | (_ecke(K, s.oben, tx + 1, ty) << 2)
            | (_ecke(K, s.oben, tx, ty + 1) << 1)
            | _ecke(K, s.oben, tx + 1, ty + 1);
          if (m === 0) continue;
          if (m === 15) {
            var f = s.flaeche;
            male(f[Math.floor(streu(tx, ty, 3 + si) * f.length) % f.length], tx * z, ty * z + oben);
          } else {
            male('hub_ueber_' + s.name + m, tx * z, ty * z + oben);
          }
        }
      }
    });
    if (stapel) rt.endDraw();
    return rt;
  }

  /**
   * Ein Bild auf seinen Fusspunkt setzen.
   *
   * Breite statt Massstab: die Vorlagen kommen in verschiedenen Groessen,
   * und was zaehlt, ist wie breit das Haus auf dem Platz steht. Wer hier
   * mit setScale arbeitet, bekommt fuenf verschieden grosse Haeuser bei
   * gleicher eingetragener Breite — derselbe Fehler wie bei den Gegnern.
   */
  function _stellen(scene, key, xK, yK, mass, spiegeln, farbe, tiefe) {
    if (!scene.textures.exists(key)) return null;
    var K = karte();
    var px = xK * K.kachel, py = yK * K.kachel;
    // Ein Sprite nur, wo etwas abgespielt wird; alles andere bleibt Bild.
    var bild = (arguments[8] ? scene.add.sprite(px, py, key) : scene.add.image(px, py, key))
      .setOrigin(0.5, 1);
    // mass ist entweder eine Zahl (Breite in Kacheln) oder { hoehe: px }.
    var s = 1;
    if (mass && mass.hoehe && bild.height > 0) s = mass.hoehe / bild.height;
    else if (typeof mass === 'number' && bild.width > 0) s = (mass * K.kachel) / bild.width;
    bild.setScale(spiegeln ? -s : s, s);
    if (farbe) bild.setTint(farbe);
    bild.setDepth(typeof tiefe === 'number' ? tiefe : py);
    return bild;
  }

  /** Nebel: zwei langsam treibende Schleier ueber dem ganzen Platz. */
  function _nebel(scene, w, h) {
    var key = 'hub_nebelfleck';
    if (!scene.textures.exists(key)) {
      var lw = scene.textures.createCanvas ? scene.textures.createCanvas(key, 128, 128) : null;
      if (!lw) return [];
      var ctx = lw.getContext();
      ctx.clearRect(0, 0, 128, 128);
      for (var i = 0; i < 26; i++) {
        var cx = streu(i, 1, 21) * 128, cy = streu(i, 2, 21) * 128;
        var rr = 16 + streu(i, 3, 21) * 30;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(188,198,214,0.5)');
        g.addColorStop(1, 'rgba(188,198,214,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
      lw.refresh();
    }
    var schleier = [];
    [[0.13, 7], [0.09, -4]].forEach(function (p, i) {
      var ts = scene.add.tileSprite(0, 0, w, h, key).setOrigin(0, 0);
      ts.setAlpha(p[0]).setDepth(TIEFE_NEBEL + i);
      ts.tileScaleX = 2.5; ts.tileScaleY = 2.5;
      ts._driftX = p[1];
      schleier.push(ts);
    });
    // Der Nebel treibt. Ohne Bewegung ist er nur ein Schleier auf der Linse.
    var treiben = function (zeit, delta) {
      var d = (delta || 16) / 1000;
      schleier.forEach(function (ts) {
        if (ts.active) ts.tilePositionX += ts._driftX * d;
      });
    };
    scene.events.on('update', treiben);
    scene.events.once('shutdown', function () { scene.events.off('update', treiben); });
    return schleier;
  }

  /** Feuer und Wasserspiel abspielen; fehlt die Animation, bleibt das Bild. */
  function _abspielen(scene, sprite, r) {
    if (r.anim === 'feuer') {
      if (typeof window.feuerschaleFlackern === 'function') window.feuerschaleFlackern(scene, sprite);
      return;
    }
    if (r.anim === 'brunnen') {
      var key = 'hub_wasserspiel';
      if (!scene.anims.exists(key)) {
        var frames = [];
        for (var i = 0; i < BRUNNEN_BILDER; i++) {
          if (scene.textures.exists(r.bild + i)) frames.push({ key: r.bild + i });
        }
        if (frames.length < 2) return;
        scene.anims.create({ key: key, frames: frames, frameRate: 8, repeat: -1 });
      }
      try { sprite.play(key); } catch (e) { /* bleibt stehen */ }
    }
  }

  /** Ein warmer, weicher Schein — EIN Verlauf, fuer alle Lichter geteilt. */
  function _schein(scene, x, y, groesse, tiefe) {
    var key = 'hub_schein';
    if (!scene.textures.exists(key)) {
      var lw = scene.textures.createCanvas ? scene.textures.createCanvas(key, 64, 64) : null;
      if (!lw) return null;
      var ctx = lw.getContext();
      var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,196,120,0.55)');
      g.addColorStop(0.45, 'rgba(255,150,70,0.18)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      lw.refresh();
    }
    // Ein Schein liegt UEBER dem, was leuchtet — sonst verdeckt das
    // Feuerbecken seinen eigenen Glanz.
    var s = scene.add.image(x, y, key).setDepth(tiefe);
    s.setScale(groesse);
    if (s.setBlendMode && window.Phaser) s.setBlendMode(Phaser.BlendModes.ADD);
    s._grund = groesse;
    s._phase = streu(Math.round(x), Math.round(y), 31) * 100;
    return s;
  }

  /**
   * Lichter leicht flackern lassen.
   *
   * Leicht: ein paar Prozent Helligkeit und Groesse, aus zwei Sinus mit
   * krummen Frequenzen — sonst pulsiert alles im Gleichtakt wie eine
   * Warnlampe. Jedes Licht hat seine eigene Phase.
   */
  function _flackern(scene, lichter) {
    if (!lichter.length) return;
    var tick = function (zeit) {
      var t = (zeit || 0) / 1000;
      for (var i = 0; i < lichter.length; i++) {
        var l = lichter[i];
        if (!l.active) continue;
        var w = Math.sin(t * 7.3 + l._phase) * 0.5 + Math.sin(t * 13.1 + l._phase * 1.7) * 0.5;
        l.setAlpha(0.82 + w * 0.12);
        l.setScale(l._grund * (1 + w * 0.05));
      }
    };
    scene.events.on('update', tick);
    scene.events.once('shutdown', function () { scene.events.off('update', tick); });
  }

  /**
   * Die Truhe als Bild statt als Zeichnung. Gibt true zurueck, wenn sie
   * steht — dann zeichnet HubSceneV2 seine eigene nicht.
   */
  function truheStellen(scene, e) {
    if (!e || !scene.textures.exists('hub_truhe')) return false;
    var M = 1536 / 960;
    var x = (e.x + e.w / 2) * M, y = (e.y + e.h) * M;
    var b = scene.add.image(x, y, 'hub_truhe').setOrigin(0.5, 1);
    // Etwas schmaler als die Zone: die Zone ist zum Hingehen, das Bild zum
    // Ansehen.
    var s = (e.w * M * 0.9) / b.width;
    b.setScale(s).setDepth(y);
    scene._truheBild = b;
    return true;
  }

  /**
   * Die Anker der Phasen-Darstellung in Weltkoordinaten: wo die
   * Anschlagtafeln haengen und wo das Rathaus steht. HubSceneV2 hatte sie
   * aus dem alten Layout fest eingetragen — im neuen Platz landeten die
   * Tafeln damit hinter dem Brunnen.
   */
  function phasenAnker() {
    var K = karte();
    if (!K) return null;
    var z = K.kachel, T = K.terrasse;
    var rh = (K.haeuser || []).filter(function (h) { return h.bild === 'hub_rathaus_sockel'; })[0];
    var tuer = (K.tueren || []).filter(function (t) { return t.id === 'rathaus_entrance'; })[0];
    return {
      posterSpots: (K.anschlagtafeln || []).map(function (p) { return { x: p.x * z, y: p.y * z }; }),
      patrouillen: (K.patrouillen || []).map(function (p) { return { x: p.x * z, y: p.y * z }; }),
      rathausRect: rh ? { x: (rh.x - rh.breite / 2) * z, y: T.y * z, w: rh.breite * z, h: (rh.y - T.y) * z } : null,
      rathausEntrance: tuer ? { x: tuer.x * z, y: tuer.y * z, w: tuer.b * z, h: tuer.h * z } : null
    };
  }

  /**
   * Die Aktionsbox: EIN Kaestchen ueber der Figur, das sagt, was [E] jetzt
   * tut. Messing auf Russ — die Farben der Werkstatt —, der Name in einer
   * Buchschrift, die Taste als eigenes kleines Schild links davon.
   *
   * Sie spricht dieselbe Sprache wie das alte Textfeld (setText, setVisible,
   * setPosition), damit HubSceneV2 an keiner der Stellen etwas aendern
   * muss, die die Box ein- und ausblenden.
   */
  function aktionsbox(scene) {
    var MESSING = 0xc9a45c, RUSS = 0x15161b;
    var c = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    var g = scene.add.graphics();
    var taste = scene.add.text(0, 0, 'E', { fontFamily: 'monospace', fontSize: '11px',
      fontStyle: 'bold', color: '#e9cf8f' }).setOrigin(0.5, 0.5);
    var t = scene.add.text(0, 0, '', { fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '14px', color: '#f1e6c8' }).setOrigin(0, 0.5);
    c.add([g, taste, t]);
    var box = {
      // text: wie beim alten Textfeld lesbar — Code und Tests fragen danach.
      _c: c, visible: false, text: '',
      setText: function (s) {
        // "[E]" steckt in den alten Beschriftungen; hier traegt die Taste
        // ihr eigenes Schild.
        t.setText(String(s || '').replace(/\s*\[E\]\s*$/, ''));
        box.text = t.text;
        var tw = 16, gap = 7, px = 8, h = 24;
        var w = px + tw + gap + t.width + px;
        var x0 = -w / 2, y0 = -h;
        g.clear();
        // Schatten, Flaeche, Rand
        g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x0 + 1, y0 + 2, w, h, 4);
        g.fillStyle(RUSS, 0.94); g.fillRoundedRect(x0, y0, w, h, 4);
        g.lineStyle(1, MESSING, 0.85); g.strokeRoundedRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1, 4);
        // Kleiner Zeiger nach unten, auf die Figur
        g.fillStyle(RUSS, 0.94); g.fillTriangle(-5, 0, 5, 0, 0, 5);
        g.lineStyle(1, MESSING, 0.85); g.lineBetween(-5, 0.5, 0, 5); g.lineBetween(0, 5, 5, 0.5);
        // Tastenschild
        var kx = x0 + px, ky = y0 + (h - tw) / 2;
        g.fillStyle(0x2a2620, 1); g.fillRoundedRect(kx, ky, tw, tw, 3);
        g.lineStyle(1, MESSING, 1); g.strokeRoundedRect(kx + 0.5, ky + 0.5, tw - 1, tw - 1, 3);
        taste.setPosition(kx + tw / 2, ky + tw / 2);
        t.setPosition(kx + tw + gap, y0 + h / 2);
        return box;
      },
      setVisible: function (v) { box.visible = !!v; c.setVisible(!!v); return box; },
      // Etwas Luft ueber dem Kopf: die Szene setzt die Box 52 px ueber den Fuss.
      setPosition: function (x, y) { c.setPosition(Math.round(x), Math.round(y) - 6); return box; },
      setDepth: function (d) { c.setDepth(d); return box; },
      setOrigin: function () { return box; },
      destroy: function () { c.destroy(); }
    };
    return box;
  }

  /** Den ganzen Platz bauen. Gibt zurueck, was entstanden ist. */
  function bauen(scene) {
    if (!scene || !scene.add) return null;
    var K = karte();
    if (!K) return null;
    var erg = { boden: null, haeuser: [], requisiten: [], baeume: [], nebel: [] };

    erg.boden = _bodenZeichnen(scene);

    // Die Terrasse. Ihr Gesicht sind zwei Mauerstuecke links und rechts der
    // Treppe; die Treppe steht IN der Luecke, nicht davor.
    //
    // Die Mauer reicht von der Galeriekante bis zum Platz — nicht hoeher.
    // In b329 begann sie 70 px ueber der Kante und verdeckte Aldric, die
    // Statue, die Kuebel und den Sockel des Rathauses samt Portal. Daher
    // stand das Rathaus "verloren hinter der Mauer".
    // Weil sie erst an der Kante beginnt, ueberschneidet sie nichts, was
    // auf der Galerie steht, und sortiert nach ihrem Fuss wie alles andere.
    //
    // Die Treppe dagegen liegt tiefer als alles, was auf ihr gehen kann —
    // sie ist Boden, kein Moebel — und unter dem Rathaus, damit ihr oberer
    // Absatz im Portal verschwindet, statt es zu ueberdecken.
    var T = K.terrasse;
    if (T && scene.textures.exists('hub_stuetzmauer')) {
      var unten = T.y + T.h;                        // erste Platzzeile
      var quelle = scene.textures.get('hub_stuetzmauer').getSourceImage();
      var seitenverh = quelle.width / quelle.height;
      var laeufe = [[T.x, T.treppeX], [T.treppeX + T.treppeB, T.x + T.b]];
      laeufe.forEach(function (lauf) {
        var lang = lauf[1] - lauf[0];
        if (lang <= 0) return;
        // Soviele Stuecke, dass jedes etwa 2 Kacheln hoch wird.
        var n = Math.max(1, Math.round(lang / (2 * seitenverh)));
        var b = lang / n;
        for (var i = 0; i < n; i++) {
          var m = _stellen(scene, 'hub_stuetzmauer', lauf[0] + b * (i + 0.5), unten, b);
          if (m) erg.haeuser.push(m);
        }
      });
      var tr = _stellen(scene, 'hub_freitreppe', T.treppeX + T.treppeB / 2, unten,
        T.treppeB, false, null, (T.y + 1) * K.kachel);
      if (tr) erg.haeuser.push(tr);
    }

    (K.haeuser || []).forEach(function (h) {
      var b = _stellen(scene, h.bild, h.x, h.y, h.breite, false, h.farbe);
      if (b) erg.haeuser.push(b);
    });

    erg.lichter = [];
    (K.requisiten || []).forEach(function (r) {
      var mass = r.hoehe ? { hoehe: r.hoehe } : r.breite;
      var tiefe = r.boden ? TIEFE_BODEN + 2 : undefined;
      var b = _stellen(scene, r.bild, r.x, r.y, mass, r.spiegeln, null, tiefe, !!r.anim);
      if (!b) return;
      erg.requisiten.push(b);
      if (r.anim) _abspielen(scene, b, r);
      // Die Flamme sitzt im Bild, nicht am Fuss: Anteil von oben.
      if (r.licht) {
        var g = b.getBounds();
        erg.lichter.push(_schein(scene, b.x, g.y + g.height * r.licht, 1.3, b.depth + 1));
      }
    });
    (K.lichter || []).forEach(function (l) {
      // tiefe: ueber welchem Bau der Schein liegt (Kachelzeile seiner
      // Standlinie). Ohne sie laege die Esse-Glut unter der Werkstatt.
      var t = (l.tiefe != null ? l.tiefe : l.y) * K.kachel;
      erg.lichter.push(_schein(scene, l.x * K.kachel, l.y * K.kachel, l.r || 1.3, t));
    });
    erg.lichter = erg.lichter.filter(Boolean);
    _flackern(scene, erg.lichter);

    // Waldrand: auf die Grasflaechen Baeume streuen. Der begehbare Platz
    // bleibt frei, weil Gras nur dort liegt, wo niemand laufen soll.
    var daBaum = BAUM_BILDER.filter(function (k) { return scene.textures.exists(k); });
    if (daBaum.length) {
      for (var ty = -SAUM; ty < K.hoehe; ty++) {
        for (var tx = 0; tx < K.breite; tx++) {
          // Nur auf Wald ('g'). Unter dem Rathaus liegt auch Wiese ('R'),
          // aber dort wuerden Baeume aus seinem Sockel wachsen.
          if (zeichenAn(K, tx, ty) !== 'g') continue;
          var w = streu(tx, ty, 11);
          if (w > 0.72) continue;                 // Luecken lassen
          var bx = tx + 0.5 + (streu(tx, ty, 17) - 0.5) * 0.7;
          var by = ty + 1 + (streu(tx, ty, 19) - 0.5) * 0.5;
          var key = daBaum[Math.floor(w * daBaum.length) % daBaum.length];
          var bb = _stellen(scene, key, bx, by, 1.4 + w * 0.9, w > 0.36);
          if (bb) erg.baeume.push(bb);
        }
      }
    }

    var W = welt();
    erg.nebel = _nebel(scene, W.breite, W.hoehe);
    return erg;
  }

  /**
   * #186: Wo steht man, wenn man aus einem Gebaeude zurueck auf den Platz
   * tritt? Knapp VOR seiner Tuer — auf freiem Boden und ausserhalb jeder
   * Tuerzone, sonst stuende man schon wieder vor dem [E] der Tuer, aus der
   * man gerade kommt.
   *
   * Alles in Weltpixeln. Gesucht wird von der Unterkante der Tuer abwaerts,
   * auf jeder Hoehe zuerst mittig, dann abwechselnd links und rechts; der
   * erste freie Punkt gewinnt. So bleibt man so nah an der Tuer wie moeglich.
   *
   * @param {{x,y,w,h}} tuer        die Tuerzone, aus der man kommt
   * @param {{x,y,w,h}} umriss      Bildumriss der Figur relativ zu ihrem Ursprung
   *                                (daran misst der Hub die [E]-Naehe)
   * @param {{x,y,w,h}} koerper     Physikkoerper relativ zum Ursprung
   * @param {Array<{x,y,w,h}>} hindernisse  feste Flaechen
   * @param {Array<{x,y,w,h}>} zonen        alle Tuerzonen
   * @param {{breite,hoehe}} grenzen        Weltgroesse
   * @returns {{x,y}|null} Ursprung der Figur, oder null wenn nichts frei ist
   */
  function platzVorTuer(tuer, umriss, koerper, hindernisse, zonen, grenzen) {
    if (!tuer || !umriss || !koerper) return null;
    var LUFT = 2, SCHRITT = 4, TIEFE = 160, BREITE = 160;
    var ueber = function (a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    };
    var cx = tuer.x + tuer.w / 2;
    // Oberkante des Umrisses knapp unter der Tuerzone.
    var y0 = tuer.y + tuer.h + LUFT - umriss.y;
    for (var dy = 0; dy <= TIEFE; dy += SCHRITT) {
      for (var i = 0; i <= BREITE / SCHRITT * 2; i++) {
        var dx = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * SCHRITT;
        var x = cx + dx, y = y0 + dy;
        // Mit etwas Luft: buendig an einer Kante bliebe die Figur haengen.
        var k = { x: x + koerper.x - LUFT, y: y + koerper.y - LUFT, w: koerper.w + 2 * LUFT, h: koerper.h + 2 * LUFT };
        if (grenzen && (k.x < 0 || k.y < 0 || k.x + k.w > grenzen.breite || k.y + k.h > grenzen.hoehe)) continue;
        var u = { x: x + umriss.x, y: y + umriss.y, w: umriss.w, h: umriss.h };
        var frei = true, j;
        for (j = 0; frei && j < (hindernisse || []).length; j++) if (ueber(k, hindernisse[j])) frei = false;
        for (j = 0; frei && j < (zonen || []).length; j++) if (ueber(u, zonen[j])) frei = false;
        if (frei) return { x: x, y: y };
      }
    }
    return null;
  }

  var HubNeuWelt = {
    welt: welt, vorladen: vorladen, platzVorTuer: platzVorTuer,
    layoutUebernehmen: layoutUebernehmen, bauen: bauen, truheStellen: truheStellen, phasenAnker: phasenAnker,
    aktionsbox: aktionsbox,
    _streu: streu, _festeFlaechen: _festeFlaechen, _artAn: artAn, _SCHICHTEN: SCHICHTEN
  };
  if (typeof window !== 'undefined') window.HubNeuWelt = HubNeuWelt;
  if (typeof module !== 'undefined' && module.exports) module.exports = HubNeuWelt;
})();
