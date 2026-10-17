// Контроллер игры: держит состояние, крутит время, сохраняет, связывает сцену, интерфейс и площадку.

import Phaser from 'phaser';
import { setAudioPaused, setMuted, sfx } from './audio';
import {
  type GameState,
  addBoost,
  addMoney,
  buy,
  canBuy,
  cashPackAmount,
  collectOffline,
  incomePerSecond,
  normalize,
  offlineEarnings,
  relocate,
  tap,
  tapValue,
  tick,
} from './core/economy';
import { formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { lang, t } from './i18n';
import type { Platform, ProductId } from './platform/platform';
import { StallScene } from './scenes/StallScene';
import { Ui } from './ui';

const SAVE_EVERY_MS = 10_000;
// если вкладка была скрыта дольше минуты, считаем это отсутствием и показываем окно офлайн-дохода
const AWAY_MS = 60_000;

export class Game {
  private state!: GameState;
  private scene: StallScene;
  private ui: Ui;
  private paused = false;
  private modalOpen = false;
  private lastSave = 0;

  constructor(private platform: Platform) {
    this.scene = new StallScene({ onTap: (x, y) => this.onTap(x, y) });
    this.ui = new Ui({
      buy: (id) => this.buy(id),
      boost: () => void this.boost(),
      relocate: () => void this.relocate(),
      purchase: (id) => void this.purchase(id),
      toggleSound: () => this.toggleSound(),
    });
  }

  async start() {
    const now = Date.now();
    this.state = normalize(await this.platform.load(), now);
    setMuted(this.state.muted);

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'stage',
      backgroundColor: '#f4ede4',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: this.scene,
      audio: { noAudio: true },
    });
    await this.scene.ready;
    this.scene.setLocation(this.state.location);

    const restored = await this.platform.restorePurchases();
    this.applyOwned(restored.owned);
    for (let i = 0; i < restored.pendingCash; i++) this.state = addMoney(this.state, cashPackAmount(this.state, now));
    this.ui.setProducts(await this.platform.getProducts(), this.platform.purchasesAvailable);

    this.platform.onPause((p) => this.setPaused(p));
    window.addEventListener('beforeunload', () => void this.save());

    this.platform.ready();
    this.ui.render(this.state, now);
    document.getElementById('loading')?.remove();
    await this.welcomeBack(now);
    this.platform.gameplayStart();

    setInterval(() => this.loop(), 100);
  }

  private loop() {
    if (this.paused || this.modalOpen) return;
    const now = Date.now();
    if (now - this.state.lastSeen > AWAY_MS) {
      void this.welcomeBack(now);
      return;
    }
    this.state = tick(this.state, now);
    this.scene.setIncome(incomePerSecond(this.state, now));
    this.ui.render(this.state, now);
    if (now - this.lastSave > SAVE_EVERY_MS) void this.save();
  }

  private async welcomeBack(now: number) {
    const earned = offlineEarnings(this.state, now);
    // короткую отлучку (перезагрузка страницы) засчитываем молча, без окна
    if (earned < 1 || now - this.state.lastSeen < AWAY_MS) {
      this.state = collectOffline(this.state, now, 1);
      return;
    }
    this.modalOpen = true;
    this.platform.gameplayStop();
    const choice = await this.ui.offline(earned);
    let factor = 1;
    if (choice === 'double') {
      const ok = await this.platform.showRewarded();
      if (ok) {
        factor = 2;
        sfx.reward();
      } else this.ui.toast(t('adFail'));
    }
    this.state = collectOffline(this.state, now, factor);
    this.state = { ...this.state, lastSeen: Date.now() };
    this.modalOpen = false;
    this.platform.gameplayStart();
    void this.save();
  }

  private onTap(x: number, y: number) {
    if (this.paused || this.modalOpen) return;
    const now = Date.now();
    const value = tapValue(this.state, now);
    this.state = tap(this.state, now);
    this.scene.serve();
    this.scene.popText(`+${formatNumber(value, lang())} ₽`, x, y);
    sfx.tap();
  }

  private buy(id: string) {
    if (!canBuy(this.state, id)) return;
    this.state = buy(this.state, id);
    sfx.buy();
    this.ui.render(this.state, Date.now());
  }

  private async boost() {
    this.setPaused(true);
    const ok = await this.platform.showRewarded();
    this.setPaused(false);
    if (!ok) {
      this.ui.toast(t('adFail'));
      return;
    }
    this.state = addBoost(this.state, Date.now());
    sfx.reward();
    void this.save();
  }

  private async relocate() {
    const before = this.state.location;
    this.state = relocate(this.state, Date.now());
    if (this.state.location === before) return;
    sfx.move();
    this.scene.setLocation(this.state.location);
    this.ui.showTab('upgrades');
    this.ui.toast(t('movedTo', t(`loc_${LOCATIONS[this.state.location].id}`)));
    await this.save();
    // полноэкранная реклама только в этой логичной паузе и только без покупки «Без рекламы»
    if (!this.state.owned.noAds) {
      this.setPaused(true);
      await this.platform.showInterstitial();
      this.setPaused(false);
    }
  }

  private async purchase(id: ProductId) {
    this.setPaused(true);
    const ok = await this.platform.purchase(id);
    this.setPaused(false);
    if (!ok) return;
    const now = Date.now();
    if (id === 'cash_pack') this.state = addMoney(this.state, cashPackAmount(this.state, now));
    else this.applyOwned([id]);
    sfx.reward();
    void this.save();
  }

  private applyOwned(ids: ProductId[]) {
    const owned = { ...this.state.owned };
    if (ids.includes('no_ads')) owned.noAds = true;
    if (ids.includes('x2_forever')) owned.x2Forever = true;
    this.state = { ...this.state, owned };
  }

  private toggleSound() {
    this.state = { ...this.state, muted: !this.state.muted };
    setMuted(this.state.muted);
    this.ui.render(this.state, Date.now());
  }

  private setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    setAudioPaused(p);
    if (p) {
      this.platform.gameplayStop();
      void this.save();
      this.scene.scene.pause();
    } else {
      this.scene.scene.resume();
      this.platform.gameplayStart();
    }
  }

  private async save() {
    this.lastSave = Date.now();
    await this.platform.save(this.state);
  }
}
