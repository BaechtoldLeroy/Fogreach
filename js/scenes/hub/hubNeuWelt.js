/* =====================================================================
 * hubNeuWelt.js — den Marktplatz aus der Karte bauen (#181)
 * ---------------------------------------------------------------------
 * ERREICHBAR NUR UEBER DIE ADRESSE: ?debug=1&hubneu=1. Ohne die Flagge
 * laedt nichts nach und aendert sich nichts. Der Platz ist das Erste,
 * was ein Spieler sieht; ein halbfertiger Umbau waere dort der teuerste
 * aller Fehler.
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
  var TIEFE_NEBEL = 95;

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

  var REQUISITEN_BILDER = ['brunnen', 'bank', 'laterne', 'kuebel', 'fass', 'kisten',
    'schild', 'karren', 'stand', 'tafel', 'statue', 'trog', 'holz', 'kiefer',
    'baum', 'schutt'];
  var BAU_BILDER = ['rathaus_sockel', 'werkstatt', 'druckerei', 'kate_a', 'kate_b',
    'stuetzmauer', 'freitreppe'];
  var BAUM_BILDER = ['hub_kiefer', 'hub_baum'];

  /** Ist der neue Hub eingeschaltet? Nur ueber die Adresse, nie im Spielstand. */
  function aktiv() {
    try { return !!(window.DebugGate && window.DebugGate.an('hubneu')); }
    catch (e) { return false; }
  }

  function karte() { return (typeof window !== 'undefined') ? window.HUB_NEU_KARTE : null; }

  /** Die Weltmasse des neuen Platzes — HubSceneV2 setzt Kamera und Physik danach. */
  function welt() {
    var K = karte();
    if (!K) return null;
    // oben: wie weit die Kamera UEBER den Kartenrand hinaussehen darf.
    // Das Rathaus steht mit dem Fuss auf Zeile 7 und ist hoeher als das,
    // was ueber ihm liegt — ohne diese Luft wuerde sein Dach abgeschnitten.
    // Die Physik bleibt bei 0: hinauslaufen kann niemand.
    return { breite: K.breite * K.kachel, hoehe: K.hoehe * K.kachel, oben: -240 };
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
    if (!aktiv()) return null;
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
    if (!aktiv() || !scene || !scene.load || !scene.textures) return 0;
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
    BAU_BILDER.concat(REQUISITEN_BILDER).forEach(function (b) {
      nimm('hub_' + b, 'assets/hub/' + b + '.png');
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
    var rt = scene.add.renderTexture(0, 0, K.breite * z, K.hoehe * z).setOrigin(0, 0);
    rt.setDepth(TIEFE_BODEN);
    var stapel = (typeof rt.beginDraw === 'function');
    var male = function (key, x, y) {
      if (!scene.textures.exists(key)) return;
      if (stapel) rt.batchDraw(key, x, y); else rt.draw(key, x, y);
    };
    if (stapel) rt.beginDraw();

    var tx, ty;
    // Grund: Erde ueberall, wo ueberhaupt Boden ist.
    for (ty = 0; ty < K.hoehe; ty++) {
      for (tx = 0; tx < K.breite; tx++) {
        if (artAn(K, tx, ty)) male(ERDE, tx * z, ty * z);
      }
    }
    // Darueber die Schichten, jede mit ihren Uebergaengen.
    SCHICHTEN.forEach(function (s, si) {
      for (ty = 0; ty < K.hoehe; ty++) {
        for (tx = 0; tx < K.breite; tx++) {
          if (!artAn(K, tx, ty)) continue;
          var m = (_ecke(K, s.oben, tx, ty) << 3)
            | (_ecke(K, s.oben, tx + 1, ty) << 2)
            | (_ecke(K, s.oben, tx, ty + 1) << 1)
            | _ecke(K, s.oben, tx + 1, ty + 1);
          if (m === 0) continue;
          if (m === 15) {
            var f = s.flaeche;
            male(f[Math.floor(streu(tx, ty, 3 + si) * f.length) % f.length], tx * z, ty * z);
          } else {
            male('hub_ueber_' + s.name + m, tx * z, ty * z);
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
    var bild = scene.add.image(px, py, key).setOrigin(0.5, 1);
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

  /** Den ganzen Platz bauen. Gibt zurueck, was entstanden ist. */
  function bauen(scene) {
    if (!aktiv() || !scene || !scene.add) return null;
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

    (K.requisiten || []).forEach(function (r) {
      var b = _stellen(scene, r.bild, r.x, r.y, r.hoehe ? { hoehe: r.hoehe } : r.breite, r.spiegeln);
      if (b) erg.requisiten.push(b);
    });

    // Waldrand: auf die Grasflaechen Baeume streuen. Der begehbare Platz
    // bleibt frei, weil Gras nur dort liegt, wo niemand laufen soll.
    var daBaum = BAUM_BILDER.filter(function (k) { return scene.textures.exists(k); });
    if (daBaum.length) {
      for (var ty = 0; ty < K.hoehe; ty++) {
        for (var tx = 0; tx < K.breite; tx++) {
          if (artAn(K, tx, ty) !== 'gras') continue;
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

  var HubNeuWelt = {
    aktiv: aktiv, welt: welt, vorladen: vorladen,
    layoutUebernehmen: layoutUebernehmen, bauen: bauen,
    _streu: streu, _festeFlaechen: _festeFlaechen, _artAn: artAn, _SCHICHTEN: SCHICHTEN
  };
  if (typeof window !== 'undefined') window.HubNeuWelt = HubNeuWelt;
  if (typeof module !== 'undefined' && module.exports) module.exports = HubNeuWelt;
})();
