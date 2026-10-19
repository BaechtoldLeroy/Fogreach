# Quest-Übersicht — Fogreach

_Quest-Daten automatisch generiert aus_ `js/questSystem.js` _(QUEST_DEFINITIONS) — 52 Quests._  
_Neu erzeugen:_ `node tools/genQuestDoc.js`

---

# Kontext

## Prämisse

Unter Fogreach brennt eine **Esse**, die Erinnerungen verbrennt. Ihr Rauch ist der Nebel, und wer ihn atmet, vergisst. Der Kettenrat tritt als drei streitende Fraktionen auf, Magistrat, Klerus und Garde; innen gehören ihre Spitzen demselben Kreis an, dem **Schattenrat**. Er füttert die Esse mit beschlagnahmten Schriften und mit den Erinnerungen der Verschwundenen.

Du bist der **Archivschmied**, der letzte Mensch, der die Esse erneuern kann. Der Rat hat Dich geleert, damit der Nebel Dich in der Tiefe nicht auslöscht, und gibt Dir einen Widerstand, den er selbst anführt: durch **Elara**, Harrens Tochter. Sie lehrt Dich, die Esse zu «zerstören», indem man ihre Bindung löst. In Wahrheit ist genau dieses Lösen das Erneuern.

> Du hast geglaubt, Du arbeitest für den Rat, dann gegen ihn. In Wahrheit hast Du die ganze Zeit für ihn gearbeitet, auch auf der anderen Seite. Er brauchte nie Dein Ja, nur Deine Hände.

## Charaktere

| Figur | Rolle | Kern |
|---|---|---|
| **Archivschmied** (Du) | Letzter seines Handwerks, geleert vom Rat | Erst Ordnung, dann die Wahrheit, am Ende die eigene Geschichte. |
| **Elara** (Kindername Lene) | Harrens Tochter, Gesicht des Widerstands, **Mitglied des Schattenrats** | Soll Dich zur Esse bringen, damit Du sie erneuerst. Stösst im Finale ihren Vater weg; die Esse nimmt sie. |
| **Ratsherr Aldric** | Auftraggeber, Stimme des Schattenrats im Rat | Hat Dich geleert. Flieht nach dem Bruch der Esse in die Tiefe und wird selbst leer. |
| **Bürgermeister Harren** | Amt ohne Macht, kein Mitglied des Widerstands | Will sein Kind zurück. Steigt ohne Amulett hinab und verliert unterwegs alles bis auf «Lene». |
| **Mara** | Späherin, Schwarzmarkt, kennt Dich von früher | Merkt als Erste, dass der Widerstand verraten wird. Verlangt, dass Du Elara richtest. |
| **Branka** | Schmiedemeisterin | Moralischer Kompass, hilft Dir, Dich zu erinnern, und warnt vor dem Preis. |
| **Setzer Thom** | Druckerei | Die Presse ist die Bühne des Endes. |
| **Klerus-Priester**, **Stadtwache** | Fraktionsstimmen | Nennen Flucht „Besessenheit“ und Aufräumen „Reinigung“; antworten mit mehr Patrouillen. |

## Fraktionen

- **Magistrat**, **Klerus**, **Garde**: die drei ratsinternen Fraktionen. Streiten nach außen, gehören innen dem Schattenrat.
- **Widerstand**: die Opposition, in Wahrheit vom Schattenrat geführt (durch Elara).
- Ansehen bei Fraktionen gibt es seit Story v5 nicht mehr.

Die eine Spur durch das Spiel ist das **Siegel des Schattenrats**, ein Kreis aus drei ineinandergreifenden Ketten.

## Akt-Struktur

Der Bogen ist **rein quest-getrieben**: ein Akt steigt nur, wenn eine Quest ihn per `advanceAct` hochsetzt. Tiefen-basierter Aufstieg wurde in Feature 050 entfernt.

| Index | Akt | Wird erreicht durch |
|---|---|---|
| `0` | Prolog · Der Dienst | _Startzustand_ |
| `1` | Akt 1 · Treuer Diener | Abschluss von **Die verschwundene Tochter** |
| `2` | Akt 2 · Das Doppelspiel | Abschluss von **Die geheime Sitzung** |
| `3` | Akt 3 · Die Enttarnung | Abschluss von **Der Kettenmeister** |
| `4` | Akt 4 · Die Quelle | Abschluss von **Der Maulwurf** |

Jeder Akt hat einen Trigger — die Leiter ist lückenlos.

---

# Referenz

## Wie eine Quest angeboten wird

Ein NPC bietet eine Quest an, wenn **alle** Bedingungen gelten:

1. Status ist `available` (noch nicht angenommen/abgeschlossen)
2. Die Quest gehört diesem NPC (`npcId`)
3. `currentAct >= requiredAct`
4. **Alle** `prerequisites` sind abgeschlossen
5. Optionales `gate()` liefert `true` _(z. B. Maras Schwarzmarkt-Auftrag erst ab erreichter Tiefe 4)_

**Reihenfolge im Gespräch (Stufe 1b):** Abgabe, dann ein neuer **Story-Auftrag** (Gewicht story, boss oder finale), dann der Stand eines laufenden Auftrags, dann ein neuer Nebenauftrag. Story-Aufträge kommen also auch neben einem laufenden Nebenauftrag derselben Figur.

**Aldric nach dem Bruch:** Ab `enttarnt` steht er nicht mehr im Hub. Was er noch vergeben hatte, laufend oder nie angenommen, bekommt den Status `entfallen` (kein Lohn; im Journal: „Der Rat gibt Dir keine Aufträge mehr.“).

**`minDepth` gated nicht das Angebot, sondern den Fortschritt:** Ziele zählen erst, wenn der laufende Run auf mindestens dieser Tiefe ist.

**`angebotAb` gated das Angebot:** angeboten wird erst, wenn die erreichte Tiefe so weit ist. Laufende Aufträge behalten die Mindesttiefe ihrer Annahme.

**Akt-Index → Name:** `0` Prolog · Der Dienst · `1` Akt 1 · Treuer Diener · `2` Akt 2 · Das Doppelspiel · `3` Akt 3 · Die Enttarnung · `4` Akt 4 · Die Quelle

## Ziel-Typen und ihre Trigger

| Typ | Trigger im Code |
|---|---|
| `kill` (`enemy` / `elite_enemy`) | Gegner-Tod (`js/player.js`) |
| `explore` (`room`) | Raum gecleart (`js/roomManager.js` → `markRoomCleared`) |
| `explore` (`room_lauf`) | Raum gecleart, aber nur in EINEM Lauf: endet der Lauf ohne volles Ziel (Tod, Portal, Abschluss), zurück auf 0 (`onLaufEnde`) |
| `fetch` | Quest-Item aufgesammelt (`js/loot.js`) |
| `observe` | Spionage-Zone abgehört (`js/espionageSystem.js`) |
| `boss_kill` | Boss-Tod → `onBossKilled` (`js/player.js` Mapping) |
| `wave` (`reach_wave`) | Run auf Tiefe ≥ Ziel (`onWaveCompleted`) |
| `dungeon_run` | Abgeschlossener Run (`onDungeonCompleted`) |
| `craft` | Item gecraftet (`onCraft`) |
| `dialogue` | **Auto-Complete bei Annahme** |

## Wie die Sammelstücke ins Spiel kommen

Gilt für alle `fetch`-Ziele. Quelle: `js/loot.js` (questItemDefs) und `js/roomManager.js`.

- **Sie fallen nur, wenn sie gebraucht werden.** Ein Questgegenstand fällt ausschliesslich, solange die passende Quest läuft UND ihr Zähler noch nicht voll ist. Ohne angenommene Quest gibt es das Stück nicht, und nach dem letzten Exemplar hört es sofort auf zu fallen.
- **Sie fallen von Gegnern.** Je erschlagenem Gegner 10 %. Einzige Ausnahme ist das Ratsdokument mit 20 %. Pro Gegner fällt höchstens EIN Questgegenstand, auch wenn zwei Sammelquests gleichzeitig laufen: die Schleife bricht nach dem ersten Treffer ab.
- **Sie landen nie in einer Wand.** Stirbt der Gegner auf einem unbegehbaren Feld, rückt das Stück auf den nächsten erreichbaren Punkt. Sonst könnte eine Sammelquest unerfüllbar werden.
- **Aufheben zählt, nicht Tragen.** Der Zähler springt beim Darüberlaufen. Questgegenstände gehen nicht ins Inventar und belegen keinen Rasterplatz.
- **Ausnahme Ratsdokument.** Es liegt zusätzlich einmal garantiert in Elaras Kellerbegegnung. Vorher gab es nur die Platzierung, und Spieler suchten zu lange.
- **Beobachten ist etwas anderes.** Die `observe`-Ziele sammelt man nicht ein. Sie sind Spionagemissionen in eigenen Raumvorlagen (CouncilWarehouse, SealedArchive, InformantDen): verkleidet in die Zone, dort bleiben, nicht gesehen werden. Zieht man die Klinge, fliegt die Tarnung auf.

## Befunde

Aus dem Abgleich mit der Story-Bibel v4 (Stand b246). Keine davon ist ein Fehler im engeren Sinn. Jede ist eine Stelle, an der Umsetzung und Entwurf auseinandergehen.

**Vier Quests erfüllen ihr Kriterium beim Annehmen automatisch**, weil sie vom Typ `dialogue` sind: die geheime Sitzung, Elaras Geschenk, Elaras zweite Wahrheit, die Abrechnung.

**Die Abweichung liegt nicht bei den Quests, sondern unter ihnen.** Die geheime Sitzung, der Kippmoment der ganzen Geschichte, ist eine Quest, die sich beim Annehmen selbst abhakt. Ein Kommentar im Code sagt das offen: die inszenierte Szene sollte mit einem späteren Feature kommen. Dasselbe gilt für Elaras Geschenk und ihre zweite Wahrheit.

**Die Doppelagenten-Tonspur trägt vier der fünf verlangten Quests.** Überwachung fällt heraus: der Abschlusstext sagt nur, dass man keine Verschwörer gesehen hat. Der vom Entwurf verlangte Halbsatz, dass Mara erfährt, was der Rat nicht erfährt, fehlt.

**Eine Unstimmigkeit in der Reihenfolge.** Die Keller-Patrouille trägt `chain: 2`, ihre Folgequest aber `chain: 1`. Die Reihenfolge im Hub stellt damit den Auftraggeber vor seine eigene Voraussetzung.

## Boss-Leiter ↔ Quest-Leiter

Bosse spawnen an Tier-Gates (Tiefe = Vielfaches von 10, ab Akt 2), der Nachhall dazwischen auf Tiefe 25, solange sein Auftrag läuft:

| Boss | Tiefe | Quest |
|---|---|---|
| Kettenmeister | 10 | Der Kettenmeister (Mara) |
| Zeremonienmeister | 20 | Die Ritualkammer (Elara) |
| Der Nachhall | 25 | Was der Rauch behält (Mara); flüstert aus dem Gespielten, wechselt die Gestalt (Hall, Schwarm, Chor), Namen gehen an Thoms Presse |
| Elara, besessen | 30 | Die Quelle (Branka, Abgabe bei Thom) |
| Der Nachhall der Esse | 30, 60, … | kein Auftrag: steht dort, wenn die Quelle nicht läuft (ersetzt den Schattenrat) |

---

# Akt-Index 0 — Prolog · Der Dienst

## Säuberung der Keller

`aldric_cleanup` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Besiege 10 Gegner in den Kellern unter der Archivschmiede.

- **Ziel:** `kill` → `enemy` ×10
- **Vorbedingung:** keine
- **Belohnung:** mind. 30 XP (bzw. 40 % des Stufenbedarfs, Neben) · 5 MAT · 2 Druckblätter

**Angebot**

> Unten in den Kellern hat sich Ungeziefer eingenistet. Wilde Tiere, sagen die Wachen. Räum sie aus — zehn Stück, dann reden wir weiter.
> 
> Willst du diese Aufgabe übernehmen?

**Unterwegs**

> Die Keller sind noch nicht sicher. Kämpfe weiter.

**Abschluss**

> Gut. Die Keller sind gesäubert. Hier ist dein Lohn.
> 
> (Was offen ist, steht in Deinem Journal — Taste J oder das Journal-Symbol oben rechts.)


## Der erste Schliff

`einfuehrung_schmiede` · **NPC:** Schmiedemeisterin Branka · **Kette:** 1

> Geh in die Schmiede und baue dort an der Werkbank ein Ausrüstungsstück aus.

- **Ziel:** `system` → `upgrade` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · 8 MAT

**Angebot**

> Du trägst das, was Du unten gefunden hast, und Du trägst es, wie man ein Werkzeug trägt, das einem fremd ist.
> 
> Komm mit in die Schmiede, die Tür gleich neben mir. Leg eines Deiner Stücke auf die Werkbank und drück auf „Ausbauen“ — dann wird es Deins. Diesmal geht es auf mich; danach kostet es Gold und Eisenbrocken, und Du machst es allein.

**Unterwegs**

> Du hast es noch nicht gemacht. Geh in die Schmiede, leg ein Stück auf die Werkbank und drück auf „Ausbauen“. Diesmal zahle ich.

**Abschluss**

> (Sie dreht es einmal ins Licht.) Siehst Du. Dasselbe Stück, nur nicht mehr dasselbe.
> 
> Jedes Mal, wenn Du hochkommst, kommst Du hier vorbei. Nicht weil ich das sage, sondern weil Du sonst mit dem runtergehst, was letzte Woche gereicht hat.


## Eine Zeile, die bleibt

`einfuehrung_presse` · **NPC:** Setzer Thom · **Kette:** 1

> Geh in die Druckerei und lass Setzer Thom dort ein Edikt drucken.

- **Ziel:** `system` → `edikt` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · 2 Druckblätter

**Angebot**

> Der Rat schreibt jede Woche vor, was die Stadt denken soll. Wir können dasselbe — kleiner, aber wir können es.
> 
> Du hast Druckblätter dabei, ich sehe sie. Komm rein in die Druckerei, gleich neben mir, und such Dir ein Edikt aus — ich setze es. Es wirkt, solange es hängt, und es kostet Dich Aufmerksamkeit beim Rat. Beides sollst Du einmal gespürt haben, bevor es darauf ankommt.

**Unterwegs**

> Noch hängt nichts. Geh in die Druckerei, such Dir ein Edikt aus, ich setze es.

**Abschluss**

> (Er wischt sich die Finger am Kittel ab.) Jetzt steht es an jeder Ecke, und irgendwer liest es laut vor.
> 
> Merk Dir nur eins: Jede Zeile, die wir drucken, legt der Rat auf seine Waage. Druck nicht mehr, als Du unten wieder gutmachen kannst.


## Was unter dem Tisch liegt

`einfuehrung_markt` · **NPC:** Späherin Mara · **Kette:** 1

> Kauf Mara auf dem Schwarzmarkt etwas ab.

- **Ziel:** `system` → `markt` ×1
- **Vorbedingung:** Säuberung der Keller (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · mind. 30 Gold (wächst mit der Tiefe ab 1)

**Angebot**

> Du schleppst Gold herum, als wüsstest Du nicht, wofür. Ich schon.
> 
> Ich habe einen Stand — hier, unter dem Tisch. Frag nicht, woher die Ware kommt. Nimm irgendetwas, das Billigste reicht. Danach weisst Du, dass es ihn gibt, und das ist der ganze Punkt.

**Unterwegs**

> Nimm irgendetwas. Ich schreibe nicht auf, was.

**Abschluss**

> (Sie zählt das Gold nicht nach.) Gut. Du legst es immer noch zuerst auf den Tisch und fragst erst danach. (Sie stockt, als hätte sie schon zu viel gesagt.) Und jetzt vergiss, dass ich Dir das gezeigt habe.
> 
> Was ich nicht habe, hat vielleicht der Alte mit dem Karren, da unten. Wer mit vollen Taschen hochkommt und sie wieder mit runternimmt, hat etwas nicht verstanden.


## Wofür du taugst

`einfuehrung_talente` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Setz einen Punkt im Talentbaum (T) und leg die neue Fähigkeit im Loadout (K) auf eine Taste.

- **Ziel:** `system` → `talent` ×1; `system` → `loadout` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · 1 Heiltrank

**Angebot**

> Der Rat führt über jeden Bürger eine Akte, und in Deiner steht ein Wort, das mich stört: unbestimmt.
> 
> Das lässt sich ändern. Du sammelst unten Erfahrung, und Erfahrung wird zu Punkten. Setz einen. Wut, Ketten oder Schatten — such es Dir aus. Der Rat schätzt Leute, die sich festlegen.
> 
> Und dann: Ein Werkzeug, das Du nicht griffbereit hast, ist kein Werkzeug. Leg es auf eine Taste.

**Unterwegs**

> Noch immer unbestimmt. Öffne den Baum und setz einen Punkt. Welchen, ist Deine Sache.

**Abschluss**

> (Er notiert etwas, ohne aufzusehen.) Festgelegt. Gut.
> 
> Die Akte wird Dich überleben, Archivschmied. Das ist keine Drohung, das ist Verwaltung.


## Deine Akte

`einfuehrung_akte` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Sieh Dir Deine Charakterwerte an (C oder Dein Porträt oben links).

- **Ziel:** `system` → `charakterwerte` ×1
- **Vorbedingung:** Säuberung der Keller (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · 1 Heiltrank

**Angebot**

> Der Rat führt eine Akte über Dich. Sieh nach, was darin steht.
> 
> Stärke, Geschick, Vitalität — das ist jetzt aktenkundig. Wer weiss, was über ihn geschrieben steht, kann sich danach richten. Die anderen werden danach gerichtet.

**Unterwegs**

> Du hast noch nicht hineingesehen. Die Akte liegt offen — C, oder Dein Porträt oben links.

**Abschluss**

> (Er schlägt die Akte zu.) Jetzt weisst Du, was der Rat weiss. Nicht mehr.
> 
> Sieh wieder hinein, wenn Du etwas Neues trägst. Die Akte lügt nicht — das überlässt sie anderen.


## Die verschwundene Tochter

`harren_daughter_investigation` · **NPC:** Bürgermeister Harren · **Kette:** 1

> Finde das Tagebuchfragment der Bürgermeistertochter im Rathauskeller.

- **Ziel:** `fetch` → `journal_fragment` ×1
- **Vorbedingung:** Säuberung der Keller **+** Keller-Patrouille
- **Belohnung:** mind. 50 XP (bzw. 100 % des Stufenbedarfs, Boss) · 1 Wissens-Fragment(e)

**Angebot**

> Meine Tochter ist verschwunden. Aldric sagt, sie sei geflohen. Der Klerus spricht von Besessenheit. Die Garde redet von Pflichtversäumnis.
> 
> Ich glaube keinem der drei, bevor ich nicht ihre eigenen Worte gelesen habe. Bring mir das Tagebuchfragment, das sie zurückgelassen hat. Du findest es im Rathauskeller — irgendwo, wo der Rat nicht hingeschaut hat.
> 
> Vertrau niemandem, bis du es selbst gesehen hast.

**Unterwegs**

> Such weiter — das Fragment ist da unten. Aldric, Klerus und Garde streiten sich oben, weil sie alle eine andere Version hören wollen. Du findest die echte.

**Abschluss**

> Du hast es. Alle drei Ratsfraktionen stehen darin, mit Namen. Lene ist nicht einfach geflohen, Archivschmied. Jemand hat sie verschwinden lassen.
> 
> Du wirst gleich von allen Seiten Aufträge bekommen. Nimm sie an. Hör Dir alles an. Dann komm zurück zu mir.


## Aushang: Die leeren Kammern

`brett_kammern` · **NPC:** anschlagtafel · **Kette:** 1 · **Fortschritt erst ab Tiefe 4**

> Ein Rats-Aushang: räume 6 Kammern ab Tiefe 4.

- **Ziel:** `explore` → `room` ×6
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 70 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 140 Gold (wächst mit der Tiefe ab 4)

**Angebot**

> MAGISTRAT: Sechs Kammern ab Tiefe 4, geräumt und gemeldet. Das Archiv führt Buch über leere Räume.
> 
> (Warum, steht nicht dabei.)

**Unterwegs**

> Sechs Kammern ab Tiefe 4. Das Archiv wartet auf die Meldung.

**Abschluss**

> Ein Schreiber streicht sechs Zeilen an. Er sieht Dich dabei nicht an. Der Lohn liegt im Kasten.


## Aushang: Ruhe in den Kellern

`brett_stoerer` · **NPC:** anschlagtafel · **Kette:** 1 · **Fortschritt erst ab Tiefe 3**

> Ein Rats-Aushang: besiege 12 Gegner ab Tiefe 3.

- **Ziel:** `kill` → `enemy` ×12
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 60 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 120 Gold (wächst mit der Tiefe ab 3)

**Angebot**

> MAGISTRAT: Für Ruhe in den unteren Gängen zahlt der Rat. Zwölf Störer ab Tiefe 3, abzugeben hier am Brett.
> 
> (Darunter, kleiner: "Eine Liste der Namen führt das Archiv.")

**Unterwegs**

> Der Aushang hängt noch. Zwölf Störer ab Tiefe 3.

**Abschluss**

> Du ritzt einen Strich unter den Aushang. Der Lohn liegt im Kasten darunter, abgezählt, ohne ein Wort.


## Keller-Patrouille

`aldric_patrol` · **NPC:** Ratsherr Aldric · **Kette:** 2

> Räume 3 Räume in den Kellern, um alle Gänge zu sichern.

- **Ziel:** `explore` → `room` ×3
- **Vorbedingung:** keine
- **Belohnung:** mind. 40 XP (bzw. 40 % des Stufenbedarfs, Neben) · 1 Druckblätter

**Angebot**

> Stell sicher, dass alle Gänge sicher sind. Patrouilliere drei Räume.
> 
> Bist du bereit?

**Unterwegs**

> Noch nicht alle Gänge gesichert. Weiter patrouillieren.

**Abschluss**

> Alle Gänge sind sicher. Gute Arbeit, Archivschmied.


## Was sich lohnt aufzuheben

`einfuehrung_truhe` · **NPC:** Schmiedemeisterin Branka · **Kette:** 2

> Leg in der Truhe unter der Schmiede einen Gegenstand ab.

- **Ziel:** `system` → `truhe` ×1
- **Vorbedingung:** Der erste Schliff (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · mind. 30 Gold (wächst mit der Tiefe ab 1)

**Angebot**

> Du kommst mit vollen Taschen hoch und wirfst unten die Hälfte weg, weil kein Platz mehr ist. Das ist kein Abwägen, das ist Verschwendung.
> 
> Die Truhe unter der Schmiede gehört Dir. Was Du erst in drei Läufen brauchst, gehört hinein — sie bleibt, auch wenn Du unten liegen bleibst. Leg ein Stück hinein, dann weisst Du, wie es geht.

**Unterwegs**

> Die Truhe ist noch leer. Geh zu ihr, unter der Schmiede, mach sie auf und zieh ein Stück hinüber.

**Abschluss**

> (Sie nickt zur Truhe hin.) So. Jetzt hast Du einen Ort, an dem nichts verloren geht.
> 
> Aber pass auf: Eine Truhe voller Zeug, das Du nie wieder anfasst, ist auch nur ein Haufen. Leg hinein, was Du brauchen wirst — nicht, was Du nicht wegwerfen magst.


## Was die Mauern wissen

`einfuehrung_wissen` · **NPC:** Schmiedemeisterin Branka · **Kette:** 2

> Bind bei Branka in der Archivschmiede ein Erinnerungsfragment in Metall (Wissensbaum).

- **Ziel:** `system` → `wissen` ×1
- **Vorbedingung:** Der erste Schliff **+** Die verschwundene Tochter
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · 1 Wissens-Fragment(e)

**Angebot**

> Stahl allein schneidet die Lügen des Rates nicht. Das sage ich jedem, und jeder nickt und versteht es nicht.
> 
> Du trägst ein Fragment bei Dir. Ein Stück von etwas, das jemand aufgeschrieben und der Rat verbrannt hat. Früher haben die Archivschmiede so etwas hier in Metall gebunden, damit die Stadt es nie verliert. Bind es in Metall, dann kann der Nebel es nicht nehmen. Ich zeig Dir, wie.

**Unterwegs**

> Das Fragment liegt noch bei Dir herum. Komm an den Amboss und bind es in Metall. Es wird nicht mehr wert, wenn Du wartest.

**Abschluss**

> (Sie sieht Dich einen Moment zu lange an.) Und? Nichts blitzt, nichts klingelt. So ist Wissen, wenn es hält.
> 
> Jedes Fragment, das Du unten findest, bindest Du hier. Der Rat sammelt sie auch, nur verbrennt er sie.


## Der Alte mit dem Karren

`einfuehrung_amulett` · **NPC:** Späherin Mara · **Kette:** 2

> Kauf dem wandernden Händler in der Tiefe etwas ab.

- **Ziel:** `system` → `haendler` ×1
- **Vorbedingung:** Was unter dem Tisch liegt
- **Belohnung:** 10 XP (fest, Einführung — wächst nicht mit dem Stufenbedarf) · mind. 45 Gold (wächst mit der Tiefe ab 1)

**Angebot**

> Da unten läuft ein Alter mit einem Karren herum. Frag mich nicht, wie er hineinkommt — ich weiss es nicht, und ich will es nicht wissen.
> 
> Kauf ihm etwas ab. Irgendetwas. Er führt Zeug, das über meinen Tisch nie gehen würde, und tiefer unten hängen Amulette an seinem Karren. Ich will nur, dass Du einmal bei ihm gestanden hast.

**Unterwegs**

> Der Alte taucht auf, wenn er will. Lauf weiter runter, dann triffst Du ihn. Und nimm Gold mit — billig ist er nicht.

**Abschluss**

> (Sie betrachtet es aus sicherem Abstand.) Du hast also bei ihm gekauft.
> 
> Geh wieder hin, wenn Du tiefer kommst. Was er dann führt, ändert einen ganzen Lauf — und was es Dir nimmt, merkst Du meistens später.


## Aushang: Zweimal hinab

`brett_laeufe` · **NPC:** anschlagtafel · **Kette:** 2 · **Angebot ab Tiefe 18** · **Fortschritt erst ab Tiefe 18**

> Ein Rats-Aushang: schliesse 2 Läufe ab Tiefe 18 ab.

- **Ziel:** `dungeon_run` → `dungeon_complete` ×2
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 110 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 220 Gold (wächst mit der Tiefe ab 18)

**Angebot**

> GARDE: Zwei vollständige Gänge ab Tiefe 18. Nicht die Hälfte, nicht fast — ganz durch, beide Male.
> 
> (Darunter jemand mit Kohle: "Sie zahlen für den Weg, nicht für das, was man sieht.")

**Unterwegs**

> Zwei ganze Gänge ab Tiefe 18. Halbe zählen nicht.

**Abschluss**

> Die Garde zahlt ohne Nachfragen. Was Du unten gesehen hast, will niemand wissen.


## Aushang: Die Anführer

`brett_anfuehrer` · **NPC:** anschlagtafel · **Kette:** 2 · **Angebot ab Tiefe 10** · **Fortschritt erst ab Tiefe 10**

> Ein Rats-Aushang: besiege 3 Elite-Gegner ab Tiefe 10.

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 90 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 200 Gold (wächst mit der Tiefe ab 10)

**Angebot**

> GARDE: Drei Anführer, ab Tiefe 10. Wer zahlt, fragt nicht, wer sie waren.
> 
> (Der Aushang ist frisch. Der darunter, halb verdeckt, sucht eine vermisste Näherin.)

**Unterwegs**

> Drei Anführer, ab Tiefe 10. Der Aushang wartet.

**Abschluss**

> Die Garde zahlt bar und sofort. Den Aushang nimmt niemand ab; er hängt am nächsten Morgen wieder da.


## Aushang: Standhalten

`brett_welle` · **NPC:** anschlagtafel · **Kette:** 3 · **Angebot ab Tiefe 14** · **Fortschritt erst ab Tiefe 14**

> Ein Rats-Aushang: räume 6 Räume auf Tiefe 14 oder tiefer in einem Lauf, ohne zu sterben.

- **Ziel:** `explore` → `room_lauf` ×6
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 100 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 180 Gold (wächst mit der Tiefe ab 14)

**Angebot**

> KLERUS: Sechs Kammern in einem Gang, ab Tiefe 14, und kein Sturz. Wer fällt oder umkehrt, beginnt von vorn. Standhaftigkeit ist eine Tugend, und der Rat belohnt Tugend.
> 
> (Das Siegel darunter ist frisch. Die Tinte noch feucht.)

**Unterwegs**

> Sechs Räume in einem Lauf, ab Tiefe 14. Wer stirbt oder umkehrt, beginnt von vorn.

**Abschluss**

> Sechs Kammern, kein Sturz. Der Priester am Kasten segnet Dich, während er abzählt. Beides dauert gleich lang.


## Aufruf der Druckerei

`brett_aufruf` · **NPC:** anschlagtafel · **Kette:** 3 · **Angebot ab Tiefe 16** · **Fortschritt erst ab Tiefe 16**

> Ein Aufruf des Widerstands: räume 5 Kammern ab Tiefe 16.

- **Ziel:** `explore` → `room` ×5
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 120 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 150 Gold (wächst mit der Tiefe ab 16) · 4 Druckblätter

**Angebot**

> Über den zerfetzten Rats-Plakaten klebt ein frisch gedrucktes Blatt:
> 
> "Wer unten aufräumt, macht Platz für die Wahrheit. Fünf Kammern, ab Tiefe 16. Papier gibt es bei Thom."

**Unterwegs**

> Fünf Kammern ab Tiefe 16. Das Blatt hängt noch, jemand hat es festgenagelt.

**Abschluss**

> Am Rand des Blattes steht jetzt ein Strich mehr. Thom legt Papier und Münzen unter den Stein daneben.


## Aufruf: Nehmt ihnen die Anführer

`brett_zeugen` · **NPC:** anschlagtafel · **Kette:** 4 · **Angebot ab Tiefe 22** · **Fortschritt erst ab Tiefe 22**

> Ein Aufruf des Widerstands: besiege 4 Elite-Gegner ab Tiefe 22.

- **Ziel:** `kill` → `elite_enemy` ×4
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 130 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 160 Gold (wächst mit der Tiefe ab 22)

**Angebot**

> Aus Thoms Presse, quer über ein zerfetztes Rats-Plakat geklebt:
> 
> "Vier von denen, die unten befehlen. Ab Tiefe 22. Wer befiehlt, hat einen Namen — und wir drucken Namen."

**Unterwegs**

> Vier Anführer ab Tiefe 22. Die Presse wartet auf die Namen.

**Abschluss**

> Am nächsten Morgen stehen vier Namen im Blatt. Zwei davon kennt die Stadt.


# Akt-Index 1 — Akt 1 · Treuer Diener

## Das versiegelte Bündel

`resistance_fetch_01` · **NPC:** Elara · **Kette:** 0

> Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen, und öffne es nicht.

- **Ziel:** `fetch` → `sealed_bundle` ×1
- **Vorbedingung:** Die verschwundene Tochter (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 25 XP (bzw. 40 % des Stufenbedarfs, Neben) · 3 MAT

**Angebot**

> Du stehst noch. Gut. Dann kannst Du mir gleich einen Gefallen tun.
> 
> Irgendwo hier unten liegt ein Bündel, versiegelt. Bring es mir, ohne dass jemand es sieht. Und öffne es nicht. Danach reden wir über den Rat.

**Unterwegs**

> Das Bündel liegt irgendwo da unten. Sieh Dich um, und lass es zu.

**Abschluss**

> Du hast es. Und Du hast es nicht geöffnet. Gut. Jetzt weiss ich, dass ich Dir trauen kann.
> 
> (Auf dem Wachs des Siegels: drei Ketten, ineinander verschlungen. Du hast dieses Zeichen noch nie gesehen.)


## Verifikation des Magistrats

`magistrat_verification` · **NPC:** Ratsherr Aldric · **Kette:** 2

> Beschaffe das ratsgesiegelte Verifikationsdokument für den Magistrat.

- **Ziel:** `fetch` → `verification_seal` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** mind. 75 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Du hast das Fragment gesehen. Gut. Dann weisst du auch, dass die Tochter neu klassifiziert werden muss — von "geflohen" zu "vermisste Person von Interesse". Eine reine Verwaltungsangelegenheit, verstehst du. Akten müssen ordnungsgemäss geführt werden.
> 
> Das ratsgesiegelte Verifikationsdokument liegt in der versunkenen Registratur — dort unten, wo der Nebel die alten Akten verschluckt hat. Steig hinab, birg das Ratssiegel und bring es mir. Was dir dabei begegnet, ist nicht mein Ressort. Der Magistrat trägt die Verantwortung, nicht der Bürger.
> 
> Nimmst du den Auftrag an?

**Unterwegs**

> Das Ratssiegel liegt noch da unten in der versunkenen Registratur. Steig weiter hinab und birg es. Ohne das Dokument ist die Neuklassifizierung nicht rechtskräftig.

**Abschluss**

> (Aldric streckt die Hand aus, ohne von seinen Akten aufzusehen.) Das Siegel, Archivschmied. Die Neuklassifizierung wartet.
> 
> (Das Wachs in Deiner Hand ist noch weich. Ein Druck mit dem Daumen, und es hält nicht mehr. Niemand würde es merken, ausser jemand, der Siegel macht.)

**Entscheidung beim Abgeben**

- _Das Siegel abliefern_ (`verification_sealed`): ALDRIC: Das Dokument ist im Archiv. Die Tochter ist nun offiziell eine Person von Interesse. Was das in der Praxis bedeutet, geht Dich nichts an. Der Magistrat dankt Dir.
- _Es unbemerkt beschädigen_ (`verification_refused`): (Du drückst den Daumen ins weiche Wachs, bevor Du es übergibst. Aldric siegelt, ohne hinzusehen.) ALDRIC: Gut. Der Magistrat dankt Dir. (Das Siegel wird nicht halten. Wer genau hinsieht, merkt es. Branka sieht immer genau hin.)


## Reinigung der unteren Kammern

`klerus_purification` · **NPC:** Klerus-Priester · **Kette:** 2 · **Fortschritt erst ab Tiefe 3**

> Reinige die unteren Kammern des Rathauskellers — besiege 3 Elite-Gegner. Die Ketzer-Anführer lauern erst ab Tiefe 3.

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** mind. 90 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Du hast das Fragment gesehen, Archivschmied. Dann weisst Du, dass die Tochter nicht aus eigenem Willen geflohen ist. Sie wurde von einer dunklen Hand geführt, die unteren Kammern bersten vor solchen Schatten.
> 
> Reinige sie. Drei der Anführer dieser ketzerischen Präsenz lauern noch dort unten, tiefer als die ersten Gänge. Steige bis Tiefe 3 hinab. Fälle sie im Namen der Ordnung. Die Seele der Tochter wird es Dir danken, wenn das Licht sie wiederfindet.
> 
> Die Reinigung ist eine geistliche Pflicht. Nimm sie an.

**Unterwegs**

> Die Anführer lauern tief — erst ab Tiefe 3. Steige hinab, finde sie, fälle sie. Jede Ketzerei, die du beendest, öffnet einen weiteren Pfad zur Reinheit.

**Abschluss**

> Du hast die Ketzerei geschlagen. Die unteren Kammern atmen wieder. Die Ordnung bleibt, durch Dich. Der Klerus segnet Deine Hand. Bring sie weiter dorthin, wo das Licht es verlangt.


## Patrouillen-Erweiterung

`garde_patrol_expansion` · **NPC:** Stadtwache · **Kette:** 2

> Demonstriere Kraft für die nächsten Patrouillen — besiege 10 Störer.

- **Ziel:** `kill` → `enemy` ×10
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** mind. 75 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Wenn eine Tochter aus dem Rathaus verschwinden kann, ist das ein Versagen der Garde — und das wird sich ändern. Ich brauche eine Patrouillen-Erweiterung. Heute. Geh in die unteren Kammern und demonstriere Kraft — zehn Störer fallen, das Edikt trägt sich von selbst durch die Strassen.
> 
> Frag nicht, ob die Patrouillen schoner Lebensweise zuträglich sind. Frag nicht, wer entscheidet, wohin sie laufen. Loyalität ist die einzige Münze, die zählt. Das Edikt ist die Münze, die du in meine Hand legst.
> 
> Nimmst du den Auftrag an, Archivschmied?

**Unterwegs**

> Zehn Störer noch. Jeder gefallene Körper ist eine Zeile mehr im Bericht. Die Garde wartet auf das Ergebnis.

**Abschluss**

> Der Bericht ist geschrieben. Zehn Störer weniger, und die Garde kann dem Rat mehr Patrouillen vorschlagen. Niemand wird mehr verschwinden — oder zumindest niemand, der zählt. Die Garde merkt sich, wer schnell antwortet.


## Das Ratsdokument

`widerstand_proof` · **NPC:** Elara · **Kette:** 2

> Finde ein verstecktes Ratsdokument im Rathauskeller, ein paar Räume tiefer.

- **Ziel:** `fetch` → `council_document` ×1
- **Vorbedingung:** Die verschwundene Tochter **+** Das versiegelte Bündel
- **Belohnung:** mind. 100 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Du hast mir das Bündel gebracht und es nicht geöffnet. Gut. Dann kann ich Dir zeigen, was ich gesehen habe, bevor Du weiter ihre Aufträge erledigst.
> 
> Ich will, dass DU siehst, was ich gesehen habe, bevor du weiter ihre Aufträge erledigst. Unten im Rathauskeller liegt ein Dokument, das die drei Ratsfraktionen nie zusammen unterzeichnet haben sollten — und doch ist ihr Siegel darauf. Alle drei.
> 
> Bring es mir. Dann reden wir.

**Unterwegs**

> Das Dokument liegt ein paar Räume tiefer. Es ist klein, aber das Siegel darauf wird dir den Atem nehmen.

**Abschluss**

> Drei Siegel. Eine Unterschrift. Magistrat, Klerus, Garde — sie behaupten in der Öffentlichkeit, sie wären Rivalen. Hinter verschlossenen Türen stimmen sie überein. Geh zu Harren. Er wartet auf den Moment, in dem du das verstehst.


## Die geheime Sitzung

`council_collusion_reveal` · **NPC:** Bürgermeister Harren · **Kette:** 3

> Sieh Dir die öffentliche Ratssitzung an. Dann belausche die geheime Sitzung in der Ratskammer unter dem Rathaus.

- **Ziel:** `observe` → `oeffentliche_sitzung` ×1; `observe` → `collusion_reveal_seen` ×1
- **Vorbedingung:** Verifikation des Magistrats **+** Reinigung der unteren Kammern **+** Patrouillen-Erweiterung **+** Das Ratsdokument **+** Das Edikt der Woche
- **Belohnung:** mind. 150 XP (bzw. 100 % des Stufenbedarfs, Boss) · 1 Wissens-Fragment(e)

**Angebot**

> Heute verkündet der Rat das Ergebnis der Abstimmung, öffentlich, im Ratssaal. Magistrat, Klerus, Garde, vor allen Bürgern. Geh hin und hör zu. Und dann folge ihnen in der Nacht, wenn sie glauben, dass keiner zusieht.

**Unterwegs**

> Die Ratskammer liegt unten im Keller. Zieh die Uniform der Wache an, bleib im Schatten und hör zu, was sie sagen, wenn keiner zusieht.

**Abschluss**

> Jetzt hast Du es gesehen. Ein Gesicht, drei Masken. Du hast für jede gearbeitet. Du könntest fliehen, aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, die ein Flüchtiger nie sieht. Bleib, wo Du bist. Räum weiter für sie, und heimlich für mich. Es ist gefährlicher. Es ist auch das Einzige, was nützt.


## Das Edikt der Woche

`faction_campaign` · **NPC:** Ratsherr Aldric · **Kette:** 3

> Die Stadt stimmt ab: drei Edikte, eines gewinnt. Lass sie bei Thom drucken und häng sie an die Anschlagtafeln vor dem Rathaus.

- **Ziel:** `observe` → `edikte_gedruckt` ×1; `observe` → `edikte_plakatiert` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** mind. 60 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Diese Woche stimmt die Stadt ab. Drei Edikte, Magistrat, Klerus, Garde, und die Bürger wählen eines. Lass sie bei Thom drucken und häng sie an die Tafeln vor dem Rathaus. So sieht Ordnung aus, die gewählt ist.

**Unterwegs**

> Erst drucken, dann aushängen. Die Druckerei ist gleich über dem Platz.

**Abschluss**

> Gut. Die Stimmen werden gezählt, und das Ergebnis verkündet der Rat öffentlich, im Ratssaal. So gehört sich das.


# Akt-Index 2 — Akt 2 · Das Doppelspiel

## Die Späherin

`mara_contact` · **NPC:** Späherin Mara · **Kette:** 1

> Kundschafte für Mara drei Kellerräume des Rats aus.

- **Ziel:** `explore` → `room` ×3
- **Vorbedingung:** keine
- **Belohnung:** mind. 60 XP (bzw. 70 % des Stufenbedarfs, Story) · Info: Maras Netzwerk enthüllt

**Angebot**

> Du hast an meinem Tisch gekauft und nie gefragt, warum ich weiss, wie Du bezahlst. (Sie schiebt die Ware beiseite.) Ich kenne Dich von früher, Archivschmied. Von bevor Du Dein Gedächtnis verloren hast. Du hast damals Fragen gestellt, die der Rat begraben wollte.
> 
> Bevor ich Dir mein Netz öffne, will ich sehen, ob Du noch sehen kannst. Geh hinab und kundschafte drei Kellerräume aus. Präg Dir ein, was der Rat dort versteckt.

**Unterwegs**

> Noch nicht genug gesehen. Drei Räume — und präg dir jeden ein.

**Abschluss**

> Drei Räume, in jedem dasselbe: leere Zellen, frische Ketten, Listen mit Namen. Die Vermissten verschwinden nicht zufällig — der Rat lässt sie verschwinden, und jede Fraktion deckt die andere.
> 
> Jetzt weiss ich, dass du noch der Alte bist. Mein Netzwerk steht dir offen — es gibt Arbeit, die nur jemand erledigen kann, an den sich niemand erinnert. Wie dich.


## Elaras Geheimnis

`elara_meeting` · **NPC:** Elara · **Kette:** 1

> Finde 2 geheime Dokumente, die Elara versteckt hat.

- **Ziel:** `fetch` → `document` ×2
- **Vorbedingung:** keine
- **Belohnung:** mind. 100 XP (bzw. 70 % des Stufenbedarfs, Story) · schaltet frei: elara_trust

**Angebot**

> Du willst wissen, wofür wir das tun? Hier — lies das.
> 
> Finde zwei Dokumente, die ich im Keller versteckt habe.

**Unterwegs**

> Die Dokumente sind gut versteckt. Suche weiter.

**Abschluss**

> Jetzt siehst du es. Das tut der Rat mit denen, die verschwinden: Er braucht sie für seine Rituale. Namen, die niemand mehr ausspricht, weil sich niemand an sie erinnert.


## Beschlagnahme

`council_seizure` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Beschlagnahme die "subversiven Schriften" — sammle 3 Bündel aus den Kellern.

- **Ziel:** `fetch` → `seized_writings` ×3
- **Vorbedingung:** keine
- **Belohnung:** mind. 60 XP (bzw. 70 % des Stufenbedarfs, Story) · 2 Druckblätter

**Angebot**

> Im Keller hortet Gesindel subversive Schriften gegen den Rat. Beschlagnahme sie — drei Bündel. Lies sie nicht. Bring sie.
> 
> Nimmst du den Auftrag an?

**Unterwegs**

> Noch nicht alle Schriften sichergestellt. Such weiter.

**Abschluss**

> Gib her.
> 
> (Bevor du sie abgibst, fällt dein Blick auf eine Zeile. Es sind keine Pamphlete. Es sind Gesuche — Bürger, die nach verschwundenen Angehörigen fragen.)

**Entscheidung beim Abgeben**

- _Abgeben_ (`petitions_surrendered`): Du gibst sie ab.
- _Heimlich behalten_ (`petitions_kept`): Du steckst sie ein. Mara wird wissen wollen, wer da fragt.


## Zweifel der Schmiedin

`branka_doubt` · **NPC:** Schmiedemeisterin Branka · **Kette:** 2

> Besiege 5 Elite-Gegner, um Beweise für Brankas Verdacht zu finden.

- **Ziel:** `kill` → `elite_enemy` ×5
- **Vorbedingung:** keine
- **Belohnung:** mind. 80 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Diese Rüstungen sind für Gefangene, nicht Soldaten. Hilf mir, Beweise zu finden.
> 
> Besiege fünf Elite-Wachen und bring mir ihre Befehle.

**Unterwegs**

> Die Elite-Wachen tragen die Beweise bei sich. Kämpfe weiter.

**Abschluss**

> Ich hatte recht. Der Rat baut Gefängnisse, keine Kasernen. Wir müssen handeln.


## Überwachung

`council_surveillance` · **NPC:** Ratsherr Aldric · **Kette:** 2

> Überwache die Kellergänge unter dem Rathaus für den Rat — durchsuche 3 Kammern.

- **Ziel:** `explore` → `room` ×3
- **Vorbedingung:** Beschlagnahme
- **Belohnung:** mind. 70 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Druckblätter

**Angebot**

> Unten in den alten Gängen soll sich Gesindel zusammenrotten, heisst es. Durchkämm drei Kammern und melde, wer sich dort versammelt.
> 
> Bereit?

**Unterwegs**

> Noch nicht alle Kammern durchsucht. Sieh weiter nach.

**Abschluss**

> Bericht angenommen.
> 
> (Keine Verschwörer. Nur Menschen, die sich im Dunkeln verstecken — vor dem Rat, nicht gegen ihn.)


## Der Kettenmeister

`mara_warning` · **NPC:** Späherin Mara · **Kette:** 2

> Besiege den Kettenmeister auf Tiefe 10, der den Weg zu den Siegelkammern des Rats bewacht.

- **Ziel:** `boss_kill` → `kettenmeister` ×1
- **Vorbedingung:** Die Späherin **+** Der Konvoi
- **Belohnung:** mind. 200 XP (bzw. 100 % des Stufenbedarfs, Boss) · **Ausrüstungsstück** (selten, auf Spielerstufe gewürfelt)

**Angebot**

> Auf Tiefe 10 hält der Kettenmeister den Weg. Früher war er Hauptmann der Garde, heute ist nur noch sein Befehl übrig. Er fesselt, wen er fangen will. Fäll ihn, dann sehen wir, was er bewacht.

**Unterwegs**

> Der Kettenmeister lebt noch, auf Tiefe 10. Wenn er Dich kettet, schlag die Kette, sonst hält er Dich.

**Abschluss**

> Der Kettenmeister ist gefallen. Hinter ihm lagen Kammern voller Siegel. Der Rat versiegelt dort unten mehr als Akten, und jetzt haben wir den ersten Beweis dafür.


## Verbotene Abschriften

`branka_transcripts` · **NPC:** Schmiedemeisterin Branka · **Kette:** 3

> Bring Branka 2 Verhörprotokolle aus den Kellern.

- **Ziel:** `fetch` → `interrogation_record` ×2
- **Vorbedingung:** Die Späherin
- **Belohnung:** mind. 80 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Im Keller lagern Protokolle aus Verhören. Nicht von Dämonen — von Menschen. Bring mir zwei Abschriften. Vorsichtig.

**Unterwegs**

> Die Protokolle sind tief im Keller. Such weiter.

**Abschluss**

> Lies das. "Befragt bis zum Geständnis." Der Rat verhört Bürger wie Beschworene. Das ist kein Schutz — das ist Jagd.


## Reinigung eines Bezirks

`klerus_district_purge` · **NPC:** Klerus-Priester · **Kette:** 3 · **Angebot ab Tiefe 7** · **Fortschritt erst ab Tiefe 7**

> Reinige einen "befallenen" Bezirk — besiege 8 Gegner ab Tiefe 7 und bring die Namen.

- **Ziel:** `kill` → `enemy` ×8
- **Vorbedingung:** keine
- **Belohnung:** mind. 70 XP (bzw. 40 % des Stufenbedarfs, Neben)

**Angebot**

> Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.

**Unterwegs**

> Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe, ab Tiefe 7.

**Abschluss**

> Du bringst die Namen? (Der Priester streckt die Hand nach der Liste aus.)
> 
> (Die Befallenen hatten Gesichter. Keins davon kanntest Du, und doch kam Dir jedes bekannt vor. Mara hat Dir eine Abschrift abgenommen, bevor Du hergekommen bist. Noch hast Du die Liste in der Hand.)

**Entscheidung beim Abgeben**

- _Die Liste abliefern_ (`namen_abgeliefert`): PRIESTER: Das Licht dankt Dir. (Er faltet die Liste, ohne sie zu lesen. Morgen früh steht die Kettenwache vor jeder Tür, deren Name darauf steht.)
- _Erst die Leute warnen_ (`namen_gewarnt`): (Du gibst Mara ein Zeichen und lässt Dir Zeit auf dem Weg zum Rathaus. In der Nacht leeren sich die Häuser auf der Liste.) PRIESTER: Leer? Alle? (Er sieht Dich lange an.) Der Befall wandert. Das Licht wird ihn finden.


## Der Konvoi

`espionage_convoy` · **NPC:** Späherin Mara · **Kette:** 6

> Beschatte verkleidet einen Konvoi des Rats im Lagerhaus und höre ihn ab.

- **Ziel:** `observe` → `convoy_intel` ×1
- **Vorbedingung:** Die Späherin
- **Belohnung:** mind. 90 XP (bzw. 70 % des Stufenbedarfs, Story) · 2 Druckblätter

**Angebot**

> Heute Nacht entladen sie im alten Lagerhaus einen Konvoi des Rats. Zieh die Wachuniform an, bleib im Schatten und hör zu — aber zieh keine Klinge, sonst fliegt die Verkleidung auf.
> 
> Uebernimmst du das?

**Unterwegs**

> Du bist noch nicht nah genug. Misch dich unter die Wachen am Konvoi und hör ab, was verladen wird — unentdeckt.

**Abschluss**

> Du hast es gehört. Keine Vorräte, keine Waffen. Kisten voller Phiolen, jede mit dem Wachs des Rats versiegelt. Was darin ist, sagt keiner, auch nicht, wenn sie unter sich sind. Nur wohin sie gehen: hinab, mit dem nächsten Transport.


# Akt-Index 3 — Akt 3 · Die Enttarnung

## Verbotene Wahrheiten

`thom_truth` · **NPC:** Setzer Thom · **Kette:** 1 · **Fortschritt erst ab Tiefe 14**

> Finde 5 Druckplatten mit den verbotenen Wahrheiten über den Rat (ab Tiefe 14).

- **Ziel:** `fetch` → `print_plate` ×5
- **Vorbedingung:** keine
- **Belohnung:** mind. 100 XP (bzw. 70 % des Stufenbedarfs, Story) · 20 MAT

**Angebot**

> Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.
> 
> Finde fünf Druckplatten, tief im Keller, ab Tiefe 14 — sie enthalten die echte Geschichte.

**Unterwegs**

> Die Druckplatten liegen tief im Rathauskeller, ab Tiefe 14. Suche weiter.

**Abschluss**

> Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.

**Entscheidung beim Abgeben**

- _Ich stehe dahinter. Auch wenn es etwas kostet._ (`thom_ally`): THOM: Dann sind wir zwei. Den Preis zahlen wir zusammen. Das reicht, um anzufangen.


## Ein Hund namens Bruno

`buerger_hund` · **NPC:** buerger · **Kette:** 1 · **Fortschritt erst ab Tiefe 15**

> Finde Brunos Halsband in den Kanälen unter der Stadt (ab Tiefe 15).

- **Ziel:** `fetch` → `hundehalsband` ×1
- **Vorbedingung:** keine
- **Belohnung:** mind. 80 XP (bzw. 40 % des Stufenbedarfs, Neben) · mind. 40 Gold (wächst mit der Tiefe ab 15)

**Angebot**

> Du gehst doch da runter. Mein Hund, Bruno, ist mir vor einer Woche in die Kanäle gelaufen. Er jagt Ratten, er kann nicht anders. Wenn Du tief unten, ab Tiefe 15, ein Halsband mit einer Messingmarke findest, dann bring es mir. Dann weiss ich wenigstens Bescheid.

**Unterwegs**

> Ein braunes Halsband, Messingmarke, "Bruno" eingeritzt. Tief unten, ab Tiefe 15.

**Abschluss**

> Das ist seins. (Er dreht die Marke in der Hand.) Und weisst Du was? Bruno kam gestern Nacht allein nach Hause, dreckig bis zu den Ohren und sehr zufrieden. Ohne Halsband. Er hat es sich abgestreift, um durch ein Gitter zu passen. (Er lacht, zum ersten Mal, seit Du ihn kennst.)


## Die Ritualkammer

`elara_ritual` · **NPC:** Elara · **Kette:** 2

> Steige auf Tiefe 20 hinab und besiege den Zeremonienmeister, der die Ritualkammer des Rats hält.

- **Ziel:** `boss_kill` → `zeremonienmeister` ×1
- **Vorbedingung:** Elaras Geheimnis
- **Belohnung:** mind. 150 XP (bzw. 100 % des Stufenbedarfs, Boss) · **Nebelamulett des Rats** (selten, auf Spielerstufe gewürfelt)

**Angebot**

> Unter der Ritualkammer des Rats liegt ein Schacht. Er führt hinab zu dem, was den Nebel macht. Der Zeremonienmeister hält die Kammer davor. Steig auf Tiefe 20 hinab und fälle ihn. Dann zeige ich Dir, wohin der Schacht führt.
> 
> Bist Du bereit für die Wahrheit?

**Unterwegs**

> Der Zeremonienmeister hält die Kammer noch. Du findest ihn auf Tiefe 20. Solange er lebt, kommst Du nicht an den Schacht.

**Abschluss**

> Der Zeremonienmeister ist gefallen. (Hinter ihm der Schacht. Tief unten ein Glühen, rot wie eine Esse, und daraus steigt der Rauch auf, grau und dicht.)
> 
> Das ist sie. Die Esse. Sie verbrennt, was in den Phiolen ist: Erinnerungen. Ihr Rauch ist der Nebel.
> 
> Zerschlagen kann man sie nicht. Man muss ihre Bindung lösen, so wie Du ein Siegel löst. Ein Schlag an der richtigen Stelle, in der richtigen Richtung. Deine Hände wissen, wie das geht. Ich zeige Dir die Stelle, wenn es so weit ist.
> 
> Nimm dieses Amulett. Es schützt vor dem Nebel, wenn Du tiefer gehst.


## Elaras Geschenk

`elara_blade` · **NPC:** Elara · **Kette:** 3 · **Angebot ab Tiefe 20**

> Elara hat eine besondere Klinge für Dich schmieden lassen.

- **Ziel:** `dialogue` → `elara_gift` ×1
- **Vorbedingung:** Die Ritualkammer
- **Belohnung:** mind. 100 XP (bzw. 70 % des Stufenbedarfs, Story) · **Elaras Klinge** (legendär, auf Spielerstufe gewürfelt)

**Angebot**

> Nimm das. Ich habe sie für Dich schmieden lassen. Für den Fall, dass...
> 
> Nimmst Du Elaras Klinge an?

**Unterwegs**

> Die Klinge wartet auf Dich.

**Abschluss**

> Möge sie Dich beschützen. Egal was kommt.


## Nachteskorte

`garde_night_escort` · **NPC:** Stadtwache · **Kette:** 3 · **Fortschritt erst ab Tiefe 16**

> Sichere verdeckt einen nächtlichen Transport — beobachte die Eskorten-Route (ab Tiefe 16).

- **Ziel:** `observe` → `escort_route` ×1
- **Vorbedingung:** keine
- **Belohnung:** mind. 90 XP (bzw. 40 % des Stufenbedarfs, Neben)

**Angebot**

> Heute Nacht geht ein Transport. Die Route führt tief hinab, ab Tiefe 16. Sicher sie, frag nicht, was drin ist. Loyalität zahlt sich aus.

**Unterwegs**

> Der Transport rollt erst ab Tiefe 16. Halt die Route im Auge, bleib unauffällig.

**Abschluss**

> Die Route ist sicher. (Und in deinem Kopf, Weg, Zeit und Fracht, bereit für Mara. Es waren keine Waffen. Es waren dieselben Phiolen wie im Konvoi.)


## Die verseuchte Kammer

`verseuchte_kammer` · **NPC:** Ratsherr Aldric · **Kette:** 4 · **Angebot ab Tiefe 15** · **Fortschritt erst ab Tiefe 15**

> Aldric schickt dich, eine "verseuchte" Kammer zu reinigen. Dring bis zu ihr vor, sie liegt ab Tiefe 15.

- **Ziel:** `explore` → `room` ×2
- **Vorbedingung:** Überwachung
- **Belohnung:** mind. 120 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Eine untere Kammer ist verseucht — Ketzerei, ab Tiefe 15. Reinige sie. Frag nicht, was du findest.
> 
> Geh.

**Unterwegs**

> Die Kammer liegt tiefer, ab Tiefe 15. Dring weiter vor.

**Abschluss**

> Du stehst in der Kammer. Kein Ketzer weit und breit. Auf dem Boden ein Kreidekreis, an seinem Rand Ketten, in den Stein geschlagen. Daneben Kisten voller leerer Phiolen, sauber aufgereiht, jede mit einem Etikett, auf dem noch kein Name steht.
> 
> (Hier werden Menschen abgefüllt. Aldric hat Dich geschickt, um die Spuren zu verwischen. Du prägst Dir alles ein. Mara soll es wissen, und Aldric soll glauben, Du hättest nur geputzt.)


## Wer du warst

`who_you_were` · **NPC:** Schmiedemeisterin Branka · **Kette:** 4 · **Fortschritt erst ab Tiefe 17**

> Bring Branka drei Splitter Deiner Phiole aus der Tiefe (ab Tiefe 17).

- **Ziel:** `fetch` → `memory_shard` ×3
- **Vorbedingung:** Zweifel der Schmiedin
- **Belohnung:** mind. 150 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Unten haben Leute Scherben gefunden. Dickes Glas, und in jede ist ein Zeichen geritzt. Deins. (Sie sieht Dich lange an.) Das war eine Phiole, Archivschmied. Was in ihr war, warst Du.
> 
> Bring mir drei Splitter aus der Tiefe. Was noch an ihnen haftet, binden wir hier an Metall. Dann kann der Nebel es Dir nicht wieder nehmen.

**Unterwegs**

> Die Splitter liegen tief, ab Tiefe 17. Such weiter.

**Abschluss**

> Da bist Du. (Die Splitter liegen auf dem Amboss, und mit jedem Schlag kommt etwas zurück: eine Werkstatt, Siegel, Druckplatten für den Rat. Und ein Nein.)
> 
> Du hast für sie geschmiedet. Das Zeichen der drei Ketten ist von Dir. Ich habe Dich daran arbeiten sehen. Dann hast Du verstanden, wofür, und Dich geweigert. Es war kein Unfall. Sie haben Dich geleert, weil sie Dich brauchten, nicht weil Du ihnen gefährlich warst.
> 
> (Sie legt den Hammer weg.) Hör mir zu. Was wir hier gebunden haben, bleibt Dir. Aber Du bist nicht mehr leer, und der Nebel dort unten merkt das. Je mehr Du weisst, wer Du bist, desto mehr hat er Dir zu nehmen.

**Entscheidung beim Abgeben**

- _Dann weiss ich, wo ich stehe._ (`branka_ally`): BRANKA: Jemand, der nicht aufhören konnte zu fragen. Wie jetzt. Wir stehen zusammen, wenn es so weit ist.


## Elaras zweite Wahrheit

`elara_second_truth` · **NPC:** Elara · **Kette:** 4 · **Angebot ab Tiefe 20**

> Elara zeigt dir, für wen du das Letzte tust.

- **Ziel:** `observe` → `erster_riss_gesehen` ×1
- **Vorbedingung:** Verbotene Wahrheiten **+** Die Ritualkammer
- **Belohnung:** mind. 200 XP (bzw. 70 % des Stufenbedarfs, Story) · 2 Wissens-Fragment(e)

**Angebot**

> Bevor du das Letzte tust, sollst du wissen, für wen. Komm, nur wir zwei.

**Unterwegs**

> Elara wartet auf dich. Nur ihr zwei.

**Abschluss**

> Sie hat die Meldung weggesteckt. Eine wahre Meldung, und niemand wird sie je lesen. "Nicht alles hilft", hat sie gesagt. Du schiebst den Gedanken beiseite. Noch.


## Der Bruch

`bruch_confrontation` · **NPC:** Schmiedemeisterin Branka · **Kette:** 5 · **Angebot ab Tiefe 20** · **Fortschritt erst ab Tiefe 20**

> Aldric hat Wachen auf Dich gehetzt. Schlag Dich durch, besiege 3 Elite-Wachen. Sie stellen Dich erst in der Tiefe (ab Tiefe 20). Branka weiss ein Versteck.

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** Die verseuchte Kammer **+** Elaras zweite Wahrheit
- **Belohnung:** mind. 200 XP (bzw. 100 % des Stufenbedarfs, Boss)

**Angebot**

> Aldric weiss es. Dein Doppelspiel ist aufgeflogen, seine Elite-Wachen riegeln die tiefen Gänge ab, ab Tiefe 20 stellst Du sie. Schlag Dich durch und komm zu mir. Ich kenne einen Ort, an dem Dich keiner sucht.

**Unterwegs**

> Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 20 stellst Du sie.

**Abschluss**

> Du stellst zu viele Fragen, hat er gesagt. Jetzt fragst Du nicht mehr, Du weisst es. Die Tarnung ist verbrannt, oben ist kein Ort mehr für Dich.
> 
> (Branka zieht Dir eine Kapuze über und führt Dich durch die Kanäle, bis zu einem Spalt in der Kellerwand.) Elara wartet dort unten. Bei ihr findet Dich keiner. Geh. Ich halte die Schmiede offen.


## Das versiegelte Archiv

`espionage_archive` · **NPC:** Bürgermeister Harren · **Kette:** 7 · **Fortschritt erst ab Tiefe 12**

> Infiltriere verkleidet das Archiv des Rats (ab Tiefe 12), höre die Schreiber ab und birg den versiegelten Akt.

- **Ziel:** `observe` → `archive_record` ×1
- **Vorbedingung:** keine (dazu eine Bedingung im Code, `gate`)
- **Belohnung:** mind. 110 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Sie war hier. Lene. Sie sagt, sie sei geflohen, aus eigenem Willen, und dass sie nicht bleiben kann. (Er dreht den Amtsring an seinem Finger.) Ich will ihr glauben, Archivschmied. Aber ich will es lesen.
> 
> Im Archiv des Rats liegt ihre Akte, versiegelt, tief unter dem Rathaus, ab Tiefe 12. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und bring mir die Akte. Werde nicht gesehen.
> 
> Tust Du das für mich?

**Unterwegs**

> Das Archiv liegt ab Tiefe 12. Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.

**Abschluss**

> Du hast den Akt. "Vermisst, Fall geschlossen" — das Verschwinden seiner Tochter, sauber abgelegt, Datum, Siegel, Unterschrift. Und das Datum liegt vor dem Tag, an dem sie verschwand.
> 
> (Harren liest es zweimal.) Sie haben es geplant. Jemand im Rat hat Lenes Verschwinden abgeheftet, bevor es geschah.


## Der Maulwurf

`espionage_informant` · **NPC:** Späherin Mara · **Kette:** 8 · **Fortschritt erst ab Tiefe 23**

> Enttarne verkleidet einen Maulwurf des Rats in den Reihen des Widerstands (ab Tiefe 23).

- **Ziel:** `observe` → `informant_id` ×1
- **Vorbedingung:** Das versiegelte Archiv **+** Der Bruch
- **Belohnung:** mind. 120 XP (bzw. 70 % des Stufenbedarfs, Story) · 1 Wissens-Fragment(e)

**Angebot**

> Jemand verrät uns. Was wir hinter verschlossenen Türen beschliessen, weiss der Rat am nächsten Morgen. Misch dich verkleidet unter unsere eigenen Leute am Treffpunkt, tief unten, ab Tiefe 23, und finde heraus, wer der Maulwurf ist. Beweg dich leise — sie kennen dein Gesicht nicht in dieser Montur.
> 
> Findest du den Verräter?

**Unterwegs**

> Noch hast du den Maulwurf nicht. Bleib unauffällig am Treffpunkt (ab Tiefe 23) und hör ab, wer Nachrichten nach draussen schmuggelt.

**Abschluss**

> Du bist dem Zettel gefolgt, bis in die Ratskammer. Elara, neben Aldric. An ihrem Ring das Zeichen der drei Ketten. Sie hat uns alle geführt — direkt in seine Hände.


# Akt-Index 4 — Akt 4 · Die Quelle

## Was der Rauch behält

`was_der_rauch_behaelt` · **NPC:** Späherin Mara · **Kette:** 1 · **Fortschritt erst ab Tiefe 25**

> Steig auf Tiefe 25 hinab und stell Dich dem Nachhall, dem Echo aus tausend Stimmen. Bring Maras Leute nach Hause.

- **Ziel:** `boss_kill` → `nachhall` ×1
- **Vorbedingung:** Der Maulwurf
- **Belohnung:** mind. 220 XP (bzw. 100 % des Stufenbedarfs, Boss)

**Angebot**

> Die Leute, die sie mir genommen haben, sind nicht tot. Nicht ganz. Wer tief genug hinabsteigt, hört sie, auf Tiefe 25, alle durcheinander. Die Späher nennen es den Nachhall. Er steht zwischen Dir und der Esse. Geh hin, hör nicht zu lange zu und bring sie nach Hause.

**Unterwegs**

> Der Nachhall wartet auf Tiefe 25. Wenn er flüstert, hör nicht hin. Schlag zu.

**Abschluss**

> Du hast sie gehen lassen. (Sie schweigt lange.) Hast Du einen Namen gehört, den Du kennst? (Eine der Stimmen war Deine eigene. Du sagst es ihr nicht.) Gib Thom die Namen, die Du lesen konntest. Dann geh. Die Esse wartet, und Elara mit ihr.


## Die Pamphlete

`thom_pamphlets` · **NPC:** Setzer Thom · **Kette:** 2 · **Angebot ab Tiefe 27** · **Fortschritt erst ab Tiefe 27**

> Schliesse 3 tiefe Läufe in die Keller ab (ab Tiefe 27), um Flugblätter bis in die untersten Gänge zu verteilen.

- **Ziel:** `dungeon_run` → `dungeon_complete` ×3
- **Vorbedingung:** Verbotene Wahrheiten
- **Belohnung:** mind. 200 XP (bzw. 70 % des Stufenbedarfs, Story) · schaltet frei: xp_bonus_10

**Angebot**

> Die oberen Gänge lesen unsere Wahrheit schon. Jetzt brauchen wir die Tiefe, dort, wo der Rat seine Geheimnisse hält.
> 
> Schliess drei Durchläufe ab Tiefe 27 ab und nimm die Blätter mit hinunter. Wer dort unten liest, liest dort, wo der Rat es nicht erwartet.

**Unterwegs**

> Nur tiefe Durchläufe zählen, ab Tiefe 27. Schliess drei davon ab. Jeder trägt unsere Blätter weiter hinunter.

**Abschluss**

> Die unteren Gänge lesen mit. Die Blätter wandern von Hand zu Hand, bis hinab zu den Kammern des Rats. Und der Rat merkt es: Gestern hat die Garde zwei Drucker verhört, die nie für mich gearbeitet haben. (Er grinst schief.)
> 
> Deine Erfahrung wächst nun schneller. (+10% XP)


## Die Quelle

`schattenrat_finale` · **NPC:** Schmiedemeisterin Branka · **Abgabe bei:** Setzer Thom · **Kette:** 2

> Steig auf Tiefe 30 hinab, zur Esse unter der Stadt. Elara ist schon dort. Danach wartet Thom an der Presse.

- **Ziel:** `boss_kill` → `schattenrat` ×1
- **Vorbedingung:** Der Maulwurf **+** Was der Rauch behält
- **Belohnung:** mind. 250 XP (bzw. 150 % des Stufenbedarfs, Finale) · **Ausrüstungsstück** (selten, auf Spielerstufe gewürfelt)

**Angebot**

> Elara ist hinabgestiegen, zur Esse, auf Tiefe 30. Sie trägt ein echtes Amulett des Rats. Du hast nur Deine Hände. (Sie sieht auf Deinen Hammer.) Der reicht, und Deine Hände auch. Du bist der Einzige, der eine solche Bindung lösen kann.
> 
> Und noch etwas. Harren hat gefragt, wohin Du gehst. Ich habe es ihm nicht gesagt. Er wird es trotzdem herausfinden.

**Unterwegs**

> Die Esse liegt auf Tiefe 30. Je tiefer Du gehst, desto mehr will der Nebel von Dir. Halt fest, was Du bist.

**Abschluss**

> (Thom wischt sich die Hände am Kittel ab, als Du hereinkommst. Er fragt nicht, wie es unten war. Er sieht es Dir an.)
> 
> Die Esse ist zerbrochen. Draussen bleiben die Leute auf der Strasse stehen und sagen Namen, die sie seit Jahren nicht mehr gesagt haben. (Er klopft auf die Presse.) Jetzt glauben sie, was sie lesen, weil sie es selbst wieder wissen. Die Platten liegen bereit.


## Waffen für den Widerstand

`branka_weapons` · **NPC:** Schmiedemeisterin Branka · **Kette:** 3 · **Angebot ab Tiefe 24**

> Stelle 3 Gegenstände in der Archivschmiede her.

- **Ziel:** `craft` → `craft_item` ×3
- **Vorbedingung:** Zweifel der Schmiedin
- **Belohnung:** mind. 150 XP (bzw. 70 % des Stufenbedarfs, Story)

**Angebot**

> Wir brauchen Waffen. Nicht für den Rat — für UNS.
> 
> Stelle drei Gegenstände in der Schmiede her.

**Unterwegs**

> Die Schmiede wartet. Stelle weitere Gegenstände her.

**Abschluss**

> Gut geschmiedet. Diese Waffen werden den Unterschied machen.


## Die letzte Wache

`mara_assault` · **NPC:** Späherin Mara · **Kette:** 3

> Dring bis Welle 30 vor. Dort unten führt Mara Dich zu Aldric.

- **Ziel:** `wave` → `reach_wave` ×30; `observe` → `aldric_gefunden` ×1
- **Vorbedingung:** Die Quelle
- **Belohnung:** mind. 300 XP (bzw. 100 % des Stufenbedarfs, Boss) · **Ausrüstungsstück** (selten, auf Spielerstufe gewürfelt)

**Angebot**

> Aldric ist nach dem Bruch der Esse in die Tiefe geflohen, mit dem Rest seiner Kettenwache. Oben steht sein Name schon auf jedem Blatt. Unten weiss er vielleicht nicht einmal mehr, dass es seiner ist.
> 
> Dring bis Welle 30 vor. Ich finde ihn, und dann bringe ich Dich zu ihm. Bist Du dabei?

**Unterwegs**

> Die Kettenwache hält sich noch in der Tiefe. Dring weiter vor, bis Welle 30. Dort warte ich auf Dich.

**Abschluss**

> Er ist leer. Der Mann, der andere hat leeren lassen. (Mara sieht lange in die Flamme ihrer Lampe.) Ich dachte, ich würde mich freuen.
> 
> Die Kettenwache ist zerschlagen. Die Gänge unter der Stadt gehören wieder niemandem. Das ist mehr, als diese Stadt lange hatte.


## Das Eichgewicht

`branka_eichgewicht` · **NPC:** Schmiedemeisterin Branka · **Kette:** 5 · **Fortschritt erst ab Tiefe 26**

> Bring Branka das alte Eichgewicht der Zunft aus der Tiefe (ab Tiefe 26).

- **Ziel:** `fetch` → `eichgewicht` ×1
- **Vorbedingung:** keine
- **Belohnung:** mind. 150 XP (bzw. 40 % des Stufenbedarfs, Neben) · 15 MAT

**Angebot**

> Die zwei Händler vor meiner Werkstatt streiten seit Tagen, wessen Waage lügt. Jeden Morgen, laut, vor meiner Tür. Das alte Eichgewicht der Zunft liegt irgendwo unten, ab Tiefe 26, seit die Zunft sich aufgelöst hat. Bring es mir, und ich mache dem ein Ende. Bitte.

**Unterwegs**

> Ein Messingzylinder mit dem Zunftstempel. Ab Tiefe 26. Und beeil Dich, sie haben heute schon zweimal angefangen.

**Abschluss**

> Das ist es. (Sie legt es auf beide Waagen.) Beide falsch. Um genau dasselbe. (Sie seufzt.) Jetzt streiten sie darüber, wer es zuerst gesagt hat. Aber leiser. Danke.


## Die Abrechnung

`the_reckoning` · **NPC:** Setzer Thom · **Kette:** 6

> Die Esse ist zerbrochen. Thom wartet an der Presse. Die Stadt soll alles erfahren.

- **Ziel:** `dialogue` → `press_decision` ×1
- **Vorbedingung:** Die Quelle
- **Belohnung:** mind. 500 XP (bzw. 150 % des Stufenbedarfs, Finale) · schaltet frei: story_ending

**Angebot**

> Die Platten liegen. Alles kommt drauf, zuoberst Aldrics Name. Dann der Rat, der Widerstand, sie. Und die Namen der Verschwundenen. Kein Siegel steht darunter, und die Stadt wird es trotzdem glauben, weil sie sich gerade selbst wieder erinnert.

**Unterwegs**

> Die Presse wartet.

**Abschluss**

> Der Nebel dünnt aus. Nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken. Was an tausend Orten steht, kann niemand mehr verbrennen.

