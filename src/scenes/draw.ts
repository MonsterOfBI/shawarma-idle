import Phaser from 'phaser';

// Мультяшная графика: каждая фигура заливается цветом и обводится тёмно-сливовой линией.
// Следующая фигура перекрывает обводку предыдущей, поэтому порядок рисования важен.

export const OUTLINE = 0x2a1b3d;
export const PLUM = 0x2a1b3d;
export const CREAM = 0xfff4dc;
export const AMBER = 0xffb02e;
export const TOMATO = 0xe4472b;
export const MEAT = 0xb5651d;
export const MEAT_DARK = 0x7f3f12;
export const LEAF = 0x5e9c3a;
export const WOOD = 0x9a6a3e;
export const WHITE = 0xffffff;

export const DISPLAY_FONT = 'Unbounded, "Golos Text", system-ui, sans-serif';

export function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

export function shade(c: number, k: number): number {
  return k < 0 ? lerpColor(c, 0x000000, -k) : lerpColor(c, 0xffffff, k);
}

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

// Карандаш поверх Graphics: заливка + обводка одной командой.
export class Pen {
  constructor(public g: Phaser.GameObjects.Graphics, public ol = 3) {}

  private stroke(width = this.ol) {
    this.g.lineStyle(width, OUTLINE, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: number, r = 0, ol = this.ol) {
    this.g.fillStyle(color, 1);
    if (r > 0) this.g.fillRoundedRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else this.g.fillRect(x, y, w, h);
    if (ol > 0) {
      this.stroke(ol);
      if (r > 0) this.g.strokeRoundedRect(x, y, w, h, Math.min(r, w / 2, h / 2));
      else this.g.strokeRect(x, y, w, h);
    }
    return this;
  }

  // прямоугольник по центру
  box(cx: number, cy: number, w: number, h: number, color: number, r = 0, ol = this.ol) {
    return this.rect(cx - w / 2, cy - h / 2, w, h, color, r, ol);
  }

  circle(x: number, y: number, r: number, color: number, ol = this.ol) {
    this.g.fillStyle(color, 1).fillCircle(x, y, r);
    if (ol > 0) {
      this.stroke(ol);
      this.g.strokeCircle(x, y, r);
    }
    return this;
  }

  ellipse(x: number, y: number, w: number, h: number, color: number, ol = this.ol) {
    this.g.fillStyle(color, 1).fillEllipse(x, y, w, h);
    if (ol > 0) {
      this.stroke(ol);
      this.g.strokeEllipse(x, y, w, h);
    }
    return this;
  }

  poly(points: Pt[], color: number, ol = this.ol) {
    const v = points.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    this.g.fillStyle(color, 1).fillPoints(v, true);
    if (ol > 0) {
      this.stroke(ol);
      this.g.strokePoints(v, true);
    }
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, width = this.ol, color = OUTLINE) {
    this.g.lineStyle(width, color, 1).lineBetween(x1, y1, x2, y2);
    return this;
  }

  // плоская заливка без обводки (блики, тени)
  flat(color: number, alpha = 1) {
    this.g.fillStyle(color, alpha);
    return this.g;
  }

  // глаз: белок, зрачок, блик
  eye(x: number, y: number, r: number, look = 0.35) {
    this.circle(x, y, r, WHITE, Math.max(1.5, this.ol * 0.7));
    this.g.fillStyle(OUTLINE, 1).fillCircle(x + r * look, y, r * 0.5);
    this.g.fillStyle(WHITE, 1).fillCircle(x + r * look + r * 0.18, y - r * 0.2, r * 0.18);
    return this;
  }

  // улыбка дугой
  smile(x: number, y: number, w: number, open = false) {
    if (open) {
      this.poly([[x - w / 2, y], [x + w / 2, y], [x, y + w * 0.45]], 0x7a1f2b, 2);
      this.g.fillStyle(WHITE, 1).fillRect(x - w / 2 + 3, y + 1, w - 6, 2.5);
    } else {
      this.g.lineStyle(2.4, OUTLINE, 1);
      this.g.beginPath();
      this.g.arc(x, y - w * 0.3, w * 0.55, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(150), false);
      this.g.strokePath();
    }
    return this;
  }
}

export function pen(scene: Phaser.Scene, ol = 3) {
  return new Pen(scene.add.graphics(), ol);
}
