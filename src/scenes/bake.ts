import Phaser from 'phaser';

// «Запекание» рисунков в картинки.
// Phaser пересчитывает фигуры Graphics в треугольники на каждом кадре, а брейнроты и ларёк — это
// тысячи фигур. Из-за этого телефон и компьютер грелись. Готовый рисунок один раз рисуем в текстуру
// и дальше показываем как обычную картинку: на экране то же самое, а работы на кадр в десятки раз меньше.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Границы рисунка по его командам. null — если в рисунке есть повороты или сдвиги холста (тогда не запекаем).
export function graphicsBounds(g: Phaser.GameObjects.Graphics): Box | null {
  const b = g.commandBuffer as number[];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lw = 0;
  const add = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    switch (c) {
      case 0: // ARC x, y, r, start, end, anticlockwise, overshoot
        add(b[i] - b[i + 2], b[i + 1] - b[i + 2]);
        add(b[i] + b[i + 2], b[i + 1] + b[i + 2]);
        i += 7;
        break;
      case 1: case 2: case 8: case 9: case 14: case 15:
        break;
      case 3: // FILL_RECT
        add(b[i], b[i + 1]);
        add(b[i] + b[i + 2], b[i + 1] + b[i + 3]);
        i += 4;
        break;
      case 4: case 5: // LINE_TO, MOVE_TO
        add(b[i], b[i + 1]);
        i += 2;
        break;
      case 6: // LINE_STYLE width, color, alpha
        lw = Math.max(lw, b[i]);
        i += 3;
        break;
      case 7: // FILL_STYLE
        i += 2;
        break;
      case 10: case 11: // треугольник
        add(b[i], b[i + 1]);
        add(b[i + 2], b[i + 3]);
        add(b[i + 4], b[i + 5]);
        i += 6;
        break;
      case 21:
        i += 8;
        break;
      case 22:
        i += 6;
        break;
      default:
        return null;
    }
  }
  if (!Number.isFinite(x0)) return null;
  const pad = lw / 2 + 2;
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2) + 1, h: Math.ceil(y1 - y0 + pad * 2) + 1 };
}

let bakeId = 0;
const MAX_SIDE = 2048;

// Заменяет Graphics картинкой на том же месте (в том же контейнере и с тем же порядком).
// key — общий ключ текстуры для одинаковых рисунков (например, одного брейнрота), чтобы не рисовать заново.
// res — во сколько раз текстура подробнее исходного рисунка (чтобы при увеличении не было мыла).
export function bake(g: Phaser.GameObjects.Graphics, res: number, key?: string): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const scene = g.scene;
  const tex = scene.textures;
  let k = key ? `${key}@${res}` : '';
  if (!k || !tex.exists(k)) {
    const box = graphicsBounds(g);
    if (!box || box.w * res > MAX_SIDE || box.h * res > MAX_SIDE) return g;
    k = k || `bake-${bakeId++}`;
    const dt = tex.addDynamicTexture(k, Math.ceil(box.w * res), Math.ceil(box.h * res));
    if (!dt) return g;
    const { scaleX, scaleY, rotation, alpha, visible } = g;
    g.setScale(res).setRotation(0).setAlpha(1).setVisible(true);
    dt.draw(g, -box.x * res, -box.y * res);
    g.setScale(scaleX, scaleY).setRotation(rotation).setAlpha(alpha).setVisible(visible);
    (dt.customData as { box?: Box }).box = box;
  }
  const t = tex.get(k);
  const box = (t.customData as { box: Box }).box;
  const img = scene.make.image({ x: g.x, y: g.y, key: k }, false);
  img
    .setOrigin((-box.x * res) / img.width, (-box.y * res) / img.height)
    .setScale(g.scaleX / res, g.scaleY / res)
    .setRotation(g.rotation)
    .setAlpha(g.alpha)
    .setVisible(g.visible)
    .setBlendMode(g.blendMode)
    .setDepth(g.depth);
  const parent = g.parentContainer;
  if (parent) {
    parent.addAt(img, parent.getIndex(g));
    parent.remove(g, true);
  } else {
    scene.add.existing(img);
    g.destroy();
  }
  return img;
}

// Текстура больше не нужна (например, ларёк перестроили).
export function dropTexture(scene: Phaser.Scene, img: Phaser.GameObjects.GameObject) {
  if (img instanceof Phaser.GameObjects.Image) {
    const key = img.texture.key;
    if (key.startsWith('bake-') && scene.textures.exists(key)) scene.textures.remove(key);
  }
}
