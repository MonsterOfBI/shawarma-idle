// Контроллер игры: держит состояние, крутит время, сохраняет, связывает сцену, интерфейс и площадку.

import Phaser from 'phaser';
import { setAudioPaused, setInstrument, setMuted, setMusic, setVolumes, sfx, unlockAudio } from './audio';
import { BRAINROT_BY_ID, meet, payOf } from './core/brainrots';
import { canClaimDaily, claimDaily, dayKey } from './core/daily';
import { type BoxKind, type Drop, PET_RARITY, RARITIES, canMerge, mergePet, openBox, petBonus } from './core/pets';
import { claimQuest, ensureQuests, refreshEarnQuests } from './core/quests';
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
  adBoxDone,
  applyGolden,
  GOLDEN_MIN_MS,
  GOLDEN_SPREAD_MS,
  OFFLINE_RATE,
  boxCost,
  buyBox,
  canBuyBox,
  canRelocate,
  nextMove,
  comboMult,
  freeBox,
  goldenReward,
  isCrit,
  milestonesReached,
  pickGoldenEffect,
  recordCombo,
  MOVE_BOX,
  fastMove,
  moveKey,
  runTime,
  beatsRecord,
  cashPackAmount,
  collectOffline,
  OFFLINE_CAP_SECONDS,
  incomePerSecond,
  customerCheck,
  serveCustomer,
  serveIntervalMs,
  normalize,
  offlineEarnings,
  relocate,
  locationMult,
  tap,
  tapValue,
  tick,
  resetProgress,
  decodeWeekly,
  soldThisWeek,
  weekEndsAt,
  weeklyScore,
} from './core/economy';
import { unlockAchievements } from './core/achievements';
import { formatDuration, formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { UPGRADES, UPGRADE_BY_ID } from './core/upgrades';
import { lang, t } from './i18n';
import type { Platform, ProductId } from './platform/platform';
import { StallScene } from './scenes/StallScene';
import { Ui } from './ui';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAVE_EVERY_MS = 10_000;
// результат в лидерборды отправляем раз в минуту (Яндекс разрешает не чаще раза в секунду)
const SCORE_EVERY_MS = 60_000;
// если вкладка была скрыта дольше минуты, считаем это отсутствием и показываем окно офлайн-дохода
const AWAY_MS = 60_000;
const STUCK_PAUSE_MS = 2500;
const AD_PAUSE_MAX_MS = 120_000;
const BUY_PAUSE_MAX_MS = 300_000;
// Бомбардиро прилетает раз в 100–200 секунд (GOLDEN_MIN_MS в экономике), час пик раз в 2,5–5 минут
const RUSH_MIN_MS = 150_000;
const RUSH_SPREAD_MS = 150_000;

export class Game {
  private state!: GameState;
  private scene: StallScene;
  private ui: Ui;
  private paused = false;
  // Причины паузы: свёрнутая вкладка, событие площадки, наша реклама, окно покупки.
  // Игра стоит, пока есть хоть одна причина. Раньше был один флаг на всех, и события перекрывали друг друга.
  private pauses = new Map<string, number>();
  private modalOpen = false;
  private lastSave = 0;
  private combo = 0;
  private recordInStreak = false; // в этой серии рекорд уже побит
  private streakBest = 0; // рекорд на начало текущей серии
  private lastTapAt = 0;
  private rushUntil = 0;
  private nextRushAt = Date.now() + 90_000;
  private nextGoldenAt = Date.now() + 35_000;
  private medalQueue: string[] = [];
  private revealing = false;
  private lastScoreAt = 0;
  private sentScore: Record<'week' | 'total', number> = { week: -1, total: -1 };

  constructor(private platform: Platform) {
    this.scene = new StallScene({
      onTap: (x, y) => this.onTap(x, y),
      onGolden: (x, y) => this.onGolden(x, y),
      onServed: (id, x, y) => this.served(id, x, y),
      onCoin: () => this.ui.bumpMoney(),
    });
    this.ui = new Ui({
      buy: (id, n) => this.buy(id, n),
      openSettings: () => void this.openSettings(),
      boost: () => void this.boost(),
      relocate: () => void this.relocate(),
      purchase: (id) => void this.purchase(id),
      toggleSound: () => this.toggleSound(),
      buyBox: () => void this.openBox('common', 'buy'),
      adBox: () => void this.openBox('golden', 'ad'),
      claimDaily: () => void this.claimDaily(),
      openDaily: () => void this.openDaily(),
      claimQuest: (i) => void this.claimQuest(i),
      merge: (id) => void this.merge(id),
      openLeaderboard: () => void this.openLeaderboard(),
    });
  }

  // raw — сохранение, уже прочитанное в main.ts (оттуда же берётся выбранный игроком язык)
  async start(raw: unknown) {
    const now = Date.now();
    this.state = ensureQuests(normalize(raw, now), now, Math.random);
    setMuted(this.state.muted);
    setVolumes(this.state.musicVol, this.state.sfxVol);

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'stage',
      backgroundColor: '#f4ede4',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: this.scene,
      audio: { noAudio: true },
      // не больше 60 кадров даже на экранах 120 Гц: вдвое меньше работы видеокарте, телефон не греется
      fps: { target: 60, limit: 60 },
      render: { powerPreference: 'low-power', antialias: true },
    });
    await this.scene.ready;
    document.querySelector<HTMLElement>('.loading-bar i')?.style.setProperty('--p', '100%');
    this.scene.setLocation(this.state.location);
    setInstrument(LOCATIONS[this.state.location].id);
    this.scene.setLook(this.state.levels);
    this.meetStaff();
    this.scene.setMet(this.state.met);
    this.scene.setPets(this.topPets());
    this.scene.setMascot(this.state.levels.barker ?? 0);
    void this.scene.portraits(Object.keys(BRAINROT_BY_ID)).then((p) => this.ui.setPortraits(p));
    this.ui.setPreviewSource((i) => this.scene.placePreview(i));
    // звук и музыка просыпаются только после первого действия игрока
    // На телефонах звук разрешается только по отпусканию пальца (touchend/click), поэтому слушаем все
    // эти события и снимаем слушатели, только когда звук действительно запустился.
    const wakeEvents = ['pointerdown', 'touchend', 'click', 'keydown'];
    const wake = () => {
      if (!unlockAudio(!this.state.musicOff && !this.state.muted)) return;
      wakeEvents.forEach((e) => window.removeEventListener(e, wake, true));
    };
    wakeEvents.forEach((e) => window.addEventListener(e, wake, true));

    const restored = await this.platform.restorePurchases();
    this.applyOwned(restored.owned);
    for (let i = 0; i < restored.pendingCash; i++) this.state = addMoney(this.state, cashPackAmount(this.state, now));
    for (let i = 0; i < restored.pendingGods; i++) this.state = openBox(this.state, 'god', Math.random).state;
    this.ui.setProducts(await this.platform.getProducts(), this.platform.purchasesAvailable);

    this.platform.onPause((p, reason) => this.hold(reason, p));
    // Страховка от «мёртвых» тапов: если игрок тапает по видимой игре, а пауза висит дольше пары секунд
    // (площадка не прислала «продолжить», реклама не вернула ответ), значит она застряла — снимаем.
    window.addEventListener(
      'pointerdown',
      () => {
        if (document.hidden) return;
        const now = Date.now();
        let changed = false;
        for (const [reason, since] of this.pauses) {
          if (now - since > STUCK_PAUSE_MS) {
            this.pauses.delete(reason);
            changed = true;
          }
        }
        if (changed) this.applyPause();
        if (this.modalOpen && !this.ui.anyModalOpen()) {
          this.modalOpen = false;
          this.gameplayStart();
        }
      },
      { capture: true },
    );
    window.addEventListener('beforeunload', () => void this.save());
    // на телефонах beforeunload часто не приходит: страницу просто выгружают из фона
    window.addEventListener('pagehide', () => void this.save());

    this.platform.ready();
    this.ui.render(this.state, now);
    document.getElementById('loading')?.remove();
    await this.welcomeBack(now);
    this.gameplayStart();

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
    this.scene.setIncome(incomePerSecond(this.state, now), serveIntervalMs(this.state, now));
    this.scene.setLook(this.state.levels);
    this.scene.setHints(this.hints(now), canRelocate(this.state) ? Math.round(nextMove(this.state).mult / locationMult(this.state)) : 0);
    this.scene.setMascot(this.state.levels.barker ?? 0);
    this.ui.render(this.state, now);
    if (now - this.lastSave > SAVE_EVERY_MS) void this.save();
    if (now - this.lastScoreAt > SCORE_EVERY_MS) void this.pushScores();
  }

  // ---------- лидерборды ----------
  private async pushScores() {
    this.lastScoreAt = Date.now();
    if (!this.platform.leaderboards || !this.platform.isAuthorized()) return;
    const scores = { week: weeklyScore(this.state, Date.now()), total: Math.floor(this.state.sold) };
    for (const board of ['week', 'total'] as const) {
      if (scores[board] === this.sentScore[board]) continue;
      this.sentScore[board] = scores[board];
      await this.platform.setScore(board, scores[board]);
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  private async openLeaderboard() {
    void this.save();
    const pushed = this.pushScores();
    await this.ui.leaderboard({
      available: this.platform.leaderboards,
      authorized: () => this.platform.isAuthorized(),
      login: async () => {
        const ok = await this.platform.login();
        if (ok) await this.pushScores();
        return ok;
      },
      load: async (board) => {
        await pushed;
        return this.platform.getBoard(board);
      },
      mine: (board) => (board === 'week' ? soldThisWeek(this.state, Date.now()) : this.state.sold),
      decode: (board, score) => (board === 'week' ? decodeWeekly(score, Date.now()) : score),
      resetIn: () => (weekEndsAt(Date.now()) - Date.now()) / 1000,
    });
  }

  // ---------- слияние брейнротов ----------
  private async merge(id: string) {
    if (this.revealing || !canMerge(this.state.pets[id])) return;
    this.state = mergePet(this.state, id);
    void this.save();
    this.revealing = true;
    sfx.shake();
    const p = this.state.pets[id];
    await this.ui.mergeShow(id, p.stars, petBonus(id, p), () => {
      sfx.reveal(Math.min(5, 2 + p.stars));
      this.scene.setPets(this.topPets());
      this.ui.render(this.state, Date.now());
    });
    this.revealing = false;
    this.ui.render(this.state, Date.now());
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
    this.gameplayStop();
    try {
      const away = Math.min((now - this.state.lastSeen) / 1000, OFFLINE_CAP_SECONDS);
      const choice = await this.ui.offline(earned, away, incomePerSecond(this.state, now, false) * OFFLINE_RATE);
      let factor = 1;
      if (choice === 'double') {
        const ok = await this.during('ad', this.platform.showRewarded(), AD_PAUSE_MAX_MS);
        if (ok) {
          factor = 2;
          sfx.reward();
        } else this.ui.toast(t('adFail'));
      }
      this.state = collectOffline(this.state, now, factor);
      this.state = { ...this.state, lastSeen: Date.now() };
    } finally {
      this.modalOpen = false;
      this.gameplayStart();
    }
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
    if (this.combo === 1) {
      this.recordInStreak = false;
      this.streakBest = this.state.bestCombo;
    }
    const record = beatsRecord(this.streakBest, this.combo);
    this.lastTapAt = now;
    const rush = now < this.rushUntil;
    const crit = isCrit(Math.random());
    const extra = comboMult(this.combo) * (rush ? RUSH_MULT : 1) * (crit ? CRIT_MULT : 1);
    const value = tapValue(this.state, now) * extra;
    this.state = recordCombo(tap(this.state, now, extra), this.combo);
    this.scene.hurry();
    const text = `+${formatNumber(value, lang())} ₽`;
    if (crit) {
      this.scene.crit(`${t('crit')} ${text}`, x, y);
      sfx.crit();
    } else this.scene.popText(text, x, y, now < this.state.tapFrenzyUntil ? '#ff9ccb' : rush ? '#ffb02e' : '#fff4dc');
    // пара монет брызгает от пальца, одна-три летят в кошелёк
    this.scene.burst(x, y, 1 + Math.min(4, Math.floor(this.combo / 10)) + (rush ? 2 : 0) + (crit ? 6 : 0));
    this.scene.flyCoins(x, y, crit ? 3 : 1);
    this.scene.setCombo(this.combo, comboMult(this.combo));
    if (record) {
      this.scene.setRecord(this.combo, !this.recordInStreak);
      if (!this.recordInStreak) sfx.reward();
      this.recordInStreak = true;
    }
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
  // Гость получил шаурму и платит свой чек: у каждого брейнрота свой множитель.
  private served(id: string, x: number, y: number) {
    this.meet(id);
    if (id === 'bombardiro' || this.paused) return;
    const now = Date.now();
    const check = customerCheck(this.state, now, id);
    this.state = serveCustomer(this.state, now, id);
    const pay = payOf(id);
    const color = pay >= 2 ? '#ff9ccb' : pay >= 1.5 ? '#ffd86b' : pay >= 1 ? '#b8f08a' : '#fff4dc';
    this.scene.popText(`+${formatNumber(check, lang())} ₽`, x, y, color, pay >= 1.5 ? 1.25 : 1);
    this.scene.flyCoins(x, y, pay >= 1.5 ? 3 : 1);
  }

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
      .map(([id, p]) => ({ id, mut: p.mut, stars: p.stars }));
  }

  // Ящик: за деньги, за рекламу (золотой) или бесплатно (подарок, задание).
  private async openBox(kind: BoxKind, how: 'buy' | 'ad' | 'free', title = '') {
    if (this.revealing) {
      // подарочный ящик (переезд, подарок дня, задание, покупка) ждёт своей очереди, а не пропадает:
      // раньше ящик за переезд терялся, если игрок за 3 секунды ожидания успевал открыть другой
      if (how !== 'free') return;
      while (this.revealing) await wait(150);
    }
    let now = Date.now();
    let r: { state: GameState; drop: Drop } | null = null;
    if (how === 'buy') r = buyBox(this.state, now, Math.random);
    else if (how === 'free') r = freeBox(this.state, now, kind, Math.random);
    else {
      // пока идёт откат, кнопка просто показывает таймер, без всплывающей надписи посреди экрана
      if (!adBoxReady(this.state, now)) {
        // дневной лимит исчерпан: говорим один раз по нажатию, таймер тут не поможет
        if (adBoxDone(this.state, now)) this.ui.toast(t('adBoxTomorrow'));
        return;
      }
      const ok = await this.during('ad', this.platform.showRewarded(), AD_PAUSE_MAX_MS);
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
    const choice = await this.ui.reveal(
      drop,
      kind,
      again,
      () => {
        sfx.reveal(RARITIES.indexOf(drop.rarity));
        this.scene.setPets(this.topPets());
        this.ui.render(this.state, Date.now());
      },
      title,
    );
    this.revealing = false;
    this.ui.render(this.state, Date.now());
    if (choice === 'again') await this.openBox(kind, 'buy');
  }

  private async openDaily() {
    const yes = await this.ui.daily(this.state, Date.now());
    if (yes) await this.claimDaily();
  }

  private async claimDaily() {
    const r = claimDaily(this.state, Date.now(), dayKey(new Date()));
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
    const ok = await this.during('ad', this.platform.showRewarded(), AD_PAUSE_MAX_MS);
    if (!ok) {
      this.ui.toast(t('adFail'));
      return;
    }
    this.state = addBoost(this.state, Date.now());
    sfx.reward();
    void this.save();
  }

  private async relocate() {
    const before = this.state;
    const fast = fastMove(before, Date.now());
    const beat = before.moveBest[moveKey(before)];
    this.state = relocate(this.state, Date.now());
    if (this.state === before) return;
    this.state = refreshEarnQuests(this.state, Date.now());
    sfx.move();
    this.scene.setLocation(this.state.location, true);
    setInstrument(LOCATIONS[this.state.location].id);
    this.scene.setLook(this.state.levels);
    this.ui.showTab('upgrades');
    const loc = LOCATIONS[this.state.location];
    this.ui.moveCard(loc.id, locationMult(this.state), this.state.stars);
    if (this.state.location === LOCATIONS.length - 1 && this.state.stars === 0) setTimeout(() => this.ui.toast(t('storyEnd'), 'medal'), 2500);
    await this.save();
    // полноэкранная реклама только в этой логичной паузе и только без покупки «Без рекламы»
    if (!this.state.owned.noAds) {
      await this.during('ad', this.platform.showInterstitial(), AD_PAUSE_MAX_MS);
    }
    // подарки за переезд: мифический ящик всегда, золотой — за рекорд скорости
    // ящик ждёт, пока раскроется новая улица и уедет открытка точки
    await wait(3000);
    await this.openBox(MOVE_BOX, 'free', t('moveBoxTitle'));
    if (fast) {
      const time = runTime(before, Date.now());
      this.ui.toast(t('speedRecord', `${formatDuration(time / 1000, lang())} (${formatDuration(beat / 1000, lang())})`), 'medal');
      await this.openBox('golden', 'free', t('speedBoxTitle'));
    }
  }

  private async purchase(id: ProductId) {
    const ok = await this.during('buy', this.platform.purchase(id), BUY_PAUSE_MAX_MS);
    if (!ok) return;
    const now = Date.now();
    if (id === 'god_pet') {
      await this.openBox('god', 'free');
      return;
    }
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

  private async openSettings() {
    await this.ui.settings(this.state, {
      music: (v) => {
        // ползунок в ноль выключает музыку совсем
        this.state = { ...this.state, musicVol: v > 0 ? v : this.state.musicVol, musicOff: v === 0 };
        setVolumes(this.state.musicVol, this.state.sfxVol);
        setMusic(!this.state.muted && !this.state.musicOff);
      },
      sfx: (v) => {
        this.state = { ...this.state, sfxVol: v };
        setVolumes(this.state.musicVol, this.state.sfxVol);
        sfx.buy();
      },
      lang: async (l) => {
        // тексты расставлены при запуске, поэтому проще всего перезапустить игру на новом языке
        this.state = { ...this.state, langPref: l };
        await this.save();
        location.reload();
      },
      reset: async () => {
        this.state = resetProgress(this.state, Date.now());
        await this.save();
        location.reload();
      },
    });
    void this.save();
  }

  private hold(reason: string, on: boolean) {
    if (on) {
      if (!this.pauses.has(reason)) this.pauses.set(reason, Date.now());
    } else this.pauses.delete(reason);
    this.applyPause();
  }

  // Пауза на время рекламы или покупки. Если площадка не ответила за maxMs, игра всё равно оживает,
  // а награда придёт, когда ответ всё-таки появится.
  private async during<T>(reason: string, task: Promise<T>, maxMs: number): Promise<T> {
    this.hold(reason, true);
    const timer = setTimeout(() => this.hold(reason, false), maxMs);
    try {
      return await task;
    } finally {
      clearTimeout(timer);
      this.hold(reason, false);
      // вкладка вернулась вместе с концом рекламы — площадка могла забыть прислать «продолжить»
      if (!document.hidden) this.hold('platform', false);
    }
  }

  private applyPause() {
    this.setPaused(this.pauses.size > 0);
  }

  private setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    setAudioPaused(p);
    if (p) {
      this.gameplayStop();
      void this.save();
      this.scene.scene.pause();
    } else {
      this.scene.scene.resume();
      this.gameplayStart();
    }
  }

  // Яндекс просит сообщать о начале и конце игрового процесса парами, без повторов.
  private gameplay = false;
  private gameplayStart() {
    if (this.gameplay || this.paused || this.modalOpen) return;
    this.gameplay = true;
    this.platform.gameplayStart();
  }
  private gameplayStop() {
    if (!this.gameplay) return;
    this.gameplay = false;
    this.platform.gameplayStop();
  }

  private async save() {
    this.lastSave = Date.now();
    await this.platform.save(this.state);
  }
}
