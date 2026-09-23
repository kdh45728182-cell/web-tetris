/* ==========================================================================
   NEON TETRIS - PARTICLE EFFECTS & VISUAL FX ENGINE
   ========================================================================== */

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;

    // Explosive velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1; // slight upward bias

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

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
  }

  clear() {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Spawn explosion on cleared row
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

  // Spawn drop effect particles
  spawnDropEffect(x, y, width, color) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const pX = x + Math.random() * width;
      const p = new Particle(pX, y, color);
      p.vy = -Math.random() * 2 - 0.5; // Upward shockwave
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

// Trigger screen shake on element
export function triggerScreenShake(elementId = 'shake-target', intensity = 'normal') {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.classList.remove('shake');
  // Trigger reflow
  void el.offsetWidth;
  el.classList.add('shake');

  setTimeout(() => {
    el.classList.remove('shake');
  }, 250);
}
