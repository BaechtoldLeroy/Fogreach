# Quickstart — Manueller Akzeptanz-Playtest 041 i18n

Voraussetzung: Server läuft (`npx serve -p 3000`), Browser auf `http://localhost:3000`.

## Smoke-Test (Pflicht)

| # | Aktion | Erwartung |
|---|--------|-----------|
| 1 | Spiel laden mit leerem localStorage | UI komplett deutsch (Default) |
| 2 | Settings öffnen | Neue Zeile "Sprache / Language" sichtbar, Auswahl `Deutsch` aktiv |
| 3 | Auf `English` wechseln | Settings-Menü sofort komplett englisch (Hot-Switch) |
| 4 | Settings schließen, im Hub umschauen | HUD-Texte (Health, XP, Level), Hub-Hinweise englisch |
| 5 | Loadout-Overlay öffnen (`L`-Taste) | Overlay komplett englisch |
| 6 | Run starten, Quest-Tracker oben rechts | Englisch |
| 7 | NPC-Dialog auslösen | Dialog englisch |
| 8 | Random-Event triggern (z.B. Schrein) | Event-Toast + Dialog englisch |
| 9 | Loot aufheben (Quest-Item) | Item-Name englisch |
| 10 | Browser reloaden | Sprache bleibt `English` (Persistenz) |
| 11 | Settings → zurück auf `Deutsch` | Alles wieder deutsch |
| 12 | Browser-Console | KEINE `[MISSING:key]`-Warnings |

## Edge Cases

| Aktion | Erwartung |
|--------|-----------|
| `localStorage.setItem('demonfall_settings_v1', JSON.stringify({language:'fr'}))` + Reload | Fallback auf `'de'`, Console-Warning |
| Während aktivem Random-Event Sprache wechseln | Event-Dialog re-rendert beim nächsten Frame oder bei nächster Choice; kein Crash |
| Schneller Doppelwechsel DE→EN→DE | Letzter State gewinnt, kein Race |

## Performance-Check

| Test | Erwartung |
|------|-----------|
| 5min Run mit englisch | 60fps gehalten, keine FPS-Drops durch i18n |
| Sprachwechsel | <100ms wahrnehmbare Latenz |

## Regressions-Check

| Bereich | Erwartung |
|---------|-----------|
| Combat | unverändert (Damage-Zahlen, Crit, AI) |
| Inventory | Equipment-Wechsel funktioniert |
| Save/Load | Spielstand lädt korrekt |
| Mobile-Steuerung | unverändert |
| Existierende Scenes | keine Crashes, keine fehlenden Texte |

## Abnahme

Alle Smoke-Tests + Edge Cases ✓ + keine Console-Errors → Feature akzeptiert.
