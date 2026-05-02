# Quickstart: Faction System (MVP)

**Feature**: 045-faction-system-mvp

## 1. Run the unit tests

```powershell
npm test
```

The new file `tests/factionSystem.test.js` is part of the sweep. ~15 tests cover the public contract.

## 2. Launch the game

```powershell
npx serve .
```

In DevTools console:

```js
FactionSystem.getStanding('council');           // 0
FactionSystem.adjustStanding('council', -30);   // -30
FactionSystem.getTier('council');               // 'hostile'
FactionSystem.adjustStanding('resistance', 26); // 26
FactionSystem.getTier('resistance');            // 'friendly'
```

## 3. Verify NPC variant

1. Walk to Aldric in the hub.
2. With Council standing < -25, his greeting is hostile.
3. With Council standing in `[-25..+25]`, neutral.
4. Above +25, friendly.

## 4. Verify gated quest

1. With Resistance standing < 25, the showcase Resistance fetch quest does NOT appear in the NPC's offer list.
2. Raise to 25+ via DevTools (`FactionSystem.adjustStanding('resistance', 25)`).
3. Re-open the NPC dialog → the offer is now visible.

## 5. Persistence keys touched

- `demonfall_factions_v1` — owned by FactionSystem.
- **Not** touched: any other key.
