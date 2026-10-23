import Phaser from 'phaser';
import { bake } from './bake';
import { DRAW2 } from './brainrots2';
import { DRAW3 } from './brainrots3';
import { AMBER, CREAM, LEAF, OUTLINE, Pen, TOMATO, WHITE } from './draw';

// Итальянские брейнроты из фигур. Ноги внизу в точке (0, 0), смотрят вправо.
// Ноги — отдельные Graphics, чтобы ими шагать.
// Пропорции «чиби»: большая голова, крупные глаза, у каждого своя узнаваемая деталь
// (кроссовки у акулы, бита у полена, руки-арка у балерины, катаны у капучино…).

export interface Critter {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  legs: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Image)[];
  height: number;
  width: number;
  top: number; // верх головы (для колпака повара)
}

export interface LegStyle {
  skin: number;
  shoe: number;
  len: number;
  spread: number;
  width?: number;
  sole?: number;
  swoosh?: boolean;
  shoeLen?: number;
}

export const MOUTH = 0x7a1f2b;
export const TONGUE = 0xf27a8a;
export const BLUSH = 0xff7a9a;

export function makeLegs(scene: Phaser.Scene, s: LegStyle): Phaser.GameObjects.Graphics[] {
  return [-1, 1].map((side) => {
    const g = scene.add.graphics();
    const p = new Pen(g, 3);
    const w = s.width ?? 8;
    const sl = s.shoeLen ?? w + 12;
    p.rect(-w / 2, -2, w, s.len + 2, s.skin, 3);
    p.rect(-w / 2 - 3, s.len - 6, sl, 11, s.shoe, 5);
    g.fillStyle(WHITE, 0.35).fillRoundedRect(-w / 2, s.len - 4, sl * 0.45, 3, 1.5);
    if (s.sole !== undefined) {
      g.fillStyle(s.sole, 1).fillRoundedRect(-w / 2 - 2, s.len + 1.5, sl - 2, 3, 1.5);
      g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(-w / 2 - 3, s.len - 6, sl, 11, 5);
    }
    if (s.swoosh) p.line(-w / 2 + 2, s.len - 1, -w / 2 + sl * 0.6, s.len - 4, 2.2, WHITE);
    g.setPosition(side * s.spread, -s.len - 5);
    return g;
  });
}

export function assemble(scene: Phaser.Scene, legs: Phaser.GameObjects.Graphics[], draw: (p: Pen) => void, height: number, width = 80, top = height): Critter {
  const root = scene.add.container(0, 0);
  const body = scene.add.container(0, 0);
  const g = scene.add.graphics();
  draw(new Pen(g, 3.2));
  body.add(g);
  root.add([...legs, body]);
  return { root, body, legs, height, width, top };
}

// мелкие штрихи, которые делают персонажей живыми
export function shine(p: Pen, x: number, y: number, w: number, h: number, a = 0.45) {
  p.flat(WHITE, a).fillEllipse(x, y, w, h);
}
export function blush(p: Pen, x: number, y: number, r = 4) {
  p.flat(BLUSH, 0.55).fillEllipse(x, y, r * 2.2, r * 1.3);
}
export function brow(p: Pen, x1: number, y1: number, x2: number, y2: number, w = 3.2) {
  p.line(x1, y1, x2, y2, w);
}
// большие глаза с двумя бликами
export function bigEye(p: Pen, x: number, y: number, r: number, look = 0.3, iris = OUTLINE) {
  p.circle(x, y, r, WHITE, 2.6);
  p.g.fillStyle(iris, 1).fillCircle(x + r * look, y + r * 0.05, r * 0.58);
  if (iris !== OUTLINE) p.g.fillStyle(OUTLINE, 1).fillCircle(x + r * look, y + r * 0.05, r * 0.32);
  p.g.fillStyle(WHITE, 1).fillCircle(x + r * look + r * 0.2, y - r * 0.22, r * 0.2);
  p.g.fillStyle(WHITE, 0.9).fillCircle(x + r * look - r * 0.18, y + r * 0.25, r * 0.09);
}
// широкий открытый рот с зубами и языком
export function grin(p: Pen, x: number, y: number, w: number, h: number) {
  p.poly([[x - w / 2, y], [x + w / 2, y - h * 0.15], [x + w * 0.35, y + h], [x - w * 0.3, y + h * 0.9]], MOUTH, 2.8);
  p.flat(TONGUE).fillEllipse(x, y + h * 0.75, w * 0.45, h * 0.35);
  p.flat(WHITE).fillRect(x - w / 2 + 3, y + 1, w - 7, Math.max(2.5, h * 0.2));
}

const DRAW: Record<string, (scene: Phaser.Scene) => Critter> = {
  // Тралалеро Тралала: голубая акула в синих кроссовках с галочкой и широченной улыбкой
  tralalero: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x6f9cc8, shoe: 0x2f6fd0, len: 14, spread: 10, width: 9, sole: WHITE, swoosh: true, shoeLen: 22 }), (p) => {
      p.poly([[-16, -30], [-44, -10], [-38, -46]], 0x4f7aa8); // хвост
      p.ellipse(0, -62, 58, 92, 0x6f9cc8);
      p.poly([[-12, -104], [-6, -134], [12, -104]], 0x4f7aa8); // спинной плавник
      p.ellipse(9, -50, 34, 62, 0xf2f6fb, 0); // светлое брюхо
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -62, 58, 92);
      p.poly([[-14, -58], [-40, -40], [-14, -44]], 0x4f7aa8); // плавник-рука
      for (const k of [0, 1, 2]) p.line(-18 + k * 5, -86, -16 + k * 5, -74, 2.4);
      shine(p, -12, -84, 10, 22);
      grin(p, 14, -66, 30, 16);
      for (let i = 0; i < 5; i++) p.flat(WHITE).fillTriangle(2 + i * 6, -67, 7 + i * 6, -67.5, 4.5 + i * 6, -61);
      bigEye(p, 14, -88, 8, 0.35);
      brow(p, 6, -100, 22, -97);
      blush(p, 24, -76, 4);
    }, 138, 90),

  // Шимпанзини Бананини: обезьянка внутри очищенного банана
  chimpanzini: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x7a4a2a, shoe: 0x5a3220, len: 10, spread: 8, width: 8 }), (p) => {
      p.rect(-20, -62, 40, 52, 0xf7d94c, 18); // банан-туловище
      p.flat(0xd9b42a).fillRoundedRect(8, -56, 8, 40, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -62, 40, 52, 18);
      for (const [x, y] of [[-10, -30], [10, -22], [-4, -18]]) p.flat(0x7a5a1a).fillCircle(x, y, 2);
      // голова
      p.circle(-20, -84, 9, 0x7a4a2a);
      p.circle(20, -84, 9, 0x7a4a2a);
      p.circle(-20, -84, 4.5, 0xe0b48a, 0);
      p.circle(20, -84, 4.5, 0xe0b48a, 0);
      p.circle(0, -84, 22, 0x7a4a2a);
      p.ellipse(2, -78, 30, 26, 0xe0b48a, 2.5);
      bigEye(p, -6, -88, 6.5, 0.3);
      bigEye(p, 10, -88, 6.5, 0.3);
      grin(p, 3, -76, 16, 8);
      shine(p, -10, -100, 10, 5);
      // лепестки кожуры вокруг
      p.poly([[-20, -50], [-38, -64], [-34, -42], [-16, -36]], 0xf7d94c);
      p.poly([[20, -50], [40, -66], [34, -42], [16, -36]], 0xf7d94c);
      p.poly([[-8, -54], [0, -40], [8, -54], [0, -60]], 0xf7d94c, 2.6);
      p.circle(-36, -62, 5, 0x7a4a2a, 2.4); // ручки машут
      p.circle(38, -64, 5, 0x7a4a2a, 2.4);
    }, 112, 84),

  // Капучино Ассассино: чашка-ниндзя со злыми глазами и двумя катанами за спиной
  cappuccino: (sc) =>
    assemble(sc, makeLegs(sc, { skin: OUTLINE, shoe: OUTLINE, len: 16, spread: 7, width: 6 }), (p) => {
      for (const s of [-1, 1]) {
        p.line(-s * 6, -30, s * 30, -104, 8); // клинки
        p.line(-s * 6, -30, s * 30, -104, 4.5, 0xc9d3dc);
        p.line(-s * 6, -30, s * 30, -104, 1.5, WHITE);
        p.line(-s * 10, -26, -s * 2, -36, 6, OUTLINE); // рукояти
      }
      p.poly([[-22, -84], [22, -84], [15, -22], [-15, -22]], WHITE);
      p.flat(0xe6e0d6).fillTriangle(8, -82, 20, -82, 13, -24);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([new Phaser.Math.Vector2(-22, -84), new Phaser.Math.Vector2(22, -84), new Phaser.Math.Vector2(15, -22), new Phaser.Math.Vector2(-15, -22)], true);
      p.ellipse(0, -84, 46, 13, 0x7a4a2a);
      p.ellipse(-2, -85, 26, 6, CREAM, 0);
      p.circle(26, -54, 8, WHITE, 3); // ручка чашки
      p.circle(26, -54, 3.5, 0xfff4dc, 0);
      p.rect(-22, -70, 44, 14, OUTLINE, 3, 0); // маска
      p.line(-22, -64, -36, -54, 4); // хвосты повязки
      p.line(-22, -62, -34, -48, 4);
      p.flat(WHITE).fillTriangle(-12, -66, -1, -62, -11, -60);
      p.flat(WHITE).fillTriangle(12, -66, 1, -62, 11, -60);
      p.flat(TOMATO).fillCircle(-7, -62.5, 1.6);
      p.flat(TOMATO).fillCircle(7, -62.5, 1.6);
      p.line(-6, -44, 6, -46, 2.8);
    }, 112, 80),

  // Тунг Тунг Тунг Сахур: полено с огромными глазами и бейсбольной битой
  tungtung: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xb07a4a, shoe: 0x4a2e1e, len: 12, spread: 9, width: 8 }), (p) => {
      p.line(-18, -60, -30, -40, 7); // дальняя рука
      p.line(-18, -60, -30, -40, 3.5, 0xc08a5a);
      p.rect(-22, -118, 44, 104, 0xc08a5a, 14);
      p.flat(0xa8743f).fillRoundedRect(8, -112, 10, 92, 5);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-22, -118, 44, 104, 14);
      p.ellipse(0, -116, 42, 12, 0xe3b585, 2.8);
      p.ellipse(0, -116, 26, 7, 0xd9a46a, 1.6);
      p.ellipse(0, -116, 10, 3, 0xc08a5a, 1.4);
      p.line(-14, -50, -14, -24, 2.2, 0x8a5a33);
      p.line(-6, -40, -6, -20, 2.2, 0x8a5a33);
      p.circle(12, -36, 3.5, 0x8a5a33, 2);
      bigEye(p, -6, -86, 10, 0.1);
      bigEye(p, 14, -86, 10, 0.1);
      brow(p, -16, -102, -1, -98, 3.6);
      brow(p, 6, -98, 22, -102, 3.6);
      p.rect(-6, -66, 26, 11, MOUTH, 5, 2.8);
      p.flat(WHITE).fillRect(-3, -65, 20, 3.5);
      // бита
      p.line(18, -60, 30, -74, 8);
      p.line(18, -60, 30, -74, 4, 0xc08a5a);
      p.poly([[27, -70], [34, -72], [48, -126], [36, -130]], 0xe8c48a);
      p.flat(WHITE, 0.4).fillTriangle(38, -122, 42, -124, 33, -82);
      p.circle(30, -72, 5, 0xc08a5a, 2.6);
    }, 132, 80, 120),

  // Балерина Капучина: голова-чашка, руки аркой над головой, розовая пачка
  ballerina: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xf5d0b0, shoe: 0xf28cb1, len: 26, spread: 5, width: 5, shoeLen: 12 }), (p) => {
      for (const s of [-1, 1]) {
        p.g.lineStyle(7, OUTLINE, 1);
        p.g.beginPath().moveTo(s * 9, -60).lineTo(s * 32, -88).lineTo(s * 26, -114).lineTo(s * 6, -124).strokePath();
        p.g.lineStyle(3.4, 0xf5d0b0, 1);
        p.g.beginPath().moveTo(s * 9, -60).lineTo(s * 32, -88).lineTo(s * 26, -114).lineTo(s * 6, -124).strokePath();
      }
      p.circle(0, -125, 6, 0xf5d0b0, 2.6); // сомкнутые ладони
      // пачка с оборками
      for (let i = -3; i <= 3; i++) p.circle(i * 9, -30, 7, 0xf9a8c9, 2.4);
      p.ellipse(0, -34, 66, 16, 0xf9a8c9);
      p.ellipse(0, -38, 50, 12, 0xfbc3da);
      p.rect(-9, -62, 18, 26, 0xf28cb1, 6);
      p.flat(WHITE, 0.4).fillRect(-6, -58, 3, 18);
      // голова-чашка
      p.poly([[-20, -100], [20, -100], [14, -64], [-14, -64]], WHITE);
      p.circle(22, -84, 6, WHITE, 2.8);
      p.ellipse(0, -100, 40, 11, 0x7a4a2a);
      p.ellipse(-1, -101, 24, 6, CREAM, 0);
      p.flat(0x7a4a2a).fillCircle(-3, -102, 1.8).fillCircle(1, -102, 1.8).fillTriangle(-5, -101.5, 3, -101.5, -1, -98.5);
      bigEye(p, -6, -84, 5.5, 0.2);
      bigEye(p, 8, -84, 5.5, 0.2);
      for (const x of [-6, 8]) {
        p.line(x - 5, -90, x - 7, -93, 1.8);
        p.line(x + 4, -90, x + 6, -93, 1.8);
      }
      p.smile(1, -74, 9);
      blush(p, -12, -76, 3.5);
      blush(p, 14, -76, 3.5);
    }, 138, 84, 102),

  // Бомбардиро Крокодило: крокодил-бомбардировщик с бомбами под крыльями (летает)
  bombardiro: (sc) =>
    assemble(sc, [], (p) => {
      p.poly([[-26, -10], [10, -10], [-8, -42], [-36, -42]], 0x5f7350); // дальнее крыло
      p.poly([[-62, -8], [-82, -32], [-70, -2]], 0x6b7f5a); // хвост
      p.poly([[-62, -6], [-80, 4], [-64, 6]], 0x5f7350);
      p.rect(-70, -16, 98, 30, 0x7d9068, 14);
      p.flat(0x9cb084).fillRoundedRect(-60, -12, 70, 6, 3);
      for (let i = 0; i < 4; i++) p.flat(0x5f7350).fillCircle(-50 + i * 16, 6, 3);
      p.circle(-40, -2, 5, 0xa9c4d8, 2.4);
      p.circle(-22, -2, 5, 0xa9c4d8, 2.4);
      // крокодилья голова
      p.poly([[20, -18], [72, -12], [76, 2], [22, 12]], 0x5e9c3a);
      p.poly([[24, 4], [72, 2], [70, 12], [26, 16]], 0x4f8a2f);
      for (let i = 0; i < 6; i++) p.flat(WHITE).fillTriangle(30 + i * 7, 2, 35 + i * 7, 2, 32.5 + i * 7, 8);
      p.circle(70, -10, 2, OUTLINE, 0);
      p.circle(30, -22, 9, 0x5e9c3a);
      bigEye(p, 31, -23, 7, 0.35, 0xf2c94c);
      brow(p, 22, -34, 40, -30);
      // ближнее крыло с бомбой
      p.poly([[-24, 6], [16, 6], [30, 32], [-10, 32]], 0x6b7f5a);
      p.ellipse(-2, 40, 24, 11, 0x3a3a46);
      p.poly([[-16, 40], [-22, 34], [-22, 46]], 0x3a3a46, 2);
      // мешок с деньгами
      p.circle(-36, 34, 13, 0xc89b5a);
      p.poly([[-41, 20], [-31, 20], [-27, 13], [-45, 13]], 0xc89b5a, 2.4);
      p.g.fillStyle(OUTLINE, 1);
      p.g.fillRect(-40, 32, 8, 2.5);
      p.g.fillRect(-37.5, 28, 2.5, 11);
    }, 64, 160),

  // Триппи Троппи: креветка с большой кошачьей головой
  trippi: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xff8a5c, shoe: 0xe4472b, len: 8, spread: 7, width: 6 }), (p) => {
      p.poly([[-26, -12], [-42, -2], [-36, -18], [-42, -28], [-24, -22]], 0xff7a4a);
      p.circle(-16, -20, 9, 0xff8a5c);
      p.circle(-12, -34, 11, 0xff8a5c);
      p.circle(-4, -50, 13, 0xff9b6e);
      for (const [x, y] of [[-16, -20], [-12, -34], [-4, -50]]) p.flat(0xffc2a0).fillEllipse(x + 3, y - 3, 6, 4);
      p.poly([[-12, -82], [-10, -102], [2, -88]], 0xffb08a); // уши
      p.poly([[14, -88], [24, -102], [26, -80]], 0xffb08a);
      p.flat(0xff7aa0).fillTriangle(-9, -86, -9, -97, -2, -88).fillTriangle(16, -88, 23, -97, 23, -83);
      p.circle(6, -74, 20, 0xffb08a);
      shine(p, -4, -86, 10, 5);
      bigEye(p, -2, -77, 6.5, 0.3, 0x7ac74f);
      bigEye(p, 13, -77, 6.5, 0.3, 0x7ac74f);
      p.poly([[5, -67], [10, -67], [7.5, -64]], 0xe4472b, 1.8);
      p.smile(7.5, -61, 8);
      for (const d of [-3, 3]) {
        p.line(16, -64 + d, 34, -66 + d * 2, 1.6);
        p.line(-2, -64 + d, -18, -66 + d * 2, 1.6);
      }
    }, 108, 80),

  // Бонека Амбалабу: лягушачья голова, туловище-шина, человеческие ноги
  boneca: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd9a37a, shoe: 0x3a3a3a, len: 16, spread: 9, width: 9 }), (p) => {
      p.circle(0, -40, 24, 0x2b2b2b);
      for (let a = 0; a < 12; a++) {
        const r = (a / 12) * Math.PI * 2;
        p.line(Math.cos(r) * 18, -40 + Math.sin(r) * 18, Math.cos(r) * 23, -40 + Math.sin(r) * 23, 2, 0x555555);
      }
      p.circle(0, -40, 11, 0x8a8a8a, 2.8);
      p.circle(0, -40, 5, 0x555555, 2);
      p.ellipse(0, -78, 54, 32, 0x67b04f);
      p.flat(0xa8d88a).fillEllipse(2, -70, 34, 12);
      p.circle(-14, -92, 11, 0x67b04f);
      p.circle(14, -92, 11, 0x67b04f);
      bigEye(p, -14, -93, 7.5, 0.1);
      bigEye(p, 14, -93, 7.5, 0.1);
      p.g.lineStyle(3, OUTLINE, 1);
      p.g.beginPath();
      p.g.arc(0, -82, 18, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false);
      p.g.strokePath();
      blush(p, -18, -74, 4);
      blush(p, 18, -74, 4);
    }, 112, 80),

  // Брр Брр Патапим: пень-обезьяна с кроной, огромным носом и гигантскими ступнями
  patapim: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x7a5a3a, shoe: 0xe8b88a, len: 12, spread: 11, width: 9, shoeLen: 30 }), (p) => {
      p.circle(-18, -118, 15, 0x4f8a3a);
      p.circle(14, -124, 18, LEAF);
      p.circle(0, -110, 15, 0x6fb04a);
      p.rect(-20, -108, 40, 94, 0x7a5a3a, 10);
      p.flat(0x5f4429).fillRoundedRect(8, -100, 9, 80, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -108, 40, 94, 10);
      p.line(-10, -50, -10, -24, 2.2, 0x4a3420);
      p.ellipse(4, -78, 34, 32, 0xe0b48a);
      bigEye(p, -4, -84, 6.5, 0.35);
      bigEye(p, 12, -84, 6.5, 0.35);
      brow(p, -10, -94, 2, -92);
      p.ellipse(18, -70, 30, 15, 0xd99a7a, 3); // огромный нос
      shine(p, 14, -74, 10, 4, 0.6);
      p.smile(4, -60, 10);
      p.line(18, -50, 34, -74, 5, 0x7a5a3a);
      p.line(18, -50, 34, -74, 5, OUTLINE);
      p.line(18, -50, 34, -74, 2, 0x7a5a3a);
      p.circle(36, -78, 6, LEAF, 2.4);
    }, 142, 84),

  // Лирили Ларила: слон-кактус в сандалиях с карманными часами
  lirili: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x9aa3ad, shoe: 0xa86a3a, len: 12, spread: 9, width: 11 }), (p) => {
      p.rect(-18, -76, 36, 62, 0x5e9c3a, 16);
      p.flat(0x7ab84f).fillRoundedRect(-12, -70, 8, 50, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-18, -76, 36, 62, 16);
      p.line(-4, -72, -4, -18, 2.2, 0x467a2a);
      p.line(8, -72, 8, -18, 2.2, 0x467a2a);
      for (const [x, y] of [[-18, -54], [18, -40], [-18, -30], [18, -62], [-18, -66]]) p.line(x, y, x + Math.sign(x) * 7, y - 4, 2);
      // часы в руке
      p.circle(-26, -46, 9, AMBER, 2.8);
      p.circle(-26, -46, 6, CREAM, 1.8);
      p.line(-26, -46, -26, -50, 1.6);
      p.line(-26, -46, -23, -46, 1.6);
      // голова слона
      p.ellipse(-16, -96, 26, 34, 0xb5bec8);
      p.flat(0xf2b6c4).fillEllipse(-16, -95, 14, 22);
      p.circle(4, -96, 22, 0x9aa3ad);
      shine(p, -4, -110, 12, 5);
      bigEye(p, 10, -100, 6.5, 0.35);
      p.rect(16, -96, 12, 40, 0x9aa3ad, 6, 3); // хобот
      p.line(17, -84, 27, -84, 1.6);
      p.line(17, -74, 27, -74, 1.6);
      p.poly([[22, -86], [36, -80], [24, -78]], WHITE, 2.4); // бивень
      blush(p, 2, -86, 3.5);
    }, 128, 84),

  // Фриго Камело: верблюд-холодильник в ботинках
  frigo: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd9b07a, shoe: 0x8a5a3a, len: 20, spread: 11, width: 8 }), (p) => {
      p.circle(-14, -84, 11, 0xd9b07a); // горб
      p.rect(-26, -84, 52, 60, 0xeef3f6, 8);
      p.flat(0xd5dee5).fillRect(14, -80, 8, 52);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-26, -84, 52, 60, 8);
      p.line(-26, -60, 26, -60, 3);
      p.line(16, -78, 16, -66, 4, 0x9aa3ad);
      p.line(16, -54, 16, -38, 4, 0x9aa3ad);
      p.rect(-18, -50, 16, 10, 0x7ac7e8, 3, 2); // наклейка-снежинка
      p.rect(16, -114, 12, 40, 0xd9b07a, 6); // шея
      p.ellipse(30, -116, 34, 22, 0xd9b07a);
      p.ellipse(42, -110, 14, 11, 0xc49a62, 2.6);
      p.flat(OUTLINE).fillCircle(44, -112, 1.6);
      p.ellipse(22, -128, 8, 12, 0xd9b07a, 2.6);
      bigEye(p, 30, -120, 6, 0.4);
      brow(p, 24, -129, 36, -128, 2.6);
      p.smile(38, -104, 8);
    }, 136, 84),

  // Ла Вака Сатурно Сатурнита: корова-планета с кольцами Сатурна
  vaca: (sc) =>
    assemble(sc, makeLegs(sc, { skin: WHITE, shoe: 0x3a3a3a, len: 12, spread: 10, width: 8 }), (p) => {
      const ring = (from: number, to: number) => {
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i <= 24; i++) {
          const a = from + ((to - from) * i) / 24;
          pts.push(new Phaser.Math.Vector2(Math.cos(a) * 44, -48 + Math.sin(a) * 13));
        }
        p.g.lineStyle(13, OUTLINE, 1).strokePoints(pts, false);
        p.g.lineStyle(7.5, 0xe9c46a, 1).strokePoints(pts, false);
      };
      ring(Math.PI, Math.PI * 2); // задняя половина кольца
      p.circle(0, -54, 30, WHITE);
      p.flat(OUTLINE).fillCircle(-14, -66, 8).fillCircle(14, -38, 7).fillCircle(20, -70, 4);
      shine(p, -10, -74, 14, 6);
      ring(0, Math.PI); // передняя половина поверх тела
      p.poly([[-18, -80], [-30, -96], [-12, -86]], CREAM, 2.6);
      p.poly([[18, -80], [30, -96], [12, -86]], CREAM, 2.6);
      p.ellipse(-28, -72, 14, 8, WHITE, 2.4);
      p.ellipse(28, -72, 14, 8, WHITE, 2.4);
      bigEye(p, -8, -62, 6.5, 0.2);
      bigEye(p, 8, -62, 6.5, 0.2);
      p.ellipse(0, -48, 24, 13, 0xf4a6b8, 2.8);
      p.flat(OUTLINE).fillCircle(-5, -48, 2).fillCircle(5, -48, 2);
      for (const [x, y] of [[-40, -88], [38, -92], [44, -30]]) p.flat(0xffd86b).fillCircle(x, y, 2.5);
    }, 104, 100),

  // Бомбомбини Гусини: гусь с реактивными двигателями и военной каской
  gusini: (sc) =>
    assemble(sc, makeLegs(sc, { skin: AMBER, shoe: 0xe48a2b, len: 12, spread: 7, width: 5, shoeLen: 18 }), (p) => {
      p.rect(-32, -64, 16, 30, 0x8a96a3, 6); // двигатель
      p.flat(0xb5bec8).fillRect(-29, -60, 4, 22);
      p.poly([[-32, -34], [-16, -34], [-24, -16]], TOMATO, 2.4);
      p.flat(AMBER).fillTriangle(-29, -34, -19, -34, -24, -24);
      p.ellipse(0, -42, 46, 38, WHITE);
      p.poly([[-20, -46], [-4, -40], [-18, -32]], 0xe6ecf2, 2.4); // крыло
      p.rect(2, -100, 16, 54, WHITE, 8);
      p.circle(12, -102, 14, WHITE);
      p.poly([[22, -106], [42, -100], [22, -94]], AMBER, 2.8);
      p.line(23, -100, 38, -100, 1.6);
      bigEye(p, 14, -106, 5.5, 0.4);
      brow(p, 8, -113, 20, -111, 2.8);
      p.ellipse(10, -116, 34, 14, 0x5e7a4a); // каска
      p.rect(-6, -116, 32, 5, 0x4a6038, 2, 2.4);
      p.flat(0xffd86b).fillCircle(12, -120, 2.5);
    }, 128, 84),
};

Object.assign(DRAW, DRAW2, DRAW3);
export const BRAINROT_IDS = Object.keys(DRAW);

// Маскот-зазывала: Тунг Тунг с мегафоном, поднятой битой и щитом-рекламой на груди.
// Уровень 1 — нищий: картонка и бумажный рупор. 2 — красная кепка и жёлтый мегафон. 3 — корона и всё золотое.
// Надпись на щите добавляет сцена (текст на языке игрока). Щит: x −31…31, y −58…−14.
export function drawMascot(scene: Phaser.Scene, level = 2): Critter {
  return bakeCritter(drawMascotShapes(scene, level), `mascot:${level}`);
}

function drawMascotShapes(scene: Phaser.Scene, level: number): Critter {
  const gold = 0xffcf3f;
  const shoe = level >= 3 ? gold : level === 2 ? TOMATO : 0x6a5a4a;
  return assemble(scene, makeLegs(scene, { skin: 0xb07a4a, shoe, len: 14, spread: 10, width: 8, sole: level >= 2 ? WHITE : undefined, swoosh: level >= 2 }), (p) => {
    // поднятая рука с битой
    p.line(16, -62, 38, -92, 8);
    p.line(16, -62, 38, -92, 4, 0xc08a5a);
    p.poly([[34, -90], [41, -94], [70, -148], [58, -154]], level >= 3 ? gold : 0xe8c48a);
    p.flat(WHITE, 0.4).fillTriangle(60, -146, 64, -148, 42, -100);
    if (level === 1) p.rect(52, -132, 10, 6, 0xc8c0b0, 1, 2); // пластырь на бите
    p.circle(38, -93, 5.5, 0xc08a5a, 2.6);
    // полено
    p.rect(-22, -118, 44, 104, 0xc08a5a, 14);
    p.flat(0xa8743f).fillRoundedRect(8, -112, 10, 92, 5);
    p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-22, -118, 44, 104, 14);
    p.ellipse(0, -116, 42, 12, 0xe3b585, 2.8);
    p.ellipse(0, -116, 26, 7, 0xd9a46a, 1.6);
    if (level === 2) {
      // кепка козырьком набок
      p.poly([[-20, -118], [-16, -134], [14, -136], [20, -118]], TOMATO, 2.8);
      p.poly([[14, -122], [36, -120], [34, -114], [16, -116]], TOMATO, 2.6);
      p.circle(-2, -136, 3, 0xffd86b, 2);
    } else if (level >= 3) {
      // корона
      p.poly([[-20, -116], [-22, -146], [-10, -132], [0, -152], [10, -132], [22, -146], [20, -116]], gold, 2.8);
      p.circle(0, -126, 4, TOMATO, 2);
      p.circle(-12, -124, 3, 0x3d6fb6, 1.8);
      p.circle(12, -124, 3, 0x2f9e5a, 1.8);
      p.flat(WHITE, 0.5).fillRect(-16, -140, 3, 18);
    } else {
      // нищий: пучок соломы и заплатка
      for (let i = -3; i <= 3; i++) p.line(i * 4, -120, i * 6, -132 - Math.abs(i) * 2, 2, 0xd9b45a);
      p.rect(-18, -48, 12, 10, 0x8a8aa0, 1, 2);
    }
    // глаза навыкате и брови домиком
    bigEye(p, -6, -92, 11, 0.15);
    bigEye(p, 15, -92, 11, 0.15);
    brow(p, -18, -110, -2, -106, 3.8);
    brow(p, 4, -106, 24, -110, 3.8);
    // орущий рот
    p.ellipse(4, -70, 22, 14, MOUTH, 2.8);
    p.flat(WHITE).fillRect(-4, -76, 16, 3.5);
    p.flat(0xf28c8c).fillEllipse(4, -66, 10, 5);
    if (level >= 3) {
      // золотая цепь
      p.g.lineStyle(3, gold, 1).beginPath().arc(2, -66, 22, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(150), false).strokePath();
    }
    // щит-реклама на лямках
    const strap = level === 1 ? 0xc8b88a : 0x5a3a1a;
    p.line(-20, -58, -18, -104, 3, strap);
    p.line(20, -58, 18, -104, 3, strap);
    if (level === 1) {
      p.poly([[-31, -56], [30, -60], [31, -13], [-29, -15]], 0xc49a62, 3); // кривая картонка
      p.line(-24, -22, -10, -18, 1.5, 0x8a6a3a);
    } else {
      p.rect(-31, -58, 62, 44, level >= 3 ? 0x7a1f3a : 0xfff4dc, 5, 3);
      p.flat(level >= 3 ? gold : TOMATO).fillRect(-29.5, -56.5, 59, 8);
      p.line(-31, -48, 31, -48, 2);
      if (level >= 3) p.g.lineStyle(2, gold, 1).strokeRoundedRect(-28, -45, 56, 28, 3);
    }
    // рука с мегафоном у рта
    p.line(-20, -60, -34, -66, 8);
    p.line(-20, -60, -34, -66, 4, 0xc08a5a);
    if (level === 1) {
      // рупор из свёрнутой газеты
      p.poly([[-12, -74], [-12, -66], [-42, -58], [-42, -84]], 0xe8e0d0, 3);
      for (let i = 0; i < 3; i++) p.line(-18 - i * 7, -72 + i, -18 - i * 7, -66 - i, 1.2, 0x9a9aa8);
    } else {
      const col = level >= 3 ? gold : 0xffd86b;
      p.poly([[-12, -76], [-12, -64], [-44, -54], [-44, -88]], col, 3);
      p.ellipse(-44, -71, 10, 34, level >= 3 ? 0xffe9a8 : 0xffb02e, 3);
      p.ellipse(-44, -71, 5, 24, 0x7a1f2b, 0);
      p.rect(-30, -66, 7, 12, 0x5a5270, 2, 2.4);
      p.flat(WHITE, 0.5).fillTriangle(-14, -74, -40, -84, -40, -80);
    }
  }, 132, 96, level >= 3 ? 152 : 136);
}

// Насколько подробно запекать персонажей в текстуры (сцена ставит по размеру экрана).
let BAKE_RES = 2;
export function setBakeRes(r: number) {
  BAKE_RES = r;
}

// Ноги и тело персонажа превращаются из фигур в картинки (см. bake.ts): выглядит так же, но не грузит телефон.
export function bakeCritter(c: Critter, key: string): Critter {
  c.legs = c.legs.map((l, i) => (l instanceof Phaser.GameObjects.Graphics ? bake(l, BAKE_RES, `${key}:l${i}`) : l));
  [...c.body.list].forEach((o, i) => {
    if (o instanceof Phaser.GameObjects.Graphics) bake(o, BAKE_RES, `${key}:b${i}`);
  });
  return c;
}

export function drawBrainrot(scene: Phaser.Scene, id: string): Critter {
  const key = DRAW[id] ? id : 'tralalero';
  return bakeCritter(DRAW[key](scene), `br:${key}`);
}
