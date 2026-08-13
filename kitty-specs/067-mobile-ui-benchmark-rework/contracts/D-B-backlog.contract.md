# Kontrakt: D-B — Priorisiertes Mobile-UI-Rework-Backlog (`research/D-B-backlog.md`)

## Format
Eine nach Priorität sortierte Tabelle + kurze Begründung je Item.

```md
| Prio | ID | Item | Impact | Aufwand | Bezug (Prinzip/Achse) | Kurzbegründung |
|------|----|------|--------|---------|-----------------------|----------------|
| 1 | RW-01 | … | H | N | A3 kontextuelle Buttons | Quick Win: … |
| 2 | RW-02 | Button-Merge attack+interact (= Feature 065 / #80) | … | … | A3 | … |
| … | … | … | … | … | … | … |
```

## Pflichten
- Jedes Item hat Impact (H/M/N) UND Aufwand (H/M/N) (FR-004).
- Liste ist nach Priorität sortiert; die Top-3 sind eindeutig (kein ungelöster Gleichstand,
  Tie-Break nach research R5) (NFR-002).
- Genau ein Item entspricht Feature 065 / GitHub #80 und ist relativ eingeordnet (FR-005).
- Jedes Item verweist auf ≥1 Prinzip/Achse aus D-A (Rückbindung an die Belege).
- Priorisierung folgt Impact×Aufwand (Quick-Wins zuerst), qualitativ (H/M/N), keine Story-Points.
