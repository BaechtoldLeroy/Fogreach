# Kontrakt: `hasPeacefulTarget(scene)` (Kontext-Signal)

## Signatur
`window.hasPeacefulTarget(scene) -> boolean` (oder gleichwertige interne Funktion).
Leichtgewichtig; wird pro Frame im bestehenden `_pollEnabledState` aufgerufen.

## Verhalten
Gibt `true` zurück, wenn ein **friedliches** Interaktionsziel in Reichweite ist:
- **Hub**: `!!scene._activeInteractable`.
- **Dungeon**: `DoorSystem.isDoorInRange(scene, player)` ODER Dungeon-NPC/Event in Reichweite
  ODER aufhebbares Loot in Reichweite.

Gibt `false` zurück (→ Angriffs-Kontext) bei:
- keinem Ziel;
- nur Gegnern in der Nähe;
- nur zerstörbaren Props in der Nähe (`getData('destructible')` — barrel/crate/statue/pillar/
  altar/rubble/brazier/chest…).

## Garantien
- Ändert KEINEN Zustand (reine Query), keine Reichweiten-Logik neu (C-003).
- Defensiv: `typeof`-Guards für fehlende Systeme/Scenes; im Zweifel `false` (Angriff bleibt möglich).
- Kosten pro Aufruf im Rahmen der bestehenden Poll-Prüfungen (NFR-002).
