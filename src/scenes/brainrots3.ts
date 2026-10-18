import Phaser from 'phaser';
import type { Critter } from './brainrots';
import { assemble, bigEye, blush, brow, grin, makeLegs, MOUTH, shine } from './brainrots';
import { CREAM, OUTLINE, Pen, TOMATO, WHITE } from './draw';

// Третья пачка брейнротов: Тим Чиз, Свинино, Та Та Сахур, краб-повар и другие.
// Тот же стиль, что в brainrots.ts: ноги в (0, 0), смотрят вправо, толстая обводка.

type Pt = [number, number];

// точки дуги (полукруги, ручка чайника, пузырь шлема)
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// линия-ломаная с обводкой (руки, хвосты, хобот)
function tube(p: Pen, pts: Pt[], w: number, color: number) {
  const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  p.g.lineStyle(w + 4.5, OUTLINE, 1).strokePoints(v, false);
  p.g.lineStyle(w, color, 1).strokePoints(v, false);
  p.flat(OUTLINE).fillCircle(pts[0][0], pts[0][1], (w + 4.5) / 2).fillCircle(pts[pts.length - 1][0], pts[pts.length - 1][1], (w + 4.5) / 2);
  p.flat(color).fillCircle(pts[0][0], pts[0][1], w / 2).fillCircle(pts[pts.length - 1][0], pts[pts.length - 1][1], w / 2);
}

// дуга-линия без заливки (полоски, улыбки, усы)
function stroke(p: Pen, pts: Pt[], w: number, color = OUTLINE) {
  p.g.lineStyle(w, color, 1).strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)), false);
}

// полоски поперёк ног (зебра, тигр, носки)
function legBands(legs: Phaser.GameObjects.Graphics[], w: number, ys: number[], color = OUTLINE, thick = 3) {
  for (const g of legs) for (const y of ys) g.lineStyle(thick, color, 1).lineBetween(-w / 2 + 0.5, y + 1.5, w / 2 - 0.5, y - 1.5);
}

// искра на фитиле
function spark(p: Pen, x: number, y: number, r: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? r * 0.45 : r;
    pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k]);
  }
  p.poly(pts, 0xffb02e, 2.4);
  p.flat(0xfff08a).fillCircle(x, y, r * 0.35);
}

// клешня краба: подушка и два пальца, s — куда смотрит
function claw(p: Pen, x: number, y: number, s: number, color: number) {
  p.poly([[x - s * 2, y - 6], [x + s * 18, y - 20], [x + s * 22, y - 12], [x + s * 8, y - 2]], color, 2.8);
  p.poly([[x, y + 4], [x + s * 20, y - 2], [x + s * 18, y + 6], [x + s * 4, y + 10]], color, 2.8);
  p.circle(x, y, 11, color, 2.8);
  shine(p, x - s * 3, y - 4, 6, 4, 0.5);
}

// ноги балеруна: опорная прямо, вторая вытянута носочком вперёд
function balletLegs(scene: Phaser.Scene, tights: number, slipper: number): Phaser.GameObjects.Graphics[] {
  const stand = scene.add.graphics();
  const a = new Pen(stand, 3);
  a.rect(-3.5, -2, 7, 34, tights, 3);
  a.poly([[-5, 26], [8, 27], [12, 31], [8, 35], [-5, 35]], slipper, 2.8);
  stand.lineStyle(1.6, OUTLINE, 1).lineBetween(-2, 29, 6, 29);
  stand.setPosition(-3, -35);
  const point = scene.add.graphics();
  const b = new Pen(point, 3);
  tube(b, [[0, 0], [14, 14], [24, 26]], 6.5, tights);
  b.poly([[20, 22], [30, 26], [40, 33], [28, 34], [19, 30]], slipper, 2.8);
  point.lineStyle(1.6, OUTLINE, 1).lineBetween(22, 26, 28, 31);
  point.setPosition(4, -33);
  return [stand, point];
}

export const DRAW3: Record<string, (scene: Phaser.Scene) => Critter> = {
  // Тим Чиз: серый мышонок выглядывает из дырявого клина сыра
  timcheese: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xf2a6b8, shoe: 0x9a9aa8, len: 8, spread: 14, width: 6, shoeLen: 14 }), (p) => {
      const fur = 0xa8a8b6;
      // хвостик-завитушка
      stroke(p, [[-30, -20], [-44, -18], [-54, -26], [-56, -40], [-50, -48], [-44, -44]], 6.5);
      stroke(p, [[-30, -20], [-44, -18], [-54, -26], [-56, -40], [-50, -48], [-44, -44]], 2.6, 0xf2a6b8);
      // уши и голова (низ головы спрятан в сыре)
      p.circle(-16, -108, 13, fur);
      p.circle(-16, -108, 7, 0xf7b6c6, 0);
      p.circle(18, -112, 12, fur);
      p.circle(18, -112, 6.5, 0xf7b6c6, 0);
      p.circle(2, -88, 21, fur);
      shine(p, -8, -100, 10, 5);
      p.ellipse(20, -82, 24, 15, 0xc8c8d4, 2.6); // мордочка
      p.circle(31, -84, 4.5, 0xff8aa8, 2.4); // нос
      p.flat(WHITE).fillCircle(30, -85.5, 1.4);
      p.rect(15, -77, 8, 8, WHITE, 2, 2.2); // зубки
      p.line(19, -77, 19, -69, 1.4);
      for (const d of [-3, 2]) p.line(28, -80 + d, 42, -82 + d * 2.5, 1.5);
      bigEye(p, -2, -92, 7, 0.35);
      bigEye(p, 13, -94, 6.5, 0.35);
      blush(p, 6, -78, 3.5);
      // клин сыра: боковая грань, верх и торец
      p.poly([[-36, -14], [28, -14], [28, -54], [-36, -76]], 0xffd23f);
      p.poly([[-36, -76], [28, -54], [38, -60], [-26, -82]], 0xffe68a, 2.8);
      p.poly([[28, -14], [38, -20], [38, -60], [28, -54]], 0xf2b52a, 2.8);
      for (const [x, y, w, h] of [[-22, -54, 12, 10], [-4, -30, 14, 12], [12, -46, 9, 8], [-24, -26, 8, 7], [16, -24, 7, 6], [-8, -54, 6, 5]] as [number, number, number, number][]) {
        p.ellipse(x, y, w, h, 0xe0a020, 2);
        p.flat(0xc88a18).fillEllipse(x + 1, y + 1, w * 0.6, h * 0.5);
      }
      p.ellipse(33, -38, 6, 10, 0xe0a020, 1.8);
      p.flat(WHITE, 0.4).fillTriangle(-30, -70, 10, -56, -28, -66);
      // лапки держатся за край
      p.ellipse(-12, -70, 11, 8, fur, 2.4);
      p.ellipse(14, -61, 11, 8, fur, 2.4);
    }, 122, 96, 120),

  // Свинино Бомбондино: розовый поросёнок в виде круглой чёрной бомбы с горящим фитилём
  svinino: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0xf7a8b8, shoe: 0xe0788f, len: 10, spread: 12, width: 9 }), (p) => {
      const pink = 0xf7a8b8;
      // хвостик крючком
      stroke(p, arc(-38, -50, 6, 6, 0, Math.PI * 1.6, 10), 6.5);
      stroke(p, arc(-38, -50, 6, 6, 0, Math.PI * 1.6, 10), 3, pink);
      // уши
      p.poly([[-26, -78], [-30, -104], [-8, -88]], pink);
      p.poly([[10, -90], [26, -108], [28, -80]], pink);
      p.flat(0xff7aa0).fillTriangle(-25, -82, -27, -98, -14, -88).fillTriangle(14, -90, 24, -102, 25, -84);
      // бомба-тело
      p.circle(0, -54, 38, 0x34344a);
      p.flat(0x4a4a64).fillCircle(-8, -62, 26);
      p.flat(0x34344a).fillCircle(0, -54, 22);
      shine(p, -18, -76, 14, 8, 0.5);
      shine(p, -26, -62, 4, 6, 0.35);
      // горловина и фитиль
      p.rect(-10, -100, 20, 12, 0x8a96a3, 3, 2.8);
      p.flat(WHITE, 0.4).fillRect(-7, -98, 4, 8);
      stroke(p, [[0, -100], [2, -110], [10, -118], [20, -120]], 6.5);
      stroke(p, [[0, -100], [2, -110], [10, -118], [20, -120]], 3, 0xd9b07a);
      spark(p, 22, -122, 11);
      // лицо: белые глаза, пятачок, улыбка
      bigEye(p, -6, -66, 8.5, 0.3);
      bigEye(p, 14, -68, 7.5, 0.3);
      p.line(-14, -81, -1, -79, 3.2, pink);
      p.line(8, -81, 20, -82, 3.2, pink);
      p.ellipse(20, -50, 28, 20, pink);
      p.flat(0xffc6d2).fillEllipse(16, -54, 12, 5);
      p.flat(0xd25a7a).fillEllipse(15, -50, 5, 7).fillEllipse(25, -50, 5, 7);
      p.g.lineStyle(3, pink, 1).beginPath().arc(4, -40, 10, Phaser.Math.DegToRad(40), Phaser.Math.DegToRad(140), false).strokePath();
      blush(p, -14, -48, 5);
      // копытца-ручки
      p.ellipse(-38, -46, 12, 14, pink, 2.6);
      p.ellipse(38, -36, 12, 14, pink, 2.6);
      p.line(-38, -52, -38, -44, 1.6);
      p.line(38, -42, 38, -34, 1.6);
    }, 134, 96, 132),

  // Та Та Та Та Сахур: сердитый чайник со свистком пара и деревянной палкой
  tatasahur: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x9a6a3e, shoe: 0x4a2e1e, len: 12, spread: 11, width: 8 }), (p) => {
      const body = 0xd9772e;
      // палка в поднятой руке (за чайником)
      p.poly([[-44, -46], [-38, -48], [-24, -134], [-32, -136]], 0xc08a5a);
      p.flat(0xa8743f).fillTriangle(-30, -130, -27, -131, -40, -52);
      p.line(-36, -100, -30, -104, 1.6, 0x8a5a33);
      tube(p, [[-24, -62], [-38, -72], [-40, -84]], 6, 0x9a6a3e);
      p.circle(-40, -86, 6, 0x9a6a3e, 2.6);
      // ручка сверху
      stroke(p, arc(0, -92, 22, 30, Math.PI * 1.05, Math.PI * 1.95, 14), 11);
      stroke(p, arc(0, -92, 22, 30, Math.PI * 1.05, Math.PI * 1.95, 14), 5.5, 0x5a3220);
      // носик
      p.poly([[16, -62], [22, -28], [46, -66], [54, -82], [46, -84]], body);
      p.ellipse(50, -84, 10, 6, 0xb85e22, 2.4);
      // пар
      for (const [x, y, r] of [[56, -98, 6], [64, -110, 8], [56, -124, 6.5], [-14, -112, 5], [-22, -122, 6.5]] as [number, number, number][]) {
        p.circle(x, y, r, WHITE, 2.4);
        p.flat(0xdfe8f0).fillCircle(x + r * 0.25, y + r * 0.25, r * 0.5);
      }
      // пузатый корпус
      p.rect(-30, -88, 60, 74, body, 26);
      p.flat(0xb85e22).fillRoundedRect(12, -80, 12, 58, 6);
      p.flat(0xf2a060).fillRoundedRect(-24, -78, 8, 32, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-30, -88, 60, 74, 26);
      p.rect(-28, -26, 56, 8, 0x8a4a1a, 3, 2.4); // ободок дна
      // крышка
      p.ellipse(0, -88, 46, 13, 0xc0682a);
      p.flat(0xe08a4a).fillEllipse(-4, -90, 26, 5);
      p.circle(0, -96, 5.5, 0x5a3220, 2.6);
      // злое лицо
      bigEye(p, -10, -64, 9.5, 0.15);
      bigEye(p, 12, -64, 9.5, 0.15);
      brow(p, -22, -80, -3, -72, 4);
      brow(p, 3, -72, 24, -80, 4);
      p.rect(-8, -48, 22, 11, MOUTH, 4, 2.8);
      p.flat(WHITE).fillRect(-5, -47, 16, 3.5);
      p.flat(0xf28c8c).fillEllipse(3, -40, 10, 4);
    }, 136, 100, 134),

  // Шеф Крабракадабра: красный краб в поварском колпаке, с половником в клешне
  crabchef: (sc) => {
    const red = 0xe4472b;
    return assemble(sc, makeLegs(sc, { skin: red, shoe: 0xb8301e, len: 14, spread: 14, width: 6, shoeLen: 12 }), (p) => {
      // острые ножки по бокам
      for (const s of [-1, 1]) {
        tube(p, [[s * 26, -40], [s * 42, -38], [s * 50, -22]], 4.5, red);
        tube(p, [[s * 24, -32], [s * 36, -26], [s * 40, -12]], 4.5, red);
      }
      // руки к клешням
      tube(p, [[-28, -50], [-40, -62], [-44, -72]], 6, red);
      tube(p, [[28, -50], [40, -62], [42, -72]], 6, red);
      // глаза на стебельках
      p.line(-16, -62, -24, -84, 7);
      p.line(-16, -62, -24, -84, 3.2, red);
      p.line(16, -62, 26, -86, 7);
      p.line(16, -62, 26, -86, 3.2, red);
      // панцирь
      p.ellipse(0, -46, 78, 48, red);
      p.flat(0xff7a5a).fillEllipse(4, -38, 52, 24);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -46, 78, 48);
      shine(p, -18, -60, 16, 6, 0.5);
      for (const [x, y] of [[-26, -50], [24, -56], [-20, -34]]) p.flat(0xb8301e).fillCircle(x, y, 2.4);
      grin(p, 6, -46, 22, 10);
      blush(p, -14, -40, 4.5);
      blush(p, 26, -42, 4.5);
      // поварской колпак
      p.circle(-10, -100, 11, WHITE, 2.8);
      p.circle(10, -100, 11, WHITE, 2.8);
      p.circle(0, -108, 13, WHITE, 2.8);
      p.flat(WHITE).fillRect(-12, -100, 24, 18);
      p.rect(-13, -84, 26, 14, WHITE, 3, 2.8);
      p.line(-6, -96, -5, -86, 1.6, 0xc9d3dc);
      p.line(6, -96, 5, -86, 1.6, 0xc9d3dc);
      p.flat(0xe6ecf2).fillRect(-11.5, -76, 23, 4);
      bigEye(p, -24, -88, 8, 0.35);
      bigEye(p, 26, -90, 8, 0.35);
      // половник в правой клешне
      p.line(48, -72, 58, -128, 6);
      p.line(48, -72, 58, -128, 2.6, 0xc9d3dc);
      p.poly(arc(60, -130, 11, 9, Math.PI * 1.05, Math.PI * 1.95, 10).concat(arc(60, -130, 11, 11, 0, Math.PI, 10)), 0xc9d3dc, 2.8);
      p.ellipse(60, -131, 18, 5, TOMATO, 1.8);
      p.flat(WHITE, 0.5).fillEllipse(55, -126, 4, 5);
      claw(p, 44, -76, 1, red);
      claw(p, -46, -76, -1, red);
    }, 140, 116, 122);
  },

  // Тигрруллини Арбузеллини: тигр с головой-арбузом (корка в полоску, красная мякоть, косточки)
  tigrullini: (sc) => {
    const legs = makeLegs(sc, { skin: 0xff9a2b, shoe: 0x2a2a34, len: 12, spread: 10, width: 9 });
    legBands(legs, 9, [2, 7]);
    return assemble(sc, legs, (p) => {
      const fur = 0xff9a2b;
      // хвост в полоску
      tube(p, [[-18, -24], [-34, -22], [-44, -32], [-46, -46], [-40, -54]], 6, fur);
      for (const [x, y] of [[-30, -22], [-41, -28], [-46, -40]]) p.line(x - 3, y - 3, x + 3, y + 3, 2.4);
      p.flat(OUTLINE).fillCircle(-40, -55, 4.5);
      // тигриные уши (за арбузом)
      p.circle(-18, -122, 9, fur);
      p.circle(-18, -122, 4.5, 0xffd0a0, 0);
      p.circle(20, -126, 9, fur);
      p.circle(20, -126, 4.5, 0xffd0a0, 0);
      // туловище с полосками
      p.rect(-20, -72, 40, 58, fur, 16);
      p.ellipse(4, -42, 22, 40, CREAM, 0);
      for (const [y, d] of [[-62, 12], [-50, 10], [-36, 12], [-24, 8]] as [number, number][]) {
        p.flat(OUTLINE).fillTriangle(-20, y - 3, -20 + d, y, -20, y + 3);
        p.flat(OUTLINE).fillTriangle(20, y - 1, 20 - d, y + 2, 20, y + 5);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -72, 40, 58, 16);
      // голова-арбуз
      const hx = 2, hy = -100, r = 28;
      p.circle(hx, hy, r, 0x3fae3a);
      for (const k of [-0.72, -0.36, 0, 0.36, 0.72]) {
        const pts: Pt[] = [];
        for (let i = 0; i <= 14; i++) {
          const a = -Math.PI / 2 + (Math.PI * i) / 14;
          pts.push([hx + r * (k + Math.sin(i * 1.4) * 0.05) * Math.cos(a), hy + (r - 1.5) * Math.sin(a)]);
        }
        stroke(p, pts, 4.5, 0x1f6a2a);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeCircle(hx, hy, r);
      shine(p, -12, -116, 10, 6, 0.4);
      // срез с мякотью — лицо
      p.ellipse(12, -96, 40, 38, 0xd8f0a0, 2.8);
      p.ellipse(12, -96, 33, 31, 0xff4f5f, 0);
      for (const [x, y] of [[0, -108], [24, -108], [-2, -90], [26, -88], [6, -82], [18, -82]]) p.flat(OUTLINE).fillEllipse(x, y, 2.6, 4);
      bigEye(p, 5, -101, 6.5, 0.35);
      bigEye(p, 20, -101, 6, 0.35);
      brow(p, 0, -110, 9, -108, 2.6);
      p.poly([[10, -93], [16, -93], [13, -89]], 0xff9ab0, 1.8);
      p.smile(13, -84, 9);
      for (const d of [-2, 2]) {
        p.line(26, -92 + d, 40, -94 + d * 3, 1.5);
        p.line(-2, -92 + d, -14, -94 + d * 3, 1.5);
      }
      // лапы
      tube(p, [[18, -60], [30, -50], [28, -38]], 7, fur);
      p.line(25, -40, 31, -40, 1.6);
    }, 132, 92, 130);
  },

  // Зибра Зубра Зибралини: зебра в чёрно-белую полоску, в тёмных очках и с цепью
  zibra: (sc) => {
    const legs = makeLegs(sc, { skin: WHITE, shoe: 0x2a2a34, len: 14, spread: 9, width: 9 });
    legBands(legs, 9, [1, 6, 11], OUTLINE, 3.2);
    return assemble(sc, legs, (p) => {
      // хвост с кисточкой
      p.line(-18, -36, -32, -24, 3.2);
      p.poly([[-30, -28], [-40, -20], [-36, -12], [-28, -20]], OUTLINE, 0);
      // уши
      p.poly([[-6, -122], [-10, -142], [4, -126]], WHITE);
      p.poly([[4, -126], [8, -144], [14, -124]], WHITE);
      p.flat(OUTLINE).fillTriangle(-5, -125, -8, -137, 1, -126).fillTriangle(6, -127, 8, -139, 11, -126);
      // грива-ирокез от макушки по шее
      for (let i = 0; i < 7; i++) {
        const x = -8 - i * 1.6, y = -124 + i * 7;
        p.poly([[x + 2, y - 2], [x - 12, y + 1], [x + 1, y + 6]], i % 2 ? WHITE : OUTLINE, 2.4);
      }
      // туловище в полоску
      p.rect(-20, -76, 40, 62, WHITE, 14);
      for (const y of [-64, -50, -36, -24]) {
        stroke(p, [[-19, y], [-8, y + 3], [0, y - 1]], 5);
        stroke(p, [[19, y - 4], [10, y - 1], [4, y - 5]], 5);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -76, 40, 62, 14);
      // шея и голова
      p.rect(-10, -104, 22, 34, WHITE, 8);
      stroke(p, [[-9, -96], [0, -93], [11, -97]], 4.5);
      stroke(p, [[-9, -84], [0, -81], [11, -85]], 4.5);
      p.ellipse(8, -112, 46, 30, WHITE);
      for (const x of [-8, 0]) stroke(p, [[x, -125], [x + 3, -116], [x - 1, -104]], 4);
      p.ellipse(31, -107, 26, 24, 0x3a3a46); // тёмная морда
      p.flat(0x5a5a6a).fillEllipse(33, -112, 14, 6);
      p.flat(OUTLINE).fillEllipse(38, -112, 4, 3);
      grin(p, 32, -102, 14, 6);
      // тёмные очки
      p.rect(0, -122, 13, 10, 0x2a2a34, 4, 2.6);
      p.rect(15, -123, 13, 10, 0x2a2a34, 4, 2.6);
      p.line(12, -118, 16, -118, 2.6);
      p.line(0, -118, -10, -114, 2.6);
      p.flat(WHITE, 0.6).fillTriangle(2, -120, 7, -120, 2, -115).fillTriangle(17, -121, 22, -121, 17, -116);
      // золотая цепь
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.15 + (i / 8) * 0.7);
        p.circle(1 + Math.cos(a) * 18, -78 + Math.sin(a) * 9, 2.6, 0xffcf3f, 1.4);
      }
      // копытце-рука
      tube(p, [[16, -64], [28, -54], [26, -42]], 6, WHITE);
      p.rect(21, -42, 10, 6, 0x2a2a34, 2, 2.2);
    }, 146, 84, 144);
  },

  // Иль Както Гиппопотамо: бегемот-кактус с колючками, розовым цветком и в сандалиях
  cacto: (sc) => {
    const green = 0x5e9c3a;
    const legs = makeLegs(sc, { skin: green, shoe: 0x4f8a2f, len: 12, spread: 12, width: 11, sole: 0xa86a3a, shoeLen: 22 });
    for (const g of legs) {
      g.lineStyle(3.4, 0x8a5428, 1).lineBetween(-4, 7, 6, 13);
      g.lineStyle(3.4, 0x8a5428, 1).lineBetween(8, 7, 2, 13);
    }
    return assemble(sc, legs, (p) => {
      const spine = (x: number, y: number, dx: number, dy: number) => p.line(x, y, x + dx, y + dy, 1.8, 0xfff4dc);
      // руки-отростки кактуса
      tube(p, [[-30, -54], [-44, -56], [-46, -76]], 10, green);
      tube(p, [[30, -46], [44, -50], [48, -68]], 10, green);
      for (const [x, y, dx, dy] of [[-50, -70, -6, -2], [-50, -62, -6, 1], [52, -64, 6, -1], [52, -56, 6, 2], [-46, -82, -1, -6], [48, -74, 1, -6]]) spine(x, y, dx, dy);
      // круглое тело с рёбрами
      p.ellipse(0, -50, 72, 70, green);
      p.flat(0x7ab84f).fillEllipse(-12, -54, 16, 46);
      for (const k of [-0.55, 0, 0.55]) stroke(p, arc(0, -50, 34 * Math.abs(k), 33, -Math.PI / 2, Math.PI / 2, 12).map(([x, y]): Pt => [k < 0 ? -x : x, y]), 2.2, 0x467a2a);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeEllipse(0, -50, 72, 70);
      for (const [x, y, dx, dy] of [[-34, -60, -6, -2], [-34, -38, -6, 2], [34, -36, 6, 2], [-22, -78, -3, -5], [-26, -24, -4, 4], [26, -24, 4, 4]]) spine(x, y, dx, dy);
      // голова бегемота: бугорки глаз, ушки, огромная морда
      p.circle(-8, -116, 6, green); // ушки
      p.circle(20, -120, 6, green);
      p.flat(0xf7b6c6).fillCircle(-8, -116, 2.6).fillCircle(20, -120, 2.6);
      p.rect(-16, -116, 38, 36, green, 16);
      p.circle(0, -112, 9, green); // бугорки под глаза
      p.circle(16, -114, 9, green);
      p.ellipse(24, -88, 52, 38, 0x7ab84f); // широкая морда
      p.flat(0x9ad06a).fillEllipse(20, -98, 26, 8);
      p.ellipse(28, -98, 7, 9, 0x467a2a, 2); // ноздри
      p.ellipse(40, -96, 7, 9, 0x467a2a, 2);
      p.g.lineStyle(2.8, OUTLINE, 1).beginPath().arc(26, -98, 19, Phaser.Math.DegToRad(40), Phaser.Math.DegToRad(140), false).strokePath();
      p.rect(16, -84, 6, 6, WHITE, 1.5, 1.8); // зубки снизу
      p.rect(30, -84, 6, 6, WHITE, 1.5, 1.8);
      bigEye(p, 0, -113, 6, 0.4);
      bigEye(p, 16, -115, 6, 0.4);
      blush(p, 6, -94, 4);
      for (const [x, y, dx, dy] of [[-16, -102, -6, -1], [-14, -88, -5, 3]]) spine(x, y, dx, dy);
      // розовый цветок на макушке
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        p.circle(6 + Math.cos(a) * 6, -128 + Math.sin(a) * 6, 5, 0xff7ab0, 2.2);
      }
      p.circle(6, -128, 3.6, 0xffd23f, 1.8);
    }, 136, 108, 134);
  },

  // Рино Тостерино: серый носорог с туловищем-тостером, из которого выскакивают тосты
  rhino: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x9aa3ad, shoe: 0x5a6070, len: 12, spread: 13, width: 11 }), (p) => {
      const grey = 0x9aa3ad;
      // тосты из щелей
      for (const [x, y] of [[-20, -112], [2, -106]] as [number, number][]) {
        p.rect(x, y, 18, 30, 0xc0803a, 7);
        p.rect(x + 3, y + 3, 12, 26, 0xf2d29a, 5, 0);
        p.flat(0xe0b06a).fillCircle(x + 7, y + 10, 1.6).fillCircle(x + 11, y + 16, 1.4);
      }
      // тостер-туловище
      p.rect(-30, -88, 58, 72, 0xc9d3dc, 14);
      p.flat(0xa8b4c4).fillRoundedRect(12, -84, 12, 64, 6);
      p.flat(WHITE, 0.7).fillRoundedRect(-24, -82, 6, 50, 3);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-30, -88, 58, 72, 14);
      p.rect(-23, -91, 22, 6, 0x3a3a46, 3, 2.4); // щели
      p.rect(0, -91, 22, 6, 0x3a3a46, 3, 2.4);
      p.rect(-30, -26, 58, 10, 0x5a6070, 4, 2.6); // основание
      p.rect(-38, -62, 10, 7, 0x3a3a46, 2, 2.4); // рычажок
      p.circle(-14, -42, 5, 0x3a3a46, 2.2); // ручка-регулятор
      p.line(-14, -42, -12, -46, 1.6, WHITE);
      // голова носорога спереди
      p.ellipse(12, -88, 12, 18, grey, 2.6); // ухо
      p.ellipse(28, -66, 44, 38, grey);
      p.flat(0xb5bec8).fillEllipse(34, -60, 26, 14);
      p.poly([[34, -78], [42, -94], [52, -110], [52, -90], [50, -74]], 0xe8d4a8, 2.8); // рог
      p.flat(0xf7ecd0).fillTriangle(42, -84, 50, -104, 46, -80);
      p.poly([[24, -82], [30, -98], [34, -80]], 0xe8d4a8, 2.4);
      p.flat(OUTLINE).fillEllipse(44, -64, 3, 4);
      bigEye(p, 22, -72, 6, 0.4);
      brow(p, 16, -81, 28, -80, 2.8);
      p.smile(36, -56, 10);
      blush(p, 22, -60, 3.5);
      // ручка машет из-под морды
      tube(p, [[12, -44], [24, -38], [26, -28]], 7, grey);
    }, 116, 96, 112),

  // Балерино Лололо: балерун с каштановой чёлкой, голубой пачкой и вытянутым носочком
  ballerino: (sc) => {
    const skin = 0xf5d0b0;
    return assemble(sc, balletLegs(sc, 0xf2f2f8, 0xf2b6c4), (p) => {
      const hair = 0x6a3a1a;
      // руки: одна аркой над головой, вторая в сторону
      tube(p, [[6, -72], [26, -94], [26, -122], [10, -138]], 4.5, skin);
      tube(p, [[-6, -70], [-24, -76], [-42, -70]], 4.5, skin);
      // пачка
      for (let i = -3; i <= 3; i++) p.circle(i * 9, -36, 7, 0x8ad0ff, 2.4);
      p.ellipse(0, -40, 66, 16, 0x8ad0ff);
      p.ellipse(0, -44, 50, 12, 0xbfe6ff);
      // туника
      p.rect(-10, -76, 20, 34, 0x3d6fb6, 7);
      p.flat(WHITE, 0.35).fillRect(-7, -72, 3, 24);
      p.poly([[-6, -76], [6, -76], [0, -68]], WHITE, 2);
      // голова и каштановые волосы
      p.circle(2, -96, 18, skin);
      p.poly([[-16, -98], [-18, -114], [-8, -122], [8, -124], [20, -118], [24, -106], [16, -110], [8, -106], [0, -110], [-8, -104], [-12, -96]], hair);
      p.flat(0x8a5228).fillEllipse(2, -117, 14, 4);
      bigEye(p, -1, -96, 5.5, 0.35);
      bigEye(p, 12, -96, 5.5, 0.35);
      brow(p, -6, -104, 3, -103, 3.4);
      brow(p, 8, -103, 17, -104, 3.4);
      p.smile(7, -84, 10);
      blush(p, -6, -86, 3.5);
      blush(p, 18, -86, 3.5);
      p.circle(-44, -70, 4, skin, 2.2);
      p.circle(9, -139, 4.5, skin, 2.4);
    }, 132, 92, 128);
  },

  // Кокофанто Элефанто: качок-слон с головой-кокосом (волосатая скорлупа, хобот)
  cocofanto: (sc) =>
    assemble(sc, makeLegs(sc, { skin: 0x9aa3ad, shoe: 0x3a3a46, len: 14, spread: 11, width: 11, sole: WHITE }), (p) => {
      const grey = 0xa8b0ba;
      const shell = 0x7a4a2a;
      // большие уши
      p.ellipse(-32, -118, 28, 40, grey);
      p.flat(0xf2b6c4).fillEllipse(-32, -116, 14, 26);
      p.ellipse(32, -120, 24, 36, 0x8a929c);
      // мускулистый торс
      p.poly([[-30, -84], [30, -84], [20, -24], [-20, -24]], grey);
      p.flat(0x8a929c).fillTriangle(18, -82, 28, -82, 18, -28);
      p.g.lineStyle(3.2, OUTLINE, 1).strokePoints([[-30, -84], [30, -84], [20, -24], [-20, -24]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
      stroke(p, arc(-10, -74, 10, 7, Math.PI * 0.1, Math.PI * 0.9, 8), 2.4); // грудь
      stroke(p, arc(10, -74, 10, 7, Math.PI * 0.1, Math.PI * 0.9, 8), 2.4);
      for (const y of [-58, -48, -38]) {
        p.rect(-9, y, 8, 8, 0xb8c0ca, 3, 1.8);
        p.rect(1, y, 8, 8, 0xb8c0ca, 3, 1.8);
      }
      p.rect(-21, -30, 42, 12, TOMATO, 3, 2.8); // шорты
      p.flat(WHITE).fillRect(-21, -24, 42, 2.5);
      // руки: позирует бицепсами
      for (const s of [-1, 1]) {
        tube(p, [[s * 26, -78], [s * 46, -70]], 12, grey);
        tube(p, [[s * 46, -70], [s * 50, -92]], 11, grey);
        p.circle(s * 37, -80, 8.5, grey, 2.6);
        p.circle(s * 50, -96, 7.5, grey, 2.6);
      }
      // голова-кокос с волосками
      p.circle(0, -112, 27, shell);
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39, rr = 6 + ((i * 7) % 19);
        const x = Math.cos(a) * rr, y = -112 + Math.sin(a) * rr;
        p.line(x, y, x + 3, y + 2.5, 1.6, i % 2 ? 0x5a3218 : 0xa0703a);
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        p.line(Math.cos(a) * 26, -112 + Math.sin(a) * 26, Math.cos(a) * 31, -112 + Math.sin(a) * 31, 1.8, 0x5a3218);
      }
      p.g.lineStyle(3.2, OUTLINE, 1).strokeCircle(0, -112, 27);
      shine(p, -12, -126, 12, 6, 0.3);
      p.flat(0x3a2010).fillCircle(-6, -133, 2.6).fillCircle(2, -134, 2.6).fillCircle(-2, -128, 2.6); // три «глазка» кокоса
      bigEye(p, -6, -112, 7, 0.35);
      bigEye(p, 12, -112, 7, 0.35);
      brow(p, -13, -122, -1, -120, 3.2);
      brow(p, 6, -120, 18, -122, 3.2);
      // хобот-кокос и бивни
      p.poly([[-4, -96], [10, -90], [-6, -88]], WHITE, 2.2);
      tube(p, [[4, -102], [8, -86], [16, -78], [24, -80]], 9, shell);
      for (const [x, y] of [[6, -94], [12, -82]]) p.line(x - 3, y, x + 3, y + 1, 1.6, 0x5a3218);
      blush(p, 18, -102, 3.5);
    }, 144, 108, 142),

  // Жирафа Челестре: жираф-космонавт в скафандре и с пузырём шлема на голове
  girafa: (sc) => {
    const legs = makeLegs(sc, { skin: 0xeef2f6, shoe: 0x8a96a3, len: 12, spread: 9, width: 10, sole: 0x5a6070 });
    legBands(legs, 10, [3], 0xc9d3dc, 3);
    return assemble(sc, legs, (p) => {
      const yel = 0xf2c14e;
      const spot = 0xc8782a;
      // ранец
      p.rect(-32, -60, 14, 38, 0xb5bec8, 4);
      p.rect(-30, -26, 10, 6, 0x5a6070, 2, 2.2);
      // скафандр
      p.rect(-20, -62, 40, 48, 0xeef2f6, 14);
      p.flat(0xd5dee5).fillRoundedRect(8, -58, 9, 40, 4);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeRoundedRect(-20, -62, 40, 48, 14);
      p.rect(-20, -30, 40, 6, 0x8a96a3, 0, 2.4); // пояс
      p.rect(-11, -52, 18, 13, 0x5a6070, 3, 2.4); // пульт на груди
      p.flat(TOMATO).fillCircle(-6, -45, 2.2);
      p.flat(0x7ad04a).fillCircle(0, -45, 2.2);
      p.flat(0x7ad0ff).fillRect(-8, -50, 12, 2);
      p.circle(13, -50, 4.5, 0x3d6fb6, 2.2); // нашивка
      p.flat(WHITE).fillCircle(13, -50, 1.6);
      // длинная пятнистая шея
      p.poly([[-6, -64], [10, -64], [15, -104], [3, -104]], yel);
      for (const [x, y, w, h] of [[1, -72, 7, 6], [9, -80, 5, 6], [4, -90, 7, 6], [11, -96, 4, 4], [-1, -82, 4, 5]] as [number, number, number, number][]) p.flat(spot).fillRoundedRect(x - w / 2, y - h / 2, w, h, 2);
      p.ellipse(2, -63, 30, 10, 0xc9d3dc, 2.8); // воротник скафандра
      // голова
      p.line(4, -126, 2, -138, 3.6); // рожки
      p.line(14, -126, 14, -138, 3.6);
      p.circle(2, -139, 3.2, spot, 2);
      p.circle(14, -139, 3.2, spot, 2);
      p.ellipse(-4, -124, 10, 6, yel, 2.4); // ухо
      p.ellipse(12, -118, 30, 22, yel);
      p.flat(spot).fillCircle(4, -122, 2.6).fillCircle(8, -113, 2);
      p.ellipse(26, -113, 18, 14, 0xf7d98a, 2.6);
      p.flat(OUTLINE).fillCircle(30, -116, 1.4).fillCircle(26, -117, 1.2);
      bigEye(p, 14, -122, 5.5, 0.4);
      p.smile(26, -108, 7);
      blush(p, 10, -111, 3);
      // пузырь шлема
      p.flat(0xbfe6ff, 0.28).fillCircle(12, -120, 25);
      p.g.lineStyle(3.2, OUTLINE, 1).strokeCircle(12, -120, 25);
      stroke(p, arc(12, -120, 20, 20, Math.PI * 1.1, Math.PI * 1.45, 6), 3, WHITE);
      p.flat(WHITE, 0.8).fillCircle(29, -134, 2.2);
      p.ellipse(10, -97, 30, 8, 0xc9d3dc, 2.6); // кольцо шлема
      // рука в перчатке машет
      tube(p, [[16, -52], [30, -62], [36, -78]], 7, 0xeef2f6);
      p.circle(37, -81, 5.5, 0x8a96a3, 2.4);
    }, 146, 84, 145);
  },
};
