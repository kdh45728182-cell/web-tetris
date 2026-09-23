/* ==========================================================================
   NEON TETRIS - BUNDLED GAME ENGINE (COMPATIBLE WITH file:// PROTOCOL & HTTP)
   ========================================================================== */

(function() {
  'use strict';

  // ==========================================================================
  // 1. LOCAL STORAGE MANAGER
  // ==========================================================================
  const STORAGE_KEY = 'NEON_TETRIS_DATA_V1';

  const defaultData = {
    highScore: { marathon: 0, sprint: 0, zen: 0 },
    stats: { gamesPlayed: 0, linesCleared: 0, tetrisClears: 0, bestSprintTimeMs: null },
    settings: { soundMuted: false }
  };

  class StorageManager {
    constructor() {
      this.data = this.loadData();
    }
    loadData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return JSON.parse(JSON.stringify(defaultData));
        const parsed = JSON.parse(raw);
        return {
          ...defaultData,
          ...parsed,
          highScore: { ...defaultData.highScore, ...(parsed.highScore || {}) },
          stats: { ...defaultData.stats, ...(parsed.stats || {}) },
          settings: { ...defaultData.settings, ...(parsed.settings || {}) }
        };
      } catch (e) {
        return JSON.parse(JSON.stringify(defaultData));
      }
    }
    saveData() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {}
    }
    getHighScore(mode = 'marathon') {
      return this.data.highScore[mode] || 0;
    }
    updateHighScore(score, mode = 'marathon') {
      const current = this.getHighScore(mode);
      if (score > current) {
        this.data.highScore[mode] = score;
        this.saveData();
        return true;
      }
      return false;
    }
    recordGameFinished({ score, lines, tetrises, timeMs, mode }) {
      this.data.stats.gamesPlayed += 1;
      this.data.stats.linesCleared += lines;
      this.data.stats.tetrisClears += tetrises;

      const isNewHigh = this.updateHighScore(score, mode);
      let isNewBestTime = false;
      if (mode === 'sprint' && lines >= 40) {
        if (!this.data.stats.bestSprintTimeMs || timeMs < this.data.stats.bestSprintTimeMs) {
          this.data.stats.bestSprintTimeMs = timeMs;
          isNewBestTime = true;
        }
      }
      this.saveData();
      return { isNewHigh, isNewBestTime };
    }
    getStats() { return this.data.stats; }
    getSettings() { return this.data.settings; }
    saveSettings(newSettings) {
      this.data.settings = { ...this.data.settings, ...newSettings };
      this.saveData();
    }
  }

  const storage = new StorageManager();

  // ==========================================================================
  // 2. WEB AUDIO API SYNTHESIZER
  // ==========================================================================
  class AudioSynthesizer {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.muted = false;
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
      } catch (e) {}
    }
    playMove() { this.playTone(180, 0.05, 'triangle', 120); }
    playRotate() { this.playTone(320, 0.06, 'sine', 550); }
    playSoftDrop() { this.playTone(120, 0.04, 'triangle', 70); }
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
    playHold() { this.playTone(440, 0.08, 'sine', 780); }
    playLineClear(lines = 1) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const chords = {
        1: [523.25],
        2: [523.25, 659.25],
        3: [523.25, 659.25, 783.99],
        4: [523.25, 659.25, 783.99, 987.77, 1046.50]
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
    playGameOver() {
      const notes = [400, 370, 330, 280, 220];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.2, 'sawtooth'), i * 150);
      });
    }
  }

  const audioSynth = new AudioSynthesizer();

  // ==========================================================================
  // 3. PARTICLE EFFECTS & VISUAL FX
  // ==========================================================================
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 1;
      this.size = Math.random() * 4 + 2;
      this.life = 1.0;
      this.decay = Math.random() * 0.03 + 0.015;
      this.gravity = 0.12;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.life -= this.decay;
      this.size = Math.max(0, this.size - 0.05);
    }
    draw(ctx) {
      if (this.life <= 0 || this.size <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class ParticleSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
    }
    clear() {
      this.particles = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    spawnRowClear(rowY, colColors, blockSize = 30) {
      const yCenter = rowY * blockSize + blockSize / 2;
      colColors.forEach((color, colIdx) => {
        const xCenter = colIdx * blockSize + blockSize / 2;
        const count = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          this.particles.push(new Particle(xCenter, yCenter, color || '#00f3ff'));
        }
      });
    }
    spawnDropEffect(x, y, width, color) {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const pX = x + Math.random() * width;
        const p = new Particle(pX, y, color);
        p.vy = -Math.random() * 2 - 0.5;
        p.vx = (Math.random() - 0.5) * 3;
        this.particles.push(p);
      }
    }
    updateAndDraw() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update();
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        } else {
          p.draw(this.ctx);
        }
      }
    }
  }

  function triggerScreenShake(elementId = 'shake-target') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => { el.classList.remove('shake'); }, 250);
  }

  // ==========================================================================
  // 4. CORE TETRIS ENGINE (SRS, 7-BAG, SCORING, LOCK DELAY)
  // ==========================================================================
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;

  const PIECES = {
    I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00f3ff' },
    J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#2b65ff' },
    L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#ff8800' },
    O: { shape: [[1,1],[1,1]], color: '#ffe600' },
    S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00ff66' },
    T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#b026ff' },
    Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ff0055' }
  };

  const KICK_DATA_JLSTZ = {
    '0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2], [1, 0], [0, -1]],
    '1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2], [-1, 0], [0, -1]],
    '1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2], [-1, 0], [0, -1]],
    '2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2], [1, 0], [0, -1]],
    '2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2], [-1, 0], [0, -1]],
    '3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2], [1, 0], [0, -1]],
    '3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2], [1, 0], [0, -1]],
    '0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2], [-1, 0], [0, -1]]
  };

  const KICK_DATA_I = {
    '0-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2], [0, -1]],
    '1-0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2], [0, -1]],
    '1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1], [0, -1]],
    '2-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1], [0, -1]],
    '2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2], [0, -1]],
    '3-2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2], [0, -1]],
    '3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1], [0, -1]],
    '0-3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1], [0, -1]]
  };

  class TetrisGame {
    constructor(mode = 'marathon') {
      this.mode = mode;
      this.reset();
    }
    reset() {
      this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      this.score = 0;
      this.level = 1;
      this.lines = 0;
      this.combo = -1;
      this.backToBack = false;
      this.tetrisCount = 0;
      this.bag = [];
      this.nextQueue = [];
      this.holdPiece = null;
      this.canHold = true;
      this.currentPiece = null;
      this.currentX = 0;
      this.currentY = 0;
      this.currentRotation = 0;
      this.lockDelay = 500;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.maxLockResets = 15;
      this.isGameOver = false;
      this.isPaused = false;
      this.startTime = null;
      this.elapsedTimeMs = 0;

      this.refillBagIfNeeded();
      for (let i = 0; i < 4; i++) {
        this.nextQueue.push(this.drawFromBag());
      }
      this.spawnNextPiece();
    }
    drawFromBag() {
      if (this.bag.length === 0) {
        this.bag = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }
    refillBagIfNeeded() {
      while (this.nextQueue.length < 4) {
        this.nextQueue.push(this.drawFromBag());
      }
    }
    spawnNextPiece() {
      this.refillBagIfNeeded();
      const type = this.nextQueue.shift();
      this.refillBagIfNeeded();
      const pDef = PIECES[type];
      this.currentPiece = {
        type,
        shape: pDef.shape.map(row => [...row]),
        color: pDef.color
      };
      this.currentRotation = 0;
      this.currentX = Math.floor((COLS - this.currentPiece.shape[0].length) / 2);
      this.currentY = 0;
      this.canHold = true;
      this.lockTimer = 0;
      this.lockResets = 0;

      if (this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY)) {
        this.isGameOver = true;
      }
    }
    rotateMatrix(matrix) {
      const N = matrix.length;
      const result = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          result[c][N - 1 - r] = matrix[r][c];
        }
      }
      return result;
    }
    rotateMatrixCCW(matrix) {
      const N = matrix.length;
      const result = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          result[N - 1 - c][r] = matrix[r][c];
        }
      }
      return result;
    }
    checkCollision(shape, offsetX, offsetY) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const newX = offsetX + c;
            const newY = offsetY + r;
            if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
            if (newY >= 0 && this.grid[newY][newX] !== null) return true;
          }
        }
      }
      return false;
    }
    isGrounded() {
      if (!this.currentPiece) return false;
      return this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY + 1);
    }
    onPieceAction() {
      if (this.isGrounded()) {
        if (this.lockResets < this.maxLockResets) {
          this.lockTimer = 0;
          this.lockResets++;
        }
      }
    }
    move(dir) {
      if (this.isGameOver || this.isPaused) return false;
      const newX = this.currentX + dir;
      if (!this.checkCollision(this.currentPiece.shape, newX, this.currentY)) {
        this.currentX = newX;
        this.onPieceAction();
        return true;
      }
      return false;
    }
    rotate(dir = 1) {
      if (this.isGameOver || this.isPaused) return false;
      const oldShape = this.currentPiece.shape;
      const newShape = dir === 1 ? this.rotateMatrix(oldShape) : this.rotateMatrixCCW(oldShape);
      const oldRot = this.currentRotation;
      const newRot = (oldRot + dir + 4) % 4;
      const kickKey = `${oldRot}-${newRot}`;
      const kicks = this.currentPiece.type === 'I' ? KICK_DATA_I[kickKey] : KICK_DATA_JLSTZ[kickKey];
      if (kicks) {
        for (let [dx, dy] of kicks) {
          const testX = this.currentX + dx;
          const testY = this.currentY - dy;
          if (!this.checkCollision(newShape, testX, testY)) {
            this.currentPiece.shape = newShape;
            this.currentX = testX;
            this.currentY = testY;
            this.currentRotation = newRot;
            this.onPieceAction();
            return true;
          }
        }
      }
      return false;
    }
    getGhostY() {
      let ghostY = this.currentY;
      while (!this.checkCollision(this.currentPiece.shape, this.currentX, ghostY + 1)) {
        ghostY++;
      }
      return ghostY;
    }
    gravityStep() {
      if (this.isGameOver || this.isPaused) return { moved: false, locked: false };
      if (!this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY + 1)) {
        this.currentY++;
        this.lockTimer = 0;
        return { moved: true, locked: false };
      }
      return { moved: false, locked: false };
    }
    softDrop() {
      if (this.isGameOver || this.isPaused) return { moved: false, locked: false };
      if (!this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY + 1)) {
        this.currentY++;
        this.score += 1;
        this.lockTimer = 0;
        return { moved: true, locked: false };
      }
      return { moved: false, locked: false };
    }
    hardDrop() {
      if (this.isGameOver || this.isPaused) return { distance: 0, clearedInfo: null };
      const startY = this.currentY;
      const ghostY = this.getGhostY();
      const dropDistance = ghostY - startY;
      this.currentY = ghostY;
      this.score += dropDistance * 2;
      const clearedInfo = this.lockPiece();
      return { distance: dropDistance, clearedInfo };
    }
    hold() {
      if (this.isGameOver || this.isPaused || !this.canHold) return false;
      const currentType = this.currentPiece.type;
      if (!this.holdPiece) {
        this.holdPiece = currentType;
        this.spawnNextPiece();
      } else {
        const temp = this.holdPiece;
        this.holdPiece = currentType;
        const pDef = PIECES[temp];
        this.currentPiece = {
          type: temp,
          shape: pDef.shape.map(row => [...row]),
          color: pDef.color
        };
        this.currentRotation = 0;
        this.currentX = Math.floor((COLS - this.currentPiece.shape[0].length) / 2);
        this.currentY = 0;
      }
      this.canHold = false;
      this.lockTimer = 0;
      this.lockResets = 0;
      return true;
    }
    lockPiece() {
      const shape = this.currentPiece.shape;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            const gridY = this.currentY + r;
            const gridX = this.currentX + c;
            if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
              this.grid[gridY][gridX] = this.currentPiece.color;
            }
          }
        }
      }
      const clearedRowsInfo = this.clearLines();
      this.spawnNextPiece();
      return clearedRowsInfo;
    }
    clearLines() {
      let cleared = 0;
      const clearedIndices = [];
      const clearedColors = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r].every(cell => cell !== null)) {
          clearedIndices.push(r);
          clearedColors.push([...this.grid[r]]);
          this.grid.splice(r, 1);
          this.grid.unshift(Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared > 0) {
        this.lines += cleared;
        this.combo++;
        const baseScores = [0, 100, 300, 500, 800];
        let scoreAdd = baseScores[cleared] * this.level;
        if (cleared === 4) {
          this.tetrisCount++;
          if (this.backToBack) {
            scoreAdd = Math.floor(scoreAdd * 1.5);
          }
          this.backToBack = true;
        } else {
          this.backToBack = false;
        }
        if (this.combo > 0) {
          scoreAdd += 50 * this.combo * this.level;
        }
        this.score += scoreAdd;
        this.level = Math.floor(this.lines / 10) + 1;
        if (this.mode === 'sprint' && this.lines >= 40) {
          this.isGameOver = true;
        }
      } else {
        this.combo = -1;
      }
      return { clearedCount: cleared, clearedIndices, clearedColors };
    }
    getDropInterval() {
      if (this.mode === 'zen') return 600;
      return Math.max(50, 800 - (this.level - 1) * 65);
    }
  }

  // ==========================================================================
  // 5. MAIN UI CONTROLLER & EVENT LISTENERS
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    const bgCanvas = document.getElementById('bg-canvas');
    const boardCanvas = document.getElementById('board-canvas');
    const fxCanvas = document.getElementById('fx-canvas');
    const holdCanvas = document.getElementById('hold-canvas');
    const nextCanvas = document.getElementById('next-canvas');

    if (!boardCanvas) return;

    const bgCtx = bgCanvas.getContext('2d');
    const boardCtx = boardCanvas.getContext('2d');
    const holdCtx = holdCanvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');

    const scoreDisplay = document.getElementById('score-display');
    const highscoreDisplay = document.getElementById('highscore-display');
    const levelDisplay = document.getElementById('level-display');
    const linesDisplay = document.getElementById('lines-display');
    const timerDisplay = document.getElementById('timer-display');
    const modeSelect = document.getElementById('mode-select');
    const comboToast = document.getElementById('combo-toast');

    const startOverlay = document.getElementById('start-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameoverOverlay = document.getElementById('gameover-overlay');
    const newRecordBadge = document.getElementById('new-record-badge');
    const statsModal = document.getElementById('stats-modal');
    const controlsModal = document.getElementById('controls-modal');

    const btnStart = document.getElementById('btn-start');
    const btnResume = document.getElementById('btn-resume');
    const btnRestartPause = document.getElementById('btn-restart-pause');
    const btnRestart = document.getElementById('btn-restart');
    const btnSound = document.getElementById('btn-sound');
    const btnStats = document.getElementById('btn-stats');
    const btnControls = document.getElementById('btn-controls');

    let game = new TetrisGame('marathon');
    let particles = new ParticleSystem(fxCanvas);

    let lastTime = 0;
    let dropCounter = 0;

    const DAS_DELAY = 140;
    const ARR_RATE = 35;
    const SOFT_DROP_RATE = 35;

    const activeKeys = new Set();
    let activeHorizontalDir = 0;
    let dasTimer = 0;
    let arrTimer = 0;
    let softDropTimer = 0;

    function handleKeyDown(code) {
      if (game.isGameOver || game.isPaused || !game.startTime) return;

      if (code === 'ArrowLeft' || code === 'KeyA') {
        if (activeHorizontalDir !== -1) {
          activeHorizontalDir = -1;
          dasTimer = 0;
          arrTimer = 0;
          handleMove(-1);
        }
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        if (activeHorizontalDir !== 1) {
          activeHorizontalDir = 1;
          dasTimer = 0;
          arrTimer = 0;
          handleMove(1);
        }
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        if (!activeKeys.has('ArrowDown') && !activeKeys.has('KeyS')) {
          softDropTimer = 0;
          handleSoftDrop();
        }
      } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') {
        handleRotate(1);
      } else if (code === 'KeyZ') {
        handleRotate(-1);
      } else if (code === 'Space') {
        handleHardDrop();
      } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') {
        handleHold();
      }
    }

    function handleKeyUp(code) {
      if ((code === 'ArrowLeft' || code === 'KeyA') && activeHorizontalDir === -1) {
        if (activeKeys.has('ArrowRight') || activeKeys.has('KeyD')) {
          activeHorizontalDir = 1;
          dasTimer = 0;
          arrTimer = 0;
          handleMove(1);
        } else {
          activeHorizontalDir = 0;
        }
      } else if ((code === 'ArrowRight' || code === 'KeyD') && activeHorizontalDir === 1) {
        if (activeKeys.has('ArrowLeft') || activeKeys.has('KeyA')) {
          activeHorizontalDir = -1;
          dasTimer = 0;
          arrTimer = 0;
          handleMove(-1);
        } else {
          activeHorizontalDir = 0;
        }
      }
    }

    function processContinuousInput(deltaTime) {
      if (game.isGameOver || game.isPaused || !game.startTime) return;

      if (activeHorizontalDir !== 0) {
        dasTimer += deltaTime;
        if (dasTimer >= DAS_DELAY) {
          arrTimer += deltaTime;
          while (arrTimer >= ARR_RATE) {
            handleMove(activeHorizontalDir);
            arrTimer -= ARR_RATE;
          }
        }
      }

      if (activeKeys.has('ArrowDown') || activeKeys.has('KeyS')) {
        softDropTimer += deltaTime;
        while (softDropTimer >= SOFT_DROP_RATE) {
          handleSoftDrop();
          softDropTimer -= SOFT_DROP_RATE;
        }
      }
    }

    function drawBackgroundGrid() {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.strokeStyle = 'rgba(0, 243, 255, 0.06)';
      bgCtx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        bgCtx.beginPath();
        bgCtx.moveTo(c * BLOCK_SIZE, 0);
        bgCtx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        bgCtx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        bgCtx.beginPath();
        bgCtx.moveTo(0, r * BLOCK_SIZE);
        bgCtx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
        bgCtx.stroke();
      }
    }

    function drawBlock(ctx, x, y, color, isGhost = false, size = BLOCK_SIZE, isLanding = false) {
      const px = x * size;
      const py = y * size;

      if (isGhost) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.45;
        ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
        ctx.restore();
        return;
      }

      ctx.save();
      const grad = ctx.createLinearGradient(px, py, px + size, py + size);
      grad.addColorStop(0, color);
      grad.addColorStop(1, adjustColorBrightness(color, -40));

      ctx.fillStyle = grad;
      ctx.shadowColor = isLanding ? '#ffffff' : color;
      ctx.shadowBlur = isLanding ? 16 : 8;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

      if (isLanding) {
        const pulseAlpha = (Math.sin(performance.now() / 60) + 1) / 2 * 0.7 + 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
        ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(px + 1, py + 1);
        ctx.lineTo(px + size - 1, py + 1);
        ctx.lineTo(px + size - 4, py + 4);
        ctx.lineTo(px + 4, py + 4);
        ctx.lineTo(px + 4, py + size - 4);
        ctx.lineTo(px + 1, py + size - 1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
      }
      ctx.restore();
    }

    function adjustColorBrightness(hex, percent) {
      let num = parseInt(hex.replace('#', ''), 16);
      let r = Math.max(0, Math.min(255, (num >> 16) + percent));
      let g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
      let b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
      return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    function renderBoard() {
      boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (game.grid[r][c]) {
            drawBlock(boardCtx, c, r, game.grid[r][c]);
          }
        }
      }

      if (game.currentPiece && !game.isGameOver) {
        const ghostY = game.getGhostY();
        const shape = game.currentPiece.shape;
        const isGrounded = game.isGrounded();

        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              drawBlock(boardCtx, game.currentX + c, ghostY + r, game.currentPiece.color, true);
            }
          }
        }

        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
              drawBlock(boardCtx, game.currentX + c, game.currentY + r, game.currentPiece.color, false, BLOCK_SIZE, isGrounded);
            }
          }
        }
      }
    }

    function renderPreviews() {
      holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
      if (game.holdPiece) {
        const pDef = PIECES[game.holdPiece];
        const shape = pDef.shape;
        const boxSize = 22;
        const offsetX = (holdCanvas.width - shape[0].length * boxSize) / 2 / boxSize;
        const offsetY = (holdCanvas.height - shape.length * boxSize) / 2 / boxSize;
        shape.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (cell) {
              drawBlock(holdCtx, offsetX + c, offsetY + r, pDef.color, !game.canHold, boxSize);
            }
          });
        });
      }

      nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      const queueToDraw = game.nextQueue.slice(0, 3);
      const boxSize = 22;

      queueToDraw.forEach((pieceType, idx) => {
        const pDef = PIECES[pieceType];
        const shape = pDef.shape;
        const offsetX = (nextCanvas.width - shape[0].length * boxSize) / 2 / boxSize;
        const offsetY = (idx * 90 + 20) / boxSize;

        shape.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (cell) {
              drawBlock(nextCtx, offsetX + c, offsetY + r, pDef.color, false, boxSize);
            }
          });
        });
      });
    }

    function updateUI() {
      scoreDisplay.textContent = game.score.toLocaleString();
      highscoreDisplay.textContent = storage.getHighScore(game.mode).toLocaleString();
      levelDisplay.textContent = game.level;
      linesDisplay.textContent = game.lines;
    }

    function showComboToast(text) {
      comboToast.textContent = text;
      comboToast.classList.add('show');
      setTimeout(() => { comboToast.classList.remove('show'); }, 900);
    }

    function updateTimer() {
      if (game.startTime && !game.isPaused && !game.isGameOver) {
        const now = performance.now();
        game.elapsedTimeMs = now - game.startTime;

        const totalSecs = game.elapsedTimeMs / 1000;
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = Math.floor(totalSecs % 60).toString().padStart(2, '0');
        const ms = Math.floor((totalSecs % 1) * 10);
        timerDisplay.textContent = `${mins}:${secs}.${ms}`;
      }
    }

    function gameLoop(time = 0) {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (!game.isPaused && !game.isGameOver && game.startTime) {
        processContinuousInput(deltaTime);

        if (game.isGrounded()) {
          game.lockTimer += deltaTime;
          if (game.lockTimer >= game.lockDelay) {
            const clearedInfo = game.lockPiece();
            processClearedLines(clearedInfo);
            game.lockTimer = 0;
            if (game.isGameOver) handleGameOver();
          }
        } else {
          dropCounter += deltaTime;
          if (dropCounter > game.getDropInterval()) {
            game.gravityStep();
            dropCounter = 0;
          }
        }

        updateTimer();
      }

      renderBoard();
      renderPreviews();
      particles.updateAndDraw();
      updateUI();

      requestAnimationFrame(gameLoop);
    }

    function handleMove(dir) {
      if (game.move(dir)) audioSynth.playMove();
    }
    function handleRotate(dir = 1) {
      if (game.rotate(dir)) audioSynth.playRotate();
    }
    function handleSoftDrop() {
      const result = game.softDrop();
      if (result.moved) audioSynth.playSoftDrop();
    }
    function handleHardDrop() {
      if (game.isGameOver || game.isPaused) return;
      const ghostY = game.getGhostY();
      const currentX = game.currentX;
      const pieceColor = game.currentPiece.color;

      const { distance, clearedInfo } = game.hardDrop();
      if (distance > 0 || clearedInfo) {
        audioSynth.playHardDrop();
        triggerScreenShake('shake-target');
        particles.spawnDropEffect(currentX * BLOCK_SIZE, ghostY * BLOCK_SIZE + 20, BLOCK_SIZE * 3, pieceColor);
        if (clearedInfo && clearedInfo.clearedCount > 0) processClearedLines(clearedInfo);
        if (game.isGameOver) handleGameOver();
      }
    }
    function handleHold() {
      if (game.hold()) audioSynth.playHold();
    }
    function processClearedLines(info) {
      if (!info || !info.clearedCount) return;
      const { clearedCount, clearedIndices, clearedColors } = info;
      audioSynth.playLineClear(clearedCount);
      triggerScreenShake('shake-target');
      clearedIndices.forEach((rIdx, i) => {
        particles.spawnRowClear(rIdx, clearedColors[i], BLOCK_SIZE);
      });
      if (clearedCount === 4) showComboToast("TETRIS! ⚡");
      else if (game.combo > 0) showComboToast(`${game.combo + 1} COMBO! 🔥`);
      updateUI();
    }

    function handleGameOver() {
      audioSynth.playGameOver();
      const { isNewHigh, isNewBestTime } = storage.recordGameFinished({
        score: game.score,
        lines: game.lines,
        tetrises: game.tetrisCount,
        timeMs: game.elapsedTimeMs,
        mode: game.mode
      });
      document.getElementById('final-score').textContent = game.score.toLocaleString();
      document.getElementById('final-lines').textContent = game.lines;
      document.getElementById('final-level').textContent = game.level;

      if (isNewHigh || isNewBestTime) newRecordBadge.classList.remove('hidden');
      else newRecordBadge.classList.add('hidden');

      gameoverOverlay.classList.remove('hidden');
    }

    function startGame() {
      const selectedMode = modeSelect.value;
      game = new TetrisGame(selectedMode);
      particles.clear();
      dropCounter = 0;
      activeHorizontalDir = 0;
      activeKeys.clear();
      game.startTime = performance.now();

      startOverlay.classList.add('hidden');
      pauseOverlay.classList.add('hidden');
      gameoverOverlay.classList.add('hidden');

      updateUI();
      audioSynth.init();
    }

    function togglePause() {
      if (game.isGameOver || !game.startTime) return;
      game.isPaused = !game.isPaused;
      if (game.isPaused) pauseOverlay.classList.remove('hidden');
      else pauseOverlay.classList.add('hidden');
    }

    window.addEventListener('keydown', (e) => {
      if (startOverlay.classList.contains('hidden') === false) {
        if (e.code === 'Enter') startGame();
        return;
      }
      if (gameoverOverlay.classList.contains('hidden') === false) {
        if (e.code === 'Enter') startGame();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
        return;
      }
      if (e.code === 'KeyR') {
        startGame();
        return;
      }
      if (!activeKeys.has(e.code)) {
        activeKeys.add(e.code);
        handleKeyDown(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      activeKeys.delete(e.code);
      handleKeyUp(e.code);
    });

    function bindTouchButton(id, action) {
      const el = document.getElementById(id);
      if (!el) return;
      const handleAction = (e) => {
        e.preventDefault();
        audioSynth.init();
        action();
      };
      el.addEventListener('touchstart', handleAction, { passive: false });
      el.addEventListener('click', handleAction);
    }

    bindTouchButton('touch-left', () => handleMove(-1));
    bindTouchButton('touch-right', () => handleMove(1));
    bindTouchButton('touch-down', () => handleSoftDrop());
    bindTouchButton('touch-rotate-cw', () => handleRotate(1));
    bindTouchButton('touch-rotate-ccw', () => handleRotate(-1));
    bindTouchButton('touch-drop', () => handleHardDrop());
    bindTouchButton('touch-hold', () => handleHold());

    btnStart.addEventListener('click', startGame);
    btnResume.addEventListener('click', togglePause);
    btnRestartPause.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);

    btnSound.addEventListener('click', () => {
      const muted = audioSynth.toggleMute();
      btnSound.querySelector('.sound-icon').textContent = muted ? '🔇' : '🔊';
    });

    btnStats.addEventListener('click', () => {
      const stats = storage.getStats();
      document.getElementById('stat-games').textContent = stats.gamesPlayed;
      document.getElementById('stat-lines').textContent = stats.linesCleared;
      document.getElementById('stat-tetrises').textContent = stats.tetrisClears;
      if (stats.bestSprintTimeMs) {
        const totalSecs = stats.bestSprintTimeMs / 1000;
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = Math.floor(totalSecs % 60).toString().padStart(2, '0');
        document.getElementById('stat-best-sprint').textContent = `${mins}:${secs}`;
      } else {
        document.getElementById('stat-best-sprint').textContent = '--:--';
      }
      statsModal.classList.remove('hidden');
    });

    btnControls.addEventListener('click', () => {
      controlsModal.classList.remove('hidden');
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.target.getAttribute('data-close');
        if (modalId) {
          document.getElementById(modalId).classList.add('hidden');
        }
      });
    });

    modeSelect.addEventListener('change', () => {
      if (startOverlay.classList.contains('hidden')) startGame();
    });

    drawBackgroundGrid();
    updateUI();
    requestAnimationFrame(gameLoop);
  });
})();
