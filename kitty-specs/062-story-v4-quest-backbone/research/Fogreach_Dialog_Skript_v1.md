# Fogreach — Dialog- und Szenen-Skript (v1, alle Akte)

_Das erzählerische Fleisch auf dem Gerüst der Bibel v4 und der Migration v4. Enthält die vollen Gespräche, die Szenen als Skript, die Hub-Momente und die Mikro-Reaktivität. Erster spielbarer Entwurf._

**Legende**
`FIGUR:` gesprochene Zeile. `[Spieler: ...]` wählbare Antwort. `(Regie: ...)` Inszenierung, Kamera, Trigger. `{flag}` gesetzter oder gelesener Flag. **DOPPEL** markiert die Doppelagenten-Tonspur. Umlaute im Skript zur Lesbarkeit, im Spiel nach Deinem Encoding.

---

# AKT 0 — Der Dienst

_Ton: alltäglich, beengt, kein Verdacht. Der Nebel ist Wetter. Du bist ein Handwerker mit einem Job._

## Hub-Einstieg

(Regie: Erster Betritt der Archivschmiede. Branka am Amboss, sieht kurz auf.)

BRANKA: Wieder da. Gut. Der Rat schickt Arbeit schneller, als ich sie wegräumen kann.
BRANKA: Du siegelst Akten, an die Du Dich am naechsten Tag nicht erinnerst. Ist Dir das nie unheimlich?
[Spieler: Der Nebel nimmt jedem etwas.] → BRANKA: Jedem. Nur nimmt er manchen mehr. Pass auf Dich auf.
[Spieler: Ich denke nicht darueber nach.] → BRANKA: Nein. Das tut hier keiner. Das ist ja das Problem.

## resistance_fetch_01 — Botengang fuer die Resistance  [Elara · A0]

**Angebot**
ELARA: (aus dem Halbdunkel) Nicht erschrecken. Ich kenne Dich, auch wenn Du mich nicht kennst.
ELARA: Im Keller liegt ein Buendel, versiegelt. Bring es mir, ohne dass jemand sieht. Kannst Du das?
[Spieler: Wer bist Du?] → ELARA: Jemand, der aufhebt, was der Rat verschwinden lassen will. Mehr spaeter.
[Spieler: Was ist drin?] → ELARA: Nichts, das Dich in Gefahr bringt. Noch nicht. Geh.
**Unterwegs:** Das Buendel liegt tiefer. Raeum die Wachen weg, wenn sie im Weg sind.
**Abschluss**
ELARA: Du hast es, und niemand hat Dich gesehen. Gut. Die Resistance vergisst so etwas nicht. Wir sehen uns wieder, Archivschmied.

## aldric_cleanup — Saeuberung der Keller  [Aldric · A0]

**Angebot**
ALDRIC: Wilde Tiere in den Kellern. Zehn Stueck, schaetze ich. Raeum sie aus, sauber und leise.
**Unterwegs:** Die Keller sind noch nicht sicher. Weiter.
**Abschluss**
ALDRIC: Gut. Die Keller sind gesaeubert. Der Magistrat weiss Verlaesslichkeit zu schaetzen.

## aldric_patrol — Keller-Patrouille  [Aldric · A0]

**Angebot**
ALDRIC: Drei Gaenge, ungesichert. Geh durch, stell sicher, dass nichts nachkommt.
**Unterwegs:** Noch nicht alle Gaenge sicher.
**Abschluss**
ALDRIC: Alle Gaenge sicher. Ordentliche Arbeit.

## harren_daughter_investigation — Die verschwundene Tochter  [Harren · A0 → Trigger Akt 1]

**Angebot**
HARREN: Meine Tochter ist verschwunden. Aldric sagt Entfuehrung, der Klerus Besessenheit, die Garde Pflichtversaeumnis.
HARREN: Ich glaube keinem der drei. Und Du bist der Einzige, der da unten aufraeumt, ohne zu fragen. Vielleicht hast Du selbst schon Akten ueber sie versiegelt, ohne es zu wissen. Der Nebel nimmt uns allen etwas.
HARREN: Bring mir das Tagebuchfragment, das sie zurueckliess. Vertrau niemandem, bis Du es selbst gelesen hast. Auch mir nicht.
[Spieler: Warum ich?] → HARREN: Weil Du keiner Fraktion gehoerst. Noch nicht.
[Spieler: Was, wenn es schlecht aussieht fuer Dich?] → HARREN: Dann will ich es trotzdem wissen. Ein Vater will die Wahrheit, nicht den Trost.
**Unterwegs:** Such weiter. Oben streiten sie, weil jeder eine andere Version hoeren will. Du findest die echte.
**Abschluss**
HARREN: Du hast es. (liest, wird still) Sie ist nicht entfuehrt worden. Sie ist geflohen. Und alle drei Ratsfraktionen stehen namentlich drin.
HARREN: Gleich fragen Dich alle vier nach ihr. Hoer Dir alles an. Mach alle vier Auftraege. Dann komm zurueck zu mir. {advanceAct 1}

---

# AKT 1 — Treuer Diener

_Ton: der Wahlkampf, drei Farben, drei Wahrheiten. Du dienst, ahnungslos komplizenhaft. Endet im Kipp._

## Hub-Momente (Wahlkampf, Phase 1)

(Regie: Anschlagtafeln in Grau, Weiss, Rot. NPCs sticheln, wenn angesprochen.)

ALDRIC: Die Garde loest jedes Problem mit mehr Patrouillen und keines mit einem Gedanken. Und wer Besessenheit ruft, muss nichts beweisen.
PRIESTER: Aldric zaehlt Papiere und nennt es Ordnung. Als ob sich eine Seele abheften liesse.
STADTWACHE: Waehrend die anderen reden, verschwindet eine Tochter aus dem Rathaus. Wer war zur Stelle? Niemand. Das aendert sich.

## magistrat_verification — Verifikation des Magistrats  [Aldric · A1]

**Angebot**
ALDRIC: Du hast das Fragment gesehen. Dann weisst Du, dass die Tochter neu klassifiziert werden muss. Von geflohen zu vermisster Person von Interesse. Reine Verwaltungsangelegenheit.
ALDRIC: Trag das Dokument zu Branka und setz das Ratssiegel. Sie wird Fragen stellen. Beantworte sie nicht.
**Unterwegs:** Das Dokument wird in der Schmiede gefertigt. Branka kennt das Verfahren.
**Entscheidung** (Regie: an der Werkbank, Siegel in der Hand)
BRANKA: Weisst Du, was das Wort bedeutet, das Du gerade festmachst? Person von Interesse. So nennen sie die, die danach niemand mehr sieht.
BRANKA: Setz das Siegel, wenn Du musst. Aber setz es mit offenen Augen.
[Spieler: Siegel setzen] {verification_sealed} → ALDRIC (spaeter): Das Dokument ist im Archiv. Was das in der Praxis bedeutet, geht Dich nichts an. Der Magistrat dankt Dir.
[Spieler: Verweigern] {verification_refused} → ALDRIC (spaeter): Ein Handwerker mit Gewissen. Ich merke mir das. Branka siegelt es dann eben selbst. Geaendert hat sich nichts, ausser dass ich jetzt weiss, wo Du stehst.

## klerus_purification — Reinigung der unteren Kammern  [Priester · A1 · ab Tiefe 3]

**Angebot**
PRIESTER: Die Tochter floh nicht aus eigenem Willen. Eine dunkle Hand fuehrte sie. Die unteren Kammern bersten vor solchen Schatten.
PRIESTER: Drei ihrer Anfuehrer lauern tiefer als die ersten Gaenge, ab Tiefe 3. Faell sie im Namen der Ordnung.
**Unterwegs:** Die Anfuehrer lauern tief, erst ab Tiefe 3. Jede Ketzerei, die Du beendest, oeffnet einen Pfad zur Reinheit.
**Abschluss**
PRIESTER: Du hast die Ketzerei geschlagen. Die Ordnung bleibt, durch Dich. Der Klerus segnet Deine Hand.

## garde_patrol_expansion — Patrouillen-Erweiterung  [Stadtwache · A1]

**Angebot**
STADTWACHE: Wenn eine Tochter aus dem Rathaus verschwinden kann, ist das ein Versagen der Garde. Das aendert sich heute. Zehn Stoerer fallen, das Edikt traegt sich von selbst durch die Strassen.
STADTWACHE: Frag nicht, wer entscheidet, wohin die Patrouillen laufen. Loyalitaet ist die einzige Muenze, die zaehlt.
**Unterwegs:** Zehn Stoerer noch. Jeder gefallene Koerper ist eine Zeile mehr im Bericht.
**Abschluss**
STADTWACHE: Das Edikt ist veroeffentlicht. Die Patrouillen verdoppeln sich ab morgen. Niemand verschwindet mehr, oder zumindest niemand, der zaehlt.

## widerstand_proof — Beweise aus der Ritualkammer  [Elara · A1]

**Angebot**
ELARA: Du hast das Fragment gefunden. Dann lebst Du nicht mehr ganz in ihrer Erzaehlung. Aldric will mich zurueck, der Klerus will mich verbrennen, die Garde will mich kassieren.
ELARA: Ich will, dass DU siehst, was ich gesehen habe. Unten liegt ein Dokument, das die drei Fraktionen nie zusammen unterzeichnet haben sollten. Und doch traegt es alle drei Siegel. Bring es mir.
**Unterwegs:** Die Kammer liegt drei Raeume tiefer. Das Dokument ist klein, aber das Siegel nimmt Dir den Atem.
**Abschluss**
ELARA: Drei Siegel, eine Unterschrift. In der Oeffentlichkeit Rivalen, hinter verschlossenen Tueren einig. Geh zu Harren. Er wartet auf den Moment, in dem Du das verstehst.

## faction_campaign — Das Edikt der Woche  [Aldric / Fraktionen · A1 · optional]

**Angebot**
ALDRIC: Die Stadt muss wissen, wer die Ordnung haelt, waehrend die anderen schwatzen. Haeng die drei Edikte an den Anschlagtafeln aus. Wer oben klebt, hat recht.
(Regie: waehrend des Plakatierens Zwischenrufe)
PRIESTER: Papier ueber Papier, und kein Wort rettet eine Seele. Haeng unseres darueber.
STADTWACHE: Reden koennen alle. Kleb das Edikt der Garde ganz oben.
**Entscheidung**
[Spieler: Magistrat oben] {rep magistrat+} / [Klerus oben] {rep klerus+} / [Garde oben] {rep garde+}
(Regie: Wahl verschiebt nur Ansehen, oeffnet keinen Weg.)
**Abschluss**
(Regie: Spieler streicht das letzte Plakat glatt.) Drei Edikte, drei Farben, drei Versionen derselben Tochter. Erst beim letzten faellt Dir das Papier auf. Dieselbe Koernung, alle drei. Du hast es in Thoms Druckerei gesehen. Du schiebst den Gedanken beiseite.

## SZENE: Die geheime Sitzung  [council_collusion_reveal · Harren · A1 → Trigger Akt 2]

**Angebot**
HARREN: Komm mit. Kein Wort, keine Klinge. Was Du gleich siehst, kannst Du nicht mehr vergessen, auch nicht, wenn der Nebel es versucht.

**Die Szene**
(Regie: Empore ueber dem Ratssaal. Enges Sichtfeld durch ein Gelaender. Der Spieler kann sich bewegen, aber nicht handeln, eine Fortschrittsleiste "Zuhoeren" fuellt sich mit jeder gehoerten Zeile. Unten drei Baenke, Grau, Weiss, Rot, weit auseinander.)

ALDRIC: (steht auf, nicht als Ratsherr, als Vorsitzender) Die Tueren sind zu. Legt es ab.
(Regie: Der Priester faltet die weisse Stola weg wie ein Handtuch. Der Offizier lockert den Kragen. Die Distanz zwischen den Baenken wirkt ploetzlich laecherlich.)
PRIESTER: Der Handwerker hat gesiegelt. Person von Interesse.
ALDRIC: Dann ist die Tochter verwaltet. Naechster Punkt.

(Regie: wenn {verification_sealed})
HARREN: (sehr leise, neben Dir) Das warst Du. Dein Siegel. Ich sage es nur, damit Du es weisst.
(Regie: wenn {verification_refused})
HARREN: (sehr leise) Du hast Dich geweigert. Es hat nichts geaendert. Merk Dir das Gefuehl. Es wird wichtig.

(Regie: Der Offizier legt ein Blatt in die Mitte. Alle drei beugen sich darueber, unterschreiben, drei Siegel untereinander. Ruhige, geuebte Bewegungen.)
PRIESTER: Und die Rivalitaet nach aussen?
ALDRIC: Bleibt. Sie ist das Beste, was wir haben. Solange die Stadt glaubt, wir stritten, glaubt sie, sie habe eine Wahl. Der Nebel nimmt die Erinnerung. Der Streit nimmt den Verdacht. Zusammen nehmen sie alles.
(Regie: Aldric hebt den Kopf, scheint direkt zur Empore zu sehen. Harrens Hand druckt fest auf Deine Schulter. Kurzer Standbild-Moment, Herzschlag im Ton.)
ALDRIC: Der Handwerker fragt bald. Sie fragen alle irgendwann. Dann raeumen wir ihn weg wie die anderen. Aber noch raeumt er fuer uns.
(Regie: Leiste voll. Ausblende.)

**Abschluss (Weiche ins Doppelspiel)**
HARREN: Jetzt hast Du es gesehen. Ein Gesicht, drei Masken. Du hast fuer jede gearbeitet.
[Spieler: Dann breche ich mit ihnen. Jetzt.] → HARREN: Nein. Ein Fluechtiger sieht nichts mehr. Ein Handwerker, der weiter aus und ein geht, sieht alles.
[Spieler: Was soll ich tun?] → HARREN: (siehe unten)
HARREN: Bleib, wo Du bist. Raeum weiter fuer sie, und raeum heimlich fuer uns. Es ist gefaehrlicher. Es ist auch das Einzige, was nuetzt. Trau nicht dem Ersten, der Dir eine Antwort schenkt. Antworten sind hier eine Ware. {advanceAct 2}

---

# AKT 2 — Das Doppelspiel

_Ton: zwei Gesichter. Aussen gehorsam, innen Verrat am Rat. Dieselben Zeichen, neu gelesen. Aldrics Verdacht keimt._

## Hub-Momente (Phase 2, hohler Wahlkampf)

(Regie: ein Buerger haelt Dich am Aermel)
BUERGER: Sag Du es mir, Du kennst den Rat von innen. Wem soll ich glauben, dem Magistrat oder der Garde? Ich will nur, dass mein Sohn wiederkommt.
[Spieler: Keinem von beiden.] {truth_told} → BUERGER: (starrt Dich an) Das ist keine Antwort, die einem Vater hilft.
[Spieler: (schweigen)] → (Regie: Du gehst weiter. Es gibt keine Antwort, die ihm hilft.)

(Regie: am Anschlagbrett klebt ein Garde-Edikt ueber einem Magistrat-Edikt. Ein Plakatierer wendet seinen Karren, darin liegen alle drei Farben nebeneinander. Ein Karren. Ein Mann. Drei Farben.)

## council_seizure — Beschlagnahme  [Aldric · A2 · DOPPEL]

**Angebot**
ALDRIC: Im Keller hortet Gesindel subversive Schriften. Drei Buendel. Lies sie nicht, bring sie.
**Unterwegs:** Noch nicht alle sichergestellt.
**Entscheidung** (Regie: beim Abgeben faellt der Blick auf eine Zeile)
Es sind keine Pamphlete. Es sind Gesuche. Buerger, die nach verschwundenen Angehoerigen fragen. Niemand zaehlt sie nach.
[Spieler: Abgeben] {petitions_surrendered} → Du gibst sie ab.
[Spieler: Heimlich behalten] {petitions_kept} → **DOPPEL** Du steckst sie ein. Mara wird wissen wollen, wer da fragt.
**Abschluss**
ALDRIC: Gib her. (nimmt das Buendel, waegt es kurz) Leichter, als ich dachte. (sieht Dich an) Oder taeusche ich mich?
[Spieler: Es war alles da.] {wenn petitions_kept: Luege} → ALDRIC: Hm. (laesst es gehen, diesmal)

## council_surveillance — Ueberwachung  [Aldric · A2 · DOPPEL]

**Angebot**
ALDRIC: Ein Bezirk gilt als aufsaessig. Sichte drei Bereiche, melde, wer sich zusammenrottet.
**Unterwegs:** Noch nicht alle Bereiche gesichtet.
**Abschluss** **DOPPEL**
Bericht angenommen. (Du hast keine Verschwoerer gesehen, nur Familien, die Brot teilen und leise zaehlen, wer als Naechstes nicht heimkam. Zwei Namen weniger auf dem Bericht, als Du gesehen hast. Zwei, die noch eine Weile leben.)

## klerus_district_purge — Reinigung eines Bezirks  [Priester · A2 · NEU · DOPPEL]

**Angebot**
PRIESTER: Ein Bezirk ist befallen. Reinige ihn. Wer das Licht scheut, hat etwas zu verbergen. Bring mir die Namen der Befallenen.
[Spieler: Und wenn sie unschuldig sind?] → PRIESTER: Unschuld ist eine Frage des Lichts, nicht Deine. Bring die Namen.
**Unterwegs:** Noch nicht gereinigt. Die Befallenen zeigen sich in der Tiefe.
**Abschluss** **DOPPEL**
Du bringst die Namen. (Eine Abschrift steckt schon bei Mara, bevor der Rat die Liste sieht. Wer draufsteht, verschwindet. Aber vielleicht nicht mehr alle. Vielleicht warnt jemand rechtzeitig.)

## mara_contact — Die Spaeherin  [Mara · A2]

**Angebot**
MARA: Du erinnerst Dich nicht an mich. Aber ich an Dich. Du warst Archivschmied, bevor der Nebel Dir die Erinnerung nahm, und Du hast Fragen gestellt, die der Rat begraben wollte.
MARA: Bevor ich Dir mein Netzwerk oeffne, will ich sehen, ob Du noch sehen kannst. Kundschafte drei Kellerraeume aus. Praeg Dir ein, was der Rat versteckt.
[Spieler: Ich habe Fragen gestellt? Frueher?] → MARA: Und wie. Vielleicht hat der Nebel Dich deshalb geholt. Denk drueber nach.
**Unterwegs:** Drei Raeume. Und praeg Dir jeden ein.
**Abschluss**
MARA: Drei Raeume, in jedem dasselbe. Leere Zellen, frische Ketten, Listen mit Namen. Die Vermissten verschwinden nicht zufaellig, der Rat laesst sie verschwinden, und jede Fraktion deckt die andere.
MARA: Jetzt weiss ich, dass Du noch der Alte bist. Mein Netzwerk steht Dir offen.

## elara_meeting — Elaras Geheimnis  [Elara · A2 · unlock elara_trust]

**Angebot**
ELARA: Ich bin nicht entfuehrt worden. Ich bin geflohen. Hier, lies das. Finde die zwei Dokumente, die ich im Keller versteckt habe.
**Unterwegs:** Sie sind gut versteckt. Such weiter.
**Abschluss** {elara_trust}
ELARA: Jetzt siehst Du. Der Rat hat mich benutzt, fuer seine Rituale.
(Regie: die Abschriften sind in einer ruhigen, geuebten Hand. Fuer etwas, das sie angeblich in Panik versteckte, wirken sie seltsam ordentlich. Du schiebst den Gedanken beiseite.)
[Spieler: Deine Handschrift ist sehr sauber fuer eine Flucht.] → ELARA: (haelt kurz inne) Ich war immer ordentlich. Auch, wenn ich Angst hatte. (Etwas an ihrem Blick bleibt.)

## branka_doubt — Zweifel der Schmiedin  [Branka · A2]

**Angebot**
BRANKA: Diese Ruestungen sind fuer Gefangene, nicht fuer Soldaten. Hilf mir, Beweise zu finden. Faell fuenf Elite-Wachen und bring mir ihre Befehle.
**Unterwegs:** Die Elite-Wachen tragen die Beweise bei sich.
**Abschluss**
BRANKA: Ich hatte recht. Der Rat baut Gefaengnisse, keine Kasernen. Wir muessen handeln.

## branka_transcripts — Verbotene Abschriften  [Branka · A2]

**Angebot**
BRANKA: Im Keller lagern Protokolle aus Verhoeren. Nicht von Daemonen, von Menschen. Bring mir zwei Abschriften. Vorsichtig.
**Unterwegs:** Die Protokolle liegen tief.
**Abschluss**
BRANKA: Lies das. Befragt bis zum Gestaendnis. Der Rat verhoert Buerger wie Beschworene. Das ist kein Schutz, das ist Jagd.

## espionage_convoy — Der Konvoi  [Mara · A2]

**Angebot**
MARA: Heute Nacht entladen sie im alten Lagerhaus einen Konvoi. Zieh die Wachuniform an, bleib im Schatten und hoer zu. Zieh keine Klinge, sonst fliegt die Verkleidung auf.
**Unterwegs:** Noch nicht nah genug. Misch Dich unter die Wachen, unentdeckt.
(Regie: wird die Tarnung durch Kampf gebrochen, {convoy_blade_drawn})
**Abschluss**
MARA: Du hast es gehoert. Keine Vorraete, keine Waffen. Reagenzien, versiegelte Phiolen, Kreidesteine. Ritual-Komponenten. Der Rat ruestet keine Patrouille aus, er ruestet eine Beschwoerung aus.
(Regie: wenn {convoy_blade_drawn}) MARA: Und Du hast eine Klinge gezogen. Zwei Wachen weniger, aber jetzt wissen sie, dass jemand horcht. Das kostet uns.

## mara_warning — Maras Warnung  [Mara · A2 → Trigger Akt 3 · Boss Kettenmeister T10]

**Angebot**
MARA: Der Kettenmeister haelt die Siegel auf Tiefe 10. Er fesselt, was er fangen will. Faell ihn, dann haben wir den ersten harten Beweis.
**Unterwegs:** Der Kettenmeister lebt noch, Tiefe 10. Wenn er Dich kettet, schlag die Kette, sonst haelt er Dich.
(Regie Boss: in Abstaenden kettet er den Spieler an Wand oder Boden. Bewegung blockiert, Kette in mehreren Treffern zerschlagen, waehrend er zuschlaegt. Thema: ergriffen werden.)
**Abschluss**
MARA: Der Kettenmeister ist gefallen, die Beweise gesichert. Jetzt kann niemand mehr leugnen, dass der Rat Menschen verarbeitet. {advanceAct 3}

---

# AKT 3 — Die Enttarnung

_Ton: die Naehe zu Elara waechst, der erste Riss zeigt sich, der Reveal, und am Ende fliegt Deine Tarnung auf. Der laengste, dichteste Akt._

## verseuchte_kammer — Die verseuchte Kammer  [Aldric · A3 · DOPPEL]

**Angebot**
ALDRIC: Eine untere Kammer ist verseucht, Ketzerei. Reinige sie. Frag nicht, was Du findest. Geh.
**Unterwegs:** Die Kammer liegt tiefer.
**Abschluss** **DOPPEL**
Du stehst in der Kammer. Blut, Symbole, Ketten, und kein Ketzer weit und breit. Das ist keine Verseuchung. Das ist eine Beschwoerungskammer. Aldric hat Dich hergeschickt, um seine eigene Spur zu verwischen. (Du praegst Dir jedes Symbol ein. Mara soll das sehen. Und Aldric soll glauben, Du haettest nur geputzt.)

## garde_night_escort — Nachteskorte  [Stadtwache · A3 · NEU · DOPPEL]

**Angebot**
STADTWACHE: Heute Nacht geht ein Transport. Sicher die Route, frag nicht, was drin ist. Loyalitaet zahlt sich aus.
**Unterwegs:** Der Transport rollt noch nicht. Halt die Route im Auge, bleib unauffaellig.
**Abschluss** **DOPPEL**
Die Route ist sicher. (Und in Deinem Kopf, Weg, Zeit und Fracht, bereit fuer Mara. Es waren keine Waffen. Es waren dieselben Phiolen wie im Konvoi.)

## espionage_archive — Das versiegelte Archiv  [Harren · A3]

**Angebot**
HARREN: Im Archiv liegt ein versiegelter Akt, und ich muss wissen, was drin steht. Geh als Schreiber verkleidet hinein, hoer ab, birg den Akt. Werde nicht gesehen.
**Unterwegs:** Die Schreiber haben nichts Verwertbares gesagt. Bleib unauffaellig.
**Abschluss**
HARREN: Du hast den Akt. Vermisst, Fall geschlossen. Meine Tochter, sauber abgelegt, Datum, Siegel, Unterschrift. Zu sauber. Wer in Panik flieht, hinterlaesst kein ordentlich abgeheftetes Protokoll. Und das Datum liegt vor dem Tag, von dem ich Dir erzaehlt habe.
HARREN: Ich sage noch nichts. Aber irgendetwas an dieser Akte stimmt nicht.

## espionage_informant — Der Maulwurf  [Mara · A3 · setzt mole_evidence]

**Angebot**
MARA: Jemand verraet uns. Was wir hinter verschlossenen Tueren beschliessen, weiss der Rat am naechsten Morgen. Misch Dich verkleidet unter unsere eigenen Leute und finde den Maulwurf.
**Unterwegs:** Noch nicht gefunden. Hoer ab, wer Nachrichten nach draussen schmuggelt.
**Abschluss** {mole_evidence}
Du hast die Uebergabe gesehen. Ein gefalteter Zettel, eine Hand, ein Wort. Und in der Handschrift derselbe sauber gezogene Bogen wie auf den Belegen, die uns jemand aus dem Inneren des Rats zuspielt. Und wie auf Elaras Abschriften.
MARA: Die Spur zeigt nach innen, naeher, als uns lieb ist. Ich nenne keinen Namen. Aber vertrau ab jetzt niemandem blind. Nicht einmal denen, die uns die Wahrheit bringen.

## thom_truth — Verbotene Wahrheiten  [Thom · A3]

**Angebot**
THOM: Ich habe genug gedruckt, was der Rat will. Zeit fuer die Wahrheit. Finde fuenf Druckplatten im Keller, sie enthalten die echte Geschichte.
**Unterwegs:** Die Platten sind verborgen.
**Abschluss**
THOM: Diese Platten enthalten Beweise, die der Rat vernichten wollte. Wenn die Zeit kommt, geht die Wahrheit in Druck. Und dann liest sie die ganze Stadt.

## elara_ritual — Die Beschwoerungskammer  [Elara · A3 · Boss Zeremonienmeister T20]

**Angebot**
ELARA: Tief unten ist die Beschwoerungskammer des Rats. Sie wird vom Zeremonienmeister gehalten, dem Meister der verbotenen Rituale. Steig auf Tiefe 20 und faell ihn.
**Unterwegs:** Der Zeremonienmeister haelt die Kammer. Auf Tiefe 20. Solange er lebt, kommst Du nicht an die Wahrheit.
(Regie Boss: er loescht Arena-Sektoren mit Nebel, laesst bereits getoetete Gegner einmalig zurueckkehren, weil vergessen, stoert kurz eine Deiner Faehigkeiten. Vorspiel auf Elaras Nebelgriff.)
**Abschluss**
ELARA: Der Zeremonienmeister ist gefallen. Du hast sie gefunden, die Beschwoerungskammer. Nimm dieses Amulett, es schuetzt vor ihrer dunklen Magie.

## elara_blade — Elaras Geschenk  [Elara · A3]

**Angebot**
ELARA: Nimm das. Ich habe es fuer Dich geschmiedet. Fuer den Fall, dass.
[Spieler: Fuer welchen Fall?] → ELARA: (zoegert) Fuer jeden. Man weiss nie, wer am Ende vor einem steht.
**Abschluss**
ELARA: Moege sie Dich beschuetzen. Egal, was kommt. (Sie haelt Deinen Blick einen Moment zu lang.)

## SZENE: Elara-Lager  [optionaler Ruhemoment, A3]

(Regie: kein Auftrag. Feuer, Nacht in der Druckerei. Elara setzt sich zu Dir.)
ELARA: (legt etwas Kleines, Abgegriffenes hin, Dein Zeichen darauf) Das lag in Deiner alten Werkstatt, bevor der Nebel Dich holte. Ich habe es aufgehoben. Ich weiss nicht, warum.
ELARA: Vielleicht, weil ich wusste, dass eines Tages nichts mehr von Dir uebrig ist, wenn niemand etwas aufhebt.
[Spieler: Wer war ich?] → ELARA: Jemand, der nicht aufhoeren konnte zu fragen. Wie jetzt. Frag Branka, sie weiss mehr.
[Spieler: Warum tust Du das?] → ELARA: (leise) Ich habe Angst, Archivschmied. Nicht vor dem Rat. Davor, das Falsche zu werden, wenn das hier vorbei ist. Jemand muss danach entscheiden, was die Stadt erfaehrt. Und ich vertraue niemandem damit. Nicht einmal mir.
(Regie: Diese Szene legt die Naehe, den Keim ihres Falls und die Intimitaet, die ihr Nebelgriff im Finale treffen wird.)

## SZENE: Elaras erster Riss  [A3, ausgeloest nach elara_second_truth-Vorstufe]

(Regie: ein Bote bringt Elara eine Meldung. Sie liest, faltet das Blatt weg.)
ELARA: Das kommt nicht in die Presse.
[Spieler: Was steht drin?] → ELARA: Einer von uns hat im Suff jemanden verraten. Ein Guter. Es wuerde die Bewegung spalten.
[Spieler: Es ist wahr.] → ELARA: Vieles ist wahr. Nicht alles hilft. Frag Dich, wem es nuetzt, bevor Du es druckst.
(Regie: Es ist derselbe Satz, den ein Ratsherr sagen wuerde. Du schiebst den Gedanken beiseite. Noch.)

## SZENE: Elaras zweite Wahrheit  [elara_second_truth · A3 · Teil-Reveal]

**Angebot**
ELARA: Bevor Du das Letzte tust, sollst Du wissen, fuer wen. Komm, nur wir zwei.
**Die Szene**
(Regie: Elara legt drei Blaetter nebeneinander. Das Tagebuchfragment, den Ratsakt, einen Widerstands-Beleg.)
ELARA: Sieh Dir die Handschrift an. Alle drei.
(Regie: Es ist dieselbe Hand. Derselbe sauber gezogene Bogen.)
ELARA: Harren ist mein Vater. Ich bin nicht entfuehrt worden und nicht besessen. Ich bin gegangen, als ich verstand, dass es keine zwei Seiten gibt, die um die Wahrheit ringen. Es gibt einen Apparat, der sie herstellt. Ich habe eine Weile fuer beide geschrieben. Diese Hand, das bin ich.
[Spieler: Dann bist Du nicht besser als der Rat.] → ELARA: Doch. Ich erfinde nichts. Ich waehle aus. Merk Dir den Unterschied, er ist alles.
[Spieler: Warum sagst Du mir das?] → ELARA: Weil Du gleich die Presse in der Hand hast. Und weil auch ich Dir etwas verkaufen wuerde, wenn Du mich laesst. Frag Dich, ob Du das willst.
**Abschluss**
Drei Blaetter, eine Hand. Der Rat hat gelogen, der Widerstand hat kuratiert. Und der Widerstand hat einen Namen. Nicht Branka, nicht Mara, nicht Thom, die meinen es ehrlich und wissen von nichts. Sie.

## who_you_were — Wer Du warst  [Branka · A3 · optional · setzt self_remembered]

**Angebot**
BRANKA: Ich habe etwas gefunden, das Dich betrifft. Eine Akte mit Deinem Zeichen, halb vom Nebel gefressen. Bring mir drei Splitter davon aus der Tiefe, dann setzen wir zusammen, wer Du warst.
**Unterwegs:** Die Splitter liegen tief. Such weiter.
**Abschluss** {self_remembered}
BRANKA: Da bist Du. Vor dem Unfall, vor dem Nebel. Du hast nicht immer nur aufgeraeumt. Du hast einmal dieselben Fragen gestellt, die Du jetzt wieder stellst. Der Nebel hat Dich nicht zufaellig getroffen. Man hat ihn nach Dir geschickt.

## SZENE: Der Bruch  [bruch_confrontation · Branka · A3 → Trigger Akt 4]

**Angebot**
BRANKA: Aldric weiss es. Dein Doppelspiel ist aufgeflogen. Seine Elite-Wachen riegeln die tiefen Gaenge ab, ab Tiefe 8 stellst Du sie. Schlag Dich durch und komm zu mir.
(Regie: unterwegs Funksprueche oder Rufe der Wachen, die zeigen, dass Aldric persoenlich die Jagd leitet.)
**Unterwegs:** Aldrics Elite-Wachen halten die Tiefe. Ab Tiefe 8 stellst Du sie.
**Abschluss**
(Regie: Branka verriegelt die Tuer hinter Dir. Draussen Schritte.)
BRANKA: Du blutest. Setz Dich.
BRANKA: Er hat gesagt, Du stellst zu viele Fragen. Jetzt stellst Du gar keine mehr, Du weisst es ja. Die Tarnung ist verbrannt.
[Spieler: Es gibt kein Zurueck mehr.] → BRANKA: Nein. Aber es gibt ein Nach vorn. Mara, Thom, ich, wir sind bereit.
[Spieler: Was ist mit Elara?] → BRANKA: Sie fuehrt uns an. Ohne sie waeren wir nichts. (Regie: Du sagst nichts. Du hast die drei Blaetter gesehen.) {advanceAct 4}

---

# AKT 4 — Der Verrat und die Presse

_Ton: Abstieg zur Quelle, dann die Abrechnung. Alles laeuft zusammen. Der Vatermord. Ein Ende, vier Regler._

## branka_weapons — Waffen fuer den Widerstand  [Branka · A4]

**Angebot**
BRANKA: Wir brauchen Waffen. Nicht fuer den Rat, fuer UNS. Stell drei Gegenstaende in der Schmiede her.
**Unterwegs:** Die Schmiede wartet.
**Abschluss**
BRANKA: Gut geschmiedet. Diese Waffen machen den Unterschied.

## thom_pamphlets — Die Pamphlete  [Thom · A4 · ab Tiefe 22]

**Angebot**
THOM: Die oberen Gaenge lesen unsere Wahrheit schon. Jetzt brauchen wir die Tiefe. Schliess drei Durchlaeufe ab Tiefe 22 ab, und ganz Fogreach liest mit.
**Unterwegs:** Nur tiefe Durchlaeufe zaehlen, ab Tiefe 22.
**Abschluss** {xp_bonus_10}
THOM: Die ganze Stadt liest unsere Wahrheiten. Die Buerger sind aufgewacht.

## schattenrat_finale — Die Quelle  [Harren · A4 · Boss Schattenrat T30]

**Angebot**
HARREN: Unter der Stadt sitzt das, dem der Nebel dient, ueber Rat und Widerstand hinaus. Der Schattenrat haelt die Quelle auf Tiefe 30. Steig hinab. Danach entscheidest Du, was die Stadt erfaehrt.
[Spieler: Und Deine Tochter?] → HARREN: (lange Pause) Bring mir Wahrheit. Auch die. Ein Vater will wissen, nicht traeumen.
**Unterwegs:** Der Schattenrat lebt noch, Tiefe 30.
(Regie Boss: die Quelle, kein Mensch, geformt aus aller weggegebenen Erinnerung der Stadt. Greift Fesselung und Ausloeschung der Vorgaenger auf. Beim Sieg loest sich kein Koerper, sondern ein Chor aus Stimmen, die verstummen.)
**Abschluss**
HARREN: Der Schattenrat ist gefallen, die Quelle liegt offen. Jetzt gehoert die Presse Dir. Komm hoch, es ist Zeit.

## SZENE: Die Abrechnung  [the_reckoning · Thom · A4 → schaltet story_ending]

**Vorlauf**
THOM: Die Platten liegen, das Archiv ist entschluesselt. Was ich setze, liest morgen die ganze Stadt.
(Regie: Elara tritt ein. Sie ist nicht gekommen, um zu gratulieren.)

**Elaras Wende**
ELARA: Du willst alles drucken. Roh. Auch, dass wir schmutzig waren, dass ich fuer beide Seiten schrieb, dass unser Sieg auf Auswahl steht. Und dann zerfaellt die Stadt in tausend Wahrheiten, und keiner haelt sie zusammen. Ich habe das gesehen, ein halbwahres Geruecht hat einen Bezirk zerrissen. Ich lasse es nicht zu.
ELARA: Ich drucke eine Wahrheit, mit der die Stadt leben kann. Und dann bleibt nur noch einer, der das ganze Bild traegt, unversehrt. Du.
ELARA: Der Nebel wird sanft sein. Du wirst es nicht einmal merken. Es tut mir leid.
(Regie: Sie greift zur Nebelschleuse unter dem Druckraum.)

**Der Vatermord** {harren_dead}
(Regie: Harren tritt aus dem Schatten. Er hat alles gehoert. Stellt sich zwischen sie und den Hebel, zwischen sie und Dich.)
HARREN: Nein. Nicht das. Nicht Du.
(Regie: Fuer einen Herzschlag ist sie wieder die Tochter. Dann bedroht er das Einzige, wofuer sie alles opferte. Sie handelt, bevor sie denkt. Schnell, nicht geplant. Danach steht sie ueber ihm, die eigene Hand fremd.)
ELARA: (tonlos) Ich wollte das nicht. Ich wollte das nie.

**Die Wahl** (Regie: computeFinaleState wird gelesen)
(Regie: wenn {elara_trust} und {mole_evidence}, also elaraSpareable)
Elara steht ueber ihrem toten Vater, die Klinge locker in der Hand. Du haeltst die drei Blaetter und ihr Vertrauen.
[Spieler: Mit Worten aufhalten] {elara_spared} → Du sagst ihr, was sie schon weiss. Dass sie gerade zu dem wurde, wovor sie floh. Sie laesst den Hebel los. Sie lebt, gebrochen an dem, was sie tat.
[Spieler: Mit ihrer Klinge] {elara_killed} → Du beendest es mit dem Geschenk, das sie Dir gab. Egal, was kommt.
(Regie: wenn nicht spareable, erzwungen) Du hast ihr nie genug vertraut, und sie Dir nicht. Es bleibt nur die Klinge. {elara_killed}

**Der Druck und die Regler**
(Regie: Der Spieler geht zur Presse. Eine aktive Handlung, Hebel ziehen.)
- wenn {betrayalForeseen}: Du bist an der Schleuse, bevor der Nebel steigt. Der Raum bleibt klar.
- sonst: Der Nebel steigt um Deine Knie, Deine aeltesten Erinnerungen duennen, waehrend Du den Hebel suchst.
- allies hoch: Branka, Mara, Thom stehen bei Dir, entsetzt, dass Elara eine von ihnen war.
- allies niedrig: Du stehst allein im Druckraum.
(Regie: In JEDEM Fall verbrennt Elara oder ihr letzter Wille zuvor das eine Blatt, das die Bewegung am schwersten belastet. Du laesst es geschehen, um Branka und Mara nicht fuer ihre Schuld zu zerstoeren. Die gedruckte Wahrheit ist unvollstaendig, und Du weisst es.)

**Der letzte Satz**
(Regie: wenn {self_remembered}) In dem Moment, in dem die Presse anlaeuft, kehrt es zurueck. Dein Name, Dein Gesicht, wer Du warst, bevor der Nebel Dich nahm. Der letzte Satz gehoert Dir.
(Regie: sonst) Die Presse laeuft. Du weisst noch immer nicht, wer Du warst. Aber Du weisst, was Du getan hast. Vielleicht reicht das.

**Ausklang** {story_ending}
(Regie: Der Nebel duennt aus, nicht weil jemand ihn vertreibt, sondern weil zu viele Menschen sich zu vieles gleichzeitig merken.)
(Regie: Auf einem Platz liest ein Fremder das Verhoerprotokoll seines Bruders laut vor. Niemand kann ihn aufhalten. Kein Triumphmarsch. Hart erkaempft, unvollstaendig, und frei.)

---

# Mikro-Reaktivitaet (Rueckrufe, ueber die Akte verteilt)

- **{petitions_kept}**, Akt 3 Hub: ein Bittsteller erkennt Dich.
  BITTSTELLER: Du bist der, der die Gesuche nicht abgegeben hat. Meine Schwester stand auf einem. Sie lebt noch. Danke. (Wenn {petitions_surrendered}: derselbe Bittsteller sieht durch Dich hindurch, kalt.)
- **{verification_sealed}**, Sitzung: Harrens Zeile ueber Dein Siegel (siehe Akt 1).
- **{convoy_blade_drawn}**, Akt 3: Mara ist knapper, misstrauischer.
  MARA: Seit dem Konvoi sind sie wachsamer. Beweg Dich vorsichtiger, ja?
- **{truth_told}** (Buerger im Hub), Finale-Ausklang: derselbe Buerger steht auf dem Platz und liest mit.
- **{self_remembered}**: letzter Satz gehoert Dir (siehe Finale).
- **allies-Score**: bestimmt, wer im Druckraum steht.

---

# Offene Schreibarbeit (bewusst noch nicht drin)

- Ein bis zwei reine Textur-Nebenquests ohne Bezug zur These, fuer Waerme und Abwechslung (siehe Bibel Abschnitt 14).
- Ambiente Hub-Barks pro Akt in groesserer Zahl, hier nur die tragenden Beats.
- Alternative Antwortzeilen fuer Wiederholungsgespraeche mit NPCs.
