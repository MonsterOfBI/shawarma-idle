// Контроллер игры: держит состояние, крутит время, сохраняет, связывает сцену, интерфейс и площадку.

import Phaser from 'phaser';
import { setAudioPaused, setMuted, setMusic, sfx, unlockAudio } from './audio';
import { BRAINROT_BY_ID, meet } from './core/brainrots';
import { canClaimDaily, claimDaily, dayKey } from './core/daily';
import { type BoxKind, type Drop, PET_RARITY, RARITIES, petBonus } from './core/pets';
import { claimQuest, ensureQuests } from './core/quests';
import {
  type GameState,
  COMBO_WINDOW_MS,
  RUSH_MULT,
  RUSH_SECONDS,
  addBoost,
  addMoney,
  buyN,
  canBuyN,
  isMaxed,
  isVisible,
  CRIT_MULT,
  adBoxReady,
  applyGolden,
  boxCost,
  buyBox,
  canBuyBox,
  canRelocate,
  comboMult,
  freeBox,
  goldenReward,
  isCrit,
  milestonesReached,
  pickGoldenEffect,
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
import { UPGRADES, UPGRADE_BY_ID } from './core/upgrades';
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
  private revealing = false;

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
      buyBox: () => void this.openBox('common', 'buy'),
      adBox: () => void this.openBox('golden', 'ad'),
      claimDaily: () => void this.claimDaily(),
      openDaily: () => void this.openDaily(),
      claimQuest: (i) => void this.claimQuest(i),
    });
  }

  async start() {
    const now = Date.now();
    this.state = ensureQuests(normalize(await this.platform.load(), now), now, Math.random);
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
    this.scene.setPets(this.topPets());
    this.scene.setMascot(this.state.levels.barker ?? 0);
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
    // начало сюжета: только у совсем нового игрока
    if (this.state.lifetimeEarned === 0 && this.state.location === 0) setTimeout(() => this.ui.toast(t('storyStart'), 'medal'), 1200);
    // подарок дня встречает игрока сразу после чека за офлайн
    if (canClaimDaily(this.state, dayKey(new Date()))) void this.openDaily();
  }

  private loop() {
    if (this.paused || this.modalOpen) return;
    const now = Date.now();
    if (now - this.state.lastSeen > AWAY_MS) {
      void this.welcomeBack(now);
      return;
    }
    this.state = ensureQuests(tick(this.state, now), now, Math.random);
    this.events(now);
    this.scene.setIncome(incomePerSecond(this.state, now));
    this.scene.setLook(this.state.levels);
    this.scene.setHints(this.hints(now));
    this.scene.setMascot(this.state.levels.barker ?? 0);
    this.ui.render(this.state, now);
    if (now - this.lastSave > SAVE_EVERY_MS) void this.save();
  }

  // о чём маскот напоминает в первую очередь
  private hints(now: number): string[] {
    const s = this.state;
    const out: string[] = [];
    if (canRelocate(s)) out.push('barkMove');
    if (adBoxReady(s, now) || canBuyBox(s, now)) out.push('barkBox');
    if (canClaimDaily(s, dayKey(new Date()))) out.push('barkDaily');
    // новичку подсказываем про улучшения, опытному не надоедаем
    if (s.bought < 10 && UPGRADES.some((u) => isVisible(s, u) && !isMaxed(s, u) && canBuyN(s, u.id, 1))) out.push('barkUp');
    return out;
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
    const crit = isCrit(Math.random());
    const extra = comboMult(this.combo) * (rush ? RUSH_MULT : 1) * (crit ? CRIT_MULT : 1);
    const value = tapValue(this.state, now) * extra;
    this.state = recordCombo(tap(this.state, now, extra), this.combo);
    this.scene.serve();
    const text = `+${formatNumber(value, lang())} ₽`;
    if (crit) {
      this.scene.crit(`${t('crit')} ${text}`, x, y);
      sfx.crit();
    } else this.scene.popText(text, x, y, now < this.state.tapFrenzyUntil ? '#ff9ccb' : rush ? '#ffb02e' : '#fff4dc');
    this.scene.burst(x, y, 2 + Math.min(6, Math.floor(this.combo / 8)) + (rush ? 3 : 0) + (crit ? 8 : 0));
    this.scene.setCombo(this.combo, comboMult(this.combo));
    sfx.tap(this.combo);
  }

  private onGolden(x: number, y: number) {
    const now = Date.now();
    // первый Бомбардиро всегда с мешком денег, дальше бывает лихорадка или бешеные тапы
    const effect = this.state.goldenCaught === 0 ? 'bag' : pickGoldenEffect(Math.random());
    const reward = goldenReward(this.state, now);
    this.state = applyGolden(this.state, now, effect);
    if (effect === 'bag') {
      this.scene.popText(`+${formatNumber(reward, lang())} ₽`, x, y, '#ffd86b', 1.3);
      this.ui.toast(t('goldenToast', formatNumber(reward, lang())), 'money');
    } else if (effect === 'frenzy') {
      this.scene.bigText(t('frenzyBig'), '#ffd86b');
      this.ui.toast(t('frenzyToast'), 'medal');
    } else {
      this.scene.bigText(t('tapsBig'), '#ff9ccb');
      this.ui.toast(t('tapsToast'), 'medal');
    }
    sfx.golden();
    this.ui.render(this.state, now);
    void this.save();
  }

  private buy(id: string, n: number) {
    if (!canBuyN(this.state, id, n)) return;
    const before = milestonesReached(this.state.levels[id] ?? 0);
    this.state = buyN(this.state, id, n);
    sfx.buy();
    const def = UPGRADE_BY_ID[id];
    if (def && def.kind !== 'mult' && milestonesReached(this.state.levels[id] ?? 0) > before) {
      this.ui.milestoneHit(id);
      this.ui.toast(t('msToast', t(`up_${id}`)), 'medal');
      sfx.achievement();
    }
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

  // Лучшие четыре брейнрота по бонусу: они танцуют у ларька.
  private topPets() {
    return Object.entries(this.state.pets)
      .filter(([id]) => PET_RARITY[id])
      .sort((a, b) => petBonus(b[0], b[1]) - petBonus(a[0], a[1]))
      .map(([id, p]) => ({ id, mut: p.mut }));
  }

  // Ящик: за деньги, за рекламу (золотой) или бесплатно (подарок, задание).
  private async openBox(kind: BoxKind, how: 'buy' | 'ad' | 'free') {
    if (this.revealing) return;
    let now = Date.now();
    let r: { state: GameState; drop: Drop } | null = null;
    if (how === 'buy') r = buyBox(this.state, now, Math.random);
    else if (how === 'free') r = freeBox(this.state, now, kind, Math.random);
    else {
      if (!adBoxReady(this.state, now)) {
        this.ui.toast(t('boxWait', '…'));
        return;
      }
      this.setPaused(true);
      const ok = await this.platform.showRewarded();
      this.setPaused(false);
      if (!ok) {
        this.ui.toast(t('adFail'));
        return;
      }
      now = Date.now();
      r = freeBox(this.state, now, kind, Math.random, true);
    }
    if (!r) return;
    this.state = r.state;
    void this.save();
    this.revealing = true;
    sfx.shake();
    const again = how === 'buy' && canBuyBox(this.state, Date.now()) ? `${formatNumber(boxCost(this.state, Date.now()), lang())} ₽` : null;
    const drop = r.drop;
    const choice = await this.ui.reveal(drop, kind, again, () => {
      sfx.reveal(RARITIES.indexOf(drop.rarity));
      this.scene.setPets(this.topPets());
      this.ui.render(this.state, Date.now());
    });
    this.revealing = false;
    this.ui.render(this.state, Date.now());
    if (choice === 'again') await this.openBox(kind, 'buy');
  }

  private async openDaily() {
    const yes = await this.ui.daily(this.state, Date.now());
    if (yes) await this.claimDaily();
  }

  private async claimDaily() {
    const d = new Date();
    const y = new Date(d);
    y.setDate(d.getDate() - 1);
    const r = claimDaily(this.state, Date.now(), dayKey(d), dayKey(y));
    if (!r) return;
    this.state = r.state;
    sfx.claim();
    if (r.money) {
      this.ui.toast(t('dailyGot', formatNumber(r.money, lang())), 'money');
      this.scene.celebrate(true);
    }
    void this.save();
    this.ui.render(this.state, Date.now());
    for (const kind of r.boxes) await this.openBox(kind, 'free');
  }

  private async claimQuest(i: number) {
    const r = claimQuest(this.state, i, Date.now(), Math.random);
    if (!r) return;
    this.state = r.state;
    sfx.claim();
    if (r.money) this.ui.toast(t('questGot', formatNumber(r.money, lang())), 'money');
    void this.save();
    this.ui.render(this.state, Date.now());
    if (r.box) await this.openBox(r.box, 'free');
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
    if (this.state.location === LOCATIONS.length - 1) setTimeout(() => this.ui.toast(t('storyEnd'), 'medal'), 2500);
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
