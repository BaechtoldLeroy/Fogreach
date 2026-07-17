# Kontrakt: Dialog-Auswahl-Komponente (`window.DialogChoice`)

**Zweck:** Der stabile API-Vertrag der wiederverwendbaren Spieler-Auswahlkomponente. Szenen (WP Schlüsselszenen), Dialog-Content (WP storyDialog) und die Finale-Inszenierung bauen **gegen diesen Kontrakt**, damit sie parallel zur Komponente selbst entwickelt werden können.

## Fundierung: bestehender Wirt

HubSceneV2 rendert Dialoge über `_showDialoguePages(npcData, titleStr, pages, questMode, questData, pageIndex)`. Jede `page` = `{ text, choices, _isInfoPage?, _isTurnin? }`, jede Choice = `{ label, action }`, gerendert als Buttons in einem Container mit `setScrollFactor(0)`. Die neue Komponente **erweitert dieses Modell additiv** — bestehende Pages/Choices bleiben unverändert.

## Datenformen (Classic-Script-Objekte, kein TS)

### DialogChoice
```
{
  label: 'Der Nebel nimmt jedem etwas.',   // Anzeigetext (Umlaute ok)
  response: 'BRANKA: Jedem. Nur nimmt er manchen mehr.',  // optional: Antwortzeile nach Wahl
  setFlags: ['some_flag'],                 // optional: Flags, die die Wahl setzt (ASCII)
  showIf: function(flags) { return !flags.other_flag; }, // optional: Sichtbarkeits-Predicate
  onPick: function(ctx) {}                  // optional: zusätzlicher Callback bei Auswahl
}
```
- `label` ist Pflicht. Alle anderen Felder optional.
- `setFlags` werden über den Flag-Setter (siehe unten) gesetzt, NICHT direkt über localStorage.
- `showIf(flags)` bekommt den aktuellen Flag-Satz; fehlt es, ist die Option immer sichtbar.

### DialogChoiceConfig (Aufruf-Parameter)
```
{
  prompt: 'FIGUR: gesprochene Zeile',       // optional: Zeile über den Optionen
  choices: [ DialogChoice, ... ],           // Pflicht: >=1 sichtbare Option nach showIf-Filter
  onResolved: function(result) {}           // Pflicht: nach Auswahl + evtl. Antwortzeile
}
```

### ChoiceResult (an onResolved übergeben)
```
{ index: 0, choice: <die gewählte DialogChoice>, flagsSet: ['some_flag'] }
```

## API

Die Komponente ist ein Classic-Script-Global. Sie bekommt die Wirts-Szene injiziert und rendert in deren Kontext.

```
window.DialogChoice = {
  // Rendert einen Auswahlblock in `scene`. Gibt ein Handle mit destroy() zurueck.
  // Nutzt intern den bestehenden Panel-/Button-Stil und setzt scrollFactor(0)
  // rekursiv auf allen erzeugten GameObjects (mobile Taps!).
  present: function(scene, config /* DialogChoiceConfig */) { return handle; },

  // Optionaler Adapter, damit eine `page` im bestehenden _showDialoguePages-Flow
  // Auswahlen tragen kann: liefert ein page-kompatibles Objekt.
  toPage: function(config) { return { text: config.prompt, choices: [...], _choiceConfig: config }; }
}
```

**Flag-Setter (Injektion, nicht global raten):** Die Komponente setzt Flags über eine übergebene bzw. aus `window.questSystem` aufgelöste Funktion. Vertrag:
- Setzen: `window.questSystem.setFlag(name)` falls vorhanden; sonst der in 062 etablierte Weg (completionFlags-Mechanik) — die Komponente kapselt das in einem internen `_setFlag(name)`.
- Lesen: `window.questSystem.getFlags()` (aus 062, liefert Kopie).

> Falls `questSystem` noch keinen öffentlichen `setFlag` hat, ergänzt der Dialog-UI-WP genau **einen** schmalen Setter dort ODER kapselt das Setzen intern; die Tasks-Phase weist die Zuständigkeit für einen etwaigen `questSystem.setFlag` genau EINEM WP zu (owned_files-Konflikt vermeiden).

## Verhalten / Invarianten

1. **scrollFactor:** Jedes erzeugte GameObject (Container, Text, Graphics, Buttons) bekommt `scrollFactor(0)` — rekursiv (siehe [[project_phaser_scrollfactor_dialogs]]), sonst verfehlen mobile Taps.
2. **showIf-Filter:** Vor dem Rendern werden Optionen mit `showIf(flags) === false` entfernt. Bleiben 0 übrig → `onResolved` wird mit einem „leeren" Ergebnis nicht aufgerufen; stattdessen behandelt der Aufrufer den Fall (Kontrakt: mindestens eine Option muss nach Filter sichtbar sein, sonst Programmierfehler).
3. **Auswahl:** Bei Klick/Tap wird `setFlags` gesetzt, optional `response` als Folgezeile gezeigt, dann `onResolved(result)` aufgerufen. `onPick` (falls vorhanden) läuft vor `onResolved`.
4. **Idempotenz beim Flag-Setzen:** doppeltes Setzen desselben Flags ist harmlos (Flags sind ein Set).
5. **Keine Story-Daten-Mutation:** Die Komponente ändert keine QUEST_DEFINITIONS; sie liest/setzt nur Flags.
6. **Timestamps:** Falls die Komponente Zeit braucht (z. B. Entprellung), nutzt sie `Date.now()`.

## Testbarkeit

- Die **reine Auswahllogik** (showIf-Filter, Flag-Sammlung, Ergebnis-Aufbau) wird in eine DOM-freie Hilfsfunktion ausgelagert (`window.DialogChoice.resolve(config, flags)` → gefilterte Optionen + Ergebnis-Berechnung), damit `tests/dialogChoice.test.js` sie ohne Phaser prüfen kann. Das Phaser-Rendering (`present`) wird im Browser-Boot-Check verifiziert, nicht im Unit-Test.

## Für parallele Konsumenten (Szenen / Content / Finale)

Konsumenten dürfen sich auf `DialogChoice.present(scene, config)` und die Datenformen oben verlassen. Sie brauchen die Implementierung NICHT — nur den Kontrakt. Beispiel (Szene):
```
window.DialogChoice.present(this, {
  prompt: 'ELARA: Jemand muss danach entscheiden, was die Stadt erfaehrt.',
  choices: [
    { label: 'Ich vertraue dir.', setFlags: ['elara_trust'] },
    { label: 'Und wenn du das Falsche wirst?', response: 'ELARA: Dann halte mich auf.' }
  ],
  onResolved: (r) => { /* Szene fortsetzen; ggf. observe-Trigger feuern */ }
});
```
