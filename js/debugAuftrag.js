/* =====================================================================
 * debugAuftrag.js — Debug ?auftrag=<questId>: einen Auftrag direkt testen
 * ---------------------------------------------------------------------
 * Ein Auftrag aus Akt 3 oder 4 liegt sonst Stunden entfernt: Vorgaenger,
 * Akt, erreichte Tiefe, Story-Flaggen. Die Flagge stellt beim Betreten des
 * Hubs genau den Stand her, den der Auftrag braucht, und nimmt ihn an.
 *
 *   ?auftrag=<id>          Vorgaenger (rekursiv) erledigt, Flaggen der Tore
 *                          gesetzt, Akt >= requiredAct, erreichte Tiefe >=
 *                          minDepth/angebotAb; der Auftrag laeuft, Ziele auf 0
 *   &auftragfast=1         alle Ziele voll bis auf das letzte, dem eine
 *                          Einheit fehlt: ein echter Schritt, dann abgeben
 *
 * Mit ?dungeon=N kombinierbar: der Hub wendet die Flagge an, BEVOR er in den
 * Keller absteigt (HubSceneV2.create, vor dem verzoegerten Abstieg).
 *
 * Veraendert den Spielstand wie ?versteck=. Haengt am DebugGate (#88).
 * ===================================================================== */
(function () {
  'use strict';

  var _angewendet = false;   // einmal pro Laden, nicht bei jedem Hub-Eintritt

  // Versteck-Besuche, die sonst den naechsten Kellerraum belegen wuerden —
  // beim gezielten Test eines Auftrags stehen sie nur im Weg.
  var VERSTECK_GESEHEN = {
    versteck: 'elara_versteck_gesehen',
    werkstatt: 'elara_camp_seen',
    bruch_nacht: 'bruch_nacht_gesehen'
  };

  // Was ein Auftrag ausser Queststand noch braucht, um ueber den echten Weg
  // fortzuschreiten.
  var VORBEREITUNG = {
    // Die Presse: Druckerei offen, Blaetter fuer ein riskantes Edikt, und
    // kein haengendes Edikt, das den Druck sperrt.
    thom_gegenedikt: function (fertig) {
      fertig('aldric_cleanup');
      return function () {
        var P = window.PrintingHouse;
        if (!P) return;
        try { P.clearActivePublication(); } catch (e) {}
        var fehlt = 5 - ((typeof P.getDruckblaetter === 'function') ? P.getDruckblaetter() : 0);
        if (fehlt > 0) { try { P.addDruckblaetter(fehlt); } catch (e) {} }
      };
    }
  };

  function _warn(text) {
    try { if (typeof console !== 'undefined' && console.warn) console.warn('[Auftrag] ' + text); } catch (e) {}
  }

  function _elaraListe() {
    if (Array.isArray(window.ELARA_AUFTRAEGE)) return window.ELARA_AUFTRAEGE;
    return (typeof ELARA_AUFTRAEGE !== 'undefined' && Array.isArray(ELARA_AUFTRAEGE)) ? ELARA_AUFTRAEGE : [];
  }

  /**
   * Die Flaggen, die ein Tor verlangt, aus seinem Quelltext gelesen:
   * `!!questFlags.x` will x gesetzt, `!questFlags.x` will es aus. Tore ueber
   * andere Systeme (Anschlagtafel, Stufe) liefern nichts.
   */
  function torFlaggen(def) {
    var out = {};
    if (!def || typeof def.gate !== 'function') return out;
    var re = /(!!|!)\s*questFlags\.(\w+)/g, m, src = String(def.gate);
    while ((m = re.exec(src)) !== null) out[m[2]] = (m[1] === '!!');
    return out;
  }

  /**
   * Stellt den Stand fuer einen Auftrag her und nimmt ihn an.
   * @param {string} id
   * @param {{fast?: boolean}} [opts]
   * @returns {{id:string, fertig:string[], akt:number}|null} null bei unbekannter ID
   */
  function standSetzen(id, opts) {
    var qs = window.questSystem;
    var defs = qs && qs.QUEST_DEFINITIONS;
    if (!defs || typeof qs.getQuestSaveData !== 'function') return null;
    var def = defs[id];
    if (!def) {
      _warn('unbekannt: ' + id + ' — z. B. ' + Object.keys(defs).slice(-8).join(', '));
      return null;
    }
    var fast = !!(opts && opts.fast);

    var fertig = [];
    var fertigMachen = function (q) {
      if (!defs[q] || q === id || fertig.indexOf(q) >= 0) return;
      (defs[q].prerequisites || []).forEach(fertigMachen);
      fertig.push(q);
    };
    (def.prerequisites || []).forEach(fertigMachen);
    // Elara vergibt im Keller der Reihe nach (roomManager, ELARA_AUFTRAEGE):
    // ein offener frueherer Auftrag bringt sie mit DEM statt mit diesem.
    var elara = _elaraListe();
    var pos = elara.indexOf(id);
    for (var i = 0; i < pos; i++) fertigMachen(elara[i]);
    var nachher = VORBEREITUNG[id] ? VORBEREITUNG[id](fertigMachen) : null;

    var st = qs.getQuestSaveData();
    st.quests = st.quests || {};
    st.flags = st.flags || {};
    var voll = function (d) {
      return d.objectives.map(function (o) { return { type: o.type, target: o.target, current: o.required, required: o.required }; });
    };
    fertig.forEach(function (q) {
      var d = defs[q];
      st.quests[q] = { status: 'completed', objectives: voll(d) };
      (d.completionFlags || []).forEach(function (f) { st.flags[f] = true; });
      // Ein erledigter Auftrag war einmal angeboten: was sein Tor gesetzt
      // verlangte, gilt. (Was es aus verlangte, darf spaeter gekippt sein.)
      var tf = torFlaggen(d);
      Object.keys(tf).forEach(function (f) { if (tf[f]) st.flags[f] = true; });
    });
    var eigene = torFlaggen(def);
    Object.keys(eigene).forEach(function (f) { st.flags[f] = eigene[f]; });

    var ziele = def.objectives.map(function (o) { return { type: o.type, target: o.target, current: 0, required: o.required }; });
    if (fast) {
      ziele.forEach(function (o, k) { o.current = (k === ziele.length - 1) ? Math.max(0, o.required - 1) : o.required; });
    }
    st.quests[id] = { status: 'active', objectives: ziele,
      abTiefe: (typeof def.minDepth === 'number') ? def.minDepth : null };
    qs.loadQuestSaveData(st);

    // Akt: loadQuestSaveData zieht die advanceAct der Vorgaenger nach, der
    // Rest kommt von requiredAct. Die Aktkarten gelten als gesehen — sonst
    // deckt die Karte des Zielakts den Hub zu.
    var S = window.storySystem;
    if (S && typeof S.advanceToAct === 'function' && typeof def.requiredAct === 'number') {
      try { S.advanceToAct(def.requiredAct); } catch (e) {}
    }
    var akt = (S && typeof S.getCurrentActIndex === 'function') ? S.getCurrentActIndex() : 0;
    if (S && typeof S.getStorySaveData === 'function' && Array.isArray(S.STORY_ACTS)) {
      var sd = S.getStorySaveData();
      S.STORY_ACTS.slice(0, akt + 1).forEach(function (a) {
        if (sd.eventsSeen.indexOf(a.id) < 0) sd.eventsSeen.push(a.id);
      });
      sd.pendingEvent = null; sd.pendingQueue = [];
      S.loadStorySaveData(sd);
    }

    // Erreichte Tiefe: Angebot und Mindesttiefe sollen nicht im Weg stehen.
    var tiefe = Math.max(def.minDepth | 0, def.angebotAb | 0);
    var P = window.Persistence;
    if (tiefe > 1 && P && P.KEYS && typeof P.getMaxDepth === 'function' && P.getMaxDepth() < tiefe) {
      try { (window.SlotStorage || localStorage).setItem(P.KEYS.MAX_DEPTH, String(tiefe)); } catch (e) {}
    }

    // Faellige Versteck-Besuche als gesehen markieren (hoechstens alle drei).
    for (var n = 0; n < 3 && typeof window.versteckBesuchFaellig === 'function'; n++) {
      var besuch = window.versteckBesuchFaellig();
      if (!besuch || !VERSTECK_GESEHEN[besuch]) break;
      qs.setFlag(VERSTECK_GESEHEN[besuch], true);
    }
    if (nachher) nachher();

    var jetzt = (qs.getQuestSaveData().quests[id] || {}).status;
    if (jetzt !== 'active') {
      _warn(id + ' laeuft nicht (' + jetzt + ') — der Spielstand widerspricht ihm (z. B. nach dem Bruch'
        + ' oder dem Maulwurf). Mit &autostart=1 oder &dungeon=N auf frischem Stand starten.');
    }
    try { console.log('[Auftrag] ' + id + ' angenommen' + (fast ? ' (fast)' : '') + ', Akt ' + akt
      + ', erledigt: ' + (fertig.join(', ') || 'nichts')); } catch (e) {}
    if (typeof window.saveGame === 'function') { try { window.saveGame(); } catch (e) {} }
    return { id: id, fertig: fertig, akt: akt };
  }

  /**
   * Liest ?auftrag= (nur bei offenem DebugGate) und wendet ihn einmal pro
   * Laden an. Ruft HubSceneV2.create nach dem Laden des Spielstands.
   */
  function anwenden() {
    if (_angewendet) return null;
    var G = window.DebugGate;
    var id = G ? G.flagge('auftrag') : null;   // flagge() sperrt bei geschlossenem Gate
    if (!id) return null;
    _angewendet = true;
    return standSetzen(String(id).trim(), { fast: G.an('auftragfast') });
  }

  window.DebugAuftrag = {
    anwenden: anwenden,
    standSetzen: standSetzen,
    torFlaggen: torFlaggen,
    _vergessen: function () { _angewendet = false; }
  };
})();
