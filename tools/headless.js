#!/usr/bin/env node
// tools/headless.js — CLI: startet Fogreach ohne Rendering und berichtet.
//
//   node tools/headless.js             Statusbericht (Boot bis StartScene)
//   node tools/headless.js --verbose   zusaetzlich die Spiel-Konsolenausgabe
//   node tools/headless.js --frames N  nach dem Boot N Frames takten
//   node tools/headless.js --play      in einen Dungeon-Run einsteigen und den
//                                      Bot spielen lassen
//   node tools/headless.js --play --depth 5   Run auf Tiefe 5
//   node tools/headless.js --soak 25 Dauerlauf ueber 25 Raeume (sucht Fehler,
//                                     die erst in der Menge auftreten)
//
// Exit-Code 0 = sauber, 1 = Fehler (fuer CI verwendbar).

// Explizit auf index.js: `require('./headless')` wuerde in Node zuerst diese
// Datei selbst treffen (Datei schlaegt Ordner) -> Zirkelbezug.
const { launch, launchDungeon } = require('./headless/index.js');

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

(async () => {
  const verbose = process.argv.includes('--verbose');
  const extraFrames = parseInt(arg('--frames', '0'), 10) || 0;

  const soakRooms = parseInt(arg('--soak', '0'), 10) || 0;
  const play = process.argv.includes('--play') || soakRooms > 0;
  const depth = parseInt(arg('--depth', '1'), 10) || 1;

  const t0 = Date.now();
  const h = play
    ? await launchDungeon({ verbose, depth })
    : await launch({ verbose });
  const bootMs = Date.now() - t0;

  let botResult = null;
  let soakResult = null;
  if (soakRooms > 0) {
    soakResult = await h.soak({ rooms: soakRooms });
  } else if (play) {
    botResult = await h.bot.hunt({ rounds: parseInt(arg('--rounds', '250'), 10) || 250 });
  }

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
  // Objekte der AKTIVEN Szene zaehlen (nach --play ist StartScene beendet).
  const liveScene = running.length ? h.scene(running[0].key) : start;
  console.log(`Anzeigeobjekte  : ${liveScene && liveScene.children ? liveScene.children.list.length : '?'}`);
  if (play) {
    const w = h.world();
    console.log(`Run             : Tiefe ${w.depth}, Welle ${w.wave}`);
    console.log(`Spieler         : ${w.hp}/${w.maxHp} LP`);
    console.log(`Gegner im Raum  : ${w.enemies}`);
    if (botResult) console.log(`Bot             : ${botResult.kills} erlegt in ${botResult.rounds} Runden`);
    if (soakResult) {
      console.log(`Dauerlauf       : ${soakResult.rooms} Raeume, ${soakResult.kills} Kills`);
      console.log(`  ohne Gegner   : ${soakResult.roomsWithoutEnemies}`);
      console.log(`  Abbrueche     : ${soakResult.errors.length ? soakResult.errors.join('; ') : 'keine'}`);
    }
  }
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
