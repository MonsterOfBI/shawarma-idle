// Крошечные текстуры для частиц, облаков и теней: рисуются один раз при запуске сцены.

import type Phaser from 'phaser';

export function makeSceneTextures(scene: Phaser.Scene) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(16, 16, 16);
    g.generateTexture('puff', 32, 32);
    g.clear();
    g.fillStyle(0x8a5a10, 1).fillCircle(10, 10, 10);
    g.fillStyle(0xffcf3f, 1).fillCircle(10, 9, 8);
    g.fillStyle(0xffe89a, 1).fillRect(8, 4, 4, 10);
    g.generateTexture('coin', 20, 20);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.clear();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 5);
    g.generateTexture('confetti', 8, 5);
    g.clear();
    // облако из трёх овалов, 200×80
    g.fillStyle(0xffffff, 1).fillEllipse(100, 56, 200, 64).fillEllipse(60, 40, 100, 72).fillEllipse(136, 44, 84, 60);
    g.generateTexture('cloud', 200, 80);
    g.clear();
    // мягкая тень под ногами
    g.fillStyle(0x2a1b3d, 0.16).fillEllipse(32, 10, 64, 20);
    g.fillStyle(0x2a1b3d, 0.16).fillEllipse(32, 10, 46, 13);
    g.generateTexture('shadow', 64, 20);
    g.destroy();
  }
