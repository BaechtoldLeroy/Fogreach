// soundManager.js — Procedural audio for Demonfall using Web Audio API
// No audio files needed; all sounds are generated with oscillators, noise, and filters.

class SoundManager {
  constructor(scene) {
    this.scene = scene;
    this.context = null;
    this.masterVolume = 0.5;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.3;
    this.muted = false;
    this._musicNodes = [];
    this._initialized = false;

    // Load settings from localStorage
    this._loadSettings();

    // Try to get audio context from Phaser or create one
    this._initContext(scene);
  }

  _initContext(scene) {
    try {
      if (scene && scene.sound && scene.sound.context) {
        this.context = scene.sound.context;
      } else if (typeof AudioContext !== 'undefined') {
        this.context = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        this.context = new webkitAudioContext();
      }
      if (this.context) {
        this._masterGain = this.context.createGain();
        this._masterGain.gain.value = this.muted ? 0 : this.masterVolume;
        this._masterGain.connect(this.context.destination);
        this._sfxGain = this.context.createGain();
        this._sfxGain.gain.value = this.sfxVolume;
        this._sfxGain.connect(this._masterGain);
        this._musicGain = this.context.createGain();
        this._musicGain.gain.value = this.musicVolume;
        this._musicGain.connect(this._masterGain);
        this._initialized = true;
      }
    } catch (e) {
      console.warn('[SoundManager] Could not initialize audio context:', e);
    }
  }

  _ensureContext() {
    if (!this._initialized) return false;
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    return this.context.state !== 'closed';
  }

  // ---- Settings persistence ----
  _loadSettings() {
    try {
      const saved = localStorage.getItem('demonfall_audio');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.master === 'number') this.masterVolume = s.master;
        if (typeof s.sfx === 'number') this.sfxVolume = s.sfx;
        if (typeof s.music === 'number') this.musicVolume = s.music;
        if (typeof s.muted === 'boolean') this.muted = s.muted;
      }
    } catch (e) { /* ignore */ }
  }

  _saveSettings() {
    try {
      localStorage.setItem('demonfall_audio', JSON.stringify({
        master: this.masterVolume,
        sfx: this.sfxVolume,
        music: this.musicVolume,
        muted: this.muted
      }));
    } catch (e) { /* ignore */ }
  }

  // ---- Volume controls ----
  setVolume(type, value) {
    value = Math.max(0, Math.min(1, value));
    switch (type) {
      case 'master':
        this.masterVolume = value;
        if (this._masterGain) this._masterGain.gain.value = this.muted ? 0 : value;
        break;
      case 'sfx':
        this.sfxVolume = value;
        if (this._sfxGain) this._sfxGain.gain.value = value;
        break;
      case 'music':
        this.musicVolume = value;
        if (this._musicGain) this._musicGain.gain.value = value;
        break;
    }
    this._saveSettings();
  }

  mute() {
    this.muted = true;
    if (this._masterGain) this._masterGain.gain.value = 0;
    this._saveSettings();
  }

  unmute() {
    this.muted = false;
    if (this._masterGain) this._masterGain.gain.value = this.masterVolume;
    this._saveSettings();
  }

  toggleMute() {
    if (this.muted) this.unmute(); else this.mute();
    return this.muted;
  }

  // ---- Utility: create noise buffer ----
  _noiseBuffer(duration) {
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ---- SFX Definitions ----
  playSFX(type) {
    if (!this._ensureContext()) return;
    const now = this.context.currentTime;
    try {
      switch (type) {
        case 'attack': this._sfxAttack(now); break;
        case 'hit_enemy': this._sfxHitEnemy(now); break;
        case 'hit_player': this._sfxHitPlayer(now); break;
        case 'enemy_death': this._sfxEnemyDeath(now); break;
        case 'player_death': this._sfxPlayerDeath(now); break;
        case 'ability_spin': this._sfxAbilitySpin(now); break;
        case 'ability_charge': this._sfxAbilityCharge(now); break;
        case 'ability_dash': this._sfxAbilityDash(now); break;
        case 'ability_dagger': this._sfxAbilityDagger(now); break;
        case 'ability_shield': this._sfxAbilityShield(now); break;
        case 'loot_pickup': this._sfxLootPickup(now); break;
        case 'loot_rare': this._sfxLootRare(now); break;
        case 'loot_legendary': this._sfxLootLegendary(now); break;
        case 'level_up': this._sfxLevelUp(now); break;
        case 'ui_click': this._sfxUIClick(now); break;
        case 'quest_complete': this._sfxQuestComplete(now); break;
        default:
          console.warn('[SoundManager] Unknown SFX type:', type);
      }
    } catch (e) {
      console.warn('[SoundManager] SFX error:', type, e);
    }
  }

  // Attack: short sharp sawtooth burst
  _sfxAttack(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Hit enemy: quick high-pitched blip
  _sfxHitEnemy(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Hit player: low thud with noise
  _sfxHitPlayer(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);

    // noise layer
    const noise = this.context.createBufferSource();
    noise.buffer = this._noiseBuffer(0.08);
    const nGain = this.context.createGain();
    nGain.gain.setValueAtTime(0.1, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(nGain);
    nGain.connect(this._sfxGain);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  // Enemy death: descending square wave
  _sfxEnemyDeath(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Player death: long low rumble with tremolo
  _sfxPlayerDeath(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8, t);
    lfoGain.gain.setValueAtTime(0.15, t);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.55);
    lfo.stop(t + 0.55);
  }

  // Spin: whoosh with filtered noise sweep
  _sfxAbilitySpin(t) {
    const noise = this.context.createBufferSource();
    noise.buffer = this._noiseBuffer(0.2);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.2);
    filter.Q.setValueAtTime(2, t);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._sfxGain);
    noise.start(t);
    noise.stop(t + 0.21);
  }

  // Charge slash: rising sawtooth tone
  _sfxAbilityCharge(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.31);
  }

  // Dash slash: quick noise whoosh with bandpass
  _sfxAbilityDash(t) {
    const noise = this.context.createBufferSource();
    noise.buffer = this._noiseBuffer(0.1);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.05);
    filter.Q.setValueAtTime(3, t);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._sfxGain);
    noise.start(t);
    noise.stop(t + 0.11);
  }

  // Dagger throw: short click + whoosh
  _sfxAbilityDagger(t) {
    // click
    const osc = this.context.createOscillator();
    const g1 = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    g1.gain.setValueAtTime(0.2, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(g1);
    g1.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.03);

    // whoosh
    const noise = this.context.createBufferSource();
    noise.buffer = this._noiseBuffer(0.06);
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, t + 0.02);
    const g2 = this.context.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(0.15, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(filter);
    filter.connect(g2);
    g2.connect(this._sfxGain);
    noise.start(t + 0.02);
    noise.stop(t + 0.09);
  }

  // Shield bash: metallic clang (dual frequency sine)
  _sfxAbilityShield(t) {
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, t);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this._sfxGain);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.11);
    osc2.stop(t + 0.11);
  }

  // Loot pickup: ascending chime
  _sfxLootPickup(t) {
    const freqs = [400, 800, 1200];
    freqs.forEach((f, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      const offset = i * 0.05;
      osc.frequency.setValueAtTime(f, t + offset);
      gain.gain.setValueAtTime(0.2, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);
      osc.connect(gain);
      gain.connect(this._sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.11);
    });
  }

  // Level up: triumphant ascending arpeggio (C-E-G-C)
  _sfxLevelUp(t) {
    const freqs = [262, 330, 392, 523];
    freqs.forEach((f, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      const offset = i * 0.1;
      osc.frequency.setValueAtTime(f, t + offset);
      gain.gain.setValueAtTime(0.25, t + offset);
      gain.gain.linearRampToValueAtTime(0.2, t + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
      osc.connect(gain);
      gain.connect(this._sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.16);
    });
  }

  // UI click: soft short click
  _sfxUIClick(t) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Quest complete: fanfare major chord arpeggio (C-E-G)
  // Rare drop: bright two-note bell jingle (D2-style chime)
  _sfxLootRare(t) {
    const notes = [
      { f: 988, dur: 0.35 },  // B5
      { f: 1318, dur: 0.45 }  // E6
    ];
    notes.forEach((n, i) => {
      const offset = i * 0.09;
      const fundamental = this.context.createOscillator();
      const overtone = this.context.createOscillator();
      const gain = this.context.createGain();
      fundamental.type = 'triangle';
      overtone.type = 'sine';
      fundamental.frequency.setValueAtTime(n.f, t + offset);
      overtone.frequency.setValueAtTime(n.f * 2, t + offset);
      gain.gain.setValueAtTime(0.0, t + offset);
      gain.gain.linearRampToValueAtTime(0.28, t + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + n.dur);
      fundamental.connect(gain);
      overtone.connect(gain);
      gain.connect(this._sfxGain);
      fundamental.start(t + offset);
      overtone.start(t + offset);
      fundamental.stop(t + offset + n.dur + 0.02);
      overtone.stop(t + offset + n.dur + 0.02);
    });
  }

  // Legendary drop: grand ascending arpeggio with shimmer (D2 unique-style)
  _sfxLootLegendary(t) {
    const notes = [
      { f: 523, dur: 0.35 },   // C5
      { f: 784, dur: 0.35 },   // G5
      { f: 1047, dur: 0.45 },  // C6
      { f: 1568, dur: 0.80 }   // G6 sustained
    ];
    notes.forEach((n, i) => {
      const offset = i * 0.11;
      const fundamental = this.context.createOscillator();
      const overtone = this.context.createOscillator();
      const detune = this.context.createOscillator();
      const gain = this.context.createGain();
      fundamental.type = 'triangle';
      overtone.type = 'sine';
      detune.type = 'sine';
      fundamental.frequency.setValueAtTime(n.f, t + offset);
      overtone.frequency.setValueAtTime(n.f * 2, t + offset);
      detune.frequency.setValueAtTime(n.f * 3, t + offset);
      gain.gain.setValueAtTime(0.0, t + offset);
      gain.gain.linearRampToValueAtTime(0.30, t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + n.dur);
      fundamental.connect(gain);
      overtone.connect(gain);
      detune.connect(gain);
      gain.connect(this._sfxGain);
      fundamental.start(t + offset);
      overtone.start(t + offset);
      detune.start(t + offset);
      fundamental.stop(t + offset + n.dur + 0.02);
      overtone.stop(t + offset + n.dur + 0.02);
      detune.stop(t + offset + n.dur + 0.02);
    });

    // Shimmer tail — tremolo sine on final note
    const shimmer = this.context.createOscillator();
    const shimmerGain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2093, t + 0.44); // C7
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14, t + 0.44);
    lfoGain.gain.setValueAtTime(0.08, t + 0.44);
    lfo.connect(lfoGain);
    lfoGain.connect(shimmerGain.gain);
    shimmerGain.gain.setValueAtTime(0.0, t + 0.44);
    shimmerGain.gain.linearRampToValueAtTime(0.12, t + 0.46);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this._sfxGain);
    shimmer.start(t + 0.44);
    lfo.start(t + 0.44);
    shimmer.stop(t + 1.22);
    lfo.stop(t + 1.22);
  }

  _sfxQuestComplete(t) {
    const freqs = [523, 659, 784];
    freqs.forEach((f, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      const offset = i * 0.08;
      osc.frequency.setValueAtTime(f, t + offset);
      gain.gain.setValueAtTime(0.2, t + offset);
      gain.gain.linearRampToValueAtTime(0.15, t + offset + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.2);
      osc.connect(gain);
      gain.connect(this._sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.25);
    });
  }

  // ---- Music ----
  playMusic(track) {
    if (!this._ensureContext()) return;
    this.stopMusic();
    try {
      switch (track) {
        case 'hub_ambient': this._musicHub(); break;
        case 'dungeon_ambient': this._musicDungeon(); break;
        case 'boss_music': this._musicBoss(); break;
        default:
          console.warn('[SoundManager] Unknown music track:', track);
      }
    } catch (e) {
      console.warn('[SoundManager] Music error:', track, e);
    }
  }

  stopMusic() {
    this._musicNodes.forEach(node => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (e) { /* already stopped */ }
    });
    this._musicNodes = [];
    if (this._musicTimers) {
      this._musicTimers.forEach(id => { try { clearInterval(id); } catch (e) {} });
      this._musicTimers = [];
    }
  }

  // Helper: schedule a sparse arpeggio pattern over a pad.
  // `notes` is an array of Hz values; plays one every `intervalMs`.
  _scheduleArpeggio(notes, intervalMs, gainVal, oscType, destGain, filterFreq) {
    if (!this._musicTimers) this._musicTimers = [];
    let i = 0;
    const playOne = () => {
      if (!this._initialized) return;
      const t = this.context.currentTime;
      const f = notes[i % notes.length];
      i++;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      osc.type = oscType || 'sine';
      osc.frequency.setValueAtTime(f, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 1200, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(gainVal, t + 1.0);         // slow attack
      gain.gain.exponentialRampToValueAtTime(0.0001, t + intervalMs / 1000 * 0.9);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destGain);
      osc.start(t);
      osc.stop(t + intervalMs / 1000 + 0.2);
    };
    playOne();
    const id = setInterval(playOne, intervalMs);
    this._musicTimers.push(id);
  }

  // Hub ambient: soft low drone + gentle pad
  _musicHub() {
    const now = this.context.currentTime;

    // Soft breathing pad in D minor — three detuned voices through a lowpass,
    // amplitude LFO so it swells/recedes instead of droning flatly.
    const padFreqs = [146.83, 220.00, 293.66]; // D3, A3, D4
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(0.7, now);
    const padGain = this.context.createGain();
    padGain.gain.setValueAtTime(0.0, now);
    padGain.gain.linearRampToValueAtTime(0.05, now + 3.0); // slow fade-in
    filter.connect(padGain);
    padGain.connect(this._musicGain);

    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, now); // ~12s breath cycle
    const lfoGain = this.context.createGain();
    lfoGain.gain.setValueAtTime(0.025, now);
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start(now);
    this._musicNodes.push(lfo, lfoGain, filter, padGain);

    padFreqs.forEach((f, i) => {
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime((i - 1) * 6, now); // slight chorus
      osc.connect(filter);
      osc.start(now);
      this._musicNodes.push(osc);
    });

    // Sparse warm arpeggio on top (notes from D-minor pentatonic, 4-octave)
    const arp = [587.33, 880.00, 1046.50, 698.46]; // D5, A5, C6, F5
    this._scheduleArpeggio(arp, 4200, 0.028, 'triangle', this._musicGain, 1500);
  }

  // Dungeon ambient: darker drone + dissonant tension
  _musicDungeon() {
    const now = this.context.currentTime;

    // Dark breathing pad — open filter so it doesn't sound muffled; no detune
    // (the detune + lowpass was creating a "dumpf" beating drone).
    const padFreqs = [73.42, 110.00, 233.08]; // D2, A2, Bb3
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(0.5, now);
    const padGain = this.context.createGain();
    padGain.gain.setValueAtTime(0.0, now);
    padGain.gain.linearRampToValueAtTime(0.06, now + 4.0);
    filter.connect(padGain);
    padGain.connect(this._musicGain);

    // Slow swell LFO (~16s cycle) for tension breathing.
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.06, now);
    const lfoGain = this.context.createGain();
    lfoGain.gain.setValueAtTime(0.03, now);
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start(now);
    this._musicNodes.push(lfo, lfoGain, filter, padGain);

    padFreqs.forEach((f) => {
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.connect(filter);
      osc.start(now);
      this._musicNodes.push(osc);
    });

    // Rare, sparse high dissonance (every ~7s) in minor second/tritone for unease
    const stingers = [932.33, 1244.51, 698.46]; // Bb5, Eb6, F5
    this._scheduleArpeggio(stingers, 7200, 0.018, 'sine', this._musicGain, 2200);
  }

  // Boss music: pulsing bass + higher tension
  _musicBoss() {
    const now = this.context.currentTime;

    // Pulsing bass
    const bass = this.context.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(60, now);
    const bassFilter = this.context.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(200, now);
    const bassGain = this.context.createGain();
    bassGain.gain.setValueAtTime(0.12, now);
    // Rhythmic pulse via LFO
    const pulseLfo = this.context.createOscillator();
    pulseLfo.type = 'square';
    pulseLfo.frequency.setValueAtTime(3, now); // 3Hz pulse = ~180BPM feel
    const pulseGain = this.context.createGain();
    pulseGain.gain.setValueAtTime(0.08, now);
    pulseLfo.connect(pulseGain);
    pulseGain.connect(bassGain.gain);
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this._musicGain);
    bass.start(now);
    pulseLfo.start(now);
    this._musicNodes.push(bass, bassFilter, bassGain, pulseLfo, pulseGain);

    // Tension layer
    const tension = this.context.createOscillator();
    tension.type = 'sawtooth';
    tension.frequency.setValueAtTime(220, now);
    const tensionFilter = this.context.createBiquadFilter();
    tensionFilter.type = 'lowpass';
    tensionFilter.frequency.setValueAtTime(600, now);
    const tensionGain = this.context.createGain();
    tensionGain.gain.setValueAtTime(0.04, now);
    tension.connect(tensionFilter);
    tensionFilter.connect(tensionGain);
    tensionGain.connect(this._musicGain);
    tension.start(now);
    this._musicNodes.push(tension, tensionFilter, tensionGain);

    // High stab
    const stab = this.context.createOscillator();
    stab.type = 'square';
    stab.frequency.setValueAtTime(440, now);
    const stabGain = this.context.createGain();
    stabGain.gain.setValueAtTime(0.02, now);
    const stabLfo = this.context.createOscillator();
    stabLfo.type = 'sine';
    stabLfo.frequency.setValueAtTime(6, now);
    const stabLfoGain = this.context.createGain();
    stabLfoGain.gain.setValueAtTime(0.015, now);
    stabLfo.connect(stabLfoGain);
    stabLfoGain.connect(stabGain.gain);
    stab.connect(stabGain);
    stabGain.connect(this._musicGain);
    stab.start(now);
    stabLfo.start(now);
    this._musicNodes.push(stab, stabGain, stabLfo, stabLfoGain);
  }

  // ---- Cleanup ----
  destroy() {
    this.stopMusic();
    this._initialized = false;
  }
}

// Expose globally
window.SoundManager = SoundManager;
