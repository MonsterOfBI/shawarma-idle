// Небо со сменой дня и ночи: градиент, солнце и луна. Сцена рисует его в текстуру раз в полсекунды.

import type Phaser from 'phaser';
import { lerpColor } from './draw';

// Сутки в игре длятся 8 минут. Ключевые точки неба: [фаза, верх, низ, ночь 0..1].
export const DAY_SECONDS = 480;
export const SKY: [number, number, number, number][] = [
  [0.0, 0x3fa9f5, 0xbfe9ff, 0],
  [0.3, 0x45a0ef, 0xffe0a0, 0],
  [0.42, 0x6a4fc0, 0xff9a4a, 0.2],
  [0.52, 0x3a2a80, 0xe0508a, 0.5],
  [0.6, 0x1c2a66, 0x4a3a9a, 0.75],
  [0.84, 0x1c2a66, 0x4a3a9a, 0.75],
  [0.93, 0x6a6ad0, 0xffb07a, 0.3],
  [1.0, 0x3fa9f5, 0xbfe9ff, 0],
];
// игра начинается солнечным днём, закат наступает через пару минут
export const DAY_START = 0.12;

// Цвета неба в фазе суток 0..1: верх, низ и насколько темно (0..1).
export function skyColors(phase: number): { top: number; bottom: number; night: number } {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= phase) i++;
  const a = SKY[i], b = SKY[i + 1];
  const k = (phase - a[0]) / Math.max(1e-6, b[0] - a[0]);
  return { top: lerpColor(a[1], b[1], k), bottom: lerpColor(a[2], b[2], k), night: a[3] + (b[3] - a[3]) * k };
}

export function skyNight(phase: number): number {
  return skyColors(phase).night;
}

// Градиент, солнце днём и луна ночью (идут дугой по небу). Возвращает, насколько темно.
export function paintSky(g: Phaser.GameObjects.Graphics, phase: number, width: number, height: number, hy: number, u: number): number {
  const { top, bottom, night } = skyColors(phase);
  const bands = 48;
  g.clear();
  for (let j = 0; j < bands; j++) {
    g.fillStyle(lerpColor(top, bottom, j / (bands - 1)), 1);
    g.fillRect(0, (hy * j) / bands, width, hy / bands + 1);
  }
  g.fillStyle(bottom, 1).fillRect(0, hy, width, height - hy);
  const sunT = (phase + 0.1) % 1;
  if (sunT < 0.55) {
    const p = sunT / 0.55;
    const sx = width * (0.1 + 0.8 * p);
    const sy = hy - Math.sin(p * Math.PI) * hy * 0.7;
    g.fillStyle(0xfff1b8, 0.25).fillCircle(sx, sy, 34 * u);
    g.fillStyle(0xffe07a, 1).fillCircle(sx, sy, 20 * u);
  } else {
    const p = (sunT - 0.55) / 0.45;
    const mx = width * (0.1 + 0.8 * p);
    const my = hy - Math.sin(p * Math.PI) * hy * 0.7;
    g.fillStyle(0xf3f0ff, 1).fillCircle(mx, my, 14 * u);
    g.fillStyle(top, 1).fillCircle(mx + 6 * u, my - 3 * u, 12 * u);
  }
  return night;
}
