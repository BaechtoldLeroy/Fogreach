// tests/opferstein.test.js — Der Opferstein wirft ein ANGELEGTES Stueck um (#71).
//
// Tiefe 1 kannte nur Schatz und Lore-Fragment, beide ohne Entscheidung. Der
// Stein nimmt, was man traegt, und gibt DASSELBE Stueck mit anderen Zahlen
// zurueck: 60 % besser, 40 % schlechter, der Betrag multiplikativ symmetrisch
// (mal 1+s oder geteilt durch 1+s).
//
// Bis b450 suchte er unter frischen Wuerfen einen passenden Kandidaten.
// Gemessen gewann ein gutes Stueck damit nur +8 bis +11 %, verlor aber -18 %;
// der Schaden einer "besseren" Waffe fiel in 20 bis 50 % der Faelle, die
// Affix-Arten wechselten, und Questgegenstaende kamen nie verwandelt zurueck.
// Die Tests unten halten jede dieser Stellen fest — mit der ECHTEN
// Staerkeformel aus inventory.js, nicht mit einem Ersatz: genau die Gewichtung
// dort (Affixe tragen die Staerke) war die Ursache des Hauptwert-Fehlers.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;

// Fester Zufall: jeder Lauf prueft dieselben Stuecke, ein Fehler laesst sich
// nachstellen.
let _saat = 12345;
Math.random = () => {
  _saat = (_saat * 1103515245 + 12345) % 2147483648;
  return _saat / 2147483648;
};

// Ein i18n, das die registrierten Texte wirklich einsetzt — die Meldung des
// Steins wird woertlich geprueft.
const TEXTE = { de: {
  'inventory.label.damage': 'Schaden', 'inventory.label.armor': 'Rüstung',
  'inventory.label.move': 'Lauftempo', 'inventory.label.sicht': 'Sichtweite'
}, en: {} };
W.i18n = {
  register(lang, dict) { Object.assign(TEXTE[lang] = TEXTE[lang] || {}, dict); },
  t(k, p) {
    const v = TEXTE.de[k];
    if (typeof v !== 'string') return k;
    return v.replace(/\{(\w+)\}/g, (m, n) => (p && n in p) ? String(p[n]) : m);
  },
  onChange() {}
};
W.Phaser = W.Phaser || {
  Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Utils: { Array: { GetRandom: (a) => a[0] } },
};

// Die echte Staerkeformel. inventory.js als Ganzes braucht Phaser-Anzeige-
// objekte; computeItemPower selbst haengt nur an window.LootSystem und wird
// deshalb aus dem Quelltext geschnitten — aendert sich die Formel, rechnet
// dieser Test mit.
(function () {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  const a = src.indexOf('const computeItemPower = (it) => {');
  const e = src.indexOf('\n};', a);
  assert.ok(a > 0 && e > a, 'computeItemPower nicht in inventory.js gefunden');
  // eslint-disable-next-line no-new-func
  W.computeItemPower = new Function('window', src.slice(a, e + 3) + '\nreturn computeItemPower;')(W);
})();

loadGameModule('js/lootSystem.js');
loadGameModule('js/eventSystem.js');
const E = W.EventSystem;
const LS = W.LootSystem;
const P = W.computeItemPower;

const SLOT_BASEN = {
  weapon: ['WPN_EISENKLINGE', 'WPN_SCHATTENDOLCH', 'WPN_GLUTAXT', 'WPN_ESCHENBOGEN', 'WPN_RICHTSCHWERT'],
  head: ['HD_KETTENHAUBE', 'HD_BRONZEHELM', 'HD_SCHLANGENMASKE'],
  body: ['BD_LEDERHARNISCH', 'BD_PLATTENPANZER', 'BD_SCHATTENKUTTE'],
  boots: ['BT_LEDERSTIEFEL', 'BT_STAHLSOHLEN', 'BT_WINDLAEUFER'],
  offhand: ['OF_BUCHBINDERSCHILD', 'OF_PAVESE', 'OF_WANDSCHIRM', 'OF_TALGLICHT',
    'OF_BANNLATERNE', 'OF_GLUTSCHALE', 'OF_FANGDOLCH', 'OF_KETTENHAKEN']
};

function ausruesten(slot, stueck) {
  W.equipment = { weapon: null, offhand: null, head: null, body: null, boots: null, amulet: null };
  W.equipment[slot] = stueck;
  return W.equipment;
}

const kopie = (it) => JSON.parse(JSON.stringify(it));

// Ein breiter Querschnitt: jede Basis, jede Seltenheit, flach bis tief,
// teils ausgebaut.
function querschnitt() {
  const aus = [];
  Object.keys(SLOT_BASEN).forEach((slot) => {
    SLOT_BASEN[slot].forEach((key) => {
      [0, 1, 2, 3].forEach((tier) => {
        [1, 5, 12, 25].forEach((iL) => {
          const it = LS.rollItem(key, iL, tier, undefined, { ohneDeckel: true });
          if ((iL + tier) % 2) LS.ausbauen(it);
          aus.push({ slot, it });
        });
      });
    });
  });
  return aus;
}

// Wie questSystem._lohnStueckRollen ein Lohnstueck baut (seit b442): Basis
// wuerfeln, dann eigener key, fester Name, Signaturwert, Sondermerker.
function elarasKlinge(iLevel) {
  const it = LS.rollItem('WPN_EISENKLINGE', iLevel, 3, null, { ohneDeckel: true });
  it.key = 'ELARAS_KLINGE';
  it.iconKey = 'itSword';
  it.nameKey = 'quest.reward.ELARAS_KLINGE';
  it.name = it._baseName = 'Elaras Klinge';
  it.festerName = true;
  const p = Math.round(LS.affixPunkte(0.15, iLevel) * 10) / 10;
  it.baseStats.crit = p;
  it.crit = p;
  it.elaraGift = true;
  it.displayName = LS.composeName(it);
  return it;
}

test('Der Stein sieht nur ANGELEGTE Stuecke, nicht das Inventar', () => {
  ausruesten('weapon', LS.rollItem('WPN_SCHATTENDOLCH', 5, 1));
  W.inventory = [LS.rollItem('WPN_GLUTAXT', 5, 2)];
  const k = E.opferKandidaten();
  assert.strictEqual(k.length, 1, 'genau das angelegte Stueck');
  assert.strictEqual(k[0].slot, 'weapon');
  assert.strictEqual(k[0].item.key, 'WPN_SCHATTENDOLCH');
});

test('Amulette bleiben aussen vor', () => {
  // Sie tragen keine Werte, nur einen Effekt — der Stein haette nichts zu
  // veraendern und wuerde den Lauf-Bonus stillschweigend austauschen.
  W.equipment = { weapon: null, amulet: { key: 'AMU_X', isAmulet: true, effect: 'glasherz' } };
  assert.strictEqual(E.opferKandidaten().length, 0);
});

test('Ohne Ausruestung gibt es nichts herzugeben', () => {
  W.equipment = { weapon: null, head: null, body: null, boots: null };
  assert.strictEqual(E.opferKandidaten().length, 0);
  W.equipment = null;
  assert.strictEqual(E.opferKandidaten().length, 0, 'auch ohne equipment-Objekt');
});

test('Die Muenze faellt zu 60 % auf "besser" — als reine Funktion geprueft', () => {
  // Ein gleichmaessiges Raster statt Zufallsstatistik: genau 600 von 1000.
  let besser = 0;
  for (let i = 0; i < 1000; i++) {
    let n = 0;
    const w = E.opferWurf(() => (n++ === 0 ? (i + 0.5) / 1000 : 0.5));
    if (w.besser) besser++;
    assert.ok(w.spanne >= 0.10 - 1e-9 && w.spanne <= 0.35 + 1e-9, 'Spanne ausserhalb 10-35 %: ' + w.spanne);
  }
  assert.strictEqual(besser, 600, 'Quote "besser" ist ' + besser + ' von 1000');
  const w0 = E.opferWurf(() => 0);
  const w1 = E.opferWurf(() => 0.999999);
  assert.ok(Math.abs(w0.spanne - 0.10) < 1e-9 && Math.abs(w1.spanne - 0.35) < 1e-4, 'Spanne reicht nicht von 10 bis 35 %');
});

test('opferUmwurf folgt dem Wurf aus opferWurf, wenn keiner vorgegeben ist', () => {
  // Sonst haette die gepruefte Quote mit dem Spiel nichts zu tun.
  let besser = 0, gesamt = 0;
  for (let i = 0; i < 400; i++) {
    ausruesten('weapon', LS.rollItem('WPN_SCHATTENDOLCH', 12, 1));
    const r = E.opferUmwurf('weapon', 12);
    if (!r || r.unveraendert) continue;
    gesamt++;
    if (r.besser) besser++;
    assert.ok(r.besser ? r.neu > r.alt : r.neu < r.alt, 'Ergebnis auf der falschen Seite');
  }
  assert.ok(gesamt > 380, 'zu viele Verweigerungen: ' + (400 - gesamt));
  const q = besser / gesamt;
  assert.ok(q > 0.52 && q < 0.68, 'Quote ' + Math.round(100 * q) + ' % statt rund 60 %');
});

test('Gewinn und Verlust sind gleich gross: mal (1+s) und geteilt durch (1+s)', () => {
  W.recalcDerived = () => {};
  let geprueft = 0;
  querschnitt().forEach(({ slot, it }) => {
    const s = 0.10 + ((geprueft * 7) % 26) / 100;   // 10 bis 35 %
    ausruesten(slot, kopie(it));
    const b = E.opferUmwurf(slot, 10, { besser: true, spanne: s });
    ausruesten(slot, kopie(it));
    const w = E.opferUmwurf(slot, 10, { besser: false, spanne: s });
    // Ob der Stein ein Stueck verweigert, haengt am Stueck, nicht an der Muenze.
    assert.strictEqual(!!b.unveraendert, !!w.unveraendert,
      it.key + ' T' + it.tier + ': nur eine Seite verweigert');
    if (b.unveraendert) return;
    geprueft++;
    assert.ok(Math.abs(b.spanne - w.spanne) < 1e-12, 'die Spanne haengt an der Seite');
    assert.ok(b.spanne <= s + 1e-12, 'Spanne groesser als gewuerfelt');
    const alt = P(it);
    const tol = (z) => Math.max(1, z * 0.02);
    const zielB = alt * (1 + b.spanne), zielW = alt / (1 + w.spanne);
    assert.ok(Math.abs(b.neu - zielB) <= tol(zielB),
      it.key + ' besser: ' + alt + ' -> ' + b.neu + ', Ziel ' + zielB.toFixed(1));
    assert.ok(Math.abs(w.neu - zielW) <= tol(zielW),
      it.key + ' schlechter: ' + alt + ' -> ' + w.neu + ', Ziel ' + zielW.toFixed(1));
    assert.strictEqual(b.neu, P(b.item), 'gemeldete Staerke ist nicht die des Stuecks');
    assert.strictEqual(w.neu, P(w.item), 'gemeldete Staerke ist nicht die des Stuecks');
  });
  assert.ok(geprueft > 300, 'zu wenige gepruefte Stuecke: ' + geprueft);
});

test('Gute, tiefe Stuecke bekommen die volle Spanne — kein stiller Deckel', () => {
  // Der alte Fehler: gute Stuecke landeten auf der Gewinnseite knapp ueber
  // dem alten Wert, weil kaum ein Kandidat das Ziel erreichte.
  for (let i = 0; i < 100; i++) {
    const it = LS.rollItem('BD_PLATTENPANZER', 15 + (i % 10), 2, undefined, { ohneDeckel: true });
    ausruesten('body', it);
    const r = E.opferUmwurf('body', 15, { besser: true, spanne: 0.35 });
    assert.ok(!r.unveraendert, 'verweigert');
    assert.ok(Math.abs(r.spanne - 0.35) < 1e-12, 'Spanne gedeckelt auf ' + r.spanne.toFixed(3));
    assert.ok(r.neu / r.alt > 1.30, 'Gewinn nur x' + (r.neu / r.alt).toFixed(2));
  }
});

test('Der Hauptwert widerspricht der Meldung nie', () => {
  let besser = 0, schlechter = 0;
  querschnitt().forEach(({ slot, it }, i) => {
    [true, false].forEach((seite) => {
      ausruesten(slot, kopie(it));
      const r = E.opferUmwurf(slot, 10, { besser: seite, spanne: 0.10 + (i % 26) / 100 });
      if (r.unveraendert) return;
      const stat = E.opferHauptwert(slot, it);
      assert.ok(stat, it.key + ': kein Hauptwert');
      assert.strictEqual(r.haupt.stat, stat);
      assert.strictEqual(r.haupt.vorher, it[stat]);
      assert.strictEqual(r.haupt.nachher, r.item[stat]);
      if (seite) {
        besser++;
        assert.ok(r.item[stat] >= it[stat], it.key + ': ' + stat + ' ' + it[stat] + ' -> ' + r.item[stat] + ' bei "besser"');
      } else {
        schlechter++;
        assert.ok(r.item[stat] <= it[stat], it.key + ': ' + stat + ' ' + it[stat] + ' -> ' + r.item[stat] + ' bei "schlechter"');
      }
    });
  });
  assert.ok(besser > 300 && schlechter > 300, 'zu wenige Faelle: ' + besser + '/' + schlechter);
});

test('Der Hauptwert je Platz', () => {
  const h = (key, slot) => E.opferHauptwert(slot, LS.rollItem(key, 10, 0));
  assert.strictEqual(h('WPN_GLUTAXT', 'weapon'), 'damage');
  assert.strictEqual(h('HD_SCHLANGENMASKE', 'head'), 'armor', 'Ruestung, nicht der hoeher gewichtete Krit');
  assert.strictEqual(h('BD_SCHATTENKUTTE', 'body'), 'armor');
  assert.strictEqual(h('BT_STAHLSOHLEN', 'boots'), 'move', 'Lauftempo, nicht die Ruestung der Sohlen');
  assert.strictEqual(h('OF_WANDSCHIRM', 'offhand'), 'block');
  assert.strictEqual(h('OF_PAVESE', 'offhand'), 'armor');
  assert.strictEqual(h('OF_GLUTSCHALE', 'offhand'), 'brand');
  assert.strictEqual(h('OF_TALGLICHT', 'offhand'), 'sicht');
  assert.strictEqual(h('OF_FANGDOLCH', 'offhand'), 'crit');
});

test('Das Stueck bleibt wiedererkennbar: Basis, Seltenheit, Affix-Arten, Ausbau, Name, iLevel', () => {
  querschnitt().forEach(({ slot, it }, i) => {
    const alt = kopie(it);
    ausruesten(slot, it);
    const r = E.opferUmwurf(slot, 30, { besser: i % 2 === 0, spanne: 0.3 });
    if (r.unveraendert) return;
    const n = r.item;
    assert.strictEqual(W.equipment[slot], n, 'das neue Stueck ist nicht angelegt');
    assert.strictEqual(n.key, alt.key, 'andere Basis');
    assert.strictEqual(n.tier, alt.tier, 'andere Seltenheit');
    assert.strictEqual(n.iLevel, alt.iLevel, 'iLevel veraendert (Stein auf Tiefe 30)');
    assert.strictEqual(LS.ausbauStufe(n), LS.ausbauStufe(alt), 'Ausbau verloren');
    assert.strictEqual(n.affixes.map((a) => a.defId).join(','), alt.affixes.map((a) => a.defId).join(','),
      'Affix-Arten getauscht');
    assert.strictEqual(n.displayName, alt.displayName, 'anderer Name');
    // Die Eigenart der Basis bleibt, wie sie ist.
    assert.strictEqual(n.speed, alt.speed, 'Tempo veraendert');
    assert.strictEqual(n.range, alt.range, 'Reichweite veraendert');
    // Oberwert und baseStats laufen nicht auseinander.
    ['damage', 'armor', 'crit', 'move', 'hp', 'block', 'brand', 'sicht'].forEach((k) => {
      if (typeof alt.baseStats[k] === 'number' && alt.baseStats[k] === alt[k]) {
        assert.strictEqual(n.baseStats[k], n[k], k + ': Oberwert und baseStats auseinander');
      }
    });
    // Das alte Stueck selbst bleibt unberuehrt (es koennte noch referenziert sein).
    assert.deepStrictEqual(kopie(it), alt, 'das Ausgangsstueck wurde veraendert');
  });
});

test('Ohne iLevel klettert nichts: das Stueck behaelt, was es hat', () => {
  const it = LS.rollItem('WPN_SCHATTENDOLCH', 10, 1);
  delete it.iLevel;
  ausruesten('weapon', it);
  const r = E.opferUmwurf('weapon', 3, { besser: true, spanne: 0.2 });
  assert.ok(!r.unveraendert);
  assert.strictEqual(r.item.iLevel, undefined, 'iLevel aus der Tiefe erfunden');
  // Die Werte sind die des Stuecks, nicht die einer Tiefe-3-Waffe.
  assert.ok(r.item.damage > it.damage);
});

test('Questgegenstaende: Elaras Klinge wird verwandelt und bleibt Elaras Klinge', () => {
  let besser = 0, schlechter = 0;
  for (let i = 0; i < 60; i++) {
    const it = elarasKlinge(8 + (i % 12));
    const alt = kopie(it);
    ausruesten('weapon', it);
    assert.strictEqual(E.opferKandidaten().length, 1, 'die Klinge wird nicht angeboten');
    const r = E.opferUmwurf('weapon', 10, { besser: i % 2 === 0, spanne: 0.25 });
    assert.ok(!r.unveraendert, 'die Klinge wurde verweigert (frueher: immer "kein Gewinn")');
    if (r.besser) besser++; else schlechter++;
    const n = r.item;
    assert.strictEqual(n.key, 'ELARAS_KLINGE');
    assert.strictEqual(n.elaraGift, true, 'elaraGift verloren');
    assert.strictEqual(n.festerName, true, 'festerName verloren');
    assert.strictEqual(n.nameKey, alt.nameKey);
    assert.strictEqual(n.iconKey, alt.iconKey);
    assert.strictEqual(n.displayName, alt.displayName);
    // Die Signatur (Krit) geht mit dem Stueck mit, statt zu verschwinden.
    assert.ok(r.besser ? n.crit > alt.crit : n.crit < alt.crit, 'Signaturwert nicht mitgezogen');
    assert.ok(r.besser ? n.damage > alt.damage : n.damage < alt.damage, 'Schaden gegen die Meldung');
  }
  assert.ok(besser > 0 && schlechter > 0);
});

test('Ein Stueck ohne Spielraum verweigert der Stein — ehrlich und ohne Tausch', () => {
  // Fast nur fester Affix-Grundbetrag: mit keinem Faktor auf 10 % zu bewegen.
  const it = {
    key: 'WPN_EISENKLINGE', type: 'weapon', tier: 3, iLevel: 1, damage: 0.1,
    baseStats: { damage: 0.1 }, name: 'Eisenklinge',
    affixes: [{ defId: 'attr_strength', value: 0.1 }, { defId: 'attr_dexterity', value: 0.1 },
      { defId: 'attr_focus', value: 0.1 }]
  };
  ausruesten('weapon', it);
  assert.ok(E.opferSpielraum(it) < 0.05, 'Spielraum ' + E.opferSpielraum(it));
  assert.strictEqual(E.opferKandidaten().length, 0, 'ein unbewegliches Stueck wird trotzdem angeboten');
  [true, false].forEach((seite) => {
    ausruesten('weapon', it);
    const r = E.opferUmwurf('weapon', 1, { besser: seite, spanne: 0.35 });
    assert.ok(r.unveraendert, 'nicht verweigert');
    assert.strictEqual(W.equipment.weapon, it, 'trotz Verweigerung getauscht');
    assert.strictEqual(E.opferMeldung(r), 'Der Stein verweigert das Opfer.');
  });
});

test('Die Meldung nennt den Hauptwert vorher und nachher', () => {
  const it = LS.rollItem('WPN_GLUTAXT', 12, 1);
  ausruesten('weapon', kopie(it));
  const b = E.opferUmwurf('weapon', 12, { besser: true, spanne: 0.2 });
  assert.strictEqual(E.opferMeldung(b), 'Der Stein gibt mehr zurück, als er nahm. Schaden '
    + it.damage.toFixed(1) + ' → ' + b.item.damage.toFixed(1));
  ausruesten('weapon', kopie(it));
  const w = E.opferUmwurf('weapon', 12, { besser: false, spanne: 0.2 });
  assert.strictEqual(E.opferMeldung(w), 'Der Stein gibt weniger zurück, als er nahm. Schaden '
    + it.damage.toFixed(1) + ' → ' + w.item.damage.toFixed(1));
  // Sicht wie im Tooltip: ganzzahlig mit Prozentzeichen.
  ausruesten('offhand', LS.rollItem('OF_TALGLICHT', 5, 0));
  const l = E.opferUmwurf('offhand', 5, { besser: true, spanne: 0.3 });
  assert.ok(/Sichtweite 25% → \d+%$/.test(E.opferMeldung(l)), E.opferMeldung(l));
});

test('Jede Meldung des Steins gibt es deutsch und englisch, die Werte-Namen aus dem Tooltip', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'eventSystem.js'), 'utf8');
  ['better', 'worse', 'better_stat', 'worse_stat', 'refused'].forEach((k) => {
    const n = src.split("'event.altar." + k + "':").length - 1;
    assert.strictEqual(n, 2, 'event.altar.' + k + ': ' + n + ' statt 2 Fassungen');
  });
  assert.ok(!src.includes("'event.altar.same'"), 'die alte Meldung "Tausch ohne Gewinn" steht noch da');
  const inv = fs.readFileSync(path.join(__dirname, '..', 'js', 'inventory.js'), 'utf8');
  ['damage', 'armor', 'move', 'block', 'brand', 'sicht', 'crit'].forEach((s) => {
    assert.strictEqual(inv.split("'inventory.label." + s + "':").length - 1, 2, 'inventory.label.' + s + ' fehlt');
  });
});

test('Angeboten wird genau, was der Stein auch annimmt', () => {
  // Kein Angebot, das hinterher verweigert wird — und kein bewegliches
  // Stueck, das fehlt.
  let angeboten = 0, ausgelassen = 0;
  querschnitt().forEach(({ slot, it }) => {
    ausruesten(slot, kopie(it));
    const imAngebot = E.opferKandidaten().length === 1;
    const r = E.opferUmwurf(slot, 10, { besser: true, spanne: 0.2 });
    assert.strictEqual(imAngebot, !r.unveraendert,
      it.key + ' T' + it.tier + ' iL' + it.iLevel + ': angeboten=' + imAngebot + ', verweigert=' + !!r.unveraendert);
    if (imAngebot) angeboten++; else ausgelassen++;
  });
  assert.ok(angeboten > 300, 'zu wenig angeboten: ' + angeboten + ' (ausgelassen ' + ausgelassen + ')');
});

test('Ein leerer Platz wirft nichts um', () => {
  W.equipment = { weapon: null };
  assert.strictEqual(E.opferUmwurf('weapon', 5), null);
  assert.strictEqual(E.opferUmwurf('body', 5), null, 'auch ein unbekannter Platz');
  assert.strictEqual(E.opferMeldung(null), '');
});

test('Der Stein steht ab Tiefe 1 und ist nicht das haeufigste Ereignis', () => {
  const def = E.EVENT_TYPES.filter((e) => e.id === 'sacrifice_altar')[0];
  assert.ok(def, 'Opferstein ist nicht registriert');
  assert.strictEqual(def.minDepth, 1, 'er soll gerade den duennen Einstieg fuellen');
  const groesste = Math.max.apply(null, E.EVENT_TYPES.map((e) => e.weight || 0));
  assert.ok(def.weight < groesste, 'ein neues Ereignis soll nicht das haeufigste sein');
});
