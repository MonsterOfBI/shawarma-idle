// Страховка от «мёртвых» тапов на телефоне. Phaser держит 4 указателя для пальцев и отдаёт новое касание
// только свободному. Если браузер не прислал конец касания (палец ушёл за край, системный жест,
// реклама поверх игры), указатель навсегда считается прижатым; когда так застрянут все — тапы пропадают
// до перезагрузки. Перед каждым новым касанием освобождаем указатели пальцев, которых уже нет на экране.

import type Phaser from 'phaser';

export function guardLostTouches(input: Phaser.Input.InputPlugin) {
  const freeLost = (e: TouchEvent) => {
    const alive = new Set(Array.from(e.touches, (t) => t.identifier));
    const ptrs = input.manager.pointers;
    for (let i = 1; i < ptrs.length; i++) {
      const p = ptrs[i];
      if (p.active && !alive.has(p.identifier)) {
        p.active = false;
        p.isDown = false;
        p.buttons = 0;
      }
    }
  };
  window.addEventListener('touchstart', freeLost, { capture: true, passive: true });
  window.addEventListener('touchend', freeLost, { capture: false, passive: true });
}
