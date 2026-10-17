import Phaser from 'phaser';
import { pickCustomer } from '../core/brainrots';
import { LOCATIONS } from '../core/locations';
import { type Look, lookKey, lookOf } from '../core/look';
import { lang, t } from '../i18n';
import { BACKDROPS, type Ctx, type Mover, spawnCourier, spawnMover } from './backdrops';
import { drawBrainrot, type Critter } from './brainrots';
import { AMBER, CREAM, DISPLAY_FONT, OUTLINE, Pen, TOMATO, lerpColor, rng, shade } from './draw';
import { type StallParts, buildStall } from './stall';

export { DISPLAY_FONT };

// Сцена только рисует: небо со сменой дня и ночи, фон локации, ларёк, очередь брейнротов,
// Бомбардиро с мешком денег, частицы. Логика денег — в src/core, сцену дёргает src/game.ts.

// Сутки в игре длятся 8 минут. Ключевые точки неба: [фаза, верх, низ, ночь 0..1].
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
const WALK_SPEED = 0.15; // пикселей за мс при масштабе 1

export interface StallCallbacks {
  onTap(x: number, y: number): void;
  onGolden(x: number, y: number): void;
  onServed(id: string): void;
}

interface Customer {
  id: string;
  c: Critter;
  state: 'queue' | 'leaving';
  phase: number;
  bubble?: Phaser.GameObjects.Container;
  talked: boolean;
}

interface Bomber {
  c: Critter;
  y0: number;
  caught: boolean;
}

export class StallScene extends Phaser.Scene {
  private cb: StallCallbacks;
  private readyResolve!: () => void;
  readonly ready: Promise<void>;

  private location = 0;
  private look: Look = lookOf({});
  private lookKeyNow = '';
  private met = new Set<string>();

  private sky!: Phaser.GameObjects.Graphics;
  private stars!: Phaser.GameObjects.Graphics;
  private backdrop!: Pen;
  private props!: Phaser.GameObjects.Container;
  private extras!: Phaser.GameObjects.Container;
  private night!: Phaser.GameObjects.Rectangle;
  private lampGlow!: Phaser.GameObjects.Ellipse;
  private flame?: Phaser.GameObjects.Graphics;
  private starList: { x: number; y: number; r: number; tw: number }[] = [];

  private stall?: StallParts;
  private stallScale = 1;
  private hitZone!: Phaser.GameObjects.Zone;
  private steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coins!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private customers: Customer[] = [];
  private bomber?: Bomber;
  private movers: Mover[] = [];
  private moverTimer = 1500;
  private courierTimer = 5000;

  private comboText!: Phaser.GameObjects.Text;
  private serveEvery = 0;
  private serveTimer = 0;
  private wantQueue = 1;
  private rush = false;
  private nightK = 0;
  private worldTimer = 0;
  private clock = 0;
  private moving = false;

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
    return Math.round(this.groundY - Math.max(44, this.scale.height * 0.14));
  }
  private get stallX() {
    return Math.round(this.scale.width * 0.6);
  }
  private get unit() {
    return Phaser.Math.Clamp(this.scale.height / 320, 0.55, 2);
  }
  private get hudBottom() {
    const hud = document.getElementById('hud');
    return hud ? hud.offsetTop + hud.offsetHeight : 150;
  }
  private ctx(): Ctx {
    return {
      w: this.scale.width,
      h: this.scale.height,
      hy: this.horizonY,
      gy: this.groundY,
      u: this.unit,
      night: this.nightK,
      clock: this.clock,
      seed: 17 + this.location * 101,
    };
  }

  // ---------- создание ----------

  create() {
    this.makeTextures();
    this.sky = this.add.graphics().setDepth(0);
    this.stars = this.add.graphics().setDepth(0.5);
    this.backdrop = new Pen(this.add.graphics().setDepth(1), 2);
    this.props = this.add.container(0, 0).setDepth(1.5);
    this.extras = this.add.container(0, 0).setDepth(4);
    this.night = this.add.rectangle(0, 0, 10, 10, 0x140a2a, 0).setOrigin(0, 0).setDepth(8);
    this.lampGlow = this.add.ellipse(0, 0, 10, 10, 0xffc861, 0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    this.steam = this.add
      .particles(0, 0, 'puff', {
        lifespan: 1800,
        speedY: { min: -40, max: -22 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.2, end: 0.8 },
        alpha: { start: 0.22, end: 0 },
        emitting: false,
      })
      .setDepth(9.5);
    this.coins = this.add
      .particles(0, 0, 'coin', {
        lifespan: 900,
        speed: { min: 140, max: 320 },
        angle: { min: 220, max: 320 },
        gravityY: 700,
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.6 },
        emitting: false,
      })
      .setDepth(11);
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        lifespan: 700,
        speed: { min: 60, max: 220 },
        scale: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(11);
    this.confetti = this.add
      .particles(0, 0, 'confetti', {
        lifespan: 1600,
        speed: { min: 120, max: 300 },
        angle: { min: 230, max: 310 },
        gravityY: 400,
        rotate: { min: 0, max: 360 },
        tint: [TOMATO, AMBER, 0x7ff0d0, 0x5e9c3a, 0xf28cb1, CREAM],
        scale: { start: 1, end: 0.7 },
        emitting: false,
      })
      .setDepth(11);

    this.comboText = this.add
      .text(0, 0, '', { fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#fff4dc', fontStyle: '800', stroke: '#2a1b3d', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);

    this.hitZone = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(10);
    this.hitZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.squash();
      this.cb.onTap(p.worldX, p.worldY);
    });

    this.rebuildStall();
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
    g.fillStyle(0x8a5a10, 1).fillCircle(10, 10, 10);
    g.fillStyle(0xffcf3f, 1).fillCircle(10, 9, 8);
    g.fillStyle(0xffe89a, 1).fillRect(8, 4, 4, 10);
    g.generateTexture('coin', 20, 20);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.clear();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 5);
    g.generateTexture('confetti', 8, 5);
    g.destroy();
  }

  // ---------- небо и фон ----------

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
    const bands = 48;
    this.sky.clear();
    for (let j = 0; j < bands; j++) {
      this.sky.fillStyle(lerpColor(top, bottom, j / (bands - 1)), 1);
      this.sky.fillRect(0, (hy * j) / bands, width, hy / bands + 1);
    }
    this.sky.fillStyle(bottom, 1).fillRect(0, hy, width, this.scale.height - hy);

    // солнце днём, луна ночью; идут дугой по небу
    const u = this.unit;
    const sunT = (phase + 0.1) % 1;
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
    // облака днём
    const day = 1 - this.nightK;
    if (day > 0.1) {
      const r = rng(5 + this.location);
      for (let c = 0; c < 4; c++) {
        const cw = (60 + r() * 50) * u;
        const cx = ((r() * width + (this.clock / 1000) * (4 + r() * 6) * u) % (width + cw * 2)) - cw;
        const cy = hy * (0.15 + r() * 0.35);
        this.sky.fillStyle(0xffffff, 0.75 * day);
        this.sky.fillEllipse(cx, cy, cw, cw * 0.32);
        this.sky.fillEllipse(cx - cw * 0.2, cy - cw * 0.12, cw * 0.5, cw * 0.36);
        this.sky.fillEllipse(cx + cw * 0.18, cy - cw * 0.08, cw * 0.42, cw * 0.3);
      }
    }

    this.stars.clear();
    if (this.nightK > 0.3) {
      for (const s of this.starList) {
        const tw = 0.5 + 0.5 * Math.sin(this.clock / 600 + s.tw);
        this.stars.fillStyle(0xffffff, (this.nightK - 0.3) * tw).fillCircle(s.x, s.y, s.r * u);
      }
    }
  }

  private redrawWorld() {
    const phase = ((((this.clock / 1000) / DAY_SECONDS + DAY_START) % 1) + 1) % 1;
    this.drawSky(phase);
    this.backdrop.g.clear();
    BACKDROPS[LOCATIONS[this.location].id](this.backdrop, this.ctx());
    this.night.setFillStyle(0x140a2a, 0.38 * this.nightK);
    this.lampGlow.setAlpha(0.12 + 0.4 * this.nightK);
    this.stall?.winGlow.setAlpha(0.05 + 0.3 * this.nightK);
  }

  // Неподвижные предметы фона: знак метро, фонарь, а также франшиза, билборд и фудтрак.
  private buildProps() {
    this.props.removeAll(true);
    this.extras.removeAll(true);
    this.flame = undefined;
    const u = this.unit;
    const w = this.scale.width;
    const hy = this.horizonY;
    const gy = this.groundY;
    const id = LOCATIONS[this.location].id;
    if (id === 'metro') {
      this.props.add(this.add.text(w * 0.1, hy - 88 * u, 'M', { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(20 * u)}px`, color: '#e4472b', fontStyle: '900' }).setOrigin(0.5));
    }

    // фонарь слева от ларька
    const left = this.stallX + (this.stall?.left ?? -120) * this.stallScale;
    const lx = Math.max(22 * u, left - 34 * u);
    const g = this.add.graphics();
    const p = new Pen(g, 2.5);
    if (id === 'metro' || id === 'piazza') {
      const pole = id === 'piazza' ? 0x2f3a2f : 0x3a3150;
      p.rect(lx - 3 * u, gy - 130 * u, 6 * u, 130 * u, pole, 2);
      p.rect(lx - 8 * u, gy - 8 * u, 16 * u, 8 * u, pole, 2);
      if (id === 'piazza') {
        p.poly([[lx - 10 * u, gy - 130 * u], [lx + 10 * u, gy - 130 * u], [lx + 7 * u, gy - 150 * u], [lx - 7 * u, gy - 150 * u]], 0xffe2a0);
        p.poly([[lx - 12 * u, gy - 150 * u], [lx + 12 * u, gy - 150 * u], [lx, gy - 160 * u]], pole);
        this.lampGlow.setPosition(lx, gy - 100 * u);
      } else {
        p.rect(lx - 3 * u, gy - 132 * u, 30 * u, 5 * u, pole, 2);
        p.rect(lx + 16 * u, gy - 128 * u, 16 * u, 7 * u, 0xffe2a0, 3);
        this.lampGlow.setPosition(lx + 24 * u, gy - 70 * u);
      }
    } else {
      // факел тики или фонарь на шесте
      p.rect(lx - 3 * u, gy - 96 * u, 6 * u, 96 * u, 0x8a5a33, 2);
      p.poly([[lx - 9 * u, gy - 96 * u], [lx + 9 * u, gy - 96 * u], [lx + 6 * u, gy - 110 * u], [lx - 6 * u, gy - 110 * u]], id === 'desert' ? 0x9a6a3e : 0xc9b26a);
      const flame = this.add.graphics();
      flame.fillStyle(0xff8a2b, 1).fillTriangle(-7, 0, 7, 0, 0, -22);
      flame.fillStyle(0xffd86b, 1).fillTriangle(-4, 0, 4, 0, 0, -13);
      flame.setPosition(lx, gy - 110 * u).setScale(u);
      this.props.add(flame);
      this.flame = flame;
      this.lampGlow.setPosition(lx, gy - 112 * u);
    }
    this.props.addAt(g, 0);
    this.lampGlow.setSize(160 * u, 160 * u);

    const S = this.look.stages;
    if (S.franchise > 0) {
      // вторая точка вдалеке
      const fx = w * 0.32, s = 0.38 * u;
      const loc = LOCATIONS[this.location];
      const fg = this.add.graphics();
      const fp = new Pen(fg, 2);
      fp.rect(fx - 60 * s, hy - 70 * s, 120 * s, 70 * s, shade(loc.body, -0.1), 2);
      fp.rect(fx - 36 * s, hy - 56 * s, 50 * s, 30 * s, 0x3b2a4f, 0, 2);
      fp.rect(fx - 70 * s, hy - 86 * s, 140 * s, 16 * s, loc.roof, 3);
      fp.rect(fx - 40 * s, hy - 110 * s, 80 * s, 22 * s, OUTLINE, 3, 2);
      fp.flat(0xffd86b).fillRect(fx - 28 * s, hy - 101 * s, 56 * s, 5 * s);
      if (S.franchise >= 3) {
        fp.rect(fx + 70 * s, hy - 60 * s, 90 * s, 60 * s, shade(loc.body, -0.2), 2);
        fp.rect(fx + 64 * s, hy - 74 * s, 102 * s, 14 * s, loc.roof, 3);
      }
      this.props.add(fg);
    }
    if (S.meme_ads > 0) {
      // билборд с брейнротом
      const bx = w * 0.88, by = hy - 60 * u;
      const bg = this.add.graphics();
      const bp = new Pen(bg, 2.5);
      bp.rect(bx - 3 * u, by, 6 * u, 60 * u, 0x5a5270, 2);
      bp.rect(bx - 48 * u, by - 62 * u, 96 * u, 64 * u, CREAM, 6 * u, 3);
      bp.rect(bx - 44 * u, by - 58 * u, 40 * u, 56 * u, 0xffd86b, 4 * u, 0);
      this.props.add(bg);
      const star = drawBrainrot(this, 'tralalero');
      star.root.setPosition(bx - 24 * u, by - 4 * u).setScale((50 / star.height) * u);
      this.props.add(star.root);
      this.props.add(
        this.add
          .text(bx + 22 * u, by - 30 * u, t('memeBoard'), { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(8 * u)}px`, fontStyle: '900', color: '#e4472b', align: 'center' })
          .setOrigin(0.5),
      );
    }
    if (S.food_truck > 0) {
      // фудтрак у края
      const tx = Math.max(4 * u, lx - 130 * u), ty = gy - 2 * u, s = u;
      const tg = this.add.graphics();
      const tp = new Pen(tg, 2.5);
      tp.rect(tx, ty - 62 * s, 96 * s, 52 * s, AMBER, 8 * s);
      tp.rect(tx + 92 * s, ty - 46 * s, 30 * s, 36 * s, shade(AMBER, -0.15), 6 * s);
      tp.rect(tx + 98 * s, ty - 42 * s, 18 * s, 14 * s, 0xbfe3f2, 3 * s, 2);
      tp.rect(tx + 12 * s, ty - 52 * s, 50 * s, 22 * s, 0x3b2a4f, 3 * s, 2);
      for (let i = 0; i < 5; i++) tp.rect(tx + 8 * s + i * 12 * s, ty - 68 * s, 12 * s, 8 * s, i % 2 ? TOMATO : CREAM, 0, 2);
      tp.circle(tx + 22 * s, ty - 8 * s, 10 * s, OUTLINE, 0);
      tp.circle(tx + 96 * s, ty - 8 * s, 10 * s, OUTLINE, 0);
      tp.circle(tx + 22 * s, ty - 8 * s, 4 * s, 0x9a9aa8, 0);
      tp.circle(tx + 96 * s, ty - 8 * s, 4 * s, 0x9a9aa8, 0);
      this.extras.add(tg);
    }
  }

  // ---------- ларёк ----------

  private rebuildStall() {
    this.stall?.root.destroy();
    this.stall?.glow.destroy();
    this.stall = buildStall(this, this.location, this.look);
  }

  private squash(k = 1) {
    if (!this.stall) return;
    const s = this.stallScale;
    const targets = [this.stall.root, this.stall.glow];
    this.tweens.killTweensOf(targets);
    targets.forEach((o) => o.setScale(s * (1 + 0.03 * k), s * (1 - 0.06 * k)));
    this.tweens.add({ targets, scaleX: s, scaleY: s, duration: 240, ease: 'Back.out' });
  }

  private layout() {
    if (!this.stall) return;
    const { width, height } = this.scale;
    const st = this.stall;
    const room = this.groundY - this.hudBottom - 10;
    const half = Math.max(-st.left, st.right);
    this.stallScale = Math.min(this.unit, (width * 0.39) / half, Math.max(50, room) / -st.top);
    const sx = this.stallX, gy = this.groundY, s = this.stallScale;
    st.root.setPosition(sx, gy).setScale(s);
    st.glow.setPosition(sx, gy).setScale(s);
    this.hitZone.setPosition(sx + st.hit.x * s, gy + st.hit.y * s).setSize(st.hit.w * s, st.hit.h * s);
    (this.hitZone.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, st.hit.w * s, st.hit.h * s);
    this.night.setSize(width, height);
    const r = rng(17 + this.location * 101);
    this.starList = Array.from({ length: 44 }, () => ({ x: r() * width, y: r() * this.horizonY * 0.75, r: 0.6 + r() * 1.4, tw: r() * 6 }));
    this.buildProps();
    this.customers.forEach((cu) => cu.c.root.setScale(this.critterScale(cu.c)));
    this.redrawWorld();
  }

  private critterScale(c: Critter) {
    return this.unit * (68 / Math.max(70, c.height)) * Math.min(1.1, this.stallScale / this.unit + 0.15);
  }

  private queueX(i: number) {
    const left = this.stallX + (this.stall?.left ?? -120) * this.stallScale - 18 * this.unit;
    return left - i * 42 * this.unit;
  }

  // ---------- API для контроллера ----------

  setLocation(index: number, animate = false) {
    if (index === this.location && this.stall) return;
    if (!this.sys.isActive()) {
      this.location = index;
      return;
    }
    const apply = () => {
      this.location = index;
      this.customers.forEach((c) => {
        c.bubble?.destroy();
        c.c.root.destroy();
      });
      this.customers = [];
      this.movers.forEach((m) => m.root.destroy());
      this.movers = [];
      this.rebuildStall();
      this.layout();
    };
    if (!animate) {
      apply();
      return;
    }
    this.moving = true;
    this.cameras.main.fadeOut(380, 42, 27, 61);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      apply();
      this.cameras.main.fadeIn(600, 42, 27, 61);
      this.moving = false;
      this.time.delayedCall(450, () => this.celebrate(true));
    });
  }

  // Возвращает true, если ларёк заметно изменился.
  setLook(levels: Record<string, number>): boolean {
    const look = lookOf(levels);
    const key = lookKey(look);
    if (key === this.lookKeyNow) return false;
    const first = this.lookKeyNow === '';
    this.lookKeyNow = key;
    this.look = look;
    if (!this.sys.isActive() || this.moving) return !first;
    this.rebuildStall();
    this.layout();
    return !first;
  }

  setMet(ids: string[]) {
    this.met = new Set(ids);
  }

  // Эффект покупки: большой, если на ларьке появилось что-то новое.
  celebrate(big: boolean) {
    if (!this.stall) return;
    const x = this.stallX, y = this.groundY + (this.stall.top / 2) * this.stallScale;
    if (big) {
      this.confetti.explode(36, x, y);
      this.sparks.explode(26, x, y);
      this.squash(1.6);
    } else {
      this.sparks.explode(8, x, y);
      this.squash(0.6);
    }
  }

  setIncome(perSecond: number) {
    this.wantQueue = Phaser.Math.Clamp(1 + Math.floor(Math.log10(perSecond + 1)), 1, 6);
    this.serveEvery = perSecond > 0 ? Phaser.Math.Clamp(3000 / (1 + Math.log10(perSecond + 1)), 400, 3000) : 0;
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
      .setPosition(this.stallX, Math.min(this.scale.height - 16 * u, this.groundY + 32 * u))
      .setAlpha(1)
      .setScale(1.25);
    this.tweens.killTweensOf(this.comboText);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 700, duration: 300 });
  }

  // Тап обслуживает первого в очереди.
  serve() {
    const first = this.customers.find((c) => c.state === 'queue');
    if (!first || Math.abs(first.c.root.x - this.queueX(0)) > 4) return;
    first.state = 'leaving';
    first.bubble?.destroy();
    first.bubble = undefined;
    const g = this.add.graphics();
    const p = new Pen(g, 2);
    p.rect(-5, -11, 10, 22, 0xf2e3b3, 4);
    p.rect(-5, -11, 10, 7, 0xb5651d, 3, 0);
    p.flat(0x5e9c3a).fillRect(-4, -12, 3, 3);
    g.setPosition(16, -first.c.height * 0.45).setAngle(-15);
    first.c.body.add(g);
    first.c.root.setDepth(7);
    this.cb.onServed(first.id);
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
    const y = Math.max(this.hudBottom + 30 * u, this.groundY + (this.stall?.top ?? -200) * this.stallScale * 0.6);
    const txt = this.add
      .text(this.scale.width / 2, y, text, { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(24 * u)}px`, color, fontStyle: '900', stroke: '#2a1b3d', strokeThickness: Math.round(7 * u), align: 'center', wordWrap: { width: this.scale.width * 0.9 } })
      .setOrigin(0.5)
      .setDepth(13)
      .setScale(0.3);
    this.tweens.add({ targets: txt, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 30 * u, delay: 1400, duration: 400, onComplete: () => txt.destroy() });
  }

  // Бомбардиро Крокодило пролетает с мешком денег: тапни, и мешок упадёт к ларьку.
  spawnGolden() {
    if (this.bomber || this.moving) return;
    const u = this.unit;
    const c = drawBrainrot(this, 'bombardiro');
    const y0 = Phaser.Math.Clamp(this.hudBottom + 50 * u, 60 * u, this.groundY - 150 * u);
    c.root.setPosition(-90 * u, y0).setScale(u * 1.05).setDepth(10);
    const glow = this.add.circle(0, -4, 70, 0xffd86b, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    c.root.addAt(glow, 0);
    this.tweens.add({ targets: glow, scale: 1.3, alpha: 0.12, yoyo: true, repeat: -1, duration: 450 });
    const hit = this.add.rectangle(-4, 4, 150, 100, 0, 0).setInteractive({ useHandCursor: true });
    c.root.add(hit);
    const b: Bomber = { c, y0, caught: false };
    hit.on('pointerdown', () => {
      if (b.caught) return;
      b.caught = true;
      const x = c.root.x, y = c.root.y + 30 * u;
      this.sparks.explode(40, x, y);
      this.coins.explode(18, x, y);
      this.cameras.main.shake(180, 0.006);
      this.cb.onGolden(x, y);
      this.cb.onServed('bombardiro');
      this.dropBag(x, y);
      this.tweens.add({ targets: c.root, x: x + 260 * u, y: y - 160 * u, angle: -20, alpha: 0, duration: 900, ease: 'Cubic.in', onComplete: () => c.root.destroy() });
      this.bomber = undefined;
    });
    this.bomber = b;
  }

  private dropBag(x: number, y: number) {
    const u = this.unit;
    const g = this.add.graphics().setDepth(10);
    const p = new Pen(g, 2.5);
    p.circle(0, 0, 13, 0xc89b5a);
    p.poly([[-6, -12], [6, -12], [9, -19], [-9, -19]], 0xc89b5a, 2);
    p.flat(OUTLINE).fillRect(-4, -2, 8, 2.5);
    p.flat(OUTLINE).fillRect(-1.2, -6, 2.4, 11);
    g.setPosition(x, y).setScale(u);
    const ground = this.groundY + 14 * u;
    this.tweens.add({
      targets: g,
      y: ground,
      angle: 200,
      duration: 700,
      ease: 'Quad.in',
      onComplete: () => {
        this.coins.explode(22, g.x, ground - 10 * u);
        this.confetti.explode(16, g.x, ground - 10 * u);
        g.destroy();
      },
    });
  }

  // Портреты брейнротов для коллекции: рисуем каждого в текстуру и отдаём картинку.
  portraits(ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    return Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const size = 120;
            const c = drawBrainrot(this, id);
            const wide = id === 'bombardiro';
            const sc = wide ? 0.82 : Math.min(1, 100 / c.height);
            c.root.setScale(sc);
            const rt = this.add.renderTexture(-500, -500, size, size).setVisible(false);
            rt.draw(c.root, size / 2 + (wide ? 4 : -2), wide ? size / 2 + 6 : size - 8);
            c.root.destroy();
            rt.snapshot((img) => {
              out[id] = (img as HTMLImageElement).src;
              rt.destroy();
              resolve();
            });
          }),
      ),
    ).then(() => out);
  }

  // ---------- очередь ----------

  private spawnCustomer() {
    const id = pickCustomer(this.location, Math.random());
    const c = drawBrainrot(this, id);
    c.root.setPosition(-50 * this.unit, this.groundY + 4 * this.unit).setScale(this.critterScale(c)).setDepth(6);
    this.customers.push({ id, c, state: 'queue', phase: Math.random() * 6, talked: false });
  }

  private say(cu: Customer) {
    const u = this.unit;
    const isNew = !this.met.has(cu.id);
    const text = isNew ? `${t('newGuest')}\n${t(`br_${cu.id}`)}` : t(`brs_${cu.id}`);
    const label = this.add
      .text(0, 0, text, { fontFamily: '"Golos Text", system-ui, sans-serif', fontSize: `${Math.round(11 * u)}px`, fontStyle: '700', color: '#2a1b3d', align: 'center', wordWrap: { width: 130 * u } })
      .setOrigin(0.5);
    const bw = label.width + 16 * u, bh = label.height + 10 * u;
    const fill = isNew ? 0xffd86b : 0xffffff;
    const g = this.add.graphics();
    g.fillStyle(fill, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8 * u);
    g.lineStyle(2.5, OUTLINE, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8 * u);
    g.fillStyle(fill, 1).fillTriangle(-6 * u, bh / 2 - 1.5, 6 * u, bh / 2 - 1.5, 0, bh / 2 + 8 * u);
    g.lineStyle(2.5, OUTLINE, 1).lineBetween(-6 * u, bh / 2, 0, bh / 2 + 8 * u).lineBetween(6 * u, bh / 2, 0, bh / 2 + 8 * u);
    const bubble = this.add.container(0, 0, [g, label]).setDepth(12).setScale(0.2);
    bubble.setData('h', bh);
    cu.bubble = bubble;
    this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: 'Back.out' });
    this.time.delayedCall(isNew ? 2600 : 1800, () => {
      if (cu.bubble !== bubble) return;
      this.tweens.add({ targets: bubble, alpha: 0, duration: 200, onComplete: () => bubble.destroy() });
      cu.bubble = undefined;
    });
  }

  private animateWalk(cu: { c: Critter; phase: number }, moving: boolean, delta: number) {
    cu.phase += delta / (moving ? 85 : 420);
    const swing = moving ? Math.sin(cu.phase) * 26 : 0;
    const [l, r] = cu.c.legs;
    l?.setAngle(swing);
    r?.setAngle(-swing);
    cu.c.body.y = moving ? -Math.abs(Math.sin(cu.phase)) * 3 : Math.sin(cu.phase) * 1.2;
  }

  // ---------- кадр ----------

  update(_time: number, delta: number) {
    this.clock += delta;
    const u = this.unit;
    const st = this.stall;
    if (!st) return;

    this.worldTimer -= delta;
    if (this.worldTimer <= 0) {
      this.worldTimer = 100;
      this.redrawWorld();
    }

    // вертел крутится: полосы мяса бегут вниз и сужаются вместе с конусом
    const k = (this.clock / 220) % 1;
    st.stripes.forEach((s) => {
      const f = (s.getData('i') / 5 + k / 5) % 1;
      s.y = s.getData('top') + 3 + f * (s.getData('h') - 6);
      s.setSize(28 - 14 * f, 2.5);
    });
    const flick = 0.75 + 0.25 * Math.sin(this.clock / 90) * Math.sin(this.clock / 37);
    st.heaters.forEach((g) => g.setAlpha(flick));
    st.pulses.forEach((p, i) => (p as Phaser.GameObjects.Arc).setAlpha((0.2 + 0.4 * this.nightK) * (0.7 + 0.3 * Math.sin(this.clock / 350 + i))));
    st.bulbs.forEach((b, i) => b.setAlpha(0.6 + 0.4 * Math.sin(this.clock / 300 + i * 1.7) * (this.nightK > 0.2 ? 1 : 0.3)));
    st.beams.forEach((b, i) => {
      b.setRotation(Math.sin(this.clock / 1600 + i * 2) * 0.35 + (i ? 0.15 : -0.15));
      b.setAlpha(this.nightK);
    });
    if (st.neon) st.neon.setAlpha(Math.random() < 0.006 ? 0.35 : 1);
    if (st.flag) st.flag.setRotation(Math.sin(this.clock / 400) * 0.04);
    st.staff.forEach((c, i) => {
      c.root.y = c.root.getData('y0') + Math.sin(this.clock / 260 + i * 2) * 1.5;
      c.body.setRotation(Math.sin(this.clock / 500 + i) * 0.05);
    });
    if (this.flame) this.flame.setScale(u * (0.9 + 0.15 * Math.sin(this.clock / 70)), u * (0.9 + 0.2 * Math.sin(this.clock / 53)));
    // пар над вертелом
    if (Math.random() < delta / 260) {
      const sp = Phaser.Utils.Array.GetRandom(st.steam);
      this.steam.emitParticleAt(this.stallX + sp.x * this.stallScale, this.groundY + sp.y * this.stallScale);
    }

    // очередь
    const line = this.customers.filter((c) => c.state === 'queue');
    const speed = WALK_SPEED * u * (this.rush ? 1.8 : 1);
    line.forEach((c, i) => {
      const dx = this.queueX(i) - c.c.root.x;
      const step = speed * delta;
      c.c.root.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
      const arrived = Math.abs(dx) <= 1;
      this.animateWalk(c, !arrived, delta);
      if (arrived && i === 0 && !c.talked) {
        c.talked = true;
        if (!this.met.has(c.id) || Math.random() < 0.35) this.say(c);
      }
    });
    for (const c of this.customers) {
      if (c.bubble) c.bubble.setPosition(c.c.root.x + 6 * u, c.c.root.y - c.c.height * c.c.root.scaleY - (c.bubble.getData('h') / 2 + 12 * u));
      if (c.state !== 'leaving') continue;
      c.c.root.x += speed * 1.2 * delta;
      c.c.root.y = this.groundY + 22 * u;
      this.animateWalk(c, true, delta);
      if (c.c.root.x > this.scale.width + 70 * u) c.c.root.destroy();
    }
    this.customers = this.customers.filter((c) => c.c.root.active);

    const want = this.rush ? 7 : this.wantQueue;
    const fits = this.queueX(line.length) > 14 * u;
    if (line.length < want && fits && !this.moving && Math.random() < delta / (this.rush ? 250 : 700)) this.spawnCustomer();
    if (this.serveEvery > 0) {
      this.serveTimer += delta;
      if (this.serveTimer >= this.serveEvery) {
        this.serveTimer = 0;
        this.serve();
      }
    }

    // Бомбардиро
    const b = this.bomber;
    if (b && !b.caught) {
      b.c.root.x += (this.scale.width / 10000) * delta;
      b.c.root.y = b.y0 + Math.sin(this.clock / 300) * 8 * u;
      b.c.root.setRotation(Math.sin(this.clock / 300 + 1) * 0.05);
      if (Math.random() < delta / 120) this.sparks.emitParticleAt(b.c.root.x - 40 * u, b.c.root.y + Phaser.Math.Between(-10, 20) * u);
      if (b.c.root.x > this.scale.width + 120 * u) {
        b.c.root.destroy();
        this.bomber = undefined;
      }
    }

    // фон: машины, лодки, попугаи, веспы; курьер, если нанят
    const locId = LOCATIONS[this.location].id;
    this.moverTimer -= delta;
    if (this.moverTimer <= 0) {
      this.moverTimer = 3500 + Math.random() * 6000;
      const m = spawnMover(this, locId, this.ctx());
      m.root.setDepth(locId === 'jungle' ? 1.6 : 3);
      this.movers.push(m);
    }
    if (this.look.stages.courier > 0) {
      this.courierTimer -= delta;
      if (this.courierTimer <= 0) {
        this.courierTimer = 9000 + Math.random() * 8000;
        const m = spawnCourier(this, this.ctx());
        m.root.setDepth(7.5);
        m.root.y = this.groundY + 30 * u;
        this.movers.push(m);
      }
    }
    for (const m of this.movers) {
      m.root.x += m.speed * this.scale.width * (delta / 1000);
      if (m.bob !== undefined) {
        m.bob += delta / 400;
        m.root.y += Math.sin(m.bob) * 0.15 * u;
        if (locId === 'desert') m.root.rotation += m.speed * delta * 0.02;
      }
      m.lights?.setAlpha(0.5 * this.nightK);
      if (m.root.x < -220 * u || m.root.x > this.scale.width + 220 * u) m.root.destroy();
    }
    this.movers = this.movers.filter((m) => m.root.active);
  }
}
