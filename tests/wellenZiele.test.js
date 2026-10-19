// tests/wellenZiele.test.js — jedes Wellenziel ist auf der Tiefe erreichbar,
// ab der sein Auftrag zaehlt.
//
// Gemeldet: "Aushang: Standhalten" verlangte Welle 12 ab Tiefe 6 — "macht
// keinen Sinn, Welle 12 kommt nie auf Tiefe 6". Stimmt: die Welle IST die
// Lauftiefe. enterRoom setzt currentWave = Tiefe - 1, startNextWave zaehlt
// einmal hoch; jeder Raum meldet questSystem.onWaveCompleted(Tiefe). Gemessen
// ueber ganze Laeufe: Tiefe 6/10/15 melden in jedem Raum 6/10/15. Nur nach
// einem Voll-Boss (Tiefe 10, 20, ...) folgt noch eine Welle Tiefe + 1.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
loadGameModule('js/questSystem.js');
const D = globalThis.window.questSystem.QUEST_DEFINITIONS;

// Alle Auftraege mit einem Wellenziel.
const WELLEN = Object.keys(D).filter((id) => (D[id].objectives || []).some((o) => o.type === 'wave'));
const ziel = (id) => D[id].objectives.filter((o) => o.type === 'wave')[0].required;

test('es gibt Wellenziele (sonst prueft der Test nichts)', () => {
  // Standhalten zaehlt seit b477 Raeume statt einer Welle (tests/standhalten.test.js).
  assert.ok(WELLEN.includes('mara_assault'), WELLEN.join(','));
});

test('kein Wellenziel liegt ueber der Tiefe, ab der sein Auftrag zaehlt', () => {
  WELLEN.forEach((id) => {
    if (typeof D[id].minDepth !== 'number') return;   // ohne Mindesttiefe: die Welle selbst ist die Tiefe
    assert.ok(ziel(id) <= D[id].minDepth,
      id + ': Welle ' + ziel(id) + ' verlangt, zaehlt aber ab Tiefe ' + D[id].minDepth
      + ' — dort meldet jeder Raum nur Welle ' + D[id].minDepth);
  });
});

describe('im Spiel: ein geraeumter Raum auf der Mindesttiefe erfuellt das Wellenziel', () => {
  let H = null;
  const SC = `window.game.scene.getScene('GameScene')`;
  before(async () => { H = await launchDungeon({ depth: 3 }); H.run('window._playerInvincible = true'); });
  after(async () => { if (H) await H.shutdown(); });

  /** Raum auf Tiefe t betreten, leeren und die gemeldete Welle zurueckgeben. */
  function raumRaeumen(t) {
    H.run(`window.__wellen = []; window.DUNGEON_DEPTH = ${t}; enterRoom(${SC}, 1);`);
    for (let k = 0; k < 300; k++) {
      H.run(`(function () {
        var n = computeWaveEnemyTotal(currentWave, window.__WALKABLE_AREA_PX__ || 0);
        if (spawnedEnemiesInWave < n) spawnedEnemiesInWave = n;
        enemies.getChildren().slice().forEach(function (e) { if (e && e.active) { try { e.destroy(); } catch (x) {} } });
      })()`);
      H.step(2);
      const w = H.run('window.__wellen.slice()');
      if (w.length) return w[0];
    }
    return null;
  }

  test('jedes Wellenziel mit Mindesttiefe', () => {
    H.run(`window.__wellen = [];
      var alt = window.questSystem.onWaveCompleted;
      window.questSystem.onWaveCompleted = function (w) { window.__wellen.push(w); return alt.apply(this, arguments); };`);
    WELLEN.filter((id) => typeof D[id].minDepth === 'number').forEach((id) => {
      const t = D[id].minDepth;
      const r = H.run(`(function () {
        var QS = window.questSystem;
        var st = QS.getQuestSaveData();
        st.quests['${id}'] = { status: 'available', objectives: null };
        QS.loadQuestSaveData(st);
        return QS.acceptQuest('${id}');
      })()`);
      assert.strictEqual(r, true, id + ' liess sich nicht annehmen');
      const welle = raumRaeumen(t);
      assert.strictEqual(welle, t, id + ': Raum auf Tiefe ' + t + ' meldete Welle ' + welle);
      const fertig = H.run(`window.questSystem.isQuestReadyToComplete('${id}')`);
      assert.strictEqual(fertig, true, id + ': nach einem geraeumten Raum auf Tiefe ' + t + ' nicht erfuellt');
    });
  });
});
