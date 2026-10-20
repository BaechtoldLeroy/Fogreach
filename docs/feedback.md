# Tester-Rückmeldungen einrichten

Im Spiel gibt es unter dem Inventarknopf einen Knopf mit Feder und Pergament
(zusätzlich die Taste F8). Tester wählen eine Kategorie, schreiben einen Text
und hängen auf Wunsch einen Screenshot an. Nach jedem 5. Lauf erscheint im Hub
eine kleine Sternebewertung (abschaltbar in den Einstellungen).

Das Spiel schickt alles an die Worker-Route `POST /api/feedback`
(`worker/feedback.js`). Der Worker legt daraus GitHub-Issues an:

| Was | Wohin |
| --- | --- |
| Rückmeldung | ein neues Issue, Labels `tester-feedback` plus Kategorie (`fehler`, `idee`, `balance`, `story-text`, `sonstiges`) |
| Screenshot | KV-Namespace `FEEDBACK_BILDER` (180 Tage), im Issue verlinkt über `GET /api/feedback/bild/<id>` |
| Laufbewertung | ein Kommentar im Issue `Laufbewertungen <Spielversion>` (je Version genau eins, Labels `laufbewertung`, `tester-feedback`) |

Token und Repo stehen nur im Worker (als Secrets), nie im Spiel und nie im Repo.
Was das Spiel nicht senden kann (offline, Route noch nicht eingerichtet), merkt
es sich und reicht es beim nächsten Start nach.

Solange die Schritte unten fehlen, antwortet die Route mit 503 und die Spiele
der Tester sammeln die Rückmeldungen in ihrer Warteschlange.

## 1. GitHub-Token anlegen

GitHub, Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, Generate new token:

- Resource owner: Dein Konto
- Repository access: **Only select repositories**, nur das Spiel-Repo
- Permissions, Repository permissions: **Issues: Read and write**
  (Metadata: Read-only kommt automatisch dazu). Sonst nichts.
- Ablaufdatum setzen und vor Ablauf erneuern (Schritt 3 wiederholen).

## 2. Labels im Repo anlegen

Damit die Labels sicher gesetzt werden (ein reines Issues-Token legt fehlende
Labels nicht immer selbst an), einmal anlegen:

```
fehler  idee  balance  story-text  sonstiges  tester-feedback  laufbewertung
```

Ohne das Label `laufbewertung` findet der Worker das Bewertungs-Issue einer
Version nur über den KV-Speicher (Schritt 4); fehlt auch der, entstünde je
Bewertung ein neues Issue.

## 3. Secrets im Worker setzen

Im Repo-Ordner (Wrangler fragt nach dem Wert, er landet nicht in der Shell-History):

```
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GITHUB_REPO
```

`GITHUB_REPO` hat die Form `besitzer/repo`. Als Secret steht es weder im Repo
noch in einer ausgelieferten Datei. Alternativ beides im Cloudflare-Dashboard:
Workers & Pages, fogreach, Settings, Variables and Secrets, Typ **Secret**.

## 4. KV-Namespace für Screenshots anlegen und binden

```
npx wrangler kv namespace create FEEDBACK_BILDER
```

Die Ausgabe nennt eine `id`. Diese in `wrangler.jsonc` eintragen (die ID ist
kein Geheimnis):

```jsonc
  "kv_namespaces": [
    { "binding": "FEEDBACK_BILDER", "id": "<die ausgegebene id>" }
  ],
```

Danach committen und pushen; der nächste Build deployt mit der Bindung.
Eine Bindung nur im Dashboard reicht nicht: jeder Deploy aus `wrangler.jsonc`
ersetzt die Bindungen.

Ohne KV funktioniert alles ausser den Screenshots (sie werden dann verworfen).

## 5. Prüfen

Nach dem Deploy im Spiel auf https://fogreach.fogreach.workers.dev den
Feder-Knopf drücken, Text eingeben, Senden. Im Repo erscheint ein Issue mit
den Labels. Antwortet die Route mit 503, fehlt ein Secret; mit 502, lehnt
GitHub ab (Token abgelaufen oder ohne Issues-Recht).

## Grenzen

- Text höchstens 2000 Zeichen, Satz der Bewertung 300, Screenshot rund 450 KB
  (das Spiel verkleinert auf 800 px Breite, JPEG), Anfrage höchstens 900 KB.
- Rate-Limit: 8 Anfragen je IP in 10 Minuten, im Speicher der Worker-Instanz
  (einfach gehalten; gegen Dauerfeuer genug, kein harter Schutz).
- `@`-Erwähnungen und `#123`-Verweise im Freitext werden entschärft, damit
  Tester niemanden anpingen und keine Issues verlinken.
- Screenshot-Links sind öffentlich abrufbar, wer die zufällige ID kennt.
- Mitgesendet werden nur Spielversion, Szene, Tiefe, Akt, aktive Aufträge,
  Gerät (Touch oder Desktop), Fenstergrösse und Sprache, bei Bewertungen
  zusätzlich Grund, Tiefe und Dauer des Laufs. Keine Namen, keine Adressen.
