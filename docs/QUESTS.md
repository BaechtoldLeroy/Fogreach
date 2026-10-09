# Quest-Übersicht — Fogreach

_Quest-Daten automatisch generiert aus_ `js/questSystem.js` _(QUEST_DEFINITIONS) — 49 Quests._  
_Neu erzeugen:_ `node tools/genQuestDoc.js`

---

# Kontext

## Prämisse

Du spielst den **Archivschmied**, einen Handwerker im Dienst des Rats, ohne Erinnerung an die Zeit vor dem Unfall in der Schmiede. Unter der Stadt liegt der Nebel: ein Kellerlabyrinth, in das der Rat Dich zum Aufräumen schickt.

Nach außen streiten Magistrat, Klerus und Garde; innen gehören ihre Spitzen demselben Kreis an, dem **Schattenrat**. Er nährt die Quelle des Nebels mit den Erinnerungen der Bürger. Und weil ein Volk ohne Ventil gefährlich wird, führt er auch den Widerstand selbst: durch **Elara**, die Tochter des Bürgermeisters, deren Flucht inszeniert war.

> Du hast geglaubt, Du arbeitest für den Rat, dann gegen ihn. In Wahrheit hast Du die ganze Zeit für ihn gearbeitet, auch auf der anderen Seite.

## Charaktere

| Figur | Rolle | Kern |
|---|---|---|
| **Archivschmied** (Du) | Handwerker im Ratsdienst | Amnesie. Der Jedermann, der anfängt zu fragen. |
| **Elara** | Harrens Tochter, Gesicht des Widerstands, **Mitglied des Schattenrats** | Lenkt den Widerstand für den Rat. Braucht Dich, um die Quelle zu öffnen. Endgegnerin, besessen von der Quelle. |
| **Ratsherr Aldric** | Auftraggeber, Stimme des Schattenrats im Rat | Elaras Mentor. Der Einzige im offenen Rat, der von ihr weiss. |
| **Bürgermeister Harren** | Vater, ehrlich | Will sein Kind zurück. Stirbt im Finale, als er zu ihr durchdringen will. |
| **Mara** | Späherin, Schwarzmarkt | Merkt als Erste, dass der Widerstand verraten wird. |
| **Branka** | Archivschmiedin | Moralischer Kompass, hilft Dir, Dich zu erinnern. |
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
| `0` | Der Dienst | _Startzustand_ |
| `1` | Treuer Diener | Abschluss von **Die verschwundene Tochter** |
| `2` | Das Doppelspiel | Abschluss von **Die geheime Sitzung** |
| `3` | Die Enttarnung | Abschluss von **Maras Warnung** |
| `4` | Die Quelle | Abschluss von **Der Bruch** |

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

**`minDepth` gated nicht das Angebot, sondern den Fortschritt:** Ziele zählen erst, wenn der laufende Run auf mindestens dieser Tiefe ist.

**Akt-Index → Name:** `0` Der Dienst · `1` Treuer Diener · `2` Das Doppelspiel · `3` Die Enttarnung · `4` Die Quelle

## Ziel-Typen und ihre Trigger

| Typ | Trigger im Code |
|---|---|
| `kill` (`enemy` / `elite_enemy`) | Gegner-Tod (`js/player.js`) |
| `explore` (`room`) | Raum gecleart (`js/roomManager.js` → `markRoomCleared`) |
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

Bosse spawnen nur an Tier-Gates (Tiefe = Vielfaches von 10, ab Akt 2):

| Boss | Tiefe | Quest |
|---|---|---|
| Kettenmeister | 10 | Maras Warnung |
| Zeremonienmeister | 20 | Die Ritualkammer (Elara) |
| Schattenrat | 30 | Die Quelle (Harren) |

---

# Akt-Index 0 — Der Dienst

## Das versiegelte Bündel

`resistance_fetch_01` · **NPC:** Elara · **Kette:** 0

> Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen, und öffne es nicht.

- **Ziel:** `fetch` → `sealed_bundle` ×1
- **Vorbedingung:** keine
- **Belohnung:** 25 XP · 3 MAT

**Angebot**

> Es gibt da etwas im Keller... ein Bündel, versiegelt. Bring es mir, ohne dass jemand es sieht. Und öffne es nicht.
> 
> Nimmst du den Auftrag an?

**Unterwegs**

> Das Bündel liegt irgendwo da unten. Sieh dich um — und lass es zu.

**Abschluss**

> Du hast es. Und du hast es nicht geöffnet. Gut.
> 
> (Auf dem Wachs des Siegels: drei Ketten, ineinander verschlungen. Du hast dieses Zeichen noch nie gesehen.)


## Säuberung der Keller

`aldric_cleanup` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Besiege 10 Gegner in den Kellern unter der Archivschmiede.

- **Ziel:** `kill` → `enemy` ×10
- **Vorbedingung:** keine
- **Belohnung:** 30 XP · 5 MAT · 2 Druckblätter

**Angebot**

> Unten in den Kellern hat sich Ungeziefer eingenistet. Wilde Tiere, sagen die Wachen. Räum sie aus — zehn Stück, dann reden wir weiter.
> 
> Willst du diese Aufgabe übernehmen?

**Unterwegs**

> Die Keller sind noch nicht sicher. Kämpfe weiter.

**Abschluss**

> Gut. Die Keller sind gesäubert. Hier ist dein Lohn.


## Der erste Schliff

`einfuehrung_schmiede` · **NPC:** Schmiedemeisterin Branka · **Kette:** 1

> Werte in der Archivschmiede ein Ausrüstungsstück auf.

- **Ziel:** `system` → `upgrade` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 40 XP

**Angebot**

> Du trägst das, was Du unten gefunden hast, und Du trägst es, wie man ein Werkzeug trägt, das einem fremd ist.
> 
> Bring mir irgendetwas davon. Ich zeig Dir, wie man es ausbaut, und es wird Deins. Diesmal geht es auf mich — danach kostet es Gold und Eisenbrocken, und Du machst es allein.

**Unterwegs**

> Du hast es noch nicht gemacht. Leg ein Stück auf den Tisch und drück auf Ausbauen. Diesmal zahle ich.

**Abschluss**

> (Sie dreht es einmal ins Licht.) Siehst Du. Dasselbe Stück, nur nicht mehr dasselbe.
> 
> Jedes Mal, wenn Du hochkommst, kommst Du hier vorbei. Nicht weil ich das sage, sondern weil Du sonst mit dem runtergehst, was letzte Woche gereicht hat.


## Eine Zeile, die bleibt

`einfuehrung_presse` · **NPC:** Setzer Thom · **Kette:** 1

> Lass Setzer Thom ein Edikt drucken.

- **Ziel:** `system` → `edikt` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 40 XP

**Angebot**

> Der Rat schreibt jede Woche vor, was die Stadt denken soll. Wir können dasselbe — kleiner, aber wir können es.
> 
> Du hast Druckblätter dabei, ich sehe sie. Such Dir eine Zeile aus und lass sie mich setzen. Sie wirkt, solange sie hängt, und sie kostet Dich Aufmerksamkeit beim Rat. Beides sollst Du einmal gespürt haben, bevor es darauf ankommt.

**Unterwegs**

> Noch hängt nichts. Geh rein, such eine Zeile aus, ich setze sie.

**Abschluss**

> (Er wischt sich die Finger am Kittel ab.) Jetzt steht es an jeder Ecke, und irgendwer liest es laut vor.
> 
> Merk Dir nur eins: Jede Zeile, die wir drucken, legt der Rat auf seine Waage. Druck nicht mehr, als Du unten wieder gutmachen kannst.


## Was unter dem Tisch liegt

`einfuehrung_markt` · **NPC:** Mara vom Untergrund · **Kette:** 1

> Kauf Mara auf dem Schwarzmarkt etwas ab.

- **Ziel:** `system` → `markt` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 40 XP

**Angebot**

> Du schleppst Gold herum, als wüsstest Du nicht, wofür. Ich schon.
> 
> Ich habe einen Stand — hier, unter dem Tisch. Frag nicht, woher die Ware kommt. Nimm irgendetwas, das Billigste reicht. Danach weisst Du, dass es ihn gibt, und das ist der ganze Punkt.

**Unterwegs**

> Nimm irgendetwas. Ich schreibe nicht auf, was.

**Abschluss**

> (Sie zählt das Gold nicht nach.) Gut. Und jetzt vergiss, dass ich Dir das gezeigt habe.
> 
> Was ich nicht habe, hat vielleicht der Alte mit dem Karren, da unten. Wer mit vollen Taschen hochkommt und sie wieder mit runternimmt, hat etwas nicht verstanden.


## Wofür du taugst

`einfuehrung_talente` · **NPC:** Ratsherr Aldric · **Kette:** 1

> Setz einen Punkt im Talentbaum.

- **Ziel:** `system` → `talent` ×1
- **Vorbedingung:** Säuberung der Keller
- **Belohnung:** 40 XP

**Angebot**

> Der Rat führt über jeden Bürger eine Akte, und in Deiner steht ein Wort, das mich stört: unbestimmt.
> 
> Das lässt sich ändern. Du sammelst unten Erfahrung, und Erfahrung wird zu Punkten. Setz einen. Wut, Ketten oder Schatten — such es Dir aus. Der Rat schätzt Leute, die sich festlegen.

**Unterwegs**

> Noch immer unbestimmt. Öffne den Baum und setz einen Punkt. Welchen, ist Deine Sache.

**Abschluss**

> (Er notiert etwas, ohne aufzusehen.) Festgelegt. Gut.
> 
> Die Akte wird Dich überleben, Archivschmied. Das ist keine Drohung, das ist Verwaltung.


## Die verschwundene Tochter

`harren_daughter_investigation` · **NPC:** Bürgermeister Harren · **Kette:** 1

> Finde das Tagebuchfragment der Bürgermeistertochter im Rathauskeller.

- **Ziel:** `fetch` → `journal_fragment` ×1
- **Vorbedingung:** Säuberung der Keller **+** Keller-Patrouille
- **Belohnung:** 50 XP · 1 Wissens-Fragment(e)

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
- **Vorbedingung:** keine
- **Belohnung:** 70 XP

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
- **Vorbedingung:** keine
- **Belohnung:** 60 XP

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
- **Belohnung:** 40 XP · 1 Druckblätter

**Angebot**

> Stell sicher, dass alle Gänge sicher sind. Patrouilliere drei Räume.
> 
> Bist du bereit?

**Unterwegs**

> Noch nicht alle Gänge gesichert. Weiter patrouillieren.

**Abschluss**

> Alle Gänge sind sicher. Gute Arbeit, Archivschmied.


## Was die Mauern wissen

`einfuehrung_wissen` · **NPC:** Schmiedemeisterin Branka · **Kette:** 2

> Verbau ein Erinnerungsfragment im Wissensbaum.

- **Ziel:** `system` → `wissen` ×1
- **Vorbedingung:** Der erste Schliff **+** Die verschwundene Tochter
- **Belohnung:** 40 XP

**Angebot**

> Stahl allein schneidet die Lügen des Rates nicht. Das sage ich jedem, und jeder nickt und versteht es nicht.
> 
> Du trägst ein Fragment bei Dir. Ein Stück von etwas, das jemand aufgeschrieben und der Rat verbrannt hat. Verbau es — nicht in einer Klinge, in Dir. Dann weisst Du, was ich meine.

**Unterwegs**

> Das Fragment liegt noch bei Dir herum. Öffne den Baum und setz es ein. Es wird nicht mehr wert, wenn Du wartest.

**Abschluss**

> (Sie sieht Dich einen Moment zu lange an.) Und? Nichts blitzt, nichts klingelt. So ist Wissen.
> 
> Jedes Fragment, das Du unten findest, gehört da hinein. Der Rat sammelt sie auch — nur verbrennt er sie.


## Der Alte mit dem Karren

`einfuehrung_amulett` · **NPC:** Mara vom Untergrund · **Kette:** 2

> Kauf dem wandernden Händler in der Tiefe etwas ab.

- **Ziel:** `system` → `haendler` ×1
- **Vorbedingung:** Was unter dem Tisch liegt
- **Belohnung:** 40 XP

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

`brett_laeufe` · **NPC:** anschlagtafel · **Kette:** 2 · **Fortschritt erst ab Tiefe 8**

> Ein Rats-Aushang: schliesse 2 Läufe ab Tiefe 8 ab.

- **Ziel:** `dungeon_run` → `dungeon_complete` ×2
- **Vorbedingung:** keine
- **Belohnung:** 110 XP

**Angebot**

> GARDE: Zwei vollständige Gänge ab Tiefe 8. Nicht die Hälfte, nicht fast — ganz durch, beide Male.
> 
> (Darunter jemand mit Kohle: "Sie zahlen für den Weg, nicht für das, was man sieht.")

**Unterwegs**

> Zwei ganze Gänge ab Tiefe 8. Halbe zählen nicht.

**Abschluss**

> Die Garde zahlt ohne Nachfragen. Was Du unten gesehen hast, will niemand wissen.


## Aushang: Die Anführer

`brett_anfuehrer` · **NPC:** anschlagtafel · **Kette:** 2 · **Fortschritt erst ab Tiefe 6**

> Ein Rats-Aushang: besiege 3 Elite-Gegner ab Tiefe 6.

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** keine
- **Belohnung:** 90 XP

**Angebot**

> GARDE: Drei Anführer, ab Tiefe 6. Wer zahlt, fragt nicht, wer sie waren.
> 
> (Der Aushang ist frisch. Der darunter, halb verdeckt, sucht eine vermisste Näherin.)

**Unterwegs**

> Drei Anführer, ab Tiefe 6. Der Aushang wartet.

**Abschluss**

> Die Garde zahlt bar und sofort. Den Aushang nimmt niemand ab; er hängt am nächsten Morgen wieder da.


## Aushang: Standhalten

`brett_welle` · **NPC:** anschlagtafel · **Kette:** 3 · **Fortschritt erst ab Tiefe 6**

> Ein Rats-Aushang: überstehe Welle 12 ab Tiefe 6.

- **Ziel:** `wave` → `reach_wave` ×12
- **Vorbedingung:** keine
- **Belohnung:** 100 XP

**Angebot**

> KLERUS: Zwölf Ansturmwellen, ab Tiefe 6, ohne zu weichen. Standhaftigkeit ist eine Tugend, und der Rat belohnt Tugend.
> 
> (Das Siegel darunter ist frisch. Die Tinte noch feucht.)

**Unterwegs**

> Zwölf Wellen ab Tiefe 6. Weichen zählt nicht.

**Abschluss**

> Der Priester am Kasten segnet Dich, während er abzählt. Beides dauert gleich lang.


## Aufruf der Druckerei

`brett_aufruf` · **NPC:** anschlagtafel · **Kette:** 3 · **Fortschritt erst ab Tiefe 10**

> Ein Aufruf des Widerstands: räume 5 Kammern ab Tiefe 10.

- **Ziel:** `explore` → `room` ×5
- **Vorbedingung:** keine
- **Belohnung:** 120 XP · 4 Druckblätter

**Angebot**

> Über den zerfetzten Rats-Plakaten klebt ein frisch gedrucktes Blatt:
> 
> "Wer unten aufräumt, macht Platz für die Wahrheit. Fünf Kammern, ab Tiefe 10. Papier gibt es bei Thom."

**Unterwegs**

> Fünf Kammern ab Tiefe 10. Das Blatt hängt noch, jemand hat es festgenagelt.

**Abschluss**

> Am Rand des Blattes steht jetzt ein Strich mehr. Thom legt Papier und Münzen unter den Stein daneben.


## Aufruf: Nehmt ihnen die Anführer

`brett_zeugen` · **NPC:** anschlagtafel · **Kette:** 4 · **Fortschritt erst ab Tiefe 12**

> Ein Aufruf des Widerstands: besiege 4 Elite-Gegner ab Tiefe 12.

- **Ziel:** `kill` → `elite_enemy` ×4
- **Vorbedingung:** keine
- **Belohnung:** 130 XP

**Angebot**

> Aus Thoms Presse, quer über ein zerfetztes Rats-Plakat geklebt:
> 
> "Vier von denen, die unten befehlen. Ab Tiefe 12. Wer befiehlt, hat einen Namen — und wir drucken Namen."

**Unterwegs**

> Vier Anführer ab Tiefe 12. Die Presse wartet auf die Namen.

**Abschluss**

> Am nächsten Morgen stehen vier Namen im Blatt. Zwei davon kennt die Stadt.


# Akt-Index 1 — Treuer Diener

## Verifikation des Magistrats

`magistrat_verification` · **NPC:** Ratsherr Aldric · **Kette:** 2

> Beschaffe das ratsgesiegelte Verifikationsdokument für den Magistrat.

- **Ziel:** `fetch` → `verification_seal` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 75 XP

**Angebot**

> Du hast das Fragment gesehen. Gut. Dann weisst du auch, dass die Tochter neu klassifiziert werden muss — von "geflohen" zu "vermisste Person von Interesse". Eine reine Verwaltungsangelegenheit, verstehst du. Akten müssen ordnungsgemäss geführt werden.
> 
> Das ratsgesiegelte Verifikationsdokument liegt in der versunkenen Registratur — dort unten, wo der Nebel die alten Akten verschluckt hat. Steig hinab, birg das Ratssiegel und bring es mir. Was dir dabei begegnet, ist nicht mein Ressort. Der Magistrat trägt die Verantwortung, nicht der Bürger.
> 
> Nimmst du den Auftrag an?

**Unterwegs**

> Das Ratssiegel liegt noch da unten in der versunkenen Registratur. Steig weiter hinab und birg es. Ohne das Dokument ist die Neuklassifizierung nicht rechtskräftig.

**Abschluss**

> Hervorragend. Das Dokument ist im Archiv. Die Tochter ist nun offiziell eine Person von Interesse. Was das in der Praxis bedeutet, geht dich nichts an. Der Magistrat dankt dir.


## Reinigung der unteren Kammern

`klerus_purification` · **NPC:** Klerus-Priester · **Kette:** 2 · **Fortschritt erst ab Tiefe 3**

> Reinige die unteren Kammern des Rathauskellers — besiege 3 Elite-Gegner. Die Ketzer-Anführer lauern erst ab Tiefe 3.

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 90 XP

**Angebot**

> Du hast das Fragment gesehen, Archivschmied. Dann weisst du, dass die Tochter nicht aus eigenem Willen geflohen ist. Sie wurde von einer dunklen Hand geführt — die untere Kammern bersten vor solchen Schatten.
> 
> Reinige sie. Drei der Anführer dieser ketzerischen Präsenz lauern noch dort unten, tiefer als die ersten Gänge — steige bis Tiefe 3 hinab. Fälle sie im Namen der Ordnung. Die Seele der Tochter wird es dir danken — wenn das Licht sie wiederfindet.
> 
> Die Reinigung ist eine geistliche Pflicht. Nimm sie an.

**Unterwegs**

> Die Anführer lauern tief — erst ab Tiefe 3. Steige hinab, finde sie, fälle sie. Jede Ketzerei, die du beendest, öffnet einen weiteren Pfad zur Reinheit.

**Abschluss**

> Du hast die Ketzerei geschlagen. Die untere Kammern atmen wieder. Die Ordnung bleibt — durch dich. Der Klerus segnet deine Hand. Bring sie weiter dorthin, wo das Licht es verlangt.


## Patrouillen-Erweiterung

`garde_patrol_expansion` · **NPC:** Stadtwache · **Kette:** 2

> Demonstriere Kraft für die nächsten Patrouillen — besiege 10 Störer.

- **Ziel:** `kill` → `enemy` ×10
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 75 XP

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
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 100 XP · 1 Wissens-Fragment(e)

**Angebot**

> Du hast also das Fragment gefunden. Gut — dann lebst du nicht mehr ganz in ihrer Erzählung.
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
- **Belohnung:** 150 XP · 1 Wissens-Fragment(e)

**Angebot**

> Heute verkündet der Rat das Ergebnis der Abstimmung, öffentlich, im Ratssaal. Magistrat, Klerus, Garde, vor allen Bürgern. Geh hin und hör zu. Und dann folge ihnen in der Nacht, wenn sie glauben, dass keiner zusieht.

**Unterwegs**

> Die Ratskammer liegt unten im Keller. Zieh die Uniform der Wache an, bleib im Schatten und hör zu, was sie sagen, wenn keiner zusieht.

**Abschluss**

> Jetzt hast du es gesehen. Ein Gesicht, drei Masken. Du hast für jede gearbeitet. Du könntest fliehen — aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, die ein Flüchtiger nie sieht. Bleib, wo du bist. Räum weiter für sie, und räum heimlich für uns. Es ist gefährlicher. Es ist auch das Einzige, was nützt.


## Das Edikt der Woche

`faction_campaign` · **NPC:** Ratsherr Aldric · **Kette:** 3

> Die Stadt stimmt ab: drei Edikte, eines gewinnt. Lass sie bei Thom drucken und häng sie an die Anschlagtafeln vor dem Rathaus.

- **Ziel:** `observe` → `edikte_gedruckt` ×1; `observe` → `edikte_plakatiert` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 60 XP

**Angebot**

> Diese Woche stimmt die Stadt ab. Drei Edikte, Magistrat, Klerus, Garde, und die Bürger wählen eines. Lass sie bei Thom drucken und häng sie an die Tafeln vor dem Rathaus. So sieht Ordnung aus, die gewählt ist.

**Unterwegs**

> Erst drucken, dann aushängen. Die Druckerei ist gleich über dem Platz.

**Abschluss**

> Gut. Die Stimmen werden gezählt, und das Ergebnis verkündet der Rat öffentlich, im Ratssaal. So gehört sich das.


# Akt-Index 2 — Das Doppelspiel

## Die Späherin

`mara_contact` · **NPC:** Mara vom Untergrund · **Kette:** 1

> Kundschafte für Mara drei Kellerräume des Rats aus.

- **Ziel:** `explore` → `room` ×3
- **Vorbedingung:** keine
- **Belohnung:** 60 XP · Info: Maras Netzwerk enthüllt

**Angebot**

> Du erinnerst dich nicht an mich. Aber ich an dich — du warst Archivschmied, bevor der Nebel dir die Erinnerung nahm, und du hast Fragen gestellt, die der Rat begraben wollte.
> 
> Ich bin die Späherin des Widerstands. Bevor ich dir mein Netzwerk öffne, will ich sehen, ob du noch sehen kannst: Geh hinab und kundschafte drei Kellerräume aus. Präg dir ein, was der Rat dort versteckt.

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
- **Belohnung:** 100 XP · schaltet frei: elara_trust

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
- **Belohnung:** 60 XP · 2 Druckblätter

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


## Zweifel der Schmiedin

`branka_doubt` · **NPC:** Schmiedemeisterin Branka · **Kette:** 2

> Besiege 5 Elite-Gegner, um Beweise für Brankas Verdacht zu finden.

- **Ziel:** `kill` → `elite_enemy` ×5
- **Vorbedingung:** keine
- **Belohnung:** 80 XP

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
- **Belohnung:** 70 XP · 1 Druckblätter

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


## Maras Warnung

`mara_warning` · **NPC:** Mara vom Untergrund · **Kette:** 2

> Besiege den Kettenmeister-Boss, der die ersten echten Beweise bewacht.

- **Ziel:** `boss_kill` → `kettenmeister` ×1
- **Vorbedingung:** Die Späherin **+** Der Konvoi
- **Belohnung:** 200 XP

**Angebot**

> Der Kettenmeister hält die Siegel auf Tiefe 10. Er fesselt, was er fangen will. Fäll ihn, dann haben wir den ersten harten Beweis.

**Unterwegs**

> Der Kettenmeister lebt noch, auf Tiefe 10. Wenn er dich kettet, schlag die Kette, sonst hält er dich.

**Abschluss**

> Der Kettenmeister ist gefallen, die Beweise gesichert. Jetzt kann niemand mehr leugnen, dass der Rat Menschen verarbeitet.


## Verbotene Abschriften

`branka_transcripts` · **NPC:** Schmiedemeisterin Branka · **Kette:** 3

> Bring Branka 2 Verhörprotokolle aus den Kellern.

- **Ziel:** `fetch` → `interrogation_record` ×2
- **Vorbedingung:** Die Späherin
- **Belohnung:** 80 XP · 1 Wissens-Fragment(e)

**Angebot**

> Im Keller lagern Protokolle aus Verhören. Nicht von Dämonen — von Menschen. Bring mir zwei Abschriften. Vorsichtig.

**Unterwegs**

> Die Protokolle sind tief im Keller. Such weiter.

**Abschluss**

> Lies das. "Befragt bis zum Geständnis." Der Rat verhört Bürger wie Beschworene. Das ist kein Schutz — das ist Jagd.


## Reinigung eines Bezirks

`klerus_district_purge` · **NPC:** Klerus-Priester · **Kette:** 3

> Reinige einen "befallenen" Bezirk — besiege 8 Gegner und bring die Namen.

- **Ziel:** `kill` → `enemy` ×8
- **Vorbedingung:** keine
- **Belohnung:** 70 XP

**Angebot**

> Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.

**Unterwegs**

> Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.

**Abschluss**

> Du bringst die Namen. (Die Befallenen hatten Gesichter. Keins davon kanntest Du, und doch kam Dir jedes bekannt vor.) (Eine Abschrift steckt schon bei Mara, bevor der Rat die Liste sieht. Wer draufsteht, verschwindet. Aber vielleicht nicht mehr alle. Vielleicht warnt jemand rechtzeitig.)


## Der Konvoi

`espionage_convoy` · **NPC:** Mara vom Untergrund · **Kette:** 6

> Beschatte verkleidet einen Council-Konvoi im Lagerhaus und höre ihn ab.

- **Ziel:** `observe` → `convoy_intel` ×1
- **Vorbedingung:** Die Späherin
- **Belohnung:** 90 XP · 2 Druckblätter

**Angebot**

> Heute Nacht entladen sie im alten Lagerhaus einen Konvoi des Rats. Zieh die Wachuniform an, bleib im Schatten und hör zu — aber zieh keine Klinge, sonst fliegt die Verkleidung auf.
> 
> Uebernimmst du das?

**Unterwegs**

> Du bist noch nicht nah genug. Misch dich unter die Wachen am Konvoi und hör ab, was verladen wird — unentdeckt.

**Abschluss**

> Du hast es gehört. Keine Vorräte, keine Waffen. Reagenzien, versiegelte Phiolen, Kreidesteine — Ritual-Komponenten. Der Rat schickt keine Patrouille los. Er rüstet eine Beschwörung aus.


# Akt-Index 3 — Die Enttarnung

## Verbotene Wahrheiten

`thom_truth` · **NPC:** Setzer Thom · **Kette:** 1 · **Fortschritt erst ab Tiefe 14**

> Finde 5 Druckplatten mit den verbotenen Wahrheiten über den Rat (ab Tiefe 14).

- **Ziel:** `fetch` → `print_plate` ×5
- **Vorbedingung:** keine
- **Belohnung:** 100 XP · 20 MAT

**Angebot**

> Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.
> 
> Finde fünf Druckplatten, tief im Keller, ab Tiefe 14 — sie enthalten die echte Geschichte.

**Unterwegs**

> Die Druckplatten liegen tief im Rathauskeller, ab Tiefe 14. Suche weiter.

**Abschluss**

> Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.


## Ein Hund namens Bruno

`buerger_hund` · **NPC:** buerger · **Kette:** 1 · **Fortschritt erst ab Tiefe 15**

> Finde Brunos Halsband in den Kanälen unter der Stadt (ab Tiefe 15).

- **Ziel:** `fetch` → `hundehalsband` ×1
- **Vorbedingung:** keine
- **Belohnung:** 80 XP

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
- **Belohnung:** 150 XP · **Ritualamulett** (Episch, iLvl 12)

**Angebot**

> Tief unten ist eine Kammer — die Beschwörungskammer des Rats. Sie wird vom Zeremonienmeister gehalten, dem Meister der verbotenen Rituale. Steig auf Tiefe 20 hinab und fälle ihn.
> 
> Bist du bereit für die Wahrheit?

**Unterwegs**

> Der Zeremonienmeister hält die Kammer noch. Du findest ihn auf Tiefe 20 — solange er lebt, kommst du nicht an die Wahrheit.

**Abschluss**

> Der Zeremonienmeister ist gefallen. Du hast sie gefunden — die Beschwörungskammer des Rats. Nimm dieses Amulett; es schützt vor ihrer dunklen Magie.


## Elaras Geschenk

`elara_blade` · **NPC:** Elara · **Kette:** 3

> Elara hat eine besondere Waffe für dich geschmiedet.

- **Ziel:** `dialogue` → `elara_gift` ×1
- **Vorbedingung:** Die Ritualkammer
- **Belohnung:** **Elaras Klinge** (Legendär, iLvl 15)

**Angebot**

> Nimm das. Ich habe es für dich geschmiedet. Für den Fall, dass...
> 
> Nimm Elaras Klinge an?

**Unterwegs**

> Die Klinge wartet auf dich.

**Abschluss**

> Möge sie dich beschützen. Egal was kommt.


## Nachteskorte

`garde_night_escort` · **NPC:** Stadtwache · **Kette:** 3 · **Fortschritt erst ab Tiefe 16**

> Sichere verdeckt einen nächtlichen Transport — beobachte die Eskorten-Route (ab Tiefe 16).

- **Ziel:** `observe` → `escort_route` ×1
- **Vorbedingung:** keine
- **Belohnung:** 90 XP

**Angebot**

> Heute Nacht geht ein Transport. Die Route führt tief hinab, ab Tiefe 16. Sicher sie, frag nicht, was drin ist. Loyalität zahlt sich aus.

**Unterwegs**

> Der Transport rollt erst ab Tiefe 16. Halt die Route im Auge, bleib unauffällig.

**Abschluss**

> Die Route ist sicher. (Und in deinem Kopf, Weg, Zeit und Fracht, bereit für Mara. Es waren keine Waffen. Es waren dieselben Phiolen wie im Konvoi.)


## Die verseuchte Kammer

`verseuchte_kammer` · **NPC:** Ratsherr Aldric · **Kette:** 4

> Aldric schickt dich, eine "verseuchte" Kammer zu reinigen. Dring bis zu ihr vor.

- **Ziel:** `explore` → `room` ×2
- **Vorbedingung:** Überwachung
- **Belohnung:** 120 XP · 1 Wissens-Fragment(e)

**Angebot**

> Eine untere Kammer ist verseucht — Ketzerei. Reinige sie. Frag nicht, was du findest.
> 
> Geh.

**Unterwegs**

> Die Kammer liegt tiefer. Dring weiter vor.

**Abschluss**

> Du stehst in der Kammer. Blut, Symbole, Ketten — und kein Ketzer weit und breit. Das ist keine Verseuchung. Das ist eine Beschwörungskammer. Aldric hat dich hergeschickt, um seine eigene Spur zu verwischen. (Du prägst dir jedes Symbol ein. Mara soll das sehen. Und Aldric soll glauben, du hättest nur geputzt.)


## Wer du warst

`who_you_were` · **NPC:** Schmiedemeisterin Branka · **Kette:** 4 · **Fortschritt erst ab Tiefe 17**

> Bring Branka drei Splitter deiner alten Akte aus der Tiefe (ab Tiefe 17).

- **Ziel:** `fetch` → `memory_shard` ×3
- **Vorbedingung:** Zweifel der Schmiedin
- **Belohnung:** 150 XP · 1 Wissens-Fragment(e)

**Angebot**

> Ich habe etwas gefunden, das dich betrifft. Eine Akte mit deinem Zeichen, halb vom Nebel gefressen. Bring mir drei Splitter davon aus der Tiefe, dann setzen wir zusammen, wer du warst.

**Unterwegs**

> Die Splitter liegen tief — ab Tiefe 17. Such weiter.

**Abschluss**

> Da bist du. Vor dem Unfall, vor dem Nebel. Du hast nicht immer nur aufgeräumt. Du hast einmal dieselben Fragen gestellt, die du jetzt wieder stellst. Der Nebel hat dich nicht zufällig getroffen. Man hat ihn nach dir geschickt.


## Elaras zweite Wahrheit

`elara_second_truth` · **NPC:** Elara · **Kette:** 4

> Elara zeigt dir, für wen du das Letzte tust.

- **Ziel:** `observe` → `erster_riss_gesehen` ×1
- **Vorbedingung:** Verbotene Wahrheiten **+** Die Ritualkammer
- **Belohnung:** 200 XP · 2 Wissens-Fragment(e)

**Angebot**

> Bevor du das Letzte tust, sollst du wissen, für wen. Komm, nur wir zwei.

**Unterwegs**

> Elara wartet auf dich. Nur ihr zwei.

**Abschluss**

> Sie hat die Meldung weggesteckt. Eine wahre Meldung, und niemand wird sie je lesen. "Nicht alles hilft", hat sie gesagt. Du schiebst den Gedanken beiseite. Noch.


## Der Bruch

`bruch_confrontation` · **NPC:** Schmiedemeisterin Branka · **Kette:** 5 · **Fortschritt erst ab Tiefe 8**

> Aldric hat Wachen auf dich gehetzt. Schlag dich zu Branka durch — besiege 3 Elite-Wachen. Sie stellen dich erst in der Tiefe (ab Tiefe 8).

- **Ziel:** `kill` → `elite_enemy` ×3
- **Vorbedingung:** Die verseuchte Kammer **+** Elaras zweite Wahrheit
- **Belohnung:** 200 XP

**Angebot**

> Aldric weiss es. Dein Doppelspiel ist aufgeflogen, seine Elite-Wachen riegeln die tiefen Gänge ab, ab Tiefe 8 stellst du sie. Schlag dich durch und komm zu mir.

**Unterwegs**

> Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 8 stellst du sie.

**Abschluss**

> Du stellst zu viele Fragen, hat er gesagt. Jetzt stellst du gar keine mehr, du weisst es. Die Tarnung ist verbrannt, der Bruch ist da. Mara, Thom, ich, wir sind bereit.


## Das versiegelte Archiv

`espionage_archive` · **NPC:** Bürgermeister Harren · **Kette:** 7 · **Fortschritt erst ab Tiefe 12**

> Infiltriere verkleidet das Council-Archiv (ab Tiefe 12), höre die Schreiber ab und birg den versiegelten Akt.

- **Ziel:** `observe` → `archive_record` ×1
- **Vorbedingung:** Der Konvoi
- **Belohnung:** 110 XP · 1 Wissens-Fragment(e)

**Angebot**

> Im Archiv des Rats liegt ein versiegelter Akt — und ich muss wissen, was darin steht. Das Archiv liegt tief unter dem Rathaus, ab Tiefe 12. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und birg den Akt. Werde nicht gesehen.
> 
> Tust du das für mich?

**Unterwegs**

> Das Archiv liegt ab Tiefe 12. Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.

**Abschluss**

> Du hast den Akt. "Vermisst, Fall geschlossen" — das Verschwinden seiner Tochter, sauber abgelegt, Datum, Siegel, Unterschrift. Und das Datum liegt vor dem Tag, an dem sie verschwand.
> 
> (Harren liest es zweimal.) Sie haben es geplant. Jemand im Rat hat Lenes Verschwinden abgeheftet, bevor es geschah.


# Akt-Index 4 — Die Quelle

## Die Pamphlete

`thom_pamphlets` · **NPC:** Setzer Thom · **Kette:** 2 · **Fortschritt erst ab Tiefe 22**

> Schliesse 3 tiefe Dungeon-Durchläufe ab (ab Tiefe 22), um Flugblätter bis in die untersten Gänge zu verteilen.

- **Ziel:** `dungeon_run` → `dungeon_complete` ×3
- **Vorbedingung:** Verbotene Wahrheiten
- **Belohnung:** 200 XP · schaltet frei: xp_bonus_10

**Angebot**

> Die oberen Gänge lesen unsere Wahrheit schon. Jetzt brauchen wir die Tiefe — dort, wo der Rat seine Geheimnisse hält.
> 
> Schliesse drei Durchläufe ab Tiefe 22 ab, und ganz Fogreach wird die Wahrheit lesen.

**Unterwegs**

> Nur tiefe Durchläufe zählen — ab Tiefe 22. Schliess drei davon ab; jeder verbreitet unsere Botschaft in die untersten Gänge.

**Abschluss**

> Die ganze Stadt liest unsere Wahrheiten! Die Bürger sind aufgewacht. Deine Erfahrung wächst nun schneller. (+10% XP)


## Die Quelle

`schattenrat_finale` · **NPC:** Bürgermeister Harren · **Kette:** 2

> Steige auf Tiefe 30 hinab, zur Quelle des Nebels. Elara ist schon dort.

- **Ziel:** `boss_kill` → `schattenrat` ×1
- **Vorbedingung:** keine
- **Belohnung:** 250 XP

**Angebot**

> Elara ist hinabgestiegen. Zur Quelle, auf Tiefe 30. Ich weiss jetzt, was sie ist, Archivschmied. Sie ist trotzdem meine Tochter. Geh. Ich komme nach.

**Unterwegs**

> Die Quelle liegt auf Tiefe 30. Beeil Dich.

**Abschluss**

> Die Quelle ist zerbrochen. Jetzt gehört die Presse Dir. Geh zu Thom, es ist Zeit.


## Waffen für den Widerstand

`branka_weapons` · **NPC:** Schmiedemeisterin Branka · **Kette:** 3

> Stelle 3 Gegenstände in der Archivschmiede her.

- **Ziel:** `craft` → `craft_item` ×3
- **Vorbedingung:** Zweifel der Schmiedin
- **Belohnung:** 150 XP

**Angebot**

> Wir brauchen Waffen. Nicht für den Rat — für UNS.
> 
> Stelle drei Gegenstände in der Schmiede her.

**Unterwegs**

> Die Schmiede wartet. Stelle weitere Gegenstände her.

**Abschluss**

> Gut geschmiedet. Diese Waffen werden den Unterschied machen.


## Die letzte Wache

`mara_assault` · **NPC:** Mara vom Untergrund · **Kette:** 3

> Dring bis Welle 30 vor und zerschlag, was von der Kettenwache übrig ist.

- **Ziel:** `wave` → `reach_wave` ×30
- **Vorbedingung:** Die Quelle
- **Belohnung:** 300 XP

**Angebot**

> Aldric ist unter der Stadt verschwunden, mit dem Rest seiner Kettenwache. Solange sie da unten sind, schlafen die Gassen nicht. Dring bis Welle 30 vor und räum auf.
> 
> Bist du dabei?

**Unterwegs**

> Die Kettenwache hält sich noch in der Tiefe. Dring weiter vor — Welle 30.

**Abschluss**

> Die Kettenwache ist zerschlagen. Die Gänge unter der Stadt gehören wieder niemandem. Das ist mehr, als diese Stadt lange hatte.


## Das Eichgewicht

`branka_eichgewicht` · **NPC:** Schmiedemeisterin Branka · **Kette:** 5 · **Fortschritt erst ab Tiefe 26**

> Bring Branka das alte Eichgewicht der Zunft aus der Tiefe (ab Tiefe 26).

- **Ziel:** `fetch` → `eichgewicht` ×1
- **Vorbedingung:** keine
- **Belohnung:** 150 XP · 15 MAT

**Angebot**

> Die zwei Händler vor meiner Werkstatt streiten seit Tagen, wessen Waage lügt. Jeden Morgen, laut, vor meiner Tür. Das alte Eichgewicht der Zunft liegt irgendwo unten, ab Tiefe 26, seit die Zunft sich aufgelöst hat. Bring es mir, und ich mache dem ein Ende. Bitte.

**Unterwegs**

> Ein Messingzylinder mit dem Zunftstempel. Ab Tiefe 26. Und beeil Dich, sie haben heute schon zweimal angefangen.

**Abschluss**

> Das ist es. (Sie legt es auf beide Waagen.) Beide falsch. Um genau dasselbe. (Sie seufzt.) Jetzt streiten sie darüber, wer es zuerst gesagt hat. Aber leiser. Danke.


## Die Abrechnung

`the_reckoning` · **NPC:** Setzer Thom · **Kette:** 6

> Die Quelle ist zerbrochen. Thom wartet an der Presse. Die Stadt soll alles erfahren.

- **Ziel:** `dialogue` → `press_decision` ×1
- **Vorbedingung:** Die Quelle
- **Belohnung:** 500 XP · schaltet frei: story_ending

**Angebot**

> Die Platten liegen. Alles, was Du gesehen hast, kommt drauf: der Rat, Aldric, der Widerstand, sie. Morgen liest es die ganze Stadt.

**Unterwegs**

> Die Presse wartet.

**Abschluss**

> Der Nebel dünnt aus — nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken. Hart erkämpft, unvollständig, und frei.


## Der Maulwurf

`espionage_informant` · **NPC:** Mara vom Untergrund · **Kette:** 8 · **Fortschritt erst ab Tiefe 23**

> Enttarne verkleidet einen Council-Maulwurf in den Reihen des Widerstands (ab Tiefe 23).

- **Ziel:** `observe` → `informant_id` ×1
- **Vorbedingung:** Das versiegelte Archiv **+** Der Bruch
- **Belohnung:** 120 XP · 1 Wissens-Fragment(e)

**Angebot**

> Jemand verrät uns. Was wir hinter verschlossenen Türen beschliessen, weiss der Rat am nächsten Morgen. Misch dich verkleidet unter unsere eigenen Leute am Treffpunkt, tief unten, ab Tiefe 23, und finde heraus, wer der Maulwurf ist. Beweg dich leise — sie kennen dein Gesicht nicht in dieser Montur.
> 
> Findest du den Verräter?

**Unterwegs**

> Noch hast du den Maulwurf nicht. Bleib unauffällig am Treffpunkt (ab Tiefe 23) und hör ab, wer Nachrichten nach draussen schmuggelt.

**Abschluss**

> Du bist dem Zettel gefolgt, bis in die Ratskammer. Elara, neben Aldric. An ihrem Ring das Zeichen der drei Ketten. Sie hat uns alle geführt — direkt in seine Hände.

