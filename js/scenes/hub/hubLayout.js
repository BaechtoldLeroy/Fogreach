// Hub layout data: collision shapes for the city background, location entrances,
// and NPC definitions. Pure data — no Phaser dependencies.
// Loaded into window.HUB_HITBOXES so HubSceneV2 can read it.

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
      x: 512, y: 322,
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
