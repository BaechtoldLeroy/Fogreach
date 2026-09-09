// tests/statusSichtbarkeit.test.js — Statuseffekte muessen SICHTBAR bleiben,
// und Telegraphen duerfen nicht durch Waende leuchten.
//
// Zwei Befunde aus derselben Sitzung, beide ueber die Optik gemeldet:
//
// 1. "Giftklinge — hab noch keinen Gegner mit Gift-Effekt gesehen."
//    Der Effekt griff nachweislich (Botlauf: Zweig 38 x erreicht, 7 Vergiftungen,
//    alle mit Quelle poisonBlade). Nur die FARBE verschwand: drei Stellen lassen
//    den Gegner aufblitzen — Schildbruch, Krit und der allgemeine Trefferblitz —
//    und riefen danach clearTint() plus _dauerToenungHerstellen. Das stellt nur
//    Pluenderer- und Schar-Toenung wieder her, nicht die Statusfarbe. Gemessen:
//    44ff44 vor dem Blitz, ffffff danach, waehrend hasEffect(e,'poison') weiter
//    true meldete. Der Krit ist die haeufigste der drei Stellen — er allein
//    reicht, damit man Gift nie zu sehen bekommt.
//
// 2. "Die telegrafierten Attacken von Minibossen sind durch Waende sichtbar."
//    Gegner (enemy.js:539) und Geschosse (:1666) bekommen die Sichtmaske beim
//    Erzeugen, die drei Telegraph-Grafiken nicht.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const ENEMY = fs.readFileSync(path.join(WURZEL, 'js', 'enemy.js'), 'utf8');
const PLAYER = fs.readFileSync(path.join(WURZEL, 'js', 'player.js'), 'utf8');

test('ALLE drei Aufblitz-Stellen stellen eine laufende Statusfarbe her', () => {
  const stellen = PLAYER.split('enemy.clearTint();');
  assert.strictEqual(stellen.length - 1, 3,
    'erwartet drei Aufblitz-Stellen, gefunden ' + (stellen.length - 1));
  stellen.slice(1).forEach((rest, i) => {
    const block = rest.slice(0, 200);
    assert.ok(block.indexOf('_toenungNachBlitz(enemy)') >= 0,
      'Stelle ' + (i + 1) + ' stellt die Statusfarbe nicht her: '
      + block.slice(0, 90).trim());
  });
});

test('Der Helfer nimmt die Dauertoenung zuerst, sonst die Statusfarbe', () => {
  const i = PLAYER.indexOf('function _toenungNachBlitz(');
  assert.ok(i > 0, '_toenungNachBlitz fehlt');
  const k = PLAYER.slice(i, i + 800);
  assert.ok(k.indexOf('_dauerToenungHerstellen(enemy)') >= 0,
    'die Dauertoenung wird nicht zuerst geprueft — ein vergifteter Pluenderer '
    + 'verloere seine Kennfarbe');
  assert.ok(k.indexOf('refreshVisual(enemy)') >= 0,
    'die Statusfarbe wird nicht hergestellt');
});

test('statusEffectManager bietet refreshVisual oeffentlich an', () => {
  const se = fs.readFileSync(path.join(WURZEL, 'js', 'statusEffects.js'), 'utf8');
  assert.ok(se.indexOf('refreshVisual(target) {') >= 0,
    'refreshVisual fehlt — ohne sie hat der Aufruf in player.js keinen Empfaenger');
});

test('Alle drei Mini-Boss-Telegraphen tragen die Sichtmaske', () => {
  ['miniBossCharge', 'miniBossLeap', 'miniBossSalve'].forEach((fn) => {
    const start = ENEMY.indexOf('function ' + fn + '(');
    assert.ok(start > 0, fn + ' nicht gefunden');
    const rest = ENEMY.slice(start + 10);
    const ende = rest.indexOf('\nfunction ');
    const koerper = ende > 0 ? rest.slice(0, ende) : rest;
    assert.ok(koerper.indexOf('scene.add.graphics()') >= 0, fn + ' zeichnet gar nichts mehr');
    assert.ok(koerper.indexOf('_sichtMaskeAnlegen(scene, scene.add.graphics()') >= 0,
      fn + ' erzeugt eine Grafik ohne Sichtmaske — sie waere durch Waende zu sehen');
  });
});

test('Der Maskenhelfer reiht nach, wenn die Maske noch fehlt', () => {
  // Beim Szenenstart ist _enemyVisionMask noch nicht da; ohne Nachreihen
  // blieben Telegraphen aus den ersten Sekunden dauerhaft unmaskiert.
  const start = ENEMY.indexOf('function _sichtMaskeAnlegen(');
  assert.ok(start > 0, '_sichtMaskeAnlegen fehlt');
  const koerper = ENEMY.slice(start, start + 700);
  assert.ok(koerper.indexOf('_enemyVisionMask') >= 0, 'die Maske wird nicht gelesen');
  assert.ok(koerper.indexOf('_needsMaskProj') >= 0,
    'es gibt keine Nachreih-Liste — Telegraphen aus dem Szenenstart blieben unmaskiert');
});
