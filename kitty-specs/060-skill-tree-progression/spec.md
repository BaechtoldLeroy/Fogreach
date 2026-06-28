# Specification: Skill-Baum-Progression (pure D2)

**Feature**: 060-skill-tree-progression
**Created**: 2026-06-28
**Mission**: software-dev
**Tracker**: #58 (Erwerb-Modell) · Epic #59 · leitet ab: #48 (Level-Ups), #45 (Balance), #51 (Gold-Sink), #41 (Pacing)
**Branch contract**: planning on `main`, merges into `main`

## 0. Gelockte Design-Entscheidungen (verbindlich)

Aus #58-Diskussion (User-Entscheide):

1. **Skill-Punkte-Quelle:** ausschließlich **Level-Ups** — **1 Punkt pro Level**. Keine Meilenstein-Bonuspunkte.
2. **Baum-Form:** **EIN** großer Skill-Baum (keine getrennten Schulen).
3. **Aktive Slots:** bleiben bei **4** (Q/W/E/R), nicht erweiterbar.
4. **Respec:** **jederzeit im Hub**, Kosten **skalierend mit Gold**.
5. **Grundrichtung:** **pure D2** — harte Punkte, Build-Commitment, **Voraussetzungen + Synergien**. (Roguelite-Karten-Hybrid bewusst NICHT in diesem Feature.)
6. **Gold-Sink (#51):** nur **Maras Schwarzmarkt aufwerten + Respec**. Kein Gambling/Söldner. **Keine neue Währung.**

## 1. Overview

Heute werden aktive Fähigkeiten (`ABILITY_DEFS` in `js/abilitySystem.js`) im
Kampagnen-Modus **automatisch** über `UNLOCK_RULES` (Trigger: kills/quest/boss/
wave) gelernt; der Spieler **wählt nicht**, *welche* Skills er erwirbt, sondern
equippt nur 4 von N in die Loadout-Slots (Q/W/E/R). Der Player-Level
(`neededXP = 2*playerLevel`) hat dadurch **kein spürbares Gewicht** (#48), und es
entstehen keine echten Build-Entscheidungen (#45).

Dieses Feature ersetzt den passiven Auto-Unlock durch ein **pure-D2-artiges
Skill-Baum-System**: Jeder **Level-Up gibt 1 Skill-Punkt**, den der Spieler im
Hub in **einen** Skill-Baum investiert. Knoten = aktive Fähigkeiten mit
**Rängen**, **Voraussetzungen** (Knoten@Rang / Min-Level) und **Synergien**
(Rang eines Knotens skaliert einen anderen). Vier aktive Slots bleiben; equippt
werden nur Skills mit ≥1 Rang. **Respec** ist jederzeit im Hub gegen
**skalierende Gold-Kosten** möglich → starker Gold-Sink (#51), zusammen mit einem
aufgewerteten Schwarzmarkt.

Der **Knowledge Tree** (`js/knowledgeTree.js`, Fragmente) bleibt **unangetastet**
als separate **passive Meta-Achse** über Runs hinweg. Skill-Baum = **aktive
Build-Achse** (Level-Punkte). Zwei klar getrennte Systeme.

## 2. Ziele / Non-Goals

**Ziele**
- Level-Ups bekommen sofortiges, spürbares Gewicht (1 Punkt = Entscheidung).
- Echte, build-definierende Skill-Wahl mit Voraussetzungen + Synergien.
- Gold wird wertvoll (Respec-Sink + besserer Shop).
- Anti-One-Skill-Dominanz über Rang-Caps + Synergie-Design.

**Non-Goals (dieses Feature)**
- Kein Roguelite-Karten-Hybrid (später ggf.).
- Keine Slot-Erweiterung über 4.
- Keine Änderung am Knowledge Tree (#26).
- Keine neue handelbare Währung.
- Endlos-Modus-Upgrade-Karten bleiben wie sie sind (separater Pfad).

## 3. Aktueller Stand (Code-Kontext)

- **AbilitySystem** (`js/abilitySystem.js`): `ABILITY_DEFS`, `learnAbility`,
  `getLearnedAbilities`, `getActiveLoadout`/Slots, `UNLOCK_RULES` +
  `_checkUnlocks` (kills/quest/boss/wave), `tryActivate` (vereinheitlicht
  Desktop/Mobile), Persistenz (`save`/load, `demonfall_abilities_v1`).
- **Loadout-UI**: K-Taste (`window.openLoadoutUI`), Slots Q/W/E/R; Mobile
  **slot-index-basiert** (Memory `mobile_slot_index_layout`).
- **Level/XP**: `playerLevel`, `playerXP`, `neededXP`/`getNeededXP` (≈`2*level`)
  in `js/main.js`/`js/player.js`; Level-Up-Stelle = wo XP überläuft.
- **Knowledge Tree** (`js/knowledgeTree.js`): Fragmente, Ränge, Respec (erstattet
  Fragmente) — Vorbild für Rang-/Respec-Mechanik.
- **Gold** (`js/lootSystem.js`): `grantGold`/`spendGold`/`getGold`.
- **Shop**: `js/scenes/ShopScene.js` (Maras Schwarzmarkt, Reroll, Potions).
- **Persistenz**: `js/storage.js` (Save-Payload) + `js/persistence.js` (Keys).

## 4. Funktionale Anforderungen (FR)

- **FR-01 — Skill-Punkte:** Bei jedem Level-Up wird **+1 Skill-Punkt** vergeben
  und persistiert. `getSkillPoints()`/Verfügbarkeit. (Erfüllt #48.)
- **FR-02 — Baum-Datenmodell:** EIN `SKILL_TREE` als Daten: Knoten `{ id,
  abilityId, maxRank, requires: [{node, rank}] | minLevel, synergies: [{from,
  perRank}] }`. Quelle der Wahrheit; rein lesbar/unit-testbar.
- **FR-03 — Punkte investieren:** `investPoint(nodeId)` erhöht den Rang um 1,
  wenn (a) Punkte verfügbar, (b) Voraussetzungen erfüllt (Min-Level +
  Vorgänger-Rang), (c) `rank < maxRank`. Sonst no-op + Rückgabe false.
- **FR-04 — Rang-/Synergie-Effekte:** Fähigkeiten skalieren mit ihrem Rang
  (Schaden/Cooldown/Effekt). **Synergien**: Rang von Knoten A erhöht eine
  Kennzahl von Knoten B (`perRank`). Zentrale Stelle, die der Combat-Pfad liest.
- **FR-05 — 4 aktive Slots:** Equip-Logik (Loadout Q/W/E/R) akzeptiert **nur
  Skills mit ≥1 Rang**. Bestehende `tryActivate`/Mobile-slot-index bleiben.
- **FR-06 — Respec:** `respec()` setzt **alle** Ränge zurück, gibt alle Punkte
  frei, **zieht skalierende Gold-Kosten** (z.B. f(Level/investierte Punkte));
  **jederzeit im Hub**. Validierung: nur wenn Gold reicht.
- **FR-07 — Auto-Unlock ablösen:** `UNLOCK_RULES`-Auto-Learn entfällt als
  Erwerbspfad. Knoten werden über Min-Level/Voraussetzung **verfügbar**
  (sichtbar/investierbar), aber NICHT automatisch gelernt.
- **FR-08 — Hub-Skill-Baum-UI:** Eigener Screen/Scene: Baum mit Knoten/Rängen/
  Voraussetzungen/Synergien anzeigen, Punkte setzen, Slots equippen, Respec-
  Button (Gold-Kosten sichtbar). Mobile-tauglich (scrollFactor-Muster beachten).
- **FR-09 — Gold-Sink Schwarzmarkt (#51):** Maras Schwarzmarkt aufwerten
  (besseres/erweitertes Sortiment, mehr Gold-Services) — zusammen mit dem
  Respec-Sink. Reiner Gold-Wert-Fix, keine neue Währung.
- **FR-10 — Pacing (#41):** Level-Kurve **steiler** als `2*level`
  (progressiver), damit Skill-Punkte über mehr Content gestreckt sind. Tunebar.
- **FR-11 — Persistenz + Migration:** `skillPoints`, `ranks` pro Knoten und
  equippte Slots speichern/laden. Alte Saves (`learnedAbilities`) sauber
  migrieren (z.B. gelernte Abilities → Rang 1 + entsprechende Punkte „verbucht"),
  ohne Crash/Item-/Skill-Verlust.

## 5. Nicht-funktionale Anforderungen (NFR)

- **NFR-01 — Testbarkeit:** Punkte-/Rang-/Voraussetzungs-/Synergie-/Respec-Logik
  als **pure, unit-testbares** Modul (kein Phaser), analog `knowledgeTree.js`.
  Regressionstests in `tests/`.
- **NFR-02 — Kein Loop-Bruch:** Combat-/Update-Pfad darf nie brechen; defensive
  Hooks (try/catch) bei UI/Effekt-Anbindung.
- **NFR-03 — Mobile:** Slots bleiben slot-index-basiert; Skill-Baum-UI + Equip
  funktionieren per Touch.
- **NFR-04 — Save-Kompatibilität:** Laden eines Pre-060-Saves führt zu einem
  konsistenten Zustand (Migration), kein Datenverlust.

## 6. Constraints (C)

- **C-01:** pure D2 zuerst — keine Roguelite-Karten in diesem Feature.
- **C-02:** EIN Baum, **4** Slots fix.
- **C-03:** Respec jederzeit im Hub, Gold-Kosten skalierend.
- **C-04:** Knowledge Tree (#26) bleibt unangetastet (separate passive Achse).
- **C-05:** Punkte ausschließlich aus Level-Ups (1/Level).
- **C-06:** Keine neue Währung; Gold-Sink = Respec + Schwarzmarkt.

## 7. Datenmodell-Skizze (illustrativ, finalisiert in plan.md)

```
SKILL_TREE = {
  nodes: {
    spin:    { abilityId:'spinAttack',  maxRank:5, requires:{ minLevel:1 } },
    charge:  { abilityId:'chargeSlash', maxRank:5, requires:{ minLevel:3, node:'spin', rank:2 } },
    dagger:  { abilityId:'daggerThrow', maxRank:5, requires:{ minLevel:1 } },
    // Synergie: jeder Rang in 'spin' gibt 'charge' +X% Schaden
    // charge.synergies = [{ from:'spin', perRank:0.08 }]
    ...
  }
}
```

Abgeleitet aus den bestehenden `ABILITY_DEFS`; konkrete Knoten/Synergien/Caps
werden in plan.md/tasks festgelegt (Balance-WP).

## 8. Erfolgskriterien (SC)

- **SC-01:** Level-Up vergibt genau 1 Punkt; in der UI sofort investierbar.
- **SC-02:** Knoten lässt sich nur bei erfüllten Voraussetzungen + freien Punkten
  hochranken; Cap greift.
- **SC-03:** Mind. 2 Synergie-Paare nachweisbar (Rang A pusht Effekt B).
- **SC-04:** Nur Skills mit ≥1 Rang sind equippbar (Desktop + Mobile).
- **SC-05:** Respec setzt alles zurück, zieht skalierendes Gold, nur bei
  ausreichend Gold; jederzeit im Hub.
- **SC-06:** Schwarzmarkt + Respec ziehen spürbar Gold ab (Gold hat Wert).
- **SC-07:** Pre-060-Save lädt ohne Verlust in einen konsistenten Skill-Zustand.
- **SC-08:** Unit-Tests grün; Dungeon-/Loadout-Smoke „Errors found: 0".

## 9. Spätere Phasen / offen (nicht in 060)

- Roguelite-Karten-Hybrid im Run (#58 Option).
- Breitere #45-Balance-Pässe (D2-Barbar-Tiefe, Gegner-Resistenzen).
- #41-Pacing über Level hinaus (Quest-Tiefenvorgaben, Loot-iLevel-Entkopplung).
