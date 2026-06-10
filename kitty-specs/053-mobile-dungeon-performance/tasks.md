# Tasks: 053 — Mobile Dungeon Performance

**Status**: All WPs Ready (post-052-WP02-Merge).
**Plan**: [plan.md](plan.md)
**Spec**: [spec.md](spec.md)

## Work Package Overview

| WP   | Title                                    | Status   | Depends-on        | Risk |
|------|------------------------------------------|----------|-------------------|------|
| WP01 | Mobile-Diagnose-Profile                  | 📋 Ready | 052 WP02          | low  |
| WP02 | Mitigation Top-Sink #1                   | 🔒 Locked| WP01              | tbd  |
| WP03 | Mitigation Top-Sink #2 (optional)        | 🔒 Locked| WP02              | tbd  |
| WP04 | Mitigation Top-Sink #3 (optional)        | 🔒 Locked| WP03              | tbd  |
| WP05 | Final-NFR-Validierung                    | 🔒 Locked| WP02+             | low  |

Locked = wartet auf WP01-Output. Konkrete FR-Wahl + WP-Anzahl
entscheidet sich nach Diagnose.

---

## WP01 — Mobile-Diagnose-Profile

**Risk**: low. Reine Mess-Operation, kein Code-Change.

### Acceptance Criteria
- Chrome DevTools Performance Recording auf echtem Android-Device:
  - 30s Procroom (worst-case)
  - 30s Combat-Room
  - 30s Hub (Baseline-Verification)
- Top-5-CPU-Time-Functions identifiziert + quantifiziert (% pro Frame)
- Top-5-GPU-Operations identifiziert (Texture-Binds, Draw-Calls)
- Memory-Delta beim Procroom-Entry gemessen
- Frame-Counter: # Tile-Sprites, # GameObjects, # Texture-Bindings
- Existenz-Check `js/fogOfWar.js` (für FR-05-Scope)
- Test-Coverage: Pixel-Class Android (Chrome) + iOS-Safari falls möglich

### Files
- Read-only: alle js/-Files (für Pattern-Recognition während Profiling)
- Create: `research/mobile-perf-profile.md`

### Verification
- Profile-File existiert und enthält:
  - Mess-Setup (Device-Modell, Chrome-Version)
  - Top-5-Sinks mit Quantifizierung
  - Entscheidungs-Matrix: welche FR (02/03/04/05) priorisieren
  - Konkrete Lösungs-Vorschläge pro Sink

### Notes
**Requires Mobile-Device + USB-Kabel + Chrome-Desktop**. Nicht
automatisierbar. User-driven Step.

---

## WP02..WP04 — Mitigations (Inhalt nach WP01)

WP-Anzahl + Reihenfolge + Code-Targets sind WP01-Output-abhängig.
Mögliche FR-Inhalte (aus Spec):

### Falls FR-02 (Texture-Atlas/Pool):
- Acceptance: Texture-Memory ≤ heute, Mobile Procroom +Xfps
- Files: `js/roomTemplates.js`, eventuell neuer `js/texturePool.js`
- Risk: high (Texture-Cache-Lifecycle)

### Falls FR-03 (Tile-Reduktion):
- Acceptance: Procroom-Tile-Count ≤ heute/2, visuell identisch
- Files: `js/proceduralRooms.js`, `js/roomTemplates.js`
- Risk: med (visuell sichtbar wenn zu aggressiv)

### Falls FR-04 (Object-Pooling):
- Acceptance: 0 GameObject-Creates während Combat (alle aus Pool)
- Files: `js/eventSystem.js` (Enemies), `js/loot.js` (Loot)
- Risk: med (Lifecycle-Regression-Risk)

### Falls FR-05 (FogOfWar-LOD):
- Acceptance: FogUpdate-Rate halbiert auf Mobile, kein sichtbarer Diff
- Files: `js/fogOfWar.js` (falls existent)
- Risk: low

Pro WP nach Diagnose:
- Output in `research/mitigation-results.md` appended: Before/After-FPS
- Wenn Procroom ≥45fps + Combat ≥55fps → WP05, sonst nächstes WP

---

## WP05 — Final-NFR-Validierung

**Risk**: low. Mess-Operation + Sign-off.

### Acceptance Criteria (= Feature-Accept-Gate)
- Mobile Procroom-FPS ≥ 45 (NFR-01)
- Mobile Combat-FPS ≥ 55 (NFR-02)
- Desktop FPS unverändert 60 (NFR-03)
- Texture-Memory Mobile ≤ +20MB vs. Baseline (NFR-04)
- Load-Time ≤ +5% vs. Baseline (NFR-05)
- Visueller A/B-Compare auf Desktop UND Mobile: kein sichtbarer Diff (NFR-06)
- 1 Playtester bestätigt subjektiv "spielbar" auf Mobile-Procroom (SC-06)
- Alle 251+052-Tests grün (SC-04)

### Files
- Edit: `research/mitigation-results.md` Final-Summary
- Edit: `ROADMAP.md` (053 als Done markieren)

### Verification
- Re-Mess via P-Taste/Burger-FPS-Overlay (gleiche Methodik wie WP01)
- Screenshot-Compare Desktop + Mobile pre/post
- Manual Quest-Chain-Run auf Mobile zwischen Q1-Q6 ohne neue Bugs
- Performance Recording Re-Run zeigt: Top-5-Sinks aus WP01 sind ≥50% reduziert

---

## Cross-WP Notes

- **Stop-Condition**: Sobald Mobile Procroom ≥45 + Combat ≥55, kein
  weiterer WP nötig. Lieber "good enough" als "perfect" weil weitere
  Mitigations Regression-Risk haben.
- **Desktop-Regression-Guard**: Vor jedem WP-Merge Desktop-FPS-Mess.
  Falls <60 → Mobile-Detect-Gate für die Mitigation.
- **053-Dependency auf 052-WP02**: Wenn 052 nicht WP02 (RenderQuality-
  Helper) shipped hat — 053 müsste eigenen Mobile-Detect schreiben.
  Stattdessen: warten bis 052 WP02 gemerged ist.

## Open Risks

| Risk | Mitigation |
|------|------------|
| WP01-Diagnose ergibt mehrere gleich-große Sinks | Sequentiell angehen, eine Mitigation per WP |
| Mitigation hat Desktop-Regression | Mobile-Detect-Gate (`if (RenderQuality.isMobile())`) |
| Visueller Diff sichtbar | Revert + andere Strategie probieren |
| NFR-01 nach 4 Mitigations nicht erreicht | Stop bei ≥45fps (= playable), defer ≥55-Ziel auf 054 |
