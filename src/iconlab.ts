// Лаборатория иконок: рисует один вариант иконки на холсте 576×576 теми же фигурами, что и игра.
// npm run dev, открыть /icon-lab.html?i=<вариант> и сделать скриншот холста.
// Выбрана иконка tung (21.10.2026): promo/icon.png, promo/vk/icon-*.png, public/favicon.png.
import '@fontsource/unbounded/cyrillic-900.css';
import '@fontsource/unbounded/latin-900.css';
import Phaser from 'phaser';
import { drawBrainrot, drawMascot, setBakeRes, type Critter } from './scenes/brainrots';
import { AMBER, CREAM, DISPLAY_FONT, LEAF, MEAT, MEAT_DARK, OUTLINE, Pen, TOMATO, WHITE } from './scenes/draw';

const S = 576;
const GOLD = 0xffcf3f;
const LAVASH = 0xf2dca0;
type Pt = [number, number];

function rays(sc: Phaser.Scene, cx: number, cy: number, n: number, base: number, ray: number, alpha = 1) {
  const g = sc.add.graphics();
  g.fillStyle(base, 1).fillRect(0, 0, S, S);
  g.fillStyle(ray, alpha);
  const R = 1200;
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2;
    const a2 = a1 + Math.PI / n;
    g.fillTriangle(cx, cy, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
  }
  return g;
}

// мягкое затемнение по краям, чтобы взгляд шёл в центр
function vignette(sc: Phaser.Scene, color = OUTLINE, a = 0.06) {
  const g = sc.add.graphics();
  for (let i = 0; i < 12; i++) {
    g.lineStyle(26, color, a);
    g.strokeCircle(S / 2, S / 2, S * 0.5 + i * 24);
  }
  return g;
}

function sparkle(p: Pen, x: number, y: number, r: number, color = WHITE, ol = 4) {
  const k = 0.3;
  p.poly([[x, y - r], [x + r * k, y - r * k], [x + r, y], [x + r * k, y + r * k], [x, y + r], [x - r * k, y + r * k], [x - r, y], [x - r * k, y - r * k]], color, ol);
}

function coin(sc: Phaser.Scene, x: number, y: number, r: number, angle = 0) {
  const g = sc.add.graphics();
  const p = new Pen(g, Math.max(4, r * 0.12));
  p.circle(0, 0, r, GOLD);
  p.circle(0, 0, r * 0.74, 0xffe07a, Math.max(2.5, r * 0.07));
  g.fillStyle(WHITE, 0.55).fillEllipse(-r * 0.35, -r * 0.4, r * 0.35, r * 0.2);
  const t = sc.add.text(0, r * 0.02, '₽', { fontFamily: DISPLAY_FONT, fontStyle: '900', fontSize: `${Math.round(r * 1.05)}px`, color: '#b8741a' }).setOrigin(0.5);
  t.setResolution(2);
  const c = sc.add.container(x, y, [g, t]).setAngle(angle);
  return c;
}

// большая шаурма: лаваш, начинка сверху, бумажная обёртка с красной полосой
function shawarma(sc: Phaser.Scene, x: number, y: number, scale: number, angle: number) {
  const g = sc.add.graphics();
  const p = new Pen(g, 4);
  p.rect(-46, -92, 92, 140, LAVASH, 26);
  // начинка
  p.circle(-28, -96, 15, LEAF);
  p.circle(28, -98, 14, LEAF);
  p.circle(-10, -108, 17, MEAT);
  p.circle(12, -110, 15, MEAT);
  p.circle(0, -96, 13, TOMATO);
  p.circle(-32, -84, 11, MEAT);
  p.circle(32, -84, 11, TOMATO);
  g.fillStyle(0xd98a45, 1).fillCircle(-14, -112, 5).fillCircle(8, -114, 4);
  g.fillStyle(0xff8a6a, 1).fillCircle(-2, -99, 4);
  // передний край лаваша
  p.poly([[-46, -82], [-22, -72], [0, -70], [22, -72], [46, -82], [46, 4], [-46, 4]], LAVASH);
  g.fillStyle(0xd9b070, 1);
  for (const [lx, ly] of [[-26, -52], [6, -56], [22, -36], [-12, -32], [-30, -16], [10, -14]] as Pt[]) g.fillRoundedRect(lx, ly, 18, 5, 2.5);
  g.fillStyle(WHITE, 0.45).fillRoundedRect(-38, -64, 8, 44, 4);
  // бумага: нижняя треть, красная полоса
  const paper: Pt[] = [[-50, 0], [-18, 10], [18, 10], [50, 0], [44, 70], [-44, 70]];
  p.poly(paper, WHITE);
  g.fillStyle(TOMATO, 1).fillRect(-47.5, 30, 95, 16);
  g.lineStyle(4, OUTLINE, 1).lineBetween(-47.7, 30, 47.7, 30).lineBetween(-46.4, 46, 46.4, 46);
  g.fillStyle(WHITE, 0.7).fillRect(-34, 14, 6, 14);
  g.fillStyle(0xe6e0d0, 1).fillRect(28, 50, 9, 16);
  g.setPosition(x, y).setScale(scale).setAngle(angle);
  return g;
}

function chefHat(sc: Phaser.Scene, c: Critter, gold = false) {
  const g = sc.add.graphics();
  const p = new Pen(g, 2.6);
  const top = -c.top - 4;
  p.rect(-12, top, 24, 9, WHITE, 2);
  p.circle(-8, top - 7, 8, WHITE);
  p.circle(8, top - 7, 8, WHITE);
  p.circle(0, top - 12, 9, WHITE);
  p.flat(WHITE).fillRect(-11, top - 5, 22, 8);
  if (gold) p.circle(0, top + 4.5, 3.2, 0xffd86b, 1.6);
  c.body.add(g);
}

function critter(sc: Phaser.Scene, id: string, x: number, y: number, h: number, flip = false) {
  const c = drawBrainrot(sc, id);
  const k = h / c.height;
  c.root.setPosition(x, y).setScale(flip ? -k : k, k);
  return c;
}

function shadow(sc: Phaser.Scene, x: number, y: number, w: number) {
  return sc.add.ellipse(x, y, w, w * 0.18, OUTLINE, 0.25);
}

const ICONS: Record<string, (sc: Phaser.Scene) => void> = {
  // 1. Тунг Тунг — шеф с огромной шаурмой
  tung(sc) {
    rays(sc, 300, 300, 18, AMBER, 0xffc65a);
    vignette(sc, 0xb8541a, 0.05);
    shadow(sc, 300, 548, 260);
    const fx = new Pen(sc.add.graphics(), 5);
    sparkle(fx, 92, 110, 30);
    sparkle(fx, 488, 470, 22);
    sparkle(fx, 70, 330, 16);
    coin(sc, 96, 200, 42, -14);
    const c = critter(sc, 'tungtung', 330, 556, 430);
    chefHat(sc, c, true);
    shawarma(sc, 176, 420, 1.45, -16);
  },

  // 2. Шаурма-стикер с монетами
  wrap(sc) {
    rays(sc, 288, 300, 16, TOMATO, 0xf06446);
    vignette(sc, 0x7a1f2b, 0.06);
    const fx = new Pen(sc.add.graphics(), 5);
    fx.circle(288, 304, 200, CREAM, 10);
    fx.g.lineStyle(5, TOMATO, 0.35).strokeCircle(288, 304, 176);
    coin(sc, 128, 150, 52, -18);
    coin(sc, 458, 420, 46, 14);
    coin(sc, 448, 158, 30, 10);
    shawarma(sc, 292, 318, 2.0, -14);
    sparkle(fx, 96, 430, 26, 0xffe07a, 5);
    sparkle(fx, 488, 270, 18, WHITE, 4);
  },

  // 3. Трио брейнротов вокруг шаурмы
  trio(sc) {
    rays(sc, 288, 280, 16, 0x2f9e5a, 0x3fb36a);
    vignette(sc, 0x0f3a20, 0.06);
    shadow(sc, 288, 552, 520);
    critter(sc, 'ballerina', 112, 556, 300);
    critter(sc, 'tralalero', 468, 556, 280, true);
    const c = critter(sc, 'tungtung', 288, 556, 380);
    chefHat(sc, c);
    shawarma(sc, 288, 500, 1.0, -78);
    const fx = new Pen(sc.add.graphics(), 5);
    sparkle(fx, 80, 90, 26, 0xffe07a);
    sparkle(fx, 500, 120, 20);
  },

  // 4. Ларёк крупным планом: вывеска, козырёк, вертел и Тунг Тунг в окне
  stall(sc) {
    rays(sc, 288, 120, 18, 0x2a1b3d, 0x3a2652);
    const p = new Pen(sc.add.graphics(), 7);
    // вывеска
    p.rect(70, 34, 436, 104, 0x5a1a2e, 18, 8);
    p.g.lineStyle(5, GOLD, 1).strokeRoundedRect(84, 46, 408, 80, 12);
    for (let i = 0; i < 14; i++) p.g.fillStyle(0xffe07a, 1).fillCircle(98 + i * 29.3, 46, 4).fillCircle(98 + i * 29.3, 126, 4);
    const glow = sc.add.text(288, 88, 'ШАУРМА', { fontFamily: DISPLAY_FONT, fontStyle: '900', fontSize: '58px', color: '#ffb02e' }).setOrigin(0.5).setResolution(2);
    glow.setStroke('#ffb02e', 14).setAlpha(0.35);
    sc.add.text(288, 88, 'ШАУРМА', { fontFamily: DISPLAY_FONT, fontStyle: '900', fontSize: '58px', color: '#fff1b8' }).setOrigin(0.5).setResolution(2);
    // корпус и окно
    const q = new Pen(sc.add.graphics(), 7);
    q.rect(40, 196, 496, 400, TOMATO, 0, 8);
    q.rect(84, 236, 408, 230, 0x4a2a3a, 10, 7);
    q.g.fillStyle(0xffb46a, 0.22).fillRoundedRect(88, 240, 400, 222, 8);
    // вертел
    const cx = 178, top = 262, bot = 446, w = 120;
    q.g.fillStyle(0xff6a2b, 0.9).fillRect(cx - w / 2 - 22, top + 8, 14, bot - top - 16);
    q.line(cx, top - 6, cx, bot + 6, 7, 0x9a9aa8);
    q.poly([[cx - w / 2, top + 10], [cx + w / 2, top + 10], [cx + w * 0.28, bot - 10], [cx - w * 0.28, bot - 10]], MEAT, 6);
    for (let i = 1; i < 6; i++) {
      const y = top + 10 + ((bot - top - 20) * i) / 6;
      const half = (w / 2) * (1 - (0.44 * (y - top - 10)) / (bot - top - 20));
      q.line(cx - half + 4, y, cx + half - 4, y, 5, MEAT_DARK);
    }
    q.g.fillStyle(0xd98a45, 0.8).fillRect(cx - w * 0.38, top + 18, 12, bot - top - 50);
    q.rect(cx - 30, top + 2, 60, 12, 0x9a9aa8, 4, 5);
    // Тунг Тунг в колпаке
    const c = critter(sc, 'tungtung', 372, 560, 300);
    chefHat(sc, c, true);
    // прилавок и козырёк поверх
    const f = new Pen(sc.add.graphics(), 7);
    f.rect(26, 452, 524, 36, CREAM, 8, 7);
    f.rect(44, 486, 488, 100, 0xc8382a, 0, 7);
    f.rect(82, 504, 120, 50, CREAM, 10, 6);
    for (let i = 0; i < 5; i++) {
      const x = 98 + i * 22, y = 529;
      const pts: Pt[] = [];
      for (let j = 0; j < 10; j++) {
        const r = j % 2 ? 4 : 9.5, ang = -Math.PI / 2 + (j * Math.PI) / 5;
        pts.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r]);
      }
      f.poly(pts, GOLD, 2.5);
    }
    shawarma(sc, 300, 412, 0.62, 8);
    // козырёк в полоску с фестонами
    const aw = new Pen(sc.add.graphics(), 7);
    for (let i = 0; i < 8; i++) aw.circle(14 + i * 68.5 + 34, 200, 34, i % 2 === 0 ? TOMATO : CREAM, 7);
    aw.rect(14, 150, 548, 56, CREAM, 6, 0);
    for (let i = 0; i < 8; i += 2) aw.g.fillStyle(TOMATO, 1).fillRect(14 + i * 68.5, 150, 68.5, 56);
    aw.g.lineStyle(7, OUTLINE, 1).strokeRoundedRect(14, 150, 548, 56, 6);
  },

  // 5. Бомбардиро Крокодило с шаурмой
  bomber(sc) {
    rays(sc, 288, 288, 16, 0x6fc3f0, 0x86d0f6);
    const cl = new Pen(sc.add.graphics(), 0);
    for (const [x, y, r] of [[70, 470, 60], [140, 500, 54], [10, 520, 70], [470, 120, 44], [530, 100, 50], [560, 150, 40]] as [number, number, number][]) cl.circle(x, y, r, WHITE, 0);
    const c = critter(sc, 'bombardiro', 300, 250, 64 * 2.9);
    c.root.setAngle(-14);
    shawarma(sc, 330, 450, 1.1, 24);
    coin(sc, 170, 420, 34, -20);
    coin(sc, 470, 500, 28, 18);
    const fx = new Pen(sc.add.graphics(), 5);
    sparkle(fx, 90, 110, 24, 0xffe07a);
    sparkle(fx, 500, 330, 18);
  },

  // 6. Зазывала в короне со щитом «ШАУРМА»
  mascot(sc) {
    rays(sc, 288, 280, 20, 0x2a1b3d, 0x3d2858);
    const glow = sc.add.circle(288, 300, 230, GOLD, 0.16);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    sc.add.circle(288, 300, 160, GOLD, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    shadow(sc, 300, 552, 280).setFillStyle(0x000000, 0.35);
    const c = drawMascot(sc, 3);
    const k = 470 / 152;
    c.root.setPosition(300, 556).setScale(k);
    const t = sc.add.text(0, -29, 'ШАУРМА', { fontFamily: DISPLAY_FONT, fontStyle: '900', fontSize: '7.6px', color: '#ffcf3f' }).setOrigin(0.5).setResolution(6);
    c.body.add(t);
    const fx = new Pen(sc.add.graphics(), 5);
    sparkle(fx, 86, 120, 28, 0xffe07a);
    sparkle(fx, 500, 470, 22, 0xffe07a);
    sparkle(fx, 70, 420, 14, WHITE);
    coin(sc, 110, 250, 36, -12);
  },
};

class IconScene extends Phaser.Scene {
  create() {
    setBakeRes(8);
    const id = new URLSearchParams(location.search).get('i') ?? 'tung';
    (ICONS[id] ?? ICONS.tung)(this);
    this.time.delayedCall(300, () => document.body.setAttribute('data-ready', '1'));
  }
}

document.fonts.load(`900 40px Unbounded`, 'ШАУРМА₽').then(() =>
  new Phaser.Game({ type: Phaser.WEBGL, width: S, height: S, parent: 'app', backgroundColor: '#000000', scene: IconScene, render: { antialias: true, preserveDrawingBuffer: true } }),
);
