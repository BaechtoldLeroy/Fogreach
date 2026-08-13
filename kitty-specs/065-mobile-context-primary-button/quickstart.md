# Quickstart — Abnahme (Mobile, Touch)

Verifikation am Gerät/Emulator (Phaser-Loop läuft nicht headless). Desktop-Regressionscheck
separat.

## Szenarien
- [ ] **Kampf** (kein friedliches Ziel): Primärbutton zeigt ⚔️/„Angr", Tap greift an — auch neben Gegnern.
- [ ] **Tür**: in Reichweite → ✋/„Aktion", Tap öffnet/schließt die Tür.
- [ ] **Loot**: aufhebbares Loot in Reichweite → ✋/„Aktion" (soweit nicht ohnehin Auto-Pickup).
- [ ] **Hub-NPC**: in Reichweite → ✋/„Aktion", Tap startet Dialog.
- [ ] **Zerstörbares Prop** (Fass/Kiste/Altar) in Reichweite, kein friedliches Ziel → bleibt ⚔️/„Angr"; Tap greift an.
- [ ] **Übergang**: friedliches Ziel kommt in/aus Reichweite → Glyph/Label wechseln reaktiv (≤100 ms), ohne manuellen Refresh.
- [ ] **Cooldown**: Angriffs-Cooldown-Sekunden erscheinen am Primärbutton (im attack-Kontext), gameNow-korrekt nach Inventar-Öffnen (kein b59-Regress).
- [ ] **Trefferfläche**: Primärbutton ≥ bisherige Zelle; frei gewordene Position leer.
- [ ] **Desktop**: Steuerung/Verhalten unverändert (Regressionscheck).

## Technik-Checks
- [ ] Nur `js/mobileControls.js` + `js/mobileAbilityButtons.js` (+ optional Helfer) geändert.
- [ ] `node tools/runTests.js` grün (600).
- [ ] `?v=`-Cache-Buster der geänderten Dateien + `GAME_VERSION` gebumpt.
- [ ] Kein `STORY_VERSION`-Bump, keine Desktop-Pfade angefasst.
