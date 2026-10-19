// tests/questLohn.test.js — der Questlohn: skaliert, vollstaendig vergeben,
// nie still verloren, und bei jeder Abgabe angezeigt.
//
// Geprueft wird completeQuest selbst, nicht ein bestimmter Abgabeweg: die
// Haelfte der Auftraege wird in eigenen Szenen abgeschlossen (Maulwurf,
// Finale, Elaras Versteck), und jede davon haette den Lohn sonst still
// vergeben.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;

function frisch(opts) {
  resetStore();
  ['questSystem', 'LootSystem', 'HubTruhe', 'InventoryGrid', 'EventSystem', 'gameScene',
    'KnowledgeTree', 'PrintingHouse', 'Persistence', 'getNeededXP', 'inventory', 'addXP',
    'playerLevel', 'makePotionDrop'].forEach((k) => { delete W[k]; });
  W.storySystem = { getCurrentActIndex: () => 99, advanceToAct: () => {} };
  W.DUNGEON_DEPTH = 99;
  if (opts && opts.loot) loadGameModule('js/lootSystem.js');
  loadGameModule('js/questSystem.js');
  return W.questSystem;
}

/** Auftrag abgabebereit setzen (Ziele erfuellt) und abgeben. */
function abgeben(qs, id) {
  const st = qs.getQuestSaveData();
  const d = qs.QUEST_DEFINITIONS[id];
  st.quests[id] = { status: 'active', objectives: d.objectives.map((o) => ({
    type: o.type, target: o.target, current: o.required, required: o.required })) };
  qs.loadQuestSaveData(st);
  assert.strictEqual(qs.completeQuest(id), true, id + ' liess sich nicht abgeben');
}

/** Ein Inventar mit n freien Plaetzen (ohne Raster). */
function inventar(frei) {
  W.inventory = new Array(frei).fill(null);
  return W.inventory;
}

beforeEach(() => resetStore());

// ------------------------------------------------------------ Skalierung

test('Skalierung: frueh gilt die Zahl aus der Definition', () => {
  const qs = frisch();
  const D = qs.QUEST_DEFINITIONS;
  // Stufe 1 braucht 18 XP — 40 % davon liegen unter jeder Angabe.
  assert.deepStrictEqual(qs.lohnBerechnen(D.einfuehrung_markt, { xpFuerStufe: 18, maxTiefe: 1 }), { xp: 40, gold: 30 });
  assert.deepStrictEqual(qs.lohnBerechnen(D.brett_kammern, { xpFuerStufe: 18, maxTiefe: 4 }), { xp: 70, gold: 140 });
});

test('Skalierung: Erfahrung als Anteil des Stufenbedarfs, je nach Gewicht', () => {
  const qs = frisch();
  const D = qs.QUEST_DEFINITIONS;
  const lage = { xpFuerStufe: 1000, maxTiefe: 1 };
  assert.strictEqual(qs.lohnBerechnen(D.brett_stoerer, lage).xp, 400, 'Nebenauftrag');
  assert.strictEqual(qs.lohnBerechnen(D.branka_doubt, lage).xp, 700, 'Story');
  assert.strictEqual(qs.lohnBerechnen(D.mara_warning, lage).xp, 1000, 'Boss');
  assert.strictEqual(qs.lohnBerechnen(D.schattenrat_finale, lage).xp, 1500, 'Finale');
  // Elaras Klinge brachte 0 XP.
  assert.ok(qs.lohnBerechnen(D.elara_blade, lage).xp >= 700);
});

test('Skalierung: jeder Auftrag hat ein bekanntes Gewicht', () => {
  const qs = frisch();
  Object.values(qs.QUEST_DEFINITIONS).forEach((d) => {
    assert.ok(Object.prototype.hasOwnProperty.call(qs.LOHN_ANTEIL, d.rewardTier),
      d.id + ' hat kein gueltiges rewardTier: ' + d.rewardTier);
  });
  ['mara_warning', 'council_collusion_reveal', 'bruch_confrontation', 'harren_daughter_investigation']
    .forEach((id) => assert.strictEqual(qs.QUEST_DEFINITIONS[id].rewardTier, 'boss', id));
  ['schattenrat_finale', 'the_reckoning']
    .forEach((id) => assert.strictEqual(qs.QUEST_DEFINITIONS[id].rewardTier, 'finale', id));
});

test('Skalierung: Gold waechst mit der erreichten Tiefe wie die Preise', () => {
  const qs = frisch();
  const D = qs.QUEST_DEFINITIONS;
  // brett_kammern zaehlt ab Tiefe 4: auf Tiefe 20 das Fuenffache.
  assert.strictEqual(qs.lohnBerechnen(D.brett_kammern, { maxTiefe: 20 }).gold, 700);
  // Ohne Mindesttiefe gilt die Angabe auf Tiefe 1.
  assert.strictEqual(qs.lohnBerechnen(D.einfuehrung_truhe, { maxTiefe: 10 }).gold, 300);
  // Flacher als die Bezugstiefe: nie unter der Angabe.
  assert.strictEqual(qs.lohnBerechnen(D.brett_zeugen, { maxTiefe: 3 }).gold, 160);
  assert.strictEqual(qs.lohnBerechnen(D.branka_doubt, { maxTiefe: 30 }).gold, 0, 'Gold aus dem Nichts');
});

test('Abgabe zahlt die skalierten Werte aus', () => {
  const qs = frisch();
  let xp = 0, gold = 0;
  W.addXP = (n) => { xp += n; };
  W.LootSystem = { grantGold: (n) => { gold += n; } };
  W.getNeededXP = () => 500;
  W.Persistence = { getMaxDepth: () => 24 };
  abgeben(qs, 'brett_anfuehrer');
  assert.strictEqual(xp, 200);              // 0.4 * 500
  assert.strictEqual(gold, 800);            // 200 * 24 / 6
  assert.deepStrictEqual({ xp: qs.getErhaltenerLohn('brett_anfuehrer').xp, gold: qs.getErhaltenerLohn('brett_anfuehrer').gold },
    { xp: 200, gold: 800 }, 'der Vermerk weicht vom Ausgezahlten ab');
});

// ------------------------------------------------------------ Einfuehrungen

test('Einfuehrungen: jede belohnt passend zu ihrem System', () => {
  const qs = frisch();
  const D = qs.QUEST_DEFINITIONS;
  const art = (id) => Object.keys(D[id].rewards).filter((k) => k !== 'xp').sort().join(',');
  assert.strictEqual(art('einfuehrung_schmiede'), 'materials');
  assert.strictEqual(art('einfuehrung_presse'), 'druckblaetter');
  assert.strictEqual(art('einfuehrung_wissen'), 'fragments');
  assert.strictEqual(art('einfuehrung_markt'), 'gold');
  assert.strictEqual(art('einfuehrung_truhe'), 'gold');
  assert.strictEqual(art('einfuehrung_amulett'), 'gold');
  assert.strictEqual(art('einfuehrung_talente'), 'potions');
  assert.strictEqual(art('einfuehrung_akte'), 'potions');
});

test('Einfuehrung Akte: der Heiltrank landet auf dem vorhandenen Stapel', () => {
  const qs = frisch();
  const inv = inventar(4);
  inv[2] = { type: 'potion', potionTier: 1, stack: 2 };
  abgeben(qs, 'einfuehrung_akte');
  assert.strictEqual(inv[2].stack, 3);
  assert.strictEqual(inv.filter(Boolean).length, 1, 'neuer Platz statt Stapel');
});

test('Einfuehrung Talente: ohne Stapel ein eigener Trank', () => {
  const qs = frisch();
  const inv = inventar(2);
  abgeben(qs, 'einfuehrung_talente');
  const t = inv.filter(Boolean);
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].type, 'potion');
  assert.strictEqual(t[0].potionTier, 1);
});

test('Einfuehrung Schmiede/Presse/Wissen vergeben Eisenbrocken, Druckblaetter, Fragment', () => {
  const qs = frisch();
  let mat = 0, druck = 0, frag = 0;
  W.changeMaterialCount = undefined;
  globalThis.changeMaterialCount = (k, n) => { if (k === 'MAT') mat += n; };
  W.PrintingHouse = { addDruckblaetter: (n) => { druck += n; } };
  W.KnowledgeTree = { addFragments: (n) => { frag += n; } };
  abgeben(qs, 'einfuehrung_schmiede');
  abgeben(qs, 'einfuehrung_presse');
  abgeben(qs, 'einfuehrung_wissen');
  delete globalThis.changeMaterialCount;
  assert.deepStrictEqual({ mat, druck, frag }, { mat: 8, druck: 2, frag: 1 });
});

// ------------------------------------------------------------ Story-Stuecke

test('Elaras Klinge wird auf Spielerstufe gewuerfelt: legendaer, fester Name, Kennzeichen', () => {
  const qs = frisch({ loot: true });
  const inv = inventar(6);
  W.playerLevel = 17;
  abgeben(qs, 'elara_blade');
  const k = inv.filter(Boolean)[0];
  assert.ok(k, 'keine Klinge im Inventar');
  assert.strictEqual(k.key, 'ELARAS_KLINGE');
  assert.strictEqual(k.type, 'weapon');
  assert.strictEqual(k.tier, 3, 'nicht legendaer');
  assert.strictEqual(k.iLevel, 17);
  assert.strictEqual(k.requiredLevel, 15);
  assert.strictEqual(k.affixes.length, 3);
  assert.strictEqual(k.elaraGift, true);
  assert.strictEqual(k.displayName, 'Elaras Klinge');
  assert.strictEqual(k.iconKey, 'itSword');
  // Hohe Kritchance: 15 % Zielanteil, absolut auf Stufe 17 gespeichert.
  const krit = Math.round(W.LootSystem.affixPunkte(0.15, 17) * 10) / 10;
  assert.strictEqual(k.crit, krit);
  assert.strictEqual(k.baseStats.crit, krit);
  assert.ok(k.damage > 0, 'kein Waffenschaden');
});

test('Die zugesagte Seltenheit gilt auch bei Abgabe im flachen Keller', () => {
  // Der Tiefen-Deckel der Funde (Tiefe 1-3 hoechstens blau) darf einen
  // Questlohn nicht herabstufen — abgegeben wird auch unten (roomManager).
  const qs = frisch({ loot: true });
  const inv = inventar(6);
  W.playerLevel = 12;
  W.DUNGEON_DEPTH = 2;
  W.game = { scene: { isActive: (k) => k === 'GameScene' } };
  try {
    abgeben(qs, 'elara_blade');
  } finally { delete W.game; W.DUNGEON_DEPTH = 99; }
  assert.strictEqual(inv.filter(Boolean)[0].tier, 3);
});

test('Ritualamulett: ein Kopfstueck, selten, mit festem Namen — und kein Laufamulett', () => {
  const qs = frisch({ loot: true });
  const inv = inventar(6);
  W.playerLevel = 20;
  abgeben(qs, 'elara_ritual');
  const a = inv.filter(Boolean)[0];
  assert.ok(a, 'kein Amulett im Inventar');
  assert.strictEqual(a.type, 'head', 'nicht anlegbar: ' + a.type);
  assert.strictEqual(a.key, 'RITUAL_AMULETT');
  assert.strictEqual(a.tier, 2);
  assert.strictEqual(a.iLevel, 20);
  assert.strictEqual(a.displayName, 'Nebelamulett des Rats');
  assert.ok(W.LootSystem.PERSISTENT_EQUIP_SLOTS.includes(a.type), 'Platz wird nicht gespeichert');
  // Der Lauf-Abschluss raeumt Amulette ab — dieses Stueck muss bleiben.
  const ausr = { head: a };
  W.LootSystem.clearRunAmulet(ausr, inv);
  assert.strictEqual(ausr.head, a, 'vom Lauf-Abschluss abgelegt');
  assert.ok(inv.includes(a), 'vom Lauf-Abschluss aus dem Inventar entfernt');
});

test('Story-Bosse geben ein gewuerfeltes seltenes Stueck auf Spielerstufe', () => {
  ['mara_warning', 'mara_assault', 'schattenrat_finale'].forEach((id) => {
    const qs = frisch({ loot: true });
    const inv = inventar(6);
    W.playerLevel = 22;
    abgeben(qs, id);
    const s = inv.filter(Boolean);
    assert.strictEqual(s.length, 1, id + ': kein Stueck');
    assert.strictEqual(s[0].tier, 2, id + ': Seltenheit');
    assert.strictEqual(s[0].iLevel, 22, id + ': Stufe');
  });
});

// ------------------------------------------------------------ Volles Inventar

test('Volles Inventar: der Lohn geht in die Truhe, mit Hinweis', () => {
  const qs = frisch({ loot: true });
  inventar(0);
  const truhe = [];
  W.HubTruhe = { einlagern: (it) => { truhe.push(it); return true; } };
  const toasts = [];
  W.gameScene = { sys: { isActive: () => true }, add: {} };
  W.EventSystem = { showToast: (sc, msg, id, n, o) => toasts.push((o && o.unter) || '') };
  abgeben(qs, 'elara_blade');
  assert.strictEqual(truhe.length, 1, 'nicht in der Truhe');
  assert.strictEqual(truhe[0].key, 'ELARAS_KLINGE');
  assert.match(toasts[toasts.length - 1], /Truhe/);
});

test('Inventar und Truhe voll: der Lohn wartet, wird gespeichert und spaeter nachgereicht', () => {
  let qs = frisch({ loot: true });
  inventar(0);
  W.HubTruhe = { einlagern: () => false };
  const toasts = [];
  W.gameScene = { sys: { isActive: () => true }, add: {} };
  W.EventSystem = { showToast: (sc, msg, id, n, o) => toasts.push(msg + '|' + ((o && o.unter) || '')) };
  abgeben(qs, 'elara_blade');
  assert.strictEqual(qs.getAusstehend().length, 1, 'still verworfen');
  assert.match(toasts[toasts.length - 1], /wartet/);

  // Ueber den Spielstand hinweg.
  const stand = JSON.parse(JSON.stringify(qs.getQuestSaveData()));
  qs = frisch({ loot: true });
  qs.loadQuestSaveData(stand);
  assert.strictEqual(qs.getAusstehend().length, 1, 'beim Laden verloren');

  // Platz da: nachgereicht.
  const inv = inventar(3);
  W.gameScene = { sys: { isActive: () => true }, add: {} };
  W.EventSystem = { showToast: (sc, msg) => toasts.push(msg) };
  assert.strictEqual(qs.ausstehendeAusliefern(W.gameScene), 1);
  assert.strictEqual(inv.filter(Boolean)[0].key, 'ELARAS_KLINGE');
  assert.strictEqual(qs.getAusstehend().length, 0);
  assert.match(toasts[toasts.length - 1], /Nachgereicht/);
});

// ------------------------------------------------------------ +10 % XP

test('xp_bonus_10: gilt nach den Pamphleten und steht im Quest-Spielstand', () => {
  let qs = frisch();
  assert.strictEqual(qs.getXpBonus(), 0);
  abgeben(qs, 'thom_pamphlets');
  assert.ok(Math.abs(qs.getXpBonus() - 0.10) < 1e-9);
  const stand = JSON.parse(JSON.stringify(qs.getQuestSaveData()));
  qs = frisch();
  assert.strictEqual(qs.getXpBonus(), 0);
  qs.loadQuestSaveData(stand);
  assert.ok(Math.abs(qs.getXpBonus() - 0.10) < 1e-9, 'nach dem Laden verloren');
});

// ------------------------------------------------------------ Anzeige

test('Toast bei der Abgabe — auch auf einem Weg ohne eigene Belohnungsseite', () => {
  // widerstand_proof wird im Keller abgegeben (roomManager), ohne Dialog.
  const qs = frisch();
  W.getNeededXP = () => 100;
  W.KnowledgeTree = { addFragments: () => {} };
  const toasts = [];
  W.gameScene = { sys: { isActive: () => true }, add: {} };
  W.EventSystem = { showToast: (sc, msg, id, n, o) => toasts.push({ msg, unter: o && o.unter }) };
  abgeben(qs, 'widerstand_proof');
  assert.strictEqual(toasts.length, 1, 'kein Toast');
  assert.match(toasts[0].msg, /Auftrag abgeschlossen/);
  assert.strictEqual(toasts[0].unter, '+100 XP · +1 Fragment');
});

test('Lohnzeilen nennen jede Art, mit uebersetztem Stueck', () => {
  const qs = frisch();
  W.getNeededXP = () => 10;
  const t = qs.lohnTeile(qs.getQuestLohn('brett_aufruf'));
  assert.deepStrictEqual(t, ['+120 XP', '+150 Gold', '+4 Druckblätter']);
  assert.deepStrictEqual(qs.lohnTeile(qs.getQuestLohn('elara_blade')).slice(1), ['Elaras Klinge (Legendär)']);
  assert.deepStrictEqual(qs.lohnTeile(qs.getQuestLohn('mara_warning')).slice(1), ['Ausrüstungsstück (Selten)']);
  assert.deepStrictEqual(qs.lohnTeile(qs.getQuestLohn('einfuehrung_akte')).slice(1), ['+1 Heiltrank']);
  assert.deepStrictEqual(qs.lohnTeile(qs.getQuestLohn('einfuehrung_schmiede')).slice(1), ['+8 Eisenbrocken']);
});
