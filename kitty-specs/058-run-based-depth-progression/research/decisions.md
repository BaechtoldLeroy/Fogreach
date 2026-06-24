# 058 — Decision-Lock + Hook-Audit (WP01)

## Entscheidungen (GELOCKT 2026-06-24, User)

- **D1 — „erfolgreicher Run" = `reason === 'dungeon_complete'`.**
  Tod (`death`) und freiwilliges Portal-Verlassen (`portal`) zählen NICHT.
  Begründung: eindeutiger, bereits existierender Hook; belohnt „durchstehen"
  ohne separaten Boss-Encounter.
- **D2 — Strikt +1; flacher-wählen bleibt.**
  `MAX_DEPTH` wächst ausschließlich durch Run-Abschluss. Der Hinabstieg darf
  flacher starten (Vertraute Gänge / Gewohnter Abstieg), aber nie tiefer als
  `MAX_DEPTH`. „An die Grenze" = exakt `MAX_DEPTH`.

## Hook-Audit (T002)

`leaveDungeonForHub(reason)` (`js/main.js`) ist der einzige saubere
Run-Abschluss-Punkt. Reasons + Aufrufer:

| reason | Aufrufer | zählt als Abschluss? |
|--------|----------|----------------------|
| `dungeon_complete` | `roomManager.js` (letzter Raum erreicht, `onStairOverlap` `nextIndex >= totalRooms`) | **JA → +1** |
| `death` | `main.js` (Spieler-Tod-Flow) | nein |
| `portal` | `inventory.js` (Portal-Scroll / freiwilliges Verlassen) | nein |

Per-Raum-Tiefen-Treiber, die in WP02 neutralisiert werden:
- `roomManager.js` `onStairOverlap` — setzt `SELECTED_WAVE_OVERRIDE =
  NEXT_DUNGEON_DEPTH` (= +1 pro Raum) im **regulären** Zweig.
- `roomManager.js` `markRoomCleared` — `DUNGEON_DEPTH = completed` +
  `NEXT_DUNGEON_DEPTH = completed+1` + per-Raum `maxDepth`-`setItem`.

Endless-Pfad (`roomManager.js` Endless-Zweig + `endlessMode.js`) behält seine
eigene Tiefen-Erhöhung (FR-08) — wird in WP02 NICHT angefasst.

## Architektur-Entscheid

Kern-Logik in ein **unit-loadbares** Modul `js/runDepth.js`
(`window.RunDepth`) + dünne Hooks in den Phaser-Dateien (Muster wie
`js/amuletEffects.js` aus Feature 059). Geplante API (rote Tests in WP01,
Implementierung WP03/WP02):

- `RunDepth.markRunStarted()` — Idempotenz-Latch bei Run-Start zurücksetzen.
- `RunDepth.isCompletionReason(reason)` — `=== 'dungeon_complete'`.
- `RunDepth.tryCompleteRun(reason)` — gated + idempotent; bumpt `MAX_DEPTH`
  genau einmal pro Run; gibt neue Tiefe oder `null` zurück.
- `RunDepth.nextRoomDepth(runStartDepth)` — run-konstant (= `runStartDepth`),
  ersetzt das alte Per-Raum-`+1`.

`js/persistence.js` bekommt `getMaxDepth()` + `bumpMaxDepth()` (liest/schreibt
`KEYS.MAX_DEPTH`).
