// Картинки для HTML-интерфейса: открытка следующей точки на вкладке «Переезд»
// и портреты брейнротов для коллекции. Рисуем в текстуру вне экрана и отдаём data-URL.

import Phaser from 'phaser';
import { LOCATIONS } from '../core/locations';
import { lookOf } from '../core/look';
import { UPGRADES } from '../core/upgrades';
import { BACKDROPS } from './backdrops';
import { drawBrainrot } from './brainrots';
import { Pen, lerpColor } from './draw';
import { SKY } from './sky';
import { buildStall } from './stall';

// Открытка точки днём, ларёк со средними улучшениями.
export function placePreview(scene: Phaser.Scene, index: number): Promise<string> {
  const W = 360, H = 180, u = 0.62;
  const hy = H * 0.56, gy = H * 0.84;
  const sky = scene.make.graphics({}, false);
  for (let j = 0; j < 24; j++) sky.fillStyle(lerpColor(SKY[0][1], SKY[0][2], j / 23), 1).fillRect(0, (hy * j) / 24, W, hy / 24 + 1);
  sky.fillStyle(SKY[0][2], 1).fillRect(0, hy, W, H - hy);
  const pen = new Pen(scene.make.graphics({}, false), 1.5);
  const loc = LOCATIONS[index];
  BACKDROPS[loc.id](pen, { w: W, h: H, hy, gy, u, night: 0, clock: 0, seed: 17 + index * 101 });
  const levels = Object.fromEntries(UPGRADES.map((up) => [up.id, 25]));
  const st = buildStall(scene, index, lookOf(levels));
  st.root.setScale(Math.min(0.62, (gy - 12) / -st.top, (W * 0.6) / Math.max(1, st.right - st.left)));
  const rt = scene.add.renderTexture(-3000, -3000, W, H).setVisible(false);
  rt.draw(sky).draw(pen.g).draw(st.root, W / 2, gy);
  st.staff.forEach((c) => c.root.destroy());
  st.root.destroy();
  st.glow.destroy();
  sky.destroy();
  pen.g.destroy();
  return new Promise((resolve) =>
    rt.snapshot((img) => {
      resolve((img as HTMLImageElement).src);
      rt.destroy();
    }),
  );
}

// Портреты брейнротов для коллекции: рисуем каждого в текстуру и отдаём картинку.
export function portraits(scene: Phaser.Scene, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  return Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          const size = 120;
          const c = drawBrainrot(scene, id);
          const wide = id === 'bombardiro';
          const sc = Math.min(108 / c.height, 114 / c.width);
          c.root.setScale(sc);
          const rt = scene.add.renderTexture(-500, -500, size, size).setVisible(false);
          rt.draw(c.root, size / 2 + (wide ? 4 : -2), wide ? size / 2 + 6 : size - 8);
          c.root.destroy();
          rt.snapshot((img) => {
            out[id] = (img as HTMLImageElement).src;
            rt.destroy();
            resolve();
          });
        }),
    ),
  ).then(() => out);
}
