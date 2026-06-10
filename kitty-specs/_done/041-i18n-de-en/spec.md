# Feature: Mehrsprachigkeit Deutsch/Englisch (i18n)

## Problem
Alle UI-Texte sind derzeit hardcoded auf Deutsch. Es gibt keine Möglichkeit, die Sprache zu wechseln. Internationalisierung ist nötig, um das Spiel auch für englischsprachige Spieler zugänglich zu machen.

## Goal
Einführung eines i18n-Systems mit Deutsch und Englisch als unterstützte Sprachen. Sprachauswahl im Settings-Menü mit Persistenz.

## Functional Requirements
- **FR-001**: i18n-Modul mit String-Lookup-Tabellen (de/en)
- **FR-002**: Alle UI-Texte (Menüs, HUD, Tooltips, Events, NPC-Dialoge) über i18n-Keys referenziert
- **FR-003**: Sprachauswahl im Settings-Menü (Deutsch/Englisch)
- **FR-004**: Sprache wird in localStorage gespeichert und beim nächsten Start wiederhergestellt
- **FR-005**: Standardsprache: Deutsch (bestehendes Verhalten bleibt default)
- **FR-006**: Hot-Switch: Sprachwechsel ohne Neustart des Spiels (Menüs werden neu gerendert)
