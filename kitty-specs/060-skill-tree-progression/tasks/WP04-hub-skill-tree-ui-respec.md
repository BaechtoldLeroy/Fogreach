---
work_package_id: WP04
title: Hub-Skill-Baum-UI (SkillTreeScene) + Respec-Button
dependencies: []
requirement_refs:
- FR-06
- FR-08
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: da15e554e5ecd761760317891c56efecd487b451
created_at: '2026-06-28T00:00:00Z'
subtasks:
- T017
- T018
- T019
- T020
- T021
phase: Phase 3 - UI
assignee: ''
agent: ''
history:
- timestamp: '2026-06-28T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/scenes/SkillTreeScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/SkillTreeScene.js
- js/scenes/HubSceneV2.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP04 – Hub-Skill-Baum-UI + Respec-Button

## Ziel
Ein Hub-Screen, in dem der Spieler den Skill-Baum sieht, Punkte investiert, die 4
Slots equippt und (gegen Gold) respecct. Lesbar, mobile-tauglich, i18n DE+EN.

## Requirements
FR-08 (Skill-Baum-UI), FR-06 (Respec im UI). **Depends on**: WP01–03.

## Kontext / Code-Anker
- `js/scenes/HubSceneV2.js` — Hub-Eingänge/Scene-Wechsel, `_showSplashModal`/Dialog-Muster, `_ktPropagateScrollFactor` (Mobile-sicher), Loadout-Aufruf (`openLoadoutUI`).
- `js/scenes/CraftingScene.js` / `ShopScene.js` — Vorbild für eine eigene Hub-Scene (Layout, Buttons `_createButton`, Back-to-Hub, i18n-Register).
- `js/skillTree.js` (WP01/02) — `getAllNodes`, `getRank`, `getNode`, `isNodeAvailable`, `investPoint`, `respec`, `getSkillPoints`.
- `js/lootSystem.js` — `getGold` (Respec-Kosten-Anzeige; Abzug final in WP05).
- i18n: `window.i18n.register('de'/'en', …)`.

## Subtasks
- **T017** `js/scenes/SkillTreeScene.js` (neue Scene, in `index.html` + SceneManager registrieren). Render: alle Knoten mit Name, **Rang/maxRank**, Status (verfügbar/gesperrt/voll), Voraussetzungen + Synergie-Hinweis. Verfügbare Punkte oben anzeigen.
- **T018** Investieren per Klick/Touch → `investPoint(node, playerLevel)`; Live-Refresh (Rang, Punkte, Folge-Verfügbarkeiten). Gesperrte Knoten visuell (grau + Prereq-Tooltip).
- **T019** **Equip-Bereich**: 4 Slots (Q/W/E/R); nur Skills mit ≥1 Rang wählbar (nutzt WP03). Slot-Belegung anzeigen + änderbar.
- **T020** **Respec-Button**: zeigt die (skalierende) Gold-Kosten an; bei Klick `respec()` + Gold-Abzug (Formel/Abzug final in WP05 — hier Button + Bestätigungs-Dialog + Hook). Nur klickbar wenn Gold reicht (Anzeige).
- **T021** i18n DE+EN für alle UI-Strings; Mobile/Touch (scrollFactor-Muster via `_ktPropagateScrollFactor`); Hub-Zugang (eigener Eingang/Button oder über die bestehende Loadout-UI erreichbar). Smoke: Scene öffnet/schließt fehlerfrei.

## Independent Test
Playwright: Scene öffnen, Punkt investieren (Rang steigt), Slot equippen, Respec-Button sichtbar mit Kosten; „Errors found: 0".

## Done-Kriterien
- Spieler kann im Hub Punkte setzen, Slots equippen, Respec auslösen (SC-01/04/05 UI-seitig).
- DE+EN vorhanden; Touch funktioniert; keine Konsolenfehler.

## Activity Log
