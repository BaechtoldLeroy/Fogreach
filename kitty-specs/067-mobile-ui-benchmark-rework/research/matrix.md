# Benchmark-Matrix — Mobile-Touch-UI (WP01, Rohdaten)

Beobachtungen („was/wie") + Beleg pro Achse × Titel. **Keine Wertung/Empfehlung** (die folgt
in D-A). Format nach `contracts/matrix.contract.md`. Belegpflicht: NFR-001.

Referenz-Titel: Diablo Immortal (DI), Genshin Impact (GI), Archero (AR), Soul Knight (SK),
Vampire Survivors Mobile (VS), Brawl Stars (BS). Zusätzlich, wo einschlägig, eine
Mobile-UX-Standard-Zeile. Vergleichsanker: **Fogreach (Ist)**.

---

## A1 — Daumen-Zonen/Reachability & Einhand-Bedienung

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Links virtueller Stick (Bewegung), rechts Cluster aus Primärangriff + 4 Skills → klassischer Move-links/Action-rechts-Split. | fextralife Controls; game8 |
| GI | Joystick links-unten; Kamera per Drag rechts; Angriff/Skill/Burst als Icon-Buttons rechts; Sprung/Sprint nahe Bewegungsbereich. | game8; touchtapplay |
| AR | Einhändig: irgendwo ziehen-und-halten (floating Stick) bewegt; **kein** separater Action-Button. | pocketgamer; @Archero_Habby |
| SK | Analog-Stick links, Feuer-Button rechts-unten, Waffenwechsel darüber → Move-links/Fire-rechts. | soul-knight.fandom Controls |
| VS | Floating Joystick / Ein-Finger-Kontakt links; nur Bewegung nötig → einhändig. | gamepressure; serafimgaming |
| BS | Links Bewegung (Tap-to-Move ODER floating Joystick unter dem Daumen); rechts Attack-Joystick, Super darunter → Doppel-Rechtsdaumen. | brawlstars.fandom; game8 |
| Mobile-UX-Standard | Einhandnutzung ~49 %, davon ~67 % rechter Daumen; unten/unten-rechts am besten erreichbar, obere Ecken am schwersten (Thumb-Zone-Heatmap Hoober/Hurff). | Smashing Magazine; scotthurff |
| **Fogreach (Ist)** | Fester Joystick links; rechts/unten 8-Zellen-Ability-Bar (attack/slot1–4/potion/roll/interact). | js/mobileControls.js |

## A2 — Minimaler HUD / Informationsdichte

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Vergleichsweise dicht: Stick, rechter Skill-Cluster, Minimap oben-rechts, Menü-Icons, situative Prompts; UI bewusst größer als PC. | game8 |
| GI | Persistenter rechter Action-Cluster (Normalangriff/Skill/Burst) + Sprung/Sprint; Opazität/Größe justierbar, Position fix. | touchtapplay |
| AR | Extrem minimal: praktisch nur Bewegungs-Input + HP/Gegner-Indikatoren; keine Skill-Buttons. | pocketgamer |
| SK | Schlank: Move-Stick, Feuer, Waffenwechsel, Skill/Energie-Indikator; aufgeräumt. | soul-knight.fandom Controls |
| VS | Sehr niedrige Dichte: im Kern nur ein Stick; XP/Timer/Level als Overlay, keine Angriffs-Buttons. | serafimgaming |
| BS | Schlank: Bewegung links, Attack+Super-Joysticks rechts, Gadget/Ammo/HP-Indikatoren. | brawlstars.fandom |
| **Fogreach (Ist)** | 8 Ability-Zellen dauerhaft sichtbar + Joystick + HUD (HP/Stats/Raum/Gold via hudV2). | js/hudV2.js, js/mobileControls.js |

## A3 — Kontextuelle statt redundante Buttons

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Getrennte Buttons (Primärangriff + einzelne Skills); Aufheben via Auto-Pickup-Setting/Tap-Navigation statt geteiltem Action-Button. | gamertweak; fextralife |
| GI | Getrennte Buttons (Normal/Skill/Burst); Objekt-/NPC-Interaktion über **kontextuellen** „F"/Interact-Prompt, der bei Reichweite erscheint. | game8 |
| AR | Keine Buttons im Kern-Loop — „Action" ist kontextuell am Bewegungszustand (Stehen = Angriff), also Modus statt Button. | levelwinner |
| SK | Der Feuer-Button ist **kontextsensitiv**: dieselbe Taste feuert UND interagiert mit Objekten (z. B. Truhe öffnen) → geteilter Primär-/Interakt-Button. | medium AndroidAppNews |
| VS | Keine Angriffs-/Action-Buttons; Input rein direktional; Level-Up-Wahl als kontextuelles 3-Optionen-Overlay. | gamepressure |
| BS | Getrennte Controls (Attack- und Super-Joystick); je zwei Modi (Tap vs. Drag), aber kein Kontext-Wechsel nach Zieltyp. | brawlstars.fandom |
| **Fogreach (Ist)** | Getrennte Zellen `attack` UND `interact` (redundant), kein Kontext-Switch (Feature 065/#80 adressiert genau das). | js/mobileAbilityButtons.js |

## A4 — Safe-Area / Notch / Ränder

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI / GI / AR / SK / VS / BS | **Nicht sicher belegbar**: keine erstquelligen, publizierten Angaben zum Notch-/Safe-Area-Handling der einzelnen Titel gefunden. Indirekt: GI (Touch-UI Größe/Opazität) und DI (UI-Skalierung) sind nutzer-justierbar, was Randgedränge beeinflusst. | touchtapplay (GI); game8 (DI) |
| Mobile-UX-Standard | Interaktive Controls gehören außerhalb der System-/Notch-/Rundungs-Insets (Safe-Area-Konvention); Reach-Zonen meiden ohnehin die oberen Ecken. | Smashing Magazine (Thumb-Zone) |
| **Fogreach (Ist)** | Dedizierte Safe-Area-Behandlung vorhanden (Insets). | js/mobileSafeArea.js |

## A5 — Lesbarkeit / Kontrast / Feedback

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Kein Mana/Ressourcen-System → Fähigkeiten nur über Cooldowns (an den Skill-Buttons); Minimap-Größe justierbar. | game8 |
| GI | Skill-/Burst-Buttons zeigen **radiale Cooldown-Timer**; Burst signalisiert Energie-Ladezustand am Icon; Buttongröße/Opazität konfigurierbar. | touchtapplay |
| AR | Angriffsbereitschaft implizit (feuert beim Stehenbleiben); Level-Up als 3-Optionen-Overlay. | levelwinner |
| SK | Feuern verbraucht Waffen-Energie → Energie/Ammo-Feedback an der Feuer-Aktion; Auto-Aim macht Ziel-Präzisions-Feedback unnötig. | soul-knight.fandom Mechanics |
| VS | Waffen feuern in festen Intervallen → „Bereitschaft" ist timing- statt cooldown-basiert; Level-Up = 3 Zufallsoptionen. | gamespew |
| BS | Super-Joystick farblich abgesetzt (gelb) als Bereitschafts-Signal ggü. Normalangriff; Ammo/Reload am Attack-Control. | brawlstars.fandom |
| **Fogreach (Ist)** | Cooldown-Sekunden + Labels an Buttons (zuletzt gefixt), pause-uhr-korrekt (gameNow); Icons mit Padding gegen Beschnitt. | js/mobileAbilityButtons.js |

## A6 — Auto-Targeting / Auto-Attack / Assist

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Auto-Pickup opt-in (nach Rarität), Auto-Navigate/Run zu Pins; **Angriffe** aber spielergetriggert. | gamesfuze; gamertweak |
| GI | Combat nutzt **Auto-Targeting** (kein manuelles Lock-on): Angriffe gehen zum nächsten Gegner; weitgehend automatisch, kein Toggle. | screenrant |
| AR | **Vollautomatisch**: beim Stehenbleiben Auto-Fire auf nächsten Gegner (Auto-Aim); nicht optional — Kernmechanik. | pocketgamer; levelwinner |
| SK | Eingebautes **Auto-Aim**: Spieler bewegt + feuert, Spiel zielt automatisch; Default (kein manuelles Twin-Stick-Zielen). | medium AndroidAppNews |
| VS | **Vollautomatische** Angriffe (Waffen feuern selbst, nicht abschaltbar); Spieler steuert nur Bewegung/Positionierung. | gamespew |
| BS | Aim-Assist opt-in pro Schuss: Tap = Quick-Fire/auto-gezielt auf nächstes Ziel; Drag = manuell zielen und loslassen. | brawlstars.fandom; game8 |
| **Fogreach (Ist)** | Kein Auto-Attack/Auto-Target auf Mobile; manueller Angriffs-Button, Spieler triggert. | js/mobileControls.js |

## A7 — Button-Größe & Trefferflächen-Ergonomie

| Titel | Beobachtung (was/wie) | Beleg |
|-------|------------------------|-------|
| DI | Rechter Skill-Cluster mit großen, daumenfreundlichen Buttons; UI insgesamt bewusst überdimensioniert ggü. PC. | game8 |
| GI | Rechte Action-Icons als große Kreis-Targets; Position fix, Größe justierbar. | touchtapplay |
| AR | Ganze (Bewegungs-)Bildschirmhälfte als eine große Drag-Fläche; keine kleinen diskreten Buttons. | @Archero_Habby |
| SK | Feuer-Button in unterer rechter Ecke, Waffenwechsel gestapelt darüber; diskrete Rechtsdaumen-Targets. | soul-knight.fandom Controls |
| VS | Ein floating Stick / Ein-Finger-Drag → große, fehlertolerante Trefferfläche; keine kleinen Buttons. | gamepressure |
| BS | Bewegung (links) und gestapelte Attack/Super-Joysticks (rechts) als große Drag-Zonen; floating Joystick re-zentriert unter dem Daumen. | game8 |
| Mobile-UX-Standard | Mindest-Trefferfläche: Apple HIG 44×44 pt; Material 48×48 dp; WCAG 2.5.5 (AAA) 44×44 px, 2.5.8 (AA) 24×24 px. | LogRocket; support.google.com/accessibility |
| **Fogreach (Ist)** | Feste Button-Größen in der 8-Zellen-Bar; Icons zuletzt mit Padding; keine floating/adaptiven Targets. | js/mobileAbilityButtons.js |

---

## Quellen (Kurzform)
- Diablo Immortal: fextralife Controls; game8 376937; gamertweak (auto loot); gamesfuze (auto loot).
- Genshin Impact: game8 297508; touchtapplay (mobile controls/settings); screenrant (auto-lock target).
- Archero: pocketgamer (how to play); levelwinner (beginners guide); x.com/@Archero_Habby.
- Soul Knight: soul-knight.fandom (Controls / Game_Mechanics); medium @AndroidAppNews (review).
- Vampire Survivors: gamepressure (controls explained); serafimgaming; gamespew (auto-attack off?).
- Brawl Stars: brawlstars.fandom (How to Play blog); game8 316910.
- Ergonomie: Smashing Magazine (Thumb Zone, 2016); scotthurff (design for thumbs); LogRocket (touch target sizes); support.google.com/accessibility (48dp).

## Selbstprüfung (quickstart Schritt 1)
- [x] 7 Achsen-Tabellen (A1–A7).
- [x] Je Achse ≥2 Referenz-Titel mit Beobachtung + Beleg (A1–A3, A5–A7 alle 6; A4 als „nicht belegbar" ehrlich markiert + Standard/Ist).
- [x] Fogreach-Ist-Zeile je Achse.
- [x] Nur Beobachtungen, keine Wertung/Empfehlung.
