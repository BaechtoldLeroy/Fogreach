# Data Model: Faction System (MVP)

**Feature**: 045-faction-system-mvp
**Date**: 2026-05-02

## Persisted state

**Storage**: `localStorage` under `demonfall_factions_v1`.
**Owner**: `factionSystem` only.

```json
{
  "version": 1,
  "standings": {
    "council": 0,
    "resistance": 0,
    "independent": 0
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `version` | int | Schema version. `1` for this feature. |
| `standings.council` | int | `[-100, +100]`, clamped on write. |
| `standings.resistance` | int | Same. |
| `standings.independent` | int | Same. |

### Migration policy
- `init()` reads the blob.
- `JSON.parse` failure or `version > 1` → discard, start fresh (defaults).
- Missing faction key → default to 0 (FR-08).

## Faction id constants

```js
const FACTIONS = {
  COUNCIL:     'council',
  RESISTANCE:  'resistance',
  INDEPENDENT: 'independent'
};
```

## Tier breakpoints

```js
function tierOf(value) {
  if (value < -25) return 'hostile';
  if (value >  50) return 'allied';
  if (value >  25) return 'friendly';
  return 'neutral';
}
```

## Subscriber contract

```text
callback(factionId, newValue, oldValue)
  - fired on every successful mutation (zero-delta no-ops do not fire)
  - subscribers are stored in a Set; iteration uses a snapshot per notify
  - exceptions are caught + logged; remaining subscribers still fire
```

## i18n key surface

```
faction.aldric.greet.hostile
faction.aldric.greet.neutral
faction.aldric.greet.friendly
faction.aldric.greet.allied
faction.quest.resistance_fetch.title
faction.quest.resistance_fetch.desc
```

(Total 6 keys × 2 languages = 12 lines of registration.)
