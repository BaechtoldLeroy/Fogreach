// Hub layout data: collision shapes for the city background, location entrances,
// and NPC definitions. Pure data — no Phaser dependencies.
// Loaded into window.HUB_HITBOXES so HubSceneV2 can read it.

if (window.i18n) {
  window.i18n.register('de', {
    'hub.entrance.rathaus': 'Rathauskeller [E]',
    'hub.entrance.schmiede': 'Werkstatt [E]',
    'hub.entrance.druckerei': 'Druckerei [E]',
    'hub.npc.branka.name': 'Schmiedemeisterin Branka',
    'hub.npc.thom.name': 'Setzer Thom',
    'hub.npc.mara.name': 'Mara vom Untergrund',
    'hub.npc.aldric.name': 'Ratsherr Aldric',
    'hub.npc.elara.name': 'Elara',
    'hub.npc.harren.name': 'Bürgermeister Harren',
    'hub.npc.klerus_priester.name': 'Priester des Klerus',
    'hub.npc.stadtwache.name': 'Hauptmann der Stadtwache',
    'hub.npc.buerger.name': 'Ratloser Bürger',
    // Default greeting lines (shown when no quest is active). Quest-aware
    // lines come from storySystem NPC_DIALOGUE.
    'hub.npc.aldric.line.0': 'Willkommen zurück, Archivschmied. Der Rat schätzt deine Dienste.',
    'hub.npc.aldric.line.1': 'Nebenhall ist sicher, solange der Rat wacht. Vergiss das nicht.',
    'hub.npc.aldric.line.2': 'Du hast Talent. Der Rat könnte jemanden wie dich gut gebrauchen — langfristig.',
    'hub.npc.elara.line.0': 'Du erinnerst dich nicht an mich, oder? Ich... kannte dich. Vor dem Unfall.',
    'hub.npc.elara.line.1': 'Frag nicht den Rat. Frag die Mauern. Sie erinnern sich besser als Menschen.',
    'hub.npc.harren.line.0': 'Meine Tochter Elara... sie ist verschwunden. Bitte, hilf mir sie zu finden.',
    'hub.npc.harren.line.1': 'Ich war einst stolz auf diese Stadt. Jetzt erkenne ich sie kaum wieder.'
  });
  window.i18n.register('en', {
    'hub.entrance.rathaus': 'Town Hall Cellar [E]',
    'hub.entrance.schmiede': 'Workshop [E]',
    'hub.entrance.druckerei': 'Print Shop [E]',
    'hub.npc.branka.name': 'Smith Master Branka',
    'hub.npc.thom.name': 'Setter Thom',
    'hub.npc.mara.name': 'Mara of the Underground',
    'hub.npc.aldric.name': 'Councillor Aldric',
    'hub.npc.elara.name': 'Elara',
    'hub.npc.harren.name': 'Mayor Harren',
    'hub.npc.klerus_priester.name': 'Priest of the Clergy',
    'hub.npc.stadtwache.name': 'City Watch Captain',
    'hub.npc.buerger.name': 'Bewildered Citizen',
    'hub.npc.aldric.line.0': 'Welcome back, Archivesmith. The council values your service.',
    'hub.npc.aldric.line.1': 'The side hall is safe as long as the council watches. Do not forget that.',
    'hub.npc.aldric.line.2': 'You have talent. The council could use someone like you — in the long run.',
    'hub.npc.elara.line.0': "You don't remember me, do you? I... knew you. Before the accident.",
    'hub.npc.elara.line.1': 'Do not ask the council. Ask the walls. They remember better than people do.',
    'hub.npc.harren.line.0': 'My daughter Elara... she has disappeared. Please, help me find her.',
    'hub.npc.harren.line.1': 'I was once proud of this city. Now I barely recognize it.'
  });
}

// i18n helpers used by HubSceneV2 to resolve labels lazily — module-load
// language may differ from active language at render time.
const _hubT = (key, fallback) => {
  if (!window.i18n) return fallback;
  // Suppress noisy missing-key warning from t() during fallback path: check
  // the active dict directly via a probe register call (no-op merge) and
  // only call t() when we know the key exists.
  const v = window.i18n.t(key);
  return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : fallback;
};
// Silent existence check — avoids triggering [i18n] missing key warnings.
// Inspects the live dictionaries the i18n module would consult.
const _hubHasKey = (key) => {
  if (!window.i18n || typeof window.i18n.t !== 'function') return false;
  // Re-register a probe value? No, that overwrites. Instead, redirect t() to
  // a quiet probe by using a private flag the i18n module may not expose.
  // Fallback: do the t() call but stash + restore console.warn briefly.
  const _origWarn = console.warn;
  console.warn = function () {};
  try {
    const v = window.i18n.t(key);
    return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0);
  } finally {
    console.warn = _origWarn;
  }
};

window.HUB_HITBOXES = {
  colliders: [
    { id: 'city_silhouette_wall', x: 0,   y: 200, w: 960, h: 92 },
    { id: 'rathaus_body',         x: 368, y: 110, w: 224, h: 168 },
    { id: 'rathaus_steps',        x: 430, y: 280, w: 100, h: 16 },
    // Brunnen: deckt jetzt das ganze Steinbecken (vorher nur obere Haelfte).
    { id: 'fountain',             x: 420, y: 352, w: 100, h: 48 },
    // Planter: auf die Sockelbuesche links/rechts der Rathaustuer geschoben.
    { id: 'planter_left',         x: 388, y: 294, w: 38,  h: 22 },
    { id: 'planter_right',        x: 534, y: 294, w: 38,  h: 22 },
    { id: 'bench_left',           x: 390, y: 484, w: 48,  h: 16 },
    { id: 'bench_right',          x: 522, y: 484, w: 48,  h: 16 },
    // archivschmiede_body war ~100px zu weit rechts (unsymmetrisch zur
    // druckerei) — auf das Gebaeude zurueckgeschoben (x 220 -> 160).
    { id: 'archivschmiede_body',  x: 160, y: 244, w: 148, h: 62 },
    { id: 'druckerei_body',       x: 652, y: 244, w: 148, h: 62 },
    // Die zwei unteren Cottages hatten gar keinen Collider (man lief hindurch).
    // Hitbox nur am Haus-Sockel, damit NPCs oberhalb (Harren/Elara) ansprechbar
    // bleiben und der Spieler von unten davor stoppt.
    { id: 'cottage_left',         x: 110, y: 500, w: 160, h: 45 },
    { id: 'cottage_right',        x: 690, y: 500, w: 160, h: 45 },
    // Fuss-Collider der zwei Strassenlaternen (vorher durchlaufbar).
    { id: 'lamp_left',            x: 340, y: 438, w: 16,  h: 12 },
    { id: 'lamp_right',           x: 602, y: 438, w: 16,  h: 12 },
    // Wald-Raender links/rechts unterhalb der Stadtmauer (vorher lief man in
    // die Baeume). Reichen bis zur Kante der jeweiligen Cottage; oberhalb blockt
    // bereits city_silhouette_wall.
    { id: 'forest_left',          x: 0,   y: 292, w: 110, h: 348 },
    { id: 'forest_right',         x: 850, y: 292, w: 110, h: 348 }
  ],
  entrances: [
    { id: 'rathaus_entrance',   x: 452, y: 296, w: 56, h: 26, label: 'Rathauskeller [E]', target: 'GameScene' },
    { id: 'schmiede_entrance',  x: 292, y: 318, w: 64, h: 34, label: 'Werkstatt [E]', target: 'CraftingScene' },
    { id: 'druckerei_entrance', x: 668, y: 334, w: 64, h: 34, label: 'Druckerei [E]', target: 'druckerei' }
  ],
  npcs: [
    {
      id: 'branka',
      name: 'Schmiedemeisterin Branka',
      x: 300, y: 416,
      texture: 'schmiedemeisterin',
      scale: 0.36,
      lines: [
        'Stahl allein schneidet die Lügen des Rates nicht. Erst wenn jede Klinge Wissen trägt, fällt ihre Maske.',
        'Im Keller unter dem Rathaus lagern Protokolle aus Dämonenverhören. Bring mir Abschriften, und ich veredele deine Artefakte.',
        'Sprich draussen leise. Die Aufseher des Kettenrats tragen inzwischen die Farben der Stadtgarde.'
      ]
    },
    {
      id: 'thom',
      name: 'Setzer Thom',
      x: 700, y: 416,
      texture: 'setzer_thom',
      scale: 0.30,
      lines: [
        'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Träume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
        'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
        'Verteile nichts Ungeprüftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
      ]
    },
    {
      id: 'mara',
      name: 'Mara vom Untergrund',
      // Rechts neben Branka (300/416) statt mittig am Brunnen — holt Mara
      // zugleich aus dem fountain-Collider (444-516 / 344-370) heraus.
      x: 372, y: 416,
      texture: 'spaeherin',
      scale: 0.30,
      lines: [
        'Die Schreiber des Rates markieren Häuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
        'Der Zeremonienmeister besitzt neue Siegel. Sie holen Dämonen als stilles Archiv.',
        'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
      ]
    },
    {
      id: 'aldric',
      name: 'Ratsherr Aldric',
      x: 480, y: 560,
      texture: 'aldric_right0',
      scale: 0.18,
      // Im Epilog ist der Rat enttarnt und die Wahrheit gedruckt — Aldric steht
      // dann nicht mehr auf dem Platz. In 'broken' (Akt 4) bleibt er sichtbar:
      // dort ist er Gegner und hat eigene feindliche Zeilen (HubPhase).
      hiddenAfterFlag: 'story_ending',
      // Faction metadata (feature 045). The dialog code in
      // HubSceneV2._showNpcDialogue reads `factionId` to prepend a
      // tier-aware greeting page from `faction.<id>.greet.<tier>` before
      // the regular flavor lines below.
      factionId: 'council',
      lines: [
        'Willkommen zurück, Archivschmied. Der Rat schätzt deine Dienste.',
        'Nebenhall ist sicher, solange der Rat wacht. Vergiss das nicht.',
        'Du hast Talent. Der Rat könnte jemanden wie dich gut gebrauchen — langfristig.'
      ]
    },
    {
      id: 'elara',
      name: 'Elara',
      x: 180, y: 480,
      texture: 'elara_right0',
      scale: 0.16,
      // Elara stays fully underground for Akt 1 — she offers Q5 in a
      // cellar encounter modal and accepts the council document in a
      // second cellar encounter (see _maybeFireElaraCellarEncounter in
      // roomManager.js). She never enters the hub during Akt 1 because
      // she's actively hiding from the Council. To Klerus, Garde and
      // Harren she therefore remains "missing", which is exactly what
      // their dialogue still says.
      //
      // The visibility gate below references a flag that is currently
      // never set; flip it (e.g. on Akt-2 advancement) if a future arc
      // wants to bring her into the hub. Until then this entry exists
      // mostly to document her presence in the layout.
      visibleAfterFlag: 'elaraReturnedToHub',
      lines: [
        'Du erinnerst dich nicht an mich, oder? Ich... kannte dich. Vor dem Unfall.',
        'Frag nicht den Rat. Frag die Mauern. Sie erinnern sich besser als Menschen.'
      ]
    },
    {
      id: 'harren',
      name: 'Bürgermeister Harren',
      x: 720, y: 470,
      texture: 'harren_right0',
      scale: 0.16,
      // Feature 050 Vertical Slice: Harren gives Q1 + Q6 — must be visible
      // from game start. (Was gated to 'treuer_diener' / Akt 2 from the
      // pre-050 narrative when Harren was a late-game NPC.)
      visibleFromAct: 'auftrag',
      lines: [
        'Meine Tochter Elara... sie ist verschwunden. Bitte, hilf mir sie zu finden.',
        'Ich war einst stolz auf diese Stadt. Jetzt erkenne ich sie kaum wieder.'
      ]
    },
    // Feature 050: Klerus + Garde quest-giver NPCs for the Act-1 chain.
    // Dedicated sprites in assets/sprites/{klerus,garde}.png (no walk
    // frames yet — single-static like Branka/Thom/Mara). Preloaded in
    // HubSceneV2.preload(). Scale 0.10 to match the visual scale of
    // schmiedemeisterin / setzer_thom (single-sprite assets at 1536x1024
    // native render at 0.10 to fit hub NPCs).
    {
      id: 'klerus_priester',
      name: 'Hochpriester der Ordnung',
      x: 380, y: 540,
      texture: 'klerus',
      // Source resized 1536→768 wide for crispness; scale 0.20 keeps the
      // ~102px display height that 0.10 produced from the original.
      scale: 0.20,
      visibleFromAct: 'auftrag',
      lines: [
        'Die Ordnung des Kettenrats ist heilig. Wer sie befragt, befragt das Licht selbst.',
        'Ketzerei beginnt mit der falschen Frage. Halte deine Lippen rein.',
        'Wenn die Tochter geflohen ist, war es nicht aus eigenem Willen. Eine dunkle Hand führt sie.'
      ]
    },
    {
      id: 'stadtwache',
      name: 'Wachtmeister der Garde',
      x: 580, y: 380,
      texture: 'garde',
      // garde.png is 612×408 (user-provided clean removebg cutout).
      // Target display height = 90% of klerus's ~102px = ~92px.
      // 92 / 408 ≈ 0.225.
      scale: 0.23,
      visibleFromAct: 'auftrag',
      lines: [
        'Die Patrouillen wachsen jeden Monat. So muss es sein — die Stadt ist unruhig.',
        'Loyalität ist die einzige Münze, die zwischen den Strassen Bestand hat. Frag nicht warum.',
        'Wenn der Magistrat ruft, antwortet die Garde. Wenn der Klerus segnet, marschiert die Garde. So funktioniert es.'
      ]
    },
    // Feature 063 (#66): der ratlose Bürger. Erscheint ab Akt 2 ("erste_risse"),
    // wenn der Wahlkampf hohl wird. Reine Flavor-Figur ohne Quest — sein Dialog
    // (hub_buerger_a2, setzt truth_told) hängt HubSceneV2 an der Flavor-Stelle an.
    // Sprite: assets/sprites/buerger.png (Einzel-Sprite wie Thom/Garde). Fehlt es,
    // zeigt das Spawn-System den Platzhalter (placeholderColor/-Accent unten).
    {
      id: 'buerger',
      name: 'Ratloser Bürger',
      x: 600, y: 500,
      texture: 'buerger',
      scale: 0.30,
      visibleFromAct: 'erste_risse',
      placeholderColor: 0x6b5a44,
      placeholderAccent: 0x4a3d2c,
      lines: [
        'Verzeih. Du gehst im Rathaus aus und ein — Du musst es doch wissen.'
      ]
    }
  ]
};

// Convert fixed labels to live i18n getters so HubSceneV2 + dialog code
// automatically follow the active language.
if (window.i18n) {
  // Entrance labels
  window.HUB_HITBOXES.entrances.forEach(function (e) {
    var key = 'hub.entrance.' + (e.target === 'GameScene' ? 'rathaus'
                              : e.target === 'CraftingScene' ? 'schmiede'
                              : e.target === 'druckerei' ? 'druckerei' : null);
    if (!key) return;
    var fallback = e.label;
    try {
      Object.defineProperty(e, 'label', {
        get: function () { return _hubT(key, fallback); },
        configurable: true, enumerable: true
      });
    } catch (err) { /* swallow */ }
  });
  // NPC name + default lines
  window.HUB_HITBOXES.npcs.forEach(function (npc) {
    var nameKey = 'hub.npc.' + npc.id + '.name';
    var nameFallback = npc.name;
    try {
      Object.defineProperty(npc, 'name', {
        get: function () { return _hubT(nameKey, nameFallback); },
        configurable: true, enumerable: true
      });
    } catch (err) { /* swallow */ }
    if (Array.isArray(npc.lines)) {
      var fallbackLines = npc.lines.slice();
      var hasI18nLines = fallbackLines.some(function (_, i) {
        return _hubHasKey('hub.npc.' + npc.id + '.line.' + i);
      });
      if (hasI18nLines) {
        Object.defineProperty(npc, 'lines', {
          get: function () {
            return fallbackLines.map(function (orig, i) {
              return _hubT('hub.npc.' + npc.id + '.line.' + i, orig);
            });
          },
          configurable: true, enumerable: true
        });
      }
    }
  });
}
