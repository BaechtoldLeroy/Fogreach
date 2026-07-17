# Research: Story v4 — Inszenierung

## R1 — Wirts-Dialogsystem (Entscheidung: erweitern, nicht ersetzen)
- **Befund:** HubSceneV2 hat bereits `_showDialoguePages(...)` mit `page.choices = [{label, action}]` und einen dedizierten `_showCollusionReveal` (4-Seiten-Reveal). Container laufen mit `setScrollFactor(0)`.
- **Entscheidung:** Die neue `DialogChoice`-Komponente erweitert dieses Modell additiv (neue Choice-Felder `response`/`setFlags`/`showIf`); bestehende accept/info/decline-Choices bleiben unangetastet.
- **Alternative verworfen:** Ein komplett neues Dialog-Overlay — würde Stil/Doppel-Logik duplizieren und die scrollFactor-Falle neu einführen.

## R2 — Flag-Setzen/-Lesen (Entscheidung: über questSystem)
- **Befund:** 062 lieferte `questSystem.getFlags()` (Kopie) und die `completionFlags`-Mechanik; Flags werden pro Slot via SlotStorage persistiert.
- **Entscheidung:** Die Auswahlkomponente liest über `getFlags()` und setzt über einen schmalen internen `_setFlag` (nutzt `questSystem.setFlag`, falls vorhanden; sonst kapselt sie den 062-Weg). Genau EIN WP darf einen etwaigen neuen `questSystem.setFlag` besitzen (owned_files).
- **Alternative verworfen:** Direkter `localStorage`-Zugriff — verletzt C-003 und die Slot-Architektur.

## R3 — Szenen-Umsetzung (Entscheidung: Overlay-Inszenierung im Hub-Kontext)
- **Befund:** Die drei Szenen (§13.1/13.2/13.3) sind Dialog-lastige Beats mit einfachen Timing-/Kamera-Momenten (Zuhören-Leiste, Vatermord). Kein freies Gameplay nötig.
- **Entscheidung:** Umsetzung als Overlay-/Dialog-Inszenierungen über die `DialogChoice`-Komponente + einfache Tween/Kamera-Beats, gerendert im bestehenden Szenen-Kontext (`js/storyScenes.js`), NICHT als neue Phaser-Scene-Klassen, solange das Muster trägt.
- **Alternative verworfen:** Vollwertige neue Scenes pro Beat — überproportional für den Umfang.

## R4 — Observe-Trigger statt Platzhalter (Entscheidung: 2-Zeilen-Flip in questSystem)
- **Befund:** 062 setzte `collusion_reveal_seen`/`three_hands_seen` als `dialogue`-Auto-Complete-Platzhalter, „der observe-Trigger kommt mit der jeweiligen Szene".
- **Entscheidung:** Die beiden Objectives werden auf `observe` umgestellt; die Szene feuert `updateQuestProgress('observe', target)`. Der 062-Trigger-Audit-Test wird entsprechend erweitert (observe-Ziele verdrahtet). Der Flip in `questSystem.js` gehört genau EINEM WP (Schlüsselszenen-WP), um owned_files-Konflikte zu vermeiden.

## R5 — Finale-Regler-Flags (Entscheidung: fixiertes Vokabular)
- **Befund:** Story §10/§13.4 beschreibt die vier Regler; die Flag-Namen streuen über das Skript.
- **Entscheidung:** Das Flag-Vokabular ist im [finale-contract](contracts/finale-contract.md) verbindlich fixiert (welche Flags gelesen werden, wer sie setzt). `computeFinaleState` liest nur diese; der Content-WP setzt genau diese. Neue Flags nur über eine Kontrakt-Änderung.
- **Offen (bewusst):** exakte Setzer-Dialogstellen für `branka_ally`/`thom_ally` bestimmt der Content-WP anhand des Skripts (Branka-/Thom-Vertrauensmomente); der Name ist fixiert, die Fundstelle folgt.

## R6 — Parallelität (Entscheidung: zwei Kontrakte + nicht-überlappende owned_files)
- **Entscheidung:** `computeFinaleState` (rein) hat keine Abhängigkeit → sofort. `DialogChoice` ist Fundament; Szenen/Content/Finale-Inszenierung bauen gegen den Dialog-UI-Kontrakt. Neue Logik/Content in eigene Dateien (`questFinale.js`, `dialogChoice.js`, `storyDialog.js`, `storyScenes.js`), HubSceneV2/index.html nur im Integrations-WP. So bleiben WPs überlappungsfrei.

## R7 — Deploy/Test (unverändert zum Projekt-Ritual)
- Cache-Buster pro geänderter JS-Datei; neue Module brauchen `<script>`-Tag mit Version. `node tools/runTests.js` grün halten; Browser-Boot-Check nach [[project_browser_verification]].
