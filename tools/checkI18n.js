// tools/checkI18n.js — welche deutschen i18n-Keys haben keine englische Fassung? (#87)
//
// Deutsch ist die Quelle (viele Keys werden automatisch aus den Datenstrukturen
// abgeleitet, z. B. Quest- und Story-Texte); Englisch existiert nur als
// ausdrueckliche Uebersetzung. Fehlt sie, faellt das Spiel still auf Deutsch
// zurueck — im Spiel unsichtbar, fuer englische Spieler sofort da.
//
// Laedt das echte Spiel (Hub), damit auch die Keys erfasst sind, die Szenen erst
// beim Aufbau registrieren, und vergleicht die beiden Woerterbuecher.
//
//   node tools/checkI18n.js          Liste der fehlenden Keys, Exit 1 bei Luecken
//   node tools/checkI18n.js --json   dasselbe als JSON
//
// Auch als Modul: require('./checkI18n').pruefen() -> Promise<{ fehlend, gleich }>.

const path = require('path');
const { launch } = require(path.join(__dirname, 'headless', 'index.js'));

// Keys, die in beiden Sprachen bewusst gleich sind (Namen, Zahlen, Symbole),
// sind keine Luecke. Sie stehen trotzdem in EN, damit der Check sauber bleibt.

// Auf einem laufenden Headless-Spiel: fehlende EN-Keys und EN-Werte, die noch
// deutsch aussehen (Umlaute, oder laengerer Text identisch mit DE).
function vergleichen(H) {
  return H.run(`(function () {
    var i = window.i18n;
    var de = i._keys('de'), en = {};
    i._keys('en').forEach(function (k) { en[k] = true; });
    var fehlend = de.filter(function (k) { return !en[k]; }).sort();
    // Verwaist: EN ohne DE — meist eine Bindung, die nicht mehr greift.
    var deSet = {}; de.forEach(function (k) { deSet[k] = true; });
    var verwaist = Object.keys(en).filter(function (k) { return !deSet[k]; }).sort();
    var deutschInEn = Object.keys(en).filter(function (k) {
      var v = i._wert('en', k), d = i._wert('de', k);
      if (typeof v !== 'string') return false;
      return /[\\u00e4\\u00f6\\u00fc\\u00df]/i.test(v) || (v === d && v.replace(/{[a-z]+}/gi, '').length > 24);
    }).sort();
    return { fehlend: fehlend, verwaist: verwaist, deutschInEn: deutschInEn, de: de.length, en: Object.keys(en).length };
  })()`);
}

async function pruefen() {
  const H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    await H.waitForScene('HubSceneV2', { maxRounds: 250 });
    H.step(10);
    return vergleichen(H);
  } finally {
    await H.shutdown();
  }
}

if (require.main === module) {
  pruefen().then((r) => {
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      r.fehlend.forEach((k) => console.log(k));
      console.log('\n' + r.fehlend.length + ' deutsche Keys ohne englische Fassung (DE ' + r.de + ', EN ' + r.en + ')');
      if (r.verwaist.length) {
        console.log('\nEnglische Keys ohne deutsche Quelle:');
        r.verwaist.forEach((k) => console.log('  ' + k));
      }
      if (r.deutschInEn.length) {
        console.log('\nEnglische Fassung sieht deutsch aus:');
        r.deutschInEn.forEach((k) => console.log('  ' + k));
      }
    }
    process.exit(r.fehlend.length || r.verwaist.length || r.deutschInEn.length ? 1 : 0);
  }).catch((e) => { console.error(e); process.exit(2); });
}

module.exports = { pruefen, vergleichen };
