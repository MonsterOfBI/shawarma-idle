// Погода на точках: раз в несколько минут на 25–40 секунд.
// Помойка и метро — дождь, пустыня — песчаная буря, площадь — лепестки, дворец — салют.
// Всё частицами из крошечных текстур: телефон почти не замечает.

import Phaser from 'phaser';

type Kind = 'rain' | 'sand' | 'petals' | 'fireworks';

const BY_LOCATION: Record<string, Kind> = { dump: 'rain', metro: 'rain', desert: 'sand', piazza: 'petals', palace: 'fireworks' };
// первая погода через 1,5–3 минуты после запуска, дальше раз в 3–6 минут
const FIRST_MS = 90_000;
const EVERY_MS = 180_000;
const SPREAD_MS = 180_000;

export interface WeatherView {
  w: number;
  h: number;
  horizon: number;
  ground: number;
  unit: number;
}

export class Weather {
  private emitters = new Map<Kind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private veil: Phaser.GameObjects.Rectangle;
  private kind: Kind | null = null;
  private left = 0; // мс до конца текущей погоды
  private total = 1;
  private nextIn = FIRST_MS + Math.random() * FIRST_MS;
  private burstIn = 0;
  private size = '';

  constructor(private scene: Phaser.Scene) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 12);
    g.generateTexture('wx-drop', 2, 12);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
    g.generateTexture('wx-grain', 4, 4);
    g.clear();
    g.fillStyle(0xffffff, 1).fillEllipse(5, 3, 10, 6);
    g.generateTexture('wx-petal', 10, 6);
    g.destroy();
    this.veil = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0, 0).setDepth(7.5);
  }

  /** Сменилась точка: текущая погода тихо заканчивается. */
  reset() {
    this.stop();
    this.nextIn = Math.max(this.nextIn, 30_000);
  }

  update(delta: number, location: string, view: WeatherView, paused: boolean) {
    const size = `${view.w}x${view.h}`;
    if (size !== this.size) {
      this.size = size;
      this.veil.setSize(view.w, view.h);
      if (this.kind) this.start(this.kind, view);
    }
    if (paused) return;
    if (this.kind) {
      this.left -= delta;
      if (this.kind === 'fireworks') {
        this.burstIn -= delta;
        if (this.burstIn <= 0) {
          this.burstIn = 500 + Math.random() * 900;
          this.burst(view);
        }
      }
      // плавно сгущаем и рассеиваем дымку
      const k = Phaser.Math.Clamp(Math.min(this.left, this.total - this.left) / 3000, 0, 1);
      this.veil.setAlpha(k);
      if (this.left <= 0) this.stop();
      return;
    }
    this.nextIn -= delta;
    if (this.nextIn <= 0) {
      this.nextIn = EVERY_MS + Math.random() * SPREAD_MS;
      const kind = BY_LOCATION[location];
      if (kind) this.start(kind, view);
    }
  }

  private emitter(kind: Kind) {
    let e = this.emitters.get(kind);
    if (e) return e;
    const s = this.scene;
    if (kind === 'rain') {
      e = s.add.particles(0, 0, 'wx-drop', { speedY: { min: 620, max: 820 }, speedX: { min: -90, max: -60 }, rotate: 7, lifespan: 1400, alpha: { start: 0.7, end: 0.3 }, tint: 0xdbe9ff, quantity: 3, frequency: 22, emitting: false });
    } else if (kind === 'sand') {
      e = s.add.particles(0, 0, 'wx-grain', { speedX: { min: 280, max: 520 }, speedY: { min: -30, max: 40 }, lifespan: 2600, scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.8, end: 0 }, tint: [0xe8c27a, 0xd9a85a, 0xf2d9a0], quantity: 2, frequency: 30, emitting: false });
    } else if (kind === 'petals') {
      e = s.add.particles(0, 0, 'wx-petal', { speedY: { min: 40, max: 90 }, speedX: { min: -40, max: 30 }, rotate: { min: 0, max: 360 }, lifespan: 7000, scale: { min: 0.7, max: 1.3 }, alpha: { start: 0.95, end: 0.4 }, tint: [0xffb3c7, 0xffd1dc, 0xfff0f4], quantity: 1, frequency: 160, emitting: false });
    } else {
      e = s.add.particles(0, 0, 'spark', { speed: { min: 80, max: 220 }, gravityY: 120, lifespan: 1300, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: Phaser.BlendModes.ADD, emitting: false });
    }
    e.setDepth(kind === 'fireworks' ? 0.6 : 7.6);
    this.emitters.set(kind, e);
    return e;
  }

  private start(kind: Kind, v: WeatherView) {
    this.stop();
    this.kind = kind;
    this.left = this.total = 25_000 + Math.random() * 15_000;
    const e = this.emitter(kind);
    e.clearEmitZones();
    if (kind === 'rain') {
      e.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, -20, v.w + 80, 10) } as never);
      e.lifespan = { min: 900, max: 1400 } as never;
      this.veil.setFillStyle(0x24305a, 0.18);
    } else if (kind === 'sand') {
      e.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-20, v.horizon - 40 * v.unit, 10, v.ground - v.horizon + 60 * v.unit) } as never);
      this.veil.setFillStyle(0xd9a85a, 0.2);
    } else if (kind === 'petals') {
      e.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, -10, v.w, 10) } as never);
      this.veil.setFillStyle(0xffd1dc, 0.06);
    } else {
      this.veil.setFillStyle(0x140a2a, 0.12);
      this.burstIn = 0;
    }
    this.veil.setAlpha(0);
    if (kind !== 'fireworks') e.start();
  }

  // залп салюта: искры одного цвета в случайной точке неба
  private burst(v: WeatherView) {
    const e = this.emitter('fireworks');
    const colors = [0xffd86b, 0xff7ab8, 0x8ad7ff, 0xb8f08a, 0xff8a5c];
    e.setParticleTint(colors[Math.floor(Math.random() * colors.length)]);
    e.explode(26, v.w * (0.15 + Math.random() * 0.7), v.horizon * (0.2 + Math.random() * 0.45));
  }

  private stop() {
    this.kind = null;
    this.emitters.forEach((e) => e.stop());
    this.veil.setAlpha(0);
  }
}
