import Phaser from 'phaser';
import { AMBER, CREAM, LEAF, OUTLINE, Pen, TOMATO, WHITE, lerpColor, rng, shade } from './draw';

// Фоны семи локаций. Рисуются в один Graphics и перерисовываются 10 раз в секунду,
// поэтому волны, светлячки и гирлянды двигаются. night — от 0 (день) до 1 (ночь).

export interface Ctx {
  w: number;
  h: number;
  hy: number; // линия горизонта / основание дальнего плана
  gy: number; // уровень земли, где стоят ларёк и посетители
  u: number; // масштаб
  night: number;
  clock: number; // мс
  seed: number;
}

const nc = (day: number, night: number, n: number) => lerpColor(day, night, n);

function windowsGrid(p: Pen, x: number, top: number, bw: number, bh: number, c: Ctx, wall: number, r: () => number, shutters = false) {
  const u = c.u;
  const cols = Math.max(1, Math.floor(bw / (16 * u)));
  const rows = Math.max(1, Math.floor((bh - 10 * u) / (20 * u)));
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const wx = x + (bw / cols) * (i + 0.5);
      const wy = top + 10 * u + j * 20 * u;
      const lit = r() < 0.15 + c.night * 0.6 && c.night > 0.2;
      const col = lit ? lerpColor(0xffd27a, 0xffb347, r()) : shade(wall, 0.25);
      p.g.fillStyle(col, lit ? 0.95 : 0.85).fillRect(wx - 3.5 * u, wy, 7 * u, 9 * u);
      if (shutters) {
        const sh = nc(0x3f7a4f, 0x1f3a2a, c.night);
        p.g.fillStyle(sh, 1).fillRect(wx - 7.5 * u, wy - 1 * u, 3.2 * u, 11 * u);
        p.g.fillStyle(sh, 1).fillRect(wx + 4.3 * u, wy - 1 * u, 3.2 * u, 11 * u);
      }
    }
}

function palm(p: Pen, x: number, base: number, size: number, c: Ctx, lean = 1) {
  const u = c.u * size;
  const trunk = nc(0x9a6a3e, 0x3a2a24, c.night);
  const leaf = nc(0x4f9a3a, 0x1f3a2a, c.night);
  let px = x, py = base;
  for (let i = 0; i < 7; i++) {
    const nx = px + lean * 3 * u, ny = py - 14 * u;
    p.poly([[px - 6 * u, py], [px + 6 * u, py], [nx + 5 * u, ny], [nx - 5 * u, ny]], shade(trunk, i % 2 ? 0.08 : 0), 2);
    px = nx;
    py = ny;
  }
  const sway = Math.sin(c.clock / 900 + x) * 3 * u;
  for (const [dx, dy] of [[-34, 10], [34, 12], [-24, -8], [26, -10], [0, -16]]) {
    p.poly([[px, py], [px + dx * u * 0.55 + sway, py + dy * u * 0.4 - 10 * u], [px + dx * u + sway, py + dy * u], [px + dx * u * 0.4, py + 4 * u]], leaf, 2);
  }
  p.circle(px - 3 * u, py + 3 * u, 4 * u, nc(0x7a5a2a, 0x2a1f18, c.night), 2);
  p.circle(px + 4 * u, py + 4 * u, 4 * u, nc(0x7a5a2a, 0x2a1f18, c.night), 2);
}

function cactus(p: Pen, x: number, base: number, size: number, c: Ctx) {
  const u = c.u * size;
  const col = nc(0x5e9c3a, 0x23401f, c.night);
  p.rect(x - 22 * u, base - 46 * u, 10 * u, 22 * u, col, 5 * u, 2);
  p.rect(x - 22 * u, base - 30 * u, 18 * u, 8 * u, col, 4 * u, 2);
  p.rect(x + 12 * u, base - 56 * u, 10 * u, 26 * u, col, 5 * u, 2);
  p.rect(x + 4 * u, base - 36 * u, 18 * u, 8 * u, col, 4 * u, 2);
  p.rect(x - 8 * u, base - 74 * u, 16 * u, 74 * u, col, 8 * u, 2);
  p.g.lineStyle(1.5, shade(col, -0.25), 1).lineBetween(x - 2 * u, base - 66 * u, x - 2 * u, base - 6 * u);
  p.g.lineStyle(1.5, shade(col, -0.25), 1).lineBetween(x + 3 * u, base - 66 * u, x + 3 * u, base - 6 * u);
  if (size > 0.9) p.circle(x, base - 76 * u, 4 * u, 0xf28cb1, 2);
}

// ---------- метро: вечерний город ----------
function metro(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n } = c;
  const r = rng(c.seed);
  for (const far of [true, false]) {
    let x = -10;
    while (x < w + 10) {
      const bw = (far ? 44 + r() * 50 : 56 + r() * 60) * u;
      const bh = (far ? 70 : 40) * u + r() * (far ? 120 : 90) * u;
      const wall = far ? nc(lerpColor(0xa7a3cf, 0xc9b6d8, r()), 0x2a2148, n) : nc(lerpColor(0x7d6f9e, 0x9a7fa8, r()), 0x1f1838, n);
      p.rect(x, hy - bh, bw, bh, wall, 0, far ? 0 : 2);
      if (!far) p.g.fillStyle(shade(wall, -0.15), 1).fillRect(x + bw * 0.8, hy - bh, bw * 0.2, bh);
      windowsGrid(p, x, hy - bh, bw, bh, c, wall, r);
      x += bw + (far ? 3 : 10 + r() * 26) * u;
    }
  }
  // дорога и тротуар
  p.g.fillStyle(nc(0x6e6a80, 0x24203a, n), 1).fillRect(0, hy, w, gy - hy);
  p.g.fillStyle(nc(0xf4ecd8, 0x8a8298, n), 1);
  for (let x = 0; x < w; x += 52 * u) p.g.fillRect(x, hy + (gy - hy) * 0.45, 26 * u, 3 * u);
  p.rect(-5, gy - 6 * u, w + 10, 6 * u, nc(0xd8cfc0, 0x5a5270, n), 0, 2);
  const tile = nc(0xe9d9bf, 0x4a3f63, n);
  p.g.fillStyle(tile, 1).fillRect(0, gy, w, h - gy);
  p.g.lineStyle(1, shade(tile, -0.12), 1);
  for (let y = gy + 14 * u, row = 0; y < h; y += 14 * u, row++) {
    p.g.lineBetween(0, y, w, y);
    for (let x = (row % 2) * 18 * u; x < w; x += 36 * u) p.g.lineBetween(x, y - 14 * u, x, y);
  }
  // средний класс: клумба, скамейка и припаркованная машинка
  const bed = gy + 16 * u;
  p.rect(w * 0.02, bed, w * 0.22, 10 * u, nc(0x9a9aa8, 0x3a3448, n), 2, 2);
  for (let fx = w * 0.03; fx < w * 0.23; fx += 9 * u) {
    p.circle(fx, bed - 2 * u, 4 * u, nc(LEAF, 0x23401f, n), 1.5);
    p.circle(fx + 2 * u, bed - 6 * u, 3 * u, nc([TOMATO, 0xf28cb1, AMBER, WHITE][Math.round(fx / u) % 4], 0x4a3a58, n), 1.5);
  }
  const car = nc(0x3d6fb6, 0x1f2f4a, n), cx = w * 0.9, cy = hy + (gy - hy) * 0.78;
  p.rect(cx - 40 * u, cy - 26 * u, 80 * u, 20 * u, car, 7 * u, 2.5);
  p.rect(cx - 24 * u, cy - 42 * u, 46 * u, 18 * u, car, 7 * u, 2.5);
  p.rect(cx - 19 * u, cy - 38 * u, 18 * u, 11 * u, nc(0xbfe3f2, 0x3a4a6a, n), 2, 2);
  p.rect(cx + 2 * u, cy - 38 * u, 16 * u, 11 * u, nc(0xbfe3f2, 0x3a4a6a, n), 2, 2);
  p.circle(cx - 24 * u, cy - 5 * u, 8 * u, OUTLINE, 0);
  p.circle(cx + 24 * u, cy - 5 * u, 8 * u, OUTLINE, 0);
  p.circle(cx - 24 * u, cy - 5 * u, 3.5 * u, 0x9a9aa8, 0);
  p.circle(cx + 24 * u, cy - 5 * u, 3.5 * u, 0x9a9aa8, 0);
  p.rect(cx - 30 * u, cy - 50 * u, 24 * u, 6 * u, nc(0x9a6a3e, 0x3a2a24, n), 1, 2); // багажник на крыше
  // знак метро
  const mx = w * 0.1;
  p.rect(mx - 2.5 * u, hy - 80 * u, 5 * u, 80 * u, nc(0x5a5270, 0x2a2440, n), 0, 2);
  p.circle(mx, hy - 88 * u, 16 * u, WHITE, 2.5);
}

// ---------- пляж Тралалеро ----------
function beach(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n, clock } = c;
  const sea = hy - 34 * u;
  // остров вдалеке
  p.ellipse(w * 0.78, sea, 160 * u, 40 * u, nc(0x6aa36a, 0x1f3a2a, n), 0);
  p.g.fillStyle(nc(0x4f8a4f, 0x173022, n), 1).fillEllipse(w * 0.74, sea - 6 * u, 70 * u, 26 * u);
  // море
  const water = nc(0x2fa7c8, 0x1a2f5a, n);
  p.g.fillStyle(water, 1).fillRect(0, sea, w, gy - sea);
  for (let row = 0; row < 4; row++) {
    const y = sea + 8 * u + row * ((gy - sea - 14 * u) / 4);
    const off = ((clock / (40 + row * 14)) % (40 * u)) * (row % 2 ? 1 : -1);
    p.g.lineStyle(2, nc(0xbfeaf2, 0x4a6a9a, n), 0.8);
    for (let x = -40 * u + off; x < w + 40 * u; x += 40 * u) {
      p.g.beginPath();
      p.g.arc(x, y + 4 * u, 8 * u, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
      p.g.strokePath();
    }
  }
  // лунная/солнечная дорожка
  p.g.fillStyle(n > 0.5 ? 0xf3f0ff : 0xfff1b8, 0.25 + 0.2 * n).fillRect(w * 0.6, sea + 2 * u, 40 * u, gy - sea - 4 * u);
  // пена у берега
  const foam = Math.sin(clock / 700) * 4 * u;
  p.g.fillStyle(nc(0xffffff, 0x8a9ac8, n), 0.9).fillRect(0, gy - 6 * u + foam * 0.3, w, 6 * u);
  // песок
  const sand = nc(0xf2d49b, 0x6a5a4a, n);
  p.g.fillStyle(sand, 1).fillRect(0, gy, w, h - gy);
  const r = rng(c.seed);
  for (let i = 0; i < 60; i++) p.g.fillStyle(shade(sand, -0.12), 1).fillCircle(r() * w, gy + 6 * u + r() * (h - gy), 1.4 * u);
  for (let i = 0; i < 4; i++) {
    const sx = r() * w, sy = gy + 20 * u + r() * (h - gy - 30 * u);
    p.ellipse(sx, sy, 10 * u, 7 * u, nc(0xf7b2a0, 0x6a4a4a, n), 1.5);
  }
  // пальмы и зонт
  palm(p, w * 0.06, gy + 4 * u, 1.1, c, 1);
  palm(p, w * 0.96, gy + 4 * u, 0.9, c, -1);
  const ux = w * 0.2;
  p.line(ux, gy + 10 * u, ux + 6 * u, gy - 60 * u, 3 * u, nc(0xeeeeee, 0x666666, n));
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
    const cx = ux + 6 * u, cy = gy - 56 * u, R = 40 * u;
    p.poly([[cx, cy - 6 * u], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * 0.45 + 8 * u], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R * 0.45 + 8 * u]], i % 2 ? nc(TOMATO, 0x5a2a2a, n) : nc(WHITE, 0x7a7a8a, n), 2);
  }
}

// ---------- джунгли Патапима ----------
function jungle(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n, clock } = c;
  const r = rng(c.seed);
  const tones = [nc(0x3f7a3a, 0x10261a, n), nc(0x4f9a3a, 0x163020, n), nc(0x6ab04a, 0x1d3a24, n)];
  tones.forEach((col, layer) => {
    const base = hy - 10 * u + layer * 22 * u;
    for (let x = -30 * u; x < w + 40 * u; x += (34 + r() * 26) * u) {
      const R = (26 + r() * 30) * u * (1 - layer * 0.15);
      p.circle(x, base - R * 0.4, R, col, layer === 2 ? 2 : 0);
    }
    p.g.fillStyle(col, 1).fillRect(0, base, w, gy - base);
  });
  // стволы
  for (let i = 0; i < 4; i++) {
    const x = (w / 4) * i + r() * 40 * u;
    p.rect(x, hy - 120 * u, 16 * u, gy - hy + 120 * u, nc(0x6a4a2a, 0x22180f, n), 4 * u, 2);
  }
  // лианы сверху
  for (let i = 0; i < 6; i++) {
    // лианы только по краям, чтобы не мешать надписям сверху
    const x = i < 3 ? w * (0.02 + i * 0.07 + r() * 0.03) : w * (0.78 + (i - 3) * 0.07 + r() * 0.03);
    const len = (40 + r() * 90) * u + hy * 0.25;
    const sway = Math.sin(clock / 1200 + i) * 4 * u;
    p.g.lineStyle(3 * u, nc(0x3f7a3a, 0x10261a, n), 1).lineBetween(x, 0, x + sway, len);
    for (let k = 20 * u; k < len; k += 22 * u) p.ellipse(x + sway * (k / len) + 6 * u, k, 12 * u, 6 * u, nc(LEAF, 0x1d3a24, n), 1.5);
  }
  // деревянный настил
  const plank = nc(0xb07a4a, 0x3a2a24, n);
  p.g.fillStyle(plank, 1).fillRect(0, gy, w, h - gy);
  for (let y = gy, i = 0; y < h; y += 12 * u, i++) {
    p.g.lineStyle(2, shade(plank, -0.3), 1).lineBetween(0, y, w, y);
    for (let x = (i % 2) * 40 * u; x < w; x += 80 * u) {
      p.g.lineBetween(x, y, x, y + 12 * u);
      p.g.fillStyle(shade(plank, -0.4), 1).fillCircle(x + 5 * u, y + 6 * u, 1.3 * u);
    }
  }
  // светлячки ночью
  if (n > 0.3) {
    for (let i = 0; i < 18; i++) {
      const fx = (r() * w + Math.sin(clock / 1500 + i) * 30 * u) % w;
      const fy = hy - 40 * u + r() * (gy - hy + 30 * u) + Math.cos(clock / 1100 + i * 2) * 10 * u;
      const a = (0.5 + 0.5 * Math.sin(clock / 300 + i * 3)) * (n - 0.3);
      p.g.fillStyle(0xfff27a, a).fillCircle(fx, fy, 2.4 * u);
      p.g.fillStyle(0xfff27a, a * 0.25).fillCircle(fx, fy, 6 * u);
    }
  }
}

// ---------- пустыня Лирили ----------
function desert(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n } = c;
  // столовые горы
  const mesa = nc(0xc8704a, 0x3a2030, n);
  p.poly([[w * 0.05, hy], [w * 0.1, hy - 70 * u], [w * 0.3, hy - 70 * u], [w * 0.36, hy]], mesa, 0);
  p.poly([[w * 0.62, hy], [w * 0.68, hy - 50 * u], [w * 0.8, hy - 50 * u], [w * 0.86, hy]], shade(mesa, -0.1), 0);
  p.poly([[w * 0.42, hy], [w * 0.5, hy - 46 * u], [w * 0.58, hy]], nc(0xe0a060, 0x4a3030, n), 2);
  // дюны слоями
  const dunes = [nc(0xe8b06a, 0x4a3540, n), nc(0xf2c27a, 0x5a4048, n)];
  dunes.forEach((col, i) => {
    const base = hy + i * 18 * u;
    const pts: [number, number][] = [[0, gy]];
    for (let x = 0; x <= w + 20; x += 20 * u) pts.push([x, base - Math.sin(x / (90 * u) + i * 2) * 14 * u - 8 * u]);
    pts.push([w, gy]);
    p.poly(pts, col, i === 1 ? 2 : 0);
  });
  // оазис
  p.ellipse(w * 0.14, gy - 4 * u, 120 * u, 18 * u, nc(0x3fb6c8, 0x1a3a5a, n), 2);
  palm(p, w * 0.08, gy - 2 * u, 0.9, c, 1);
  cactus(p, w * 0.9, gy + 2 * u, 1, c);
  cactus(p, w * 0.3, hy + 26 * u, 0.5, c);
  // песок с рябью
  const sand = nc(0xf5cf8a, 0x6a5040, n);
  p.g.fillStyle(sand, 1).fillRect(0, gy, w, h - gy);
  p.g.lineStyle(2, shade(sand, -0.12), 1);
  for (let y = gy + 12 * u; y < h; y += 16 * u)
    for (let x = ((y / u) % 30) * u; x < w; x += 60 * u) {
      p.g.beginPath();
      p.g.arc(x, y + 6 * u, 14 * u, Phaser.Math.DegToRad(220), Phaser.Math.DegToRad(320), false);
      p.g.strokePath();
    }
}

// ---------- итальянская площадь ----------
function piazza(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n, clock } = c;
  const r = rng(c.seed);
  const walls = [0xe9b872, 0xd9825b, 0xf2c89a, 0xc8553d, 0xe8a0a0, 0xf0d8a8];
  // колокольня и купол на заднем плане
  const tower = nc(0xd9a06a, 0x3a2a38, n);
  p.rect(w * 0.7, hy - 200 * u, 34 * u, 200 * u, tower, 0, 2);
  p.rect(w * 0.7 + 8 * u, hy - 186 * u, 18 * u, 22 * u, nc(0x3a2a38, 0x140c1c, n), 9 * u, 2);
  p.poly([[w * 0.7 - 4 * u, hy - 200 * u], [w * 0.7 + 17 * u, hy - 232 * u], [w * 0.7 + 38 * u, hy - 200 * u]], nc(0xb8553d, 0x3a1f28, n), 2);
  p.circle(w * 0.36, hy - 120 * u, 40 * u, nc(0xc86a4a, 0x3a2030, n), 2);
  p.rect(w * 0.36 - 3 * u, hy - 172 * u, 6 * u, 14 * u, nc(0xc86a4a, 0x3a2030, n), 0, 2);
  // дома с ставнями
  let x = -10;
  while (x < w + 10) {
    const bw = (60 + r() * 50) * u;
    const bh = (90 + r() * 70) * u;
    const wall = nc(walls[Math.floor(r() * walls.length)], 0x2e2240, n);
    p.rect(x, hy - bh, bw, bh, wall, 0, 2);
    p.rect(x - 3 * u, hy - bh - 6 * u, bw + 6 * u, 8 * u, nc(0xb8553d, 0x3a1f28, n), 0, 2);
    windowsGrid(p, x, hy - bh + 8 * u, bw, bh - 30 * u, c, wall, r, true);
    x += bw + 2 * u;
  }
  // гирлянда через площадь
  const bulbs: [number, number][] = [];
  p.g.lineStyle(1.5, OUTLINE, 1);
  for (const [x0, x1, y0] of [[0, w * 0.5, hy - 80 * u], [w * 0.5, w, hy - 90 * u]] as const) {
    p.g.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const bx = x0 + (x1 - x0) * t;
      const by = y0 + Math.sin(t * Math.PI) * 36 * u;
      if (k === 0) p.g.moveTo(bx, by);
      else p.g.lineTo(bx, by);
      if (k % 2) bulbs.push([bx, by + 4 * u]);
    }
    p.g.strokePath();
  }
  bulbs.forEach(([bx, by], i) => {
    const on = 0.5 + 0.5 * Math.sin(clock / 400 + i);
    p.g.fillStyle(n > 0.2 ? 0xffd86b : 0xf2e8c8, 1).fillCircle(bx, by, 3 * u);
    if (n > 0.2) p.g.fillStyle(0xffd86b, 0.25 * n * on).fillCircle(bx, by, 9 * u);
  });
  // фонтан
  const fx = w * 0.1;
  p.ellipse(fx, gy - 4 * u, 90 * u, 22 * u, nc(0xd8d0c0, 0x5a5268, n), 2);
  p.ellipse(fx, gy - 8 * u, 70 * u, 12 * u, nc(0x5ab8d8, 0x2a4a7a, n), 0);
  p.rect(fx - 5 * u, gy - 50 * u, 10 * u, 44 * u, nc(0xd8d0c0, 0x5a5268, n), 3 * u, 2);
  const jet = Math.sin(clock / 200) * 2 * u;
  p.g.lineStyle(3 * u, nc(0xbfeaf2, 0x6a8ab8, n), 0.9);
  p.g.beginPath();
  p.g.arc(fx - 16 * u, gy - 50 * u, 16 * u + jet, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
  p.g.strokePath();
  p.g.beginPath();
  p.g.arc(fx + 16 * u, gy - 50 * u, 16 * u + jet, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
  p.g.strokePath();
  // брусчатка
  const stone = nc(0xc9b8a0, 0x4a4058, n);
  p.g.fillStyle(shade(stone, -0.2), 1).fillRect(0, gy, w, h - gy);
  for (let y = gy + 2 * u, row = 0; y < h; y += 11 * u, row++)
    for (let sx = (row % 2) * 9 * u; sx < w; sx += 18 * u) p.g.fillStyle(shade(stone, (((sx + y) / u) % 7) * 0.012), 1).fillRoundedRect(sx, y, 16 * u, 9 * u, 3 * u);
}


// ---------- коробка у помойки: дворы и гаражи ----------
function dump(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n, clock } = c;
  const r = rng(c.seed + 7);
  // серые панельки вдалеке
  let x = -20;
  while (x < w + 20) {
    const bw = (90 + r() * 60) * u;
    const bh = (120 + r() * 90) * u;
    const wall = nc(lerpColor(0xb8b4c4, 0xa8a4b8, r()), 0x2a2640, n);
    p.rect(x, hy - 40 * u - bh, bw, bh, wall, 0, 2);
    for (let yy = hy - 40 * u - bh + 12 * u; yy < hy - 50 * u; yy += 18 * u) p.g.fillStyle(shade(wall, -0.12), 1).fillRect(x, yy, bw, 1.5 * u);
    windowsGrid(p, x, hy - 40 * u - bh, bw, bh - 10 * u, c, wall, r);
    x += bw + (8 + r() * 30) * u;
  }
  // бетонный забор с граффити
  const fence = nc(0xa8a090, 0x3a3448, n);
  p.rect(-5, hy - 52 * u, w + 10, 52 * u, fence, 0, 2);
  for (let fx = 0; fx < w; fx += 48 * u) p.line(fx, hy - 52 * u, fx, hy, 1.5, shade(fence, -0.25));
  const tags = [TOMATO, 0x3d6fb6, 0x5e9c3a, 0xf28cb1, AMBER];
  for (let i = 0; i < 4; i++) {
    const tx = w * (0.12 + i * 0.24) + r() * 20 * u;
    const col = nc(tags[i % tags.length], shade(tags[i % tags.length], -0.6), n);
    p.g.lineStyle(4 * u, col, 0.9).beginPath();
    p.g.moveTo(tx, hy - 20 * u);
    for (let k = 1; k <= 6; k++) p.g.lineTo(tx + k * 9 * u, hy - 20 * u - Math.sin(k * 1.7 + i) * 12 * u);
    p.g.strokePath();
  }
  // гаражи-ракушки
  for (const gx of [w * 0.18, w * 0.42, w * 0.86]) {
    const col = nc(lerpColor(0x7a8a6a, 0x8a6a5a, (gx / w) % 1), 0x2a2a38, n);
    p.rect(gx - 34 * u, hy - 46 * u, 68 * u, 46 * u, col, 0, 2);
    p.poly([[gx - 38 * u, hy - 46 * u], [gx, hy - 58 * u], [gx + 38 * u, hy - 46 * u]], shade(col, -0.15), 2);
    for (let k = 0; k < 6; k++) p.line(gx - 26 * u, hy - 36 * u + k * 6 * u, gx + 26 * u, hy - 36 * u + k * 6 * u, 1.5, shade(col, -0.28));
    p.flat(0x8a4a2a, 0.5).fillCircle(gx + 18 * u, hy - 30 * u, 6 * u); // ржавчина
  }
  // асфальт с трещинами и лужами
  const asph = nc(0x8a8494, 0x2a263a, n);
  p.g.fillStyle(asph, 1).fillRect(0, hy, w, h - hy);
  p.g.fillStyle(shade(asph, -0.08), 1).fillRect(0, gy + 30 * u, w, h - gy);
  p.g.lineStyle(1.5, shade(asph, -0.3), 1);
  for (let i = 0; i < 7; i++) {
    const cx = r() * w, cy = hy + 10 * u + r() * (h - hy - 20 * u);
    p.g.beginPath().moveTo(cx, cy).lineTo(cx + 14 * u, cy + 5 * u).lineTo(cx + 22 * u, cy + 2 * u).lineTo(cx + 34 * u, cy + 8 * u);
    p.g.strokePath();
  }
  const sky = n > 0.5 ? 0x5a5a9a : 0xbfd8f2;
  for (const [px, py, pw] of [[0.3, 0.55, 70], [0.72, 0.3, 50], [0.92, 0.9, 60]]) {
    const yy = hy + (gy - hy) * py + (py > 0.8 ? 30 * u : 0);
    p.g.fillStyle(sky, 0.45).fillEllipse(w * px, yy, pw * u, 10 * u);
    p.g.fillStyle(0xffffff, 0.35 + 0.2 * Math.sin(clock / 600 + px * 9)).fillEllipse(w * px - 10 * u, yy - 1 * u, 14 * u, 2 * u);
  }
  // мусорные баки слева
  const bin = nc(0x3f7a4f, 0x1f3a2a, n);
  for (const [bx, k] of [[w * 0.05, 1], [w * 0.15, 0.9]] as const) {
    const bu = u * k;
    p.rect(bx - 26 * bu, gy - 50 * bu, 52 * bu, 46 * bu, bin, 3 * bu, 2.5);
    p.poly([[bx - 30 * bu, gy - 50 * bu], [bx + 30 * bu, gy - 50 * bu], [bx + 24 * bu, gy - 60 * bu], [bx - 22 * bu, gy - 64 * bu]], shade(bin, -0.15), 2.5);
    p.circle(bx - 18 * bu, gy - 3 * bu, 4 * bu, OUTLINE, 0);
    p.circle(bx + 18 * bu, gy - 3 * bu, 4 * bu, OUTLINE, 0);
    p.line(bx - 18 * bu, gy - 40 * bu, bx + 18 * bu, gy - 40 * bu, 2, shade(bin, -0.3));
  }
  // мешки с мусором и коробки
  const bag = nc(0x3a3448, 0x15121e, n);
  p.ellipse(w * 0.1, gy - 4 * u, 34 * u, 24 * u, bag, 2.5);
  p.ellipse(w * 0.22, gy - 2 * u, 28 * u, 20 * u, bag, 2.5);
  p.poly([[w * 0.22 - 4 * u, gy - 12 * u], [w * 0.22, gy - 20 * u], [w * 0.22 + 4 * u, gy - 12 * u]], bag, 2);
  p.rect(w * 0.26, gy - 22 * u, 24 * u, 20 * u, nc(0xc49a62, 0x4a3a2a, n), 0, 2);
  p.line(w * 0.26 + 12 * u, gy - 22 * u, w * 0.26 + 12 * u, gy - 2 * u, 1.5, nc(0x8a6a3a, 0x2a2018, n));
  // крыса выглядывает из-за мешка
  const rat = nc(0x8a8494, 0x3a3448, n);
  const peek = Math.max(0, Math.sin(clock / 1300)) * 6 * u;
  p.ellipse(w * 0.1 + 16 * u, gy - 12 * u - peek, 16 * u, 12 * u, rat, 2);
  p.circle(w * 0.1 + 10 * u, gy - 18 * u - peek, 4 * u, nc(0xf2a0b0, 0x5a3a48, n), 1.5);
  p.g.fillStyle(OUTLINE, 1).fillCircle(w * 0.1 + 19 * u, gy - 14 * u - peek, 1.6 * u);
  p.g.fillStyle(0xf2a0b0, 1).fillCircle(w * 0.1 + 24 * u, gy - 11 * u - peek, 1.5 * u);
  // мухи кружат над баками
  for (let k = 0; k < 7; k++) {
    const a = clock / (180 + k * 23) + k * 1.9;
    const fx = w * (0.06 + (k % 3) * 0.06) + Math.cos(a) * 16 * u;
    const fy = gy - 70 * u + Math.sin(a * 1.7) * 10 * u - (k % 2) * 14 * u;
    p.g.fillStyle(0x1a1424, 1).fillCircle(fx, fy, 1.6 * u);
    p.g.fillStyle(0xffffff, 0.5).fillEllipse(fx - 1.5 * u, fy - 1.8 * u, 2.6 * u, 1.6 * u);
  }
  // банка и рыбий скелет
  p.rect(w * 0.18, gy + 6 * u, 6 * u, 9 * u, nc(0xc8c8d8, 0x4a4a5a, n), 1, 1.5);
  p.g.lineStyle(1.5, nc(0xe8e0d0, 0x5a5468, n), 1).lineBetween(w * 0.05, gy + 14 * u, w * 0.05 + 18 * u, gy + 14 * u);
  for (let k = 0; k < 4; k++) p.g.lineBetween(w * 0.05 + (4 + k * 4) * u, gy + 10 * u, w * 0.05 + (4 + k * 4) * u, gy + 18 * u);
}

// ---------- дворец шаурмы ----------
function palace(p: Pen, c: Ctx) {
  const { w, h, hy, gy, u, night: n, clock } = c;
  const gold = nc(0xffcf3f, 0x9a7a2a, n);
  const marble = nc(0xfbf3e2, 0x4a4460, n);
  const pink = nc(0xf2c8c0, 0x4a3a58, n);
  // дальний дворец во всю ширину
  const wallTop = hy - 120 * u;
  p.rect(-5, wallTop, w + 10, hy - wallTop, pink, 0, 2);
  // арки в стене
  for (let ax = 20 * u; ax < w; ax += 46 * u) {
    p.rect(ax, wallTop + 40 * u, 24 * u, 60 * u, nc(0x8a5a8a, 0x1a1428, n), 12 * u, 2);
    if (n > 0.25) p.g.fillStyle(0xffd27a, 0.5 * n).fillRoundedRect(ax + 3 * u, wallTop + 44 * u, 18 * u, 54 * u, 9 * u);
  }
  p.rect(-5, wallTop - 10 * u, w + 10, 12 * u, gold, 0, 2);
  // купола-луковки
  const dome = (dx: number, size: number, col: number) => {
    const s2 = size * u;
    const by = wallTop - 10 * u;
    p.rect(dx - 22 * s2, by - 60 * s2, 44 * s2, 60 * s2, marble, 0, 2);
    for (let k = -1; k <= 1; k++) p.rect(dx + k * 13 * s2 - 4 * s2, by - 46 * s2, 8 * s2, 22 * s2, nc(0x8a5a8a, 0x1a1428, n), 4 * s2, 1.5);
    p.poly([[dx - 30 * s2, by - 60 * s2], [dx - 28 * s2, by - 86 * s2], [dx - 14 * s2, by - 108 * s2], [dx, by - 128 * s2], [dx + 14 * s2, by - 108 * s2], [dx + 28 * s2, by - 86 * s2], [dx + 30 * s2, by - 60 * s2]], col, 2.5);
    p.g.fillStyle(0xffffff, 0.35).fillEllipse(dx - 12 * s2, by - 92 * s2, 8 * s2, 22 * s2);
    p.line(dx, by - 128 * s2, dx, by - 146 * s2, 2.5, gold);
    p.circle(dx, by - 148 * s2, 4 * s2, gold, 2);
  };
  dome(w * 0.12, 0.8, nc(0x5ab8a8, 0x1f4a4a, n));
  dome(w * 0.88, 0.8, nc(0x5ab8a8, 0x1f4a4a, n));
  dome(w * 0.32, 1, gold);
  dome(w * 0.68, 1, gold);
  dome(w * 0.5, 1.35, nc(0xe4472b, 0x5a1f28, n));
  // фейерверк ночью
  if (n > 0.35) {
    const t = (clock % 3000) / 3000;
    for (const [fx, fy, col, off] of [[0.25, 0.25, 0xffd86b, 0], [0.75, 0.2, 0xf28cb1, 0.5]] as const) {
      const tt = (t + off) % 1;
      const rad = tt * 40 * u;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        p.g.fillStyle(col, (1 - tt) * n).fillCircle(w * fx + Math.cos(a) * rad, hy * fy + Math.sin(a) * rad + tt * tt * 20 * u, 2.5 * u);
      }
    }
  }
  // мраморный пол в шахматку
  p.g.fillStyle(marble, 1).fillRect(0, hy, w, h - hy);
  const sq = 26 * u;
  for (let yy = hy, row = 0; yy < h; yy += sq * 0.6, row++)
    for (let xx = (row % 2) * sq; xx < w; xx += sq * 2) p.g.fillStyle(nc(0xe8dcc4, 0x3a3450, n), 1).fillRect(xx, yy, sq, sq * 0.6);
  // красная дорожка к ларьку
  const carpet = nc(0xc8283a, 0x5a1424, n);
  p.poly([[w * 0.5, hy], [w * 0.7, hy], [w * 0.82, h], [w * 0.38, h]], carpet, 0);
  p.g.lineStyle(3 * u, gold, 1).lineBetween(w * 0.5, hy, w * 0.38, h);
  p.g.lineStyle(3 * u, gold, 1).lineBetween(w * 0.7, hy, w * 0.82, h);
  // колонны по краям
  for (const cx of [w * 0.04, w * 0.24]) {
    p.rect(cx - 14 * u, gy - 170 * u, 28 * u, 170 * u, marble, 0, 2.5);
    for (let k = -1; k <= 1; k++) p.line(cx + k * 7 * u, gy - 160 * u, cx + k * 7 * u, gy - 10 * u, 1.5, shade(marble, -0.15));
    p.rect(cx - 20 * u, gy - 180 * u, 40 * u, 12 * u, gold, 2, 2.5);
    p.rect(cx - 20 * u, gy - 12 * u, 40 * u, 12 * u, gold, 2, 2.5);
  }
  // золотые вазы с пальмами
  for (const vx of [w * 0.14, w * 0.96]) {
    palm(p, vx, gy - 26 * u, 0.6, c, vx < w / 2 ? 1 : -1);
    p.poly([[vx - 18 * u, gy - 30 * u], [vx + 18 * u, gy - 30 * u], [vx + 12 * u, gy], [vx - 12 * u, gy]], gold, 2.5);
    p.g.fillStyle(0xffffff, 0.4).fillRect(vx - 10 * u, gy - 26 * u, 4 * u, 20 * u);
  }
  // бархатные канаты вдоль дорожки
  for (const [x0, x1] of [[w * 0.47, w * 0.36], [w * 0.73, w * 0.84]] as const) {
    const posts = 3;
    for (let k = 0; k < posts; k++) {
      const t = (k + 0.5) / posts;
      const px = x0 + (x1 - x0) * t, py = hy + (h - hy) * t;
      if (k < posts - 1) {
        const t2 = (k + 1.5) / posts;
        const qx = x0 + (x1 - x0) * t2, qy = hy + (h - hy) * t2;
        p.g.lineStyle(4 * u, nc(0xb8283a, 0x4a1424, n), 1).beginPath().moveTo(px, py - 22 * u);
        p.g.lineTo((px + qx) / 2, (py + qy) / 2 - 12 * u).lineTo(qx, qy - 22 * u).strokePath();
      }
      p.rect(px - 2.5 * u, py - 26 * u, 5 * u, 26 * u, gold, 1, 2);
      p.circle(px, py - 28 * u, 4 * u, gold, 2);
    }
  }
  // горы золотых монет и слитков
  const pile = (x: number, base: number, s2: number) => {
    const su = u * s2;
    p.poly([[x - 46 * su, base], [x - 30 * su, base - 22 * su], [x - 8 * su, base - 38 * su], [x + 14 * su, base - 34 * su], [x + 34 * su, base - 18 * su], [x + 48 * su, base]], gold, 2.5);
    for (let k = 0; k < 9; k++) {
      const cx = x + (((k * 37) % 80) - 40) * su, cy = base - (((k * 23) % 28) + 6) * su;
      p.ellipse(cx, cy, 12 * su, 5 * su, nc(0xffe08a, 0x8a6a2a, n), 1.5);
    }
    p.ellipse(x + 30 * su, base - 10 * su, 6 * su, 14 * su, nc(0xffe08a, 0x8a6a2a, n), 1.8); // монета на ребре
    for (let k = 0; k < 3; k++) p.rect(x - 52 * su + k * 14 * su, base - 10 * su, 13 * su, 9 * su, nc(0xffd23f, 0x8a6a2a, n), 1, 2); // слитки
    p.rect(x - 45 * su, base - 19 * su, 13 * su, 9 * su, nc(0xffd23f, 0x8a6a2a, n), 1, 2);
    p.poly([[x + 2 * su, base - 44 * su], [x + 10 * su, base - 52 * su], [x + 18 * su, base - 44 * su], [x + 10 * su, base - 32 * su]], nc(0x8fe8ff, 0x3a6a8a, n), 2); // бриллиант
    p.g.fillStyle(WHITE, 0.8).fillTriangle(x + 6 * su, base - 45 * su, x + 10 * su, base - 49 * su, x + 9 * su, base - 42 * su);
  };
  pile(w * 0.12, gy + 6 * u, 1);
  pile(w * 0.93, gy + 12 * u, 0.9);
  // золотая статуя Тунг Тунга на постаменте
  const sx = w * 0.86, sb = hy - 4 * u;
  p.rect(sx - 22 * u, sb - 30 * u, 44 * u, 30 * u, marble, 2, 2.5);
  p.rect(sx - 26 * u, sb - 34 * u, 52 * u, 6 * u, gold, 1, 2);
  p.rect(sx - 14 * u, sb - 100 * u, 28 * u, 66 * u, gold, 9 * u, 2.5);
  p.circle(sx - 5 * u, sb - 80 * u, 6 * u, nc(0xfff0a0, 0x8a7a3a, n), 2);
  p.circle(sx + 7 * u, sb - 80 * u, 6 * u, nc(0xfff0a0, 0x8a7a3a, n), 2);
  p.line(sx + 14 * u, sb - 70 * u, sx + 30 * u, sb - 120 * u, 5 * u, gold);
  p.g.fillStyle(WHITE, 0.4).fillRect(sx - 9 * u, sb - 94 * u, 4 * u, 50 * u);
  // искры золота в воздухе
  for (let k = 0; k < 14; k++) {
    const sx = ((k * 97 + clock / 30) % (w + 40)) - 20;
    const sy = hy - 40 * u + Math.sin(clock / 900 + k) * 30 * u - (k % 5) * 20 * u;
    p.g.fillStyle(0xfff0a0, 0.5 + 0.5 * Math.sin(clock / 300 + k)).fillCircle(sx, sy, 1.6 * u);
  }
}

export const BACKDROPS: Record<string, (p: Pen, c: Ctx) => void> = { dump, metro, beach, jungle, desert, piazza, palace };

// ---------- движущиеся объекты на фоне ----------

export interface Mover {
  root: Phaser.GameObjects.Container;
  speed: number; // доля ширины экрана в секунду
  lights?: Phaser.GameObjects.Ellipse;
  bob?: number;
}

function container(scene: Phaser.Scene, draw: (p: Pen) => void) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  draw(new Pen(g, 2.5));
  c.add(g);
  return c;
}

const CAR_COLORS = [TOMATO, 0x3d6fb6, 0xf2f2f2, 0x5e9c3a, AMBER, 0x8a4fbf];

export function spawnMover(scene: Phaser.Scene, loc: string, c: Ctx): Mover {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const u = c.u;
  let root: Phaser.GameObjects.Container;
  let y = c.hy + (c.gy - c.hy) * (dir > 0 ? 0.75 : 0.35);
  let speed = 0.12 + Math.random() * 0.06;
  let lights: Phaser.GameObjects.Ellipse | undefined;
  let bob: number | undefined;
  if (loc === 'beach') {
    // парусник или плавник Тралалеро
    if (Math.random() < 0.5) {
      root = container(scene, (p) => {
        p.poly([[-30, -6], [30, -6], [22, 6], [-22, 6]], WHITE);
        p.line(0, -6, 0, -52, 2.5);
        p.poly([[2, -50], [2, -10], [26, -10]], CREAM);
        p.poly([[-2, -46], [-2, -10], [-20, -10]], TOMATO);
      });
      speed = 0.03;
    } else {
      root = container(scene, (p) => {
        p.poly([[-10, 0], [6, -22], [10, 0]], 0x6f8fb3);
      });
      speed = 0.06;
    }
    y = c.hy - 20 * u + Math.random() * 20 * u;
    bob = Math.random() * 6;
  } else if (loc === 'jungle') {
    // попугай
    root = container(scene, (p) => {
      p.ellipse(0, 0, 26, 14, TOMATO);
      p.poly([[-12, 0], [-28, 6], [-12, 4]], 0x3d6fb6, 2);
      p.poly([[-4, -2], [6, -18], [8, -2]], AMBER, 2);
      p.circle(12, -4, 7, TOMATO);
      p.poly([[17, -6], [24, -2], [17, 0]], AMBER, 2);
      p.eye(13, -6, 2.4);
    });
    y = c.hy - 60 * u - Math.random() * 60 * u;
    speed = 0.16;
    bob = Math.random() * 6;
  } else if (loc === 'desert') {
    // перекати-поле
    root = container(scene, (p) => {
      p.g.lineStyle(2, 0x9a6a3e, 1);
      for (let i = 0; i < 6; i++) p.g.strokeCircle(Math.cos(i) * 3, Math.sin(i) * 3, 10 + (i % 3) * 2);
    });
    y = c.gy + 4 * u;
    speed = 0.1;
    bob = Math.random() * 6;
  } else if (loc === 'dump') {
    // ворона или бродячий кот
    if (Math.random() < 0.55) {
      root = container(scene, (p) => {
        p.ellipse(0, 0, 30, 14, 0x2a2a3a);
        p.poly([[-12, -2], [-4, -20], [6, -2]], 0x3a3a4a, 2);
        p.circle(14, -4, 7, 0x2a2a3a);
        p.poly([[19, -6], [28, -3], [19, -1]], 0x9a9aa8, 2);
        p.poly([[-14, 0], [-26, -4], [-24, 4]], 0x2a2a3a, 2);
        p.eye(15, -6, 2.2);
      });
      y = c.hy - 70 * u - Math.random() * 60 * u;
      speed = 0.11;
      bob = Math.random() * 6;
    } else {
      root = container(scene, (p) => {
        p.ellipse(0, -14, 40, 18, 0x9a8a7a);
        p.line(-18, -14, -30, -32, 4, OUTLINE);
        p.line(-18, -14, -30, -32, 2, 0x9a8a7a);
        for (const lx of [-12, -4, 8, 14]) p.line(lx, -8, lx, 0, 3.5);
        p.circle(20, -22, 9, 0x9a8a7a);
        p.poly([[14, -28], [16, -38], [21, -30]], 0x9a8a7a, 2);
        p.poly([[22, -30], [27, -38], [28, -27]], 0x9a8a7a, 2);
        p.eye(23, -23, 2.6);
      });
      y = c.gy - 2 * u;
      speed = 0.07;
    }
  } else if (loc === 'palace') {
    // золотой лимузин
    root = container(scene, (p) => {
      p.rect(-80, -34, 160, 22, 0xffcf3f, 8);
      p.rect(-50, -50, 96, 18, 0xffcf3f, 8);
      for (const wx of [-44, -18, 8]) p.rect(wx, -47, 22, 12, 0x2a1b3d, 3, 2);
      p.line(-78, -22, 78, -22, 2, 0xb8902a);
      p.circle(-52, -12, 9, OUTLINE, 0);
      p.circle(52, -12, 9, OUTLINE, 0);
      p.circle(-52, -12, 4, 0xffe9a8, 0);
      p.circle(52, -12, 4, 0xffe9a8, 0);
      p.rect(74, -30, 6, 6, 0xfff0b0, 2, 1.5);
      p.poly([[-8, -50], [0, -60], [8, -50]], 0xe4472b, 2); // флажок с короной
    });
    lights = scene.add.ellipse(116, -26, 80, 22, 0xfff0b0, 0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(lights);
    speed = 0.12;
  } else if (loc === 'piazza') {
    // веспа
    const col = Phaser.Utils.Array.GetRandom([0x8fd3c8, 0xf2a0b0, CREAM]);
    root = container(scene, (p) => {
      p.circle(-16, -6, 7, OUTLINE, 0);
      p.circle(18, -6, 7, OUTLINE, 0);
      p.poly([[-26, -8], [-2, -8], [6, -28], [14, -28], [22, -8], [-26, -20]], col);
      p.line(12, -28, 16, -42, 2.5);
      p.line(10, -42, 22, -42, 2.5);
      p.rect(-18, -38, 12, 22, 0x3d6fb6, 4);
      p.circle(-12, -46, 7, 0xf1c27d);
      p.rect(-20, -54, 16, 6, TOMATO, 3, 2);
    });
    lights = scene.add.ellipse(42, -20, 50, 14, 0xfff0b0, 0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(lights);
    speed = 0.16;
  } else {
    // машина
    const col = Phaser.Utils.Array.GetRandom(CAR_COLORS);
    root = container(scene, (p) => {
      p.rect(-48, -36, 96, 24, col, 8);
      p.rect(-30, -54, 56, 22, col, 8);
      p.rect(-24, -50, 20, 14, 0xbfe3f2, 3, 2);
      p.rect(2, -50, 18, 14, 0xbfe3f2, 3, 2);
      p.circle(-28, -12, 9, OUTLINE, 0);
      p.circle(28, -12, 9, OUTLINE, 0);
      p.circle(-28, -12, 4, 0x9a9aa8, 0);
      p.circle(28, -12, 4, 0x9a9aa8, 0);
      p.rect(42, -30, 6, 6, 0xfff0b0, 2, 1.5);
    });
    lights = scene.add.ellipse(84, -26, 80, 22, 0xfff0b0, 0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(lights);
    speed = 0.18 + Math.random() * 0.08;
  }
  root.setPosition(dir > 0 ? -140 * u : c.w + 140 * u, y).setScale(u * (dir > 0 ? 1 : 0.85));
  if (dir < 0) root.scaleX *= -1;
  return { root, speed: dir * speed, lights, bob };
}

// Курьер на самокате ездит в любой локации, если нанят.
export function spawnCourier(scene: Phaser.Scene, c: Ctx): Mover {
  const root = container(scene, (p) => {
    p.circle(-14, -6, 6, OUTLINE, 0);
    p.circle(14, -6, 6, OUTLINE, 0);
    p.line(-16, -10, 16, -10, 4, 0x5a5270);
    p.line(12, -10, 16, -40, 3, 0x5a5270);
    p.line(10, -40, 22, -40, 3, 0x5a5270);
    p.rect(-14, -40, 14, 22, 0x5e9c3a, 4);
    p.circle(-6, -48, 7, 0xffb08a);
    p.rect(-24, -42, 16, 16, AMBER, 3);
  });
  const u = c.u;
  root.setPosition(-80 * u, c.gy - 4 * u).setScale(u);
  return { root, speed: 0.14 };
}
