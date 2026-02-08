// Game Engine for MegaRally / Fluffle Dash
// Horizontal endless runner with cyberpunk aesthetic

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (score: number) => void;
  onObstaclePassed: (obstacleId: number) => void;
}

interface Fluffle {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  frame: number;
  state: "running" | "jumping" | "crashed";
}

type ObstacleStyle = "trashcan" | "crate" | "car" | "barrier";

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  passed: boolean;
  style: ObstacleStyle;
  color: string;
  accentColor: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
}

// --- TUNING ---
const GRAVITY = 0.55;
const JUMP_VELOCITY = -14;
const GROUND_OFFSET = 100;
const OBSTACLE_SPEED_START = 6;
const OBSTACLE_SPEED_INCREMENT = 0.0008;
const MAX_SPEED = 14;
const FLUFFLE_SIZE = 48;
const HITBOX_SHRINK = 12;

// Scoring: distance points per frame + bonus per obstacle
const DISTANCE_SCORE_RATE = 0.15; // points per frame (scaled by speed)
const OBSTACLE_BONUS = 25;

// Neon colors
const NEON_PINK = "#ff2d95";
const NEON_CYAN = "#00f0ff";
const NEON_PURPLE = "#b024ff";
const NEON_YELLOW = "#ffe814";
const NEON_GREEN = "#39ff14";
const DARK_BG = "#0a0a1a";

const OBSTACLE_PALETTES: { color: string; accent: string }[] = [
  { color: NEON_PINK, accent: NEON_YELLOW },
  { color: NEON_PURPLE, accent: NEON_CYAN },
  { color: "#ff6b35", accent: NEON_YELLOW },
  { color: NEON_CYAN, accent: NEON_PINK },
  { color: NEON_GREEN, accent: "#ffffff" },
];

const OBSTACLE_STYLES: ObstacleStyle[] = ["trashcan", "crate", "car", "barrier"];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fluffle: Fluffle;
  private obstacles: Obstacle[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private score = 0;
  private displayScore = 0;
  private obstaclesPassed = 0;
  private obstacleIdCounter = 0;
  private speed = OBSTACLE_SPEED_START;
  private frameCount = 0;
  private groundY = 0;
  private nextObstacleX = 0;
  private animationId: number | null = null;
  private callbacks: GameCallbacks;
  private isRunning = false;
  private lastTime = 0;

  // Parallax offsets
  private bgOffset1 = 0;
  private bgOffset2 = 0;
  private bgOffset3 = 0;

  // Pre-rendered overlay
  private scanlineCanvas: HTMLCanvasElement | null = null;

  // Buildings for parallax layers
  private farBuildings: { x: number; w: number; h: number; color: string }[] = [];
  private midBuildings: {
    x: number;
    w: number;
    h: number;
    color: string;
    windows: { x: number; y: number; color: string }[];
  }[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.callbacks = callbacks;

    this.groundY = canvas.height - GROUND_OFFSET;
    this.fluffle = this.createFluffle();
    this.generateBuildings();
    this.generateStars();
    this.prerenderScanlines();
  }

  private createFluffle(): Fluffle {
    return {
      x: this.canvas.width * 0.2,
      y: this.groundY - FLUFFLE_SIZE,
      width: FLUFFLE_SIZE,
      height: FLUFFLE_SIZE,
      velocityY: 0,
      isJumping: false,
      frame: 0,
      state: "running",
    };
  }

  private generateStars() {
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * (this.groundY - 100),
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        speed: Math.random() * 0.3 + 0.1,
      });
    }
  }

  private generateBuildings() {
    this.farBuildings = [];
    let x = 0;
    while (x < this.canvas.width * 2) {
      const w = 40 + Math.random() * 80;
      const h = 80 + Math.random() * 200;
      const colors = ["#1a1a3e", "#151535", "#1e1e42"];
      this.farBuildings.push({
        x, w, h,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
      x += w + Math.random() * 20;
    }

    this.midBuildings = [];
    x = 0;
    const windowColors = [NEON_CYAN, NEON_PINK, NEON_YELLOW, "#ffffff"];
    while (x < this.canvas.width * 2) {
      const w = 50 + Math.random() * 100;
      const h = 100 + Math.random() * 250;
      const colors = ["#1a1a4a", "#1f1f50", "#252558"];
      const windows: { x: number; y: number; color: string }[] = [];
      for (let wy = 10; wy < h - 20; wy += 20) {
        for (let wx = 8; wx < w - 8; wx += 16) {
          if (Math.random() > 0.3) {
            windows.push({
              x: wx, y: wy,
              color: windowColors[Math.floor(Math.random() * windowColors.length)],
            });
          }
        }
      }
      this.midBuildings.push({
        x, w, h,
        color: colors[Math.floor(Math.random() * colors.length)],
        windows,
      });
      x += w + Math.random() * 30;
    }
  }

  private prerenderScanlines() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;
    this.scanlineCanvas = document.createElement("canvas");
    this.scanlineCanvas.width = w;
    this.scanlineCanvas.height = h;
    const sctx = this.scanlineCanvas.getContext("2d")!;
    sctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let y = 0; y < h; y += 4) {
      sctx.fillRect(0, y, w, 2);
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.groundY = height - GROUND_OFFSET;
    if (!this.isRunning) {
      this.fluffle.y = this.groundY - FLUFFLE_SIZE;
    }
    this.generateBuildings();
    this.generateStars();
    this.prerenderScanlines();
  }

  jump() {
    if (this.fluffle.state === "crashed") return;
    if (!this.fluffle.isJumping) {
      this.fluffle.velocityY = JUMP_VELOCITY;
      this.fluffle.isJumping = true;
      this.fluffle.state = "jumping";
      this.spawnJumpParticles();
    }
  }

  start() {
    this.score = 0;
    this.displayScore = 0;
    this.obstaclesPassed = 0;
    this.speed = OBSTACLE_SPEED_START;
    this.frameCount = 0;
    this.obstacles = [];
    this.particles = [];
    this.obstacleIdCounter = 0;
    this.fluffle = this.createFluffle();
    this.nextObstacleX = 300;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.callbacks.onScoreChange(0);
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getScore(): number {
    return Math.floor(this.score);
  }

  isGameRunning(): boolean {
    return this.isRunning;
  }

  private loop = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 16) {
      this.lastTime = now;
      this.update();
      this.render();
      this.frameCount++;
    }

    this.animationId = requestAnimationFrame(this.loop);
  };

  private update() {
    this.speed = Math.min(MAX_SPEED, OBSTACLE_SPEED_START + this.frameCount * OBSTACLE_SPEED_INCREMENT);
    this.score += DISTANCE_SCORE_RATE * (this.speed / OBSTACLE_SPEED_START);
    this.displayScore += (this.score - this.displayScore) * 0.3;
    this.callbacks.onScoreChange(Math.floor(this.score));
    this.updateFluffle();
    this.updateObstacles();
    this.spawnObstacles();
    this.updateParticles();
    this.bgOffset1 += this.speed * 0.1;
    this.bgOffset2 += this.speed * 0.3;
    this.bgOffset3 += this.speed * 0.6;
    this.checkCollisions();
  }

  private updateFluffle() {
    if (this.fluffle.state === "crashed") return;
    this.fluffle.velocityY += GRAVITY;
    this.fluffle.y += this.fluffle.velocityY;
    if (this.fluffle.y >= this.groundY - FLUFFLE_SIZE) {
      this.fluffle.y = this.groundY - FLUFFLE_SIZE;
      this.fluffle.velocityY = 0;
      this.fluffle.isJumping = false;
      if (this.fluffle.state === "jumping") {
        this.fluffle.state = "running";
      }
    }
    this.fluffle.frame += 0.15;
  }

  private updateObstacles() {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed;
      if (!obs.passed && obs.x + obs.width < this.fluffle.x) {
        obs.passed = true;
        this.obstaclesPassed++;
        this.score += OBSTACLE_BONUS;
        this.callbacks.onScoreChange(Math.floor(this.score));
        this.callbacks.onObstaclePassed(obs.id);
        this.spawnScoreParticles(obs.x + obs.width, obs.y);
      }
      if (obs.x + obs.width < -50) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private getDifficulty() {
    const n = this.obstaclesPassed;
    if (n < 4) {
      return { minH: 32, maxH: 44, minW: 24, maxW: 36, minGap: 420, maxGap: 550 };
    } else if (n < 8) {
      return { minH: 34, maxH: 48, minW: 26, maxW: 40, minGap: 400, maxGap: 520 };
    } else if (n < 12) {
      return { minH: 36, maxH: 52, minW: 28, maxW: 44, minGap: 370, maxGap: 480 };
    } else if (n < 18) {
      return { minH: 38, maxH: 56, minW: 30, maxW: 48, minGap: 340, maxGap: 440 };
    } else if (n < 24) {
      return { minH: 40, maxH: 58, minW: 32, maxW: 50, minGap: 310, maxGap: 400 };
    } else if (n < 30) {
      return { minH: 42, maxH: 62, minW: 34, maxW: 52, minGap: 280, maxGap: 370 };
    } else if (n < 36) {
      return { minH: 44, maxH: 64, minW: 36, maxW: 56, minGap: 260, maxGap: 340 };
    } else if (n < 42) {
      return { minH: 46, maxH: 66, minW: 38, maxW: 58, minGap: 240, maxGap: 310 };
    } else {
      return { minH: 48, maxH: 70, minW: 40, maxW: 60, minGap: 220, maxGap: 290 };
    }
  }

  private spawnObstacles() {
    this.nextObstacleX -= this.speed;
    if (this.nextObstacleX <= 0) {
      const diff = this.getDifficulty();
      const spacing = diff.minGap + Math.random() * (diff.maxGap - diff.minGap);
      this.nextObstacleX = spacing;
      const obstacleHeight = diff.minH + Math.random() * (diff.maxH - diff.minH);
      const obstacleWidth = diff.minW + Math.random() * (diff.maxW - diff.minW);
      const style = OBSTACLE_STYLES[Math.floor(Math.random() * OBSTACLE_STYLES.length)];
      const palette = OBSTACLE_PALETTES[Math.floor(Math.random() * OBSTACLE_PALETTES.length)];
      this.obstacleIdCounter++;
      this.obstacles.push({
        id: this.obstacleIdCounter,
        x: this.canvas.width + 50,
        y: this.groundY - obstacleHeight,
        width: obstacleWidth,
        height: obstacleHeight,
        passed: false,
        style,
        color: palette.color,
        accentColor: palette.accent,
      });
    }
  }

  private checkCollisions() {
    if (this.fluffle.state === "crashed") return;
    const f = this.fluffle;
    const fLeft = f.x + HITBOX_SHRINK;
    const fRight = f.x + f.width - HITBOX_SHRINK;
    const fTop = f.y + HITBOX_SHRINK;
    const fBottom = f.y + f.height - HITBOX_SHRINK;
    for (const obs of this.obstacles) {
      if (obs.passed) continue;
      if (fRight > obs.x + 4 && fLeft < obs.x + obs.width - 4 && fBottom > obs.y + 4 && fTop < obs.y + obs.height) {
        this.crash();
        return;
      }
    }
  }

  private crash() {
    this.fluffle.state = "crashed";
    this.isRunning = false;
    this.spawnCrashParticles();
    this.callbacks.onGameOver(Math.floor(this.score));
    this.renderCrashAnimation();
  }

  private renderCrashAnimation() {
    let frames = 0;
    const animate = () => {
      if (frames > 30) return;
      frames++;
      this.updateParticles();
      this.render();
      requestAnimationFrame(animate);
    };
    animate();
  }

  private spawnJumpParticles() {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: this.fluffle.x + FLUFFLE_SIZE / 2,
        y: this.groundY,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        life: 15,
        maxLife: 15,
        size: 2 + Math.random() * 3,
        color: NEON_CYAN,
      });
    }
  }

  private spawnScoreParticles(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 5 - 1,
        life: 25,
        maxLife: 25,
        size: 2 + Math.random() * 3,
        color: NEON_YELLOW,
      });
    }
  }

  private spawnCrashParticles() {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.fluffle.x + FLUFFLE_SIZE / 2,
        y: this.fluffle.y + FLUFFLE_SIZE / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 35,
        maxLife: 35,
        size: 3 + Math.random() * 5,
        color: Math.random() > 0.5 ? NEON_PINK : NEON_PURPLE,
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // ---- RENDERING ----

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = DARK_BG;
    ctx.fillRect(0, 0, w, h);

    this.drawStars(ctx);
    this.drawFarBuildings(ctx);
    this.drawMidBuildings(ctx);
    this.drawGround(ctx);
    this.drawObstacles(ctx);
    this.drawFluffle(ctx);
    this.drawParticles(ctx);

    // Scanline overlay — pre-rendered
    if (this.scanlineCanvas) {
      ctx.drawImage(this.scanlineCanvas, 0, 0);
    }
  }

  renderIdle() {
    this.render();
  }

  private drawStars(ctx: CanvasRenderingContext2D) {
    // Batch stars as simple rects — much faster than arc
    for (const star of this.stars) {
      const alpha = 0.3 + Math.sin(this.frameCount * 0.02 + star.x) * 0.5;
      if (alpha < 0.1) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFarBuildings(ctx: CanvasRenderingContext2D) {
    const totalWidth = this.farBuildings.length > 0
      ? this.farBuildings[this.farBuildings.length - 1].x + this.farBuildings[this.farBuildings.length - 1].w
      : this.canvas.width;
    const offset = this.bgOffset1 % totalWidth;

    for (const b of this.farBuildings) {
      const x = b.x - offset;
      const drawX = x < -b.w ? x + totalWidth : x;
      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, this.groundY - b.h, b.w, b.h);
      // Simple top edge highlight instead of gradient
      ctx.fillStyle = "rgba(176, 36, 255, 0.08)";
      ctx.fillRect(drawX, this.groundY - b.h, b.w, 4);
    }
  }

  private drawMidBuildings(ctx: CanvasRenderingContext2D) {
    const totalWidth = this.midBuildings.length > 0
      ? this.midBuildings[this.midBuildings.length - 1].x + this.midBuildings[this.midBuildings.length - 1].w
      : this.canvas.width;
    const offset = this.bgOffset2 % totalWidth;

    for (const b of this.midBuildings) {
      const x = b.x - offset;
      const drawX = x < -b.w ? x + totalWidth : x;

      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, this.groundY - b.h, b.w, b.h);

      // Windows — pre-computed colors, no Math.random per frame
      for (const win of b.windows) {
        ctx.fillStyle = win.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(drawX + win.x, this.groundY - b.h + win.y, 6, 8);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    const w = this.canvas.width;

    ctx.fillStyle = "#0f0f2a";
    ctx.fillRect(0, this.groundY, w, GROUND_OFFSET);

    // Ground line — single glow using two lines instead of shadowBlur
    ctx.strokeStyle = "rgba(0,240,255,0.3)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(w, this.groundY);
    ctx.stroke();

    ctx.strokeStyle = NEON_CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(w, this.groundY);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
    ctx.lineWidth = 1;
    const gridSpacing = 60;
    const offset = this.bgOffset3 % gridSpacing;
    for (let gx = -offset; gx < w; gx += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(gx, this.groundY);
      ctx.lineTo(gx, this.groundY + GROUND_OFFSET);
      ctx.stroke();
    }
    for (let gy = this.groundY + 20; gy < this.groundY + GROUND_OFFSET; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D) {
    for (const obs of this.obstacles) {
      ctx.save();
      switch (obs.style) {
        case "trashcan": this.drawTrashcanObstacle(ctx, obs); break;
        case "crate": this.drawCrateObstacle(ctx, obs); break;
        case "car": this.drawCarObstacle(ctx, obs); break;
        case "barrier": this.drawBarrierObstacle(ctx, obs); break;
      }
      ctx.restore();
    }
  }

  private drawTrashcanObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const cx = obs.x + obs.width / 2;

    // Body — flat metallic with edge shading
    ctx.fillStyle = "#4a4a5e";
    this.roundRect(ctx, obs.x + 2, obs.y + 6, obs.width - 4, obs.height - 6, 3);
    ctx.fill();
    // Left highlight
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(obs.x + 3, obs.y + 7, 3, obs.height - 8);
    // Right shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(obs.x + obs.width - 5, obs.y + 7, 3, obs.height - 8);

    // Lid
    ctx.fillStyle = "#3a3a4e";
    this.roundRect(ctx, obs.x - 1, obs.y, obs.width + 2, 7, 3);
    ctx.fill();
    // Lid handle
    ctx.strokeStyle = "#6a6a80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, obs.y - 1, 4, Math.PI, 0);
    ctx.stroke();

    // Horizontal ridges
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let ry = obs.y + 14; ry < obs.y + obs.height - 6; ry += 10) {
      ctx.beginPath();
      ctx.moveTo(obs.x + 4, ry);
      ctx.lineTo(obs.x + obs.width - 4, ry);
      ctx.stroke();
    }

    // Neon stripe — glow via thicker transparent line behind
    const stripeY = obs.y + obs.height * 0.5;
    ctx.strokeStyle = obs.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(obs.x + 3, stripeY);
    ctx.lineTo(obs.x + obs.width - 3, stripeY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(obs.x + 3, stripeY);
    ctx.lineTo(obs.x + obs.width - 3, stripeY);
    ctx.stroke();

    // Trash overflow
    ctx.fillStyle = "#555568";
    ctx.fillRect(cx - 6, obs.y + 2, 4, 6);
    ctx.fillRect(cx + 2, obs.y + 1, 3, 5);

    // Bottom shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(obs.x + 4, obs.y + obs.height - 3, obs.width - 8, 3);
  }

  private drawCrateObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Main body — wooden brown
    ctx.fillStyle = "#5c4a35";
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(obs.x, obs.y, obs.width, 3);

    // Wooden plank lines
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    const plankH = obs.height / Math.max(3, Math.floor(obs.height / 14));
    for (let py = obs.y + plankH; py < obs.y + obs.height; py += plankH) {
      ctx.beginPath();
      ctx.moveTo(obs.x, py);
      ctx.lineTo(obs.x + obs.width, py);
      ctx.stroke();
    }

    // Metal straps
    ctx.strokeStyle = "#6a6a7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obs.x + obs.width / 2, obs.y);
    ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y + obs.height * 0.4);
    ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.4);
    ctx.stroke();

    // Corner brackets
    ctx.strokeStyle = "#7a7a8a";
    const bLen = Math.min(8, obs.width * 0.25);
    for (const [bx, by] of [[obs.x, obs.y], [obs.x + obs.width, obs.y], [obs.x, obs.y + obs.height], [obs.x + obs.width, obs.y + obs.height]] as [number, number][]) {
      const dx = bx === obs.x ? 1 : -1;
      const dy = by === obs.y ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bx, by + dy * bLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + dx * bLen, by);
      ctx.stroke();
    }

    // Neon stencil
    ctx.fillStyle = obs.color;
    ctx.font = `bold ${Math.min(12, obs.width * 0.3)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("!", obs.x + obs.width / 2, obs.y + obs.height * 0.65);

    // Neon edge — glow via layered strokes
    ctx.strokeStyle = obs.color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 3;
    ctx.strokeRect(obs.x + 1, obs.y + 1, obs.width - 2, obs.height - 2);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeRect(obs.x + 1, obs.y + 1, obs.width - 2, obs.height - 2);
  }

  private drawCarObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    const carBottom = obs.y + obs.height;
    const bodyH = obs.height * 0.65;
    const roofH = obs.height * 0.35;

    // Under-glow — simple rect with alpha
    ctx.fillStyle = obs.color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(obs.x + 4, carBottom - 4, obs.width - 8, 4);
    ctx.globalAlpha = 1;

    // Car body
    ctx.fillStyle = "#3a3a52";
    this.roundRect(ctx, obs.x, obs.y + roofH, obs.width, bodyH, 4);
    ctx.fill();
    // Body bottom shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(obs.x + 2, obs.y + roofH + bodyH - 4, obs.width - 4, 4);

    // Roof / cabin
    const roofInset = obs.width * 0.15;
    ctx.fillStyle = "#3a3a52";
    this.roundRect(ctx, obs.x + roofInset, obs.y, obs.width - roofInset * 2, roofH + 4, 4);
    ctx.fill();

    // Window
    const winX = obs.x + roofInset + 3;
    const winW = obs.width - roofInset * 2 - 6;
    const winH = roofH - 4;
    ctx.fillStyle = "#0a0a18";
    this.roundRect(ctx, winX, obs.y + 2, winW, winH, 2);
    ctx.fill();
    // Window reflection
    ctx.fillStyle = "rgba(0,240,255,0.06)";
    ctx.fillRect(winX + 2, obs.y + 3, winW * 0.35, winH - 2);

    // Headlight
    ctx.fillStyle = obs.accentColor;
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.width - 3, obs.y + roofH + bodyH * 0.3, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Taillight
    ctx.fillStyle = NEON_PINK;
    ctx.beginPath();
    ctx.ellipse(obs.x + 3, obs.y + roofH + bodyH * 0.3, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neon trim — glow via layered lines
    const trimY = obs.y + roofH + bodyH * 0.45;
    ctx.strokeStyle = obs.color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obs.x + 4, trimY);
    ctx.lineTo(obs.x + obs.width - 4, trimY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(obs.x + 4, trimY);
    ctx.lineTo(obs.x + obs.width - 4, trimY);
    ctx.stroke();

    // Hover pads
    for (const px of [obs.x + obs.width * 0.2, obs.x + obs.width * 0.75]) {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px - 4, carBottom - 4, 8, 4);
      ctx.fillStyle = obs.color;
      ctx.fillRect(px - 3, carBottom - 2, 6, 1);
    }
  }

  private drawBarrierObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Barrier body — tapered
    ctx.fillStyle = "#3a3a48";
    ctx.beginPath();
    ctx.moveTo(obs.x + 3, obs.y);
    ctx.lineTo(obs.x + obs.width - 3, obs.y);
    ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
    ctx.lineTo(obs.x, obs.y + obs.height);
    ctx.closePath();
    ctx.fill();

    // Light gradient overlay
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(obs.x, obs.y, obs.width * 0.5, obs.height);

    // Warning stripes
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(obs.x + 3, obs.y);
    ctx.lineTo(obs.x + obs.width - 3, obs.y);
    ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
    ctx.lineTo(obs.x, obs.y + obs.height);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = obs.accentColor;
    ctx.globalAlpha = 0.15;
    const stripeW = 8;
    for (let sx = obs.x - obs.height; sx < obs.x + obs.width + obs.height; sx += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(sx, obs.y + obs.height);
      ctx.lineTo(sx + obs.height, obs.y);
      ctx.lineTo(sx + obs.height + stripeW, obs.y);
      ctx.lineTo(sx + stripeW, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Top neon strip — glow via layered rect
    ctx.fillStyle = obs.color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(obs.x + 3, obs.y - 1, obs.width - 6, 5);
    ctx.globalAlpha = 1;
    ctx.fillRect(obs.x + 4, obs.y, obs.width - 8, 3);

    // Reflective dots
    ctx.fillStyle = obs.accentColor;
    const dotY = obs.y + obs.height * 0.45;
    const dotSpacing = Math.max(10, obs.width / 4);
    for (let dx = obs.x + dotSpacing / 2; dx < obs.x + obs.width; dx += dotSpacing) {
      ctx.fillRect(dx - 1.5, dotY - 1.5, 3, 3);
    }

    // Side edges
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(obs.x + 3, obs.y);
    ctx.lineTo(obs.x, obs.y + obs.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(obs.x + obs.width - 3, obs.y);
    ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
    ctx.stroke();
  }

  private drawFluffle(ctx: CanvasRenderingContext2D) {
    const f = this.fluffle;
    const cx = f.x + f.width / 2;

    ctx.save();

    if (f.state === "crashed") {
      ctx.globalAlpha = 0.7;
      ctx.translate(cx, f.y + f.height / 2);
      ctx.rotate(0.3);
      ctx.translate(-cx, -(f.y + f.height / 2));
    }

    const isCrashed = f.state === "crashed";
    const furColor = isCrashed ? "#2a2a2a" : "#e8ddd4";
    const hoodColor = isCrashed ? "#1a1a1a" : "#0d0d1a";
    const hoodLight = isCrashed ? "#2a2a2a" : "#1a1a30";
    const outlineColor = isCrashed ? NEON_PINK : NEON_CYAN;

    // --- SPEED TRAIL ---
    if (!isCrashed && this.speed > OBSTACLE_SPEED_START + 1) {
      const trailAlpha = Math.min(0.4, (this.speed - OBSTACLE_SPEED_START) * 0.03);
      const trailLen = Math.min(40, (this.speed - OBSTACLE_SPEED_START) * 5);
      ctx.strokeStyle = NEON_CYAN;
      ctx.globalAlpha = trailAlpha;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const yOff = f.y + 10 + i * (f.height - 20) / 2;
        ctx.beginPath();
        ctx.moveTo(f.x - trailLen, yOff);
        ctx.lineTo(f.x, yOff);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // --- HOODIE BODY ---
    ctx.fillStyle = hoodLight;
    this.roundRect(ctx, f.x, f.y + f.height * 0.15, f.width, f.height * 0.85, 8);
    ctx.fill();
    // Edge shading
    ctx.fillStyle = hoodColor;
    ctx.fillRect(f.x + 1, f.y + f.height * 0.15 + 1, 3, f.height * 0.83);
    ctx.fillRect(f.x + f.width - 4, f.y + f.height * 0.15 + 1, 3, f.height * 0.83);

    // Zipper line
    ctx.strokeStyle = outlineColor;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, f.y + f.height * 0.2);
    ctx.lineTo(cx, f.y + f.height * 0.9);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Pocket
    if (!isCrashed) {
      ctx.strokeStyle = `${NEON_PURPLE}40`;
      ctx.lineWidth = 1;
      this.roundRect(ctx, f.x + 6, f.y + f.height * 0.6, f.width - 12, f.height * 0.18, 3);
      ctx.stroke();
    }

    // --- HOOD ---
    ctx.fillStyle = hoodColor;
    ctx.beginPath();
    ctx.moveTo(f.x - 2, f.y + f.height * 0.35);
    ctx.quadraticCurveTo(f.x - 3, f.y - 6, f.x + f.width * 0.15, f.y - 14);
    ctx.quadraticCurveTo(cx, f.y - 20, f.x + f.width * 0.85, f.y - 14);
    ctx.quadraticCurveTo(f.x + f.width + 3, f.y - 6, f.x + f.width + 2, f.y + f.height * 0.35);
    ctx.closePath();
    ctx.fill();

    // Hood inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(f.x + 3, f.y + f.height * 0.32);
    ctx.quadraticCurveTo(f.x + 3, f.y - 2, f.x + f.width * 0.2, f.y - 8);
    ctx.quadraticCurveTo(cx, f.y - 14, f.x + f.width * 0.8, f.y - 8);
    ctx.quadraticCurveTo(f.x + f.width - 3, f.y - 2, f.x + f.width - 3, f.y + f.height * 0.32);
    ctx.closePath();
    ctx.fill();

    // Hood neon edge — glow via layered stroke
    ctx.strokeStyle = outlineColor;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y + f.height * 0.33);
    ctx.quadraticCurveTo(f.x - 1, f.y - 4, f.x + f.width * 0.15, f.y - 12);
    ctx.quadraticCurveTo(cx, f.y - 18, f.x + f.width * 0.85, f.y - 12);
    ctx.quadraticCurveTo(f.x + f.width + 1, f.y - 4, f.x + f.width, f.y + f.height * 0.33);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y + f.height * 0.33);
    ctx.quadraticCurveTo(f.x - 1, f.y - 4, f.x + f.width * 0.15, f.y - 12);
    ctx.quadraticCurveTo(cx, f.y - 18, f.x + f.width * 0.85, f.y - 12);
    ctx.quadraticCurveTo(f.x + f.width + 1, f.y - 4, f.x + f.width, f.y + f.height * 0.33);
    ctx.stroke();

    // --- EARS ---
    const earH = 16;
    const earW = 9;
    const earBaseY = f.y - 10;

    for (const side of [-1, 1]) {
      const earX = side === -1 ? f.x + 7 : f.x + f.width - 7 - earW;
      const tipX = earX + earW / 2 + side;

      ctx.fillStyle = furColor;
      ctx.beginPath();
      ctx.moveTo(earX, earBaseY);
      ctx.quadraticCurveTo(tipX - side * 2, earBaseY - earH - 2, tipX, earBaseY - earH);
      ctx.quadraticCurveTo(tipX + side * 2, earBaseY - earH - 2, earX + earW, earBaseY);
      ctx.closePath();
      ctx.fill();

      // Ear outline — glow via layered stroke
      ctx.strokeStyle = outlineColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(earX, earBaseY);
      ctx.quadraticCurveTo(tipX - side * 2, earBaseY - earH - 2, tipX, earBaseY - earH);
      ctx.quadraticCurveTo(tipX + side * 2, earBaseY - earH - 2, earX + earW, earBaseY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(earX, earBaseY);
      ctx.quadraticCurveTo(tipX - side * 2, earBaseY - earH - 2, tipX, earBaseY - earH);
      ctx.quadraticCurveTo(tipX + side * 2, earBaseY - earH - 2, earX + earW, earBaseY);
      ctx.stroke();

      // Inner ear pink
      ctx.fillStyle = isCrashed ? "rgba(255,45,149,0.3)" : "rgba(255,150,180,0.35)";
      ctx.beginPath();
      ctx.moveTo(earX + 2, earBaseY);
      ctx.quadraticCurveTo(tipX, earBaseY - earH + 4, earX + earW - 2, earBaseY);
      ctx.closePath();
      ctx.fill();
    }

    // --- FACE ---
    const faceY = f.y + f.height * 0.05;
    const faceH = f.height * 0.3;
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(cx, faceY + faceH * 0.5, f.width * 0.4, faceH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- EYES ---
    const eyeY = faceY + faceH * 0.35;
    const leftEyeX = f.x + f.width * 0.32;
    const rightEyeX = f.x + f.width * 0.68;

    if (isCrashed) {
      ctx.strokeStyle = NEON_PINK;
      ctx.lineWidth = 2;
      for (const ex of [leftEyeX, rightEyeX]) {
        ctx.beginPath();
        ctx.moveTo(ex - 4, eyeY - 4);
        ctx.lineTo(ex + 4, eyeY + 4);
        ctx.moveTo(ex + 4, eyeY - 4);
        ctx.lineTo(ex - 4, eyeY + 4);
        ctx.stroke();
      }
    } else {
      for (const ex of [leftEyeX, rightEyeX]) {
        // Eye white
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, 5.5, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        ctx.fillStyle = NEON_CYAN;
        ctx.beginPath();
        ctx.ellipse(ex + 1.5, eyeY, 3.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(ex + 2, eyeY, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glints
        ctx.fillStyle = "#fff";
        ctx.fillRect(ex - 1.5, eyeY - 2.5, 2.5, 2.5);
      }
    }

    // Nose
    if (!isCrashed) {
      ctx.fillStyle = "#ffb0c0";
      ctx.beginPath();
      ctx.moveTo(cx - 2, eyeY + 8);
      ctx.lineTo(cx + 2, eyeY + 8);
      ctx.lineTo(cx, eyeY + 11);
      ctx.closePath();
      ctx.fill();

      // Mouth
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, eyeY + 10, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // --- LEGS ---
    if (f.state === "running") {
      const legPhase = Math.sin(f.frame * 2);
      const legY = f.y + f.height;

      ctx.strokeStyle = hoodColor;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(f.x + f.width * 0.3, legY);
      ctx.lineTo(f.x + f.width * 0.3 + legPhase * 8, legY + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(f.x + f.width * 0.7, legY);
      ctx.lineTo(f.x + f.width * 0.7 - legPhase * 8, legY + 10);
      ctx.stroke();

      // Shoes
      const shoeL = f.x + f.width * 0.3 + legPhase * 8;
      const shoeR = f.x + f.width * 0.7 - legPhase * 8;
      ctx.fillStyle = hoodColor;
      ctx.fillRect(shoeL - 4, legY + 9, 8, 4);
      ctx.fillRect(shoeR - 4, legY + 9, 8, 4);
      ctx.fillStyle = outlineColor;
      ctx.fillRect(shoeL - 4, legY + 12, 8, 1);
      ctx.fillRect(shoeR - 4, legY + 12, 8, 1);
      ctx.lineCap = "butt";
    }

    // --- BODY OUTLINE — glow via layered stroke ---
    ctx.strokeStyle = outlineColor;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 4;
    this.roundRect(ctx, f.x, f.y + f.height * 0.15, f.width, f.height * 0.85, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, f.x, f.y + f.height * 0.15, f.width, f.height * 0.85, 8);
    ctx.stroke();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    // No shadowBlur — just alpha-faded circles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size * alpha, p.y - p.size * alpha, p.size * alpha * 2, p.size * alpha * 2);
    }
    ctx.globalAlpha = 1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
