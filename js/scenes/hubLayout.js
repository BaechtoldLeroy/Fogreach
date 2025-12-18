// hubLayout.js
const HUB_LAYOUT = {
  buildings: [
    {
      id: 'rathaus',
      title: 'Rathaus',
      x: 640, y: 120, w: 768, h: 288, depth: 5,
      color: 0x6b5b4b, roofColor: 0x3b2b1b,
      door: { x: 336, y: 192, w: 96, h: 88 },
      entrances: [
        {
          x: 349, y: 160, w: 70, h: 45,
          label: 'Rathauskeller [E]',
          onEnter: 'enterRathausDungeons'
        }
      ]
    },
    {
      id: 'archivschmiede',
      title: 'Archivschmiede',
      x: 320, y: 680, w: 360, h: 220, depth: 3,
      useDetailedTexture: true,
      entrances: [
        {
          x: 180, y: 110, w: 84, h: 110,
          label: 'Werkstatt betreten [E]',
          onEnter(scene) {
            scene._openWorkshopDialog();
          }
        }
      ]
    },
    {
      id: 'druckerei',
      title: 'Hinterhaus Druckerei',
      x: 1368, y: 700, w: 360, h: 192, depth: 3,
      color: 0x5b6b4b, roofColor: 0x2b3b1b,
      door: { x: 150, y: 136, w: 56, h: 40 },
      entrances: [
        {
          x: 150, y: 136, w: 56, h: 40,
          label: 'Druckerei [E]',
          onEnter(scene) {
            scene._openPrintDialog();
          }
        }
      ]
    }
  ]
};
