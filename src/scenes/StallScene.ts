import Phaser from 'phaser';
import { LOCATIONS } from '../core/locations';
import { lang, t } from '../i18n';

// Сцена только рисует: улица со сменой дня и ночи, ларёк, очередь, машины, частицы.
// Вся логика денег живёт в src/core, а сцену дёргает контроллер из src/game.ts.
// Графика — только фигуры, без картинок.

export const DISPLAY_FONT = 'Unbounded, "Golos Text", system-ui, sans-serif';

const PLUM = 0x2a1b3d;
const CREAM = 0xfff4dc;
const AMBER = 0xffb02e;
const TOMATO = 0xe4472b;
const MEAT = 0xb5651d;
const MEAT_DARK = 0x7f3f12;
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0x3d6fb6, 0x5e9c3a, 0xe4472b, 0x8a4fbf, 0xf2b134, 0x2f9e9a, 0xd9667b, 0x4b4b6b];
const PANTS = [0x2a2f4a, 0x3a3a3a, 0x4a5a8a, 0x6b4a2b, 0x2e4a3a];
const HAIR = [0x2b1b10, 0x5a3a1a, 0xc9a050, 0x1a1a1a, 0x8a2a1a];
const CARS = [0xe4472b, 0x3d6fb6, 0xf2f2f2, 0x2a2a2a, 0xf2b134, 0x5e9c3a];

// Сутки в игре длятся 8 минут. Ключевые точки цвета неба: [фаза, верх, низ, ночь 0..1].
const DAY_SECONDS = 480;
const SKY: [number, number, number, number][] = [
  [0.0, 0x6fb7e8, 0xd4ecf2, 0],
  [0.28, 0x6aa6e0, 0xf3dca6, 0],
  [0.4, 0x4b3f8c, 0xff9a5a, 0.25],
  [0.5, 0x2a1b3d, 0xb0457a, 0.7],
  [0.6, 0x120c24, 0x2e2150, 1],
  [0.88, 0x120c24, 0x2e2150, 1],
  [0.95, 0x5a5aa0, 0xf7b38a, 0.35],
  [1.0, 0x6fb7e8, 0xd4ecf2, 0],
];
// игра начинается на закате: так ларёк сразу светится
const DAY_START = 0.36;

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

function shade(c: number, k: number): number {
  return k < 0 ? lerpColor(c, 0x000000, -k) : lerpColor(c, 0xffffff, k);
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  w: number;
  h: number;
  far: boolean;
  tone: number;
  windows: { x: number; y: number; on: number }[];
}

interface Walker {
  root: Phaser.GameObjects.Container;
  legs: Phaser.GameObjects.Rectangle[];
  phase: number;
}

interface Customer extends Walker {
  state: 'queue' | 'leaving';
}

interface Car {
  root: Phaser.GameObjects.Container;
  lights: Phaser.GameObjects.Ellipse;
  speed: number;
}

export interface StallCallbacks {
  onTap(x: number, y: number): void;
  onGolden(x: number, y: number): void;
}

// Какие улучшения видны на улице. Меняется — перерисовываем ларёк.
interface Look {
  helper: boolean;
  cashier: boolean;
  spit2: boolean;
  sauce: boolean;
  neon: boolean;
  reviews: boolean;
  night: boolean;
  courier: boolean;
  franchise: boolean;
  meme: boolean;
  truck: boolean;
}

const WALK_SPEED = 0.16; // пикселей за мс при масштабе 1

export class StallScene extends Phaser.Scene {
  private cb: StallCallbacks;
  private readyResolve!: () => void;
  readonly ready: Promise<void>;

  private location = 0;
  private look: Look = { helper: false, cashier: false, spit2: false, sauce: false, neon: false, reviews: false, night: false, courier: false, franchise: false, meme: false, truck: false };
  private lookKey = '';

  private sky!: Phaser.GameObjects.Graphics;
  private stars!: Phaser.GameObjects.Graphics;
  private city!: Phaser.GameObjects.Graphics;
  private street!: Phaser.GameObjects.Graphics;
  private landmark!: Phaser.GameObjects.Container;
  private night!: Phaser.GameObjects.Rectangle;
  private lampGlow!: Phaser.GameObjects.Ellipse;
  private lamp!: Phaser.GameObjects.Container;
  private buildings: Building[] = [];
  private starList: { x: number; y: number; r: number; tw: number }[] = [];

  private stall!: Phaser.GameObjects.Container;
  private glowLayer!: Phaser.GameObjects.Container; // свет ларька поверх ночного затемнения
  private stallScale = 1;
  private meatStripes: Phaser.GameObjects.Rectangle[] = [];
  private grillGlow: Phaser.GameObjects.Rectangle[] = [];
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private neon?: Phaser.GameObjects.Text;
  private staff: Phaser.GameObjects.Container[] = [];
  private steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coins!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  private customers: Customer[] = [];
  private golden?: Walker & { glow: Phaser.GameObjects.Arc; caught: boolean };
  private cars: Car[] = [];
  private carTimer = 2000;
  private courierTimer = 6000;

  private comboText!: Phaser.GameObjects.Text;
  private serveEvery = 0;
  private serveTimer = 0;
  private wantQueue = 1;
  private rush = false;
  private nightK = 0;
  private skyTimer = 0;
  private clock = 0;

  constructor(cb: StallCallbacks) {
    super('stall');
    this.cb = cb;
    this.ready = new Promise((r) => (this.readyResolve = r));
  }

  // ---------- размеры ----------

  private get groundY() {
    return Math.round(this.scale.height * 0.8);
  }
  private get horizonY() {
    return Math.round(this.groundY - Math.max(40, this.scale.height * 0.13));
  }
  private get stallX() {
    return Math.round(this.scale.width * 0.6);
  }
  private get unit() {
    return Phaser.Math.Clamp(this.scale.height / 320, 0.55, 2);
  }

  // ---------- создание ----------

  create() {
    this.makeTextures();
    this.sky = this.add.graphics().setDepth(0);
    this.stars = this.add.graphics().setDepth(0.5);
    this.city = this.add.graphics().setDepth(1);
    this.landmark = this.add.container(0, 0).setDepth(1.5);
    this.street = this.add.graphics().setDepth(2);
    this.lamp = this.add.container(0, 0).setDepth(4);
    this.night = this.add.rectangle(0, 0, 10, 10, 0x140a2a, 0).setOrigin(0, 0).setDepth(8);
    this.lampGlow = this.add.ellipse(0, 0, 10, 10, 0xffc861, 0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    this.steam = this.add.particles(0, 0, 'puff', {
      lifespan: 1800,
      speedY: { min: -40, max: -22 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.2, end: 0.8 },
      alpha: { start: 0.22, end: 0 },
      frequency: 260,
    }).setDepth(9.5);
    this.coins = this.add.particles(0, 0, 'coin', {
      lifespan: 900,
      speed: { min: 140, max: 320 },
      angle: { min: 220, max: 320 },
      gravityY: 700,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.6 },
      emitting: false,
    }).setDepth(11);
    this.sparks = this.add.particles(0, 0, 'spark', {
      lifespan: 700,
      speed: { min: 60, max: 220 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(11);

    this.comboText = this.add
      .text(0, 0, '', { fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#fff4dc', fontStyle: '800', stroke: '#2a1b3d', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);

    this.buildStall();
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.input.keyboard?.on('keydown-SPACE', () => this.cb.onTap(this.stallX, this.groundY - 110 * this.stallScale));
    this.readyResolve();
  }

  private makeTextures() {
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(16, 16, 16);
    g.generateTexture('puff', 32, 32);
    g.clear();
    g.fillStyle(0xc98a12, 1).fillCircle(9, 9, 9);
    g.fillStyle(0xffcf3f, 1).fillCircle(9, 8, 7.5);
    g.fillStyle(0xffe89a, 1).fillRect(7, 4, 4, 9);
    g.generateTexture('coin', 18, 18);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();
  }

  // ---------- город ----------

  private planCity() {
    const { width } = this.scale;
    const r = rng(17 + this.location * 101);
    this.buildings = [];
    const u = this.unit;
    for (const far of [true, false]) {
      let x = -20;
      while (x < width + 20) {
        const w = (far ? 40 + r() * 60 : 50 + r() * 70) * u;
        const maxH = far ? 150 : 110;
        const h = (far ? 60 : 30) * u + r() * maxH * u * (0.6 + this.location * 0.12);
        const windows: Building['windows'] = [];
        const cols = Math.max(1, Math.floor(w / (14 * u)));
        const rows = Math.max(1, Math.floor(h / (18 * u)));
        for (let cx = 0; cx < cols; cx++)
          for (let cy = 0; cy < rows; cy++) windows.push({ x: (cx + 0.5) / cols, y: (cy + 0.6) / (rows + 0.3), on: r() });
        this.buildings.push({ x, w, h, far, tone: r(), windows });
        x += w + (far ? 2 : 6 + r() * 30) * u;
      }
    }
    this.starList = Array.from({ length: 40 }, () => ({ x: r() * width, y: r() * this.horizonY * 0.75, r: 0.6 + r() * 1.4, tw: r() * 6 }));
  }

  private drawSky(phase: number) {
    const { width } = this.scale;
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= phase) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = (phase - a[0]) / Math.max(1e-6, b[0] - a[0]);
    const top = lerpColor(a[1], b[1], k);
    const bottom = lerpColor(a[2], b[2], k);
    this.nightK = a[3] + (b[3] - a[3]) * k;

    const hy = this.horizonY;
    const bands = 64;
    this.sky.clear();
    for (let j = 0; j < bands; j++) {
      this.sky.fillStyle(lerpColor(top, bottom, j / (bands - 1)), 1);
      this.sky.fillRect(0, (hy * j) / bands, width, hy / bands + 1);
    }
    this.sky.fillStyle(bottom, 1).fillRect(0, hy, width, this.scale.height - hy);

    // солнце днём, луна ночью; идут дугой по небу
    const u = this.unit;
    const sunT = (phase + 0.1) % 1; // 0..0.5 — солнце над горизонтом
    if (sunT < 0.55) {
      const p = sunT / 0.55;
      const sx = width * (0.1 + 0.8 * p);
      const sy = hy - Math.sin(p * Math.PI) * hy * 0.7;
      this.sky.fillStyle(0xfff1b8, 0.25).fillCircle(sx, sy, 34 * u);
      this.sky.fillStyle(0xffe07a, 1).fillCircle(sx, sy, 20 * u);
    } else {
      const p = (sunT - 0.55) / 0.45;
      const mx = width * (0.1 + 0.8 * p);
      const my = hy - Math.sin(p * Math.PI) * hy * 0.7;
      this.sky.fillStyle(0xf3f0ff, 1).fillCircle(mx, my, 14 * u);
      this.sky.fillStyle(top, 1).fillCircle(mx + 6 * u, my - 3 * u, 12 * u);
    }

    this.stars.clear();
    if (this.nightK > 0.3) {
      for (const s of this.starList) {
        const tw = 0.5 + 0.5 * Math.sin(this.clock / 600 + s.tw);
        this.stars.fillStyle(0xffffff, (this.nightK - 0.3) * tw).fillCircle(s.x, s.y, s.r * u);
      }
    }
  }

  private drawCity() {
    const n = this.nightK;
    const hy = this.horizonY;
    const g = this.city;
    g.clear();
    for (const b of this.buildings) {
      const day = b.far ? lerpColor(0xa7a3cf, 0xc9b6d8, b.tone) : lerpColor(0x7d6f9e, 0x9a7fa8, b.tone);
      const night = b.far ? 0x2a2148 : 0x1f1838;
      const col = lerpColor(day, night, n);
      const top = hy - b.h;
      g.fillStyle(col, 1).fillRect(b.x, top, b.w, b.h);
      g.fillStyle(shade(col, -0.15), 1).fillRect(b.x, top, b.w, 3 * this.unit);
      if (!b.far) g.fillStyle(shade(col, -0.12), 1).fillRect(b.x + b.w * 0.82, top, b.w * 0.18, b.h);
      const ww = 6 * this.unit, wh = 8 * this.unit;
      for (const w of b.windows) {
        const lit = w.on < 0.15 + n * 0.55;
        const wc = lit && n > 0.2 ? lerpColor(0xffd27a, 0xffb347, w.on) : shade(col, b.far ? 0.12 : 0.18);
        g.fillStyle(wc, lit && n > 0.2 ? 0.55 + 0.45 * n : 0.7);
        g.fillRect(b.x + b.w * w.x - ww / 2, top + b.h * w.y - wh / 2, ww, wh);
      }
    }
  }

  private drawStreet() {
    const { width, height } = this.scale;
    const n = this.nightK;
    const hy = this.horizonY;
    const gy = this.groundY;
    const u = this.unit;
    const g = this.street;
    g.clear();
    // дорога
    const road = lerpColor(0x6e6a80, 0x24203a, n);
    g.fillStyle(road, 1).fillRect(0, hy, width, gy - hy);
    g.fillStyle(lerpColor(0xf4ecd8, 0x8a8298, n), 1);
    const dash = 26 * u;
    for (let x = 0; x < width; x += dash * 2) g.fillRect(x, hy + (gy - hy) * 0.45, dash, 3 * u);
    // бордюр
    g.fillStyle(lerpColor(0xd8cfc0, 0x5a5270, n), 1).fillRect(0, gy - 6 * u, width, 6 * u);
    // тротуар плиткой
    const tile = lerpColor(0xe9d9bf, 0x4a3f63, n);
    g.fillStyle(tile, 1).fillRect(0, gy, width, height - gy);
    g.lineStyle(1, shade(tile, -0.12), 1);
    const tw = 36 * u;
    for (let y = gy + 14 * u, row = 0; y < height; y += 14 * u, row++) {
      g.lineBetween(0, y, width, y);
      for (let x = (row % 2) * (tw / 2); x < width; x += tw) g.lineBetween(x, y - 14 * u, x, y);
    }
  }

  private buildLandmark() {
    this.landmark.removeAll(true);
    const u = this.unit;
    const hy = this.horizonY;
    const w = this.scale.width;
    const id = LOCATIONS[this.location].id;
    const L = this.landmark;
    if (id === 'metro') {
      // красная «М» на столбе
      const x = w * 0.12;
      L.add(this.add.rectangle(x, hy, 5 * u, 70 * u, 0x5a5270).setOrigin(0.5, 1));
      L.add(this.add.circle(x, hy - 78 * u, 17 * u, 0xffffff));
      L.add(this.add.text(x, hy - 78 * u, 'M', { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(22 * u)}px`, color: '#e4472b', fontStyle: '900' }).setOrigin(0.5));
    } else if (id === 'market') {
      for (let i = 0; i < 4; i++) {
        const x = w * 0.04 + i * 52 * u;
        const c = [TOMATO, 0x2f9e9a, AMBER, 0x5e9c3a][i];
        L.add(this.add.rectangle(x, hy, 46 * u, 26 * u, shade(c, -0.35)).setOrigin(0, 1));
        L.add(this.add.triangle(x + 23 * u, hy - 26 * u, 0, 14 * u, 23 * u, 0, 46 * u, 14 * u, c).setOrigin(0.5, 1));
      }
    } else if (id === 'shop' || id === 'cafe') {
      // деревья вдоль проспекта
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + 20 * u;
        L.add(this.add.rectangle(x, hy, 4 * u, 22 * u, 0x5a3a2a).setOrigin(0.5, 1));
        L.add(this.add.circle(x, hy - 30 * u, 14 * u, id === 'cafe' ? 0x4f8a3a : 0x5e9c3a));
      }
    } else {
      // билборд сети
      const x = w * 0.16;
      L.add(this.add.rectangle(x, hy, 5 * u, 60 * u, 0x5a5270).setOrigin(0.5, 1));
      L.add(this.add.rectangle(x, hy - 60 * u, 110 * u, 44 * u, TOMATO).setOrigin(0.5, 1));
      L.add(this.add.text(x, hy - 82 * u, t('neon'), { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(13 * u)}px`, color: '#fff4dc', fontStyle: '900' }).setOrigin(0.5));
    }
    if (this.look.meme) {
      // мемная реклама: билборд с улыбающейся шаурмой
      const x = w * 0.86, y = hy - 70 * u;
      L.add(this.add.rectangle(x, hy, 4 * u, 70 * u, 0x5a5270).setOrigin(0.5, 1));
      L.add(this.add.rectangle(x, y, 70 * u, 42 * u, 0xfff4dc).setOrigin(0.5, 1).setStrokeStyle(3 * u, PLUM));
      L.add(this.add.rectangle(x, y - 21 * u, 14 * u, 30 * u, 0xf2e3b3).setAngle(-25).setStrokeStyle(2 * u, MEAT));
      L.add(this.add.circle(x - 3 * u, y - 25 * u, 1.6 * u, PLUM));
      L.add(this.add.circle(x + 3 * u, y - 23 * u, 1.6 * u, PLUM));
    }
    if (this.look.franchise) {
      // соседняя точка вдалеке светится вывеской
      const x = w * 0.3;
      L.add(this.add.rectangle(x, hy, 44 * u, 28 * u, shade(LOCATIONS[this.location].body, -0.2)).setOrigin(0.5, 1));
      L.add(this.add.rectangle(x, hy - 28 * u, 50 * u, 7 * u, AMBER).setOrigin(0.5, 1));
    }
    if (this.look.truck) {
      // фудтрак припаркован у бордюра слева
      const x = w * 0.04, y = this.groundY - 6 * u;
      L.add(this.add.rectangle(x, y - 6 * u, 90 * u, 44 * u, AMBER).setOrigin(0, 1));
      L.add(this.add.rectangle(x + 60 * u, y - 6 * u, 30 * u, 30 * u, shade(AMBER, -0.2)).setOrigin(0, 1));
      L.add(this.add.rectangle(x + 10 * u, y - 26 * u, 40 * u, 16 * u, PLUM).setOrigin(0, 1));
      L.add(this.add.circle(x + 18 * u, y - 4 * u, 8 * u, 0x222222));
      L.add(this.add.circle(x + 72 * u, y - 4 * u, 8 * u, 0x222222));
    }
  }

  private buildLamp() {
    this.lamp.removeAll(true);
    const u = this.unit;
    const x = Math.max(24 * u, this.stallX - (LOCATIONS[this.location].width / 2 + 70) * this.stallScale - 30 * u);
    const gy = this.groundY;
    this.lamp.add(this.add.rectangle(x, gy, 5 * u, 130 * u, 0x3a3150).setOrigin(0.5, 1));
    this.lamp.add(this.add.rectangle(x + 12 * u, gy - 130 * u, 28 * u, 5 * u, 0x3a3150).setOrigin(0.5, 0.5));
    this.lamp.add(this.add.rectangle(x + 22 * u, gy - 126 * u, 14 * u, 6 * u, 0xffe2a0).setOrigin(0.5, 0));
    this.lampGlow.setPosition(x + 22 * u, gy - 60 * u).setSize(150 * u, 150 * u);
  }

  // ---------- ларёк ----------

  private buildStall() {
    this.stall?.destroy();
    this.glowLayer?.destroy();
    this.meatStripes = [];
    this.grillGlow = [];
    this.bulbs = [];
    this.staff = [];
    this.neon = undefined;
    const loc = LOCATIONS[this.location];
    const w = loc.width;
    const h = 150;
    const c = this.add.container(0, 0).setDepth(5);
    const L = this.add.container(0, 0).setDepth(9);
    const body = loc.body;

    // тень
    c.add(this.add.ellipse(0, 2, w + 60, 18, 0x000000, 0.18));
    // корпус: нижняя панель темнее, вертикальные стыки листов
    c.add(this.add.rectangle(0, -h / 2, w, h, body));
    c.add(this.add.rectangle(0, -h * 0.14, w, h * 0.28, shade(body, -0.18)));
    for (let i = 1; i < 4; i++) c.add(this.add.rectangle(-w / 2 + (w / 4) * i, -h * 0.14, 2, h * 0.28, shade(body, -0.3)));

    // окно выдачи
    const winW = w * 0.56, winH = h * 0.46, winX = -w * 0.1, winY = -h * 0.6;
    c.add(this.add.rectangle(winX, winY, winW + 8, winH + 8, shade(body, -0.35)));
    c.add(this.add.rectangle(winX, winY, winW, winH, 0x3b2a4f));
    // тёплый свет внутри: ночью он поверх затемнения
    L.add(this.add.rectangle(winX, winY, winW, winH, 0xffb347, 0.0).setName('winGlow').setBlendMode(Phaser.BlendModes.ADD));

    // гриль и вертел
    const spit = (x: number) => {
      const glow = this.add.rectangle(x - 16, winY + 2, 8, winH * 0.7, 0xff6a2b, 0.9);
      c.add(glow);
      this.grillGlow.push(glow);
      c.add(this.add.rectangle(x, winY, 3, winH * 0.9, 0x9a9aa8));
      const coneH = winH * 0.66;
      const cone = this.add.polygon(x, winY + 2, [-15, -coneH / 2, 15, -coneH / 2, 8, coneH / 2, -8, coneH / 2], MEAT);
      c.add(cone);
      c.add(this.add.rectangle(x - 6, winY + 2, 4, coneH * 0.9, 0xd98a45, 0.8));
      for (let i = 0; i < 5; i++) {
        const st = this.add.rectangle(x, 0, 28, 2.5, MEAT_DARK);
        st.setData({ x, top: winY + 2 - coneH / 2, h: coneH, i });
        c.add(st);
        this.meatStripes.push(st);
      }
      L.add(this.add.rectangle(glow.x, glow.y, 14, winH * 0.8, 0xff6a2b, 0.25).setName('grillLight').setBlendMode(Phaser.BlendModes.ADD));
    };
    spit(winX - winW * 0.28);
    if (this.look.spit2) spit(winX - winW * 0.06);

    // помощники за прилавком
    const person = (x: number, shirt: number, cap: number) => {
      const p = this.add.container(x, winY + winH / 2 - 4);
      p.add(this.add.rectangle(0, -14, 24, 28, shirt).setOrigin(0.5, 0.5));
      p.add(this.add.circle(0, -36, 10, SKIN[(x | 0) % SKIN.length]));
      p.add(this.add.rectangle(0, -44, 22, 6, cap));
      p.add(this.add.circle(-3, -36, 1.4, PLUM));
      p.add(this.add.circle(3, -36, 1.4, PLUM));
      p.setData('y0', p.y);
      c.add(p);
      this.staff.push(p);
    };
    if (this.look.helper) person(winX + winW * 0.12, 0xfff4dc, TOMATO);
    if (this.look.cashier) person(winX + winW * 0.36, 0x5e9c3a, CREAM);

    // прилавок
    c.add(this.add.rectangle(0, winY + winH / 2 + 4, w + 18, 9, CREAM));
    c.add(this.add.rectangle(0, winY + winH / 2 + 9, w + 18, 3, shade(CREAM, -0.25)));
    if (this.look.sauce) {
      c.add(this.add.rectangle(winX + winW * 0.42, winY + winH / 2 - 7, 7, 14, TOMATO));
      c.add(this.add.rectangle(winX + winW * 0.42 + 10, winY + winH / 2 - 7, 7, 14, 0xfff8ee));
      c.add(this.add.rectangle(winX + winW * 0.42 + 20, winY + winH / 2 - 6, 7, 12, 0x5e9c3a));
    }

    // меню-доска справа от окна
    const mx = w * 0.33, my = -h * 0.6;
    c.add(this.add.rectangle(mx, my, w * 0.24, h * 0.42, 0x2f3a2f).setStrokeStyle(3, 0x8a6a3a));
    for (let i = 0; i < 4; i++) {
      c.add(this.add.rectangle(mx - w * 0.04, my - h * 0.13 + i * h * 0.085, w * 0.12, 2.5, 0xe8efe0, 0.85));
      c.add(this.add.rectangle(mx + w * 0.08, my - h * 0.13 + i * h * 0.085, w * 0.03, 2.5, AMBER, 0.9));
    }

    // таблички
    if (this.look.reviews) {
      c.add(this.add.rectangle(-w * 0.36, -h * 0.17, 40, 16, 0xffffff).setStrokeStyle(2, AMBER));
      c.add(this.add.text(-w * 0.36, -h * 0.17, '★ 4.9', { fontFamily: DISPLAY_FONT, fontSize: '9px', color: '#2a1b3d', fontStyle: '800' }).setOrigin(0.5));
    }
    if (this.look.night) {
      c.add(this.add.rectangle(w * 0.33, -h * 0.17, 38, 16, PLUM));
      L.add(this.add.text(w * 0.33, -h * 0.17, '24/7', { fontFamily: DISPLAY_FONT, fontSize: '9px', color: '#7ff0d0', fontStyle: '800' }).setOrigin(0.5).setName('sign247'));
    }

    // навес: полосы с фестонами
    const stripes = 8;
    const aw = w + 34;
    const sw = aw / stripes;
    const ay = -h - 18;
    for (let i = 0; i < stripes; i++) {
      const col = i % 2 ? loc.roof : 0xfffaf0;
      const x = -aw / 2 + sw * (i + 0.5);
      c.add(this.add.rectangle(x, ay, sw, 26, col));
      c.add(this.add.arc(x, ay + 13, sw / 2, 0, 180, false, col));
    }
    c.add(this.add.rectangle(0, ay - 13, aw + 6, 5, shade(loc.roof, -0.3)));

    // гирлянда по краю навеса
    for (let i = 0; i <= 12; i++) {
      const x = -aw / 2 + (aw / 12) * i;
      const y = ay + 22 + Math.sin((i / 12) * Math.PI * 6) * 3;
      const bulb = this.add.circle(x, y, 3.2, [AMBER, TOMATO, 0x7ff0d0, 0xfff4dc][i % 4]);
      L.add(bulb);
      this.bulbs.push(bulb);
    }

    // вывеска над навесом
    const signW = Math.min(w * 0.86, 210);
    c.add(this.add.rectangle(0, ay - 36, signW, 34, PLUM).setStrokeStyle(3, shade(PLUM, 0.25)));
    c.add(this.add.rectangle(-signW * 0.3, ay - 18, 3, 8, 0x5a5270));
    c.add(this.add.rectangle(signW * 0.3, ay - 18, 3, 8, 0x5a5270));
    const neon = this.add
      .text(0, ay - 36, t('neon'), { fontFamily: DISPLAY_FONT, fontSize: '19px', fontStyle: '900', color: this.look.neon ? '#ffd86b' : '#d8c8a8' })
      .setOrigin(0.5);
    if (this.look.neon) {
      neon.setShadow(0, 0, '#ff9d2e', 10, false, true);
      L.add(neon);
      this.neon = neon;
    } else c.add(neon);

    // невидимая зона для тапа поверх всего ларька
    const hit = this.add.rectangle(0, -h / 2 - 20, w + 60, h + 90, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.squash();
      this.cb.onTap(p.worldX, p.worldY);
    });
    c.add(hit);

    this.stall = c;
    this.glowLayer = L;
  }

  private squash() {
    const s = this.stallScale;
    this.tweens.killTweensOf([this.stall, this.glowLayer]);
    this.stall.setScale(s * 1.03, s * 0.94);
    this.glowLayer.setScale(s * 1.03, s * 0.94);
    this.tweens.add({ targets: [this.stall, this.glowLayer], scaleX: s, scaleY: s, duration: 220, ease: 'Back.out' });
  }

  private layout() {
    const { width, height } = this.scale;
    const loc = LOCATIONS[this.location];
    // ларёк вместе с вывеской (около 230 единиц) должен помещаться под надписями с деньгами
    const hud = document.getElementById('hud')?.offsetHeight ?? 150;
    this.stallScale = Math.min(this.unit, (width * 0.6) / (loc.width + 70), Math.max(60, this.groundY - hud - 16) / 235);
    this.stall.setPosition(this.stallX, this.groundY).setScale(this.stallScale);
    this.glowLayer.setPosition(this.stallX, this.groundY).setScale(this.stallScale);
    this.night.setSize(width, height);
    this.planCity();
    this.buildLandmark();
    this.buildLamp();
    this.steam.setPosition(this.stallX + (-loc.width * 0.1 - loc.width * 0.56 * 0.28) * this.stallScale, this.groundY - 150 * 0.83 * this.stallScale);
    this.customers.forEach((cu) => cu.root.setY(this.groundY + 4 * this.unit).setScale(this.unit));
    this.redrawWorld();
  }

  private redrawWorld() {
    const phase = (((this.clock / 1000) / DAY_SECONDS + DAY_START) % 1 + 1) % 1;
    this.drawSky(phase);
    this.drawCity();
    this.drawStreet();
    this.night.setFillStyle(0x140a2a, 0.38 * this.nightK);
    this.lampGlow.setAlpha(0.15 + 0.35 * this.nightK);
    const winGlow = this.glowLayer.getByName('winGlow') as Phaser.GameObjects.Rectangle | null;
    winGlow?.setAlpha(0.05 + 0.3 * this.nightK);
  }

  private queueX(i: number) {
    const left = this.stallX - (LOCATIONS[this.location].width / 2) * this.stallScale - 22 * this.unit;
    return left - i * 32 * this.unit;
  }

  // ---------- API для контроллера ----------

  setLocation(index: number) {
    if (index === this.location && this.stall) return;
    this.location = index;
    if (!this.sys.isActive()) return;
    this.buildStall();
    this.layout();
    this.cameras.main.flash(400, 255, 244, 220);
  }

  setLook(levels: Record<string, number>) {
    const has = (id: string) => (levels[id] ?? 0) > 0;
    const look: Look = {
      helper: has('grill_helper'),
      cashier: has('cashier'),
      spit2: has('second_spit'),
      sauce: has('sauce'),
      neon: has('sign'),
      reviews: has('reviews'),
      night: has('night_shift'),
      courier: has('courier'),
      franchise: has('franchise'),
      meme: has('meme_ads'),
      truck: has('food_truck'),
    };
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    const first = this.lookKey === '';
    this.lookKey = key;
    this.look = look;
    if (!this.sys.isActive()) return;
    this.buildStall();
    this.layout();
    if (!first) this.sparks.explode(24, this.stallX, this.groundY - 120 * this.stallScale);
  }

  setIncome(perSecond: number) {
    this.wantQueue = Phaser.Math.Clamp(1 + Math.floor(Math.log10(perSecond + 1)), 1, 7);
    this.serveEvery = perSecond > 0 ? Phaser.Math.Clamp(3000 / (1 + Math.log10(perSecond + 1)), 350, 3000) : 0;
  }

  setRush(on: boolean) {
    this.rush = on;
  }

  setCombo(combo: number, mult: number) {
    if (combo < 3) {
      this.comboText.setAlpha(0);
      return;
    }
    const u = this.unit;
    this.comboText
      .setText(`${t('combo', combo)}  ×${lang() === 'ru' ? mult.toFixed(2).replace('.', ',') : mult.toFixed(2)}`)
      .setFontSize(Math.round(15 * u + Math.min(combo, 50) * 0.12 * u))
      .setColor(combo >= 50 ? '#ffd86b' : combo >= 25 ? '#ffb02e' : '#fff4dc')
      .setPosition(this.stallX, Math.min(this.scale.height - 16 * u, this.groundY + 30 * u))
      .setAlpha(1)
      .setScale(1.25);
    this.tweens.killTweensOf(this.comboText);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 700, duration: 300 });
  }

  // Тап обслуживает первого в очереди.
  serve() {
    const first = this.customers.find((c) => c.state === 'queue');
    if (!first || Math.abs(first.root.x - this.queueX(0)) > 4) return;
    first.state = 'leaving';
    first.root.add(this.add.rectangle(10, -38, 9, 18, 0xf2e3b3).setStrokeStyle(2, 0xc8813a).setAngle(-15));
    first.root.setDepth(7);
  }

  burst(x: number, y: number, count = 6) {
    this.coins.explode(count, x, y);
  }

  popText(text: string, x: number, y: number, color = '#fff4dc') {
    const u = this.unit;
    const pop = this.add
      .text(x + Phaser.Math.Between(-12, 12), y - 20, text, { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(19 * u)}px`, color, fontStyle: '800', stroke: '#2a1b3d', strokeThickness: Math.round(5 * u) })
      .setOrigin(0.5)
      .setDepth(12);
    this.tweens.add({ targets: pop, y: pop.y - 70 * u, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => pop.destroy() });
  }

  bigText(text: string, color = '#ffd86b') {
    const u = this.unit;
    const txt = this.add
      .text(this.scale.width / 2, this.groundY - 120 * this.stallScale, text, { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(24 * u)}px`, color, fontStyle: '900', stroke: '#2a1b3d', strokeThickness: Math.round(7 * u), align: 'center', wordWrap: { width: this.scale.width * 0.9 } })
      .setOrigin(0.5)
      .setDepth(13)
      .setScale(0.3);
    this.tweens.add({ targets: txt, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 30 * u, delay: 1400, duration: 400, onComplete: () => txt.destroy() });
  }

  // Щедрый гость: золотой покупатель идёт по тротуару, его надо успеть тапнуть.
  spawnGolden() {
    if (this.golden) return;
    const u = this.unit;
    const w = this.makeWalker(0xffcf3f, 0xc98a12, 0xffe9a8, 'crown');
    w.root.setPosition(-30 * u, this.groundY + 26 * u).setScale(u * 1.1).setDepth(10);
    const glow = this.add.circle(0, -34, 36, 0xffd86b, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    w.root.addAt(glow, 0);
    this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.15, yoyo: true, repeat: -1, duration: 500 });
    const hit = this.add.rectangle(0, -34, 70, 100, 0, 0).setInteractive({ useHandCursor: true });
    w.root.add(hit);
    const g = { ...w, glow, caught: false };
    hit.on('pointerdown', () => {
      if (g.caught) return;
      g.caught = true;
      const x = g.root.x, y = g.root.y - 40 * u;
      this.sparks.explode(40, x, y);
      this.coins.explode(16, x, y);
      this.cameras.main.shake(180, 0.006);
      this.cb.onGolden(x, y);
      this.tweens.add({ targets: g.root, alpha: 0, scale: u * 1.6, duration: 300, onComplete: () => g.root.destroy() });
      this.golden = undefined;
    });
    this.golden = g;
  }

  // ---------- люди и машины ----------

  private makeWalker(shirt: number, pants: number, skin: number, hat: 'none' | 'cap' | 'beanie' | 'crown', hair = HAIR[0], tall = 1): Walker {
    const root = this.add.container(0, 0);
    const legL = this.add.rectangle(-5, -18 * tall, 7, 18 * tall, pants).setOrigin(0.5, 0);
    const legR = this.add.rectangle(5, -18 * tall, 7, 18 * tall, pants).setOrigin(0.5, 0);
    root.add([legL, legR]);
    root.add(this.add.rectangle(0, -18 * tall, 26, 30, shirt).setOrigin(0.5, 1));
    root.add(this.add.rectangle(-15, -44 * tall + 18, 6, 22, shade(shirt, -0.12)).setOrigin(0.5, 0));
    root.add(this.add.rectangle(15, -44 * tall + 18, 6, 22, shade(shirt, -0.12)).setOrigin(0.5, 0));
    const headY = -18 * tall - 30 - 11;
    root.add(this.add.circle(0, headY, 11, skin));
    root.add(this.add.circle(4, headY - 1, 1.5, PLUM));
    if (hat === 'cap') {
      root.add(this.add.rectangle(0, headY - 8, 22, 7, shirt === TOMATO ? PLUM : TOMATO));
      root.add(this.add.rectangle(10, headY - 5, 10, 3, shirt === TOMATO ? PLUM : TOMATO));
    } else if (hat === 'beanie') {
      root.add(this.add.arc(0, headY - 3, 11, 180, 360, false, shade(pants, 0.3)));
      root.add(this.add.circle(0, headY - 15, 3, CREAM));
    } else if (hat === 'crown') {
      root.add(this.add.polygon(0, headY - 13, [-9, 6, -9, -4, -4, 1, 0, -6, 4, 1, 9, -4, 9, 6], 0xffd86b).setStrokeStyle(1.5, 0xc98a12));
    } else {
      root.add(this.add.arc(0, headY - 2, 11.5, 180, 360, false, hair));
    }
    return { root, legs: [legL, legR], phase: Math.random() * 6 };
  }

  private spawnCustomer() {
    const u = this.unit;
    const hats: ('none' | 'cap' | 'beanie')[] = ['none', 'none', 'cap', 'beanie'];
    const w = this.makeWalker(
      Phaser.Utils.Array.GetRandom(SHIRTS),
      Phaser.Utils.Array.GetRandom(PANTS),
      Phaser.Utils.Array.GetRandom(SKIN),
      Phaser.Utils.Array.GetRandom(hats),
      Phaser.Utils.Array.GetRandom(HAIR),
      0.85 + Math.random() * 0.35,
    );
    w.root.setPosition(-40 * u, this.groundY + 4 * u).setScale(u).setDepth(6);
    this.customers.push({ ...w, state: 'queue' });
  }

  private animateWalk(w: Walker, moving: boolean, delta: number) {
    w.phase += delta / (moving ? 90 : 400);
    const swing = moving ? Math.sin(w.phase) * 28 : 0;
    w.legs[0].setAngle(swing);
    w.legs[1].setAngle(-swing);
  }

  private spawnCar(courier = false) {
    const u = this.unit;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const root = this.add.container(dir > 0 ? -120 * u : this.scale.width + 120 * u, this.horizonY + (this.groundY - this.horizonY) * (dir > 0 ? 0.72 : 0.32)).setDepth(3).setScale(u * (dir > 0 ? 1 : 0.85));
    let lights: Phaser.GameObjects.Ellipse;
    if (courier) {
      root.add(this.add.circle(-14, -6, 6, 0x222222));
      root.add(this.add.circle(14, -6, 6, 0x222222));
      root.add(this.add.rectangle(0, -12, 34, 5, 0x5a5270));
      root.add(this.add.rectangle(12, -28, 4, 30, 0x5a5270));
      root.add(this.add.rectangle(-4, -32, 14, 22, 0x5e9c3a));
      root.add(this.add.circle(-2, -50, 7, SKIN[1]));
      root.add(this.add.rectangle(-16, -34, 18, 18, AMBER).setStrokeStyle(2, MEAT));
      lights = this.add.ellipse(26, -22, 40, 14, 0xfff0b0, 0).setBlendMode(Phaser.BlendModes.ADD);
    } else {
      const col = Phaser.Utils.Array.GetRandom(CARS);
      root.add(this.add.rectangle(0, -14, 96, 22, col).setOrigin(0.5, 1));
      root.add(this.add.rectangle(-4, -36, 56, 18, col).setOrigin(0.5, 1));
      root.add(this.add.rectangle(-16, -38, 22, 13, 0xbfe3f2).setOrigin(0.5, 1));
      root.add(this.add.rectangle(10, -38, 22, 13, 0xbfe3f2).setOrigin(0.5, 1));
      root.add(this.add.circle(-28, -12, 9, 0x222222));
      root.add(this.add.circle(28, -12, 9, 0x222222));
      root.add(this.add.rectangle(46, -26, 6, 6, 0xfff0b0));
      lights = this.add.ellipse(80, -24, 80, 22, 0xfff0b0, 0).setBlendMode(Phaser.BlendModes.ADD);
    }
    root.add(lights);
    if (dir < 0) root.scaleX *= -1;
    this.cars.push({ root, lights, speed: dir * (courier ? 0.12 : 0.2 + Math.random() * 0.12) });
  }

  // ---------- кадр ----------

  update(_time: number, delta: number) {
    this.clock += delta;
    const u = this.unit;

    this.skyTimer -= delta;
    if (this.skyTimer <= 0) {
      this.skyTimer = 250;
      this.redrawWorld();
    }

    // вертел крутится: полосы мяса бегут вниз
    const k = (this.clock / 220) % 1;
    // полосы бегут вниз по конусу и сужаются вместе с ним
    this.meatStripes.forEach((st) => {
      const f = (st.getData('i') / 5 + k / 5) % 1;
      st.y = st.getData('top') + 3 + f * (st.getData('h') - 6);
      st.setSize(28 - 14 * f, 2.5);
    });
    const flick = 0.75 + 0.25 * Math.sin(this.clock / 90) * Math.sin(this.clock / 37);
    this.grillGlow.forEach((g) => g.setAlpha(flick));
    const grillLight = this.glowLayer.getByName('grillLight') as Phaser.GameObjects.Rectangle | null;
    grillLight?.setAlpha((0.2 + 0.5 * this.nightK) * flick);
    this.bulbs.forEach((b, i) => b.setAlpha(0.55 + 0.45 * Math.sin(this.clock / 300 + i * 1.7) * (this.nightK > 0.2 ? 1 : 0.4)));
    if (this.neon) this.neon.setAlpha(Math.random() < 0.006 ? 0.35 : 1);
    this.staff.forEach((p, i) => (p.y = p.getData('y0') + Math.sin(this.clock / 260 + i * 2) * 1.5));

    // очередь
    const line = this.customers.filter((c) => c.state === 'queue');
    const speed = WALK_SPEED * u * (this.rush ? 1.8 : 1);
    line.forEach((c, i) => {
      const dx = this.queueX(i) - c.root.x;
      const step = speed * delta;
      c.root.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
      this.animateWalk(c, Math.abs(dx) > 1, delta);
    });
    for (const c of this.customers) {
      if (c.state !== 'leaving') continue;
      c.root.x += speed * 1.2 * delta;
      c.root.y = this.groundY + 22 * u;
      this.animateWalk(c, true, delta);
      if (c.root.x > this.scale.width + 60 * u) c.root.destroy();
    }
    this.customers = this.customers.filter((c) => c.root.active);

    const want = this.rush ? 7 : this.wantQueue;
    const fits = this.queueX(line.length) > 16 * u;
    if (line.length < want && fits && Math.random() < delta / (this.rush ? 250 : 700)) this.spawnCustomer();
    if (this.serveEvery > 0) {
      this.serveTimer += delta;
      if (this.serveTimer >= this.serveEvery) {
        this.serveTimer = 0;
        this.serve();
      }
    }

    // золотой гость
    if (this.golden && !this.golden.caught) {
      this.golden.root.x += (this.scale.width / 10000) * delta; // проходит экран за 10 с
      this.animateWalk(this.golden, true, delta);
      if (Math.random() < delta / 120) this.sparks.emitParticleAt(this.golden.root.x + Phaser.Math.Between(-14, 14) * u, this.golden.root.y - Phaser.Math.Between(20, 70) * u);
      if (this.golden.root.x > this.scale.width + 50 * u) {
        this.golden.root.destroy();
        this.golden = undefined;
      }
    }

    // машины и курьер
    this.carTimer -= delta;
    if (this.carTimer <= 0) {
      this.carTimer = 3500 + Math.random() * 6000;
      this.spawnCar();
    }
    if (this.look.courier) {
      this.courierTimer -= delta;
      if (this.courierTimer <= 0) {
        this.courierTimer = 9000 + Math.random() * 8000;
        this.spawnCar(true);
      }
    }
    for (const car of this.cars) {
      car.root.x += car.speed * u * delta;
      car.lights.setAlpha(0.5 * this.nightK);
      if (car.root.x < -200 * u || car.root.x > this.scale.width + 200 * u) car.root.destroy();
    }
    this.cars = this.cars.filter((c) => c.root.active);
  }
}
