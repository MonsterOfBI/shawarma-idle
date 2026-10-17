import Phaser from 'phaser';
import {
  type GameState,
  type UpgradeId,
  UPGRADES,
  buy,
  canBuy,
  incomePerSecond,
  newGame,
  tap,
  tapValue,
  tick,
  upgradeCost,
} from '../core/economy';
import { type Platform } from '../platform/platform';

// Палитра минимализма: тёплый фон, простые фигуры.
const C = {
  bg: 0xf4ede4,
  stall: 0xe2583e,
  awning: 0xf2b134,
  grill: 0x3b3a4a,
  text: '#2b2a35',
  muted: '#7a7685',
  ok: 0x2f9e6b,
  off: 0xc9c2b8,
};

const SAVE_EVERY_MS = 5000;

export class StallScene extends Phaser.Scene {
  private state!: GameState;
  private moneyText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
  private buttons: { id: UpgradeId; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private lastSave = 0;

  constructor(private platform: Platform, private initial: GameState | null) {
    super('stall');
  }

  create() {
    const now = Date.now();
    const loaded = this.initial ?? newGame(now);
    const { state, earned } = tick(loaded, now);
    this.state = state;

    const w = this.scale.width;
    this.cameras.main.setBackgroundColor(C.bg);

    this.moneyText = this.add.text(w / 2, 50, '', { fontFamily: 'Nunito, sans-serif', fontSize: '40px', color: C.text, fontStyle: 'bold' }).setOrigin(0.5);
    this.rateText = this.add.text(w / 2, 92, '', { fontFamily: 'Nunito, sans-serif', fontSize: '18px', color: C.muted }).setOrigin(0.5);

    // Ларёк из простых фигур: навес, корпус, гриль-вертел. Тап по ларьку = продажа.
    const cx = w / 2;
    this.add.rectangle(cx, 170, 260, 36, C.awning);
    const stall = this.add.rectangle(cx, 260, 240, 150, C.stall).setInteractive({ useHandCursor: true });
    this.add.rectangle(cx, 255, 36, 90, C.grill);
    this.add.text(cx, 355, 'Тапай по ларьку', { fontFamily: 'Nunito, sans-serif', fontSize: '16px', color: C.muted }).setOrigin(0.5);

    stall.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.state = tap(this.state);
      this.tweens.add({ targets: stall, scale: 0.96, duration: 60, yoyo: true });
      const pop = this.add.text(p.x, p.y - 20, `+${tapValue(this.state)} ₽`, { fontFamily: 'Nunito, sans-serif', fontSize: '22px', color: C.text, fontStyle: 'bold' }).setOrigin(0.5);
      this.tweens.add({ targets: pop, y: pop.y - 50, alpha: 0, duration: 600, onComplete: () => pop.destroy() });
    });

    (Object.keys(UPGRADES) as UpgradeId[]).forEach((id, i) => {
      const y = 420 + i * 80;
      const bg = this.add.rectangle(cx, y, w - 40, 66, C.off).setInteractive({ useHandCursor: true });
      const label = this.add.text(40, y, '', { fontFamily: 'Nunito, sans-serif', fontSize: '17px', color: C.text, lineSpacing: 4 }).setOrigin(0, 0.5);
      bg.on('pointerdown', () => {
        this.state = buy(this.state, id);
      });
      this.buttons.push({ id, bg, label });
    });

    if (earned >= 1) {
      const msg = this.add.text(cx, 130, `Пока вас не было: +${Math.floor(earned)} ₽`, { fontFamily: 'Nunito, sans-serif', fontSize: '16px', color: '#2f9e6b' }).setOrigin(0.5);
      this.time.delayedCall(4000, () => msg.destroy());
    }
  }

  update() {
    const now = Date.now();
    this.state = tick(this.state, now).state;

    this.moneyText.setText(`${Math.floor(this.state.money)} ₽`);
    this.rateText.setText(`${incomePerSecond(this.state)} ₽/сек · ${tapValue(this.state)} ₽ за тап`);
    for (const b of this.buttons) {
      const def = UPGRADES[b.id];
      const lvl = this.state.levels[b.id];
      b.label.setText(`${def.title} · ур. ${lvl}\n${def.description} — ${upgradeCost(b.id, lvl)} ₽`);
      b.bg.setFillStyle(canBuy(this.state, b.id) ? C.ok : C.off, canBuy(this.state, b.id) ? 0.35 : 1);
    }

    if (now - this.lastSave > SAVE_EVERY_MS) {
      this.lastSave = now;
      void this.platform.save(this.state);
    }
  }
}
