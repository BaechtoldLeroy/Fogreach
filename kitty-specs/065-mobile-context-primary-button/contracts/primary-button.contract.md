# Kontrakt: Primärbutton (Verhalten & Darstellung)

## Layout
- `ABILITY_LAYOUT` enthält EINE Primärzelle (`key: 'primary'`) statt `attack` + `interact`.
- Die frei werdende Zellenposition bleibt im MVP leer (kein neuer Button).
- Trefferfläche ≥ bisherige attack/interact-Zelle (NFR-003).

## Darstellung (pro Frame, im Poll)
- `hasPeacefulTarget` true → Glyph ✋, Label „Aktion".
- `hasPeacefulTarget` false → Glyph ⚔️, Label „Angr".
- Wechsel reaktiv ≤100 ms nach Zustandsänderung (NFR-001).
- Angriffs-Cooldown-Overlay (Sekunden, gameNow) NUR im Angriffs-Kontext (FR-007).

## Tap-Dispatch
- Tap bei `hasPeacefulTarget` true → bestehende Interakt-Auslösung
  (`_interact()` → `__MOBILE_INTERACT_ACTIVE__` + `demonfall:mobile-interact`).
- Tap bei false → bestehender mobiler Angriffs-Pfad.
- Genau EIN Pfad pro Tap; Auslösung nach dem zum Tap-Zeitpunkt angezeigten Kontext.

## Nicht-Ziele
- Kein Desktop-Verhalten ändern (C-001). Keine neue Interaktions-Mechanik (R3).
- Skills/Trank/Rolle unverändert.
