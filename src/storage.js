/* ==========================================================================
   NEON TETRIS - LOCAL STORAGE MANAGER
   ========================================================================== */

const STORAGE_KEY = 'NEON_TETRIS_DATA_V1';

const defaultData = {
  highScore: {
    marathon: 0,
    sprint: 0,
    zen: 0
  },
  stats: {
    gamesPlayed: 0,
    linesCleared: 0,
    tetrisClears: 0,
    bestSprintTimeMs: null
  },
  settings: {
    soundMuted: false
  }
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
      console.warn("Storage load failed, using defaults", e);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("Storage save failed", e);
    }
  }

  getHighScore(mode = 'marathon') {
    return this.data.highScore[mode] || 0;
  }

  updateHighScore(score, mode = 'marathon') {
    const current = this.getHighScore(mode);
    if (score > current) {
      this.data.highScore[mode] = score;
      this.saveData();
      return true; // New record
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

  getStats() {
    return this.data.stats;
  }

  getSettings() {
    return this.data.settings;
  }

  saveSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveData();
  }
}

export const storage = new StorageManager();
