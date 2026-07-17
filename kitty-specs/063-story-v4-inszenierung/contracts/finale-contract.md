# Kontrakt: Vier-Regler-Finale (`window.QuestFinale.computeFinaleState`)

**Zweck:** Reine, DOM-freie Ausgangs-Logik des Finales. Fixiert Signatur, Eingabe-Flag-Vokabular und Ausgabeform, damit (a) die Logik + Tests **sofort und unabhängig** gebaut werden und (b) der Dialog-Content-WP genau die Flags setzt, die die Logik liest.

## Signatur

```
window.QuestFinale = {
  // Rein: keine Seiteneffekte, kein globaler Zustand, kein Storage/DOM-Zugriff.
  computeFinaleState: function(flags /* plain object, z.B. questSystem.getFlags() */) { return FinaleState; }
}
```
- `flags` ist ein einfaches Objekt `{ flagName: true, ... }`. Fehlende Flags gelten als `false`.
- Rückgabe ist ein neues, serialisierbares `FinaleState`-Objekt.

## Eingabe-Flag-Vokabular (verbindlich)

`computeFinaleState` liest AUSSCHLIESSLICH diese Flags. Der Content-/Szenen-WP MUSS genau diese Namen setzen (ASCII):

| Flag | Bedeutung | Wer setzt (Quelle) |
|---|---|---|
| `mole_evidence` | Maulwurf-Spur verfolgt | `espionage_informant` (062, completionFlag) |
| `three_hands_seen` | Handschriften-/drei-Siegel-Spur gesehen | Szene Elaras erster Riss (dieses Feature) |
| `self_remembered` | eigene Identität erinnert | `who_you_were` (062, completionFlag) |
| `elara_trust` | Elaras Vertrauen | `elara_meeting` (062, completionFlag) |
| `petitions_kept` | Gesuche heimlich für Mara behalten | Dialog-Wahl `council_seizure` (dieses Feature) |
| `petitions_surrendered` | Gesuche an den Rat abgegeben | Dialog-Wahl `council_seizure` (dieses Feature) |
| `convoy_blown` | im Konvoi aufgeflogen | optional; Spionage-Ausgang (falls vorhanden), sonst nie gesetzt |
| `branka_ally` | Branka steht an Deiner Seite | Branka-Vertrauens-Dialog (dieses Feature) |
| `thom_ally` | Thom steht an Deiner Seite | Thom-Vertrauens-Dialog (dieses Feature) |
| `verification_refused` | Siegel verweigert (nicht kompromittiert) | Dialog-Wahl `magistrat_verification` (dieses Feature) |

> Neue Flags dieses Features (`three_hands_seen`, `petitions_kept/surrendered`, `branka_ally`, `thom_ally`, `verification_refused`, optional `convoy_blown`) sind die owned-Verantwortung des Content-/Szenen-WP. Erfindet der Logik-WP zusätzliche Flags, müssen sie hier ergänzt werden — der Kontrakt ist die einzige Wahrheit.

## Ausgabe: FinaleState

```
{
  betrayalForeseen: false,   // Regler 1
  allies: { branka: false, mara: false, thom: false },  // Regler 2
  elara: 'dies',             // Regler 3: 'lives' | 'dies'
  remembered: false,         // Regler 4
  // abgeleitete Praesentations-Hinweise (fuer die_reckoning-Inszenierung):
  aloneAtEnd: true,          // true, wenn kein Verbuendeter anwesend
  namelessEnding: true       // true, wenn !remembered
}
```

## Ableitungsregeln

1. **Regler 1 — `betrayalForeseen`** = `mole_evidence === true || three_hands_seen === true`.
   Wer die Spur (Maulwurf ODER Handschriften) verfolgt hat, sieht den Verrat kommen.
2. **Regler 2 — `allies`** (jeweils unabhaengig):
   - `mara`  = `petitions_kept === true || mole_evidence === true` **und nicht** `convoy_blown === true`.
   - `branka` = `branka_ally === true`.
   - `thom`   = `thom_ally === true`.
   - Ratsfreundliche Kompromittierung leert den Raum: ist `petitions_surrendered === true` und `mara` nicht anderweitig verdient, bleibt Mara abwesend (die `petitions_kept`-Bedingung greift dann nicht).
3. **Regler 3 — `elara`** = `'lives'` genau dann, wenn `elara_trust === true` **und** (`mole_evidence === true || three_hands_seen === true`) — mit Vertrauen UND Beweisen haeltst Du sie mit Worten auf. Sonst `'dies'` (ihre eigene Klinge).
4. **Regler 4 — `remembered`** = `self_remembered === true`.
5. **Abgeleitet:** `aloneAtEnd = !(allies.branka || allies.mara || allies.thom)`; `namelessEnding = !remembered`.

## Default / Robustheit

- Leeres oder `null`/`undefined`-Flags-Objekt → alle Regler konservativ false: `{ betrayalForeseen:false, allies:{branka:false,mara:false,thom:false}, elara:'dies', remembered:false, aloneAtEnd:true, namelessEnding:true }`. Kein Fehler.
- Unbekannte Flags im Eingabeobjekt werden ignoriert.
- Reine Funktion: gleicher Input → gleicher Output; kein `Math.random`, kein `Date`.

## Test-Erwartungen (`tests/questFinale.test.js`)

- Pro Regler je ein true- und ein false-Fall (mind. 8 Fälle).
- Elara lebt nur bei Vertrauen UND Beweis; stirbt bei Vertrauen ohne Beweis und bei Beweis ohne Vertrauen.
- `petitions_surrendered` allein macht Mara nicht anwesend; `petitions_kept` schon.
- Default-Fall (leeres Objekt) liefert den konservativen Zustand ohne Fehler.
- Reinheit: zweimaliger Aufruf mit demselben Objekt liefert deep-equal Ergebnisse; das Eingabeobjekt wird nicht mutiert.
