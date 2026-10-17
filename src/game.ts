// Контроллер игры: держит состояние, крутит время, сохраняет, связывает сцену, интерфейс и площадку.

import Phaser from 'phaser';
import { setAudioPaused, setMuted, setMusic, sfx, unlockAudio } from './audio';
import { BRAINROT_BY_ID, meet } from './core/brainrots';
import {
  type GameState,
  COMBO_WINDOW_MS,
  RUSH_MULT,
  RUSH_SECONDS,
  addBoost,
  addMoney,
  buyN,
  canBuyN,
  catchGolden,
  comboMult,
  goldenReward,
  recordCombo,
  cashPackAmount,
  collectOffline,
  OFFLINE_CAP_SECONDS,
  incomePerSecond,
  normalize,
  offlineEarnings,
  relocate,
  tap,
  tapValue,
  tick,
} from './core/economy';
import { unlockAchievements } from './core/achievements';
import { formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { lang, t } from './i18n';
import type { Platform, ProductId } from './platform/platform';
import { StallScene } from './scenes/StallScene';
import { Ui } from './ui';

const SAVE_EVERY_MS = 10_000;
// если вкладка была скрыта дольше минуты, считаем это отсутствием и показываем окно офлайн-дохода
const AWAY_MS = 60_000;
// щедрый гость приходит раз в 1–2,5 минуты, час пик раз в 2,5–5 минут
const GOLDEN_MIN_MS = 60_000;
const GOLDEN_SPREAD_MS = 90_000;
const RUSH_MIN_MS = 150_000;
const RUSH_SPREAD_MS = 150_000;

export class Game {
  private state!: GameState;
  private scene: StallScene;
  private ui: Ui;
  private paused = false;
  private modalOpen = false;
  private lastSave = 0;
  private combo = 0;
  private lastTapAt = 0;
  private rushUntil = 0;
  private nextRushAt = Date.now() + 90_000;
  private nextGoldenAt = Date.now() + 35_000;
  private medalQueue: string[] = [];

  constructor(private platform: Platform) {
    this.scene = new StallScene({
      onTap: (x, y) => this.onTap(x, y),
      onGolden: (x, y) => this.onGolden(x, y),
      onServed: (id) => this.meet(id),
    });
    this.ui = new Ui({
      buy: (id, n) => this.buy(id, n),
      toggleMusic: () => this.toggleMusic(),
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
    this.scene.setLook(this.state.levels);
    this.meetStaff();
    this.scene.setMet(this.state.met);
    void this.scene.portraits(Object.keys(BRAINROT_BY_ID)).then((p) => this.ui.setPortraits(p));
    // звук и музыка просыпаются только после первого действия игрока
    const wake = () => {
      unlockAudio(!this.state.musicOff && !this.state.muted);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);

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
    this.events(now);
    this.scene.setIncome(incomePerSecond(this.state, now));
    this.scene.setLook(this.state.levels);
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
    const away = Math.min((now - this.state.lastSeen) / 1000, OFFLINE_CAP_SECONDS);
    const choice = await this.ui.offline(earned, away, incomePerSecond(this.state, now, false));
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

  // События улицы: час пик, щедрый гость, новые достижения.
  private events(now: number) {
    const rushLeft = (this.rushUntil - now) / 1000;
    if (rushLeft <= 0 && now >= this.nextRushAt && this.state.taps > 40) {
      this.rushUntil = now + RUSH_SECONDS * 1000;
      this.nextRushAt = this.rushUntil + RUSH_MIN_MS + Math.random() * RUSH_SPREAD_MS;
      this.scene.bigText(t('rushTitle'), '#ff8a5c');
      sfx.rush();
    }
    this.ui.setRush(Math.max(0, rushLeft));
    this.scene.setRush(rushLeft > 0);

    if (now >= this.nextGoldenAt) {
      this.nextGoldenAt = now + GOLDEN_MIN_MS + Math.random() * GOLDEN_SPREAD_MS;
      this.scene.spawnGolden();
      if (this.state.goldenCaught === 0) this.ui.toast(t('goldenFirst'));
    }

    const r = unlockAchievements(this.state);
    if (r.unlocked.length) {
      this.state = r.state;
      const idle = this.medalQueue.length === 0;
      this.medalQueue.push(...r.unlocked);
      if (idle) this.showMedals();
      void this.save();
    }
  }

  private showMedals() {
    const id = this.medalQueue[0];
    if (!id) return;
    this.ui.toast(t('achUnlocked', t(`ach_${id}`)), 'medal');
    sfx.achievement();
    setTimeout(() => {
      this.medalQueue.shift();
      this.showMedals();
    }, 2200);
  }

  private onTap(x: number, y: number) {
    if (this.paused || this.modalOpen) return;
    const now = Date.now();
    this.combo = now - this.lastTapAt < COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastTapAt = now;
    const rush = now < this.rushUntil;
    const extra = comboMult(this.combo) * (rush ? RUSH_MULT : 1);
    const value = tapValue(this.state, now) * extra;
    this.state = recordCombo(tap(this.state, now, extra), this.combo);
    this.scene.serve();
    this.scene.popText(`+${formatNumber(value, lang())} ₽`, x, y, rush ? '#ffb02e' : '#fff4dc');
    this.scene.burst(x, y, 2 + Math.min(6, Math.floor(this.combo / 8)) + (rush ? 3 : 0));
    this.scene.setCombo(this.combo, comboMult(this.combo));
    sfx.tap(this.combo);
  }

  private onGolden(x: number, y: number) {
    const now = Date.now();
    const reward = goldenReward(this.state, now);
    this.state = catchGolden(this.state, now);
    this.scene.popText(`+${formatNumber(reward, lang())} ₽`, x, y, '#ffd86b');
    this.ui.toast(t('goldenToast', formatNumber(reward, lang())));
    sfx.golden();
    void this.save();
  }

  private buy(id: string, n: number) {
    if (!canBuyN(this.state, id, n)) return;
    this.state = buyN(this.state, id, n);
    sfx.buy();
    const changed = this.scene.setLook(this.state.levels);
    this.scene.celebrate(changed);
    if (changed) navigator.vibrate?.(15);
    this.meetStaff();
    this.ui.render(this.state, Date.now());
  }

  // Знакомство с брейнротом: новый попадает в коллекцию.
  private meet(id: string) {
    const next = meet(this.state, id);
    if (next === this.state) return;
    this.state = next;
    this.scene.setMet(this.state.met);
    this.ui.toast(t('collMet', t(`br_${id}`)), 'medal');
    sfx.achievement();
    void this.save();
  }

  // Нанятые работники сразу становятся знакомыми.
  private meetStaff() {
    if ((this.state.levels.grill_helper ?? 0) > 0) this.meet('tungtung');
    if ((this.state.levels.cashier ?? 0) > 0) this.meet('ballerina');
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
    this.scene.setLocation(this.state.location, true);
    this.scene.setLook(this.state.levels);
    this.ui.showTab('upgrades');
    const loc = LOCATIONS[this.state.location];
    this.ui.moveCard(loc.id, loc.mult);
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
    setMusic(!this.state.muted && !this.state.musicOff);
    this.ui.render(this.state, Date.now());
  }

  private toggleMusic() {
    this.state = { ...this.state, musicOff: !this.state.musicOff };
    setMusic(!this.state.muted && !this.state.musicOff);
    this.ui.render(this.state, Date.now());
    void this.save();
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
