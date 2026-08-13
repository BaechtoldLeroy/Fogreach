# Phase 0 — Design-Entscheidungen (Decision / Rationale / Alternatives)

## R1 — Quelle für `hasPeacefulTarget` (Aggregation, keine neue Reichweiten-Logik)
- **Decision**: Ein Helfer `hasPeacefulTarget(scene)` aggregiert bestehende Signale:
  - **Hub (HubSceneV2)**: `!!scene._activeInteractable` (NPC/Rathaus/Werkstatt etc.).
  - **Dungeon (GameScene)**: Tür in Reichweite (DoorSystem, nächste Tür < `INTERACT_DIST`)
    ODER Dungeon-NPC/Event in Reichweite (z. B. Elara) ODER aufhebbares Loot in Reichweite.
  - **Nie peaceful**: Gegner; `destructible`-Props (barrel/crate/statue/pillar/altar/…).
- **Rationale**: Nutzt vorhandene Zustände (C-003), hält den Check billig (NFR-002).
- **Alternatives**: Neuer zentraler Interaktions-Manager (Overkill, riskiert Regression).

## R2 — Tür-Signal im Dungeon
- **Decision**: DoorSystem bekommt einen leichten Getter `isDoorInRange(scene, player)` (nutzt
  dieselbe nearest-door-<INTERACT_DIST-Prüfung wie `updateDoors`). Fallback/Proxy falls nötig:
  `scene._doorPrompt && scene._doorPrompt.visible`.
- **Rationale**: Ein sauberes, dediziertes Signal ist robuster als der Sichtbarkeits-Proxy.
- **Alternatives**: Nur `_doorPrompt.visible` lesen — fragil (koppelt an UI-Zustand).

## R3 — Tap-Dispatch (eine Weiche)
- **Decision**: Beim Tap auf die Primärzelle: wenn `hasPeacefulTarget(scene)` → bestehende
  Interakt-Auslösung (`mobileControls._interact()` → `__MOBILE_INTERACT_ACTIVE__` +
  `demonfall:mobile-interact`, das main.js/Hub bereits verarbeiten); sonst → bestehender
  mobiler Angriffs-Pfad. Entscheidung nach dem **zum Tap-Zeitpunkt angezeigten** Kontext.
- **Rationale**: Wiederverwendet erprobte Pfade; minimaler neuer Code, kein neuer Interakt-Mechanismus.
- **Alternatives**: Beides feuern und den Empfänger entscheiden lassen (doppelte Effekte, Bugs).

## R4 — Layout & Glyph/Label-Swap
- **Decision**: In `ABILITY_LAYOUT` die Zellen `attack`(col0,row0) und `interact`(col3,row1)
  durch **eine** Primärzelle ersetzen (Key z. B. `primary`); die frei werdende Position bleibt
  im MVP leer. In `mobileAbilityButtons._pollEnabledState` den Kontext prüfen und Glyph/Label
  des Primärbuttons setzen: peaceful → ✋/„Aktion", sonst → ⚔️/„Angr".
- **Rationale**: Ein Poll läuft bereits pro Frame; der Swap ist ein billiger Zusatz.
- **Alternatives**: Zwei überlagerte Buttons mit Sichtbarkeits-Toggle (mehr Objekte, Clipping-Risiko).

## R5 — Cooldown/Feedback erhalten
- **Decision**: Der Primärbutton behält die Angriffs-Cooldown-Anzeige (Sekunden, gameNow-
  korrekt, b59) für den Angriffs-Kontext; im Aktion-Kontext kein Cooldown-Overlay.
- **Rationale**: FR-007; keine Regression an der zuletzt gefixten Cooldown-Anzeige.
- **Alternatives**: Cooldown immer zeigen (verwirrend im Aktion-Kontext).

**Ausgang**: Keine offenen `NEEDS CLARIFICATION`. Offen für Phase implement (Task-Detail):
exakter Dungeon-NPC/Loot-Reichweiten-Zugriff (Elara/Loot) — im Helfer defensiv (typeof-Guards).
