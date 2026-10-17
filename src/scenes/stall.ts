import Phaser from 'phaser';
import type { Look } from '../core/look';
import { LOCATIONS } from '../core/locations';
import { t } from '../i18n';
import { drawBrainrot, type Critter } from './brainrots';
import { AMBER, CREAM, DISPLAY_FONT, LEAF, MEAT, MEAT_DARK, OUTLINE, Pen, TOMATO, WHITE, WOOD, shade } from './draw';

// Ларёк собирается из слоёв. Стиль корпуса и крыши свой на каждой локации,
// а каждое улучшение добавляет на точку предмет, который растёт со стадией (1–5).
// Координаты: (0, 0) — середина основания, вверх — минус.

export const STALL_H = 150;

export interface StallParts {
  root: Phaser.GameObjects.Container; // обычный слой
  glow: Phaser.GameObjects.Container; // свет поверх ночного затемнения
  stripes: Phaser.GameObjects.Rectangle[];
  heaters: Phaser.GameObjects.Rectangle[];
  bulbs: Phaser.GameObjects.Arc[];
  pulses: Phaser.GameObjects.GameObject[]; // мягко мигают
  beams: Phaser.GameObjects.Graphics[]; // прожекторы
  staff: Critter[];
  neon?: Phaser.GameObjects.Text;
  winGlow: Phaser.GameObjects.Rectangle;
  steam: { x: number; y: number }[];
  flag?: Phaser.GameObjects.Graphics;
  left: number;
  right: number;
  top: number;
  hit: { x: number; y: number; w: number; h: number };
}

type Pt = [number, number];

function rot(points: Pt[], angle: number, cx: number, cy: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return points.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function star(cx: number, cy: number, r1: number, r2: number, n = 5): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function buildStall(scene: Phaser.Scene, location: number, look: Look): StallParts {
  const loc = LOCATIONS[location];
  const style = loc.id;
  const S = look.stages;
  const W = loc.width;
  const H = STALL_H;
  const body = loc.body;
  const roof = loc.roof;

  const root = scene.add.container(0, 0).setDepth(5);
  const glow = scene.add.container(0, 0).setDepth(9);
  const parts: StallParts = {
    root, glow, stripes: [], heaters: [], bulbs: [], pulses: [], beams: [], staff: [],
    winGlow: undefined as unknown as Phaser.GameObjects.Rectangle,
    steam: [], left: -W / 2 - 24, right: W / 2 + 24, top: -H - 80,
    hit: { x: 0, y: -H / 2 - 30, w: W + 60, h: H + 110 },
  };
  const layer = () => {
    const g = scene.add.graphics();
    root.add(g);
    return new Pen(g, 3);
  };
  const addGlow = (o: Phaser.GameObjects.GameObject) => {
    glow.add(o);
    return o;
  };

  const winW = W * 0.56, winH = H * 0.46;
  const winX = -W * 0.1, winY = -H * 0.6;
  const winL = winX - winW / 2, winR = winX + winW / 2, winT = winY - winH / 2;
  const counterY = winY + winH / 2;
  const annex = S.window > 0;
  const annexW = 54;
  if (annex) parts.right = W / 2 + annexW + 10;

  // ---------- задний план вокруг ларька ----------
  const back = layer();
  // тень
  back.flat(0x000000, 0.2).fillEllipse(annex ? annexW / 2 : 0, 2, W + 70 + (annex ? annexW : 0), 20);

  // ковёр перед ларьком (украшение 4)
  if (look.tier >= 4) {
    back.ellipse(0, 6, W + 40, 22, 0xb8283a, 2.5);
    back.ellipse(0, 6, W + 20, 14, 0xd9384a, 0);
    back.g.lineStyle(2, 0xffd86b, 1).strokeEllipse(0, 6, W + 26, 17);
  }

  // доска для сёрфа у пляжного киоска
  if (style === 'beach') {
    back.poly(rot([[-9, -50], [9, -50], [11, 0], [0, 54], [-11, 0]], -0.18, -W / 2 - 10, -54), WHITE, 2.5);
    back.poly(rot([[-3, -46], [3, -46], [3, 46], [-3, 46]], -0.18, -W / 2 - 10, -54), TOMATO, 0);
  }

  // самокат курьера у стены
  if (S.courier > 0) {
    const sx = -W / 2 - (style === 'beach' ? 40 : 22), sy = -2;
    back.circle(sx - 14, sy - 6, 7, OUTLINE, 0);
    back.circle(sx + 16, sy - 6, 7, OUTLINE, 0);
    back.circle(sx - 14, sy - 6, 3, 0x9a9aa8, 0);
    back.circle(sx + 16, sy - 6, 3, 0x9a9aa8, 0);
    back.line(sx - 16, sy - 10, sx + 16, sy - 10, 5);
    back.line(sx - 16, sy - 10, sx + 16, sy - 10, 2.5, 0x3d6fb6);
    back.line(sx + 14, sy - 10, sx + 18, sy - 44, 3);
    back.line(sx + 12, sy - 44, sx + 24, sy - 44, 3);
    back.rect(sx - 16, sy - 32, 22, 20, AMBER, 4);
    back.flat(MEAT_DARK).fillRect(sx - 11, sy - 25, 12, 3);
    if (S.courier >= 3) back.rect(sx - 14, sy - 40, 18, 9, TOMATO, 3, 2); // второй термокороб
  }

  // ---------- корпус: верх ----------
  const upper = layer();
  const bodyTop = -H, lowerTop = counterY;
  if (annex) {
    // пристройка с окошком справа
    const ax = W / 2 - 6;
    upper.rect(ax, -H * 0.78, annexW + 6, H * 0.78, shade(body, -0.08), 4);
    upper.rect(ax + 12, -H * 0.62, annexW - 18, H * 0.3, 0x3b2a4f, 3, 2.5);
    upper.rect(ax + 8, -H * 0.32 - 4, annexW - 10, 7, CREAM, 2, 2.5);
    upper.flat(0xffb347, 0.5).fillRect(ax + 14, -H * 0.6, annexW - 22, H * 0.26);
    if (S.window >= 2) {
      for (let i = 0; i < 4; i++) {
        const sx = ax + 4 + i * ((annexW + 2) / 4);
        upper.rect(sx, -H * 0.82, (annexW + 2) / 4, 12, i % 2 ? roof : CREAM, 0, 2);
      }
    }
    if (S.window >= 3) {
      upper.circle(ax + annexW / 2 + 3, -H * 0.9, 9, AMBER, 2.5);
      upper.flat(OUTLINE).fillRect(ax + annexW / 2 + 1, -H * 0.94, 4, 8);
    }
    if (S.window >= 4) upper.rect(ax + annexW - 8, -H * 0.3, 10, 12, 0x5e9c3a, 2, 2); // кассовый терминал
    parts.steam.push({ x: ax + annexW / 2, y: -H * 0.62 });
  }

  const drawBodyBlock = (p: Pen, y0: number, y1: number) => {
    const h = y1 - y0;
    if (style === 'desert') p.rect(-W / 2, y0, W, h, body, y0 === bodyTop ? 14 : 0);
    else p.rect(-W / 2, y0, W, h, body, 0);
  };
  drawBodyBlock(upper, bodyTop, lowerTop);
  // фактура верха
  if (style === 'metro') {
    for (let i = 1; i < 4; i++) upper.line(-W / 2 + (W / 4) * i, bodyTop + 3, -W / 2 + (W / 4) * i, lowerTop, 1.5, shade(body, -0.25));
    for (let x = -W / 2 + 8; x < W / 2; x += 16) upper.flat(shade(body, -0.3)).fillCircle(x, bodyTop + 6, 1.6);
  } else if (style === 'beach') {
    for (let y = bodyTop + 14; y < lowerTop; y += 14) upper.line(-W / 2 + 2, y, W / 2 - 2, y, 1.5, shade(body, -0.22));
  } else if (style === 'jungle') {
    for (let x = -W / 2 + 6; x < W / 2; x += 14) {
      upper.rect(x - 6, bodyTop, 12, lowerTop - bodyTop, x % 28 < 14 ? 0xc9b26a : 0xb8a05a, 3, 1.5);
      for (let y = bodyTop + 18; y < lowerTop; y += 22) upper.line(x - 6, y, x + 6, y, 2, 0x8a7a3a);
    }
  } else if (style === 'desert') {
    upper.line(-W * 0.4, bodyTop + 30, -W * 0.36, bodyTop + 44, 1.5, shade(body, -0.3));
    upper.line(-W * 0.36, bodyTop + 44, -W * 0.39, bodyTop + 52, 1.5, shade(body, -0.3));
    upper.line(W * 0.44, bodyTop + 20, W * 0.41, bodyTop + 34, 1.5, shade(body, -0.3));
    for (const x of [-W * 0.4, -W * 0.15, W * 0.1, W * 0.35]) upper.rect(x - 5, bodyTop + 6, 10, 9, WOOD, 3, 2); // торцы балок
  } else if (style === 'piazza') {
    for (let y = bodyTop + 2, row = 0; y < lowerTop - 6; y += 13, row++)
      for (let x = -W / 2 + 2 + (row % 2) * 12; x < W / 2 - 14; x += 24)
        upper.flat(shade(body, ((x + y) & 3) * 0.04 - 0.06)).fillRoundedRect(x, y, 22, 11, 2);
  }

  // окно выдачи
  const frame = style === 'metro' ? 0x9a9aa8 : style === 'piazza' ? 0xe8d8b8 : shade(body, -0.35);
  if (style === 'piazza') {
    upper.rect(winL - 6, winT - 4, winW + 12, winH + 8, frame, 0, 3);
    upper.ellipse(winX, winT - 2, winW + 12, 44, frame, 3);
    upper.flat(frame).fillRect(winL - 4.5, winT - 4, winW + 9, 10);
    upper.ellipse(winX, winT, winW, 34, 0x3b2a4f, 0);
    upper.circle(winX, winT - 20, 5, AMBER, 2); // замковый камень
  } else upper.rect(winL - 5, winT - 5, winW + 10, winH + 10, frame, style === 'desert' ? 10 : 2, 3);
  upper.rect(winL, winT, winW, winH, 0x3b2a4f, style === 'desert' ? 8 : 0, 0);
  // полки с банками внутри
  upper.flat(0x2e2142).fillRect(winL, winT + winH * 0.22, winW, 3);
  for (let i = 0; i < 6; i++) {
    const jx = winL + winW * 0.55 + i * 9;
    if (jx > winR - 6) break;
    upper.rect(jx, winT + winH * 0.22 - 9, 6, 9, [0xe4472b, 0x5e9c3a, 0xffb02e][i % 3], 2, 1.5);
  }
  // магнитная планка с ножами (нож, стадия 3)
  if (S.knife >= 3) {
    upper.rect(winL + 6, winT + 6, 36, 4, 0x9a9aa8, 1, 1.5);
    for (let i = 0; i < 4; i++) upper.rect(winL + 9 + i * 8, winT + 9, 3, 14, 0xd8dde6, 1, 1.5);
  }
  parts.winGlow = scene.add.rectangle(winX, winY, winW, winH, 0xffb347, 0).setBlendMode(Phaser.BlendModes.ADD);
  addGlow(parts.winGlow);

  // гриль и вертела
  const spits = [winL + winW * 0.22];
  if (S.second_spit > 0) spits.push(winL + winW * 0.44);
  const coneH = winH * 0.66;
  const cone = layer();
  for (const x of spits) {
    const heater = scene.add.rectangle(x - 17, winY + 2, 7, winH * 0.7, 0xff6a2b, 0.9);
    root.add(heater);
    parts.heaters.push(heater);
    const light = scene.add.rectangle(x - 17, winY + 2, 16, winH * 0.8, 0xff6a2b, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    addGlow(light);
    parts.pulses.push(light);
  }
  const coneLayer = cone;
  for (const x of spits) {
    coneLayer.line(x, winT + 2, x, winT + winH - 2, 3, 0x9a9aa8);
    coneLayer.poly([[x - 15, winY + 2 - coneH / 2], [x + 15, winY + 2 - coneH / 2], [x + 8, winY + 2 + coneH / 2], [x - 8, winY + 2 + coneH / 2]], MEAT, 0);
    coneLayer.flat(0xd98a45, 0.8).fillRect(x - 7, winY + 2 - coneH * 0.45, 4, coneH * 0.85);
    for (let i = 0; i < 5; i++) {
      const st = scene.add.rectangle(x, 0, 28, 2.5, MEAT_DARK);
      st.setData({ top: winY + 2 - coneH / 2, h: coneH, i });
      root.add(st);
      parts.stripes.push(st);
    }
    parts.steam.push({ x, y: winY - coneH / 2 });
  }
  const coneLine = layer();
  for (const x of spits) {
    coneLine.g.lineStyle(2.5, OUTLINE, 1).strokePoints([
      new Phaser.Math.Vector2(x - 15, winY + 2 - coneH / 2), new Phaser.Math.Vector2(x + 15, winY + 2 - coneH / 2),
      new Phaser.Math.Vector2(x + 8, winY + 2 + coneH / 2), new Phaser.Math.Vector2(x - 8, winY + 2 + coneH / 2),
    ], true);
    coneLine.rect(x - 8, winY - coneH / 2 - 4, 16, 6, 0x9a9aa8, 2, 2);
  }

  // работники за прилавком: ноги прячутся за нижней панелью
  const addStaff = (id: string, x: number, hat: number) => {
    const c = drawBrainrot(scene, id);
    const sc = 64 / c.height;
    c.root.setPosition(x, counterY + 8).setScale(sc);
    c.root.setData('y0', counterY + 8);
    if (hat >= 2) {
      // поварской колпак
      const g = scene.add.graphics();
      const p = new Pen(g, 2.5);
      const top = -c.height - 4;
      p.rect(-10, top, 20, 8, WHITE, 2);
      p.circle(-7, top - 6, 7, WHITE);
      p.circle(7, top - 6, 7, WHITE);
      p.circle(0, top - 10, 8, WHITE);
      p.flat(WHITE).fillRect(-9, top - 4, 18, 7);
      if (hat >= 4) p.circle(0, top + 4, 3, 0xffd86b, 1.5);
      c.body.add(g);
    }
    root.add(c.root);
    parts.staff.push(c);
  };
  if (S.grill_helper > 0) addStaff('tungtung', winL + winW * 0.66, S.grill_helper);
  if (S.cashier > 0) addStaff('ballerina', winR - 16, S.cashier);

  // ---------- корпус: низ, прилавок и всё, что перед работниками ----------
  const front = layer();
  drawBodyBlock(front, lowerTop, 0);
  front.flat(shade(body, -0.18)).fillRect(-W / 2 + 1.5, lowerTop + 1.5, W - 3, -lowerTop - 3);
  if (style === 'metro') {
    for (let i = 1; i < 4; i++) front.line(-W / 2 + (W / 4) * i, lowerTop + 2, -W / 2 + (W / 4) * i, -2, 2, shade(body, -0.35));
  } else if (style === 'beach') {
    for (let y = lowerTop + 14; y < 0; y += 14) front.line(-W / 2 + 2, y, W / 2 - 2, y, 1.5, shade(body, -0.35));
    front.rect(-W / 2 - 4, bodyTop - 4, 10, H + 4, WOOD, 2, 2.5);
    front.rect(W / 2 - 6, bodyTop - 4, 10, H + 4, WOOD, 2, 2.5);
  } else if (style === 'jungle') {
    // плетёная панель
    for (let y = lowerTop + 6; y < -4; y += 10)
      for (let x = -W / 2 + 6 + ((y / 10) % 2) * 10; x < W / 2 - 6; x += 20) front.flat(shade(body, -0.32)).fillRoundedRect(x, y, 12, 5, 2);
    front.rect(-W / 2 - 6, bodyTop - 6, 12, H + 6, 0xc9b26a, 4, 2.5);
    front.rect(W / 2 - 6, bodyTop - 6, 12, H + 6, 0xc9b26a, 4, 2.5);
    for (const x of [-W / 2, W / 2]) for (let y = bodyTop + 20; y < 0; y += 26) front.line(x - 6, y, x + 6, y, 2, 0x8a7a3a);
  } else if (style === 'desert') {
    // ковёр на стене
    const rw = W * 0.42, rx = -W * 0.24, ry = lowerTop + 8, rh = -lowerTop - 14;
    front.rect(rx - rw / 2, ry, rw, rh, 0x9a2a3a, 2, 2.5);
    front.rect(rx - rw / 2 + 5, ry + 5, rw - 10, rh - 10, 0xd9a03a, 0, 0);
    for (let i = 0; i < 5; i++) front.poly([[rx - rw / 2 + 8 + i * ((rw - 16) / 5), ry + rh / 2], [rx - rw / 2 + 8 + (i + 0.5) * ((rw - 16) / 5), ry + 8], [rx - rw / 2 + 8 + (i + 1) * ((rw - 16) / 5), ry + rh / 2], [rx - rw / 2 + 8 + (i + 0.5) * ((rw - 16) / 5), ry + rh - 8]], 0x2a6b8a, 1.5);
    for (let i = 0; i < 7; i++) front.line(rx - rw / 2 + 4 + i * (rw - 8) / 6, ry + rh, rx - rw / 2 + 4 + i * (rw - 8) / 6, ry + rh + 5, 2, 0xd9a03a);
  } else if (style === 'piazza') {
    for (let y = lowerTop + 2, row = 0; y < -6; y += 13, row++)
      for (let x = -W / 2 + 2 + (row % 2) * 12; x < W / 2 - 14; x += 24) front.flat(shade(body, -0.26 + ((x + y) & 3) * 0.03)).fillRoundedRect(x, y, 22, 11, 2);
    // ящики с цветами под окном
    front.rect(winL - 4, counterY + 8, winW + 8, 12, 0x8a5a33, 2, 2.5);
    for (let x = winL + 4; x < winR; x += 11) {
      front.circle(x, counterY + 6, 5, LEAF, 1.5);
      front.circle(x + 2, counterY + 3, 3.5, [TOMATO, 0xf28cb1, AMBER][Math.round(x) % 3], 1.5);
    }
  }

  // прилавок
  front.rect(-W / 2 - 9, counterY - 3, W + 18, 9, style === 'jungle' ? 0xb07a4a : CREAM, 2);
  front.flat(shade(CREAM, -0.25)).fillRect(-W / 2 - 7, counterY + 4, W + 14, 2);

  // лаваш стопкой (растёт со стадией)
  const lav = [0, 2, 3, 4, 5, 7][S.lavash];
  for (let i = 0; i < lav; i++) front.ellipse(-W / 2 + 16, counterY - 5 - i * 3.6, 24, 7, i % 2 ? 0xf2e3b3 : 0xead39a, 2);
  // доска и нож
  if (S.knife > 0) {
    const bx = -W / 2 + 46;
    front.rect(bx - 15, counterY - 7, 30, 6, 0xc8915a, 2, 2);
    front.rect(bx - 2, counterY - 12, 18, 4, 0xd8dde6, 1, 1.5);
    front.rect(bx - 10, counterY - 12, 9, 4, OUTLINE, 1, 0);
    if (S.knife >= 2) {
      front.rect(bx - 14, counterY - 17, 14, 3, 0xd8dde6, 1, 1.5);
      front.rect(bx - 0, counterY - 17, 7, 3, TOMATO, 1, 1.5);
    }
    if (S.knife >= 4) front.ellipse(bx + 8, counterY - 9, 9, 4, 0xb5651d, 1.5); // нарезанное мясо
  }
  // соусы
  const bottles = S.sauce >= 3 ? 3 : S.sauce >= 2 ? 2 : S.sauce;
  const sauceCols = [TOMATO, 0xfff8ee, 0x5e9c3a];
  for (let i = 0; i < bottles; i++) {
    const bx = winL + winW * 0.08 + i * 10;
    front.rect(bx - 3.5, counterY - 18, 7, 15, sauceCols[i], 2.5, 2);
    front.rect(bx - 1.5, counterY - 22, 3, 5, i === 1 ? TOMATO : WHITE, 1, 1.5);
  }
  if (S.sauce >= 4) front.rect(winL + winW * 0.08 - 6, counterY - 5, 32, 3, 0x9a9aa8, 1, 1.5);
  // касса
  if (S.cashier > 0) {
    const rx = winR - 12;
    const col = S.cashier >= 3 ? 0xffcf3f : 0x5a5270;
    front.rect(rx - 12, counterY - 16, 24, 13, col, 3, 2.5);
    front.rect(rx - 8, counterY - 22, 16, 7, 0x7ff0d0, 2, 2);
    front.flat(OUTLINE).fillRect(rx - 7, counterY - 11, 14, 2);
  }
  // сыр
  if (S.cheese > 0) {
    const cx = W / 2 - 18;
    front.poly([[cx - 12, counterY - 3], [cx + 12, counterY - 3], [cx + 12, counterY - 13], [cx - 4, counterY - 17]], 0xffd23f, 2.5);
    front.flat(0xe0a020).fillCircle(cx + 4, counterY - 9, 2);
    front.flat(0xe0a020).fillCircle(cx - 3, counterY - 7, 1.5);
    if (S.cheese >= 2) {
      front.ellipse(cx - 2, counterY - 22, 22, 8, 0xffd23f, 2.5);
      front.rect(cx - 13, counterY - 22, 22, 6, 0xffd23f, 0, 0);
    }
  }

  // меню-доска справа от окна
  const mx = W * 0.33, my = -H * 0.62;
  const mw = W * 0.22, mh = H * 0.38;
  front.rect(mx - mw / 2, my - mh / 2, mw, mh, 0x2f3a2f, 3);
  front.g.lineStyle(3, 0x8a6a3a, 1).strokeRect(mx - mw / 2 + 2, my - mh / 2 + 2, mw - 4, mh - 4);
  for (let i = 0; i < 4; i++) {
    front.flat(0xe8efe0, 0.85).fillRect(mx - mw * 0.36, my - mh * 0.3 + i * mh * 0.2, mw * 0.46, 2.5);
    front.flat(AMBER, 0.95).fillRect(mx + mw * 0.18, my - mh * 0.3 + i * mh * 0.2, mw * 0.16, 2.5);
  }

  // наклейка кешбэка на углу меню
  if (S.cashback > 0) {
    const px = mx + mw / 2 - 2, py = my - mh / 2 + 4;
    front.poly(star(px, py, 17, 12, 10), TOMATO, 2.5);
    root.add(scene.add.text(px, py, '−10%', { fontFamily: DISPLAY_FONT, fontSize: '9px', fontStyle: '900', color: '#fff4dc' }).setOrigin(0.5).setAngle(-12));
  }

  // таблички на нижней панели
  if (S.reviews > 0) {
    const px = -W * 0.36, py = -H * 0.16;
    front.rect(px - 22, py - 10, 44, 20, WHITE, 4, 2.5);
    for (let i = 0; i < 5; i++) front.poly(star(px - 15 + i * 7.5, py, 3.6, 1.6), AMBER, 1);
  }


  // горшки с растениями (украшение 1)
  if (look.tier >= 1) {
    for (const sx of [-1, 1]) {
      const px = sx * (W / 2 + 6) + (sx > 0 && annex ? annexW + 4 : 0);
      front.poly([[px - 9, -16], [px + 9, -16], [px + 6, 0], [px - 6, 0]], 0xc8553d, 2.5);
      if (style === 'desert') {
        front.rect(px - 4, -38, 8, 24, 0x5e9c3a, 4, 2);
      } else {
        front.circle(px - 5, -22, 7, LEAF, 2);
        front.circle(px + 5, -24, 7, LEAF, 2);
        front.circle(px, -31, 7, shade(LEAF, 0.1), 2);
      }
    }
  }

  // столик для гостей (двойная порция)
  if (S.double > 0) {
    const tables = S.double >= 3 ? [W * 0.3, W * 0.08] : [W * 0.3];
    for (const tx of tables) {
      const ty = 14;
      front.line(tx, ty - 50, tx, ty - 14, 2.5);
      front.poly([[tx - 30, ty - 44], [tx, ty - 58], [tx + 30, ty - 44]], style === 'piazza' ? 0x2f6b4f : TOMATO, 2.5);
      front.poly([[tx - 10, ty - 44], [tx, ty - 58], [tx + 10, ty - 44]], CREAM, 0);
      front.rect(tx - 18, ty - 16, 36, 4, CREAM, 1, 2);
      front.line(tx - 12, ty - 12, tx - 15, ty, 2.5);
      front.line(tx + 12, ty - 12, tx + 15, ty, 2.5);
      if (S.double >= 2) {
        front.rect(tx - 30, ty - 9, 9, 3, WOOD, 1, 1.5);
        front.line(tx - 26, ty - 6, tx - 26, ty, 2);
        front.rect(tx + 21, ty - 9, 9, 3, WOOD, 1, 1.5);
        front.line(tx + 25, ty - 6, tx + 25, ty, 2);
      }
      front.rect(tx - 6, ty - 22, 12, 6, 0xf2e3b3, 2, 1.5); // шаурма на тарелке
    }
  }

  // ---------- крыша ----------
  const top = layer();
  const ay = -H - 2;
  let roofTop = ay - 30;
  let eave = ay + 12; // где висит гирлянда
  if (style === 'metro') {
    const n = 8, aw = W + 34, sw = aw / n;
    top.rect(-aw / 2 - 3, ay - 30, aw + 6, 6, shade(roof, -0.3), 2);
    for (let i = 0; i < n; i++) {
      const x = -aw / 2 + sw * i;
      const col = i % 2 ? roof : 0xfffaf0;
      top.g.fillStyle(col, 1).fillRect(x, ay - 24, sw, 24);
      top.g.fillStyle(col, 1).slice(x + sw / 2, ay, sw / 2, 0, Math.PI, false).fillPath();
    }
    top.g.lineStyle(3, OUTLINE, 1);
    top.g.strokeRect(-aw / 2, ay - 24, aw, 24);
    for (let i = 0; i < n; i++) {
      top.g.beginPath();
      top.g.arc(-aw / 2 + sw * (i + 0.5), ay, sw / 2, 0, Math.PI, false);
      top.g.strokePath();
    }
    roofTop = ay - 30;
    eave = ay + sw / 2 - 2;
  } else if (style === 'beach') {
    const straw = roof;
    top.poly([[-W / 2 - 26, ay + 10], [W / 2 + 26, ay + 10], [W / 2 - 4, ay - 36], [-W / 2 + 4, ay - 36]], straw);
    for (let x = -W / 2 - 22; x < W / 2 + 22; x += 9) top.poly([[x, ay + 8], [x + 9, ay + 8], [x + 4.5, ay + 22]], shade(straw, (x & 7) * 0.01 - 0.06), 2);
    for (let x = -W / 2 + 6; x < W / 2; x += 12) top.line(x, ay - 32, x - 8 * (x / W), ay + 6, 1.5, shade(straw, -0.25));
    top.rect(-W / 2 + 2, ay - 40, W - 4, 6, WOOD, 3, 2.5);
    roofTop = ay - 40;
    eave = ay + 18;
  } else if (style === 'jungle') {
    const leaves: [number, number, number][] = [];
    for (let x = -W / 2 - 20; x <= W / 2 + 20; x += 26) leaves.push([x, ay + 4, 0.35]);
    for (let x = -W / 2 - 6; x <= W / 2 + 6; x += 30) leaves.push([x, ay - 14, -0.3]);
    for (let x = -W / 2 + 10; x <= W / 2 - 10; x += 34) leaves.push([x, ay - 30, 0.15]);
    leaves.forEach(([x, y, a], i) => {
      const col = [roof, shade(roof, 0.12), shade(roof, -0.1)][i % 3];
      top.poly(rot([[-26, 0], [-12, -12], [14, -12], [28, 0], [14, 12], [-12, 12]], a, x, y), col, 2.5);
      top.line(...(rot([[-22, 0], [24, 0]], a, x, y).flat() as [number, number, number, number]), 1.5, shade(col, -0.3));
    });
    // лианы с цветами
    for (const x of [-W / 2 + 20, W / 2 - 30]) {
      top.line(x, ay + 6, x + 4, ay + 34, 2.5, 0x3f7a3a);
      top.circle(x + 4, ay + 36, 4.5, 0xf28cb1, 2);
    }
    roofTop = ay - 42;
    eave = ay + 20;
  } else if (style === 'desert') {
    const n = 3, pw = (W + 30) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -W / 2 - 15 + pw * i;
      top.poly([[x0, ay + 6], [x0 + pw / 2, ay - 40], [x0 + pw, ay + 6]], i % 2 ? roof : shade(roof, -0.06));
      top.poly([[x0 + pw * 0.38, ay + 6], [x0 + pw / 2, ay - 40], [x0 + pw * 0.62, ay + 6]], TOMATO, 2);
    }
    for (let x = -W / 2 - 15; x < W / 2 + 15; x += 14) {
      top.g.fillStyle(roof, 1).slice(x + 7, ay + 6, 7, 0, Math.PI, false).fillPath();
      top.g.lineStyle(2.5, OUTLINE, 1).beginPath();
      top.g.arc(x + 7, ay + 6, 7, 0, Math.PI, false);
      top.g.strokePath();
    }
    for (const i of [0, n]) {
      const x = -W / 2 - 15 + pw * i;
      top.line(x, ay + 6, x + (i < n / 2 ? -10 : 10), 0, 1.5, 0x8a6a3a);
    }
    roofTop = ay - 30;
    eave = ay + 14;
  } else {
    // черепичная крыша и зелёно-белая маркиза над окном
    top.poly([[-W / 2 - 16, ay + 4], [W / 2 + 16, ay + 4], [W / 2 - 6, ay - 30], [-W / 2 + 6, ay - 30]], 0xb8553d);
    for (let row = 0; row < 3; row++) {
      const y = ay - 22 + row * 11;
      const half = W / 2 - 4 + row * 7;
      for (let x = -half; x < half; x += 12) {
        top.g.fillStyle(shade(0xc8653d, row * 0.04), 1).slice(x + 6, y, 6, 0, Math.PI, false).fillPath();
        top.g.lineStyle(1.5, shade(0xb8553d, -0.35), 1).beginPath();
        top.g.arc(x + 6, y, 6, 0, Math.PI, false);
        top.g.strokePath();
      }
    }
    const aw = W + 20, n = 10, sw = aw / n, aTop = ay + 2;
    const winX0 = 0;
    for (let i = 0; i < n; i++) {
      top.poly([[winX0 - aw / 2 + sw * i + 6, aTop], [winX0 - aw / 2 + sw * (i + 1) - 6, aTop], [winX0 - aw / 2 + sw * (i + 1), aTop + 12], [winX0 - aw / 2 + sw * i, aTop + 12]], i % 2 ? WHITE : roof, 2);
    }
    for (let i = 0; i < n; i++) {
      top.g.fillStyle(i % 2 ? WHITE : roof, 1).slice(winX0 - aw / 2 + sw * (i + 0.5), aTop + 12, sw / 2, 0, Math.PI, false).fillPath();
      top.g.lineStyle(2, OUTLINE, 1).beginPath();
      top.g.arc(winX0 - aw / 2 + sw * (i + 0.5), aTop + 12, sw / 2, 0, Math.PI, false);
      top.g.strokePath();
    }
    roofTop = ay - 30;
    eave = ay + 12 + sw / 2 - 2;
  }

  // гирлянда (украшение 2)
  if (look.tier >= 2) {
    const aw = W + 30;
    top.g.lineStyle(1.5, OUTLINE, 1).beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = -aw / 2 + (aw / 24) * i;
      const y = eave + 4 + Math.sin((i / 24) * Math.PI * 4) * 4;
      if (i === 0) top.g.moveTo(x, y);
      else top.g.lineTo(x, y);
    }
    top.g.strokePath();
    for (let i = 0; i <= 12; i++) {
      const x = -aw / 2 + (aw / 12) * i;
      const y = eave + 7 + Math.sin((i / 12) * Math.PI * 4) * 4;
      const bulb = scene.add.circle(x, y, 3.4, [AMBER, TOMATO, 0x7ff0d0, CREAM][i % 4]).setStrokeStyle(1.5, OUTLINE);
      addGlow(bulb);
      parts.bulbs.push(bulb);
    }
  }

  // ночная смена: фонарик слева и табличка 24/7 справа
  if (S.night_shift > 0) {
    const lx = -W / 2 + 4;
    top.line(lx, eave, lx, eave + 12, 2);
    top.rect(lx - 7, eave + 12, 14, 18, 0x3a3150, 3, 2.5);
    top.rect(lx - 4, eave + 15, 8, 12, 0xffd86b, 2, 0);
    const halo = scene.add.circle(lx, eave + 21, 26, 0xffc861, 0.3).setBlendMode(Phaser.BlendModes.ADD);
    addGlow(halo);
    parts.pulses.push(halo);
    const sx = W / 2 - 22;
    top.line(sx - 12, eave, sx - 12, eave + 8, 1.5);
    top.line(sx + 12, eave, sx + 12, eave + 8, 1.5);
    top.rect(sx - 20, eave + 8, 40, 16, 0x2a1b3d, 4, 2.5);
    addGlow(scene.add.text(sx, eave + 16, '24/7', { fontFamily: DISPLAY_FONT, fontSize: '10px', fontStyle: '900', color: '#7ff0d0' }).setOrigin(0.5).setShadow(0, 0, '#7ff0d0', 6, false, true));
  }

  // вывеска
  const signW = Math.min(W * 0.8, 200), signH = 34;
  const signY = roofTop - signH / 2 + 4;
  const sign = layer();
  if (look.tier >= 4) sign.rect(-signW / 2 - 5, signY - signH / 2 - 5, signW + 10, signH + 10, 0xffcf3f, 6, 2.5);
  sign.rect(-signW / 2, signY - signH / 2, signW, signH, PLUMISH(style), 5, 3);
  if (S.sign > 0) {
    // рамка из лампочек вокруг неоновой вывески
    for (let i = 0; i < 10; i++) {
      const bx = -signW / 2 + 8 + i * ((signW - 16) / 9);
      for (const by of [signY - signH / 2 + 4, signY + signH / 2 - 4]) {
        const b = scene.add.circle(bx, by, 1.8, 0xffe9a8);
        addGlow(b);
        parts.bulbs.push(b);
      }
    }
  }
  const label = scene.add
    .text(0, signY + 1, t('neon'), { fontFamily: DISPLAY_FONT, fontSize: '18px', fontStyle: '900', color: S.sign > 0 ? '#ffd86b' : '#d8c8a8' })
    .setOrigin(0.5);
  if (S.sign > 0) {
    label.setShadow(0, 0, '#ff9d2e', 10, false, true);
    addGlow(label);
    parts.neon = label;
  } else root.add(label);

  // флаг на крыше (украшение 3)
  if (look.tier >= 3) {
    const fx = -signW / 2 - 14;
    const flag = scene.add.graphics();
    const p = new Pen(flag, 2);
    p.line(0, 0, 0, -44, 2.5);
    if (style === 'piazza') {
      p.rect(0, -44, 10, 16, 0x2f9e5a, 0, 2);
      p.rect(10, -44, 10, 16, WHITE, 0, 2);
      p.rect(20, -44, 10, 16, TOMATO, 0, 2);
    } else p.poly([[0, -44], [30, -36], [0, -28]], TOMATO, 2);
    p.circle(0, -46, 2.5, AMBER, 1.5);
    flag.setPosition(fx, signY + signH / 2);
    root.add(flag);
    parts.flag = flag;
  }

  // секретный рецепт: светящийся сундук на крыше
  if (S.secret > 0) {
    const cx = signW / 2 + 16, cy = roofTop + 6;
    const halo = scene.add.circle(cx, cy - 10, 22, 0xffd86b, 0.4).setBlendMode(Phaser.BlendModes.ADD);
    addGlow(halo);
    parts.pulses.push(halo);
    const g = layer();
    g.rect(cx - 14, cy - 14, 28, 16, 0x8a5a33, 3);
    g.poly([[cx - 14, cy - 14], [cx - 12, cy - 22], [cx + 12, cy - 22], [cx + 14, cy - 14]], 0xa86a3a, 2.5);
    g.rect(cx - 3, cy - 16, 6, 7, 0xffcf3f, 1, 2);
    g.flat(0xffcf3f).fillRect(cx - 14, cy - 8, 28, 2);
    if (S.secret >= 3) g.poly(star(cx, cy - 30, 6, 2.6), 0xffe9a8, 1.5);
  }

  // прожекторы (украшение 5)
  if (look.tier >= 5) {
    for (const sx of [-1, 1]) {
      const beam = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      beam.fillStyle(0xfff0b0, 0.18).fillTriangle(0, 0, -26, -460, 26, -460);
      beam.setPosition(sx * (W / 2 + 4), 0);
      addGlow(beam);
      parts.beams.push(beam);
      const base = layer();
      base.rect(sx * (W / 2 + 4) - 8, -10, 16, 10, 0x3a3150, 2, 2);
    }
  }

  parts.top = Math.min(signY - signH / 2 - (look.tier >= 3 ? 30 : 6), roofTop - 30);
  parts.hit = { x: (parts.left + parts.right) / 2, y: parts.top / 2, w: parts.right - parts.left + 20, h: -parts.top + 20 };
  return parts;
}

function PLUMISH(style: string) {
  return style === 'piazza' ? 0x2f4a3a : style === 'jungle' ? 0x3a2a1a : 0x2a1b3d;
}
