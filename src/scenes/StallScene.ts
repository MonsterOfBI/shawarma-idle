import Phaser from 'phaser';
import { LOCATIONS } from '../core/locations';

// Сцена только рисует: ларёк, очередь покупателей, всплывающие суммы.
// Вся логика денег живёт в src/core, а сцену дёргает контроллер из src/game.ts.

const SKY = 0xf4ede4;
const GROUND = 0xe4d8c8;
const DARK = 0x2b2a35;
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0x3d6fb6, 0x2f9e6b, 0xe2583e, 0x8a4fbf, 0xf2b134, 0x4aa3a2, 0xd9667b];

interface Customer {
  body: Phaser.GameObjects.Container;
  state: 'queue' | 'leaving';
}

const WALK_SPEED = 0.16; // пикселей за мс при масштабе 1

export interface StallCallbacks {
  onTap(x: number, y: number): void;
}

export class StallScene extends Phaser.Scene {
  private stall!: Phaser.GameObjects.Container;
  private stallHit!: Phaser.GameObjects.Rectangle;
  private ground!: Phaser.GameObjects.Rectangle;
  private customers: Customer[] = [];
  private location = 0;
  private serveEvery = 0; // мс между автоматическими продажами; 0 — помощников нет
  private serveTimer = 0;
  private wantQueue = 1;
  private cb: StallCallbacks;
  private readyResolve!: () => void;
  readonly ready: Promise<void>;

  constructor(cb: StallCallbacks) {
    super('stall');
    this.cb = cb;
    this.ready = new Promise((r) => (this.readyResolve = r));
  }

  private get groundY() {
    return Math.round(this.scale.height * 0.82);
  }

  private get stallX() {
    return Math.round(this.scale.width * 0.62);
  }

  private get unit() {
    // масштаб фигур под высоту области
    return Phaser.Math.Clamp(this.scale.height / 300, 0.55, 2);
  }

  create() {
    this.cameras.main.setBackgroundColor(SKY);
    this.ground = this.add.rectangle(0, 0, 10, 10, GROUND).setOrigin(0, 0);
    this.buildStall();
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.input.keyboard?.on('keydown-SPACE', () => this.cb.onTap(this.stallX, this.groundY - 120 * this.unit));
    this.readyResolve();
  }

  private buildStall() {
    this.stall?.destroy();
    const loc = LOCATIONS[this.location];
    const w = loc.width;
    const h = 150;
    const c = this.add.container(0, 0);
    // корпус
    c.add(this.add.rectangle(0, -h / 2, w, h, loc.body));
    // окно выдачи с грилем
    c.add(this.add.rectangle(-w * 0.12, -h * 0.55, w * 0.5, h * 0.45, DARK));
    const spit = this.add.rectangle(-w * 0.12, -h * 0.55, 14, h * 0.36, 0xc8813a);
    c.add(spit);
    this.tweens.add({ targets: spit, scaleX: 0.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // прилавок
    c.add(this.add.rectangle(0, -h * 0.28, w + 16, 10, 0xf4ede4));
    // полосатый навес
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const sw = (w + 30) / stripes;
      c.add(this.add.rectangle(-(w + 30) / 2 + sw * (i + 0.5), -h - 14, sw, 28, i % 2 ? loc.roof : 0xffffff));
    }
    // вывеска
    c.add(this.add.rectangle(w * 0.28, -h * 0.55, w * 0.3, h * 0.3, loc.roof));
    c.add(this.add.rectangle(w * 0.28, -h * 0.55, 16, 34, 0xf2e3b3).setStrokeStyle(3, 0xc8813a).setAngle(-30));
    // невидимая зона для тапа поверх всего ларька
    this.stallHit = this.add.rectangle(0, -h / 2 - 10, w + 40, h + 50, 0x000000, 0).setInteractive({ useHandCursor: true });
    this.stallHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.tweens.add({ targets: c, scaleY: c.scaleY * 0.95, duration: 50, yoyo: true });
      this.cb.onTap(p.worldX, p.worldY);
    });
    c.add(this.stallHit);
    this.stall = c;
  }

  private layout() {
    const { width, height } = this.scale;
    this.ground.setPosition(0, this.groundY).setSize(width, height - this.groundY);
    const u = this.unit;
    const fit = Math.min(u, (width * 0.55) / (LOCATIONS[this.location].width + 40));
    this.stall.setPosition(this.stallX, this.groundY).setScale(fit);
    this.customers.forEach((cu) => cu.body.setY(this.groundY).setScale(u));
  }

  private queueX(i: number) {
    const left = this.stallX - (LOCATIONS[this.location].width / 2) * Math.min(this.unit, this.stall.scaleX) - 18 * this.unit;
    return left - i * 34 * this.unit;
  }

  setLocation(index: number) {
    if (index === this.location && this.stall) return;
    this.location = index;
    if (!this.sys.isActive()) return;
    this.buildStall();
    this.layout();
    this.cameras.main.flash(300, 255, 255, 255);
  }

  // Чем больше доход, тем длиннее очередь и тем чаще помощники обслуживают сами.
  setIncome(perSecond: number) {
    this.wantQueue = Phaser.Math.Clamp(1 + Math.floor(Math.log10(perSecond + 1)), 1, 6);
    this.serveEvery = perSecond > 0 ? Phaser.Math.Clamp(3000 / (1 + Math.log10(perSecond + 1)), 350, 3000) : 0;
  }

  // Тап обслуживает первого в очереди.
  serve() {
    // обслуживаем первого, только если он уже дошёл до прилавка
    const first = this.customers.find((c) => c.state === 'queue');
    if (!first || Math.abs(first.body.x - this.queueX(0)) > 4) return;
    first.state = 'leaving';
    const wrap = this.add.rectangle(0, -40, 10, 18, 0xf2e3b3).setStrokeStyle(2, 0xc8813a);
    first.body.add(wrap);
    this.tweens.add({
      targets: first.body,
      x: this.scale.width + 60,
      duration: 1400,
      onComplete: () => {
        first.body.destroy();
        this.customers = this.customers.filter((c) => c !== first);
      },
    });
  }

  popText(text: string, x: number, y: number, color = '#2b2a35') {
    const pop = this.add
      .text(x, y - 20, text, { fontFamily: 'Nunito, system-ui, sans-serif', fontSize: `${Math.round(22 * this.unit)}px`, color, fontStyle: '800' })
      .setOrigin(0.5);
    this.tweens.add({ targets: pop, y: pop.y - 60 * this.unit, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
  }

  private spawnCustomer() {
    const u = this.unit;
    const c = this.add.container(-40, this.groundY).setScale(u);
    c.add(this.add.rectangle(0, -22, 26, 40, Phaser.Utils.Array.GetRandom(SHIRTS)).setOrigin(0.5));
    c.add(this.add.circle(0, -54, 12, Phaser.Utils.Array.GetRandom(SKIN)));
    this.customers.push({ body: c, state: 'queue' });
  }

  update(_time: number, delta: number) {
    // каждый в очереди идёт к своему месту; места пересчитываются, когда кто-то уходит
    const line = this.customers.filter((c) => c.state === 'queue');
    line.forEach((c, i) => {
      const dx = this.queueX(i) - c.body.x;
      const step = WALK_SPEED * this.unit * delta;
      c.body.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    });
    const inLine = line.length;
    // очередь не длиннее, чем помещается слева от ларька
    const fits = this.queueX(inLine) > 16 * this.unit;
    if (inLine < this.wantQueue && fits && Math.random() < delta / 700) this.spawnCustomer();
    if (this.serveEvery > 0) {
      this.serveTimer += delta;
      if (this.serveTimer >= this.serveEvery) {
        this.serveTimer = 0;
        this.serve();
      }
    }
  }
}
