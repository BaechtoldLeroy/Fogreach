#!/usr/bin/env node
// tools/headless.js — CLI: startet Fogreach ohne Rendering und berichtet.
//
//   node tools/headless.js            kurzer Statusbericht
//   node tools/headless.js --verbose  zusaetzlich die Spiel-Konsolenausgabe
//   node tools/headless.js --frames N nach dem Boot N Frames takten
//
// Exit-Code 0 = Boot sauber, 1 = Fehler (fuer CI verwendbar).

// Explizit auf index.js: `require('./headless')` wuerde in Node zuerst diese
// Datei selbst treffen (Datei schlaegt Ordner) -> Zirkelbezug.
const { launch } = require('./headless/index.js');

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

(async () => {
  const verbose = process.argv.includes('--verbose');
  const extraFrames = parseInt(arg('--frames', '0'), 10) || 0;

  const t0 = Date.now();
  const h = await launch({ verbose });
  const bootMs = Date.now() - t0;

  if (extraFrames > 0) {
    await h.settle(() => false, { maxRounds: Math.ceil(extraFrames / 10), framesPerRound: 10 });
  }

  const scenes = h.scenes();
  const running = scenes.filter((s) => s.status === 'RUNNING');
  const errs = h.hardErrors();
  const warns = h.errors.filter((e) => e.level === 'warn');
  const start = h.scene('StartScene');

  console.log('=== Fogreach headless ===');
  console.log(`Skripte geladen : ${h.loaded.length}` + (h.skipped.length ? `  (uebersprungen: ${h.skipped.length})` : ''));
  console.log(`Boot-Dauer      : ${bootMs} ms`);
  console.log(`Laufende Szenen : ${running.length ? running.map((s) => s.key).join(', ') : '(keine)'}`);
  if (start && start.load) {
    console.log(`Assets          : ${start.load.totalComplete} geladen, ${start.load.totalFailed} fehlgeschlagen`);
  }
  console.log(`Anzeigeobjekte  : ${start && start.children ? start.children.list.length : '?'}`);
  console.log(`Fehler          : ${errs.length}`);
  console.log(`Warnungen       : ${warns.length}`);

  if (h.skipped.length) {
    console.log('\nUebersprungene Skripte:');
    h.skipped.forEach((s) => console.log(`  ${s.file} -> ${String(s.reason).slice(0, 140)}`));
  }
  if (errs.length) {
    console.log('\nFehler:');
    errs.slice(0, 20).forEach((e) => console.log(`  ${String(e.msg).slice(0, 200)}`));
  }
  if (verbose && warns.length) {
    console.log('\nWarnungen:');
    warns.slice(0, 20).forEach((e) => console.log(`  ${String(e.msg).slice(0, 200)}`));
  }

  await h.shutdown();

  const ok = errs.length === 0 && h.skipped.length === 0 && running.length > 0;
  console.log(`\n${ok ? 'OK' : 'FEHLGESCHLAGEN'}`);
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('Headless-Start abgebrochen:', e && e.stack ? e.stack : e);
  process.exit(1);
});
