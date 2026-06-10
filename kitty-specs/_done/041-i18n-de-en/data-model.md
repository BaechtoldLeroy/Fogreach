# Phase 1 — Data Model: 041 i18n DE/EN

## Entities

### LanguageCode

```
'de' | 'en'
```

- Default: `'de'`
- Validation: nur diese zwei Werte zulässig; ungültiger Wert → Fallback auf `'de'`.

---

### StringRegistry

Globale, in-memory Map, gefüllt durch `register(lang, dict)`-Aufrufe.

```js
{
  de: { 'settings.title': 'Einstellungen', 'hud.dead': 'DU BIST GESTORBEN', ... },
  en: { 'settings.title': 'Settings',      'hud.dead': 'YOU ARE DEAD',      ... }
}
```

- **Key-Schema**: `<modul>.<bereich>[.<detail>]` — punkt-separiert, snake_case innerhalb.
  - Beispiele: `settings.title`, `settings.audio.muted`, `hud.health_label`, `hud.dead`, `quest.aldric_cleanup.title`, `event.shrine.title`, `event.shrine.choice_power`, `loot.quest_item.cellar_key`
- **Wertetyp**: String. Optional `{0}`/`{name}`-Platzhalter für Interpolation.

---

### SettingsExtension

Erweitert bestehendes `demonfall_settings_v1`-Objekt:

```js
{
  // ... bestehende Felder (audio, mute, difficulty, ...)
  language: 'de' | 'en'     // NEU
}
```

- Migration: fehlt `language` → `'de'` (kein Schreibvorgang nötig, getter liefert Default).

---

### ChangeSubscriber

```js
type ChangeCallback = (newLang: 'de' | 'en') => void
```

- Registriert via `i18n.onChange(cb)` → `unsubscribe`-Funktion.
- Gefeuert _nach_ `setLanguage()`-Update, _vor_ Persistierung-Returns.

---

## Key-Inventar (initial, expandiert während Implementation)

Vollständige Erfassung folgt in den Migrations-Work-Packages. Initiale Module + ungefähre Key-Counts:

| Modul | Datei | Approx. Keys | Beispiel-Prefix |
|-------|-------|--------------|-----------------|
| Settings | `scenes/SettingsScene.js` | ~13 | `settings.*` |
| HUD | `main.js` | ~27 | `hud.*` |
| Quests | `questSystem.js` | ~95 | `quest.<quest_id>.*` |
| Events | `eventSystem.js` | ~14 | `event.<event_id>.*` |
| Loadout | `loadoutOverlay.js` | ~13 | `loadout.*` |
| Loot | `loot.js` | ~10 | `loot.*` |
| Start | `scenes/startScene.js` | ~5 | `start.*` |
| **Σ** | | **~177** | |

Konkrete Key-Liste wird pro Work-Package in der Tasks-Phase finalisiert.

---

## State Transitions

```
[App Start]
  → persistence.getLanguage() → 'de' (default) | 'en' (persistiert)
  → i18n.setLanguage(lang)
  → Phaser bootet → Szenen rendern mit aktiver Sprache

[User wechselt Sprache in Settings]
  → SettingsScene._languageRow callback
  → i18n.setLanguage(newLang)        // 1. Registry-Active-Lang setzen
  → i18n.onChange-Subscriber feuern  // 2. Re-Render lebende Szenen
  → persistence.setLanguage(newLang) // 3. Persistieren

[User reloadet Browser]
  → persistence.getLanguage() liefert persistierte Sprache
  → identisch zu App Start
```
