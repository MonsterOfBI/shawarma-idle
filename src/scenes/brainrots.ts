import Phaser from 'phaser';
import { AMBER, CREAM, LEAF, OUTLINE, Pen, TOMATO, WHITE } from './draw';

// Итальянские брейнроты из фигур. Ноги внизу в точке (0, 0), смотрят вправо.
// Ноги — отдельные Graphics, чтобы ими шагать.

export interface Critter {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  legs: Phaser.GameObjects.Graphics[];
  height: number;
}

interface LegStyle {
  skin: number;
  shoe: number;
  len: number;
  spread: number;
  width?: number;
  sole?: number;
  swoosh?: boolean;
}

function makeLegs(scene: Phaser.Scene, s: LegStyle): Phaser.GameObjects.Graphics[] {
  return [-1, 1].map((side) => {
    const g = scene.add.graphics();
    const p = new Pen(g, 2.5);
    const w = s.width ?? 7;
    p.rect(-w / 2, -2, w, s.len + 2, s.skin, 3);
    p.rect(-w / 2 - 2, s.len - 4, w + 10, 8, s.shoe, 4);
    if (s.sole !== undefined) g.fillStyle(s.sole, 1).fillRect(-w / 2 - 1, s.len + 1.5, w + 8, 2);
    if (s.swoosh) p.line(-w / 2 + 1, s.len - 1, -w / 2 + 7, s.len - 2.5, 1.6, 0x2f6fd0);
    g.setPosition(side * s.spread, -s.len - 4);
    return g;
  });
}

function assemble(scene: Phaser.Scene, legs: Phaser.GameObjects.Graphics[], draw: (p: Pen) => void, height: number): Critter {
  const root = scene.add.container(0, 0);
  const body = scene.add.container(0, 0);
  const g = scene.add.graphics();
  draw(new Pen(g, 3));
  body.add(g);
  root.add([...legs, body]);
  return { root, body, legs, height };
}

const DRAW: Record<string, (scene: Phaser.Scene) => Critter> = {
  // Тралалеро Тралала: акула в синих кроссовках
  tralalero: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x6f8fb3, shoe: 0x2f6fd0, len: 12, spread: 7, sole: WHITE, swoosh: true }), (p) => {
      p.poly([[-16, -20], [-26, -4], [-8, -14]], 0x5b7ba0); // хвост
      p.ellipse(0, -44, 36, 62, 0x6f8fb3);
      p.poly([[-6, -70], [-14, -86], [4, -72]], 0x5b7ba0); // спинной плавник
      p.ellipse(5, -38, 20, 40, 0xf2f6fb, 0);
      p.poly([[-16, -44], [-30, -34], [-14, -36]], 0x5b7ba0);
      p.eye(6, -60, 4.5);
      p.poly([[0, -50], [16, -48], [14, -42], [2, -44]], 0x7a1f2b, 2);
      p.flat(WHITE).fillTriangle(3, -48, 6, -48, 4.5, -45);
      p.flat(WHITE).fillTriangle(8, -48, 11, -47, 9.5, -44.5);
    }, 86),

  // Шимпанзини Бананини: обезьянка в банановой кожуре
  chimpanzini: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x7a4a2a, shoe: 0x5a3220, len: 10, spread: 6 }), (p) => {
      p.rect(-15, -48, 30, 38, 0xf7d94c, 12);
      p.circle(-12, -56, 6, 0x7a4a2a);
      p.circle(12, -56, 6, 0x7a4a2a);
      p.circle(0, -56, 14, 0x7a4a2a);
      p.ellipse(2, -53, 18, 15, 0xe0b48a, 0);
      p.eye(-3, -58, 3.5);
      p.eye(6, -58, 3.5);
      p.smile(2, -50, 8);
      // лепестки кожуры
      p.poly([[-15, -40], [-24, -58], [-8, -46]], 0xf7d94c);
      p.poly([[15, -40], [24, -60], [8, -46]], 0xf7d94c);
      p.poly([[-4, -44], [0, -36], [4, -44]], 0xf7d94c, 2);
      p.line(-10, -30, -10, -16, 2, 0xc9a42a);
      p.line(8, -32, 8, -16, 2, 0xc9a42a);
    }, 72),

  // Капучино Ассассино: чашка-ниндзя с катаной
  cappuccino: (sc) =>
    assemble(sc, makeLegs(sc, { skin: OUTLINE, shoe: OUTLINE, len: 14, spread: 6, width: 5 }), (p) => {
      p.line(14, -40, 30, -64, 4, 0xc9d3dc); // катана
      p.line(12, -37, 16, -43, 5, OUTLINE);
      p.poly([[-16, -58], [16, -58], [11, -18], [-11, -18]], WHITE);
      p.ellipse(0, -58, 32, 10, 0x7a4a2a);
      p.ellipse(-2, -59, 18, 5, CREAM, 0);
      p.rect(-16, -46, 32, 8, OUTLINE, 0, 0); // повязка
      p.flat(WHITE).fillTriangle(-7, -43, -1, -41, -6, -40);
      p.flat(WHITE).fillTriangle(7, -43, 1, -41, 6, -40);
      p.line(-16, -42, -24, -36, 3, OUTLINE);
      p.circle(19, -36, 6, WHITE, 2.5); // ручка чашки
      p.line(-5, -30, 5, -30, 2.4);
    }, 80),

  // Тунг Тунг Тунг Сахур: полено с битой
  tungtung: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xc08a5a, shoe: 0x5a3a2a, len: 10, spread: 7 }), (p) => {
      p.rect(-16, -76, 32, 64, 0xc08a5a, 10);
      p.ellipse(0, -74, 30, 9, 0xe3b585, 2.5);
      p.ellipse(0, -74, 14, 4, 0xc08a5a, 1.5);
      p.line(-10, -40, -10, -20, 2, 0x8a5a33);
      p.line(-4, -34, -4, -18, 2, 0x8a5a33);
      p.eye(-4, -56, 6, 0.2);
      p.eye(8, -56, 6, 0.2);
      p.poly([[-6, -42], [12, -42], [3, -34]], 0x7a1f2b, 2);
      p.line(14, -38, 26, -50, 7, OUTLINE);
      p.line(14, -38, 26, -50, 3.5, 0xc08a5a);
      p.rect(22, -80, 9, 38, 0xe8c48a, 4.5, 2.5); // бита
      p.circle(26, -48, 4, 0xc08a5a, 2.5);
    }, 86),

  // Балерина Капучина: чашка-голова и пачка
  ballerina: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xf5d0b0, shoe: 0xf28cb1, len: 18, spread: 4, width: 4 }), (p) => {
      p.ellipse(0, -24, 46, 14, 0xf9a8c9);
      p.ellipse(0, -28, 38, 12, 0xfbc3da);
      p.rect(-7, -46, 14, 20, 0xf9a8c9, 5);
      for (const sx of [-1, 1]) {
        p.line(sx * 7, -42, sx * 18, -62, 5.5, OUTLINE);
        p.line(sx * 7, -42, sx * 18, -62, 2.5, 0xf5d0b0);
      }
      p.poly([[-14, -74], [14, -74], [10, -48], [-10, -48]], WHITE);
      p.ellipse(0, -74, 28, 8, 0x7a4a2a);
      p.ellipse(-2, -75, 14, 4, CREAM, 0);
      p.eye(-4, -62, 3);
      p.eye(5, -62, 3);
      p.smile(1, -55, 7);
      p.flat(0xf28cb1, 0.5).fillCircle(-8, -56, 3);
      p.flat(0xf28cb1, 0.5).fillCircle(10, -56, 3);
    }, 84),

  // Бомбардиро Крокодило: крокодил-бомбардировщик (летает)
  bombardiro: (sc) =>
    assemble(sc, [], (p) => {
      p.poly([[-24, -6], [6, -6], [-8, -30], [-30, -30]], 0x5f7350); // дальнее крыло
      p.poly([[-50, -6], [-66, -22], [-58, -2]], 0x6b7f5a); // хвост
      p.rect(-56, -10, 80, 22, 0x7d9068, 10);
      p.poly([[-22, 4], [10, 4], [22, 24], [-8, 24]], 0x6b7f5a); // ближнее крыло
      p.poly([[20, -10], [56, -6], [58, 4], [22, 8]], 0x5e9c3a); // морда
      p.flat(WHITE).fillTriangle(30, 4, 34, 4, 32, 8);
      p.flat(WHITE).fillTriangle(40, 4, 44, 4, 42, 8);
      p.flat(WHITE).fillTriangle(50, 3, 54, 3, 52, 7);
      p.eye(26, -12, 5);
      p.circle(-30, -2, 4, 0xa9c4d8, 2);
      p.circle(-14, -2, 4, 0xa9c4d8, 2);
      // мешок с деньгами
      p.circle(-4, 30, 11, 0xc89b5a);
      p.poly([[-8, 18], [0, 18], [4, 12], [-12, 12]], 0xc89b5a, 2);
      p.g.fillStyle(OUTLINE, 1);
      p.g.fillRect(-7, 28, 6, 2);
      p.g.fillRect(-5, 25, 2, 9);
    }, 60),

  // Триппи Троппи: креветка с кошачьей мордой
  trippi: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xff8a5c, shoe: 0xe4472b, len: 8, spread: 6, width: 5 }), (p) => {
      p.circle(-12, -16, 7, 0xff8a5c);
      p.circle(-10, -28, 9, 0xff8a5c);
      p.circle(-4, -40, 11, 0xff9b6e);
      p.poly([[-20, -12], [-30, -4], [-18, -6]], 0xff8a5c, 2);
      p.circle(4, -56, 15, 0xffb08a);
      p.poly([[-8, -66], [-6, -78], [0, -68]], 0xffb08a);
      p.poly([[8, -68], [14, -78], [16, -64]], 0xffb08a);
      p.eye(0, -58, 4);
      p.eye(10, -58, 4);
      p.circle(6, -51, 2, 0xe4472b, 1.5);
      p.line(12, -50, 24, -52, 1.4);
      p.line(12, -48, 24, -46, 1.4);
      p.line(0, -50, -10, -52, 1.4);
    }, 80),

  // Бонека Амбалабу: лягушка в шине
  boneca: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd9a37a, shoe: 0x3a3a3a, len: 14, spread: 7 }), (p) => {
      p.circle(0, -30, 18, 0x2b2b2b);
      p.circle(0, -30, 9, 0x6b6b6b, 2.5);
      p.line(-14, -40, -8, -36, 1.6, 0x555555);
      p.line(10, -44, 14, -38, 1.6, 0x555555);
      p.ellipse(0, -58, 36, 22, 0x67b04f);
      p.circle(-9, -68, 7, 0x67b04f);
      p.circle(9, -68, 7, 0x67b04f);
      p.eye(-9, -68, 4.5, 0.1);
      p.eye(9, -68, 4.5, 0.1);
      p.smile(0, -54, 14);
    }, 80),

  // Брр Брр Патапим: дерево-обезьяна с огромными ступнями
  patapim: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x7a5a3a, shoe: 0xe8b88a, len: 12, spread: 9, width: 8 }), (p) => {
      p.circle(-14, -88, 12, LEAF);
      p.circle(10, -92, 14, 0x4f8a3a);
      p.circle(0, -80, 12, LEAF);
      p.rect(-15, -78, 30, 64, 0x7a5a3a, 8);
      p.line(-8, -60, -8, -24, 2, 0x5a3f28);
      p.ellipse(3, -58, 24, 22, 0xe0b48a);
      p.eye(-3, -62, 4);
      p.eye(9, -62, 4);
      p.ellipse(10, -52, 16, 9, 0xd99a7a, 2.5); // нос
      p.line(14, -40, 26, -56, 4, 0x7a5a3a);
      p.circle(27, -58, 4, LEAF, 2);
    }, 100),

  // Лирили Ларила: слон-кактус в сандалиях
  lirili: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x9aa3ad, shoe: 0xa86a3a, len: 12, spread: 8, width: 9 }), (p) => {
      p.rect(-14, -58, 28, 46, 0x5e9c3a, 12);
      p.line(-6, -54, -6, -16, 2, 0x467a2a);
      p.line(5, -54, 5, -16, 2, 0x467a2a);
      for (const [x, y] of [[-14, -40], [14, -30], [-14, -24], [14, -48]]) p.line(x, y, x + Math.sign(x) * 5, y - 3, 1.6);
      p.ellipse(-12, -70, 20, 26, 0xb5bec8); // ухо
      p.circle(4, -70, 16, 0x9aa3ad);
      p.eye(8, -74, 4);
      p.rect(12, -70, 9, 30, 0x9aa3ad, 4.5, 2.5); // хобот
      p.poly([[16, -64], [24, -60], [17, -58]], WHITE, 2);
    }, 90),

  // Фриго Камело: верблюд-холодильник
  frigo: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd9b07a, shoe: 0x8a6a4a, len: 20, spread: 9, width: 6 }), (p) => {
      p.rect(-20, -64, 40, 44, 0xeef3f6, 6);
      p.line(-20, -46, 20, -46, 2.4);
      p.line(13, -60, 13, -50, 3, 0x9aa3ad);
      p.line(13, -42, 13, -30, 3, 0x9aa3ad);
      p.circle(-8, -66, 8, 0xd9b07a);
      p.rect(14, -86, 9, 30, 0xd9b07a, 4); // шея
      p.ellipse(24, -88, 24, 15, 0xd9b07a);
      p.eye(26, -91, 3.5);
      p.circle(34, -86, 1.6, OUTLINE, 0);
    }, 100),

  // Ла Вака Сатурно Сатурнита: корова с кольцами Сатурна
  vaca: (sc) =>
    assemble(sc, makeLegs(sc, { skin: WHITE, shoe: 0x3a3a3a, len: 12, spread: 8, width: 7 }), (p) => {
      p.ellipse(0, -42, 54, 18, 0xe9c46a, 3);
      p.circle(0, -46, 22, WHITE);
      p.flat(OUTLINE).fillCircle(-10, -54, 6);
      p.flat(OUTLINE).fillCircle(8, -34, 5);
      p.ellipse(0, -36, 40, 10, 0xe9c46a, 0); // кольцо поверх тела
      p.g.lineStyle(3, OUTLINE, 1).strokeEllipse(0, -36, 40, 10);
      p.poly([[-14, -66], [-22, -76], [-10, -70]], CREAM, 2);
      p.poly([[14, -66], [22, -76], [10, -70]], CREAM, 2);
      p.eye(-6, -52, 4);
      p.eye(6, -52, 4);
      p.ellipse(0, -42, 18, 9, 0xf4a6b8, 2.5);
    }, 86),

  // Бомбомбини Гусини: гусь с реактивными двигателями
  gusini: (sc) =>
    assemble(sc, makeLegs(sc, { skin: AMBER, shoe: 0xe48a2b, len: 12, spread: 6, width: 4 }), (p) => {
      p.rect(-24, -44, 12, 22, 0x8a96a3, 4); // двигатель
      p.poly([[-24, -22], [-12, -22], [-18, -10]], TOMATO, 2);
      p.ellipse(0, -34, 36, 30, WHITE);
      p.rect(2, -74, 12, 36, WHITE, 6);
      p.circle(10, -76, 10, WHITE);
      p.poly([[17, -78], [30, -74], [17, -70]], AMBER, 2.5);
      p.eye(11, -79, 3.2);
      p.rect(0, -88, 20, 6, 0x5e7a4a, 3, 2); // каска
    }, 100),
};

export const BRAINROT_IDS = Object.keys(DRAW);

export function drawBrainrot(scene: Phaser.Scene, id: string): Critter {
  return (DRAW[id] ?? DRAW.tralalero)(scene);
}
