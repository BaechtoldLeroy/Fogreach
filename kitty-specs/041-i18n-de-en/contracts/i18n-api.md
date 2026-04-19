# Contract: `window.i18n` API

## Module: `js/i18n.js`

Klassisches Script (kein ESM). Exposed nur via globales `window.i18n`.

### `i18n.register(lang, dict)`

Registriert ein Dictionary für eine Sprache. Wird mehrfach für dieselbe Sprache aufgerufen → merged shallow.

| Param | Typ | Beschreibung |
|-------|-----|--------------|
| `lang` | `'de'` \| `'en'` | Zielsprache |
| `dict` | `Record<string, string>` | Key → Übersetzung |

Return: `void`

---

### `i18n.t(key, params?)`

Lookup mit Fallback-Kaskade.

| Param | Typ | Beschreibung |
|-------|-----|--------------|
| `key` | `string` | Punkt-separierter Key, z.B. `'settings.title'` |
| `params` | `Record<string,string\|number>` (optional) | Werte für `{name}`-Platzhalter |

Return: `string`

**Lookup-Reihenfolge**:
1. Aktive Sprache → `dict[active][key]`
2. Fallback `'de'` → `dict.de[key]`
3. Fehlt überall → `'[MISSING:'+key+']'` + `console.warn`

**Interpolation**: ersetzt `{key}` aus `params` (falls vorhanden). Kein Escaping (Phaser-Texte rendern Plain-Strings).

---

### `i18n.setLanguage(lang)`

Setzt aktive Sprache. Triggert alle `onChange`-Subscriber.

| Param | Typ | Beschreibung |
|-------|-----|--------------|
| `lang` | `'de'` \| `'en'` | neue Sprache |

Return: `void`

**Verhalten bei Invalid Input**: Console-Warning, fällt auf `'de'` zurück.

**Wichtig**: persistiert NICHT von selbst. Caller (SettingsScene) ist verantwortlich für `persistence.setLanguage()`.

---

### `i18n.getLanguage()`

Return: `'de'` \| `'en'` — aktuell aktive Sprache.

---

### `i18n.onChange(callback)`

Registriert einen Subscriber für Sprachwechsel.

| Param | Typ | Beschreibung |
|-------|-----|--------------|
| `callback` | `(newLang) => void` | wird nach `setLanguage()` synchron aufgerufen |

Return: `() => void` — Unsubscribe-Funktion.

---

## Module: `js/persistence.js` (Erweiterung)

### `persistence.getLanguage()`

Return: `'de'` \| `'en'` — gespeicherte Sprache oder `'de'` als Default.

### `persistence.setLanguage(lang)`

Persistiert Sprache in `demonfall_settings_v1.language`.

| Param | Typ |
|-------|-----|
| `lang` | `'de'` \| `'en'` |

Return: `void`

---

## Bootstrap-Vertrag (`index.html`)

Reihenfolge garantiert vor Phaser-Game-Init:

```html
<script src="js/persistence.js"></script>
<script src="js/i18n.js"></script>
<script src="js/i18n/strings.de.js"></script>
<script src="js/i18n/strings.en.js"></script>
<script>
  window.i18n.setLanguage(window.persistence.getLanguage());
</script>
<!-- ...alle anderen Scripts und Phaser-Boot... -->
```
