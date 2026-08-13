# Feature Specification: Mobile Kontext-Primärbutton

**Feature**: 065-mobile-context-primary-button
**Mission**: software-dev
**Basis**: GitHub-Issue #80 (Mobile: Skill- & Aktionsbuttons optimieren)
**Status**: Draft

## Überblick

Auf der mobilen Touch-Steuerung werden die getrennten Zellen **Angriff** und **Aktion**
zu **einer** kontext-sensitiven Primärzelle zusammengelegt. Ist ein *friedliches*
Interaktionsziel (NPC, Tür, Loot) in Reichweite, führt der Button die **Aktion** aus und
zeigt ✋/„Aktion". Sonst führt er den **Angriff** aus und zeigt ⚔️/„Angr" — auch neben
Gegnern oder zerstörbaren Props. So wird eine der acht Layout-Zellen frei; der Platz kommt
der Daumen-Ergonomie (Trefferflächen/Abstand) zugute.

**Warum**: Auf dem kleinen Screen konkurrieren derzeit zwei ähnliche Buttons (Angriff,
Aktion), die nie gleichzeitig sinnvoll sind. Ein einziger kontextsensitiver Button löst
immer das Richtige aus und schafft Platz.

## User Scenarios & Testing

### Primäre Abläufe
1. **Kampf im Dungeon** — kein friedliches Ziel in Reichweite → Button zeigt ⚔️ „Angr",
   Tap greift an. Gilt auch neben Gegnern.
2. **Vor einer Tür** — Tür in Reichweite → ✋ „Aktion", Tap öffnet/schließt die Tür.
3. **Über Loot** — aufhebbares Loot in Reichweite → ✋ „Aktion", Tap hebt auf.
4. **Vor einem Hub-NPC** — NPC in Reichweite → ✋ „Aktion", Tap startet den Dialog.
5. **Zerstörbares Prop** (Fass/Kiste/Statue) in Reichweite, kein friedliches Ziel → Button
   bleibt ⚔️ „Angr"; Tap greift an und zerschlägt das Prop.

### Akzeptanzszenarien
- **Given** Mobile, kein friedliches Ziel in Reichweite, **When** Primärbutton getappt,
  **Then** Angriff wird ausgelöst und der Button zeigt ⚔️/„Angr".
- **Given** Mobile, NPC/Tür/Loot in Reichweite, **When** Primärbutton getappt,
  **Then** die passende Aktion (Dialog/Tür/Aufheben) wird ausgelöst und der Button zeigt ✋/„Aktion".
- **Given** Mobile, ein friedliches Ziel kommt in bzw. verlässt die Reichweite,
  **When** der Zustand wechselt, **Then** Glyph und Label wechseln reaktiv ohne manuellen Refresh.
- **Given** Mobile, zerstörbares Prop in Reichweite (kein friedliches Ziel),
  **When** getappt, **Then** Angriff (nicht „Aktion").
- **Given** Desktop, **Then** Steuerung und Verhalten unverändert.

### Edge Cases
- **Mehrere Ziele gleichzeitig** (z. B. NPC + Prop): das friedliche Ziel gewinnt → „Aktion".
- **Ziel verlässt Reichweite im Tap-Moment**: der Button löst konsistent nach dem zum
  Tap-Zeitpunkt angezeigten Kontext aus (kein „falscher" Angriff nach sichtbarer Aktion).
- **Cooldown/Stun**: der Angriffs-Kontext respektiert bestehende Angriffs-Sperren; die
  Aktion bleibt davon unberührt.
- **Skills/Trank/Rolle**: unverändert — nur attack+interact werden zusammengelegt.

## Requirements

### Funktionale Anforderungen (FR)

| ID | Anforderung | Status |
|----|-------------|--------|
| FR-001 | Das Mobile-Layout stellt EINE Primärzelle bereit, die die bisherigen Zellen `attack` und `interact` ersetzt. | Proposed |
| FR-002 | Ist ein friedliches Interaktionsziel (NPC, Tür, Loot) in Reichweite, führt der Primärbutton die entsprechende Interaktion aus. | Proposed |
| FR-003 | Ist KEIN friedliches Ziel in Reichweite, führt der Primärbutton den Angriff aus — auch wenn Gegner oder zerstörbare Props in Reichweite sind. | Proposed |
| FR-004 | Glyph und Label des Primärbuttons spiegeln den aktuellen Kontext: ✋/„Aktion" vs. ⚔️/„Angr". | Proposed |
| FR-005 | Der Kontext-Zustand aktualisiert sich reaktiv, während Ziele in bzw. aus der Reichweite kommen. | Proposed |
| FR-006 | Zerstörbare Props (Fass/Kiste/Statue u. Ä.) zählen NICHT als friedliches Ziel; in ihrer Reichweite bleibt der Button im Angriffs-Kontext. | Proposed |
| FR-007 | Die bestehende Cooldown-/Sekunden-Anzeige des Angriffs bleibt am Primärbutton erhalten. | Proposed |
| FR-008 | Die durch die Zusammenlegung frei werdende Zelle wird im MVP nicht mit einem neuen Button belegt; der Platz dient Trefferfläche/Abstand. | Proposed |

### Nicht-funktionale Anforderungen (NFR)

| ID | Anforderung | Status |
|----|-------------|--------|
| NFR-001 | Der Kontextwechsel wird ≤100 ms nach der Zustandsänderung sichtbar (kein wahrnehmbares Nachziehen). | Proposed |
| NFR-002 | Kein messbarer zusätzlicher fps-Einfluss: der Kontext-Check läuft im Rahmen der bereits bestehenden Reichweiten-Prüfungen. | Proposed |
| NFR-003 | Die Trefferfläche des Primärbuttons ist mindestens so groß wie die bisherige Angriffs-/Aktions-Zelle (kein kleineres Tap-Target). | Proposed |

### Constraints (C)

| ID | Constraint | Status |
|----|------------|--------|
| C-001 | Desktop-Steuerung und -Verhalten bleiben unverändert. | Accepted |
| C-002 | Nur die mobile Touch-Steuerung ist betroffen. | Accepted |
| C-003 | Die Interaktions-Reichweiten-Logik selbst wird nicht geändert; bestehende Quellen werden nur konsumiert. | Accepted |
| C-004 | Sekundär-Ideen aus #80 (leere Slots ausblenden, Label-Kontrast, Trank-/Rolle-Platzierung) sind NICHT Teil dieses MVP. | Accepted |

## Success Criteria

| ID | Kriterium |
|----|-----------|
| SC-001 | Auf Mobile existiert genau eine Primärzelle für Angriff+Aktion statt zwei getrennter Zellen. |
| SC-002 | In allen fünf Primärszenarien löst der Primärbutton die kontextrichtige Handlung aus (friedliches Ziel → Aktion, sonst Angriff). |
| SC-003 | Spieler erkennen jederzeit am Glyph/Label, ob ein Tap angreift oder interagiert. |
| SC-004 | Ein Desktop-Regressionscheck zeigt unverändertes Steuerungsverhalten. |

## Key Entities

- **Interaktions-Kontext** — abgeleiteter Zustand `{ hasPeacefulTarget: bool }`. „Peaceful"
  = NPC | Tür | aufhebbares Loot in Reichweite. NICHT peaceful: zerstörbare Props, Gegner,
  leerer Raum. Steuert Glyph/Label und die Tap-Handlung des Primärbuttons.

## Assumptions

- Eine Reichweiten-Erkennung für NPC/Tür/Loot existiert bereits (Hub:
  `_activeInteractable`/`_refreshInteractionPrompt`; Dungeon: Tür-Nähe via DoorSystem,
  Loot-Aufhebe-Reichweite) und liefert das `hasPeacefulTarget`-Signal.
- Die „Aktion"-Auslösung nutzt die bestehenden Interaktions-Trigger (Dialog/Tür/Loot) —
  es wird kein neuer Interaktionsmechanismus eingeführt.
- Die frei werdende Zelle bleibt im MVP leer; eine spätere Iteration (#80-Sekundär-Ideen)
  kann sie belegen.

## Out of Scope

- Leere Skill-Slots ausblenden statt grau anzeigen.
- Label-Kontrast auf hell gefärbten Buttons (z. B. Cyan) verbessern.
- Trank-/Rolle-Neuplatzierung.
- Einen neuen Button in der frei werdenden Zelle platzieren.
- Jegliche Desktop-Änderung.

## Dependencies

- Umsetzungs-Berührungspunkte (nicht als Spec-Vorgabe, nur Orientierung): das mobile
  Steuerungs-Layout (`js/mobileControls.js`, `ABILITY_LAYOUT`) und die Button-Dekoration
  inkl. Glyph/Label/Cooldown/Poll (`js/mobileAbilityButtons.js`). Referenz: GitHub #80.
