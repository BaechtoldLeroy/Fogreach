# WP01 Baseline FPS — gemessen 2026-06-10

Mess-Methodik: P-Taste (Hub) bzw. Burger-Menu "FPS Overlay" (Dungeon),
~30s warten, Avg-FPS vom Overlay ablesen. Vor allen 052-Code-Changes.

## Ergebnisse

| Scene             | Desktop | Mobile     | NFR-01-Schwelle (≥55) |
|-------------------|---------|------------|-----------------------|
| Hub (HubSceneV2)  | 60      | 60         | ✅ ✅                 |
| Combat (Procroom) | 60      | **40**     | ✅ ❌ (-15fps)        |
| Procedural-Room   | 60      | **20**     | ✅ ❌❌ (-35fps)      |

Mobile-Device: (nicht spezifiziert — wahrscheinlich Pixel-class).

## Hauptbefund

**Mobile reisst NFR-01 vor jeder Code-Änderung.** Procrooms laufen
mit 20fps — ein Drittel der Zielmarke. Combat-Rooms mit 40fps —
ebenfalls unter der 55-Schwelle.

Desktop ist überall am 60fps-Cap; alle drei Quality-Levers (WP02 DPR,
WP03 LINEAR, WP04 Canvas-Bump) können dort risikoarm shippen.

## Implikationen für 052

### Was bricht das Spec-Modell:
Das Spec wurde geschrieben unter der Annahme "Mobile hält 60fps,
Quality-Levers könnten das auf <55 drücken — Mitigation via NFR-01-Gate".
Tatsächlich liegt Mobile bereits bei 20fps. Jeder Lever der GPU-Last
hinzufügt (WP02 DPR-Multiplikator → 4× Pixel, WP04 Canvas-Bump → 4× Pixel)
macht die 20fps zu 5fps.

### Konsequenzen pro Lever:
- **WP02 (DPR resolution)**: Auf Mobile NICHT aktivierbar. Auf Desktop OK.
- **WP03 (LINEAR-Filter-Audit)**: Zero Perf-Kosten (Sampling-Mode-Change,
  kein zusätzlicher Pixel-Workload). **Beide Plattformen sicher.**
- **WP04 (Canvas-Bump 960→1920)**: Auf Mobile NICHT aktivierbar.
  Auf Desktop OK.
- **WP05 (Settings-Toggle)**: Muss Mobile auto-detect + Default
  "Niedrig" zwingen. WP02/WP04 nur via opt-in "Hoch".

### Wichtigere Frage:
Die 20fps in Procrooms sind ein **Player-Experience-Problem das schon
heute existiert**, unabhängig von 052. Procrooms haben 104×88 = 9152
tiles plus dynamisch generierte Floor/Wall/Obstacle-Texturen.

Mögliche Ursachen:
- TileSprite-Overhead bei großen Räumen
- Runtime Texture-Generation kostet GPU-Memory-Bandwidth
- Per-Frame-Tile-Re-Sampling
- Pickup/Enemy-Sprite-Count

Das ist ein eigenes Feature wert ("Mobile FPS Rescue" oder ähnlich),
nicht Teil von 052.

## Empfohlene 052-Roadmap-Anpassung

1. **WP02 + WP03 + WP04 nur für Desktop spec'en**. Mobile-Detect
   automatisch auf "Niedrig" (= aktueller Zustand, kein Lever).
2. **WP03 zuerst shippen**: Risikofrei beidseitig, sofort sichtbarer
   Quality-Gewinn auf Hub-NPCs und UI auch auf Mobile.
3. **WP02 + WP04 als Desktop-only-Combo**: Mit DPR-Cap=2 und Canvas-
   Bump kombiniert auf Desktop für maximalen Quality-Gewinn.
4. **WP05 Settings-Toggle vereinfachen**: nur Desktop sieht "Mittel/
   Hoch"; Mobile sieht nur Info-Hinweis "FPS-optimiert für dein Gerät".

## Separate Folge-Feature: 053 (Vorschlag)

**Working title: Mobile Dungeon Performance**

Scope:
- 20fps in Procrooms → ≥45fps Ziel (= playable)
- 40fps in Combat → ≥55fps Ziel (= NFR-01 erfüllt)
- Diagnose-Schritte: Phaser DevTools, Texture-Memory-Audit, Tile-Sprite-
  Profiling, Enemy-Sprite-Pool-Analyse
- Mögliche Mitigations: kleinere Procroom-Grids, Texture-Atlasing,
  Object-Pooling für Enemies/Loot, FogOfWar-LOD

Separat von 052 weil:
- Andere Code-Areas (proc-Generation vs Render-Config)
- Andere Risk-Profile (gameplay-tuning vs render-pipeline)
- Andere Test-Strategie (FPS-Benchmarks vs visual diff)
