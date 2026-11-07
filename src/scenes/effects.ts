// Частицы улицы: пар над грилем, монеты, искры, конфетти, пыль от перестройки ларька
// и золотой дождь во дворце. Создаются один раз, потом только «выстреливают».

import Phaser from 'phaser';
import { AMBER, CREAM, TOMATO } from './draw';

export function makeEmitters(scene: Phaser.Scene) {
  const steam = scene.add
    .particles(0, 0, 'puff', {
      lifespan: 1800,
      speedY: { min: -40, max: -22 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.2, end: 0.8 },
      alpha: { start: 0.22, end: 0 },
      emitting: false,
    })
    .setDepth(9.5);
  const coins = scene.add
    .particles(0, 0, 'coin', {
      lifespan: 900,
      speed: { min: 140, max: 320 },
      angle: { min: 220, max: 320 },
      gravityY: 700,
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.6 },
      emitting: false,
    })
    .setDepth(11);
  const sparks = scene.add
    .particles(0, 0, 'spark', {
      lifespan: 700,
      speed: { min: 60, max: 220 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    .setDepth(11);
  const confetti = scene.add
    .particles(0, 0, 'confetti', {
      lifespan: 1600,
      speed: { min: 120, max: 300 },
      angle: { min: 230, max: 310 },
      gravityY: 400,
      rotate: { min: 0, max: 360 },
      tint: [TOMATO, AMBER, 0x7ff0d0, 0x5e9c3a, 0xf28cb1, CREAM],
      scale: { start: 1, end: 0.7 },
      emitting: false,
    })
    .setDepth(11);

  // пыль от земли, когда ларёк перестраивается
  const dust = scene.add
    .particles(0, 0, 'puff', {
      lifespan: 850,
      speedX: { min: -150, max: 150 },
      speedY: { min: -60, max: -10 },
      scale: { start: 0.35, end: 1.1 },
      alpha: { start: 0.75, end: 0 },
      tint: 0xf1e2c2,
      emitting: false,
    })
    .setDepth(9.6);

  // во дворце с неба падают монеты
  const goldRain = scene.add
    .particles(0, 0, 'coin', {
      lifespan: 2600,
      speedY: { min: 60, max: 140 },
      speedX: { min: -20, max: 20 },
      gravityY: 60,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.5, max: 0.9 },
      alpha: { start: 1, end: 0.2 },
      emitting: false,
    })
    .setDepth(4.5);
  return { steam, coins, sparks, confetti, dust, goldRain };
}
