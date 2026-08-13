# D-A — Mobile-UI-Prinzipien für Fogreach (Synthese)

Aus der Matrix (WP01) abgeleitet. Format je Achse: **Beobachtung/Beleg → Empfehlung für
Fogreach → Delta zum Ist-Zustand → Übertragbarkeit**. Belege in `research/matrix.md`.

## Referenz-Leitbild (Design-Entscheidung)
Fogreach orientiert sich am **vollen ARPG-Modell à la Diablo Immortal / Genshin Impact**:
Joystick + Skill-Buttons, **manueller Kampf**. Das minimalistische Auto-Attack-Modell
(Archero/Vampire Survivors/Soul Knight) dient nur als **Kontrast** — seine Button-Sparsamkeit
ist übertragbar, sein Auto-Attack **nicht** (bewusste Entscheidung). Erleichterungen nur
**außerhalb** des Kampfes (Auto-Pickup; optionale Ziel-*hilfe* mit spielergetriggertem Feuern).

---

## A1 — Daumen-Zonen/Reachability
**Beobachtung/Beleg**: Move-links / Action-rechts-Split ist bei DI, Genshin und Brawl Stars
universell; die erreichbarste Zone bei Einhandnutzung ist unten/unten-rechts, obere Ecken
sind am schwersten (Hoober/Hurff Thumb-Zone).
**Empfehlung für Fogreach**: Split beibehalten. Die **häufigsten** Aktionen (Primärangriff +
oft genutzte Skills) in den unteren-rechten Daumenbogen legen; selten genutzte (Trank, Rolle)
an den Rand/oben der Zelle-Cluster. Nichts Interaktives in die oberen Ecken.
**Delta zum Ist-Zustand**: Fogreach hat den Split (Joystick links, 8-Zellen-Bar), aber die
Zellen sind nicht nach Häufigkeit/Reachability angeordnet — feste Reihenfolge attack/slot1–4/
potion/roll/interact.
**Übertragbarkeit**: übertragbar.

## A2 — Minimaler HUD / Informationsdichte
**Beobachtung/Beleg**: DI ist als ARPG bewusst *dichter* (Skill-Cluster, Minimap, Menüs);
Genshin hält einen persistenten rechten Cluster, macht Größe/Opazität aber justierbar.
Volle ARPGs tolerieren mehr HUD als Minimalisten.
**Empfehlung für Fogreach**: Skill-Cluster als Kern behalten (passt zum Leitbild), aber
konsequent nur *Nötiges* dauerhaft zeigen — insbesondere **leere Slots ausblenden** statt
grau anzeigen, und HUD-Randinfos (Stats) verdichten.
**Delta zum Ist-Zustand**: Fogreach zeigt alle 8 Zellen dauerhaft (auch leere) + hudV2-Infos.
**Übertragbarkeit**: übertragbar (leere-Slots-Ausblenden = #80-Sekundäridee).

## A3 — Kontextueller statt redundanter Button
**Beobachtung/Beleg**: DI trennt Angriff/Skills, verlagert das Aufheben aber auf **Auto-
Pickup**; Genshin nutzt einen **kontextuellen Interact-Prompt** bei Reichweite; Soul Knight
teilt sich Feuer+Interagieren einen Button.
**Empfehlung für Fogreach**: `attack` + `interact` zu **einem kontextsensitiven Primärbutton**
zusammenlegen (friedliches Ziel → Aktion, sonst Angriff) — deckt sich mit Feature 065.
**Auto-Pickup existiert bereits** (Gold-Overlap + magnetische Anziehung via Wissensbaum,
`pickupAddRange`) und reduziert den Interakt-Bedarf schon heute; der Kontext-Button bleibt
damit v. a. Angriff/Dialog/Tür.
**Delta zum Ist-Zustand**: Fogreach hat redundante getrennte Zellen `attack` + `interact`
(Auto-Pickup ist schon vorhanden).
**Übertragbarkeit**: übertragbar.

## A4 — Safe-Area / Notch / Ränder
**Beobachtung/Beleg**: Kein erstquelliges Per-Titel-Handling belegbar; Konvention:
interaktive Controls außerhalb der System-/Notch-/Rundungs-Insets, und die Thumb-Zone meidet
obere Ecken ohnehin.
**Empfehlung für Fogreach**: Bestehende Safe-Area-Behandlung beibehalten und prüfen, dass der
rechte Skill-Cluster und der Joystick vollständig innerhalb der Safe-Insets **und** im
erreichbaren Daumenbogen liegen (nicht bündig am Rand/an gerundeten Ecken).
**Delta zum Ist-Zustand**: Safe-Area ist via `mobileSafeArea.js` grundsätzlich vorhanden;
offen ist die *Verifikation* der Cluster-Platzierung.
**Übertragbarkeit**: übertragbar (Verifikations-/Feintuning-Aufgabe).

## A5 — Lesbarkeit / Kontrast / Feedback
**Beobachtung/Beleg**: Genshin zeigt **radiale Cooldown-Timer** an Skill-Buttons + Ladezustand
am Burst-Icon; DI gated Fähigkeiten sichtbar über Cooldowns an den Buttons.
**Empfehlung für Fogreach**: **Cooldown-Darstellung bleibt wie sie ist** (Sekunden + Labels,
gameNow-korrekt) — bewusste Entscheidung, kein radialer Sweep nötig. Einzige Empfehlung auf
dieser Achse: **Label-Kontrast** auf hell gefärbten Buttons (z. B. Cyan Frostnova/Wirbelwind)
sicherstellen (dunkler Text/Outline).
**Delta zum Ist-Zustand**: Cooldown-Anzeige ist ok und wird beibehalten; offen ist nur der
Kontrast auf hellen Buttons.
**Übertragbarkeit**: übertragbar (nur Kontrast; radialer Sweep bewusst NICHT übernommen).

## A6 — Auto-Targeting / Assist (Kampf bleibt manuell)
**Beobachtung/Beleg**: DI-Kampf ist **manuell** (Auto-Pickup/Auto-Navigate ja, Angriff nein);
Genshin **auto-targetet** den nächsten Gegner (Feuern bleibt gerichtet-automatisch); die
Auto-Attack-Titel (AR/VS/SK) feuern vollautomatisch.
**Empfehlung für Fogreach**: **Kein Auto-Attack** (Leitbild-Entscheidung). Eine Genshin-artige
**Ziel-*hilfe*** (Angriff/Skill richtet sich auf den nächsten Gegner) wäre denkbar, wird aber
**bewusst nicht verfolgt** — Zielen/Feuern bleibt manuell. Nicht-Kampf-Erleichterung Auto-Pickup
ist bereits vorhanden (s. A3).
**Delta zum Ist-Zustand**: Fogreach ist voll manuell (DI-Stil, wie gewünscht) und hat bereits
Auto-Pickup — kein Handlungsbedarf auf dieser Achse.
**Übertragbarkeit**: **Auto-Attack: nicht übertragbar** (Leitbild-Entscheidung). Zielhilfe:
technisch übertragbar, aber **nicht verfolgt** (Entscheidung).

## A7 — Button-Größe & Trefferflächen-Ergonomie
**Beobachtung/Beleg**: DI nutzt bewusst **überdimensionierte**, daumenfreundliche Skill-Buttons
(größer als PC); Standard-Mindest-Trefferfläche 44–48 px (Apple HIG / Material / WCAG); Brawl
Stars bietet einen **floating** Joystick, der unter dem Daumen re-zentriert.
**Empfehlung für Fogreach**: Alle Zellen **≥48 px** mit klarem Abstand; **Primärangriff als
größtes Target**; Prüfen, ob ein *floating*/adaptiver Joystick die Reachability verbessert.
**Delta zum Ist-Zustand**: Fogreach nutzt feste Button-Größen/-Positionen; keine adaptiven
Targets; Mindestgrößen ungeprüft.
**Übertragbarkeit**: übertragbar (floating Joystick als optionaler Punkt).

---

## Zusammenfassung (Leitbild-gefiltert)
Volles DI-ARPG-Modell: manueller Kampf, aber **bessere Lesbarkeit/Ergonomie**. Kern-
Empfehlungen: kontextueller Primärbutton (065, A3); Reachability-Anordnung + ≥48 px + größter
Primärbutton (A1/A7); Label-Kontrast auf hellen Buttons (A5); leere Slots ausblenden (A2);
Cluster-Platzierung in Safe-Area verifizieren (A4). Bereits vorhanden (kein Handlungsbedarf):
Auto-Pickup, Cooldown-Anzeige. Bewusst **draußen**: Auto-Attack (A6), radialer Cooldown-Sweep.

## Selbstprüfung (quickstart Schritt 2)
- [x] Je Achse ≥1 Prinzip-Block (A1–A7).
- [x] Jede Empfehlung mit ≥1 Beleg (Verweis auf matrix.md / Quellen).
- [x] Jede mit „Delta zum Ist-Zustand".
- [x] Nicht übertragbare Praxis mit Grund markiert (A6 Auto-Attack).
- [x] Empfehlungen im Phaser-Browser-Touch-Rahmen; self-contained.
