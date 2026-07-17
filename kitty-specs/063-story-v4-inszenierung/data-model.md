# Data Model: Story v4 — Inszenierung

Keine persistente Datenbank; „Modelle" sind In-Memory-Objektformen (Classic-Script). Persistenz nur über die bestehenden Story-Flags (062, pro Slot).

## DialogChoice
Eine wählbare Spieler-Option. Felder: siehe [dialog-ui-contract](contracts/dialog-ui-contract.md).
- `label` (Pflicht, String), `response?` (String), `setFlags?` (String[] ASCII), `showIf?` (fn(flags)->bool), `onPick?` (fn(ctx)).
- **Invariante:** `setFlags` enthält nur ASCII-Flagnamen; keine QUEST_DEFINITIONS-Mutation.

## DialogNode / DialogSequence (`js/storyDialog.js`)
Datenbank der Skript-Auswahlen, gruppiert pro Akt/Quest.
- Struktur (Vorschlag): `{ [questIdOrSceneId]: { prompt?, choices: DialogChoice[] } }` bzw. eine geordnete Sequenz von `{ speaker, line }` mit eingebetteten Auswahlpunkten.
- Quelle: Dialog-Skript v1 (`[Spieler: …]` → `choices`, `{flag}` → `setFlags`, flag-abhängige Zeilen → `showIf`/Varianten).
- **Invariante:** jeder im Skript notierte `{flag}` hat einen Setzer; die Finale-relevanten Flags entsprechen dem [finale-contract](contracts/finale-contract.md).

## SceneBeat (`js/storyScenes.js`)
Ein inszenierter Moment mit Abschluss-Trigger.
- Felder (konzeptionell): `id`, `lines`/`choices` (über DialogChoice), `timing`/`camera` (Tween/Shake), `onComplete` (feuert observe-Trigger oder setzt Flag).
- Konkrete Beats: `collusion_session` (Zuhören-Leiste → `updateQuestProgress('observe','collusion_reveal_seen')`), `elara_first_crack` (→ `observe three_hands_seen`), `elara_camp` (kein Trigger, atmosphärisch), `reckoning_patricide` + `reckoning_print` (Finale).
- **Invariante:** szenenübergreifende Zeit über `Date.now()`; alle GameObjects `scrollFactor(0)` rekursiv.

## FinaleState (`js/questFinale.js`)
Serialisierbarer Ausgangs-Zustand. Form + Ableitung: siehe [finale-contract](contracts/finale-contract.md).
- `betrayalForeseen:bool`, `allies:{branka,mara,thom:bool}`, `elara:'lives'|'dies'`, `remembered:bool`, `aloneAtEnd:bool`, `namelessEnding:bool`.
- **Invariante:** rein aus `flags` abgeleitet; keine Seiteneffekte; Default konservativ false.

## StoryFlags (bestehend, 062)
- Set von ASCII-Flagnamen, gelesen über `questSystem.getFlags()` (Kopie), gesetzt über die Flag-Schnittstelle. Pro Slot persistiert.
- Dieses Feature ergänzt Setzer für die neuen Flags (siehe finale-contract-Tabelle); es ändert die Flag-Struktur nicht.

## Objective-Änderung (minimal, questSystem.js)
- `collusion_reveal_seen` und `three_hands_seen`: Objective-Typ `dialogue` (Platzhalter) → `observe` (echter Trigger). Kein weiterer Quest-Datenumbau, kein STORY_VERSION-Bump.
