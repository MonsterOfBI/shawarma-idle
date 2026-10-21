import Phaser from 'phaser';
import { pickCustomer } from '../core/brainrots';
import { LOCATIONS } from '../core/locations';
import { type Look, lookChanges, lookKey, lookOf, maxLook } from '../core/look';
import { sfx } from '../audio';
import { lang, t } from '../i18n';
import { BACKDROPS, type Ctx, type Mover, spawnCourier, spawnMover } from './backdrops';
import { drawBrainrot, drawMascot, setBakeRes, type Critter } from './brainrots';
import { DISPLAY_FONT, OUTLINE, Pen, fitText, rng } from './draw';
import { type StallParts, buildStall } from './stall';
import { Weather } from './weather';
import { bake, dropTexture } from './bake';
import { DAY_SECONDS, DAY_START, paintSky, skyNight } from './sky';
import { makeSceneTextures } from './textures';
import { makeEmitters } from './effects';
import { guardLostTouches } from './touch';
import { buildProps } from './props';
import { placePreview, portraits } from './snapshots';

export { DISPLAY_FONT };

// Сцена только рисует: небо со сменой дня и ночи, фон локации, ларёк, очередь брейнротов,
// Бомбардиро с мешком денег, частицы. Логика денег — в src/core, сцену дёргает src/game.ts.

const WALK_SPEED = 0.15; // пикселей за мс при масштабе 1

export interface StallCallbacks {
  onTap(x: number, y: number): void;
  onGolden(x: number, y: number): void;
  onServed(id: string, x: number, y: number): void;
  onCoin(): void; // монетка долетела до кошелька в шапке
}

interface Customer {
  id: string;
  c: Critter;
  state: 'queue' | 'leaving';
  phase: number;
  vx: number; // скорость, пикселей за мс: разгоняются и тормозят плавно
  tx?: number; // куда идёт в очереди
  wait: number; // мс до шага вперёд: очередь трогается волной, а не вся разом
  bubble?: Phaser.GameObjects.Container;
  talked: boolean;
  jump: number; // прыжок радости после покупки: от 1 до 0
}

interface PetSprite {
  id: string;
  c: Critter;
  aura?: Phaser.GameObjects.Arc;
  phase: number;
  slot: number;
}

// Три лучших питомца стоят аккуратным рядком в правом нижнем углу, середина улицы свободна.
// В левом нижнем углу — маскот-зазывала, если его наняли.
const PET_SLOTS = [0.94, 0.85, 0.76];
const MASCOT_X = 0.15;

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
  private weather!: Weather;
  private look: Look = lookOf({});
  private lookKeyNow = '';
  private met = new Set<string>();

  private sky!: Phaser.GameObjects.Graphics;
  // небо со звёздами и облаками рисуется в текстуру 10 раз в секунду, а не пересчитывается каждый кадр
  private skyRT!: Phaser.GameObjects.RenderTexture;
  private backdrop!: Pen;
  private backdropRT!: Phaser.GameObjects.RenderTexture;
  private backdropKey = '';
  private backdropNight = -1;
  private props!: Phaser.GameObjects.Container;
  private extras!: Phaser.GameObjects.Container;
  private night!: Phaser.GameObjects.Rectangle;
  private lampGlow!: Phaser.GameObjects.Ellipse;
  private flame?: Phaser.GameObjects.Graphics;
  private starList: { img: Phaser.GameObjects.Image; tw: number }[] = [];
  private clouds: { img: Phaser.GameObjects.Image; x0: number; v: number; w: number }[] = [];
  private skyAt = -1e9; // когда последний раз перерисовывали небо (мс игрового времени)

  private stall?: StallParts;
  private stallScale = 1;
  private hitZone!: Phaser.GameObjects.Zone;
  private steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  private coins!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private customers: Customer[] = [];
  private pets: PetSprite[] = [];
  private petKey = '';
  // маскот-зазывала Тунг Тунг на переднем плане
  private mascot!: Critter;
  private mascotBubble?: Phaser.GameObjects.Container;
  private mascotPhase = 0;
  private goldRain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainTimer = 0;
  private mascotLevel = -1;
  private mascotJump = 0;
  private barkIn = 3500;
  private barkN = 0;
  private moveX = 0; // во сколько раз больше денег на следующей точке, 0 — переезд ещё не готов
  private hints: string[] = [];
  private bomber?: Bomber;
  private movers: Mover[] = [];
  private moverTimer = 1500;
  private courierTimer = 5000;

  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  // надписи «+N ₽» и летящие в кошелёк монеты берутся из запаса, а не создаются на каждый тап
  private pops: Phaser.GameObjects.Text[] = [];
  private flying: Phaser.GameObjects.Image[] = [];
  private walletXY = { x: 0, y: 0 };
  private walletAt = -1e9;
  private growT = 1; // ларёк «дорастает» после покупки, которая его изменила: от 0 до 1
  private comboText!: Phaser.GameObjects.Text;
  private recordText!: Phaser.GameObjects.Text;
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
    return Math.round(this.scale.width * (LOCATIONS[this.location]?.id === 'palace' ? 0.56 : 0.6));
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
    makeSceneTextures(this);
    this.weather = new Weather(this);
    // сочнее цвета всей улицы: чуть больше насыщенности и контраста (только WebGL)
    if (this.renderer.type === Phaser.WEBGL) {
      const fx = this.cameras.main.postFX?.addColorMatrix();
      fx?.saturate(0.28);
      fx?.contrast(0.06, true);
      fx?.brightness(1.05, true);
    }
    this.sky = this.make.graphics({}, false);
    this.skyRT = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setDepth(0);
    // облака и звёзды — обычные картинки: двигаются каждый кадр почти бесплатно
    this.clouds = Array.from({ length: 4 }, () => ({ img: this.add.image(0, 0, 'cloud').setDepth(0.4), x0: 0, v: 0, w: 0 }));
    // Фон рисуется в текстуру и только потом на экран: тысячи фигур фона
    // не пересчитываются каждый кадр, а только при перерисовке мира.
    this.backdrop = new Pen(this.make.graphics({}, false), 2);
    this.backdropRT = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setDepth(1);
    this.props = this.add.container(0, 0).setDepth(1.5);
    this.extras = this.add.container(0, 0).setDepth(4);
    this.night = this.add.rectangle(0, 0, 10, 10, 0x140a2a, 0).setOrigin(0, 0).setDepth(8);
    this.lampGlow = this.add.ellipse(0, 0, 10, 10, 0xffc861, 0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

    ({ steam: this.steam, coins: this.coins, sparks: this.sparks, confetti: this.confetti, dust: this.dust, goldRain: this.goldRain } = makeEmitters(this));

    this.comboText = this.add
      .text(0, 0, '', { fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#fff4dc', fontStyle: '800', stroke: '#2a1b3d', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);
    this.recordText = this.add
      .text(0, 0, '', { fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#ffd86b', fontStyle: '900', stroke: '#2a1b3d', strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(12)
      .setAlpha(0);

    // Тапать можно по всей улице, а не только по ларьку. Несколько пальцев сразу тоже считаются.
    // Если палец попал в Бомбардиро или маскота, тап достаётся им.
    this.hitZone = this.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(10);
    this.input.addPointer(3);
    this.input.setDefaultCursor('pointer');
    // потерянные касания освобождаются перед новым тапом (см. touch.ts)
    guardLostTouches(this.input);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o !== this.hitZone)) return;
      if (this.overMascot(p.worldX, p.worldY)) this.poke();
      this.squash(over.length ? 1 : 0.5);
      this.cb.onTap(p.worldX, p.worldY);
    });

    this.buildMascot(0);
    this.mascotLevel = -1; // первое значение придёт из сохранения без праздника

    this.rebuildStall();
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.input.keyboard?.on('keydown-SPACE', () => this.cb.onTap(this.stallX, this.groundY - 110 * this.stallScale));
    // для замеров в режиме разработки: сцена доступна из консоли браузера
    if (import.meta.env.DEV) (window as unknown as { __scene: StallScene }).__scene = this;
    this.readyResolve();
  }

  // ---------- небо и фон ----------

  private drawSky(phase: number) {
    this.nightK = paintSky(this.sky, phase, this.scale.width, this.scale.height, this.horizonY, this.unit);
    this.skyAt = this.clock;
  }

  // Облака плывут, звёзды мерцают: каждый кадр двигаем готовые картинки, ничего не перерисовывая.
  private animateSky() {
    const u = this.unit;
    const w = this.scale.width;
    const day = 1 - this.nightK;
    for (const c of this.clouds) {
      c.img.setVisible(day > 0.1);
      if (day <= 0.1) continue;
      const span = w + c.w * 2;
      c.img.setPosition(((((c.x0 + (this.clock / 1000) * c.v * u) % span) + span) % span) - c.w, c.img.y).setAlpha(0.75 * day);
    }
    const on = this.nightK > 0.3;
    for (const st of this.starList) {
      st.img.setVisible(on);
      if (on) st.img.setAlpha((this.nightK - 0.3) * (0.5 + 0.5 * Math.sin(this.clock / 600 + st.tw)));
    }
  }

  // RenderTexture.resize в Phaser 3.90 не пересоздаёт текстуру видеокарты: после поворота телефона
  // или изменения окна фон растягивался или рисовался только в углу. Поэтому при новом размере
  // создаём текстуру заново на том же месте.
  private freshRT(old: Phaser.GameObjects.RenderTexture, w: number, h: number) {
    const rt = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(old.depth);
    this.children.moveAbove(rt as never, old as never);
    old.destroy();
    return rt;
  }

  private redrawWorld() {
    const phase = ((((this.clock / 1000) / DAY_SECONDS + DAY_START) % 1) + 1) % 1;
    // градиент неба, солнце и луна меняются медленно: в текстуру раз в полсекунды
    const { width: sw, height: sh } = this.scale;
    const resized = this.skyRT.width !== sw || this.skyRT.height !== sh;
    if (resized || this.clock - this.skyAt >= 500) {
      this.drawSky(phase);
      if (resized) this.skyRT = this.freshRT(this.skyRT, sw, sh);
      this.skyRT.clear().draw(this.sky);
    } else this.nightK = skyNight(phase);
    // Фон — десятки тысяч фигур. Перерисовываем его, только когда заметно сменился свет
    // (рассвет и закат) или размер экрана и точка. Днём и ночью он стоит готовой картинкой.
    const { width, height } = this.scale;
    const key = `${this.location}:${width}x${height}:${this.horizonY}:${this.groundY}`;
    if (key !== this.backdropKey || Math.abs(this.nightK - this.backdropNight) >= 0.03) {
      this.backdropKey = key;
      this.backdropNight = this.nightK;
      this.backdrop.g.clear();
      BACKDROPS[LOCATIONS[this.location].id](this.backdrop, this.ctx());
      if (this.backdropRT.width !== width || this.backdropRT.height !== height) this.backdropRT = this.freshRT(this.backdropRT, width, height);
      this.backdropRT.clear().draw(this.backdrop.g);
      this.backdrop.g.clear();
    }
    this.night.setFillStyle(0x1a1450, 0.2 * this.nightK);
    this.lampGlow.setAlpha(0.12 + 0.4 * this.nightK);
    this.stall?.winGlow.setAlpha(0.05 + 0.3 * this.nightK);
  }

  // Неподвижные предметы фона (props.ts): знак метро, фонарь, франшиза, билборд и фудтрак.
  private propsBaked: string[] = [];
  private propAnchors: Record<string, { x: number; y: number }> = {};
  private buildProps() {
    this.props.removeAll(true);
    this.extras.removeAll(true);
    this.propsBaked.forEach((k) => this.textures.exists(k) && this.textures.remove(k));
    const r = buildProps(this, {
      props: this.props,
      extras: this.extras,
      lampGlow: this.lampGlow,
      u: this.unit,
      w: this.scale.width,
      hy: this.horizonY,
      gy: this.groundY,
      location: this.location,
      look: this.look,
      stallX: this.stallX,
      stall: this.stall,
      stallScale: this.stallScale,
      safe: this.rightSafe(this.scale.width),
      hudBottom: this.hudBottom,
      res: this.resFor(this.unit),
    });
    this.flame = r.flame;
    this.propsBaked = r.baked;
    this.propAnchors = r.anchors;
  }

  // ---------- ларёк ----------

  private stallRes = 0;
  // подробность запекания под нынешний размер на экране (шаг 0,5, от 1 до 3)
  private resFor(scale: number) {
    return Math.min(3, Math.max(1, Math.ceil(scale * 2) / 2));
  }

  // Размер ларька на максимуме для каждой точки: по нему выбираем масштаб,
  // поэтому маленький ларёк на экране маленький и растёт с улучшениями, а не сжимается.
  private refExt = new Map<number, { half: number; top: number }>();
  private refFor(location: number) {
    let r = this.refExt.get(location);
    if (!r) {
      const st = buildStall(this, location, maxLook(), 1, true);
      r = { half: Math.max(-st.left, st.right), top: st.top };
      st.root.destroy();
      st.glow.destroy();
      this.refExt.set(location, r);
    }
    return r;
  }

  private rebuildStall() {
    const old = this.stall;
    old?.root.destroy();
    old?.glow.destroy();
    old?.baked.forEach((k) => this.textures.exists(k) && this.textures.remove(k));
    this.stallRes = this.resFor(this.stallScale || this.unit);
    this.stall = buildStall(this, this.location, this.look, this.stallRes);
  }

  // Ларёк «приседает» от тапа как пружина: частые тапы не дёргают его рывками, а копятся и плавно отпускают.
  private squashTarget = 0;
  private squashNow = 0;
  private squash(k = 1) {
    this.squashTarget = Math.min(1.6, this.squashTarget + k * 0.7);
  }

  private animateSquash(delta: number) {
    if (!this.stall) return;
    this.squashTarget *= Math.exp(-delta / 110);
    this.squashNow += (this.squashTarget - this.squashNow) * Math.min(1, delta / 45);
    const a = this.squashNow, s = this.stallScale;
    // после перестройки ларёк вырастает из земли с небольшим перелётом
    let gx = 1, gy = 1;
    if (this.growT < 1) {
      this.growT = Math.min(1, this.growT + delta / 620);
      const k = Phaser.Math.Easing.Back.Out(this.growT, 2.2);
      gx = 0.9 + 0.1 * k;
      gy = 0.72 + 0.28 * k;
    }
    for (const o of [this.stall.root, this.stall.glow]) o.setScale(s * (1 + 0.025 * a) * gx, s * (1 - 0.045 * a) * gy);
  }

  private layout() {
    if (!this.stall) return;
    const { width, height } = this.scale;
    const st = this.stall;
    const room = this.groundY - this.hudBottom - 10;
    // запас 12 %: пока ларёк маленький, он чуть крупнее «полного» масштаба, но всё равно заметно меньше готового
    const ref = this.refFor(this.location);
    const half = Math.max(Math.max(-st.left, st.right), ref.half / 1.12);
    const topRef = Math.min(st.top, ref.top / 1.12);
    // нищая коробка нарочно мелкая, дворец — во весь экран
    const id = LOCATIONS[this.location].id;
    const k = id === 'dump' ? 0.8 : 1;
    const frac = id === 'palace' ? 0.48 : 0.45;
    // над ларьком нужно место для рекламного щита, иначе щит налезает на вывеску
    const fit = (r: number) => k * Math.min(this.unit, (width * frac) / half, Math.max(50, r) / -topRef);
    let s0 = fit(room);
    // (только если верх ларька доходит до щита по ширине)
    if (this.look.stages.meme_ads > 0 && this.stallX + st.signR * s0 > this.rightSafe(width) - 62 * this.unit) s0 = fit(room - 56 * this.unit);
    // правый край не заходит под боковые кнопки на той же высоте и не вылезает за экран
    const right = Math.max(st.right, ref.half / 1.12);
    // (кнопки, что висят выше основной части ларька, не мешают: на телефоне они над крышей)
    const bodyY = this.groundY + topRef * s0 * 0.6;
    let limit = width - 6 * this.unit;
    this.sideAt = -1e9;
    for (const r of this.sideRects()) if (r.l > width / 2 && r.b > bodyY) limit = Math.min(limit, r.l - 4 * this.unit);
    if (this.stallX + right * s0 > limit) s0 = Math.max(0.2, (limit - this.stallX) / right);
    this.stallScale = s0;
    setBakeRes(this.resFor(this.unit * 1.3));
    // ларёк заметно вырос или уменьшился — перезапекаем его в нужной чёткости
    if (this.resFor(this.stallScale) !== this.stallRes) {
      this.rebuildStall();
      this.layout();
      return;
    }
    const sx = this.stallX, gy = this.groundY, s = this.stallScale;
    st.root.setPosition(sx, gy).setScale(s);
    st.glow.setPosition(sx, gy).setScale(s);
    this.hitZone.setPosition(sx + st.hit.x * s, gy + st.hit.y * s).setSize(st.hit.w * s, st.hit.h * s);
    (this.hitZone.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, st.hit.w * s, st.hit.h * s);
    this.night.setSize(width, height);
    const r = rng(17 + this.location * 101);
    this.starList.forEach((st) => st.img.destroy());
    this.starList = Array.from({ length: 44 }, () => ({
      img: this.add.image(r() * width, r() * this.horizonY * 0.75, 'spark').setScale(((0.6 + r() * 1.4) * this.unit) / 4).setDepth(0.5).setVisible(false),
      tw: r() * 6,
    }));
    const rc = rng(5 + this.location);
    for (const c of this.clouds) {
      c.w = (60 + rc() * 50) * this.unit;
      c.x0 = rc() * width;
      c.v = 4 + rc() * 6;
      c.img.setDisplaySize(c.w * 1.1, c.w * 0.44).setY(this.horizonY * (0.15 + rc() * 0.35));
    }
    this.skyAt = -1e9;
    this.buildProps();
    // гости стоят на земле и после поворота экрана, а не висят на старой высоте
    this.customers.forEach((cu) => cu.c.root.setScale(this.critterScale(cu.c)).setY(this.groundY + 4 * this.unit));
    this.placePets();
    this.redrawWorld();
  }

  private placePets() {
    const u = this.unit;
    const y = Math.min(this.scale.height - 4 * u, this.groundY + 40 * u);
    // маскот крупнее питомцев и стоит в самом низу слева
    // на узком экране маскот скромнее, чтобы не закрывал очередь
    const ms = this.critterScale(this.mascot) * (this.scale.height > this.scale.width * 1.2 ? 0.8 : 0.98);
    const my = Math.min(this.scale.height - 2 * u, this.groundY + 48 * u);
    this.mascot.root.setData({ s: ms, y0: my }).setPosition(Math.max(46 * u, this.scale.width * MASCOT_X), my).setScale(ms);
    for (const p of this.pets) {
      const sc = this.critterScale(p.c) * (p.id === 'bombardiro' ? 0.45 : 0.68);
      p.c.root.setData('s', sc).setData('y0', p.id === 'bombardiro' ? y - 26 * u : y);
      p.c.root.setPosition(this.scale.width * PET_SLOTS[p.slot], p.c.root.getData('y0')).setScale(sc);
    }
  }

  private critterScale(c: Critter) {
    return this.unit * (92 / Math.max(70, c.height)) * Phaser.Math.Clamp(this.stallScale / this.unit + 0.35, 0.8, 1.12);
  }

  private queueX(i: number) {
    // широкий дворец на телефоне занимает почти весь экран: первый гость всё равно встаёт у края
    const left = Math.max(this.stallX + (this.stall?.left ?? -120) * this.stallScale - 18 * this.unit, 40 * this.unit);
    return left - i * 54 * this.unit;
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
      this.weather.reset();
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
    // мультяшная «диафрагма»: улица сжимается в кружок, за ним уже новая точка, и ларёк вырастает из земли
    this.moving = true;
    void this.iris(true).then(() => {
      apply();
      this.growT = 0;
      this.time.delayedCall(140, () => {
        this.moving = false;
        this.regrow();
        void this.iris(false);
        this.time.delayedCall(380, () => this.celebrate(true));
      });
    });
  }

  private iris(close: boolean): Promise<void> {
    const el = document.getElementById('iris');
    if (!el) return Promise.resolve();
    return new Promise((done) => {
      el.hidden = false;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.classList.toggle('closed', close);
          window.setTimeout(() => {
            if (!close) el.hidden = true;
            done();
          }, close ? 520 : 600);
        }),
      );
    });
  }

  // Возвращает true, если ларёк заметно изменился.
  setLook(levels: Record<string, number>): boolean {
    const look = lookOf(levels);
    const key = lookKey(look);
    if (key === this.lookKeyNow) return false;
    const first = this.lookKeyNow === '';
    const before = this.look;
    this.lookKeyNow = key;
    this.look = look;
    if (!this.sys.isActive() || this.moving) return !first;
    this.rebuildStall();
    this.layout();
    if (!first) {
      this.regrow();
      if (before) this.showLookChanges(lookChanges(before, look));
    }
    return !first;
  }

  // Что появилось или подросло на ларьке: вспышка на этом месте и подпись «Новое: …».
  // Не чаще раза в 0,7 с, иначе при покупке пачкой всё мигает.
  private lookFxAt = 0;
  private showLookChanges(changes: { id: string; fresh: boolean }[]) {
    const st = this.stall;
    if (!st || !changes.length || this.time.now - this.lookFxAt < 700) return;
    this.lookFxAt = this.time.now;
    const pick = [...changes].sort((a, b) => Number(b.fresh) - Number(a.fresh)).slice(0, 2);
    const s = this.stallScale, u = this.unit;
    pick.forEach((c, i) => {
      let p: { x: number; y: number } | undefined;
      const a = st.anchors[c.id];
      if (a) p = { x: this.stallX + a.x * s, y: this.groundY + a.y * s };
      else if (this.propAnchors[c.id]) p = this.propAnchors[c.id];
      else if (c.id === 'barker' && this.mascot) p = { x: this.mascot.root.x, y: this.mascot.root.y - 60 * u };
      if (!p) p = { x: this.stallX, y: this.groundY + (st.top / 2) * s };
      const { x, y } = p;
      this.time.delayedCall(i * 260 + 120, () => {
        const ring = this.add.circle(x, y, 14 * u, 0xfff0b0, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(9.5);
        this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 700, ease: 'Cubic.out', onComplete: () => ring.destroy() });
        this.sparks.explode(c.fresh ? 22 : 12, x, y);
        const name = t(`up_${c.id}`);
        this.popText(t(c.fresh ? 'lookNew' : 'lookUp', name), x, y - 18 * u, '#ffd86b', 0.8);
      });
    });
  }

  // Лучшие брейнроты игрока танцуют перед ларьком. Мутация даёт золотое или алмазное сияние.
  setPets(list: { id: string; mut: number; stars?: number }[]) {
    const top = list.slice(0, PET_SLOTS.length);
    const key = top.map((p) => `${p.id}:${p.mut}:${p.stars ?? 0}`).join(',');
    if (key === this.petKey || !this.sys.isActive()) return;
    const old = new Set(this.pets.map((p) => p.id));
    this.petKey = key;
    this.pets.forEach((p) => p.c.root.destroy());
    this.pets = top.map((p, slot) => {
      const c = drawBrainrot(this, p.id);
      let aura: Phaser.GameObjects.Arc | undefined;
      const stars = p.stars ?? 0;
      if (p.mut > 0 || stars > 0) {
        const color = p.mut === 2 ? 0x7ff0ff : p.mut === 1 ? 0xffd86b : stars >= 3 ? 0xff7ab8 : 0xffe9a8;
        aura = this.add.circle(0, -c.height * 0.45, Math.max(40, c.height * 0.62), color, 0.4).setBlendMode(Phaser.BlendModes.ADD);
        c.root.addAt(aura, 0);
      }
      // звёзды слияния над головой
      for (let i = 0; i < stars; i++) {
        const x = (i - (stars - 1) / 2) * 22;
        const st = this.add.star(x, -c.height - 14 - (i === 1 && stars === 3 ? 6 : 0), 5, 5, 11, 0xffb02e).setStrokeStyle(3, 0x2a1b3d);
        c.root.add(st);
      }
      if (p.id !== 'bombardiro') this.shadow(c);
      c.root.setDepth(7.8);
      return { id: p.id, c, aura, phase: slot * 1.7, slot };
    });
    this.placePets();
    for (const p of this.pets) {
      if (old.has(p.id)) continue;
      const sc = p.c.root.getData('s');
      p.c.root.setScale(0.01);
      this.tweens.add({ targets: p.c.root, scale: sc, duration: 500, ease: 'Back.out' });
      this.sparks.explode(18, p.c.root.x, p.c.root.y - 30 * this.unit);
    }
  }

  // Критический тап: крупная розовая надпись и встряска.
  crit(text: string, x: number, y: number) {
    this.popText(text, x, y - 10 * this.unit, '#ff7ab8', 1.6);
    this.sparks.explode(24, x, y);
    this.cameras.main.shake(120, 0.005);
  }

  setMet(ids: string[]) {
    this.met = new Set(ids);
  }

  // Ларёк перестроился: вырастает из земли, по бокам клубится пыль.
  private regrow() {
    const st = this.stall;
    if (!st) return;
    this.growT = 0;
    const s = this.stallScale, gy = this.groundY;
    this.dust.explode(12, this.stallX + st.left * s * 0.9, gy);
    this.dust.explode(12, this.stallX + st.right * s * 0.9, gy);
    this.dust.explode(8, this.stallX, gy);
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

  // Длина очереди растёт с доходом, но не больше четырёх; обслуживают раз в serveEvery мс.
  setIncome(perSecond: number, serveEvery: number) {
    this.wantQueue = Phaser.Math.Clamp(2 + Math.floor(Math.log10(perSecond + 1) / 3), 2, 4);
    this.serveEvery = serveEvery;
  }

  // Тап ускоряет очередь: первый гость получает шаурму раньше.
  hurry() {
    if (this.customers.some((c) => c.state === 'queue')) this.serveTimer += 420;
  }

  setRush(on: boolean) {
    this.rush = on;
  }

  // Крупная надпись по центру ларька не должна вылезать за края экрана (длинный текст на телефоне).
  private fitCentered(text: Phaser.GameObjects.Text, size: number, x: number, y: number) {
    const w = this.scale.width;
    text.setScale(1).setFontSize(size);
    const max = w - 24;
    if (text.width > max) text.setFontSize(Math.max(10, Math.floor((size * max) / text.width)));
    const half = Math.min(text.width, max) / 2;
    text.setPosition(Phaser.Math.Clamp(x, half + 12, w - half - 12), y);
  }

  setCombo(combo: number, mult: number) {
    if (combo < 3) {
      this.comboText.setAlpha(0);
      return;
    }
    const u = this.unit;
    this.comboText
      .setText(`${t('combo', combo)}  ×${lang() === 'ru' ? mult.toFixed(2).replace('.', ',') : mult.toFixed(2)}`)
      .setColor(combo >= 50 ? '#ffd86b' : combo >= 25 ? '#ffb02e' : '#fff4dc');
    // запас под прыжок ×1,25 в начале анимации
    this.fitCentered(this.comboText, Math.round((15 * u + Math.min(combo, 50) * 0.12 * u) / 1.25), this.stallX, Math.min(this.scale.height - 16 * u, this.groundY + 32 * u));
    this.comboText
      .setAlpha(1)
      .setScale(1.25);
    this.tweens.killTweensOf(this.comboText);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 700, duration: 300 });
  }

  // Рекорд серии: появляется только когда игрок побивает свой лучший результат.
  // first — рекорд побит впервые за эту серию: надпись прыгает сильнее и летят искры.
  setRecord(combo: number, first: boolean) {
    const u = this.unit;
    const y = Math.min(this.scale.height - 16 * u, this.groundY + 32 * u) - 30 * u;
    this.recordText.setText(t('comboRecord', combo));
    this.fitCentered(this.recordText, Math.round(17 * u), this.stallX, y);
    this.recordText
      .setAlpha(1)
      .setScale(first ? 1.6 : 1.15);
    this.tweens.killTweensOf(this.recordText);
    this.tweens.add({ targets: this.recordText, scale: 1, duration: first ? 260 : 140, ease: 'Back.out' });
    this.tweens.add({ targets: this.recordText, alpha: 0, delay: 1300, duration: 400 });
    if (first) this.burst(this.stallX, y, 14);
  }

  // Тап обслуживает первого в очереди.
  serve() {
    const first = this.customers.find((c) => c.state === 'queue');
    if (!first || Math.abs(first.c.root.x - this.queueX(0)) > 3) return;
    first.state = 'leaving';
    first.jump = 1;
    first.bubble?.destroy();
    first.bubble = undefined;
    const g = this.add.graphics();
    const p = new Pen(g, 2);
    p.rect(-5, -11, 10, 22, 0xf2e3b3, 4);
    p.rect(-5, -11, 10, 7, 0xb5651d, 3, 0);
    p.flat(0x5e9c3a).fillRect(-4, -12, 3, 3);
    g.setPosition(16, -first.c.height * 0.45);
    first.c.body.add(g);
    bake(g, 3, 'wrap').setAngle(-15); // одна общая картинка шаурмы на всех гостей
    first.c.root.setDepth(7);
    this.cb.onServed(first.id, first.c.root.x, first.c.root.y - first.c.height * first.c.root.scaleY * 0.8);
  }

  burst(x: number, y: number, count = 6) {
    this.coins.explode(count, x, y);
  }

  // Надпись «+N ₽»: выпрыгивает, чуть наклонившись, всплывает и тает. Берётся из запаса из 16 надписей.
  popText(text: string, x: number, y: number, color = '#fff4dc', size = 1) {
    const u = this.unit * size;
    let pop = this.pops.find((p) => !p.visible);
    if (!pop) {
      if (this.pops.length < 16) {
        pop = this.add.text(0, 0, '', { fontFamily: DISPLAY_FONT, fontStyle: '800' }).setOrigin(0.5).setDepth(12);
        this.pops.push(pop);
      } else {
        pop = this.pops.shift()!;
        this.pops.push(pop);
      }
    }
    this.tweens.killTweensOf(pop);
    // Размер шрифта меняется: стиль надо задать целиком, иначе Phaser оставит высоту строки
    // от старого размера и обрежет верх букв. Тот же размер — меняем только цвет и текст.
    const fs = Math.round(19 * u);
    if (pop.getData('fs') !== fs) {
      pop.setData('fs', fs);
      pop.setText(text).setStyle({ fontFamily: DISPLAY_FONT, fontStyle: '800', fontSize: `${fs}px`, color, stroke: '#2a1b3d', strokeThickness: Math.round(5 * u) });
    } else if (pop.style.color !== color) {
      pop.setText(text).setColor(color);
    } else pop.setText(text);
    const tilt = Phaser.Math.Between(-8, 8);
    pop
      // не даём надписи уйти за край экрана (гость у самого края, крит на большом числе)
      .setPosition(Phaser.Math.Clamp(x + Phaser.Math.Between(-14, 14) * this.unit, pop.width / 2 + 6, Math.max(pop.width / 2 + 6, this.scale.width - pop.width / 2 - 6)), y - 20 * this.unit)
      .setVisible(true)
      .setAlpha(1)
      .setScale(size > 1 ? 0.3 : 0.55)
      .setAngle(tilt)
      .setDepth(size > 1 ? 12.5 : 12);
    const life = 820 + (size > 1 ? 380 : 0);
    this.tweens.add({ targets: pop, scale: 1, angle: tilt * 0.3, duration: size > 1 ? 260 : 170, ease: 'Back.out' });
    this.tweens.add({ targets: pop, y: pop.y - 74 * u, duration: life, ease: 'Cubic.out' });
    this.tweens.add({ targets: pop, alpha: 0, delay: life * 0.55, duration: life * 0.45, onComplete: () => pop.setVisible(false) });
  }

  // Где на экране кошелёк (монетка в шапке): спрашиваем у страницы не чаще раза в 2 секунды.
  // Левый край боковых кнопок у правого края улицы (в координатах сцены).
  private rightSafe(w: number) {
    let x = w;
    const c = this.game.canvas.getBoundingClientRect();
    document.querySelectorAll<HTMLElement>('.side-btn').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && r.left - c.left > w / 2) x = Math.min(x, r.left - c.left - 6);
    });
    return x;
  }

  // Боковые кнопки (подарок, задания, ×2, ящик) в координатах сцены; спрашиваем у страницы раз в секунду.
  private sideAt = -1e9;
  private sideBoxes: { l: number; t: number; r: number; b: number }[] = [];
  private sideRects() {
    if (this.clock - this.sideAt > 1000) {
      this.sideAt = this.clock;
      const c = this.game.canvas.getBoundingClientRect();
      this.sideBoxes = [];
      document.querySelectorAll<HTMLElement>('.side-btn').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width) this.sideBoxes.push({ l: r.left - c.left, t: r.top - c.top, r: r.right - c.left, b: r.bottom - c.top });
      });
    }
    return this.sideBoxes;
  }

  // Облачко реплики: внутри экрана и не под боковыми кнопками (сдвигаем вбок от кнопки).
  private placeBubble(b: Phaser.GameObjects.Container, x: number, y: number) {
    const w = this.scale.width;
    const bw = b.getData('w') ?? 0, bh = b.getData('h') ?? 0;
    let cx = Phaser.Math.Clamp(x, bw / 2 + 6, w - bw / 2 - 6);
    for (const r of this.sideRects()) {
      const overlapY = y - bh / 2 < r.b && y + bh / 2 > r.t;
      const overlapX = cx - bw / 2 < r.r && cx + bw / 2 > r.l;
      if (!overlapY || !overlapX) continue;
      cx = r.l > w / 2 ? r.l - bw / 2 - 6 : r.r + bw / 2 + 6;
    }
    b.setPosition(Phaser.Math.Clamp(cx, bw / 2 + 6, Math.max(bw / 2 + 6, w - bw / 2 - 6)), y);
  }

  private wallet() {
    if (this.clock - this.walletAt > 2000) {
      this.walletAt = this.clock;
      const coin = document.getElementById('money-coin');
      if (coin) {
        const r = coin.getBoundingClientRect();
        const c = this.game.canvas.getBoundingClientRect();
        if (r.width) this.walletXY = { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
      }
    }
    return this.walletXY;
  }

  // Монетки летят дугой из точки тапа в кошелёк; долетевшая монетка толкает счётчик денег.
  flyCoins(x: number, y: number, n = 1) {
    const u = this.unit;
    const to = this.wallet();
    for (let i = 0; i < n; i++) {
      let img = this.flying.find((f) => !f.visible);
      if (!img) {
        if (this.flying.length >= 18) return;
        img = this.add.image(0, 0, 'coin').setDepth(13);
        this.flying.push(img);
      }
      const coin = img;
      const sx = x + Phaser.Math.Between(-10, 10) * u, sy = y + Phaser.Math.Between(-8, 8) * u;
      const cx = sx + (to.x - sx) * 0.25 + Phaser.Math.Between(-50, 50) * u;
      const cy = Math.min(sy, to.y) - (60 + Math.random() * 70) * u;
      const s0 = (0.9 + Math.random() * 0.3) * Math.min(1.3, u);
      coin.setPosition(sx, sy).setScale(s0).setVisible(true).setAlpha(1).setAngle(0);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 55,
        duration: 520 + Math.random() * 160,
        ease: 'Sine.in',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0, r = 1 - t;
          coin.setPosition(r * r * sx + 2 * r * t * cx + t * t * to.x, r * r * sy + 2 * r * t * cy + t * t * to.y);
          coin.setScale(s0 * (1 - 0.35 * t), s0 * (1 - 0.35 * t) * Math.abs(Math.cos(t * 9)) + 0.1 * s0);
        },
        onComplete: () => {
          coin.setVisible(false);
          this.cb.onCoin();
        },
      });
    }
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
    // размер по ширине улицы: размах крыльев около трети экрана на телефоне и не больше 200 px на компьютере
    const span = c.root.getBounds().width || 160;
    const k = Math.min(u * 1.05, (this.scale.width * 0.32) / span, 200 / span);
    // летит ниже шапки и всплывающих сообщений, над крышей ларька
    const y0 = this.hudBottom + (this.groundY - this.hudBottom) * 0.42;
    c.root.setPosition(-span * k, y0).setScale(k).setDepth(10);
    const glow = this.add.circle(0, -4, 70, 0xffd86b, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    c.root.addAt(glow, 0);
    this.tweens.add({ targets: glow, scale: 1.3, alpha: 0.12, yoyo: true, repeat: -1, duration: 450 });
    const hit = this.add.rectangle(-4, 4, Math.max(190, 150 / k), Math.max(130, 110 / k), 0, 0).setInteractive({ useHandCursor: true });
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
      this.cb.onServed('bombardiro', x, y);
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
        this.coins.explode(14, g.x, ground - 10 * u);
        this.confetti.explode(16, g.x, ground - 10 * u);
        this.dust.explode(8, g.x, ground);
        this.flyCoins(g.x, ground - 10 * u, 8);
        g.destroy();
      },
    });
  }

  // Открытка следующей точки для вкладки «Переезд»: фон и прокачанный ларёк этой точки, днём.
  placePreview(index: number): Promise<string> {
    return placePreview(this as Phaser.Scene, index);
  }

  // Портреты брейнротов для коллекции.
  portraits(ids: string[]): Promise<Record<string, string>> {
    return portraits(this, ids);
  }

  // ---------- очередь ----------

  // Мягкая тень под ногами: персонаж стоит на земле, а не висит над ней.
  private shadow(c: Critter, k = 1) {
    const w = Math.max(40, c.width) * 0.8 * k;
    c.root.addAt(this.add.image(0, 3, 'shadow').setScale(w / 64, (w / 64) * 0.75), 0);
  }

  private spawnCustomer() {
    const id = pickCustomer(this.location, Math.random());
    const c = drawBrainrot(this, id);
    c.root.setPosition(-50 * this.unit, this.groundY + 4 * this.unit).setScale(this.critterScale(c)).setDepth(6);
    this.shadow(c);
    this.customers.push({ id, c, state: 'queue', phase: Math.random() * 6, talked: false, vx: this.walkSpeed(), wait: 0, jump: 0 });
  }

  private say(cu: Customer) {
    const isNew = !this.met.has(cu.id);
    const text = isNew ? `${t('newGuest')}\n${t(`br_${cu.id}`)}` : t(`brs_${cu.id}`);
    const bubble = this.bubble(text, isNew ? 0xffd86b : 0xffffff);
    cu.bubble = bubble;
    this.time.delayedCall(isNew ? 2600 : 1800, () => {
      if (cu.bubble !== bubble) return;
      this.tweens.add({ targets: bubble, alpha: 0, duration: 200, onComplete: () => bubble.destroy() });
      cu.bubble = undefined;
    });
  }

  // облачко с репликой; хвостик снизу по центру
  private bubble(text: string, fill: number, size = 11) {
    const u = this.unit;
    const label = this.add
      .text(0, 0, text, { fontFamily: '"Golos Text", system-ui, sans-serif', fontSize: `${Math.round(size * u)}px`, fontStyle: '700', color: '#2a1b3d', align: 'center', wordWrap: { width: 130 * u } })
      .setOrigin(0.5);
    const bw = label.width + 16 * u, bh = label.height + 10 * u;
    const g = this.add.graphics();
    g.fillStyle(fill, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8 * u);
    g.lineStyle(2.5, OUTLINE, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8 * u);
    g.fillStyle(fill, 1).fillTriangle(-6 * u, bh / 2 - 1.5, 6 * u, bh / 2 - 1.5, 0, bh / 2 + 8 * u);
    g.lineStyle(2.5, OUTLINE, 1).lineBetween(-6 * u, bh / 2, 0, bh / 2 + 8 * u).lineBetween(6 * u, bh / 2, 0, bh / 2 + 8 * u);
    const bubble = this.add.container(0, 0, [g, label]).setDepth(12).setScale(0.2);
    // облачко запекаем в картинку, пока оно на экране; текстуру убираем вместе с облачком
    const img = bake(g, this.resFor(u));
    bubble.once(Phaser.GameObjects.Events.DESTROY, () => dropTexture(this, img));
    bubble.setData('h', bh).setData('w', bw);
    this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: 'Back.out' });
    return bubble;
  }

  // ---------- маскот-зазывала ----------

  /** Подсказки, которые маскот выкрикивает чаще обычных фраз (ключи словаря). */
  setHints(keys: string[], moveX = 0) {
    this.hints = keys;
    const was = this.moveX;
    this.moveX = moveX;
    // как только переезд стал доступен, маскот кричит об этом сразу
    if (moveX && !was) this.barkIn = Math.min(this.barkIn, 600);
  }

  /** Уровень улучшения «Зазывала Тунг Тунг»: 0 — не нанят. */
  setMascot(level: number) {
    if (level === this.mascotLevel || !this.sys.isActive()) return;
    const up = this.mascotLevel >= 0 && level > this.mascotLevel;
    this.buildMascot(level);
    this.placePets();
    if (up) {
      const m = this.mascot.root;
      const sc = m.getData('s');
      m.setScale(0.01);
      this.tweens.add({ targets: m, scaleX: sc, scaleY: sc, duration: 520, ease: 'Back.out' });
      this.confetti.emitParticleAt(m.x, m.y - 80 * this.unit, 40);
      this.time.delayedCall(450, () => this.bark('barkHired'));
    }
  }

  private buildMascot(level: number) {
    this.mascotLevel = level;
    this.mascotBubble?.destroy();
    this.mascotBubble = undefined;
    this.mascot?.root.destroy();
    const lv = Phaser.Math.Clamp(level, 1, 3);
    const m = drawMascot(this, lv);
    this.shadow(m, 0.9);
    m.root.setDepth(8).setVisible(level > 0);
    const style = { fontFamily: DISPLAY_FONT, fontStyle: '900' };
    if (lv === 1) {
      m.body.add(fitText(this.add.text(0, -34, t('neonDump'), { ...style, fontSize: '9px', color: '#2a1b3d' }), 52).setOrigin(0.5).setAngle(-4));
    } else {
      m.body.add(fitText(this.add.text(0, -30, t('neon'), { ...style, fontSize: '10px', color: lv >= 3 ? '#ffcf3f' : '#e4472b' }), 54).setOrigin(0.5));
      m.body.add(this.add.text(0, -19, '→ → →', { ...style, fontSize: '7px', color: lv >= 3 ? '#fff4dc' : '#2a1b3d' }).setOrigin(0.5));
    }
    this.mascot = m;
  }

  private overMascot(x: number, y: number) {
    const m = this.mascot;
    if (!m || !m.root.visible) return false;
    const s = m.root.scaleY;
    return Math.abs(x - m.root.x) < (m.width / 2 + 14) * s && y < m.root.y + 6 * s && y > m.root.y - (m.top + 20) * s;
  }

  // тап по маскоту: подпрыгивает и кричит
  private poke() {
    this.mascotJump = 1;
    this.bark(Math.random() < 0.5 ? 'barkTap' : `bark_${Math.floor(Math.random() * 6)}`);
    sfx.poke();
  }

  private bark(key?: string) {
    if (!key) {
      this.barkN++;
      const loc = LOCATIONS[this.location].id;
      if (this.moveX) key = Phaser.Utils.Array.GetRandom(['barkMoveX', 'barkMove', 'barkMove2', 'barkMove3']);
      else if (this.hints.length && this.barkN % 2 === 0) key = Phaser.Utils.Array.GetRandom(this.hints);
      else if (this.barkN % 3 === 1) key = `barkLoc_${loc}`;
      else key = `bark_${Math.floor(Math.random() * 6)}`;
    }
    this.mascotBubble?.destroy();
    const bubble = this.bubble(t(key as Parameters<typeof t>[0], this.moveX), 0xffe9a8, 12);
    this.mascotBubble = bubble;
    this.time.delayedCall(2600, () => {
      if (this.mascotBubble !== bubble) return;
      this.tweens.add({ targets: bubble, alpha: 0, duration: 200, onComplete: () => bubble.destroy() });
      this.mascotBubble = undefined;
    });
  }

  private animateMascot(delta: number) {
    const m = this.mascot;
    const u = this.unit;
    this.mascotPhase += delta / (this.rush ? 140 : 220);
    const yell = this.mascotBubble ? 1 : 0;
    const hop = Math.abs(Math.sin(this.mascotPhase)) * (yell ? 9 : 4);
    this.mascotJump = Math.max(0, this.mascotJump - delta / 450);
    const jump = Math.sin(this.mascotJump * Math.PI) * 40;
    const sc = m.root.getData('s') ?? 1;
    m.body.y = -hop;
    m.root.y = (m.root.getData('y0') ?? m.root.y) - jump * sc;
    m.body.setRotation(Math.sin(this.mascotPhase * 0.5) * (yell ? 0.1 : 0.05));
    m.root.setScale(sc * (1 + 0.04 * (1 - hop / 9)), sc * (1 - 0.04 * (1 - hop / 9)));
    const [l, r] = m.legs;
    l?.setAngle(Math.sin(this.mascotPhase) * (yell ? 18 : 8));
    r?.setAngle(-Math.sin(this.mascotPhase) * (yell ? 18 : 8));
    this.barkIn -= delta;
    if (this.barkIn <= 0 && !this.moving && m.root.visible) {
      this.barkIn = this.moveX ? 4500 + Math.random() * 2000 : 7000 + Math.random() * 5000;
      this.bark();
    }
    if (this.mascotBubble) {
      const h = this.mascotBubble.getData('h');
      this.placeBubble(this.mascotBubble, m.root.x + 10 * u, m.root.y + m.body.y * sc - (m.top + 22) * sc - h / 2);
    }
  }

  private walkSpeed() {
    return WALK_SPEED * this.unit * (this.rush ? 1.25 : 1);
  }

  // Шаг зависит от пройденного пути, поэтому ноги не «буксуют»; на остановке шаг мягко затухает,
  // а стоящий гость спокойно дышит и покачивается.
  private animateWalk(cu: { c: Critter; phase: number; vx?: number }, k: number, delta: number) {
    const go = Phaser.Math.Clamp(k, 0, 1);
    cu.phase += (delta / 95) * go;
    const swing = Math.sin(cu.phase) * 24 * go;
    const [l, r] = cu.c.legs;
    l?.setAngle(swing);
    r?.setAngle(-swing);
    const breathe = Math.sin(this.clock / 700 + cu.phase * 0.3);
    cu.c.body.y = -Math.abs(Math.sin(cu.phase)) * 3.2 * go + breathe * 0.9 * (1 - go);
    cu.c.body.rotation = 0.05 * go + Math.sin(this.clock / 1300 + cu.phase) * 0.025 * (1 - go);
    cu.c.body.scaleY = 1 + breathe * 0.012 * (1 - go);
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
    this.animateSky();
    this.weather.update(delta, LOCATIONS[this.location].id, { w: this.scale.width, h: this.scale.height, horizon: this.horizonY, ground: this.groundY, unit: u }, this.moving);

    // вертел крутится: полосы мяса бегут вниз и сужаются вместе с конусом
    const k = (this.clock / 220) % 1;
    st.stripes.forEach((s) => {
      const f = (s.getData('i') / 5 + k / 5) % 1;
      s.y = s.getData('top') + 3 + f * (s.getData('h') - 6);
      const w = s.getData('w') ?? 28;
      s.setSize(w - w * 0.5 * f, 2.5);
    });
    const flick = 0.75 + 0.25 * Math.sin(this.clock / 90) * Math.sin(this.clock / 37);
    st.heaters.forEach((g) => g.setAlpha(flick));
    st.pulses.forEach((p, i) => (p as Phaser.GameObjects.Arc).setAlpha((0.2 + 0.4 * this.nightK) * (0.7 + 0.3 * Math.sin(this.clock / 350 + i))));
    st.bulbs.forEach((b, i) => b.setAlpha(0.6 + 0.4 * Math.sin(this.clock / 300 + i * 1.7) * (this.nightK > 0.2 ? 1 : 0.3)));
    st.rays?.setRotation(this.clock / 9000);
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

    // очередь: каждый гость плавно разгоняется и тормозит у своего места,
    // а когда первый уходит, остальные трогаются по очереди, а не все разом
    const line = this.customers.filter((c) => c.state === 'queue');
    const vmax = this.walkSpeed();
    const ease = Math.min(1, delta / 170);
    line.forEach((c, i) => {
      const tx = this.queueX(i);
      if (c.tx !== undefined && tx > c.tx + 1) c.wait = Math.max(c.wait, i * 160);
      c.tx = tx;
      if (c.wait > 0) c.wait -= delta;
      const dx = tx - c.c.root.x;
      const want = c.wait > 0 ? 0 : Phaser.Math.Clamp(dx / 240, -1, 1) * vmax;
      c.vx += (want - c.vx) * ease;
      if (Math.abs(dx) < 0.6 && Math.abs(c.vx) < 0.012) {
        c.c.root.x = tx;
        c.vx = 0;
      } else c.c.root.x += c.vx * delta;
      this.animateWalk(c, Math.abs(c.vx) / vmax, delta);
      if (Math.abs(dx) < 2 && i === 0 && !c.talked) {
        c.talked = true;
        if (!this.met.has(c.id) || Math.random() < 0.35) this.say(c);
      }
    });
    for (const c of this.customers) {
      if (c.bubble) this.placeBubble(c.bubble, c.c.root.x + 6 * u, c.c.root.y - c.c.height * c.c.root.scaleY - (c.bubble.getData('h') / 2 + 12 * u));
      if (c.state !== 'leaving') continue;
      c.vx += (vmax * 1.15 - c.vx) * Math.min(1, delta / 320);
      c.c.root.x += c.vx * delta;
      c.c.root.y += (this.groundY + 22 * u - c.c.root.y) * Math.min(1, delta / 260);
      this.animateWalk(c, c.vx / vmax, delta);
      // радостный подскок с шаурмой в руках
      if (c.jump > 0) {
        c.jump = Math.max(0, c.jump - delta / 520);
        const j = Math.sin(c.jump * Math.PI);
        c.c.body.y -= j * 22;
        c.c.body.rotation -= j * 0.12;
      }
      if (c.c.root.x > this.scale.width + 70 * u) c.c.root.destroy();
    }
    this.customers = this.customers.filter((c) => c.c.root.active);

    // гости приходят спокойно, без толпы: в час пик чаще, но не бегом
    const want = this.rush ? 5 : this.wantQueue;
    const fits = this.queueX(line.length) > 14 * u;
    if (line.length < want && fits && !this.moving && Math.random() < delta / (line.length === 0 ? 350 : this.rush ? 700 : 1600)) this.spawnCustomer();
    if (this.serveEvery > 0 && line.length > 0) {
      this.serveTimer += delta * (this.rush ? 1.5 : 1);
      if (this.serveTimer >= this.serveEvery) {
        const first = line[0];
        if (Math.abs(first.c.root.x - this.queueX(0)) < 3) {
          this.serveTimer = 0;
          this.serve();
        } else this.serveTimer = this.serveEvery;
      }
    }

    this.animateMascot(delta);
    this.animateSquash(delta);
    if (LOCATIONS[this.location].id === 'palace') {
      this.rainTimer -= delta;
      if (this.rainTimer <= 0) {
        this.rainTimer = 220 + Math.random() * 260;
        this.goldRain.emitParticleAt(Math.random() * this.scale.width, -12, 1);
      }
    }

    // питомцы пританцовывают, в час пик быстрее
    for (const p of this.pets) {
      p.phase += delta / (this.rush ? 260 : 420);
      const hop = Math.sin(p.phase) ** 2; // плавный подскок без излома внизу
      const sc = p.c.root.getData('s');
      p.c.body.y = -hop * 4;
      p.c.root.setScale(sc * (1 + 0.03 * (1 - hop)), sc * (1 - 0.03 * (1 - hop)));
      p.c.root.y = p.c.root.getData('y0');
      p.c.body.setRotation(Math.sin(p.phase * 0.5) * 0.06);
      const [l, r] = p.c.legs;
      l?.setAngle(Math.sin(p.phase) * 8);
      r?.setAngle(-Math.sin(p.phase) * 8);
      p.aura?.setAlpha(0.25 + 0.2 * Math.sin(this.clock / 300 + p.slot));
    }

    // Бомбардиро
    const b = this.bomber;
    if (b && !b.caught) {
      b.c.root.x += (this.scale.width / 5200) * delta; // пролетает экран примерно за 5 секунд
      b.c.root.y = b.y0 + Math.sin(this.clock / 220) * 12 * u;
      b.c.root.setRotation(Math.sin(this.clock / 300 + 1) * 0.05);
      if (Math.random() < delta / 120) this.sparks.emitParticleAt(b.c.root.x - 40 * u, b.c.root.y + Phaser.Math.Between(-10, 20) * u);
      if (b.c.root.x > this.scale.width + 200 * b.c.root.scaleX) {
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
