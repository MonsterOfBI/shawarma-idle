// Неподвижные предметы улицы вокруг ларька: знак метро, фонарь или бочка с костром,
// а также видимые улучшения «Франшиза», «Мем-реклама» (билборд) и «Фудтрак».
// Всё, кроме живого огня, запекается в картинки.

import Phaser from 'phaser';
import { LOCATIONS } from '../core/locations';
import type { Look } from '../core/look';
import { t } from '../i18n';
import { bake } from './bake';
import { drawBrainrot } from './brainrots';
import { AMBER, CREAM, DISPLAY_FONT, OUTLINE, Pen, TOMATO, shade } from './draw';
import type { StallParts } from './stall';

export interface PropsInput {
  props: Phaser.GameObjects.Container;
  extras: Phaser.GameObjects.Container;
  lampGlow: Phaser.GameObjects.Ellipse;
  u: number;
  w: number;
  hy: number;
  gy: number;
  location: number;
  look: Look;
  stallX: number;
  stall?: StallParts;
  stallScale: number;
  safe: number; // правее этой x — боковые кнопки
  hudBottom: number;
  res: number; // подробность запекания
}

// Возвращает огонь (он анимируется) и ключи запечённых текстур, чтобы потом их удалить.
export function buildProps(scene: Phaser.Scene, o: PropsInput): { flame?: Phaser.GameObjects.Graphics; baked: string[] } {
  let flame: Phaser.GameObjects.Graphics | undefined;
  const baked: string[] = [];
  const { u, w, hy, gy, location } = o;
  const id = LOCATIONS[location].id;
  if (id === 'metro') {
    o.props.add(scene.add.text(w * 0.1, hy - 88 * u, 'M', { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(20 * u)}px`, color: '#e4472b', fontStyle: '900' }).setOrigin(0.5));
  }

  // фонарь слева от ларька
  const left = o.stallX + (o.stall?.left ?? -120) * o.stallScale;
  const lx = Math.max(22 * u, left - 34 * u);
  const g = scene.add.graphics();
  const p = new Pen(g, 2.5);
  if (id === 'dump') {
    // бочка с костром, у которой греются
    p.rect(lx - 14 * u, gy - 40 * u, 28 * u, 40 * u, 0x5a5a6a, 3 * u);
    p.line(lx - 14 * u, gy - 28 * u, lx + 14 * u, gy - 28 * u, 2, 0x3a3a4a);
    p.line(lx - 14 * u, gy - 12 * u, lx + 14 * u, gy - 12 * u, 2, 0x3a3a4a);
    p.flat(0x8a4a2a, 0.6).fillCircle(lx + 6 * u, gy - 20 * u, 4 * u);
    const fl = scene.add.graphics();
    fl.fillStyle(0xff6a2b, 1).fillTriangle(-12, 0, 12, 0, 0, -30);
    fl.fillStyle(0xff8a2b, 1).fillTriangle(-14, 0, -2, 0, -8, -20);
    fl.fillStyle(0xffd86b, 1).fillTriangle(-6, 0, 6, 0, 0, -16);
    fl.setPosition(lx, gy - 40 * u).setScale(u);
    o.props.add(fl);
    flame = fl;
    o.lampGlow.setPosition(lx, gy - 50 * u);
  } else if (id === 'metro' || id === 'piazza' || id === 'palace') {
    const pole = id === 'piazza' ? 0x2f3a2f : id === 'palace' ? 0xffcf3f : 0x3a3150;
    p.rect(lx - 3 * u, gy - 130 * u, 6 * u, 130 * u, pole, 2);
    p.rect(lx - 8 * u, gy - 8 * u, 16 * u, 8 * u, pole, 2);
    if (id === 'piazza' || id === 'palace') {
      p.poly([[lx - 10 * u, gy - 130 * u], [lx + 10 * u, gy - 130 * u], [lx + 7 * u, gy - 150 * u], [lx - 7 * u, gy - 150 * u]], 0xffe2a0);
      p.poly([[lx - 12 * u, gy - 150 * u], [lx + 12 * u, gy - 150 * u], [lx, gy - 160 * u]], pole);
      o.lampGlow.setPosition(lx, gy - 100 * u);
    } else {
      p.rect(lx - 3 * u, gy - 132 * u, 30 * u, 5 * u, pole, 2);
      p.rect(lx + 16 * u, gy - 128 * u, 16 * u, 7 * u, 0xffe2a0, 3);
      o.lampGlow.setPosition(lx + 24 * u, gy - 70 * u);
    }
  } else {
    // факел тики или фонарь на шесте
    p.rect(lx - 3 * u, gy - 96 * u, 6 * u, 96 * u, 0x8a5a33, 2);
    p.poly([[lx - 9 * u, gy - 96 * u], [lx + 9 * u, gy - 96 * u], [lx + 6 * u, gy - 110 * u], [lx - 6 * u, gy - 110 * u]], id === 'desert' ? 0x9a6a3e : 0xc9b26a);
    const fl = scene.add.graphics();
    fl.fillStyle(0xff8a2b, 1).fillTriangle(-7, 0, 7, 0, 0, -22);
    fl.fillStyle(0xffd86b, 1).fillTriangle(-4, 0, 4, 0, 0, -13);
    fl.setPosition(lx, gy - 110 * u).setScale(u);
    o.props.add(fl);
    flame = fl;
    o.lampGlow.setPosition(lx, gy - 112 * u);
  }
  o.props.addAt(g, 0);
  o.lampGlow.setSize(160 * u, 160 * u);

  const S = o.look.stages;
  if (S.franchise > 0) {
    // вторая точка вдалеке
    const fx = w * 0.32, s = 0.38 * u;
    const loc = LOCATIONS[location];
    const fg = scene.add.graphics();
    const fp = new Pen(fg, 2);
    fp.rect(fx - 60 * s, hy - 70 * s, 120 * s, 70 * s, shade(loc.body, -0.1), 2);
    fp.rect(fx - 36 * s, hy - 56 * s, 50 * s, 30 * s, 0x3b2a4f, 0, 2);
    fp.rect(fx - 70 * s, hy - 86 * s, 140 * s, 16 * s, loc.roof, 3);
    fp.rect(fx - 40 * s, hy - 110 * s, 80 * s, 22 * s, OUTLINE, 3, 2);
    fp.flat(0xffd86b).fillRect(fx - 28 * s, hy - 101 * s, 56 * s, 5 * s);
    if (S.franchise >= 3) {
      fp.rect(fx + 70 * s, hy - 60 * s, 90 * s, 60 * s, shade(loc.body, -0.2), 2);
      fp.rect(fx + 64 * s, hy - 74 * s, 102 * s, 14 * s, loc.roof, 3);
    }
    o.props.add(fg);
  }
  if (S.meme_ads > 0) {
    // билборд с брейнротом: справа от ларька, но не за боковыми кнопками;
    // если места мало, щит становится меньше
    const st = o.stall, ss = o.stallScale;
    const safe = o.safe;
    const right = st ? o.stallX + st.right * ss + 2 * u : w * 0.7;
    let k = 1, bx = Math.min(w * 0.88, safe - 50 * u), by = hy - 60 * u;
    if (st && bx - 48 * u < right) {
      // справа тесно: щит поменьше и повыше, над правым краем крыши, но ниже шапки с деньгами
      k = Phaser.Math.Clamp((safe - right) / (98 * u), 0.7, 1);
      bx = safe - 50 * u * k;
      by = Math.min(hy - 60 * u, gy + st.top * ss - 2 * u);
      by = Math.max(by, o.hudBottom + 66 * u * k);
    }
    const v = u * k;
    const bg = scene.add.graphics();
    const bp = new Pen(bg, 2.5);
    bp.rect(bx - 3 * v, by - 4 * u, 6 * v, Math.max(64 * u, hy - by), 0x5a5270, 2);
    bp.rect(bx - 48 * v, by - 62 * v, 96 * v, 64 * v, CREAM, 6 * v, 3);
    bp.rect(bx - 44 * v, by - 58 * v, 40 * v, 56 * v, 0xffd86b, 4 * v, 0);
    o.props.add(bg);
    const star = drawBrainrot(scene, 'tralalero');
    star.root.setPosition(bx - 24 * v, by - 4 * v).setScale((50 / star.height) * v);
    o.props.add(star.root);
    o.props.add(
      scene.add
        .text(bx + 22 * v, by - 30 * v, t('memeBoard'), { fontFamily: DISPLAY_FONT, fontSize: `${Math.round(8 * v)}px`, fontStyle: '900', color: '#e4472b', align: 'center' })
        .setOrigin(0.5),
    );
  }
  if (S.food_truck > 0) {
    // фудтрак у края
    const tx = Math.max(4 * u, lx - 130 * u), ty = gy - 2 * u, s = u;
    const tg = scene.add.graphics();
    const tp = new Pen(tg, 2.5);
    tp.rect(tx, ty - 62 * s, 96 * s, 52 * s, AMBER, 8 * s);
    tp.rect(tx + 92 * s, ty - 46 * s, 30 * s, 36 * s, shade(AMBER, -0.15), 6 * s);
    tp.rect(tx + 98 * s, ty - 42 * s, 18 * s, 14 * s, 0xbfe3f2, 3 * s, 2);
    tp.rect(tx + 12 * s, ty - 52 * s, 50 * s, 22 * s, 0x3b2a4f, 3 * s, 2);
    for (let i = 0; i < 5; i++) tp.rect(tx + 8 * s + i * 12 * s, ty - 68 * s, 12 * s, 8 * s, i % 2 ? TOMATO : CREAM, 0, 2);
    tp.circle(tx + 22 * s, ty - 8 * s, 10 * s, OUTLINE, 0);
    tp.circle(tx + 96 * s, ty - 8 * s, 10 * s, OUTLINE, 0);
    tp.circle(tx + 22 * s, ty - 8 * s, 4 * s, 0x9a9aa8, 0);
    tp.circle(tx + 96 * s, ty - 8 * s, 4 * s, 0x9a9aa8, 0);
    o.extras.add(tg);
  }
  // неподвижные предметы улицы тоже запекаем в картинки (огонь в бочке остаётся живым)
  const res = o.res;
  for (const obj of [...o.props.list, ...o.extras.list]) {
    if (obj instanceof Phaser.GameObjects.Graphics && obj !== flame) {
      const img = bake(obj, res);
      if (img instanceof Phaser.GameObjects.Image) baked.push(img.texture.key);
    }
  }
  return { flame, baked };
}
