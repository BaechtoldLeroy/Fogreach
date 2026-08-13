# Research Specification: Mobile-UI-Benchmark & Rework-Prinzipien

**Feature**: 067-mobile-ui-benchmark-rework
**Mission**: research
**Status**: Draft

## Forschungsfrage

Wie strukturieren führende Mobile-Touch-Games im ARPG-/Roguelite-Dungeon-Crawler-Genre
ihre In-Game-UI — und welche daraus abgeleiteten, konkret auf **Fogreach** anwendbaren
Design-Prinzipien und ein priorisiertes Rework-Backlog ergeben sich daraus?

## Motivation

Fogreachs Mobile-UI ist über die Zeit organisch gewachsen (8-Zellen-Ability-Bar +
Joystick + HUD). Punktuelle Fixes (Cooldowns, Labels, Button-Merge #80) verbessern
Details, aber es fehlt ein **holistisches, an Branchenleadern orientiertes Zielbild**.
Diese Untersuchung liefert die Grundlage, damit nachfolgende Umsetzungs-Features gegen
belegte Prinzipien geschnitten werden — statt gegen Bauchgefühl.

## Untersuchungsgegenstand (Scope der Recherche)

### Referenz-Titel (Branchenleader, Mobile-Touch)
- **Diablo Immortal** — Joystick + radialer Skill-Ring; „Gold-Standard" Mobile-ARPG.
- **Archero / Soul Knight** — minimalistisch, einhändig / auto-fire beim Stehen.
- **Vampire Survivors (Mobile)** — Auto-Attack, nahezu button-lose UI.
- **Genshin Impact** — poliert, kontextuelle Buttons, klare Trefferflächen.
- **Brawl Stars** — Twin-Stick-Ergonomie, Aim-Assist.
- Optional nach Bedarf: **Torchlight Infinite**, **Path of Exile Mobile**.

### Untersuchungsachsen
1. **Daumen-Zonen / Reachability & Einhand-Bedienung** — wo sitzen Bewegung, Primäraktion, Sekundär-Skills?
2. **Minimaler HUD / Informationsdichte** — was ist sichtbar, was kontextuell/ausgeblendet?
3. **Kontextuelle statt redundante Buttons** — ein Primärbutton, situative Aktionen.
4. **Safe-Area / Notch / abgerundete Ecken** — wie werden Ränder gehandhabt?
5. **Lesbarkeit / Kontrast / Feedback** — Cooldowns, Ladezustände, Treffer-Feedback.
6. **Auto-Targeting / Auto-Attack / Assist-Optionen** — Automatisierungsgrad, Opt-in/-out.
7. **Button-Größe & Trefferflächen-Ergonomie** — Mindestgrößen, Abstände, Fehl-Tap-Vermeidung.

### Vergleichs-Baseline: Fogreach heute
Ist-Zustand als Vergleichsanker: 8-Zellen-Ability-Bar (`attack`, `slot1–4`, `potion`,
`roll`, `interact`) + fester Joystick, HUD via `hudV2.js`, Steuerung in
`mobileControls.js`/`mobileAbilityButtons.js`, Safe-Area via `mobileSafeArea.js`.

## Deliverables (Untersuchungsergebnis)

- **D-A — Mobile-UI-Prinzipien-Dokument**: konkrete, auf Fogreach anwendbare Prinzipien je
  Achse, jeweils mit Beleg (welcher Referenz-Titel macht es wie) und einer klaren
  „Empfehlung für Fogreach". Kein generisches Lehrbuch — anwendbar und begründet.
- **D-B — Priorisiertes Mobile-UI-Rework-Backlog**: konkrete Rework-Items, je mit
  geschätztem **Impact** und **Aufwand** (z. B. Hoch/Mittel/Niedrig) und kurzer Begründung.
  Der bestehende Button-Merge (Feature **065** / GitHub **#80**) ist als **ein** Eintrag
  eingeordnet und relativ zu den anderen priorisiert.

## User Scenarios & Testing

Akteur: der Entwickler (Auftraggeber), der auf Basis der Untersuchung Umsetzungs-Features
schneidet.

### Primäre Nutzungs-Abläufe
1. Entwickler liest **D-A** und kann pro Achse eine begründete Design-Entscheidung für
   Fogreach treffen (mit Referenz-Beleg).
2. Entwickler liest **D-B** und wählt die nächsten Umsetzungs-Features nach Impact/Aufwand
   — 065 findet sich dort relativ eingeordnet wieder.

### Akzeptanzszenarien
- **Given** die Untersuchung ist abgeschlossen, **When** der Entwickler D-A öffnet,
  **Then** enthält es für jede der 7 Achsen mindestens eine belegte Empfehlung für Fogreach.
- **Given** D-B, **When** der Entwickler es öffnet, **Then** ist jedes Rework-Item mit
  Impact- UND Aufwand-Einschätzung versehen und die Liste ist nach Priorität sortiert.
- **Given** D-B, **When** nach dem Button-Merge gesucht wird, **Then** ist 065/#80 als
  eigener, relativ priorisierter Eintrag vorhanden.

### Edge Cases
- Eine Referenz-Praxis passt nicht zu einem Browser-Phaser-Touch-Game → als „nicht
  übertragbar (Grund)" dokumentieren statt blind übernehmen.
- Widersprüchliche Praktiken zwischen Referenz-Titeln (z. B. Auto-Attack vs. manuell) →
  als Trade-off mit Empfehlung + Kontext darstellen, nicht auflösen-erzwingen.

## Requirements

### Funktionale Anforderungen (FR)

| ID | Anforderung | Status |
|----|-------------|--------|
| FR-001 | Die Untersuchung deckt alle 7 definierten Achsen ab. | Proposed |
| FR-002 | Für jede Achse werden ≥2 der Referenz-Titel konkret verglichen (was machen sie, wie). | Proposed |
| FR-003 | D-A (Prinzipien-Doc) enthält je Achse ≥1 begründete, auf Fogreach anwendbare Empfehlung mit Referenz-Beleg. | Proposed |
| FR-004 | D-B (Rework-Backlog) listet konkrete Rework-Items, jeweils mit Impact- und Aufwand-Einschätzung und Kurzbegründung. | Proposed |
| FR-005 | Der bestehende Button-Merge (065/#80) ist in D-B als eigener, relativ priorisierter Eintrag enthalten. | Proposed |
| FR-006 | Nicht auf Fogreach übertragbare Praktiken werden explizit als solche (mit Grund) markiert. | Proposed |
| FR-007 | D-A/D-B nennen den Fogreach-Ist-Zustand als Vergleichs-Baseline, sodass jede Empfehlung eine Delta-Aussage hat. | Proposed |

### Nicht-funktionale Anforderungen (NFR)

| ID | Anforderung | Status |
|----|-------------|--------|
| NFR-001 | Jede Empfehlung in D-A ist auf ≥1 konkrete Referenz-Beobachtung oder anerkannte Mobile-UX-Quelle rückführbar (nachvollziehbare Herleitung, keine unbelegten Behauptungen). | Proposed |
| NFR-002 | D-B ist so priorisiert, dass die Top-3-Items eindeutig als „zuerst umsetzen" erkennbar sind (klare Ordnung, keine Gleichstände ohne Tie-Break). | Proposed |
| NFR-003 | Die Deliverables sind für einen Entwickler ohne diese Konversation eigenständig verwertbar (self-contained, inkl. Quellen-Nennung). | Proposed |

### Constraints (C)

| ID | Constraint | Status |
|----|------------|--------|
| C-001 | Reines Research-/Synthese-Feature — KEINE Code-Umsetzung in diesem Feature. | Accepted |
| C-002 | Desktop-UI ist nicht Gegenstand der Untersuchung. | Accepted |
| C-003 | Empfehlungen berücksichtigen den technischen Rahmen (Phaser-Browser-Game, Touch) — keine plattform-exklusiven Nativ-Only-Annahmen. | Accepted |
| C-004 | Konkrete Umsetzungs-Features werden NACH dieser Untersuchung separat geschnitten (nicht Teil dieses Features). | Accepted |

## Success Criteria

| ID | Kriterium |
|----|-----------|
| SC-001 | D-A deckt alle 7 Achsen mit je ≥1 begründeten Fogreach-Empfehlung ab. |
| SC-002 | D-B enthält priorisierte Rework-Items mit Impact/Aufwand; die Top-Prioritäten sind eindeutig. |
| SC-003 | 065/#80 ist in D-B nachvollziehbar relativ eingeordnet. |
| SC-004 | Ein Entwickler kann allein aus D-A/D-B die nächsten Umsetzungs-Features begründet ableiten (ohne diese Konversation). |

## Key Entities

- **Referenz-Titel** — ein untersuchtes Game mit Beobachtungen je Achse.
- **UI-Prinzip** — eine belegte Empfehlung (Achse, Beobachtung/Beleg, Fogreach-Empfehlung, Delta zum Ist-Zustand).
- **Rework-Item** — ein konkretes Umsetzungs-Kandidat (Beschreibung, Impact, Aufwand, Priorität, Bezug zu Prinzip(en)).

## Assumptions

- Die Recherche stützt sich auf öffentlich beobachtbare UI-Praktiken der Referenz-Titel
  sowie anerkannte Mobile-UX-Ergonomie (Daumen-Zonen, Trefferflächen-Mindestgrößen).
- Impact/Aufwand sind qualitative Einschätzungen (Hoch/Mittel/Niedrig), keine Story-Points.
- Die Deliverables leben als Markdown im Feature-Verzeichnis (research/ bzw. Analyse-Artefakte).

## Out of Scope

- Jegliche Code-Änderung an der Mobile-UI (folgt in separaten Umsetzungs-Features).
- Desktop-UI.
- Monetarisierungs-/Store-/Onboarding-UI (nur In-Game-Steuerung/HUD).
- Endgültige visuelle Mockups/Assets (optional, nicht Pflicht-Deliverable).
