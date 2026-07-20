# Kontrakt: Hub-Phasen-Logik (`window.HubPhase`)

**Zweck:** Reine, DOM-freie Ableitung des Hub-Zustands + die pro Phase definierten Darstellungs-/Verhaltens-Daten. Fundament, gegen das View und Integration parallel bauen.

## Signatur

```
window.HubPhase = {
  // Rein: leitet die Phase aus Akt-Index + Flags ab. Keine Seiteneffekte.
  derivePhase: function(actIndex, flags) { return 'council'|'doubleAgent'|'broken'|'epilogue'; },

  // Bequemer Wrapper: liest aus den Globals (storySystem/questSystem). NICHT im
  // Unit-Test genutzt (der ruft derivePhase direkt); nur zur Laufzeit.
  current: function() { /* return derivePhase(getCurrentActIndex(), getFlags()) */ },

  PHASE_STYLE: { /* siehe unten */ },
  npcFlavorByPhase: { /* siehe unten */ },

  // Verhaltens-Regel: bietet Aldric in dieser Phase noch Quests an?
  aldricBlocksQuests: function(phase) { return phase === 'broken'; }
}
```

## Ableitungsregel (verbindlich)

Priorität, von hoch nach niedrig — **die erste zutreffende gewinnt**:
1. `flags.story_ending === true` → `'epilogue'`
2. `actIndex >= 4` → `'broken'`
3. `actIndex >= 2` → `'doubleAgent'`
4. sonst → `'council'`

- `actIndex` ist die Zahl aus `storySystem.getCurrentActIndex()` (0–4). Fehlt/`null`/`undefined` → als 0 behandeln.
- `flags` ist ein einfaches Objekt (`questSystem.getFlags()`); fehlt → `{}`.
- Das Eingabeobjekt wird nicht mutiert; gleicher Input → gleicher Output.

## PHASE_STYLE (Darstellungs-Parameter je Phase)

Reine Daten, von der View konsumiert. Beispiel-Form (ASCII-Keys):

```
PHASE_STYLE = {
  council:     { tint: 0xffffff, desaturate: 0.0, fog: 0.0,  posters: 'fresh',  assetKey: null,               rathausHostile: false },
  doubleAgent: { tint: 0x9fb0c8, desaturate: 0.35, fog: 0.12, posters: 'faded',  assetKey: 'hub_doubleAgent', rathausHostile: false },
  broken:      { tint: 0x8a6b6b, desaturate: 0.45, fog: 0.22, posters: 'torn',   assetKey: 'hub_broken',      rathausHostile: true  },
  epilogue:    { tint: 0xeef0f2, desaturate: 0.15, fog: 0.30, posters: 'gone',   assetKey: 'hub_epilogue',    rathausHostile: false }
}
```
(Konkrete Zahlen bestimmt der View-/Fundament-WP; die **Felder** sind der Kontrakt: `tint`, `desaturate` 0..1, `fog` 0..1, `posters` ∈ {fresh|faded|torn|gone}, `assetKey` (string|null = Austauschpunkt), `rathausHostile` bool.)

## npcFlavorByPhase (phasenabhängige NPC-Zeilen)

Optional pro NPC und Phase. Fehlt ein Eintrag, bleibt die bestehende Flavor-Zeile (`storySystem.getNpcDialogue` / `npcData.lines`) unverändert.

```
npcFlavorByPhase = {
  doubleAgent: { aldric: ['...hohler Wahlkampf...'], /* weitere NPCs optional */ },
  broken:      { aldric: ['...feindlich, Du bist enttarnt...'] },
  epilogue:    { buerger: ['...liest auf dem Platz vor...'], /* ... */ }
}
```
ASCII-NPC-IDs (aldric, harren, elara, branka, thom, mara, klerus_priester, stadtwache, buerger). Umlaute im Fließtext ok.

## Test-Erwartungen (`tests/hubPhase.test.js`)

- `derivePhase(0,{})`=council; `derivePhase(1,{})`=council; `derivePhase(2,{})`=doubleAgent; `derivePhase(3,{})`=doubleAgent; `derivePhase(4,{})`=broken.
- Priorität: `derivePhase(4,{story_ending:true})`=epilogue (Ende schlägt broken); `derivePhase(2,{story_ending:true})`=epilogue.
- Default/Robustheit: `derivePhase(null,undefined)`=council, kein Wurf.
- `aldricBlocksQuests('broken')`=true; für alle anderen Phasen false.
- PHASE_STYLE hat für jede der vier Phasen einen Eintrag mit allen Kontrakt-Feldern.
