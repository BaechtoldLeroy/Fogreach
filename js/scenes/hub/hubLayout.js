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
    // Default greeting lines (shown when no quest is active). Quest-aware
    // lines come from storySystem NPC_DIALOGUE.
    'hub.npc.aldric.line.0': 'Willkommen zurueck, Archivschmied. Der Rat schaetzt deine Dienste.',
    'hub.npc.aldric.line.1': 'Nebenhall ist sicher, solange der Rat wacht. Vergiss das nicht.',
    'hub.npc.aldric.line.2': 'Du hast Talent. Der Rat koennte jemanden wie dich gut gebrauchen — langfristig.',
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
  const v = window.i18n.t(key);
  return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : fallback;
};

window.HUB_HITBOXES = {
  colliders: [
    { id: 'city_silhouette_wall', x: 0,   y: 200, w: 960, h: 92 },
    { id: 'rathaus_body',         x: 368, y: 110, w: 224, h: 168 },
    { id: 'rathaus_steps',        x: 430, y: 280, w: 100, h: 16 },
    { id: 'fountain',             x: 444, y: 344, w: 72,  h: 26 },
    { id: 'planter_left',         x: 356, y: 306, w: 38,  h: 22 },
    { id: 'planter_right',        x: 566, y: 306, w: 38,  h: 22 },
    { id: 'bench_left',           x: 390, y: 484, w: 48,  h: 16 },
    { id: 'bench_right',          x: 522, y: 484, w: 48,  h: 16 },
    { id: 'archivschmiede_body',  x: 220, y: 244, w: 148, h: 62 },
    { id: 'druckerei_body',       x: 652, y: 244, w: 148, h: 62 }
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
        'Stahl allein schneidet die Luegen des Rates nicht. Erst wenn jede Klinge Wissen traegt, faellt ihre Maske.',
        'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir Abschriften, und ich veredele deine Artefakte.',
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
        'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Traeume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
        'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
        'Verteile nichts Ungeprueftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
      ]
    },
    {
      id: 'mara',
      name: 'Mara vom Untergrund',
      x: 512, y: 372,
      texture: 'spaeherin',
      scale: 0.30,
      lines: [
        'Die Schreiber des Rates markieren Haeuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
        'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv.',
        'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
      ]
    },
    {
      id: 'aldric',
      name: 'Ratsherr Aldric',
      x: 480, y: 560,
      texture: 'aldric_right0',
      scale: 0.18,
      lines: [
        'Willkommen zurueck, Archivschmied. Der Rat schaetzt deine Dienste.',
        'Nebenhall ist sicher, solange der Rat wacht. Vergiss das nicht.',
        'Du hast Talent. Der Rat koennte jemanden wie dich gut gebrauchen — langfristig.'
      ]
    },
    {
      id: 'elara',
      name: 'Elara',
      x: 180, y: 480,
      texture: 'elara_right0',
      scale: 0.16,
      visibleFromAct: 'erste_risse',
      lines: [
        'Du erinnerst dich nicht an mich, oder? Ich... kannte dich. Vor dem Unfall.',
        'Frag nicht den Rat. Frag die Mauern. Sie erinnern sich besser als Menschen.'
      ]
    },
    {
      id: 'harren',
      name: 'Buergermeister Harren',
      x: 720, y: 470,
      texture: 'harren_right0',
      scale: 0.16,
      visibleFromAct: 'treuer_diener',
      lines: [
        'Meine Tochter Elara... sie ist verschwunden. Bitte, hilf mir sie zu finden.',
        'Ich war einst stolz auf diese Stadt. Jetzt erkenne ich sie kaum wieder.'
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
        return window.i18n.t('hub.npc.' + npc.id + '.line.' + i).indexOf('[MISSING:') !== 0;
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
