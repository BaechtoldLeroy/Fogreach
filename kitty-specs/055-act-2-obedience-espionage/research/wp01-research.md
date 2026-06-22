# WP01 Research — Akt-2-Integration & Espionage-Grundlagen

**Feature**: 055 · **Datum**: 2026-06-23 · Befunde am Code verifiziert.

## T002/T005 — Story-/Quest-Architektur (entscheidend für WP02)

### Act-Index ist konsistent (Kommentar-Labels NICHT)
`STORY_ACTS` (js/storySystem.js) = die kanonische Index-Achse:

| Index | id | Bedeutung |
|------:|----|-----------|
| 0 | auftrag | Akt-1-Start |
| 1 | treuer_diener | Akt 1 |
| 2 | erste_risse | **Start „Akt 2"-Content** (nach Akt-1-Q6) |
| 3 | wahrheit | Akt-2-Wendepunkt (Ritualkammer) |
| 4 | bruch | Akt-2-Abschluss |
| 5 | rebellion | (später) |
| 6 | offenbarung | Finale (Elara-Verrat) |

⚠️ Die Code-**Kommentare** („=== Act 3: Erste Risse ===") sind ein
menschliches Label-Mismatch — die **Mechanik nutzt den Index**. `requiredAct`
auf Quests = STORY_ACTS-Index.

### Quest-Verfügbarkeit (`getAvailableQuests`, js/questSystem.js:733)
Eine Quest wird angeboten, wenn ALLE gelten:
1. `state.status === 'available'`
2. `def.npcId === npcId`
3. `currentActIndex >= def.requiredAct` (Zeile 741)
4. ALLE `def.prerequisites` sind `completed` (Zeile 743)
5. optionales `def.gate()` true (Zeile 753, Faction-Gating — **055 nutzt es NICHT**)

→ **Akt-2-Quests**: `requiredAct: 2`, `prerequisites` nur für Erzähl-
Reihenfolge, **kein `gate`** (= keine Entscheidungen/Gates, User-Vorgabe).

### Milestone-Advance-Hook (`advanceToAct`, js/storySystem.js:556)
Quest-getrieben + idempotent (`clamped <= currentActIndex` → no-op, kann
nicht zurückrollen). Wave-Pfad advanced NICHT mehr (seit 050). →
- Q10 `ritual_chamber` complete → `StorySystem.advanceToAct(3)` (wahrheit)
- Q11 `bruch_confrontation` complete → `StorySystem.advanceToAct(4)` (bruch)
(Genauer Aufruf-Hook beim Quest-Complete in WP02 verdrahten.)

### Bestands-Quests `requiredAct: 2` (anreichern, NICHT duplizieren)
- `mara_contact` „Die Späherin" (dialogue `mara_meet`) — Widerstand-Kontakt.
- `elara_meeting` „Elaras Geheimnis" (fetch 2 `document`, `unlocks: ['elara_trust']`)
  — **enthält schon den Betrugs-Setup**: Abschluss „Der Rat hat mich benutzt —
  für ihre Rituale." = Elaras Opfer-Masche (sie lügt; Kanon: sie steht mit dem
  Schattenrat). **Idealer Foreshadow-Anker** (FR-13 #2: ihre Belege zu glatt).
- `branka_doubt` „Zweifel der Schmiedin" (kill 5 `elite_enemy`).

## T001 — Enemy-Detection-Basis
`js/enemy.js` nutzt KEINE wiederverwendbare „sightRange/aggroRange"-
Terminologie (grep negativ). → Stealth-Detection in WP03 als **eigenes**,
leichtgewichtiges System in `espionageSystem.js` bauen (Distanz-Check Wache↔
Player + optional LoS), nicht auf bestehende Aggro aufsetzen. Throttling
für NFR-02.

## T003 — Kuratierte-Raum-Zonen-Schema (Entwurf)
Espionage-Räume als roomTemplate-JSON (wie bestehende `js/roomTemplates/*.json`)
mit Zusatz-Metadaten (WP03):
```jsonc
{ "espionage": {
    "guards":  [{ "x":.., "y":.., "facing":"..", "range":120 }],
    "cover":   [{ "x":.., "y":.., "w":.., "h":.. }],
    "observe": [{ "id":"convoy_talk", "x":.., "y":.., "r":64, "seconds":4 }]
}}
```
Exaktes Schema + Loader in WP03/T022.

## T004/T006 — Gerüst (erledigt in WP01)
- `js/espionageSystem.js` Skeleton (`window.EspionageSystem`, no-op außerhalb
  Mission; API: start/end/setDisguise/onPlayerAttack/isDetected/observe/update).
  In index.html eingehängt.
- `tests/espionageSystem.test.js` (Skeleton-API + FR-04 Disguise-fällt-Test).
