# Quest-Übersicht — Fogreach

_Quest-Daten automatisch generiert aus_ `js/questSystem.js` _(QUEST_DEFINITIONS) — 34 Quests._  
_Neu erzeugen:_ `node tools/genQuestDoc.js`

---

# Kontext

## Prämisse

Du spielst den **Archivschmied** — Handwerker im Dienst des Stadtrats, der Akten, Waffen und Siegel instand hält. Unter der Stadt liegt der Nebel: ein Kellerlabyrinth, in das der Rat dich zum Aufräumen schickt.

Der Rat gibt sich als drei rivalisierende Fraktionen, die sich öffentlich bekämpfen. Tatsächlich **dienen sie alle derselben okkulten Agenda** — und der Spieler ist genau die Art von nützlichem Handwerker, der ihre Spuren beseitigt, ohne Fragen zu stellen.

Auslöser ist die verschwundene Tochter des Bürgermeisters. Jede Fraktion hat eine eigene Version: entführt, besessen, pflichtvergessen. Ihr Tagebuchfragment sagt etwas anderes — **sie ist geflohen**, und alle drei Ratsfraktionen stehen namentlich darin. Von da an ist die Frage nicht mehr *was ist passiert*, sondern *wem gehorchst du noch*.

## Charaktere

| Figur | Rolle | Steht für | Funktion im Bogen |
|---|---|---|---|
| **Ratsherr Aldric** | Ratsherr, dein Auftraggeber | Magistrat | Gibt die harmlosen Anfangsjobs. Schickt dich später in die Ritualkammer, um die **eigene Spur des Rats zu verwischen** — der Moment, in dem der Auftraggeber zum Gegner wird. |
| **Bürgermeister Harren** | Vater der Verschwundenen | (unabhängig) | Traut keiner der drei Versionen. Startet die Untersuchung und hält den Reveal in der Hand. |
| **Elara** | Kontakt im Untergrund | Widerstand | Gesicht der Opposition. Führt dich zur Beschwörungskammer, schenkt am Ende ihre Klinge. |
| **Mara vom Untergrund** | Späherin, Schwarzmarkt | Widerstand-nah | Netzwerk & Spionage-Aufträge; treibt die Boss-Konfrontationen. Betreibt auch den Schwarzmarkt. |
| **Schmiedemeisterin Branka** | Archivschmiede | (unabhängig) | Stellt Fragen, die man nicht stellen soll. Ihre Zweifel eskalieren zum **Bruch**. |
| **Setzer Thom** | Hinterhaus-Druckerei | Widerstand-nah | Macht Wahrheit zu Pamphleten — die Presse als Waffe. |
| **Klerus-Priester** | Geistlicher | Klerus | Nennt Flucht „Besessenheit" und Aufräumen „Reinigung". |
| **Stadtwache** | Garde-Offizier | Garde | Antwortet auf alles mit mehr Patrouillen. |

## Fraktionen

Ansehen wird pro Fraktion getrackt (`js/factionSystem.js`): feindlich < −25 · neutral · freundlich > 25 · verbündet > 50.

- **Magistrat**, **Klerus**, **Garde** — die drei *ratsinternen* Fraktionen. Konkurrieren nach außen, dienen innen derselben Agenda.
- **Widerstand** — die Opposition außerhalb des Systems.
- **Unabhängig** — neutrale Flagge.

In Akt 1 arbeitest du **für alle vier** — das Ansehen ist Konsequenz deines Handelns, kein Content-Gate.

## Akt-Struktur

Der Bogen ist **rein quest-getrieben**: ein Akt steigt nur, wenn eine Quest ihn per `advanceAct` hochsetzt. Tiefen-basierter Aufstieg wurde in Feature 050 entfernt.

| Index | Akt | Wird erreicht durch |
|---|---|---|
| `0` | Der Dienst | _Startzustand_ |
| `1` | Treuer Diener | Abschluss von **Die verschwundene Tochter** |
| `2` | Das Doppelspiel | Abschluss von **Die geheime Sitzung** |
| `3` | Die Enttarnung | Abschluss von **Maras Warnung** |
| `4` | Der Verrat und die Presse | Abschluss von **Der Bruch** |

Jeder Akt hat einen Trigger — die Leiter ist lückenlos.

---

# Referenz

## Wie eine Quest angeboten wird

Ein NPC bietet eine Quest an, wenn **alle** Bedingungen gelten:

1. Status ist `available` (noch nicht angenommen/abgeschlossen)
2. Die Quest gehört diesem NPC (`npcId`)
3. `currentAct >= requiredAct`
4. **Alle** `prerequisites` sind abgeschlossen
5. Optionales `gate()` liefert `true` _(aktuell nutzt keine Quest ein Gate)_

**`minDepth` gated nicht das Angebot, sondern den Fortschritt:** Ziele zählen erst, wenn der laufende Run auf mindestens dieser Tiefe ist.

**Akt-Index → Name:** `0` Der Dienst · `1` Treuer Diener · `2` Das Doppelspiel · `3` Die Enttarnung · `4` Der Verrat und die Presse

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

## Botengang für die Resistance

`resistance_fetch_01` · **NPC:** Elara · **Kette:** 0

> Hol das versiegelte Bündel aus dem Keller. Niemand darf es sehen.

- **Ziel:** `kill` → `enemy` ×5
- **Vorbedingung:** keine
- **Belohnung:** 25 XP · 3 MAT

**Angebot**

> Es gibt da etwas im Keller... ein Bündel, versiegelt. Bring es mir, ohne dass jemand sieht.
> 
> Nimmst du den Auftrag an?

**Unterwegs**

> Schau dich im Keller um. Räum ein paar Wachen aus dem Weg, falls nötig.

**Abschluss**

> Du hast es. Niemand hat dich gesehen — gut. Die Resistance vergisst das nicht.


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


## Die verschwundene Tochter

`harren_daughter_investigation` · **NPC:** Bürgermeister Harren · **Kette:** 1

> Finde das Tagebuchfragment der Bürgermeistertochter im Rathauskeller.

- **Ziel:** `fetch` → `journal_fragment` ×1
- **Vorbedingung:** Säuberung der Keller **+** Keller-Patrouille
- **Belohnung:** 50 XP · 1 Wissens-Fragment(e) · +1 Ansehen (independent)

**Angebot**

> Meine Tochter ist verschwunden. Aldric sagt, Eindringlinge hätten sie entführt. Der Klerus spricht von Besessenheit. Die Garde redet von Pflichtversäumnis.
> 
> Ich glaube keinem der drei, bevor ich nicht ihre eigenen Worte gelesen habe. Bring mir das Tagebuchfragment, das sie zurückgelassen hat. Du findest es im Rathauskeller — irgendwo, wo der Rat nicht hingeschaut hat.
> 
> Vertrau niemandem, bis du es selbst gesehen hast.

**Unterwegs**

> Such weiter — das Fragment ist da unten. Aldric, Klerus und Garde streiten sich oben, weil sie alle eine andere Version hören wollen. Du findest die echte.

**Abschluss**

> Du hast es. Sie ist nicht entführt worden. Sie ist geflohen. Und sie hatte Grund dazu — alle drei Ratsfraktionen werden im Fragment namentlich erwähnt. Du wirst gleich von allen vier Seiten gefragt werden. Hör dir alles an. Mach alle vier Aufträge. Dann komm zurück zu mir.


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


# Akt-Index 1 — Treuer Diener

## Verifikation des Magistrats

`magistrat_verification` · **NPC:** Ratsherr Aldric · **Kette:** 2

> Beschaffe das ratsgesiegelte Verifikationsdokument für den Magistrat.

- **Ziel:** `fetch` → `verification_seal` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 75 XP · +1 Ansehen (magistrat)

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
- **Belohnung:** 90 XP · +1 Ansehen (klerus)

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
- **Belohnung:** 75 XP · +1 Ansehen (garde)

**Angebot**

> Wenn eine Tochter aus dem Rathaus verschwinden kann, ist das ein Versagen der Garde — und das wird sich ändern. Ich brauche eine Patrouillen-Erweiterung. Heute. Geh in die unteren Kammern und demonstriere Kraft — zehn Störer fallen, das Edikt trägt sich von selbst durch die Strassen.
> 
> Frag nicht, ob die Patrouillen schoner Lebensweise zuträglich sind. Frag nicht, wer entscheidet, wohin sie laufen. Loyalität ist die einzige Münze, die zählt. Das Edikt ist die Münze, die du in meine Hand legst.
> 
> Nimmst du den Auftrag an, Archivschmied?

**Unterwegs**

> Zehn Störer noch. Jeder gefallene Körper ist eine Zeile mehr im Bericht. Die Garde wartet auf das Ergebnis.

**Abschluss**

> Das Edikt ist veröffentlicht. Die Patrouillen verdoppeln sich ab morgen. Niemand wird mehr verschwinden — oder zumindest niemand, der zählt. Die Garde merkt sich, wer schnell antwortet.


## Beweise aus der Ritualkammer

`widerstand_proof` · **NPC:** Elara · **Kette:** 2

> Finde ein verstecktes Ratsdokument in einer Ritualkammer im Rathauskeller.

- **Ziel:** `fetch` → `council_document` ×1
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 100 XP · 1 Wissens-Fragment(e) · +1 Ansehen (widerstand)

**Angebot**

> Du hast also das Fragment gefunden. Gut — dann lebst du nicht mehr ganz in ihrer Erzählung. Aldric will mich zurückholen. Der Klerus will mich verbrennen. Die Garde will mich kassieren.
> 
> Und ich? Ich will dass DU siehst, was ich gesehen habe, bevor du weiter ihre Aufträge erledigst. Unten im Rathauskeller gibt es eine Ritualkammer. Dort liegt ein Dokument, das die drei Ratsfraktionen nie zusammen unterzeichnet haben sollten — und doch ist ihr Siegel darauf. Alle drei.
> 
> Bring es mir. Dann reden wir.

**Unterwegs**

> Such die Ritualkammer. Drei Räume tiefer. Das Dokument ist klein, aber das Siegel darauf wird dir den Atem nehmen.

**Abschluss**

> Drei Siegel. Eine Unterschrift. Magistrat, Klerus, Garde — sie behaupten in der Öffentlichkeit, sie wären Rivalen. Hinter verschlossenen Türen stimmen sie überein. Geh zu Harren. Er wartet auf den Moment, in dem du das verstehst.


## Die geheime Sitzung

`council_collusion_reveal` · **NPC:** Bürgermeister Harren · **Kette:** 3

> Folge Harren zur geheimen Sitzung der drei Ratsfraktionen.

- **Ziel:** `observe` → `collusion_reveal_seen` ×1
- **Vorbedingung:** Verifikation des Magistrats **+** Reinigung der unteren Kammern **+** Patrouillen-Erweiterung **+** Beweise aus der Ritualkammer
- **Belohnung:** 150 XP · 1 Wissens-Fragment(e)

**Angebot**

> Komm mit. Kein Wort, keine Klinge. Was du gleich siehst, kannst du nicht mehr vergessen, auch nicht, wenn der Nebel es versucht.

**Unterwegs**

> Folge mir. Es ist Zeit.

**Abschluss**

> Jetzt hast du es gesehen. Ein Gesicht, drei Masken. Du hast für jede gearbeitet. Du könntest fliehen — aber ein Handwerker, der weiter im Rathaus aus und ein geht, sieht Dinge, die ein Flüchtiger nie sieht. Bleib, wo du bist. Räum weiter für sie, und räum heimlich für uns. Es ist gefährlicher. Es ist auch das Einzige, was nützt.


## Das Edikt der Woche

`faction_campaign` · **NPC:** Ratsherr Aldric · **Kette:** 3

> Plakatiere die drei Fraktions-Edikte an den Anschlagtafeln — sammle 3 Proklamationen.

- **Ziel:** `fetch` → `proclamation` ×3
- **Vorbedingung:** Die verschwundene Tochter
- **Belohnung:** 60 XP · +1 Ansehen (magistrat)

**Angebot**

> Die Stadt muss wissen, wer die Ordnung hält, während die anderen schwatzen. Häng die drei Edikte an den Anschlagtafeln aus. Wer oben klebt, hat recht.

**Unterwegs**

> Noch nicht alle Edikte ausgehängt. Weiter.

**Abschluss**

> Drei Edikte, drei Farben, drei Versionen derselben Tochter. Erst beim letzten fällt dir das Papier auf. Dieselbe Körnung, alle drei. Du hast es in Thoms Druckerei gesehen. Du schiebst den Gedanken beiseite.


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

> Ich bin nicht entführt worden. Ich bin geflohen. Hier — lies das.
> 
> Finde zwei Dokumente, die ich im Keller versteckt habe.

**Unterwegs**

> Die Dokumente sind gut versteckt. Suche weiter.

**Abschluss**

> Jetzt siehst du die Wahrheit. Der Rat hat mich benutzt — für ihre Rituale.
> 
> (Die Abschriften sind in einer ruhigen, geübten Hand. Für etwas, das sie angeblich in Panik im Keller versteckt hat, wirken sie seltsam ordentlich. Du schiebst den Gedanken beiseite.)


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
> (Bevor du sie abgibst, fällt dein Blick auf eine Zeile. Es sind keine Pamphlete. Es sind Gesuche — Bürger, die nach verschwundenen Angehörigen fragen. Du gibst sie trotzdem ab. Mara wird wissen wollen, wer da fragt.)


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
- **Belohnung:** 70 XP · +1 Ansehen (klerus)

**Angebot**

> Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.

**Unterwegs**

> Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.

**Abschluss**

> Du bringst die Namen. (Eine Abschrift steckt schon bei Mara, bevor der Rat die Liste sieht. Wer draufsteht, verschwindet. Aber vielleicht nicht mehr alle. Vielleicht warnt jemand rechtzeitig.)


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

> Du hast es gehört. Keine Vorräte, keine Waffen. Reagenzien, versiegelte Phiolen, Kreidesteine — Ritual-Komponenten. Der Rat schickt keine Patrouille los. Er rüstet eine Beschwörung aus. Gut gemacht, dass du die Klinge stecken liessest.


# Akt-Index 3 — Die Enttarnung

## Verbotene Wahrheiten

`thom_truth` · **NPC:** Setzer Thom · **Kette:** 1

> Finde 5 Druckplatten mit den verbotenen Wahrheiten über den Rat.

- **Ziel:** `fetch` → `print_plate` ×5
- **Vorbedingung:** keine
- **Belohnung:** 100 XP · 20 MAT

**Angebot**

> Ich habe genug gedruckt, was der Rat will. Zeit für die Wahrheit.
> 
> Finde fünf Druckplatten im Keller — sie enthalten die echte Geschichte.

**Unterwegs**

> Die Druckplatten sind irgendwo im Rathauskeller verborgen. Suche weiter.

**Abschluss**

> Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.


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

`garde_night_escort` · **NPC:** Stadtwache · **Kette:** 3

> Sichere verdeckt einen nächtlichen Transport — beobachte die Eskorten-Route.

- **Ziel:** `observe` → `escort_route` ×1
- **Vorbedingung:** keine
- **Belohnung:** 90 XP · +1 Ansehen (garde)

**Angebot**

> Heute Nacht geht ein Transport. Sicher die Route, frag nicht, was drin ist. Loyalität zahlt sich aus.

**Unterwegs**

> Der Transport rollt noch nicht. Halt die Route im Auge, bleib unauffällig.

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

`who_you_were` · **NPC:** Schmiedemeisterin Branka · **Kette:** 4 · **Fortschritt erst ab Tiefe 5**

> Bring Branka drei Splitter deiner alten Akte aus der Tiefe (ab Tiefe 5).

- **Ziel:** `fetch` → `memory_shard` ×3
- **Vorbedingung:** Zweifel der Schmiedin
- **Belohnung:** 150 XP · 1 Wissens-Fragment(e)

**Angebot**

> Ich habe etwas gefunden, das dich betrifft. Eine Akte mit deinem Zeichen, halb vom Nebel gefressen. Bring mir drei Splitter davon aus der Tiefe, dann setzen wir zusammen, wer du warst.

**Unterwegs**

> Die Splitter liegen tief — ab Tiefe 5. Such weiter.

**Abschluss**

> Da bist du. Vor dem Unfall, vor dem Nebel. Du hast nicht immer nur aufgeräumt. Du hast einmal dieselben Fragen gestellt, die du jetzt wieder stellst. Der Nebel hat dich nicht zufällig getroffen. Man hat ihn nach dir geschickt.


## Elaras zweite Wahrheit

`elara_second_truth` · **NPC:** Elara · **Kette:** 4

> Elara zeigt dir, für wen du das Letzte tust.

- **Ziel:** `observe` → `three_hands_seen` ×1
- **Vorbedingung:** Verbotene Wahrheiten **+** Die Ritualkammer
- **Belohnung:** 200 XP · 2 Wissens-Fragment(e)

**Angebot**

> Bevor du das Letzte tust, sollst du wissen, für wen. Komm, nur wir zwei.

**Unterwegs**

> Elara wartet mit den drei Blättern.

**Abschluss**

> Drei Blätter, eine Hand. Elara ist Harrens Tochter, und der Widerstand hat kuratiert, nicht der Rat allein. Nicht Branka, nicht Mara. Sie. Aber sie erfindet nichts, sie wählt aus. Merk dir den Unterschied.


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

`espionage_archive` · **NPC:** Bürgermeister Harren · **Kette:** 7

> Infiltriere verkleidet das Council-Archiv, höre die Schreiber ab und birg den versiegelten Akt.

- **Ziel:** `observe` → `archive_record` ×1
- **Vorbedingung:** Der Konvoi
- **Belohnung:** 110 XP · 1 Wissens-Fragment(e)

**Angebot**

> Im Archiv des Rats liegt ein versiegelter Akt — und ich muss wissen, was darin steht. Geh als Schreiber verkleidet hinein, hör ab, was die anderen flüstern, und birg den Akt. Werde nicht gesehen.
> 
> Tust du das für mich?

**Unterwegs**

> Die Schreiber haben noch nichts Verwertbares gesagt. Bleib im Archiv, unauffällig, und hör weiter ab, bis du an den versiegelten Akt kommst.

**Abschluss**

> Du hast den Akt. "Vermisst, Fall geschlossen" — Elaras Verschwinden, sauber abgelegt, Datum, Siegel, Unterschrift. Zu sauber. Wer in Panik flieht, hinterlässt kein ordentlich abgeheftetes Protokoll. Und das Datum... es liegt vor dem Tag, von dem Harren mir erzählt hat. Ich sage noch nichts. Aber irgendwas an dieser Akte stimmt nicht.


## Der Maulwurf

`espionage_informant` · **NPC:** Mara vom Untergrund · **Kette:** 8

> Enttarne verkleidet einen Council-Maulwurf in den Reihen des Widerstands.

- **Ziel:** `observe` → `informant_id` ×1
- **Vorbedingung:** Das versiegelte Archiv
- **Belohnung:** 120 XP · 1 Wissens-Fragment(e)

**Angebot**

> Jemand verrät uns. Was wir hinter verschlossenen Türen beschliessen, weiss der Rat am nächsten Morgen. Misch dich verkleidet unter unsere eigenen Leute am Treffpunkt und finde heraus, wer der Maulwurf ist. Beweg dich leise — sie kennen dein Gesicht nicht in dieser Montur.
> 
> Findest du den Verräter?

**Unterwegs**

> Noch hast du den Maulwurf nicht. Bleib unauffällig am Treffpunkt und hör ab, wer Nachrichten nach draussen schmuggelt.

**Abschluss**

> Du hast die Übergabe gesehen. Ein gefalteter Zettel, eine Hand, ein Wort — und in der Handschrift derselbe sauber gezogene Bogen wie auf den Belegen, die uns jemand aus dem Inneren des Rats zugespielt hat. Die Spur zeigt nach innen, näher als uns lieb ist. Ich nenne keinen Namen. Aber vertrau ab jetzt niemandem blind — nicht einmal denen, die uns "die Wahrheit" bringen.


# Akt-Index 4 — Der Verrat und die Presse

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

> Steige auf Tiefe 30 hinab und besiege den Schattenrat, der die Quelle des Nebels hält.

- **Ziel:** `boss_kill` → `schattenrat` ×1
- **Vorbedingung:** keine
- **Belohnung:** 250 XP

**Angebot**

> Unter der Stadt sitzt das, dem der Nebel dient, über Rat und Widerstand hinaus. Der Schattenrat hält die Quelle auf Tiefe 30. Steig hinab. Danach entscheidest du, was die Stadt erfährt.

**Unterwegs**

> Der Schattenrat lebt noch, Tiefe 30.

**Abschluss**

> Der Schattenrat ist gefallen, die Quelle liegt offen. Jetzt gehört die Presse dir. Komm hoch, es ist Zeit.


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


## Der Sturm auf den Rat

`mara_assault` · **NPC:** Mara vom Untergrund · **Kette:** 3

> Dringe bis Welle 30 vor, um den Rat zu stürzen.

- **Ziel:** `wave` → `reach_wave` ×30
- **Vorbedingung:** Die Quelle
- **Belohnung:** 300 XP

**Angebot**

> Es ist soweit. Der Rat fällt heute. Dringe bis Welle 30 vor.
> 
> Bist du bereit für den Sturm?

**Unterwegs**

> Der Rat wartet in der Tiefe. Dringe weiter vor — Welle 30.

**Abschluss**

> Der Rat ist gestürzt! Fogreach atmet auf. Aber die Schatten sind noch nicht besiegt...


## Die Abrechnung

`the_reckoning` · **NPC:** Setzer Thom · **Kette:** 6

> Nach dem Sturz des Schattenrats gehört dir die Presse. Entscheide, was die Stadt erfährt.

- **Ziel:** `dialogue` → `press_decision` ×1
- **Vorbedingung:** Die Quelle
- **Belohnung:** 500 XP · schaltet frei: story_ending

**Angebot**

> Die Platten liegen, das Archiv ist entschlüsselt. Was ich setze, liest morgen die ganze Stadt. Es ist Zeit.

**Unterwegs**

> Die Presse wartet.

**Abschluss**

> Der Nebel dünnt aus — nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken. Hart erkämpft, unvollständig, und frei.

