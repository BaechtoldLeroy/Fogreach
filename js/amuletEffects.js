// js/amuletEffects.js
// Feature 059 (#42) WP03: behaviour for the run amulet effects. Pure-ish,
// load-able IIFE (window.AmuletEffects) so the maths is unit-testable; the
// thin integration hooks in player.js / inventory.js / enemy.js call into it,
// all gated by the currently equipped amulet (window.runAmulet.effect).
// No-op whenever no amulet is equipped.
//
// Batch 1 implements the stat/damage effects: tempo, glass, lifesteal, momentum.
// (twin/chain/cleave/orbit/aura/killburst/frost/dashstrike/revive/bloodpact
//  follow in later batches.)
(function () {
  'use strict';

  // Run-scoped transient state. Reset on run start / amulet clear via
  // resetRunState(); momentum also self-decays, so stale stacks expire fast.
  var state = { momentumStacks: 0, momentumExpiry: 0, reviveUsed: false };

  // Tunables (central, for playtest balancing).
  var TUNE = {
    glassDamageMul: 1.5,   glassMaxHpMul: 0.75,   // Glasherz: +50% dmg, -25% maxHP
    tempoMoveAdd: 35,      tempoSpeedMul: 1.20,   // Sturmschritt: +Lauf-/Angriffstempo
    lifestealPct: 0.18,                           // Aderlass: 18% des Schadens als Heilung
    momentumPerStack: 0.06, momentumMaxStacks: 10, momentumDecayMs: 4000 // Schlächterkrone
  };

  function _now() {
    return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
  }

  function activeEffect() {
    return (typeof window !== 'undefined' && window.runAmulet && window.runAmulet.effect) || null;
  }

  // Passive stat mods for recalcDerived (tempo + glass). Caller applies them.
  function getStatMods() {
    var e = activeEffect();
    var mods = { moveAdd: 0, speedMul: 1, damageMul: 1, maxHpMul: 1 };
    if (e === 'glass') { mods.damageMul *= TUNE.glassDamageMul; mods.maxHpMul *= TUNE.glassMaxHpMul; }
    else if (e === 'tempo') { mods.moveAdd += TUNE.tempoMoveAdd; mods.speedMul *= TUNE.tempoSpeedMul; }
    return mods;
  }

  // Per-hit damage multiplier from the amulet (momentum kill-stacks; decays).
  function momentumMul(now) {
    if (activeEffect() !== 'momentum') return 1;
    now = (typeof now === 'number') ? now : _now();
    if (now > state.momentumExpiry) state.momentumStacks = 0;
    return 1 + state.momentumStacks * TUNE.momentumPerStack;
  }
  // Alias for the combat hook (only momentum scales per-hit; glass goes via stats).
  function damageMul(now) { return momentumMul(now); }

  // Lifesteal fraction from the amulet (0 unless the lifesteal amulet is equipped).
  function lifestealPct() { return activeEffect() === 'lifesteal' ? TUNE.lifestealPct : 0; }

  // On kill: bump momentum stacks (capped) and refresh the decay window.
  function onEnemyKilled(enemy, scene, now) {
    if (activeEffect() === 'momentum') {
      now = (typeof now === 'number') ? now : _now();
      state.momentumStacks = Math.min(TUNE.momentumMaxStacks, state.momentumStacks + 1);
      state.momentumExpiry = now + TUNE.momentumDecayMs;
    }
  }

  function momentumStacks() { return state.momentumStacks; }
  function resetRunState() { state.momentumStacks = 0; state.momentumExpiry = 0; state.reviveUsed = false; }

  window.AmuletEffects = {
    activeEffect: activeEffect,
    getStatMods: getStatMods,
    damageMul: damageMul,
    momentumMul: momentumMul,
    momentumStacks: momentumStacks,
    lifestealPct: lifestealPct,
    onEnemyKilled: onEnemyKilled,
    resetRunState: resetRunState,
    _TUNE: TUNE
  };
})();
