# Phase 1 — Datenmodell (Laufzeit-Zustand)

Kein Persistenz-Modell — nur flüchtiger Laufzeit-Zustand.

## Entität: PrimärButton-Kontext
- `hasPeacefulTarget` (bool) — abgeleitet pro Frame aus R1/R2. true = friedliches Ziel
  (NPC/Tür/Loot) in Reichweite.
- `mode` (abgeleitet) — `'action'` wenn `hasPeacefulTarget`, sonst `'attack'`.
- Sichtbare Repräsentation: Glyph (✋/⚔️) + Label („Aktion"/„Angr").
- Übergänge: `attack ↔ action` reaktiv beim Wechsel von `hasPeacefulTarget` (≤100 ms, NFR-001).

## Entität: Primärzelle (ersetzt attack + interact)
- `key`: `'primary'` (neu) statt getrennter `'attack'`/`'interact'`.
- Position: eine der bisherigen zwei Zellen; die andere Position bleibt leer (MVP).
- Behält: Angriffs-Cooldown-Overlay (nur im attack-Kontext), Icon-Padding.

## Quellen (nur gelesen, R1/R2)
- Hub: `HubSceneV2._activeInteractable`.
- Dungeon: `DoorSystem.isDoorInRange(scene, player)` (neu, leichter Getter) + Dungeon-NPC/Event +
  Loot-in-Reichweite.
- Ausschluss: Gegner; `getData('destructible')`-Props.

## Beziehungen
- Kontext (bool) → steuert Glyph/Label (View) UND Tap-Dispatch (Controller).
- Ein Tap → genau EIN Pfad (Interakt ODER Angriff), nie beides.
