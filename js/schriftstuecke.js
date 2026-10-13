/* =====================================================================
 * schriftstuecke.js — Bilder, Schein und Aufsammel-Toast der Schriftstuecke
 * ---------------------------------------------------------------------
 * Schriftstuecke sind alles Geschriebene, das man im Keller aufhebt:
 *
 *   fragment  Wissensfragment (Ereignis lore_fragment) -> Wissensbaum bei Mara
 *   rolle     Versiegeltes Ratsdokument (council_document)
 *   blatt     Protokoll-Abschrift (document)
 *   brief     Verhoerprotokoll (interrogation_record)
 *   seite     Tagebuchfragment der Tochter (journal_fragment)
 *   stapel    Beschlagnahmte Schriften (seized_writings)
 *
 * Vorher lag das Wissensfragment als gezeichnete Rolle (proc_scroll) mit
 * gelbem Kreis da, die Quest-Schriften als eingefaerbter Erzbrocken (itMat)
 * — ein Protokoll sah aus wie ein Stein. Jetzt traegt jede Art ein eigenes
 * Pixelbild (PixelLab, assets/tiles/schrift_*.png) und einen warmen Schein,
 * damit man sie im Nebel findet: Licht und Schrift durchdringen ihn.
 *
 * Fehlt ein Bild (Laden gescheitert), bleibt alles wie vorher: die Aufrufer
 * fragen bild() und behalten sonst ihre alte Darstellung.
 * ===================================================================== */
(function () {
  'use strict';

  if (window.i18n) {
    window.i18n.register('de', {
      'schrift.art.fragment': 'Wissensfragment',
      'schrift.hinweis.wissensbaum': 'Wissensfragment · +1 für den Wissensbaum bei Mara',
      'schrift.hinweis.auftrag': 'Für den Auftrag „{title}“ · steht im Journal (J)',
      'schrift.hinweis.journal': 'Steht im Journal (J)',
      'schrift.titel.1': 'Flüsternde Namen',
      'schrift.titel.2': 'Der ältere Pakt',
      'schrift.titel.3': 'Vom Siegel',
      'schrift.titel.4': 'Was die Tiere wussten',
      'schrift.titel.5': 'Verbrannte Seiten',
      'schrift.titel.6': 'Bericht der Gräber',
      'schrift.titel.fragment_lost_history': 'Die falsche Chronik',
      'schrift.titel.fragment_council_pact': 'Drei Siegel, eine Unterschrift',
      'schrift.titel.fragment_personal_amnesia': 'Zwei Listen'
    });
    window.i18n.register('en', {
      'schrift.art.fragment': 'Knowledge fragment',
      'schrift.hinweis.wissensbaum': 'Knowledge fragment · +1 for Mara\'s knowledge tree',
      'schrift.hinweis.auftrag': 'For the quest “{title}” · see your journal (J)',
      'schrift.hinweis.journal': 'Added to your journal (J)',
      'schrift.titel.1': 'Whispered Names',
      'schrift.titel.2': 'The Older Pact',
      'schrift.titel.3': 'Of the Seal',
      'schrift.titel.4': 'What the Animals Knew',
      'schrift.titel.5': 'Burned Pages',
      'schrift.titel.6': 'The Diggers\' Account',
      'schrift.titel.fragment_lost_history': 'The False Chronicle',
      'schrift.titel.fragment_council_pact': 'Three Seals, One Signature',
      'schrift.titel.fragment_personal_amnesia': 'Two Lists'
    });
  }
  function T(key, params) {
    return (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key, params) : key;
  }

  var ORDNER = 'assets/tiles/';
  // Art -> Bildschluessel (= Dateiname ohne .png).
  var BILDER = {
    fragment: 'schrift_fragment',
    rolle: 'schrift_rolle',
    blatt: 'schrift_blatt',
    brief: 'schrift_brief',
    seite: 'schrift_seite',
    stapel: 'schrift_stapel'
  };
  // Questziel (fetch-target) -> Art. Nur Geschriebenes; Druckplatte, Siegel,
  // Splitter, Halsband, Gewicht und das Buendel bleiben, wie sie sind.
  var ZIEL_ART = {
    document: 'blatt',
    council_document: 'rolle',
    journal_fragment: 'seite',
    seized_writings: 'stapel',
    interrogation_record: 'brief'
  };
  // Am Boden so gross wie die uebrigen Funde (Quest-Erz 28x22, Rolle 32).
  var ANZEIGE = 30;
  var SCHEIN = 'schrift_schein';

  /** Im preload(): die Bilder unter ihrem Namen laden (nur die fehlenden). */
  function vorladen(scene) {
    if (!scene || !scene.load || !scene.textures) return;
    Object.keys(BILDER).forEach(function (a) {
      var k = BILDER[a];
      if (!scene.textures.exists(k)) scene.load.image(k, ORDNER + k + '.png');
    });
  }

  /** Bildschluessel einer Art, oder null, wenn das Bild nicht geladen ist. */
  function bild(scene, art) {
    var k = BILDER[art];
    if (!k || !scene || !scene.textures || !scene.textures.exists(k)) return null;
    return k;
  }

  function artFuerZiel(ziel) { return ZIEL_ART[ziel] || null; }

  /**
   * Der warme Schein: ein weicher Lichtfleck als eigene Textur (einmal je
   * Spiel). Ein Verlauf statt zweier harter Kreise — die alten gelben
   * Scheiben lasen sich wie ein Fleck auf dem Boden, nicht wie Licht.
   */
  function _scheinTextur(scene) {
    if (scene.textures.exists(SCHEIN)) return true;
    try {
      var tex = scene.textures.createCanvas(SCHEIN, 64, 64);
      var ctx = tex.getContext();
      var g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(255, 214, 140, 0.55)');
      g.addColorStop(0.45, 'rgba(255, 180, 90, 0.22)');
      g.addColorStop(1, 'rgba(255, 160, 70, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      tex.refresh();
      return true;
    } catch (e) { return false; }
  }

  /** Schein unter einen Fund legen; pulsiert leise. Liefert das Bild oder null. */
  function schein(scene, x, y, tiefe) {
    if (!scene || !scene.add || !scene.textures || !_scheinTextur(scene)) return null;
    var s = scene.add.image(x, y, SCHEIN).setDisplaySize(72, 72).setDepth(tiefe);
    if (scene.tweens) {
      scene.tweens.add({ targets: s, alpha: { from: 1, to: 0.55 }, duration: 1400,
        yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      // Endloses Pulsieren nicht auf einem zerstoerten Bild weiterlaufen lassen.
      s.once('destroy', function () { try { scene.tweens.killTweensOf(s); } catch (e) {} });
    }
    return s;
  }

  /**
   * Ein Quest-Beutestueck als Schriftstueck einkleiden: eigenes Bild statt
   * eingefaerbtem Erz, Schein darunter. Ohne Bild bleibt es beim Alten.
   * @returns {boolean} ob eingekleidet wurde
   */
  function schmuecken(scene, sprite, ziel) {
    var art = artFuerZiel(ziel);
    var k = bild(scene, art);
    if (!k || !sprite || typeof sprite.setTexture !== 'function') return false;
    sprite.setTexture(k);
    sprite.clearTint();
    sprite.setDisplaySize(ANZEIGE, ANZEIGE);
    sprite.setData('schriftArt', art);
    var licht = schein(scene, sprite.x, sprite.y, (sprite.depth || 45) - 1);
    if (licht) {
      sprite.setData('schriftSchein', licht);
      // Der Schein geht mit dem Fund: beim Aufheben, beim Raumwechsel
      // (lootGroup.clear) und beim Szenenende.
      var weg = function () { try { if (licht.scene) licht.destroy(); } catch (e) {} };
      sprite.once('destroy', weg);
      if (scene.events) scene.events.once('shutdown', weg);
    }
    return true;
  }

  /** Titel des Auftrags, fuer den ein Fund zaehlt (oder ''). */
  function auftragFuer(ziel) {
    var QS = window.questSystem;
    if (!QS || typeof QS.getActiveQuests !== 'function') return '';
    try {
      var q = QS.getActiveQuests().filter(function (s) {
        return (s.objectives || []).some(function (o) {
          return o.type === 'fetch' && o.target === ziel;
        });
      })[0];
      if (!q) return '';
      var def = QS.QUEST_DEFINITIONS && QS.QUEST_DEFINITIONS[q.id];
      return (def && QS.getQuestField && QS.getQuestField(def, 'title')) || (def && def.title) || '';
    } catch (e) { return ''; }
  }

  /** Der Aufsammel-Toast: Titel gross, darunter wohin es geht. */
  function toast(scene, titel, hinweis) {
    var ES = window.EventSystem;
    if (!ES || typeof ES.showEventToast !== 'function') return;
    ES.showEventToast(scene, titel, 'schriftstueck', false, { unter: hinweis });
  }

  /**
   * Beim Aufheben eines Quest-Beutestuecks (loot.js). Muss VOR dem
   * Quest-Fortschritt laufen: ist das Ziel danach erfuellt, uebernimmt der
   * "Quest-Ziel erfuellt"-Toast — der wichtigere — denselben Platz.
   * @returns {boolean} ob es ein Schriftstueck war
   */
  function aufgesammelt(scene, item) {
    if (!item || !artFuerZiel(item.questTarget)) return false;
    var titel = item.nameKey ? T(item.nameKey) : (item.name || '');
    var auftrag = auftragFuer(item.questTarget);
    toast(scene, titel, auftrag ? T('schrift.hinweis.auftrag', { title: auftrag }) : T('schrift.hinweis.journal'));
    return true;
  }

  /** Titel eines Wissensfragments aus seinem Textschluessel. */
  function fragmentTitel(textKey) {
    var k = 'schrift.titel.' + String(textKey || '').replace('event.lore.text.', '');
    var t = T(k);
    return (t && t !== k) ? t : T('schrift.art.fragment');
  }

  window.Schriftstuecke = {
    BILDER: BILDER,
    ZIEL_ART: ZIEL_ART,
    ANZEIGE: ANZEIGE,
    vorladen: vorladen,
    bild: bild,
    artFuerZiel: artFuerZiel,
    schein: schein,
    schmuecken: schmuecken,
    toast: toast,
    aufgesammelt: aufgesammelt,
    fragmentTitel: fragmentTitel
  };
})();
