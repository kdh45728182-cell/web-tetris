/* ==========================================================================
   NEON TETRIS - WEB AUDIO API SYNTHESIZER
   ========================================================================== */

class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.isBgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.25, this.ctx ? this.ctx.currentTime : 0);
    }
    return this.muted;
  }

  // Play a simple tone with envelope
  playTone(freq, duration, type = 'sine', rampToFreq = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, now);

      if (rampToFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, rampToFreq), now + duration);
      }

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio play failed", e);
    }
  }

  // SFX: Move Piece
  playMove() {
    this.playTone(180, 0.05, 'triangle', 120);
  }

  // SFX: Rotate Piece
  playRotate() {
    this.playTone(320, 0.06, 'sine', 550);
  }

  // SFX: Soft Drop
  playSoftDrop() {
    this.playTone(120, 0.04, 'triangle', 70);
  }

  // SFX: Hard Drop
  playHardDrop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // SFX: Hold Piece
  playHold() {
    this.playTone(440, 0.08, 'sine', 780);
  }

  // SFX: Line Clear (1 to 4 lines)
  playLineClear(lines = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const chords = {
      1: [523.25], // C5
      2: [523.25, 659.25], // C5, E5
      3: [523.25, 659.25, 783.99], // C5, E5, G5
      4: [523.25, 659.25, 783.99, 987.77, 1046.50] // Tetris! C5, E5, G5, B5, C6
    };

    const notes = chords[lines] || chords[1];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = lines === 4 ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.4, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      } catch (e) {}
    });
  }

  // SFX: Level Up
  playLevelUp() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine'), i * 80);
    });
  }

  // SFX: Game Over
  playGameOver() {
    const notes = [400, 370, 330, 280, 220];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sawtooth'), i * 150);
    });
  }
}

export const audioSynth = new AudioSynthesizer();
