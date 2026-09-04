// js/eventSystem.js — Random Dungeon Events
(function() {
  'use strict';

  if (window.i18n) {
    window.i18n.register('de', {
      // Treasure cache
      'event.treasure.name': 'Versteckter Schatz',
      'event.treasure.toast_spawn': 'Etwas Verborgenes schimmert...',
      'event.treasure.object_label': 'Schatz',
      'event.treasure.choice_gold': 'Gold nehmen (+{amount})',
      'event.treasure.choice_search': 'Gründlich durchsuchen (Item)',
      'event.treasure.choice_ransack': 'Gründlich durchwühlen (seltenes Item — weckt {gegner} Wachen)',
      'event.treasure.choice_ignore': 'Ignorieren',
      'event.treasure.toast_ransack': 'Ein seltener Fund — aber der Lärm weckt {gegner} Wachen!',
      'event.treasure.toast_ransack_fragment': 'Zwischen dem Plunder liegt ein Wissensfragment.',
      'event.treasure.toast_gold': '+{amount} Gold!',
      'event.treasure.toast_item': 'Ein Gegenstand gefunden!',
      // Ambush
      'event.ambush.name': 'Hinterhalt!',
      'event.ambush.toast_looter': 'Einer von ihnen trägt Beute — der Plünderer!',
      // Wandering merchant
      'event.merchant.name': 'Wandernder Händler',
      'event.merchant.toast_spawn': '🛒 Ein wandernder Händler ist erschienen!',
      // Cursed chest
      'event.cursed.name': 'Verfluchte Truhe',
      'event.cursed.toast_spawn': 'Eine dunkle Aura umgibt etwas...',
      'event.cursed.object_label': 'Verfl. Truhe',
      'event.cursed.choice_open': 'Öffnen (Risiko: -25% Max-LP für den Run, Belohnung: {amount} Gold + Item)',
      'event.cursed.choice_safe': 'Vorsichtig öffnen (kein Risiko, weniger Beute)',
      'event.cursed.choice_leave': 'In Ruhe lassen',
      'event.cursed.toast_curse': 'Fluch! -25% Max-LP bis Run-Ende, aber gute Beute!',
      'event.cursed.toast_safe': '+{amount} Gold (sicher)',
      // Lore fragment
      'event.lore.name': 'Altes Schriftstück',
      'event.lore.toast_spawn': '📜 Ein altes Schriftstück glüht in der Nähe...',
      'event.lore.dialog_title': 'Altes Schriftstück',
      'event.lore.dialog_hint': '[Klick / Space / ESC zum Schliessen]',
      'event.lore.text.1': '...die Schatten flüstern Namen, die niemand mehr aussprechen sollte...',
      'event.lore.text.2': '...der Kettenrat schloss einen Pakt mit etwas Älterem als die Stadt...',
      'event.lore.text.3': '...wer das Siegel bricht, öffnet einen Pfad in beide Richtungen...',
      'event.lore.text.4': '...die Tiere wussten zuerst, dass etwas in den Tiefen wachte...',
      'event.lore.text.5': '...verbrannte Seiten, doch ein Wort bleibt: "Dämmerstein"...',
      'event.lore.text.6': '...wir gruben tiefer als jede Karte erlaubte. Möge man uns vergeben...',
      // Feature 051: Akt-1-themed fragments — political subtext anchors
      'event.lore.text.fragment_lost_history': '...die Stadtchronik nennt 1411 als Gründungsjahr. Aber die Steine an den Mauern tragen Symbole, die niemand mehr lesen darf — und sie sind älter als die Stadt selbst behauptet zu sein...',
      'event.lore.text.fragment_council_pact': '...drei Siegel, eine Unterschrift. Magistrat, Klerus, Garde — sie streiten in den Sälen, aber unter den Sälen treffen sie eine ältere Macht. Die Schriftrolle nennt sie nur "den, der die Erinnerung frisst"...',
      'event.lore.text.fragment_personal_amnesia': '...mein Name steht in zwei Listen: einmal als Archivschmied, einmal als "zur Reinigung freigegeben". Der Unfall an der Forge war geplant. Was ich nicht mehr weiß, wollte jemand begraben sehen...',
      // Environmental hazard
      'event.hazard.name': 'Einsturzgefahr',
      'event.hazard.toast_spawn': '🪨 Vorsicht — Decke stürzt ein! AUSWEICHEN!',
      'event.hazard.toast_hit': '🪨 Einsturz! Schwerer Treffer!',
      'event.hazard.toast_dodge': '🪨 Ausgewichen! +{amount} Gold',
      // Shrine
      'event.shrine.name': 'Mystischer Schrein',
      'event.shrine.toast_spawn': 'Ein mystischer Schrein erscheint...',
      'event.shrine.object_label': 'Schrein',
      'event.shrine.choice_ignore': 'Ignorieren',
      'event.lock.name': 'Verkettetes Gitter',
      'event.lock.toast_spawn': 'Schwere Ketten im Halbdunkel — dahinter liegt etwas.',
      'event.lock.object_label': 'Kettenschloss',
      'event.lock.won': 'Die Kette fällt. Was dahinter lag, gehört dir.',
      'event.lock.partial': 'Nicht ganz — aber die Fuge gibt {gold} Gold her.',
      'event.lock.lost': 'Der letzte Dietrich bricht. Die Kette bleibt, wo sie ist.',
      'lock.title': 'Kettenschloss',
      'lock.hint': '← → tasten · Leertaste setzen · E aufhören und Gold nehmen',
      'lock.goal': 'Alle {n} Stifte setzen, dann fällt die Kette',
      'lock.status': 'Stift {i}/{n}  {stifte}   Dietriche {picks}   {zeit}s',
      'lock.pin.set': 'Stift {i} sitzt. Noch {rest}.',
      'lock.resist': 'Widerstand',
      'lock.feel.none': 'Nichts zu spüren',
      'lock.feel.far': 'Etwas gibt nach',
      'lock.feel.near': 'Der Stift ist nah',
      'lock.feel.grip': 'Er greift — jetzt die Mitte treffen',
      'lock.miss.left': '← Weiter links',
      'lock.miss.right': 'Weiter rechts →',
      'event.altar.name': 'Opferstein',
      'event.altar.toast_spawn': 'Ein blutiger Opferstein steht im Halbdunkel...',
      'event.altar.object_label': 'Opferstein',
      'event.altar.choice': '{name} opfern ({slot})',
      'event.altar.choice_ignore': 'Nichts hergeben',
      'event.altar.nothing_equipped': 'Du trägst nichts, das er annehmen würde.',
      'event.altar.better': 'Der Stein gibt mehr zurück, als er nahm. ({alt} → {neu})',
      'event.altar.same': 'Ein Tausch ohne Gewinn. ({alt} → {neu})',
      'event.altar.worse': 'Der Stein hat dich übervorteilt. ({alt} → {neu})',
      'event.altar.slot.weapon': 'Waffe',
      'event.altar.slot.head': 'Kopf',
      'event.altar.slot.body': 'Rüstung',
      'event.altar.slot.boots': 'Stiefel',
      'event.altar.slot.offhand': 'Nebenhand',
      // #71: Der Schrein zieht Segen UND Preis. Beides steht als Zahl im Text,
      // damit die Entscheidung ohne Raten faellt.
      'event.shrine.angebot': '{segen}, dafür {preis}',
      'event.shrine.toast_angenommen': 'Der Schrein nimmt seinen Preis: {segen}, {preis}.',
      'event.shrine.segen.macht': '+{wert}% Schaden',
      'event.shrine.segen.hast': '+{wert}% Angriffstempo',
      'event.shrine.segen.zaehigkeit': '+{wert}% Rüstung',
      'event.shrine.segen.eile': '+{wert}% Lauftempo',
      'event.shrine.preis.ruestung': '-{wert}% Rüstung',
      'event.shrine.preis.lauftempo': '-{wert}% Lauftempo',
      'event.shrine.preis.angriffstempo': '-{wert}% Angriffstempo',
      'event.shrine.preis.schaden': '-{wert}% Schaden',
      // Gambling
      'event.gambling.name': 'Glücksspiel',
      'event.gambling.toast_spawn': 'Ein Spieltisch taucht auf...',
      'event.gambling.object_label': 'Glücksspiel',
      'event.gambling.title': 'Glücksspiel ({cost} Gold)',
      'event.gambling.choice_bet': 'Wette {cost} Gold (30% auf das Dreifache)',
      'event.gambling.toast_marked': 'Das Haus zeichnet dich: -{wert}% Rüstung bis zum Ende der Tiefe.',
      'event.gambling.choice_decline': 'Ablehnen',
      'event.gambling.toast_no_gold': 'Nicht genug Gold!',
      'event.gambling.toast_won': 'Gewonnen! Netto +{amount} Gold!',
      'event.gambling.toast_lost': 'Verloren! -{amount} Gold',
      // Elite ambush
      'event.elite.name': 'Elite-Hinterhalt',
      'event.elite.toast_spawn': 'Ein mächtiger Feind nähert sich!',
      'event.elite.choice_accept': 'Annehmen (garantierte Beute)',
      'event.elite.choice_challenge': 'Herausfordern (+30% Leben, +15% Schaden — bessere Beute)',
      'event.elite.toast_challenge': 'Du forderst ihn heraus. Er wird stärker — und wertvoller.',
      'event.elite.toast_reward': 'Die Beute des Elite-Gegners.',
      // Healing fountain (rework #16) — risk/reward choices with weighted
      // outcomes. All Brunnen buffs/debuffs are run-scoped (cleared on hub
      // return). HP debuff is on max HP, not current HP.
      'event.fountain.name': 'Geheimnisvoller Brunnen',
      'event.fountain.toast_spawn': 'Ein leuchtender Brunnen erscheint...',
      'event.fountain.object_label': 'Brunnen',
      'event.fountain.choice_drink': 'Trinken',
      'event.fountain.choice_offer': 'Blut geben (-25% Max-LP für den Run) — Segen',
      'event.fountain.choice_offer_gold': 'Münzen opfern (-{kosten} Gold) — Beute',
      'event.fountain.choice_ignore': 'Ignorieren',
      'event.fountain.outcome.heal':       'Reines Wasser! Volle Heilung.',
      'event.fountain.outcome.damage_buff':'Stärke! +25% Schaden bis Run-Ende.',
      'event.fountain.outcome.speed_buff': 'Eile! +20% Tempo bis Run-Ende.',
      'event.fountain.outcome.armor_buff': 'Schutz! +5% Rüstung bis Run-Ende.',
      'event.fountain.outcome.loot':       'Etwas glitzert im Wasser...',
      'event.fountain.outcome.maxhp_debuff':'Bitter! -20% Max-LP bis Run-Ende.',
      'event.fountain.outcome.speed_debuff':'Schwer! -10% Tempo bis Run-Ende.',
      'event.fountain.outcome.damage_debuff':'Schwach! -10% Schaden bis Run-Ende.',
      'event.fountain.outcome.nothing':    'Nichts geschieht.',
      'event.fountain.outcome.strong_buff':'Mächtige Gabe! +50% Schaden bis Run-Ende.',
      'event.fountain.outcome.rare_loot':  'Seltener Schatz!',
      'event.fountain.outcome.haste_buff': 'Das Wasser beschleunigt deine Hand: +25% Angriffstempo!',
      'event.fountain.outcome.potions':    'Zwei Fläschchen treiben an die Oberfläche.',
    });
    window.i18n.register('en', {
      'event.treasure.name': 'Hidden Treasure',
      'event.treasure.toast_spawn': 'Something hidden glimmers...',
      'event.treasure.object_label': 'Treasure',
      'event.treasure.choice_gold': 'Take gold (+{amount})',
      'event.treasure.choice_search': 'Search thoroughly (Item)',
      'event.treasure.choice_ransack': 'Ransack it (rare item — wakes {gegner} guards)',
      'event.treasure.choice_ignore': 'Ignore',
      'event.treasure.toast_ransack': 'A rare find — but the noise wakes {gegner} guards!',
      'event.treasure.toast_ransack_fragment': 'A knowledge fragment lies among the junk.',
      'event.treasure.toast_gold': '+{amount} gold!',
      'event.treasure.toast_item': 'Found an item!',
      'event.ambush.name': 'Ambush!',
      'event.ambush.toast_looter': 'One of them carries loot — the looter!',
      'event.merchant.name': 'Wandering Merchant',
      'event.merchant.toast_spawn': '🛒 A wandering merchant has appeared!',
      'event.cursed.name': 'Cursed Chest',
      'event.cursed.toast_spawn': 'A dark aura surrounds something...',
      'event.cursed.object_label': 'Cursed Chest',
      'event.cursed.choice_open': 'Open (Risk: -25% max HP for the run, Reward: {amount} gold + Item)',
      'event.cursed.choice_safe': 'Open carefully (no risk, less loot)',
      'event.cursed.choice_leave': 'Leave alone',
      'event.cursed.toast_curse': 'Curse! -25% max HP for the rest of the run, but great loot!',
      'event.cursed.toast_safe': '+{amount} gold (safe)',
      'event.lore.name': 'Old Manuscript',
      'event.lore.toast_spawn': '📜 An old manuscript glows nearby...',
      'event.lore.dialog_title': 'Old Manuscript',
      'event.lore.dialog_hint': '[Click / Space / ESC to close]',
      'event.lore.text.1': '...the shadows whisper names no one should speak anymore...',
      'event.lore.text.2': '...the Chain Council made a pact with something older than the city...',
      'event.lore.text.3': '...whoever breaks the seal opens a path in both directions...',
      'event.lore.text.4': '...the animals knew first that something waited in the depths...',
      'event.lore.text.5': '...burned pages, but one word remains: "Twilightstone"...',
      'event.lore.text.6': '...we dug deeper than any map allowed. May we be forgiven...',
      'event.lore.text.fragment_lost_history': '...the city chronicle names 1411 as the founding year. But the stones in the walls carry symbols no one is allowed to read anymore — and they are older than the city itself claims to be...',
      'event.lore.text.fragment_council_pact': '...three seals, one signature. Magistrate, Clergy, Guard — they quarrel in the halls, but beneath the halls they meet an older power. The scroll names it only as "the one who eats memory"...',
      'event.lore.text.fragment_personal_amnesia': '...my name appears in two lists: once as Archivesmith, once as "cleared for purification". The Forge accident was planned. What I no longer remember, someone wanted buried...',
      'event.hazard.name': 'Cave-in Risk',
      'event.hazard.toast_spawn': '🪨 Watch out — ceiling collapsing! DODGE!',
      'event.hazard.toast_hit': '🪨 Cave-in! Heavy hit!',
      'event.hazard.toast_dodge': '🪨 Dodged! +{amount} gold',
      'event.shrine.name': 'Mystical Shrine',
      'event.shrine.toast_spawn': 'A mystical shrine appears...',
      'event.shrine.object_label': 'Shrine',
      'event.shrine.choice_ignore': 'Ignore',
      'event.lock.name': 'Chained Grate',
      'event.lock.toast_spawn': 'Heavy chains in the gloom — something lies behind them.',
      'event.lock.object_label': 'Chain Lock',
      'event.lock.won': 'The chain falls. What lay behind it is yours.',
      'event.lock.partial': 'Not quite — but the gap yields {gold} gold.',
      'event.lock.lost': 'The last pick snaps. The chain stays where it is.',
      'lock.title': 'Chain Lock',
      'lock.hint': '← → to feel · Space to set · E to stop and take the gold',
      'lock.goal': 'Set all {n} pins and the chain falls',
      'lock.status': 'Pin {i}/{n}  {stifte}   Picks {picks}   {zeit}s',
      'lock.pin.set': 'Pin {i} seats. {rest} to go.',
      'lock.resist': 'Resistance',
      'lock.feel.none': 'Nothing gives',
      'lock.feel.far': 'Something shifts',
      'lock.feel.near': 'The pin is close',
      'lock.feel.grip': 'It catches — now find the middle',
      'lock.miss.left': '← Further left',
      'lock.miss.right': 'Further right →',
      'event.altar.name': 'Sacrificial Stone',
      'event.altar.toast_spawn': 'A bloodied sacrificial stone stands in the gloom...',
      'event.altar.object_label': 'Sacrificial Stone',
      'event.altar.choice': 'Sacrifice {name} ({slot})',
      'event.altar.choice_ignore': 'Give nothing',
      'event.altar.nothing_equipped': 'You carry nothing it would accept.',
      'event.altar.better': 'The stone gives back more than it took.',
      'event.altar.same': 'An even trade — no better, no worse.',
      'event.altar.worse': 'The stone gave back worse. Bad luck.',
      'event.altar.slot.weapon': 'weapon',
      'event.altar.slot.head': 'head',
      'event.altar.slot.body': 'body',
      'event.altar.slot.boots': 'boots',
      'event.altar.slot.offhand': 'off-hand',
      'event.shrine.angebot': '{segen}, at the cost of {preis}',
      'event.shrine.toast_angenommen': 'The shrine takes its price: {segen}, {preis}.',
      'event.shrine.segen.macht': '+{wert}% damage',
      'event.shrine.segen.hast': '+{wert}% attack speed',
      'event.shrine.segen.zaehigkeit': '+{wert}% armor',
      'event.shrine.segen.eile': '+{wert}% movement speed',
      'event.shrine.preis.ruestung': '-{wert}% armor',
      'event.shrine.preis.lauftempo': '-{wert}% movement speed',
      'event.shrine.preis.angriffstempo': '-{wert}% attack speed',
      'event.shrine.preis.schaden': '-{wert}% damage',
      'event.gambling.name': 'Gambling',
      'event.gambling.toast_spawn': 'A gambling table appears...',
      'event.gambling.object_label': 'Gambling',
      'event.gambling.title': 'Gambling ({cost} gold)',
      'event.gambling.choice_bet': 'Bet {cost} gold (30% for triple)',
      'event.gambling.toast_marked': 'The house marks you: -{wert}% armor until the end of this depth.',
      'event.gambling.choice_decline': 'Decline',
      'event.gambling.toast_no_gold': 'Not enough gold!',
      'event.gambling.toast_won': 'You won! Net +{amount} gold!',
      'event.gambling.toast_lost': 'Lost! -{amount} gold',
      'event.elite.name': 'Elite Ambush',
      'event.elite.toast_spawn': 'A mighty foe approaches!',
      'event.elite.choice_accept': 'Accept (guaranteed loot)',
      'event.elite.choice_challenge': 'Challenge (+30% health, +15% damage — better loot)',
      'event.elite.toast_challenge': 'You challenge him. He grows stronger — and richer.',
      'event.elite.toast_reward': 'The elite\'s loot.',
      'event.fountain.name': 'Mysterious Fountain',
      'event.fountain.toast_spawn': 'A glowing fountain appears...',
      'event.fountain.object_label': 'Fountain',
      'event.fountain.choice_drink': 'Drink',
      'event.fountain.choice_offer': 'Give blood (-25% max HP for the run) — blessing',
      'event.fountain.choice_offer_gold': 'Offer coin (-{kosten} gold) — loot',
      'event.fountain.choice_ignore': 'Ignore',
      'event.fountain.outcome.heal':       'Pure water! Fully healed.',
      'event.fountain.outcome.damage_buff':'Strength! +25% damage for the rest of the run.',
      'event.fountain.outcome.speed_buff': 'Haste! +20% speed for the rest of the run.',
      'event.fountain.outcome.armor_buff': 'Protection! +5% armor for the rest of the run.',
      'event.fountain.outcome.loot':       'Something glints in the water...',
      'event.fountain.outcome.maxhp_debuff':"Bitter! -20% max HP for the rest of the run.",
      'event.fountain.outcome.speed_debuff':'Heavy! -10% speed for the rest of the run.',
      'event.fountain.outcome.damage_debuff':'Weak! -10% damage for the rest of the run.',
      'event.fountain.outcome.nothing':    'Nothing happens.',
      'event.fountain.outcome.strong_buff':'Mighty gift! +50% damage for the rest of the run.',
      'event.fountain.outcome.rare_loot':  'A rare treasure!',
      'event.fountain.outcome.haste_buff': 'The water quickens your hand: +25% attack speed!',
      'event.fountain.outcome.potions':    'Two vials float to the surface.',
    });
  }
  var T = function (key, params) { return window.i18n ? window.i18n.t(key, params) : key; };

  var EVENT_TYPES = [
    {
      id: 'treasure_cache',
      name: T('event.treasure.name'),
      weight: 15,
      minDepth: 1,
      handler: function(scene) {
        showEventToast(scene, T('event.treasure.toast_spawn'), 'treasure_cache');
        var goldAmount = 30 + Math.floor(Math.random() * 40) + (window.DUNGEON_DEPTH || 1) * 15;
        spawnEventObject(scene, 'evt_treasure', 0xccaa33, 0xffd700, T('event.treasure.object_label'), function () {
          try { window.soundManager && window.soundManager.playSFX('pickup'); } catch (e) {}
          showEventChoiceDialog(scene, T('event.treasure.name'), [
            {
              label: T('event.treasure.choice_gold', { amount: goldAmount }),
              callback: function () {
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldAmount);
                showEventToast(scene, T('event.treasure.toast_gold', { amount: goldAmount }), 'treasure_cache');
              }
            },
            {
              label: T('event.treasure.choice_search'),
              callback: function () {
                var gotItem = null;
                if (window.LootSystem && window.LootSystem.rollItem && typeof spawnLoot === 'function') {
                  var iLevel = (window.DUNGEON_DEPTH || 1) + 2;
                  gotItem = window.LootSystem.rollItem(null, iLevel);
                  if (gotItem) spawnLoot.call(scene, player.x, player.y - 30, gotItem, null);
                }
                if (gotItem) {
                  showEventToast(scene, T('event.treasure.toast_item'), 'treasure_cache');
                } else {
                  // Kein Item gerollt -> wenigstens Gold, damit die Schatzkiste
                  // nie völlig leer ausgeht (früher: Toast log "Gegenstand
                  // gefunden", der Spieler bekam aber nichts).
                  if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldAmount);
                  showEventToast(scene, T('event.treasure.toast_gold', { amount: goldAmount }), 'treasure_cache');
                }
              }
            },
            {
              // #71: Der Schatz war die einzige Wahl OHNE Preis — und das
              // haeufigste Ereignis auf Tiefe 1. Wer mehr will, macht Laerm.
              label: T('event.treasure.choice_ransack',
                { gegner: wachenBeimDurchwuehlen(window.DUNGEON_DEPTH || 1) }),
              callback: function () {
                var tiefe = window.DUNGEON_DEPTH || 1;
                var wachen = wachenBeimDurchwuehlen(tiefe);
                if (window.LootSystem && window.LootSystem.rollItem && typeof spawnLoot === 'function') {
                  try {
                    var stueck = window.LootSystem.rollItem(null, tiefe + 5, 2);   // Selten
                    if (stueck) spawnLoot.call(scene, player.x, player.y - 30, stueck, null);
                  } catch (e) {}
                }
                // Das Gold gibt es NICHT zusaetzlich: die Truhe ist danach leer.
                weckeWachen(scene, wachen);
                showEventToast(scene, T('event.treasure.toast_ransack', { gegner: wachen }), 'treasure_cache');
                // Ein seltener Nebenfund haelt das Durchwuehlen interessant,
                // auch wenn die Ausruestung gerade nicht passt.
                if (Math.random() < 0.15 && window.KnowledgeTree
                    && typeof window.KnowledgeTree.addFragments === 'function') {
                  try {
                    window.KnowledgeTree.addFragments(1);
                    showEventToast(scene, T('event.treasure.toast_ransack_fragment'), 'treasure_cache');
                  } catch (e) {}
                }
              }
            },
            { label: T('event.treasure.choice_ignore'), callback: function () {} }
          ]);
        });
      }
    },
    {
      id: 'ambush',
      name: T('event.ambush.name'),
      weight: 12,
      minDepth: 2,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
        triggerAmbush(scene);
      }
    },
    {
      id: 'wandering_merchant',
      name: T('event.merchant.name'),
      weight: 15,
      minDepth: 3,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        spawnMerchant(scene);
      }
    },
    {
      id: 'trapped_chest',
      name: T('event.cursed.name'),
      weight: 8,
      minDepth: 2,
      handler: function(scene) {
        showEventToast(scene, T('event.cursed.toast_spawn'), 'trapped_chest');
        var goldReward = 60 + Math.floor(Math.random() * 60) + (window.DUNGEON_DEPTH || 1) * 20;
        spawnEventObject(scene, 'evt_cursed', 0x662244, 0xaa44ff, T('event.cursed.object_label'), function () {
          try { window.soundManager && window.soundManager.playSFX('enemy_hit'); } catch (e) {}
          showEventChoiceDialog(scene, T('event.cursed.name'), [
            {
              label: T('event.cursed.choice_open', { amount: goldReward }),
              callback: function () {
                // Curse cost: -3 MAX HP for the run, not current HP. Reuses the
                // brunnenBuffs.maxHpAdd registry (already wired into
                // inventory.recalcDerived's §3.7 layer and cleared by
                // main.js leaveDungeonForHub). The conceptual "Brunnen" naming
                // is pragmatic — it's the canonical run-scoped max-HP delta
                // slot; cursed-chest just borrows it.
                if (!window.brunnenBuffs) {
                  window.brunnenBuffs = { damageMult: 1, speedMult: 1, armorAdd: 0, maxHpAdd: 0 };
                }
                var origCurrent = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
                // Fluch-Kosten: -25% der AKTUELLEN Max-LP (prozentual statt flat
                // -3, das in der Tiefe belanglos wurde). Als flacher Abzug im
                // maxHpAdd-Slot verbucht -> skaliert mit dem Gear-Stand.
                // #71: Anteil aus einem Band statt fester 25 %. Zwei Kisten
                // waren sonst dieselbe Entscheidung; der genaue Preis steht im
                // Toast.
                var _curMax = Math.max(1, window.playerMaxHealth || 1);
                var _anteil = 0.20 + Math.random() * 0.10;   // 20 - 30 %
                var _penalty = Math.max(1, Math.round(_curMax * _anteil));
                window.brunnenBuffs.maxHpAdd -= _penalty;
                if (typeof recalcDerived === 'function') recalcDerived(0, 0);
                // Preserve the player's existing wound: clamp current HP to
                // the new max only if it now exceeds it.
                var newMax = Math.max(1, window.playerMaxHealth || 1);
                if (typeof window.setPlayerHealth === 'function') {
                  window.setPlayerHealth(Math.min(origCurrent, newMax), true);
                }
                // Grant gold
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
                // Drop rare item
                if (window.LootSystem && window.LootSystem.rollItem && typeof spawnLoot === 'function') {
                  var iLevel = (window.DUNGEON_DEPTH || 1) + 4;
                  var roll = Math.random();
                  var forcedTier = roll < 0.15 ? 3 : (roll < 0.5 ? 2 : 1);
                  var item = window.LootSystem.rollItem(null, iLevel, forcedTier);
                  if (item) spawnLoot.call(scene, player.x, player.y - 30, item, null);
                }
                var cam = scene.cameras && scene.cameras.main;
                if (cam && cam.shake) cam.shake(200, 0.006);
                showEventToast(scene, T('event.cursed.toast_curse'), 'trapped_chest');
              }
            },
            {
              label: T('event.cursed.choice_safe'),
              callback: function () {
                var safeGold = Math.floor(goldReward * 0.4);
                if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(safeGold);
                showEventToast(scene, T('event.cursed.toast_safe', { amount: safeGold }), 'trapped_chest');
              }
            },
            { label: T('event.cursed.choice_leave'), callback: function () {} }
          ]);
        });
      }
    },
    {
      id: 'lore_fragment',
      name: T('event.lore.name'),
      weight: 12,
      minDepth: 1,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {
          try { window.soundManager && window.soundManager.playSFX('click'); } catch (e2) {}
        }
        spawnLoreFragment(scene);
      }
    },
    {
      id: 'environmental_hazard',
      name: T('event.hazard.name'),
      weight: 7,
      minDepth: 4,
      handler: function(scene) {
        try { window.soundManager && window.soundManager.playSFX('hit'); } catch (e) {}
        triggerRockfall(scene);
      }
    }
  ];

  // --- Interactable event objects (spawn in room, player presses E to interact) ---

  /**
   * Wie viele Wachen der Laerm beim Durchwuehlen weckt (#71).
   *
   * Waechst mit der Tiefe, aber langsam: der Preis soll spuerbar bleiben, ohne
   * in der Endlostiefe zu einem zweiten Hinterhalt zu werden.
   * T1-4: 2, T5-9: 3, T10-14: 4, ...
   */
  function wachenBeimDurchwuehlen(tiefe) {
    return 2 + Math.floor(Math.max(1, tiefe || 1) / 5);
  }

  /**
   * Weckt die Wachen um den Spieler herum.
   *
   * spawnEnemy haelt 300 px Mindestabstand zum Spieler ein und wuerde die
   * Wachen sonst irgendwo im Raum absetzen — dieselbe Falle wie bei der
   * Koederfalle in #113. Darum nach dem Spawn auf den Ring zurueckholen.
   */
  function weckeWachen(scene, anzahl) {
    if (typeof spawnEnemy !== 'function' || typeof player === 'undefined' || !player) return 0;
    var gesetzt = 0;
    for (var i = 0; i < anzahl; i++) {
      var winkel = (Math.PI * 2 * i) / anzahl + Math.random() * 0.5;
      var radius = 110 + Math.random() * 70;
      try {
        var g = spawnEnemy.call(scene);
        if (!g) continue;
        var zx = player.x + Math.cos(winkel) * radius;
        var zy = player.y + Math.sin(winkel) * radius;
        if (typeof window.isSpawnPositionBlocked !== 'function'
            || !window.isSpawnPositionBlocked(zx, zy, 20)) {
          g.x = zx; g.y = zy;
          if (g.body && typeof g.body.reset === 'function') g.body.reset(zx, zy);
        }
        gesetzt++;
      } catch (e) { /* ein Gegner weniger ist besser als ein Absturz */ }
    }
    return gesetzt;
  }

  /**
   * Kleine Erfahrungsgutschrift fuers Erreichen eines Ereignisses (#71).
   *
   * Bewusst deutlich unter dem Lore-Fragment (15 + 5 je Tiefe), das seine XP
   * fuer eine echte Interaktion gibt.
   */
  function ereignisXp(tiefe) {
    return 6 + 2 * Math.max(1, tiefe || 1);
  }

  function gibEreignisXp(scene) {
    try {
      var menge = ereignisXp(window.DUNGEON_DEPTH || 1);
      if (typeof addXP === 'function') addXP.call(scene, menge);
      else if (typeof window.addXP === 'function') window.addXP.call(scene, menge);
    } catch (e) { /* nie ein Ereignis wegen der XP verlieren */ }
  }

  var activeEventObjects = []; // track spawned event objects for cleanup

  function spawnEventObject(scene, texKey, color, glowColor, label, onInteract, opts) {
    if (!scene || !scene.add || !scene.physics) return;

    // Generate detailed textures per event type
    if (!scene.textures.exists(texKey)) {
      var g = scene.make.graphics({ add: false });
      if (texKey === 'evt_fountain') {
        // Stone basin with glowing water
        g.fillStyle(0x555566, 1); g.fillRect(6, 20, 20, 10); // base
        g.fillStyle(0x666677, 1); g.fillRect(4, 18, 24, 4); // rim
        g.fillStyle(0x777788, 1); g.fillRect(8, 22, 16, 6); // inner
        g.fillStyle(0x3366aa, 0.8); g.fillEllipse(16, 24, 14, 5); // water
        g.fillStyle(0x44aaff, 0.4); g.fillEllipse(16, 23, 10, 3); // water glow
        g.fillStyle(0xffffff, 0.3); g.fillCircle(13, 23, 1.5); // reflection
        // Pillar
        g.fillStyle(0x666677, 1); g.fillRect(13, 6, 6, 14);
        g.fillStyle(0x777788, 1); g.fillRect(12, 4, 8, 4); // capital
        g.fillStyle(0x44aaff, 0.6); g.fillCircle(16, 4, 3); // glow orb
        g.fillStyle(0x88ddff, 0.3); g.fillCircle(16, 4, 5); // outer glow
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_schloss') {
        // Ein Buegelschloss an schweren Kettengliedern. Dieselben drei Lagen
        // wie bei den Funden aus #113: dunkle Grundform, Flaeche, EINE helle
        // Lichtkante — ohne die wirkt alles flach.
        g.fillStyle(0x000000, 0.32); g.fillEllipse(16, 28, 24, 6);
        // Kettenglieder links und rechts
        [[4, 12], [4, 20], [27, 12], [27, 20]].forEach(function (p) {
          g.fillStyle(0x14121a, 1); g.fillEllipse(p[0], p[1], 9, 7);
          g.fillStyle(0x5a5568, 1); g.fillEllipse(p[0], p[1], 7.5, 5.5);
          g.fillStyle(0x2a2634, 1); g.fillEllipse(p[0], p[1], 4.5, 3);
          g.fillStyle(0x7d768c, 1); g.fillEllipse(p[0] - 0.8, p[1] - 1.4, 4, 1.6);
        });
        // Buegel
        g.fillStyle(0x14121a, 1); g.fillRect(10, 6, 12, 9);
        g.fillStyle(0x8a8298, 1); g.fillRect(11, 7, 10, 7);
        g.fillStyle(0x2a2634, 1); g.fillRect(13, 9, 6, 5);
        g.fillStyle(0xaaa2b8, 1); g.fillRect(11, 7, 10, 1.5);
        // Schlosskoerper
        g.fillStyle(0x140f08, 1); g.fillRect(8, 14, 16, 13);
        g.fillStyle(0x6b5426, 1); g.fillRect(9, 15, 14, 11);
        g.fillStyle(0x8f7334, 1); g.fillRect(9, 15, 14, 2);      // Lichtkante
        g.fillStyle(0x4a3a18, 1); g.fillRect(9, 24, 14, 2);      // Schattenfuss
        // Schluesselloch
        g.fillStyle(0x1a1206, 1); g.fillCircle(16, 20, 2.6);
        g.fillStyle(0x1a1206, 1); g.fillTriangle(14.6, 21, 17.4, 21, 16, 25);
        g.fillStyle(0xffd166, 0.5); g.fillCircle(15.3, 19.3, 0.9);
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_opferstein') {
        // Ein niedriger Blutstein: dunkle Grundform, Steinflaeche, EINE helle
        // Lichtkante, dazu die Rinne mit getrocknetem Blut. Dieselben drei
        // Lagen wie bei den Funden aus #113 — ohne sie wirkt alles flach.
        g.fillStyle(0x000000, 0.34); g.fillEllipse(16, 27.5, 26, 7);
        g.fillStyle(0x14121a, 1); g.fillRect(5, 13, 22, 14);          // Umriss
        g.fillStyle(0x4b4657, 1); g.fillRect(6, 14, 20, 12);          // Stein
        g.fillStyle(0x655f73, 1); g.fillRect(6, 14, 20, 2);           // Lichtkante
        g.fillStyle(0x2c2836, 1); g.fillRect(6, 24, 20, 2);           // Schattenfuss
        // Deckplatte mit Rinne
        g.fillStyle(0x14121a, 1); g.fillEllipse(16, 13, 24, 9);
        g.fillStyle(0x585267, 1); g.fillEllipse(16, 12.4, 22, 8);
        g.fillStyle(0x6e6880, 1); g.fillEllipse(13, 10.8, 12, 3.5);
        g.fillStyle(0x241a20, 1); g.fillEllipse(16, 13, 12, 4.5);     // Rinne
        // Getrocknetes Blut in der Rinne und ein Rinnsal ueber die Kante
        g.fillStyle(0x6b1518, 1); g.fillEllipse(16, 13.4, 9, 3);
        g.fillStyle(0x8c1d20, 1); g.fillEllipse(15, 12.9, 5, 1.6);
        g.fillStyle(0x6b1518, 1); g.fillRect(20, 15, 2, 7);
        g.fillStyle(0x8c1d20, 1); g.fillRect(20, 15, 1, 5);
        g.fillStyle(0x6b1518, 1); g.fillCircle(21, 22.5, 1.6);
        // Zwei Kerben als Zierrat
        g.fillStyle(0x332e3d, 1);
        g.fillRect(9, 18, 3, 1.4); g.fillRect(20, 20, 3, 1.4);
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_shrine') {
        // Stone altar with purple crystal
        g.fillStyle(0x444455, 1); g.fillRect(6, 22, 20, 8); // base
        g.fillStyle(0x555566, 1); g.fillRect(4, 20, 24, 4); // top slab
        g.fillStyle(0x333344, 1); g.fillRect(10, 24, 4, 6); // left leg
        g.fillStyle(0x333344, 1); g.fillRect(18, 24, 4, 6); // right leg
        // Crystal
        g.fillStyle(0x6644aa, 1);
        g.beginPath(); g.moveTo(16, 6); g.lineTo(20, 18); g.lineTo(12, 18); g.closePath(); g.fillPath();
        g.fillStyle(0x8866cc, 0.7);
        g.beginPath(); g.moveTo(16, 8); g.lineTo(18, 16); g.lineTo(14, 16); g.closePath(); g.fillPath();
        g.fillStyle(0xaa88ff, 0.4); g.fillCircle(16, 12, 6); // glow
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_gamble') {
        // Wooden table with dice/coins
        g.fillStyle(0x6b4226, 1); g.fillRect(4, 16, 24, 12); // table top
        g.fillStyle(0x5a3a1a, 1); g.fillRect(6, 14, 20, 4); // table surface
        g.fillStyle(0x4a2a10, 1); g.fillRect(8, 26, 4, 4); // left leg
        g.fillStyle(0x4a2a10, 1); g.fillRect(20, 26, 4, 4); // right leg
        // Coins
        g.fillStyle(0xffd700, 1); g.fillCircle(11, 16, 2.5);
        g.fillStyle(0xffcc00, 1); g.fillCircle(14, 15, 2);
        g.fillStyle(0xffd700, 1); g.fillCircle(19, 16, 2.5);
        // Dice
        g.fillStyle(0xeeeeee, 1); g.fillRect(15, 12, 5, 5);
        g.fillStyle(0x111111, 1); g.fillCircle(16, 14, 0.5); g.fillCircle(19, 14, 0.5);
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_treasure') {
        // Gold pile with sparkle
        g.fillStyle(0x8B6914, 1); g.fillRect(6, 18, 20, 12); // base chest
        g.fillStyle(0x7a5a10, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0x3a3a3a, 1); g.fillRect(14, 18, 4, 3); // lock
        g.fillStyle(0xffd700, 1); g.fillCircle(10, 14, 3); // coin 1
        g.fillStyle(0xffcc00, 1); g.fillCircle(16, 12, 3); // coin 2
        g.fillStyle(0xffd700, 1); g.fillCircle(22, 14, 2.5); // coin 3
        g.fillStyle(0xffffff, 0.5); g.fillCircle(16, 10, 2); // sparkle
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_cursed') {
        // Dark chest with purple aura
        g.fillStyle(0x331122, 1); g.fillRect(6, 18, 20, 12); // base chest
        g.fillStyle(0x441133, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0xaa44ff, 0.4); g.fillCircle(16, 20, 12); // purple aura
        g.fillStyle(0x222222, 1); g.fillRect(6, 18, 20, 12); // chest over aura
        g.fillStyle(0x331133, 1); g.fillRect(8, 16, 16, 4); // lid
        g.fillStyle(0xff2222, 1); g.fillCircle(16, 22, 2); // red eye
        g.fillStyle(0xaa44ff, 0.6); g.fillCircle(10, 14, 1.5); // particle
        g.fillStyle(0xaa44ff, 0.4); g.fillCircle(22, 12, 1.5); // particle
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_lager') {
        // Verlassenes Lager: erkaltete Feuerstelle. Der Blickfang ist die
        // Restglut — sie sagt "hier war eben noch jemand".
        g.fillStyle(0x000000, 0.30); g.fillEllipse(16, 26, 26, 8);      // Schatten
        // Steinkranz: je Stein dunkler Umriss, Flaeche, Lichtkante oben.
        [[7,25,3.4],[25,25,3.4],[5,20,3.0],[27,20,3.0],[9,16,2.8],[23,16,2.8]]
          .forEach(function (s) {
            g.fillStyle(0x1d1a20, 1); g.fillCircle(s[0], s[1] + 0.8, s[2] + 0.8);
            g.fillStyle(0x5a5350, 1); g.fillCircle(s[0], s[1], s[2]);
            g.fillStyle(0x807771, 1); g.fillCircle(s[0] - 0.6, s[1] - 0.9, s[2] * 0.5);
          });
        // Aschebett
        g.fillStyle(0x1a1418, 1); g.fillEllipse(16, 21, 15, 8);
        g.fillStyle(0x38302c, 1); g.fillEllipse(16, 20.5, 12, 6);
        // Scheite, ueberkreuz
        g.fillStyle(0x2a1d14, 1); g.fillRect(9, 18, 14, 4);
        g.fillStyle(0x5c3f26, 1); g.fillRect(9, 17, 14, 3);
        g.fillStyle(0x7a5636, 1); g.fillRect(9, 17, 14, 1);
        g.fillStyle(0x2a1d14, 1); g.fillRect(13, 21, 11, 4);
        g.fillStyle(0x4d3520, 1); g.fillRect(13, 20.5, 11, 3);
        // Restglut mit Schein
        g.fillStyle(0xff8a2a, 0.20); g.fillCircle(16, 20, 8);
        g.fillStyle(0xff8a2a, 0.35); g.fillCircle(16, 20, 5);
        g.fillStyle(0xff9d3d, 1); g.fillCircle(15, 20, 1.8);
        g.fillStyle(0xffd08a, 1); g.fillCircle(18, 21, 1.2);
        g.fillStyle(0xfff0c0, 1); g.fillCircle(15, 19.6, 0.7);
        // Zusammengerollte Decke daneben
        g.fillStyle(0x241a1c, 1); g.fillEllipse(6, 23, 10, 7);
        g.fillStyle(0x6d4a44, 1); g.fillEllipse(6, 22.4, 9, 6);
        g.fillStyle(0x8f6459, 1); g.fillEllipse(5.6, 21, 7, 2.6);
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_falle') {
        // Koeder: ein umgekippter Lederbeutel, aus dem Muenzen rollen. Sieht
        // bewusst nach Beute aus — kein Warnzeichen, das gehoert zur Falle.
        //
        // Das LEDER ist braun, nicht golden: im ersten Wurf hatten Beutel und
        // Muenzen fast denselben Ton und verschmolzen zu einem gelben Klumpen.
        // Erst der Farbabstand macht aus zwei Formen zwei Dinge.
        g.fillStyle(0x000000, 0.32); g.fillEllipse(15, 27.5, 25, 6);   // Bodenschatten

        // Beutelkoerper: Umriss, Leder, dunklere Unterseite, Lichtkante
        g.fillStyle(0x1b1309, 1); g.fillEllipse(13, 20, 21, 18);
        g.fillStyle(0x6b4a2a, 1); g.fillEllipse(13, 19.6, 19, 16);
        g.fillStyle(0x4a3220, 1); g.fillEllipse(13, 23, 17, 8);
        g.fillStyle(0x8f6538, 1); g.fillEllipse(10.5, 15.8, 10, 6.5);
        g.fillStyle(0xa87a45, 0.85); g.fillEllipse(9.5, 14.4, 5.5, 2.6);
        // Zwei Falten, damit es Stoff ist und keine Kugel
        g.fillStyle(0x3f2c18, 0.55);
        g.fillEllipse(16.5, 21, 2.2, 9); g.fillEllipse(9, 22.5, 1.8, 7);

        // Hals: Schnuerung, gerafftes Oberteil, zwei lose Schnurenden
        g.fillStyle(0x1b1309, 1); g.fillRect(8, 9, 11, 4);
        g.fillStyle(0x5c4020, 1); g.fillRect(8.6, 9.4, 9.8, 3);
        g.fillStyle(0x7d5a30, 1); g.fillRect(8.6, 9.4, 9.8, 1);
        g.fillStyle(0x4a3220, 1); g.fillRect(10, 5.5, 7, 4);           // gerafft
        g.fillStyle(0x2e2114, 1);
        g.fillRect(10.5, 5.5, 1.4, 4); g.fillRect(13.4, 5.5, 1.4, 4);  // Raffung
        g.fillStyle(0x2e2114, 1);                                       // Schnurenden
        g.fillRect(18, 10.5, 5, 1.4); g.fillRect(21.5, 11.5, 3.5, 1.3);
        g.fillStyle(0x4d3a24, 1); g.fillRect(18, 10.5, 5, 0.6);

        // Muenzen: gross genug, um einzeln lesbar zu sein, mit dunklem Rand
        [[21.5, 25.5, 3.6], [26, 22.5, 3.0], [24, 28, 2.6], [18, 27, 2.3]]
          .forEach(function (m) {
            g.fillStyle(0x7a5f10, 1); g.fillCircle(m[0], m[1] + 0.8, m[2] + 0.7);
            g.fillStyle(0xe8b93c, 1); g.fillCircle(m[0], m[1], m[2]);
            g.fillStyle(0xc79a22, 1); g.fillCircle(m[0] + 0.5, m[1] + 0.6, m[2] * 0.7);
            g.fillStyle(0xfff0b4, 1); g.fillCircle(m[0] - 0.9, m[1] - 1.0, m[2] * 0.42);
          });
        // Eine Muenze hochkant an der Beutelkante — bricht die Reihe auf
        g.fillStyle(0x7a5f10, 1); g.fillEllipse(19.5, 21.5, 3.2, 7);
        g.fillStyle(0xdcae32, 1); g.fillEllipse(19.3, 21.2, 2.2, 6);
        g.fillStyle(0xfff0b4, 0.8); g.fillEllipse(18.9, 19.5, 1, 2);

        g.fillStyle(0xffd98a, 0.16); g.fillCircle(20, 24, 13);          // warmer Schein
        g.generateTexture(texKey, 32, 32);
      } else if (texKey === 'evt_nische') {
        // #113: Lose Steine in einer Mauerspalte. Bewusst KEINE Truhe — der
        // Fund soll wie ein Teil der Wand aussehen, den jemand aufgebrochen
        // hat, nicht wie noch eine Kiste zum Anklicken.
        // Mauerquader mit Umriss + Lichtkante, dazwischen eine SCHWARZE Spalte
        // mit Schimmer dahinter. Der erste Wurf war eine flache Kachelflaeche.
        var quader = function (x, y, w, h) {
          g.fillStyle(0x15121b, 1); g.fillRect(x, y, w, h);           // Fuge/Umriss
          g.fillStyle(0x453e52, 1); g.fillRect(x + 1, y + 1, w - 2, h - 2);
          g.fillStyle(0x5d556e, 1); g.fillRect(x + 1, y + 1, w - 2, 1.5);
          g.fillStyle(0x2b2634, 1); g.fillRect(x + 1, y + h - 2.5, w - 2, 1.5);
        };
        g.fillStyle(0x0a080d, 1); g.fillRect(2, 1, 28, 30);          // Grundschatten
        quader(2, 1, 13, 9);   quader(17, 1, 13, 9);
        quader(2, 11, 9, 10);  quader(21, 11, 9, 10);
        quader(2, 22, 12, 9);  quader(18, 22, 12, 9);
        // Die Oeffnung: tiefes Schwarz, darin ein warmer Schimmer
        g.fillStyle(0x000000, 1); g.fillRect(11, 11, 10, 11);
        g.fillStyle(0x2a1d10, 1); g.fillRect(12, 13, 8, 8);
        g.fillStyle(0xd8a84a, 0.35); g.fillCircle(16, 17, 4.5);
        g.fillStyle(0xffd98a, 0.75); g.fillCircle(16, 17, 2.2);
        g.fillStyle(0xfff2c8, 1); g.fillCircle(15.4, 16.4, 0.9);
        // Herausgebrochenes Geroell davor
        [[10,27,3.0],[15,29,2.6],[20,27.5,2.8]].forEach(function (s) {
          g.fillStyle(0x15121b, 1); g.fillCircle(s[0], s[1] + 0.7, s[2] + 0.7);
          g.fillStyle(0x554d64, 1); g.fillCircle(s[0], s[1], s[2]);
          g.fillStyle(0x776d88, 1); g.fillCircle(s[0] - 0.7, s[1] - 0.9, s[2] * 0.45);
        });
        g.generateTexture(texKey, 32, 32);
      } else {
        // Generic fallback
        g.fillStyle(color, 1); g.fillRect(4, 4, 24, 28);
        g.fillStyle(glowColor, 0.5); g.fillCircle(16, 16, 14);
        g.generateTexture(texKey, 32, 32);
      }
      g.destroy();
    }

    // Find accessible spawn position. pickAccessibleSpawnPoint returns the
    // center of a walkable cell, but the event sprite is ~32px so the body
    // can still clip into adjacent wall tiles. Validate via the global
    // wall-grid + obstacle helper used by enemy/loot/stair spawns and retry
    // until we find a clear half-32 box.
    var EVENT_HALF = 20; // 32px sprite + small margin
    var cx = 400, cy = 250;
    var foundSpot = false;
    // #113: Der Aufrufer darf den Platz vorgeben. Verborgene Funde muessen
    // ABSEITS des Wegs liegen — eine eigene Suche hier waere genau die
    // Beliebigkeit, die das Issue beseitigt.
    if (opts && opts.spawnAt && typeof opts.spawnAt.x === 'number'
        && typeof opts.spawnAt.y === 'number') {
      cx = opts.spawnAt.x; cy = opts.spawnAt.y; foundSpot = true;
    }
    if (!foundSpot && scene.pickAccessibleSpawnPoint) {
      for (var sa = 0; sa < 12 && !foundSpot; sa++) {
        var spot = scene.pickAccessibleSpawnPoint({ maxAttempts: 24 });
        if (!spot) break;
        if (typeof window.isSpawnPositionBlocked === 'function'
            && window.isSpawnPositionBlocked(spot.x, spot.y, EVENT_HALF)) {
          continue;
        }
        // Nicht auf/unter einer Treppe spawnen (E-Konflikt Treppe vs. Objekt).
        if (typeof window.isNearStair === 'function' && window.isNearStair(scene, spot.x, spot.y, 40)) continue;
        cx = spot.x; cy = spot.y; foundSpot = true;
      }
    }
    if (!foundSpot && typeof player !== 'undefined' && player && player.active) {
      // Last-ditch ring around the player. Try several angles + radii so we
      // don't end up inside a wall when pickAccessibleSpawnPoint is missing.
      for (var ra = 0; ra < 16 && !foundSpot; ra++) {
        var angle = Math.random() * Math.PI * 2;
        var radius = 120 + Math.random() * 120;
        var tx = player.x + Math.cos(angle) * radius;
        var ty = player.y + Math.sin(angle) * radius;
        if (typeof window.isSpawnPositionBlocked === 'function'
            && window.isSpawnPositionBlocked(tx, ty, EVENT_HALF)) {
          continue;
        }
        if (typeof window.isNearStair === 'function' && window.isNearStair(scene, tx, ty, 40)) continue;
        cx = tx; cy = ty; foundSpot = true;
      }
    }
    if (!foundSpot) {
      try { console.warn('[eventSystem] spawnEventObject: no clear spot found, using fallback', { cx: cx, cy: cy, label: label }); } catch (_) {}
    }

    var obj = scene.physics.add.sprite(cx, cy, texKey);
    obj.setDepth(45).setImmovable(true);
    obj.body.setAllowGravity(false);
    // Optional scale override for full-resolution painterly sprites that
    // would otherwise render gigantic at 1:1 (e.g. NPC portraits). The
    // built-in 32×32 evt_* textures don't pass this and stay at scale 1.
    if (opts && typeof opts.scale === 'number') {
      obj.setScale(opts.scale);
      // Resize physics body to roughly match the displayed sprite so the
      // [E] proximity check still feels accurate.
      if (obj.body && typeof obj.body.setSize === 'function') {
        var bw = Math.max(8, (obj.width || 32) * opts.scale);
        var bh = Math.max(8, (obj.height || 32) * opts.scale);
        obj.body.setSize(bw, bh, true);
      }
    }

    // Prompt text — positioned just above the (possibly-scaled) sprite so
    // it isn't hidden behind a tall NPC body. Default of -24 is preserved
    // for the small built-in evt_* textures.
    var promptOffset = Math.max(24, (obj.displayHeight || 32) / 2 + 12);
    var prompt = scene.add.text(cx, cy - promptOffset, '[E] ' + label, {
      fontSize: '12px', fill: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(500).setVisible(false);

    // Glow effect
    var glow = scene.add.graphics();
    glow.fillStyle(glowColor, 0.15);
    glow.fillCircle(cx, cy, 30);
    glow.setDepth(44);

    var used = false;
    var updateHandler = function () {
      if (used || !obj.active || typeof player === 'undefined' || !player) return;
      var dx = obj.x - player.x;
      var dy = obj.y - player.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      prompt.setVisible(dist < 80);
    };
    scene.events.on('update', updateHandler);

    // E key handler
    var interactHandler = function () {
      if (used || !obj.active || typeof player === 'undefined' || !player) return;
      var dx = obj.x - player.x;
      var dy = obj.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) > 80) return;
      used = true;
      // Dem Ability-Zweig melden, dass DIESES E schon vergeben ist. Ohne die
      // Marke loest derselbe Druck zusaetzlich die Faehigkeit auf Slot 3 aus:
      // main.js kennt die Kette Treppe -> Tuer -> Ability, Ereignisobjekte
      // kamen darin nicht vor. Dasselbe Muster wie __stairConsumedEAt.
      try { window.__eventConsumedEAt = Date.now(); } catch (e) {}
      scene.input.keyboard.off('keydown-E', interactHandler);
      scene.events.off('update', updateHandler);
      prompt.destroy();
      glow.destroy();
      obj.destroy();
      onInteract();
    };
    scene.input.keyboard.on('keydown-E', interactHandler);

    // Mobile interact support
    var mobileHandler = function () {
      if (!window.__MOBILE_INTERACT_ACTIVE__) return;
      interactHandler();
    };
    scene.events.on('update', mobileHandler);

    activeEventObjects.push({
      sprite: obj, prompt: prompt, glow: glow,
      interactHandler: interactHandler, updateHandler: updateHandler, mobileHandler: mobileHandler,
      scene: scene
    });
  }

  function cleanupEventObjects() {
    activeEventObjects.forEach(function (eo) {
      if (eo.scene && eo.scene.input && eo.scene.input.keyboard) {
        eo.scene.input.keyboard.off('keydown-E', eo.interactHandler);
      }
      if (eo.scene && eo.scene.events) {
        eo.scene.events.off('update', eo.updateHandler);
        eo.scene.events.off('update', eo.mobileHandler);
      }
      if (eo.sprite && eo.sprite.destroy) eo.sprite.destroy();
      if (eo.prompt && eo.prompt.destroy) eo.prompt.destroy();
      if (eo.glow && eo.glow.destroy) eo.glow.destroy();
    });
    activeEventObjects.length = 0;
  }

  // --- Choice-based events: spawn object, player interacts, then shows dialog ---

  // #71 — Der Schrein zieht seinen Segen UND seinen Preis.
  //
  // Vorher: zwei feste Knoepfe, und der Preis hing an der SPIELERSTUFE
  // (-30 % Ruestung, +0,5 % je Stufe, Deckel -50 %). Der Handel wurde also mit
  // jedem Aufstieg teurer, waehrend der Ertrag bei x1,25 stehen blieb — und er
  // hing an der falschen Groesse, denn die Gefahr kommt aus der Tiefe.
  //
  // Jetzt: vier moegliche Segen, vier moegliche Preise. Gezogen wird ein Paar
  // je Angebot, und der Preis trifft NIE die Groesse, die der Segen hebt —
  // sonst hoeben sich beide auf und die Wahl waere leer.
  var SCHREIN_SEGEN = [
    { id: 'macht',       feld: 'damageMult',      basis: 0.25, jeTiefe: 0.015, deckel: 0.55 },
    { id: 'hast',        feld: 'attackSpeedMult', basis: 0.15, jeTiefe: 0.010, deckel: 0.35 },
    { id: 'zaehigkeit',  feld: 'armorMult',       basis: 0.20, jeTiefe: 0.012, deckel: 0.45 },
    { id: 'eile',        feld: 'speedMult',       basis: 0.12, jeTiefe: 0.008, deckel: 0.28 }
  ];
  // Preise als Band: zwei Begegnungen sind dann nicht identisch.
  var SCHREIN_PREISE = [
    { id: 'ruestung',      feld: 'armorMult',       von: 0.30, bis: 0.40 },
    { id: 'lauftempo',     feld: 'speedMult',       von: 0.15, bis: 0.22 },
    { id: 'angriffstempo', feld: 'attackSpeedMult', von: 0.15, bis: 0.22 },
    { id: 'schaden',       feld: 'damageMult',      von: 0.15, bis: 0.22 }
  ];

  /**
   * Zieht die Angebote eines Schreins.
   *
   * @param {number} tiefe  aktuelle Dungeon-Tiefe
   * @param {function} rng  Zufallsquelle (fuer Tests steuerbar)
   * @param {number} [anzahl=2] wie viele Angebote nebeneinander stehen
   * @returns {Array<{segen,preis,segenProzent,preisProzent,segenFaktor,preisFaktor}>}
   */
  function schreinAngebote(tiefe, rng, anzahl) {
    var r = (typeof rng === 'function') ? rng : Math.random;
    var t = Math.max(1, tiefe || 1);
    var wieViele = anzahl || 2;
    var offen = SCHREIN_SEGEN.slice();
    var raus = [];
    for (var i = 0; i < wieViele && offen.length; i++) {
      var segen = offen.splice(Math.floor(r() * offen.length), 1)[0];
      // Preis darf nicht dieselbe Groesse treffen wie der Segen.
      var moegliche = SCHREIN_PREISE.filter(function (p) { return p.feld !== segen.feld; });
      var preis = moegliche[Math.floor(r() * moegliche.length)];
      var segenAnteil = Math.min(segen.deckel, segen.basis + segen.jeTiefe * (t - 1));
      var preisAnteil = preis.von + r() * (preis.bis - preis.von);
      raus.push({
        segen: segen,
        preis: preis,
        segenFaktor: 1 + segenAnteil,
        preisFaktor: 1 - preisAnteil,
        segenProzent: Math.round(segenAnteil * 100),
        preisProzent: Math.round(preisAnteil * 100)
      });
    }
    return raus;
  }

  /** Traegt ein angenommenes Angebot in die Lauf-Buffs ein. */
  function schreinAnwenden(angebot) {
    if (!angebot) return null;
    window.eventBuffs = window.eventBuffs
      || { damageMult: 1, armorAdd: 0, armorMult: 1, speedMult: 1, attackSpeedMult: 1 };
    var b = window.eventBuffs;
    // Aeltere Spielstaende kennen attackSpeedMult noch nicht.
    if (typeof b.attackSpeedMult !== 'number') b.attackSpeedMult = 1;
    b[angebot.segen.feld] = (b[angebot.segen.feld] || 1) * angebot.segenFaktor;
    b[angebot.preis.feld] = (b[angebot.preis.feld] || 1) * angebot.preisFaktor;
    if (typeof recalcDerived === 'function') recalcDerived(0, 0);
    return b;
  }

  EVENT_TYPES.push({
    id: 'shrine_buff',
    name: T('event.shrine.name'),
    weight: 14,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, T('event.shrine.toast_spawn'), 'shrine_buff');
      var angebote = schreinAngebote(window.DUNGEON_DEPTH || 1, Math.random);
      spawnEventObject(scene, 'evt_shrine', 0x6644aa, 0xaa88ff, T('event.shrine.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}
        var wahlen = angebote.map(function (a) {
          var segenText = T('event.shrine.segen.' + a.segen.id, { wert: a.segenProzent });
          var preisText = T('event.shrine.preis.' + a.preis.id, { wert: a.preisProzent });
          return {
            label: T('event.shrine.angebot', { segen: segenText, preis: preisText }),
            callback: function () {
              schreinAnwenden(a);
              showEventToast(scene, T('event.shrine.toast_angenommen',
                { segen: segenText, preis: preisText }), 'shrine_buff');
            }
          };
        });
        wahlen.push({ label: T('event.shrine.choice_ignore'), callback: function () {} });
        showEventChoiceDialog(scene, T('event.shrine.name'), wahlen);
      });
    }
  });

  EVENT_TYPES.push({
    id: 'gambling',
    name: T('event.gambling.name'),
    weight: 10,
    minDepth: 3,
    handler: function (scene) {
      // Der Einsatz stand fest bei 50-99 Gold: ab Tiefe 10 war das Trinkgeld.
      var cost = 50 + 25 * Math.max(1, window.DUNGEON_DEPTH || 1);
      showEventToast(scene, T('event.gambling.toast_spawn'), 'gambling');
      spawnEventObject(scene, 'evt_gamble', 0x886622, 0xffcc44, T('event.gambling.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        showEventChoiceDialog(scene, T('event.gambling.title', { cost: cost }), [
          {
            label: T('event.gambling.choice_bet', { cost: cost }),
            callback: function () {
              if (!window.LootSystem || !window.LootSystem.spendGold(cost)) {
                showEventToast(scene, T('event.gambling.toast_no_gold'), 'gambling');
                return;
              }
              // 40 % auf das Dreifache ergaben einen Erwartungswert von +20 %
              // je Wurf: immer setzen war die einzig richtige Antwort, der
              // Tisch also eine Gelddruckmaschine statt eines Wagnisses.
              //
              // Jetzt drei Ausgaenge: 30 % Dreifaches (Erwartungswert -10 %),
              // 50 % Einsatz weg, 20 % Einsatz weg UND gezeichnet.
              var _wurf = Math.random();
              if (_wurf < 0.30) {
                var winnings = cost * 3;
                if (window.LootSystem && window.LootSystem.grantGold) {
                  window.LootSystem.grantGold(winnings);
                }
                var netGain = winnings - cost;
                showEventToast(scene, T('event.gambling.toast_won', { amount: netGain }), 'gambling');
              } else if (_wurf < 0.80) {
                showEventToast(scene, T('event.gambling.toast_lost', { amount: cost }), 'gambling');
              } else {
                // Gezeichnet: gilt bis zum Ende der TIEFE, nicht des Raums.
                // window.tiefenBuffs wird beim Rueckweg in den Hub und im
                // Endlosmodus beim Aufstieg geleert.
                zeichneSpieler(0.10);
                showEventToast(scene, T('event.gambling.toast_marked', { wert: 10 }), 'gambling');
              }
            }
          },
          { label: T('event.gambling.choice_decline'), callback: function () {} }
        ]);
      });
    }
  });

  /**
   * Setzt das Zeichen des Hauses: Ruestungsabzug bis zum Ende der Tiefe.
   *
   * Eigene Schicht (window.tiefenBuffs), NICHT eventBuffs: die gelten fuer den
   * ganzen Durchgang, das Zeichen nur fuer diese Tiefe.
   *
   * @param {number} anteil z.B. 0.10 fuer -10 % Ruestung
   */
  function zeichneSpieler(anteil) {
    window.tiefenBuffs = window.tiefenBuffs
      || { damageMult: 1, armorAdd: 0, armorMult: 1, speedMult: 1, attackSpeedMult: 1 };
    window.tiefenBuffs.armorMult = (window.tiefenBuffs.armorMult || 1) * (1 - anteil);
    if (typeof recalcDerived === 'function') recalcDerived(0, 0);
    return window.tiefenBuffs;
  }

  // Elite ambush — fires immediately (no interaction needed)
  EVENT_TYPES.push({
    id: 'elite_ambush',
    name: T('event.elite.name'),
    weight: 8,
    minDepth: 5,
    handler: function (scene) {
      try { window.soundManager && window.soundManager.playSFX('enemy_death'); } catch (e) {}
      showEventToast(scene, T('event.elite.toast_spawn'), 'elite_ambush');
      // #71: Der Elite-Hinterhalt zahlte nichts Eigenes — die Beute kam aus der
      // gewoehnlichen Tabelle, ein Mini-Boss lohnte also nicht mehr als ein
      // normaler Kampf. Jetzt eine garantierte Beute UND eine Wahl davor: der
      // Preis, den ein Kampfereignis tragen kann, ohne zu bestrafen.
      showEventChoiceDialog(scene, T('event.elite.name'), [
        {
          label: T('event.elite.choice_accept'),
          callback: function () { eliteStellen(scene, false); }
        },
        {
          label: T('event.elite.choice_challenge'),
          callback: function () {
            showEventToast(scene, T('event.elite.toast_challenge'), 'elite_ambush');
            eliteStellen(scene, true);
          }
        }
      ]);
    }
  });

  /**
   * Setzt den Elite-Gegner und haengt ihm seine Belohnung an.
   *
   * @param {Phaser.Scene} scene
   * @param {boolean} herausgefordert staerker, dafuer eine Stufe bessere Beute
   */
  function eliteStellen(scene, herausgefordert) {
    if (typeof spawnMiniBoss !== 'function' || !scene.time) return;
    var tiefe = window.DUNGEON_DEPTH || 1;
    scene.time.delayedCall(500, function () {
      var elite = null;
      try { elite = spawnMiniBoss.call(scene, 0, 0, 0); } catch (e) { return; }
      if (!elite) return;
      try {
        if (herausgefordert) {
          elite.maxHp = Math.round((elite.maxHp || 100) * 1.3);
          elite.hp = elite.maxHp;
          elite.damage = Math.round((elite.damage || 10) * 1.15);
        }
        // Beute haengt am Gegner, nicht an einem Wellen-Haken: er faellt, sie
        // faellt. Dieselbe Verdrahtung wie beim Pluenderer im Hinterhalt.
        elite.setData('eliteBeute', {
          iLevel: tiefe + 4,
          stufe: herausgefordert ? 3 : 2
        });
      } catch (e) { /* Optik und Zusatzbeute duerfen den Kampf nie brechen */ }
    });
  }

  // --- Opferstein (#71) ----------------------------------------------------
  //
  // Tiefe 1 kannte nur Schatz und Lore-Fragment, beide ohne Entscheidung. Der
  // Opferstein braucht kein Gold und keinen Kampf und kostet trotzdem etwas:
  // er nimmt ein ANGELEGTES Stueck, nicht eines aus dem Inventar. Man gibt
  // her, was man gerade traegt.
  //
  // Zurueck kommt kein garantierter Aufstieg, sondern ein UMWURF: dieselbe
  // Basis, dieselbe Seltenheit, frisch gewuerfelt auf Tiefe + 2. Besser,
  // gleichwertig oder schlechter — das entscheidet der Wurf.
  var ALTAR_SLOTS = ['weapon', 'head', 'body', 'boots', 'offhand'];

  /** Welche angelegten Stuecke koennte der Stein annehmen? */
  function opferKandidaten() {
    var aus = [];
    var eq = window.equipment;
    if (!eq) return aus;
    ALTAR_SLOTS.forEach(function (slot) {
      var it = eq[slot];
      // Amulette bleiben aussen vor: sie tragen keine Werte, nur einen Effekt.
      if (it && it.key && !it.isAmulet && it.type !== 'amulet') {
        aus.push({ slot: slot, item: it });
      }
    });
    return aus;
  }

  /**
   * Wirft ein angelegtes Stueck neu.
   *
   * @returns {{alt:number, neu:number, item:object}|null} Item-Staerke vorher
   *          und nachher, plus das neue Stueck.
   */
  function opferUmwurf(slot, tiefe) {
    var eq = window.equipment;
    if (!eq || !eq[slot] || !window.LootSystem
        || typeof window.LootSystem.rollItem !== 'function') return null;
    var alt = eq[slot];
    var stufe = (typeof alt.tier === 'number') ? alt.tier : 0;
    var neu = window.LootSystem.rollItem(alt.key, Math.max(1, (tiefe || 1) + 2), stufe);
    if (!neu) return null;
    var staerke = (typeof window.computeItemPower === 'function')
      ? window.computeItemPower : function () { return 0; };
    var vorher = staerke(alt), nachher = staerke(neu);
    eq[slot] = neu;
    if (typeof recalcDerived === 'function') recalcDerived(0, 0);
    if (typeof window.updateInventoryUI === 'function') {
      try { window.updateInventoryUI(); } catch (e) {}
    }
    return { alt: vorher, neu: nachher, item: neu };
  }

  // --- Kettenschloss (#71) -------------------------------------------------
  //
  // Ein echtes Minispiel statt eines Knopfdrucks. Warum kein Kartenspiel: diese
  // Stadt heisst nach ihren Ketten. Ein verkettetes Gitter aufzubrechen kommt
  // aus dem Stoff des Spiels, Blackjack waere Taverneninventar.
  //
  // Eigenes Ereignis, nicht an Truhen allgemein gehaengt: so hat es eine eigene
  // Haeufigkeit und laesst sich abschalten. Ein Minispiel vor JEDER Truhe
  // nervt beim zehnten Mal.
  EVENT_TYPES.push({
    id: 'chain_lock',
    name: T('event.lock.name'),
    weight: 11,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, T('event.lock.toast_spawn'), 'chain_lock');
      spawnEventObject(scene, 'evt_schloss', 0x6b5426, 0xffd166,
        T('event.lock.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        var tiefe = window.DUNGEON_DEPTH || 1;
        if (!window.Kettenschloss || typeof window.Kettenschloss.spiele !== 'function') return;
        window.Kettenschloss.spiele(scene, tiefe, function (erg) {
          var lohn = window.Kettenschloss.belohnung(erg.gesetzt, erg.anzahl, tiefe, erg.verloren);
          try {
            if (lohn.art === 'item' && window.LootSystem
                && typeof window.LootSystem.rollItem === 'function'
                && typeof spawnLoot === 'function') {
              var stueck = window.LootSystem.rollItem(null, lohn.iLevel, lohn.stufe);
              if (stueck) spawnLoot.call(scene, player.x, player.y - 30, stueck, null);
              showEventToast(scene, T('event.lock.won'), 'chain_lock');
            } else if (lohn.art === 'gold') {
              if (window.LootSystem && window.LootSystem.grantGold) {
                window.LootSystem.grantGold(lohn.gold);
              }
              showEventToast(scene, T('event.lock.partial', { gold: lohn.gold }), 'chain_lock');
            } else {
              showEventToast(scene, T('event.lock.lost'), 'chain_lock');
            }
          } catch (e) { /* eine fehlende Belohnung darf den Raum nie brechen */ }
        });
      });
    }
  });

  EVENT_TYPES.push({
    id: 'sacrifice_altar',
    name: T('event.altar.name'),
    weight: 10,
    minDepth: 1,
    handler: function (scene) {
      showEventToast(scene, T('event.altar.toast_spawn'), 'sacrifice_altar');
      spawnEventObject(scene, 'evt_opferstein', 0x4b4657, 0x8c1d20,
        T('event.altar.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('click'); } catch (e) {}
        var tiefe = window.DUNGEON_DEPTH || 1;
        var kandidaten = opferKandidaten();
        if (!kandidaten.length) {
          showEventToast(scene, T('event.altar.nothing_equipped'), 'sacrifice_altar');
          return;
        }
        var wahlen = kandidaten.map(function (k) {
          return {
            label: T('event.altar.choice', {
              name: k.item.displayName || k.item.name || '?',
              slot: T('event.altar.slot.' + k.slot)
            }),
            callback: function () {
              var r = opferUmwurf(k.slot, tiefe);
              if (!r) return;
              var schluessel = (r.neu > r.alt) ? 'better'
                             : (r.neu === r.alt) ? 'same' : 'worse';
              // Ohne Zahlen: die Item-Staerke ist eine interne Kennzahl, und
              // "18 -> 21" sagt am Bildschirmrand niemandem etwas. Was das
              // Stueck taugt, steht im Tooltip.
              showEventToast(scene, T('event.altar.' + schluessel), 'sacrifice_altar');
            }
          };
        });
        wahlen.push({ label: T('event.altar.choice_ignore'), callback: function () {} });
        showEventChoiceDialog(scene, T('event.altar.name'), wahlen);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Healing fountain — REWORKED (#16). Risk/reward choice with weighted
  // random outcomes. All buff/debuff effects are run-scoped (cleared on
  // hub return via leaveDungeonForHub). HP debuff hits MAX HP (not current).
  //
  // Outcome tables live in a single config object so weights / values can be
  // tuned in one place (spec C-03). To re-balance: edit FOUNTAIN_OUTCOMES.
  // -------------------------------------------------------------------------
  var FOUNTAIN_OUTCOMES = {
    drink: [
      // 50% buff (weighted across the four buff types)
      { weight: 18, kind: 'buff_damage',  toastKey: 'event.fountain.outcome.damage_buff' },
      { weight: 12, kind: 'buff_speed',   toastKey: 'event.fountain.outcome.speed_buff'  },
      { weight: 10, kind: 'buff_armor',   toastKey: 'event.fountain.outcome.armor_buff'  },
      { weight: 10, kind: 'heal',         toastKey: 'event.fountain.outcome.heal'        },
      // 30% loot
      { weight: 30, kind: 'loot',         toastKey: 'event.fountain.outcome.loot'        },
      // 20% debuff (weighted across the three debuff types)
      { weight:  8, kind: 'debuff_maxhp',  toastKey: 'event.fountain.outcome.maxhp_debuff'  },
      { weight:  6, kind: 'debuff_speed',  toastKey: 'event.fountain.outcome.speed_debuff'  },
      { weight:  6, kind: 'debuff_damage', toastKey: 'event.fountain.outcome.damage_debuff' }
    ],
    // #71: Blut und Gold fuehrten frueher auf DIESELBE Tabelle — 25 % des
    // maximalen Lebens fuer den ganzen Lauf und 50 Gold kauften exakt dasselbe.
    // In der Tiefe ist Gold reichlich und Leben knapp; die Wahl war keine.
    // Jetzt kauft jeder Weg etwas anderes.
    //
    // Blut kauft KRAFT. Kein "nichts" mehr: wer bleibende Leben hergibt, darf
    // nicht leer ausgehen.
    blut: [
      { weight: 40, kind: 'buff_damage_strong',  toastKey: 'event.fountain.outcome.strong_buff' },
      { weight: 35, kind: 'heal_and_buff_armor', toastKey: 'event.fountain.outcome.armor_buff'  },
      { weight: 25, kind: 'buff_attackspeed',    toastKey: 'event.fountain.outcome.haste_buff'  }
    ],
    // Gold kauft BEUTE. Alles auf Tiefenniveau, damit der Preis mitwaechst.
    gold: [
      { weight: 60, kind: 'loot_magisch', toastKey: 'event.fountain.outcome.loot'      },
      { weight: 30, kind: 'loot_selten',  toastKey: 'event.fountain.outcome.rare_loot' },
      { weight: 10, kind: 'traenke',      toastKey: 'event.fountain.outcome.potions'   }
    ]
  };
  // Der Goldpreis waechst mit der Tiefe: 50 Gold waren ab Tiefe 5 geschenkt,
  // waehrend der Blutpreis (25 % Max-LP) immer gleich weh tat.
  function brunnenGoldPreis(tiefe) {
    return 40 + 20 * Math.max(1, tiefe || 1);
  }

  function _pickFountainOutcome(table) {
    var total = 0;
    for (var i = 0; i < table.length; i++) total += table[i].weight;
    var roll = Math.random() * total;
    for (var j = 0; j < table.length; j++) {
      roll -= table[j].weight;
      if (roll <= 0) return table[j];
    }
    return table[table.length - 1];
  }

  // Apply an outcome to game state. Buffs/debuffs go through
  // window.brunnenBuffs (a new run-scoped registry, cleared by
  // main.js leaveDungeonForHub). Heal goes through setPlayerHealth.
  // Loot goes through spawnLoot.
  function _applyFountainOutcome(scene, outcome) {
    if (!outcome) return;
    if (!window.brunnenBuffs) {
      window.brunnenBuffs = {
        damageMult: 1,
        speedMult: 1,
        armorAdd: 0,
        maxHpAdd: 0
      };
    }
    var bb = window.brunnenBuffs;
    var px = (typeof player !== 'undefined' && player) ? player.x : 0;
    var py = (typeof player !== 'undefined' && player) ? player.y : 0;
    switch (outcome.kind) {
      case 'heal':
        if (typeof window.setPlayerHealth === 'function' && typeof window.playerMaxHealth === 'number') {
          window.setPlayerHealth(window.playerMaxHealth);
        }
        break;
      case 'buff_damage':
        bb.damageMult *= 1.25;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'buff_damage_strong':
        bb.damageMult *= 1.50;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'buff_speed':
        bb.speedMult *= 1.20;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'buff_armor':
        bb.armorAdd += 0.05;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'heal_and_buff_armor':
        bb.armorAdd += 0.05;
        if (typeof window.setPlayerHealth === 'function' && typeof window.playerMaxHealth === 'number') {
          window.setPlayerHealth(window.playerMaxHealth);
        }
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'debuff_speed':
        bb.speedMult *= 0.90;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'debuff_damage':
        bb.damageMult *= 0.90;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'debuff_maxhp':
        // Max-HP debuff (FR-12): apply via brunnenBuffs.maxHpAdd, recalc,
        // then clamp current HP to the new max. recalcDerived's default
        // setPlayerMaxHealth path uses delta-based current HP adjustment
        // which would over-shrink current HP for a wounded player; the
        // explicit clamp afterward fixes that.
        var origCurrent = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
        var oldMax = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : 1;
        var debuffAmount = Math.max(1, Math.round(oldMax * 0.20));
        bb.maxHpAdd -= debuffAmount;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        // Clamp to ensure current HP never exceeds new max; preserve wound.
        var newMax = Math.max(1, window.playerMaxHealth || 1);
        if (typeof window.setPlayerHealth === 'function') {
          window.setPlayerHealth(Math.min(origCurrent, newMax), true);
        }
        break;
      case 'loot':
        if (typeof spawnLoot === 'function') {
          try { spawnLoot.call(scene, px + 30, py, null, null); } catch (e) {}
        }
        break;
      case 'buff_attackspeed':
        bb.attackSpeedMult = (bb.attackSpeedMult || 1) * 1.25;
        if (typeof recalcDerived === 'function') recalcDerived(0, 0);
        break;
      case 'loot_magisch':
      case 'loot_selten':
        if (window.LootSystem && typeof window.LootSystem.rollItem === 'function'
            && typeof spawnLoot === 'function') {
          try {
            var _stufe = (outcome.kind === 'loot_selten') ? 2 : 1;
            var _lvl = (window.DUNGEON_DEPTH || 1) + 3;
            var _stueck = window.LootSystem.rollItem(null, _lvl, _stufe);
            if (_stueck) spawnLoot.call(scene, px + 30, py, _stueck, null);
          } catch (e) {}
        }
        break;
      case 'traenke':
        if (typeof window.makePotionDrop === 'function' && typeof spawnLoot === 'function') {
          try {
            var _t = (window.DUNGEON_DEPTH || 1);
            spawnLoot.call(scene, px + 20, py, window.makePotionDrop(_t), null);
            spawnLoot.call(scene, px + 44, py, window.makePotionDrop(_t), null);
          } catch (e) {}
        }
        break;
      case 'rare_loot':
        if (window.LootSystem && typeof window.LootSystem.rollItem === 'function' && typeof spawnLoot === 'function') {
          try {
            // iLevel 8 stand hier fest verdrahtet: auf Tiefe 20 war der
            // Hauptpreis des teuersten Brunnen-Wegs ein Stueck vom Niveau
            // Tiefe 8. Belohnungen muessen mit der Tiefe wachsen.
            var _rareLvl = (window.DUNGEON_DEPTH || 1) + 3;
            var rare = window.LootSystem.rollItem(null, _rareLvl, 2); // forceTier 2
            spawnLoot.call(scene, px + 30, py, rare, null);
          } catch (e) {
            // Fall back to a plain loot drop if the roll fails.
            try { spawnLoot.call(scene, px + 30, py, null, null); } catch (e2) {}
          }
        }
        break;
      case 'nothing':
      default:
        break;
    }
  }

  EVENT_TYPES.push({
    id: 'healing_fountain',
    name: T('event.fountain.name'),
    weight: 10,
    minDepth: 2,
    handler: function (scene) {
      showEventToast(scene, T('event.fountain.toast_spawn'), 'healing_fountain');
      spawnEventObject(scene, 'evt_fountain', 0x2266aa, 0x44aaff, T('event.fountain.object_label'), function () {
        try { window.soundManager && window.soundManager.playSFX('level_up'); } catch (e) {}

        // Decide which "Opfern" cost the player can pay. Prefer Max-HP cost
        // (run-scoped, more impactful), fall back to gold, hide if neither
        // possible. The Max-HP path requires player Max-HP > 4 so the 25%
        // cut doesn't reduce max to zero on a level-1 character.
        var curHp = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
        var maxHp = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : 1;
        var canPayHp = maxHp > 4; // max 5+ → 25% cut leaves >= 4 max-HP for the run
        var gold = (window.LootSystem && typeof window.LootSystem.getGold === 'function') ? window.LootSystem.getGold() : 0;
        var goldKosten = brunnenGoldPreis(window.DUNGEON_DEPTH || 1);
        var canPayGold = gold >= goldKosten;

        var choices = [
          {
            label: T('event.fountain.choice_drink'),
            callback: function () {
              var outcome = _pickFountainOutcome(FOUNTAIN_OUTCOMES.drink);
              _applyFountainOutcome(scene, outcome);
              showEventToast(scene, T(outcome.toastKey), 'healing_fountain');
            }
          }
        ];
        if (canPayHp) {
          choices.push({
            label: T('event.fountain.choice_offer'),
            callback: function () {
              // Pay cost = 25% of MAX HP, RUN-SCOPED via brunnenBuffs.maxHpAdd
              // (cleared on hub return — same registry as the Brunnen rework
              // debuff path + the cursed-chest fix). Mechanic mirrors the
              // canonical run-scoped max-HP debuff pattern: subtract via
              // adjustStanding equivalent, recalcDerived, then clamp current
              // HP to the new max so an existing wound is preserved.
              if (!window.brunnenBuffs) {
                window.brunnenBuffs = { damageMult: 1, speedMult: 1, armorAdd: 0, maxHpAdd: 0 };
              }
              var maxHpNow = (typeof window.playerMaxHealth === 'number') ? window.playerMaxHealth : 1;
              var cost = Math.max(1, Math.round(maxHpNow * 0.25));
              var origCurrent = (typeof window.playerHealth === 'number') ? window.playerHealth : 0;
              window.brunnenBuffs.maxHpAdd -= cost;
              if (typeof recalcDerived === 'function') recalcDerived(0, 0);
              var newMax = Math.max(1, window.playerMaxHealth || 1);
              if (typeof window.setPlayerHealth === 'function') {
                window.setPlayerHealth(Math.min(origCurrent, newMax), true);
              }
              var outcome = _pickFountainOutcome(FOUNTAIN_OUTCOMES.blut);
              _applyFountainOutcome(scene, outcome);
              showEventToast(scene, T(outcome.toastKey), 'healing_fountain');
            }
          });
        }
        // Frueher stand die Goldwahl im else-Zweig: sie erschien NUR, wenn die
        // Leben nicht zahlbar waren. Die beiden Wege standen also nie
        // nebeneinander — und da sie ohnehin dieselbe Tabelle zogen, fiel es
        // nicht auf. Jetzt kaufen sie Verschiedenes und muessen beide dastehen.
        if (canPayGold) {
          choices.push({
            label: T('event.fountain.choice_offer_gold', { kosten: goldKosten }),
            callback: function () {
              if (window.LootSystem && typeof window.LootSystem.spendGold === 'function') {
                window.LootSystem.spendGold(goldKosten);
              }
              var outcome = _pickFountainOutcome(FOUNTAIN_OUTCOMES.gold);
              _applyFountainOutcome(scene, outcome);
              showEventToast(scene, T(outcome.toastKey), 'healing_fountain');
            }
          });
        }
        choices.push({ label: T('event.fountain.choice_ignore'), callback: function () {} });

        showEventChoiceDialog(scene, T('event.fountain.name'), choices);
      });
    }
  });

  var lastEventId = null;
  var recentEvents = []; // last 3 event IDs for anti-repetition

  function shouldTriggerEvent(depth) {
    var chance = 0.35 + (depth - 1) * 0.02;
    return Math.random() < Math.min(0.55, chance);
  }

  function pickEvent(depth) {
    var eligible = EVENT_TYPES.filter(function(e) {
      if (depth < e.minDepth) return false;
      if (e.id === lastEventId) return false;
      // Anti-repetition: reduce weight if event appeared in last 3
      return true;
    });
    // Soft anti-repetition: halve weight of recently seen events
    eligible = eligible.map(function(e) {
      var count = 0;
      for (var i = 0; i < recentEvents.length; i++) {
        if (recentEvents[i] === e.id) count++;
      }
      if (count > 0) return { id: e.id, name: e.name, weight: Math.max(1, Math.floor(e.weight / (count + 1))), minDepth: e.minDepth, handler: e.handler };
      return e;
    });
    if (!eligible.length) return null;

    var totalWeight = eligible.reduce(function(sum, e) { return sum + e.weight; }, 0);
    var roll = Math.random() * totalWeight;
    for (var i = 0; i < eligible.length; i++) {
      roll -= eligible[i].weight;
      if (roll <= 0) return eligible[i];
    }
    return eligible[eligible.length - 1];
  }

  var EVENT_ACCENT_COLORS = {
    treasure_cache:      0xf5c518,
    ambush:              0xff3333,
    wandering_merchant:  0x44ddaa,
    trapped_chest:       0xaa44ff,
    lore_fragment:       0x66bbff,
    environmental_hazard: 0xff8833
  };

  function showEventToast(scene, message, eventId) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 800;
    var cx = camW / 2;
    var cy = 80;

    // Nur EIN Event-Toast gleichzeitig — alle liegen an derselben Position (cx,80).
    // Sonst überblenden sich z. B. der Decke-Einsturz-Warntoast (t=0, ~3,7s
    // sichtbar) und der Treffer/Ausweich-Toast (t≈1,5s). Vorherigen sofort weg.
    if (scene._activeEventToast) {
      try {
        var _old = scene._activeEventToast;
        if (_old.panel && _old.panel.destroy) _old.panel.destroy();
        if (_old.label && _old.label.destroy) _old.label.destroy();
      } catch (e) {}
      scene._activeEventToast = null;
    }

    var accentHex = EVENT_ACCENT_COLORS[eventId] || 0xffdd44;

    // Create label first to measure its width, then size the panel around it.
    var maxTextWidth = camW - 100;
    var label = scene.add.text(cx, cy, message, {
      fontSize: '18px', fill: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: maxTextWidth, useAdvancedWrap: true },
      resolution: 2
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0).setAlpha(0);

    // Panel sized to fit the rendered text (+padding)
    var padX = 20, padY = 10;
    var panelW = Math.min(camW - 40, Math.ceil(label.width) + padX * 2);
    var panelH = Math.ceil(label.height) + padY * 2;

    var panel = scene.add.graphics();
    panel.fillStyle(0x0d0d1a, 0.88);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panel.lineStyle(2, accentHex, 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panel.setDepth(1999).setScrollFactor(0).setAlpha(0);

    scene._activeEventToast = { panel: panel, label: label };

    var targets = [panel, label];

    if (scene.tweens && scene.tweens.add) {
      // Simple fade in (no scale — scale caused text to overflow panel)
      scene.tweens.add({
        targets: targets,
        alpha: 1,
        duration: 250,
        ease: 'Power2',
        onComplete: function() {
          // Hold, then fade out with upward drift
          scene.tweens.add({
            targets: targets,
            alpha: 0,
            y: '+=-30',
            delay: 3200,
            duration: 550,
            ease: 'Power2',
            onComplete: function() {
              panel.destroy();
              label.destroy();
              if (scene._activeEventToast && scene._activeEventToast.label === label) scene._activeEventToast = null;
            }
          });
        }
      });
    } else {
      setTimeout(function() {
        if (panel && panel.destroy) panel.destroy();
        if (label && label.destroy) label.destroy();
        if (scene._activeEventToast && scene._activeEventToast.label === label) scene._activeEventToast = null;
      }, 4000);
    }
  }

  // --- Wandering Merchant ---
  var activeMerchant = null;

  function spawnMerchant(scene) {
    if (!scene || !scene.add) return;
    cleanupMerchant();

    // Load merchant texture on-demand if not available
    var texKey = 'spaeherin';
    if (!scene.textures.exists(texKey)) {
      scene.load.image(texKey, 'assets/sprites/spaeherin.png');
      scene.load.once('complete', function() {
        // 052 WP03: filter the painterly merchant sprite after lazy-load
        if (window.RenderQuality) {
          window.RenderQuality.applyLinearFilter(scene, [texKey]);
        }
        _placeMerchant(scene, texKey);
      });
      scene.load.start();
    } else {
      // Already loaded — re-apply in case filter was wiped by a scene boot
      if (window.RenderQuality) {
        window.RenderQuality.applyLinearFilter(scene, [texKey]);
      }
      _placeMerchant(scene, texKey);
    }
  }

  function _placeMerchant(scene, texKey) {
    if (!scene || !scene.add || !scene.physics) return;

    // Find an accessible position using the spawn system (nicht auf einer Treppe).
    var cx = 400, cy = 250;
    if (scene.pickAccessibleSpawnPoint) {
      for (var _ma = 0; _ma < 12; _ma++) {
        var spot = scene.pickAccessibleSpawnPoint({ maxAttempts: 30 });
        if (!spot) break;
        if (typeof window.isNearStair === 'function' && window.isNearStair(scene, spot.x, spot.y, 40)) continue;
        cx = spot.x; cy = spot.y; break;
      }
    } else {
      // Fallback: near player
      if (typeof player !== 'undefined' && player && player.active) {
        var angle = Math.random() * Math.PI * 2;
        cx = player.x + Math.cos(angle) * 150;
        cy = player.y + Math.sin(angle) * 150;
      }
    }

    var merchant = scene.physics.add.sprite(cx, cy, texKey);
    merchant.setDepth(150);
    merchant.body.setImmovable(true);
    merchant.body.setAllowGravity(false);

    // Scale to reasonable NPC size (~120px tall)
    var h = merchant.height || 200;
    merchant.setScale(120 / h);

    // Interaction prompt (floating text above merchant)
    var scaledH = 120;
    var prompt = scene.add.text(cx, cy - scaledH / 2 - 10, '[E] Handel', {
      fontSize: '14px', fill: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 2, align: 'center'
    }).setOrigin(0.5).setDepth(151);

    // Track overlap with player
    var playerRef = window.player || (scene.physics && scene.physics.world &&
      scene.physics.world.bodies && scene.physics.world.bodies.entries &&
      Array.from(scene.physics.world.bodies.entries).find(function(b) {
        return b.gameObject && b.gameObject.body && b.gameObject.body.maxVelocity;
      }));

    var inRange = false;
    var interactHandler = null;

    if (typeof player !== 'undefined' && player) {
      // Check distance each frame
      var distanceHandler = function() {
        if (!merchant || !merchant.active || !player || !player.active) return;
        var dx = merchant.x - player.x;
        var dy = merchant.y - player.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        inRange = dist < 80;
        prompt.setVisible(inRange);
        // Update prompt position to follow merchant
        prompt.setPosition(merchant.x, merchant.y - 70);
      };
      scene.events.on('update', distanceHandler);

      // E key to interact
      interactHandler = function() {
        if (!inRange || !merchant || !merchant.active) return;
        if (typeof window.openShopScene === 'function') {
          // Pass dungeon merchant flag for cheaper prices, no reroll tab
          window._dungeonMerchant = true;
          window.openShopScene(scene);
        }
      };
      scene.input.keyboard.on('keydown-E', interactHandler);

      // Mobile interact support: the [E]-key path doesn't exist on touch. Poll
      // window.__MOBILE_INTERACT_ACTIVE__ (set by the mobile interact button)
      // each frame. The merchant persists after use (the shop is re-openable),
      // so debounce with a consume flag — like the door pattern in main.js —
      // otherwise the ~180ms interact pulse re-opens the shop every frame.
      var mobileHandler = function () {
        if (!window.__MOBILE_INTERACT_ACTIVE__) { window.__merchantInteractConsumed = false; return; }
        if (window.__merchantInteractConsumed) return;
        window.__merchantInteractConsumed = true;
        interactHandler();
      };
      scene.events.on('update', mobileHandler);
    }

    activeMerchant = {
      sprite: merchant,
      prompt: prompt,
      interactHandler: interactHandler,
      distanceHandler: (typeof distanceHandler !== 'undefined') ? distanceHandler : null,
      mobileHandler: (typeof mobileHandler !== 'undefined') ? mobileHandler : null,
      scene: scene
    };

    showEventToast(scene, T('event.merchant.toast_spawn'), 'wandering_merchant');
  }

  function cleanupMerchant() {
    if (!activeMerchant) return;
    if (activeMerchant.sprite && activeMerchant.sprite.destroy) activeMerchant.sprite.destroy();
    if (activeMerchant.prompt && activeMerchant.prompt.destroy) activeMerchant.prompt.destroy();
    if (activeMerchant.interactHandler && activeMerchant.scene &&
        activeMerchant.scene.input && activeMerchant.scene.input.keyboard) {
      activeMerchant.scene.input.keyboard.off('keydown-E', activeMerchant.interactHandler);
    }
    // Remove the per-frame update listeners (distance + mobile interact) so they
    // don't accumulate across rooms/runs.
    if (activeMerchant.scene && activeMerchant.scene.events) {
      if (activeMerchant.distanceHandler) activeMerchant.scene.events.off('update', activeMerchant.distanceHandler);
      if (activeMerchant.mobileHandler) activeMerchant.scene.events.off('update', activeMerchant.mobileHandler);
    }
    window.__merchantInteractConsumed = false;
    activeMerchant = null;
  }

  // --- Treasure & Trapped Chests ---
  function spawnEventChest(scene, chestType, isTrapped) {
    if (!scene || !scene.spawnObstacle) return;
    // Spawn chest near player. Try up to 16 random offsets (60-220 px) and
    // pick the first one that isn't blocked by a wall / obstacle. The
    // previous code used a single fixed-distance angle which would happily
    // place the chest inside a wall — visible but unreachable. Mirrors
    // the lore-scroll wall-spawn fix from earlier.
    var px = 400, py = 250;
    if (typeof player !== 'undefined' && player && player.active) {
      var bounds = scene.physics.world && scene.physics.world.bounds;
      var halfSize = 24; // chest sprite half-width-ish
      var placed = false;
      for (var attempt = 0; attempt < 16 && !placed; attempt++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = 60 + Math.random() * 160;
        var tx = player.x + Math.cos(angle) * dist;
        var ty = player.y + Math.sin(angle) * dist;
        if (bounds) {
          var margin = halfSize + 16;
          if (tx < bounds.x + margin || tx > bounds.x + bounds.width - margin) continue;
          if (ty < bounds.y + margin || ty > bounds.y + bounds.height - margin) continue;
        }
        var blocked = false;
        if (typeof window !== 'undefined' && typeof window.isSpawnPositionBlocked === 'function') {
          try { blocked = !!window.isSpawnPositionBlocked(tx, ty, halfSize); } catch (_) { blocked = false; }
        }
        if (!blocked) {
          px = tx; py = ty;
          placed = true;
        }
      }
      // Fallback: drop the chest right next to the player (their tile is
      // guaranteed walkable since they are standing on it).
      if (!placed) { px = player.x; py = player.y; }
    }
    var chest = scene.spawnObstacle(px, py, chestType);
    if (chest) {
      chest.setData('eventChest', true);
      chest.setData('isTrapped', !!isTrapped);
    }
  }

  // --- Lore Fragment ---
  var activeLore = null;

  function spawnLoreFragment(scene) {
    if (!scene || !scene.add || !scene.physics) return;
    cleanupLore();

    var bounds = scene.physics.world && scene.physics.world.bounds;
    var bx = bounds ? bounds.x + bounds.width / 2 : 400;
    var by = bounds ? bounds.y + bounds.height / 2 : 300;
    if (typeof player !== 'undefined' && player) {
      // Try up to 16 random offsets around the player (60 - 220 px) and
      // pick the first one that isn't blocked by a wall / obstacle. The
      // old code picked a single fixed-radius angle and would happily
      // place the scroll inside a wall — making the lore unreachable.
      var placed = false;
      var halfSize = 18; // ~ scroll sprite half-width
      for (var attempt = 0; attempt < 16 && !placed; attempt++) {
        var ang = Math.random() * Math.PI * 2;
        var radius = 60 + Math.random() * 160;
        var tx = player.x + Math.cos(ang) * radius;
        var ty = player.y + Math.sin(ang) * radius;
        // Stay inside the world bounds (with margin) when known.
        if (bounds) {
          var margin = halfSize + 8;
          if (tx < bounds.x + margin || tx > bounds.x + bounds.width - margin) continue;
          if (ty < bounds.y + margin || ty > bounds.y + bounds.height - margin) continue;
        }
        var blocked = false;
        if (typeof window !== 'undefined' && typeof window.isSpawnPositionBlocked === 'function') {
          try { blocked = !!window.isSpawnPositionBlocked(tx, ty, halfSize); } catch (_) { blocked = false; }
        }
        if (!blocked) {
          bx = tx; by = ty;
          placed = true;
        }
      }
      // If every attempt was blocked, fall back to the player's own tile —
      // they are guaranteed to be on a walkable tile.
      if (!placed) {
        bx = player.x; by = player.y;
      }
    }

    // Generate procedural scroll texture if missing
    if (!scene.textures.exists('proc_scroll')) {
      var g = scene.make.graphics({ add: false });
      g.fillStyle(0xeed8a0); g.fillRoundedRect(2, 4, 28, 24, 3);
      g.fillStyle(0x8b6a3a); g.fillRect(2, 4, 28, 3);
      g.fillStyle(0x8b6a3a); g.fillRect(2, 25, 28, 3);
      g.lineStyle(1, 0x6a4a20); g.strokeRoundedRect(2, 4, 28, 24, 3);
      g.fillStyle(0x6a4a20); g.fillRect(8, 12, 16, 1);
      g.fillRect(8, 16, 14, 1);
      g.fillRect(8, 20, 18, 1);
      g.generateTexture('proc_scroll', 32, 32);
      g.destroy();
    }

    var scroll = scene.physics.add.sprite(bx, by, 'proc_scroll');
    scroll.setDepth(50);
    scroll.body.setAllowGravity(false);
    scroll.body.setImmovable(true);

    // Glow effect
    var glow = scene.add.graphics();
    glow.fillStyle(0xffdd44, 0.2);
    glow.fillCircle(bx, by, 30);
    glow.fillStyle(0xffeeaa, 0.15);
    glow.fillCircle(bx, by, 20);
    glow.setDepth(49);

    // Tween bobbing
    if (scene.tweens) {
      scene.tweens.add({
        targets: scroll, y: by - 8, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut'
      });
    }

    // Lore texts pool — keys resolved at display time.
    // Feature 051: three Akt-1-themed fragments added at indices 7-9 carrying
    // the central political subtext (history manipulated / Council pact /
    // protagonist amnesia not random). They share the same pool + drop
    // chance as the existing flavor fragments — over the 1.5-2h Akt-1
    // playthrough the player will encounter ~3-5 fragment events, statistically
    // hitting at least one of these three.
    var loreKeys = [
      'event.lore.text.1',
      'event.lore.text.2',
      'event.lore.text.3',
      'event.lore.text.4',
      'event.lore.text.5',
      'event.lore.text.6',
      'event.lore.text.fragment_lost_history',
      'event.lore.text.fragment_council_pact',
      'event.lore.text.fragment_personal_amnesia'
    ];
    var chosen = T(loreKeys[Math.floor(Math.random() * loreKeys.length)]);

    activeLore = { sprite: scroll, glow: glow, scene: scene, text: chosen, picked: false };

    // Auto-pickup on overlap
    scene.physics.add.overlap(player, scroll, function() {
      if (activeLore && !activeLore.picked) {
        activeLore.picked = true;
        // Issue #26 — increment Knowledge Tree fragment counter on pickup.
        // Existing flavor text + XP path is preserved (spec C-08).
        if (window.KnowledgeTree && typeof window.KnowledgeTree.addFragments === 'function') {
          try { window.KnowledgeTree.addFragments(1); } catch (_) { /* never block pickup */ }
        }
        var xpBonus = 15 + (window.DUNGEON_DEPTH || 1) * 5;
        if (typeof addXP === 'function') {
          addXP.call(scene, xpBonus);
        } else if (typeof playerXP !== 'undefined') {
          playerXP += xpBonus;
          window.playerXP = playerXP;
        }
        showLoreDialog(scene, chosen, xpBonus);
        cleanupLore();
      }
    });

    showEventToast(scene, T('event.lore.toast_spawn'), 'lore_fragment');
  }

  function showLoreDialog(scene, loreText, xpBonus) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    // Dialog im Dungeon pausiert das Spiel voll (früher lief alles weiter,
    // während man las).
    if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);

    var overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(2500).setInteractive();

    var panelW = Math.min(560, cw - 40);
    var panelH = 200;
    var panel = scene.add.rectangle(cw / 2, ch / 2, panelW, panelH, 0x1a1a2a, 0.95)
      .setScrollFactor(0).setDepth(2501).setStrokeStyle(2, 0xffdd44);

    var title = scene.add.text(cw / 2, ch / 2 - 70, T('event.lore.dialog_title'), {
      fontSize: '20px', fill: '#ffdd44', fontFamily: 'serif', fontStyle: 'italic'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var body = scene.add.text(cw / 2, ch / 2 - 10, loreText, {
      fontSize: '14px', fill: '#e8e0c8', fontFamily: 'serif',
      wordWrap: { width: panelW - 40 }, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var bonus = scene.add.text(cw / 2, ch / 2 + 50, '+' + xpBonus + ' XP', {
      fontSize: '16px', fill: '#88ff88', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var hint = scene.add.text(cw / 2, ch / 2 + 80, T('event.lore.dialog_hint'), {
      fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2502);

    var closed = false;
    var autoT = null;
    var close = function() {
      if (closed) return;
      closed = true;
      if (autoT) { try { clearTimeout(autoT); } catch (e) {} autoT = null; }
      scene.input.keyboard.off('keydown-SPACE', close);
      scene.input.keyboard.off('keydown-ESC', close);
      overlay.destroy(); panel.destroy(); title.destroy(); body.destroy(); bonus.destroy(); hint.destroy();
      // Spiel-Pause aufheben.
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
    };
    overlay.on('pointerdown', close);
    scene.input.keyboard.on('keydown-SPACE', close);
    scene.input.keyboard.on('keydown-ESC', close);
    // Auto-Close über Echtzeit-Timer (setTimeout): scene.time ist jetzt pausiert
    // und würde den delayedCall einfrieren -> der Dialog schlösse nie von selbst.
    autoT = setTimeout(close, 8000);
  }

  function cleanupLore() {
    if (!activeLore) return;
    if (activeLore.sprite && activeLore.sprite.destroy) activeLore.sprite.destroy();
    if (activeLore.glow && activeLore.glow.destroy) activeLore.glow.destroy();
    activeLore = null;
  }

  // --- Ambush ---
  function triggerAmbush(scene) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    // Big dramatic warning
    var warn = scene.add.text(cw / 2, ch / 2 - 50, 'HINTERHALT!', {
      fontSize: '64px', fill: '#ff3333', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000).setAlpha(0);

    // Flash + scale pulse
    if (scene.tweens) {
      scene.tweens.add({
        targets: warn, alpha: 1, scale: { from: 0.5, to: 1.2 },
        duration: 400, yoyo: true, hold: 1200,
        onComplete: function() { warn.destroy(); }
      });
    }

    // Camera shake
    if (cam && cam.shake) cam.shake(800, 0.005);

    // Sound cue
    if (window.soundManager && window.soundManager.playSFX) {
      try { window.soundManager.playSFX('enemy_death'); } catch (e) {}
    }

    // Spawn enemies after 1.5s warning
    var extraCount = 2 + Math.floor((window.DUNGEON_DEPTH || 1) / 3);
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1500, function() {
        // #71: Einer der Angreifer traegt die Beute.
        //
        // Vorher schrieb diese Stelle scene._ambushBonus und das war es —
        // nachgesehen: die Eigenschaft wird im ganzen Projekt NIRGENDS gelesen.
        // Der Hinterhalt zahlte also gar nichts, obwohl der Kommentar eine
        // Belohnung beim Wellenende versprach.
        //
        // Statt eines Wellen-Hakens haengt die Belohnung jetzt an einem
        // bestimmten Gegner: der Pluenderer faellt, die Beute faellt. Das
        // braucht keine neue Verdrahtung und macht aus dem Kampf ein Ziel.
        var gegner = [];
        for (var i = 0; i < extraCount; i++) {
          if (typeof spawnEnemy === 'function') {
            var g = spawnEnemy.call(scene, 0, 0, 'enemy');
            if (g) gegner.push(g);
          }
        }
        if (gegner.length) {
          var pluenderer = gegner[Math.floor(Math.random() * gegner.length)];
          var beuteGold = 40 + 15 * (window.DUNGEON_DEPTH || 1);
          try {
            pluenderer.setData('pluendererGold', beuteGold);
            // Sichtbar: goldener Schimmer, damit man weiss, wen man jagt.
            if (typeof pluenderer.setTint === 'function') pluenderer.setTint(0xffd98a);
            if (scene.add && typeof scene.add.circle === 'function') {
              var schein = scene.add.circle(pluenderer.x, pluenderer.y, 22, 0xffd98a, 0.22);
              schein.setDepth((pluenderer.depth || 10) - 1);
              schein.setBlendMode(Phaser.BlendModes.ADD);
              pluenderer.setData('pluendererSchein', schein);
              // Der Schimmer folgt seinem Traeger und verschwindet mit ihm.
              if (scene.events && typeof scene.events.on === 'function') {
                var mit = function () {
                  if (!pluenderer.active) {
                    schein.destroy();
                    scene.events.off('update', mit);
                    return;
                  }
                  schein.setPosition(pluenderer.x, pluenderer.y);
                };
                scene.events.on('update', mit);
              }
            }
          } catch (e) { /* Optik darf den Kampf nie brechen */ }
          showEventToast(scene, T('event.ambush.toast_looter'), 'ambush');
        }
      });
    }
  }

  // --- Environmental Hazard (rockfall) ---
  function triggerRockfall(scene) {
    if (!scene || !scene.add) return;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 800;
    var ch = cam ? cam.height : 600;

    if (typeof player === 'undefined' || !player) return;

    // Show shadow indicator at player position
    var px = player.x;
    var py = player.y;
    var shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillCircle(px, py, 50);
    shadow.setDepth(1000);

    showEventToast(scene, T('event.hazard.toast_spawn'), 'environmental_hazard');

    // Pulse the shadow as warning
    if (scene.tweens) {
      scene.tweens.add({
        targets: shadow, alpha: 0.2, duration: 200, yoyo: true, repeat: 5
      });
    }

    // After 1.5s check if player moved away
    if (scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1500, function() {
        // Drop rocks visual
        var rockGfx = scene.add.graphics();
        rockGfx.fillStyle(0x4a3a2a, 1);
        for (var r = 0; r < 8; r++) {
          var rx = px + (Math.random() - 0.5) * 80;
          var ry = py + (Math.random() - 0.5) * 80;
          rockGfx.fillCircle(rx, ry, 6 + Math.random() * 6);
        }
        rockGfx.setDepth(60);

        // Check if player still in zone
        var dx = player.x - px;
        var dy = player.y - py;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          // Hit — schwerer Einsturz statt -1 HP: ~30% der Max-HP. Der Treffer ist
          // ~1.5s vorher telegrafiert (Schatten-Puls), Ausweichen lohnt sich also
          // deutlich. Läuft durch applyPlayerDamage (Rüstung/Dodge/Tod korrekt).
          if (typeof window.applyPlayerDamage === 'function') {
            var _maxHp = window.playerMaxHealth || 100;
            var _dmg = Math.max(6, Math.round(_maxHp * 0.3));
            window.applyPlayerDamage(_dmg, scene);
          } else if (typeof playerHealth !== 'undefined') {
            playerHealth = Math.max(1, playerHealth - 5);
            window.playerHealth = playerHealth;
          }
          if (cam && cam.shake) cam.shake(400, 0.012);
          showEventToast(scene, T('event.hazard.toast_hit'), 'environmental_hazard');
        } else {
          // Dodged
          var goldReward = 25 + (window.DUNGEON_DEPTH || 1) * 10;
          if (window.LootSystem && window.LootSystem.grantGold) window.LootSystem.grantGold(goldReward);
          showEventToast(scene, T('event.hazard.toast_dodge', { amount: goldReward }), 'environmental_hazard');
        }

        // Cleanup visuals
        scene.time.delayedCall(2000, function() {
          if (shadow && shadow.destroy) shadow.destroy();
          if (rockGfx && rockGfx.destroy) rockGfx.destroy();
        });
      });
    }
  }

  // --- Choice dialog overlay (032-random-event-rework) ---
  // Wie viele Wahlen der Dialog hoechstens zeigt. Wer mehr uebergibt, verliert
  // die hinteren — und das ist genau einmal passiert (siehe unten).
  var MAX_WAHLEN = 6;

  function showEventChoiceDialog(scene, title, choices) {
    if (!scene || !scene.add || !choices || !choices.length) return;
    var cam = scene.cameras && scene.cameras.main;
    var camW = cam ? cam.width : 960;
    var camH = cam ? cam.height : 480;
    var cx = camW / 2;
    var cy = camH / 2;
    var elements = [];

    scene._eventChoiceActive = true;
    // Global gespiegelt, damit InputScheme.shouldSuppressCombatInput den offenen
    // Dialog kennt (sonst schlägt man durch ihn hindurch zu).
    window.eventChoiceOpen = true;
    // Volle Spiel-Pause statt nur Physik: friert Gegner/Projektile, Cooldowns
    // (gameNow + scene.time.now), Raum-Modus-Countdowns und den Combat-Tick ein.
    if (typeof window.pauseGameClock === 'function') window.pauseGameClock(scene);
    else if (scene.physics && scene.physics.world) scene.physics.world.pause();

    // Dark overlay
    var overlay = scene.add.rectangle(cx, cy, camW, camH, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(2500).setInteractive();
    elements.push(overlay);

    // Title
    var titleText = scene.add.text(cx, cy - 60, title, {
      fontSize: '20px', fill: '#ffd166', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: camW - 100 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2501);
    elements.push(titleText);

    // Layout-Fix (Mobile): langer Text (z.B. Elaras 3-Absatz-Dialog) wuchs bei
    // fixem Titel-Zentrum ueber die Bildschirmmitte hinaus und ueberlappte den
    // "Weiter"-Button (der bei cy begann). Jetzt den GANZEN Block (Titel + gap +
    // Buttons) vertikal zentrieren, oben abfangen, und die Buttons UNTER das
    // tatsaechliche Textende setzen.
    // Frueher gedeckelt auf 3. Der Opferstein bietet bei vier angelegten
    // Stuecken fuenf Wahlen an — "Nichts hergeben" steht zuletzt und wurde
    // deshalb NIE gezeichnet: es gab keine Moeglichkeit, nichts zu opfern.
    // 6 passt auch auf die kleinste Kamera (6*44 + Titel < 480).
    var _estBtnBlock = Math.min(choices.length, MAX_WAHLEN) * 44;
    var _blockTop = Math.max(20, cy - (titleText.height + 16 + _estBtnBlock) / 2);
    titleText.setY(_blockTop + titleText.height / 2);
    var _buttonsTop = _blockTop + titleText.height + 16;

    var dismissKeyHandler = null;
    var cleanup = function () {
      scene._eventChoiceActive = false;
      window.eventChoiceOpen = false;
      if (dismissKeyHandler && scene.input && scene.input.keyboard) {
        scene.input.keyboard.off('keydown-ESC', dismissKeyHandler);
        scene.input.keyboard.off('keydown-SPACE', dismissKeyHandler);
        scene.input.keyboard.off('keydown-ENTER', dismissKeyHandler);
        dismissKeyHandler = null;
      }
      // Spiel-Pause aufheben (Gegenstück zu pauseGameClock oben).
      if (typeof window.resumeGameClock === 'function') window.resumeGameClock(scene);
      else if (scene.physics && scene.physics.world) scene.physics.world.resume();
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] && elements[i].destroy) elements[i].destroy();
      }
    };

    // Buttons — dynamic height so long labels wrap cleanly inside the box.
    var BTN_W = Math.min(520, camW - 40);
    var BTN_PAD_X = 16;
    var BTN_PAD_Y = 8;
    var BTN_GAP = 10;
    var cursorY = _buttonsTop; // top edge of next button — unter dem Titel-Text
    for (var i = 0; i < choices.length && i < MAX_WAHLEN; i++) {
      var btnText = scene.add.text(0, 0, choices[i].label, {
        fontSize: '14px', fill: '#f1e9d8', fontFamily: 'monospace',
        align: 'center',
        wordWrap: { width: BTN_W - BTN_PAD_X * 2 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2503);
      var btnH = Math.max(34, btnText.height + BTN_PAD_Y * 2);
      var by = cursorY + btnH / 2;
      var btnBg = scene.add.rectangle(cx, by, BTN_W, btnH, 0x2a2a2a)
        .setStrokeStyle(2, 0xd4a543)
        .setScrollFactor(0).setDepth(2502)
        .setInteractive({ useHandCursor: true });
      btnText.setPosition(cx, by);
      (function (bg, choice) {
        bg.on('pointerover', function () { bg.setFillStyle(0x555555); });
        bg.on('pointerout', function () { bg.setFillStyle(0x2a2a2a); });
        bg.on('pointerdown', function () {
          cleanup();
          if (typeof choice.callback === 'function') choice.callback();
        });
      })(btnBg, choices[i]);
      elements.push(btnBg);
      elements.push(btnText);
      cursorY = by + btnH / 2 + BTN_GAP;
    }

    // Ein-Knopf-Dialoge ("Weiter") sind reine Bestätigungen — z. B. Elaras
    // Kellerbegegnung. Die darf man mit ESC/Leertaste/Enter wegdrücken statt
    // den Knopf treffen zu müssen. Mehrfach-Auswahlen bleiben BEWUSST
    // klickpflichtig: dort wäre eine Taste eine willkürlich getroffene
    // Story-/Belohnungsentscheidung.
    if (choices.length === 1 && scene.input && scene.input.keyboard) {
      var onlyChoice = choices[0];
      dismissKeyHandler = function () {
        cleanup(); // hängt die Tasten selbst wieder ab
        if (typeof onlyChoice.callback === 'function') onlyChoice.callback();
      };
      scene.input.keyboard.on('keydown-ESC', dismissKeyHandler);
      scene.input.keyboard.on('keydown-SPACE', dismissKeyHandler);
      scene.input.keyboard.on('keydown-ENTER', dismissKeyHandler);
    }
  }

  function registerEventType(def) {
    if (!def || !def.id || !def.name || !def.handler) return false;
    for (var i = 0; i < EVENT_TYPES.length; i++) {
      if (EVENT_TYPES[i].id === def.id) return false; // duplicate
    }
    EVENT_TYPES.push({
      id: def.id,
      name: def.name,
      weight: def.weight || 10,
      minDepth: def.minDepth || 1,
      handler: def.handler
    });
    return true;
  }

  function onRoomEnter(scene, roomId) {
    // Clean up any active merchant or lore from previous room
    cleanupMerchant();
    cleanupLore();
    // Also tear down generic event-object sprites (e.g. the story Elara spawned
    // by roomManager._maybeFireElaraCellarEncounter). Without this they linger
    // into the next room — so the new room's Elara appeared *next to* the old
    // one ("Elara zwei mal im gleichen Raum").
    cleanupEventObjects();

    if (roomId === 0) return;
    // Boss-/Klimax-Raum (Finalraum): KEINE Events. Der Boss soll eine saubere,
    // bei jedem Run gleiche Arena haben. Ein Event brachte Händler/Hazards oder
    // (Elite-Hinterhalt) einen zusätzlichen Mini-Boss in den Raum -> die Arena
    // sah jedes Mal anders aus UND es standen nach dem Boss noch Gegner darin.
    // roomManager setzt __isFinalDungeonRoom VOR diesem Aufruf.
    if (window.__isFinalDungeonRoom) return;
    // Spionage-Räume: KEINE Events (Stealth-Mission). Ein Kampf-/Interaktions-
    // Event würde die Verkleidung auffliegen lassen oder das Beobachtungs-Ziel
    // umgehen. _maybeStartEspionage läuft vor onRoomEnter -> isActive ist gesetzt.
    if (window.EspionageSystem && typeof window.EspionageSystem.isActive === 'function'
        && window.EspionageSystem.isActive()) return;
    var depth = window.DUNGEON_DEPTH || 1;

    // Debug: force a specific event in a specific room
    // Set window.DEBUG_FORCE_EVENT = { roomId: 1, eventId: 'wandering_merchant' }
    // Debug (?event=<id>): dasselbe Ereignis in JEDEM Raum. Bisher liess sich
    // ein Ereignis nur ueber window.DEBUG_FORCE_EVENT erzwingen — keine
    // URL-Flagge, nirgends dokumentiert, und erst ab roomId >= 1. Damit war
    // kein Ereignis gezielt testbar (#129).
    var _flagge = null;
    try { _flagge = window.DebugGate && window.DebugGate.flagge('event'); } catch (e) {}
    if (_flagge) {
      var _gewuenscht = String(_flagge).toLowerCase();
      var _treffer = EVENT_TYPES.filter(function (e) {
        return String(e.id).toLowerCase() === _gewuenscht;
      })[0];
      if (_treffer) {
        lastEventId = _treffer.id;
        var _los = function () { gibEreignisXp(scene); _treffer.handler(scene); };
        if (scene && scene.time && scene.time.delayedCall) scene.time.delayedCall(800, _los);
        else _los();
        return;
      }
      try {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Ereignis] unbekannt: ' + _flagge + ' — bekannt sind: '
            + EVENT_TYPES.map(function (e) { return e.id; }).join(', '));
        }
      } catch (e) {}
    }
    if (window.DEBUG_FORCE_EVENT && window.DEBUG_FORCE_EVENT.roomId === roomId) {
      var forced = EVENT_TYPES.find(function(e) { return e.id === window.DEBUG_FORCE_EVENT.eventId; });
      if (forced) {
        lastEventId = forced.id;
        if (scene && scene.time && scene.time.delayedCall) {
          scene.time.delayedCall(800, function() {
            gibEreignisXp(scene);
            forced.handler(scene);
          });
        } else {
          gibEreignisXp(scene);
          forced.handler(scene);
        }
        return;
      }
    }

    if (!shouldTriggerEvent(depth)) return;

    var event = pickEvent(depth);
    if (!event) return;

    lastEventId = event.id;
    recentEvents.push(event.id);
    if (recentEvents.length > 3) recentEvents.shift();

    var dispatchEvent = function () {
      // Feature 061: In Spezialräumen (survival/defend/hunt/escape) KEIN Event —
      // der Raum hat bereits ein Ziel. Der 800ms-Delay stellt sicher, dass
      // beginRoom den Modus schon gesetzt hat (isSpecialRoom ist hier korrekt).
      // #112: isSpecialRoom() ist erst true, wenn das Ziel LAEUFT. Ein noch
      // scharfgestellter Raum hat aber ebenso schon sein Objekt stehen — dort
      // gehoert kein zweites Ereignis dazu.
      if (window.RoomMode && typeof window.RoomMode.isSpecialRoom === 'function'
          && (window.RoomMode.isSpecialRoom()
              || (typeof window.RoomMode.isArmed === 'function' && window.RoomMode.isArmed()))) return;
      // Doppelte Absicherung: falls die Spionage-Mission erst nach dem Roll aktiv
      // wurde, hier ebenfalls abbrechen.
      if (window.EspionageSystem && typeof window.EspionageSystem.isActive === 'function'
          && window.EspionageSystem.isActive()) return;
      // #71: Jedes Zufallsereignis gibt etwas Erfahrung — auch die, deren
      // Belohnung man ausschlaegt oder verliert. Ein Ereignis ueberhaupt
      // erreicht zu haben, soll sich lohnen; die Menge bleibt klein genug,
      // dass niemand deswegen Raeume nach Ereignissen absucht.
      gibEreignisXp(scene);
      var result = event.handler(scene);
      // If handler returns a choice descriptor, show the dialog
      if (result && result.title && Array.isArray(result.choices)) {
        showEventChoiceDialog(scene, result.title, result.choices);
      }
    };

    if (scene && scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(800, dispatchEvent);
    } else {
      dispatchEvent();
    }
  }

  function reset() {
    lastEventId = null;
    recentEvents.length = 0;
    cleanupMerchant();
    cleanupLore();
    cleanupEventObjects();
  }

  window.EventSystem = {
    onRoomEnter: onRoomEnter,
    reset: reset,
    registerEventType: registerEventType,
    showEventChoiceDialog: showEventChoiceDialog,
    spawnEventObject: spawnEventObject,
    // #53: exported so other systems (e.g. questSystem completeQuest toast)
    // can reuse the same panel-styled, scroll-fixed toast instead of rolling
    // a new one.
    showToast: showEventToast,
    EVENT_TYPES: EVENT_TYPES,
    // #71: reine Ziehung, damit das Balancing pruefbar bleibt.
    opferKandidaten: opferKandidaten,
    opferUmwurf: opferUmwurf,
    schreinAngebote: schreinAngebote,
    schreinAnwenden: schreinAnwenden,
    SCHREIN_SEGEN: SCHREIN_SEGEN,
    SCHREIN_PREISE: SCHREIN_PREISE
  };
})();
