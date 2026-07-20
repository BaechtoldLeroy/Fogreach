# Kontrakt: Hub-Phasen-View (`window.HubPhaseView`)

**Zweck:** Wendet eine Phase auf die bestehende Hub-Szene an — code-gezeichnet, mit Austauschpunkt für optionale Assets. Kapselt das gesamte Rendering, damit die Integration in HubSceneV2 nur einen Aufruf braucht.

## Signatur

```
window.HubPhaseView = {
  // Wendet den Style der Phase auf die Szene an. Idempotent: mehrfacher Aufruf
  // ersetzt die vorherige Anwendung (kein Aufstapeln von Overlays).
  // Gibt ein Handle mit destroy() zurueck.
  apply: function(scene, phase, refs) { return { destroy: function(){} }; }
}
```

### refs (was der Aufrufer/HubSceneV2 übergibt)
```
{
  bg: <Phaser.Image>,          // der Hub-Hintergrund (hubscene_bg) — Ziel fuer Tint/Desaturate
  overlayDepth: <number>,      // Depth, auf der Nebel-/Tint-Overlays liegen (unter den Dialogen 1500)
  rathausRect: { x,y,w,h }|null // optionaler Bereich fuer die "feindlich"-Markierung (aus hubLayout colliders: rathaus_body)
}
```

## Verhalten je Phase (aus `HubPhase.PHASE_STYLE`)

1. **Style lesen:** `const s = window.HubPhase.PHASE_STYLE[phase]`.
2. **Asset-Austauschpunkt (Pflicht-Fallback):** wenn `s.assetKey` gesetzt UND `scene.textures.exists(s.assetKey)` → diese Textur als Phasen-Hintergrund/Overlay verwenden; **sonst** die code-gezeichnete Darstellung (Tint + Overlay). In beiden Fällen fehlerfrei.
3. **Code-gezeichnet:**
   - **Tint/Entsättigung:** `refs.bg.setTint(s.tint)` bzw. eine getönte, halbtransparente Rechteck-Overlay proportional zu `s.desaturate`.
   - **Nebel-Overlay:** ein bildschirmfüllendes Rechteck/Graphics mit Alpha `s.fog` (heller im Epilog, kühl/grau in doubleAgent/broken), auf `refs.overlayDepth`.
   - **Anschlagtafeln** (`s.posters`): `fresh` = nichts; `faded`/`torn`/`gone` = ein abgedunkeltes/zerrissenes Overlay bzw. Ausblenden im Bereich der Tafeln (code-gezeichnet, da die Tafeln Teil des Hintergrundbilds sind).
   - **`s.rathausHostile`:** Markierung über dem Rathaus-Bereich (`refs.rathausRect`) — z. B. roter Tint/Umrandung/Icon.
4. **scrollFactor:** alle erzeugten GameObjects `setScrollFactor(0)` — rekursiv, falls Container (scrollFactor-Falle).
5. **Teardown/Idempotenz:** ein erneuter `apply(...)` (oder `handle.destroy()`) räumt die zuvor erzeugten Overlays ab, bevor neue entstehen — kein Aufstapeln, kein Leak. `bg`-Tint wird auf den neuen Style gesetzt bzw. bei `council` zurückgesetzt (`clearTint()`).

## Invarianten
- **Kein Layout-Umbau:** die View verschiebt keine Gebäude/NPCs, ändert keine Kollisions-/Eingangsgeometrie — nur Tönung/Overlay/Markierung.
- **Defensiv:** fehlt `window.HubPhase` oder `refs.bg`, tut `apply` nichts (kein Wurf).
- **Zeit:** falls Animationen/Tweens genutzt werden, Zeit über `scene.time`/`Date.now()` (szenenübergreifend Date.now()).

## Testbarkeit
- Das Phaser-Rendering (`apply`) wird im **Browser-Boot-Check** je Phase geprüft (Overlay vorhanden, keine Konsolen-Fehler), nicht im Unit-Test. Die reine Phasen-/Style-Wahl ist über `HubPhase` (eigener Kontrakt) DOM-frei getestet.

## Für Konsumenten (Integration)
HubSceneV2 ruft am Ende des Hub-Aufbaus **einmal**:
```
const phase = window.HubPhase.current();
this._hubPhaseHandle = window.HubPhaseView.apply(this, phase, { bg, overlayDepth: 90, rathausRect: <rathaus_body> });
```
Die Aldric-Quest-Sperre (`HubPhase.aldricBlocksQuests(phase)`) und die phasenabhängigen NPC-Flavor-Zeilen (`HubPhase.npcFlavorByPhase`) sind **Verhalten** und werden in der Integration verdrahtet, nicht in der View.
