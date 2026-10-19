// tests/xpKurve.js — die Level-Kurve, wie sie in js/main.js steht.
//
// main.js laesst sich nicht als Modul laden (freie Script-Globals ueberall).
// Darum werden die drei Konstanten und getNeededXP aus dem Quelltext gezogen
// und allein ausgefuehrt: so prueft ein Test die echte Kurve und keinen
// Spiegel, der still veraltet.
const fs = require('fs');
const path = require('path');

const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const teile = ['XP_CURVE_BASE', 'XP_CURVE_SCALE', 'XP_CURVE_EXP'].map((name) => {
  const m = new RegExp('^const ' + name + ' = [^;]+;', 'm').exec(quelle);
  if (!m) throw new Error(name + ' steht nicht mehr in js/main.js');
  return m[0];
});
const fn = /^function getNeededXP\(level\) \{[\s\S]*?^\}/m.exec(quelle);
if (!fn) throw new Error('getNeededXP steht nicht mehr in js/main.js');

// eslint-disable-next-line no-new-func
const kurve = new Function(teile.join('\n') + '\n' + fn[0]
  + '\nreturn { getNeededXP: getNeededXP, BASE: XP_CURVE_BASE, SCALE: XP_CURVE_SCALE, EXP: XP_CURVE_EXP };')();

/** Gesamte Erfahrung von Stufe 1 bis zum Erreichen von `stufe`. */
function xpBisStufe(stufe) {
  let s = 0;
  for (let l = 1; l < stufe; l++) s += kurve.getNeededXP(l);
  return s;
}

module.exports = Object.assign({ xpBisStufe }, kurve);
