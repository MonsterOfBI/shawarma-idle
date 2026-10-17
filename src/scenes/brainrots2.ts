import Phaser from 'phaser';
import type { Critter } from './brainrots';
import { assemble, bigEye, blush, brow, grin, makeLegs, MOUTH, shine, TONGUE } from './brainrots';
import { AMBER, OUTLINE, Pen, TOMATO, WHITE } from './draw';

// Новые популярные брейнроты (по одной группе на локацию).
// Тот же стиль, что в brainrots.ts: ноги в (0, 0), смотрят вправо, толстая обводка.

type Pt = [number, number];

// точки дуги (для полукругов, скорлупы, колокола медузы)
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// линия-ломаная с обводкой (руки, щупальца, макароны)
function tube(p: Pen, pts: Pt[], w: number, color: number) {
  const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  p.g.lineStyle(w + 4.5, OUTLINE, 1).strokePoints(v, false);
  p.g.lineStyle(w, color, 1).strokePoints(v, false);
  p.flat(OUTLINE).fillCircle(pts[0][0], pts[0][1], (w + 4.5) / 2).fillCircle(pts[pts.length - 1][0], pts[pts.length - 1][1], (w + 4.5) / 2);
  p.flat(color).fillCircle(pts[0][0], pts[0][1], w / 2).fillCircle(pts[pts.length - 1][0], pts[pts.length - 1][1], w / 2);
}

// дуга-линия без заливки (wifi, улыбки, ресницы)
function stroke(p: Pen, pts: Pt[], w: number, color = OUTLINE) {
  p.g.lineStyle(w, color, 1).strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)), false);
}

// отрезок, обрезанный по эллипсу (сеточка ананаса)
function clipLine(p: Pen, x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, rx: number, ry: number, color: number) {
  let first: Pt | null = null;
  let last: Pt | null = null;
  for (let i = 0; i <= 40; i++) {
    const x = x1 + ((x2 - x1) * i) / 40, y = y1 + ((y2 - y1) * i) / 40;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
      if (!first) first = [x, y];
      last = [x, y];
    }
  }
  if (first && last) p.line(first[0], first[1], last[0], last[1], 1.8, color);
}

// колесо велосипеда: отдельная графика, крутится вокруг своей оси
function wheel(scene: Phaser.Scene, x: number, y: number, r: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const p = new Pen(g, 3);
  p.circle(0, 0, r, 0x3a3a46, 3);
  p.circle(0, 0, r - 4.5, 0xdff4ff, 2.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    p.line(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5), -Math.cos(a) * (r - 5), -Math.sin(a) * (r - 5), 1.6, 0x8a96a3);
  }
  p.circle(0, 0, 3.5, 0xff5fa8, 2);
  g.setPosition(x, y);
  return g;
}

// щупальце медузы: отдельная графика, качается от точки крепления
function tentacle(scene: Phaser.Scene, x: number, y: number, len: number, color: number, phase: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const p = new Pen(g, 3);
  const pts: Pt[] = [];
  for (let i = 0; i <= 8; i++) pts.push([Math.sin(i * 0.9 + phase) * 4, (i / 8) * len]);
  tube(p, pts, 5, color);
  g.setPosition(x, y);
  return g;
}

export const DRAW2: Record<string, (scene: Phaser.Scene) => Critter> = {
  // Бобрито Бандито: бобр-гангстер в шляпе, костюме в полоску, с автоматом и зубами-лопатами
  bobritto: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x3a3f5a, shoe: 0x1e1e26, len: 12, spread: 9, width: 9, sole: WHITE }), (p) => {
      // плоский хвост сзади
      p.ellipse(-28, -24, 22, 34, 0x6a4326);
      p.line(-34, -32, -22, -20, 1.6, 0x4a2c16);
      p.line(-34, -20, -22, -32, 1.6, 0x4a2c16);
      // пиджак в полоску
      p.rect(-22, -64, 44, 52, 0x3a3f5a, 10);
      for (const x of [-14, -6, 10, 17]) p.line(x, -60, x, -16, 1.4, 0x8a92b8);
      p.poly([[-8, -64], [8, -64], [0, -40]], WHITE, 2.4); // рубашка
      p.poly([[-3, -60], [3, -60], [2, -44], [0, -40], [-2, -44]], TOMATO, 2); // галстук
      p.poly([[-12, -64], [-2, -50], [-12, -44]], 0x2a2e44, 2.4); // лацканы
      p.poly([[12, -64], [2, -50], [12, -44]], 0x2a2e44, 2.4);
      // голова бобра
      p.circle(-20, -100, 7, 0x8a5a32);
      p.circle(2, -86, 24, 0x8a5a32);
      p.ellipse(12, -76, 30, 20, 0xd9a878, 2.6); // морда
      p.ellipse(18, -84, 11, 8, OUTLINE, 0); // нос
      shine(p, 16, -86, 4, 2, 0.7);
      p.rect(8, -71, 7, 11, WHITE, 2, 2.4); // зубы-лопаты
      p.rect(15, -71, 7, 11, WHITE, 2, 2.4);
      bigEye(p, -2, -92, 6.5, 0.35);
      bigEye(p, 14, -96, 5.5, 0.35);
      brow(p, -9, -102, 4, -98, 3.2);
      for (const d of [-2, 2]) p.line(24, -78 + d, 36, -80 + d * 3, 1.4);
      // федора
      p.ellipse(0, -108, 64, 12, 0x2a2a34);
      p.rect(-18, -128, 36, 22, 0x2a2a34, 7);
      p.rect(-18, -114, 36, 6, TOMATO, 0, 2.2);
      p.flat(WHITE, 0.25).fillRect(-14, -124, 4, 10);
      // автомат с барабаном
      p.rect(-6, -46, 22, 10, 0x8a5a32, 3, 2.6); // приклад
      p.rect(12, -48, 40, 9, 0x3a3a46, 2, 2.6); // ствол
      p.rect(46, -46, 10, 5, 0x3a3a46, 1, 2.2);
      p.circle(24, -36, 9, 0x2a2a34, 2.6); // барабан
      p.circle(24, -36, 3, 0x8a96a3, 1.6);
      p.rect(32, -44, 6, 10, 0x8a5a32, 2, 2.2); // рукоять
      p.circle(-2, -40, 6, 0x8a5a32, 2.4); // лапы
      p.circle(34, -36, 5.5, 0x8a5a32, 2.4);
    }, 130, 96, 128),

  // Пот Хотспот: тощий серый пришелец тянет телефон вверх и ищет вайфай
  hotspot: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xa8b4c4, shoe: 0x5a6070, len: 30, spread: 5, width: 5, shoeLen: 14 }), (p) => {
      // дальняя рука висит
      tube(p, [[-6, -78], [-14, -60], [-12, -44]], 4, 0xa8b4c4);
      // тощее тельце с рёбрами
      p.rect(-9, -84, 18, 52, 0xa8b4c4, 8);
      for (let i = 0; i < 4; i++) p.line(-5, -74 + i * 7, 5, -74 + i * 7, 1.4, 0x7a8698);
      p.rect(-10, -42, 20, 10, 0x4f8ad0, 3, 2.4); // шорты
      // большая голова
      p.ellipse(0, -108, 42, 48, 0xb8c4d2);
      shine(p, -10, -122, 10, 8);
      bigEye(p, -6, -110, 8, 0.25, 0x5a6aa0);
      bigEye(p, 12, -112, 7, 0.25, 0x5a6aa0);
      brow(p, -14, -122, -2, -126, 3); // грустные брови домиком
      brow(p, 6, -127, 18, -124, 3);
      p.ellipse(4, -92, 10, 12, MOUTH, 2.6); // «Нееет!»
      p.flat(TONGUE).fillEllipse(4, -88, 6, 4);
      // рука с телефоном вверх
      tube(p, [[6, -78], [22, -94], [28, -122]], 4, 0xa8b4c4);
      p.rect(22, -150, 16, 26, 0x2a2a34, 3, 2.8);
      p.rect(24.5, -147, 11, 18, 0x7ad0ff, 1, 0);
      p.flat(WHITE, 0.5).fillTriangle(25, -146, 30, -146, 25, -138);
      p.circle(28, -124, 4.5, 0xa8b4c4, 2.4); // пальцы
      // волны вайфая
      for (const r of [6, 12, 18]) stroke(p, arc(30, -152, r, r, Math.PI * 1.25, Math.PI * 1.75, 10), 3.4, r === 18 ? 0xff5f5f : 0x2f9ee8);
      p.flat(0x2f9ee8).fillCircle(30, -153, 2.4);
    }, 150, 80, 140),

  // Спиюниро Голубиро: голубь-шпион в плаще и шляпе, с фотоаппаратом на шее
  golubiro: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xe87a8a, shoe: 0xd85a6a, len: 12, spread: 8, width: 5, shoeLen: 16 }), (p) => {
      // хвост-перья из-под плаща
      p.poly([[-20, -26], [-40, -14], [-36, -30]], 0x6a7a98);
      // плащ
      p.poly([[-16, -72], [16, -72], [24, -14], [-24, -14]], 0xd2a85a);
      p.flat(0xb58a42).fillTriangle(10, -70, 22, -16, 8, -16);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([new Phaser.Math.Vector2(-16, -72), new Phaser.Math.Vector2(16, -72), new Phaser.Math.Vector2(24, -14), new Phaser.Math.Vector2(-24, -14)], true);
      p.line(0, -60, 0, -14, 2.2);
      p.rect(-21, -40, 42, 6, 0x7a5228, 1, 2.4); // пояс
      p.rect(-4, -41, 8, 8, AMBER, 1, 2); // пряжка
      p.poly([[-16, -72], [-2, -72], [-8, -50]], 0xe6c07a, 2.4); // воротник
      p.poly([[16, -72], [2, -72], [8, -50]], 0xe6c07a, 2.4);
      // голова голубя с переливом на шее
      p.ellipse(4, -78, 30, 14, 0x5fbf9a, 2.6);
      p.flat(0xa66ad0).fillEllipse(8, -78, 14, 8);
      p.circle(4, -96, 20, 0x8a9ab8);
      shine(p, -4, -106, 10, 5);
      bigEye(p, 10, -98, 7.5, 0.35, 0xff8a2b);
      p.poly([[22, -96], [36, -92], [22, -88]], 0x5a5a66, 2.6); // клюв
      p.flat(WHITE).fillEllipse(23, -97, 5, 3);
      brow(p, 2, -108, 18, -104, 3);
      // шпионская шляпа
      p.ellipse(2, -112, 52, 10, 0x6a4a2a);
      p.rect(-14, -130, 30, 20, 0x6a4a2a, 6);
      p.rect(-14, -117, 30, 5, OUTLINE, 0, 0);
      p.flat(WHITE, 0.25).fillRect(-10, -126, 4, 8);
      // фотоаппарат на ремешке
      p.line(-6, -70, -12, -56, 2, OUTLINE);
      p.line(14, -70, 18, -56, 2, OUTLINE);
      p.rect(-10, -60, 30, 18, 0x2a2a34, 3, 2.6);
      p.rect(-6, -64, 8, 4, 0x2a2a34, 1, 2);
      p.circle(7, -51, 7, 0x5a6070, 2.4);
      p.circle(7, -51, 3.5, 0x7ad0ff, 1.6);
      p.flat(WHITE).fillCircle(8.5, -52.5, 1.3);
      p.flat(TOMATO).fillCircle(16, -57, 1.8);
      p.ellipse(22, -50, 8, 10, 0x8a9ab8, 2.4); // крыло-рука держит камеру
    }, 130, 84, 130),

  // Трик Трак Барабум: ударная установка с руками и ногами, лицо на бочке, тарелка и палочки
  trictrac: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd9a37a, shoe: 0x2a2a34, len: 10, spread: 14, width: 8 }), (p) => {
      // стойка и тарелка
      p.line(24, -66, 34, -118, 3.4, 0x8a96a3);
      p.line(24, -66, 34, -118, 1.4, 0xdfe6ee);
      p.ellipse(34, -120, 40, 9, 0xffcf3f, 2.8);
      p.flat(0xffe9a8).fillEllipse(30, -122, 18, 3);
      p.circle(34, -122, 2.5, 0x8a96a3, 1.6);
      // томы сверху
      for (const [x, c] of [[-16, 0xff4f6a], [12, 0x3fa0ff]] as [number, number][]) {
        p.rect(x - 12, -94, 24, 18, c, 3);
        p.ellipse(x, -94, 24, 8, WHITE, 2.6);
        p.flat(0xc9d3dc).fillRect(x - 11, -82, 22, 2);
      }
      // руки с палочками
      tube(p, [[-28, -58], [-40, -80], [-34, -98]], 5, 0xd9a37a);
      tube(p, [[28, -58], [42, -78], [40, -92]], 5, 0xd9a37a);
      p.line(-34, -98, -18, -122, 4.5);
      p.line(-34, -98, -18, -122, 2.2, 0xf2d29a);
      p.line(40, -92, 52, -114, 4.5);
      p.line(40, -92, 52, -114, 2.2, 0xf2d29a);
      // большая бочка
      p.circle(0, -48, 34, 0xe4472b);
      p.circle(0, -48, 27, WHITE, 2.6);
      for (let a = 0; a < 8; a++) {
        const r = (a / 8) * Math.PI * 2;
        p.flat(0xc9d3dc).fillCircle(Math.cos(r) * 30.5, -48 + Math.sin(r) * 30.5, 2);
      }
      shine(p, -10, -64, 14, 6, 0.6);
      bigEye(p, -8, -54, 7.5, 0.25);
      bigEye(p, 10, -54, 7.5, 0.25);
      brow(p, -15, -65, -3, -62, 3);
      brow(p, 4, -62, 16, -65, 3);
      grin(p, 1, -42, 22, 11);
      blush(p, -17, -42, 4);
      blush(p, 19, -42, 4);
      // ножки-подставки
      p.line(-24, -20, -32, -10, 3, 0x8a96a3);
      p.line(24, -20, 32, -10, 3, 0x8a96a3);
    }, 128, 100, 124),

  // Бананита Дельфинита: дельфин внутри очищенного банана
  bananita: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x4f9ae0, shoe: 0x2f6fd0, len: 10, spread: 8, width: 8, sole: WHITE }), (p) => {
      // дельфин торчит из банана
      p.poly([[-14, -112], [-28, -126], [-4, -118]], 0x3f86d0); // спинной плавник
      p.ellipse(0, -78, 46, 76, 0x5aa8f0);
      p.flat(0xcfeaff).fillEllipse(8, -70, 22, 50);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -78, 46, 76);
      p.ellipse(28, -94, 36, 15, 0x5aa8f0); // длинный нос-бутылка
      p.flat(0xcfeaff).fillEllipse(30, -89, 30, 5);
      p.ellipse(10, -100, 18, 18, 0x5aa8f0, 0);
      p.line(14, -90, 44, -92, 2.4);
      shine(p, -10, -102, 10, 14);
      bigEye(p, 8, -102, 7, 0.4);
      brow(p, 2, -112, 16, -110, 3);
      blush(p, 6, -90, 4);
      p.flat(OUTLINE).fillCircle(-8, -114, 2); // дыхало
      p.ellipse(-26, -70, 12, 20, 0x3f86d0, 2.4); // плавники-руки
      p.ellipse(25, -66, 12, 20, 0x3f86d0, 2.4);
      // жёлтая кожура снизу и лепестки свисают наружу
      p.poly([[-24, -52], [24, -52], [18, -14], [-18, -14]], 0xffe04a);
      p.flat(0xf2c42a).fillTriangle(10, -50, 22, -50, 14, -16);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([[-24, -52], [24, -52], [18, -14], [-18, -14]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      p.poly([[-22, -52], [-40, -46], [-44, -22], [-34, -28], [-20, -42]], 0xffe04a);
      p.flat(0x7a5a1a).fillCircle(-42, -24, 2.6);
      p.poly([[22, -52], [40, -46], [44, -22], [34, -28], [20, -42]], 0xffe04a);
      p.flat(0x7a5a1a).fillCircle(42, -24, 2.6);
      p.poly([[-9, -52], [9, -52], [5, -32], [0, -27], [-5, -32]], 0xfff08a, 2.6);
      p.flat(0x7a5a1a).fillCircle(0, -30, 2);
      p.ellipse(0, -14, 18, 6, 0x7a5a1a, 2.4); // хвостик банана
    }, 128, 90, 126),

  // Бурбалони Лулилоли: капибара сидит в половинке кокоса
  burbaloni: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x8a5a32, shoe: 0x6a4326, len: 8, spread: 14, width: 8 }), (p) => {
      // спина капибары за краем
      p.ellipse(-4, -54, 54, 44, 0xb5804a);
      // мордочка
      p.rect(-6, -100, 46, 40, 0xc08a52, 16);
      p.flat(0xa06a38).fillRoundedRect(-4, -72, 42, 10, 5);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-6, -100, 46, 40, 16);
      p.ellipse(-2, -100, 12, 10, 0xa06a38, 2.6); // ушки
      p.ellipse(16, -102, 12, 10, 0xa06a38, 2.6);
      p.rect(24, -88, 18, 18, 0x8a5a32, 7, 2.6); // большой нос
      p.flat(OUTLINE).fillEllipse(36, -82, 4, 6);
      // сонные довольные глаза
      p.circle(10, -86, 6, WHITE, 2.4);
      p.flat(OUTLINE).fillCircle(11, -85, 3.2);
      p.flat(0xc08a52).fillRect(3, -93, 14, 6);
      p.line(3, -87, 17, -87, 2.6);
      p.smile(30, -70, 8);
      blush(p, 2, -76, 4);
      // апельсинка на голове
      p.circle(8, -108, 7, 0xff9a2b, 2.6);
      p.ellipse(10, -116, 7, 4, 0x5e9c3a, 2);
      // половинка кокоса
      p.poly(arc(0, -46, 38, 34, 0, Math.PI, 18), 0x7a4a2a);
      for (const [x, y] of [[-20, -32], [-6, -22], [12, -26], [24, -36]]) p.line(x - 3, y - 2, x + 3, y + 2, 1.6, 0x5a3218);
      p.ellipse(0, -46, 80, 12, WHITE, 3);
      p.ellipse(0, -46, 62, 6, 0xf2ece0, 0);
      shine(p, -22, -34, 8, 10, 0.25);
      p.circle(-24, -50, 6, 0xc08a52, 2.4); // лапки на краю
      p.circle(24, -50, 6, 0xc08a52, 2.4);
    }, 120, 90, 116),

  // Орангутини Ананасини: орангутан с туловищем-ананасом
  orangutini: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xd2602a, shoe: 0x8a3a1a, len: 12, spread: 9, width: 9 }), (p) => {
      // длинные руки свисают
      tube(p, [[-20, -64], [-34, -44], [-32, -22]], 7, 0xd2602a);
      // ананас-туловище в сеточку
      p.ellipse(0, -46, 48, 62, 0xffc22e);
      for (let i = -4; i <= 4; i++) {
        clipLine(p, -24 + i * 10, -78, 24 + i * 10, -14, 0, -46, 22, 29, 0xc9821a);
        clipLine(p, 24 + i * 10, -78, -24 + i * 10, -14, 0, -46, 22, 29, 0xc9821a);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -46, 48, 62);
      for (const [x, y] of [[-8, -56], [8, -40], [-6, -30], [10, -60]]) p.flat(0xa8641a).fillCircle(x, y, 1.6);
      shine(p, -12, -60, 6, 14, 0.4);
      // голова орангутана
      p.circle(0, -94, 22, 0xd2602a);
      p.ellipse(4, -90, 34, 28, 0xf2b48a, 2.6);
      p.ellipse(-16, -90, 10, 16, 0xe08a5a, 2.4); // щёчки-подушки
      p.ellipse(22, -90, 10, 16, 0xe08a5a, 2.4);
      bigEye(p, -2, -96, 6, 0.3);
      bigEye(p, 12, -96, 6, 0.3);
      p.flat(OUTLINE).fillCircle(4, -86, 1.6).fillCircle(9, -86, 1.6);
      grin(p, 6, -82, 14, 7);
      // корона из листьев ананаса
      for (const [x, h, c] of [[-14, 22, 0x3f8a2a], [14, 22, 0x3f8a2a], [-6, 30, 0x5ec03a], [6, 30, 0x5ec03a], [0, 36, 0x7ad04a]] as [number, number, number][]) {
        p.poly([[x - 5, -112], [x + x * 0.4, -112 - h], [x + 5, -112]], c, 2.4);
      }
      // ближняя рука
      tube(p, [[20, -64], [34, -50], [30, -26]], 7, 0xd2602a);
    }, 148, 84, 148),

  // Глорбо Фруттодрилло: крокодил с туловищем-арбузом, в пасти мякоть с косточками
  glorbo: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x3a9a3a, shoe: 0x2a7a2a, len: 10, spread: 12, width: 10 }), (p) => {
      // хвост
      p.poly([[-30, -24], [-54, -10], [-30, -40]], 0x3a9a3a);
      // арбуз-туловище в полоску
      p.ellipse(0, -44, 64, 60, 0x4fc04a);
      for (const x of [-22, -8, 6, 20]) {
        stroke(p, [[x, -72], [x - 3, -60], [x + 2, -48], [x - 3, -34], [x + 1, -18]], 4.5, 0x1f7a2a);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -44, 64, 60);
      shine(p, -14, -60, 10, 16, 0.35);
      p.ellipse(-30, -46, 12, 18, 0x3a9a3a, 2.4); // лапки
      p.ellipse(30, -46, 12, 18, 0x3a9a3a, 2.4);
      // голова-крокодил с открытой пастью
      p.poly([[-14, -76], [44, -82], [50, -72], [-6, -66]], 0x3a9a3a); // нижняя челюсть
      p.poly([[-10, -74], [40, -78], [36, -72], [-4, -70]], 0xff4f5f, 0); // красная мякоть
      p.rect(-18, -120, 40, 40, 0x3a9a3a, 14);
      p.poly([[8, -112], [54, -104], [54, -92], [8, -86]], 0x3a9a3a); // верхняя челюсть
      // мякоть арбуза в пасти
      p.poly([[6, -86], [54, -92], [48, -80], [6, -74]], 0xff4f5f, 2.6);
      p.flat(0xb8f0a0).fillRect(8, -88, 44, 2.5);
      for (const [x, y] of [[16, -82], [26, -84], [36, -85], [44, -86], [22, -78]]) p.flat(OUTLINE).fillEllipse(x, y, 3, 4.5);
      for (let i = 0; i < 6; i++) p.flat(WHITE).fillTriangle(12 + i * 7, -88, 17 + i * 7, -88.5, 14.5 + i * 7, -83);
      p.flat(OUTLINE).fillCircle(48, -102, 1.8);
      // глаза-бугорки
      p.circle(-2, -120, 10, 0x3a9a3a);
      p.circle(16, -122, 10, 0x3a9a3a);
      bigEye(p, -2, -121, 7, 0.35, 0xf2c94c);
      bigEye(p, 16, -123, 7, 0.35, 0xf2c94c);
      brow(p, -8, -131, 4, -128, 2.8);
      blush(p, 0, -100, 4);
    }, 134, 108, 132),

  // Чиклетейра Бисиклетейра: розовая жвачка верхом на велосипеде, надувает пузырь
  chicleteira: (sc) => {
    const legs = [wheel(sc, -26, -18, 17), wheel(sc, 30, -18, 17)];
    return assemble(sc, legs, (p) => {
      // рама
      p.line(-26, -18, 4, -20, 5.5);
      p.line(-26, -18, 4, -20, 3, 0x2fd0c0);
      p.line(4, -20, 22, -46, 5.5);
      p.line(4, -20, 22, -46, 3, 0x2fd0c0);
      p.line(30, -18, 22, -46, 5.5);
      p.line(30, -18, 22, -46, 3, 0x2fd0c0);
      p.line(-26, -18, -8, -44, 5.5);
      p.line(-26, -18, -8, -44, 3, 0x2fd0c0);
      p.line(-8, -44, 22, -46, 5.5);
      p.line(-8, -44, 22, -46, 3, 0x2fd0c0);
      p.circle(4, -20, 5, 0x8a96a3, 2.4); // педали
      p.line(20, -48, 32, -58, 4); // руль
      p.ellipse(34, -60, 12, 6, 0x2a2a34, 2);
      // жвачка-тело, стекает по раме
      p.ellipse(-8, -66, 52, 50, 0xff7ac0);
      p.ellipse(-24, -46, 14, 18, 0xff7ac0, 2.6);
      p.ellipse(4, -44, 14, 16, 0xff7ac0, 2.6);
      p.flat(0xff7ac0).fillRect(-26, -54, 34, 12);
      shine(p, -20, -80, 12, 8, 0.5);
      p.flat(0xffb0dc).fillCircle(-24, -62, 3).fillCircle(-14, -56, 2);
      bigEye(p, -8, -76, 7, 0.4);
      bigEye(p, 8, -76, 6.5, 0.4);
      brow(p, -14, -86, -2, -84, 2.8);
      // пузырь жвачки изо рта
      p.circle(36, -82, 14, 0xffa6d8, 2.8);
      shine(p, 31, -88, 7, 5, 0.75);
      p.ellipse(20, -70, 9, 7, 0xff5fa8, 2.2);
      blush(p, -18, -66, 4);
      // ручка-тянучка к рулю
      tube(p, [[10, -56], [22, -56], [32, -60]], 5, 0xff7ac0);
    }, 104, 104, 92);
  },

  // Эспрессо Синьора: элегантная чашка эспрессо с помадой, ресницами и жемчугом
  espresso: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xf5d0b0, shoe: TOMATO, len: 20, spread: 6, width: 5, shoeLen: 13 }), (p) => {
      // блюдце-юбка
      p.ellipse(0, -28, 66, 16, WHITE);
      p.ellipse(0, -30, 50, 9, 0x6ab0e8, 2.4);
      // чашка
      p.circle(26, -64, 9, WHITE, 3); // ручка
      p.circle(26, -64, 4, 0xfff4dc, 0);
      p.poly([[-24, -96], [24, -96], [18, -36], [-18, -36]], WHITE);
      p.flat(0xe6eaf2).fillTriangle(10, -94, 22, -94, 15, -38);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([new Phaser.Math.Vector2(-24, -96), new Phaser.Math.Vector2(24, -96), new Phaser.Math.Vector2(18, -36), new Phaser.Math.Vector2(-18, -36)], true);
      p.rect(-21, -50, 40, 6, 0x6ab0e8, 2, 0); // голубая полоска
      p.ellipse(0, -96, 50, 13, 0x5a2e14);
      p.ellipse(-2, -97, 30, 6, 0xd9a060, 0); // пенка-крема
      // бантик-шляпка
      p.poly([[-4, -104], [-18, -114], [-16, -100]], 0xff4f8a, 2.4);
      p.poly([[4, -104], [18, -114], [16, -100]], 0xff4f8a, 2.4);
      p.circle(0, -104, 4, 0xff7aa8, 2.2);
      // лицо: ресницы, губы, румянец
      bigEye(p, -7, -78, 6, 0.25, 0x6a3a1a);
      bigEye(p, 9, -78, 6, 0.25, 0x6a3a1a);
      for (const x of [-7, 9]) {
        p.line(x - 6, -82, x - 9, -86, 2);
        p.line(x - 2, -84, x - 3, -89, 2);
        p.line(x + 3, -84, x + 4, -89, 2);
      }
      p.ellipse(2, -64, 12, 7, 0xe4234b, 2.2);
      p.line(-3, -64, 7, -64, 1.4);
      blush(p, -14, -68, 4);
      blush(p, 17, -68, 4);
      // жемчужное ожерелье
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.15 + (i / 8) * 0.7);
        p.circle(Math.cos(a) * 18, -60 + Math.sin(a) * 6, 2.6, 0xfff8f0, 1.4);
      }
      // ручки
      p.circle(-24, -62, 4.5, 0xf5d0b0, 2.2);
    }, 116, 84, 114),

  // Спагетти Туалетти: унитаз, из которого вываливаются спагетти с томатным соусом
  spaghetti: (sc) =>
    assemble(sc, makeLegs(sc, { skin: WHITE, shoe: 0x6ab0e8, len: 8, spread: 10, width: 9 }), (p) => {
      // бачок с лицом
      p.rect(-26, -138, 44, 48, 0xf4f8fc, 8);
      p.flat(0xdfe8f0).fillRect(10, -134, 6, 40);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-26, -138, 44, 48, 8);
      p.rect(-30, -144, 52, 9, WHITE, 4); // крышка бачка
      p.rect(12, -152, 8, 8, 0xc9d3dc, 2, 2.4); // кнопка
      bigEye(p, -12, -120, 7, 0.35);
      bigEye(p, 6, -120, 7, 0.35);
      brow(p, -18, -131, -6, -128, 3);
      brow(p, 0, -128, 12, -131, 3);
      grin(p, -2, -110, 18, 9);
      // основание
      p.poly([[-14, -60], [18, -60], [14, -14], [-12, -14]], WHITE);
      p.flat(0xdfe8f0).fillTriangle(8, -58, 16, -58, 12, -16);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([new Phaser.Math.Vector2(-14, -60), new Phaser.Math.Vector2(18, -60), new Phaser.Math.Vector2(14, -14), new Phaser.Math.Vector2(-12, -14)], true);
      // чаша
      p.ellipse(4, -66, 72, 30, WHITE);
      p.flat(0xdfe8f0).fillEllipse(10, -60, 50, 12);
      p.ellipse(4, -74, 64, 12, 0xe6eef6, 2.6); // ободок
      // гора спагетти с соусом
      p.ellipse(4, -78, 52, 18, 0xffd86b, 2.8);
      for (const [x, y, w] of [[-12, -82, 18], [4, -86, 22], [16, -80, 16], [-2, -76, 20]] as [number, number, number][]) {
        stroke(p, arc(x, y, w / 2, 4, Math.PI, Math.PI * 2, 8), 1.6, 0xd9a830);
      }
      p.ellipse(6, -84, 28, 9, 0xe4372b, 2.4); // соус
      p.flat(0xff6a50).fillEllipse(2, -86, 12, 3);
      p.circle(10, -88, 5, 0x8a3a1a, 2.4); // фрикаделька
      p.flat(0x5ec03a).fillCircle(16, -86, 2); // базилик
      // макаронины свисают через край
      tube(p, [[-20, -74], [-26, -62], [-22, -52], [-26, -40]], 3.2, 0xffd86b);
      tube(p, [[28, -74], [34, -62], [32, -50]], 3.2, 0xffd86b);
      tube(p, [[12, -70], [14, -58], [10, -50]], 3.2, 0xffd86b);
      p.flat(0xe4372b).fillCircle(-26, -40, 3).fillCircle(14, -58, 2.5);
    }, 152, 84, 150),

  // Клубничный слон: слон из клубники с листиками-шапкой и хоботом (главный секрет игры)
  strawberry: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xe8344a, shoe: 0xffd0d8, len: 12, spread: 10, width: 11 }), (p) => {
      // уши (дальнее выглядывает справа)
      p.ellipse(30, -74, 18, 28, 0xd02a40);
      p.ellipse(-30, -66, 30, 40, 0xff5a6a);
      p.flat(0xffa6b8).fillEllipse(-30, -64, 16, 26);
      // клубника-тело
      p.poly([...arc(0, -72, 34, 30, Math.PI, Math.PI * 2, 14), [30, -50], [14, -20], [0, -12], [-14, -20], [-30, -50]], 0xe8344a);
      p.flat(0xff6a7a).fillEllipse(-12, -78, 14, 20);
      for (const [x, y] of [[-20, -56], [-8, -44], [6, -32], [-10, -26], [20, -50], [10, -52], [-2, -60], [-22, -80], [18, -34], [0, -20]]) {
        p.flat(0xffe04a).fillEllipse(x, y, 3, 4.5);
      }
      shine(p, -14, -86, 10, 6, 0.5);
      // листья-шапка и хвостик
      for (const a of [-2.4, -1.9, -1.2, -0.7]) {
        const x = Math.cos(a) * 26, y = -96 + Math.sin(a) * 6;
        p.poly([[x * 0.4, -98], [x * 1.2, y + 10], [x * 0.8 + 6, -96]], 0x3fae3a, 2.4);
      }
      p.ellipse(0, -100, 40, 12, 0x4fc04a, 2.6);
      p.rect(-3, -116, 6, 14, 0x3f8a2a, 2, 2.4);
      // глаза и хобот
      bigEye(p, 4, -78, 7, 0.35);
      bigEye(p, 20, -76, 6, 0.35);
      brow(p, -2, -88, 10, -86, 2.8);
      tube(p, [[20, -62], [32, -54], [40, -38], [48, -42]], 9, 0xe8344a);
      p.flat(0xffe04a).fillEllipse(32, -52, 2.5, 3.5).fillEllipse(40, -40, 2.5, 3.5);
      p.poly([[10, -56], [22, -46], [8, -48]], WHITE, 2.2); // бивень
      blush(p, 0, -62, 4);
    }, 124, 96, 116),

  // Драгон Каннеллони: дракон с туловищем-каннеллони в соусе и сыре, пыхает огнём
  cannelloni: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x4fb04a, shoe: 0x2f8a3a, len: 12, spread: 10, width: 9 }), (p) => {
      // крылышки
      p.poly([[-14, -76], [-44, -104], [-40, -84], [-50, -80], [-22, -62]], 0x2fa0a0);
      p.flat(0x7ad8c8).fillTriangle(-20, -72, -40, -96, -38, -82);
      // хвост
      p.poly([[-18, -28], [-46, -20], [-52, -32], [-42, -26], [-18, -40]], 0x4fb04a);
      p.poly([[-52, -32], [-60, -40], [-50, -24]], 0xff7a2b, 2.4);
      // туловище-трубочка каннеллони
      p.rect(-20, -84, 40, 72, 0xffe2a6, 10);
      p.flat(0xf2c47a).fillRoundedRect(8, -80, 8, 64, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -84, 40, 72, 10);
      for (const y of [-68, -52, -36]) p.line(-18, y, 18, y + 2, 1.6, 0xd9a050);
      // соус и сыр сверху стекают
      p.poly([[-22, -84], [22, -84], [22, -70], [14, -60], [8, -72], [0, -58], [-8, -72], [-16, -62], [-22, -70]], 0xe4372b, 2.6);
      p.flat(0xff6a50).fillEllipse(-6, -80, 18, 4);
      p.poly([[-12, -82], [8, -84], [10, -78], [2, -70], [-4, -78], [-10, -74]], 0xfff08a, 2);
      p.flat(0x5ec03a).fillCircle(12, -80, 2.4);
      // голова дракона
      p.poly([[-6, -108], [-10, -126], [2, -112]], 0xffd86b, 2.4); // рога
      p.poly([[10, -110], [12, -128], [18, -110]], 0xffd86b, 2.4);
      p.circle(4, -96, 18, 0x4fb04a);
      p.ellipse(24, -90, 28, 18, 0x4fb04a); // морда
      p.flat(0x8ae07a).fillEllipse(24, -84, 22, 6);
      p.flat(OUTLINE).fillCircle(32, -94, 1.6);
      bigEye(p, 6, -100, 7, 0.4, 0xffb02e);
      brow(p, 0, -110, 14, -108, 3);
      p.smile(24, -84, 10);
      // клуб огня
      p.circle(46, -88, 7, 0xff7a2b, 2.4);
      p.circle(56, -94, 6, 0xffb02e, 2.2);
      p.circle(54, -82, 4.5, 0xffd86b, 2);
      p.flat(0xfff08a).fillCircle(46, -88, 3);
      // лапки
      p.circle(-20, -46, 5.5, 0x4fb04a, 2.4);
      p.circle(22, -46, 5.5, 0x4fb04a, 2.4);
    }, 130, 110, 128),

  // Граипусс Медусси: медуза с колоколом из грозди фиолетового винограда
  graipuss: (sc) => {
    const tc = 0xc88ae8;
    const legs = [-18, -6, 6, 18].map((x, i) => tentacle(sc, x, -46, 30 + (i % 2) * 8, i % 2 ? 0xb06ad8 : tc, i));
    return assemble(sc, legs, (p) => {
      // виноградный колокол
      for (const [x, y, r] of [[-26, -60, 10], [26, -60, 10], [-18, -78, 11], [18, -78, 11], [-8, -94, 11], [10, -94, 11], [0, -106, 9]] as [number, number, number][]) {
        p.circle(x, y, r, 0x8a3ac8, 2.8);
        shine(p, x - r * 0.35, y - r * 0.35, r * 0.6, r * 0.4, 0.5);
      }
      p.ellipse(0, -68, 52, 46, 0xa64ee0);
      p.flat(0xc07af0).fillEllipse(-8, -80, 20, 12);
      for (const x of [-20, -7, 7, 20]) p.circle(x, -48, 8, 0x8a3ac8, 2.6);
      // хвостик и листик
      p.line(0, -114, 4, -126, 4);
      p.line(0, -114, 4, -126, 2, 0x6a4a2a);
      p.poly([[4, -122], [22, -130], [16, -116]], 0x5ec03a, 2.4);
      // лицо
      bigEye(p, -8, -72, 7.5, 0.3);
      bigEye(p, 10, -72, 7.5, 0.3);
      brow(p, -15, -84, -3, -82, 2.8);
      brow(p, 4, -82, 16, -84, 2.8);
      grin(p, 2, -62, 16, 8);
      blush(p, -18, -62, 4);
      blush(p, 20, -62, 4);
    }, 130, 80, 128);
  },
};
