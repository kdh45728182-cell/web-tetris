/* ==========================================================================
   NEON TETRIS - MAIN APPLICATION CONTROLLER & RENDERER
   ========================================================================== */

import { TetrisGame, COLS, ROWS, BLOCK_SIZE, PIECES } from './tetris.js';
import { ParticleSystem, triggerScreenShake } from './particles.js';
import { audioSynth } from './audio.js';
import { storage } from './storage.js';

// Canvas Elements
const bgCanvas = document.getElementById('bg-canvas');
const boardCanvas = document.getElementById('board-canvas');
const fxCanvas = document.getElementById('fx-canvas');
const holdCanvas = document.getElementById('hold-canvas');
const nextCanvas = document.getElementById('next-canvas');

const bgCtx = bgCanvas.getContext('2d');
const boardCtx = boardCanvas.getContext('2d');
const holdCtx = holdCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

// UI Elements
const scoreDisplay = document.getElementById('score-display');
const highscoreDisplay = document.getElementById('highscore-display');
const levelDisplay = document.getElementById('level-display');
const linesDisplay = document.getElementById('lines-display');
const timerDisplay = document.getElementById('timer-display');
const modeSelect = document.getElementById('mode-select');
const comboToast = document.getElementById('combo-toast');

// Overlays & Modals
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const newRecordBadge = document.getElementById('new-record-badge');
const statsModal = document.getElementById('stats-modal');
const controlsModal = document.getElementById('controls-modal');

// Buttons
const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');
const btnRestartPause = document.getElementById('btn-restart-pause');
const btnRestart = document.getElementById('btn-restart');
const btnSound = document.getElementById('btn-sound');
const btnStats = document.getElementById('btn-stats');
const btnControls = document.getElementById('btn-controls');

// Game Engine & FX Instances
let game = new TetrisGame('marathon');
let particles = new ParticleSystem(fxCanvas);

let lastTime = 0;
let dropCounter = 0;

// ==========================================================================
// DAS & ARR INPUT ENGINE
// ==========================================================================

const DAS_DELAY = 140; // ms before repeat starts
const ARR_RATE = 35;   // ms per repeat step
const SOFT_DROP_RATE = 35; // ms per soft drop step

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

// ==========================================================================
// RENDERING FUNCTIONS
// ==========================================================================

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

  // Lock Delay Flashing White Outline
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

    // Ghost Piece
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          drawBlock(boardCtx, game.currentX + c, ghostY + r, game.currentPiece.color, true);
        }
      }
    }

    // Active Piece (Flashing if grounded in Lock Delay)
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
  setTimeout(() => {
    comboToast.classList.remove('show');
  }, 900);
}

// ==========================================================================
// GAME LOOP & LOCK DELAY TIMER
// ==========================================================================

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

    // Check Lock Delay when grounded
    if (game.isGrounded()) {
      game.lockTimer += deltaTime;
      if (game.lockTimer >= game.lockDelay) {
        const clearedInfo = game.lockPiece();
        processClearedLines(clearedInfo);
        game.lockTimer = 0;
        if (game.isGameOver) {
          handleGameOver();
        }
      }
    } else {
      // Natural Gravity Step when in mid-air
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

// ==========================================================================
// GAME ACTIONS & CONTROLS
// ==========================================================================

function handleMove(dir) {
  if (game.move(dir)) {
    audioSynth.playMove();
  }
}

function handleRotate(dir = 1) {
  if (game.rotate(dir)) {
    audioSynth.playRotate();
  }
}

function handleSoftDrop() {
  const result = game.softDrop();
  if (result.moved) {
    audioSynth.playSoftDrop();
  }
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

    if (clearedInfo && clearedInfo.clearedCount > 0) {
      processClearedLines(clearedInfo);
    }

    if (game.isGameOver) {
      handleGameOver();
    }
  }
}

function handleHold() {
  if (game.hold()) {
    audioSynth.playHold();
  }
}

function processClearedLines(info) {
  if (!info || !info.clearedCount) return;
  const { clearedCount, clearedIndices, clearedColors } = info;
  audioSynth.playLineClear(clearedCount);
  triggerScreenShake('shake-target');

  clearedIndices.forEach((rIdx, i) => {
    particles.spawnRowClear(rIdx, clearedColors[i], BLOCK_SIZE);
  });

  if (clearedCount === 4) {
    showComboToast("TETRIS! ⚡");
  } else if (game.combo > 0) {
    showComboToast(`${game.combo + 1} COMBO! 🔥`);
  }

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

  if (isNewHigh || isNewBestTime) {
    newRecordBadge.classList.remove('hidden');
  } else {
    newRecordBadge.classList.add('hidden');
  }

  gameoverOverlay.classList.remove('hidden');
}

// ==========================================================================
// START, PAUSE, RESTART FLOWS
// ==========================================================================

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

  if (game.isPaused) {
    pauseOverlay.classList.remove('hidden');
  } else {
    pauseOverlay.classList.add('hidden');
  }
}

// ==========================================================================
// EVENT LISTENERS & INPUT MAPPING
// ==========================================================================

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

// Touch & On-Screen Button Controls
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

// UI Button Event Listeners
btnStart.addEventListener('click', startGame);
btnResume.addEventListener('click', togglePause);
btnRestartPause.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

btnSound.addEventListener('click', () => {
  const muted = audioSynth.toggleMute();
  btnSound.querySelector('.sound-icon').textContent = muted ? '🔇' : '🔇';
});

// Modals Trigger
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
  if (startOverlay.classList.contains('hidden')) {
    startGame();
  }
});

// Initialize Background & Start Loop
drawBackgroundGrid();
updateUI();
requestAnimationFrame(gameLoop);
