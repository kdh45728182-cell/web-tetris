# NEON TETRIS 🎮⚡

A visually stunning, high-performance **Cyberpunk / Neon themed Web Tetris** game built with Vanilla JavaScript, HTML5 Canvas, modern CSS3 glassmorphism styling, and real-time Web Audio API sound synthesis.

![NEON TETRIS Banner](https://img.shields.io/badge/NEON-TETRIS-00f3ff?style=for-the-badge&logo=gamepad)
![License](https://img.shields.io/badge/license-MIT-ff007f?style=for-the-badge)

---

## ✨ Features

- 🌌 **Cyberpunk Neon Aesthetics**: Glassmorphism UI, glowing Tetriminos with 3D bevels, ambient dark mode grid, and dynamic screen shake.
- 🎆 **Particle FX Engine**: Explosive glowing particle bursts when lines are cleared.
- 🕹️ **Official Tetris SRS Mechanics**: Super Rotation System (SRS) wall-kicks, 7-bag generator, ghost piece alignment guide, hold piece function, and next 3 queue.
- 🎵 **Web Audio API Synthesizer**: Zero external audio file dependencies. Real-time synthesized retro SFX for movement, rotations, drops, line clears, Tetris! chords, and level ups.
- 🏆 **Multiple Game Modes**: Classic Marathon, 40-Line Sprint (with timer), and Zen Mode.
- 📊 **High Scores & Stats**: Persistent data saved using `localStorage`.
- 📱 **Responsive & Mobile Ready**: On-screen virtual D-pad and action buttons for touch devices.

---

## 🕹️ Controls

| Key | Action |
| --- | --- |
| `←` / `A`, `→` / `D` | Move Left / Right |
| `↓` / `S` | Soft Drop |
| `Space` | Hard Drop |
| `↑` / `W` / `X` | Rotate Clockwise |
| `Z` | Rotate Counter-Clockwise |
| `Shift` / `C` | Hold Piece |
| `P` / `Esc` | Pause / Resume |
| `R` / `Enter` | Restart / Start Game |

---

## 🚀 How to Run Locally

No dependencies required! Simply open `index.html` in any web browser, or serve static files using Python:

```bash
# Run local server with Python
python -m http.server 8080
```

Then open `http://localhost:8080/index.html` in your browser.

---

## 📜 License
[MIT License](LICENSE)
