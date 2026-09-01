// tests/cooldownAbstand.test.js — Keine Faehigkeit darf wieder so weit aus der
// Reihe fallen wie Wirbelwind (#102).
//
// Ausgangslage: whirlwind hatte 2500 ms, die naechstniedrigere Faehigkeit
// 6000 ms — mehr als das Doppelte Abstand, bei einem Knoten, der frueh
// offensteht. Talentpunkte konnten das nie einholen, weil alle Senkungen
// multiplikativ auf den Grundwert wirken:
//
//   cooldownMs * cdMult * lootCdMult
//     cdMult     = 1 - min(0.50, (Rang-1) * 0.12)     Skillbaum, JE Faehigkeit
//     lootCdMult = max(0.20, 1 - (Affixe + Wissensbaum 0.15 + Fokus 0.40))
//
// Das Verhaeltnis blieb dadurch auf JEDER Ausbaustufe exakt 2.40x — vom
// Grundwert bis zum absoluten Minimum (250 ms gegen 600 ms).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'abilitySystem.js'), 'utf8');

function cooldowns() {
  const re = /id:\s*'([a-zA-Z_]+)'[\s\S]{0,700}?cooldownMs:\s*([0-9]+)/g;
  const gesehen = new Set();
  const liste = [];
  let m;
  while ((m = re.exec(QUELLE))) {
    if (gesehen.has(m[1])) continue;
    gesehen.add(m[1]);
    liste.push({ id: m[1], cd: Number(m[2]) });
  }
  return liste.sort((a, b) => a.cd - b.cd);
}

test('Cooldowns: der kuerzeste Wert faellt nicht mehr aus der Reihe', () => {
  const liste = cooldowns();
  assert.ok(liste.length >= 10, 'zu wenige Faehigkeiten gelesen: ' + liste.length);

  const kuerzester = liste[0];
  const zweiter = liste.find((a) => a.cd > kuerzester.cd);
  assert.ok(zweiter, 'alle Faehigkeiten haben denselben Cooldown');

  const verhaeltnis = zweiter.cd / kuerzester.cd;
  // 2.40x war der gemeldete Missstand. Die Schwelle liegt bei 1.8 — sie laesst
  // einer bewusst schnellen Faehigkeit Luft, faengt aber eine Rueckkehr zum
  // alten Wert. Bei 5000/6000 betraegt das Verhaeltnis 1.20.
  assert.ok(verhaeltnis < 1.8,
    'der kuerzeste Cooldown (' + kuerzester.id + ' ' + kuerzester.cd + ' ms) liegt '
    + verhaeltnis.toFixed(2) + 'x unter dem naechsten (' + zweiter.id + ' '
    + zweiter.cd + ' ms) — erlaubt sind bis 1.8x');
});

test('Cooldowns: Wirbelwind steht auf 5000 ms', () => {
  // Explizit, weil es die getroffene Entscheidung ist und nicht aus der
  // Abstandsregel oben folgt.
  const ww = cooldowns().find((a) => a.id === 'whirlwind');
  assert.ok(ww, 'whirlwind nicht gefunden');
  assert.strictEqual(ww.cd, 5000, 'Wirbelwind steht nicht mehr auf 5000 ms');
});
