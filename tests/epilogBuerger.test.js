// tests/epilogBuerger.test.js — im Epilog stehen Leute aus der Stadt statt
// Klerus, Garde und Patrouillen auf dem Platz.
//
// "Im Epilog muss auch der Klerus und die Garde und die Wachen aus dem Hub
// verschwinden und stattdessen Buerger als NPCs rumstehen." Geprueft am
// laufenden Hub: was sichtbar ist, was einen Koerper hat, wohin man laufen
// kann und wer auf [E] antwortet — nicht an der Tabelle in hubLayout.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

const BUERGER = {
  epilog_baeckerin: 'buerger_baeckerin',
  epilog_zimmermann: 'buerger_zimmermann',
  epilog_alte: 'buerger_alte',
  epilog_maedchen: 'buerger_maedchen'
};
const RAT = ['klerus', 'garde', 'patrouille'];

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;

before(async () => {
  H = await launch({ search: '', renderer: 'canvas', waitFor: 'StartScene' });
  H.run(`window.game.scene.getScene('StartScene').scene.start('HubSceneV2')`);
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Spielstand setzen und den Hub neu aufbauen. */
async function stand(akt, flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.resetToAct0();
    window.storySystem.advanceToAct(${akt});
    var st = qs.getQuestSaveData();
    st.quests = {};
    if (${JSON.stringify(!!flags.story_ending)}) {
      Object.keys(qs.QUEST_DEFINITIONS).forEach(function (id) { st.quests[id] = { status: 'completed', objectives: [] }; });
    }
    st.flags = ${JSON.stringify(flags)};
    qs.loadQuestSaveData(st);
    ${hub}.scene.restart({});
  })()`);
  await H.waitForScene('HubSceneV2', { maxRounds: 100 });
  H.step(10);
}
const EPILOG = { story_ending: true, harren_dead: true, petitions_kept: true, patrouillen_verdoppelt: true };

/** Jede sichtbare Figur auf dem Platz, mit dem Bild, das sie zeigt. */
function figuren() {
  return H.run(`(function () {
    var sc = ${hub}, out = [];
    sc.children.list.forEach(function (o) {
      if (!o.texture || !o.visible || !o.active) return;
      var k = (o.getData && o.getData('standbild')) || o.texture.key;
      out.push({ key: k, id: o.getData ? o.getData('id') || null : null, x: o.x, y: o.y });
    });
    var npc = {};
    sc.npcs.forEach(function (n) {
      npc[n.data.id] = { sichtbar: !!(n.sprite.visible && n.sprite.active),
        koerper: !!(n.zone.body && n.zone.body.enable), key: n.sprite.getData('standbild') || n.sprite.texture.key,
        x: n.sprite.x, y: n.sprite.y };
    });
    return { alle: out, npc: npc, patrouillen: (sc._patrouillen || []).length, phase: sc._hubPhase };
  })()`);
}

test('Im Epilog fehlen Klerus, Stadtwache und Patrouillen', async () => {
  await stand(4, EPILOG);
  const f = figuren();
  assert.strictEqual(f.phase, 'epilogue');
  ['klerus_priester', 'stadtwache'].forEach((id) => {
    assert.strictEqual(f.npc[id].sichtbar, false, id + ' steht im Epilog auf dem Platz');
    assert.strictEqual(f.npc[id].koerper, false, id + ' ist unsichtbar, versperrt aber den Weg');
  });
  // Auch mit verdoppelten Patrouillen (Flag bleibt im Spielstand stehen).
  assert.strictEqual(f.patrouillen, 0, 'Patrouillen im Epilog');
  const rat = f.alle.filter((o) => RAT.indexOf(o.key) >= 0 || RAT.some((r) => o.key === 'hubidle_' + r));
  assert.deepStrictEqual(Array.from(rat, (o) => o.key), [], 'Figuren des Rates sichtbar');
});

test('Im Epilog stehen vier Buerger mit eigenen Bildern auf freiem, erreichbarem Boden', async () => {
  await stand(4, EPILOG);
  const f = figuren();
  const r = H.run(`(function () {
    var sc = ${hub}, K = window.HUB_NEU_KARTE, p = sc.player;
    var tex = {};
    ${JSON.stringify(Object.values(BUERGER))}.forEach(function (k) {
      var fr = sc.textures.exists(k) ? sc.textures.getFrame(k) : null;
      tex[k] = fr ? [fr.width, fr.height] : null;
    });
    // Feste Koerper genau so, wie die Physik sie sieht (Waende, Moebel, NPC).
    var fest = [];
    [sc.colliderGroup, sc.npcGroup].forEach(function (g) {
      g.getChildren().forEach(function (c) {
        var b = c.body; if (!b || !b.enable) return;
        fest.push({ x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height });
      });
    });
    var M = 1536 / 960;
    var tueren = window.HUB_HITBOXES.entrances.map(function (e) {
      return { x0: e.x * M, y0: e.y * M, x1: (e.x + e.w) * M, y1: (e.y + e.h) * M }; });
    // Der Spielerkoerper relativ zur Figur.
    var pb = p.body, bx = pb.x - p.x, by = pb.y - p.y, bw = pb.width, bh = pb.height;
    var W = sc.physics.world.bounds;
    function frei(x, y) {
      var x0 = x + bx, y0 = y + by, x1 = x0 + bw, y1 = y0 + bh;
      if (x0 < W.x || y0 < W.y || x1 > W.x + W.width || y1 > W.y + W.height) return false;
      return !fest.some(function (q) { return x0 < q.x1 && x1 > q.x0 && y0 < q.y1 && y1 > q.y0; });
    }
    // Fluten vom Startpunkt der Figur aus, Raster 8 px.
    var S = 8, sx = Math.round(p.x / S) * S, sy = Math.round(p.y / S) * S;
    var gesehen = {}, offen = [[sx, sy]], orte = [];
    gesehen[sx + ',' + sy] = 1;
    while (offen.length) {
      var o = offen.pop(); orte.push(o);
      [[S, 0], [-S, 0], [0, S], [0, -S]].forEach(function (d) {
        var n = [o[0] + d[0], o[1] + d[1]], k = n.join(',');
        if (!gesehen[k] && frei(n[0], n[1])) { gesehen[k] = 1; offen.push(n); }
      });
    }
    var out = {};
    sc.npcs.forEach(function (n) {
      var id = n.data.id;
      if (id.indexOf('epilog_') !== 0) return;
      var x = n.sprite.x, y = n.sprite.y;
      var zeile = K.zeilen[Math.floor((y - 0.5) / K.kachel)] || '';
      var zeichen = zeile.charAt(Math.floor(x / K.kachel));
      var fuss = { x0: x - 10, y0: y - 8, x1: x + 10, y1: y };
      var inWand = fest.some(function (q) {
        if (q.x0 === n.zone.body.x && q.y0 === n.zone.body.y) return false;   // der eigene Koerper
        return fuss.x0 < q.x1 && fuss.x1 > q.x0 && fuss.y0 < q.y1 && fuss.y1 > q.y0; });
      var inTuer = tueren.some(function (q) {
        return fuss.x0 < q.x1 && fuss.x1 > q.x0 && fuss.y0 < q.y1 && fuss.y1 > q.y0; });
      // Erreichbar: neben ihm stehen koennen (hoechstens zwei Kacheln vom Fuss).
      var best = null, bd = Infinity;
      orte.forEach(function (o) { var d = Math.hypot(o[0] - x, o[1] - y); if (d < bd) { bd = d; best = o; } });
      // Ansprechbar: an dieser Stelle gewinnt genau dieser NPC das [E].
      var px = p.x, py = p.y;
      p.x = best[0]; p.y = best[1];
      var offen0 = sc._dialogOpen; sc._dialogOpen = false;   // ein Aktwechsel-Hinweis kann offen stehen
      sc._refreshInteractionPrompt();
      var a = sc._activeInteractable;
      var ziel = a && a.type === 'npc' ? a.data.id : (a ? a.type : null);
      p.x = px; p.y = py; sc._dialogOpen = offen0;
      // Was er sagt.
      var orig = sc._showDialoguePages, seiten = null;
      sc._showDialoguePages = function (d, t, pages) { seiten = pages.map(function (s) { return s.text; }); };
      try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; sc._dialogOpen = false; }
      out[id] = { zeichen: zeichen, inWand: inWand, inTuer: inTuer, abstand: bd, ziel: ziel, seiten: seiten };
    });
    sc._refreshInteractionPrompt();
    return { tex: tex, npc: out, orte: orte.length,
      zeilen: window.HubPhase.npcFlavorByPhase.epilogue };
  })()`);
  assert.ok(r.orte > 2000, 'nur ' + r.orte + ' erreichbare Stellen');
  const vorleser = H.run(`(${hub}._vorleser || []).map(function (s) { return { x: s.x, y: s.y }; })`);
  const K = require('../js/scenes/hub/hubNeuKarte.js');
  Object.keys(BUERGER).forEach((id) => {
    const key = BUERGER[id];
    const n = f.npc[id];
    assert.ok(n, id + ' fehlt in den Hub-NPC');
    assert.ok(n.sichtbar, id + ' steht im Epilog nicht da');
    assert.ok(n.koerper, id + ' hat keinen Koerper');
    assert.strictEqual(n.key, key, id + ' zeigt ' + n.key);
    // Eigenes Bild, kein Platzhalter (der waere 100x200): Mass wie die Datei.
    const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'sprites', key + '.png'));
    assert.deepStrictEqual(Array.from(r.tex[key] || []), [png.readUInt32BE(16), png.readUInt32BE(20)],
      key + ' ist nicht das Bild aus assets/sprites');
    const m = r.npc[id];
    assert.ok(K.fest.indexOf(m.zeichen) < 0 && m.zeichen !== '', id + ' steht auf festem Grund "' + m.zeichen + '"');
    assert.ok(!m.inWand, id + ' steht in einer Kollision');
    assert.ok(!m.inTuer, id + ' steht in einer Tuerzone');
    assert.ok(m.abstand < 64, id + ' ist nicht erreichbar (naechste Stelle ' + Math.round(m.abstand) + ' px)');
    assert.strictEqual(m.ziel, id, 'neben ' + id + ' antwortet ' + m.ziel);
    assert.ok(Array.isArray(m.seiten) && m.seiten.length >= 2, id + ' sagt nichts');
    assert.deepStrictEqual(Array.from(m.seiten), Array.from(r.zeilen[id]), id + ' sagt nicht seine Epilog-Zeilen');
    // Abstand zu allen anderen Figuren und Vorlesern: gut zwei Kacheln.
    Object.keys(f.npc).concat(vorleser.map((_, i) => 'vorleser' + i)).forEach((o) => {
      if (o === id) return;
      const q = f.npc[o] || vorleser[Number(o.slice(8))];
      if (f.npc[o] && !f.npc[o].sichtbar) return;
      const d = Math.hypot(q.x - n.x, q.y - n.y);
      assert.ok(d >= 80, id + ' steht nur ' + Math.round(d) + ' px neben ' + o);
    });
  });
});

test('Die Buerger sprechen auch Englisch', async () => {
  const r = H.run(`(function () {
    var I = window.i18n, alt = I.getLanguage(), out = {};
    I.setLanguage('en');
    try {
      var z = window.HubPhase.npcFlavorByPhase.epilogue;
      ${JSON.stringify(Object.keys(BUERGER))}.forEach(function (id) {
        var n = window.HUB_HITBOXES.npcs.filter(function (q) { return q.id === id; })[0];
        out[id] = { name: n.name, zeile: z[id][0] };
      });
    } finally { I.setLanguage(alt); }
    return out;
  })()`);
  const en = { epilog_baeckerin: 'Baker', epilog_zimmermann: 'Carpenter', epilog_alte: 'Old Woman with Lantern', epilog_maedchen: 'Girl' };
  Object.keys(en).forEach((id) => {
    assert.strictEqual(r[id].name, en[id]);
    assert.ok(/^[\x20-\x7e]+$/.test(r[id].zeile) && !/MISSING/.test(r[id].zeile), id + ': ' + r[id].zeile);
  });
});

test('Vor dem Epilog: Klerus, Stadtwache und Patrouillen da, keine Epilog-Buerger', async () => {
  await stand(1, { patrouillen_verdoppelt: true });
  const f = figuren();
  assert.strictEqual(f.phase, 'council');
  ['klerus_priester', 'stadtwache'].forEach((id) => {
    assert.strictEqual(f.npc[id].sichtbar, true, id + ' fehlt vor dem Epilog');
    assert.strictEqual(f.npc[id].koerper, true, id + ' ohne Koerper');
  });
  assert.strictEqual(f.patrouillen, 2, 'verdoppelte Patrouillen fehlen');
  Object.keys(BUERGER).forEach((id) => {
    assert.strictEqual(f.npc[id].sichtbar, false, id + ' steht schon vor dem Epilog da');
    assert.strictEqual(f.npc[id].koerper, false, id + ' versperrt vor dem Epilog unsichtbar den Weg');
  });
  const buerger = f.alle.filter((o) => Object.values(BUERGER).indexOf(o.key) >= 0);
  assert.deepStrictEqual(Array.from(buerger, (o) => o.key), [], 'Epilog-Buerger sichtbar');
});
