/* =====================================================================
 * webAnalytics.js — Cloudflare Web Analytics fuer die Tester-Adresse
 * ---------------------------------------------------------------------
 * Zaehlt Seitenaufrufe und Besuche (ohne Cookies, ohne einzelne Besucher)
 * auf fogreach.fogreach.workers.dev. Der Token ist oeffentlich, er steht
 * ohnehin im Quelltext jeder Seite, die das Snippet nutzt.
 *
 * Bewusst NICHT geladen:
 *   - auf anderen Adressen (GitHub Pages, lokal)
 *   - im Debug-Modus (?debug=1): sonst zaehlen eigene Testlaeufe mit
 *   - in automatisierten Browsern (navigator.webdriver)
 * Das Skript kommt erst nach dem Laden der Seite, damit es den Start
 * des Spiels nicht bremst.
 * ===================================================================== */
(function () {
  'use strict';

  var HOST = 'fogreach.fogreach.workers.dev';
  var TOKEN = 'c5caf2605f0f4605b689bb84f39d0700';
  var QUELLE = 'https://static.cloudflareinsights.com/beacon.min.js';

  /** Reine Regel: soll auf dieser Seite gezaehlt werden? */
  function soll(ort, debugAn, automatisiert) {
    if (!ort || ort.hostname !== HOST) return false;
    if (debugAn || automatisiert) return false;
    return true;
  }

  function einbinden() {
    var d = window.document;
    if (!d || !d.createElement || !d.head) return false;
    var s = d.createElement('script');
    s.defer = true;
    s.src = QUELLE;
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
    d.head.appendChild(s);
    return true;
  }

  var debugAn = !!(window.DebugGate && window.DebugGate.aktiv && window.DebugGate.aktiv());
  var automatisiert = !!(window.navigator && window.navigator.webdriver);
  if (soll(window.location, debugAn, automatisiert)) {
    if (window.document && window.document.readyState === 'complete') einbinden();
    else window.addEventListener('load', einbinden);
  }

  window.WebAnalytics = { soll: soll, HOST: HOST };
})();
