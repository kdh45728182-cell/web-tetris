/* ==========================================================================
   NEON TETRIS - CORE ENGINE (SRS, 7-BAG, SCORING, COLLISION)
   ========================================================================== */

export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30; // 30px * 10 = 300px canvas width

// Tetrimino definitions & matrices (0 = empty)
export const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f3ff',
    name: 'I'
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#2b65ff',
    name: 'J'
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff8800',
    name: 'L'
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#ffe600',
    name: 'O'
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#00ff66',
    name: 'S'
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#b026ff',
    name: 'T'
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff0055',
    name: 'Z'
  }
};

// SRS (Super Rotation System) Wall-Kick Data
const KICK_DATA_JLSTZ = {
  '0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};

const KICK_DATA_I = {
  '0-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1-0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3-2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0-3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

export class TetrisGame {
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

          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          if (newY >= 0 && this.grid[newY][newX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  move(dir) {
    if (this.isGameOver || this.isPaused) return false;
    const newX = this.currentX + dir;
    if (!this.checkCollision(this.currentPiece.shape, newX, this.currentY)) {
      this.currentX = newX;
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

  // Automatic Gravity Step
  gravityStep() {
    if (this.isGameOver || this.isPaused) return { moved: false, locked: false };

    if (!this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY + 1)) {
      this.currentY++;
      return { moved: true, locked: false };
    } else {
      const clearedInfo = this.lockPiece();
      return { moved: false, locked: true, ...clearedInfo };
    }
  }

  // Soft Drop
  softDrop() {
    if (this.isGameOver || this.isPaused) return { moved: false, locked: false };

    if (!this.checkCollision(this.currentPiece.shape, this.currentX, this.currentY + 1)) {
      this.currentY++;
      this.score += 1;
      return { moved: true, locked: false };
    } else {
      const clearedInfo = this.lockPiece();
      return { moved: false, locked: true, ...clearedInfo };
    }
  }

  // Hard Drop
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
        r++; // Recheck same row index after shift
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
