// tests/gegenstandTooltip.test.js — der Tooltip zeigt absolute Punkte (#104).
//
// Gemeldet als "Ruestung zeigt +1110 %". Ursache: seit #104 stehen armor, crit
// und move auf einer Basis als ABSOLUTE Punkte, die mit der Fundtiefe wachsen.
// Der Tooltip stammte noch aus der Zeit davor und rechnete sie wie einen Bruch:
//
//   Kettenhaube   Tiefe  1   armor  2,7  ->   "+270 %"
//   Plattenpanzer Tiefe 20   armor 36,3  ->  "+3630 %"
//
// Vereinbart ist: der Tooltip zeigt den absoluten Wert (damit sich zwei
// Fundstuecke vergleichen lassen), der Charakterbogen zeigt daneben, was die
// Punkte auf der aktuellen Tiefe bewirken.
//
// Der Test greift ueber window.formatItemTooltip auf den ECHTEN Formatierer zu,
// nicht auf den Quelltext — eine Quelltextpruefung haette den Fehler auch vor
// der Meldung nicht gefunden.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Tooltip-Zeilen eines frisch gerollten Stuecks. */
function tooltip(basis, tiefe) {
  return H.run(`(function () {
    window.DUNGEON_DEPTH = ${tiefe}; window.currentWave = ${tiefe};
    var it = window.LootSystem.rollItem('${basis}', ${tiefe}, 0);
    it.affixes = [];
    return { text: window.formatItemTooltip(it).body,
             armor: it.armor || 0, crit: it.crit || 0 };
  })()`);
}

// Der Tooltip kommt als EIN String zurueck; aufgeteilt wird HIER. Ein
// Zeilenumbruch-Escape im eingeschleusten Template wuerde beim Einsetzen zum
// echten Umbruch und das Skript zerreissen.
function zeilen(t) { return String(t.text || '').split(String.fromCharCode(10)); }

function zeileMit(zn, wort) {
  return zn.find((z) => z.indexOf(wort) === 0);
}

test('#104: keine Prozentzahl im vierstelligen Bereich mehr', () => {
  [['HD_KETTENHAUBE', 1], ['BD_PLATTENPANZER', 20], ['BD_SCHATTENKUTTE', 30]].forEach(([b, t]) => {
    const t9 = tooltip(b, t);
    zeilen(t9).forEach((z) => {
      const m = z.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
      if (!m) return;
      assert.ok(Number(m[1]) <= 100,
        b + ' auf Tiefe ' + t + ' zeigt "' + z.trim() + '" — das ist keine Prozentzahl');
    });
  });
});

test('#104: die Ruestungszeile nennt die Punkte, die auf dem Stueck stehen', () => {
  const t9 = tooltip('BD_PLATTENPANZER', 20);
  const z = zeileMit(zeilen(t9), 'Rüstung');
  assert.ok(z, 'keine Ruestungszeile im Tooltip: ' + zeilen(t9).join(' | '));
  assert.ok(t9.armor > 20, 'Testannahme verfehlt: armor war nur ' + t9.armor);
  const zahl = Number((z.match(/\+([0-9]+(?:\.[0-9]+)?)/) || [])[1]);
  assert.ok(Math.abs(zahl - t9.armor) < 0.1,
    'Tooltip zeigt ' + zahl + ', auf dem Stueck stehen ' + t9.armor + ' (' + z.trim() + ')');
  assert.ok(z.indexOf('%') < 0, 'die Ruestungszeile traegt ein Prozentzeichen: ' + z.trim());
});

test('#104: dieselbe Regel gilt fuer Krit', () => {
  const t9 = tooltip('BD_SCHATTENKUTTE', 30);
  const z = zeileMit(zeilen(t9), 'Krit');
  assert.ok(z, 'keine Kritzeile im Tooltip: ' + zeilen(t9).join(' | '));
  const zahl = Number((z.match(/\+([0-9]+(?:\.[0-9]+)?)/) || [])[1]);
  assert.ok(Math.abs(zahl - t9.crit) < 0.1,
    'Tooltip zeigt ' + zahl + ', auf dem Stueck stehen ' + t9.crit + ' (' + z.trim() + ')');
  assert.ok(z.indexOf('%') < 0, 'die Kritzeile traegt ein Prozentzeichen: ' + z.trim());
});

test('Angriffstempo bleibt ein Prozentwert', () => {
  // Die Gegenprobe: speed ist WIRKLICH ein Bruch (Eigenart der Basis, nicht
  // ihre Staerke) und darf nicht mit umgestellt werden. Ohne diese Zeile waere
  // "alles ohne Prozent" die einfachste Art, den Test zu bestehen.
  const t9 = tooltip('BD_PLATTENPANZER', 20);
  const z = zeileMit(zeilen(t9), 'Angriffstempo') || zeileMit(zeilen(t9), 'Tempo');
  assert.ok(z, 'keine Tempozeile im Tooltip: ' + zeilen(t9).join(' | '));
  assert.ok(z.indexOf('%') > 0, 'die Tempozeile hat ihr Prozentzeichen verloren: ' + z.trim());
});
